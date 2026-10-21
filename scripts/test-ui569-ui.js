#!/usr/bin/env node
/* bitGen Studio — 2.569.0 in a REAL browser: 🔲 ZONES in the image editor - boxes dragged on the canvas (move, size,
 * Delete), what goes in each, and the three ways: ▣ one ✨ Generate per box, ✎ the Edit model in one pass (the outlines
 * drawn on a copy), ▦ a regional prompt in one pass (/api/genimage {regions}); the route checks the boxes.
 * Tim: "can we add zones to the image editor - like put 3 boxes on the canvas, and tell the image model to put kite in this
 * box, dog in this box, bench in this box?" - "let me pick per run", on "both" a picture and a blank canvas.
 * Against the running app (H3_URL). The AI renders are stand-ins (E.api.aiedit / awaitResult; /api/genimage intercepted in
 * the page) - the route itself is asked for real. No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the zones browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const BASE = URL_.replace(/\/$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, b) => { const r = await fetch(BASE + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return { status: r.status, j: await r.json().catch(() => ({})) }; };

(async () => {
  /* 0 the route, asked for real */
  const styles = ((await api("/api/styles")).j.styles || []);
  const sd = styles.find((s) => s.engine === "sdcli" && (s.kind || "image") === "image");
  const cf = styles.find((s) => (s.engine || "comfy") === "comfy" && (s.kind || "image") === "image" && !s.chain && /t2i|sdxl|klein|flux|z.?image/i.test(String(s.workflow || s.name)));
  const ZB = [{ x: 0.1, y: 0.1, w: 0.3, h: 0.3, text: "a red kite" }, { x: 0.5, y: 0.5, w: 0.4, h: 0.4, text: "a dog" }];
  if (sd) { const r = await api("/api/genimage", { prompt: "a park", style_id: sd.id, regions: ZB });
    check("/api/genimage with regions + a style that is not ComfyUI = refused in words", r.status === 400 && /needs a ComfyUI image style/.test(r.j.error || ""), r); }
  if (cf) { const r = await api("/api/genimage", { prompt: "a park", style_id: cf.id, width: 1024, height: 768, regions: ZB.concat([{ x: 0, y: 0, w: 1, h: 1, text: "" }]) });
    const job = r.j.id ? (await api("/api/jobs/" + r.j.id)).j : null;
    if (r.j.id) await api(`/api/jobs/${r.j.id}/cancel`, {}).catch(() => {});
    check("...a ComfyUI style: the job carries the cleaned boxes (the empty one dropped) for the graph patcher",
      !!job && Array.isArray(job.params && job.params.regions) && job.params.regions.length === 2 && job.params.regions[0].text === "a red kite" && job.params.regions[1].w === 0.4, { r: r.j, params: job && job.params && job.params.regions }); }

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let genBody = null;
  await p.route("**/api/genimage", async (route) => { genBody = JSON.parse(route.request().postData() || "{}"); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "zzreg569" }) }); });
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.zones, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#30a040"; g.fillRect(0, 420, 800, 180); window.imageEditorInstance.load(c.toDataURL("image/png"), "z569"); setTimeout(ok, 800); }));
    await ev(() => { const pd = document.getElementById("promptdock"); if (pd) pd.style.display = "none";   // (a floating prompt docker can sit over the canvas)
      const E0 = window.imageEditorInstance.E; if (E0.setFull) E0.setFull(true); if (E0.fitView) E0.fitView();   // (the editor full size - the canvas big enough to drag on)
      window.imageEditorInstance.E.zones.open(); const s = document.getElementById("kxSee"); if (s && s.checked) { s.checked = false; if (s.onchange) s.onchange(); } });
    const ui = await ev(() => ({ box: !!document.getElementById("kxZones"), inAi: !!document.getElementById("kxZones").closest(".kx"), method: document.getElementById("pzMethod").value,
      methods: [...document.getElementById("pzMethod").options].map((o) => o.value).join(), tool: !!document.querySelector('[data-tool="zones"], [data-t="zones"], #tool_zones') || !!window.imageEditorInstance.E.tools.zones }));
    check("the ✨ AI panel has 🔲 Zones: three ways (▣ one box at a time, ✎ Edit model, ▦ Regional) - a picture starts on ▣", ui.box && ui.inAi && ui.methods === "boxes,edit,regional" && ui.method === "boxes" && ui.tool, ui);

    /* 1 drawing boxes with the mouse */
    const at = async (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.cv.getBoundingClientRect(); return [r.left + x * r.width / E.S.w, r.top + y * r.height / E.S.h]; }, [x, y]);
    const dragDoc = async (x0, y0, x1, y1) => { const a = await at(x0, y0), c = await at(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 4 }); await p.mouse.move(c[0], c[1], { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(150); };
    await p.waitForTimeout(400);
    await ev(() => document.getElementById("pzDraw").click()); await p.waitForTimeout(200);
    const where = await ev(() => { const E = window.imageEditorInstance.E, r = E.cv.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { w: Math.round(r.width), hit: el && (el.id || el.className) }; });
    if (where.w < 300) console.log("NOTE: the canvas shows small: " + JSON.stringify(where));
    await dragDoc(80, 60, 320, 240);
    await p.keyboard.type("a red kite");
    await dragDoc(450, 330, 720, 560);
    await p.keyboard.type("a dog");
    await dragDoc(300, 300, 420, 380);
    const z1 = await ev(() => ({ z: window.imageEditorInstance.E.S.zones.map((z) => [z.x, z.y, z.w, z.h, z.color, z.text]), rows: document.querySelectorAll("#pzList .pzz").length, tool: window.imageEditorInstance.E.S.tool }));
    check("🔲 Draw boxes = the Zones tool; three drags = three boxes, each its own colour and number; typing right after a drag names it",
      z1.tool === "zones" && z1.z.length === 3 && z1.rows === 3 && z1.z[0][4] === "red" && z1.z[1][4] === "blue" && z1.z[2][4] === "green" && z1.z[0][5] === "a red kite" && z1.z[1][5] === "a dog"
      && Math.abs(z1.z[0][0] - 80) <= 3 && Math.abs(z1.z[0][2] - 240) <= 4 && Math.abs(z1.z[1][3] - 230) <= 4, z1);
    // move box 3, size its corner, then Delete it
    await dragDoc(360, 340, 400, 360);
    await dragDoc(460, 400, 490, 420);
    const z2 = await ev(() => Object.assign({}, window.imageEditorInstance.E.S.zones[2]));
    await p.keyboard.press("Delete"); await p.waitForTimeout(150);                 // (the canvas has the focus after a drag)
    const z3 = await ev(() => window.imageEditorInstance.E.S.zones.length);
    check("drag a box = move it, drag its corner = size it; Delete removes the picked one", Math.abs(z2.x - 340) <= 4 && Math.abs(z2.y - 320) <= 4 && Math.abs(z2.w - 150) <= 5 && Math.abs(z2.h - 100) <= 5 && z3 === 2, { z2, z3 });
    const ov = await ev(() => { const E = window.imageEditorInstance.E, g = E.ov.getContext("2d"), z = E.S.zones[0]; let best = [0, 0, 0, 0]; for (let dy = -2; dy <= 2; dy++) { const d = g.getImageData(z.x + Math.round(z.w / 2), z.y + dy, 1, 1).data; if (d[3] > best[3]) best = Array.from(d); } return best; });
    check("the boxes are drawn over the canvas (the overlay), in their colour - never into the picture", ov[0] > 180 && ov[1] < 90 && ov[3] > 100, ov);

    if (process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, "569-zones.png") });
    /* 2 ▣ one box at a time: a ✨ Generate (Add content) per box, all at once, each first result applied */
    const r1 = await ev(async () => {
      const E = window.imageEditorInstance.E, S = E.S, reqs = [];
      window.__real = window.__real || { aiedit: E.api.aiedit, awaitResult: E.api.awaitResult };
      E.api.aiedit = async (req) => { const im = await createImageBitmap(req.crop), mk = await createImageBitmap(req.mask); reqs.push({ mode: req.mode, prompt: req.prompt, w: im.width, h: im.height, mw: mk.width }); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.fillStyle = reqs.length === 1 ? "#ff00ff" : "#ffff00"; g.fillRect(0, 0, c.width, c.height); const id = "zb" + reqs.length; (window.__out = window.__out || {})[id] = c.toDataURL("image/png"); return { jobs: [{ id, seed: 1 }] }; };
      E.api.awaitResult = async (id) => window.__out[id];
      const n0 = S.layers.length;
      document.getElementById("pzMethod").value = "boxes"; document.getElementById("pzMethod").onchange();
      document.getElementById("pzGo").click();
      for (let t = 0; t < 60 && S.layers.filter((x) => x.type !== "group").length < n0 + 2; t++) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 300));
      const added = S.layers.slice().filter((x) => /^🔲/.test(x.name));
      const pxIn = added.map((L) => Array.from(L.canvas.getContext("2d").getImageData(200, 150, 1, 1).data)), pxOut = added.map((L) => L.canvas.getContext("2d").getImageData(600, 100, 1, 1).data[3]);
      return { reqs, names: added.map((L) => L.name), pxIn, pxOut, cards: document.querySelectorAll("#pcPend .ppc").length };
    });
    check("▣ One box at a time: a ✨ Generate per box with its own words (both queued at once), each result in as a layer by itself (☑ Apply as they come) - inside its box only",
      r1.reqs.length === 2 && r1.reqs.every((x) => x.mode === "generate") && r1.reqs.map((x) => x.prompt).sort().join("|") === "a dog|a red kite" && r1.names.length === 2
      && r1.names.some((n) => /🔲 1 red/.test(n)) && r1.pxIn.some((d) => d[3] > 200) && r1.pxOut.every((a) => a === 0) && r1.cards === 0, r1);

    /* 3 ✎ the Edit model in one pass: the outlines drawn on a copy, one instruction */
    const r2 = await ev(async () => {
      const E = window.imageEditorInstance.E, S = E.S; let got = null;
      E.api.aiedit = async (req) => { const im = await createImageBitmap(req.crop), c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const z = S.zones[0], k = im.width / S.w, edge = Array.from(g.getImageData(Math.round((z.x + z.w / 2) * k), Math.round((z.y + 2) * k), 1, 1).data), mid = Array.from(g.getImageData(Math.round((z.x + z.w / 2) * k), Math.round((z.y + z.h / 2) * k), 1, 1).data);
        got = { mode: req.mode, prompt: req.prompt, style: req.style_id, w: im.width, h: im.height, edge, mid };
        const o = document.createElement("canvas"); o.width = im.width; o.height = im.height; o.getContext("2d").fillStyle = "#00ff00"; o.getContext("2d").fillRect(0, 0, o.width, o.height); (window.__out = window.__out || {}).ze = o.toDataURL("image/png"); return { jobs: [{ id: "ze", seed: 2 }] }; };
      const n0 = S.layers.length, layers0 = S.layers.map((x) => x.id);
      document.getElementById("pzScene").value = "a sunny park";
      document.getElementById("pzMethod").value = "edit"; document.getElementById("pzMethod").onchange();
      document.getElementById("pzGo").click();
      for (let t = 0; t < 60 && S.layers.length === n0; t++) await new Promise((r) => setTimeout(r, 100));
      const flatAfter = Array.from(E.flatten().getContext("2d").getImageData(10, 10, 1, 1).data);
      return Object.assign(got || {}, { added: S.layers.filter((x) => !layers0.includes(x.id) && x.type !== "group").map((x) => x.name), flatAfter, ownStyle: document.getElementById("ieEditStyle").value });
    });
    check("✎ Edit model, one pass: the WHOLE picture with each box outlined in its colour goes to the Edit model once - \"Put a red kite inside the red box. Put a dog inside the blue box … Remove every coloured box outline\"",
      r2.mode === "edit" && r2.w > 0 && /The scene: a sunny park\. Put a red kite inside the red box\. Put a dog inside the blue box\./.test(r2.prompt || "") && /Remove every coloured box outline/.test(r2.prompt || "")
      && r2.edge && r2.edge[0] > 200 && r2.edge[1] < 80 && r2.mid && !(r2.mid[0] > 200 && r2.mid[1] < 80 && r2.mid[2] < 80) && r2.style === r2.ownStyle && r2.added.length === 1, r2);

    /* 4 ▦ regional: a new picture from the boxes (the request intercepted) */
    const r3 = await ev(async () => {
      const E = window.imageEditorInstance.E, S = E.S;
      const o = document.createElement("canvas"); o.width = 1088; o.height = 816; o.getContext("2d").fillStyle = "#ff8800"; o.getContext("2d").fillRect(0, 0, o.width, o.height);
      E.api.awaitResult = async (id) => (id === "zzreg569" ? o.toDataURL("image/png") : null);
      document.getElementById("pzMethod").value = "regional"; document.getElementById("pzMethod").onchange();
      const st = document.getElementById("pzStyle"); st.dispatchEvent(new Event("focus"));
      for (let t = 0; t < 150 && ![...st.options].some((x) => x.value); t++) await new Promise((r) => setTimeout(r, 100));   // (/api/styles can take seconds)
      const opts = [...st.options].map((x) => x.value).filter(Boolean);
      const n0 = S.layers.length;
      document.getElementById("pzGo").click();
      for (let t = 0; t < 60 && S.layers.length === n0; t++) await new Promise((r) => setTimeout(r, 100));
      const L = S.layers.find((x) => /regional/.test(x.name));
      return { opts: opts.length, shown: getComputedStyle(st).display !== "none", name: L && L.name, px: L ? Array.from(L.canvas.getContext("2d").getImageData(790, 590, 1, 1).data) : null, w: L && L.canvas.width };
    });
    check("▦ Regional: a ComfyUI image style beside it; /api/genimage gets the scene, the picture's shape at ~1 MP and the boxes as fractions with their words - the picture comes back as a layer the size of the canvas",
      r3.shown && r3.opts >= 1 && !!genBody && genBody.prompt === "a sunny park" && genBody.width === 1184 && genBody.height === 880 && Array.isArray(genBody.regions) && genBody.regions.length === 2
      && genBody.regions[0].text === "a red kite" && Math.abs(genBody.regions[0].x - 0.1) < 0.01 && Math.abs(genBody.regions[1].w - 0.3375) < 0.01 && r3.name && r3.px && r3.px[0] > 200 && r3.px[1] > 100 && r3.w === 800, { r3, genBody });

    /* 5 a blank canvas starts on ▦ Regional; the boxes stay with their document */
    const r4 = await ev(() => new Promise((ok) => { const E = window.imageEditorInstance.E; const kept = E.S.zones.length; const c = document.createElement("canvas"); c.width = 640; c.height = 480; const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 640, 480);
      window.imageEditorInstance.load(c.toDataURL("image/png"), "blank569"); setTimeout(() => { const box = document.getElementById("kxZones"); box.open = false; const sel = document.getElementById("pzMethod"); sel.value = "boxes";
        // (a new document: the method follows the canvas again)
        setTimeout(() => { box.open = true; setTimeout(() => ok({ kept, now: (E.S.zones || []).length, method: sel.value }), 150); }, 100); }, 800); }));
    check("a document has its own boxes (the new one starts with none)", r4.kept === 2 && r4.now === 0, r4);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { const E = window.imageEditorInstance && window.imageEditorInstance.E; if (E && window.__real) { E.api.aiedit = window.__real.aiedit; E.api.awaitResult = window.__real.awaitResult; } }); } catch (e) { /* gone */ }
    try { await ev(() => { const pd = document.getElementById("promptdock"); if (pd) pd.style.display = ""; const E = window.imageEditorInstance && window.imageEditorInstance.E; if (E && E.setFull) E.setFull(false); }); } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
