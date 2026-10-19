/* bitGen Studio — static/textedit.js (2.408.0): EDIT BY TRANSCRIPT and SCENE CUTS as pure maths - the page
 * (ext/timelinedock/textedit.js) and the unit tests load this one file.
 *
 * A clip's spoken words (source seconds, from lib/captions' transcript cache) are cut by deleting words, by dropping
 * the pauses between them or the filler words; a clip is split at its shot changes. Every edit turns a clip into
 * PIECES of the same file (in / out), laid end to end from where it started, and (ripple) the clips after it on the
 * same layer move up by what was taken out. 2.413.0: a 🎬 retimed clip (speed / reverse / ramp) too - the word times
 * are SOURCE seconds; each kept stretch becomes a piece through the clip's own time map (static/clipfx.js localTime +
 * slice: a ramp re-fitted to each piece), laid end to end in the order it PLAYS (a reversed clip: from the end).
 * Tim: "... continue with the premier catchup - do whats most useful next".
 * 2.414.0: units / applyUnits - ONE transcript across a whole layer or the whole sequence (every clip that speaks, in
 * the order they play); a cut ripples its layer, or with sync every layer. Tim: "lets do the medium jobs now". */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./clipfx.js"));
  else root.H3TextEdit = factory(root.H3ClipFx);
})(typeof self !== "undefined" ? self : this, function (FX) {
  "use strict";
  var MINP = 0.08, EPS = 0.05;
  var FILLERS = /^(u+m+|u+h+|e+r+m*|a+h+|h+m+|m+h*m+|e+h+|uh-huh|mm-hmm)$/i;
  function n(v, d) { var x = Number(v); return Number.isFinite(x) ? x : d; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function outOf(c) { return c.out != null ? n(c.out, 0) : n(c.dur, n(c.in, 0) + 5); }
  function retimed(c) { return !!(FX && c && c.fx && FX.retimed(c.fx)); }
  function tlLen(c) { return retimed(c) ? FX.clipLen(Object.assign({}, c, { out: outOf(c) })) : outOf(c) - n(c.in, 0); }
  /** 2.413.0: a source stretch [a, b] of a retimed clip -> its piece {in, out, fx} and its timeline length */
  function piece(c, a, b) {
    var full = Object.assign({}, c, { out: outOf(c) }), la = FX.localTime(full, a), lb = FX.localTime(full, b);
    var lo = Math.min(la, lb), hi = Math.max(la, lb), sl = FX.slice(full, lo, hi);
    var p = Object.assign({}, c, { in: sl.in, out: sl.out }); if (sl.fx) p.fx = sl.fx;
    return { p: p, at: lo, len: FX.clipLen(p) };
  }
  function clean(w) { return String(w || "").toLowerCase().replace(/[^\p{L}\p{N}'-]+/gu, ""); }

  /** merge + sort source ranges [[a, b] ...] (touching / overlapping ones become one) */
  function merge(ranges) {
    var r = (ranges || []).filter(function (x) { return x && x[1] - x[0] > 1e-4; }).map(function (x) { return [n(x[0], 0), n(x[1], 0)]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    r.forEach(function (x) { var l = out[out.length - 1]; if (l && x[0] <= l[1] + 1e-4) l[1] = Math.max(l[1], x[1]); else out.push(x.slice()); });
    return out;
  }

  /** the clip without the source ranges: {pieces (copies, laid end to end from c.start), removed (seconds)} */
  function remove(c, ranges) {
    var i0 = n(c.in, 0), o0 = outOf(c), keep = [], cur = i0;
    merge(ranges).forEach(function (r) {
      var a = Math.max(i0, r[0]), b = Math.min(o0, r[1]);
      if (b <= a) return;
      if (a - cur >= MINP) keep.push([cur, a]);
      cur = Math.max(cur, b);
    });
    if (o0 - cur >= MINP) keep.push([cur, o0]);
    if (retimed(c)) {                                   // 2.413.0: through the clip's time map, in the order it plays
      var T0 = tlLen(c), tt = n(c.start, 0), made = keep.map(function (k) { return piece(c, k[0], k[1]); }).sort(function (x, y) { return x.at - y.at; });
      var ps = made.map(function (m) { var q = Object.assign(m.p, { start: r4(tt) }); delete q.kf; delete q.split; tt += m.len; return q; });
      return { pieces: ps, removed: r4(T0 - made.reduce(function (s0, m) { return s0 + m.len; }, 0)) };
    }
    var t = n(c.start, 0), pieces = keep.map(function (k) {
      var p = Object.assign({}, c, { in: r4(k[0]), out: r4(k[1]), start: r4(t) });
      delete p.kf; delete p.split;                 // keyframes / a J-L cut belonged to the whole clip
      t += k[1] - k[0];
      return p;
    });
    var kept = keep.reduce(function (s, k) { return s + (k[1] - k[0]); }, 0);
    return { pieces: pieces, removed: r4((o0 - i0) - kept) };
  }

  /** the clip split at source seconds (no time removed): pieces in place */
  function splitAt(c, times) {
    var i0 = n(c.in, 0), o0 = outOf(c), cuts = (times || []).map(Number).filter(function (t) { return t > i0 + MINP && t < o0 - MINP; })
      .sort(function (a, b) { return a - b; });
    var edges = [i0].concat(cuts.filter(function (t, k) { return !k || t - cuts[k - 1] >= MINP; }), [o0]), t0 = n(c.start, 0);
    var out = [];
    if (retimed(c)) {                                   // 2.413.0: each piece where it plays (a reversed clip: from its end)
      for (var q = 0; q + 1 < edges.length; q++) {
        var m = piece(c, edges[q], edges[q + 1]);
        m.p.start = r4(t0 + m.at); out.push(m.p);
      }
      out.sort(function (x, y) { return x.start - y.start; });
      out.forEach(function (p, k) { if (k) { delete p.kf; delete p.split; } });
      return out;
    }
    for (var k = 0; k + 1 < edges.length; k++) {
      var p = Object.assign({}, c, { in: r4(edges[k]), out: r4(edges[k + 1]), start: r4(t0 + (edges[k] - i0)) });
      if (k) { delete p.kf; delete p.split; }
      out.push(p);
    }
    return out;
  }

  /** a layer's clips with c replaced by its pieces; ripple moves the clips after it by -removed */
  function replace(clips, c, pieces, removed, ripple) {
    var end = n(c.start, 0) + tlLen(c), out = [];
    (clips || []).forEach(function (x) {
      if (x === c) { out.push.apply(out, pieces); return; }
      if (ripple && removed > 0 && n(x.start, 0) >= end - EPS) out.push(Object.assign({}, x, { start: r4(Math.max(0, n(x.start, 0) - removed)) }));
      else out.push(x);
    });
    return out;
  }

  /** the words of a clip (its in..out), each with its index into `words` */
  function within(words, c) {
    var i0 = n(c.in, 0), o0 = outOf(c);
    return (words || []).map(function (w, i) { return Object.assign({ i: i }, w); })
      .filter(function (w) { return w.end > i0 + 1e-3 && w.start < o0 - 1e-3; });
  }
  /** deleting the chosen words -> source ranges: each run of chosen words, up to where the next kept word starts */
  function wordRanges(words, chosen) {
    var set = {}; (chosen || []).forEach(function (i) { set[i] = true; });
    var out = [];
    for (var i = 0; i < words.length; i++) {
      if (!set[i]) continue;
      var j = i; while (j + 1 < words.length && set[j + 1]) j++;
      var a = n(words[i].start, 0), b = j + 1 < words.length ? n(words[j + 1].start, 0) : n(words[j].end, 0);
      if (i > 0 && !set[i - 1]) a = Math.max(n(words[i - 1].end, 0), a - 0.02);
      out.push([a, Math.max(a, b - 0.02)]);
      i = j;
    }
    return merge(out);
  }
  /** keeping only the chosen words -> the ranges to remove (everything else) within [i0, o0] */
  function keepRanges(words, chosen, i0, o0) {
    var keep = merge((chosen || []).map(function (i) { return [n(words[i].start, 0) - 0.05, n(words[i].end, 0) + 0.08]; }));
    var out = [], cur = i0;
    keep.forEach(function (k) { if (k[0] > cur) out.push([cur, k[0]]); cur = Math.max(cur, k[1]); });
    if (cur < o0) out.push([cur, o0]);
    return out;
  }
  /** the silences between words longer than `min` seconds -> ranges to remove (leaving `pad` either side) */
  function pauseRanges(words, min, pad, i0, o0) {
    var m = Math.max(0.2, n(min, 0.8)), p = Math.max(0, n(pad, 0.15)), out = [];
    var edges = [{ end: i0 }].concat(words || [], [{ start: o0 }]);
    for (var k = 0; k + 1 < edges.length; k++) {
      var a = n(edges[k].end, i0), b = n(edges[k + 1].start, o0);
      if (b - a >= m) out.push([a + p, b - p]);
    }
    return merge(out);
  }
  /** the filler words (um, uh, erm, hmm …): their indices */
  function fillers(words) {
    var out = [];
    (words || []).forEach(function (w, i) { if (FILLERS.test(clean(w.word || w.text))) out.push(i); });
    return out;
  }

  /* ---------------- 2.414.0: a WHOLE LAYER or the WHOLE SEQUENCE as one transcript (Tim: "lets do the medium jobs now")
     A "unit" is one clip on one layer {lk, c}; lk = "v1" | "vl:<i>" | "a:<i>" | "i:<i>" (the page's layer keys). */
  function listOf(T, lk) {
    if (lk === "v1") return T.video || [];
    var m = /^(vl|a|i):(\d+)$/.exec(String(lk || "")); if (!m) return [];
    var L = (m[1] === "vl" ? T.vlayers : m[1] === "a" ? T.audio : T.images || [])[+m[2]];
    return (L && L.clips) || [];
  }
  function setList(T, lk, list) {
    if (lk === "v1") { T.video = list; return; }
    var m = /^(vl|a|i):(\d+)$/.exec(String(lk || "")); if (!m) return;
    var L = (m[1] === "vl" ? T.vlayers : m[1] === "a" ? T.audio : T.images || [])[+m[2]];
    if (L) L.clips = list;
  }
  function layerKeys(T) {
    var out = ["v1"];
    (T.vlayers || []).forEach(function (L, i) { out.push("vl:" + i); });
    (T.audio || []).forEach(function (L, i) { out.push("a:" + i); });
    (T.images || []).forEach(function (L, i) { out.push("i:" + i); });
    return out;
  }
  function speaks(c) { return !!(c && c.name && !c.m3d && !c.text && !c.adjust); }
  /** the clips a transcript covers, in the order they play: scope "clip" (the pieces of target.name on target.lk),
   *  "layer" (every clip on target.lk), "seq" (V1, every video layer and every 🗣 voice sound layer that is heard) */
  function units(T, scope, target) {
    var out = [], keys = [];
    if (scope === "seq") {
      if (!(T.v1 && T.v1.muted)) keys.push("v1");
      (T.vlayers || []).forEach(function (L, i) { if (L && !L.muted && L.visible !== false && !L.karaoke) keys.push("vl:" + i); });
      (T.audio || []).forEach(function (L, i) {
        if (L && !L.muted && L.visible !== false && ((L.role || "music") === "voice" || (L.clips || []).some(function (c) { return c && c.role === "voice"; }))) keys.push("a:" + i);
      });
    } else if (target && target.lk) keys.push(target.lk);
    keys.forEach(function (lk, order) {
      listOf(T, lk).forEach(function (c) {
        if (!speaks(c) || /^i:/.test(lk)) return;
        if (scope === "clip" && target && c.name !== target.name) return;
        if (scope === "seq" && /^a:/.test(lk) && (c.role || ((T.audio[+lk.slice(2)] || {}).role) || "music") !== "voice") return;
        out.push({ lk: lk, c: c, order: order });
      });
    });
    return out.sort(function (a, b) { return n(a.c.start, 0) - n(b.c.start, 0) || a.order - b.order; });
  }
  /** a source second of a clip -> where it plays on the timeline (its speed / reverse / ramp too) */
  function tlAt(c, src) {
    if (!retimed(c)) return n(c.start, 0) + (src - n(c.in, 0));
    return n(c.start, 0) + FX.localTime(Object.assign({}, c, { out: outOf(c) }), src);
  }
  /** clips that start at / after `from` moved `by` seconds earlier (a sequence-wide ripple) */
  function shiftAfter(clips, from, by) {
    return (clips || []).map(function (x) {
      return n(x.start, 0) >= from - EPS ? Object.assign({}, x, { start: r4(Math.max(0, n(x.start, 0) - by)) }) : x;
    });
  }
  /** cut every unit by rangesFor(unit) (source ranges), the last one first; its own layer ripples - and with sync every
   *  layer does (the clips after it on every layer move up, so the sequence stays in step). Mutates T -> {total, made} */
  function applyUnits(T, list, rangesFor, sync) {
    var total = 0, made = 0;
    list.slice().sort(function (a, b) { return n(b.c.start, 0) - n(a.c.start, 0) || b.order - a.order; }).forEach(function (u) {
      var r = rangesFor(u); if (!r || !r.length) return;
      var cl = listOf(T, u.lk); if (cl.indexOf(u.c) < 0) return;
      var out = remove(u.c, r); if (!out.removed) return;
      var end = n(u.c.start, 0) + tlLen(u.c);
      setList(T, u.lk, replace(cl, u.c, out.pieces, out.removed, true));
      if (sync) layerKeys(T).forEach(function (k) { if (k !== u.lk) setList(T, k, shiftAfter(listOf(T, k), end, out.removed)); });
      total += out.removed; made++;
    });
    return { total: r4(total), made: made };
  }

  return { merge: merge, remove: remove, splitAt: splitAt, replace: replace, within: within, wordRanges: wordRanges,
           keepRanges: keepRanges, pauseRanges: pauseRanges, fillers: fillers, FILLERS: FILLERS,
           listOf: listOf, setList: setList, layerKeys: layerKeys, units: units, tlAt: tlAt, shiftAfter: shiftAfter, applyUnits: applyUnits };
});
