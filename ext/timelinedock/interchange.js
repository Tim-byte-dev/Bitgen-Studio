/* bitGen Studio — ext/timelinedock/interchange.js (2.407.0): ⇄ EXCHANGE - the timeline out to other editors (Final Cut
 * Pro 7 XML for Premiere / Resolve / Avid, a CMX3600 EDL, OpenTimelineIO) and in from them (XML, EDL -> a new named
 * timeline; media matched by file name in this project, the missing ones listed). lib/interchange.js does the work.
 * 2.414.0: + FCPXML 1.10 for Final Cut Pro X (lib/fcpxml.js) both ways; the moves / keyframes / grade / captions carried
 * (lib/fcp7Extras.js) - Tim: "lets do the medium jobs now".
 * 2.417.0: + AAF for Avid Media Composer / Pro Tools (lib/aaf.js -> scripts/aaf_export.py, pyaaf2) - out only.
 * Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do". */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { try { return !!(window.TlDlg && window.TlCanvas && window.H3Timecode); } catch (e) { return false; } }
  var dlg = null, got = null;
  var FPS = ["23.976", "24", "25", "29.97", "30", "50", "59.94", "60"];
  var FMT = [["fcpxml", "Final Cut Pro 7 XML - DaVinci Resolve, Avid and most video editors"], ["fcpx", "FCPXML 1.10 - Final Cut Pro X (and Resolve)"],
             ["edl", "CMX3600 EDL - V1 only (the format holds one picture track)"], ["otio", "OpenTimelineIO (.otio)"],
             ["aaf", "AAF - Avid Media Composer, Pro Tools (media linked; clips, layers, sound tracks, timecode)"]];   // 2.417.0
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: typeof body === "string" ? body : JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); });
  }
  function download(name, text) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  /* 2.414.0: the moves / keyframes (tf, kf), the markers and the captions go too - the XML / FCPXML carry them now (the
     body is text, so the app's JSON limit does not apply) */
  function slimTl() {
    return { video: tl.video || [], v1: tl.v1, vmute: tl.vmute, vlayers: tl.vlayers || [], audio: tl.audio || [], images: tl.images || [],
             seqMarkers: tl.seqMarkers || undefined, captions: tl.captions || undefined };
  }
  function paint() {
    var tc = tl.tc || { start: "00:00:00:00", fps: 25 };
    dlg.body.innerHTML = '<fieldset><legend>Send to another editor</legend>'
      + '<div class="fx-row"><select id="tixFmt" style="flex:1">' + FMT.map(function (f) { return '<option value="' + f[0] + '">' + esc(f[1]) + "</option>"; }).join("") + "</select></div>"
      + '<div class="fx-row"><label>name <input type="text" id="tixName" value="' + esc((typeof tlName !== "undefined" && tlName) || "timeline") + '" style="width:150px"></label>'
      + '<label>frame rate <select id="tixFps">' + FPS.map(function (f) { return '<option' + (String(tc.fps) === f ? " selected" : "") + ">" + f + "</option>"; }).join("") + "</select></label>"
      + '<label>starts at <input type="text" id="tixTc" value="' + esc(tc.start) + '" style="width:92px"></label>'
      + '<label title="29.97 / 59.94: HH:MM:SS;FF (2.412.0)"><input type="checkbox" id="tixDrop"' + (H3Timecode.isDrop(tc, tc.fps) ? " checked" : "") + "> drop-frame</label>"
      + '<button type="button" id="tixOut">⬇ Export</button></div>'
      + '<div class="fx-dim">The media stays where it is (the file paths point into this project). Kept: clips, trims, layers, speed / reverse, opacity, volume, stills, timecode, markers, position / scale / rotation and their ◆ keyframes, opacity / volume keyframes, captions (titles in the XML, captions in FCPXML). The grade: each graded clip\'s look is baked into a .cube beside the file - apply it as the clip\'s input LUT (Resolve: a node LUT; Final Cut: Custom LUT). Not carried: 3D layers; a speed ramp goes as its average speed.</div>'
      + '<div class="fx-dim" id="tixOutMsg"></div></fieldset>'
      + '<fieldset><legend>Bring in from another editor</legend>'
      + '<div class="fx-row"><input type="file" id="tixFile" accept=".xml,.fcpxml,.edl"><span class="fx-dim">an XML (most editors: File → Export → Final Cut Pro XML; Resolve: Export Timeline → FCP 7 XML), an FCPXML (Final Cut Pro X: File → Export XML) or an EDL</span></div>'
      + '<div id="tixIn"></div></fieldset>';
    ["tixName", "tixTc"].forEach(function (id) { $(id).addEventListener("keydown", function (e) { e.stopPropagation(); }); });
    $("tixOut").onclick = function () {
      var fps = +$("tixFps").value, start = $("tixTc").value.trim();
      var dr = H3Timecode.canDrop(fps) && ($("tixDrop").checked || /;/.test(start));
      var n = H3Timecode.norm(start.replace(/;/g, ":"), fps, false);
      start = n && dr ? n.replace(/:(\d\d)$/, ";$1") : n;
      if (!n || !isFinite(H3Timecode.parse(start, fps))) { alert("The start timecode is HH:MM:SS:FF (drop-frame HH:MM:SS;FF), e.g. 01:00:00:00"); return; }
      tl.tc = dr ? { start: start, fps: fps, drop: true } : { start: start, fps: fps }; if (typeof tlSave === "function") tlSave();
      var S = TlCanvas.state;
      post("/api/interchange/export", { tl: slimTl(), format: $("tixFmt").value, fps: fps, tc: tl.tc, w: S.W, h: S.H, name: $("tixName").value.trim() || "timeline" })
        .then(function (j) {
          if ($("tixFmt").value === "aaf") {               // 2.417.0: binary - fetched from exports/
            var a = document.createElement("a"); a.href = "/api/interchange/file/" + encodeURIComponent(j.file); a.download = j.file;
            document.body.appendChild(a); a.click(); a.remove();
            $("tixOutMsg").textContent = j.file + " - " + j.tracks.video + " picture + " + j.tracks.audio + " sound track(s), " + j.clips + " clip(s); also kept in the project's exports folder."
              + " Avid / Pro Tools carry the cut, not opacity, volume, moves or the grade (the FCP 7 XML does)." + (j.notes && j.notes.length ? " " + j.notes.join("; ") : "");
            return;
          }
          download(j.file, j.text); $("tixOutMsg").textContent = j.file + " - also kept in the project's exports folder."
          + (j.luts && j.luts.length ? " The grade: " + j.luts.length + " .cube LUT(s) in exports/" + j.luts[0].split("/")[0] + "/ (named in each clip)." : ""); })
        .catch(function (e) { alert("Export: " + e.message); });
    };
    $("tixFile").onchange = function () {
      var f = $("tixFile").files && $("tixFile").files[0]; if (!f) return;
      f.text().then(function (t) { return post("/api/interchange/import?filename=" + encodeURIComponent(f.name) + "&fps=" + encodeURIComponent((tl.tc && tl.tc.fps) || 25), t); })
        .then(function (j) { got = j; paintIn(); })
        .catch(function (e) { $("tixIn").innerHTML = '<div class="fx-dim">⚠ ' + esc(e.message) + "</div>"; });
    };
  }
  function paintIn() {
    var j = got, t = j.tl, n = (t.video || []).length + [].concat(t.vlayers || [], t.audio || [], t.images || []).reduce(function (a, L) { return a + (L.clips || []).length; }, 0);
    $("tixIn").innerHTML = '<div class="fx-row"><b>' + esc(j.name) + '</b><span class="fx-dim">' + n + " clip(s) · V1 + " + (t.vlayers || []).length + " video, " + (t.audio || []).length + " sound, "
      + (t.images || []).length + " picture layer(s) · " + j.fps + " fps" + (t.tc ? " · starts " + esc(t.tc.start) : "") + "</span></div>"
      + (j.missing.length ? '<div class="fx-dim">⚠ not in this project (add them to the assets, then import again): ' + j.missing.map(esc).join(", ") + "</div>" : "")
      + (j.notes || []).map(function (x) { return '<div class="fx-dim">' + esc(x) + "</div>"; }).join("")
      + '<div class="fx-row"><label>as the timeline <input type="text" id="tixAs" value="' + esc(j.name) + '" style="width:160px"></label><button type="button" id="tixOpen"' + (n ? "" : " disabled") + ">Open it</button></div>";
    $("tixAs").addEventListener("keydown", function (e) { e.stopPropagation(); });
    $("tixOpen").onclick = function () {
      var name = $("tixAs").value.trim() || "imported";
      fetch("/api/timelines/" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tl: t, activate: true }) })
        .then(function (r) { return r.json().then(function (x) { if (!r.ok) throw new Error(x.error || "HTTP " + r.status); return x; }); })
        .then(function (x) { return typeof tlSwitch === "function" ? tlSwitch(x.name || name) : null; })
        .then(function () { if (typeof tlRefreshList === "function") tlRefreshList(); dlg.close(); if (typeof logLine === "function") logLine("[exchange] opened " + name); })
        .catch(function (e) { alert("Could not open it: " + e.message); });
    };
  }
  function open() {
    if (!dlg) {
      dlg = TlDlg.make({ id: "tlExchangeDlg", title: "Exchange", width: 640 });
      dlg.foot.innerHTML = '<button type="button" id="tixDone">Done</button>';
      $("tixDone").onclick = function () { dlg.close(); };
    }
    paint(); dlg.open();
  }
  function boot() {
    if (!ready()) { setTimeout(boot, 300); return; }
    TlDlg.button("tlExchangeBtn", "⇄", "Exchange: XML / EDL / OTIO / AAF to and from other editors", open);
  }
  window.TlExchange = { open: open };
  boot();
})();
