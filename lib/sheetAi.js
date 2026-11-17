// lib/sheetAi.js — ▦ ✨ DASHBOARD PLAN BY THE LLM (2.824.0).
//
// Tim: "can we use the llm to look through an excel file and format it like a dashboard in our spreadsheet". The page
// (ext/sheetdock/sheetdash.js profile) sends the SHAPE of the data - columns, their kinds, a few values, totals - never
// every row; the LLM (the prompt docker's: lib/llmChat.complete, like lib/mailAi.js) answers with one JSON plan, which
// the page checks against the real columns before it builds anything (validate). setComplete(fn) for tests.
//   profileText(profile) -> the words the LLM reads       parsePlan(text) -> the JSON object (or null)
//   dashboardPlan(profile, ask) -> {plan}
// 2.825.0 (Tim: "lets go next" - ✨ AI in the spreadsheet). The page (ext/sheetdock/sheetai.js) sends the table's SHAPE
// (column letters, headings, kinds, a few values) and, for Fill from examples, the example rows; the page checks every
// answer itself (a formula is worked out against the examples before it goes in).
//   contextText(ctx)                         -> the words the LLM reads about the sheet
//   writeFormula(ctx, ask)                   -> {formula, explain}
//   explainFormula(ctx, formula, values)     -> {text}
//   fillFormula(ctx, examples, failed)       -> {formula}          (one formula for the column, written for the first example's row)
//   fillValues(ctx, examples, rows)          -> {values: {row: value}}   (when no formula fits the examples)
"use strict";

let completeFn = null;
function setComplete(fn) { completeFn = fn; }
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }

const num = (n) => (typeof n === "number" && isFinite(n) ? (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString("en-US") : String(+n.toPrecision(4))) : "");
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").slice(0, n);
function profileText(p) {
  const L = [];
  for (const S of ((p && p.sheets) || []).slice(0, 4)) {
    L.push(`Sheet "${clip(S.name, 60)}": ${+S.rows || 0} rows of data, headings in row ${(+S.header || 0) + 1}`);
    for (const c of (S.cols || []).slice(0, 40)) {
      const n = `- "${clip(c.name, 60)}": `;
      if (c.type === "number") L.push(n + `${c.kind === "money" ? "money" : c.kind === "percent" ? "percent" : c.kind === "integer" ? "whole numbers" : "numbers"}, total ${num(c.sum)}, lowest ${num(c.min)}, highest ${num(c.max)}, average ${num(c.avg)}`);
      else if (c.type === "date") L.push(n + `dates from ${clip(c.from, 12)} to ${clip(c.to, 12)}`);
      else L.push(n + `text, ${+c.distinct || 0} different values` + (Array.isArray(c.top) && c.top.length ? ` (most common: ${c.top.slice(0, 6).map((t) => clip(t, 30)).join(", ")})` : ""));
    }
  }
  return L.join("\n");
}
const SYSTEM = `You design dashboards for spreadsheets. You are given the columns of a workbook's data (not the rows). Answer with ONE JSON object and nothing else:
{"title": "...", "subtitle": "...", "sheet": "<the data sheet's name>",
 "kpis": [{"label": "...", "func": "SUM|AVERAGE|COUNT|MIN|MAX", "column": "<column name>", "format": "currency|number|integer|percent|date"}],
 "breakdowns": [{"title": "...", "by": "<a text column>", "value": "<a number column, or null to count rows>", "func": "SUM|AVERAGE|COUNT", "top": 8, "chart": "column|bar|pie|doughnut|line|area"}],
 "trend": {"title": "...", "date": "<a date column>", "value": "<a number column, or null>", "func": "SUM|AVERAGE|COUNT", "period": "day|week|month|quarter|year", "chart": "line|area|column"},
 "formats": {"<column name>": "currency|number|integer|percent|date|text"},
 "theme": "blue|green|orange|purple|teal|grey"}
Rules: 2 to 6 kpis - the numbers a manager looks at first; 1 to 4 breakdowns by text columns that have a few different values (2 to 30); "trend" only when there is a date column, else null; use the column names exactly as given; money gets "currency"; pie or doughnut only for 6 values or fewer; titles under 40 characters; no comments, no markdown.`;
function parsePlan(text) {
  let t = String(text || "");
  try { t = require("./llmChat").stripThinking(t); } catch (e) { /* fine */ }
  t = t.replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  const body = t.slice(a, b + 1);
  for (const s of [body, body.replace(/,\s*([}\]])/g, "$1").replace(/\bNone\b/g, "null").replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false")]) { try { const o = JSON.parse(s); if (o && typeof o === "object") return o; } catch (e) { /* the next */ } }
  return null;
}
async function dashboardPlan(profile, ask) {
  if (!profile || !Array.isArray(profile.sheets) || !profile.sheets.length) throw Object.assign(new Error("no table to plan from"), { status: 400 });
  const user = "The workbook:\n" + profileText(profile) + (ask ? "\n\nWhat the user wants to see: " + clip(ask, 600) : "") + "\n\nThe JSON plan:";
  const r = await call({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }], temperature: 0.2, max_tokens: 1400 });
  if (!r || !r.ok) throw Object.assign(new Error("the LLM did not answer" + (r && r.error ? ": " + r.error : "")), { status: 502 });
  const plan = parsePlan(r.text);
  if (!plan) throw Object.assign(new Error("the LLM's answer was not a plan"), { status: 502 });
  return { plan };
}

/* ---------------------------------------------------------------- 2.825.0 ✨ formulas */
const bad = (m, status) => Object.assign(new Error(m), { status: status || 400 });
function contextText(ctx) {
  const c = ctx || {}, L = [];
  L.push(`Sheet "${clip(c.sheet, 60)}"` + (Array.isArray(c.sheets) && c.sheets.length > 1 ? ` (other sheets: ${c.sheets.filter((n) => n !== c.sheet).slice(0, 12).map((n) => `"${clip(n, 40)}"`).join(", ")})` : ""));
  if (c.table) L.push(`The table is ${clip(c.table, 20)}` + (c.header ? `, headings in row ${+c.header}, data in rows ${clip(c.rows, 20)}` : ""));
  for (const k of (Array.isArray(c.cols) ? c.cols : []).slice(0, 40)) L.push(`- column ${clip(k.col, 3)}${k.name ? ` "${clip(k.name, 60)}"` : ""}: ${clip(k.kind || "empty", 20)}` + (Array.isArray(k.sample) && k.sample.length ? `, e.g. ${k.sample.slice(0, 4).map((v) => JSON.stringify(clip(v, 40))).join(", ")}` : ""));
  if (c.cell) L.push(`The formula goes in cell ${clip(c.cell, 12)}` + (c.cellHeading ? ` (column "${clip(c.cellHeading, 60)}")` : ""));
  return L.join("\n");
}
const RULES = (fns) => `Only these functions exist: ${(Array.isArray(fns) ? fns : []).slice(0, 200).map((f) => clip(f, 16)).join(", ")}.
Write it the usual spreadsheet way: it starts with "=", English function names, commas between arguments, text in "double quotes", cell addresses like B2, ranges like B2:B120 or a whole column B:B, another sheet as 'Sheet name'!B2. A value worked out for one row uses that row's cells (relative, e.g. B2*C2); "$" only where an address must stay fixed when copied. No array formulas, no named ranges, no table[column] references, no LET / LAMBDA.`;
const FORMULA_SYS = (fns) => `You write spreadsheet formulas for people who describe what they want in words.
${RULES(fns)}
Answer with ONE JSON object and nothing else: {"formula": "=...", "explain": "<one or two plain sentences saying what it works out, naming the columns by their headings>"}`;
const EXPLAIN_SYS = `You explain a spreadsheet formula to someone who is not an expert: first one sentence on what it works out, then each part in the order it runs, naming the columns by their headings and saying what the numbers / text are. Plain words, under 130 words, no markdown headings (a short "-" list is fine).`;
const FILL_SYS = (fns) => `The user typed a few example values in one column of a table and wants the rest of the column filled the same way. Find the rule and write ONE formula that gives every example exactly (the same text, the same number).
${RULES(fns)}
The formula is written for the FIRST example's row; it is copied down to the other rows with only the row numbers changing.
Answer with ONE JSON object and nothing else: {"formula": "=...", "explain": "<one plain sentence: the rule>"}`;
const VALUES_SYS = `The user typed a few example values in one column of a table. Fill in the missing rows the same way, following the examples' pattern exactly (the same style, the same kind of value). Answer with ONE JSON object and nothing else: {"values": {"<row number>": "<value>", ...}} - one entry for every row asked for.`;
function cleanFormula(f) {
  let t = String(f == null ? "" : f).trim().replace(/^`+|`+$/g, "").trim();
  if (!t) return "";
  if (t[0] !== "=") t = "=" + t;
  return t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").slice(0, 2000);
}
async function ask(system, user, max) {
  const r = await call({ messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.1, max_tokens: max || 900 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  return r.text;
}
const rowsText = (examples, ctx) => (Array.isArray(examples) ? examples : []).slice(0, 40).map((e) => `row ${+e.row}: ` + Object.entries(e.cells || {}).slice(0, 30).map(([k, v]) => `${clip(k, 3)}=${JSON.stringify(clip(v, 80))}`).join(", ") + (e.out != null ? `  ->  ${clip(ctx && ctx.col, 3) || "answer"}=${JSON.stringify(clip(e.out, 120))}` : "")).join("\n");
async function writeFormula(ctx, words, fns) {
  if (!String(words || "").trim()) throw bad("say what the formula should work out");
  const text = await ask(FORMULA_SYS(fns), contextText(ctx) + "\n\nWhat the user wants: " + clip(words, 800) + "\n\nThe JSON:");
  const o = parsePlan(text), formula = cleanFormula(o && o.formula);
  if (!formula) throw bad("the LLM's answer had no formula", 502);
  return { formula, explain: clip(o.explain || "", 600) };
}
async function explainFormula(ctx, formula, values) {
  const f = cleanFormula(formula); if (!f) throw bad("no formula to explain");
  const vals = Array.isArray(values) && values.length ? "\nWhat its cells hold now: " + values.slice(0, 30).map((v) => `${clip(v.ref, 30)} = ${JSON.stringify(clip(v.value, 60))}`).join(", ") : "";
  let t = await ask(EXPLAIN_SYS, contextText(ctx) + `\n\nThe formula in ${clip(ctx && ctx.cell, 12) || "the cell"}: ${f}` + vals + (ctx && ctx.result != null ? `\nIts result now: ${JSON.stringify(clip(ctx.result, 80))}` : ""), 600);
  try { t = require("./llmChat").stripThinking(t); } catch (e) { /* fine */ }
  t = String(t || "").replace(/^\s*#+\s*/gm, "").trim();
  if (!t) throw bad("the LLM gave no explanation", 502);
  return { text: t.slice(0, 2000) };
}
async function fillFormula(ctx, examples, failed, fns) {
  if (!Array.isArray(examples) || !examples.length) throw bad("type an example or two in the column first");
  let user = contextText(ctx) + `\n\nThe column to fill: ${clip(ctx && ctx.col, 3)}` + (ctx && ctx.cellHeading ? ` "${clip(ctx.cellHeading, 60)}"` : "") + `\nThe examples (the row's other cells -> the value typed):\n` + rowsText(examples, ctx);
  if (Array.isArray(failed) && failed.length) user += `\n\nA formula tried before did not give the examples: ${failed.slice(0, 3).map((x) => `${cleanFormula(x.formula)} gave ${JSON.stringify(clip(x.got, 60))} in row ${+x.row} (wanted ${JSON.stringify(clip(x.want, 60))})`).join("; ")}. Write a different one.`;
  const o = parsePlan(await ask(FILL_SYS(fns), user + "\n\nThe JSON:")), formula = cleanFormula(o && o.formula);
  if (!formula) throw bad("the LLM's answer had no formula", 502);
  return { formula, explain: clip(o.explain || "", 400) };
}
async function fillValues(ctx, examples, rows) {
  if (!Array.isArray(examples) || !examples.length) throw bad("type an example or two in the column first");
  const want = (Array.isArray(rows) ? rows : []).slice(0, 200);
  if (!want.length) throw bad("no empty rows to fill");
  const o = parsePlan(await ask(VALUES_SYS, contextText(ctx) + `\n\nThe column to fill: ${clip(ctx && ctx.col, 3)}\nThe examples:\n` + rowsText(examples, ctx) + "\n\nThe rows to fill:\n" + rowsText(want.map((r) => ({ row: r.row, cells: r.cells })), ctx) + "\n\nThe JSON:", 3000));
  const v = o && (o.values || o), out = {};
  if (v && typeof v === "object") for (const r of want) { const x = v[String(r.row)]; if (x != null && typeof x !== "object") out[r.row] = clip(x, 500); }
  if (!Object.keys(out).length) throw bad("the LLM's answer had no values", 502);
  return { values: out };
}
module.exports = { setComplete, profileText, parsePlan, dashboardPlan, SYSTEM, contextText, cleanFormula, writeFormula, explainFormula, fillFormula, fillValues };
