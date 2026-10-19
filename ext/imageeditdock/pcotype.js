/* pcotype.js — OPENTYPE TYPE: features, optical kerning and type -> outlines (2.466.0), window.PCOType.
 *
 * Tim (verbatim): "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor"
 * - the type rows of the gap list: OpenType features, optical kerning, Convert to Shape / Create Work Path for type.
 *
 * A canvas cannot switch a font's OpenType features, so a text that asks for them (t.ot - {liga: false, dlig: true,
 * frac: true, ss01: true ...}, or t.kern = "optical") is SHAPED here with the font's own file (static/vendor fontkit,
 * MIT - GSUB / GPOS) and drawn as glyph outlines. The file comes from the computer (/api/fonts/file, lib/fontFiles.js);
 * while it loads, or when the computer has no file for the family, the canvas draws the text as before (no features).
 *
 *   FEATURES / SETS          the features the Character panel offers (+ stylistic sets ss01 - ss20)
 *   featuresOf(t)            t's fontkit feature settings (kern off for optical kerning / "0")
 *   engineOn(t)              does t want the shaping (features or optical kerning)?
 *   toSubs(cmds, xf)         a glyph's path commands (font units, y up) -> pcpath sub-paths through xf(x, y) -> [X, Y]
 *   inkSpan(cmds, y)         the glyph's leftmost / rightmost ink at height y (font units) - its contours flattened
 *   opticalGap(fa, fb, adv, em, lo, hi)   the mean white between two glyphs placed adv apart (font units), each band's
 *                            gap capped at 0.3 em - optical kerning sets every pair's mean to the font's own "nn" / "oo"
 *   shapeRun(font, str, o)   -> {glyphs [{g, x, y}], width} (px): o.size, o.feats, o.tracking (px per glyph), o.optical
 *   outline(font, str, o)    -> pcpath sub-paths of a run drawn at (o.x, o.baseline) with o.hs / o.vs / o.skew
 * The page side: lib() (fontkit, lazily), fontFor(t) (the cached font or null - and loads it), whenReady(f), drawRun.
 */
(function (root) {
  "use strict";
  const FEATURES = [["liga", "Standard Ligatures", "fi"], ["dlig", "Discretionary Ligatures", "st"], ["calt", "Contextual Alternates", "↔a"], ["swsh", "Swash", "𝒜"],
    ["salt", "Stylistic Alternates", "a↺"], ["titl", "Titling Alternates", "T̄"], ["ordn", "Ordinals", "1ˢᵗ"], ["frac", "Fractions", "½"], ["onum", "Oldstyle Figures", "1₉"],
    ["lnum", "Lining Figures", "19"], ["tnum", "Tabular Figures", "1|9"], ["zero", "Slashed Zero", "0̸"], ["smcp", "Small Caps (the font's own)", "ᴀʙ"], ["sups", "Superiors", "x²"], ["subs", "Inferiors", "x₂"]];
  const SETS = Array.from({ length: 20 }, (_, i) => "ss" + String(i + 1).padStart(2, "0"));
  const ON_BY_DEFAULT = new Set(["liga", "calt", "kern"]);
  const otOf = (t) => (t && t.ot && typeof t.ot === "object" ? t.ot : {});
  const engineOn = (t) => !!t && (t.kern === "optical" || Object.keys(otOf(t)).some((k) => !!otOf(t)[k] !== ON_BY_DEFAULT.has(k)));
  function featuresOf(t) {
    const o = {}, ot = otOf(t);
    for (const [k] of FEATURES) if (k in ot) o[k] = !!ot[k];
    for (const k of SETS) if (ot[k]) o[k] = true;
    if (t && (t.kern === "optical" || t.kern === "none")) o.kern = false;
    return o;
  }

  /* ================================ outlines (pure) ================================ */
  /** glyph commands -> pcpath subs (closed contours; quadratics as cubics) through xf */
  function toSubs(cmds, xf) {
    const subs = []; let cur = null, last = null, start = null;
    const A = (p) => ({ x: p[0], y: p[1], ix: p[0], iy: p[1], ox: p[0], oy: p[1] });
    const close = () => {
      if (!cur || cur.pts.length < 2) { cur = null; return; }
      const f = cur.pts[0], l = cur.pts[cur.pts.length - 1];
      if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) { f.ix = l.ix; f.iy = l.iy; cur.pts.pop(); }
      if (cur.pts.length >= 2) subs.push(cur); cur = null;
    };
    for (const c of cmds || []) {
      const a = c.args || [];
      if (c.command === "moveTo") { close(); start = [a[0], a[1]]; last = start; cur = { closed: true, op: "add", pts: [A(xf(a[0], a[1]))] }; }
      else if (!cur) continue;
      else if (c.command === "lineTo") { last = [a[0], a[1]]; cur.pts.push(A(xf(a[0], a[1]))); }
      else if (c.command === "quadraticCurveTo") {
        const P0 = last, C = [a[0], a[1]], P = [a[2], a[3]];
        const c1 = xf(P0[0] + 2 / 3 * (C[0] - P0[0]), P0[1] + 2 / 3 * (C[1] - P0[1])), c2 = xf(P[0] + 2 / 3 * (C[0] - P[0]), P[1] + 2 / 3 * (C[1] - P[1])), q = A(xf(P[0], P[1]));
        const prev = cur.pts[cur.pts.length - 1]; prev.ox = c1[0]; prev.oy = c1[1]; q.ix = c2[0]; q.iy = c2[1]; cur.pts.push(q); last = P;
      } else if (c.command === "bezierCurveTo") {
        const c1 = xf(a[0], a[1]), c2 = xf(a[2], a[3]), q = A(xf(a[4], a[5]));
        const prev = cur.pts[cur.pts.length - 1]; prev.ox = c1[0]; prev.oy = c1[1]; q.ix = c2[0]; q.iy = c2[1]; cur.pts.push(q); last = [a[4], a[5]];
      } else if (c.command === "closePath") { if (start && last && (last[0] !== start[0] || last[1] !== start[1])) cur.pts.push(A(xf(start[0], start[1]))); close(); last = start; }
    }
    close();
    return subs;
  }
  /** flattened contours of a glyph (font units): [[x, y] ...][] */
  function polysOf(cmds) {
    const out = []; let cur = null, last = null;
    const N = 8;
    for (const c of cmds || []) {
      const a = c.args || [];
      if (c.command === "moveTo") { if (cur && cur.length > 1) out.push(cur); cur = [[a[0], a[1]]]; last = [a[0], a[1]]; }
      else if (!cur) continue;
      else if (c.command === "lineTo") { cur.push([a[0], a[1]]); last = [a[0], a[1]]; }
      else if (c.command === "quadraticCurveTo") { for (let i = 1; i <= N; i++) { const u = i / N, v = 1 - u; cur.push([v * v * last[0] + 2 * v * u * a[0] + u * u * a[2], v * v * last[1] + 2 * v * u * a[1] + u * u * a[3]]); } last = [a[2], a[3]]; }
      else if (c.command === "bezierCurveTo") { for (let i = 1; i <= N; i++) { const u = i / N, v = 1 - u; cur.push([v * v * v * last[0] + 3 * v * v * u * a[0] + 3 * v * u * u * a[2] + u * u * u * a[4], v * v * v * last[1] + 3 * v * v * u * a[1] + 3 * v * u * u * a[3] + u * u * u * a[5]]); } last = [a[4], a[5]]; }
      else if (c.command === "closePath") { if (cur && cur.length > 1) out.push(cur); cur = null; }
    }
    if (cur && cur.length > 1) out.push(cur);
    return out;
  }
  /** the ink's [left, right] at height y (font units) - null where the glyph has none */
  function inkSpan(polys, y) {
    let lo = Infinity, hi = -Infinity;
    for (const p of polys) for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) { const x = a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]); if (x < lo) lo = x; if (x > hi) hi = x; }
    }
    return lo <= hi ? [lo, hi] : null;
  }
  /** the mean white between glyph a (its contours pa) and glyph b (pb) placed adv apart, over the bands lo..hi (font
   *  units), each band's gap capped at cap - the measure optical kerning evens out */
  function opticalGap(pa, pb, adv, em, lo, hi) {
    const cap = 0.3 * em, n = 12; let sum = 0;
    for (let i = 0; i < n; i++) {
      const y = lo + (hi - lo) * (i + 0.5) / n, A = inkSpan(pa, y), B = inkSpan(pb, y);
      const g = A && B ? adv - A[1] + B[0] : cap;
      sum += Math.max(-cap, Math.min(cap, g));
    }
    return sum / n;
  }
  const polyCache = new WeakMap();
  /** the bands measured: the baseline up to just under the capitals (the same for the rhythm and every pair) */
  const bandTop = (font) => { const em = font.unitsPerEm || 1000; return Math.max(font.xHeight || em * 0.5, font.capHeight || em * 0.7) * 0.95; };
  function polysOfGlyph(g) { if (!g || !g.path) return []; if (!polyCache.has(g)) polyCache.set(g, polysOf(g.path.commands)); return polyCache.get(g); }
  /** the font's own optical rhythm: the mean of "nn" / "oo" (font units) - cached per font */
  const rhythmCache = new WeakMap();
  function rhythmOf(font) {
    if (rhythmCache.has(font)) return rhythmCache.get(font);
    const em = font.unitsPerEm || 1000, lo = 0, hi = bandTop(font);
    let sum = 0, k = 0;
    for (const ch of ["n", "o"]) {
      const run = font.layout(ch + ch, { kern: false, liga: false }); if (run.glyphs.length < 2) continue;
      const p = polysOfGlyph(run.glyphs[0]); if (!p.length) continue;
      sum += opticalGap(p, p, run.positions[0].xAdvance, em, lo, hi); k++;
    }
    const v = k ? sum / k : em * 0.08; rhythmCache.set(font, v); return v;
  }
  /** the extra advance (font units) optical kerning gives the pair a, b */
  function opticalPair(font, a, b, adv) {
    const em = font.unitsPerEm || 1000, pa = polysOfGlyph(a), pb = polysOfGlyph(b);
    if (!pa.length || !pb.length) return 0;
    const hi = bandTop(font);
    const g = opticalGap(pa, pb, adv, em, 0, hi), d = (rhythmOf(font) - g) * 0.8;
    return Math.max(-0.15 * em, Math.min(0.15 * em, d));
  }
  /** a run shaped: {glyphs [{g, x, y}] (px from the run's start, y up), width} */
  function shapeRun(font, str, o) {
    const size = o.size || 48, sc = size / (font.unitsPerEm || 1000), tr = o.tracking || 0;
    const run = font.layout(String(str || ""), o.feats || {});
    const out = []; let pen = 0;
    run.glyphs.forEach((g, i) => {
      const p = run.positions[i] || { xAdvance: 0, yAdvance: 0, xOffset: 0, yOffset: 0 };
      out.push({ g, x: pen + p.xOffset * sc, y: p.yOffset * sc });
      let adv = p.xAdvance;
      if (o.optical && i + 1 < run.glyphs.length) adv += opticalPair(font, g, run.glyphs[i + 1], p.xAdvance);
      pen += adv * sc + tr;
    });
    return { glyphs: out, width: pen, scale: sc };
  }
  /** a run's outlines at (o.x, o.baseline) with o.hs / o.vs (scales) and o.skew (faux italic) -> pcpath subs */
  function outline(font, str, o) {
    const r = shapeRun(font, str, o), hs = o.hs || 1, vs = o.vs || 1, sk = o.skew || 0, subs = [];
    for (const q of r.glyphs) {
      const xf = (x, y) => { const u = q.x + x * r.scale, v = -(q.y + y * r.scale); return [o.x + hs * u + sk * hs * v, o.baseline + vs * v]; };
      subs.push(...toSubs(q.g.path.commands, xf));
    }
    return { subs, width: r.width * hs };
  }

  /* ================================ the page: fonts ================================ */
  const fonts = new Map();       // key -> {font | null, missing, p}
  const ready = [];
  let fkP = null;
  function lib() {
    if (root.fontkit) return Promise.resolve(root.fontkit);
    if (fkP) return fkP;
    fkP = new Promise((res, rej) => {
      const doc = root.document; if (!doc) return rej(new Error("no page"));
      const s = doc.createElement("script"); s.src = "/static/vendor/fontkit.umd.min.js";
      s.onload = () => (root.fontkit ? res(root.fontkit) : rej(new Error("fontkit did not load"))); s.onerror = () => rej(new Error("fontkit did not load"));
      doc.head.appendChild(s);
    });
    return fkP;
  }
  /** the families to try for a text: its own name, then its CSS stack's (the generic last) */
  function familiesOf(t) {
    const D = root.PCDoc, name = String((t && t.font) || "Arial"), st = D && D.FONT_STACK && D.FONT_STACK[name];
    const list = [name].concat(st ? st.split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")) : ["sans-serif"]);
    return [...new Set(list.filter(Boolean))];
  }
  const keyOf = (t) => familiesOf(t)[0] + "|" + (((t && t.weight) || 400) >= 600 ? 1 : 0) + "|" + (t && t.italic ? 1 : 0);
  /** load (once) the font file of t: -> Promise<font | null> */
  function load(t) {
    const k = keyOf(t);
    if (fonts.has(k)) return fonts.get(k).p;
    const rec = { font: null, missing: false, p: null, file: "" };
    rec.p = (async () => {
      let fk; try { fk = await lib(); } catch (e) { rec.missing = true; return null; }
      const bold = ((t.weight || 400) >= 600) ? 1 : 0, it = t.italic ? 1 : 0;
      for (const fam of familiesOf(t)) {
        try {
          const r = await root.fetch(`/api/fonts/file?family=${encodeURIComponent(fam)}&bold=${bold}&italic=${it}`);
          if (!r.ok) continue;
          const buf = new Uint8Array(await r.arrayBuffer());
          let f = fk.create(buf); if (f && f.fonts && !f.layout) f = f.fonts[0];          // a collection: its first font
          if (f && f.layout) { rec.font = f; rec.file = decodeURIComponent(r.headers.get("X-Font-File") || fam); break; }
        } catch (e) { /* the next family */ }
      }
      rec.missing = !rec.font;
      for (const f of ready.slice()) { try { f(t, rec.font); } catch (e) { /* a listener's own trouble */ } }
      return rec.font;
    })();
    fonts.set(k, rec);
    return rec.p;
  }
  /** the font of t now (null while it loads / when the computer has none) - asking starts the load */
  function fontFor(t) { const k = keyOf(t); if (!fonts.has(k)) load(t); const r = fonts.get(k); return r ? r.font : null; }
  const stateOf = (t) => { const r = fonts.get(keyOf(t)); return !r ? "none" : r.font ? "ready" : r.missing ? "missing" : "loading"; };
  const fileOf = (t) => { const r = fonts.get(keyOf(t)); return r && r.file ? r.file : ""; };
  function whenReady(f) { ready.push(f); }
  /** draw a run's glyphs into g at the current transform's (0, 0) baseline (fill; stroke too for faux bold) */
  function drawRun(g, font, str, o, fauxBold) {
    const r = shapeRun(font, str, o);
    g.beginPath();
    for (const q of r.glyphs) for (const c of q.g.path.commands) {
      const a = c.args, X = (x) => q.x + x * r.scale, Y = (y) => -(q.y + y * r.scale);
      if (c.command === "moveTo") g.moveTo(X(a[0]), Y(a[1]));
      else if (c.command === "lineTo") g.lineTo(X(a[0]), Y(a[1]));
      else if (c.command === "quadraticCurveTo") g.quadraticCurveTo(X(a[0]), Y(a[1]), X(a[2]), Y(a[3]));
      else if (c.command === "bezierCurveTo") g.bezierCurveTo(X(a[0]), Y(a[1]), X(a[2]), Y(a[3]), X(a[4]), Y(a[5]));
      else if (c.command === "closePath") g.closePath();
    }
    g.fill("nonzero");
    if (fauxBold) g.stroke();
    return r.width;
  }

  const PCOType = { FEATURES, SETS, ON_BY_DEFAULT, engineOn, featuresOf, toSubs, polysOf, inkSpan, opticalGap, opticalPair, rhythmOf, shapeRun, outline,
    lib, familiesOf, keyOf, load, fontFor, stateOf, fileOf, whenReady, drawRun, _fonts: fonts };
  if (typeof module !== "undefined" && module.exports) module.exports = PCOType;
  else root.PCOType = PCOType;
})(typeof window !== "undefined" ? window : globalThis);
