// lib/dbAi.js — 🗄 ✨ THE LLM DESIGNS THE DATABASE (2.842.0): tables, fields, keys and views from what you describe, as SQL you see
// (and can change) before it runs (lib/dbServer.js run). The prompt docker's LLM (lib/llmChat), like lib/docAi.js.
//   design({ask, schema, flavor}) -> {sql, explain, statements}
//   checkSql(sql) -> the statements, or why not - only CREATE TABLE / VIEW / INDEX, ALTER TABLE, INSERT (sample rows),
//   CREATE OR REPLACE VIEW, DROP VIEW; no DROP TABLE / DATABASE, no GRANT, no users, no files (a design never destroys data).
"use strict";
const DB = require("./dbServer");
let completeFn = null;
function setComplete(fn) { completeFn = fn; }
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const OK = /^(CREATE\s+(TABLE|(OR\s+REPLACE\s+)?(ALGORITHM\s*=\s*\w+\s+)?VIEW|(UNIQUE\s+|FULLTEXT\s+)?INDEX)|ALTER\s+TABLE|INSERT\s+INTO|DROP\s+VIEW)\b/i;
const NEVER = /\b(GRANT|REVOKE|CREATE\s+USER|DROP\s+(TABLE|DATABASE|SCHEMA|USER)|TRUNCATE|INTO\s+(OUT|DUMP)FILE|LOAD\s+DATA|LOAD_FILE|SHUTDOWN)\b/i;
function checkSql(sql) {
  const list = DB.splitSql(sql), out = [], why = [];
  for (const s of list) { if (NEVER.test(s)) why.push("not in a design: " + s.slice(0, 60)); else if (!OK.test(s)) why.push("not a table / view / index / sample row: " + s.slice(0, 60)); else out.push(s); }
  return { statements: out, problems: why };
}
const SYSTEM = `You design MariaDB / MySQL databases. Answer with ONE JSON object and nothing else:
{"explain": "two or three sentences: the tables and views and why", "sql": "the SQL, statements ending with ;"}
Rules: MariaDB 10.6+ SQL; CREATE TABLE IF NOT EXISTS with an INT UNSIGNED AUTO_INCREMENT PRIMARY KEY named id, sensible types (VARCHAR with lengths, DECIMAL(12,2) for money, DATE / DATETIME, TINYINT(1) for yes/no, TEXT for long words), NOT NULL where a value is always there, DEFAULT CURRENT_TIMESTAMP for created_at, FOREIGN KEY ... REFERENCES for links between tables (ON DELETE RESTRICT unless it is clearly owned), an INDEX on columns that are searched; CREATE OR REPLACE VIEW for the reports and summaries asked for (joins, totals, counts); ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; names in snake_case English; to change existing tables use ALTER TABLE (never DROP TABLE); a few INSERT rows of sample data only when asked; tables in an order that lets every foreign key work.`;
async function design(o) {
  const a = o || {}, ask = String(a.ask || "").trim().slice(0, 6000); if (!ask) throw bad("say what the database is for");
  const sc = a.schema && Array.isArray(a.schema.tables) ? a.schema.tables : [];
  const have = sc.length ? sc.map((t) => `${t.kind === "view" ? "VIEW" : "TABLE"} ${t.name} (${(t.columns || []).map((c) => c.name + " " + c.type + (c.key === "PRI" ? " PK" : "") + (c.ref ? " -> " + c.ref : "")).join(", ")})`).join("\n") : "(empty - a new database)";
  const user = `The database${a.db ? " " + a.db : ""} now:\n${have}\n\nWhat is wanted: ${ask}\n\nThe JSON:`;
  const r = await call({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }], temperature: 0.2, max_tokens: 6000 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  let p = require("./slideAi").parsePlan(r.text);
  if (!p || typeof p.sql !== "string") { const m = /```sql\s*([\s\S]*?)```/i.exec(r.text || ""); if (m) p = { sql: m[1], explain: "" }; }
  if (!p || typeof p.sql !== "string" || !p.sql.trim()) throw bad("the LLM's answer had no SQL - try again", 502);
  const chk = checkSql(p.sql);
  if (!chk.statements.length) throw bad("the LLM's SQL had nothing bitGen runs in a design: " + chk.problems.join("; "), 502);
  return { sql: chk.statements.join(";\n\n") + ";", explain: String(p.explain || "").slice(0, 2000), statements: chk.statements.length, left: chk.problems };
}
module.exports = { setComplete, design, checkSql, SYSTEM };
