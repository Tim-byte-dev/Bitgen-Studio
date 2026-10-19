/* pccadbar.js — the CAD TOOLBAR docked along the top of the image editor (2.470.0), window.PCCadBar.
 *
 * Tim (verbatim): "make the sketch toolbar a top docker like fusion 360 in image editor and timeline".
 *
 *   A ribbon over the tool options (static/cadbar.js draws it): tabs, groups of big buttons, "GROUP ▾" = all of a group.
 *     SKETCH   CREATE (New Sketch, Line, the rectangles, the circles, Arc, Polygon, Slot, Spline, Point)
 *              MODIFY (Fillet, Chamfer, Trim, Extend, Offset, Mirror, the patterns, Construction)
 *              CONSTRAINTS (12 small buttons: Coincident … Symmetric - they act on what is picked)
 *              INSPECT (Sketch Dimension, Measure) · INSERT (DXF in / out, SVG out) · FINISH SKETCH (+ Profiles → Shapes)
 *     SHAPES   SELECT (Move) · DRAW (the shape tools) · after drawing (the Move tool by itself - on / off)
 *   Later releases add tabs (E.cadBar.addTab - SOLID, UNREAL …). The tab follows the work: a sketch tool or a sketch
 *   layer picked -> SKETCH. ⚙ = after a shape is drawn, the Move tool (on / off); ⌃ folds it to its tabs.
 *   2.494.0 (Tim: "add a cad button in the edit image toolbar ... only show cad tools when the cad button is selected or a
 *   sketch is selected"): the ⌬ CAD button at the foot of the tool column (and Window ▸ CAD Toolbar) pins it on (store
 *   "cadbar.ie.on", off by default); without it the toolbar shows only while a sketch layer (or a sketch tool) or a 3D
 *   body is picked. SKETCH ▸ SELECT (Sketch Select, S) leads; Create Sketch hides while a sketch is being edited;
 *   Offset is a tool now (pick a chain, the pointer's side, click); Finish Sketch moves on to SOLID.
 * Pure (Node: scripts/test-cadbar.js): SPEC_IDS (the tool / command ids it uses), CONSTRAINTS, ICONS.
 */
(function (root) {
  "use strict";
  const sv = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
  const ICONS = {
    select: sv('<path d="M6 3l12 9-6 1 3 7-2 1-3-7-4 4z"/>'),
    cad: sv('<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M9 20v-6h6v6" stroke-dasharray="2 1.5"/><circle cx="12" cy="9" r="1.4"/>'),
    sketch: sv('<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M7 16l4-8 3 5 3-3"/>'),
    line: sv('<path d="M4 19L20 5"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="5" r="1.6"/>'),
    rect: sv('<rect x="4" y="6" width="16" height="12"/><circle cx="4" cy="6" r="1.4"/><circle cx="20" cy="18" r="1.4"/>'),
    rectc: sv('<rect x="4" y="6" width="16" height="12"/><circle cx="12" cy="12" r="1.4"/><circle cx="20" cy="18" r="1.4"/>'),
    circle: sv('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.3"/>'),
    circle2: sv('<circle cx="12" cy="12" r="8"/><circle cx="4" cy="12" r="1.3"/><circle cx="20" cy="12" r="1.3"/>'),
    circle3: sv('<circle cx="12" cy="12" r="8"/><circle cx="4" cy="12" r="1.3"/><circle cx="17.6" cy="6.3" r="1.3"/><circle cx="17.6" cy="17.7" r="1.3"/>'),
    arc: sv('<path d="M4 18A9 9 0 0 1 20 18"/><circle cx="4" cy="18" r="1.4"/><circle cx="20" cy="18" r="1.4"/><circle cx="12" cy="8.6" r="1.4"/>'),
    poly: sv('<path d="M12 3l8 5v8l-8 5-8-5V8z"/>'),
    slot: sv('<path d="M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7z"/>'),
    spline: sv('<path d="M3 17C7 3 11 21 15 9s5-2 6-2"/>'),
    point: sv('<circle cx="12" cy="12" r="2.4"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>'),
    fillet: sv('<path d="M4 20V12a8 8 0 0 1 8-8h8"/>'),
    chamfer: sv('<path d="M4 20V10l6-6h10"/>'),
    trim: sv('<path d="M4 12h6M14 12h6" /><path d="M12 4v16" stroke-dasharray="2 2"/><path d="M9 9l6 6M15 9l-6 6"/>'),
    extend: sv('<path d="M4 12h10"/><path d="M14 12h5" stroke-dasharray="2 2"/><path d="M20 5v14"/>'),
    offset: sv('<rect x="7" y="7" width="10" height="10"/><rect x="3" y="3" width="18" height="18" stroke-dasharray="2 2"/>'),
    mirror: sv('<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 7L4 17h5zM15 7l5 10h-5z"/>'),
    patrect: sv('<rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/>'),
    patcirc: sv('<circle cx="12" cy="12" r="8" stroke-dasharray="2 2"/><circle cx="12" cy="4" r="2"/><circle cx="19" cy="16" r="2"/><circle cx="5" cy="16" r="2"/>'),
    cons: sv('<path d="M4 20L20 4" stroke-dasharray="3 2"/>'),
    dim: sv('<path d="M4 8v8M20 8v8M4 12h16"/><path d="M7 10l-3 2 3 2M17 10l3 2-3 2"/>'),
    measure: sv('<path d="M3 16l13-13 5 5-13 13z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>'),
    dxfin: sv('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>'),
    dxfout: sv('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 19h16"/>'),
    finish: sv('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
    profiles: sv('<path d="M4 4h10v10H4z" fill="currentColor" fill-opacity=".25"/><path d="M10 10h10v10H10z"/>'),
    move: sv('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
    shape: sv('<rect x="4" y="4" width="16" height="16" rx="3"/>'),
    ellipse: sv('<ellipse cx="12" cy="12" rx="9" ry="6"/>'),
    star: sv('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
    spiral: sv('<path d="M12 12a1 1 0 0 1 2 0 3 3 0 0 1-6 0 5 5 0 0 1 10 0 7 7 0 0 1-14 0"/>'),
    grid: sv('<rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>'),
    custom: sv('<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/>'),
    pen: sv('<path d="M12 3l6 9-6 9-6-9z"/><circle cx="12" cy="12" r="1.5"/>'),
  };
  const CONSTRAINTS = [["coincident", "Coincident", "⊙"], ["collinear", "Collinear", "⋯"], ["concentric", "Concentric", "◎"], ["midpoint", "Midpoint", "⧗"],
    ["fix", "Fix", "🔒"], ["parallel", "Parallel", "∥"], ["perpendicular", "Perpendicular", "⟂"], ["horizontal", "Horizontal", "━"],
    ["vertical", "Vertical", "┃"], ["tangent", "Tangent", "◠"], ["equal", "Equal", "="], ["symmetric", "Symmetric", "⇹"]];
  const SPEC_IDS = { tools: ["sk_select", "sk_offset", "sk_line", "sk_rect", "sk_rectc", "sk_circle", "sk_circle2", "sk_circle3", "sk_arc", "sk_poly", "sk_slot", "sk_spline", "sk_point", "sk_fillet", "sk_chamfer", "sk_trim", "sk_extend", "sk_dim", "sk_measure", "move", "shape", "customshape", "crect", "cellipse", "cpolygon", "cstar", "cspiral", "cgraph", "line2", "pen"],
    commands: ["layer.newsketch", "sketch.importdxf", "sketch.exportdxf", "sketch.exportsvg", "sketch.finish", "sketch.profiles"] };

  function install(E) {
    const { S, store, doc } = E;
    const bar = E.$ ? E.$("kxBar") : null;
    if (!bar || !bar.parentNode) return;
    const go = () => {
      const CB = root.CadBar; if (!CB) return;
      const isSkTool = (t) => /^sk_/.test(t || "");
      const run = (id) => () => { if (E.ui.run) E.ui.run(id); };
      const can = (id) => () => { const c = E.ui.CMD && E.ui.CMD.get && E.ui.CMD.get(id); return !c || !c.enabled || !!c.enabled(); };
      const tool = (id, label, icon, key) => ({ id, label, icon, key, run: () => { if (!S.w && !isSkTool(id)) return E.say && E.say("open or make a picture first"); E.setTool(id); }, enabled: () => !!(id === "move" || E.tools[id] || (E.TOOLS || []).some((t) => (Array.isArray(t) ? t[0] : t && t.id) === id)), active: () => S.tool === id });
      const sk = () => E.sketch || {};
      const skOn = () => !!(sk().cur && sk().cur());
      const editing = () => skOn() && isSkTool(S.tool);                    // a sketch being edited (not just picked)
      const spec = { tabs: [
        { id: "sketch", label: "Sketch", groups: [
          { label: "Select", show: 1, items: [tool("sk_select", "Select", ICONS.select, "S")] },
          { label: "Create", show: 5, items: [
            { id: "c_newsketch", label: "Create Sketch", icon: ICONS.sketch, run: run("layer.newsketch"), hidden: editing },
            tool("sk_line", "Line", ICONS.line, "L"), tool("sk_rect", "2-Point Rectangle", ICONS.rect, "R"), tool("sk_circle", "Center Circle", ICONS.circle, "C"), tool("sk_arc", "3-Point Arc", ICONS.arc, "A"),
            { sep: true }, tool("sk_rectc", "Center Rectangle", ICONS.rectc), tool("sk_circle2", "2-Point Circle", ICONS.circle2), tool("sk_circle3", "3-Point Circle", ICONS.circle3),
            tool("sk_poly", "Polygon", ICONS.poly), tool("sk_slot", "Slot", ICONS.slot), tool("sk_spline", "Spline", ICONS.spline), tool("sk_point", "Point", ICONS.point, "P")] },
          { label: "Modify", show: 3, items: [
            tool("sk_fillet", "Fillet", ICONS.fillet, "F"), tool("sk_trim", "Trim", ICONS.trim, "T"), { id: "c_offset", label: "Offset", icon: ICONS.offset, key: "O", run: () => sk().offsetTool && sk().offsetTool(), enabled: skOn, active: () => S.tool === "sk_offset" },
            { sep: true }, tool("sk_chamfer", "Chamfer", ICONS.chamfer), tool("sk_extend", "Extend", ICONS.extend, "E"),
            { id: "c_mirror", label: "Mirror", icon: ICONS.mirror, run: () => sk().mirrorSel && sk().mirrorSel(), enabled: skOn },
            { id: "c_patrect", label: "Rectangular Pattern", icon: ICONS.patrect, run: () => sk().patternDialog && sk().patternDialog("rect"), enabled: skOn },
            { id: "c_patcirc", label: "Circular Pattern", icon: ICONS.patcirc, run: () => sk().patternDialog && sk().patternDialog("circ"), enabled: skOn },
            { id: "c_cons", label: "Construction", icon: ICONS.cons, key: "X", run: () => sk().toggleCons && sk().toggleCons(), enabled: skOn }] },
          { label: "Constraints", inline: true, items: CONSTRAINTS.map(([t, label, icon]) => ({ id: "k_" + t, label, icon, run: () => sk().constrain && sk().constrain(t), enabled: skOn })) },
          { label: "Inspect", show: 2, items: [tool("sk_dim", "Sketch Dimension", ICONS.dim, "D"), tool("sk_measure", "Measure", ICONS.measure, "M")] },
          { label: "Insert", show: 1, items: [{ id: "c_dxfin", label: "Insert DXF", icon: ICONS.dxfin, run: run("sketch.importdxf") },
            { id: "c_dxfproj", label: "Insert DXF from Project…", icon: ICONS.dxfin, run: run("sketch.importdxfproj") },
            { id: "c_dxfout", label: "Export DXF", icon: ICONS.dxfout, run: run("sketch.exportdxf"), enabled: can("sketch.exportdxf") },
            { id: "c_svgout", label: "Export SVG", icon: ICONS.dxfout, run: run("sketch.exportsvg"), enabled: can("sketch.exportsvg") }] },
          { label: "Finish Sketch", show: 2, items: [{ id: "c_finish", label: "Finish Sketch", icon: ICONS.finish, run: run("sketch.finish"), enabled: skOn },
            { id: "c_profiles", label: "Profiles → Shapes", icon: ICONS.profiles, run: run("sketch.profiles"), enabled: skOn }] },
        ] },
        { id: "shapes", label: "Shapes", groups: [
          { label: "Select", show: 1, items: [tool("move", "Move", ICONS.move, "V"), { id: "c_desel", label: "Pick Nothing", icon: "∅", key: "Esc", run: () => E.selHl && E.selHl.deselect() }] },
          { label: "Draw", show: 6, items: [tool("shape", "Shape", ICONS.shape, "U"), tool("crect", "Rectangle", ICONS.rect, "F6"), tool("cellipse", "Ellipse", ICONS.ellipse, "F7"),
            tool("cpolygon", "Polygon", ICONS.poly), tool("cstar", "Star", ICONS.star), tool("line2", "2-Point Line", ICONS.line),
            { sep: true }, tool("customshape", "Custom Shape", ICONS.custom), tool("cspiral", "Spiral", ICONS.spiral), tool("cgraph", "Graph Paper", ICONS.grid), tool("pen", "Pen", ICONS.pen, "P")] },
          { label: "After Drawing", show: 1, items: [{ id: "c_automove", label: "Then Move", icon: ICONS.move, run: () => E.selHl && E.selHl.autoMove(!E.selHl.autoMove()), active: () => !!(E.selHl && E.selHl.autoMove()) }] },
        ] },
      ] };
      const extra = [];
      const ui = CB.create(bar.parentNode, spec, { store, key: "cadbar.ie", right: [{ label: "After a shape is drawn: the Move tool (on / off)", icon: "⚙", run: () => { if (!E.selHl) return; const v = E.selHl.autoMove(!E.selHl.autoMove()); E.say && E.say(v ? "after drawing a shape: the Move tool, the shape picked" : "after drawing a shape: the tool stays"); ui.refresh(); } }] });
      bar.parentNode.insertBefore(ui.el, bar);                                     // over the tool options
      const pinned = () => store.get("cadbar.ie.on", false) === true;        // the ⌬ CAD button
      const isBodyL = (L) => !!(L && L.type === "smart" && L.smart && L.smart.body);
      const context = () => { if (!S.w) return isSkTool(S.tool); const L = E.layer(); return isSkTool(S.tool) || !!(L && L.type === "sketch" && L.sketch) || isBodyL(L); };
      const shown = () => pinned() || context();
      const btn = doc.createElement("button"); btn.type = "button"; btn.className = "ghost pccad"; btn.id = "pcCadBtn"; btn.innerHTML = ICONS.cad;
      btn.title = "CAD tools - the sketch / shapes / solid toolbar along the top (it also shows by itself while a sketch or a 3D body is picked)";
      const css = doc.createElement("style");
      css.textContent = ".kxtools .pccad{position:relative;width:32px;height:28px;padding:0;margin-top:4px;background:transparent;border:1px solid transparent;border-radius:3px;display:flex;align-items:center;justify-content:center;color:var(--pc-text);cursor:pointer;flex:none}"
        + ".kxtools .pccad svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.kxtools .pccad:hover{background:var(--pc-hover)}.kxtools .pccad.on{background:var(--pc-on);border-color:var(--pc-accent);color:#fff}";
      doc.head.appendChild(css);
      const col = E.$("kxTools"), sw = col && col.querySelector(".kxsw");
      if (col) { col.insertBefore(btn, sw || null); btn.style.display = "none"; }   // 2.513.0 (Tim: "hide the cad tool button"): Window ▸ CAD Toolbar switches it
      const show = () => { const v = shown(); ui.el.style.display = v ? "" : "none"; btn.classList.toggle("on", pinned()); return v; };
      btn.onclick = () => { store.set("cadbar.ie.on", !pinned()); show(); if (E.say) E.say(pinned() ? "CAD toolbar: on (⌬ again = only while a sketch / body is picked)" : "CAD toolbar: only while a sketch / body is picked"); };
      show();
      let seenTool = null, seenActive = null, seenSk = null;
      E.overlayHooks.push(() => {                                                  // drawOverlay runs on every tool / layer change
        const isSk = skOn();
        if (S.tool === seenTool && S.active === seenActive && isSk === seenSk) return;
        const toSketch = (isSkTool(S.tool) && !isSkTool(seenTool)) || (isSk && !seenSk);
        seenTool = S.tool; seenActive = S.active; seenSk = isSk;
        show();
        if (toSketch && ui.tab() !== "sketch") ui.setTab("sketch"); else ui.refresh();
      });
      E.cadBar = { ui, spec, addTab: (tab) => { extra.push(tab); ui.setSpec({ tabs: spec.tabs.concat(extra) }); }, show: (v) => { store.set("cadbar.ie.on", !!v); show(); }, shown, pinned, button: btn, update: show };
      if (E.ui.addCmd) E.ui.addCmd("win.cadbar", "CAD Toolbar", "", () => E.cadBar.show(!pinned()), { checked: pinned }, ["Window", "win.pcActions"]);
    };
    if (root.CadBar) go();
    else { const s = doc.createElement("script"); s.src = "/static/cadbar.js"; s.onload = go; doc.head.appendChild(s); }
  }
  const PCCadBar = { install, ICONS, CONSTRAINTS, SPEC_IDS };
  if (typeof module !== "undefined" && module.exports) module.exports = PCCadBar;
  else root.PCCadBar = PCCadBar;
})(typeof window !== "undefined" ? window : globalThis);
