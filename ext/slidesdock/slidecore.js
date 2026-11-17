/* ext/slidesdock/slidecore.js — 🎞 SLIDES (2.831.0): the deck model, shared by the page and the server (lib/slideFiles.js,
 * lib/slidePptx.js require it). Pure - Node: scripts/test-831.js.
 *
 * Tim: "can you add the slides now please" (the app strip's last app - ✉ Mail, ▦ Spreadsheet, 🎞 Slides; the agreed plan: its
 * own canvas, .pptx out (pptxgenjs MIT) + in, a presenter view, ✨ outline -> slides with the LLM + generated pictures).
 *
 * A DECK  {v: 1, w: 1280, h: 720 (16:9; 4:3 = 960 x 720), theme, slides: [SLIDE], media: {id: "data:image/…"}}
 * A SLIDE {id, layout, bg? "#rrggbb", notes, transition none | fade | push | zoom | wipe, items: [ITEM]}
 * An ITEM {id, type text | shape | image, x, y, w, h (slide px), rot?, role? title | sub | body | body2 | pic (a layout's
 *          placeholder - empty = a hint while editing, nothing when shown / exported),
 *          text: lines with \n, st {font, size, color, b, i, u, align left|center|right, valign top|middle|bottom, bullets},
 *          shape: rect | round | ellipse | triangle | rarrow | larrow | star | diamond | line, fill, line, lw,
 *          src: "media:<id>" (an image), fit cover | contain}
 * Pictures live once in deck.media (an undo step does not copy them).
 */
(function (root) {
  "use strict";
  const SIZES = { "16:9": [1280, 720], "4:3": [960, 720] };
  const FONTS = ["Calibri", "Arial", "Segoe UI", "Helvetica", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Garamond", "Courier New", "Impact"];
  const SHAPES = ["rect", "round", "ellipse", "triangle", "diamond", "rarrow", "larrow", "star", "line"];
  const TRANSITIONS = ["none", "fade", "push", "wipe", "zoom"];
  // the looks: background, title / text colours, the accent (shapes, bullets), fonts
  const THEMES = {
    plain:  { name: "Plain",      bg: "#ffffff", title: "#1f2328", text: "#3a3f45", accent: "#2f6fde", font: "Calibri", titleFont: "Calibri" },
    tiger:  { name: "bitGen",     bg: "#16181d", title: "#ffffff", text: "#d6d9de", accent: "#ff8a1f", font: "Segoe UI", titleFont: "Segoe UI" },
    night:  { name: "Night",      bg: "#0f1b2d", title: "#f2f6ff", text: "#c6d2e6", accent: "#4fc3f7", font: "Arial", titleFont: "Arial" },
    forest: { name: "Forest",     bg: "#f3f7f1", title: "#1e4d2b", text: "#2f3b31", accent: "#3c8d50", font: "Georgia", titleFont: "Georgia" },
    paper:  { name: "Paper",      bg: "#fbf6ec", title: "#5a3e1b", text: "#4a3b2a", accent: "#c2702a", font: "Garamond", titleFont: "Garamond" },
    bold:   { name: "Bold",       bg: "#ffd166", title: "#1b1b1b", text: "#262626", accent: "#d62828", font: "Trebuchet MS", titleFont: "Impact" },
  };
  const LAYOUTS = {
    title:    "Title slide",
    content:  "Title and content",
    two:      "Two contents",
    section:  "Section header",
    picture:  "Picture with caption",
    titleonly:"Title only",
    blank:    "Blank",
  };
  const HINTS = { title: "Click to add a title", sub: "Click to add a subtitle", body: "Click to add text", body2: "Click to add text", pic: "Click 🖼 Picture or drop one here" };
  let seq = 0;
  const uid = (p) => (p || "i") + Date.now().toString(36) + (++seq).toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const theme = (deck) => THEMES[(deck && deck.theme) || "plain"] || THEMES.plain;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);

  /** the placeholders of a layout, sized to the deck */
  function layoutItems(layout, W, H) {
    const m = Math.round(W * 0.06), cw = W - 2 * m;
    const T = (role, x, y, w, h, st) => ({ id: uid(), type: "text", role, x, y, w, h, text: "", st: Object.assign({ align: "left", valign: "top" }, st) });
    switch (layout) {
      case "title": return [T("title", m, H * 0.3, cw, H * 0.22, { size: 60, b: true, align: "center", valign: "bottom" }), T("sub", m, H * 0.55, cw, H * 0.14, { size: 28, align: "center", sub: 1 })];
      case "section": return [T("title", m, H * 0.36, cw, H * 0.2, { size: 54, b: true, valign: "bottom" }), T("sub", m, H * 0.58, cw, H * 0.12, { size: 26, sub: 1 })];
      case "two": return [T("title", m, H * 0.06, cw, H * 0.16, { size: 44, b: true, valign: "middle" }), T("body", m, H * 0.26, cw / 2 - 16, H * 0.66, { size: 26, bullets: true }), T("body2", m + cw / 2 + 16, H * 0.26, cw / 2 - 16, H * 0.66, { size: 26, bullets: true })];
      case "picture": return [T("title", m, H * 0.06, cw, H * 0.14, { size: 40, b: true, valign: "middle" }), { id: uid(), type: "image", role: "pic", x: m, y: H * 0.23, w: cw * 0.62, h: H * 0.68, src: "", fit: "cover" }, T("body", m + cw * 0.62 + 24, H * 0.23, cw * 0.38 - 24, H * 0.68, { size: 22 })];
      case "titleonly": return [T("title", m, H * 0.06, cw, H * 0.16, { size: 44, b: true, valign: "middle" })];
      case "blank": return [];
      default: return [T("title", m, H * 0.06, cw, H * 0.16, { size: 44, b: true, valign: "middle" }), T("body", m, H * 0.26, cw, H * 0.66, { size: 28, bullets: true })];
    }
  }
  function newSlide(layout, deck) {
    const W = (deck && deck.w) || 1280, H = (deck && deck.h) || 720, L = LAYOUTS[layout] ? layout : "content";
    return { id: uid("s"), layout: L, notes: "", transition: "none", items: layoutItems(L, W, H).map((it) => Object.assign(it, { x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w), h: Math.round(it.h) })) };
  }
  function newDeck(themeId, size) {
    const [w, h] = SIZES[size] || SIZES["16:9"];
    const d = { v: 1, w, h, theme: THEMES[themeId] ? themeId : "plain", slides: [], media: {} };
    d.slides.push(newSlide("title", d));
    return d;
  }

  /* ---- cleaning (the server keeps only this shape; it also upgrades / repairs a draft) */
  const COLOR = /^#[0-9a-fA-F]{6}$/;
  const col = (c) => (typeof c === "string" && COLOR.test(c) ? c.toLowerCase() : undefined);
  function cleanSt(st) {
    const s = st && typeof st === "object" ? st : {}, o = {};
    if (typeof s.font === "string") { const f = s.font.replace(/[^\w \-.]/g, "").trim().slice(0, 48); if (f) o.font = f; }
    if (Number.isFinite(+s.size) && +s.size >= 6 && +s.size <= 300) o.size = Math.round(+s.size);
    if (col(s.color)) o.color = col(s.color);
    for (const k of ["b", "i", "u", "bullets"]) if (s[k]) o[k] = true;
    if (s.sub) o.sub = 1;
    if (["left", "center", "right", "justify"].includes(s.align)) o.align = s.align;
    if (["top", "middle", "bottom"].includes(s.valign)) o.valign = s.valign;
    return o;
  }
  function cleanItem(it, W, H) {
    if (!it || typeof it !== "object" || !["text", "shape", "image"].includes(it.type)) return null;
    const o = { id: typeof it.id === "string" && it.id ? it.id.slice(0, 40) : uid(), type: it.type,
      x: Math.round(clamp(num(it.x, 0), -W, 2 * W)), y: Math.round(clamp(num(it.y, 0), -H, 2 * H)), w: Math.round(clamp(num(it.w, 100), 2, 4 * W)), h: Math.round(clamp(num(it.h, 60), 2, 4 * H)) };
    if (num(it.rot, 0)) o.rot = Math.round(clamp(num(it.rot, 0), -360, 360));
    if (["title", "sub", "body", "body2", "pic"].includes(it.role)) o.role = it.role;
    if (typeof it.text === "string") o.text = it.text.slice(0, 20000);
    if (it.st) o.st = cleanSt(it.st);
    if (it.type === "shape") { o.shape = SHAPES.includes(it.shape) ? it.shape : "rect"; if (col(it.fill) || it.fill === "none") o.fill = col(it.fill) || "none"; if (col(it.line) || it.line === "none") o.line = col(it.line) || "none"; o.lw = Math.round(clamp(num(it.lw, 0), 0, 40)); }
    if (it.type === "image") { o.src = typeof it.src === "string" && /^media:[\w-]{1,40}$/.test(it.src) ? it.src : ""; o.fit = it.fit === "contain" ? "contain" : "cover"; }
    if (it.type !== "image" && o.text == null) o.text = "";
    return o;
  }
  function clean(deck) {
    const d = deck && typeof deck === "object" ? deck : {};
    const W = d.w === 960 ? 960 : 1280, H = 720;
    const out = { v: 1, w: W, h: H, theme: THEMES[d.theme] ? d.theme : "plain", slides: [], media: {} };
    const slides = Array.isArray(d.slides) ? d.slides.slice(0, 500) : [];
    for (const s of slides) {
      if (!s || typeof s !== "object") continue;
      const o = { id: typeof s.id === "string" && s.id ? s.id.slice(0, 40) : uid("s"), layout: LAYOUTS[s.layout] ? s.layout : "blank", notes: typeof s.notes === "string" ? s.notes.slice(0, 20000) : "",
        transition: TRANSITIONS.includes(s.transition) ? s.transition : "none", items: (Array.isArray(s.items) ? s.items.slice(0, 400) : []).map((it) => cleanItem(it, W, H)).filter(Boolean) };
      if (col(s.bg)) o.bg = col(s.bg);
      if (s.hidden) o.hidden = true;
      out.slides.push(o);
    }
    if (!out.slides.length) out.slides.push(newSlide("title", out));
    // only the pictures a slide still shows are kept
    const used = new Set(); for (const s of out.slides) for (const it of s.items) if (it.src) used.add(it.src.slice(6));
    const media = d.media && typeof d.media === "object" ? d.media : {};
    for (const k of Object.keys(media)) if (used.has(k) && typeof media[k] === "string" && /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(media[k])) out.media[k] = media[k];
    for (const s of out.slides) for (const it of s.items) if (it.src && !out.media[it.src.slice(6)]) it.src = "";
    return out;
  }

  /** the look an item's text is drawn with: its own, else the theme's (a title / a subtitle / the rest) */
  function textLook(it, deck) {
    const T = theme(deck), st = it.st || {}, title = it.role === "title";
    return { font: st.font || (title ? T.titleFont : T.font), size: st.size || (title ? 44 : 28), color: st.color || (title ? T.title : st.sub ? T.text : T.text),
      b: !!st.b, i: !!st.i, u: !!st.u, align: st.align || "left", valign: st.valign || "top", bullets: !!st.bullets };
  }
  /** a slide's background colour */
  const bgOf = (slide, deck) => (slide && slide.bg) || theme(deck).bg;
  /** a shape's fill / line (none = "none") */
  function shapeLook(it, deck) { const T = theme(deck); return { fill: it.fill || T.accent, line: it.line || "none", lw: it.lw || 0 }; }
  /** a shape as an SVG path in a 100 x 100 box (stretched to the item) */
  function shapePath(kind) {
    switch (kind) {
      case "ellipse": return "M50 0A50 50 0 1 1 49.99 0Z";
      case "triangle": return "M50 0L100 100L0 100Z";
      case "diamond": return "M50 0L100 50L50 100L0 50Z";
      case "rarrow": return "M0 30H62V0L100 50L62 100V70H0Z";
      case "larrow": return "M100 30H38V0L0 50L38 100V70H100Z";
      case "star": { let p = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 19.1 : 50; p += (i ? "L" : "M") + (50 + r * Math.cos(a)).toFixed(2) + " " + (52 + r * Math.sin(a)).toFixed(2); } return p + "Z"; }
      case "line": return "M0 50L100 50";
      case "round": return "M12 0H88A12 12 0 0 1 100 12V88A12 12 0 0 1 88 100H12A12 12 0 0 1 0 88V12A12 12 0 0 1 12 0Z";
      default: return "M0 0H100V100H0Z";
    }
  }
  /** what a slide says (its title, then the rest) - the slide list's tooltip, the outline */
  function titleOf(slide) { const t = (slide.items || []).find((i) => i.role === "title" && i.text); return t ? t.text.split("\n")[0] : ""; }
  /** move a slide from i to j */
  function moveSlide(deck, i, j) { const s = deck.slides.splice(i, 1)[0]; deck.slides.splice(clamp(j, 0, deck.slides.length), 0, s); return deck; }
  /** a slide's copy with new ids (pictures shared) */
  function copySlide(s) { const c = JSON.parse(JSON.stringify(s)); c.id = uid("s"); c.items.forEach((it) => { it.id = uid(); }); return c; }
  /** change a slide's layout: its placeholders' words move to the new layout's (title to title, body to body …), other items stay */
  function relayout(slide, layout, deck) {
    const fresh = layoutItems(layout, deck.w, deck.h).map((it) => Object.assign(it, { x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w), h: Math.round(it.h) }));
    const old = slide.items.filter((i) => i.role), keep = slide.items.filter((i) => !i.role);
    for (const f of fresh) { const o = old.find((x) => x.role === f.role) || (f.role === "body" ? old.find((x) => x.role === "body2") : null); if (o) { if (o.type === "image") f.src = o.src; else f.text = o.text; old.splice(old.indexOf(o), 1); } }
    for (const o of old) if ((o.text && o.text.trim()) || o.src) { delete o.role; keep.push(o); }   // words with no place stay as plain items
    slide.layout = layout; slide.items = fresh.concat(keep);
    return slide;
  }

  const api = { SIZES, FONTS, SHAPES, TRANSITIONS, THEMES, LAYOUTS, HINTS, uid, theme, newSlide, newDeck, layoutItems, clean, cleanItem, textLook, bgOf, shapeLook, shapePath, titleOf, moveSlide, copySlide, relayout };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.SlideCore = api;
})(typeof window !== "undefined" ? window : globalThis);
