/* pcrefine.js — THE IMAGE EDITOR'S SELECTION REFINEMENT: SELECT AND MASK, MAGNETIC LASSO, QUICK SELECTION, SELECT
 * SKY, CHANNELS + SAVED SELECTIONS (2.423.0), window.PCRefine.
 *
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first" - gap 4 of the Photoshop list. The maths is
 * pcselect.js:
 *
 *   SELECT AND MASK  Select ▸ Select and Mask… (Alt+Ctrl+R): a workspace of its own - Quick Selection / Refine Edge /
 *                    Brush tools (Alt = take away), views (Overlay, On Black, On White, Black & White, On Layers),
 *                    Edge Detection (Radius, Smart Radius), Smooth, Feather, Contrast, Shift Edge, Decontaminate
 *                    Colors (Amount), Output To: Selection / Layer Mask / New Layer / New Layer with Layer Mask; Sky.
 *   MAGNETIC LASSO   L (Shift+L cycles): click, then move along an edge - the line snaps to it (live wire), anchors
 *                    fall every Frequency px, a click sets one, Backspace takes the last back, a double-click / Enter /
 *                    the first anchor closes it; Width, Contrast, Frequency.
 *   QUICK SELECTION  W: paint - the selection grows to the edges under the brush (Alt takes away); Tolerance,
 *                    Auto-Enhance (a soft, cleaned edge at the end of each stroke).
 *   SELECT SKY       Select ▸ Sky.
 *   CHANNELS         a Channels tab (next to Layers / Paths / History): RGB, Red, Green, Blue (click = see that one,
 *                    Ctrl-click = its lightness as a selection) and ALPHA CHANNELS - saved selections (Select ▸ Save
 *                    Selection… / Load Selection…, new, delete, rename; they follow crop / size / rotate and undo).
 */
(function (root) {
  "use strict";
  function install(E) {
    const PS = root.PCSelect; if (!PS || !E.tools) return;
    const { S, P, doc, $, say, ctx, newCanvas, store } = E;
    const T = E.tools;
    S.channels = S.channels || [];
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!doc.getElementById("pcrefineCss")) {
      const st = doc.createElement("style"); st.id = "pcrefineCss";
      st.textContent = ".kx .smdlg{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;background:var(--pc-bg,#141210);color:var(--pc-text)}"
        + ".kx .smdlg .smbar{display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--pc-line);background:var(--pc-panel)}"
        + ".kx .smdlg .smmain{flex:1;display:flex;min-height:0}.kx .smdlg .smtools{display:flex;flex-direction:column;gap:4px;padding:8px;border-right:1px solid var(--pc-line)}"
        + ".kx .smdlg .smtools button{width:36px;height:32px}.kx .smdlg .smtools button.on{border-color:var(--pc-accent);color:var(--pc-accent)}"
        + ".kx .smdlg .smview{flex:1;position:relative;overflow:hidden;background:repeating-conic-gradient(#666 0 25%,#888 0 50%) 0 0/16px 16px}.kx .smdlg .smview canvas{position:absolute}"
        + ".kx .smdlg .smside{width:250px;padding:10px;border-left:1px solid var(--pc-line);display:flex;flex-direction:column;gap:6px;overflow:auto}"
        + ".kx .smdlg .smside label{display:flex;gap:6px;align-items:center}.kx .smdlg .smside input[type=range]{flex:1}.kx .smdlg h5{margin:6px 0 0;font-size:11px;color:var(--pc-dim);text-transform:uppercase;letter-spacing:.08em}"
        + ".kx .smdlg .smring{position:absolute;border:1px solid #fff;border-radius:50%;pointer-events:none;box-shadow:0 0 0 1px #000}";
      doc.head.appendChild(st);
    }
    const flat = () => ctx(E.flattenCache()).getImageData(0, 0, S.w, S.h).data;
    const selMode = (e) => (e.shiftKey && e.altKey ? "intersect" : e.shiftKey ? "add" : e.altKey ? "subtract" : S.mode || "replace");
    const modeBtns = () => ["replace", "add", "subtract", "intersect"].map((m) => `<button class="ghost kxsm rfm${S.mode === m ? " on" : ""}" data-rfm="${m}" title="${{ replace: "New selection", add: "Add to selection (Shift)", subtract: "Subtract from selection (Alt)", intersect: "Intersect with selection (Shift+Alt)" }[m]}">${{ replace: "▢", add: "⊕", subtract: "⊖", intersect: "⊗" }[m]}</button>`).join("");
    const bindModes = (o) => o.querySelectorAll("[data-rfm]").forEach((b) => { b.onclick = () => { S.mode = b.dataset.rfm; E.renderOptions(); }; });

    /* ================================ SELECT AND MASK ================================ */
    let SMW = null;
    function selectAndMask() {
      if (!S.w) return say("open a picture first");
      if (SMW) return;
      const W = S.w, H = S.h, k = Math.min(1, 1200 / Math.max(W, H)), pw = Math.max(8, Math.round(W * k)), ph = Math.max(8, Math.round(H * k));
      const pic = newCanvas(pw, ph); ctx(pic).drawImage(E.flattenCache(), 0, 0, pw, ph);
      const rgba = ctx(pic).getImageData(0, 0, pw, ph).data;
      const scaleMask = (m, w0, h0, w1, h1) => { const c = newCanvas(w0, h0), g = ctx(c), id = g.createImageData(w0, h0); for (let i = 0; i < m.length; i++) id.data[i * 4 + 3] = m[i]; g.putImageData(id, 0, 0); const c2 = newCanvas(w1, h1), g2 = ctx(c2); g2.drawImage(c, 0, 0, w1, h1); const d = g2.getImageData(0, 0, w1, h1).data, o = new Uint8Array(w1 * h1); for (let i = 0; i < o.length; i++) o[i] = d[i * 4 + 3]; return o; };
      const base = E.hasSel() ? scaleMask(S.sel, W, H, pw, ph) : new Uint8Array(pw * ph);
      const extra = new Uint8Array(pw * ph);
      const o = Object.assign({ view: "overlay", opacity: 50, radius: 0, smart: false, smooth: 0, feather: 0, contrast: 0, shift: 0, decon: false, amount: 100, out: "selection" }, store.get("sm.opts", {}));
      SMW = { W, H, pw, ph, k, rgba, base, extra, o, tool: "qsel", size: +store.get("sm.size", 40) || 40, alpha: null, grad: PS.sobel(PS.gray(rgba, pw, ph), pw, ph) };
      const dlg = doc.createElement("div"); dlg.className = "smdlg"; dlg.id = "pcSelectMask";
      const VIEWS = [["overlay", "Overlay (red)"], ["black", "On Black"], ["white", "On White"], ["bw", "Black & White"], ["layers", "On Layers"]];
      const OUT = [["selection", "Selection"], ["mask", "Layer Mask"], ["layer", "New Layer"], ["layermask", "New Layer with Layer Mask"]];
      dlg.innerHTML = `<div class="smbar"><b>Select and Mask</b><span style="flex:1"></span><button class="ghost" id="smSky" title="Select the sky">☁ Sky</button><button class="ghost" id="smInv" title="Invert">⇄ Invert</button>
          <button class="ghost" id="smCancel">Cancel</button><button class="ghost" id="smOk">OK</button></div>
        <div class="smmain"><div class="smtools">
            <button class="ghost on" data-smt="qsel" title="Quick Selection (W) - grows to the edges; Alt takes away">◍</button>
            <button class="ghost" data-smt="refine" title="Refine Edge brush (R) - paint over hair / fur: the edge is searched there; Alt takes back">〰</button>
            <button class="ghost" data-smt="brush" title="Brush (B) - paint the selection by hand; Alt takes away">●</button></div>
          <div class="smview" id="smView"><canvas id="smCv" width="${pw}" height="${ph}"></canvas><div class="smring" id="smRing" style="display:none"></div></div>
          <div class="smside">
            <h5>View</h5><label><select id="smV" style="flex:1">${VIEWS.map(([v, l]) => `<option value="${v}"${v === o.view ? " selected" : ""}>${l}</option>`).join("")}</select></label>
            <label>Opacity <input type="range" id="smOp" min="0" max="100" value="${o.opacity}"></label>
            <label>Brush <input type="range" id="smSize" min="2" max="400" value="${SMW.size}"></label>
            <h5>Edge Detection</h5><label>Radius <input type="range" id="smR" min="0" max="250" value="${o.radius}"><span id="smRV">${o.radius}px</span></label>
            <label><input type="checkbox" id="smSmart" ${o.smart ? "checked" : ""}> Smart Radius</label>
            <h5>Global Refinements</h5><label>Smooth <input type="range" id="smS" min="0" max="100" value="${o.smooth}"><span id="smSV">${o.smooth}</span></label>
            <label>Feather <input type="range" id="smF" min="0" max="250" value="${o.feather}"><span id="smFV">${o.feather}px</span></label>
            <label>Contrast <input type="range" id="smC" min="0" max="100" value="${o.contrast}"><span id="smCV">${o.contrast}%</span></label>
            <label>Shift Edge <input type="range" id="smSh" min="-100" max="100" value="${o.shift}"><span id="smShV">${o.shift}%</span></label>
            <h5>Output</h5><label><input type="checkbox" id="smDe" ${o.decon ? "checked" : ""}> Decontaminate Colors</label><label>Amount <input type="range" id="smAm" min="0" max="100" value="${o.amount}"></label>
            <label>Output To <select id="smOut" style="flex:1">${OUT.map(([v, l]) => `<option value="${v}"${v === o.out ? " selected" : ""}>${l}</option>`).join("")}</select></label>
            <div style="color:var(--pc-dim);font-size:11px">Paint with Quick Selection, then Refine Edge over hair and fur. [ ] change the brush.</div></div></div>`;
      E.kx.appendChild(dlg);
      const cv = dlg.querySelector("#smCv"), view = dlg.querySelector("#smView"), ring = dlg.querySelector("#smRing"), g = ctx(cv);
      const fit = () => { const r = view.getBoundingClientRect(), z = Math.min((r.width - 20) / pw, (r.height - 20) / ph); SMW.z = z; cv.style.width = pw * z + "px"; cv.style.height = ph * z + "px"; cv.style.left = (r.width - pw * z) / 2 + "px"; cv.style.top = (r.height - ph * z) / 2 + "px"; };
      const compute = () => {
        const band = SMW.extra.some((v) => v) ? SMW.extra : null;
        let a = PS.refine(SMW.base, rgba, pw, ph, Object.assign({}, o, { radius: o.radius * k }));
        if (band) { const wide = PS.refine(SMW.base, rgba, pw, ph, Object.assign({}, o, { radius: Math.max(o.radius * k, 24 * k + 8) })); a = a.map((v, i) => (band[i] ? wide[i] : v)); }
        SMW.alpha = a; return a;
      };
      const paint = () => {
        const a = SMW.alpha || compute(), id = g.createImageData(pw, ph), d = id.data, op = o.opacity / 100;
        for (let i = 0; i < pw * ph; i++) {
          const al = a[i] / 255, j = i * 4, r = rgba[j], gg = rgba[j + 1], b = rgba[j + 2];
          if (o.view === "overlay") { const k2 = (1 - al) * op; d[j] = r + (255 - r) * k2; d[j + 1] = gg * (1 - k2); d[j + 2] = b * (1 - k2); d[j + 3] = 255; }
          else if (o.view === "black" || o.view === "white") { const bg = o.view === "black" ? 0 : 255, k2 = 1 - (1 - al) * op; d[j] = bg + (r - bg) * k2; d[j + 1] = bg + (gg - bg) * k2; d[j + 2] = bg + (b - bg) * k2; d[j + 3] = 255; }
          else if (o.view === "bw") { d[j] = d[j + 1] = d[j + 2] = a[i]; d[j + 3] = 255; }
          else { d[j] = r; d[j + 1] = gg; d[j + 2] = b; d[j + 3] = Math.round(al * 255); }
        }
        g.putImageData(id, 0, 0);
      };
      let pt = null;
      const update = () => { clearTimeout(pt); pt = setTimeout(() => { SMW.alpha = null; compute(); paint(); }, 60); };
      SMW.update = update; SMW.paint = paint;
      fit(); compute(); paint();
      const posOf = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / SMW.z, (e.clientY - r.top) / SMW.z]; };
      let down = null;
      const dab = (x, y, alt) => {
        const r = SMW.size * k / 2;
        if (SMW.tool === "qsel") {
          const grow = PS.quickGrow(rgba, pw, ph, x, y, r, 40, 0.35, SMW.grad);
          for (let i = 0; i < grow.length; i++) if (grow[i]) SMW.base[i] = alt ? 0 : 255;
        } else {
          const tgt = SMW.tool === "refine" ? SMW.extra : SMW.base;
          for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(ph - 1, Math.ceil(y + r)); yy++) for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(pw - 1, Math.ceil(x + r)); xx++) {
            if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) tgt[yy * pw + xx] = alt ? 0 : 255;
          }
        }
        update();
      };
      cv.onpointerdown = (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); const p = posOf(e); down = { last: p, alt: e.altKey }; dab(p[0], p[1], e.altKey); };
      cv.onpointermove = (e) => {
        const p = posOf(e), vr = view.getBoundingClientRect(), r = SMW.size / 2 * k * SMW.z;
        ring.style.display = ""; ring.style.width = ring.style.height = 2 * r + "px"; ring.style.left = (e.clientX - vr.left - r) + "px"; ring.style.top = (e.clientY - vr.top - r) + "px";
        if (!down) return;
        const step = Math.max(1, SMW.size * k / 4), d = Math.hypot(p[0] - down.last[0], p[1] - down.last[1]); if (d < step) return;
        const n = Math.ceil(d / step); for (let i = 1; i <= n; i++) dab(down.last[0] + (p[0] - down.last[0]) * i / n, down.last[1] + (p[1] - down.last[1]) * i / n, down.alt);
        down.last = p;
      };
      cv.onpointerup = cv.onpointercancel = () => { down = null; };
      cv.onpointerleave = () => { ring.style.display = "none"; };
      dlg.querySelectorAll("[data-smt]").forEach((b) => { b.onclick = () => { SMW.tool = b.dataset.smt; dlg.querySelectorAll("[data-smt]").forEach((x) => x.classList.toggle("on", x === b)); }; });
      const num = (id, key, unit) => { const el = dlg.querySelector("#" + id), v = dlg.querySelector("#" + id + "V"); el.oninput = () => { o[key] = +el.value; if (v) v.textContent = el.value + (unit || ""); update(); }; };
      num("smR", "radius", "px"); num("smS", "smooth"); num("smF", "feather", "px"); num("smC", "contrast", "%"); num("smSh", "shift", "%"); num("smOp", "opacity"); num("smAm", "amount");
      dlg.querySelector("#smSmart").onchange = (e) => { o.smart = e.target.checked; update(); };
      dlg.querySelector("#smDe").onchange = (e) => { o.decon = e.target.checked; };
      dlg.querySelector("#smV").onchange = (e) => { o.view = e.target.value; paint(); };
      dlg.querySelector("#smOut").onchange = (e) => { o.out = e.target.value; };
      const sz = dlg.querySelector("#smSize"); sz.oninput = () => { SMW.size = +sz.value; store.set("sm.size", SMW.size); };
      dlg.querySelector("#smSky").onclick = () => { const m = PS.skyMask(rgba, pw, ph); for (let i = 0; i < m.length; i++) SMW.base[i] = m[i] > 127 ? 255 : SMW.base[i]; update(); };
      dlg.querySelector("#smInv").onclick = () => { for (let i = 0; i < SMW.base.length; i++) SMW.base[i] = 255 - SMW.base[i]; update(); };
      const close = () => { doc.removeEventListener("keydown", keys, true); dlg.remove(); SMW = null; };
      const keys = (e) => {
        if (!SMW) return;
        if (e.target && /INPUT|SELECT/.test(e.target.tagName) && e.target.type !== "range") return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); say("Select and Mask cancelled"); return; }
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); dlg.querySelector("#smOk").click(); return; }
        if (e.key === "[" || e.key === "]") { SMW.size = Math.max(2, Math.min(400, Math.round(SMW.size * (e.key === "]" ? 1.15 : 1 / 1.15)))); sz.value = SMW.size; e.preventDefault(); e.stopPropagation(); return; }
        const t = { w: "qsel", r: "refine", b: "brush" }[e.key.toLowerCase()];
        if (t && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); dlg.querySelector(`[data-smt="${t}"]`).click(); }
      };
      doc.addEventListener("keydown", keys, true);
      dlg.querySelector("#smCancel").onclick = () => { close(); say("Select and Mask cancelled"); };
      dlg.querySelector("#smOk").onclick = () => {
        store.set("sm.opts", Object.assign({}, o));
        const s = SMW; close();
        // full size: the painted selection scaled up, then refined at the real resolution
        const fullBase = (s.pw === W && s.ph === H) ? s.base : scaleMask(s.base, s.pw, s.ph, W, H).map((v) => (v > 127 ? 255 : 0));
        const fullBand = s.extra.some((v) => v) ? ((s.pw === W && s.ph === H) ? s.extra : scaleMask(s.extra, s.pw, s.ph, W, H)) : null;
        const img = flat();
        let a = PS.refine(fullBase, img, W, H, o);
        if (fullBand) { const wide = PS.refine(fullBase, img, W, H, Object.assign({}, o, { radius: Math.max(o.radius, 24) })); a = a.map((v, i) => (fullBand[i] > 127 ? wide[i] : v)); }
        output(a, o);
      };
      E.smState = () => SMW;
      say("Select and Mask: paint with Quick Selection (W), Refine Edge (R) over hair, Brush (B) by hand - Alt takes away · Enter = OK, Esc = Cancel");
    }
    /** the refined alpha out: a selection, the active layer's mask, a new layer (+ its mask) */
    function output(a, o) {
      const L = E.layer();
      if (o.out === "selection" || !L) { E.changeSel(Uint8Array.from(a), "select and mask"); return; }
      if (o.out === "mask") {
        const before = E.snapStruct(), list = [];
        if (L.mask) { const copy = E.beginPx(L, "mask"), g = ctx(L.mask.canvas), id = g.createImageData(S.w, S.h); for (let i = 0; i < a.length; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = a[i]; id.data[i * 4 + 3] = 255; } g.putImageData(id, 0, 0); const px = E.endPx(L, copy, null, "mask", "mask"); if (px) list.push(px); }
        else { L.mask = maskFrom(a); }
        list.push({ t: "struct", before, after: E.snapStruct() });
        E.push({ t: "multi", list, label: "select and mask: layer mask" }); E.refresh(); E.renderLayersPanel(); return;
      }
      // a new layer: the active layer's pixels (decontaminated) - with the alpha as its mask, or cut by it
      const src = L.type === "pixel" ? L.canvas : E.flattenCache();
      let px = ctx(src).getImageData(0, 0, S.w, S.h).data;
      if (o.decon) px = PS.decontaminate(px, a, S.w, S.h, o.amount / 100, 6);
      E.structOp("select and mask: " + (o.out === "layer" ? "new layer" : "new layer with mask"), () => {
        const n = E.makeLayer(L.name + " copy", S.w, S.h), g = ctx(n.canvas), id = g.createImageData(S.w, S.h);
        id.data.set(px);
        if (o.out === "layer") for (let i = 0; i < a.length; i++) id.data[i * 4 + 3] = id.data[i * 4 + 3] * a[i] / 255;
        g.putImageData(id, 0, 0);
        if (o.out === "layermask") n.mask = maskFrom(a);
        const at = S.layers.indexOf(L); n.parent = L.parent; L.visible = false;
        S.layers.splice(at + 1, 0, n); S.active = at + 1;
      });
    }
    function maskFrom(a) { const m = E.newMask("#000"), g = ctx(m.canvas), id = g.createImageData(S.w, S.h); for (let i = 0; i < a.length; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = a[i]; id.data[i * 4 + 3] = 255; } g.putImageData(id, 0, 0); m.ver++; return m; }

    /* ================================ MAGNETIC LASSO ================================ */
    let ML = null;
    S.magWidth = +store.get("ml.w", 30) || 30; S.magContrast = +store.get("ml.c", 10) || 10; S.magFreq = +store.get("ml.f", 57) || 57;
    function mlCost() { return PS.edgeCost(flat(), S.w, S.h, S.magContrast / 100); }
    T.maglasso = {
      id: "maglasso", name: "Magnetic Lasso", cursor: "crosshair",
      options() {
        return modeBtns() + `<span class="sep"></span><label title="How far from the pointer an edge is looked for (px)">Width <input type="number" id="mlW" min="2" max="200" value="${S.magWidth}"></label>`
          + `<label title="How strong an edge must be (%)">Contrast <input type="number" id="mlC" min="1" max="100" value="${S.magContrast}"></label>`
          + `<label title="An anchor every this many px (0 - 100)">Frequency <input type="number" id="mlF" min="0" max="100" value="${S.magFreq}"></label>`
          + `<span class="pnhint" title="click to start, move along an edge, click to set a point, Backspace takes the last one back, double-click / Enter / the first point closes it, Esc cancels" style="color:var(--pc-dim);padding:0 4px">ⓘ</span>`;
      },
      bindOptions(o) {
        bindModes(o);
        const n = (id, k, sk) => { const el = o.querySelector("#" + id); el.onchange = () => { S[k] = Math.max(+el.min, Math.min(+el.max, +el.value || 0)); store.set(sk, S[k]); if (k === "magContrast" && ML) ML.cost = mlCost(); }; };
        n("mlW", "magWidth", "ml.w"); n("mlC", "magContrast", "ml.c"); n("mlF", "magFreq", "ml.f");
      },
      down(e, fx, fy) {
        const x = Math.round(fx), y = Math.round(fy);
        if (!ML) { ML = { cost: mlCost(), pts: [[x, y]], anchors: [0], live: [], mode: selMode(e) }; E.drawOverlay(); say("magnetic lasso: move along an edge - a click sets a point, Backspace takes one back, double-click / Enter / the first point closes it, Esc cancels"); return false; }
        const f = ML.pts[0];
        if (ML.pts.length > 2 && Math.hypot(f[0] - fx, f[1] - fy) <= 8 / (S.zoom || 1)) { closeML(); return false; }
        fixLive(); ML.anchors.push(ML.pts.length - 1); E.drawOverlay(); return false;
      },
      hover(e, fx, fy) {
        if (!ML) return;
        const last = ML.pts[ML.pts.length - 1], to = [Math.max(0, Math.min(S.w - 1, Math.round(fx))), Math.max(0, Math.min(S.h - 1, Math.round(fy)))];
        const box = (Math.abs(to[0] - last[0]) + 2 * S.magWidth) * (Math.abs(to[1] - last[1]) + 2 * S.magWidth);
        ML.live = box > 400000 ? [last, to] : PS.liveWire(ML.cost, S.w, S.h, last, to, S.magWidth);
        // automatic anchors: when the snapped line is longer than Frequency asks
        const every = S.magFreq > 0 ? Math.max(8, 110 - S.magFreq) : Infinity;
        if (ML.live.length > every) { const keep = ML.live.slice(1, Math.floor(ML.live.length * 0.7)); ML.pts.push(...keep); ML.anchors.push(ML.pts.length - 1); ML.live = PS.liveWire(ML.cost, S.w, S.h, ML.pts[ML.pts.length - 1], to, S.magWidth); }
      },
      dblclick() { if (ML) { fixLive(); closeML(); } },
      key(e) {
        if (!ML) return false;
        if (e.key === "Enter") { fixLive(); closeML(); return true; }
        if (e.key === "Escape") { ML = null; E.drawOverlay(); say("magnetic lasso cancelled"); return true; }
        if (e.key === "Backspace" || e.key === "Delete") { if (ML.anchors.length > 1) { ML.anchors.pop(); ML.pts.length = ML.anchors[ML.anchors.length - 1] + 1; ML.live = []; E.drawOverlay(); } return true; }
        return false;
      },
      leave() { ML = null; },
    };
    function fixLive() { if (ML && ML.live.length > 1) { ML.pts.push(...ML.live.slice(1)); ML.live = []; } }
    function closeML() {
      const m = ML; ML = null; E.drawOverlay();
      if (!m || m.pts.length < 3) return say("a magnetic lasso needs three points at least");
      const back = PS.liveWire(m.cost, S.w, S.h, m.pts[m.pts.length - 1], m.pts[0], S.magWidth);
      const poly = m.pts.concat(back.slice(1)).map(([x, y]) => [x + 0.5, y + 0.5]);
      E.applyShape(P.polygonMask(poly, S.w, S.h), m.mode, "magnetic lasso");
    }
    E.overlayHooks.push((g, px) => {
      if (!ML) return;
      const line = (pts, col) => { if (pts.length < 2) return; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + 0.5, y + 0.5) : g.moveTo(x + 0.5, y + 0.5))); g.strokeStyle = "#000"; g.lineWidth = 2.5 * px; g.stroke(); g.strokeStyle = col; g.lineWidth = 1.2 * px; g.stroke(); };
      line(ML.pts, "#fff"); line(ML.live, "#4fc3ff");
      for (const k of ML.anchors) { const [x, y] = ML.pts[k]; g.fillStyle = "#fff"; g.fillRect(x - 2.5 * px, y - 2.5 * px, 5 * px, 5 * px); g.strokeStyle = "#000"; g.lineWidth = px; g.strokeRect(x - 2.5 * px, y - 2.5 * px, 5 * px, 5 * px); }
    });

    /* ================================ QUICK SELECTION (edge-aware) ================================ */
    let QS = null;
    S.qsTol = +store.get("qs.tol", 40) || 40; S.qsAuto = store.get("qs.auto", true) !== false;
    T.qsel = {
      id: "qsel", name: "Quick Selection", brush: true, cursor: "none",
      options() {
        return modeBtns() + `<span class="sep"></span><label title="Brush size ([ and ])">Size <input type="number" id="qsSize" min="2" max="600" value="${Math.round(S.selBrush || 24)}"></label>`
          + `<label title="How different a colour may be and still be taken (0 - 255)">Tolerance <input type="number" id="qsTol" min="1" max="255" value="${S.qsTol}"></label>`
          + `<label title="A smoother, softer edge after each stroke"><input type="checkbox" id="qsAuto" ${S.qsAuto ? "checked" : ""}> Auto-Enhance</label>`;
      },
      bindOptions(o) {
        bindModes(o);
        o.querySelector("#qsSize").onchange = (e) => { S.selBrush = Math.max(2, +e.target.value || 24); };
        o.querySelector("#qsTol").onchange = (e) => { S.qsTol = Math.max(1, Math.min(255, +e.target.value || 40)); store.set("qs.tol", S.qsTol); };
        o.querySelector("#qsAuto").onchange = (e) => { S.qsAuto = e.target.checked; store.set("qs.auto", S.qsAuto); };
      },
      down(e, fx, fy) {
        const img = flat();
        // Photoshop's way: the first stroke makes a new selection, the next ones add (Alt takes away)
        const sub = e.altKey || S.mode === "subtract", fresh = !sub && S.mode === "replace" && !e.shiftKey && !(QS && QS.used);
        QS = { img, grad: PS.sobel(PS.gray(img, S.w, S.h), S.w, S.h), before: Uint8Array.from(S.sel), last: [fx, fy], sub, used: true };
        if (fresh) S.sel.fill(0);
        grow(fx, fy);
      },
      move(e, fx, fy) {
        if (!QS || !QS.img) return;
        const r = (S.selBrush || 24) / 2, d = Math.hypot(fx - QS.last[0], fy - QS.last[1]); if (d < r / 2) return;
        const n = Math.ceil(d / (r / 2)); for (let i = 1; i <= n; i++) grow(QS.last[0] + (fx - QS.last[0]) * i / n, QS.last[1] + (fy - QS.last[1]) * i / n);
        QS.last = [fx, fy];
      },
      up() {
        if (!QS || !QS.img) return;
        let m = Uint8Array.from(S.sel);
        if (S.qsAuto) m = PS.refine(m, QS.img, S.w, S.h, { radius: 3, smooth: 1 });
        const before = QS.before; QS.img = null; QS.grad = null;
        E.setSel(before, true); E.changeSel(m, "quick selection");
      },
      leave() { if (QS) QS.used = false; },
    };
    function grow(x, y) {
      const m = PS.quickGrow(QS.img, S.w, S.h, x, y, (S.selBrush || 24) / 2, S.qsTol, 0.3, QS.grad);
      const s = S.sel; for (let i = 0; i < m.length; i++) if (m[i]) s[i] = QS.sub ? 0 : 255;
      E.setSel(s, true); E.drawOverlay();
    }

    /* ================================ SELECT SKY ================================ */
    function selectSky() {
      if (!S.w) return say("open a picture first");
      const m = PS.skyMask(flat(), S.w, S.h); let n = 0; for (const v of m) if (v > 127) n++;
      if (!n) return say("no sky found (a smooth, sky-coloured area reaching the top edge)");
      E.changeSel(m, "select sky"); say(`sky selected (${Math.round(n / (S.w * S.h) * 100)}% of the picture) - Select and Mask refines the skyline`);
    }

    /* ================================ CHANNELS ================================ */
    let viewCh = null;
    let cid = 0;
    const chId = () => { cid = Math.max(cid, ...S.channels.map((c) => c.id || 0)) + 1; return cid; };
    function saveSel(name, into, op) {
      if (!E.hasSel()) return say("select something first");
      const data = Uint8Array.from(S.sel);
      E.structOp("save selection", () => {
        if (into) {
          const c = S.channels.find((x) => x.id === into); if (!c) return false;
          const nd = op && op !== "replace" ? P.combine(Uint8Array.from(c.data), data, op) : data;
          S.channels = S.channels.map((x) => (x === c ? Object.assign({}, x, { data: nd }) : x));
        } else S.channels = S.channels.concat([{ id: chId(), name: name || "Alpha " + (S.channels.length + 1), w: S.w, h: S.h, data }]);
      });
      paintChannels();
    }
    function loadSel(id, op, invert) {
      const c = S.channels.find((x) => x.id === id); if (!c) return say("no such channel");
      let m = Uint8Array.from(c.data); if (invert) m = P.invert(m);
      E.applyShape(m, op || "replace", "load selection");
    }
    /* ---- 2.467.0: TARGETED colour channels (edits change only them) + editing alpha / SPOT channels ---- */
    const CH = () => root.PCChannels;
    S.chTarget = S.chTarget || null;            // null = all of R, G, B
    const tgtStr = () => (S.chTarget ? ["r", "g", "b"].filter((k) => S.chTarget[k]).join("") : "rgb");
    /** target colour channel(s): "rgb" = all; shift = toggle k in the current target */
    function targetCh(k, toggle) {
      let cur = new Set(tgtStr() === "rgb" ? ["r", "g", "b"] : tgtStr().split(""));
      if (k === "rgb") cur = new Set(["r", "g", "b"]);
      else if (toggle) { if (cur.has(k) && cur.size > 1) cur.delete(k); else cur.add(k); }
      else cur = new Set([k]);
      const s = ["r", "g", "b"].filter((x) => cur.has(x)).join("");
      S.chTarget = s === "rgb" ? null : CH().targetOf(s);
      viewCh = s === "rgb" ? null : s.length === 1 ? s : "t:" + s;
      paintChannels(); E.drawOverlay();
      say(s === "rgb" ? "all channels - edits change R, G and B" : `editing ${s.toUpperCase().split("").join(" + ")} only - painting, fills and filters change just ${s.length === 1 ? "that channel" : "those channels"} (Ctrl+2 / RGB = all)`);
    }
    let cedit = null;                          // {id, before} - an alpha / spot channel being painted (through the quick-mask canvas)
    function editChannel(id) {
      const c = S.channels.find((x) => x.id === id); if (!c) return say("pick an alpha or spot channel first");
      if (S.qm) E.quickMask(false);
      const cv = newCanvas(S.w, S.h), g = ctx(cv), im = g.createImageData(S.w, S.h);
      for (let i = 0; i < c.data.length; i++) im.data[i * 4 + 3] = c.data[i];
      g.putImageData(im, 0, 0);
      S.qm = cv; S.qmBefore = Uint8Array.from(S.sel); cedit = { id };
      if (!["paint", "erase", "fill"].includes(S.tool)) E.setTool("paint");
      E.refresh(); if (E.ui.qm) E.ui.qm(true); paintChannels();
      say(`painting "${c.name}": the brush adds to it, the eraser takes away - ✔ in the Channels panel (or Q) when done`);
    }
    function endEditChannel(keep) {
      if (!cedit || !S.qm) { cedit = null; return; }
      const d = ctx(S.qm).getImageData(0, 0, S.w, S.h).data, m = new Uint8Array(S.w * S.h), id = cedit.id;
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
      while (S.undo.length && S.undo[S.undo.length - 1].qm) S.undo.pop();      // the strokes fold into one step
      S.qm = null; cedit = null; E.refresh(); if (E.ui.qm) E.ui.qm(false);
      if (keep !== false) E.structOp("paint channel", () => { S.channels = S.channels.map((x) => (x.id === id ? Object.assign({}, x, { data: m }) : x)); });
      paintChannels(); E.drawOverlay();
    }
    const baseQm = E.quickMask;
    E.quickMask = function (on) { if (cedit) { if (on !== true) endEditChannel(true); return; } return baseQm.apply(this, arguments); };
    function spotDialog(id) {
      const c = id ? S.channels.find((x) => x.id === id) : null, sp = (c && c.spot) || { color: "#e6007e", solidity: 0 };
      E.ui.dialog(c ? "Spot Channel Options" : "New Spot Channel", `<div class="rw"><span>Name</span><input type="text" id="spN" value="${esc(c ? c.name : "Spot Color " + (S.channels.filter((x) => x.spot).length + 1))}" style="grid-column:2/4"></div>
        <div class="rw"><span>Ink colour</span><input type="color" id="spC" value="${esc(sp.color)}"></div>
        <div class="rw"><span>Solidity %</span><input type="number" id="spS" min="0" max="100" value="${+sp.solidity || 0}" title="How opaque the ink looks on screen (0 = see-through like a varnish, 100 = covers)"></div>
        ${c ? "" : `<div class="rw" style="color:var(--pc-dim)">${E.hasSel() ? "The selection becomes the ink." : "Empty - paint it (✎) or fill it from a selection."}</div>`}`,
      (d) => {
        const name = d.querySelector("#spN").value.trim().slice(0, 40) || "Spot Color", spot = { color: d.querySelector("#spC").value, solidity: Math.max(0, Math.min(100, +d.querySelector("#spS").value || 0)) };
        if (c) E.structOp("spot channel options", () => { S.channels = S.channels.map((x) => (x.id === c.id ? Object.assign({}, x, { name, spot }) : x)); });
        else E.structOp("new spot channel", () => { S.channels = S.channels.concat([{ id: chId(), name, w: S.w, h: S.h, data: E.hasSel() ? Uint8Array.from(S.sel) : new Uint8Array(S.w * S.h), spot }]); });
        paintChannels(); E.drawOverlay();
      }, { okLabel: c ? "OK" : "◍ Make" });
    }
    /** Merge Spot Channel: its ink as a pixel layer on top (the channel goes) */
    function mergeSpot(id) {
      const c = S.channels.find((x) => x.id === id && x.spot); if (!c) return say("pick a spot channel first");
      E.structOp("merge spot channel", () => {
        const L = E.makeLayer(c.name, S.w, S.h, "pixel"), g = ctx(L.canvas), im = g.createImageData(S.w, S.h);
        im.data.set(CH().inkOf(c.data, c.spot.color, shownSolidity(c.spot))); g.putImageData(im, 0, 0);   // as it shows
        S.layers = S.layers.concat([L]); S.active = S.layers.length - 1;
        S.channels = S.channels.filter((x) => x.id !== c.id);
      });
      if (viewCh === "a" + id) viewCh = null; pickedCh = null;
      E.refresh(); E.renderLayersPanel(); paintChannels(); E.drawOverlay();
      say(`"${c.name}" merged - its ink is a layer on top now`);
    }
    function channelSel(k) {      // a colour channel's lightness as a selection
      const d = flat(), m = new Uint8Array(S.w * S.h), o = { r: 0, g: 1, b: 2 }[k];
      for (let i = 0; i < m.length; i++) m[i] = o == null ? Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) : d[i * 4 + o];
      E.changeSel(m, "load " + (o == null ? "RGB" : k.toUpperCase()) + " channel");
    }
    const thumb = (fill) => { const c = newCanvas(36, 26), g = ctx(c); if (!g || !S.w) return c; const t = newCanvas(S.w, S.h), tg = ctx(t), id = tg.createImageData(S.w, S.h); fill(id.data); tg.putImageData(id, 0, 0); const k = Math.min(36 / S.w, 26 / S.h); g.drawImage(t, (36 - S.w * k) / 2, (26 - S.h * k) / 2, S.w * k, S.h * k); return c; };
    function paintChannels() {
      const box = $("pcChannels"); if (!box || !box.classList.contains("on")) return;
      box.innerHTML = `<div class="kxlayers" id="chList" style="min-height:90px"></div><div class="kxlbtns">
        <button class="ghost" id="chLoadB" title="Load the channel as a selection (Ctrl-click a row does it too)">⬚</button>
        <button class="ghost" id="chSaveB" title="Save the selection as a new channel">◫</button>
        <button class="ghost" id="chNewB" title="New (empty) alpha channel">＋</button>
        <button class="ghost" id="chDelB" title="Delete the alpha channel">🗑</button>
        <button class="ghost" id="chSpotB" title="New Spot Channel… (the selection becomes its ink)">◍</button>
        <button class="ghost" id="chEditB" title="${cedit ? "Done painting the channel" : "Paint the picked alpha / spot channel"}">${cedit ? "✔" : "✎"}</button>
        <button class="ghost" id="chMergeB" title="Merge Spot Channel (its ink as a layer on top)">⇣</button></div>`;
      const list = box.querySelector("#chList");
      if (!S.w) { list.innerHTML = `<div style="color:var(--pc-dim);padding:6px">Open a picture.</div>`; return; }
      const d = flat();
      const rows = [["rgb", "RGB", (o) => { for (let i = 0; i < d.length; i++) o[i] = d[i]; }], ["r", "Red", (o) => { for (let i = 0; i < d.length; i += 4) { o[i] = o[i + 1] = o[i + 2] = d[i]; o[i + 3] = 255; } }],
        ["g", "Green", (o) => { for (let i = 0; i < d.length; i += 4) { o[i] = o[i + 1] = o[i + 2] = d[i + 1]; o[i + 3] = 255; } }], ["b", "Blue", (o) => { for (let i = 0; i < d.length; i += 4) { o[i] = o[i + 1] = o[i + 2] = d[i + 2]; o[i + 3] = 255; } }]];
      for (const [k, n, f] of rows) {
        const ts = tgtStr(), tg = k === "rgb" ? ts === "rgb" : ts.includes(k);
        const row = doc.createElement("div"); row.className = "kxlayer chrow" + (tg ? " on tgt" : "") + ((viewCh || "rgb") === k ? " view" : ""); row.dataset.ch = k;
        row.title = k === "rgb" ? "All channels (Ctrl-click: its lightness as a selection)" : "Click: edit only this channel · Shift-click: add / take it from the edited ones · Ctrl-click: load it as a selection";
        const nm = doc.createElement("span"); nm.className = "nm"; nm.textContent = (tg && ts !== "rgb" && k !== "rgb" ? "✎ " : "") + n;
        const kk = doc.createElement("span"); kk.style.cssText = "margin-left:auto;color:var(--pc-dim);font-size:11px"; kk.textContent = { rgb: "Ctrl+2", r: "Ctrl+3", g: "Ctrl+4", b: "Ctrl+5" }[k];
        row.append(thumb(f), nm, kk);
        row.onclick = (e) => { if (e.ctrlKey || e.metaKey) return channelSel(k); targetCh(k, e.shiftKey); };
        list.appendChild(row);
      }
      for (const c of S.channels) {
        const row = doc.createElement("div"); row.className = "kxlayer chrow" + (viewCh === "a" + c.id ? " on" : "") + (pickedCh === c.id ? " pick" : ""); row.dataset.ach = c.id;
        const nm = doc.createElement("span"); nm.className = "nm"; nm.textContent = (cedit && cedit.id === c.id ? "✎ " : "") + c.name;
        row.append(thumb((o) => { for (let i = 0; i < c.data.length; i++) { o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = c.data[i]; o[i * 4 + 3] = 255; } }), nm);
        if (c.spot) {                                // 2.467.0: a spot channel - its ink colour (double-click: its options)
          const sw = doc.createElement("span"); sw.className = "chspot"; sw.title = `spot colour ${c.spot.color}, solidity ${c.spot.solidity || 0}% - double-click for its options`;
          sw.style.cssText = `margin-left:auto;width:14px;height:14px;border:1px solid var(--pc-line);border-radius:2px;background:${c.spot.color}`;
          sw.ondblclick = (e) => { e.stopPropagation(); spotDialog(c.id); }; row.append(sw); row.dataset.spot = "1";
        }
        row.onclick = (e) => { pickedCh = c.id; if (e.ctrlKey || e.metaKey) return loadSel(c.id, e.shiftKey ? "add" : e.altKey ? "subtract" : "replace"); viewCh = viewCh === "a" + c.id ? null : "a" + c.id; paintChannels(); E.drawOverlay(); };
        nm.ondblclick = (e) => {
          e.stopPropagation(); const inp = doc.createElement("input"); inp.type = "text"; inp.value = c.name; inp.style.width = "100%"; nm.replaceWith(inp); inp.focus(); inp.select();
          const done = (ok) => { if (ok && inp.value.trim()) E.structOp("rename channel", () => { S.channels = S.channels.map((x) => (x.id === c.id ? Object.assign({}, x, { name: inp.value.trim().slice(0, 40) }) : x)); }); paintChannels(); };
          inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === "Enter") done(true); if (ev.key === "Escape") done(false); }; inp.onblur = () => done(true);
        };
        list.appendChild(row);
      }
      const q = (id) => box.querySelector("#" + id);
      q("chLoadB").onclick = () => { if (pickedCh && S.channels.some((c) => c.id === pickedCh)) loadSel(pickedCh); else if (viewCh && viewCh.length === 1) channelSel(viewCh); else say("pick an alpha channel (or a colour channel) first"); };
      q("chSaveB").onclick = () => saveSel();
      q("chNewB").onclick = () => { E.structOp("new channel", () => { S.channels = S.channels.concat([{ id: chId(), name: "Alpha " + (S.channels.length + 1), w: S.w, h: S.h, data: new Uint8Array(S.w * S.h) }]); }); paintChannels(); };
      q("chSpotB").onclick = () => spotDialog(null);
      q("chEditB").onclick = () => { if (cedit) return endEditChannel(true); if (!pickedCh) return say("pick an alpha or spot channel first"); editChannel(pickedCh); };
      q("chMergeB").onclick = () => mergeSpot(pickedCh);
      q("chDelB").onclick = () => { if (!pickedCh) return say("pick an alpha channel first"); E.structOp("delete channel", () => { S.channels = S.channels.filter((x) => x.id !== pickedCh); }); if (viewCh === "a" + pickedCh) viewCh = null; pickedCh = null; paintChannels(); E.drawOverlay(); };
    }
    let pickedCh = null;
    E.ui.channels = paintChannels;
    if (E.ui.layers) { const base = E.ui.layers; E.ui.layers = function () { const r = base.apply(this, arguments); paintChannels(); return r; }; }
    // what a channel view shows: the channel in grey over the picture (editing still changes the picture)
    E.overlayHooks.unshift((g) => {
      if (!viewCh || !S.w) return;
      const t = newCanvas(S.w, S.h), tg = ctx(t), id = tg.createImageData(S.w, S.h), o = id.data;
      if (viewCh[0] === "a") { const c = S.channels.find((x) => "a" + x.id === viewCh); if (!c) { viewCh = null; return; } for (let i = 0; i < c.data.length; i++) { o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = c.data[i]; o[i * 4 + 3] = 255; } }
      else if (viewCh.startsWith("t:")) o.set(CH().viewOf(flat(), CH().targetOf(viewCh.slice(2))));        // 2.467.0: two channels in colour
      else { const d = flat(), k = { r: 0, g: 1, b: 2 }[viewCh]; for (let i = 0; i < d.length; i += 4) { o[i] = o[i + 1] = o[i + 2] = d[i + k]; o[i + 3] = 255; } }
      tg.putImageData(id, 0, 0); g.drawImage(t, 0, 0);
    });
    // 2.467.0: SPOT channels' ink shown over the picture (not in its layers: Merge Spot Channel puts it there)
    /** on screen a spot ink shows at 35 % (solidity 0, a see-through varnish) .. 100 % (solidity 100, it covers) */
    const shownSolidity = (sp) => 35 + 0.65 * Math.max(0, Math.min(100, +sp.solidity || 0));
    let inkCache = { refs: [], c: null };
    E.overlayHooks.splice(1, 0, (g) => {
      if (viewCh || !S.w || !CH()) return;
      const spots = S.channels.filter((c) => c.spot && c.data && c.data.length === S.w * S.h); if (!spots.length) return;
      const refs = spots.map((c) => [c.data, c.spot.color, c.spot.solidity]);
      const same = inkCache.c && inkCache.c.width === S.w && inkCache.c.height === S.h && inkCache.refs.length === refs.length && refs.every((r, i) => r.every((v, k) => v === inkCache.refs[i][k]));
      if (!same) {
        const t = newCanvas(S.w, S.h), tg = ctx(t);
        for (const c of spots) { const tmp = newCanvas(S.w, S.h), xg = ctx(tmp), im = xg.createImageData(S.w, S.h); im.data.set(CH().inkOf(c.data, c.spot.color, shownSolidity(c.spot))); xg.putImageData(im, 0, 0); tg.drawImage(tmp, 0, 0); }
        inkCache = { refs, c: t };
      }
      g.drawImage(inkCache.c, 0, 0);
    });
    // channels follow crop / canvas size / image size / rotate (their own size -> the picture's, through the matrix)
    const baseMap = E.mapPaths;
    E.mapPaths = (m, shapes) => {
      if (baseMap) baseMap(m, shapes);
      S.channels = S.channels.map((c) => {
        const a = newCanvas(c.w, c.h), ag = ctx(a), id = ag.createImageData(c.w, c.h); for (let i = 0; i < c.data.length; i++) id.data[i * 4 + 3] = c.data[i]; ag.putImageData(id, 0, 0);
        const b = newCanvas(S.w, S.h), bg = ctx(b); bg.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); bg.drawImage(a, 0, 0);
        const d = bg.getImageData(0, 0, S.w, S.h).data, nd = new Uint8Array(S.w * S.h); for (let i = 0; i < nd.length; i++) nd[i] = d[i * 4 + 3];
        return Object.assign({}, c, { w: S.w, h: S.h, data: nd });
      });
    };

    /* ---------------- dialogs + commands ---------------- */
    function dlgSave() {
      if (!E.hasSel()) return say("select something first");
      E.ui.dialog("Save Selection", `<div class="rw"><span>Channel</span><select id="chTo" style="grid-column:2/4"><option value="">New</option>${S.channels.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div>
        <div class="rw"><span>Name</span><input type="text" id="chName" value="Alpha ${S.channels.length + 1}" style="grid-column:2/4"></div>
        <div class="rw"><span>Operation</span><select id="chOp" style="grid-column:2/4"><option value="replace">Replace Channel</option><option value="add">Add to Channel</option><option value="subtract">Subtract from Channel</option><option value="intersect">Intersect with Channel</option></select></div>`,
      (d) => { const to = +d.querySelector("#chTo").value || 0; saveSel(d.querySelector("#chName").value.trim(), to || null, d.querySelector("#chOp").value); });
    }
    function dlgLoad() {
      if (!S.channels.length) return say("no saved selections yet (Select ▸ Save Selection…)");
      E.ui.dialog("Load Selection", `<div class="rw"><span>Channel</span><select id="chFrom" style="grid-column:2/4">${S.channels.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div>
        <div class="rw"><label><input type="checkbox" id="chInv"> Invert</label></div>
        <div class="rw"><span>Operation</span><select id="chLOp" style="grid-column:2/4"><option value="replace">New Selection</option><option value="add">Add to Selection</option><option value="subtract">Subtract from Selection</option><option value="intersect">Intersect with Selection</option></select></div>`,
      (d) => loadSel(+d.querySelector("#chFrom").value, d.querySelector("#chLOp").value, d.querySelector("#chInv").checked));
    }
    if (E.ui.addCmd) {
      const C = E.ui.addCmd, docOpen = () => !!S.w;
      C("sel.mask", "Select and Mask…", "Alt+Ctrl+R", selectAndMask, { enabled: docOpen }, ["Select", "sel.range", true]);
      C("sel.sky", "Sky", "", selectSky, { enabled: docOpen }, ["Select", "sel.mask"]);
      C("sel.save", "Save Selection…", "", dlgSave, { enabled: () => E.hasSel() }, ["Select", "sel.loadmask", true]);
      C("sel.load", "Load Selection…", "", dlgLoad, { enabled: () => S.channels.length > 0 }, ["Select", "sel.save"]);
      C("win.pcChannels", "Channels", "", () => E.ui.showTab && E.ui.showTab("pcChannels"), {}, ["Window", "win.pcPaths"]);
      for (const [k, n, key] of [["rgb", "RGB", "Ctrl+2"], ["r", "Red", "Ctrl+3"], ["g", "Green", "Ctrl+4"], ["b", "Blue", "Ctrl+5"]])
        C("ch.view." + k, "Channel: " + n, key, () => targetCh(k, false), { enabled: docOpen });     // 2.467.0: targets it too (edits change only it)
      C("ch.spot", "New Spot Channel…", "", () => spotDialog(null), { enabled: docOpen }, ["Select", "sel.load"]);
      C("ch.mergespot", "Merge Spot Channel", "", () => mergeSpot(pickedCh || (S.channels.find((c) => c.spot) || {}).id), { enabled: () => S.channels.some((c) => c.spot) }, ["Select", "ch.spot"]);
    }
    E.refine = { selectAndMask, output, selectSky, saveSel, loadSel, channelSel, view: () => viewCh, mag: () => ML, closeML, paint: paintChannels,
      targetCh, target: tgtStr, editChannel, endEditChannel, editing: () => (cedit ? cedit.id : null), spotDialog, mergeSpot, pick: (id) => { pickedCh = id; paintChannels(); } };
  }
  const api = { install };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCRefine = api;
})(typeof window !== "undefined" ? window : globalThis);
