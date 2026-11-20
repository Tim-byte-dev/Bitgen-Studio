/* ext/acctdock/acctbank.js — 2.882.0: 🏦 the Bank tab of 📒 Accounts (window.H3AcctBank, used by acctdock.js through ctx()).
 * A bank / card statement (CSV from any Australian bank, OFX / QFX, QIF - a file or pasted) read into the books' bank lines
 * (lib/bankStatement.js + lib/bankRec.js), each line matched to what the books have (✓), made from the line (✚ a payment on an
 * open invoice / bill, a spend, a sale, a transfer), ignored (⊘) or unmatched (↶); then ⚖ checked against the statement's closing
 * balance and ✔ reconciled. Tim (verbatim): "yes, please add the next steps" (... bank statement import + reconcile ...)
 * 2.892.0: ✚ Split (one line over several accounts), ✚ Transfer to / from another of your accounts (matched on both statements -
 * a ↔ suggestion when the other statement has the line already) and ⚙ Rules… (the remembered words -> account, changed / deleted).
 * Tim (verbatim): "continue next" (parked: "🏦 Bank extras - split one statement line over several accounts; a transfer between two
 * of your own accounts matched on both statements at once; a small editor for the remembered rules") */
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
        + (l.twin ? ` <span class="bank-twin" title="The same transfer is matched on the other account's statement">↔ ${esc(l.twin.account)} ${esc(l.twin.date)}</span>` : "")
        + (l.state === "matched" ? ` <button type="button" data-bun="${esc(l.id)}" title="Unmatch - the entry stays in the books">↶</button>` : "");
    }
    const sug = (l.suggest || []).map((s) => {
      const lbl = esc(s.label) + (s.how === "match" && s.date !== l.date ? ` <i>${esc(s.date)}</i>` : "");
      if (s.how === "match") return `<button type="button" class="ghost bank-sug" data-bmatch="${esc(l.id)}" data-key="${esc(s.key)}" title="Match to this entry in the books">✓ ${lbl}</button>`;
      if (s.how === "transfer") return `<button type="button" class="ghost bank-sug" data-bxfer="${esc(l.id)}" data-acc="${esc(s.account)}" data-line="${esc(s.line)}" title="Make the transfer once and match it on both statements">↔ ${lbl}</button>`;
      if (s.how === "payment") return `<button type="button" class="ghost bank-sug" data-bpay="${esc(l.id)}" data-doc="${esc(s.doc)}" title="Record the payment on it and match">✚ ${lbl}</button>`;
      return `<button type="button" class="ghost bank-sug" data-bmake="${esc(l.id)}" data-pre="${esc(JSON.stringify({ as: s.how, account: s.account, tax: s.tax, party: s.party, parts: s.parts, journal: s.journal }))}" title="Make it the same way as before">✚ ${lbl}</button>`;
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
      + `<button type="button" class="ghost" id="acBankRules" title="The words of a line → where it went: what bitGen suggests for the next line like it">⚙ Rules${V.rules ? " (" + V.rules + ")" : ""}…</button>`
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
      + `<div class="acnote">Money in the books is matched to the statement line that shows it; ✚ makes what the books do not have yet (a payment on an open invoice or bill, a spend with its GST, a sale, a split over several accounts, a transfer - matched on both statements when it is between two of your accounts). The words of a line remember where it went, so the next one like it is suggested.</div>`;
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
    const banks = S.books.accounts.filter((a) => a.bank && a.code !== l.account);
    const kinds = [["payment", inn ? "Payment received on an invoice we sent" : "Payment of a bill (or a credit note refunded)"], [inn ? "sale" : "spend", inn ? "A sale with no invoice (GST worked out)" : "A spend with no bill (a receipt - GST worked out)"],
      ["split", "Split over several accounts"], ["transfer", `A transfer ${inn ? "from" : "to"} another of my accounts (matched on both statements)`], ["journal", "A loan, owner's money or other (no GST)"]];
    const as0 = p.as === "journal" && banks.some((a) => a.code === p.account) ? "transfer" : p.as || (open.length ? "payment" : inn ? "sale" : "spend");
    const lineAcc = (a) => (inn ? a.type === "income" : ["expense", "cos", "asset"].includes(a.type) && !a.system && !a.bank);
    const html = `<div class="acnote">${esc(l.date)} · ${esc(l.desc)} · <b>${inn ? "money in" : "money out"} $${c.dollars(amt)}</b></div>`
      + `<div class="acrow"><span>What it is</span><select id="acbAs">${kinds.map(([k, t]) => `<option value="${k}"${k === as0 ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`
      + `<div class="acrow" data-for="payment"><span>${inn ? "Invoice" : "Bill / credit note"}</span><select id="acbDoc">${open.length ? open.map((d) => `<option value="${esc(d.id)}">${esc((d.number || "") + " · " + d.party + " · owing $" + c.dollars(d.balance))}</option>`).join("") : `<option value="">— none open —</option>`}</select></div>`
      + `<div class="acrow" data-for="sale spend split"><span>${inn ? "From" : "Paid to"}</span><input id="acbParty" value="${esc(p.party || l.desc.split(" · ")[0])}" style="width:220px"></div>`
      + `<div class="acrow" data-for="sale spend journal split"><span>Words</span><input id="acbDesc" value="${esc(l.desc)}" style="width:260px"></div>`
      + `<div class="acrow" data-for="sale spend"><span>Account</span><select id="acbAcc">${c.accOpts(lineAcc, p.as !== "journal" ? p.account : "")}</select><span>Tax</span><select id="acbTax">${Object.entries(S.books.tax).map(([k, t]) => `<option value="${k}"${k === p.tax ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`
      + `<div class="acrow" data-for="sale spend split"><span>Job</span><select id="acbJob">${c.jobOpts("")}</select></div>`
      + `<div data-for="split">${partsTable(c, l.account, p.as === "split" && p.parts && p.parts.length ? p.parts.map((x) => Object.assign({}, x, { amount: (x.amount / 100).toFixed(2) })) : [{ amount: (amt / 100).toFixed(2) }, {}], "amount")}`
      + `<div class="acrow"><span id="acbLeft" class="bank-left"></span><button type="button" class="ghost" data-partadd>+ a part</button>`
      + `<label title="For a loan's principal + interest, owner's money and the like - a journal, no GST"><input type="checkbox" id="acbJnl"${p.journal ? " checked" : ""}> as a journal (no GST)</label></div></div>`
      + `<div class="acrow" data-for="transfer"><span>${inn ? "From" : "To"} my</span><select id="acbBank">${banks.length ? banks.map((a) => `<option value="${esc(a.code)}"${a.code === p.account ? " selected" : ""}>${esc(a.code + " " + a.name)}</option>`).join("") : `<option value="">— no other bank, card or cash account —</option>`}</select></div>`
      + `<div class="acrow" data-for="journal"><span>${inn ? "Came from" : "Went to"}</span><select id="acbOther">${c.accOpts((a) => a.code !== l.account && !a.system, p.as === "journal" ? p.account : inn ? "3100" : "3200")}</select></div>`;
    c.dialog("✚ Make it in the books", html, async () => {
      const as = $("acbAs").value, how = { as };
      if (as === "payment") { how.doc = $("acbDoc").value; if (!how.doc) throw new Error(`no open ${inn ? "invoice" : "bill"} - pick another kind`); }
      else if (as === "journal") Object.assign(how, { account: $("acbOther").value, desc: $("acbDesc").value });
      else if (as === "transfer") { how.account = $("acbBank").value; if (!how.account) throw new Error("add your other account under Accounts first (tick 🏦 bank)"); }
      else if (as === "split") Object.assign(how, { parts: readParts($("acbParts")), journal: $("acbJnl").checked, party: $("acbParty").value, desc: $("acbDesc").value, job: $("acbJob").value });
      else Object.assign(how, { account: $("acbAcc").value, tax: $("acbTax").value, party: $("acbParty").value, desc: $("acbDesc").value, job: $("acbJob").value });
      const r = await c.api("/api/accounts/bank/line/" + enc(l.id) + "/create", { how });
      c.msg(as === "transfer" ? (r.twin ? `✔ the transfer made and matched on both statements (${r.twin.account} ${r.twin.date})` : "✔ the transfer made and matched - it is matched on the other statement when that comes in") : "✔ made in the books and matched");
    }, (b) => {
      const show = () => { const as = $("acbAs").value; b.querySelectorAll("[data-for]").forEach((r) => { r.style.display = r.dataset.for.split(" ").includes(as) ? "" : "none"; }); };
      const tax = () => { const a = c.S.books.accounts.find((x) => x.code === $("acbAcc").value); if (a && !$("acbTax").dataset.touched && !p.tax) $("acbTax").value = inn && a.tax === "CAP" ? "GST" : a.tax; };
      $("acbAs").addEventListener("change", show); $("acbAcc").addEventListener("change", tax); $("acbTax").addEventListener("change", () => { $("acbTax").dataset.touched = "1"; });
      const left = () => { const n = sumParts($("acbParts")), d = amt - n; $("acbLeft").textContent = d ? `${d > 0 ? "left to split" : "over by"} $${c.dollars(Math.abs(d))}` : "✔ adds up"; $("acbLeft").classList.toggle("bad", !!d); };
      partsWire(c, b, $("acbParts"), "amount", left, inn);
      show(); tax(); left();
    });
  }
  /* ---------- 2.892.0: the parts of a split (an amount each, or a % in a rule) ---------- */
  function partRow(c, bank, x, unit) {
    const S = c.S, esc = c.esc, accs = S.books.accounts.filter((a) => !a.system && a.code !== bank);
    return `<tr class="acb-part"><td><select data-k="account"><option value="">— account —</option>${accs.map((a) => `<option value="${esc(a.code)}"${a.code === x.account ? " selected" : ""}>${esc(a.code + " " + a.name)}</option>`).join("")}</select></td>`
      + `<td><select data-k="tax"><option value="">(the account's)</option>${Object.entries(S.books.tax).map(([k, t]) => `<option value="${k}"${k === x.tax ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></td>`
      + `<td><input data-k="${unit}" class="n" style="width:80px" value="${esc(x[unit] == null ? "" : x[unit])}" placeholder="${unit === "pct" ? "%" : "0.00"}"></td>`
      + `<td><input data-k="desc" value="${esc(x.desc || "")}" placeholder="words (optional)" style="width:150px"></td><td><button type="button" data-partx title="Take the part out">✕</button></td></tr>`;
  }
  function partsTable(c, bank, parts, unit) {
    return `<table class="actab bank-parts" id="${unit === "pct" ? "acbRParts" : "acbParts"}" data-bank="${c.esc(bank || "")}" data-unit="${unit}"><tr><th>Account</th><th>Tax</th><th class="n">${unit === "pct" ? "%" : "$"}</th><th>Words</th><th></th></tr>`
      + parts.map((x) => partRow(c, bank, x, unit)).join("") + `</table>`;
  }
  const num = (v) => { const n = parseFloat(String(v || "").replace(/[$,%\s]/g, "")); return Number.isFinite(n) ? n : 0; };
  function readParts(tab) {
    const unit = tab.dataset.unit;
    return [...tab.querySelectorAll("tr.acb-part")].map((tr) => { const v = (k) => (tr.querySelector(`[data-k="${k}"]`) || {}).value || ""; return { account: v("account"), tax: v("tax"), [unit]: v(unit).replace(/[$,%\s]/g, ""), desc: v("desc") }; })
      .filter((x) => x.account || num(x[unit]));
  }
  const sumParts = (tab) => Math.round(readParts(tab).reduce((s, x) => s + num(x[tab.dataset.unit]) * (tab.dataset.unit === "pct" ? 1 : 100), 0));
  function partsWire(c, box, tab, unit, after, inn) {
    box.addEventListener("click", (e) => {
      const t = e.target;
      if (t.matches("[data-partadd]") && t.closest("div") && box.contains(tab)) { tab.insertAdjacentHTML("beforeend", partRow(c, tab.dataset.bank, {}, unit)); after(); }
      else if (t.matches("[data-partx]") && tab.contains(t)) { if (tab.querySelectorAll("tr.acb-part").length > 2) t.closest("tr").remove(); else t.closest("tr").querySelectorAll("input").forEach((i) => { i.value = ""; }); after(); }
    });
    tab.addEventListener("input", after);
    tab.addEventListener("change", (e) => {
      const t = e.target;
      if (t.dataset.k === "account") { const a = c.S.books.accounts.find((x) => x.code === t.value), tx = t.closest("tr").querySelector('[data-k="tax"]'); if (a && tx) tx.value = inn && a.tax === "CAP" ? "GST" : a.type === "income" || ["expense", "cos", "asset"].includes(a.type) ? a.tax : ""; }
      after();
    });
  }

  /* ---------- 2.892.0: ⚙ Rules… the remembered words -> account ---------- */
  async function rulesForm(c) {
    const esc = c.esc;
    if (!c.S.books) await c.loadBooks();
    const list = async () => (await c.api("/api/accounts/bank/rules?" + c.qs({ biz: c.S.biz }))).rules;
    const ruleWhat = (r) => r.as === "split" ? r.parts.map((p) => `${Math.round(p.share * 10000) / 100} % ${p.account}`).join(" + ") + (r.journal ? " (journal)" : "") : `${r.account} ${r.name}`;
    const table = (R) => (R.length ? `<table class="actab bank-rules"><tr><th>Words on the line</th><th>In / out</th><th>Makes</th><th>Account</th><th>Tax</th><th>Who</th><th class="n" title="Unmatched lines it suggests for now">Waiting</th><th></th></tr>`
      + R.map((r, i) => `<tr><td><b>${esc(r.key)}</b></td><td>${r.sign > 0 ? "money in" : "money out"}</td><td>${esc({ spend: "Spend", sale: "Sale", journal: "Transfer / other", split: "Split" }[r.as] || r.as)}</td><td>${esc(ruleWhat(r))}</td><td>${esc(r.tax || "")}</td><td>${esc(r.party || "")}</td><td class="n">${r.waiting || ""}</td>`
        + `<td class="act"><button type="button" data-redit="${i}" title="Change it">✎</button><button type="button" data-rdel="${i}" title="Delete it - the next line like it is not suggested">🗑</button></td></tr>`).join("") + `</table>`
      : `<div class="acnote">No rules yet - one is remembered each time ✚ makes a spend, a sale, a split or a transfer from a line.</div>`);
    let R = await list();
    const html = `<div class="acnote">When a statement line's first words match, bitGen suggests making it the same way again. Change what a rule makes, or delete one that keeps suggesting the wrong thing.</div>`
      + `<div id="acbRules">${table(R)}</div><div class="acrow"><button type="button" class="ghost" id="acbRNew">+ a rule</button></div><div id="acbREd"></div>`;
    c.dialog("⚙ Bank rules", html, async () => {}, (b) => {
      const repaint = async () => { R = await list(); $("acbRules").innerHTML = table(R); };
      const editor = (r0) => {
        const r = r0 || { key: "", sign: -1, as: "spend", account: "", tax: "", party: "" };
        const accSel = (sel) => `<select id="acbRAcc"><option value="">— account —</option>${c.S.books.accounts.filter((a) => !a.system).map((a) => `<option value="${esc(a.code)}"${a.code === sel ? " selected" : ""}>${esc(a.code + " " + a.name)}</option>`).join("")}</select>`;
        const parts = r.as === "split" ? r.parts.map((p) => Object.assign({}, p, { pct: String(Math.round(p.share * 10000) / 100) })) : [{}, {}];
        $("acbREd").innerHTML = `<h4 class="bank-h4">${r0 ? "Change the rule" : "A new rule"}</h4>`
          + `<div class="acrow"><span>Words</span><input id="acbRKey" value="${esc(r.key)}" placeholder="e.g. officeworks" style="width:160px"><select id="acbRSign"><option value="-1"${r.sign < 0 ? " selected" : ""}>money out</option><option value="1"${r.sign > 0 ? " selected" : ""}>money in</option></select>`
          + `<span>Makes</span><select id="acbRAs">${[["spend", "a spend"], ["sale", "a sale"], ["journal", "a transfer / other (no GST)"], ["split", "a split"]].map(([k, t]) => `<option value="${k}"${k === r.as ? " selected" : ""}>${t}</option>`).join("")}</select></div>`
          + `<div class="acrow" data-rfor="spend sale journal"><span>Account</span>${accSel(r.as === "split" ? "" : r.account)}<span data-rfor="spend sale">Tax</span><select id="acbRTax" data-rfor="spend sale"><option value="">(the account's)</option>${Object.entries(c.S.books.tax).map(([k, t]) => `<option value="${k}"${k === r.tax ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`
          + `<div class="acrow" data-rfor="spend sale split"><span>Who</span><input id="acbRParty" value="${esc(r.party || "")}" style="width:200px"></div>`
          + `<div data-rfor="split">${partsTable(c, "", parts, "pct")}<div class="acrow"><span id="acbRLeft" class="bank-left"></span><button type="button" class="ghost" data-partadd>+ a part</button><label><input type="checkbox" id="acbRJnl"${r.journal ? " checked" : ""}> as a journal (no GST)</label></div></div>`
          + `<div class="acrow"><button type="button" id="acbRSave">💾 Save the rule</button><button type="button" class="ghost" id="acbRCancel">Cancel</button></div>`;
        const ed = $("acbREd");
        const show = () => { const as = $("acbRAs").value; ed.querySelectorAll("[data-rfor]").forEach((x) => { x.style.display = x.dataset.rfor.split(" ").includes(as) ? "" : "none"; }); };
        const left = () => { const n = sumParts($("acbRParts")); $("acbRLeft").textContent = n === 100 ? "✔ 100 %" : `${n} % - make it 100 %`; $("acbRLeft").classList.toggle("bad", n !== 100); };
        $("acbRAs").addEventListener("change", show); show();
        partsWire(c, ed, $("acbRParts"), "pct", left, false); left();
        $("acbRCancel").addEventListener("click", () => { ed.innerHTML = ""; });
        $("acbRSave").addEventListener("click", async () => {
          const rule = { key: $("acbRKey").value, sign: +$("acbRSign").value, as: $("acbRAs").value, account: $("acbRAcc").value, tax: $("acbRTax").value, party: $("acbRParty").value,
            journal: $("acbRJnl").checked, parts: readParts($("acbRParts")) };
          try { await c.api("/api/accounts/bank/rules", { rule, was: r0 ? { key: r0.key, sign: r0.sign } : null }); ed.innerHTML = ""; $("acDlgE").textContent = ""; await repaint(); c.msg("✔ the rule saved"); }
          catch (e) { $("acDlgE").textContent = e.message; }
        });
      };
      b.addEventListener("click", async (e) => {
        const t = e.target;
        if (t.id === "acbRNew") editor(null);
        else if (t.dataset.redit != null) editor(R[+t.dataset.redit]);
        else if (t.dataset.rdel != null) {
          const r = R[+t.dataset.rdel];
          if (!t.dataset.sure) { t.dataset.sure = "1"; t.textContent = "Delete?"; return; }
          try { await c.api("/api/accounts/bank/rules/delete", { key: r.key, sign: r.sign }); await repaint(); c.msg(`🗑 the rule for "${r.key}" deleted`); } catch (er) { $("acDlgE").textContent = er.message; }
        }
      });
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
    if ((x = one("[data-bxfer]"))) {
      const r = await c.api("/api/accounts/bank/line/" + enc(x.dataset.bxfer) + "/create", { how: { as: "transfer", account: x.dataset.acc, line: x.dataset.line } }); await c.refresh();
      c.msg(r.twin ? `✔ the transfer made and matched on both statements (${r.twin.account} ${r.twin.date})` : "✔ the transfer made and matched"); return true;
    }
    if (t.id === "acBankRules") { await rulesForm(c); return true; }
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
  root.H3AcctBank = { view, click, change, makeForm, recOut, rulesForm, readParts };
})(typeof window !== "undefined" ? window : globalThis);
