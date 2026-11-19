/* ext/acctdock/acctbank.js — 2.882.0: 🏦 the Bank tab of 📒 Accounts (window.H3AcctBank, used by acctdock.js through ctx()).
 * A bank / card statement (CSV from any Australian bank, OFX / QFX, QIF - a file or pasted) read into the books' bank lines
 * (lib/bankStatement.js + lib/bankRec.js), each line matched to what the books have (✓), made from the line (✚ a payment on an
 * open invoice / bill, a spend, a sale, a transfer), ignored (⊘) or unmatched (↶); then ⚖ checked against the statement's closing
 * balance and ✔ reconciled. Tim (verbatim): "yes, please add the next steps" (... bank statement import + reconcile ...) */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const B = { filter: "open", lastRead: null, check: null };
  const enc = encodeURIComponent;
  const readText = (f) => new Promise((ok, no) => { const fr = new root.FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = () => no(new Error("the file could not be read")); fr.readAsText(f); });

  function account(c) {
    const S = c.S, banks = (S.books.accounts || []).filter((a) => a.bank);
    if (!banks.some((a) => a.code === S.bankAcc)) S.bankAcc = c.store.get("bankAcc", "") || (banks[0] && banks[0].code) || "1100";
    if (!banks.some((a) => a.code === S.bankAcc) && banks[0]) S.bankAcc = banks[0].code;
    return S.bankAcc;
  }
  const money = (c, cents) => (cents ? c.N(cents) : "");
  function stateCell(c, l) {
    const esc = c.esc;
    if (l.state === "ignored") return `<i>ignored</i> <button type="button" data-bunign="${esc(l.id)}" title="Take it back">↺</button>`;
    if (l.state === "matched" || l.state === "reconciled") {
      const it = l.item || {}, what = `${it.party || it.memo || it.type || ""}${it.ref ? " · " + it.ref : ""}`;
      return `<span class="acstamp ${l.state === "reconciled" ? "paid" : "due"}">${l.state === "reconciled" ? "✔ reconciled" : l.auto ? "✓ matched by bitGen" : "✓ matched"}</span> <span class="bank-what">${esc(what)}</span>`
        + (l.state === "matched" ? ` <button type="button" data-bun="${esc(l.id)}" title="Unmatch - the entry stays in the books">↶</button>` : "");
    }
    const sug = (l.suggest || []).map((s) => {
      const lbl = esc(s.label) + (s.how === "match" && s.date !== l.date ? ` <i>${esc(s.date)}</i>` : "");
      if (s.how === "match") return `<button type="button" class="ghost bank-sug" data-bmatch="${esc(l.id)}" data-key="${esc(s.key)}" title="Match to this entry in the books">✓ ${lbl}</button>`;
      if (s.how === "payment") return `<button type="button" class="ghost bank-sug" data-bpay="${esc(l.id)}" data-doc="${esc(s.doc)}" title="Record the payment on it and match">✚ ${lbl}</button>`;
      return `<button type="button" class="ghost bank-sug" data-bmake="${esc(l.id)}" data-pre="${esc(JSON.stringify({ as: s.how, account: s.account, tax: s.tax, party: s.party }))}" title="Make it the same way as before">✚ ${lbl}</button>`;
    }).join(" ");
    return `${sug} <button type="button" data-bmake="${esc(l.id)}" title="Make what is missing in the books from this line">✚ Make…</button>`
      + `<button type="button" data-bign="${esc(l.id)}" title="Ignore - not for these books">⊘</button><button type="button" data-bdel="${esc(l.id)}" title="Delete the line">🗑</button>`;
  }
  async function view(c) {
    const S = c.S, esc = c.esc;
    if (!S.books) await c.loadBooks();
    const acc = account(c), V = await c.api("/api/accounts/bank?" + c.qs({ biz: S.biz, account: acc }));
    B.view = V;
    const F = { open: (l) => l.state === "unmatched", all: () => true, matched: (l) => l.state === "matched" || l.state === "reconciled", ignored: (l) => l.state === "ignored" };
    const rows = V.lines.filter(F[B.filter] || F.all);
    const last = V.last ? `last reconciled ${V.last.date} at $${c.dollars(V.last.balance)}` : "not reconciled yet";
    const closing = c.store.get("bankClose." + acc, "");
    let cl = {}; try { cl = JSON.parse(closing || "{}"); } catch (e) { cl = {}; }
    const recDate = cl.date || (V.lines[0] && V.lines[0].date) || c.todayStr(), recBal = cl.balance != null ? (cl.balance / 100).toFixed(2) : "";
    const fbtn = (k, t, n) => `<button type="button" class="ghost${B.filter === k ? " on" : ""}" data-bfilter="${k}">${esc(t)}${n != null ? " (" + n + ")" : ""}</button>`;
    return c.head("Bank - statements matched to the books", `${V.name} (${V.account}) · ${V.counts.lines} statement line(s) · ${last}`)
      + `<div class="acrow"><span>Account</span><select id="acBankAcc">${V.banks.map((b) => `<option value="${esc(b.code)}"${b.code === acc ? " selected" : ""}>${esc(b.code + " " + b.name)}${b.lines ? " · " + b.lines : ""}</option>`).join("")}</select>`
      + `<button type="button" class="ghost" id="acBankImp" title="A statement from your bank's internet banking: CSV, OFX / QFX or QIF">⤒ Import a statement…</button>`
      + `<button type="button" class="ghost" id="acBankPaste" title="Paste the lines from a statement (CSV)">📋 Paste…</button>`
      + `<label title="Australian banks write dates day first (05/07/2026 = 5 July)"><input type="checkbox" id="acBankDmy"${c.store.get("bankDmy", "1") === "1" ? " checked" : ""}> dates day first</label>`
      + `<input type="file" id="acBankFile" accept=".csv,.tsv,.txt,.ofx,.qfx,.qif" style="display:none"></div>`
      + `<div class="acrow bank-filters">${fbtn("open", "To match", V.counts.unmatched)}${fbtn("matched", "Matched", V.counts.matched + V.counts.reconciled)}${fbtn("ignored", "Ignored", V.counts.ignored)}${fbtn("all", "All", V.counts.lines)}</div>`
      + (rows.length ? `<table class="actab bank-tab"><tr><th>Date</th><th>On the statement</th><th class="n">Money in</th><th class="n">Money out</th><th>In the books</th></tr>`
        + rows.map((l) => `<tr data-bline="${esc(l.id)}" class="bank-${l.state}"><td>${esc(l.date)}</td><td>${esc(l.desc)}${l.ref ? ` <i>${esc(l.ref)}</i>` : ""}</td><td class="n">${l.amount > 0 ? money(c, l.amount) : ""}</td><td class="n">${l.amount < 0 ? money(c, -l.amount) : ""}</td><td class="act bank-act">${stateCell(c, l)}</td></tr>`).join("")
        + `</table>` : `<div class="acnote">${V.counts.lines ? "Nothing here." : "No statement yet - ⤒ import one from your internet banking (CSV, OFX / QFX or QIF). Lines already in the books are matched by themselves."}</div>`)
      + (V.unpresented.length ? `<h4 class="bank-h4">In the books, not on a statement yet (${V.unpresented.length})</h4><table class="actab"><tr><th>Date</th><th>Entry</th><th class="n">In</th><th class="n">Out</th></tr>`
        + V.unpresented.map((i) => `<tr><td>${esc(i.date)}</td><td>${esc(i.party || i.memo)}${i.ref ? " · " + esc(i.ref) : ""}</td><td class="n">${i.amount > 0 ? money(c, i.amount) : ""}</td><td class="n">${i.amount < 0 ? money(c, -i.amount) : ""}</td></tr>`).join("") + `</table>` : "")
      + `<h4 class="bank-h4">⚖ Reconcile</h4><div class="acrow"><span>Statement date</span><input type="date" id="acBankRecDate" value="${esc(recDate)}"><span>closing balance $</span>`
      + `<input id="acBankRecBal" class="n" style="width:100px" value="${esc(recBal)}" placeholder="0.00" title="${V.type === "liability" ? "What the statement says is owing" : "What the statement says is in the account"}">`
      + `<button type="button" class="ghost" id="acBankChk">⚖ Check</button><button type="button" class="ghost" id="acBankRec" disabled title="When it agrees to the cent">✔ Reconcile</button>`
      + (V.last ? `<button type="button" class="ghost" id="acBankUnrec" title="Undo the last reconciliation (${esc(V.last.date)})">↶ Undo last</button>` : "") + `</div><div id="acBankRecOut"></div>`
      + `<div class="acnote">Money in the books is matched to the statement line that shows it; ✚ makes what the books do not have yet (a payment on an open invoice or bill, a spend with its GST, a sale, a transfer). The words of a line remember where it went, so the next one like it is suggested.</div>`;
  }
  function recOut(c, r) {
    const esc = c.esc, f = r.type === "liability" ? -1 : 1, row = (t, v, strong) => `<tr${strong ? ' class="tot"' : ""}><td>${esc(t)}</td><td class="n">${c.N(v)}</td></tr>`;
    return `<table class="actab bank-rec"><tr><th>Bank reconciliation at ${esc(r.date)}</th><th class="n">$</th></tr>`
      + row("Balance in the books", r.books)
      + (r.unpresented.length ? row(`Less: in the books, not on the statement (${r.unpresented.length})`, -f * r.unpresented.reduce((s, i) => s + i.amount, 0)) : "")
      + (r.unrecorded.length ? row(`Add: on the statement, not in the books yet (${r.unrecorded.length})`, f * r.unrecorded.reduce((s, l) => s + l.amount, 0)) : "")
      + row("= What the statement should say", r.adjusted, true) + row("The statement says", r.statement) + `<tr class="tot gtot"><td>${r.difference ? "Out by" : "Difference"}</td><td class="n">${c.N(r.difference)}</td></tr></table>`
      + `<div class="acnote">${r.ok ? "✔ It agrees to the cent - ✔ Reconcile marks the lines to this date reconciled." : r.unrecorded.length ? "Match, make or ignore the lines still to match first." : "It does not agree yet - look for a line typed wrongly, one missing or one matched to the wrong entry."}</div>`;
  }
  function makeForm(c, l, pre) {
    const S = c.S, esc = c.esc, inn = l.amount > 0, amt = Math.abs(l.amount), p = pre || {};
    const open = S.books.docs.filter((d) => (inn ? d.kind === "invoice" : d.kind === "bill" || (d.kind === "credit" && !d.forInvoice)) && d.balance > 0 && d.date <= l.date);
    const kinds = [["payment", inn ? "Payment received on an invoice we sent" : "Payment of a bill (or a credit note refunded)"], [inn ? "sale" : "spend", inn ? "A sale with no invoice (GST worked out)" : "A spend with no bill (a receipt - GST worked out)"], ["journal", "A transfer, loan, owner's money or other (no GST)"]];
    const as0 = p.as || (open.length ? "payment" : inn ? "sale" : "spend");
    const lineAcc = (a) => (inn ? a.type === "income" : ["expense", "cos", "asset"].includes(a.type) && !a.system && !a.bank);
    const html = `<div class="acnote">${esc(l.date)} · ${esc(l.desc)} · <b>${inn ? "money in" : "money out"} $${c.dollars(amt)}</b></div>`
      + `<div class="acrow"><span>What it is</span><select id="acbAs">${kinds.map(([k, t]) => `<option value="${k}"${k === as0 ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`
      + `<div class="acrow" data-for="payment"><span>${inn ? "Invoice" : "Bill / credit note"}</span><select id="acbDoc">${open.length ? open.map((d) => `<option value="${esc(d.id)}">${esc((d.number || "") + " · " + d.party + " · owing $" + c.dollars(d.balance))}</option>`).join("") : `<option value="">— none open —</option>`}</select></div>`
      + `<div class="acrow" data-for="sale spend"><span>${inn ? "From" : "Paid to"}</span><input id="acbParty" value="${esc(p.party || l.desc.split(" · ")[0])}" style="width:220px"></div>`
      + `<div class="acrow" data-for="sale spend journal"><span>Words</span><input id="acbDesc" value="${esc(l.desc)}" style="width:260px"></div>`
      + `<div class="acrow" data-for="sale spend"><span>Account</span><select id="acbAcc">${c.accOpts(lineAcc, p.as !== "journal" ? p.account : "")}</select><span>Tax</span><select id="acbTax">${Object.entries(S.books.tax).map(([k, t]) => `<option value="${k}"${k === p.tax ? " selected" : ""}>${esc(t)}</option>`).join("")}</select><span>Job</span><select id="acbJob">${c.jobOpts("")}</select></div>`
      + `<div class="acrow" data-for="journal"><span>${inn ? "Came from" : "Went to"}</span><select id="acbOther">${c.accOpts((a) => a.code !== l.account && !a.system, p.as === "journal" ? p.account : inn ? "3100" : "3200")}</select></div>`;
    c.dialog("✚ Make it in the books", html, async () => {
      const as = $("acbAs").value, how = { as };
      if (as === "payment") { how.doc = $("acbDoc").value; if (!how.doc) throw new Error(`no open ${inn ? "invoice" : "bill"} - pick another kind`); }
      else if (as === "journal") Object.assign(how, { account: $("acbOther").value, desc: $("acbDesc").value });
      else Object.assign(how, { account: $("acbAcc").value, tax: $("acbTax").value, party: $("acbParty").value, desc: $("acbDesc").value, job: $("acbJob").value });
      await c.api("/api/accounts/bank/line/" + enc(l.id) + "/create", { how });
      c.msg("✔ made in the books and matched");
    }, (b) => {
      const show = () => { const as = $("acbAs").value; b.querySelectorAll("[data-for]").forEach((r) => { r.style.display = r.dataset.for.split(" ").includes(as) ? "" : "none"; }); };
      const tax = () => { const a = c.S.books.accounts.find((x) => x.code === $("acbAcc").value); if (a && !$("acbTax").dataset.touched && !p.tax) $("acbTax").value = inn && a.tax === "CAP" ? "GST" : a.tax; };
      $("acbAs").addEventListener("change", show); $("acbAcc").addEventListener("change", tax); $("acbTax").addEventListener("change", () => { $("acbTax").dataset.touched = "1"; });
      show(); tax();
    });
  }
  async function importText(c, text, name, map) {
    const S = c.S, acc = account(c);
    try {
      const r = await c.api("/api/accounts/bank/import", { account: acc, text, name, dayFirst: $("acBankDmy") ? $("acBankDmy").checked : true, map });
      if (r.closing) c.store.set("bankClose." + acc, JSON.stringify(r.closing));
      B.filter = "open"; await c.show();
      c.msg(`✔ ${r.format.toUpperCase()}: ${r.read} line(s) read · ${r.added} added${r.dupes ? ` · ${r.dupes} already there` : ""}${r.auto ? ` · ${r.auto} matched by themselves` : ""}${r.warnings.length ? ` · ${r.warnings.length} left out (${r.warnings[0]})` : ""}`);
    } catch (e) {
      if (!/pick them/.test(e.message)) throw e;
      columnsForm(c, text, name);
    }
  }
  function columnsForm(c, text, name) {
    const esc = c.esc, first = String(text).split(/\r?\n/).filter((x) => x.trim()).slice(0, 4);
    const n = Math.max(...first.map((x) => x.split(/,|\t|;/).length));
    const opts = (sel) => `<option value="">—</option>` + Array.from({ length: n }, (_, i) => `<option value="${i}"${i === sel ? " selected" : ""}>column ${i + 1}</option>`).join("");
    c.dialog("Which column is which?", `<div class="acnote">The columns were not found by themselves. The first lines:</div><pre class="bank-pre">${esc(first.join("\n"))}</pre>`
      + `<div class="acrow"><span>Date</span><select id="acbcD">${opts(0)}</select><span>Amount</span><select id="acbcA">${opts(1)}</select><span>or Money out</span><select id="acbcO">${opts(null)}</select><span>Money in</span><select id="acbcI">${opts(null)}</select><span>Words</span><select id="acbcW">${opts(2)}</select></div>`,
    async () => {
      const v = (id) => ($(id).value === "" ? undefined : +$(id).value), map = { date: v("acbcD"), amount: v("acbcA"), debit: v("acbcO"), credit: v("acbcI"), desc: v("acbcW") };
      if (map.debit != null || map.credit != null) delete map.amount;
      await importText(c, text, name, map);
    });
  }
  async function click(e, c) {
    const t = e.target, one = (sel) => t.closest(sel), lineId = (x, k) => x.dataset[k];
    let x;
    const L = (id) => (B.view.lines || []).find((l) => l.id === id);
    const post = async (u, body) => { await c.api(u, body || {}); await c.refresh(); };
    if ((x = one("[data-bfilter]"))) { B.filter = x.dataset.bfilter; await c.show(); return true; }
    if (t.id === "acBankImp") { $("acBankFile").value = ""; $("acBankFile").click(); return true; }
    if (t.id === "acBankPaste") {
      c.dialog("📋 Paste a statement", `<div class="acnote">Paste the lines (CSV: date, amount, description …) - a header row is fine.</div><textarea id="acbPaste" rows="10" style="width:100%;font:12px monospace"></textarea>`,
        async () => { const v = $("acbPaste").value; if (!v.trim()) throw new Error("paste the statement's lines"); await importText(c, v, "pasted.csv"); });
      return true;
    }
    if ((x = one("[data-bmatch]"))) { await post("/api/accounts/bank/line/" + enc(lineId(x, "bmatch")) + "/match", { key: x.dataset.key }); c.msg("✔ matched"); return true; }
    if ((x = one("[data-bpay]"))) { await post("/api/accounts/bank/line/" + enc(lineId(x, "bpay")) + "/create", { how: { as: "payment", doc: x.dataset.doc } }); c.msg("✔ the payment recorded and matched"); return true; }
    if ((x = one("[data-bmake]"))) { await c.loadBooks(); let pre = null; try { pre = x.dataset.pre ? JSON.parse(x.dataset.pre) : null; } catch (er) { pre = null; } makeForm(c, L(x.dataset.bmake), pre); return true; }
    if ((x = one("[data-bun]"))) { await post("/api/accounts/bank/line/" + enc(x.dataset.bun) + "/unmatch"); c.msg("↶ unmatched - the entry stays in the books"); return true; }
    if ((x = one("[data-bign]"))) { await post("/api/accounts/bank/line/" + enc(x.dataset.bign) + "/ignore", { on: true }); return true; }
    if ((x = one("[data-bunign]"))) { await post("/api/accounts/bank/line/" + enc(x.dataset.bunign) + "/ignore", { on: false }); return true; }
    if ((x = one("[data-bdel]"))) { const l = L(x.dataset.bdel); if (await c.yes(`Delete the statement line ${l.date} ${l.desc} ($${c.dollars(Math.abs(l.amount))})? The books are not changed.`, "Delete")) { await c.api("/api/accounts/bank/line/" + enc(l.id) + "?biz=" + enc(c.S.biz), null, "DELETE"); await c.show(); } return true; }
    if (t.id === "acBankChk" || t.id === "acBankRec") {
      const date = $("acBankRecDate").value, balance = $("acBankRecBal").value, acc = account(c);
      if (!balance.trim()) { c.msg("✗ type the statement's closing balance", true); return true; }
      c.store.set("bankClose." + acc, JSON.stringify({ date, balance: Math.round(parseFloat(balance.replace(/[$,]/g, "")) * 100) }));
      if (t.id === "acBankRec") {
        const r = await c.api("/api/accounts/bank/reconcile", { account: acc, date, balance });
        await c.show(); c.msg(`✔ reconciled to ${date} - ${r.rec.lines} line(s)`); return true;
      }
      const r = await c.api("/api/accounts/bank/check?" + c.qs({ biz: c.S.biz, account: acc, date, balance }));
      $("acBankRecOut").innerHTML = recOut(c, r); $("acBankRec").disabled = !r.ok; return true;
    }
    if (t.id === "acBankUnrec") { if (await c.yes("Undo the last reconciliation? Its lines can be changed again.", "Undo")) { const r = await c.api("/api/accounts/bank/unreconcile", { account: account(c) }); await c.show(); c.msg(`↶ the reconciliation of ${r.date} undone`); } return true; }
    return false;
  }
  function change(e, c) {
    const t = e.target;
    if (t.id === "acBankAcc") { c.S.bankAcc = t.value; c.store.set("bankAcc", t.value); c.show(); return true; }
    if (t.id === "acBankDmy") { c.store.set("bankDmy", t.checked ? "1" : "0"); return true; }
    if (t.id === "acBankFile") {
      const f = t.files[0]; if (!f) return true;
      if (f.size > 20 * 1024 * 1024) { c.msg("✗ the file is over 20 MB", true); return true; }
      readText(f).then((txt) => importText(c, txt, f.name)).catch((er) => c.msg("✗ " + er.message, true));
      return true;
    }
    return false;
  }
  root.H3AcctBank = { view, click, change, makeForm, recOut };
})(typeof window !== "undefined" ? window : globalThis);
