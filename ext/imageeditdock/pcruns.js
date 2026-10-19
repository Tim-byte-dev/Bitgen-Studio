/* pcruns.js — PER-CHARACTER TYPE: STYLED RANGES INSIDE ONE TEXT LAYER (2.449.0), window.PCRuns.
 *
 * Tim (verbatim): "and more photoshop features to close the gap" - asked which: "Per-character text styles" (with
 * artboards, the Content-Aware Fill workspace, warp grid + liquify extras - one release each).
 *
 * Like Photoshop: while typing (the Type tool's box is open) SELECT some letters, then change the font, bold, italic,
 * size, tracking or colour in the options bar - or anything in the Character panel (scales, baseline shift, faux
 * bold / italic, all caps, small caps, super / subscript, underline, strikethrough) - and only THOSE letters change.
 * Nothing selected = the whole layer, as before. Typing inside a styled range takes its style (the letter before the
 * caret's, Photoshop's rule). Type ▸ Clear Character Overrides puts every letter back to the layer's own settings.
 *
 * A text layer (pcdoc L.text) carries runs: [{s, e, <character keys>}] - s / e = string offsets (e excluded), only
 * the keys that differ from the layer. The layer keeps the paragraph settings (align, leading, the paragraph box).
 * pcdoc.js hands such a text to draw(g, t) / box(t, g) (not on a path, vertical, warped, 3D or a text effect preset -
 * those keep one style). Each piece is drawn by pctype.js's drawRun with its own settings; a line's pieces share one
 * baseline and the line is as tall as its largest letters.
 *
 * Pure (Node: scripts/test-pcruns.js): RUN_KEYS, normRuns, applyRun, styleAt, rangeHas, shiftRuns, pieces, layout,
 * sameMetrics, scale.
 */
(function (root) {
  "use strict";
  const RUN_KEYS = ["font", "weight", "italic", "size", "tracking", "color", "hscale", "vscale", "baseline", "fauxBold", "fauxItalic", "caps", "smallcaps", "pos", "underline", "strike"];
  const LOOKS_ONLY = ["color", "underline", "strike"];          // the letters stay where they are (the typing box can lie over them)
  const DEF = { weight: 400, italic: false, tracking: 0, hscale: 100, vscale: 100, baseline: 0, fauxBold: false, fauxItalic: false, caps: false, smallcaps: false, pos: "", underline: false, strike: false };
  /** a value as the layer would read it (missing = its default) */
  const val = (t, k) => (t && t[k] !== undefined && t[k] !== null ? t[k] : DEF[k] !== undefined ? DEF[k] : undefined);
  const off = (x) => x == null || x === false || x === "";
  const eqv = (a, b) => (off(a) && off(b)) || (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : a === b);
  const propsOf = (r) => { const o = {}; for (const k of RUN_KEYS) if (r[k] !== undefined) o[k] = r[k]; return o; };
  const sameProps = (a, b) => { const A = propsOf(a), B = propsOf(b), ks = new Set(Object.keys(A).concat(Object.keys(B))); for (const k of ks) if (!eqv(A[k], B[k]) || (A[k] === undefined) !== (B[k] === undefined)) return false; return true; };

  /** sorted, inside 0 .. len, no empty ranges, none that only repeat the layer (base), neighbours with the same keys joined */
  function normRuns(runs, len, base) {
    const out = [];
    for (const r0 of (runs || []).slice().sort((a, b) => a.s - b.s)) {
      const s = Math.max(0, Math.min(len, Math.round(+r0.s || 0))), e = Math.max(0, Math.min(len, Math.round(+r0.e || 0)));
      if (e <= s) continue;
      const r = Object.assign({ s, e }, propsOf(r0));
      if (base) for (const k of RUN_KEYS) if (r[k] !== undefined && eqv(r[k], val(base, k))) delete r[k];
      if (!Object.keys(propsOf(r)).length) continue;
      const p = out[out.length - 1];
      if (p && p.e >= r.s && sameProps(p, r)) { p.e = Math.max(p.e, r.e); continue; }
      if (p && p.e > r.s) r.s = p.e;
      if (r.e > r.s) out.push(r);
    }
    return out;
  }
  /** letters s .. e given these settings (a null / undefined value = back to the layer's); the other ranges kept */
  function applyRun(runs, s, e, props, len, base) {
    s = Math.max(0, Math.min(len, s)); e = Math.max(s, Math.min(len, e));
    const out = [], set = (r) => { const o = Object.assign({}, r); for (const k of Object.keys(props)) { if (props[k] == null) delete o[k]; else o[k] = props[k]; } return o; };
    let cur = s;
    for (const r of normRuns(runs, len)) {
      if (r.e <= s || r.s >= e) { out.push(r); continue; }
      if (r.s < s) out.push(Object.assign({}, r, { e: s }));
      const a = Math.max(r.s, s), b = Math.min(r.e, e);
      if (a > cur) out.push(set({ s: cur, e: a }));
      out.push(set(Object.assign({}, r, { s: a, e: b }))); cur = b;
      if (r.e > e) out.push(Object.assign({}, r, { s: e }));
    }
    if (cur < e) out.push(set({ s: cur, e }));
    return normRuns(out, len, base);
  }
  /** the settings letter i is drawn with (the layer's + its range's) */
  function styleAt(t, i) {
    const o = {}; for (const k of RUN_KEYS) if (t[k] !== undefined) o[k] = t[k];
    for (const r of t.runs || []) if (i >= r.s && i < r.e) Object.assign(o, propsOf(r));
    return o;
  }
  /** is key k == v for EVERY letter in s .. e (the bold / italic buttons toggle off then) */
  function rangeHas(t, s, e, k, v) { for (let i = s; i < Math.max(e, s + 1); i++) if (!eqv(val(styleAt(t, i), k), v)) return false; return true; }
  /** every letter in s .. e bold (weight 600 or more)? */
  function allBold(t, s, e) { for (let i = s; i < Math.max(e, s + 1); i++) if ((+val(styleAt(t, i), "weight") || 400) < 600) return false; return true; }
  /** the text changed from a to b: the ranges follow (typed letters take the style of the letter before them; at the
   *  very start, of the one after) */
  function shiftRuns(runs, a, b) {
    if (!runs || !runs.length || a === b) return runs;
    const la = a.length, lb = b.length; let p = 0;
    while (p < la && p < lb && a[p] === b[p]) p++;
    let q = 0; while (q < la - p && q < lb - p && a[la - 1 - q] === b[lb - 1 - q]) q++;
    const oldEnd = la - q, ins = lb - q - p, delta = lb - la;
    const map = (x, start) => (x < p ? x : x > oldEnd ? x + delta : (start && x === 0 ? 0 : p + ins));
    return normRuns(runs.map((r) => Object.assign({}, r, { s: map(r.s, true), e: map(r.e, false) })), lb);
  }
  /** a text cut into pieces of one style: [{s, e, text, st}] per paragraph line (split at "\n") */
  function pieces(t) {
    const str = String(t.str || ""), cuts = new Set([0, str.length]);
    for (const r of t.runs || []) { cuts.add(Math.max(0, Math.min(str.length, r.s))); cuts.add(Math.max(0, Math.min(str.length, r.e))); }
    for (let i = 0; i < str.length; i++) if (str[i] === "\n") { cuts.add(i); cuts.add(i + 1); }
    const xs = [...cuts].sort((a, b) => a - b), pars = [[]];
    for (let k = 0; k < xs.length - 1; k++) {
      const s = xs[k], e = xs[k + 1], tx = str.slice(s, e);
      if (tx === "\n") { pars.push([]); continue; }
      const st = styleAt(t, s); pars[pars.length - 1].push({ s, e, text: st.caps ? tx.toUpperCase() : tx, st });
    }
    return pars;
  }
  const SUPER = 0.583;
  const effSize = (st) => Math.max(1, (+st.size || 48) * (st.pos ? SUPER : 1));
  /** a width / ascent stand-in without a canvas: 0.55 em a letter, a space 0.28 em, the ascent 0.8 em (tests) */
  const emMeasure = { width: (st, s) => Array.from(s).reduce((a, c) => a + (c === " " ? 0.28 : 0.55) * effSize(st) + (+st.tracking || 0) / 1000 * effSize(st), 0) * ((+st.hscale || 100) / 100), ascent: (st) => effSize(st) * 0.8 };
  /** the lines: [{x, y (top), h, base (the baseline below the top), w, items: [{text, st, x, w, s, e}]}] + the box.
   *  A paragraph box (t.box) wraps at spaces (a word wider than the box stays whole); point text does not wrap. */
  function layout(t, M) {
    const m = M || emMeasure, lead = +t.leading || 1.2, box = t.box && t.box.w > 0 ? t.box : null, lines = [];
    const sizeOf = (st) => effSize(Object.assign({}, t, st));
    let y = t.y;
    for (const par of pieces(t)) {
      // words (with their spaces) made of pieces, so a wrap never splits a style mid-word
      const toks = []; let tok = null;
      for (const pc of par) { let at = pc.s; for (const part of pc.text.split(/( +)/).filter((x) => x.length)) {
        const sp = /^ +$/.test(part);
        if (!tok || tok.sp !== sp) { tok = { sp, items: [] }; toks.push(tok); }
        tok.items.push({ text: part, st: pc.st, s: at, e: at + part.length }); at += part.length;
      } }
      const width = (it) => m.width(it.st, it.text);
      const rows = [[]]; let rowW = 0;
      for (const tk of toks) {
        const w = tk.items.reduce((a, it) => a + width(it), 0);
        if (box && !tk.sp && rowW > 0 && rowW + w > box.w + 0.5) { while (rows[rows.length - 1].length && /^ +$/.test(rows[rows.length - 1][rows[rows.length - 1].length - 1].text)) rows[rows.length - 1].pop(); rows.push([]); rowW = 0; }
        if (box && tk.sp && rowW === 0) continue;                       // no spaces at the start of a wrapped line
        for (const it of tk.items) rows[rows.length - 1].push(it);
        rowW += w;
      }
      for (const row of rows) {
        let asc = 0, big = 0, x = 0;
        const base = row.length ? row : [{ text: "", st: (par[0] && par[0].st) || styleAt(t, 0) }];
        for (const it of base) { asc = Math.max(asc, m.ascent(Object.assign({}, t, it.st))); big = Math.max(big, sizeOf(it.st)); }
        const items = row.map((it) => { const w = width(it), o = Object.assign({}, it, { x, w }); x += w; return o; });
        const w = x, h = big * lead;
        const align = t.justify ? (t.justify === "all" ? "left" : t.justify) : t.align || "left";
        let x0;
        if (box) x0 = align === "center" ? t.x + (box.w - w) / 2 : align === "right" ? t.x + box.w - w : t.x;
        else x0 = align === "center" ? t.x - w / 2 : align === "right" ? t.x - w : t.x;
        items.forEach((it) => { it.x += x0; });
        // the first line's top stays at t.y; the next ones go down by their own height (the tallest letters)
        lines.push({ x: x0, y, h, base: asc, w, items, over: !!box && y + h > t.y + box.h + 0.5 });
        y += h;
      }
    }
    let bx;
    if (box) bx = { x: t.x, y: t.y, w: box.w, h: box.h };
    else { const x0 = Math.min(...lines.map((l) => l.x)), x1 = Math.max(...lines.map((l) => l.x + l.w)); bx = { x: x0, y: t.y, w: Math.max(1, x1 - x0), h: Math.max(1, y - t.y) }; }
    return { lines, box: bx, overflow: lines.some((l) => l.over) };
  }
  /** only colours / lines differ - the letters sit where the layer's own settings put them */
  const sameMetrics = (t) => (t.runs || []).every((r) => Object.keys(propsOf(r)).every((k) => LOOKS_ONLY.includes(k)));
  /** Image Size / a scaled layer: sizes and baseline shifts in the ranges too */
  function scale(t, k) { for (const r of (t && t.runs) || []) { if (r.size) r.size = Math.max(1, r.size * k); if (r.baseline) r.baseline *= k; } }
  const has = (t) => !!(t && Array.isArray(t.runs) && t.runs.length);
  /** pcdoc draws it with us: ranges, and not a path / vertical / warped / 3D text or a text effect preset */
  const owns = (t) => has(t) && !t.fx && !(root.PCType && root.PCType.pctextOnly ? root.PCType.pctextOnly(t) : (t.vertical || (t.path && t.path.kind)));

  /* ================================ the page ================================ */
  function canvasM(g) {
    const T = root.PCType;
    return {
      width: (st, s) => (T && T.canvasMeasure ? T.canvasMeasure(st, g)(s) : emMeasure.width(st, s)),
      ascent: (st) => (T && T.baseOff ? T.baseOff(g, st, effSize(st)) : effSize(st) * 0.8),
    };
  }
  /** the text drawn into g: each piece with its own settings on its line's baseline (+ its underline / strikethrough) */
  function draw(g, t) {
    const T = root.PCType, Lo = layout(t, canvasM(g));
    for (const ln of Lo.lines) {
      if (ln.over) continue;
      for (const it of ln.items) {
        const st = Object.assign({}, t, it.st), es = effSize(st), bl = ln.y + ln.base;
        if (T && T.drawRun) T.drawRun(g, st, it.text, it.x, bl - T.baseOff(g, st, es));
        else { g.save(); g.font = (root.PCDoc ? root.PCDoc.fontCss(st) : `${st.size}px sans-serif`); g.fillStyle = st.color || "#000"; g.textBaseline = "alphabetic"; g.fillText(it.text, it.x, bl); g.restore(); }
        if ((st.underline || st.strike) && it.text.trim()) {
          const th = Math.max(1, es / 14), shift = -(+st.baseline || 0) + (st.pos === "sub" ? (+st.size || 48) * 0.45 : 0);
          g.save(); g.fillStyle = st.color || "#000";
          if (st.underline) g.fillRect(it.x, bl + shift + es * 0.12, it.w, th);
          if (st.strike) g.fillRect(it.x, bl + shift - es * 0.28, it.w, th);
          g.restore();
        }
      }
    }
    return Lo;
  }
  function box(t, g) {
    const Lo = layout(t, canvasM(g)), b = Lo.box;
    let extra = 0; for (const r of t.runs || []) { extra = Math.max(extra, Math.abs(+r.baseline || 0), r.fauxItalic ? (+r.size || +t.size || 48) * 0.25 : 0); }
    return { x: Math.floor(b.x - extra * 0.2), y: Math.floor(b.y - extra), w: Math.ceil(b.w + extra * 1.2) + 1, h: Math.ceil(b.h + extra * 2) + 1 };
  }

  function install(E) {
    const { doc, say } = E;
    if (!E.ui || !E.setLayer) return;
    /** the letters picked while typing: {L, s, e} (s < e), else null */
    function range() {
      const ed = E.textEditing && E.textEditing(); if (!ed || !ed.ta) return null;
      const s = ed.ta.selectionStart, e = ed.ta.selectionEnd; if (!(e > s)) return null;
      return { L: ed.L, ta: ed.ta, s, e };
    }
    /** settings for the picked letters only (one undo step); the typing box keeps its selection */
    function setRange(label, props, R) {
      R = R || range(); if (!R) return false;
      const L = R.L;
      E.setLayer(L, label + " (letters " + (R.s + 1) + "-" + R.e + ")", (x) => { x.text.runs = applyRun(x.text.runs, R.s, R.e, props, String(x.text.str || "").length, x.text); if (!x.text.runs.length) delete x.text.runs; });
      setTimeout(() => { try { R.ta.focus(); R.ta.setSelectionRange(R.s, R.e); } catch (e) { /* closed */ } if (E.placeText) E.placeText(); }, 0);
      say(`${label}: letters ${R.s + 1} - ${R.e} only (nothing picked = the whole layer)`);
      return true;
    }
    E.runs = { range, setRange, clear: () => { const L = E.layer(); if (!L || L.type !== "text" || !has(L.text)) return say("no per-letter settings on this layer"); E.setLayer(L, "clear character overrides", (x) => { delete x.text.runs; }); } };
    // the typing box stays open while the options bar / the Character panel is used
    E.keepTyping = (el) => !!(el && el.closest && el.closest("#kxBar, #pcChar, #pcPara"));
    // the options bar and the Character panel: with letters picked, their change goes to those letters only
    const MAP = {
      ptFont: ["change", "font", (el) => ({ font: el.value })],
      ptBold: ["click", "bold", (el, R) => ({ weight: allBold(R.L.text, R.s, R.e) ? 400 : 700 })],
      ptItal: ["click", "italic", (el, R) => ({ italic: !rangeHas(R.L.text, R.s, R.e, "italic", true) })],
      ptTSize: ["change", "text size", (el) => ({ size: Math.max(1, +el.value || 48) })],
      ptTrack: ["change", "tracking", (el) => ({ tracking: +el.value || 0 })],
      ptTCol: ["change", "text colour", (el) => ({ color: el.value })],
      pcyFont: ["change", "font", (el) => ({ font: el.value })],
      pcyStyle: ["change", "font style", (el) => ({ weight: /b/.test(el.value) ? 700 : 400, italic: /i/.test(el.value) })],
      pcySize: ["change", "text size", (el) => ({ size: Math.max(1, +el.value || 48) })],
      pcyTrack: ["change", "tracking", (el) => ({ tracking: +el.value || 0 })],
      pcyVS: ["change", "vertical scale", (el) => ({ vscale: Math.max(1, +el.value || 100) })],
      pcyHS: ["change", "horizontal scale", (el) => ({ hscale: Math.max(1, +el.value || 100) })],
      pcyBase: ["change", "baseline shift", (el) => ({ baseline: +el.value || 0 })],
      pcyCol: ["change", "text colour", (el) => ({ color: el.value })],
      pcyFB: ["click", "faux bold", (el, R) => ({ fauxBold: !rangeHas(R.L.text, R.s, R.e, "fauxBold", true) })],
      pcyFI: ["click", "faux italic", (el, R) => ({ fauxItalic: !rangeHas(R.L.text, R.s, R.e, "fauxItalic", true) })],
      pcyCaps: ["click", "all caps", (el, R) => ({ caps: !rangeHas(R.L.text, R.s, R.e, "caps", true) })],
      pcySC: ["click", "small caps", (el, R) => ({ smallcaps: !rangeHas(R.L.text, R.s, R.e, "smallcaps", true) })],
      pcyU: ["click", "underline", (el, R) => ({ underline: !rangeHas(R.L.text, R.s, R.e, "underline", true) })],
      pcyS: ["click", "strikethrough", (el, R) => ({ strike: !rangeHas(R.L.text, R.s, R.e, "strike", true) })],
      pcySup: ["click", "superscript", (el, R) => ({ pos: rangeHas(R.L.text, R.s, R.e, "pos", "super") ? null : "super" })],
      pcySub: ["click", "subscript", (el, R) => ({ pos: rangeHas(R.L.text, R.s, R.e, "pos", "sub") ? null : "sub" })],
    };
    const catcher = (ev) => {
      const el = ev.target && ev.target.closest ? ev.target.closest("[id]") : null; if (!el) return;
      const m = MAP[el.id]; if (!m || m[0] !== ev.type) return;
      const R = range(); if (!R) return;                                  // nothing picked: the whole layer, as before
      ev.stopPropagation(); ev.preventDefault();
      setRange(m[1], m[2](el, R), R);
    };
    // capture on the document: before the bar's / panel's own handlers (their elements are re-made on each paint)
    doc.addEventListener("change", catcher, true);
    doc.addEventListener("click", catcher, true);
    // a click on a button would take the focus from the typing box - keep its letters picked
    doc.addEventListener("mousedown", (ev) => { const el = ev.target && ev.target.closest ? ev.target.closest("button[id]") : null; if (el && MAP[el.id] && range()) ev.preventDefault(); }, true);
    if (E.ui.addCmd) E.ui.addCmd("type.clearruns", "Type: Clear Character Overrides", "", () => E.runs.clear(), { enabled: () => { const L = E.layer(); return !!(L && L.type === "text" && has(L.text)); } }, ["Layer", "type.point"]);
  }

  const PCRuns = { RUN_KEYS, LOOKS_ONLY, normRuns, applyRun, styleAt, rangeHas, allBold, shiftRuns, pieces, layout, emMeasure, sameMetrics, scale, has, owns, draw, box, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PCRuns;
  if (root && root.document) root.PCRuns = PCRuns;
})(typeof window !== "undefined" ? window : globalThis);
