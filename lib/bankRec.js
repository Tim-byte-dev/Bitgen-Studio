// lib/bankRec.js — 2.882.0: 🏦 a bank statement matched against the books (📒 Accounts ▸ Bank). Kept in the books themselves
// (accounting/<biz>/books.json -> bank: {lines, recs, rules}) so a business's statement goes with its books.
//   A statement line {id, account, date, amount (cents, + = money in), desc, ref, fitid, balance, file, match: "<type>:<id>" | "",
//   auto, ignore, rec} is matched to ONE book item - the money a payment, a paid receipt or a journal moved through that bank
//   account (lib/accounting.js postings, dr - cr on it). Unmatched lines get suggestions: the same amount in the books within 10
//   days; an open invoice / bill / credit note owing exactly that; the account used for the same words before. ✚ makes what is
//   missing from the line: a payment on an open invoice / bill (or a credit note's refund), a spend (a paid receipt), a sale (an
//   invoice + its payment, GST worked out) or a transfer / other (a journal, no GST).
//   2.892.0: a line split over several accounts (one receipt / sale with a line each, or a journal with no GST); a transfer between
//   two of your own bank / card accounts made once and matched on BOTH statements (the other account's line of the opposite amount
//   within 5 days); the remembered words -> account rules listed, changed and deleted (📒 ▸ Bank ▸ ⚙ Rules…).
//   reconcile(): the statement's closing balance = the books' balance - money in the books not yet on the statement + money on the
//   statement not yet in the books; when the difference is $0.00 the lines up to that date are marked reconciled (undo: the last one).
"use strict";
const A = () => require("./accounting");

const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function bad(msg, status) { return Object.assign(new Error(msg), { status: status || 400 }); }
function ensure(B) {
  if (!B.bank || typeof B.bank !== "object") B.bank = {};
  for (const k of ["lines", "recs", "rules"]) if (!Array.isArray(B.bank[k])) B.bank[k] = [];
  return B.bank;
}
function bankAccount(B, code) {
  const a = B.accounts.find((x) => x.code === String(code || ""));
  if (!a || !a.bank) throw bad("pick the bank, card or cash account the statement is for");
  return a;
}
/** the words that say who / what a line is (numbers, dates and card digits dropped) - for remembering where it went */
function descKey(s) {
  return String(s || "").toLowerCase().replace(/\b(eftpos|visa|debit|credit|purchase|card|xx+\d*|pos|aus|au|nsw|vic|qld|wa|sa|tas|act|nt|value date[: ]*\S*)\b/g, " ")
    .replace(/[^a-z ]+/g, " ").split(/\s+/).filter((w) => w.length > 1).slice(0, 3).join(" ");
}
const words = (s) => new Set(String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
const daysApart = (a, b) => Math.abs(A().daysBetween(a, b));

/** the money that went through `account` in the books, one item per payment / receipt / journal */
function bookItems(B, account) {
  const by = new Map();
  for (const p of A().postings(B)) {
    if (p.account !== account) continue;
    const key = p.src.type + ":" + p.src.id;
    let it = by.get(key);
    if (!it) { it = { key, type: p.src.type, id: p.src.id, date: p.date, amount: 0, party: p.party || "", ref: p.ref || "", memo: p.memo || "" }; by.set(key, it); }
    it.amount += p.dr - p.cr;
  }
  return [...by.values()].filter((i) => i.amount !== 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
/** the lines of one account (and their match still in the books) */
function linesOf(B, account, items) {
  const keys = new Set(items.map((i) => i.key));
  return ensure(B).lines.filter((l) => l.account === account).map((l) => (l.match && !keys.has(l.match) ? Object.assign(l, { match: "", auto: false, rec: "" }) : l));
}
/** what an unmatched line could be */
function suggest(B, line, free, rules, others) {
  const out = [], w = words(line.desc);
  // 2.892.0: the same money the other way on another of your bank / card statements = a transfer between them
  for (const o of others || []) {
    if (o.amount !== -line.amount || o.match || o.ignore || o.rec) continue;
    const d = daysApart(o.date, line.date); if (d > 5) continue;
    const acc = B.accounts.find((a) => a.code === o.account) || { name: "" };
    out.push({ how: "transfer", account: o.account, line: o.id, date: o.date, amount: line.amount, label: `Transfer ${line.amount > 0 ? "from" : "to"} ${o.account} ${acc.name} (${o.date})`, score: 2 + d });
  }
  for (const it of free) {
    if (it.amount !== line.amount) continue;
    const d = daysApart(it.date, line.date); if (d > 10) continue;
    const named = [...words(it.party + " " + it.ref)].some((x) => w.has(x));
    out.push({ how: "match", key: it.key, date: it.date, amount: it.amount, label: `${it.party || it.memo || it.type}${it.ref ? " · " + it.ref : ""}`, score: d - (named ? 5 : 0) });
  }
  const at = line.date, want = Math.abs(line.amount);
  for (const d of B.docs) {
    const kindOk = line.amount > 0 ? d.kind === "invoice" : d.kind === "bill" || (d.kind === "credit" && !d.forInvoice);
    if (!kindOk || d.date > at) continue;
    const st = A().docState(B, d, "2999-12-31"); if (st.balance <= 0) continue;
    const exact = st.balance === want, named = [...words(d.party + " " + d.number)].some((x) => w.has(x));
    if (!exact && !(named && want < st.balance)) continue;
    out.push({ how: "payment", doc: d.id, date: d.date, amount: st.balance, label: `${d.kind === "invoice" ? "Invoice" : d.kind === "bill" ? "Bill" : "Refund of credit note"} ${d.number || ""} · ${d.party}${exact ? "" : " (part)"}`, score: 20 + (exact ? 0 : 10) - (named ? 5 : 0) });
  }
  const r = ruleFor(rules, line);
  if (r && r.as === "split") out.push({ how: "split", parts: scaleParts(r.parts, Math.abs(line.amount)), journal: !!r.journal, party: r.party, label: `Split over ${r.parts.length} accounts (as before)`, score: 40 });
  else if (r) out.push({ how: r.as, account: r.account, tax: r.tax, party: r.party, label: `${r.as === "journal" ? "Transfer / other" : r.as === "sale" ? "Sale" : "Spend"} → ${r.account} (as before)`, score: 40 });
  return out.sort((a, b) => a.score - b.score).slice(0, 6);
}
/** 2.892.0: the rule for a line - its words, or the start of them (a rule cut to "officeworks" catches "officeworks parramatta"); the
 *  longest wins */
function ruleFor(rules, line) {
  const k = descKey(line.desc); if (!k) return null;
  let best = null;
  for (const x of rules || []) if ((x.sign > 0) === (line.amount > 0) && (k === x.key || k.startsWith(x.key + " ")) && (!best || x.key.length > best.key.length)) best = x;
  return best;
}
/** a remembered split's shares put on a new amount (cents) - the cents left over go on the biggest part */
function scaleParts(parts, total) {
  const out = (parts || []).map((p) => ({ account: p.account, tax: p.tax || "", desc: p.desc || "", amount: Math.round((+p.share || 0) * total) }));
  if (!out.length) return out;
  const big = out.reduce((m, p) => (p.amount > m.amount ? p : m), out[0]);
  big.amount += total - out.reduce((s, p) => s + p.amount, 0);
  return out;
}
/** 📒 ▸ Bank for one account: its lines (newest first) with their state, the books' money not on any statement, the totals */
function view(B, account0) {
  ensure(B);
  const banks = B.accounts.filter((a) => a.bank).map((a) => ({ code: a.code, name: a.name, type: a.type, lines: B.bank.lines.filter((l) => l.account === a.code).length }));
  const acc = account0 ? bankAccount(B, account0) : B.accounts.find((a) => a.bank);
  const items = bookItems(B, acc.code), lines = linesOf(B, acc.code, items);
  const used = new Set(lines.map((l) => l.match).filter(Boolean));
  const start = lines.length ? lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date) : "";
  const free = items.filter((i) => !used.has(i.key) && (!start || i.date >= A().addDays(start, -14)));
  const byKey = new Map(items.map((i) => [i.key, i]));
  const others = B.bank.lines.filter((x) => x.account !== acc.code && !x.match && !x.ignore && !x.rec);
  const out = lines.map((l) => {
    const o = Object.assign({}, l, { state: l.ignore ? "ignored" : l.match ? (l.rec ? "reconciled" : "matched") : "unmatched" });
    if (l.match) {
      o.item = byKey.get(l.match) || null;
      const twin = B.bank.lines.find((x) => x.account !== l.account && x.match === l.match);   // 2.892.0: a transfer on both statements
      if (twin) o.twin = { account: twin.account, date: twin.date, id: twin.id };
    }
    else if (!l.ignore) o.suggest = suggest(B, l, free, B.bank.rules, others);
    return o;
  }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const recs = B.bank.recs.filter((r) => r.account === acc.code).sort((a, b) => (a.date < b.date ? 1 : -1));
  return { account: acc.code, name: acc.name, type: acc.type, banks, start, lines: out, unpresented: free.filter((i) => !start || i.date >= start),
    counts: { lines: out.length, unmatched: out.filter((l) => l.state === "unmatched").length, matched: out.filter((l) => l.state === "matched").length,
      reconciled: out.filter((l) => l.state === "reconciled").length, ignored: out.filter((l) => l.state === "ignored").length },
    recs, last: recs[0] || null, rules: B.bank.rules.length };
}

/** a statement's lines added to the books' bank lines - the ones already there (same FITID, or the same date + amount + words,
 *  counted so a real second coffee on the same day stays) left out; the ones that match exactly one book item exactly matched */
function addLines(B, account, parsed, name) {
  ensure(B); bankAccount(B, account);
  const seen = new Map(), key = (l) => (l.fitid ? "f:" + l.fitid : `${l.date}|${l.amount}|${descKey(l.desc) || l.desc.toLowerCase()}`);
  const count = (k, m) => { const n = (m.get(k) || 0) + 1; m.set(k, n); return k + "#" + n; };
  for (const l of B.bank.lines.filter((x) => x.account === account)) count(key(l), seen);
  const fresh = new Map(), added = [];
  let dupes = 0;
  for (const p of parsed) {
    if (!A().isDate(p.date) || !Number.isFinite(p.amount) || !p.amount) continue;
    const k = count(key(p), fresh);
    if ((seen.get(key(p)) || 0) >= +k.split("#").pop()) { dupes++; continue; }
    const l = { id: newId("bl"), account, date: p.date, amount: Math.round(p.amount), desc: String(p.desc || "").slice(0, 200), ref: String(p.ref || "").slice(0, 60),
      fitid: String(p.fitid || "").slice(0, 80), balance: Number.isFinite(p.balance) ? p.balance : null, file: String(name || "").slice(0, 120), match: "", auto: false, ignore: false, rec: "", added: new Date().toISOString() };
    B.bank.lines.push(l); added.push(l);
  }
  // exact and only: one book item, same amount, within 3 days, wanted by no other new line
  const items = bookItems(B, account), used = new Set(B.bank.lines.filter((l) => l.match && l.account === account).map((l) => l.match));
  const cand = new Map(added.map((l) => [l.id, items.filter((i) => !used.has(i.key) && i.amount === l.amount && daysApart(i.date, l.date) <= 3)]));
  let auto = 0;
  for (const l of added) {
    const c = cand.get(l.id); if (c.length !== 1) continue;
    if (added.some((o) => o !== l && cand.get(o.id).some((i) => i.key === c[0].key))) continue;
    l.match = c[0].key; l.auto = true; used.add(c[0].key); auto++;
  }
  return { added: added.length, dupes, auto };
}
function lineOf(B, id) {
  const l = ensure(B).lines.find((x) => x.id === id); if (!l) throw bad("that statement line is gone", 404);
  return l;
}
function match(B, id, key) {
  const l = lineOf(B, id); if (l.rec) throw bad("the line is reconciled - undo that reconciliation first");
  const it = bookItems(B, l.account).find((i) => i.key === key); if (!it) throw bad("that entry is not in this account's books");
  if (it.amount !== l.amount) throw bad(`the amounts differ ($${A().money(it.amount)} in the books, $${A().money(l.amount)} on the statement)`);
  const other = B.bank.lines.find((x) => x !== l && x.account === l.account && x.match === key); if (other) throw bad(`that entry is already matched to the line of ${other.date} (${other.desc})`);
  Object.assign(l, { match: key, auto: false, ignore: false }); return l;
}
function unmatch(B, id) {
  const l = lineOf(B, id); if (l.rec) throw bad("the line is reconciled - undo that reconciliation first");
  Object.assign(l, { match: "", auto: false }); return l;
}
function ignore(B, id, on) {
  const l = lineOf(B, id); if (l.rec) throw bad("the line is reconciled - undo that reconciliation first");
  Object.assign(l, { ignore: !!on, match: on ? "" : l.match }); return l;
}
function removeLine(B, id) {
  const l = lineOf(B, id); if (l.rec) throw bad("the line is reconciled - undo that reconciliation first");
  B.bank.lines = B.bank.lines.filter((x) => x !== l); return true;
}
function learn(B, l, how) {
  const k = descKey(l.desc); if (!k) return;
  const R = ensure(B).rules, sign = l.amount > 0 ? 1 : -1, i = R.findIndex((r) => r.key === k && r.sign === sign);
  const r = { key: k, sign, as: how.as, account: String(how.account), tax: how.tax || "", party: String(how.party || "").slice(0, 120) };
  if (how.as === "split") {
    const tot = how.parts.reduce((s, p) => s + p.amount, 0) || 1;
    Object.assign(r, { account: how.parts[0].account, tax: "", journal: !!how.journal, parts: how.parts.map((p) => ({ account: p.account, tax: p.tax || "", desc: p.desc || "", share: Math.round((p.amount / tot) * 1e6) / 1e6 })) });
  }
  if (i >= 0) R[i] = r; else R.push(r);
  if (R.length > 500) R.splice(0, R.length - 500);
}
/** 2.892.0: the parts of a split line - each {account, tax, amount (dollars or cents with inCents), desc}; they add up to the line */
function cleanParts(B, l, parts0, inCents) {
  const L = A(), want = Math.abs(l.amount);
  const parts = (Array.isArray(parts0) ? parts0 : []).map((p) => {
    const amount = inCents && Number.isInteger(p.amount) ? p.amount : L.cents(p.amount);
    if (p.amount === "" || p.amount == null || !Number.isFinite(amount) || amount === 0) return null;
    if (amount < 0) throw bad("each part is an amount over $0.00");
    if (!B.accounts.some((a) => a.code === String(p.account || ""))) throw bad(`pick an account for the $${L.money(amount)} part`);
    if (String(p.account) === l.account) throw bad("a part cannot go back to the bank's own account");
    return { account: String(p.account), tax: L.TAX[p.tax] ? p.tax : "", amount, desc: String(p.desc || "").slice(0, 200) };
  }).filter(Boolean);
  if (parts.length < 2) throw bad("a split has at least two parts with an amount");
  if (parts.length > 30) throw bad("a split has at most 30 parts");
  const sum = parts.reduce((s, p) => s + p.amount, 0);
  if (sum !== want) throw bad(`the parts add up to $${L.money(sum)} - the line is $${L.money(want)} (${sum > want ? "over" : "short"} by $${L.money(Math.abs(sum - want))})`);
  return parts;
}
/** 2.892.0: a transfer made from one statement's line matched on the other account's statement too - the unmatched line of the
 *  opposite amount within 5 days (the one asked for, or the nearest); no line there yet = matched when that statement comes in */
function pairTransfer(B, l, account, key, want) {
  const cand = B.bank.lines.filter((x) => x.account === account && x !== l && !x.match && !x.ignore && !x.rec && x.amount === -l.amount && daysApart(x.date, l.date) <= 5)
    .sort((a, b) => daysApart(a.date, l.date) - daysApart(b.date, l.date));
  const o = (want && cand.find((x) => x.id === want)) || cand[0];
  if (!o) return null;
  Object.assign(o, { match: key, auto: true, ignore: false });
  return o;
}
/** ✚ what the line needs in the books, made and matched: payment | spend | sale | journal | transfer | split */
function create(B, id, how0) {
  const L = A(), l = lineOf(B, id), how = how0 || {}, amt = Math.abs(l.amount) / 100;
  if (l.match) throw bad("the line is already matched");
  if (l.rec) throw bad("the line is reconciled");
  const ref = (l.ref || l.desc).slice(0, 80), party = String(how.party || "").trim() || l.desc.split(" · ")[0].slice(0, 120);
  let key = "";
  if (how.as === "payment") {
    const d = B.docs.find((x) => x.id === how.doc); if (!d) throw bad("that invoice or bill is gone");
    if (l.amount > 0 ? d.kind !== "invoice" : !(d.kind === "bill" || d.kind === "credit")) throw bad(l.amount > 0 ? "money in pays an invoice we sent" : "money out pays a bill or refunds a credit note");
    const p = L.cleanPayment(B, { doc: d.id, date: l.date, amount: amt, account: l.account, ref });
    B.payments.push(p); key = "payment:" + p.id;
  } else if (how.as === "spend") {
    if (l.amount > 0) throw bad("a spend is money out");
    const d = L.cleanDoc(B, { kind: "receipt", date: l.date, party, ref, paidFrom: l.account, job: how.job || "", notes: "From the bank statement",
      lines: [{ desc: how.desc || l.desc, account: how.account, amount: amt, tax: how.tax }] });
    d.created = d.updated = new Date().toISOString(); d.fromBank = l.id;
    B.docs.push(d); key = "doc:" + d.id; learn(B, l, Object.assign({}, how, { party }));
  } else if (how.as === "sale") {
    if (l.amount < 0) throw bad("a sale is money in");
    const d = L.cleanDoc(B, { kind: "invoice", date: l.date, due: l.date, party, ref, job: how.job || "", notes: "From the bank statement",
      lines: [{ desc: how.desc || l.desc, account: how.account, amount: amt, tax: how.tax }] });
    B.counters.invoice = (B.counters.invoice || 0) + 1; d.number = (B.settings.invoicePrefix || "INV-") + String(B.counters.invoice).padStart(4, "0");
    d.created = d.updated = new Date().toISOString(); d.fromBank = l.id;
    B.docs.push(d);
    const p = L.cleanPayment(B, { doc: d.id, date: l.date, amount: amt, account: l.account, ref });
    B.payments.push(p); key = "payment:" + p.id; learn(B, l, Object.assign({}, how, { party }));
  } else if (how.as === "split") {
    // 2.892.0: one line, several accounts - a receipt (money out) or a sale (an invoice + its payment) with a line each, GST per
    // line; or, ticked, a journal (no GST) for parts like a loan's principal + its interest
    const parts = cleanParts(B, l, how.parts, how.inCents), inn = l.amount > 0;
    if (how.journal) {
      const j = L.cleanJournal(B, { date: l.date, memo: how.desc || l.desc, ref: ref.slice(0, 40), lines: [
        { account: l.account, dr: inn ? amt : 0, cr: inn ? 0 : amt, memo: l.desc.slice(0, 120) },
        ...parts.map((p) => ({ account: p.account, dr: inn ? 0 : p.amount / 100, cr: inn ? p.amount / 100 : 0, memo: (p.desc || l.desc).slice(0, 120), job: how.job || "" }))] });
      B.journals.push(j); key = "journal:" + j.id;
    } else {
      const lines = parts.map((p) => ({ desc: p.desc || how.desc || l.desc, account: p.account, amount: p.amount / 100, tax: p.tax || undefined }));
      let d;
      try {
        d = L.cleanDoc(B, inn ? { kind: "invoice", date: l.date, due: l.date, party, ref, job: how.job || "", notes: "From the bank statement (split)", lines }
          : { kind: "receipt", date: l.date, party, ref, paidFrom: l.account, job: how.job || "", notes: "From the bank statement (split)", lines });
      } catch (e) { if (/is not an?/.test(e.message)) e.message += " - tick 'as a journal (no GST)' to split onto a loan, owner's or other account"; throw e; }
      if (inn) { B.counters.invoice = (B.counters.invoice || 0) + 1; d.number = (B.settings.invoicePrefix || "INV-") + String(B.counters.invoice).padStart(4, "0"); }
      d.created = d.updated = new Date().toISOString(); d.fromBank = l.id;
      B.docs.push(d);
      if (inn) { const p = L.cleanPayment(B, { doc: d.id, date: l.date, amount: amt, account: l.account, ref }); B.payments.push(p); key = "payment:" + p.id; }
      else key = "doc:" + d.id;
    }
    learn(B, l, { as: "split", parts, journal: !!how.journal, party: how.journal ? "" : party });
  } else if (how.as === "journal" || how.as === "transfer") {
    const other = B.accounts.find((a) => a.code === String(how.account || ""));
    if (!other) throw bad(how.as === "transfer" ? "pick your other bank, card or cash account" : "pick the account the money came from / went to");
    if (other.code === l.account) throw bad("pick another account than the bank's own");
    if (how.as === "transfer" && !other.bank) throw bad(`${other.code} ${other.name} is not a bank, card or cash account - make it a transfer / other`);
    const c = Math.abs(l.amount) / 100, inn = l.amount > 0;
    const j = L.cleanJournal(B, { date: l.date, memo: how.desc || l.desc, ref: ref.slice(0, 40), lines: [
      { account: l.account, dr: inn ? c : 0, cr: inn ? 0 : c, memo: l.desc.slice(0, 120) }, { account: other.code, dr: inn ? 0 : c, cr: inn ? c : 0, memo: l.desc.slice(0, 120) }] });
    B.journals.push(j); key = "journal:" + j.id; learn(B, l, Object.assign({}, how, { as: "journal", party: "" }));
    if (other.bank) {   // 2.892.0: the same transfer on the other account's statement
      Object.assign(l, { match: key, auto: false, ignore: false });
      const twin = pairTransfer(B, l, other.code, key, how.line);
      return Object.assign({}, l, { twin: twin ? { account: twin.account, date: twin.date, id: twin.id } : null });
    }
  } else throw bad("make it a payment, a spend, a sale, a split or a transfer");
  Object.assign(l, { match: key, auto: false, ignore: false });
  return l;
}
/** the statement's balance on `date` against the books (the account's own sign: a card / loan owing is a positive balance) */
function check(B, account, date, balance) {
  const acc = bankAccount(B, account), L = A();
  if (!L.isDate(date)) throw bad("give the statement's date (YYYY-MM-DD)");
  const stmt = typeof balance === "number" && Number.isInteger(balance) ? balance : L.cents(balance);
  if (!Number.isFinite(stmt)) throw bad("give the statement's closing balance");
  const items = bookItems(B, acc.code), lines = linesOf(B, acc.code, items).filter((l) => l.date <= date);
  const start = lines.length ? lines.reduce((m, l) => (l.date < m ? l.date : m), lines[0].date) : date;
  const used = new Set(lines.map((l) => l.match).filter(Boolean));
  const books = items.filter((i) => i.date <= date).reduce((s, i) => s + i.amount, 0);
  const unpresented = items.filter((i) => i.date >= start && i.date <= date && !used.has(i.key));
  const unrecorded = lines.filter((l) => !l.match && !l.ignore);
  const signed = acc.type === "liability" ? -stmt : stmt;
  const adjusted = books - unpresented.reduce((s, i) => s + i.amount, 0) + unrecorded.reduce((s, l) => s + l.amount, 0);
  const show = (c) => (acc.type === "liability" ? -c : c);
  return { account: acc.code, name: acc.name, type: acc.type, date, start, statement: stmt, books: show(books), adjusted: show(adjusted), difference: show(signed - adjusted),
    unpresented, unrecorded, ok: signed === adjusted && !unrecorded.length, lines: lines.length };
}
function reconcile(B, account, date, balance) {
  const r = check(B, account, date, balance);
  if (r.unrecorded.length) throw bad(`${r.unrecorded.length} statement line(s) up to ${date} are not in the books yet - match, make or ignore them first`);
  if (r.difference) throw bad(`it is out by $${A().money(r.difference)} - find it before reconciling`);
  const rec = { id: newId("rc"), account: r.account, date, balance: r.statement, at: new Date().toISOString(), lines: 0 };
  for (const l of B.bank.lines) if (l.account === r.account && l.date <= date && l.match && !l.rec) { l.rec = rec.id; rec.lines++; }
  B.bank.recs.push(rec);
  return Object.assign(r, { rec });
}
function undoRec(B, account) {
  ensure(B);
  const last = B.bank.recs.filter((r) => r.account === String(account)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!last) throw bad("nothing reconciled for that account");
  for (const l of B.bank.lines) if (l.rec === last.id) l.rec = "";
  B.bank.recs = B.bank.recs.filter((r) => r !== last);
  return last;
}

/* ------------------- 2.892.0: the remembered rules (the words of a line -> where it went) ------------------- */
const RULE_AS = { spend: "Spend", sale: "Sale", journal: "Transfer / other", split: "Split" };
/** the rules with the account's name and how many unmatched lines they suggest for right now */
function rules(B) {
  const R = ensure(B).rules, waiting = new Map();
  for (const l of B.bank.lines) if (!l.match && !l.ignore) { const r = ruleFor(R, l); if (r) { const k = r.key + "|" + r.sign; waiting.set(k, (waiting.get(k) || 0) + 1); } }
  const name = (c) => (B.accounts.find((a) => a.code === c) || { name: "(gone)" }).name;
  return R.map((r) => Object.assign({}, r, { name: name(r.account), waiting: waiting.get(r.key + "|" + r.sign) || 0,
    parts: r.parts ? r.parts.map((p) => Object.assign({}, p, { name: name(p.account) })) : undefined }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : b.sign - a.sign));
}
/** a rule added or changed: {key (the words - shortened the way lines are), sign (1 in / -1 out), as, account, tax, party, journal,
 *  parts [{account, tax, desc, share or pct}]}; `was` {key, sign} = the rule it replaces */
function saveRule(B, r0, was) {
  const L = A(), r = r0 || {}, R = ensure(B).rules;
  const key = descKey(r.key); if (!key) throw bad("give the words the statement line starts with (e.g. officeworks)");
  const sign = +r.sign > 0 ? 1 : -1, as = RULE_AS[r.as] ? r.as : "";
  if (!as) throw bad("pick what it makes: a spend, a sale, a transfer / other or a split");
  if (as === "spend" && sign > 0) throw bad("a spend is money out"); if (as === "sale" && sign < 0) throw bad("a sale is money in");
  const accOk = (code, what) => {
    const a = B.accounts.find((x) => x.code === String(code || "")); if (!a) throw bad(`pick the account${what ? " for " + what : ""}`);
    if (as === "spend" || (as === "split" && !r.journal && sign < 0)) { if (!["expense", "cos", "asset"].includes(a.type) || a.system || a.bank) throw bad(`${a.code} ${a.name} is not an expense, cost or asset account`); }
    else if (as === "sale" || (as === "split" && !r.journal)) { if (a.type !== "income") throw bad(`${a.code} ${a.name} is not an income account`); }
    return a.code;
  };
  const out = { key, sign, as, account: "", tax: as === "journal" ? "" : L.TAX[r.tax] ? r.tax : "", party: as === "journal" ? "" : String(r.party || "").trim().slice(0, 120) };
  if (as === "split") {
    const parts = (Array.isArray(r.parts) ? r.parts : []).map((p) => {
      const share = p.pct != null && p.pct !== "" ? +p.pct / 100 : +p.share;
      if (!Number.isFinite(share) || share <= 0) return null;
      return { account: accOk(p.account, "each part"), tax: L.TAX[p.tax] && !r.journal ? p.tax : "", desc: String(p.desc || "").slice(0, 200), share: Math.round(share * 1e6) / 1e6 };
    }).filter(Boolean);
    if (parts.length < 2) throw bad("a split has at least two parts");
    const tot = parts.reduce((s, p) => s + p.share, 0);
    if (Math.abs(tot - 1) > 0.0001) throw bad(`the parts add up to ${(tot * 100).toFixed(2)} % - make them 100 %`);
    Object.assign(out, { account: parts[0].account, tax: "", journal: !!r.journal, parts });
  } else out.account = accOk(r.account);
  const old = was && was.key ? R.findIndex((x) => x.key === String(was.key) && x.sign === (+was.sign > 0 ? 1 : -1)) : -1;
  const clash = R.findIndex((x, i) => i !== old && x.key === key && x.sign === sign);
  if (clash >= 0) throw bad(`there is a rule for "${key}" (${sign > 0 ? "money in" : "money out"}) already - change that one`);
  if (old >= 0) R[old] = out; else R.push(out);
  return out;
}
function deleteRule(B, key, sign) {
  const R = ensure(B).rules, i = R.findIndex((x) => x.key === String(key || "") && x.sign === (+sign > 0 ? 1 : -1));
  if (i < 0) throw bad("that rule is gone", 404);
  return R.splice(i, 1)[0];
}

/* ------------------------------ by business (each loads, changes, saves) ------------------------------ */
function withBooks(biz, fn) { const L = A(), B = L.load(biz); ensure(B); const out = fn(B); L.save(biz, B); return out; }
module.exports = {
  descKey, bookItems, suggest, view, scaleParts, ruleFor, cleanParts, rules, saveRule, deleteRule, RULE_AS, addLines, match, unmatch, ignore, removeLine, create, check, reconcile, undoRec, ensure,
  viewOf: (biz, account) => view(A().load(biz), account),
  importText(biz, account, text, o) {
    const S = require("./bankStatement"), r = S.parse(text, o || {});
    if (!r.lines.length) throw Object.assign(bad(r.warnings[0] || "no transactions were found"), { parsed: r });
    const res = withBooks(biz, (B) => addLines(B, account, r.lines, (o || {}).name));
    return Object.assign(res, { format: r.format, read: r.lines.length, closing: r.closing || null, warnings: r.warnings.slice(0, 20), columns: r.columns || null, header: r.header });
  },
  matchLine: (biz, id, key) => withBooks(biz, (B) => match(B, id, key)),
  unmatchLine: (biz, id) => withBooks(biz, (B) => unmatch(B, id)),
  ignoreLine: (biz, id, on) => withBooks(biz, (B) => ignore(B, id, on)),
  deleteLine: (biz, id) => withBooks(biz, (B) => removeLine(B, id)),
  createFor: (biz, id, how) => withBooks(biz, (B) => create(B, id, how)),
  checkRec: (biz, account, date, balance) => check(A().load(biz), account, date, balance),
  doReconcile: (biz, account, date, balance) => withBooks(biz, (B) => reconcile(B, account, date, balance)),
  undoReconcile: (biz, account) => withBooks(biz, (B) => undoRec(B, account)),
  rulesOf: (biz) => { const B = A().load(biz); return { rules: rules(B), as: RULE_AS }; },
  saveRuleFor: (biz, rule, was) => withBooks(biz, (B) => saveRule(B, rule, was)),
  deleteRuleFor: (biz, key, sign) => withBooks(biz, (B) => deleteRule(B, key, sign)),
};
