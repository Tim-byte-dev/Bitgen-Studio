/* bitGen Studio — SCREEN CAPTURE + SCREEN RECORD (2.367.0).
 *
 * Tim: "can we add a screen capture and screen record button in the left docker menubar, icon only. so i can
 * make a promotional video and tutorials".
 *
 * Two icon-only buttons in the left dock's menu bar:
 *   📷  a screenshot -> projects/<p>/output/screenshot_<stamp>.png (the gallery's Image tab)
 *   ⏺  start / stop a screen recording -> screenrec_<stamp>.mp4 (H.264 + AAC, the gallery's Video tab). While
 *       it records the button is a pulsing red ■ and its tooltip shows the time. Chunks go to the server every
 *       second (routes/screenCap.js), so a long tutorial never sits in memory; the server makes the mp4.
 * Right-click either button for the options (remembered on this computer):
 *   Capture       App window (a clean tutorial frame) · Whole screen
 *   Computer sound   the sound the computer plays (renders, songs) - Windows in the app; a browser tab asks
 *   Microphone       your narration, mixed with the computer sound
 *   Countdown     Off · 3 s · 5 s (time to move the mouse where the tutorial starts)
 * Keys: Alt+Shift+S = screenshot, Alt+Shift+R = start / stop recording (no click in the video).
 * In the app (Electron) the window / screen is picked for you (electron/capture.js); in a browser tab the
 * browser asks which tab, window or screen to share.
 * window.ScreenCap = {shot, toggle, recording, prefs, savePrefs, pickMime, openMenu} */
(function () {
  "use strict";
  var KEY = "bitgen.screencap";
  var DEF = { target: "window", systemAudio: true, mic: false, countdown: 0 };
  var prefs = load();
  var rec = null;          // {recorder, stream, tracks, ctx, id, chain, started, timer, failed}
  var busy = false;

  function load() {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { p = {}; }
    var o = {};
    for (var k in DEF) o[k] = (p[k] === undefined ? DEF[k] : p[k]);
    if (o.target !== "screen") o.target = "window";
    o.countdown = [0, 3, 5].indexOf(Number(o.countdown)) >= 0 ? Number(o.countdown) : 0;
    o.systemAudio = !!o.systemAudio; o.mic = !!o.mic;
    return o;
  }
  function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* per-computer only */ } }

  function say(text, bad) {
    if (window.SaveAs && typeof window.SaveAs.say === "function") return window.SaveAs.say(text, bad);
    if (bad) console.warn("[screencap] " + text); else console.log("[screencap] " + text);
  }
  function gallery() { try { if (typeof window.refreshGallery === "function") window.refreshGallery(); } catch (e) { /* the gallery refreshes on its own too */ } }
  var shell = function () { return window.h3shell && window.h3shell.capture ? window.h3shell.capture : null; };

  /* ---------------------------------------------------------------- the look */
  function css() {
    if (document.getElementById("capStyle")) return;
    var s = document.createElement("style");
    s.id = "capStyle";
    s.textContent =
      "#capRec.rec{color:#e5484d;animation:cappulse 1.2s ease-in-out infinite}" +
      "#capRec.busy,#capShot.busy{opacity:.55;cursor:progress}" +
      "@keyframes cappulse{0%,100%{opacity:1}50%{opacity:.35}}" +
      "#capMenu{position:fixed;z-index:2147483001;min-width:210px;padding:8px 10px;border-radius:7px;" +
      "background:#1d2128;color:#e8e8e8;border:1px solid #3a404c;box-shadow:0 6px 22px rgba(0,0,0,.5);font-size:.74rem}" +
      "#capMenu .capt{font-family:var(--mono,monospace);font-size:.58rem;letter-spacing:.12em;color:#9aa3b2;margin:6px 0 3px}" +
      "#capMenu .capt:first-child{margin-top:0}" +
      "#capMenu label{display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer}" +
      "#capMenu .capnote{color:#9aa3b2;font-size:.62rem;margin-top:6px;line-height:1.35}" +
      "#capCount{position:fixed;inset:0;z-index:2147483002;display:flex;align-items:center;justify-content:center;" +
      "pointer-events:none;font-size:9rem;font-weight:700;color:#fff;text-shadow:0 4px 30px rgba(0,0,0,.8)}" +
      "#capFlash{position:fixed;inset:0;z-index:2147483002;background:#fff;opacity:.7;pointer-events:none;transition:opacity .25s}";
    document.head.appendChild(s);
  }

  function buttons() {
    var bar = document.querySelector("#menubar .projbtns, #ldock .dockhead .projbtns");
    if (!bar || document.getElementById("capShot")) return;
    var shotB = document.createElement("button");
    shotB.className = "ghost"; shotB.id = "capShot"; shotB.type = "button"; shotB.textContent = "📷";
    shotB.title = "Screenshot - saved to the gallery (Alt+Shift+S). Right-click: options";
    var recB = document.createElement("button");
    recB.className = "ghost"; recB.id = "capRec"; recB.type = "button"; recB.textContent = "⏺";
    recB.title = "Screen record - click again to stop; the mp4 goes to the gallery (Alt+Shift+R). Right-click: options";
    shotB.addEventListener("click", function () { shot(); });
    recB.addEventListener("click", function () { toggle(); });
    [shotB, recB].forEach(function (b) {
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); openMenu(b); });
    });
    var before = document.getElementById("openSettings");
    if (before && before.parentNode === bar) { bar.insertBefore(shotB, before); bar.insertBefore(recB, before); }
    else { bar.appendChild(shotB); bar.appendChild(recB); }
  }

  function closeMenu() { var m = document.getElementById("capMenu"); if (m) m.remove(); }
  function openMenu(anchor) {
    closeMenu();
    var m = document.createElement("div");
    m.id = "capMenu"; m.setAttribute("role", "menu");
    var inApp = !!shell();
    m.innerHTML =
      '<div class="capt">CAPTURE</div>' +
      '<label><input type="radio" name="capTarget" value="window"> App window</label>' +
      '<label><input type="radio" name="capTarget" value="screen"> Whole screen</label>' +
      '<div class="capt">SOUND (RECORDING)</div>' +
      '<label><input type="checkbox" id="capSys"> Computer sound</label>' +
      '<label><input type="checkbox" id="capMic"> Microphone (narration)</label>' +
      '<div class="capt">COUNTDOWN</div>' +
      '<label><input type="radio" name="capCd" value="0"> Off</label>' +
      '<label><input type="radio" name="capCd" value="3"> 3 seconds</label>' +
      '<label><input type="radio" name="capCd" value="5"> 5 seconds</label>' +
      '<div class="capnote">' + (inApp
        ? "Computer sound is recorded on Windows. Files land in the gallery."
        : "In a browser tab the browser asks what to share - tick its “share audio” for computer sound.") + "</div>";
    document.body.appendChild(m);
    m.querySelector('input[name=capTarget][value="' + prefs.target + '"]').checked = true;
    m.querySelector('input[name=capCd][value="' + prefs.countdown + '"]').checked = true;
    m.querySelector("#capSys").checked = prefs.systemAudio;
    m.querySelector("#capMic").checked = prefs.mic;
    m.addEventListener("change", function (e) {
      var t = e.target;
      if (t.name === "capTarget") prefs.target = t.value;
      else if (t.name === "capCd") prefs.countdown = Number(t.value);
      else if (t.id === "capSys") prefs.systemAudio = t.checked;
      else if (t.id === "capMic") prefs.mic = t.checked;
      savePrefs();
    });
    var r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 0, bottom: 0 };
    m.style.left = Math.max(6, Math.min(r.left, (window.innerWidth || 800) - 230)) + "px";
    m.style.top = (r.bottom + 4) + "px";
    setTimeout(function () {
      document.addEventListener("mousedown", function off(e) {
        if (!m.contains(e.target)) { closeMenu(); document.removeEventListener("mousedown", off, true); }
      }, true);
    }, 0);
    return m;
  }

  function countdown(n) {
    return new Promise(function (done) {
      if (!n) return done();
      var o = document.createElement("div");
      o.id = "capCount"; document.body.appendChild(o);
      var k = n;
      (function tick() {
        if (k <= 0) { o.remove(); return setTimeout(done, 120); }   // the overlay is gone before the first frame
        o.textContent = String(k--);
        setTimeout(tick, 1000);
      })();
    });
  }
  function flash() {
    var f = document.createElement("div");
    f.id = "capFlash"; document.body.appendChild(f);
    setTimeout(function () { f.style.opacity = "0"; }, 30);
    setTimeout(function () { f.remove(); }, 320);
  }
  function setBusy(b, on) { if (b) { b.classList.toggle("busy", !!on); b.disabled = !!on; } }

  function post(url, blob, type) {
    return fetch(url, { method: "POST", headers: { "Content-Type": type || "application/octet-stream" }, body: blob })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      }); });
  }

  /* ---------------------------------------------------------------- 📷 */
  function grabFrame() {
    // a browser tab: the browser's picker, one frame, the stream stopped at once
    var md = navigator.mediaDevices;
    if (!md || !md.getDisplayMedia) return Promise.reject(new Error("this browser cannot capture the screen"));
    var opt = { video: true, audio: false };
    if (prefs.target === "window") { opt.preferCurrentTab = true; opt.selfBrowserSurface = "include"; }
    return md.getDisplayMedia(opt).then(function (stream) {
      var v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.srcObject = stream;
      return v.play().then(function () {
        return new Promise(function (ok) { setTimeout(ok, 250); });   // the first real frame
      }).then(function () {
        var c = document.createElement("canvas");
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext("2d").drawImage(v, 0, 0);
        stream.getTracks().forEach(function (t) { t.stop(); });
        return new Promise(function (ok, bad) {
          c.toBlob(function (b) { b ? ok(b) : bad(new Error("the frame could not be read")); }, "image/png");
        });
      }, function (e) { stream.getTracks().forEach(function (t) { t.stop(); }); throw e; });
    });
  }

  function shot() {
    var b = document.getElementById("capShot");
    if (busy) return Promise.resolve(null);
    busy = true; closeMenu();
    return countdown(prefs.countdown).then(function () {
      var s = shell();
      if (s) return s.shot({ target: prefs.target }).then(function (bytes) { return new Blob([bytes], { type: "image/png" }); });
      return grabFrame();
    }).then(function (blob) {
      flash(); setBusy(b, true);
      return post("/api/screencap/shot", blob, "image/png");
    }).then(function (j) {
      say(j.note || ("screenshot saved: " + j.name)); gallery(); return j;
    }).catch(function (e) {
      if (e && e.name === "NotAllowedError") { say("screenshot cancelled"); return null; }
      say("screenshot failed: " + (e && e.message || e), true); return null;
    }).then(function (r) { busy = false; setBusy(b, false); return r; });
  }

  /* ---------------------------------------------------------------- ⏺ */
  function pickMime() {
    var MR = window.MediaRecorder;
    var list = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm;codecs=h264,opus", "video/webm"];
    if (!MR || typeof MR.isTypeSupported !== "function") return "";
    for (var i = 0; i < list.length; i++) if (MR.isTypeSupported(list[i])) return list[i];
    return "";
  }

  function mmss(ms) {
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function stopTracks(r) {
    (r.tracks || []).forEach(function (t) { try { t.stop(); } catch (e) { /* already ended */ } });
    if (r.ctx) { try { r.ctx.close(); } catch (e) { /* closed */ } }
  }

  function openStreams() {
    var md = navigator.mediaDevices;
    if (!md || !md.getDisplayMedia) return Promise.reject(new Error("this browser cannot record the screen"));
    if (!window.MediaRecorder) return Promise.reject(new Error("this browser cannot record video (no MediaRecorder)"));
    var s = shell();
    var ready = s ? s.setup({ target: prefs.target, systemAudio: prefs.systemAudio }) : Promise.resolve(null);
    return ready.then(function () {
      var opt = { video: { frameRate: { ideal: 30, max: 60 } }, audio: !!prefs.systemAudio };
      if (!s) {
        if (prefs.target === "window") { opt.preferCurrentTab = true; opt.selfBrowserSurface = "include"; }
        if (prefs.systemAudio) opt.systemAudio = "include";
      }
      return md.getDisplayMedia(opt);
    }).then(function (display) {
      if (!prefs.mic) return { display: display, mic: null };
      return md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .then(function (mic) { return { display: display, mic: mic }; },
              function (e) { say("microphone not available (" + (e && e.message || e) + ") - recording without it", true);
                             return { display: display, mic: null }; });
    });
  }

  function mix(display, mic) {
    var tracks = display.getTracks().concat(mic ? mic.getTracks() : []);
    var v = display.getVideoTracks()[0];
    var dA = display.getAudioTracks(), mA = mic ? mic.getAudioTracks() : [];
    var out = [v], ctx = null;
    if (dA.length && mA.length) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      var dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(new MediaStream(dA)).connect(dest);
      ctx.createMediaStreamSource(new MediaStream(mA)).connect(dest);
      out = out.concat(dest.stream.getAudioTracks());
    } else {
      out = out.concat(dA.length ? dA : mA);
    }
    return { stream: new MediaStream(out), tracks: tracks, ctx: ctx, video: v };
  }

  function start() {
    var b = document.getElementById("capRec");
    busy = true; closeMenu(); setBusy(b, true);
    var r = { chain: Promise.resolve(), failed: null };
    return openStreams().then(function (st) {
      var m = mix(st.display, st.mic);
      r.stream = m.stream; r.tracks = m.tracks; r.ctx = m.ctx;
      setBusy(b, false);
      return countdown(prefs.countdown).then(function () {
        return post("/api/screencap/rec/start", "", "application/json");
      }).then(function (j) {
        r.id = j.id;
        var mime = pickMime();
        var o = { videoBitsPerSecond: 16000000, audioBitsPerSecond: 192000 };
        if (mime) o.mimeType = mime;
        r.recorder = new MediaRecorder(r.stream, o);
        r.recorder.ondataavailable = function (e) {
          if (!e.data || !e.data.size || r.failed) return;
          var part = e.data;
          r.chain = r.chain.then(function () {
            return post("/api/screencap/rec/" + r.id + "/chunk", part);
          }).catch(function (err) {
            if (!r.failed) { r.failed = err; say("recording stopped - a chunk did not reach the server: " + err.message, true); stop(); }
          });
        };
        r.recorder.onstop = function () { finish(r); };
        m.video.addEventListener("ended", function () { if (rec === r) stop(); });   // the browser's own "Stop sharing"
        r.started = Date.now();
        r.recorder.start(1000);
        rec = r; busy = false;
        b.classList.add("rec"); b.textContent = "■";
        r.timer = setInterval(function () { b.title = "Stop recording (" + mmss(Date.now() - r.started) + ") - Alt+Shift+R"; }, 1000);
        b.title = "Stop recording (0:00) - Alt+Shift+R";
        return r;
      });
    }).catch(function (e) {
      busy = false; setBusy(b, false); stopTracks(r);
      if (r.id) post("/api/screencap/rec/" + r.id + "/cancel", "", "application/json").catch(function () {});
      if (e && e.name === "NotAllowedError") { say("recording cancelled"); return null; }
      say("recording could not start: " + (e && e.message || e), true);
      return null;
    });
  }

  function stop() {
    var r = rec;
    if (!r) return;
    rec = null;
    clearInterval(r.timer);
    try { if (r.recorder && r.recorder.state !== "inactive") r.recorder.stop(); else finish(r); }
    catch (e) { finish(r); }
  }

  function finish(r) {
    if (r.done) return; r.done = true;
    var b = document.getElementById("capRec");
    stopTracks(r);
    if (b) { b.classList.remove("rec"); b.textContent = "⏳"; setBusy(b, true); b.title = "Making the mp4..."; }
    busy = true;
    say("making the mp4 (" + mmss(Date.now() - r.started) + ")...");
    r.finished = r.chain.then(function () {
      if (r.failed) return post("/api/screencap/rec/" + r.id + "/cancel", "", "application/json").then(function () { return null; });
      return post("/api/screencap/rec/" + r.id + "/finish", "", "application/json").then(function (j) {
        say(j.note || ("recording saved: " + j.name), j.converted === false); gallery(); return j;
      });
    }).catch(function (e) { say("the recording could not be saved: " + (e && e.message || e), true); return null; })
      .then(function (j) {
        busy = false;
        if (b) { b.textContent = "⏺"; setBusy(b, false);
                 b.title = "Screen record - click again to stop; the mp4 goes to the gallery (Alt+Shift+R). Right-click: options"; }
        return j;
      });
    return r.finished;
  }

  function toggle() {
    if (rec) { stop(); return Promise.resolve(true); }
    if (busy) return Promise.resolve(null);
    return start();
  }

  function keys(e) {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
    var k = String(e.key || "").toLowerCase();
    if (k === "s") { e.preventDefault(); shot(); }
    else if (k === "r") { e.preventDefault(); toggle(); }
    else if (k === "escape") closeMenu();
  }

  function init() {
    css(); buttons();
    document.addEventListener("keydown", keys);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }
  // the menu bar (2.382.1; the left dock before) is above this script in the page, so the buttons go in at once (no first paint without them)
  if (document.readyState !== "loading" || document.querySelector("#menubar .projbtns, #ldock .dockhead .projbtns")) init();
  else document.addEventListener("DOMContentLoaded", init);

  window.ScreenCap = { shot: shot, toggle: toggle, recording: function () { return !!rec; },
                       prefs: prefs, savePrefs: savePrefs, pickMime: pickMime, openMenu: openMenu,
                       _last: function () { return rec; } };
})();
