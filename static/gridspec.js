/* bitGen Studio — static/gridspec.js (2.445.0): THE GRID / GUIDES SETTINGS both canvases share (the image editor and
 * the timeline's preview canvas), window.H3Grid (+ require() in Node).
 *
 * Tim (verbatim): "Add a grid toggle button to the top toolbar in video docker and image editor docker ... in the image
 * editor settings dialog and video docker settings dialog add a tab for grids/guides, grid spacing, major grid spacing,
 * lines or dots, grid color, guideline color, guideline snap distance."
 *   spec      {on, spacing (picture px; 0 = it follows the zoom), major (every n-th line is a major one; 0 = none),
 *              style "lines" | "dots", color, opacity, guideColor, snap (guideline snap distance, screen px)}
 *   clean(s)  every value checked (anything else = the default)
 *   stepFor(spec, zoom)   the spacing drawn: the set one (doubled until >= 4 screen px), or the one that suits the zoom
 *   draw(g, spec, rect, zoom, {lineWidth, viewZoom})   onto a 2D context: rect = {x, y, w, h} of the picture in the context's
 *              units, zoom = context units per picture px (viewZoom = screen px per picture px when they differ - the spacing that suits
 *              the zoom is picked from it); lines (minor thin + faint, major stronger) or dots (a dot at
 *              each crossing, bigger on the major ones) -> {step, cols, rows}
 *   tabHtml(spec, p) / readTab(rootEl, p, base)   the settings tab both dialogs use (ids <p>Sp, <p>Mj, <p>St, <p>Gc,
 *              <p>Go, <p>Gd, <p>Sn)
 */
(function (root) {
  "use strict";
  const DEFAULTS = Object.freeze({ on: false, spacing: 0, major: 5, style: "lines", color: "#2680eb", opacity: 0.35, guideColor: "#00b7ff", snap: 8 });
  const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  function clean(s) {
    const o = s && typeof s === "object" ? s : {};
    return { on: !!o.on, spacing: Math.round(num(o.spacing, 0, 4096, DEFAULTS.spacing)), major: Math.round(num(o.major, 0, 50, DEFAULTS.major)),
      style: o.style === "dots" ? "dots" : "lines", color: isHex(o.color) ? o.color.toLowerCase() : DEFAULTS.color,
      opacity: Math.round(num(o.opacity, 0.05, 1, DEFAULTS.opacity) * 100) / 100, guideColor: isHex(o.guideColor) ? o.guideColor.toLowerCase() : DEFAULTS.guideColor,
      snap: Math.round(num(o.snap, 1, 50, DEFAULTS.snap)) };
  }
  function stepFor(spec, zoom) {
    const z = zoom > 0 ? zoom : 1, sp = spec && spec.spacing > 0 ? spec.spacing : 0;
    if (sp) { let s = sp; while (s * z < 4 && s < 1e6) s *= 2; return s; }
    return [8, 16, 32, 64, 128, 256, 512].find((s) => s * z >= 24) || 1024;
  }
  const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16) || 0; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  function draw(g, spec, rect, zoom, opts) {
    const s = clean(spec), z = zoom > 0 ? zoom : 1, o = opts || {};
    const step = stepFor(s, o.viewZoom || z), unit = step * z, lw = o.lineWidth || 1;    // unit: one step in the context's units
    const cols = [], rows = [];
    for (let k = 1; k * unit < rect.w - 1e-6 && k < 5000; k++) cols.push(k);
    for (let k = 1; k * unit < rect.h - 1e-6 && k < 5000; k++) rows.push(k);
    const major = (k) => s.major > 0 && k % s.major === 0;
    g.save();
    if (s.style === "dots") {
      for (const i of cols) for (const j of rows) {
        const big = major(i) && major(j), r = (big ? 1.6 : 0.9) * lw;
        g.fillStyle = rgba(s.color, Math.min(1, s.opacity * (big ? 2 : 1.4)));
        g.fillRect(rect.x + i * unit - r, rect.y + j * unit - r, 2 * r, 2 * r);
      }
    } else {
      for (const pass of [false, true]) {
        g.strokeStyle = rgba(s.color, Math.min(1, s.opacity * (pass ? 1.9 : 1))); g.lineWidth = lw * (pass ? 1.4 : 1); g.beginPath();
        for (const i of cols) if (major(i) === pass) { const x = rect.x + i * unit; g.moveTo(x, rect.y); g.lineTo(x, rect.y + rect.h); }
        for (const j of rows) if (major(j) === pass) { const y = rect.y + j * unit; g.moveTo(rect.x, y); g.lineTo(rect.x + rect.w, y); }
        g.stroke();
      }
    }
    g.restore();
    return { step, cols: cols.length, rows: rows.length };
  }
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function tabHtml(spec, p) {
    const s = clean(spec), row = (lab, inner, t) => `<label class="h3gr-row" title="${esc(t || "")}"><span>${lab}</span>${inner}</label>`;
    return `<div class="h3grid-tab" style="display:flex;flex-direction:column;gap:6px">`
      + row("Grid spacing (px)", `<input type="number" id="${p}Sp" min="0" max="4096" value="${s.spacing}" style="width:80px">`, "the distance between the grid's lines, in picture pixels - 0 = it follows the zoom")
      + row("Major grid every", `<input type="number" id="${p}Mj" min="0" max="50" value="${s.major}" style="width:80px"> lines`, "every n-th line is drawn stronger (0 = no major lines)")
      + row("Draw the grid as", `<select id="${p}St"><option value="lines"${s.style === "lines" ? " selected" : ""}>lines</option><option value="dots"${s.style === "dots" ? " selected" : ""}>dots</option></select>`)
      + row("Grid colour", `<input type="color" id="${p}Gc" value="${s.color}"> <input type="range" id="${p}Go" min="5" max="100" value="${Math.round(s.opacity * 100)}" title="how strong" style="width:110px">`)
      + row("Guideline colour", `<input type="color" id="${p}Gd" value="${s.guideColor}">`)
      + row("Guideline snap distance (screen px)", `<input type="number" id="${p}Sn" min="1" max="50" value="${s.snap}" style="width:80px">`, "how close a moved point must come to a guideline (or the grid) to snap to it")
      + `</div>`;
  }
  function readTab(el, p, base) {
    const q = (k) => el.querySelector("#" + p + k);
    return clean(Object.assign({}, base || {}, { spacing: q("Sp").value, major: q("Mj").value, style: q("St").value, color: q("Gc").value, opacity: (+q("Go").value || 35) / 100, guideColor: q("Gd").value, snap: q("Sn").value }));
  }
  const H3Grid = { DEFAULTS, clean, stepFor, draw, tabHtml, readTab };
  if (typeof module !== "undefined" && module.exports) module.exports = H3Grid;
  else root.H3Grid = H3Grid;
})(typeof window !== "undefined" ? window : globalThis);
