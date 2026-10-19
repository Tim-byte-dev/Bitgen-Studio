/* bitGen Studio — static/bgp.js (2.436.0): the WHOLE PROJECT as one .bgp file (XML) - 📦 in the menu bar, beside 💾.
 *
 * Tim (verbatim): "save the overall project as .bgp in xml format" (+ "Both": self-contained OR a manifest, picked at
 * Save). The work is the server's (lib/bgProject.js, routes/bgp.js - it streams, a project can be gigabytes); this is
 * the dialog:
 *   SAVE   ◉ Self-contained (everything inside, the media too - one file to move to another computer) / ○ Manifest
 *          only (the project's files; its media listed where they are on this computer - small), ☐ the caches and
 *          previews too, the sizes it will be, then 💾 Save… - where (the Save As dialog, static/filedialog.js; a page
 *          not on this computer: the project's exports folder + a download). The project is saved first (💾's state).
 *   OPEN   📂 Open a .bgp… - what is in it, the name it opens as (a NEW project, never over one), Import; then
 *          "Open it now" switches to it (the page reloads on it, like 📂). Media a manifest names that are not on this
 *          computer are listed.
 *   window.H3Bgp = {open, save(mode, path, caches), importPath(path, as), estimate(caches), fmtSize}
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function fmtSize(n) { n = +n || 0; return n >= 1073741824 ? (n / 1073741824).toFixed(2) + " GB" : n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function jpost(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); });
  }
  var local = function () { return !!(window.FileDialog && window.FileDialog.isLocalPage && window.FileDialog.isLocalPage()); };
  var CSS = "dialog.bgpdlg{padding:0;border:1px solid var(--line,#3a342a);border-radius:10px;background:var(--panel,#1c1915);color:var(--text,#e8e2d6);width:min(560px,94vw);box-shadow:0 10px 40px rgba(0,0,0,.6)}"
    + ".bgpdlg .bgp-t{display:flex;align-items:center;height:36px;padding-left:14px;border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}"
    + ".bgpdlg .bgp-t h2{flex:1;margin:0;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase}"
    + ".bgpdlg .bgp-x{width:46px;height:36px;border:0;background:none;color:inherit;font-size:15px;cursor:pointer;border-radius:0 10px 0 0}.bgpdlg .bgp-x:hover{background:#c42b1c}"
    + ".bgpdlg .bgp-b{padding:10px 16px 14px;font-size:.78rem;max-height:72vh;overflow:auto}"
    + ".bgpdlg fieldset{border:1px solid var(--line,#3a342a);border-radius:6px;margin:0 0 10px;padding:6px 10px 8px}.bgpdlg legend{font-weight:600;padding:0 4px}"
    + ".bgpdlg .bgp-r{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:3px 0}.bgpdlg .bgp-d{color:var(--dim,#9a917f);font-size:.7rem}"
    + ".bgpdlg label.bgp-opt{display:block;padding:3px 0}.bgpdlg .bgp-msg{margin-top:4px;word-break:break-all}";
  var dlg = null, picked = null;

  function estimate(caches) { return fetch("/api/bgp/estimate" + (caches ? "?caches=1" : "")).then(function (r) { return r.json(); }); }
  function saveState() { try { if (typeof saveLeavingState === "function") return saveLeavingState(); } catch (e) { /* the .prj as it is */ } return Promise.resolve(); }
  /** mode: "embedded" | "manifest"; path: where (null = the project's exports folder) */
  function save(mode, path, caches) {
    return Promise.resolve(saveState()).then(function () { return jpost("/api/bgp/export", { mode: mode, path: path || undefined, caches: !!caches }); });
  }
  function importPath(path, as) { return jpost("/api/bgp/import", { path: path, as: as || undefined }); }
  function openProject(name) {
    return Promise.resolve(saveState()).then(function () { return jpost("/api/projects/load", { name: name }); })
      .then(function (j) { if (typeof freshReload === "function") freshReload(j.name, "opened from a .bgp"); else location.reload(); return j; });
  }

  function paintEstimate() {
    var c = $("bgpCaches") && $("bgpCaches").checked;
    estimate(c).then(function (e) {
      if (!$("bgpEst")) return;
      $("bgpEmbSz").textContent = "≈ " + fmtSize(e.embeddedBytes);
      $("bgpManSz").textContent = "≈ " + fmtSize(e.manifestBytes);
      $("bgpEst").textContent = e.files + " file(s) in \"" + e.project + "\" (" + fmtSize(e.bytes) + "), " + e.media + " of them media (" + fmtSize(e.mediaBytes) + ")";
    }).catch(function () {});
  }
  function doSave() {
    var mode = $("bgpModeMan").checked ? "manifest" : "embedded", caches = $("bgpCaches").checked, m = $("bgpSaveMsg");
    var proj = ($("projname") && $("projname").textContent.trim()) || "project";
    var where = local() && window.FileDialog.open
      ? window.FileDialog.open({ mode: "save", title: "Save the project as .bgp", okLabel: "Save", key: "bgp", name: proj + ".bgp", filters: [{ label: "bitGen project (*.bgp)", exts: ["bgp"] }] })
      : Promise.resolve({ path: null });
    where.then(function (r) {
      if (!r) return;
      var p = r.path ? (/\.bgp$/i.test(r.path) ? r.path : r.path + ".bgp") : null;
      m.textContent = "saving" + (mode === "embedded" ? " (the media go inside - this can take a while)" : "") + "…";
      $("bgpSave").disabled = true;
      return save(mode, p, caches).then(function (j) {
        m.innerHTML = "✓ " + esc(j.path) + " - " + fmtSize(j.size) + ", " + j.files + " file(s)" + (j.external ? ", " + j.external + " media file(s) listed (manifest)" : "")
          + (j.missing && j.missing.length ? " · ⚠ could not read: " + j.missing.map(esc).join(", ") : "")
          + (local() ? "" : ' · <a href="/api/bgp/file?path=' + encodeURIComponent(j.path) + '" download>⤓ download it</a>');
        if (typeof logLine === "function") logLine("[project] saved " + j.path + " (" + j.mode + ", " + fmtSize(j.size) + ")");
      });
    }).catch(function (e) { m.textContent = "⚠ " + e.message; }).then(function () { if ($("bgpSave")) $("bgpSave").disabled = false; });
  }
  function showPicked(info) {
    $("bgpInfo").innerHTML = '<div class="bgp-r"><b>' + esc(info.name || "?") + '</b><span class="bgp-d">' + (info.mode === "manifest" ? "manifest only" : "self-contained")
      + " · " + fmtSize(info.size) + (info.files ? " · " + info.files + " file(s)" : "") + (info.saved ? " · saved " + esc(String(info.saved).slice(0, 16).replace("T", " ")) : "") + (info.app ? " · bitGen " + esc(info.app) : "") + "</span></div>"
      + '<div class="bgp-r"><label>open as the new project <input type="text" id="bgpAs" style="width:200px"></label><button type="button" id="bgpImport">⤒ Import</button></div><div id="bgpImpMsg" class="bgp-d bgp-msg"></div>';
    $("bgpAs").value = info.suggest || info.name || "imported";
    $("bgpAs").addEventListener("keydown", function (e) { e.stopPropagation(); });
    $("bgpImport").onclick = doImport;
  }
  function doImport() {
    var as = $("bgpAs").value.trim(), m = $("bgpImpMsg");
    m.textContent = "importing…"; $("bgpImport").disabled = true;
    var go = picked.path ? importPath(picked.path, as)
      : fetch("/api/bgp/upload?as=" + encodeURIComponent(as), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: picked.file })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j; }); });
    go.then(function (j) {
      m.innerHTML = "✓ the project \"" + esc(j.name) + "\": " + j.written + " file(s)" + (j.missing.length ? ' · ⚠ not on this computer: <span id="bgpMissing">' + j.missing.map(esc).join(", ") + "</span>" : "")
        + (j.notes || []).filter(function (x) { return !/missing/.test(x); }).map(function (x) { return " · " + esc(x); }).join("")
        + ' <button type="button" id="bgpOpenNow">📂 Open it now</button>';
      $("bgpOpenNow").onclick = function () { openProject(j.name); };
      if (typeof logLine === "function") logLine("[project] imported \"" + j.name + "\" from a .bgp (" + j.written + " files)");
    }).catch(function (e) { m.textContent = "⚠ " + e.message; }).then(function () { if ($("bgpImport")) $("bgpImport").disabled = false; });
  }
  function doPick() {
    if (local() && window.FileDialog.open) {
      window.FileDialog.open({ mode: "file", title: "Open a bitGen project (.bgp)", key: "bgp", filters: [{ label: "bitGen project (*.bgp)", exts: ["bgp"] }] }).then(function (r) {
        if (!r || !r.path) return;
        return jpost("/api/bgp/peek", { path: r.path }).then(function (info) { picked = { path: r.path }; showPicked(info); });
      }).catch(function (e) { $("bgpInfo").textContent = "⚠ " + e.message; });
      return;
    }
    $("bgpFile").click();
  }
  function build() {
    if (!$("bgpCss")) { var st = document.createElement("style"); st.id = "bgpCss"; st.textContent = CSS; document.head.appendChild(st); }
    dlg = document.createElement("dialog"); dlg.className = "bgpdlg"; dlg.id = "bgpDlg"; dlg.setAttribute("aria-label", "Project file (.bgp)");
    dlg.innerHTML = '<div class="bgp-t"><h2>📦 Project file (.bgp)</h2><button type="button" class="bgp-x" id="bgpClose" aria-label="Close" title="Close">✕</button></div><div class="bgp-b">'
      + '<fieldset><legend>💾 Save the whole project as a .bgp</legend>'
      + '<label class="bgp-opt"><input type="radio" name="bgpMode" id="bgpModeEmb" checked> <b>Self-contained</b> - everything inside, the media too: one file to move to another computer <span class="bgp-d" id="bgpEmbSz"></span></label>'
      + '<label class="bgp-opt"><input type="radio" name="bgpMode" id="bgpModeMan"> <b>Manifest only</b> - the project\'s files; its media listed where they are on this computer: small <span class="bgp-d" id="bgpManSz"></span></label>'
      + '<label class="bgp-opt"><input type="checkbox" id="bgpCaches"> the caches and previews too (bitGen re-makes them)</label>'
      + '<div class="bgp-d" id="bgpEst"></div>'
      + '<div class="bgp-r"><button type="button" id="bgpSave">💾 Save…</button><span class="bgp-d">XML: the project\'s state, timelines, chats and settings readable; the media as base64</span></div>'
      + '<div class="bgp-d bgp-msg" id="bgpSaveMsg"></div></fieldset>'
      + '<fieldset><legend>📂 Open a .bgp</legend><div class="bgp-r"><button type="button" id="bgpPick">📂 Open a .bgp…</button><span class="bgp-d">it becomes a new project (never over one)</span></div>'
      + '<input type="file" id="bgpFile" accept=".bgp" style="display:none"><div id="bgpInfo"></div></fieldset></div>';
    document.body.appendChild(dlg);
    $("bgpClose").onclick = function () { dlg.close(); };
    $("bgpCaches").onchange = paintEstimate;
    $("bgpSave").onclick = doSave;
    $("bgpPick").onclick = doPick;
    $("bgpFile").onchange = function () {
      var f = $("bgpFile").files && $("bgpFile").files[0]; $("bgpFile").value = ""; if (!f) return;
      f.slice(0, 65536).text().then(function (t) {
        var m = /<bitgen-project(\s[^>]*)?>/.exec(t); if (!m) throw new Error(f.name + " is not a .bgp file");
        var a = {}, re = /([\w.:-]+)="([^"]*)"/g, x; while ((x = re.exec(m[1] || ""))) a[x[1]] = x[2];
        picked = { file: f }; showPicked({ name: a.name, mode: a.mode, saved: a.saved, app: a.app, files: +a.files || null, size: f.size, suggest: a.name });
      }).catch(function (e) { $("bgpInfo").textContent = "⚠ " + e.message; });
    };
  }
  function open() {
    if (!dlg) build();
    $("bgpSaveMsg").textContent = ""; $("bgpInfo").innerHTML = ""; picked = null;
    if (!dlg.open) dlg.showModal();
    paintEstimate();
  }
  function button() {
    var bar = document.querySelector("#menubar .projbtns, #ldock .dockhead .projbtns");
    if (!bar || $("projBgp")) return;
    var b = document.createElement("button");
    b.className = "ghost"; b.id = "projBgp"; b.type = "button"; b.textContent = "📦";
    b.title = "Project file (.bgp): save the whole project as one XML file (self-contained or a manifest) / open one as a new project";
    b.setAttribute("aria-label", "Project file (.bgp)");
    b.addEventListener("click", open);
    var after = $("projSave");
    if (after && after.parentNode === bar) bar.insertBefore(b, after.nextSibling); else bar.appendChild(b);
  }
  window.H3Bgp = { open: open, save: save, importPath: importPath, estimate: estimate, openProject: openProject, fmtSize: fmtSize };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", button); else button();
})();
