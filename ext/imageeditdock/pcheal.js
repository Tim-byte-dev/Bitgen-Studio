/* pcheal.js — THE IMAGE EDITOR'S RETOUCHING TOOLS: PATCH, CONTENT-AWARE MOVE, RED EYE, CONTENT-AWARE FILL, MIXER
 * BRUSH, BACKGROUND / MAGIC ERASER, TRUE HEALING (2.423.0), window.PCHeal.
 *
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first" - gap 5 of the Photoshop list. The maths is
 * pcretouch.js (Poisson blending, PatchMatch filling - no AI, nothing leaves the page):
 *
 *   J  Spot Healing Brush (Content-Aware: filled by PatchMatch from around it, or Proximity Match), Healing Brush (the
 *      copy is now BLENDED - its texture, the colours and light of where it lands), Patch (draw round it or use the
 *      selection, drag it onto good texture: Source; or the other way round: Destination), Content-Aware Move (drag the
 *      selection: the thing moves, the hole fills; Extend copies), Red Eye (click a pupil; Pupil Size, Darken Amount).
 *   B  Mixer Brush: the paint picks up the canvas's colour as it goes (Wet, Load, Mix; Clean / Load after each stroke).
 *   E  Background Eraser (erases what is like the colour under the brush's centre: Continuous / Once, Tolerance,
 *      Protect Foreground Color), Magic Eraser (a click erases the area of that colour: Tolerance, Contiguous).
 *   Edit ▸ Content-Aware Fill… (and Content-Aware in Edit ▸ Fill…): the selection filled from the rest of the picture
 *      - onto the layer or a new layer.
 */
(function (root) {
  "use strict";
  function install(E) {
    const R = root.PCRetouch; if (!R || !E.tools) return;
    const { S, P, doc, $, say, ctx, newCanvas, store } = E;
    const T = E.tools, H = E.dab || null;
    const W = () => S.w, Hh = () => S.h;
    const pixelLayer = (quiet) => { const L = E.layer(); if (!L || L.type !== "pixel" || E.onMask(L) || S.qm) { if (!quiet) say("this works on a pixel layer's pixels"); return null; } if (!E.canPaint(L)) return null; return L; };
    const holeOf = (m) => { const o = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) o[i] = m[i] > 127 ? 255 : 0; return o; };

    /* ================================ CONTENT-AWARE FILL ================================ */
    function caFill(toNew) {
      if (!S.w) return say("open a picture first");
      if (!E.hasSel()) return say("select what to fill first - its surroundings fill it");
      const L = E.layer(), onLayer = !toNew && L && L.type === "pixel" && !E.onMask(L) && !S.qm;
      const src = onLayer ? L.canvas : E.flattenCache(), hole = holeOf(S.sel);
      say("content-aware fill - working…");
      return new Promise((res) => setTimeout(() => {
        const id = ctx(src).getImageData(0, 0, S.w, S.h), out = R.inpaint(id.data, S.w, S.h, hole, { seed: 11 });
        const soft = S.sel;
        if (onLayer) {
          E.pxOp("content-aware fill", (c, g) => { const d = g.getImageData(0, 0, S.w, S.h); for (let i = 0; i < soft.length; i++) { const a = soft[i] / 255; if (!a) continue; for (let k = 0; k < 4; k++) d.data[i * 4 + k] = d.data[i * 4 + k] * (1 - a) + out[i * 4 + k] * a; } g.putImageData(d, 0, 0); });
        } else {
          E.structOp("content-aware fill (new layer)", () => {
            const n = E.makeLayer("Content-Aware Fill", S.w, S.h), g = ctx(n.canvas), d = g.createImageData(S.w, S.h);
            for (let i = 0; i < soft.length; i++) { if (!soft[i]) continue; for (let k = 0; k < 3; k++) d.data[i * 4 + k] = out[i * 4 + k]; d.data[i * 4 + 3] = out[i * 4 + 3] * soft[i] / 255; }
            g.putImageData(d, 0, 0);
            const A = E.layer(), at = A ? S.layers.indexOf(A) + 1 : S.layers.length; if (A) n.parent = A.type === "group" ? A.id : A.parent;
            S.layers.splice(at, 0, n); S.active = at;
          });
        }
        say("content-aware fill done"); res(true);
      }, 30));
    }
    function dlgCaFill() {
      if (!E.hasSel()) return say("select what to fill first");
      E.ui.dialog("Content-Aware Fill", `<div class="rw"><span>Output To</span><select id="caOut" style="grid-column:2/4"><option value="cur">Current Layer</option><option value="new">New Layer</option></select></div>
        <div style="color:var(--pc-dim);font-size:11px">Filled from the picture around the selection (PatchMatch, no AI). For a generated fill use ✨ AI ▸ Fill.</div>`,
      (d) => { caFill(d.querySelector("#caOut").value === "new"); });
    }
    E.caFill = caFill;

    /* ================================ HEALING: the copy blended (Poisson) ================================ */
    /** after a Healing Brush stroke: inside what the stroke changed, the source's TEXTURE with the destination's light */
    function healAfter(L, d, rect, px) {
      if (!rect || !px) return;
      const off = S.cloneOff || [0, 0], x0 = Math.max(0, rect.x - 2), y0 = Math.max(0, rect.y - 2), x1 = Math.min(S.w, rect.x + rect.w + 2), y1 = Math.min(S.h, rect.y + rect.h + 2), w = x1 - x0, h = y1 - y0;
      if (w < 3 || h < 3) return;
      const pre = ctx(d.copy).getImageData(x0, y0, w, h).data, now = ctx(L.canvas).getImageData(x0, y0, w, h), mask = new Uint8Array(w * h);
      for (let i = 0; i < mask.length; i++) { const j = i * 4; if (pre[j] !== now.data[j] || pre[j + 1] !== now.data[j + 1] || pre[j + 2] !== now.data[j + 2] || pre[j + 3] !== now.data[j + 3]) mask[i] = 255; }
      const sc = newCanvas(w, h); ctx(sc).drawImage(d.copy, -(x0 + off[0]), -(y0 + off[1]));
      const src = ctx(sc).getImageData(0, 0, w, h).data;
      const out = R.poisson(pre, src, mask, w, h, { iters: 500 });
      for (let i = 0; i < mask.length; i++) if (mask[i]) { const j = i * 4; now.data[j] = out[j]; now.data[j + 1] = out[j + 1]; now.data[j + 2] = out[j + 2]; }
      ctx(L.canvas).putImageData(now, x0, y0); L.ver = (L.ver || 0) + 1;
      if (px.rect && px.after) px.after = ctx(L.canvas).getImageData(px.rect.x, px.rect.y, px.rect.w, px.rect.h);
    }
    if (T.heal) T.heal.after = healAfter;

    /* ================================ SPOT HEALING: Content-Aware / Proximity Match ================================ */
    S.spotType = store.get("t.spotType", "ca");
    let spot = null;
    const baseSpot = T.spotheal || {};
    T.spotheal = {
      id: "spotheal", name: "Spot Healing Brush", brush: true, cursor: "none",
      options() { return (baseSpot.options ? baseSpot.options() : "") + `<span class="sep"></span><label>Type <select id="ptSpotType"><option value="ca"${S.spotType === "ca" ? " selected" : ""}>Content-Aware</option><option value="prox"${S.spotType !== "ca" ? " selected" : ""}>Proximity Match</option></select></label>`; },
      bindOptions(o) { if (baseSpot.bindOptions) baseSpot.bindOptions(o); const s2 = o.querySelector("#ptSpotType"); s2.onchange = () => { S.spotType = s2.value; store.set("t.spotType", s2.value); }; },
      down(e, fx, fy) {
        if (!pixelLayer()) return false;
        spot = { c: newCanvas(S.w, S.h), last: [fx, fy] };
        const g = ctx(spot.c); g.strokeStyle = g.fillStyle = "#000"; g.lineCap = g.lineJoin = "round"; g.lineWidth = S.size;
        g.beginPath(); g.arc(fx, fy, S.size / 2, 0, Math.PI * 2); g.fill(); E.drawOverlay();
      },
      move(e, fx, fy) { if (!spot) return; const g = ctx(spot.c); g.beginPath(); g.moveTo(spot.last[0], spot.last[1]); g.lineTo(fx, fy); g.stroke(); spot.last = [fx, fy]; E.drawOverlay(); },
      up() {
        if (!spot) return;
        const m0 = ctx(spot.c).getImageData(0, 0, S.w, S.h).data; spot = null;
        let hole = new Uint8Array(S.w * S.h); for (let i = 0; i < hole.length; i++) hole[i] = m0[i * 4 + 3] > 20 ? 255 : 0;
        if (E.hasSel()) hole = P.combine(hole, S.sel, "intersect");
        const bb = P.bbox(hole, S.w, S.h); if (!bb) { E.drawOverlay(); return; }
        const L = pixelLayer(); if (!L) { E.drawOverlay(); return; }
        if (S.spotType === "ca") {
          const id = ctx(L.canvas).getImageData(0, 0, S.w, S.h), dil = P.morph(hole, S.w, S.h, 2), out = R.inpaint(id.data, S.w, S.h, dil, { seed: 5, margin: 2 }), fm = P.feather(dil, S.w, S.h, 3);
          E.pxOp("spot healing", (c, g) => { const d = g.getImageData(0, 0, S.w, S.h); for (let i = 0; i < fm.length; i++) { const a = Math.max(fm[i], hole[i]) / 255; if (!a) continue; for (let k = 0; k < 4; k++) d.data[i * 4 + k] = d.data[i * 4 + k] * (1 - a) + out[i * 4 + k] * a; } g.putImageData(d, 0, 0); });
          return;
        }
        // Proximity Match (2.389.0's): filled from the edge inwards, a little grain
        const Rr = P.contextRect(bb, S.w, S.h, Math.max(16, Math.round(S.size * 1.5)), 1);
        E.pxOp("spot healing", (c, g) => {
          const id = g.getImageData(Rr.x, Rr.y, Rr.w, Rr.h), hm = P.cropMask(hole, S.w, Rr), orig = Uint8ClampedArray.from(id.data);
          P.fillHole(id.data, hm, Rr.w, Rr.h);
          const fm = P.feather(P.morph(hm, Rr.w, Rr.h, 2), Rr.w, Rr.h, 4), rnd = E.B.rng(Rr.x * 31 + Rr.y);
          for (let i = 0; i < fm.length; i++) {
            const a = fm[i] / 255; if (!a) { for (let k = 0; k < 4; k++) id.data[i * 4 + k] = orig[i * 4 + k]; continue; }
            const nz = (rnd() - 0.5) * 6 * a;
            for (let k = 0; k < 3; k++) id.data[i * 4 + k] = orig[i * 4 + k] * (1 - a) + (id.data[i * 4 + k] + nz) * a;
            id.data[i * 4 + 3] = Math.max(orig[i * 4 + 3], id.data[i * 4 + 3] * a);
          }
          g.putImageData(id, Rr.x, Rr.y);
        });
      },
      leave() { spot = null; },
    };
    E.overlayHooks.push((g) => { if (spot && S.tool === "spotheal") { g.globalAlpha = 0.45; const t = newCanvas(S.w, S.h), tg = ctx(t); tg.drawImage(spot.c, 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#ff3b3b"; tg.fillRect(0, 0, S.w, S.h); g.drawImage(t, 0, 0); g.globalAlpha = 1; } });

    /* ================================ PATCH / CONTENT-AWARE MOVE ================================ */
    let pt = null;              // {phase: "draw" | "drag", pts, x0, y0, dx, dy}
    S.patchMode = store.get("t.patchMode", "source"); S.cmoveMode = store.get("t.cmoveMode", "move");
    // 2.465.0: Patch Normal (Diffusion, Transparent) / Content-Aware (Structure, Color); Content-Aware Move's Structure / Color
    const PT = { type: store.get("t.patchType", "normal"), diff: +store.get("t.patchDiff", 5) || 5, transp: !!store.get("t.patchTransp", false), st: +store.get("t.patchSt", 4) || 4, col: +store.get("t.patchCol", 0) || 0,
      mst: +store.get("t.cmoveSt", 4) || 4, mcol: +store.get("t.cmoveCol", 0) || 0 };
    const num = (id, v, lo, hi, tip) => `<input type="number" id="${id}" min="${lo}" max="${hi}" step="1" value="${v}" style="width:44px" title="${tip}">`;
    function patchLike(id, name) {
      T[id] = {
        id, name, cursor: "crosshair",
        options() {
          return id === "patch"
            ? `<label title="Normal = the texture blended in; Content-Aware = rebuilt from the place it was dragged to (PatchMatch)">Patch <select id="ptPType"><option value="normal"${PT.type === "normal" ? " selected" : ""}>Normal</option><option value="ca"${PT.type === "ca" ? " selected" : ""}>Content-Aware</option></select></label>`
              + `<select id="ptPMode"${PT.type === "ca" ? " disabled" : ""} title="Source = drag it onto good texture; Destination = drag the good part onto it"><option value="source"${S.patchMode === "source" ? " selected" : ""}>Source</option><option value="dest"${S.patchMode === "dest" ? " selected" : ""}>Destination</option></select>`
              + (PT.type === "ca"
                ? `<label>Structure ${num("ptPSt", PT.st, 1, 7, "1-7: how strictly the patch keeps the pattern of where it came from (7 = only from there)")}</label><label>Color ${num("ptPCol", PT.col, 0, 10, "0-10: how much its colours blend into the surroundings")}</label>`
                : `<label><input type="checkbox" id="ptPTr"${PT.transp ? " checked" : ""}> Transparent</label><label>Diffusion ${num("ptPDif", PT.diff, 1, 7, "1-7: how far the edge's light and colour spread in (low for grain / fine detail, high for smooth)")}</label>`)
            : `<label>Mode <select id="ptMMode"><option value="move"${S.cmoveMode === "move" ? " selected" : ""}>Move (the hole is filled)</option><option value="extend"${S.cmoveMode === "extend" ? " selected" : ""}>Extend (a copy)</option></select></label>`
              + `<label>Structure ${num("ptMSt", PT.mst, 1, 7, "1-7: 7 = the moved part kept exactly, lower = its edge adapts further in")}</label><label>Color ${num("ptMCol", PT.mcol, 0, 10, "0-10: how much the moved part's colours blend to its new place")}</label>`;
        },
        bindOptions(o) {
          const a = o.querySelector("#ptPMode"); if (a) a.onchange = () => { S.patchMode = a.value; store.set("t.patchMode", a.value); };
          const b = o.querySelector("#ptMMode"); if (b) b.onchange = () => { S.cmoveMode = b.value; store.set("t.cmoveMode", b.value); };
          const ty = o.querySelector("#ptPType"); if (ty) ty.onchange = () => { PT.type = ty.value; store.set("t.patchType", ty.value); E.renderOptions(); };
          const bindN = (sel, key, sk, lo, hi) => { const i = o.querySelector(sel); if (!i) return; i.addEventListener("keydown", (ev) => ev.stopPropagation()); i.onchange = () => { PT[key] = Math.max(lo, Math.min(hi, Math.round(+i.value || lo))); i.value = PT[key]; store.set(sk, PT[key]); }; };
          bindN("#ptPSt", "st", "t.patchSt", 1, 7); bindN("#ptPCol", "col", "t.patchCol", 0, 10); bindN("#ptPDif", "diff", "t.patchDiff", 1, 7);
          bindN("#ptMSt", "mst", "t.cmoveSt", 1, 7); bindN("#ptMCol", "mcol", "t.cmoveCol", 0, 10);
          const tr = o.querySelector("#ptPTr"); if (tr) tr.onchange = () => { PT.transp = tr.checked; store.set("t.patchTransp", tr.checked); };
        },
        down(e, fx, fy) {
          if (!pixelLayer()) return false;
          if (E.hasSel() && S.sel[Math.floor(fy) * S.w + Math.floor(fx)] > 127) { pt = { phase: "drag", x0: fx, y0: fy, dx: 0, dy: 0, edges: null }; return; }
          pt = { phase: "draw", pts: [[fx, fy]] };
        },
        move(e, fx, fy) {
          if (!pt) return;
          if (pt.phase === "draw") { const l = pt.pts[pt.pts.length - 1]; if (Math.hypot(fx - l[0], fy - l[1]) > 1.5) pt.pts.push([fx, fy]); E.drawOverlay(); return; }
          pt.dx = Math.round(fx - pt.x0); pt.dy = Math.round(fy - pt.y0); E.drawOverlay();
        },
        up() {
          const p = pt; pt = null; if (!p) return;
          if (p.phase === "draw") { if (p.pts.length > 3) E.applyShape(P.polygonMask(p.pts, S.w, S.h), "replace", name + " area"); else say(`${name}: draw round what to fix, then drag it`); E.drawOverlay(); return; }
          if (!p.dx && !p.dy) { E.drawOverlay(); return; }
          if (id === "patch") runPatch(p.dx, p.dy); else runMove(p.dx, p.dy);
        },
        leave() { pt = null; },
      };
    }
    patchLike("patch", "Patch");
    patchLike("cmove", "Content-Aware Move");
    E.overlayHooks.push((g, px) => {
      if (!pt) return;
      if (pt.phase === "draw" && pt.pts.length > 1) { g.strokeStyle = "#fff"; g.lineWidth = px; g.setLineDash([3 * px, 3 * px]); g.beginPath(); pt.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]); return; }
      if (pt.phase === "drag" && E.selCanvas()) { g.save(); g.globalAlpha = 0.55; const t = newCanvas(S.w, S.h), tg = ctx(t); tg.drawImage(E.selCanvas(), 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#4fc3ff"; tg.fillRect(0, 0, S.w, S.h); g.drawImage(t, pt.dx, pt.dy); g.restore(); }
    });
    /** Patch: Source = the selected area takes the texture from where it was dragged to; Destination = the selected
     *  texture goes where it was dragged to. Both blended (Poisson) */
    function runPatch(dx, dy) {
      const L = pixelLayer(); if (!L) return;
      const sel = holeOf(S.sel), w = S.w, h = S.h, img = ctx(L.canvas).getImageData(0, 0, w, h).data;
      const put = (out, msg) => { E.pxOp("patch", (c, g) => { const d = g.createImageData(w, h); d.data.set(out); g.putImageData(d, 0, 0); }); say(msg); };
      if (PT.type === "ca") {
        // 2.465.0: Content-Aware - the selection rebuilt from where it was dragged to (Structure / Color)
        say("content-aware patch - working…");
        setTimeout(() => { const near = P.shift(sel, w, h, dx, dy); /* the selection's shape where it was dragged to */ put(R.patchCA(img, w, h, sel, near, { structure: PT.st, color: PT.col, seed: 13 }), `patched (Content-Aware, Structure ${PT.st}, Color ${PT.col})`); }, 30);
        return;
      }
      let mask, src;
      if (S.patchMode === "source") { mask = sel; src = shift(img, w, h, -dx, -dy); }
      else { mask = P.shift(sel, w, h, dx, dy); src = shift(img, w, h, dx, dy); }
      put(R.patchNormal(img, w, h, mask, src, { diffusion: PT.diff, transparent: PT.transp }), "patched - its texture from the other place, its light from here" + (PT.transp ? " (transparent)" : ""));
    }
    /** rgba moved by (dx, dy): out(x, y) = in(x - dx, y - dy) (edges repeat) */
    function shift(img, w, h, dx, dy) {
      const o = new Uint8ClampedArray(img.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const X = Math.min(w - 1, Math.max(0, x - dx)), Y = Math.min(h - 1, Math.max(0, y - dy)), a = (y * w + x) * 4, b = (Y * w + X) * 4; o[a] = img[b]; o[a + 1] = img[b + 1]; o[a + 2] = img[b + 2]; o[a + 3] = img[b + 3]; }
      return o;
    }
    function runMove(dx, dy) {
      const L = pixelLayer(); if (!L) return;
      const w = S.w, h = S.h, sel = holeOf(S.sel), img = ctx(L.canvas).getImageData(0, 0, w, h).data;
      say("content-aware move - working…");
      setTimeout(() => {
        let base = img;
        if (S.cmoveMode === "move") base = R.inpaint(img, w, h, P.morph(sel, w, h, 2), { seed: 9 });
        const dest = P.shift(sel, w, h, dx, dy), moved = shift(img, w, h, dx, dy);
        // the object itself copied exactly; only a ring round it blended into its new surroundings (2.465.0: Structure =
        // how thin that ring is - 4 = 3 px as before, 7 = 1 px; Color = how much the inside's colours follow the blend too)
        const rw = Math.max(1, 7 - PT.mst), kc = PT.mcol / 10;
        const ring = P.combine(P.morph(dest, w, h, rw), P.morph(dest, w, h, -rw), "subtract");
        const blended = R.poisson(base, moved, P.morph(dest, w, h, rw), w, h, { iters: 500 }), out = Uint8ClampedArray.from(base);
        for (let i = 0; i < dest.length; i++) { if (dest[i] && !ring[i]) for (let k = 0; k < 4; k++) out[i * 4 + k] = k < 3 ? moved[i * 4 + k] * (1 - kc) + blended[i * 4 + k] * kc : moved[i * 4 + k]; else if (ring[i]) for (let k = 0; k < 4; k++) out[i * 4 + k] = blended[i * 4 + k]; }
        const list = [];
        const copy = E.beginPx(L); ctx(L.canvas).putImageData(new ImageData(out, w, h), 0, 0);
        const px = E.endPx(L, copy, null, "content-aware move"); if (px) list.push(px);
        const before = Uint8Array.from(S.sel); E.setSel(dest, true); list.push({ t: "sel", before, after: Uint8Array.from(dest) });
        E.push({ t: "multi", list, label: "content-aware move" }); E.refresh(); E.renderLayersPanel();
        say(S.cmoveMode === "move" ? "moved - the old place filled from around it" : "extended - a blended copy");
      }, 30);
    }

    /* ================================ RED EYE ================================ */
    S.redPupil = +store.get("t.redPupil", 50) || 50; S.redDark = +store.get("t.redDark", 50) || 50;
    T.redeye = {
      id: "redeye", name: "Red Eye", cursor: "crosshair",
      options: () => `<label title="How big the pupil may be (%)">Pupil Size <input type="number" id="ptRP" min="1" max="100" value="${S.redPupil}"></label><label title="How dark it becomes (%)">Darken Amount <input type="number" id="ptRD" min="1" max="100" value="${S.redDark}"></label>`,
      bindOptions(o) { o.querySelector("#ptRP").onchange = (e) => { S.redPupil = Math.max(1, Math.min(100, +e.target.value || 50)); store.set("t.redPupil", S.redPupil); }; o.querySelector("#ptRD").onchange = (e) => { S.redDark = Math.max(1, Math.min(100, +e.target.value || 50)); store.set("t.redDark", S.redDark); }; },
      down(e, fx, fy) {
        const L = pixelLayer(); if (!L) return false;
        const id = ctx(L.canvas).getImageData(0, 0, S.w, S.h), r = R.redEye(id.data, S.w, S.h, fx, fy, { r: 10 + S.redPupil * 0.8, darken: S.redDark / 100 });
        if (!r.n) { say("no red pupil there - click in the middle of the red"); return false; }
        E.pxOp("red eye", (c, g) => { id.data.set(r.rgba); g.putImageData(id, 0, 0); });
        say(`red eye: ${r.n} px darkened`); return false;
      },
    };

    /* ================================ MIXER BRUSH / BACKGROUND ERASER (dab tools) ================================ */
    S.mixWet = +store.get("t.mixWet", 50); S.mixLoad = +store.get("t.mixLoad", 50); S.mixMix = +store.get("t.mixMix", 50); S.mixClean = store.get("t.mixClean", true) !== false;
    S.bgTol = +store.get("t.bgTol", 50) || 50; S.bgOnce = !!store.get("t.bgOnce", false); S.bgProtect = !!store.get("t.bgProtect", false);
    if (H) {
      let mixState = null;
      const hexRgb = (h) => E.B.hexRgb(h);
      H.dabTool("mixer", "Mixer Brush", "", () => {
        if (!mixState || S.mixClean) mixState = { c: hexRgb(S.fg), load: 1 };
        mixState.load = 1;
        return (Lc, x, y, n, flow) => {
          const tw = H.weights(n), N = tw.n, sx = Math.round(x - N / 2), sy = Math.round(y - N / 2);
          const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(Lc.width, sx + N), y1 = Math.min(Lc.height, sy + N); if (x1 <= x0 || y1 <= y0) return;
          const g = ctx(Lc), id = g.getImageData(x0, y0, x1 - x0, y1 - y0), d = id.data;
          let r = 0, gg = 0, b = 0, cnt = 0;
          for (let j = 0; j < y1 - y0; j++) for (let i = 0; i < x1 - x0; i++) { const wt = tw.w[(j + y0 - sy) * N + (i + x0 - sx)]; if (wt < 0.3) continue; const k = (j * (x1 - x0) + i) * 4; if (!d[k + 3]) continue; r += d[k]; gg += d[k + 1]; b += d[k + 2]; cnt++; }
          if (cnt) mixState.c = R.mixColor(mixState.c, [r / cnt, gg / cnt, b / cnt], S.mixWet / 100, S.mixMix / 100);
          const a = Math.max(0, Math.min(1, flow * S.opacity * (0.25 + 0.75 * mixState.load)));
          mixState.load *= 1 - (1 - S.mixLoad / 100) * 0.08;
          for (let j = 0; j < y1 - y0; j++) for (let i = 0; i < x1 - x0; i++) {
            const wt = tw.w[(j + y0 - sy) * N + (i + x0 - sx)] * a; if (wt <= 0) continue; const k = (j * (x1 - x0) + i) * 4;
            for (let c = 0; c < 3; c++) d[k + c] = d[k + c] * (1 - wt) + mixState.c[c] * wt; d[k + 3] = d[k + 3] + (255 - d[k + 3]) * wt;
          }
          g.putImageData(id, x0, y0);
        };
      }, () => H.rangeOpt("ptWet", "Wet", 0, 100, S.mixWet, "How much paint it picks up from the canvas (%)") + H.rangeOpt("ptLoad", "Load", 1, 100, S.mixLoad, "How long the paint lasts (%)")
          + H.rangeOpt("ptMix", "Mix", 0, 100, S.mixMix, "The canvas's share of the mix (%)") + `<label title="A clean brush (the foreground) for each stroke"><input type="checkbox" id="ptMixClean" ${S.mixClean ? "checked" : ""}> Clean after each stroke</label>`,
      (o) => { H.bindRange(o, "ptWet", (v) => { S.mixWet = v; store.set("t.mixWet", v); }); H.bindRange(o, "ptLoad", (v) => { S.mixLoad = v; store.set("t.mixLoad", v); }); H.bindRange(o, "ptMix", (v) => { S.mixMix = v; store.set("t.mixMix", v); });
        const c = o.querySelector("#ptMixClean"); c.onchange = () => { S.mixClean = c.checked; store.set("t.mixClean", c.checked); }; });
      let bgSample = null;
      H.dabTool("bgerase", "Background Eraser", "", (e, fx, fy) => {
        const L = E.layer(); if (!L || L.type !== "pixel" || E.onMask(L)) { say("the Background Eraser works on a pixel layer's pixels"); return null; }
        const p = ctx(L.canvas).getImageData(Math.max(0, Math.min(S.w - 1, Math.round(fx))), Math.max(0, Math.min(S.h - 1, Math.round(fy))), 1, 1).data; bgSample = [p[0], p[1], p[2]];
        const prot = S.bgProtect ? hexRgb(S.fg) : null, tol = S.bgTol * 2.2;
        return (Lc, x, y, n) => {
          const r = n / 2, x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r)), x1 = Math.min(Lc.width, Math.ceil(x + r) + 1), y1 = Math.min(Lc.height, Math.ceil(y + r) + 1); if (x1 <= x0 || y1 <= y0) return;
          const g = ctx(Lc), id = g.getImageData(x0, y0, x1 - x0, y1 - y0);
          if (!S.bgOnce) { const cx = Math.round(x) - x0, cy = Math.round(y) - y0; if (cx >= 0 && cy >= 0 && cx < x1 - x0 && cy < y1 - y0) { const k = (cy * (x1 - x0) + cx) * 4; if (id.data[k + 3]) bgSample = [id.data[k], id.data[k + 1], id.data[k + 2]]; } }
          R.bgEraseDab(id.data, x1 - x0, y1 - y0, x - x0, y - y0, r, bgSample, tol, prot);
          g.putImageData(id, x0, y0);
        };
      }, () => `<label>Sampling <select id="ptBgS"><option value="cont"${S.bgOnce ? "" : " selected"}>Continuous</option><option value="once"${S.bgOnce ? " selected" : ""}>Once</option></select></label>`
          + H.rangeOpt("ptBgTol", "Tolerance", 1, 100, S.bgTol, "How different a colour may be and still go (%)") + `<label title="The foreground colour is never erased"><input type="checkbox" id="ptBgP" ${S.bgProtect ? "checked" : ""}> Protect Foreground Color</label>`,
      (o) => { o.querySelector("#ptBgS").onchange = (e) => { S.bgOnce = e.target.value === "once"; store.set("t.bgOnce", S.bgOnce); }; H.bindRange(o, "ptBgTol", (v) => { S.bgTol = v; store.set("t.bgTol", v); });
        o.querySelector("#ptBgP").onchange = (e) => { S.bgProtect = e.target.checked; store.set("t.bgProtect", S.bgProtect); }; });
    }

    /* ================================ MAGIC ERASER ================================ */
    T.magicerase = {
      id: "magicerase", name: "Magic Eraser", cursor: "crosshair",
      options: () => `<label title="Magic-wand tolerance (0-255)">Tolerance <input type="number" id="ptMeT" min="0" max="255" value="${S.tol}"></label><label><input type="checkbox" id="ptMeC" ${S.contiguous ? "checked" : ""}> Contiguous</label>`,
      bindOptions(o) { o.querySelector("#ptMeT").onchange = (e) => { S.tol = Math.max(0, Math.min(255, +e.target.value || 0)); }; o.querySelector("#ptMeC").onchange = (e) => { S.contiguous = e.target.checked; }; },
      down(e, fx, fy) {
        const L = pixelLayer(); if (!L) return false;
        const x = Math.floor(fx), y = Math.floor(fy); if (x < 0 || y < 0 || x >= S.w || y >= S.h) return false;
        const d = ctx(L.canvas).getImageData(0, 0, S.w, S.h).data;
        let m = P.wand(d, S.w, S.h, x, y, S.tol, S.contiguous);
        if (E.hasSel()) m = P.combine(m, S.sel, "intersect");
        let n = 0; for (const v of m) if (v) n++;
        E.pxOp("magic eraser", (c, g) => { const id = g.getImageData(0, 0, S.w, S.h); for (let i = 0; i < m.length; i++) if (m[i]) id.data[i * 4 + 3] = id.data[i * 4 + 3] * (1 - m[i] / 255); g.putImageData(id, 0, 0); });
        say(`magic eraser: ${n} px cleared`); return false;
      },
    };

    /* ---------------- commands ---------------- */
    if (E.ui.addCmd) {
      const C = E.ui.addCmd;
      C("edit.cafill", "Content-Aware Fill…", "", dlgCaFill, { enabled: () => E.hasSel() }, ["Edit", "edit.fill"]);
      for (const [id, n] of [["patch", "Patch Tool"], ["cmove", "Content-Aware Move Tool"], ["redeye", "Red Eye Tool"], ["mixer", "Mixer Brush Tool"], ["bgerase", "Background Eraser Tool"], ["magicerase", "Magic Eraser Tool"]])
        C("tool." + id, n, "", () => E.setTool(id), {});
    }
    E.heal = { caFill, runPatch, runMove, healAfter, patchOpts: PT };
  }
  const api = { install };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCHeal = api;
})(typeof window !== "undefined" ? window : globalThis);
