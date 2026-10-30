/* bitGen Studio — static/textfx.js (2.411.0): TEXT EFFECT PRESETS - Photoshop text effects on any text, LIVE as you type,
 * in the timeline's text layers and the image editor's text. window.H3TextFx / require() (the pure parts).
 *
 * Tim (verbatim): "are you able to add these styles to a presets dropdown in the text tool properties in timeline docker
 * and image editor?" -> "from these text effects, is it possible to create a tool for bitgen to add the text effects to
 * presets?" -> "will it apply as we type or after the word/words are placed - it would be nice if it was live".
 *
 * A PSD text effect (the "your text here" kind) keeps its word in ONE smart object, copied 10 - 50 times: each copy a
 * little moved / stretched with its own stroke, bevel, overlays (the 3D side), a top copy for the face (gradient, satin,
 * inner glow ...), one for the drop shadows, groups with their own effects. A PRESET is that stack, read from the PSD:
 *
 *   {v, id, name, source, ref: {inkW, inkH} (the word's ink box in the PSD, px), fill (the smart object's text colour),
 *    font: {family, weight} (what the PSD used - a suggestion), nodes: [ {type "group" | "text", name, blend, opacity,
 *    fillOpacity, clip, styles (the image editor's layer styles: pcdoc.js + pcstyles.js), t: {ex, ey, dx, dy}, kids} ],
 *    notes: {decor, hidden, skipped, glossLost, skew}}
 *   t = where the copy sits against the word, in units of the ink HEIGHT: dx / dy its move, ex / ey how far each edge
 *   grows (the PSD stretches copies to build the side) - so a longer word keeps the same depth.
 *
 *   fromPsd(psd, deps, name)   ag-psd's reading -> a preset (layers that are not the text - background, ornaments, the
 *                              "100 % editable" captions - are left out and counted). deps: PCPsd's effectsToStyles /
 *                              blendIn / rgbToHex, readPsd (for the smart object's own text colour + font)
 *   normalize(p)               the stored shape, cleaned (server + page)
 *   scaleStyles(st, k), extent(st)   the effects at another size; how far they reach outside the shape
 * The page (needs the image editor's pcdoc.js + pcstyles.js - loaded on demand):
 *   render(spec, preset, {fast}) -> {canvas, anchor: {x, y}}  the text drawn through the stack. Identical copies are
 *                              styled ONCE and stamped where each copy sits; fast = the word at <= 150 px high, scaled up
 *   live(slot, spec, id, onFull)  the best picture now (fast while typing), the full one ~0.3 s after the last change
 *   full(spec, id) -> Promise   the full picture (the timeline's export)
 *   drawText(g, t, slot, onFull) the image editor's text layer through its preset (false = not ready: draw it plain)
 *   list() / load() / byId(id) / importFile(file) / remove(id) / picker({current, onPick})  the presets + the dropdown
 *   importZip(file, {onStep}) (2.617.0) a zip of text effects: every PSD / PSB in it, bitGen preset .json files, and the
 *                              fonts it carries (into <install>/fonts) - {added, failed, fonts, skipped}
 * The ten classic looks (Gold, Chrome, Neon ...: pcstyles.js) are presets here too ("style:<name>").
 * 2.607.0 (Tim: "keep the text presets when ... shape tools like 3d , warp etc are used"): stack() is shared - renderFace(face,
 * preset, {box, hRef, color, fast}) lays a preset over ANY drawing of the words (warped, round a circle, 3D, vertical,
 * animated letter by letter); faceLive / faceFull its live / sharp versions; setSharp(on) while a bake draws frames
 * (never the quick picture); inkHeight(spec), avgColor(canvas) (3D sides / faces in the preset's colours).
 */
(function (root) {
  "use strict";
  const BLENDS = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light",
    "difference", "exclusion", "hue", "saturation", "color", "luminosity", "pass-through"];
  const STYLE_KEYS = ["shadow", "shadows", "innerShadow", "outerGlow", "innerGlow", "stroke", "colorOverlay", "gradientOverlay", "bevel", "satin", "patternOverlay"];
  const PX = { shadow: ["distance", "size"], innerShadow: ["distance", "size"], outerGlow: ["size"], innerGlow: ["size"], stroke: ["size"], bevel: ["size", "soften"], satin: ["distance", "size"] };
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r5 = (v) => Math.round(v * 100000) / 100000;
  const HEX = /^#[0-9a-f]{6}$/i;
  function bad(m) { const e = new Error(m); e.status = 400; return e; }
  const slug = (s) => String(s || "").toLowerCase().replace(/\.ps[db]$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "preset";

  /* ================================ pure ================================ */
  /** a style object, cleaned: primitives, a few known arrays (stops, gloss) */
  function cleanStyle(s) {
    if (!s || typeof s !== "object") return null;
    const o = {};
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === "boolean") o[k] = v;
      else if (typeof v === "number" && Number.isFinite(v)) o[k] = clamp(v, -100000, 100000);
      else if (typeof v === "string" && v.length <= 40) o[k] = v;
      else if (k === "stops" && Array.isArray(v)) o.stops = v.slice(0, 16).filter((x) => x && HEX.test(String(x.c))).map((x) => ({ c: String(x.c), at: clamp(num(x.at, 0), 0, 1) }));
      else if ((k === "gloss" || k === "shape") && Array.isArray(v)) o[k] = v.slice(0, 32).filter((p) => Array.isArray(p) && p.length >= 2).map((p) => [clamp(Math.round(num(p[0], 0)), 0, 255), clamp(Math.round(num(p[1], 0)), 0, 255)]);
    }
    return o;
  }
  function cleanStyles(st) {
    if (!st || typeof st !== "object") return null;
    const o = {};
    for (const k of STYLE_KEYS) {
      if (k === "shadows") { if (Array.isArray(st.shadows)) { const a = st.shadows.slice(0, 12).map(cleanStyle).filter((x) => x && x.on); if (a.length) o.shadows = a; } continue; }
      const c = cleanStyle(st[k]); if (c && c.on) o[k] = c;
    }
    return Object.keys(o).length ? o : null;
  }
  function cleanNodes(list, depth, count) {
    if (!Array.isArray(list) || depth > 8) return [];
    const out = [];
    for (const n of list) {
      if (!n || typeof n !== "object" || count.n >= 600) continue;
      count.n++;
      const isG = n.type === "group";
      const o = { type: isG ? "group" : "text", name: String(n.name || "").slice(0, 60), blend: BLENDS.includes(n.blend) ? n.blend : isG ? "pass-through" : "normal",
                  opacity: clamp(num(n.opacity, 1), 0, 1) };
      if (!isG) o.fillOpacity = clamp(num(n.fillOpacity, 1), 0, 1);
      if (n.clip) o.clip = true;
      const st = cleanStyles(n.styles); if (st) o.styles = st;
      if (isG) { o.kids = cleanNodes(n.kids, depth + 1, count); if (!o.kids.length) continue; }
      else { const t = n.t || {}; o.t = { ex: clamp(num(t.ex, 0), -5, 5), ey: clamp(num(t.ey, 0), -5, 5), dx: clamp(num(t.dx, 0), -5, 5), dy: clamp(num(t.dy, 0), -5, 5) }; }
      out.push(o);
    }
    return out;
  }
  /** the stored preset, cleaned (null = unusable) */
  function normalize(p) {
    if (!p || typeof p !== "object") return null;
    const ref = p.ref || {}, inkH = num(ref.inkH, 0), inkW = num(ref.inkW, 0);
    if (!(inkH > 0 && inkW > 0)) return null;
    const nodes = cleanNodes(p.nodes, 0, { n: 0 });
    if (!nodes.length) return null;
    const f = p.font || {}, nt = p.notes || {};
    return { v: 1, id: String(p.id || "").replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 80) || "user:" + slug(p.name), name: String(p.name || "Preset").replace(/[\r\n]+/g, " ").slice(0, 60),
             source: String(p.source || "").slice(0, 120), ref: { inkW: clamp(inkW, 1, 20000), inkH: clamp(inkH, 1, 20000) },
             fill: HEX.test(String(p.fill)) ? String(p.fill) : null, font: { family: String(f.family || "").slice(0, 60), weight: clamp(Math.round(num(f.weight, 400)), 100, 900) },
             nodes, notes: { decor: num(nt.decor, 0), hidden: num(nt.hidden, 0), skipped: num(nt.skipped, 0), glossLost: num(nt.glossLost, 0), skew: num(nt.skew, 0) } };
  }
  /** the effects at another size (every px value x k) */
  function scaleStyles(st, k) {
    if (!st) return null;
    const o = JSON.parse(JSON.stringify(st));
    const sc = (name, s) => { if (!s) return; (PX[name] || []).forEach((f) => { if (s[f] != null) s[f] = +s[f] * k; }); };
    for (const n of Object.keys(o)) { if (n === "shadows") (o.shadows || []).forEach((s) => sc("shadow", s)); else sc(n, o[n]); }
    if (o.patternOverlay && o.patternOverlay.scale) o.patternOverlay.scale = clamp(o.patternOverlay.scale * k, 10, 1000);
    return o;
  }
  /** how far (px) the effects reach outside the shape */
  function extent(st) {
    if (!st) return 0;
    let e = 0;
    const sh = (s) => (s && s.on ? Math.abs(num(s.distance, 0)) + num(s.size, 0) * 1.25 : 0);
    e = Math.max(e, sh(st.shadow)); (st.shadows || []).forEach((s) => { e = Math.max(e, sh(s)); });
    if (st.outerGlow && st.outerGlow.on) e = Math.max(e, num(st.outerGlow.size, 0) * 1.5);
    const sk = st.stroke && st.stroke.on && st.stroke.position !== "inside" ? num(st.stroke.size, 0) : 0;
    e = Math.max(e, sk);
    if (st.bevel && st.bevel.on && /outer|emboss|pillow/.test(st.bevel.style || "")) e = Math.max(e, num(st.bevel.size, 0) * 2 + sk);
    return e;
  }
  /** a quad (TL, TR, BR, BL - 8 numbers) -> its centre, width, height, and whether it is a plain rectangle */
  function quad(q) {
    const a = (q || []).map(Number);
    if (a.length < 8 || a.some((v) => !Number.isFinite(v))) return null;
    const cx = (a[0] + a[2] + a[4] + a[6]) / 4, cy = (a[1] + a[3] + a[5] + a[7]) / 4;
    const w = Math.hypot(a[2] - a[0], a[3] - a[1]), h = Math.hypot(a[6] - a[0], a[7] - a[1]);
    const rect = Math.abs(a[1] - a[3]) < 0.5 && Math.abs(a[0] - a[6]) < 0.5;
    return { cx, cy, w, h, rect };
  }
  /**
   * ag-psd's reading of a PSD -> a preset. deps = {effectsToStyles(fx, defaults) -> {styles, skipped}, blendIn(name, isGroup),
   * rgbToHex(c), readPsd?(bytes) -> the smart object's own document (for its text colour + font)}
   */
  function fromPsd(psd, deps, name) {
    const all = [];
    (function walk(ch) { for (const L of ch || []) { if (L.placedLayer) all.push(L); if (L.children) walk(L.children); } })(psd && psd.children);
    if (!all.length) throw bad("there is no smart object in that PSD - a text effect PSD keeps its word in one (\"Your text here\")");
    const cnt = {};
    all.forEach((L) => { const id = L.placedLayer.id || ""; cnt[id] = (cnt[id] || 0) + 1; });
    const tid = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    const mine = all.filter((L) => (L.placedLayer.id || "") === tid);
    const tkey = (L) => (L.placedLayer.transform || []).map((v) => Math.round(v)).join(",");
    const tc = {};
    mine.forEach((L) => { tc[tkey(L)] = (tc[tkey(L)] || 0) + 1; });
    const bk = Object.keys(tc).sort((a, b) => tc[b] - tc[a])[0];
    const base = mine.find((L) => tkey(L) === bk && /text here|your text|edit|replace/i.test(L.name || "")) || mine.find((L) => tkey(L) === bk);
    const B = quad(base.placedLayer.transform);
    let inkW = num(base.right, 0) - num(base.left, 0), inkH = num(base.bottom, 0) - num(base.top, 0);
    let icx = (num(base.left, 0) + num(base.right, 0)) / 2, icy = (num(base.top, 0) + num(base.bottom, 0)) / 2;
    if (!(inkW > 0 && inkH > 0) && B) { inkW = B.w * 0.8; inkH = B.h * 0.4; icx = B.cx; icy = B.cy; }
    if (!(inkW > 0 && inkH > 0)) throw bad("the text smart object has no size in that PSD");
    const notes = { decor: 0, hidden: 0, skipped: 0, glossLost: 0, skew: 0 };
    const fx = (e) => {
      if (!e) return null;
      const r = deps.effectsToStyles(e, {}) || {};
      notes.skipped += r.skipped || 0;
      const bv = Array.isArray(e.bevel) ? e.bevel[0] : e.bevel;
      if (bv && bv.enabled !== false && bv.useShape && !bv.shapeContour && !bv.contour) notes.glossLost++;   // 2.413.0: both contours kept now
      return cleanStyles(r.styles);
    };
    const tf = (L) => {
      const T = quad(L.placedLayer.transform);
      if (!T || !B) return { ex: 0, ey: 0, dx: 0, dy: 0 };
      if (!T.rect) notes.skew++;
      const sx = T.w / B.w, sy = T.h / B.h;
      const ncx = T.cx + (icx - B.cx) * sx, ncy = T.cy + (icy - B.cy) * sy;
      return { ex: r5(inkW * (sx - 1) / 2 / inkH), ey: r5((sy - 1) / 2), dx: r5((ncx - icx) / inkH), dy: r5((ncy - icy) / inkH) };
    };
    const build = (ch) => {
      const out = [];
      for (const L of ch || []) {
        if (Array.isArray(L.children)) {
          const kids = build(L.children);
          if (!kids.length) { notes.decor++; continue; }
          if (L.hidden) { notes.hidden++; continue; }
          const n = { type: "group", name: L.name || "Group", blend: deps.blendIn(L.blendMode, true) || "pass-through", opacity: L.opacity == null ? 1 : L.opacity, kids };
          const st = fx(L.effects); if (st) n.styles = st;
          if (L.clipping) n.clip = true;
          out.push(n); continue;
        }
        if (!L.placedLayer || (L.placedLayer.id || "") !== tid) { notes.decor++; continue; }
        if (L.hidden || (L.opacity != null && L.opacity <= 0.001)) { notes.hidden++; continue; }
        const n = { type: "text", name: L.name || "Text", blend: deps.blendIn(L.blendMode, false) || "normal", opacity: L.opacity == null ? 1 : L.opacity,
                    fillOpacity: L.fillOpacity == null ? 1 : L.fillOpacity, t: tf(L) };
        const st = fx(L.effects); if (st) n.styles = st;
        if (L.clipping) n.clip = true;
        out.push(n);
      }
      return out;
    };
    const nodes = build(psd.children);
    // the smart object's own text: its colour (the copies without a colour overlay show it) and its font
    let fill = null, family = "", weight = 400;
    try {
      const lf = (psd.linkedFiles || []).find((f) => f.id === tid) || (psd.linkedFiles || [])[0];
      if (lf && lf.data && deps.readPsd) {
        const inner = deps.readPsd(lf.data);
        let tx = null;
        (function walk(ch) { for (const L of ch || []) { if (tx) return; if (L.text) tx = L.text; if (L.children) walk(L.children); } })(inner && inner.children);
        const st = tx && (tx.style || ((tx.styleRuns || [])[0] || {}).style) || {};
        if (st.fillColor) fill = deps.rgbToHex(st.fillColor);
        if (st.font && st.font.name) family = String(st.font.name).replace(/[-_](Regular|Roman|Book)$/i, "");
        if (st.fauxBold || /bold|black|heavy/i.test(family)) weight = 700;
      }
    } catch (e) { /* the colour stays the user's */ }
    const p = normalize({ id: "user:" + slug(name), name: String(name || "PSD text effect"), source: String(name || ""), ref: { inkW, inkH }, fill, font: { family, weight }, nodes, notes });
    if (!p) throw bad("no part of that PSD draws the text (every copy of the smart object is hidden?)");
    return p;
  }
  /** the classic looks (pcstyles.js PRESETS) as presets */
  function classics(PCStyles, defaults) {
    if (!PCStyles || !Array.isArray(PCStyles.PRESETS)) return [];
    return PCStyles.PRESETS.map(([name]) => normalize({ id: "style:" + slug(name), name, source: "classic", ref: { inkW: 150, inkH: 50 }, fill: null,
      nodes: [{ type: "text", name, styles: PCStyles.presetStyles(name, defaults || {}) }] })).filter(Boolean).map((p) => Object.assign(p, { classic: true, builtin: true }));
  }
  const api = { BLENDS, STYLE_KEYS, normalize, cleanStyles, scaleStyles, extent, quad, fromPsd, classics, slug };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root || !root.document) return;

  /* ================================ the page ================================ */
  const doc = root.document;
  let deps = null, list = null, loading = null;
  const loadScript = (src) => new Promise((ok, no) => { const s = doc.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src + " is missing")); doc.head.appendChild(s); });
  /** the image editor's renderer (pcstyles.js + pcdoc.js) - loaded here when the page has not got it */
  function ensure() {
    if (root.PCDoc && root.PCStyles) return Promise.resolve(true);
    if (!deps) deps = (root.PCStyles ? Promise.resolve() : loadScript("/ext/imageeditdock/pcstyles.js"))
      .then(() => (root.PCDoc ? true : loadScript("/ext/imageeditdock/pcdoc.js")))
      .then(() => !!(root.PCDoc && root.PCStyles))
      .catch((e) => { deps = null; console.warn("[textfx] " + e.message + " - text effects need the image editor extension"); return false; });
    return deps;
  }
  function ready() { return !!(root.PCDoc && root.PCStyles && list); }
  const listeners = [];
  /** the presets: the server's (built in from PSDs + your imports) + the classic looks */
  function load(fresh) {
    if (list && !fresh) return Promise.resolve(list);
    if (loading && !fresh) return loading;
    loading = Promise.all([ensure(), (typeof fetch === "function" ? fetch("/api/textfx/presets").then((r) => r.json()) : Promise.resolve({ presets: [] })).catch(() => ({ presets: [] }))]).then(([ok, j]) => {
      const srv = (j.presets || []).map((p) => Object.assign(normalize(p) || {}, { builtin: !!p.builtin })).filter((p) => p.nodes);
      list = srv.concat(ok ? classics(root.PCStyles, root.PCDoc.STYLE_DEFAULTS) : []);
      loading = null;
      listeners.forEach((f) => { try { f(list); } catch (e) { /* the caller's */ } });
      return list;
    });
    return loading;
  }
  function byId(id) { return (list || []).find((p) => p.id === id) || null; }
  function onList(f) { listeners.push(f); }

  const COMP = { normal: "source-over", "pass-through": "source-over" };
  const compositeOf = (b) => COMP[b] || (BLENDS.includes(b) ? b : "source-over");
  const newCanvas = (w, h) => { const c = doc.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const fontCss = (s) => `${s.italic ? "italic " : ""}${s.weight || 400} ${Math.max(1, s.size)}px "${String(s.font || "Arial").replace(/"/g, "")}", sans-serif`;
  /** the words drawn plain (white): the layout box, the anchor (where the caller's x / y is) and the ink box */
  function layout(spec, size) {
    const lines = String(spec.text == null ? "" : spec.text).split("\n"), lh = size * (spec.leading || 1.22);
    const probe = newCanvas(4, 4).getContext("2d");
    probe.font = fontCss(Object.assign({}, spec, { size }));
    if ("letterSpacing" in probe && spec.tracking) probe.letterSpacing = ((spec.tracking || 0) / 1000 * size).toFixed(2) + "px";
    let w = 1; lines.forEach((l) => { w = Math.max(w, probe.measureText(l || " ").width); });
    const pad = Math.ceil(size * 0.6), W = Math.ceil(w + pad * 2), H = Math.ceil(lh * lines.length + pad * 2);
    const c = newCanvas(W, H), g = c.getContext("2d");
    g.font = probe.font; if ("letterSpacing" in g && spec.tracking) g.letterSpacing = probe.letterSpacing;
    g.fillStyle = "#ffffff"; g.textBaseline = "top";
    const align = spec.align === "center" || spec.align === "right" ? spec.align : "left";
    g.textAlign = align;
    const ax = align === "left" ? pad : align === "right" ? pad + w : pad + w / 2, ay = pad;
    lines.forEach((l, i) => g.fillText(l, ax, ay + i * lh));
    const d = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) { const row = y * W * 4; for (let x = 0; x < W; x++) if (d[row + x * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) return null;
    // the same words again, filled and stroked r px wide (an exact outward stroke, from the letters' own outlines)
    const outline = (g2, r, col) => {
      g2.save(); g2.font = g.font; if ("letterSpacing" in g2 && spec.tracking) g2.letterSpacing = g.letterSpacing;
      g2.textBaseline = "top"; g2.textAlign = align; g2.fillStyle = col; g2.strokeStyle = col; g2.lineJoin = "round"; g2.lineWidth = r * 2;
      lines.forEach((l, i) => { g2.fillText(l, ax, ay + i * lh); if (r > 0) g2.strokeText(l, ax, ay + i * lh); });
      g2.restore();
    };
    return { canvas: c, ax, ay, ink: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, outline };
  }
  /** a canvas transformed about (cx, cy): scale sx, sy, then moved by tx, ty */
  function stamp(g, src, cx, cy, sx, sy, tx, ty) {
    g.save(); g.translate(cx + tx, cy + ty); g.scale(sx, sy); g.translate(-cx, -cy); g.drawImage(src, 0, 0); g.restore();
  }
  /**
   * spec = {text, font, size, weight, italic, align, leading, tracking, color}; preset = a preset (or its id).
   * -> {canvas, anchor: {x, y} (where the layout anchor sits in it - the caller's x / top), ink: {x, y, w, h}} | null
   */
  function render(spec, preset, opts) {
    const P = typeof preset === "string" ? byId(preset) : preset;
    if (!P || !root.PCDoc || !root.PCStyles) return null;
    const o = opts || {}, size = Math.max(2, num(spec.size, 48));
    let L0 = layout(spec, size);
    if (!L0) return null;
    // fast: work with the word at most FAST px high, then scale the picture up to the real size
    const cap = o.fast ? (o.cap || 150) : (o.cap || 900);
    let q = 1;
    if (L0.ink.h > cap) { q = cap / L0.ink.h; L0 = layout(spec, size * q) || L0; if (L0 === null) return null; }
    const inkW = L0.ink.w, inkH = L0.ink.h, m = marginOf(P, inkH);
    const W = inkW + m * 2, H = inkH + m * 2;
    const sil = newCanvas(W, H), sg = sil.getContext("2d");
    sg.drawImage(L0.canvas, m - L0.ink.x, m - L0.ink.y);
    sg.globalCompositeOperation = "source-in"; sg.fillStyle = P.fill || spec.color || "#ffffff"; sg.fillRect(0, 0, W, H);
    // the stroke of the word itself: drawn from its outlines (pcdoc.js asks; anything else it dilates)
    const dilate = (r, col) => { const c = newCanvas(W, H), g = c.getContext("2d"); g.translate(m - L0.ink.x, m - L0.ink.y); L0.outline(g, r, col || "#000"); return c; };
    let out = stack(P, sil, W, H, m, inkW, inkH, inkH, dilate);
    let anchor = { x: m - L0.ink.x + L0.ax, y: m - L0.ink.y + L0.ay }, ink = { x: m, y: m, w: inkW, h: inkH };
    if (q < 1) {
      out = scaleUp(out, q); anchor = { x: anchor.x / q, y: anchor.y / q }; ink = { x: m / q, y: m / q, w: inkW / q, h: inkH / q };
    }
    return { canvas: out, anchor, ink, fast: q < 1, q };
  }
  function scaleUp(c, q) {
    const up = newCanvas(c.width / q, c.height / q), ug = up.getContext("2d");
    ug.imageSmoothingQuality = "high"; ug.drawImage(c, 0, 0, up.width, up.height);
    return up;
  }
  /** the margin round the ink the copies' moves + the effects at every depth need (hRef = the letters' height) */
  function marginOf(P, hRef) {
    const k = hRef / P.ref.inkH;
    let mv = 0; const lev = [];
    (function walk(ns, d) {
      for (const n of ns) {
        lev[d] = Math.max(lev[d] || 0, extent(n.styles) * k);
        if (n.type === "group") walk(n.kids, d + 1);
        else mv = Math.max(mv, (Math.abs(n.t.dx) + Math.abs(n.t.dy) + Math.abs(n.t.ey) * 2) * hRef + Math.abs(n.t.ex) * 2 * hRef);
      }
    })(P.nodes, 0);
    return Math.ceil(mv + lev.reduce((a, b) => a + (b || 0), 0) + 4);
  }
  /**
   * THE PRESET'S STACK on a silhouette (2.607.0 - shared by the straight word and a SHAPED one): sil is W x H with the
   * ink box (inkW x inkH) at (m, m); hRef = the letters' height (what the effects and the copies' moves scale with - the
   * ink height for a straight word; for a warped / 3D / path text the height its straight words would have)
   * dilate(r, col) -> a canvas | null (null = pcdoc.js dilates the silhouette itself)
   */
  function stack(P, sil, W, H, m, inkW, inkH, hRef, dilate) {
    const k = hRef / P.ref.inkH;
    const cx = m + inkW / 2, cy = m + inkH / 2;
    const env = { newCanvas, srcFor: (L) => L.canvas, compositeOf, maskSrc: null,
      dilate: (content, r, col) => (content === sil && dilate ? dilate(r, col) : null) };
    const baked = new Map();
    const bake = (n) => {
      const st = scaleStyles(n.styles, k), fo = n.fillOpacity == null ? 1 : n.fillOpacity;
      const key = JSON.stringify(st) + "|" + fo;
      if (!baked.has(key)) baked.set(key, root.PCDoc.styled(env, { id: "tfx:" + P.id + ":" + baked.size, styles: st, fillOpacity: fo }, sil, W, H));
      return baked.get(key);
    };
    const tfOf = (n) => ({ sx: 1 + 2 * n.t.ex * hRef / Math.max(1, inkW), sy: 1 + 2 * n.t.ey * hRef / Math.max(1, inkH), tx: n.t.dx * hRef, ty: n.t.dy * hRef });
    const layers = [];
    let nid = 0;
    const emit = (ns, parent) => {
      for (let i = 0; i < ns.length;) {
        const n = ns[i];
        if (n.type === "group") {
          const id = ++nid;
          layers.push({ id, type: "group", name: n.name, parent, blend: n.blend, opacity: n.opacity, clip: !!n.clip, styles: scaleStyles(n.styles, k), visible: true });
          emit(n.kids, id);
          i++; continue;
        }
        const plain = (x, j) => x.type === "text" && x.blend === "normal" && x.opacity >= 0.999 && !x.clip && !(ns[j + 1] && ns[j + 1].clip);
        if (plain(n, i)) {
          // a run of plain copies: each styled once (shared), stamped where it sits - ONE layer for the run
          const c = newCanvas(W, H), g = c.getContext("2d");
          let j = i;
          while (j < ns.length && plain(ns[j], j)) { const t = tfOf(ns[j]); stamp(g, bake(ns[j]), cx, cy, t.sx, t.sy, t.tx, t.ty); j++; }
          layers.push({ id: ++nid, type: "pixel", name: n.name, parent, blend: "normal", opacity: 1, canvas: c, visible: true });
          i = j; continue;
        }
        const c = newCanvas(W, H), t = tfOf(n);
        stamp(c.getContext("2d"), sil, cx, cy, t.sx, t.sy, t.tx, t.ty);
        layers.push({ id: ++nid, type: "pixel", name: n.name, parent, blend: n.blend, opacity: n.opacity, clip: !!n.clip, fillOpacity: n.fillOpacity,
                      styles: scaleStyles(n.styles, k), canvas: c, visible: true });
        i++;
      }
    };
    emit(P.nodes, null);
    // PCDoc wants the flat list bottom-to-top with a group's children right below it
    const flat = [], kidsOf = (pid) => layers.filter((L) => L.parent === pid);
    (function put(pid) { for (const L of kidsOf(pid)) { if (L.type === "group") put(L.id); flat.push(L); } })(null);
    return root.PCDoc.render({ w: W, h: H, layers: flat }, env);
  }
  /** the ink box (alpha > 8) of a canvas inside box {x, y, w, h} (clamped) -> {x, y, w, h} | null */
  function inkOf(c, box) {
    const b = box || { x: 0, y: 0, w: c.width, h: c.height };
    const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(c.width, Math.ceil(b.x + b.w)), y1 = Math.min(c.height, Math.ceil(b.y + b.h));
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return null;
    const d = c.getContext("2d").getImageData(x0, y0, w, h).data;
    let a = w, t = h, r = -1, btm = -1;
    for (let y = 0; y < h; y++) { const row = y * w * 4; for (let x = 0; x < w; x++) if (d[row + x * 4 + 3] > 8) { if (x < a) a = x; if (x > r) r = x; if (y < t) t = y; if (y > btm) btm = y; } }
    return r < 0 ? null : { x: x0 + a, y: y0 + t, w: r - a + 1, h: btm - t + 1 };
  }
  /** the height a straight block of these words has (what render() scales the effects by) - measured, no pixels */
  function inkHeight(spec) {
    const size = Math.max(2, num(spec.size, 48)), lines = String(spec.text == null ? "" : spec.text).split("\n");
    const g = newCanvas(4, 4).getContext("2d"); g.font = fontCss(Object.assign({}, spec, { size })); g.textBaseline = "alphabetic";
    const m0 = g.measureText(lines[0] || "H"), m1 = g.measureText(lines[lines.length - 1] || "H");
    const asc = m0.actualBoundingBoxAscent, desc = m1.actualBoundingBoxDescent;
    const one = Number.isFinite(asc) && Number.isFinite(desc) && asc + desc > 0 ? asc + desc : size * 0.75;
    return Math.max(2, one + (lines.length - 1) * size * (spec.leading || 1.22));
  }
  /**
   * 2.607.0 - Tim (verbatim): "is it possible to keep the text presets when operations when shape tools like 3d , warp etc
   * are used". A preset on ANY drawing of the words: `face` is a canvas with the text drawn plainly (warped, round a
   * circle, along a path, vertical, letter by letter, animated ...), o = {box (where to look for it), hRef (the letters'
   * height - inkHeight(spec)), color, fast, cap}. -> {canvas, x, y (where it goes in face's coordinates), fast} | null
   */
  function renderFace(face, preset, opts) {
    const P = typeof preset === "string" ? byId(preset) : preset;
    if (!P || !root.PCDoc || !root.PCStyles || !face) return null;
    const o = opts || {}, ink = inkOf(face, o.box);
    if (!ink) return null;
    const hRef0 = Math.max(2, num(o.hRef, ink.h)), cap = o.fast ? (o.cap || 150) : (o.cap || 900);
    const q = hRef0 > cap ? cap / hRef0 : 1;
    const inkW = Math.max(1, Math.round(ink.w * q)), inkH = Math.max(1, Math.round(ink.h * q)), hRef = hRef0 * q, m = marginOf(P, hRef);
    const W = inkW + m * 2, H = inkH + m * 2;
    const sil = newCanvas(W, H), sg = sil.getContext("2d");
    sg.imageSmoothingQuality = "high"; sg.drawImage(face, ink.x, ink.y, ink.w, ink.h, m, m, inkW, inkH);
    sg.globalCompositeOperation = "source-in"; sg.fillStyle = P.fill || o.color || "#ffffff"; sg.fillRect(0, 0, W, H);
    let out = stack(P, sil, W, H, m, inkW, inkH, hRef, null);
    if (q < 1) out = scaleUp(out, q);
    const kx = ink.w / inkW, ky = ink.h / inkH;
    return { canvas: out, x: ink.x - m * kx, y: ink.y - m * ky, ink, fast: q < 1, q };
  }
  /** the average colour of a picture's solid pixels ("#rrggbb") - the sides of a 3D text in its preset's colours */
  function avgColor(c) {
    if (!c || !c.width) return null;
    const s = newCanvas(32, 32), g = s.getContext("2d"); g.drawImage(c, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    if (!n) return null;
    const h = (v) => Math.round(v / n).toString(16).padStart(2, "0");
    return "#" + h(r) + h(gg) + h(b);
  }

  /* ---- live: the best picture now, the full one once typing pauses.
     Each preset learns what a quick picture costs on this machine and works at the size that keeps a keystroke within
     BUDGET ms (60 - 150 px high); keystrokes faster than that get the last picture while the newest is drawn next. */
  const BUDGET = 70;
  const results = new Map(), timers = new Map(), cost = new Map(), lastAt = new Map(), latest = new Map();
  const keyOf = (spec, id) => id + "|" + JSON.stringify([spec.text, spec.font, spec.size, spec.weight, spec.italic, spec.align, spec.leading, spec.tracking, spec.color]);
  function remember(key, r) { results.set(key, r); if (results.size > 80) results.delete(results.keys().next().value); }
  // 2.607.0: SHARP mode (a bake / an export draws frame after frame - each must be the full picture, never a quick one)
  let sharp = 0;
  function setSharp(on) { sharp = Math.max(0, sharp + (on ? 1 : -1)); return sharp > 0; }
  /** a job = {key, id, run(opts) -> result}: render() of a spec, or renderFace() of a shaped drawing (2.607.0) */
  function quick(job) {
    const id = job.id, c = cost.get(id) || { cap: 150, ms: 0 }, t0 = Date.now();
    const r = job.run({ fast: true, cap: c.cap });
    const ms = Date.now() - t0;
    if (r && r.fast) { c.ms = ms; c.cap = Math.round(clamp(c.cap * Math.sqrt(BUDGET / Math.max(1, ms)), 60, 150)); cost.set(id, c); }
    if (r) r.ms = ms;
    return r;
  }
  /** onUpdate(result) - called when a newer / sharper picture for this slot is ready (draw again) */
  function liveJob(slot, job, onUpdate) {
    const key = job.key, id = job.id, hit = results.get(key);
    if (hit && !hit.fast) return hit;
    if (!ready() || !byId(id)) { load().then(() => { if (byId(id) && onUpdate) { const r = quick(job); if (r) { remember(key, r); latest.set(slot, r); onUpdate(r); later(slot, job, onUpdate); } } }); return null; }
    if (sharp) { const f = job.run({ fast: false }); if (f) { remember(key, f); latest.set(slot, f); } return f; }
    let r = hit;
    if (!r) {
      const c = cost.get(id), since = Date.now() - (lastAt.get(slot) || 0);
      if (c && c.ms > 30 && since < c.ms * 1.5 && latest.has(slot)) {
        // typing faster than this machine draws it: keep the last picture, draw the newest one in a moment
        clearTimeout(timers.get(slot + ":q"));
        timers.set(slot + ":q", setTimeout(() => {
          const r2 = results.get(key) || quick(job);
          if (r2) { remember(key, r2); latest.set(slot, r2); lastAt.set(slot, Date.now()); if (onUpdate) onUpdate(r2); }
        }, Math.max(16, c.ms * 1.5 - since)));
        later(slot, job, onUpdate);
        return latest.get(slot);
      }
      r = quick(job);
      if (!r) return null;
      remember(key, r);
      lastAt.set(slot, Date.now());
    }
    latest.set(slot, r);
    if (r.fast) later(slot, job, onUpdate);
    return r;
  }
  /** the sharp picture ~0.35 s after the last change */
  function later(slot, job, onUpdate) {
    clearTimeout(timers.get(slot));
    timers.set(slot, setTimeout(() => {
      timers.delete(slot);
      const key = job.key;
      const f = results.get(key) && !results.get(key).fast ? results.get(key) : job.run({ fast: false });
      if (f) { remember(key, f); latest.set(slot, f); if (onUpdate) onUpdate(f); }
    }, 350));
  }
  const specJob = (spec, id) => ({ key: keyOf(spec, id), id, run: (o) => render(spec, id, o) });
  function live(slot, spec, id, onUpdate) { return liveJob(slot, specJob(spec, id), onUpdate); }
  /** the full-quality picture (the export) */
  function full(spec, id) {
    return load().then(() => {
      const key = keyOf(spec, id), hit = results.get(key);
      if (hit && !hit.fast) return hit;
      const r = render(spec, id, { fast: false });
      if (r) remember(key, r);
      return r;
    });
  }
  /**
   * 2.607.0: a SHAPED text, live: key = everything its drawing depends on (+ the preset id), make() -> {canvas (the
   * words drawn plainly), box, hRef, color} | null. -> renderFace()'s result (x / y in make()'s canvas) | null
   */
  function faceLive(slot, key, id, make, onUpdate) {
    return liveJob(slot, { key: "face|" + id + "|" + key, id, run: (o) => { const f = make(); return f ? renderFace(f.canvas, id, Object.assign({}, f, o)) : null; } }, onUpdate);
  }
  function faceFull(key, id, make) {
    return load().then(() => {
      const k = "face|" + id + "|" + key, hit = results.get(k);
      if (hit && !hit.fast) return hit;
      const f = make(); const r = f ? renderFace(f.canvas, id, Object.assign({}, f, { fast: false })) : null;
      if (r) remember(k, r);
      return r;
    });
  }
  /** the image editor: its text layer `t` ({str, font, size, weight, italic, align, leading, tracking, color, x, y, fx}) */
  function drawText(g, t, slot, onUpdate) {
    const spec = { text: t.str, font: t.font, size: t.size, weight: t.weight, italic: t.italic, align: t.align, leading: t.leading || 1.2, tracking: t.tracking, color: t.color };
    const r = live(slot, spec, t.fx, onUpdate);
    if (!r) return false;
    g.drawImage(r.canvas, Math.round(t.x - r.anchor.x), Math.round(t.y - r.anchor.y));
    return true;
  }

  /* ---- imports, removal */
  let ag = null;
  function agPsd() {
    if (root.agPsd) return Promise.resolve(root.agPsd);
    if (!ag) ag = loadScript("/static/vendor/ag-psd.js").then(() => root.agPsd).catch((e) => { ag = null; throw e; });
    return ag;
  }
  function pcpsd() { return root.PCPsd ? Promise.resolve(root.PCPsd) : loadScript("/ext/imageeditdock/pcpsd.js").then(() => root.PCPsd); }
  /** a PSD file's name -> a preset name ("gold-3d-text-effect-psd.psd" -> "Gold 3d") */
  function prettyName(fileName) {
    const name = String(fileName || "PSD text effect").split(/[\\/]/).pop().replace(/^[0-9a-f]{8}-/i, "").replace(/\.ps[db]$/i, "")
      .replace(/[-_]+/g, " ").replace(/\b(psd|text|style|effect|font|editable|\d{3,})\b/gi, " ").replace(/\s+/g, " ").trim() || "PSD text effect";
    return name.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);
  }
  function savePreset(p, reload) {
    return fetch("/api/textfx/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset: p }) })
      .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || r.status); return j; }))
      .then((j) => (reload === false ? j.preset : load(true).then(() => byId(j.id) || j.preset)));
  }
  /** a PSD file -> a saved preset (the server keeps it in textfx/user/). o.reload false: the list is read again later */
  function importFile(file, o) {
    if (/\.zip$/i.test(String(file && file.name || ""))) return importZip(file, o).then((r) => { if (!r.added.length) throw new Error(r.failed.length ? r.failed[0].name + ": " + r.failed[0].error : "no PSD text effects in that zip"); return r.added[0]; });
    const pretty = prettyName(file && file.name);
    return Promise.all([agPsd(), pcpsd(), ensure(), file.arrayBuffer()]).then(([A, PP, ok, buf]) => {
      if (!A || !PP) throw new Error("the PSD reader did not load");
      const psd = A.readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
      const p = fromPsd(psd, { effectsToStyles: PP.effectsToStyles, blendIn: PP.blendIn, rgbToHex: PP.rgbToHex,
        readPsd: (d) => A.readPsd(d, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true }) }, pretty);
      p.source = String(file.name || "").slice(0, 120);
      return savePreset(p, !(o && o.reload === false));
    });
  }
  /* 2.617.0 (Tim: "can we install text preset effects from a zip, multiple effects can be in a single zip"): a ZIP of
     text effects - every PSD / PSB in it (folders too) becomes a preset, a bitGen preset .json is added as it is, the
     fonts it carries (.ttf / .otf) go into the studio's font folder first (POST /api/fonts/install - every font list
     then knows them). Read from the file in place (static/zipread.js), one PSD at a time. A PSD that is not a text
     effect is named in the result, the rest still go in.
     importZip(file, {onStep(text, done, total)}) -> {added: [preset], failed: [{name, error}], fonts: [{name, family}], skipped} */
  function zipReader() { return root.H3Zip ? Promise.resolve(root.H3Zip) : loadScript("/static/zipread.js").then(() => root.H3Zip); }
  async function importZip(file, o) {
    const step = (o && o.onStep) || (() => {});
    const Z = await zipReader();
    if (!Z) throw new Error("the zip reader did not load");
    const all = await Z.entries(file);
    const want = all.map((e) => ({ e, k: Z.kind(e.name) })).filter((x) => x.k);
    const fonts = want.filter((x) => x.k === "font"), work = want.filter((x) => x.k !== "font");
    const res = { added: [], failed: [], fonts: [], skipped: all.length - want.length };
    if (!work.length) throw new Error("no PSD text effects (.psd / .psb) in " + file.name);
    for (const x of fonts) {
      const nm = x.e.name.split("/").pop();
      try {
        step("font " + nm, 0, work.length);
        const r = await fetch("/api/fonts/install?name=" + encodeURIComponent(nm), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: await Z.read(file, x.e) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
        res.fonts.push({ name: j.name, family: j.family, existed: !!j.existed });
      } catch (e) { res.failed.push({ name: nm, error: String(e.message || e) }); }
    }
    if (res.fonts.some((f) => !f.existed) && root.H3Fonts && root.H3Fonts.reload) { try { await root.H3Fonts.reload(); } catch (e) { /* the lists catch up at the next start */ } }
    let i = 0;
    for (const x of work) {
      const nm = x.e.name.split("/").pop();
      step(nm, i++, work.length);
      try {
        const u8 = await Z.read(file, x.e);
        let p;
        if (x.k === "json") {
          const raw = JSON.parse(new TextDecoder("utf-8").decode(u8));
          if (!normalize(raw)) throw new Error("not a text effect preset");
          raw.source = raw.source || (file.name + " / " + nm).slice(0, 120);
          p = await savePreset(raw, false);
        } else {
          const blob = new Blob([u8]);
          p = await importFile({ name: nm, arrayBuffer: () => blob.arrayBuffer() }, { reload: false });
        }
        res.added.push(p);
      } catch (e) { res.failed.push({ name: nm, error: String(e.message || e) }); }
    }
    step("done", work.length, work.length);
    await load(true);
    res.added = res.added.map((p) => byId(p.id) || p);
    return res;
  }
  function remove(id) {
    return fetch("/api/textfx/presets/" + encodeURIComponent(id), { method: "DELETE" }).then((r) => r.json()).then(() => load(true));
  }
  function rename(id, name) {
    return fetch("/api/textfx/presets/" + encodeURIComponent(id) + "/rename", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
      .then((r) => r.json()).then(() => load(true));
  }

  /* ---- the dropdown: Presets ▾ with a live preview of the look, ＋ Import a PSD…, 🗑 for your imports */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function options(current) {
    const L = list || [], grp = (title, xs) => (xs.length ? `<optgroup label="${esc(title)}">` + xs.map((p) => `<option value="${esc(p.id)}"${p.id === current ? " selected" : ""}>${esc(p.name)}</option>`).join("") + "</optgroup>" : "");
    return `<option value=""${!current ? " selected" : ""}>— no preset —</option>`
      + grp("PSD text effects", L.filter((p) => p.builtin && !p.classic)) + grp("Your imports", L.filter((p) => !p.builtin))
      + grp("Classic", L.filter((p) => p.classic)) + `<option value="__import">＋ Import PSD text effects or a zip…</option>`;
  }
  const previews = new Map();
  /** -> an element: <select> + a little preview + 🗑 (your imports). o = {current, onPick(id), say(text)} */
  function picker(o) {
    const box = doc.createElement("span");
    box.className = "tfx-pick"; box.style.cssText = "display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap";
    box.innerHTML = `<select class="tfx-sel" title="Text effect presets - from PSD text effects (＋ imports your own), live as you type" aria-label="Text effect preset" style="max-width:170px"></select>`
      + `<canvas class="tfx-pv" width="120" height="34" title="How the preset looks" style="width:120px;height:34px;border-radius:4px;background:#2a2622"></canvas>`
      + `<button type="button" class="ghost tfx-del" title="Delete this imported preset" style="display:none;padding:0 5px">🗑</button>`
      + `<input type="file" class="tfx-file" accept=".psd,.psb,.zip" multiple hidden>`;
    const sel = box.querySelector(".tfx-sel"), pv = box.querySelector(".tfx-pv"), del = box.querySelector(".tfx-del"), file = box.querySelector(".tfx-file");
    let cur = o.current || "";
    const say = (t) => { if (o.say) o.say(t); };
    const paint = () => {
      sel.innerHTML = options(cur);
      const p = byId(cur);
      del.style.display = p && !p.builtin ? "" : "none";
      const g = pv.getContext("2d"); g.clearRect(0, 0, pv.width, pv.height);
      if (!p) { g.fillStyle = "#9a917f"; g.font = "12px sans-serif"; g.textBaseline = "middle"; g.fillText("plain text", 8, 17); return; }
      let r = previews.get(p.id);                                             // one preview per preset (the panel repaints often)
      if (!r) { r = render({ text: "Abc", font: (p.font && p.font.family) || "Arial Black", size: 64, weight: 900, color: "#ffffff", align: "left" }, p, { fast: true, cap: 70 }); if (r) previews.set(p.id, r); }
      if (!r) return;
      const s = Math.min(pv.width / r.canvas.width, pv.height / r.canvas.height) * 1.7;      // the word, not its widest shadow
      const w = r.canvas.width * s, h = r.canvas.height * s;
      g.drawImage(r.canvas, (pv.width - w) / 2, (pv.height - h) / 2, w, h);
    };
    sel.addEventListener("change", () => {
      if (sel.value === "__import") { sel.value = cur; file.value = ""; file.click(); return; }
      cur = sel.value; paint(); if (o.onPick) o.onPick(cur || null);
    });
    sel.addEventListener("keydown", (e) => e.stopPropagation());
    file.addEventListener("change", () => {
      const fs = [].slice.call(file.files || []); if (!fs.length) return;
      if (fs.length > 1 || /\.zip$/i.test(fs[0].name)) { importMany(fs); return; }
      const f = fs[0];
      say("Reading " + f.name + "…");
      importFile(f).then((p) => {
        cur = p.id; paint(); if (o.onPick) o.onPick(cur);
        const n = p.notes || {}, bits = [];
        if (n.decor) bits.push(n.decor + " background / decoration layer(s) left out");
        if (n.glossLost) bits.push(n.glossLost + " bevel profile contour(s) drawn as a plain bevel");
        if (n.skipped) bits.push(n.skipped + " pattern overlay(s) not read");
        if (n.skew) bits.push(n.skew + " slanted copy(ies) straightened");
        say("＋ " + p.name + " added" + (bits.length ? " (" + bits.join("; ") + ")" : ""));
      }).catch((e) => say("That PSD was not added: " + (e.message || e)));
    });
    /* 2.617.0: zips and / or several PSDs at once - each zip's effects (and fonts) go in, one line says what happened */
    async function importMany(fs) {
      const added = [], failed = [], fonts = [];
      for (const f of fs) {
        try {
          if (/\.zip$/i.test(f.name)) {
            const r = await importZip(f, { onStep: (t, d, n) => say("Reading " + f.name + ": " + (t === "done" ? "done" : (d + 1) + " / " + n + " - " + t) + "…") });
            added.push(...r.added); failed.push(...r.failed); fonts.push(...r.fonts.filter((x) => !x.existed));
          } else { say("Reading " + f.name + "…"); added.push(await importFile(f, { reload: false })); }
        } catch (e) { failed.push({ name: f.name, error: String(e.message || e) }); }
      }
      await load(true);
      if (added.length) { cur = added[0].id; paint(); if (o.onPick) o.onPick(cur); }
      say((added.length ? "＋ " + added.length + " text effect" + (added.length > 1 ? "s" : "") + " added (" + added.slice(0, 4).map((p) => p.name).join(", ") + (added.length > 4 ? " …" : "") + ")" : "No text effects added")
        + (fonts.length ? " · " + fonts.length + " font(s) added: " + fonts.map((x) => x.family || x.name).slice(0, 4).join(", ") : "")
        + (failed.length ? " · not added: " + failed.slice(0, 3).map((x) => x.name + " (" + x.error + ")").join("; ") + (failed.length > 3 ? " …" : "") : ""));
      if (typeof root.H3TestEvent === "function") root.H3TestEvent("textfx_zip", String(added.length));
      return { added, failed, fonts };
    }
    box.importMany = importMany;
    del.addEventListener("click", () => {
      const p = byId(cur); if (!p || p.builtin) return;
      remove(p.id).then(() => { cur = ""; paint(); if (o.onPick) o.onPick(null); say("🗑 " + p.name + " deleted"); });
    });
    load().then(paint);
    paint();
    box.refresh = (id) => { cur = id || ""; paint(); };
    return box;
  }
  Object.assign(api, { ensure, ready, load, list: () => list || [], byId, onList, render, live, full, drawText, renderFace, faceLive, faceFull, inkOf, inkHeight, avgColor, setSharp, isSharp: () => sharp > 0, fontCss, costOf: (id) => cost.get(id) || null, importFile, importZip, prettyName, remove, rename, picker, layout, _results: results });
  root.H3TextFx = api;
  if (typeof fetch === "function") load();
})(typeof window !== "undefined" ? window : globalThis);
