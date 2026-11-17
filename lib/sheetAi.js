// lib/sheetAi.js — ▦ ✨ DASHBOARD PLAN BY THE LLM (2.824.0).
//
// Tim: "can we use the llm to look through an excel file and format it like a dashboard in our spreadsheet". The page
// (ext/sheetdock/sheetdash.js profile) sends the SHAPE of the data - columns, their kinds, a few values, totals - never
// every row; the LLM (the prompt docker's: lib/llmChat.complete, like lib/mailAi.js) answers with one JSON plan, which
// the page checks against the real columns before it builds anything (validate). setComplete(fn) for tests.
//   profileText(profile) -> the words the LLM reads       parsePlan(text) -> the JSON object (or null)
//   dashboardPlan(profile, ask) -> {plan}
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
module.exports = { setComplete, profileText, parsePlan, dashboardPlan, SYSTEM };
