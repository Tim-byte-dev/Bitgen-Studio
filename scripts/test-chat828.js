#!/usr/bin/env node
/* bitGen Studio — 2.828.0 units: ▦ the spreadsheet from the PROMPT DOCKER. Tim: "can i use prompt docker to upload a file and
 * the llm formats it or creates a dashboard etc. if i say create a dashboard it creates a dashboard, if i say received a payment
 * of <number> it adds it to the right columns with description" + "if we say received it's income if we say paid or payment it
 * is an expense". ext/sheetdock/sheetchat.js route / parseAmount / parseDate / parseEntry / parseRate; the seams (index.html
 * chatSend -> window.H3ChatRoutes, the prompt docker's ＋ takes workbooks), sheetdash formatTable on its own. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const S = require(path.join(ROOT, "ext/sheetdock/sheetchat.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const consts = [{ name: "Rent", kind: "expense", desc: "Rent payment", rates: [{ amount: 540, every: "week", start: "2026-01-13" }] }, { name: "Car loan", kind: "expense", rates: [{ amount: 300, every: "month", start: "2026-01-31" }] }];
const T = "2026-11-17";

const R = (t) => S.route(t, consts);
const routes = { "received a payment of 540 for rent": "entry", "paid 80 for power yesterday": "entry", "Payment of $45.90 to the plumber": "entry", "rent went up to 580 from 12/01/2027": "rate", "rent is now 600": "rate", "the car loan goes up to 320 a month from next month": "rate",
  "bring the ledger up to date": "update", "show me the constants": "constants", "create a dashboard of sales by region": "dashboard", "format it": "format", "tidy up the table": "format", "explain this formula": "explain",
  "fill the rest from the examples": "fill", "write a formula for the total of column D": "formula", "add up column E": "formula" };
const wrong = Object.entries(routes).filter(([t, k]) => R(t) !== k).map(([t, k]) => [t, k, R(t)]);
check(`route: ${Object.keys(routes).length} spreadsheet messages go where they should`, !wrong.length, wrong);
const chat = ["what is the weather", "how much does a 5090 cost", "what format should my video be", "explain how LoRAs work", "create a song about rain", "write a screenplay for a heist", "total eclipse of the heart", "I received a lovely compliment"];
const taken = chat.filter((t) => R(t) !== null);
check("route: ordinary chat stays chat (no amount, no spreadsheet words)", !taken.length, taken.map((t) => [t, R(t)]));

check("parseAmount: $1,250.50 / 540 / 80 dollars; a date's numbers are not money; 15% is not money", S.parseAmount("received $1,250.50 on 3/02/2026") === 1250.5 && S.parseAmount("paid 80 dollars on the 3rd") === 80 && S.parseAmount("on 13/01/2026 paid 540") === 540 && S.parseAmount("15% off") === null);
const D = (t) => S.parseDate(t, T);
check("parseDate: 13/01/2026, 3/2/26, 2026-01-13, 31 Jan, Jan 31 2027, today, yesterday, tomorrow, next week, next month (day first, as in Australia)", D("on 13/01/2026") === "2026-01-13" && D("3/2/26") === "2026-02-03" && D("2026-01-13") === "2026-01-13" && D("31 Jan") === "2026-01-31" && D("Jan 31 2027") === "2027-01-31" && D("today") === T && D("yesterday") === "2026-11-16" && D("tomorrow") === "2026-11-18" && D("next week") === "2026-11-24" && D("next month") === "2026-12-01" && D("31/02/2026") === null && D("no date") === null);

const E = (t, cats) => S.parseEntry(t, { consts, today: T, categories: cats || [] });
const e1 = E("received a payment of 540 for rent"), e2 = E("paid 80 for power yesterday", ["Power"]), e3 = E("Received $1,250.50 from Smith & Co on 3/02/2026"), e4 = E("payment of 300 for the car loan on 31 Jan"), e5 = E("paid 12.50");
check("parseEntry: received = income, today, the words after \"for\", the constant named = its Category", e1.kind === "income" && e1.amount === 540 && e1.iso === T && e1.desc === "Rent" && e1.category === "Rent", e1);
check("…paid = expense, yesterday, a Category already in the ledger (Power)", e2.kind === "expense" && e2.amount === 80 && e2.iso === "2026-11-16" && e2.category === "Power" && e2.desc === "Power", e2);
check("…from Smith & Co on 3/02/2026: $1,250.50 income, no category", e3.kind === "income" && e3.amount === 1250.5 && e3.iso === "2026-02-03" && e3.desc === "Smith & Co" && e3.category === "", e3);
check("…\"payment\" = expense; the car loan (a two-word constant) on 31 Jan", e4.kind === "expense" && e4.category === "Car loan" && e4.iso === "2026-01-31" && e4.desc === "Car loan", e4);
check("…nothing said about it: Payment; no amount / no paid-received = not an entry", e5.desc === "Payment" && E("hello 540") === null && E("paid the rent") === null, [e5]);

const r1 = S.parseRate("rent went up to 580 from 12/01/2027", { consts, today: T }), r2 = S.parseRate("rent is now 600", { consts, today: T }), r3 = S.parseRate("the car loan goes up to 320 a month from next month", { consts, today: T }), r4 = S.parseRate("rent is now 280 a fortnight", { consts, today: T });
check("parseRate: the constant named, the amount, the date said (or the next time it is due after today), how often (as before unless said)", r1.name === "Rent" && r1.amount === 580 && r1.start === "2027-01-12" && r1.every === "week" && r2.start === "2026-11-24" && r3.name === "Car loan" && r3.start === "2026-12-01" && r3.every === "month" && r4.every === "fortnight", [r1, r2, r3, r4]);

// the seams
const idx = read("static/index.html"), pd = read("ext/promptdock/promptdock.js"), pdh = read("ext/promptdock/dock.html"), ext = JSON.parse(read("ext/sheetdock/ext.json")), dash = read("ext/sheetdock/sheetdash.js");
check("index.html chatSend asks window.H3ChatRoutes before the LLM (a reply = done, null = chat as before)", /for \(const route of \(window\.H3ChatRoutes \|\| \[\]\)\)/.test(idx) && idx.indexOf("window.H3ChatRoutes") < idx.indexOf('const { r, j } = await chatPost(t, $("llmSel")'));
check("the prompt docker's ＋ / drop takes .xlsx / .xlsm / .csv / .tsv and hands them to the spreadsheet", /H3SheetChat\.isSheetFile\(f\)/.test(pd) && /\.xlsx, \.xlsm, \.csv, \.tsv/.test(pdh));
check("ext.json: sheetchat.js last (after sheetconst); sheetdash has formatTable + formatData on its own", ext.scripts[ext.scripts.length - 1] === "sheetchat.js" && ext.scripts.indexOf("sheetconst.js") === ext.scripts.length - 2 && /function formatTable\(ds, D, get, T, formats\)/.test(dash) && /formatTable\(ds, D, get, T, plan\.formats\)/.test(dash) && /function formatData\(o\)/.test(dash), ext.scripts);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
