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
 */
(function (root) {
  "use strict";
  var MAXL = 16, MAXC = 200, MAXK = 200, MIN = 0.02, MAXT = 3600;
  var num = function (v, d, lo, hi) { v = Number(v); if (!Number.isFinite(v)) v = d; return Math.max(lo, Math.min(hi, v)); };
  function okSrc(s) { return typeof s === "string" && /^(kit|my|sfx|snd|out):[^\u0000-\u001f<>]{1,160}$/.test(s) && s.indexOf("..") < 0 ? s : null; }
  function layer(i) { return { name: "Layer " + (i + 1), vol: 1, pan: 0, mute: false, solo: false, clips: [], keys: [] }; }
  function newTL() { return { v: 1, zoom: 40, snap: true, layers: [0, 1, 2, 3].map(layer) }; }
  function sortKeys(ks) { ks.sort(function (x, y) { return x.t - y.t; }); return ks; }
  /** a timeline from a save made safe */
  function cleanTL(j) {
    if (!j || typeof j !== "object" || !Array.isArray(j.layers)) return newTL();
    var o = { v: 1, zoom: num(j.zoom, 40, 4, 400), snap: j.snap !== false, layers: [] };
    j.layers.slice(0, MAXL).forEach(function (L, i) {
      L = L || {};
      var l = { name: String(L.name || "Layer " + (i + 1)).replace(/[\u0000-\u001f<>]/g, "").slice(0, 32) || "Layer " + (i + 1), vol: num(L.vol, 1, 0, 1.5), pan: num(L.pan, 0, -1, 1),
                mute: !!L.mute, solo: !!L.solo, clips: [], keys: [] };
      (Array.isArray(L.clips) ? L.clips : []).slice(0, MAXC).forEach(function (c) {
        var src = okSrc(c && c.src); if (!src) return;
        l.clips.push({ src: src, name: String(c.name || src.replace(/^\w+:/, "")).slice(0, 120), start: num(c.start, 0, 0, MAXT), off: num(c.off, 0, 0, MAXT), len: num(c.len, 1, MIN, MAXT) });
      });
      (Array.isArray(L.keys) ? L.keys : []).slice(0, MAXK).forEach(function (k) { if (k) l.keys.push({ t: num(k.t, 0, 0, MAXT), a: num(k.a, 1, 0, 1), b: num(k.b, 1, 0, 1) }); });
      sortKeys(l.keys); o.layers.push(l);
    });
    if (!o.layers.length) o.layers.push(layer(0));
    return o;
  }
  function clipEnd(c) { return c.start + c.len; }
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
        out.push({ layer: i, clip: ci, src: c.src, when: Math.max(0, c.start - from), off: c.off + skip, dur: c.len - skip });
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
              schedule: schedule, snap: snap, moveClip: moveClip, trimStart: trimStart, trimEnd: trimEnd, addKey: addKey, sortKeys: sortKeys, peaks: peaks, fmt: fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthTLCore = api;
})(typeof window !== "undefined" ? window : globalThis);
