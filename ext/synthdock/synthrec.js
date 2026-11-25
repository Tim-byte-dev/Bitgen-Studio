/* bitGen Studio — ext/synthdock/synthrec.js (2.955.0): 🎹 THE SYNTH TAB's TAKE RECORDER (window.H3SynthRec).
 * Tim: "add a send to timeline button in keyboard, send last recorded piece, add a record button to looper and send button to send
 * last recorded piece to timeline".
 * Records what one part of the Synth tab plays - the keyboard's synth (● on the deck) or the looper and its pads (⏺ in the
 * looper) - as plain samples (no codec, a WAV when sent), so → 🎞 Timeline puts exactly that take on a new layer.
 *   create(ctx, node) -> {start(), stop({trim}) -> {chans: [L, R], sampleRate, seconds} | null, on()}
 *   create(ctx, node, {clock: true}) (2.960.0, the timeline's ● Rec): a 3rd channel carries the context's own clock (a
 *   ConstantSource ramping 1 per second), so stop() also gives t0 = the context time of the first sample - takes land on the
 *   timeline to the sample, whatever the browser's buffering (place(): each buffer put by its own clock).
 *   trimLead(chans, sr, thr) (pure) - the silence before the first sound cut off (a keyboard take starts at the first note)
 */
(function (root) {
  "use strict";
  function join(parts, n) { var out = new Float32Array(n), o = 0; parts.forEach(function (p) { out.set(p, o); o += p.length; }); return out; }
  /** the samples before the first one louder than thr (all channels) - cut, keeping 10 ms */
  function trimLead(chans, sr, thr) {
    thr = thr == null ? 0.0015 : thr;
    var n = chans[0].length, first = n;
    for (var c = 0; c < chans.length; c++) for (var i = 0; i < first; i++) if (Math.abs(chans[c][i]) > thr) { first = i; break; }
    if (first >= n) return chans.map(function () { return new Float32Array(0); });
    var from = Math.max(0, first - Math.round(sr * 0.01));
    return chans.map(function (ch) { return ch.slice(from); });
  }
  function create(ctx, node, opt) {
    var sp = null, mute = null, L = [], R = [], n = 0, running = false, clk = null, split = null, merge = null, t0 = null, tStart = 0, marks = [];
    return {
      on: function () { return running; },
      start: function () {
        if (running) return;
        L = []; R = []; n = 0; running = true;
        L = []; R = []; n = 0; t0 = null; tStart = ctx.currentTime; marks = [];
        var withClock = !!(opt && opt.clock && ctx.createConstantSource && ctx.createChannelMerger);
        sp = ctx.createScriptProcessor(4096, withClock ? 3 : 2, 2); mute = ctx.createGain(); mute.gain.value = 0;
        sp.onaudioprocess = function (e) {
          if (!running) return;
          var b = e.inputBuffer;
          if (withClock && b.numberOfChannels > 2) { var ck = b.getChannelData(2)[0]; if (ck > 0) { marks.push([n, ck, b.length]); if (t0 === null) t0 = ck - n / ctx.sampleRate; } } L.push(new Float32Array(b.getChannelData(0))); R.push(new Float32Array(b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0))); n += b.length;
        };
        if (withClock) {
          var now = ctx.currentTime; clk = ctx.createConstantSource(); clk.offset.setValueAtTime(now, now); clk.offset.linearRampToValueAtTime(now + 4000, now + 4000);
          split = ctx.createChannelSplitter(2); merge = ctx.createChannelMerger(3);
          node.connect(split); split.connect(merge, 0, 0); split.connect(merge, 1, 1); clk.connect(merge, 0, 2); merge.connect(sp); clk.start();
        } else node.connect(sp);
        sp.connect(mute); mute.connect(ctx.destination);
      },
      stop: function (o) {
        if (!running) return null;
        running = false;
        try { node.disconnect(split || sp); } catch (e) { /* gone */ }
        try { if (clk) { clk.stop(); clk.disconnect(); merge.disconnect(); split.disconnect(); } } catch (e) { /* gone */ }
        clk = null; split = null; merge = null;
        try { sp.disconnect(); mute.disconnect(); } catch (e) { /* gone */ }
        var chans = [join(L, n), join(R, n)];
        if (o && o.trim) chans = trimLead(chans, ctx.sampleRate);
        if (!chans[0].length) return null;
        var sr = ctx.sampleRate, placed = marks.length ? place(marks, sr, chans) : null;
        if (placed) chans = placed.chans;
        return { chans: chans, sampleRate: sr, seconds: chans[0].length / sr, t0: placed ? placed.t0 : (t0 === null ? tStart : t0), moved: placed ? placed.moved : 0 };
      },
    };
  }
  /** every buffer put where its own clock says it played (pure): a browser can hand over a stale copy first, or drop buffers
   *  when busy - placed by the clock, a copy lands on itself and a dropped stretch stays silent. marks [[sample, clock, length]]
   *  -> {chans, t0 (context time of sample 0), moved (buffers that were not where counting samples would put them)} */
  function place(marks, sr, chans) {
    var t0 = Infinity, end = 0, moved = 0;
    marks.forEach(function (m) { t0 = Math.min(t0, m[1]); });
    marks.forEach(function (m) { end = Math.max(end, Math.round((m[1] - t0) * sr) + m[2]); });
    var out = chans.map(function () { return new Float32Array(end); }), first = marks[0];
    marks.forEach(function (m) {
      var dst = Math.round((m[1] - t0) * sr), len = Math.min(m[2], chans[0].length - m[0]);
      if (Math.abs(dst - (Math.round((first[1] - t0) * sr) + m[0] - first[0])) > 2) moved++;
      chans.forEach(function (ch, c) { out[c].set(ch.subarray(m[0], m[0] + len), dst); });
    });
    return { chans: out, t0: t0, moved: moved };
  }
  var api = { create: create, trimLead: trimLead, place: place };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthRec = api;
})(typeof window !== "undefined" ? window : globalThis);
