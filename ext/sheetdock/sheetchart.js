/* ext/sheetdock/sheetchart.js — ▦ CHARTS ON A SHEET (2.824.0): window.SheetChart, pure (Node-tested), drawn as SVG.
 *
 * Tim: "can we use the llm to look through an excel file and format it like a dashboard in our spreadsheet" - the
 * dashboard's charts, and 📊 Chart ▾ for any range. A chart lives on a sheet (sheet.charts):
 *   {id, type: column | bar | line | area | pie | doughnut | scatter, title, range: "A1:C9", x, y, w, h (px from the
 *    grid's top-left), legend, colors: ["#hex" …]}
 *   data(get, range, label)  get(c, r) -> a cell's value, label(c, r) -> what it shows; the range's first row = names when it has text, its first column =
 *                     the categories when it has text (or there are several columns) -> {cats, series: [{name, values}]}
 *   svg(spec, data, w, h, look) -> the picture (look: {ink, dim, line, font, bg})
 *   niceScale(min, max, n) / short(n) - axis steps and 1.2K / 3.4M labels
 */
(function (root) {
  "use strict";
  const TYPES = ["column", "bar", "line", "area", "pie", "doughnut", "scatter"];
  const COLORS = ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47", "#264478", "#9e480e", "#636363", "#997300"];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function colIndex(s) { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
  function parseRange(r) { const m = /^\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/.exec(String(r || "").trim().toUpperCase()); if (!m) return null; const a = { c: colIndex(m[1]), r: +m[2] - 1 }, b = m[3] ? { c: colIndex(m[3]), r: +m[4] - 1 } : a; return { c1: Math.min(a.c, b.c), r1: Math.min(a.r, b.r), c2: Math.max(a.c, b.c), r2: Math.max(a.r, b.r) }; }
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const isText = (v) => typeof v === "string" && v !== "";
  function data(get, range, label) {
    const R = parseRange(range); if (!R) return { cats: [], series: [], err: "not a range" };
    const r2 = Math.min(R.r2, R.r1 + 500), c2 = Math.min(R.c2, R.c1 + 30);
    let head = false; for (let c = R.c1 + (c2 > R.c1 ? 1 : 0); c <= c2; c++) if (isText(get(c, R.r1))) head = true;
    const r0 = head ? R.r1 + 1 : R.r1;
    let catCol = false;
    if (c2 > R.c1) { catCol = true; } else { for (let r = r0; r <= r2; r++) if (isText(get(R.c1, r))) catCol = true; }
    const cats = [], series = [];
    // the categories as the cells show them (a date column -> "Nov 2026", not its day number)
    for (let r = r0; r <= r2; r++) cats.push(catCol ? String(label ? label(R.c1, r) : get(R.c1, r) == null ? "" : get(R.c1, r)) : String(r - r0 + 1));
    for (let c = catCol ? R.c1 + 1 : R.c1; c <= c2; c++) {
      const name = head ? String(get(c, R.r1) || "Series " + (series.length + 1)) : "Series " + (series.length + 1), values = [];
      for (let r = r0; r <= r2; r++) { const v = get(c, r); values.push(isNum(v) ? v : null); }
      if (values.some((v) => v != null)) series.push({ name, values });
    }
    // trailing empty rows (no category, no values) left out
    while (cats.length && !cats[cats.length - 1] && series.every((s) => s.values[cats.length - 1] == null)) { cats.pop(); series.forEach((s) => s.values.pop()); }
    return { cats, series };
  }
  function niceScale(min, max, n) {
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (min === max) { if (max === 0) max = 1; else if (max > 0) min = 0; else max = 0; }
    const span = max - min, raw = span / Math.max(1, n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toPrecision(12));
    return { lo, hi, step, ticks };
  }
  function short(n) {
    const a = Math.abs(n);
    if (a >= 1e9) return +(n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
    if (a >= 1e6) return +(n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    if (a >= 1e4) return +(n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + "K";
    if (a !== 0 && a < 0.01) return n.toExponential(1);
    return String(+n.toPrecision(4));
  }
  const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));
  function svg(spec, d, w, h, look) {
    const L = Object.assign({ ink: "#e8e2d6", dim: "#9a927f", line: "#3a352c", font: "sans-serif", bg: "none" }, look || {});
    const type = TYPES.includes(spec.type) ? spec.type : "column", cols = Array.isArray(spec.colors) && spec.colors.length ? spec.colors : COLORS;
    const W = Math.max(60, w), H = Math.max(60, h), fs = Math.max(9, Math.min(12, Math.round(Math.min(W, H) / 26)));
    let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(L.font)}" font-size="${fs}">`;
    if (L.bg !== "none") o += `<rect width="${W}" height="${H}" fill="${L.bg}"/>`;
    let top = 8;
    if (spec.title) { o += `<text x="${W / 2}" y="${top + fs + 2}" text-anchor="middle" fill="${L.ink}" font-weight="700" font-size="${fs + 2}">${esc(clip(spec.title, 60))}</text>`; top += fs + 10; }
    const series = d.series || [], cats = d.cats || [];
    if (!series.length || !cats.length) return o + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${L.dim}">${esc(d.err || "no numbers in the range")}</text></svg>`;
    const legend = spec.legend !== false && (series.length > 1 || type === "pie" || type === "doughnut");
    let bottom = H - 6;
    const legendItems = type === "pie" || type === "doughnut" ? cats : series.map((s) => s.name);
    if (legend) {
      const items = legendItems.slice(0, 12), per = Math.max(1, Math.floor((W - 16) / 110)), rows = Math.ceil(items.length / per);
      bottom -= rows * (fs + 6);
      items.forEach((name, i) => { const x = 10 + (i % per) * 110, y = bottom + 6 + Math.floor(i / per) * (fs + 6); o += `<rect x="${x}" y="${y}" width="${fs - 2}" height="${fs - 2}" fill="${cols[i % cols.length]}"/><text x="${x + fs + 2}" y="${y + fs - 3}" fill="${L.ink}">${esc(clip(name, 14))}</text>`; });
    }
    if (type === "pie" || type === "doughnut") {
      const vals = series[0].values.map((v) => Math.max(0, v || 0)), tot = vals.reduce((a, b) => a + b, 0) || 1;
      const cx = W / 2, cy = (top + bottom) / 2, R = Math.max(10, Math.min(W / 2 - 12, (bottom - top) / 2 - 6)), r0 = type === "doughnut" ? R * 0.55 : 0;
      let a0 = -Math.PI / 2;
      vals.forEach((v, i) => {
        if (!v) return;
        const a1 = a0 + (v / tot) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
        const path = v / tot > 0.9999 ? `M ${p(R, 0)} A ${R} ${R} 0 1 1 ${p(R, Math.PI)} A ${R} ${R} 0 1 1 ${p(R, 0)}` + (r0 ? ` M ${p(r0, 0)} A ${r0} ${r0} 0 1 0 ${p(r0, Math.PI)} A ${r0} ${r0} 0 1 0 ${p(r0, 0)}` : "")
          : `M ${p(r0 || 0.001, a0)} L ${p(R, a0)} A ${R} ${R} 0 ${big} 1 ${p(R, a1)} L ${p(r0 || 0.001, a1)}` + (r0 ? ` A ${r0} ${r0} 0 ${big} 0 ${p(r0, a0)}` : "") + " Z";
        o += `<path d="${path}" fill="${cols[i % cols.length]}" stroke="${L.line}" stroke-width="1" fill-rule="evenodd"><title>${esc(cats[i])}: ${esc(short(v))} (${Math.round((v / tot) * 100)}%)</title></path>`;
        const am = (a0 + a1) / 2, lr = r0 ? (R + r0) / 2 : R * 0.65;
        if (v / tot >= 0.06) o += `<text x="${cx + lr * Math.cos(am)}" y="${cy + lr * Math.sin(am) + fs / 3}" text-anchor="middle" fill="#ffffff" font-size="${fs - 1}">${Math.round((v / tot) * 100)}%</text>`;
        a0 = a1;
      });
      return o + "</svg>";
    }
    // axes
    const all = []; series.forEach((s) => s.values.forEach((v) => { if (v != null) all.push(v); }));
    let mn = Math.min(0, ...all), mx = Math.max(0, ...all);
    const sc = niceScale(mn, mx, Math.max(2, Math.floor((type === "bar" ? W : H) / 60)));
    const lw = Math.min(70, Math.max(...sc.ticks.map((t) => short(t).length)) * fs * 0.62 + 8);
    if (type === "bar") {
      const catW = Math.min(120, Math.max(...cats.map((c) => clip(c, 16).length)) * fs * 0.6 + 8);
      const x0 = 8 + catW, x1 = W - 12, y0 = top + 4, y1 = bottom - fs - 6, X = (v) => x0 + ((v - sc.lo) / (sc.hi - sc.lo)) * (x1 - x0);
      sc.ticks.forEach((t) => { o += `<line x1="${X(t)}" y1="${y0}" x2="${X(t)}" y2="${y1}" stroke="${L.line}"/><text x="${X(t)}" y="${y1 + fs + 2}" text-anchor="middle" fill="${L.dim}">${esc(short(t))}</text>`; });
      const band = (y1 - y0) / cats.length, bw = (band * 0.75) / series.length;
      cats.forEach((c, i) => { o += `<text x="${x0 - 4}" y="${y0 + band * i + band / 2 + fs / 3}" text-anchor="end" fill="${L.ink}">${esc(clip(c, 16))}</text>`;
        series.forEach((s, k) => { const v = s.values[i]; if (v == null) return; const a = X(Math.min(0, v)), b = X(Math.max(0, v)); o += `<rect x="${a}" y="${y0 + band * i + band * 0.125 + bw * k}" width="${Math.max(0.5, b - a)}" height="${bw}" fill="${cols[k % cols.length]}"><title>${esc(s.name)} - ${esc(c)}: ${esc(short(v))}</title></rect>`; }); });
      return o + "</svg>";
    }
    const x0 = 8 + lw, x1 = W - 12, y0 = top + 6, y1 = bottom - fs - 8, Y = (v) => y1 - ((v - sc.lo) / (sc.hi - sc.lo)) * (y1 - y0);
    sc.ticks.forEach((t) => { o += `<line x1="${x0}" y1="${Y(t)}" x2="${x1}" y2="${Y(t)}" stroke="${L.line}"${t === 0 ? ' stroke-width="1.5"' : ""}/><text x="${x0 - 5}" y="${Y(t) + fs / 3}" text-anchor="end" fill="${L.dim}">${esc(short(t))}</text>`; });
    const n = cats.length, step = Math.max(1, Math.ceil((n * fs * 4.2) / (x1 - x0)));
    if (type === "scatter") {
      const xs = cats.map(Number), ok = xs.every(isFinite), xmin = ok ? Math.min(...xs) : 0, xmax = ok ? Math.max(...xs) : n - 1, xsc = niceScale(xmin, xmax, 5), X = (v) => x0 + ((v - xsc.lo) / (xsc.hi - xsc.lo || 1)) * (x1 - x0);
      xsc.ticks.forEach((t) => { o += `<text x="${X(t)}" y="${y1 + fs + 4}" text-anchor="middle" fill="${L.dim}">${esc(short(t))}</text>`; });
      series.forEach((s, k) => s.values.forEach((v, i) => { if (v == null) return; const xv = ok ? xs[i] : i; o += `<circle cx="${X(xv)}" cy="${Y(v)}" r="3.5" fill="${cols[k % cols.length]}"><title>${esc(short(xv))}, ${esc(short(v))}</title></circle>`; }));
      return o + "</svg>";
    }
    const band = (x1 - x0) / n, XC = (i) => x0 + band * i + band / 2;
    cats.forEach((c, i) => { if (i % step === 0) o += `<text x="${XC(i)}" y="${y1 + fs + 4}" text-anchor="middle" fill="${L.ink}">${esc(clip(c, Math.max(4, Math.floor((band * step) / (fs * 0.6)))))}</text>`; });
    if (type === "column") {
      const bw = (band * 0.75) / series.length;
      series.forEach((s, k) => s.values.forEach((v, i) => { if (v == null) return; const a = Y(Math.max(0, v)), b = Y(Math.min(0, v)); o += `<rect x="${x0 + band * i + band * 0.125 + bw * k}" y="${a}" width="${bw}" height="${Math.max(0.5, b - a)}" fill="${cols[k % cols.length]}"><title>${esc(s.name)} - ${esc(cats[i])}: ${esc(short(v))}</title></rect>`; }));
    } else {
      series.forEach((s, k) => {
        const pts = s.values.map((v, i) => (v == null ? null : [XC(i), Y(v)])).filter(Boolean), col = cols[k % cols.length];
        if (!pts.length) return;
        if (type === "area") o += `<path d="M ${pts[0][0]} ${Y(Math.max(sc.lo, 0))} ${pts.map((p) => `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ")} L ${pts[pts.length - 1][0]} ${Y(Math.max(sc.lo, 0))} Z" fill="${col}" fill-opacity=".35"/>`;
        o += `<polyline points="${pts.map((p) => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ")}" fill="none" stroke="${col}" stroke-width="2"/>`;
        if (pts.length <= 40) s.values.forEach((v, i) => { if (v != null) o += `<circle cx="${XC(i)}" cy="${Y(v)}" r="2.6" fill="${col}"><title>${esc(s.name)} - ${esc(cats[i])}: ${esc(short(v))}</title></circle>`; });
      });
    }
    return o + "</svg>";
  }
  const SheetChart = { TYPES, COLORS, parseRange, data, niceScale, short, svg };
  root.SheetChart = SheetChart;
  if (typeof module !== "undefined" && module.exports) module.exports = SheetChart;
})(typeof window !== "undefined" ? window : globalThis);
