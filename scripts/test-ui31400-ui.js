#!/usr/bin/env node
/* bitGen Studio — 3.14.0 in a REAL browser: 🏞 Scene in Layers (🎨 Poster: each layer made on its own, cut out, put in its
 * place, a 🌑 shadow, the words as text; 📷 Photo: one scene, then the edit model pulls the plate and each object out), 🤖 Plan
 * with the AI, ✨ Create ▸ 🏞 Scene in layers, and 🛤 Ground & Perspective (a drag up the road shrinks the horse, its shadow
 * goes with it, one undo). The picture jobs, the edit model and the LLM are stood in for.
 * Tim: "... horse layer will be a full horse adjusted to the position of the road, we can move the horse up and down the road,
 * and maybe add a perspective tool?" -> "lets do both, it will be one for a photo composition and one for creating posters" */
"use strict";
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
/** a w x h PNG: `bg` everywhere, a `fg` rectangle [x, y, w, h] */
function png(w, h, bg, fg, r) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const rows = [];
  for (let y = 0; y < h; y++) { const row = Buffer.alloc(1 + w * 4); for (let x = 0; x < w; x++) { const inR = r && x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]; Buffer.from(inR ? fg : bg).copy(row, 1 + x * 4); } rows.push(row); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.dismiss().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const GREY = [200, 200, 200, 255], RED = [200, 30, 30, 255];
  const PICS = { "bg.png": png(320, 192, [40, 90, 200, 255]), "obj.png": png(128, 128, GREY, RED, [32, 12, 64, 104]), "scene.png": png(320, 192, [30, 150, 60, 255]),
    "plate.png": png(320, 192, [40, 90, 200, 255]), "ext.png": png(320, 192, GREY, RED, [40, 90, 40, 80]) };
  const gen = [], edits = []; let jobN = 0; const jobOut = {};
  await p.route("**/api/genimage", async (rt) => { const body = JSON.parse(rt.request().postData() || "{}"); gen.push(body); const id = "j" + (++jobN); jobOut[id] = /scene:/.test(body.prompt) || /In the scene:/.test(body.prompt) ? "scene.png" : /empty place/.test(body.prompt) ? "bg.png" : "obj.png"; rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id }) }); });
  await p.route("**/api/aiedit", async (rt) => { const t = rt.request().postData() || ""; const pr = /Remove the /.test(t) ? "plate" : "extract"; edits.push({ pr, model: /qwen-edit-test/.test(t) }); const id = "j" + (++jobN); jobOut[id] = pr === "plate" ? "plate.png" : "ext.png"; rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: [{ id }] }) }); });
  await p.route("**/api/jobs/j*", (rt) => { const id = rt.request().url().split("/api/jobs/")[1].split("?")[0]; rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id, status: "done", outputs: [jobOut[id]] }) }); });
  await p.route("**/outputs/*", (rt) => { const n = decodeURIComponent(rt.request().url().split("/outputs/")[1].split("?")[0]); if (!PICS[n]) return rt.continue(); rt.fulfill({ status: 200, contentType: "image/png", body: PICS[n] }); });
  await p.route("**/api/subject/matte*", (rt) => rt.fulfill({ status: 404, contentType: "application/json", body: '{"error":"not installed"}' }));
  let planAsk = null;
  await p.route("**/api/layerscene/plan", (rt) => { planAsk = JSON.parse(rt.request().postData() || "{}"); rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ plan: { rows: [{ name: "Lake", kind: "background", desc: "a lake", where: "all", size: 100, ground: false }, { name: "Horse", kind: "object", desc: "a horse", where: "bottom-left", size: 40, ground: true }, { name: "WILD", kind: "text", desc: "WILD", where: "top", size: 10, ground: false }], style: "a photo", lighting: "sun", camera: "eye level", horizon: 40, w: 320, h: 192 } }) }); });
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.layerScene && window.imageEditorInstance.E.ground, null, { timeout: 90000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, .secfloat.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:50"; });
    await ev(() => { const E = window.imageEditorInstance.E; let s = document.getElementById("styleSel"); if (!s) { s = document.createElement("select"); s.id = "styleSel"; document.body.appendChild(s); } if (![...s.options].some((o) => o.value === "img-test")) s.add(new Option("test", "img-test")); s.value = "img-test";
      E.store.set("editstyle", "qwen-edit-test"); const es = document.getElementById("ieEditStyle"); if (es) { if (![...es.options].some((o) => o.value === "qwen-edit-test")) es.add(new Option("edit", "qwen-edit-test")); es.value = "qwen-edit-test"; } E.store.set("lscene.rows", null); });
    // ---- 🎨 Poster
    await ev(() => window.imageEditorInstance.E.openDoc(320, 192, "Scene", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 320, 192); }));
    await ev(() => window.imageEditorInstance.E.ui.run("layer.layerscene")); await p.locator(".kxdlg.pcd #lsRows").waitFor({ timeout: 5000 });
    const r0 = await ev(() => [...document.querySelectorAll(".kxdlg.pcd .lsrow")].map((r) => r.querySelector(".lsKind").value + ":" + r.querySelector(".lsName").value));
    check("Layer ▸ 🏞 Scene in Layers… opens with the lake / cabin / horse / title rows", r0.join() === "background:Background,object:Cabin,object:Horse,text:Title", r0);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector('input[name="lsMode"][value="poster"]').checked = true; d.querySelectorAll(".lsrow")[1].querySelector(".lsX").click(); d.querySelector("#lsHor").value = "40"; });
    await ev(() => { const s = document.getElementById("styleSel"); if (![...s.options].some((o) => o.value === "img-test")) s.add(new Option("test", "img-test")); s.value = "img-test"; });
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => window.imageEditorInstance.E.S.layers.some((L) => L.type === "group" && /^🏞/.test(L.name)), null, { timeout: 30000 });
    const P = await ev(() => { const S = window.imageEditorInstance.E.S, G = S.layers.find((L) => L.type === "group" && /^🏞/.test(L.name)), kids = S.layers.filter((L) => L.parent === G.id);
      const H = kids.find((L) => /Horse/.test(L.name) && L.type === "pixel" && !/shadow/.test(L.name)), sh = S.layers.find((L) => /Horse shadow/.test(L.name)), T = kids.find((L) => L.type === "text");
      if (!H) return { kids: kids.map((L) => L.name + ":" + L.type), all: S.layers.map((L) => L.name + ":" + (L.parent ? "<" : "")), msg: (document.getElementById("kxStatus") || {}).textContent };
      const bx = window.imageEditorInstance.E.alphaBox(H.canvas), a = (x, y) => H.canvas.getContext("2d").getImageData(x, y, 1, 1).data;
      return { kids: kids.map((L) => L.name), horizon: S.groundH, box: bx, mid: [...a(Math.round(bx.x + bx.w / 2), Math.round(bx.y + bx.h / 2))], outA: a(2, 2)[3], shadow: !!sh, shBelow: sh && S.layers.indexOf(sh) === S.layers.indexOf(H) - 1, linked: H.groundShadow === (sh && sh.id), text: T && T.text.str }; });
    check("🎨 Poster: a group with the background, the horse, its 🌑 shadow just below it, the title as a TEXT layer; the horizon set (40 % of 192)",
      P.kids.join() === "🏞 Background,🌑 Horse shadow,🐎 Horse,🔤 Title" && P.horizon === 77 && P.shadow && P.shBelow && P.linked && P.text === "WILD COUNTRY", P);
    check("…the horse is cut out (its backdrop gone, it is solid) and stands on the ground below the horizon at the height asked (38 %)", P.outA === 0 && P.mid[0] > 150 && P.mid[3] === 255 && P.box.y + P.box.h > P.horizon && Math.abs(P.box.h - 0.38 * 192) < 3, P);
        check("…one picture per layer from the prompt docker's style: the background empty, the horse alone", gen.length === 2 && gen.every((g) => g.style_id === "img-test") && /no horse/.test(gen[0].prompt) && /The whole horse/.test(gen[1].prompt) && edits.length === 0, gen.map((g) => g.prompt.slice(0, 60)));
    // ---- 🛤 Ground: drag the horse up the road
    const G1 = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, H = S.layers.find((L) => L.name === "🐎 Horse"); S.active = S.layers.indexOf(H); E.setTool("ground");
      const b0 = E.alphaBox(H.canvas), f0 = [b0.x + b0.w / 2, b0.y + b0.h], T = E.tools.ground, hz = S.groundH, ty = Math.round(hz + (f0[1] - hz) / 2);
      T.down({ shiftKey: false }, f0[0], f0[1]); T.move({}, f0[0] + 20, ty); T.up({}, f0[0] + 20, ty);
      const b1 = E.alphaBox(H.canvas), sh = S.layers.find((L) => L.name === "🌑 Horse shadow"), sb = E.alphaBox(sh.canvas);
      return { b0, b1, f1: [b1.x + b1.w / 2, b1.y + b1.h], ty, ratio: b1.h / b0.h, shFoot: sb.y + sb.h, opts: document.getElementById("grH") ? +document.getElementById("grH").value : null }; });
    check("🛤 dragged halfway to the horizon: the horse is half its height, its feet where it was dragged", Math.abs(G1.ratio - 0.5) < 0.06 && Math.abs(G1.f1[1] - G1.ty) <= 2, G1);
    check("…its shadow went with it (its feet), the options bar shows the horizon", Math.abs(G1.shFoot - G1.ty) < 8 && G1.opts === 77, G1);
    const u = await ev(() => { const E = window.imageEditorInstance.E, H = E.S.layers.find((L) => L.name === "🐎 Horse"); E.undo(); return E.alphaBox(H.canvas); });
    check("…one undo puts it back", Math.abs(u.h - G1.b0.h) <= 1 && Math.abs(u.y - G1.b0.y) <= 1, { u, b0: G1.b0 });
    const hz = await ev(() => { const E = window.imageEditorInstance.E, T = E.tools.ground; T.down({ shiftKey: true }, 10, 50); T.move({}, 10, 60); T.up({}, 10, 60); return E.S.groundH; });
    check("…Shift+drag sets the horizon", hz === 60, hz);
    // ---- 📷 Photo
    gen.length = 0; edits.length = 0;
    await ev(() => { window.imageEditorInstance.E.setTool("move"); window.imageEditorInstance.E.ui.run("layer.layerscene"); }); await p.locator(".kxdlg.pcd #lsRows").waitFor({ timeout: 5000 });
    await ev(() => { document.querySelector('.kxdlg.pcd input[name="lsMode"][value="photo"]').checked = true; const s = document.getElementById("styleSel"); if (![...s.options].some((o) => o.value === "img-test")) s.add(new Option("test", "img-test")); s.value = "img-test"; });
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => window.imageEditorInstance.E.S.layers.filter((L) => L.type === "group" && /^🏞/.test(L.name)).length === 2, null, { timeout: 30000 });
    const Ph = await ev(() => { const S = window.imageEditorInstance.E.S, G = S.layers.filter((L) => L.type === "group" && /^🏞/.test(L.name) && S.layers.some((x) => x.parent === L.id && /^📷/.test(x.name)))[0], kids = S.layers.filter((L) => L.parent === G.id);
      const H = kids.find((L) => L.name === "🐎 Horse"), a = (x, y) => H.canvas.getContext("2d").getImageData(x, y, 1, 1).data;
      return { tops: S.layers.filter((L) => !L.parent).map((L) => L.name), kids: kids.map((L) => L.name + (L.visible === false ? "(hidden)" : "")), inside: [...a(60, 130)], outside: a(5, 5)[3] }; });
    check("📷 Photo: ONE picture of the whole scene, then the edit model (the one picked) for the plate and the horse", gen.length === 1 && /In the scene: Horse/.test(gen[0].prompt) && edits.map((e) => e.pr).join() === "plate,extract" && edits.every((e) => e.model), { gen: gen.map((g) => g.prompt.slice(0, 50)), edits });
    check("…the scene kept hidden at the bottom, the plate as the background, the horse pulled out WHERE IT STOOD (cut out), its shadow, the title",
      Ph.kids.join() === "📷 Scene (all of it)(hidden),🏞 Background,🌑 Horse shadow,🐎 Horse,🔤 Title" && Ph.tops.filter((n) => /^🏞/.test(n)).length === 2 && Ph.inside[3] === 255 && Ph.inside[0] > 150 && Ph.outside === 0, Ph);
    // ---- 🤖 Plan + ✨ Create ▸ 🏞
    await ev(() => window.imageEditorInstance.E.ui.run("file.createai")); await p.locator(".kxdlg.pcd").waitFor({ timeout: 5000 });
    await p.locator('.kxdlg.pcd [name="pccrKind"][value="scene"]').check({ force: true });
    await p.fill("#pccrAsk", "a horse by a lake, the title WILD");
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => { const d = document.querySelector(".kxdlg.pcd #lsRows"); return d && d.querySelectorAll(".lsrow").length === 3; }, null, { timeout: 10000 });
    const pl = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return { ask: d.querySelector("#lsAsk").value, rows: [...d.querySelectorAll(".lsrow")].map((r) => r.querySelector(".lsName").value), hor: d.querySelector("#lsHor").value, style: d.querySelector("#lsStyle").value }; });
    check("✨ Create ▸ 🏞 Scene in layers: the box opens with your words and 🤖 the LLM's layers, style and horizon filled in", pl.ask === "a horse by a lake, the title WILD" && planAsk && planAsk.ask === pl.ask && pl.rows.join() === "Lake,Horse,WILD" && pl.hor === "40" && pl.style === "a photo", { pl, planAsk });
    await ev(() => document.querySelector(".kxdlg.pcd .cn").click());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
