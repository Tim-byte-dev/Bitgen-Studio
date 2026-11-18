#!/usr/bin/env node
/* bitGen Studio — 2.838.0 units: the AI-written document's figures IN the text (each at its place, its layer anchored to it
 * and following the text) and a spreadsheet as the data.
 *   pcdocai toHtml (data-fig places) / figHeight; pcdoctext sanitize keeps a place, anchorBoxes (which frame, where);
 *   docAi extract .xlsx (ExcelJS) -> sheets as tab-separated rows; the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const A = require(path.join(ROOT, "lib/docAi.js")), P = require(path.join(ROOT, "ext/imageeditdock/pcdocai.js")), T = require(path.join(ROOT, "ext/imageeditdock/pcdoctext.js"));
const { JSDOM } = require("jsdom");
const doc = new JSDOM("<!doctype html><body></body>").window.document;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
(async () => {
  const d = { title: "Sales", blocks: [{ type: "p", text: "Apples sold best." }, { type: "chart", caption: "Figure 1: units", chart: { type: "column", cats: ["A"], series: [{ name: "u", values: [1] }] } },
    { type: "p", text: "An orchard." }, { type: "image", caption: "Figure 2: orchard", picture: "an orchard" }] };
  const html = P.toHtml(d, { colW: 500, frameH: 700, figId: (n) => "x" + n });
  check("toHtml with a column width: each figure's place right where the LLM put it (a data-fig paragraph as tall as it), its caption under it",
    /<p>Apples sold best\.<\/p><p data-fig="x1" style="height:280px"><br><\/p><p><i>Figure 1: units<\/i><\/p><p>An orchard\.<\/p><p data-fig="x2" style="height:310px"><br><\/p><p><i>Figure 2: orchard<\/i><\/p>/.test(html), html);
  check("figHeight: a chart 0.56 of the column, a picture 0.62, never over 70 % of the frame, at least 40 px",
    P.figHeight("chart", 1000) === 560 && P.figHeight("image", 1000) === 620 && P.figHeight("image", 1000, 500) === 350 && P.figHeight("chart", 10) === 40);
  const sa = T.sanitize(html + '<p data-fig="bad id!" style="height:99px">x</p><p data-fig="y" style="height:99999px;position:fixed"><br></p><span data-fig="z">w</span>', doc);
  check("pcdoctext sanitize keeps a figure's place (its id, its height up to 4000 px) - a bad id dropped, nothing else let through",
    /<p data-fig="x1" style="height: ?280px;?"><br><\/p>/.test(sa) && /<p data-fig="y" style="height: ?4000px;?"><br><\/p>/.test(sa) && !/bad id/.test(sa) && !/position/.test(sa) && !/data-fig="z"/.test(sa) && (sa.match(/data-fig=/g) || []).length === 3, sa);
  // anchorBoxes: two frames 400 tall (k = 2, so 200 CSS px each), windows at 0 and 190
  const wins = [{ top: 0 }, { top: 190 }], frames = [{ x: 10, y: 20, k: 2, h: 400 }, { x: 600, y: 20, k: 2, h: 400, repH: 12 }];
  const ab = T.anchorBoxes([{ id: "a", top: 50, bottom: 150, left: 0, width: 250 }, { id: "b", top: 200, bottom: 300, left: 5, width: 240 }, { id: "c", top: 395, bottom: 450, left: 0, width: 250 }], wins, frames);
  check("anchorBoxes: a place in the first window -> the first frame (canvas px, x k); in the second -> the second frame below its repeated header; past the last frame's room = left out",
    ab.a && ab.a.frame === 0 && ab.a.x === 10 && ab.a.y === 120 && ab.a.w === 500 && ab.a.h === 200 && ab.b && ab.b.frame === 1 && ab.b.x === 610 && ab.b.y === 20 + (10 + 12) * 2 && ab.b.h === 200 && !ab.c, ab);
  // extract .xlsx
  const ExcelJS = require("exceljs"), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Q3");
  ws.addRow(["Fruit", "Units", "Date"]); ws.addRow(["Apples", 120, new Date(Date.UTC(2026, 8, 1))]); ws.addRow(["Pears", 80, new Date(Date.UTC(2026, 8, 2))]); ws.addRow(["Total", { formula: "B2+B3", result: 200 }]);
  wb.addWorksheet("Empty");
  const buf = Buffer.from(await wb.xlsx.writeBuffer()), t = await A.extract("sales.xlsx", buf);
  check("extract .xlsx: each sheet as tab-separated rows (dates as YYYY-MM-DD, a formula as its saved result), an empty sheet left out",
    /--- sheet: Q3 \(4 rows, tab-separated\) ---/.test(t.text) && /Apples\t120\t2026-09-01/.test(t.text) && /Total\t200/.test(t.text) && !/Empty/.test(t.text), t.text);
  let e1 = null; try { await A.extract("bad.xlsx", Buffer.from("not a zip")); } catch (e) { e1 = e; }
  check("extract: a broken workbook = 400 with why", e1 && e1.status === 400 && /could not be read/.test(e1.message));
  check("the LLM is told to put each figure right after the paragraph about it and to chart a spreadsheet's cells", /right after the paragraph that talks about it/.test(A.SYSTEM) && /tab-separated rows/.test(A.SYSTEM));
  // the .docx export carries the figures as pictures
  const DX = require(path.join(ROOT, "lib/docxFiles.js")), JSZip = require("jszip");
  const PNG1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const dbuf = await DX.build({ title: "t", blocks: [{ t: "p", runs: [{ text: "Before." }] }, { t: "img", png: PNG1, w: 2000, h: 1000 }, { t: "img", png: Buffer.from("nope").toString("base64"), w: 10, h: 10 }, { t: "p", runs: [{ text: "After." }] }] });
  const z = await JSZip.loadAsync(dbuf), media = Object.keys(z.files).filter((n) => /^word\/media\//.test(n)), xml = await z.file("word/document.xml").async("string");
  const ext = /<wp:extent cx="(\d+)" cy="(\d+)"/.exec(xml);
  check("Word export: a figure's picture goes in at its place (centred, no wider than the page's text), a block that is not a PNG becomes an empty line",
    media.length === 1 && /Before\.[\s\S]*<w:drawing>[\s\S]*After\./.test(xml) && ext && +ext[1] / +ext[2] > 1.9 && +ext[1] / +ext[2] < 2.1 && +ext[1] <= 161 * 36000, { media, ext: ext && ext.slice(1) });
  // the wiring
  const DA = read("ext/imageeditdock/pcdocai.js"), DT = read("ext/imageeditdock/pcdoctext.js");
  check("pcdocai: no strip under the frame (figureGrid gone) - the layers anchored (L.anchor flow / fig / src), placed by the reflow, drawn from their source",
    !/figureGrid/.test(DA) && /N\.anchor = \{ flow: flowId, fig: figId\(i \+ 1\)/.test(DA) && /E\.docText\.reflow\(flowId\)/.test(DA) && /m\.L\.anchor\.src = "data:image\/svg\+xml/.test(DA) && /m\.L\.anchor\.src = url; await E\.docText\.anchorDraw\(m\.L\)/.test(DA) && /xlsx\|csv\|tsv/.test(DA));
  const DXS = read("ext/imageeditdock/pcdocx.js");
  check("pcdocx: a figure's place becomes an img block filled with its anchored layer's pixels (any page)", /out\.push\(\{ t: "img", fig: n\.getAttribute\("data-fig"\) \}\)/.test(DXS) && /figsInto\(blocks, h\);/.test(DXS) && /S\.pages\.list\.map\(\(pg\) => pg\.st && pg\.st\.layers\)/.test(DXS));
  check("pcdoctext: the reflow places anchored layers (placeAnchors after every story's layout), moves them to the frame's page, draws them from their source",
    /if \(m\.figs && m\.figs\.length\) placeAnchors\(arr, m\.figs, anchorBoxes\(/.test(DT) && /dst\.splice\(fi < 0 \? dst\.length : fi \+ 1, 0, L\)/.test(DT) && /if \(a\.src\) \{ a\.box = nb; anchorDraw\(L\); return true; \}/.test(DT) && /if \(!fr\) \{ hideAnchor\(at\.L\); continue; \}/.test(DT) && /E\.docText = \{ anchorDraw,/.test(DT));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
