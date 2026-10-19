// bitGen Studio — lib/lottie.js (2.512.0): the timeline's picture / text layers as a LOTTIE animation (Bodymovin JSON,
// v5) - for the web, apps, players that draw vector animation.
//
// Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 7: "Lottie (JSON) export".
//
//   build(desc, readImage) -> {json, skipped}
//     desc = {name, W, H, fps, dur, layers: [top first]} - each layer:
//       {kind: "native", name, file, baseW, baseH (its size on the frame at scale 1), start, len, lop (the layer's
//        opacity), op (the clip's), tf: {x, y, scale, rot, ax, ay}, kf: [the clip's keys], blend} - the picture's own
//        size is read from the file (natW / natH; k0 = baseW / natW)
//         a picture or a text (its picture: images/text_<id>.png), moved / scaled / turned / faded by its keys - the
//         keys' eases become Lottie's bezier handles (linear, in, out, in-out, a custom curve, hold)
//       {kind: "frames", name, id, start, fps, frames: [n | null (the same as the frame before)], blend}
//         a layer the page drew frame by frame (masks, effects, generators, 3D, parents, expressions ...): frame k
//         shows its n-th picture (sent first to /api/tlbake/frame as <id> f_<n>.png; repeats shared); a data: URL in
//         place of n works too
//     readImage(file) -> a Buffer (the picture, embedded as a data: URL) | null
//     readFrame(id, n) -> a Buffer (a frames layer's n-th picture) | null
//   save(dir, stem, json) -> {name, size}: <stem>_lottie.json beside the movies (📤 Export lists it)
"use strict";
const fs = require("fs"), path = require("path");

const BZ = { linear: [1 / 3, 1 / 3, 2 / 3, 2 / 3], in: [1 / 3, 0, 2 / 3, 1 / 3], out: [1 / 3, 2 / 3, 2 / 3, 1], inout: [1 / 3, 0, 2 / 3, 1] };   // = static/keyframes.js's eases exactly
const BLEND = { normal: 0, multiply: 1, screen: 2, overlay: 3, darken: 4, lighten: 5, "color-dodge": 6, "color-burn": 7, "hard-light": 8, "soft-light": 9,
  difference: 10, exclusion: 11, hue: 12, saturation: 13, color: 14, luminosity: 15 };
const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const r4 = (v) => Math.round(v * 10000) / 10000;
/** a PNG / JPEG / WebP's size from its bytes -> [w, h] | null */
function sizeOf(b) {
  try {
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1], L = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + L; }
    }
    if (b.length > 30 && b.slice(0, 4).toString() === "RIFF" && b.slice(12, 16).toString() === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  } catch { /* not readable */ }
  return null;
}
const mime = (buf) => (buf && buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 ? "image/jpeg" : buf && buf.slice(0, 4).toString() === "RIFF" ? "image/webp" : "image/png");

/** a key's ease out of it -> Lottie's handles {o, i} (or {h: 1} for hold) */
function handles(k) {
  if (k && k.ease === "hold") return { h: 1 };
  const b = k && k.ease === "bezier" && Array.isArray(k.bz) && k.bz.length === 4 ? k.bz.map(Number) : BZ[k && k.ease] || BZ.linear;
  return { o: { x: [r4(b[0])], y: [r4(b[1])] }, i: { x: [r4(b[2])], y: [r4(b[3])] } };
}
/** one property: keys (sorted, of `prop`) -> {a: 0, k} | {a: 1, k: [{t, s, i, o | h}]}; map(v) = the Lottie value array */
function prop(kf, p, stat, map, start, fps) {
  const ks = (Array.isArray(kf) ? kf : []).filter((k) => k && k[p] != null && Number.isFinite(+k[p]) && Number.isFinite(+k.at)).sort((a, b) => a.at - b.at);
  if (!ks.length) return { a: 0, k: map(stat) };
  if (ks.length === 1) return { a: 0, k: map(+ks[0][p]) };
  return { a: 1, k: ks.map((k, i) => {
    const o = { t: r4((start + +k.at) * fps), s: map(+k[p]) };
    if (i < ks.length - 1) Object.assign(o, handles(k));
    return o;
  }) };
}
/** a native layer's transform (ks) */
function transform(L, W, H, fps) {
  const tf = L.tf || {}, kf = L.kf, s0 = L.start || 0, k0 = num(L.k0, 1) || 1, lop = num(L.lop, 1);
  const x = prop(kf, "x", num(tf.x, 0), (v) => [r4(W / 2 + v)], s0, fps), y = prop(kf, "y", num(tf.y, 0), (v) => [r4(H / 2 + v)], s0, fps);
  const p = x.a || y.a ? { s: true, x: unwrap(x), y: unwrap(y) } : { a: 0, k: [x.k[0], y.k[0], 0] };
  const ax = prop(kf, "ax", num(tf.ax, 0), (v) => [r4(num(L.natW, 1) / 2 + v / k0)], s0, fps), ay = prop(kf, "ay", num(tf.ay, 0), (v) => [r4(num(L.natH, 1) / 2 + v / k0)], s0, fps);
  const a = ax.a || ay.a ? combine(ax, ay) : { a: 0, k: [ax.k[0], ay.k[0], 0] };
  const s = prop(kf, "scale", num(tf.scale, 1), (v) => [r4(v * k0 * 100), r4(v * k0 * 100), 100], s0, fps);
  const r = prop(kf, "rot", num(tf.rot, 0), (v) => [r4(v)], s0, fps);
  const o = prop(kf, "op", num(L.op, 1), (v) => [r4(Math.max(0, Math.min(1, v)) * lop * 100)], s0, fps);
  return { o: unwrap(o), r: unwrap(r), p, a, s };
}
/** a one-number property with [v] values -> Lottie's plain number form */
function unwrap(P) { return P.a ? { a: 1, k: P.k.map((k) => Object.assign({}, k, { s: k.s })) } : { a: 0, k: P.k[0] }; }
/** the anchor point keyed: x / y on one timeline (a key wherever either has one, the other's value there by straight lines) */
function combine(X, Y) {
  const t = Array.from(new Set([].concat(X.a ? X.k.map((k) => k.t) : [], Y.a ? Y.k.map((k) => k.t) : []))).sort((a, b) => a - b);
  const at = (P, tt) => { if (!P.a) return P.k[0]; const k = P.k; if (tt <= k[0].t) return k[0].s[0]; for (let i = 0; i + 1 < k.length; i++) if (tt <= k[i + 1].t) { const f = (tt - k[i].t) / Math.max(1e-9, k[i + 1].t - k[i].t); return k[i].s[0] + (k[i + 1].s[0] - k[i].s[0]) * f; } return k[k.length - 1].s[0]; };
  return { a: 1, k: t.map((tt, i) => Object.assign({ t: tt, s: [r4(at(X, tt)), r4(at(Y, tt)), 0] }, i < t.length - 1 ? handles({}) : {})) };
}
function build(desc, readImage, readFrame) {
  const D = desc || {}, W = Math.max(1, Math.round(num(D.W, 1920))), H = Math.max(1, Math.round(num(D.H, 1080))), fps = Math.max(1, Math.min(120, num(D.fps, 24)));
  const dur = Math.max(1 / fps, num(D.dur, 5)), assets = [], layers = [], skipped = [], seen = new Map();
  let ind = 0;
  const asset = (dataUrl, w, h) => {
    if (seen.has(dataUrl)) return seen.get(dataUrl);
    const id = "img_" + assets.length;
    assets.push({ id, w: Math.round(w), h: Math.round(h), u: "", p: dataUrl, e: 1 });
    seen.set(dataUrl, id);
    return id;
  };
  (Array.isArray(D.layers) ? D.layers : []).forEach((L) => {
    const nm = String(L.name || "Layer").slice(0, 60), bm = BLEND[L.blend] || 0;
    if (L.kind === "native") {
      const buf = readImage ? readImage(L.file) : null;
      if (!buf) { skipped.push(nm + " (its picture " + (L.file || "?") + " was not found)"); return; }
      const sz = sizeOf(buf) || [num(L.natW, num(L.baseW, 1)), num(L.natH, num(L.baseH, 1))];
      L = Object.assign({}, L, { natW: sz[0], natH: sz[1], k0: num(L.baseW, sz[0]) / Math.max(1, sz[0]) });
      const id = asset("data:" + mime(buf) + ";base64," + buf.toString("base64"), sz[0], sz[1]);
      const s0 = Math.max(0, num(L.start, 0)), len = Math.max(1 / fps, num(L.len, dur));
      layers.push({ ddd: 0, ind: ++ind, ty: 2, nm, refId: id, sr: 1, ks: transform(Object.assign({}, L, { start: s0 }), W, H, fps), ao: 0, ip: r4(s0 * fps), op: r4((s0 + len) * fps), st: 0, bm });
    } else if (L.kind === "frames") {
      const F = Array.isArray(L.frames) ? L.frames : [], ff = Math.max(1, num(L.fps, fps)), s0 = Math.max(0, num(L.start, 0)), step = fps / ff;
      let last = null, from = 0, n = 0;
      const close = (iEnd) => { if (last == null) return; layers.push({ ddd: 0, ind: ++ind, ty: 2, nm: nm + " " + (++n), refId: last, sr: 1,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [W / 2, H / 2, 0] }, a: { a: 0, k: [W / 2, H / 2, 0] }, s: { a: 0, k: [100, 100, 100] } },
        ao: 0, ip: r4(s0 * fps + from * step), op: r4(s0 * fps + iEnd * step), st: 0, bm }); };
      const urls = {};
      F.forEach((d, i) => {
        if (d == null) return;                                  // the same as the frame before: the image runs on
        let u = typeof d === "string" ? d : urls[d];
        if (u == null && typeof d === "number") { const b = readFrame ? readFrame(L.id, d) : null; u = urls[d] = b ? "data:image/png;base64," + b.toString("base64") : ""; }
        if (!u) return;
        const id = asset(u, W, H);
        if (id === last) return;
        close(i); last = id; from = i;
      });
      close(F.length);
      if (!n) skipped.push(nm + " (no frames)");
    } else skipped.push(nm + " (" + (L.why || "not a picture or text layer") + ")");
  });
  const json = { v: "5.12.2", fr: fps, ip: 0, op: r4(dur * fps), w: W, h: H, nm: String(D.name || "bitGen Studio").slice(0, 80), ddd: 0, assets, layers, markers: [], meta: { g: "bitGen Studio" } };
  return { json, skipped };
}
function save(dir, stem, json) {
  const name = `${stem}_lottie.json`, txt = JSON.stringify(json);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), txt);
  return { name, size: Buffer.byteLength(txt) };
}
module.exports = { BZ, BLEND, sizeOf, handles, prop, transform, build, save };
