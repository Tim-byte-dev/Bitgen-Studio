#!/usr/bin/env node
/* bitGen Studio — 2.814.0: document text as a Word file (.docx) and back - the page's model (ext/imageeditdock/pcdocx.js,
 * jsdom), the server's writer / reader (lib/docxFiles.js: `docx` + `mammoth`), the round trip, the store, the pins.
 * Tim (verbatim): "is there a way to add word editing to image editor? like ms word and export as docx? with all the
 * alignment, text editing/formatting / table options?" then "lets do next" (the WORD PLAN's step 3). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { JSDOM } = require("jsdom");
const ROOT = path.join(__dirname, "..");
const X = require("../ext/imageeditdock/pcdocx.js");
const T = require("../ext/imageeditdock/pcdoctext.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const doc = new JSDOM("<!doctype html><body></body>").window.document;

(async () => {
  /* ---- the page's model */
  const html = T.sanitize(`<p data-style="title">The Title</p>
    <p style="text-align: justify; line-height: 1.5; margin-top: 12pt; margin-bottom: 6pt">Plain <b>bold</b> <i>it</i> <u>under</u> <s>gone</s> H<sub>2</sub>O x<sup>2</sup>
    <span style="font-family: 'Times New Roman', serif; font-size: 14pt; color: rgb(255, 0, 0)">red</span> <span style="background-color: rgb(255, 255, 0)">lit</span> <a href="https://example.com">a link</a><br>second line</p>
    <h2 style="text-align: center">Heading</h2>
    <ul><li>one<ul><li>one.one</li></ul></li><li>two</li></ul><ol><li>first</li></ol>
    <table style="table-layout: fixed"><colgroup><col style="width: 25%"><col style="width: 75%"></colgroup><thead><tr><th>A</th><th>B</th></tr></thead>
      <tbody><tr><td colspan="2" style="background-color: rgb(221, 238, 255); vertical-align: middle">span</td></tr><tr><td rowspan="1"><p>in cell</p></td><td>x</td></tr></tbody></table><hr>`, doc);
  const B = X.toModel(html, doc);
  const P = B.filter((b) => b.t === "p");
  check("a Title paragraph keeps its style", P[0].style === "title" && P[0].runs[0].text === "The Title", P[0]);
  const p1 = P[1], r = (t) => p1.runs.find((x) => x.text && x.text.includes(t));
  check("alignment, line spacing, space before / after", p1.align === "justify" && p1.lineHeight === 1.5 && p1.before === 12 && p1.after === 6, p1);
  check("bold / italic / underline / strikethrough / sub / superscript runs", r("bold").b && r("it").i && r("under").u && r("gone").s && r("2").sub && p1.runs.some((x) => x.sup), p1.runs);
  check("font, size (pt) and colour from a span", r("red").font === "Times New Roman" && r("red").size === 14 && /255, 0, 0/.test(r("red").color), r("red"));
  check("highlight from a background colour, a link (underlined, blue)", /255, 255, 0/.test(r("lit").hi) && r("a link").link === "https://example.com" && r("a link").u, p1.runs);
  check("a line break inside a paragraph = a break run", p1.runs.some((x) => x.br && !x.text) && !!r("second line"), p1.runs);
  check("Heading 2, centred", P[2].style === "h2" && P[2].align === "center", P[2]);
  const li = P.filter((p) => p.list);
  check("lists: bullets, a nested level, numbering", li.length === 4 && li[0].list.kind === "ul" && li[0].list.level === 0 && li[1].list.level === 1 && li[1].runs[0].text === "one.one" && li[3].list.kind === "ol", li);
  check("a list item's words do not take its nested list's words", li[0].runs.map((x) => x.text).join("") === "one", li[0].runs);
  const tb = B.find((b) => b.t === "table");
  check("table: widths %, one header row, rows", tb && JSON.stringify(tb.widths) === "[25,75]" && tb.headerRows === 1 && tb.rows.length === 3, tb);
  check("table: a merged cell (colspan), shading, vertical alignment", tb.rows[1][0].cs === 2 && /221, 238, 255/.test(tb.rows[1][0].shade) && tb.rows[1][0].valign === "middle", tb.rows[1]);
  check("table: a cell's paragraph and loose words both come out as paragraphs", tb.rows[2][0].blocks[0].runs[0].text === "in cell" && tb.rows[2][1].blocks[0].runs[0].text === "x", tb.rows[2]);
  check("a horizontal line", B[B.length - 1].t === "hr");
  check("header cells bold on light grey as the page draws them", tb.rows[0][0].blocks[0].runs[0].b === true && tb.rows[0][0].shade === "#f2f2f2" && !tb.rows[2][1].blocks[0].runs[0].b, tb.rows[0][0]);
  // borders as pcdoctable sets them
  const bt = (how) => { const d = doc.createElement("div"); d.innerHTML = "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>"; const t = d.firstChild;
    for (const c of t.querySelectorAll("td")) { if (how === "all") c.style.border = "1px solid #336699"; else c.style.borderStyle = "none"; }
    if (how === "outside") t.style.border = "1px solid #336699"; else if (how === "none") t.style.borderStyle = "none"; return X.toModel(d.innerHTML, doc)[0]; };
  check("borders all / outside / none read back", bt("all").borders === "all" && bt("outside").borders === "outside" && bt("none").borders === "none" && /336699|51, 102, 153/.test(bt("all").borderColor || ""), [bt("all"), bt("outside"), bt("none")]);
  check("plain table (no border set) = all borders", X.toModel("<table><tbody><tr><td>a</td></tr></tbody></table>", doc)[0].borders === "all");
  /* ---- the page, header, footer */
  const pg = X.pageOf(1240, 1754, 150, { x: 148, y: 118, w: 944, h: 1518 });
  check("page in mm + margins from the first frame (A4 at 150 dpi)", Math.abs(pg.wmm - 210) < 0.2 && Math.abs(pg.hmm - 297) < 0.2 && !pg.landscape && Math.abs(pg.margins.left - 25.1) < 0.2 && Math.abs(pg.margins.top - 20) < 0.2 && Math.abs(pg.margins.right - 25.1) < 0.3 && Math.abs(pg.margins.bottom - 20) < 0.3, pg);
  check("landscape when wider", X.pageOf(1754, 1240, 150).landscape === true);
  const hf = X.headFoot([{ type: "text", text: { str: "Annual Report", y: 60, size: 25, align: "left", font: "Arial", color: "#333333" } },
    { type: "text", text: { str: "Page 1 of 3", tpl: "Page {page} of {pages}", y: 1700, size: 25, align: "center" } },
    { type: "text", text: { str: "middle", y: 800 } }, { type: "pixel" }], 1240, 1754, 150, "Doc");
  check("master type at the top = header, at the bottom = footer, the middle left out", hf.header.length === 1 && hf.footer.length === 1 && hf.header[0].runs[0].text === "Annual Report" && hf.header[0].align === "left", hf);
  check("{page} / {pages} = Word's page fields (the token text, not the number shown)", JSON.stringify(hf.footer[0].runs.map((x) => x.field || x.text)) === JSON.stringify(["Page ", "page", " of ", "pages"]) && hf.footer[0].align === "center", hf.footer);
  check("type size px -> pt at the page's dpi (25 px at 150 dpi = 12 pt)", hf.header[0].runs[0].size === 12, hf.header[0].runs[0]);

  /* ---- the server: build + read back (the real libraries) */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "docx814-"));
  const core = require("../lib/core");
  const D = require("../lib/docxFiles");
  const model = { title: "T", page: pg, blocks: B, header: hf.header, footer: hf.footer };
  let buf;
  try { buf = await D.build(model); } catch (e) { buf = null; check("build threw: " + e.message, false); }
  check("build: a .docx (a zip) comes out", !!buf && buf[0] === 0x50 && buf[1] === 0x4b && buf.length > 4000, buf && buf.length);
  if (buf) {
    const JSZip = (() => { try { return require("jszip"); } catch { return null; } })();
    if (JSZip) {
      const z = await JSZip.loadAsync(buf), xml = await z.file("word/document.xml").async("string");
      const ftr = Object.keys(z.files).filter((f) => /^word\/footer\d*\.xml$/.test(f)); const fx = ftr.length ? await z.file(ftr[0]).async("string") : "";
      check("the page size + margins in twips (A4 = 11906 x 16838; left 25.1 mm)", /<w:pgSz[^>]*w:w="1190\d"[^>]*w:h="1683\d"/.test(xml) && /w:left="142\d"/.test(xml), (xml.match(/<w:pgSz[^>]*>|<w:pgMar[^>]*>/g) || []).join(" "));
      check("styles: Title, Heading2; justified; spacing before 240 / after 120; line 360", /w:pStyle w:val="Title"/.test(xml) && /w:pStyle w:val="Heading2"/.test(xml) && /w:jc w:val="both"/.test(xml) && /w:before="240"/.test(xml) && /w:after="120"/.test(xml) && /w:line="360"/.test(xml));
      check("runs: bold, italic, underline, strike, sub / super, font, 14 pt (28 half-points), red, yellow highlight, a hyperlink", /<w:b\/>/.test(xml) && /<w:i\/>/.test(xml) && /<w:u w:val="single"\/>/.test(xml) && /<w:strike\/>/.test(xml) && /w:vertAlign w:val="subscript"/.test(xml) && /w:vertAlign w:val="superscript"/.test(xml) && /w:ascii="Times New Roman"/.test(xml) && /<w:sz w:val="28"\/>/.test(xml) && /w:color w:val="FF0000"/.test(xml) && /w:highlight w:val="yellow"/.test(xml) && /<w:hyperlink/.test(xml));
      check("lists numbered through numbering.xml (bullets + decimal, nested level 1)", /<w:numPr><w:ilvl w:val="1"\/>/.test(xml) && /decimal/.test(await z.file("word/numbering.xml").async("string")));
      check("table: grid 25 / 75, one repeated header row, a gridSpan 2, shading DDEEFF, vAlign center", /<w:gridCol w:w="\d+"\/><w:gridCol/.test(xml) && (xml.match(/<w:tblHeader\/>/g) || []).length === 1 && /<w:gridSpan w:val="2"\/>/.test(xml) && /w:fill="DDEEFF"/.test(xml) && /w:vAlign w:val="center"/.test(xml));
      check("footer with PAGE and NUMPAGES fields; a header", /PAGE/.test(fx) && /NUMPAGES/.test(fx) && Object.keys(z.files).some((f) => /^word\/header\d*\.xml$/.test(f)), fx.slice(0, 300));
    } else check("jszip (a dependency of docx / mammoth) can be loaded", false);
    const back = await D.read(buf);
    check("read back (mammoth): title + heading + list + table + link", /<p data-style="title">The Title<\/p>/.test(back.html) && /<h2>Heading<\/h2>/.test(back.html) && /<ul><li>one<ul><li>one\.one<\/li><\/ul><\/li>/.test(back.html) && /<table>/.test(back.html) && /<a href="https:\/\/example\.com">/.test(back.html), back.html.slice(0, 900));
    check("read back: bold / italic / underline / strikethrough / sub / super kept", /<strong>bold<\/strong>/.test(back.html) && /<em>it<\/em>/.test(back.html) && /<u>under<\/u>/.test(back.html) && /<s>gone<\/s>/.test(back.html) && /<sub>2<\/sub>/.test(back.html) && /<sup>2<\/sup>/.test(back.html), back.html.slice(0, 900));
    const again = X.toModel(T.sanitize(back.html, doc), doc);
    check("round trip: the page's cleaner + model take mammoth's HTML (title, list levels, table header)", again[0].style === "title" && again.filter((b) => b.list && b.list.level === 1).length === 1 && again.find((b) => b.t === "table").headerRows === 1, again.slice(0, 3));
  }
  check("read refuses what is not a .docx", await D.read(Buffer.from("hello")).then(() => false, (e) => /not a \.docx/.test(e.message)));
  check("names made safe; .docx added once", D.safeName("../../a b?.docx") === "a b_.docx" && D.safeName("") === "document.docx");
  check("hex: #abc / rgb() / a bad value", D.hex("#abc") === "AABBCC" && D.hex("rgb(255, 0, 16)") === "FF0010" && D.hex("red") === null);

  /* ---- pins */
  const IE = src("ext/imageeditdock/imageedit.js"), EX = JSON.parse(src("ext/imageeditdock/ext.json")), RI = src("routes/index.js"), PX = src("ext/imageeditdock/pcdocx.js"), PK = JSON.parse(src("package.json"));
  check("pcdocx.js after pcpageview.js, installed after PCPageView", EX.scripts.indexOf("pcdocx.js") === EX.scripts.indexOf("pcpageview.js") + 1 && IE.indexOf("PCDocx.install(E)") > IE.indexOf("PCPageView.install(E)"));
  check("routes/docx.js mounted from routes/index.js (not server.js)", /require\("\.\/docx"\)\.mount\(app\)/.test(RI) && !/docx/.test(src("misc/server.js")));
  check("File ▸ Open Word Document + File ▸ Export ▸ Word Document commands", /"file\.opendocx", "📂 Open Word Document \(\.docx\)…"/.test(PX) && /"file\.exportdocx", "Word Document \(\.docx\)…"/.test(PX));
  check("docx (MIT) + mammoth (BSD-2-Clause) are dependencies, credited", PK.dependencies.docx && PK.dependencies.mammoth && /"docx"/.test(src("lib/credits.json")) && /mammoth/.test(src("lib/credits.json")) && /mammoth/i.test(src("misc/NOTICE.md")));
  fs.rmSync(tmp, { recursive: true, force: true });
  void core;
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
