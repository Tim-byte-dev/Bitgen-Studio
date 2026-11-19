#!/usr/bin/env node
/* bitGen Studio — 2.881.0: the invoice / credit note PDFs (lib/invoicePdf.js) read back with pdftotext (poppler) - their words where
 * they belong. Apart from test-881.js because it runs a program (scripts/ci-units.sh leaves those to the e2e gate). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { execSync } = require("child_process");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const A = require("../lib/accounting"), IP = require("../lib/invoicePdf");
(async () => {
  try { execSync("pdftotext -v", { stdio: "ignore" }); } catch (e) { console.log("SKIP: pdftotext is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pdf881-")); A.setRoot(tmp);
  const inv = A.saveDoc("t", { kind: "invoice", party: "S", date: "2026-10-05", lines: [{ desc: "Work", account: "4200", amount: 1100 }, { desc: "Fruit", account: "4100", amount: 55, tax: "FRE" }] });
  const cn = A.saveDoc("t", { kind: "credit", party: "S", date: "2026-10-10", forInvoice: inv.id, lines: [{ desc: "Discount", account: "4200", amount: 110 }, { desc: "Fruit back", account: "4100", amount: 55, tax: "FRE" }] });
  A.savePayment("t", { doc: inv.id, date: "2026-11-01", amount: 990 });
  const B = A.load("t"), V = A.view(B), read = async (d, biz) => { const f = path.join(tmp, d.id + ".pdf"); fs.writeFileSync(f, await IP.pdf(d, B, biz)); return execSync(`pdftotext -layout "${f}" -`, { encoding: "utf8" }); };
  const txt = await read(V.docs.find((d) => d.id === inv.id), { company: "UI Joinery", abn: "51 824 753 556", address: "5 Saw St\nToowoomba" });
  check("the invoice PDF: TAX INVOICE, INV-0001, ABN 51 824 753 556, GST-free named, Total incl. GST $1,155.00, paid in full (the $990 + the $165 credit)",
    /TAX INVOICE/.test(txt) && /INV-0001/.test(txt) && /ABN 51 824 753 556/.test(txt) && /GST-free/.test(txt) && /Total incl\. GST\s+\$1,155\.00/.test(txt) && /Balance due\s+\$0\.00/.test(txt) && /paid in full/.test(txt), txt.slice(0, 900));
  const t2 = await read(V.docs.find((d) => d.id === cn.id), {});
  check("the credit note PDF: ADJUSTMENT NOTE, For invoice INV-0001, Total credit, 'Credits tax invoice INV-0001'", /ADJUSTMENT NOTE/.test(t2) && /For invoice\s+INV-0001/.test(t2) && /Total credit/.test(t2) && /Credits tax invoice INV-0001/.test(t2), t2.slice(0, 700));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
