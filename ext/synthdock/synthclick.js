/* bitGen Studio — ext/synthdock/synthclick.js (2.958.0): 🎹 THE METRONOME and the COUNT-IN (window.H3SynthClick).
 * Tim: "continue" (the Cakewalk-style list: a metronome and a count-in for recording).
 * A click on every beat at the looper's BPM - the first of each bar higher. 🕒 Click in the Synth tab's bar turns it on for the
 * timeline's ▶ and for recording; Count-in (0 / 1 / 2 bars) clicks before ● (the keyboard) and ⏺ (the looper) start.
 *   times(bpm, from, until, perBar) -> [{t, accent}] (pure - the beats from `from` to `until`, on the grid from 0)
 *   play(ctx, dest, list, at) -> stop()   (each click a 30 ms blip)
 *   run(ctx, dest, bpm(), from) -> stop()  (keeps clicking until stopped - a look-ahead like the looper's)
 */
(function (root) {
  "use strict";
  function times(bpm, from, until, perBar) {
    var b = 60 / (bpm || 120), n = Math.ceil((from || 0) / b - 1e-9), out = [];
    perBar = perBar || 4;
    for (; n * b < until - 1e-9 && out.length < 4000; n++) out.push({ t: n * b, accent: n % perBar === 0 });
    return out;
  }
  function blip(ctx, dest, t, accent) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.32, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.04);
    o.onended = function () { try { g.disconnect(); } catch (e) { /* gone */ } };
    return o;
  }
  function play(ctx, dest, list, at) {
    var os = list.map(function (c) { return blip(ctx, dest, at + c.t, c.accent); });
    return function () { os.forEach(function (o) { try { o.stop(); } catch (e) { /* done */ } }); };
  }
  function run(ctx, dest, bpm, from) {
    var start = ctx.currentTime + 0.05 - (from || 0), next = from || 0, alive = true, os = [];
    var tick = function () {
      if (!alive) return;
      var b = 60 / bpm(), until = ctx.currentTime - start + 0.2;
      times(bpm(), next, until, 4).forEach(function (c) { os.push(blip(ctx, dest, start + c.t, c.accent)); next = c.t + b / 2; });
      if (os.length > 64) os = os.slice(-16);
    };
    tick(); var timer = setInterval(tick, 50);
    return function () { alive = false; clearInterval(timer); os.forEach(function (o) { try { o.stop(); } catch (e) { /* done */ } }); };
  }
  var api = { times: times, play: play, run: run };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthClick = api;
})(typeof window !== "undefined" ? window : globalThis);
