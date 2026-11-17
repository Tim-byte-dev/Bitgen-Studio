/* bitGen Studio — ▦ Spreadsheet ✨ AI in the cells (2.825.0). Tim: "lets go next" (after 2.824.0's dashboard: the plan was
 * ✨ AI - write a formula from words, explain a formula, fill a column from examples).
 *
 *   ✍ Write a formula…        words -> the LLM (lib/sheetAi.js writeFormula; it sees the table's columns, not the rows)
 *                              -> the formula, worked out here before it goes in (its result shown, editable), Put it in /
 *                              + Fill down the table.
 *   💡 Explain this formula    each cell / range it reads with what is in it now (here, at once) + the LLM's plain words.
 *   🪄 Fill from examples      (Ctrl+E) type an example or two in a column of a table: bitGen looks for the rule itself
 *                              first (words of the row's other cells, the text before / after a mark like @ , - /, joined,
 *                              upper / lower / proper case, initials -
 *                              learn / apply) and fills the empty rows with values; when no rule of that kind fits, the
 *                              LLM writes a formula that is WORKED OUT FOR EVERY EXAMPLE before it is used (verify) -
 *                              tried twice; then the LLM fills the values (up to 200 rows), marked as its guess.
 * Every change is one undo step. The pure parts (region, header, columnsOf, learn, apply, verify, refsOf) run in Node too.
 */
(function (root) {
  "use strict";
  const CALC = () => root.SheetCalc || (typeof require === "function" ? require("./sheetcalc.js") : null);
  const filled = (v) => v != null && v !== "";

  /** the current region round (c, r): grown while a row / column next to it has something in it */
  function region(has, c, r) {
    const R = { r1: r, c1: c, r2: r, c2: c };
    for (let grew = true, n = 0; grew && n < 5000; n++) {
      grew = false;
      const rowHas = (y) => { for (let x = R.c1 - 1; x <= R.c2 + 1; x++) if (has(x, y)) return true; return false; };
      const colHas = (x) => { for (let y = R.r1 - 1; y <= R.r2 + 1; y++) if (has(x, y)) return true; return false; };
      if (R.r1 > 0 && rowHas(R.r1 - 1)) { R.r1--; grew = true; }
      if (rowHas(R.r2 + 1)) { R.r2++; grew = true; }
      if (R.c1 > 0 && colHas(R.c1 - 1)) { R.c1--; grew = true; }
      if (colHas(R.c2 + 1)) { R.c2++; grew = true; }
    }
    return R;
  }
  /** the table's heading row: its first row when every filled cell there is text and the row under it has something */
  function header(get, R) {
    if (R.r2 <= R.r1) return -1;
    let any = false;
    for (let c = R.c1; c <= R.c2; c++) { const v = get(c, R.r1); if (!filled(v)) continue; if (typeof v !== "string") return -1; any = true; }
    return any ? R.r1 : -1;
  }
  const kindOf = (vals, codes) => {
    const f = vals.filter(filled); if (!f.length) return "empty";
    const nums = f.filter((v) => typeof v === "number").length;
    if (nums >= f.length * 0.8) { const code = codes.find((x) => x && x !== "General") || ""; return /yy|dd|mmm/i.test(code) ? "dates" : /%/.test(code) ? "percent" : /[$€£¥]/.test(code) ? "money" : "numbers"; }
    if (f.every((v) => typeof v === "boolean")) return "TRUE / FALSE";
    return "text";
  };
  /** the columns the LLM is told about: letter, heading, kind, a few values (never every row) */
  function columnsOf(get, codeOf, R, head) {
    const C = CALC(), out = [], r0 = head >= 0 ? head + 1 : R.r1;
    for (let c = R.c1; c <= R.c2 && out.length < 40; c++) {
      const vals = [], codes = [];
      for (let r = r0; r <= R.r2 && vals.length < 400; r++) { vals.push(get(c, r)); codes.push(codeOf(c, r)); }
      const sample = [];
      for (let i = 0; i < vals.length && sample.length < 4; i++) if (filled(vals[i])) { const s = typeof vals[i] === "number" && C.format ? C.format(vals[i], codes[i]) : String(vals[i]); if (!sample.includes(s)) sample.push(s); }
      out.push({ col: C.colName(c), name: head >= 0 && filled(get(c, head)) ? String(get(c, head)) : "", kind: kindOf(vals, codes), sample });
    }
    return out;
  }

  /* ------------------------------------------------------------------ 🪄 fill: the rule found here */
  const WORD = /[0-9A-Za-zÀ-ɏ]+/g;
  const words = (s) => { const o = []; let m; WORD.lastIndex = 0; while ((m = WORD.exec(s))) o.push(m[0]); return o; };
  const T = {
    as: (s) => s, lo: (s) => s.toLowerCase(), up: (s) => s.toUpperCase(),
    pr: (s) => s.toLowerCase().replace(/(^|[^a-zÀ-ɏ])([a-zÀ-ɏ])/g, (m, a, b) => a + b.toUpperCase()),
    i1: (s) => s.slice(0, 1), iu: (s) => s.slice(0, 1).toUpperCase(), il: (s) => s.slice(0, 1).toLowerCase(),
  };
  const TK = Object.keys(T);
  const NUMERIC = /^[-+]?[$€£¥]?\d[\d,]*(\.\d+)?%?$|^[-+]?\.\d+$/;
  const piece = (p, ins) => {
    if (p.k === "c") return p.v;
    const s = String(ins[p.i] == null ? "" : ins[p.i]);
    if (p.k === "a") return s === "" ? null : T[p.f](s);
    if (p.k === "g") { const g = s.split(p.d), j = p.n < 0 ? g.length + p.n : p.n; if (g.length < 2 || j < 0 || j >= g.length) return null; const t = g[j].trim(); return t === "" ? null : T[p.f](t); }
    if (p.k === "d") { const j = p.o === "l" ? s.lastIndexOf(p.d) : s.indexOf(p.d); if (j < 0) return null; const t = p.s === "a" ? s.slice(j + 1) : s.slice(0, j); return t === "" ? null : T[p.f](t); }
    const w = words(s), j = p.n < 0 ? w.length + p.n : p.n;
    return j >= 0 && j < w.length ? T[p.f](w[j]) : null;
  };
  /** a program's output for one row's inputs (null = it does not apply to that row) */
  function apply(prog, ins) { let o = ""; for (const p of prog) { const x = piece(p, ins); if (x == null) return null; o += x; } return o; }
  /** a rule that gives every example: [{k: "c", v} | {k: "a", i, f} | {k: "w", i, n, f} | {k: "d", i, d (mark), o (first / last), s (after / before), f} | {k: "g", i, d, n (part between marks), f}]; null when there is none */
  function learn(examples) {
    const ex = (examples || []).filter((e) => e && filled(e.out)).map((e) => ({ ins: (e.ins || []).map((v) => (v == null ? "" : String(v))), out: String(e.out) }));
    if (!ex.length) return null;
    const first = ex[0], out = first.out, cands = [];   // cands[p] = pieces that match out at p
    for (let p = 0; p < out.length; p++) {
      const L = [];
      first.ins.forEach((s, i) => {
        if (!s) return;
        if (NUMERIC.test(s.trim())) { if (out.startsWith(s, p)) L.push({ k: "a", i, f: "as", len: s.length }); return; }   // a number is used whole, never cut into pieces
        for (const f of TK) { if (f[0] === "i") continue; const t = T[f](s); if (t && out.startsWith(t, p)) L.push({ k: "a", i, f, len: t.length }); }
        for (const d of new Set(s.replace(WORD, "").split(""))) for (const o of ["f", "l"]) for (const sd of ["a", "b"]) {   // the text before / after a mark (@ , - / …)
          const j = o === "l" ? s.lastIndexOf(d) : s.indexOf(d), part = sd === "a" ? s.slice(j + 1) : s.slice(0, j);
          if (part) for (const f of ["as", "lo", "up", "pr"]) { const t = T[f](part); if (out.startsWith(t, p)) L.push({ k: "d", i, d, o, s: sd, f, len: t.length }); }
        }
        for (const d of new Set(s.replace(WORD, "").replace(/ /g, "").split(""))) {   // a part between marks (12 High St, Perth, WA -> Perth)
          const g = s.split(d);
          g.forEach((x, j) => { const t0 = x.trim(); if (!t0) return; for (const f of ["as", "lo", "up", "pr"]) { const t = T[f](t0); if (out.startsWith(t, p)) { L.push({ k: "g", i, d, n: j, f, len: t.length }); L.push({ k: "g", i, d, n: j - g.length, f, len: t.length }); } } });
        }
        const w = words(s);
        w.forEach((x, j) => { for (const f of TK) { if (f[0] === "i" && !/^[^\d]/.test(x)) continue; const t = T[f](x); if (t && out.startsWith(t, p)) { L.push({ k: "w", i, n: j, f, len: t.length }); if (j === w.length - 1 || j > 0) L.push({ k: "w", i, n: j - w.length, f, len: t.length }); } } });
      });
      const RANK = { a: 0, w: 1, g: 2, d: 3 };
      const ends = (x) => (x.n == null || x.n === 0 || x.n === -1 ? 0 : 1);   // a tie: the first / last word before "word 5"
      L.sort((a, b) => b.len - a.len || RANK[a.k] - RANK[b.k] || ends(a) - ends(b));
      cands.push(L);
    }
    let visits = 0, best = null;
    const numOut = ex.every((e) => NUMERIC.test(e.out.trim()));   // a number typed: no digits made up (7.5 is not "7." + Units)
    const fits = (prog) => !(numOut && prog.some((x) => x.k === "c" && /\d/.test(x.v))) && ex.every((e) => apply(prog, e.ins) === e.out);
    const score = (prog) => prog.reduce((s, p) => s + (p.k === "c" ? p.v.length * 3 : 1), 0);
    (function dfs(p, prog) {
      if (++visits > 40000 || (best && score(prog) >= best.s)) return;
      if (p >= out.length) { if (prog.some((x) => x.k !== "c") && fits(prog)) best = { prog: prog.map((x) => Object.assign({}, x)), s: score(prog) }; return; }
      for (const c of cands[p]) { prog.push(Object.assign({}, c)); dfs(p + c.len, prog); prog.pop(); }
      const last = prog[prog.length - 1];                // a character that comes from no cell: kept as it is
      if (last && last.k === "c") { last.v += out[p]; dfs(p + 1, prog); last.v = last.v.slice(0, -1); }
      else { prog.push({ k: "c", v: out[p] }); dfs(p + 1, prog); prog.pop(); }
    })(0, []);
    return best ? best.prog.map((x) => { const o = Object.assign({}, x); delete o.len; return o; }) : null;
  }
  /** words for a rule, e.g. first word of B (Proper) + " " + last word of B */
  function describe(prog, names) {
    const F = { as: "", lo: " (lower case)", up: " (UPPER CASE)", pr: " (Proper Case)", i1: " - its first letter", iu: " - its first letter, capital", il: " - its first letter, small" };
    const nth = (n) => (n === -1 ? "last word" : n < 0 ? `word ${-n} from the end` : ["first word", "second word", "third word"][n] || `word ${n + 1}`);
    return prog.map((p) => (p.k === "c" ? JSON.stringify(p.v) : (p.k === "a" ? names[p.i] : p.k === "d" ? `${names[p.i]} ${p.s === "a" ? "after" : "before"} its ${p.o === "l" ? "last" : "first"} ${JSON.stringify(p.d)}` : p.k === "g" ? `part ${p.n < 0 ? (p.n === -1 ? "last" : -p.n + " from the end") : p.n + 1} of ${names[p.i]} between ${JSON.stringify(p.d)}` : `${nth(p.n)} of ${names[p.i]}`) + F[p.f])).join(" + ");
  }

  /* ------------------------------------------------------------------ a formula checked against the examples */
  const same = (got, want) => {
    const C = CALC();
    if (got && typeof got === "object" && got.err) return false;
    const w = C.parseInput(String(want)).value;
    if (typeof w === "number") { const g = typeof got === "number" ? got : C.parseInput(String(got)).value; return typeof g === "number" && Math.abs(g - w) <= 1e-9 * Math.max(1, Math.abs(w)) + (String(want).includes(".") ? Math.pow(10, -String(want).split(".")[1].replace(/\D.*/, "").length) / 2 : 0); }
    if (typeof w === "boolean") return got === w;
    return String(got == null ? "" : got).trim() === String(want).trim();
  };
  /** the formula (written for row r0) worked out in every example's row: {ok, failed: [{row, got, want}]} */
  function verify(formula, r0, examples, evalAt) {
    const C = CALC(), failed = [];
    for (const e of examples) {
      const f = C.shiftFormula(formula, e.r - r0, 0), got = evalAt(f, e.r);
      if (!same(got, e.out)) failed.push({ row: e.r + 1, formula: f, got: got && got.err ? got.err : got, want: e.out });
    }
    return { ok: !failed.length, failed };
  }
  /** the cells / ranges a formula reads: ["B2", "Sheet2!A1:A9", …] (once each) */
  function refsOf(formula) {
    const C = CALC(); let T0;
    try { T0 = C.tokenize(String(formula).replace(/^=/, "")); } catch (e) { return []; }
    const o = [];
    for (const t of T0) if (t.t === "ref") { const k = (t.sheet ? (/^[A-Za-z_]\w*$/.test(t.sheet) ? t.sheet : `'${t.sheet}'`) + "!" : "") + String(t.v).replace(/\$/g, ""); if (!o.includes(k)) o.push(k); }
    return o;
  }

  const SheetAI = { region, header, columnsOf, learn, apply, describe, verify, refsOf, words, same };
  if (typeof module !== "undefined" && module.exports) { module.exports = SheetAI; return; }

  /* ================================================================== the page */
  const doc = root.document; if (!doc) return;
  const H = () => root.H3Sheet, X = () => root.H3Sheet && root.H3Sheet._;
  const say = (t, bad) => X() && X().msg(t, bad);
  const getter = () => { const Hs = H(), si = Hs.W.active; return (c, r) => Hs.book().get(si, c, r); };
  const codeAt = () => { const I = X(); return (c, r) => { const cl = I.cellAt(c, r); return cl ? I.codeOf(cl) : "General"; }; };
  async function post(url, body, signal) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
    return j;
  }
  /** what the LLM is told: the table round the cell (or the sheet's used block), the cell, the other sheets */
  function contextFor(c, r) {
    const C = CALC(), Hs = H(), I = X(), get = getter(), S = I.sh();
    const has = (x, y) => x >= 0 && y >= 0 && filled(get(x, y));
    let R = region(has, c, r);
    if (R.r1 === R.r2 && R.c1 === R.c2 && !has(c, r)) {     // an empty cell on its own: the table just above it / left of it (a gap of up to 2)
      const near = [[c - 1, r], [c, r - 1], [c, r - 2], [c, r - 3], [c - 2, r], [c - 3, r]].find(([x, y]) => has(x, y));   // a total under a table, a sum beside it
      if (near) { R = region(has, near[0], near[1]); R.c2 = Math.max(R.c2, c); R.r2 = Math.max(R.r2, r); }
    }
    const head = header(get, R);
    return { R, head, ctx: {
      sheet: S.name, sheets: Hs.W.sheets.map((s) => s.name),
      table: `${C.addr(R.c1, R.r1)}:${C.addr(R.c2, R.r2)}`, header: head >= 0 ? head + 1 : 0, rows: head >= 0 ? `${head + 2}-${R.r2 + 1}` : `${R.r1 + 1}-${R.r2 + 1}`,
      cols: columnsOf(get, codeAt(), R, head), cell: C.addr(c, r), col: C.colName(c), cellHeading: head >= 0 && head < r && filled(get(c, head)) ? String(get(c, head)) : "",
    } };
  }
  /** a formula's value in (c, r) without touching the sheet */
  function evalIn(c) {
    const C = CALC(), Hs = H(), si = Hs.W.active;
    return (formula, r) => {
      const sheets = Hs.W.sheets.slice(), S = sheets[si], k = C.addr(c, r);
      sheets[si] = Object.assign({}, S, { cells: Object.assign({}, S.cells, { [k]: Object.assign({}, S.cells[k] || {}, { v: formula }) }) });
      try { return new C.Book(sheets).get(si, c, r); } catch (e) { return { err: "#VALUE!" }; }
    };
  }
  const shown = (v) => (v && v.err ? v.err : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : typeof v === "number" ? String(+v.toPrecision(12)) : String(v == null ? "" : v));

  /* ------------------------------------------------------------------ the dialog (✍ write / 💡 explain) */
  let dlg = null, mode = "", at = null, abort = null;
  const $ = (id) => doc.getElementById(id);
  function buildDlg() {
    dlg = doc.createElement("dialog"); dlg.id = "shAiDlg"; dlg.className = "shfd";
    dlg.innerHTML = `<style>
      #shAiDlg { padding: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--text); width: min(560px, 94vw); font-size: 12px; }
      #shAiDlg::backdrop { background: rgba(0,0,0,.45); }
      #shAiDlg .dh { display: flex; align-items: center; padding: 8px 12px; font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--line); }
      #shAiDlg .dh button { margin-left: auto; }
      #shAiDlg .db { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
      #shAiDlg .hint { color: var(--dim); line-height: 1.45; margin: 0; }
      #shAiDlg textarea { width: 100%; min-height: 54px; font-size: 12px; box-sizing: border-box; }
      #shAiDlg #shaiF { width: 100%; box-sizing: border-box; font-family: monospace; font-size: 12px; }
      #shAiDlg .res { font-family: monospace; padding: 4px 6px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel-2, rgba(0,0,0,.15)); min-height: 18px; white-space: pre-wrap; }
      #shAiDlg .res.bad { color: #ff6b6b; }
      #shAiDlg #shaiRefs { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-family: monospace; max-height: 140px; overflow: auto; }
      #shAiDlg #shaiText { line-height: 1.5; white-space: pre-wrap; }
      #shAiDlg .df { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-top: 1px solid var(--line); flex-wrap: wrap; }
      #shAiDlg #shaiMsg { margin-right: auto; color: var(--dim); }
      #shAiDlg .shaigo { border-color: var(--tiger); color: var(--tiger); font-weight: 600; }
      #shAiDlg .lbl { color: var(--dim); font-weight: 600; margin-top: 2px; }
      #shAiDlg [hidden] { display: none !important; }
    </style>
    <div class="dh"><span id="shaiTitle">✍ Write a formula</span><button class="ghost" type="button" data-x="1" aria-label="Close">✕</button></div>
    <div class="db">
      <div id="shaiAskBox"><div>What should it work out?</div>
        <textarea id="shaiAsk" placeholder="e.g. the total of Amount where Region is North, the price with 10% tax, how many days late each invoice is"></textarea>
        <p class="hint">The LLM is told the table's columns - their headings, what they hold and a few values - not every row.</p></div>
      <div id="shaiOut" hidden>
        <div>Formula for <b id="shaiCell" data-noi18n></b> (you can change it)</div>
        <input type="text" id="shaiF" spellcheck="false" data-noi18n>
        <div class="res" id="shaiRes" data-noi18n></div><div class="hint" id="shaiResWhy" style="color:#ff6b6b" hidden></div>
        <p class="hint" id="shaiWhy" data-noi18n></p>
        <label id="shaiDownBox" hidden><input type="checkbox" id="shaiDown"> <span id="shaiDownL">Fill down the table's rows</span></label>
      </div>
      <div id="shaiExplain" hidden>
        <div class="res" id="shaiFx" data-noi18n></div>
        <div class="lbl">What it reads now</div><div id="shaiRefs" data-noi18n></div>
        <div class="lbl">In plain words</div><div id="shaiText" data-noi18n></div>
      </div>
    </div>
    <div class="df"><span id="shaiMsg"></span><button type="button" class="ghost" data-x="1">Close</button>
      <button type="button" class="ghost shaigo" id="shaiGo">✨ Write it</button><button type="button" class="ghost shaigo" id="shaiPut" hidden>Put it in</button></div>`;
    doc.body.appendChild(dlg);
    dlg.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && e.target.id === "shaiAsk" && !e.shiftKey) { e.preventDefault(); write(); } });
    dlg.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) close(); });
    dlg.addEventListener("close", () => { if (abort) abort.abort(); abort = null; });
    $("shaiGo").addEventListener("click", write);
    $("shaiPut").addEventListener("click", put);
    $("shaiF").addEventListener("input", preview);
  }
  function msg(t, bad) { const m = $("shaiMsg"); if (m) { m.textContent = t || ""; m.style.color = bad ? "#ff6b6b" : "var(--dim)"; } }
  function close() { if (dlg && dlg.open) dlg.close(); }
  function show(m) {
    if (!dlg) buildDlg();
    mode = m; msg("");
    $("shaiTitle").textContent = m === "explain" ? "💡 Explain this formula" : "✍ Write a formula";
    $("shaiAskBox").hidden = m !== "write"; $("shaiExplain").hidden = m !== "explain"; $("shaiOut").hidden = true;
    $("shaiGo").hidden = m !== "write"; $("shaiPut").hidden = true;
    if (!dlg.open) { if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", ""); }
  }
  /** rows under the cell that the table goes on to (for Fill down): its last row, or -1 */
  function downTo(c, r) {
    const { R, head } = contextFor(c, r);
    return R.r2 > r && (head < 0 || r > head) ? R.r2 : -1;
  }
  function openWrite() {
    const Hs = H(), I = X(); if (!Hs || !I) return;
    if (I.guardSheet()) return;
    at = { c: Hs.St.act.c, r: Hs.St.act.r };
    show("write");
    const ask = $("shaiAsk"); ask.value = ""; setTimeout(() => ask.focus(), 30);
    msg(`for ${CALC().addr(at.c, at.r)}`);
  }
  async function write() {
    const words = $("shaiAsk").value.trim(); if (!words) return msg("say what it should work out", true);
    const btn = $("shaiGo"); if (btn.disabled) return;
    btn.disabled = true; msg("✨ the LLM is writing the formula …");
    if (abort) abort.abort(); abort = new AbortController();
    try {
      const { ctx } = contextFor(at.c, at.r);
      const j = await post("/api/sheets/ai/formula", { context: ctx, ask: words, functions: CALC().FUNCS }, abort.signal);
      $("shaiOut").hidden = false; $("shaiPut").hidden = false;
      $("shaiCell").textContent = CALC().addr(at.c, at.r);
      $("shaiF").value = j.formula; $("shaiWhy").textContent = j.explain || "";
      const to = downTo(at.c, at.r);
      $("shaiDownBox").hidden = to < 0; $("shaiDown").checked = to >= 0 && /[A-Z]+\$?\d/.test(j.formula.replace(/"[^"]*"/g, "")) && !/:/.test(j.formula.replace(/"[^"]*"/g, ""));
      const last = to + 1; $("shaiDownL").textContent = `Fill down the table's rows (to row ${last})`;
      $("shaiPut").textContent = `Put it in ${CALC().addr(at.c, at.r)}`;
      preview(); msg("");
    } catch (e) { if (e.name !== "AbortError") msg("✗ " + (e.message || e), true); }
    finally { btn.disabled = false; }
  }
  function preview() {
    const f = $("shaiF").value.trim(), res = $("shaiRes");
    if (!f) { res.textContent = ""; return; }
    const v = evalIn(at.c)(f[0] === "=" ? f : "=" + f, at.r), bad = !!(v && v.err);
    res.textContent = "= " + shown(v); res.classList.toggle("bad", bad);
    const why = $("shaiResWhy"); why.hidden = !bad; why.textContent = !bad ? "" : v.err === "#NAME?" ? "a function bitGen does not have, or a typing slip" : "an error: check the cells it reads";
  }
  function put() {
    const I = X(), Hs = H(), C = CALC(); let f = $("shaiF").value.trim();
    if (!f) return;
    if (f[0] !== "=") f = "=" + f;
    if (I.guardSheet()) return;
    const to = !$("shaiDownBox").hidden && $("shaiDown").checked ? downTo(at.c, at.r) : -1;
    I.step();
    Hs.setRaw(at.c, at.r, f);
    let n = 1;
    for (let r = at.r + 1; r <= to; r++) { Hs.setRaw(at.c, r, C.shiftFormula(f, r - at.r, 0)); n++; }
    I.changed(); close();
    I.msg(`✍ ${C.addr(at.c, at.r)}` + (n > 1 ? ` + ${n - 1} rows below` : "") + `: ${f}`);
    return n;
  }

  async function openExplain() {
    const Hs = H(), I = X(), C = CALC(); if (!Hs || !I) return;
    at = { c: Hs.St.act.c, r: Hs.St.act.r };
    const cl = I.cellAt(at.c, at.r), f = cl && typeof cl.v === "string" && cl.v[0] === "=" ? cl.v : "";
    if (!f) return say(`${C.addr(at.c, at.r)} has no formula to explain - pick a cell with one (it starts with =)`, true);
    show("explain");
    const get = getter(), book = Hs.book(), si = Hs.W.active;
    $("shaiFx").textContent = `${C.addr(at.c, at.r)}  ${f}  →  ${shown(get(at.c, at.r))}`;
    const vals = [];
    const rows = refsOf(f).slice(0, 30).map((ref) => {
      let v;
      try {
        const m = /^(?:'?(.+?)'?!)?(.+)$/.exec(ref), s2 = m[1] ? book.sheetIndex(m[1]) : si, [a, b] = m[2].split(":");
        if (s2 < 0) v = "#REF!";
        else if (!b) v = shown(book.value(s2, a));
        else { const p = C.parseAddr(a), q = C.parseAddr(b); let n = 0, sum = 0, cnt = 0; const sh = Hs.W.sheets[s2], last = Math.min(q.r, p.r + 5000);
          for (let y = p.r; y <= last; y++) for (let x = p.c; x <= q.c; x++) { if (!sh.cells[C.addr(x, y)]) continue; const z = book.get(s2, x, y); if (filled(z)) { n++; if (typeof z === "number") { sum += z; cnt++; } } }
          v = `${n} filled cell${n === 1 ? "" : "s"}` + (cnt ? `, numbers adding up to ${+sum.toPrecision(12)}` : ""); }
      } catch (e) { v = "?"; }
      vals.push({ ref, value: v });
      return `<span>${ref}</span><span>${String(v).replace(/[&<]/g, (x) => (x === "&" ? "&amp;" : "&lt;"))}</span>`;
    });
    $("shaiRefs").innerHTML = rows.join("") || "<span>-</span><span>nothing - it reads no cells</span>";
    const txt = $("shaiText"); txt.textContent = "";
    msg("💡 the LLM is reading it …");
    if (abort) abort.abort(); abort = new AbortController();
    try {
      const { ctx } = contextFor(at.c, at.r); ctx.result = shown(get(at.c, at.r));
      const j = await post("/api/sheets/ai/explain", { context: ctx, formula: f, values: vals }, abort.signal);
      txt.textContent = j.text; msg("");
    } catch (e) { if (e.name !== "AbortError") { txt.textContent = ""; msg("✗ the LLM: " + (e.message || e) + " - what it reads is above", true); } }
  }

  /* ------------------------------------------------------------------ 🪄 Fill from examples */
  let filling = false;
  async function fillFromExamples(o) {
    o = o || {};
    const Hs = H(), I = X(), C = CALC(); if (!Hs || !I || filling) return null;
    if (I.guardSheet()) return null;
    const c = Hs.St.act.c, get = getter(), has = (x, y) => x >= 0 && y >= 0 && filled(get(x, y));
    let R = region(has, c, Hs.St.act.r);
    if (R.c1 === R.c2) { const left = [Hs.St.act.r, Hs.St.act.r - 1].find((y) => has(c - 1, y)); if (left != null) { const L = region(has, c - 1, left); R = { r1: Math.min(R.r1, L.r1), r2: Math.max(R.r2, L.r2), c1: L.c1, c2: Math.max(L.c2, c) }; } }
    const head = header(get, R), r0 = head >= 0 ? head + 1 : R.r1;
    const inCols = []; for (let x = R.c1; x <= R.c2; x++) if (x !== c) inCols.push(x);
    if (!inCols.length) { say("🪄 Fill from examples needs a table: the column to fill beside columns that have something in them", true); return null; }
    const raw = (x, y) => { const cl = I.cellAt(x, y); return cl && cl.v != null ? String(cl.v) : ""; };
    const rowIns = (y) => inCols.map((x) => { const v = get(x, y); return filled(v) ? (typeof v === "number" ? C.format(v, I.codeOf(I.cellAt(x, y) || {})) : String(v)) : ""; });
    const examples = [], empty = [];
    for (let y = r0; y <= R.r2; y++) {
      const any = inCols.some((x) => has(x, y)); if (!any) continue;
      const t = raw(c, y);
      if (t !== "" && t[0] !== "=") examples.push({ r: y, ins: rowIns(y), out: t });
      else if (t === "") empty.push(y);
    }
    if (!examples.length) { say(`🪄 type what ${C.colName(c)}${r0 + 1} should hold (one or two examples), then Fill from examples again`, true); return null; }
    if (!empty.length) { say("🪄 nothing to fill - every row of the column has something in it already"); return null; }
    const names = inCols.map((x) => (head >= 0 && filled(get(x, head)) ? `"${get(x, head)}"` : C.colName(x)));
    const write = (vals, how) => {
      I.step(); let n = 0;
      for (const [y, v] of vals) { if (v == null || v === "") continue; Hs.setRaw(c, y, v); n++; }
      I.changed(); I.msg(`🪄 ${n} cell${n === 1 ? "" : "s"} of ${C.colName(c)} filled ${how}`); return n;
    };
    // 1. the rule, found here
    const prog = o.llmOnly ? null : learn(examples);
    if (prog) {
      const vals = empty.map((y) => [y, apply(prog, rowIns(y))]), miss = vals.filter((v) => v[1] == null).length;
      const n = write(vals, `from your example${examples.length > 1 ? "s" : ""}: ${describe(prog, names)}` + (miss ? ` (${miss} row${miss === 1 ? "" : "s"} left empty - the rule did not fit them)` : ""));
      return { how: "rule", n, prog };
    }
    if (o.llm === false) { say("🪄 no rule of joined words / letters fits the examples - with the LLM it can try a formula", true); return null; }
    // 2. a formula by the LLM, worked out for every example first
    filling = true;
    try {
      const { ctx } = contextFor(c, examples[0].r);
      ctx.col = C.colName(c); ctx.cellHeading = head >= 0 && filled(get(c, head)) ? String(get(c, head)) : "";
      const cells = (y) => { const m = {}; inCols.forEach((x, i) => { const v = rowIns(y)[i]; if (v !== "") m[C.colName(x)] = v; }); return m; };
      const ex = examples.slice(0, 30).map((e) => ({ row: e.r + 1, cells: cells(e.r), out: e.out }));
      const evalAt = evalIn(c);
      let failed = [];
      for (let t = 0; t < 2; t++) {
        say(t ? "🪄 ✨ the LLM is looking for the rule again …" : "🪄 ✨ the LLM is looking for the rule …");
        let j; try { j = await post("/api/sheets/ai/fill", { context: ctx, examples: ex, failed, functions: C.FUNCS }); } catch (e) { say("🪄 ✗ the LLM: " + (e.message || e), true); return null; }
        const v = verify(j.formula, examples[0].r, examples, evalAt);
        if (v.ok) {
          const vals = empty.map((y) => [y, C.shiftFormula(j.formula, y - examples[0].r, 0)]);
          const n = write(vals, `with a formula that gives every example: ${j.formula}` + (j.explain ? ` - ${j.explain}` : ""));
          return { how: "formula", n, formula: j.formula };
        }
        failed = v.failed;
      }
      // 3. the values, by the LLM (marked as its guess)
      say("🪄 ✨ no formula gave every example - the LLM is filling the values …");
      const rows = empty.slice(0, 200).map((y) => ({ row: y + 1, cells: cells(y) }));
      let j; try { j = await post("/api/sheets/ai/fillvalues", { context: ctx, examples: ex, rows }); } catch (e) { say("🪄 ✗ the LLM: " + (e.message || e), true); return null; }
      const vals = empty.slice(0, 200).map((y) => [y, j.values[String(y + 1)]]);
      const n = write(vals, "by the LLM following your examples - its guess, check them" + (empty.length > 200 ? ` (the first 200 empty rows)` : ""));
      return { how: "values", n };
    } finally { filling = false; }
  }

  function aiMenu(btn) {
    const I = X(); if (!I) return;
    const r = btn.getBoundingClientRect();
    const m = I.menu(r.left, r.bottom + 2, `<div data-ai="write">✍ Write a formula…</div><div data-ai="explain">💡 Explain this formula</div><div data-ai="fill">🪄 Fill from examples (Ctrl+E)</div>`);
    m.addEventListener("click", (e) => { const t = e.target.closest("[data-ai]"); if (!t) return; m.remove(); run(t.dataset.ai); });
  }
  function run(what) { if (what === "write") return openWrite(); if (what === "explain") return openExplain(); if (what === "fill") return fillFromExamples(); }
  /** 2.828.0: ✍ from the prompt docker - the dialog opened for the active cell with the words asked, the LLM asked */
  function writeAsk(text) { openWrite(); if (!dlg || !dlg.open) return; $("shaiAsk").value = String(text || "").trim(); return write(); }
  root.H3SheetAI = Object.assign({ writeAsk, openWrite, openExplain, fillFromExamples, aiMenu, run, put, contextFor }, SheetAI);
})(typeof window !== "undefined" ? window : globalThis);
