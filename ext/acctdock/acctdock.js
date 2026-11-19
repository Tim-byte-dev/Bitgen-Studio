/* acctdock.js — 📒 THE ACCOUNTS DOCKER (2.877.0), window.H3Accounts.
 *
 * Tim (verbatim): "I think one more docker for Accounting - allow user to upload receipts, invoices to pay, invoices paid to us,
 * invoice due to be paid, invoices due to be paid to us, get the total due , the company jobs etc and total due, gst etc.(use au
 * tax system, we will add a dialog for the users taxes and costs later. give the layout the old accounting style aesthetic, with
 * journals, ledger, balance sheet, bas statement, write invoice, quotes etc."
 *
 * The books of a business (lib/accounting.js via routes/accounting.js) on an accountant's green columnar pad with index-card tabs:
 *   Summary        banks, owed to us / we owe (overdue), this quarter's GST, this year's profit, due in 7 days, aged lists
 *   Documents      🧾 receipts (paid), 📥 bills to pay, 📤 invoices we sent - filters (unpaid to us / by us, overdue, paid),
 *                  ✎ edit, 💵 pay / receive, 📎 the attached picture / PDF, 🗑
 *   Journals       Sales, Purchases, Cash Receipts, Cash Payments, General - the old journal layout (credits indented)
 *   Ledger         one account: Balance b/d, each posting with its running balance, Balance c/d
 *   Trial Balance · Profit & Loss · Balance Sheet · BAS (the worksheet: G1 G3 G10 G11 1A 1B, cash / accrual) · Jobs · Accounts
 * 2.878.0 ✍ write invoices + quotes: ＋ 📝 Quote, the customer (address, email, ABN), lines as quantity x unit price, 🖨 the page
 *   to print / Save as PDF (lib/accountingPrint.js - a tax invoice the ATO's way), ➜📤 a quote made an invoice, invoice settings.
 * 2.881.0 ✉ email an invoice / quote / credit note with its PDF (lib/invoicePdf.js) through ✉ Mail's composer; ⤓ the PDF; ⤺ a credit
 *   note (an adjustment note) for an invoice or on its own (💵 refund it).
 * 2.880.0 ✨ Read a receipt… (bar) / ✨ Read it (the dialog): the vision LLM reads the picture (a PDF's first page drawn first,
 *   pdf.js) -> lib/receiptRead.js checks it -> the dialog filled to check + Save; ⤓ CSV on every list / report; 🖨 the BAS worksheet.
 * Pure (Node: scripts/test-877.js): dollars, filterDocs, FILTERS, TABS.
 */
(function (root) {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  /** cents -> "1,234.50", a negative in brackets (the accountant's way); 0 -> "-" when `dash` */
  function dollars(c, dash) {
    const n = Math.round(Number(c) || 0);
    if (!n && dash) return "–";
    const a = Math.abs(n), s = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + String(a % 100).padStart(2, "0");
    return n < 0 ? "(" + s + ")" : s;
  }
  const FILTERS = [["all", "All"], ["receipt", "Receipts"], ["bill", "Bills to pay"], ["invoice", "Invoices we sent"], ["quote", "Quotes"], ["credit", "Credit notes"], ["owedToUs", "Due to be paid to us"],
    ["owedByUs", "Due to be paid by us"], ["overdue", "Overdue"], ["paidToUs", "Paid to us"], ["paidByUs", "Paid by us"]];
  /** the documents a filter shows */
  function filterDocs(docs, f) {
    return (docs || []).filter((d) => {
      switch (f) {
        case "receipt": case "bill": case "invoice": case "quote": case "credit": return d.kind === f;
        case "owedToUs": return d.kind === "invoice" && d.balance > 0;
        case "owedByUs": return d.kind === "bill" && d.balance > 0;
        case "overdue": return d.status === "overdue";
        case "paidToUs": return d.kind === "invoice" && d.balance <= 0;
        case "paidByUs": return (d.kind === "receipt" || d.kind === "bill") && d.balance <= 0;
        default: return true;
      }
    });
  }
  const TABS = [["summary", "Summary"], ["docs", "Documents"], ["journals", "Journals"], ["ledger", "Ledger"], ["tb", "Trial Balance"], ["pl", "Profit & Loss"],
    ["bs", "Balance Sheet"], ["bas", "BAS"], ["jobs", "Jobs"], ["accounts", "Accounts"]];
  const pure = { dollars, filterDocs, FILTERS, TABS };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const store = { get: (k, d) => { try { const v = root.localStorage.getItem("h3.acct." + k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { root.localStorage.setItem("h3.acct." + k, v); } catch (e) { /* fine */ } } };
  const S = { biz: store.get("biz", "main"), tab: store.get("tab", "summary"), per: store.get("per", "quarter"), filter: "all", journal: "SJ", account: "1100", books: null, basis: "" };
  const api = async (u, body, method) => {
    const r = await root.fetch(u, body || method ? { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(Object.assign({ biz: S.biz }, body)) : undefined } : {});
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j;
  };
  const msg = (t, bad) => { const m = $("acMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } };
  const qs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  const perQ = () => ({ period: S.per, from: S.per === "custom" ? $("acFrom").value : "", to: S.per === "custom" ? $("acTo").value : "" });
  const report = (kind, extra) => api("/api/accounts/report?" + qs(Object.assign({ biz: S.biz, kind }, perQ(), extra || {})));
  const N = (c, dash) => `<span class="${Number(c) < 0 ? "neg" : ""}">${dollars(c, dash)}</span>`;
  const acc = (code) => (S.books.accounts.find((a) => a.code === code) || { name: "?" });
  const STAMP = { paid: "paid", overdue: "overdue", due: "due", "part paid": "part", draft: "due", sent: "part", accepted: "ok", declined: "overdue", invoiced: "paid", expired: "overdue", applied: "paid", open: "due", refunded: "paid", credited: "paid" };
  const KIND_ICON = { receipt: "🧾", bill: "📥", invoice: "📤", quote: "📝", credit: "⤺" };
  /* 2.879.0: 🖨 - the ledger page, or (Layout ▾ = an image editor template) that template opened in the image editor, filled */
  const ledgerPage = (id, auto) => root.open("/api/accounts/print/" + encodeURIComponent(id) + "?" + qs({ biz: S.biz, auto: auto ? 1 : "" }), "_blank");
  async function editor() {
    const d = $("imageeditdock");
    if (d && d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone("imageeditdock", "tIE");
    for (let i = 0; i < 100; i++) { const E = root.imageEditorInstance && root.imageEditorInstance.E; if (E && E.docTpl && E.docTpl.fillValues) return E; await new Promise((r) => setTimeout(r, 150)); }
    throw new Error("the image editor did not open");
  }
  async function printDoc(id, auto) {
    const f = await api("/api/accounts/fields/" + encodeURIComponent(id) + "?" + qs({ biz: S.biz }));
    if (!f.layout) return ledgerPage(id, auto);
    const E = await editor();
    const tpls = (await (await root.fetch("/api/doctemplates")).json()).templates || [], t = tpls.find((x) => x.name === f.layout);
    if (!t) { msg(`✗ the layout "${f.layout}" is not among the image editor's templates any more - the ledger page instead`, true); return ledgerPage(id, auto); }
    await E.docTpl.fromTemplate(t);
    E.docTpl.fillValues(f.values, f.items);
    msg(`🖨 ${f.number} filled into your "${t.name}" layout in the image editor - File ▸ 🔍 Print Preview / 🖨 Print, or File ▸ Export ▸ Document for a PDF${f.issues.length ? " · ⚠ " + f.issues.join("; ") : ""}`, !!f.issues.length);
    return true;
  }
  /** 2.881.0: ✉ email it - ✉ Mail's composer opens with the PDF attached, the customer's address, a subject and words; sent = marked */
  async function emailDoc(id) {
    const L = root.H3Layouts;
    if (L && L.isOff({ kind: "dock", id: "maildock" })) return msg("✉ Mail is turned off - turn it on in Settings ▸ Dockers (👁) and add your mailbox", true);
    const md = $("maildock");
    if (md && md.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone("maildock", "tX_maildock");
    for (let i = 0; i < 60 && !(root.H3MailCompose && root.H3Mail && root.H3Mail.S); i++) await new Promise((r) => setTimeout(r, 150));
    if (!root.H3MailCompose) return msg("✉ Mail is not here - turn it on in Settings ▸ Dockers", true);
    if (!(root.H3Mail.S.accounts || []).length) { try { await root.H3Mail.loadAccounts(); } catch (e) { /* none */ } }
    if (!(root.H3Mail.S.accounts || []).length) return msg("✉ add your mailbox in ✉ Mail first (⚙ Accounts) - then ✉ again", true);
    const [f, pdf] = await Promise.all([api("/api/accounts/fields/" + encodeURIComponent(id) + "?" + qs({ biz: S.biz })), api("/api/accounts/pdf/" + encodeURIComponent(id) + "?" + qs({ biz: S.biz, b64: 1 }))]);
    const v = f.values, k = f.kind, nm = String(v.client_name || "").trim().split(/\s+/).filter(Boolean);
    // the greeting: "Ms K Brown" -> Ms Brown, "Jo Smith" -> Jo, a company (Pty Ltd …) or none -> there
    const who = !nm.length || /\b(pty|ltd|limited|inc|llc|co|company|trust|group|services|council)\b/i.test(v.client_name) ? "there" : /^(mr|mrs|ms|miss|mx|dr|prof)\.?$/i.test(nm[0]) && nm.length > 1 ? nm[0] + " " + nm[nm.length - 1] : nm[0];
    const text = `Hi ${who},\n\n` + (k === "quote" ? `Please find attached quote ${v.number} for ${v.total}, valid until ${v.due_date}.`
      : k === "credit" ? `Please find attached ${v.title.toLowerCase()} ${v.number} for ${v.total}${v.reference ? `, crediting invoice ${v.reference}` : ""}.`
      : `Please find attached ${v.title.toLowerCase()} ${v.number} for ${v.balance_due !== v.total ? v.balance_due + " (balance due)" : v.total}, due ${v.due_date}.` + (v.payment_details ? `\n\nHow to pay:\n${v.payment_details}\nPlease use ${v.number} as the reference.` : ""))
      + `\n\nThank you,\n${v.from_name || ""}`;
    root.H3MailCompose.open({ to: v.client_email || "", subject: `${v.title} ${v.number}${v.from_name ? " from " + v.from_name : ""}`, text, attachments: [pdf],
      onSent: () => api("/api/accounts/doc/" + encodeURIComponent(id) + "/sent", { date: todayStr() }).then(refresh).then(() => msg(`✉ ${v.number} emailed to ${v.client_email || "the customer"}`)).catch(() => {}) });
    msg(`✉ the email to ${v.client_email || "(type the address)"} is open in ✉ Mail with ${pdf.name} - check it and ➤ Send`);
    return true;
  }
  /** 🎨 a new A4 page in the image editor with the 🧾 Insert Field list open */
  async function designLayout() {
    const E = await editor();
    E.pages.newDocument({ preset: "A4", wmm: 210, hmm: 297, orient: "portrait", dpi: 150 }, 1, "My invoice layout");
    E.docTpl.fieldDialog();
    msg("🎨 draw your invoice in the image editor - 🧾 Insert Field puts each field on the page; then File ▸ 💾 Save as Template… (kind invoice or quote) and pick it under Layout ▾");
  }
  /** Layout ▾: the ledger page + the image editor templates of that kind (then the others) */
  const layoutOpts = (kind, sel) => `<option value="">📒 ${esc("The ledger page (built in)")}</option>` + (S.tpls || []).filter((t) => !/^_builtin-/.test(t.name)).sort((a, b) => (a.kind === kind ? 0 : 1) - (b.kind === kind ? 0 : 1))
    .map((t) => `<option value="${esc(t.name)}"${t.name === sel ? " selected" : ""}>🧾 ${esc(t.name)} (${esc(t.kind)})</option>`).join("");
  const yes = (t, title) => (typeof root.appConfirm === "function" ? root.appConfirm(t, title) : Promise.resolve(root.confirm(t)));

  async function loadBooks() { S.books = await api("/api/accounts?" + qs({ biz: S.biz })); paintBiz(); return S.books; }
  function paintBiz() {
    const s = $("acBiz"), list = [{ id: "main", name: "My business" }].concat(S.books.businesses || []);
    s.innerHTML = list.map((b) => `<option value="${esc(b.id)}"${b.id === S.biz ? " selected" : ""}>${esc(b.name)}</option>`).join("");
  }
  function paintTabs() { $("acTabs").innerHTML = TABS.map(([id, t]) => `<button type="button" data-tab="${id}"${id === S.tab ? ' class="on"' : ""}>${esc(t)}</button>`).join(""); }
  async function show(tab) {
    if (tab) { S.tab = tab; store.set("tab", tab); }
    paintTabs();
    const P = $("acPaper");
    try {
      if (!S.books) await loadBooks();
      P.innerHTML = await (VIEWS[S.tab] || VIEWS.summary)();
      msg("");
    } catch (e) { P.innerHTML = `<div class="acnote">${esc(e.message)}</div>`; msg("✗ " + e.message, true); }
  }
  const refresh = () => loadBooks().then(() => show()).catch((e) => msg("✗ " + e.message, true));
  // 2.880.0: ⤓ CSV of the list / report in front (and 🖨 the BAS worksheet)
  const CSV_OF = { docs: "docs", journals: "journal", ledger: "ledger", tb: "tb", pl: "pl", bs: "bs", bas: "bas", jobs: "jobs" };
  const head = (title, sub) => `<h3>${esc(title)}${CSV_OF[S.tab] ? `<span style="float:right;font:12px system-ui,sans-serif">${S.tab === "bas" ? `<button type="button" class="ghost" data-basprint title="The BAS worksheet as a page to print or save as PDF">🖨 Print</button> ` : ""}<button type="button" class="ghost" data-csv="${CSV_OF[S.tab]}" title="This list as a CSV file (opens in any spreadsheet)">⤓ CSV</button></span>` : ""}</h3><div class="acsub">${esc(sub || "")}</div>`;
  const reportQ = (kind) => qs(Object.assign({ biz: S.biz, kind, journal: S.journal, account: S.account, basis: S.basis || (S.books && S.books.settings.basis) }, perQ()));
  /* ---- 2.880.0: ✨ a receipt / bill read by the vision LLM -> the dialog filled (nothing saved until Save) */
  const fileAsDataUrl = (f) => new Promise((ok, no) => { const fr = new root.FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = () => no(new Error("the file could not be read")); fr.readAsDataURL(f); });
  const loadScript = (src, test) => new Promise((ok, no) => { if (test()) return ok(test()); const sc = doc.createElement("script"); sc.src = src; sc.onload = () => ok(test()); sc.onerror = () => no(new Error("could not load " + src)); doc.head.appendChild(sc); });
  /** a PDF's first page drawn to a PNG (the vision model takes pictures), else the picture itself */
  async function asPicture(dataUrl) {
    if (!/^data:application\/pdf/.test(dataUrl)) return dataUrl;
    const L = await loadScript("/static/vendor/pdf.min.js", () => root.pdfjsLib);
    if (L.GlobalWorkerOptions && !L.GlobalWorkerOptions.workerSrc) L.GlobalWorkerOptions.workerSrc = "/static/vendor/pdf.worker.min.js";
    const bin = root.atob(dataUrl.split(",")[1]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pdf = await L.getDocument({ data: bytes }).promise, page = await pdf.getPage(1), v0 = page.getViewport({ scale: 1 }), k = Math.min(3, 1800 / Math.max(v0.width, v0.height)), v = page.getViewport({ scale: k });
    const c = doc.createElement("canvas"); c.width = Math.round(v.width); c.height = Math.round(v.height); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: v }).promise; return c.toDataURL("image/png");
  }
  /** read a file -> the receipt / bill dialog filled with what was read (the file kept with it) */
  async function readReceipt(fileData, name, keep) {
    msg("✨ the vision model is reading " + (name || "the receipt") + "…");
    const r = await api("/api/accounts/read", { file: await asPicture(fileData), name, today: todayStr() });
    if (!r.draft) { msg("✨ " + (r.checks || []).join("; "), true); if (!keep) docForm("receipt", null, { file: fileData, fileName: name, checks: r.checks }); return r; }
    const d = Object.assign({}, r.draft, { lines: r.draft.lines.map((l) => Object.assign({}, l, { amount: Math.round(parseFloat(l.amount) * 100) })) }, keep || {});
    docForm(d.kind, d, { file: fileData, fileName: name, checks: ["✨ read by the vision model - check it before you save"].concat(r.checks || []) });
    msg(`✨ read: ${r.draft.party || "?"} $${(r.draft.lines.reduce((t, l) => t + parseFloat(l.amount), 0)).toFixed(2)} - check it, then Save`);
    return r;
  }

  /* ---------------- the views ---------------- */
  const VIEWS = {
    async summary() {
      const s = await report("summary"), bas = s.gst;
      const card = (k, v, sub) => `<div class="accard"><div class="k">${esc(k)}</div><div class="v">$${dollars(v)}</div><div class="s">${esc(sub || "")}</div></div>`;
      const aged = (rows, kind) => rows.length ? `<table class="actab"><tr><th>${kind === "invoice" ? "Customer" : "Supplier"}</th><th>No.</th><th>Due</th><th class="n">Balance</th><th>Status</th></tr>${rows.map((r) => `<tr class="click" data-doc="${esc(r.id)}"><td>${esc(r.party)}</td><td>${esc(r.number)}</td><td>${esc(r.due)}</td><td class="n">${N(r.balance)}</td><td><span class="acstamp ${STAMP[r.status]}">${esc(r.status)}${r.late ? " " + r.late + "d" : ""}</span></td></tr>`).join("")}</table>` : `<div class="acnote">Nothing outstanding.</div>`;
      const [ar, ap] = await Promise.all([report("aged", { which: "invoice" }), report("aged", { which: "bill" })]);
      return head("Summary", `As at ${s.at} · ${s.quarter.label} · ${s.fy.label}`)
        + `<div class="accards">${s.banks.filter((b) => b.balance).map((b) => card(b.name, b.balance)).join("") || card("Bank", 0)}`
        + card("Owed to us", s.owedToUs, s.overdueToUs ? `$${dollars(s.overdueToUs)} overdue` : `${s.unpaidInvoices} invoice(s)`)
        + card("We owe", s.owedByUs, s.overdueByUs ? `$${dollars(s.overdueByUs)} overdue` : `${s.unpaidBills} bill(s)`)
        + `<div class="accard"><div class="k">GST this quarter (${esc(S.books.settings.basis)})</div><div class="v">$${Math.abs(bas.net).toLocaleString("en-AU")}</div><div class="s">${esc(bas.verdict)} · 1A $${bas["1A"]} − 1B $${bas["1B"]}</div></div>`
        + card(`Profit ${s.fy.label} to date`, s.profit, `income $${dollars(s.income)} (no GST)`)
        + (() => { const oq = S.books.docs.filter((d) => d.kind === "quote" && ["draft", "sent", "accepted"].includes(d.status)); return oq.length ? card("Quotes open", oq.reduce((t, d) => t + d.total, 0), `${oq.length} quote(s) - ${oq.filter((d) => d.status === "accepted").length} accepted`) : ""; })() + `</div>`
        + `<h3>Due to be paid to us</h3>${aged(ar.rows, "invoice")}<h3 style="margin-top:12px">Due to be paid by us</h3>${aged(ap.rows, "bill")}`
        + `<div class="acnote">Amounts in Australian dollars. GST at 10 %; the financial year runs 1 July - 30 June. Your own tax settings come in a later release.</div>`;
    },
    async docs() {
      const B = S.books, rows = filterDocs(B.docs, S.filter), sum = (k) => rows.reduce((s, d) => s + d[k], 0);
      return head("Documents", "Receipts, bills to pay and invoices we sent - click a row to change it")
        + `<div class="acfilters">${FILTERS.map(([id, t]) => `<button type="button" data-filter="${id}"${id === S.filter ? ' class="on"' : ""}>${esc(t)}</button>`).join("")}</div>`
        + `<table class="actab"><tr><th>Date</th><th>No.</th><th></th><th>Party</th><th>Job</th><th>Due</th><th class="n">Total</th><th class="n">GST</th><th class="n">Paid</th><th class="n">Balance</th><th>Status</th><th></th></tr>`
        + rows.map((d) => `<tr class="click" data-doc="${esc(d.id)}"><td>${esc(d.date)}</td><td>${esc(d.number)}</td><td title="${esc(B.kinds[d.kind])}">${KIND_ICON[d.kind]}</td><td>${esc(d.party)}</td><td>${esc(d.job)}</td>`
          + `<td>${d.kind === "receipt" ? "" : esc(d.due)}</td><td class="n">${N(d.total)}</td><td class="n">${N(d.gst, 1)}</td><td class="n">${N(d.paid, 1)}</td><td class="n">${N(d.balance, 1)}</td>`
          + `<td><span class="acstamp ${STAMP[d.status]}">${esc(d.status)}</span></td><td class="act">${d.file ? `<button type="button" data-file="${esc(d.file)}" title="Open the attached receipt / bill">📎</button>` : ""}`
          + `${["invoice", "quote", "credit"].includes(d.kind) ? `<button type="button" data-print="${esc(d.id)}" title="Print it or save it as a PDF">🖨</button><button type="button" data-pdf="${esc(d.id)}" title="The PDF file">⤓</button><button type="button" data-email="${esc(d.id)}" title="${d.sent ? "Emailed " + esc(d.sent) + " - email it again" : "Email it with its PDF (✉ Mail)"}">✉${d.sent ? "✓" : ""}</button>` : ""}`
          + `${d.kind === "invoice" ? `<button type="button" data-credit="${esc(d.id)}" title="A credit note for this invoice (an adjustment note)">⤺</button>` : ""}${d.kind === "quote" && d.status !== "invoiced" ? `<button type="button" data-q2i="${esc(d.id)}" title="Make this quote an invoice">➜📤</button>` : ""}`
          + `${d.kind !== "receipt" && d.balance > 0 ? `<button type="button" data-pay="${esc(d.id)}" title="${d.kind === "invoice" ? "Money received" : d.kind === "credit" ? "Refund the credit" : "Pay it"}">💵</button>` : ""}<button type="button" data-del="${esc(d.id)}" title="Delete">🗑</button></td></tr>`).join("")
        + `<tr class="tot gtot"><td colspan="6">${rows.length} document(s)</td><td class="n">${N(sum("total"))}</td><td class="n">${N(sum("gst"))}</td><td class="n">${N(sum("paid"))}</td><td class="n">${N(sum("balance"))}</td><td colspan="2"></td></tr></table>`
        + (B.payments.length ? `<h3 style="margin-top:14px">Payments</h3><table class="actab"><tr><th>Date</th><th>For</th><th>Through</th><th>Ref</th><th class="n">Amount</th><th></th></tr>${B.payments.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((p) => { const d = B.docs.find((x) => x.id === p.doc) || {}; return `<tr><td>${esc(p.date)}</td><td>${KIND_ICON[d.kind] || ""} ${esc(d.number)} ${esc(d.party)}</td><td>${esc(acc(p.account).name)}</td><td>${esc(p.ref)}</td><td class="n">${N(p.amount)}</td><td class="act"><button type="button" data-delpay="${esc(p.id)}" title="Delete the payment">🗑</button></td></tr>`; }).join("")}</table>` : "");
    },
    async journals() {
      const j = await report("journal", { journal: S.journal });
      const sel = `<div class="acrow"><span>Journal</span><select id="acJnl">${Object.entries(S.books.journalNames).map(([k, t]) => `<option value="${k}"${k === S.journal ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`;
      return head(j.name, j.period.label) + sel + `<table class="actab"><tr><th>Date</th><th>Particulars</th><th>Ref</th><th>Job</th><th class="n">Debit</th><th class="n">Credit</th><th></th></tr>`
        + j.rows.map((r) => r.lines.map((l, i) => `<tr class="${l.cr && !l.dr ? "ind" : ""}"><td>${i ? "" : esc(r.date)}</td><td class="p">${l.cr && !l.dr ? "To " : ""}${esc(l.name)} <span style="color:#6b7c62">${esc(l.account)}</span></td><td>${i ? "" : esc(r.ref)}</td><td>${esc(l.job)}</td><td class="n">${N(l.dr, 1)}</td><td class="n">${N(l.cr, 1)}</td>`
          + `<td class="act">${!i && r.src.type === "journal" ? `<button type="button" data-deljnl="${esc(r.src.id)}" title="Delete the entry">🗑</button>` : ""}</td></tr>`).join("")
          + `<tr><td></td><td colspan="6" style="font-style:italic;color:#4c5d43;padding-left:34px">(being ${esc(r.memo || r.party || "entry")}${r.party && r.memo ? " - " + esc(r.party) : ""})</td></tr>`).join("")
        + `<tr class="tot gtot"><td colspan="4">Totals</td><td class="n">${N(j.dr)}</td><td class="n">${N(j.cr)}</td><td></td></tr></table>`;
    },
    async ledger() {
      const L = await report("ledger", { account: S.account }), a = L.account;
      const sel = `<div class="acrow"><span>Account</span><select id="acAcc">${S.books.accounts.map((x) => `<option value="${x.code}"${x.code === S.account ? " selected" : ""}>${x.code} ${esc(x.name)}</option>`).join("")}</select></div>`;
      return head(`${a.code} ${a.name}`, `${L.period.label} · ${a.type}`) + sel + `<table class="actab"><tr><th>Date</th><th>Particulars</th><th>Jnl</th><th>Ref</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr>`
        + `<tr><td>${esc(L.period.from)}</td><td><i>Balance b/d</i></td><td></td><td></td><td class="n"></td><td class="n"></td><td class="n">${N(L.opening)}</td></tr>`
        + L.rows.map((r) => `<tr><td>${esc(r.date)}</td><td>${esc(r.memo)}${r.party ? " - " + esc(r.party) : ""}</td><td>${esc(r.journal)}</td><td>${esc(r.ref)}</td><td class="n">${N(r.dr, 1)}</td><td class="n">${N(r.cr, 1)}</td><td class="n">${N(r.balance)}</td></tr>`).join("")
        + `<tr class="tot gtot"><td>${esc(L.period.to)}</td><td><i>Balance c/d</i></td><td></td><td></td><td class="n"></td><td class="n"></td><td class="n">${N(L.closing)}</td></tr></table>`;
    },
    async tb() {
      const t = await report("tb");
      return head("Trial Balance", "As at " + t.to) + `<table class="actab"><tr><th>Code</th><th>Account</th><th class="n">Debit</th><th class="n">Credit</th></tr>`
        + t.rows.map((r) => `<tr class="click" data-ledger="${r.code}"><td>${r.code}</td><td>${esc(r.name)}</td><td class="n">${N(r.dr, 1)}</td><td class="n">${N(r.cr, 1)}</td></tr>`).join("")
        + `<tr class="tot gtot"><td></td><td>Totals <span class="acstamp ${t.balanced ? "ok" : "overdue"}">${t.balanced ? "in balance" : "out of balance"}</span></td><td class="n">${N(t.dr)}</td><td class="n">${N(t.cr)}</td></tr></table>`;
    },
    async pl() {
      const p = await report("pl"), sec = (rows) => rows.map((r) => `<tr class="click ind" data-ledger="${r.code}"><td class="p">${esc(r.name)}</td><td class="n">${N(r.amount)}</td><td class="n"></td></tr>`).join("");
      return head("Profit & Loss Statement", `${p.period.label} · amounts without GST`) + `<table class="actab" style="max-width:640px"><tr><th></th><th class="n"></th><th class="n"></th></tr>`
        + `<tr class="sec"><td colspan="3">Income</td></tr>${sec(p.income)}<tr class="tot"><td>Total Income</td><td class="n"></td><td class="n">${N(p.totalIncome)}</td></tr>`
        + `<tr class="sec"><td colspan="3">Less Cost of Sales</td></tr>${sec(p.cos)}<tr class="tot"><td>Total Cost of Sales</td><td class="n"></td><td class="n">${N(p.totalCos)}</td></tr>`
        + `<tr class="tot"><td>Gross Profit</td><td class="n"></td><td class="n">${N(p.gross)}</td></tr>`
        + `<tr class="sec"><td colspan="3">Less Expenses</td></tr>${sec(p.expenses)}<tr class="tot"><td>Total Expenses</td><td class="n"></td><td class="n">${N(p.totalExpenses)}</td></tr>`
        + `<tr class="tot gtot"><td>Net ${p.net < 0 ? "Loss" : "Profit"}</td><td class="n"></td><td class="n">${N(p.net)}</td></tr></table>`;
    },
    async bs() {
      const b = await report("bs"), sec = (rows) => rows.map((r) => `<tr class="${r.code ? "click " : ""}ind"${r.code ? ` data-ledger="${r.code}"` : ""}><td class="p">${esc(r.name)}</td><td class="n">${N(r.amount)}</td><td class="n"></td></tr>`).join("");
      return head("Balance Sheet", "As at " + b.to) + `<table class="actab" style="max-width:640px"><tr><th></th><th class="n"></th><th class="n"></th></tr>`
        + `<tr class="sec"><td colspan="3">Assets</td></tr>${sec(b.assets)}<tr class="tot"><td>Total Assets</td><td class="n"></td><td class="n">${N(b.totalAssets)}</td></tr>`
        + `<tr class="sec"><td colspan="3">Liabilities</td></tr>${sec(b.liabilities)}<tr class="tot"><td>Total Liabilities</td><td class="n"></td><td class="n">${N(b.totalLiabilities)}</td></tr>`
        + `<tr class="tot gtot"><td>Net Assets</td><td class="n"></td><td class="n">${N(b.netAssets)}</td></tr>`
        + `<tr class="sec"><td colspan="3">Equity</td></tr>${sec(b.equity)}<tr class="tot gtot"><td>Total Equity <span class="acstamp ${b.balanced ? "ok" : "overdue"}">${b.balanced ? "balances" : "does not balance"}</span></td><td class="n"></td><td class="n">${N(b.totalEquity)}</td></tr></table>`;
    },
    async bas() {
      const b = await report("bas", { basis: S.basis || S.books.settings.basis }), box = (cd, lbl, v) => `<div class="box"><span class="cd">${cd}</span><span class="lbl">${esc(lbl)}</span><span class="fig">$${Number(v).toLocaleString("en-AU")}</span></div>`;
      return head("Business Activity Statement - GST worksheet", `${b.period.label} · ${b.basis} basis · ${b.docs} document(s)`)
        + `<div class="acrow"><span>Basis</span><select id="acBasis"><option value="cash"${b.basis === "cash" ? " selected" : ""}>Cash (when paid)</option><option value="accrual"${b.basis === "accrual" ? " selected" : ""}>Accrual (when invoiced)</option></select>`
        + `<label><input type="checkbox" id="acBasisKeep"> keep as these books' basis</label></div>`
        + `<div class="acbas"><h4>GST amounts you owe the ATO from sales</h4>${box("G1", "Total sales (including any GST)", b.G1)}${box("G2", "Export sales", b.G2)}${box("G3", "Other GST-free sales", b.G3)}${box("1A", "GST on sales", b["1A"])}`
        + `<h4>GST amounts the ATO owes you from purchases</h4>${box("G10", "Capital purchases (including any GST)", b.G10)}${box("G11", "Non-capital purchases (including any GST)", b.G11)}${box("1B", "GST on purchases", b["1B"])}`
        + `<h4>Summary</h4><div class="box"><span class="lbl" style="font-weight:700">1A − 1B: ${esc(b.verdict)}</span><span class="fig">$${Math.abs(b.net).toLocaleString("en-AU")}</span></div></div>`
        + (b.adjustments["1A"] || b.adjustments["1B"] ? `<div class="acnote">Includes GST adjustments from the General Journal: 1A $${dollars(b.adjustments["1A"])}, 1B $${dollars(b.adjustments["1B"])}.</div>` : "")
        + `<div class="acnote">Whole dollars, cents left off, as the ATO asks. A worksheet for your BAS - lodge it through the ATO or your tax agent and check it with them. PAYG withholding (W1, W2) and instalments come with the taxes settings later.</div>`;
    },
    async jobs() {
      const r = await report("jobs");
      return head("Jobs", `${r.period.label} · amounts without GST; owed = still unpaid now`)
        + `<div class="acrow"><input id="acJobCode" placeholder="JOB-001" style="width:90px"><input id="acJobName" placeholder="What the job is"><input id="acJobClient" placeholder="Client"><button type="button" class="ghost" id="acJobAdd">＋ Add job</button></div>`
        + `<table class="actab"><tr><th>Code</th><th>Job</th><th>Client</th><th>Status</th><th class="n">Income</th><th class="n">Costs</th><th class="n">Profit</th><th class="n">Owed to us</th><th class="n">We owe</th><th></th></tr>`
        + r.jobs.map((j) => `<tr><td>${esc(j.code)}</td><td>${esc(j.name)}</td><td>${esc(j.client)}</td><td>${esc(j.status)}</td><td class="n">${N(j.income, 1)}</td><td class="n">${N(j.costs, 1)}</td><td class="n">${N(j.profit)}</td><td class="n">${N(j.owed, 1)}</td><td class="n">${N(j.toPay, 1)}</td>`
          + `<td class="act"><button type="button" data-jobtoggle="${esc(j.code)}" title="${j.status === "open" ? "Close the job" : "Open it again"}">${j.status === "open" ? "✔" : "↺"}</button><button type="button" data-deljob="${esc(j.code)}" title="Delete (only without entries)">🗑</button></td></tr>`).join("")
        + `<tr class="tot gtot"><td colspan="4">Totals</td>${["income", "costs", "profit", "owed", "toPay"].map((k) => `<td class="n">${N(r.jobs.reduce((s, j) => s + j[k], 0))}</td>`).join("")}<td></td></tr></table>`;
    },
    async accounts() {
      try { S.tpls = (await (await root.fetch("/api/doctemplates")).json()).templates || []; } catch (e) { S.tpls = []; }
      const B = S.books, T = { asset: "Asset", liability: "Liability", equity: "Equity", income: "Income", cos: "Cost of sales", expense: "Expense" };
      return head("Chart of Accounts", "Click an account for its ledger")
        + `<div class="acrow"><input id="acAccCode" placeholder="6270" style="width:60px"><input id="acAccName" placeholder="Account name"><select id="acAccType">${Object.entries(T).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select>`
        + `<select id="acAccTax">${Object.entries(B.tax).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select><label><input type="checkbox" id="acAccBank"> bank / cash / card</label><button type="button" class="ghost" id="acAccAdd">＋ Add / change</button></div>`
        + `<div class="acrow"><span>GST registered</span><input type="checkbox" id="acGstReg"${B.settings.gstRegistered ? " checked" : ""}><span>Invoice numbers start</span><input id="acInvPre" value="${esc(B.settings.invoicePrefix)}" style="width:60px">`
        + `<span>Quote numbers start</span><input id="acQPre" value="${esc(B.settings.quotePrefix || "Q-")}" style="width:50px"><span>Invoices due after</span><input id="acTerms" type="number" min="0" max="365" value="${B.settings.terms != null ? B.settings.terms : 14}" style="width:56px"><span>days · quotes valid for</span><input id="acQDays" type="number" min="1" max="365" value="${B.settings.quoteDays || 30}" style="width:56px"><span>days</span></div>`
        + `<div class="acrow" style="align-items:flex-start"><span>How to pay (on invoices)</span><textarea id="acPayTo" rows="2" style="width:320px" placeholder="Bank: Commonwealth Bank&#10;BSB 062-000  Account 1234 5678">${esc(B.settings.payTo || "")}</textarea>`
        + `<div class="acrow"><span>Invoice layout</span><select id="acInvLay">${layoutOpts("invoice", B.settings.invoiceLayout)}</select><span>Quote layout</span><select id="acQLay">${layoutOpts("quote", B.settings.quoteLayout)}</select>`
        + `<button type="button" class="ghost" id="acDesign" title="A new A4 page in the image editor with the fields to place">🎨 Design a layout in the image editor…</button></div>`
        + (S.biz === "main" ? `<span>Invoices headed with</span><select id="acProfile"><option value="">— the business details used last —</option>${(B.businesses || []).map((b) => `<option value="${esc(b.id)}"${b.id === B.settings.profile ? " selected" : ""}>${esc(b.name)}</option>`).join("")}</select>` : `<span class="acnote">Invoices are headed with this business's details (name, logo, address, ABN).</span>`) + `</div>`
        + `<table class="actab"><tr><th>Code</th><th>Account</th><th>Type</th><th>Tax code</th><th></th></tr>`
        + B.accounts.map((a) => `<tr class="click" data-ledger="${a.code}"><td>${a.code}</td><td>${esc(a.name)}${a.bank ? " 🏦" : ""}</td><td>${T[a.type]}</td><td>${esc(a.tax)}</td><td class="act">${a.system ? "<i style='color:#6b7c62'>system</i>" : `<button type="button" data-delacc="${a.code}" title="Delete (only without entries)">🗑</button>`}</td></tr>`).join("") + `</table>`;
    },
  };

  /* ---------------- the entry dialog ---------------- */
  let dlgOk = null;
  function dialog(title, html, ok, init) {
    // a fresh body each time - the last dialog's listeners go with the old one
    const d = $("acDlg"), old = $("acDlgB"), nb = doc.createElement("div"); nb.id = "acDlgB"; nb.className = "db"; old.replaceWith(nb);
    $("acDlgT").textContent = title; nb.innerHTML = html; $("acDlgE").textContent = ""; dlgOk = ok;
    if (!d.open) d.showModal();
    if (init) init($("acDlgB"));
  }
  const accOpts = (filter, sel) => S.books.accounts.filter(filter).map((a) => `<option value="${a.code}"${a.code === sel ? " selected" : ""}>${a.code} ${esc(a.name)}</option>`).join("");
  const jobOpts = (sel) => `<option value="">— no job —</option>` + S.books.jobs.filter((j) => j.status === "open" || j.code === sel).map((j) => `<option value="${esc(j.code)}"${j.code === sel ? " selected" : ""}>${esc(j.code)} ${esc(j.name)}</option>`).join("");
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const toDollars = (c) => (c == null || c === "" ? "" : (Number(c) / 100).toFixed(2));
  function docForm(kind0, d0, pre) {
    const P0 = pre || {};
    const d = d0 || { kind: kind0, date: todayStr(), lines: [{}] }, kind = d.kind, sale = kind === "invoice" || kind === "quote" || kind === "credit";
    const lineFilter = sale ? (a) => a.type === "income" : (a) => ["expense", "cos", "asset"].includes(a.type) && !a.system && !a.bank;
    const defAcc = sale ? "4200" : "6900";
    // 2.878.0: an invoice / quote line = quantity x unit price (GST inclusive); the amount follows
    const line = (l) => `<tr><td><input data-k="desc" value="${esc(l.desc || "")}" placeholder="What it was" style="width:${sale ? 200 : 240}px"></td><td><select data-k="account">${accOpts(lineFilter, l.account || defAcc)}</select></td>`
      + (sale ? `<td><input data-k="qty" class="n" style="width:60px" value="${l.qty != null ? l.qty : 1}"></td><td><input data-k="unit" class="n" value="${l.unit != null ? toDollars(l.unit) : toDollars(l.amount)}" placeholder="0.00"></td>` : "")
      + `<td><input data-k="amount" class="n" value="${toDollars(l.amount)}" placeholder="0.00"${sale ? " readonly tabindex=\"-1\"" : ""}></td><td><select data-k="tax">${Object.entries(S.books.tax).filter(([k]) => !sale || k !== "CAP").map(([k, t]) => `<option value="${k}"${(l.tax || "") === k ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></td>`
      + `<td class="n" data-gst></td><td><button type="button" class="ghost" data-rmline title="Remove the line">✕</button></td></tr>`;
    const html = `<div><label class="f">${sale ? "Customer" : "Supplier"}<input id="acfParty" value="${esc(d.party || "")}" style="width:220px"></label>`
      + `<label class="f">${kind === "invoice" ? "Invoice no. (blank = next)" : kind === "quote" ? "Quote no. (blank = next)" : kind === "credit" ? "Credit note no. (blank = next)" : "Their invoice / receipt no."}<input id="acfNo" value="${esc(d.number || "")}" style="width:120px"></label>`
      + `<label class="f">Date<input type="date" id="acfDate" value="${esc(d.date || todayStr())}"></label>`
      + (kind === "credit" ? `<span class="acnote" style="align-self:center">${d.forInvoice ? esc("For invoice") + " " + esc(d.ref || "") : esc("A credit on its own - 💵 refund it later")}</span>` : kind === "receipt" ? `<label class="f">Paid from<select id="acfFrom">${accOpts((a) => a.bank, d.paidFrom || "1100")}</select></label>` : `<label class="f">${kind === "quote" ? "Valid until" : "Due"}<input type="date" id="acfDue" value="${esc(d.due || "")}" title="Blank = ${kind === "quote" ? S.books.settings.quoteDays + " days" : (S.books.settings.terms != null ? S.books.settings.terms : 14) + " days"} after the date"></label>`)
      + (kind === "quote" ? `<label class="f">Status<select id="acfQst">${["draft", "sent", "accepted", "declined"].map((x) => `<option${(d.qstatus || "draft") === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>` : "")
      + `<label class="f">Job<select id="acfJob">${jobOpts(d.job)}</select></label></div>`
      + (sale ? `<div><label class="f">Customer's address<textarea id="acfAddr" rows="2" style="width:260px">${esc(d.partyAddress || "")}</textarea></label><label class="f">Customer's email<input id="acfEmail" value="${esc(d.partyEmail || "")}" style="width:200px"></label>`
        + `<label class="f">Customer's ABN<input id="acfAbn" value="${esc(d.partyAbn || "")}" style="width:130px" placeholder="for $1,000 or more"></label></div>` : "")
      + `<table class="actab" id="acfLines"><tr><th>Description</th><th>Account</th>${sale ? '<th class="n">Qty</th><th class="n">Unit price incl. GST</th>' : ""}<th class="n">Amount incl. GST</th><th>Tax</th><th class="n">GST</th><th></th></tr>${d.lines.map(line).join("")}</table>`
      + `<div class="acrow"><button type="button" class="ghost" id="acfAdd">＋ Line</button><span style="flex:1"></span><span id="acfTot" class="acnum"></span></div><div id="acfWarn" class="acnote" style="color:#b1302a"></div>`
      + `<label class="f" style="display:flex">Notes<textarea id="acfNotes" rows="2" style="width:100%">${esc(d.notes || "")}</textarea></label>`
      + `<div class="acrow"><button type="button" class="ghost" id="acfFileBtn">📎 Attach ${sale ? "a copy" : "the " + (kind === "bill" ? "bill" : "receipt")} (picture or PDF)…</button><span id="acfFileName" style="font-style:italic">${d.file ? "kept: " + esc(d.file) : ""}</span>`
      + `<input type="file" id="acfFile" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" style="display:none">`
      + (sale ? "" : `<button type="button" class="ghost" id="acfRead" title="The vision model reads the attached receipt / bill and fills this in"${P0.file ? "" : " disabled"}>✨ Read it</button>`) + `</div>`
      + (P0.checks && P0.checks.length ? `<div class="acnote" style="color:#8a5a00">${P0.checks.map(esc).join("<br>")}</div>` : "");
    let fileData = P0.file || "", fileName = P0.fileName || "";
    const title = (d.id ? "Change " : "New ") + ({ receipt: "receipt (paid)", bill: "bill to pay", invoice: "invoice we sent", quote: "quote", credit: "credit note" })[kind];
    dialog(title, html, async () => {
      const lines = [...$("acfLines").querySelectorAll("tr")].slice(1).map((tr) => { const o = {}; tr.querySelectorAll("[data-k]").forEach((el) => { o[el.dataset.k] = el.value; }); return o; }).filter((l) => l.amount !== "" || l.desc);
      const body = { doc: { id: d.id, kind, party: $("acfParty").value, number: $("acfNo").value, date: $("acfDate").value, due: $("acfDue") ? $("acfDue").value : "", paidFrom: $("acfFrom") ? $("acfFrom").value : "",
        job: $("acfJob").value, notes: $("acfNotes").value, lines }, file: fileData || undefined };
      if (sale) Object.assign(body.doc, { partyAddress: $("acfAddr").value, partyEmail: $("acfEmail").value, partyAbn: $("acfAbn").value });
      if (kind === "quote") body.doc.qstatus = $("acfQst").value;
      if (kind === "credit" && d.forInvoice) Object.assign(body.doc, { forInvoice: d.forInvoice, ref: d.ref || "" });
      const saved = await api("/api/accounts/doc", body);
      msg(`✔ ${saved.number || saved.party || "document"} kept - $${dollars(saved.total)} (GST $${dollars(saved.gst)})${sale ? " - 🖨 on its row prints it" : ""}`);
    }, (b) => {
      const R = 0.1, tot = () => {
        let t = 0, g = 0;
        $("acfLines").querySelectorAll("tr").forEach((tr, i) => {
          if (!i) return;
          if (sale) { const qv = parseFloat((tr.querySelector('[data-k="qty"]') || {}).value) || 0, uv = parseFloat(String((tr.querySelector('[data-k="unit"]') || {}).value || "").replace(/[$,]/g, "")) || 0; tr.querySelector('[data-k="amount"]').value = qv && uv ? (Math.round(qv * uv * 100) / 100).toFixed(2) : ""; }
          const a = parseFloat(String((tr.querySelector('[data-k="amount"]') || {}).value || "").replace(/[$,]/g, "")) || 0, tax = (tr.querySelector('[data-k="tax"]') || {}).value;
          const gst = S.books.settings.gstRegistered && (tax === "GST" || tax === "CAP") ? Math.round(a * 100 * R / (1 + R)) : 0; t += Math.round(a * 100); g += gst;
          const cell = tr.querySelector("[data-gst]"); if (cell) cell.textContent = dollars(gst, true);
        });
        $("acfTot").textContent = `Total $${dollars(t)} · GST $${dollars(g)} · without GST $${dollars(t - g)}`;
        // 2.878.0: the ATO - a tax invoice of $1,000 or more shows the buyer's identity or ABN
        if (sale) $("acfWarn").textContent = S.books.settings.gstRegistered && t >= 100000 && !$("acfParty").value.trim() && !$("acfAbn").value.trim() ? "A tax invoice of $1,000 or more must show the buyer's name or ABN." : "";
      };
      const setTax = (tr) => { const s = tr.querySelector('[data-k="account"]'), tx = tr.querySelector('[data-k="tax"]'), a = S.books.accounts.find((x) => x.code === s.value); if (a && !tx.dataset.touched) tx.value = sale && a.tax === "CAP" ? "GST" : a.tax; };
      b.addEventListener("input", tot);
      b.addEventListener("change", (e) => { const tr = e.target.closest("tr"); if (e.target.dataset.k === "tax") e.target.dataset.touched = "1"; if (e.target.dataset.k === "account" && tr) setTax(tr); tot(); });
      b.addEventListener("click", (e) => { if (e.target.closest("[data-rmline]")) { const tr = e.target.closest("tr"); if ($("acfLines").querySelectorAll("tr").length > 2) tr.remove(); tot(); } });
      $("acfAdd").onclick = () => { const tb = $("acfLines").tBodies[0]; tb.insertAdjacentHTML("beforeend", line({})); setTax(tb.lastElementChild); tot(); };
      $("acfFileBtn").onclick = () => { $("acfFile").value = ""; $("acfFile").click(); };
      $("acfFile").onchange = () => { const f = $("acfFile").files[0]; if (!f) return; if (f.size > 25 * 1024 * 1024) { $("acDlgE").textContent = "the file is over 25 MB"; return; } const fr = new root.FileReader(); fr.onload = () => { fileData = String(fr.result); fileName = f.name; $("acfFileName").textContent = "📎 " + f.name; if ($("acfRead")) $("acfRead").disabled = false; }; fr.readAsDataURL(f); };
      if (fileName) $("acfFileName").textContent = "📎 " + fileName;
      if ($("acfRead")) $("acfRead").onclick = () => { $("acfRead").disabled = true; readReceipt(fileData, fileName, d.id ? { id: d.id } : null).catch((e) => { $("acDlgE").textContent = e.message; $("acfRead").disabled = false; }); };
      if (!d.id) $("acfLines").querySelectorAll("tr").forEach((tr, i) => { if (i) { const tx = tr.querySelector('[data-k="tax"]'); if (tx && !d.lines[i - 1].tax) setTax(tr); } });
      tot(); setTimeout(() => $("acfParty").focus(), 0);
    });
  }
  function payForm(d) {
    const html = `<div>${KIND_ICON[d.kind]} ${esc(d.number)} ${esc(d.party)} - total $${dollars(d.total)}, still owing <b>$${dollars(d.balance)}</b></div><br>`
      + `<label class="f">Date<input type="date" id="acpDate" value="${todayStr() < d.date ? d.date : todayStr()}"></label><label class="f">Amount<input id="acpAmt" class="n" value="${toDollars(d.balance)}"></label>`
      + `<label class="f">${d.kind === "invoice" ? "Into" : "From"}<select id="acpAcc">${accOpts((a) => a.bank, "1100")}</select></label><label class="f">Reference<input id="acpRef" style="width:140px"></label>`;
    dialog(d.kind === "invoice" ? "Money received" : d.kind === "credit" ? "Refund the credit" : "Pay the bill", html, async () => {
      await api("/api/accounts/payment", { payment: { doc: d.id, date: $("acpDate").value, amount: $("acpAmt").value, account: $("acpAcc").value, ref: $("acpRef").value } });
      msg(`✔ $${$("acpAmt").value} ${d.kind === "invoice" ? "received" : d.kind === "credit" ? "refunded" : "paid"} - ${d.party}`);
    });
  }
  function journalForm() {
    const line = () => `<tr><td><select data-k="account">${accOpts(() => true, "")}</select></td><td><input data-k="dr" class="n" placeholder="0.00"></td><td><input data-k="cr" class="n" placeholder="0.00"></td><td><select data-k="job">${jobOpts("")}</select></td><td><input data-k="memo" style="width:160px"></td></tr>`;
    const html = `<label class="f">Date<input type="date" id="acjDate" value="${todayStr()}"></label><label class="f">Being (what it is for)<input id="acjMemo" style="width:300px"></label><label class="f">Ref<input id="acjRef" style="width:90px"></label>`
      + `<table class="actab" id="acjLines"><tr><th>Account</th><th class="n">Debit</th><th class="n">Credit</th><th>Job</th><th>Note</th></tr>${line()}${line()}</table>`
      + `<div class="acrow"><button type="button" class="ghost" id="acjAdd">＋ Line</button><span style="flex:1"></span><span id="acjTot" class="acnum"></span></div>`;
    dialog("General journal entry", html, async () => {
      const lines = [...$("acjLines").querySelectorAll("tr")].slice(1).map((tr) => { const o = {}; tr.querySelectorAll("[data-k]").forEach((el) => { o[el.dataset.k] = el.value; }); return o; });
      await api("/api/accounts/journal", { entry: { date: $("acjDate").value, memo: $("acjMemo").value, ref: $("acjRef").value, lines } });
      msg("✔ journal entry kept");
    }, (b) => {
      const tot = () => { let dr = 0, cr = 0; b.querySelectorAll('[data-k="dr"]').forEach((i) => { dr += Math.round((parseFloat(i.value.replace(/[$,]/g, "")) || 0) * 100); }); b.querySelectorAll('[data-k="cr"]').forEach((i) => { cr += Math.round((parseFloat(i.value.replace(/[$,]/g, "")) || 0) * 100); }); $("acjTot").textContent = `Dr $${dollars(dr)} · Cr $${dollars(cr)} ${dr === cr && dr ? "✓ balances" : "- must balance"}`; };
      b.addEventListener("input", tot); $("acjAdd").onclick = () => { $("acjLines").tBodies[0].insertAdjacentHTML("beforeend", line()); }; tot();
    });
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    const d = $("acctdock"); if (!d) return;
    try { if (root.localStorage.getItem("h3.g.acctdock") == null) { root.localStorage.setItem("h3.g.acctdock", "1"); d.classList.add("dockgone"); } } catch (e) { /* fine */ }
    // 2.879.0 (Tim: "hide the accounting docker and button. let user enable it in settings-dockers"): OFF the first time - the
    // docker and its 📒 button are gone until 👁 in Settings ▸ Dockers turns it on (static/layouts.js h3.dockoff); once only
    try {
      if (root.localStorage.getItem("h3.acct.offSeed") == null) {
        root.localStorage.setItem("h3.acct.offSeed", "1");
        let l = []; try { l = JSON.parse(root.localStorage.getItem("h3.dockoff") || "[]"); } catch (e) { l = []; }
        if (!Array.isArray(l)) l = [];
        if (!l.includes("acctdock")) { l.push("acctdock"); root.localStorage.setItem("h3.dockoff", JSON.stringify(l)); }
        const off = () => { if (root.H3Layouts && root.H3Layouts.isOff({ kind: "dock", id: "acctdock" })) root.H3Layouts.set({ kind: "dock", id: "acctdock" }, true); };
        setTimeout(off, 1600); setTimeout(off, 4000);
      }
    } catch (e) { /* fine */ }
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    $("acPer").value = S.per;
    const custom = () => { const c = S.per === "custom"; $("acFrom").style.display = $("acTo").style.display = c ? "" : "none"; };
    custom();
    on("acCloseBtn", "click", (e) => { e.stopPropagation(); if (typeof root.toggleDockGone === "function") root.toggleDockGone("acctdock", "tX_acctdock"); });
    on("acBiz", "change", (e) => { S.biz = e.target.value; store.set("biz", S.biz); refresh(); });
    on("acPer", "change", (e) => { S.per = e.target.value; store.set("per", S.per); custom(); if (S.per !== "custom" || ($("acFrom").value && $("acTo").value)) show(); });
    on("acFrom", "change", () => $("acTo").value && show()); on("acTo", "change", () => $("acFrom").value && show());
    on("acNewReceipt", "click", () => loadBooks().then(() => docForm("receipt")));
    on("acNewBill", "click", () => loadBooks().then(() => docForm("bill")));
    on("acNewInvoice", "click", () => loadBooks().then(() => docForm("invoice")));
    on("acNewQuote", "click", () => loadBooks().then(() => docForm("quote")));
    on("acRead", "click", () => { $("acReadFile").value = ""; $("acReadFile").click(); });
    on("acReadFile", "change", async () => {
      const f = $("acReadFile").files[0]; if (!f) return;
      if (f.size > 25 * 1024 * 1024) return msg("✗ the file is over 25 MB", true);
      try { await loadBooks(); await readReceipt(await fileAsDataUrl(f), f.name); } catch (e) { msg("✗ " + e.message, true); }
    });
    on("acNewJournal", "click", () => loadBooks().then(journalForm));
    on("acTabs", "click", (e) => { const b = e.target.closest("button[data-tab]"); if (b) show(b.dataset.tab); });
    on("acDlgCancel", "click", () => $("acDlg").close());
    on("acDlgOk", "click", async () => {
      if (!dlgOk) return; const b = $("acDlgOk"); b.disabled = true;
      try { await dlgOk(); $("acDlg").close(); await refresh(); } catch (e) { $("acDlgE").textContent = e.message; } finally { b.disabled = false; }
    });
    on("acPaper", "change", (e) => {
      const t = e.target;
      if (t.id === "acJnl") { S.journal = t.value; show(); }
      if (t.id === "acAcc") { S.account = t.value; show(); }
      if (t.id === "acBasis") { S.basis = t.value; if ($("acBasisKeep").checked) api("/api/accounts/settings", { settings: { basis: t.value } }).then(refresh); else show(); }
      if (t.id === "acBasisKeep" && t.checked) api("/api/accounts/settings", { settings: { basis: $("acBasis").value } }).then(() => { S.basis = ""; msg("✔ the books' GST basis: " + $("acBasis").value); return refresh(); });
      if (t.id === "acGstReg") api("/api/accounts/settings", { settings: { gstRegistered: t.checked } }).then(refresh).catch((er) => msg("✗ " + er.message, true));
      if (t.id === "acInvPre") api("/api/accounts/settings", { settings: { invoicePrefix: t.value } }).then(refresh).catch((er) => msg("✗ " + er.message, true));
      const SET = { acInvLay: "invoiceLayout", acQLay: "quoteLayout", acQPre: "quotePrefix", acTerms: "terms", acQDays: "quoteDays", acPayTo: "payTo", acProfile: "profile" };
      if (SET[t.id]) api("/api/accounts/settings", { settings: { [SET[t.id]]: t.value } }).then(() => { msg("✔ kept"); return loadBooks(); }).catch((er) => msg("✗ " + er.message, true));
    });
    on("acPaper", "click", async (e) => {
      const t = e.target, B = S.books, one = (sel) => t.closest(sel);
      try {
        let x;
        if ((x = one("[data-filter]"))) { S.filter = x.dataset.filter; return show(); }
        if ((x = one("[data-file]"))) { e.stopPropagation(); return root.open("/api/accounts/file/" + encodeURIComponent(x.dataset.file) + "?biz=" + encodeURIComponent(S.biz), "_blank"); }
        if ((x = one("[data-csv]"))) { e.stopPropagation(); return root.open("/api/accounts/csv?" + reportQ(x.dataset.csv), "_blank"); }
        if ((x = one("[data-basprint]"))) { e.stopPropagation(); return root.open("/api/accounts/bas-print?" + reportQ("bas"), "_blank"); }
        if ((x = one("[data-pdf]"))) { e.stopPropagation(); return root.open("/api/accounts/pdf/" + encodeURIComponent(x.dataset.pdf) + "?" + qs({ biz: S.biz }), "_blank"); }
        if ((x = one("[data-email]"))) { e.stopPropagation(); return emailDoc(x.dataset.email); }
        if ((x = one("[data-credit]"))) { e.stopPropagation(); const inv = B.docs.find((y) => y.id === x.dataset.credit);
          return docForm("credit", { kind: "credit", date: todayStr(), party: inv.party, partyAddress: inv.partyAddress, partyEmail: inv.partyEmail, partyAbn: inv.partyAbn, job: inv.job, forInvoice: inv.id, ref: inv.number,
            lines: inv.lines.map((l) => Object.assign({}, l)) }, { checks: [`Credits ${inv.number} (still owing $${dollars(inv.balance)}) - change the lines to what is taken back`] }); }
        if ((x = one("[data-print]"))) { e.stopPropagation(); return printDoc(x.dataset.print, false); }
        if (t.id === "acDesign") return designLayout();
        if ((x = one("[data-q2i]"))) { e.stopPropagation(); const q = B.docs.find((y) => y.id === x.dataset.q2i); if (await yes(`Make quote ${q.number} (${q.party}, $${dollars(q.total)}) an invoice dated today?`, "Make invoice")) { const inv = await api("/api/accounts/quote/" + q.id + "/invoice", { date: todayStr() }); await refresh(); msg(`✔ quote ${q.number} is invoice ${inv.number} - 🖨 to print it`); } return; }
        if ((x = one("[data-pay]"))) { e.stopPropagation(); return payForm(B.docs.find((d) => d.id === x.dataset.pay)); }
        if ((x = one("[data-del]"))) { e.stopPropagation(); const d = B.docs.find((y) => y.id === x.dataset.del); if (await yes(`Delete ${d.number || "the document"} ${d.party} ($${dollars(d.total)}) and its payments?`, "Delete")) { await api("/api/accounts/doc/" + d.id + "?biz=" + encodeURIComponent(S.biz), null, "DELETE"); await refresh(); } return; }
        if ((x = one("[data-delpay]"))) { if (await yes("Delete this payment?", "Delete")) { await api("/api/accounts/payment/" + x.dataset.delpay + "?biz=" + encodeURIComponent(S.biz), null, "DELETE"); await refresh(); } return; }
        if ((x = one("[data-deljnl]"))) { if (await yes("Delete this journal entry?", "Delete")) { await api("/api/accounts/journal/" + x.dataset.deljnl + "?biz=" + encodeURIComponent(S.biz), null, "DELETE"); await refresh(); } return; }
        if ((x = one("[data-deljob]"))) { if (await yes(`Delete the job ${x.dataset.deljob}?`, "Delete")) { await api("/api/accounts/job/" + encodeURIComponent(x.dataset.deljob) + "?biz=" + encodeURIComponent(S.biz), null, "DELETE"); await refresh(); } return; }
        if ((x = one("[data-jobtoggle]"))) { const j = B.jobs.find((y) => y.code === x.dataset.jobtoggle); await api("/api/accounts/job", { job: Object.assign({}, j, { status: j.status === "open" ? "closed" : "open" }) }); return refresh(); }
        if ((x = one("[data-delacc]"))) { e.stopPropagation(); if (await yes(`Delete the account ${x.dataset.delacc}?`, "Delete")) { await api("/api/accounts/account/" + x.dataset.delacc + "?biz=" + encodeURIComponent(S.biz), null, "DELETE"); await refresh(); } return; }
        if (t.id === "acJobAdd") { await api("/api/accounts/job", { job: { code: $("acJobCode").value, name: $("acJobName").value, client: $("acJobClient").value } }); msg("✔ job added"); return refresh(); }
        if (t.id === "acAccAdd") { await api("/api/accounts/account", { account: { code: $("acAccCode").value, name: $("acAccName").value, type: $("acAccType").value, tax: $("acAccTax").value, bank: $("acAccBank").checked } }); msg("✔ account kept"); return refresh(); }
        if ((x = one("tr[data-ledger]"))) { S.account = x.dataset.ledger; return show("ledger"); }
        if ((x = one("tr[data-doc]"))) { const d = B.docs.find((y) => y.id === x.dataset.doc); if (d) docForm(d.kind, d); }
      } catch (er) { msg("✗ " + er.message, true); }
    });
    const look = () => { if (!d.classList.contains("dockgone") && !S.books) show(); };
    if (root.MutationObserver) new root.MutationObserver(look).observe(d, { attributes: true, attributeFilter: ["class"] });
    setTimeout(look, 500);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  root.H3Accounts = Object.assign({ show, refresh, docForm, payForm, journalForm, printDoc, designLayout, readReceipt, asPicture, emailDoc, state: () => S }, pure);
})(typeof window !== "undefined" ? window : globalThis);
