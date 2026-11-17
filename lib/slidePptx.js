// bitGen Studio — lib/slidePptx.js (2.831.0): 🎞 SLIDES -> a PowerPoint file (.pptx) with pptxgenjs (MIT).
//
// Every slide: its background, text boxes (font, size, colour, bold / italic / underline, alignment, bullets - each line a
// paragraph), shapes (with their words), pictures (cover = cropped to fill, contain = fitted), the speaker notes. Empty
// placeholders are left out. The deck is 1280 x 720 (or 960 x 720) slide px = 96 px an inch (13.33 x 7.5 in widescreen).
"use strict";
const SC = require("../ext/slidesdock/slidecore.js");

const PX = 96;                                          // slide px an inch
const inch = (v) => Math.round(v / PX * 1000) / 1000;
const hex = (c) => String(c || "#000000").replace(/^#/, "").toUpperCase();
const PT = 0.75;                                       // a slide px = 0.75 pt (96 dpi)
const SHAPE = { rect: "rect", round: "roundRect", ellipse: "ellipse", triangle: "triangle", diamond: "diamond", rarrow: "rightArrow", larrow: "leftArrow", star: "star5", line: "line" };

/** the size (w x h) of a data: picture - PNG / JPEG / GIF / WebP headers (for "cover" cropping) */
function imageSize(dataUrl) {
  try {
    const b = Buffer.from(String(dataUrl).split(",")[1] || "", "base64");
    if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0x47 && b[1] === 0x49) return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") {
      const k = b.slice(12, 16).toString();
      if (k === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (k === "VP8L") { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
      if (k === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }; i += 2 + len; }
    }
  } catch (e) { /* unknown */ }
  return null;
}
/** a text item's paragraphs as pptxgenjs runs */
function runs(it, deck) {
  const L = SC.textLook(it, deck), lines = String(it.text || "").split("\n");
  return lines.map((t, i) => ({ text: t, options: Object.assign({ breakLine: i < lines.length - 1 }, L.bullets && t.trim() ? { bullet: { indent: Math.round(L.size * PT * 0.9) } } : {}) }));
}
function textOpts(it, deck) {
  const L = SC.textLook(it, deck);
  return { fontFace: L.font, fontSize: Math.max(4, Math.round(L.size * PT * 10) / 10), color: hex(L.color), bold: L.b, italic: L.i, underline: L.u ? { style: "sng" } : undefined,
    align: L.align === "justify" ? "justify" : L.align, valign: L.valign, margin: 4, paraSpaceAfter: 4, fit: "none" };
}
async function toPptx(deckIn) {
  const deck = SC.clean(deckIn), PptxGenJS = require("pptxgenjs"), pres = new PptxGenJS();
  pres.defineLayout({ name: "BITGEN", width: deck.w / PX, height: deck.h / PX }); pres.layout = "BITGEN";
  pres.author = "bitGen Studio"; pres.company = "bitGen Studio"; pres.title = SC.titleOf(deck.slides[0]) || "Presentation";
  for (const s of deck.slides) {
    const sl = pres.addSlide();
    sl.background = { color: hex(SC.bgOf(s, deck)) };
    if (s.hidden) sl.hidden = true;
    for (const it of s.items) {
      const box = { x: inch(it.x), y: inch(it.y), w: inch(it.w), h: inch(it.h) }; if (it.rot) box.rotate = it.rot;
      if (it.type === "text") { if (!String(it.text || "").trim()) continue; sl.addText(runs(it, deck), Object.assign({}, box, textOpts(it, deck))); }
      else if (it.type === "shape") {
        const K = SC.shapeLook(it, deck), o = Object.assign({}, box, { shape: SHAPE[it.shape] || "rect" });
        if (it.shape === "line") o.line = { color: hex(K.fill === "none" ? K.line : K.fill), width: Math.max(1, (it.lw || 3) * PT) };
        else { o.fill = K.fill === "none" ? { type: "none" } : { color: hex(K.fill) }; o.line = K.line === "none" || !K.lw ? { type: "none" } : { color: hex(K.line), width: K.lw * PT }; if (it.shape === "round") o.rectRadius = Math.min(box.w, box.h) * 0.12; }
        if (String(it.text || "").trim()) sl.addText(runs(it, deck), Object.assign(o, textOpts(Object.assign({}, it, { st: Object.assign({ align: "center", valign: "middle", color: "#ffffff" }, it.st || {}) }), deck)));
        else sl.addShape(o.shape, o);
      } else if (it.type === "image") {
        const data = it.src && deck.media[it.src.slice(6)]; if (!data) continue;
        const sz = imageSize(data), o = Object.assign({}, box, { data });
        if (sz && sz.w && sz.h) o.sizing = { type: it.fit === "contain" ? "contain" : "cover", w: box.w, h: box.h };
        sl.addImage(o);
      }
    }
    if (s.notes && s.notes.trim()) sl.addNotes(s.notes);
  }
  return pres.write({ outputType: "nodebuffer" });
}
module.exports = { toPptx, imageSize, inch };
