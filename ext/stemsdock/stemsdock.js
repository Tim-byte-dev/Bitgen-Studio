// bitGen Studio — the STEMS dock (2.269.0). Demucs vocal/instrumental
// separation: pick a song from the project's sound assets, ✂🎤, and the
// pair lands back among the sound assets. ⚙ Install builds venvs/demucs
// through the same install-job machinery as whisper and OmniVoice.
(function () {
  "use strict";
  var el = function (id) { return document.getElementById(id); };
  if (!el("stemsdock")) return;

  function say(t) { if (el("stMsg")) el("stMsg").textContent = t || "—"; }

  var AUDIO_RE = /\.(wav|mp3|flac|ogg|m4a|opus)$/i;   // 2.272.0: + opus (core's PKINDS list)
  function loadSongs(prefer) {
    // 2.272.0: `prefer` (a just-uploaded name) wins the selection over the
    // previous pick — passed by the 📂 upload so ✂🎤 is one press away
    /* 2.298.0 (Tim: "scan the projects subfolders for images and music and
       videos before adding it to a dropdown"): every song in the project,
       grouped by folder (window.bgMedia); one outside the sound assets is
       adopted into them when picked (onSongChange) */
    if (window.bgMedia) {
      return window.bgMedia.load("sound").then(function (list) {
        var sel = el("stSong"); if (!sel) return;
        var keep = prefer || sel.value;
        list = list.filter(function (x) { return AUDIO_RE.test(x.name); });
        window.bgMedia.fill(sel, list, { keep: keep, keepMissing: false });
        if (!list.length) say("no songs yet — add one in the Music dock or drop a file on the gallery");
        SOUNDS = list.filter(function (x) { return x.asset; }).map(function (x) { return x.name; });
        stWavesRefresh();
      }).catch(function () { say("could not scan the project's songs"); });
    }
    return fetch("/api/passets").then(function (r) { return r.json(); })
      .then(function (j) {
        var sel = el("stSong"); if (!sel) return;
        var keep = prefer || sel.value;
        var songs = (j.sound || []).map(function (a) { return a.name; })
          .filter(function (n) { return AUDIO_RE.test(n); });
        sel.innerHTML = songs.map(function (n) {
          return '<option value="' + n.replace(/"/g, "&quot;") + '">' + n + "</option>";
        }).join("");
        if (keep && songs.indexOf(keep) >= 0) sel.value = keep;
        if (!songs.length) say("no songs yet — add one in the Music dock or drop a file on the gallery");
        SOUNDS = songs;              // 2.273.0: the waveform rows read this
        stWavesRefresh();
      }).catch(function () { say("could not read the project's sound assets"); });
  }

  function status() {
    fetch("/api/stems").then(function (r) { return r.json(); })
      .then(function (j) {
        say(j.installed
          ? "demucs ready (" + (j.model || "htdemucs") + " on " + (j.device || "auto") + ")"
          : "demucs is not installed — press ⚙ Install (its own venv, ~2 GB with torch)");
        // 2.274.0 (by instruction): an installed demucs needs no Install
        // button — hide it; it comes back if the venv ever disappears.
        // ⟳ re-checks, so pressing it after the install job finishes
        // makes the button leave. A failed status fetch changes nothing.
        if (el("stInstall"))
          el("stInstall").classList.toggle("hidden", !!j.installed);
      }).catch(function () {});
  }

  if (el("stRefresh")) el("stRefresh").onclick = function () { loadSongs(); status(); };

  // 2.272.0 (Tim: "add a folder select button after the song dropdown in
  // stems, allow user to upload songs from anywhere"): 📂 opens the picker,
  // each file posts to /api/stems/upload (the 512MB route — a song outgrows
  // the general asset limit), and the dropdown re-reads and SELECTS the
  // last upload so ✂🎤 is one press away. Uploads run one after another so
  // the status line tells the truth about which file is in flight.
  function stUploadOne(f) {
    var fd = new FormData();
    fd.append("file", f, f.name);
    return fetch("/api/stems/upload", { method: "POST", body: fd })
      .then(function (r) { return r.json().then(function (j) {
        if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      }); });
  }

  function stUploadAll(files) {
    var list = [];
    for (var i = 0; i < files.length; i++) list.push(files[i]);
    if (!list.length) return;
    var done = [], chain = Promise.resolve();
    list.forEach(function (f, i) {
      chain = chain.then(function () {
        say("uploading " + f.name + " (" + (i + 1) + "/" + list.length + ")…");
        return stUploadOne(f).then(function (j) { done.push(j.name); });
      });
    });
    chain.then(function () {
      say(done.length + " song(s) added" + (done.length ? " — " + done[done.length - 1] + " selected" : ""));
      loadSongs(done[done.length - 1]);
    }).catch(function (e) {
      say("upload failed: " + e.message
        + (done.length ? " (" + done.length + " earlier file(s) made it)" : ""));
      loadSongs();
    });
  }

  /* ---- 2.273.0 (Tim: "add 3 waveforms, 1 for full song, 1 for vocals and
     1 for instruments, add a play button next to each one"): three rows —
     the selected song and its two demucs stems. Peaks from /api/waveform
     (the timeline's own extractor + cache; ~1.2 KB per file), audio from
     /passets/sound/. A row hides while its file does not exist; playing
     one row pauses the others; click seeks. The 2.253 lesson holds — the
     drawing measures ITS OWN width per paint and re-measures on dock
     resize, assuming nothing about the core's CSS. ---- */
  var SOUNDS = [];
  var WAVES = {
    song: { row: "stRowSong", btn: "stPlaySong", cv: "stWaveSong", sv: "stSaveSong", segId: "stSegSong" },
    voc:  { row: "stRowVoc",  btn: "stPlayVoc",  cv: "stWaveVoc",  sv: "stSaveVoc",  segId: "stSegVoc" },
    inst: { row: "stRowInst", btn: "stPlayInst", cv: "stWaveInst", sv: "stSaveInst", segId: "stSegInst" }
  };

  function stemBase(name) { return String(name || "").replace(/\.[^.]+$/, ""); }
  function waveFiles() {
    var song = el("stSong") ? el("stSong").value : "";
    if (!song) return { song: "", voc: "", inst: "" };
    var b = stemBase(song);
    return { song: song, voc: b + "_vocals.wav", inst: b + "_instrumental.wav" };
  }

  function waveColor(varName, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(varName);
      return (v && v.trim()) || fallback;
    } catch (e) { return fallback; }
  }

  /* ---- 2.285.0 (Tim: "add a button to all the waveforms to segment the
     song, add red lines to show the segments in all waveforms allow user
     to drag the lines ... the red lines in all 3 will move together.
     show the duration of each segment above the waveform ... save a
     text file as songname.seg"): ONE segment map, drawn on every
     canvas, dragged from any of them. Boundaries are seconds into the
     song; the three canvases share the song's time axis, so one state
     moves all three. Saves are debounced to <base>.seg via the api. */
  var SEGS = null;                 // { total, durations, boundaries, manual } | null
  /* ---- 2.286.0 (Tim: "allow user to zoom in/zoom out and reset view of
     the waveforms"): ONE view window {t0,t1} in SONG FRACTIONS [0..1],
     shared by all three canvases. Everything drawn - peaks, playhead,
     selection, red lines, labels - maps through it. Zoom steps x2
     around the view centre; the wheel pans when zoomed; reset restores
     the whole song. ---- */
  var VIEW = { t0: 0, t1: 1 };
  function vSpan() { return Math.max(1e-6, VIEW.t1 - VIEW.t0); }
  function fToView(f) { return (f - VIEW.t0) / vSpan(); }     // song->canvas
  function vToF(x) { return VIEW.t0 + x * vSpan(); }          // canvas->song
  function viewZoom(factor) {
    var c = (VIEW.t0 + VIEW.t1) / 2, half = vSpan() / 2 * factor;
    half = Math.min(0.5, Math.max(0.005, half));
    VIEW.t0 = Math.max(0, c - half); VIEW.t1 = Math.min(1, c + half);
    if (VIEW.t1 - VIEW.t0 < half * 2)                        // hit an edge
      (VIEW.t0 === 0) ? VIEW.t1 = Math.min(1, VIEW.t0 + half * 2)
                      : VIEW.t0 = Math.max(0, VIEW.t1 - half * 2);
    redrawAll();
  }
  function viewReset() { VIEW.t0 = 0; VIEW.t1 = 1; redrawAll(); }
  function viewPan(df) {
    var span = vSpan();
    VIEW.t0 = Math.max(0, Math.min(1 - span, VIEW.t0 + df));
    VIEW.t1 = VIEW.t0 + span;
    redrawAll();
  }
  var segSaveT = null;
  function segLoad(force) {
    var f = waveFiles(); if (!f.song) { SEGS = null; return; }
    fetch("/api/stems/segments?song=" + encodeURIComponent(f.song))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok && j.total > 0) {
          if (force || j.file || SEGS) { SEGS = j; redrawAll(); }
        }
      }).catch(function () {});
  }
  function segSave() {
    if (!SEGS) return;
    clearTimeout(segSaveT);
    segSaveT = setTimeout(function () {
      var f = waveFiles(); if (!f.song) return;
      fetch("/api/stems/segments", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song: f.song, durations: SEGS.durations,
                              manual: SEGS.manual || [] }) })
        .catch(function () {});
    }, 400);
  }
  function segRecalc() {           // boundaries -> durations, in place
    if (!SEGS) return;
    var ds = [], prev = 0;
    for (var i = 0; i < SEGS.boundaries.length; i++) {
      ds.push(SEGS.boundaries[i] - prev); prev = SEGS.boundaries[i];
    }
    ds.push(SEGS.total - prev);
    SEGS.durations = ds;
  }
  function redrawAll() {
    for (var k in WAVES) drawWave(WAVES[k]);
  }
  /* 2.286.0 (Tim: "if user clicks on the duration label, show an input
     box for duration, let the user set it manually, adjust the red lines
     to match"): the typed value LOCKS the segment ([manual] in the .seg).
     The segments after it slide over by the difference and the LAST open
     segment absorbs it (the song's total is fixed); setting the final
     segment leans on the one before it instead. Locked neighbours are
     never robbed - the change clamps against them in words. */
  function setManualDuration(i, v) {
    if (!SEGS || !(v > 0)) return;
    /* 2.289.0: the rule lives in core static/segmap.js - ONE copy, shared
       with the video docker's song strip. The 2.286 copy that lived here
       slid every later cut by the difference, so the last segment alone
       paid: a big enough value drove it NEGATIVE and a locked last
       segment was robbed. The core absorbs segment by segment (the last
       open one first, 1 s floors, locks never touched). */
    if (!SEGS.manual) SEGS.manual = [];
    var r = window.SegMap ? window.SegMap.setManual(SEGS, i, v)
      : { ok: false, note: "the segment editor (static/segmap.js) did not load" };
    if (r.note) say(r.note);
    if (r.ok) { segSave(); redrawAll(); }
  }
  /* 2.287.0: ⬇ exports the segments as real files (mp3|wav from the
     picker); 📤 exports too, then stages one BLANK scene per segment on
     the board (length pinned, segment bound as its soundtrack) for
     "create the music video" to fill. */
  (function wireSegExport() {
    var fmtEl = el("stSegFmt");
    function fmt() { return (fmtEl && fmtEl.value) === "wav" ? "wav" : "mp3"; }
    var ex = el("stSegExport");
    if (ex) ex.onclick = function () {
      var f = waveFiles(); if (!f.song) { say("pick a song first"); return; }
      say("cutting segments\u2026");
      fetch("/api/stems/export", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song: f.song, format: fmt() }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok) { say((j && j.error) || "export failed"); return; }
          say(j.files.length + " segment file(s) saved as ." + j.format
            + " under songs/" + j.base + "/segments/");
        }).catch(function () { say("export failed"); });
    };
    var sd = el("stSegSend");
    if (sd) sd.onclick = function () {
      var f = waveFiles(); if (!f.song) { say("pick a song first"); return; }
      say("sending segments to video\u2026");
      fetch("/api/stems/send-to-video", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song: f.song, format: fmt() }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok) { say((j && j.error) || "send failed"); return; }
          say(j.note || (j.scenes + " blank scene(s) on the board"));
        }).catch(function () { say("send failed"); });
    };
  })();
  (function wireZoom() {
    var zi = el("stZoomIn"), zo = el("stZoomOut"), zr = el("stZoomReset");
    if (zi) zi.onclick = function () { viewZoom(0.5); };
    if (zo) zo.onclick = function () { viewZoom(2); };
    if (zr) zr.onclick = function () { viewReset(); };
  })();
  var segInp = null;
  function segInputOpen(i, ev) {
    if (segInp) { try { segInp.remove(); } catch (e2) {} segInp = null; }
    var box = document.createElement("input");
    box.type = "number"; box.min = "1"; box.step = "0.1";
    box.value = Math.round(SEGS.durations[i] * 10) / 10;
    box.title = "Segment " + (i + 1) + " duration in seconds - Enter locks it";
    box.style.cssText = "position:fixed;z-index:9999;width:64px;"
      + "left:" + Math.round(ev.clientX - 32) + "px;"
      + "top:" + Math.round(ev.clientY + 8) + "px;";
    document.body.appendChild(box); segInp = box;
    box.focus(); box.select();
    var done = function (apply) {
      if (!segInp) return;
      var v = parseFloat(box.value);
      try { box.remove(); } catch (e3) {}
      segInp = null;
      if (apply && v > 0) setManualDuration(i, v);
    };
    box.addEventListener("keydown", function (k) {
      if (k.key === "Enter") done(true);
      if (k.key === "Escape") done(false);
    });
    box.addEventListener("blur", function () { done(true); });
    box.addEventListener("pointerdown", function (k) { k.stopPropagation(); });
  }
  function drawWave(w) {
    var cv = el(w.cvId); if (!cv || !w.peaks) return;
    var cssW = cv.clientWidth || 200, cssH = cv.clientHeight || 36;
    var dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(cssW * dpr)) cv.width = Math.round(cssW * dpr);
    if (cv.height !== Math.round(cssH * dpr)) cv.height = Math.round(cssH * dpr);
    var ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    var n = w.peaks.length, mid = cv.height / 2;
    var frac = (w.audio && w.audio.duration)
      ? (w.audio.currentTime / w.audio.duration) : 0;
    var base = waveColor("--line", "#555");
    var hot = waveColor("--tiger", "#e8842c");
    for (var x = 0; x < cv.width; x++) {
      var sf = vToF(x / cv.width);                    // 2.286.0: view mapping
      var pk = w.peaks[Math.max(0, Math.min(n - 1, Math.floor(sf * n)))] / 255;
      var h = Math.max(1, pk * (cv.height - 2));
      ctx.fillStyle = sf <= frac ? hot : base;
      ctx.fillRect(x, mid - h / 2, 1, h);
    }
    // 2.276.0: the SELECTED region rides on top, translucent tiger — the
    // part 💾 will re-volume
    if (w.sel && w.sel.b > w.sel.a) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = hot;
      var sa = fToView(w.sel.a), sb = fToView(w.sel.b);
      ctx.fillRect(Math.floor(sa * cv.width), 0,
        Math.max(1, Math.ceil((sb - sa) * cv.width)), cv.height);
      ctx.globalAlpha = 1;
    }
    /* 2.285.0: the segment map rides on TOP - red boundary lines and the
       duration of each segment centered above the wave. */
    if (SEGS && SEGS.total > 0) {
      var red = waveColor("--bad", "#e33");
      ctx.save();
      ctx.fillStyle = red;
      for (var bi = 0; bi < SEGS.boundaries.length; bi++) {
        var bx = Math.round(fToView(SEGS.boundaries[bi] / SEGS.total) * cv.width);
        if (bx < -2 || bx > cv.width + 2) continue;
        ctx.fillRect(bx - Math.max(1, dpr), 0, Math.max(2, 2 * dpr), cv.height);
      }
      ctx.font = Math.round(9 * dpr) + "px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      var prevT = 0;
      for (var si = 0; si < SEGS.durations.length; si++) {
        var endT = prevT + SEGS.durations[si];
        var cx = fToView((prevT + endT) / 2 / SEGS.total) * cv.width;
        if (cx >= -20 && cx <= cv.width + 20)
          // 2.286.0: a manual duration wears its lock
          ctx.fillText((SEGS.manual && SEGS.manual[si] ? "\uD83D\uDD12" : "")
            + (Math.round(SEGS.durations[si] * 10) / 10) + "s", cx, 1 * dpr);
        prevT = endT;
      }
      ctx.restore();
    }
  }

  /* ---- 2.277.0 (Tim: "when i click a selected area show a volume slider
     above the selected area, apply the new volume instantly, add an x
     button to the volume slider, close the volume slider if user clicks
     away from volume slider, remove the volume dropdowns"): ONE floating
     popover for all rows — a range 0–200%, a live % label, ✕. Every
     slider CHANGE applies at once through /api/stems/volume; the FIRST
     apply of a selection sends rebase:true (the server snapshots the file
     to .volbase) and later changes send rebase:false, so the slider's
     value is ABSOLUTE for the region, never compounding. Clicking
     anywhere outside the popover closes it. ---- */
  var POP = null, popW = null, popNeedsRebase = true;

  function popBuild() {
    if (POP) return POP;
    POP = document.createElement("div");
    POP.id = "stVolPop";
    POP.className = "hidden";
    POP.style.cssText = "position:absolute;z-index:40;display:flex;gap:6px;"
      + "align-items:center;padding:4px 6px;border:1px solid var(--line,#444);"
      + "border-radius:8px;background:var(--panel,#1c1f26);"
      + "box-shadow:0 4px 14px rgba(0,0,0,.5)";
    var rng = document.createElement("input");
    rng.type = "range"; rng.id = "stVolRange";
    rng.min = "0"; rng.max = "200"; rng.step = "5"; rng.value = "100";
    rng.style.width = "140px";
    rng.title = "Volume % for the selected region — 0 flattens it; applies and saves the moment you release";
    var lab = document.createElement("span");
    lab.id = "stVolLab"; lab.textContent = "100%";
    lab.style.cssText = "font-size:11px;min-width:34px;text-align:right";
    var x = document.createElement("button");
    x.id = "stVolX"; x.className = "ghost gbtn"; x.type = "button";
    x.textContent = "✕"; x.title = "Close the volume slider";
    POP.appendChild(rng); POP.appendChild(lab); POP.appendChild(x);
    document.body.appendChild(POP);
    rng.addEventListener("input", function () { lab.textContent = rng.value + "%"; });
    rng.addEventListener("change", function () { popApply(parseInt(rng.value, 10)); });
    x.addEventListener("click", function (ev) { ev.stopPropagation(); popClose(); });
    // 2.277.0: clicking AWAY closes — a pointerdown anywhere outside the
    // popover itself (the ✕ path above never reaches here)
    document.addEventListener("pointerdown", function (ev) {
      if (!POP || POP.classList.contains("hidden")) return;
      if (POP.contains(ev.target)) return;
      popClose();
    });
    return POP;
  }

  function popOpenFor(w) {
    if (!w.sel || !(w.sel.b > w.sel.a)) {
      say("drag across the " + (w.file || "waveform") + " waveform first to select the region");
      return;
    }
    var cv = el(w.cvId || w.cv); if (!cv) return;
    var r = cv.getBoundingClientRect();
    popBuild();
    popW = w; popNeedsRebase = true;
    var rng = document.getElementById("stVolRange");
    var lab = document.getElementById("stVolLab");
    if (rng) rng.value = "100";
    if (lab) lab.textContent = "100%";
    POP.classList.remove("hidden");
    var midX = r.left + ((w.sel.a + w.sel.b) / 2) * r.width + window.scrollX;
    var popRect = POP.getBoundingClientRect();
    POP.style.left = Math.max(4, midX - popRect.width / 2) + "px";
    POP.style.top = Math.max(4, r.top + window.scrollY - popRect.height - 6) + "px";
  }

  function popClose() {
    if (POP) POP.classList.add("hidden");
    popW = null;
  }

  function popApply(pct) {
    var w = popW;
    if (!w || !w.file || !w.sel) return;
    if (!(pct >= 0 && pct <= 200)) { say("volume must be 0–200%"); return; }
    var rebase = popNeedsRebase;
    say("applying " + pct + "% to " + w.file + "…");
    // release OUR handle before the server renames over the file — the
    // 2.277 Windows EPERM fix's client half
    if (w.audio) { try { w.audio.pause(); w.audio.src = ""; w.audio.load(); } catch (e) {}
                   w.audio = null; }
    var b2 = el(w.btn); if (b2) b2.textContent = "▶";
    fetch("/api/stems/volume", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: w.file, from: w.sel.a, to: w.sel.b,
                             gain: pct / 100, rebase: rebase }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error) { say(j.error); return; }
        popNeedsRebase = false;          // later changes edit from the base
        say("saved " + j.name + " — " + j.from + "s–" + j.to + "s at " + pct
          + "% (adjust again or ✕; same name, every reference still points at it)");
        w.bust = Date.now();
        w.peaks = null;                  // fresh picture, selection kept
        SEGS = null; segLoad(false);      // 2.285.0: the .seg map follows the song
        loadRow(rowKeyOf(w), w.file);
      })
      .catch(function (e) { say("apply failed: " + e.message); });
  }

  function stopOthers(me) {
    for (var k in WAVES) {
      var w = WAVES[k];
      if (w !== me && w.audio && !w.audio.paused) w.audio.pause();
    }
  }

  function wireRow(key) {
    var w = WAVES[key];
    w.cvId = w.cv;
    var btn = el(w.btn), cv = el(w.cvId);
    if (!btn || !cv || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.onclick = function () {
      if (!w.file) return;
      if (!w.audio) {
        w.audio = new Audio("/passets/sound/" + encodeURIComponent(w.file)
          + (w.bust ? "?t=" + w.bust : ""));
        w.audio.addEventListener("timeupdate", function () { drawWave(w); });
        w.audio.addEventListener("play", function () {
          stopOthers(w); btn.textContent = "⏸";
        });
        w.audio.addEventListener("pause", function () {
          btn.textContent = "▶"; drawWave(w);
        });
        w.audio.addEventListener("ended", function () {
          btn.textContent = "▶"; w.audio.currentTime = 0; drawWave(w);
        });
      }
      if (w.audio.paused) w.audio.play().catch(function (e) {
        say("could not play " + w.file + ": " + e.message);
      });
      else w.audio.pause();
    };
    /* 2.276.0 (Tim: "add a selector for the waveform"): DRAG across the
       canvas selects a region (translucent overlay); a plain CLICK (under
       4px of travel) keeps the 2.273 seek. Fractions, so no decode is
       needed to select. */
    var drag = null;
    function fracAt(ev) {
      var r = cv.getBoundingClientRect();
      if (!r.width) return null;
      return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    }
    function segHit(f) {           // which boundary line is under the pointer
      if (!SEGS || !SEGS.total) return -1;
      var r = cv.getBoundingClientRect(); if (!r.width) return -1;
      var tol = (6 / r.width) * vSpan();           // ~6 css px, in song frac
      var sf = vToF(f);
      for (var i = 0; i < SEGS.boundaries.length; i++)
        if (Math.abs(sf - SEGS.boundaries[i] / SEGS.total) <= tol) return i;
      return -1;
    }
    function segAt(sf) {           // which SEGMENT the song-fraction is in
      if (!SEGS || !SEGS.total) return -1;
      var t = sf * SEGS.total, acc = 0;
      for (var i = 0; i < SEGS.durations.length; i++) {
        acc += SEGS.durations[i];
        if (t < acc) return i;
      }
      return SEGS.durations.length - 1;
    }
    function labelHit(ev, f) {     // the duration label strip (top ~14 css px)
      var r = cv.getBoundingClientRect();
      if (!r.height || (ev.clientY - r.top) > 14) return -1;
      return segAt(vToF(f));
    }
    cv.addEventListener("pointerdown", function (ev) {
      var f = fracAt(ev); if (f == null) return;
      var hit = segHit(f);
      var body = -1;
      if (hit < 0 && SEGS) {
        var si = segAt(vToF(f));
        // 2.286.0: only a MANUAL segment's body drags as a whole - every
        // other segment keeps the 2.276 region-select exactly as it was
        if (si >= 0 && SEGS.manual && SEGS.manual[si]) body = si;
      }
      drag = { x0: ev.clientX, f0: f, moved: false, seg: hit, body: body,
               sf0: vToF(f) };
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    cv.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      var f = fracAt(ev); if (f == null) return;
      if (Math.abs(ev.clientX - drag.x0) >= 4) drag.moved = true;
      if (drag.moved && drag.seg >= 0 && SEGS) {
        // dragging a RED LINE - clamp between its neighbours (>= 1s each
        // side) and every canvas redraws from the one shared map. A line
        // beside a MANUAL segment refuses to change that segment's
        // duration - the lock means the lock.
        if ((SEGS.manual && SEGS.manual[drag.seg])
            || (SEGS.manual && SEGS.manual[drag.seg + 1])) {
          say("that cut borders a locked segment - drag the locked segment's body to move it whole, or click its duration to change it");
          drag.seg = -2; return;
        }
        var lo = drag.seg > 0 ? SEGS.boundaries[drag.seg - 1] + 1 : 1;
        var hi = drag.seg < SEGS.boundaries.length - 1
          ? SEGS.boundaries[drag.seg + 1] - 1 : SEGS.total - 1;
        SEGS.boundaries[drag.seg] =
          Math.max(lo, Math.min(hi, vToF(f) * SEGS.total));
        segRecalc(); segSave(); redrawAll();
        return;
      }
      if (drag.moved && drag.body >= 0 && SEGS) {
        /* 2.286.0 (Tim: "if the user clicks and drags a segment that has
           been manually set then drag the entire segment maintaining the
           manual duration"): both its cuts translate together. The walls:
           a locked neighbour is immovable; an open neighbour compresses
           to one second and no further. */
        var i2 = drag.body, dt = (vToF(f) - drag.sf0) * SEGS.total;
        drag.sf0 = vToF(f);
        var st0 = i2 > 0 ? SEGS.boundaries[i2 - 1] : 0;
        var en0 = i2 < SEGS.boundaries.length ? SEGS.boundaries[i2] : SEGS.total;
        var minSt = 0, maxEn = SEGS.total;
        if (i2 > 0) minSt = (i2 > 1 ? SEGS.boundaries[i2 - 2] : 0)
          + ((SEGS.manual && SEGS.manual[i2 - 1]) ? SEGS.durations[i2 - 1] : 1);
        if (i2 < SEGS.durations.length - 1)
          maxEn = (i2 < SEGS.boundaries.length - 1
            ? SEGS.boundaries[i2 + 1] : SEGS.total)
            - ((SEGS.manual && SEGS.manual[i2 + 1]) ? SEGS.durations[i2 + 1] : 1);
        if (i2 === 0 || i2 === SEGS.durations.length - 1) {
          say("the first and last segments sit against the song's edges - change their duration by clicking the label");
          drag.body = -1; return;
        }
        dt = Math.max(minSt - st0, Math.min(maxEn - en0, dt));
        SEGS.boundaries[i2 - 1] = st0 + dt;
        SEGS.boundaries[i2] = en0 + dt;
        segRecalc(); segSave(); redrawAll();
        return;
      }
      if (drag.seg === -2) return;               // refused line - eat the drag
      if (drag.moved) {
        w.sel = { a: Math.min(drag.f0, f), b: Math.max(drag.f0, f) };
        popNeedsRebase = true;            // a new region = a new base session
        drawWave(w);
      }
    });
    cv.addEventListener("wheel", function (ev) {
      if (VIEW.t1 - VIEW.t0 >= 1) return;        // whole song - nothing to pan
      ev.preventDefault();
      var d = (ev.deltaY || ev.deltaX) * 0.0015 * vSpan();
      viewPan(d);
    }, { passive: false });
    cv.addEventListener("pointerup", function (ev) {
      if (!drag) return;
      var f = fracAt(ev), wasDrag = drag.moved,
          wasSeg = drag.seg >= 0 || drag.body >= 0;
      var wasRefused = drag.seg === -2 || drag.body === -1;
      drag = null;
      if (wasDrag || wasRefused) { if (wasSeg) redrawAll(); else drawWave(w); return; }
      // 2.286.0: a CLICK on the duration label opens the manual input
      if (SEGS && f != null) {
        var li = labelHit(ev, f);
        if (li >= 0) { segInputOpen(li, ev); return; }
      }
      // 2.277.0: a click INSIDE the selection opens the volume slider
      // ABOVE it; a click outside keeps the 2.276 clear-and-seek
      if (w.sel && f != null && f >= w.sel.a && f <= w.sel.b) {
        popOpenFor(w);
        return;
      }
      w.sel = null;                       // a click clears the selection…
      if (w.audio && w.audio.duration && f != null)
        w.audio.currentTime = vToF(f) * w.audio.duration;   // …and seeks (view-mapped)
      drawWave(w);
    });
    /* 2.276.0 (Tim: "add a icon only save button at the end of the
       waveform to save the file"): 💾 posts the selection + the row's
       volume % to /api/stems/volume, which edits the file IN PLACE.
       On success the row reloads with a cache-buster (the browser holds
       peak JSON and audio for the old bytes otherwise) — the flattened
       wave is visible immediately, same name everywhere. */
    /* 2.277.0: 💾 is the slider's second door — it OPENS the popover for
       the current selection (no selection → said in words). The apply +
       save live on the slider's change now, never on this button. */
    var sv = el(w.sv);
    if (sv) sv.onclick = function (ev) {
      if (ev) ev.stopPropagation();      // never counts as a click-away
      popOpenFor(w);
    };
    /* 2.285.0: ✂# on any row builds (or reloads) the segment map for the
       SONG - the default 15-second grid the first time, the saved .seg
       after - and the red lines appear on all three waveforms. */
    var sg = el(w.segId);
    if (sg) sg.onclick = function (ev) {
      if (ev) ev.stopPropagation();
      var f = waveFiles();
      if (!f.song) { say("pick a song first"); return; }
      if (SEGS && SEGS.total > 0) {      // already editing - save + confirm
        segSave(); say("segments saved to " + stemBase(f.song) + ".seg");
        return;
      }
      fetch("/api/stems/segments?song=" + encodeURIComponent(f.song))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok || !(j.total > 0)) { say("could not read the song's duration"); return; }
          SEGS = j; redrawAll(); segSave();
          say(j.durations.length + " segments - drag a red line to move a cut; "
            + "durations save to " + stemBase(f.song) + ".seg");
        }).catch(function () { say("segment map failed to load"); });
    };
  }

  function rowKeyOf(w) {
    for (var k in WAVES) if (WAVES[k] === w) return k;
    return "song";
  }

  function loadRow(key, file) {
    var w = WAVES[key];
    var row = el(w.row);
    // a changed file resets the row's player and peaks
    if (w.file !== file) {
      if (w.audio) { try { w.audio.pause(); } catch (e) {} w.audio = null; }
      w.peaks = null;
      w.sel = null;
      w.bust = 0;
      var b = el(w.btn); if (b) b.textContent = "▶";
    }
    w.file = file;
    var exists = !!file && SOUNDS.indexOf(file) >= 0;
    if (row) row.classList.toggle("hidden", !exists);
    if (!exists) return;
    wireRow(key);
    if (w.peaks) { drawWave(w); return; }
    fetch("/api/waveform?src=sound&name=" + encodeURIComponent(file)
        + (w.bust ? "&t=" + w.bust : ""))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.peaks && w.file === file) { w.peaks = j.peaks; drawWave(w); }
      }).catch(function (e) { /* the row stays visible without a picture */ });
  }

  function stWavesRefresh() {
    var f = waveFiles();
    loadRow("song", f.song);
    loadRow("voc", f.voc);
    loadRow("inst", f.inst);
  }

  // 2.298.0: a song from another project folder becomes an asset first
  function onSongChange() {
    var v = el("stSong").value;
    if (/^rel:/.test(v) && window.bgMedia) {
      say("adding " + v.slice(4) + " to the sound assets…");
      window.bgMedia.resolve(v).then(function (name) {
        say(name + " is in the sound assets");
        return loadSongs(name);
      }).catch(function (e) { say("⚠ " + (e.message || e)); });
      return;
    }
    stWavesRefresh();
  }
  if (el("stSong")) {
    el("stSong").addEventListener("change", onSongChange);
    // the scan runs as the pointer arrives at the dropdown (before its list
    // opens), not only when the dock loads
    var lastScan = 0;
    el("stSong").addEventListener("mouseenter", function () {
      if (Date.now() - lastScan < 2000) return;
      lastScan = Date.now(); loadSongs();
    });
  }
  if (el("stemsdock") && window.ResizeObserver) {
    var ro = new ResizeObserver(function () {
      for (var k in WAVES) if (WAVES[k].peaks) drawWave(WAVES[k]);
    });
    ro.observe(el("stemsdock"));
  }

  if (el("stBrowse")) el("stBrowse").onclick = function () {
    var inp = el("stFile");
    if (inp) { inp.value = ""; inp.click(); }
  };
  if (el("stFile")) el("stFile").onchange = function (e) {
    stUploadAll(e.target.files || []);
  };

  /* 2.274.0 (Tim: "when the separate button is pressed, change button text
     to separating... (animate text until separation is complete) and change
     back to separate on complete separation"): the button ITSELF says what
     is happening — "separating" with a dot walking . .. ... while the job
     runs, the original label back the moment it ends, success or not. One
     interval, always cleared. */
  var SEP_LABEL = "✂🎤 Separate";
  var sepTimer = null;
  function sepAnimStart(b) {
    var dots = 0;
    b.textContent = "separating";
    sepTimer = setInterval(function () {
      dots = (dots + 1) % 4;
      b.textContent = "separating" + new Array(dots + 1).join(".");
    }, 400);
  }
  function sepAnimStop(b) {
    if (sepTimer) { clearInterval(sepTimer); sepTimer = null; }
    b.textContent = SEP_LABEL;
  }

  if (el("stGo")) el("stGo").onclick = function () {
    var song = el("stSong") ? el("stSong").value : "";
    if (!song) { say("pick a song first"); return; }
    var b = el("stGo"); b.disabled = true;
    sepAnimStart(b);
    say("separating " + song + " — the first run also downloads the htdemucs weights…");
    if (el("stOut")) el("stOut").textContent = "";
    fetch("/api/stems/separate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: song }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        b.disabled = false;
        sepAnimStop(b);
        if (j.error) { say(j.error); return; }
        say("done — both stems are sound assets now");
        if (el("stOut")) el("stOut").textContent =
          "🎤 " + j.vocals + "   🎸 " + j.instrumental
          + " — the vocal stem makes the cleanest @music timing reference";
        loadSongs();
      })
      .catch(function (e) { b.disabled = false; sepAnimStop(b); say("separation failed: " + e.message); });
  };

  if (el("stInstall")) el("stInstall").onclick = function () {
    var b = el("stInstall"); b.disabled = true;
    say("queueing the demucs install — follow it in the job queue/console…");
    fetch("/api/audio/install", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ which: "demucs" }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        b.disabled = false;
        say(j.error ? j.error : "install queued into " + (j.venv || "venvs/demucs")
          + " — press ⟳ when it finishes");
      })
      .catch(function (e) { b.disabled = false; say("install failed to queue: " + e.message); });
  };

  loadSongs(); status();
})();
