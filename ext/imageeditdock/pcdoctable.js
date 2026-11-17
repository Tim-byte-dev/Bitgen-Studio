/* pcdoctable.js — TABLES IN DOCUMENT TEXT (2.812.0), window.PCDocTable.
 *
 * Tim (verbatim): "go with the next part please" - the WORD PLAN's step 2 (HANDOVER "## 2.811.0"): tables in the
 * word-processor frames (pcdoctext.js).
 *
 *   INSERT      ▦ Table ▾ on the Document Text tool's bar ▸ Insert Table… (rows, columns, a header row) - at the caret, the
 *               full width of the frame, even columns (a <colgroup>; table-layout fixed so every page draws it the same).
 *   ROWS / COLS Insert Row Above / Below, Insert Column Left / Right, Delete Row / Column / Table - spans (merged cells)
 *               are grown or shrunk instead of cut.
 *   CELLS       Merge Cells (the cells the selection touches, when they make a rectangle), Split Cell (back to single
 *               cells), Shading…, vertical alignment Top / Middle / Bottom; text alignment = the bar's align buttons.
 *   BORDERS     All Borders / Outside Border / No Borders, and their colour (Shading… dialog).
 *   HEADER ROW  ☑ Header Row: the first row becomes the table's header (<thead>, bold on grey) and is repeated at the top
 *               of every later frame / page the table runs on (pcdoctext.js measure() heads + windows()).
 *   WIDTHS      drag a column's right edge in the frame while typing (the column and the next one share the change).
 *   RIGHT-CLICK in a table cell while typing = the table menu.
 *
 * Pure (Node + jsdom: scripts/test-doctable812.js): tableHtml, grid, cellPos, insertRow, insertCol, deleteRow, deleteCol,
 * mergeCells, splitCell, setHeader, colWidths, setColWidths, setBorders.
 */
(function (root) {
  "use strict";
  /* ================================ pure (on a DOM table) ================================ */
  const span = (c, a) => Math.max(1, +c.getAttribute(a) || 1);
  /** a new table's HTML: rows x cols, even widths, a header row when asked */
  function tableHtml(rows, cols, header) {
    const r = Math.max(1, Math.min(200, rows | 0)), c = Math.max(1, Math.min(30, cols | 0)), w = (100 / c).toFixed(3).replace(/\.?0+$/, "");
    const cell = (tag) => `<${tag}><br></${tag}>`, row = (tag) => `<tr>${Array.from({ length: c }, () => cell(tag)).join("")}</tr>`;
    return `<table style="width:100%;table-layout:fixed"><colgroup>${Array.from({ length: c }, () => `<col style="width:${w}%">`).join("")}</colgroup>`
      + (header ? `<thead>${row("th")}</thead>` : "") + `<tbody>${Array.from({ length: header ? Math.max(1, r - 1) : r }, () => row("td")).join("")}</tbody></table>`;
  }
  const rowsOf = (t) => [...t.rows];
  /** the table as a grid: g[r][c] = the cell covering it (spans filled in) */
  function grid(t) {
    const rows = rowsOf(t), g = rows.map(() => []);
    rows.forEach((tr, r) => {
      let c = 0;
      for (const cell of tr.cells) {
        while (g[r][c]) c++;
        const rs = span(cell, "rowspan"), cs = span(cell, "colspan");
        for (let i = 0; i < rs && r + i < rows.length; i++) for (let j = 0; j < cs; j++) g[r + i][c + j] = cell;
        c += cs;
      }
    });
    return g;
  }
  const width = (g) => g.reduce((m, r) => Math.max(m, r.length), 0);
  /** where a cell starts in the grid: {r, c, rs, cs} */
  function cellPos(t, cell) {
    const g = grid(t);
    for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === cell) return { r, c, rs: span(cell, "rowspan"), cs: span(cell, "colspan") };
    return null;
  }
  const newCell = (d, tag) => { const e = d.createElement(tag || "td"); e.appendChild(d.createElement("br")); return e; };
  /** put a cell into row r at grid column c (before the first cell that starts after it) */
  function placeCell(t, g, r, c, cell) {
    const tr = rowsOf(t)[r]; let before = null;
    for (const x of tr.cells) { const p = g[r].indexOf(x); if (p > c) { before = x; break; } }
    tr.insertBefore(cell, before);
  }
  function insertRow(t, r, below) {
    const d = t.ownerDocument, g = grid(t), rows = rowsOf(t), at = below ? r + 1 : r, ref = rows[r];
    const tr = d.createElement("tr"), W = width(g), done = new Set();
    for (let c = 0; c < W; c++) {
      const above = at > 0 ? g[at - 1] && g[at - 1][c] : null, here = g[at] && g[at][c];
      if (above && here && above === here) { if (!done.has(above)) { above.setAttribute("rowspan", String(span(above, "rowspan") + 1)); done.add(above); } continue; }
      const tag = ref && ref.parentElement && ref.parentElement.tagName === "THEAD" && !below ? "th" : "td";
      tr.appendChild(newCell(d, below && ref.parentElement.tagName === "THEAD" ? "td" : tag));
    }
    if (below && ref.parentElement.tagName === "THEAD") { const tb = t.tBodies[0] || t.appendChild(d.createElement("tbody")); tb.insertBefore(tr, tb.firstChild); }
    else ref.parentElement.insertBefore(tr, below ? ref.nextSibling : ref);
    return tr;
  }
  function insertCol(t, c, right) {
    const d = t.ownerDocument, g = grid(t), at = right ? c + 1 : c, done = new Set();
    g.forEach((row, r) => {
      const left = at > 0 ? row[at - 1] : null, here = row[at];
      if (left && here && left === here) { if (!done.has(left)) { left.setAttribute("colspan", String(span(left, "colspan") + 1)); done.add(left); } return; }
      if (here && done.has(here)) return;
      const first = rowsOf(t)[r], isTh = first.parentElement.tagName === "THEAD";
      const cell = newCell(d, isTh ? "th" : "td");
      const tr = rowsOf(t)[r]; let before = null;
      for (const x of tr.cells) { if (g[r].indexOf(x) >= at) { before = x; break; } }
      // a cell that starts above and covers this row: the new one goes after the cells left of it
      tr.insertBefore(cell, before);
    });
    const cg = t.querySelector("colgroup");
    if (cg) { const cols = [...cg.children], n = cols.length + 1, w = (100 / n).toFixed(3).replace(/\.?0+$/, ""); const col = d.createElement("col"); cg.insertBefore(col, cols[at] || null); for (const x of cg.children) x.style.width = w + "%"; }
  }
  function deleteRow(t, r) {
    const g = grid(t), rows = rowsOf(t), tr = rows[r]; if (!tr) return;
    if (rows.length === 1) { t.remove(); return; }
    const W = width(g), seen = new Set();
    for (let c = 0; c < W; c++) {
      const cell = g[r][c]; if (!cell || seen.has(cell)) continue; seen.add(cell);
      const p = cellPos(t, cell), rs = span(cell, "rowspan");
      if (rs > 1) {
        if (p.r === r) { const nx = rows[r + 1]; cell.setAttribute("rowspan", String(rs - 1)); if (rs - 1 === 1) cell.removeAttribute("rowspan"); const g2 = grid(t); tr.removeChild(cell); let before = null; for (const x of nx.cells) if (g2[r + 1].indexOf(x) > p.c) { before = x; break; } nx.insertBefore(cell, before); }
        else { cell.setAttribute("rowspan", String(rs - 1)); if (rs - 1 === 1) cell.removeAttribute("rowspan"); }
      }
    }
    tr.remove();
    for (const s of [t.tHead, ...t.tBodies]) if (s && !s.rows.length) s.remove();
  }
  function deleteCol(t, c) {
    const g = grid(t), W = width(g); if (!W) return;
    if (W === 1) { t.remove(); return; }
    const seen = new Set();
    for (const row of g) { const cell = row[c]; if (!cell || seen.has(cell)) continue; seen.add(cell); const cs = span(cell, "colspan"); if (cs > 1) { if (cs - 1 === 1) cell.removeAttribute("colspan"); else cell.setAttribute("colspan", String(cs - 1)); } else cell.remove(); }
    const cg = t.querySelector("colgroup");
    if (cg && cg.children[c]) { const ws = colWidths(t); cg.children[c].remove(); ws.splice(c, 1); setColWidths(t, ws); }
  }
  /** the cells merge into the top-left one when they cover a rectangle exactly. -> the cell or null */
  function mergeCells(t, cells) {
    const list = [...new Set(cells)].filter(Boolean); if (list.length < 2) return null;
    const g = grid(t), ps = list.map((x) => cellPos(t, x));
    const r0 = Math.min(...ps.map((p) => p.r)), c0 = Math.min(...ps.map((p) => p.c)), r1 = Math.max(...ps.map((p) => p.r + p.rs - 1)), c1 = Math.max(...ps.map((p) => p.c + p.cs - 1));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!list.includes(g[r][c])) return null;
    const keep = g[r0][c0];
    for (const x of list) {
      if (x === keep) continue;
      if (x.textContent.trim()) { if (!keep.textContent.trim()) keep.innerHTML = ""; else keep.appendChild(t.ownerDocument.createElement("br")); while (x.firstChild) keep.appendChild(x.firstChild); }
      x.remove();
    }
    const rs = r1 - r0 + 1, cs = c1 - c0 + 1;
    if (rs > 1) keep.setAttribute("rowspan", String(rs)); else keep.removeAttribute("rowspan");
    if (cs > 1) keep.setAttribute("colspan", String(cs)); else keep.removeAttribute("colspan");
    return keep;
  }
  function splitCell(t, cell) {
    const p = cellPos(t, cell); if (!p || (p.rs === 1 && p.cs === 1)) return false;
    const d = t.ownerDocument, tag = cell.tagName.toLowerCase();
    cell.removeAttribute("rowspan"); cell.removeAttribute("colspan");
    for (let r = p.r; r < p.r + p.rs; r++) for (let c = p.c; c < p.c + p.cs; c++) { if (r === p.r && c === p.c) continue; const g = grid(t); placeCell(t, g, r, c, newCell(d, tag)); }
    return true;
  }
  /** the first row as the header (thead, th) or back in the body */
  function setHeader(t, on) {
    const d = t.ownerDocument;
    if (on) {
      if (t.tHead && t.tHead.rows.length) return;
      const first = rowsOf(t)[0]; if (!first) return;
      const th = t.createTHead(); th.appendChild(first);
      for (const c of [...first.cells]) if (c.tagName === "TD") { const n = d.createElement("th"); for (const a of [...c.attributes]) n.setAttribute(a.name, a.value); while (c.firstChild) n.appendChild(c.firstChild); c.replaceWith(n); }
      const cg = t.querySelector("colgroup"); if (cg) t.insertBefore(cg, t.firstChild);
    } else {
      const th = t.tHead; if (!th) return;
      const tb = t.tBodies[0] || t.appendChild(d.createElement("tbody"));
      for (const r of [...th.rows].reverse()) { for (const c of [...r.cells]) if (c.tagName === "TH") { const n = d.createElement("td"); for (const a of [...c.attributes]) n.setAttribute(a.name, a.value); while (c.firstChild) n.appendChild(c.firstChild); c.replaceWith(n); } tb.insertBefore(r, tb.firstChild); }
      th.remove();
    }
  }
  /** the columns' widths (%) from the colgroup (even when there is none) */
  function colWidths(t) {
    const cg = t.querySelector("colgroup"), W = width(grid(t));
    const ws = cg ? [...cg.children].map((c) => parseFloat(c.style.width) || 0) : [];
    if (ws.length !== W || ws.some((v) => !v)) return Array.from({ length: W }, () => 100 / W);
    return ws;
  }
  function setColWidths(t, ws) {
    const d = t.ownerDocument; let cg = t.querySelector("colgroup");
    if (!cg) { cg = d.createElement("colgroup"); t.insertBefore(cg, t.firstChild); }
    while (cg.children.length < ws.length) cg.appendChild(d.createElement("col"));
    while (cg.children.length > ws.length) cg.lastChild.remove();
    const sum = ws.reduce((a, b) => a + b, 0) || 1;
    [...cg.children].forEach((c, i) => { c.style.width = (ws[i] / sum * 100).toFixed(3).replace(/\.?0+$/, "") + "%"; });
    t.style.tableLayout = "fixed"; if (!t.style.width) t.style.width = "100%";
  }
  /** all / outside / none, in a colour */
  function setBorders(t, how, color) {
    const b = `1px solid ${color || "#888888"}`;
    for (const c of t.querySelectorAll("td,th")) { c.style.border = ""; if (how === "all") c.style.border = b; else c.style.borderStyle = "none"; }
    t.style.border = ""; if (how === "outside") t.style.border = b; else if (how === "none") t.style.borderStyle = "none";
  }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, win } = E; if (!E.docText || !E.tools || !E.tools.doctext || !E.ui || !E.ui.addCmd) return;
    const X = E.docText, say = E.say || (() => {}), sep = E.ui.sep;
    const ed = () => X.ed();
    /** the cell the caret (or the kept selection) is in */
    function here() {
      const e = ed(); if (!e) return null;
      const s = doc.getSelection(); let n = s && s.rangeCount && e.contains(s.anchorNode) ? s.anchorNode : null;
      if (!n && savedCell && e.contains(savedCell)) n = savedCell;
      while (n && n !== e && !(n.nodeType === 1 && /^(TD|TH)$/.test(n.tagName))) n = n.parentNode;
      return n && n !== e ? n : null;
    }
    let savedCell = null;
    doc.addEventListener("selectionchange", () => { const e = ed(), s = doc.getSelection(); if (!e || !s || !s.rangeCount || !e.contains(s.anchorNode)) return; let n = s.anchorNode; while (n && n !== e && !(n.nodeType === 1 && /^(TD|TH)$/.test(n.tagName))) n = n.parentNode; const c = n && n !== e ? n : null; if (!!c !== !!savedCell || (c && savedCell && c.closest("table") !== savedCell.closest("table"))) { savedCell = c; if (S.tool === "doctext" && E.renderOptions) E.renderOptions(); } else savedCell = c; });
    /** the cells the selection touches (the caret's own when nothing is selected) */
    function selCells() {
      const c = here(); if (!c) return [];
      const t = c.closest("table"), s = doc.getSelection();
      if (!s || !s.rangeCount || s.isCollapsed) return [c];
      const r = s.getRangeAt(0);
      return [...t.querySelectorAll("td,th")].filter((x) => x.closest("table") === t && r.intersectsNode(x));
    }
    function op(label, fn) {
      if (!ed()) return say("click into a document frame first (the Document Text tool)");
      X.restoreSel();
      const c = here(); if (!c && label !== "insert") return say("put the caret in a table cell first");
      const r = fn(c, c && c.closest("table"));
      X.keepSel(); X.live(); if (E.renderOptions) E.renderOptions();
      if (r && typeof r === "string") say(r);
    }
    const place = (cell) => { if (!cell) return; const s = doc.getSelection(), r = doc.createRange(); r.selectNodeContents(cell); r.collapse(true); s.removeAllRanges(); s.addRange(r); X.keepSel(); };
    /* the commands */
    function insertDialog() {
      if (!ed()) return say("click into a document frame first (the Document Text tool)");
      E.ui.dialog("Insert Table", `<div class="kxrow"><span>Rows</span><input type="number" id="pttR" value="3" min="1" max="200" style="width:70px"></div>
        <div class="kxrow"><span>Columns</span><input type="number" id="pttC" value="3" min="1" max="30" style="width:70px"></div>
        <div class="kxrow"><label><input type="checkbox" id="pttH" checked> Header row (repeated on every page)</label></div>`, (d) => {
        const r = +d.querySelector("#pttR").value || 3, c = +d.querySelector("#pttC").value || 3, h = d.querySelector("#pttH").checked;
        insertTable(r, c, h);
      }, { okLabel: "▦ Insert" });
    }
    function insertTable(r, c, h) {
      if (!ed()) return;
      X.restoreSel();
      if (here()) { const t = here().closest("table"); const s = doc.getSelection(), rg = doc.createRange(); rg.setStartAfter(t); rg.collapse(true); s.removeAllRanges(); s.addRange(rg); }
      const e = ed(), had = new Set(e.querySelectorAll("table"));
      doc.execCommand("insertHTML", false, tableHtml(r, c, h) + "<p><br></p>");
      for (const x of e.querySelectorAll("p > table")) { const p = x.parentElement; p.replaceWith(...p.childNodes); }
      const t = [...e.querySelectorAll("table")].find((x) => !had.has(x));
      if (t && !t.nextElementSibling) t.after(Object.assign(doc.createElement("p"), { innerHTML: "<br>" }));
      const first = t && t.querySelector("th,td");
      if (first) place(first);
      X.live(); if (E.renderOptions) E.renderOptions();
      // the dialog that asked takes the focus with it when it closes - back into the first cell
      setTimeout(() => { const e2 = ed(); if (!e2) return; try { e2.focus({ preventScroll: true }); } catch (er) { e2.focus(); } if (first && e2.contains(first)) place(first); }, 0);
      say(`▦ a ${r} x ${c} table${h ? " with a header row" : ""}`);
    }
    const add = (id, label, fn, more) => E.ui.addCmd(id, label, "", fn, more);
    const inT = () => !!here();
    add("doc.table.insert", "▦ Insert Table…", insertDialog);
    add("doc.table.rowAbove", "Insert Row Above", () => op("row", (c, t) => { const p = cellPos(t, c); const tr = insertRow(t, p.r, false); place(tr.cells[0]); }), { enabled: inT });
    add("doc.table.rowBelow", "Insert Row Below", () => op("row", (c, t) => { const p = cellPos(t, c); const tr = insertRow(t, p.r + p.rs - 1, true); place(tr.cells[0]); }), { enabled: inT });
    add("doc.table.colLeft", "Insert Column Left", () => op("col", (c, t) => { insertCol(t, cellPos(t, c).c, false); }), { enabled: inT });
    add("doc.table.colRight", "Insert Column Right", () => op("col", (c, t) => { const p = cellPos(t, c); insertCol(t, p.c + p.cs - 1, true); }), { enabled: inT });
    add("doc.table.delRow", "Delete Row", () => op("del", (c, t) => { const p = cellPos(t, c); deleteRow(t, p.r); }), { enabled: inT });
    add("doc.table.delCol", "Delete Column", () => op("del", (c, t) => { const p = cellPos(t, c); deleteCol(t, p.c); }), { enabled: inT });
    add("doc.table.delTable", "Delete Table", () => op("del", (c, t) => { const nx = t.nextElementSibling; t.remove(); if (nx) place(nx); }), { enabled: inT });
    add("doc.table.merge", "Merge Cells", () => op("merge", (c, t) => { const cells = selCells(); if (cells.length < 2) return "select the cells to merge (drag across them)"; const k = mergeCells(t, cells); if (!k) return "those cells do not make a rectangle"; place(k); return null; }), { enabled: inT });
    add("doc.table.split", "Split Cell", () => op("split", (c, t) => (splitCell(t, c) ? null : "the cell is not merged")), { enabled: inT });
    add("doc.table.header", "Header Row (repeated on every page)", () => op("head", (c, t) => { setHeader(t, !(t.tHead && t.tHead.rows.length)); }), { enabled: inT, checked: () => { const c = here(), t = c && c.closest("table"); return !!(t && t.tHead && t.tHead.rows.length); } });
    for (const [k, n] of [["all", "All Borders"], ["outside", "Outside Border"], ["none", "No Borders"]]) add("doc.table.border." + k, n, () => op("border", (c, t) => { setBorders(t, k, lastBorder); }), { enabled: inT });
    for (const [k, n] of [["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]]) add("doc.table.valign." + k, "Cell Alignment: " + n, () => op("valign", () => { for (const x of selCells()) x.style.verticalAlign = k; }), { enabled: inT });
    let lastBorder = "#888888";
    add("doc.table.colors", "Shading and Border Colour…", () => {
      if (!here()) return say("put the caret in a table cell first");
      const cells = selCells();
      E.ui.dialog("Shading and Border Colour", `<div class="kxrow"><span>Cell shading</span><input type="color" id="pttS" value="#ffffff"> <label><input type="checkbox" id="pttSN"> none</label></div>
        <div class="kxrow"><span>Border colour</span><input type="color" id="pttB" value="${lastBorder}"></div>`, (d) => {
        const sh = d.querySelector("#pttSN").checked ? "" : d.querySelector("#pttS").value, bc = d.querySelector("#pttB").value;
        lastBorder = bc;
        op("colors", (c, t) => { for (const x of cells) x.style.backgroundColor = sh; for (const x of t.querySelectorAll("td,th")) if (x.style.border && x.style.border !== "none") x.style.borderColor = bc; if (t.style.border && t.style.border !== "none") t.style.borderColor = bc; });
      }, { okLabel: "Apply" });
    }, { enabled: inT });
    const MENU = () => ["doc.table.insert", sep, "doc.table.rowAbove", "doc.table.rowBelow", "doc.table.colLeft", "doc.table.colRight", sep, "doc.table.delRow", "doc.table.delCol", "doc.table.delTable", sep,
      "doc.table.merge", "doc.table.split", "doc.table.header", sep, { label: "Borders", items: ["doc.table.border.all", "doc.table.border.outside", "doc.table.border.none"] },
      { label: "Cell Alignment", items: ["doc.table.valign.top", "doc.table.valign.middle", "doc.table.valign.bottom"] }, "doc.table.colors"];
    E.docTable = { menu: MENU, insertTable, here, selCells };
    // Tab / Shift+Tab in a table: the next / previous cell; Tab in the last cell adds a row (as word processors do)
    X.tab = (back) => {
      const c = here(); if (!c) return false;
      const t = c.closest("table"), cells = [...t.querySelectorAll("td,th")].filter((x) => x.closest("table") === t), i = cells.indexOf(c);
      if (back) { if (i > 0) place(cells[i - 1]); return true; }
      if (i < cells.length - 1) { place(cells[i + 1]); return true; }
      const p = cellPos(t, c), tr = insertRow(t, p.r + p.rs - 1, true); place(tr.cells[0]); X.live(); return true;
    };

    /* the bar: ▦ Table ▾ */
    const T = E.tools.doctext, ob = T.options, bb = T.bindOptions;
    T.options = function () { return ob.call(this).replace('<span class="sep"></span><label title="Frame width', `<button class="ghost" id="pttMenu" title="Tables: insert, rows, columns, merge, split, header row, borders, shading">▦ Table ▾</button><span class="sep"></span><label title="Frame width`).replace('<span style="color:var(--pc-dim)">drag a box', '<button class="ghost" id="pttMenu" title="Tables: insert, rows, columns, merge, split, header row, borders, shading">▦ Table ▾</button><span style="color:var(--pc-dim)">drag a box'); };
    T.bindOptions = function (o) {
      bb.call(this, o);
      const b = o.querySelector("#pttMenu");
      if (b) { b.onmousedown = (e) => e.preventDefault(); b.onclick = (ev) => { const kr = (E.kx || E.stage).getBoundingClientRect(), r = ev.currentTarget.getBoundingClientRect(); E.ui.menuAt(MENU(), r.left - kr.left, r.bottom - kr.top, 0); }; }
    };
    /* right-click in a cell = the table menu; drag a column's right edge = its width */
    let colDrag = null;
    const edgeAt = (e) => {
      const el = e.target && e.target.closest ? e.target.closest("td,th") : null; if (!el || !ed() || !ed().contains(el)) return null;
      const r = el.getBoundingClientRect(); if (Math.abs(e.clientX - r.right) > 5) return null;
      const t = el.closest("table"), p = cellPos(t, el); return { t, c: p.c + p.cs - 1 };
    };
    doc.addEventListener("contextmenu", (e) => {
      const e0 = ed(); if (!e0 || !e0.contains(e.target) || !e.target.closest("td,th")) return;
      e.preventDefault(); const kr = (E.kx || E.stage).getBoundingClientRect(); E.ui.menuAt(MENU().slice(2), e.clientX - kr.left, e.clientY - kr.top, 0);
    }, true);
    doc.addEventListener("pointermove", (e) => {
      const e0 = ed(); if (!e0) return;
      if (colDrag) {
        const dx = (e.clientX - colDrag.x) / colDrag.px * 100, ws = colDrag.ws.slice(), i = colDrag.c;
        if (i + 1 < ws.length) { const a = Math.max(3, Math.min(ws[i] + ws[i + 1] - 3, ws[i] + dx)); ws[i + 1] = ws[i] + ws[i + 1] - a; ws[i] = a; }
        else ws[i] = Math.max(3, ws[i] + dx);
        setColWidths(colDrag.t, ws); e.preventDefault(); return;
      }
      if (e0.contains(e.target)) e0.style.cursor = edgeAt(e) ? "col-resize" : "";
    }, true);
    doc.addEventListener("pointerdown", (e) => {
      const g = edgeAt(e); if (!g) return;
      e.preventDefault(); e.stopPropagation();
      colDrag = { t: g.t, c: g.c, x: e.clientX, ws: colWidths(g.t), px: g.t.getBoundingClientRect().width };
    }, true);
    doc.addEventListener("pointerup", () => { if (colDrag) { colDrag = null; X.live(); } }, true);
  }

  const PCDocTable = { tableHtml, grid, cellPos, insertRow, insertCol, deleteRow, deleteCol, mergeCells, splitCell, setHeader, colWidths, setColWidths, setBorders, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCDocTable;
  if (root && root.document) root.PCDocTable = PCDocTable;
})(typeof window !== "undefined" ? window : globalThis);
