/* bitGen Studio — voicestream.js (2.919.0): THE MICROPHONE STREAMED TO THE PC WHILE YOU TALK (window.BGVoiceStream).
 *
 * Tim (verbatim): "https://inworld.ai/open-source#voice-isolator, would this be something we can use to have a conversation
 * with bitgen" -> "go ahead". ONE file, the same in the studio (static/voicestream.js) and the 📱 app
 * (mobile/www/lib/voicestream.js - scripts/test-919.js checks they are identical).
 * With Settings ▸ Add-ons ▸ Voice conversation installed, a turn is no longer "record until the level drops, then send": the
 * microphone goes to the PC in ~200 ms pieces (POST /api/voice/stream/<sid>, little-endian int16 at the session's rate),
 * the PC's Voice Isolator cleans it and SAVA says when the SENTENCE is finished; the PC hears it (Whisper) and - for the app -
 * says what it means; the answer comes back in a piece's reply (or a poll after it).
 *   create(o) -> a stream   o = {request(method, path, body, json) -> Promise<json>, kind: "app" | "chat", extra: {history,
 *                 phrases, mode, test_heard}, onEvent(ev), every (ms, 200), quietMs (no speech in it = nothing, 8000),
 *                 maxMs (30000)}
 *     .feed(float32, rate)   microphone samples (any rate - made the session's rate here)
 *     .finish()             "I'm done": the PC closes the turn now
 *     .cancel()
 *     .result               a Promise -> {heard, result (kind app: lib/appVoice's answer), nothing, error, rate, isolator}
 *     .info                 {sid, rate, isolator} once open
 *   resample(f32, from, to) / toPcm16(f32) -> ArrayBuffer   (pure)
 */
(function (root) {
  "use strict";
  function resample(x, from, to) {
    if (!x || !x.length || from === to) return x || new Float32Array(0);
    var n = Math.floor(x.length * to / from), out = new Float32Array(n), r = from / to;
    if (r > 1) {                                                    // down: each output the mean of its input span (less aliasing)
      for (var k = 0; k < n; k++) {
        var lo = Math.floor(k * r), hi = Math.min(x.length, Math.floor((k + 1) * r)), sum = 0;
        for (var m = lo; m < hi; m++) sum += x[m];
        out[k] = hi > lo ? sum / (hi - lo) : x[lo] || 0;
      }
      return out;
    }
    for (var i = 0; i < n; i++) {
      var p = i * r, a = Math.floor(p), b = Math.min(x.length - 1, a + 1), f = p - a;
      out[i] = x[a] * (1 - f) + x[b] * f;
    }
    return out;
  }
  function toPcm16(x) {
    var ab = new ArrayBuffer(x.length * 2), v = new DataView(ab);
    for (var i = 0; i < x.length; i++) { var s = Math.max(-1, Math.min(1, x[i])); v.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return ab;
  }

  function create(o) {
    var req = o.request, every = o.every || 200, quietMs = o.quietMs || 8000, maxMs = o.maxMs || 30000;
    var q = [], sid = null, rate = 16000, inflight = false, closed = false, shut = false, heardTurn = false, spoke = false;
    var t0 = Date.now(), timer = null, pollT = null, resolveR, settled = false;
    var api = { info: null };
    api.result = new Promise(function (ok) { resolveR = ok; });
    function done(v) {
      if (settled) return;
      settled = true; clearInterval(timer); clearTimeout(pollT);
      resolveR(Object.assign({ rate: rate, isolator: !!(api.info && api.info.isolator) }, v));
    }
    function handle(j) {
      var evs = (j && j.events) || [];
      for (var i = 0; i < evs.length; i++) {
        var e = evs[i];
        try { if (o.onEvent) o.onEvent(e); } catch (x) { /* the page's */ }
        if (e.type === "speech") spoke = true;
        if (e.type === "turn") heardTurn = true;
        if (e.type === "error") return done({ error: e.error });
        if (e.type === "result") return done({ heard: e.heard || "", result: e });
        if (e.type === "heard" && o.kind !== "app") return done({ heard: e.text || "", nothing: !e.text });
      }
      if (j && j.done && !j.hearing && heardTurn && o.kind !== "app") return done({ heard: "", nothing: true });
      if ((heardTurn || shut) && !settled) {                       // the PC is hearing it: ask again shortly
        if (shut && !heardTurn && j && !j.hearing) return done({ nothing: true });   // closed, and no turn in it
        clearTimeout(pollT);
        pollT = setTimeout(function () { req("GET", "/api/voice/stream/" + sid).then(handle, fail); }, 300);
      }
    }
    function fail(e) { done({ error: (e && e.message) || String(e), status: e && e.status }); }
    /** the queued microphone pieces at the session's rate, one array (the queue emptied) */
    function drain() {
      var parts = q.map(function (p) { return resample(p.x, p.from, rate); }), n = 0, i;
      for (i = 0; i < parts.length; i++) n += parts[i].length;
      var all = new Float32Array(n), off = 0;
      for (i = 0; i < parts.length; i++) { all.set(parts[i], off); off += parts[i].length; }
      q = [];
      return all;
    }
    function pump() {
      if (!sid || inflight || settled) return;
      var now = Date.now();
      if (!closed && !heardTurn && ((!spoke && now - t0 > quietMs) || now - t0 > maxMs)) { api.finish(); return; }
      if (heardTurn || closed || !q.length) return;
      var all = drain();
      inflight = true;
      req("POST", "/api/voice/stream/" + sid, toPcm16(all), false).then(function (j) { inflight = false; handle(j); }, function (e) { inflight = false; fail(e); });
    }
    api.feed = function (f32, from) {
      if (closed || heardTurn || settled || !f32 || !f32.length) return;
      q.push({ x: new Float32Array(f32), from: from || 48000 });
      if (q.length > 400) q.shift();                                 // never grow without bound while opening
    };
    api.finish = function () {
      if (closed || settled) return;
      closed = true;
      if (!sid) return;                                              // still opening: it finishes once open
      var go = function () {
        var send = q.length ? req("POST", "/api/voice/stream/" + sid, toPcm16(drain()), false).then(handle) : Promise.resolve();
        send.then(function () { if (settled) return; return req("POST", "/api/voice/stream/" + sid + "/close", null, true).then(function (j) { shut = true; handle(j); }); }).catch(fail);
      };
      if (inflight) { var w = setInterval(function () { if (!inflight) { clearInterval(w); go(); } }, 30); } else go();
    };
    api.cancel = function () {
      if (sid && !closed) req("POST", "/api/voice/stream/" + sid + "/close", null, true).catch(function () {});
      closed = true; done({ nothing: true, cancelled: true });
    };
    req("POST", "/api/voice/stream/open", Object.assign({ kind: o.kind || "chat" }, o.extra || {}), true).then(function (j) {
      if (settled) { if (j && j.sid) req("POST", "/api/voice/stream/" + j.sid + "/close", null, true).catch(function () {}); return; }
      sid = j.sid; rate = j.rate || 16000; api.info = { sid: sid, rate: rate, isolator: !!j.isolator, device: j.device || "" };
      if (o.onOpen) { try { o.onOpen(api.info); } catch (x) { /* the page's */ } }
      t0 = Date.now();                                               // the clock starts when the PC is listening
      timer = setInterval(pump, every);
      if (closed) { closed = false; api.finish(); }
    }, fail);
    return api;
  }

  var BGVoiceStream = { create: create, resample: resample, toPcm16: toPcm16 };
  if (typeof module !== "undefined" && module.exports) module.exports = BGVoiceStream;
  else root.BGVoiceStream = BGVoiceStream;
})(typeof window !== "undefined" ? window : globalThis);
