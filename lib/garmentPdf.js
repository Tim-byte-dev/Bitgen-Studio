// bitGen Studio — lib/garmentPdf.js (2.932.0): 👗 a garment's sewing pattern as a PDF AT ACTUAL SIZE, to print at home (A4 /
// Letter / A3 pages to trim and tape together) or as one big sheet at a copy shop (A0). Made on the server with pdf-lib
// (MIT, static/vendor/pdf-lib.min.js - the copy the app already ships) from the garment's outline.json (scripts/garment_pattern.py).
//
// Page 1: the garment, the measurements it was made for, a 10 cm test square (print at 100 % / "actual size" and measure it),
// the legend and the page map. Then the pieces, laid out flat (no piece turned - each keeps its grainline), tiled over the
// pages: each page says its place (B3 = row B, column 3) and marks the neighbours to tape to on every side.
// On every piece: the cutting line (solid; the stitching line + the seam allowance when one is asked), the grainline, its name,
// "Cut 1", and a notch + a letter on every seam - sew A to A, B to B.
//   PAPERS / layout(outline, {paper, sa}) (pure) / pdf(outline, {paper, sa, title, body}) -> {bytes, pages, sheets: [cols, rows]}
//   offset(poly, d) (pure) / letters(i) (pure)
"use strict";
let PL = null;
const lib = () => PL || (PL = require("../static/vendor/pdf-lib.min.js"));

const CM = 72 / 2.54;                    // points per centimetre
const PAPERS = {
  a4: { label: "A4", w: 21.0, h: 29.7 },
  letter: { label: "US Letter", w: 21.59, h: 27.94 },
  a3: { label: "A3", w: 29.7, h: 42.0 },
  a0: { label: "A0 (copy shop)", w: 84.1, h: 118.9 },
};
const MARGIN = 1.0;                      // cm a home printer leaves white
const GAP = 1.5;                         // cm between pieces

function letters(i) { let s = "", n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; }
function area(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function dedupe(P) {
  const o = [];
  for (const p of P) { const q = o[o.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) o.push(p); }
  while (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 1e-4) o.pop();
  return o;
}
/** the polygon moved out by d (cm) - the cutting line round the stitching line (mitred, the mitre kept under 3 d) */
function offset(poly, d) {
  const P = dedupe(poly);
  if (!(d > 0) || P.length < 3) return P.map((p) => p.slice());
  const s = area(P) > 0 ? 1 : -1;        // counter-clockwise (y up) = outward normals on the right of each edge
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [s * dy / L, -s * dx / L]; };
  return P.map((p, i) => {
    const a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length];
    const n1 = nrm(a, p), n2 = nrm(p, b);
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1];
    const L = Math.hypot(nx, ny);
    if (L < 1e-6) { nx = n1[0]; ny = n1[1]; } else { nx /= L; ny /= L; }
    const k = Math.min(3 * d, d / Math.max(0.33, nx * n1[0] + ny * n1[1]));
    return [p[0] + nx * k, p[1] + ny * k];
  });
}
const pretty = (n) => String(n || "").replace(/_/g, " ").replace(/\bftorso\b/, "front").replace(/\bbtorso\b/, "back")
  .replace(/\bsleeve f\b/, "sleeve front").replace(/\bsleeve b\b/, "sleeve back").replace(/\bwb\b/, "waistband")
  .replace(/^./, (c) => c.toUpperCase());
/** the pieces of a garment in drawing coordinates (cm, y DOWN), each with its own box -> laid out on a canvas of `cols` pages */
function pieces(outline, sa) {
  const out = [];
  const stitchAt = {};                   // "panel/edge" -> the letter of its seam
  (outline.stitches || []).forEach((s, i) => { for (const side of s) stitchAt[`${side.panel}/${side.edge}`] = letters(i); });
  for (const P of outline.panels || []) {
    const sew = dedupe(P.outline.map((p) => [p[0], -p[1]]));
    if (sew.length < 3) continue;
    const cut = offset(sew, sa);
    const xs = cut.map((p) => p[0]), ys = cut.map((p) => p[1]);
    const box = { x: Math.min(...xs), y: Math.min(...ys) };
    box.w = Math.max(...xs) - box.x; box.h = Math.max(...ys) - box.y;
    const notches = [];
    (P.edges || []).forEach((e, ei) => {
      const L = stitchAt[`${P.name}/${ei}`];
      if (!L) return;
      const seg = P.outline.slice(e.at[0], e.at[1]).concat([P.outline[e.at[1] % P.outline.length]]).map((p) => [p[0], -p[1]]);
      let tot = 0; const len = [0];
      for (let i = 1; i < seg.length; i++) { tot += Math.hypot(seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]); len.push(tot); }
      if (tot < 1.5) return;
      let i = 1; while (i < len.length - 1 && len[i] < tot / 2) i++;
      const a = seg[i - 1], b = seg[i], f = (tot / 2 - len[i - 1]) / ((len[i] - len[i - 1]) || 1);
      const m = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      const dx = b[0] - a[0], dy = b[1] - a[1], D = Math.hypot(dx, dy) || 1;
      const sg = area(sew) > 0 ? 1 : -1;
      notches.push({ at: m, out: [sg * dy / D, -sg * dx / D], letter: L });
    });
    const rz = Math.abs(((P.rotation || [0, 0, 0])[2] || 0) % 180);
    out.push({ name: P.name, label: pretty(P.name), sew, cut, box, notches,
      grain: rz > 1 && rz < 179 ? [1, 0] : [0, 1] });   // a sleeve hangs along the arm: its grain runs along its length
  }
  return out;
}
/** shelf packing of the pieces on canvases `cols` pages wide -> the layout with the fewest pages */
function layout(outline, o) {
  const opt = o || {};
  const paper = PAPERS[opt.paper] || PAPERS.a4;
  const sa = Math.max(0, Math.min(5, +opt.sa || 0));
  const pw = paper.w - 2 * MARGIN, ph = paper.h - 2 * MARGIN;
  const ps = pieces(outline, sa).sort((a, b) => b.box.h - a.box.h);
  if (!ps.length) throw Object.assign(new Error("the pattern has no pieces"), { status: 422 });
  const widest = Math.max(...ps.map((p) => p.box.w));
  let best = null;
  for (let cols = Math.max(1, Math.ceil((widest + 2 * GAP) / pw)); cols <= 12; cols++) {
    const W = cols * pw;
    let x = GAP, y = GAP, row = 0;
    const at = [];
    for (const p of ps) {
      if (x + p.box.w + GAP > W && x > GAP) { x = GAP; y += row + GAP; row = 0; }
      at.push({ p, x, y });
      x += p.box.w + GAP; row = Math.max(row, p.box.h);
    }
    const H = y + row + GAP, rows = Math.ceil(H / ph), pages = cols * rows;
    if (!best || pages < best.pages || (pages === best.pages && cols < best.cols)) best = { cols, rows, pages, W, H, at };
  }
  return Object.assign(best, { paper, sa, pw, ph, key: opt.paper && PAPERS[opt.paper] ? opt.paper : "a4" });
}
const ascii = (s, n) => String(s == null ? "" : s).normalize("NFKD").replace(/[^\x20-\x7e]/g, "").slice(0, n || 90);

async function pdf(outline, o) {
  const opt = o || {};
  const L = lib();
  const lay = layout(outline, opt);
  const doc = await L.PDFDocument.create();
  const font = await doc.embedFont(L.StandardFonts.Helvetica), bold = await doc.embedFont(L.StandardFonts.HelveticaBold);
  const title = ascii(opt.title || outline.name || "Garment").replace(/\s+/g, " ").trim() || "Garment";
  doc.setTitle(`${title} - sewing pattern`); doc.setCreator("bitGen Studio"); doc.setProducer("bitGen Studio (pdf-lib, GarmentCode)");
  const PW = lay.paper.w * CM, PH = lay.paper.h * CM, ink = L.rgb(0.1, 0.1, 0.1), grey = L.rgb(0.55, 0.55, 0.55), red = L.rgb(0.75, 0.1, 0.1);
  const pathOf = (P, dx, dy) => P.map((p, i) => `${i ? "L" : "M"} ${((p[0] + dx) * CM).toFixed(2)} ${((p[1] + dy) * CM).toFixed(2)}`).join(" ") + " Z";
  const rowName = (r) => letters(r);

  // ---- page 1: what it is, the test square, the legend, the page map
  const p1 = doc.addPage([PW, PH]);
  const X = MARGIN * CM; let Y = PH - MARGIN * CM - 16;
  const maxW = PW - 2 * MARGIN * CM;
  const line = (t, f, s, c) => {                // word-wrapped to the page's width
    const F = f || font, S = s || 10;
    let cur = "";
    for (const w of ascii(t, 2000).split(" ")) {
      const next = cur ? cur + " " + w : w;
      if (cur && F.widthOfTextAtSize(next, S) > maxW) { p1.drawText(cur, { x: X, y: Y, size: S, font: F, color: c || ink }); Y -= S * 1.45; cur = w; }
      else cur = next;
    }
    if (cur) { p1.drawText(cur, { x: X, y: Y, size: S, font: F, color: c || ink }); Y -= S * 1.45; }
  };
  line(`${title} - sewing pattern`, bold, 16);
  line(`${lay.paper.label}, ${lay.pages} page${lay.pages > 1 ? "s" : ""} (${lay.cols} across x ${lay.rows} down) - ${outline.panels.length} pieces`, font, 10);
  const b = opt.body || {};
  if (b.height) line(`Made for: ${b.sex === "male" ? "male" : "female"} figure, height ${Math.round(b.height)} cm, bust ${Math.round(b.bust)} cm, waist ${Math.round(b.waist)} cm, hips ${Math.round(b.hips)} cm`, font, 9);
  line(lay.sa > 0 ? `Seam allowance ${lay.sa} cm is INCLUDED: cut on the solid line, sew on the dashed line.` : "NO seam allowance: add your own round every piece before cutting (the solid line is the stitching line).", bold, 9, lay.sa > 0 ? ink : red);
  line("Print at 100 % / \"Actual size\" - never \"Fit to page\". Measure the square: it must be 10 cm x 10 cm.", font, 9);
  line("Trim each page on its frame and tape it to its neighbours (the letters + numbers at the edges say which).", font, 9);
  line("Notches with letters: sew A to A, B to B ... The arrow is the grainline - lay it along the fabric's straight grain.", font, 9);
  line("Pattern by GarmentCode (MIT, Korosteleva et al.) in bitGen Studio. Check the fit with a test garment first.", font, 8, grey);
  Y -= 6;
  const sq = 10 * CM;
  p1.drawRectangle({ x: X, y: Y - sq, width: sq, height: sq, borderColor: ink, borderWidth: 1 });
  p1.drawText("10 cm", { x: X + sq / 2 - 14, y: Y - sq / 2 - 4, size: 12, font: bold, color: ink });
  p1.drawText("test square", { x: X + sq / 2 - 24, y: Y - sq / 2 - 18, size: 9, font, color: grey });
  // the page map beside / under the square
  const mapX = X + sq + 1 * CM, mapW = PW - mapX - MARGIN * CM, mapTop = Y, mapH = Math.max(4 * CM, mapTop - MARGIN * CM);
  const k = Math.min(mapW / (lay.cols * lay.pw * CM), mapH / (lay.rows * lay.ph * CM));
  for (let r = 0; r < lay.rows; r++) for (let c = 0; c < lay.cols; c++) {
    const x = mapX + c * lay.pw * CM * k, y = mapTop - (r + 1) * lay.ph * CM * k;
    p1.drawRectangle({ x, y, width: lay.pw * CM * k, height: lay.ph * CM * k, borderColor: grey, borderWidth: 0.5 });
    p1.drawText(`${rowName(r)}${c + 1}`, { x: x + 2, y: y + lay.ph * CM * k - 9, size: 7, font, color: grey });
  }
  for (const it of lay.at) {
    const d = it.p.cut.map((p, i) => `${i ? "L" : "M"} ${((p[0] - it.p.box.x + it.x) * CM * k).toFixed(2)} ${((p[1] - it.p.box.y + it.y) * CM * k).toFixed(2)}`).join(" ") + " Z";
    p1.drawSvgPath(d, { x: mapX, y: mapTop, borderColor: ink, borderWidth: 0.4 });
  }

  // ---- the pattern pages
  for (let r = 0; r < lay.rows; r++) for (let c = 0; c < lay.cols; c++) {
    const pg = doc.addPage([PW, PH]);
    const ox = MARGIN * CM - c * lay.pw * CM, oy = PH - MARGIN * CM + r * lay.ph * CM;   // the canvas origin on this page
    pg.pushOperators(L.pushGraphicsState(), L.rectangle(MARGIN * CM, MARGIN * CM, lay.pw * CM, lay.ph * CM), L.clip(), L.endPath());
    for (const it of lay.at) {
      const p = it.p, dx = it.x - p.box.x, dy = it.y - p.box.y;
      // only the pieces that reach this page
      if (it.x > (c + 1) * lay.pw || it.x + p.box.w < c * lay.pw || it.y > (r + 1) * lay.ph || it.y + p.box.h < r * lay.ph) continue;
      pg.drawSvgPath(pathOf(p.cut, dx, dy), { x: ox, y: oy, borderColor: ink, borderWidth: 1 });
      if (lay.sa > 0) pg.drawSvgPath(pathOf(p.sew, dx, dy), { x: ox, y: oy, borderColor: grey, borderWidth: 0.6, borderDashArray: [4, 3] });
      // the grainline through the middle, 60 % of the piece along its grain
      const cx = p.box.x + p.box.w / 2 + dx, cy = p.box.y + p.box.h / 2 + dy;
      const half = 0.3 * (p.grain[0] ? p.box.w : p.box.h), gx = p.grain[0] * half, gy = p.grain[1] * half;
      const g = (x, y) => `${(x * CM).toFixed(2)} ${(y * CM).toFixed(2)}`;
      const head = (x, y, ux, uy) => `M ${g(x - ux * 0.6 - uy * 0.35, y - uy * 0.6 + ux * 0.35)} L ${g(x, y)} L ${g(x - ux * 0.6 + uy * 0.35, y - uy * 0.6 - ux * 0.35)}`;
      pg.drawSvgPath(`M ${g(cx - gx, cy - gy)} L ${g(cx + gx, cy + gy)} ${head(cx + gx, cy + gy, p.grain[0], p.grain[1])} ${head(cx - gx, cy - gy, -p.grain[0], -p.grain[1])}`,
        { x: ox, y: oy, borderColor: ink, borderWidth: 0.8 });
      const tx = ox + (cx + 0.4) * CM, ty = oy - (cy - 0.6) * CM;
      pg.drawText(ascii(p.label), { x: tx, y: ty, size: 9, font: bold, color: ink });
      pg.drawText(`Cut 1 - ${title}`, { x: tx, y: ty - 11, size: 7, font, color: grey });
      for (const n of p.notches) {
        const nx = n.at[0] + dx, ny = n.at[1] + dy;
        const ex = nx + n.out[0] * (lay.sa + 0.15), ey = ny + n.out[1] * (lay.sa + 0.15);
        pg.drawSvgPath(`M ${g(nx - n.out[0] * 0.5, ny - n.out[1] * 0.5)} L ${g(ex, ey)}`, { x: ox, y: oy, borderColor: ink, borderWidth: 1 });
        const lx = nx - n.out[0] * 1.0, ly = ny - n.out[1] * 1.0;
        pg.drawText(n.letter, { x: ox + lx * CM - 3, y: oy - ly * CM - 3, size: 8, font: bold, color: red });
      }
    }
    pg.pushOperators(L.popGraphicsState());
    // the frame to trim on + where the neighbours go
    pg.drawRectangle({ x: MARGIN * CM, y: MARGIN * CM, width: lay.pw * CM, height: lay.ph * CM, borderColor: grey, borderWidth: 0.4, borderDashArray: [2, 2] });
    const name = `${rowName(r)}${c + 1}`;
    pg.drawText(`${name}  (row ${rowName(r)}, column ${c + 1})  -  page ${2 + r * lay.cols + c} of ${1 + lay.pages}  -  ${title}`, { x: MARGIN * CM, y: PH - MARGIN * CM + 6, size: 7, font, color: grey });
    const mid = (t, x, y) => pg.drawText(t, { x, y, size: 8, font: bold, color: grey });
    if (c > 0) mid(`< ${rowName(r)}${c}`, MARGIN * CM + 3, PH / 2);
    if (c < lay.cols - 1) mid(`${rowName(r)}${c + 2} >`, MARGIN * CM + lay.pw * CM - 28, PH / 2);
    if (r > 0) mid(`^ ${rowName(r - 1)}${c + 1}`, PW / 2 - 10, PH - MARGIN * CM - 10);
    if (r < lay.rows - 1) mid(`v ${rowName(r + 1)}${c + 1}`, PW / 2 - 10, MARGIN * CM + 4);
  }
  const bytes = await doc.save();
  return { bytes, pages: 1 + lay.pages, sheets: [lay.cols, lay.rows], paper: lay.key, sa: lay.sa };
}

module.exports = { PAPERS, MARGIN, CM, letters, offset, area, pieces, layout, pdf, ascii };
