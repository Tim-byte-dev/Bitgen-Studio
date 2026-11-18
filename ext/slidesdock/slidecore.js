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
 * 2.835.0 (Tim: "add charts and tables on slides, or a theme built from brand colours"): ITEM type table {rows: [[cell]],
 *          head (the first row a header), band, headFill?, lineCol?, st} and chart {chart: {type column | bar | line | area |
 *          pie | doughnut, title, legend, cats, series: [{name, values}]}}; deck.theme "brand" + deck.brand {name, bg, title,
 *          text, accent, accent2, font, titleFont} (every theme has accent2 now - a chart's second colour).
 */
(function (root) {
  "use strict";
  const SIZES = { "16:9": [1280, 720], "4:3": [960, 720] };
  const FONTS = ["Calibri", "Arial", "Segoe UI", "Helvetica", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Garamond", "Courier New", "Impact"];
  const SHAPES = ["rect", "round", "ellipse", "triangle", "diamond", "rarrow", "larrow", "star", "line"];
  const TRANSITIONS = ["none", "fade", "push", "wipe", "zoom"];
  // the looks: background, title / text colours, the accent (shapes, bullets), fonts
  const THEMES = {
    plain:  { name: "Plain",      bg: "#ffffff", title: "#1f2328", text: "#3a3f45", accent: "#2f6fde", accent2: "#e8743b", font: "Calibri", titleFont: "Calibri" },
    tiger:  { name: "bitGen",     bg: "#16181d", title: "#ffffff", text: "#d6d9de", accent: "#ff8a1f", accent2: "#4fc3f7", font: "Segoe UI", titleFont: "Segoe UI" },
    night:  { name: "Night",      bg: "#0f1b2d", title: "#f2f6ff", text: "#c6d2e6", accent: "#4fc3f7", accent2: "#ff8a65", font: "Arial", titleFont: "Arial" },
    forest: { name: "Forest",     bg: "#f3f7f1", title: "#1e4d2b", text: "#2f3b31", accent: "#3c8d50", accent2: "#c9a227", font: "Georgia", titleFont: "Georgia" },
    paper:  { name: "Paper",      bg: "#fbf6ec", title: "#5a3e1b", text: "#4a3b2a", accent: "#c2702a", accent2: "#3f6e8c", font: "Garamond", titleFont: "Garamond" },
    bold:   { name: "Bold",       bg: "#ffd166", title: "#1b1b1b", text: "#262626", accent: "#d62828", accent2: "#1d3557", font: "Trebuchet MS", titleFont: "Impact" },
  };
  // 2.835.0: charts on slides (drawn by the spreadsheet's chart engine; native charts in the .pptx)
  const CHART_TYPES = ["column", "bar", "line", "area", "pie", "doughnut"];
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
  /** 2.835.0: a deck's look - a built-in theme, or "brand" = the deck's own brand colours + fonts (deck.brand) */
  const theme = (deck) => (deck && deck.theme === "brand" && deck.brand ? Object.assign({}, THEMES.plain, deck.brand) : THEMES[(deck && deck.theme) || "plain"] || THEMES.plain);
  const BRAND_KEYS = ["bg", "title", "text", "accent", "accent2"];
  /** a brand theme made safe: {name, bg, title, text, accent, accent2, font, titleFont} (colours #rrggbb) | null */
  function cleanBrand(b) {
    if (!b || typeof b !== "object") return null;
    const o = { name: String(b.name || "Brand").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 48) || "Brand" };
    for (const k of BRAND_KEYS) { const c = typeof b[k] === "string" && /^#[0-9a-fA-F]{6}$/.test(b[k]) ? b[k].toLowerCase() : null; if (!c) return null; o[k] = c; }
    for (const k of ["font", "titleFont"]) { const f = String(b[k] || "").replace(/[^\w \-.]/g, "").trim().slice(0, 48); o[k] = f || "Calibri"; }
    return o;
  }
  /** black or white words on a colour (whichever reads better) */
  function contrast(hex) { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ""); if (!m) return "#ffffff"; const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1b1b1b" : "#ffffff"; }
  /** the colours a chart's series / slices take: the theme's two accents, then lighter / darker steps of them, then a palette */
  function chartColors(deck) {
    const T = theme(deck), mix = (h, t, k) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - k) + parseInt(t.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");
    const a = T.accent, b = T.accent2 || "#e8743b";
    return [a, b, mix(a, "#ffffff", 0.45), mix(b, "#ffffff", 0.45), mix(a, "#000000", 0.35), mix(b, "#000000", 0.35), "#a5a5a5", "#ffc000", "#70ad47", "#5b9bd5"];
  }
  /** a table's look: the words (its own, else the theme's), the header row in the accent, lines, banded rows */
  function tableLook(it, deck) {
    const T = theme(deck), st = it.st || {}, head = it.headFill || T.accent;
    return { font: st.font || T.font, size: st.size || 20, color: st.color || T.text, head, headColor: contrast(head), line: it.lineCol || mixLine(T), band: it.band !== false ? bandOf(T) : null, hasHead: it.head !== false };
  }
  const mixLine = (T) => (contrast(T.bg) === "#ffffff" ? "#5a5f66" : "#c9cdd2");
  const bandOf = (T) => (contrast(T.bg) === "#ffffff" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)");
  /** 2.835.0: a new table / chart item, middle of the slide (or `box`) */
  function newTable(deck, rows, cols, box) {
    const r = Math.max(1, Math.min(30, Math.round(+rows || 4))), c = Math.max(1, Math.min(12, Math.round(+cols || 3))), W = deck.w, H = deck.h, b = box || { x: Math.round(W * 0.08), y: Math.round(H * 0.26), w: Math.round(W * 0.84), h: Math.min(Math.round(H * 0.64), 52 * r) };
    const cells = []; for (let i = 0; i < r; i++) { const row = []; for (let j = 0; j < c; j++) row.push(i === 0 ? "Heading " + (j + 1) : ""); cells.push(row); }
    return { id: uid(), type: "table", x: b.x, y: b.y, w: b.w, h: b.h, rows: cells, head: true, band: true, text: "" };
  }
  function newChart(deck, type, box) {
    const W = deck.w, H = deck.h, b = box || { x: Math.round(W * 0.12), y: Math.round(H * 0.24), w: Math.round(W * 0.76), h: Math.round(H * 0.68) };
    return { id: uid(), type: "chart", x: b.x, y: b.y, w: b.w, h: b.h, text: "",
      chart: { type: CHART_TYPES.includes(type) ? type : "column", title: "", legend: true, cats: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Sales", values: [12, 19, 15, 24] }, { name: "Costs", values: [8, 11, 10, 13] }] } };
  }
  /** a table's cells made safe (<= 30 x 12, strings) */
  function cleanRows(rows) {
    const rs = (Array.isArray(rows) ? rows : []).slice(0, 30).map((r) => (Array.isArray(r) ? r : []).slice(0, 12).map((c) => String(c == null ? "" : c).slice(0, 500)));
    const n = Math.max(1, ...rs.map((r) => r.length));
    if (!rs.length) rs.push([""]);
    return rs.map((r) => r.concat(Array(n - r.length).fill("")));
  }
  /** a chart's data made safe: <= 50 categories, <= 8 series of numbers (a missing number = 0) */
  function cleanChart(c) {
    const o = c && typeof c === "object" ? c : {};
    const cats = (Array.isArray(o.cats) ? o.cats : []).slice(0, 50).map((x) => String(x == null ? "" : x).slice(0, 60));
    const series = (Array.isArray(o.series) ? o.series : []).slice(0, 8).filter((x) => x && typeof x === "object").map((x, i) => ({ name: String(x.name == null ? "Series " + (i + 1) : x.name).slice(0, 60),
      values: cats.map((_, k) => { const v = Array.isArray(x.values) ? +x.values[k] : NaN; return Number.isFinite(v) ? v : 0; }) }));
    return { type: CHART_TYPES.includes(o.type) ? o.type : "column", title: String(o.title || "").slice(0, 100), legend: o.legend !== false, cats, series };
  }
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
    if (!it || typeof it !== "object" || !["text", "shape", "image", "table", "chart"].includes(it.type)) return null;
    const o = { id: typeof it.id === "string" && it.id ? it.id.slice(0, 40) : uid(), type: it.type,
      x: Math.round(clamp(num(it.x, 0), -W, 2 * W)), y: Math.round(clamp(num(it.y, 0), -H, 2 * H)), w: Math.round(clamp(num(it.w, 100), 2, 4 * W)), h: Math.round(clamp(num(it.h, 60), 2, 4 * H)) };
    if (num(it.rot, 0)) o.rot = Math.round(clamp(num(it.rot, 0), -360, 360));
    if (["title", "sub", "body", "body2", "pic"].includes(it.role)) o.role = it.role;
    if (typeof it.text === "string") o.text = it.text.slice(0, 20000);
    if (it.st) o.st = cleanSt(it.st);
    if (it.type === "shape") { o.shape = SHAPES.includes(it.shape) ? it.shape : "rect"; if (col(it.fill) || it.fill === "none") o.fill = col(it.fill) || "none"; if (col(it.line) || it.line === "none") o.line = col(it.line) || "none"; o.lw = Math.round(clamp(num(it.lw, 0), 0, 40)); }
    if (it.type === "image") { o.src = typeof it.src === "string" && /^media:[\w-]{1,40}$/.test(it.src) ? it.src : ""; o.fit = it.fit === "contain" ? "contain" : "cover"; }
    if (it.type === "table") { o.rows = cleanRows(it.rows); o.head = it.head !== false; o.band = it.band !== false; if (col(it.headFill)) o.headFill = col(it.headFill); if (col(it.lineCol)) o.lineCol = col(it.lineCol); }   // 2.835.0
    if (it.type === "chart") o.chart = cleanChart(it.chart);
    if (it.type !== "image" && o.text == null) o.text = "";
    return o;
  }
  function clean(deck) {
    const d = deck && typeof deck === "object" ? deck : {};
    const W = d.w === 960 ? 960 : 1280, H = 720;
    const brand = cleanBrand(d.brand);                                       // 2.835.0: the deck's brand theme
    const out = { v: 1, w: W, h: H, theme: THEMES[d.theme] || (d.theme === "brand" && brand) ? d.theme : "plain", slides: [], media: {} };
    if (brand) out.brand = brand;
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

  const api = { SIZES, FONTS, SHAPES, TRANSITIONS, THEMES, LAYOUTS, HINTS, CHART_TYPES, BRAND_KEYS, cleanBrand, contrast, chartColors, tableLook, newTable, newChart, cleanRows, cleanChart, uid, theme, newSlide, newDeck, layoutItems, clean, cleanItem, textLook, bgOf, shapeLook, shapePath, titleOf, moveSlide, copySlide, relayout };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.SlideCore = api;
})(typeof window !== "undefined" ? window : globalThis);
