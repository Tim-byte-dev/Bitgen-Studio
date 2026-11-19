// lib/bankStatement.js — 2.882.0: 🏦 a bank statement read into lines for 📒 Accounts ▸ Bank (lib/bankRec.js matches them).
//   parse(text, {name, dayFirst, map}) -> {format, lines: [{date, amount (cents, + = money in), desc, ref, fitid, balance}], closing,
//                                          columns, warnings}
//   Formats: CSV / TSV (every Australian bank's export - CommBank / ANZ with no header row: date, amount, description[, balance];
//            NAB / Westpac / most others with a header: Date, Amount or Debit + Credit, Description / Narrative / Details, Balance),
//            OFX / QFX (SGML or XML; FITID kept so a statement read twice is not doubled) and QIF (D T P M N ^).
//   Dates are read day first (Australian dd/mm/yyyy) unless dayFirst is false; yyyy-mm-dd, "01 Jul 2026", 20260701 also read.
"use strict";

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
function ymd(y, m, d) {
  y = +y; m = +m; d = +d;
  if (y < 100) y += y < 70 ? 2000 : 1900;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1970 && y <= 2100)) return "";
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : "";
}
/** a statement's date as YYYY-MM-DD ("" when it is not one) */
function date(s, dayFirst = true) {
  const v = String(s == null ? "" : s).trim().replace(/^"|"$/g, "");
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(v))) return ymd(m[1], m[2], m[3]);
  if ((m = /^(\d{4})(\d{2})(\d{2})(?:\d{0,6})?(?:\.\d+)?(?:\[.*\])?$/.exec(v))) return ymd(m[1], m[2], m[3]);   // OFX 20260701120000[+10:AEST]
  if ((m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/.exec(v.replace(/'/g, "/").replace(/\s*([-/.])\s*/g, "$1").replace(/\s+/g, " ")))) return dayFirst ? ymd(m[3], m[2], m[1]) : ymd(m[3], m[1], m[2]);
  if ((m = /^(\d{1,2})[- ]([A-Za-z]{3,4})[a-z]*[- ,]+(\d{2,4})$/.exec(v)) && MON[m[2].toLowerCase()]) return ymd(m[3], MON[m[2].toLowerCase()], m[1]);
  if ((m = /^([A-Za-z]{3,4})[a-z]* (\d{1,2}),? (\d{4})$/.exec(v)) && MON[m[1].toLowerCase()]) return ymd(m[3], MON[m[1].toLowerCase()], m[2]);
  return "";
}
/** an amount in cents (NaN when it is not one): $1,234.50  -1234.5  (12.00)  12.00 DR / CR  1.234,50 is not read */
function amount(s) {
  let v = String(s == null ? "" : s).trim().replace(/^"|"$/g, "");
  if (!v) return NaN;
  let sign = 1;
  if (/^\(.*\)$/.test(v)) { sign = -1; v = v.slice(1, -1); }
  if (/\s*DR$/i.test(v)) { sign = -1; v = v.replace(/\s*DR$/i, ""); } else v = v.replace(/\s*CR$/i, "");
  v = v.replace(/[$\s,]|AUD|A\$/gi, "");
  if (/^[+-]?-?\d*\.?\d+$/.test(v) === false) return NaN;
  if (v.startsWith("+")) v = v.slice(1);
  if (v.startsWith("-")) { sign = -sign; v = v.replace(/^-+/, ""); }
  const n = Math.round(parseFloat(v) * 100);
  return Number.isFinite(n) ? sign * n : NaN;
}
const tidy = (s, n = 200) => String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

/* ------------------------------ CSV ------------------------------ */
/** rows of cells (quotes, doubled quotes, commas / tabs / semicolons inside quotes) */
function rows(text) {
  const t = String(text || "").replace(/^﻿/, "");
  const first = t.split(/\r?\n/).find((l) => l.trim()) || "";
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const out = []; let row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') { q = true; continue; }
    if (c === sep) { row.push(cell); cell = ""; continue; }
    if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); if (row.some((x) => x.trim() !== "")) out.push(row); row = []; cell = ""; continue; }
    cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== "")) out.push(row);
  return out;
}
// header words -> the column's role
const ROLE = [
  ["date", /^(transaction |posted |posting |value |effective )?date$|^date posted$|^trans(action)? date$/i],
  ["debit", /^(debit|debits|withdrawal|withdrawals|money out|paid out|debit amount|withdrawal amount|out)$/i],
  ["credit", /^(credit|credits|deposit|deposits|money in|paid in|credit amount|deposit amount|in)$/i],
  ["amount", /^(amount|transaction amount|value|amount \(aud\)|aud amount|net amount)$/i],
  ["desc", /^(description|narrative|details|transaction details|transaction description|memo|particulars|payee|merchant name|merchant|name|reference description)$/i],
  ["ref", /^(reference|ref|cheque|cheque number|serial|check number|transaction id|receipt number)$/i],
  ["balance", /^(balance|running balance|closing balance)$/i]];
/** which column is which: from the header row when there is one, else from the cells (date / amounts / the longest words) */
function columns(R, dayFirst) {
  const head = R[0].map((c) => tidy(c).toLowerCase());
  const map = {}; let header = false;
  head.forEach((h, i) => { for (const [role, re] of ROLE) if (re.test(h) && map[role] == null) { map[role] = i; header = true; break; } });
  if (header && map.date != null && (map.amount != null || map.debit != null || map.credit != null)) {
    if (map.desc == null) { // NAB: "Transaction Details" + "Merchant Name"; else the widest text column
      const cand = head.map((h, i) => i).filter((i) => !Object.values(map).includes(i));
      map.desc = cand.sort((a, b) => avgLen(R.slice(1), b) - avgLen(R.slice(1), a))[0];
    }
    return { map, header: true };
  }
  // no header (CommBank / ANZ): date, amount, description[, balance]
  const S = R.slice(0, 30), n = Math.max(...S.map((r) => r.length));
  const share = (f) => Array.from({ length: n }, (_, i) => S.filter((r) => r[i] != null && f(r[i])).length / S.length);
  const isD = share((c) => !!date(c, dayFirst)), isA = share((c) => Number.isFinite(amount(c)) && /\d/.test(c) && !date(c, dayFirst));
  const di = isD.indexOf(Math.max(...isD));
  const nums = isA.map((s, i) => (s > 0.7 && i !== di ? i : -1)).filter((i) => i >= 0);
  const m2 = { date: di, amount: nums[0] };
  if (nums.length > 1) m2.balance = nums[nums.length - 1];
  const rest = Array.from({ length: n }, (_, i) => i).filter((i) => i !== di && !nums.includes(i));
  m2.desc = rest.sort((a, b) => avgLen(S, b) - avgLen(S, a))[0];
  return { map: m2, header: false };
}
function avgLen(R, i) { return R.reduce((s, r) => s + tidy(r[i]).length, 0) / Math.max(1, R.length); }
function fromCsv(text, o) {
  const R = rows(text), warnings = [];
  if (!R.length) return { format: "csv", lines: [], warnings: ["the file is empty"] };
  const { map: auto, header } = columns(R, o.dayFirst);
  const map = Object.assign({}, auto, o.map || {});
  if (map.date == null || (map.amount == null && map.debit == null && map.credit == null)) return { format: "csv", lines: [], columns: map, warnings: ["no date and amount columns were found - pick them"] };
  const lines = [];
  R.slice(header ? 1 : 0).forEach((r, k) => {
    const d = date(r[map.date], o.dayFirst);
    if (!d) { if (r.some((c) => String(c).trim())) warnings.push(`row ${k + (header ? 2 : 1)}: no date - left out`); return; }
    let a = NaN;
    if (map.amount != null) a = amount(r[map.amount]);
    else {
      const dr = amount(r[map.debit]), cr = amount(r[map.credit]);
      a = (Number.isFinite(cr) ? Math.abs(cr) : 0) - (Number.isFinite(dr) ? Math.abs(dr) : 0);
      if (!Number.isFinite(dr) && !Number.isFinite(cr)) a = NaN;
    }
    if (!Number.isFinite(a) || a === 0) { warnings.push(`row ${k + (header ? 2 : 1)}: no amount - left out`); return; }
    const descParts = [r[map.desc]]; if (header && map.desc2 != null) descParts.push(r[map.desc2]);
    lines.push({ date: d, amount: a, desc: tidy(descParts.filter(Boolean).join(" · ")), ref: map.ref != null ? tidy(r[map.ref], 60) : "", fitid: "",
      balance: map.balance != null && Number.isFinite(amount(r[map.balance])) ? amount(r[map.balance]) : null });
  });
  // a file newest first is turned round, so the last line's balance is the closing one
  if (lines.length > 1 && lines[0].date > lines[lines.length - 1].date) lines.reverse();
  const last = [...lines].reverse().find((l) => l.balance != null);
  return { format: "csv", lines, closing: last ? { date: last.date, balance: last.balance } : null, columns: map, header, warnings };
}

/* ------------------------------ OFX / QFX ------------------------------ */
function tag(block, name) {
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, "i").exec(block);
  return m ? m[1].trim() : "";
}
function fromOfx(text) {
  const t = String(text || ""), lines = [], warnings = [];
  const re = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi;
  let m;
  while ((m = re.exec(t))) {
    const b = m[1], d = date(tag(b, "DTPOSTED") || tag(b, "DTUSER")), a = amount(tag(b, "TRNAMT"));
    if (!d || !Number.isFinite(a)) { warnings.push("a transaction without a date or amount was left out"); continue; }
    const name = tag(b, "NAME") || tag(b, "PAYEE"), memo = tag(b, "MEMO");
    lines.push({ date: d, amount: a, desc: tidy([name, memo && memo !== name ? memo : ""].filter(Boolean).join(" · ")).replace(/&amp;/g, "&"),
      ref: tidy(tag(b, "CHECKNUM") || tag(b, "REFNUM"), 60), fitid: tidy(tag(b, "FITID"), 80), balance: null });
  }
  const bal = /<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|$)/i.exec(t);
  const closing = bal && Number.isFinite(amount(tag(bal[1], "BALAMT"))) ? { date: date(tag(bal[1], "DTASOF")) || (lines.length ? lines[lines.length - 1].date : ""), balance: amount(tag(bal[1], "BALAMT")) } : null;
  lines.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  return { format: "ofx", lines, closing, warnings, account: tidy(tag(t, "ACCTID"), 40) };
}

/* ------------------------------ QIF ------------------------------ */
function fromQif(text, o) {
  const lines = [], warnings = [];
  let cur = {};
  const done = () => {
    if (Object.keys(cur).length) {
      const d = date(cur.D, o.dayFirst), a = amount(cur.T || cur.U);
      if (d && Number.isFinite(a)) lines.push({ date: d, amount: a, desc: tidy([cur.P, cur.M && cur.M !== cur.P ? cur.M : ""].filter(Boolean).join(" · ")), ref: tidy(cur.N, 60), fitid: "", balance: null });
      else warnings.push("a QIF entry without a date or amount was left out");
    }
    cur = {};
  };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const l = raw.trimEnd(); if (!l || l.startsWith("!")) continue;
    if (l === "^") { done(); continue; }
    const k = l[0], v = l.slice(1).trim();
    if ("DTUPMN".includes(k) && cur[k] == null) cur[k] = v;
  }
  done();
  lines.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  return { format: "qif", lines, closing: null, warnings };
}

/** what kind of file it is: by its name, else by its look */
function kindOf(text, name) {
  const n = String(name || "").toLowerCase(), t = String(text || "").slice(0, 2000);
  if (/\.(ofx|qfx)$/.test(n) || /<OFX>|OFXHEADER/i.test(t)) return "ofx";
  if (/\.qif$/.test(n) || /^!Type:/im.test(t)) return "qif";
  return "csv";
}
function parse(text, o0) {
  const o = Object.assign({ dayFirst: true }, o0 || {});
  const k = kindOf(text, o.name);
  const r = k === "ofx" ? fromOfx(text) : k === "qif" ? fromQif(text, o) : fromCsv(text, o);
  if (!r.lines.length && !r.warnings.length) r.warnings.push("no transactions were found in the file");
  return r;
}

module.exports = { parse, date, amount, rows, columns, kindOf, fromCsv, fromOfx, fromQif };
