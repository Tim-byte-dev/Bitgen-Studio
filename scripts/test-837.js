#!/usr/bin/env node
/* bitGen Studio — 2.837.0 units: Generate into a picked shape (closed: a frame; a line / open path: cut to it), ⬟ Convert to
 * Shape, and the LLM writing a document into a WP layer (lib/docAi.js + ext/imageeditdock/pcdocai.js).
 *   docAi cleanDoc / planDoc (a stand-in LLM) / extract (.txt, .docx through mammoth); pcdocai wants / toHtml (2.838.0: figureGrid gone - test-838.js);
 *   the wiring (routes/index.js mounts it, not server.js; ext.json; the prompt docker's documents). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const A = require(path.join(ROOT, "lib/docAi.js")), P = require(path.join(ROOT, "ext/imageeditdock/pcdocai.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
(async () => {
  // ---- cleanDoc
  const raw = { title: "Q3 Sales", blocks: [{ type: "heading", text: "Summary" }, { type: "paragraph", text: "Sales grew." }, { type: "bullets", text: "- one\n- two" },
    { type: "table", caption: "Table 1", rows: [["Region", "Sales"], ["North", "120"], ["South", "90"]] }, { type: "chart", caption: "Figure 1", chart: { type: "column", title: "Sales", cats: ["North", "South"], series: [{ name: "Sales", values: [120, 90] }] } },
    { type: "image", caption: "A shop", picture: "a busy shop" }, { type: "nonsense", text: "x" }, { type: "table", rows: [] }, null] };
  const d = A.cleanDoc(raw, { pictures: false });
  check("cleanDoc: heading / paragraph / bullets named as h2 / p / ul, a table and a chart kept, a picture only when pictures are asked for, rubbish dropped",
    d.title === "Q3 Sales" && d.blocks.map((b) => b.type).join() === "h2,p,ul,table,chart" && d.blocks[2].items.join() === "one,two" && d.blocks[3].rows.length === 3 && d.blocks[4].chart.series[0].values[1] === 90, d);
  check("cleanDoc: tables:false / charts:false leave them out; pictures:true keeps the picture",
    !A.cleanDoc(raw, { tables: false, charts: false }).blocks.some((b) => b.type === "table" || b.type === "chart") && A.cleanDoc(raw, { pictures: true }).blocks.some((b) => b.type === "image" && b.picture === "a busy shop"));
  // ---- planDoc with a stand-in LLM
  let seen = null;
  A.setComplete(async (o) => { seen = o; return { ok: true, text: "Here it is:\n```json\n" + JSON.stringify(raw) + "\n```" }; });
  const r = await A.planDoc({ ask: "write a report on these sales", text: "North 120, South 90", kind: "report", words: 500, pictures: true });
  check("planDoc: the request, kind, words and the documents go to the LLM; its JSON (in a code fence) comes back cleaned",
    r.doc.blocks.length === 6 && /a report of about 500 words/.test(seen.messages[1].content) && /North 120, South 90/.test(seen.messages[1].content) && /Up to 3 pictures/.test(seen.messages[1].content) && seen.messages[0].content === A.SYSTEM, seen && seen.messages[1].content);
  let e1 = null; try { await A.planDoc({}); } catch (e) { e1 = e; }
  A.setComplete(async () => ({ ok: true, text: "sorry, no" })); let e2 = null; try { await A.planDoc({ ask: "a story" }); } catch (e) { e2 = e; }
  A.setComplete(async () => ({ ok: false, error: "no model" })); let e3 = null; try { await A.planDoc({ ask: "a story" }); } catch (e) { e3 = e; }
  check("planDoc: nothing asked = 400; not JSON / no LLM = 502 with the reason", e1 && e1.status === 400 && e2 && e2.status === 502 && e3 && e3.status === 502 && /no model/.test(e3.message));
  A.setComplete(null);
  // ---- extract
  const t1 = await A.extract("notes.md", Buffer.from("# Hello\nworld"));
  const D = require("docx"), buf = await D.Packer.toBuffer(new D.Document({ sections: [{ children: [new D.Paragraph("Revenue rose 12 percent."), new D.Paragraph("Costs fell.")] }] }));
  const t2 = await A.extract("r.docx", buf);
  let e4 = null; try { await A.extract("x.exe", Buffer.from("MZ")); } catch (e) { e4 = e; }
  check("extract: .md as text, .docx through mammoth, anything else refused", /world/.test(t1.text) && /Revenue rose 12 percent\./.test(t2.text) && /Costs fell/.test(t2.text) && e4 && e4.status === 400, [t1, t2]);
  // ---- the page's pure parts
  const w1 = P.wants("Write a report from these documents with pictures"), w2 = P.wants("write a story about a dragon, about 1200 words"), w3 = P.wants("make the sky bluer"), w4 = P.wants("create a presentation about cats"), w5 = P.wants("draft a blog post on tea"), w6 = P.wants("write a report from this spreadsheet"), w7 = P.wants("create a spreadsheet report of the sales");
  check("wants: write / create / draft … article / report / story = a document (its kind, words, pictures); other asks and slides are not",
    w1 && w1.kind === "report" && w1.pictures && w2 && w2.kind === "story" && w2.words === 1200 && !w2.pictures && w3 === null && w4 === null && w5 && w5.kind === "article" && w6 && w6.kind === "report" && w7 === null, [w1, w2, w5, w6, w7]);
  const html = P.toHtml(Object.assign({}, d, { blocks: d.blocks.concat([{ type: "quote", text: "a < b & c" }]) }));
  check("toHtml: the title as h1, headings, list, a WP table (colgroup, thead), the chart as a caption line (figure 1), the text escaped",
    /^<h1>Q3 Sales<\/h1><h2>Summary<\/h2><p>Sales grew\.<\/p><ul><li>one<\/li><li>two<\/li><\/ul>/.test(html) && /<table style="width:100%;table-layout:fixed"><colgroup><col style="width:50%"><col style="width:50%"><\/colgroup><thead><tr><th>Region<\/th><th>Sales<\/th><\/tr><\/thead><tbody><tr><td>North<\/td>/.test(html)
    && /<p><i>Figure 1<\/i><\/p>/.test(html) && /<blockquote>a &lt; b &amp; c<\/blockquote>/.test(html), html);
  // ---- the wiring
  const RI = read("routes/index.js"), SV = read("misc/server.js"), EX = JSON.parse(read("ext/imageeditdock/ext.json")), IE = read("ext/imageeditdock/imageedit.js"), PD = read("ext/promptdock/promptdock.js"), PH = read("ext/promptdock/dock.html"), AF = read("ext/imageeditdock/pcaifill.js"), DA = read("ext/imageeditdock/pcdocai.js");
  check("/api/docai mounted from routes/index.js (not server.js); pcdocai.js loaded and installed", /require\("\.\/docAi"\)\.mount\(app\)/.test(RI) && !/docai/i.test(SV) && EX.scripts.indexOf("pcdocai.js") > EX.scripts.indexOf("pcdoctext.js") && EX.scripts.indexOf("pcdocai.js") < EX.scripts.indexOf("imageedit.js") && /PCDocAi\.install\(E\)/.test(IE) && IE.indexOf("PCDocAi.install(E)") > IE.indexOf("PCDocText.install(E)"));
  check("the prompt docker: ＋ takes .txt / .md / .docx / .pdf, a WP layer picked = they are held for the write (H3DocAi.takeFile); the route goes first",
    /\.docx/.test(PH) && /\.pdf/.test(PH) && /window\.H3DocAi && window\.H3DocAi\.takeFile\(f\)\) continue;/.test(PD) && /root\.H3ChatRoutes = \[maybe\]\.concat/.test(DA));
  check("the document: one undo (structOp) for the text and the figure layers; a WP group; charts from SheetChart, pictures from /api/genimage",
    /E\.structOp\("✨ write the document"/.test(DA) && /D\.group\(S\.layers, ids, G\)/.test(DA) && /SC\.svg\(/.test(DA) && /\/api\/genimage/.test(DA) && /layer\.docai/.test(DA));
  check("pcaifill: a picked shape = H3ImageSize at its box; a closed shape takes the picture as its frame (placeResult), a line / open path cuts it (destination-in)",
    /isShape\(L\)/.test(AF) && /shape: true, closed:/.test(AF) && /E\.frames\.placeResult\(N, F\)/.test(AF) && /shapeArea\(F\)/.test(AF));
  check("⬟ Convert to Shape: in the Layer menu and on the canvas's right-click; a vector line closed with a fill and a border; a Paths path through Shape Layer from Path",
    /addCmd\("shape\.convert", "⬟ Convert to Shape"/.test(AF) && /stageCtxItems = .*"shape\.convert"/.test(AF) && /delete sh\.line/.test(AF) && /E\.ui\.run\("path\.shape"\)/.test(AF));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
