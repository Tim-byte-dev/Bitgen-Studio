// bitGen Studio — lib/docxFiles.js (2.814.0): document text to and from .docx, kept in the project.
//
// Tim (verbatim): "lets do next" - the WORD PLAN's step 3 (HANDOVER "## 2.811.0"): save the image editor's document text
// (pcdoctext.js / pcdoctable.js) as a .docx and open a .docx as document text.
//   build(model)     -> Buffer of a .docx: model = {page: {wmm, hmm, landscape, margins {top, right, bottom, left} mm},
//                       blocks: [paragraph | table | hr], header: [paragraph], footer: [paragraph]} (the page turns its
//                       cleaned HTML into this - ext/imageeditdock/pcdocx.js toModel). Paragraph = {t: "p", style
//                       (normal | title | subtitle | h1-h3 | quote | code), align, lineHeight, before, after (pt), indent
//                       (pt), list {kind ul|ol, level}, runs [{text, b, i, u, s, sub, sup, font, size (pt), color, hi,
//                       link, br, field page|pages}]}; table = {t: "table", widths [%], headerRows, borders all|outside|
//                       none, borderColor, rows [[{cs, rs, shade, valign, blocks}]]} - merged cells by cs / rs.
//                       Written with `docx` (MIT, github.com/dolanmiu/docx).
//   read(buf)        -> {html, messages}: a .docx as HTML with `mammoth` (BSD-2-Clause, github.com/mwilliamson/mammoth.js):
//                       Title / Subtitle styles -> p[data-style], headings, lists, tables, bold / italic / underline /
//                       strikethrough. Pictures are left out (the page's document text has none yet).
//   save(name, buf), list(), file(name)   projects/<p>/docs/<name>.docx
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 200 * 1024 * 1024;
const MM = 56.6929;                 // twips per mm
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("docs"); fs.mkdirSync(d, { recursive: true }); return d; }
function safeName(n) {
  let b = path.basename(String(n || "")).replace(/\.docx$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 100);
  return (b || "document") + ".docx";
}
const isZip = (buf) => Buffer.isBuffer(buf) && buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
function save(name, buf) {
  if (!isZip(buf)) throw bad("that is not a .docx file");
  if (buf.length > MAX) throw bad("the file is over 200 MB");
  const n = safeName(name), p = path.join(dir(), n);
  fs.writeFileSync(p + ".part", buf); fs.renameSync(p + ".part", p);
  return { name: n, size: buf.length };
}
function list() {
  try {
    return fs.readdirSync(dir()).filter((f) => /\.docx$/i.test(f)).map((f) => { const st = fs.statSync(path.join(dir(), f)); return { name: f, size: st.size, mtime: Math.round(st.mtimeMs) }; })
      .sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}
function file(name) {
  const n = path.basename(String(name || ""));
  if (!/\.docx$/i.test(n)) throw bad("not a .docx name", 404);
  const p = path.join(dir(), n);
  if (!fs.existsSync(p)) throw bad(`${n} is not in this project's docs folder`, 404);
  return p;
}

/* ---------------- model -> .docx ---------------- */
const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()) || /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(String(c || "").trim()); if (!m) { const r = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(c || "")); return r ? [r[1], r[2], r[3]].map((v) => (+v).toString(16).padStart(2, "0")).join("").toUpperCase() : null; } return (m.length === 2 ? m[1] : m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase(); };
const HILITE = { "FFFF00": "yellow", "00FF00": "green", "00FFFF": "cyan", "FF00FF": "magenta", "0000FF": "blue", "FF0000": "red", "000080": "darkBlue", "008080": "darkCyan", "008000": "darkGreen", "800080": "darkMagenta", "800000": "darkRed", "808000": "darkYellow", "808080": "darkGray", "C0C0C0": "lightGray", "000000": "black" };
const HEADINGS = { h1: "Heading1", h2: "Heading2", h3: "Heading3", title: "Title", subtitle: "Subtitle", quote: "Quote" };
function build(model) {
  const X = require("docx");
  const m = model || {}, pg = m.page || {}, mg = pg.margins || {};
  const runOf = (r) => {
    if (r.field === "page" || r.field === "pages") return new X.TextRun(Object.assign({ children: [r.field === "page" ? X.PageNumber.CURRENT : X.PageNumber.TOTAL_PAGES] }, r.b ? { bold: true } : {}, r.i ? { italics: true } : {}, r.font ? { font: r.font } : {}, r.size ? { size: Math.round(r.size * 2) } : {}, hex(r.color) ? { color: hex(r.color) } : {}));
    const o = { text: String(r.text == null ? "" : r.text) };
    if (r.b) o.bold = true; if (r.i) o.italics = true; if (r.s) o.strike = true; if (r.sub) o.subScript = true; if (r.sup) o.superScript = true; if (r.br) o.break = 1;
    if (r.u) o.underline = { type: X.UnderlineType.SINGLE };
    if (r.font) o.font = r.font;
    if (r.size) o.size = Math.round(r.size * 2);
    const c = hex(r.color); if (c) o.color = c;
    const h = hex(r.hi); if (h) { if (HILITE[h]) o.highlight = HILITE[h]; else o.shading = { type: X.ShadingType.CLEAR, color: "auto", fill: h }; }
    const t = new X.TextRun(o);
    return r.link ? new X.ExternalHyperlink({ link: r.link, children: [new X.TextRun(Object.assign({}, o, { style: "Hyperlink" }))] }) : t;
  };
  const ALIGN = { left: X.AlignmentType.LEFT, center: X.AlignmentType.CENTER, right: X.AlignmentType.RIGHT, justify: X.AlignmentType.JUSTIFIED };
  const paraOf = (b) => {
    const o = { children: (b.runs || []).map(runOf) };
    if (HEADINGS[b.style]) o.style = HEADINGS[b.style];
    if (b.style === "code") o.style = "Code";
    if (ALIGN[b.align]) o.alignment = ALIGN[b.align];
    const sp = {}; if (b.before != null) sp.before = Math.round(b.before * 20); if (b.after != null) sp.after = Math.round(b.after * 20); if (b.lineHeight) { sp.line = Math.round(b.lineHeight * 240); sp.lineRule = "auto"; }
    if (Object.keys(sp).length) o.spacing = sp;
    if (b.indent) o.indent = { left: Math.round(b.indent * 20) };
    if (b.list) o.numbering = { reference: b.list.kind === "ol" ? "bg-ol" : "bg-ul", level: Math.max(0, Math.min(8, b.list.level || 0)) };
    if (b.pageBreak) o.pageBreakBefore = true;
    return new X.Paragraph(o);
  };
  const usable = (Math.max(10, (pg.wmm || 210) - (mg.left || 25) - (mg.right || 25))) * MM;
  const tableOf = (t) => {
    const ws = (t.widths && t.widths.length ? t.widths : null), cols = ws ? ws.length : Math.max(1, ...(t.rows || []).map((r) => r.reduce((n, c) => n + (c.cs || 1), 0)));
    const W = (ws || Array.from({ length: cols }, () => 100 / cols)).map((p) => Math.round(usable * p / 100));
    const line = (on) => (on ? { style: X.BorderStyle.SINGLE, size: 4, color: hex(t.borderColor) || "888888" } : { style: X.BorderStyle.NONE, size: 0, color: "FFFFFF" });
    const all = t.borders !== "none" && t.borders !== "outside", out = t.borders !== "none";
    const rows = (t.rows || []).map((r, ri) => {
      let col = 0;
      const cells = r.map((c) => {
        const span = c.cs || 1, w = W.slice(col, col + span).reduce((a, b) => a + b, 0); col += span;
        const o = { children: (c.blocks && c.blocks.length ? c.blocks : [{ t: "p", runs: [] }]).map((x) => (x.t === "table" ? tableOf(x) : paraOf(x))), width: { size: w, type: X.WidthType.DXA } };
        if (span > 1) o.columnSpan = span;
        if (c.rs > 1) o.rowSpan = c.rs;
        const sh = hex(c.shade); if (sh) o.shading = { type: X.ShadingType.CLEAR, color: "auto", fill: sh };
        if (c.valign) o.verticalAlign = { top: X.VerticalAlign.TOP, middle: X.VerticalAlign.CENTER, bottom: X.VerticalAlign.BOTTOM }[c.valign] || X.VerticalAlign.TOP;
        o.borders = { top: line(all), bottom: line(all), left: line(all), right: line(all) };
        return new X.TableCell(o);
      });
      return new X.TableRow(ri < (t.headerRows || 0) ? { children: cells, tableHeader: true } : { children: cells });
    });
    return new X.Table({ rows, width: { size: W.reduce((a, b) => a + b, 0), type: X.WidthType.DXA }, columnWidths: W, borders: { top: line(out), bottom: line(out), left: line(out), right: line(out), insideHorizontal: line(all), insideVertical: line(all) } });
  };
  const children = [];
  for (const b of m.blocks || []) {
    if (b.t === "table") { children.push(tableOf(b)); continue; }
    if (b.t === "hr") { children.push(new X.Paragraph({ border: { bottom: { style: X.BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } }, children: [] })); continue; }
    children.push(paraOf(b));
  }
  if (!children.length) children.push(new X.Paragraph({ children: [] }));
  const levels = (kind) => Array.from({ length: 9 }, (_, l) => ({ level: l, format: kind === "ol" ? [X.LevelFormat.DECIMAL, X.LevelFormat.LOWER_LETTER, X.LevelFormat.LOWER_ROMAN][l % 3] : X.LevelFormat.BULLET,
    text: kind === "ol" ? `%${l + 1}.` : ["•", "◦", "▪"][l % 3], alignment: X.AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (l + 1), hanging: 360 } } } }));
  const props = { page: { size: { width: Math.round((pg.wmm || 210) * MM), height: Math.round((pg.hmm || 297) * MM), orientation: pg.landscape ? X.PageOrientation.LANDSCAPE : X.PageOrientation.PORTRAIT },
    margin: { top: Math.round((mg.top == null ? 25 : mg.top) * MM), right: Math.round((mg.right == null ? 25 : mg.right) * MM), bottom: Math.round((mg.bottom == null ? 25 : mg.bottom) * MM), left: Math.round((mg.left == null ? 25 : mg.left) * MM) } } };
  const sec = { properties: props, children };
  if (m.header && m.header.length) sec.headers = { default: new X.Header({ children: m.header.map(paraOf) }) };
  if (m.footer && m.footer.length) sec.footers = { default: new X.Footer({ children: m.footer.map(paraOf) }) };
  const doc = new X.Document({
    creator: "bitGen Studio", title: m.title || "Document",
    styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { after: 160, line: 276 } } } },
      paragraphStyles: [{ id: "Code", name: "Code", basedOn: "Normal", run: { font: "Consolas", size: 20 } }] },
    numbering: { config: [{ reference: "bg-ul", levels: levels("ul") }, { reference: "bg-ol", levels: levels("ol") }] },
    sections: [sec],
  });
  return X.Packer.toBuffer(doc);
}

/* ---------------- .docx -> HTML ---------------- */
async function read(buf) {
  if (!isZip(buf)) throw bad("that is not a .docx file");
  const mammoth = require("mammoth");
  const styleMap = ["p[style-name='Title'] => p[data-style='title']:fresh", "p[style-name='Subtitle'] => p[data-style='subtitle']:fresh",
    "p[style-name='Quote'] => blockquote:fresh", "p[style-name='Intense Quote'] => blockquote:fresh", "p[style-name='Code'] => pre:fresh",
    "u => u", "strike => s"];
  const r = await mammoth.convertToHtml({ buffer: buf }, { styleMap, ignoreEmptyParagraphs: false, convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })) });
  return { html: String(r.value || "").replace(/<img[^>]*>/gi, ""), messages: (r.messages || []).map((x) => x.message).slice(0, 20) };
}

module.exports = { MAX, dir, safeName, save, list, file, build, read, hex };
