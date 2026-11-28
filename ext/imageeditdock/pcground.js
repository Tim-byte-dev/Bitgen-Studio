/* pcground.js — 🛤 GROUND & PERSPECTIVE (3.14.0), window.PCGround (E.ground once installed).
 *
 * Tim (verbatim): "horse layer will be a full horse adjusted to the position of the road, we can move the horse up and down
 * the road, and maybe add a perspective tool?"
 *
 *   Layer ▸ 🛤 Ground & Perspective Tool    a tool: drag a layer (an object standing on the ground) - it moves, and its SIZE
 *                                           follows how far its feet are from the horizon: up the road toward the horizon
 *                                           it gets smaller, down toward you bigger (scaled about its feet, from the pixels
 *                                           it had when the drag began - one resample a drag, one undo step).
 *                                           Its 🌑 shadow layer (below it) goes with it. Shift+drag (or "Set the horizon")
 *                                           puts the horizon line where you drag; the number box types it.
 *   Layer ▸ 🌑 Add Ground Shadow            a soft shadow under the active layer's feet, on its own layer just below it,
 *                                           linked so the tool moves it too.
 * The horizon is the document's (S.groundH, saved with the 🏞 Scene's layers as each one's ground.h) - 🏞 Scene in Layers
 * (pclayerscene.js) sets it from its plan.
 * Pure (Node: scripts/test-31400.js): depthScale, footOf, shadowShape, horizonOf.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  /** how much bigger / smaller a thing gets when its feet go from y0 to y1, the horizon at h (1 = the same); its size is
   *  proportional to the distance below the horizon (a flat ground, a level camera). Feet at / above the horizon: 0.05. */
  function depthScale(y0, y1, h) {
    const d0 = y0 - h, d1 = y1 - h;
    if (!(d0 > 1)) return 1;                                  // it was not standing below the horizon: no perspective
    return Math.max(0.05, Math.min(20, Math.max(0.5, d1) / d0));
  }
  /** a box's feet: the middle of its bottom edge */
  const footOf = (b) => [b.x + b.w / 2, b.y + b.h];
  /** a soft shadow ellipse under a box (its feet): {cx, cy, rx, ry, blur} */
  function shadowShape(b) {
    const [cx, cy] = footOf(b), rx = Math.max(4, b.w * 0.45), ry = Math.max(2, b.w * 0.07);
    return { cx, cy: cy - ry * 0.2, rx, ry, blur: Math.max(2, Math.round(ry * 0.8)) };
  }
  /** the horizon for a document: the one set, else 45 % of the height */
  const horizonOf = (S) => (Number.isFinite(S.groundH) ? S.groundH : Math.round((S.h || 0) * 0.45));
  const pure = { depthScale, footOf, shadowShape, horizonOf };

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, store = E.store, doc = E.doc || root.document;
    const say = (t) => (E.say ? E.say(t) : null);
    const shadowOf = (L) => (L && L.groundShadow ? S.layers.find((x) => x.id === L.groundShadow) || null : null);
    const ownerOf = (Sh) => S.layers.find((x) => x.groundShadow === Sh.id) || null;

    /** draw `src` into `c` scaled by k about the point `f`, its feet landing on `g` */
    function place(c, src, k, f, g) {
      const x = c.getContext("2d"); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
      x.imageSmoothingQuality = "high"; x.setTransform(k, 0, 0, k, g[0] - k * f[0], g[1] - k * f[1]); x.drawImage(src, 0, 0); x.restore();
    }
    /** paint a shadow for the box into a canvas */
    function paintShadow(c, b, opacity) {
      const sh = shadowShape(b), g = c.getContext("2d");
      g.save(); g.clearRect(0, 0, c.width, c.height); if ("filter" in g) g.filter = `blur(${sh.blur}px)`;
      g.fillStyle = `rgba(0,0,0,${opacity == null ? 0.45 : opacity})`; g.beginPath(); g.ellipse(sh.cx, sh.cy, sh.rx, sh.ry, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    /** 🌑 a shadow layer just below L, linked to it -> the shadow layer */
    function addShadow(L, o) {
      if (!L || L.type !== "pixel") { say("🌑 pick a picture layer (an object)"); return null; }
      const b = E.alphaBox(L.canvas); if (!b || b.w < 2) { say("🌑 the layer is empty"); return null; }
      let Sh = shadowOf(L);
      E.structOp("🌑 ground shadow", () => {
        if (!Sh) {
          Sh = E.makeLayer("🌑 " + L.name.replace(/^[^\p{L}\p{N}]+\s*/u, "") + " shadow", S.w, S.h);
          Sh.blend = "multiply"; Sh.groundOf = L.id;
          S.layers = E.D.insert(S.layers, Sh, L.id, false);          // above L ...
          const i = S.layers.indexOf(L), j = S.layers.indexOf(Sh);    // ... then swapped below it (siblings, side by side)
          if (j === i + 1) { S.layers[i] = Sh; S.layers[j] = L; }
          L.groundShadow = Sh.id;
        }
        paintShadow(Sh.canvas, b, o && o.opacity); Sh.ver = (Sh.ver || 0) + 1;
        S.active = S.layers.indexOf(L);
      });
      return Sh;
    }

    let st = null;
    E.tools.ground = {
      id: "ground", name: "🛤 Ground & Perspective", cursor: "move",
      options: () => `<label title="Where the horizon is (px from the top) - Shift+drag on the picture to set it">Horizon <input type="number" id="grH" min="0" style="width:70px" value="${Math.round(horizonOf(S))}"></label>
        <label title="Drag on the picture to put the horizon line there"><input type="checkbox" id="grSet"> Set the horizon</label>
        <label title="Off: it only moves"><input type="checkbox" id="grScale"${store.get("ground.scale", true) !== false ? " checked" : ""}> Size with distance</label>
        <button class="ghost" id="grShadow" title="A soft shadow under the active layer's feet, on its own layer below it">🌑 Shadow</button>
        <span style="color:var(--pc-dim)">Drag an object along the ground: smaller toward the horizon, bigger toward you</span>`,
      bindOptions(o) {
        const h = o.querySelector("#grH"); if (h) h.onchange = () => { const v = +h.value; if (Number.isFinite(v)) { S.groundH = Math.max(0, Math.min(S.h, v)); E.drawOverlay(); } };
        const sc = o.querySelector("#grScale"); if (sc) sc.onchange = () => store.set("ground.scale", sc.checked);
        const sb = o.querySelector("#grShadow"); if (sb) sb.onclick = () => { addShadow(E.layer()); E.refresh(); };
      },
      down(e, fx, fy) {
        const setH = e.shiftKey || !!(doc.getElementById("grSet") || {}).checked;
        if (setH) { st = { h: true }; S.groundH = Math.round(fy); E.drawOverlay(); return true; }
        let L = E.layer(); if (L && L.groundOf) L = S.layers.find((x) => x.id === L.groundOf) || L;   // a shadow picked: its owner moves
        if (!L || L.type !== "pixel") { say("🛤 pick the object's layer (a picture layer) in the Layers panel"); return false; }
        const b = E.alphaBox(L.canvas); if (!b || b.w < 2) { say("🛤 the layer is empty"); return false; }
        const Sh = shadowOf(L);
        st = { L, foot: footOf(b), copy: E.beginPx(L), x0: fx, y0: fy, Sh, shCopy: Sh ? E.beginPx(Sh) : null, k: 1, scale: store.get("ground.scale", true) !== false };
        return true;
      },
      move(e, fx, fy) {
        if (!st) return;
        if (st.h) { S.groundH = Math.max(0, Math.min(S.h, Math.round(fy))); E.drawOverlay(); return; }
        const g = [st.foot[0] + fx - st.x0, st.foot[1] + fy - st.y0];
        st.k = st.scale ? depthScale(st.foot[1], g[1], horizonOf(S)) : 1;
        place(st.L.canvas, st.copy, st.k, st.foot, g); st.L.ver = (st.L.ver || 0) + 1;
        if (st.Sh) { place(st.Sh.canvas, st.shCopy, st.k, st.foot, g); st.Sh.ver = (st.Sh.ver || 0) + 1; }
        E.refresh();
      },
      up() {
        if (!st) return; const s = st; st = null;
        if (s.h) { say(`🛤 horizon at ${Math.round(S.groundH)} px`); E.renderOptions && E.renderOptions(); return; }
        const list = [E.endPx(s.L, s.copy, null, "🛤 ground move"), s.Sh ? E.endPx(s.Sh, s.shCopy, null, "🛤 ground move") : null].filter(Boolean);
        if (list.length) E.push({ t: "multi", list, label: "🛤 ground move" });
        if (s.L.ground) s.L.ground = Object.assign({}, s.L.ground, { h: horizonOf(S) });
        E.refresh(); E.renderLayersPanel();
        if (Math.abs(s.k - 1) > 0.01) say(`🛤 ${s.L.name}: ${Math.round(s.k * 100)} % of its size`);
      },
    };
    // the horizon line while the tool is on
    E.overlayHooks.push((g, px) => {
      if (S.tool !== "ground" || !S.w) return;
      const y = horizonOf(S);
      g.save(); g.lineWidth = 1.5 * px; g.setLineDash([8 * px, 6 * px]); g.strokeStyle = "#ff9b2f"; g.beginPath(); g.moveTo(0, y); g.lineTo(S.w, y); g.stroke();
      g.setLineDash([]); g.font = `${12 * px}px system-ui, sans-serif`; g.fillStyle = "#ff9b2f"; g.textBaseline = "bottom"; g.fillText("horizon", 6 * px, y - 3 * px); g.restore();
    });
    E.ui.addCmd("layer.groundtool", "🛤 Ground & Perspective Tool", "", () => { if (!S.w) return say("open a picture first"); E.setTool("ground"); }, {}, ["Layer", "layer.ming"]);
    E.ui.addCmd("layer.groundshadow", "🌑 Add Ground Shadow", "", () => { addShadow(E.layer()); E.refresh(); }, { enabled: () => !!(E.layer() && E.layer().type === "pixel") }, ["Layer", "layer.groundtool"]);
    E.ground = { addShadow, horizon: () => horizonOf(S), setHorizon: (y) => { S.groundH = y; E.drawOverlay(); }, shadowOf, ownerOf };
  }

  const PCGround = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCGround;
  else root.PCGround = PCGround;
})(typeof window !== "undefined" ? window : globalThis);
