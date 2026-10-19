/* bitGen Studio — the timeline's CAD TOOLBAR docked along the top of the preview row (2.470.0), window.TlCadBar.
 *
 * Tim (verbatim): "make the sketch toolbar a top docker like fusion 360 in image editor and timeline".
 *
 * The same ribbon as the image editor's (static/cadbar.js), over the tools + preview canvas + layers row:
 *   CREATE   LAYER (Text, 3D Text, 3D Model…) · CAMERA (Camera, Path) · SELECT (Move, Hand, Zoom, Fit, Select, Mask)
 *   3D       (a 3D layer picked) WIDGET (Move G / Rotate R / Scale S / none) · VIEW (front, left, right, top, bottom,
 *            back, no rotation) · KEY (◇ Key, 🧊 Bake) - the same buttons as the 3D bar
 *   SKETCH   Sketch on This Frame (the frame at the playhead opens in the image editor with a new sketch layer),
 *            Sketch on a Blank Picture (the timeline's size)
 *   Later releases add tabs (TlCadBar.addTab - SOLID, UNREAL …). The tab follows the work: a 3D layer picked -> 3D.
 *   ⌃ folds it to its tabs. 2.494.0 (Tim: "add a cad button in ... the video editor toolbox. only show cad tools when the
 *   cad button is selected"): the ⌬ CAD button in the canvas's tool column (#tlCadBtn, localStorage "tlcadbar.on", off
 *   by default) shows / hides it.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var mem = {
    get: function (k, d) { try { var v = localStorage.getItem("bg." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("bg." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  function ready() { try { return !!(window.TlCanvas && window.CadBar); } catch (e) { return false; } }
  var tries = 0;
  function boot() { if (!$("tlStage")) return; if (!ready()) { if (++tries < 300) setTimeout(boot, 60); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function start() {
    if ($("tlCadBar")) return;
    var C = window.TlCanvas, S = C.state, stage = $("tlStage");
    var click = function (sel) { return function () { var b = document.querySelector(sel); if (b) b.click(); }; };
    var tool = function (id, label, icon, key) {
      return { id: "t_" + id, label: label, icon: icon, key: key, run: function () { C.setTool(id); },
        enabled: function () { return id === "move" || id === "text" || id === "hand" || id === "zoom" || !!$("tlTool_" + id) || !!document.querySelector('[data-tltool="' + id + '"]'); },
        active: function () { return S.tool === id; } };
    };
    function sel3d() { var s = C.selClip && C.selClip(); return !!(s && s.c && s.c.m3d); }
    function add3d(type) { if (!window.TlM3D) return C.say("the 3D layers are not loaded"); window.TlM3D.add(type, null, { x: 0, y: 0 }); }
    function ie() { return window.imageEditorInstance && window.imageEditorInstance.E; }
    function showIE() {
      var d = $("imageeditdock");
      try {
        if (d && d.classList.contains("dockgone") && typeof window.toggleDockGone === "function") window.toggleDockGone("imageeditdock", "tIE");
        if (d && d.classList.contains("collapsed") && typeof window.toggleCollapse === "function") window.toggleCollapse("imageeditdock");
        if (d && d.scrollIntoView) d.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) { /* the docks */ }
    }
    /** the frame at the playhead (or a blank picture) -> the image editor, with a new sketch layer on it */
    function sketchOn(blank) {
      var E = ie(); if (!E || !E.sketch) { alert("The image editor is not loaded (its extension)."); return Promise.resolve(false); }
      var W = S.W || 1280, H = S.H || 720, name = "timeline-" + (blank ? "sketch" : "frame-" + (Math.round((S.t || 0) * 100) / 100) + "s") + ".png";
      var open = function (img) {
        E.openDoc(W, H, name, function (g) { g.fillStyle = "#ffffff"; if (blank) g.fillRect(0, 0, W, H); else if (img) g.drawImage(img, 0, 0, W, H); });
        E.sketch.newSketch(); showIE();
        if (E.cadBar && E.cadBar.ui) E.cadBar.ui.setTab("sketch");
        return true;
      };
      if (blank) return Promise.resolve(open(null));
      return new Promise(function (res) { var img = new Image(); img.onload = function () { res(open(img)); }; img.onerror = function () { res(open(null)); }; img.src = C.snapshot(); });
    }
    var spec = { tabs: [
      { id: "create", label: "Create", groups: [
        { label: "Layer", show: 3, items: [tool("text", "Text", "T", "T"),
          { id: "c_text3d", label: "3D Text", icon: "🔤", run: function () { add3d("text"); } },
          { id: "c_model", label: "3D Model…", icon: "🧊", run: function () { if (window.TlM3D && window.TlM3D.openMenu) window.TlM3D.openMenu(); } }] },
        { label: "Camera", show: 2, items: [tool("camera", "Camera", "🎥"), tool("path", "Path", "⤳", "Shift+P")] },
        { label: "Select", show: 4, items: [tool("move", "Move", "✥", "V"), tool("hand", "Hand", "✋", "H"), tool("zoom", "Zoom", "🔍", "Z"),
          { id: "c_fit", label: "Fit", icon: "⤢", run: click("#tlTool_fit") }, { sep: true }, tool("select", "Select", "⬚", "M"), tool("mask", "Mask", "🖌", "B")] },
      ] },
      { id: "3d", label: "3D", groups: [
        { label: "Widget", inline: true, items: [["move", "✥", "Move (G)"], ["rotate", "⟲", "Rotate (R)"], ["scale", "⤡", "Scale (S)"], ["off", "○", "No widget"]].map(function (m) {
          return { id: "w_" + m[0], label: m[2], icon: m[1], run: click('[data-t3mode="' + m[0] + '"]'), enabled: sel3d,
            active: function () { var b = document.querySelector('[data-t3mode="' + m[0] + '"]'); return !!(b && b.classList.contains("on")); } }; }) },
        { label: "View", inline: true, items: [["front", "⬛"], ["left", "◧"], ["right", "◨"], ["top", "⬒"], ["bottom", "⬓"], ["back", "↺"]].map(function (v) {
          return { id: "v_" + v[0], label: "View: " + v[0], icon: v[1], run: click('[data-t3view="' + v[0] + '"]'), enabled: sel3d }; })
          .concat([{ id: "v_zero", label: "No rotation", icon: "⟲0", run: click("#t3Zero"), enabled: sel3d }, { id: "v_spin", label: "Spin", icon: "⟳", run: click("#t3Spin"), enabled: sel3d }]) },
        { label: "Key", show: 2, items: [{ id: "k_key", label: "◇ Key", icon: "◇", run: click("#t3Key"), enabled: sel3d }, { id: "k_bake", label: "Bake", icon: "🧊", run: click("#t3Bake"), enabled: sel3d }] },
      ] },
      { id: "sketch", label: "Sketch", groups: [
        { label: "Sketch", show: 2, items: [{ id: "s_frame", label: "Sketch on This Frame", icon: "📐", run: function () { sketchOn(false); }, enabled: function () { return !!(ie() && ie().sketch); } },
          { id: "s_blank", label: "Sketch on a Blank Picture", icon: "▭", run: function () { sketchOn(true); }, enabled: function () { return !!(ie() && ie().sketch); } }] },
      ] },
    ] };
    var extra = [];
    var ui = window.CadBar.create(stage.parentNode, spec, { store: mem, key: "tlcadbar" });
    ui.el.id = "tlCadBar";
    stage.parentNode.insertBefore(ui.el, stage);
    var shown = function () { return mem.get("tlcadbar.on", false) === true; };
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "ghost"; btn.id = "tlCadBtn";
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M9 20v-6h6v6" stroke-dasharray="2 1.5"/><circle cx="12" cy="9" r="1.4"/></svg>';
    btn.title = "CAD tools - the Create / 3D / Sketch / Solid toolbar over the preview (on / off)"; btn.setAttribute("aria-label", "CAD tools");
    var tools = $("tlTools"); if (tools) { var seps = tools.querySelectorAll(".tlt-sep"); tools.insertBefore(btn, seps[0] || null); }
    btn.style.display = "none";                          // 2.513.0 (Tim: "hide the cad tool button"): the timeline's menu bar has ☐ CAD toolbar
    function paintShown() { var v = shown(); ui.el.style.display = v ? "" : "none"; btn.classList.toggle("on", v); return v; }
    btn.addEventListener("click", function () { mem.set("tlcadbar.on", !shown()); paintShown(); if (C.say) C.say(shown() ? "CAD toolbar on" : "CAD toolbar off"); });
    paintShown();
    var seenTool = null, seen3d = null;
    C.onDraw(function () {
      var is3d = sel3d();
      if (S.tool === seenTool && is3d === seen3d) return;
      var to3d = is3d && !seen3d; seenTool = S.tool; seen3d = is3d;
      if (to3d && ui.tab() !== "3d") ui.setTab("3d"); else ui.refresh();
    });
    window.TlCadBar = { ui: ui, spec: spec, sketchOn: sketchOn,
      addTab: function (tab) { extra.push(tab); ui.setSpec({ tabs: spec.tabs.concat(extra) }); },
      show: function (v) { mem.set("tlcadbar.on", !!v); paintShown(); }, shown: shown, button: btn };
  }
})();
