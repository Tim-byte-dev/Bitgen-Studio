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
  const TOOLS = [["terrain", "⛰", "Terrain", "Alt+G"]];          // every letter is a tool already (G = Group) - Alt+G (ppdock.js)
  const MODES = [["raise", "⬆", "Raise"], ["lower", "⬇", "Lower"], ["smooth", "≈", "Smooth"], ["flatten", "▬", "Flatten"], ["contour", "〰", "Contour"], ["pad", "✂", "Cut / fill"]];   // 2.656.0: + cut / fill pads
  const HINTS = {
    raise: "⛰ Raise - press and drag on the ground (Shift: lower) · [ / ] the brush size · type a size in metres",
    lower: "⛰ Lower - press and drag on the ground (Shift: raise) · [ / ] the brush size · type a size in metres",
    smooth: "⛰ Smooth - drag over the ground to ease its bumps · [ / ] the brush size",
    flatten: "⛰ Flatten - drag toward the Flatten height (Alt+click the ground: take its height) · [ / ] the brush size",
    contour: "〰 Contour - click, click … a line at its elevation (type one) · back on its start = closed · double-click / Enter ends · click a line to pick it",
    pad: "✂ Cut / fill - click the corners of a level pad on the ground · back on the first (or double-click / Enter) = cut and filled · click a pad to pick it · type its level",
  };
  const HINT = { terrain: "Shape the ground - raise, lower, smooth, flatten with a brush, or draw contour lines and the ground follows them" };
  const VCB = { terrain: "Size / Elevation" };
  const OPT0 = { mode: "raise", r: 3, s: 0.15, target: 0, cz: 0, cstep: 0.5, auto: true, margin: 2, lo: 0, hi: 10, padAuto: true, padZ: 0, batter: 2, padMode: "both" };

  function create(ctx) {
    const V = ctx.V;
    let on = false, st = {}, picked = null, pickedPad = null;            // pickedPad: 2.656.0
    const O = Object.assign({}, OPT0);
    try { const s = JSON.parse(root.localStorage.getItem("pp.terrainopt") || "{}"); Object.keys(OPT0).forEach((k) => { if (typeof s[k] === typeof OPT0[k]) O[k] = s[k]; }); } catch (e) { /* fine */ }
    const keepOpt = () => { try { root.localStorage.setItem("pp.terrainopt", JSON.stringify(O)); } catch (e) { /* fine */ } };
    const AR = () => P().of(ctx.model()), TR = () => AR().terrain || null, TV = () => (ctx.terrainView ? ctx.terrainView() : null);
    const owns = (n) => n === "terrain";
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
      if (!on) { if (was) { drop(); const tv = TV(); if (tv) tv.ring(null); } return; }
      st = {}; picked = null; props();
      ctx.status(TR() ? hint() : "⛰ Terrain - click anywhere to make the ground (round the building), then shape it · " + hint());
    }
    function drop() { const had = !!(st.draft || st.stroke || picked || pickedPad); st = {}; picked = null; pickedPad = null; const tv = TV(); if (tv) tv.draft(null); return had; }

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
    function dbl() { if (O.mode === "contour" && st.draft) finish(false); else if (O.mode === "pad" && st.draft) finishPad(); }

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
    function forgetPad(id) { const t = TR(); if (!t) return; const b = before(); t.pads = (t.pads || []).filter((x) => x.id !== id); pickedPad = null; ctx.commit("cut fill", b); props(); ctx.status("✂ the pad's outline is gone - the ground keeps its shape (↶ brings it back)"); }

    /* ---- the keys and the box */
    function vcb(text) {
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
    return { owns, use, down, move, up, dbl, vcb, key, escape, props, active: () => on, state: () => st, picked: () => picked, opts: O, finish, TOOLS, HINT, VCB, MODES };
  }
  root.PPTerrainTools = { create, TOOLS, HINT, VCB, MODES, OPT0 };
})(typeof window !== "undefined" ? window : globalThis);
