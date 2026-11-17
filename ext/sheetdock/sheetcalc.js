/* ext/sheetdock/sheetcalc.js — ▦ SPREADSHEET (2.822.0): THE FORMULA ENGINE, window.SheetCalc (pure - Node tests:
 * scripts/test-sheet822.js). Our own (no library): Tim: "continue with the spreadsheet please" - the agreed plan's formula
 * engine.
 *
 *   ADDRESSES   colName(0) = "A", colIndex("AB") = 27, addr(c, r) = "B3" (0-based in, 1-based row out), parseAddr("$B$3")
 *   FORMULAS    "=…": numbers, "strings", TRUE / FALSE, A1 / $A$1 / A1:B9 / A:A / 1:1 / Sheet2!A1 / 'My sheet'!A1:B2,
 *               + - * / ^ & = <> < > <= >=, unary -, postfix %, functions (FUNCS below); errors #REF! #DIV/0! #NAME?
 *               #VALUE! #N/A #NUM! and #CYCLE! (a formula that needs itself)
 *   Book        new Book(sheets) - sheets = [{name, cells: {A1: {v: "raw"}}}]; value(sheet, "A1"), recalc(), the values
 *               of every cell computed once per recalc (memo, cycles caught)
 *   shiftFormula(text, dr, dc)   the relative references moved (fill / copy-paste); a reference off the sheet = #REF!
 *   parseInput(text)             what a typed entry is: {value, fmt?} - "12%" = 0.12 + percent, "$1,200" = 1200 +
 *                                currency, "2026-11-17" = a date serial + date, TRUE / FALSE
 *   format(value, fmt)           general / number / currency / percent / date / text -> the words shown
 */
(function (root) {
  "use strict";
  /* ================================ addresses ================================ */
  const colName = (c) => { let s = "", n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const colIndex = (s) => { let n = 0; for (const ch of String(s).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const addr = (c, r) => colName(c) + (r + 1);
  function parseAddr(a) {
    const m = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})$/.exec(String(a || "").trim());
    return m ? { c: colIndex(m[2]), r: +m[4] - 1, ac: !!m[1], ar: !!m[3] } : null;
  }
  const MAXR = 1048576, MAXC = 16384;

  /* ================================ errors / values ================================ */
  const ERR = (e) => ({ err: e });
  const isErr = (v) => !!(v && typeof v === "object" && v.err);
  const ERRS = ["#REF!", "#DIV/0!", "#NAME?", "#VALUE!", "#N/A", "#NUM!", "#CYCLE!", "#NULL!"];
  const EPOCH = Date.UTC(1899, 11, 30);
  const serialOf = (y, m, d) => (Date.UTC(y, m - 1, d) - EPOCH) / 86400000;
  const dateOf = (n) => new Date(EPOCH + Math.round(n * 86400000));

  /* ================================ the tokenizer ================================ */
  function tokenize(src) {
    const s = String(src), T = []; let i = 0;
    const REF = /^(?:(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_.]*))!)?(\$?[A-Za-z]{1,3}\$?[0-9]{1,7}(?::\$?[A-Za-z]{1,3}\$?[0-9]{1,7})?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?[0-9]{1,7}:\$?[0-9]{1,7})(?![A-Za-z0-9_(])/;
    while (i < s.length) {
      const ch = s[i], rest = s.slice(i);
      if (/\s/.test(ch)) { i++; continue; }
      let m;
      if (!/^\$?[0-9]+:\$?[0-9]+/.test(rest) && (m = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(rest))) { T.push({ t: "num", v: parseFloat(m[0]), at: i, len: m[0].length }); i += m[0].length; continue; }
      if (ch === '"') { let j = i + 1, v = ""; while (j < s.length) { if (s[j] === '"') { if (s[j + 1] === '"') { v += '"'; j += 2; continue; } break; } v += s[j++]; } if (j >= s.length) throw ERR("#VALUE!"); T.push({ t: "str", v, at: i, len: j + 1 - i }); i = j + 1; continue; }
      if (ch === "#") { const e = ERRS.find((x) => rest.toUpperCase().startsWith(x)); if (e) { T.push({ t: "err", v: e, at: i, len: e.length }); i += e.length; continue; } }
      if ((m = REF.exec(rest))) { T.push({ t: "ref", v: m[3], sheet: m[1] != null ? m[1].replace(/''/g, "'") : m[2] || null, at: i, len: m[0].length, refAt: i + m[0].length - m[3].length }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest))) {
        const w = m[0], up = w.toUpperCase(), after = s.slice(i + w.length).match(/^\s*\(/);
        if (after) { T.push({ t: "fn", v: up, at: i, len: w.length }); i += w.length; continue; }
        if (up === "TRUE" || up === "FALSE") { T.push({ t: "bool", v: up === "TRUE", at: i, len: w.length }); i += w.length; continue; }
        T.push({ t: "name", v: w, at: i, len: w.length }); i += w.length; continue;
      }
      if ((m = /^(<>|<=|>=|[-+*/^&=<>%(),;:])/.exec(rest))) { T.push({ t: "op", v: m[0] === ";" ? "," : m[0], at: i, len: m[0].length }); i += m[0].length; continue; }
      throw ERR("#NAME?");
    }
    return T;
  }

  /* ================================ the parser (Pratt) ================================ */
  const BIN = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };
  function parse(src) {
    const T = tokenize(src); let p = 0;
    const peek = () => T[p], next = () => T[p++];
    const expect = (v) => { const t = next(); if (!t || t.t !== "op" || t.v !== v) throw ERR("#NAME?"); };
    function primary() {
      const t = next(); if (!t) throw ERR("#NAME?");
      if (t.t === "num") return { k: "num", v: t.v };
      if (t.t === "str") return { k: "str", v: t.v };
      if (t.t === "bool") return { k: "bool", v: t.v };
      if (t.t === "err") return { k: "err", v: t.v };
      if (t.t === "ref") return refNode(t);
      if (t.t === "name") return { k: "name", v: t.v };
      if (t.t === "fn") {
        expect("("); const args = [];
        if (!(peek() && peek().t === "op" && peek().v === ")")) {
          for (;;) {
            if (peek() && peek().t === "op" && (peek().v === "," || peek().v === ")")) args.push({ k: "blank" }); else args.push(expr(0));
            const n = next(); if (!n || n.t !== "op") throw ERR("#NAME?");
            if (n.v === ")") break; if (n.v !== ",") throw ERR("#NAME?");
          }
        } else next();
        return { k: "fn", v: t.v, args };
      }
      if (t.t === "op" && t.v === "(") { const e = expr(0); expect(")"); return e; }
      if (t.t === "op" && (t.v === "-" || t.v === "+")) { const e = expr(6); return t.v === "-" ? { k: "neg", e } : e; }
      throw ERR("#NAME?");
    }
    function expr(min) {
      let left = primary();
      for (;;) {
        const t = peek(); if (!t || t.t !== "op") break;
        if (t.v === "%") { next(); left = { k: "pct", e: left }; continue; }
        const pr = BIN[t.v]; if (!pr || pr < min) break;
        next();
        const right = expr(pr + 1);                     // left to right, ^ too (2^3^2 = 64, as in other spreadsheets)
        left = { k: "bin", op: t.v, a: left, b: right };
      }
      return left;
    }
    const e = expr(0);
    if (p < T.length) throw ERR("#NAME?");
    return e;
  }
  function refNode(t) {
    const v = t.v.replace(/\$/g, "");
    if (/^[A-Za-z]+:[A-Za-z]+$/.test(v)) { const [a, b] = v.split(":"); return { k: "range", sheet: t.sheet, c1: Math.min(colIndex(a), colIndex(b)), r1: 0, c2: Math.max(colIndex(a), colIndex(b)), r2: MAXR - 1 }; }
    if (/^[0-9]+:[0-9]+$/.test(v)) { const [a, b] = v.split(":").map((x) => +x - 1); return { k: "range", sheet: t.sheet, c1: 0, r1: Math.min(a, b), c2: MAXC - 1, r2: Math.max(a, b) }; }
    const [x, y] = v.split(":"), A = parseAddr(x);
    if (!y) return { k: "ref", sheet: t.sheet, c: A.c, r: A.r };
    const B = parseAddr(y);
    return { k: "range", sheet: t.sheet, c1: Math.min(A.c, B.c), r1: Math.min(A.r, B.r), c2: Math.max(A.c, B.c), r2: Math.max(A.r, B.r) };
  }

  /* ================================ values ================================ */
  function num(v) {
    if (isErr(v)) throw v;
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    const s = String(v).trim().replace(/,/g, ""), n = Number(s.replace(/^\$/, "").replace(/%$/, ""));
    if (s !== "" && !isNaN(n)) return /%$/.test(s) ? n / 100 : n;
    throw ERR("#VALUE!");
  }
  const str = (v) => { if (isErr(v)) throw v; if (v == null) return ""; if (typeof v === "boolean") return v ? "TRUE" : "FALSE"; if (typeof v === "number") return fmtGeneral(v); return String(v); };
  const bool = (v) => { if (isErr(v)) throw v; if (typeof v === "boolean") return v; if (typeof v === "number") return v !== 0; if (v == null || v === "") return false; const u = String(v).toUpperCase(); if (u === "TRUE") return true; if (u === "FALSE") return false; throw ERR("#VALUE!"); };
  function fmtGeneral(n) {
    if (!isFinite(n)) return "#NUM!";
    if (Number.isInteger(n)) return String(n);
    const a = Math.abs(n);
    if (a !== 0 && (a < 1e-9 || a >= 1e15)) return n.toExponential(5).replace(/\.?0+e/, "e");
    return String(+n.toPrecision(15));
  }
  /** every value in the arguments, ranges flattened (2D arrays) */
  function flat(args) { const out = []; for (const a of args) { if (Array.isArray(a)) for (const row of a) for (const v of row) out.push({ v, cell: true }); else out.push({ v: a, cell: false }); } return out; }
  const nums = (args) => { const o = []; for (const { v, cell } of flat(args)) { if (isErr(v)) throw v; if (cell) { if (typeof v === "number") o.push(v); } else o.push(num(v)); } return o; };

  /* criteria for SUMIF / COUNTIF: ">5", "<>x", "=a", "a*", 5 */
  function crit(c) {
    if (typeof c === "number" || typeof c === "boolean") return (v) => v === c || (typeof v === "string" && v !== "" && Number(v) === c);
    const m = /^(<>|<=|>=|<|>|=)?(.*)$/.exec(String(c == null ? "" : c)), op = m[1] || "=", rhs = m[2];
    const rn = rhs !== "" && !isNaN(Number(rhs)) ? Number(rhs) : null;
    const wild = /[*?]/.test(rhs) ? new RegExp("^" + rhs.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i") : null;
    return (v) => {
      if (isErr(v)) return false;
      if (rn !== null && op !== "=" && op !== "<>") { const x = typeof v === "number" ? v : (v !== "" && v != null && !isNaN(Number(v)) ? Number(v) : null); if (x === null) return false; return op === "<" ? x < rn : op === ">" ? x > rn : op === "<=" ? x <= rn : x >= rn; }
      let eq;
      if (rn !== null) eq = (typeof v === "number" ? v : Number(v)) === rn && v !== "" && v != null;
      else if (wild) eq = wild.test(str(v));
      else if (op === "<" || op === ">" || op === "<=" || op === ">=") { const a = str(v).toLowerCase(), b = rhs.toLowerCase(); return op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b; }
      else eq = str(v).toLowerCase() === rhs.toLowerCase() || (rhs === "" && (v == null || v === ""));
      return op === "<>" ? !eq : eq;
    };
  }
  const grid = (a) => (Array.isArray(a) ? a : [[a]]);
  const cmp = (a, b) => { if (typeof a === "number" && typeof b === "number") return a - b; const x = str(a).toLowerCase(), y = str(b).toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; };
  const eqv = (a, b) => (typeof a === "number" || typeof b === "number" ? (() => { try { return num(a) === num(b); } catch (e) { return false; } })() : str(a).toLowerCase() === str(b).toLowerCase());

  /* ================================ TEXT() formats ================================ */
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function textFmt(n, f) {
    const F = String(f);
    if (/[ymd]/i.test(F) && !/[#0]/.test(F)) {
      const d = dateOf(n), y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, da = d.getUTCDate(), p2 = (x) => String(x).padStart(2, "0");
      return F.replace(/yyyy/gi, y).replace(/yy/gi, p2(y % 100)).replace(/mmmm/gi, ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][mo - 1]).replace(/mmm/gi, MON[mo - 1]).replace(/mm/gi, p2(mo)).replace(/dd/gi, p2(da)).replace(/(^|[^a-z])m($|[^a-z])/gi, "$1" + mo + "$2").replace(/(^|[^a-z])d($|[^a-z])/gi, "$1" + da + "$2");
    }
    const pct = /%/.test(F), v = pct ? n * 100 : n, dec = (/\.(0+)/.exec(F) || [0, ""])[1].length, comma = /,/.test(F);
    let s = Math.abs(v).toFixed(dec);
    if (comma) { const [a, b] = s.split("."); s = a.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (b ? "." + b : ""); }
    const pre = (/^[^#0]*/.exec(F) || [""])[0].replace(/["\\]/g, ""), post = (/[^#0.,%]*$/.exec(F.replace(/%$/, "")) || [""])[0].replace(/["\\]/g, "");
    return (v < 0 ? "-" : "") + pre + s + post + (pct ? "%" : "");
  }

  /* ================================ the functions ================================ */
  const F = {
    SUM: (a) => nums(a).reduce((x, y) => x + y, 0),
    PRODUCT: (a) => nums(a).reduce((x, y) => x * y, 1),
    AVERAGE: (a) => { const n = nums(a); if (!n.length) throw ERR("#DIV/0!"); return n.reduce((x, y) => x + y, 0) / n.length; },
    MEDIAN: (a) => { const n = nums(a).sort((x, y) => x - y); if (!n.length) throw ERR("#NUM!"); const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
    MIN: (a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    MAX: (a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    COUNT: (a) => flat(a).filter(({ v, cell }) => typeof v === "number" || (!cell && v !== "" && !isNaN(Number(v)) && typeof v !== "boolean")).length,
    COUNTA: (a) => flat(a).filter(({ v }) => v != null && v !== "").length,
    COUNTBLANK: (a) => flat(a).filter(({ v }) => v == null || v === "").length,
    ABS: ([x]) => Math.abs(num(x)), INT: ([x]) => Math.floor(num(x)), SQRT: ([x]) => { const n = num(x); if (n < 0) throw ERR("#NUM!"); return Math.sqrt(n); },
    POWER: ([x, y]) => Math.pow(num(x), num(y)),
    MOD: ([x, y]) => { const d = num(y); if (d === 0) throw ERR("#DIV/0!"); const n = num(x); return n - d * Math.floor(n / d); },
    ROUND: ([x, d]) => { const k = Math.pow(10, num(d == null ? 0 : d)); return Math.round(num(x) * k + Math.sign(num(x)) * 1e-9) / k; },
    ROUNDUP: ([x, d]) => { const k = Math.pow(10, num(d == null ? 0 : d)), n = num(x); return Math.sign(n) * Math.ceil(Math.abs(n) * k - 1e-9) / k; },
    ROUNDDOWN: ([x, d]) => { const k = Math.pow(10, num(d == null ? 0 : d)), n = num(x); return Math.sign(n) * Math.floor(Math.abs(n) * k + 1e-9) / k; },
    AND: (a) => flat(a).filter(({ v }) => v !== "" && v != null).every(({ v }) => bool(v)),
    OR: (a) => flat(a).filter(({ v }) => v !== "" && v != null).some(({ v }) => bool(v)),
    NOT: ([x]) => !bool(x),
    LEN: ([x]) => str(x).length, TRIM: ([x]) => str(x).trim().replace(/\s+/g, " "), UPPER: ([x]) => str(x).toUpperCase(), LOWER: ([x]) => str(x).toLowerCase(),
    LEFT: ([x, n]) => str(x).slice(0, n == null ? 1 : Math.max(0, num(n))),
    RIGHT: ([x, n]) => { const s = str(x), k = n == null ? 1 : Math.max(0, num(n)); return k ? s.slice(-k) : ""; },
    MID: ([x, st, n]) => { const a = num(st); if (a < 1) throw ERR("#VALUE!"); return str(x).substr(a - 1, Math.max(0, num(n))); },
    CONCAT: (a) => flat(a).map(({ v }) => str(v)).join(""),
    TEXT: ([x, f]) => textFmt(num(x), str(f)),
    VALUE: ([x]) => num(x),
    TODAY: () => { const d = new Date(); return serialOf(d.getFullYear(), d.getMonth() + 1, d.getDate()); },
    NOW: () => { const d = new Date(); return serialOf(d.getFullYear(), d.getMonth() + 1, d.getDate()) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; },
    DATE: ([y, m, d]) => serialOf(num(y), num(m), num(d)),
    YEAR: ([x]) => dateOf(num(x)).getUTCFullYear(), MONTH: ([x]) => dateOf(num(x)).getUTCMonth() + 1, DAY: ([x]) => dateOf(num(x)).getUTCDate(),
    SUMIF: ([r, c, s]) => { const R = grid(r), S = s == null ? R : grid(s), f = crit(c); let t = 0; R.forEach((row, i) => row.forEach((v, j) => { if (f(v)) { const x = S[i] && S[i][j]; if (typeof x === "number") t += x; } })); return t; },
    COUNTIF: ([r, c]) => { const f = crit(c); let n = 0; for (const row of grid(r)) for (const v of row) if (f(v)) n++; return n; },
    AVERAGEIF: ([r, c, s]) => { const R = grid(r), S = s == null ? R : grid(s), f = crit(c); let t = 0, n = 0; R.forEach((row, i) => row.forEach((v, j) => { if (f(v)) { const x = S[i] && S[i][j]; if (typeof x === "number") { t += x; n++; } } })); if (!n) throw ERR("#DIV/0!"); return t / n; },
    SUMIFS: ([s, ...pairs]) => { const S = grid(s); let t = 0; S.forEach((row, i) => row.forEach((x, j) => { if (typeof x !== "number") return; for (let k = 0; k < pairs.length; k += 2) { const R = grid(pairs[k]); if (!crit(pairs[k + 1])(R[i] && R[i][j])) return; } t += x; })); return t; },
    COUNTIFS: (pairs) => { const R0 = grid(pairs[0]); let n = 0; R0.forEach((row, i) => row.forEach((_, j) => { for (let k = 0; k < pairs.length; k += 2) { const R = grid(pairs[k]); if (!crit(pairs[k + 1])(R[i] && R[i][j])) return; } n++; })); return n; },
    VLOOKUP: ([key, tab, col, approx]) => {
      const T = grid(tab), c = num(col) - 1; if (c < 0 || c >= (T[0] || []).length) throw ERR("#REF!");
      const exact = approx != null && approx !== "" && !bool(approx);
      if (exact) { const i = T.findIndex((row) => eqv(row[0], key)); if (i < 0) throw ERR("#N/A"); return T[i][c]; }
      let best = -1; T.forEach((row, i) => { if (row[0] !== "" && row[0] != null && cmp(row[0], key) <= 0) best = i; });
      if (best < 0) throw ERR("#N/A"); return T[best][c];
    },
    XLOOKUP: ([key, look, ret, notFound]) => {
      const L = grid(look), R = grid(ret), vert = L.length > 1 || (L[0] || []).length === 1;
      const list = vert ? L.map((row) => row[0]) : L[0], i = list.findIndex((v) => eqv(v, key));
      if (i < 0) { if (notFound !== undefined) return notFound; throw ERR("#N/A"); }
      return vert ? (R[i] || [])[0] : (R[0] || [])[i];
    },
    INDEX: ([tab, r, c]) => { const T = grid(tab), i = num(r) - 1, j = c == null ? 0 : num(c) - 1; const row = T.length === 1 && c == null ? T[0] : null; if (row) { if (i < 0 || i >= row.length) throw ERR("#REF!"); return row[i]; } if (!T[i] || j < 0 || j >= T[i].length) throw ERR("#REF!"); return T[i][j]; },
    MATCH: ([key, look, type]) => {
      const L = grid(look), list = L.length > 1 ? L.map((row) => row[0]) : L[0], t = type == null ? 1 : num(type);
      if (t === 0) { const f = typeof key === "string" && /[*?]/.test(key) ? crit(key) : null; const i = list.findIndex((v) => (f ? f(v) : eqv(v, key))); if (i < 0) throw ERR("#N/A"); return i + 1; }
      let best = -1; list.forEach((v, i) => { if (v === "" || v == null) return; const k = cmp(v, key); if (t > 0 ? k <= 0 : k >= 0) best = i; });
      if (best < 0) throw ERR("#N/A"); return best + 1;
    },
  };
  F.CONCATENATE = F.CONCAT;
  // the lazy ones (only the branch taken is worked out)
  const LAZY = {
    IF: (args, ev) => { const c = bool(ev(args[0])); return c ? (args[1] ? ev(args[1]) : true) : (args[2] ? ev(args[2]) : false); },
    IFS: (args, ev) => { for (let i = 0; i + 1 < args.length; i += 2) if (bool(ev(args[i]))) return ev(args[i + 1]); throw ERR("#N/A"); },
    IFERROR: (args, ev) => { try { const v = ev(args[0]); if (isErr(v)) return ev(args[1]); return v; } catch (e) { if (isErr(e)) return ev(args[1]); throw e; } },
  };
  const FUNCS = Object.keys(F).filter((k) => F[k]).concat(Object.keys(LAZY)).sort();

  /* ================================ the workbook ================================ */
  function Book(sheets) { this.sheets = sheets || []; this.memo = new Map(); this.busy = new Set(); this.parsed = new Map(); }
  Book.prototype.sheetIndex = function (name) {
    if (name == null) return -1;
    const n = String(name).toLowerCase(); return this.sheets.findIndex((s) => s.name.toLowerCase() === n);
  };
  Book.prototype.recalc = function () { this.memo.clear(); };
  Book.prototype.raw = function (si, c, r) { const s = this.sheets[si], cell = s && s.cells[addr(c, r)]; return cell ? cell.v : undefined; };
  /** the computed value of a cell (number / string / boolean / {err} / "" for empty) */
  Book.prototype.get = function (si, c, r) {
    const key = si + "|" + c + "|" + r;
    if (this.memo.has(key)) return this.memo.get(key);
    const raw = this.raw(si, c, r);
    let v;
    if (raw == null || raw === "") v = "";
    else if (typeof raw === "string" && raw[0] === "=" && raw.length > 1) {
      if (this.busy.has(key)) return ERR("#CYCLE!");
      this.busy.add(key);
      try { v = this.evalText(raw.slice(1), si); }
      finally { this.busy.delete(key); }
      if (Array.isArray(v)) v = v[0] ? v[0][0] : "";       // a range as a value = its first cell
      if (typeof v === "number" && !isFinite(v)) v = ERR("#NUM!");
    } else v = parseInput(raw).value;
    this.memo.set(key, v);
    return v;
  };
  Book.prototype.value = function (sheet, a) { const si = typeof sheet === "number" ? sheet : this.sheetIndex(sheet), p = parseAddr(a); return si < 0 || !p ? ERR("#REF!") : this.get(si, p.c, p.r); };
  Book.prototype.evalText = function (text, si) {
    let ast = this.parsed.get(text);
    if (!ast) { try { ast = parse(text); } catch (e) { ast = { k: "err", v: isErr(e) ? e.err : "#NAME?" }; } this.parsed.set(text, ast); if (this.parsed.size > 20000) this.parsed.clear(); }
    try { return this.ev(ast, si); } catch (e) { if (isErr(e)) return e; throw e; }
  };
  Book.prototype.used = function (si) {
    const s = this.sheets[si]; let mr = 0, mc = 0;
    for (const k of Object.keys((s && s.cells) || {})) { const p = parseAddr(k); if (p) { if (p.r > mr) mr = p.r; if (p.c > mc) mc = p.c; } }
    return { r: mr, c: mc };
  };
  Book.prototype.ev = function (n, si) {
    const ev = (x) => this.ev(x, si);
    switch (n.k) {
      case "num": case "str": case "bool": return n.v;
      case "blank": return "";
      case "err": throw ERR(n.v);
      case "name": throw ERR("#NAME?");
      case "ref": { const s = n.sheet != null ? this.sheetIndex(n.sheet) : si; if (s < 0) throw ERR("#REF!"); const v = this.get(s, n.c, n.r); return v; }
      case "range": {
        const s = n.sheet != null ? this.sheetIndex(n.sheet) : si; if (s < 0) throw ERR("#REF!");
        const u = this.used(s), r2 = Math.min(n.r2, u.r), c2 = Math.min(n.c2, u.c), out = [];
        for (let r = n.r1; r <= Math.max(n.r1, r2); r++) { const row = []; for (let c = n.c1; c <= Math.max(n.c1, c2); c++) row.push(this.get(s, c, r)); out.push(row); }
        return out;
      }
      case "neg": return -num(ev(n.e));
      case "pct": return num(ev(n.e)) / 100;
      case "bin": {
        const a = ev(n.a), b = ev(n.b), A = Array.isArray(a) ? a[0][0] : a, B = Array.isArray(b) ? b[0][0] : b;
        if (isErr(A)) throw A; if (isErr(B)) throw B;
        switch (n.op) {
          case "+": return num(A) + num(B);
          case "-": return num(A) - num(B);
          case "*": return num(A) * num(B);
          case "/": { const d = num(B); if (d === 0) throw ERR("#DIV/0!"); return num(A) / d; }
          case "^": return Math.pow(num(A), num(B));
          case "&": return str(A) + str(B);
          case "=": return eqv(A, B);
          case "<>": return !eqv(A, B);
          default: { const k = cmp(A === "" ? (typeof B === "number" ? 0 : "") : A, B === "" ? (typeof A === "number" ? 0 : "") : B); return n.op === "<" ? k < 0 : n.op === ">" ? k > 0 : n.op === "<=" ? k <= 0 : k >= 0; }
        }
      }
      case "fn": {
        if (LAZY[n.v]) return LAZY[n.v](n.args, ev);
        const f = F[n.v]; if (!f) throw ERR("#NAME?");
        const args = n.args.map((x) => (x.k === "blank" ? undefined : ev(x)));
        for (const a of args) if (isErr(a)) throw a;
        return f(args);
      }
    }
    throw ERR("#VALUE!");
  };

  /* ================================ fill / copy: the references moved ================================ */
  function shiftFormula(text, dr, dc) {
    const s = String(text); if (s[0] !== "=") return s;
    let T; try { T = tokenize(s.slice(1)); } catch (e) { return s; }
    let out = "", last = 0; const body = s.slice(1);
    const one = (a) => {
      const m = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})$/.exec(a); if (!m) return a;
      const c = m[1] ? colIndex(m[2]) : colIndex(m[2]) + dc, r = m[3] ? +m[4] - 1 : +m[4] - 1 + dr;
      if (c < 0 || r < 0 || c >= MAXC || r >= MAXR) return "#REF!";
      return m[1] + colName(c) + m[3] + (r + 1);
    };
    for (const t of T) {
      if (t.t !== "ref") continue;
      const v = t.v; let nv;
      if (/^\$?[A-Za-z]+:\$?[A-Za-z]+$/.test(v)) nv = v.split(":").map((x) => (x[0] === "$" ? x : colName(Math.max(0, colIndex(x) + dc)))).join(":");
      else if (/^\$?[0-9]+:\$?[0-9]+$/.test(v)) nv = v.split(":").map((x) => (x[0] === "$" ? x : String(Math.max(1, +x + dr)))).join(":");
      else nv = v.split(":").map(one).join(":");
      out += body.slice(last, t.at) + (/#REF!/.test(nv) ? "#REF!" : body.slice(t.at, t.refAt) + nv);   // a reference off the sheet = #REF! (its sheet name too)
      last = t.at + t.len;
    }
    return "=" + out + body.slice(last);
  }

  /** rows / columns inserted (n > 0) or deleted (n < 0) at `at` on sheet `target`: every reference to them moves; a
   *  reference INTO deleted rows / columns = #REF! (ranges shrink) - axis "r" | "c"; cur = the formula's own sheet */
  function adjustRefs(text, target, cur, axis, at, n) {
    const s = String(text); if (s[0] !== "=") return s;
    let T; try { T = tokenize(s.slice(1)); } catch (e) { return s; }
    const body = s.slice(1); let out = "", last = 0;
    const mine = (t) => (t.sheet == null ? cur : t.sheet).toLowerCase() === String(target).toLowerCase();
    const mv = (i) => (i >= at ? (n < 0 && i < at - n ? null : i + n) : i);
    for (const t of T) {
      if (t.t !== "ref" || !mine(t)) continue;
      const v = t.v, parts = v.split(":"), whole = parts.map((x) => (axis === "r" ? /^\$?[A-Za-z]+$/.test(x) : /^\$?[0-9]+$/.test(x)));
      let bad = false;
      const one = (x, k, isEnd) => {
        if (whole[k]) return x;
        const m = /^(\$?)([A-Za-z]{0,3})(\$?)([0-9]{0,7})$/.exec(x); if (!m) return x;
        if (axis === "r" && m[4]) { let i = +m[4] - 1, j = mv(i); if (j == null) { if (parts.length > 1) j = isEnd ? at - 1 : at; else { bad = true; return x; } } return m[1] + m[2] + m[3] + (j + 1); }
        if (axis === "c" && m[2]) { let i = colIndex(m[2]), j = mv(i); if (j == null) { if (parts.length > 1) j = isEnd ? at - 1 : at; else { bad = true; return x; } } return m[1] + colName(j) + m[3] + m[4]; }
        return x;
      };
      let nv = parts.map((x, k) => one(x, k, k === 1)).join(":");
      if (parts.length > 1 && !bad) { const a = nv.split(":"); const pa = parseAddr(a[0]), pb = parseAddr(a[1]); if (pa && pb && (pa.r > pb.r || pa.c > pb.c)) bad = true; }
      out += body.slice(last, t.at) + (bad ? "#REF!" : body.slice(t.at, t.refAt) + nv); last = t.at + t.len;
    }
    return "=" + out + body.slice(last);
  }

  /* ================================ typed entries + formats ================================ */
  function parseInput(text) {
    const s = String(text == null ? "" : text);
    if (s === "") return { value: "" };
    if (s[0] === "'") return { value: s.slice(1), fmt: "text" };
    const t = s.trim(), up = t.toUpperCase();
    if (up === "TRUE" || up === "FALSE") return { value: up === "TRUE" };
    if (ERRS.includes(up)) return { value: ERR(up) };
    let m;
    if ((m = /^(-?)\$\s?([0-9][0-9,]*\.?[0-9]*)$/.exec(t))) return { value: (m[1] ? -1 : 1) * Number(m[2].replace(/,/g, "")), fmt: "currency" };
    if ((m = /^(-?[0-9][0-9,]*\.?[0-9]*|-?\.[0-9]+)%$/.exec(t))) return { value: Number(m[1].replace(/,/g, "")) / 100, fmt: "percent" };
    if (/^-?([0-9]{1,3}(,[0-9]{3})+|[0-9]+)?(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(t) && /[0-9]/.test(t)) return { value: Number(t.replace(/,/g, "")) };
    if ((m = /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/.exec(t))) return { value: serialOf(+m[1], +m[2], +m[3]), fmt: "date" };
    if ((m = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/.exec(t))) return { value: serialOf(+m[3], +m[2], +m[1]), fmt: "date" };   // d/m/yyyy (Australia)
    return { value: s };
  }
  function format(v, fmt, dp) {
    if (isErr(v)) return v.err;
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (v === "" || v == null) return "";
    if (typeof v !== "number") return String(v);
    const d = dp == null ? 2 : dp;
    switch (fmt) {
      case "number": return textFmt(v, "#,##0" + (d ? "." + "0".repeat(d) : ""));
      case "currency": return (v < 0 ? "-$" : "$") + textFmt(Math.abs(v), "#,##0" + (d ? "." + "0".repeat(d) : ""));
      case "percent": return textFmt(v, "0" + (d ? "." + "0".repeat(d) : "") + "%");
      case "date": return textFmt(v, "yyyy-mm-dd");
      case "text": return fmtGeneral(v);
      default: return fmtGeneral(v);
    }
  }

  const SheetCalc = { colName, colIndex, addr, parseAddr, tokenize, parse, Book, shiftFormula, adjustRefs, parseInput, format, textFmt, crit, FUNCS, ERRS, isErr, serialOf, dateOf, MAXR, MAXC };
  if (typeof module !== "undefined" && module.exports) module.exports = SheetCalc;
  else root.SheetCalc = SheetCalc;
})(typeof window !== "undefined" ? window : globalThis);
