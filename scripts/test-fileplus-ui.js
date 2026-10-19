#!/usr/bin/env node
/* bitGen Studio — 2.485.0 in a REAL browser: MORE FILE TYPES, FILE INFO, PRINT, CONTACT SHEET, CROP AND STRAIGHTEN
 * PHOTOS (ext/imageeditdock/pcfileplus.js, routes/imgconvert.js) - the image editor's gap, round F (part 1).
 * Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the file types / file info / contact sheet browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.imageEditorInstance.E.filePlus && window.imageEditorInstance.E.warp, null, { timeout: 60000 });
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

    const E_ = (f, a) => ev(f, a);
    // a picture: a red / blue split with a clear corner
    await E_(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d"); g.clearRect(0, 0, 600, 400); g.fillStyle = "#d02020"; g.fillRect(0, 0, 300, 400); g.fillStyle = "#2040d0"; g.fillRect(300, 0, 300, 400); g.clearRect(0, 0, 40, 40); L.ver = (L.ver || 0) + 1; E.renderLayers(); E.flattenCache && (E.flattenCache.ver = -1); });
    // Export As: the formats
    await E_(() => window.imageEditorInstance.E.ui.run("file.export")); await p.waitForTimeout(500);
    const opts = await E_(() => Array.from(document.querySelectorAll(".kxdlg #pdF option")).map((o) => o.value));
    check("Export As: PNG, JPEG, WebP, JPEG XL + AVIF, GIF, TIFF, BMP, TGA", ["png", "jpeg", "webp", "jxl", "avif", "gif", "tiff", "bmp", "tga"].every((x) => opts.includes(x)), opts);
    const pick = async (f) => { await p.selectOption(".kxdlg #pdF", f); await p.waitForTimeout(900); if (f === "avif") await p.waitForFunction(() => /AVIF/.test(document.querySelector(".kxdlg #pdInfo").textContent), null, { timeout: 60000 }).catch(() => {}); return E_(() => ({ info: document.querySelector(".kxdlg #pdInfo").textContent, q: document.querySelector(".kxdlg #pdQRow").style.display })); };
    const gif = await pick("gif"), tif = await pick("tiff"), bmp = await pick("bmp"), avif = await pick("avif");
    check("Export As: GIF / TIFF / BMP made in the page (no quality for them); the size shown", /GIF/.test(gif.info) && gif.q === "none" && /TIFF/.test(tif.info) && /BMP/.test(bmp.info) && /600 × 400/.test(bmp.info) && /9\d\d KB|9\d\d\.?\d* KB|0\.9\d MB/.test(bmp.info), { gif, tif, bmp });
    check("Export As: AVIF made by ffmpeg on this computer (a quality slider)", /AVIF/.test(avif.info) && avif.q === "", avif);
    await E_(() => document.querySelector(".kxdlg .cn") && document.querySelector(".kxdlg .cn").click());
    // the encoders through canvas.toBlob
    const blobs = await E_(async () => {
      const f = window.imageEditorInstance.E.flatten(), get = (t) => new Promise((ok) => f.toBlob(async (b) => ok(b ? { type: b.type, size: b.size, head: Array.from(new Uint8Array(await b.slice(0, 12).arrayBuffer())) } : null), t, 0.8));
      return { bmp: await get("image/bmp"), tif: await get("image/tiff"), gif: await get("image/gif"), tga: await get("image/x-tga"), avif: await get("image/avif"), png: await get("image/png") };
    });
    check("canvas.toBlob: BMP (BM, 32 bits), TIFF (II*), GIF (GIF89a), TGA - the page's own encoders", blobs.bmp && blobs.bmp.head[0] === 66 && blobs.bmp.head[1] === 77 && blobs.tif.head[0] === 73 && blobs.tif.head[2] === 42 && String.fromCharCode(...blobs.gif.head.slice(0, 6)) === "GIF89a" && blobs.tga.head[2] === 2 && blobs.png.type === "image/png", blobs);
    check("canvas.toBlob: AVIF comes back from the server ('ftypavif')", blobs.avif && blobs.avif.type === "image/avif" && String.fromCharCode(...blobs.avif.head.slice(4, 12)) === "ftypavif", blobs.avif);
    const gifBack = await E_(async () => { const f = window.imageEditorInstance.E.flatten(); const b = await new Promise((ok) => f.toBlob(ok, "image/gif")); const im = await createImageBitmap(b); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); return { w: im.width, a: Array.from(g.getImageData(100, 200, 1, 1).data), b: Array.from(g.getImageData(500, 200, 1, 1).data), clear: g.getImageData(5, 5, 1, 1).data[3] }; });
    check("GIF: the browser shows it back - red, blue, the clear corner clear", gifBack.w === 600 && gifBack.a[0] > 190 && gifBack.a[2] < 60 && gifBack.b[2] > 190 && gifBack.clear === 0, gifBack);
    // File Info
    await E_(() => window.imageEditorInstance.E.ui.run("file.info")); await p.waitForTimeout(300);
    await p.fill('.kxdlg [data-fi="title"]', "Harbour at dawn"); await p.fill('.kxdlg [data-fi="author"]', "Tim"); await p.fill('.kxdlg [data-fi="keywords"]', "sea, boats");
    await p.click(".kxdlg .ok"); await p.waitForTimeout(200);
    const fi = await E_(async () => { const E = window.imageEditorInstance.E, f = E.flatten(); const png = await new Promise((ok) => f.toBlob(ok, "image/png")); const jpg = await new Promise((ok) => f.toBlob(ok, "image/jpeg", 0.8));
      const p2 = new Uint8Array(await (await E.fileInfoBlob(png, "image/png")).arrayBuffer()), j2 = new Uint8Array(await (await E.fileInfoBlob(jpg, "image/jpeg")).arrayBuffer());
      const s = (u) => Array.from(u).map((c) => String.fromCharCode(c)).join("");
      return { info: E.S.fileInfo, png: s(p2).includes("iTXtTitle") && s(p2).includes("Harbour at dawn"), jpg: s(j2.slice(0, 2000)).includes("<rdf:li>boats</rdf:li>"), pngOk: !!(await createImageBitmap(new Blob([p2], { type: "image/png" }))) }; });
    check("File Info: kept with the document; written into PNG (text chunks) and JPEG (XMP) - the PNG still opens", fi.info && fi.info.title === "Harbour at dawn" && fi.info.author === "Tim" && fi.png && fi.jpg && fi.pngOk, fi);
    const menu = await E_(() => { const C = window.imageEditorInstance.E.ui.CMD; return ["file.info", "file.print", "auto.contact", "auto.cropstraighten"].map((k) => C.get(k) && C.get(k).key); });
    check("File ▸ File Info (Alt+Shift+Ctrl+I), Print (Ctrl+P), Automate ▸ Contact Sheet / Crop and Straighten Photos", menu[0] === "Alt+Shift+Ctrl+I" && menu[1] === "Ctrl+P" && menu[2] !== undefined && menu[3] !== undefined, menu);
    // Print: the page put together (the system print dialog stubbed)
    await E_(() => { window.__printed = 0; const o = HTMLIFrameElement.prototype; const d = Object.getOwnPropertyDescriptor(o, "contentWindow"); Object.defineProperty(o, "contentWindow", { configurable: true, get() { const w = d.get.call(this); if (w) w.print = () => { window.__printed++; window.__printDoc = this.contentDocument.documentElement.outerHTML.slice(0, 600); }; return w; } }); });
    await E_(() => window.imageEditorInstance.E.ui.run("file.print")); await p.waitForTimeout(300);
    await p.selectOption(".kxdlg #prMode", "size"); await p.fill(".kxdlg #prW", "12"); await p.selectOption(".kxdlg #prO", "landscape");
    await p.click(".kxdlg .ok"); await p.waitForTimeout(900);
    const pr = await E_(() => ({ n: window.__printed, html: window.__printDoc || "", last: window.imageEditorInstance.E.lastPrint }));
    check("Print: a page with the picture 12 cm wide, landscape, and the print dialog asked for", pr.n === 1 && /size:landscape/.test(pr.html) && /width:12cm/.test(pr.html) && /<img src="data:image\/png/.test(pr.html), pr);
    // Crop and Straighten Photos: a scan with two photos, one turned
    const before = await E_(() => window.imageEditorInstance.E.docs.list().length);
    await E_(() => { const E = window.imageEditorInstance.E; E.openDoc(500, 360, "scan.png", (g) => { g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, 500, 360); g.fillStyle = "#3060a0"; g.fillRect(40, 40, 160, 110); g.save(); g.translate(330, 230); g.rotate(10 * Math.PI / 180); g.fillStyle = "#a05030"; g.fillRect(-90, -55, 180, 110); g.restore(); }); });
    await p.waitForTimeout(300);
    await E_(() => window.imageEditorInstance.E.ui.run("auto.cropstraighten")); await p.waitForTimeout(800);
    const cs = await E_(() => { const E = window.imageEditorInstance.E, L = E.docs.list(); return { names: L.map((d) => d.name), w: E.S.w, h: E.S.h, name: E.S.name, mid: Array.from(E.flatten().getContext("2d").getImageData(E.S.w >> 1, E.S.h >> 1, 1, 1).data), corner: Array.from(E.flatten().getContext("2d").getImageData(3, 3, 1, 1).data) }; });
    check("Crop and Straighten Photos: each photo opened as its own document, the turned one straight (180 x 110, its corner is photo not page)", cs.names.length === before + 3 && cs.names.some((n) => /scan photo 1/.test(n)) && /scan photo 2/.test(cs.name) && Math.abs(cs.w - 180) <= 3 && Math.abs(cs.h - 110) <= 3 && cs.corner[0] > 140 && cs.corner[2] < 80 && cs.mid[0] > 140, cs);
    // Contact Sheet: the open documents
    await E_(() => window.imageEditorInstance.E.ui.run("auto.contact")); await p.waitForTimeout(300);
    await p.selectOption(".kxdlg #csSrc", "docs"); await p.selectOption(".kxdlg #csPage", "1920x1080"); await p.fill(".kxdlg #csC", "3"); await p.fill(".kxdlg #csR", "2");
    await p.click(".kxdlg .ok"); await p.waitForTimeout(1500);
    const sh = await E_(() => { const E = window.imageEditorInstance.E, S = E.S; return { name: S.name, w: S.w, h: S.h, layers: S.layers.map((l) => l.name), n: E.docs.list().length }; });
    check("Contact Sheet: the open documents on a 1920 x 1080 page - a white background and one layer per picture, named after it", /Contact Sheet/.test(sh.name) && sh.w === 1920 && sh.h === 1080 && sh.layers.length === before + 3 + 1 && sh.layers.includes("scan photo 1") && sh.layers[0] === "Background", sh);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
