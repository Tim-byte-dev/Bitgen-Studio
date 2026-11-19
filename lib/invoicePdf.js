// bitGen Studio — lib/invoicePdf.js (2.881.0): ⤓ an invoice / quote / credit note as a REAL PDF file, made on the server with pdf-lib
// (MIT, static/vendor/pdf-lib.min.js - the copy the app already ships) - for ✉ emailing it and ⤓ PDF. The same content as the
// 🖨 page (lib/accountingPrint.js): the seller + ABN, the title (Tax Invoice / Invoice / Quote / Adjustment Note / Credit Note),
// number, dates, the buyer, each line's quantity / unit price / GST / amount (GST-free named), the totals, "Total price includes GST"
// when every line is taxable, how to pay, terms, notes, a PAID stamp; A4, the standard PDF fonts, pages added when the lines run on.
// Pure (given the bytes of the logo): pdf(doc, books, business, {logo: {bytes, type}}) -> Uint8Array.
"use strict";
const { titleOf } = require("./accountingPrint");
let PL = null;
const lib = () => PL || (PL = require("../static/vendor/pdf-lib.min.js"));
const $ = (c) => { const n = Math.round(Number(c) || 0), a = Math.abs(n); return (n < 0 ? "-" : "") + "$" + String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + String(a % 100).padStart(2, "0"); };
const au = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : String(d || ""));
/** the words a standard PDF font can show (others -> "?"; tabs / odd spaces -> space) */
function safe(font, s) {
  return [...String(s == null ? "" : s).replace(/[\t   ]/g, " ").replace(/\r/g, "")].map((ch) => { if (ch === "\n") return ch; try { font.encodeText(ch); return ch; } catch (e) { return "?"; } }).join("");
}
/** words -> lines no wider than w at size */
function wrap(font, text, size, w) {
  const out = [];
  for (const para of safe(font, text).split("\n")) {
    let line = "";
    for (const word of para.split(/ +/)) {
      const t = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(t, size) <= w || !line) line = t; else { out.push(line); line = word; }
      while (font.widthOfTextAtSize(line, size) > w && line.length > 1) { let k = line.length - 1; while (k > 1 && font.widthOfTextAtSize(line.slice(0, k), size) > w) k--; out.push(line.slice(0, k)); line = line.slice(k); }
    }
    out.push(line);
  }
  return out;
}
async function pdf(doc, books, business, opt) {
  const { PDFDocument, StandardFonts, rgb, degrees } = lib(), o = opt || {}, B = books, biz = business || {}, gstOn = !!B.settings.gstRegistered;
  const q = doc.kind === "quote", cr = doc.kind === "credit", title = titleOf(doc, B);
  const P = await PDFDocument.create();
  P.setTitle(`${title} ${doc.number || ""}`.trim()); P.setAuthor(biz.company || biz.name || ""); P.setCreator("bitGen Studio"); P.setProducer("bitGen Studio (pdf-lib)");
  const F = { r: await P.embedFont(StandardFonts.TimesRoman), b: await P.embedFont(StandardFonts.TimesRomanBold), i: await P.embedFont(StandardFonts.TimesRomanItalic), m: await P.embedFont(StandardFonts.Courier), mb: await P.embedFont(StandardFonts.CourierBold) };
  const GREEN = rgb(0.184, 0.29, 0.149), INK = rgb(0.12, 0.165, 0.105), DIM = rgb(0.3, 0.36, 0.26), RED = rgb(0.69, 0.19, 0.16), RULE = rgb(0.79, 0.86, 0.74);
  const W = 595.28, H = 841.89, M = 50, R = W - M;
  let pg = P.addPage([W, H]), y = H - M;
  const text = (s, x, yy, size, font, color, align) => { const t = safe(font, s), w = font.widthOfTextAtSize(t, size); pg.drawText(t, { x: align === "right" ? x - w : align === "center" ? x - w / 2 : x, y: yy, size, font, color: color || INK }); return w; };
  const margin = () => { pg.drawLine({ start: { x: 30, y: 0 }, end: { x: 30, y: H }, thickness: 0.6, color: RED, opacity: 0.6 }); pg.drawLine({ start: { x: 33, y: 0 }, end: { x: 33, y: H }, thickness: 0.6, color: RED, opacity: 0.6 }); };
  margin();
  // ---- the seller (left) and the title + meta (right)
  let ly = y;
  if (o.logo && o.logo.bytes) {
    try {
      const img = /png/.test(o.logo.type) ? await P.embedPng(o.logo.bytes) : await P.embedJpg(o.logo.bytes), k = Math.min(160 / img.width, 55 / img.height, 1);
      pg.drawImage(img, { x: M, y: ly - img.height * k, width: img.width * k, height: img.height * k }); ly -= img.height * k + 8;
    } catch (e) { /* a logo pdf-lib cannot read is left out */ }
  }
  text(biz.company || biz.name || "", M, ly - 14, 16, F.b); ly -= 20;
  for (const l of [].concat(String(biz.address || "").split("\n"), [[biz.phone, biz.email].filter(Boolean).join("  ·  ")], [biz.website || ""]).filter((x) => x && x.trim())) { text(l, M, ly - 11, 10, F.r, DIM); ly -= 13; }
  if (biz.abn) { text("ABN " + biz.abn, M, ly - 11, 9.5, F.mb); ly -= 14; }
  text(title.toUpperCase(), R, y - 20, 22, F.b, GREEN, "right");
  const meta = [[q ? "Quote no." : cr ? "Credit note no." : "Invoice no.", doc.number || ""], ["Date", au(doc.date)]];
  if (!cr) meta.push([q ? "Valid until" : "Due date", au(doc.due)]);
  if (doc.ref) meta.push([cr ? "For invoice" : q ? "Ref" : "Quote", doc.ref]);
  if (doc.job) meta.push(["Job", doc.job]);
  let my = y - 42;
  for (const [k, v] of meta) { text(k, R - 110, my, 9.5, F.i, DIM, "right"); text(v, R, my, 10, F.mb, INK, "right"); my -= 14; }
  y = Math.min(ly, my) - 8;
  pg.drawLine({ start: { x: M, y }, end: { x: R, y }, thickness: 1, color: GREEN }); pg.drawLine({ start: { x: M, y: y - 3 }, end: { x: R, y: y - 3 }, thickness: 1, color: GREEN }); y -= 20;
  // ---- the buyer
  text(q ? "QUOTE FOR" : cr ? "CREDIT TO" : "BILL TO", M, y, 9, F.b, GREEN); y -= 14;
  text(doc.party || "", M, y, 11, F.b); y -= 13;
  for (const l of [].concat(String(doc.partyAddress || "").split("\n"), [doc.partyEmail || ""], [doc.partyAbn ? "ABN " + doc.partyAbn : ""]).filter((x) => x && x.trim())) { text(l, M, y, 10, F.r); y -= 13; }
  y -= 10;
  // ---- the lines
  const C = gstOn ? { d: M + 4, q: M + 285, u: M + 360, g: M + 418, a: R - 4 } : { d: M + 4, q: M + 330, u: M + 415, g: 0, a: R - 4 }, dw = (gstOn ? 250 : 290);
  const headRow = () => {
    text("Description", C.d, y, 9, F.b, GREEN); text("Qty", C.q, y, 9, F.b, GREEN, "right"); text("Unit price", C.u, y, 9, F.b, GREEN, "right");
    if (gstOn) text("GST", C.g, y, 9, F.b, GREEN, "right"); text("Amount", C.a, y, 9, F.b, GREEN, "right");
    y -= 5; pg.drawLine({ start: { x: M, y }, end: { x: R, y }, thickness: 1.2, color: GREEN }); y -= 13;
  };
  headRow();
  for (const l of doc.lines) {
    const desc = wrap(F.r, l.desc || "", 10, dw), h = desc.length * 12 + 6;
    if (y - h < 150) { pg = P.addPage([W, H]); margin(); y = H - M; text(`${title} ${doc.number || ""} (continued)`, M, y, 10, F.i, DIM); y -= 22; headRow(); }
    desc.forEach((t, i) => text(t, C.d, y - i * 12, 10, F.r));
    text(String(l.qty != null ? +(+l.qty).toFixed(3) : 1), C.q, y, 10, F.m, INK, "right"); text($(l.unit != null ? l.unit : l.amount), C.u, y, 10, F.m, INK, "right");
    if (gstOn) text(l.tax === "GST" ? $(l.gst) : l.tax === "FRE" ? "GST-free" : "-", C.g, y, l.tax === "FRE" ? 9 : 10, l.tax === "FRE" ? F.i : F.m, INK, "right");
    text($(l.amount), C.a, y, 10, F.m, INK, "right");
    y -= h - 2; pg.drawLine({ start: { x: M, y: y + 6 }, end: { x: R, y: y + 6 }, thickness: 0.5, color: RULE }); y -= 6;
  }
  // ---- the totals
  y -= 6;
  const paid = q || cr ? 0 : doc.paid || 0, balance = q || cr ? 0 : doc.balance != null ? doc.balance : doc.total - paid;
  const tot = (k, v, big) => { text(k, R - 120, y, big ? 12 : 10, big ? F.b : F.r, INK, "right"); text(v, R, y, big ? 12 : 10, big ? F.mb : F.m, INK, "right"); if (big) { pg.drawLine({ start: { x: R - 230, y: y + 13 }, end: { x: R, y: y + 13 }, thickness: 0.8, color: INK }); pg.drawLine({ start: { x: R - 230, y: y - 5 }, end: { x: R, y: y - 5 }, thickness: 0.8, color: INK }); pg.drawLine({ start: { x: R - 230, y: y - 8 }, end: { x: R, y: y - 8 }, thickness: 0.8, color: INK }); } y -= big ? 22 : 15; };
  if (gstOn) { tot("Subtotal excl. GST", $(doc.total - doc.gst)); tot(cr ? "GST credited" : "GST", $(doc.gst)); }
  tot(cr ? "Total credit" + (gstOn ? " incl. GST" : "") : "Total" + (gstOn ? " incl. GST" : ""), $(doc.total), true);
  if (!q && !cr && paid) { tot("Paid", $(paid)); tot("Balance due", $(balance), true); }
  if (gstOn && doc.lines.every((l) => l.tax === "GST")) { text(cr ? "The credit includes GST" : "Total price includes GST", R, y, 9.5, F.i, DIM, "right"); y -= 16; }
  // ---- how to pay, terms, notes
  y -= 8;
  const block = (head, body) => { if (y < 70) { pg = P.addPage([W, H]); margin(); y = H - M; } text(head.toUpperCase(), M, y, 9, F.b, GREEN); y -= 13; for (const l of wrap(F.r, body, 10, R - M)) { text(l, M, y, 10, F.r); y -= 13; } y -= 8; };
  if (B.settings.payTo && !q && !cr && balance > 0) block("How to pay", B.settings.payTo + (doc.number ? `\nPlease use ${doc.number} as the reference.` : ""));
  block(q ? "This quote" : cr ? "This credit note" : "Terms", q ? `Valid until ${au(doc.due)}. Prices include GST where shown.` : cr ? (doc.ref ? `Credits tax invoice ${doc.ref}.` : "A credit to your account.") : balance > 0 ? `Please pay by ${au(doc.due)}.` : "Thank you - paid in full.");
  if (doc.notes) block("Notes", doc.notes);
  if (!q && !cr && balance <= 0 && doc.total > 0) { const p1 = P.getPage(0); p1.drawText("PAID", { x: R - 170, y: H - 230, size: 40, font: F.mb, color: RED, rotate: degrees(12), opacity: 0.75 }); }
  return P.save();
}
module.exports = { pdf, wrap, safe };
