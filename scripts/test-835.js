#!/usr/bin/env node
/* bitGen Studio — 2.835.0 units: 🎞 tables and charts on slides, a theme built from brand colours, reset-layout.bat clears the
 * whole desktop-app cache. Tim: "add charts and tables on slides, or a theme built from brand colours. Make reset-layout.bat
 * clear the whole Electron cache".
 *   slidecore: cleanBrand / theme "brand" / clean keeps it, contrast, chartColors, tableLook, newTable / newChart, cleanRows,
 *   cleanChart; slidedata pure: tsv, toGrid / fromGrid; slidebrand pure: palette (k-means of a logo), brandFrom (light / dark);
 *   lib/slideBrands.js files; lib/slidePptx.js real tables + charts and lib/slidePptxIn.js reads them back; slidedraw
 *   drawTable; the wiring; misc/reset-layout.bat. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const K = require(path.join(ROOT, "ext/slidesdock/slidecore.js")), SD = require(path.join(ROOT, "ext/slidesdock/slidedata.js")), SB = require(path.join(ROOT, "ext/slidesdock/slidebrand.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
(async () => {
  // ---- slidecore
  const BR = { name: "Acme <b>", bg: "#FFFFFF", title: "#112233", text: "#222222", accent: "#ff0000", accent2: "#00aa00", font: "Arial;x", titleFont: "" };
  const cb = K.cleanBrand(BR);
  check("cleanBrand: colours lower-case, the name and fonts made safe (empty font = Calibri); a missing / bad colour = null",
    cb && cb.bg === "#ffffff" && cb.name === "Acme b" && cb.font === "Arialx" && cb.titleFont === "Calibri" && K.cleanBrand(Object.assign({}, BR, { accent2: "green" })) === null && K.cleanBrand(null) === null, cb);
  const d = K.newDeck("night"); d.theme = "brand"; d.brand = BR;
  const c1 = K.clean(d), c2 = K.clean(Object.assign({}, d, { brand: { bg: "#fff" } }));
  check("a deck on its brand: theme 'brand' kept with deck.brand, theme() = the brand's colours + fonts; a broken brand = Plain", c1.theme === "brand" && c1.brand.accent === "#ff0000" && K.theme(c1).accent === "#ff0000" && K.theme(c1).titleFont === "Calibri" && c2.theme === "plain" && !c2.brand, [c1.theme, c2.theme]);
  check("every built-in theme has a second accent; contrast picks dark words on light colours, white on dark", Object.values(K.THEMES).every((T) => /^#[0-9a-f]{6}$/.test(T.accent2)) && K.contrast("#ffd166") === "#1b1b1b" && K.contrast("#0f1b2d") === "#ffffff");
  const cc = K.chartColors(c1);
  check("chartColors: the two accents first, then lighter / darker steps", cc[0] === "#ff0000" && cc[1] === "#00aa00" && cc.length >= 8 && cc[2] !== cc[0], cc);
  const t = K.newTable(c1, 4, 3), ch = K.newChart(c1, "pie");
  check("newTable: 4 x 3 with headings, header + banded; newChart: example numbers, its type", t.type === "table" && t.rows.length === 4 && t.rows[0][0] === "Heading 1" && t.head && t.band && ch.type === "chart" && ch.chart.type === "pie" && ch.chart.series.length === 2, [t, ch]);
  const L = K.tableLook(Object.assign({}, t, { headFill: "#ffd166" }), c1);
  check("tableLook: the header in its own colour (else the accent) with readable words, the theme's font", L.head === "#ffd166" && L.headColor === "#1b1b1b" && K.tableLook(t, c1).head === "#ff0000" && K.tableLook(t, c1).headColor === "#ffffff" && L.font === "Arialx", L);
  const big = Array.from({ length: 40 }, () => Array.from({ length: 20 }, () => "x"));
  const rr = K.cleanRows([["a", "b"], ["c"], [null, 5]]), rb = K.cleanRows(big);
  check("cleanRows: ragged rows padded, numbers / null made words, at most 30 x 12", JSON.stringify(rr) === '[["a","b"],["c",""],["","5"]]' && rb.length === 30 && rb[0].length === 12, rr);
  const cq = K.cleanChart({ type: "weird", cats: ["a", "b"], series: [{ name: "x", values: ["5", "q", 7] }, null, {}] });
  check("cleanChart: an unknown type = column, values numbers (a word = 0) as many as the categories, a series with no name named", cq.type === "column" && JSON.stringify(cq.series[0].values) === "[5,0]" && cq.series.length === 2 && cq.series[1].name === "Series 2", cq);
  const dt = K.newDeck("plain"); dt.slides[0].items.push(t, ch, { type: "table", rows: "x" });
  const kept = K.clean(dt).slides[0].items;
  check("clean keeps table / chart items (a broken table gets one empty cell)", kept.filter((i) => i.type === "table").length === 2 && kept.some((i) => i.type === "chart" && i.chart.type === "pie") && JSON.stringify(kept.find((i) => i.type === "table" && i.rows.length === 1).rows) === '[[""]]', kept.map((i) => i.type));

  // ---- slidedata pure
  const g = SD.tsv("Month\tSales\tCosts\nJan\t$1,200\t800\nFeb\t1500\t900\n");
  const fg = SD.fromGrid(g);
  check("tsv + fromGrid: a spreadsheet's cells -> categories down, series across ($ and thousands commas read)", fg.cats.join() === "Jan,Feb" && fg.series.length === 2 && fg.series[0].name === "Sales" && fg.series[0].values.join() === "1200,1500", fg);
  check("toGrid -> fromGrid gives the chart back", JSON.stringify(SD.fromGrid(SD.toGrid(ch.chart))) === JSON.stringify({ cats: ch.chart.cats, series: ch.chart.series }));
  const lk = SD.chartSvgLook({ w: 800, h: 400 }, c1);
  check("chartSvgLook: the theme's text colour and font, words big enough for a slide", lk.ink === "#222222" && /Arialx/.test(lk.font) && lk.fs >= 13, lk);

  // ---- slidebrand pure
  const W = 20, Hh = 20, px = new Uint8ClampedArray(W * Hh * 4);
  for (let i = 0; i < W * Hh; i++) { const y = Math.floor(i / W), c = y < 8 ? [255, 255, 255, 255] : y < 15 ? [214, 40, 40, 255] : y < 19 ? [29, 53, 140, 255] : [0, 0, 0, 0]; px.set(c, i * 4); }
  const pal = SB.palette(px, 4);
  const bl = SB.brandFrom(pal, "light"), bd = SB.brandFrom(pal, "dark");
  check("palette: the logo's colours most used first, see-through pixels left out", pal[0].hex === "#ffffff" && pal.some((c) => c.hex === "#d62828") && pal.some((c) => c.hex === "#1d358c") && Math.abs(pal.reduce((a, c) => a + c.n, 0) - 1) < 1e-9, pal);
  check("brandFrom light: white background, the red (most used colourful) = accent 1, the blue = accent 2, dark titles from the accent",
    bl.bg === "#ffffff" && bl.accent === "#d62828" && bl.accent2 === "#1d358c" && K.contrast(bl.title) === "#ffffff", bl);
  check("brandFrom dark: a dark background, light titles, a too-dark accent lightened to read on it", bd.bg === "#14161b" && K.contrast(bd.title) === "#1b1b1b" && bd.accent2 !== "#1d358c", bd);

  // ---- lib/slideBrands.js
  const B = require(path.join(ROOT, "lib/slideBrands.js")), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "br835-")); B.setBase(tmp);
  const s1 = B.save(Object.assign({}, BR, { name: "Tiger/Art" }));
  let e1 = null; try { B.save({ name: "x", bg: "#fff" }); } catch (e) { e1 = e; }
  const l1 = B.list(); B.remove("Tiger Art");
  check("slideBrands: saved as <app>/brands/<name>.json (a name made a file name), listed, deleted; a brand missing colours = 400",
    s1.brand.name === "Tiger Art" && fs.readdirSync(path.join(tmp, "brands")).length === 0 && l1.brands.length === 1 && l1.brands[0].accent === "#ff0000" && e1 && e1.status === 400, [s1, l1]);

  // ---- .pptx out and back in
  const P = require(path.join(ROOT, "lib/slidePptx.js")), I = require(path.join(ROOT, "lib/slidePptxIn.js")), JSZip = require(path.join(ROOT, "node_modules/jszip"));
  const pd = K.newDeck("forest"), ps = K.newSlide("blank", pd), tt = K.newTable(pd, 5, 3);
  tt.rows[1] = ["Sales", "12", "19"]; tt.headFill = "#123456"; tt.st = { size: 24 };
  const cc1 = K.newChart(pd, "column"); cc1.chart.title = "Money";
  ps.items.push(tt, cc1, Object.assign(K.newChart(pd, "pie"), { x: 10 }), Object.assign(K.newChart(pd, "bar"), { x: 20 }), Object.assign(K.newChart(pd, "doughnut"), { x: 30 })); pd.slides.push(ps);
  const buf = await P.toPptx(pd), z = await JSZip.loadAsync(buf), sx = await z.file("ppt/slides/slide2.xml").async("string");
  const charts = Object.keys(z.files).filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f));
  const c1x = await z.file(charts.sort()[0]).async("string");
  check("⤓ PowerPoint: a real table (a:tbl with the words) and real charts (4 chart parts, the theme's accent in them)", /<a:tbl>/.test(sx) && /Heading 1/.test(sx) && /Sales/.test(sx) && charts.length === 4 && new RegExp(K.THEMES.forest.accent.slice(1), "i").test(c1x), charts);
  const back = await I.fromPptx(buf), its = back.deck.slides[1].items, bt = its.find((i) => i.type === "table"), bcs = its.filter((i) => i.type === "chart");
  check("⤒ Open PowerPoint: the table comes back (words, header + its colour, banded rows, the text size, its place)",
    bt && bt.rows[1].join() === "Sales,12,19" && bt.head && bt.headFill === "#123456" && bt.band && Math.abs(bt.st.size - 24) <= 1 && Math.abs(bt.x - tt.x) <= 1 && Math.abs(bt.w - tt.w) <= 1, bt);
  check("…and the charts (type incl. bar / column / pie / doughnut, the title, categories, series and numbers from PowerPoint's cache); nothing left out",
    bcs.length === 4 && bcs[0].chart.type === "column" && bcs[0].chart.title === "Money" && bcs[0].chart.cats.join() === "Q1,Q2,Q3,Q4" && bcs[0].chart.series[1].values.join() === "8,11,10,13"
    && bcs.map((c) => c.chart.type).sort().join() === "bar,column,doughnut,pie" && !back.notes.length, [bcs.map((c) => c.chart), back.notes]);

  // ---- slidedraw: a table on the PDF's canvas
  const DR = require(path.join(ROOT, "ext/slidesdock/slidedraw.js")), calls = [];
  const fake = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, strokeRect() {}, measureText: (t) => ({ width: t.length * 10 }),
    fillRect(x, y, w, h) { calls.push(["rect", this.fillStyle, Math.round(x), Math.round(y)]); }, fillText(t, x, y) { calls.push(["text", t, this.fillStyle, this.font]); } };
  global.SlideCore = K; DR.drawTable(fake, Object.assign({}, tt, { x: 0, y: 0, w: 900, h: 250 }), pd);
  const head = calls.find((c) => c[0] === "text" && c[1] === "Heading 1");
  check("slidedraw.drawTable: the header filled with its colour, its words bold in the readable colour, the cells' words drawn",
    calls.some((c) => c[0] === "rect" && c[1] === "#123456") && head && /bold/.test(head[3]) && head[2] === "#ffffff" && calls.some((c) => c[0] === "text" && c[1] === "Sales"), calls.slice(0, 6));

  // ---- the wiring
  const rs = read("routes/slides.js"), ej = JSON.parse(read("ext/slidesdock/ext.json")), html = read("ext/slidesdock/dock.html"), sdk = read("ext/slidesdock/slidesdock.js"), au = read("static/slideaudience.html");
  check("routes: GET / POST / DELETE /api/slides/brands (lib/slideBrands.js) in routes/slides.js; /brands/ git-ignored", /\/api\/slides\/brands/.test(rs) && /lib\/slideBrands/.test(rs) && /^\/brands\/$/m.test(read(".gitignore")));
  check("the extension: slidedata.js + slidebrand.js after slideai.js; ▦ Table and 📊 Chart ▾ buttons; the editor's hooks (render, double-click, right-click, Theme ▾)",
    ej.scripts.join().includes("slideai.js,slidedata.js,slidebrand.js,slideshow.js") && /id="slAddTable"/.test(html) && /id="slAddChart"/.test(html) && /#slBrandBox/.test(html)
    && /root\.H3SlideData\.html\(it, deck, mode\)/.test(sdk) && /root\.H3SlideData\.edit\(it\)/.test(sdk) && /root\.H3SlideBrand\.extend\(m\)/.test(sdk) && /\.sltbl/.test(au));
  check("the chart engine (sheetchart.js) takes a font size for slides", /\+L\.fs > 0/.test(read("ext/sheetdock/sheetchart.js")));
  const bat = read("misc/reset-layout.bat");
  check("reset-layout.bat: the desktop app's WHOLE data folder (APPDATA + LOCALAPPDATA, bitgen-studio-shell …) removed after its storage / preferences are copied to the backup; says when something holds it; CRLF",
    /%APPDATA%\\bitgen-studio-shell/.test(bat) && /%LOCALAPPDATA%\\bitgen-studio-shell/.test(bat) && /rmdir \/S \/Q "%%~D"/.test(bat) && /xcopy "%%~D\\%%~K"/.test(bat) && /"Local Storage" "Session Storage" "IndexedDB"/.test(bat)
    && /could not remove all of/.test(bat) && /\r\n/.test(bat) && !/[^\r]\n/.test(bat) && !/GPUCache/.test(bat));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e.stack || e)); console.log(`\nRESULT: ${pass} passed, ${fail + 1} failed`); process.exit(1); });
