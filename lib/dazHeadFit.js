// bitGen Studio — lib/dazHeadFit.js (3.0.0): 🙂 A REAL 3D HEAD FROM A FACE CLOSE-UP onto a Daz figure (Genesis 9 …).
// Tim: "can we do a head from a picture and the body to a g9 template?" -> chose "Real 3D head shape". Until now 🙂 Head only
// scaled proportions (eyes -> chin, cheek width, top of the head). Now, like 📷 B for the body: the close-up -> a 3D shape (the
// installed 3D engine: lib/to3d.js - Hunyuan3D 2.1 / TRELLIS.2) -> that scan put on the figure's head (alignHead) -> ONLY the
// head's vertices pulled onto it (BF.wrap with trust = headMask: the head 1, blended down the neck, the eyes / teeth / tongue
// never) -> a custom morph, built like 📷 B's. The face is painted on top as before (lib/dazFace.js).
// Pure + tested (test-3000): headMask, headBox, alignHead, maskOf (a figure's weights -> its mask).
"use strict";

const HEAD = /^(head|face|jaw|brow|lip|nose|cheek|ear|chin|nostril|squint|forehead|temple|mouth|lowerjaw|upperjaw|central|eyelid|lidl|lidu)/;
const OFF = /^(eye|tongue|teeth|toothupper|toothlower|lacrimal|pupil|iris|cornea)/;   // inside the head - never follow a skin scan
const NECK = /^neck/;
const norm = (id) => String(id || "").toLowerCase().replace(/[_\s.-]/g, "");
const bare = (id) => norm(id).replace(/^(left|right|l|r)(?=[a-z])/, "");

/** per vertex how much it may follow the head scan (pure): names = each vertex's strongest bone; head 1, inside the head 0, the
 *  neck blended in over `blend` rings of neighbours (from the head down) -> Float32Array */
function headMask(names, tris, blend) {
  const n = names.length, m = new Float32Array(n), kind = new Int8Array(n);   // 1 head, 2 off, 3 neck
  for (let i = 0; i < n; i++) { const b = bare(names[i]); if (OFF.test(b)) kind[i] = 2; else if (HEAD.test(b)) { kind[i] = 1; m[i] = 1; } else if (NECK.test(b)) kind[i] = 3; }
  const nb = Array.from({ length: n }, () => []);
  for (let t = 0; t < tris.length; t += 3) for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) if (a !== c) nb[tris[t + a]].push(tris[t + c]);
  const rounds = blend == null ? 6 : blend;
  for (let r = 0; r < rounds; r++) {           // the neck: the head's pull fades over its rings
    const next = Float32Array.from(m);
    for (let i = 0; i < n; i++) { if (kind[i] !== 3 && kind[i] !== 0) continue; let s = 0; for (const q of nb[i]) s = Math.max(s, m[q]); next[i] = Math.max(m[i], s * (kind[i] === 3 ? 0.8 : 0.5)); }
    m.set(next);
  }
  for (let i = 0; i < n; i++) { if (kind[i] === 2) m[i] = 0; else if (kind[i] === 0 && m[i] < 0.2) m[i] = 0; }
  return m;
}
/** the box of the head's own vertices (mask >= 0.99) - pos x, y, z (Y up) */
function headBox(pos, mask) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; let k = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] >= 0.99) { k++; for (let a = 0; a < 3; a++) { const v = pos[i * 3 + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; } }
  return k ? { mn, mx, n: k } : null;
}
/** the scan of a face close-up put on the figure's head (pure) -> an align for BF.applyAlign: {s, turn, from, to}. A scan taller
 *  than wide is a bust (head + neck / shoulders): its head = the top band (as tall as the figure's head is, scaled by width).
 *  The scan's top on the head's top, its middle on the head's middle (x), its front (the nose) on the face's front (z). */
function alignHead(scanPos, box, turn) {
  const sb = { mn: [Infinity, Infinity, Infinity], mx: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < scanPos.length; i++) { const a = i % 3; if (scanPos[i] < sb.mn[a]) sb.mn[a] = scanPos[i]; if (scanPos[i] > sb.mx[a]) sb.mx[a] = scanPos[i]; }
  const hw = box.mx[0] - box.mn[0], hh = box.mx[1] - box.mn[1], sh = sb.mx[1] - sb.mn[1], ratio = hh / Math.max(1e-9, hw);
  // the scan's head band: slices from its top down; the head is what is above the shoulders (a slice suddenly much wider than
  // the head so far) - its widest slice = the head's width; the band as tall as a head of the figure's proportions that wide
  const top = sb.mx[1], K = 48, ws = new Array(K).fill(null);
  for (let i = 0; i < scanPos.length; i += 3) { const k = Math.min(K - 1, Math.floor((top - scanPos[i + 1]) / Math.max(1e-9, sh) * K)); const x = scanPos[i]; const w = ws[k] || (ws[k] = [Infinity, -Infinity]); if (x < w[0]) w[0] = x; if (x > w[1]) w[1] = x; }
  let maxW = 0, stop = K;
  for (let k = 0; k < K; k++) { if (!ws[k]) continue; const w = ws[k][1] - ws[k][0]; if (k > K * 0.15 && maxW > 0 && w > 1.3 * maxW) { stop = k; break; } if (w > maxW) maxW = w; }
  const bandW = maxW || (sb.mx[0] - sb.mn[0]), bandH = Math.min(sh * stop / K, bandW * ratio, sh);
  const sg = turn ? -1 : 1;
  let cx = 0, fz = sg > 0 ? -Infinity : Infinity, c = 0;
  for (let i = 0; i < scanPos.length; i += 3) if (scanPos[i + 1] >= top - bandH) { cx += scanPos[i]; c++; const z = scanPos[i + 2]; if (sg > 0 ? z > fz : z < fz) fz = z; }
  cx = c ? cx / c : (sb.mn[0] + sb.mx[0]) / 2;
  const s = hh / Math.max(1e-9, bandH);
  return { s, turn: !!turn, from: [cx, top, fz], to: [(box.mn[0] + box.mx[0]) / 2, box.mx[1], box.mx[2]], band: bandH };
}
/** a figure's head mask from its skin weights (the strongest bone per vertex) */
function maskOf(fig, n, tris) {
  const W = require("./dazBodyFit").weightsOf(fig, n), names = new Array(n);
  for (let i = 0; i < n; i++) names[i] = (fig.bones[W.dom[i]] || {}).id || "";
  return headMask(names, tris);
}
/** the head wrapped onto the aligned scan: BF.wrap at the head's scale (finer grid, shorter reach) -> {pos, moved} */
function wrapHead(o) {
  return require("./dazBodyFit").wrap({ pos: o.pos, tris: o.tris, trust: o.mask, scan: o.scan, cell: o.cell || 0.012, maxDist: o.maxDist || 0.03, iters: o.iters || 16, step: o.step || 0.6 });
}
module.exports = { HEAD, OFF, headMask, headBox, alignHead, maskOf, wrapHead, bare };
