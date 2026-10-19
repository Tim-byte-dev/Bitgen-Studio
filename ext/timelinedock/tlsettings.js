/* bitGen Studio — the timeline docker's ⚙ TIMELINE SETTINGS dialog and the ← / → clip NUDGE (2.376.0).
 *
 * Tim (verbatim): "please add a settings button to the right of the timeline docker. add nudge settings to a timeline
 * settings dialog, add a titlebar to the docker. nudge by number of frames - when user presses the left or right
 * arrow nudge the timeline clip left or right by the number of frames set in the settings dialog".
 *
 * ⚙ (the right end of the timeline's menu bar) opens a dialog with a TITLEBAR (⚙ Timeline settings, ✕) and the
 * Nudge settings: frames per ← / →, and frames per Shift + ← / →. Saved in the settings file (custom.settings
 * ui.tl_nudge_frames / ui.tl_nudge_shift_frames - the same for every browser). ← / → then move the SELECTED clip
 * (click a clip to select it) by that many frames on its own layer - the core page's tlNudgeSelected (V1 keeps its
 * clips one after another). The keys are left alone while typing, while a dialog / popup / the lightbox is open, on
 * a slider or a playing <video>, and when no clip is selected.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  if (!$("tlSettings")) return;
  var DEF = { frames: 1, shift: 24 };
  var dlg = null;
  // 2.445.0: TABS - General (the nudge, scenes, karaoke) + what other files add (tlgrid.js: Grids & Guides):
  // {id, label, html() -> the tab's body, open(dlg) fills it, read(dlg) -> {ui: {...}} merged into the save (or
  // {error}), saved(ui) after the settings file took it}
  var TABS = [];
  function addTab(t) { TABS = TABS.filter(function (x) { return x.id !== t.id; }).concat([t]); if (dlg) { dlg.remove(); dlg = null; } }

  function conf() {
    var u = (typeof cfg === "object" && cfg && cfg.ui) || {};
    var f = parseInt(u.tl_nudge_frames, 10), s = parseInt(u.tl_nudge_shift_frames, 10);
    return { frames: f >= 1 && f <= 240 ? f : DEF.frames, shift: s >= 1 && s <= 240 ? s : DEF.shift };
  }
  function fps() { return typeof TLFPS === "number" ? TLFPS : 24; }
  function secs(n) { return (n / fps()).toFixed(3).replace(/\.?0+$/, "") + " s"; }

  var CSS = ""
    + "dialog.tlsdlg{width:min(420px,92vw);padding:0;overflow:hidden}"
    + ".tlsdlg .tls-title{display:flex;align-items:center;gap:8px;height:36px;padding:0 0 0 14px;user-select:none;"
    + "border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}"
    + ".tlsdlg .tls-title h2{margin:0;flex:1;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase}"
    + ".tlsdlg .tls-x{width:46px;height:36px;border:0;border-radius:0 10px 0 0;background:none;color:var(--text,#e8e2d6);font-size:15px;cursor:pointer}"
    + ".tlsdlg .tls-x:hover{background:#c42b1c}"
    + ".tlsdlg .tls-body{padding:12px 16px 4px}"
    + ".tlsdlg fieldset{border:1px solid var(--line,#3a342a);border-radius:6px;padding:8px 12px 10px;margin:0}"
    + ".tlsdlg legend{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dim,#9a917f);padding:0 6px}"
    + ".tlsdlg .tls-row{display:grid;grid-template-columns:1fr 84px 64px;gap:8px;align-items:center;margin:6px 0;font-size:.8rem}"
    + ".tlsdlg .tls-row input{width:100%}"
    + ".tlsdlg .tls-sec{color:var(--dim,#9a917f);font-size:.72rem;font-family:var(--mono,monospace)}"
    + ".tlsdlg .tls-hint{color:var(--dim,#9a917f);font-size:.72rem;line-height:1.45;margin:8px 0 0}"
    + ".tlsdlg .tls-foot{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px 14px}"
    + ".tlsdlg .tls-msg{margin-right:auto;color:var(--dim,#9a917f);font-size:.72rem;align-self:center}"
    + ".tlsdlg .tls-tabs{display:flex;gap:2px;padding:8px 16px 0;border-bottom:1px solid var(--line,#3a342a)}"
    + ".tlsdlg .tls-tabs button{border:1px solid transparent;border-bottom:0;border-radius:6px 6px 0 0;padding:4px 12px;background:none;color:var(--dim,#9a917f);font-size:.75rem}"
    + ".tlsdlg .tls-tabs button.on{border-color:var(--line,#3a342a);background:var(--panel-2,#26221b);color:var(--tiger,#f59e2c)}"
    + ".tlsdlg .h3gr-row{display:flex;align-items:center;gap:8px;font-size:.8rem}.tlsdlg .h3gr-row>span:first-child{flex:1}";

  function build() {
    if (dlg) return dlg;
    if (!$("tlsStyle")) { var st = document.createElement("style"); st.id = "tlsStyle"; st.textContent = CSS; document.head.appendChild(st); }
    dlg = document.createElement("dialog");
    dlg.className = "tlsdlg"; dlg.id = "tlsDlg";
    dlg.setAttribute("aria-label", "Timeline settings");
    dlg.innerHTML =
      '<div class="tls-title" id="tlsTitle"><h2>⚙ Timeline settings</h2>'
      + '<button type="button" class="tls-x" id="tlsClose" title="Close" aria-label="Close">✕</button></div>'
      + (TABS.length ? '<div class="tls-tabs" role="tablist"><button type="button" class="on" data-tlstab="general" role="tab">General</button>'
        + TABS.map(function (t) { return '<button type="button" data-tlstab="' + t.id + '" role="tab">' + t.label + '</button>'; }).join("") + '</div>' : "")
      + '<div class="tls-body" data-tlsbody="general"><fieldset><legend>Nudge</legend>'
      + '<label class="tls-row" for="tlsNudge"><span>← / → moves the selected clip</span>'
      + '<input type="number" id="tlsNudge" min="1" max="240" step="1"><span class="tls-sec" id="tlsNudgeS"></span></label>'
      + '<label class="tls-row" for="tlsNudgeShift"><span>Shift + ← / →</span>'
      + '<input type="number" id="tlsNudgeShift" min="1" max="240" step="1"><span class="tls-sec" id="tlsNudgeShiftS"></span></label>'
      + '</fieldset>'
      + '<fieldset style="margin-top:10px"><legend>Scenes</legend>'
      + '<label class="tls-row" for="tlsSongSync" style="grid-template-columns:auto 1fr"><input type="checkbox" id="tlsSongSync" style="width:auto">'
      + '<span>Place each rendered scene at its song time</span></label>'
      + '</fieldset>'
      // 2.380.0: the karaoke overlay's look (static/karaokestyle.js - the same dialog as the video docker's ⚙)
      + '<fieldset style="margin-top:10px"><legend>Karaoke</legend>'
      + '<button type="button" class="ghost" id="tlsKaraoke" style="width:auto">🎤 Karaoke style</button></fieldset></div>'
      + TABS.map(function (t) { return '<div class="tls-body" data-tlsbody="' + t.id + '" style="display:none">' + t.html() + '</div>'; }).join("")
      + '<div class="tls-foot"><span class="tls-msg" id="tlsMsg" aria-live="polite"></span>'
      + '<button type="button" class="ghost" id="tlsCancel">Cancel</button>'
      + '<button type="button" class="go" id="tlsSave" style="width:auto;margin-top:0;padding:6px 22px">Save</button></div>';
    document.body.appendChild(dlg);
    var paintSecs = function () {
      $("tlsNudgeS").textContent = "= " + secs(Math.max(0, parseInt($("tlsNudge").value, 10) || 0));
      $("tlsNudgeShiftS").textContent = "= " + secs(Math.max(0, parseInt($("tlsNudgeShift").value, 10) || 0));
    };
    $("tlsNudge").addEventListener("input", paintSecs);
    $("tlsNudgeShift").addEventListener("input", paintSecs);
    $("tlsClose").addEventListener("click", function () { dlg.close(); });
    $("tlsCancel").addEventListener("click", function () { dlg.close(); });
    $("tlsSave").addEventListener("click", save);
    $("tlsKaraoke").addEventListener("click", function () { if (window.KaraokeStyle) window.KaraokeStyle.open(); });
    dlg.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); save(); } });
    dlg._paint = paintSecs;
    Array.prototype.forEach.call(dlg.querySelectorAll("[data-tlstab]"), function (b) {
      b.addEventListener("click", function () { tab(b.dataset.tlstab); });
    });
    return dlg;
  }

  function tab(id) {
    if (!dlg) return;
    Array.prototype.forEach.call(dlg.querySelectorAll("[data-tlstab]"), function (b) { b.classList.toggle("on", b.dataset.tlstab === id); b.setAttribute("aria-selected", b.dataset.tlstab === id ? "true" : "false"); });
    Array.prototype.forEach.call(dlg.querySelectorAll("[data-tlsbody]"), function (x) { x.style.display = x.dataset.tlsbody === id ? "" : "none"; });
  }
  function open(tabId) {
    build();
    TABS.forEach(function (t) { if (t.open) { try { t.open(dlg); } catch (e) { /* the tab's */ } } });
    tab(typeof tabId === "string" && dlg.querySelector('[data-tlsbody="' + tabId + '"]') ? tabId : "general");
    var c = conf();
    var u0 = (typeof cfg === "object" && cfg && cfg.ui) || {};
    $("tlsSongSync").checked = u0.tl_scene_song_sync !== false;      // 2.377.0
    $("tlsNudge").value = c.frames;
    $("tlsNudgeShift").value = c.shift;
    $("tlsMsg").textContent = "";
    dlg._paint();
    if (!dlg.open) dlg.showModal();
    if (!(typeof tabId === "string" && tabId !== "general")) { $("tlsNudge").focus(); $("tlsNudge").select(); }
  }

  function save() {
    var f = parseInt($("tlsNudge").value, 10), s = parseInt($("tlsNudgeShift").value, 10);
    if (!(f >= 1 && f <= 240) || !(s >= 1 && s <= 240)) { $("tlsMsg").textContent = "use 1 to 240 frames"; return; }
    var ui = { tl_nudge_frames: f, tl_nudge_shift_frames: s, tl_scene_song_sync: $("tlsSongSync").checked };
    for (var i = 0; i < TABS.length; i++) {
      if (!TABS[i].read) continue;
      var r = TABS[i].read(dlg) || {};
      if (r.error) { $("tlsMsg").textContent = r.error; tab(TABS[i].id); return; }
      Object.assign(ui, r.ui || {});
    }
    $("tlsMsg").textContent = "saving…";
    fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ui: ui }) })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function () {
        try { if (typeof cfg === "object" && cfg) cfg.ui = Object.assign({}, cfg.ui || {}, ui); } catch (e) { /* next load */ }
        TABS.forEach(function (t) { if (t.saved) { try { t.saved(ui); } catch (e) { /* the tab's */ } } });
        if (typeof logLine === "function") logLine("[timeline] nudge: ← / → " + f + " frame" + (f === 1 ? "" : "s")
          + " (" + secs(f) + "), Shift " + s + " frames (" + secs(s) + ")");
        dlg.close();
      })
      .catch(function (e) { $("tlsMsg").textContent = "not saved: " + (e.message || e); });
  }

  $("tlSettings").addEventListener("click", function () { open(); });

  /* ← / → = nudge the selected clip */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (typeof tlSelClip === "undefined" || !tlSelClip || typeof window.tlNudgeSelected !== "function") return;
    if (!document.querySelector("#tlinner .clip.sel")) return;
    var a = document.activeElement;
    if (a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT|VIDEO|AUDIO)$/.test(a.tagName))) return;
    if (document.querySelector("dialog[open]") || document.querySelector(".tlpop")) return;
    var dock = $("timelinedock");
    if (dock && /dockgone|collapsed/.test(dock.className)) return;
    var c = conf();
    var n = (e.shiftKey ? c.shift : c.frames) * (e.key === "ArrowLeft" ? -1 : 1);
    e.preventDefault();
    window.tlNudgeSelected(n);
  });

  window.TimelineSettings = { open: open, conf: conf, addTab: addTab, tab: tab };
})();
