/* bitGen Studio — ext/synthdock/synthgroove.js (2.992.0): 🥁 DRUMIFY - a rhythm you tap, play or already have -> a drum pattern
 * for the step sequencer, with the feel you played it with (window.H3SynthGroove; pure maths, so Node tests it).
 * Tim: "our own Magenta" in the Edit Booth - local only, no cloud. This is NOT a neural network: it is our own small set of
 * rules in code (light tasks), nothing leaves the PC, nothing is downloaded.
 *   onsets(chans, sr, o)  -> [{t s, v 0..1, bands ["low"|"mid"|"high"]}]   hits found in a sound (3 bands: low / mid / high)
 *   drumify(hits, o)      -> {n, div, rows [{kind, src, vol, hits, off, vel}], info}
 *       hits = [{b beats from the pattern's start, v 0..1, bands?, m? (a MIDI note)}]
 *       o = {div 4, bars 1|2|4 (or n), seed, keep auto|kick|snare|hat, hats, backbeat, kick, ghost 0..1, sounds {kick, snare, hat,
 *            open}, vols {..}}
 *   each step keeps how far off the grid it was played (off, -0.5..0.5 of a step) and how hard (vel) - the step clip's Feel
 *   (0 = on the grid, 1 = as played) decides how much of the timing is heard (H3SynthTLCore.stepEvents).
 *   kindOf(src) -> kick | snare | hat | open | null    (which drum a sound is, by its name)
 */
(function (root) {
  "use strict";
  var K = typeof module !== "undefined" && module.exports ? require("./synthkit.js") : root.H3SynthKit;
  var KINDS = ["kick", "snare", "hat", "open"];
  var SOUNDS = { kick: "kit:kick", snare: "kit:snare", hat: "kit:chat", open: "kit:ohat" };
  var VOLS = { kick: 0.9, snare: 0.85, hat: 0.6, open: 0.55 };
  var NOTE = "🥁 Drumify is our own groove maker - simple rules in code, not an AI model. Nothing is downloaded and nothing leaves your PC. Light tasks: it gives you a start, you finish it in the grid.";
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function kindOf(src) {
    var s = String(src || "").toLowerCase();
    if (/ohat|open/.test(s)) return "open";
    if (/kick|boom|bd\b|808/.test(s)) return "kick";
    if (/snare|clap|rim|sd\b/.test(s)) return "snare";
    if (/hat|chat|shaker|hh\b|ride|cym/.test(s)) return "hat";
    return null;
  }

  /* ---------------- reading the hits of a sound ---------------- */
  var BANDS = [["low", "lowpass", 120, 0.707, 0.025], ["mid", "bandpass", 1000, 0.5, 0.01], ["high", "highpass", 6000, 0.707, 0.01]];
  /** which drums one hit holds, from its three band levels over 30 ms (measured on our own kit: a kick is led by the low band,
   *  a hat has 30x more high than mid, a snare / clap / rim sits between). A kick's own mid (about a fifth of its low) is taken
   *  off first, so a kick + a hat together reads as both - not as a snare. */
  function bandsOf(e) {
    var lo = e[0], mid = e[1], hi = e[2], out = [], tiny = (lo + mid + hi) * 1e-6 + 1e-15;
    if (lo >= mid) {
      out.push("low");
      var rest = Math.max(0, mid - 0.2 * lo);
      if (hi > 0.08 * lo) out.push(hi / (rest + tiny) > 12 ? "high" : "mid");
      else if (rest > 0.4 * lo) out.push("mid");
    } else out.push(hi / (mid + tiny) > 12 ? "high" : "mid");
    return out;
  }
  /** the hits of a sound: three filtered copies (low / mid / high), their loudness every 5 ms (the low one over 25 ms - a low
   *  wave is longer than 5 ms), a hit where one of them jumps up (8 dB against the quietest of the 15 ms before); the time =
   *  where that band first reaches 12% of its peak; v = how loud, against the loudest hit */
  function onsets(chans, sr, o) {
    o = o || {};
    var len = chans && chans[0] ? chans[0].length : 0; if (!len || !sr) return [];
    var max = Math.min(len, Math.round(sr * (o.maxS || 60))), mono = new Float32Array(max), nc = chans.length;
    for (var i = 0; i < max; i++) { var s = 0; for (var c = 0; c < nc; c++) s += chans[c][i]; mono[i] = s / nc; }
    var hop = Math.max(16, Math.round(sr * 0.005)), nf = Math.floor(max / hop), rise = o.rise || 8;
    var fl = BANDS.map(function (b) { return K.biquad(mono, b[1], b[2], b[3], sr); });
    var en = fl.map(function (y, bi) {
      var W = Math.max(hop, Math.round(BANDS[bi][4] * sr)), e = new Float64Array(nf);
      for (var f = 0; f < nf; f++) { var a = 0, j0 = f * hop, z = Math.min(max, j0 + W); for (var j = j0; j < z; j++) a += y[j] * y[j]; e[f] = a / W; }
      return e;
    });
    var top = 0; en.forEach(function (e) { for (var f = 0; f < nf; f++) if (e[f] > top) top = e[f]; });
    if (top <= 1e-12) return [];
    var gate = top * Math.pow(10, -45 / 10), db = function (x) { return 10 * Math.log10(x + top * 1e-9); };
    var jump = en.map(function (e) { var d = new Float64Array(nf); for (var f = 0; f < nf; f++) { if (e[f] < gate) continue; var lo = f === 0 ? 0 : Math.min(e[f - 1], f > 1 ? e[f - 2] : Infinity, f > 2 ? e[f - 3] : Infinity); d[f] = db(e[f]) - db(lo); } return d; });
    var od = new Float64Array(nf); for (var f2 = 0; f2 < nf; f2++) od[f2] = Math.max(jump[0][f2], jump[1][f2], jump[2][f2]);
    var hits = [], last = -1e9, gap = Math.round(0.04 * sr / hop), w30 = Math.round(0.03 * sr);
    for (var g = 0; g < nf; g++) {
      if (od[g] < rise) continue;
      var peak = true; for (var q = g - 2; q <= g + 2; q++) if (q !== g && q >= 0 && q < nf && od[q] > od[g]) peak = false;
      if (!peak) continue;
      var bi = jump[0][g] >= jump[1][g] && jump[0][g] >= jump[2][g] ? 0 : jump[1][g] >= jump[2][g] ? 1 : 2, y = fl[bi], pk = 0;
      var x0 = Math.max(0, (g - 1) * hop), x1 = Math.min(max, g * hop + Math.round(BANDS[bi][4] * sr) + w30);
      for (var x = x0; x < x1; x++) if (Math.abs(y[x]) > pk) pk = Math.abs(y[x]);
      var at = g * hop; for (var x2 = x0; x2 < x1; x2++) if (Math.abs(y[x2]) >= 0.12 * pk) { at = x2; break; }
      if (hits.length && at - hits[hits.length - 1].at < gap * hop) { if (od[g] > hits[hits.length - 1]._od) hits.pop(); else continue; }
      // what the hit ADDS: its 30 ms against the 15 ms before it (a kick still ringing is not part of the hat after it)
      var e3 = fl.map(function (yy) { var a = 0, z = Math.min(max, at + w30), b = 0, p0 = Math.max(0, at - (w30 >> 1)); for (var u = at; u < z; u++) a += yy[u] * yy[u]; for (var v = p0; v < at; v++) b += yy[v] * yy[v]; return Math.max(0, a / Math.max(1, z - at) - (at > p0 ? b / (at - p0) : 0)); });
      var amp = 0; for (var x3 = at, xe = Math.min(max, at + w30); x3 < xe; x3++) { var av = Math.abs(mono[x3]); if (av > amp) amp = av; }
      hits.push({ at: at, t: at / sr, _amp: amp, _e: e3, _od: od[g] });
      last = g;
    }
    var amax = hits.reduce(function (a, h) { return Math.max(a, h._amp); }, 0) || 1;
    return hits.map(function (h) { return { t: r3(h.t), v: r3(clamp(Math.sqrt(h._amp / amax), 0.15, 1)), bands: bandsOf(h._e) }; });
  }

  /* ---------------- hits -> a drum pattern ---------------- */
  /** hits on the step grid: the nearest step, how far off it (in steps), how hard; a longer take folds onto the pattern
   *  (the same step played again = the loudest, its timing the average) */
  function toGrid(hits, div, n) {
    var cells = {};
    (hits || []).forEach(function (h) {
      if (!h || !Number.isFinite(+h.b) || h.b < -0.5 / div) return;
      var s = h.b * div, k = Math.round(s), off = clamp(s - k, -0.5, 0.5), kk = ((k % n) + n) % n, key = kk + "|" + (h.kind || (h.bands || []).join(",") || "");
      var c = cells[key] || (cells[key] = { k: kk, v: 0, off: 0, n: 0, bands: h.bands || null, m: h.m, kind: h.kind || null });
      c.v = Math.max(c.v, clamp(+h.v || 0.75, 0.05, 1)); c.off += off; c.n++; if (h.m != null && (c.m == null || h.m < c.m)) c.m = h.m;
    });
    return Object.keys(cells).map(function (q) { var c = cells[q]; c.off = r3(c.off / c.n); return c; }).sort(function (a, b) { return a.k - b.k; });
  }
  function drumify(hits, o) {
    o = o || {};
    var div = [2, 3, 4, 6, 8].indexOf(+o.div) >= 0 ? +o.div : 4, bar = 4 * div, rnd = K.rng((o.seed >>> 0) || 1);
    var n = o.n ? clamp(Math.round(o.n), 2, 64) : clamp((o.bars || 1) * bar, bar, 64);
    if (n > 64) n = 64;
    var keep = ["kick", "snare", "hat"].indexOf(o.keep) >= 0 ? o.keep : "auto", ghost = clamp(+o.ghost || 0, 0, 1);
    var cells = toGrid(hits, div, n), half = div % 2 === 0 ? div / 2 : -1;
    var vmax = cells.reduce(function (a, c) { return Math.max(a, c.v); }, 0) || 1, vmin = cells.reduce(function (a, c) { return Math.min(a, c.v); }, 1);
    var dynamic = vmax - vmin > 0.15;
    var ms = cells.filter(function (c) { return c.m != null; }).map(function (c) { return c.m; }).sort(function (a, b) { return a - b; }), lowM = ms.length > 2 ? ms[Math.floor(ms.length / 3)] : null;
    var grid = {}; KINDS.forEach(function (k) { grid[k] = []; for (var i = 0; i < n; i++) grid[k].push(null); });
    var put = function (kind, k, v, off, from) { var g = grid[kind]; if (!g[k] || g[k].v < v) g[k] = { v: r3(clamp(v, 0.05, 1)), off: r3(clamp(off, -0.5, 0.5)), from: from }; };
    var read = { kick: 0, snare: 0, hat: 0, open: 0 };
    cells.forEach(function (c) {
      var pos = c.k % div, beat = Math.floor(c.k / div) % 4, kinds = [];
      if (keep !== "auto") kinds = [keep];
      else if (c.kind) kinds = [c.kind];
      else if (c.bands && c.bands.length) c.bands.forEach(function (b) { kinds.push(b === "low" ? "kick" : b === "mid" ? "snare" : "hat"); });
      else if (pos === 0) kinds = [beat % 2 === 0 ? "kick" : "snare"];
      else {
        var loud = dynamic && c.v >= 0.85 * vmax, low = lowM != null && c.m <= lowM;
        var push = !dynamic && pos === half && (beat === 1 || beat === 3);   // the "and" of 2 and of 4 - the usual pushed kick
        var kick = loud || low || push;
        if (!dynamic && lowM == null && rnd() < 0.2) kick = !kick;   // 🎲 another take: some swap - only when nothing else tells (your dynamics / your notes decide otherwise)
        if (!kick && ghost > 0 && c.v < 0.8 * vmax && rnd() < ghost * 0.6) kinds = ["snare"]; else kinds = [kick ? "kick" : "hat"];
      }
      kinds.forEach(function (kd) { var v = kd === "snare" && pos !== 0 && !c.bands && keep === "auto" ? c.v * 0.45 : c.v; put(kd, c.k, v, c.off, "you"); read[kd]++; });
    });
    // the groove's own timing for each place in a beat (e.g. a lazy "and" = swing) - the added drums follow it
    var feel = []; for (var p = 0; p < div; p++) { var s0 = 0, w0 = 0; cells.forEach(function (c) { if (c.k % div === p) { s0 += c.off * c.v; w0 += c.v; } }); feel.push(w0 ? s0 / w0 : 0); }
    var jit = function () { return (rnd() - 0.5) * 0.06; }, added = [];
    if (o.hats !== false && read.hat < n / div / 2) {   // hats: 8ths, or 16ths when you played 16ths (or 🎲 now and then)
      var sixteen = div >= 4 && div % 2 === 0 && (cells.some(function (c) { return c.k % (div / 2) !== 0; }) || rnd() < 0.3), every = div % 2 ? 1 : sixteen ? Math.max(1, div / 4) : div / 2;
      for (var k = 0; k < n; k += every) {
        var pp = k % div, v = pp === 0 ? 0.8 : pp === half ? 0.62 : 0.42;
        put("hat", k, v * (0.92 + rnd() * 0.12), feel[pp] + jit(), "added");
      }
      if (half > 0 && rnd() < 0.55) { var oh = (n - div) + half; if (oh >= 0 && oh < n) { grid.hat[oh] = null; put("open", oh, 0.6, feel[half], "added"); } }   // an open hat on the last "and"
      added.push("hats");
    }
    if (o.backbeat !== false && !grid.snare.some(function (x, k) { return x && k % div === 0 && Math.floor(k / div) % 2 === 1; })) {
      for (var b = div; b < n; b += 2 * div) put("snare", b, 0.9, feel[0] + jit(), "added");
      added.push("backbeat");
    }
    if (o.kick !== false) {
      var any = false; for (var bb = 0; bb < n; bb += bar) if (!grid.kick[bb]) { put("kick", bb, 0.95, feel[0], "added"); any = true; }
      if (any) added.push("kick on 1");
    }
    if (ghost > 0) {   // ghost snares: a soft 16th just before or after a backbeat now and then
      var gn = 0;
      for (var gb = div; gb < n; gb += 2 * div) [-1, 1].forEach(function (d) { var kk = gb + d; if (kk > 0 && kk < n && !grid.snare[kk] && rnd() < ghost * 0.5) { put("snare", kk, 0.28 + rnd() * 0.08, feel[kk % div] + jit(), "added"); gn++; } });
      if (gn) added.push(gn + " ghost note" + (gn === 1 ? "" : "s"));
    }
    var snd = o.sounds || {}, vols = o.vols || {};
    var rows = KINDS.map(function (kd) {
      var g = grid[kd];
      return { kind: kd, src: snd[kd] || SOUNDS[kd], vol: vols[kd] != null ? vols[kd] : VOLS[kd],
        hits: g.map(function (x) { return x ? (x.v >= 0.85 ? 2 : 1) : 0; }), off: g.map(function (x) { return x ? x.off : 0; }), vel: g.map(function (x) { return x ? x.v : 0; }) };
    });
    var count = {}; rows.forEach(function (r) { count[r.kind] = r.hits.filter(Boolean).length; });
    return { n: n, div: div, rows: rows, info: { hits: (hits || []).length, steps: cells.length, read: read, added: added, count: count, feel: feel.map(r3) } };
  }
  /** the message under ✨ Make */
  function summary(r) {
    var c = r.info.count, a = r.info.added;
    return "🥁 " + r.info.hits + " hit" + (r.info.hits === 1 ? "" : "s") + " read -> kick " + c.kick + " · snare " + c.snare + " · hats " + (c.hat + c.open) + (a.length ? " (added: " + a.join(", ") + ")" : "");
  }
  var api = { onsets: onsets, bandsOf: bandsOf, toGrid: toGrid, drumify: drumify, summary: summary, kindOf: kindOf, KINDS: KINDS, SOUNDS: SOUNDS, VOLS: VOLS, NOTE: NOTE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthGroove = api;
})(typeof window !== "undefined" ? window : globalThis);
