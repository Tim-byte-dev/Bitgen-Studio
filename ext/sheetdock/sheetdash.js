/* ext/sheetdock/sheetdash.js — ▦ ✨ DASHBOARD FROM THE DATA (2.824.0): window.SheetDash (pure, Node-tested) + the dialog
 * (H3SheetDash.open).
 *
 * Tim: "can we use the llm to look through an excel file and format it like a dashboard in our spreadsheet". The LLM is
 * shown the SHAPE of the data - each column's name, kind (number / money / percent / date / text), a few values, totals,
 * distinct counts - never every row (lib/sheetAi.js). It answers with a PLAN; bitGen checks every name in it against
 * the real columns and builds the dashboard itself, with live formulas (so it updates when the data changes):
 *   plan {title, subtitle, sheet, kpis: [{label, func SUM|AVERAGE|COUNT|MIN|MAX, column, format}], breakdowns:
 *         [{title, by (a text column), value (a number column | null = count rows), func, top, chart}], trend:
 *         {title, date, value, func, period month|quarter|year|week|day, chart} | null, formats {column: kind}, theme}
 *   profile(sheets, get, code)   the data blocks (header row, data rows, columns + their kinds and numbers)
 *   validate(plan, prof)         a plan that only uses what is there (null when nothing usable)
 *   fallback(prof, ask)          a plan from the data's own shape (no LLM, or its answer was unusable)
 *   build(ctx, plan, prof)       a new "Dashboard" sheet (title, KPI tiles, tables + charts, a trend) at the front and
 *                                the data sheet formatted as a table (header, bands, number formats, widths, frozen
 *                                header, filter) -> {index, name, made}
 */
(function (root) {
  "use strict";
  const FUNCS = ["SUM", "AVERAGE", "COUNT", "MIN", "MAX"];
  const FORMATS = { currency: "$#,##0.00", money0: "$#,##0", number: "#,##0.00", integer: "#,##0", percent: "0.0%", date: "d/mm/yyyy", text: "@" };
  const CHARTS = ["column", "bar", "line", "area", "pie", "doughnut"];
  const PERIODS = ["day", "week", "month", "quarter", "year"];
  const THEMES = {
    blue: { dark: "#1f3a5f", accent: "#4472c4", tile: "#14243a", head: "#2b4c7e", band: "#18222f", label: "#9cc3ff" },
    green: { dark: "#1e4d2b", accent: "#70ad47", tile: "#13291a", head: "#2d6a3e", band: "#16231a", label: "#a8e0a0" },
    orange: { dark: "#6b3410", accent: "#ed7d31", tile: "#2e1a0c", head: "#8a4a1c", band: "#271b12", label: "#ffc49a" },
    purple: { dark: "#3d2a5c", accent: "#8e6bd1", tile: "#221836", head: "#55407e", band: "#1f1a2b", label: "#cdb8f5" },
    teal: { dark: "#0f4c55", accent: "#2ab0b8", tile: "#0d2a2f", head: "#17707a", band: "#132326", label: "#9ee5ea" },
    grey: { dark: "#3a3f47", accent: "#8a94a6", tile: "#202329", head: "#4d5562", band: "#1d1f23", label: "#c9d0dc" },
  };
  const SERIES = ["#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47", "#9e480e", "#997300", "#264478"];
  const EPOCH = Date.UTC(1899, 11, 30);
  const colName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const addr = (c, r) => colName(c) + (r + 1);
  const absAddr = (c, r) => "$" + colName(c) + "$" + (r + 1);
  const quote = (n) => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(n) ? n : "'" + String(n).replace(/'/g, "''") + "'");
  const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
  const parseKey = (k) => { const m = /^([A-Z]{1,3})(\d+)$/.exec(k); if (!m) return null; let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return { c: c - 1, r: +m[2] - 1 }; };
  const serialOf = (y, m, d) => (Date.UTC(y, m, d) - EPOCH) / 86400000;
  const dateOf = (n) => new Date(EPOCH + Math.floor(n) * 86400000);
  const isDateCode = (code) => { const c = String(code || "").replace(/"[^"]*"|\\.|\[[^\]]*\]/g, ""); return /[dy]/i.test(c) || (/m/i.test(c) && !/[0#?]/.test(c) && /[hs]/i.test(c) === false && /m/i.test(c)); };

  /* ------------------------------------------------------------------ the data's shape */
  function profile(sheets, get, code) {
    const out = [];
    sheets.forEach((S, si) => {
      if (S.dash) return;
      let r1 = Infinity, r2 = -1, c1 = Infinity, c2 = -1;
      for (const k of Object.keys(S.cells || {})) { const cl = S.cells[k]; if (!cl || cl.v == null || cl.v === "") continue; const p = parseKey(k); if (!p) continue; r1 = Math.min(r1, p.r); r2 = Math.max(r2, p.r); c1 = Math.min(c1, p.c); c2 = Math.max(c2, p.c); }
      if (r2 < 0) return;
      const has = (c, r) => { const v = get(si, c, r); return v != null && v !== ""; };
      // the header: the first row with 2+ filled cells, most of them text, and data under it
      let h = -1;
      for (let r = r1; r <= Math.min(r2, r1 + 30) && h < 0; r++) {
        let filled = 0, text = 0; for (let c = c1; c <= c2; c++) if (has(c, r)) { filled++; if (typeof get(si, c, r) === "string") text++; }
        if (filled >= 2 && text >= filled * 0.6 && r < r2) h = r;
      }
      if (h < 0) return;
      const cols = []; let cA = Infinity, cB = -1;
      for (let c = c1; c <= c2; c++) if (typeof get(si, c, h) === "string" && get(si, c, h).trim()) { cA = Math.min(cA, c); cB = Math.max(cB, c); }
      // the data rows: from under the header to the row before the first empty one
      let last = h;
      for (let r = h + 1; r <= Math.min(r2, h + 20000); r++) { let any = false; for (let c = cA; c <= cB; c++) if (has(c, r)) { any = true; break; } if (!any) { if (last > h) break; else continue; } last = r; }
      if (last <= h) return;
      for (let c = cA; c <= cB; c++) {
        const name = clip(get(si, c, h), 60); if (!name) continue;
        let nums = 0, dates = 0, texts = 0, blanks = 0, sum = 0, min = Infinity, max = -Infinity, money = 0, pct = 0;
        const freq = new Map();
        for (let r = h + 1; r <= last; r++) {
          const v = get(si, c, r), cd = code(si, c, r);
          if (v == null || v === "") { blanks++; continue; }
          if (typeof v === "number") {
            if (isDateCode(cd)) dates++; else nums++;
            sum += v; if (v < min) min = v; if (v > max) max = v;
            if (/[$€£¥฿₹₩]|"[A-Z]{0,3}\$/.test(cd || "")) money++; if (/%/.test(cd || "")) pct++;
          } else { texts++; const t = String(v); freq.set(t, (freq.get(t) || 0) + 1); }
        }
        const n = nums + dates + texts;
        const type = !n ? "empty" : dates >= n * 0.6 ? "date" : nums >= n * 0.6 ? "number" : "text";
        const col = { c, name, type, count: n, blanks };
        if (type === "number") Object.assign(col, { sum: +sum.toPrecision(12), min, max, avg: +(sum / Math.max(1, nums)).toPrecision(8), kind: money >= nums * 0.5 ? "money" : pct >= nums * 0.5 ? "percent" : Number.isInteger(sum) && Number.isInteger(min) ? "integer" : "number" });
        if (type === "date") { const d1 = dateOf(min), d2 = dateOf(max); Object.assign(col, { min, max, from: `${d1.getUTCDate()}/${d1.getUTCMonth() + 1}/${d1.getUTCFullYear()}`, to: `${d2.getUTCDate()}/${d2.getUTCMonth() + 1}/${d2.getUTCFullYear()}` }); }
        if (type === "text") Object.assign(col, { distinct: freq.size, top: [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => clip(e[0], 40)) });
        if (type !== "empty") cols.push(col);
      }
      if (cols.length >= 1) out.push({ name: S.name, si, header: h, r1: h + 1, r2: last, c1: cA, c2: cB, rows: last - h, cols });
    });
    return { sheets: out };
  }

  /* ------------------------------------------------------------------ plans */
  const fmtOf = (col) => (!col ? "number" : col.type === "date" ? "date" : col.kind === "money" ? "currency" : col.kind === "percent" ? "percent" : col.kind === "integer" ? "integer" : col.type === "number" ? "number" : "text");
  function pickSheet(prof, name) { const L = prof.sheets; if (!L.length) return null; const n = String(name || "").trim().toLowerCase(); return L.find((s) => s.name.toLowerCase() === n) || L.slice().sort((a, b) => b.rows * b.cols.length - a.rows * a.cols.length)[0]; }
  const findCol = (D, name) => { if (name == null) return null; const n = String(name).trim().toLowerCase(); return D.cols.find((c) => c.name.toLowerCase() === n) || null; };
  function validate(plan, prof) {
    if (!plan || typeof plan !== "object") return null;
    const D = pickSheet(prof, plan.sheet); if (!D) return null;
    const out = { title: clip(plan.title, 60) || D.name + " dashboard", subtitle: clip(plan.subtitle, 120), sheet: D.name, kpis: [], breakdowns: [], trend: null, formats: {}, theme: THEMES[plan.theme] ? plan.theme : "blue" };
    for (const k of Array.isArray(plan.kpis) ? plan.kpis : []) {
      const col = findCol(D, k && k.column), f = String((k && k.func) || "SUM").toUpperCase();
      if (!col || !FUNCS.includes(f)) continue;
      if (f !== "COUNT" && col.type === "text") continue;
      if ((f === "SUM" || f === "AVERAGE") && col.type !== "number") continue;
      out.kpis.push({ label: clip(k.label, 40) || (f === "COUNT" ? "Count" : f[0] + f.slice(1).toLowerCase() + " " + col.name), func: f, column: col.name, format: FORMATS[k.format] && k.format !== "text" ? k.format : f === "COUNT" ? "integer" : fmtOf(col) });
      if (out.kpis.length >= 6) break;
    }
    for (const b of Array.isArray(plan.breakdowns) ? plan.breakdowns : []) {
      const by = findCol(D, b && b.by); if (!by || by.type !== "text" || by.distinct < 2 || by.distinct > 200) continue;
      const val = b.value ? findCol(D, b.value) : null; if (b.value && (!val || val.type !== "number")) continue;
      let f = String(b.func || (val ? "SUM" : "COUNT")).toUpperCase(); if (!["SUM", "AVERAGE", "COUNT"].includes(f)) f = val ? "SUM" : "COUNT"; if (!val) f = "COUNT";
      out.breakdowns.push({ title: clip(b.title, 50) || (f === "COUNT" ? "Rows" : val.name) + " by " + by.name, by: by.name, value: val ? val.name : null, func: f, top: Math.max(2, Math.min(20, Math.round(+b.top || 8))), chart: CHARTS.includes(b.chart) ? b.chart : by.distinct <= 6 ? "doughnut" : "column" });
      if (out.breakdowns.length >= 4) break;
    }
    const t = plan.trend;
    if (t && typeof t === "object") {
      const dc = findCol(D, t.date), val = t.value ? findCol(D, t.value) : null;
      if (dc && dc.type === "date" && (!t.value || (val && val.type === "number"))) {
        let f = String(t.func || (val ? "SUM" : "COUNT")).toUpperCase(); if (!["SUM", "AVERAGE", "COUNT"].includes(f)) f = val ? "SUM" : "COUNT"; if (!val) f = "COUNT";
        out.trend = { title: clip(t.title, 50) || (val ? val.name : "Rows") + " over time", date: dc.name, value: val ? val.name : null, func: f, period: PERIODS.includes(t.period) ? t.period : "month", chart: ["line", "area", "column"].includes(t.chart) ? t.chart : "line" };
      }
    }
    if (plan.formats && typeof plan.formats === "object") for (const [k, v] of Object.entries(plan.formats)) { const col = findCol(D, k); if (col && FORMATS[v]) out.formats[col.name] = v; }
    if (!out.kpis.length && !out.breakdowns.length && !out.trend) return null;
    return out;
  }
  function fallback(prof) {
    const D = pickSheet(prof); if (!D) return null;
    const nums = D.cols.filter((c) => c.type === "number"), texts = D.cols.filter((c) => c.type === "text" && c.distinct >= 2 && c.distinct <= 40), dates = D.cols.filter((c) => c.type === "date");
    const main = nums.find((c) => c.kind === "money") || nums[0];
    const plan = { title: D.name + " dashboard", subtitle: `${D.rows} rows from "${D.name}"`, sheet: D.name, kpis: [{ label: "Rows", func: "COUNT", column: D.cols[0].name, format: "integer" }], breakdowns: [], trend: null, formats: {}, theme: "blue" };
    nums.slice(0, 4).forEach((c) => plan.kpis.push({ label: (c.kind === "percent" ? "Average " : "Total ") + c.name, func: c.kind === "percent" ? "AVERAGE" : "SUM", column: c.name, format: fmtOf(c) }));
    texts.slice(0, 2).forEach((t, i) => plan.breakdowns.push({ title: (main ? main.name : "Rows") + " by " + t.name, by: t.name, value: main ? main.name : null, func: main ? "SUM" : "COUNT", top: 8, chart: i === 1 && t.distinct <= 6 ? "doughnut" : "column" }));
    if (dates[0]) { const span = dates[0].max - dates[0].min; plan.trend = { title: (main ? main.name : "Rows") + " over time", date: dates[0].name, value: main ? main.name : null, func: main ? "SUM" : "COUNT", period: span > 1100 ? "quarter" : span > 62 ? "month" : span > 14 ? "week" : "day", chart: "line" }; }
    D.cols.forEach((c) => { plan.formats[c.name] = fmtOf(c); });
    return validate(plan, prof);
  }

  /* ------------------------------------------------------------------ building */
  function periods(min, max, period) {
    const out = [], d0 = dateOf(min);
    let y = d0.getUTCFullYear(), m = d0.getUTCMonth(), d = d0.getUTCDate();
    if (period === "month") d = 1; else if (period === "quarter") { m -= m % 3; d = 1; } else if (period === "year") { m = 0; d = 1; }
    else if (period === "week") { const wd = (d0.getUTCDay() + 6) % 7; d -= wd; }
    const next = (yy, mm, dd) => (period === "day" ? [yy, mm, dd + 1] : period === "week" ? [yy, mm, dd + 7] : period === "month" ? [yy, mm + 1, 1] : period === "quarter" ? [yy, mm + 3, 1] : [yy + 1, 0, 1]);
    let a = serialOf(y, m, d);
    while (a <= max && out.length < 400) { const [ny, nm, nd] = next(y, m, d), b = serialOf(ny, nm, nd); out.push([a, b]); const dd = dateOf(b); y = dd.getUTCFullYear(); m = dd.getUTCMonth(); d = dd.getUTCDate(); a = b; }
    return out;
  }
  const PFMT = { day: "d mmm yyyy", week: "d mmm yyyy", month: "mmm yyyy", quarter: "mmm yyyy", year: "yyyy" };
  function build(ctx, plan, prof) {
    const D = pickSheet(prof, plan.sheet), T = THEMES[plan.theme] || THEMES.blue, get = ctx.get;
    const S = { name: ctx.uniqueName("Dashboard"), cells: {}, cols: {}, rows: {}, merges: [], freeze: { r: 0, c: 0 }, charts: [], dash: true };
    const ds = ctx.sheets[D.si], Q = quote(ds.name), colOf = (name) => D.cols.find((c) => c.name === name);
    const ref = (col) => `${Q}!${absAddr(col.c, D.r1)}:${absAddr(col.c, D.r2)}`;
    const put = (c, r, v, f, s) => { const k = addr(c, r), o = {}; if (v != null && v !== "") o.v = String(v); if (f) o.f = f; if (s) o.s = s; if (Object.keys(o).length) S.cells[k] = Object.assign(S.cells[k] || {}, o); };
    const W = [150, 110, 90, 24, 95, 95, 95, 95, 95, 95, 95, 95], NC = W.length; W.forEach((w, i) => { S.cols[i] = w; });
    const xOf = (c) => W.slice(0, c).reduce((a, b) => a + b, 0), rowH = (r) => S.rows[r] || 22, yOf = (r) => { let y = 0; for (let i = 0; i < r; i++) y += rowH(i); return y; };
    const white = "#ffffff";
    // the title
    put(0, 0, plan.title, null, { b: true, size: 20, color: white, bg: T.dark, valign: "center", indent: 1 }); for (let c = 1; c < NC; c++) put(c, 0, null, null, { bg: T.dark });
    S.merges.push(`A1:${colName(NC - 1)}1`); S.rows[0] = 46;
    put(0, 1, plan.subtitle || `From "${ds.name}" - ${D.rows} rows`, null, { i: true, color: T.label, indent: 1 }); S.merges.push(`A2:${colName(NC - 1)}2`);
    S.rows[2] = 10;
    // KPI tiles: two columns each, a label row + a value row
    const fmtCode = (k) => FORMATS[k] || FORMATS.number;
    const kpis = plan.kpis.slice(0, 6);
    kpis.forEach((k, i) => {
      const col = colOf(k.column), c = i * 2, f = k.func === "COUNT" && col && col.type !== "number" ? "COUNTA" : k.func;
      const edge = { s: "medium", c: T.accent };
      put(c, 3, k.label, null, { color: T.label, bg: T.tile, size: 9, indent: 1, bd: { t: edge, l: edge } }); put(c + 1, 3, null, null, { bg: T.tile, bd: { t: edge, r: edge } });
      put(c, 4, `=${f}(${ref(col)})`, fmtCode(k.format), { b: true, size: 18, color: white, bg: T.tile, indent: 1, bd: { b: edge, l: edge } }); put(c + 1, 4, null, null, { bg: T.tile, bd: { b: edge, r: edge } });
      S.merges.push(`${addr(c, 3)}:${addr(c + 1, 3)}`, `${addr(c, 4)}:${addr(c + 1, 4)}`);
    });
    if (kpis.length) { S.rows[3] = 24; S.rows[4] = 42; }
    let r = kpis.length ? 6 : 3;
    const head = { b: true, color: white, bg: T.head, bd: { b: { s: "medium", c: T.accent } } };
    const block = (title, rows, chartSpec, headers, write) => {
      put(0, r, title, null, { b: true, size: 12, color: T.label }); S.rows[r] = 26; S.merges.push(`A${r + 1}:C${r + 1}`);
      const hr = r + 1;
      headers.forEach((h, i) => put(i, hr, h, null, Object.assign({}, head, i ? { align: "right" } : {})));
      write(hr + 1);
      const tableRows = rows + 2, chartRows = Math.max(tableRows + 1, 11), top = r + 1;
      S.charts.push(Object.assign({ id: "c" + (S.charts.length + 1), x: xOf(4), y: yOf(top), w: W.slice(4).reduce((a, b) => a + b, 0) - 6, h: chartRows * 22 - 6, legend: chartSpec.type === "pie" || chartSpec.type === "doughnut", colors: [T.accent].concat(SERIES) }, chartSpec));
      r = top + chartRows + 1;
    };
    // breakdowns
    for (const b of plan.breakdowns) {
      const by = colOf(b.by), val = b.value ? colOf(b.value) : null;
      const agg = new Map();
      for (let rr = D.r1; rr <= D.r2; rr++) { const k = get(D.si, by.c, rr); if (k == null || k === "") continue; const key = String(k), v = val ? get(D.si, val.c, rr) : 1; const a = agg.get(key) || { s: 0, n: 0 }; if (typeof v === "number") { a.s += v; a.n++; } else if (!val) { a.s++; a.n++; } agg.set(key, a); }
      const score = (a) => (b.func === "AVERAGE" ? a.s / Math.max(1, a.n) : b.func === "COUNT" ? a.n : a.s);
      const cats = [...agg.entries()].sort((x, y) => score(y[1]) - score(x[1])).slice(0, b.top).map((e) => e[0]);
      if (!cats.length) continue;
      const vf = b.func === "COUNT" ? FORMATS.integer : fmtCode(plan.formats[val && val.name] || fmtOf(val)), share = b.func !== "AVERAGE";
      const headers = [by.name, b.func === "COUNT" ? "Count" : (b.func === "AVERAGE" ? "Average " : "") + val.name].concat(share ? ["Share"] : []);
      const top = r + 2, last = top + cats.length - 1, totalRow = last + 1;
      block(b.title, cats.length + 1, { type: b.chart, title: b.title, range: `A${top}:B${last + 1}` }, headers, (r0) => {
        cats.forEach((cat, i) => {
          const rr = r0 + i, band = i % 2 ? { bg: T.band } : null;
          put(0, rr, cat, "@", Object.assign({}, band));
          const crit = absAddr(0, rr).replace(/^\$A/, "$A");
          const f = b.func === "COUNT" ? `=COUNTIF(${ref(by)},${crit})` : b.func === "AVERAGE" ? `=IFERROR(AVERAGEIF(${ref(by)},${crit},${ref(val)}),0)` : `=SUMIFS(${ref(val)},${ref(by)},${crit})`;
          put(1, rr, f, vf, Object.assign({}, band));
          if (share) put(2, rr, `=IFERROR(B${rr + 1}/B$${totalRow + 1},0)`, "0.0%", Object.assign({}, band));
        });
        const tb = { b: true, bd: { t: { s: "thin", c: T.accent } } };
        put(0, totalRow, b.func === "AVERAGE" ? "Average" : "Total", null, tb);
        put(1, totalRow, b.func === "AVERAGE" ? `=IFERROR(AVERAGE(B${r0 + 1}:B${totalRow}),0)` : `=SUM(B${r0 + 1}:B${totalRow})`, vf, tb);
        if (share) put(2, totalRow, `=SUM(C${r0 + 1}:C${totalRow})`, "0.0%", tb);
      });
    }
    // the trend
    if (plan.trend) {
      const t = plan.trend, dc = colOf(t.date), val = t.value ? colOf(t.value) : null;
      let per = t.period, P = periods(dc.min, dc.max, per);
      const order = PERIODS; while (P.length > 60 && order.indexOf(per) < order.length - 1) { per = order[order.indexOf(per) + 1]; P = periods(dc.min, dc.max, per); }
      const vf = t.func === "COUNT" ? FORMATS.integer : fmtCode(plan.formats[val && val.name] || fmtOf(val));
      const top = r + 2, last = top + P.length - 1;
      block(t.title, P.length, { type: t.chart, title: t.title, range: `A${top}:B${last + 1}` }, [per[0].toUpperCase() + per.slice(1), t.func === "COUNT" ? "Count" : (t.func === "AVERAGE" ? "Average " : "") + val.name], (r0) => {
        P.forEach(([a, b2], i) => {
          const rr = r0 + i, band = i % 2 ? { bg: T.band } : null, d = ref(dc);
          put(0, rr, String(a), PFMT[per], Object.assign({ align: "left" }, band));
          const f = t.func === "COUNT" ? `=COUNTIFS(${d},">=${a}",${d},"<${b2}")` : t.func === "AVERAGE" ? `=IFERROR(SUMIFS(${ref(val)},${d},">=${a}",${d},"<${b2}")/COUNTIFS(${d},">=${a}",${d},"<${b2}"),0)` : `=SUMIFS(${ref(val)},${d},">=${a}",${d},"<${b2}")`;
          put(1, rr, f, vf, Object.assign({}, band));
        });
      });
    }
    // the data sheet as a table
    const made = [];
    for (let c = D.c1; c <= D.c2; c++) {
      const k = addr(c, D.header), cl = ds.cells[k] || (ds.cells[k] = {});
      cl.s = Object.assign({}, cl.s || {}, head);
    }
    for (const col of D.cols) {
      const kind = plan.formats[col.name] || fmtOf(col), code = kind === "text" ? null : FORMATS[kind];
      let wmax = String(col.name).length;
      for (let rr = D.r1; rr <= D.r2; rr++) {
        const k = addr(col.c, rr), cl = ds.cells[k];
        if (code && cl && cl.v != null && !cl.f && col.type !== "text") cl.f = code;
        if (rr - D.r1 < 300) { const v = get(D.si, col.c, rr); wmax = Math.max(wmax, String(v == null ? "" : typeof v === "number" ? (kind === "date" ? "00/00/0000" : v.toFixed(kind === "integer" ? 0 : 2)) : v).length + (kind === "currency" ? 3 : 0)); }
      }
      if (!ds.cols[col.c]) ds.cols[col.c] = Math.max(60, Math.min(280, Math.round(wmax * 7.4 + 18)));
    }
    for (let rr = D.r1; rr <= D.r2; rr += 2) for (let c = D.c1; c <= D.c2; c++) { const k = addr(c, rr + 1); if (rr + 1 > D.r2) break; const cl = ds.cells[k] || (ds.cells[k] = {}); if (!cl.s || !cl.s.bg) cl.s = Object.assign({}, cl.s || {}, { bg: T.band }); }
    if (!ds.freeze || (!ds.freeze.r && !ds.freeze.c)) ds.freeze = { r: D.header + 1, c: 0 };
    ds.filter = { r: D.header, r2: D.r2, c1: D.c1, c2: D.c2, cols: {} };
    made.push(`${kpis.length} headline numbers`, `${plan.breakdowns.length} breakdown${plan.breakdowns.length === 1 ? "" : "s"}`, plan.trend ? "a trend" : "", `"${ds.name}" formatted as a table`);
    ctx.sheets.splice(0, 0, S);
    return { index: 0, name: S.name, made: made.filter(Boolean) };
  }

  const SheetDash = { profile, validate, fallback, build, periods, THEMES, FORMATS, FUNCS, CHARTS };
  root.SheetDash = SheetDash;
  if (typeof module !== "undefined" && module.exports) { module.exports = SheetDash; return; }

  /* ------------------------------------------------------------------ the dialog */
  const doc = root.document; if (!doc) return;
  const H = () => root.H3Sheet, X = () => root.H3Sheet && root.H3Sheet._;
  let dlg = null, pickedFile = null;
  function msg(t, bad) { const m = doc.getElementById("shdMsg"); if (m) { m.textContent = t; m.style.color = bad ? "#ff6b6b" : "var(--dim)"; } }
  function buildDlg() {
    dlg = doc.createElement("dialog"); dlg.id = "shDashDlg"; dlg.className = "shfd";
    dlg.innerHTML = `<style>
      #shDashDlg { padding: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--text); width: min(560px, 94vw); font-size: 12px; }
      #shDashDlg::backdrop { background: rgba(0,0,0,.45); }
      #shDashDlg .dh { display: flex; align-items: center; padding: 8px 12px; font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--line); }
      #shDashDlg .dh button { margin-left: auto; }
      #shDashDlg .db { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
      #shDashDlg .hint { color: var(--dim); line-height: 1.45; margin: 0; }
      #shDashDlg label { display: flex; align-items: center; gap: 6px; }
      #shDashDlg textarea { width: 100%; min-height: 60px; font-size: 12px; box-sizing: border-box; }
      #shDashDlg .df { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-top: 1px solid var(--line); }
      #shDashDlg #shdMsg { margin-right: auto; color: var(--dim); }
      #shDashDlg #shdGo { border-color: var(--tiger); color: var(--tiger); font-weight: 600; }
    </style>
    <div class="dh">✨ Dashboard from the data<button class="ghost" type="button" data-x="1" aria-label="Close">✕</button></div>
    <div class="db">
      <p class="hint">The LLM looks at the workbook's columns - their names, what kind of values they hold, a few examples and the totals (not every row) - and plans a dashboard: headline numbers, breakdowns with charts and a trend over time. bitGen builds it on a new sheet with live formulas, so it follows the data, and formats the data as a table.</p>
      <label><input type="radio" name="shdSrc" value="book" checked> This workbook</label>
      <label><input type="radio" name="shdSrc" value="file"> An Excel or CSV file… <button type="button" class="ghost" id="shdPick">📂 Pick a file</button> <span id="shdFileName" style="color:var(--dim)" data-noi18n></span></label>
      <input type="file" id="shdFile" accept=".xlsx,.xlsm,.csv,.tsv,.txt" hidden>
      <div>What should it show? (optional)</div>
      <textarea id="shdAsk" placeholder="e.g. sales by region and month, the best products, how much is still owed"></textarea>
      <label><input type="checkbox" id="shdLlm" checked> Use the LLM (the prompt docker's) - off: a dashboard from the data's own shape</label>
    </div>
    <div class="df"><span id="shdMsg"></span><button type="button" class="ghost" data-x="1">Cancel</button><button type="button" class="ghost" id="shdGo">✨ Build the dashboard</button></div>`;
    doc.body.appendChild(dlg);
    dlg.addEventListener("keydown", (e) => e.stopPropagation());
    dlg.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) dlg.close(); });
    doc.getElementById("shdPick").addEventListener("click", () => doc.getElementById("shdFile").click());
    doc.getElementById("shdFile").addEventListener("change", (e) => { pickedFile = e.target.files[0] || null; doc.getElementById("shdFileName").textContent = pickedFile ? pickedFile.name : ""; if (pickedFile) dlg.querySelector('[name="shdSrc"][value="file"]').checked = true; });
    doc.getElementById("shdGo").addEventListener("click", go);
  }
  async function go() {
    const btn = doc.getElementById("shdGo"); if (btn.disabled) return;
    const fromFile = dlg.querySelector('[name="shdSrc"]:checked').value === "file";
    if (fromFile && !pickedFile) return msg("pick a file first", true);
    btn.disabled = true;
    try {
      if (fromFile) { msg("reading " + pickedFile.name + " …"); await root.H3SheetIO.importFile(pickedFile); }
      const res = await run({ ask: doc.getElementById("shdAsk").value.trim(), llm: doc.getElementById("shdLlm").checked, say: msg });
      if (res) dlg.close();
    } catch (e) { msg("✗ " + (e.message || e), true); }
    finally { btn.disabled = false; }
  }
  /** profile -> plan (the LLM, else the data's shape) -> build; one undo step */
  async function run(o) {
    const I = X(), Hs = H(), say = o.say || I.msg;
    const prof = profile(Hs.W.sheets, (si, c, r) => Hs.book().get(si, c, r), (si, c, r) => { const cl = Hs.W.sheets[si].cells[addr(c, r)]; return cl ? I.codeOf(cl) : "General"; });
    if (!prof.sheets.length) { say("no table found - a dashboard needs a row of headings with data under it", true); return null; }
    let plan = null, from = "the data's own shape", why = "";
    if (o.llm) {
      say("✨ the LLM is looking at the columns …");
      try {
        const r = await fetch("/api/sheets/ai/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: prof, ask: o.ask || "" }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.plan) { plan = validate(j.plan, prof); if (plan) from = "the LLM's plan"; else why = "the LLM's plan named columns that are not there"; }
        else why = j.error || "HTTP " + r.status;
      } catch (e) { why = e.message || String(e); }
    }
    if (!plan) plan = fallback(prof);
    if (!plan) { say("nothing to show - the table needs numbers, dates or a column with a few different values", true); return null; }
    I.step();
    const used = new Set(Hs.W.sheets.map((s) => s.name.toLowerCase()));
    const uniqueName = (n) => { let k = n, i = 2; while (used.has(k.toLowerCase())) k = `${n} (${i++})`; return k; };
    const out = build({ sheets: Hs.W.sheets, get: (si, c, r) => Hs.book().get(si, c, r), uniqueName }, plan, prof);
    Hs.W.active = out.index; Hs.St.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; Hs.St.act = { r: 0, c: 0 }; Hs.St.book = null;
    I.tabs(); I.changed();
    I.msg(`✨ "${out.name}" built from ${from}: ${out.made.join(", ")}` + (why ? ` (the LLM: ${why})` : ""), !!why);
    return out;
  }
  function open() {
    if (!H() || !X()) return;
    if (!dlg) buildDlg();
    msg(""); pickedFile = null; doc.getElementById("shdFileName").textContent = ""; dlg.querySelector('[name="shdSrc"][value="book"]').checked = true;
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  root.H3SheetDash = { open, run };
})(typeof window !== "undefined" ? window : globalThis);
