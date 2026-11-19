// routes/accounting.js — 2.877.0: 📒 the Accounts docker's books (lib/accounting.js). Mounted from routes/index.js BEFORE the
// 100 KB json parser (receipts and bills come up as pictures / PDFs). ?biz= = a business details id (lib/businessProfiles.js) or main.
//   GET    /api/accounts?biz=&at=                    the books (documents with paid / balance / status) + the business list
//   GET    /api/accounts/report?biz=&kind=&period=&from=&to=&at=&journal=&account=&basis=&which=
//                                                    summary | journal | ledger | tb | pl | bs | bas | aged | jobs
//   POST   /api/accounts/doc        {biz, doc, file (data: URL)}      a receipt, a bill to pay or an invoice we sent
//   DELETE /api/accounts/doc/:id?biz=
//   GET    /api/accounts/file/:name?biz=              the attached receipt / bill
//   POST   /api/accounts/payment    {biz, payment}    paid on a bill / received on an invoice;   DELETE /api/accounts/payment/:id
//   POST   /api/accounts/journal    {biz, entry}      a general journal entry;                   DELETE /api/accounts/journal/:id
//   POST   /api/accounts/job        {biz, job};       DELETE /api/accounts/job/:code
//   POST   /api/accounts/account    {biz, account};   DELETE /api/accounts/account/:code
//   POST   /api/accounts/settings   {biz, settings}   cash / accrual, GST registered, invoice / quote prefix, terms, how to pay, profile
//   2.878.0  POST /api/accounts/quote/:id/state {state} · POST /api/accounts/quote/:id/invoice {date} · GET /api/accounts/print/:id?biz=&auto=1
"use strict";
const express = require("express");
/** whose details head an invoice: the books' own business, else the one picked in Accounts (settings.profile), else the last used */
function printBusiness(bizId, B) {
  try {
    const P = require("../lib/businessProfiles"), L = P.list();
    return L.profiles.find((p) => p.id === bizId) || L.profiles.find((p) => p.id === B.settings.profile) || L.profiles.find((p) => p.id === L.last) || null;
  } catch (e) { return null; }
}
function mount(app) {
  const A = () => require("../lib/accounting");
  const biz = (req) => String((req.body && req.body.biz) || req.query.biz || "main");
  const wrap = (fn) => (req, res) => { try { res.json(fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); } };
  const big = express.json({ limit: "40mb" }), small = express.json({ limit: "1mb" });
  app.get("/api/accounts", wrap((req) => {
    const B = A().load(biz(req));
    let businesses = [];
    try { businesses = require("../lib/businessProfiles").list().profiles.map((p) => ({ id: p.id, name: p.company || p.name })); } catch (e) { /* none */ }
    return Object.assign(A().view(B, req.query.at), { biz: biz(req), businesses, kinds: A().KINDS, tax: A().TAX, journalNames: A().JOURNALS });
  }));
  app.get("/api/accounts/report", wrap((req) => A().report(A().load(biz(req)), req.query)));
  app.post("/api/accounts/doc", big, wrap((req) => A().saveDoc(biz(req), (req.body || {}).doc, (req.body || {}).file || "")));
  app.delete("/api/accounts/doc/:id", wrap((req) => ({ ok: A().removeDoc(biz(req), req.params.id) })));
  app.get("/api/accounts/file/:name", (req, res) => {
    let p = ""; try { p = A().filePath(biz(req), req.params.name); } catch (e) { /* bad biz */ }
    if (!p || !require("fs").existsSync(p)) return res.status(404).json({ error: "no such file" });
    res.sendFile(p);
  });
  // 2.878.0: ✍ invoices + quotes - a quote's state, a quote made an invoice, the page to print / Save as PDF
  app.post("/api/accounts/quote/:id/state", small, wrap((req) => A().quoteState(biz(req), req.params.id, (req.body || {}).state)));
  app.post("/api/accounts/quote/:id/invoice", small, wrap((req) => A().quoteToInvoice(biz(req), req.params.id, (req.body || {}).date)));
  app.get("/api/accounts/print/:id", (req, res) => {
    try {
      const B = A().load(biz(req)), V = A().view(B), d = V.docs.find((x) => x.id === req.params.id);
      if (!d || (d.kind !== "invoice" && d.kind !== "quote")) return res.status(404).json({ error: "no such invoice or quote" });
      const business = printBusiness(biz(req), B);
      const html = require("../lib/accountingPrint").printHtml(d, B, business, { auto: req.query.auto === "1", issues: A().invoiceIssues(B, d, business) });
      res.type("html").send(html);
    } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }
  });
  // 2.879.0: an invoice / quote as the image editor template's fields (📒 Layout ▾ = a template -> 🖨 fills it in the editor)
  app.get("/api/accounts/fields/:id", wrap((req) => {
    const B = A().load(biz(req)), d = A().view(B).docs.find((x) => x.id === req.params.id);
    if (!d || (d.kind !== "invoice" && d.kind !== "quote")) throw Object.assign(new Error("no such invoice or quote"), { status: 404 });
    const business = printBusiness(biz(req), B);
    return Object.assign(require("../lib/accountingPrint").fieldsFor(d, B, business), { kind: d.kind, number: d.number, layout: d.kind === "quote" ? B.settings.quoteLayout || "" : B.settings.invoiceLayout || "", issues: A().invoiceIssues(B, d, business) });
  }));
  app.post("/api/accounts/payment", small, wrap((req) => A().savePayment(biz(req), (req.body || {}).payment)));
  app.delete("/api/accounts/payment/:id", wrap((req) => ({ ok: A().removePayment(biz(req), req.params.id) })));
  app.post("/api/accounts/journal", small, wrap((req) => A().saveJournal(biz(req), (req.body || {}).entry)));
  app.delete("/api/accounts/journal/:id", wrap((req) => ({ ok: A().removeJournal(biz(req), req.params.id) })));
  app.post("/api/accounts/job", small, wrap((req) => A().saveJob(biz(req), (req.body || {}).job)));
  app.delete("/api/accounts/job/:code", wrap((req) => ({ ok: A().removeJob(biz(req), req.params.code) })));
  app.post("/api/accounts/account", small, wrap((req) => A().saveAccount(biz(req), (req.body || {}).account)));
  app.delete("/api/accounts/account/:code", wrap((req) => ({ ok: A().removeAccount(biz(req), req.params.code) })));
  app.post("/api/accounts/settings", small, wrap((req) => A().saveSettings(biz(req), (req.body || {}).settings)));
}
module.exports = { mount };
