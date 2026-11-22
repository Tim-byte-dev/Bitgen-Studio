/* bitGen Studio — ext/musicdock/songfile.js (2.922.0): 🎵 a SONG FILE into the 🎶 Song tab - its title, lyrics and details
   read from its own tags.
   Tim: "if i load a song into our song tab in audio that was generated with bitgen, can we add the lyrics and details and
   name from the meta tags?"
   Three ways in: 🎵 From file (the menubar, a song from this computer), or DROP onto the Song tab - a file from this computer,
   or a song from the Gallery / Sound assets. The PC reads the tags (lib/songTags.js: bitGen's own details since 2.922.0,
   else ComfyUI's graph tag every older bitGen song has, the job, the render record, the player's tags, the filename) and
   the fields it found fill in; the rest stay as they are.
   2.923.0 (Tim: "can we add a transcribe and put the lyrics in the song tab if no lyrics are found. let user know that it
   is transcribing with a progress bar"): a song with no lyrics in its tags is TRANSCRIBED by itself - the PC hears the words
   (lib/songLyrics.js: Song Separation takes the voice out first when installed, then Speech to Text) and they go in the
   Lyrics box; a bar under the title shows each stage and how far it is. 🎤 Transcribe does it again on purpose (the second
   press when the box has words). Speech to Text not installed = the ⬇ Download / Cancel box first (static/needinstall.js). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var NAMES = { title: "title", lyrics: "lyrics", caption: "caption", style_id: "style", dur: "length", seed: "seed", format: "save-as" };
  var SRC = { bitgen: "bitGen's tags", job: "the job that made it", graph: "ComfyUI's graph tag", record: "the render record", tags: "the player's tags", name: "the filename", file: "the file" };
  function status(t) { if ($("muStatus")) $("muStatus").textContent = t; }
  var last = null;                          // the song loaded last: {file: File} | {src, name} - what 🎤 Transcribe hears
  var M = function () { return window.H3MuSong || {}; };                    // the Song tab's own fill / read (ext/musicdock/musicdock.js)

  /** the PC's answer -> the Song tab */
  function apply(j, label) {
    if (!j || j.error) { status("🎵 " + ((j && j.error) || "the song's tags could not be read")); return false; }
    var s = j.song || {}, got = [];
    ["title", "lyrics", "caption", "style_id", "dur", "seed", "format"].forEach(function (k) { if (s[k] !== undefined && s[k] !== "" && s[k] !== null) got.push(k); });
    var words = got.filter(function (k) { return k === "title" || k === "lyrics" || k === "caption" || k === "style_id"; });
    if (!words.length) {
      status("🎵 " + label + ": no title, lyrics or details in its tags" + (s.dur ? " (it is " + s.dur + " s long)" : "") + " - transcribing its words");
      transcribe(label, false);
      return false;
    }
    var cur = M().collect ? M().collect() : {};
    var next = {}; for (var k in cur) next[k] = cur[k];
    got.forEach(function (k2) { next[k2] = s[k2]; });
    if (!s.caption && s.style_id && s.style_id !== cur.style_id) next.caption = "";       // another style: its own caption
    if (s.style_id && s.style_name) next.style_name = s.style_name;
    if (!M().apply) { status("🎵 the Song tab is not ready yet - try again"); return false; }
    M().apply(next);
    if (s.title) { try { store.set("musong", s.title); } catch (e) { /* fine */ } if ($("muSongName")) $("muSongName").value = s.title; }
    if (M().tab) M().tab("song");
    var extra = [s.bpm ? s.bpm + " bpm" : "", s.keyscale || "", s.timesig ? s.timesig + "/4" : "", s.language || "", j.genre || ""].filter(Boolean).join(" · ");
    var srcs = (j.found || []).map(function (x) { return SRC[x] || x; }).join(", ");
    var line = "🎵 " + (s.title ? '"' + s.title + '"' : label) + " - " + got.map(function (k3) { return NAMES[k3]; }).join(", ")
      + (extra ? " (" + extra + ")" : "") + (srcs ? " · from " + srcs : "");
    if (s.style_id && !j.style_found) line += ' · the style "' + (s.style_name || s.style_id) + '" is not in this install - pick one';
    status(line + (s.lyrics ? "" : " · no lyrics in its tags - transcribing them"));
    if (!s.lyrics) transcribe(s.title || label, false);
    return true;
  }

  /* ---- 2.923.0: the words heard, with a progress bar ---- */
  var watch = 0;                              // the transcription being followed (a newer one takes over)
  var STAGE = { queued: "starting", separate: "taking the voice out of the music", load: "loading the speech model", transcribe: "hearing the words" };
  function reset() { watch++; bar({ text: "", pct: null }); box(false); }
  function box(on) { if ($("muTrBox")) $("muTrBox").classList.toggle("hidden", !on); }
  function bar(o) {
    var b = $("muTrBox"); if (!b) return;
    b.classList.toggle("busy", !!o.busy); b.classList.toggle("ok", !!o.ok); b.classList.toggle("bad", !!o.bad);
    if ($("muTrText")) $("muTrText").textContent = o.text;
    if ($("muTrPct")) $("muTrPct").textContent = o.pct == null ? "" : Math.round(o.pct) + " %";
    if ($("muTrFill")) $("muTrFill").style.width = (o.pct == null ? (o.busy ? 100 : 0) : Math.max(2, Math.min(100, o.pct))) + "%";
  }
  /** hear the last loaded song's words -> the Lyrics box. replace = the user asked (🎤): the words go in even over lyrics */
  function transcribe(label, replace) {
    if (!last) { status("🎤 load a song first - 🎵 From file, or drop one on the Song tab"); return Promise.resolve(false); }
    var me = ++watch, name = label || last.name || (last.file && last.file.name) || "the song";
    var ly = $("muLyrics"), before = ly ? ly.value : "";
    if ($("muTrUse")) $("muTrUse").classList.add("hidden");
    box(true); bar({ text: "🎤 Transcribing " + name + " - checking Speech to Text…", pct: null, busy: true });
    var ensure = window.H3NeedInstall ? window.H3NeedInstall.ensure("whisper", "🎤 Transcribe hears the words of the song and puts them in the Lyrics box.") : Promise.resolve(true);
    return ensure.then(function (ok) {
      if (me !== watch) return false;
      if (!ok) { bar({ text: "🎤 Not transcribed - Speech to Text is not installed (⬇ Download it in the box, then 🎤 Transcribe)", pct: null, bad: true }); return false; }
      var fd = new FormData();
      if (last.file) fd.append("audio", last.file, last.file.name); else { fd.append("src", last.src); fd.append("name", last.name); }
      if (window.BG_TEST_SEGMENTS) fd.append("test_segments", JSON.stringify(window.BG_TEST_SEGMENTS));   // the e2e suite (no Whisper there)
      var t0 = Date.now();
      return fetch("/api/song-tags/transcribe", { method: "POST", body: fd }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.id) throw new Error((j && j.error) || "the transcription did not start");
        return new Promise(function (done) {
          (function poll() {
            if (me !== watch) return done(false);
            fetch("/api/song-tags/transcribe/" + j.id).then(function (r) { return r.json(); }).then(function (st) {
              if (me !== watch) return done(false);
              var secs = Math.round((Date.now() - t0) / 1000);
              if (st.stage === "error" || st.error) {
                bar({ text: "🎤 Not transcribed: " + (st.error || "it stopped"), pct: null, bad: true });
                status("🎤 " + name + ": not transcribed - " + (st.error || "it stopped"));
                return done(false);
              }
              if (st.stage === "done") {
                var mix = st.mix ? " - heard over the whole mix (install Song Separation for cleaner words)" : "";
                // by itself: only into an EMPTY box (words already there - yours or the last song's - are never lost: ⤵ puts the
                // heard ones in); 🎤 pressed: in, over what is there (the second press said so)
                var lyEl = $("muLyrics"), empty = lyEl && !before.trim() && !lyEl.value.trim();
                if (lyEl && (replace || empty)) {
                  lyEl.value = st.lyrics; lyEl.dispatchEvent(new Event("input", { bubbles: true }));
                  bar({ text: "🎤 Transcribed " + name + " in " + secs + " s - the words are in the Lyrics box (check them: hearing is never perfect)" + mix, pct: 100, ok: true });
                  status("🎤 " + name + ": the heard words are in the Lyrics box" + (st.language ? " (" + st.language + ")" : "") + mix);
                } else {
                  bar({ text: "🎤 Transcribed " + name + " - the Lyrics box already had words, so they were kept: ⤵ puts the heard ones in" + mix, pct: 100, ok: true });
                  status("🎤 " + name + ": transcribed - ⤵ Use the heard words to put them in the Lyrics box");
                  var use = $("muTrUse");
                  if (use) { use.classList.remove("hidden"); use.onclick = function () { var l2 = $("muLyrics"); if (l2) { l2.value = st.lyrics; l2.dispatchEvent(new Event("input", { bubbles: true })); } use.classList.add("hidden"); bar({ text: "🎤 The heard words are in the Lyrics box", pct: 100, ok: true }); }; }
                }
                return done(true);
              }
              var what = STAGE[st.stage] || st.note || "working";
              bar({ text: "🎤 Transcribing " + name + " - " + what + "… " + secs + " s" + (st.seconds ? " (a " + st.seconds + " s song)" : ""),
                pct: st.pct == null ? null : st.pct, busy: st.stage !== "transcribe" || st.pct == null });
              setTimeout(poll, 700);
            }).catch(function () { if (me === watch) setTimeout(poll, 1500); });
          })();
        });
      });
    }).catch(function (e) {
      if (me !== watch) return false;
      bar({ text: "🎤 Not transcribed: " + (e.message || e), pct: null, bad: true });
      return false;
    });
  }
  /** a file from this computer */
  function fromFile(f) {
    if (!f) return;
    if (!/\.(flac|mp3|wav|ogg|opus|m4a|aac)$/i.test(f.name || "")) { status("🎵 " + f.name + " is not a song file"); return; }
    status("🎵 reading " + f.name + "…");
    last = { file: f, name: f.name }; if ($("muTranscribe")) $("muTranscribe").disabled = false;
    reset();                                  // another song: the last one's bar goes (and its transcription is no longer followed)
    var fd = new FormData(); fd.append("audio", f, f.name);
    return fetch("/api/song-tags", { method: "POST", body: fd }).then(function (r) { return r.json(); })
      .then(function (j) { apply(j, f.name); }).catch(function (e) { status("🎵 could not read " + f.name + ": " + (e.message || e)); });
  }
  /** a song of this project (the Gallery = output, the Sound assets = sound) */
  function fromProject(src, name) {
    status("🎵 reading " + name + "…");
    last = { src: src, name: name }; if ($("muTranscribe")) $("muTranscribe").disabled = false;
    reset();                                  // another song: the last one's bar goes (and its transcription is no longer followed)
    return fetch("/api/song-tags?src=" + encodeURIComponent(src) + "&name=" + encodeURIComponent(name)).then(function (r) { return r.json(); })
      .then(function (j) { apply(j, name); }).catch(function (e) { status("🎵 could not read " + name + ": " + (e.message || e)); });
  }
  function payload() { try { return typeof dragPayload !== "undefined" ? dragPayload : null; } catch (e) { return null; } }   // the app's in-app drag (static/index.html)
  function songDrag(p) { return p && ((p.type === "asset" && p.kind === "sound") || (p.type === "output" && p.kind === "sound")); }

  function wire() {
    var btn = $("muFromFile"), inp = $("muFromFileIn"), pane = $("muPaneSong");
    if (!btn || !inp || !pane || btn._wired) return !!(btn && btn._wired);
    btn._wired = true;
    btn.onclick = function () { inp.value = ""; inp.click(); };
    var tr = $("muTranscribe"), armed = 0;
    if (tr) tr.onclick = function () {                       // 🎤 on purpose: the second press when the box has words
      var has = (($("muLyrics") || {}).value || "").trim();
      if (has && Date.now() - armed > 4000) { armed = Date.now(); status("🎤 the Lyrics box has words - press 🎤 Transcribe again to replace them with the heard ones"); return; }
      armed = 0; transcribe("", true);
    };
    if ($("muTrX")) $("muTrX").onclick = function () { watch++; box(false); };
    inp.onchange = function () { fromFile(inp.files && inp.files[0]); };
    pane.addEventListener("dragover", function (e) {
      var dt = e.dataTransfer, files = dt && Array.prototype.indexOf.call(dt.types || [], "Files") >= 0;
      if (files || songDrag(payload())) { e.preventDefault(); dt.dropEffect = "copy"; pane.classList.add("muDropOn"); }
    });
    pane.addEventListener("dragleave", function (e) { if (!pane.contains(e.relatedTarget)) pane.classList.remove("muDropOn"); });
    pane.addEventListener("drop", function (e) {
      pane.classList.remove("muDropOn");
      var p = payload(), f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { e.preventDefault(); fromFile(f); return; }
      if (songDrag(p)) { e.preventDefault(); fromProject(p.type === "asset" ? "sound" : "output", p.name); }
    });
    return true;
  }
  if (!wire()) { var n = 0, t = setInterval(function () { if (wire() || ++n > 120) clearInterval(t); }, 500); }
  window.H3SongFile = { apply: apply, fromFile: fromFile, fromProject: fromProject, transcribe: transcribe };
})();
