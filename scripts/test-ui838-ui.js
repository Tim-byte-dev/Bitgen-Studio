#!/usr/bin/env node
/* bitGen Studio — 2.838.0 in a REAL browser: the AI-written document's figures sit IN the text and follow it, and a
 * spreadsheet is the data. Tim: "yes, please go ahead with the next step" (after 2.837.0: figures placed in the text where
 * they belong instead of a row under it; a spreadsheet (.xlsx) as the data).
 *   An anchored layer (L.anchor {flow, fig, src}) goes to its place in the story: the text above it grows -> it moves down,
 *   into the next linked frame, onto the next PAGE's layers; the frame made narrower -> drawn again smaller from its source;
 *   a .xlsx given on the prompt docker's ＋ with a WP layer picked -> its sheets reach the LLM as rows of cells. A stand-in LLM.
 *   Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (method, u, body) => { const r = await fetch(new URL(u, URL_), { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
const asked = [];
const PLAN = { title: "Fruit report", blocks: [{ type: "p", text: "Apples led the quarter." },
  { type: "chart", caption: "Figure 1: units", chart: { type: "bar", title: "Units", cats: ["Apples", "Pears"], series: [{ name: "Units", values: [120, 80] }] } }, { type: "p", text: "Pears followed." }] };
function llmServer() {
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const all = (j.messages || []).map((m) => m.content).join("\n"); asked.push(all);
      const text = /You write documents/.test(all) ? JSON.stringify(PLAN) : "an ordinary chat answer";
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
  }).listen(0, "127.0.0.1");
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const llm = llmServer(); await new Promise((r) => llm.on("listening", r));
  const cfg0 = await api("GET", "api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  await api("POST", "api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stand-in" } });
  const ExcelJS = require(path.join(__dirname, "..", "node_modules", "exceljs")), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Sales");
  ws.addRow(["Fruit", "Units"]); ws.addRow(["Apples", 120]); ws.addRow(["Pears", 80]);
  const xlsx = Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docAi && window.imageEditorInstance.E.pages, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1600px;height:900px;z-index:9999"; });
    await p.waitForTimeout(400);
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 1200; c.height = 1600; const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 1200, 1600); window.imageEditorInstance.load(c.toDataURL("image/png"), "f838"); setTimeout(() => { window.imageEditorInstance.E.fitView(); ok(); }, 800); }));
    // two linked frames on one page + a layer anchored to a figure's place in their story
    const s1 = await ev(() => { const E = window.imageEditorInstance.E, S = E.S;
      const A = E.docText.addFrame(50, 40, 1100, 600, {}, false); E.docText.end();
      const B = E.docText.addFrame(50, 800, 1100, 600, { flow: { id: A.doc.flow.id, idx: 1 } }, false); E.docText.end();
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#e02020"/></svg>';
      const N = E.makeLayer("📊 test chart"); N.anchor = { flow: A.doc.flow.id, fig: "t1", box: null, src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), drawn: false };
      S.layers.push(N); E.renderLayersPanel();
      A.doc.html = E.docText.sanitize('<p>One line before.</p><p data-fig="t1" style="height:200px"><br></p><p><i>Figure 1</i></p>');
      E.docText.reflow(A.doc.flow.id); window.__t = { A, B, N }; return { flow: A.doc.flow.id }; });
    await p.waitForTimeout(500);
    const px = (L, x, y) => Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data);
    const a1 = await ev(() => { const { A, N } = window.__t, b = N.anchor.box, P = (x, y) => Array.from(N.canvas.getContext("2d").getImageData(x, y, 1, 1).data); return { box: b, mid: b && P(b.x + (b.w >> 1), b.y + (b.h >> 1)), drawn: N.anchor.drawn, fr: { x: A.doc.x, y: A.doc.y, w: A.doc.w, h: A.doc.h } }; });
    check("an anchored layer goes to its figure's place in the story: inside the first frame, under the first line, as wide as the column, drawn from its source",
      a1.box && a1.box.y > a1.fr.y + 10 && a1.box.y < a1.fr.y + 200 && a1.box.x >= a1.fr.x && a1.box.w > 1000 && a1.drawn && a1.mid[0] > 200 && a1.mid[1] < 60 && a1.mid[3] === 255, a1);
    // the text above grows -> it moves down, into frame B
    const a2 = await ev(() => { const { A, B, N } = window.__t, E = window.imageEditorInstance.E, old = Object.assign({}, N.anchor.box);
      A.doc.html = E.docText.sanitize("<p>Line.</p>".repeat(16) + '<p data-fig="t1" style="height:200px"><br></p><p><i>Figure 1</i></p>');
      E.docText.reflow(A.doc.flow.id);
      const b = N.anchor.box, P = (x, y) => Array.from(N.canvas.getContext("2d").getImageData(x, y, 1, 1).data);
      return { old, box: b, mid: P(b.x + (b.w >> 1), b.y + (b.h >> 1)), oldMid: P(old.x + (old.w >> 1), old.y + (old.h >> 1)), By: B.doc.y, Bh: B.doc.h }; });
    check("…16 lines put above it: it follows the text into the second frame (drawn there, gone from where it was)",
      a2.box.y >= a2.By && a2.box.y < a2.By + a2.Bh && a2.mid[0] > 200 && a2.mid[3] === 255 && a2.oldMid[3] === 0, a2);
    // the frames narrower -> drawn again smaller
    const a3 = await ev(() => { const { A, B, N } = window.__t, E = window.imageEditorInstance.E; A.doc.w = 600; B.doc.w = 600; E.docText.reflow(A.doc.flow.id);
      return { box: N.anchor.box, Bx: B.doc.x }; });
    await p.waitForTimeout(300);
    const a3px = await ev(() => { const { N } = window.__t, b = N.anchor.box; return Array.from(N.canvas.getContext("2d").getImageData(b.x + (b.w >> 1), b.y + (b.h >> 1), 1, 1).data).concat(Array.from(N.canvas.getContext("2d").getImageData(1000, b.y + (b.h >> 1), 1, 1).data)); });
    check("…the frames made narrower: the figure drawn again at the new column width (from its source, kept in shape)", a3.box.w <= 600 && a3.box.x >= a3.Bx && a3px[0] > 200 && a3px[3] === 255 && a3px[7] === 0, { a3, a3px });
    // across pages: frame B moved to a new page -> the layer moves onto that page's layers
    const a4 = await ev(() => { const { A, B, N } = window.__t, E = window.imageEditorInstance.E, S = E.S;
      E.pages.ensure();
      const i = S.layers.indexOf(B); S.layers.splice(i, 1);
      E.pages.add(); S.layers.push(B); B.doc.y = 40; E.pages.go(0);
      E.docText.reflow(A.doc.flow.id);
      const pg = S.pages.list[1], onPage1 = !!(pg.st && pg.st.layers && pg.st.layers.includes(N)), stillHere = S.layers.includes(N);
      return { onPage1, stillHere, box: N.anchor.box, B: B.doc.y }; });
    check("…the second frame on the next PAGE: the figure's layer moves onto that page's layers (just above its frame), placed in it",
      a4.onPage1 && !a4.stillHere && a4.box && a4.box.y >= 40 && a4.box.y < 640, a4);
    // a spreadsheet as the data
    await ev(() => { const E = window.imageEditorInstance.E; E.pages.go(0); });
    await p.waitForTimeout(300);
    const x1 = await ev((b64) => { const E = window.imageEditorInstance.E; const W = E.docText.addFrame(50, 700, 1100, 800, {}, false); E.docText.end();
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return { took: window.H3DocAi.takeFile(new File([bin], "sales.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })), id: W.id }; }, xlsx);
    const reply = await ev(async () => { for (const r of window.H3ChatRoutes) { const out = await r("Write a report from this spreadsheet"); if (out != null) return out; } return null; });
    const ask = asked.find((a) => /You write documents/.test(a)) || "";
    check("a .xlsx on the prompt docker's ＋ with a WP layer picked is held, and its sheet reaches the LLM as rows of cells", x1.took === true && /--- sheet: Sales \(3 rows, tab-separated\) ---/.test(ask) && /Apples\t120/.test(ask) && /Fruit report/.test(reply), { x1, ask: ask.slice(-500), reply });
    await p.waitForTimeout(600);
    const x2 = await ev((id) => { const E = window.imageEditorInstance.E, W = E.S.layers.find((x) => x.id === id), N = E.S.layers.find((x) => x.anchor && x.aidoc && x.anchor.flow === W.doc.flow.id);
      const b = N && N.anchor.box; return { html: W.doc.html, box: b, drawn: N && N.anchor.drawn, fr: { y: W.doc.y }, src: N && /^data:image\/svg/.test(N.anchor.src) }; }, x1.id);
    check("…the chart sits in the text after \"Apples led the quarter.\" (its place, then its caption), drawn from the chart's SVG",
      /Apples led the quarter\.<\/p><p data-fig=/.test(x2.html) && x2.box && x2.box.y > x2.fr.y + 40 && x2.drawn && x2.src, x2);
    const dx = await ev((id) => { const E = window.imageEditorInstance.E, W = E.S.layers.find((x) => x.id === id), m = E.docx.modelOf(W), im = m.blocks.find((b) => b.t === "img");
      return { kinds: m.blocks.map((b) => b.t), png: im && im.png ? im.png.slice(0, 8) : null, w: im && im.w, h: im && im.h }; }, x1.id);
    check("…exported to Word the chart goes in as a picture at its place in the text", dx.png === "iVBORw0K" && dx.w > 100 && dx.h > 50 && dx.kinds.indexOf("img") > 0, dx);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { await api("POST", "api/config", { llm: llm0 }); } catch (e) { /* fine */ }
    await b.close(); llm.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
