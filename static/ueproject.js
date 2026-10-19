/* bitGen Studio — static/ueproject.js (2.513.0): 🎮 LOAD UE PROJECT in the menu bar. window.H3UeProject.
 *
 * Tim (verbatim): "do we open the project in bitgen or unreal? add a load ue project button in the main menubar, open a
 * dialog to select the ue project folder then when user clicks select automatically add the plugin if not already there
 * and restart unreal".
 *
 *   🎮 (the menu bar, after 📦)   the folder dialog opens: pick your Unreal project's folder (the one with
 *                                 YourProject.uproject) and press Select - bitGen then, by itself:
 *                                   puts the bitGen Bridge plugin into <project>/Plugins/bitGenBridge (or updates it),
 *                                   switches on the plugins it needs in the .uproject,
 *                                   closes Unreal if it has that project open (it asks you to save) and starts it
 *                                   again with the project - Unreal's Output Log then says "[bitGen Bridge] listening".
 *                                 The Unreal project dialog shows each step, what the project has, ⟳ Restart Unreal,
 *                                 the editor's path (when it was not found), Test connection (Settings ▸ 3D's), and the
 *                                 projects used before.
 * The work is the app's (routes/ueProject.js -> lib/ueProject.js).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jpost(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.error || "HTTP " + r.status); return j; }); });
  }
  var local = function () { return !!(window.FileDialog && window.FileDialog.open && (!window.FileDialog.isLocalPage || window.FileDialog.isLocalPage())); };
  var CSS = "dialog.uepdlg{padding:0;border:1px solid var(--line,#3a342a);border-radius:10px;background:var(--panel,#1c1915);color:var(--text,#e8e2d6);width:min(600px,94vw);box-shadow:0 10px 40px rgba(0,0,0,.6)}"
    + ".uepdlg .uep-t{display:flex;align-items:center;height:36px;padding-left:14px;border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}"
    + ".uepdlg .uep-t h2{flex:1;margin:0;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase}"
    + ".uepdlg .uep-x{width:46px;height:36px;border:0;background:none;color:inherit;font-size:15px;cursor:pointer;border-radius:0 10px 0 0}.uepdlg .uep-x:hover{background:#c42b1c}"
    + ".uepdlg .uep-b{padding:10px 16px 14px;font-size:.78rem;max-height:74vh;overflow:auto}.uepdlg .uep-r{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:3px 0}"
    + ".uepdlg input[type=text]{flex:1;min-width:200px}.uepdlg .uep-d{color:var(--dim,#9a917f)}.uepdlg ol{margin:6px 0;padding-left:20px}.uepdlg li{padding:1px 0}"
    + ".uepdlg .uep-ok{color:var(--ok,#4ade80)}.uepdlg .uep-no{color:var(--bad,#f87171)}.uepdlg fieldset{border:1px solid var(--line,#3a342a);border-radius:6px;margin:8px 0;padding:6px 10px 8px}.uepdlg legend{font-weight:600;padding:0 4px}";
  var dlg = null, cur = null;
  function make() {
    if (dlg) return dlg;
    if (!$("uepCss")) { var st = document.createElement("style"); st.id = "uepCss"; st.textContent = CSS; document.head.appendChild(st); }
    dlg = document.createElement("dialog"); dlg.className = "uepdlg"; dlg.id = "uepDlg";
    dlg.innerHTML = '<div class="uep-t"><h2>🎮 Unreal project</h2><button type="button" class="uep-x" id="uepX" title="Close">✕</button></div><div class="uep-b">'
      + '<div class="uep-d">Open your project in <b>Unreal</b> - bitGen links to it through the bitGen Bridge plugin. Pick the project here and bitGen puts the plugin in, switches on what it needs and restarts Unreal with it.</div>'
      + '<div class="uep-r"><input type="text" id="uepPath" placeholder="the folder with YourProject.uproject (or the .uproject file)"><button type="button" id="uepBrowse">📂 Browse…</button></div>'
      + '<div class="uep-r"><select id="uepRecent" style="flex:1"><option value="">projects used before…</option></select></div>'
      + '<div class="uep-r"><label><input type="checkbox" id="uepOthers"> also close other Unreal windows (they may hold the bridge\'s port)</label></div>'
      + '<div class="uep-r"><button type="button" id="uepGo" title="Put the plugin in, switch on what it needs, (re)start Unreal with the project">✔ Select</button><button type="button" class="ghost" id="uepRestart" title="Only (re)start Unreal with this project">⟳ Restart Unreal</button><button type="button" class="ghost" id="uepTest" title="Is bitGen linked to Unreal now? (Settings ▸ 3D ▸ Unreal Engine)">Test connection</button></div>'
      + '<fieldset><legend>What happened</legend><ol id="uepSteps"><li class="uep-d">nothing yet</li></ol><div id="uepMsg"></div></fieldset>'
      + '<fieldset><legend>The project</legend><div id="uepInfo" class="uep-d">pick a project</div>'
      + '<div class="uep-r" id="uepEdRow" style="display:none"><span>UnrealEditor:</span><input type="text" id="uepEd" placeholder="…\\Engine\\Binaries\\Win64\\UnrealEditor.exe"><button type="button" class="ghost" id="uepEdB">📂</button><button type="button" class="ghost" id="uepEdSet">Use it</button></div></fieldset>'
      + "</div>";
    document.body.appendChild(dlg);
    dlg.addEventListener("keydown", function (e) { e.stopPropagation(); });
    $("uepX").onclick = function () { dlg.close(); };
    $("uepBrowse").onclick = function () { browse(); };
    $("uepGo").onclick = function () { go({}); };
    $("uepRestart").onclick = function () { go({ install: false, enable: false }); };
    $("uepTest").onclick = test;
    $("uepRecent").onchange = function () { if ($("uepRecent").value) { $("uepPath").value = $("uepRecent").value; inspect(); } };
    $("uepPath").onchange = inspect;
    $("uepEdB").onclick = function () { if (!local()) return; window.FileDialog.open({ mode: "file", title: "UnrealEditor", key: "ueeditor" }).then(function (r) { if (r && r.path) $("uepEd").value = r.path; }); };
    $("uepEdSet").onclick = function () { jpost("/api/ue/project/editor", { path: $("uepEd").value }).then(function () { msg("✓ the editor's path is kept"); return inspect(); }).catch(function (e) { msg("⚠ " + e.message, true); }); };
    return dlg;
  }
  function msg(t, bad) { var m = $("uepMsg"); if (m) { m.textContent = t; m.className = bad ? "uep-no" : ""; } }
  function steps(list) { $("uepSteps").innerHTML = (list || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") || '<li class="uep-d">nothing yet</li>'; }
  function paint(i) {
    cur = i;
    if (!i) { $("uepInfo").textContent = "pick a project"; return; }
    var p = i.plugin || {}, pl = (i.plugins || []).map(function (x) { return '<span class="' + (x.enabled ? "uep-ok" : "uep-no") + '">' + (x.enabled ? "✓ " : "✗ ") + esc(x.name) + "</span>"; }).join(" · ");
    $("uepInfo").innerHTML = "<b>" + esc(i.name) + "</b> · Unreal " + esc(i.engine || "?") + "<br>"
      + "bitGen Bridge: " + (p.installed ? '<span class="uep-ok">' + esc(p.version) + "</span>" + (p.needsUpdate ? ' <span class="uep-no">(' + esc(p.bundled) + " is newer)</span>" : "") : '<span class="uep-no">not in the project yet</span>') + "<br>"
      + "plugins: " + pl + "<br>"
      + "Unreal: " + (i.same ? '<span class="uep-ok">open with this project</span>' : "not open with this project") + (i.others ? " · " + i.others + " other window(s) open" : "") + "<br>"
      + "editor: " + (i.editor ? esc(i.editor) : '<span class="uep-no">not found - set its path below</span>');
    $("uepEdRow").style.display = i.editor ? "none" : "";
  }
  function inspect() {
    var p = $("uepPath").value.trim(); if (!p) return Promise.resolve(null);
    return jpost("/api/ue/project/inspect", { path: p }).then(function (i) { paint(i); return i; }).catch(function (e) { paint(null); msg("⚠ " + e.message, true); return null; });
  }
  function go(o) {
    var p = $("uepPath").value.trim(); if (!p) { msg("pick your Unreal project's folder first", true); return Promise.resolve(null); }
    msg(o.install === false ? "⟳ restarting Unreal…" : "⏳ putting the plugin in and restarting Unreal… (Unreal may ask you to save)");
    ["uepGo", "uepRestart"].forEach(function (id) { $(id).disabled = true; });
    return jpost("/api/ue/project/load", Object.assign({ path: p, closeOthers: $("uepOthers").checked }, o)).then(function (r) {
      steps(r.steps); paint(r); refreshRecent();
      msg(r.launched ? "✓ Unreal is starting - when its Output Log says “[bitGen Bridge] listening”, press Test connection" : r.waiting && r.waiting.length ? "Unreal is still open (answer its save question), then press ⟳ Restart Unreal" : "done");
      if (typeof logLine === "function") logLine("[unreal] " + (r.steps || []).join(" · "));
      return r;
    }).catch(function (e) { msg("⚠ " + e.message, true); return null; })
      .then(function (r) { ["uepGo", "uepRestart"].forEach(function (id) { $(id).disabled = false; }); return r; });
  }
  function test() {
    msg("checking…");
    return fetch("/api/unreal/status").then(function (r) { return r.json(); }).then(function (s) { msg(s.connected ? "✓ linked to Unreal " + (s.engine || "") + (s.level ? " · " + s.level : "") : "✕ not linked yet" + (s.error ? " - " + s.error : ""), !s.connected); })
      .catch(function (e) { msg("⚠ " + e.message, true); });
  }
  function refreshRecent() {
    return fetch("/api/ue/project").then(function (r) { return r.json(); }).then(function (j) {
      var s = $("uepRecent"); if (!s) return j;
      s.innerHTML = '<option value="">projects used before…</option>' + (j.recent || []).map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + "</option>"; }).join("");
      if (!$("uepPath").value && j.current) { $("uepPath").value = j.current; if (j.info) paint(j.info); }
      if (j.editor) $("uepEd").value = j.editor;
      return j;
    }).catch(function () { return null; });
  }
  /** the folder dialog; Select = everything at once */
  function browse() {
    if (!local()) { msg("type the project folder's path (the folder dialog only works on this computer's page)"); $("uepPath").focus(); return Promise.resolve(null); }
    return window.FileDialog.open({ mode: "dir", title: "Select your Unreal project's folder", okLabel: "Select", key: "ueproject", start: $("uepPath").value || undefined }).then(function (r) {
      if (!r || !(r.path || r.dir)) return null;
      $("uepPath").value = r.path || r.dir;
      return go({});
    });
  }
  /** 🎮 in the menu bar: the dialog + the folder dialog straight away */
  function open() {
    make(); if (!dlg.open) dlg.showModal();
    return refreshRecent().then(function () { return browse(); });
  }
  function button() {
    var bar = document.querySelector("#menubar .projbtns");
    if (!bar || $("projUe")) return;
    var b = document.createElement("button");
    b.className = "ghost"; b.id = "projUe"; b.type = "button"; b.textContent = "🎮";
    b.title = "Load UE project: pick your Unreal project's folder - the bitGen Bridge plugin goes in and Unreal restarts with it";
    b.setAttribute("aria-label", "Load UE project");
    b.addEventListener("click", open);
    var after = $("projBgp") || $("projSave");
    if (after && after.parentNode === bar) bar.insertBefore(b, after.nextSibling); else bar.appendChild(b);
  }
  window.H3UeProject = { open: open, go: go, inspect: inspect, test: test };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", button); else button();
  setTimeout(button, 1500);                                  // after 📦 (static/bgp.js) is in
})();
