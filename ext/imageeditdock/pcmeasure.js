/* pcmeasure.js — PANELS AND MEASURING TOOLS (2.483.0): the image editor's gap, round D. window.PCMeasure.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   Panels (the Color group, Window menu)
 *     🧭 Navigator   the picture small with the view as a red box: click / drag moves the view, a zoom slider
 *     📊 Histogram   RGB / Luminosity / Red / Green / Blue / Colors of the picture or the active layer (or the
 *                    selection): mean, standard deviation, median, pixels; the level / count / percentile under the
 *                    pointer
 *     ℹ Info         under the pointer: RGB, HSB, CMYK, the position; the selection's size; the colour samplers
 *     📝 Notes       every note: its text, go to it, delete
 *   Tools (with the Eyedropper, I): Color Sampler (up to 10 - Alt-click removes one), Ruler (distance, angle,
 *     ↻ Straighten Layer / Straighten Picture), Note (click = a note; double-click it to edit), Count (numbered
 *     markers in coloured groups, Alt-click removes the nearest)
 *   Tools (with the Crop tool, C): Perspective Crop - four corners, Enter crops the whole picture square to them
 *   Select ▸ Grow, Similar (the wand's tolerance), Focus Area… (the sharp parts), Transform Selection… (move, scale,
 *     rotate the selection itself)
 *   Layer ▸ Matting ▸ Defringe…, Remove Black Matte, Remove White Matte
 * Samplers, notes and count markers belong to the document (smp(), nts(), cnt()) and go along into .bgi.
 * Pure (Node: scripts/test-measure.js): histogram, toHsb, toCmyk, angleOf, rectOfQuad, grow, similar, focusMap,
 *   defringe, unmatte, sampleAvg, transformMask.
 */
(function (root) {
  "use strict";
  const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

  /* ---------------- pure ---------------- */
  /** a histogram of the picture's channel (rgb = the average of the three, colors = all three bins together) over
   *  the pixels a mask lets through (mask null = all; alpha 0 never counts) */
  function histogram(data, channel, mask) {
    const bins = new Float64Array(256); let n = 0, sum = 0, sq = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      if (data[i + 3] === 0 || (mask && !mask[p])) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const vals = channel === "red" ? [r] : channel === "green" ? [g] : channel === "blue" ? [b] : channel === "luminosity" ? [Math.round(luma(r, g, b))] : channel === "colors" ? [r, g, b] : [Math.round((r + g + b) / 3)];
      for (const v of vals) { bins[v]++; n++; sum += v; sq += v * v; }
    }
    const mean = n ? sum / n : 0, std = n ? Math.sqrt(Math.max(0, sq / n - mean * mean)) : 0;
    let acc = 0, median = 0; for (let v = 0; v < 256; v++) { acc += bins[v]; if (acc >= n / 2) { median = v; break; } }
    return { bins, n, mean, std, median, max: Math.max(...bins) };
  }
  function toHsb(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
    if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [Math.round(h * 60) % 360, Math.round(mx ? d / mx * 100 : 0), Math.round(mx / 255 * 100)];
  }
  function toCmyk(r, g, b) {
    const k = 1 - Math.max(r, g, b) / 255; if (k >= 1) return [0, 0, 0, 100];
    return [(1 - r / 255 - k) / (1 - k), (1 - g / 255 - k) / (1 - k), (1 - b / 255 - k) / (1 - k), k].map((v) => Math.round(v * 100));
  }
  /** the ruler's angle (°, counter-clockwise from the right, -180..180) and length */
  function angleOf(x0, y0, x1, y1) { return { angle: Math.atan2(y0 - y1, x1 - x0) * 180 / Math.PI, length: Math.hypot(x1 - x0, y1 - y0) }; }
  /** the rotation that makes a ruler line level (or plumb, when it is nearer vertical) */
  function straightenBy(angle) { let a = angle; while (a > 45) a -= 90; while (a < -45) a += 90; return a; }
  /** a perspective crop's size: the quad's average side lengths */
  function rectOfQuad(q) {
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    return { w: Math.max(1, Math.round((d(q[0], q[1]) + d(q[3], q[2])) / 2)), h: Math.max(1, Math.round((d(q[0], q[3]) + d(q[1], q[2])) / 2)) };
  }
  const close = (d, i, j, tol) => Math.abs(d[i] - d[j]) <= tol && Math.abs(d[i + 1] - d[j + 1]) <= tol && Math.abs(d[i + 2] - d[j + 2]) <= tol;
  /** Select ▸ Grow: the selection spreads to touching pixels within the tolerance of the pixel it grows from */
  function grow(sel, data, w, h, tol) {
    const out = Uint8Array.from(sel), q = [];
    for (let p = 0; p < w * h; p++) if (sel[p] > 127) q.push(p);
    while (q.length) {
      const p = q.pop(), x = p % w, y = (p - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const np = Y * w + X; if (out[np] > 127) continue;
        if (close(data, p * 4, np * 4, tol)) { out[np] = 255; q.push(np); }
      }
    }
    return out;
  }
  /** Select ▸ Similar: every pixel anywhere within the tolerance of a colour in the selection */
  function similar(sel, data, w, h, tol) {
    const step = Math.max(1, Math.round(tol / 2) || 1), seen = new Set(), cols = [];
    for (let p = 0; p < w * h; p++) {
      if (sel[p] <= 127) continue;
      const i = p * 4, key = ((data[i] / step) | 0) + "," + ((data[i + 1] / step) | 0) + "," + ((data[i + 2] / step) | 0);
      if (!seen.has(key)) { seen.add(key); cols.push([data[i], data[i + 1], data[i + 2]]); }
    }
    const out = Uint8Array.from(sel);
    if (!cols.length) return out;
    for (let p = 0; p < w * h; p++) {
      if (out[p] > 127) continue;
      const i = p * 4;
      for (const c of cols) if (Math.abs(data[i] - c[0]) <= tol && Math.abs(data[i + 1] - c[1]) <= tol && Math.abs(data[i + 2] - c[2]) <= tol) { out[p] = 255; break; }
    }
    return out;
  }
  /** how sharp each pixel's neighbourhood is (0..1): the local energy of the Laplacian, normalised */
  function focusMap(data, w, h, radius) {
    const L = new Float32Array(w * h), E = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) L[p] = luma(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const at = (xx, yy) => L[Math.max(0, Math.min(h - 1, yy)) * w + Math.max(0, Math.min(w - 1, xx))];
      const lap = 4 * at(x, y) - at(x + 1, y) - at(x - 1, y) - at(x, y + 1) - at(x, y - 1);
      E[y * w + x] = lap * lap;
    }
    const r = Math.max(1, radius | 0), out = new Float32Array(w * h), tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += E[y * w + Math.max(0, Math.min(w - 1, x))]; for (let x = 0; x < w; x++) { tmp[y * w + x] = acc; acc += E[y * w + Math.min(w - 1, x + r + 1)] - E[y * w + Math.max(0, x - r)]; } }
    let mx = 0;
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.max(0, Math.min(h - 1, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = Math.sqrt(acc); if (out[y * w + x] > mx) mx = out[y * w + x]; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
    if (mx > 0) for (let p = 0; p < w * h; p++) out[p] /= mx;
    return out;
  }
  /** Defringe: the colour of half-transparent edge pixels (and those within `width` of a clear one) from the nearest solid pixel */
  function defringe(data, w, h, width) {
    const out = Uint8ClampedArray.from(data), r = Math.max(1, width | 0);
    const nearClear = (x, y) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && data[(Y * w + X) * 4 + 3] < 8) return true; } return false; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = data[i + 3]; if (a < 8) continue;
      if (a > 247 && !nearClear(x, y)) continue;
      let best = null, bd = Infinity;
      for (let R = 1; R <= r * 3 && !best; R++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== R) continue;
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const j = (Y * w + X) * 4; if (data[j + 3] < 248 || nearClear(X, Y)) continue;
        const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = j; }
      }
      if (best != null) { out[i] = data[best]; out[i + 1] = data[best + 1]; out[i + 2] = data[best + 2]; }
    }
    return out;
  }
  /** Remove Black / White Matte: take out the colour a half-transparent pixel was mixed with */
  function unmatte(data, white) {
    const out = Uint8ClampedArray.from(data);
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255; if (a <= 0 || a >= 1) continue;
      for (let c = 0; c < 3; c++) out[i + c] = white ? (data[i + c] - 255 * (1 - a)) / a : data[i + c] / a;
    }
    return out;
  }
  /** the average colour around (x, y): size 1 = the point, 3 = 3 x 3, 5 = 5 x 5 */
  function sampleAvg(data, w, h, x, y, size) {
    const r = ((size || 1) - 1) >> 1; let R = 0, G = 0, B = 0, A = 0, n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = Math.max(0, Math.min(w - 1, Math.round(x) + dx)), Y = Math.max(0, Math.min(h - 1, Math.round(y) + dy)), i = (Y * w + X) * 4; R += data[i]; G += data[i + 1]; B += data[i + 2]; A += data[i + 3]; n++; }
    return [R / n, G / n, B / n, A / n].map(Math.round);
  }
  /** a selection mask moved / scaled / turned about its centre (Transform Selection) - nearest neighbour */
  function transformMask(sel, w, h, t) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let p = 0; p < w * h; p++) if (sel[p]) { const x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const out = new Uint8Array(w * h); if (x1 < 0) return out;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sx = (t.sx || 100) / 100, sy = (t.sy || 100) / 100, a = -(t.rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), dx = t.dx || 0, dy = t.dy || 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x - cx - dx, v = y - cy - dy, ru = (u * ca - v * sa) / sx, rv = (u * sa + v * ca) / sy, X = Math.round(cx + ru), Y = Math.round(cy + rv);
      if (X >= 0 && Y >= 0 && X < w && Y < h) out[y * w + x] = sel[Y * w + X];
    }
    return out;
  }
  const pure = { histogram, toHsb, toCmyk, angleOf, straightenBy, rectOfQuad, grow, similar, focusMap, defringe, unmatte, sampleAvg, transformMask };

  /* ---------------- tools in the tool column (added before the editor starts) ---------------- */
  const UI = root.PCUI;
  if (UI && UI.GROUPS && !UI.__measure) {
    UI.__measure = true;
    const gi = UI.GROUPS.find((g) => g && g.k === "i"), gc = UI.GROUPS.find((g) => g && g.k === "c");
    if (gi) gi.tools.push(["sampler", "Color Sampler Tool"], ["ruler", "Ruler Tool"], ["note", "Note Tool"], ["count", "Count Tool"]);
    if (gc) gc.tools.push(["pcrop", "Perspective Crop Tool"]);
    if (UI.ICON) Object.assign(UI.ICON, {
      sampler: '<path d="M15 4l5 5-2 2-5-5zM13 8l-8 8v3h3l8-8"/><circle cx="19" cy="19" r="2.5"/>',
      ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
      note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 11h8M8 15h6"/>',
      count: '<path d="M4 6h3v12M11 9a3 3 0 1 1 6 0c0 3-6 5-6 9h6"/>',
      pcrop: '<path d="M7 3l2 14 12 2M3 7l14-2 2 14"/>',
    });
  }

  /* ---------------- the page ---------------- */
  function install(E) {
    const { S, store } = E, doc = E.doc || root.document, win = doc.defaultView || root, kx = E.kx, stage = E.stage;
    const $ = (id) => doc.getElementById(id), say = (t) => (E.say ? E.say(t) : null);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    // the document's own (pcdocs.js swaps them with the document; pcbgi.js keeps them in the .bgi)
    const smp = () => S.samplers || (S.samplers = []), nts = () => S.notes || (S.notes = []);
    const cnt = () => S.counts || (S.counts = { groups: [{ name: "Count Group 1", color: "#ff3030", size: 4, marks: [] }], cur: 0 });
    let cursorPt = null, ruler = S.ruler || null, pq = null;        // ruler {x0,y0,x1,y1}; perspective crop quad
    const flat = () => { const c = E.flattenCache ? E.flattenCache() : E.flatten(); return c.getContext("2d").getImageData(0, 0, S.w, S.h).data; };
    let flatKey = "", flatData = null;
    const flatNow = () => { const k = S.w + "x" + S.h + ":" + S.undo.length + ":" + S.layers.map((L) => (L.ver || 0) + (L.visible === false ? "h" : "")).join(","); if (k !== flatKey || !flatData) { flatKey = k; flatData = flat(); } return flatData; };
    /* ---- the panels ---- */
    const grp = kx && kx.querySelector('.pcgrp[data-g="color"]');
    const tabsBar = grp && grp.querySelector(".pctabs");
    const addTab = (id, label) => {
      if (!tabsBar || $(id)) return;
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = id; b.dataset.grp = "color"; b.textContent = label; b.onclick = () => E.ui.showTab(id);
      tabsBar.appendChild(b);
      const body = doc.createElement("div"); body.className = "pcbody"; body.dataset.body = id; body.id = id; grp.appendChild(body);
    };
    addTab("pcNav", "Navigator"); addTab("pcHist", "Histogram"); addTab("pcInfo", "Info"); addTab("pcNotes", "Notes");
    const css = doc.createElement("style");
    css.textContent = "#pcNav,#pcHist,#pcInfo,#pcNotes{padding:6px 8px;font-size:11px}#pcNav canvas{width:100%;display:block;background:#222;cursor:crosshair}#pcHist canvas{width:100%;height:110px;display:block;background:var(--pc-input,#111)}"
      + "#pcInfo table{width:100%;border-collapse:collapse}#pcInfo td{padding:1px 4px;font-family:var(--mono,monospace)}#pcInfo td:first-child{color:var(--pc-dim)}.pcm-r{display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap}.pcm-note{border-bottom:1px solid var(--pc-line,#333);padding:3px 0;display:flex;gap:6px}.pcm-note span{flex:1}";
    doc.head.appendChild(css);
    const isOn = (id) => { const b = $(id); return !!(b && b.classList.contains("on") && b.offsetParent !== null); };
    // Navigator
    let navImg = null, navKey = "";
    function paintNav() {
      const box = $("pcNav"); if (!box || !isOn("pcNav")) return;
      if (!box.querySelector("canvas")) {
        box.innerHTML = '<canvas id="pcNavC" width="240" height="160"></canvas><div class="pcm-r"><span>🔍</span><input type="range" id="pcNavZ" min="1" max="3200" step="1" style="flex:1"><b id="pcNavZv"></b></div>';
        const c = $("pcNavC"); let dragging = false;
        const go = (e) => { if (!S.w) return; const r = c.getBoundingClientRect(), k = navScale(), fx = (e.clientX - r.left) * c.width / r.width / k.s - k.ox / k.s, fy = (e.clientY - r.top) * c.height / r.height / k.s - k.oy / k.s; centreOn(fx, fy); };
        c.onpointerdown = (e) => { dragging = true; c.setPointerCapture(e.pointerId); go(e); }; c.onpointermove = (e) => { if (dragging) go(e); }; c.onpointerup = () => { dragging = false; };
        $("pcNavZ").oninput = () => { const z = (+$("pcNavZ").value) / 100; if (E.zoomAt && S.zoom) E.zoomAt(z / S.zoom); };
      }
      const c = $("pcNavC"), g = c.getContext("2d"); if (!S.w) { g.clearRect(0, 0, c.width, c.height); return; }
      const k = navScale(), key = flatKey + ":" + S.w;
      if (key !== navKey || !navImg) { navKey = key; flatNow(); navImg = E.flattenCache ? E.flattenCache() : E.flatten(); }
      g.clearRect(0, 0, c.width, c.height); g.drawImage(navImg, k.ox, k.oy, S.w * k.s, S.h * k.s);
      const v = viewRect(); g.strokeStyle = "#ff2b2b"; g.lineWidth = 2; g.strokeRect(k.ox + v.x * k.s, k.oy + v.y * k.s, v.w * k.s, v.h * k.s);
      $("pcNavZ").value = Math.round(S.zoom * 100); $("pcNavZv").textContent = Math.round(S.zoom * 100) + "%";
    }
    const navScale = () => { const c = $("pcNavC"), s = Math.min(c.width / S.w, c.height / S.h); return { s, ox: (c.width - S.w * s) / 2, oy: (c.height - S.h * s) / 2 }; };
    function viewRect() {
      const r = stage.getBoundingClientRect();
      return { x: -S.panX / S.zoom, y: -S.panY / S.zoom, w: r.width / S.zoom, h: r.height / S.zoom };
    }
    function centreOn(fx, fy) {
      const r = stage.getBoundingClientRect();
      S.panX = r.width / 2 - fx * S.zoom; S.panY = r.height / 2 - fy * S.zoom; S.userView = true;
      if (E.applyView) E.applyView(); paintNav();
    }
    // Histogram
    let histCh = store.get("hist.ch", "rgb"), histSrc = store.get("hist.src", "picture"), histKey = "", histData = null;
    const HCOL = { rgb: "#cfcfcf", luminosity: "#e8e8e8", red: "#ff5050", green: "#4fd04f", blue: "#5a8cff" };
    function paintHist() {
      const box = $("pcHist"); if (!box || !isOn("pcHist")) return;
      if (!box.querySelector("canvas")) {
        box.innerHTML = `<div class="pcm-r"><select id="pcHCh">${["rgb", "luminosity", "red", "green", "blue", "colors"].map((c) => `<option value="${c}">${c === "rgb" ? "RGB" : c[0].toUpperCase() + c.slice(1)}</option>`).join("")}</select>
          <select id="pcHSrc"><option value="picture">Entire picture</option><option value="layer">Selected layer</option></select></div><canvas id="pcHC" width="256" height="110"></canvas>
          <table id="pcHStats" style="width:100%"></table>`;
        $("pcHCh").value = histCh; $("pcHSrc").value = histSrc;
        $("pcHCh").onchange = () => { histCh = $("pcHCh").value; store.set("hist.ch", histCh); histKey = ""; paintHist(); };
        $("pcHSrc").onchange = () => { histSrc = $("pcHSrc").value; store.set("hist.src", histSrc); histKey = ""; paintHist(); };
        const c = $("pcHC");
        c.onpointermove = (e) => { if (!histData) return; const r = c.getBoundingClientRect(), lv = Math.max(0, Math.min(255, Math.floor((e.clientX - r.left) * 256 / r.width))); let acc = 0; for (let v = 0; v <= lv; v++) acc += histData.bins[v]; stats({ level: lv, count: histData.bins[lv], pct: histData.n ? acc / histData.n * 100 : 0 }); };
        c.onpointerleave = () => stats();
      }
      if (!S.w) return;
      const L = S.layers[S.active], sel = E.hasSel && E.hasSel() && S.sel ? S.sel : null;
      const key = (histSrc === "layer" ? "L" + (L && L.id) + ":" + (L && L.ver) : flatKey || "x") + ":" + histCh + ":" + (sel ? S.selVer : "-") + ":" + S.undo.length;
      if (key !== histKey) {
        histKey = key;
        const data = histSrc === "layer" && L && L.canvas ? L.canvas.getContext("2d").getImageData(0, 0, S.w, S.h).data : flatNow();
        histData = histCh === "colors" ? { per: ["red", "green", "blue"].map((c) => histogram(data, c, sel)), ...histogram(data, "colors", sel) } : histogram(data, histCh, sel);
      }
      const c = $("pcHC"), g = c.getContext("2d"); g.clearRect(0, 0, 256, 110);
      const draw = (h, col, mode) => { const mx = Math.max(1, h.max); g.fillStyle = col; g.globalCompositeOperation = mode || "source-over"; for (let v = 0; v < 256; v++) { const y = h.bins[v] / mx * 106; g.fillRect(v, 110 - y, 1, y); } };
      if (histCh === "colors") { histData.per.forEach((h, k) => draw(h, ["#ff3030", "#30d030", "#3060ff"][k], "lighter")); g.globalCompositeOperation = "source-over"; }
      else draw(histData, HCOL[histCh]);
      stats();
    }
    function stats(hv) {
      const t = $("pcHStats"); if (!t || !histData) return;
      const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
      t.innerHTML = row("Mean", histData.mean.toFixed(2)) + row("Std dev", histData.std.toFixed(2)) + row("Median", histData.median) + row("Pixels", histData.n.toLocaleString())
        + (hv ? row("Level", hv.level) + row("Count", hv.count) + row("Percentile", hv.pct.toFixed(2)) : "");
    }
    // Info
    let sampleSize = store.get("sampler.size", 1);
    function paintInfo() {
      const box = $("pcInfo"); if (!box || !isOn("pcInfo")) return;
      const rows = []; const row = (a, b) => rows.push(`<tr><td>${a}</td><td>${b}</td></tr>`);
      if (S.w && cursorPt && cursorPt[0] >= 0 && cursorPt[1] >= 0 && cursorPt[0] < S.w && cursorPt[1] < S.h) {
        const [r, g, b, a] = sampleAvg(flatNow(), S.w, S.h, cursorPt[0], cursorPt[1], sampleSize);
        const [h, s, v] = toHsb(r, g, b), [c, m, y, k] = E.cmykOf ? E.cmykOf(r, g, b).map((x) => Math.round(x * 100)) : toCmyk(r, g, b), out = E.inGamut && !E.inGamut(r, g, b) ? " !" : "";   // 2.487.0: the press model's CMYK, "!" = cannot be printed (pcmode.js)
        row("R G B", `${r} ${g} ${b}` + (a < 255 ? ` (α ${a})` : "")); row("H S B", `${h}° ${s}% ${v}%`); row("C M Y K", `${c}% ${m}% ${y}% ${k}%${out}`); row("X, Y", `${Math.floor(cursorPt[0])}, ${Math.floor(cursorPt[1])} px`);
      } else row("", "move over the picture");
      if (S.w) row("Document", `${S.w} × ${S.h} px` + (E.modes && S.imgMode && S.imgMode !== "rgb" ? " · " + ((root.PCMode && root.PCMode.MODES[S.imgMode]) || S.imgMode) : ""));
      if (E.hasSel && E.hasSel() && S.sel) { let x0 = S.w, y0 = S.h, x1 = -1, y1 = -1; for (let p = 0; p < S.w * S.h; p += 1) if (S.sel[p] > 127) { const x = p % S.w, y = (p - x) / S.w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (x1 >= 0) row("Selection", `${x1 - x0 + 1} × ${y1 - y0 + 1} px at ${x0}, ${y0}`); }
      if (ruler) { const m = angleOf(ruler.x0, ruler.y0, ruler.x1, ruler.y1); row("Ruler", `${m.length.toFixed(1)} px · ${m.angle.toFixed(1)}°`); }
      smp().forEach((sp, k) => { const [r, g, b] = sampleAvg(flatNow(), S.w, S.h, sp.x, sp.y, sampleSize); row("#" + (k + 1), `${r} ${g} ${b}`); });
      box.innerHTML = `<table>${rows.join("")}</table>`;
    }
    // Notes
    function paintNotes() {
      const box = $("pcNotes"); if (!box || !isOn("pcNotes")) return;
      box.innerHTML = nts().length ? nts().map((n, k) => `<div class="pcm-note" data-k="${k}"><b>${k + 1}</b><span>${esc(n.text || "(empty)")}</span><button class="ghost pcmGo" title="Show it">⌖</button><button class="ghost pcmDel" title="Delete it">✕</button></div>`).join("") + '<div class="pcm-r"><button class="ghost" id="pcmClearNotes">Clear all notes</button></div>'
        : '<div style="color:var(--pc-dim)">No notes. The Note tool (I) puts one where you click.</div>';
      box.querySelectorAll(".pcm-note").forEach((r) => { const k = +r.dataset.k; r.querySelector(".pcmGo").onclick = () => centreOn(nts()[k].x, nts()[k].y); r.querySelector(".pcmDel").onclick = () => { nts().splice(k, 1); paintNotes(); E.drawOverlay(); }; r.querySelector("span").ondblclick = () => editNote(k); });
      const ca = $("pcmClearNotes"); if (ca) ca.onclick = () => { nts().length = 0; paintNotes(); E.drawOverlay(); };
    }
    function editNote(k) {
      const n = nts()[k]; if (!n) return;
      const t = win.prompt("Note " + (k + 1), n.text || ""); if (t == null) return;
      n.text = t.slice(0, 2000); paintNotes(); E.drawOverlay();
    }
    // keep them current
    const prevShow = E.ui.showTab;
    E.ui.showTab = function (id) { const r = prevShow.apply(this, arguments); if (id === "pcNav") paintNav(); if (id === "pcHist") paintHist(); if (id === "pcInfo") paintInfo(); if (id === "pcNotes") paintNotes(); return r; };
    let tick = 0;
    win.setInterval(() => { if (!kx || !kx.isConnected) return; tick++; if (isOn("pcNav")) paintNav(); if (isOn("pcHist")) paintHist(); if (tick % 2 === 0 && isOn("pcInfo")) paintInfo(); }, 400);
    stage.addEventListener("pointermove", (e) => { if (!S.w) return; cursorPt = E.pos(e); if (isOn("pcInfo")) paintInfo(); });
    stage.addEventListener("pointerleave", () => { cursorPt = null; if (isOn("pcInfo")) paintInfo(); });

    /* ---- the tools ---- */
    const T = E.tools;
    T.sampler = {
      id: "sampler", name: "Color Sampler", cursor: "crosshair",
      options: () => `<span class="tn">Color Sampler</span><label>Sample size <select id="pcmSz"><option value="1">Point sample</option><option value="3">3 by 3 average</option><option value="5">5 by 5 average</option></select></label>`
        + `<button class="ghost" id="pcmSClear">Clear All</button><span style="color:var(--pc-dim)">${smp().length} / 10 · click = a sampler · drag one to move it · Alt-click removes · the Info panel reads them</span>`,
      bindOptions(o) { const s = o.querySelector("#pcmSz"); s.value = String(sampleSize); s.onchange = () => { sampleSize = +s.value; store.set("sampler.size", sampleSize); paintInfo(); }; o.querySelector("#pcmSClear").onclick = () => { smp().length = 0; E.drawOverlay(); E.renderOptions(); paintInfo(); }; },
      down(e, x, y) {
        const k = smp().findIndex((p) => Math.hypot(p.x - x, p.y - y) < 8 / S.zoom);
        if (e.altKey) { if (k >= 0) smp().splice(k, 1); E.drawOverlay(); E.renderOptions(); paintInfo(); return false; }
        if (k >= 0) { this.drag = k; return true; }
        if (smp().length >= 10) { say("10 colour samplers at most - Alt-click one to remove it"); return false; }
        smp().push({ x: Math.round(x), y: Math.round(y) }); this.drag = smp().length - 1; E.drawOverlay(); E.renderOptions();
        if (E.ui.showTab) E.ui.showTab("pcInfo");
        return true;
      },
      move(e, x, y) { if (this.drag == null) return; smp()[this.drag] = { x: Math.round(Math.max(0, Math.min(S.w - 1, x))), y: Math.round(Math.max(0, Math.min(S.h - 1, y))) }; E.drawOverlay(); paintInfo(); },
      up() { this.drag = null; },
    };
    T.ruler = {
      id: "ruler", name: "Ruler", cursor: "crosshair",
      options: () => {
        const m = ruler ? angleOf(ruler.x0, ruler.y0, ruler.x1, ruler.y1) : null;
        return `<span class="tn">Ruler</span>` + (m ? `<span style="font-family:var(--mono)">X ${Math.round(ruler.x0)} Y ${Math.round(ruler.y0)} · W ${Math.round(ruler.x1 - ruler.x0)} H ${Math.round(ruler.y1 - ruler.y0)} · A ${m.angle.toFixed(1)}° · L ${m.length.toFixed(1)} px</span>` : '<span style="color:var(--pc-dim)">drag to measure (Shift = 45°)</span>')
          + `<span class="sep"></span><button class="ghost" id="pcmStrL" title="Turn the active layer so the line is level (or upright)" ${m ? "" : "disabled"}>↻ Straighten Layer</button><button class="ghost" id="pcmStrP" title="Turn every layer" ${m ? "" : "disabled"}>↻ Straighten Picture</button><button class="ghost" id="pcmRClr" ${m ? "" : "disabled"}>Clear</button>`;
      },
      bindOptions(o) {
        o.querySelector("#pcmStrL").onclick = () => straighten(false); o.querySelector("#pcmStrP").onclick = () => straighten(true);
        o.querySelector("#pcmRClr").onclick = () => { ruler = S.ruler = null; E.drawOverlay(); E.renderOptions(); };
      },
      down(e, x, y) { ruler = S.ruler = { x0: x, y0: y, x1: x, y1: y }; return true; },
      move(e, x, y) { if (!ruler) return; let X = x, Y = y; if (e.shiftKey) { const a = Math.round(Math.atan2(y - ruler.y0, x - ruler.x0) / (Math.PI / 4)) * Math.PI / 4, L = Math.hypot(x - ruler.x0, y - ruler.y0); X = ruler.x0 + Math.cos(a) * L; Y = ruler.y0 + Math.sin(a) * L; } ruler.x1 = X; ruler.y1 = Y; E.drawOverlay(); E.renderOptions(); },
      up() { E.renderOptions(); paintInfo(); },
    };
    function rotateDraw(src, g, W, H, deg) { g.save(); g.translate(W / 2, H / 2); g.rotate(-deg * Math.PI / 180); g.drawImage(src, -src.width / 2, -src.height / 2); g.restore(); }
    function straighten(all) {
      if (!ruler || !S.w) return;
      const by = straightenBy(angleOf(ruler.x0, ruler.y0, ruler.x1, ruler.y1).angle);
      if (Math.abs(by) < 0.01) return say("already straight");
      if (all) {
        E.docOp("straighten picture", () => { E.remapLayers(S.w, S.h, (src, g) => rotateDraw(src, g, S.w, S.h, -by)); });
      } else {
        const L = S.layers[S.active]; if (!L || L.type !== "pixel") return say("Straighten Layer turns a pixel layer - Straighten Picture turns them all");
        E.pxOp("straighten layer", (c, g) => { const t = doc.createElement("canvas"); t.width = c.width; t.height = c.height; t.getContext("2d").drawImage(c, 0, 0); g.clearRect(0, 0, c.width, c.height); rotateDraw(t, g, c.width, c.height, -by); });
      }
      ruler = S.ruler = null; E.drawOverlay(); E.renderOptions();
      say(`straightened by ${(-by).toFixed(2)}°`);
    }
    T.note = {
      id: "note", name: "Note", cursor: "copy",
      options: () => `<span class="tn">Note</span><label>Author <input type="text" id="pcmAuth" value="${esc(store.get("note.author", ""))}" style="width:110px"></label><button class="ghost" id="pcmNClr">Clear All</button><span style="color:var(--pc-dim)">click = a new note · click a note to edit it · Alt-click deletes it</span>`,
      bindOptions(o) { const a = o.querySelector("#pcmAuth"); a.onchange = () => store.set("note.author", a.value); o.querySelector("#pcmNClr").onclick = () => { nts().length = 0; E.drawOverlay(); paintNotes(); }; },
      down(e, x, y) {
        const k = nts().findIndex((n) => Math.abs(n.x - x) < 12 / S.zoom && Math.abs(n.y - y) < 12 / S.zoom);
        if (k >= 0 && e.altKey) { nts().splice(k, 1); E.drawOverlay(); paintNotes(); return false; }
        if (k >= 0) { editNote(k); return false; }
        nts().push({ x: Math.round(x), y: Math.round(y), text: "", author: store.get("note.author", ""), at: Date.now() });
        E.drawOverlay(); if (E.ui.showTab) E.ui.showTab("pcNotes"); editNote(nts().length - 1);
        return false;
      },
    };
    T.count = {
      id: "count", name: "Count", cursor: "crosshair",
      options: () => {
        const C = cnt(), G = C.groups[C.cur] || C.groups[0], total = C.groups.reduce((a, g) => a + g.marks.length, 0);
        return `<span class="tn">Count</span><b id="pcmCnt">Count: ${G.marks.length}</b><select id="pcmCG">${C.groups.map((g, k) => `<option value="${k}"${k === C.cur ? " selected" : ""}>${esc(g.name)} (${g.marks.length})</option>`).join("")}</select>`
          + `<input type="color" id="pcmCC" value="${G.color}" title="The group's colour"><label>Size <input type="number" id="pcmCS" min="1" max="10" value="${G.size}" style="width:44px"></label>`
          + `<button class="ghost" id="pcmCNew" title="A new count group">＋ Group</button><button class="ghost" id="pcmCClr">Clear</button><span style="color:var(--pc-dim)">all groups: ${total} · Alt-click removes the nearest</span>`;
      },
      bindOptions(o) {
        const C = cnt(), G = () => C.groups[C.cur];
        o.querySelector("#pcmCG").onchange = (e) => { C.cur = +e.target.value; E.renderOptions(); E.drawOverlay(); };
        o.querySelector("#pcmCC").onchange = (e) => { G().color = e.target.value; E.drawOverlay(); };
        o.querySelector("#pcmCS").onchange = (e) => { G().size = Math.max(1, Math.min(10, +e.target.value || 4)); E.drawOverlay(); };
        o.querySelector("#pcmCNew").onclick = () => { const cols = ["#ff3030", "#30a0ff", "#30d050", "#ffb000", "#c040ff", "#00d0d0"]; C.groups.push({ name: "Count Group " + (C.groups.length + 1), color: cols[C.groups.length % cols.length], size: 4, marks: [] }); C.cur = C.groups.length - 1; E.renderOptions(); };
        o.querySelector("#pcmCClr").onclick = () => { G().marks.length = 0; E.renderOptions(); E.drawOverlay(); };
      },
      down(e, x, y) {
        const C = cnt(), G = C.groups[C.cur];
        if (e.altKey) { let bi = -1, bd = Infinity; G.marks.forEach((m, k) => { const d = Math.hypot(m[0] - x, m[1] - y); if (d < bd) { bd = d; bi = k; } }); if (bi >= 0 && bd < 20 / S.zoom) G.marks.splice(bi, 1); }
        else G.marks.push([Math.round(x), Math.round(y)]);
        E.renderOptions(); E.drawOverlay(); return false;
      },
    };
    T.pcrop = {
      id: "pcrop", name: "Perspective Crop", cursor: "crosshair",
      options: () => `<span class="tn">Perspective Crop</span><span style="color:var(--pc-dim)">${!pq ? "drag a box, then move its corners onto the sides of what should end up square" : pq.length < 4 ? "click the corners" : "move the corners · Enter crops · Esc cancels"}</span>`
        + `<span class="sep"></span><button class="ghost" id="pcmPOk" ${pq && pq.length === 4 ? "" : "disabled"}>✔ Crop</button><button class="ghost" id="pcmPNo">✕</button>`,
      bindOptions(o) { o.querySelector("#pcmPOk").onclick = perspectiveCrop; o.querySelector("#pcmPNo").onclick = () => { pq = null; E.drawOverlay(); E.renderOptions(); }; },
      down(e, x, y) {
        if (pq && pq.length === 4) { const k = pq.findIndex((p) => Math.hypot(p[0] - x, p[1] - y) < 10 / S.zoom); if (k >= 0) { this.drag = k; return true; } }
        pq = null; this.box = [x, y]; this.drag = null; return true;
      },
      move(e, x, y) {
        if (this.drag != null && pq) { pq[this.drag] = [x, y]; E.drawOverlay(); return; }
        if (this.box) { const [x0, y0] = this.box; pq = [[x0, y0], [x, y0], [x, y], [x0, y]]; E.drawOverlay(); }
      },
      up() { this.drag = null; if (this.box && pq) { const r = rectOfQuad(pq); if (r.w < 4 || r.h < 4) pq = null; } this.box = null; E.renderOptions(); },
      key(e) { if (e.key === "Enter" && pq && pq.length === 4) { perspectiveCrop(); return true; } if (e.key === "Escape" && pq) { pq = null; E.drawOverlay(); E.renderOptions(); return true; } return false; },
      leave() { pq = null; },
    };
    function perspectiveCrop() {
      if (!pq || pq.length !== 4 || !root.PCMesh) return;
      // the corners in order round the quad (top-left first)
      const cx = pq.reduce((a, p) => a + p[0], 0) / 4, cy = pq.reduce((a, p) => a + p[1], 0) / 4;
      const q = pq.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
      let s = 0; for (let k = 1; k < 4; k++) if (q[k][0] + q[k][1] < q[s][0] + q[s][1]) s = k;
      const quad = [0, 1, 2, 3].map((k) => q[(s + k) % 4]), size = rectOfQuad(quad), M = root.PCMesh;
      const Hm = M.homography([[0, 0], [size.w, 0], [size.w, size.h], [0, size.h]], quad);   // the new picture's point -> the old one
      E.docOp("perspective crop", () => {
        E.remapLayers(size.w, size.h, (src, g) => {
          const sw = src.width, sh = src.height, sd = src.getContext("2d").getImageData(0, 0, sw, sh).data, out = g.createImageData(size.w, size.h), od = out.data;
          for (let y = 0; y < size.h; y++) for (let x = 0; x < size.w; x++) {
            const [X, Y] = M.applyH(Hm, x + 0.5, y + 0.5), xi = Math.floor(X - 0.5), yi = Math.floor(Y - 0.5), fx = X - 0.5 - xi, fy = Y - 0.5 - yi, o = (y * size.w + x) * 4;
            for (let c = 0; c < 4; c++) {
              const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= sw || yy >= sh ? 0 : sd[(yy * sw + xx) * 4 + c]);
              od[o + c] = (at(xi, yi) * (1 - fx) + at(xi + 1, yi) * fx) * (1 - fy) + (at(xi, yi + 1) * (1 - fx) + at(xi + 1, yi + 1) * fx) * fy;
            }
          }
          g.putImageData(out, 0, 0);
        }, (L) => { const p = L.text || L.shape; if (!p) return; const inv = M.invertH(Hm), [nx, ny] = M.applyH(inv, p.x, p.y); p.x = nx; p.y = ny; });
      });
      pq = null; E.renderOptions();
      say(`perspective crop: ${size.w} × ${size.h}`);
    }
    // the overlay: samplers, the ruler, notes, count marks, the perspective crop
    E.overlayHooks.push((g, px) => {
      if (!S.w) return;
      g.font = `${11 * px}px sans-serif`; g.textBaseline = "middle";
      smp().forEach((p, k) => { g.strokeStyle = "#fff"; g.lineWidth = 2 * px; g.beginPath(); g.moveTo(p.x - 7 * px, p.y); g.lineTo(p.x + 7 * px, p.y); g.moveTo(p.x, p.y - 7 * px); g.lineTo(p.x, p.y + 7 * px); g.stroke(); g.strokeStyle = "#000"; g.lineWidth = px; g.stroke(); g.fillStyle = "#fff"; g.fillText(String(k + 1), p.x + 6 * px, p.y + 8 * px); });
      if (ruler && S.tool === "ruler") { g.strokeStyle = "#fff"; g.lineWidth = 2 * px; g.beginPath(); g.moveTo(ruler.x0, ruler.y0); g.lineTo(ruler.x1, ruler.y1); g.stroke(); g.strokeStyle = "#000"; g.lineWidth = px; g.setLineDash([4 * px, 4 * px]); g.stroke(); g.setLineDash([]); for (const [x, y] of [[ruler.x0, ruler.y0], [ruler.x1, ruler.y1]]) { g.beginPath(); g.moveTo(x - 5 * px, y); g.lineTo(x + 5 * px, y); g.stroke(); } }
      nts().forEach((n, k) => { g.fillStyle = "#ffd43b"; g.fillRect(n.x - 7 * px, n.y - 7 * px, 14 * px, 14 * px); g.strokeStyle = "#7a5b00"; g.lineWidth = px; g.strokeRect(n.x - 7 * px, n.y - 7 * px, 14 * px, 14 * px); g.fillStyle = "#000"; g.textAlign = "center"; g.fillText(String(k + 1), n.x, n.y); g.textAlign = "start"; });
      for (const G of cnt().groups) { g.fillStyle = G.color; g.font = `bold ${(8 + G.size * 2) * px}px sans-serif`; G.marks.forEach((m, k) => { g.beginPath(); g.arc(m[0], m[1], G.size * px, 0, Math.PI * 2); g.fill(); g.fillText(String(k + 1), m[0] + (G.size + 3) * px, m[1]); }); }
      if (pq && S.tool === "pcrop") {
        g.strokeStyle = "#fff"; g.lineWidth = 1.5 * px; g.beginPath(); pq.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
        g.strokeStyle = "rgba(0,0,0,.6)"; g.setLineDash([4 * px, 4 * px]); g.stroke(); g.setLineDash([]);
        if (pq.length === 4) { g.strokeStyle = "rgba(255,255,255,.4)"; g.beginPath(); for (const t of [1 / 3, 2 / 3]) { const a = [pq[0][0] + (pq[1][0] - pq[0][0]) * t, pq[0][1] + (pq[1][1] - pq[0][1]) * t], b = [pq[3][0] + (pq[2][0] - pq[3][0]) * t, pq[3][1] + (pq[2][1] - pq[3][1]) * t], c = [pq[0][0] + (pq[3][0] - pq[0][0]) * t, pq[0][1] + (pq[3][1] - pq[0][1]) * t], d = [pq[1][0] + (pq[2][0] - pq[1][0]) * t, pq[1][1] + (pq[2][1] - pq[1][1]) * t]; g.moveTo(...a); g.lineTo(...b); g.moveTo(...c); g.lineTo(...d); } g.stroke(); }
        g.fillStyle = "#fff"; pq.forEach(([x, y]) => g.fillRect(x - 4 * px, y - 4 * px, 8 * px, 8 * px));
      }
    });

    /* ---- Select ▸ Grow / Similar / Focus Area / Transform Selection ---- */
    const C = E.ui.addCmd;
    const hasSel = () => !!(S.w && E.hasSel && E.hasSel() && S.sel);
    C("sel.grow", "Grow", "", () => { E.changeSel(grow(S.sel, flatNow(), S.w, S.h, S.tol == null ? 32 : S.tol), "grow"); E.drawOverlay(); say("grown by the wand's tolerance (" + (S.tol == null ? 32 : S.tol) + ")"); }, { enabled: hasSel }, ["Select", "sel.mask"]);
    C("sel.similar", "Similar", "", () => { E.changeSel(similar(S.sel, flatNow(), S.w, S.h, S.tol == null ? 32 : S.tol), "similar"); E.drawOverlay(); }, { enabled: hasSel }, ["Select", "sel.grow"]);
    C("sel.focus", "Focus Area…", "", focusDialog, { enabled: () => !!S.w }, ["Select", "sel.subject"]);
    C("sel.transform", "Transform Selection…", "", transformDialog, { enabled: hasSel }, ["Select", "sel.similar"]);
    function miniDialog(title, html, init, ok) {
      const d = doc.createElement("div"); d.className = "kxdlg"; d.innerHTML = `<h4>${esc(title)}</h4>${html}<div class="bt"><button class="ghost cn">Cancel</button><button class="ghost ok">OK</button></div>`;
      kx.appendChild(d); if (E.ui.dragDialog) E.ui.dragDialog(d);
      const close = () => d.remove();
      d.querySelector(".cn").onclick = () => { if (init.cancel) init.cancel(); close(); };
      d.querySelector(".ok").onclick = () => { if (ok(d) !== false) close(); };
      if (init.run) init.run(d);
      return d;
    }
    function focusDialog() {
      const map = focusMap(flatNow(), S.w, S.h, Math.max(2, Math.round(Math.min(S.w, S.h) / 120))), before = S.sel ? Uint8Array.from(S.sel) : new Uint8Array(S.w * S.h);
      const build = (range, soft) => { const t = 1 - range / 100, out = new Uint8Array(S.w * S.h); for (let p = 0; p < out.length; p++) { const v = (map[p] - t) / Math.max(0.02, soft / 100); out[p] = v >= 1 ? 255 : v <= 0 ? 0 : Math.round(v * 255); } return out; };
      miniDialog("Focus Area", `<div class="rw"><label>In-focus range (%)</label><input type="range" id="pcmFR" min="1" max="100" value="60"><input type="number" id="pcmFRn" min="1" max="100" value="60"></div>
        <div class="rw"><label>Softness (%)</label><input type="range" id="pcmFS" min="1" max="50" value="8"></div><div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">The sharp parts of the picture are selected (the preview shows the selection).</div>`,
        { run(d) { const upd = () => { d.querySelector("#pcmFRn").value = d.querySelector("#pcmFR").value; E.setSel(build(+d.querySelector("#pcmFR").value, +d.querySelector("#pcmFS").value)); E.drawOverlay(); }; d.querySelector("#pcmFR").oninput = upd; d.querySelector("#pcmFS").oninput = upd; d.querySelector("#pcmFRn").onchange = () => { d.querySelector("#pcmFR").value = d.querySelector("#pcmFRn").value; upd(); }; upd(); },
          cancel() { E.setSel(before); E.drawOverlay(); } },
        (d) => { const m = build(+d.querySelector("#pcmFR").value, +d.querySelector("#pcmFS").value); E.setSel(before, true); E.changeSel(m, "focus area"); E.drawOverlay(); });
    }
    function transformDialog() {
      const before = Uint8Array.from(S.sel);
      const read = (d) => ({ dx: +d.querySelector("#pcmTx").value || 0, dy: +d.querySelector("#pcmTy").value || 0, sx: +d.querySelector("#pcmTw").value || 100, sy: +d.querySelector("#pcmTh").value || 100, rot: +d.querySelector("#pcmTr").value || 0 });
      miniDialog("Transform Selection", `<div class="rw"><label>Move X / Y (px)</label><input type="number" id="pcmTx" value="0"><input type="number" id="pcmTy" value="0"></div>
        <div class="rw"><label>Width / Height (%)</label><input type="number" id="pcmTw" value="100" min="1" max="1000"><input type="number" id="pcmTh" value="100" min="1" max="1000"></div>
        <div class="rw"><label>Rotate (°)</label><input type="number" id="pcmTr" value="0" min="-360" max="360" step="0.5"></div>`,
        { run(d) { d.querySelectorAll("input").forEach((i) => { i.oninput = () => { E.setSel(transformMask(before, S.w, S.h, read(d))); E.drawOverlay(); }; }); }, cancel() { E.setSel(before); E.drawOverlay(); } },
        (d) => { const m = transformMask(before, S.w, S.h, read(d)); E.setSel(before, true); E.changeSel(m, "transform selection"); E.drawOverlay(); });
    }
    /* ---- Layer ▸ Matting ---- */
    const pixelL = () => { const L = S.layers[S.active]; return !!(L && L.type === "pixel" && L.canvas); };
    const matte = (label, fn) => E.pxOp(label, (c, g) => { const id = g.getImageData(0, 0, c.width, c.height); id.data.set(fn(id.data, c.width, c.height)); g.putImageData(id, 0, 0); });
    C("layer.defringe", "Matting: Defringe…", "", () => { const n = +(win.prompt("Defringe width (px)", "1") || 0); if (n > 0) matte("defringe", (d, w, h) => defringe(d, w, h, Math.min(20, n))); }, { enabled: pixelL }, ["Layer", "layer.flatten", true]);
    C("layer.unblack", "Matting: Remove Black Matte", "", () => matte("remove black matte", (d) => unmatte(d, false)), { enabled: pixelL }, ["Layer", "layer.defringe"]);
    C("layer.unwhite", "Matting: Remove White Matte", "", () => matte("remove white matte", (d) => unmatte(d, true)), { enabled: pixelL }, ["Layer", "layer.unblack"]);
    // Window
    C("win.pcNav", "Navigator", "", () => E.ui.showTab("pcNav"), {}, ["Window", "win.pcSwatches"]);
    C("win.pcHist", "Histogram", "", () => E.ui.showTab("pcHist"), {}, ["Window", "win.pcNav"]);
    C("win.pcInfo", "Info", "", () => E.ui.showTab("pcInfo"), {}, ["Window", "win.pcHist"]);
    C("win.pcNotes", "Notes", "", () => E.ui.showTab("pcNotes"), {}, ["Window", "win.pcInfo"]);
    E.measure = { paintNav, paintHist, paintInfo, paintNotes, ruler: () => ruler, quad: () => pq, setQuad: (q) => { pq = q; E.renderOptions(); E.drawOverlay(); }, perspectiveCrop, straighten, centreOn, viewRect };
  }

  const PCMeasure = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCMeasure;
  else root.PCMeasure = PCMeasure;
})(typeof window !== "undefined" ? window : globalThis);
