/* bitGen Studio — ext/synthdock/synthtlcore.js (2.954.0): 🎹 THE SYNTH TAB's TIMELINE - its rules (window.H3SynthTLCore), pure.
 * Tim: "add a timeline below that with waveforms that can be added from all sources, add knobs to each timeline layer for
 * volume. add keyframes to each layer, start volume end volume on each key frame".
 *   A timeline  {v, zoom (px a second), snap, layers: [{name, vol 0-1.5, pan -1..1, mute, solo, clips, keys}]}
 *   A clip      {src ("kit:" | "my:" | "sfx:" | "snd:" | "out:" + name), name, start (s on the timeline), off (s into the sound), len (s)}
 *   A keyframe  {t, a, b}: from t the layer's volume goes from a (start volume) to b (end volume), reached at the next keyframe
 *               (the last one: at the end of the timeline); before the first keyframe the layer plays at 100%. The layer's own
 *               Vol knob multiplies the whole line.
 *   env(keys, t, end) the line's value at t;  automation(keys, from, end) -> [{op: "set" | "ramp", t, v}] (Web Audio calls)
 *   schedule(tl, from) -> what to start: [{layer, clip, when, off, dur}];  audible(tl, i) (mute / solo);  end(tl)
 *   moveClip / trimStart / trimEnd (kept inside the sound, at least 20 ms), addKey(layer, t), snap(t, bpm, on), peaks(), fmt()
 *   2.957.0 (Tim: "go with your suggestion" - a piano roll, clip editing, undo): a NOTE clip {kind: "notes", name, start, len,
 *   notes: [{m, t (s from the clip's start), d, v}], patch} played by the synth; every clip has gain (0-2), fi / fo (fade in / out,
 *   s); splitClip(c, t) -> [a, b], dupClip(c), fades(clips) (overlaps on a layer = automatic crossfades), clipEnv(c, fi, fo) (the
 *   clip's gain line), cleanNotes(), quantize(notes, grid, strength)
 *   2.958.0 (Tim: "continue"): layer.fx {lo, mid, hi (dB), comp, rev} (the mixer), tl.markers [{t, name}], tl.master
 *   2.959.0 (Tim: "continue next please"): layer.fx.cut (its filter), layer.auto {pan, cut, rev: [{t, v}]} (automation lanes)
 */
(function (root) {
  "use strict";
  var MAXL = 16, MAXC = 200, MAXK = 200, MIN = 0.02, MAXT = 3600;
  var num = function (v, d, lo, hi) { v = Number(v); if (!Number.isFinite(v)) v = d; return Math.max(lo, Math.min(hi, v)); };
  function okSrc(s) { return typeof s === "string" && /^(kit|my|sfx|snd|out):[^\u0000-\u001f<>]{1,160}$/.test(s) && s.indexOf("..") < 0 ? s : null; }
  // 2.958.0: each layer's effects (the mixer): EQ low / mid / high in dB, compressor amount 0-1, reverb send 0-1
  var FX0 = { lo: 0, mid: 0, hi: 0, comp: 0, rev: 0, cut: 20000 };
  function cleanFx(f) { f = f || {}; return { lo: num(f.lo, 0, -15, 15), mid: num(f.mid, 0, -15, 15), hi: num(f.hi, 0, -15, 15), comp: num(f.comp, 0, 0, 1), rev: num(f.rev, 0, 0, 1), cut: num(f.cut, 20000, 40, 20000) }; }
  /** 2.959.0: automation lanes - points {t, v (0..1)} for pan, cut (the layer's filter) and rev (its reverb send); before the first
   *  point the knob's own value; straight lines between points; the last one holds */
  var AUTO = ["pan", "cut", "rev"];
  function cleanAuto(a) {
    var o = {}; a = a || {};
    AUTO.forEach(function (k) { o[k] = (Array.isArray(a[k]) ? a[k] : []).slice(0, 400).filter(function (p) { return p && Number.isFinite(+p.t); })
      .map(function (p) { return { t: num(p.t, 0, 0, MAXT), v: Math.round(num(p.v, 0.5, 0, 1) * 1000) / 1000 }; }).sort(function (x, y) { return x.t - y.t; }); });
    return o;
  }
  /** a lane's 0..1 value <-> the parameter: pan -1..1, cut 40 Hz..20 kHz (log), rev 0..1 */
  function autoVal(k, v) { return k === "pan" ? v * 2 - 1 : k === "cut" ? 40 * Math.pow(500, v) : v; }
  function autoNorm(k, x) { return k === "pan" ? (x + 1) / 2 : k === "cut" ? Math.log(Math.max(40, x) / 40) / Math.log(500) : x; }
  /** the lane's value at t (0..1); def = the knob's (0..1) before the first point */
  function autoAt(pts, t, def) {
    if (!pts || !pts.length || t < pts[0].t) return def;
    for (var i = 1; i < pts.length; i++) if (t <= pts[i].t) { var a = pts[i - 1], b = pts[i]; return b.t === a.t ? b.v : a.v + (b.v - a.v) * (t - a.t) / (b.t - a.t); }
    return pts[pts.length - 1].v;
  }
  /** the lane from `from` on as Web Audio calls (timeline s): set where it is, ramp to each point after */
  function autoOps(pts, from, def) {
    var ops = [{ op: "set", t: from, v: autoAt(pts, from, def) }];
    (pts || []).forEach(function (p) { if (p.t > from) ops.push({ op: "ramp", t: p.t, v: p.v }); });
    return ops;
  }
  function layer(i) { return { name: "Layer " + (i + 1), vol: 1, pan: 0, mute: false, solo: false, clips: [], keys: [], fx: cleanFx(null), auto: cleanAuto(null) }; }
  function newTL() { return { v: 1, zoom: 40, snap: true, layers: [0, 1, 2, 3].map(layer), markers: [], master: 1 }; }
  /** 2.958.0: markers [{t, name}] - in time order, 100 at most */
  function cleanMarkers(a) {
    return (Array.isArray(a) ? a : []).slice(0, 100).filter(function (m) { return m && Number.isFinite(+m.t); })
      .map(function (m) { return { t: num(m.t, 0, 0, MAXT), name: String(m.name || "Marker").replace(/[\u0000-\u001f<>]/g, "").slice(0, 32) || "Marker" }; })
      .sort(function (a2, b) { return a2.t - b.t; });
  }
  function sortKeys(ks) { ks.sort(function (x, y) { return x.t - y.t; }); return ks; }
  /** a timeline from a save made safe */
  function cleanTL(j) {
    if (!j || typeof j !== "object" || !Array.isArray(j.layers)) return newTL();
    var o = { v: 1, zoom: num(j.zoom, 40, 4, 400), snap: j.snap !== false, layers: [], markers: cleanMarkers(j.markers), master: num(j.master, 1, 0, 1.5) };
    j.layers.slice(0, MAXL).forEach(function (L, i) {
      L = L || {};
      var l = { name: String(L.name || "Layer " + (i + 1)).replace(/[\u0000-\u001f<>]/g, "").slice(0, 32) || "Layer " + (i + 1), vol: num(L.vol, 1, 0, 1.5), pan: num(L.pan, 0, -1, 1),
                mute: !!L.mute, solo: !!L.solo, clips: [], keys: [], fx: cleanFx(L.fx), auto: cleanAuto(L.auto) };
      (Array.isArray(L.clips) ? L.clips : []).slice(0, MAXC).forEach(function (c) {
        if (!c) return;
        var base;
        if (c.kind === "notes") base = { kind: "notes", name: String(c.name || "Notes").slice(0, 120), start: num(c.start, 0, 0, MAXT), off: 0, len: num(c.len, 1, MIN, MAXT), notes: cleanNotes(c.notes),
                                         patch: c.patch && typeof c.patch === "object" ? c.patch : null };
        else { var src = okSrc(c.src); if (!src) return; base = { src: src, name: String(c.name || src.replace(/^\w+:/, "")).slice(0, 120), start: num(c.start, 0, 0, MAXT), off: num(c.off, 0, 0, MAXT), len: num(c.len, 1, MIN, MAXT) }; }
        base.gain = num(c.gain, 1, 0, 2); base.fi = num(c.fi, 0, 0, base.len); base.fo = num(c.fo, 0, 0, base.len);
        l.clips.push(base);
      });
      (Array.isArray(L.keys) ? L.keys : []).slice(0, MAXK).forEach(function (k) { if (k) l.keys.push({ t: num(k.t, 0, 0, MAXT), a: num(k.a, 1, 0, 1), b: num(k.b, 1, 0, 1) }); });
      sortKeys(l.keys); o.layers.push(l);
    });
    if (!o.layers.length) o.layers.push(layer(0));
    return o;
  }
  function clipEnd(c) { return c.start + c.len; }
  /** notes made safe: m 0-127, t >= 0, d >= 10 ms, v 0.05-1; in time order; 4000 at most */
  function cleanNotes(a) {
    return (Array.isArray(a) ? a : []).slice(0, 4000).filter(function (n) { return n && Number.isFinite(+n.m) && Number.isFinite(+n.t); })
      .map(function (n) { return { m: Math.round(num(n.m, 60, 0, 127)), t: num(n.t, 0, 0, MAXT), d: num(n.d, 0.25, 0.01, MAXT), v: Math.round(num(n.v, 0.8, 0.05, 1) * 100) / 100 }; })
      .sort(function (x, y) { return x.t - y.t || x.m - y.m; });
  }
  /** notes to the grid (s): strength 1 = right on it */
  function quantize(notes, grid, strength) {
    var k = strength == null ? 1 : strength;
    return notes.map(function (n) { var t = Math.round(n.t / grid) * grid, e = Math.max(t + grid, Math.round((n.t + n.d) / grid) * grid); return { m: n.m, t: n.t + (t - n.t) * k, d: Math.max(0.01, n.d + ((e - t) - n.d) * k), v: n.v }; });
  }
  /** cut a clip at t (timeline s) -> [left, right] (null when t is not inside it); a note clip's notes go to the side they start
   *  on (one crossing the cut ends there) */
  function splitClip(c, t) {
    var x = t - c.start; if (x <= MIN || x >= c.len - MIN) return null;
    var a = JSON.parse(JSON.stringify(c)), b = JSON.parse(JSON.stringify(c));
    a.len = x; a.fo = 0; a.fi = Math.min(a.fi || 0, x);
    b.start = t; b.len = c.len - x; b.fi = 0; b.fo = Math.min(b.fo || 0, b.len);
    if (c.kind === "notes") {
      a.notes = c.notes.filter(function (n) { return n.t < x; }).map(function (n) { return { m: n.m, t: n.t, d: Math.min(n.d, x - n.t), v: n.v }; });
      b.notes = c.notes.filter(function (n) { return n.t >= x; }).map(function (n) { return { m: n.m, t: n.t - x, d: n.d, v: n.v }; });
    } else b.off = c.off + x;
    return [a, b];
  }
  /** a copy right after it */
  function dupClip(c) { var d = JSON.parse(JSON.stringify(c)); d.start = clipEnd(c); return d; }
  /** each clip's fades on its layer: its own fi / fo, or longer where it overlaps its neighbour (an automatic crossfade) */
  function fades(clips) {
    return clips.map(function (c) {
      var fi = c.fi || 0, fo = c.fo || 0;
      clips.forEach(function (o) {
        if (o === c) return;
        if (o.start < c.start && clipEnd(o) > c.start && clipEnd(o) < clipEnd(c)) fi = Math.max(fi, clipEnd(o) - c.start);   // o ends inside c: c fades in over it
        if (o.start > c.start && o.start < clipEnd(c) && clipEnd(o) > clipEnd(c)) fo = Math.max(fo, clipEnd(c) - o.start);   // o starts inside c: c fades out
      });
      return { fi: Math.min(fi, c.len), fo: Math.min(fo, c.len) };
    });
  }
  /** a clip's gain line in clip time: [[x, v], ...] - 0 -> gain over fi, gain, gain -> 0 over fo */
  function clipEnv(c, fi, fo) {
    var g = c.gain == null ? 1 : c.gain, L = c.len; fi = Math.min(fi || 0, L); fo = Math.min(fo || 0, L - fi);
    var pts = [[0, fi > 0 ? 0 : g]]; if (fi > 0) pts.push([fi, g]); if (fo > 0) pts.push([L - fo, g]); pts.push([L, fo > 0 ? 0 : g]);
    return pts;
  }
  /** the line's value at clip time x */
  function envAt(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) { var a = pts[i - 1], b = pts[i]; return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return pts[pts.length - 1][1];
  }
  /** the end of the timeline: its last sound (or keyframe + 1 s), never 0 */
  function end(tl) {
    var e = 0;
    tl.layers.forEach(function (l) { l.clips.forEach(function (c) { e = Math.max(e, clipEnd(c)); }); l.keys.forEach(function (k) { e = Math.max(e, k.t + 1); }); });
    return Math.max(e, 1);
  }
  function audible(tl, i) { var solo = tl.layers.some(function (l) { return l.solo; }), l = tl.layers[i]; return !!l && !l.mute && (!solo || l.solo); }
  /** the keyframe line at t (0..1); 1 before the first keyframe */
  function env(keys, t, endT) {
    if (!keys || !keys.length || t < keys[0].t) return 1;
    var k = 0; while (k + 1 < keys.length && keys[k + 1].t <= t) k++;
    var K = keys[k], e = k + 1 < keys.length ? keys[k + 1].t : Math.max(endT, K.t);
    if (e <= K.t) return K.b;
    var f = Math.max(0, Math.min(1, (t - K.t) / (e - K.t)));
    return K.a + (K.b - K.a) * f;
  }
  /** the line from `from` on, as Web Audio calls in timeline seconds: set the value now, then per keyframe set a / ramp to b */
  function automation(keys, from, endT) {
    var ops = [{ op: "set", t: from, v: env(keys, from, endT) }];
    (keys || []).forEach(function (K, k) {
      var e = k + 1 < keys.length ? keys[k + 1].t : Math.max(endT, K.t);
      if (e <= from) return;
      if (K.t >= from) ops.push({ op: "set", t: K.t, v: K.a });
      if (e > K.t && e > from) ops.push({ op: "ramp", t: e, v: K.b });
    });
    return ops;
  }
  /** what plays from `from` on: [{layer, clip (index), when (s after from), off (s into the sound), dur}] - audible layers only */
  function schedule(tl, from) {
    var out = [];
    tl.layers.forEach(function (l, i) {
      if (!audible(tl, i)) return;
      l.clips.forEach(function (c, ci) {
        if (clipEnd(c) <= from) return;
        var skip = Math.max(0, from - c.start);
        out.push({ layer: i, clip: ci, src: c.src, kind: c.kind || "audio", when: Math.max(0, c.start - from), skip: skip, off: c.off + skip, dur: c.len - skip });
      });
    });
    return out.sort(function (a, b) { return a.when - b.when; });
  }
  function snap(t, bpm, on) { if (!on) return Math.max(0, t); var q = 60 / (bpm || 120) / 4; return Math.max(0, Math.round(t / q) * q); }
  function moveClip(c, start) { c.start = Math.max(0, Math.min(MAXT, start)); return c; }
  /** drag the left edge to `t` (the sound under it stays where it was) */
  function trimStart(c, t) {
    var d = t - c.start; d = Math.max(-c.off, Math.min(c.len - MIN, d)); d = Math.max(d, -c.start);
    c.start += d; c.off += d; c.len -= d; return c;
  }
  /** drag the right edge to `t` (no further than the sound's own end) */
  function trimEnd(c, t, srcDur) { c.len = Math.max(MIN, Math.min((srcDur || MAXT) - c.off, t - c.start)); return c; }
  /** a keyframe at t holding the line's value there (start = end) -> its index */
  function addKey(l, t, endT) {
    var v = Math.round(env(l.keys, t, endT) * 100) / 100, k = { t: Math.max(0, t), a: v, b: v };
    if (l.keys.length >= MAXK) return -1;
    l.keys.push(k); sortKeys(l.keys); return l.keys.indexOf(k);
  }
  /** min / max per bucket - `per` a second of a sound's samples (the waveform) */
  function peaks(data, sr, per) {
    per = per || 100; var n = Math.max(1, Math.ceil(data.length / sr * per)), step = data.length / n, out = new Float32Array(n * 2);
    for (var i = 0; i < n; i++) {
      var a = Math.floor(i * step), b = Math.min(data.length, Math.floor((i + 1) * step)), lo = 0, hi = 0;
      for (var j = a; j < b; j++) { var v = data[j]; if (v < lo) lo = v; if (v > hi) hi = v; }
      out[i * 2] = lo; out[i * 2 + 1] = hi;
    }
    return out;
  }
  function fmt(t) { t = Math.max(0, t); var m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }
  var api = { MAXL: MAXL, MIN: MIN, okSrc: okSrc, newTL: newTL, newLayer: layer, cleanTL: cleanTL, clipEnd: clipEnd, end: end, audible: audible, env: env, automation: automation,
              schedule: schedule, snap: snap, AUTO: AUTO, cleanAuto: cleanAuto, autoVal: autoVal, autoNorm: autoNorm, autoAt: autoAt, autoOps: autoOps, cleanFx: cleanFx, cleanMarkers: cleanMarkers, FX0: FX0, cleanNotes: cleanNotes, quantize: quantize, splitClip: splitClip, dupClip: dupClip, fades: fades, clipEnv: clipEnv, envAt: envAt, moveClip: moveClip, trimStart: trimStart, trimEnd: trimEnd, addKey: addKey, sortKeys: sortKeys, peaks: peaks, fmt: fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthTLCore = api;
})(typeof window !== "undefined" ? window : globalThis);
