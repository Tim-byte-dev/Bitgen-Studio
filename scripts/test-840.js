#!/usr/bin/env node
/* bitGen Studio — 2.840.0 units: an opened .docx brings its pictures (as figures in the text), and a WP frame's edges are
 * the page's margins.
 *   docxFiles read (a real .docx with a PNG made by docx) -> figures + <img data-dx>; imageSize (PNG / GIF / BMP / JPEG / SVG);
 *   pcdocx figPlaces (alone in a paragraph = its place, inside words = after them, narrow = centred, alt = caption);
 *   pcdocmargins edgeAt / dragTo / mmOf / fromMargins; the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const DX = require(path.join(ROOT, "lib/docxFiles.js")), PX = require(path.join(ROOT, "ext/imageeditdock/pcdocx.js")), M = require(path.join(ROOT, "ext/imageeditdock/pcdocmargins.js"));
const { JSDOM } = require("jsdom");
const doc = new JSDOM("<!doctype html><body></body>").window.document;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const zlib = require("zlib");
function png(w, h) {   // a plain red PNG
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { raw[y * (w * 3 + 1) + 1 + x * 3] = 220; }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
(async () => {
  const P1 = png(300, 150), D = require("docx");
  const buf = await D.Packer.toBuffer(new D.Document({ sections: [{ children: [new D.Paragraph("Before the picture."),
    new D.Paragraph({ children: [new D.ImageRun({ type: "png", data: P1, transformation: { width: 300, height: 150 }, altText: { name: "chart", description: "A red chart", title: "A red chart" } })] }),
    new D.Paragraph({ children: [new D.TextRun("Words and "), new D.ImageRun({ type: "png", data: png(40, 40), transformation: { width: 40, height: 40 } }), new D.TextRun(" an icon.")] }), new D.Paragraph("After.")] }] }));
  const o = await DX.read(buf);
  check("read: the pictures come back - figures[{mime, b64, w, h}] + an <img data-dx> where each was", o.figures.length === 2 && o.figures[0].mime === "image/png" && o.figures[0].w === 300 && o.figures[0].h === 150 && o.figures[1].w === 40 && /<img[^>]*data-dx="0"/.test(o.html) && /<img[^>]*data-dx="1"/.test(o.html), { n: o.figures.length, html: o.html.slice(0, 400) });
  const gif = Buffer.from("474946383961" + "2c01" + "9600", "hex"), bmp = Buffer.alloc(30); bmp.write("BM"); bmp.writeInt32LE(64, 18); bmp.writeInt32LE(-32, 22);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x78, 0x00, 0xa0, 0x03]);
  check("imageSize: PNG, GIF, BMP (top-down), JPEG (its SOF), SVG width / height", JSON.stringify([DX.imageSize(P1), DX.imageSize(gif), DX.imageSize(bmp), DX.imageSize(jpg), DX.imageSize(Buffer.from('<svg width="80" height="20">'), "image/svg+xml")]) === JSON.stringify([{ w: 300, h: 150 }, { w: 300, h: 150 }, { w: 64, h: 32 }, { w: 160, h: 120 }, { w: 80, h: 20 }]));
  const fp = PX.figPlaces(o.html, o.figures, 600, doc, "t");
  const h = fp.html;
  check("figPlaces: a picture alone in its paragraph takes that place (its alt text the caption), narrower than the column = centred at its own width",
    /<p>Before the picture\.<\/p><p data-fig="dxt-0" style="padding-top: 150px; width: 50%; margin-left: 150px;"><i>A red chart<\/i><\/p>/.test(h) && fp.figs.length === 2 && /^data:image\/png;base64,iVBOR/.test(fp.figs[0].src), h);
  check("figPlaces: a picture inside words goes right after their paragraph; no <img> left", /<p>Words and\s* an icon\.<\/p><p data-fig="dxt-1"[^>]*><br><\/p><p>After\.<\/p>/.test(h) && !/<img/.test(h), h);
  const wide = PX.figPlaces('<p><img data-dx="0"></p>', [{ mime: "image/png", b64: "x", w: 1200, h: 600 }], 600, doc, "w").html;
  check("figPlaces: wider than the column = the column's width (no width / centring), its height kept in shape", /style="padding-top: 300px;"/.test(wide) && !/width/.test(wide), wide);
  // margins
  const f = { x: 100, y: 100, w: 800, h: 1000 };
  check("edgeAt: left / right / top / bottom / a corner within the tolerance; inside = nothing",
    M.edgeAt(f, 102, 500, 6) === "l" && M.edgeAt(f, 897, 500, 6) === "r" && M.edgeAt(f, 500, 96, 6) === "t" && M.edgeAt(f, 500, 1104, 6) === "b" && M.edgeAt(f, 100, 1100, 6) === "lb" && M.edgeAt(f, 500, 500, 6) === "" && M.edgeAt(f, 102, 1400, 6) === "");
  const d1 = M.dragTo(f, "l", -50, 0, 1000, 1400), d2 = M.dragTo(f, "r", 500, 0, 1000, 1400), d3 = M.dragTo(f, "t", 0, 2000, 1000, 1400), d4 = M.dragTo(f, "rb", -20, 30, 1000, 1400);
  check("dragTo: the edge moves (the other side stays), never off the page, never under 40 x 30",
    d1.x === 50 && d1.w === 850 && d2.x === 100 && d2.w === 900 && d3.y === 1070 && d3.h === 30 && d4.w === 780 && d4.h === 1030 && d4.x === 100, [d1, d2, d3, d4]);
  const mm = M.mmOf({ x: 148, y: 148, w: 1240 - 296, h: 1754 - 296 }, 1240, 1754, 150);
  check("mmOf / fromMargins: a frame inset 148 px on a 150 dpi page = 25.1 mm margins; 25 mm all round back to the frame",
    mm.left === 25.1 && mm.right === 25.1 && mm.top === 25.1 && mm.bottom === 25.1 && JSON.stringify(M.fromMargins({ top: 25, bottom: 25, left: 20, right: 20 }, 1240, 1754, 150)) === JSON.stringify({ x: 118, y: 148, w: 1004, h: 1458 }) && M.fromMargins({ top: 200, bottom: 200, left: 0, right: 0 }, 1240, 1754, 150) === null, mm);
  const EX = JSON.parse(read("ext/imageeditdock/ext.json")), IE = read("ext/imageeditdock/imageedit.js"), PD = read("ext/imageeditdock/pcdocx.js"), MG = read("ext/imageeditdock/pcdocmargins.js");
  check("the wiring: an opened .docx's pictures become anchored layers at their places; the margins module loaded and installed after the figures; dragging is one undo; Layer ▸ 📏 WP Margins…",
    /figPlaces\(o\.raw, o\.figures,/.test(PD) && /N\.anchor = \{ flow, fig: f\.id, box: null, src: f\.src, drawn: false \}/.test(PD)
    && EX.scripts.indexOf("pcdocmargins.js") === EX.scripts.indexOf("pcdocfig.js") + 1 && IE.indexOf("PCDocMargins.install(E)") > IE.indexOf("PCDocFig.install(E)")
    && /E\.push\(\{ t: "struct", before: d\.before, after: E\.snapStruct\(\), label: "WP margins" \}\)/.test(MG) && /addCmd\("layer\.docmargins", "📏 WP Margins…"/.test(MG));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
