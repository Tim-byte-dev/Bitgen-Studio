/* ext/slidesdock/slidedata.js — 🎞 TABLES AND CHARTS ON SLIDES (2.835.0), window.H3SlideData.
 *
 * Tim: "add charts and tables on slides, or a theme built from brand colours".
 *   ▦ Table        a 4 x 3 table (the header row in the theme's accent, banded rows) - into an empty content box when the
 *                  slide has one, else the middle; its editor opens at once
 *   📊 Chart ▾     Column / Bar / Line / Area / Pie / Doughnut with example numbers - its editor opens at once
 *   double-click a table / chart (or right-click ▸ ✎ Edit table / chart…) = the editor: a grid of the cells / the data
 *                  (categories down, series across), ＋ / − rows and columns, 📋 Paste from a spreadsheet (tab-separated -
 *                  ▦ Spreadsheet, Excel), the header / banded rows / header colour / text size, the chart type / title /
 *                  legend - ✔ Apply = one undo step
 *   Charts are drawn by the spreadsheet's chart engine (ext/sheetdock/sheetchart.js, loaded when needed) in the theme's
 *   colours (slidecore.chartColors); .pptx gets real PowerPoint tables and charts (lib/slidePptx.js), the PDF draws both
 *   (slidedraw.js).
 * Pure (Node: scripts/test-835.js): tsv, toGrid, fromGrid, chartSvgLook.
 */
(function (root) {
  "use strict";
  const K = () => root.SlideCore || (typeof require === "function" ? require("./slidecore.js") : null);
  /* ================================ pure ================================ */
  /** tab-separated text (a spreadsheet's copy) -> rows of cells */
  function tsv(text) {
    const rows = String(text || "").replace(/\r/g, "").replace(/\n+$/, "").split("\n").map((l) => l.split("\t").map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
    return rows.length === 1 && rows[0].length === 1 && !rows[0][0] ? [] : rows;
  }
  /** a chart's data as a grid: row 0 = ["", series names…], then [category, values…] */
  function toGrid(ch) { return [[""].concat(ch.series.map((s) => s.name))].concat(ch.cats.map((c, i) => [c].concat(ch.series.map((s) => String(s.values[i] == null ? "" : s.values[i]))))); }
  /** a grid -> {cats, series} (a number cell may carry thousands commas / $ / %) */
  function fromGrid(g) {
    const rows = (g || []).filter((r) => r && r.some((c) => String(c).trim() !== ""));
    if (!rows.length) return { cats: [], series: [] };
    const head = rows[0], body = rows.slice(1), n = Math.max(...rows.map((r) => r.length));
    const numOf = (v) => { const x = parseFloat(String(v == null ? "" : v).replace(/[,$€£¥%\s]/g, "")); return Number.isFinite(x) ? x : 0; };
    const series = []; for (let j = 1; j < n; j++) series.push({ name: String(head[j] || "Series " + j), values: body.map((r) => numOf(r[j])) });
    return { cats: body.map((r) => String(r[0] == null ? "" : r[0])), series };
  }
  /** the look the chart engine gets on a slide: the theme's words, lines and colours, a size that reads on a slide */
  function chartSvgLook(it, deck) {
    const T = K().theme(deck), dark = K().contrast(T.bg) === "#ffffff";
    return { ink: T.text, dim: dark ? "#b9bec6" : "#5f6670", line: dark ? "#4a4f57" : "#d4d7dc", font: `${T.font}, sans-serif`, bg: "none", fs: Math.max(13, Math.min(26, Math.round(Math.min(it.w, it.h) / 20))) };
  }
  const pure = { tsv, toGrid, fromGrid, chartSvgLook };
  if (typeof module !== "undefined" && module.exports) module.exports = pure;

  /* ================================ the page ================================ */
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const H = () => root.H3Slides;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const NAMES = { column: "▮ Column", bar: "▬ Bar", line: "📈 Line", area: "◭ Area", pie: "◔ Pie", doughnut: "◎ Doughnut" };

  /* ---- the chart engine (the spreadsheet's), loaded once */
  let loading = null;
  function engine() {
    if (root.SheetChart) return Promise.resolve(root.SheetChart);
    if (!loading) loading = new Promise((res) => { const s = doc.createElement("script"); s.src = "/ext/sheetdock/sheetchart.js"; s.onload = () => { res(root.SheetChart || null); if (H()) H().paint(); }; s.onerror = () => res(null); doc.head.appendChild(s); });
    return loading;
  }
  /** a chart item as SVG (null while the engine loads) */
  function chartSvg(it, deck) {
    if (!root.SheetChart) { engine(); return null; }
    const c = it.chart || {}; return root.SheetChart.svg({ type: c.type, title: c.title, legend: c.legend, colors: K().chartColors(deck) }, { cats: c.cats || [], series: c.series || [] }, it.w, it.h, chartSvgLook(it, deck));
  }
  function tableHtml(it, deck) {
    const L = K().tableLook(it, deck), rows = it.rows || [[""]];
    const cell = (c, i) => { const hd = i === 0 && L.hasHead, bg = hd ? L.head : L.band && i % 2 === (L.hasHead ? 0 : 1) ? L.band : "transparent";
      return `<td style="background:${bg};color:${hd ? L.headColor : L.color};font-weight:${hd ? 700 : 400};border:1px solid ${L.line}">${esc(c)}</td>`; };
    return `<table class="sltbl" style="font-family:'${L.font}',sans-serif;font-size:${L.size}px">${rows.map((r, i) => `<tr>${r.map((c) => cell(c, i)).join("")}</tr>`).join("")}</table>`;
  }
  /** what renderItem puts in a table / chart item */
  function html(it, deck) {
    if (it.type === "table") return tableHtml(it, deck);
    const s = chartSvg(it, deck);
    return s ? s.replace("<svg ", '<svg preserveAspectRatio="none" style="width:100%;height:100%;display:block" ') : `<div class="slchartwait">📊</div>`;
  }

  /* ---- inserting */
  function place(item) {
    const ed = H(), s = ed.slide(), ph = s.items.find((i) => i.type === "text" && (i.role === "body" || i.role === "body2") && !String(i.text || "").trim());
    if (ph) { item.x = ph.x; item.y = ph.y; item.w = ph.w; item.h = ph.h; }
    ed.step(); if (ph) s.items.splice(s.items.indexOf(ph), 1);
    s.items.push(item); ed.St.sel = new Set([item.id]); ed.changed();
    return item;
  }
  function addTable() { const it = place(K().newTable(H().deck(), 4, 3)); H().msg("▦ table added - fill it in (double-click it later to edit)"); edit(it); return it; }
  async function addChart(type) { await engine(); const it = place(K().newChart(H().deck(), type)); H().msg("📊 chart added - put in your numbers (double-click it later to edit)"); edit(it); return it; }
  function chartMenu(btn) {
    doc.querySelectorAll(".slmenu").forEach((m) => m.remove());
    const r = btn.getBoundingClientRect(), m = doc.createElement("div"); m.className = "slmenu"; m.style.left = Math.round(r.left) + "px"; m.style.top = Math.round(r.bottom + 2) + "px";
    m.innerHTML = K().CHART_TYPES.map((t) => `<div data-c="${t}">${NAMES[t]}</div>`).join(""); doc.body.appendChild(m);
    setTimeout(() => doc.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target)) { m.remove(); doc.removeEventListener("pointerdown", off, true); } }, true), 0);
    m.addEventListener("click", (e) => { const it = e.target.closest("[data-c]"); if (!it) return; m.remove(); addChart(it.dataset.c); });
    return m;
  }

  /* ---- the editor */
  function gridHtml(g) {
    return `<table class="sldg">${g.map((r, i) => `<tr>${r.map((c, j) => `<td><input data-r="${i}" data-c="${j}" value="${esc(c)}"${i === 0 || j === 0 ? ' class="hd"' : ""}></td>`).join("")}</tr>`).join("")}</table>`;
  }
  function readGrid(box) { const g = []; box.querySelectorAll(".sldg input").forEach((i) => { const r = +i.dataset.r, c = +i.dataset.c; (g[r] = g[r] || [])[c] = i.value; }); return g; }
  function edit(it) {
    if (!it || (it.type !== "table" && it.type !== "chart")) return null;
    doc.querySelectorAll("#slDataBox").forEach((b) => b.remove());
    const isT = it.type === "table", deck = H().deck(), T = K().theme(deck);
    let g = isT ? JSON.parse(JSON.stringify(it.rows)) : toGrid(it.chart);
    const box = doc.createElement("div"); box.id = "slDataBox";
    const top = isT
      ? `<label><input type="checkbox" id="sldHead"${it.head !== false ? " checked" : ""}> Header row</label><label><input type="checkbox" id="sldBand"${it.band !== false ? " checked" : ""}> Banded rows</label>
         <label>Header colour <input type="color" id="sldFill" value="${it.headFill || T.accent}"></label><button class="ghost" type="button" id="sldFillReset" title="The theme's accent">↺</button>
         <label>Text size <input type="number" id="sldSize" min="8" max="72" value="${(it.st && it.st.size) || 20}" style="width:56px"></label>`
      : `<label>Type <select id="sldType">${K().CHART_TYPES.map((t) => `<option value="${t}"${it.chart.type === t ? " selected" : ""}>${NAMES[t]}</option>`).join("")}</select></label>
         <label>Title <input type="text" id="sldTitle" value="${esc(it.chart.title)}" style="width:200px"></label><label><input type="checkbox" id="sldLegend"${it.chart.legend !== false ? " checked" : ""}> Legend</label>`;
    box.innerHTML = `<div class="hd2"><b>${isT ? "▦ Table" : "📊 Chart data"}</b><button class="ghost" type="button" data-x style="margin-left:auto">✕</button></div>
      <div class="bd"><div class="row">${top}</div>
        <div class="row"><button class="ghost" type="button" data-g="r+">＋ ${isT ? "Row" : "Category"}</button><button class="ghost" type="button" data-g="r-">− ${isT ? "Row" : "Category"}</button>
          <button class="ghost" type="button" data-g="c+">＋ ${isT ? "Column" : "Series"}</button><button class="ghost" type="button" data-g="c-">− ${isT ? "Column" : "Series"}</button>
          <button class="ghost" type="button" id="sldPaste" title="Paste cells copied from the spreadsheet or Excel (tab-separated) - they replace the grid">📋 Paste from a spreadsheet</button></div>
        ${isT ? "" : `<div class="dim">The first column = the categories (the x axis / the slices), the first row = the series names, the numbers in between.</div>`}
        <div class="gridwrap"></div>
        <div class="row"><span id="sldSay" class="dim"></span><button type="button" id="sldOk" style="margin-left:auto">✔ Apply</button><button class="ghost" type="button" data-x>Cancel</button></div></div>`;
    doc.body.appendChild(box);
    const q = (s) => box.querySelector(s), paintGrid = () => { q(".gridwrap").innerHTML = gridHtml(g); };
    paintGrid();
    const close = () => box.remove();
    box.querySelectorAll("[data-x]").forEach((b) => (b.onclick = close));
    box.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-g]"); if (!b) return;
      g = readGrid(box); const n = g[0].length, minR = isT ? 1 : 2, minC = isT ? 1 : 2;
      if (b.dataset.g === "r+" && g.length < (isT ? 30 : 51)) g.push(Array(n).fill(""));
      if (b.dataset.g === "r-" && g.length > minR) g.pop();
      if (b.dataset.g === "c+" && n < (isT ? 12 : 9)) g = g.map((r, i) => r.concat(i === 0 && !isT ? "Series " + n : ""));
      if (b.dataset.g === "c-" && n > minC) g = g.map((r) => r.slice(0, -1));
      paintGrid();
    });
    q("#sldPaste").onclick = async () => {
      let t = ""; try { t = await root.navigator.clipboard.readText(); } catch (e) { t = ""; }
      if (!t && typeof root.askText === "function") t = (await root.askText("Paste the cells", "Cells copied from a spreadsheet (tab-separated)", "")) || "";
      const rows = tsv(t); if (!rows.length) return (q("#sldSay").textContent = "nothing to paste - copy some cells first");
      const n = Math.max(...rows.map((r) => r.length)); g = rows.map((r) => r.concat(Array(n - r.length).fill(""))).slice(0, isT ? 30 : 51).map((r) => r.slice(0, isT ? 12 : 9));
      paintGrid(); q("#sldSay").textContent = `${g.length} × ${g[0].length} pasted - ✔ Apply puts it in`;
    };
    if (isT) q("#sldFillReset").onclick = () => { q("#sldFill").value = T.accent; q("#sldFill").dataset.reset = "1"; };
    if (isT) q("#sldFill").oninput = () => { delete q("#sldFill").dataset.reset; };
    q("#sldOk").onclick = () => {
      g = readGrid(box);
      const ed = H(), cur = ed.slide().items.find((x) => x.id === it.id) || ed.deck().slides.flatMap((s) => s.items).find((x) => x.id === it.id);
      if (!cur) { close(); return; }
      ed.step();
      if (isT) {
        cur.rows = K().cleanRows(g); cur.head = q("#sldHead").checked; cur.band = q("#sldBand").checked;
        if (q("#sldFill").dataset.reset || q("#sldFill").value.toLowerCase() === T.accent.toLowerCase()) delete cur.headFill; else cur.headFill = q("#sldFill").value.toLowerCase();
        const sz = Math.round(+q("#sldSize").value || 20); cur.st = Object.assign({}, cur.st || {}, { size: Math.max(8, Math.min(72, sz)) });
      } else {
        const d = fromGrid(g);
        cur.chart = K().cleanChart({ type: q("#sldType").value, title: q("#sldTitle").value, legend: q("#sldLegend").checked, cats: d.cats, series: d.series });
      }
      ed.changed(); ed.msg(isT ? "▦ table updated - Ctrl+Z takes it back" : "📊 chart updated - Ctrl+Z takes it back");
      close();
    };
    const first = q(".sldg input:not(.hd)") || q(".sldg input"); if (first) first.focus();
    return box;
  }

  function wire() {
    const on = (id, fn) => { const b = $(id); if (b && !b.dataset.w) { b.dataset.w = 1; b.addEventListener("click", fn); } };
    on("slAddTable", () => addTable());
    on("slAddChart", (e) => chartMenu(e.currentTarget));
    engine();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else setTimeout(wire, 0);
  root.H3SlideData = Object.assign({ html, chartSvg, tableHtml, addTable, addChart, chartMenu, edit, engine }, pure);
})(typeof window !== "undefined" ? window : globalThis);
