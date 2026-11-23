/* bitGen app — lib/wake.js (2.927.0): 👂 LISTENING FOR "HI GEMMA" - the short bursts of speech (window.BGWake).
 * Tim: "when the app is running it is listening for keywords like Hi Gemma. the desktop app can give it a name in general
 * settings". The microphone's level, 4096 samples at a time: the room's own level is learnt while it is quiet; a burst of
 * speech (louder than that for 120 ms) is kept from half a second BEFORE it started (so "Hi" is not cut) until 0.6 s of quiet
 * - or 6 s at most. Bursts of 0.3-6 s are handed on (onClip) as 16 kHz mono WAV for the PC's speech to text (POST
 * /api/app/wake) - longer talk (a TV, a conversation in the room) is let go, nothing is kept.
 *   segmenter({onClip, preMs, quietMs, maxMs, minMs}) -> {feed(float32, rate), reset()}
 *   wav(float32, rate) -> ArrayBuffer (16 kHz, 16-bit, mono)          pure (scripts/test-927.js) */
(function (root) {
  "use strict";
  function rmsOf(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / (a.length || 1)); }
  function joinF(parts) {
    var n = 0, i; for (i = 0; i < parts.length; i++) n += parts[i].length;
    var out = new Float32Array(n), o = 0; for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }
  function segmenter(o) {
    o = o || {};
    var PRE = o.preMs || 500, QUIET = o.quietMs || 600, MAX = o.maxMs || 6000, MIN = o.minMs || 300;
    var floor = 0.006, ring = [], ringMs = 0, cur = null, curMs = 0, quiet = 0, loud = 0, voiced = 0, seen = 0, toolong = false;
    function reset() { ring = []; ringMs = 0; cur = null; curMs = 0; quiet = 0; loud = 0; voiced = 0; toolong = false; }
    function feed(buf, rate) {
      var a = new Float32Array(buf), ms = a.length / rate * 1000, r = rmsOf(a);
      seen += ms;
      var th = Math.max(0.012, floor * 3);
      if (!cur) {
        ring.push(a); ringMs += ms;
        while (ring.length > 1 && ringMs - ring[0].length / rate * 1000 >= PRE) { ringMs -= ring[0].length / rate * 1000; ring.shift(); }
        if (r > th && seen > 300) { loud += ms; if (loud >= 120) { cur = ring.slice(); curMs = ringMs; ring = []; ringMs = 0; quiet = 0; voiced = loud; } }
        else { loud = 0; floor = floor * 0.95 + Math.min(r, 0.2) * 0.05; }
        return;
      }
      cur.push(a); curMs += ms;
      if (r > th) { quiet = 0; voiced += ms; } else quiet += ms;
      if (curMs >= MAX) toolong = true;
      if (quiet >= QUIET || toolong) {
        var clip = joinF(cur), spoke = voiced, long = toolong && quiet < QUIET;
        reset();
        if (long) { cur = null; return; }                              // still talking after 6 s: a conversation, not a call
        if (spoke >= MIN && o.onClip) o.onClip(clip, rate);
      }
    }
    return { feed: feed, reset: reset, _floor: function () { return floor; } };
  }
  function wav(f32, rate) {
    var to = 16000, n = Math.max(1, Math.floor(f32.length * to / rate)), pcm = new Int16Array(n), step = rate / to;
    for (var i = 0; i < n; i++) {                                   // a box average per output sample (enough for speech)
      var s = Math.floor(i * step), e = Math.min(f32.length, Math.max(s + 1, Math.floor((i + 1) * step))), sum = 0;
      for (var k = s; k < e; k++) sum += f32[k];
      var v = sum / (e - s); pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
    }
    var buf = new ArrayBuffer(44 + n * 2), d = new DataView(buf);
    function str(off, t) { for (var j = 0; j < t.length; j++) d.setUint8(off + j, t.charCodeAt(j)); }
    str(0, "RIFF"); d.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); d.setUint32(16, 16, true);
    d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, to, true); d.setUint32(28, to * 2, true);
    d.setUint16(32, 2, true); d.setUint16(34, 16, true); str(36, "data"); d.setUint32(40, n * 2, true);
    for (var m = 0; m < n; m++) d.setInt16(44 + m * 2, pcm[m], true);
    return buf;
  }
  var API = { segmenter: segmenter, wav: wav, rmsOf: rmsOf };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.BGWake = API;
})(typeof window !== "undefined" ? window : globalThis);
