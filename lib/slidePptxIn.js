// bitGen Studio — lib/slidePptxIn.js (2.832.0): 🎞 SLIDES - a PowerPoint file (.pptx) opened as a deck.
//
// Tim: "yes please go ahead wth part 2". Read with JSZip + @xmldom/xmldom (both MIT): presentation.xml (the slide size and
// order), each slide's shapes / text boxes / pictures / groups / connectors, placeholders' places + text sizes taken from the
// slide's layout and master when the slide leaves them out, the theme's colours (schemeClr + lumMod / lumOff / tint / shade),
// solid backgrounds, bullets (a:buChar / a body placeholder), alignment, bold / italic / underline, font, size, the speaker
// notes, hidden slides, the transition, tables and charts (2.835.0). SmartArt and video are left out and counted in `notes`.
//   fromPptx(buffer) -> {deck (slidecore's shape, cleaned), notes: [words]}
"use strict";
const path = require("path");
const SC = require("../ext/slidesdock/slidecore.js");

const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const PRST = { rect: "rect", roundRect: "round", snipRoundRect: "round", round2SameRect: "round", ellipse: "ellipse", triangle: "triangle", rtTriangle: "triangle", diamond: "diamond", rightArrow: "rarrow", leftArrow: "larrow", star5: "star", star4: "star", star6: "star", line: "line", straightConnector1: "line" };
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };

function parse(xml) {
  const { DOMParser } = require("@xmldom/xmldom");
  return new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() {} } }).parseFromString(xml, "text/xml");
}
const kids = (el, ns, name) => { const o = []; if (!el) return o; for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.localName === name && (!ns || c.namespaceURI === ns)) o.push(c); return o; };
const kid = (el, ns, name) => kids(el, ns, name)[0] || null;
const path1 = (el, ...steps) => { let e = el; for (const [ns, n] of steps) { e = kid(e, ns, n); if (!e) return null; } return e; };
const attr = (el, n) => (el && el.getAttribute(n)) || "";
const num = (v, d) => (v === "" || v == null || isNaN(+v) ? d : +v);
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** the colour of an a:solidFill / a:srgbClr / a:schemeClr … with its lum / tint / shade changes */
function colorOf(fill, theme, map) {
  if (!fill) return null;
  let c = kid(fill, A, "srgbClr") || kid(fill, A, "schemeClr") || kid(fill, A, "sysClr") || kid(fill, A, "prstClr");
  if (!c && /Clr$/.test(fill.localName || "")) c = fill;
  if (!c) return null;
  let rgb = null;
  if (c.localName === "srgbClr") rgb = attr(c, "val");
  else if (c.localName === "sysClr") rgb = attr(c, "lastClr") || (attr(c, "val") === "window" ? "FFFFFF" : "000000");
  else if (c.localName === "prstClr") rgb = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", gray: "808080" }[attr(c, "val")] || "000000";
  else { let k = attr(c, "val"); k = (map && map[k]) || { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" }[k] || k; rgb = theme[k] || null; }
  if (!/^[0-9a-f]{6}$/i.test(rgb || "")) return null;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16));
  for (let m = c.firstChild; m; m = m.nextSibling) {
    if (m.nodeType !== 1) continue;
    const v = num(attr(m, "val"), 100000) / 100000;
    if (m.localName === "lumMod" || m.localName === "lumOff") {
      // in HSL: L * lumMod + lumOff
      const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255; let l = (mx + mn) / 2, s = 0, h = 0;
      if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); const R0 = r / 255, G0 = g / 255, B0 = b / 255; h = mx === R0 ? (G0 - B0) / d + (G0 < B0 ? 6 : 0) : mx === G0 ? (B0 - R0) / d + 2 : (R0 - G0) / d + 4; h /= 6; }
      l = m.localName === "lumMod" ? l * v : l + v; l = Math.max(0, Math.min(1, l));
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
      if (s === 0) r = g = b = l * 255; else { r = f(h + 1 / 3) * 255; g = f(h) * 255; b = f(h - 1 / 3) * 255; }
    } else if (m.localName === "tint") { r += (255 - r) * (1 - v); g += (255 - g) * (1 - v); b += (255 - b) * (1 - v); }
    else if (m.localName === "shade") { r *= v; g *= v; b *= v; }
  }
  return "#" + hex2(r) + hex2(g) + hex2(b);
}
/** a part's relationships: {rId: {target (a zip path), type}} */
async function rels(zip, partPath) {
  const p = path.posix.join(path.posix.dirname(partPath), "_rels", path.posix.basename(partPath) + ".rels"), f = zip.file(p); if (!f) return {};
  const doc = parse(await f.async("string")), out = {};
  for (const r of Array.from(doc.getElementsByTagName("Relationship"))) {
    const t = attr(r, "Target"); if (attr(r, "TargetMode") === "External") continue;
    out[attr(r, "Id")] = { target: t.startsWith("/") ? t.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(partPath), t)), type: attr(r, "Type").split("/").pop() };
  }
  return out;
}
const relOf = (rs, type) => Object.values(rs).find((r) => r.type === type);
/** a placeholder's key: its type (title / body …) and idx */
function phOf(sp) {
  const nv = kid(sp, P, "nvSpPr") || kid(sp, P, "nvPicPr"), ph = nv && path1(nv, [P, "nvPr"], [P, "ph"]);
  if (!ph) return null;
  const t = attr(ph, "type") || "body";
  return { type: t === "ctrTitle" ? "title" : t, idx: attr(ph, "idx") };
}
/** the placeholders of a layout / master: [{type, idx, xfrm, sz, algn, anchor, bullets}] */
function places(doc) {
  const out = [], tree = doc && path1(doc.documentElement, [P, "cSld"], [P, "spTree"]); if (!tree) return out;
  for (const sp of kids(tree, P, "sp")) {
    const ph = phOf(sp); if (!ph) continue;
    const xf = path1(sp, [P, "spPr"], [A, "xfrm"]), tb = kid(sp, P, "txBody");
    const lvl1 = tb && path1(tb, [A, "lstStyle"], [A, "lvl1pPr"]), rp = lvl1 && kid(lvl1, A, "defRPr");
    out.push(Object.assign({}, ph, { xfrm: xf, sz: rp ? num(attr(rp, "sz"), 0) : 0, algn: lvl1 ? attr(lvl1, "algn") : "", anchor: tb ? attr(kid(tb, A, "bodyPr"), "anchor") : "" }));
  }
  return out;
}
const findPlace = (list, ph) => (list || []).find((x) => ph.idx && x.idx === ph.idx) || (list || []).find((x) => x.type === ph.type) || (ph.type === "subTitle" ? null : null);

/** 2.835.0: an a:tbl -> a table item (no place yet): its cells' words, the header row (firstRow), banded rows, the first header
 *  cell's fill, the first run's size / colour */
function tableIn(tbl, theme, map, pxPerPt) {
  if (!tbl) return null;
  const rows = kids(tbl, A, "tr").map((tr) => kids(tr, A, "tc").map((tc) => kids(kid(tc, A, "txBody"), A, "p").map((p) => Array.from(p.getElementsByTagNameNS(A, "t")).map((t) => t.textContent).join("")).join("\n")));
  if (!rows.length || !rows[0].length) return null;
  const pr = kid(tbl, A, "tblPr"), trs = kids(tbl, A, "tr"), fillAt = (r) => { const tc = trs[r] && kid(trs[r], A, "tc"); return tc ? path1(tc, [A, "tcPr"], [A, "solidFill"]) : null; };
  const tc0 = path1(tbl, [A, "tr"], [A, "tc"]), fill = tc0 && colorOf(fillAt(0), theme, map);
  const bold0 = !!(tc0 && Array.from(tc0.getElementsByTagNameNS(A, "rPr")).some((r) => attr(r, "b") === "1"));
  // the flags PowerPoint sets, else what the cells show (a filled bold first row = a header; every other row filled = banded)
  const it = { type: "table", rows, head: attr(pr, "firstRow") === "1" || (!!fill && bold0), band: attr(pr, "bandRow") === "1" || (trs.length > 3 && !!fillAt(2) && !fillAt(1) && !fillAt(3)) };
  if (it.head && fill) it.headFill = fill;
  const rp = tbl.getElementsByTagNameNS(A, "rPr")[1] || tbl.getElementsByTagNameNS(A, "rPr")[0], sz = rp ? num(attr(rp, "sz"), 0) : 0;
  it.st = {}; if (sz) it.st.size = Math.max(6, Math.round(sz / 100 * pxPerPt));
  return it;
}
/** 2.835.0: a chart part (c:chartSpace) -> {type, title, legend, cats, series} from its cached numbers, or null */
function chartIn(doc) {
  const plot = doc && doc.getElementsByTagNameNS(C, "plotArea")[0]; if (!plot) return null;
  const KIND = { barChart: "column", bar3DChart: "column", lineChart: "line", line3DChart: "line", areaChart: "area", area3DChart: "area", pieChart: "pie", pie3DChart: "pie", doughnutChart: "doughnut" };
  let el = null; for (let c = plot.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && KIND[c.localName]) { el = c; break; }
  if (!el) return null;
  let type = KIND[el.localName]; if (type === "column" && attr(kid(el, C, "barDir"), "val") === "bar") type = "bar";
  const pts = (cache) => { const out = []; if (!cache) return out; for (const p of kids(cache, C, "pt")) out[num(attr(p, "idx"), out.length)] = (kid(p, C, "v") || {}).textContent; return out; };
  // a cache of points; PowerPoint (and pptxgenjs for bar charts) may keep categories in a multi-level cache (c:lvl)
  const cacheOf = (e) => e && (e.getElementsByTagNameNS(C, "strCache")[0] || e.getElementsByTagNameNS(C, "numCache")[0] || e.getElementsByTagNameNS(C, "strLit")[0] || e.getElementsByTagNameNS(C, "numLit")[0] || e.getElementsByTagNameNS(C, "lvl")[0]);
  let cats = [];
  const series = kids(el, C, "ser").map((sr, i) => {
    const tx = kid(sr, C, "tx"), nm = tx ? (pts(cacheOf(tx))[0] || (tx.getElementsByTagNameNS(C, "v")[0] || {}).textContent) : "";
    const cs = pts(cacheOf(kid(sr, C, "cat"))), vs = pts(cacheOf(kid(sr, C, "val")));
    if (cs.length > cats.length) cats = cs;
    return { name: nm || "Series " + (i + 1), values: vs.map((v) => +v || 0) };
  });
  if (!series.length) return null;
  const n = Math.max(cats.length, ...series.map((s) => s.values.length));
  for (let i = 0; i < n; i++) if (cats[i] == null) cats[i] = String(i + 1);
  const t = doc.getElementsByTagNameNS(C, "title")[0], title = t ? Array.from(t.getElementsByTagNameNS(A, "t")).map((x) => x.textContent).join("") : "";
  return SC.cleanChart({ type, title, legend: !!doc.getElementsByTagNameNS(C, "legend")[0], cats, series });
}
async function fromPptx(buf) {
  const JSZip = require("jszip"), zip = await JSZip.loadAsync(buf), notes = [];
  const text = async (p) => { const f = zip.file(p); return f ? f.async("string") : null; };
  const pres = parse(await text("ppt/presentation.xml") || "<p:presentation/>"), pr = pres.documentElement;
  const sz = kid(pr, P, "sldSz"), cx = num(attr(sz, "cx"), 12192000), cy = num(attr(sz, "cy"), 6858000);
  const W = cx / cy < 1.55 ? 960 : 1280, H = 720, kx = W / cx, ky = H / cy;
  const pxPerPt = (H / (cy / 914400)) / 72;              // slide px an inch / 72
  const presRels = await rels(zip, "ppt/presentation.xml");
  // the theme's colours (+ the master's colour map)
  const theme = {}, themeRel = relOf(presRels, "theme");
  if (themeRel) {
    const td = parse(await text(themeRel.target) || "<a:theme/>"), cs = td.getElementsByTagNameNS(A, "clrScheme")[0];
    if (cs) for (const c of Array.from(cs.childNodes)) if (c.nodeType === 1) { const s = kid(c, A, "srgbClr"), sy = kid(c, A, "sysClr"); theme[c.localName] = s ? attr(s, "val") : sy ? attr(sy, "lastClr") || "000000" : ""; }
  }
  const deck = { v: 1, w: W, h: H, theme: "plain", slides: [], media: {} };
  const ids = kids(kid(pr, P, "sldIdLst"), P, "sldId").map((s) => s.getAttributeNS(R, "id") || attr(s, "r:id"));
  const layoutCache = {}, skipped = {}, mediaIds = {};
  const skip = (what) => { skipped[what] = (skipped[what] || 0) + 1; };
  async function media(target) {
    if (mediaIds[target]) return mediaIds[target];
    const f = zip.file(target); if (!f) return "";
    const ext = (target.split(".").pop() || "").toLowerCase(), mime = MIME[ext]; if (!mime) { skip("pictures in " + ext.toUpperCase() + " (not shown in a browser)"); return ""; }
    const id = "m" + Object.keys(mediaIds).length.toString(36) + Date.now().toString(36);
    deck.media[id] = `data:${mime};base64,` + (await f.async("base64"));
    return (mediaIds[target] = "media:" + id);
  }
  async function layoutOf(slidePath) {
    const rs = await rels(zip, slidePath), lr = relOf(rs, "slideLayout"); if (!lr) return { layout: [], master: [], map: null, bg: null };
    if (layoutCache[lr.target]) return layoutCache[lr.target];
    const ld = parse(await text(lr.target) || "<p:sldLayout/>"), lrs = await rels(zip, lr.target), mr = relOf(lrs, "slideMaster");
    const md = mr ? parse(await text(mr.target) || "<p:sldMaster/>") : null;
    const cmap = md && kid(md.documentElement, P, "clrMap"), map = {}; if (cmap) for (const a of Array.from(cmap.attributes)) map[a.name] = a.value;
    const bgOf = (d) => { const b = d && path1(d.documentElement, [P, "cSld"], [P, "bg"], [P, "bgPr"]); return b ? colorOf(kid(b, A, "solidFill"), theme, map) : null; };
    // the master's title / body text sizes
    const ts = md && path1(md.documentElement, [P, "txStyles"]), szOf = (k) => { const l = ts && path1(ts, [P, k], [A, "lvl1pPr"], [A, "defRPr"]); return l ? num(attr(l, "sz"), 0) : 0; };
    return (layoutCache[lr.target] = { layout: places(ld), master: md ? places(md) : [], map, bg: bgOf(ld) || bgOf(md), titleSz: szOf("titleStyle"), bodySz: szOf("bodyStyle"), name: attr(path1(ld.documentElement, [P, "cSld"]), "name") });
  }
  for (let n = 0; n < ids.length; n++) {
    const rel = presRels[ids[n]]; if (!rel) continue;
    const sp = rel.target, doc = parse(await text(sp) || "<p:sld/>"), root = doc.documentElement, L = await layoutOf(sp), rs = await rels(zip, sp);
    const slide = { id: "s" + n.toString(36) + Date.now().toString(36), layout: "blank", notes: "", transition: "none", items: [] };
    if (attr(root, "show") === "0") slide.hidden = true;
    const bg = path1(root, [P, "cSld"], [P, "bg"], [P, "bgPr"]), bgc = bg ? colorOf(kid(bg, A, "solidFill"), theme, L.map) : null;
    if (bg && !bgc && kid(bg, A, "blipFill")) skip("picture backgrounds");
    slide.bg = bgc || L.bg || "#" + (theme.lt1 || "FFFFFF");
    const tr = kid(root, P, "transition") || (root.getElementsByTagNameNS(P, "transition")[0] || null);
    if (tr) { const k = Array.from(tr.childNodes).find((c) => c.nodeType === 1); slide.transition = k ? ({ fade: "fade", push: "push", wipe: "wipe", zoom: "zoom", cover: "push", pull: "push", split: "wipe", dissolve: "fade" }[k.localName] || "fade") : "fade"; }
    // the shapes, in order (groups flattened with their transform)
    const tree = path1(root, [P, "cSld"], [P, "spTree"]);
    const box = (xf, T) => {
      if (!xf) return null;
      const o = kid(xf, A, "off"), e = kid(xf, A, "ext"); if (!o || !e) return null;
      let x = num(attr(o, "x"), 0), y = num(attr(o, "y"), 0), w = num(attr(e, "cx"), 0), h = num(attr(e, "cy"), 0);
      for (const t of T) { x = t.x + (x - t.cx) * t.sx; y = t.y + (y - t.cy) * t.sy; w *= t.sx; h *= t.sy; }
      return { x: Math.round(x * kx), y: Math.round(y * ky), w: Math.max(2, Math.round(w * kx)), h: Math.max(2, Math.round(h * ky)), rot: Math.round(num(attr(xf, "rot"), 0) / 60000) || undefined, flipH: attr(xf, "flipH") === "1" };
    };
    const runText = (tb, ph, place, Lsz) => {
      const paras = kids(tb, A, "p"); let size = 0, b = false, i = false, u = false, color = null, font = "", algn = "", bullets = false, anyBu = false;
      const lines = [];
      for (const p of paras) {
        const ppr = kid(p, A, "pPr"); if (ppr && !algn) algn = attr(ppr, "algn");
        if (ppr && kid(ppr, A, "buChar")) anyBu = true;
        let t = "";
        for (const c of Array.from(p.childNodes)) {
          if (c.nodeType !== 1) continue;
          if (c.localName === "r" || c.localName === "fld") {
            const rp = kid(c, A, "rPr"), tt = kid(c, A, "t"); t += tt ? tt.textContent : "";
            if (rp) { if (!size) size = num(attr(rp, "sz"), 0); if (attr(rp, "b") === "1") b = true; if (attr(rp, "i") === "1") i = true; if (attr(rp, "u") && attr(rp, "u") !== "none") u = true; if (!color) color = colorOf(kid(rp, A, "solidFill"), theme, L.map); const la = kid(rp, A, "latin"); if (!font && la && !/^\+/.test(attr(la, "typeface"))) font = attr(la, "typeface"); }
          } else if (c.localName === "br") t += "\n";
        }
        if (!size) { const e = kid(p, A, "endParaRPr"); if (e) size = num(attr(e, "sz"), 0); }
        lines.push(t);
      }
      while (lines.length && !lines[lines.length - 1]) lines.pop();
      bullets = anyBu || (ph && ph.type === "body" && !paras.some((p) => { const ppr = kid(p, A, "pPr"); return ppr && kid(ppr, A, "buNone"); }) && lines.length > 0);
      const isTitle = ph && ph.type === "title";
      const ptSize = size ? size / 100 : (place && place.sz ? place.sz / 100 : 0) || (isTitle ? (L.titleSz || 4400) / 100 : ph ? (L.bodySz || 2800) / 100 : 18);
      const anchor = attr(kid(tb, A, "bodyPr"), "anchor") || (place && place.anchor) || (isTitle ? "ctr" : "t");
      algn = algn || (place && place.algn) || "l";
      const st = { size: Math.max(6, Math.round(ptSize * pxPerPt)), align: { l: "left", ctr: "center", r: "right", just: "justify", dist: "justify" }[algn] || "left", valign: { t: "top", ctr: "middle", b: "bottom" }[anchor] || "top" };
      if (b) st.b = true; if (i) st.i = true; if (u) st.u = true; if (color) st.color = color; if (font) st.font = font; if (bullets) st.bullets = true;
      return { text: lines.join("\n"), st };
    };
    const walk = async (parent, T) => {
      for (let el = parent.firstChild; el; el = el.nextSibling) {
        if (el.nodeType !== 1) continue;
        const ln = el.localName;
        if (ln === "grpSp") {
          const xf = path1(el, [P, "grpSpPr"], [A, "xfrm"]), o = kid(xf, A, "off"), e = kid(xf, A, "ext"), co = kid(xf, A, "chOff"), ce = kid(xf, A, "chExt");
          const t = o && e && co && ce ? { x: num(attr(o, "x"), 0), y: num(attr(o, "y"), 0), cx: num(attr(co, "x"), 0), cy: num(attr(co, "y"), 0), sx: num(attr(e, "cx"), 1) / (num(attr(ce, "cx"), 1) || 1), sy: num(attr(e, "cy"), 1) / (num(attr(ce, "cy"), 1) || 1) } : null;
          await walk(el, t ? [t].concat(T) : T); continue;
        }
        if (ln === "sp" || ln === "cxnSp") {
          const ph = phOf(el), place = ph ? findPlace(L.layout, ph) || findPlace(L.master, ph) : null;
          const spPr = kid(el, P, "spPr"), b0 = box(kid(spPr, A, "xfrm"), T) || (place ? box(place.xfrm, T) || (findPlace(L.master, ph) ? box(findPlace(L.master, ph).xfrm, T) : null) : null);
          if (!b0) continue;
          const geom = kid(spPr, A, "prstGeom"), prst = geom ? attr(geom, "prst") : "", tb = kid(el, P, "txBody");
          const tx = tb ? runText(tb, ph, place) : { text: "", st: {} };
          const fill = kid(spPr, A, "noFill") ? "none" : colorOf(kid(spPr, A, "solidFill"), theme, L.map);
          const lnEl = kid(spPr, A, "ln"), line = lnEl ? (kid(lnEl, A, "noFill") ? "none" : colorOf(kid(lnEl, A, "solidFill"), theme, L.map)) : null, lw = lnEl ? Math.round(num(attr(lnEl, "w"), 12700) / 12700 * pxPerPt * 10) / 10 : 0;
          const styleFill = !fill && path1(el, [P, "style"], [A, "fillRef"]) ? colorOf(path1(el, [P, "style"], [A, "fillRef"]), theme, L.map) : null;
          const isShape = ln === "cxnSp" || (prst && prst !== "rect") || (fill && fill !== "none") || (styleFill && !tb) || (line && line !== "none" && !ph);
          const base = { x: b0.x, y: b0.y, w: b0.w, h: b0.h }; if (b0.rot) base.rot = b0.rot;
          if (isShape && !(ph && !fill)) {
            if (prst && !PRST[prst]) skip("shapes drawn as rectangles (" + prst + ")");
            const it = Object.assign(base, { type: "shape", shape: PRST[prst] || (ln === "cxnSp" ? "line" : "rect"), text: tx.text, st: tx.text ? tx.st : undefined, fill: fill || styleFill || (ln === "cxnSp" ? "none" : undefined), line: line || undefined, lw: lw || 0 });
            if (it.shape === "line") { it.fill = line && line !== "none" ? line : "#000000"; it.lw = Math.max(1, Math.round(lw || 2)); if (it.h < 6) { it.y -= 3; it.h = 6; } }
            slide.items.push(it);
          } else {
            if (!tx.text && (!ph || ph.type === "pic")) continue;
            const role = ph ? ({ title: "title", subTitle: "sub", body: slide.items.some((i) => i.role === "body") ? "body2" : "body", pic: "pic" }[ph.type]) : undefined;
            if (ph && ["dt", "ftr", "sldNum", "hdr"].includes(ph.type)) { if (!tx.text) continue; }
            slide.items.push(Object.assign(base, { type: "text", role: role && ["title", "sub", "body", "body2"].includes(role) ? role : undefined, text: tx.text, st: tx.st }));
          }
          continue;
        }
        if (ln === "pic") {
          const b0 = box(path1(el, [P, "spPr"], [A, "xfrm"]), T); if (!b0) continue;
          const bl = path1(el, [P, "blipFill"], [A, "blip"]), rid = bl && (bl.getAttributeNS(R, "embed") || attr(bl, "r:embed")), r = rid && rs[rid];
          if (path1(el, [P, "nvPicPr"], [P, "nvPr"], [A, "videoFile"]) || path1(el, [P, "nvPicPr"], [P, "nvPr"], [A, "audioFile"])) skip("video / sound (its picture kept)");
          const src = r ? await media(r.target) : "";
          if (!src) continue;
          const it = { x: b0.x, y: b0.y, w: b0.w, h: b0.h, type: "image", src, fit: "contain" }; if (b0.rot) it.rot = b0.rot;
          slide.items.push(it); continue;
        }
        if (ln === "graphicFrame") {
          const g = path1(el, [A, "graphic"], [A, "graphicData"]), u = attr(g, "uri"), b0 = box(kid(el, P, "xfrm"), T);
          // 2.835.0: tables and charts come in (slidecore table / chart items); SmartArt and the rest are still counted
          if (/table/.test(u) && b0) { const it = tableIn(kid(g, A, "tbl"), theme, L.map, pxPerPt); if (it) { slide.items.push(Object.assign(it, { x: b0.x, y: b0.y, w: b0.w, h: b0.h })); continue; } }
          if (/chart/.test(u) && b0) {
            const ce = kid(g, C, "chart"), rid = ce && (ce.getAttributeNS(R, "id") || attr(ce, "r:id")), r = rid && rs[rid];
            const ch = r ? chartIn(parse(await text(r.target) || "<c:chartSpace/>")) : null;
            if (ch) { slide.items.push({ type: "chart", x: b0.x, y: b0.y, w: b0.w, h: b0.h, chart: ch }); continue; }
          }
          skip(/table/.test(u) ? "tables" : /chart/.test(u) ? "charts" : /diagram/.test(u) ? "SmartArt" : "other objects"); continue;
        }
        if (ln === "AlternateContent") { const fb = kid(el, null, "Fallback") || kid(el, null, "Choice"); if (fb) await walk(fb, T); continue; }
      }
    };
    if (tree) await walk(tree, []);
    // a layout name we know (title / two / section …) - for Layout ▾
    const roles = slide.items.map((i) => i.role).filter(Boolean).join("+"), ln0 = String(L.name || "").toLowerCase();
    slide.layout = roles === "title+sub" || roles === "sub+title" ? (/section/.test(ln0) ? "section" : "title") : roles.includes("body2") ? "two" : roles.includes("body") && roles.includes("title") ? "content" : roles === "title" ? "titleonly" : "blank";
    // the speaker notes
    const nr = relOf(rs, "notesSlide");
    if (nr) {
      const nd = parse(await text(nr.target) || "<p:notes/>"), nt = nd.documentElement && path1(nd.documentElement, [P, "cSld"], [P, "spTree"]);
      for (const s of nt ? kids(nt, P, "sp") : []) { const ph = phOf(s); if (!ph || ph.type !== "body") continue; const tb = kid(s, P, "txBody"); if (tb) slide.notes = kids(tb, A, "p").map((p) => Array.from(p.getElementsByTagNameNS(A, "t")).map((t) => t.textContent).join("")).join("\n").trim(); }
    }
    deck.slides.push(slide);
  }
  if (!deck.slides.length) throw Object.assign(new Error("no slides in that file"), { status: 400 });
  for (const [k, n] of Object.entries(skipped)) notes.push(`${n} × ${k} left out`);
  return { deck: SC.clean(deck), notes };
}
module.exports = { tableIn, chartIn, fromPptx, colorOf };
