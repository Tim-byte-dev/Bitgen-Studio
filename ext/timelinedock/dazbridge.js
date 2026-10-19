/* bitGen Studio — what the DAZ STUDIO bridge sent, and its MERGE dialog (2.405.0), window.TlDaz.
 *
 * Tim (verbatim): "can we have a daz3d to bitgen bridge?" and "can we add option to merge daz3d scene with blender scene
 * - create a dialog for list of objects, lights, cameras to merge. dialogs must have a titlebar".
 *
 * The bridge (daz/bitgen_bridge/bitGen Bridge.dsa, run in Daz Studio) sends to lib/dazBridge.js; this page watches
 * GET /api/daz/inbox and:
 *   - a render / a picture / a figure: a line in the log, the queue / gallery / assets refreshed
 *   - a scene opened on its own: the 🟧 .blend preview shows it (TlBlend.reload)
 *   - a scene sent to MERGE (and a .blend open here): the Merge dialog - a title bar (drag it; ✕ / Esc), the Daz
 *     scene's figures & objects, lights and cameras with a tick each (all / none per group), which camera becomes the
 *     scene camera, "stretch the frame range"; Merge = POST /api/daz/merge -> Blender appends the ticked ones (each with
 *     everything under it) into the open .blend and the preview reloads; "Open on its own" = POST /api/daz/open;
 *     Cancel = POST /api/daz/dismiss. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function j(r) { return r.json().then(function (x) { if (!r.ok) throw new Error(x.error || r.status); return x; }); }
  function post(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(j); }
  function log(s) { try { if (typeof logLine === "function") logLine("[daz] " + s); } catch (e) { /* fine */ } }
  var last = null, seen = {}, dlg = null, cur = null, timer = 0;
  var CSS = ""
    + "dialog.dzdlg{width:min(560px,94vw);padding:0;overflow:hidden;position:fixed;margin:0;z-index:10050;box-shadow:0 10px 40px rgba(0,0,0,.6)}"
    + ".dzdlg .dz-title{display:flex;align-items:center;gap:8px;height:36px;padding:0 0 0 14px;user-select:none;cursor:move;"
    + "border-bottom:1px solid var(--line,#3a342a);background:var(--panel-2,#26221b)}"
    + ".dzdlg .dz-title h2{margin:0;flex:1;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".dzdlg .dz-x{width:46px;height:36px;border:0;border-radius:0 10px 0 0;background:none;color:var(--text,#e8e2d6);font-size:15px;cursor:pointer}"
    + ".dzdlg .dz-x:hover{background:#c42b1c}"
    + ".dzdlg .dz-body{padding:10px 16px 14px;max-height:70vh;overflow:auto;font-size:.76rem}"
    + ".dzdlg .dz-sub{color:var(--dim,#9a917f);margin-bottom:8px}"
    + ".dzdlg fieldset{border:1px solid var(--line,#3a342a);border-radius:6px;margin:0 0 8px;padding:4px 8px 6px}"
    + ".dzdlg legend{padding:0 4px;font-weight:600}.dzdlg legend button{padding:0 6px;font-size:.66rem;margin-left:6px}"
    + ".dzdlg .dz-row{display:flex;gap:6px;align-items:center;padding:2px 0}.dzdlg .dz-row label{flex:1;display:flex;gap:6px;align-items:center;cursor:pointer}"
    + ".dzdlg .dz-t{color:var(--dim,#9a917f);font-size:.66rem}.dzdlg .dz-none{color:var(--dim,#9a917f);font-size:.7rem}"
    + ".dzdlg .dz-foot{display:flex;gap:6px;justify-content:flex-end;padding:8px 16px 14px;border-top:1px solid var(--line,#3a342a)}"
    + ".dzdlg select{max-width:100%}";
  function css() { if (!$("dzCss")) { var st = document.createElement("style"); st.id = "dzCss"; st.textContent = CSS; document.head.appendChild(st); } }

  /* ---------- the Merge dialog */
  var GROUPS = [["figures", "Figures & objects", ["figure", "mesh", "empty"]], ["lights", "Lights", ["light"]], ["cameras", "Cameras", ["camera"]]];
  function ensure() {
    css();
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "dzdlg"; dlg.id = "dzMergeDlg"; dlg.setAttribute("aria-label", "Merge the Daz scene");
    dlg.innerHTML = '<div class="dz-title" id="dzTitle"><h2>Merge the Daz scene</h2>'
      + '<button type="button" class="dz-x" id="dzClose" aria-label="Close" title="Close (keep it to merge later)">✕</button></div>'
      + '<div class="dz-body" id="dzBody"></div>'
      + '<div class="dz-foot"><button class="ghost" type="button" id="dzCancel" title="Do not merge it">Cancel</button>'
      + '<button class="ghost" type="button" id="dzOpen" title="Open the Daz scene in the preview instead of merging">Open on its own</button>'
      + '<button type="button" id="dzMerge">Merge</button></div>';
    document.body.appendChild(dlg);
    $("dzClose").onclick = function () { close(); };
    $("dzCancel").onclick = function () { var id = cur && cur.id; close(); if (id) post("/api/daz/dismiss", { id: id }).catch(function () { /* fine */ }); log("merge cancelled"); };
    $("dzOpen").onclick = function () { openOwn(); };
    $("dzMerge").onclick = function () { doMerge(); };
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); close(); });      // Esc (a modal dialog)
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dlg && dlg.open) { e.preventDefault(); close(); } });   // Esc (shown non-modal)
    drag($("dzTitle"));
    return dlg;
  }
  function drag(bar) {
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    bar.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      on = true; sx = e.clientX; sy = e.clientY;
      var r = dlg.getBoundingClientRect(); ox = r.left; oy = r.top;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", function (e) {
      if (!on) return;
      var x = Math.max(0, Math.min(window.innerWidth - 120, ox + e.clientX - sx)), y = Math.max(0, Math.min(window.innerHeight - 36, oy + e.clientY - sy));
      dlg.style.left = x + "px"; dlg.style.top = y + "px";
    });
    bar.addEventListener("pointerup", function () { on = false; });
  }
  function centre() {
    var w = Math.min(560, window.innerWidth * 0.94);
    dlg.style.left = Math.max(0, (window.innerWidth - w) / 2) + "px";
    dlg.style.top = Math.max(20, window.innerHeight * 0.12) + "px";
  }
  function close() { if (dlg && dlg.open) dlg.close(); cur = null; }
  function open(it) {
    ensure();
    cur = it;
    var objs = it.objects || [];
    var h = '<div class="dz-sub">From Daz: <b>' + esc(it.name) + '</b> · ' + objs.length + ' object(s) · ' + esc(it.fps) + ' fps'
      + (it.frames ? ' · frames ' + esc(it.frames[0]) + '–' + esc(it.frames[1]) : '') + '<br>into the open scene <b>' + esc(it.into || "") + '</b></div>';
    GROUPS.forEach(function (g) {
      var list = objs.filter(function (o) { return g[2].indexOf(o.type) >= 0; });
      h += '<fieldset data-g="' + g[0] + '"><legend>' + g[1] + ' (' + list.length + ')'
        + (list.length ? '<button class="ghost" type="button" data-all="' + g[0] + '">all</button><button class="ghost" type="button" data-none="' + g[0] + '">none</button>' : "")
        + '</legend>'
        + (list.length ? list.map(function (o) {
          return '<div class="dz-row"><label><input type="checkbox" data-obj="' + esc(o.name) + '" data-type="' + esc(o.type) + '" checked>'
            + '<span>' + esc(o.name) + '</span><span class="dz-t">' + esc(o.type) + (o.parts ? " · " + o.parts + " part(s)" : "") + (o.animated ? " · animated" : "") + "</span></label></div>";
        }).join("") : '<div class="dz-none">none in this scene</div>') + "</fieldset>";
    });
    h += '<div class="dz-row"><label for="dzCam" style="flex:none">Scene camera</label><select id="dzCam"></select></div>'
      + '<div class="dz-row"><label><input type="checkbox" id="dzRange" checked> Stretch the frame range to the Daz animation</label></div>';
    $("dzBody").innerHTML = h;
    Array.prototype.forEach.call($("dzBody").querySelectorAll("[data-all],[data-none]"), function (b) {
      b.onclick = function () {
        var g = b.dataset.all || b.dataset.none, on = !!b.dataset.all;
        Array.prototype.forEach.call($("dzBody").querySelectorAll('fieldset[data-g="' + g + '"] input[data-obj]'), function (x) { x.checked = on; });
        cams();
      };
    });
    Array.prototype.forEach.call($("dzBody").querySelectorAll("input[data-obj]"), function (x) { x.onchange = cams; });
    cams();
    if (!dlg.open) { dlg.show(); centre(); }
  }
  function picked() { return Array.prototype.filter.call($("dzBody").querySelectorAll("input[data-obj]"), function (x) { return x.checked; }); }
  function cams() {
    var sel = $("dzCam"); if (!sel) return;
    var was = sel.value;
    var cs = picked().filter(function (x) { return x.dataset.type === "camera"; }).map(function (x) { return x.dataset.obj; });
    sel.innerHTML = '<option value="">Keep the scene\'s own camera</option>' + cs.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + " (from Daz)</option>"; }).join("");
    if (cs.indexOf(was) >= 0) sel.value = was;
    $("dzMerge").disabled = !picked().length;
  }
  function busy(on, text) {
    ["dzMerge", "dzOpen", "dzCancel"].forEach(function (k) { if ($(k)) $(k).disabled = !!on; });
    if (on && $("dzMerge")) $("dzMerge").textContent = text || "Merging …"; else if ($("dzMerge")) $("dzMerge").textContent = "Merge";
  }
  function doMerge() {
    if (!cur) return Promise.resolve(null);
    var names = picked().map(function (x) { return x.dataset.obj; });
    if (!names.length) return Promise.resolve(null);
    var id = cur.id;
    busy(true, "Blender is merging …");
    return post("/api/daz/merge", { id: id, names: names, camera: $("dzCam").value || null, range: $("dzRange").checked }).then(function (r) {
      busy(false); close();
      log("merged from Daz: " + (r.merged || names).join(", ") + (r.notes && r.notes.length ? " · " + r.notes.join(" · ") : ""));
      return window.TlBlend && TlBlend.reload ? TlBlend.reload().then(function () { return r; }) : r;
    }).catch(function (e) { busy(false); alert("Merge failed: " + (e.message || e)); return null; });
  }
  function openOwn() {
    if (!cur) return Promise.resolve(null);
    var id = cur.id;
    busy(true, "Opening …");
    return post("/api/daz/open", { id: id }).then(function (st) {
      busy(false); close(); log("the Daz scene " + st.stem + " opened on its own");
      return window.TlBlend && TlBlend.reload ? TlBlend.reload() : st;
    }).catch(function (e) { busy(false); alert(String(e.message || e)); return null; });
  }

  /* ---------- the inbox */
  function handle(it) {
    var was = seen[it.id];
    seen[it.id] = it.state + "|" + (it.dismissed ? 1 : 0);
    if (was === seen[it.id]) return;
    if (it.state === "error") { log("✗ " + it.kind + " " + it.name + ": " + it.message); return; }
    if (it.state === "merge" && !it.dismissed) { if (!cur || cur.id !== it.id) open(it); return; }
    if (it.state !== "done") { if (it.message) log(it.kind + " " + it.name + ": " + it.message); return; }
    if (it.dismissed) return;
    log("✓ " + it.kind + " " + it.name + (it.message ? ": " + it.message : ""));
    try { if (typeof refreshJobs === "function" && it.job) refreshJobs(); } catch (e) { /* fine */ }
    try { if (it.picture && typeof refreshGallery === "function") refreshGallery(); } catch (e) { /* fine */ }
    try { if ((it.picture || it.video) && typeof refreshAssets === "function") refreshAssets(); } catch (e) { /* fine */ }
    if (it.kind === "scene" && it.opened && !it.merged && window.TlBlend && TlBlend.reload) TlBlend.reload();
  }
  function poll() {
    clearTimeout(timer);
    fetch("/api/daz/inbox?since=" + (last == null ? 0 : last)).then(j).then(function (r) {
      var first = last == null;
      last = r.seq;
      (r.items || []).forEach(function (it) {
        if (first && it.state !== "merge") { seen[it.id] = it.state + "|" + (it.dismissed ? 1 : 0); return; }   // old news
        handle(it);
      });
    }).catch(function () { /* the server restarts */ }).then(function () { timer = setTimeout(poll, document.hidden ? 8000 : 2500); });
  }
  function boot() { if (!$("tlCanvas")) return; poll(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.TlDaz = { poll: poll, open: open, merge: doMerge, openOwn: openOwn, close: close, state: function () { return { cur: cur, last: last }; } };
})();
