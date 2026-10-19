/* bitGen Studio — musicdock's OWN wiring (2.223.14). The music ENGINE stays
   core by instruction — startMusicJob is also the main Generate bar's audio
   mode and the chat's lyric hand-off, loadMusicStyles also fills Settings —
   so this file is exactly the docker's private entry points: the style
   dropdown remembering its choice and the Generate Music button. Both call
   the core services at click time. */
(function () {
  function $(id) { return document.getElementById(id); }

$("musicSel") && ($("musicSel").onchange = () => {
  store.set("mstyle", $("musicSel").value);
  updateMusicBtn();
});

$("goMusic") && ($("goMusic").onclick = () => startMusicJob());




/* 2.231.0 (by instruction): 🎬 Create video — a music-video screenplay from
   this song. The dialog picks the video style, the 🎭 characters and the
   locations; Go stores the cast selection (PUT /api/characters/cast — the
   selection IS the reference chain), builds a brief that names the scene
   count (>=2 engages the iterative writer), folds the LYRICS in as the
   story, and calls the SAME /api/screenplay endpoint the video docker's
   writer uses — the plan lands on the scene board, nothing new invented. */
function muVidPaintList(box, items, idOf, labelOf, tickAll) {
  box.innerHTML = "";
  items.forEach(function (it) {
    var lab = document.createElement("label");
    lab.style.cssText = "display:flex;gap:6px;align-items:center";
    var cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = !!tickAll;
    cb.value = idOf(it); cb.dataset.name = labelOf(it);
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(labelOf(it)));
    box.appendChild(lab);
  });
  if (!items.length) box.innerHTML = "<div class='dim'>none yet</div>";
}
function muVidTicked(box) {
  return Array.prototype.slice.call(box.querySelectorAll("input:checked"));
}
$("muVidBtn") && ($("muVidBtn").onclick = function () {
  $("muVidMsg").textContent = "";
  fetch("/api/characters/cast").then(function (r) { return r.json(); })
    .then(function (d) {
      var active = d.active || [];
      muVidPaintList($("muVidCast"), d.characters || [],
        function (c) { return c.id; }, function (c) { return c.name; }, false);
      // pre-tick the current 🎭 selection; an empty selection means everyone
      $("muVidCast").querySelectorAll("input").forEach(function (cb) {
        cb.checked = !active.length || active.indexOf(cb.value) >= 0;
      });
    }).catch(function () {});
  fetch("/api/environments").then(function (r) { return r.json(); })
    .then(function (d) {
      muVidPaintList($("muVidEnvs"), d.environments || d.list || d || [],
        function (e) { return e.name; }, function (e) { return e.name; }, true);
    }).catch(function () {});
  try { $("muVidDlg").showModal(); } catch (er) {}
});
$("muVidCancel") && ($("muVidCancel").onclick = function () { $("muVidDlg").close(); });
$("muVidGo") && ($("muVidGo").onclick = function () {
  var lyrics = ($("muLyrics").value || "").trim();
  if (!lyrics) { $("muVidMsg").textContent =
    "the lyrics box is empty — the video follows the song's words"; return; }
  var cast = muVidTicked($("muVidCast"));
  if (!cast.length) { $("muVidMsg").textContent =
    "tick at least one character — a screenplay with no cast has no @tags"; return; }
  var style = ($("muVidStyle").value || "").trim();
  var envs = muVidTicked($("muVidEnvs")).map(function (cb) { return cb.dataset.name; });
  var n = Math.max(1, Math.min(24, parseInt($("muVidScenes").value, 10) || 6));
  var brief = "Create a MUSIC VIDEO screenplay for this song in " + n
    + " scenes." + (style ? " Video style: " + style + "." : "")
    + (envs.length ? " Locations to use: " + envs.join(", ") + "." : "")
    + " The screenplay follows the LYRICS below - verses, choruses and mood"
    + " map onto scenes; performance and story may mix. Characters lip-sync"
    + " or act the words where it fits.\n\nTHE LYRICS:\n" + lyrics;
  $("muVidGo").disabled = true;
  $("muVidMsg").textContent = "storing the cast selection…";
  fetch("/api/characters/cast", { method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active: cast.map(function (cb) { return cb.value; }) }) })
    .then(function () {
      $("muVidMsg").textContent = "writing the screenplay… (" + n
        + " scenes; a big song can take a few minutes)";
      return fetch("/api/screenplay", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief }) });
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      $("muVidGo").disabled = false;
      if (d && d.error) { $("muVidMsg").textContent = d.error; return; }
      var got = ((d && d.plan && d.plan.shots) || []).length
        || ((d && d.shots) || []).length || n;
      $("muVidMsg").textContent = "🎬 screenplay is on the scene board - "
        + got + " scene(s). Open the video docker and press ▶.";
    })
    .catch(function (er) {
      $("muVidGo").disabled = false;
      $("muVidMsg").textContent = "the writer failed: " + (er.message || er);
    });
});


/* --------------- 2.236.0: the tabs (Tim: "integrate this workflow into our
   music docker, add a tab to our music docker for sheet music and tabs for
   each of yue2's capabilities"). Song is the whole existing dock; Cover and
   Sheet Music post the SAME /api/genmusic with a variant, riding the Song
   tab's style/lyrics/settings so the words live in one place. Everything
   that touches core globals (store, refreshJobs, selectJob, awaitJob,
   ensureComfyReady) does so in DEFERRED handlers only — the 2.233.8 TDZ
   rule. */
function muTabSel(name) {
  ["song", "cover", "sheet"].forEach(function (t) {
    var b = document.querySelector('#muTabs button[data-mutab="' + t + '"]');
    if (b) b.classList.toggle("on", t === name);
    var pane = $("muPane" + t.charAt(0).toUpperCase() + t.slice(1));
    if (pane) pane.classList.toggle("hidden", t !== name);
  });
  try { store.set("mutab", name); } catch (e) { /* core store not up yet */ }
}
/* 2.240.0: DELEGATION on the menubar (falls back to the tab strip) — the
   tabs stay live no matter how the buttons move around the bar. */
var muBarEl = $("muBar") || $("muTabs");
muBarEl && (muBarEl.onclick = function (ev) {
  var b = ev.target && ev.target.closest && ev.target.closest("button[data-mutab]");
  if (b) muTabSel(b.dataset.mutab);
});
setTimeout(function () {           // restore the remembered tab, deferred
  try { var t = store.get("mutab"); if (t && t !== "song") muTabSel(t); }
  catch (e) { /* first run / no store: Song stays */ }
  // 2.238.0: the Save-as pick persists across sessions
  try {
    var f = store.get("muformat");
    if (f && $("muFormat")) $("muFormat").value = f;
  } catch (e) { /* no store yet: flac stays */ }
}, 0);
$("muFormat") && ($("muFormat").onchange = function () {
  try { store.set("muformat", $("muFormat").value); } catch (e) { /* fine */ }
});

/* the shared send: FormData when a file rides, JSON otherwise; then the
   status line follows the job and done() gets the finished job dict. */
function muVariantJob(opts) {
  var status = $(opts.statusId);
  var say = function (t) { if (status) status.textContent = t; };
  var styleId = ($("musicSel") || {}).value;
  if (!styleId) { say("pick a music style first (Settings → Music)"); return; }
  var lyrics = String((($("muLyrics") || {}).value) || "").trim();
  if (opts.needLyrics && !lyrics) { say("write the lyrics on the Song tab first"); return; }
  var run = function () {
    var body, headers = null;
    if (opts.refFile) {
      body = new FormData();
      body.append("variant", opts.variant);
      body.append("style_id", styleId);
      if (lyrics) body.append("prompt", lyrics);
      body.append("ref", opts.refFile, opts.refFile.name || "ref.wav");
      var fEl = $("muFormat");
      if (opts.variant !== "abc" && fEl && fEl.value) body.append("format", fEl.value);
      var tEl = $("muTitle");
      if (tEl && tEl.value.trim()) body.append("title", tEl.value.trim());
    } else {
      headers = { "Content-Type": "application/json" };
      body = JSON.stringify({ variant: opts.variant, style_id: styleId, prompt: lyrics });
    }
    say("sending…");
    if (opts.button) opts.button.disabled = true;
    fetch("/api/genmusic", { method: "POST", headers: headers || undefined, body: body })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (rr) {
        if (opts.button) opts.button.disabled = false;
        if (!rr.ok) { say("refused: " + (rr.j.error || "request failed")); return; }
        var id = rr.j.id;
        say("queued · job " + id);
        try { refreshJobs(); selectJob(id); } catch (e) { /* console shut: fine */ }
        awaitJob(id, function (jj) {
          if (jj.status === "running") say(opts.doing + " · job " + id + (jj.progress ? " · " + jj.progress : ""));
        }).then(function (st) {
          if (st !== "done") { say(st + " · job " + id + " — open the Console for the log"); return; }
          fetch("/api/jobs/" + id).then(function (r) { return r.json(); })
            .then(function (job) { say("done · job " + id); if (opts.done) opts.done(job); })
            .catch(function () { say("done · job " + id); });
        }).catch(function () { say("job " + id + " — status lost; see the Console"); });
      })
      .catch(function (er) {
        if (opts.button) opts.button.disabled = false;
        say("failed: " + (er.message || er));
      });
  };
  // ComfyUI must be up (the Song tab's own rule); ensureComfyReady is core's
  var ready = (typeof ensureComfyReady === "function")
    ? ensureComfyReady({ button: opts.button, need: true }) : Promise.resolve(true);
  Promise.resolve(ready).then(function (up) { if (up) run(); });
}

/* --------------- 2.241.0: New / Save / Load — the song as a file -------- */
/* The song = the dock's working state: lyrics + caption + style + length +
   count + seed + save-as. One JSON per song in the PROJECT's songs folder
   (the server knows the project). Save and Load share one dialog; New asks
   with a second press instead of a dialog — lyrics are never wiped by one
   slip. All fetch/DOM work in deferred handlers (the TDZ rule). */
function muSongCollect() {
  return {
    title: ($("muTitle") || {}).value || "",
    lyrics: ($("muLyrics") || {}).value || "",
    caption: ($("muCaption") || {}).value || "",
    style_id: ($("musicSel") || {}).value || "",
    style_name: (function () { var s = $("musicSel");
      return s && s.selectedIndex >= 0 ? s.options[s.selectedIndex].textContent : ""; })(),
    dur: ($("muDur") || {}).value || "",
    batch: ($("muBatch") || {}).value || "",
    seed: ($("muSeed") || {}).value || "",
    format: ($("muFormat") || {}).value || "",
  };
}
function muSongApply(s) {
  if ($("muTitle")) $("muTitle").value = s.title || "";
  if ($("muLyrics")) $("muLyrics").value = s.lyrics || "";
  if ($("muCaption")) $("muCaption").value = s.caption || "";
  if ($("muDur")) $("muDur").value = s.dur !== undefined ? s.dur : "";
  if ($("muBatch")) $("muBatch").value = s.batch !== undefined ? s.batch : 1;
  if ($("muSeed")) $("muSeed").value = s.seed !== undefined ? s.seed : "";
  if ($("muFormat") && s.format) $("muFormat").value = s.format;
  var sel = $("musicSel");
  if (sel && s.style_id !== undefined) {
    var has = Array.prototype.some.call(sel.options, function (o) { return o.value === s.style_id; });
    sel.value = has ? s.style_id : "";
    if (!has && s.style_id) muSongMsg('the saved style is gone from this install — pick one ("' + (s.style_name || s.style_id) + '" was saved)');
    try { store.set("mstyle", sel.value); } catch (e) { /* fine */ }
    if (typeof updateMusicBtn === "function") updateMusicBtn();
  }
}
function muSaveMsg(t) { if ($("muSaveMsg")) $("muSaveMsg").textContent = t || ""; }
function muLoadMsg(t) { if ($("muLoadMsg")) $("muLoadMsg").textContent = t || ""; }
/* 2.246.0: one show/hide pair for BOTH dialogs (showModal where the DOM has
   it, the open attribute where it does not). */
function muDlgShow(id) {
  var d = $(id);
  if (!d) return;
  if (d.showModal) { if (!d.open) d.showModal(); }
  else d.setAttribute("open", "");
}
function muDlgHide(id) {
  var d = $(id);
  if (!d) return;
  if (d.close && d.open) d.close(); else d.removeAttribute("open");
  var au = $("muSongAudio");
  if (au && au.pause) { au.pause(); }        // closing Load stops playback
  var pop = $("muInfoPop");
  if (pop) pop.classList.add("hidden");      // and takes the ⓘ card with it
}
function muSongPaintList() {
  var box = $("muSongList");
  if (!box) return;
  box.textContent = "loading…";
  fetch("/api/songs").then(function (r) { return r.json(); }).then(function (j) {
    box.innerHTML = "";
    var ss = (j && j.songs) || [];
    if (!ss.length) { box.textContent = "— none yet — Save one first —"; return; }
    ss.forEach(function (s) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px 0;"
        + "border-bottom:1px solid var(--line,#262a33)";
      var meta = document.createElement("span");
      meta.className = "hint";
      meta.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      meta.textContent = "🎵 " + s.name
        + (s.style_name ? " — " + s.style_name : "")
        + (s.saved_at ? " · " + s.saved_at.slice(0, 16).replace("T", " ") : "");
      meta.title = s.name + " (" + s.lyrics_chars + " lyric chars)";
      var play = document.createElement("button");
      play.type = "button";
      play.className = "ghost gbtn";
      play.textContent = "▶";
      if (s.audio) {
        play.title = "Play " + s.audio;
        play.setAttribute("aria-label", "Play " + s.name);
        play.onclick = function () {
          var au = $("muSongAudio");
          if (!au) return;
          var url = "/outputs/" + encodeURIComponent(s.audio);
          if (au.dataset.now === url && !au.paused) { au.pause(); play.textContent = "▶"; return; }
          au.src = url;
          au.dataset.now = url;
          var started = au.play();
          play.textContent = "⏸";
          au.onended = function () { play.textContent = "▶"; };
          au.onerror = function () { play.textContent = "▶"; muLoadMsg("could not play " + s.audio); };
          if (started && started.catch) started.catch(function (er) { muLoadMsg("could not play: " + (er.message || er)); });
        };
      } else {
        play.disabled = true;
        play.title = "no rendered audio found for this title — load the song, press Generate, then reopen this list (renders from before the title feature carry no title in their filename and cannot be matched)";
        play.setAttribute("aria-label", "No rendered audio for " + s.name);
      }
      // 2.250.0 (by instruction): ⓘ — an italic i in a circle. Mouseover
      // shows the render record's details in the floating card; mouseout
      // closes it. A song with no record says so in the same card.
      var info = document.createElement("button");
      info.type = "button";
      info.className = "ghost gbtn";
      info.style.fontStyle = "italic";
      info.textContent = "ⓘ";
      info.title = "Details";
      info.setAttribute("aria-label", "Details of " + s.name);
      info.onmouseover = function (ev) {
        var pop = $("muInfoPop");
        if (!pop) return;
        var r = s.record;
        var esc = function (t) { var d2 = document.createElement("span"); d2.textContent = String(t || ""); return d2.innerHTML; };
        pop.innerHTML = r
          ? "<b>" + esc(r.title || s.name) + "</b><br>"
            + "🎵 " + esc(r.filename) + "<br>"
            + "🕒 " + esc((r.created_at || "").slice(0, 16).replace("T", " ")) + "<br>"
            + "👤 " + esc(r.created_by || "") + "<br>"
            + "<div style=\"margin-top:6px;max-height:140px;overflow:hidden;white-space:pre-wrap\">" + esc(r.lyrics || "") + "</div>"
          : "<b>" + esc(s.name) + "</b><br>no render record yet — press Generate; the record is written when the song finishes"
            + (s.saved_at ? "<br>🕒 saved " + esc(s.saved_at.slice(0, 16).replace("T", " ")) : "");
        var rect = info.getBoundingClientRect();
        pop.style.left = Math.max(8, rect.left - 350) + "px";
        pop.style.top = Math.max(8, rect.top - 10) + "px";
        pop.classList.remove("hidden");
      };
      info.onmouseout = function () {
        var pop = $("muInfoPop");
        if (pop) pop.classList.add("hidden");
      };
      var load = document.createElement("button");
      load.type = "button";
      load.className = "ghost gbtn";
      load.textContent = "📂";
      load.title = "Load this song into the dock";
      load.setAttribute("aria-label", "Load " + s.name);
      load.onclick = function () {
        fetch("/api/songs/" + encodeURIComponent(s.name))
          .then(function (r) { return r.json().then(function (jj) { return { ok: r.ok, j: jj }; }); })
          .then(function (rr) {
            if (!rr.ok) { muLoadMsg(rr.j.error || "load failed"); return; }
            muSongApply(rr.j);
            if ($("muSongName")) $("muSongName").value = rr.j.name || s.name;
            try { store.set("musong", rr.j.name || s.name); } catch (e) { /* fine */ }
            muDlgHide("muLoadDlg");
            muTabSel("song");
          })
          .catch(function (er) { muLoadMsg("load failed: " + (er.message || er)); });
      };
      row.appendChild(meta); row.appendChild(play);
      row.appendChild(info); row.appendChild(load);
      box.appendChild(row);
    });
  }).catch(function () { box.textContent = "the songs endpoint did not answer — is the app server running?"; });
}
$("muSave") && ($("muSave").onclick = function () {
  var nm = $("muSongName");
  if (nm) {
    // 2.246.0 (by instruction): the TITLE is the default song name — always
    // offered fresh on open, freely editable before 💾.
    nm.value = (($("muTitle") || {}).value || "").trim();
    if (!nm.value) { try { nm.value = store.get("musong") || ""; } catch (e) { /* fine */ } }
  }
  muSaveMsg("");
  muDlgShow("muSaveDlg");
  nm && nm.focus && nm.focus();
});
$("muLoad") && ($("muLoad").onclick = function () {
  muLoadMsg("");
  muSongPaintList();
  muDlgShow("muLoadDlg");
});
$("muSongGo") && ($("muSongGo").onclick = function () {
  var name = (($("muSongName") || {}).value || "").trim();
  if (!name) { muSaveMsg("a song needs a name — type one first"); return; }
  // 2.248.0: a save with an EMPTY Title takes the song's name as its title
  // (dock field included) — the next render then LEADS with it, which is
  // exactly what the Load dialog's ▶ finds. Without this, an untitled
  // song's renders carry no lead and its ▶ could never play.
  var tEl48 = $("muTitle");
  if (tEl48 && !tEl48.value.trim()) tEl48.value = name;
  fetch("/api/songs/" + encodeURIComponent(name), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(muSongCollect()),
  }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (rr) {
      if (!rr.ok) { muSaveMsg(rr.j.error || "save failed"); return; }
      try { store.set("musong", rr.j.name); } catch (e) { /* fine */ }
      if ($("muStatus")) $("muStatus").textContent = 'saved as "' + rr.j.name + '"';
      muDlgHide("muSaveDlg");
    })
    .catch(function (er) { muSaveMsg("save failed: " + (er.message || er)); });
});
$("muSaveX") && ($("muSaveX").onclick = function () { muDlgHide("muSaveDlg"); });
$("muLoadX") && ($("muLoadX").onclick = function () { muDlgHide("muLoadDlg"); });
var muNewArmed = 0;
$("muNew") && ($("muNew").onclick = function () {
  var dirty = (($("muLyrics") || {}).value || "").trim()
    || (($("muCaption") || {}).value || "").trim();
  if (dirty && Date.now() - muNewArmed > 4000) {
    muNewArmed = Date.now();
    if ($("muStatus")) $("muStatus").textContent = "press 🆕 New again to clear the song";
    return;
  }
  muNewArmed = 0;
  muSongApply({ title: "", lyrics: "", caption: "", dur: "", batch: 1, seed: "" });
  if ($("muSongName")) $("muSongName").value = "";
  try { store.set("musong", ""); } catch (e) { /* fine */ }
  if ($("muStatus")) $("muStatus").textContent = "new song — the page is blank";
  muTabSel("song");
});

/* 🎤 Cover: the reference track's melody, the Song tab's words and sound */
$("goCover") && ($("goCover").onclick = function () {
  var f = ($("muCoverRef") || {}).files;
  if (!f || !f.length) { $("muCoverStatus").textContent = "pick a reference track first"; return; }
  muVariantJob({ variant: "cover", refFile: f[0], needLyrics: false,
    button: $("goCover"), statusId: "muCoverStatus", doing: "singing the cover",
    done: function () {
      $("muCoverStatus").textContent = "done — see the gallery's Audio tab (the .abc score is saved beside the song)";
      var ab = document.querySelector('.gtabs button[data-gtab="audio"]');
      if (ab) ab.onclick();
    } });
});

/* 🎼 Sheet Music: the score, shown in the pane */
function muShowAbc(job) {
  var name = job && (job.output || (job.outputs || [])[0]);
  if (!name) { $("muSheetStatus").textContent = "done, but no .abc landed — see the Console"; return; }
  fetch("/outputs/" + encodeURIComponent(name))
    .then(function (r) { return r.text(); })
    .then(function (t) {
      $("muAbc").textContent = t || "— empty score —";
      $("muSheetStatus").textContent = "done — " + name + " (also in the project's output folder)";
    })
    .catch(function () { $("muSheetStatus").textContent = "done, but " + name + " would not load"; });
}
$("goSheetWrite") && ($("goSheetWrite").onclick = function () {
  muVariantJob({ variant: "abc", needLyrics: true, button: $("goSheetWrite"),
    statusId: "muSheetStatus", doing: "writing the score", done: muShowAbc });
});
$("goSheetTranscribe") && ($("goSheetTranscribe").onclick = function () {
  var f = ($("muSheetRef") || {}).files;
  if (!f || !f.length) { $("muSheetStatus").textContent = "pick an audio file first"; return; }
  muVariantJob({ variant: "abc", refFile: f[0], needLyrics: false,
    button: $("goSheetTranscribe"), statusId: "muSheetStatus",
    doing: "transcribing", done: muShowAbc });
});
$("muAbcCopy") && ($("muAbcCopy").onclick = function () {
  var t = ($("muAbc") || {}).textContent || "";
  if (!t || t.indexOf("— no sheet") === 0) { $("muSheetStatus").textContent = "nothing to copy yet"; return; }
  navigator.clipboard.writeText(t).then(
    function () { $("muSheetStatus").textContent = "copied"; },
    function () { $("muSheetStatus").textContent = "copy failed — select the text by hand"; });
});

})();
