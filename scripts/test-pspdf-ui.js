#!/usr/bin/env node
/* bitGen Studio — 2.424.0 in a REAL browser: PDF FILES IN THE IMAGE EDITOR - open (the pages strip, the page's text as
 * type layers over a picture without it), edit, move between pages (each keeps its layers + undo, also over another
 * picture), save (the changed page replaced with real text, the others untouched) - ext/imageeditdock/pcpdf.js.
 * Tim (verbatim): "add a pdf import/edit/save feature"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the PDF browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const OUT = "zz_pspdfui_" + process.pid;

(async () => {
  /* the test PDF (pdf-lib, as vendored): page 1 = a blue box + three lines (bold red sans, plain sans, italic serif),
   * page 2 = one line */
  const PL = require(path.join(ROOT, "static", "vendor", "pdf-lib.min.js"));
  const doc = await PL.PDFDocument.create();
  const hb = await doc.embedFont(PL.StandardFonts.HelveticaBold), hv = await doc.embedFont(PL.StandardFonts.Helvetica), ti = await doc.embedFont(PL.StandardFonts.TimesRomanItalic);
  const p1 = doc.addPage([612, 792]);
  p1.drawRectangle({ x: 300, y: 300, width: 200, height: 120, color: PL.rgb(0.1, 0.3, 0.9) });
  p1.drawText("Quarterly report", { x: 72, y: 700, size: 24, font: hb, color: PL.rgb(0.8, 0.1, 0.1) });
  p1.drawText("Second line here", { x: 72, y: 660, size: 14, font: hv, color: PL.rgb(0, 0, 0) });
  p1.drawText("An italic note", { x: 72, y: 620, size: 16, font: ti, color: PL.rgb(0.1, 0.1, 0.1) });
  const p2 = doc.addPage([612, 792]);
  p2.drawText("Page two stays", { x: 100, y: 500, size: 20, font: hv, color: PL.rgb(0, 0, 0) });
  const bytes = Buffer.from(await doc.save());

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.pdf, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);

    /* 1 the File menu */
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(150);
    const items = await ev(() => [...document.querySelectorAll(".kxmenu [data-cmd]")].map((x) => x.dataset.cmd));
    await p.keyboard.press("Escape"); await ev(() => document.querySelectorAll(".kxmenu").forEach((m) => m.remove()));
    check("File menu: Open PDF…, Open PDF from Project…, Save PDF, Save as New PDF…, PDF Pages", ["file.openpdf", "file.openpdfproj", "file.savepdf", "file.savepdfas", "file.pdfpages"].every((c) => items.includes(c)), items);

    /* 2 open it the way File ▸ Open PDF… does (its file input) */
    await p.setInputFiles("#pcPdfFile", { name: "report.pdf", mimeType: "application/pdf", buffer: bytes });
    await p.waitForFunction(() => { const P = window.imageEditorInstance.E.pdf.state(); return P && P.cur === 0 && window.imageEditorInstance.state.layers.length > 1; }, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    const o = await ev(() => {
      const E = window.imageEditorInstance.E, S = E.S, P = E.pdf.state();
      return { n: P.n, w: S.w, h: S.h, name: S.name, panel: !!document.querySelector("#pcPdfPanel") && document.querySelector("#pcPdfPanel").style.display !== "none", pages: document.querySelectorAll("#pcPdfPanel [data-pg]").length,
        how: P.pages.get(0).how, layers: S.layers.map((L) => ({ type: L.type, str: L.text && L.text.str, w: L.text && L.text.weight, it: L.text && L.text.italic, font: L.text && L.text.font, color: L.text && L.text.color, size: L.text && Math.round(L.text.size), x: L.text && Math.round(L.text.x) })) };
    });
    check("opened: 2 pages in the strip, page 1 at 150 dpi (1275 x 1650), named after the PDF", o.n === 2 && o.pages === 2 && o.panel && o.w === 1275 && o.h === 1650 && /report — page 1/.test(o.name), o);
    const T = o.layers.filter((L) => L.type === "text");
    check("...its three lines are TYPE LAYERS over a Background: the words, at x = 72 pt = 150 px", o.layers[0].type === "pixel" && T.map((L) => L.str).join("|") === "Quarterly report|Second line here|An italic note" && T.every((L) => Math.abs(L.x - 150) <= 2), o.layers);
    check("...font matched: bold sans 50 px red, plain sans 29 px, italic serif", T[0].w === 700 && !T[0].it && T[0].size === 50 && /^#c[89a-f]1[0-9a-f]1/.test(T[0].color) && T[1].w === 400 && T[1].size === 29
      && T[2].it && /Times/.test(T[2].font), T);
    const bg = await ev(() => {
      const S = window.imageEditorInstance.state, g = S.layers[0].canvas.getContext("2d");
      const dark = (x, y, w, h) => { const d = g.getImageData(x, y, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) n++; return n; };
      const blue = Array.from(g.getImageData(830, 850, 1, 1).data);
      return { text: dark(140, 140, 600, 200), blue };
    });
    check("...the Background has NO text (taken out of the page, how: textless) but keeps the blue box", o.how === "textless" && bg.text === 0 && bg.blue[2] > 200 && bg.blue[0] < 60, [o.how, bg]);
    const ink = await ev(() => {
      const S = window.imageEditorInstance.state, L = S.layers[1], d = L.canvas.getContext("2d").getImageData(0, 0, S.w, 400).data;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < 400; y++) for (let x = 0; x < S.w; x++) if (d[(y * S.w + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return { x0, y0, x1, y1 };
    });
    // the PDF's "Quarterly report": baseline 92 pt from the top = 191.7 px, cap height ~0.72 em = 36 px above it; ~ 205 pt wide
    const wPt = hb.widthOfTextAtSize("Quarterly report", 24) * 150 / 72;
    check("...where the PDF had it: the ink from x 150, caps reaching ~156 px, the baseline ~192 px, as wide as the PDF's line (tracking matched)",
      Math.abs(ink.x0 - 150) <= 6 && Math.abs(ink.y0 - 155.7) <= 7 && ink.y1 > 186 && ink.y1 < 205 && Math.abs((ink.x1 - ink.x0) - wPt) <= wPt * 0.04, [ink, wPt]);
    const th = await ev(() => { const c = document.querySelector('#pcPdfPanel [data-pg="1"] canvas'); return c ? [c.width, c.height] : null; });
    check("...the strip shows each page's picture", th && th[0] === 130 && th[1] > 150, th);

    /* 3 edit: the title's words, a new line in Cyrillic (the standard fonts cannot write it -> into the picture) */
    await ev(() => {
      const E = window.imageEditorInstance.E, S = E.S, L = S.layers[1];
      E.setLayer(L, "text", (x) => { x.text.str = "Annual report 2026"; });
      const N = E.makeLayer("ru", S.w, S.h, "text"); N.text = Object.assign({}, E.D.TEXT_DEFAULT, { str: "Привет", size: 40, x: 150, y: 900 }); E.D.rasterize(N); E.addLayer(N, "text");
    });
    const e1 = await ev(() => { const E = window.imageEditorInstance.E; return { ed: E.pdf.isEdited(0), undo: E.S.undo.length, mark: !!document.querySelector('#pcPdfPanel [data-pg="0"] i') }; });
    await ev(() => window.imageEditorInstance.E.pdf.openPage(1));
    await p.waitForFunction(() => window.imageEditorInstance.E.pdf.state().cur === 1, null, { timeout: 20000 });
    await p.waitForTimeout(300);
    const pg2 = await ev(() => { const S = window.imageEditorInstance.state; return { strs: S.layers.filter((L) => L.type === "text").map((L) => L.text.str), name: S.name, mark: !!document.querySelector('#pcPdfPanel [data-pg="0"] i') }; });
    check("page 2 opens with its own line; page 1 is marked ✎ changed", e1.ed && e1.undo === 2 && pg2.strs.join() === "Page two stays" && /page 2/.test(pg2.name) && pg2.mark, [e1, pg2]);

    /* 4 another picture over it, then back: page 1 as left (its layers + undo) */
    await ev(() => window.imageEditorInstance.E.pdf.openPage(0));
    await p.waitForTimeout(300);
    await ev(() => window.imageEditorInstance.E.openDoc(300, 200, "another.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 300, 200); }));   // as File ▸ New / Open do
    await p.waitForTimeout(300);
    // 2.430.0: the picture is a document of its own (pcdocs.js) - the PDF keeps its own window / tab, its session with it
    const other = await ev(() => { const E = window.imageEditorInstance.E; return { w: E.S.w, pdf: E.pdf.state(), on: E.pdf.onPage(), docs: E.docs.list().length }; });
    await ev(() => { const E = window.imageEditorInstance.E, d = E.docs.list().find((x) => /page/.test(x.name)); E.docs.activate(d.id); });
    await p.waitForTimeout(400);
    const back = await ev(() => { const E = window.imageEditorInstance.E, S = E.S; return { w: S.w, undo: S.undo.length, cur: E.pdf.state() && E.pdf.state().cur, strs: S.layers.filter((L) => L.type === "text").map((L) => L.text.str) }; });
    check("a picture opened over page 1 is a document of its own (the PDF is not open in it); the PDF's tab brings page 1 back - its edited layers, its 2 undo steps, its pages", other.w === 300 && other.pdf === null && !other.on && other.docs === 2
      && back.w === 1275 && back.undo === 2 && back.cur === 0 && back.strs.join("|") === "Annual report 2026|Second line here|An italic note|Привет", [other, back]);
    await p.keyboard.press("Escape");
    await ev(() => window.imageEditorInstance.E.undo());
    const un = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => window.imageEditorInstance.E.redo());
    const re = await ev(() => window.imageEditorInstance.E.S.layers.length);
    check("...its undo still works there (the new line off, back on)", un === 4 && re === 5, [un, re]);

    /* 5 save as a new file */
    const sv = await ev((n) => window.imageEditorInstance.E.pdf.save(n, false), OUT);
    check("Save: the 1 changed page replaced - 3 lines as real text, the Cyrillic one drawn into its picture", sv && sv.name === OUT + ".pdf" && sv.pages === 1 && sv.real === 3 && sv.raster === 1, sv);
    const list = await (await fetch(URL_ + "api/pdf/list")).json();
    check("...kept in the project (GET /api/pdf/list)", (list.files || []).some((f) => f.name === OUT + ".pdf" && f.size === sv.size), list);
    const rd = await ev(async (n) => {
      const L = window.pdfjsLib, buf = await (await fetch("/api/pdf/file/" + encodeURIComponent(n))).arrayBuffer();
      const pdf = await L.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise, out = { n: pdf.numPages, pages: [] };
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i), tc = await pg.getTextContent(), ops = await pg.getOperatorList();
        out.pages.push({ items: tc.items.filter((t) => t.str.trim()).map((t) => ({ s: t.str, x: Math.round(t.transform[4] * 10) / 10, y: Math.round(t.transform[5] * 10) / 10, sz: Math.round(Math.hypot(t.transform[2], t.transform[3]) * 10) / 10 })),
          img: ops.fnArray.filter((f) => f === L.OPS.paintImageXObject).length });
      }
      return out;
    }, OUT + ".pdf");
    const a1 = rd.pages[0] && rd.pages[0].items, t1 = a1 && a1.find((t) => t.s === "Annual report 2026");
    check("...read back: 2 pages; page 1's text is REAL (selectable) - the new words, not the old", rd.n === 2 && t1 && a1.some((t) => t.s === "Second line here") && a1.some((t) => t.s === "An italic note") && !a1.some((t) => /Quarterly|Привет/.test(t.s)), rd);
    check("...at the same place and size (x 72, baseline 700, 24 pt) over its picture (an image)", t1 && Math.abs(t1.x - 72) <= 1.5 && Math.abs(t1.y - 700) <= 2 && Math.abs(t1.sz - 24) <= 0.6 && rd.pages[0].img === 1, [t1, rd.pages[0].img]);
    const a2 = rd.pages[1] && rd.pages[1].items;
    check("...page 2 untouched: still vector (no picture), its text where it was", a2 && a2.length === 1 && a2[0].s === "Page two stays" && a2[0].x === 100 && a2[0].y === 500 && rd.pages[1].img === 0, rd.pages[1]);

    /* 6 from the project */
    await ev((n) => window.imageEditorInstance.E.pdf.openFromProject(n), OUT + ".pdf");
    await p.waitForFunction((n) => { const P = window.imageEditorInstance.E.pdf.state(); return P && P.name === n && P.cur === 0; }, OUT + ".pdf", { timeout: 30000 });
    await p.waitForTimeout(500);
    const re2 = await ev(() => { const S = window.imageEditorInstance.state; return { strs: S.layers.filter((L) => L.type === "text").map((L) => L.text.str), fromProject: window.imageEditorInstance.E.pdf.state().fromProject }; });
    check("Open PDF from Project: the saved one opens again - its real text as type layers again", re2.fromProject && re2.strs.includes("Annual report 2026") && re2.strs.includes("Second line here"), re2);

    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the run stopped: " + (e && e.stack || e));
  } finally {
    await b.close();
    try { for (const d of fs.readdirSync(path.join(ROOT, "projects"))) { const f = path.join(ROOT, "projects", d, "pdf", OUT + ".pdf"); if (fs.existsSync(f)) { fs.unlinkSync(f); try { fs.rmdirSync(path.dirname(f)); } catch { /* others there */ } } } } catch { /* no projects */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
