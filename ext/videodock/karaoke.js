/* bitGen Studio — the video docker's 🎤 KARAOKE checkbox (2.373.0).
 *
 * Tim (verbatim): "is it possible to add a kareoke layer to the timeline, and generate the kareoke style bouncing
 * ball in videodocker - if it is possible can we add a checkbox to videodocker menu for kareoke - when the video
 * renders, render another video with transparent background with the kareoke lyrics that can be added as an
 * overlay layer in timeline - first render of the scene won't have the kareoke lyrics".
 *
 * The checkbox is the board's flag (POST /api/karaoke/on). The server queues each scene's overlay when its take
 * lands (lib/karaoke.js -> karaoke_worker.py: the scene's window of the song's lyrics with a bouncing ball, on a
 * transparent VP9 webm the size of the take). This script polls GET /api/karaoke and hands every finished overlay
 * to the core page's tlPlaceKaraoke - the timeline's Karaoke layer, at the start of the scene's take as it sits on
 * the timeline - then acknowledges it, so a reload or a second window never places it twice. The scene's own take
 * is never touched. */
(function () {
  "use strict";
  function el(id) { return document.getElementById(id); }
  if (!el("vdKaraoke")) return;
  var state = { on: false, scenes: {} };
  var placedNow = {};       // "n:output" -> true (this page already placed it)
  var waits = {};           // "n:output" -> polls spent waiting for the take to reach the timeline
  var timer = null;

  function say(t) { var m = el("vdKaraokeMsg"); if (m) { m.textContent = t || ""; m.title = t || ""; } }
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  function summary() {
    var s = state.scenes || {}, n = { queued: 0, timing: 0, done: 0, failed: 0 }, lastErr = "";
    Object.keys(s).forEach(function (k) {
      var e = s[k] || {};
      if (n[e.status] !== undefined) n[e.status]++;
      if (e.status === "failed" && e.error) lastErr = "scene " + k + ": " + e.error;
    });
    if (!state.on) return "";
    var parts = [];
    if (n.timing) parts.push(n.timing + " timing the lyrics");
    if (n.queued) parts.push(n.queued + " rendering");
    if (n.done) parts.push(n.done + " ready");
    if (lastErr) parts.push(lastErr);
    if (!parts.length) parts.push(state.song ? (state.lyrics ? "on - each new take gets its lyrics"
                                                             : "on - no lyrics file for this song yet (speech-to-text will be used)")
                                             : "on - load a song for the board first");
    return "🎤 " + parts.join(" · ");
  }

  function placeReady() {
    if (typeof window.tlPlaceKaraoke !== "function") return;
    var s = state.scenes || {};
    Object.keys(s).forEach(function (k) {
      var e = s[k] || {};
      if (!e.pending || !e.output) return;
      var key = k + ":" + e.output;
      if (placedNow[key]) return;
      // wait (a few polls) for the scene's take to be on the timeline, so the lyrics line up with it
      waits[key] = (waits[key] || 0) + 1;
      var L = window.tlPlaceKaraoke({ n: parseInt(k, 10), name: e.output, take: e.take, start: e.start || 0,
                                      dur: e.dur || 5, waitForTake: waits[key] <= 5 });
      if (!L) return;
      placedNow[key] = true;
      post("/api/karaoke/" + k + "/placed", { output: e.output }).catch(function () {});
    });
  }

  function refresh() {
    return fetch("/api/karaoke").then(function (r) { return r.json(); }).then(function (d) {
      if (!d || typeof d !== "object") return;
      state = d;
      var cb = el("vdKaraoke");
      if (cb && document.activeElement !== cb) cb.checked = d.on === true;
      say(summary());
      placeReady();
    }).catch(function () { /* the server is restarting - the next poll tries again */ });
  }

  el("vdKaraoke").addEventListener("change", function () {
    var on = el("vdKaraoke").checked;
    say(on ? "🎤 turning on…" : "");
    post("/api/karaoke/on", { on: on }).then(function (d) {
      if (d && d.queued && d.queued.length)
        say("🎤 making the lyrics overlays for scene" + (d.queued.length > 1 ? "s " : " ") + d.queued.join(", "));
      return refresh();
    });
  });

  /* 2.408.0 (Tim: "please add an edit lyrics box to the kareoke dialog - some of the words are wrong"): ✎ opens the
     🎤 Karaoke dialog (ext/timelinedock/karaokegen.js) on the board's song - ✎ Edit lyrics / ⏱ Words & timing, 💾 Save
     words - and then every scene that already has an overlay gets it remade with the corrected words */
  function remake() {
    var s = state.scenes || {}, ns = Object.keys(s).filter(function (k) { return s[k] && (s[k].status === "done" || s[k].status === "failed"); });
    if (!ns.length) { say("🎤 corrected - new overlays use the words"); return; }
    say("🎤 remaking " + ns.length + " overlay(s) with the corrected words");
    ns.reduce(function (p, k) { return p.then(function () { return post("/api/karaoke/scene/" + k, {}); }); }, Promise.resolve())
      .then(refresh);
  }
  (function editButton() {
    var msg = el("vdKaraokeMsg"); if (!msg || el("vdKaraokeEdit")) return;
    var b = document.createElement("button");
    b.className = "ghost gbtn"; b.type = "button"; b.id = "vdKaraokeEdit"; b.textContent = "✎";
    b.title = "Fix the karaoke lyrics - the words the overlays show (then the scenes' overlays are remade)";
    b.setAttribute("aria-label", "Edit the karaoke lyrics");
    b.style.cssText = "flex:none;padding:0 6px";
    b.addEventListener("click", function () {
      if (!window.TlKaraokeGen) { say("🎤 the timeline docker is needed for the lyrics editor"); return; }
      if (!state.song) { say("🎤 load a song for the board first"); return; }
      window.TlKaraokeGen.open({ song: state.song, onSaved: remake });
    });
    msg.parentNode.insertBefore(b, msg);
  })();

  refresh();
  timer = setInterval(refresh, 3000);
  window.vdKaraokeRefresh = refresh;
})();
