/* bitGen Studio — THE SEGMENT MAP EDITOR, core (2.289.0).
 *
 * Tim (verbatim): "when we are making a music video, put a load audio
 * button in the video docker menubar. load a waveform of the song, auto
 * segment the song the same as the stem docker does it (do not actually
 * cut the files) just save the segment start time and duration to the
 * .seg file, create the blank scenes on save, populate the start and
 * duration inputs for each scene."
 *
 * The segment map (the red lines, the 1-second floors, the [manual]
 * lock, the whole-body drag of a locked segment, the zoom window) was a
 * stems-dock private until now. A second docker needs it, and the
 * standing ruling is "anything that is shared among extensions should be
 * core" — so the MODEL and the one-canvas editor live HERE, the same
 * rules the 2.285/2.286 stems dock enforces, written once:
 *   - a map is {total, durations, boundaries, manual}; boundaries are
 *     cumulative seconds EXCLUDING 0 and total (the server's shape);
 *   - a red line drags between its neighbours (>= 1 s each side) and
 *     REFUSES when it borders a locked segment;
 *   - a typed duration LOCKS its segment; later OPEN segments absorb the
 *     change (1 s floors, locked ones never robbed; the last segment
 *     leans on the nearest open one before it) — clamps said in words;
 *   - a locked segment's BODY drags whole (both cuts together); locked
 *     neighbours are walls, open ones compress to 1 s; first/last refuse;
 *   - ONE view window {t0,t1} in song fractions; zoom x2 about the
 *     centre, the wheel pans while zoomed.
 * Nothing here talks to the server: the host docker loads the map from
 * GET /api/stems/segments and saves wherever its button says.
 *
 * Loads before the ext scripts (static/), touches no DOM at load, and is
 * require()-able from node so the model is unit-tested directly
 * (scripts/test-segmap.js). */
(function (root) {
  "use strict";
  var r1 = function (x) { return Math.round(x * 10) / 10; };

  /** A map from the server's GET /api/stems/segments answer (or null). */
  function from(j) {
    if (!j || !(j.total > 0) || !Array.isArray(j.durations) || !j.durations.length)
      return null;
    var S = { song: String(j.song || ""), total: +j.total,
              durations: j.durations.map(Number),
              manual: (Array.isArray(j.manual) ? j.manual : []).map(Boolean),
              boundaries: [], file: j.file || null };
    while (S.manual.length < S.durations.length) S.manual.push(false);
    var acc = 0;
    for (var i = 0; i < S.durations.length - 1; i++) {
      acc += S.durations[i]; S.boundaries.push(acc);
    }
    return S;
  }

  /** boundaries -> durations, in place (the boundaries are the truth
   *  while dragging; the durations follow). */
  function recalc(S) {
    if (!S) return S;
    var ds = [], prev = 0;
    for (var i = 0; i < S.boundaries.length; i++) {
      ds.push(S.boundaries[i] - prev); prev = S.boundaries[i];
    }
    ds.push(S.total - prev);
    S.durations = ds;
    return S;
  }

  /** The windows the scenes take: [{n, start, dur}] (0.1 s rounding —
   *  the .seg file's own precision). */
  function windows(S) {
    var out = [], acc = 0;
    if (!S) return out;
    for (var i = 0; i < S.durations.length; i++) {
      out.push({ n: i + 1, start: r1(acc), dur: r1(S.durations[i]) });
      acc += S.durations[i];
    }
    return out;
  }

  /** Which segment a time (seconds) falls in. */
  function segAt(S, t) {
    if (!S || !S.total) return -1;
    var acc = 0;
    for (var i = 0; i < S.durations.length; i++) {
      acc += S.durations[i];
      if (t < acc) return i;
    }
    return S.durations.length - 1;
  }

  /** Which red line is within `tol` seconds of `t` (-1 = none). */
  function lineAt(S, t, tol) {
    if (!S || !S.total) return -1;
    for (var i = 0; i < S.boundaries.length; i++)
      if (Math.abs(t - S.boundaries[i]) <= tol) return i;
    return -1;
  }

  /** May line `idx` move at all? A cut bordering a LOCKED segment may
   *  not — the lock means the lock. Returns the refusal in words or "". */
  function lineRefusal(S, idx) {
    if (S && S.manual && (S.manual[idx] || S.manual[idx + 1]))
      return "that cut borders a locked segment - drag the locked segment's "
        + "body to move it whole, or click its duration to change it";
    return "";
  }

  /** Move red line `idx` to `t` seconds, clamped between its neighbours
   *  (>= 1 s each side). Returns {ok, note}.
   *  step (2.310.0, Tim: "when user drags the duration marker over the
   *  waveform, round up to the nearest second, no decimal places, in video
   *  docker"): the cut lands on the nearest whole multiple of `step`
   *  seconds, kept inside the same clamp (the clamp's own edges rounded
   *  inward, so a snapped cut never breaks the 1 s floors). */
  function moveLine(S, idx, t, step) {
    if (!S || idx < 0 || idx >= S.boundaries.length) return { ok: false, note: "" };
    var no = lineRefusal(S, idx);
    if (no) return { ok: false, note: no };
    var lo = idx > 0 ? S.boundaries[idx - 1] + 1 : 1;
    var hi = idx < S.boundaries.length - 1 ? S.boundaries[idx + 1] - 1 : S.total - 1;
    if (step > 0) {
      t = Math.round(t / step) * step;
      var slo = Math.ceil(lo / step - 1e-9) * step, shi = Math.floor(hi / step + 1e-9) * step;
      if (slo <= shi) { lo = slo; hi = shi; }
    }
    S.boundaries[idx] = Math.max(lo, Math.min(hi, t));
    recalc(S);
    return { ok: true, note: "" };
  }

  /** Drag a LOCKED segment's body by dt seconds (both cuts together,
   *  duration preserved). Returns {ok, note, dt} — dt as applied. */
  function moveBody(S, i, dt, step) {
    if (!S || !S.manual || !S.manual[i]) return { ok: false, note: "", dt: 0 };
    if (i === 0 || i === S.durations.length - 1)
      return { ok: false, dt: 0, note: "the first and last segments sit against "
        + "the song's edges - change their duration by clicking the label" };
    var st0 = S.boundaries[i - 1];
    var en0 = S.boundaries[i];
    var minSt = (i > 1 ? S.boundaries[i - 2] : 0)
      + (S.manual[i - 1] ? S.durations[i - 1] : 1);
    var maxEn = (i < S.boundaries.length - 1 ? S.boundaries[i + 1] : S.total)
      - (S.manual[i + 1] ? S.durations[i + 1] : 1);
    var d = Math.max(minSt - st0, Math.min(maxEn - en0, dt));
    if (step > 0) {                   // 2.310.0: the start lands on a whole step
      var want = Math.round((st0 + d) / step) * step - st0;
      if (want >= minSt - st0 - 1e-9 && want <= maxEn - en0 + 1e-9) d = want;
      else d = 0;
    }
    S.boundaries[i - 1] = st0 + d;
    S.boundaries[i] = en0 + d;
    recalc(S);
    return { ok: true, note: "", dt: d };
  }

  /** A typed duration: LOCKS segment i at v seconds. The later OPEN
   *  segments absorb the change - the LAST open one first, then the ones
   *  before it, each keeping 1 s; LOCKED segments are never robbed (or
   *  padded). The final segment leans on the nearest open one before it.
   *  Returns {ok, note} - a clamp is said in words, never silent.
   *  (2.289.0: the stems dock's 2.286 copy slid EVERY later cut by the
   *  difference, so the last segment alone paid - past its own length it
   *  went NEGATIVE, and a locked last segment was robbed. Absorbing
   *  segment by segment is what the rule always said.) */
  function setManual(S, i, v) {
    if (!S || !(v > 0) || i < 0 || i >= S.durations.length) return { ok: false, note: "" };
    var n = S.durations.length, note = "";
    var ds = S.durations.slice();
    var delta = v - ds[i];
    if (Math.abs(delta) < 0.05) { S.manual[i] = true; return { ok: true, note: "" }; }
    if (i < n - 1) {
      var room = 0, open = [];
      for (var k = i + 1; k < n; k++)
        if (!S.manual[k]) { room += Math.max(0, ds[k] - 1); open.push(k); }
      if (!open.length)
        return { ok: false, note: "every segment after it is locked - unlock one first" };
      if (delta > room) {
        v = ds[i] + room; delta = room;
        note = "clamped to " + r1(v) + "s - the open segments after it can only give up "
          + Math.round(room) + "s";
        if (delta <= 0) return { ok: false, note: note };
      }
      ds[i] += delta;
      if (delta < 0) ds[open[open.length - 1]] -= delta;       // the last open one gains
      else {
        var rest = delta;                                      // the last open one pays first
        for (var o = open.length - 1; o >= 0 && rest > 1e-9; o--) {
          var take = Math.min(rest, Math.max(0, ds[open[o]] - 1));
          ds[open[o]] -= take; rest -= take;
        }
      }
    } else {
      var j = i - 1;
      while (j >= 0 && S.manual[j]) j--;
      if (j < 0) return { ok: false, note: "every earlier segment is locked - unlock one first" };
      var give = Math.max(0, ds[j] - 1);
      if (delta > give) {
        v = ds[i] + give;
        note = "clamped to " + r1(v) + "s - segment " + (j + 1) + " can only give up "
          + Math.round(give) + "s";
        delta = give;
        if (delta <= 0) return { ok: false, note: note };
      }
      ds[i] += delta; ds[j] -= delta;
    }
    var acc = 0;
    for (var b = 0; b < n - 1; b++) { acc += ds[b]; S.boundaries[b] = acc; }
    recalc(S);
    S.durations[i] = r1(S.durations[i]);
    S.manual[i] = true;
    return { ok: true, note: note };
  }

  /** ONE view window in song fractions [0..1]. */
  function View() {
    var v = { t0: 0, t1: 1 };
    v.span = function () { return Math.max(1e-6, v.t1 - v.t0); };
    v.fToView = function (f) { return (f - v.t0) / v.span(); };   // song -> canvas
    v.vToF = function (x) { return v.t0 + x * v.span(); };        // canvas -> song
    v.zoom = function (factor) {
      var c = (v.t0 + v.t1) / 2, half = v.span() / 2 * factor;
      half = Math.min(0.5, Math.max(0.005, half));
      v.t0 = Math.max(0, c - half); v.t1 = Math.min(1, c + half);
      if (v.t1 - v.t0 < half * 2) {                           // hit an edge
        if (v.t0 === 0) v.t1 = Math.min(1, v.t0 + half * 2);
        else v.t0 = Math.max(0, v.t1 - half * 2);
      }
    };
    v.pan = function (df) {
      var s = v.span();
      v.t0 = Math.max(0, Math.min(1 - s, v.t0 + df)); v.t1 = v.t0 + s;
    };
    v.reset = function () { v.t0 = 0; v.t1 = 1; };
    v.zoomed = function () { return v.t1 - v.t0 < 1; };
    return v;
  }

  /** Peaks (0..255 per bucket) through the view; the played part hot. */
  function drawPeaks(ctx, peaks, view, W, H, playFrac, base, hot) {
    if (!ctx || !peaks || !peaks.length) return;
    var n = peaks.length, mid = H / 2;
    for (var x = 0; x < W; x++) {
      var sf = view.vToF(x / W);
      var pk = peaks[Math.max(0, Math.min(n - 1, Math.floor(sf * n)))] / 255;
      var h = Math.max(1, pk * (H - 2));
      ctx.fillStyle = sf <= (playFrac || 0) ? hot : base;
      ctx.fillRect(x, mid - h / 2, 1, h);
    }
  }

  /** The red lines and each segment's duration (lock glyph when manual). */
  function drawOverlay(ctx, S, view, W, H, dpr, red, whole) {
    if (!ctx || !S || !(S.total > 0)) return;
    ctx.save();
    ctx.fillStyle = red;
    for (var bi = 0; bi < S.boundaries.length; bi++) {
      var bx = Math.round(view.fToView(S.boundaries[bi] / S.total) * W);
      if (bx < -2 || bx > W + 2) continue;
      ctx.fillRect(bx - Math.max(1, dpr), 0, Math.max(2, 2 * dpr), H);
    }
    ctx.font = Math.round(9 * dpr) + "px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    var prevT = 0;
    for (var si = 0; si < S.durations.length; si++) {
      var endT = prevT + S.durations[si];
      var cx = view.fToView((prevT + endT) / 2 / S.total) * W;
      if (cx >= -20 && cx <= W + 20)
        ctx.fillText((S.manual && S.manual[si] ? "🔒" : "")
          + (whole ? Math.round(S.durations[si]) : r1(S.durations[si])) + "s", cx, 1 * dpr);
      prevT = endT;
    }
    ctx.restore();
  }

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (v && v.trim()) || fallback;
    } catch (e) { return fallback; }
  }

  /** The number box a duration-label click opens (Enter/blur applies,
   *  Escape cancels). */
  var openBox = null;
  function openInput(S, i, ev, apply, whole) {
    if (openBox) { try { openBox.remove(); } catch (e) {} openBox = null; }
    var box = document.createElement("input");
    box.type = "number"; box.min = "1"; box.step = whole ? "1" : "0.1";
    box.className = "segmap-input";
    box.value = whole ? Math.round(S.durations[i]) : r1(S.durations[i]);
    box.title = "Segment " + (i + 1) + " duration in seconds - Enter locks it";
    box.style.cssText = "position:fixed;z-index:9999;width:64px;"
      + "left:" + Math.round((ev.clientX || 0) - 32) + "px;"
      + "top:" + Math.round((ev.clientY || 0) + 8) + "px;";
    document.body.appendChild(box); openBox = box;
    try { box.focus(); box.select(); } catch (e2) {}
    var done = function (ok) {
      if (openBox !== box) return;
      var v = parseFloat(box.value);
      try { box.remove(); } catch (e3) {}
      openBox = null;
      if (whole) v = Math.round(v);      // 2.310.0: whole seconds
      if (ok && v > 0) apply(v);
    };
    box.addEventListener("keydown", function (k) {
      if (k.key === "Enter") done(true);
      if (k.key === "Escape") done(false);
    });
    box.addEventListener("blur", function () { done(true); });
    box.addEventListener("pointerdown", function (k) { k.stopPropagation(); });
    return box;
  }

  /** A whole one-canvas editor. opts:
   *    onChange(S, note)  — the map changed (drag / typed duration)
   *    onNote(note)       — a refusal or clamp, in words
   *    onSeek(frac)       — a plain click at song fraction frac
   *    playFrac()         — how far the player is (0..1), for the hot wave
   *    snap               — seconds: a dragged cut lands on a whole multiple,
   *                         labels and the typed box drop the decimals
   *                         (2.310.0 - the video dock passes 1)
   *  Returns {setSegs, segs, setPeaks, redraw, zoom, reset, view}. */
  function attach(cv, opts) {
    opts = opts || {};
    var snap = opts.snap > 0 ? +opts.snap : 0;
    var ed = { S: null, peaks: null, view: View() };
    var note = function (t) { if (t && opts.onNote) opts.onNote(t); };
    var changed = function (t) { if (opts.onChange) opts.onChange(ed.S, t || ""); };

    ed.redraw = function () {
      if (!cv) return;
      var cssW = cv.clientWidth || 300, cssH = cv.clientHeight || 48;
      var dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
      if (cv.width !== Math.round(cssW * dpr)) cv.width = Math.round(cssW * dpr);
      if (cv.height !== Math.round(cssH * dpr)) cv.height = Math.round(cssH * dpr);
      var ctx = cv.getContext && cv.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawPeaks(ctx, ed.peaks, ed.view, cv.width, cv.height,
        opts.playFrac ? opts.playFrac() : 0,
        cssVar("--line", "#555"), cssVar("--tiger", "#e8842c"));
      drawOverlay(ctx, ed.S, ed.view, cv.width, cv.height, dpr, cssVar("--bad", "#e33"), snap >= 1);
    };
    ed.setSegs = function (S) { ed.S = S; ed.redraw(); };
    ed.segs = function () { return ed.S; };
    ed.setPeaks = function (p) { ed.peaks = p; ed.redraw(); };
    ed.zoom = function (f) { ed.view.zoom(f); ed.redraw(); };
    ed.reset = function () { ed.view.reset(); ed.redraw(); };

    if (!cv || !cv.addEventListener) return ed;
    var drag = null;
    function fracAt(ev) {
      var r = cv.getBoundingClientRect();
      if (!r.width) return null;
      return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    }
    function secAt(f) { return ed.view.vToF(f) * (ed.S ? ed.S.total : 0); }
    cv.addEventListener("pointerdown", function (ev) {
      var f = fracAt(ev); if (f == null) return;
      var S = ed.S, line = -1, body = -1;
      if (S) {
        var r = cv.getBoundingClientRect();
        var tol = (6 / r.width) * ed.view.span() * S.total;      // ~6 css px
        line = lineAt(S, secAt(f), tol);
        if (line < 0) {
          var si = segAt(S, secAt(f));
          if (si >= 0 && S.manual[si]) body = si;
        }
      }
      drag = { x0: ev.clientX, moved: false, line: line, body: body, t0: secAt(f) };
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    cv.addEventListener("pointermove", function (ev) {
      if (!drag || !ed.S) return;
      var f = fracAt(ev); if (f == null) return;
      if (Math.abs(ev.clientX - drag.x0) >= 4) drag.moved = true;
      if (!drag.moved) return;
      if (drag.line >= 0) {
        var m = moveLine(ed.S, drag.line, secAt(f), snap);
        if (!m.ok) { note(m.note); drag.line = -2; return; }
        ed.redraw(); changed(""); return;
      }
      if (drag.body >= 0) {
        var t = secAt(f);
        var b = moveBody(ed.S, drag.body, t - drag.t0, snap);
        if (!b.ok) { note(b.note); drag.body = -2; return; }
        drag.t0 += b.dt;
        ed.redraw(); changed(""); return;
      }
    });
    cv.addEventListener("pointerup", function (ev) {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.moved || d.line === -2 || d.body === -2) return;
      var f = fracAt(ev);
      if (f == null) return;
      // a click in the duration label strip (top ~14 css px) opens the box
      var r = cv.getBoundingClientRect();
      if (ed.S && r.height && (ev.clientY - r.top) <= 14) {
        var i = segAt(ed.S, secAt(f));
        if (i >= 0) {
          openInput(ed.S, i, ev, function (v) {
            var s = setManual(ed.S, i, v);
            note(s.note);
            if (s.ok) { ed.redraw(); changed(s.note); }
          }, snap >= 1);
          return;
        }
      }
      if (opts.onSeek) opts.onSeek(ed.view.vToF(f));
      ed.redraw();
    });
    cv.addEventListener("wheel", function (ev) {
      if (!ed.view.zoomed()) return;
      ev.preventDefault();
      ed.view.pan((ev.deltaY || ev.deltaX) * 0.0015 * ed.view.span());
      ed.redraw();
    }, { passive: false });
    return ed;
  }

  var API = { from: from, recalc: recalc, windows: windows, segAt: segAt,
              lineAt: lineAt, lineRefusal: lineRefusal, moveLine: moveLine,
              moveBody: moveBody, setManual: setManual, View: View,
              drawPeaks: drawPeaks, drawOverlay: drawOverlay,
              openInput: openInput, attach: attach };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (root) root.SegMap = API;
})(typeof window !== "undefined" ? window : this);
