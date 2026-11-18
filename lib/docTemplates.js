// lib/docTemplates.js — 🧾 DOCUMENT TEMPLATES (invoices, quotes, receipts …) for the image editor (2.841.0).
// Tim (verbatim): "allow user to create a template in image editor so user can create invoices, user can talk to llm or type
// invoice needs."
//   <app>/doc_templates/<name>.bgi   the template document (the editor's own .bgi - pages, WP frames, text layers with
//                                    {{field}} placeholders and a line-item table row of {{item.*}})
//   <app>/doc_templates/<name>.json  its meta {name, kind, prefix, digits, next, taxRate, currency, dueDays, defaults}
//   Built-in templates (Invoice / Quote / Receipt) are made in the page (ext/imageeditdock/pcdoctpl.js) - only their meta
//   (the number counter) is kept here, as _builtin-<kind>.json.
//   fillPlan(o) - the prompt docker's LLM turns "invoice Acme for 3 hours of design at $90" into {fields, items}; the sums are
//   worked out by bitGen (never the LLM).
"use strict";
const fs = require("fs"), path = require("path");
let BASE = null, completeFn = null;
function setBase(b) { BASE = b; }
function setComplete(fn) { completeFn = fn; }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
function dir() { const d = path.join(BASE || require("./core").BASE, "doc_templates"); fs.mkdirSync(d, { recursive: true }); return d; }
const KINDS = ["invoice", "quote", "receipt", "order", "letter", "other"];
const PREFIX = { invoice: "INV-", quote: "QUO-", receipt: "REC-", order: "PO-", letter: "", other: "" };
function safe(n) {
  const s = String(n || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!s || s === "." || s === "..") throw bad("give the template a name");
  return s;
}
function cleanMeta(m, name) {
  const o = m && typeof m === "object" ? m : {}, kind = KINDS.includes(o.kind) ? o.kind : "invoice";
  const num = (v, d, lo, hi) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const defaults = {};
  if (o.defaults && typeof o.defaults === "object") for (const [k, v] of Object.entries(o.defaults).slice(0, 60)) if (/^[\w.-]{1,40}$/.test(k)) defaults[k] = String(v == null ? "" : v).slice(0, 2000);
  return { name, kind, prefix: String(o.prefix == null ? PREFIX[kind] : o.prefix).replace(/[^\w./-]/g, "").slice(0, 12), digits: num(o.digits, 4, 1, 10) | 0,
    next: num(o.next, 1, 1, 1e9) | 0, taxRate: num(o.taxRate, 10, 0, 100), currency: String(o.currency == null ? "$" : o.currency).slice(0, 6), dueDays: num(o.dueDays, 14, 0, 365) | 0, defaults };
}
const metaPath = (n) => path.join(dir(), n + ".json"), bgiPath = (n) => path.join(dir(), n + ".bgi");
function readMeta(name) { const n = safe(name); try { return cleanMeta(JSON.parse(fs.readFileSync(metaPath(n), "utf8")), n); } catch (e) { return cleanMeta({ kind: /^_builtin-(\w+)$/.exec(n) ? /^_builtin-(\w+)$/.exec(n)[1] : "invoice" }, n); } }
function writeMeta(m) { fs.writeFileSync(metaPath(m.name), JSON.stringify(m, null, 2)); return m; }
/** your templates (with a .bgi), newest first */
function list() {
  const out = [];
  for (const f of fs.readdirSync(dir())) {
    if (!/\.bgi$/i.test(f)) continue;
    const n = f.slice(0, -4), st = fs.statSync(bgiPath(n));
    out.push(Object.assign(readMeta(n), { size: st.size, mtime: st.mtimeMs }));
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}
function save(name, bytes, meta) {
  const n = safe(name); if (/^_builtin-/.test(n)) throw bad("that name is kept for the built-in templates");
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || "");
  if (b.length < 22 || b.readUInt32LE(0) !== 0x04034b50) throw bad("that is not a .bgi document");
  if (b.length > 200 * 1024 * 1024) throw bad("the template is over 200 MB", 413);
  const old = fs.existsSync(metaPath(n)) ? readMeta(n) : null;
  fs.writeFileSync(bgiPath(n), b);
  return writeMeta(cleanMeta(Object.assign({}, old || {}, meta || {}, old ? { next: old.next } : {}), n));
}
function file(name) { const n = safe(name), p = bgiPath(n); if (!fs.existsSync(p)) throw bad("no template called " + n, 404); return p; }
function remove(name) { const n = safe(name); fs.rmSync(bgiPath(n), { force: true }); fs.rmSync(metaPath(n), { force: true }); return { ok: true }; }
function setMeta(name, meta) { const n = safe(name); return writeMeta(cleanMeta(Object.assign(readMeta(n), meta || {}), n)); }
/** the next number of a template (INV-0001 …) - counted on; `peek` only looks */
function nextNumber(name, peek) {
  const m = readMeta(name), s = m.prefix + String(m.next).padStart(m.digits, "0");
  if (!peek) { m.next += 1; writeMeta(m); }
  return { number: s, meta: m };
}
const SYSTEM = `You fill in a business document (an invoice, a quote, a receipt …) from what the user asks. Answer with ONE JSON object and nothing else:
{"fields": {"<field>": "<text>", …}, "items": [{"description": "...", "qty": 1, "price": 0}]}
Rules: use only the field names you are given (leave out the ones the request does not say); items: one per thing charged - qty a number (hours, units), price the price of ONE in the document's currency, a plain number without the sign; never work out totals, tax or amounts (bitGen does); dates as YYYY-MM-DD; keep the user's words for names and descriptions.`;
async function call(o) { return completeFn ? completeFn(o) : require("./llmChat").complete(require("./core"), o); }
async function fillPlan(o) {
  const a = o || {}, ask = String(a.ask || "").trim().slice(0, 4000);
  if (!ask) throw bad("say what to put in the document");
  const fields = (Array.isArray(a.fields) ? a.fields : []).filter((f) => /^[\w.-]{1,40}$/.test(f)).slice(0, 60);
  const user = `The document: ${KINDS.includes(a.kind) ? a.kind : "invoice"} (currency ${String(a.currency || "$").slice(0, 6)}, today ${String(a.today || new Date().toISOString().slice(0, 10)).slice(0, 10)}).\n`
    + `Its fields: ${fields.join(", ") || "(none)"}.\n${a.items === false ? "It has no line items." : "It has line items (description, qty, price)."}\n\nThe request: ${ask}\n\nThe JSON:`;
  const r = await call({ messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }], temperature: 0.2, max_tokens: 2000 });
  if (!r || !r.ok) throw bad("the LLM did not answer" + (r && r.error ? ": " + r.error : ""), 502);
  const p = require("./slideAi").parsePlan(r.text);
  if (!p || typeof p !== "object") throw bad("the LLM's answer was not the document's details - try again", 502);
  const out = { fields: {}, items: [] };
  for (const f of fields) if (p.fields && p.fields[f] != null && String(p.fields[f]).trim()) out.fields[f] = String(p.fields[f]).slice(0, 2000);
  for (const it of (Array.isArray(p.items) ? p.items : []).slice(0, 200)) {
    if (!it || typeof it !== "object") continue;
    const d = String(it.description || it.item || it.name || "").trim().slice(0, 500), q = parseFloat(String(it.qty == null ? 1 : it.qty).replace(/[^\d.-]/g, "")), pr = parseFloat(String(it.price == null ? it.rate || it.unit_price || 0 : it.price).replace(/[^\d.-]/g, ""));
    if (d || pr) out.items.push({ description: d, qty: Number.isFinite(q) ? q : 1, price: Number.isFinite(pr) ? pr : 0 });
  }
  return out;
}
module.exports = { setBase, setComplete, dir, KINDS, cleanMeta, list, save, file, remove, readMeta, setMeta, nextNumber, fillPlan, SYSTEM };
