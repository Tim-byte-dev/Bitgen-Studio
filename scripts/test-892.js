#!/usr/bin/env node
/* bitGen Studio — 2.892.0 units: 🏦 bank extras in 📒 Accounts ▸ Bank - one statement line split over several accounts (a receipt /
 * sale with a line each, GST per line, or a journal with no GST), a transfer between two of your own accounts made once and matched
 * on BOTH statements (now, or when the other statement comes in), and the remembered rules listed, changed and deleted.
 * Tim (verbatim): "continue next" (parked: "🏦 Bank extras - split one statement line over several accounts; a transfer between two
 * of your own accounts matched on both statements at once; a small editor for the remembered rules (descKey -> account / tax)") */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const throws = (fn, re) => { try { fn(); return false; } catch (e) { if (!re.test(e.message)) console.log("      (said: " + e.message + ")"); return re.test(e.message) && e.status >= 400; } };
const A = require("../lib/accounting"), R = require("../lib/bankRec");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc892-")); A.setRoot(tmp);
A.saveSettings && A.saveSettings("t", { gstRegistered: true });
const main = '05/08/2026,"-110.00","OFFICEWORKS 0123 SYDNEY",""\n06/08/2026,"-500.00","TRANSFER TO SAVINGS",""\n07/08/2026,"-220.00","OFFICEWORKS 0456 PARRAMATTA",""\n'
  + '08/08/2026,"-1300.00","LOAN REPAYMENT WESTPAC",""\n09/08/2026,"+330.00","MARKET STALL TAKINGS",""\n10/08/2026,"-250.00","TRANSFER TO CARD",""\n';
const sav = '07/08/2026,"+500.00","TRANSFER FROM BUSINESS",""\n';
R.importText("t", "1100", main, { name: "main.csv" });
R.importText("t", "1120", sav, { name: "sav.csv" });
let V = R.viewOf("t", "1100");
const L = (desc) => V.lines.find((l) => l.desc.startsWith(desc));

// ---------- a transfer between two of your own accounts ----------
let tr = L("TRANSFER TO SAVINGS");
const sg = tr.suggest.find((s) => s.how === "transfer");
check("the $500 out of 1100 + the $500 into 1120 the next day: ↔ a transfer to 1120 suggested first", sg && sg.account === "1120" && tr.suggest[0] === sg && /Transfer to 1120 Savings/.test(sg.label), tr.suggest);
let out = R.createFor("t", tr.id, { as: "transfer", account: "1120", line: sg.line });
check("✚ transfer: one journal (Dr 1120, Cr 1100), the line matched and the 1120 line matched to the SAME journal", out.match.startsWith("journal:") && out.twin && out.twin.account === "1120" && out.twin.date === "2026-08-07", out);
let B = A.load("t"), j = B.journals.find((x) => "journal:" + x.id === out.match);
check("...the journal: $500 Dr Savings, Cr the bank account; nothing else", j && j.lines.length === 2 && j.lines.some((x) => x.account === "1120" && x.dr === 50000) && j.lines.some((x) => x.account === "1100" && x.cr === 50000) && B.journals.length === 1, j);
let V2 = R.viewOf("t", "1120");
check("the 1120 statement: its line matched (by bitGen) with ↔ 1100 shown; both counted matched", V2.counts.matched === 1 && V2.lines[0].twin && V2.lines[0].twin.account === "1100" && V2.lines[0].auto === true, V2.lines[0]);
V = R.viewOf("t", "1100");
check("...and the 1100 line shows ↔ 1120", L("TRANSFER TO SAVINGS").twin && L("TRANSFER TO SAVINGS").twin.account === "1120");
let ck = R.checkRec("t", "1120", "2026-08-31", "500.00");
check("1120 reconciles at $500 with the transfer in the books once", ck.ok && ck.difference === 0, ck);
// the other statement not in yet: matched when it comes in
const card = L("TRANSFER TO CARD");
out = R.createFor("t", card.id, { as: "transfer", account: "2400" });
check("a transfer to the card before the card's statement is in: made, matched here, nothing to match there yet", out.match.startsWith("journal:") && out.twin === null, out);
const res = R.importText("t", "2400", '11/08/2026,"+250.00","PAYMENT THANK YOU",""\n', { name: "card.csv" });
V2 = R.viewOf("t", "2400");
check("...the card's statement comes in: its +$250 matched by itself to the same transfer (each statement keeps its own matches)", res.auto === 1 && V2.lines[0].match === out.match && V2.lines[0].twin && V2.lines[0].twin.account === "1100", { res, l: V2.lines[0] });
check("a transfer is to a bank / card / cash account only; and not to itself", throws(() => R.createFor("t", L("LOAN REPAYMENT").id, { as: "transfer", account: "2500" }), /not a bank, card or cash/)
  && throws(() => R.createFor("t", L("LOAN REPAYMENT").id, { as: "transfer", account: "1100" }), /another account than/));
B = A.load("t");
check("match(): the same book entry can be on one line per account, not two lines of one account", throws(() => R.match(B, B.bank.lines.find((l) => l.desc === "OFFICEWORKS 0123 SYDNEY").id, out.match), /not in this account's books|amounts differ|already matched/));

// ---------- a split ----------
const ow = L("OFFICEWORKS 0123");
check("a split must add up to the line (over / short said)", throws(() => R.createFor("t", ow.id, { as: "split", parts: [{ account: "6160", amount: 60 }, { account: "6120", amount: 40 }] }), /add up to \$100\.00 - the line is \$110\.00 \(short by \$10\.00\)/)
  && throws(() => R.createFor("t", ow.id, { as: "split", parts: [{ account: "6160", amount: 110 }] }), /at least two parts/));
out = R.createFor("t", ow.id, { as: "split", party: "Officeworks", parts: [{ account: "6160", amount: 66, desc: "Paper" }, { account: "6120", amount: 33, tax: "GST" }, { account: "6110", amount: 11 }] });
B = A.load("t");
let d = B.docs.find((x) => "doc:" + x.id === out.match);
check("✚ split money out: ONE paid receipt from 1100 with a line per part, GST per line (6110 bank fees GST-free), matched", d && d.kind === "receipt" && d.paidFrom === "1100" && d.lines.length === 3 && d.total === 11000 && d.gst === 900 && d.lines[2].tax === "FRE" && d.lines[0].desc === "Paper" && d.party === "Officeworks", d);
const rule = B.bank.rules.find((r) => r.key === "officeworks sydney" && r.sign === -1);
check("...the split remembered as shares (60 % / 30 % / 10 %)", rule && rule.as === "split" && rule.parts.length === 3 && rule.parts[0].share === 0.6 && rule.parts[2].share === 0.1, rule);
V = R.viewOf("t", "1100");
check("the Officeworks line from another store (\"officeworks parramatta\") is not caught by \"officeworks sydney\"", !L("OFFICEWORKS 0456").suggest.some((s) => s.how === "split"), L("OFFICEWORKS 0456").suggest);
R.saveRuleFor("t", Object.assign({}, rule, { key: "Officeworks" }), { key: rule.key, sign: -1 });
V = R.viewOf("t", "1100");
const ow2 = L("OFFICEWORKS 0456"), s2 = ow2.suggest.find((s) => s.how === "split");
check("✎ the rule's words cut to \"officeworks\": the $220 line gets the split again on its amount ($132 / $66 / $22)", s2 && s2.parts.map((p) => p.amount).join() === "13200,6600,2200" && /Split over 3/.test(s2.label), ow2.suggest);
check("ruleFor: the longest words that start the line win", R.ruleFor([{ key: "officeworks", sign: -1 }, { key: "officeworks parramatta", sign: -1, as: "x" }, { key: "officeworks parramatta", sign: 1 }], { desc: "OFFICEWORKS 0456 PARRAMATTA", amount: -5 }).as === "x"
  && R.ruleFor([{ key: "office", sign: -1 }], { desc: "OFFICEWORKS", amount: -5 }) === null);
check("scaleParts: the odd cent goes on the biggest part", R.scaleParts([{ account: "a", share: 1 / 3 }, { account: "b", share: 1 / 3 }, { account: "c", share: 1 / 3 }], 1000).map((p) => p.amount).join() === "334,333,333");
const ln = L("LOAN REPAYMENT");
check("a split onto a loan (a liability) as a receipt is refused - told to tick 'as a journal'", throws(() => R.createFor("t", ln.id, { as: "split", parts: [{ account: "2500", amount: 1000 }, { account: "6900", amount: 300 }] }), /not an expense.*tick 'as a journal/));
out = R.createFor("t", ln.id, { as: "split", journal: true, parts: [{ account: "2500", amount: 1000, desc: "Principal" }, { account: "6900", amount: 300, desc: "Interest" }] });
B = A.load("t"); j = B.journals.find((x) => "journal:" + x.id === out.match);
check("...ticked: a journal - Cr bank $1,300, Dr Loans $1,000, Dr interest $300 (no GST)", j && j.lines.length === 3 && j.lines.find((x) => x.account === "1100").cr === 130000 && j.lines.find((x) => x.account === "2500").dr === 100000 && j.lines.find((x) => x.account === "6900").memo === "Interest", j);
const mk = L("MARKET STALL");
out = R.createFor("t", mk.id, { as: "split", party: "Market", parts: [{ account: "4100", amount: 220 }, { account: "4400", amount: 110 }] });
B = A.load("t"); d = B.docs.find((x) => x.fromBank === mk.id);
check("✚ split money in: an invoice with a line each (GST on the sale, none on interest) + its payment, matched", d && d.kind === "invoice" && d.lines.length === 2 && d.gst === 2000 && /^INV-/.test(d.number) && out.match.startsWith("payment:") && A.docState(B, d, "2999-12-31").balance === 0, d);
check("a part that goes back to the bank's own account is refused", throws(() => R.cleanParts(B, { account: "1100", amount: -500 }, [{ account: "1100", amount: 2 }, { account: "6160", amount: 3 }]), /back to the bank/));

// ---------- the rules ----------
let RL = R.rulesOf("t");
check("rules: listed with the account names and the lines waiting for them", RL.rules.length >= 2 && RL.rules.some((r) => r.key === "officeworks" && r.as === "split" && r.waiting === 1 && r.parts[0].name === "Office Supplies and Postage") && RL.as.split === "Split", RL.rules);
let saved = R.saveRuleFor("t", { key: "OFFICEWORKS 9999 SYDNEY", sign: -1, as: "spend", account: "6160", tax: "GST", party: "Officeworks" }, { key: "officeworks", sign: -1 });
check("✎ a rule changed: the words shortened the way lines are (numbers dropped), the split made a plain spend", saved.key === "officeworks sydney" && saved.as === "spend" && saved.account === "6160" && !R.rulesOf("t").rules.some((r) => r.key === "officeworks" && r.sign === -1), saved);
saved = R.saveRuleFor("t", { key: "officeworks", sign: -1, as: "split", party: "Officeworks", parts: [{ account: "6160", pct: "75" }, { account: "6120", pct: 25 }] }, null);
check("+ a split rule by % (75 / 25)", saved.parts.length === 2 && saved.parts[1].share === 0.25 && saved.account === "6160");
check("rules refused: no words, a spend as money in, a sale onto an expense, a split not 100 %, the same words twice",
  throws(() => R.saveRuleFor("t", { key: "123", sign: -1, as: "spend", account: "6160" }), /give the words/)
  && throws(() => R.saveRuleFor("t", { key: "x shop", sign: 1, as: "spend", account: "6160" }), /a spend is money out/)
  && throws(() => R.saveRuleFor("t", { key: "x shop", sign: 1, as: "sale", account: "6160" }), /not an income account/)
  && throws(() => R.saveRuleFor("t", { key: "x shop", sign: -1, as: "split", parts: [{ account: "6160", pct: 50 }, { account: "6120", pct: 40 }] }), /90\.00 % - make them 100/)
  && throws(() => R.saveRuleFor("t", { key: "officeworks", sign: -1, as: "spend", account: "6160" }), /already - change that one/));
V = R.viewOf("t", "1100");
check("the changed rule is what is suggested now (75 / 25 of $220)", L("OFFICEWORKS 0456").suggest.some((s) => s.how === "split" && s.parts.map((p) => p.amount).join() === "16500,5500"), L("OFFICEWORKS 0456").suggest);
const n0 = R.rulesOf("t").rules.length;
R.deleteRuleFor("t", "officeworks", -1);
check("🗑 a rule deleted (and a gone one says so)", R.rulesOf("t").rules.length === n0 - 1 && throws(() => R.deleteRuleFor("t", "officeworks", -1), /gone/));

// ---------- the routes + the docker ----------
const rt = src("routes/accounting.js");
check("routes: GET / POST /api/accounts/bank/rules, POST /api/accounts/bank/rules/delete (not in server.js)", ['app.get("/api/accounts/bank/rules"', 'app.post("/api/accounts/bank/rules", small', 'app.post("/api/accounts/bank/rules/delete", small'].every((s) => rt.includes(s)) && !/bank\/rules/.test(src("misc/server.js")));
const ui = src("ext/acctdock/acctbank.js");
check("the Bank tab: ✚ Make… has Split (parts, + a part, left to split, as a journal) and Transfer (my other account); ↔ suggestions; ⚙ Rules…",
  ['["split", "Split over several accounts"]', '["transfer", `A transfer', 'data-partadd', 'acbLeft', 'acbJnl', 'acbBank', 'data-bxfer', 'acBankRules', '/api/accounts/bank/rules/delete', 'bank-twin', 'readParts'].every((s) => ui.includes(s)), null);
check("the docker's styles for the twin badge, the parts and the rules", /\.bank-twin/.test(src("ext/acctdock/dock.html")) && /\.bank-parts/.test(src("ext/acctdock/dock.html")));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
