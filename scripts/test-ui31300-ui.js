#!/usr/bin/env node
/* bitGen Studio — 3.13.0 in a REAL browser: the Layers panel's icon-only ✂ (split the selected layer into layers with Ming-Image) -
 * the box opens on "✂ Split the selected layer" with "Let Ming decide" ticked, it sends that layer alone (on white) + the number,
 * the layers come in a 🧩 group above it, cut to its shape, the layer hidden below; and ✨ Create With the AI ▸ 🧩 Layered image -
 * the LLM's layer plan (stood in for) opens the Ming box with the rows filled in. /api/ming, /api/ming/plan, the job and its
 * pictures are stood in for (the worker: scripts/test-ming-31200.py).
 * Tim: "in image editor please add a button at the bottom of layers docker icon only to split layer into layers, add a template in
 * ai generated dialog for layered image - use ming image for the layered image" */
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
function png(w, h, rgba) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 4).fill(Buffer.from(rgba))]), raw = Buffer.concat(Array.from({ length: h }, () => row));
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.dismiss().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const dlg = () => p.locator(".kxdlg.pcd");
  let posted = null, polls = 0, outs = [], planAsked = null;
  const PICS = { "Shape_ming_L01_Layer_1.png": png(64, 48, [255, 0, 0, 255]), "Shape_ming_L02_Layer_2.png": png(64, 48, [0, 255, 0, 255]), "Shape_ming_L03_Background.png": png(64, 48, [0, 0, 255, 255]) };
  await p.route("**/api/ming", async (rt) => {
    if (rt.request().method() !== "POST") return rt.continue();
    posted = JSON.parse(rt.request().postData() || "{}"); polls = 0;
    rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: { id: "ming313", status: "queued" }, rows: posted.rows }) });
  });
  await p.route("**/api/ming/plan", async (rt) => {
    planAsked = JSON.parse(rt.request().postData() || "{}");
    rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ plan: { rows: [{ name: "Headline", desc: '"GYM OPEN"', where: "top" }, { name: "Lion", desc: "a lion logo", where: "centre" }, { name: "Background", desc: "navy", where: "all" }], style: "bold sports poster", lighting: "dramatic", aspect: "4:5", w: 912, h: 1152 } }) });
  });
  await p.route("**/api/jobs/ming313*", (rt) => { polls++; rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(polls < 2 ? { id: "ming313", status: "running" } : { id: "ming313", status: "done", outputs: outs, output: outs[outs.length - 1] }) }); });
  await p.route("**/outputs/*", (rt) => { const n = decodeURIComponent(rt.request().url().split("/outputs/")[1].split("?")[0]); if (!PICS[n]) return rt.continue(); rt.fulfill({ status: 200, contentType: "image/png", body: PICS[n] }); });
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.ming, null, { timeout: 90000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, .secfloat.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:50"; });
    await ev(() => { const E = window.imageEditorInstance.E; ["ming.rows", "ming.mode", "ming.engine", "ming.auto", "ming.count"].forEach((k) => E.store.set(k, null)); });
    const btn = await ev(() => { const b = document.getElementById("kxLSplit"); return b ? { text: b.textContent, title: b.title, inBar: b.parentNode.classList.contains("kxlbtns"), next: b.nextElementSibling && b.nextElementSibling.id } : null; });
    check("the Layers panel's bottom bar has an icon-only ✂ (before 🗑), its tooltip says what it does", btn && btn.text === "✂" && btn.inBar && btn.next === "kxLDel" && /Split this layer into layers/.test(btn.title), btn);
    // a picture with a white background and a shape layer: a red square in the middle
    await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(64, 48, "Doc", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 48); });
      const L = E.makeLayer("Shape"); const g = L.canvas.getContext("2d"); g.fillStyle = "#c00"; g.fillRect(16, 12, 32, 24); E.addLayer(L, "test"); });
    await p.click("#kxLSplit"); await dlg().waitFor({ timeout: 5000 });
    const d0 = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return { mode: d.querySelector('input[name="pmMode"]:checked').value, label: d.querySelector('input[name="pmMode"][value="layer"]').parentNode.textContent, auto: d.querySelector("#pmAuto").checked, list: getComputedStyle(d.querySelector(".pmList")).display, style: getComputedStyle(d.querySelector(".pmMake")).display }; });
    check("✂ opens the Ming box on \"Split the selected layer (Shape)\", Let Ming decide ticked, no list / style shown", d0.mode === "layer" && /Split the selected layer \(Shape\)/.test(d0.label) && d0.auto && d0.list === "none" && d0.style === "none", d0);
    await p.fill("#pmCount", "3");
    await p.locator('.kxdlg.pcd input[name="pmEng"][value="openrouter"]').check();
    outs = ["Shape_ming_L01_Layer_1.png", "Shape_ming_L02_Layer_2.png", "Shape_ming_L03_Background.png"];
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => window.imageEditorInstance.E.S.layers.some((L) => L.type === "group" && /^🧩/.test(L.name)), null, { timeout: 20000 });
    const sent = await ev(async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
      const at = (x, y) => [...g.getImageData(x, y, 1, 1).data]; return { w: im.width, corner: at(2, 2), mid: at(32, 24) }; }, posted.image);
    check("what it sends: that layer alone (red in the middle), on WHITE where it is transparent (not the white background layer - the layer); auto 3, the rows Layer 1, Layer 2, Background",
      sent.w === 64 && sent.corner.join() === "255,255,255,255" && sent.mid[0] > 180 && sent.mid[1] < 40 && posted.auto === 3 && posted.rows.map((r) => r.name).join() === "Layer 1,Layer 2,Background" && posted.name === "Shape" && posted.split === true, { sent, auto: posted.auto, rows: posted.rows, name: posted.name });
    const L = await ev(() => { const S = window.imageEditorInstance.E.S, G = S.layers.find((x) => x.type === "group"), src = S.layers.find((x) => x.name === "Shape");
      const kids = S.layers.filter((x) => x.parent === G.id), a = (x, px, py) => x.canvas.getContext("2d").getImageData(px, py, 1, 1).data[3];
      return { order: S.layers.map((x) => x.name + (x.parent ? "<" : "")), group: G.name, kids: kids.map((x) => x.name), above: S.layers.indexOf(G) === S.layers.indexOf(src) + kids.length + 1 && S.layers.indexOf(kids[0]) === S.layers.indexOf(src) + 1, /* a group follows its children in S.layers */ srcVis: src.visible, inA: kids.map((x) => a(x, 32, 24)), outA: kids.map((x) => a(x, 2, 2)) }; });
    check("the layers in a 🧩 group named after the layer, right above it, the background first in the list (the front on top)", L.group === "🧩 Shape" && L.above && L.kids.join() === "Background,Layer 2,Layer 1", L);
    check("…cut to the layer's shape: solid inside the square, transparent outside it", L.inA.every((x) => x === 255) && L.outA.every((x) => x === 0), L);
    check("…the split layer kept, hidden below", L.srcVis === false, L);

    // ---- ✨ Create With the AI ▸ 🧩 Layered image
    await ev(() => window.imageEditorInstance.E.ui.run("file.createai")); await dlg().waitFor({ timeout: 5000 });
    const k = await ev(() => [...document.querySelectorAll('.kxdlg.pcd [name="pccrKind"]')].map((r) => r.value));
    check("✨ Create With the AI has 🧩 Layered image", k.includes("layered"), k);
    await p.locator('.kxdlg.pcd [name="pccrKind"][value="layered"]').check({ force: true });
    const hint = await ev(() => [...document.querySelectorAll(".kxdlg.pcd .pccr-o")].filter((x) => x.style.display !== "none").map((x) => x.textContent).join(" | "));
    check("…its line says what happens (the LLM plans the layers, the Ming box opens to check them)", /LLM plans the layers/.test(hint) && /Ming Layered Design box opens/.test(hint), hint);
    await p.fill("#pccrAsk", "a gym poster with a lion logo");
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => { const d = document.querySelector(".kxdlg.pcd"); return d && d.querySelector("#pmRows"); }, null, { timeout: 10000 });
    const m = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return { rows: [...d.querySelectorAll(".pmrow")].map((r) => r.querySelector(".pmName").value + "/" + r.querySelector(".pmWhere").value), mode: d.querySelector('input[name="pmMode"]:checked').value, style: d.querySelector("#pmStyle").value, light: d.querySelector("#pmLight").value }; });
    check("…the LLM is asked with your words; the Ming box opens on ✨ Make with its layers, style and lighting filled in",
      planAsked && planAsked.ask === "a gym poster with a lion logo" && m.mode === "make" && m.rows.join() === "Headline/top,Lion/centre,Background/all" && m.style === "bold sports poster" && m.light === "dramatic", { planAsked, m });
    await ev(() => document.querySelector(".kxdlg.pcd .cn").click());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
