#!/usr/bin/env node
/* bitGen Studio — 2.837.0 in a REAL browser: the image editor. Tim: "if a shape is selected , shapes created with pen tool or
 * line/bezier tools and generate is pressed in prompt then fill the shape with the generation, remove the generation outside the
 * shape so it "fills" the shape. allow a shape that was drawn with the pen tool to be converted to a shape so it's border, fill etc
 * can be changed. if image editor layer is open and wp layer is selected and i ask the llm to write an article from documents i give
 * it or create a report or write a story, can we have the llm automatically generate the documet with charts and tables etc in the
 * wp layer? images, charts,tables can go in separate layers in a wp group."
 *   A closed shape picked + ✨ Generate -> the picture asked at its box, put INTO the shape (a frame holding it); an open line ->
 *   a layer cut to the area it encloses; ⬟ Convert to Shape on a line (fill + border, one undo); a WP layer picked + "write a
 *   report …" in the prompt docker (a stand-in LLM, a .txt document given on its ＋) -> the text and a table in the WP layer, a
 *   chart and a picture as layers, all in a "📄 …" group; Ctrl+Z takes it back. Against the running app (H3_URL). */
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
const PLAN = { title: "Fruit sales", blocks: [{ type: "h2", text: "Summary" }, { type: "p", text: "Apples sold best this quarter." },
  { type: "table", caption: "Table 1: units", rows: [["Fruit", "Units"], ["Apples", "120"], ["Pears", "80"]] },
  { type: "chart", caption: "Figure 1: units sold", chart: { type: "column", title: "Units", cats: ["Apples", "Pears"], series: [{ name: "Units", values: [120, 80] }] } },
  { type: "image", caption: "An orchard", picture: "an apple orchard" }, { type: "p", text: "Pears did well too." }] };
function llmServer() {
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const all = (j.messages || []).map((m) => m.content).join("\n"); asked.push(all);
      const text = /You write documents/.test(all) ? "```json\n" + JSON.stringify(PLAN) + "\n```" : "an ordinary chat answer";
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
  }).listen(0, "127.0.0.1");
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const llm = llmServer(); await new Promise((r) => llm.on("listening", r));
  const cfg0 = await api("GET", "api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  await api("POST", "api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stand-in" } });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const pngOf = (w, h, col) => ev(([w, h, col]) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, w, h); return c.toDataURL("image/png").split(",")[1]; }, [w, h, col]);
  const jobs = [];
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.aiFill && window.imageEditorInstance.E.docAi && window.H3ImgOp, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1600px;height:900px;z-index:9999"; });
    await p.waitForTimeout(400);
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 800, 600); window.imageEditorInstance.load(c.toDataURL("image/png"), "f837"); setTimeout(() => { window.imageEditorInstance.E.fitView(); ok(); }, 800); }));
    await ev(() => { const g = document.getElementById("genModeSel"); if (g.value !== "image") { g.value = "image"; if (g.onchange) g.onchange(); } window.H3ImgOp.set("generate"); });

    // ---- a closed shape picked: the picture inside it (a frame)
    const s1 = await ev(() => { const E = window.imageEditorInstance.E, L = E.makeLayer("Ellipse", E.S.w, E.S.h, "shape");
      L.shape = Object.assign({}, E.D.SHAPE_DEFAULT, { kind: "ellipse", x: 200, y: 150, w: 400, h: 300 }); E.D.rasterize(L); E.addLayer(L, "shape"); E.deselect();
      const wh = window.H3ImageSize({}); return { wh, place: E.aiFill.placing(), id: L.id, n: E.S.layers.length }; });
    check("a closed shape picked + ✨ Generate: the picture asked at the shape's box (400 x 300 -> 4:3), the place remembered as a closed shape",
      s1.wh && Math.abs(s1.wh.width / s1.wh.height - 4 / 3) < 0.03 && s1.place && s1.place.shape && s1.place.closed && s1.place.box.w === 400, s1);
    const g1 = await pngOf(s1.wh.width, s1.wh.height, "#20c040");
    await p.route("**/outputs/t837a.png*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(g1, "base64") }));
    const n1 = await ev(() => window.H3OnGenerated({ outputs: ["t837a.png"], text: "a meadow" }));
    const a1 = await ev((id) => { const E = window.imageEditorInstance.E, F = E.S.layers.find((x) => x.id === id), N = E.S.layers.find((x) => x.parent === id);
      const px = (x, y) => Array.from(N.canvas.getContext("2d").getImageData(x, y, 1, 1).data); 
      return { frame: !!(F && F.frame), kid: !!N, mid: N && px(400, 300), out: N && px(100, 100), n: E.S.layers.length }; }, s1.id);
    check("…the picture goes INTO the shape: a layer inside it (the shape is now a frame holding it - it moves with the shape), nothing outside the box",
      n1 === 1 && a1.frame && a1.kid && a1.mid[1] > 150 && a1.mid[3] === 255 && a1.out[3] === 0 && a1.n === s1.n + 1, a1);

    // ---- an open line picked: a layer cut to the area it encloses
    const s2 = await ev(() => { const E = window.imageEditorInstance.E, A = (x, y) => ({ x, y, ix: x, iy: y, ox: x, oy: y });
      E.setActive(0); const L = E.vline.newLine({ closed: false, pts: [A(100, 100), A(500, 100), A(100, 500)] }, "V line"); E.setActive(E.S.layers.indexOf(L));
      return { wh: window.H3ImageSize({}), place: E.aiFill.placing(), line: E.aiFill.isLine(L), n: E.S.layers.length, id: L.id }; });
    check("an open line (the vector line tools) picked: asked at its box (400 x 400), the place = not closed", s2.line && s2.wh && Math.abs(s2.wh.width / s2.wh.height - 1) < 0.03 && s2.place && s2.place.shape && !s2.place.closed, s2);
    const g2 = await pngOf(s2.wh.width, s2.wh.height, "#c04020");
    await p.route("**/outputs/t837b.png*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(g2, "base64") }));
    const n2 = await ev(() => window.H3OnGenerated({ outputs: ["t837b.png"], text: "fire" }));
    const a2 = await ev(() => { const E = window.imageEditorInstance.E, N = E.layer(), px = (x, y) => Array.from(N.canvas.getContext("2d").getImageData(x, y, 1, 1).data);
      return { name: N.name, inside: px(180, 180), outside: px(450, 450), n: E.S.layers.length }; });
    check("…a layer above it with the picture only inside the area the line encloses (outside the triangle: empty)", n2 === 1 && a2.n === s2.n + 1 && a2.inside[0] > 150 && a2.inside[3] === 255 && a2.outside[3] === 0, a2);

    // ---- ⬟ Convert to Shape
    const c1 = await ev((id) => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.id === id); E.setActive(E.S.layers.indexOf(L));
      const menu = !!E.ui.CMD.get("shape.convert") && E.ui.CMD.get("shape.convert").enabled() && (E.ui.stageCtxItems || []).includes("shape.convert");
      E.ui.run("shape.convert"); const sh = L.shape;
      const after = { line: !!sh.line, closed: sh.path.subs.every((q) => q.closed), fillOn: sh.fillOn, strokeOn: sh.strokeOn, w: sh.strokeW, isShape: E.frames.isClosedShape(L) };
      E.undo(); return { menu, after, back: !!L.shape.line || !!E.S.layers.find((x) => x.id === id).shape.line }; }, s2.id);
    check("⬟ Convert to Shape (Layer menu + right-click) on a line: a closed shape with a fill and a border you can change (and a frame for pictures); one undo",
      c1.menu && !c1.after.line && c1.after.closed && c1.after.fillOn && c1.after.strokeOn && c1.after.w >= 1 && c1.after.isShape && c1.back, c1);

    // ---- the LLM writes a document into the WP layer
    await p.route("**/api/genimage", async (r) => { jobs.push(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "t837job", status: "queued" }) }); });
    await p.route("**/api/jobs/t837job", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "t837job", status: "done", outputs: ["t837c.png"] }) }));
    const g3 = await pngOf(64, 40, "#2050e0");
    await p.route("**/outputs/t837c.png*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(g3, "base64") }));
    const w0 = await ev(() => { const E = window.imageEditorInstance.E; E.docText.addFrame(50, 40, 700, 520, {}, false); E.docText.end(); const W = E.layer();
      const sty = document.getElementById("styleSel"); if (sty && !sty.value && sty.options.length) sty.value = sty.options[0].value;
      if (sty && !sty.value) { const o = document.createElement("option"); o.value = "t837style"; o.textContent = "t"; sty.appendChild(o); sty.value = "t837style"; }
      const took = window.H3DocAi.takeFile(new File(["Apples 120 units, pears 80 units."], "sales.txt", { type: "text/plain" }));
      return { id: W.id, type: W.type, took, h: W.doc.h, first: window.H3ChatRoutes[0] && window.H3ChatRoutes[0].toString().includes("wants(text)"), steps: E.S.history ? E.S.history.length : null }; });
    check("a WP layer picked: a .txt given on the prompt docker's ＋ is held for the write; the document route goes first", w0.type === "doc" && w0.took === true && w0.first, w0);
    const reply = await ev(() => window.H3ChatRoutes[0]("Write a report on our fruit sales from this document, with pictures"));
    const llmAsk = asked.find((a) => /You write documents/.test(a)) || "";
    check("\"write a report … with pictures\" -> the LLM gets the request, the kind and the document's words", /a report of about/.test(llmAsk) && /Apples 120 units/.test(llmAsk) && /Up to 3 pictures/.test(llmAsk), llmAsk.slice(0, 600));
    await p.waitForTimeout(3500);
    const d1 = await ev((id) => { const E = window.imageEditorInstance.E, W = E.S.layers.find((x) => x.id === id), G = E.S.layers.find((x) => x.id === W.parent);
      const kids = G ? E.S.layers.filter((x) => x.parent === G.id) : [];
      const fig = (k) => { const L = kids.find((x) => x.aidoc && x.aidoc.kind === k); if (!L) return null; const c = L.aidoc.cell, d = L.canvas.getContext("2d").getImageData(c.x, c.y, c.w, c.h).data; let n = 0, blue = 0; for (let i = 3; i < d.length; i += 16) { if (d[i] > 0) n++; if (d[i - 1] > 180 && d[i - 3] < 80) blue++; } return { name: L.name, n, blue, cell: c }; };
      return { html: W.doc.html, h: W.doc.h, group: G && G.type === "group" && G.name, kids: kids.length, chart: fig("chart"), pic: fig("image") }; }, w0.id);
    check("…the WP layer holds the title, headings, paragraphs and a real WP table (thead), the chart / picture as caption lines",
      /<h1>Fruit sales<\/h1>/.test(d1.html) && /<h2>Summary<\/h2>/.test(d1.html) && /<table[^>]*>.*<thead>.*Fruit.*Apples.*<\/table>/.test(d1.html) && /<i>Figure 1: units sold<\/i>/.test(d1.html) && /Pears did well too/.test(d1.html), d1.html.slice(0, 700));
    check("…a \"📄 Fruit sales\" WP group: the WP layer + the chart layer + the picture layer; the frame shorter to leave them room",
      d1.group === "📄 Fruit sales" && d1.kids === 3 && d1.h < w0.h && d1.chart && d1.pic && d1.chart.cell.y >= 40 + d1.h, d1);
    check("…the chart drawn by the spreadsheet's chart engine in its layer; the picture made with the prompt docker's image style and put in its box",
      d1.chart.n > 50 && jobs.length === 1 && /an apple orchard/.test(jobs[0].prompt) && !!jobs[0].style_id && d1.pic.blue > 50, { chart: d1.chart, pic: d1.pic, jobs });
    check("…the reply in the chat says what was made", /Fruit sales/.test(reply) && /table/.test(reply) && /group/.test(reply), reply);
    const u1 = await ev((id) => { const E = window.imageEditorInstance.E; E.undo(); E.undo(); E.undo(); const W = E.S.layers.find((x) => x.id === id); return { html: W.doc.html, parent: W.parent, groups: E.S.layers.filter((x) => x.name === "📄 Fruit sales").length }; }, w0.id);
    check("…Ctrl+Z (picture, chart, then the text) takes it all back: the WP layer as it was, no group", !/Fruit sales/.test(u1.html) && !u1.groups, u1);
    const dl = await ev(() => { const E = window.imageEditorInstance.E; const ok = E.ui.CMD.get("layer.docai") && E.ui.CMD.get("layer.docai").enabled(); E.ui.run("layer.docai"); const d = document.querySelector(".kxdlg.pcd"); const r = { ok, title: d && d.querySelector("h4").textContent, ask: !!(d && d.querySelector("#pdaAsk")), files: !!(d && d.querySelector("#pdaFiles")) }; if (d) d.querySelector(".cn").click(); return r; });
    check("Layer ▸ ✨ Write With the AI… opens its box (the request, kind, words, tables / charts / pictures, documents)", dl.ok && dl.title === "✨ Write With the AI" && dl.ask && dl.files, dl);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { await api("POST", "api/config", { llm: llm0 }); } catch (e) { /* fine */ }
    await b.close(); llm.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
