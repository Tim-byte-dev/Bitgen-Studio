#!/usr/bin/env node
/* bitGen Studio — 2.880.0 units: ✨ a receipt / bill read by the vision LLM (lib/receiptRead.js - the question, the answer checked:
 * numbers, Australian dates, the total needed, lines that do not add up replaced, GST against 1/11, GST-free items, the account from
 * the supplier / words, bill vs receipt, the supplier's ABN checked; read() through captioner.describe), ⤓ CSV of every list /
 * report and 🖨 the BAS worksheet page (lib/accountingCsv.js), the routes, the docker's buttons.
 * Tim (verbatim): "next" (2.880.0 of the agreed plan: read a receipt with the vision LLM + a BAS print form + CSV export) */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const R = require("../lib/receiptRead"), A = require("../lib/accounting"), C = require("../lib/accountingCsv");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=";

/* ---- 1 reading */
check("the question asks for JSON: kind, supplier, ABN, number, date, due, total incl. GST, GST, lines (GST-free marked), category; never guess", /ONLY one JSON object/.test(R.PROMPT) && /gst_free/.test(R.PROMPT) && /Never guess amounts/.test(R.PROMPT));
check("numbers: $1,234.50 / 1.234,50 / 88; Australian dates day first: 19/11/2026, 5-1-27, 19 Nov 2026, Nov 19, 2026, an impossible 31/02 = none",
  R.cents("$1,234.50") === 123450 && R.cents("1.234,50") === 123450 && R.cents(88) === 8800 && R.auDate("19/11/2026") === "2026-11-19" && R.auDate("5-1-27") === "2027-01-05"
  && R.auDate("19 Nov 2026") === "2026-11-19" && R.auDate("Nov 19, 2026") === "2026-11-19" && R.auDate("31/02/2026") === "" && R.auDate("2026-11-19") === "2026-11-19");
check("the answer's JSON found in a fenced / chatty reply; trailing commas forgiven", R.jsonOf('Sure!\n```json\n{"total": 5,}\n```').total === 5 && R.jsonOf("no json") === null);
check("the account from the supplier / words: fuel -> 6150, Telstra -> 6190, Officeworks -> 6160, Bunnings -> 5100, Adobe -> 6120, unknown -> 6900",
  R.accountFor("Caltex", "fuel") === "6150" && R.accountFor("Telstra") === "6190" && R.accountFor("Officeworks") === "6160" && R.accountFor("Bunnings Warehouse") === "5100" && R.accountFor("Adobe") === "6120" && R.accountFor("Joe's") === "6900");
const r1 = R.toDraft({ kind: "receipt", supplier: "Officeworks Toowoomba", abn: "51 824 753 556", number: "R-77", date: "14/11/2026", total: "$27.50", gst: 2.0, lines: [{ description: "Copy paper", amount: 22 }, { description: "Apples", amount: 5.5, gst_free: true }], category: "stationery" });
check("a paid receipt: Officeworks, 14/11/2026, two lines (paper GST, apples GST-free), Office Supplies, the ABN in the notes - nothing said", r1.draft.kind === "receipt" && r1.draft.party === "Officeworks Toowoomba"
  && r1.draft.date === "2026-11-14" && r1.draft.lines.length === 2 && r1.draft.lines[0].tax === "GST" && r1.draft.lines[1].tax === "FRE" && r1.draft.lines[0].account === "6160" && r1.draft.lines[0].amount === "22.00" && /ABN 51 824 753 556/.test(r1.draft.notes) && r1.checks.length === 0, r1);
const r2 = R.toDraft('{"kind":"bill","supplier":"Timber Co","date":"01/11/2026","due":"30/11/2026","total":"2,200.00","gst":"200.00","lines":[{"description":"Pine","amount":1000},{"description":"Oak","amount":500}],"category":"timber"}');
check("a bill (a due date after its date): items that do not add up to the total -> one line of the total (said); timber -> Purchases and Materials", r2.draft.kind === "bill" && r2.draft.due === "2026-11-30"
  && r2.draft.lines.length === 1 && r2.draft.lines[0].amount === "2200.00" && r2.draft.lines[0].account === "5100" && r2.checks.some((c) => /add up to \$1500\.00/.test(c)), r2);
const r3 = R.toDraft({ supplier: "Cafe", date: "x", total: 11, gst: 0 });
check("no GST shown -> GST-free; a date that cannot be read -> today (said)", r3.draft.lines[0].tax === "FRE" && r3.checks.some((c) => /date could not be read/.test(c)));
const r4 = R.toDraft({ supplier: "Shop", date: "1/11/2026", total: 110, gst: 25 });
check("GST that is not 1/11 is said (bitGen works it out from the lines)", r4.checks.some((c) => /not 1\/11/.test(c)), r4.checks);
check("no total / no JSON -> no draft, said; a wrong supplier ABN said", R.toDraft({ supplier: "X" }).draft === null && /no total/.test(R.toDraft({ supplier: "X" }).checks[0]) && R.toDraft("rubbish").draft === null
  && R.toDraft({ supplier: "X", total: 5, abn: "12 345 678 901", date: "1/1/2026" }).checks.some((c) => /does not check out/.test(c)));
(async () => {
  let asked = null; R.setDescribe(async (files) => { asked = files[0]; return ['{"supplier":"Ampol","date":"2/11/2026","total":66,"gst":6,"category":"fuel"}']; });
  const rr = await R.read(PNG, { name: "fuel.png" });
  check("read(): the picture + the question go to the vision model (captioner.describe), the draft comes back (fuel -> Motor Vehicle)", asked && asked.mimetype === "image/png" && asked.prompt === R.PROMPT && asked.max_tokens === 900 && rr.draft.party === "Ampol" && rr.draft.lines[0].account === "6150" && /Ampol/.test(rr.raw), rr);
  let e1 = ""; try { await R.read("data:application/pdf;base64,JVBE"); } catch (e) { e1 = e.message; }
  check("a PDF is refused here (the page draws its first page to a picture first)", /a PDF is drawn to a picture first/.test(e1), e1);
  check("read() uses lib/captioner.js describe() - the vision model the user set (this computer / pod / OpenRouter)", /require\("\.\/captioner"\)\.describe\(require\("\.\/core"\), files\)/.test(src("lib/receiptRead.js")));
  R.setDescribe(null);

  /* ---- 2 CSV + the BAS page */
  check("CSV: quoted where needed, CRLF, a BOM", C.csv([["a", 'b"c', "1,2"], ["x\ny", "", 3]]) === '﻿a,"b""c","1,2"\r\n"x\ny",,3\r\n');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc880-")); A.setRoot(tmp);
  A.saveDoc("t", { kind: "invoice", party: "Smith, J", date: "2026-10-05", lines: [{ desc: "Work", account: "4200", amount: 1100 }] });
  A.saveDoc("t", { kind: "receipt", party: "Ampol", date: "2026-10-06", lines: [{ desc: "Fuel", account: "6150", amount: 66 }, { desc: "Fee", account: "6110", amount: 1 }] });
  const B = A.load("t"), q = { period: "custom", from: "2026-10-01", to: "2026-12-31" };
  const docs = C.rowsFor("docs", A.view(B), B);
  check("CSV of the documents: a row per line, the document's columns on its first line, 'Smith, J' quoted", docs.length === 4 && docs[0][0] === "Kind" && docs.some((r) => r[4] === "Smith, J") && docs.some((r) => r[0] === "" && r[11] === "Fee") && /"Smith, J"/.test(C.csv(docs)), docs);
  const kinds = ["journal", "ledger", "tb", "pl", "bs", "bas", "jobs"];
  check("CSV of every report: journal, ledger (b/d + c/d), trial balance (totals), profit and loss, balance sheet, BAS (boxes), jobs", kinds.every((k) => C.rowsFor(k, A.report(B, Object.assign({ kind: k, journal: "SJ", account: "1100" }, q)), B).length > (k === "jobs" ? 0 : 1))
    && C.rowsFor("bas", A.report(B, Object.assign({ kind: "bas", basis: "accrual" }, q)), B).some((r) => r[1] === "G1" && r[2] === 1100) && C.rowsFor("tb", A.report(B, Object.assign({ kind: "tb" }, q)), B).slice(-1)[0][1] === "Totals");
  let e2 = ""; try { C.rowsFor("x", {}, B); } catch (e) { e2 = e.message; } check("an unknown list refused", /which list/.test(e2));
  const bh = C.basHtml(A.report(B, Object.assign({ kind: "bas", basis: "accrual" }, q)), B, { company: "Signs Co", abn: "51 824 753 556" });
  check("🖨 the BAS worksheet page: the business + ABN, the period dd/mm/yyyy, the basis, G1 $1,100, 1A $100, 1B $6, the verdict, 'not the lodged statement', print-only CSS",
    /Signs Co/.test(bh) && /ABN 51 824 753 556/.test(bh) && /01\/10\/2026 - 31\/12\/2026/.test(bh) && /accrual basis/.test(bh) && />G1<\/td><td class="fg">\$1,100</.test(bh) && />1A<\/td><td class="fg">\$100</.test(bh) && />1B<\/td><td class="fg">\$6</.test(bh)
    && /\$94 payable to the ATO/.test(bh) && /not the lodged statement/.test(bh) && /@media print/.test(bh));

  /* ---- 3 routes + docker */
  const RA = src("routes/accounting.js");
  check("routes: POST /api/accounts/read (40 MB), GET /api/accounts/csv (a .csv download), GET /api/accounts/bas-print", /app\.post\("\/api\/accounts\/read", big/.test(RA) && /\/api\/accounts\/csv/.test(RA) && /Content-Disposition/.test(RA) && /\/api\/accounts\/bas-print/.test(RA));
  const J = src("ext/acctdock/acctdock.js"), H = src("ext/acctdock/dock.html");
  check("docker: ＋ ✨ Read a receipt… (picture or PDF), ✨ Read it in the receipt / bill dialog, a PDF's first page drawn by pdf.js, what was said shown, ⤓ CSV on each list, 🖨 on the BAS",
    /id="acRead"/.test(H) && /id="acReadFile" accept="image\/png,image\/jpeg,image\/webp,image\/gif,application\/pdf"/.test(H) && /id="acfRead"/.test(J) && /pdf\.min\.js/.test(J) && /getPage\(1\)/.test(J)
    && /read by the vision model - check it before you save/.test(J) && /data-csv=/.test(J) && /data-basprint/.test(J));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
