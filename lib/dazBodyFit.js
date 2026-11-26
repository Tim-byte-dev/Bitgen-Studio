// bitGen Studio — lib/dazBodyFit.js (2.981.0): 📷 A DAZ BODY FROM A PHOTO, TWO WAYS (try both, keep the better one).
// Tim: "can we build the full daz body from a picture and transfer the uv as well?" -> "add both, user can try both and keep
// the better one" + "try the one they choose". NOT A REPLACEMENT FOR DAZ STUDIO - light tasks; Daz Studio is a very powerful
// character creator. The figure stays the user's own Daz mesh, so its UVs, rig, JCMs and clothing fit come with it; the photo
// is painted INTO those UVs.
//   A  FIT THE DIALS   the Vision model's body points + outline (BODY_PROMPT -> parseBody) -> features (proportions, pose-
//                      free: lengths / widths over the height) -> the figure's own body dials fitted (fitDials: bounded
//                      Levenberg-Marquardt over the dials, through the figure's formulas - controllers / ERCs count)
//   B  SCAN + WRAP     the photo -> a 3D shape (lib/to3d.js: Hunyuan3D 2.1 / TRELLIS.2) -> readGlbMesh -> alignScan (height,
//                      feet, centre, +Z front or turned) -> wrap() (non-rigid: nearest scan point along the normal, smoothed
//                      over the mesh, hands / feet / head trusted less) -> a custom morph <project>/dazmorphs/<name>.json
//   paintPhoto(ctx)    A's photos (front + back) projected into every body material's texture (an affine from the body
//                      points, facing-weighted, the colour moved toward the skin's)
//   paintScan(ctx)     B's scan colours baked into the figure's UVs (each texel -> the nearest scan triangle -> its UV)
// Pure + tested: parseBody, features, marks / measure, fitDials (test-981), alignScan / wrap / paint* (test-981e, ffmpeg).
"use strict";
const fs = require("fs");
const path = require("path");
const F = require("../static/dazformula.js");

const POINTS = ["top", "chin", "left_eye", "right_eye", "mouth", "l_shoulder", "r_shoulder", "l_elbow", "r_elbow", "l_wrist", "r_wrist", "l_hip", "r_hip", "l_knee", "r_knee", "l_ankle", "r_ankle", "chest_l", "chest_r", "waist_l", "waist_r", "hips_l", "hips_r"];
const BODY_PROMPT = "This photo shows one person, standing. Answer ONLY with JSON giving points as [x, y] with coordinates from 0 to 1000 "
  + "(0,0 = top left of the picture). 'l_' / '_l' = the PERSON'S left side (on the right of the picture when they face the camera). "
  + "{\"top\": the top of the head, \"chin\", \"left_eye\", \"right_eye\", \"mouth\", \"l_shoulder\", \"r_shoulder\" (the shoulder joints), "
  + "\"l_elbow\", \"r_elbow\", \"l_wrist\", \"r_wrist\", \"l_hip\", \"r_hip\" (the hip joints), \"l_knee\", \"r_knee\", \"l_ankle\", \"r_ankle\", "
  + "\"chest_l\", \"chest_r\" (the body's outline at the armpits), \"waist_l\", \"waist_r\" (the outline at the narrowest waist), "
  + "\"hips_l\", \"hips_r\" (the outline at the widest hips)}. Leave out a point you cannot see. Measure the body, not loose clothing.";

/** the Vision model's answer -> {name: [x, y]} in 0..1000 (0..1 rescaled; fences / <think> ignored); null without a body */
function parseBody(text) {
  const t = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const m = t.match(/\{[\s\S]*\}/); if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch (e) { return null; }
  const out = {};
  for (const k of POINTS) { const p = j[k]; if (!Array.isArray(p) || p.length < 2 || !isFinite(+p[0]) || !isFinite(+p[1])) continue; const unit = +p[0] <= 1.0001 && +p[1] <= 1.0001 ? 1000 : 1; out[k] = [Math.max(0, Math.min(1000, +p[0] * unit)), Math.max(0, Math.min(1000, +p[1] * unit))]; }
  return out.top && (out.l_ankle || out.r_ankle) && out.l_shoulder && out.r_shoulder ? out : null;
}
/** 0..1000 points + the picture's size -> pixel-proportional points (so a distance means the same both ways) */
const toPixels = (pts, w, h) => Object.fromEntries(Object.entries(pts || {}).map(([k, p]) => [k, [p[0] * (w || 1000) / 1000, p[1] * (h || 1000) / 1000]]));
const D2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const MID = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
/** proportions that do not care about the scale, the pose of a straight limb or which way y points: each over the height */
function features(p) {
  const f = {}, ank = p.l_ankle && p.r_ankle ? MID(p.l_ankle, p.r_ankle) : p.l_ankle || p.r_ankle; if (!p.top || !ank) return { H: 0, f };
  const H = D2(p.top, ank); if (!(H > 0)) return { H: 0, f };
  const side = (a, b, c) => { const L = ["l", "r"].map((s) => (p[s + a] && p[s + b] && p[s + c] ? D2(p[s + a], p[s + b]) + D2(p[s + b], p[s + c]) : null)).filter((x) => x != null); return L.length ? L.reduce((x, y) => x + y) / L.length : null; };
  if (p.l_shoulder && p.r_shoulder) f.shoulders = D2(p.l_shoulder, p.r_shoulder) / H;
  if (p.l_hip && p.r_hip) f.hip_joints = D2(p.l_hip, p.r_hip) / H;
  for (const k of ["chest", "waist", "hips"]) if (p[k + "_l"] && p[k + "_r"]) f[k] = D2(p[k + "_l"], p[k + "_r"]) / H;
  if (p.l_shoulder && p.r_shoulder && p.l_hip && p.r_hip) f.torso = D2(MID(p.l_shoulder, p.r_shoulder), MID(p.l_hip, p.r_hip)) / H;
  const arm = side("_shoulder", "_elbow", "_wrist"), leg = side("_hip", "_knee", "_ankle");
  if (arm != null) f.arm = arm / H;
  if (leg != null) f.leg = leg / H;
  if (p.chin) f.head = D2(p.top, p.chin) / H;
  return { H, f };
}

/* ---------------- the figure: where its points are (index sets of its vertices - the same vertices whatever the dials) */
const NOT_TORSO = /(arm|hand|shldr|shoulder|carpal|thumb|index|mid|ring|pinky|finger|head|eye|jaw|tongue|teeth|neck|brow|lip|ear|nose|cheek|toe|metatars)/;
const PARTS = { shoulder: /^(shldr(bend)?|upperarm|shoulder)$/, elbow: /^(forearm(bend)?|lowerarm|elbow)$/, wrist: /^hand$/, hip: /^(thigh(bend)?|upperleg)$/, knee: /^(shin|calf|lowerleg|knee)$/, ankle: /^foot$/ };
const norm = (id) => String(id || "").toLowerCase().replace(/[_\s.-]/g, "");
function sideOf(id) { const n = norm(id); return /^left/.test(n) ? "l" : /^right/.test(n) ? "r" : /^l(?=[a-z])/.test(n) ? "l" : /^r(?=[a-z])/.test(n) ? "r" : ""; }
const bare = (id) => norm(id).replace(/^(left|right|l|r)(?=[a-z])/, "");
function findBone(bones, side, rx) { return bones.find((b) => sideOf(b.id) === side && rx.test(bare(b.id)) && !/twist/.test(bare(b.id))) || null; }
/** per vertex: its strongest bone (index into bones) + every bone's weights */
function weightsOf(fig, n) {
  const idx = new Map(fig.bones.map((b, i) => [b.id, i])), dom = new Int32Array(n).fill(-1), best = new Float32Array(n), W = new Map();
  for (const jt of (fig.skin && fig.skin.joints) || []) {
    const id = String(jt.node || "").split("#").pop().replace(/%20/g, " "), bi = idx.has(id) ? idx.get(id) : -1, m = new Map();
    for (const [v, w] of ((jt.node_weights || {}).values || [])) { if (v >= n || !(w > 0)) continue; m.set(v, w); if (w > best[v] && bi >= 0) { best[v] = w; dom[v] = bi; } }
    W.set(id, m);
  }
  return { dom, W };
}
/** pos (x, y, z per vertex, any unit; unit = metres per pos unit x 100 ... i.e. 1 for cm, 0.01 for metres) -> {sets {name: [vertex]}, pairs} */
function marks(fig, pos, unit, wts) {
  const n = pos.length / 3, u = unit || 1, B = fig.bones, w = wts || weightsOf(fig, n), sets = {}, P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const C = (b) => [b.center[0] * u, b.center[1] * u, b.center[2] * u];
  const near = (b, R) => {
    const c = C(b), m = w.W.get(b.id) || new Map(), out = [];
    for (const [v, wt] of m) { const d = Math.hypot(pos[v * 3] - c[0], pos[v * 3 + 1] - c[1], pos[v * 3 + 2] - c[2]); if (wt > 0.05 && d < R) out.push([d, v]); }
    if (out.length >= 3) { out.sort((a, b2) => a[0] - b2[0]); const d0 = out[0][0]; return out.filter((x) => x[0] <= d0 + Math.max(0.3 * u, 0.15 * d0)).slice(0, 24).map((x) => x[1]); }   // the ring round the joint
    const all = []; for (let i = 0; i < n; i++) all.push([Math.hypot(pos[i * 3] - c[0], pos[i * 3 + 1] - c[1], pos[i * 3 + 2] - c[2]), i]);
    return all.sort((a, b2) => a[0] - b2[0]).slice(0, 6).map((x) => x[1]);
  };
  for (const s of ["l", "r"]) for (const [part, rx] of Object.entries(PARTS)) {
    const b = findBone(B, s, rx); if (!b) continue;
    const kid = B.find((k) => k.parent === b.id), len = kid ? Math.hypot(kid.center[0] - b.center[0], kid.center[1] - b.center[1], kid.center[2] - b.center[2]) * u : 10 * u;
    sets[s + "_" + part] = near(b, Math.max(2.5 * u, 0.3 * len));
  }
  const head = B.find((b) => bare(b.id) === "head");
  if (head) {
    const hi = B.indexOf(head), hv = []; for (let i = 0; i < n; i++) if (w.dom[i] === hi || /jaw/.test(bare((B[w.dom[i]] || {}).id))) hv.push(i);
    if (hv.length) {
      let ymax = -Infinity; for (const i of hv) ymax = Math.max(ymax, pos[i * 3 + 1]);
      sets.top = hv.filter((i) => pos[i * 3 + 1] > ymax - 0.6 * u);
      const hc = C(head), front = hv.filter((i) => Math.abs(pos[i * 3] - hc[0]) < 2.5 * u && pos[i * 3 + 2] > hc[2]);
      sets.chin = (front.length ? front : hv).sort((a, b) => pos[a * 3 + 1] - pos[b * 3 + 1]).slice(0, 6);
    }
  }
  // the outline: torso vertices (not arms / head / neck) in a thin slice at the chest, the narrowest waist, the widest hips
  const mean = (L) => { const o = [0, 0, 0]; for (const i of L) { o[0] += pos[i * 3]; o[1] += pos[i * 3 + 1]; o[2] += pos[i * 3 + 2]; } return o.map((x) => x / Math.max(1, L.length)); };
  if (sets.l_shoulder && sets.r_shoulder && sets.l_hip && sets.r_hip) {
    const ysh = (mean(sets.l_shoulder)[1] + mean(sets.r_shoulder)[1]) / 2, yhp = (mean(sets.l_hip)[1] + mean(sets.r_hip)[1]) / 2, span = ysh - yhp;
    const torso = []; for (let i = 0; i < n; i++) { const b = B[w.dom[i]]; if (b && !NOT_TORSO.test(bare(b.id))) torso.push(i); }
    const slice = (y) => { const L = torso.filter((i) => Math.abs(pos[i * 3 + 1] - y) < 1.5 * u).sort((a, b) => pos[a * 3] - pos[b * 3]); return L.length >= 6 ? { l: L.slice(0, 1), r: L.slice(-1), w: pos[L[L.length - 1] * 3] - pos[L[0] * 3] } : null; };   // the outline = the outermost vertex
    const pick = (lo, hi, wantMax) => { let best = null; for (let k = 0; k <= 8; k++) { const s2 = slice(yhp + span * (lo + (hi - lo) * k / 8)); if (s2 && (!best || (wantMax ? s2.w > best.w : s2.w < best.w))) best = s2; } return best; };
    const ch = slice(ysh - 0.2 * span), wa = pick(0.3, 0.6, false), hp = pick(-0.25, 0.12, true);
    if (ch) { sets.chest_l = ch.l; sets.chest_r = ch.r; }
    if (wa) { sets.waist_l = wa.l; sets.waist_r = wa.r; }
    if (hp) { sets.hips_l = hp.l; sets.hips_r = hp.r; }
  }
  return { sets, w };
}
/** the points now (front view: x, y) from a marks' sets and positions */
function measure(sets, pos) {
  const out = {};
  for (const [k, L] of Object.entries(sets)) { if (!L.length) continue; let x = 0, y = 0; for (const i of L) { x += pos[i * 3]; y += pos[i * 3 + 1]; } out[k] = [x / L.length, y / L.length]; }
  return out;
}

/* ---------------- A: fit the figure's own body dials */
const BODY_WORDS = /height|weight|heavy|thin|emaciat|fat|portly|pear|apple|voluptu|fitness|bodybuild|muscul|tone|proportion|length|width|shoulder|waist|hip|chest|torso|thigh|calf|leg|arm|neck|glute|belly|stomach|tall|short|build|figure|body/i;
const NOT_BODY = /head|face|eye|nose|mouth|lip|ear\b|brow|cheek|jaw|chin|finger|thumb|toe|hand|foot|feet|pjcm|jcm|expression|^ctrlmd|phm|pbm|nail|teeth|tongue|navel|nipple|genital|breast ?(size|depth)|areola|iris|pupil/i;
/** the dials that may shape a body: visible, body words, nothing of the face / hands / JCMs (their own figure's) */
function bodyDials(ix) {
  const out = [];
  for (const [id, m] of ix.mods) {
    if (!m.visible || m.node) continue;
    const words = (m.label || "") + " " + id + " " + (m.group || "");
    if (!BODY_WORDS.test(words) || NOT_BODY.test(words)) continue;
    if (!m.morph && !(ix.formulas || []).some((f) => f.ops.some((o) => o.k === "m:" + id))) continue;   // a controller that drives nothing
    out.push({ id, label: m.label, min: m.min != null ? Math.max(-1, m.min) : 0, max: m.max != null ? Math.min(1.5, m.max) : 1 });
  }
  return out;
}
function solveLin(A, b) {
  const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let q = c; q <= n; q++) M[r][q] -= k * M[c][q]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
/** bounded Levenberg-Marquardt: x in [lo, hi], resid(x) -> number[] */
function lm(x0, lo, hi, resid, iters) {
  const clamp = (x) => x.map((v, i) => Math.max(lo[i], Math.min(hi[i], v)));
  let x = clamp(x0), r = resid(x), c = r.reduce((s, v) => s + v * v, 0), mu = 1e-2, n = x.length;
  for (let it = 0; it < (iters || 30) && n; it++) {
    const J = [];
    for (let j = 0; j < n; j++) { const h = x[j] + 0.02 <= hi[j] ? 0.02 : -0.02, xp = x.slice(); xp[j] += h; const rp = resid(xp); J.push(rp.map((v, k) => (v - r[k]) / h)); }
    const A = [], g = [];
    for (let i = 0; i < n; i++) { A.push([]); g.push(J[i].reduce((s, v, k) => s + v * r[k], 0)); for (let j = 0; j < n; j++) A[i].push(J[i].reduce((s, v, k) => s + v * J[j][k], 0)); }
    let ok = false;
    for (let t = 0; t < 8; t++) {
      const Am = A.map((row, i) => row.map((v, j) => (i === j ? v + mu * (v + 1e-6) : v))), d = solveLin(Am, g.map((v) => -v));
      if (!d) { mu *= 4; continue; }
      const xn = clamp(x.map((v, i) => v + d[i])), rn = resid(xn), cn = rn.reduce((s, v) => s + v * v, 0);
      if (cn < c - 1e-12) { x = xn; r = rn; c = cn; mu = Math.max(1e-6, mu / 3); ok = true; break; }
      mu *= 4;
    }
    if (!ok) break;
  }
  return { x, cost: c };
}
/** o = {fig, ix, set0 {id: v}, target {feature: value}, heightCm, dials (bodyDials), iters, reg}
 *  -> {set {id: v} (the fitted dials, set0's others kept), changed [{id, label, from, to}], before, after, error {before, after}} */
function fitDials(o) {
  const DM = require("./dazMuscle"), fig = o.fig, ix = o.ix, model = DM.modelOf(ix), set0 = Object.assign({}, o.set0 || {});
  const V = (fig.geo.vertices || {}).values || [], n = V.length, base = new Float64Array(n * 3);
  V.forEach((p, i) => { base[i * 3] = p[0]; base[i * 3 + 1] = p[1]; base[i * 3 + 2] = p[2]; });
  // the shape now (every morph with a value at rest), the marks chosen on it
  const rest0 = F.evaluate(model, { set: set0 }), dCache = new Map();
  const deltas = (id) => { if (!dCache.has(id)) { const m = ix.mods.get(id); dCache.set(id, m && m.morph ? DM.deltasOf(m) : []); } return dCache.get(id); };
  const now = Float64Array.from(base);
  for (const [id, v] of Object.entries(rest0)) if (v && (ix.mods.get(id) || {}).morph) for (const d of deltas(id)) if (d[0] < n) { now[d[0] * 3] += d[1] * v; now[d[0] * 3 + 1] += d[2] * v; now[d[0] * 3 + 2] += d[3] * v; }
  const mk = marks(fig, now, 1), S = [...new Set([].concat(...Object.values(mk.sets)))], at = new Map(S.map((v, k) => [v, k]));
  const cands = (o.dials || bodyDials(ix)).slice(0, 80);
  // what each dial reaches (through the formulas), the deltas of those on the marked vertices only
  const reach = new Set(Object.keys(rest0).filter((id) => rest0[id] && (ix.mods.get(id) || {}).morph));
  for (const c of cands) { const e = F.evaluate(model, { set: Object.assign({}, set0, { [c.id]: (+set0[c.id] || 0) + 0.5 }) }); for (const id of Object.keys(e)) if (Math.abs((e[id] || 0) - (rest0[id] || 0)) > 1e-9 && (ix.mods.get(id) || {}).morph) reach.add(id); }
  const dS = new Map();
  for (const id of reach) { const L = []; for (const d of deltas(id)) { const k = at.get(d[0]); if (k != null) L.push([k, d[1], d[2], d[3]]); } if (L.length) dS.set(id, L); }
  const posAt = (set) => {
    const r = F.evaluate(model, { set }), P = new Float64Array(S.length * 3);
    S.forEach((v, k) => { P[k * 3] = base[v * 3]; P[k * 3 + 1] = base[v * 3 + 1]; P[k * 3 + 2] = base[v * 3 + 2]; });
    for (const [id, L] of dS) { const w = r[id] || 0; if (!w) continue; for (const d of L) { P[d[0] * 3] += d[1] * w; P[d[0] * 3 + 1] += d[2] * w; P[d[0] * 3 + 2] += d[3] * w; } }
    const sets = Object.fromEntries(Object.entries(mk.sets).map(([k, L]) => [k, L.map((v) => at.get(v))]));
    return { pts: measure(sets, P) };
  };
  const target = o.target || {}, keys = Object.keys(target).filter((k) => isFinite(target[k]));
  const featOf = (set) => { const m = features(posAt(set).pts); return m; };
  const f0 = featOf(set0);
  // the dials that move a feature at all (the 30 that move them most)
  const moved = cands.map((c) => { const s = Object.assign({}, set0, { [c.id]: Math.min(c.max, (+set0[c.id] || 0) + 0.3) }), f = featOf(s); return { c, g: keys.reduce((t, k) => t + Math.abs((f.f[k] || 0) - (f0.f[k] || 0)), 0) + (o.heightCm ? Math.abs(f.H - f0.H) / Math.max(1, f0.H) : 0) }; })
    .filter((x) => x.g > 1e-5).sort((a, b) => b.g - a.g).slice(0, o.max || 30).map((x) => x.c);
  const reg = o.reg != null ? o.reg : 0.03, x0 = moved.map((c) => +set0[c.id] || 0);
  const setOf = (x) => { const s = Object.assign({}, set0); moved.forEach((c, i) => { s[c.id] = x[i]; }); return s; };
  const resid = (x) => {
    const m = featOf(setOf(x)), r = keys.map((k) => ((m.f[k] || 0) - target[k]) / Math.max(0.02, target[k]) * 3);
    if (o.heightCm) r.push((m.H - o.heightCm) / o.heightCm * 4);
    x.forEach((v, i) => r.push((v - x0[i]) * reg));
    return r;
  };
  const err = (f) => Math.sqrt(keys.reduce((t, k) => t + Math.pow(((f.f[k] || 0) - target[k]) / Math.max(0.02, target[k]), 2), 0) / Math.max(1, keys.length));
  const res = lm(x0, moved.map((c) => c.min), moved.map((c) => c.max), resid, o.iters || 30);
  const set = setOf(res.x.map((v) => Math.round(v * 1000) / 1000)), f1 = featOf(set);
  const changed = moved.map((c, i) => ({ id: c.id, label: c.label, from: x0[i], to: set[c.id] })).filter((x) => Math.abs(x.to - x.from) > 0.005);
  return { set, changed, before: f0.f, after: f1.f, height: { before: f0.H, after: f1.H }, error: { before: err(f0), after: err(f1) }, dials: moved.length, keys };
}

/* ---------------- B: a scan, aligned and wrapped */
const TYPE_N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function accRead(J, bin, ai) {
  const a = J.accessors[ai], n = TYPE_N[a.type], out = new Float64Array(a.count * n);
  const CT = { 5120: [1, "getInt8"], 5121: [1, "getUint8"], 5122: [2, "getInt16"], 5123: [2, "getUint16"], 5125: [4, "getUint32"], 5126: [4, "getFloat32"] }[a.componentType];
  if (a.bufferView != null) {
    const bv = J.bufferViews[a.bufferView], st = bv.byteStride || CT[0] * n, dv = new DataView(bin.buffer, bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0));
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = dv[CT[1]](i * st + k * CT[0], true);
    if (a.normalized) { const s = { 5121: 255, 5123: 65535, 5120: 127, 5122: 32767 }[a.componentType]; if (s) for (let i = 0; i < out.length; i++) out[i] /= s; }
  }
  return out;
}
function mat4(node) {
  if (node.matrix) return node.matrix.slice();
  const t = node.translation || [0, 0, 0], q = node.rotation || [0, 0, 0, 1], s = node.scale || [1, 1, 1], [x, y, z, w] = q;
  return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0, 2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1];
}
const mmul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
/** a .glb -> one mesh in world space {pos, tris, uv | null, tex {data, mime} | null} (every primitive of every node) */
function readGlbMesh(buf) {
  const G = require("./glbMerge").parse(buf), J = G.json, bin = G.bin, pos = [], tris = [], uv = []; let tex = null, hasUv = true;
  const visit = (ni, M) => {
    const nd = J.nodes[ni], W = mmul(M, mat4(nd));
    if (nd.mesh != null) for (const pr of J.meshes[nd.mesh].primitives) {
      if (pr.attributes.POSITION == null) continue;
      const P = accRead(J, bin, pr.attributes.POSITION), b = pos.length / 3, nv = P.length / 3;
      for (let i = 0; i < nv; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; pos.push(W[0] * x + W[4] * y + W[8] * z + W[12], W[1] * x + W[5] * y + W[9] * z + W[13], W[2] * x + W[6] * y + W[10] * z + W[14]); }
      if (pr.attributes.TEXCOORD_0 != null) uv.push(...accRead(J, bin, pr.attributes.TEXCOORD_0)); else { hasUv = false; for (let i = 0; i < nv; i++) uv.push(0, 0); }
      const I = pr.indices != null ? accRead(J, bin, pr.indices) : Array.from({ length: nv }, (_, i) => i);
      for (const i of I) tris.push(b + i);
      if (!tex && pr.material != null) {
        const m = J.materials[pr.material] || {}, ti = ((m.pbrMetallicRoughness || {}).baseColorTexture || {}).index, img = ti != null && J.textures[ti] && J.images[J.textures[ti].source];
        if (img && img.bufferView != null) { const bv = J.bufferViews[img.bufferView]; tex = { data: Buffer.from(bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)), mime: img.mimeType || "image/png" }; }
      }
    }
    for (const c of nd.children || []) visit(c, W);
  };
  const sc = (J.scenes || [])[J.scene || 0], roots = sc ? sc.nodes : (J.nodes || []).map((_, i) => i);
  for (const r of roots || []) visit(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return { pos: Float64Array.from(pos), tris: Uint32Array.from(tris), uv: hasUv ? Float64Array.from(uv) : null, tex };
}
const bbox = (P) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < P.length; i++) { const k = i % 3; if (P[i] < mn[k]) mn[k] = P[i]; if (P[i] > mx[k]) mx[k] = P[i]; } return { mn, mx }; };
/** the scan onto the body: the same height, feet on the body's feet, the same centre; turn = the scan faces -Z (180° round Y) */
function alignScan(scanPos, bodyPos, turn) {
  const a = bbox(scanPos), b = bbox(bodyPos), s = (b.mx[1] - b.mn[1]) / Math.max(1e-9, a.mx[1] - a.mn[1]), c = [(a.mn[0] + a.mx[0]) / 2, (a.mn[2] + a.mx[2]) / 2], bc = [(b.mn[0] + b.mx[0]) / 2, (b.mn[2] + b.mx[2]) / 2];
  return { s, turn: !!turn, from: [c[0], a.mn[1], c[1]], to: [bc[0], b.mn[1], bc[1]] };
}
function applyAlign(P, al) {
  const out = new Float64Array(P.length), sg = al.turn ? -1 : 1;
  for (let i = 0; i < P.length; i += 3) { out[i] = al.to[0] + sg * (P[i] - al.from[0]) * al.s; out[i + 1] = al.to[1] + (P[i + 1] - al.from[1]) * al.s; out[i + 2] = al.to[2] + sg * (P[i + 2] - al.from[2]) * al.s; }
  return out;
}
/** non-rigid fit: the body's vertices pulled to the nearest scan point along their normals, the pull smoothed over the mesh;
 *  trust (0..1 per vertex) = how much a vertex may follow the scan (hands / feet / face less). -> {pos, moved (metres, mean)} */
function wrap(o) {
  const P = Float64Array.from(o.pos), n = P.length / 3, T = o.tris, trust = o.trust || new Float32Array(n).fill(1), CS = require("./clothSim");
  const sp = o.scan, pts = [], sP = sp.pos, sT = sp.tris;
  for (let i = 0; i < sP.length; i++) pts.push(sP[i]);
  for (let t = 0; t < sT.length; t += 3) for (let k = 0; k < 3; k++) pts.push((sP[sT[t] * 3 + k] + sP[sT[t + 1] * 3 + k] + sP[sT[t + 2] * 3 + k]) / 3);
  const SP = Float32Array.from(pts), cell = o.cell || 0.04, H = new CS.Hash(SP, cell), maxD = o.maxDist || 0.08;
  const nb = Array.from({ length: n }, () => new Set()); for (let t = 0; t < T.length; t += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) nb[T[t + a]].add(T[t + b]);
  const NB = nb.map((s) => [...s]), start = Float64Array.from(P), iters = o.iters || 14;
  for (let it = 0; it < iters; it++) {
    const N = CS.vertexNormals(Float32Array.from(P), Array.from(T)), D = new Float64Array(n * 3), Wt = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (!(trust[i] > 0)) continue;
      const j = H.near(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); if (j < 0) continue;
      const d = [SP[j * 3] - P[i * 3], SP[j * 3 + 1] - P[i * 3 + 1], SP[j * 3 + 2] - P[i * 3 + 2]], L = Math.hypot(d[0], d[1], d[2]); if (L > maxD) continue;
      const nn = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]], dn = d[0] * nn[0] + d[1] * nn[1] + d[2] * nn[2];
      for (let k = 0; k < 3; k++) D[i * 3 + k] = (0.75 * nn[k] * dn + 0.25 * d[k]) * trust[i];
      Wt[i] = trust[i];
    }
    // smooth the pull (more at first - the big shape - less later - the detail)
    const rounds = Math.max(2, Math.round(12 * (1 - it / iters)));
    for (let r = 0; r < rounds; r++) {
      const E = new Float64Array(n * 3);
      for (let i = 0; i < n; i++) { const L = NB[i]; if (!L.length) { for (let k = 0; k < 3; k++) E[i * 3 + k] = D[i * 3 + k]; continue; } let s0 = 0, s1 = 0, s2 = 0; for (const q of L) { s0 += D[q * 3]; s1 += D[q * 3 + 1]; s2 += D[q * 3 + 2]; } const m = 1 / L.length; E[i * 3] = 0.5 * D[i * 3] + 0.5 * s0 * m; E[i * 3 + 1] = 0.5 * D[i * 3 + 1] + 0.5 * s1 * m; E[i * 3 + 2] = 0.5 * D[i * 3 + 2] + 0.5 * s2 * m; }
      D.set(E);
    }
    const step = o.step || 0.6;
    for (let i = 0; i < n * 3; i++) P[i] += D[i] * step;
  }
  let mv = 0; for (let i = 0; i < n; i++) mv += Math.hypot(P[i * 3] - start[i * 3], P[i * 3 + 1] - start[i * 3 + 1], P[i * 3 + 2] - start[i * 3 + 2]);
  return { pos: P, moved: mv / Math.max(1, n) };
}
/** how much each vertex may follow a scan: hands / fingers / feet / toes 0.15, the head 0.4, the rest 1 */
function trustOf(fig, n) {
  const w = weightsOf(fig, n), t = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) { const b = bare((fig.bones[w.dom[i]] || {}).id); if (/hand|carpal|thumb|index|mid|ring|pinky|finger|foot|toe|metatars/.test(b)) t[i] = 0.15; else if (/head|eye|jaw|tongue|teeth|brow|lip|nose|cheek|ear/.test(b)) t[i] = 0.4; }
  return t;
}

/* ---------------- painting into the figure's own UVs */
/** every texel of the body triangles of one material: fn(texelIndex, X, Y, Z, nx, ny, nz) (the shaped body, its normals) */
function rasterise(body, tris, tex, nrm, fn) {
  const P = body.shaped;
  for (let t = 0; t < tris.length; t += 3) {
    const c = [tris[t], tris[t + 1], tris[t + 2]], v = c.map((q) => body.src[q]);
    const uv = c.map((q) => body.UV[body.uvi[q]] || [0, 0]).map((u) => [u[0] * tex.w, (1 - u[1]) * tex.h]);
    const x0 = Math.max(0, Math.floor(Math.min(uv[0][0], uv[1][0], uv[2][0]))), x1 = Math.min(tex.w - 1, Math.ceil(Math.max(uv[0][0], uv[1][0], uv[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(uv[0][1], uv[1][1], uv[2][1]))), y1 = Math.min(tex.h - 1, Math.ceil(Math.max(uv[0][1], uv[1][1], uv[2][1])));
    const den = (uv[1][1] - uv[2][1]) * (uv[0][0] - uv[2][0]) + (uv[2][0] - uv[1][0]) * (uv[0][1] - uv[2][1]); if (!den) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const a = ((uv[1][1] - uv[2][1]) * (x + 0.5 - uv[2][0]) + (uv[2][0] - uv[1][0]) * (y + 0.5 - uv[2][1])) / den, b = ((uv[2][1] - uv[0][1]) * (x + 0.5 - uv[2][0]) + (uv[0][0] - uv[2][0]) * (y + 0.5 - uv[2][1])) / den, g = 1 - a - b;
      if (a < -0.01 || b < -0.01 || g < -0.01) continue;
      const at = (k, A) => a * A[v[0] * 3 + k] + b * A[v[1] * 3 + k] + g * A[v[2] * 3 + k];
      fn((y * tex.w + x) * 4, at(0, P), at(1, P), at(2, P), at(0, nrm), at(1, nrm), at(2, nrm));
    }
  }
}
const SKIP_MAT = /eye|cornea|iris|pupil|sclera|moisture|lacrimal|tear|teeth|tongue|mouth|gums|nail|lash|brow/i;
/** least-squares 2D affine: from [[x, y]] to [[u, v]] -> f([x, y]) -> [u, v] (null with fewer than 3 points) */
function affine(from, to) {
  if (from.length < 3) return null;
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bu = [0, 0, 0], bv = [0, 0, 0];
  from.forEach((p, i) => { const r = [p[0], p[1], 1]; for (let a = 0; a < 3; a++) { for (let b = 0; b < 3; b++) A[a][b] += r[a] * r[b]; bu[a] += r[a] * to[i][0]; bv[a] += r[a] * to[i][1]; } });
  const cu = solveLin(A.map((r) => r.slice()), bu), cv = solveLin(A.map((r) => r.slice()), bv); if (!cu || !cv) return null;
  return (p) => [cu[0] * p[0] + cu[1] * p[1] + cu[2], cv[0] * p[0] + cv[1] * p[1] + cv[2]];
}
/** A's photos into the body's textures. ctx = {pieces, M, fig, photos [{file, points (0..1000), side "front" | "back"}], maxTex}
 *  -> {textures {key: {data, mime}}, summary} */
function paintPhoto(ctx) {
  const FC = require("./dazFace"), DL = require("./dazLib"), body = ctx.M[0], p0 = ctx.pieces[0], P = body.shaped, n = P.length / 3;
  const allTris = [].concat(...[...body.byMat.values()]).map((c) => body.src[c]), nrm = require("./clothSim").vertexNormals(P, allTris);
  const mk = marks(ctx.fig, P, 0.01), model = measure(mk.sets, P), shots = [];
  for (const ph of ctx.photos || []) {
    if (!ph || !ph.file || !ph.points) continue;
    const img = FC.readRgba(ph.file, 1600), pts = ph.points, from = [], to = [];
    for (const k of Object.keys(model)) if (pts[k]) { from.push(model[k]); to.push([pts[k][0] * img.w / 1000, pts[k][1] * img.h / 1000]); }
    const map = affine(from, to); if (map) shots.push({ img, map, back: ph.side === "back" });
  }
  const textures = {}, done = [];
  if (!shots.length) return { textures, summary: { materials: done, note: "no photo with enough body points" } };
  for (const [gi, tris] of body.byMat) {
    const gname = body.mats[gi] || ""; if (SKIP_MAT.test(gname)) continue;
    const tf = DL.textureOf(p0.mats, gname, p0.file); if (!tf) continue;
    const tex = FC.readRgba(tf, Math.min(4096, +ctx.maxTex || 2048)), hits = [], sumT = [0, 0, 0], sumP = [0, 0, 0]; let nS = 0;
    rasterise(body, tris, tex, nrm, (ti, X, Y, Z, nx, ny, nz) => {
      for (const s of shots) {
        const f = s.back ? -nz : nz; if (f <= 0.25) continue;
        const q = s.map([X, Y]), px = Math.round(q[0]), py = Math.round(q[1]); if (px < 0 || py < 0 || px >= s.img.w || py >= s.img.h) continue;
        const w = Math.pow(Math.min(1, (f - 0.25) / 0.45), 2) * 0.92, pi = (py * s.img.w + px) * 4;
        hits.push(ti, w, s.img.d[pi], s.img.d[pi + 1], s.img.d[pi + 2]);
        for (let k = 0; k < 3; k++) { sumT[k] += tex.d[ti + k]; sumP[k] += s.img.d[pi + k]; } nS++;
      }
    });
    if (!nS) continue;
    const gain = sumT.map((s2, i) => Math.max(0.8, Math.min(1.25, s2 / Math.max(1, sumP[i]))));
    for (let h = 0; h < hits.length; h += 5) { const ti = hits[h], w = hits[h + 1]; for (let k = 0; k < 3; k++) tex.d[ti + k] = Math.round(tex.d[ti + k] * (1 - w) + Math.min(255, hits[h + 2 + k] * gain[k]) * w); }
    textures[p0.file + "|" + gname] = { data: FC_png(tex), mime: "image/png" }; done.push(gname + " (" + nS + " texels)");
  }
  void n;
  return { textures, summary: { materials: done, photos: shots.length } };
}
function FC_png(img) {
  const r = require("child_process").spawnSync("ffmpeg", ["-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", img.w + "x" + img.h, "-i", "-", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], { input: img.d, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error("could not write the painted texture");
  return r.stdout;
}
/** B's scan colours into the body's textures. ctx = {pieces, M, scan (readGlbMesh), align, maxTex} */
function paintScan(ctx) {
  const FC = require("./dazFace"), DL = require("./dazLib"), CS = require("./clothSim"), body = ctx.M[0], p0 = ctx.pieces[0], P = body.shaped;
  const sc = ctx.scan; if (!sc || !sc.tex || !sc.uv) return { textures: {}, summary: { materials: [], note: "the scan has no colour picture" } };
  const SP = applyAlign(sc.pos, ctx.align), T = sc.tris, cen = new Float32Array(T.length);
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) cen[t + k] = (SP[T[t] * 3 + k] + SP[T[t + 1] * 3 + k] + SP[T[t + 2] * 3 + k]) / 3;
  const H = new CS.Hash(cen, 0.03), tmp = path.join(require("os").tmpdir(), "bitgen_scan_" + process.pid + "_" + Date.now() + (sc.tex.mime === "image/jpeg" ? ".jpg" : ".png"));
  fs.writeFileSync(tmp, sc.tex.data); let simg; try { simg = FC.readRgba(tmp, 2048); } finally { try { fs.unlinkSync(tmp); } catch (e) { /* fine */ } }
  const allTris = [].concat(...[...body.byMat.values()]).map((c) => body.src[c]), nrm = CS.vertexNormals(P, allTris), textures = {}, done = [];
  for (const [gi, tris] of body.byMat) {
    const gname = body.mats[gi] || ""; if (SKIP_MAT.test(gname)) continue;
    const tf = DL.textureOf(p0.mats, gname, p0.file); if (!tf) continue;
    const tex = FC.readRgba(tf, Math.min(4096, +ctx.maxTex || 2048)); let nS = 0;
    rasterise(body, tris, tex, nrm, (ti, X, Y, Z) => {
      const j = H.near(X, Y, Z); if (j < 0) return;
      const t = j * 3, a = [SP[T[t] * 3], SP[T[t] * 3 + 1], SP[T[t] * 3 + 2]], b = [SP[T[t + 1] * 3], SP[T[t + 1] * 3 + 1], SP[T[t + 1] * 3 + 2]], c = [SP[T[t + 2] * 3], SP[T[t + 2] * 3 + 1], SP[T[t + 2] * 3 + 2]];
      const bc = baryOf([X, Y, Z], a, b, c), d = Math.hypot(X - (bc[0] * a[0] + bc[1] * b[0] + bc[2] * c[0]), Y - (bc[0] * a[1] + bc[1] * b[1] + bc[2] * c[1]), Z - (bc[0] * a[2] + bc[1] * b[2] + bc[2] * c[2]));
      if (d > 0.04) return;
      const w = (1 - d / 0.04) * 0.95, U = sc.uv, u = bc[0] * U[T[t] * 2] + bc[1] * U[T[t + 1] * 2] + bc[2] * U[T[t + 2] * 2], vv = bc[0] * U[T[t] * 2 + 1] + bc[1] * U[T[t + 1] * 2 + 1] + bc[2] * U[T[t + 2] * 2 + 1];
      const px = Math.max(0, Math.min(simg.w - 1, Math.floor((u - Math.floor(u)) * simg.w))), py = Math.max(0, Math.min(simg.h - 1, Math.floor((vv - Math.floor(vv)) * simg.h))), pi = (py * simg.w + px) * 4;
      for (let k = 0; k < 3; k++) tex.d[ti + k] = Math.round(tex.d[ti + k] * (1 - w) + simg.d[pi + k] * w);
      nS++;
    });
    if (!nS) continue;
    textures[p0.file + "|" + gname] = { data: FC_png(tex), mime: "image/png" }; done.push(gname + " (" + nS + " texels)");
  }
  return { textures, summary: { materials: done } };
}
/** the barycentric weights of p's projection on the triangle a b c, clamped inside it */
function baryOf(p, a, b, c) {
  const v0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v2 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const d00 = v0[0] * v0[0] + v0[1] * v0[1] + v0[2] * v0[2], d01 = v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2], d11 = v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2];
  const d20 = v2[0] * v0[0] + v2[1] * v0[1] + v2[2] * v0[2], d21 = v2[0] * v1[0] + v2[1] * v1[1] + v2[2] * v1[2], den = d00 * d11 - d01 * d01 || 1e-12;
  let v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den; v = Math.max(0, Math.min(1, v)); w = Math.max(0, Math.min(1 - v, w));
  return [1 - v - w, v, w];
}

/* ---------------- the project's own morphs (B's wrap result): <project>/dazmorphs/<name>.json */
const safeName = (n) => String(n || "").replace(/[^A-Za-z0-9 _-]+/g, "_").trim().slice(0, 60);
function morphDir() { const d = require("./core").pDir("dazmorphs"); fs.mkdirSync(d, { recursive: true }); return d; }
function saveMorph(name, data) { const n = safeName(name) || "wrap"; let f = path.join(morphDir(), n + ".json"), k = 2, nm = n; while (fs.existsSync(f)) { nm = n + " " + k++; f = path.join(morphDir(), nm + ".json"); } fs.writeFileSync(f, JSON.stringify(Object.assign({ format: "bitgen-dazmorph", v: 1, name: nm }, data))); return nm; }
function readMorph(name) { const f = path.join(morphDir(), safeName(name) + ".json"); if (!fs.existsSync(f)) return null; return JSON.parse(fs.readFileSync(f, "utf8")); }

module.exports = { POINTS, BODY_PROMPT, parseBody, toPixels, features, weightsOf, marks, measure, bodyDials, lm, fitDials, readGlbMesh, alignScan, applyAlign, wrap, trustOf, rasterise, affine, paintPhoto, paintScan, baryOf, saveMorph, readMorph, safeName };
