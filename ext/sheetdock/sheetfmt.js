/* ext/sheetdock/sheetfmt.js — ▦ NUMBER FORMAT CODES (2.823.0): window.SheetFmt, pure (no DOM; Node-tested).
 *
 * Tim: "continue , add format cells button, format the cells like excel". The codes are the ones every spreadsheet
 * program uses, written by bitGen itself (no library):
 *   sections   positive;negative;zero;text  - a [condition] ([>100], [<=0]) picks a section instead
 *   [Red] [Blue] [Color12] ...  the section's colour        [$€-409] a currency sign     [h] [m] [s] elapsed time
 *   0 # ?      digits (0 = always, # = only when there, ? = a space when not)   .  ,  (thousands; after the digits =
 *              / 1000 each)   %  (x 100)   E+00 / E-00 (scientific)   # ?/? and ?/4 (fractions)
 *   d dd ddd dddd  m mm mmm mmmm mmmmm  yy yyyy  h hh  m mm (minutes after h / before s)  s ss .0  AM/PM  A/P
 *   @ (the text)   "text" and \x (as written)   _x (a space as wide as x)   *x (x repeated to fill the cell)
 *   General
 *   render(value, code)  -> {text, color?, fill?: {left, ch, right}}
 *   CATS, SYMBOLS, DATES, TIMES, FRACTIONS, SPECIAL, NEG   the Format Cells dialog's lists
 *   build(cat, opt) -> code      detect(code) -> {cat, opt}      upgrade(f, dp) (2.822.0's names -> codes)
 *   decimals(code, delta, shownDp) -> the code with one decimal place more / fewer
 */
(function (root) {
  "use strict";
  const EPOCH = Date.UTC(1899, 11, 30);
  const COLORS = { black: "#000000", blue: "#0000ff", cyan: "#00ffff", green: "#00ff00", magenta: "#ff00ff", red: "#ff0000", white: "#ffffff", yellow: "#ffff00" };
  const PALETTE = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#800000", "#008000", "#000080", "#808000", "#800080", "#008080", "#c0c0c0", "#808080",
    "#9999ff", "#993366", "#ffffcc", "#ccffff", "#660066", "#ff8080", "#0066cc", "#ccccff", "#000080", "#ff00ff", "#ffff00", "#00ffff", "#800080", "#800000", "#008080", "#0000ff",
    "#00ccff", "#ccffff", "#ccffcc", "#ffff99", "#99ccff", "#ff99cc", "#cc99ff", "#ffcc99", "#3366ff", "#33cccc", "#99cc00", "#ffcc00", "#ff9900", "#ff6600", "#666699", "#969696",
    "#003366", "#339966", "#003300", "#333300", "#993300", "#993366", "#333399", "#333333"];
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  /* ------------------------------------------------------------------ reading a code */
  function splitSections(code) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      if (q) { cur += ch; if (ch === '"') q = false; continue; }
      if (ch === '"') { q = true; cur += ch; continue; }
      if (ch === "\\" || ch === "_" || ch === "*") { cur += ch + (code[i + 1] || ""); i++; continue; }
      if (ch === "[") { const j = code.indexOf("]", i); if (j > 0) { cur += code.slice(i, j + 1); i = j; continue; } }
      if (ch === ";") { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }
  const DATE_RE = /^(y+|m+|d+|h+|s+|e+|g+|b+)/i;
  function tokenize(sec) {
    const T = [], S = { color: null, cond: null, tokens: T, raw: sec };
    for (let i = 0; i < sec.length;) {
      const ch = sec[i], rest = sec.slice(i);
      if (ch === '"') { const j = sec.indexOf('"', i + 1), e = j < 0 ? sec.length : j; T.push({ t: "lit", v: sec.slice(i + 1, e), raw: sec.slice(i, e + 1) }); i = e + 1; continue; }
      if (ch === "\\") { T.push({ t: "lit", v: sec[i + 1] || "", raw: sec.slice(i, i + 2) }); i += 2; continue; }
      if (ch === "_") { T.push({ t: "lit", v: " ", raw: sec.slice(i, i + 2) }); i += 2; continue; }
      if (ch === "*") { T.push({ t: "fill", v: sec[i + 1] || " ", raw: sec.slice(i, i + 2) }); i += 2; continue; }
      if (ch === "[") {
        const j = sec.indexOf("]", i), body = j < 0 ? sec.slice(i + 1) : sec.slice(i + 1, j), raw = j < 0 ? sec.slice(i) : sec.slice(i, j + 1); i = j < 0 ? sec.length : j + 1;
        let m;
        if (COLORS[body.toLowerCase()]) { S.color = COLORS[body.toLowerCase()]; T.push({ t: "meta", raw }); continue; }
        if ((m = /^color\s*(\d{1,2})$/i.exec(body))) { S.color = PALETTE[+m[1] - 1] || null; T.push({ t: "meta", raw }); continue; }
        if ((m = /^(<=|>=|<>|<|>|=)\s*(-?[0-9.]+(?:e[+-]?\d+)?)$/i.exec(body))) { S.cond = { op: m[1], n: +m[2] }; T.push({ t: "meta", raw }); continue; }
        if ((m = /^\$([^-]*)(?:-[0-9a-z-]+)?$/i.exec(body))) { if (m[1]) T.push({ t: "lit", v: m[1], raw }); else T.push({ t: "meta", raw }); continue; }
        if ((m = /^(h+|m+|s+)$/i.exec(body))) { T.push({ t: "el", v: m[1][0].toLowerCase(), n: m[1].length, raw }); continue; }
        T.push({ t: "meta", raw });   // [DBNum1], [natnum] ... - left out
        continue;
      }
      if (/^general/i.test(rest)) { T.push({ t: "gen", raw: sec.slice(i, i + 7) }); i += 7; continue; }
      if (/^(am\/pm|a\/p)/i.test(rest)) { const m = /^(am\/pm|a\/p)/i.exec(rest)[1]; T.push({ t: "ampm", v: m, raw: m }); i += m.length; continue; }
      if ((ch === "E" || ch === "e") && (sec[i + 1] === "+" || sec[i + 1] === "-") && /[0#?]/.test(sec.slice(i + 2, i + 3))) { T.push({ t: "exp", v: sec[i + 1], up: ch === "E", raw: sec.slice(i, i + 2) }); i += 2; continue; }
      const dm = DATE_RE.exec(rest);
      if (dm && !/^[eE]/.test(dm[1]) && !/^[gG]/.test(dm[1]) && !/^[bB]/.test(dm[1])) { T.push({ t: "dt", v: dm[1].toLowerCase(), raw: dm[1] }); i += dm[1].length; continue; }
      if (ch === "0" || ch === "#" || ch === "?") { T.push({ t: "ph", v: ch, raw: ch }); i++; continue; }
      if (/[1-9]/.test(ch)) { T.push({ t: "dig", v: ch, raw: ch }); i++; continue; }
      if (ch === ".") { T.push({ t: "dot", raw: "." }); i++; continue; }
      if (ch === ",") { T.push({ t: "comma", raw: "," }); i++; continue; }
      if (ch === "%") { T.push({ t: "pct", raw: "%" }); i++; continue; }
      if (ch === "@") { T.push({ t: "at", raw: "@" }); i++; continue; }
      if (ch === "/") { T.push({ t: "slash", raw: "/" }); i++; continue; }
      T.push({ t: "lit", v: ch, raw: ch }); i++;
    }
    // the kind of the section
    const has = (t) => T.some((x) => x.t === t);
    if (has("dt") || has("el") || has("ampm")) S.kind = "date";
    else if (has("gen")) S.kind = "general";
    else if (has("exp")) S.kind = "sci";
    else if (has("slash") && T.some((x, k) => x.t === "slash" && T.slice(0, k).some((y) => y.t === "ph") && T.slice(k + 1).some((y) => y.t === "ph" || y.t === "dig"))) S.kind = "frac";
    else if (has("ph")) S.kind = "num";
    else if (has("at")) S.kind = "text";
    else S.kind = "lit";
    return S;
  }
  const cache = new Map();
  function compile(code) {
    const key = String(code);
    if (cache.has(key)) return cache.get(key);
    const secs = splitSections(key).map(tokenize);
    let text = null, num = secs;
    if (secs.length >= 4) { text = secs[3]; num = secs.slice(0, 3); }
    else { const t = secs.findIndex((s, i) => i > 0 && s.kind === "text"); if (t > 0) { text = secs[t]; num = secs.slice(0, t); } }
    if (secs.length === 1 && secs[0].kind === "text") { text = secs[0]; }
    const P = { num, text, all: secs };
    if (cache.size > 500) cache.clear();
    cache.set(key, P);
    return P;
  }

  /* ------------------------------------------------------------------ General */
  function general(n) {
    if (!isFinite(n)) return "#NUM!";
    const a = Math.abs(n);
    if (Number.isInteger(n) && a < 1e11) return String(n);
    if (a !== 0 && (a >= 1e11 || a < 1e-9)) { const [m, e] = n.toExponential(5).split("e"); return m.replace(/\.?0+$/, "") + "E" + (e[0] === "-" ? "-" : "+") + String(Math.abs(+e)).padStart(2, "0"); }
    let p = 10, s = String(+n.toPrecision(p));
    while (s.replace("-", "").length > 11 && p > 1) s = String(+n.toPrecision(--p));
    return s;
  }

  /* ------------------------------------------------------------------ numbers */
  function roundTo(x, d) { if (d > 15) d = 15; const s = Math.abs(x).toFixed(d); return Number(Math.round(Number(Math.abs(x) + "e" + d)) + "e-" + d).toFixed(d) || s; }
  function groupDigits(s) { const m = /^( *)(\d*)$/.exec(s); if (!m) return s; return m[1] + m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  /** formats x (>= 0) with the tokens of one number section -> the pieces in order (fill marked) */
  function numPieces(T, x) {
    const dotAt = T.findIndex((t) => t.t === "dot");
    const endInt = dotAt < 0 ? T.length : dotAt;
    // commas: between digits = thousands; straight after the last digit of a part = / 1000 each
    let group = false, scale = 0;
    const commaRole = T.map(() => null);
    for (let k = 0; k < T.length; k++) {
      if (T[k].t !== "comma") continue;
      const prevPh = T.slice(0, k).reverse().find((t) => t.t !== "comma"), next = T.slice(k + 1).find((t) => t.t !== "comma");
      const inInt = k < endInt;
      if (prevPh && prevPh.t === "ph" && next && next.t === "ph" && inInt) { group = true; commaRole[k] = "group"; }
      else if (prevPh && prevPh.t === "ph" && (!next || next.t !== "ph")) { scale++; commaRole[k] = "scale"; }
      else commaRole[k] = "lit";
    }
    const pct = T.filter((t) => t.t === "pct").length;
    let v = x * Math.pow(100, pct) / Math.pow(1000, scale);
    const intPh = []; const fracPh = [];
    T.forEach((t, k) => { if (t.t === "ph") (k < endInt ? intPh : fracPh).push(k); });
    const d = fracPh.length;
    const fixed = roundTo(v, d), [ip, fp = ""] = fixed.split(".");
    const out = T.map(() => "");
    // the whole part
    const digits = ip === "0" ? "" : ip;
    if (intPh.length) {
      let rest = digits;
      for (let j = intPh.length - 1; j >= 0; j--) {
        const k = intPh[j], ph = T[k].v;
        if (j === 0) out[k] = rest || (ph === "0" ? "0" : ph === "?" ? " " : "");
        else if (rest) { out[k] = rest.slice(-1); rest = rest.slice(0, -1); }
        else out[k] = ph === "0" ? "0" : ph === "?" ? " " : "";
      }
      if (group) {
        // only digits and commas between the first and the last whole-number digit: the run grouped as one
        const a = intPh[0], b = intPh[intPh.length - 1];
        const between = T.slice(a, b + 1).every((t) => t.t === "ph" || t.t === "comma");
        if (between) { let s = ""; for (let k = a; k <= b; k++) if (T[k].t === "ph") { s += out[k]; out[k] = ""; } out[a] = groupDigits(s); }
      }
    } else if (digits && dotAt >= 0) out[dotAt] = digits;   // ".00" with 12.5 still shows 12
    // the decimals
    const fd = fp.split("");
    let trail = true;
    for (let j = d - 1; j >= 0; j--) {
      const k = fracPh[j], ph = T[k].v, dg = fd[j] || "0";
      if (trail && dg === "0" && ph !== "0") out[k] = ph === "?" ? " " : "";
      else { out[k] = dg; trail = false; }
    }
    if (dotAt >= 0) out[dotAt] = (out[dotAt] || "") + ".";
    return T.map((t, k) => {
      if (t.t === "ph" || t.t === "dot") return out[k];
      if (t.t === "comma") return commaRole[k] === "lit" ? "," : "";
      if (t.t === "pct") return "%";
      if (t.t === "lit") return t.v;
      if (t.t === "dig") return t.v;
      if (t.t === "slash") return "/";
      if (t.t === "fill") return "\u0001" + t.v;
      if (t.t === "at" || t.t === "meta") return "";
      return t.raw || "";
    });
  }
  function sciPieces(T, x) {
    const ei = T.findIndex((t) => t.t === "exp"), M = T.slice(0, ei), E = T.slice(ei + 1);
    const dotAt = M.findIndex((t) => t.t === "dot"), intPh = M.filter((t, k) => t.t === "ph" && (dotAt < 0 || k < dotAt)), fracN = M.filter((t, k) => t.t === "ph" && dotAt >= 0 && k > dotAt).length;
    const step = intPh.length > 1 && intPh[0].v === "#" ? intPh.length : 1;
    let e = x === 0 ? 0 : Math.floor(Math.log10(x)); e = Math.floor(e / step) * step;
    let m = x === 0 ? 0 : x / Math.pow(10, e);
    if (+roundTo(m, fracN) >= Math.pow(10, step)) { e += step; m = x / Math.pow(10, e); }
    const mant = numPieces(M, m).join("");
    const eph = E.filter((t) => t.t === "ph"), sign = e < 0 ? "-" : T[ei].v === "+" ? "+" : "";
    let ed = String(Math.abs(e)); const minD = eph.filter((t) => t.v === "0").length; ed = ed.padStart(minD, "0");
    let started = false;
    const tail = E.map((t) => { if (t.t === "ph") { if (started) return ""; started = true; return ed; } return t.t === "lit" ? t.v : t.t === "fill" ? "\u0001" + t.v : ""; });
    return [mant, (T[ei].up ? "E" : "e") + sign, ...tail];
  }
  function bestFrac(x, maxDen) {
    let a = Math.floor(x), h1 = 1, h0 = 0, k1 = 0, k0 = 1, f = x, best = [Math.round(x), 1];
    for (let n = 0; n < 64; n++) {
      a = Math.floor(f);
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > maxDen) break;
      best = [h2, k2]; h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (f - a < 1e-12) break;
      f = 1 / (f - a);
    }
    // a semi-convergent can be closer
    const t = Math.floor((maxDen - k0) / (k1 || 1));
    if (t > 0) { const h = t * h1 + h0, k = t * k1 + k0; if (k <= maxDen && Math.abs(x - h / k) < Math.abs(x - best[0] / best[1])) best = [h, k]; }
    return best;
  }
  function fracPieces(T, x) {
    const si = T.findIndex((t) => t.t === "slash");
    let a = si - 1; while (a >= 0 && T[a].t === "ph") a--;
    const numIdx = []; for (let k = a + 1; k < si; k++) numIdx.push(k);
    const intIdx = []; for (let k = 0; k <= a; k++) if (T[k].t === "ph") intIdx.push(k);
    const den = []; let b = si + 1; while (b < T.length && (T[b].t === "ph" || T[b].t === "dig")) den.push(b++);
    const fixedDen = den.length && den.every((k) => T[k].t === "dig" || T[k].v === "0") && den.some((k) => T[k].t === "dig") ? +den.map((k) => T[k].v).join("") : 0;
    let whole = intIdx.length ? Math.floor(x) : 0, fr = x - whole, n, d;
    if (fixedDen) { d = fixedDen; n = Math.round(fr * d); }
    else { [n, d] = bestFrac(fr, Math.pow(10, den.length) - 1); }
    if (intIdx.length && n === d && d) { whole++; n = 0; }
    const out = T.map((t) => (t.t === "lit" ? t.v : t.t === "fill" ? "\u0001" + t.v : t.t === "pct" ? "%" : ""));
    if (intIdx.length) {
      const s = whole ? String(whole) : "";
      intIdx.forEach((k, j) => { out[k] = j === intIdx.length - 1 ? (s || (n === 0 ? "0" : (T[k].v === "0" ? "0" : T[k].v === "?" ? " " : ""))) : ""; });
      if (!whole && n !== 0 && T[intIdx[intIdx.length - 1]].v === "#") { for (let k = intIdx[intIdx.length - 1] + 1; k <= a; k++) if (T[k].t === "lit") out[k] = T[k].v === " " ? " " : out[k]; }
    }
    const w = (len, s, left) => (left ? s.padEnd(len, " ") : s.padStart(len, " "));
    if (n === 0 && intIdx.length) { const blank = " ".repeat(numIdx.length + 1 + den.length); numIdx.forEach((k) => { out[k] = ""; }); out[numIdx[0]] = blank; out[si] = ""; den.forEach((k) => { out[k] = ""; }); }
    else {
      numIdx.forEach((k) => { out[k] = ""; }); out[numIdx[0]] = w(numIdx.length, String(n));
      out[si] = "/";
      den.forEach((k) => { out[k] = ""; }); if (den.length) out[den[0]] = fixedDen ? String(fixedDen) : w(den.length, String(d), true);
    }
    return out;
  }

  /* ------------------------------------------------------------------ dates and times */
  function datePieces(T, x) {
    // fractions of a second: ".0" / ".00" / ".000" straight after s / ss
    const fx = [];
    for (let k = 0; k < T.length; k++) if (T[k].t === "dot" && k > 0 && T[k - 1].t === "dt" && T[k - 1].v[0] === "s" && T[k + 1] && T[k + 1].t === "ph") { let j = k + 1, n = 0; while (T[j] && T[j].t === "ph" && T[j].v === "0") { n++; j++; } fx.push({ k, n, end: j }); }
    const fd = fx.length ? fx[0].n : 0;
    const totalS = Math.round(x * 86400 * Math.pow(10, fd)) / Math.pow(10, fd);
    const day = Math.floor(totalS / 86400), secOfDay = totalS - day * 86400;
    const D = new Date(EPOCH + day * 86400000), y = D.getUTCFullYear(), mo = D.getUTCMonth(), da = D.getUTCDate(), wd = D.getUTCDay();
    const H = Math.floor(secOfDay / 3600), Mi = Math.floor((secOfDay % 3600) / 60), Sf = secOfDay % 60, Si = Math.floor(Sf + 1e-9);
    const ampm = T.some((t) => t.t === "ampm");
    const p2 = (n) => String(n).padStart(2, "0");
    const dts = T.map((t, k) => (t.t === "dt" || t.t === "el" ? k : -1)).filter((k) => k >= 0);
    const isMin = (k) => {
      const i = dts.indexOf(k), prev = i > 0 ? T[dts[i - 1]] : null, next = i < dts.length - 1 ? T[dts[i + 1]] : null;
      return (prev && ((prev.t === "dt" && prev.v[0] === "h") || (prev.t === "el" && prev.v === "h"))) || (next && ((next.t === "dt" && next.v[0] === "s") || (next.t === "el" && next.v === "s")));
    };
    const skip = new Set(); fx.forEach((f) => { for (let k = f.k; k < f.end; k++) skip.add(k); });
    return T.map((t, k) => {
      if (skip.has(k)) { const f = fx.find((q) => q.k === k); return f ? "." + (Sf - Si).toFixed(f.n).slice(2) : ""; }
      if (t.t === "lit") return t.v;
      if (t.t === "fill") return "\u0001" + t.v;
      if (t.t === "dot") return ".";
      if (t.t === "comma") return ",";
      if (t.t === "slash") return "/";
      if (t.t === "pct") return "%";
      if (t.t === "ph" || t.t === "dig") return t.raw;
      if (t.t === "ampm") { const pm = H >= 12, s = t.v; if (s.length === 3) return pm ? (s[2] === "P" || s[2] === "p" ? s[2] : "P") : s[0]; return pm ? (s[0] === "a" ? "pm" : "PM") : (s[0] === "a" ? "am" : "AM"); }
      if (t.t === "el") { const n = t.v === "h" ? Math.floor(totalS / 3600) : t.v === "m" ? Math.floor(totalS / 60) : Math.floor(totalS); return String(n).padStart(t.n, "0"); }
      if (t.t !== "dt") return "";
      const v = t.v, L = v.length;
      switch (v[0]) {
        case "y": return L <= 2 ? p2(y % 100) : String(y);
        case "d": return L === 1 ? String(da) : L === 2 ? p2(da) : L === 3 ? DAY[wd].slice(0, 3) : DAY[wd];
        case "h": { const h = ampm ? (H % 12 || 12) : H; return L === 1 ? String(h) : p2(h); }
        case "s": return L === 1 ? String(Si) : p2(Si);
        case "m": if (L <= 2 && isMin(k)) return L === 1 ? String(Mi) : p2(Mi);
          return L === 1 ? String(mo + 1) : L === 2 ? p2(mo + 1) : L === 3 ? MON[mo].slice(0, 3) : L === 4 ? MON[mo] : MON[mo][0];
        default: return t.raw;
      }
    });
  }

  /* ------------------------------------------------------------------ render */
  function finish(pieces, color, neg) {
    let s = pieces.join("");
    if (neg) s = "-" + s;
    const at = s.indexOf("\u0001");
    const o = { text: s.replace(/\u0001(.)/g, "$1") };
    if (color) o.color = color;
    if (at >= 0) o.fill = { left: s.slice(0, at), ch: s[at + 1] || " ", right: s.slice(at + 2).replace(/\u0001(.)/g, "") };
    return o;
  }
  const test = (c, v) => (c.op === "<" ? v < c.n : c.op === ">" ? v > c.n : c.op === "<=" ? v <= c.n : c.op === ">=" ? v >= c.n : c.op === "<>" ? v !== c.n : v === c.n);
  function render(v, code) {
    if (v === "" || v == null) return { text: "" };
    if (typeof v === "boolean") return { text: v ? "TRUE" : "FALSE" };
    if (typeof v === "object" && v && v.err) return { text: v.err };
    const c = code == null || code === "" ? "General" : String(code);
    const P = compile(c);
    if (typeof v !== "number") {
      const s = String(v), sec = P.text;
      if (!sec) return { text: s };
      return finish(sec.tokens.map((t) => (t.t === "at" ? s : t.t === "lit" ? t.v : t.t === "fill" ? "\u0001" + t.v : "")), sec.color);
    }
    if (!isFinite(v)) return { text: "#NUM!" };
    const secs = P.num.length ? P.num : [tokenize("General")];
    let sec = null, x = v, idx = 0;
    if (secs.some((s) => s.cond)) {
      for (let i = 0; i < secs.length; i++) { if (!secs[i].cond || test(secs[i].cond, v)) { sec = secs[i]; idx = i; break; } }
      if (!sec) return { text: "#".repeat(10) };
      if (idx > 0) x = Math.abs(v);
    } else if (secs.length === 1) sec = secs[0];
    else if (v > 0 || (v === 0 && secs.length < 3)) sec = secs[0];
    else if (v < 0) { sec = secs[1]; x = -v; idx = 1; }
    else { sec = secs[2]; idx = 2; }
    const neg = x < 0;
    const a = Math.abs(x), T = sec.tokens;
    let pieces;
    switch (sec.kind) {
      case "general": pieces = T.map((t) => (t.t === "gen" ? general(a) : t.t === "lit" ? t.v : t.t === "fill" ? "\u0001" + t.v : "")); break;
      case "date": if (v < 0) return { text: "#".repeat(10) }; pieces = datePieces(T, v); return finish(pieces, sec.color, false);
      case "sci": pieces = sciPieces(T, a); break;
      case "frac": pieces = fracPieces(T, a); break;
      case "num": pieces = numPieces(T, a); break;
      case "text": pieces = T.map((t) => (t.t === "at" ? general(v) : t.t === "lit" ? t.v : "")); return finish(pieces, sec.color, false);
      default: pieces = T.map((t) => (t.t === "lit" ? t.v : t.t === "fill" ? "\u0001" + t.v : t.t === "dig" ? t.v : t.t === "comma" ? "," : t.t === "dot" ? "." : ""));
    }
    // "-0.00" is just 0.00
    const zero = neg && !/[1-9]/.test(pieces.join(""));
    return finish(pieces, sec.color, neg && !zero);
  }
  /** the number of decimal places a code shows (its first number section) */
  function decimalsOf(code) {
    const P = compile(code || "General"), s = P.num[0]; if (!s || (s.kind !== "num" && s.kind !== "sci")) return null;
    const T = s.tokens, d = T.findIndex((t) => t.t === "dot"); if (d < 0) return 0;
    let n = 0; for (let k = d + 1; k < T.length && T[k].t === "ph"; k++) n++; return n;
  }

  /* ------------------------------------------------------------------ the dialog's lists + building codes */
  const CATS = ["General", "Number", "Currency", "Accounting", "Date", "Time", "Percentage", "Fraction", "Scientific", "Text", "Special", "Custom"];
  const SYMBOLS = [
    { id: "none", label: "None" }, { id: "$", label: "$", pre: "$" }, { id: "A$", label: "A$ (Australian dollar)", pre: '"A$"' }, { id: "US$", label: "US$ (US dollar)", pre: '"US$"' },
    { id: "NZ$", label: "NZ$ (New Zealand dollar)", pre: '"NZ$"' }, { id: "€", label: "€ 123", pre: "€" }, { id: "123 €", label: "123 €", post: " €" }, { id: "£", label: "£", pre: "£" },
    { id: "¥", label: "¥", pre: "¥" }, { id: "฿", label: "฿ (Thai baht)", pre: "฿" }, { id: "₹", label: "₹", pre: "₹" }, { id: "₩", label: "₩", pre: "₩" }, { id: "S$", label: "S$ (Singapore dollar)", pre: '"S$"' },
    { id: "HK$", label: "HK$ (Hong Kong dollar)", pre: '"HK$"' }, { id: "CHF", label: "CHF", pre: '"CHF "' }, { id: "kr", label: "kr", post: '" kr"' }, { id: "R", label: "R (rand)", pre: '"R "' },
  ];
  // Number / Currency: how negative numbers show (the dialog draws each with -1234.10)
  const NEG = ["minus", "red", "paren", "redparen"];
  const DATES = ["d/mm/yyyy", "d/m/yy", "dd/mm/yyyy", "dddd, d mmmm yyyy", "d mmmm yyyy", "d mmm yyyy", "d-mmm", "d-mmm-yy", "dd-mmm-yy", "mmm-yy", "mmmm-yy", "mmmm d, yyyy", "m/d/yyyy", "yyyy-mm-dd", "mmmmm", "mmmmm-yy", "d/mm/yyyy h:mm", "d/mm/yy h:mm AM/PM"];
  const TIMES = ["h:mm:ss", "h:mm", "h:mm AM/PM", "h:mm:ss AM/PM", "mm:ss", "mm:ss.0", "[h]:mm:ss", "[h]:mm", "d/mm/yyyy h:mm"];
  const FRACTIONS = [["# ?/?", "Up to one digit (1/4)"], ["# ??/??", "Up to two digits (21/25)"], ["# ???/???", "Up to three digits (312/943)"], ["# ?/2", "As halves (1/2)"], ["# ?/4", "As quarters (2/4)"],
    ["# ?/8", "As eighths (4/8)"], ["# ??/16", "As sixteenths (8/16)"], ["# ?/10", "As tenths (3/10)"], ["# ??/100", "As hundredths (30/100)"]];
  const SPECIAL = [["0000", "Postcode (Australia)"], ["00 000 000 000", "ABN (Australian Business Number)"], ["(00) 0000 0000", "Phone number (Australia)"], ["0000 000 000", "Mobile number (Australia)"],
    ["00000", "ZIP code (US)"], ["00000-0000", "ZIP + 4 (US)"], ["[<=9999999]###-####;(###) ###-####", "Phone number (US)"], ["000-00-0000", "Social security number (US)"]];
  const CUSTOM = ["General", "0", "0.00", "#,##0", "#,##0.00", "#,##0_);(#,##0)", "#,##0_);[Red](#,##0)", "#,##0.00_);(#,##0.00)", "#,##0.00_);[Red](#,##0.00)", "$#,##0_);($#,##0)", "$#,##0.00_);[Red]($#,##0.00)",
    "0%", "0.00%", "0.00E+00", "##0.0E+0", "# ?/?", "# ??/??", "d/mm/yyyy", "d-mmm-yy", "d-mmm", "mmm-yy", "h:mm AM/PM", "h:mm:ss AM/PM", "h:mm", "h:mm:ss", "d/mm/yyyy h:mm", "mm:ss", "[h]:mm:ss", "mm:ss.0", "@",
    '_-$* #,##0.00_-;-$* #,##0.00_-;_-$* "-"??_-;_-@_-', '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-', '0.0,,"M"', '#,##0,"K"', '[Blue][>=1000]#,##0;[Red][<0]-#,##0;0', '0" kg"', '"Total: "@'];
  const symOf = (id) => SYMBOLS.find((s) => s.id === id) || SYMBOLS[1];
  function build(cat, o) {
    o = o || {};
    const dp = Math.max(0, Math.min(30, o.dp == null ? 2 : +o.dp)), dec = dp ? "." + "0".repeat(dp) : "";
    const negWrap = (base, neg) => (neg === "red" ? base + ";[Red]" + base : neg === "paren" ? base + "_);(" + base + ")" : neg === "redparen" ? base + "_);[Red](" + base + ")" : base);
    switch (cat) {
      case "General": return "General";
      case "Number": return negWrap((o.sep ? "#,##0" : "0") + dec, o.neg);
      case "Currency": { const S = symOf(o.sym || "$"); return negWrap((S.pre || "") + "#,##0" + dec + (S.post || ""), o.neg); }
      case "Accounting": {
        const S = symOf(o.sym || "$"), pre = S.pre ? S.pre + "* " : "* ", post = S.post || "", z = dp ? '"-"' + "?".repeat(dp) : '"-"';
        return S.post ? `_-* #,##0${dec}${post}_-;-* #,##0${dec}${post}_-;_-* ${z}${post}_-;_-@_-` : `_-${pre}#,##0${dec}_-;-${pre}#,##0${dec}_-;_-${pre}${z}_-;_-@_-`;
      }
      case "Percentage": return "0" + dec + "%";
      case "Scientific": return "0" + dec + "E+00";
      case "Text": return "@";
      case "Date": case "Time": case "Fraction": case "Special": case "Custom": return o.type || (cat === "Date" ? DATES[0] : cat === "Time" ? TIMES[0] : cat === "Fraction" ? FRACTIONS[0][0] : cat === "Special" ? SPECIAL[0][0] : "General");
      default: return "General";
    }
  }
  let table = null;
  function detect(code) {
    const c = code == null || code === "" ? "General" : String(code);
    if (!table) {
      table = new Map();
      const add = (cat, o) => { const k = build(cat, o); if (!table.has(k)) table.set(k, { cat, opt: o }); };
      add("General", {});
      for (let dp = 0; dp <= 10; dp++) {
        for (const sep of [false, true]) for (const neg of NEG) add("Number", { dp, sep, neg });
        for (const s of SYMBOLS) for (const neg of NEG) add("Currency", { dp, sym: s.id, neg });
        for (const s of SYMBOLS) add("Accounting", { dp, sym: s.id });
        add("Percentage", { dp }); add("Scientific", { dp });
      }
      add("Text", {});
      for (const t of DATES) add("Date", { type: t });
      for (const t of TIMES) add("Time", { type: t });
      for (const [t] of FRACTIONS) add("Fraction", { type: t });
      for (const [t] of SPECIAL) add("Special", { type: t });
    }
    if (table.has(c)) return JSON.parse(JSON.stringify(table.get(c)));
    if (/^general$/i.test(c)) return { cat: "General", opt: {} };
    return { cat: "Custom", opt: { type: c } };
  }
  /** 2.822.0 kept the format as a name + s.dp */
  function upgrade(f, dp) {
    if (!f) return undefined;
    const d = dp == null ? 2 : dp;
    switch (f) {
      case "number": return build("Number", { dp: d, sep: true });
      case "currency": return build("Currency", { dp: d, sym: "$" });
      case "percent": return build("Percentage", { dp: d });
      case "date": return "yyyy-mm-dd";
      case "text": return "@";
      default: return f;
    }
  }
  /** one decimal place more (+1) / fewer (-1) in every number section; General starts from what it shows */
  function decimals(code, delta, shownDp) {
    const c = code == null || code === "" || /^general$/i.test(code) ? (shownDp ? "0." + "0".repeat(shownDp) : "0") : String(code);
    if (/^general$/i.test(String(code || "General")) && delta < 0 && !shownDp) return "0";
    const secs = splitSections(c).map((raw) => {
      const S = tokenize(raw); if (S.kind !== "num" && S.kind !== "sci") return raw;
      const T = S.tokens.slice(), d = T.findIndex((t) => t.t === "dot");
      const endM = (() => { const e = T.findIndex((t) => t.t === "exp"); return e < 0 ? T.length : e; })();
      if (delta > 0) {
        if (d >= 0 && d < endM) { let k = d + 1; while (k < endM && T[k].t === "ph") k++; T.splice(k, 0, { raw: "0" }); }
        else { let k = -1; for (let j = 0; j < endM; j++) if (T[j].t === "ph") k = j; if (k < 0) return raw; while (T[k + 1] && T[k + 1].t === "comma" && !(T[k + 2] && T[k + 2].t === "ph")) k++; T.splice(k + 1, 0, { raw: ".0" }); }
      } else if (d >= 0 && d < endM) {
        let k = d + 1; while (k < endM && T[k].t === "ph") k++;
        if (k - 1 > d) T.splice(k - 1, 1);
        if (!(T[d + 1] && T[d + 1].t === "ph")) T.splice(d, 1);
      }
      return T.map((t) => t.raw).join("");
    });
    return secs.join(";");
  }

  const SheetFmt = { render, general, compile, decimalsOf, decimals, build, detect, upgrade, CATS, SYMBOLS, NEG, DATES, TIMES, FRACTIONS, SPECIAL, CUSTOM, COLORS, PALETTE };
  root.SheetFmt = SheetFmt;
  if (typeof module !== "undefined" && module.exports) module.exports = SheetFmt;
})(typeof window !== "undefined" ? window : globalThis);
