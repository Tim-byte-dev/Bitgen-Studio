#!/usr/bin/env node
/* bitGen Studio — 2.431.0 in a REAL browser: the IMAGE EDITOR and the PROMPT DOCKER (ext/imageeditdock/mount.js + core's
 * generateOne seam window.H3OnGenerated).
 * Tim: "when the editor is open the prompt docker changes to image mode - all generated images are sent to the open
 * canvas as a layer". The render itself is played by the page's own requests answered here (/api/genimage, the job, its
 * picture) - the editor's side is what is tested. Against the running app (H3_URL, default the e2e server on :8311).
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the editor / prompt docker browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
/** a w x h PNG of one colour */
function png(w, h, rgb) {
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "closed", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { localStorage.setItem("h3.genmode", "video"); localStorage.removeItem("h3.ie.modeWas"); } catch (e) { /* fine */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && typeof window.H3OnGenerated === "function" && document.getElementById("genModeSel"), null, { timeout: 60000 });
    await p.waitForTimeout(2600);                             // past the boot (the state it boots in is left alone)
    const mode = () => ev(() => ({ v: document.getElementById("genModeSel").value, chip: !!document.getElementById("pdToCanvas") && !document.getElementById("pdToCanvas").hidden }));
    const ieShow = (on) => ev((on) => { const d = document.getElementById("imageeditdock");
      if (on) { if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); }
      else if (!d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); }, on);
    await ev(() => { const s = document.getElementById("genModeSel"); s.value = "video"; s.onchange(); });
    await ieShow(false); await p.waitForTimeout(300);
    let m0 = await mode();
    await ieShow(true); await p.waitForTimeout(400);
    let m1 = await mode();
    check("the image editor opened: the prompt docker goes to 🖼 Image, a chip says the pictures go onto the canvas", m0.v === "video" && !m0.chip && m1.v === "image" && m1.chip, [m0, m1]);
    await ieShow(false); await p.waitForTimeout(400);
    let m2 = await mode();
    check("...closed: back to the mode it was in (Video), the chip gone", m2.v === "video" && !m2.chip, m2);
    await ieShow(true); await p.waitForTimeout(400);
    await ev(() => { const s = document.getElementById("genModeSel"); s.value = "audio"; s.onchange(); });
    await ieShow(false); await p.waitForTimeout(400);
    const m3 = await mode();
    check("...a mode picked while it was open is kept when it closes (Music stays)", m3.v === "audio", m3);
    await ev(() => { const s = document.getElementById("genModeSel"); s.value = "video"; s.onchange(); });

    /* the render: /api/genimage -> a job -> two pictures (answered here) */
    let n = 0;
    await p.route("**/api/genimage", (r) => { n++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "ietest" + n }) }); });
    await p.route(/\/api\/jobs\/ietest\d+$/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "ietest", status: "done", mode: "image", outputs: ["ietest_a.png", "ietest_b.png"], output: "ietest_a.png" }) }));
    await p.route(/\/outputs\/ietest_a\.png/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: png(200, 100, [255, 0, 0]) }));
    await p.route(/\/outputs\/ietest_b\.png/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: png(1000, 1000, [0, 0, 255]) }));
    await ieShow(true); await p.waitForTimeout(500);
    await p.waitForFunction(() => window.imageEditorInstance && window.imageEditorInstance.E, null, { timeout: 20000 });
    await ev(() => window.imageEditorInstance.E.openDoc(400, 300, "canvas.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 400, 300); }));
    const gen = (text) => ev(async (text) => {
      const ss = document.getElementById("styleSel"); if (!ss.value && ss.options.length) ss.value = ss.options[ss.options.length - 1].value;
      if (!ss.value) { const o = document.createElement("option"); o.value = "ietest-style"; o.textContent = "test"; ss.appendChild(o); ss.value = "ietest-style"; }
      const ecr = ensureComfyReady, cpf = comfyPreflight; ensureComfyReady = async () => true; comfyPreflight = async () => null;
      try { return await generateOne("image", text, null); } finally { ensureComfyReady = ecr; comfyPreflight = cpf; }
    }, text);
    const st1 = await gen("a red fox in the snow at dusk");
    await p.waitForFunction(() => window.imageEditorInstance.E.S.layers.length >= 3, null, { timeout: 15000 }).catch(() => null);
    const L = await ev(() => { const S = window.imageEditorInstance.E.S; return { name: S.name, layers: S.layers.map((x) => x.name), w: S.w, undo: S.undo.length,
      red: Array.from(S.layers[1] ? S.layers[1].canvas.getContext("2d").getImageData(200, 150, 1, 1).data : []).join(), redOut: S.layers[1] ? S.layers[1].canvas.getContext("2d").getImageData(10, 10, 1, 1).data[3] : -1,
      blue: Array.from(S.layers[2] ? S.layers[2].canvas.getContext("2d").getImageData(200, 150, 1, 1).data : []).join(), blueTop: S.layers[2] ? S.layers[2].canvas.getContext("2d").getImageData(200, 5, 1, 1).data[3] : -1 }; });
    check("a Generate while the editor is open: each picture lands on the document in front as a new layer named after the prompt (one undo step each)",
      st1 === "done" && L.name === "canvas.png" && L.layers.join("|") === "Background|✨ a red fox in the snow at dusk 1|✨ a red fox in the snow at dusk 2" && L.undo === 2, L);
    check("...a smaller picture sits centred at its size, a bigger one is scaled down to fit (centred)", L.red === "255,0,0,255" && L.redOut === 0 && L.blue === "0,0,255,255" && L.blueTop === 255, L);
    // no document: the picture opens as one
    await ev(() => window.imageEditorInstance.E.docs.closeAll(true));
    await gen("second one");
    await p.waitForFunction(() => window.imageEditorInstance.E.S.w > 0 && window.imageEditorInstance.E.S.layers.length >= 2, null, { timeout: 15000 }).catch(() => null);
    const L2 = await ev(() => { const E = window.imageEditorInstance.E; return { name: E.S.name, w: E.S.w, layers: E.S.layers.length, docs: E.docs.list().length }; });
    check("...with no document open the first picture opens as a document, the next joins it as a layer", L2.name === "ietest_a.png" && L2.w === 200 && L2.layers === 2 && L2.docs === 1, L2);
    // closed editor: nothing is added
    await ieShow(false); await p.waitForTimeout(300);
    await ev(() => { const s = document.getElementById("genModeSel"); s.value = "image"; s.onchange(); });
    const before = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await gen("third");
    await p.waitForTimeout(800);
    const after = await ev(() => window.imageEditorInstance.E.S.layers.length);
    check("the editor closed: a render goes only to the gallery (the canvas is left alone)", before === after, [before, after]);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the browser run finished\n      got " + JSON.stringify(String(e && e.stack || e)).slice(0, 900));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
