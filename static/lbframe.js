/* bitGen Studio — static/lbframe.js (2.903.0): A VIDEO IN THE PREVIEW ONE FRAME AT A TIME + 📷 CAPTURE THE FRAME (H3LbFrame).
 *
 * Tim (verbatim): "when viewing a video add a button to advance 1 frame and go back 1 frame. and a button to capture the frame"
 *
 * In the preview dialog (#lb), while a video is shown, the bar has ⏴ (one frame back), the frame number, ⏵ (one frame on) and
 * 📷 Capture frame. Stepping pauses the video and lands in the middle of the next / previous frame, using the video's real
 * frame rate and frame count (GET /api/videoframe/info - ffprobe; a video outside the project = 24 fps). Keys while the
 * preview shows a video: , one frame back, . one frame on (← / → still go to the previous / next file).
 * 📷 saves the frame on screen as a PNG at the video's own size, cut from the file by ffmpeg (POST /api/videoframe/capture
 * -> the project's images = Assets, and the Gallery, named <video>_frame<n>.png); Shift+click also puts it in the
 * References docker. A video ffmpeg cannot reach = the picture the browser shows, saved through /api/imagesave.
 *   frameOf(t, fps, n) / timeOf(f, fps, dur)   pure: the frame shown at t / the time to show frame f (its middle)
 */
(function (root) {
  "use strict";
  var doc = root.document, $ = function (id) { return doc.getElementById(id); };
  var INFO = {};                                           // url -> {fps, frames, dur, w, h} (or a promise)
  function frameOf(t, fps, n) { var f = Math.floor(Math.max(0, +t || 0) * fps + 1e-6); return n > 0 ? Math.min(n - 1, f) : f; }
  function timeOf(f, fps, dur) { var t = (Math.max(0, f) + 0.5) / fps; return dur > 0 ? Math.min(t, Math.max(0, dur - 0.25 / fps)) : t; }
  function cur() { try { return lb && lb.items && lb.items[lb.i]; } catch (e) { return null; } }   // eslint-disable-line no-undef
  function vid() { var w = $("lb_wrap"); return w ? w.querySelector("video") : null; }
  function showing() { var it = cur(), d = $("lb"); return !!(d && d.open && it && it.kind === "video" && vid()); }
  function infoOf(url, v) {
    if (INFO[url] && !INFO[url].then) return Promise.resolve(INFO[url]);
    if (INFO[url]) return INFO[url];
    var guess = function () { var dur = v && isFinite(v.duration) ? v.duration : 0; return { fps: 24, frames: Math.max(1, Math.round(dur * 24)), dur: dur, guess: true }; };
    INFO[url] = fetch("/api/videoframe/info?url=" + encodeURIComponent(url)).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { INFO[url] = j && j.fps > 0 ? j : guess(); return INFO[url]; })
      .catch(function () { INFO[url] = guess(); return INFO[url]; });
    return INFO[url];
  }
  function css() {
    if ($("lbFrameCss")) return;
    var st = doc.createElement("style"); st.id = "lbFrameCss";
    st.textContent = "#lb_fgrp{display:inline-flex;align-items:center;gap:4px}#lb_fgrp[hidden]{display:none}"
      + "#lb_fno{min-width:7.5em;text-align:center;font-variant-numeric:tabular-nums;font-size:.76rem;opacity:.85}"
      + "#lb_fcap{white-space:nowrap}#lb_fmsg{font-size:.72rem;opacity:.8;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
    doc.head.appendChild(st);
  }
  function build() {
    if ($("lb_fgrp")) return;
    var fit = $("lb_fit"); if (!fit || !fit.parentNode) return;
    css();
    var g = doc.createElement("span"); g.id = "lb_fgrp"; g.hidden = true;
    g.innerHTML = '<span class="sep"></span>'
      + '<button class="ghost" id="lb_fprev" type="button" title="One frame back (key: comma)" aria-label="One frame back">⏴</button>'
      + '<span class="pos" id="lb_fno">frame –</span>'
      + '<button class="ghost" id="lb_fnext" type="button" title="One frame on (key: full stop)" aria-label="One frame on">⏵</button>'
      + '<button class="ghost" id="lb_fcap" type="button" title="Save this frame as a picture (Assets + Gallery) at the video\'s own size. Shift+click: also put it in the References docker">📷 Capture frame</button>'
      + '<span id="lb_fmsg" aria-live="polite"></span>';
    fit.parentNode.insertBefore(g, fit.nextSibling);
    $("lb_fprev").onclick = function () { step(-1); };
    $("lb_fnext").onclick = function () { step(1); };
    $("lb_fcap").onclick = function (e) { capture(!!(e && e.shiftKey)); };
  }
  function say(t) { var m = $("lb_fmsg"); if (m) { m.textContent = t || ""; m.title = t || ""; } }
  var bound = null;
  function label() {
    var v = vid(), it = cur(), n = $("lb_fno"); if (!v || !it || !n) return;
    var inf = INFO[it.url];
    if (!inf || inf.then) { n.textContent = "frame –"; return; }
    var no = frameOf(v.currentTime, inf.fps, inf.frames) + 1, fps = inf.fps;
    n.textContent = "frame " + no + " / " + inf.frames;
    n.title = inf.w ? fps + " fps · " + inf.w + " × " + inf.h : fps + " fps";
  }
  function paint() {
    build();
    var g = $("lb_fgrp"); if (!g) return;
    var on = showing(); g.hidden = !on;
    if (!on) return;
    var v = vid(), it = cur();
    say("");
    if (bound !== v) {
      bound = v;
      ["timeupdate", "seeked", "loadedmetadata"].forEach(function (k) { v.addEventListener(k, label); });
      infoOf(it.url, v).then(label);
    }
    label();
  }
  function step(d) {
    var v = vid(), it = cur(); if (!v || !it) return Promise.resolve();
    v.pause();
    return infoOf(it.url, v).then(function (inf) {
      var f = frameOf(v.currentTime, inf.fps, inf.frames) + d;
      var last = inf.frames > 0 ? inf.frames - 1 : f;
      f = Math.max(0, Math.min(last, f));
      v.currentTime = timeOf(f, inf.fps, isFinite(v.duration) ? v.duration : inf.dur);
      label();
    });
  }
  function refresh() {
    try { if (typeof refreshGallery === "function") refreshGallery(); } catch (e) { /* the docks only */ }   // eslint-disable-line no-undef
    try { if (typeof refreshAssets === "function") refreshAssets(); } catch (e) { /* as above */ }          // eslint-disable-line no-undef
  }
  function toRefs(name) {
    try { if (typeof addRefImageByUrl === "function") return addRefImageByUrl("/passets/images/" + encodeURIComponent(name), name); } catch (e) { /* the docker only */ }   // eslint-disable-line no-undef
    return null;
  }
  function log(t) { try { if (typeof logLine === "function") logLine("[preview] " + t); } catch (e) { /* the bar says it */ } }   // eslint-disable-line no-undef
  /** the picture the browser shows (a video ffmpeg cannot reach) -> /api/imagesave */
  function browserShot(v, it, f) {
    return new Promise(function (ok, no) {
      var c = doc.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
      if (!c.width) return no(new Error("the video has no picture yet"));
      c.getContext("2d").drawImage(v, 0, 0);
      c.toBlob(function (b) {
        if (!b) return no(new Error("the browser could not copy the frame"));
        var stem = String(it.name || "video").replace(/\.[a-z0-9]+$/i, "");
        fetch("/api/imagesave?name=" + encodeURIComponent(stem + "_frame" + f) + "&ext=png", { method: "POST", body: b })
          .then(function (r) { return r.json(); }).then(ok, no);
      }, "image/png");
    });
  }
  function capture(alsoRefs) {
    var v = vid(), it = cur(); if (!v || !it) return Promise.resolve(null);
    v.pause();
    var btn = $("lb_fcap"); if (btn) btn.disabled = true;
    say("📷 saving the frame…");
    return infoOf(it.url, v).then(function (inf) {
      var f = frameOf(v.currentTime, inf.fps, inf.frames);
      var viaServer = !inf.guess;
      var job = viaServer
        ? fetch("/api/videoframe/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: it.url, frame: f }) })
            .then(function (r) { return r.json(); }).then(function (j) { if (j.error) throw new Error(j.error); return j; })
        : browserShot(v, it, f);
      return job.then(function (j) {
        if (!j || j.error) throw new Error((j && j.error) || "not saved");
        var no = f + 1, nm = j.name, box = $("lb_fmsg") || doc.createElement("span");
        box.textContent = alsoRefs ? "📷 frame " + no + " saved as " + nm + " (Assets + Gallery) + References" : "📷 frame " + no + " saved as " + nm + " (Assets + Gallery)";
        box.title = box.textContent;
        refresh(); if (alsoRefs) toRefs(nm);
        log(box.textContent);
        return j;
      });
    }).catch(function (e) { var why = e && e.message ? e.message : String(e), box = $("lb_fmsg") || doc.createElement("span"); box.textContent = "📷 not saved - " + why; box.title = box.textContent; log(box.textContent); return null; })
      .then(function (r) { if (btn) btn.disabled = false; return r; });
  }
  doc.addEventListener("keydown", function (e) {
    if (!showing() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === ",") { e.preventDefault(); step(-1); }
    else if (e.key === ".") { e.preventDefault(); step(1); }
  });
  function start() {
    build();
    var nm = $("lb_name"), d = $("lb");
    if (nm && root.MutationObserver) new root.MutationObserver(function () { setTimeout(paint, 0); }).observe(nm, { childList: true, characterData: true, subtree: true });
    if (d && root.MutationObserver) new root.MutationObserver(function () { setTimeout(paint, 0); }).observe(d, { attributes: true, attributeFilter: ["open"] });
    paint();
  }
  root.H3LbFrame = { frameOf: frameOf, timeOf: timeOf, step: step, capture: capture, paint: paint, info: infoOf };
  if (doc.readyState !== "loading") start(); else doc.addEventListener("DOMContentLoaded", start);
})(typeof window !== "undefined" ? window : globalThis);
