/* pccafill.js — THE CONTENT-AWARE FILL WORKSPACE (2.448.0), window.PCCaFill.
 *
 * Tim (verbatim): "and more photoshop features to close the gap" - asked which: "Content-Aware Fill workspace" (with
 * artboards, per-character type, warp grid + liquify extras - one release each).
 *
 *   Edit ▸ Content-Aware Fill… (a selection = what to fill) opens a workspace like Photoshop's:
 *     THE PICTURE   the selection outlined, the SAMPLING AREA (where the fill may take pixels from) tinted green.
 *     SAMPLING      Auto (a ring round the selection), Rectangular (the box round it), Custom (paint it): the 🖌
 *                   Sampling Brush adds, Alt / − takes away, its size; Reset; Show the sampling area.
 *     FILL          Colour Adaptation: None / Default / High / Very High - the fill's colours and light blended into its
 *                   surroundings (a Poisson solve, more passes = smoother).
 *     PREVIEW       the result next to it, at its own size - again after each change (a pause first).
 *     OUTPUT TO     Current Layer / New Layer / Duplicate Layer. OK = one undo step.
 *   PatchMatch (pcretouch.js inpaint, now with opts.sample - patches only from the sampling area); no AI.
 *
 * Pure (Node: scripts/test-cafill.js): ringSample, rectSample, paintDab, countOn, ADAPT.
 */
(function (root) {
  "use strict";
  const ADAPT = { none: 0, default: 200, high: 500, veryhigh: 1000 };
  function bboxOf(m, w, h) { let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; }
  /** Auto: the pixels within k of the hole (a ring; the hole itself out) - a two-pass distance (chamfer) */
  function ringSample(hole, w, h, k) {
    const INF = 1e9, d = new Float32Array(w * h);
    for (let i = 0; i < d.length; i++) d[i] = hole[i] > 127 ? 0 : INF;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; let v = d[i]; if (x > 0) v = Math.min(v, d[i - 1] + 1); if (y > 0) v = Math.min(v, d[i - w] + 1); if (x > 0 && y > 0) v = Math.min(v, d[i - w - 1] + 1.414); if (x < w - 1 && y > 0) v = Math.min(v, d[i - w + 1] + 1.414); d[i] = v; }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; let v = d[i]; if (x < w - 1) v = Math.min(v, d[i + 1] + 1); if (y < h - 1) v = Math.min(v, d[i + w] + 1); if (x < w - 1 && y < h - 1) v = Math.min(v, d[i + w + 1] + 1.414); if (x > 0 && y < h - 1) v = Math.min(v, d[i + w - 1] + 1.414); d[i] = v; }
    const o = new Uint8Array(w * h); for (let i = 0; i < o.length; i++) o[i] = d[i] > 0 && d[i] <= k ? 255 : 0; return o;
  }
  /** Rectangular: the hole's box grown by k (the hole out) */
  function rectSample(hole, w, h, k) {
    const b = bboxOf(hole, w, h), o = new Uint8Array(w * h); if (!b) return o;
    const x0 = Math.max(0, b.x - k), y0 = Math.max(0, b.y - k), x1 = Math.min(w, b.x + b.w + k), y1 = Math.min(h, b.y + b.h + k);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * w + x; o[i] = hole[i] > 127 ? 0 : 255; }
    return o;
  }
  /** a round dab of the sampling brush (on = add, else take away); never inside the hole */
  function paintDab(m, hole, w, h, cx, cy, r, on) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r)), r2 = r * r;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r2) continue; const i = y * w + x; m[i] = on && !(hole[i] > 127) ? 255 : 0; }
    return m;
  }
  function countOn(m) { let n = 0; for (let i = 0; i < m.length; i++) if (m[i] > 127) n++; return n; }

  function install(E) {
    const R = root.PCRetouch; if (!R || !E.ui || !E.ui.addCmd) return;
    const { S, doc, say, store } = E;
    const ctx = (c) => c.getContext("2d");
    const set = Object.assign({ mode: "auto", adapt: "default", out: "cur", size: 30, show: true }, store.get("caf", {}) || {});
    const keep = () => store.set("caf", set);
    let W = null;                                         // the open workspace
    function open() {
      if (!S.w) return say("open a picture first");
      if (!E.hasSel()) return say("select what to fill first - its surroundings fill it");
      const L = E.layer(), onPixel = L && L.type === "pixel" && !E.onMask(L) && !S.qm;
      const src = onPixel ? L.canvas : E.flattenCache();
      const rgba = ctx(src).getImageData(0, 0, S.w, S.h).data, hole = new Uint8Array(S.w * S.h);
      for (let i = 0; i < hole.length; i++) hole[i] = S.sel[i] > 127 ? 255 : 0;
      const hb = bboxOf(hole, S.w, S.h); if (!hb) return say("the selection is empty");
      const k = Math.max(24, Math.round(Math.max(hb.w, hb.h) * 1.2));
      W = { L, onPixel, rgba, hole, hb, k, samp: null, out: null, timer: 0 };
      W.samp = set.mode === "rect" ? rectSample(hole, S.w, S.h, k) : ringSample(hole, S.w, S.h, k);
      const fit = Math.min(560 / S.w, 420 / S.h, 1), vw = Math.max(1, Math.round(S.w * fit)), vh = Math.max(1, Math.round(S.h * fit));
      W.fit = fit;
      const pw = Math.min(260, Math.round(hb.w * 2)), ph = Math.min(260, Math.round(hb.h * 2));
      const opt = (v, t, cur) => `<option value="${v}"${v === cur ? " selected" : ""}>${t}</option>`;
      const d = E.ui.dialog("Content-Aware Fill", `<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
          <div><div class="kxrow" style="gap:4px;flex-wrap:wrap">
              <button class="ghost on" id="cafAdd" title="Sampling Brush: add to the sampling area">🖌 +</button><button class="ghost" id="cafSub" title="Sampling Brush: take away (or hold Alt)">🖌 −</button>
              <span>size</span><input type="range" id="cafSize" min="4" max="200" value="${set.size}" style="width:90px">
              <select id="cafMode" title="The sampling area">${opt("auto", "Auto", set.mode)}${opt("rect", "Rectangular", set.mode)}${opt("custom", "Custom", set.mode)}</select>
              <button class="ghost" id="cafReset" title="Back to the Auto sampling area">↺ Reset</button>
              <label><input type="checkbox" id="cafShow"${set.show ? " checked" : ""}> show it</label></div>
            <canvas id="cafView" width="${vw}" height="${vh}" style="display:block;cursor:crosshair;border:1px solid var(--pc-line);max-width:100%"></canvas>
            <div class="kxrow" style="color:var(--pc-dim);font-size:11px">Green = where the fill may take pixels from; red outline = what is filled.</div></div>
          <div style="min-width:${pw}px"><div class="kxrow"><b>Preview</b><span id="cafBusy" style="color:var(--pc-dim)"></span></div>
            <canvas id="cafPrev" width="${pw}" height="${ph}" style="display:block;border:1px solid var(--pc-line);background:repeating-conic-gradient(#bbb 0 25%,#fff 0 50%) 0 0/12px 12px"></canvas>
            <div class="kxrow"><span>Colour Adaptation</span><select id="cafAdapt">${opt("none", "None", set.adapt)}${opt("default", "Default", set.adapt)}${opt("high", "High", set.adapt)}${opt("veryhigh", "Very High", set.adapt)}</select></div>
            <div class="kxrow"><span>Output To</span><select id="cafOut">${opt("cur", "Current Layer", set.out)}${opt("new", "New Layer", set.out)}${opt("dup", "Duplicate Layer", set.out)}</select></div></div></div>`,
      () => apply(), { wide: true, okLabel: "OK", cancel: () => { if (W) clearTimeout(W.timer); W = null; } });
      d.id = "pcCaFill";
      const $ = (id) => d.querySelector("#" + id);
      W.d = d; W.view = $("cafView"); W.prev = $("cafPrev");
      // the picture once (scaled), redrawn with the overlays
      const base = E.newCanvas(S.w, S.h); ctx(base).putImageData(new ImageData(Uint8ClampedArray.from(rgba), S.w, S.h), 0, 0); W.base = base;
      let sub = false;
      $("cafAdd").onclick = () => { sub = false; $("cafAdd").classList.add("on"); $("cafSub").classList.remove("on"); };
      $("cafSub").onclick = () => { sub = true; $("cafSub").classList.add("on"); $("cafAdd").classList.remove("on"); };
      $("cafSize").oninput = () => { set.size = +$("cafSize").value; keep(); };
      $("cafMode").onchange = () => { set.mode = $("cafMode").value; keep(); if (set.mode !== "custom") { W.samp = set.mode === "rect" ? rectSample(hole, S.w, S.h, k) : ringSample(hole, S.w, S.h, k); } paintView(); soon(); };
      $("cafReset").onclick = () => { set.mode = "auto"; $("cafMode").value = "auto"; W.samp = ringSample(hole, S.w, S.h, k); keep(); paintView(); soon(); };
      $("cafShow").onchange = () => { set.show = $("cafShow").checked; keep(); paintView(); };
      $("cafAdapt").onchange = () => { set.adapt = $("cafAdapt").value; keep(); soon(); };
      $("cafOut").onchange = () => { set.out = $("cafOut").value; keep(); };
      // the sampling brush on the view
      const at = (e) => { const r = W.view.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * S.w, (e.clientY - r.top) / r.height * S.h]; };
      W.view.onpointerdown = (e) => {
        e.preventDefault(); W.view.setPointerCapture(e.pointerId);
        set.mode = "custom"; $("cafMode").value = "custom";
        const on = !(sub || e.altKey);
        const dab = (ev) => { const [x, y] = at(ev); paintDab(W.samp, hole, S.w, S.h, x, y, set.size / 2 / fit, on); paintView(); };
        dab(e);
        W.view.onpointermove = (ev) => dab(ev);
        W.view.onpointerup = () => { W.view.onpointermove = null; soon(); };
      };
      paintView(); soon(10);
      return d;
    }
    function paintView() {
      if (!W) return;
      const g = ctx(W.view), vw = W.view.width, vh = W.view.height;
      g.clearRect(0, 0, vw, vh); g.drawImage(W.base, 0, 0, vw, vh);
      const t = E.newCanvas(S.w, S.h), tg = ctx(t), id = tg.createImageData(S.w, S.h);
      for (let i = 0; i < W.hole.length; i++) {
        if (set.show && W.samp[i] > 127) { id.data[i * 4 + 1] = 200; id.data[i * 4 + 3] = 90; }
        if (W.hole[i] > 127) { id.data[i * 4] = 230; id.data[i * 4 + 3] = 110; }
      }
      tg.putImageData(id, 0, 0); g.drawImage(t, 0, 0, vw, vh);
    }
    /** the fill (the preview and OK use it): PatchMatch from the sampling area, then the colour adaptation */
    function compute() {
      let out = R.inpaint(W.rgba, S.w, S.h, W.hole, { seed: 11, sample: countOn(W.samp) > 64 ? W.samp : null });
      const it = ADAPT[set.adapt] || 0;
      if (it && R.poisson) out = R.poisson(W.rgba, out, W.hole, S.w, S.h, { iters: it });
      return out;
    }
    function soon(ms) {
      if (!W) return;
      clearTimeout(W.timer); const b = W.d.querySelector("#cafBusy"); if (b) b.textContent = " …";
      W.timer = setTimeout(() => {
        if (!W) return;
        W.out = compute(); W.outKey = JSON.stringify([set.adapt, countOn(W.samp)]);
        const hb = W.hb, pad = Math.round(Math.max(hb.w, hb.h) * 0.5), x0 = Math.max(0, hb.x - pad), y0 = Math.max(0, hb.y - pad), x1 = Math.min(S.w, hb.x + hb.w + pad), y1 = Math.min(S.h, hb.y + hb.h + pad);
        const t = E.newCanvas(S.w, S.h); ctx(t).putImageData(new ImageData(Uint8ClampedArray.from(W.out), S.w, S.h), 0, 0);
        const g = ctx(W.prev); g.clearRect(0, 0, W.prev.width, W.prev.height);
        const kk = Math.min(W.prev.width / (x1 - x0), W.prev.height / (y1 - y0));
        g.drawImage(t, x0, y0, x1 - x0, y1 - y0, (W.prev.width - (x1 - x0) * kk) / 2, (W.prev.height - (y1 - y0) * kk) / 2, (x1 - x0) * kk, (y1 - y0) * kk);
        if (b) b.textContent = "";
      }, ms == null ? 400 : ms);
    }
    function apply() {
      if (!W) return;
      clearTimeout(W.timer);
      const out = W.out || compute(), soft = S.sel, L = W.L, how = set.out;
      const blendInto = (g) => { const d = g.getImageData(0, 0, S.w, S.h); for (let i = 0; i < soft.length; i++) { const a = soft[i] / 255; if (!a) continue; for (let c = 0; c < 4; c++) d.data[i * 4 + c] = d.data[i * 4 + c] * (1 - a) + out[i * 4 + c] * a; } g.putImageData(d, 0, 0); };
      if (how === "cur" && W.onPixel) E.pxOp("content-aware fill", (c, g) => blendInto(g));
      else E.structOp(how === "dup" ? "content-aware fill (duplicate layer)" : "content-aware fill (new layer)", () => {
        const n = E.makeLayer(how === "dup" && L ? L.name + " copy" : "Content-Aware Fill", S.w, S.h), g = ctx(n.canvas);
        if (how === "dup" && W.onPixel) { g.drawImage(L.canvas, 0, 0); blendInto(g); }
        else { const d = g.createImageData(S.w, S.h); for (let i = 0; i < soft.length; i++) { if (!soft[i]) continue; for (let c = 0; c < 3; c++) d.data[i * 4 + c] = out[i * 4 + c]; d.data[i * 4 + 3] = out[i * 4 + 3] * soft[i] / 255; } g.putImageData(d, 0, 0); }
        const A = E.layer(), at = A ? S.layers.indexOf(A) + 1 : S.layers.length; if (A) n.parent = A.type === "group" ? A.id : A.parent;
        S.layers.splice(at, 0, n); S.active = at;
      });
      W = null;
      say("content-aware fill done");
    }
    // Edit ▸ Content-Aware Fill… opens the workspace (the command stays where pcheal put it)
    E.ui.addCmd("edit.cafill", "Content-Aware Fill…", "", open, { enabled: () => E.hasSel() });
    E.cafill = { open, state: () => W, compute, settings: set, ringSample, rectSample };
  }

  const PCCaFill = { ADAPT, ringSample, rectSample, paintDab, countOn, bboxOf, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCCaFill;
  else root.PCCaFill = PCCaFill;
})(typeof window !== "undefined" ? window : globalThis);
