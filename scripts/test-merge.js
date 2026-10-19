/* bitGen Studio — 2.486.0: AUTO-ALIGN LAYERS, AUTO-BLEND LAYERS, PHOTOMERGE, MERGE TO HDR (ext/imageeditdock/pcmerge.js) -
 * the image editor's gap, round F (part 2). Pure checks on made-up scenes with known answers. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, ".."), M = require(path.join(ROOT, "ext", "imageeditdock", "pcmerge.js"));
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); if (got !== undefined) console.log("      got " + JSON.stringify(got).slice(0, 400)); } }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// a busy made-up scene: a gradient, rectangles and discs in many colours
function scene(W, H, seed) {
  let s = seed || 7; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; d[i] = 60 + 100 * x / W; d[i + 1] = 80 + 80 * y / H; d[i + 2] = 120; d[i + 3] = 255; }
  for (let k = 0; k < 260; k++) {
    const cx = rnd() * W, cy = rnd() * H, r = 6 + rnd() * 28, col = [rnd() * 255, rnd() * 255, rnd() * 255], disc = rnd() < 0.35;
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(H, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(W, cx + r); x++) {
      if (disc && (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue; const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
    }
  }
  // a little grain, like a photo
  for (let i = 0; i < d.length; i++) { if ((i & 3) === 3) continue; d[i] += (rnd() - 0.5) * 24; }
  return { width: W, height: H, data: d };
}
function crop(im, x0, y0, w, h) { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) d.set(im.data.subarray(((y0 + y) * im.width + x0) * 4, ((y0 + y) * im.width + x0 + w) * 4), y * w * 4); return { width: w, height: h, data: d }; }
const err = (H, G, pts) => Math.max(...pts.map(([x, y]) => { const a = M.applyH(H, x, y), b = M.applyH(G, x, y); return Math.hypot(a[0] - b[0], a[1] - b[1]); }));

// --- matrices + fits
{
  const H = [1.1, 0.05, 20, -0.03, 0.95, -10, 0.0002, -0.0001, 1];
  const ok = M.mul3(H, M.inv3(H)).every((v, i) => Math.abs(v - [1, 0, 0, 0, 1, 0, 0, 0, 1][i]) < 1e-9);
  check("3 x 3: H x inverse(H) = identity", ok);
  const P = []; for (let k = 0; k < 12; k++) { const x = (k * 37) % 300, y = (k * 71) % 200; const [u, v] = M.applyH(H, x, y); P.push([u, v, x, y]); }
  const F = M.fitHomography(P), pts = [[0, 0], [300, 0], [300, 200], [0, 200], [150, 100]];
  check("homography: 12 exact pairs → the same homography (normalised DLT)", F && err(F, H, pts) < 1e-6, F);
  const Sm = [0.9 * Math.cos(0.2), -0.9 * Math.sin(0.2), 30, 0.9 * Math.sin(0.2), 0.9 * Math.cos(0.2), -5, 0, 0, 1], Q = [[0, 0], [100, 30], [40, 90], [200, 150]].map(([x, y]) => { const [u, v] = M.applyH(Sm, x, y); return [u, v, x, y]; });
  const Fs = M.fitSimilarity(Q);
  check("similarity: a turn of 0.2 rad, scale 0.9 and a move recovered", Fs && err(Fs, Sm, pts) < 1e-6, Fs);
  // RANSAC: 40 good pairs (1 px noise) + 25 wrong ones
  let s = 3; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const R = []; for (let k = 0; k < 40; k++) { const x = rnd() * 300, y = rnd() * 200, [u, v] = M.applyH(H, x, y); R.push([u + (rnd() - 0.5), v + (rnd() - 0.5), x, y]); }
  for (let k = 0; k < 25; k++) R.push([rnd() * 300, rnd() * 200, rnd() * 300, rnd() * 200]);
  const r = M.ransac(R, "homography", { thr: 2.5, w: 300, h: 200 });
  check("RANSAC: 40 good pairs among 25 wrong ones - the good ones kept, the homography within 1.5 px", r && r.inliers >= 38 && r.inliers <= 42 && err(r.H, H, pts) < 1.5, r && [r.inliers, err(r.H, H, pts)]);
  check("sane: a flipped or collapsed mapping is refused, a mild one accepted", M.sane(H, 300, 200) && !M.sane([1, 0, 0, 0, 0.001, 0, 0, 0, 1], 300, 200) && !M.sane([1, 0, 0, 0, -1, 0, 0, 0, 1], 300, 200));
}
const SC = scene(900, 500, 11);
// --- warp
{
  const id = M.warp(SC, M.I3(), 900, 500, 0, 0); let diff = 0; for (let i = 0; i < id.length; i++) diff = Math.max(diff, Math.abs(id[i] - SC.data[i]));
  check("warp: no change → the same picture", diff <= 1, diff);
  const mv = M.warp(SC, [1, 0, 10, 0, 1, 5, 0, 0, 1], 900, 500, 0, 0), i0 = (5 * 900 + 10) * 4;
  check("warp: moved 10 / 5 px - the pixel lands there, the uncovered edge is clear", mv[i0] === SC.data[0] && mv[i0 + 1] === SC.data[1] && mv[3] === 0, [mv[i0], SC.data[0], mv[3]]);
}
// --- registration
{
  const A = crop(SC, 0, 0, 500, 500), B = crop(SC, 300, 0, 500, 500), FA = M.features(A), FB = M.features(B);
  check(`corners + patches: plenty found on a busy picture (${FA.feats.length})`, FA.feats.length > 150);
  const r = M.register(FA, FB, "translation");
  check("register (move only): two crops 300 px apart → B sits 300 px right of A", r && Math.abs(r.H[2] - 300) < 1 && Math.abs(r.H[5]) < 1, r && r.H);
  const Sm = (() => { const a = 6 * Math.PI / 180, k = 0.92; return [k * Math.cos(a), -k * Math.sin(a), 60, k * Math.sin(a), k * Math.cos(a), 10, 0, 0, 1]; })();
  const T = { width: 500, height: 500, data: M.warp(A, Sm, 500, 500, 0, 0) };
  // fill the uncovered corners so the picture is opaque
  for (let i = 0; i < T.data.length; i += 4) if (T.data[i + 3] < 255) { T.data[i] = T.data[i + 1] = T.data[i + 2] = 128; T.data[i + 3] = 255; }
  const rs = M.register(M.features(T), FA, "similarity"), pts = [[100, 100], [400, 100], [400, 400], [100, 400]];
  check("register (move, turn, scale): turned 6°, scaled 0.92 → found within 1.5 px", rs && err(rs.H, Sm, pts) < 1.5, rs && err(rs.H, Sm, pts));
  const Hk = [0.95, 0.04, 30, -0.02, 1.0, 12, 0.00015, -0.0001, 1], Tp = { width: 500, height: 500, data: M.warp(A, Hk, 500, 500, 0, 0) };
  for (let i = 0; i < Tp.data.length; i += 4) if (Tp.data[i + 3] < 255) { Tp.data[i] = Tp.data[i + 1] = Tp.data[i + 2] = 128; Tp.data[i + 3] = 255; }
  const rh = M.register(M.features(Tp), FA, "homography");
  check("register (perspective): a known homography found within 2 px", rh && err(rh.H, Hk, pts) < 2, rh && err(rh.H, Hk, pts));
  const other = M.features(scene(500, 500, 999));
  check("register: two different pictures do not match", M.register(FA, other, "homography") === null && M.register(FA, other, "translation") === null);
}
// --- panorama placing + blending
{
  const parts = [crop(SC, 0, 20, 400, 460), crop(SC, 250, 0, 400, 480), crop(SC, 500, 30, 400, 450)];
  const P = M.placeAll(parts, "homography", {});
  check("placeAll: three overlapping crops → all placed on a 900 x 480 canvas (what they cover), the middle one as reference", P.unplaced.length === 0 && P.ref === 1 && Math.abs(P.W - 900) <= 3 && Math.abs(P.H - 480) <= 3, [P.W, P.H, P.unplaced]);
  const L = parts.map((im, k) => M.warp(im, P.mats[k], P.W, P.H, 0, 0));
  const masks = M.seamMasks(L, P.W, P.H, { feather: 4 });
  // composite bottom → top with the masks, compare with the scene
  const W = P.W, H = P.H, comp = new Float32Array(W * H * 3), cov = new Float32Array(W * H);
  L.forEach((d, k) => { for (let i = 0; i < W * H; i++) { const a = (d[i * 4 + 3] / 255) * (masks[k][i] / 255); for (let c = 0; c < 3; c++) comp[i * 3 + c] = comp[i * 3 + c] * (1 - a) + d[i * 4 + c] * a; cov[i] = cov[i] * (1 - a) + a; } });
  const ox = Math.round(-M.applyH(P.mats[1], 0, 0)[0] + 250), oy = Math.round(-M.applyH(P.mats[1], 0, 0)[1]);
  let bad = 0, n = 0, holes = 0;
  for (let y = 40; y < 460; y += 3) for (let x = 20; x < 880; x += 3) {
    const sx = x + ox, sy = y + oy; if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue; const i = sy * W + sx, j = (y * 900 + x) * 4; if (cov[i] < 0.99) holes++;
    n++; if (Math.abs(comp[i * 3] - SC.data[j]) + Math.abs(comp[i * 3 + 1] - SC.data[j + 1]) + Math.abs(comp[i * 3 + 2] - SC.data[j + 2]) > 45) bad++;
  }
  check("placeAll + warp + seam masks: the stitched picture matches the scene (≥ 97 % of points), no holes inside", n > 30000 && bad / n < 0.03 && holes === 0, { n, bad, holes });
  const owned = [0, 1, 2].map((k) => masks[k].reduce((a, v) => a + (v === 255 ? 1 : 0), 0));
  const mid = Math.round(M.applyH(P.mats[1], 200, 240)[0]) + Math.round(M.applyH(P.mats[1], 200, 240)[1]) * W;
  check("seam masks: each picture owns a share; the middle of the panorama comes from the middle picture", owned.every((v) => v > 30000) && masks[1][mid] === 255 && masks[0][mid] === 0, [owned, masks[1][mid]]);
}
// --- focus stacking
{
  const W = 200, H = 120, sharp = scene(W, H, 5); { let s = 9; for (let i = 0; i < W * H * 4; i++) { if ((i & 3) === 3) continue; s = (s * 1103515245 + 12345) & 0x7fffffff; sharp.data[i] += (s / 0x7fffffff - 0.5) * 70; } }
  const soft = { width: W, height: H, data: new Uint8ClampedArray(sharp.data) };
  for (let c = 0; c < 3; c++) { const ch = new Float32Array(W * H); for (let i = 0; i < W * H; i++) ch[i] = sharp.data[i * 4 + c]; const b = M.boxBlur(ch, W, H, 4, 2); for (let i = 0; i < W * H; i++) soft.data[i * 4 + c] = b[i]; }
  const A = new Uint8ClampedArray(sharp.data), B = new Uint8ClampedArray(sharp.data);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const src = x < W / 2 ? null : soft.data; if (src) for (let c = 0; c < 3; c++) A[i + c] = src[i + c]; if (x < W / 2) for (let c = 0; c < 3; c++) B[i + c] = soft.data[i + c]; }
  const m = M.stackMasks([A, B], W, H, { feather: 0 });
  let okA = 0, okB = 0, nA = 0, nB = 0;
  for (let y = 10; y < H - 10; y++) for (let x = 10; x < W - 10; x++) { if (Math.abs(x - W / 2) < 12) continue; const i = y * W + x; if (x < W / 2) { nA++; if (m[0][i] === 255 && m[1][i] === 0) okA++; } else { nB++; if (m[1][i] === 255) okB++; } }
  check("stack masks (focus): the sharp half of each layer is the one used (≥ 90 %)", okA / nA > 0.9 && okB / nB > 0.9, [okA / nA, okB / nB]);
}
// --- seamless tones
{
  const W = 100, H = 50, A = new Uint8ClampedArray(W * H * 4), B = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { const x = i % W; if (x < 70) { A[i * 4] = 200; A[i * 4 + 1] = 100; A[i * 4 + 2] = 50; A[i * 4 + 3] = 255; } if (x >= 30) { B[i * 4] = 140; B[i * 4 + 1] = 70; B[i * 4 + 2] = 35; B[i * 4 + 3] = 255; } }
  const g = M.gainMatch([A, B], W, H, [0, 1]);
  check("seamless tones: a layer 30 % darker is brought up to match (gain ≈ 1.43), the first left alone", Math.abs(g[1][0] - 200 / 140) < 0.02 && g[0][0] === 1 && Math.abs(B[(10 * W + 90) * 4] - 200) <= 2, [g, B[(10 * W + 90) * 4]]);
}
// --- exposure fusion
{
  const W = 160, H = 100, base = scene(W, H, 21), ex = (k) => ({ width: W, height: H, data: Uint8ClampedArray.from(base.data, (v, i) => ((i & 3) === 3 ? 255 : v * k)) });
  const G = M.lapPyr(Float32Array.from({ length: W * H }, (_, i) => (i * 37) % 255 / 255), W, H, 4);
  let cur = G[3].a; for (let l = 2; l >= 0; l--) { const u = M.up(cur, G[l + 1].w, G[l + 1].h, G[l].w, G[l].h); for (let i = 0; i < u.length; i++) u[i] += G[l].a[i]; cur = u; }
  check("Laplacian pyramid: collapsing it gives back the picture exactly", cur.every((v, i) => Math.abs(v - ((i * 37) % 255) / 255) < 1e-5));
  const same = M.fuseExposures([base, base, base]); let d0 = 0; for (let i = 0; i < same.length; i += 4) d0 = Math.max(d0, Math.abs(same[i] - base.data[i]));
  check("exposure fusion: three copies of one picture → that picture", d0 <= 2, d0);
  const dark = ex(0.35), mid = ex(1), bright = ex(2.2), out = M.fuseExposures([dark, mid, bright]);
  const clip = (d) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] >= 254 || d[i + 1] >= 254 || d[i + 2] >= 254) n++; return n / (d.length / 4); };
  const mean = (d) => { let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4) / 3; };
  check("exposure fusion: dark + normal + bright → far fewer blown-out pixels than the bright one, brighter than the dark one, opaque", clip(out) < clip(bright.data) * 0.5 && mean(out) > mean(dark.data) + 20 && out[3] === 255, [clip(out), clip(bright.data), mean(out), mean(dark.data)]);
}
// --- the wiring
{
  const ext = JSON.parse(read("ext/imageeditdock/ext.json")).scripts, ie = read("ext/imageeditdock/imageedit.js"), src = read("ext/imageeditdock/pcmerge.js");
  check("the wiring: pcmerge.js after pcfileplus.js, before imageedit.js; installed after PCFilePlus", ext.indexOf("pcmerge.js") > ext.indexOf("pcfileplus.js") && ext.indexOf("pcmerge.js") < ext.indexOf("imageedit.js") && ie.indexOf("win.PCMerge.install(E)") > ie.indexOf("win.PCFilePlus.install(E)"));
  check("no product names in what users read", !/Photoshop|Adobe|Corel|Illustrator|Lightroom/.test(src));
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
