/* bitGen Studio — THE REFERENCE VIDEO SELECTION DIALOG (2.325.0).
 *
 * Tim (verbatim): "when user clicks a video in the reference docker show a
 * dialog, show filmstrip of the clicked reference video and preview. show a
 * selection box, selection box overlay on the filmstrip will be the length
 * of the duration input in the dialog, the box will select the start frame
 * and end frame within the box, allow user to zoom in and out of filmstrip.
 * the selected portion will be the reference video for generation, either
 * to continue the video, change the character or general reference. show
 * the selected region in the preview only, add an apply and cancel button
 * to the dialog".
 *
 *   PREVIEW     plays ONLY the selected frames, looping; a seek outside the
 *               box is pulled back into it
 *   FILMSTRIP   thumbnails from GET /api/frames (lib/frames: frame-exact,
 *               cached), loaded chunk by chunk for what is on screen;
 *               − / + / the slider / Ctrl+wheel zoom (from the whole video
 *               in view down to one thumbnail per frame), Fit; the wheel
 *               scrolls sideways
 *   THE BOX     as wide as the Duration input; drag it (or click the strip
 *               to centre it there, or ←/→ one frame, Shift ±1 s) - it
 *               snaps to whole frames and stays inside the video. Start /
 *               end frames and times are shown under the preview.
 *   APPLY       POST /api/refvideo/select (lib/refSelect.js) cuts those
 *               frames into <stem>_sel_f<a>-f<b>.mp4; the dock's entry
 *               becomes that clip (the whole video = the source itself).
 *   CANCEL      (or Escape) changes nothing.
 *
 * window.RefSelect = {
 *   snapSel(start, dur, fps, total) -> {startFrame, frames, endFrame, start, dur}
 *   thumbStep(pps, thumbW, fps)     -> seconds between thumbnails
 *   zoomRange(viewW, duration, fps, thumbW) -> {min, max} pixels per second
 *   open({name, onApply(name, result), onCancel}) -> Promise<controller>
 *   close()
 * }                                                                        */
(function () {
  "use strict";
  var THUMB_H = 54;
  var RUN_S = 362 / 24;          // one H3 run (17*21+5 frames) - the default box
  var CHUNK = 12;                // thumbnails per /api/frames request
  var cur = null;                // the open dialog's controller

  function r6(x) { return Math.round(x * 1e6) / 1e6; }
  function fmt(s) {
    s = Math.max(0, +s || 0);
    var m = Math.floor(s / 60), r = s - m * 60;
    return (m ? m + ":" + (r < 10 ? "0" : "") : "") + r.toFixed(2) + (m ? "" : "s");
  }

  /** The selection in whole frames, inside the video. */
  function snapSel(start, dur, fps, total) {
    fps = +fps > 0 ? +fps : 24;
    total = Math.max(1, Math.floor(+total || 1));
    var n = Math.round((+dur || 0) * fps);
    if (!(n >= 1)) n = total;
    n = Math.min(n, total);
    var s = Math.round((+start || 0) * fps);
    if (!(s >= 0)) s = 0;
    s = Math.min(s, total - n);
    return { startFrame: s, frames: n, endFrame: s + n - 1, start: r6(s / fps), dur: r6(n / fps) };
  }

  /** Seconds between thumbnails at a zoom: one thumbnail width, never
   *  finer than one frame, always a whole number of frames. */
  function thumbStep(pps, thumbW, fps) {
    fps = +fps > 0 ? +fps : 24;
    var raw = Math.max(1 / fps, (+thumbW || 80) / Math.max(1e-6, +pps || 1));
    return r6(Math.max(1, Math.round(raw * fps)) / fps);
  }

  /** Zoom limits: the whole video in view .. one thumbnail per frame. */
  function zoomRange(viewW, duration, fps, thumbW) {
    var fit = Math.max(1e-3, (+viewW || 600) / Math.max(1 / (+fps || 24), +duration || 1));
    var max = Math.max(fit, (+fps || 24) * (+thumbW || 80));
    return { min: fit, max: max };
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  var CSS = ""
    + "dialog.refsel{width:min(980px,96vw);max-width:96vw;padding:14px}"
    + ".refsel .rsPrev{width:100%;max-height:44vh;background:#000;border-radius:8px;display:block}"
    + ".refsel .rsRow{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:8px 0;font-size:.8rem}"
    + ".refsel .rsRow input[type=number]{width:84px}"
    + ".refsel .rsF{font-family:var(--mono,monospace);color:var(--dim,#999);font-size:.74rem}"
    + ".refsel .rsView{position:relative;overflow-x:auto;overflow-y:hidden;border:1px solid var(--line,#444);"
    + "border-radius:6px;background:var(--panel-2,#222);height:" + (THUMB_H + 22) + "px;cursor:crosshair}"
    + ".refsel .rsTrack{position:relative;height:100%}"
    + ".refsel .rsRuler{position:absolute;left:0;top:0;height:16px;width:100%;font:10px var(--mono,monospace);color:var(--dim,#999)}"
    + ".refsel .rsTick{position:absolute;top:0;height:16px;border-left:1px solid var(--line,#555);padding-left:2px;white-space:nowrap}"
    + ".refsel .rsThumbs{position:absolute;left:0;top:18px;height:" + THUMB_H + "px;width:100%}"
    + ".refsel .rsThumbs img{position:absolute;top:0;height:" + THUMB_H + "px;object-fit:cover;"
    + "border-right:1px solid rgba(0,0,0,.5);pointer-events:none;user-select:none}"
    + ".refsel .rsBox{position:absolute;top:16px;height:" + (THUMB_H + 4) + "px;box-sizing:border-box;"
    + "border:2px solid var(--tiger,#f59e2c);background:rgba(245,158,44,.14);border-radius:4px;cursor:grab;"
    + "box-shadow:0 0 0 9999px rgba(0,0,0,.45);z-index:2;touch-action:none}"
    + ".refsel .rsBox:focus{outline:2px solid #fff;outline-offset:1px}"
    + ".refsel .rsBox.drag{cursor:grabbing}"
    + ".refsel .rsBoxLbl{position:absolute;left:3px;bottom:2px;font:10px var(--mono,monospace);color:#fff;"
    + "text-shadow:0 1px 2px #000;white-space:nowrap;pointer-events:none}"
    + ".refsel .rsHead{position:absolute;top:14px;width:2px;height:" + (THUMB_H + 8) + "px;background:#fff;z-index:3;pointer-events:none}"
    + ".refsel .rsBtns{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}"
    + ".refsel .rsZoom{display:flex;align-items:center;gap:6px;margin-left:auto}"
    + ".refsel .rsZoom input[type=range]{width:140px}";

  function injectCss() {
    if (document.getElementById("refselCss")) return;
    var s = el("style"); s.id = "refselCss"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function close() {
    if (!cur) return;
    var c = cur; cur = null;
    try { c.video.pause(); } catch (e) {}
    try { c.video.removeAttribute("src"); c.video.load(); } catch (e) {}
    if (c.raf) try { cancelAnimationFrame(c.raf); } catch (e) {}
    try { c.dlg.close(); } catch (e) {}
    if (c.dlg.parentNode) c.dlg.parentNode.removeChild(c.dlg);
  }

  function open(opts) {
    var o = opts || {};
    close();
    injectCss();
    var fetchFn = o.fetch || window.fetch.bind(window);
    return fetchFn("/api/refvideo/select?name=" + encodeURIComponent(o.name))
      .then(function (r) { return r.json(); })
      .then(function (info) {
        if (!info || info.error) throw new Error((info && info.error) || "could not read the video");
        return build(info, o, fetchFn);
      });
  }

  function build(info, o, fetchFn) {
    var fps = +info.fps > 0 ? +info.fps : 24;
    var total = Math.max(1, +info.frames || Math.round((+info.duration || 1) * fps));
    var duration = total / fps;
    var aspect = info.width > 0 && info.height > 0 ? info.width / info.height : 16 / 9;
    var thumbW = Math.max(40, Math.round(THUMB_H * aspect));
    var sel0 = info.selection
      ? snapSel(info.selection.start, info.selection.dur, fps, total)
      : snapSel(0, Math.min(duration, RUN_S), fps, total);

    var dlg = el("dialog", "refsel");
    dlg.setAttribute("aria-label", "Select the part of " + info.source + " to use");
    dlg.innerHTML =
      '<h2>Reference video</h2>'
      + '<div class="hint rsName"></div>'
      + '<video class="rsPrev" playsinline controls preload="auto"></video>'
      + '<div class="rsRow">'
      + '<label>Start <input type="number" class="rsStart" min="0" step="' + (1 / fps).toFixed(4) + '"> s</label>'
      + '<span class="rsF rsStartF"></span>'
      + '<label>Duration <input type="number" class="rsDur" min="' + (1 / fps).toFixed(4) + '" step="' + (1 / fps).toFixed(4) + '"> s</label>'
      + '<span class="rsF rsDurF"></span>'
      + '<span class="rsF rsEndF"></span>'
      + '<span class="rsZoom" title="Zoom the filmstrip (Ctrl + wheel over it)">'
      + '<button type="button" class="ghost gbtn rsOut" aria-label="Zoom out">−</button>'
      + '<input type="range" class="rsZoomR" min="0" max="1000" step="1" aria-label="Filmstrip zoom">'
      + '<button type="button" class="ghost gbtn rsIn" aria-label="Zoom in">+</button>'
      + '<button type="button" class="ghost gbtn rsFit" title="The whole video in view" aria-label="Fit the whole video">Fit</button>'
      + '</span></div>'
      + '<div class="rsView" tabindex="-1"><div class="rsTrack">'
      + '<div class="rsRuler"></div><div class="rsThumbs"></div>'
      + '<div class="rsBox" tabindex="0" role="slider" aria-label="The selected frames - drag, or arrow keys to move one frame"><span class="rsBoxLbl"></span></div>'
      + '<div class="rsHead"></div></div></div>'
      + '<div class="hint rsMsg" style="margin-top:6px"></div>'
      + '<div class="rsBtns"><button type="button" class="ghost rsCancel">Cancel</button>'
      + '<button type="button" class="rsApply">Apply</button></div>';
    document.body.appendChild(dlg);
    var q = function (c) { return dlg.querySelector("." + c); };
    var video = q("rsPrev"), view = q("rsView"), track = q("rsTrack"), thumbs = q("rsThumbs"),
        ruler = q("rsRuler"), box = q("rsBox"), head = q("rsHead"), msg = q("rsMsg");
    q("rsName").textContent = info.source + " · " + total + " frames @ " + fps + " fps · "
      + fmt(duration) + (info.width ? " · " + info.width + "×" + info.height : "")
      + (info.source !== info.name ? " · reopened from " + info.name : "");

    var c = { dlg: dlg, video: video, info: info, fps: fps, total: total, duration: duration,
              sel: sel0, pps: 1, thumbW: thumbW, chunks: {}, stepKey: "", raf: 0, applied: null };
    cur = c;

    function viewW() { return view.clientWidth || 600; }
    function zr() { return zoomRange(viewW(), duration, fps, thumbW); }
    function zoomToSlider(pps) {
      var z = zr();
      return z.max <= z.min ? 0 : Math.round(1000 * Math.log(pps / z.min) / Math.log(z.max / z.min));
    }
    function sliderToZoom(v) {
      var z = zr();
      return z.min * Math.pow(z.max / z.min, Math.max(0, Math.min(1000, +v)) / 1000);
    }

    function paintSel() {
      var s = c.sel;
      box.style.left = (s.start * c.pps) + "px";
      box.style.width = Math.max(4, s.dur * c.pps) + "px";
      q("rsBoxLbl").textContent = "f" + s.startFrame + " – f" + s.endFrame;
      box.setAttribute("aria-valuenow", String(s.startFrame));
      box.setAttribute("aria-valuetext", "frames " + s.startFrame + " to " + s.endFrame);
      if (document.activeElement !== q("rsStart")) q("rsStart").value = s.start.toFixed(3);
      if (document.activeElement !== q("rsDur")) q("rsDur").value = s.dur.toFixed(3);
      q("rsStartF").textContent = "frame " + s.startFrame + " (" + fmt(s.start) + ")";
      q("rsDurF").textContent = s.frames + " frame" + (s.frames === 1 ? "" : "s");
      q("rsEndF").textContent = "→ end frame " + s.endFrame + " (" + fmt((s.endFrame + 1) / fps) + ")"
        + (s.dur > RUN_S + 1e-6 ? " · longer than one H3 run (~15 s)" : "");
    }
    function setSel(start, dur, seek) {
      c.sel = snapSel(start, dur, fps, total);
      paintSel();
      if (seek !== false) { try { video.currentTime = c.sel.start; } catch (e) {} }
      paintHead();
    }
    function paintHead() {
      head.style.left = ((+video.currentTime || 0) * c.pps) + "px";
    }
    function paintRuler() {
      ruler.innerHTML = "";
      var every = [0.04, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
        .find(function (x) { return x * c.pps >= 70; }) || 600;
      for (var t = 0; t <= duration + 1e-9; t += every) {
        var k = el("div", "rsTick");
        k.style.left = (t * c.pps) + "px";
        k.textContent = every < 1 ? "f" + Math.round(t * fps) : fmt(t);
        ruler.appendChild(k);
      }
    }
    function setZoom(pps, anchorT, anchorX) {
      var z = zr();
      c.pps = Math.max(z.min, Math.min(z.max, pps));
      track.style.width = Math.max(viewW(), Math.ceil(duration * c.pps)) + "px";
      q("rsZoomR").value = String(zoomToSlider(c.pps));
      thumbs.innerHTML = ""; c.chunks = {};
      c.stepKey = String(thumbStep(c.pps, thumbW, fps));
      paintRuler(); paintSel(); paintHead();
      if (anchorT != null) view.scrollLeft = Math.max(0, anchorT * c.pps - (anchorX || viewW() / 2));
      loadThumbs();
    }

    var thumbTimer = 0;
    function loadThumbs() {
      clearTimeout(thumbTimer);
      thumbTimer = setTimeout(loadNow, 80);
    }
    function loadNow() {
      if (cur !== c) return;
      var step = +c.stepKey, span = step * CHUNK;
      var a = view.scrollLeft / c.pps, b = (view.scrollLeft + viewW()) / c.pps;
      var k0 = Math.max(0, Math.floor(a / span)), k1 = Math.floor(Math.min(duration, b) / span);
      for (var k = k0; k <= k1; k++) loadChunk(k, step, span);
    }
    function loadChunk(k, step, span) {
      var key = c.stepKey + ":" + k;
      if (c.chunks[key]) return;
      c.chunks[key] = "loading";
      var st = k * span, en = Math.min(duration, st + span);
      if (en <= st) return;
      var reqFps = Math.min(60, Math.max(1, 1 / step));
      var url = "/api/frames?src=video&name=" + encodeURIComponent(info.source)
        + "&start=" + st.toFixed(4) + "&end=" + en.toFixed(4) + "&fps=" + reqFps.toFixed(4)
        + "&width=" + Math.min(320, thumbW * 2);
      fetchFn(url).then(function (r) { return r.json(); }).then(function (d) {
        if (cur !== c || String(step) !== c.stepKey || !d || !d.frames) return;
        c.chunks[key] = "done";
        for (var j = 0; j < CHUNK; j++) {
          var t = st + j * step;
          if (t >= en - 1e-9) break;
          var best = null;
          d.frames.forEach(function (f) {
            if (!best || Math.abs(f.t - t) < Math.abs(best.t - t)) best = f;
          });
          if (!best) continue;
          var im = el("img");
          im.alt = ""; im.loading = "lazy"; im.draggable = false;
          im.src = "/framecache/" + d.key + "/" + best.file;
          im.style.left = (t * c.pps) + "px";
          im.style.width = Math.max(2, step * c.pps) + "px";
          thumbs.appendChild(im);
        }
      }).catch(function () { c.chunks[key] = ""; });
    }

    // ---- the box: drag, click-to-place, keys
    var drag = null;
    function tAt(clientX) {
      var r = track.getBoundingClientRect();
      return (clientX - r.left) / c.pps;
    }
    box.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      drag = { dx: tAt(e.clientX) - c.sel.start };
      box.classList.add("drag");
      try { box.setPointerCapture(e.pointerId); } catch (er) {}
      box.focus();
    });
    box.addEventListener("pointermove", function (e) {
      if (!drag) return;
      setSel(tAt(e.clientX) - drag.dx, c.sel.dur);
      var bx = c.sel.start * c.pps - view.scrollLeft;         // follow the box off either edge
      if (bx < 0) view.scrollLeft += bx;
      else if (bx + c.sel.dur * c.pps > viewW() && c.sel.dur * c.pps < viewW())
        view.scrollLeft += bx + c.sel.dur * c.pps - viewW();
    });
    function endDrag() { drag = null; box.classList.remove("drag"); }
    box.addEventListener("pointerup", endDrag);
    box.addEventListener("pointercancel", endDrag);
    track.addEventListener("pointerdown", function (e) {
      if (e.target === box || box.contains(e.target)) return;
      setSel(tAt(e.clientX) - c.sel.dur / 2, c.sel.dur);
    });
    box.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      if (!d) return;
      e.preventDefault();
      var step = e.shiftKey ? fps : 1;
      setSel((c.sel.startFrame + d * step) / fps, c.sel.dur);
    });

    // ---- zoom
    q("rsZoomR").addEventListener("input", function () {
      var mid = (view.scrollLeft + viewW() / 2) / c.pps;
      setZoom(sliderToZoom(this.value), mid);
    });
    q("rsIn").addEventListener("click", function () {
      setZoom(c.pps * 1.6, c.sel.start + c.sel.dur / 2);
    });
    q("rsOut").addEventListener("click", function () {
      setZoom(c.pps / 1.6, c.sel.start + c.sel.dur / 2);
    });
    q("rsFit").addEventListener("click", function () { setZoom(zr().min, 0, 0); });
    view.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        var r = view.getBoundingClientRect(), x = e.clientX - r.left;
        var t = (view.scrollLeft + x) / c.pps;
        setZoom(c.pps * (e.deltaY < 0 ? 1.25 : 0.8), t, x);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        view.scrollLeft += e.deltaY;
      }
    }, { passive: false });
    view.addEventListener("scroll", loadThumbs);

    // ---- the inputs
    q("rsStart").addEventListener("change", function () { setSel(+this.value, c.sel.dur); });
    q("rsDur").addEventListener("change", function () { setSel(c.sel.start, +this.value); });

    // ---- the preview: the selected region ONLY, looping
    video.src = "/passets/video/" + encodeURIComponent(info.source);
    function keepInside() {
      var t = +video.currentTime || 0, s = c.sel;
      var end = (s.endFrame + 1) / fps;
      if (t < s.start - 0.5 / fps || t >= end - 0.25 / fps) {
        try { video.currentTime = s.start; } catch (e) {}
      }
      paintHead();
    }
    function tick() {
      if (cur !== c) return;
      keepInside();
      c.raf = video.paused ? 0 : requestAnimationFrame(tick);
    }
    video.addEventListener("loadedmetadata", function () { try { video.currentTime = c.sel.start; } catch (e) {} });
    video.addEventListener("play", function () { keepInside(); if (!c.raf) c.raf = requestAnimationFrame(tick); });
    video.addEventListener("seeked", keepInside);
    video.addEventListener("timeupdate", keepInside);

    // ---- apply / cancel
    function cancel() {
      close();
      if (o.onCancel) try { o.onCancel(); } catch (e) {}
    }
    function apply() {
      var s = c.sel;
      msg.textContent = s.frames === total ? "the whole video…" : "cutting frames " + s.startFrame + "–" + s.endFrame + "…";
      q("rsApply").disabled = true;
      return fetchFn("/api/refvideo/select", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: info.source, start: s.start, dur: s.dur }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        q("rsApply").disabled = false;
        if (!d || d.error) { msg.textContent = "⚠ " + ((d && d.error) || "the cut failed"); return null; }
        c.applied = d;
        close();
        if (o.onApply) o.onApply(d.name, d);
        return d;
      }).catch(function (e) { q("rsApply").disabled = false; msg.textContent = "⚠ " + e; return null; });
    }
    q("rsCancel").addEventListener("click", cancel);
    q("rsApply").addEventListener("click", apply);
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); cancel(); });

    try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }
    setZoom(zr().min, 0, 0);
    paintSel();
    c.setSel = setSel; c.setZoom = setZoom; c.apply = apply; c.cancel = cancel; c.zoomRange = zr;
    c.loadNow = loadNow;
    return c;
  }

  window.RefSelect = { snapSel: snapSel, thumbStep: thumbStep, zoomRange: zoomRange,
                       open: open, close: close, RUN_S: RUN_S,
                       current: function () { return cur; } };
})();
