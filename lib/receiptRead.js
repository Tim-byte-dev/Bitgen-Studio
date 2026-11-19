// bitGen Studio — lib/receiptRead.js (2.880.0): ✨ A RECEIPT OR BILL READ BY THE VISION LLM for the 📒 Accounts docker.
//
// The picture (a PDF's first page is drawn to a picture in the page first) goes to the vision model the user already has
// (lib/captioner.js describe - this computer, a pod or OpenRouter, as ☁ Runs on ▸ Vision LLM says) with a question asking for
// JSON. What comes back is CHECKED here, never trusted as is:
//   numbers read from "$1,234.50" / "1.234,50"; Australian dates (dd/mm/yyyy) -> YYYY-MM-DD; a total is needed; the GST must
//   be about 1/11 of the taxable part (else it is worked out again and said); lines that do not add up to the total are
//   replaced by one line of the total; the account picked from the supplier / the words (fuel -> Motor Vehicle Expenses …).
// The result is a DRAFT for the receipt / bill dialog - the user sees it and saves it (nothing is entered by itself).
"use strict";
const PROMPT = `You read Australian receipts and supplier invoices for bookkeeping. Look at the picture and answer with ONLY one JSON object, no other words:
{"kind": "receipt" if it is paid already (a till receipt, "paid", a card payment) or "bill" if it asks to be paid (an invoice with a due date or payment details),
 "supplier": the business that issued it, "abn": the supplier's ABN if shown, "number": the invoice / receipt number if shown,
 "date": the date it was issued as written, "due": the due date if shown, "total": the total amount payable including GST, as a number,
 "gst": the GST amount shown (0 if none is shown or it says GST-free), as a number,
 "lines": [{"description": the item, "amount": its price including GST as a number, "gst_free": true if the item is marked GST-free (e.g. with * or #)}],
 "category": one or two words for what was bought (e.g. fuel, stationery, software, electricity, phone, timber, meals)}
Use null for anything you cannot read. Never guess amounts.`;

/** "$1,234.50" / "1.234,50" / 1234.5 -> cents; nothing -> NaN */
function cents(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : NaN;
  let s = String(v == null ? "" : v).replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return NaN;
  if (/,\d{2}$/.test(s) && s.indexOf(".") >= 0 && s.indexOf(".") < s.lastIndexOf(",")) s = s.replace(/\./g, "").replace(",", ".");   // 1.234,50
  else if (/,\d{2}$/.test(s) && s.indexOf(".") < 0) s = s.replace(",", ".");
  s = s.replace(/,/g, "");
  const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y, m, d) => { const Y = y < 100 ? 2000 + y : y; if (m < 1 || m > 12 || d < 1 || d > 31) return ""; const t = new Date(Date.UTC(Y, m - 1, d)); return t.getUTCMonth() === m - 1 ? t.toISOString().slice(0, 10) : ""; };
/** an Australian date as written -> YYYY-MM-DD ("" when it cannot be read): 19/11/2026, 19-11-26, 19 Nov 2026, 2026-11-19 */
function auDate(v) {
  const s = String(v == null ? "" : v).trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return iso(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/.exec(s))) return iso(+m[3], +m[2], +m[1]);   // day first - Australia
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{2,4})/.exec(s)) && MON[m[2].slice(0, 4).toLowerCase()] || (m && MON[m[2].slice(0, 3).toLowerCase()])) return iso(+m[3], MON[m[2].slice(0, 4).toLowerCase()] || MON[m[2].slice(0, 3).toLowerCase()], +m[1]);
  if ((m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s)) && MON[m[1].slice(0, 3).toLowerCase()]) return iso(+m[3], MON[m[1].slice(0, 3).toLowerCase()], +m[2]);
  return "";
}
/** the JSON object in the model's answer (fenced or not) -> object | null */
function jsonOf(text) {
  const s = String(text || ""), a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { try { return JSON.parse(s.slice(a, b + 1).replace(/,\s*([}\]])/g, "$1").replace(/'/g, '"')); } catch (e2) { return null; } }
}
// [words in the supplier / category / items] -> the chart's account (lib/accounting.js CHART)
const ACCOUNTS = [[/fuel|petrol|diesel|unleaded|servo|caltex|ampol|shell|bp\b|7-eleven|car ?wash|tyre|rego|registration|parking|toll/i, "6150"],
  [/telstra|optus|vodafone|phone|mobile|internet|nbn|broadband/i, "6190"], [/software|subscription|adobe|microsoft|google|apple|app store|cloud|hosting|domain|saas/i, "6120"],
  [/electric|energy|power|gas|agl|origin|synergy|ergon/i, "6130"], [/officeworks|stationery|paper|ink|toner|postage|australia post|auspost|office/i, "6160"],
  [/rent|lease/i, "6170"], [/insurance|nrma|racq|racv|allianz|qbe|suncorp/i, "6140"], [/advertis|marketing|facebook ads|meta|print(ing)? (shop|works)|flyer/i, "6100"],
  [/flight|qantas|virgin|jetstar|hotel|motel|accommodation|airbnb|taxi|uber|travel/i, "6200"], [/bunnings|timber|hardware|materials|steel|concrete|paint|plumbing supplies|stock/i, "5100"],
  [/tool|drill|saw\b|equipment/i, "6250"], [/repair|maintenance|service/i, "6180"], [/accountant|accounting|legal|lawyer|solicitor/i, "6230"], [/bank fee|merchant fee|card fee/i, "6110"]];
/** the account for a supplier / category / item words (6900 General Expenses when nothing fits) */
function accountFor(...words) { const s = words.filter(Boolean).join(" "); for (const [re, code] of ACCOUNTS) if (re.test(s)) return code; return "6900"; }
const isAbn = (v) => { try { return require("./businessProfiles").abn(v); } catch (e) { return ""; } };

/** the model's answer -> {draft (for the receipt / bill dialog: amounts in dollars), checks (what was said / fixed), read (cleaned)} */
function toDraft(answer, opt) {
  const o = opt || {}, j = typeof answer === "object" && answer ? answer : jsonOf(answer), checks = [];
  if (!j) return { draft: null, checks: ["the vision model's answer was not the JSON asked for - type it in"], read: null };
  const total = cents(j.total);
  if (!Number.isFinite(total) || total <= 0) return { draft: null, checks: ["no total could be read - type it in"], read: j };
  let gst = cents(j.gst); if (!Number.isFinite(gst) || gst < 0) gst = 0;
  const date = auDate(j.date) || o.today || new Date().toISOString().slice(0, 10), due = auDate(j.due);
  if (!auDate(j.date)) checks.push("the date could not be read - today is put in");
  let lines = (Array.isArray(j.lines) ? j.lines : []).map((l) => ({ desc: String((l && (l.description || l.desc)) || "").trim().slice(0, 200), amount: cents(l && l.amount), free: !!(l && l.gst_free) }))
    .filter((l) => Number.isFinite(l.amount) && l.amount > 0);
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  if (lines.length && Math.abs(sum - total) > Math.max(2, lines.length)) { checks.push(`the items add up to $${(sum / 100).toFixed(2)}, not the total $${(total / 100).toFixed(2)} - one line of the total instead`); lines = []; }
  const what = String(j.category || "").trim(), supplier = String(j.supplier || "").trim().slice(0, 120);
  if (!lines.length) lines = [{ desc: [what, supplier].filter(Boolean).join(" - ").slice(0, 200) || "Purchase", amount: total, free: gst === 0 }];
  // GST: about 1/11 of the taxable lines - else worked out again from them
  const taxable = lines.filter((l) => !l.free).reduce((s, l) => s + l.amount, 0), expect = Math.round(taxable / 11);
  if (gst === 0 && taxable > 0 && !lines.some((l) => l.free)) { lines.forEach((l) => { l.free = true; }); }
  else if (gst > 0 && Math.abs(gst - expect) > Math.max(2, lines.length)) {
    if (Math.abs(gst - Math.round(total / 11)) <= 2) { lines.forEach((l) => { l.free = false; }); checks.push("every item taken as taxable - the GST shown is 1/11 of the total"); }
    else checks.push(`the GST shown ($${(gst / 100).toFixed(2)}) is not 1/11 of the taxable items ($${(expect / 100).toFixed(2)}) - check it; bitGen works GST out from the lines`);
  }
  const kind = j.kind === "bill" || (due && due > date) ? "bill" : "receipt", abn = isAbn(j.abn);
  if (j.abn && !abn) checks.push(`the supplier's ABN "${j.abn}" does not check out`);
  const draft = { kind, party: supplier, number: String(j.number || "").trim().slice(0, 40), date, due: kind === "bill" ? due || "" : "",
    notes: abn ? "Supplier ABN " + abn : "", lines: lines.map((l) => ({ desc: l.desc, account: accountFor(supplier, what, l.desc), amount: (l.amount / 100).toFixed(2), tax: l.free ? "FRE" : "GST" })) };
  if (!supplier) checks.push("the supplier's name could not be read");
  return { draft, checks, read: j };
}
let DESCRIBE = null;   // tests: setDescribe(async (files) => [text])
function setDescribe(fn) { DESCRIBE = fn || null; }
/** read a receipt / bill picture (a data: URL of a PNG / JPEG / WebP) -> {draft, checks, read, raw} */
async function read(dataUrl, opt) {
  const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ""));
  if (!m) throw Object.assign(new Error("give a picture of the receipt (a PDF is drawn to a picture first)"), { status: 400 });
  const buffer = Buffer.from(m[3].replace(/\s+/g, ""), "base64");
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw Object.assign(new Error("the picture is empty or over 20 MB"), { status: 400 });
  const files = [{ buffer, mimetype: m[1], originalname: (opt && opt.name) || "receipt", prompt: PROMPT, max_tokens: 900 }];
  const raw = DESCRIBE ? (await DESCRIBE(files))[0] : (await require("./captioner").describe(require("./core"), files))[0];
  return Object.assign(toDraft(raw, opt), { raw: String(raw || "").slice(0, 4000) });
}
module.exports = { PROMPT, cents, auDate, jsonOf, accountFor, toDraft, read, setDescribe };
