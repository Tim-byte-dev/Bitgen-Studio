#!/usr/bin/env node
/* bitGen Studio — 2.879.0 units: 📒 Accounts OFF until turned on in Settings ▸ Dockers (seeded once into h3.dockoff); 🧾 Insert
 * Field… in the image editor (FIELD_GROUPS, the line items table, fillValues, item.gst / item.tax); an invoice / quote as the
 * template's fields (lib/accountingPrint.js fieldsFor - every field filled, worked out here); Accounts' Invoice / Quote layout ▾
 * (settings), 🖨 = the ledger page or the template filled in the image editor, 🎨 Design a layout; GET /api/accounts/fields/:id.
 * Tim (verbatim): "hide the accounting docker and button. let user enable it in settings-dockers, and continue, allow user to use
 * an invoice template created by image-editor - let user place fields where they should be, like total due is in a box on the
 * invoice somewhere, it should be placed in the right position, the same with quotes" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const { JSDOM } = require("jsdom");
const T = require("../ext/imageeditdock/pcdoctpl.js"), A = require("../lib/accounting"), PR = require("../lib/accountingPrint");

/* ---- 1 off until turned on */
const J = src("ext/acctdock/acctdock.js");
check("📒 Accounts OFF the first time: 'acctdock' put in h3.dockoff once (h3.acct.offSeed), H3Layouts makes it so - 👁 in Settings ▸ Dockers turns it on",
  /h3\.acct\.offSeed/.test(J) && /l\.push\("acctdock"\); root\.localStorage\.setItem\("h3\.dockoff"/.test(J) && /H3Layouts\.set\(\{ kind: "dock", id: "acctdock" \}, true\)/.test(J) && /h3\\\.dockoff/.test(src("static/layouts.js")));

/* ---- 2 the fields */
const keys = T.FIELD_GROUPS.flatMap((g) => g[1].map((f) => f[0]));
check("🧾 Insert Field…: Your business, Customer, Document, Totals - incl. the ABNs, due date, balance due (total due), the GST note",
  T.FIELD_GROUPS.map((g) => g[0]).join("|") === "Your business|Customer|Document|Totals" && ["from_name", "from_abn", "client_name", "client_abn", "title", "number", "date", "due_date", "reference", "payment_details", "subtotal", "tax", "total", "amount_paid", "balance_due", "gst_note"].every((k) => keys.includes(k)), keys);
const P = src("ext/imageeditdock/pcdoctpl.js");
check("...on the File menu after Save as Template; a field = a text layer named after it, the Move tool to drag it; ▦ the line items table as a WP layer",
  /addCmd\("file\.tplfield", "🧾 Insert Field…", "", \(\) => fieldDialog\(\), \{\}, \["File", "file\.tplsave"\]\)/.test(P) && /L\.fieldKey = key/.test(P) && /E\.setTool\("move"\)/.test(P) && /key === "_items"/.test(P) && /fillValues, FIELD_GROUPS/.test(P));
const dom = new JSDOM("<!DOCTYPE html><body></body>");
const filled = T.fillHtml(T.itemsTableHtml(), {}, [{ description: "Sign", qty: 2, price: 165, gst: "$30.00", tax: "GST" }, { description: "Fruit", qty: 1, price: 5, gst: "GST-free", tax: "GST-free" }], "$", dom.window.document);
check("the line items table: Description, Qty, Unit price, GST, Amount - a row per line with its GST (item.gst), the amount = qty x unit",
  /Description.*Qty.*Unit price.*GST.*Amount/.test(filled.replace(/<[^>]+>/g, " ")) && /Sign<\/td><td[^>]*>2<\/td><td[^>]*>\$165\.00<\/td><td[^>]*>\$30\.00<\/td><td[^>]*>\$330\.00/.test(filled) && /GST-free/.test(filled), filled);

/* ---- 3 an invoice as the fields */
const B = A.blank(); B.settings.payTo = "BSB 062-000 Acc 1";
const d = Object.assign(A.cleanDoc(B, { kind: "invoice", party: "Ms J Lee", partyAbn: "51 824 753 556", date: "2026-11-19", ref: "Q-0004", lines: [{ desc: "Sign", account: "4200", qty: 2, unit: 165 }] }), { number: "INV-0007", paid: 10000, balance: 23000 });
const f = PR.fieldsFor(d, B, { company: "Signs Co", abn: "51 824 753 556", address: "1 St", phone: "1", email: "e@x", website: "w" });
check("fieldsFor: every field Insert Field offers has a value worked out (no sums left to the template)", keys.every((k) => k in f.values), keys.filter((k) => !(k in f.values)));
check("...Tax Invoice, INV-0007, dd/mm/yyyy, the ABNs as 'ABN …', subtotal / GST / total, paid $100.00, balance due $230.00, 'Total price includes GST', how to pay, the reference",
  f.values.title === "Tax Invoice" && f.values.number === "INV-0007" && f.values.date === "19/11/2026" && f.values.from_abn === "ABN 51 824 753 556" && f.values.client_abn === "ABN 51 824 753 556"
  && f.values.subtotal === "$300.00" && f.values.tax === "$30.00" && f.values.total === "$330.00" && f.values.amount_paid === "$100.00" && f.values.balance_due === "$230.00" && f.values.gst_note === "Total price includes GST"
  && f.values.payment_details === "BSB 062-000 Acc 1" && f.values.reference === "Q-0004" && f.values.from_business_number === "ABN 51 824 753 556", f.values);
check("...the items: unit price (dollars), quantity, the line's GST", f.items.length === 1 && f.items[0].price === 165 && f.items[0].qty === 2 && f.items[0].gst === "$30.00", f.items);
const fq = PR.fieldsFor(Object.assign({}, d, { kind: "quote" }), B, {});
check("a quote: title Quote, valid until, no how-to-pay, the balance = its total", fq.values.title === "Quote" && fq.values.valid_until === fq.values.due_date && fq.values.payment_details === "" && fq.values.balance_due === "$330.00");

/* ---- 4 Accounts: the layouts */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc879-")); A.setRoot(tmp);
const st = A.saveSettings("t", { invoiceLayout: "My invoice", quoteLayout: "" });
check("the books keep the Invoice / Quote layout ('' = the ledger page)", st.invoiceLayout === "My invoice" && st.quoteLayout === "");
const RA = src("routes/accounting.js");
check("GET /api/accounts/fields/:id - the fields + the layout for its kind + what a tax invoice lacks", /\/api\/accounts\/fields\/:id/.test(RA) && /fieldsFor\(d, B, business\)/.test(RA) && /quoteLayout/.test(RA));
check("🖨: the ledger page when no layout, else the template opened in the image editor and filled (fillValues); a gone template = the ledger page; 🎨 Design a layout",
  /if \(!f\.layout\) return ledgerPage/.test(J) && /E\.docTpl\.fromTemplate\(t\)/.test(J) && /E\.docTpl\.fillValues\(f\.values, f\.items\)/.test(J) && /not among the image editor's templates any more/.test(J) && /function designLayout/.test(J) && /id="acInvLay"/.test(J) && /id="acQLay"/.test(J));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
