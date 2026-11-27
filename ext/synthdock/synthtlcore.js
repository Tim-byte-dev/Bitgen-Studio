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
 *   2.960.0 (Tim: "lets do the next one"): takes + comping - audio clips with grp ("g1") + ti (take 0..31) are one take group;
 *   layer.comps {grp: [{t, ti}]} says which take plays from t on (comp, compAt, ranges, playable -> what really plays);
 *   tl.loop {on, a, b, punch} (cleanLoop) - the loop / punch range; passRanges / punchCut slice a recording into takes.
 *   2.961.0 (Tim: "continue please"): the tempo track - tl.tempoOn + tl.tempo [{t, bpm, ramp}] (a step, or a straight ramp to
 *   the next point); beatAt / timeAt / bpmAt / beatTimes / snapBeat / barBeat: the grid, snap, the click and bar.beat follow it.
 *   2.962.0 (Tim: "lets do the last cakewalk item"): step clips {kind "steps", n steps, div (steps a beat), swing, rows [{src, vol,
 *   hits [0 off | 1 on | 2 accent]}]} - the pattern repeats over the clip on the tempo map's beats (stepEvents).
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
  function layer(i) { return { name: "Layer " + (i + 1), vol: 1, pan: 0, mute: false, solo: false, clips: [], keys: [], fx: cleanFx(null), auto: cleanAuto(null), comps: {} }; }
  function newTL() { return { v: 1, zoom: 40, snap: true, layers: [0, 1, 2, 3].map(layer), markers: [], master: 1, loop: cleanLoop(null), tempo: [], tempoOn: false }; }
  /* ---------------- 2.962.0: step clips (a step sequencer on a layer) ---------------- */
  var DIVS = [2, 3, 4, 6, 8], MAXROWS = 8;
  function cleanStepRows(rows, n) {
    return (Array.isArray(rows) ? rows : []).slice(0, 64).map(function (r) {
      if (!r) return null; var src = okSrc(r.src); if (!src) return null;
      var h = Array.isArray(r.hits) ? r.hits : [], hits = [];
      for (var i = 0; i < n; i++) hits.push(h[i] === 2 ? 2 : h[i] ? 1 : 0);
      var out = { src: src, vol: num(r.vol, 0.8, 0, 1), hits: hits };
      // 2.992.0 (🥁 Drumify): how far off the grid each step was played (-0.5..0.5 of a step) and how hard (0..1) - kept only when there
      if (Array.isArray(r.off)) { out.off = []; for (var j = 0; j < n; j++) out.off.push(hits[j] ? Math.round(num(r.off[j], 0, -0.5, 0.5) * 1000) / 1000 : 0); }
      if (Array.isArray(r.vel)) { out.vel = []; for (var k = 0; k < n; k++) out.vel.push(hits[k] ? Math.round(num(r.vel[k], hits[k] === 2 ? 1 : 0.7, 0.05, 1) * 1000) / 1000 : 0); }
      return out;
    }).filter(Boolean).slice(0, MAXROWS);
  }
  function cleanSteps(c, base) {
    var n = Math.round(num(c.n, 16, 2, 64)), div = DIVS.indexOf(+c.div) >= 0 ? +c.div : 4;
    base.kind = "steps"; base.n = n; base.div = div; base.swing = num(c.swing, 0, 0, 0.5); base.rows = cleanStepRows(c.rows, n);
    if (c.feel != null) base.feel = Math.round(num(c.feel, 1, 0, 1) * 100) / 100;   // 2.992.0: 0 = on the grid, 1 = as played
    return base;
  }
  /** a new step clip: one bar of 16ths, kick / snare / closed + open hats with a plain beat */
  function newSteps(start, len) {
    var z = function (on) { var a = []; for (var i = 0; i < 16; i++) a.push(on.indexOf(i) >= 0 ? (i % 4 === 0 ? 2 : 1) : 0); return a; };
    return { kind: "steps", name: "Steps", start: start || 0, off: 0, len: len || 2, gain: 1, fi: 0, fo: 0, n: 16, div: 4, swing: 0,
      rows: [{ src: "kit:kick", vol: 0.9, hits: z([0, 8]) }, { src: "kit:snare", vol: 0.8, hits: z([4, 12]) }, { src: "kit:chat", vol: 0.6, hits: z([0, 2, 4, 6, 8, 10, 12, 14]) }, { src: "kit:ohat", vol: 0.6, hits: z([]) }] };
  }
  /** the hits of a step clip over its length (clip-relative s), on the beats of the tempo map: the pattern repeats; odd steps
   *  late by `swing` of a step; v = row volume x (accent 1, else 0.7) - 2.992.0: a row's own `vel` (how hard) when it has one,
   *  and its `off` (played early / late, in steps) x the clip's `feel` (default 1 = as played; 0 = on the grid) */
  function stepEvents(c, map) {
    var out = [], b0 = beatAt(map, c.start), sl = 1 / (c.div || 4), fe = c.feel == null ? 1 : c.feel;
    for (var i = 0; i < 4096; i++) {
      var t0 = timeAt(map, b0 + i * sl) - c.start; if (t0 >= c.len - 1e-9) break;
      var sw = i % 2 ? (c.swing || 0) : 0, k = i % c.n;
      (c.rows || []).forEach(function (r, ri) {
        var h = r.hits[k]; if (!h) return;
        var of = r.off && r.off[k] ? r.off[k] * fe : 0, t = sw || of ? timeAt(map, b0 + (i + sw + of) * sl) - c.start : t0;
        if (t < 0) t = 0;
        var v = r.vel && r.vel[k] ? r.vel[k] : (h === 2 ? 1 : 0.7);
        if (t < c.len) out.push({ t: Math.round(t * 1e6) / 1e6, src: r.src, v: r.vol * v, row: ri, step: k });
      });
    }
    return out;
  }
  /* ---------------- 2.961.0: the tempo track ---------------- */
  /** [{t, bpm, ramp}] sorted, the first at 0, 20-300 BPM, 200 at most ([] = none) */
  function cleanTempo(a) {
    var out = [];
    (Array.isArray(a) ? a : []).slice(0, 200).forEach(function (p) {
      if (!p || !Number.isFinite(+p.t) || !Number.isFinite(+p.bpm)) return;
      var n = { t: Math.round(num(p.t, 0, 0, MAXT) * 10000) / 10000, bpm: Math.round(num(p.bpm, 120, 20, 300) * 100) / 100, ramp: !!p.ramp };
      var same = out.findIndex(function (q) { return Math.abs(q.t - n.t) < 1e-6; }); if (same >= 0) out[same] = n; else out.push(n);
    });
    out.sort(function (x, y) { return x.t - y.t; });
    if (out.length && out[0].t > 0) out.unshift({ t: 0, bpm: out[0].bpm, ramp: false });
    if (out.length) out[out.length - 1].ramp = false;
    return out;
  }
  function tseg(map, i) { var p = map[i], q = map[i + 1], k = p.ramp && q ? (q.bpm - p.bpm) / (q.t - p.t) : 0; return { t: p.t, b: p.bpm, k: k, end: q ? q.t : Infinity }; }
  function bpmAt(map, t) {
    if (!map || !map.length) return 120;
    var i = 0; while (i + 1 < map.length && map[i + 1].t <= t) i++;
    var g = tseg(map, i); return g.b + g.k * (Math.min(t, g.end) - g.t);
  }
  /** beats from 0 to t (a ramp = the tempo changing evenly in time) */
  function beatAt(map, t) {
    if (!map || !map.length) map = [{ t: 0, bpm: 120 }];
    var beats = 0;
    for (var i = 0; i < map.length; i++) {
      var g = tseg(map, i); if (t <= g.t) break;
      var dt = Math.min(t, g.end) - g.t; beats += (g.b * dt + g.k * dt * dt / 2) / 60;
    }
    return beats;
  }
  /** the time of beat n */
  function timeAt(map, n) {
    if (!map || !map.length) map = [{ t: 0, bpm: 120 }];
    var beats = 0;
    for (var i = 0; i < map.length; i++) {
      var g = tseg(map, i), dtE = g.end - g.t, segB = g.end === Infinity ? Infinity : (g.b * dtE + g.k * dtE * dtE / 2) / 60;
      if (n <= beats + segB) {
        var db = n - beats;
        if (Math.abs(g.k) < 1e-9) return g.t + db * 60 / g.b;
        return g.t + (-g.b + Math.sqrt(Math.max(0, g.b * g.b + 2 * g.k * 60 * db))) / g.k;
      }
      beats += segB;
    }
    return MAXT;
  }
  /** the clicks: every beat from `from` (incl.) to `until` (excl.) -> [{t, accent (first of the bar)}] */
  function beatTimes(map, from, until, perBar) {
    perBar = perBar || 4; var out = [], b = Math.ceil(beatAt(map, from) - 1e-9);
    for (var n = 0; n < 20000; n++, b++) { var t = timeAt(map, b); if (t >= until - 1e-9) break; out.push({ t: Math.round(t * 1e6) / 1e6, accent: b % perBar === 0 }); }
    return out;
  }
  /** t to the nearest 1/div of a beat (16ths = 4) */
  function snapBeat(map, t, on, div) { if (!on) return Math.max(0, t); div = div || 4; return Math.max(0, Math.round(timeAt(map, Math.round(beatAt(map, t) * div) / div) * 1e6) / 1e6); }
  function barBeat(map, t, perBar) { perBar = perBar || 4; var b = beatAt(map, t) + 1e-6; return { bar: Math.floor(b / perBar) + 1, beat: Math.floor(b % perBar) + 1 }; }
  /* ---------------- 2.960.0: the loop / punch range, takes and comping ---------------- */
  function cleanLoop(o) {
    o = o && typeof o === "object" ? o : {};
    var a = num(o.a, 0, 0, MAXT), b = num(o.b, 0, 0, MAXT); if (b < a) { var x = a; a = b; b = x; }
    return { on: !!o.on && b - a >= MIN, a: a, b: b, punch: !!o.punch && b - a >= MIN };
  }
  var GRP = /^g\d{1,6}$/, MAXTK = 32;
  /** which take plays at t: the last segment starting at or before t (the first segment before it); def with no segments */
  function compAt(segs, t, def) {
    if (!segs || !segs.length) return def;
    var v = segs[0].ti;
    for (var i = 0; i < segs.length; i++) { if (segs[i].t <= t + 1e-9) v = segs[i].ti; else break; }
    return v;
  }
  function tidySegs(segs) {
    var out = [];
    segs.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (sg) {
      var n = { t: Math.round(Math.max(0, sg.t) * 10000) / 10000, ti: sg.ti };
      if (out.length && Math.abs(out[out.length - 1].t - n.t) < 1e-9) out[out.length - 1] = n;
      else if (!out.length || out[out.length - 1].ti !== n.ti) out.push(n);
    });
    return out;
  }
  /** take ti plays from a to b (the rest as it was) -> new segments */
  function comp(segs, a, b, ti, def) {
    if (b < a) { var x = a; a = b; b = x; }
    var base = segs && segs.length ? segs : [{ t: 0, ti: def }];
    if (base[0].t > 0) base = [{ t: 0, ti: base[0].ti }].concat(base);
    if (b - a < 1e-6) return tidySegs(base);
    var after = compAt(base, b, def);
    var out = base.filter(function (sg) { return sg.t < a - 1e-9 || sg.t > b + 1e-9; });
    out.push({ t: a, ti: ti }, { t: b, ti: after });
    return tidySegs(out);
  }
  /** where take ti plays between from and to -> [[a, b], ...] */
  function ranges(segs, ti, from, to, def) {
    var pts = [from];
    (segs || []).forEach(function (sg) { if (sg.t > from && sg.t < to) pts.push(sg.t); });
    pts.push(to);
    var out = [];
    for (var i = 0; i + 1 < pts.length; i++) {
      var a = pts[i], b = pts[i + 1]; if (b - a <= 1e-9) continue;
      if (compAt(segs, a, def) !== ti) continue;
      if (out.length && Math.abs(out[out.length - 1][1] - a) < 1e-9) out[out.length - 1][1] = b; else out.push([a, b]);
    }
    return out;
  }
  /** a layer's take groups -> {grp: [clip index, ...]} (by take number) */
  function groups(l) {
    var g = {};
    l.clips.forEach(function (c, i) { if (c.grp) (g[c.grp] = g[c.grp] || []).push(i); });
    Object.keys(g).forEach(function (k) { g[k].sort(function (a, b) { return l.clips[a].ti - l.clips[b].ti; }); });
    return g;
  }
  function newest(l, grp) { var m = 0; l.clips.forEach(function (c) { if (c.grp === grp) m = Math.max(m, c.ti); }); return m; }
  function span(l, grp) { var a = Infinity, b = 0; l.clips.forEach(function (c) { if (c.grp === grp) { a = Math.min(a, c.start); b = Math.max(b, clipEnd(c)); } }); return a === Infinity ? null : [a, b]; }
  /** what a layer really plays: its plain clips + each take group as the pieces of the takes the comp picks (8 ms fades) */
  function playable(l) {
    var out = [], g = groups(l);
    l.clips.forEach(function (c, i) { if (!c.grp) out.push({ c: c, ci: i }); });
    Object.keys(g).forEach(function (k) {
      var segs = (l.comps && l.comps[k]) || [], def = newest(l, k);
      g[k].forEach(function (i) {
        var c = l.clips[i];
        ranges(segs, c.ti, c.start, clipEnd(c), def).forEach(function (r) {
          out.push({ ci: i, c: { src: c.src, name: c.name, start: r[0], off: c.off + (r[0] - c.start), len: r[1] - r[0], gain: c.gain, fi: 0.008, fo: 0.008, grp: k, ti: c.ti } });
        });
      });
    });
    return out;
  }
  /** a loop recording -> the samples of each pass: starts = when each pass began (s, same clock as t0), len = the loop's length */
  function passRanges(n, sr, t0, starts, len) {
    var out = [];
    (starts || []).forEach(function (p) {
      var i0 = Math.round((p - t0) * sr), i1 = i0 + Math.round(len * sr), lead = 0;
      if (i0 < 0) { lead = -i0 / sr; i0 = 0; }
      i1 = Math.min(n, i1);
      if (i1 - i0 >= 0.25 * sr) out.push({ i0: i0, i1: i1, lead: lead });
    });
    return out;
  }
  /** a take recorded from `from` for `dur` s, kept only between a and b -> {start, skip, len} | null */
  function punchCut(from, dur, a, b) {
    var s0 = Math.max(from, a), s1 = Math.min(from + dur, b);
    return s1 - s0 < MIN ? null : { start: s0, skip: s0 - from, len: s1 - s0 };
  }
  function nextGrp(l) { var m = 0; l.clips.forEach(function (c) { if (c.grp) m = Math.max(m, +c.grp.slice(1)); }); return "g" + (m + 1); }
  /** new recorded takes [{src, name, start, len}] onto layer l: they join the take group they overlap; a plain audio clip they
   *  overlap becomes take 1 of a new group; one take over nothing is just a clip. The newest take plays where it was recorded.
   *  -> {grp, added: [clip index], full} */
  function addTakes(l, takes) {
    takes = (takes || []).filter(function (t) { return t && t.len >= MIN; }); if (!takes.length) return { grp: null, added: [] };
    var a = Math.min.apply(null, takes.map(function (t) { return t.start; })), b = Math.max.apply(null, takes.map(function (t) { return t.start + t.len; }));
    var over = function (c) { return c.start < b - 1e-6 && clipEnd(c) > a + 1e-6; }, grp = null, full = false;
    l.clips.forEach(function (c) { if (!grp && c.grp && over(c)) grp = c.grp; });
    if (!grp) {
      var plain = -1; l.clips.forEach(function (c, i) { if (plain < 0 && !c.grp && !c.kind && over(c)) plain = i; });
      if (plain < 0 && takes.length === 1) { var t1 = takes[0]; if (l.clips.length >= MAXC) return { grp: null, added: [], full: true }; l.clips.push({ src: t1.src, name: t1.name, start: t1.start, off: 0, len: t1.len, gain: 1, fi: 0, fo: 0 }); return { grp: null, added: [l.clips.length - 1] }; }
      grp = nextGrp(l);
      if (plain >= 0) { l.clips[plain].grp = grp; l.clips[plain].ti = 0; }
    }
    l.comps = l.comps || {};
    var added = [], ti = l.clips.some(function (c) { return c.grp === grp; }) ? newest(l, grp) + 1 : 0, def = newest(l, grp);
    takes.forEach(function (t) {
      if (ti >= MAXTK || l.clips.length >= MAXC) { full = true; return; }
      l.clips.push({ src: t.src, name: t.name, start: t.start, off: 0, len: t.len, gain: 1, fi: 0, fo: 0, grp: grp, ti: ti });
      added.push(l.clips.length - 1);
      l.comps[grp] = comp(l.comps[grp], t.start, t.start + t.len, ti, def); def = ti; ti++;
    });
    return { grp: grp, added: added, full: full };
  }
  /** take clip ci gone: where it played, the newest take left plays; one take left = a plain clip again */
  function dropTake(l, ci) {
    var c = l.clips[ci]; if (!c) return false;
    l.clips.splice(ci, 1); if (!c.grp) return true;
    var k = c.grp, left = l.clips.filter(function (x) { return x.grp === k; });
    if (left.length <= 1) { left.forEach(function (x) { delete x.grp; delete x.ti; }); if (l.comps) delete l.comps[k]; return true; }
    var nw = newest(l, k);
    if (l.comps && l.comps[k]) l.comps[k] = tidySegs(l.comps[k].map(function (sg) { return { t: sg.t, ti: sg.ti === c.ti ? nw : sg.ti }; }));
    return true;
  }
  /** a take group -> plain clips: exactly what the comp plays */
  function flatten(l, grp) {
    var pieces = playable(l).filter(function (p) { return p.c.grp === grp; }).map(function (p) { var c = p.c; return { src: c.src, name: c.name, start: c.start, off: c.off, len: c.len, gain: c.gain, fi: c.fi, fo: c.fo }; });
    if (!l.clips.some(function (c) { return c.grp === grp; })) return 0;
    l.clips = l.clips.filter(function (c) { return c.grp !== grp; }).concat(pieces);
    if (l.comps) delete l.comps[grp];
    return pieces.length;
  }
  /** a take group moved by d seconds (its comp with it) */
  function moveGroup(l, grp, d) {
    var sp = span(l, grp); if (!sp) return 0;
    d = Math.max(-sp[0], d);
    l.clips.forEach(function (c) { if (c.grp === grp) c.start = Math.round((c.start + d) * 10000) / 10000; });
    if (l.comps && l.comps[grp]) l.comps[grp] = tidySegs(l.comps[grp].map(function (sg) { return { t: sg.t + d, ti: sg.ti }; }));
    return d;
  }
  function cleanComps(c, l) {
    var o = {}; if (!c || typeof c !== "object") return o;
    var g = groups(l);
    Object.keys(g).forEach(function (k) {
      if (!Array.isArray(c[k])) return;
      o[k] = tidySegs(c[k].slice(0, 400).filter(function (sg) { return sg && Number.isFinite(+sg.t) && Number.isInteger(+sg.ti); }).map(function (sg) { return { t: num(sg.t, 0, 0, MAXT), ti: Math.max(0, Math.min(MAXTK - 1, +sg.ti)) }; }));
    });
    return o;
  }
  /** 2.958.0: markers [{t, name}] - in time order, 100 at most */
  function cleanMarkers(a) {
    return (Array.isArray(a) ? a : []).slice(0, 100).filter(function (m) { return m && Number.isFinite(+m.t); })
      .map(function (m) { return { t: num(m.t, 0, 0, MAXT), name: String(m.name || "Marker").replace(/[\u0000-\u001f<>]/g, "").slice(0, 32) || "Marker" }; })
      .sort(function (a2, b) { return a2.t - b.t; });
  }
  function sortKeys(ks) { ks.sort(function (x, y) { return x.t - y.t; }); return ks; }
  /** a timeline from a save made safe */
  var ROLES = ["vocals", "instrumental", "voice"];   // 2.965.0
  function cleanTL(j) {
    if (!j || typeof j !== "object" || !Array.isArray(j.layers)) return newTL();
    var o = { v: 1, zoom: num(j.zoom, 40, 4, 400), snap: j.snap !== false, layers: [], markers: cleanMarkers(j.markers), master: num(j.master, 1, 0, 1.5) };
    j.layers.slice(0, MAXL).forEach(function (L, i) {
      L = L || {};
      var l = { name: String(L.name || "Layer " + (i + 1)).replace(/[\u0000-\u001f<>]/g, "").slice(0, 32) || "Layer " + (i + 1), vol: num(L.vol, 1, 0, 1.5), pan: num(L.pan, 0, -1, 1),
                mute: !!L.mute, solo: !!L.solo, clips: [], keys: [], fx: cleanFx(L.fx), auto: cleanAuto(L.auto) };
      if (ROLES.indexOf(L.role) >= 0) l.role = L.role;   // 2.965.0: what a ✂ / 🎤 layer holds (vocals | instrumental | voice)
      (Array.isArray(L.clips) ? L.clips : []).slice(0, MAXC).forEach(function (c) {
        if (!c) return;
        var base;
        if (c.kind === "steps") base = cleanSteps(c, { name: String(c.name || "Steps").slice(0, 120), start: num(c.start, 0, 0, MAXT), off: 0, len: num(c.len, 2, MIN, MAXT) });   // 2.962.0
        else if (c.kind === "notes") base = { kind: "notes", name: String(c.name || "Notes").slice(0, 120), start: num(c.start, 0, 0, MAXT), off: 0, len: num(c.len, 1, MIN, MAXT), notes: cleanNotes(c.notes),
                                         patch: c.patch && typeof c.patch === "object" ? c.patch : null };
        else { var src = okSrc(c.src); if (!src) return; base = { src: src, name: String(c.name || src.replace(/^\w+:/, "")).slice(0, 120), start: num(c.start, 0, 0, MAXT), off: num(c.off, 0, 0, MAXT), len: num(c.len, 1, MIN, MAXT) }; }
        base.gain = num(c.gain, 1, 0, 2); base.fi = num(c.fi, 0, 0, base.len); base.fo = num(c.fo, 0, 0, base.len);
        if (!base.kind && typeof c.grp === "string" && GRP.test(c.grp) && Number.isInteger(+c.ti) && +c.ti >= 0 && +c.ti < MAXTK) { base.grp = c.grp; base.ti = +c.ti; }   // 2.960.0
        l.clips.push(base);
      });
      (Array.isArray(L.keys) ? L.keys : []).slice(0, MAXK).forEach(function (k) { if (k) l.keys.push({ t: num(k.t, 0, 0, MAXT), a: num(k.a, 1, 0, 1), b: num(k.b, 1, 0, 1) }); });
      sortKeys(l.keys); l.comps = cleanComps(L.comps, l); o.layers.push(l);
    });
    if (!o.layers.length) o.layers.push(layer(0));
    o.loop = cleanLoop(j.loop);
    o.tempo = cleanTempo(j.tempo); o.tempoOn = !!j.tempoOn && o.tempo.length > 0;   // 2.961.0
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
  // 2.973.0: force = a layer index (or a list) played whatever its mute / solo say (the timeline's ▶ Layer)
  function schedule(tl, from, force) {
    var out = [], fl = force == null ? null : [].concat(force);
    tl.layers.forEach(function (l, i) {
      if (fl ? fl.indexOf(i) < 0 : !audible(tl, i)) return;
      playable(l).forEach(function (p, pi) {   // 2.960.0: take groups as their comp
        var c = p.c, ci = p.ci;
        if (clipEnd(c) <= from) return;
        var skip = Math.max(0, from - c.start);
        out.push({ layer: i, clip: ci, pi: pi, c: c, src: c.src, kind: c.kind || "audio", when: Math.max(0, c.start - from), skip: skip, off: c.off + skip, dur: c.len - skip });
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
  // 2.973.0: rounded to tenths FIRST - 239.97 s was "3:60.0"
  function fmt(t) { var d = Math.round(Math.max(0, +t || 0) * 10), m = Math.floor(d / 600), s = (d - m * 600) / 10; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }
  var api = { MAXL: MAXL, MIN: MIN, okSrc: okSrc, newTL: newTL, newLayer: layer, cleanTL: cleanTL, clipEnd: clipEnd, end: end, audible: audible, env: env, automation: automation,
              ROLES: ROLES, schedule: schedule, snap: snap, AUTO: AUTO, cleanAuto: cleanAuto, newSteps: newSteps, stepEvents: stepEvents, cleanStepRows: cleanStepRows, DIVS: DIVS, MAXROWS: MAXROWS, cleanTempo: cleanTempo, bpmAt: bpmAt, beatAt: beatAt, timeAt: timeAt, beatTimes: beatTimes, snapBeat: snapBeat, barBeat: barBeat, cleanLoop: cleanLoop, compAt: compAt, comp: comp, ranges: ranges, groups: groups, newest: newest, span: span, playable: playable, passRanges: passRanges, punchCut: punchCut, cleanComps: cleanComps, addTakes: addTakes, dropTake: dropTake, flatten: flatten, moveGroup: moveGroup, MAXTK: MAXTK, autoVal: autoVal, autoNorm: autoNorm, autoAt: autoAt, autoOps: autoOps, cleanFx: cleanFx, cleanMarkers: cleanMarkers, FX0: FX0, cleanNotes: cleanNotes, quantize: quantize, splitClip: splitClip, dupClip: dupClip, fades: fades, clipEnv: clipEnv, envAt: envAt, moveClip: moveClip, trimStart: trimStart, trimEnd: trimEnd, addKey: addKey, sortKeys: sortKeys, peaks: peaks, fmt: fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthTLCore = api;
})(typeof window !== "undefined" ? window : globalThis);
