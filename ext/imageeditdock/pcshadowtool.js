/* bitGen Studio — image editor: the INTERACTIVE DROP SHADOW TOOL (2.829.0). Tim: "make the gradient and dropshadow tool interactive
 * just like coreldraws tools (user clicks in a shape and drags the gradient or drop-shadow)" (the gradient half went in 2.821.0) +
 * "do the image-editor additions".
 *
 *   The Drop Shadow tool (in the Gradient tool's group, G): press in a layer (a shape, text, a picture, a WP layer …) and drag -
 *   the shadow follows the pointer: its offset from the press = the layer style's Drop Shadow distance + angle (pcdoc
 *   STYLE_DEFAULTS.shadow {on, color, opacity, angle, distance, size}; dx = -cos(angle) * distance, dy = sin(angle) * distance).
 *   One undo step per drag (E.liveSet -> E.commitLive). The active layer's shadow shows a line from where it was pulled to a
 *   square handle at its end - drag the handle to move it again. The options bar: Blur (size), Opacity, Colour (they change the
 *   active layer's shadow at once) and ✕ Remove. Esc lets go; nothing else is changed.
 */
(function (root) {
  "use strict";
  /** a drag from (x0, y0) to (x1, y1) as a shadow's {distance, angle} (the angle Photoshop-style: degrees, the light's side) */
  function geom(x0, y0, x1, y1) {
    const ox = x1 - x0, oy = y1 - y0, d = Math.hypot(ox, oy);
    let a = Math.atan2(oy, -ox) * 180 / Math.PI; if (a < 0) a += 360;
    return { distance: Math.round(d), angle: Math.round(a) % 360 };
  }
  /** a shadow's offset {dx, dy} from its {distance, angle} (as pcdoc draws it) */
  function offset(sh) { const a = (sh.angle || 0) * Math.PI / 180, d = sh.distance || 0; return { dx: -Math.cos(a) * d, dy: Math.sin(a) * d }; }

  function install(E) {
    const S = E.S, D = root.PCDoc, win = root;
    if (!E.tools || !D) return;
    const store = { get: (k, d) => { try { const v = win.localStorage.getItem("pc.ds." + k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { win.localStorage.setItem("pc.ds." + k, String(v)); } catch (e) { /* fine */ } } };
    const opt = { size: +store.get("size", 10), opacity: +store.get("opacity", 75), color: store.get("color", "#000000") };
    const anchors = new WeakMap();                        // where each layer's shadow was pulled from (the handle's line starts there)
    let drag = null;
    const say = (t) => (E.say ? E.say(t) : E.ui && E.ui.status ? E.ui.status(t) : null);
    const L = () => E.layer();
    const shadowOf = (Ly) => (Ly && Ly.styles && Ly.styles.shadow && Ly.styles.shadow.on ? Ly.styles.shadow : null);
    function centre(Ly) {
      if (Ly.doc) return { x: Ly.doc.x + Ly.doc.w / 2, y: Ly.doc.y + Ly.doc.h / 2 };
      const c = Ly.canvas; if (!c) return { x: S.w / 2, y: S.h / 2 };
      try {                                               // the middle of what the layer draws (a coarse look, every 4th pixel)
        const g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y += 4) for (let x = 0; x < c.width; x += 4) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        if (x1 >= 0) return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
      } catch (e) { /* fine */ }
      return { x: S.w / 2, y: S.h / 2 };
    }
    const anchorOf = (Ly) => anchors.get(Ly) || centre(Ly);
    function handleOf(Ly) { const sh = shadowOf(Ly); if (!sh) return null; const a = anchorOf(Ly), o = offset(sh); return { ax: a.x, ay: a.y, x: a.x + o.dx, y: a.y + o.dy }; }
    const near = (x, y, h) => h && Math.hypot(x - h.x, y - h.y) <= 9 / (S.zoom || 1);
    function put(Ly, x0, y0, x1, y1) {
      const gm = geom(x0, y0, x1, y1);
      E.liveSet(Ly, (x) => {
        const st = x.styles = Object.assign({}, x.styles || {}), old = st.shadow || D.STYLE_DEFAULTS.shadow;
        st.shadow = Object.assign({}, D.STYLE_DEFAULTS.shadow, old, { on: true, angle: gm.angle, distance: gm.distance, size: opt.size, opacity: opt.opacity / 100, color: opt.color });
      });
      return gm;
    }
    function setOpt(label) {                              // the options bar changes the active layer's shadow at once
      const Ly = L(); if (!shadowOf(Ly)) return;
      E.setLayer(Ly, label, (x) => { x.styles = Object.assign({}, x.styles); x.styles.shadow = Object.assign({}, x.styles.shadow, { size: opt.size, opacity: opt.opacity / 100, color: opt.color }); });
    }
    E.tools.dropshadow = {
      id: "dropshadow", name: "Drop Shadow", cursor: "crosshair",
      options() {
        const sh = shadowOf(L());
        if (sh) { opt.size = sh.size || 0; opt.opacity = Math.round((sh.opacity == null ? 0.75 : sh.opacity) * 100); opt.color = sh.color || "#000000"; }
        return `<span style="color:var(--pc-dim)">Press in a layer and drag where its shadow falls</span><span class="sep"></span>`
          + `<label title="How soft the shadow is (px)">Blur <input type="range" id="pdsSize" min="0" max="100" value="${opt.size}"> <span id="pdsSizeV">${opt.size}</span></label>`
          + `<label title="How dark the shadow is">Opacity <input type="range" id="pdsOp" min="0" max="100" value="${opt.opacity}"> <span id="pdsOpV">${opt.opacity}%</span></label>`
          + `<label title="The shadow's colour">Colour <input type="color" id="pdsColor" value="${opt.color}"></label>`
          + (sh ? `<span class="sep"></span><span id="pdsNow" style="color:var(--pc-dim)">${Math.round(sh.distance || 0)} px at ${Math.round(sh.angle || 0)}°</span><button class="ghost" type="button" id="pdsOff" title="Take the drop shadow off this layer">✕ Remove</button>` : "");
      },
      bindOptions(o) {
        const q = (id) => o.querySelector("#" + id);
        q("pdsSize").oninput = (e) => { opt.size = +e.target.value; q("pdsSizeV").textContent = opt.size; };
        q("pdsSize").onchange = () => { store.set("size", opt.size); setOpt("shadow blur"); };
        q("pdsOp").oninput = (e) => { opt.opacity = +e.target.value; q("pdsOpV").textContent = opt.opacity + "%"; };
        q("pdsOp").onchange = () => { store.set("opacity", opt.opacity); setOpt("shadow opacity"); };
        q("pdsColor").onchange = (e) => { opt.color = e.target.value; store.set("color", opt.color); setOpt("shadow colour"); };
        if (q("pdsOff")) q("pdsOff").onclick = () => { const Ly = L(); E.setLayer(Ly, "remove drop shadow", (x) => { x.styles = Object.assign({}, x.styles); x.styles.shadow = Object.assign({}, x.styles.shadow, { on: false }); }); E.renderOptions(); };
      },
      down(e, fx, fy) {
        const cur = L(), h = handleOf(cur);
        if (near(fx, fy, h)) { drag = { Ly: cur, x0: h.ax, y0: h.ay, handle: true }; return; }
        const i = E.layerAt(Math.round(fx), Math.round(fy));
        if (i < 0) { say("press in a layer (a shape, text, a picture …) and drag where its shadow should fall"); return false; }
        const Ly = S.layers[i];
        if (Ly.locked || Ly.type === "adjust" || Ly.type === "group") { say("that layer cannot have a shadow"); return false; }
        if (S.active !== i) E.setActive(i);
        drag = { Ly, x0: fx, y0: fy };
      },
      move(e, fx, fy) {
        if (!drag) return;
        if (!drag.moved && Math.hypot(fx - drag.x0, fy - drag.y0) < 2) return;
        drag.moved = true;
        put(drag.Ly, drag.x0, drag.y0, fx, fy);
        if (!drag.handle) anchors.set(drag.Ly, { x: drag.x0, y: drag.y0 });
        E.drawOverlay();
      },
      up(e, fx, fy) {
        const d = drag; drag = null; if (!d) return;
        if (!d.moved) { E.drawOverlay(); E.renderOptions(); return; }
        const gm = put(d.Ly, d.x0, d.y0, fx, fy);
        E.commitLive("drop shadow");
        E.renderOptions(); E.drawOverlay();
        say(`drop shadow: ${gm.distance} px at ${gm.angle}° - drag its square handle to move it, Ctrl+Z takes it back`);
      },
      key(ev) { if (ev.key === "Escape" && drag) { drag = null; E.cancelLive(); E.drawOverlay(); return true; } return false; },
      leave() { if (drag) { drag = null; E.cancelLive(); } },
    };
    (E.overlayHooks = E.overlayHooks || []).push((g, px) => {
      if (S.tool !== "dropshadow") return;
      const h = handleOf(L()); if (!h) return;
      g.save(); g.strokeStyle = "#2680eb"; g.lineWidth = px; g.setLineDash([4 * px, 3 * px]);
      g.beginPath(); g.moveTo(h.ax, h.ay); g.lineTo(h.x, h.y); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#ffffff"; g.fillRect(h.ax - 3 * px, h.ay - 3 * px, 6 * px, 6 * px); g.strokeRect(h.ax - 3 * px, h.ay - 3 * px, 6 * px, 6 * px);
      g.fillStyle = "#2680eb"; g.fillRect(h.x - 5 * px, h.y - 5 * px, 10 * px, 10 * px); g.strokeStyle = "#ffffff"; g.strokeRect(h.x - 5 * px, h.y - 5 * px, 10 * px, 10 * px);
      g.restore();
    });
    E.shadowTool = { geom, offset, handleOf, anchors };
  }
  const PCShadowTool = { install, geom, offset };
  if (typeof module !== "undefined" && module.exports) module.exports = PCShadowTool;
  if (root && root.document) root.PCShadowTool = PCShadowTool;
})(typeof window !== "undefined" ? window : globalThis);
