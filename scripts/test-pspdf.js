#!/usr/bin/env node
/* bitGen Studio — 2.424.0 units: PDF FILES IN THE IMAGE EDITOR (open, edit, save)
 *   1. pcpdf.js pure: fontOf (a PDF font name -> ours + the standard font to write it back in), groupLines (pdf.js text
 *      pieces -> lines), inkColor (the text's colour from the picture), toPdf (page px -> PDF points), winAnsi, stdName
 *   2. lib/pdfStore.js: safe names, refusing what is not a PDF, save (the same name replaced), list, file
 *   3. the vendored libraries: pdf.js + its worker (Apache-2.0), pdf-lib (MIT) - their licences beside them; pdf-lib
 *      writes a PDF with real text here in Node (the way the editor's Save PDF does)
 *   4. the wiring: routes/pdf.js mounted from routes/index.js (not server.js), ext.json, the install, openDoc's
 *      beforeOpen hook, the File menu commands
 * Tim: "add a pdf import/edit/save feature" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };
if (!process.env.H3_E2E) process.env.H3_E2E = "1";
const X = require(path.join(ROOT, "ext", "imageeditdock", "pcpdf.js"));

(async () => {
  /* ---- 1 */
  const a = X.fontOf("ABCDEF+Calibri-Bold", ""), b = X.fontOf("TimesNewRomanPS-ItalicMT", ""), c = X.fontOf("Courier", "monospace"), d = X.fontOf("", "Georgia serif");
  check("fontOf: the subset prefix dropped; bold / italic read; sans -> Helvetica, serif -> Times, mono -> Courier",
    a.fam === "sans" && a.weight === 700 && !a.italic && a.std === "Helvetica" && b.fam === "serif" && b.italic && b.weight === 400 && b.std === "Times" && b.font === "Times New Roman"
    && c.fam === "mono" && c.std === "Courier" && c.font === "Courier New" && d.font === "Georgia" && X.fontOf("Arial-Black").weight === 700 && X.fontOf("DejaVuSans", "sans-serif").fam === "sans", [a, b, c, d]);
  const its = [
    { str: "Hello", x: 10, y: 100, size: 20, w: 50, font: "f1", angle: 0 },
    { str: "world", x: 66, y: 100.4, size: 20, w: 52, font: "f1", angle: 0 },      // a gap > 0.18 em: a space
    { str: "!", x: 118, y: 100, size: 20, w: 6, font: "f1", angle: 0 },            // touching: no space
    { str: "Second line", x: 10, y: 130, size: 20, w: 110, font: "f1", angle: 0 },
    { str: "far", x: 400, y: 100, size: 20, w: 30, font: "f1", angle: 0 },          // too far: its own line
    { str: "Big", x: 10, y: 60, size: 36, w: 60, font: "f2", angle: 0 },
    { str: "   ", x: 10, y: 200, size: 10, w: 10, font: "f1", angle: 0 },          // only spaces: dropped
    { str: "", x: 10, y: 210, size: 10, w: 0, font: "f1", angle: 0 },
  ];
  const L = X.groupLines(its);
  check("groupLines: the pieces on one baseline joined (a space at a gap, none when touching), top to bottom, a far piece / another font kept apart, blanks dropped",
    L.map((l) => l.str).join("|") === "Big|Hello world!|far|Second line" && L[1].w === 114 && L[1].parts.length === 3, L.map((l) => [l.str, l.x, l.w]));
  check("...an empty / missing list is no lines", X.groupLines([]).length === 0 && X.groupLines(null).length === 0);
  const W = 40, H = 20, px = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { px[i * 4] = 250; px[i * 4 + 1] = 245; px[i * 4 + 2] = 230; px[i * 4 + 3] = 255; }
  for (let y = 6; y < 14; y++) for (let x = 8; x < 30; x += 2) { const i = (y * W + x) * 4; px[i] = 200; px[i + 1] = 10; px[i + 2] = 20; }
  check("inkColor: the text's colour (farthest from its paper), not the paper's", X.inkColor(px, W, H, { x: 2, y: 2, w: 34, h: 16 }) === "#c80a14", X.inkColor(px, W, H, { x: 2, y: 2, w: 34, h: 16 }));
  const blank = new Uint8ClampedArray(W * H * 4).fill(255);
  check("...a box with no ink (or none at all) is black", X.inkColor(blank, W, H, { x: 2, y: 2, w: 30, h: 10 }) === "#000000" && X.inkColor(blank, W, H, { x: 50, y: 50, w: 4, h: 4 }) === "#000000");
  const p = X.toPdf({ x: 150, y: 100, size: 30 }, 150 / 72, 792, 0.8);
  check("toPdf: page px (150 dpi) -> points from the bottom, the baseline a = 0.8 em below the top", Math.abs(p.x - 72) < 1e-9 && Math.abs(p.y - (792 - 124 / (150 / 72))) < 1e-9 && Math.abs(p.size - 14.4) < 1e-9, p);
  check("winAnsi: Latin text (é, €, “quotes”, –) yes; other alphabets / emoji no",
    X.winAnsi("Café – €5 “ok”") && X.winAnsi("two\nlines") && !X.winAnsi("Привет") && !X.winAnsi("日本") && !X.winAnsi("hi 🙂"));
  check("stdName: the 12 standard text fonts by family, weight and style",
    X.stdName({ std: "Helvetica", weight: 400 }) === "Helvetica" && X.stdName({ std: "Helvetica", weight: 700, italic: true }) === "HelveticaBoldOblique"
    && X.stdName({ std: "Times", weight: 700 }) === "TimesRomanBold" && X.stdName({ std: "Times", weight: 400, italic: true }) === "TimesRomanItalic"
    && X.stdName({ std: "Courier", weight: 700, italic: true }) === "CourierBoldOblique" && X.stdName({ std: "Courier", weight: 300 }) === "Courier");

  /* ---- 2 + 3 */
  const core = require(path.join(ROOT, "lib", "core"));
  const st = require(path.join(ROOT, "lib", "pdfStore"));
  const PN = "zz_pspdf424_" + process.pid, orig = core.getProject();
  core.ensureProject(PN); core.setProject(PN);
  const pd = core.projDir(PN);
  try {
    check("safeName: stays in the folder, ends in .pdf, odd characters out", st.safeName("../../etc/passwd") === "passwd.pdf" && st.safeName("My Report (v2).PDF") === "My Report (v2).pdf"
      && st.safeName("") === "document.pdf" && st.safeName("a/b<c>.pdf") === "b_c_.pdf" && st.safeName(".hidden") === "hidden.pdf", [st.safeName("a/b<c>.pdf"), st.safeName(".hidden")]);
    check("save refuses an empty buffer / something that is not a PDF", throws(() => st.save("x", Buffer.alloc(0)), /empty/) && throws(() => st.save("x", Buffer.from("hello world, not a pdf")), /not a PDF/));
    const PL = require(path.join(ROOT, "static", "vendor", "pdf-lib.min.js"));
    const doc = await PL.PDFDocument.create();
    const f = await doc.embedFont(PL.StandardFonts.HelveticaBold), pg = doc.addPage([612, 792]);
    pg.pushOperators(PL.setCharacterSpacing(1.5));
    pg.drawText("Quarterly report", { x: 72, y: 700, size: 24, font: f, color: PL.rgb(0.8, 0.1, 0.1) });
    pg.pushOperators(PL.setCharacterSpacing(0));
    doc.addPage([612, 792]);
    const bytes = Buffer.from(await doc.save());
    check("pdf-lib (vendored) writes a 2-page PDF with real text in a standard font + character spacing (as Save PDF does)",
      bytes.toString("latin1", 0, 5) === "%PDF-" && bytes.length > 500 && (await PL.PDFDocument.load(bytes)).getPageCount() === 2, bytes.length);
    const r1 = st.save("report.pdf", bytes);
    check("save -> {name, size} in projects/<p>/pdf; list finds it", r1.name === "report.pdf" && r1.size === bytes.length && fs.existsSync(path.join(pd, "pdf", "report.pdf"))
      && st.list().some((x) => x.name === "report.pdf" && x.size === bytes.length), [r1, st.list()]);
    const doc2 = await PL.PDFDocument.load(bytes); doc2.removePage(1); const b2 = Buffer.from(await doc2.save());
    const r2 = st.save("report", b2);
    check("...the same name again REPLACES it (Save into the original); no .part left", r2.name === "report.pdf" && fs.statSync(path.join(pd, "pdf", "report.pdf")).size === b2.length
      && !fs.readdirSync(path.join(pd, "pdf")).some((x) => /\.part$/.test(x)) && st.list().length === 1);
    check("file: the path of a saved one; refused for a missing one / not a .pdf / a path outside", st.file("report.pdf") === path.join(pd, "pdf", "report.pdf")
      && throws(() => st.file("nope.pdf"), /not in this project/) && throws(() => st.file("x.txt"), /not a PDF/) && st.file("../../report.pdf") === path.join(pd, "pdf", "report.pdf"));
  } finally {
    core.setProject(orig);
    fs.rmSync(pd, { recursive: true, force: true });
  }
  const V = (n) => fs.existsSync(path.join(ROOT, "static", "vendor", n)) ? fs.statSync(path.join(ROOT, "static", "vendor", n)).size : 0;
  check("vendored: pdf.min.js + pdf.worker.min.js (pdf.js 3.11, Apache-2.0) and pdf-lib.min.js (MIT), each licence beside it",
    V("pdf.min.js") > 200000 && V("pdf.worker.min.js") > 500000 && V("pdf-lib.min.js") > 300000 && /Apache License/.test(read("static", "vendor", "LICENSE-pdfjs.txt")) && /MIT License/.test(read("static", "vendor", "LICENSE-pdf-lib.txt"))
    && /pdfjs-dist@3\.11|3\.11\.174/.test(read("static", "vendor", "pdf.min.js").slice(0, 3000) + read("static", "vendor", "pdf.min.js").match(/version\s*[=:]\s*"[\d.]+"|"3\.11\.\d+"/)));

  /* ---- 4 */
  const idx = read("routes", "index.js"), srv = read("misc/server.js"), rt = read("routes", "pdf.js");
  check("routes/pdf.js mounted from routes/index.js (server.js untouched): save (raw bytes), list, file", /require\("\.\/pdf"\)\.mount\(app\)/.test(idx) && !/pdf/i.test(srv.match(/require\([^)]*pdf[^)]*\)/g) || "")
    && /app\.post\("\/api\/pdf\/save", express\.raw/.test(rt) && /app\.get\("\/api\/pdf\/list"/.test(rt) && /app\.get\("\/api\/pdf\/file\/:name"/.test(rt));
  const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, ie = read("ext", "imageeditdock", "imageedit.js"), src = read("ext", "imageeditdock", "pcpdf.js");
  check("ext.json loads pcpdf.js before imageedit.js; imageedit installs it and asks E.beforeOpen first thing in openDoc (right after 2.430.0's docBefore)",
    EXT.indexOf("pcpdf.js") > 0 && EXT.indexOf("pcpdf.js") < EXT.indexOf("imageedit.js") && /win\.PCPdf\.install\(E\)/.test(ie) && /function openDoc\(w, h, name, paint, opts\) \{\n\s+const inPlace = !!\(opts && opts\.inPlace\);\n\s+if \(E\.docBefore\) E\.docBefore\(inPlace, name\);\n\s+if \(E\.beforeOpen\) E\.beforeOpen\(name\);/.test(ie));   // 2.430.0: the documents (pcdocs.js) park the one in front first
  check("pcpdf: File ▸ Open PDF…, Open PDF from Project…, Save PDF, Save as New PDF…, PDF Pages; libraries only from /static/vendor (never the internet)",
    ["file.openpdf\", \"Open PDF…", "file.openpdfproj\", \"Open PDF from Project…", "file.savepdf\", \"Save PDF", "file.savepdfas\", \"Save as New PDF…", "file.pdfpages\", \"PDF Pages"].every((k) => src.includes(k))
    && /"\/static\/vendor\/pdf\.min\.js"/.test(src) && /"\/static\/vendor\/pdf\.worker\.min\.js"/.test(src) && /"\/static\/vendor\/pdf-lib\.min\.js"/.test(src) && !/https?:\/\//.test(src.replace(/\/\*[\s\S]*?\*\//g, "")));
  check("...the text-free picture: the page drawn again with fillText / strokeText switched off (fallback: the boxes filled with the paper)",
    /cg\.fillText = function \(\) \{ calls\+\+; \}/.test(src) && /how: "filled \("/.test(src));
  check("...a page opened over keeps its layers + undo (beforeOpen stashes it; onPage = the open document is that page)",
    /E\.beforeOpen = \(name\) =>/.test(src) && /const onPage = \(\) =>/.test(src) && /pg\.doc = E\.snapDoc\(\); pg\.undo = S\.undo/.test(src));
  check("...saving: only changed pages replaced (removePage + insertPage at their size), type the standard fonts can write as real text with its spacing, the rest drawn into the picture",
    /if \(!isEdited\(i\)\) \{\s*if \(!moved\) continue;/.test(src) && /out\.removePage\(i\);/.test(src) && /out\.insertPage\(i, \[pg\.ptW, pg\.ptH\]\)/.test(src) && /PL\.setCharacterSpacing/.test(src) && /winAnsi\(L\.text\.str\)/.test(src));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
