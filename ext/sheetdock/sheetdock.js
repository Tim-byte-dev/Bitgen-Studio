/* ext/sheetdock/sheetdock.js — ▦ SPREADSHEET (2.822.0): the docker - the grid, editing, formats, sheets, files,
 * window.H3Sheet.
 *
 * Tim: "continue with the spreadsheet please" (the agreed plan, part 1 of 3: the grid + our own formula engine; next .xlsx /
 * .csv + charts, then the AI). The formulas are sheetcalc.js (SheetCalc); the files lib/sheetFiles.js (routes/sheets.js:
 * projects/<p>/sheets/<name>.bgs).
 *   THE GRID     only the cells on screen are drawn (a sticky pane over a spacer the size of the sheet); column / row
 *                headers (drag their edge = the width / height), frozen panes, merged cells, a filter's hidden rows
 *   EDITING      type to replace, F2 / double-click to edit, the ƒx bar; Enter down, Tab right, Esc back; a click on a
 *                cell while typing "=…" puts its address in; arrows (Shift = select), Ctrl+A, Delete; the fill handle
 *                (drag the corner: formulas move their references, 2+ numbers make a series); copy / cut / paste
 *                (tab-separated to other programs; inside bitGen the formulas and looks go with it); undo / redo
 *   LOOKS        General / Number / Currency / Percent / Date / Text + decimals, bold / italic / underline, text and fill
 *                colours, left / centre / right, wrap, borders (all / outside / bottom / none), merge
 *   TABLE        sort A→Z / Z→A by the active column, ⏷ filter (▾ on the header row = the values shown), ❄ freeze, Σ AutoSum,
 *                ƒx ▾ functions, the right-click menu (insert / delete rows and columns - references follow), sheets as
 *                tabs (＋, double-click = rename, right-click = rename / duplicate / delete)
 *   FILES        📄 New, 📂 Open ▾, 💾 Save (Ctrl+S); the open workbook is also kept in this browser as you work (a draft)
 *   2.823.0      Tim: "continue , add format cells button, format the cells like excel" - cell.f is a NUMBER FORMAT CODE
 *                (sheetfmt.js: sections, colours, conditions, dates, fractions ...; 2.822.0's names upgraded on load); the
 *                looks a cell can have (s): b i u (true | double | acc | dacc) strike sup sub font size color, align
 *                (general left center right fill justify centerSel distributed) indent valign (top center bottom justify
 *                distributed) wrap shrink rot (-90..90) stack dir, bd {t r b l d1 d2: {s: line style, c}}, bg, pat {t, c},
 *                grad {c1, c2, d}, unlock, hide; the sheet's protect. ▤ Format Cells… / Ctrl+1 = sheetfmtdlg.js
 *   2.824.0      charts on the sheet (sheet.charts, sheetchart.js): 📊 Chart ▾ from the selection, drawn over the cells,
 *                dragged / sized (the corner), double-click = edit, Delete; ranges follow inserted rows; ⤒ Import /
 *                ⤓ Export ▾ = sheetio.js; ✨ Dashboard = sheetdash.js
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const C = () => root.SheetCalc;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const DW = 90, DH = 22, HW = 44, HH = 22;
  const newSheet = (name) => ({ name, cells: {}, cols: {}, rows: {}, merges: [], freeze: { r: 0, c: 0 } });
  const W = { name: "Workbook", sheets: [newSheet("Sheet1")], active: 0 };
  const St = { sel: { r1: 0, c1: 0, r2: 0, c2: 0 }, act: { r: 0, c: 0 }, undo: [], redo: [], dirty: false, book: null, edit: null, clip: null, drag: null, booted: false, geo: null, chart: null };
  const sh = () => W.sheets[W.active];
  const A = (c, r) => C().addr(c, r);

  /* ---------------------------------------------------------------- the model */
  function book() { if (!St.book) St.book = new (C().Book)(W.sheets); St.book.sheets = W.sheets; return St.book; }
  function changed(noDraft) { St.dirty = true; book().recalc(); if (!noDraft) draft(); paint(); }
  function snapshot() { return JSON.stringify({ sheets: W.sheets, active: W.active }); }
  function step() { St.undo.push(snapshot()); if (St.undo.length > 80) St.undo.shift(); St.redo = []; }
  function undo(redo) {
    const from = redo ? St.redo : St.undo, to = redo ? St.undo : St.redo;
    if (!from.length) return msg(redo ? "nothing to redo" : "nothing to undo");
    to.push(snapshot()); const s = JSON.parse(from.pop()); W.sheets = s.sheets; W.active = Math.min(s.active, W.sheets.length - 1);
    St.book = null; changed(); tabs();
  }
  let draftT = 0;
  function draft() { clearTimeout(draftT); draftT = setTimeout(() => { try { root.localStorage.setItem("h3.sheet.draft", JSON.stringify(W)); } catch (e) { /* too big for the browser - Save keeps it */ } }, 600); }
  const cellAt = (c, r) => sh().cells[A(c, r)];
  function setRaw(c, r, v) {
    const k = A(c, r), cell = sh().cells[k] || {};
    const t = String(v == null ? "" : v);
    if (t === "") delete cell.v; else {
      cell.v = t;
      if (t[0] !== "=") { const p = C().parseInput(t); if (p.fmt && !cell.f && p.fmt !== "text") cell.f = p.fmt; }
    }
    if (Object.keys(cell).length) sh().cells[k] = cell; else delete sh().cells[k];
  }
  const style = (c, r) => (cellAt(c, r) || {}).s || {};
  function setStyle(c, r, fn) { const k = A(c, r), cell = sh().cells[k] || {}; cell.s = Object.assign({}, cell.s || {}); fn(cell.s, cell); for (const x of Object.keys(cell.s)) if (cell.s[x] == null || cell.s[x] === false || cell.s[x] === "") delete cell.s[x]; if (!Object.keys(cell.s).length) delete cell.s; if (Object.keys(cell).length) sh().cells[k] = cell; else delete sh().cells[k]; }
  function eachSel(fn) { const s = norm(St.sel); for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) fn(c, r); }
  const norm = (s) => ({ r1: Math.min(s.r1, s.r2), r2: Math.max(s.r1, s.r2), c1: Math.min(s.c1, s.c2), c2: Math.max(s.c1, s.c2) });
  function used(S) { let r = -1, c = -1; for (const k of Object.keys((S || sh()).cells)) { const p = C().parseAddr(k); if (p.r > r) r = p.r; if (p.c > c) c = p.c; } return { r, c }; }
  function shown(c, r) { const v = book().get(W.active, c, r), cell = cellAt(c, r) || {}; return F() ? F().render(v, codeOf(cell)).text : C().format(v, cell.f, (cell.s || {}).dp); }

  /* ---------------------------------------------------------------- 2.823.0 looks */
  const F = () => root.SheetFmt;
  const codeOf = (cell) => (cell && (F() ? F().upgrade(cell.f, (cell.s || {}).dp) : cell.f)) || "General";
  const okColor = (x) => (typeof x === "string" && /^#[0-9a-f]{3,8}$/i.test(x) ? x : null);
  const okFont = (x) => (typeof x === "string" ? x.replace(/[^\w \-.]/g, "").trim().slice(0, 64) : "");
  // line styles -> [px, css style] (the dialog draws the same list)
  const BSTYLE = { hair: [1, "dotted"], dotted: [1, "dotted"], dashDotDot: [1, "dashed"], dashDot: [1, "dashed"], dashed: [1, "dashed"], thin: [1, "solid"], mediumDashDotDot: [2, "dashed"],
    slantDashDot: [2, "dashed"], mediumDashDot: [2, "dashed"], mediumDashed: [2, "dashed"], medium: [2, "solid"], thick: [3, "solid"], double: [3, "double"] };
  const sideOf = (b) => (!b ? null : b === 1 || b === true ? { s: "thin" } : typeof b === "object" && BSTYLE[b.s] ? b : null);
  function sideCss(b) { const o = sideOf(b); if (!o) return null; const st = BSTYLE[o.s]; return `${st[0]}px ${st[1]} ${okColor(o.c) || "var(--text)"}`; }
  // fill patterns: 4 x 4 bitmaps (1 = the pattern colour), drawn 2 px a dot
  const PATTERNS = { gray75: ["1110", "1011", "1110", "1011"], gray50: ["1010", "0101", "1010", "0101"], gray25: ["1000", "0010", "1000", "0010"], gray125: ["1000", "0000", "0010", "0000"],
    gray0625: ["1000", "0000", "0000", "0000"], darkHorizontal: ["1111", "1111", "0000", "0000"], darkVertical: ["1100", "1100", "1100", "1100"], darkDown: ["1100", "0110", "0011", "1001"],
    darkUp: ["0011", "0110", "1100", "1001"], darkGrid: ["1111", "1100", "1100", "1100"], darkTrellis: ["1111", "0101", "1111", "1010"], lightHorizontal: ["1111", "0000", "0000", "0000"],
    lightVertical: ["1000", "1000", "1000", "1000"], lightDown: ["1000", "0100", "0010", "0001"], lightUp: ["0001", "0010", "0100", "1000"], lightGrid: ["1111", "1000", "1000", "1000"],
    lightTrellis: ["1010", "0101", "1010", "0000"] };
  // "Automatic" pattern colour = the theme's text colour (black would vanish on a dark theme)
  let INK = null;
  const autoInk = () => INK || (INK = okColor(((root.getComputedStyle && root.getComputedStyle(doc.documentElement).getPropertyValue("--text")) || "").trim()) || "#c8c8c8");
  function patternUrl(t, fg) {
    const P = PATTERNS[t]; if (!P) return ""; fg = okColor(fg) || autoInk();
    let rects = ""; P.forEach((row, y) => row.split("").forEach((b, x) => { if (b === "1") rects += `<rect x='${x * 2}' y='${y * 2}' width='2' height='2'/>`; }));
    // single quotes: this lands inside a style="…" attribute
    return "url('data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' shape-rendering='crispEdges' fill='${fg}'>${rects}</svg>`).replace(/'/g, "%27") + "')";
  }
  const GRAD = { h: "to bottom", v: "to right", du: "to top right", dd: "to bottom right" };
  function fillCss(S) {
    const g = S.grad;
    if (g && okColor(g.c1) && okColor(g.c2)) return GRAD[g.d] ? `background:linear-gradient(${GRAD[g.d]},${g.c1},${g.c2});` : `background:radial-gradient(circle,${g.c2},${g.c1});`;
    const bg = okColor(S.bg); let css = bg ? `background-color:${bg};` : "";
    if (S.pat && PATTERNS[S.pat.t]) css += `background-image:${patternUrl(S.pat.t, S.pat.c)};`;
    return css;
  }
  let MC = null, BASE = null;
  function measure(text, font) { if (!MC) MC = doc.createElement("canvas").getContext("2d"); MC.font = font; return MC.measureText(String(text)).width; }
  const baseFamily = () => BASE || (BASE = ((root.getComputedStyle && $("shGrid") && root.getComputedStyle($("shGrid")).fontFamily) || "sans-serif").replace(/"/g, "'"));
  const fontOf = (S) => `${S.i ? "italic " : ""}${S.b ? "700 " : ""}${S.size ? (+S.size * 4 / 3).toFixed(1) : 12}px ${S.font ? `'${okFont(S.font)}', ` : ""}${baseFamily()}`;
  /* protection: a protected sheet keeps its locked cells (every cell, unless Format Cells ▸ Protection unticks Locked) */
  const locked = (c, r) => !!sh().protect && !style(c, r).unlock;
  const PROT = "🔒 the sheet is protected - right-click its tab ▸ Unprotect sheet to change it";
  function guard(range) { if (!sh().protect) return false; const s = norm(range || St.sel); for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) if (locked(c, r)) { msg(PROT, true); return true; } return false; }
  function guardSheet() { if (!sh().protect) return false; msg(PROT, true); return true; }

  /* merges: "A1:B2" -> the master + the covered */
  function mergeMap() {
    const m = new Map();
    for (const g of sh().merges || []) { const [a, b] = g.split(":").map((x) => C().parseAddr(x)); for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) m.set(c + "," + r, { r1: a.r, c1: a.c, r2: b.r, c2: b.c, master: r === a.r && c === a.c }); }
    return m;
  }
  /* the filter's hidden rows */
  function hiddenRows() {
    const f = sh().filter, out = new Set(); if (!f || !f.cols) return out;
    const end = f.r2 > f.r ? f.r2 : used().r;
    for (let r = f.r + 1; r <= end; r++) for (const [c, allow] of Object.entries(f.cols)) if (Array.isArray(allow) && !allow.includes(shown(+c, r))) { out.add(r); break; }
    return out;
  }

  /* ---------------------------------------------------------------- geometry */
  function geometry() {
    const S = sh(), u = used(), hid = hiddenRows();
    const nR = Math.max(200, u.r + 120, St.act.r + 60), nC = Math.max(26, u.c + 16, St.act.c + 12);
    const colX = [0], rowY = [0];
    for (let c = 0; c < nC; c++) colX.push(colX[c] + (S.cols[c] || DW));
    for (let r = 0; r < nR; r++) rowY.push(rowY[r] + (hid.has(r) ? 0 : (S.rows[r] || DH)));
    const fr = Math.min(S.freeze.r || 0, nR), fc = Math.min(S.freeze.c || 0, nC);
    // 2.823.0 Centre across selection: a cell's text spans the empty cells to its right that are set the same way
    const cx = new Map();
    for (const [k, cell] of Object.entries(S.cells)) {
      if (!cell.s || cell.s.align !== "centerSel" || cell.v == null || cell.v === "") continue;
      const p = C().parseAddr(k); let c2 = p.c;
      while (c2 + 1 < nC) { const n = S.cells[A(c2 + 1, p.r)]; if (!n || !n.s || n.s.align !== "centerSel" || (n.v != null && n.v !== "")) break; c2++; }
      if (c2 > p.c) { cx.set(p.c + "," + p.r, c2); for (let c = p.c + 1; c <= c2; c++) cx.set(c + "," + p.r, -1); }
    }
    return { nR, nC, colX, rowY, fr, fc, hid, mm: mergeMap(), cx };
  }
  const bsearch = (arr, v) => { let lo = 0, hi = arr.length - 2; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (arr[mid] <= v) lo = mid; else hi = mid - 1; } return lo; };
  function xOf(G, c) { const g = $("shGrid"); return HW + G.colX[c] - (c >= G.fc ? g.scrollLeft : 0); }
  function yOf(G, r) { const g = $("shGrid"); return HH + G.rowY[r] - (r >= G.fr ? g.scrollTop : 0); }
  function hit(G, x, y) {
    const g = $("shGrid");
    let c, r;
    if (x < HW) c = -1; else if (x < HW + G.colX[G.fc]) c = bsearch(G.colX, x - HW); else c = bsearch(G.colX, x - HW + g.scrollLeft);
    if (y < HH) r = -1; else if (y < HH + G.rowY[G.fr]) r = bsearch(G.rowY, y - HH); else r = bsearch(G.rowY, y - HH + g.scrollTop);
    return { c: Math.min(c, G.nC - 1), r: Math.min(r, G.nR - 1) };
  }

  /* ---------------------------------------------------------------- drawing */
  let raf = 0;
  const paintSoon = () => { if (!raf) raf = root.requestAnimationFrame(() => { raf = 0; paint(); }); };
  function paint() {
    const g = $("shGrid"), pane = $("shPane"); if (!g || !pane || !St.booted) return;
    INK = null;
    const G = St.geo = geometry(), vw = g.clientWidth, vh = g.clientHeight;
    $("shSpace").style.width = (HW + G.colX[G.nC]) + "px"; $("shSpace").style.height = (HH + G.rowY[G.nR]) + "px";
    pane.style.width = vw + "px"; pane.style.height = vh + "px";
    const sl = g.scrollLeft, st = g.scrollTop;
    const colsIn = (frozen) => { const out = []; if (frozen) for (let c = 0; c < G.fc; c++) out.push(c); else { let c = Math.max(G.fc, bsearch(G.colX, sl + G.colX[G.fc])); for (; c < G.nC && HW + G.colX[c] - sl < vw; c++) out.push(c); } return out; };
    const rowsIn = (frozen) => { const out = []; if (frozen) for (let r = 0; r < G.fr; r++) out.push(r); else { let r = Math.max(G.fr, bsearch(G.rowY, st + G.rowY[G.fr])); for (; r < G.nR && HH + G.rowY[r] - st < vh; r++) out.push(r); } return out; };
    const cs = colsIn(false), rs = rowsIn(false), fcs = colsIn(true), frs = rowsIn(true);
    const s = norm(St.sel), f = sh().filter, h = [];
    const cellHtml = (c, r) => {
      const m = G.mm.get(c + "," + r); if (m && !m.master) return "";
      if (G.hid.has(r)) return "";
      const span = G.cx.get(c + "," + r); if (span === -1) return "";
      const x = xOf(G, c), y = yOf(G, r), c2 = m ? m.c2 : span > c ? span : c;
      const w = G.colX[c2 + 1] - G.colX[m ? m.c1 : c], ht = m ? G.rowY[m.r2 + 1] - G.rowY[m.r1] : G.rowY[r + 1] - G.rowY[r];
      const v = book().get(W.active, c, r), cell = cellAt(c, r) || {}, S = cell.s || {};
      const R = F() ? F().render(v, codeOf(cell)) : { text: C().format(v, cell.f, S.dp) };
      const err = C().isErr(v), kind = typeof v === "number" ? "num" : err || typeof v === "boolean" ? "mid" : "txt";
      const ha = S.align && S.align !== "general" ? S.align : kind === "num" ? "right" : kind === "mid" ? "center" : "left", va = S.valign || "bottom";
      const sizePx = S.size ? Math.max(4, Math.min(545, +S.size * 4 / 3)) : 12, ind = S.indent ? Math.min(15, +S.indent) * 10 : 0;
      let css = `left:${x}px;top:${y}px;width:${w}px;height:${ht}px;` + fillCss(S);
      const col = okColor(R.color) || okColor(S.color); if (col) css += `color:${col};`;
      if (S.font) css += `font-family:'${okFont(S.font)}',${baseFamily()};`;
      if (S.size) css += `font-size:${sizePx.toFixed(1)}px;line-height:${Math.round(sizePx * 1.3)}px;`;
      if (S.b) css += "font-weight:700;"; if (S.i) css += "font-style:italic;";
      if (S.bd) for (const [k, side] of [["t", "top"], ["r", "right"], ["b", "bottom"], ["l", "left"]]) { const b = sideCss(S.bd[k]); if (b) css += `border-${side}:${b};`; }
      css += `align-items:${va === "top" ? "flex-start" : va === "bottom" ? "flex-end" : "center"};`;
      if (S.dir === "rtl" || S.dir === "ltr") css += `direction:${S.dir};`;
      if (ind && (ha === "left" || ha === "distributed")) css += `padding-left:${4 + ind}px;`; else if (ind && ha === "right") css += `padding-right:${4 + ind}px;`;
      const wrap = !!(S.wrap || ha === "justify" || ha === "distributed" || va === "justify" || va === "distributed");
      let tcss = `text-align:${ha === "centerSel" ? "center" : ha === "fill" ? "left" : ha === "distributed" ? "justify" : ha};` + (ha === "distributed" ? "text-align-last:justify;" : "");
      const deco = []; if (S.u) deco.push("underline"); if (S.strike) deco.push("line-through");
      if (deco.length) tcss += `text-decoration:${deco.join(" ")};` + (S.u === "double" || S.u === "dacc" ? "text-decoration-style:double;" : "") + (S.u === "acc" || S.u === "dacc" ? "text-underline-offset:3px;" : "");
      if (S.sup) tcss += "font-size:75%;position:relative;top:-0.35em;"; else if (S.sub) tcss += "font-size:75%;position:relative;top:0.3em;";
      let text = R.text, fill = R.fill || null;
      const avail = w - 8 - ind, fnt = fontOf(S);
      if (S.stack) tcss += "writing-mode:vertical-rl;text-orientation:upright;white-space:pre;flex:0 0 auto;overflow:visible;";
      else if (S.rot) tcss += `transform:rotate(${-Math.max(-90, Math.min(90, +S.rot || 0))}deg);white-space:pre;overflow:visible;flex:0 0 auto;`;
      else {
        tcss += wrap ? "white-space:pre-wrap;word-break:break-word;" : "white-space:pre;";
        if (!wrap && text && avail > 0) {
          const tw = measure(fill ? fill.left + fill.right : text, fnt);
          if (S.shrink && tw > avail) tcss += `font-size:${Math.max(3, sizePx * avail / tw).toFixed(1)}px;`;
          else if (kind === "num" && tw > avail) { text = "#".repeat(Math.max(1, Math.floor(avail / Math.max(1, measure("#", fnt))))); fill = null; }
          else if (ha === "fill" && !fill) text = text.repeat(Math.max(1, Math.floor(avail / Math.max(1, tw))));
        }
      }
      let diag = "";
      if (S.bd && (S.bd.d1 || S.bd.d2)) {
        const ln = (b, x1, y1, x2, y2) => { const o = sideOf(b); if (!o) return ""; const st = BSTYLE[o.s]; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${okColor(o.c) || "currentColor"}" stroke-width="${st[0]}" vector-effect="non-scaling-stroke"${st[1] === "dotted" ? ' stroke-dasharray="1 2"' : st[1] === "dashed" ? ' stroke-dasharray="4 2"' : ""}/>`; };
        diag = `<svg class="dg" viewBox="0 0 100 100" preserveAspectRatio="none">${ln(S.bd.d1, 0, 100, 100, 0)}${ln(S.bd.d2, 0, 0, 100, 100)}</svg>`;
      }
      const inner = fill ? `<span class="t fl" style="${tcss}"><span>${esc(fill.left)}</span><span class="fc">${esc(fill.ch.repeat(160))}</span><span>${esc(fill.right)}</span></span>` : `<span class="t" style="${tcss}">${esc(text)}</span>`;
      const ft = f && r === f.r && c >= f.c1 && c <= f.c2 ? `<span class="ft${f.cols && f.cols[c] ? " on" : ""}" data-ft="${c}" title="Pick the values shown">▾</span>` : "";
      return `<div class="c${kind === "num" ? " num" : ""}${err ? " err" : ""}${wrap ? " wrap" : ""}" style="${css}" title="${err ? esc(v.err) : ""}">${inner}${diag}${ft}</div>`;
    };
    // the body, then the frozen rows / columns over it, then the corner
    for (const r of rs) for (const c of cs) h.push(cellHtml(c, r));
    for (const r of frs) for (const c of cs) h.push(cellHtml(c, r));
    for (const r of rs) for (const c of fcs) h.push(cellHtml(c, r));
    for (const r of frs) for (const c of fcs) h.push(cellHtml(c, r));
    // merged cells that start off screen but reach in
    for (const [k, m] of G.mm) if (m.master) { const [c, r] = k.split(",").map(Number); if (!cs.includes(c) && !fcs.includes(c) || !rs.includes(r) && !frs.includes(r)) { if (m.c2 >= (cs[0] || 0) && m.r2 >= (rs[0] || 0)) h.push(cellHtml(c, r)); } }
    // 2.824.0 the charts, over the cells (they scroll with the sheet)
    if (root.SheetChart && (sh().charts || []).length) {
      const cs0 = root.getComputedStyle(doc.documentElement), cv = (n, d) => okColor((cs0.getPropertyValue(n) || "").trim()) || d;
      const look = { ink: cv("--text", "#e8e2d6"), dim: cv("--dim", "#9a927f"), line: cv("--line", "#3a352c"), font: baseFamily().replace(/"/g, "'") };
      const get = (c, r) => book().get(W.active, c, r), label = (c, r) => shown(c, r);
      for (const ch of sh().charts) {
        const x = HW + ch.x - g.scrollLeft, y = HH + ch.y - g.scrollTop;
        if (x > vw || y > vh || x + ch.w < HW || y + ch.h < HH) continue;
        let pic = ""; try { pic = root.SheetChart.svg(ch, root.SheetChart.data(get, ch.range, label), ch.w - 2, ch.h - 2, look); } catch (e) { pic = ""; }
        h.push(`<div class="ch${St.chart === ch.id ? " on" : ""}" data-ch="${esc(ch.id)}" data-noi18n title="${esc(ch.title || "Chart")} - drag to move, the corner to size, double-click to change, Delete to remove" style="left:${x}px;top:${y}px;width:${ch.w}px;height:${ch.h}px">${pic}<span class="chr" data-chr="${esc(ch.id)}"></span></div>`);
      }
    }
    // the selection
    const box = (r1, c1, r2, c2) => { const x = xOf(G, c1), y = yOf(G, r1); return { x, y, w: xOf(G, c2) + (G.colX[c2 + 1] - G.colX[c2]) - x, h: yOf(G, r2) + (G.rowY[r2 + 1] - G.rowY[r2]) - y }; };
    const sb = box(s.r1, s.c1, s.r2, s.c2), ab = (() => { const m = G.mm.get(St.act.c + "," + St.act.r); return m ? box(m.r1, m.c1, m.r2, m.c2) : box(St.act.r, St.act.c, St.act.r, St.act.c); })();
    if (s.r1 !== s.r2 || s.c1 !== s.c2) h.push(`<div class="sel" style="left:${sb.x}px;top:${sb.y}px;width:${sb.w}px;height:${sb.h}px"></div>`);
    h.push(`<div class="act" style="left:${ab.x}px;top:${ab.y}px;width:${ab.w}px;height:${ab.h}px"></div>`);
    h.push(`<div class="fill" id="shFillH" title="Drag to fill" style="left:${sb.x + sb.w - 4}px;top:${sb.y + sb.h - 4}px"></div>`);
    if (St.clip && St.clip.sheet === W.active && St.clip.cut !== null) { const q = St.clip, cb = box(q.r1, q.c1, q.r2, q.c2); h.push(`<div class="copy" style="left:${cb.x}px;top:${cb.y}px;width:${cb.w}px;height:${cb.h}px"></div>`); }
    if (St.drag && St.drag.kind === "fill" && St.drag.to) { const t = St.drag.to, fb = box(t.r1, t.c1, t.r2, t.c2); h.push(`<div class="copy" style="left:${fb.x}px;top:${fb.y}px;width:${fb.w}px;height:${fb.h}px"></div>`); }
    // the headers
    for (const c of fcs.concat(cs)) { const x = xOf(G, c), w = G.colX[c + 1] - G.colX[c]; h.push(`<div class="h${c >= s.c1 && c <= s.c2 ? " on" : ""}" data-col="${c}" style="left:${x}px;top:0;width:${w}px;height:${HH}px">${C().colName(c)}<span class="rs" data-rc="${c}"></span></div>`); }
    for (const r of frs.concat(rs)) { if (G.hid.has(r)) continue; const y = yOf(G, r), ht = G.rowY[r + 1] - G.rowY[r]; h.push(`<div class="h${r >= s.r1 && r <= s.r2 ? " on" : ""}" data-row="${r}" style="left:0;top:${y}px;width:${HW}px;height:${ht}px">${r + 1}<span class="rsr" data-rr="${r}"></span></div>`); }
    h.push(`<div class="h" data-all="1" title="Select all" style="left:0;top:0;width:${HW}px;height:${HH}px">◢</div>`);
    if (G.fc) h.push(`<div class="frz" style="left:${HW + G.colX[G.fc] - 1}px;top:0;width:2px;height:${vh}px"></div>`);
    if (G.fr) h.push(`<div class="frz" style="left:0;top:${HH + G.rowY[G.fr] - 1}px;width:${vw}px;height:2px"></div>`);
    pane.innerHTML = h.join("");
    if (St.edit) placeEditor();
    bars(); status();
  }
  function bars() {
    const cell = cellAt(St.act.c, St.act.r) || {}, S = cell.s || {};
    $("shName").value = A(St.act.c, St.act.r);
    const hideF = sh().protect && S.hide;
    if (!St.edit || St.edit.from !== "fx") $("shFormula").value = cell.v == null || hideF ? "" : cell.v;
    $("shFormula").readOnly = locked(St.act.c, St.act.r);
    const code = codeOf(cell), det = F() ? F().detect(code) : { cat: "General" };
    $("shFmt").value = det.cat === "Date" ? (code === LONG_DATE ? "LongDate" : "ShortDate") : det.cat;
    for (const [id, on] of [["shB", S.b], ["shI", S.i], ["shU", S.u], ["shWrap", S.wrap], ["shAL", S.align === "left"], ["shAC", S.align === "center"], ["shAR", S.align === "right"], ["shFilter", !!sh().filter], ["shFreeze", !!(sh().freeze.r || sh().freeze.c)]]) { const b = $(id); if (b) b.classList.toggle("on", !!on); }
  }
  function status() {
    const s = norm(St.sel), el = $("shStat"); if (!el) return;
    if (s.r1 === s.r2 && s.c1 === s.c2) { el.textContent = ""; return; }
    let n = 0, sum = 0, cnt = 0;
    for (let r = s.r1; r <= Math.min(s.r2, s.r1 + 5000); r++) for (let c = s.c1; c <= s.c2; c++) { const v = book().get(W.active, c, r); if (v !== "" && v != null) cnt++; if (typeof v === "number") { n++; sum += v; } }
    el.textContent = n ? `Sum ${C().format(sum)} · Average ${C().format(sum / n)} · Count ${cnt}` : `Count ${cnt}`;
  }
  const LONG_DATE = "dddd, d mmmm yyyy";
  /** the Number Format dropdown -> a code (Custom / More… open the dialog) */
  const QUICK = { General: "General", Number: "0.00", Currency: "$#,##0.00", Accounting: '_-$* #,##0.00_-;-$* #,##0.00_-;_-$* "-"??_-;_-@_-', ShortDate: "d/mm/yyyy", LongDate: LONG_DATE,
    Time: "h:mm:ss AM/PM", Percentage: "0.00%", Fraction: "# ?/?", Scientific: "0.00E+00", Text: "@" };
  function setCode(code) { if (guardSheet()) return paint(); styleAll((S, cell) => { delete S.dp; if (!code || /^general$/i.test(code)) delete cell.f; else cell.f = code; }); }
  function decimalsBy(delta) {
    if (guardSheet() || !F()) return;
    step();
    eachSel((c, r) => setStyle(c, r, (S, cell) => {
      const v = book().get(W.active, c, r), code = codeOf(cell), t = typeof v === "number" ? F().render(v, code).text : "";
      const shownDp = (/\.(\d+)/.exec(t) || [0, ""])[1].length;
      const n = F().decimals(code, delta, shownDp); delete S.dp;
      if (n && !/^general$/i.test(n)) cell.f = n;
    }));
    changed();
  }
  function tabs() {
    const t = $("shTabs"); if (!t) return;
    t.innerHTML = W.sheets.map((s, i) => `<span class="tab${i === W.active ? " on" : ""}" data-i="${i}" title="Double-click to rename, right-click for more"><span data-noi18n>${esc(s.name)}</span>${s.protect ? " 🔒" : ""}</span>`).join("")
      + `<button class="ghost" type="button" id="shAddSheet" title="A new sheet">＋</button><span id="shStat"></span>`;
  }
  function msg(t, bad) { const m = $("shMsg"); if (!m) return; m.textContent = t || ""; m.classList.toggle("bad", !!bad); m.title = t || ""; }

  /* ---------------------------------------------------------------- selection + scrolling */
  function go(c, r, extend) {
    const G = St.geo || geometry();
    c = Math.max(0, Math.min(C().MAXC - 1, c)); r = Math.max(0, Math.min(C().MAXR - 1, r));
    const m = G.mm.get(c + "," + r); if (m && !extend) { c = m.c1; r = m.r1; }
    St.act = extend ? St.act : { c, r };
    St.sel = extend ? { r1: St.sel.r1, c1: St.sel.c1, r2: r, c2: c } : { r1: r, c1: c, r2: r, c2: c };
    reveal(c, r); paint();
  }
  function reveal(c, r) {
    const g = $("shGrid"), G = St.geo = geometry(); if (!g) return;
    if (c >= G.fc) { const x0 = G.colX[c], x1 = G.colX[c + 1], left = g.scrollLeft + G.colX[G.fc], right = g.scrollLeft + g.clientWidth - HW; if (x0 < left) g.scrollLeft = x0 - G.colX[G.fc]; else if (x1 > right) g.scrollLeft = x1 - g.clientWidth + HW + 4; }
    if (r >= G.fr) { const y0 = G.rowY[r], y1 = G.rowY[r + 1], top = g.scrollTop + G.rowY[G.fr], bot = g.scrollTop + g.clientHeight - HH; if (y0 < top) g.scrollTop = y0 - G.rowY[G.fr]; else if (y1 > bot) g.scrollTop = y1 - g.clientHeight + HH + 4; }
  }

  /* ---------------------------------------------------------------- editing */
  function startEdit(text, from) {
    if (guard({ r1: St.act.r, c1: St.act.c, r2: St.act.r, c2: St.act.c })) return;
    const cell = cellAt(St.act.c, St.act.r) || {};
    St.edit = { c: St.act.c, r: St.act.r, from: from || "cell", orig: cell.v == null ? "" : cell.v };
    if (from === "fx") return;
    let ed = EDIT; if (!ed) { ed = EDIT = doc.createElement("input"); ed.id = "shEdit"; ed.type = "text"; ed.spellcheck = false; ed.addEventListener("keydown", editKey); ed.addEventListener("input", () => { $("shFormula").value = ed.value; }); }
    $("shPane").appendChild(ed);
    ed.value = text != null ? text : St.edit.orig; placeEditor(); ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length);
    $("shFormula").value = ed.value;
  }
  let EDIT = null;                                   // the cell editor (kept: a repaint rebuilds the pane under it)
  function placeEditor() {
    const ed = EDIT, G = St.geo; if (!ed || !St.edit || !G || St.edit.from === "fx") return;
    if (ed.parentNode !== $("shPane")) { const had = doc.activeElement === ed || !doc.activeElement || doc.activeElement === doc.body; $("shPane").appendChild(ed); if (had) ed.focus({ preventScroll: true }); }
    const m = G.mm.get(St.edit.c + "," + St.edit.r), c2 = m ? m.c2 : St.edit.c, r2 = m ? m.r2 : St.edit.r;
    ed.style.left = xOf(G, St.edit.c) + "px"; ed.style.top = yOf(G, St.edit.r) + "px";
    ed.style.width = Math.max(G.colX[c2 + 1] - G.colX[St.edit.c], 90) + "px"; ed.style.height = (G.rowY[r2 + 1] - G.rowY[St.edit.r]) + "px";
  }
  function commit(dc, dr) {
    const E = St.edit; if (!E) return;
    const ed = E.from === "fx" ? null : EDIT, v = E.from === "fx" ? $("shFormula").value : ed ? ed.value : E.orig;
    St.edit = null; if (ed) ed.remove();
    if (v !== E.orig) { step(); setRaw(E.c, E.r, v); changed(); }
    $("shGrid").focus({ preventScroll: true });
    if (dc || dr) go(E.c + (dc || 0), E.r + (dr || 0)); else paint();
  }
  function cancel() { const ed = EDIT; St.edit = null; if (ed) ed.remove(); $("shGrid").focus({ preventScroll: true }); paint(); }
  function editKey(e) {
    if (e.key === "Enter") { e.preventDefault(); commit(0, e.shiftKey ? -1 : 1); }
    else if (e.key === "Tab") { e.preventDefault(); commit(e.shiftKey ? -1 : 1, 0); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    e.stopPropagation();
  }
  const typingFormula = () => { const E = St.edit; if (!E) return null; const el = E.from === "fx" ? $("shFormula") : EDIT; return el && /^=/.test(el.value) && /[=(,+\-*/^&<>:;]\s*$/.test(el.value.slice(0, el.selectionStart)) ? el : null; };

  /* ---------------------------------------------------------------- fill handle */
  function fill(src, to) {
    if (guard(to)) return paint();
    step();
    const s = norm(src), h = s.r2 - s.r1 + 1, w = s.c2 - s.c1 + 1, down = to.r2 > s.r2 || to.r1 < s.r1;
    const series = (vals) => { const n = vals.map((v) => (v != null && v !== "" && !/^=/.test(v) ? C().parseInput(v).value : null)); if (n.length < 2 || n.some((x) => typeof x !== "number")) return null; const d = n[1] - n[0]; return n.every((x, i) => Math.abs(x - (n[0] + d * i)) < 1e-9) ? { a: n[0], d } : null; };
    for (let r = to.r1; r <= to.r2; r++) for (let c = to.c1; c <= to.c2; c++) {
      if (r >= s.r1 && r <= s.r2 && c >= s.c1 && c <= s.c2) continue;
      const sr = s.r1 + (((r - s.r1) % h) + h) % h, sc = s.c1 + (((c - s.c1) % w) + w) % w, srcCell = cellAt(sc, sr) || {};
      const line = down ? Array.from({ length: h }, (_, i) => (cellAt(c, s.r1 + i) || {}).v) : Array.from({ length: w }, (_, i) => (cellAt(s.c1 + i, r) || {}).v);
      const ser = series(line);
      let v = srcCell.v;
      if (ser) v = String(+(ser.a + ser.d * (down ? r - s.r1 : c - s.c1)).toPrecision(15));
      else if (v && v[0] === "=") v = C().shiftFormula(v, r - sr, c - sc);
      const k = A(c, r);
      if (v == null && !srcCell.s && !srcCell.f) delete sh().cells[k];
      else sh().cells[k] = JSON.parse(JSON.stringify(Object.assign({}, srcCell, v == null ? {} : { v })));
    }
    St.sel = { r1: Math.min(s.r1, to.r1), c1: Math.min(s.c1, to.c1), r2: Math.max(s.r2, to.r2), c2: Math.max(s.c2, to.c2) };
    changed();
  }

  /* ---------------------------------------------------------------- clipboard */
  function copy(cut) {
    const s = norm(St.sel), rows = [], cells = [];
    for (let r = s.r1; r <= s.r2; r++) { const row = [], crow = []; for (let c = s.c1; c <= s.c2; c++) { row.push(shown(c, r).replace(/[\t\n]/g, " ")); crow.push(JSON.parse(JSON.stringify(cellAt(c, r) || {}))); } rows.push(row.join("\t")); cells.push(crow); }
    const text = rows.join("\n");
    St.clip = Object.assign({ sheet: W.active, text, cells, cut: !!cut }, s);
    paint(); msg(cut ? "✂ cut - paste where it goes" : "copied");
    return text;
  }
  function paste(text) {
    const at = norm(St.sel), Q = St.clip;
    { const lines = String(text || "").replace(/\r/g, "").replace(/\n$/, "").split("\n"); if (guard({ r1: at.r1, c1: at.c1, r2: at.r1 + lines.length - 1, c2: at.c1 + Math.max(...lines.map((l) => l.split("\t").length)) - 1 })) return; }
    step();
    if (Q && text != null && text.replace(/\r/g, "") === Q.text) {
      Q.cells.forEach((row, i) => row.forEach((cell, j) => {
        const r = at.r1 + i, c = at.c1 + j, k = A(c, r), o = JSON.parse(JSON.stringify(cell));
        if (o.v && o.v[0] === "=" && !Q.cut) o.v = C().shiftFormula(o.v, r - (Q.r1 + i), c - (Q.c1 + j));
        if (Object.keys(o).length) W.sheets[W.active].cells[k] = o; else delete W.sheets[W.active].cells[k];
      }));
      if (Q.cut) { const src = W.sheets[Q.sheet]; for (let r = Q.r1; r <= Q.r2; r++) for (let c = Q.c1; c <= Q.c2; c++) { const inside = Q.sheet === W.active && r >= at.r1 && r < at.r1 + Q.cells.length && c >= at.c1 && c < at.c1 + Q.cells[0].length; if (!inside) delete src.cells[A(c, r)]; } St.clip = null; }
      St.sel = { r1: at.r1, c1: at.c1, r2: at.r1 + Q.cells.length - 1, c2: at.c1 + Q.cells[0].length - 1 };
    } else {
      const lines = String(text || "").replace(/\r/g, "").replace(/\n$/, "").split("\n");
      lines.forEach((ln, i) => ln.split("\t").forEach((v, j) => setRaw(at.c1 + j, at.r1 + i, v)));
      St.sel = { r1: at.r1, c1: at.c1, r2: at.r1 + lines.length - 1, c2: at.c1 + Math.max(...lines.map((l) => l.split("\t").length)) - 1 };
    }
    changed();
  }

  /* ---------------------------------------------------------------- rows / columns */
  function shiftCells(axis, at, n) {
    if (guardSheet()) return;
    step();
    const S = sh(), next = {};
    for (const [k, cell] of Object.entries(S.cells)) {
      const p = C().parseAddr(k), i = axis === "r" ? p.r : p.c;
      if (n < 0 && i >= at && i < at - n) continue;
      const j = i >= at ? i + n : i;
      next[axis === "r" ? A(p.c, j) : A(j, p.r)] = cell;
    }
    S.cells = next;
    const key = axis === "r" ? "rows" : "cols", sz = {};
    for (const [k, v] of Object.entries(S[key])) { const i = +k; if (n < 0 && i >= at && i < at - n) continue; sz[i >= at ? i + n : i] = v; }
    S[key] = sz;
    S.merges = (S.merges || []).map((g) => C().adjustRefs("=" + g, S.name, S.name, axis, at, n).slice(1)).filter((g) => !/#REF!/.test(g));
    for (const X of W.sheets) for (const cell of Object.values(X.cells)) if (cell.v && cell.v[0] === "=") cell.v = C().adjustRefs(cell.v, S.name, X.name, axis, at, n);
    if (S.charts) S.charts = S.charts.map((ch) => Object.assign(ch, { range: C().adjustRefs("=" + ch.range, S.name, S.name, axis, at, n).slice(1) })).filter((ch) => !/#REF!/.test(ch.range));
    const F = S.filter;      // the filter's block grows / shrinks with the rows (its picked values go with their columns)
    if (F && axis === "r") { if (F.r >= at) F.r = Math.max(at, F.r + n); if (F.r2 >= at) F.r2 = Math.max(F.r, F.r2 + n); }
    if (F && axis === "c") { const cols = {}; for (const [c, v] of Object.entries(F.cols || {})) { const i = +c; if (n < 0 && i >= at && i < at - n) continue; cols[i >= at ? i + n : i] = v; } F.cols = cols; if (F.c1 >= at) F.c1 = Math.max(at, F.c1 + n); if (F.c2 >= at) F.c2 = Math.max(F.c1, F.c2 + n); }
    changed();
  }

  /* ---------------------------------------------------------------- table tools */
  function tableRange() {
    const s = norm(St.sel);
    if (s.r1 !== s.r2 || s.c1 !== s.c2) return s;
    if (used().r < 0) return null;
    // the block round the active cell (its "current region"): grown while a row or column next to it has something in it
    const has = (c, r) => r >= 0 && c >= 0 && !!cellAt(c, r) && cellAt(c, r).v != null && cellAt(c, r).v !== "";
    const R = { r1: St.act.r, c1: St.act.c, r2: St.act.r, c2: St.act.c };
    for (let grew = true, n = 0; grew && n < 5000; n++) {
      grew = false;
      const rowHas = (r) => { for (let c = R.c1 - 1; c <= R.c2 + 1; c++) if (has(c, r)) return true; return false; };
      const colHas = (c) => { for (let r = R.r1 - 1; r <= R.r2 + 1; r++) if (has(c, r)) return true; return false; };
      if (R.r1 > 0 && rowHas(R.r1 - 1)) { R.r1--; grew = true; }
      if (rowHas(R.r2 + 1)) { R.r2++; grew = true; }
      if (R.c1 > 0 && colHas(R.c1 - 1)) { R.c1--; grew = true; }
      if (colHas(R.c2 + 1)) { R.c2++; grew = true; }
    }
    if (!has(R.c1, R.r1) && R.r1 === R.r2 && R.c1 === R.c2) return null;
    return R;
  }
  function sort(desc) {
    if (guardSheet()) return;
    const R = tableRange(); if (!R) return msg("nothing to sort", true);
    const key = St.act.c;
    let r1 = R.r1;
    const head = (r) => { for (let c = R.c1; c <= R.c2; c++) { const v = book().get(W.active, c, r); if (typeof v === "number") return false; } return true; };
    if (R.r2 > R.r1 && head(R.r1) && !head(R.r1 + 1)) r1 = R.r1 + 1;    // a header row stays on top
    step();
    const rows = [];
    for (let r = r1; r <= R.r2; r++) { const cells = []; for (let c = R.c1; c <= R.c2; c++) cells.push(cellAt(c, r) || null); rows.push({ cells, r, k: book().get(W.active, key, r) }); }
    const val = (v) => (v === "" || v == null ? null : v);
    rows.sort((a, b) => { const x = val(a.k), y = val(b.k); if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1; const n = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }); return desc ? -n : n; });
    // a row's formulas go with it: its relative references move by as many rows (=B2*C2 sorted to row 4 = =B4*C4)
    rows.forEach((row, i) => row.cells.forEach((cell, j) => { const k = A(R.c1 + j, r1 + i), dr = r1 + i - row.r; if (cell && dr && typeof cell.v === "string" && cell.v[0] === "=") cell.v = C().shiftFormula(cell.v, dr, 0); if (cell) sh().cells[k] = cell; else delete sh().cells[k]; }));
    changed(); msg(`sorted ${rows.length} rows by column ${C().colName(key)} ${desc ? "Z → A" : "A → Z"}`);
  }
  function toggleFilter() {
    if (guardSheet()) return;
    step();
    if (sh().filter) { delete sh().filter; changed(); return msg("filter off - every row shown"); }
    const R = tableRange(); if (!R) return msg("type a table first (its first row = the headings)", true);
    sh().filter = { r: R.r1, r2: R.r2, c1: R.c1, c2: R.c2, cols: {} }; changed();
    msg("⏷ filter: ▾ on a heading picks the values shown");
  }
  function filterMenu(c, at) {
    const f = sh().filter; if (!f) return;
    const end = f.r2 > f.r ? f.r2 : used().r, vals = new Set();
    for (let r = f.r + 1; r <= end; r++) vals.add(shown(c, r));
    const list = [...vals].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), allow = f.cols[c];
    const m = menu(at.x, at.y, "");
    m.innerHTML = `<label><input type="checkbox" data-all="1" ${!allow ? "checked" : ""}> (Select all)</label><hr>`
      + list.map((v) => `<label><input type="checkbox" data-v="${esc(v)}" ${!allow || allow.includes(v) ? "checked" : ""}> ${v === "" ? "(blanks)" : `<span data-noi18n>${esc(v)}</span>`}</label>`).join("")
      + `<hr><div data-ok="1">✓ OK</div><div data-clear="1">Clear the filter of ${C().colName(c)}</div>`;
    m.addEventListener("change", (e) => { if (e.target.dataset.all) m.querySelectorAll("[data-v]").forEach((x) => { x.checked = e.target.checked; }); });
    m.addEventListener("click", (e) => {
      if (e.target.closest("[data-ok]")) { const on = [...m.querySelectorAll("[data-v]")].filter((x) => x.checked).map((x) => x.dataset.v); step(); if (on.length === list.length) delete f.cols[c]; else f.cols[c] = on; m.remove(); changed(); }
      else if (e.target.closest("[data-clear]")) { step(); delete f.cols[c]; m.remove(); changed(); }
    });
  }
  function toggleFreeze() {
    step();
    const F = sh().freeze;
    if (F.r || F.c) sh().freeze = { r: 0, c: 0 };
    else sh().freeze = { r: St.act.r || (St.act.c ? 0 : 1), c: St.act.c };
    changed(); msg(sh().freeze.r || sh().freeze.c ? `❄ frozen: ${sh().freeze.r} row(s), ${sh().freeze.c} column(s)` : "unfrozen");
  }
  function merge() {
    if (guardSheet()) return;
    const s = norm(St.sel), key = A(s.c1, s.r1) + ":" + A(s.c2, s.r2);
    step();
    const M = sh().merges || (sh().merges = []);
    const hitIdx = M.findIndex((g) => { const [a, b] = g.split(":").map((x) => C().parseAddr(x)); return !(b.r < s.r1 || a.r > s.r2 || b.c < s.c1 || a.c > s.c2); });
    if (hitIdx >= 0) { M.splice(hitIdx, 1); changed(); return msg("unmerged"); }
    if (s.r1 === s.r2 && s.c1 === s.c2) return msg("select the cells to merge", true);
    M.push(key);
    for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) if (r !== s.r1 || c !== s.c1) { const cell = cellAt(c, r); if (cell) delete cell.v; }
    St.act = { r: s.r1, c: s.c1 }; changed(); msg("merged " + key + " (the top-left cell's value kept)");
  }
  function borders(kind) {
    if (guardSheet()) return;
    step(); const s = norm(St.sel);
    eachSel((c, r) => setStyle(c, r, (S) => {
      if (kind === "none") { delete S.bd; return; }
      const bd = Object.assign({}, S.bd || {});
      if (kind === "all") Object.assign(bd, { t: 1, r: 1, b: 1, l: 1 });
      if (kind === "outside") { if (r === s.r1) bd.t = 1; if (r === s.r2) bd.b = 1; if (c === s.c1) bd.l = 1; if (c === s.c2) bd.r = 1; }
      if (kind === "bottom" && r === s.r2) bd.b = 1;
      S.bd = Object.keys(bd).length ? bd : null;
    }));
    changed();
  }
  function autoSum() {
    if (guard({ r1: St.act.r, c1: St.act.c, r2: St.act.r, c2: St.act.c })) return;
    const { c, r } = St.act; let r0 = r - 1;
    while (r0 >= 0 && typeof book().get(W.active, c, r0) === "number") r0--;
    let f = null;
    if (r0 < r - 1) f = `=SUM(${A(c, r0 + 1)}:${A(c, r - 1)})`;
    else { let c0 = c - 1; while (c0 >= 0 && typeof book().get(W.active, c0, r) === "number") c0--; if (c0 < c - 1) f = `=SUM(${A(c0 + 1, r)}:${A(c - 1, r)})`; }
    if (!f) return startEdit("=SUM(");
    step(); setRaw(c, r, f); changed(); msg("Σ " + f);
  }

  /* ---------------------------------------------------------------- menus */
  function menu(x, y, html) {
    doc.querySelectorAll(".shmenu").forEach((m) => m.remove());
    const m = doc.createElement("div"); m.className = "shmenu"; m.innerHTML = html; m.style.left = Math.round(x) + "px"; m.style.top = Math.round(y) + "px";
    doc.body.appendChild(m);
    const r = m.getBoundingClientRect(); if (r.bottom > root.innerHeight) m.style.top = Math.max(4, root.innerHeight - r.height - 4) + "px"; if (r.right > root.innerWidth) m.style.left = Math.max(4, root.innerWidth - r.width - 4) + "px";
    setTimeout(() => doc.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target)) { m.remove(); doc.removeEventListener("pointerdown", off, true); } }, true), 0);
    return m;
  }
  function cellMenu(x, y) {
    const s = norm(St.sel), nr = s.r2 - s.r1 + 1, nc = s.c2 - s.c1 + 1, rA = s.r1 + 1, rB = s.r2 + 1, cA = C().colName(s.c1), cB = C().colName(s.c2);
    const m = menu(x, y, `<div data-a="cut">✂ Cut</div><div data-a="copy">⧉ Copy</div><div data-a="paste">📋 Paste</div><hr>`
      + `<div data-a="rowAbove">${nr > 1 ? `Insert ${nr} rows above` : "Insert 1 row above"}</div><div data-a="rowBelow">${nr > 1 ? `Insert ${nr} rows below` : "Insert 1 row below"}</div>`
      + `<div data-a="colLeft">${nc > 1 ? `Insert ${nc} columns left` : "Insert 1 column left"}</div><div data-a="colRight">${nc > 1 ? `Insert ${nc} columns right` : "Insert 1 column right"}</div><hr>`
      + `<div data-a="delRows">${nr > 1 ? `Delete rows ${rA}-${rB}` : `Delete row ${rA}`}</div><div data-a="delCols">${nc > 1 ? `Delete columns ${cA}-${cB}` : `Delete column ${cA}`}</div><hr>`
      + `<div data-a="clear">Clear contents</div><div data-a="clearAll">Clear contents and formats</div><hr><div data-a="format">▤ Format Cells… (Ctrl+1)</div>`
      + (root.H3SheetAI ? `<hr><div data-a="aiWrite">✍ Write a formula…</div>` + (typeof (cellAt(St.act.c, St.act.r) || {}).v === "string" && String(cellAt(St.act.c, St.act.r).v)[0] === "=" ? `<div data-a="aiExplain">💡 Explain this formula</div>` : "") + `<div data-a="aiFill">🪄 Fill from examples (Ctrl+E)</div>` : ""));
    m.addEventListener("click", async (e) => {
      const a = (e.target.closest("[data-a]") || {}).dataset; if (!a || !a.a) return; m.remove();
      switch (a.a) {
        case "cut": case "copy": { const t = copy(a.a === "cut"); try { await root.navigator.clipboard.writeText(t); } catch (er) { /* the browser's own copy keeps it in bitGen */ } break; }
        case "paste": { let t = St.clip ? St.clip.text : ""; try { t = await root.navigator.clipboard.readText(); } catch (er) { /* bitGen's own */ } paste(t); break; }
        case "rowAbove": shiftCells("r", s.r1, nr); break;
        case "rowBelow": shiftCells("r", s.r2 + 1, nr); break;
        case "colLeft": shiftCells("c", s.c1, nc); break;
        case "colRight": shiftCells("c", s.c2 + 1, nc); break;
        case "delRows": shiftCells("r", s.r1, -nr); St.sel = { r1: s.r1, c1: s.c1, r2: s.r1, c2: s.c1 }; paint(); break;
        case "delCols": shiftCells("c", s.c1, -nc); St.sel = { r1: s.r1, c1: s.c1, r2: s.r1, c2: s.c1 }; paint(); break;
        case "clear": clear(false); break;
        case "clearAll": clear(true); break;
        case "format": openFormat(); break;
        case "aiWrite": root.H3SheetAI.openWrite(); break;
        case "aiExplain": root.H3SheetAI.openExplain(); break;
        case "aiFill": root.H3SheetAI.fillFromExamples(); break;
      }
    });
  }
  function clear(all) { if (guard()) return; step(); eachSel((c, r) => { const k = A(c, r); if (all) delete sh().cells[k]; else if (sh().cells[k]) { delete sh().cells[k].v; if (!Object.keys(sh().cells[k]).length) delete sh().cells[k]; } }); changed(); }
  function openFormat(tab) { if (St.edit) commit(); if (root.H3SheetFormat) root.H3SheetFormat.open(tab); }
  function tabMenu(i, x, y) {
    const m = menu(x, y, `<div data-a="rename">Rename…</div><div data-a="dup">Duplicate</div><div data-a="left">Move left</div><div data-a="right">Move right</div><hr><div data-a="protect">${W.sheets[i].protect ? "🔓 Unprotect sheet" : "🔒 Protect sheet"}</div><hr><div data-a="del">Delete…</div>`);
    m.addEventListener("click", async (e) => {
      const a = (e.target.closest("[data-a]") || {}).dataset.a; if (!a) return; m.remove();
      if (a === "rename") return renameSheet(i);
      step();
      if (a === "protect") { const S = W.sheets[i]; S.protect = !S.protect || undefined; tabs(); changed(); return msg(S.protect ? "🔒 protected: only cells with Locked unticked (Format Cells ▸ Protection) can be changed" : "🔓 unprotected"); }
      if (a === "dup") { const s = JSON.parse(JSON.stringify(W.sheets[i])); s.name = uniqueName(s.name + " (2)"); W.sheets.splice(i + 1, 0, s); W.active = i + 1; }
      else if (a === "left" && i > 0) { const [s] = W.sheets.splice(i, 1); W.sheets.splice(i - 1, 0, s); W.active = i - 1; }
      else if (a === "right" && i < W.sheets.length - 1) { const [s] = W.sheets.splice(i, 1); W.sheets.splice(i + 1, 0, s); W.active = i + 1; }
      else if (a === "del") {
        if (W.sheets.length < 2) { St.undo.pop(); return msg("a workbook keeps one sheet at least", true); }
        if (typeof root.appConfirm === "function" && !(await root.appConfirm(`Delete the sheet "${W.sheets[i].name}"? Formulas that use it show #REF!.`, "Delete sheet"))) { St.undo.pop(); return; }
        W.sheets.splice(i, 1); W.active = Math.min(W.active, W.sheets.length - 1);
      }
      St.book = null; tabs(); changed();
    });
  }
  const uniqueName = (n) => { let k = n, i = 2; while (W.sheets.some((s) => s.name.toLowerCase() === k.toLowerCase())) k = n.replace(/ \(\d+\)$/, "") + ` (${i++})`; return k; };
  async function renameSheet(i) {
    const old = W.sheets[i].name;
    const n = root.askText ? await root.askText("The sheet's name", old, "Rename sheet") : root.prompt("The sheet's name", old);
    const name = String(n || "").replace(/[\[\]*?:\\\/]/g, "").trim().slice(0, 60);
    if (!name || name === old) return;
    if (W.sheets.some((s, k) => k !== i && s.name.toLowerCase() === name.toLowerCase())) return msg("there is a sheet of that name already", true);
    step();
    const q = (x) => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(x) ? x : "'" + x.replace(/'/g, "''") + "'");
    for (const X of W.sheets) for (const cell of Object.values(X.cells)) if (cell.v && cell.v[0] === "=") {
      const T = (() => { try { return C().tokenize(cell.v.slice(1)); } catch (e) { return []; } })(); let out = "", last = 0; const body = cell.v.slice(1);
      for (const t of T) if (t.t === "ref" && t.sheet != null && t.sheet.toLowerCase() === old.toLowerCase()) { out += body.slice(last, t.at) + q(name) + "!" + t.v; last = t.at + t.len; }
      if (last) cell.v = "=" + out + body.slice(last);
    }
    W.sheets[i].name = name; St.book = null; tabs(); changed();
  }

  /* ---------------------------------------------------------------- 2.824.0 charts */
  const chartOf = (id) => (sh().charts || []).find((c) => c.id === id);
  function insertChart(type) {
    if (guardSheet()) return;
    const s = norm(St.sel), R = s.r1 === s.r2 && s.c1 === s.c2 ? tableRange() : s;
    if (!R) return msg("select the numbers to chart (with their headings) first", true);
    const G = St.geo || geometry(), S = sh(), list = S.charts || (S.charts = []);
    let n = list.length + 1; while (list.some((c) => c.id === "c" + n)) n++;
    step();
    const ch = { id: "c" + n, type: type || "column", title: "", range: A(R.c1, R.r1) + ":" + A(R.c2, R.r2), x: G.colX[Math.min(R.c2 + 1, G.nC - 1)] + 12, y: G.rowY[R.r1], w: 440, h: 270, legend: true };
    const head = book().get(W.active, R.c1 + (R.c2 > R.c1 ? 1 : 0), R.r1); if (typeof head === "string" && R.c2 === R.c1 + 1) ch.title = head;
    list.push(ch); St.chart = ch.id; changed();
    msg("📊 a chart of " + ch.range + " - drag it, size it by its corner, double-click to change it");
  }
  const CHART_NAMES = { column: "Column chart", bar: "Bar chart", line: "Line chart", area: "Area chart", pie: "Pie chart", doughnut: "Doughnut chart", scatter: "Scatter chart" };
  function chartMenu(btn) {
    const r = btn.getBoundingClientRect(), names = { column: "▮ Column chart", bar: "▬ Bar chart", line: "⟋ Line chart", area: "◭ Area chart", pie: "◔ Pie chart", doughnut: "◎ Doughnut chart", scatter: "⁘ Scatter chart" };
    const m = menu(r.left, r.bottom + 2, Object.keys(names).map((t) => `<div data-t="${t}">${names[t]}</div>`).join(""));
    m.addEventListener("click", (e) => { const t = e.target.closest("[data-t]"); if (!t) return; m.remove(); insertChart(t.dataset.t); });
  }
  function editChart(id, x, y) {
    const ch = chartOf(id); if (!ch || guardSheet()) return;
    const types = ["column", "bar", "line", "area", "pie", "doughnut", "scatter"];
    const m = menu(x, y, `<div style="padding:6px 10px;cursor:default;display:grid;grid-template-columns:auto 1fr;gap:5px 8px;align-items:center" data-noclick="1">
      <span>Title</span><input type="text" id="chT" value="${esc(ch.title)}" style="width:200px">
      <span>Type</span><select id="chY">${types.map((t) => `<option value="${t}"${t === ch.type ? " selected" : ""}>${CHART_NAMES[t]}</option>`).join("")}</select>
      <span>Cells</span><input type="text" id="chR" value="${esc(ch.range)}" style="width:110px;font-family:monospace">
      <span></span><label><input type="checkbox" id="chL"${ch.legend !== false ? " checked" : ""}> Legend</label></div><hr><div data-a="del">🗑 Delete the chart</div>`);
    m.addEventListener("keydown", (e) => e.stopPropagation());
    let stepped = false;
    const upd = (fn) => { if (!stepped) { step(); stepped = true; } fn(); changed(); };
    m.querySelector("#chT").addEventListener("input", (e) => upd(() => { ch.title = e.target.value.slice(0, 120); }));
    m.querySelector("#chY").addEventListener("change", (e) => upd(() => { ch.type = e.target.value; }));
    m.querySelector("#chR").addEventListener("change", (e) => { const v = e.target.value.trim().toUpperCase(); if (!root.SheetChart.parseRange(v)) return msg("not a range - like A1:C9", true); upd(() => { ch.range = v; }); });
    m.querySelector("#chL").addEventListener("change", (e) => upd(() => { ch.legend = e.target.checked; }));
    m.addEventListener("click", (e) => { if (e.target.closest('[data-a="del"]')) { m.remove(); removeChart(id); } });
  }
  function removeChart(id) { if (guardSheet()) return; step(); sh().charts = (sh().charts || []).filter((c) => c.id !== id); St.chart = null; changed(); msg("chart deleted"); }

  /* ---------------------------------------------------------------- files */
  async function api(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) throw new Error((j && j.error) || "HTTP " + r.status);
    return j || {};
  }
  async function save() {
    const name = ($("shFile").value || "Workbook").trim();
    try { const r = await api("POST", "/api/sheets/file", { name, doc: { sheets: W.sheets, active: W.active } }); W.name = r.name.replace(/\.bgs$/i, ""); $("shFile").value = W.name; St.dirty = false; draft(); msg("💾 saved " + r.name); }
    catch (e) { msg("✗ " + e.message, true); }
  }
  async function okToLeave() { return !St.dirty || typeof root.appConfirm !== "function" || await root.appConfirm(`"${W.name}" has changes that are not saved. Leave it?`, "Not saved"); }
  function upgradeSheets(list) {   // 2.822.0 kept a format as a name + s.dp - now a code
    if (!F()) return list;
    for (const S of list) for (const cell of Object.values(S.cells || {})) if (cell.f && ["number", "currency", "percent", "date", "text"].includes(cell.f)) { cell.f = F().upgrade(cell.f, cell.s && cell.s.dp); if (cell.s) { delete cell.s.dp; if (!Object.keys(cell.s).length) delete cell.s; } }
    return list;
  }
  function load(d, name) {
    W.sheets = upgradeSheets(d.sheets.map((s) => Object.assign(newSheet(s.name), s, { freeze: s.freeze || { r: 0, c: 0 }, merges: s.merges || [] })));
    W.active = Math.min(d.active || 0, W.sheets.length - 1); W.name = name || "Workbook"; $("shFile").value = W.name;
    St.book = null; St.undo = []; St.redo = []; St.dirty = false; St.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; St.act = { r: 0, c: 0 };
    const g = $("shGrid"); if (g) { g.scrollLeft = 0; g.scrollTop = 0; }
    tabs(); book().recalc(); draft(); paint();
  }
  async function openMenu(btn) {
    let files = []; try { files = (await api("GET", "/api/sheets")).files || []; } catch (e) { return msg("✗ " + e.message, true); }
    const r = btn.getBoundingClientRect();
    const m = menu(r.left, r.bottom + 2, files.length ? files.map((f) => `<div data-f="${esc(f.name)}" data-noi18n>▦ ${esc(f.name.replace(/\.bgs$/i, ""))} <span style="color:var(--dim)">${new Date(f.mtime).toLocaleString()}</span></div>`).join("") : `<div style="color:var(--dim)">no workbooks in this project yet - 💾 Save one</div>`);
    m.addEventListener("click", async (e) => {
      const it = e.target.closest("[data-f]"); if (!it) return; m.remove();
      if (!(await okToLeave())) return;
      try { const d = await api("GET", "/api/sheets/file?name=" + encodeURIComponent(it.dataset.f)); load(d, it.dataset.f.replace(/\.bgs$/i, "")); msg("📂 " + it.dataset.f); } catch (er) { msg("✗ " + er.message, true); }
    });
  }

  /* ---------------------------------------------------------------- wiring */
  function onGridDown(e) {
    const g = $("shGrid"), pr = $("shPane").getBoundingClientRect(), x = e.clientX - pr.left, y = e.clientY - pr.top, G = St.geo || geometry();
    const chEl = e.target.closest(".ch");
    if (chEl) {
      e.preventDefault(); if (St.edit) commit();
      const id = chEl.dataset.ch, ch = chartOf(id); St.chart = id; g.focus({ preventScroll: true });
      if (ch && !sh().protect) St.drag = { kind: e.target.dataset.chr != null ? "chartsize" : "chart", id, x0: e.clientX, y0: e.clientY, o: { x: ch.x, y: ch.y, w: ch.w, h: ch.h }, snap: snapshot(), moved: false };
      paint(); return;
    }
    if (St.chart) { St.chart = null; }
    if (e.target.closest(".ft")) { e.preventDefault(); const fr = e.target.getBoundingClientRect(); filterMenu(+e.target.dataset.ft, { x: fr.left, y: fr.bottom + 2 }); return; }
    if (e.target.dataset.rc != null) { e.preventDefault(); St.drag = { kind: "colw", c: +e.target.dataset.rc, x0: e.clientX, w0: G.colX[+e.target.dataset.rc + 1] - G.colX[+e.target.dataset.rc] }; return; }
    if (e.target.dataset.rr != null) { e.preventDefault(); St.drag = { kind: "rowh", r: +e.target.dataset.rr, y0: e.clientY, h0: G.rowY[+e.target.dataset.rr + 1] - G.rowY[+e.target.dataset.rr] }; return; }
    if (e.target.id === "shFillH") { e.preventDefault(); St.drag = { kind: "fill", from: norm(St.sel), to: null }; return; }
    if (e.button === 2) { const h = hit(G, x, y); const s = norm(St.sel); if (h.r >= 0 && h.c >= 0 && !(h.r >= s.r1 && h.r <= s.r2 && h.c >= s.c1 && h.c <= s.c2)) go(h.c, h.r); return; }
    if (e.target.dataset.all) { St.sel = { r1: 0, c1: 0, r2: Math.max(0, used().r), c2: Math.max(0, used().c) }; paint(); return; }
    const h = hit(G, x, y);
    // typing a formula: a click puts the cell's address in
    const tf = typingFormula();
    if (tf && h.r >= 0 && h.c >= 0) { e.preventDefault(); const p = tf.selectionStart, ref = A(h.c, h.r); tf.value = tf.value.slice(0, p) + ref + tf.value.slice(tf.selectionEnd); tf.setSelectionRange(p + ref.length, p + ref.length); St.drag = { kind: "ref", el: tf, p, c: h.c, r: h.r }; $("shFormula").value = tf.value; tf.focus(); return; }
    if (St.edit) commit();
    if (h.c < 0 && h.r >= 0) { St.sel = { r1: e.shiftKey ? St.sel.r1 : h.r, c1: 0, r2: h.r, c2: G.nC - 1 }; if (!e.shiftKey) St.act = { r: h.r, c: 0 }; St.drag = { kind: "rows" }; paint(); return; }
    if (h.r < 0 && h.c >= 0) { St.sel = { r1: 0, c1: e.shiftKey ? St.sel.c1 : h.c, r2: Math.max(G.nR - 1, 0), c2: h.c }; if (!e.shiftKey) St.act = { r: 0, c: h.c }; St.drag = { kind: "cols" }; paint(); return; }
    if (h.r < 0 || h.c < 0) return;
    if (e.shiftKey) go(h.c, h.r, true); else go(h.c, h.r);
    St.drag = { kind: "sel" };
    g.focus({ preventScroll: true });
  }
  function onMove(e) {
    const d = St.drag; if (!d) return;
    const G = St.geo || geometry(), pr = $("shPane").getBoundingClientRect(), h = hit(G, e.clientX - pr.left, e.clientY - pr.top);
    if (d.kind === "chart" || d.kind === "chartsize") {
      const ch = chartOf(d.id); if (!ch) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0; if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!d.moved) { St.undo.push(d.snap); if (St.undo.length > 80) St.undo.shift(); St.redo = []; d.moved = true; }
      if (d.kind === "chart") { ch.x = Math.max(0, Math.round(d.o.x + dx)); ch.y = Math.max(0, Math.round(d.o.y + dy)); }
      else { ch.w = Math.max(120, Math.round(d.o.w + dx)); ch.h = Math.max(90, Math.round(d.o.h + dy)); }
      paintSoon(); return;
    }
    if (d.kind === "colw") { sh().cols[d.c] = Math.max(24, Math.round(d.w0 + e.clientX - d.x0)); paintSoon(); return; }
    if (d.kind === "rowh") { sh().rows[d.r] = Math.max(14, Math.round(d.h0 + e.clientY - d.y0)); paintSoon(); return; }
    if (d.kind === "ref") { if (h.r < 0 || h.c < 0) return; const t = d.el, a = A(d.c, d.r), b = A(Math.max(0, h.c), Math.max(0, h.r)), txt = a === b ? a : C().addr(Math.min(d.c, h.c), Math.min(d.r, h.r)) + ":" + C().addr(Math.max(d.c, h.c), Math.max(d.r, h.r)); const end = t.selectionStart; t.value = t.value.slice(0, d.p) + txt + t.value.slice(end); t.setSelectionRange(d.p + txt.length, d.p + txt.length); $("shFormula").value = t.value; return; }
    if (d.kind === "sel" && h.r >= 0 && h.c >= 0) { St.sel = Object.assign({}, St.sel, { r2: h.r, c2: h.c }); paintSoon(); return; }
    if (d.kind === "rows" && h.r >= 0) { St.sel.r2 = h.r; paintSoon(); return; }
    if (d.kind === "cols" && h.c >= 0) { St.sel.c2 = h.c; paintSoon(); return; }
    if (d.kind === "fill" && h.r >= 0 && h.c >= 0) {
      const s = d.from, dr = h.r > s.r2 ? h.r - s.r2 : h.r < s.r1 ? h.r - s.r1 : 0, dc = h.c > s.c2 ? h.c - s.c2 : h.c < s.c1 ? h.c - s.c1 : 0;
      if (!dr && !dc) d.to = null; else if (Math.abs(dr) >= Math.abs(dc)) d.to = dr > 0 ? { r1: s.r1, c1: s.c1, r2: h.r, c2: s.c2 } : { r1: h.r, c1: s.c1, r2: s.r2, c2: s.c2 }; else d.to = dc > 0 ? { r1: s.r1, c1: s.c1, r2: s.r2, c2: h.c } : { r1: s.r1, c1: h.c, r2: s.r2, c2: s.c2 };
      paintSoon();
    }
  }
  function onUp() {
    const d = St.drag; St.drag = null; if (!d) return;
    if (d.kind === "colw" || d.kind === "rowh" || ((d.kind === "chart" || d.kind === "chartsize") && d.moved)) { St.dirty = true; draft(); }
    if (d.kind === "fill" && d.to) fill(d.from, d.to); else if (d.kind === "fill") paint();
    if (d.kind === "sel" || d.kind === "rows" || d.kind === "cols") status();
  }
  function onKey(e) {
    if (St.edit || e.target !== $("shGrid")) return;
    if (!(e.ctrlKey || e.metaKey) || /^[zysabiu1eZYSABIUE]$/.test(e.key)) e.stopPropagation();   // the app's own keys (Space, Delete, digits …) stay out of the cells
    const k = e.key, ctl = e.ctrlKey || e.metaKey, { c, r } = St.act;
    if (St.chart && !ctl) {                          // a picked chart: Delete removes it, Esc lets it go, arrows nudge it
      const ch = chartOf(St.chart);
      if (k === "Delete" || k === "Backspace") { e.preventDefault(); return removeChart(St.chart); }
      if (k === "Escape") { St.chart = null; return paint(); }
      if (ch && /^Arrow/.test(k)) { e.preventDefault(); if (guardSheet()) return; step(); const d = e.shiftKey ? 10 : 1; if (k === "ArrowLeft") ch.x = Math.max(0, ch.x - d); if (k === "ArrowRight") ch.x += d; if (k === "ArrowUp") ch.y = Math.max(0, ch.y - d); if (k === "ArrowDown") ch.y += d; return changed(); }
      St.chart = null;
    }
    const move = (dc, dr) => { e.preventDefault(); if (e.shiftKey) { const s = St.sel; go(s.c2 + dc, s.r2 + dr, true); } else go(c + dc, r + dr); };
    if (ctl && (k === "z" || k === "Z")) { e.preventDefault(); undo(e.shiftKey); return; }
    if (ctl && (k === "y" || k === "Y")) { e.preventDefault(); undo(true); return; }
    if (ctl && (k === "s" || k === "S")) { e.preventDefault(); save(); return; }
    if (ctl && (k === "a" || k === "A")) { e.preventDefault(); St.sel = { r1: 0, c1: 0, r2: Math.max(0, used().r), c2: Math.max(0, used().c) }; paint(); return; }
    if (ctl && /^[biu]$/i.test(k)) { e.preventDefault(); toggleStyle(k.toLowerCase()); return; }
    if (ctl && k === "1") { e.preventDefault(); openFormat(); return; }
    if (ctl && (k === "e" || k === "E") && !e.shiftKey && !e.altKey) { e.preventDefault(); if (root.H3SheetAI) root.H3SheetAI.fillFromExamples(); return; }   // 2.825.0 🪄
    if (ctl && /^Arrow/.test(k)) {                    // Ctrl + arrow: to the end of the data that way (or the next data after a gap)
      e.preventDefault();
      const dc = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0, dr = k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0, u = used();
      const full = (cc, rr) => { const x = cellAt(cc, rr); return !!x && x.v != null && x.v !== ""; };
      const s = St.sel, from = e.shiftKey ? { c: s.c2, r: s.r2 } : { c, r }, lim = { c: Math.max(u.c, from.c) + 1, r: Math.max(u.r, from.r) + 1 };
      let cc = from.c, rr = from.r;
      const nxt = () => { cc += dc; rr += dr; return cc >= 0 && rr >= 0 && cc <= lim.c && rr <= lim.r; };
      if (full(cc, rr) && full(cc + dc, rr + dr)) { while (nxt() && full(cc + dc, rr + dr)); }
      else { while (nxt() && !full(cc, rr)); }
      cc = Math.max(0, Math.min(cc, lim.c)); rr = Math.max(0, Math.min(rr, lim.r));
      return e.shiftKey ? go(cc, rr, true) : go(cc, rr);
    }
    if (ctl) return;                                   // Ctrl+C / X / V: the copy / cut / paste events
    switch (k) {
      case "ArrowDown": return move(0, 1);
      case "ArrowUp": return move(0, -1);
      case "ArrowRight": return move(1, 0);
      case "ArrowLeft": return move(-1, 0);
      case "Enter": e.preventDefault(); return go(c, r + (e.shiftKey ? -1 : 1));
      case "Tab": e.preventDefault(); return go(c + (e.shiftKey ? -1 : 1), r);
      case "Home": e.preventDefault(); return go(0, r);
      case "PageDown": e.preventDefault(); return go(c, r + 20);
      case "PageUp": e.preventDefault(); return go(c, r - 20);
      case "F2": e.preventDefault(); return startEdit();
      case "Delete": case "Backspace": e.preventDefault(); return clear(false);
      case "Escape": if (St.clip) { St.clip = null; paint(); } return;
    }
    if (k.length === 1 && !e.altKey) { e.preventDefault(); startEdit(k); }
  }
  function toggleStyle(key) { if (guardSheet()) return; const on = !style(St.act.c, St.act.r)[key]; step(); eachSel((c, r) => setStyle(c, r, (S) => { S[key] = on || null; })); changed(); }
  function styleAll(fn) { if (guardSheet()) return; step(); eachSel((c, r) => setStyle(c, r, fn)); changed(); }

  function wire() {
    const d = $("sheetdock"); if (!d) return;
    try { if (root.localStorage.getItem("h3.g.sheetdock") == null) { root.localStorage.setItem("h3.g.sheetdock", "1"); d.classList.add("dockgone"); } } catch (e) { /* fine */ }
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    on("shCloseBtn", "click", (e) => { e.stopPropagation(); if (typeof root.toggleDockGone === "function") root.toggleDockGone("sheetdock", "tX_sheetdock"); });
    const g = $("shGrid");
    g.addEventListener("scroll", paintSoon);
    g.addEventListener("pointerdown", onGridDown);
    g.addEventListener("dblclick", (e) => { const ch = e.target.closest(".ch"); if (ch) { St.drag = null; editChart(ch.dataset.ch, e.clientX, e.clientY); return; } if (e.target.closest(".c")) startEdit(); });
    g.addEventListener("contextmenu", (e) => { e.preventDefault(); if (e.target.closest("#shPane")) cellMenu(e.clientX, e.clientY); });
    g.addEventListener("keydown", onKey);
    g.addEventListener("copy", (e) => { if (St.edit) return; e.preventDefault(); e.clipboardData.setData("text/plain", copy(false)); });
    g.addEventListener("cut", (e) => { if (St.edit) return; e.preventDefault(); e.clipboardData.setData("text/plain", copy(true)); });
    g.addEventListener("paste", (e) => { if (St.edit) return; e.preventDefault(); paste(e.clipboardData.getData("text/plain")); });
    doc.addEventListener("pointermove", onMove); doc.addEventListener("pointerup", onUp);
    if (root.ResizeObserver) new root.ResizeObserver(paintSoon).observe(g);
    on("shFormula", "focus", () => { if (!St.edit) startEdit(null, "fx"); });
    on("shFormula", "keydown", (e) => { if (!St.edit) startEdit(null, "fx"); if (e.key === "Enter") { e.preventDefault(); commit(0, 1); } else if (e.key === "Escape") { e.preventDefault(); $("shFormula").value = St.edit ? St.edit.orig : ""; cancel(); } else if (e.key === "Tab") { e.preventDefault(); commit(1, 0); } });
    on("shFormula", "input", () => { const ed = EDIT; if (ed && St.edit && St.edit.from !== "fx") ed.value = $("shFormula").value; });
    on("shName", "keydown", (e) => { if (e.key !== "Enter") return; e.preventDefault(); const v = $("shName").value.trim().toUpperCase(), [a, b] = v.split(":"), p = C().parseAddr(a), q = b ? C().parseAddr(b) : null; if (!p) return msg("not a cell address", true); go(p.c, p.r); if (q) { St.sel = { r1: p.r, c1: p.c, r2: q.r, c2: q.c }; paint(); } g.focus(); });
    on("shTabs", "click", (e) => { const t = e.target.closest(".tab"); if (t) { if (St.edit) commit(); W.active = +t.dataset.i; St.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; St.act = { r: 0, c: 0 }; g.scrollLeft = 0; g.scrollTop = 0; tabs(); paint(); return; } if (e.target.closest("#shAddSheet")) { step(); W.sheets.push(newSheet(uniqueName("Sheet" + (W.sheets.length + 1)))); W.active = W.sheets.length - 1; tabs(); changed(); } });
    on("shTabs", "dblclick", (e) => { const t = e.target.closest(".tab"); if (t) renameSheet(+t.dataset.i); });
    on("shTabs", "contextmenu", (e) => { const t = e.target.closest(".tab"); if (t) { e.preventDefault(); tabMenu(+t.dataset.i, e.clientX, e.clientY); } });
    on("shNew", "click", async () => { if (!(await okToLeave())) return; load({ sheets: [newSheet("Sheet1")], active: 0 }, "Workbook"); msg("📄 a new workbook"); });
    on("shOpen", "click", (e) => openMenu(e.currentTarget));
    on("shSave", "click", save);
    on("shFile", "keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") save(); });
    on("shUndo", "click", () => undo(false)); on("shRedo", "click", () => undo(true));
    on("shFmt", "change", (e) => { const v = e.target.value; if (v === "Custom" || v === "__more") { bars(); openFormat("number"); return; } setCode(QUICK[v] || "General"); });
    on("shDecLess", "click", () => decimalsBy(-1));
    on("shDecMore", "click", () => decimalsBy(1));
    on("shFmtCells", "click", () => openFormat());
    on("shImport", "click", () => root.H3SheetIO && root.H3SheetIO.pick());
    on("shExport", "click", (e) => root.H3SheetIO && root.H3SheetIO.exportMenu(e.currentTarget));
    on("shChart", "click", (e) => chartMenu(e.currentTarget));
    on("shDash", "click", () => root.H3SheetDash && root.H3SheetDash.open());
    on("shAi", "click", (e) => root.H3SheetAI && root.H3SheetAI.aiMenu(e.currentTarget));     // 2.825.0
    on("shB", "click", () => toggleStyle("b")); on("shI", "click", () => toggleStyle("i")); on("shU", "click", () => toggleStyle("u"));
    on("shColor", "change", (e) => styleAll((S) => { S.color = e.target.value; }));
    on("shBg", "change", (e) => styleAll((S) => { S.bg = e.target.value; }));
    on("shNoBg", "click", () => styleAll((S) => { S.bg = null; S.pat = null; S.grad = null; }));
    for (const [id, a] of [["shAL", "left"], ["shAC", "center"], ["shAR", "right"]]) on(id, "click", () => { const same = style(St.act.c, St.act.r).align === a; styleAll((S) => { S.align = same ? null : a; }); });
    on("shWrap", "click", () => toggleStyle("wrap"));
    on("shBorder", "click", (e) => { const r = e.currentTarget.getBoundingClientRect(), m = menu(r.left, r.bottom + 2, `<div data-b="all">▦ All borders</div><div data-b="outside">▢ Outside borders</div><div data-b="bottom">▁ Bottom border</div><div data-b="none">✕ No borders</div>`); m.addEventListener("click", (ev) => { const b = (ev.target.closest("[data-b]") || {}).dataset; if (b && b.b) { m.remove(); borders(b.b); } }); });
    on("shMerge", "click", merge);
    on("shSortA", "click", () => sort(false)); on("shSortZ", "click", () => sort(true));
    on("shFilter", "click", toggleFilter); on("shFreeze", "click", toggleFreeze);
    on("shSum", "click", autoSum);
    on("shFn", "click", (e) => { const r = e.currentTarget.getBoundingClientRect(), m = menu(r.left, r.bottom + 2, C().FUNCS.map((f) => `<div data-fn="${f}" data-noi18n>${f}</div>`).join("")); m.addEventListener("click", (ev) => { const it = ev.target.closest("[data-fn]"); if (!it) return; m.remove(); if (St.edit && St.edit.from !== "fx") { const ed = EDIT; ed.value += it.dataset.fn + "("; ed.focus(); } else startEdit("=" + it.dataset.fn + "("); }); });
    // the draft kept in this browser comes back
    try { const dr = JSON.parse(root.localStorage.getItem("h3.sheet.draft") || "null"); if (dr && Array.isArray(dr.sheets) && dr.sheets.length) { W.sheets = upgradeSheets(dr.sheets); W.active = Math.min(dr.active || 0, dr.sheets.length - 1); W.name = dr.name || "Workbook"; $("shFile").value = W.name; } } catch (e) { /* a fresh workbook */ }
    const boot = () => { if (St.booted) return; St.booted = true; tabs(); paint(); };
    const seen = () => !d.classList.contains("dockgone") && !d.classList.contains("collapsed");
    if (root.MutationObserver) new MutationObserver(() => { if (seen()) { boot(); paintSoon(); } }).observe(d, { attributes: true, attributeFilter: ["class"] });
    if (seen()) boot();
  }
  root.H3Sheet = { W, St, paint, go, startEdit, commit, setRaw, copy, paste, fill, sort, toggleFilter, toggleFreeze, merge, borders, autoSum, shiftCells, save, load, undo, book, shown, renameSheet, setCode, decimalsBy, openFormat,
    // 2.823.0: for the Format Cells dialog (sheetfmtdlg.js)
    _: { sh, cellAt, style, setStyle, eachSel, norm, step, changed, codeOf, guardSheet, msg, measure, fontOf, okColor, okFont, BSTYLE, PATTERNS, patternUrl, autoInk, fillCss, sideOf, sideCss, DH, DW, tabs, menu } ,
    insertChart, removeChart, editChart };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else setTimeout(wire, 0);
})(window);
