/* bitGen Studio — the timeline's SOLID tab: parametric 3D bodies on the timeline (2.471.0), window.TlBody.
 *
 * Tim (verbatim): "can we add fusion 360 style extrude, revolve, fillet, split to create new bodies 3d layers and make it
 * parametric like fusion 360?" - the bodies are made in the image editor (ext/imageeditdock/pcbody.js); here:
 *   SOLID ▸ Body → 3D Layer    a body of the image editor's picture -> a .glb in the project's 3D models -> a 🧊 3D layer
 *                              at the playhead (turn it, light it, key it like any 3D layer)
 *   SOLID ▸ Update Bodies      every body sent here built again and its 3D layers re-baked; it also happens by itself
 *                              each time the body changes in the image editor (the live link)
 *   SOLID ▸ Edit in Image Editor   the image editor with that body picked (its 🧊 Body tab)
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var tries = 0;
  function boot() { if (!$("tlStage")) return; if (!(window.TlCadBar && window.TlCadBar.addTab && window.TlM3D && window.H3M3D)) { if (++tries < 400) setTimeout(boot, 80); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  function ie() { return window.imageEditorInstance && window.imageEditorInstance.E; }
  function bodiesOf() { var E = ie(); return E && E.body ? E.S.layers.filter(E.body.isBody) : []; }
  /** a model file changed: loaded again, its layers baked again (as the Blender link does) */
  function reload(name) {
    var X = window.TlM3D, M = window.H3M3D;
    var using = X.all().filter(function (c) { return c.m3d && c.m3d.type === "model" && c.m3d.model === name; });
    if (!using.length) return 0;
    M.reload(name);
    using.forEach(function (c) { c.m3dBaked = null; X.schedule(c); });
    return using.length;
  }
  function start() {
    var C = window.TlCanvas, menu = null;
    function closeMenu() { if (menu) { menu.remove(); menu = null; } }
    document.addEventListener("pointerdown", function (e) { if (menu && !menu.contains(e.target)) closeMenu(); }, true);
    function pick(title, onPick) {
      closeMenu();
      var list = bodiesOf();
      if (!list.length) { C.say("no 3D bodies in the image editor's picture - make one there (SOLID ▸ Extrude a sketch)"); return; }
      menu = document.createElement("div"); menu.className = "cbmenu"; menu.id = "tlBodyMenu";
      menu.innerHTML = '<div class="mi dis"><b>' + title + "</b></div>" + list.map(function (L, i) { return '<div class="mi" data-i="' + i + '"><span class="ic">🧊</span><span>' + String(L.name).replace(/[<>&]/g, "") + "</span>" + (L.smart.body.tl ? '<span class="ky">on the timeline</span>' : "") + "</div>"; }).join("");
      document.body.appendChild(menu);
      var bar = $("tlCadBar"), r = bar ? bar.getBoundingClientRect() : { left: 40, bottom: 80 };
      menu.style.left = Math.max(4, r.left + 20) + "px"; menu.style.top = r.bottom + 2 + "px";
      menu.querySelectorAll("[data-i]").forEach(function (m) { m.onclick = function () { var L = list[+m.dataset.i]; closeMenu(); onPick(L); }; });
    }
    function toLayer(L) { var E = ie(); return E.body.toTimeline(L).then(function (n) { if (n) C.say("🧊 " + L.name + " → a 3D layer (" + n + ")"); return n; }); }
    function updateAll() {
      var E = ie(), list = bodiesOf().filter(function (L) { return L.smart.body.tl; });
      if (!list.length) { C.say("no bodies sent to the timeline yet (SOLID ▸ Body → 3D Layer)"); return Promise.resolve(0); }
      return list.reduce(function (p, L) { return p.then(function (n) { return E.body.pushTimeline(L).then(function (k) { return n + (k || 0); }); }); }, Promise.resolve(0))
        .then(function (n) { C.say("🧊 " + list.length + " bod" + (list.length === 1 ? "y" : "ies") + " updated - " + n + " 3D layer(s) re-baking"); return n; });
    }
    function editIn(L) {
      var E = ie(), d = $("imageeditdock");
      try { if (d && d.classList.contains("dockgone") && typeof window.toggleDockGone === "function") window.toggleDockGone("imageeditdock", "tIE"); if (d && d.classList.contains("collapsed") && typeof window.toggleCollapse === "function") window.toggleCollapse("imageeditdock"); } catch (e) { /* docks */ }
      E.setActive(E.S.layers.indexOf(L)); if (E.ui.showTab) E.ui.showTab("kbody");
      if (d && d.scrollIntoView) d.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    var sv = function (p) { return '<svg viewBox="0 0 24 24">' + p + "</svg>"; };
    window.TlCadBar.addTab({ id: "solid", label: "Solid", groups: [
      { label: "Bodies", show: 3, items: [
        { id: "b_add", label: "Body → 3D Layer", icon: sv('<path d="M5 15l7 4 7-4M5 15V9l7-4 7 4v6M12 19v-6M5 9l7 4 7-4"/>'), run: function () { pick("Which body?", toLayer); } },
        { id: "b_upd", label: "Update Bodies", icon: "⟳", run: updateAll },
        { id: "b_edit", label: "Edit in Image Editor", icon: "✎", run: function () { pick("Edit which body?", editIn); } }] },
    ] });
    window.TlBody = { reload: reload, updateAll: updateAll, toLayer: toLayer, pick: pick, bodies: bodiesOf };
  }
})();
