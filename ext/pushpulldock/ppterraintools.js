/* bitGen Studio — ext/pushpulldock/ppterraintools.js (2.653.0): THE ⛰ TERRAIN TOOL of the 📏 Sketcher (window.PPTerrainTools)
 * + its panel (#ppProps) - the ground's height field is ppterrain.js (M.arch.terrain).
 *
 * Tim (verbatim): "... and terrain elevation tools like contour lines and shape the ground to match the contours."
 * (agreed with Tim: contours + a sculpt brush + a heightmap image)
 *
 *   Alt+G  ⛰ Terrain - the first click on a model without ground makes one (round the building, just under its lowest floor);
 *      the panel picks what a press does:
 *        ⬆ Raise / ⬇ Lower   press and drag on the ground (Shift: the other way) - a soft round brush, Size + Strength
 *        ≈ Smooth            the bumps eased out          ▬ Flatten   toward the Flatten height (Alt+click the ground: take it)
 *        〰 Contour           click, click … a contour line at its Elevation (type one in the box) · back on its start = a
 *                            closed line · double-click / Enter ends an open one · the ground is shaped to the contours
 *                            (☑ Shape the ground after each line) and the next line's elevation goes up by Next +
 *                            a click on a drawn line picks it: its elevation / closed / 🗑 in the panel, Delete erases it
 *        ✂ Cut / fill (2.656.0) click a pad's corners on the ground, back on the first / double-click / Enter: inside flat at
 *                            its level (the ground's mean inside, or typed), batters out at 1 : n - cut down, filled up (or
 *                            one only); the cut / fill m³; a click picks a pad (level / batter / earthworks re-applied)
 *      [ / ] the brush smaller / bigger;  Esc drops a line being drawn (and, like every tool, goes to 🔄 Orbit)
 *   The panel also: ⛰ Shape the ground to the contours, 🖼 Heightmap picture… (grey: black = Lowest, white = Highest),
 *   ⌂ Level under the rooms (blended out over a margin), the ground's size / cell / place (its shape kept), its material,
 *   the contour interval, contour lines on the ground, earth sides, ▬ Flatten all, 🗑 Remove the ground.
 * create(ctx) -> {owns, use, down, move, up, dbl, vcb, key, escape, props, active, state, TOOLS, HINT, VCB}  (pptools.js) */
(function (root) {
  "use strict";
  const PT = () => root.PPTerrain, P = () => root.PPArch;
  const TOOLS = [["terrain", "⛰", "Terrain", "Alt+G"], ["pool", "🏊", "Pool", ""], ["drive", "🛣", "Driveway", ""]];   // 2.659.0: + 🛣   // 2.657.0: + 🏊 Pool (no key - every letter is taken)          // every letter is a tool already (G = Group) - Alt+G (ppdock.js)
  const MODES = [["raise", "⬆", "Raise"], ["lower", "⬇", "Lower"], ["smooth", "≈", "Smooth"], ["flatten", "▬", "Flatten"], ["contour", "〰", "Contour"], ["pad", "✂", "Cut / fill"]];   // 2.656.0: + cut / fill pads
  const HINTS = {
    raise: "⛰ Raise - press and drag on the ground (Shift: lower) · [ / ] the brush size · type a size in metres",
    lower: "⛰ Lower - press and drag on the ground (Shift: raise) · [ / ] the brush size · type a size in metres",
    smooth: "⛰ Smooth - drag over the ground to ease its bumps · [ / ] the brush size",
    flatten: "⛰ Flatten - drag toward the Flatten height (Alt+click the ground: take its height) · [ / ] the brush size",
    contour: "〰 Contour - click, click … a line at its elevation (type one) · back on its start = closed · double-click / Enter ends · click a line to pick it",
    pad: "✂ Cut / fill - click the corners of a level pad on the ground · back on the first (or double-click / Enter) = cut and filled · click a pad to pick it · type its level",
  };
  const HINT = { terrain: "Shape the ground - raise, lower, smooth, flatten with a brush, or draw contour lines and the ground follows them",
    drive: "🛣 Driveway - click its points along the way (it curves through them) · double-click / Enter ends · click a driveway to edit its curve: drag its points (□) and handles (○), Alt = one handle only, Delete = the point",
    pool: "🏊 Pool - click a corner, click the opposite corner (or type  8,4) - a pool with edge tiles or decking; Free shape: click its corners, back on the first" };
  const VCB = { terrain: "Size / Elevation", pool: "Length,Width", drive: "Width" };
  const OPT0 = { mode: "raise", r: 3, s: 0.15, target: 0, cz: 0, cstep: 0.5, auto: true, margin: 2, lo: 0, hi: 10, padAuto: true, padZ: 0, batter: 2, padMode: "both",
    driveW: 3, driveKerb: false,
    poolShape: "rect", poolAuto: true, poolZ: 0, shallow: 1.0, deep: 1.8, edge: "tiles", edgeW: 0.35, deckW: 1.5, poolLevel: true };   // 2.657.0

  function create(ctx) {
    const V = ctx.V;
    let on = false, st = {}, picked = null, pickedPad = null;            // pickedPad: 2.656.0
    const O = Object.assign({}, OPT0);
    try { const s = JSON.parse(root.localStorage.getItem("pp.terrainopt") || "{}"); Object.keys(OPT0).forEach((k) => { if (typeof s[k] === typeof OPT0[k]) O[k] = s[k]; }); } catch (e) { /* fine */ }
    const keepOpt = () => { try { root.localStorage.setItem("pp.terrainopt", JSON.stringify(O)); } catch (e) { /* fine */ } };
    const AR = () => P().of(ctx.model()), TR = () => AR().terrain || null, TV = () => (ctx.terrainView ? ctx.terrainView() : null);
    const owns = (n) => n === "terrain" || n === "pool" || n === "drive";
    let tname = null, editId = null;                                     // editId: 2.659.0 the driveway whose curve is shown                                                    // 2.657.0: which of them is on
    const fmt = (m) => (root.PPGeo && root.PPGeo.fmtLen ? root.PPGeo.fmtLen(m) : (+m).toFixed(2) + " m");
    const hint = () => HINTS[O.mode] || HINT.terrain;
    const before = () => ctx.snapshot();

    function ensure() {
      if (TR()) return TR();
      const b = before(), A = AR();
      A.terrain = PT().make(A, { cell: 0.5 });
      ctx.commit("ground", b);
      ctx.status("⛰ the ground - " + fmt(A.terrain.nx * A.terrain.cell) + " × " + fmt(A.terrain.ny * A.terrain.cell) + ", just under the lowest floor · " + hint());
      props(); return null;                                      // that click made it; the next one shapes it
    }
    function use(name) {
      const was = on; on = owns(name);
      if (!on) { tname = null; if (was) { drop(); const tv = TV(); if (tv) tv.ring(null); } return; }
      if (was && tname !== name) drop();
      tname = name; st = {}; picked = null; props();
      if (name === "pool") { const tv = TV(); if (tv) tv.ring(null); ctx.status(HINT.pool); return; }
      if (name === "drive") { const tv = TV(); if (tv) tv.ring(null); editId = null; ctx.status(HINT.drive); return; }
      ctx.status(TR() ? hint() : "⛰ Terrain - click anywhere to make the ground (round the building), then shape it · " + hint());
    }
    function drop() { const had = !!(st.draft || st.stroke || picked || pickedPad || editId != null); st = {}; picked = null; pickedPad = null; editId = null; const tv = TV(); if (tv) { tv.draft(null); if (tv.marks) tv.marks(null); } return had; }

    /* ---- where the pointer is */
    /** a contour's point: the ray on the plane at the line's height (the floorplan and the 3D view alike) */
    function planeAt(ev, z) {
      const r = V.ray(ev); if (Math.abs(r.d[2]) < 1e-6) return null;
      const t = (z - r.o[2]) / r.d[2]; if (t < 0) { const tv = TV(); const h = tv && tv.hit(ev); return h ? [h[0], h[1]] : null; }
      return [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t];
    }
    const pxTol = (p, z) => {                                    // 12 px as metres where p is on screen
      const a = V.screen([p[0], p[1], z]), b = V.screen([p[0] + 1, p[1], z]); const k = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return k > 1e-6 ? 12 / k : 0.4;
    };
    const zDraft = () => (st.draft ? st.draft.z : O.cz);

    /* ---- the brush */
    function dab(p, ev) {
      const t = TR(); if (!t) return 0;
      let mode = O.mode; if (ev && ev.shiftKey) mode = mode === "raise" ? "lower" : mode === "lower" ? "raise" : mode;
      const s = mode === "raise" || mode === "lower" ? O.s : Math.min(1, O.s * 3);
      return PT().brush(t, mode, p[0], p[1], O.r, s, O.target);
    }
    function down(ev) {
      if (tname === "pool") return poolDown(ev);
      if (tname === "drive") return driveDown(ev);
      if (!TR()) { ensure(); return; }
      if (O.mode === "contour") return contourDown(ev);
      if (O.mode === "pad") return padDown(ev);
      const tv = TV(), h = tv && tv.hit(ev);
      if (!h) { ctx.status("⛰ press on the ground (it is " + fmt(TR().nx * TR().cell) + " × " + fmt(TR().ny * TR().cell) + " - its size in the panel)"); return; }
      if (O.mode === "flatten" && ev.altKey) { O.target = Math.round(h[2] * 1000) / 1000; keepOpt(); props(); ctx.status("▬ the Flatten height is " + fmt(O.target) + " - drag to flatten toward it"); return; }
      st.stroke = { before: before(), last: [h[0], h[1]], n: 0 };
      st.stroke.n += dab(h, ev); if (tv) tv.update();
    }
    function move(ev) {
      const tv = TV(); if (!tv) return;
      if (tname === "drive") return driveMove(ev);
      if (tname === "pool") { if (st.draft) { const p = groundAt(ev); if (p) { st.draft.at = p; tv.draft(O.poolShape === "rect" ? rectRing(st.draft.pts[0], p) : st.draft.pts.concat([p, st.draft.pts[0]]), st.draft.z); } } return; }
      if (O.mode === "contour") {
        if (st.draft) { const p = planeAt(ev, st.draft.z); if (p) { st.draft.at = p; tv.draft(st.draft.pts.concat([p]), st.draft.z); } }
        return;
      }
      if (O.mode === "pad") { if (st.draft) { const p = groundAt(ev); if (p) { st.draft.at = p; tv.draft(st.draft.pts.concat([p, st.draft.pts[0]]), st.draft.z); } } return; }
      const h = tv.hit(ev); tv.ring(h, O.r);
      if (!st.stroke || !(ev.buttons & 1) || !h) return;
      const a = st.stroke.last, L = Math.hypot(h[0] - a[0], h[1] - a[1]), gap = Math.max(0.05, O.r * 0.25);
      if (L < gap) return;
      const n = Math.floor(L / gap);
      for (let k = 1; k <= n; k++) st.stroke.n += dab([a[0] + (h[0] - a[0]) * k / n, a[1] + (h[1] - a[1]) * k / n], ev);
      st.stroke.last = [h[0], h[1]]; tv.update();
    }
    function up() {
      if (st.ddrag) { const D = st.ddrag; st.ddrag = null; if (D.moved) ctx.commit("driveway", D.before); showMarks(); return; }
      const S = st.stroke; if (!S) return; st.stroke = null;
      if (S.n) { ctx.commit("sculpt", S.before); ctx.status("⛰ " + ({ raise: "raised", lower: "lowered", smooth: "smoothed", flatten: "flattened" }[O.mode] || "shaped") + " · ↶ undoes the stroke"); }
    }

    /* ---- contour lines */
    function contourDown(ev) {
      const tv = TV();
      if (!st.draft) {
        const p0 = planeAt(ev, O.cz); if (!p0) return;
        let near = null;                                           // a drawn line under the pointer - each looked for at its own height
        TR().contours.forEach((C) => { const q = planeAt(ev, C.z), x = q && PT().contourAt({ contours: [C] }, q, pxTol(q, C.z)); if (x && (!near || x.d < near.d)) near = x; });
        if (near && !ev.altKey) { picked = near.C.id; props(); ctx.status("〰 the " + PT().fmtZ(near.C.z) + " contour - its elevation in the panel · Delete erases it · Alt+click starts a new line on it"); return; }
        picked = null; st.draft = { z: O.cz, pts: [p0] }; tv.draft([p0, p0], O.cz); props();
        ctx.status("〰 a " + PT().fmtZ(O.cz) + " contour - click on … back on its start closes it · double-click / Enter ends it · type an elevation");
        return;
      }
      const p = planeAt(ev, st.draft.z); if (!p) return;
      const P0 = st.draft.pts[0], last = st.draft.pts[st.draft.pts.length - 1];
      if (st.draft.pts.length >= 3 && Math.hypot(p[0] - P0[0], p[1] - P0[1]) <= pxTol(P0, st.draft.z)) { finish(true); return; }
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-3) return;
      st.draft.pts.push(p); tv.draft(st.draft.pts.concat([p]), st.draft.z);
    }
    function finish(closed) {
      const D = st.draft; st.draft = null; const tv = TV(); if (tv) tv.draft(null);
      if (!D) return;
      const pts = D.pts.filter((p, i) => i === 0 || Math.hypot(p[0] - D.pts[i - 1][0], p[1] - D.pts[i - 1][1]) > 1e-3);
      if (pts.length < 2) { ctx.status("〰 a contour needs two points at least"); return; }
      const b = before(), t = TR(), C = PT().addContour(t, pts, D.z, closed);
      let shaped = null; if (O.auto) shaped = PT().fit(t);
      ctx.commit("contour", b);
      O.cz = Math.round((D.z + O.cstep) * 1000) / 1000; keepOpt(); picked = null; props();
      ctx.status("〰 the " + PT().fmtZ(C.z) + " contour" + (closed ? " (closed)" : "") + (shaped && shaped.held ? " - the ground shaped to " + t.contours.length + " contour" + (t.contours.length > 1 ? "s" : "") : "") + " · the next one at " + PT().fmtZ(O.cz));
    }
    function dbl() { if (tname === "drive") { if (st.draft && st.draft.kind === "drive") finishDrive(); return; } if (tname === "pool") { if (st.draft && O.poolShape === "free") finishPool(st.draft.pts); return; } if (O.mode === "contour" && st.draft) finish(false); else if (O.mode === "pad" && st.draft) finishPad(); }

    /* ---- 2.656.0: cut / fill pads (Tim: "can you add a cut/fill landscaping tool to sketcher") */
    /** a pad's corner: where the pointer meets the ground (else the plane at 0) */
    function groundAt(ev) { const tv = TV(), h = tv && tv.hit(ev); if (h) return [h[0], h[1]]; return planeAt(ev, 0); }
    function padDown(ev) {
      const tv = TV(), t = TR(), p = groundAt(ev); if (!p) return;
      if (!st.draft) {
        const q = !ev.altKey && PT().padAt(t, p, pxTol(p, PT().at(t, p[0], p[1])));
        if (q) { pickedPad = q.id; props(); ctx.status("✂ " + q.name + " at " + PT().fmtZ(q.z) + " - cut " + PT().fmtV(q.cut) + ", fill " + PT().fmtV(q.fill) + " · its level / batter in the panel · Delete forgets the outline · Alt+click starts a new pad on it"); return; }
        pickedPad = null; st.draft = { kind: "pad", z: PT().at(t, p[0], p[1]) + 0.05, pts: [p] }; tv.draft([p, p], st.draft.z); props();
        ctx.status("✂ click the pad's corners … back on the first (or double-click / Enter) cuts and fills it · " + (O.padAuto ? "its level: the ground's mean inside" : "level " + PT().fmtZ(O.padZ)));
        return;
      }
      const P0 = st.draft.pts[0], last = st.draft.pts[st.draft.pts.length - 1];
      if (st.draft.pts.length >= 3 && Math.hypot(p[0] - P0[0], p[1] - P0[1]) <= pxTol(P0, st.draft.z)) { finishPad(); return; }
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-3) return;
      st.draft.pts.push(p); tv.draft(st.draft.pts.concat([p, P0]), st.draft.z);
    }
    function finishPad() {
      const D = st.draft; st.draft = null; const tv = TV(); if (tv) tv.draft(null);
      if (!D) return;
      const pts = D.pts.filter((p, i) => i === 0 || Math.hypot(p[0] - D.pts[i - 1][0], p[1] - D.pts[i - 1][1]) > 1e-3);
      if (pts.length < 3) { ctx.status("✂ a pad needs three corners at least"); return; }
      const b = before(), q = PT().addPad(TR(), pts, { z: O.padAuto ? null : O.padZ, batter: O.batter, mode: O.padMode });
      ctx.commit("cut fill", b); pickedPad = q.id; props();
      ctx.status("✂ " + q.name + " at " + PT().fmtZ(q.z) + " - cut " + PT().fmtV(q.cut) + ", fill " + PT().fmtV(q.fill) + " (net " + PT().fmtV(Math.abs(q.cut - q.fill)) + (q.cut >= q.fill ? " to take away" : " to bring in") + ") · ↶ undoes it");
    }
    /** the picked pad levelled / sloped again on the ground as it is now */
    function rePad(fn) {
      const t = TR(), q = t && (t.pads || []).find((x) => x.id === pickedPad); if (!q) return;
      const b = before(); fn(q); PT().applyPad(t, q); ctx.commit("cut fill", b); props();
      ctx.status("✂ " + q.name + " at " + PT().fmtZ(q.z) + " - cut " + PT().fmtV(q.cut) + ", fill " + PT().fmtV(q.fill));
    }
    /* ---- 2.657.0: 🏊 pools (Tim: "a swimming pool creator(with edge tiles or decking)") - ppsite.js */
    const rectRing = (a, b) => { const R = root.PPSite.rect(a, b); return R.concat([R[0]]); };
    function poolDown(ev) {
      if (!root.PPSite) return;
      const p = groundAt(ev); if (!p) return;
      const t = TR(), zg = t ? PT().at(t, p[0], p[1]) : (O.poolAuto ? 0 : O.poolZ);
      if (!st.draft) { st.draft = { kind: "pool", z: zg + 0.05, pts: [p] }; const tv = TV(); if (tv) tv.draft([p, p], st.draft.z); ctx.status(O.poolShape === "rect" ? "🏊 click the opposite corner (or type  length,width)" : "🏊 click its corners … back on the first (or double-click / Enter)"); return; }
      if (O.poolShape === "rect") { const a = st.draft.pts[0]; if (Math.abs(p[0] - a[0]) < 0.3 || Math.abs(p[1] - a[1]) < 0.3) { ctx.status("🏊 too small - click further away"); return; } st.draft = null; finishPool(root.PPSite.rect(a, p)); return; }
      const P0 = st.draft.pts[0], last = st.draft.pts[st.draft.pts.length - 1];
      if (st.draft.pts.length >= 3 && Math.hypot(p[0] - P0[0], p[1] - P0[1]) <= pxTol(P0, st.draft.z)) { finishPool(st.draft.pts); return; }
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-3) return;
      st.draft.pts.push(p); const tv = TV(); if (tv) tv.draft(st.draft.pts.concat([p, P0]), st.draft.z);
    }
    function finishPool(pts) {
      st.draft = null; const tv = TV(); if (tv) tv.draft(null);
      const P = (pts || []).filter((p, i, L) => i === 0 || Math.hypot(p[0] - L[i - 1][0], p[1] - L[i - 1][1]) > 1e-3);
      if (P.length < 3) { ctx.status("🏊 a pool needs three corners at least"); return; }
      const A = AR(), t = TR(), b = before();
      let cx = 0, cy = 0; P.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= P.length; cy /= P.length;
      const z = t && O.poolAuto ? Math.round(PT().at(t, cx, cy) * 1000) / 1000 : O.poolAuto ? 0 : O.poolZ;
      const q = root.PPSite.make(A, P, { z, shallow: O.shallow, deep: Math.max(O.shallow, O.deep), edge: O.edge, edgeW: O.edgeW, deckW: O.deckW });
      if (!q) { ctx.status("🏊 that shape is too small"); return; }
      let pad = null;
      if (t && O.poolLevel) { pad = PT().addPad(t, root.PPSite.outer(q), { z: q.z - 0.03, batter: 2, mode: "both" }); if (pad) pad.name = q.name + " surround"; }   // the ground levelled round it
      ctx.commit("pool", b);
      const AT = ctx.arch ? ctx.arch() : null; if (AT && AT.setSel) AT.setSel({ ak: "pool", id: q.id });
      props();
      const S = root.PPSite.size(q);
      ctx.status("🏊 " + q.name + " - " + fmt(S.l) + " × " + fmt(S.w) + ", " + root.PPSite.volume(q) + " m³ of water" + (pad ? ", the ground levelled round it (cut " + PT().fmtV(pad.cut) + ", fill " + PT().fmtV(pad.fill) + ")" : "") + " · its settings: ➤ Select it · ↶ undoes it");
    }
    function poolProps(kit) {
      const { head, numIn, chkIn, btns, el, box, opt, row } = kit;
      const selIn = (label, val, opts, fn, id) => { const sl = el("select"); if (id) sl.id = id; opts.forEach(([v, tx]) => { const o2 = el("option", "", tx); o2.value = v; if (v === val) o2.selected = true; sl.appendChild(o2); }); sl.onchange = () => fn(sl.value); return row(label, sl); };
      head("🏊 Pool");
      selIn("Shape", O.poolShape, [["rect", "Rectangle (two corners)"], ["free", "Free shape (its corners)"]], (v) => { st.draft = null; const tv = TV(); if (tv) tv.draft(null); opt("poolShape")(v); }, "ppPoolShape");
      numIn("Shallow end (m)", O.shallow, opt("shallow"), 0.1, 0.2, 6, "ppPoolShallow");
      numIn("Deep end (m)", O.deep, opt("deep"), 0.1, 0.2, 6, "ppPoolDeep");
      selIn("Edge", O.edge, root.PPSite.EDGES, opt("edge"), "ppPoolEdge");
      if (O.edge === "tiles" || O.edge === "both") numIn("Edge tiles' width (m)", O.edgeW, opt("edgeW"), 0.05, 0.05, 2, "ppPoolEdgeW");
      if (O.edge === "deck" || O.edge === "both") numIn("Decking's width (m)", O.deckW, opt("deckW"), 0.1, 0.1, 10, "ppPoolDeckW");
      chkIn("Water's edge = the ground at its middle", O.poolAuto, opt("poolAuto"), "ppPoolAuto");
      if (!O.poolAuto) numIn("Water's edge at (m)", O.poolZ, opt("poolZ"), 0.05, -100, 1000, "ppPoolZ");
      chkIn("Level the ground round it", O.poolLevel, opt("poolLevel"), "ppPoolLevel");
      const n = (AR().pools || []).length;
      box.appendChild(el("div", "pphint", HINT.pool + (n ? " · " + n + " pool" + (n > 1 ? "s" : "") + " - ➤ Select one for its own settings (size, depths, materials, water)" : "")));
      void btns;
    }
    /* ---- 2.659.0: 🛣 driveways (Tim: "a driveway tool that can be adjusted with bezier curves") - ppsite.js */
    const editDrive = () => (editId != null ? (AR().drives || []).find((d) => d.id === editId) || null : null);
    const zOf = (d, p) => (d && !d.follow ? d.z : TR() ? PT().at(TR(), p[0], p[1]) : 0) + 0.06;
    function showMarks() {
      const tv = TV(), d = editDrive(); if (!tv || !tv.marks) return;
      if (!d) { tv.marks(null); return; }
      const lines = [], pts = [], rings = [], hot = [];
      d.nodes.forEach((n, i) => {
        const P = [n.p[0], n.p[1], zOf(d, n.p)]; (st.hotNode === i ? hot : pts).push(P);
        [["a", i > 0], ["b", i < d.nodes.length - 1]].forEach(([k, ok]) => { if (!ok) return; const H = [n.p[0] + n[k][0], n.p[1] + n[k][1], P[2]]; lines.push([P, H]); rings.push(H); });
      });
      const C = root.PPSite.path(d, 0.4).map((p) => [p[0], p[1], zOf(d, p)]); for (let i = 1; i < C.length; i++) lines.push([C[i - 1], C[i]]);
      tv.marks({ lines, pts, rings, hot });
    }
    /** what of the edited driveway is under the pointer (12 px): {node i} | {node i, h "a" | "b"} */
    function driveHit(ev) {
      const d = editDrive(); if (!d) return null;
      const r = V.canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top; let best = null;
      const near = (P, o) => { const s2 = V.screen(P); if (!(s2[2] < 1)) return; const dd = Math.hypot(s2[0] - mx, s2[1] - my); if (dd < 12 && (!best || dd < best.d)) best = Object.assign({ d: dd }, o); };
      d.nodes.forEach((n, i) => { const z = zOf(d, n.p); near([n.p[0], n.p[1], z], { i }); if (i > 0) near([n.p[0] + n.a[0], n.p[1] + n.a[1], z], { i, h: "a" }); if (i < d.nodes.length - 1) near([n.p[0] + n.b[0], n.p[1] + n.b[1], z], { i, h: "b" }); });
      return best;
    }
    /** a driveway under a plan point (within its width) */
    function driveAt(p) {
      let best = null;
      (AR().drives || []).forEach((d) => { root.PPSite.path(d, 0.4).forEach((c) => { const dd = Math.hypot(c[0] - p[0], c[1] - p[1]); if (dd <= d.w / 2 + 0.2 && (!best || dd < best.dd)) best = { d, dd }; }); });
      return best ? best.d : null;
    }
    function driveDown(ev) {
      if (!root.PPSite) return;
      const h = driveHit(ev);
      if (h && !st.draft) { st.hotNode = h.i; st.ddrag = Object.assign({ before: before(), moved: false, alt: ev.altKey }, h); showMarks(); ctx.status(h.h ? "🛣 drag the handle - the curve follows (Alt: this side only)" : "🛣 drag the point · Delete removes it"); return; }
      const p = groundAt(ev); if (!p) return;
      if (!st.draft) {
        const d = driveAt(p);
        if (d) { editId = d.id; st.hotNode = null; showMarks(); props(); ctx.status("🛣 " + d.name + " - drag its points (□) and handles (○) · Delete removes a point · click away to leave it"); return; }
        editId = null; showMarks();
        st.draft = { kind: "drive", z: (TR() ? PT().at(TR(), p[0], p[1]) : 0) + 0.05, pts: [p] }; const tv = TV(); if (tv) tv.draft([p, p], st.draft.z);
        ctx.status("🛣 click the next points along the way · double-click / Enter ends it"); return;
      }
      const last = st.draft.pts[st.draft.pts.length - 1]; if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.05) return;
      st.draft.pts.push(p); previewDrive(p);
    }
    function previewDrive(at) {
      const tv = TV(); if (!tv || !st.draft) return;
      const P = st.draft.pts.concat(at ? [at] : []);
      if (P.length < 2) { tv.draft([P[0], P[0]], st.draft.z); return; }
      const tmp = root.PPSite.makeDrive(null, P, { w: O.driveW }); if (tmp) tv.draft(root.PPSite.path(tmp, 0.4), st.draft.z);
    }
    function driveMove(ev) {
      if (st.draft && st.draft.kind === "drive") { const p = groundAt(ev); if (p) previewDrive(p); return; }
      const D = st.ddrag, d = editDrive(); if (!D || !d || !(ev.buttons & 1)) return;
      const p = groundAt(ev); if (!p) return;
      const n = d.nodes[D.i]; if (!n) return;
      if (!D.h) n.p = [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
      else {
        const v = [Math.round((p[0] - n.p[0]) * 1000) / 1000, Math.round((p[1] - n.p[1]) * 1000) / 1000];
        n[D.h] = v;
        if (!D.alt) { const o = D.h === "a" ? "b" : "a", L = Math.hypot(n[o][0], n[o][1]) || Math.hypot(v[0], v[1]), Lv = Math.hypot(v[0], v[1]) || 1; n[o] = [Math.round(-v[0] / Lv * L * 1000) / 1000, Math.round(-v[1] / Lv * L * 1000) / 1000]; }   // the other side turns with it, its length kept
      }
      D.moved = true; const av = ctx.archView && ctx.archView(); if (av) av.rebuild(); showMarks();
    }
    function finishDrive() {
      const D = st.draft; st.draft = null; const tv = TV(); if (tv) tv.draft(null);
      if (!D || D.pts.length < 2) { ctx.status("🛣 a driveway needs two points at least"); return; }
      const b = before(), d = root.PPSite.makeDrive(AR(), D.pts, { w: O.driveW, kerb: O.driveKerb, follow: true });
      if (!d) return;
      ctx.commit("driveway", b); editId = d.id; showMarks(); props();
      ctx.status("🛣 " + d.name + " - " + fmt(root.PPSite.driveLength(d)) + " long · drag its points (□) and handles (○) to shape it · ➤ Select it for its surface, kerbs");
    }
    function delNode() {
      const d = editDrive(); if (!d || st.hotNode == null) return;
      if (d.nodes.length <= 2) { ctx.status("🛣 a driveway keeps two points at least (🗑 Delete in its panel removes it)"); return; }
      const b = before(); d.nodes.splice(st.hotNode, 1); st.hotNode = null; ctx.commit("driveway", b); showMarks(); ctx.status("🛣 the point removed");
    }
    function driveProps(kit) {
      const { head, numIn, chkIn, btns, el, box, opt } = kit, d = editDrive();
      head("🛣 Driveway");
      if (d) {
        const ed = (fn) => (v) => { const b = before(); fn(v); ctx.commit("driveway", b); showMarks(); props(); };
        head("Editing " + d.name + " · " + fmt(root.PPSite.driveLength(d)));
        numIn("Width (m)", d.w, ed((v) => { d.w = v; }), 0.1, 0.5, 30, "ppDrvW");
        chkIn("Kerbs", d.kerb, ed((v) => { d.kerb = v; }), "ppDrvKerb");
        chkIn("On the ground", d.follow, ed((v) => { d.follow = v; }), "ppDrvFollow");
        btns([["〰 Smooth the curve", () => ed(() => root.PPSite.smooth(d))(), "Every handle made smooth through its neighbours", "ppDrvSmooth"], ["Done", () => { editId = null; showMarks(); props(); }, "", "ppDrvDone"]]);
        head("New driveways");
      }
      numIn("Width (m)", O.driveW, opt("driveW"), 0.1, 0.5, 30, "ppDrvNewW");
      chkIn("Kerbs", O.driveKerb, opt("driveKerb"), "ppDrvNewKerb");
      box.appendChild(el("div", "pphint", HINT.drive + " · its surface material: ➤ Select it"));
    }
    function forgetPad(id) { const t = TR(); if (!t) return; const b = before(); t.pads = (t.pads || []).filter((x) => x.id !== id); pickedPad = null; ctx.commit("cut fill", b); props(); ctx.status("✂ the pad's outline is gone - the ground keeps its shape (↶ brings it back)"); }

    /* ---- the keys and the box */
    function vcb(text) {
      if (tname === "drive") { const v = parseFloat(String(text).replace(",", ".")); if (!(v > 0)) return false; const d = editDrive(); if (d) { const b = before(); d.w = Math.min(30, v); ctx.commit("driveway", b); } else { O.driveW = Math.min(30, v); keepOpt(); } props(); ctx.status("🛣 " + fmt(v) + " wide"); return true; }
      if (tname === "pool") {                                            // 2.657.0: "8,4" = a pool that size from the first corner (or the view's middle)
        const m = String(text).split(/[;, x]+/).map((x) => parseFloat(x)).filter(Number.isFinite); if (m.length < 2 || m[0] <= 0 || m[1] <= 0) return false;
        const a = st.draft ? st.draft.pts[0] : [0, 0]; st.draft = null; finishPool([[a[0], a[1]], [a[0] + m[0], a[1]], [a[0] + m[0], a[1] + m[1]], [a[0], a[1] + m[1]]]); return true;
      }
      const v = parseFloat(String(text).replace(",", ".")); if (!Number.isFinite(v)) return false;
      if (O.mode === "pad") { if (pickedPad != null && !st.draft) { rePad((q) => { q.z = v; }); return true; } O.padZ = v; O.padAuto = false; keepOpt(); props(); ctx.status("✂ the next pad's level: " + PT().fmtZ(v)); return true; }
      if (O.mode === "contour") {
        if (st.draft) { st.draft.z = v; const tv = TV(); if (tv) tv.draft(st.draft.pts.concat(st.draft.at ? [st.draft.at] : []), v); }
        O.cz = v; keepOpt(); props(); ctx.status("〰 elevation " + PT().fmtZ(v)); return true;
      }
      if (v <= 0) return false;
      O.r = Math.min(100, v); keepOpt(); props(); ctx.status("⛰ the brush is " + fmt(O.r) + " across the middle"); return true;
    }
    function key(e) {
      if (!on) return false;
      if (e.key === "Enter" && st.draft && st.draft.kind === "drive") { finishDrive(); return true; }
      if ((e.key === "Delete" || e.key === "Backspace") && tname === "drive" && editId != null && st.hotNode != null) { delNode(); return true; }
      if (e.key === "Enter" && st.draft && st.draft.kind === "pool") { if (O.poolShape === "free") finishPool(st.draft.pts); return true; }
      if (e.key === "Enter" && st.draft) { if (st.draft.kind === "pad") finishPad(); else finish(false); return true; }
      if ((e.key === "Delete" || e.key === "Backspace") && pickedPad != null) { forgetPad(pickedPad); return true; }
      if ((e.key === "Delete" || e.key === "Backspace") && picked != null) { delContour(picked); return true; }
      if (e.key === "[" || e.key === "]") { O.r = Math.max(0.2, Math.min(100, Math.round(O.r * (e.key === "]" ? 1.25 : 0.8) * 100) / 100)); keepOpt(); props(); ctx.status("⛰ the brush: " + fmt(O.r)); return true; }
      return false;
    }
    function escape() { return drop(); }
    function delContour(id) {
      const t = TR(); if (!t) return; const b = before(), C = t.contours.find((c) => c.id === id); if (!C) return;
      t.contours = t.contours.filter((c) => c.id !== id); if (O.auto && t.contours.length) PT().fit(t);
      picked = null; ctx.commit("contour", b); props(); ctx.status("〰 the " + PT().fmtZ(C.z) + " contour erased");
    }

    /* ---- the panel */
    async function heightmap(file) {
      const t = TR(); if (!t || !file) return;
      let img; try { img = await root.createImageBitmap(file); } catch (e) { ctx.status("🖼 that picture could not be read: " + (e.message || e)); return; }
      const k = Math.min(1, 512 / Math.max(img.width, img.height)), w = Math.max(2, Math.round(img.width * k)), h = Math.max(2, Math.round(img.height * k));
      const c = root.document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data, grey = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) grey[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
      const b = before(); PT().fromImage(t, grey, w, h, O.lo, O.hi); ctx.commit("heightmap", b); props();
      ctx.status("🖼 the ground from " + file.name + " - " + fmt(O.lo) + " (black) to " + fmt(O.hi) + " (white) · ↶ undoes it");
    }
    function props() {
      if (!on) return;
      const box = root.document && root.document.getElementById("ppProps"); if (!box) return;
      box.innerHTML = ""; box.style.display = "block";
      const el = (tag, cls, txt) => { const e = root.document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
      const tog = el("button", "ghost pptog", box.classList.contains("open") ? "✕" : "⚙ Settings"); tog.type = "button"; tog.onclick = () => { box.classList.toggle("open"); props(); }; box.appendChild(tog);
      const head = (t) => box.appendChild(el("div", "pph", t));
      const row = (label, input, title) => { const r = el("label", "ppr"); r.appendChild(el("span", "", label)); r.appendChild(input); if (title) r.title = title; box.appendChild(r); return input; };
      const numIn = (label, val, fn, step, min, max, id) => { const i = el("input"); i.type = "number"; i.step = step || 0.1; if (min != null) i.min = min; if (max != null) i.max = max; i.value = +(+val).toFixed(3); if (id) i.id = id; i.onchange = () => { const v = parseFloat(i.value); if (Number.isFinite(v)) fn(min != null || max != null ? Math.min(max != null ? max : Infinity, Math.max(min != null ? min : -Infinity, v)) : v); }; return row(label, i); };
      const chkIn = (label, val, fn, id) => { const i = el("input"); i.type = "checkbox"; i.checked = !!val; if (id) i.id = id; i.onchange = () => fn(i.checked); return row(label, i); };
      const btns = (list) => { const r = el("div", "ppbtns"); list.forEach(([t, fn, tip, id]) => { const b = el("button", "ghost", t); b.type = "button"; if (tip) b.title = tip; if (id) b.id = id; b.onclick = fn; r.appendChild(b); }); box.appendChild(r); return r; };
      const opt = (k) => (v) => { O[k] = v; keepOpt(); props(); };
      const edit = (label, fn) => () => { const t = TR(); if (!t) return; const b = before(); const msg = fn(t); ctx.commit(label, b); props(); if (msg) ctx.status(msg); };
      if (tname === "pool") { poolProps({ head, numIn, chkIn, btns, el, box, opt, row }); if (ctx.resized) ctx.resized(); return; }
      if (tname === "drive") { driveProps({ head, numIn, chkIn, btns, el, box, opt, row }); if (ctx.resized) ctx.resized(); return; }
      const t = TR();
      head("⛰ Terrain");
      if (!t) {
        box.appendChild(el("div", "pphint", "No ground yet - click in the view (or the button) to make one round the building, just under its lowest floor."));
        btns([["＋ Make the ground", () => { ensure(); }, "A flat ground round the building", "ppTerMake"]]);
        return;
      }
      // what a press does
      const mr = el("div", "ppbtns"); mr.id = "ppTerModes";
      MODES.forEach(([m, ic, lb]) => { const b = el("button", "ghost" + (O.mode === m ? " on" : ""), ic + " " + lb); b.type = "button"; b.dataset.mode = m; b.onclick = () => { if (st.draft) { if (st.draft.kind === "pad") { st.draft = null; const tv0 = TV(); if (tv0) tv0.draft(null); } else finish(false); } O.mode = m; keepOpt(); props(); ctx.status(hint()); const tv = TV(); if (tv && (m === "contour" || m === "pad")) tv.ring(null); }; mr.appendChild(b); });
      box.appendChild(mr);
      if (O.mode === "pad") {                                            // 2.656.0
        const selIn = (label, val, opts, fn, id) => { const sl = el("select"); if (id) sl.id = id; opts.forEach(([v, tx]) => { const o2 = el("option", "", tx); o2.value = v; if (v === val) o2.selected = true; sl.appendChild(o2); }); sl.onchange = () => fn(sl.value); return row(label, sl); };
        const Q = pickedPad != null ? (t.pads || []).find((x) => x.id === pickedPad) : null;
        if (Q) {
          head("✂ " + Q.name);
          numIn("Level (m)", Q.z, (v) => rePad((q) => { q.z = v; }), 0.05, -1000, 5000, "ppPadZ");
          numIn("Batter 1 : (m across a m)", Q.batter, (v) => rePad((q) => { q.batter = v; }), 0.5, 0.2, 20, "ppPadBatter");
          selIn("Earthworks", Q.mode, [["both", "Cut and fill"], ["cut", "Cut only"], ["fill", "Fill only"]], (v) => rePad((q) => { q.mode = v; }), "ppPadMode");
          box.appendChild(el("div", "pphint", "Cut " + PT().fmtV(Q.cut) + " · fill " + PT().fmtV(Q.fill) + " · net " + PT().fmtV(Math.abs(Q.cut - Q.fill)) + (Q.cut >= Q.fill ? " to take away" : " to bring in") + " (the last time it was applied)"));
          btns([["⟳ Apply again", () => rePad(() => {}), "Cut and fill it again on the ground as it is now", "ppPadAgain"], ["🗑 Forget", () => forgetPad(Q.id), "Remove the pad's outline - the ground keeps its shape (Delete)", "ppPadForget"], ["Done", () => { pickedPad = null; props(); }]]);
          head("✂ New pads");
        }
        chkIn("Level = the ground's mean inside", O.padAuto, opt("padAuto"), "ppPadAuto");
        if (!O.padAuto) numIn("Level (m)", O.padZ, opt("padZ"), 0.05, -1000, 5000, "ppPadNewZ");
        numIn("Batter 1 : (m across a m)", O.batter, opt("batter"), 0.5, 0.2, 20, "ppPadNewBatter");
        selIn("Earthworks", O.padMode, [["both", "Cut and fill"], ["cut", "Cut only"], ["fill", "Fill only"]], opt("padMode"), "ppPadNewMode");
        const P = t.pads || []; let c = 0, f = 0; P.forEach((q) => { c += q.cut; f += q.fill; });
        box.appendChild(el("div", "pphint", P.length + " pad" + (P.length === 1 ? "" : "s") + (P.length ? " · cut " + PT().fmtV(c) + " · fill " + PT().fmtV(f) + " in all" : "")));
      } else if (O.mode !== "contour") {
        numIn("Brush size (m)", O.r, opt("r"), 0.5, 0.2, 100, "ppTerR");
        numIn(O.mode === "raise" || O.mode === "lower" ? "Strength (m)" : "Strength (0-1)", O.mode === "raise" || O.mode === "lower" ? O.s : Math.min(1, O.s * 3), (v) => opt("s")(O.mode === "raise" || O.mode === "lower" ? v : v / 3), 0.05, 0.01, O.mode === "raise" || O.mode === "lower" ? 5 : 1, "ppTerS");
        if (O.mode === "flatten") numIn("Flatten height (m)", O.target, opt("target"), 0.1, -1000, 5000, "ppTerTarget");
      } else {
        const C = picked != null ? t.contours.find((c) => c.id === picked) : null;
        if (C) {
          head("〰 Picked contour");
          numIn("Elevation (m)", C.z, (v) => edit("contour", (T) => { const c = T.contours.find((x) => x.id === picked); if (c) c.z = v; if (O.auto) PT().fit(T); return "〰 the contour is at " + PT().fmtZ(v); })(), 0.1, -1000, 5000, "ppTerCz");
          chkIn("Closed", C.closed, (v) => edit("contour", (T) => { const c = T.contours.find((x) => x.id === picked); if (c) c.closed = v && c.pts.length >= 3; if (O.auto) PT().fit(T); })(), "ppTerClosed");
          btns([["🗑 Delete", () => delContour(C.id), "Erase this contour line (Delete)", "ppTerDel"], ["Done", () => { picked = null; props(); }]]);
          head("〰 New lines");
        }
        numIn(st.draft ? "This line's elevation (m)" : "Elevation (m)", st.draft ? st.draft.z : O.cz, (v) => { if (st.draft) st.draft.z = v; opt("cz")(v); }, 0.1, -1000, 5000, "ppTerZ");
        numIn("Next line + (m)", O.cstep, opt("cstep"), 0.1, -100, 100, "ppTerStep");
        chkIn("Shape the ground after each line", O.auto, opt("auto"), "ppTerAuto");
        box.appendChild(el("div", "pphint", t.contours.length + " contour line" + (t.contours.length === 1 ? "" : "s") + " drawn"));
      }
      btns([["⛰ Shape to the contours", edit("contours", (T) => { const r = PT().fit(T); return r.held ? "⛰ the ground follows the " + T.contours.length + " contour line" + (T.contours.length > 1 ? "s" : "") : "⛰ no contour line is on the ground - draw some (〰 Contour)"; }), "The ground made smooth between the drawn contour lines, each at its height", "ppTerFit"],
        ["Clear the lines", edit("contours", (T) => { T.contours = []; picked = null; return "〰 the contour lines are gone (the ground keeps its shape)"; }), "Remove the drawn contour lines - the ground keeps its shape", "ppTerClear"]]);
      head("Heightmap picture");
      numIn("Lowest - black (m)", O.lo, opt("lo"), 0.5, -1000, 5000, "ppTerLo");
      numIn("Highest - white (m)", O.hi, opt("hi"), 0.5, -1000, 5000, "ppTerHi");
      const fi = el("input"); fi.type = "file"; fi.accept = "image/png, image/jpeg, image/webp, image/bmp"; fi.id = "ppTerFile"; fi.style.display = "none";
      fi.onchange = () => { const f = fi.files && fi.files[0]; fi.value = ""; if (f) heightmap(f); };
      box.appendChild(fi);
      btns([["🖼 Heightmap picture…", () => fi.click(), "A grey picture: black = Lowest, white = Highest (its top = north, +Y)", "ppTerHm"]]);
      head("The ground");
      numIn("Width (m)", t.nx * t.cell, (v) => edit("ground size", (T) => { Object.assign(T, PT().resample(T, { w: v })); })(), 1, 1, 2000, "ppTerW");
      numIn("Length (m)", t.ny * t.cell, (v) => edit("ground size", (T) => { Object.assign(T, PT().resample(T, { l: v })); })(), 1, 1, 2000, "ppTerL");
      numIn("Detail - cell (m)", t.cell, (v) => edit("ground size", (T) => { Object.assign(T, PT().resample(T, { cell: v })); return "⛰ a height every " + fmt(T.cell) + " (" + (T.nx + 1) + " × " + (T.ny + 1) + ")"; })(), 0.1, 0.1, 10, "ppTerCell");
      if (root.PPMatPick) {
        const PM = root.PPMatPick, b = el("button", "ghost ppmatbtn"); b.type = "button"; b.id = "ppTerMat"; b.appendChild(PM.swatch(t.col, 18, AR())); b.appendChild(el("span", "", " Ground"));
        b.title = "The ground's material - a colour, a material (grass, stone …) or a picture";
        b.onclick = () => PM.open(b, { A: AR(), value: t.col, title: "The ground",
          onPick: (v, add) => { const bf = before(); if (add) AR().tex = (AR().tex || []).concat([add]); TR().col = v; ctx.commit("ground", bf); props(); },
          onTex: (id, q) => { const bf = before(), x = (AR().tex || []).find((y) => y.id === id); if (x) Object.assign(x, q); ctx.commit("material", bf); props(); } });
        row("Material", b);
      }
      numIn("Contour interval (m)", t.step, (v) => edit("ground", (T) => { T.step = v; })(), 0.1, 0.05, 100, "ppTerInt");
      numIn("Darker every (lines)", t.major, (v) => edit("ground", (T) => { T.major = Math.round(v); })(), 1, 1, 20);
      chkIn("Contour lines on the ground", t.show, (v) => edit("ground", (T) => { T.show = v; })(), "ppTerShow");
      chkIn("Earth sides", t.sides, (v) => edit("ground", (T) => { T.sides = v; })(), "ppTerSides");
      numIn("Level margin (m)", O.margin, opt("margin"), 0.5, 0, 50, "ppTerMargin");
      btns([["⌂ Level under the rooms", edit("level", (T) => { const n = PT().level(T, AR(), O.margin); return n ? "⌂ the ground under the rooms is level, blended over " + fmt(O.margin) : "⌂ no room stands on the ground"; }), "Each room's ground levelled just under its floor, blended back over the margin", "ppTerLevel"],
        ["⊙ Centre on the building", edit("ground size", (T) => { const A2 = Object.assign({}, AR(), { terrain: null }), B = P().has(A2) ? P().bbox(A2) : null; if (!B) return "⊙ nothing is built yet"; Object.assign(T, PT().resample(T, { cx: (B.min[0] + B.max[0]) / 2, cy: (B.min[1] + B.max[1]) / 2 })); return "⊙ the ground is centred on the building"; }), "The ground moved so the building is in its middle (its shape kept where it overlaps)", "ppTerCentre"],
        ["▬ Flatten all", edit("ground", (T) => { const z = O.mode === "flatten" ? O.target : Math.min.apply(null, T.h); T.h = T.h.map(() => z); return "▬ the ground is flat at " + fmt(z); }), "Every height the same (the Flatten height in ▬ Flatten, else the lowest)", "ppTerFlatAll"],
        ["🗑 Remove the ground", edit("ground", () => { AR().terrain = null; return "🗑 the ground is gone (↶ brings it back)"; }), "Delete the ground (the building stays)", "ppTerRemove"]]);
      box.appendChild(el("div", "pphint", hint()));
      if (ctx.resized) ctx.resized();
    }
    return { owns, use, down, move, up, dbl, vcb, key, escape, props, tool: () => tname, finishPool, finishDrive, editing: () => editId, showMarks, active: () => on, state: () => st, picked: () => picked, opts: O, finish, TOOLS, HINT, VCB, MODES };
  }
  root.PPTerrainTools = { create, TOOLS, HINT, VCB, MODES, OPT0 };
})(typeof window !== "undefined" ? window : globalThis);
