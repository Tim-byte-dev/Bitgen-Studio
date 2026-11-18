// lib/docAi.js — 📄 ✨ A DOCUMENT WRITTEN BY THE LLM INTO A WP LAYER (2.837.0).
// Tim: "if image editor layer is open and wp layer is selected and i ask the llm to write an article from documents i give it or
// create a report or write a story, can we have the llm automatically generate the documet with charts and tables etc in the wp
// layer? images, charts,tables can go in separate layers in a wp group."
// The prompt docker's LLM (lib/llmChat, like lib/slideAi.js) answers with ONE JSON plan, cleaned here; the page
// (ext/imageeditdock/pcdocai.js) writes the text + tables into the WP layer and makes the charts / pictures layers of a WP group.
//   planDoc({ask, text, kind, words, pictures, charts}) -> {doc: {title, blocks: [BLOCK]}}
//   BLOCK = {type: h1 | h2 | h3 | p | ul | ol | quote, text | items} | {type: table, caption, rows} | {type: chart, caption,
//           chart {type, title, cats, series}} | {type: image, caption, picture}
//   extract(name, buf) -> {text} a .txt / .md / .csv / .xlsx (ExcelJS, 2.838.0) / .docx (mammoth) document's words (PDFs are read in the page with pdf.js)
"use strict";
const SA = require("./slideAi");
const SC = require("../ext/slidesdock/slidecore.js");
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim().slice(0, n);
let completeFn = null;
function setComplete(fn) { completeFn = fn; }
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
const KINDS = ["article", "report", "story", "essay", "letter", "summary", "document"];
const TYPES = ["h1", "h2", "h3", "p", "ul", "ol", "quote", "table", "chart", "image"];
function cleanDoc(o, opt) {
  const p = o && typeof o === "object" ? o : {}, a = opt || {};
  let nTab = 0, nChart = 0, nImg = 0;
  const blocks = [];
  for (const b of (Array.isArray(p.blocks) ? p.blocks : []).slice(0, 400)) {
    if (!b || typeof b !== "object") continue;
    const t = TYPES.includes(b.type) ? b.type : b.type === "bullets" || b.type === "list" ? "ul" : b.type === "heading" ? "h2" : b.type === "paragraph" ? "p" : null;
    if (!t) continue;
    if (t === "ul" || t === "ol") { const items = (Array.isArray(b.items) ? b.items : String(b.text || "").split("\n")).map((x) => clip(x, 600).replace(/^[-*•]\s+|^\d+[.)]\s+/, "")).filter(Boolean).slice(0, 40); if (items.length) blocks.push({ type: t, items }); continue; }
    if (t === "table") { if (a.tables === false || ++nTab > 12) continue; const rows = SC.cleanRows(b.rows); if (!rows.length || (rows.length < 2 && rows[0].length < 2)) continue; blocks.push({ type: t, caption: clip(b.caption, 200), rows, head: b.head !== false }); continue; }
    if (t === "chart") { if (a.charts === false || ++nChart > 10) continue; const ch = SC.cleanChart(b.chart || b); if (!ch.cats.length || !ch.series.length) continue; blocks.push({ type: t, caption: clip(b.caption || ch.title, 200), chart: ch }); continue; }
    if (t === "image") { if (!a.pictures || ++nImg > 8) continue; const pic = clip(b.picture || b.prompt || b.text, 400); if (pic) blocks.push({ type: t, caption: clip(b.caption, 200), picture: pic }); continue; }
    const text = clip(b.text, t === "p" || t === "quote" ? 6000 : 300); if (text) blocks.push({ type: t, text });
  }
  return { title: clip(p.title, 200), blocks };
}
const SYSTEM = `You write documents (articles, reports, stories, essays, letters) for a word processor. Answer with ONE JSON object and nothing else:
{"title": "...", "blocks": [
  {"type": "h1|h2|h3", "text": "a heading"},
  {"type": "p", "text": "a paragraph"}, {"type": "quote", "text": "..."},
  {"type": "ul|ol", "items": ["...", "..."]},
  {"type": "table", "caption": "Table 1: ...", "rows": [["Heading", "Heading"], ["cell", "cell"]]},
  {"type": "chart", "caption": "Figure 1: ...", "chart": {"type": "column|bar|line|area|pie|doughnut", "title": "...", "cats": ["..."], "series": [{"name": "...", "values": [1, 2]}]}},
  {"type": "image", "caption": "...", "picture": "what the picture shows, one sentence for an image generator"}]}
Rules: write in the language of the request; keep to the facts and numbers of the given documents when there are any - never invent numbers for tables or charts (no numbers to use = no chart); a story has no tables or charts; put each table / chart / picture where it belongs in the text, right after the paragraph that talks about it; a spreadsheet's sheets come as tab-separated rows - total, compare and chart them from those cells.`;
async function planDoc(o) {
  const a = o || {}, ask = clip(a.ask, 3000), text = clip(a.text, 60000), kind = KINDS.includes(a.kind) ? a.kind : "document";
  const words = Math.max(150, Math.min(6000, Math.round(+a.words || 800)));
  if (!ask && !text) throw bad("say what to write (or give the documents to write it from)");
  const user = `Write ${kind === "document" ? "a document" : "a" + (/^[aeiou]/.test(kind) ? "n " : " ") + kind} of about ${words} words.\nThe request: ${ask || "(write it from the documents)"}\n`
    + (text ? `\nThe documents to write it from:\n"""\n${text}\n"""\n` : "")
    + `\n${a.tables === false ? "No tables." : "Tables where the facts call for them."} ${a.charts === false ? "No charts." : "Charts where there are numbers to show."} ${a.pictures ? "Up to 3 pictures (type image) where they help." : "No pictures."}\n\nThe JSON:`;
  const r = await call({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }], temperature: kind === "story" ? 0.8 : 0.4, max_tokens: Math.min(16000, 1200 + words * 3) });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  const plan = SA.parsePlan(r.text);
  if (!plan) throw bad("the LLM's answer was not a document - try again", 502);
  const d = cleanDoc(plan, a);
  if (!d.blocks.length) throw bad("the LLM's document was empty - try again", 502);
  return { doc: d };
}
/** 2.838.0: a workbook (.xlsx, ExcelJS MIT) -> each sheet as tab-separated rows (formulas as their saved results, dates as
 *  YYYY-MM-DD, empty rows / columns at the ends left out; at most 2000 rows a sheet) */
async function sheetText(buf) {
  const ExcelJS = require("exceljs"), wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); } catch (e) { throw bad("that workbook could not be read: " + e.message); }
  const cell = (v) => {
    if (v == null) return "";
    if (v instanceof Date) return isNaN(v) ? "" : v.toISOString().slice(0, 10);
    if (typeof v === "object") { if ("result" in v) return cell(v.result); if (v.richText) return v.richText.map((r) => r.text).join(""); if ("text" in v) return String(v.text); if (v.error) return String(v.error); return ""; }
    return String(v).replace(/[\t\r\n]+/g, " ").trim();
  };
  const out = [];
  wb.eachSheet((ws) => {
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => { if (rows.length >= 2000) return; const vals = []; for (let c = 1; c <= Math.min(ws.columnCount || row.cellCount, 60); c++) vals.push(cell(row.getCell(c).value)); while (vals.length && !vals[vals.length - 1]) vals.pop(); if (vals.some(Boolean)) rows.push(vals.join("\t")); });
    if (rows.length) out.push(`--- sheet: ${ws.name} (${rows.length} rows, tab-separated) ---\n` + rows.join("\n"));
  });
  if (!out.length) throw bad("that workbook has no cells with anything in them");
  return out.join("\n\n");
}
/** a document's words: .txt / .md / .csv / .tsv / .json / .html as text, .docx through mammoth (BSD-2) */
async function extract(name, buf) {
  const n = String(name || ""), b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || "");
  if (!b.length) throw bad("the file is empty");
  if (/\.xlsx$/i.test(n)) return { text: clip(await sheetText(b), 200000) };   // 2.838.0: a workbook's sheets as rows of cells
  if (/\.docx$/i.test(n)) { const m = await require("mammoth").extractRawText({ buffer: b }); return { text: clip(m.value, 200000) }; }
  if (/\.(txt|md|markdown|csv|tsv|json|html?|xml|rtf)$/i.test(n)) { let t = b.toString("utf8"); if (/\.html?$/i.test(n)) t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "); return { text: clip(t, 200000) }; }
  throw bad(`${n || "that file"}: send a .txt, .md, .csv, .xlsx, .docx or .pdf`);
}
module.exports = { setComplete, cleanDoc, planDoc, extract, sheetText, SYSTEM, KINDS };
