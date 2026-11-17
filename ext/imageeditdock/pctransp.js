/* bitGen Studio — image editor: the TRANSPARENCY GRADIENT + the fade sliders on the gradient lines (2.830.0).
 * Tim: "can you add a transparency gradient of images, shapes, text etc can be transparent along the gradient, coreldraw has this
 * feature. so it will start at x% opacity and finish at y%. add a slider to the interactive line that controls the gradient to
 * change the position of the fades etc, do this for both gradient types and drop shadow".
 *
 *   L.transp = {on, type linear | radial, u0, v0, u1, v1 (the line's ends as fractions of what the layer draws - its alpha box -
 *   so it moves and grows with the layer), a0 / a1 (the opacity 0..1 at the start / the end), mid (0.02..0.98: where it is half
 *   way - the slider on the line)}. pcdoc.masked() multiplies the layer's pixels by alphaFor() - pictures, shapes, text, WP
 *   layers, smart objects, groups (their whole picture). The layer's styles see the faded layer (its shadow fades with it).
 *
 *   The Transparency tool (the Gradient group, Shift+G): press in a layer and drag - opaque-ish at the press, see-through at the
 *   pointer (the options bar's Start / End %). The picked layer's line stays: drag its ends to move them, drag the diamond on
 *   it (the fade slider) to move where the fade is half way; the options bar changes the picked layer at once. One undo step
 *   per drag; Esc lets go.
 *
 *   The Gradient tool's line: a vector shape's / a text's gradient fill shows its line too (with the Gradient tool) - its ends
 *   dragged, its fade slider (fillGrad.mid / gradientOverlay.mid). The Drop Shadow tool's slider is in pcshadowtool.js.
 *
 * Pure (Node: scripts/test-830.js): TYPES, clean, ease, toPx, fromPx, opacityAt, project, boxOf.
 */
(function (root) {
  "use strict";
  const TYPES = ["linear", "radial"];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (v == null || v === "" || isNaN(+v) ? d : +v);
  /** p (0..1 along the line) -> how far from the start opacity to the end one: half way at `mid` */
  function ease(p, mid) {
    const m = clamp(num(mid, 0.5), 0.02, 0.98), q = clamp(p, 0, 1);
    return Math.abs(m - 0.5) < 1e-6 ? q : Math.pow(q, Math.log(0.5) / Math.log(m));
  }
  function clean(tp) {
    const t = tp || {};
    return { on: t.on !== false, type: TYPES.includes(t.type) ? t.type : "linear",
      u0: num(t.u0, 0), v0: num(t.v0, 0.5), u1: num(t.u1, 1), v1: num(t.v1, 0.5),
      a0: clamp(num(t.a0, 1), 0, 1), a1: clamp(num(t.a1, 0), 0, 1), mid: clamp(num(t.mid, 0.5), 0.02, 0.98) };
  }
  /** the line in picture px from the layer's box {x, y, w, h} */
  function toPx(tp, box) { const t = clean(tp); return { x0: box.x + t.u0 * box.w, y0: box.y + t.v0 * box.h, x1: box.x + t.u1 * box.w, y1: box.y + t.v1 * box.h }; }
  function fromPx(x0, y0, x1, y1, box) { const w = box.w || 1, h = box.h || 1; return { u0: (x0 - box.x) / w, v0: (y0 - box.y) / h, u1: (x1 - box.x) / w, v1: (y1 - box.y) / h }; }
  /** how far along the line (0..1, clamped) a point lies - linear: projected; radial: its distance from the start */
  function project(type, l, x, y) {
    const dx = l.x1 - l.x0, dy = l.y1 - l.y0, L2 = dx * dx + dy * dy || 1;
    if (type === "radial") return clamp(Math.hypot(x - l.x0, y - l.y0) / Math.sqrt(L2), 0, 1);
    return clamp(((x - l.x0) * dx + (y - l.y0) * dy) / L2, 0, 1);
  }
  /** the opacity (0..1) at a picture point */
  function opacityAt(tp, box, x, y) { const t = clean(tp); return t.a0 + (t.a1 - t.a0) * ease(project(t.type, toPx(t, box), x, y), t.mid); }
  /** the alpha box of an RGBA plane (every 2nd pixel - quick; whole picture when empty) */
  function boxOf(data, W, H) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y += 2) { const r = y * W * 4; for (let x = 0; x < W; x += 2) if (data[r + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return x1 < 0 ? { x: 0, y: 0, w: W, h: H } : { x: x0, y: y0, w: Math.max(1, Math.min(W, x1 + 2) - x0), h: Math.max(1, Math.min(H, y1 + 2) - y0) };
  }
  /** a layer's box: what its own canvas draws (a group / no canvas = the whole picture) */
  function layerBox(L, W, H) {
    const c = L && L.type !== "group" && L.canvas; if (!c || !c.getContext) return { x: 0, y: 0, w: W, h: H };
    try { return boxOf(c.getContext("2d").getImageData(0, 0, Math.min(W, c.width), Math.min(H, c.height)).data, Math.min(W, c.width), Math.min(H, c.height)); } catch (e) { return { x: 0, y: 0, w: W, h: H }; }
  }
  /** the alpha plane (a canvas, black at the opacity) pcdoc.masked() multiplies the layer by */
  function alphaFor(env, L, content, W, H, box) {
    const t = clean(L.transp), b = box || layerBox(L, W, H), l = toPx(t, b), c = env.newCanvas(W, H), g = c.getContext("2d");
    const len = Math.max(1, Math.hypot(l.x1 - l.x0, l.y1 - l.y0));
    const G = t.type === "radial" ? g.createRadialGradient(l.x0, l.y0, 0, l.x0, l.y0, len) : g.createLinearGradient(l.x0, l.y0, l.x1, l.y1);
    for (let k = 0; k <= 24; k++) { const p = k / 24; G.addColorStop(p, `rgba(0,0,0,${(t.a0 + (t.a1 - t.a0) * ease(p, t.mid)).toFixed(4)})`); }
    g.fillStyle = G; g.fillRect(0, 0, W, H);
    return c;
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, D = root.PCDoc, PS = root.PCStyles, win = root;
    if (!E.tools || !D) return;
    const store = { get: (k, d) => { try { const v = win.localStorage.getItem("pc.tp." + k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { win.localStorage.setItem("pc.tp." + k, String(v)); } catch (e) { /* fine */ } } };
    const opt = { type: TYPES.includes(store.get("type", "linear")) ? store.get("type", "linear") : "linear", a0: +store.get("a0", 100), a1: +store.get("a1", 0), mid: +store.get("mid", 50) };
    const say = (t) => (E.say ? E.say(t) : null);
    const L = () => E.layer();
    const R = () => 9 / (S.zoom || 1);
    const tpOf = (Ly) => (Ly && Ly.transp && Ly.transp.on !== false ? clean(Ly.transp) : null);
    const boxes = new WeakMap();                          // the layer's box at the press (a drag keeps it - the line stays put)
    const boxNow = (Ly) => boxes.get(Ly) || layerBox(Ly, S.w, S.h);
    let drag = null;
    const midPt = (l, mid) => ({ x: l.x0 + (l.x1 - l.x0) * mid, y: l.y0 + (l.y1 - l.y0) * mid });
    function hitLine(l, mid, x, y) {
      if (!l) return null; const r = R();
      if (Math.hypot(x - l.x1, y - l.y1) <= r) return "e";
      if (Math.hypot(x - l.x0, y - l.y0) <= r) return "s";
      const m = midPt(l, mid); if (Math.hypot(x - m.x, y - m.y) <= r) return "m";
      return null;
    }
    function put(Ly, l, extra) {
      const b = boxNow(Ly), f = fromPx(l.x0, l.y0, l.x1, l.y1, b);
      E.liveSet(Ly, (x) => { x.transp = clean(Object.assign({}, x.transp || { type: opt.type, a0: opt.a0 / 100, a1: opt.a1 / 100, mid: opt.mid / 100 }, f, extra || {}, { on: true })); });
    }
    function setOpt(label) {                              // the options bar changes the picked layer at once
      const Ly = L(); if (!tpOf(Ly)) return;
      E.setLayer(Ly, label, (x) => { x.transp = clean(Object.assign({}, x.transp, { type: opt.type, a0: opt.a0 / 100, a1: opt.a1 / 100, mid: opt.mid / 100 })); });
    }

    E.tools.transparency = {
      id: "transparency", name: "Transparency", cursor: "crosshair",
      options() {
        const tp = tpOf(L());
        if (tp) { opt.type = tp.type; opt.a0 = Math.round(tp.a0 * 100); opt.a1 = Math.round(tp.a1 * 100); opt.mid = Math.round(tp.mid * 100); }
        const rng = (id, label, v, min, max, title, unit) => `<label title="${title}">${label} <input type="range" id="${id}" min="${min}" max="${max}" value="${v}"> <span id="${id}V">${v}${unit}</span></label>`;
        return `<span style="color:var(--pc-dim)">Press in a layer and drag - it fades from the press to the pointer</span><span class="sep"></span>`
          + TYPES.map((k) => `<button class="ghost ptpt${k === opt.type ? " on" : ""}" type="button" data-tpt="${k}" title="${k === "linear" ? "Linear transparency" : "Radial transparency (from the middle out)"}">${k === "linear" ? "▭" : "◎"}</button>`).join("")
          + `<span class="sep"></span>` + rng("ptpA0", "Start", opt.a0, 0, 100, "The opacity where the line starts (100 = solid)", "%")
          + rng("ptpA1", "End", opt.a1, 0, 100, "The opacity where the line ends (0 = see-through)", "%")
          + rng("ptpMid", "Fade", opt.mid, 2, 98, "Where the fade is half way along the line (the diamond on the line)", "%")
          + (tp ? `<span class="sep"></span><button class="ghost" type="button" id="ptpFlip" title="Swap the start and end opacity">⇄</button><button class="ghost" type="button" id="ptpOff" title="Take the transparency off this layer">✕ Remove</button>` : "");
      },
      bindOptions(o) {
        const q = (id) => o.querySelector("#" + id);
        o.querySelectorAll("[data-tpt]").forEach((b) => { b.onclick = () => { opt.type = b.dataset.tpt; store.set("type", opt.type); setOpt("transparency type"); E.renderOptions(); }; });
        for (const [id, k, label] of [["ptpA0", "a0", "transparency start"], ["ptpA1", "a1", "transparency end"], ["ptpMid", "mid", "transparency fade"]]) {
          const r = q(id); if (!r) continue;
          r.oninput = () => { opt[k] = +r.value; q(id + "V").textContent = r.value + "%"; };
          r.onchange = () => { store.set(k, opt[k]); setOpt(label); };
        }
        if (q("ptpFlip")) q("ptpFlip").onclick = () => { const a = opt.a0; opt.a0 = opt.a1; opt.a1 = a; setOpt("transparency swap"); E.renderOptions(); };
        if (q("ptpOff")) q("ptpOff").onclick = () => { const Ly = L(); E.setLayer(Ly, "remove transparency", (x) => { delete x.transp; }); E.renderOptions(); E.drawOverlay(); };
      },
      down(e, fx, fy) {
        const cur = L(), tp = tpOf(cur);
        if (tp) {
          const b = layerBox(cur, S.w, S.h), l = toPx(tp, b), part = hitLine(l, tp.mid, fx, fy);
          if (part) { boxes.set(cur, b); drag = { Ly: cur, part, l, type: tp.type }; return; }
        }
        const i = E.layerAt(Math.round(fx), Math.round(fy));
        if (i < 0) { say("press in a layer (a picture, a shape, text …) and drag across it - it fades along the line"); return false; }
        const Ly = S.layers[i];
        if (Ly.locked || Ly.type === "adjust") { say("that layer cannot be made see-through"); return false; }
        if (S.active !== i) E.setActive(i);
        boxes.set(Ly, layerBox(Ly, S.w, S.h));
        drag = { Ly, part: "new", l: { x0: fx, y0: fy, x1: fx, y1: fy } };
      },
      move(e, fx, fy) {
        if (!drag) return;
        const d = drag, l = Object.assign({}, d.l);
        if (d.part === "m") { const m = clamp(project("linear", l, fx, fy), 0.02, 0.98); E.liveSet(d.Ly, (x) => { x.transp = clean(Object.assign({}, x.transp, { mid: m })); }); opt.mid = Math.round(m * 100); d.moved = true; E.drawOverlay(); return; }
        let x = fx, y = fy;
        const from = d.part === "s" ? [l.x1, l.y1] : [l.x0, l.y0];
        if (e.shiftKey) { const a = Math.round(Math.atan2(y - from[1], x - from[0]) / (Math.PI / 4)) * Math.PI / 4, r = Math.hypot(x - from[0], y - from[1]); x = from[0] + Math.cos(a) * r; y = from[1] + Math.sin(a) * r; }
        if (d.part === "s") { l.x0 = x; l.y0 = y; } else { l.x1 = x; l.y1 = y; }
        if (d.part === "new" && !d.moved && Math.hypot(l.x1 - l.x0, l.y1 - l.y0) < 2) return;
        d.moved = true;
        put(d.Ly, l, d.part === "new" ? { type: opt.type, a0: opt.a0 / 100, a1: opt.a1 / 100, mid: opt.mid / 100 } : null);
        E.drawOverlay();
      },
      up() {
        const d = drag; drag = null; if (!d) return;
        boxes.delete(d.Ly);
        if (!d.moved) { E.drawOverlay(); return; }
        E.commitLive(d.part === "m" ? "transparency fade" : "transparency");
        E.renderOptions(); E.drawOverlay();
        const t = tpOf(d.Ly);
        if (t) say(`transparency: ${Math.round(t.a0 * 100)} % -> ${Math.round(t.a1 * 100)} %, half way at ${Math.round(t.mid * 100)} % - drag the ends or the diamond on the line, Ctrl+Z takes it back`);
      },
      key(ev) { if (ev.key === "Escape" && drag) { if (drag.moved) E.cancelLive(); boxes.delete(drag.Ly); drag = null; E.drawOverlay(); return true; } return false; },
      leave() { if (drag) { if (drag.moved) E.cancelLive(); boxes.delete(drag.Ly); drag = null; } },
    };

    /* ---- the Gradient tool's line on a vector shape / a text: its ends + the fade slider */
    function fillLine(Ly) {
      if (!Ly) return null;
      if (Ly.type === "shape" && Ly.shape && Ly.shape.fillGrad && Ly.shape.fillOn !== false) {
        const gr = Ly.shape.fillGrad, s = Ly.shape;
        let l;
        if (gr.x0 != null && gr.x1 != null) l = { x0: +gr.x0, y0: +gr.y0, x1: +gr.x1, y1: +gr.y1 };
        else {                                            // set by the docker (an angle across the box) - as pcdoc.gradStyle draws it
          const b = { x: Math.min(s.x, s.x + s.w), y: Math.min(s.y, s.y + s.h), w: Math.abs(s.w) || 1, h: Math.abs(s.h) || 1 }, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
          const a = (+gr.angle || 0) * Math.PI / 180, r = Math.abs(b.w * Math.cos(a)) / 2 + Math.abs(b.h * Math.sin(a)) / 2;
          l = { x0: cx - Math.cos(a) * r, y0: cy + Math.sin(a) * r, x1: cx + Math.cos(a) * r, y1: cy - Math.sin(a) * r };
        }
        return Object.assign(l, { kind: "shape", mid: clamp(num(gr.mid, 0.5), 0.02, 0.98), radial: gr.type === "radial" || gr.type === "diamond" });
      }
      const go = Ly.type === "text" && Ly.styles && Ly.styles.gradientOverlay;
      if (go && go.on && PS && PS.alphaBox && Ly.canvas) {
        const b = boxes.get(Ly) || PS.alphaBox(Ly.canvas, S.w, S.h), cx = b.x + b.w / 2, cy = b.y + b.h / 2, k = Math.max(0.1, num(go.scale, 100) / 100);
        const a = num(go.angle, 90) * Math.PI / 180, radial = go.style === "radial";
        const rr = radial ? Math.hypot(b.w, b.h) / 2 * k : (Math.abs(b.w * Math.cos(a)) / 2 + Math.abs(b.h * Math.sin(a)) / 2) * k;
        const l = radial ? { x0: cx, y0: cy, x1: cx + Math.cos(a) * rr, y1: cy - Math.sin(a) * rr } : { x0: cx - Math.cos(a) * rr, y0: cy + Math.sin(a) * rr, x1: cx + Math.cos(a) * rr, y1: cy - Math.sin(a) * rr };
        return Object.assign(l, { kind: "text", mid: clamp(num(go.mid, 0.5), 0.02, 0.98), radial, box: b, cx, cy });
      }
      return null;
    }
    let fdrag = null;
    const G = E.tools.gradient;
    if (G && !G._pctransp) {
      G._pctransp = true;
      const d0 = G.down, m0 = G.move, u0 = G.up, k0 = G.key, l0 = G.leave;
      G.down = function (e, fx, fy) {
        const Ly = L(), l = fillLine(Ly), part = l && hitLine(l, l.mid, fx, fy);
        if (part) { if (l.kind === "text") boxes.set(Ly, l.box); fdrag = { Ly, l, part }; return; }
        return d0.apply(this, arguments);
      };
      G.move = function (e, fx, fy) {
        if (!fdrag) return m0.apply(this, arguments);
        const d = fdrag, l = d.l; d.moved = true;
        if (d.part === "m") {
          const m = clamp(project("linear", l, fx, fy), 0.02, 0.98);
          E.liveSet(d.Ly, (x) => { if (d.l.kind === "shape") x.shape.fillGrad = Object.assign({}, x.shape.fillGrad, { mid: m }); else { x.styles = Object.assign({}, x.styles); x.styles.gradientOverlay = Object.assign({}, x.styles.gradientOverlay, { mid: m }); } });
        } else if (l.kind === "shape") {
          const n = { x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1 }; if (d.part === "s") { n.x0 = fx; n.y0 = fy; } else { n.x1 = fx; n.y1 = fy; }
          E.liveSet(d.Ly, (x) => { x.shape.fillGrad = Object.assign({}, x.shape.fillGrad, n); });
        } else {                                          // a text: the line turns / grows about the middle (its overlay has no offset)
          const vx = (fx - l.cx) * (d.part === "s" ? -1 : 1), vy = (fy - l.cy) * (d.part === "s" ? -1 : 1), b = l.box;
          const a = Math.atan2(-vy, vx), dist = Math.hypot(vx, vy);
          const base = l.radial ? Math.hypot(b.w, b.h) / 2 : Math.abs(b.w * Math.cos(a)) / 2 + Math.abs(b.h * Math.sin(a)) / 2 || 1;
          const angle = Math.round(a * 180 / Math.PI), scale = clamp(Math.round(dist / base * 100), 10, 150);
          E.liveSet(d.Ly, (x) => { x.styles = Object.assign({}, x.styles); x.styles.gradientOverlay = Object.assign({}, x.styles.gradientOverlay, { angle, scale }); });
        }
        E.drawOverlay();
      };
      G.up = function () {
        if (!fdrag) return u0.apply(this, arguments);
        const d = fdrag; fdrag = null; boxes.delete(d.Ly);
        if (d.moved) { E.commitLive(d.part === "m" ? "gradient fade" : "gradient fill"); const l = fillLine(d.Ly); if (l && d.part === "m") say(`gradient: half way at ${Math.round(l.mid * 100)} % along the line`); }
        E.drawOverlay();
      };
      G.key = function (ev) { if (ev.key === "Escape" && fdrag) { if (fdrag.moved) E.cancelLive(); boxes.delete(fdrag.Ly); fdrag = null; E.drawOverlay(); return true; } return k0 ? k0.apply(this, arguments) : false; };
      G.leave = function () { if (fdrag) { if (fdrag.moved) E.cancelLive(); boxes.delete(fdrag.Ly); fdrag = null; } return l0 ? l0.apply(this, arguments) : undefined; };
    }

    /* ---- the lines on the canvas */
    function drawLine(g, px, l, mid, ends, label) {
      g.save();
      g.lineWidth = 1.5 * px; g.strokeStyle = "#fff"; g.setLineDash([]); g.beginPath(); g.moveTo(l.x0, l.y0); g.lineTo(l.x1, l.y1); g.stroke();
      g.strokeStyle = "#2680eb"; g.lineWidth = px; g.setLineDash([4 * px, 3 * px]); g.stroke(); g.setLineDash([]);
      ends.forEach(([x, y, fill], i) => {
        const r = (i ? 5 : 4) * px;
        g.fillStyle = fill; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.strokeStyle = "#2680eb"; g.lineWidth = px; g.strokeRect(x - r, y - r, 2 * r, 2 * r);
      });
      const m = midPt(l, mid), r = 5 * px;                // the fade slider: a diamond on the line
      g.beginPath(); g.moveTo(m.x, m.y - r); g.lineTo(m.x + r, m.y); g.lineTo(m.x, m.y + r); g.lineTo(m.x - r, m.y); g.closePath();
      g.fillStyle = "#ffd166"; g.fill(); g.strokeStyle = "#1a1a1a"; g.stroke();
      if (label) { g.font = `${11 * px}px sans-serif`; g.fillStyle = "#000"; g.strokeStyle = "#fff"; g.lineWidth = 3 * px; label.forEach(([t, x, y]) => { g.strokeText(t, x + 8 * px, y - 6 * px); g.fillText(t, x + 8 * px, y - 6 * px); }); }
      g.restore();
    }
    const grey = (a) => { const v = Math.round(255 * (1 - a)); return `rgb(${v},${v},${v})`; };   // solid = black, see-through = white (CorelDRAW)
    (E.overlayHooks = E.overlayHooks || []).push((g, px) => {
      if (S.tool === "transparency") {
        const Ly = drag ? drag.Ly : L(), tp = tpOf(Ly); if (!tp) return;
        const l = toPx(tp, boxNow(Ly));
        drawLine(g, px, l, tp.mid, [[l.x0, l.y0, grey(tp.a0)], [l.x1, l.y1, grey(tp.a1)]],
          [[Math.round(tp.a0 * 100) + "%", l.x0, l.y0], [Math.round(tp.a1 * 100) + "%", l.x1, l.y1]].concat(drag && drag.part === "m" ? [["fade " + Math.round(tp.mid * 100) + "%", midPt(l, tp.mid).x, midPt(l, tp.mid).y]] : []));
      } else if (S.tool === "gradient") {
        const l = fillLine(L()); if (!l) return;
        drawLine(g, px, l, l.mid, [[l.x0, l.y0, "#fff"], [l.x1, l.y1, "#fff"]], fdrag && fdrag.part === "m" ? [["fade " + Math.round(l.mid * 100) + "%", midPt(l, l.mid).x, midPt(l, l.mid).y]] : null);
      }
    });
    E.transp = { clean, toPx, fromPx, fillLine, layerBox };
  }

  const PCTransp = { TYPES, clean, ease, toPx, fromPx, project, opacityAt, boxOf, layerBox, alphaFor, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCTransp;
  if (root && root.document) root.PCTransp = PCTransp;
})(typeof window !== "undefined" ? window : globalThis);
