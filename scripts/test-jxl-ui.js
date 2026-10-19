#!/usr/bin/env node
/* bitGen Studio — 2.479.0 in a REAL browser: JPEG XL (.jxl) PICTURES (static/jxl.js, routes/jxl.js, the editor's
 * Export As). Tim (verbatim): "add jxl file support"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the JPEG XL browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch(); global.__b = b;
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.BGJxl, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#ff0000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods, steps) => { await p.waitForTimeout(120); const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: steps || 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(100); };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(80); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(120); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, name: L && L.name,
      smart: L && L.smart ? JSON.parse(JSON.stringify(L.smart)) : null, fmask: !!(L && L.fmask), names: s.layers.map((x) => x.type + ":" + x.name) }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const count = (x0, y0, x1, y1, f) => ev(([a, b2, c, d, fs]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; const D = L.canvas.getContext("2d").getImageData(a, b2, c - a, d - b2).data; const fn = new Function("r", "g", "b", "a", "return " + fs); let n = 0; for (let i = 0; i < D.length; i += 4) if (fn(D[i], D[i + 1], D[i + 2], D[i + 3])) n++; return n; }, [x0, y0, x1, y1, f]);
    const layerData = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(0, 0, s.w, s.h).data); });
    // 1. the page: write, show, read
    const pg = await ev(async () => {
      const c = document.createElement("canvas"); c.width = 120; c.height = 80; const g = c.getContext("2d");
      const gr = g.createLinearGradient(0, 0, 120, 0); gr.addColorStop(0, "#ff0000"); gr.addColorStop(1, "#0000ff"); g.fillStyle = gr; g.fillRect(0, 0, 120, 80);
      g.fillStyle = "#00ff00"; g.fillRect(30, 20, 40, 30); g.clearRect(0, 70, 120, 10);
      const orig = Array.from(g.getImageData(0, 0, 120, 80).data);
      const blob = await new Promise((ok) => c.toBlob(ok, "image/jxl", 1));
      const head = Array.from(new Uint8Array(await blob.slice(0, 2).arrayBuffer()));
      const im = new Image(); const u = URL.createObjectURL(blob);
      await new Promise((ok, no) => { im.onload = ok; im.onerror = () => no(new Error("img error")); im.src = u; });
      const c2 = document.createElement("canvas"); c2.width = 120; c2.height = 80; const g2 = c2.getContext("2d"); g2.drawImage(im, 0, 0);
      const got = Array.from(g2.getImageData(0, 0, 120, 80).data);
      let maxd = 0; for (let i = 0; i < orig.length; i++) if (orig[i - (i % 4) + 3] > 0) maxd = Math.max(maxd, Math.abs(orig[i] - got[i]));
      const bmp = await createImageBitmap(blob);
      const b64 = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
      const im2 = new Image(); await new Promise((ok, no) => { im2.onload = ok; im2.onerror = () => no(new Error("data url")); im2.src = String(b64).replace(/^data:[^;]*;/, "data:image/jxl;"); });
      const f = new File([blob], "x.jxl");
      const lossy = await new Promise((ok) => c.toBlob(ok, "image/jxl", 0.6));
      window.__jxlBlob = blob;
      return { type: blob.type, head, size: blob.size, lossy: lossy.size, w: im.naturalWidth, h: im.naturalHeight, maxd, bmp: [bmp.width, bmp.height], data: im2.naturalWidth, ftype: f.type };
    });
    check("canvas.toBlob(cb, 'image/jxl', 1) writes a lossless JPEG XL (FF 0A); 0.6 a smaller lossy one", pg.type === "image/jxl" && pg.head[0] === 255 && pg.head[1] === 10 && pg.lossy < pg.size, pg);
    check("an <img> shows a .jxl blob (120 x 80) with every pixel exact; createImageBitmap + a data:image/jxl URL too", pg.w === 120 && pg.h === 80 && pg.maxd === 0 && pg.bmp[0] === 120 && pg.data === 120, pg);
    check("a File named x.jxl with no type says image/jxl", pg.ftype === "image/jxl", pg.ftype);
    // 2. an upload that is not into the project's pictures goes as a PNG
    const up = await ev(async () => { const fd = new FormData(); fd.append("file", new File([window.__jxlBlob], "upload.jxl")); const r = await fetch("/api/assets", { method: "POST", body: fd }); return r.json(); });
    check("an upload of a .jxl elsewhere (the old assets) arrives as a PNG", up && /upload\.png$/.test(up.name || "") && up.kind === "image", up);
    // 3. the editor opens a .jxl
    const bytes = await ev(async () => Array.from(new Uint8Array(await window.__jxlBlob.arrayBuffer())));
    await p.setInputFiles("#ieFile", { name: "photo.jxl", mimeType: "", buffer: Buffer.from(bytes) });
    await p.waitForFunction(() => { const s = window.imageEditorInstance.state; return s.w === 120 && s.h === 80; }, null, { timeout: 15000 }).catch(() => {});
    const ed = await ev(() => { const s = window.imageEditorInstance.state, L = s.layers[0], px = Array.from(L.canvas.getContext("2d").getImageData(50, 30, 1, 1).data); return { w: s.w, h: s.h, name: s.name, px }; });
    check("File ▸ Open a .jxl: the picture opens in the editor (120 x 80, its pixels)", ed.w === 120 && ed.h === 80 && ed.px[1] === 255 && ed.px[0] === 0, ed);
    // 4. Export As: JPEG XL + Lossless, saved into the project's pictures as .jxl, shown there as a PNG
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(150); await p.click('.kxmenu [data-cmd="file.export"]'); await p.waitForTimeout(400);
    await p.selectOption(".kxdlg.pcd #pdF", "jxl"); await p.waitForTimeout(300);
    const rows = await ev(() => ({ q: document.querySelector("#pdQRow").style.display, l: document.querySelector("#pdLRow").style.display }));
    await p.check(".kxdlg.pcd #pdL"); await p.waitForTimeout(1200);
    const after = await ev(() => ({ q: document.querySelector("#pdQRow").style.display, info: document.querySelector("#pdInfo").textContent }));
    check("Export As offers JPEG XL: Quality + a Lossless box; Lossless hides Quality; the preview says JXL", rows.q === "" && rows.l === "" && after.q === "none" && /JXL/.test(after.info), [rows, after]);
    await p.fill(".kxdlg.pcd #pdN", "jxltest"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(1500);
    const list = await ev(async () => { const r = await (await fetch("/api/passets")).json(); return JSON.stringify(r); });
    const nm = (list.match(/jxltest-[a-z0-9]+\.jxl/) || [])[0];
    check("Save to Images keeps it a .jxl in the project's pictures", !!nm, list.slice(0, 300));
    if (nm) {
      const sh = await ev(async (n) => { const im = new Image(); await new Promise((ok, no) => { im.onload = ok; im.onerror = () => no(new Error("no")); im.src = "/passets/images/" + encodeURIComponent(n); }); const raw = await (await fetch("/passets/images/" + encodeURIComponent(n))).arrayBuffer(); return { w: im.naturalWidth, raw: Array.from(new Uint8Array(raw.slice(0, 2))) }; }, nm);
      check("it shows in the app (an <img> gets its PNG) while fetch() gets the .jxl itself", sh.w === 120 && sh.raw[0] === 255 && sh.raw[1] === 10, sh);
    }
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
