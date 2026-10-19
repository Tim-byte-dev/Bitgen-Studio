// bitGen Studio — the SFX dock (2.360.0).
// Tim: "can you add a sfx docker, let user add video files, including .mov or audio files, extract audio from
// video files allow user to select section from the waveform and trim - give option to keep selected or delete
// selected".
// The project's sound effects (projects/<p>/sfx, routes/sfx.js): 📂 Add (a video's audio is extracted), the
// waveform (drag = select, click = seek, 🔍 zoom), Start / End to fine-tune, ✂ Keep selected / 🗑 Delete
// selected (in place, ↶ Undo - or "as a new file"), → 🔊 a copy into the Sound assets, 🗑 delete the file.
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  if (!el("sfxdock")) return;

  var S = { name: "", peaks: null, secs: 0, sel: null, view: { a: 0, b: 1 }, audio: null, stopAt: null, files: [] };

  function say(t) { if (el("sfxMsg")) el("sfxMsg").textContent = t || "—"; }
  function api(url, body) {
    return fetch(url, body === undefined ? undefined
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function color(v, d) {
    try { var c = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return c || d; } catch (e) { return d; }
  }

  // ---- the list
  function load(prefer) {
    return api("/api/sfx").then(function (j) {
      S.files = (j && j.files) || [];
      var sel = el("sfxSel"), keep = prefer || sel.value;
      sel.innerHTML = S.files.length
        ? S.files.map(function (f) { return '<option value="' + esc(f.name) + '">' + esc(f.name) + "</option>"; }).join("")
        : '<option value="">(no sound effects yet - 📂 Add)</option>';
      if (keep && S.files.some(function (f) { return f.name === keep; })) sel.value = keep;
      return open(sel.value);
    }).catch(function () { say("could not read the sound effects"); });
  }

  function open(name) {
    stop();
    S.name = name || ""; S.peaks = null; S.secs = 0; S.sel = null; S.view = { a: 0, b: 1 };
    selShow(); draw();
    var f = S.files.filter(function (x) { return x.name === S.name; })[0];
    if (el("sfxUndo")) el("sfxUndo").disabled = !(f && f.undo);
    ["sfxPlay", "sfxKeep", "sfxCut", "sfxToSound", "sfxDel"].forEach(function (id) { if (el(id)) el(id).disabled = !S.name; });
    if (!S.name) { say(S.files.length ? "—" : "📂 Add a video (.mov .mp4 ...) or an audio file - a video's audio is extracted"); return Promise.resolve(); }
    var want = S.name;
    return api("/api/sfx/peaks/" + encodeURIComponent(want)).then(function (j) {
      if (want !== S.name) return;
      if (j.error) { say("⚠ " + j.error); return; }
      S.peaks = j.peaks || []; S.secs = +j.seconds || 0;
      selShow(); draw();
      say(S.name + " - " + r2(S.secs) + " s - drag across the waveform to select a part");
    });
  }

  // ---- the view (zoom) and the selection, in seconds
  function xToT(x, w) { var v = S.view; return (v.a + (x / w) * (v.b - v.a)) * S.secs; }
  function tToX(t, w) { var v = S.view; return ((t / (S.secs || 1)) - v.a) / (v.b - v.a) * w; }
  function selShow() {
    var a = el("sfxStart"), b = el("sfxEnd");
    if (S.sel) { a.value = r2(S.sel.a); b.value = r2(S.sel.b); }
    else { a.value = ""; b.value = ""; }
    el("sfxLen").textContent = S.sel ? "selected " + r2(S.sel.b - S.sel.a) + " s of " + r2(S.secs) + " s"
      : (S.secs ? r2(S.secs) + " s - nothing selected" : "");
    ["sfxKeep", "sfxCut"].forEach(function (id) { if (el(id)) el(id).disabled = !(S.name && S.sel); });
  }

  function draw() {
    var cv = el("sfxWave"); if (!cv) return;
    var cssW = cv.clientWidth || 300, cssH = cv.clientHeight || 64, dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(cssW * dpr)) cv.width = Math.round(cssW * dpr);
    if (cv.height !== Math.round(cssH * dpr)) cv.height = Math.round(cssH * dpr);
    var ctx = cv.getContext && cv.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!S.peaks || !S.peaks.length) return;
    var n = S.peaks.length, mid = cv.height / 2, base = color("--line", "#666"), hot = color("--tiger", "#e8842c");
    for (var x = 0; x < cv.width; x++) {
      var f = S.view.a + (x / cv.width) * (S.view.b - S.view.a);
      var pk = S.peaks[Math.max(0, Math.min(n - 1, Math.floor(f * n)))] / 255;
      var h = Math.max(1, pk * (cv.height - 2));
      ctx.fillStyle = base; ctx.fillRect(x, mid - h / 2, 1, h);
    }
    if (S.sel) {
      var xa = tToX(S.sel.a, cv.width), xb = tToX(S.sel.b, cv.width);
      ctx.globalAlpha = 0.28; ctx.fillStyle = hot;
      ctx.fillRect(Math.floor(xa), 0, Math.max(1, Math.ceil(xb - xa)), cv.height);
      ctx.globalAlpha = 1; ctx.fillRect(Math.round(xa), 0, Math.max(1, dpr), cv.height); ctx.fillRect(Math.round(xb), 0, Math.max(1, dpr), cv.height);
    }
    if (S.audio && S.secs) {
      var px = tToX(S.audio.currentTime || 0, cv.width);
      ctx.fillStyle = color("--fg", "#eee"); ctx.fillRect(Math.round(px), 0, Math.max(1, dpr), cv.height);
    }
  }

  /* 2.361.0 (Tim: "allow user to choose duration and drag selection box of specified duration"): the
     Duration field. Set = the selection is a BOX of exactly that length - a press drops it centred on the
     pointer and a drag slides it; blank = a free drag-select. In both, pressing INSIDE the selection and
     dragging slides it (its length kept); a press that does not move is still a seek. */
  function fixedDur() {
    var d = parseFloat(el("sfxDur") && el("sfxDur").value);
    return Number.isFinite(d) && d >= 0.05 ? d : 0;
  }
  function boxAt(a, len) {                         // a box of `len` s starting at a, kept inside the sound
    len = Math.min(len, S.secs);
    a = Math.max(0, Math.min(S.secs - len, a));
    return { a: a, b: a + len };
  }
  // drag = select (or slide the box), a click = seek
  var drag = null;
  function local(ev) { var r = el("sfxWave").getBoundingClientRect(); return { x: Math.max(0, Math.min(r.width, ev.clientX - r.left)), w: r.width || 1 }; }
  function inSel(t) { return !!(S.sel && t >= S.sel.a && t <= S.sel.b); }
  el("sfxWave").addEventListener("pointerdown", function (ev) {
    if (!S.secs) return;
    var p = local(ev), t = xToT(p.x, p.w), D = fixedDur();
    drag = { t0: t, x0: p.x, moved: false, mode: "select" };
    if (inSel(t)) drag = { t0: t, x0: p.x, moved: false, mode: "slide", off: t - S.sel.a, len: S.sel.b - S.sel.a };
    else if (D) {                                  // drop the box here, then it follows the pointer
      S.sel = boxAt(t - D / 2, D);
      drag = { t0: t, x0: p.x, moved: true, mode: "slide", off: t - S.sel.a, len: S.sel.b - S.sel.a, dropped: true };
      selShow(); draw();
    }
    try { el("sfxWave").setPointerCapture(ev.pointerId); } catch (e) {}
  });
  el("sfxWave").addEventListener("pointermove", function (ev) {
    var p = local(ev), t = xToT(p.x, p.w);
    if (!drag) { el("sfxWave").style.cursor = inSel(t) ? "grab" : "crosshair"; return; }
    if (Math.abs(p.x - drag.x0) < 3 && !drag.moved) return;
    drag.moved = true;
    if (drag.mode === "slide") S.sel = boxAt(t - drag.off, drag.len);
    else S.sel = { a: Math.max(0, Math.min(drag.t0, t)), b: Math.min(S.secs, Math.max(drag.t0, t)) };
    el("sfxWave").style.cursor = drag.mode === "slide" ? "grabbing" : "crosshair";
    selShow(); draw();
  });
  function up(ev) {
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.moved || (d.mode === "slide" && !d.dropped && Math.abs(local(ev).x - d.x0) < 3)) {   // a click: seek (and clear a selection the click is outside of)
      if (S.sel && (d.t0 < S.sel.a || d.t0 > S.sel.b)) { S.sel = null; selShow(); }
      if (S.audio) S.audio.currentTime = d.t0;
      draw(); return;
    }
    if (S.sel && S.sel.b - S.sel.a < 0.01) { S.sel = null; selShow(); }
    draw();
    try { el("sfxWave").releasePointerCapture(ev.pointerId); } catch (e) {}
  }
  el("sfxWave").addEventListener("pointerup", up);
  el("sfxWave").addEventListener("pointercancel", up);

  function typed(ev) {
    var a = parseFloat(el("sfxStart").value), b = parseFloat(el("sfxEnd").value), D = fixedDur();
    // a fixed Duration: the edited edge moves the whole box
    if (D && S.secs) {
      var which = ev && ev.target === el("sfxEnd") ? "end" : "start";
      if (which === "start" && Number.isFinite(a)) S.sel = boxAt(a, D);
      else if (which === "end" && Number.isFinite(b)) S.sel = boxAt(b - D, D);
      selShow(); draw(); return;
    }
    if (!Number.isFinite(a) || !Number.isFinite(b) || !S.secs) return;
    a = Math.max(0, Math.min(S.secs, a)); b = Math.max(0, Math.min(S.secs, b));
    S.sel = b - a >= 0.01 ? { a: Math.min(a, b), b: Math.max(a, b) } : null;
    selShow(); draw();
  }
  el("sfxStart").addEventListener("change", typed);
  el("sfxEnd").addEventListener("change", typed);
  // a new Duration resizes the selection from its start (or drops a box at the left of the view)
  function durChanged() {
    var D = fixedDur();
    try { localStorage.setItem("sfx.dur", el("sfxDur").value || ""); } catch (e) {}
    if (!D || !S.secs) { selShow(); return; }
    if (D > S.secs) say("the duration is longer than " + S.name + " (" + r2(S.secs) + " s) - the box covers all of it");
    S.sel = boxAt(S.sel ? S.sel.a : S.view.a * S.secs, D);
    selShow(); draw();
  }
  el("sfxDur").addEventListener("change", durChanged);
  try { var dv = localStorage.getItem("sfx.dur"); if (dv) el("sfxDur").value = dv; } catch (e) {}

  function zoom(k) {
    var v = S.view, c = S.sel && S.secs ? ((S.sel.a + S.sel.b) / 2) / S.secs : (v.a + v.b) / 2;
    var span = Math.max(0.002, Math.min(1, (v.b - v.a) * k));
    var a = Math.max(0, Math.min(1 - span, c - span / 2));
    S.view = { a: a, b: a + span }; draw();
  }
  el("sfxZoomIn").onclick = function () { zoom(0.5); };
  el("sfxZoomOut").onclick = function () { zoom(2); };
  el("sfxZoomReset").onclick = function () { S.view = { a: 0, b: 1 }; draw(); };

  // ---- play
  function tickPlay() {
    if (!S.audio) return;
    if (S.stopAt != null && S.audio.currentTime >= S.stopAt) { stop(); return; }
    draw(); setTimeout(tickPlay, 30);
  }
  function stop() {
    if (S.audio) { try { S.audio.pause(); } catch (e) {} }
    S.audio = null; S.stopAt = null;
    if (el("sfxPlay")) el("sfxPlay").textContent = "▶";
    draw();
  }
  el("sfxPlay").onclick = function () {
    if (!S.name) return;
    if (S.audio) { stop(); return; }
    var a = new Audio("/api/sfx/file/" + encodeURIComponent(S.name) + "?t=" + Date.now());
    S.audio = a; S.stopAt = S.sel ? S.sel.b : null;
    a.currentTime = S.sel ? S.sel.a : 0;
    a.addEventListener("ended", stop);
    el("sfxPlay").textContent = "⏹";
    var p = a.play();
    if (p && p.catch) p.catch(function (e) { say("could not play: " + e.message); stop(); });
    tickPlay();
  };

  // ---- the cuts
  function cut(mode) {
    if (!S.name || !S.sel) { say("drag across the waveform to select a part first"); return Promise.resolve(); }
    stop();
    var asNew = !!el("sfxAsNew").checked;
    say((mode === "keep" ? "keeping " : "deleting ") + r2(S.sel.a) + "-" + r2(S.sel.b) + " s…");
    return api("/api/sfx/trim", { name: S.name, start: S.sel.a, end: S.sel.b, mode: mode, as_new: asNew })
      .then(function (j) {
        if (j.error) { say("⚠ " + j.error); return; }
        if (j.gallery) showInGallery();
        return load(j.name).then(function () { say(j.note); });
      });
  }
  /* 2.361.0 (Tim: "add saved file to the sound tab in gallery docker"): every cut is copied into the gallery
     (output/sfx_<name>) by the server - show the gallery's Audio tab with it */
  function showInGallery() {
    var ab = document.querySelector('.gtabs button[data-gtab="audio"]');
    if (ab && !ab.classList.contains("active") && typeof ab.onclick === "function") { try { ab.onclick(); } catch (e) {} return; }
    if (typeof window.refreshGallery === "function") { try { window.refreshGallery(); } catch (e) {} }
  }
  el("sfxKeep").onclick = function () { cut("keep"); };
  el("sfxCut").onclick = function () { cut("delete"); };
  el("sfxUndo").onclick = function () {
    if (!S.name) return;
    api("/api/sfx/undo", { name: S.name }).then(function (j) {
      if (j.error) { say("⚠ " + j.error); return; }
      if (j.gallery) showInGallery();
      load(j.name).then(function () { say(j.note); });
    });
  };
  el("sfxToSound").onclick = function () {
    if (!S.name) return;
    api("/api/sfx/to-sound", { name: S.name }).then(function (j) {
      say(j.error ? "⚠ " + j.error : j.note);
      if (!j.error && typeof window.refreshAssets === "function") { try { window.refreshAssets(); } catch (e) {} }
    });
  };
  el("sfxDel").onclick = function () {
    if (!S.name) return;
    var name = S.name;
    var ask = window.appConfirm ? window.appConfirm("Delete the sound effect " + name + "?") : Promise.resolve(window.confirm("Delete the sound effect " + name + "?"));
    Promise.resolve(ask).then(function (yes) {
      if (!yes) return;
      stop();
      api("/api/sfx/delete", { name: name }).then(function (j) {
        if (j.error) { say("⚠ " + j.error); return; }
        load().then(function () { say(j.note); });
      });
    });
  };

  // ---- add
  el("sfxAdd").onclick = function () { var i = el("sfxFile"); i.value = ""; i.click(); };
  el("sfxFile").onchange = function () {
    var files = Array.prototype.slice.call(this.files || []);
    if (!files.length) return;
    var fd = new FormData();
    files.forEach(function (f) { fd.append("files", f, f.name); });
    say("adding " + files.map(function (f) { return f.name; }).join(", ") + "…");
    fetch("/api/sfx/add", { method: "POST", body: fd })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var last = (j.added || []).length ? j.added[j.added.length - 1].name : "";
        return load(last).then(function () { say(j.note || j.error || "—"); });
      }).catch(function (e) { say("⚠ could not add: " + e.message); });
  };

  el("sfxSel").addEventListener("change", function () { open(this.value); });
  el("sfxRefresh").onclick = function () { load(); };
  var lastScan = 0;
  el("sfxSel").addEventListener("mouseenter", function () {   // a project switch shows on the next look
    if (Date.now() - lastScan < 2000) return; lastScan = Date.now(); load();
  });
  if (window.ResizeObserver) { try { new ResizeObserver(draw).observe(el("sfxWave")); } catch (e) {} }

  // test / diagnostic handle - the state, never a second store
  window.sfxDock = { state: function () { return S; }, load: load, open: open, cut: cut, draw: draw, fixedDur: fixedDur };
  load();
})();
