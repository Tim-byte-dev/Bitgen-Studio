/* pctablet.js — 🖊 PEN TABLET: pressure levels, the pressure curve, tilt, the pen's eraser and side button (2.570.0),
 * window.PCTablet.
 *
 * Tim (verbatim): "can we add pen tools like xp pen with levels of pressure for freehand drawing?"
 *
 *   The 🖊 Pen tab (next to 🖌 Brush; Window ▸ Pen Tablet):
 *     TEST PAD        draw on it with the pen: the line follows the pressure as the brushes get it; the raw pressure,
 *                     after the curve, the tilt, which end of the pen, and the LEVELS your pen reports (counted from
 *                     the finest step seen - an XP-Pen is 8192, many pens 4096 / 2048). No pressure (stuck at 0.5 / a
 *                     "mouse") = the driver's Windows Ink is off: XP-Pen's Pen Tablet settings ▸ tick "Windows Ink",
 *                     then restart the app.
 *     PRESSURE CURVE  like the driver's: Soft / Extra soft (a light touch gives more), Linear, Firm / Extra firm
 *                     (press harder), S-curve - or drag the points (click = add, double-click = remove); Lightest
 *                     touch (below it nothing / the thinnest line) and Full pressure at (above it everything is 100 %)
 *     EVERY BRUSH     ☐ Pressure -> size, ☐ Pressure -> opacity (flow) for brushes that do not use it themselves, the
 *                     smallest size at the lightest touch
 *     THE PEN         ☑ the eraser end erases (the brush comes back when you turn the pen round); side button =
 *                     Eyedropper (or the menu as before); ☑ tilt turns the tip (brushes with Angle control: Tilt;
 *                     Roundness control: Tilt flattens it as the pen leans); ☐ a mouse: pressure from speed
 *   Every brush-like tool takes the pressure from here (imageedit.js pressureOf -> E.tablet.pressure); the pen
 *   presets (brushes.js: G-pen, Mapping pen, Brush pen, Real pencil, Fineliner, Technical pen, Calligraphy) are made
 *   for it. Kept per browser (store "tablet").
 * Pure (Node: scripts/test-tablet570.js): CURVES, curveAt, mapPressure, levelsOf, tiltOf, isEraserEnd, isBarrel,
 * mouseSpeedPressure, presetFor.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const CURVES = {
    linear: [[0, 0], [1, 1]],
    soft: [[0, 0], [0.25, 0.45], [1, 1]],
    xsoft: [[0, 0], [0.12, 0.45], [1, 1]],
    firm: [[0, 0], [0.55, 0.3], [1, 1]],
    xfirm: [[0, 0], [0.75, 0.3], [1, 1]],
    scurve: [[0, 0], [0.3, 0.12], [0.7, 0.88], [1, 1]],
  };
  const CURVE_NAMES = [["xsoft", "Extra soft"], ["soft", "Soft"], ["linear", "Linear"], ["firm", "Firm"], ["xfirm", "Extra firm"], ["scurve", "S-curve"], ["custom", "Custom"]];
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  /** a curve's points cleaned: sorted by x, inside 0..1, both ends present, x strictly rising */
  function cleanCurve(pts) {
    const p = (Array.isArray(pts) ? pts : []).filter((q) => Array.isArray(q) && Number.isFinite(+q[0]) && Number.isFinite(+q[1])).map((q) => [clamp01(+q[0]), clamp01(+q[1])]);
    p.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const q of p) if (!out.length || q[0] - out[out.length - 1][0] > 0.005) out.push(q);
    if (!out.length || out[0][0] > 0) out.unshift([0, out.length ? Math.min(out[0][1], 0) : 0]);
    if (out[out.length - 1][0] < 1) out.push([1, 1]);
    return out.slice(0, 12);
  }
  /** the curve at x (0..1): a smooth monotone curve through its points (Fritsch-Carlson) */
  function curveAt(pts0, x) {
    const p = cleanCurve(pts0), n = p.length, t = clamp01(x);
    if (n === 2) return clamp01(p[0][1] + (p[1][1] - p[0][1]) * (t - p[0][0]) / (p[1][0] - p[0][0]));
    const d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    let i = 0; while (i < n - 2 && t > p[i + 1][0]) i++;
    const h = p[i + 1][0] - p[i][0], u = (t - p[i][0]) / h, u2 = u * u, u3 = u2 * u;
    const y = (2 * u3 - 3 * u2 + 1) * p[i][1] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * p[i + 1][1] + (u3 - u2) * h * m[i + 1];
    return clamp01(y);
  }
  /** a raw pen pressure -> what the brushes get: the lightest touch / full pressure window, then the curve */
  function mapPressure(raw, cfg) {
    const c = cfg || {}, lo = clamp01((c.lo || 0) / 100), hi = Math.max(lo + 0.01, clamp01((c.hi == null ? 100 : c.hi) / 100));
    const r = clamp01(+raw || 0);
    if (r <= 0) return 0;
    const t = clamp01((r - lo) / (hi - lo));
    return curveAt(c.curve || CURVES[c.preset] || CURVES.linear, t);
  }
  /** the pen's pressure levels from the values it sent: the finest step between two of them -> 256 … 16384 (a power of
   *  two, as tablets are sold); too few values to tell = 0 */
  function levelsOf(values) {
    const v = [...new Set((values || []).filter((x) => x > 0 && x < 1).map((x) => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b);
    if (v.length < 12) return 0;
    let step = 1;
    for (let i = 1; i < v.length; i++) { const s = v[i] - v[i - 1]; if (s > 1e-6 && s < step) step = s; }
    const n = 1 / step;
    const sizes = [256, 512, 1024, 2048, 4096, 8192, 16384];
    return sizes.reduce((best, s) => (Math.abs(Math.log2(s) - Math.log2(n)) < Math.abs(Math.log2(best) - Math.log2(n)) ? s : best), sizes[0]);
  }
  /** a pointer's tilt -> {angle (rad, the way the pen leans), amount 0..1 (upright = 0, 60° or more = 1)} */
  function tiltOf(e) {
    const tx = +((e && e.tiltX) || 0), ty = +((e && e.tiltY) || 0);
    if (e && Number.isFinite(e.azimuthAngle) && Number.isFinite(e.altitudeAngle) && (tx || ty || e.altitudeAngle < Math.PI / 2 - 0.01)) {
      return { angle: e.azimuthAngle, amount: clamp01((Math.PI / 2 - e.altitudeAngle) / (Math.PI / 3)) };
    }
    if (!tx && !ty) return { angle: 0, amount: 0 };
    return { angle: Math.atan2(ty, tx), amount: clamp01(Math.hypot(tx, ty) / 60) };
  }
  /** the pen turned round (its eraser end) - Windows Ink: buttons bit 32 / button 5 */
  const isEraserEnd = (e) => !!e && e.pointerType === "pen" && (((e.buttons | 0) & 32) === 32 || e.button === 5);
  /** the pen's side (barrel) button pressed */
  const isBarrel = (e) => !!e && e.pointerType === "pen" && (e.button === 2 || ((e.buttons | 0) & 2) === 2);
  /** a mouse: a slow stroke is heavy, a fast one light (px per ms) */
  const mouseSpeedPressure = (speed) => Math.max(0.15, Math.min(1, 1.1 - (+speed || 0) * 0.35));
  /** a preset with "every brush" pressure added (only what it does not do itself) */
  function presetFor(p, cfg) {
    const c = cfg || {}, ps = (p && p.pressure) || {};
    if (!p || (!c.size && !c.opacity) || (ps.size && ps.flow)) return p;
    const size = !!(ps.size || c.size), flow = !!(ps.flow || c.opacity);
    if (size === !!ps.size && flow === !!ps.flow) return p;
    const o = Object.assign({}, p, { pressure: Object.assign({}, ps, { size, flow }) });
    if (c.size && !ps.size) o.minSize = clamp01((c.minSize == null ? 10 : c.minSize) / 100);
    return o;
  }
  const DEFAULTS = () => ({ preset: "linear", curve: CURVES.linear.map((q) => q.slice()), lo: 0, hi: 100, size: false, opacity: false, minSize: 10, eraserEnd: true, barrel: "picker", tilt: true, mouseSim: false });
  const pure = { CURVES, CURVE_NAMES, DEFAULTS, cleanCurve, curveAt, mapPressure, levelsOf, tiltOf, isEraserEnd, isBarrel, mouseSpeedPressure, presetFor };

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, doc = E.doc || root.document, win = E.win || root, $ = E.$, kx = E.kx, store = E.store, say = E.say, stage = E.stage;
    let cfg = Object.assign(DEFAULTS(), store.get("tablet", {}) || {});
    cfg.curve = cleanCurve(cfg.curve);
    const keep = () => store.set("tablet", cfg);
    const seen = { pen: false, raw: null, mapped: null, tilt: { angle: 0, amount: 0 }, eraser: false, values: [], type: "", pressureStuck: 0 };
    let tiltNow = null, lastMouse = null, prevTool = null;
    const BRUSHY = new Set(["paint", "pencil", "mixer", "brush"]);

    /** what every brush-like tool asks (imageedit.js pressureOf) */
    function pressure(e) {
      if (!e) return 1;
      seen.type = e.pointerType || "";
      if (e.pointerType === "pen" || (e.pointerType === "touch" && e.pressure > 0 && e.pressure !== 0.5)) {
        seen.pen = e.pointerType === "pen" || seen.pen;
        const raw = +e.pressure || 0;
        seen.raw = raw;
        if (raw > 0 && raw < 1) { seen.values.push(raw); if (seen.values.length > 4000) seen.values.splice(0, 1000); }
        if (raw === 0.5) seen.pressureStuck++; else if (raw > 0) seen.pressureStuck = 0;
        const t = tiltOf(e); seen.tilt = t; tiltNow = cfg.tilt ? t : null;
        seen.eraser = isEraserEnd(e);
        const m = mapPressure(raw, cfg);
        seen.mapped = m;
        return Math.max(0.001, m);
      }
      tiltNow = null;
      if (cfg.mouseSim && e.pointerType === "mouse") {
        const now = e.timeStamp || win.performance.now();
        let p = 1;
        if (lastMouse && now > lastMouse.t) { const sp = Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y) / (now - lastMouse.t); p = mouseSpeedPressure(sp); }
        lastMouse = { x: e.clientX, y: e.clientY, t: now };
        return p;
      }
      return e.pointerType === "mouse" || !e.pressure ? 1 : e.pressure;
    }
    E.tablet = { pressure, preset: (p) => presetFor(p, cfg), cfg: () => cfg, seen: () => seen, set: (o) => { cfg = Object.assign(cfg, o || {}); cfg.curve = cleanCurve(cfg.curve); keep(); paint(); } };
    PCTablet.tilt = () => tiltNow;                           // brushdyn.js: Angle / Roundness control "Tilt"

    /* the pen's ends and buttons - before the editor's own pointerdown (capture) */
    stage.addEventListener("pointerdown", (e) => {
      if (!S.w || e.pointerType !== "pen") return;
      lastMouse = null;
      if (cfg.barrel === "picker" && isBarrel(e) && e.button === 2) {
        e.preventDefault(); e.stopImmediatePropagation();
        const [fx, fy] = E.pos(e); if (E.pickColor) E.pickColor(Math.floor(fx), Math.floor(fy), e.altKey);
        say("🖊 side button: colour picked"); return;
      }
      if (cfg.eraserEnd && isEraserEnd(e) && BRUSHY.has(S.tool)) { prevTool = S.tool; E.setTool("erase"); say("🖊 the eraser end - erasing (the brush comes back when you turn the pen round)"); }
    }, true);
    const back = () => { if (prevTool) { const t = prevTool; prevTool = null; win.setTimeout(() => { if (S.tool === "erase") E.setTool(t); }, 0); } };
    stage.addEventListener("pointerup", back);
    stage.addEventListener("pointercancel", back);
    stage.addEventListener("contextmenu", (e) => { if (cfg.barrel === "picker" && e.pointerType === "pen") e.preventDefault(); });
    stage.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") lastMouse = { x: e.clientX, y: e.clientY, t: e.timeStamp || win.performance.now() }; });

    /* ---- the 🖊 Pen tab */
    const brushTab = kx && kx.querySelector('.pcgrp .pctabs [data-tab="pcBrush"]'), anchor = brushTab || (kx && kx.querySelector('.pcgrp .pctabs [data-tab="pcAdjs"]'));
    if (anchor && !$("pcTablet")) {
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "pcTablet"; b.dataset.grp = anchor.dataset.grp || "props"; b.textContent = "🖊 Pen"; b.title = "Pen tablet: pressure levels, the pressure curve, tilt, the eraser end"; b.onclick = () => E.ui.showTab("pcTablet");
      anchor.after(b);
      const body = doc.createElement("div"); body.className = "pcbody"; body.dataset.body = "pcTablet"; body.id = "pcTablet"; anchor.parentElement.parentElement.appendChild(body);
      const prev = E.ui.showTab; E.ui.showTab = function (id) { const r = prev.apply(this, arguments); if (id === "pcTablet") paint(); return r; };
      const css = doc.createElement("style"); css.id = "pctCss";
      css.textContent = "#pcTablet{padding:6px 8px;font-size:11px}#pcTablet .r{display:flex;gap:5px;align-items:center;margin:3px 0;flex-wrap:wrap}#pcTablet .r>span:first-child{min-width:96px;color:var(--pc-dim,#999)}"
        + "#pcTablet canvas{display:block;border:1px solid var(--pc-line,#333);border-radius:4px;touch-action:none}#pcTablet #ptPad{width:100%;height:110px;background:#fff;cursor:crosshair}#pcTablet #ptCurve{width:170px;height:170px;background:var(--pc-input,#111);cursor:crosshair}"
        + "#pcTablet .st{font-family:var(--mono,monospace);line-height:1.5}#pcTablet .bar{height:6px;background:var(--pc-input,#222);border-radius:3px;overflow:hidden;flex:1;min-width:80px}#pcTablet .bar i{display:block;height:100%;background:var(--tiger,#f59e2c)}"
        + "#pcTablet .hint{color:var(--pc-dim,#999)}#pcTablet .warn{color:#f5b04c}#pcTablet h4{margin:8px 0 2px;font-size:11px;color:var(--tiger,#f59e2c);text-transform:uppercase;letter-spacing:.04em}";
      doc.head.appendChild(css);
    }
    if (E.ui.addCmd) { try { E.ui.addCmd("win.tablet", "Pen Tablet", "", () => E.ui.showTab("pcTablet"), null, ["Window"]); } catch (e) { /* older */ } }
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    function paint() {
      const box = $("pcTablet"); if (!box) return;
      box.innerHTML = `<div class="st" id="ptStat"></div><div class="r"><span>raw</span><div class="bar"><i id="ptRaw" style="width:0"></i></div></div><div class="r"><span>after the curve</span><div class="bar"><i id="ptMap" style="width:0"></i></div></div>
        <canvas id="ptPad" width="600" height="220" title="Draw here with the pen - the line follows the pressure as the brushes get it"></canvas>
        <div class="r"><button class="ghost" id="ptPadClr" type="button">Clear the pad</button><span class="hint" id="ptHint"></span></div>
        <h4>Pressure curve</h4>
        <div class="r"><select id="ptPreset">${CURVE_NAMES.map(([v, n]) => `<option value="${v}"${cfg.preset === v ? " selected" : ""}>${n}</option>`).join("")}</select><button class="ghost" id="ptReset" type="button" title="Linear, the whole range">↺</button></div>
        <canvas id="ptCurve" width="340" height="340" title="Drag a point - click = add one, double-click = remove it (the light touch is on the left, the result goes up)"></canvas>
        <div class="r"><span>Lightest touch</span><input type="range" id="ptLo" min="0" max="50" value="${cfg.lo}"><b id="ptLoV">${cfg.lo} %</b></div>
        <div class="r"><span>Full pressure at</span><input type="range" id="ptHi" min="50" max="100" value="${cfg.hi}"><b id="ptHiV">${cfg.hi} %</b></div>
        <h4>Every brush</h4>
        <div class="r"><label title="Brushes that do not use pressure for their size take it from the pen too"><input type="checkbox" id="ptSize"${cfg.size ? " checked" : ""}> Pressure → size</label>
          <label title="Brushes that do not use pressure for how much paint they lay take it from the pen too (flow)"><input type="checkbox" id="ptOpa"${cfg.opacity ? " checked" : ""}> Pressure → opacity</label></div>
        <div class="r"><span>Smallest size</span><input type="range" id="ptMin" min="0" max="100" value="${cfg.minSize}"><b id="ptMinV">${cfg.minSize} %</b></div>
        <h4>The pen</h4>
        <div class="r"><label><input type="checkbox" id="ptErase"${cfg.eraserEnd ? " checked" : ""}> The eraser end erases</label>
          <label title="Brushes whose Angle / Roundness control (🖌 Brush ▸ Shape Dynamics) is Tilt"><input type="checkbox" id="ptTilt"${cfg.tilt ? " checked" : ""}> Tilt turns the tip</label></div>
        <div class="r"><span>Side button</span><select id="ptBarrel"><option value="picker"${cfg.barrel === "picker" ? " selected" : ""}>Eyedropper</option><option value="menu"${cfg.barrel === "menu" ? " selected" : ""}>The menu (as a right click)</option></select></div>
        <div class="r"><label title="With a mouse: a slow stroke is heavy, a fast one light"><input type="checkbox" id="ptMouse"${cfg.mouseSim ? " checked" : ""}> A mouse: pressure from speed</label></div>
        <div class="hint">The pen brushes (G-pen, Mapping pen, Brush pen, Real pencil, Fineliner, Technical pen, Calligraphy) are in the brush presets ▾. No pressure in the pad? XP-Pen: Pen Tablet settings ▸ tick <b>Windows Ink</b>, then restart the app.</div>`;
      const q = (id) => box.querySelector("#" + id);
      const set = (k, v) => { cfg[k] = v; keep(); };
      q("ptPreset").onchange = () => { const v = q("ptPreset").value; set("preset", v); if (CURVES[v]) set("curve", CURVES[v].map((p) => p.slice())); drawCurve(); };
      q("ptReset").onclick = () => { cfg.preset = "linear"; cfg.curve = CURVES.linear.map((p) => p.slice()); cfg.lo = 0; cfg.hi = 100; keep(); paint(); };
      for (const [id, k, v] of [["ptLo", "lo", "ptLoV"], ["ptHi", "hi", "ptHiV"], ["ptMin", "minSize", "ptMinV"]]) q(id).oninput = () => { set(k, +q(id).value); q(v).textContent = q(id).value + " %"; drawCurve(); };
      q("ptSize").onchange = () => set("size", q("ptSize").checked);
      q("ptOpa").onchange = () => set("opacity", q("ptOpa").checked);
      q("ptErase").onchange = () => set("eraserEnd", q("ptErase").checked);
      q("ptTilt").onchange = () => set("tilt", q("ptTilt").checked);
      q("ptBarrel").onchange = () => set("barrel", q("ptBarrel").value);
      q("ptMouse").onchange = () => set("mouseSim", q("ptMouse").checked);
      q("ptPadClr").onclick = () => { const c = q("ptPad"), g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height); };
      wirePad(q("ptPad")); wireCurve(q("ptCurve")); drawCurve(); status();
    }
    function status() {
      const st = $("ptStat"); if (!st) return;
      const lv = levelsOf(seen.values), t = seen.tilt || { angle: 0, amount: 0 };
      st.innerHTML = seen.pen
        ? `🖊 pen${seen.eraser ? " (eraser end)" : ""} · pressure ${seen.raw == null ? "-" : seen.raw.toFixed(4)} → ${seen.mapped == null ? "-" : seen.mapped.toFixed(3)} · tilt ${Math.round(t.amount * 60)}° · ${lv ? `<b>~${lv} levels</b> (the finest step seen so far)` : "levels: keep drawing…"}`
        : `no pen seen yet${seen.type ? ` (${esc(seen.type)})` : ""} - draw on the pad below with your pen`;
      const h = $("ptHint"); if (h) { h.className = seen.pressureStuck > 20 ? "warn" : "hint"; h.textContent = seen.pressureStuck > 20 ? "the pressure stays at 0.5 - turn on Windows Ink in the pen driver, then restart the app" : ""; }
      const r = $("ptRaw"), m = $("ptMap");
      if (r) r.style.width = Math.round((seen.raw || 0) * 100) + "%";
      if (m) m.style.width = Math.round((seen.mapped || 0) * 100) + "%";
    }
    function wirePad(c) {
      const g = c.getContext("2d"); let last = null;
      const at = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
      c.onpointerdown = (e) => { c.setPointerCapture(e.pointerId); last = at(e); pressure(e); status(); e.preventDefault(); };
      c.onpointermove = (e) => {
        if (!last) { if (e.pointerType === "pen") { pressure(e); status(); } return; }
        const evs = typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e];
        for (const ce of evs) {
          const p = pressure(ce), pt = at(ce), w = 1 + 13 * (ce.pointerType === "mouse" && !cfg.mouseSim ? 0.5 : p);
          g.strokeStyle = isEraserEnd(ce) ? "#d33" : "#222"; g.lineCap = "round"; g.lineWidth = w;
          g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(pt[0], pt[1]); g.stroke(); last = pt;
        }
        status();
      };
      c.onpointerup = c.onpointercancel = () => { last = null; };
    }
    let dragPt = -1;
    function wireCurve(c) {
      const at = (e) => { const r = c.getBoundingClientRect(); return [clamp01((e.clientX - r.left) / r.width), clamp01(1 - (e.clientY - r.top) / r.height)]; };
      const near = (p) => cfg.curve.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05);
      c.onpointerdown = (e) => {
        const p = at(e); let i = near(p);
        if (i < 0) { cfg.curve.push(p); cfg.curve = cleanCurve(cfg.curve); i = near(p); }
        dragPt = i; c.setPointerCapture(e.pointerId); cfg.preset = "custom"; const s = $("ptPreset"); if (s) s.value = "custom"; drawCurve();
      };
      c.onpointermove = (e) => {
        if (dragPt < 0) return;
        const p = at(e), n = cfg.curve.length;
        if (dragPt === 0) cfg.curve[0] = [0, p[1]];
        else if (dragPt === n - 1) cfg.curve[n - 1] = [1, p[1]];
        else { const lo = cfg.curve[dragPt - 1][0] + 0.01, hi = cfg.curve[dragPt + 1][0] - 0.01; cfg.curve[dragPt] = [Math.max(lo, Math.min(hi, p[0])), p[1]]; }
        drawCurve();
      };
      c.onpointerup = () => { if (dragPt >= 0) { dragPt = -1; cfg.curve = cleanCurve(cfg.curve); keep(); drawCurve(); } };
      c.ondblclick = (e) => { const i = near(at(e)); if (i > 0 && i < cfg.curve.length - 1) { cfg.curve.splice(i, 1); keep(); drawCurve(); } };
    }
    function drawCurve() {
      const c = $("ptCurve"); if (!c) return;
      const g = c.getContext("2d"), W = c.width, H = c.height;
      g.clearRect(0, 0, W, H);
      g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 1;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(W * k / 4, 0); g.lineTo(W * k / 4, H); g.moveTo(0, H * k / 4); g.lineTo(W, H * k / 4); g.stroke(); }
      g.strokeStyle = "rgba(255,255,255,.25)"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, H); g.lineTo(W, 0); g.stroke(); g.setLineDash([]);
      g.strokeStyle = "#f59e2c"; g.lineWidth = 3; g.beginPath();
      for (let k = 0; k <= 100; k++) { const x = k / 100, y = mapPressure(x, cfg); if (k) g.lineTo(x * W, H - y * H); else g.moveTo(x * W, H - y * H); }
      g.stroke();
      g.fillStyle = "#fff";
      for (const [x, y] of cfg.curve) { g.beginPath(); g.arc(x * W, H - y * H, 7, 0, Math.PI * 2); g.fill(); }
      if (seen.raw != null) { g.fillStyle = "#4cc3ff"; g.beginPath(); g.arc(seen.raw * W, H - (seen.mapped || 0) * H, 6, 0, Math.PI * 2); g.fill(); }
    }
    win.setInterval(() => { const b = $("pcTablet"); if (b && b.offsetParent !== null) { status(); } }, 300);
  }
  const PCTablet = Object.assign({ install, tilt: () => null }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCTablet;
  else root.PCTablet = PCTablet;
})(typeof window !== "undefined" ? window : globalThis);
