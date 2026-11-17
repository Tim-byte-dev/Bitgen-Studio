/* bitGen Studio — ▦ Spreadsheet 📌 CONSTANTS (2.826.0): amounts that repeat, each with its rates over time, entered in a ledger.
 * Tim: "add a button for constants in spreadsheet, this will show a dialog - type - price - duration, start date eg rent - 540 -
 * week 13/01/2026 - show a list of the constants and use the newest date, so if rent was 540/wk for 1 year then changed to
 * 580/wk it will remember all the transactions for the year and enter the new amount from the next start date etc." +
 * "if we say received it's income if we say paid or payment it is an expense".
 *
 *   W.constants = [{id, name, kind: income|expense, desc, end?, rates: [{amount, every, start: "YYYY-MM-DD"}]}] (in the .bgs)
 *   W.ledger = {sheet} - the sheet the entries go in; its columns are found by their headings each time (findLedger):
 *     Date + Income / Expense (or Amount + Type), Description, Category, Balance, Ref (made when missing)
 *   occurrences(k, to)  every due date from each rate's start (day / week / fortnight / month - the start's day, the month's
 *                       last day when shorter / quarter / year) up to the next rate's start, the end, or `to`, at that rate
 *   plan(...)           the entries to add, the ones whose amount changed (a rate added back in time - corrected when ticked),
 *                       the ones no constant makes any more (removed only when ticked). Each entry's Ref = "📌 Rent · 2026-01-13".
 *   ⟳ Bring up to date  shows the plan first; Apply = one undo step; new rows go in date order, their looks + the Balance
 *                       formula copied from the row next to them.
 * Formulas read them: =Rent (today's amount), =CONST("Rent", A5) (on a date) - ext/sheetdock/sheetcalc.js constAmount.
 * 2.827.0 (Tim: "can we have it say rent paid to this date, rent days is calculated by weekly/7"): PAID TO - what has been paid
 *   for a constant (its entries in the ledger: Category = its name, else its Ref) covers day by day from its first start at its
 *   amount per day (weekly / 7 - sheetcalc.js dayRate / paidTo); the list says "Paid to 24/01/2026 · 3 days behind · $231.43
 *   owing" (or ahead); the ledger's "Paid to" column (made for a new ledger; ticked = added to yours) gets, on every row of a
 *   constant, =PAIDTO("Rent", ABS(SUMIF(C$2:Cn, "Rent", E$2:En))) - the date paid to after that row, live.
 */
(function (root) {
  "use strict";
  const EVERY = ["day", "week", "fortnight", "month", "quarter", "year"];
  const EVERY_WORD = { day: "day", week: "week", fortnight: "fortnight", month: "month", quarter: "quarter", year: "year" };
  const DAY = 86400000;
  const serial = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY) + 25569 : null; };
  const isoOf = (s) => new Date((s - 25569) * DAY).toISOString().slice(0, 10);
  const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  /** the n-th due date (a serial) of a rate that starts on `start` */
  function nth(start, every, n) {
    const s = serial(start);
    if (every === "day") return s + n;
    if (every === "week") return s + 7 * n;
    if (every === "fortnight") return s + 14 * n;
    const months = n * (every === "quarter" ? 3 : every === "year" ? 12 : 1), d0 = new Date((s - 25569) * DAY);
    const t = d0.getUTCMonth() + months, y = d0.getUTCFullYear() + Math.floor(t / 12), m = ((t % 12) + 12) % 12;
    return Math.round(Date.UTC(y, m, Math.min(d0.getUTCDate(), daysIn(y, m))) / DAY) + 25569;
  }
  const sorted = (k) => (k.rates || []).filter((r) => serial(r.start) != null).slice().sort((a, b) => serial(a.start) - serial(b.start));
  /** every due date of a constant up to `to` (a serial): [{serial, iso, amount, rate}] */
  function occurrences(k, to) {
    const R = sorted(k), end = k.end ? serial(k.end) : Infinity, last = Math.min(to, end), out = [];
    R.forEach((r, i) => {
      const stop = i + 1 < R.length ? serial(R[i + 1].start) : Infinity;
      for (let n = 0; n < 20000; n++) { const s = nth(r.start, r.every, n); if (s >= stop || s > last) break; out.push({ serial: s, iso: isoOf(s), amount: +r.amount || 0, rate: i }); }
    });
    return out;
  }
  /** the rate in force now (or on a date) */
  function rateNow(k, day) { const d = day == null ? todaySerial() : day; let best = null; for (const r of sorted(k)) if (serial(r.start) <= d) best = r; return best; }
  function todaySerial() { const t = new Date(); return Math.round(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / DAY) + 25569; }
  const refOf = (name, iso) => `📌 ${name} · ${iso}`;
  const parseRef = (s) => { const m = /^📌 (.+) · (\d{4}-\d{2}-\d{2})$/.exec(String(s || "").trim()); return m ? { name: m[1], iso: m[2] } : null; };

  /** the ledger in a workbook: {si, head, c1, c2, r0, r1 (last data row), cols: {date, desc, income, expense, amount, type, category, balance, ref}} */
  const HEADS = { date: /^(date|day|when)$/i, desc: /^(description|details?|item|memo|narration|note|notes)$/i, income: /^(income|received|receipts?|credit|money in|in|deposits?)$/i,
    expense: /^(expenses?|paid|payments?|debit|money out|out|spent|withdrawals?)$/i, amount: /^(amount|value|total)$/i, type: /^(type|income\s*\/\s*expense|in\s*\/\s*out|kind)$/i,
    category: /^(category|account|group)$/i, balance: /^(balance|running balance)$/i, ref: /^(ref|reference|📌)$/i, paidto: /^(paid (up )?to|paid until)$/i };
  function findLedger(sheets, get, prefer) {
    const order = sheets.map((s, i) => i).sort((a, b) => (sheets[b].name === prefer) - (sheets[a].name === prefer));
    for (const si of order) {
      for (let r = 0; r < 12; r++) {
        const cols = {}; let c1 = Infinity, c2 = -1;
        for (let c = 0; c < 40; c++) {
          const v = get(si, c, r); if (typeof v !== "string" || !v.trim()) continue;
          for (const [k, re] of Object.entries(HEADS)) if (cols[k] == null && re.test(v.trim())) { cols[k] = c; c1 = Math.min(c1, c); c2 = Math.max(c2, c); break; }
        }
        if (cols.date == null || !((cols.income != null && cols.expense != null) || cols.amount != null)) continue;
        let last = r, blank = 0;
        for (let y = r + 1; y < r + 200000 && blank < 50; y++) { let any = false; for (let c = c1; c <= c2; c++) { const v = get(si, c, y); if (v != null && v !== "") { any = true; break; } } if (any) { last = y; blank = 0; } else blank++; }
        return { si, head: r, c1, c2, r0: r + 1, r1: last, cols };
      }
    }
    return null;
  }
  /** what ⟳ Bring up to date would do: {add: [{k, o}], change: [{r, ref, from, to}], stale: [{r, ref}]} - rows = [{r, ref, amount}] */
  function plan(consts, rows, to) {
    const have = new Map(); for (const x of rows) { if (x.ref && parseRef(x.ref)) have.set(x.ref, x); }
    const add = [], change = [], seen = new Set();
    const manual = new Set();                          // 2.827.0: "you enter it" constants: never made here, their Refs never stale
    for (const k of consts || []) { if (k.manual) { manual.add(k.name.toLowerCase()); continue; } for (const o of occurrences(k, to)) {
      const ref = refOf(k.name, o.iso); seen.add(ref);
      const h = have.get(ref);
      if (!h) add.push({ k, o, ref });
      else if (Math.abs((+h.amount || 0) - o.amount) > 1e-9) change.push({ r: h.r, ref, k, from: h.amount, to: o.amount });
    } }
    const stale = rows.filter((x) => { const p = parseRef(x.ref); return p && !seen.has(x.ref) && !manual.has(p.name.toLowerCase()); }).map((x) => ({ r: x.r, ref: x.ref }));
    add.sort((a, b) => a.o.serial - b.o.serial);
    return { add, change, stale };
  }
  /** "received" = income, "paid" / "payment" = expense (received wins: "received a payment") - for the prompt docker too */
  function kindOfWords(t) { const s = String(t || "").toLowerCase(); return /\breceiv/.test(s) ? "income" : /\b(paid|pay|payment|spent|bought)\b/.test(s) ? "expense" : null; }
  /** a new rate (or a rate on the same start replaced) in a constant of that name, or a new constant */
  function upsert(list, f) {
    const name = String(f.name || "").trim(); if (!name) throw new Error("give it a name (Rent, Phone, Wages …)");
    const amount = +f.amount; if (!isFinite(amount) || f.amount === "" || f.amount == null) throw new Error("the amount is not a number");
    if (!EVERY.includes(f.every)) throw new Error("pick how often");
    if (serial(f.start) == null) throw new Error("pick the start date");
    let k = list.find((x) => x.name.toLowerCase() === name.toLowerCase()), made = false;
    if (!k) { k = { id: "k" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name, kind: f.kind === "income" ? "income" : "expense", rates: [] }; list.push(k); made = true; }
    if (f.kind) k.kind = f.kind === "income" ? "income" : "expense";
    if (f.desc != null) { const d = String(f.desc).trim(); if (d) k.desc = d; else delete k.desc; }
    if (f.end !== undefined) { if (serial(f.end) != null) k.end = f.end; else delete k.end; }
    if (f.manual !== undefined) { if (f.manual) k.manual = true; else delete k.manual; }
    const same = k.rates.findIndex((r) => r.start === f.start);
    const rate = { amount, every: f.every, start: f.start };
    if (same >= 0) k.rates[same] = rate; else k.rates.push(rate);
    k.rates.sort((a, b) => serial(a.start) - serial(b.start));
    return { k, made, replaced: same >= 0 };
  }

  /** 2.827.0: paid to - {to, credit, ahead | behind + owing} for what has been paid (null when it has no start) */
  const CALC = () => root.SheetCalc || (typeof require === "function" ? require("./sheetcalc.js") : null);
  function paidStatus(k, paid, today) {
    const C = CALC(), p = C.paidTo(k, paid); if (!p) return null;
    const t = today == null ? todaySerial() : today, o = { to: p.to, iso: isoOf(p.to), credit: p.credit, paid: +paid || 0 };
    if (p.to >= t) o.ahead = p.to - t;
    else { let owe = 0; for (let d = p.to + 1; d <= t; d++) owe += C.dayRate(k, d); o.behind = t - p.to; o.owing = Math.max(0, Math.round((owe - p.credit) * 100) / 100); }
    return o;
  }
  /** which constant a ledger row is for: its Category when that is a constant's name, else its Ref's name */
  function constOfRow(consts, category, ref) {
    const by = (n) => (consts || []).find((k) => k.name.toLowerCase() === String(n || "").trim().toLowerCase());
    return (typeof category === "string" && by(category)) || ((parseRef(ref) || {}).name && by(parseRef(ref).name)) || null;
  }
  const SheetConst = { paidStatus, constOfRow, EVERY, serial, isoOf, nth, occurrences, rateNow, refOf, parseRef, findLedger, plan, kindOfWords, upsert, HEADS, todaySerial };
  if (typeof module !== "undefined" && module.exports) { module.exports = SheetConst; return; }

  /* ================================================================== the page */
  const doc = root.document; if (!doc) return;
  const H = () => root.H3Sheet, X = () => root.H3Sheet && root.H3Sheet._, C = () => root.SheetCalc;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const money = (n) => { const a = Math.abs(+n || 0); return (n < 0 ? "-" : "") + "$" + a.toLocaleString("en-AU", { minimumFractionDigits: a % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? `${+m[3]}/${m[2]}/${m[1]}` : ""; };
  const list = () => { const W = H().W; if (!Array.isArray(W.constants)) W.constants = []; return W.constants; };
  const MONEY = '"$"#,##0.00';

  /** the ledger now (W.ledger.sheet first), or null */
  function ledgerNow() { const Hs = H(), b = Hs.book(); return findLedger(Hs.W.sheets, (si, c, r) => b.get(si, c, r), Hs.W.ledger && Hs.W.ledger.sheet); }
  /** a new "Ledger" sheet: Date | Description | Category | Income | Expense | Balance | Ref */
  function makeLedger() {
    const Hs = H(), I = X(), W = Hs.W;
    let name = "Ledger", i = 2; while (W.sheets.some((s) => s.name.toLowerCase() === name.toLowerCase())) name = "Ledger " + i++;
    const heads = ["Date", "Description", "Category", "Income", "Expense", "Balance", "Paid to", "Ref"], cells = {};
    heads.forEach((h, c) => { cells[C().addr(c, 0)] = { v: h, s: { b: true, bg: "#203864", fg: "#ffffff" } }; });
    W.sheets.push({ name, cells, cols: { 0: 96, 1: 220, 2: 110, 3: 96, 4: 96, 5: 104, 6: 96, 7: 190 }, rows: {}, merges: [], freeze: { r: 1, c: 0 }, charts: [] });
    W.ledger = { sheet: name };
    Hs.St.book = null; I.tabs();
    return name;
  }
  /** rows of the ledger as {r, ref, amount (the income / expense / amount the entry carries)} */
  function ledgerRows(L) {
    const b = H().book(), out = [], v = (c, r) => (c == null ? "" : b.get(L.si, c, r));
    for (let r = L.r0; r <= L.r1; r++) {
      const ref = v(L.cols.ref, r);
      let amount = 0;
      if (L.cols.income != null || L.cols.expense != null) { const a = v(L.cols.income, r), e = v(L.cols.expense, r); amount = typeof a === "number" && a ? a : typeof e === "number" ? e : 0; }
      else { const a = v(L.cols.amount, r); amount = typeof a === "number" ? Math.abs(a) : 0; }
      out.push({ r, ref: typeof ref === "string" ? ref : "", amount });
    }
    return out;
  }
  /** 2.827.0: what has been paid for each constant in the ledger: {name (lower case): total} */
  function paidTotals(L) {
    const b = H().book(), out = {}, v = (c, r) => (c == null ? "" : b.get(L.si, c, r)), K = list();
    for (let r = L.r0; r <= L.r1; r++) {
      const k = constOfRow(K, v(L.cols.category, r), v(L.cols.ref, r)); if (!k) continue;
      const c = L.cols.income != null || L.cols.expense != null ? (k.kind === "income" ? L.cols.income : L.cols.expense) : L.cols.amount;
      const a = v(c, r); if (typeof a === "number") out[k.name.toLowerCase()] = (out[k.name.toLowerCase()] || 0) + Math.abs(a);
    }
    return out;
  }
  /** writes the plan into the ledger (one undo step): new rows in date order, changed amounts, stale rows taken out when ticked */
  function apply(L, P, o) {
    const Hs = H(), I = X(), Cc = C(), W = Hs.W, S = W.sheets[L.si];
    I.step();
    if (L.cols.ref == null) {                          // a Ref column at the table's end (its heading styled like the one before it)
      const c = L.c2 + 1, prev = S.cells[Cc.addr(L.c2, L.head)] || {};
      S.cells[Cc.addr(c, L.head)] = Object.assign({}, prev.s ? { s: JSON.parse(JSON.stringify(prev.s)) } : {}, { v: "Ref" });
      if (!S.cols[c]) S.cols[c] = 190;
      L.cols.ref = c; L.c2 = c;
    }
    if (o.paidCol && L.cols.paidto == null) {        // 2.827.0: a Paid to column (ticked), headed like the one before it
      const c = L.c2 + 1, prev = S.cells[Cc.addr(L.c2, L.head)] || {};
      S.cells[Cc.addr(c, L.head)] = Object.assign({}, prev.s ? { s: JSON.parse(JSON.stringify(prev.s)) } : {}, { v: "Paid to" });
      if (!S.cols[c]) S.cols[c] = 96;
      L.cols.paidto = c; L.c2 = c;
    }
    const cR = L.cols, wide = Math.max(L.c2, ...Object.values(cR).filter((x) => x != null));
    const amountCol = (k) => (cR.income != null || cR.expense != null ? (k.kind === "income" ? cR.income : cR.expense) : cR.amount);
    // changed amounts, in place
    if (o.change) for (const x of P.change) { const c = amountCol(x.k); if (c == null) continue; const cell = S.cells[Cc.addr(c, x.r)] || (S.cells[Cc.addr(c, x.r)] = {}); cell.v = String(x.to); }
    // the rows: kept (less the stale ones when ticked) + the new ones, in date order
    const drop = new Set(o.stale ? P.stale.map((x) => x.r) : []);
    const b = new Cc.Book(W.sheets); b.consts = W.constants;
    const rows = [];
    for (let r = L.r0; r <= L.r1; r++) {
      if (drop.has(r)) continue;
      const cells = {}; for (let c = 0; c <= wide; c++) { const k = Cc.addr(c, r); if (S.cells[k]) cells[c] = S.cells[k]; }
      const d = cR.date != null ? b.get(L.si, cR.date, r) : null;
      rows.push({ from: r, cells, date: typeof d === "number" ? d : null });
    }
    for (const a of P.add) {
      const cells = {}, k = a.k, put = (c, v, f) => { if (c == null || v == null || v === "") return; cells[c] = { v: String(v) }; if (f) cells[c].f = f; };
      put(cR.date, a.o.iso, "d/mm/yyyy");
      put(cR.desc, k.desc || k.name);
      put(cR.category, k.name);
      if (cR.income != null || cR.expense != null) put(amountCol(k), a.o.amount);
      else { put(cR.amount, k.kind === "expense" && cR.type == null ? -a.o.amount : a.o.amount); put(cR.type, k.kind === "income" ? "Income" : "Expense"); }
      put(cR.ref, a.ref);
      rows.push({ from: -1, cells, date: a.o.serial, add: true });
    }
    rows.forEach((x, i) => { x.i = i; });
    rows.sort((x, y) => (x.date == null || y.date == null ? x.i - y.i : x.date - y.date || x.i - y.i));   // stable; undated rows keep their place
    // clear the block, then write it back (formulas follow their row)
    for (let r = L.r0; r <= L.r1; r++) for (let c = 0; c <= wide; c++) delete S.cells[Cc.addr(c, r)];
    rows.forEach((x, i) => {
      const r = L.r0 + i;
      for (const [c, cell] of Object.entries(x.cells)) {
        const nc = JSON.parse(JSON.stringify(cell));
        if (!x.add && typeof nc.v === "string" && nc.v[0] === "=" && r !== x.from) nc.v = Cc.shiftFormula(nc.v, r - x.from, 0);
        S.cells[Cc.addr(+c, r)] = nc;
      }
    });
    // a new row's looks + the formulas of the table (Balance …) from the nearest kept row (above, else below)
    rows.forEach((x, i) => {
      if (!x.add) return;
      const r = L.r0 + i;
      let j = i - 1; while (j >= 0 && rows[j].add) j--;
      if (j < 0) { j = i + 1; while (j < rows.length && rows[j].add) j++; }
      const src = j >= 0 && j < rows.length ? L.r0 + j : -1;
      for (let c = L.c1; c <= wide; c++) {
        const from = src >= 0 ? S.cells[Cc.addr(c, src)] : null, k = Cc.addr(c, r);
        if (!from) { if (S.cells[k] && (c === cR.income || c === cR.expense || c === cR.amount) && !S.cells[k].f) S.cells[k].f = MONEY; continue; }
        if (!S.cells[k] && typeof from.v === "string" && from.v[0] === "=" && c !== cR.ref) S.cells[k] = { v: Cc.shiftFormula(from.v, r - src, 0) };
        if (!S.cells[k]) continue;
        if (from.f && !(c === cR.date)) S.cells[k].f = S.cells[k].f || from.f;
        if (from.f && c === cR.date) S.cells[k].f = from.f;
        if (from.s) S.cells[k].s = JSON.parse(JSON.stringify(from.s));
      }
      if (cR.balance != null && !S.cells[Cc.addr(cR.balance, r)] && (cR.income != null || cR.amount != null)) {   // a ledger with no balance formulas yet
        const A = (c) => Cc.colName(c) + "$" + (L.r0 + 1);
        const run = cR.income != null ? `=SUM(${A(cR.income)}:${Cc.addr(cR.income, r)})-SUM(${A(cR.expense)}:${Cc.addr(cR.expense, r)})` : `=SUM(${A(cR.amount)}:${Cc.addr(cR.amount, r)})`;
        S.cells[Cc.addr(cR.balance, r)] = { v: run, f: MONEY };
      }
    });
    // 2.827.0: Paid to on every row of a constant - the date what was paid by that row pays up to (weekly / 7 a day)
    let paidRows = 0;
    if (cR.paidto != null) {
      const q = (x) => '"' + String(x).replace(/"/g, '""') + '"', top = L.r0 + 1, rng = (c, r) => `${Cc.colName(c)}$${top}:${Cc.colName(c)}${r + 1}`;
      for (let i = 0; i < rows.length; i++) {
        const r = L.r0 + i, key = Cc.addr(cR.paidto, r), cur = S.cells[key];
        const cat = cR.category != null && S.cells[Cc.addr(cR.category, r)] ? S.cells[Cc.addr(cR.category, r)].v : "", ref = cR.ref != null && S.cells[Cc.addr(cR.ref, r)] ? S.cells[Cc.addr(cR.ref, r)].v : "";
        const k = constOfRow(W.constants, cat, ref), mine = cur && typeof cur.v === "string" && /^=PAIDTO\(/i.test(cur.v);
        if (!k) { if (mine) delete S.cells[key]; continue; }
        if (cur && cur.v != null && cur.v !== "" && !mine) continue;          // something of yours there: left alone
        const amt = amountCol(k); if (amt == null) continue;
        const byCat = cR.category != null && String(cat).trim().toLowerCase() === k.name.toLowerCase(), by = byCat ? cR.category : cR.ref;
        if (by == null) continue;
        S.cells[key] = Object.assign({}, cur && cur.s ? { s: cur.s } : {}, { v: `=PAIDTO(${q(k.name)},ABS(SUMIF(${rng(by, r)},${q(byCat ? k.name : `📌 ${k.name} · *`)},${rng(amt, r)})))`, f: "d/mm/yyyy" });
        paidRows++;
      }
    }
    W.ledger = { sheet: S.name };
    Hs.St.book = null; I.changed();
    return { paidRows, added: P.add.length, changed: o.change ? P.change.length : 0, removed: drop.size };
  }

  /* ------------------------------------------------------------------ the dialog */
  let dlg = null, pick = null, pending = null;
  const $ = (id) => doc.getElementById(id);
  function buildDlg() {
    dlg = doc.createElement("dialog"); dlg.id = "shConstDlg"; dlg.className = "shfd";
    dlg.innerHTML = `<style>
      #shConstDlg { padding: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--text); width: min(760px, 96vw); font-size: 12px; }
      #shConstDlg::backdrop { background: rgba(0,0,0,.45); }
      #shConstDlg .dh { display: flex; align-items: center; padding: 8px 12px; font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--line); }
      #shConstDlg .dh button { margin-left: auto; }
      #shConstDlg .db { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
      #shConstDlg .hint { color: var(--dim); line-height: 1.45; margin: 0; }
      #shConstDlg .form { display: grid; grid-template-columns: 1.4fr .9fr .8fr .9fr 1.1fr; gap: 6px 8px; align-items: end; }
      #shConstDlg .form label { display: flex; flex-direction: column; gap: 3px; color: var(--dim); }
      #shConstDlg .form input, #shConstDlg .form select { width: 100%; box-sizing: border-box; }
      #shConstDlg .row2 { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      #shConstDlg .row2 label { display: flex; align-items: center; gap: 4px; }
      #shConstDlg .row2 select, #shConstDlg .row2 input[type=date] { width: auto; min-width: 0; }
      #shConstDlg #sckLedger { min-width: 160px; }
      #shConstDlg #sckList { border: 1px solid var(--line); border-radius: 6px; max-height: 210px; overflow: auto; }
      #shConstDlg .k { display: grid; grid-template-columns: 1.3fr .9fr auto 1.4fr auto; gap: 8px; padding: 5px 8px; border-bottom: 1px solid var(--line); cursor: pointer; align-items: center; }
      #shConstDlg .k:last-child { border-bottom: 0; }
      #shConstDlg .k.on { background: rgba(255,140,0,.12); }
      #shConstDlg .k .in { color: #4cc38a; } #shConstDlg .k .ex { color: #ff8a65; }
      #shConstDlg .k .hist { grid-column: 1 / -1; color: var(--dim); display: flex; flex-direction: column; gap: 2px; padding-left: 10px; }
      #shConstDlg .k .hist span.now { color: var(--text); }
      #shConstDlg .k .paid { grid-column: 1 / -1; color: var(--dim); padding-left: 2px; }
      #shConstDlg .k .paid b { font-weight: 500; } #shConstDlg .k .paid.behind b { color: #ff8a65; } #shConstDlg .k .paid.ahead b { color: #4cc38a; }
      #shConstDlg .empty { padding: 10px; color: var(--dim); }
      #shConstDlg #sckPlan { border: 1px dashed var(--line); border-radius: 6px; padding: 8px; line-height: 1.5; }
      #shConstDlg #sckPlan ul { margin: 2px 0 4px 16px; padding: 0; max-height: 90px; overflow: auto; }
      #shConstDlg .df { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-top: 1px solid var(--line); flex-wrap: wrap; }
      #shConstDlg #sckMsg { margin-right: auto; color: var(--dim); }
      #shConstDlg .sckgo { border-color: var(--tiger); color: var(--tiger); font-weight: 600; }
      #shConstDlg [hidden] { display: none !important; }
    </style>
    <div class="dh">📌 Constants - amounts that repeat<button class="ghost" type="button" data-x="1" aria-label="Close">✕</button></div>
    <div class="db">
      <p class="hint">Rent, wages, a phone plan, a loan … one line each. A new amount from a later date is added to the same name - the earlier amount stays for the dates before it. ⟳ Bring up to date puts every due entry in the ledger.</p>
      <div class="form">
        <label>Type<input type="text" id="sckName" list="sckNames" placeholder="e.g. Rent" data-noi18n><datalist id="sckNames"></datalist></label>
        <label>How much<input type="number" id="sckAmt" step="0.01" min="0" placeholder="540"></label>
        <label>How often<select id="sckEvery"><option value="day">day</option><option value="week" selected>week</option><option value="fortnight">fortnight</option><option value="month">month</option><option value="quarter">quarter</option><option value="year">year</option></select></label>
        <label>Start date<input type="date" id="sckStart"></label>
        <label>Description<input type="text" id="sckDesc" placeholder="e.g. Rent payment" data-noi18n></label>
      </div>
      <div class="row2">
        <label><input type="radio" name="sckKind" value="expense" checked> Expense (paid)</label>
        <label><input type="radio" name="sckKind" value="income"> Income (received)</label>
        <label>Ends <input type="date" id="sckEnd"></label>
        <label title="Off: you enter its payments yourself (Category = its name) - Paid to shows how far they cover"><input type="checkbox" id="sckAuto" checked> ⟳ enters it</label>
        <button type="button" class="ghost sckgo" id="sckAdd">＋ Add</button>
      </div>
      <div id="sckList"></div>
      <div class="row2"><span>Ledger</span><select id="sckLedger"></select>
        <label><input type="checkbox" id="sckPaid" checked> Paid to column</label>
        <span>Up to</span><input type="date" id="sckTo"><button type="button" class="ghost" id="sckSync">⟳ Bring up to date</button></div>
      <div id="sckPlan" hidden></div>
    </div>
    <div class="df"><span id="sckMsg"></span><button type="button" class="ghost" data-x="1">Close</button><button type="button" class="ghost sckgo" id="sckApply" hidden>✔ Apply</button></div>`;
    doc.body.appendChild(dlg);
    dlg.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && e.target.closest(".form")) { e.preventDefault(); add(); } });
    dlg.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) return dlg.close();
      const del = e.target.closest("[data-del]"); if (del) { e.stopPropagation(); return removeConst(del.dataset.del); }
      const dr = e.target.closest("[data-delrate]"); if (dr) { e.stopPropagation(); return removeRate(dr.dataset.k, +dr.dataset.delrate); }
      const k = e.target.closest(".k[data-k]"); if (k) choose(k.dataset.k);
    });
    $("sckAdd").addEventListener("click", add);
    $("sckName").addEventListener("input", () => { const k = list().find((x) => x.name.toLowerCase() === $("sckName").value.trim().toLowerCase()); paintAddLabel(k); if (k) { dlg.querySelector(`[name="sckKind"][value="${k.kind}"]`).checked = true; $("sckAuto").checked = !k.manual; } });   // its own income / expense
    $("sckSync").addEventListener("click", preview);
    $("sckApply").addEventListener("click", doApply);
    $("sckPaid").addEventListener("change", hidePlan);
    $("sckLedger").addEventListener("change", () => { const v = $("sckLedger").value; if (v === "\u0001new") { const n = makeLedger(); X().changed(); paintLedgers(n); } else if (v) H().W.ledger = { sheet: v }; hidePlan(); });
  }
  function msg(t, bad) { const m = $("sckMsg"); if (m) { m.textContent = t || ""; m.style.color = bad ? "#ff6b6b" : "var(--dim)"; } }
  const today = () => isoOf(todaySerial());
  function paintAddLabel(k) { $("sckAdd").textContent = k ? `＋ Add a new amount to ${k.name}` : "＋ Add"; }
  function paintList() {
    const L = list(), box = $("sckList"), tdy = todaySerial(), led = ledgerNow(), paid = led ? paidTotals(led) : null;
    $("sckNames").innerHTML = L.map((k) => `<option value="${esc(k.name)}">`).join("");
    if (!L.length) { box.innerHTML = `<div class="empty">No constants yet - type one above (e.g. Rent · 540 · week · 13/01/2026) and ＋ Add.</div>`; return; }
    box.innerHTML = L.map((k) => {
      const now = rateNow(k, tdy) || sorted(k)[0], R = sorted(k), open = pick === k.id;
      const hist = open ? `<div class="hist">${R.map((r, i) => `<span class="${r === now ? "now" : ""}" data-noi18n>${dmy(r.start)}${i + 1 < R.length ? " - " + dmy(isoOf(serial(R[i + 1].start) - 1)) : k.end ? " - " + dmy(k.end) : " →"} · ${money(r.amount)} / ${EVERY_WORD[r.every]} <button class="ghost" type="button" data-k="${esc(k.id)}" data-delrate="${i}" title="Delete this amount">🗑</button></span>`).join("")}</div>` : "";
      return `<div class="k${open ? " on" : ""}" data-k="${esc(k.id)}"><b data-noi18n>${esc(k.name)}</b><span class="${k.kind === "income" ? "in" : "ex"}">${k.kind === "income" ? "Income (received)" : "Expense (paid)"}</span>${k.manual ? `<span class="man" title="you enter its payments">✍</span>` : ""}`
        + `<span data-noi18n>${money(now.amount)} / ${EVERY_WORD[now.every]} · ${dmy(now.start)}${R.length > 1 ? ` (${R.length})` : ""}${k.end ? " · ⏹ " + dmy(k.end) : ""}</span>`
        + `<button class="ghost" type="button" data-del="${esc(k.id)}" title="Delete this constant (the entries already in the ledger stay)">🗑</button>${paidLine(k, paid, tdy)}${hist}</div>`;
    }).join("");
  }
  /** "Paid to 24/01/2026 · 3 days behind · $231.43 owing" (or ahead / up to date / nothing paid yet) */
  function paidLine(k, paid, tdy) {
    if (!paid) return "";
    const st = paidStatus(k, paid[k.name.toLowerCase()] || 0, tdy); if (!st) return "";
    const d = dmy(st.iso), n = st.behind || st.ahead || 0, owe = money(st.owing || 0), cr = st.credit ? money(st.credit) : "";
    let t;
    if (!st.paid) t = st.owing ? `<b>Nothing paid yet · ${owe} owing</b>` : `<b>Nothing paid yet</b>`;
    else if (st.behind) t = n === 1 ? `<b>Paid to ${d} · 1 day behind · ${owe} owing</b>` : `<b>Paid to ${d} · ${n} days behind · ${owe} owing</b>`;
    else if (st.ahead) t = n === 1 ? `<b>Paid to ${d} · 1 day ahead</b>` : `<b>Paid to ${d} · ${n} days ahead</b>`;
    else t = `<b>Paid to ${d} · paid to today</b>`;
    const extra = cr ? ` <span>+ ${cr} toward the next day</span>` : "";
    return `<div class="paid ${st.behind || !st.paid ? "behind" : "ahead"}">${t}${extra}</div>`;
  }
  function paintLedgers(sel) {
    const Hs = H(), L = ledgerNow(), names = Hs.W.sheets.map((s) => s.name);
    const cur = sel || (Hs.W.ledger && Hs.W.ledger.sheet) || (L ? Hs.W.sheets[L.si].name : "");
    $("sckLedger").innerHTML = (cur ? "" : `<option value="">Pick a sheet</option>`) + names.map((n) => `<option value="${esc(n)}"${n === cur ? " selected" : ""} data-noi18n>${esc(n)}</option>`).join("") + `<option value="\u0001new">＋ Make a Ledger sheet</option>`;
  }
  function choose(id) {
    const k = list().find((x) => x.id === id); if (!k) return;
    pick = pick === id ? null : id;
    if (pick) { const r = rateNow(k) || sorted(k)[0]; $("sckName").value = k.name; $("sckAmt").value = r.amount; $("sckEvery").value = r.every; $("sckDesc").value = k.desc || ""; $("sckEnd").value = k.end || ""; $("sckAuto").checked = !k.manual; dlg.querySelector(`[name="sckKind"][value="${k.kind}"]`).checked = true; $("sckStart").value = ""; paintAddLabel(k); msg(`a new amount for ${k.name}: change the amount, pick the date it starts, ＋ Add`); }
    paintList();
  }
  function changed() { const I = X(); H().St.book = null; I.changed(); hidePlan(); }
  function add() {
    try {
      const r = upsert(list(), { name: $("sckName").value, amount: $("sckAmt").value, every: $("sckEvery").value, start: $("sckStart").value, desc: $("sckDesc").value, end: $("sckEnd").value || null, kind: dlg.querySelector('[name="sckKind"]:checked').value, manual: !$("sckAuto").checked });
      pick = r.k.id; changed(); paintList(); paintAddLabel(r.k);
      msg(r.made ? `📌 ${r.k.name} added - ⟳ Bring up to date puts its entries in the ledger` : r.replaced ? `📌 ${r.k.name}: the amount from ${dmy($("sckStart").value)} changed` : `📌 ${r.k.name}: ${money(+$("sckAmt").value)} from ${dmy($("sckStart").value)} - the dates before keep the earlier amount`);
      $("sckStart").value = "";
    } catch (e) { msg("✗ " + e.message, true); }
  }
  function removeConst(id) { const L = list(), i = L.findIndex((x) => x.id === id); if (i < 0) return; const n = L[i].name; L.splice(i, 1); if (pick === id) pick = null; changed(); paintList(); msg(`🗑 ${n} deleted - its entries already in the ledger stay`); }
  function removeRate(id, i) { const k = list().find((x) => x.id === id); if (!k) return; const R = sorted(k); if (R.length < 2) return removeConst(id); k.rates = R.filter((_, j) => j !== i); changed(); paintList(); msg(`🗑 that amount of ${k.name} deleted`); }
  function hidePlan() { pending = null; if ($("sckPlan")) { $("sckPlan").hidden = true; $("sckApply").hidden = true; } }
  /** ⟳ Bring up to date: what would change, shown first */
  function preview() {
    const Hs = H(), W = Hs.W, to = serial($("sckTo").value) || todaySerial();
    if (!list().length) return msg("no constants yet - add one first", true);
    if (!(W.ledger && W.sheets.some((s) => s.name === W.ledger.sheet))) { const L0 = ledgerNow(); if (L0) W.ledger = { sheet: W.sheets[L0.si].name }; else { makeLedger(); X().changed(); paintLedgers(W.ledger.sheet); msg(`📒 a "${W.ledger.sheet}" sheet made for the entries`); } }
    const L = ledgerNow();
    if (!L || W.sheets[L.si].name !== W.ledger.sheet) return msg(`✗ "${W.ledger.sheet}" has no Date + Income / Expense (or Amount) headings - pick another sheet or ＋ Make a Ledger sheet`, true);
    const P = plan(list(), ledgerRows(L), to);
    pending = { L, P };
    const by = {}; for (const a of P.add) by[a.k.name] = (by[a.k.name] || 0) + 1;
    const lines = [];
    const upTo = dmy(isoOf(to)), nA = P.add.length, nC = P.change.length, nS = P.stale.length, what = esc(Object.entries(by).map(([n, c]) => `${n} × ${c}`).join(", "));
    const row = (x) => { const n = x.r + 1; return `row ${n}: ${esc(x.ref.replace(/^📌 /, ""))}`; };
    lines.push(nA === 1 ? `<div>1 new entry up to ${upTo}: ${what}</div>` : nA ? `<div>${nA} new entries up to ${upTo}: ${what}</div>` : `<div>No new entries - the ledger is up to date to ${upTo}</div>`);
    if (nC) lines.push(`<label><input type="checkbox" id="sckFix" checked> <span>${nC === 1 ? "Correct 1 entry whose amount changed" : `Correct ${nC} entries whose amount changed`}</span></label><ul data-noi18n>${P.change.slice(0, 60).map((x) => `<li>${row(x)} · ${money(x.from)} → ${money(x.to)}</li>`).join("")}</ul>`);
    if (nS) lines.push(`<label><input type="checkbox" id="sckStale"> <span>${nS === 1 ? "Remove 1 entry no constant makes any more" : `Remove ${nS} entries no constant makes any more`}</span></label><ul data-noi18n>${P.stale.slice(0, 60).map((x) => `<li>${row(x)}</li>`).join("")}</ul>`);
    const addPaid = $("sckPaid").checked && L.cols.paidto == null;
    if (addPaid) lines.push(`<div>＋ a Paid to column in the ledger</div>`);
    let needPaid = 0;                                 // rows of a constant whose Paid to is not filled in yet (payments you typed)
    if (L.cols.paidto != null) { const b = Hs.book(), S0 = W.sheets[L.si]; for (let r = L.r0; r <= L.r1; r++) { if (!constOfRow(list(), L.cols.category != null ? b.get(L.si, L.cols.category, r) : "", L.cols.ref != null ? b.get(L.si, L.cols.ref, r) : "")) continue; const c = S0.cells[C().addr(L.cols.paidto, r)]; if (!c || c.v == null || c.v === "") needPaid++; } }
    if (needPaid) lines.push(needPaid === 1 ? `<div>Paid to filled in on 1 row</div>` : `<div>Paid to filled in on ${needPaid} rows</div>`);
    const any = P.add.length || P.change.length || P.stale.length || addPaid || needPaid;
    $("sckPlan").innerHTML = lines.join(""); $("sckPlan").hidden = false;
    $("sckApply").hidden = !any; msg(any ? `into "${W.sheets[L.si].name}" - ✔ Apply` : "");
    return P;
  }
  function doApply() {
    if (!pending) return;
    const I = X(); if (I.guardSheet && H().W.sheets[pending.L.si].protect) return msg("✗ the ledger sheet is protected", true);
    const r = apply(pending.L, pending.P, { change: !!($("sckFix") && $("sckFix").checked), stale: !!($("sckStale") && $("sckStale").checked), paidCol: $("sckPaid").checked });
    hidePlan(); paintList();
    const t = !r.added && !r.changed && !r.removed ? `📌 Paid to filled in on ${r.paidRows} rows in "${H().W.ledger.sheet}" (Ctrl+Z takes it back)`
      : `📌 ${r.added} entr${r.added === 1 ? "y" : "ies"} added` + (r.changed ? `, ${r.changed} corrected` : "") + (r.removed ? `, ${r.removed} removed` : "") + ` in "${H().W.ledger.sheet}" (Ctrl+Z takes it back)`;
    msg(t); I.msg(t);
    return r;
  }
  function open() {
    if (!H() || !X()) return;
    if (!dlg) buildDlg();
    pick = null; hidePlan(); msg("");
    $("sckTo").value = today(); $("sckStart").value = ""; $("sckEnd").value = ""; paintAddLabel(null);
    paintList(); paintLedgers();
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    setTimeout(() => $("sckName").focus(), 30);
  }
  /** 2.828.0: the form filled in (a new amount from the prompt docker: "rent went up to 600 from 1/12/2026") */
  function fill(f) {
    if (!dlg) open();
    const k = list().find((x) => x.name.toLowerCase() === String(f.name || "").toLowerCase());
    $("sckName").value = f.name || ""; $("sckAmt").value = f.amount != null ? f.amount : ""; if (f.every) $("sckEvery").value = f.every; $("sckStart").value = f.start || "";
    if (k) { pick = k.id; $("sckDesc").value = k.desc || ""; $("sckEnd").value = k.end || ""; $("sckAuto").checked = !k.manual; dlg.querySelector(`[name="sckKind"][value="${k.kind}"]`).checked = true; }
    paintAddLabel(k); paintList();
    msg(k ? `a new amount for ${k.name} from ${dmy(f.start)} - ＋ Add a new amount to ${k.name}` : "");
    setTimeout(() => $("sckAdd").focus(), 30);
  }
  root.H3SheetConst = Object.assign({ fill, open, preview, doApply, apply, ledgerNow, ledgerRows, paidTotals, makeLedger, list }, SheetConst);
})(typeof window !== "undefined" ? window : globalThis);
