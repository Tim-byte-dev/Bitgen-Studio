/* bitGen Studio — static/tlmarks.js (2.410.0): the timeline's MARKERS, its EDIT POINTS and the SPLIT AT THE PLAYHEAD
 * - the maths, shared by the page (ext/timelinedock/markers.js, tlkeys.js), the exchange (lib/interchange.js: FCP XML /
 * EDL / OTIO markers) and the tests. window.H3Marks / require().
 *
 * Tim: "continue with the next stages of the premier gap closure" (markers, scene cuts as markers, the keyboard).
 *
 *   tl.seqMarkers = [{t (s), name, color (one of COLORS), note}]   (tl.markers is the older ⊢ First / Last ⊣ / Ref)
 *   list(tl)                     the markers, cleaned and in time order
 *   add(list, t, o)              -> {list, m, added}; one within half a frame of t is that one (renamed by o.name)
 *   move(list, m, t) / remove(list, m)
 *   next(list, t) / prev(list, t)   -> the next / previous marker time, or null
 *   editPoints(tl, lenOf)        every clip's start and end on every layer (+ 0), in order
 *   nextEdit(pts, t) / prevEdit(pts, t)
 *   splitClip(c, t, kind)        -> [left, right] at the timeline time t, or throws in words (outside); 2.413.0: retimed
 *                                clips too (speed, reverse, ramp - through static/clipfx.js slice)
 *
 * 2.412.0 (Tim: "do the smaller jobs and complete the 10 partly done jobs"): MARKER RANGES and CLIP MARKERS.
 *   a marker may carry d (seconds, 0 = a point): a range on the ruler from t to t + d
 *   c.marks = [{t, name, color, note, d}] on a clip: t = the SOURCE second (in the file) for a video / sound clip - the
 *   marker stays on its frame through trims, slips, speed and reverse; seconds from the clip's start for a picture
 *   clipMarks(c) / clipMarkAt(c, kind, m, fx) -> the timeline time or null (trimmed away) / clipMarkFrom(c, kind, T, fx)
 *   addClipMark(c, kind, T, o, fx) / allTimes(tl, lenOf, fx) (every marker + clip marker on the timeline, for M / Shift+M)
 *   fx = H3ClipFx (srcTime / localTime) when the page has it; without it a clip plays 1:1
 */
(function (root) {
  "use strict";
  var COLORS = ["green", "red", "purple", "orange", "yellow", "white", "blue", "cyan"];      // Premiere's eight
  var HEX = { green: "#3fbf5f", red: "#e5484d", purple: "#9b6bf2", orange: "#f59e2c", yellow: "#f2d33f", white: "#f2f2f2", blue: "#3f8cf2", cyan: "#3fd6e0" };
  var EPS = 1e-4;
  function n(v, d) { var x = Number(v); return Number.isFinite(x) ? x : d; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function one(m) {
    if (!m || typeof m !== "object") return null;
    var t = n(m.t, NaN);
    if (!Number.isFinite(t) || t < 0 || t > 86400) return null;
    var c = String(m.color || "green").toLowerCase();
    var o = { t: r4(t), name: String(m.name == null ? "" : m.name).replace(/[\r\n]+/g, " ").slice(0, 120),
             color: COLORS.indexOf(c) >= 0 ? c : "green", note: String(m.note == null ? "" : m.note).slice(0, 2000) };
    var d = n(m.d, 0);
    if (d > 0) o.d = r4(Math.min(d, 86400));                    // 2.412.0: a range
    return o;
  }
  function list(tl) {
    var a = tl && Array.isArray(tl.seqMarkers) ? tl.seqMarkers : [];
    return a.map(one).filter(Boolean).sort(function (x, y) { return x.t - y.t; }).slice(0, 2000);
  }
  function add(L, t, o) {
    var fps = n(o && o.fps, 25), half = 0.5 / Math.max(1, fps), opt = o || {};
    t = Math.max(0, n(t, 0));
    var hit = (L || []).find(function (m) { return Math.abs(m.t - t) <= half; });
    if (hit) { if (opt.name) hit.name = String(opt.name).slice(0, 120); return { list: L, m: hit, added: false }; }
    var m = one({ t: t, name: opt.name || "", color: opt.color || "green", note: opt.note || "" });
    var out = (L || []).concat([m]).sort(function (x, y) { return x.t - y.t; });
    return { list: out, m: out[out.indexOf(m)], added: true };
  }
  function move(L, m, t) { if (m) m.t = r4(Math.max(0, n(t, m.t))); return (L || []).slice().sort(function (x, y) { return x.t - y.t; }); }
  function remove(L, m) { return (L || []).filter(function (x) { return x !== m; }); }
  function next(L, t) { var h = (L || []).find(function (m) { return m.t > n(t, 0) + 1e-3; }); return h ? h.t : null; }
  function prev(L, t) { var a = (L || []).filter(function (m) { return m.t < n(t, 0) - 1e-3; }); return a.length ? a[a.length - 1].t : null; }

  function lenDefault(c, kind) {
    if (kind === "img") return Math.max(0.1, n(c.len, 3));
    return Math.max(0.1, n(c.out != null ? c.out : c.dur, 5) - n(c.in, 0));
  }
  /** every cut on every layer; lenOf(c, kind) -> the clip's length on the timeline (the page passes effDur) */
  function editPoints(tl, lenOf) {
    var L = lenOf || lenDefault, s = { 0: true };
    function put(c, kind) { if (!c) return; var a = Math.max(0, n(c.start, 0)); s[r4(a)] = true; s[r4(a + L(c, kind))] = true; }
    ((tl && tl.video) || []).forEach(function (c) { put(c, "v1"); });
    ((tl && tl.vlayers) || []).forEach(function (Ly) { ((Ly && Ly.clips) || []).forEach(function (c) { put(c, "vl"); }); });
    ((tl && tl.images) || []).forEach(function (Ly) { ((Ly && Ly.clips) || []).forEach(function (c) { put(c, "img"); }); });
    ((tl && tl.audio) || []).forEach(function (Ly) { ((Ly && Ly.clips) || []).forEach(function (c) { put(c, "aud"); }); });
    return Object.keys(s).map(Number).sort(function (a, b) { return a - b; });
  }
  function nextEdit(pts, t) { var h = (pts || []).find(function (p) { return p > n(t, 0) + 1e-3; }); return h == null ? null : h; }
  function prevEdit(pts, t) { var a = (pts || []).filter(function (p) { return p < n(t, 0) - 1e-3; }); return a.length ? a[a.length - 1] : null; }

  function bad(msg) { var e = new Error(msg); e.status = 400; return e; }
  /** a clip cut in two at the timeline time t. kind "img" = a picture ({start, len}); else {start, in, out}. */
  function splitClip(c, t, kind, minLen) {
    var MIN = n(minLen, 1 / 25), s0 = n(c.start, 0);
    if (kind === "img") {
      var len = n(c.len, 3);
      if (!(t > s0 + MIN - EPS && t < s0 + len - MIN + EPS)) throw bad("the position marker is not inside that picture");
      var a = Object.assign({}, c, { len: r4(t - s0) }), b = Object.assign({}, c, { start: r4(t), len: r4(s0 + len - t) });
      delete b.kf;
      if (Array.isArray(c.marks)) {         // 2.412.0: a picture's markers count from its start - the right half's move back
        a.marks = c.marks.filter(function (m) { return m.t <= t - s0 + EPS; }).map(function (m) { return Object.assign({}, m); });
        b.marks = c.marks.filter(function (m) { return m.t >= t - s0 - EPS; }).map(function (m) { return Object.assign({}, m, { t: r4(m.t - (t - s0)) }); });
        if (!a.marks.length) delete a.marks; if (!b.marks.length) delete b.marks;
      }
      return [a, b];
    }
    var fx = c.fx || {};
    if (fx.reverse || fx.ramp || (fx.speed != null && Math.abs(n(fx.speed, 1) - 1) > 1e-4)) {
      // 2.413.0: a 🎬 retimed clip splits through its own time map (static/clipfx.js slice - a ramp re-fitted to each half)
      var F = root.H3ClipFx || (typeof require === "function" ? (function () { try { return require("./clipfx.js"); } catch (e) { return null; } })() : null);
      if (!F) throw bad("a 🎬 retimed clip needs the speed maths (static/clipfx.js) to be split");
      var full = Object.assign({}, c, { out: n(c.out != null ? c.out : c.dur, n(c.in, 0) + 5) }), Lt = F.clipLen(full), at = t - s0;
      if (!(at > MIN - EPS && at < Lt - MIN + EPS)) throw bad("the position marker is not inside that clip");
      var a = F.slice(full, 0, at), b = F.slice(full, at, Lt);
      var Lr = Object.assign({}, c, { in: a.in, out: a.out }), Rr = Object.assign({}, c, { in: b.in, out: b.out, start: r4(t) });
      if (a.fx) Lr.fx = a.fx; if (b.fx) Rr.fx = b.fx;
      delete Rr.kf; delete Rr.split;
      if (Array.isArray(c.marks)) { Lr.marks = c.marks.map(function (m) { return Object.assign({}, m); }); Rr.marks = c.marks.map(function (m) { return Object.assign({}, m); }); }
      return [Lr, Rr];
    }
    var i0 = n(c.in, 0), o0 = n(c.out != null ? c.out : c.dur, i0 + 5), cut = i0 + (t - s0);
    if (!(cut > i0 + MIN - EPS && cut < o0 - MIN + EPS)) throw bad("the position marker is not inside that clip");
    var L = Object.assign({}, c, { out: r4(cut) }), R = Object.assign({}, c, { in: r4(cut), start: r4(t) });
    delete R.kf; delete R.split;
    if (Array.isArray(c.marks)) { L.marks = c.marks.map(function (m) { return Object.assign({}, m); }); R.marks = c.marks.map(function (m) { return Object.assign({}, m); }); }   // 2.412.0: on their frames, each half shows its own
    return [L, R];
  }
  /* ---------- 2.412.0: clip markers */
  function clipMarks(c) {
    var a = c && Array.isArray(c.marks) ? c.marks : [];
    return a.map(one).filter(Boolean).sort(function (x, y) { return x.t - y.t; }).slice(0, 500);
  }
  function clipLenOf(c, kind, fx) {
    if (kind === "img") return Math.max(0.1, n(c.len, 3));
    if (fx && fx.clipLen && fx.retimed && fx.retimed(c.fx)) return fx.clipLen(c) || 0.1;
    return Math.max(0.1, n(c.out != null ? c.out : c.dur, 5) - n(c.in, 0));
  }
  /** a clip marker -> its time on the timeline, or null when the clip's trim leaves its frame out */
  function clipMarkAt(c, kind, m, fx) {
    var s0 = n(c.start, 0), t = n(m && m.t, NaN);
    if (!Number.isFinite(t)) return null;
    if (kind === "img") return t <= n(c.len, 3) + 1e-6 ? r4(s0 + t) : null;
    var loc;
    if (fx && fx.localTime) loc = fx.localTime(c, t);
    else { var i0 = n(c.in, 0), o0 = n(c.out != null ? c.out : c.dur, i0 + 5); loc = t >= i0 - 1e-6 && t <= o0 + 1e-6 ? t - i0 : null; }
    return loc == null ? null : r4(s0 + loc);
  }
  /** the timeline time T on a clip -> the clip marker's own t (its source second / seconds from a picture's start) */
  function clipMarkFrom(c, kind, T, fx) {
    var loc = Math.max(0, Math.min(clipLenOf(c, kind, fx), n(T, 0) - n(c.start, 0)));
    if (kind === "img") return r4(loc);
    if (fx && fx.srcTime) return r4(fx.srcTime(c, loc));
    return r4(n(c.in, 0) + loc);
  }
  function addClipMark(c, kind, T, o, fx) {
    var t = clipMarkFrom(c, kind, T, fx), L = clipMarks(c), fps = n(o && o.fps, 25), half = 0.5 / Math.max(1, fps), opt = o || {};
    var hit = L.find(function (m) { return Math.abs(m.t - t) <= half; });
    if (hit) { c.marks = L; if (opt.name) hit.name = String(opt.name).slice(0, 120); return { m: hit, added: false }; }
    var m = one({ t: t, name: opt.name || "", color: opt.color || "orange", note: opt.note || "", d: opt.d });
    c.marks = L.concat([m]).sort(function (x, y) { return x.t - y.t; });
    return { m: m, added: true };
  }
  /** every marker time on the timeline: sequence markers (+ a range's end) and every clip's markers (for next / prev) */
  function allTimes(tl, fx) {
    var s = {};
    list(tl).forEach(function (m) { s[m.t] = true; if (m.d) s[r4(m.t + m.d)] = true; });
    function each(c, kind) { clipMarks(c).forEach(function (m) { var T = clipMarkAt(c, kind, m, fx); if (T != null) s[T] = true; }); }
    ((tl && tl.video) || []).forEach(function (c) { each(c, "v1"); });
    ((tl && tl.vlayers) || []).forEach(function (Ly) { ((Ly && Ly.clips) || []).forEach(function (c) { each(c, "vl"); }); });
    ((tl && tl.images) || []).forEach(function (Ly) { ((Ly && Ly.clips) || []).forEach(function (c) { each(c, "img"); }); });
    ((tl && tl.audio) || []).forEach(function (Ly) { ((Ly && Ly.clips) || []).forEach(function (c) { each(c, "aud"); }); });
    return Object.keys(s).map(Number).sort(function (a, b) { return a - b; });
  }
  var api = { COLORS: COLORS, HEX: HEX, one: one, list: list, add: add, move: move, remove: remove, next: next, prev: prev,
              editPoints: editPoints, nextEdit: nextEdit, prevEdit: prevEdit, splitClip: splitClip,
              clipMarks: clipMarks, clipMarkAt: clipMarkAt, clipMarkFrom: clipMarkFrom, addClipMark: addClipMark, allTimes: allTimes };
  root.H3Marks = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
