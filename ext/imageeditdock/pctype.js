/* pctype.js — THE IMAGE EDITOR'S CHARACTER AND PARAGRAPH PANELS, PARAGRAPH (AREA) TYPE, CHARACTER / PARAGRAPH STYLES
 * (2.426.0), window.PCType.
 *
 * Tim: "continue with the photoshop gap closure" - the order he agreed for after the Bézier tool: "2.426.0 Character /
 * Paragraph panels + styles". Photoshop's, our own code; a text layer (pcdoc L.text) can now also carry (all optional,
 * all undoable, saved with the layer):
 *
 *   CHARACTER   hscale / vscale (%), baseline (px, + = up), kern ("metrics" | "none"), fauxBold, fauxItalic, smallcaps,
 *               pos ("super" | "sub") - next to pcdoc's font / weight / italic / size / leading / tracking / color and
 *               pctext's caps / underline / strike
 *   PARAGRAPH   justify ("left" | "center" | "right" | "all" - justified, the last line so), indL / indR / indF (px:
 *               left, right, first line), spB / spA (space before / after a paragraph, px), hyph (hyphenate long words)
 *   AREA TYPE   box {w, h}: PARAGRAPH TEXT - the Type tool's drag draws the box; the text wraps in it (t.x / t.y = its
 *               top-left), what does not fit is hidden (the box's corner shows ⊞); Type ▸ Convert to Paragraph / Point Text
 *   STYLES      Character Styles and Paragraph Styles (kept with the app, like custom shapes): new from the text,
 *               apply (the layer remembers cstyle / pstyle), redefine, clear override, delete
 *
 * The layout is pure (Node: scripts/test-pstype.js): wrapLine, layout(t, measure) -> lines {text, x, y, w, gap, last,
 * over}; measureOf (an em-based stand-in without a canvas). The page draws them (draw / drawAt / box) - pcdoc hands
 * a text it "owns" to it (not on a path, vertical, warped or 3D - pctext's), pctext's straight block (warp / 3D) uses
 * drawAt too.
 */
(function (root) {
  "use strict";
  const CHAR_KEYS = ["font", "weight", "italic", "size", "leading", "tracking", "color", "hscale", "vscale", "baseline", "kern", "fauxBold", "fauxItalic", "caps", "smallcaps", "pos", "underline", "strike", "ot"];   // 2.466.0: + OpenType features (pcotype.js)
  const PARA_KEYS = ["align", "justify", "indL", "indR", "indF", "spB", "spA", "hyph"];
  const SUPER = 0.583, SMALL = 0.75;
  const n0 = (v) => (isFinite(+v) ? +v : 0);
  /** does a text need this layout (anything the plain one cannot do)? */
  function wants(t) {
    if (!t) return false;
    return !!(t.box || t.area || (t.hscale && +t.hscale !== 100) || (t.vscale && +t.vscale !== 100) || n0(t.baseline) || t.kern === "none" || t.fauxBold || t.fauxItalic
      || t.smallcaps || t.pos || t.justify || n0(t.indL) || n0(t.indR) || n0(t.indF) || n0(t.spB) || n0(t.spA)
      || !!(root.PCOType && root.PCOType.engineOn(t)));                   // 2.466.0: OpenType features / optical kerning (pcotype.js)
  }
  /** a text pctext draws (path, vertical, warp, 3D) is not ours */
  const pctextOnly = (t) => !!(t && ((t.env && Array.isArray(t.env.poly) && t.env.poly.length > 2) || t.vertical || (t.path && t.path.kind) || (t.warp && t.warp.style && t.warp.style !== "none" && t.warp.bend) || (t.extrude && t.extrude.on)));
  const owns = (t) => wants(t) && !pctextOnly(t);
  const effSize = (t) => Math.max(1, (+t.size || 48) * (t.pos ? SUPER : 1));
  const strOf = (t) => (t.caps ? String(t.str || "").toUpperCase() : String(t.str || ""));
  /** small caps: [[text, small?] ...] runs */
  function runs(s, t) {
    if (!t.smallcaps) return [[s, false]];
    const out = []; let cur = "", sm = null;
    for (const ch of Array.from(s)) {
      const isSm = ch !== ch.toUpperCase() && ch.toLowerCase() === ch;
      if (sm === null) sm = isSm;
      if (isSm !== sm) { out.push([sm ? cur.toUpperCase() : cur, sm]); cur = ""; sm = isSm; }
      cur += ch;
    }
    if (cur) out.push([sm ? cur.toUpperCase() : cur, sm]);
    return out;
  }
  /** a width function for a text with no canvas: 0.55 em a letter, a space 0.28 em (tests, Node) */
  function measureOf(t) {
    const es = effSize(t), hs = (+t.hscale || 100) / 100, tr = n0(t.tracking) / 1000 * es;
    const w1 = (s, size) => Array.from(s).reduce((a, c) => a + (c === " " ? 0.28 : 0.55) * size + tr, 0);
    return (s) => runs(s, t).reduce((a, [r, sm]) => a + w1(r, sm ? es * SMALL : es), 0) * hs;
  }

  /* ================================ the layout (pure) ================================ */
  /** split one paragraph into lines no wider than `avail(first)`; a word wider than the line is broken (hyphenated
   *  when asked and long enough) */
  function wrapLine(par, availIn, measure, hyph) {
    let avail = availIn;
    const fit = typeof avail === "function" ? avail : () => availIn;
    if (!isFinite(fit(true)) || fit(true) <= 0) return [par];
    avail = fit;
    const lines = []; let line = "", first = true;
    const words = par.split(/( +)/).filter((x) => x.length);
    const room = () => avail(first);
    const push = () => { lines.push(line.replace(/ +$/, "")); line = ""; first = false; };
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (/^ +$/.test(w)) { if (line) line += w; continue; }
      const cand = line + w;
      if (measure(cand.replace(/ +$/, "")) <= room() || !line && measure(w) <= room()) { line = cand; continue; }
      if (line) { push(); }
      // the word alone does not fit: break it (a hyphen when asked and both halves have 3+ letters)
      let rest = w;
      while (measure(rest) > room()) {
        let k = rest.length - 1;
        while (k > 1 && measure(rest.slice(0, k) + (hyph ? "-" : "")) > room()) k--;
        if (hyph && rest.length >= 6) k = Math.max(3, Math.min(k, rest.length - 3));
        k = Math.max(1, k);
        line = rest.slice(0, k) + (hyph && k >= 3 && rest.length - k >= 3 ? "-" : ""); push();
        rest = rest.slice(k);
      }
      line = rest;
    }
    if (line || !lines.length) lines.push(line.replace(/ +$/, ""));
    return lines;
  }
  /** the lines of a text: [{text, x, y, w, gap (extra px per space when justified), last, over, par}] + the block's box.
   *  y = the line's top (pcdoc draws with textBaseline "top"). measure(s) = the drawn width of s. */
  /* ---- 2.466.0: TEXT IN A SHAPE - area type flowing inside any closed outline (t.area.poly, relative to t.x / t.y) ---- */
  /** the inside spans of a polygon at height y: [[x0, x1] ...] (even-odd) */
  function spansAt(poly, y) {
    const xs = [];
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
    xs.sort((a, b) => a - b); const out = []; for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]); return out;
  }
  /** a line band's room: the widest span at its middle, narrowed to what its top and bottom also have */
  function bandSpan(poly, y0, y1) {
    const mid = spansAt(poly, (y0 + y1) / 2); if (!mid.length) return null;
    let best = mid.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
    for (const yy of [y0 + 0.08 * (y1 - y0), y1 - 0.08 * (y1 - y0)]) {
      const sp = spansAt(poly, yy).find((s) => s[0] < best[1] && s[1] > best[0]); if (!sp) return null;
      best = [Math.max(best[0], sp[0]), Math.min(best[1], sp[1])];
    }
    return best[1] - best[0] > 1 ? best : null;
  }
  function areaLayout(t, m, poly, size, lh) {
    const indL = n0(t.indL), indR = n0(t.indR), indF = n0(t.indF), spB = n0(t.spB), spA = n0(t.spA);
    const ys = poly.map((p) => p[1]), bottom = Math.max(...ys), out = [];
    let y = Math.min(...ys);
    const roomAt = (first) => {          // the next band with room for a letter or two (steps down a quarter line at a time)
      while (y + lh <= bottom + 0.5) { const sp = bandSpan(poly, y, y + lh); if (sp && sp[1] - sp[0] - indL - indR - (first ? indF : 0) >= size * 0.8) return sp; y += lh / 4; }
      return null;
    };
    strOf(t).split("\n").forEach((par, pi) => {
      if (pi > 0) y += spB;
      const lines = []; let first = true, sp = roomAt(true), line = "";
      const emit = (text, over) => { lines.push({ text: text.replace(/ +$/, ""), sp, y, first, over: over || !sp }); y += lh; first = false; sp = over ? null : roomAt(false); };
      const avail = () => (sp ? sp[1] - sp[0] - indL - indR - (first ? indF : 0) : Infinity);
      for (const w of par.split(/( +)/).filter((x) => x.length)) {
        if (/^ +$/.test(w)) { if (line) line += w; continue; }
        if (!sp) { line += w; continue; }
        if (m((line + w).replace(/ +$/, "")) <= avail()) { line += w; continue; }
        if (line) { emit(line); line = ""; if (!sp) { line = w; continue; } }
        let rest = w;                                  // a word wider than its line: broken
        while (sp && m(rest) > avail()) { let k = rest.length - 1; while (k > 1 && m(rest.slice(0, k)) > avail()) k--; emit(rest.slice(0, Math.max(1, k))); rest = rest.slice(Math.max(1, k)); }
        line = rest;
      }
      if (line || !lines.length) emit(line, !sp);
      lines.forEach((l, li) => {
        const last = li === lines.length - 1, w = m(l.text), lead = indL + (l.first ? indF : 0);
        if (!l.sp) { out.push({ text: l.text, x: t.x, y: l.y, w, gap: 0, last, over: true, par: pi, first: l.first }); return; }
        const left = l.sp[0] + lead, a = l.sp[1] - indR - left;
        const align = t.justify && (!last || t.justify === "all") ? "justify" : (t.justify && last ? t.justify : t.align || "left");
        let x = left, gap = 0;
        if (align === "justify") { const spaces = (l.text.match(/ /g) || []).length; gap = spaces && a > w ? (a - w) / spaces : 0; }
        else x = align === "center" ? left + (a - w) / 2 : align === "right" ? left + a - w : left;
        out.push({ text: l.text, x, y: l.y, w: gap ? a : w, gap, last, over: !!l.over, par: pi, first: l.first });
      });
      y += spA;
    });
    const bx = t.box && t.box.w > 0 ? { x: t.x, y: t.y, w: t.box.w, h: t.box.h } : (() => { const xs = poly.map((p) => p[0]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: bottom - Math.min(...ys) }; })();
    return { lines: out, box: bx, lh, overflow: out.some((l) => l.over), area: true };
  }
  function layout(t, measure) {
    const m = measure || measureOf(t), size = +t.size || 48, lh = size * (+t.leading || 1.2);
    if (t.area && Array.isArray(t.area.poly) && t.area.poly.length > 2) return areaLayout(t, m, t.area.poly.map(([x, y]) => [t.x + x, t.y + y]), size, lh);
    const box = t.box && t.box.w > 0 ? t.box : null;
    const indL = n0(t.indL), indR = n0(t.indR), indF = n0(t.indF), spB = n0(t.spB), spA = n0(t.spA);
    const pars = strOf(t).split("\n"), out = [];
    let y = t.y, maxW = 0;
    pars.forEach((par, pi) => {
      if (pi > 0) y += spB;
      const avail = box ? (first) => box.w - indL - indR - (first ? indF : 0) : () => Infinity;
      const ls = wrapLine(par, avail, m, !!t.hyph);
      ls.forEach((text, li) => {
        const first = li === 0, last = li === ls.length - 1, w = m(text), a = avail(first), lead = indL + (first ? indF : 0);
        let x, gap = 0;
        const align = t.justify && (!last || t.justify === "all") ? "justify" : (t.justify && last ? t.justify : t.align || "left");
        if (box) {
          const left = t.x + lead;
          if (align === "justify") { const spaces = (text.match(/ /g) || []).length; gap = spaces && a > w ? (a - w) / spaces : 0; x = left; }
          else x = align === "center" ? left + (a - w) / 2 : align === "right" ? left + a - w : left;
        } else x = align === "center" ? t.x - w / 2 : align === "right" ? t.x - w - indR : t.x + lead;
        const over = !!box && y + lh > t.y + box.h + 0.5;
        out.push({ text, x, y, w: gap ? a : w, gap, last, over, par: pi, first });
        maxW = Math.max(maxW, (gap ? a : w) + (box ? 0 : lead));
        y += lh;
      });
      y += spA;
    });
    const h = y - t.y - spA;
    let bx;
    if (box) bx = { x: t.x, y: t.y, w: box.w, h: box.h };
    else {
      const xs = out.map((l) => l.x), x0 = Math.min(...xs), x1 = Math.max(...out.map((l) => l.x + l.w));
      bx = { x: x0, y: t.y, w: Math.max(1, x1 - x0), h: Math.max(lh, h) };
    }
    return { lines: out, box: bx, lh, overflow: out.some((l) => l.over) };
  }

  /* ================================ the page: measuring and drawing ================================ */
  const fontCss = (t, size) => { const D = root.PCDoc; const tt = Object.assign({}, t, { size }); return D && D.fontCss ? D.fontCss(tt) : `${t.italic ? "italic " : ""}${t.weight || 400} ${Math.max(1, size)}px sans-serif`; };
  /** 2.466.0: the OpenType engine for t - its font (shaped with the font file) when t wants features / optical
   *  kerning and the file is loaded; null = the canvas draws it (and the file loads for next time) */
  const engine = (t) => { const O = root.PCOType; return O && O.engineOn(t) ? O.fontFor(t) : null; };
  const shapeOpts = (t, sz) => ({ size: sz, feats: root.PCOType.featuresOf(t), tracking: n0(t.tracking) / 1000 * effSize(t), optical: t.kern === "optical" });
  function canvasMeasure(t, g) {
    const F = engine(t);
    if (F) { const es = effSize(t), hs = (+t.hscale || 100) / 100; return (s) => runs(s, t).reduce((a, [r, sm]) => a + root.PCOType.shapeRun(F, r, shapeOpts(t, sm ? es * SMALL : es)).width, 0) * hs; }
    if (!g || !g.measureText) return measureOf(t);
    const es = effSize(t), hs = (+t.hscale || 100) / 100, tr = n0(t.tracking) / 1000 * es, cache = new Map();
    const one = (s, size) => { const k = size + "|" + s; if (!cache.has(k)) { g.font = fontCss(t, size); cache.set(k, g.measureText(s).width); } return cache.get(k); };
    return (s) => {
      g.save(); if ("letterSpacing" in g) g.letterSpacing = "0px"; if ("fontKerning" in g) g.fontKerning = t.kern === "none" ? "none" : "normal";
      const w = runs(s, t).reduce((a, [r, sm]) => a + one(r, sm ? es * SMALL : es) + tr * Array.from(r).length, 0) * hs;
      g.restore(); return w;
    };
  }
  const offCache = new Map();
  /** how far below the "top" pcdoc draws at the baseline is, for this font (so turning a setting on does not move it) */
  function baseOff(g, t, size) {
    const f = fontCss(t, size); if (offCache.has(f)) return offCache.get(f);
    g.save(); g.font = f; g.textBaseline = "top"; const a = g.measureText("Hg"); g.textBaseline = "alphabetic"; const b = g.measureText("Hg"); g.restore();
    const off = a.fontBoundingBoxAscent != null && b.fontBoundingBoxAscent != null ? b.fontBoundingBoxAscent - a.fontBoundingBoxAscent : NaN;
    const v = isFinite(off) && off > 0 ? off : size * 0.8; offCache.set(f, v); return v;
  }
  /** one run of text at (x, top) - scales, faux italic / bold, small caps, tracking, baseline shift; returns its width */
  function drawRun(g, t, s, x, top) {
    const es = effSize(t), hs = (+t.hscale || 100) / 100, vs = (+t.vscale || 100) / 100, tr = n0(t.tracking) / 1000 * es, size = +t.size || 48;
    const shift = -n0(t.baseline) + (t.pos === "sub" ? size * 0.45 : 0);
    const kern = t.kern === "none" ? "none" : "normal";
    // the line's baseline: a scaled letter grows up from it (Photoshop's vertical scale)
    const bl = top + shift + baseOff(g, t, es) * (t.pos ? 1 : 1);
    let dx = 0;
    const F = engine(t);
    for (const [r, sm] of runs(s, t)) {
      const sz = sm ? es * SMALL : es;
      if (F) {                                   // 2.466.0: the font's own glyphs, shaped (features, optical kerning)
        g.save(); g.translate(x + dx, bl); g.transform(hs, 0, t.fauxItalic ? -0.21 * hs : 0, vs, 0, 0);
        g.fillStyle = t.color || "#000"; g.strokeStyle = t.color || "#000"; g.lineWidth = Math.max(0.6, sz / 26); g.lineJoin = "round";
        const w = root.PCOType.drawRun(g, F, r, shapeOpts(t, sz), !!t.fauxBold);
        g.restore(); dx += w * hs; continue;
      }
      g.save();
      g.font = fontCss(t, sz); g.textBaseline = "alphabetic"; g.textAlign = "left";
      if ("letterSpacing" in g) g.letterSpacing = tr.toFixed(2) + "px";
      if ("fontKerning" in g) g.fontKerning = kern;
      g.translate(x + dx, bl);
      g.transform(hs, 0, t.fauxItalic ? -0.21 * hs : 0, vs, 0, 0);
      g.fillStyle = t.color || "#000";
      g.fillText(r, 0, 0);
      if (t.fauxBold) { g.lineWidth = Math.max(0.6, sz / 26); g.strokeStyle = t.color || "#000"; g.lineJoin = "round"; g.strokeText(r, 0, 0); }
      g.restore();
      g.save(); g.font = fontCss(t, sz); if ("letterSpacing" in g) g.letterSpacing = "0px"; if ("fontKerning" in g) g.fontKerning = kern;
      dx += (g.measureText(r).width + tr * Array.from(r).length) * hs; g.restore();
    }
    return dx;
  }
  /** a text drawn with this layout into g (the layer's canvas) */
  function draw(g, t) {
    const L = layout(t, canvasMeasure(t, g)), es = effSize(t), th = Math.max(1, es / 14);
    for (const ln of L.lines) {
      if (ln.over) continue;
      let w;
      if (ln.gap > 0) {
        const parts = ln.text.split(/( +)/).filter((x) => x.length); let x = ln.x; const m = canvasMeasure(t, g);
        for (const p of parts) { if (/^ +$/.test(p)) { x += m(p) + ln.gap * p.length; continue; } x += drawRun(g, t, p, x, ln.y); }
        w = ln.w;
      } else w = drawRun(g, t, ln.text, ln.x, ln.y);
      if ((t.underline || t.strike) && ln.text) {
        g.save(); g.fillStyle = t.color || "#000";
        const top = ln.y - n0(t.baseline) + (t.pos === "sub" ? (+t.size || 48) * 0.45 : 0);
        if (t.underline) g.fillRect(ln.x, top + es * 0.95, w, th);
        if (t.strike) g.fillRect(ln.x, top + es * 0.52, w, th);
        g.restore();
      }
    }
    return L;
  }
  /** 2.466.0: the text's OUTLINES with its font file - Type: Convert to Shape / Create Work Path. -> {path} | {err}
   *  (the same lines, runs, scales, faux italic, baseline shift, underline / strike as it is drawn; t.rot turns them) */
  async function outlinesOf(t, g) {
    const O = root.PCOType, Q = root.PCPath, D = root.PCDoc;
    if (!O) return { err: "the OpenType engine (pcotype.js) is not loaded" };
    if (pctextOnly(t)) return { err: "text on a path, vertical, warped or 3D text cannot become outlines here - rasterize it (Layer ▸ Rasterize)" };
    const F = await O.load(t); if (!F) return { err: `no font file for "${t.font}" on this computer (the outlines come from the font's file)` };
    const es = effSize(t), hs = (+t.hscale || 100) / 100, vs = (+t.vscale || 100) / 100, size = +t.size || 48, th = Math.max(1, es / 14);
    const opts = (sz) => ({ size: sz, feats: O.featuresOf(t), tracking: n0(t.tracking) / 1000 * es, optical: t.kern === "optical" });
    const meas = (s) => runs(s, t).reduce((a, [r, sm]) => a + O.shapeRun(F, r, opts(sm ? es * SMALL : es)).width, 0) * hs;
    const Lo = layout(t, meas), subs = [];
    const shift = -n0(t.baseline) + (t.pos === "sub" ? size * 0.45 : 0);
    const rect = (x, y, w, h) => ({ closed: true, op: "add", pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => ({ x: a, y: b, ix: a, iy: b, ox: a, oy: b })) });
    for (const ln of Lo.lines) {
      if (ln.over) continue;
      const bl = ln.y + shift + (g ? baseOff(g, t, es) : es * 0.8);
      const parts = ln.gap > 0 ? ln.text.split(/( +)/).filter((x) => x.length) : [ln.text];
      let x = ln.x;
      for (const p of parts) {
        if (ln.gap > 0 && /^ +$/.test(p)) { x += meas(p) + ln.gap * p.length; continue; }
        for (const [r, sm] of runs(p, t)) { const o = O.outline(F, r, Object.assign(opts(sm ? es * SMALL : es), { x, baseline: bl, hs, vs, skew: t.fauxItalic ? -0.21 : 0 })); subs.push(...o.subs); x += o.width; }
      }
      const w = ln.gap > 0 ? ln.w : x - ln.x, top = ln.y + shift;
      if (t.underline && ln.text) subs.push(rect(ln.x, top + es * 0.95, w, th));
      if (t.strike && ln.text) subs.push(rect(ln.x, top + es * 0.52, w, th));
    }
    let path = { subs };
    // 2.604.0: turned AND skewed / stretched (pcdoc textMat - t.rot + t.xm)
    const M = D && D.textMat ? D.textMat(t) : (+t.rot ? (() => { const r = +t.rot * Math.PI / 180; return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r)]; })() : null);
    if (M && g && D && D.textBox0) {
      const b = D.textBox0(t, g), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const rot = (X, Y) => [cx + M[0] * (X - cx) + M[2] * (Y - cy), cy + M[1] * (X - cx) + M[3] * (Y - cy)];
      path = { subs: subs.map((sb) => Object.assign({}, sb, { pts: sb.pts.map((q) => { const [x, y] = rot(q.x, q.y), [ix, iy] = rot(q.ix, q.iy), [ox, oy] = rot(q.ox, q.oy); return Object.assign({}, q, { x, y, ix, iy, ox, oy }); }) })) };
    }
    if (Q && Q.normalize) path = Q.normalize(path);
    return { path, font: O.fileOf(t), glyphs: subs.length };
  }
  /** pctext's straight block (warp / 3D): the block with its anchor at (ox, oy) */
  const drawAt = (g, t, ox, oy) => draw(g, Object.assign({}, t, { x: ox, y: oy }));
  function box(t, g) {
    const L = layout(t, canvasMeasure(t, g)), b = L.box;
    const extra = Math.abs(n0(t.baseline)) + (t.fauxItalic ? (+t.size || 48) * 0.25 : 0);
    return { x: Math.floor(b.x - (t.fauxItalic ? (+t.size || 48) * 0.05 : 0)), y: Math.floor(b.y - Math.max(0, n0(t.baseline))), w: Math.ceil(b.w + extra) + 1, h: Math.ceil(b.h + Math.abs(n0(t.baseline)) + (t.pos === "sub" ? (+t.size || 48) * 0.3 : 0)) + 1 };
  }
  /** Image Size: the box, indents and spacing scale with the picture */
  function scale(t, kx, ky) {
    if (!t) return;
    if (t.box) t.box = { w: t.box.w * kx, h: t.box.h * ky };
    if (t.area && t.area.poly) t.area = Object.assign({}, t.area, { poly: t.area.poly.map(([x, y]) => [x * kx, y * ky]) });   // 2.466.0
    for (const k of ["indL", "indR", "indF"]) if (t[k]) t[k] *= kx;
    for (const k of ["spB", "spA", "baseline"]) if (t[k]) t[k] *= ky;
  }
  /** a style's settings out of a text (character or paragraph keys) */
  const pick = (t, keys) => { const o = {}; for (const k of keys) if (t[k] !== undefined) o[k] = t[k]; return o; };
  /** does the text still match its style? (no override) */
  const matches = (t, st, keys) => !!st && keys.every((k) => (st.props[k] === undefined && (t[k] === undefined || t[k] === false || t[k] === 0 || t[k] === "")) || JSON.stringify(st.props[k]) === JSON.stringify(t[k]));

  /* ================================ the editor ================================ */
  function install(E) {
    const { S, D, doc, $, say, store, ctx } = E;
    if (!E.ui || !E.tools || !E.tools.type) return;
    const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!doc.getElementById("pctypeCss")) {
      const st = doc.createElement("style"); st.id = "pctypeCss";
      st.textContent = ".kx .pcty{padding:6px;display:flex;flex-direction:column;gap:5px;font-size:12px}.kx .pcty .r{display:flex;gap:5px;align-items:center;flex-wrap:wrap}"
        + ".kx .pcty .r label{display:flex;gap:3px;align-items:center}.kx .pcty input[type=number]{width:54px}.kx .pcty select{max-width:150px}"
        + ".kx .pcty .tg{min-width:26px;padding:2px 4px}.kx .pcty .tg.on{border-color:var(--pc-accent);color:var(--pc-accent)}.kx .pcty .dim{color:var(--pc-dim)}"
        + ".kx .pcty .sty{border:1px solid var(--pc-line);border-radius:4px;max-height:110px;overflow:auto}.kx .pcty .sty div{padding:2px 6px;cursor:pointer}"
        + ".kx .pcty .sty div.on{background:var(--pc-on)}.kx .pcty .sty div i{color:var(--pc-dim);font-style:normal}";
      doc.head.appendChild(st);
    }
    S.typeExtra = store.get("t.extra", {}) || {};
    const cstyles = () => store.get("t.cstyles", []) || [], pstyles = () => store.get("t.pstyles", []) || [];
    const curT = () => { const L = E.layer(); return L && L.type === "text" && L.text ? L : null; };
    /** a change: the active text layer (one undo step), else the next text's defaults */
    function setT(label, f) {
      const L = curT();
      if (L) { E.setLayer(L, label, (x) => { f(x.text); }); }
      else { const tmp = Object.assign({}, E.typeSettings ? E.typeSettings() : {}, S.typeExtra); f(tmp); syncDefaults(tmp); }
      paint();
    }
    function syncDefaults(t) {
      if (t.font) S.typeFont = t.font; if (t.size) S.typeSize = t.size; S.typeBold = (t.weight || 400) >= 600; S.typeItalic = !!t.italic;
      if (t.align) S.typeAlign = t.align; if (t.leading) S.typeLeading = t.leading; S.typeTracking = t.tracking || 0; if (t.color) E.setFg(t.color);
      const ex = {}; for (const k of CHAR_KEYS.concat(PARA_KEYS)) if (!["font", "weight", "italic", "size", "leading", "tracking", "color", "align"].includes(k) && t[k] !== undefined) ex[k] = t[k];
      S.typeExtra = ex; store.set("t.extra", ex);
    }
    // new text takes the panel's extras (the Type tool's own settings stay in pctools)
    const baseSettings = E.typeSettings;
    if (baseSettings) E.typeSettings = () => Object.assign({}, baseSettings(), S.typeExtra || {});
    const view = () => { const L = curT(); return L ? L.text : Object.assign({}, D.TEXT_DEFAULT, E.typeSettings ? E.typeSettings() : {}); };

    /* ---------------- 2.466.0: OpenType (the font's own features) ---------------- */
    function otRow(t) {
      const O = root.PCOType; if (!O) return "";
      const ot = t.ot || {}, on = (k) => (k in ot ? !!ot[k] : O.ON_BY_DEFAULT.has(k)), st = O.engineOn(t) ? O.stateOf(t) : "";
      const ssOn = O.SETS.find((k) => ot[k]) || "";
      const note = st === "ready" ? `· ${esc(O.fileOf(t))}` : st === "loading" ? "· loading the font file…" : st === "missing" ? `· <span style="color:var(--pc-accent)">no file for this font on the computer - drawn without them</span>` : "";
      return `<div class="r" style="margin-top:4px"><b>OpenType</b><span class="dim">${note}</span></div>
        <div class="r">${O.FEATURES.map(([k, name, ic]) => `<button class="ghost tg${on(k) ? " on" : ""}" data-ot="${k}" title="${esc(name)} (${k})">${esc(ic)}</button>`).join("")}
          <select id="pcySS" title="Stylistic Set"><option value="">Stylistic set: none</option>${O.SETS.map((k) => `<option value="${k}"${k === ssOn ? " selected" : ""}>${k}</option>`).join("")}</select></div>`;
    }
    if (root.PCOType) root.PCOType.whenReady(() => {          // a font file arrived: the texts that wait for it are drawn again
      let any = false;
      for (const L of S.layers) if (L.type === "text" && L.text && root.PCOType.engineOn(L.text)) { D.rasterize(L); any = true; }
      if (any) { E.refresh(); E.renderLayersPanel(); } paintChar();
    });
    /** 2.466.0: TEXT IN A SHAPE - a text layer flowing inside a shape layer's closed outline (its biggest component) */
    function areaOfShape(SL) {
      const Q = root.PCPath; if (!Q || !SL || SL.type !== "shape" || !SL.shape) return null;
      const p = SL.shape.kind === "path" && SL.shape.path ? SL.shape.path : (Q.fromShape ? Q.fromShape(SL.shape) : null); if (!p || !p.subs) return null;
      let best = null, ba = 0;
      for (const sb of p.subs) { if (!sb.closed || sb.op === "subtract") continue; const poly = Q.flatten(sb, 0.5); let a = 0; for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length]; a += poly[i][0] * q[1] - q[0] * poly[i][1]; } if (Math.abs(a) > ba) { ba = Math.abs(a); best = poly; } }
      return best && best.length > 2 ? best : null;
    }
    function inPoly(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
    function textInShape(SL0, str) {
      const SL = SL0 || E.layer(), poly = areaOfShape(SL);
      if (!poly) return say("Text in Shape: pick a shape layer with a closed outline first");
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
      const L = E.makeLayer("Text", S.w, S.h, "text");
      L.text = Object.assign({}, D.TEXT_DEFAULT, E.typeSettings ? E.typeSettings() : {}, { str: str || "", x: Math.round(x0), y: Math.round(y0), box: { w: Math.ceil(Math.max(...xs) - x0), h: Math.ceil(Math.max(...ys) - y0) } });
      L.text.area = { poly: poly.map(([x, y]) => [Math.round((x - L.text.x) * 100) / 100, Math.round((y - L.text.y) * 100) / 100]), from: SL.name };
      D.rasterize(L);
      E.addLayer(L, "text in shape", false);
      if (S.tool !== "type") E.setTool("type");
      E.renderOptions(); if (E.editText && str == null) E.editText(L);
      say(`text in "${SL.name}" - it flows inside its outline (Type ▸ Convert to Point Text takes it out)`);
      return L;
    }
    // the Type tool's click inside the PICKED shape layer's closed outline = text in that shape (Photoshop's area type)
    const typeDown = E.tools.type.down;
    E.tools.type.down = function (e, fx, fy) {
      const A = E.layer();
      if (A && A.type === "shape" && !(E.textEditing && E.textEditing()) && !e.altKey) {
        const poly = areaOfShape(A);
        if (poly && inPoly(poly, fx, fy)) { textInShape(A); return false; }
      }
      return typeDown.apply(this, arguments);
    };
    /** Type: Convert to Shape (the text layer becomes a shape layer of its outlines) / Create Work Path */
    async function toShape(workPath) {
      const L = curT(); if (!L) return say("pick a text layer first");
      say("the text's outlines - reading the font file…");
      const r = await outlinesOf(L.text, ctx(L.canvas));
      if (r.err) return say((workPath ? "Create Work Path: " : "Convert to Shape: ") + r.err);
      if (!r.path.subs.length) return say("the text has nothing to outline");
      if (workPath) {
        E.structOp("create work path", () => { S.work = r.path; S.ptarget = { k: "work" }; });
        E.drawOverlay(); say(`work path from "${L.name}" (${r.path.subs.length} contours, ${r.font}) - the Paths panel has it`);
        return r.path;
      }
      const Q = root.PCPath, B = root.PCBez, t = L.text;
      let N = null;
      E.structOp("convert to shape", () => {
        N = E.makeLayer(L.name, S.w, S.h, "shape");
        N.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path: r.path, fill: t.color || "#000000", fillOn: true, stroke: t.color || "#000000", strokeW: 0, strokeOn: false });
        if (B && B.LINE_DEFAULT) N.shape.line = Object.assign({}, B.LINE_DEFAULT);
        for (const k of ["opacity", "blend", "visible", "parent", "styles", "fillOpacity", "clip"]) if (L[k] !== undefined) N[k] = JSON.parse(JSON.stringify(L[k]));
        if (Q && Q.syncShape) Q.syncShape(N.shape); D.rasterize(N);
        S.layers = D.insert(S.layers, N, L.id, false); S.layers = D.remove(S.layers, L.id); S.active = S.layers.indexOf(N);
      });
      E.renderLayersPanel(); say(`"${L.name}" is a shape now (${r.path.subs.length} contours from ${r.font}) - its outline edits with the Direct Selection tool (A)`);
      return N;
    }

    /* ---------------- the Character panel ---------------- */
    const FONTS = Object.keys(D.FONT_STACK).filter((f) => !/^(serif|sans-serif|monospace)$/.test(f));
    const tog = (id, on, label, title) => `<button class="ghost tg${on ? " on" : ""}" id="${id}" title="${esc(title)}">${label}</button>`;
    function paintChar() {
      const box0 = $("pcChar"); if (!box0 || !box0.classList.contains("on")) return;
      const t = view(), L = curT(), st = cstyles(), cur = L && L.text.cstyle;
      const style = (t.weight || 400) >= 600 ? (t.italic ? "bi" : "b") : (t.italic ? "i" : "r");
      box0.innerHTML = `<div class="pcty">
        <div class="dim">${L ? `"${esc(L.name)}"` : "The next text (no text layer picked)"}</div>
        <div class="r"><select id="pcyFont" title="Font family">${FONTS.map((f) => `<option${f === t.font ? " selected" : ""}>${esc(f)}</option>`).join("")}</select>
          <select id="pcyStyle" title="Font style">${[["r", "Regular"], ["b", "Bold"], ["i", "Italic"], ["bi", "Bold Italic"]].map(([v, n]) => `<option value="${v}"${v === style ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="r"><label title="Size (px)">tT <input type="number" id="pcySize" min="1" max="2000" step="0.5" value="${Math.round((t.size || 48) * 10) / 10}"></label>
          <label title="Leading - line height (× the size)">↕ <input type="number" id="pcyLead" min="0.5" max="5" step="0.05" value="${t.leading || 1.2}"></label></div>
        <div class="r"><label title="Kerning: Metrics = the font's own pairs; Optical = from the letters' shapes (needs the font's file); 0 = none">V/A <select id="pcyKern"><option value="metrics"${t.kern !== "none" && t.kern !== "optical" ? " selected" : ""}>Metrics</option><option value="optical"${t.kern === "optical" ? " selected" : ""}>Optical</option><option value="none"${t.kern === "none" ? " selected" : ""}>0</option></select></label>
          <label title="Tracking (1/1000 em)">VA <input type="number" id="pcyTrack" min="-500" max="2000" step="10" value="${t.tracking || 0}"></label></div>
        <div class="r"><label title="Vertical scale (%)">↕T <input type="number" id="pcyVS" min="1" max="1000" value="${t.vscale || 100}"></label>
          <label title="Horizontal scale (%)">↔T <input type="number" id="pcyHS" min="1" max="1000" value="${t.hscale || 100}"></label></div>
        <div class="r"><label title="Baseline shift (px, + = up)">A↑ <input type="number" id="pcyBase" min="-500" max="500" step="0.5" value="${t.baseline || 0}"></label>
          <label title="Colour">Color <input type="color" id="pcyCol" value="${t.color || "#000000"}"></label></div>
        <div class="r">${tog("pcyFB", t.fauxBold, "<b>T</b>", "Faux Bold")}${tog("pcyFI", t.fauxItalic, "<i>T</i>", "Faux Italic")}${tog("pcyCaps", t.caps, "TT", "All Caps")}${tog("pcySC", t.smallcaps, "Tᴛ", "Small Caps")}
          ${tog("pcySup", t.pos === "super", "T¹", "Superscript")}${tog("pcySub", t.pos === "sub", "T₁", "Subscript")}${tog("pcyU", t.underline, "<u>T</u>", "Underline")}${tog("pcyS", t.strike, "<s>T</s>", "Strikethrough")}</div>
        ${otRow(t)}
        <div class="r" style="margin-top:4px"><b>Character Styles</b><span class="dim">${cur ? "· " + esc(cur) + (matches(L.text, st.find((s) => s.name === cur), CHAR_KEYS) ? "" : " +") : ""}</span><span style="flex:1"></span><button class="ghost tg" id="pcyCNew" title="New character style from the text">＋</button><button class="ghost tg" id="pcyCRedef" title="Redefine the applied style from the text">⟲</button>
          <button class="ghost tg" id="pcyCClear" title="Clear override: the text back to its style">⌫</button><button class="ghost tg" id="pcyCDel" title="Delete the picked style">🗑</button></div>
        <div class="sty" id="pcyCList">${st.length ? st.map((s, i) => `<div data-ci="${i}" class="${s.name === cur ? "on" : ""}" title="Click: apply · double-click: rename">${esc(s.name)} <i>${esc(s.props.font || "")} ${s.props.size ? Math.round(s.props.size) + "px" : ""}</i></div>`).join("") : `<div class="dim">None yet - ＋ makes one from the text</div>`}</div>
        
      </div>`;
      const q = (id) => box0.querySelector("#" + id);
      q("pcyFont").onchange = () => setT("font", (x) => { x.font = q("pcyFont").value; });
      q("pcyStyle").onchange = () => { const v = q("pcyStyle").value; setT("font style", (x) => { x.weight = /b/.test(v) ? 700 : 400; x.italic = /i/.test(v); }); };
      const num = (id, label, k, f) => { q(id).onchange = () => { const v = +q(id).value; if (!isFinite(v) || (f ? f(v) : v) === (view()[k] == null ? (k === "hscale" || k === "vscale" ? 100 : k === "leading" ? 1.2 : 0) : view()[k])) return; setT(label, (x) => { x[k] = f ? f(v) : v; }); }; };
      num("pcySize", "text size", "size", (v) => Math.max(1, v)); num("pcyLead", "leading", "leading", (v) => Math.max(0.5, v)); num("pcyTrack", "tracking", "tracking");
      num("pcyVS", "vertical scale", "vscale", (v) => Math.max(1, v)); num("pcyHS", "horizontal scale", "hscale", (v) => Math.max(1, v)); num("pcyBase", "baseline shift", "baseline");
      q("pcyKern").onchange = () => setT("kerning", (x) => { const v = q("pcyKern").value; if (v === "none" || v === "optical") x.kern = v; else delete x.kern; });
      // 2.466.0: OpenType features
      box0.querySelectorAll("[data-ot]").forEach((b) => { b.onclick = () => { const k = b.dataset.ot, O = root.PCOType; setT("OpenType " + k, (x) => { const cur = x.ot && k in x.ot ? !!x.ot[k] : O.ON_BY_DEFAULT.has(k); x.ot = Object.assign({}, x.ot || {}); if (!cur === O.ON_BY_DEFAULT.has(k)) delete x.ot[k]; else x.ot[k] = !cur; if (!Object.keys(x.ot).length) delete x.ot; }); }; });
      const ss = q("pcySS"); if (ss) ss.onchange = () => setT("stylistic set", (x) => { x.ot = Object.assign({}, x.ot || {}); for (const k of root.PCOType.SETS) delete x.ot[k]; if (ss.value) x.ot[ss.value] = true; if (!Object.keys(x.ot).length) delete x.ot; });
      q("pcyCol").onchange = () => setT("text colour", (x) => { x.color = q("pcyCol").value; });
      const flip = (id, label, k) => { q(id).onclick = () => setT(label, (x) => { x[k] = !x[k]; if (!x[k]) delete x[k]; }); };
      flip("pcyFB", "faux bold", "fauxBold"); flip("pcyFI", "faux italic", "fauxItalic"); flip("pcyCaps", "all caps", "caps"); flip("pcySC", "small caps", "smallcaps"); flip("pcyU", "underline", "underline"); flip("pcyS", "strikethrough", "strike");
      q("pcySup").onclick = () => setT("superscript", (x) => { if (x.pos === "super") delete x.pos; else x.pos = "super"; });
      q("pcySub").onclick = () => setT("subscript", (x) => { if (x.pos === "sub") delete x.pos; else x.pos = "sub"; });
      bindStyles(box0, "C", CHAR_KEYS, "t.cstyles", "cstyle", "character style");
    }

    /* ---------------- the Paragraph panel ---------------- */
    function paintPara() {
      const box0 = $("pcPara"); if (!box0 || !box0.classList.contains("on")) return;
      const t = view(), L = curT(), st = pstyles(), cur = L && L.text.pstyle;
      const al = t.justify ? "j" + t.justify : t.align || "left";
      const ab = (v, ic, title) => `<button class="ghost tg${al === v ? " on" : ""}" data-pal="${v}" title="${esc(title)}">${ic}</button>`;
      box0.innerHTML = `<div class="pcty">
        <div class="dim">${L ? `"${esc(L.name)}"` + (L.text.box ? " · paragraph text" : " · point text") : "The next text (no text layer picked)"}</div>
        <div class="r">${ab("left", "⯇≡", "Left align text")}${ab("center", "≡", "Centre text")}${ab("right", "≡⯈", "Right align text")}
          ${ab("jleft", "☰⯇", "Justify last left")}${ab("jcenter", "☰≡", "Justify last centred")}${ab("jright", "☰⯈", "Justify last right")}${ab("jall", "☰☰", "Justify all")}</div>
        <div class="r"><label title="Indent left margin (px)">→▏ <input type="number" id="pcyIL" step="1" value="${t.indL || 0}"></label>
          <label title="Indent right margin (px)">▕← <input type="number" id="pcyIR" step="1" value="${t.indR || 0}"></label></div>
        <div class="r"><label title="Indent first line (px)">↳ <input type="number" id="pcyIF" step="1" value="${t.indF || 0}"></label></div>
        <div class="r"><label title="Add space before paragraph (px)">⤒¶ <input type="number" id="pcySB" min="0" step="1" value="${t.spB || 0}"></label>
          <label title="Add space after paragraph (px)">¶⤓ <input type="number" id="pcySA" min="0" step="1" value="${t.spA || 0}"></label></div>
        <div class="r"><label title="Hyphenate words that do not fit on a line (paragraph text)"><input type="checkbox" id="pcyHy" ${t.hyph ? "checked" : ""}> Hyphenate</label></div>
        <div class="r"><label title="Paragraph text: the text wraps in a box (the Type tool's drag draws one)"><input type="checkbox" id="pcyBox" ${t.box ? "checked" : ""} ${L ? "" : "disabled"}> Paragraph text box</label>
          ${t.box ? `<label title="Box width (px)">W <input type="number" id="pcyBW" min="4" value="${Math.round(t.box.w)}"></label><label title="Box height (px)">H <input type="number" id="pcyBH" min="4" value="${Math.round(t.box.h)}"></label>` : ""}</div>
        ${L && L.text.box && layoutOf(L).overflow ? `<div class="dim" style="color:var(--pc-accent)">⊞ the text does not fit the box - make it larger</div>` : ""}
        <div class="r" style="margin-top:4px"><b>Paragraph Styles</b><span class="dim">${cur ? "· " + esc(cur) + (matches(L.text, st.find((s) => s.name === cur), PARA_KEYS) ? "" : " +") : ""}</span><span style="flex:1"></span><button class="ghost tg" id="pcyPNew" title="New paragraph style from the text">＋</button><button class="ghost tg" id="pcyPRedef" title="Redefine the applied style from the text">⟲</button>
          <button class="ghost tg" id="pcyPClear" title="Clear override: the text back to its style">⌫</button><button class="ghost tg" id="pcyPDel" title="Delete the picked style">🗑</button></div>
        <div class="sty" id="pcyPList">${st.length ? st.map((s, i) => `<div data-pi="${i}" class="${s.name === cur ? "on" : ""}" title="Click: apply · double-click: rename">${esc(s.name)} <i>${esc(s.props.justify ? "justified" : s.props.align || "")}</i></div>`).join("") : `<div class="dim">None yet - ＋ makes one from the text</div>`}</div>
        
      </div>`;
      const q = (id) => box0.querySelector("#" + id);
      box0.querySelectorAll("[data-pal]").forEach((b) => { b.onclick = () => { const v = b.dataset.pal; setT("paragraph alignment", (x) => {
        if (v[0] === "j" && v !== "jleft" || v === "jleft") { x.justify = v.slice(1); if (!x.box) say("justified lines need paragraph text (a box) - the Type tool's drag, or the box below"); }
        else { delete x.justify; if (!x.box && x.align !== v && E.layer() && x === E.layer().text) { const bx = D.textBox(x, ctx(E.layer().canvas)); x.x = v === "center" ? bx.x + bx.w / 2 : v === "right" ? bx.x + bx.w : bx.x; } x.align = v; }
      }); }; });
      const num = (id, label, k, f) => { q(id).onchange = () => { const v = +q(id).value; if (!isFinite(v) || (f ? f(v) : v) === (+view()[k] || 0)) return; setT(label, (x) => { x[k] = f ? f(v) : v; if (!x[k]) delete x[k]; }); }; };
      num("pcyIL", "indent left", "indL"); num("pcyIR", "indent right", "indR"); num("pcyIF", "indent first line", "indF"); num("pcySB", "space before", "spB", (v) => Math.max(0, v)); num("pcySA", "space after", "spA", (v) => Math.max(0, v));
      q("pcyHy").onchange = () => setT("hyphenate", (x) => { if (q("pcyHy").checked) x.hyph = true; else delete x.hyph; });
      q("pcyBox").onchange = () => { if (q("pcyBox").checked) toParagraph(); else toPoint(); };
      const bw = q("pcyBW"), bh = q("pcyBH");
      if (bw) bw.onchange = () => { const v = Math.max(4, +bw.value || 4); if (Math.round(view().box.w) !== v) setT("text box", (x) => { x.box = { w: v, h: x.box.h }; }); };
      if (bh) bh.onchange = () => { const v = Math.max(4, +bh.value || 4); if (Math.round(view().box.h) !== v) setT("text box", (x) => { x.box = { w: x.box.w, h: v }; }); };
      bindStyles(box0, "P", PARA_KEYS, "t.pstyles", "pstyle", "paragraph style");
    }
    const layoutOf = (L) => layout(L.text, canvasMeasure(L.text, ctx(L.canvas)));
    /** the styles list: apply / rename / new / redefine / clear override / delete */
    function bindStyles(box0, P, keys, sk, field, what) {
      const q = (id) => box0.querySelector("#" + id), list = () => store.get(sk, []) || [];
      let picked = -1;
      box0.querySelectorAll(`[data-${P === "C" ? "ci" : "pi"}]`).forEach((row) => {
        const i = +row.dataset[P === "C" ? "ci" : "pi"];
        row.onclick = () => { picked = i; const s = list()[i]; if (!s) return; applyStyle(s, keys, field, what); };
        row.ondblclick = () => { const s = list()[i]; if (!s) return; const nm = (win().prompt ? win().prompt("Style name", s.name) : null); if (nm && nm.trim()) { const l = list(); l[i] = Object.assign({}, s, { name: nm.trim().slice(0, 40) }); store.set(sk, l); paint(); } };
      });
      q(`pcy${P}New`).onclick = () => {
        const t = view(), l = list(), base = P === "C" ? "Character Style " : "Paragraph Style ";
        let k = l.length + 1; while (l.some((s) => s.name === base + k)) k++;
        const s = { name: base + k, props: pick(t, keys) }; l.push(s); store.set(sk, l.slice(-80));
        const L = curT(); if (L) E.setLayer(L, "new " + what, (x) => { x.text[field] = s.name; });
        say(`${what} "${s.name}" made from the text`); paint();
      };
      q(`pcy${P}Redef`).onclick = () => {
        const L = curT(); if (!L || !L.text[field]) return say(`apply a ${what} to the text first`);
        const l = list(), i = l.findIndex((s) => s.name === L.text[field]); if (i < 0) return say(`the ${what} "${L.text[field]}" is gone`);
        l[i] = { name: l[i].name, props: pick(L.text, keys) }; store.set(sk, l);
        // every text with that style follows (one undo step)
        E.structOp("redefine " + what, () => { for (const T of S.layers) if (T.type === "text" && T.text && T.text[field] === l[i].name) { Object.assign(T.text, l[i].props); D.rasterize(T); } });
        say(`${what} "${l[i].name}" redefined`); paint();
      };
      q(`pcy${P}Clear`).onclick = () => {
        const L = curT(); if (!L || !L.text[field]) return say(`no ${what} on this text`);
        const s = list().find((x) => x.name === L.text[field]); if (!s) return say(`the ${what} is gone`);
        applyStyle(s, keys, field, what, true);
      };
      q(`pcy${P}Del`).onclick = () => {
        const l = list(); const L = curT(), i = picked >= 0 ? picked : L ? l.findIndex((s) => s.name === L.text[field]) : -1;
        if (i < 0 || !l[i]) return say(`click a ${what} in the list first`);
        const nm = l[i].name; l.splice(i, 1); store.set(sk, l); say(`${what} "${nm}" deleted`); paint();
      };
    }
    const win = () => (doc.defaultView || root);
    function applyStyle(s, keys, field, what, clear) {
      const L = curT();
      const f = (x) => { for (const k of keys) { if (s.props[k] !== undefined) x[k] = JSON.parse(JSON.stringify(s.props[k])); else if (!["font", "size", "color", "align", "weight", "leading"].includes(k)) delete x[k]; } x[field] = s.name; };
      if (L) E.setLayer(L, (clear ? "clear override: " : "apply ") + what, (x) => f(x.text));
      else { const tmp = Object.assign({}, E.typeSettings ? E.typeSettings() : {}); f(tmp); syncDefaults(tmp); }
      paint();
    }
    function paint() { paintChar(); paintPara(); if (E.ui.props) { try { E.ui.props(); } catch (e) { /* fine */ } } }
    E.ui.character = paintChar; E.ui.paragraph = paintPara;

    /* ---------------- point <-> paragraph text ---------------- */
    function toParagraph(w, h) {
      const L = curT(); if (!L) return say("pick a text layer first");
      if (L.text.box) return;
      const b = D.textBox(L.text, ctx(L.canvas));
      E.setLayer(L, "convert to paragraph text", (x) => {
        const t = x.text, ind = n0(t.indL) + n0(t.indF);
        if ((t.align || "left") !== "left") t.x = b.x - ind;                     // the box's left edge (a left-aligned text keeps its x: its lines start there + the indents)
        t.box = { w: Math.max(20, w || Math.ceil(b.w + ind + n0(t.indR) + t.size)), h: Math.max(20, h || Math.ceil(b.h + t.size)) };
      });
      paint();
    }
    function toPoint() {
      const L = curT(); if (!L || !L.text.box) return;
      const lay = layoutOf(L), hidden = lay.lines.filter((l) => l.over).length;
      E.setLayer(L, "convert to point text", (x) => {
        const t = x.text; t.str = lay.lines.filter((l) => !l.over).reduce((acc, l, i, arr) => acc + l.text + (i < arr.length - 1 ? "\n" : ""), "");
        delete t.box; delete t.area; delete t.justify; const al = t.align || "left"; t.x = al === "center" ? t.x + lay.box.w / 2 : al === "right" ? t.x + lay.box.w : t.x;
      });
      if (hidden) say(`converted to point text - ${hidden} line(s) that did not fit the box were left out`);
      paint();
    }

    /* ---------------- the Type tool: a drag draws a paragraph text box ---------------- */
    const TT = E.tools.type, baseDown = TT.down;
    let tb = null;
    const textAt = (x, y) => {
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i]; if (L.type !== "text" || !D.shown(S.layers, L)) continue;
        if (root.PCText && root.PCText.wants(L.text) && !owns(L.text)) { if (root.PCText.hit(L.text, x, y, ctx(L.canvas))) return i; continue; }
        const b = D.textBox(L.text, ctx(L.canvas)); if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) return i;
      }
      return -1;
    };
    TT.down = function (e, fx, fy) {
      // only the Horizontal Type tool draws boxes (Vertical Type calls this for its click)
      if (S.tool !== "type" || doc.querySelector(".kx textarea.pctext") || textAt(fx, fy) >= 0) return baseDown.call(this, e, fx, fy);
      tb = { x0: fx, y0: fy, x1: fx, y1: fy, e };
    };
    TT.move = function (e, fx, fy) { if (!tb) return; tb.x1 = fx; tb.y1 = fy; E.drawOverlay(); };
    TT.up = function () {
      const b0 = tb; tb = null; E.drawOverlay(); if (!b0) return;
      const w = Math.abs(b0.x1 - b0.x0), h = Math.abs(b0.y1 - b0.y0);
      if (w < 8 || h < 8) return baseDown.call(TT, b0.e, b0.x0, b0.y0);          // a click: point text, as before
      const L = E.makeLayer("Text", S.w, S.h, "text");
      L.text = Object.assign({}, D.TEXT_DEFAULT, E.typeSettings ? E.typeSettings() : {}, { str: "", x: Math.round(Math.min(b0.x0, b0.x1)), y: Math.round(Math.min(b0.y0, b0.y1)), box: { w: Math.round(w), h: Math.round(h) } });
      D.rasterize(L); E.addLayer(L, "new paragraph text", false); E.renderOptions();
      if (E.editText) E.editText(L);
      say("paragraph text: type - it wraps in the box (Paragraph panel: alignment, justify, indents, the box size)");
    };
    E.overlayHooks.push((g, px) => {
      if (tb) { g.strokeStyle = "#2680eb"; g.lineWidth = px; g.setLineDash([4 * px, 3 * px]); g.strokeRect(Math.min(tb.x0, tb.x1), Math.min(tb.y0, tb.y1), Math.abs(tb.x1 - tb.x0), Math.abs(tb.y1 - tb.y0)); g.setLineDash([]); }
      // a paragraph text's box while the Type tool is on it
      const L = curT();
      if (L && L.text.box && (S.tool === "type" || S.tool === "move")) {
        const t = L.text; g.strokeStyle = "rgba(38,128,235,.8)"; g.lineWidth = px; g.setLineDash([3 * px, 3 * px]);
        if (t.area && t.area.poly) { g.beginPath(); t.area.poly.forEach(([x, y], i) => (i ? g.lineTo(t.x + x, t.y + y) : g.moveTo(t.x + x, t.y + y))); g.closePath(); g.stroke(); }   // 2.466.0: text in a shape
        else g.strokeRect(t.x, t.y, t.box.w, t.box.h);
        g.setLineDash([]);
        if (layoutOf(L).overflow) { const z = 5 * px; g.fillStyle = "#fff"; g.fillRect(t.x + t.box.w - z, t.y + t.box.h - z, 2 * z, 2 * z); g.strokeStyle = "#e33"; g.strokeRect(t.x + t.box.w - z, t.y + t.box.h - z, 2 * z, 2 * z); g.beginPath(); g.moveTo(t.x + t.box.w - z * 0.6, t.y + t.box.h); g.lineTo(t.x + t.box.w + z * 0.6, t.y + t.box.h); g.moveTo(t.x + t.box.w, t.y + t.box.h - z * 0.6); g.lineTo(t.x + t.box.w, t.y + t.box.h + z * 0.6); g.stroke(); }
      }
    });

    /* ---------------- commands, panels follow the active layer ---------------- */
    if (E.ui.addCmd) {
      const C = E.ui.addCmd, isT = () => !!curT();
      C("type.para", "Type: Convert to Paragraph Text", "", () => toParagraph(), { enabled: () => isT() && !curT().text.box }, ["Layer", "layer.flatten", true]);
      C("type.point", "Type: Convert to Point Text", "", () => toPoint(), { enabled: () => isT() && !!curT().text.box }, ["Layer", "type.para"]);
      C("type.toshape", "Type: Convert to Shape", "", () => toShape(false), { enabled: isT }, ["Layer", "type.point"]);           // 2.466.0
      C("type.workpath", "Type: Create Work Path", "", () => toShape(true), { enabled: isT }, ["Layer", "type.toshape"]);
      C("type.inshape", "Type: Text in the Picked Shape", "", () => textInShape(), { enabled: () => !!areaOfShape(E.layer()) }, ["Layer", "type.workpath"]);
      C("win.pcChar", "Character", "", () => E.ui.showTab && E.ui.showTab("pcChar"), {}, ["Window", "win.pcSwatches"]);
      C("win.pcPara", "Paragraph", "", () => E.ui.showTab && E.ui.showTab("pcPara"), {}, ["Window", "win.pcChar"]);
    }
    E.ui.typePanels = () => { try { paintChar(); paintPara(); } catch (e) { /* a panel is not open */ } };
    // 2.602.0: + measure (pccaret.js - where a click puts the caret in a paragraph text)
    E.type = { layout: (t) => layout(t, canvasMeasure(t, ctx(E.cv))), measure: (t) => canvasMeasure(t, ctx(E.cv)), toParagraph, toPoint, paint, applyStyle, cstyles, pstyles, toShape, outlinesOf: (t) => outlinesOf(t, ctx(E.cv)), textInShape, areaOfShape };
  }

  const api = { CHAR_KEYS, PARA_KEYS, wants, owns, pctextOnly, runs, measureOf, wrapLine, layout, draw, drawAt, box, scale, pick, matches, install,
    drawRun, canvasMeasure, baseOff, effSize, outlinesOf, spansAt, bandSpan };   // 2.449.0: pcruns.js draws each piece with these
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCType = api;
})(typeof window !== "undefined" ? window : globalThis);
