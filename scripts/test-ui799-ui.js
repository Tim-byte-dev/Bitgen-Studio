#!/usr/bin/env node
/* bitGen Studio — 2.799.0 in a REAL browser: PAGES (pcpages.js) + the DOCUMENT EXPORT (pcdtpout.js). Tim: "i want to give
 * the editor full desktop publishing ability like coreldraw, user can add multiple pages each page will have it's own
 * layers. export to cdr, ai,pdf". Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the pages browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const has = (bin) => { try { execSync("command -v " + bin, { stdio: "ignore" }); return true; } catch { return false; } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui799-"));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.pages && window.imageEditorInstance.E.dtpOut, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => document.getElementById("kxFull").click()); await p.waitForTimeout(800);

    /* 1 File ▸ New Document with Pages…: the dialog makes 3 A5 pages at 72 dpi */
    await ev(() => window.imageEditorInstance.E.ui.run("file.newpages")); await p.waitForTimeout(250);
    await ev(() => { const s = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("change")); }; s("pgnName", "Brochure"); s("pgnPreset", "A5"); s("pgnDpi", "72"); s("pgnN", "3"); document.getElementById("pgnOk").click(); });
    await p.waitForTimeout(500);
    let st = await ev(() => { const E = window.imageEditorInstance.E; return { n: E.pages.count(), w: E.S.w, h: E.S.h, name: E.S.name, panel: E.pages.shown(), thumbs: document.querySelectorAll("#pcPagesPanel [data-pgi]").length, label: document.querySelector("#pcPagesPanel [data-pgi] .pn:last-child").textContent }; });
    check("File ▸ New Document with Pages…: 3 pages, A5 portrait at 72 dpi = 420 x 595 px; the Pages panel shows the 3", st.n === 3 && st.w === 420 && st.h === 595 && st.name === "Brochure.png" && st.panel && st.thumbs === 3 && /A5 ▯ 72 dpi/.test(st.label), st);
    await shot("1-new");

    /* 2 page 1 gets a shape + a text layer; page 2 has only its own Background */
    await ev(() => {
      const E = window.imageEditorInstance.E, D = window.PCDoc || E.D;
      const B = E.makeLayer("Box", 420, 595, "shape"); B.shape = Object.assign({}, D.SHAPE_DEFAULT || {}, { kind: "rect", x: 40, y: 120, w: 200, h: 100, fill: "#3366cc", fillOn: true, strokeOn: true, stroke: "#000000", strokeW: 4, radius: 12 }); D.rasterize(B); E.addLayer(B, "box", false);
      const T = E.makeLayer("Title", 420, 595, "text"); T.text = Object.assign({}, D.TEXT_DEFAULT, { str: "Hello pages", size: 32, x: 40, y: 40, color: "#112233" }); D.rasterize(T); E.addLayer(T, "title", false);
    });
    await p.waitForTimeout(300);
    const p1 = await ev(() => window.imageEditorInstance.E.S.layers.map((L) => L.name));
    await p.click('#pcPagesPanel [data-pgi="1"]'); await p.waitForTimeout(400);
    st = await ev(() => { const E = window.imageEditorInstance.E; return { cur: E.pages.cur(), layers: E.S.layers.map((L) => L.name), undo: E.S.undo.length, on: document.querySelector("#pcPagesPanel .pgp.on").dataset.pgi }; });
    check("each page its own layers: page 1 = Background + Box + Title; a click on page 2 = only its Background (and its own empty undo)", p1.join() === "Background,Box,Title" && st.cur === 1 && st.layers.join() === "Background" && st.undo === 0 && st.on === "1", { p1, st });
    await p.click('#pcPagesPanel [data-pgi="0"]'); await p.waitForTimeout(400);
    st = await ev(() => { const E = window.imageEditorInstance.E; return { layers: E.S.layers.map((L) => L.name), undo: E.S.undo.length }; });
    check("…back on page 1: its layers and its undo as they were", st.layers.join() === "Background,Box,Title" && st.undo >= 2, st);

    /* 3 ⧉ duplicate, rename, ▼ move, 🗑 twice */
    await p.click("#pgDup"); await p.waitForTimeout(400);
    st = await ev(() => { const E = window.imageEditorInstance.E; return { n: E.pages.count(), cur: E.pages.cur(), name: E.pages.current().name, layers: E.S.layers.map((L) => L.name) }; });
    check("⧉ Duplicate: a copy after it with its layers, and to it", st.n === 4 && st.cur === 1 && st.name === "Page 1 copy" && st.layers.join() === "Background,Box,Title", st);
    await p.dblclick('#pcPagesPanel [data-pgn="1"]'); await p.keyboard.press("Control+A"); await p.keyboard.type("Back cover"); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    await p.click("#pgDown"); await p.click("#pgDown"); await p.waitForTimeout(200);
    st = await ev(() => { const E = window.imageEditorInstance.E; return { names: E.pages.list().map((x) => x.name), cur: E.pages.cur() }; });
    check("rename (double-click the name) + ▼ ▼: the copy is now the last page, still in front", st.names.join() === "Page 1,Page 2,Page 3,Back cover" && st.cur === 3, st);
    await p.click('#pcPagesPanel [data-pgi="2"]'); await p.waitForTimeout(300);
    await p.click("#pgDel"); await p.waitForTimeout(150);
    const armed = await ev(() => ({ n: window.imageEditorInstance.E.pages.count(), arm: document.getElementById("pgDel").classList.contains("arm") }));
    await p.click("#pgDel"); await p.waitForTimeout(300);
    st = await ev(() => { const E = window.imageEditorInstance.E; return { names: E.pages.list().map((x) => x.name), cur: E.pages.cur() }; });
    check("🗑: the first click only asks (armed), the second deletes the page; the page before comes to the front", armed.n === 4 && armed.arm && st.names.join() === "Page 1,Page 2,Back cover" && st.cur === 1, { armed, st });

    /* 4 Page setup: page 2 landscape -> its canvas turns; page 1 untouched */
    await p.click("#pgSetup"); await p.waitForTimeout(200);
    await ev(() => { document.querySelector('input[name="psuOr"][value="landscape"]').click(); document.getElementById("psuOk").click(); });
    await p.waitForTimeout(400);
    st = await ev(() => { const E = window.imageEditorInstance.E; return { w: E.S.w, h: E.S.h, pg: E.pages.current().orient, undo: E.S.undo.length }; });
    check("📐 Page setup ▭ Landscape: page 2's canvas = 595 x 420 (Canvas Size, undoable)", st.w === 595 && st.h === 420 && st.pg === "landscape" && st.undo >= 1, st);
    await shot("4-setup");

    /* 5 Export: PDF (every page, each layer a PDF layer, the box a path, the title real text) */
    const pdfB = await ev(async () => { const r = await window.imageEditorInstance.E.dtpOut.build("pdf", { embed: false }); return { b: Array.from(r.bytes), notes: r.notes }; });
    const pdf = path.join(tmp, "doc.pdf"); fs.writeFileSync(pdf, Buffer.from(pdfB.b));
    const PL = require("../static/vendor/pdf-lib.min.js"), back = await PL.PDFDocument.load(Buffer.from(pdfB.b));
    const sizes = back.getPages().map((pg) => [Math.round(pg.getWidth()), Math.round(pg.getHeight())].join("x"));
    const ocgs = back.catalog.lookup(PL.PDFName.of("OCProperties")).lookup(PL.PDFName.of("OCGs")).asArray().map((r) => back.context.lookup(r).lookup(PL.PDFName.of("Name")).decodeText());
    check("Export PDF: 3 pages at their sizes (A5 portrait, A5 landscape, A5 portrait - in pt)", sizes.join() === "420x595,595x420,420x595", sizes);
    check("…each layer a PDF layer named page / layer; the box went as a path, the title as real text", ocgs.includes("Page 1 / Box") && ocgs.includes("Page 1 / Title") && ocgs.includes("Back cover / Title") && pdfB.notes.vector === 2 && pdfB.notes.text === 2, { ocgs, notes: pdfB.notes });
    if (has("pdftotext")) { const t = execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8" }); check("…pdftotext reads the title from pages 1 and 3 (selectable text)", (t.match(/Hello pages/g) || []).length === 2, t); }
    if (has("qpdf")) { let ok = true; try { execFileSync("qpdf", ["--check", pdf], { stdio: "pipe" }); } catch (e) { ok = false; } check("…qpdf --check: no errors", ok); }

    /* 6 CorelDRAW pack = the PDF + one SVG a page; SVG pages alone */
    const z = await ev(async () => { const E = window.imageEditorInstance.E, r = await E.dtpOut.build("cdr", {}); const files = await window.BgZip.unzipAsync(r.bytes); const names = [...files.keys()]; const svg = window.BgZip.text(files.get(names.find((n) => /page 01\.svg$/.test(n)))); return { ext: r.ext, names, svg: svg.replace(/base64,[A-Za-z0-9+/=]+/g, "base64,…") }; });
    check("Export for .cdr: a .zip of the PDF + one SVG a page (+ a README how to get to .cdr)", z.ext === ".zip" && z.names.filter((n) => /\.svg$/.test(n)).length === 3 && z.names.some((n) => /\.pdf$/.test(n)) && z.names.includes("README.txt"), z.names);
    check("…an SVG page: its size in mm, each layer an Inkscape layer, the box a path, the title a <text>", /width="148\.\d+mm" height="209\.\d+mm"/.test(z.svg) && /inkscape:label="Box"/.test(z.svg) && /<path d="M/.test(z.svg) && />Hello pages<\/text>/.test(z.svg), z.svg.slice(0, 600));

    /* 7 the dialog saves .ai into the project's dtp folder */
    await ev(() => window.imageEditorInstance.E.ui.run("file.exportdtp")); await p.waitForTimeout(200);
    const dlg = await ev(() => ({ opts: [...document.querySelectorAll("#dtpFmt option")].map((o) => o.value), title: document.querySelector("#pcDtpDlg div").textContent }));
    check("File ▸ Export ▸ Document…: PDF / AI / SVG / for .cdr, for all 3 pages", dlg.opts.join() === "pdf,ai,svg,cdr" && /3 pages/.test(dlg.title), dlg);
    await ev(() => { document.getElementById("dtpCancel").click(); });
    const ai = await ev(() => window.imageEditorInstance.E.dtpOut.exportDoc("ai", { name: "Brochure", download: false }));
    const ls = await ev(() => fetch("/api/dtp/list").then((r) => r.json()));
    check("….ai: Brochure.ai (a PDF inside) saved in the project's dtp folder", ai && ai.name === "Brochure.ai" && ls.files.some((f) => f.name === "Brochure.ai"), { ai, ls });

    /* 8 .bgi keeps every page */
    const bg = await ev(async () => { const E = window.imageEditorInstance.E, r = await E.bgi.toBytes(); const files = await window.BgZip.unzipAsync(r.bytes); return { b: Array.from(r.bytes), names: [...files.keys()].filter((n) => /^pages\//.test(n)) }; });
    check("Save Project (.bgi): the other pages inside as pages/<id>.bgi", bg.names.length === 2, bg.names);
    await ev(async (arr) => { await window.imageEditorInstance.E.bgi.openBytes(new Uint8Array(arr), "Brochure.bgi"); }, bg.b);
    await p.waitForTimeout(600);
    st = await ev(() => { const E = window.imageEditorInstance.E; const L = E.pages.list(); return { n: L.length, names: L.map((x) => x.name), cur: E.pages.cur(), w: E.S.w, docs: E.docs && E.docs.list ? E.docs.list().length : 0 }; });
    check("…opened again: a new document with the 3 pages, the page that was in front in front (page 2, landscape)", st.n === 3 && st.names.join() === "Page 1,Page 2,Back cover" && st.cur === 1 && st.w === 595, st);
    await p.click('#pcPagesPanel [data-pgi="2"]'); await p.waitForTimeout(400);
    st = await ev(() => window.imageEditorInstance.E.S.layers.map((L) => L.name + ":" + L.type));
    check("…and its last page has its layers back (Box a shape, Title a text layer)", st.join() === "Background:pixel,Box:shape,Title:text", st);
    await shot("8-bgi");

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e && e.stack)); }
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
