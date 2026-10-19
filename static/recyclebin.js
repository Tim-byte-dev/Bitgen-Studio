/* bitGen Studio — the left dock's 🗑 RECYCLE BIN dialog and ↺ RESET PROJECT (2.374.0).
 *
 * Tim (verbatim): "add a recycle bin(icon only) button to the menubar in the left docker, create a dialog for the
 * recycle bin, add a menubar to the dialog, restore, delete, empty buttons to the menubar. add a titlebar to the
 * recycle bin dialog. add a reset button to the menubar in the left docker - delete the current project folder and
 * re-create it from the original name and description - this needs a verify msgbox".
 *
 * 🗑 opens a dialog: a TITLEBAR (🗑 Recycle bin — <project>, the item count and size, ✕), a MENUBAR (☐ all,
 * ↩ Restore, ✕ Delete, 🧹 Empty), and the bin's files (thumbnail, name, where it came from, when, size); click
 * selects (Ctrl / Shift extend), double-click restores. Delete and Empty ask first - they are for good.
 * ↺ asks (the verify box says exactly what goes), then POST /api/projects/reset and the page reopens on the
 * empty project (the core page's freshReload). Server: routes/recycleBin.js, lib/recycleBin.js, lib/projects.js.
 */
(function () {
  "use strict";
  var CSS = ""
    + "dialog.rbdlg{width:min(880px,94vw);height:min(620px,86vh);padding:0;display:flex;flex-direction:column;overflow:hidden}"
    + "dialog.rbdlg:not([open]){display:none}"
    + ".rbdlg .rb-title{display:flex;align-items:center;gap:8px;height:36px;padding:0 0 0 14px;flex:none;user-select:none;"
    + "border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}"
    + ".rbdlg .rb-title h2{margin:0;flex:1;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".rbdlg .rb-sum{color:var(--dim,#9a917f);font-size:.72rem;white-space:nowrap}"
    + ".rbdlg .rb-x{width:46px;height:36px;border:0;border-radius:0 10px 0 0;background:none;color:var(--text,#e8e2d6);font-size:15px;cursor:pointer}"
    + ".rbdlg .rb-x:hover{background:#c42b1c}"
    + ".rbdlg .rb-menu{display:flex;align-items:center;gap:4px;padding:5px 10px;flex:none;border-bottom:1px solid var(--line,#3a342a)}"
    + ".rbdlg .rb-menu button{padding:3px 10px;font-size:.76rem}"
    + ".rbdlg .rb-menu button:disabled{opacity:.4;cursor:default}"
    + ".rbdlg .rb-menu label{display:flex;align-items:center;gap:4px;font-size:.74rem;margin-right:6px;cursor:pointer}"
    + ".rbdlg .rb-sep{width:1px;height:18px;background:var(--line,#3a342a);margin:0 4px}"
    + ".rbdlg .rb-msg{margin-left:auto;color:var(--dim,#9a917f);font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}"
    + ".rbdlg .rb-list{flex:1;overflow:auto;padding:4px 0}"
    + ".rbdlg .rb-row{display:grid;grid-template-columns:22px 56px minmax(120px,1.4fr) minmax(90px,1fr) 128px 70px;gap:8px;"
    + "align-items:center;padding:3px 10px;font-size:.76rem;cursor:default;border-left:3px solid transparent}"
    + ".rbdlg .rb-row:hover{background:rgba(255,255,255,.04)}"
    + ".rbdlg .rb-row.sel{background:rgba(245,158,44,.14);border-left-color:var(--tiger,#f59e2c)}"
    + ".rbdlg .rb-row .rb-th{width:56px;height:32px;border-radius:3px;background:#000;object-fit:cover;display:flex;align-items:center;justify-content:center;font-size:16px}"
    + ".rbdlg .rb-row .rb-nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".rbdlg .rb-row .rb-from,.rbdlg .rb-row .rb-at,.rbdlg .rb-row .rb-sz{color:var(--dim,#9a917f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".rbdlg .rb-row .rb-sz{text-align:right}"
    + ".rbdlg .rb-hd{font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dim,#9a917f);cursor:default;"
    + "position:sticky;top:-4px;background:var(--panel,#1d1a15);z-index:1}"
    + ".rbdlg .rb-hd:hover{background:var(--panel,#1d1a15)}"
    + ".rbdlg .rb-empty{padding:40px;text-align:center;color:var(--dim,#9a917f);font-size:.82rem}";

  var dlg = null, items = [], sel = {}, anchor = -1, project = "";

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmtSize(n) {
    n = +n || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
    return (n / 1073741824).toFixed(2) + " GB";
  }
  function fmtAt(s) {
    var d = new Date(s);
    if (isNaN(d)) return "";
    var p = function (x) { return String(x).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function confirmBox(msg, title) {
    if (typeof window.appConfirm === "function") return window.appConfirm(msg, title);
    return Promise.resolve(window.confirm(msg));
  }
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._ok = r.ok; return j; }); });
  }
  function say(t) { var m = dlg && dlg.querySelector(".rb-msg"); if (m) { m.textContent = t || ""; m.title = t || ""; } }
  function picked() { return items.filter(function (e) { return sel[e.name]; }).map(function (e) { return e.name; }); }

  function style() {
    if ($("rbStyle")) return;
    var s = document.createElement("style"); s.id = "rbStyle"; s.textContent = CSS; document.head.appendChild(s);
  }

  function build() {
    if (dlg) return dlg;
    style();
    dlg = document.createElement("dialog");
    dlg.className = "rbdlg"; dlg.id = "rbDlg";
    dlg.setAttribute("aria-label", "Recycle bin");
    dlg.innerHTML =
      '<div class="rb-title" id="rbTitle"><h2>🗑 Recycle bin</h2><span class="rb-sum" id="rbSum"></span>'
      + '<button type="button" class="rb-x" id="rbClose" title="Close" aria-label="Close">✕</button></div>'
      + '<div class="rb-menu" id="rbMenu" role="toolbar" aria-label="Recycle bin">'
      + '<label title="Select everything"><input type="checkbox" id="rbAll" aria-label="Select all"> All</label>'
      + '<span class="rb-sep"></span>'
      + '<button type="button" class="ghost" id="rbRestore" title="Restore - put the selected files back where they came from">↩ Restore</button>'
      + '<button type="button" class="ghost" id="rbDelete" title="Delete - remove the selected files for good">✕ Delete</button>'
      + '<button type="button" class="ghost" id="rbEmpty" title="Empty the recycle bin - every file in it is deleted for good">🧹 Empty</button>'
      + '<span class="rb-msg" aria-live="polite"></span></div>'
      + '<div class="rb-list" id="rbList" role="listbox" aria-multiselectable="true" aria-label="Files in the recycle bin"></div>';
    document.body.appendChild(dlg);
    $("rbClose").addEventListener("click", function () { dlg.close(); });
    $("rbAll").addEventListener("change", function () {
      sel = {};
      if ($("rbAll").checked) items.forEach(function (e) { sel[e.name] = true; });
      paint();
    });
    $("rbRestore").addEventListener("click", restoreSel);
    $("rbDelete").addEventListener("click", deleteSel);
    $("rbEmpty").addEventListener("click", emptyBin);
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "Delete") { e.preventDefault(); deleteSel(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault(); sel = {}; items.forEach(function (x) { sel[x.name] = true; }); paint();
      }
    });
    return dlg;
  }

  function thumb(e) {
    var u = "/api/recyclebin/file/" + encodeURIComponent(e.name);
    if (e.kind === "image") return '<img class="rb-th" loading="lazy" alt="" src="' + u + '">';
    if (e.kind === "video") return '<video class="rb-th" muted preload="metadata" src="' + u + '#t=0.5"></video>';
    return '<span class="rb-th">' + (e.kind === "audio" ? "🎵" : "📄") + "</span>";
  }

  function paint() {
    if (!dlg) return;
    var n = picked().length;
    $("rbSum").textContent = items.length ? items.length + " item" + (items.length === 1 ? "" : "s") + " · "
      + fmtSize(items.reduce(function (s, e) { return s + (e.size || 0); }, 0)) : "empty";
    dlg.querySelector("h2").textContent = "🗑 Recycle bin" + (project ? " — " + project : "");
    $("rbRestore").disabled = !n; $("rbDelete").disabled = !n; $("rbEmpty").disabled = !items.length;
    $("rbAll").checked = !!items.length && n === items.length;
    $("rbAll").indeterminate = n > 0 && n < items.length;
    var L = $("rbList");
    if (!items.length) { L.innerHTML = '<div class="rb-empty">The recycle bin is empty.</div>'; return; }
    L.innerHTML = '<div class="rb-row rb-hd"><span></span><span></span><span>Name</span><span>From</span><span>Deleted</span><span style="text-align:right">Size</span></div>'
      + items.map(function (e, i) {
        return '<div class="rb-row' + (sel[e.name] ? " sel" : "") + '" role="option" aria-selected="' + (sel[e.name] ? "true" : "false")
          + '" data-i="' + i + '" title="' + esc(e.name) + (e.guessed ? " (binned before the bin kept records - restores to " + esc(e.from) + ")" : "") + '">'
          + '<input type="checkbox" tabindex="-1" aria-label="Select ' + esc(e.name) + '"' + (sel[e.name] ? " checked" : "") + ">"
          + thumb(e) + '<span class="rb-nm">' + esc(e.name) + "</span>"
          + '<span class="rb-from">' + esc(String(e.from || "").replace(/\/[^/]*$/, "/") || "—") + (e.guessed ? " ?" : "") + "</span>"
          + '<span class="rb-at">' + esc(fmtAt(e.at)) + '</span><span class="rb-sz">' + fmtSize(e.size) + "</span></div>";
      }).join("");
    Array.prototype.forEach.call(L.querySelectorAll(".rb-row[data-i]"), function (row) {
      row.addEventListener("click", function (ev) {
        var i = +row.getAttribute("data-i"), e = items[i];
        var box = ev.target && ev.target.tagName === "INPUT";
        if (ev.shiftKey && anchor >= 0) {
          var a = Math.min(anchor, i), b = Math.max(anchor, i);
          if (!ev.ctrlKey && !ev.metaKey) sel = {};
          for (var k = a; k <= b; k++) sel[items[k].name] = true;
        } else if (ev.ctrlKey || ev.metaKey || box) {
          if (sel[e.name]) delete sel[e.name]; else sel[e.name] = true;
          anchor = i;
        } else { sel = {}; sel[e.name] = true; anchor = i; }
        paint();
      });
      row.addEventListener("dblclick", function () {
        var e = items[+row.getAttribute("data-i")];
        sel = {}; sel[e.name] = true; restoreSel();
      });
    });
  }

  function load() {
    return fetch("/api/recyclebin").then(function (r) { return r.json(); }).then(function (j) {
      items = (j && j.items) || []; project = (j && j.project) || "";
      var keep = {};
      items.forEach(function (e) { if (sel[e.name]) keep[e.name] = true; });
      sel = keep; anchor = -1;
      paint();
    }).catch(function () { say("the recycle bin did not answer - is the app server running?"); });
  }

  function refreshPage() {
    try { if (typeof window.refreshAssets === "function") window.refreshAssets(); } catch (e) { /* page helper */ }
    try { if (typeof window.refreshGallery === "function") window.refreshGallery(); } catch (e) { /* page helper */ }
  }

  function restoreSel() {
    var names = picked();
    if (!names.length) return;
    say("restoring…");
    post("/api/recyclebin/restore", { names: names }).then(function (j) {
      if (!j._ok) { say(j.error || "restore failed"); return; }
      var r = j.restored || [];
      say("restored " + r.length + (r.length === 1 ? " file -> " + r[0].to : " files"));
      if (typeof window.logLine === "function")
        r.forEach(function (x) { window.logLine("[recycle bin] restored " + x.name + " -> " + x.to); });
      refreshPage();
      return load();
    });
  }

  function deleteSel() {
    var names = picked();
    if (!names.length) return;
    confirmBox("Delete " + (names.length === 1 ? '"' + names[0] + '"' : names.length + " files")
      + " for good?\n\nThey are removed from the recycle bin and cannot be restored.", "Delete for good")
      .then(function (ok) {
        if (!ok) return;
        return post("/api/recyclebin/delete", { names: names }).then(function (j) {
          say(j._ok ? "deleted " + (j.deleted || []).length + " file" + ((j.deleted || []).length === 1 ? "" : "s") : (j.error || "delete failed"));
          return load();
        });
      });
  }

  function emptyBin() {
    if (!items.length) return;
    confirmBox("Empty the recycle bin of \"" + project + "\"?\n\nAll " + items.length + " file"
      + (items.length === 1 ? "" : "s") + " (" + fmtSize(items.reduce(function (s, e) { return s + (e.size || 0); }, 0))
      + ") are deleted for good and cannot be restored.", "Empty the recycle bin")
      .then(function (ok) {
        if (!ok) return;
        return post("/api/recyclebin/empty", {}).then(function (j) {
          say(j._ok ? "emptied - " + (j.deleted || 0) + " file" + (j.deleted === 1 ? "" : "s") + " deleted" : (j.error || "empty failed"));
          return load();
        });
      });
  }

  function open() {
    build();
    say("");
    if (!dlg.open) dlg.showModal();
    load();
  }

  /* ↺ RESET PROJECT: the verify box names the project and what goes; the server deletes the folder and makes it
     again, empty, with the same name and description; the page then reopens on it (every docker empty).
     2.378.0 (Tim: "the reset project button doesn't work ... all the dockers should be cleared of everything including
     whats in the cache - it should be a new project"): the name comes from the SERVER (never a label that may be
     stale); the box says the project's queued / running jobs are stopped (they no longer refuse the reset); the page
     lets go of every video / sound it is playing or showing first (an open file cannot be deleted on Windows); the
     reopened page reports the stopped jobs, the cleared queue and any file that was still in use (h3.resetInfo). */
  function releaseMedia() {
    var n = 0;
    Array.prototype.forEach.call(document.querySelectorAll("video, audio"), function (m) {
      try {
        m.pause();
        if (m.getAttribute("src") || m.currentSrc || m.querySelector("source")) n++;
        m.removeAttribute("src");
        Array.prototype.forEach.call(m.querySelectorAll("source"), function (s) { s.remove(); });
        m.load();
      } catch (e) { /* next */ }
    });
    return n;
  }
  function resetBusy(on) {
    var b = $("projReset");
    if (b) { b.disabled = !!on; b.textContent = on ? "⏳" : "↺"; }
  }
  function resetProject() {
    var desc = (($("projdesc") || {}).textContent || "").trim();
    var name = "", busy = 0;
    return fetch("/api/projects").then(function (r) { return r.json(); }).catch(function () { return {}; })
      .then(function (pj) {
        name = String((pj && pj.current) || (($("projname") || {}).textContent || "")).trim();
        if (!name) return null;
        return fetch("/api/jobs").then(function (r) { return r.json(); }).catch(function () { return []; });
      })
      .then(function (jobs) {
        if (!name) return false;
        busy = (Array.isArray(jobs) ? jobs : []).filter(function (j) {
          return j && (j.status === "queued" || j.status === "running") && (!j.project || j.project === name);
        }).length;
        return confirmBox("Reset the project \"" + name + "\"?\n\n"
          + "The whole project folder is DELETED - scenes, songs, the prompt chat, characters, environments, references, "
          + "assets, the gallery, timelines and its recycle bin - and created again, empty, as \"" + name + "\""
          + (desc ? " with its description (" + desc.slice(0, 120) + (desc.length > 120 ? "…" : "") + ")" : "")
          + ". The queue's finished jobs of this project and their cached files are cleared too, and every docker starts empty."
          + (busy ? "\n\n" + busy + " job" + (busy === 1 ? " of this project is" : "s of this project are")
            + " still queued or running - " + (busy === 1 ? "it is" : "they are") + " stopped." : "")
          + "\n\nThis cannot be undone.", "Reset project");
      })
      .then(function (ok) {
        if (!ok) return;
        resetBusy(true);
        releaseMedia();
        return post("/api/projects/reset", { name: name }).then(function (j) {
          if (!j._ok) {
            resetBusy(false);
            if (typeof window.appNote === "function") window.appNote(j.error || "the reset failed", "Reset project");
            else window.alert(j.error || "the reset failed");
            return;
          }
          try {
            sessionStorage.setItem("h3.resetInfo", JSON.stringify({ name: j.name, stopped: j.stopped || 0,
              jobs_cleared: j.jobs_cleared || 0, leftover: j.leftover || [] }));
          } catch (e) { /* the note only */ }
          if (typeof window.freshReload === "function") window.freshReload(j.name, "reset");
          else location.reload();
        }, function (e) {
          resetBusy(false);
          if (typeof window.appNote === "function") window.appNote("the reset failed: " + (e && e.message || e), "Reset project");
        });
      });
  }

  function buttons() {
    var bar = document.querySelector("#menubar .projbtns, #ldock .dockhead .projbtns");
    if (!bar || $("projBin")) return;
    var bin = document.createElement("button");
    bin.className = "ghost"; bin.id = "projBin"; bin.type = "button"; bin.textContent = "🗑";
    bin.title = "Recycle bin - restore or delete the files this project moved to its recycle bin";
    bin.setAttribute("aria-label", "Recycle bin");
    bin.addEventListener("click", open);
    var rst = document.createElement("button");
    rst.className = "ghost"; rst.id = "projReset"; rst.type = "button"; rst.textContent = "↺";
    rst.title = "Reset project - delete this project's folder and create it again, empty, with the same name and description (asks first)";
    rst.setAttribute("aria-label", "Reset project");
    rst.addEventListener("click", resetProject);
    var before = $("openSettings");
    if (before && before.parentNode === bar) { bar.insertBefore(bin, before); bar.insertBefore(rst, before); }
    else { bar.appendChild(bin); bar.appendChild(rst); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buttons);
  else buttons();
  window.openRecycleBin = open;
  window.resetProject = resetProject;
})();
