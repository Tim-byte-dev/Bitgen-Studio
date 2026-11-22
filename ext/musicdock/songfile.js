/* bitGen Studio — ext/musicdock/songfile.js (2.922.0): 🎵 a SONG FILE into the 🎶 Song tab - its title, lyrics and details
   read from its own tags.
   Tim: "if i load a song into our song tab in audio that was generated with bitgen, can we add the lyrics and details and
   name from the meta tags?"
   Three ways in: 🎵 From file (the menubar, a song from this computer), or DROP onto the Song tab - a file from this computer,
   or a song from the Gallery / Sound assets. The PC reads the tags (lib/songTags.js: bitGen's own details since 2.922.0,
   else ComfyUI's graph tag every older bitGen song has, the job, the render record, the player's tags, the filename) and
   the fields it found fill in; the rest stay as they are. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var NAMES = { title: "title", lyrics: "lyrics", caption: "caption", style_id: "style", dur: "length", seed: "seed", format: "save-as" };
  var SRC = { bitgen: "bitGen's tags", job: "the job that made it", graph: "ComfyUI's graph tag", record: "the render record", tags: "the player's tags", name: "the filename", file: "the file" };
  function status(t) { if ($("muStatus")) $("muStatus").textContent = t; }
  var M = function () { return window.H3MuSong || {}; };                    // the Song tab's own fill / read (ext/musicdock/musicdock.js)

  /** the PC's answer -> the Song tab */
  function apply(j, label) {
    if (!j || j.error) { status("🎵 " + ((j && j.error) || "the song's tags could not be read")); return false; }
    var s = j.song || {}, got = [];
    ["title", "lyrics", "caption", "style_id", "dur", "seed", "format"].forEach(function (k) { if (s[k] !== undefined && s[k] !== "" && s[k] !== null) got.push(k); });
    var words = got.filter(function (k) { return k === "title" || k === "lyrics" || k === "caption" || k === "style_id"; });
    if (!words.length) { status("🎵 " + label + ": no title, lyrics or details in its tags - nothing changed" + (s.dur ? " (it is " + s.dur + " s long)" : "")); return false; }
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
    status(line);
    return true;
  }
  /** a file from this computer */
  function fromFile(f) {
    if (!f) return;
    if (!/\.(flac|mp3|wav|ogg|opus|m4a|aac)$/i.test(f.name || "")) { status("🎵 " + f.name + " is not a song file"); return; }
    status("🎵 reading " + f.name + "…");
    var fd = new FormData(); fd.append("audio", f, f.name);
    return fetch("/api/song-tags", { method: "POST", body: fd }).then(function (r) { return r.json(); })
      .then(function (j) { apply(j, f.name); }).catch(function (e) { status("🎵 could not read " + f.name + ": " + (e.message || e)); });
  }
  /** a song of this project (the Gallery = output, the Sound assets = sound) */
  function fromProject(src, name) {
    status("🎵 reading " + name + "…");
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
  window.H3SongFile = { apply: apply, fromFile: fromFile, fromProject: fromProject };
})();
