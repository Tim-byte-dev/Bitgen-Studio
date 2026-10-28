/* pcwarp.js — THE IMAGE EDITOR'S TRANSFORMS: SKEW / DISTORT / PERSPECTIVE / WARP, PUPPET WARP, CONTENT-AWARE SCALE,
 * LIQUIFY (2.422.0), window.PCWarp.
 *
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first" - gap 3 of the Photoshop list. The maths is
 * pcmesh.js; smart objects (pcsmart.js) keep every one of these editable:
 *
 *   TRANSFORM   Edit ▸ Transform ▸ Skew / Distort / Perspective / Warp (and Ctrl+T on a smart object): a quad with 8
 *               handles - Free (move, scale - Shift keeps proportions -, rotate outside - Shift 15° steps), Skew (corners
 *               along their sides, sides slide), Distort (corners anywhere), Perspective (a corner and its partner
 *               mirror), Warp (a 4 x 4 Bézier grid: drag its points, or drag inside to bend it there; presets: arc,
 *               arch, bulge, flag, wave, fish, rise, inflate, squeeze). The options bar switches modes; Enter applies,
 *               Esc cancels. A pixel layer is re-drawn once (its selection's pixels when there is one); a smart object
 *               keeps the quad / warp and re-draws from its contents.
 *   PUPPET      Edit ▸ Puppet Warp: click to pin, drag a pin to bend (moving-least-squares rigid: what is between the
 *               pins follows naturally), Alt-click removes one; Density, Show Mesh. On a smart object it is a smart
 *               filter.
 *   CAS         Edit ▸ Content-Aware Scale…: the layer narrower / wider / shorter / taller by seam carving - the
 *               unimportant pixels go (or are doubled); Protect = the selection; a live small preview.
 *   LIQUIFY     Filter ▸ Liquify… (Shift+Ctrl+X): a window of its own - Forward Warp, Reconstruct, Twirl (Alt =
 *               the other way), Pucker, Bloat, Freeze / Thaw Mask; size, pressure; Restore All. On a smart object it is
 *               a smart filter (double-click it to carry on).
 *   2.450.0     Tim: "more photoshop features to close the gap" - Warp grid + Liquify extras. WARP: Grid (Default /
 *               3 x 3 / 4 x 4 / 5 x 5 / custom columns x rows) and Split Warp Crosswise / Vertically / Horizontally (click
 *               where; Alt-click a split line takes it away) - pcmesh's lattice of patches (Q.wgrid, kept in a smart
 *               object's t.wgrid). LIQUIFY: Smooth (E), Push Left (O), and FACE-AWARE LIQUIFY - the Face tool (A) places
 *               the face (an oval, its eyes / nose / mouth draggable), 13 sliders (eyes, nose, mouth, face shape).
 */
(function (root) {
  "use strict";
  function install(E) {
    const X = root.PCMesh, SM = root.PCSmart; if (!X || !E.tools) return;
    const { S, D, doc, $, say, ctx, newCanvas, store } = E;
    const T = E.tools;
    const R = () => 7 / (S.zoom || 1);
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const isSmart = (L) => !!L && L.type === "smart" && !!L.smart;
    if (!doc.getElementById("pcwarpCss")) {
      const st = doc.createElement("style"); st.id = "pcwarpCss";
      st.textContent = ".kx .xfm{min-width:28px;padding:2px 6px}.kx .xfm.on{border-color:var(--pc-accent);color:var(--pc-accent)}"
        + ".kx .lqdlg{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;background:var(--pc-bg,#141210);color:var(--pc-text)}"
        + ".kx .lqdlg .lqbar{display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--pc-line);background:var(--pc-panel)}"
        + ".kx .lqdlg .lqmain{flex:1;display:flex;min-height:0}.kx .lqdlg .lqtools{display:flex;flex-direction:column;gap:4px;padding:8px;border-right:1px solid var(--pc-line)}"
        + ".kx .lqdlg .lqtools button{width:36px;height:32px}.kx .lqdlg .lqtools button.on{border-color:var(--pc-accent);color:var(--pc-accent)}"
        + ".kx .lqdlg .lqview{flex:1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0c0b0a}"
        + ".kx .lqdlg .lqview canvas{position:absolute;image-rendering:auto}.kx .lqdlg .lqring{position:absolute;border:1px solid #fff;border-radius:50%;pointer-events:none;box-shadow:0 0 0 1px #000}"
        + ".kx .lqdlg .lqside{width:270px;padding:10px;border-left:1px solid var(--pc-line);display:flex;flex-direction:column;gap:8px;overflow:auto;min-height:0}";
      doc.head.appendChild(st);
    }

    /* ================================ the TRANSFORM ================================ */
    let Q = null, qd = null;                    // the session, the drag
    const MODES = [["free", "Free", "⤢"], ["skew", "Skew", "▱"], ["distort", "Distort", "◇"], ["perspective", "Perspective", "⏢"], ["warp", "Warp", "⌇"]];
    function startQ(mode) {
      const L = E.layer(); if (!L) return say("open a picture first");
      if (L.locks && (L.locks.pos || L.locks.all)) return say("the layer's position is locked");
      if (Q) { setMode(mode); return; }
      // 2.608.0 (Tim: "an interactive warp grid for text and shapes"): a TEXT / SHAPE layer is warped LIVE - it stays text /
      // a shape (pclivewarp.js keeps the grid on the layer); only the warp (the Move tool turns / scales / skews them)
      const LW = root.PCLiveWarp;
      if (LW && LW.can(L)) {
        const before = E.snapStruct(), o = LW.base(L); if (!o) return say("nothing to warp - the layer is empty");
        const h = LW.holder(L), b = o.box, G = h.mesh && h.mesh.G && h.mesh.G.c ? clone(h.mesh.G) : null;
        Q = { L, live: true, before, box: b, quad: X.rectQuad(b.x, b.y, b.w, b.h), warp: h.mesh ? LW.toAbs(h.mesh.P, b) : null, wgrid: G, warpUsed: !!h.mesh, prev: S.tool, mode: "warp" };
        if (!Q.warp) { Q.warp = X.patchFromQuad(Q.quad); Q.wgrid = null; }
        Q.quad0 = clone(Q.quad); Q.warp0 = clone(Q.warp);
        E.setTool("qxform"); setMode("warp");
        say(`⌗ Warp Grid on ${L.name || "the layer"} - it stays ${L.type === "text" ? "text (type into it any time)" : "a shape"}: drag a point or inside the grid, presets and Grid in the bar · Enter applies, Esc cancels`);
        return;
      }
      if (isSmart(L)) {
        const s0 = SM.STORE.get(L.smart.src); if (!s0) return say("the smart object's contents are gone");
        Q = { L, smart: true, src: s0.canvas, before: E.snapStruct(), quad: clone(L.smart.t.quad), warp: L.smart.t.warp ? clone(L.smart.t.warp) : null, wgrid: L.smart.t.warp && L.smart.t.wgrid ? clone(L.smart.t.wgrid) : null, warpUsed: !!L.smart.t.warp, prev: S.tool, mode: "free" };
      } else {
        if (L.type !== "pixel") return say(`a ${L.type} layer: Layer ▸ Smart Objects ▸ Convert to Smart Object first (it stays editable), or Rasterize it`);
        const copy = E.beginPx(L), c = newCanvas(S.w, S.h), g = ctx(c), sc = E.selCanvas();
        g.drawImage(L.canvas, 0, 0);
        if (sc) { g.globalCompositeOperation = "destination-in"; g.drawImage(sc, 0, 0); }
        const b = E.alphaBox(c); if (!b) return say("nothing to transform - the layer (or the selection on it) is empty");
        const src = newCanvas(b.w, b.h); ctx(src).drawImage(c, -b.x, -b.y);
        if (sc) { const lg = ctx(L.canvas); lg.save(); lg.globalCompositeOperation = "destination-out"; lg.drawImage(sc, 0, 0); lg.restore(); } else ctx(L.canvas).clearRect(0, 0, S.w, S.h);
        Q = { L, smart: false, src, copy, pc: newCanvas(S.w, S.h), quad: X.rectQuad(b.x, b.y, b.w, b.h), warp: null, prev: S.tool, mode: "free" };
        S.float = { c: Q.pc, dx: 0, dy: 0 };
      }
      Q.quad0 = clone(Q.quad); Q.warp0 = Q.warp ? clone(Q.warp) : null;
      E.setTool("qxform");
      setMode(mode || "free");
    }
    function setMode(m) {
      if (!Q) return;
      if (Q.live && m !== "warp") { say("a text / shape layer keeps its warp grid live - turn, scale or skew it with the Move tool"); m = "warp"; }
      if (Q.mode === "warp" && m !== "warp" && Q.warp) Q.quad = X.latCorners(Q.warp, Q.wgrid);   // 2.450.0: a gridded warp's outer corners   // the handles go round the warped corners
      Q.mode = m;
      if (m === "warp" && !Q.warp) { Q.warp = X.patchFromQuad(Q.quad); Q.wgrid = null; }
      drawQ(); E.renderOptions(); E.drawOverlay();
      say({ free: "Free Transform: drag a handle to scale (Shift keeps proportions), outside to rotate, inside to move", skew: "Skew: drag a corner along its side, a side handle to slant", distort: "Distort: drag any corner anywhere",
        perspective: "Perspective: a corner and its partner move in mirror", warp: "Warp: drag a grid point or anywhere inside to bend - presets in the options bar" }[m] + " · Enter applies, Esc cancels");
    }
    function drawQ(fast) {
      if (!Q) return;
      const w = Q.mode === "warp" || (Q.warp && Q.warpUsed) ? Q.warp : null;
      const t = Object.assign({ quad: w ? X.latCorners(w, Q.wgrid) : Q.quad, warp: w }, w && Q.wgrid ? { wgrid: Q.wgrid } : {});
      if (Q.live) { root.PCLiveWarp.set(Q.L, Q.warp, Q.wgrid, Q.box); D.rasterize(Q.L); E.renderSoon(); return; }   // 2.608.0
      if (Q.smart) { Q.L.smart.t = clone(t); Q.L._fast = !!fast; SM.render(Q.L); E.renderSoon(); return; }
      const g = ctx(Q.pc); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S.w, S.h);
      SM.drawSource(g, Q.src, t); E.renderSoon();
    }
    function finishQ(ok) {
      if (!Q) return;
      const q = Q; Q = null; qd = null;
      if (q.live) {                                       // 2.608.0: one undo step; a flat grid = no warp
        if (ok) { root.PCLiveWarp.tidy(q.L); D.rasterize(q.L); E.push({ t: "struct", before: q.before, after: E.snapStruct(), label: "warp grid" }); }
        else E.putStruct(q.before);
      } else if (q.smart) {
        q.L._fast = false; q.L._skey = null;
        if (ok) { SM.render(q.L); E.push({ t: "struct", before: q.before, after: E.snapStruct(), label: "transform smart object" }); }
        else E.putStruct(q.before);
      } else {
        S.float = null;
        const g = ctx(q.L.canvas);
        if (ok) { g.drawImage(q.pc, 0, 0); const px = E.endPx(q.L, q.copy, null, q.mode === "free" ? "free transform" : q.mode); if (px) E.push(px); }
        else { g.clearRect(0, 0, S.w, S.h); g.drawImage(q.copy, 0, 0); q.L.ver = (q.L.ver || 0) + 1; }
      }
      E.setTool(q.prev && q.prev !== "qxform" ? q.prev : "move");
      E.refresh(); E.renderLayersPanel();
      say(ok ? "transformed" : "transform cancelled");
    }
    const A0of = (q) => [q[1][0] - q[0][0], q[1][1] - q[0][1], q[3][0] - q[0][0], q[3][1] - q[0][1], q[0][0], q[0][1]];
    const ap = (m, u, v) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]];
    function inv(m) { const det = m[0] * m[3] - m[1] * m[2] || 1e-9; return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]; }
    const UN = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const mids = (q) => [0, 1, 2, 3].map((i) => [(q[i][0] + q[(i + 1) % 4][0]) / 2, (q[i][1] + q[(i + 1) % 4][1]) / 2]);
    function inQuad(q, x, y) { let c = false; for (let i = 0, j = 3; i < 4; j = i++) { const a = q[i], b = q[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1] || 1e-9) + a[0]) c = !c; } return c; }
    const cen = (q) => [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
    const proj = (dx, dy, ax, ay) => { const l2 = ax * ax + ay * ay || 1; const t = (dx * ax + dy * ay) / l2; return [ax * t, ay * t]; };
    /** the patch's (u, v) nearest (x, y) - a coarse search */
    function patchUV(P, x, y, G) {
      const g = X.gridOf(G), n = Math.min(80, 24 * Math.max(g.c, g.r)); let best = [0.5, 0.5], bd = Infinity;
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const p = X.latPoint(P, G, i / n, j / n), d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = [i / n, j / n]; } }
      return best;
    }
    /* 2.450.0: the warp's GRID (Default / 3 x 3 / 4 x 4 / 5 x 5 / custom columns x rows) and SPLIT LINES (cross / vertical /
     * horizontal: click where; Alt-click a split line takes it away) - pcmesh's lattice, exact */
    function setGrid(c, r) { if (!Q || !Q.warp) return; const o = X.latGrid(Q.warp, Q.wgrid, c, r); Q.warp = o.P; Q.wgrid = o.G; Q.warpUsed = true; Q.style = "custom"; drawQ(); E.renderOptions(); E.drawOverlay(); }
    function splitAt(kind, x, y) {
      if (!Q || !Q.warp) return; const [u, v] = patchUV(Q.warp, x, y, Q.wgrid); let o = { P: Q.warp, G: Q.wgrid };
      if (kind === "cross" || kind === "v") o = X.latSplit(o.P, o.G, "v", u);
      if (kind === "cross" || kind === "h") o = X.latSplit(o.P, o.G, "h", v);
      Q.warp = o.P; Q.wgrid = o.G; Q.warpUsed = true; Q.style = "custom"; drawQ(); E.renderOptions(); E.drawOverlay();
      say(`split ${kind === "cross" ? "both ways" : kind === "v" ? "vertically" : "horizontally"} - ${X.gridOf(Q.wgrid).c} x ${X.gridOf(Q.wgrid).r} now · Alt-click a split line takes it away`);
    }
    function unsplitAt(x, y) {
      if (!Q || !Q.warp || !Q.wgrid) return false; const [u, v] = patchUV(Q.warp, x, y, Q.wgrid), g = X.gridOf(Q.wgrid), tol = 0.035;
      const ku = g.us.findIndex((k, i) => i > 0 && i < g.us.length - 1 && Math.abs(k - u) < tol), kv = g.vs.findIndex((k, i) => i > 0 && i < g.vs.length - 1 && Math.abs(k - v) < tol);
      if (ku < 0 && kv < 0) return false;
      const o = ku >= 0 && (kv < 0 || Math.abs(g.us[ku] - u) <= Math.abs(g.vs[kv] - v)) ? X.latUnsplit(Q.warp, Q.wgrid, "v", ku) : X.latUnsplit(Q.warp, Q.wgrid, "h", kv);
      Q.warp = o.P; Q.wgrid = o.G; drawQ(); E.renderOptions(); E.drawOverlay(); say("split line taken away"); return true;
    }
    T.qxform = {
      id: "qxform", name: "Transform", cursor: "default",
      options() {
        if (!Q) return `<span style="color:var(--pc-dim)">Edit ▸ Transform ▸ Skew / Distort / Perspective / Warp</span>`;
        return MODES.filter(([m]) => !Q.live || m === "warp").map(([m, n, ic]) => `<button class="ghost xfm${Q.mode === m ? " on" : ""}" data-xfm="${m}" title="${n}">${ic} ${n}</button>`).join("")
          + (Q.mode === "warp" ? `<span class="sep"></span><label>Warp <select id="xfWS">${X.WARP_STYLES.map(([v, l]) => `<option value="${v}"${v === (Q.style || "custom") ? " selected" : ""}>${l}</option>`).join("")}</select></label>`
            + `<label title="Bend (%)">Bend <input type="number" id="xfWB" min="-100" max="100" value="${Q.bend == null ? 50 : Q.bend}"></label>`
            + (() => { const g = X.gridOf(Q.wgrid), cur = g.c === g.r && [1, 3, 4, 5].includes(g.c) && g.us.every((k, i) => Math.abs(k - i / g.c) < 1e-4) && g.vs.every((k, i) => Math.abs(k - i / g.r) < 1e-4) ? String(g.c) : "custom";
              return `<span class="sep"></span><label title="The warp's grid (each cell a curved patch)">Grid <select id="xfWG">${[["1", "Default"], ["3", "3 x 3"], ["4", "4 x 4"], ["5", "5 x 5"], ["custom", "Custom"]].map(([v, l]) => `<option value="${v}"${v === cur ? " selected" : ""}>${l}</option>`).join("")}</select></label>`
                + `<input type="number" id="xfGC" min="1" max="10" value="${g.c}" title="Columns" style="width:44px">×<input type="number" id="xfGR" min="1" max="10" value="${g.r}" title="Rows" style="width:44px">`
                + `<span class="sep"></span>` + [["cross", "✚", "Split Warp Crosswise - click where (Alt-click a split line takes it away)"], ["v", "┃", "Split Warp Vertically - click where"], ["h", "━", "Split Warp Horizontally - click where"]].map(([k, ic, t]) => `<button class="ghost xfm${Q.split === k ? " on" : ""}" data-xfsplit="${k}" title="${t}">${ic}</button>`).join(""); })() : "")
          + `<span class="sep"></span><button class="ghost" id="xfOk" title="Apply (Enter)">✔</button><button class="ghost" id="xfNo" title="Cancel (Esc)">✕</button>`;
      },
      bindOptions(o) {
        o.querySelectorAll("[data-xfm]").forEach((b) => { b.onclick = () => setMode(b.dataset.xfm); });
        // 2.608.0: Enter / Esc work from the bar too (after picking a preset the focus is on its list)
        o.onkeydown = (e) => { if (!Q || (e.key !== "Enter" && e.key !== "Escape")) return; e.preventDefault(); e.stopPropagation(); if (e.target && e.target.blur) e.target.blur(); finishQ(e.key === "Enter"); };
        const ok = o.querySelector("#xfOk"); if (ok) ok.onclick = () => finishQ(true);
        const no = o.querySelector("#xfNo"); if (no) no.onclick = () => finishQ(false);
        const ws = o.querySelector("#xfWS"), wb = o.querySelector("#xfWB");
        const preset = () => {
          if (!Q) return; Q.style = ws.value; Q.bend = +wb.value || 0; if (Q.wgrid && !Q.live) Q.quad = X.latCorners(Q.warp, Q.wgrid);
          // 2.608.0: the sideways styles (Shell, Fisheye, Twist) on a 3 x 3 grid - closer than one patch
          const H3W = root.H3Warps;
          if (H3W && X.latPreset && Q.style !== "custom" && !H3W.isColumn(Q.style)) { const o = X.latPreset(Q.quad, Q.style, Q.bend, 3, 3); Q.warp = o.P; Q.wgrid = o.G; }
          else { Q.warp = X.patchPreset(Q.quad, Q.style, Q.bend); Q.wgrid = null; }
          Q.warpUsed = true; drawQ(); E.renderOptions(); E.drawOverlay();
          try { E.stage.focus({ preventScroll: true }); } catch (e) { /* fine */ }   // 2.608.0: Enter applies straight after picking a preset
        };
        if (ws) { ws.onchange = preset; wb.onchange = preset; }
        // 2.450.0: the grid and the split lines
        const wg = o.querySelector("#xfWG"), gc = o.querySelector("#xfGC"), gr = o.querySelector("#xfGR");
        if (wg) wg.onchange = () => { if (wg.value !== "custom") setGrid(+wg.value, +wg.value); else { gc.focus(); } };
        if (gc) { gc.onchange = () => setGrid(+gc.value || 1, +gr.value || 1); gr.onchange = gc.onchange; }
        o.querySelectorAll("[data-xfsplit]").forEach((b) => { b.onclick = () => { Q.split = Q.split === b.dataset.xfsplit ? null : b.dataset.xfsplit; E.renderOptions(); if (Q.split) say("click on the warp where the split line goes (Alt-click a split line takes it away)"); }; });
      },
      down(e, fx, fy) {
        if (!Q) return false;
        const r = R(), q = Q.quad;
        qd = { x0: fx, y0: fy, quad0: clone(q), warp0: Q.warp ? clone(Q.warp) : null };
        if (Q.mode === "warp") {
          if (e.altKey && unsplitAt(fx, fy)) { qd = null; return false; }   // 2.450.0: Alt-click a split line
          if (Q.split) { splitAt(Q.split, fx, fy); qd = null; return false; }
          const P = Q.warp, k = P.findIndex((p) => Math.hypot(p[0] - fx, p[1] - fy) <= r);
          if (k >= 0) { qd.k = k; return; }
          qd.uv = patchUV(P, fx, fy, Q.wgrid); qd.bend = true; return;
        }
        const ci = q.findIndex((p) => Math.hypot(p[0] - fx, p[1] - fy) <= r);
        if (ci >= 0) { qd.corner = ci; return; }
        const ei = mids(q).findIndex((p) => Math.hypot(p[0] - fx, p[1] - fy) <= r);
        if (ei >= 0) { qd.edge = ei; return; }
        if (inQuad(q, fx, fy)) { qd.move = true; return; }
        if (Q.mode === "free") { qd.rotate = true; qd.c = cen(q); qd.a0 = Math.atan2(fy - qd.c[1], fx - qd.c[0]); return; }
        qd = null; return false;
      },
      move(e, fx, fy) {
        if (!Q || !qd) return;
        const dx = fx - qd.x0, dy = fy - qd.y0, q0 = qd.quad0;
        if (Q.mode === "warp") {
          const P = clone(qd.warp0);
          if (qd.k != null) {
            const k = qd.k, near = X.latNear(Q.wgrid, k);                 // 2.450.0: an anchor's handles go with it (any grid)
            for (const j of [k].concat(near)) { P[j] = [qd.warp0[j][0] + dx, qd.warp0[j][1] + dy]; }
          } else if (qd.bend) {
            const w = X.latWeights(Q.wgrid, qd.uv[0], qd.uv[1]); let s2 = 0; for (const b of w) s2 += b * b;   // 2.450.0: the patch under it
            for (let k = 0; k < P.length; k++) if (w[k]) P[k] = [qd.warp0[k][0] + dx * w[k] / s2, qd.warp0[k][1] + dy * w[k] / s2];
          }
          Q.warp = P; Q.warpUsed = true; Q.style = "custom"; drawQ(true); E.drawOverlay(); return;
        }
        let q = clone(q0);
        if (qd.move) q = q0.map((p) => [p[0] + dx, p[1] + dy]);
        else if (qd.rotate) {
          let a = Math.atan2(fy - qd.c[1], fx - qd.c[0]) - qd.a0; if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
          const c = Math.cos(a), s = Math.sin(a); q = q0.map((p) => [qd.c[0] + (p[0] - qd.c[0]) * c - (p[1] - qd.c[1]) * s, qd.c[1] + (p[0] - qd.c[0]) * s + (p[1] - qd.c[1]) * c]);
        } else if (Q.mode === "free") {
          const A = A0of(q0), Ai = inv(A), [pu, pv] = ap(Ai, fx, fy);
          if (qd.corner != null) {
            const i = qd.corner, o = UN[(i + 2) % 4], c = UN[i];
            let du = pu - o[0], dv = pv - o[1];
            if (e.shiftKey) { const s = Math.max(Math.abs(du), Math.abs(dv)); du = Math.sign(du || 1) * s; dv = Math.sign(dv || 1) * s; }
            const su = du / (c[0] - o[0]), sv = dv / (c[1] - o[1]);
            q = UN.map(([u, v]) => ap(A, o[0] + (u - o[0]) * su, o[1] + (v - o[1]) * sv));
          } else if (qd.edge != null) {
            const ed = qd.edge, horiz = ed === 0 || ed === 2, m = ed === 0 || ed === 3 ? 0 : 1, f = 1 - m, p = horiz ? pv : pu, s = (p - f) / (m - f);
            q = UN.map(([u, v]) => (horiz ? ap(A, u, f + (v - f) * s) : ap(A, f + (u - f) * s, v)));
          }
        } else if (qd.corner != null) {
          const i = qd.corner;
          const hDir = i === 0 || i === 1 ? [q0[1][0] - q0[0][0], q0[1][1] - q0[0][1]] : [q0[2][0] - q0[3][0], q0[2][1] - q0[3][1]];
          const vDir = i === 0 || i === 3 ? [q0[3][0] - q0[0][0], q0[3][1] - q0[0][1]] : [q0[2][0] - q0[1][0], q0[2][1] - q0[1][1]];
          const horiz = Math.abs(dx * hDir[0] + dy * hDir[1]) / (Math.hypot(...hDir) || 1) >= Math.abs(dx * vDir[0] + dy * vDir[1]) / (Math.hypot(...vDir) || 1);
          if (Q.mode === "distort") q[i] = [q0[i][0] + dx, q0[i][1] + dy];
          else {
            const [mx, my] = proj(dx, dy, ...(horiz ? hDir : vDir));
            q[i] = [q0[i][0] + mx, q0[i][1] + my];
            if (Q.mode === "perspective") { const j = horiz ? { 0: 1, 1: 0, 2: 3, 3: 2 }[i] : { 0: 3, 3: 0, 1: 2, 2: 1 }[i]; q[j] = [q0[j][0] - mx, q0[j][1] - my]; }
          }
        } else if (qd.edge != null) {
          const ed = qd.edge, a = ed, b = (ed + 1) % 4;
          let mx = dx, my = dy;
          if (Q.mode !== "distort") [mx, my] = proj(dx, dy, q0[b][0] - q0[a][0], q0[b][1] - q0[a][1]);
          q[a] = [q0[a][0] + mx, q0[a][1] + my]; q[b] = [q0[b][0] + mx, q0[b][1] + my];
        }
        Q.quad = q;
        if (Q.warp && Q.warpUsed) { const H = X.homography(q0, q); if (H) Q.warp = qd.warp0.map((p) => X.applyH(H, p[0], p[1])); }   // a warped one moves / turns / scales as it is
        else if (Q.warp) Q.warp = null;
        drawQ(true); E.drawOverlay();
      },
      up() { qd = null; if (Q) drawQ(false); },
      key(e) {
        if (!Q) return false;
        if (e.key === "Enter") { finishQ(true); return true; }
        if (e.key === "Escape") { finishQ(false); return true; }
        return false;
      },
      leave() { if (Q) finishQ(true); },
    };
    E.overlayHooks.push((g, px) => {
      if (!Q || S.tool !== "qxform") return;
      g.lineWidth = 1.2 * px; g.strokeStyle = "#2680eb"; g.fillStyle = "#fff";
      const box = (p, s) => { g.fillRect(p[0] - s * px, p[1] - s * px, 2 * s * px, 2 * s * px); g.strokeRect(p[0] - s * px, p[1] - s * px, 2 * s * px, 2 * s * px); };
      if (Q.mode === "warp" && Q.warp) {
        // 2.450.0: any grid - lines at each patch's thirds (its split lines / edges bolder), each anchor's handles
        const P = Q.warp, G = Q.wgrid, gg = X.gridOf(G), Wd = X.latW(G), Hd = X.latH(G), n = 24 * Math.max(gg.c, gg.r);
        const at = (ks, q) => { const i = Math.min(ks.length - 2, Math.floor(q / 3)), f = q / 3 - i; return ks[i] + (ks[i + 1] - ks[i]) * f; };
        for (let q = 0; q < Hd; q++) { g.lineWidth = (q % 3 ? 0.8 : 1.4) * px; const v = at(gg.vs, q); g.beginPath(); for (let i = 0; i <= n; i++) { const p = X.latPoint(P, G, i / n, v); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); }
        for (let q = 0; q < Wd; q++) { g.lineWidth = (q % 3 ? 0.8 : 1.4) * px; const u = at(gg.us, q); g.beginPath(); for (let i = 0; i <= n; i++) { const p = X.latPoint(P, G, u, i / n); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); }
        g.lineWidth = 1.2 * px; g.strokeStyle = "rgba(38,128,235,.6)";
        P.forEach((p, k) => { for (const b of X.latNear(G, k)) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(P[b][0], P[b][1]); g.stroke(); } });
        g.strokeStyle = "#2680eb";
        P.forEach((p, k) => { if (X.latNear(G, k).length) box(p, 4); else { g.beginPath(); g.arc(p[0], p[1], 3.5 * px, 0, Math.PI * 2); g.fill(); g.stroke(); } });
        return;
      }
      const q = Q.quad;
      g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
      q.forEach((p) => box(p, 4)); mids(q).forEach((p) => box(p, 3));
    });
    const baseStart = E.startTransform;
    E.startTransform = function () { const L = E.layer(); if (isSmart(L)) return startQ("free"); return baseStart.apply(this, arguments); };
    E.quadTransform = startQ;

    /* ================================ PUPPET WARP ================================ */
    let PP = null, pdrag = null;
    function startPuppet(L0, idx) {
      const L = L0 || E.layer(); if (!L) return say("open a picture first");
      if (PP) finishPuppet(true);
      if (isSmart(L)) {
        const before = E.snapStruct();
        let i = idx;
        if (i == null) { i = L.smart.filters.findIndex((f) => f.id === "puppet"); }
        const look = E.alphaBox(L.canvas) || { x: 0, y: 0, w: S.w, h: S.h };
        if (i == null || i < 0) { L.smart.filters.push({ id: "puppet", pins: [], box: grow(look), n: +store.get("pp.n", 20) || 20, on: true }); i = L.smart.filters.length - 1; }
        if (!L.fmask) L.fmask = { canvas: (() => { const c = newCanvas(S.w, S.h), g = ctx(c); g.fillStyle = "#fff"; g.fillRect(0, 0, S.w, S.h); return c; })(), on: true, ver: 0 };
        const f = L.smart.filters[i];
        PP = { L, smart: true, i, before, pins: clone(f.pins || []), box: clone(f.box), n: f.n || 20, prev: S.tool, show: true, sel: -1 };
      } else {
        if (L.type !== "pixel") return say(`a ${L.type} layer: convert it to a smart object (it stays editable) or rasterize it first`);
        const copy = E.beginPx(L), b = E.alphaBox(L.canvas); if (!b) return say("the layer is empty");
        const src = newCanvas(S.w, S.h); ctx(src).drawImage(L.canvas, 0, 0); ctx(L.canvas).clearRect(0, 0, S.w, S.h);
        PP = { L, smart: false, copy, src, pc: newCanvas(S.w, S.h), pins: [], box: grow(b), n: +store.get("pp.n", 20) || 20, prev: S.tool, show: true, sel: -1 };
        S.float = { c: PP.pc, dx: 0, dy: 0 };
      }
      E.setTool("puppet"); drawPP();
      say("Puppet Warp: click to add pins (3 or more hold the shape), drag a pin to bend, Alt-click removes one, Alt-drag near the picked pin turns it, ⬆ / ⬇ its depth · Enter applies, Esc cancels");
    }
    const grow = (b) => { const m = Math.round(Math.max(b.w, b.h) * 0.06) + 4; return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m }; };
    /** 2.465.0: the picked pin's depth (dz +-1) / rotation (a radians, null = Auto) */
    function setPin(ch) {
      const p = PP && PP.sel >= 0 ? PP.pins[PP.sel] : null; if (!p) return say("Puppet Warp: pick a pin first");
      if (ch.dz) p.z = (+p.z || 0) + ch.dz;
      if ("a" in ch) { if (ch.a == null) delete p.a; else p.a = ch.a; }
      if (!+p.z) delete p.z;
      drawPP(); E.drawOverlay(); E.renderOptions();
    }
    function drawPP() {
      if (!PP) return;
      if (PP.smart) { const f = PP.L.smart.filters[PP.i]; f.pins = clone(PP.pins); f.box = clone(PP.box); f.n = PP.n; SM.render(PP.L); E.renderSoon(); return; }
      const g = ctx(PP.pc); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S.w, S.h);
      g.drawImage(PP.src, 0, 0); g.clearRect(PP.box.x, PP.box.y, PP.box.w, PP.box.h);
      if (PP.pins.length) X.drawMesh(g, PP.src, X.puppetMesh(PP.box, PP.pins, PP.n), PP.box); else g.drawImage(PP.src, PP.box.x, PP.box.y, PP.box.w, PP.box.h, PP.box.x, PP.box.y, PP.box.w, PP.box.h);
      E.renderSoon();
    }
    function finishPuppet(ok) {
      if (!PP) return; const p = PP; PP = null; pdrag = null;
      if (p.smart) {
        if (ok) { if (!p.pins.length) p.L.smart.filters.splice(p.i, 1); p.L._skey = null; SM.render(p.L); E.push({ t: "struct", before: p.before, after: E.snapStruct(), label: "puppet warp" }); }
        else E.putStruct(p.before);
      } else {
        S.float = null; const g = ctx(p.L.canvas);
        if (ok) { g.drawImage(p.pc, 0, 0); const px = E.endPx(p.L, p.copy, null, "puppet warp"); if (px) E.push(px); }
        else { g.clearRect(0, 0, S.w, S.h); g.drawImage(p.copy, 0, 0); p.L.ver++; }
      }
      E.setTool(p.prev && p.prev !== "puppet" ? p.prev : "move"); E.refresh(); E.renderLayersPanel();
    }
    T.puppet = {
      id: "puppet", name: "Puppet Warp", cursor: "crosshair",
      options() {
        return `<label title="How fine the mesh is">Density <select id="ppN">${[[12, "Fewer Points"], [20, "Normal"], [32, "More Points"]].map(([v, l]) => `<option value="${v}"${PP && PP.n === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>`
          + `<label><input type="checkbox" id="ppMesh" ${!PP || PP.show ? "checked" : ""}> Show Mesh</label><button class="ghost" id="ppClear" title="Remove every pin">Remove All Pins</button>`
          // 2.465.0: the picked pin's depth + rotation
          + (() => { const p = PP && PP.sel >= 0 ? PP.pins[PP.sel] : null, fixed = p && p.a != null;
            return `<span class="sep"></span><span title="Where the warp folds over itself, a pin set forward draws its part on top">Pin Depth</span><button class="ghost" id="ppFwd" title="Pin Depth: forward (on top)"${p ? "" : " disabled"}>⬆</button><button class="ghost" id="ppBack" title="Pin Depth: backward (underneath)"${p ? "" : " disabled"}>⬇</button><span id="ppZ" style="min-width:18px;text-align:center">${p ? (+p.z || 0) : ""}</span>`
              + `<label title="Auto = the content round the pin turns as the mesh needs; Fixed = held at this angle (Alt-drag near the picked pin turns it)">Rotate <select id="ppRot"${p ? "" : " disabled"}><option value="auto"${fixed ? "" : " selected"}>Auto</option><option value="fixed"${fixed ? " selected" : ""}>Fixed</option></select></label><input type="number" id="ppAng" step="1" style="width:56px" value="${fixed ? Math.round(p.a * 180 / Math.PI * 10) / 10 : 0}"${fixed ? "" : " disabled"}>°`; })()
          + `<span class="sep"></span><button class="ghost" id="ppOk" title="Apply (Enter)">✔</button><button class="ghost" id="ppNo" title="Cancel (Esc)">✕</button>`;
      },
      bindOptions(o) {
        o.querySelector("#ppN").onchange = (e) => { if (!PP) return; PP.n = +e.target.value; store.set("pp.n", PP.n); drawPP(); E.drawOverlay(); };
        o.querySelector("#ppMesh").onchange = (e) => { if (PP) { PP.show = e.target.checked; E.drawOverlay(); } };
        o.querySelector("#ppClear").onclick = () => { if (PP) { PP.pins = []; drawPP(); E.drawOverlay(); } };
        o.querySelector("#ppOk").onclick = () => finishPuppet(true); o.querySelector("#ppNo").onclick = () => finishPuppet(false);
        const pin = () => (PP && PP.sel >= 0 ? PP.pins[PP.sel] : null);
        o.querySelector("#ppFwd").onclick = () => setPin({ dz: 1 }); o.querySelector("#ppBack").onclick = () => setPin({ dz: -1 });
        o.querySelector("#ppRot").onchange = (e) => setPin({ a: e.target.value === "fixed" ? (pin() && pin().a != null ? pin().a : 0) : null });
        const ang = o.querySelector("#ppAng"); ang.onchange = () => setPin({ a: (+ang.value || 0) * Math.PI / 180 }); ang.addEventListener("keydown", (ev) => ev.stopPropagation());
      },
      down(e, fx, fy) {
        if (!PP) return false;
        const k = PP.pins.findIndex((p) => Math.hypot(p.X - fx, p.Y - fy) <= R() * 1.2);
        if (k >= 0 && e.altKey) { PP.pins.splice(k, 1); PP.sel = -1; drawPP(); E.drawOverlay(); E.renderOptions(); return false; }
        // 2.465.0: Alt-drag NEAR the picked pin (its ring) turns it - its rotation becomes Fixed
        const sp = PP.sel >= 0 ? PP.pins[PP.sel] : null;
        if (sp && e.altKey && k < 0 && Math.hypot(sp.X - fx, sp.Y - fy) <= R() * 6) { pdrag = { rot: PP.sel, a0: sp.a != null ? +sp.a : 0, t0: Math.atan2(fy - sp.Y, fx - sp.X) }; E.drawOverlay(); return; }
        if (k >= 0) { const was = PP.sel; PP.sel = k; pdrag = { k, ox: PP.pins[k].X - fx, oy: PP.pins[k].Y - fy }; E.drawOverlay(); if (was !== k) E.renderOptions(); return; }
        const b = PP.box; if (fx < b.x || fy < b.y || fx > b.x + b.w || fy > b.y + b.h) { say("pins go on the layer's content"); return false; }
        // a new pin sits where the content is NOW (its rest place found back through the current pins)
        let rx = fx, ry = fy;
        if (PP.pins.some((p) => p.x !== p.X || p.y !== p.Y)) { const inv2 = PP.pins.map((p) => ({ x: p.X, y: p.Y, X: p.x, Y: p.y })), r = X.mlsRigid(inv2.map((p) => [p.x, p.y]), inv2.map((p) => [p.X, p.Y]), [fx, fy]); rx = r[0]; ry = r[1]; }
        PP.pins.push({ x: rx, y: ry, X: fx, Y: fy }); PP.sel = PP.pins.length - 1;
        pdrag = { k: PP.sel, ox: 0, oy: 0 }; drawPP(); E.drawOverlay(); E.renderOptions();
      },
      move(e, fx, fy) {
        if (!PP || !pdrag) return;
        if (pdrag.rot != null) { const p = PP.pins[pdrag.rot]; if (!p) return; p.a = pdrag.a0 + Math.atan2(fy - p.Y, fx - p.X) - pdrag.t0; drawPP(); E.drawOverlay(); return; }
        const p = PP.pins[pdrag.k]; p.X = fx + pdrag.ox; p.Y = fy + pdrag.oy; drawPP(); E.drawOverlay();
      },
      up() { const d = pdrag; pdrag = null; if (d && d.rot != null) E.renderOptions(); },
      key(e) {
        if (!PP) return false;
        if (e.key === "Enter") { finishPuppet(true); return true; }
        if (e.key === "Escape") { finishPuppet(false); return true; }
        if ((e.key === "Delete" || e.key === "Backspace") && PP.sel >= 0) { PP.pins.splice(PP.sel, 1); PP.sel = -1; drawPP(); E.drawOverlay(); E.renderOptions(); return true; }
        return false;
      },
      leave() { if (PP) finishPuppet(true); },
    };
    E.overlayHooks.push((g, px) => {
      if (!PP || S.tool !== "puppet") return;
      if (PP.show) {
        const m = PP.pins.length ? X.puppetMesh(PP.box, PP.pins, PP.n) : X.gridMesh(PP.n, (u, v) => [PP.box.x + u * PP.box.w, PP.box.y + v * PP.box.h]), N = m.n;
        g.strokeStyle = "rgba(160,160,160,.55)"; g.lineWidth = px; g.beginPath();
        for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const k = j * (N + 1) + i, p = m.dst[k]; if (i < N) { const q = m.dst[k + 1]; g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); } if (j < N) { const q = m.dst[k + N + 1]; g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); } if (i < N && j < N) { const q = m.dst[k + N + 2]; g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); } }
        g.stroke();
      }
      PP.pins.forEach((p, k) => {
        g.beginPath(); g.arc(p.X, p.Y, 5 * px, 0, Math.PI * 2); g.fillStyle = "#ffd400"; g.fill(); g.strokeStyle = "#000"; g.lineWidth = px; g.stroke();
        if (k === PP.sel) {
          g.beginPath(); g.arc(p.X, p.Y, 2 * px, 0, Math.PI * 2); g.fillStyle = "#000"; g.fill();
          // 2.465.0: the rotation ring (Alt-drag on it) + where a fixed rotation points
          g.beginPath(); g.arc(p.X, p.Y, 30 * px, 0, Math.PI * 2); g.strokeStyle = "rgba(255,212,0,.7)"; g.setLineDash([3 * px, 3 * px]); g.stroke(); g.setLineDash([]);
          if (p.a != null) { g.beginPath(); g.moveTo(p.X, p.Y); g.lineTo(p.X + 30 * px * Math.cos(p.a), p.Y + 30 * px * Math.sin(p.a)); g.strokeStyle = "#ffd400"; g.lineWidth = 2 * px; g.stroke(); }
        }
        if (+p.z) { g.font = `${10 * px}px sans-serif`; g.fillStyle = "#ffd400"; g.fillText((p.z > 0 ? "+" : "") + p.z, p.X + 7 * px, p.Y - 7 * px); }
      });
    });
    E.puppet = startPuppet;

    /* ================================ CONTENT-AWARE SCALE ================================ */
    function cas() {
      const L = E.layer(); if (!L || L.type !== "pixel") return say("Content-Aware Scale works on a pixel layer (a smart object: rasterize it first)");
      const b = E.alphaBox(L.canvas); if (!b) return say("the layer is empty");
      const hasSel = E.hasSel();
      E.ui.dialog("Content-Aware Scale", `<div class="rw"><span>Width (%)</span><input type="number" id="casW" min="10" max="300" value="100"></div>
        <div class="rw"><span>Height (%)</span><input type="number" id="casH" min="10" max="300" value="100"></div>
        <div class="rw"><span>Protect</span><select id="casP" style="grid-column:2/4"><option value="none">None</option>${hasSel ? '<option value="sel" selected>The selection</option>' : ""}</select></div>
        <div class="rw"><span>Anchor</span><select id="casA" style="grid-column:2/4"><option value="c">Centre</option><option value="tl">Top left</option></select></div>
        <canvas id="casPv" width="260" height="180" style="width:260px;height:180px;background:repeating-conic-gradient(#888 0 25%,#aaa 0 50%) 0 0/16px 16px;margin-top:6px"></canvas>
        <div style="color:var(--pc-dim);font-size:11px">${b.w} × ${b.h} px of content. Seam carving: the even, unimportant parts go (or are doubled) - faces and edges stay. Protect what must not change with a selection.</div>`,
      (d) => { const wp = +d.querySelector("#casW").value || 100, hp = +d.querySelector("#casH").value || 100; runCas(L, b, wp, hp, d.querySelector("#casP").value === "sel", d.querySelector("#casA").value); },
      { init(d) {
        const pv = d.querySelector("#casPv"), k = Math.min(1, 160 / Math.max(b.w, b.h)), sw = Math.max(4, Math.round(b.w * k)), sh = Math.max(4, Math.round(b.h * k));
        const small = newCanvas(sw, sh); ctx(small).drawImage(L.canvas, b.x, b.y, b.w, b.h, 0, 0, sw, sh);
        const sd = ctx(small).getImageData(0, 0, sw, sh).data;
        let pm = null;
        if (hasSel) { const sc = newCanvas(sw, sh); ctx(sc).drawImage(E.selCanvas(), b.x, b.y, b.w, b.h, 0, 0, sw, sh); const a = ctx(sc).getImageData(0, 0, sw, sh).data; pm = new Uint8Array(sw * sh); for (let i = 0; i < pm.length; i++) pm[i] = a[i * 4 + 3]; }
        let t = null;
        const show = () => { clearTimeout(t); t = setTimeout(() => {
          const wp = Math.max(10, Math.min(300, +d.querySelector("#casW").value || 100)), hp = Math.max(10, Math.min(300, +d.querySelector("#casH").value || 100));
          const W2 = Math.max(2, Math.round(sw * wp / 100)), H2 = Math.max(2, Math.round(sh * hp / 100));
          const out = X.carve(sd, sw, sh, W2, H2, d.querySelector("#casP").value === "sel" ? pm : null), g = ctx(pv);
          g.clearRect(0, 0, 260, 180); const c = newCanvas(W2, H2); ctx(c).putImageData(new ImageData(out, W2, H2), 0, 0);
          const z = Math.min(250 / W2, 170 / H2, 1.6); g.drawImage(c, (260 - W2 * z) / 2, (180 - H2 * z) / 2, W2 * z, H2 * z);
        }, 120); };
        d.querySelectorAll("input,select").forEach((el) => { el.addEventListener("input", show); el.addEventListener("change", show); });
        show();
      } });
    }
    function runCas(L, b, wp, hp, protect, anchor) {
      const W2 = Math.max(2, Math.round(b.w * wp / 100)), H2 = Math.max(2, Math.round(b.h * hp / 100));
      if (W2 === b.w && H2 === b.h) return say("the same size - nothing to do");
      say(`content-aware scale ${b.w} × ${b.h} -> ${W2} × ${H2} - working…`);
      setTimeout(() => {
        E.pxOp("content-aware scale", (c, g) => {
          const id = g.getImageData(b.x, b.y, b.w, b.h);
          let pm = null;
          if (protect && E.hasSel()) { pm = new Uint8Array(b.w * b.h); for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) pm[y * b.w + x] = S.sel[(b.y + y) * S.w + b.x + x]; }
          const out = X.carve(id.data, b.w, b.h, W2, H2, pm);
          g.clearRect(b.x, b.y, b.w, b.h);
          const ox = anchor === "tl" ? b.x : Math.round(b.x + (b.w - W2) / 2), oy = anchor === "tl" ? b.y : Math.round(b.y + (b.h - H2) / 2);
          const t = newCanvas(W2, H2); ctx(t).putImageData(new ImageData(out, W2, H2), 0, 0); g.drawImage(t, ox, oy);
        });
        say(`content-aware scale: ${W2} × ${H2}`);
      }, 30);
    }

    /* ================================ LIQUIFY ================================ */
    const LQ_TOOLS = [["push", "Forward Warp (W)", "↝", "w"], ["reconstruct", "Reconstruct (R)", "↺", "r"], ["twirl", "Twirl Clockwise (C) - Alt = the other way", "🌀", "c"],
      ["pucker", "Pucker (S)", "⊙", "s"], ["bloat", "Bloat (B)", "◎", "b"], ["smooth", "Smooth (E) - evens out the distortion", "≈", "e"], ["pushleft", "Push Left (O) - drag up: the pixels go left (Alt = right)", "⇠", "o"],
      ["freeze", "Freeze Mask (F)", "▧", "f"], ["thaw", "Thaw Mask (D)", "▢", "d"], ["face", "Face Tool (A) - drag an oval round a face, then drag its eyes / nose / mouth into place; the Face-Aware sliders change it", "☺", "a"]];   // 2.450.0: + Smooth, Push Left, the Face tool
    let LQ = null;
    function liquify(L0, idx) {
      const L = L0 || E.layer(); if (!L) return say("open a picture first");
      if (!isSmart(L) && (L.type !== "pixel" || !E.canPaint(L))) return say(`Liquify works on a pixel layer or a smart object (a ${L.type} layer: convert it to a smart object first)`);
      const W = S.w, H = S.h, k = Math.min(1, 1100 / Math.max(W, H)), pw = Math.max(8, Math.round(W * k)), ph = Math.max(8, Math.round(H * k));
      let base, editF = null;
      if (isSmart(L)) {
        // the smart object as it looks WITHOUT this liquify (and the ones after it)
        const keep = L.smart.filters, cut = idx == null ? keep.length : idx;
        L.smart.filters = keep.slice(0, cut); L._skey = null; SM.render(L);
        base = newCanvas(W, H); ctx(base).drawImage(L.canvas, 0, 0);
        L.smart.filters = keep; L._skey = null; SM.render(L);
        if (idx != null && keep[idx]) editF = SM.FIELDS.get(keep[idx].field) || null;
      } else { base = newCanvas(W, H); ctx(base).drawImage(L.canvas, 0, 0); }
      const pc = newCanvas(pw, ph); ctx(pc).drawImage(base, 0, 0, pw, ph);
      const src = ctx(pc).getImageData(0, 0, pw, ph).data;
      const field = editF ? { w: editF.w, h: editF.h, dx: Float32Array.from(editF.dx), dy: Float32Array.from(editF.dy) } : X.field(pw, ph);
      if (field.w !== pw || field.h !== ph) { field.w = pw; field.h = ph; field.dx = new Float32Array(pw * ph); field.dy = new Float32Array(pw * ph); }
      const frozen = new Uint8Array(pw * ph);
      LQ = { L, idx, W, H, pw, ph, k, src, field, frozen, tool: "push", size: +store.get("lq.size", 80) || 80, pressure: +store.get("lq.p", 50) || 50, showMask: true };
      const dlg = doc.createElement("div"); dlg.className = "lqdlg"; dlg.id = "pcLiquify";
      dlg.innerHTML = `<div class="lqbar"><b>Liquify</b><span style="color:var(--pc-dim)">${esc(L.name)}${isSmart(L) ? " · a smart filter" : ""}</span><span style="flex:1"></span>
          <button class="ghost" id="lqRestore" title="Undo every change">Restore All</button><button class="ghost" id="lqCancel">Cancel</button><button class="ghost" id="lqOk">OK</button></div>
        <div class="lqmain"><div class="lqtools">${LQ_TOOLS.map(([id, n, ic]) => `<button class="ghost${id === "push" ? " on" : ""}" data-lq="${id}" title="${n}">${ic}</button>`).join("")}</div>
          <div class="lqview" id="lqView"><canvas id="lqCv" width="${pw}" height="${ph}"></canvas><canvas id="lqMk" width="${pw}" height="${ph}" style="pointer-events:none;opacity:.45"></canvas><div class="lqring" id="lqRing" style="display:none"></div></div>
          <div class="lqside"><label>Size <input type="range" id="lqSize" min="4" max="600" value="${LQ.size}"><input type="number" id="lqSizeN" min="4" max="1200" value="${LQ.size}" style="width:60px"></label>
            <label>Pressure <input type="range" id="lqP" min="1" max="100" value="${LQ.pressure}"></label>
            <label><input type="checkbox" id="lqShowM" checked> Show Mask</label><button class="ghost" id="lqThawAll">Thaw All</button>
            <div style="color:var(--pc-dim);font-size:11px">Drag on the picture. [ ] change the size. Freeze Mask paints red where nothing may move; Reconstruct paints changes back.</div>
            <div class="lqface" id="lqFace" style="border-top:1px solid var(--pc-line);padding-top:6px;overflow:auto;min-height:0;flex:1"><b>Face-Aware Liquify</b>
              <div style="color:var(--pc-dim);font-size:11px" id="lqFNote">☺ Face tool (A): drag an oval round the face, then its eyes / nose / mouth into place.</div>
              ${X.FACE_KEYS.map(([k, n]) => `<label style="display:flex;gap:4px;align-items:center;font-size:11px"><span style="width:96px;white-space:nowrap">${n}</span><input type="range" id="lqF_${k}" min="-100" max="100" value="0" style="flex:1"><span id="lqFV_${k}" style="width:28px;text-align:right">0</span></label>`).join("")}
              <button class="ghost" id="lqFReset" title="Every face slider back to 0">Reset Face</button></div></div></div>`;
      E.kx.appendChild(dlg);
      const cv = dlg.querySelector("#lqCv"), mkc = dlg.querySelector("#lqMk"), view = dlg.querySelector("#lqView"), ring = dlg.querySelector("#lqRing");
      const g = ctx(cv), out = new ImageData(new Uint8ClampedArray(src), pw, ph);
      LQ.dlg = dlg; LQ.out = out;
      const fit = () => { const r = view.getBoundingClientRect(), z = Math.min((r.width - 20) / pw, (r.height - 20) / ph); LQ.z = z; for (const c of [cv, mkc]) { c.style.width = pw * z + "px"; c.style.height = ph * z + "px"; c.style.left = (r.width - pw * z) / 2 + "px"; c.style.top = (r.height - ph * z) / 2 + "px"; } };
      // 2.450.0: the face sliders' field is added to the brushes' (both kept apart, so either can change)
      LQ.face = null; LQ.fv = {}; LQ.faceF = null;
      const total = () => { const F = LQ.faceF; if (!F) return field; const dx = new Float32Array(field.dx.length), dy = new Float32Array(field.dy.length); for (let i = 0; i < dx.length; i++) { dx[i] = field.dx[i] + F.dx[i]; dy[i] = field.dy[i] + F.dy[i]; } return { w: pw, h: ph, dx, dy }; };
      LQ.total = total;
      const paintAll = () => { out.data.set(X.applyField(src, pw, ph, total())); g.putImageData(out, 0, 0); };
      const paintRect = (x0, y0, x1, y1) => {
        x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(pw - 1, Math.ceil(x1)); y1 = Math.min(ph - 1, Math.ceil(y1)); if (x1 < x0 || y1 < y0) return;
        const d = out.data;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const i = y * pw + x, F = LQ.faceF; let sx = x + field.dx[i] + (F ? F.dx[i] : 0), sy = y + field.dy[i] + (F ? F.dy[i] : 0);
          if (sx < 0) sx = 0; if (sy < 0) sy = 0; if (sx > pw - 1) sx = pw - 1; if (sy > ph - 1) sy = ph - 1;
          const xa = Math.floor(sx), ya = Math.floor(sy), xb = Math.min(pw - 1, xa + 1), yb = Math.min(ph - 1, ya + 1), ax = sx - xa, ay = sy - ya, o = i * 4;
          for (let c = 0; c < 4; c++) d[o + c] = (src[(ya * pw + xa) * 4 + c] * (1 - ax) + src[(ya * pw + xb) * 4 + c] * ax) * (1 - ay) + (src[(yb * pw + xa) * 4 + c] * (1 - ax) + src[(yb * pw + xb) * 4 + c] * ax) * ay;
        }
        g.putImageData(out, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      };
      const paintMask = () => {
        const mg = ctx(mkc), id = mg.createImageData(pw, ph);
        if (LQ.showMask) for (let i = 0; i < frozen.length; i++) { id.data[i * 4] = 255; id.data[i * 4 + 3] = frozen[i]; }
        mg.putImageData(id, 0, 0);
        const fc = LQ.face;                                                   // 2.450.0: the placed face - its oval and parts
        if (fc && (LQ.tool === "face" || LQ.faceF)) {
          mg.save(); mg.strokeStyle = "#39f"; mg.lineWidth = Math.max(1, 1.5 / (LQ.z || 1)); mg.setLineDash([5, 4]); mg.beginPath(); mg.ellipse(fc.cx, fc.cy, fc.rx, fc.ry, 0, 0, Math.PI * 2); mg.stroke(); mg.setLineDash([]);
          mg.fillStyle = "#fff"; for (const [x, y] of fc.eyes.concat([fc.nose, fc.mouth])) { mg.beginPath(); mg.arc(x, y, Math.max(3, 4 / (LQ.z || 1)), 0, Math.PI * 2); mg.fill(); mg.stroke(); }
          mg.restore();
        }
      };
      LQ.paintAll = paintAll; LQ.paintMask = paintMask;
      fit(); paintAll(); paintMask();
      const posOf = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / LQ.z, (e.clientY - r.top) / LQ.z]; };
      const rad = () => LQ.size * LQ.k / 2;
      let last = null, down = false;
      const dab = (x, y, alt) => {
        const r = rad(), s = LQ.pressure / 100;
        if (LQ.tool === "freeze" || LQ.tool === "thaw") {
          for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(ph - 1, Math.ceil(y + r)); yy++) for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(pw - 1, Math.ceil(x + r)); xx++) {
            const d2 = (xx - x) ** 2 + (yy - y) ** 2; if (d2 > r * r) continue; const w = (1 - d2 / (r * r)) * s * 255, i = yy * pw + xx;
            frozen[i] = LQ.tool === "freeze" ? Math.min(255, frozen[i] + w) : Math.max(0, frozen[i] - w);
          }
          paintMask(); return;
        }
        if (LQ.tool === "face") return;
        const op = LQ.tool === "twirl" ? "twirl" : LQ.tool;
        const mx = last ? x - last[0] : 0, my = last ? y - last[1] : 0;
        if ((op === "push" || op === "pushleft") && !mx && !my) return;
        X.liq(field, op, x, y, r, op === "twirl" || op === "pushleft" ? (alt ? -s : s) : op === "push" ? 1 : s, mx, my, frozen);
        paintRect(x - r - 2, y - r - 2, x + r + 2, y + r + 2);
      };
      // 2.450.0: the Face tool - a part dragged into place, or a new oval dragged round the face
      let fdrag = null;
      const faceDown = (p) => {
        const fc = LQ.face, near = (q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= Math.max(6, 10 / (LQ.z || 1));
        if (fc) { const parts = [["eye0", fc.eyes[0]], ["eye1", fc.eyes[1]], ["nose", fc.nose], ["mouth", fc.mouth]], hit = parts.find(([, q]) => near(q)); if (hit) { fdrag = { part: hit[0], p0: p, q0: hit[1].slice() }; return; } }
        fdrag = { oval: true, p0: p };
      };
      const faceMove = (p) => {
        if (!fdrag) return;
        if (fdrag.oval) { const x0 = Math.min(fdrag.p0[0], p[0]), x1 = Math.max(fdrag.p0[0], p[0]), y0 = Math.min(fdrag.p0[1], p[1]), y1 = Math.max(fdrag.p0[1], p[1]); if (x1 - x0 > 6 && y1 - y0 > 6) LQ.face = X.faceGuess((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2); }
        else { const q = [fdrag.q0[0] + p[0] - fdrag.p0[0], fdrag.q0[1] + p[1] - fdrag.p0[1]], fc = LQ.face; if (fdrag.part === "eye0") fc.eyes[0] = q; else if (fdrag.part === "eye1") fc.eyes[1] = q; else fc[fdrag.part] = q; }
        refreshFace(); paintMask();
      };
      const refreshFace = () => {
        const any = X.FACE_KEYS.some(([k]) => +LQ.fv[k]);
        LQ.faceF = any && LQ.face ? X.faceField(pw, ph, LQ.face, LQ.fv) : null; paintAll();
      };
      LQ.refreshFace = refreshFace;
      cv.onpointerdown = (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); down = true; const p = posOf(e); last = p; if (LQ.tool === "face") { faceDown(p); return; } dab(p[0], p[1], e.altKey); };
      cv.onpointermove = (e) => {
        const p = posOf(e), r = rad() * LQ.z, rect = cv.getBoundingClientRect(), vr = view.getBoundingClientRect();
        ring.style.display = ""; ring.style.width = ring.style.height = 2 * r + "px"; ring.style.left = (e.clientX - vr.left - r) + "px"; ring.style.top = (e.clientY - vr.top - r) + "px"; void rect;
        if (!down) return;
        if (LQ.tool === "face") { faceMove(p); return; }
        const step = Math.max(1, rad() / 4), dist = Math.hypot(p[0] - last[0], p[1] - last[1]);
        if (dist < step && (LQ.tool === "push" || LQ.tool === "pushleft")) return;
        if (LQ.tool === "push" || LQ.tool === "pushleft") { dab(p[0], p[1], e.altKey); last = p; return; }
        const n = Math.max(1, Math.ceil(dist / step));
        for (let i = 1; i <= n; i++) dab(last[0] + (p[0] - last[0]) * i / n, last[1] + (p[1] - last[1]) * i / n, e.altKey);
        last = p;
      };
      // twirl / pucker / bloat keep working while the button is held still
      let hold = setInterval(() => { if (down && last && /^(twirl|pucker|bloat|reconstruct|smooth)$/.test(LQ.tool)) dab(last[0], last[1], false); }, 60);
      cv.onpointerup = cv.onpointercancel = () => { down = false; last = null; fdrag = null; };
      cv.onpointerleave = () => { ring.style.display = "none"; };
      dlg.querySelectorAll("[data-lq]").forEach((b) => { b.onclick = () => { LQ.tool = b.dataset.lq; dlg.querySelectorAll("[data-lq]").forEach((x) => x.classList.toggle("on", x === b)); paintMask(); }; });
      // 2.450.0: the Face-Aware sliders (no face placed yet: a guess in the middle - the Face tool moves it)
      for (const [k] of X.FACE_KEYS) {
        const sl = dlg.querySelector("#lqF_" + k), vv = dlg.querySelector("#lqFV_" + k);
        sl.oninput = () => {
          LQ.fv[k] = +sl.value; vv.textContent = sl.value;
          if (!LQ.face) { LQ.face = X.faceGuess(pw / 2, ph / 2, pw * 0.2, ph * 0.28); dlg.querySelector("#lqFNote").textContent = "A face guessed in the middle - the ☺ Face tool (A) puts it where the face is."; }
          refreshFace(); paintMask();
        };
      }
      dlg.querySelector("#lqFReset").onclick = () => { LQ.fv = {}; for (const [k] of X.FACE_KEYS) { dlg.querySelector("#lqF_" + k).value = 0; dlg.querySelector("#lqFV_" + k).textContent = "0"; } refreshFace(); paintMask(); };
      const sz = dlg.querySelector("#lqSize"), szn = dlg.querySelector("#lqSizeN");
      sz.oninput = () => { LQ.size = +sz.value; szn.value = sz.value; store.set("lq.size", LQ.size); };
      szn.onchange = () => { LQ.size = Math.max(4, +szn.value || 80); sz.value = LQ.size; store.set("lq.size", LQ.size); };
      dlg.querySelector("#lqP").oninput = (e) => { LQ.pressure = +e.target.value; store.set("lq.p", LQ.pressure); };
      dlg.querySelector("#lqShowM").onchange = (e) => { LQ.showMask = e.target.checked; paintMask(); };
      dlg.querySelector("#lqThawAll").onclick = () => { frozen.fill(0); paintMask(); };
      dlg.querySelector("#lqRestore").onclick = () => { field.dx.fill(0); field.dy.fill(0); dlg.querySelector("#lqFReset").click(); paintAll(); };
      const close = () => { clearInterval(hold); hold = null; doc.removeEventListener("keydown", keys, true); dlg.remove(); LQ = null; };
      const keys = (e) => {
        if (!LQ) return;
        if (e.target && /INPUT|SELECT/.test(e.target.tagName) && e.target.type !== "range") return;
        const t = LQ_TOOLS.find((x) => x[3] === e.key.toLowerCase());
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); say("Liquify cancelled"); return; }
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); dlg.querySelector("#lqOk").click(); return; }
        if (e.key === "[" || e.key === "]") { LQ.size = Math.max(4, Math.min(1200, Math.round(LQ.size * (e.key === "]" ? 1.15 : 1 / 1.15)))); sz.value = LQ.size; szn.value = LQ.size; e.preventDefault(); e.stopPropagation(); return; }
        if (t && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); dlg.querySelector(`[data-lq="${t[0]}"]`).click(); }
      };
      doc.addEventListener("keydown", keys, true);
      dlg.querySelector("#lqCancel").onclick = () => { close(); say("Liquify cancelled"); };
      dlg.querySelector("#lqOk").onclick = () => {
        const T0 = total(), f = { w: pw, h: ph, dx: T0.dx, dy: T0.dy }, any = f.dx.some((v) => Math.abs(v) > 0.01) || f.dy.some((v) => Math.abs(v) > 0.01);   // 2.450.0: + the face sliders
        const l = LQ; close();
        if (!any && l.idx == null) return say("nothing liquified");
        applyLiquify(l, f);
      };
      E.liquifyState = () => LQ;
      say("Liquify: drag to push the picture (W), R reconstructs, C twirls, S puckers, B bloats, E smooths, O pushes left, F freezes, A places a face for the Face-Aware sliders · Enter = OK, Esc = Cancel");
    }
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    function applyLiquify(l, f) {
      const L = l.L;
      if (isSmart(L)) {
        const id = SM.addField(f);
        return E.structOp(l.idx != null ? "liquify (smart filter settings)" : "liquify (smart filter)", () => {
          if (l.idx != null && L.smart.filters[l.idx]) L.smart.filters[l.idx] = Object.assign({}, L.smart.filters[l.idx], { field: id, box: { x: 0, y: 0, w: S.w, h: S.h } });
          else L.smart.filters.push({ id: "liquify", field: id, box: { x: 0, y: 0, w: S.w, h: S.h }, on: true });
          if (!L.fmask) { const c = newCanvas(S.w, S.h), g = ctx(c); g.fillStyle = "#fff"; g.fillRect(0, 0, S.w, S.h); L.fmask = { canvas: c, on: true, ver: 0 }; }
          L._skey = null; SM.render(L);
        });
      }
      return E.pxOp("liquify", (c, g) => { const id = g.getImageData(0, 0, S.w, S.h); id.data.set(X.applyField(id.data, S.w, S.h, f)); g.putImageData(id, 0, 0); });
    }
    E.liquify = liquify;

    /* ---------------- commands ---------------- */
    if (E.ui.addCmd) {
      const C = E.ui.addCmd, can = () => { const L = E.layer(); return !!(S.w && L && (L.type === "pixel" || isSmart(L))); };
      const canW = () => { const L = E.layer(); return !!(S.w && L && (L.type === "pixel" || isSmart(L) || (root.PCLiveWarp && root.PCLiveWarp.can(L)))); };   // 2.608.0: + text / shape (live)
      C("xf.skew", "Transform: Skew", "", () => startQ("skew"), { enabled: can }, ["Edit", "edit.transform"]);
      C("xf.distort", "Transform: Distort", "", () => startQ("distort"), { enabled: can }, ["Edit", "xf.skew"]);
      C("xf.perspective", "Transform: Perspective", "", () => startQ("perspective"), { enabled: can }, ["Edit", "xf.distort"]);
      C("xf.warp", "Transform: Warp", "", () => startQ("warp"), { enabled: canW }, ["Edit", "xf.perspective"]);
      // 2.608.0: the warp grid on a text / shape layer (it stays live) + taking it off
      const LWon = () => !!(root.PCLiveWarp && root.PCLiveWarp.on(E.layer()));
      C("xf.warpgrid", "⌗ Warp Grid (text / shape stays live)", "", () => startQ("warp"), { enabled: () => !!(S.w && root.PCLiveWarp && root.PCLiveWarp.can(E.layer())) }, ["Layer", null, true]);
      C("xf.warpoff", "Remove Warp Grid", "", () => { const L = E.layer(); E.setLayer(L, "remove warp grid", (x) => { const h = root.PCLiveWarp.holder(x); if (h) delete h.mesh; }); }, { enabled: LWon }, ["Layer", "xf.warpgrid"]);
      if (Array.isArray(E.ui.stageCtxItems)) E.ui.stageCtxItems.push("xf.warpgrid"); else E.ui.stageCtxItems = ["xf.warpgrid"];
      C("xf.puppet", "Puppet Warp", "", () => startPuppet(), { enabled: can }, ["Edit", "xf.warp"]);
      C("xf.cas", "Content-Aware Scale…", "Alt+Shift+Ctrl+C", cas, { enabled: () => !!(S.w && E.layer() && E.layer().type === "pixel") }, ["Edit", "xf.puppet"]);
      C("flt.liquify", "Liquify…", "Shift+Ctrl+X", () => liquify(), { enabled: can }, ["Filter", "so.smartfilters"]);
    }
    E.warp = { startQ, setMode, finishQ, state: () => Q, setGrid, splitAt, unsplitAt, startPuppet, finishPuppet, puppetState: () => PP, cas, runCas, liquify, applyLiquify };
  }
  const api = { install };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCWarp = api;
})(typeof window !== "undefined" ? window : globalThis);
