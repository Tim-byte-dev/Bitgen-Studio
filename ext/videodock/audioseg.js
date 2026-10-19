/* bitGen Studio — the Video docker's LOAD AUDIO + SONG STRIP (2.289.0).
 *
 * Tim (verbatim): "when we are making a music video, put a load audio
 * button in the video docker menubar. load a waveform of the song, auto
 * segment the song the same as the stem docker does it (do not actually
 * cut the files) just save the segment start time and duration to the
 * .seg file, create the blank scenes on save, populate the start and
 * duration inputs for each scene."
 *
 *   🎵 (menubar; since 2.299.0 inside the 📂 Load menu) picks a song from
 *                 anywhere on disk -> POST /api/stems/upload (the
 *                 512MB song route, lands in the project's sound assets)
 *                 -> the strip opens on it -> it becomes the board's song
 *                 (POST /api/scenes/audio, the 2.288 Audio picker's own
 *                 route - the picker shows it too).
 *   the strip     the song's waveform (/api/waveform) with its segment map
 *                 (GET /api/stems/segments: the saved .seg, else the
 *                 default 15-second grid - exactly what the stems dock's
 *                 ✂# loads). The editing rules are the stems dock's,
 *                 written once in core static/segmap.js.
 *   💾            POST /api/scenes/from-segments: the map goes to
 *                 <song>.seg ("segment n: A s to B s (D seconds)") and
 *                 lib/segBoard stages one scene per segment, each card's
 *                 start/duration inputs filled. Nothing is cut.
 * The strip follows the BOARD's song: characters.js says which song the
 * board holds on every paint ("vd:board-song"), so the Audio picker, a
 * project switch or the stems dock's 📤 all bring the right waveform. */
(function () {
  "use strict";
  function el(id) { return document.getElementById(id); }
  if (!el("videodock") || !el("vdWave")) return;

  var AUDIO_RE = /\.(wav|mp3|flac|ogg|m4a|opus)$/i;
  var song = "", audio = null, ed = null, dirty = false;

  function say(t) { var m = el("vdWaveMsg"); if (m) m.textContent = t || ""; }
  function boardChanged() {
    try { document.dispatchEvent(new CustomEvent("vd:scenes-changed")); } catch (e) {}
  }
  function show(on) {
    el("vdWave").style.display = on ? "" : "none";
    if (on && ed) ed.redraw();
  }
  function stopAudio() {
    if (audio) { try { audio.pause(); audio.src = ""; } catch (e) {} audio = null; }
    if (el("vdWavePlay")) el("vdWavePlay").textContent = "▶";
  }

  function editor() {
    if (ed) return ed;
    if (!window.SegMap) return null;
    ed = window.SegMap.attach(el("vdWaveCv"), {
      // 2.310.0 (Tim: "when user drags the duration marker over the
      // waveform, round up to the nearest second, no decimal places, in
      // video docker"): cuts snap to whole seconds, labels show no decimals
      snap: 1,
      onChange: function (S, note) {
        dirty = true;
        say((note ? note + " - " : "") + "unsaved - 💾 writes the .seg and the scenes");
      },
      onNote: function (t) { say(t); },
      onSeek: function (f) {
        if (audio && audio.duration) audio.currentTime = f * audio.duration;
      },
      playFrac: function () {
        return audio && audio.duration ? audio.currentTime / audio.duration : 0;
      }
    });
    return ed;
  }

  /** Open the strip on a song: waveform + its segment map (auto-cut on
   *  the 15-second grid when it has no .seg yet). */
  function loadSong(name) {
    var e = editor();
    show(true);
    if (!e) { say("the segment editor (static/segmap.js) did not load"); return Promise.resolve(); }
    stopAudio();
    song = name; dirty = false;
    e.S = null; e.peaks = null; e.reset();
    el("vdWaveName").textContent = name; el("vdWaveName").title = name;
    say("reading " + name + "…");
    gapFromBoard(name);
    var q = encodeURIComponent(name);
    return Promise.all([
      fetch("/api/waveform?src=sound&name=" + q)
        .then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch("/api/stems/segments?song=" + q)
        .then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      if (song !== name) return;                  // another song took over
      if (res[0] && res[0].peaks) e.setPeaks(res[0].peaks);
      var S = window.SegMap.from(res[1]);
      if (!S) {
        say("could not read " + name + "'s duration"
          + (res[1] && res[1].error ? " - " + res[1].error : ""));
        return;
      }
      e.setSegs(S);
      say(S.durations.length + " segment(s) "
        + (res[1].file ? "from " + res[1].file : "auto-cut on the 15-second grid")
        + " - drag a red line to move a cut, click a duration to lock it; "
        + "💾 saves the .seg and creates the scenes");
    });
  }

  function ensureOption(name) {
    var sel = el("vdAudio");
    if (!sel || !name) return;
    var has = false;
    for (var i = 0; i < sel.options.length; i++)
      if (sel.options[i].value === name) has = true;
    if (!has) {
      var o = document.createElement("option");
      o.value = name; o.textContent = name;
      sel.appendChild(o);
    }
    sel.value = name;
  }

  function setBoardSong(name) {
    ensureOption(name);
    return fetch("/api/scenes/audio", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: name }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.error) say(d.error);
        boardChanged();
        return d;
      }).catch(function () {});
  }

  // ---- 🎵 Load audio -----------------------------------------------------
  if (el("vdLoadAudio")) el("vdLoadAudio").onclick = function () {
    var inp = el("vdAudioFile");
    if (inp) { inp.value = ""; inp.click(); }
  };
  if (el("vdAudioFile")) el("vdAudioFile").onchange = function () {
    var f = this.files && this.files[0];
    if (!f) return;
    show(true);
    if (!AUDIO_RE.test(f.name)) {
      say(f.name + " is not an audio file (wav, mp3, flac, ogg, m4a, opus)");
      return;
    }
    say("uploading " + f.name + "…");
    var fd = new FormData();
    fd.append("file", f, f.name);
    fetch("/api/stems/upload", { method: "POST", body: fd })
      .then(function (r) { return r.json().then(function (j) {
        if (!r.ok || !j || j.error) throw new Error((j && j.error) || ("HTTP " + r.status));
        return j;
      }); })
      .then(function (j) {
        // the strip first, then the board song: the board's paint event
        // then names the song already open, and nothing loads twice
        return loadSong(j.name).then(function () { return setBoardSong(j.name); })
          .then(function () {
            // 2.299.0: say where the song now lives (the ACTIVE project)
            var m = el("vdWaveMsg");
            say((j.existed ? j.name + " is already in this project (reused)"
                           : j.name + " copied into this project's sound assets")
                + (m && m.textContent ? " - " + m.textContent : ""));
          });
      })
      .catch(function (e) { say("upload failed: " + e.message); });
  };

  /* ---- 2.358.0: ☐ Transition + seconds + type (Tim: "add a transition
     checkbox to the song menubar before the save button, with a duration
     input. if user adds a 0.5 second transition when resegment the song with
     a 0.5 sec (or x duration) after each segment"). 💾 sends {gap, gap_type};
     the board keeps them (seg_gap) and the strip shows them again. */
  function gapSync() {
    var on = !!(el("vdSegGap") && el("vdSegGap").checked);
    if (el("vdSegGapDur")) el("vdSegGapDur").disabled = !on;
    if (el("vdSegGapType")) el("vdSegGapType").disabled = !on;
  }
  function gapBody() {
    var on = !!(el("vdSegGap") && el("vdSegGap").checked);
    var d = el("vdSegGapDur") ? parseFloat(el("vdSegGapDur").value) : NaN;
    return { gap: on && d > 0 ? Math.min(4, Math.max(0.1, d)) : 0,
             gap_type: el("vdSegGapType") ? el("vdSegGapType").value : "ai" };
  }
  var gapWant = "";          // a stored type that may arrive before the type list
  function gapShow(g) {
    if (!el("vdSegGap")) return;
    gapWant = g && g.type ? g.type : "";
    el("vdSegGap").checked = !!(g && g.dur > 0);
    if (g && g.dur > 0) {
      el("vdSegGapDur").value = g.dur;
      if (g.type) el("vdSegGapType").value = g.type;
    }
    gapSync();
  }
  if (el("vdSegGap")) el("vdSegGap").addEventListener("change", function () {
    gapSync();
    if (song) say(this.checked ? "transition on - 💾 adds a " + gapBody().gap + "s bridge scene after every segment"
                               : "transition off - 💾 stages the segments with no bridges");
  });
  if (el("vdSegGapType")) {
    fetch("/api/bridge/types").then(function (r) { return r.json(); }).then(function (d) {
      var sel = el("vdSegGapType"), cur = sel.value;
      sel.innerHTML = ((d && d.types) || []).map(function (t) {
        return '<option value="' + String(t.id).replace(/"/g, "") + '">' + String(t.label)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</option>"; }).join("") || '<option value="ai">AI (fl2va)</option>';
      sel.value = gapWant || cur || "ai";
      if (!sel.value) sel.value = "ai";
    }).catch(function () {});
  }
  // the board's gap for the song the strip opens (a re-save keeps it)
  function gapFromBoard(name) {
    return fetch("/api/scenes").then(function (r) { return r.json(); }).then(function (d) {
      if (song === name) gapShow(d && d.seg_song === name ? d.seg_gap : null);
    }).catch(function () {});
  }
  gapSync();

  // ---- the strip's buttons -------------------------------------------------
  if (el("vdWavePlay")) el("vdWavePlay").onclick = function () {
    if (!song) return;
    if (!audio) {
      audio = new Audio("/passets/sound/" + encodeURIComponent(song));
      audio.addEventListener("timeupdate", function () { if (ed) ed.redraw(); });
      audio.addEventListener("play", function () { el("vdWavePlay").textContent = "⏸"; });
      audio.addEventListener("pause", function () {
        el("vdWavePlay").textContent = "▶"; if (ed) ed.redraw(); });
      audio.addEventListener("ended", function () { el("vdWavePlay").textContent = "▶"; });
    }
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(function (e) { say("could not play " + song + ": " + e.message); });
    } else audio.pause();
  };
  if (el("vdZoomIn")) el("vdZoomIn").onclick = function () { if (ed) ed.zoom(0.5); };
  if (el("vdZoomOut")) el("vdZoomOut").onclick = function () { if (ed) ed.zoom(2); };
  if (el("vdZoomReset")) el("vdZoomReset").onclick = function () { if (ed) ed.reset(); };
  if (el("vdWaveClose")) el("vdWaveClose").onclick = function () {
    stopAudio(); show(false);
  };

  /** 💾 - the .seg and the scenes. A board holding WRITTEN scenes from
   *  another song's map asks first (those would be replaced by blanks); a
   *  re-save of the same song keeps its written scenes (lib/segBoard). */
  function writtenScenes(d) {
    return ((d && d.list) || []).filter(function (r) {
      var t = (r.prompt || []).join(" ");
      return t.trim() && !/\(blank - awaiting the writer/.test(t);
    }).length;
  }
  if (el("vdSegSave")) el("vdSegSave").onclick = function () {
    var S = ed && ed.segs();
    if (!song || !S) { say("load a song first - 📂 Load ▸ 🎵 a song in the menubar"); return; }
    var n = S.durations.length;
    fetch("/api/scenes").then(function (r) { return r.json(); })
      .catch(function () { return {}; })
      .then(function (d) {
        var w = writtenScenes(d);
        if (d && d.seg_song !== song && w && window.appConfirm)
          return window.appConfirm("The board has " + w + " written scene(s) that "
            + "were not staged from " + song + ". Replace them with " + n
            + " blank scene(s) for this song?");
        return true;
      })
      .then(function (ok) {
        if (!ok) { say("nothing saved - the board keeps its scenes"); return; }
        say("saving " + n + " segment(s)…");
        return fetch("/api/scenes/from-segments", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ song: song, durations: S.durations,
                                 manual: S.manual || [], gap: gapBody().gap,
                                 gap_type: gapBody().gap_type }) })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j || !j.ok) { say((j && j.error) || "save failed"); return; }
            dirty = false;
            ensureOption(song);
            say("saved " + (j.seg || "the .seg") + " - " + j.note);
            boardChanged();
          });
      })
      .catch(function (e) { say("save failed: " + e.message); });
  };

  /* The strip follows the BOARD's song (characters.js dispatches it on
     every paint): the Audio picker, a project switch, the stems dock's 📤
     all land here. An unchanged song is a no-op, so unsaved edits of the
     open song are never thrown away by a repaint. */
  document.addEventListener("vd:board-song", function (ev) {
    var name = String((ev && ev.detail) || "");
    if (name === song) return;
    if (!name) { song = ""; stopAudio(); show(false); return; }
    if (!AUDIO_RE.test(name)) return;
    loadSong(name);
  });

  // re-picking the OPEN song in the Audio picker re-opens a strip ✕ hid
  if (el("vdAudio")) el("vdAudio").addEventListener("change", function () {
    if (this.value && this.value === song) show(true);
  });

  if (window.ResizeObserver) {
    try {
      new ResizeObserver(function () {
        if (ed && el("vdWave").style.display !== "none") ed.redraw();
      }).observe(el("vdWave"));
    } catch (e) {}
  }

  // test/diagnostic handle - the state, never a second store
  window.vdSongStrip = { load: loadSong, song: function () { return song; },
                         dirty: function () { return dirty; },
                         editor: function () { return ed; } };
})();
