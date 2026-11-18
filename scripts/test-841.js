#!/usr/bin/env node
/* bitGen Studio — 2.841.0 units: 🧾 document templates (invoices, quotes, receipts) in the image editor.
 *   pcdoctpl fieldsOf / hasItems / money / totals / fillText / fillHtml (item rows, escaping, split placeholders) / builtin;
 *   lib/docTemplates save / list / meta / nextNumber / remove / fillPlan (a stand-in LLM); the wiring. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const P = require(path.join(ROOT, "ext/imageeditdock/pcdoctpl.js")), T = require(path.join(ROOT, "lib/docTemplates.js"));
const { JSDOM } = require("jsdom");
const doc = new JSDOM("<!doctype html><body></body>").window.document;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
(async () => {
  const B = P.builtin("invoice"), f = P.fieldsOf([B.html, "{{ client_name }} {{project}}"]);
  check("fieldsOf: the template's own fields in order - not the item columns, not the ones bitGen fills",
    f[0] === "from_name" && f.includes("client_name") && f.includes("payment_details") && f.includes("project") && !f.includes("number") && !f.includes("total") && !f.some((x) => /^item\./.test(x)) && f.filter((x) => x === "client_name").length === 1, f);
  check("hasItems / hasFields", P.hasItems([B.html]) && !P.hasItems(["{{client_name}}"]) && P.hasFields(["a {{x}}"]) && !P.hasFields(["no fields"]));
  const t = P.totals([{ qty: 3, price: 90 }, { qty: 1, price: 19.995 }, { qty: 2.5, price: 10 }], 10);
  check("totals: each amount qty x price in cents, the subtotal, tax at the rate, the total", JSON.stringify(t.amounts) === "[270,20,25]" && t.subtotal === 315 && t.tax === 31.5 && t.total === 346.5, t);
  check("money: the sign, thousands, cents; negatives", P.money(1234567.5, "$") === "$1,234,567.50" && P.money(-3, "€") === "-€3.00" && P.money(0.1 + 0.2, "") === "0.30");
  const items = [{ description: "Logo <design>", qty: 3, price: 90 }, { description: "Hosting", qty: 1, price: 20 }];
  const h = P.fillHtml(B.html, { from_name: "Tiger & Co", client_name: "Acme\nPty Ltd", number: "INV-0007", tax_rate: 10, subtotal: "$290.00", tax: "$29.00", total: "$319.00", date: "2026-11-18" }, items, "$", doc);
  check("fillHtml: one table row per item (description escaped, qty, price, amount), the template row gone, fields escaped with new lines as <br>, unknown fields left empty",
    (h.match(/<tr>/g) || []).length === 4 && /<td>Logo &lt;design&gt;<\/td><td style="text-align:right">3<\/td><td style="text-align:right">\$90\.00<\/td><td style="text-align:right">\$270\.00<\/td>/.test(h) && /\$20\.00<\/td><\/tr>/.test(h)
    && /Tiger &amp; Co/.test(h) && /Acme<br>Pty Ltd/.test(h) && /<b>INV-0007<\/b>/.test(h) && /Total \$319\.00/.test(h) && !/\{\{/.test(h), h.slice(0, 1200));
  const split = P.fillHtml("<p>Dear {{<b>client</b>_name}},</p>", { client_name: "Ann" }, [], "$", doc);
  check("fillHtml: a placeholder split by formatting is still found", split === "<p>Dear Ann,</p>", split);
  check("fillText (a text layer) / labelOf / addDays", P.fillText("No. {{number}} for {{client_name}} {{nope}}", { number: "Q-1", client_name: "Bo" }) === "No. Q-1 for Bo " && P.labelOf("client_email") === "Client email" && P.addDays("2026-12-28", 7) === "2027-01-04");
  check("builtin: Invoice / Quote / Receipt with their words", /INVOICE/.test(B.html) && /QUOTE/.test(P.builtin("quote").html) && /Valid until/.test(P.builtin("quote").html) && /Received from/.test(P.builtin("receipt").html) && P.builtin("quote").name === "_builtin-quote");
  // the server side
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t841-")); T.setBase(tmp);
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]);
  const m1 = T.save("My invoice", zip, { kind: "invoice", taxRate: "15", currency: "NZ$" });
  let e1 = null; try { T.save("x", Buffer.from("not a zip at all, sorry")); } catch (e) { e1 = e; }
  let e2 = null; try { T.save("_builtin-invoice", zip); } catch (e) { e2 = e; }
  check("save: a .bgi + its meta (kind, prefix INV-, tax, currency), not a zip / a built-in's name refused", m1.prefix === "INV-" && m1.taxRate === 15 && m1.currency === "NZ$" && fs.existsSync(path.join(tmp, "doc_templates", "My invoice.bgi")) && e1 && e1.status === 400 && e2 && e2.status === 400, m1);
  const n1 = T.nextNumber("My invoice", true), n2 = T.nextNumber("My invoice"), n3 = T.nextNumber("My invoice"), b1 = T.nextNumber("_builtin-quote");
  check("nextNumber: peek does not count; INV-0001, INV-0002 …; a built-in counts on its own (QUO-0001)", n1.number === "INV-0001" && n2.number === "INV-0001" && n3.number === "INV-0002" && b1.number === "QUO-0001", [n1.number, n2.number, n3.number, b1.number]);
  T.setMeta("My invoice", { defaults: { from_name: "Tiger", "bad key!": "x" } }); T.save("My invoice", zip, { kind: "invoice" });
  const L = T.list();
  check("setMeta keeps your defaults (bad keys out); saving again keeps the counter; list", L.length === 1 && L[0].next === 3 && L[0].defaults.from_name === "Tiger" && !("bad key!" in L[0].defaults), L);
  T.remove("My invoice"); check("remove", T.list().length === 0);
  let seen = null;
  T.setComplete(async (o) => { seen = o; return { ok: true, text: '```json\n{"fields":{"client_name":"Acme","made_up":"x"},"items":[{"description":"Logo design","qty":"3 hours","price":"$90"},{"description":"Hosting","price":20},{"total":999}]}\n```' }; });
  const fp = await T.fillPlan({ ask: "invoice Acme for 3 hours of logo design at $90 and hosting $20", fields: ["client_name", "notes"], kind: "invoice", currency: "$", today: "2026-11-18" });
  check("fillPlan: the LLM is told the fields, kind, currency and today; only known fields kept; items with numbers read from words; no totals from the LLM",
    fp.fields.client_name === "Acme" && !("made_up" in fp.fields) && fp.items.length === 2 && fp.items[0].qty === 3 && fp.items[0].price === 90 && fp.items[1].qty === 1 && /client_name, notes/.test(seen.messages[1].content) && /never work out totals/.test(seen.messages[0].content), fp);
  T.setComplete(null);
  const RI = read("routes/index.js"), SV = read("misc/server.js"), EX = JSON.parse(read("ext/imageeditdock/ext.json")), IE = read("ext/imageeditdock/imageedit.js"), DT = read("ext/imageeditdock/pcdoctpl.js"), GI = read(".gitignore");
  check("the wiring: /api/doctemplates from routes/index.js (not server.js), doc_templates/ git-ignored, pcdoctpl loaded + installed, File menu items, the prompt docker route",
    /require\("\.\/docTemplates"\)\.mount\(app\)/.test(RI) && !/doctemplates/i.test(SV) && /\/doc_templates\//.test(GI) && EX.scripts.indexOf("pcdoctpl.js") === EX.scripts.indexOf("pcdocmargins.js") + 1 && IE.indexOf("PCDocTpl.install(E)") > IE.indexOf("PCDocMargins.install(E)")
    && /addCmd\("file\.tplnew", "🧾 New From Template…"/.test(DT) && /addCmd\("file\.tplsave", "💾 Save as Template…"/.test(DT) && /root\.H3ChatRoutes = \[maybe\]\.concat/.test(DT));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
