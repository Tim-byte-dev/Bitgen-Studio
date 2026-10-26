/* bitGen Studio — static/mesh3dctx.js (2.594.0): RIGHT-CLICK 🧊 CONVERT TO 3D (window.H3To3D).
 *
 * Tim (verbatim): "right click on an image in gallery, assets, reference or image-editor and convert to 3d using context
 * menu , the 3d model can go into image-editor or solidcraft docker" (Hi3D: "Skip Hi3D for now" - Hunyuan3D 2.1 /
 * TRELLIS.2 in ComfyUI, the engines the 🧊 buttons already use).
 *
 *   WHERE        a Gallery picture, an Assets ▸ Images picture (both by name: POST /api/mesh3d), a References ▸ Image
 *                picture, the image editor's canvas (its own right-click menu gets Convert Picture / Layer to 3D -
 *                E.ui.stageCtxItems, read by pcframes.js), its Layers panel and its Layer menu - those are SENT
 *                (POST /api/to3d/picture, kept in the project's images/)
 *   THE MENU     the engine (Hunyuan3D 2.1 - the shape, quick / TRELLIS.2 - textured) and where the model goes:
 *                the image editor (a 3D layer: Blender imports the .glb - move the camera, render, generate from it),
 *                the SolidCraft docker (opened as a new design), or just the project's models3d/
 *   THEN         the job runs in the queue; when it is done the .glb opens where you said (the job is followed here)
 * The picks are remembered (this browser). Pure (Node: scripts/test-to3d594.js): DESTS, ENGINES, menuHtml(o), cleanPick(p). */
(function (root) {
  "use strict";
  var DESTS = [["editor", "Image editor (a 3D layer)"], ["solidcraft", "SolidCraft docker"], ["save", "Just save it (models3d/)"]];
  var ENGINES = [["auto", "Hunyuan3D 2.1 - the shape (quick)"], ["trellis", "TRELLIS.2 - textured (slower)"]];
  var KEY = "to3d.pick";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function cleanPick(p) {
    var x = p || {};
    return { engine: ENGINES.some(function (e) { return e[0] === x.engine; }) ? x.engine : "auto",
             dest: DESTS.some(function (d) { return d[0] === x.dest; }) ? x.dest : "editor",
             part: x.part === "layer" ? "layer" : "all" };
  }
  /** the menu's inside - o = {title, pick, editor (true: the whole picture / the picked layer choice)} */
  function menuHtml(o) {
    var p = cleanPick(o.pick);
    var radios = function (name, list, v) {
      return list.map(function (x) { return '<label class="t3r"><input type="radio" name="' + name + '" value="' + x[0] + '"' + (x[0] === v ? " checked" : "") + "> " + esc(x[1]) + "</label>"; }).join("");
    };
    return '<div class="t3h">🧊 Convert to 3D</div><div class="t3n" title="' + esc(o.title) + '">' + esc(o.title) + "</div>"
      + (o.editor ? '<div class="t3g">From</div>' + radios("t3part", [["all", "The whole picture"], ["layer", "The picked layer"]], p.part) : "")
      + '<div class="t3g">Engine</div>' + radios("t3eng", ENGINES, p.engine)
      + '<div class="t3g">Then open it in</div>' + radios("t3dest", DESTS, p.dest)
      + '<div class="t3b"><button type="button" class="ghost" data-t3="go" style="border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)">🧊 Convert</button>'
      + '<button type="button" class="ghost" data-t3="cancel">Cancel</button></div>';
  }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { DESTS: DESTS, ENGINES: ENGINES, menuHtml: menuHtml, cleanPick: cleanPick }; return; }

  var $ = function (id) { return document.getElementById(id); };
  function say(s) { try { if (typeof root.logLine === "function") root.logLine("[3D] " + s); } catch (e) { /* fine */ } }
  function tell(s) { say(s); try { if (typeof root.toast === "function") root.toast(s); } catch (e) { /* fine */ } }
  function oops(s) { say(s); try { if (typeof root.appAlert === "function") return root.appAlert(s); } catch (e) { /* fine */ } root.alert(s); }
  function remembered() { try { return cleanPick(JSON.parse(root.localStorage.getItem(KEY) || "{}")); } catch (e) { return cleanPick({}); } }
  function remember(p) { try { root.localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* fine */ } }
  function json(r) { return r.json().catch(function () { return {}; }).then(function (x) { if (!r.ok) throw new Error(x.error || ("HTTP " + r.status)); return x; }); }

  /* ---------------- what was right-clicked */
  function editorE() { var I = root.imageEditorInstance; return I && I.E; }
  function targetOf(ev) {
    var t = ev.target && ev.target.closest ? ev.target : null;
    if (!t) return null;
    var g = t.closest('.thumb[data-lb-kind="image"]');
    if (g && (g.dataset.lbName || g.dataset.name)) return { kind: "name", name: g.dataset.lbName || g.dataset.name, where: "output", title: g.dataset.lbName || g.dataset.name };
    var a = t.closest('.aitem[data-lb-kind="image"]');
    if (a && (a.dataset.lbName || a.dataset.name)) return { kind: "name", name: a.dataset.lbName || a.dataset.name, where: "images", title: a.dataset.lbName || a.dataset.name };
    var s = t.closest("#tray .slot");
    if (s && !s.classList.contains("add")) {
      var slots = Array.prototype.filter.call(s.parentNode.children, function (x) { return x.classList.contains("slot") && !x.classList.contains("add"); });
      var i = slots.indexOf(s), r = (typeof refs !== "undefined" && refs) ? refs[i] : null;   // eslint-disable-line no-undef
      var img = s.querySelector("img");
      if (!r && !img) return null;
      var nm = (r && r.file && r.file.name) || (r && r.name) || ("reference_" + (i + 1) + ".png");
      return { kind: "blob", title: "Reference " + (i + 1) + " - " + nm, name: nm, blob: function () { return r && r.file instanceof Blob ? Promise.resolve(r.file) : fetch((r && r.url) || img.src).then(function (x) { return x.blob(); }); } };
    }
    return null;                     // the image editor's canvas has its own right-click menu - its items are below (editorCmds)
  }
  function editorBlob(part) {
    var E = editorE();
    if (!E) return Promise.reject(new Error("the image editor is not open"));
    var c = null, nm = "editor";
    if (part === "layer") { var L = E.layer && E.layer(); if (!L || !L.canvas) return Promise.reject(new Error("pick a picture layer first")); c = L.canvas; nm = "layer_" + (L.name || "picture"); }
    else { c = E.flatten(); nm = (($("ieName") || {}).textContent || "picture").trim(); }
    return new Promise(function (res, rej) { c.toBlob(function (b) { if (b) res({ blob: b, name: nm }); else rej(new Error("could not read the picture")); }, "image/png"); });
  }

  /* ---------------- the menu */
  var menu = null;
  function close() { if (menu && menu.parentNode) menu.parentNode.removeChild(menu); menu = null; }
  function css() {
    if ($("to3dCss")) return;
    var st = document.createElement("style"); st.id = "to3dCss";
    st.textContent = "#to3dMenu{position:fixed;z-index:10000;background:var(--panel,#222);border:1px solid var(--line,#444);border-radius:7px;padding:8px 10px;"
      + "min-width:250px;max-width:320px;font-size:.76rem;box-shadow:0 6px 22px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:2px}"
      + "#to3dMenu .t3h{font-weight:600}#to3dMenu .t3n{opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}"
      + "#to3dMenu .t3g{margin-top:6px;opacity:.7;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em}"
      + "#to3dMenu .t3r{display:flex;gap:6px;align-items:center;cursor:pointer;padding:1px 0}#to3dMenu .t3b{display:flex;gap:6px;margin-top:8px}";
    document.head.appendChild(st);
  }
  function open(t, x, y) {
    close(); css();
    menu = document.createElement("div"); menu.id = "to3dMenu";
    menu.innerHTML = menuHtml({ title: t.title, pick: remembered(), editor: t.kind === "editor" });
    document.body.appendChild(menu);
    var w = menu.offsetWidth || 260, h = menu.offsetHeight || 280;
    menu.style.left = Math.max(4, Math.min(root.innerWidth - w - 4, x)) + "px";
    menu.style.top = Math.max(4, Math.min(root.innerHeight - h - 4, y)) + "px";
    menu.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    menu.addEventListener("contextmenu", function (e) { e.preventDefault(); e.stopPropagation(); });
    menu.querySelector('[data-t3="cancel"]').onclick = close;
    menu.querySelector('[data-t3="go"]').onclick = function () {
      var v = function (n) { var r = menu.querySelector('input[name="' + n + '"]:checked'); return r ? r.value : ""; };
      var p = cleanPick({ engine: v("t3eng"), dest: v("t3dest"), part: v("t3part") || remembered().part });
      remember(p); close();
      convert(t, p).catch(function (e) { oops("Convert to 3D: " + (e.message || e)); });
    };
    return menu;
  }

  /* ---------------- queue it, follow it, open it */
  function convert(t, p) {
    var q;
    if (t.kind === "name") q = fetch("/api/mesh3d", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: t.name, where: t.where, engine: p.engine }) }).then(json);
    else {
      var get = t.kind === "editor" ? editorBlob(p.part) : t.blob().then(function (b) { return { blob: b, name: t.name }; });
      q = get.then(function (g) { return fetch("/api/to3d/picture?name=" + encodeURIComponent(g.name) + "&engine=" + encodeURIComponent(p.engine), { method: "POST", headers: { "Content-Type": g.blob.type || "image/png" }, body: g.blob }).then(json); });
    }
    return q.then(function (job) {
      var where = { editor: "the image editor", solidcraft: "SolidCraft", save: "models3d/" }[p.dest];
      tell("🧊 " + t.title + " -> " + job.model + " (job " + job.id + ") - it opens in " + where + " when it is done");
      if (typeof root.refreshJobs === "function") { try { root.refreshJobs(); } catch (e) { /* fine */ } }
      return follow(job.id).then(function () { return deliver(job.model, p.dest); });
    });
  }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function follow(id, ms) {
    var t0 = Date.now(), lim = ms || 3 * 3600 * 1000;
    return (function poll() {
      return fetch("/api/jobs/" + encodeURIComponent(id)).then(json).then(function (j) {
        if (j.status === "done") return j;
        if (j.status === "failed" || j.status === "cancelled") throw new Error("the 3D job " + j.status + " - its log is in the Queue");
        if (Date.now() - t0 > lim) throw new Error("the 3D job is still running - open its model from models3d/ when it is done");
        return sleep(4000).then(poll);
      });
    })();
  }
  function showDock(id, btn) {
    var d = $(id); if (!d) return false;
    try {
      if (d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone(id, $(btn));
      if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(id);
    } catch (e) { /* fine */ }
    return true;
  }
  function waitFor(fn, ms) {
    var t0 = Date.now();
    return (function poll() { var v = fn(); if (v) return Promise.resolve(v); if (Date.now() - t0 > (ms || 20000)) return Promise.resolve(null); return sleep(250).then(poll); })();
  }
  function deliver(model, dest) {
    if (dest === "save") { tell("🧊 " + model + " is in models3d/ (the .blend preview's ＋ Model, the timeline's 🧊 3D layers, 🧊 New 3D Layer)"); return Promise.resolve({ model: model }); }
    if (dest === "solidcraft") {
      if (!root.H3SolidCraft || !$("solidcraftdock")) throw new Error(model + " is in models3d/ - SolidCraft is not installed (Settings ▸ Add-ons ▸ SolidCraft)");
      showDock("solidcraftdock", "tX_solidcraftdock");
      return root.H3SolidCraft.ready(90000)
        .then(function () { return fetch("/api/tlcanvas/model/" + encodeURIComponent(model)); })
        .then(function (r) { if (!r.ok) throw new Error("could not read " + model); return r.blob(); })
        .then(function (b) { return root.H3SolidCraft.openFile(model, b); })
        .then(function () { tell("🧊 " + model + " opened in SolidCraft (a new design - 💾 Save to project keeps it)"); return { model: model, dest: "solidcraft" }; });
    }
    if (!showDock("imageeditdock", "tIE")) throw new Error(model + " is in models3d/ - the image editor is not installed (its extension)");
    if (typeof root.mountImageEditor === "function") { try { root.mountImageEditor(); } catch (e) { /* fine */ } }
    return waitFor(function () { var E = editorE(); return E && E.layer3d && E.layer3d.openScene ? E : null; }).then(function (E) {
      if (!E) throw new Error(model + " is in models3d/ - the image editor did not start");
      return E.layer3d.openScene(model).then(function (L) { tell("🧊 " + model + " is a 3D layer in the image editor - orbit it in the 🧊 3D tab"); return { model: model, dest: "editor", layer: L && L.id }; });
    });
  }

  /* ---------------- the image editor: its canvas right-click menu (Convert Picture / Layer to 3D) + the Layers panel's */
  var lastXY = null;
  function editorCmds() {
    var E = editorE();
    if (!E || !E.ui || !E.ui.addCmd || E.ui._to3d) return !!(E && E.ui && E.ui._to3d);
    E.ui._to3d = true;
    var at = function () { if (lastXY && Date.now() - lastXY.t < 5000) return lastXY; var r = ($("ieStage") || document.body).getBoundingClientRect(); return { x: r.left + 40, y: r.top + 40 }; };
    var go = function (part) {
      var L = E.layer && E.layer(), p = remembered(); p.part = part; remember(p);
      var xy = at();
      open({ kind: "editor", title: part === "layer" ? "Layer: " + ((L && L.name) || "picture") : (($("ieName") || {}).textContent || "the picture").trim() }, xy.x, xy.y);
    };
    E.ui.addCmd("pic.to3d", "🧊 Convert Picture to 3D…", "", function () { go("all"); }, { enabled: function () { return !!(E.S && E.S.w); } }, ["Layer", null, true]);
    E.ui.addCmd("layer.to3d", "🧊 Convert Layer to 3D…", "", function () { go("layer"); }, { enabled: function () { var L = E.layer && E.layer(); return !!(L && L.canvas); } }, ["Layer", "pic.to3d"]);
    E.ui.layerCtxItems = (E.ui.layerCtxItems || []).concat(["layer.to3d"]);
    E.ui.stageCtxItems = (E.ui.stageCtxItems || []).concat(["pic.to3d", "layer.to3d"]);
    return true;
  }

  function boot() {
    document.addEventListener("contextmenu", function (ev) { lastXY = { x: ev.clientX, y: ev.clientY, t: Date.now() }; }, true);   // where the editor's menu was opened
    document.addEventListener("contextmenu", function (ev) {
      if (ev.defaultPrevented || ev.shiftKey) return;            // Shift + right-click = the browser's own menu
      var t = targetOf(ev);
      if (!t) return;
      ev.preventDefault(); ev.stopPropagation();
      open(t, ev.clientX, ev.clientY);
    });
    document.addEventListener("pointerdown", function (e) { if (menu && !menu.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    var n = 0, iv = setInterval(function () { if (editorCmds() || ++n > 600) clearInterval(iv); }, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3To3D = { open: open, convert: convert, deliver: deliver, follow: follow, targetOf: targetOf, menuHtml: menuHtml, cleanPick: cleanPick, editorCmds: editorCmds, DESTS: DESTS, ENGINES: ENGINES, close: close };
})(typeof window !== "undefined" ? window : globalThis);
