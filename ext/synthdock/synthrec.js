/* bitGen Studio — ext/synthdock/synthrec.js (2.955.0): 🎹 THE SYNTH TAB's TAKE RECORDER (window.H3SynthRec).
 * Tim: "add a send to timeline button in keyboard, send last recorded piece, add a record button to looper and send button to send
 * last recorded piece to timeline".
 * Records what one part of the Synth tab plays - the keyboard's synth (● on the deck) or the looper and its pads (⏺ in the
 * looper) - as plain samples (no codec, a WAV when sent), so → 🎞 Timeline puts exactly that take on a new layer.
 *   create(ctx, node) -> {start(), stop({trim}) -> {chans: [L, R], sampleRate, seconds} | null, on()}
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
  function create(ctx, node) {
    var sp = null, mute = null, L = [], R = [], n = 0, running = false;
    return {
      on: function () { return running; },
      start: function () {
        if (running) return;
        L = []; R = []; n = 0; running = true;
        sp = ctx.createScriptProcessor(4096, 2, 2); mute = ctx.createGain(); mute.gain.value = 0;
        sp.onaudioprocess = function (e) {
          if (!running) return;
          var b = e.inputBuffer; L.push(new Float32Array(b.getChannelData(0))); R.push(new Float32Array(b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0))); n += b.length;
        };
        node.connect(sp); sp.connect(mute); mute.connect(ctx.destination);
      },
      stop: function (o) {
        if (!running) return null;
        running = false;
        try { node.disconnect(sp); } catch (e) { /* gone */ }
        try { sp.disconnect(); mute.disconnect(); } catch (e) { /* gone */ }
        var chans = [join(L, n), join(R, n)];
        if (o && o.trim) chans = trimLead(chans, ctx.sampleRate);
        if (!chans[0].length) return null;
        return { chans: chans, sampleRate: ctx.sampleRate, seconds: chans[0].length / ctx.sampleRate };
      },
    };
  }
  var api = { create: create, trimLead: trimLead };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthRec = api;
})(typeof window !== "undefined" ? window : globalThis);
