/* bitGen Studio — ▦ Spreadsheet from the PROMPT DOCKER (2.828.0). Tim: "can i use prompt docker to upload a file and the llm
 * formats it or creates a dashboard etc. if i say create a dashboard it creates a dashboard, if i say received a payment of
 * <number> it adds it to the right columns with description" + "if we say received it's income if we say paid or payment it is
 * an expense" + "go with next please".
 *
 *   ＋ / drop an .xlsx / .xlsm / .csv / .tsv on the prompt docker -> it opens in the spreadsheet (ext/promptdock pdAdd -> attach)
 *   a message goes to the spreadsheet first (index.html chatSend -> window.H3ChatRoutes) when it is about it: the spreadsheet is on
 *   screen, a workbook was just attached, the message names the spreadsheet / sheet / ledger / workbook, or (payments) the
 *   workbook keeps a ledger / constants. route(text) -> the kind:
 *     update      "bring the ledger up to date"          -> 📌 Constants ⟳ (the plan shown, ✔ Apply)
 *     rate        "rent went up to 600 from 1/12/2026"   -> 📌 Constants with the new amount filled in (＋ Add a new amount)
 *     entry       "received a payment of 540 for rent"   -> a row shown first (Date / Description / Category / Income or
 *                 "paid 80 for power yesterday"             Expense, all editable) - ✔ Add puts it in the ledger in date order
 *                                                           (one undo; Paid to filled when it is a constant's)
 *     constants   "show the constants"                   -> 📌 Constants
 *     dashboard   "create a dashboard (of sales by region)" -> ✨ Dashboard by the LLM (the words = what it should show)
 *     format      "format it" / "tidy up the table"      -> the table formatted (sheetdash formatTable)
 *     explain / fill / formula                           -> 💡 Explain / 🪄 Fill from examples / ✍ Write a formula (the words asked)
 *   received = income, paid / payment / spent / bought = expense (received wins: "received a payment").
 * The pure parts (route, parseAmount, parseDate, parseEntry, parseRate) run in Node too.
 */
(function (root) {
  "use strict";
  const K = () => root.H3SheetConst || root.SheetConst || (typeof require === "function" ? require("./sheetconst.js") : null);
  const DAY = 86400000;
  const isoOf = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null; };
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const DATE_RE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b|\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s+(\d{4}))?\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i;
  /** a date in the words (day first: 13/01/2026, 13 Jan, Jan 13, 2026-01-13, today, yesterday, tomorrow, next week / month) -> ISO */
  function parseDate(text, today) {
    const s = String(text || ""), t = today || new Date().toISOString().slice(0, 10), [ty, tm, td] = t.split("-").map(Number);
    const m = DATE_RE.exec(s);
    if (m) {
      if (m[1]) return isoOf(+m[1], +m[2], +m[3]);
      if (m[4]) { let y = +m[6]; if (y < 100) y += 2000; return isoOf(y, +m[5], +m[4]); }
      if (m[7]) return isoOf(m[9] ? +m[9] : ty, MONTHS.indexOf(m[8].toLowerCase().slice(0, 3)) + 1, +m[7]);
      if (m[10]) return isoOf(m[12] ? +m[12] : ty, MONTHS.indexOf(m[10].toLowerCase().slice(0, 3)) + 1, +m[11]);
    }
    const shift = (n) => new Date(Date.UTC(ty, tm - 1, td) + n * DAY).toISOString().slice(0, 10);
    if (/\byesterday\b/i.test(s)) return shift(-1);
    if (/\btomorrow\b/i.test(s)) return shift(1);
    if (/\bnext week\b/i.test(s)) return shift(7);
    if (/\bnext month\b/i.test(s)) return isoOf(tm === 12 ? ty + 1 : ty, tm === 12 ? 1 : tm + 1, 1);
    if (/\btoday\b/i.test(s)) return t;
    return null;
  }
  /** the money in the words ($1,250.50, 540, 80.5 dollars) - dates and "x2" left out; the first one */
  function parseAmount(text) {
    const s = String(text || "").replace(new RegExp(DATE_RE.source, "gi"), " ").replace(/\b\d+(st|nd|rd|th)\b/gi, " ");
    const m = /(?:\$|aud\s*|usd\s*)?\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?(?![\d.]*%)/i.exec(s);
    return m ? +(m[1].replace(/,/g, "") + (m[2] || "")) : null;
  }
  const KIND = (t) => { const k = K(); return k ? k.kindOfWords(t) : null; };
  /** what the message asks of the spreadsheet (null = not a spreadsheet thing) */
  function route(text, consts) {
    const s = String(text || "").trim(), lo = s.toLowerCase();
    if (!s) return null;
    if (/\b(bring|catch|get)\b.{0,30}\bup to date\b|\bup to date\b.{0,20}\b(ledger|constants?|rent|entries)\b/.test(lo)) return "update";
    const amount = parseAmount(s), named = constNamed(s, consts);
    if (named && amount != null && /\b(went|goes|go|going|gone)\s+(up|down)\b|\b(increase[sd]?|rises?|rose|raised|decrease[sd]?|drops?|dropped|change[sd]?|now|will be|is going to be|new (rate|amount|price))\b/.test(lo) && !/\b(received|paid)\b/.test(lo)) return "rate";
    if (amount != null && KIND(s)) return "entry";
    if (/\bconstants?\b/.test(lo)) return "constants";
    if (/\bdashboard\b/.test(lo)) return "dashboard";
    if (/\b(format|tidy( up)?|neaten|clean up)\s+(it|this|that|the (table|sheet|data|workbook|spreadsheet|ledger)|my (table|sheet|data|spreadsheet))\b|\bmake (it|this|the (table|sheet|data)) look\b/.test(lo)) return "format";
    if (/\bexplain\b.{0,25}\b(formula|cell)\b/.test(lo)) return "explain";
    if (/\b(flash ?fill|fill (in |down )?(the )?(rest|column|from (the |my )?examples?))\b/.test(lo)) return "fill";
    if (/\bformula\b/.test(lo) || (/\b(work out|calculate|total|sum|average|count|add up)\b/.test(lo) && /\b(column|row|cell|sheet|table|ledger|[a-z]{1,2}\d{1,5}(:[a-z]{1,2}\d{1,5})?)\b/.test(lo))) return "formula";
    return null;
  }
  /** a constant's name in the words (the longest that is there) */
  function constNamed(text, consts) {
    const lo = " " + String(text || "").toLowerCase().replace(/[^\wÀ-ɏ]+/g, " ") + " ";
    let best = null;
    for (const k of consts || []) { const n = " " + k.name.toLowerCase().replace(/[^\wÀ-ɏ]+/g, " ").trim() + " "; if (n.trim() && lo.includes(n) && (!best || n.length > best.n)) best = { k, n: n.length }; }
    return best ? best.k : null;
  }
  const tidy = (s) => String(s || "").replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "");
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  /** "received a payment of 540 for rent on 13/01/2026" -> {kind, amount, iso, desc, category} */
  function parseEntry(text, o) {
    o = o || {};
    const s = String(text || ""), kind = KIND(s), amount = parseAmount(s);
    if (!kind || amount == null) return null;
    const iso = parseDate(s, o.today) || o.today || new Date().toISOString().slice(0, 10);
    const k = constNamed(s, o.consts);
    let category = k ? k.name : "";
    if (!category) for (const c of o.categories || []) { if (c && new RegExp("\\b" + String(c).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(s)) { category = c; break; } }
    // the words after for / from / to - up to a date, "on", "yesterday" …
    const noDate = s.replace(new RegExp(DATE_RE.source, "gi"), " ").replace(/\b(today|yesterday|tomorrow|next (week|month))\b/gi, " ");
    const m = /\b(?:for|from|to)\s+(?:the\s+)?(.+?)(?:\s+\b(?:on|dated|at)\b.*)?$/i.exec(noDate.replace(/\$?\s*\d[\d,]*(\.\d+)?/g, " "));
    let desc = tidy(m ? m[1] : "");
    if (!desc) desc = k ? (k.desc || k.name) : kind === "income" ? "Payment received" : "Payment";
    return { kind, amount, iso, desc: cap(desc), category };
  }
  /** "rent went up to 600 from 1/12/2026" -> {name, amount, start, every} (no date = the next time it is due after today) */
  function parseRate(text, o) {
    o = o || {};
    const s = String(text || ""), k = constNamed(s, o.consts), amount = parseAmount(s);
    if (!k || amount == null) return null;
    const Kc = K(), R = (k.rates || []).slice().sort((a, b) => (a.start < b.start ? -1 : 1)), last = R[R.length - 1] || {};
    const every = /\b(a|per|each|every)\s+day\b|\bdaily\b/i.test(s) ? "day" : /\b(a|per|each|every)\s+fortnight\b|\bfortnightly\b/i.test(s) ? "fortnight" : /\b(a|per|each|every)\s+week\b|\/\s*wk\b|\bweekly\b/i.test(s) ? "week" : /\b(a|per|each|every)\s+month\b|\bmonthly\b/i.test(s) ? "month" : /\b(a|per|each|every)\s+quarter\b|\bquarterly\b/i.test(s) ? "quarter" : /\b(a|per|each|every)\s+year\b|\b(yearly|annually)\b/i.test(s) ? "year" : last.every || "month";
    let start = parseDate(s, o.today);
    if (!start && Kc && last.start) {                    // the next time it falls due after today
      const t = Kc.serial(o.today || new Date().toISOString().slice(0, 10));
      for (let n = 0; n < 20000; n++) { const d = Kc.nth(last.start, last.every, n); if (d > t) { start = Kc.isoOf(d); break; } }
    }
    return { name: k.name, amount, every, start: start || o.today, kind: k.kind };
  }
  const SheetChat = { route, parseDate, parseAmount, parseEntry, parseRate, constNamed };
  if (typeof module !== "undefined" && module.exports) { module.exports = SheetChat; return; }

  /* ================================================================== the page */
  const doc = root.document; if (!doc) return;
  const H = () => root.H3Sheet, X = () => root.H3Sheet && root.H3Sheet._, C = () => root.SheetCalc;
  const SHEET_RE = /\.(xlsx|xlsm|csv|tsv)$/i;
  let attachedAt = 0;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const money = (n) => "$" + (+n).toLocaleString("en-AU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? `${+m[3]}/${m[2]}/${m[1]}` : ""; };
  const today = () => { const t = new Date(); return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())).toISOString().slice(0, 10); };
  const dock = () => doc.getElementById("sheetdock");
  const onScreen = () => { const d = dock(); return !!d && !d.classList.contains("dockgone"); };
  /** the spreadsheet docker on screen (opened when it is not) */
  function show() { if (!onScreen() && typeof root.toggleDockGone === "function") root.toggleDockGone("sheetdock", "tX_sheetdock"); }
  /** ＋ / a drop on the prompt docker: a workbook opens in the spreadsheet */
  async function attach(file) {
    if (!file || !SHEET_RE.test(file.name || "")) return false;
    show();
    for (let i = 0; i < 40 && !(root.H3Sheet && root.H3SheetIO && H().St.booted !== undefined); i++) await new Promise((r) => setTimeout(r, 100));
    await root.H3SheetIO.importFile(file);
    attachedAt = Date.now();
    if (typeof root.chatAdd === "function") root.chatAdd("assistant", `▦ ${file.name} is open in the spreadsheet - say what to do with it: create a dashboard, format it, received a payment of …`);
    return true;
  }
  const isSheetFile = (f) => !!f && SHEET_RE.test(f.name || "");

  /* ------------------------------------------------------------------ a payment, shown first */
  let dlg = null, pending = null;
  const $ = (id) => doc.getElementById(id);
  function buildDlg() {
    dlg = doc.createElement("dialog"); dlg.id = "shEntryDlg"; dlg.className = "shfd";
    dlg.innerHTML = `<style>
      #shEntryDlg { padding: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--text); width: min(620px, 94vw); font-size: 12px; }
      #shEntryDlg::backdrop { background: rgba(0,0,0,.35); }
      #shEntryDlg .dh { display: flex; align-items: center; padding: 8px 12px; font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--line); }
      #shEntryDlg .dh button { margin-left: auto; }
      #shEntryDlg .db { padding: 10px 12px; display: grid; grid-template-columns: .9fr 1.6fr 1fr .8fr; gap: 6px 8px; align-items: end; }
      #shEntryDlg .db label { display: flex; flex-direction: column; gap: 3px; color: var(--dim); }
      #shEntryDlg .db input { width: 100%; box-sizing: border-box; }
      #shEntryDlg .kinds { grid-column: 1 / -1; display: flex; gap: 14px; align-items: center; }
      #shEntryDlg .kinds label { flex-direction: row; align-items: center; gap: 4px; color: var(--text); }
      #shEntryDlg .kinds input { width: auto; margin: 0; }
      #shEntryDlg .hint { grid-column: 1 / -1; color: var(--dim); margin: 0; }
      #shEntryDlg .df { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-top: 1px solid var(--line); }
      #shEntryDlg #sheMsg { margin-right: auto; color: var(--dim); }
      #shEntryDlg .shego { border-color: var(--tiger); color: var(--tiger); font-weight: 600; }
    </style>
    <div class="dh">➕ A ledger entry from the prompt<button class="ghost" type="button" data-x="1" aria-label="Close">✕</button></div>
    <div class="db">
      <label>Date<input type="date" id="sheDate"></label>
      <label>Description<input type="text" id="sheDesc" data-noi18n></label>
      <label>Category<input type="text" id="sheCat" list="sheCats" data-noi18n><datalist id="sheCats"></datalist></label>
      <label>Amount ($)<input type="number" id="sheAmt" step="0.01" min="0"></label>
      <div class="kinds"><label><input type="radio" name="sheKind" value="income"> Income (received)</label><label><input type="radio" name="sheKind" value="expense"> Expense (paid)</label></div>
      <p class="hint" id="sheWhere"></p>
    </div>
    <div class="df"><span id="sheMsg"></span><button type="button" class="ghost" data-x="1">Cancel</button><button type="button" class="ghost shego" id="sheAdd">✔ Add</button></div>`;
    doc.body.appendChild(dlg);
    dlg.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); addEntry(); } });
    dlg.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) { dlg.close(); X() && X().msg("➕ not added"); } });
    $("sheAdd").addEventListener("click", addEntry);
  }
  /** the categories already in the ledger + the constants' names */
  function categories() {
    const Kc = K(), out = new Set((H().W.constants || []).map((k) => k.name)), L = Kc.ledgerNow && Kc.ledgerNow();
    if (L && L.cols.category != null) { const b = H().book(); for (let r = L.r0; r <= L.r1; r++) { const v = b.get(L.si, L.cols.category, r); if (typeof v === "string" && v.trim()) out.add(v.trim()); } }
    return [...out];
  }
  function showEntry(e) {
    if (!dlg) buildDlg();
    pending = e;
    const Kc = K(), L = Kc.ledgerNow(), W = H().W;
    $("sheDate").value = e.iso; $("sheDesc").value = e.desc; $("sheCat").value = e.category || ""; $("sheAmt").value = e.amount;
    dlg.querySelector(`[name="sheKind"][value="${e.kind}"]`).checked = true;
    $("sheCats").innerHTML = categories().map((c) => `<option value="${esc(c)}">`).join("");
    const sheet = L ? W.sheets[L.si].name : "", rows = L ? L.r1 + 1 : 0;
    $("sheWhere").textContent = L ? `Into "${sheet}" in date order (it has ${rows} rows) - change anything first, then ✔ Add.` : `There is no ledger yet - a "Ledger" sheet is made for it.`;
    $("sheMsg").textContent = "";
    if (!dlg.open) { if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", ""); }
    setTimeout(() => $("sheAdd").focus(), 30);
  }
  /** ✔ Add: into the ledger (made when there is none), in date order - one undo step */
  function addEntry() {
    const Kc = K(), Hs = H(), I = X();
    const e = { iso: $("sheDate").value, desc: $("sheDesc").value.trim(), category: $("sheCat").value.trim(), amount: +$("sheAmt").value, kind: dlg.querySelector('[name="sheKind"]:checked').value };
    if (!Kc.serial(e.iso)) return ($("sheMsg").textContent = "✗ pick the date");
    if (!(e.amount > 0)) return ($("sheMsg").textContent = "✗ the amount");
    let L = Kc.ledgerNow();
    if (!L) { Kc.makeLedger(); Hs.St.book = null; L = Kc.ledgerNow(); }
    if (!L) return ($("sheMsg").textContent = "✗ no ledger");
    const k = { name: e.category, kind: e.kind, desc: e.desc || e.category };
    const res = Kc.apply(L, { add: [{ k, o: { iso: e.iso, serial: Kc.serial(e.iso), amount: e.amount }, ref: "" }], change: [], stale: [] }, { paidCol: false });
    dlg.close(); pending = null;
    Hs.W.active = L.si; Hs.St.book = null; I.tabs(); Hs.paint();
    const t = `➕ ${e.kind === "income" ? "Income" : "Expense"} ${money(e.amount)} · ${e.desc}${e.category ? " · " + e.category : ""} · ${dmy(e.iso)} added to "${Hs.W.sheets[L.si].name}" (Ctrl+Z takes it back)`;
    I.msg(t);
    if (typeof root.chatAdd === "function") root.chatAdd("assistant", t);
    return res;
  }

  /* ------------------------------------------------------------------ the route */
  const relevant = (t) => onScreen() || Date.now() - attachedAt < 30 * 60000 || /\b(spreadsheet|sheet|ledger|workbook|excel|csv|table)\b/i.test(t);
  /** core's chatSend asks this first: a reply (the message was for the spreadsheet) or null (an ordinary chat) */
  async function maybe(text) {
    const Hs = H(); if (!Hs || !X()) return null;
    const W = Hs.W, consts = W.constants || [], kind = route(text, consts);
    if (!kind) return null;
    const keeps = (W.ledger && W.ledger.sheet) || consts.length;
    if (!relevant(text) && !((kind === "entry" || kind === "rate" || kind === "update") && keeps)) return null;
    show();
    const I = X();
    if (kind === "entry") {
      const e = parseEntry(text, { consts, categories: categories(), today: today() });
      if (!e) return null;
      showEntry(e);
      return `➕ ${e.kind === "income" ? "Income (received)" : "Expense (paid)"} ${money(e.amount)} · ${e.desc}${e.category ? " · " + e.category : ""} · ${dmy(e.iso)} - shown in the spreadsheet: change it if you like, then ✔ Add.`;
    }
    if (kind === "rate") {
      const r = parseRate(text, { consts, today: today() }); if (!r) return null;
      root.H3SheetConst.open(); root.H3SheetConst.fill(r);
      return `📌 ${r.name}: ${money(r.amount)} a ${r.every} from ${dmy(r.start)} is filled in the Constants - press ＋ Add a new amount to ${r.name} (the dates before keep the old amount).`;
    }
    if (kind === "update") { root.H3SheetConst.open(); const P = root.H3SheetConst.preview(); return P ? `📌 ${P.add.length} new entr${P.add.length === 1 ? "y" : "ies"} to bring the ledger up to date - shown in the Constants: ✔ Apply puts them in.` : "📌 the Constants are open - add one first."; }
    if (kind === "constants") { root.H3SheetConst.open(); return "📌 the Constants are open in the spreadsheet."; }
    if (kind === "dashboard") {
      const ask = text.replace(/^\s*(please\s+)?(create|make|build|give me|show me|do)\s+(me\s+)?(a\s+|the\s+)?dashboard\s*(of|for|from|with|showing|about)?\s*/i, "").replace(/\b(please|thanks?)\b/gi, "").trim();
      let said = ""; const out = await root.H3SheetDash.run({ ask, llm: true, say: (t) => { said = t; I.msg(t); } });
      return out ? `✨ "${out.name}" built in the spreadsheet: ${out.made.join(", ")}.` : `✨ no dashboard: ${said || "no table found"}`;
    }
    if (kind === "format") { const r = root.H3SheetDash.formatData(); return r ? `▦ "${r.name}" formatted as a table: ${r.cols} columns, ${r.rows} rows - heading, number formats, widths, banded rows, a filter (Ctrl+Z takes it back).` : "▦ no table to format - a row of headings with data under it is needed."; }
    if (kind === "explain") { await root.H3SheetAI.openExplain(); return "💡 explained in the spreadsheet (the cell picked there)."; }
    if (kind === "fill") { const r = await root.H3SheetAI.fillFromExamples(); return r ? `🪄 ${r.n} cell${r.n === 1 ? "" : "s"} filled in the spreadsheet.` : "🪄 nothing filled - see the spreadsheet's status line."; }
    if (kind === "formula") { root.H3SheetAI.writeAsk(text); return "✍ the formula is being written in the spreadsheet - check its result there, then Put it in."; }
    return null;
  }
  root.H3ChatRoutes = (root.H3ChatRoutes || []).concat([maybe]);
  root.H3SheetChat = Object.assign({ maybe, attach, isSheetFile, showEntry, addEntry }, SheetChat);
})(typeof window !== "undefined" ? window : globalThis);
