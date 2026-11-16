/* pcdtpout.js — DESKTOP PUBLISHING EXPORT: the whole document, every page with its layers, as PDF / .ai / SVG (2.799.0),
 * window.PCDtpOut.
 *
 * Tim (verbatim): "i want to give the editor full desktop publishing ability like coreldraw, user can add multiple pages
 * each page will have it's own layers. export to cdr, ai,pdf" - asked: CDR = "Both PDF and SVG" (CorelDRAW's own .cdr
 * format has no public way to write it), AI = "PDF-compatible .ai".
 *
 *   FILE ▸ EXPORT ▸ DOCUMENT (PDF / AI / SVG)…   every page (pcpages.js) - a page = its size in mm (pt) - with:
 *     VECTOR   a shape layer (rectangle, ellipse, polygon, line, a pen path of added parts) = real PDF / SVG paths -
 *              its fill, its outline (width, joins, dashes), its opacity. Recorded by drawing the shape onto a pretend
 *              canvas (recorder()) that keeps the path instead of pixels.
 *     TEXT     a plain type layer = real, selectable text: the standard PDF fonts (Helvetica / Times / Courier) or, with
 *              Embed fonts, its own font from this computer (only the letters used); size, colour, tracking, alignment.
 *     PICTURE  any other layer (pixels, masks, styles, smart objects, warped / path text …) = a picture of just that
 *              layer, cut to what it covers.
 *     LAYERS   each layer is a PDF layer (an optional-content group, listed per page: "Page 2 / Logo") and an SVG
 *              layer (<g inkscape:groupmode="layer">). An adjustment layer, a blend mode other than Normal or a
 *              clipped layer needs what is under it: everything up to the last of those is one picture ("Flattened").
 *   FORMATS  PDF · Illustrator (.ai - a PDF-compatible .ai; Illustrator opens one page / artboard at a time) · SVG pages
 *            (.zip, one .svg a page) · CorelDRAW (.zip: the PDF + the SVG pages - open either in CorelDRAW, then save as
 *            .cdr there). Saved in the project's dtp folder (lib/dtpStore.js, routes/dtp.js) and downloaded.
 *
 * Pure (Node: scripts/test-dtpout799.js): recorder, ellipseCurves, parseColor, plan, alphaBox, toPdfOps, buildPdf (given
 * pdf-lib), buildSvg, b64, extOf.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const NAMED = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128] };
  /** "#rgb" / "#rrggbb" / "#rrggbbaa" / rgb() / rgba() / a few names -> {r, g, b (0-255), a (0-1)}; null = not a plain colour */
  function parseColor(c) {
    if (typeof c !== "string") return null;
    const s = c.trim().toLowerCase();
    if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    if (NAMED[s]) return { r: NAMED[s][0], g: NAMED[s][1], b: NAMED[s][2], a: 1 };
    let m = /^#([0-9a-f]{3})$/.exec(s);
    if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
    m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
    if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/.exec(s);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : Math.max(0, Math.min(1, m[5] ? +m[4] / 100 : +m[4])) };
    return null;
  }
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  /** an elliptical arc as cubic Bézier pieces (each at most 90°): [[x1, y1, x2, y2, x, y] …] after the start point */
  function ellipseCurves(cx, cy, rx, ry, rot, a0, a1, ccw) {
    let sweep = a1 - a0;
    const TAU = Math.PI * 2;
    if (!ccw && sweep < 0) sweep = (sweep % TAU) + TAU; else if (ccw && sweep > 0) sweep = (sweep % TAU) - TAU;
    if (!ccw && a1 - a0 >= TAU) sweep = TAU; else if (ccw && a0 - a1 >= TAU) sweep = -TAU;
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9)), d = sweep / n, k = (4 / 3) * Math.tan(d / 4);
    const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    const P = (x, y) => [cx + x * cr - y * sr, cy + x * sr + y * cr];
    const out = [];
    let a = a0;
    for (let i = 0; i < n; i++) {
      const b = a + d, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const p1 = P(rx * (ca - k * sa), ry * (sa + k * ca)), p2 = P(rx * (cb + k * sb), ry * (sb - k * cb)), p3 = P(rx * cb, ry * sb);
      out.push([p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]]);
      a = b;
    }
    return { start: P(rx * Math.cos(a0), ry * Math.sin(a0)), curves: out };
  }
  /** a pretend 2D canvas context: drawing a shape onto it keeps the PATHS (in picture px, transforms applied) -
   *  R.items [{t: "fill", segs, color, rule} | {t: "stroke", segs, color, width, join, cap, dash}]; R.bad = what it
   *  could not keep (a gradient, a picture, a clip, text …) - then the layer goes as a picture */
  function recorder(w, h) {
    const R = { items: [], bad: null };
    let st = { m: [1, 0, 0, 1, 0, 0], fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 1, lineJoin: "miter", lineCap: "butt", dash: [], dashOff: 0, alpha: 1, comp: "source-over", shadow: 0, filter: "none" };
    const stack = [];
    let segs = [], cur = null, startPt = null;
    const tp = (x, y) => [st.m[0] * x + st.m[2] * y + st.m[4], st.m[1] * x + st.m[3] * y + st.m[5]];
    const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    const scaleOf = () => Math.sqrt(Math.abs(st.m[0] * st.m[3] - st.m[1] * st.m[2])) || 1;
    const fin = (...v) => v.every((x) => Number.isFinite(+x));
    const moveTo = (x, y) => { if (!fin(x, y)) return; const p = tp(x, y); segs.push(["M", p[0], p[1]]); cur = [x, y]; startPt = [x, y]; };
    const lineTo = (x, y) => { if (!fin(x, y)) return; if (!cur) return moveTo(x, y); const p = tp(x, y); segs.push(["L", p[0], p[1]]); cur = [x, y]; };
    const bez = (a, b, c, d, e, f) => { if (!fin(a, b, c, d, e, f)) return; if (!cur) moveTo(a, b); const p = tp(a, b), q = tp(c, d), r = tp(e, f); segs.push(["C", p[0], p[1], q[0], q[1], r[0], r[1]]); cur = [e, f]; };
    const ell = (cx, cy, rx, ry, rot, a0, a1, ccw) => {
      if (!fin(cx, cy, rx, ry, a0, a1)) return;
      const e = ellipseCurves(cx, cy, rx, ry, rot || 0, a0, a1, !!ccw);
      if (!cur) moveTo(e.start[0], e.start[1]); else if (Math.abs(cur[0] - e.start[0]) > 1e-6 || Math.abs(cur[1] - e.start[1]) > 1e-6) lineTo(e.start[0], e.start[1]);
      for (const c of e.curves) bez(...c);
    };
    const snapSegs = () => segs.map((s) => s.slice());
    const ctx = {
      canvas: { width: w || 1, height: h || 1 },
      save() { stack.push(Object.assign({}, st, { m: st.m.slice(), dash: st.dash.slice() })); },
      restore() { if (stack.length) st = stack.pop(); },
      beginPath() { segs = []; cur = null; startPt = null; },
      moveTo, lineTo,
      bezierCurveTo: bez,
      quadraticCurveTo(cx, cy, x, y) { if (!cur) moveTo(cx, cy); const [x0, y0] = cur; bez(x0 + (2 / 3) * (cx - x0), y0 + (2 / 3) * (cy - y0), x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y), x, y); },
      closePath() { if (segs.length) { segs.push(["Z"]); if (startPt) cur = startPt.slice(); } },
      rect(x, y, rw, rh) { moveTo(x, y); lineTo(x + rw, y); lineTo(x + rw, y + rh); lineTo(x, y + rh); ctx.closePath(); },
      roundRect(x, y, rw, rh, rr) {
        let r = Array.isArray(rr) ? rr.map((v) => +v || 0) : [+rr || 0];
        if (r.length === 1) r = [r[0], r[0], r[0], r[0]]; else if (r.length === 2) r = [r[0], r[1], r[0], r[1]]; else if (r.length === 3) r = [r[0], r[1], r[2], r[1]];
        const m = Math.min(Math.abs(rw), Math.abs(rh)) / 2; r = r.map((v) => Math.max(0, Math.min(v, m)));
        const [tl, tr, br, bl] = r;
        moveTo(x + tl, y); lineTo(x + rw - tr, y); if (tr) ell(x + rw - tr, y + tr, tr, tr, 0, -Math.PI / 2, 0);
        lineTo(x + rw, y + rh - br); if (br) ell(x + rw - br, y + rh - br, br, br, 0, 0, Math.PI / 2);
        lineTo(x + bl, y + rh); if (bl) ell(x + bl, y + rh - bl, bl, bl, 0, Math.PI / 2, Math.PI);
        lineTo(x, y + tl); if (tl) ell(x + tl, y + tl, tl, tl, 0, Math.PI, Math.PI * 1.5);
        ctx.closePath();
      },
      ellipse: ell,
      arc(cx, cy, r, a0, a1, ccw) { ell(cx, cy, r, r, 0, a0, a1, ccw); },
      fill(a, b) {
        const rule = (typeof a === "string" ? a : b) === "evenodd" ? "evenodd" : "nonzero";
        if (a && typeof a === "object") { R.bad = R.bad || "Path2D"; return; }
        const c = parseColor(st.fillStyle); if (!c) { R.bad = R.bad || "a gradient or pattern fill"; return; }
        if (st.comp !== "source-over" || st.shadow > 0 || st.filter !== "none") { R.bad = R.bad || "an effect"; return; }
        if (segs.length) R.items.push({ t: "fill", segs: snapSegs(), color: hex(c), alpha: c.a * st.alpha, rule });
      },
      stroke(a) {
        if (a && typeof a === "object") { R.bad = R.bad || "Path2D"; return; }
        const c = parseColor(st.strokeStyle); if (!c) { R.bad = R.bad || "a gradient or pattern outline"; return; }
        if (st.comp !== "source-over" || st.shadow > 0 || st.filter !== "none") { R.bad = R.bad || "an effect"; return; }
        const k = scaleOf();
        if (segs.length && st.lineWidth > 0) R.items.push({ t: "stroke", segs: snapSegs(), color: hex(c), alpha: c.a * st.alpha, width: st.lineWidth * k, join: st.lineJoin, cap: st.lineCap, dash: st.dash.map((v) => v * k), dashOff: st.dashOff * k });
      },
      fillRect(x, y, rw, rh) { const keep = segs, kc = cur; segs = []; ctx.rect(x, y, rw, rh); ctx.fill(); segs = keep; cur = kc; },
      strokeRect(x, y, rw, rh) { const keep = segs, kc = cur; segs = []; ctx.rect(x, y, rw, rh); ctx.stroke(); segs = keep; cur = kc; },
      setLineDash(a) { st.dash = Array.isArray(a) ? a.map(Number).filter((v) => Number.isFinite(v) && v >= 0) : []; },
      getLineDash() { return st.dash.slice(); },
      translate(x, y) { st.m = mul(st.m, [1, 0, 0, 1, x, y]); },
      scale(x, y) { st.m = mul(st.m, [x, 0, 0, y == null ? x : y, 0, 0]); },
      rotate(a) { const c = Math.cos(a), s = Math.sin(a); st.m = mul(st.m, [c, s, -s, c, 0, 0]); },
      transform(a, b, c, d, e, f) { st.m = mul(st.m, [a, b, c, d, e, f]); },
      setTransform(a, b, c, d, e, f) { if (a && typeof a === "object") st.m = [a.a, a.b, a.c, a.d, a.e, a.f]; else if (a == null) st.m = [1, 0, 0, 1, 0, 0]; else st.m = [a, b, c, d, e, f]; },
      resetTransform() { st.m = [1, 0, 0, 1, 0, 0]; },
      getTransform() { const [a, b, c, d, e, f] = st.m; return { a, b, c, d, e, f, is2D: true }; },
      measureText() { return { width: 0 }; },
    };
    const PROPS = { fillStyle: "fillStyle", strokeStyle: "strokeStyle", lineWidth: "lineWidth", lineJoin: "lineJoin", lineCap: "lineCap", lineDashOffset: "dashOff", globalAlpha: "alpha", globalCompositeOperation: "comp", shadowBlur: "shadow", filter: "filter" };
    const IGNORE = new Set(["miterLimit", "font", "textAlign", "textBaseline", "imageSmoothingEnabled", "imageSmoothingQuality", "shadowColor", "shadowOffsetX", "shadowOffsetY", "letterSpacing", "direction"]);
    const proxy = new Proxy(ctx, {
      get(t, k) {
        if (k in PROPS) return st[PROPS[k]];
        if (k in t) return t[k];
        if (typeof k !== "string" || IGNORE.has(k)) return undefined;
        return function () { R.bad = R.bad || k; return k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern" ? { addColorStop() {}, setTransform() {} } : undefined; };
      },
      set(t, k, v) {
        if (k in PROPS) { st[PROPS[k]] = k === "lineWidth" || k === "globalAlpha" || k === "shadowBlur" || k === "lineDashOffset" ? +v : v; return true; }
        if (IGNORE.has(k)) return true;
        t[k] = v; return true;
      },
    });
    R.ctx = proxy;
    return R;
  }
  /** which pictures a page's layers become, bottom to top: leaves [{id, name, kind: "vector"|"text"|"raster", needsBelow}]
   *  -> [{ids: [...], name, kind}]; everything up to the last needsBelow layer = one "Flattened" picture */
  function plan(leaves) {
    const L = leaves || [];
    let cut = -1;
    L.forEach((x, i) => { if (x.needsBelow) cut = i; });
    const out = [];
    if (cut >= 0) out.push({ ids: L.slice(0, cut + 1).map((x) => x.id), name: "Flattened (" + (cut + 1) + " layer" + (cut ? "s" : "") + ")", kind: "raster" });
    for (const x of L.slice(cut + 1)) out.push({ ids: [x.id], name: x.name, kind: x.kind });
    return out;
  }
  /** the box an RGBA picture covers (alpha > 0): {x, y, w, h} or null */
  function alphaBox(data, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) if (data[row + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  const JOIN = { miter: 0, round: 1, bevel: 2 }, CAP = { butt: 0, round: 1, square: 2 };
  /** a recorded item as PDF operators [[op, ...numbers]] - k = pt per px, H = the page height in px (y goes up in a PDF) */
  function toPdfOps(item, k, H) {
    const X = (x) => r3(x * k), Y = (y) => r3((H - y) * k), c = parseColor(item.color) || { r: 0, g: 0, b: 0 };
    const out = [], col = [r3(c.r / 255), r3(c.g / 255), r3(c.b / 255)];
    for (const s of item.segs) {
      if (s[0] === "M") out.push(["m", X(s[1]), Y(s[2])]);
      else if (s[0] === "L") out.push(["l", X(s[1]), Y(s[2])]);
      else if (s[0] === "C") out.push(["c", X(s[1]), Y(s[2]), X(s[3]), Y(s[4]), X(s[5]), Y(s[6])]);
      else if (s[0] === "Z") out.push(["h"]);
    }
    if (item.t === "fill") return [["rg", ...col]].concat(out, [[item.rule === "evenodd" ? "f*" : "f"]]);
    const pre = [["RG", ...col], ["w", r3(item.width * k)], ["J", CAP[item.cap] || 0], ["j", JOIN[item.join] || 0]];
    if (item.dash && item.dash.length) pre.push(["d", item.dash.map((v) => r3(v * k)), r3((item.dashOff || 0) * k)]);
    return pre.concat(out, [["S"]]);
  }
  const svgD = (segs) => segs.map((s) => s[0] + (s.length > 1 ? s.slice(1).map((v) => r3(v)).join(" ") : "")).join("");
  const xesc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]));
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function b64(u8) {
    let s = "", i = 0;
    for (; i + 2 < u8.length; i += 3) { const n = (u8[i] << 16) | (u8[i + 1] << 8) | u8[i + 2]; s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]; }
    if (i < u8.length) { const n = (u8[i] << 16) | ((u8[i + 1] || 0) << 8); s += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < u8.length ? B64[(n >> 6) & 63] : "=") + "="; }
    return s;
  }
  const mm = (px, k) => r3((px * k * 25.4) / 72);
  /** one page as an SVG document: page {w, h, k, name, layers: [{name, items}]}; items: {t: "vec", items: recorded} |
   *  {t: "img", png (Uint8Array), x, y, w, h, alpha} | {t: "text", lines: [{s, x, y (baseline)}], size, color, family,
   *  weight, italic, tracking, align, alpha} - all in picture px, the size in mm */
  function buildSvg(page) {
    const p = page, out = [`<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${mm(p.w, p.k)}mm" height="${mm(p.h, p.k)}mm" viewBox="0 0 ${p.w} ${p.h}">`,
      `<title>${xesc(p.name || "Page")}</title>`];
    p.layers.forEach((L, li) => {
      out.push(`<g id="layer${li + 1}" inkscape:groupmode="layer" inkscape:label="${xesc(L.name)}">`);
      for (const it of L.items) {
        if (it.t === "vec") {
          for (const v of it.items) {
            const op = v.alpha < 1 ? (v.t === "fill" ? ` fill-opacity="${r3(v.alpha)}"` : ` stroke-opacity="${r3(v.alpha)}"`) : "";
            if (v.t === "fill") out.push(`<path d="${svgD(v.segs)}" fill="${v.color}"${v.rule === "evenodd" ? ' fill-rule="evenodd"' : ""}${op} stroke="none"/>`);
            else out.push(`<path d="${svgD(v.segs)}" fill="none" stroke="${v.color}" stroke-width="${r3(v.width)}" stroke-linejoin="${v.join || "miter"}" stroke-linecap="${v.cap || "butt"}"${v.dash && v.dash.length ? ` stroke-dasharray="${v.dash.map(r3).join(" ")}"` : ""}${op}/>`);
          }
        } else if (it.t === "img") {
          out.push(`<image x="${r3(it.x)}" y="${r3(it.y)}" width="${r3(it.w)}" height="${r3(it.h)}"${it.alpha != null && it.alpha < 1 ? ` opacity="${r3(it.alpha)}"` : ""} preserveAspectRatio="none" xlink:href="data:image/png;base64,${b64(it.png)}"/>`);
        } else if (it.t === "text") {
          const anchor = it.align === "center" ? "middle" : it.align === "right" ? "end" : "start";
          const fam = String(it.family || "sans-serif").replace(/"/g, "'");
          const attrs = `font-family="${xesc(fam)}" font-size="${r3(it.size)}" font-weight="${it.weight || 400}"${it.italic ? ' font-style="italic"' : ""} fill="${it.color || "#000000"}"${it.alpha != null && it.alpha < 1 ? ` fill-opacity="${r3(it.alpha)}"` : ""}${it.tracking ? ` letter-spacing="${r3((it.tracking / 1000) * it.size)}"` : ""} text-anchor="${anchor}" xml:space="preserve"`;
          for (const ln of it.lines) out.push(`<text x="${r3(ln.x)}" y="${r3(ln.y)}" ${attrs}>${xesc(ln.s)}</text>`);
        }
      }
      out.push(`</g>`);
    });
    out.push(`</svg>`);
    return out.join("\n");
  }
  /** the PDF of every page: pages as above; PL = pdf-lib; o: {title, fontkit, fontFor(it) -> bytes | null (embed),
   *  stdOf(it) -> "Helvetica" … (a StandardFonts key)}; each layer an optional-content group (a PDF layer) */
  async function buildPdf(PL, pages, o) {
    o = o || {};
    const pdf = await PL.PDFDocument.create();
    if (o.fontkit) pdf.registerFontkit(o.fontkit);
    if (o.title) pdf.setTitle(o.title);
    pdf.setCreator("bitGen Studio"); pdf.setProducer("bitGen Studio");
    const N = (n) => PL.PDFName.of(n), op = (name, args) => PL.PDFOperator.of(name, (args || []).map((v) => (typeof v === "number" ? PL.PDFNumber.of(v) : v)));
    const std = {}, own = {}, notes = { pages: 0, layers: 0, vector: 0, text: 0, embedded: 0, pictures: 0 };
    const stdFont = async (name) => (std[name] = std[name] || await pdf.embedFont(PL.StandardFonts[name] || PL.StandardFonts.Helvetica));
    const order = [], all = [];
    for (let pi = 0; pi < pages.length; pi++) {
      const p = pages[pi], k = p.k, H = p.h;
      const page = pdf.addPage([r3(p.w * k), r3(p.h * k)]);
      const res = page.node.Resources ? page.node.Resources() : page.node.lookup(N("Resources"));
      let props = res.lookup(N("Properties"));
      if (!props) { props = pdf.context.obj({}); res.set(N("Properties"), props); }
      const gsKey = {};
      const gs = (a) => { const key = r3(a); if (!gsKey[key]) gsKey[key] = page.node.newExtGState("GS", pdf.context.obj({ Type: "ExtGState", ca: key, CA: key })); return gsKey[key]; };
      const group = [PL.PDFHexString.fromText(p.name || ("Page " + (pi + 1)))];
      for (let li = 0; li < p.layers.length; li++) {
        const L = p.layers[li];
        const ref = pdf.context.register(pdf.context.obj({ Type: "OCG", Name: PL.PDFHexString.fromText((p.name || "Page " + (pi + 1)) + " / " + L.name) }));
        all.push(ref); group.push(ref);
        const tag = "OC" + all.length; props.set(N(tag), ref);
        page.pushOperators(op("BDC", [N("OC"), N(tag)]));
        for (const it of L.items) {
          if (it.t === "vec") {
            for (const v of it.items) {
              page.pushOperators(op("q"));
              if (v.alpha < 1) page.pushOperators(op("gs", [gs(v.alpha)]));
              for (const o2 of toPdfOps(v, k, H)) {
                if (o2[0] === "d") page.pushOperators(PL.setDashPattern(o2[1], o2[2]));
                else page.pushOperators(op(o2[0], o2.slice(1)));
              }
              page.pushOperators(op("Q"));
            }
            notes.vector++;
          } else if (it.t === "img") {
            const im = await pdf.embedPng(it.png);
            page.drawImage(im, Object.assign({ x: r3(it.x * k), y: r3((H - it.y - it.h) * k), width: r3(it.w * k), height: r3(it.h * k) }, it.alpha != null && it.alpha < 1 ? { opacity: it.alpha } : {}));
            notes.pictures++;
          } else if (it.t === "text") {
            let font = null;
            if (o.fontFor && o.fontkit) {
              const key = (it.family || "") + "|" + (it.weight || 400) + "|" + !!it.italic;
              if (!(key in own)) { own[key] = null; try { const b = await o.fontFor(it); if (b) own[key] = await pdf.embedFont(b, { subset: true }); } catch (e) { own[key] = null; } }
              font = own[key];
              if (font && font.embedder && font.embedder.font && typeof font.embedder.font.hasGlyphForCodePoint === "function"
                && !it.lines.every((ln) => [...ln.s].every((ch) => /\s/.test(ch) || font.embedder.font.hasGlyphForCodePoint(ch.codePointAt(0))))) font = null;
              if (font) notes.embedded++;
            }
            if (!font) font = await stdFont(o.stdOf ? o.stdOf(it) : "Helvetica");
            const c = parseColor(it.color) || { r: 0, g: 0, b: 0 }, size = r3(it.size * k), tr = r3(((it.tracking || 0) / 1000) * size);
            for (const ln of it.lines) {
              if (!ln.s) continue;
              let x = ln.x * k; const wd = (() => { try { return font.widthOfTextAtSize(ln.s, size); } catch (e) { return size * 0.55 * [...ln.s].length; } })() + tr * Math.max(0, [...ln.s].length - 1);
              if (it.align === "center") x -= wd / 2; else if (it.align === "right") x -= wd;
              let str = ln.s;
              try { font.encodeText(str); } catch (e) { str = [...str].map((ch) => { try { font.encodeText(ch); return ch; } catch (e2) { notes.lost = (notes.lost || 0) + 1; return "?"; } }).join(""); }
              if (tr) page.pushOperators(PL.setCharacterSpacing(tr));
              page.drawText(str, Object.assign({ x: r3(x), y: r3((H - ln.y) * k), size, font, color: PL.rgb(c.r / 255, c.g / 255, c.b / 255) }, it.alpha != null && it.alpha < 1 ? { opacity: it.alpha } : {}));
              if (tr) page.pushOperators(PL.setCharacterSpacing(0));
            }
            notes.text++;
          }
        }
        page.pushOperators(op("EMC"));
        notes.layers++;
      }
      order.push(pdf.context.obj(group));
      notes.pages++;
    }
    pdf.catalog.set(N("OCProperties"), pdf.context.obj({ OCGs: all, D: { Name: PL.PDFHexString.fromText("bitGen layers"), Order: order, ON: all, BaseState: N("ON") } }));
    return { bytes: await pdf.save(), notes };
  }
  const FORMATS = [["pdf", "PDF (.pdf)"], ["ai", ".ai (PDF-compatible)"], ["svg", "SVG pages (.zip, one .svg a page)"], ["cdr", "For .cdr (.zip: the PDF + the SVG pages)"]];
  /** the file a format makes */
  const extOf = (fmt) => (fmt === "ai" ? ".ai" : fmt === "svg" || fmt === "cdr" ? ".zip" : ".pdf");
  const safeStem = (n) => String(n || "document").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 80) || "document";

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, win, say, ctx, newCanvas, store } = E;
    const $ = (id) => doc.getElementById(id) || E.$(id);   // the dialogs live on the page body, outside the editor
    if (!E.ui || !E.ui.addCmd) return;
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    const libs = {};
    const loadScript = (src, test) => {
      if (test()) return Promise.resolve(test());
      if (libs[src]) return libs[src];
      libs[src] = new Promise((ok, no) => { const s = doc.createElement("script"); s.src = src; s.onload = () => (test() ? ok(test()) : no(new Error(src + " did not load"))); s.onerror = () => { libs[src] = null; no(new Error(src + " is missing")); }; doc.head.appendChild(s); });
      return libs[src];
    };
    const pdflib = () => loadScript("/static/vendor/pdf-lib.min.js", () => win.PDFLib);
    const fontkitLib = () => loadScript("/static/vendor/fontkit.umd.min.js", () => win.fontkit);
    const zipLib = () => loadScript("/static/bgzip.js", () => win.BgZip);
    const PP = () => root.PCPdf || {};
    const pngOf = (c) => new Promise((ok, no) => c.toBlob((b) => (b ? b.arrayBuffer().then((ab) => ok(new Uint8Array(ab))) : no(new Error("no picture"))), "image/png"));
    /** how far below a type layer's top its baseline is (pcdoc draws text with textBaseline "top") */
    function baseOff(t) {
      const g = ctx(newCanvas(4, 4)); g.font = D.fontCss(t);
      g.textBaseline = "top"; const a = g.measureText("Hg"); g.textBaseline = "alphabetic"; const b = g.measureText("Hg");
      const off = (b.fontBoundingBoxAscent != null && a.fontBoundingBoxAscent != null) ? b.fontBoundingBoxAscent - a.fontBoundingBoxAscent : NaN;
      return Number.isFinite(off) && off > 0 ? off : t.size * 0.8;
    }
    const plainLayer = (L) => (L.opacity == null || L.opacity > 0) && (L.blend || "normal") === "normal" && !L.mask && !L.vmask && !L.fmask && !D.hasStyles(L) && !L.clip;
    const isText = (L) => L.type === "text" && L.text && plainLayer(L) && !L.text.fx && !L.text.rot && !L.text.xm && !L.text.mesh
      && !(root.PCText && root.PCText.wants(L.text)) && !(root.PCType && root.PCType.owns && root.PCType.owns(L.text)) && !(root.PCRuns && root.PCRuns.owns && root.PCRuns.owns(L.text));
    const simplePath = (p) => ((p && p.subs) || []).every((s, i) => s.op === "add" || (i === 0 && s.op !== "subtract" && s.op !== "intersect"));
    /** a shape layer as paths, or null (then a picture) */
    function vectorOf(L, w, h) {
      if (L.type !== "shape" || !L.shape || !plainLayer(L)) return null;
      const s = L.shape;
      if (s.tfill && s.tfill.on) return null;
      const R = recorder(w, h);
      try {
        if (s.kind === "path") {
          if (s.line || !root.PCPath || !simplePath(s.path)) return null;
          const g = R.ctx; root.PCPath.traceAll(g, s.path);
          if (s.fillOn !== false) { g.fillStyle = s.fill || "#000"; g.fill("nonzero"); }
          const sw = s.strokeOn ? s.strokeW || 0 : 0;
          if (sw > 0) { g.lineWidth = sw; g.strokeStyle = s.stroke || "#000"; g.lineJoin = "round"; g.lineCap = "round"; if (s.dash) g.setLineDash([sw * 3, sw * 2]); g.stroke(); }
        } else D.drawShape(R.ctx, s);
      } catch (e) { return null; }
      if (R.bad || !R.items.length) return null;
      const a = L.opacity == null ? 1 : L.opacity;
      if (a < 1) R.items.forEach((v) => { v.alpha *= a; });
      return R.items;
    }
    function textOf(L) {
      const t = L.text, lh = t.size * (t.leading || 1.2), off = baseOff(t);
      const c = parseColor(t.color || "#000000") || { r: 0, g: 0, b: 0, a: 1 };
      return { t: "text", lines: String(t.str || "").split("\n").map((s, i) => ({ s, x: t.x, y: t.y + i * lh + off })), size: t.size, color: hex(c), alpha: c.a * (L.opacity == null ? 1 : L.opacity),
        family: String(t.font || "sans-serif").split(",")[0].replace(/["']/g, "").trim(), weight: t.weight || 400, italic: !!t.italic, tracking: t.tracking || 0, align: t.align || "left", css: t.font };
    }
    /** the open page (S) as an export page: its layers as paths / text / pictures */
    async function pageOut(name, k) {
      const W = S.w, H = S.h, layers = S.layers;
      const leaves = layers.filter((L) => L.type !== "group" && L.visible !== false && D.shown(layers, L));
      const info = leaves.map((L) => {
        let kind = "raster";
        if (L.type === "text" && isText(L) && (o.anyText || !PP().winAnsi || PP().winAnsi(L.text.str))) kind = "text";
        else if (vectorOf(L, W, H)) kind = "vector";
        const path = []; let p = L.parent; for (let g = 0; p != null && g < 50; g++) { const G = layers.find((x) => x.id === p); if (!G) break; path.unshift(G.name); p = G.parent; }
        return { id: L.id, name: path.concat([L.name || "Layer"]).join(" / "), kind, needsBelow: L.type === "adjust" || (L.blend || "normal") !== "normal" || !!L.clip };
      });
      const out = { w: W, h: H, k, name, layers: [] };
      for (const g of plan(info)) {
        const items = [];
        if (g.kind === "vector") items.push({ t: "vec", items: vectorOf(layers.find((x) => x.id === g.ids[0]), W, H) });
        else if (g.kind === "text") items.push(textOf(layers.find((x) => x.id === g.ids[0])));
        else {
          const keep = new Set(g.ids), was = leaves.map((L) => [L, L.visible]);
          leaves.forEach((L) => { if (!keep.has(L.id)) L.visible = false; });
          let pic = null;
          try { pic = D.render({ w: W, h: H, layers }, E.docEnv({ srcFor: (x) => x.canvas, maskSrc: null, skipControl: true })); } finally { was.forEach(([L, v]) => { L.visible = v; }); }
          if (!pic) continue;
          const data = ctx(pic).getImageData(0, 0, W, H).data, b = alphaBox(data, W, H);
          if (!b) continue;
          const cut = newCanvas(b.w, b.h); ctx(cut).drawImage(pic, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
          items.push({ t: "img", png: await pngOf(cut), x: b.x, y: b.y, w: b.w, h: b.h });
        }
        out.layers.push({ name: g.name, items });
      }
      return out;
    }
    let o = {};
    /** every page of the document as export pages (pcpages.js swaps each page in; a document without pages = one page) */
    async function pagesOut(opts) {
      o = opts || {};
      const P = E.pages;
      if (P && P.count() > 1) return P.eachPage(async (pg, i) => pageOut(pg.name || "Page " + (i + 1), 72 / (pg.dpi || 150)));
      const pg = P && P.current ? P.current() : null;
      return [await pageOut((pg && pg.name) || "Page 1", 72 / ((pg && pg.dpi) || 150))];
    }
    const stdOf = (it) => { const f = PP().fontOf ? PP().fontOf((it.css || it.family || "") + (it.weight >= 600 ? " bold" : "") + (it.italic ? " italic" : ""), "") : null; return f && PP().stdName ? PP().stdName(f) : "Helvetica"; };
    async function fontFor(it) {
      const r = await win.fetch(`/api/fonts/file?family=${encodeURIComponent(it.family)}&bold=${it.weight >= 600 ? 1 : 0}&italic=${it.italic ? 1 : 0}`);
      return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    }
    /** build the file(s): fmt pdf | ai | svg | cdr -> {bytes, ext, notes} */
    async function build(fmt, opts) {
      const op2 = opts || {};
      const pages = await pagesOut({ anyText: !!op2.embed });
      const title = safeStem(S.bgiName || S.name);
      let pdf = null, notes = { pages: pages.length };
      if (fmt !== "svg") {
        const PL = await pdflib(); let fk = null;
        if (op2.embed) { try { fk = await fontkitLib(); } catch (e) { fk = null; } }
        const r = await buildPdf(PL, pages, { title, fontkit: fk, fontFor: fk ? fontFor : null, stdOf });
        pdf = r.bytes; notes = r.notes;
      }
      if (fmt === "pdf" || fmt === "ai") return { bytes: pdf, ext: extOf(fmt), notes };
      const Z = await zipLib(), files = [];
      pages.forEach((p, i) => files.push({ name: `${title} - page ${String(i + 1).padStart(2, "0")}.svg`, data: buildSvg(p), deflate: true }));
      if (fmt === "cdr") files.unshift({ name: title + ".pdf", data: pdf, deflate: false });
      files.push({ name: "README.txt", data: fmt === "cdr" ? "Open the PDF in your vector app (File > Open) to get every page with its layers, or import the SVG pages one at a time. Then save it as .cdr there.\n" : "One SVG a page; each layer is a group (inkscape:groupmode=layer).\n", deflate: true });
      return { bytes: await Z.zipAsync(files), ext: ".zip", notes: Object.assign(notes, { svg: pages.length }) };
    }
    async function exportDoc(fmt, opts) {
      if (!S.w) { say("open or make a document first"); return null; }
      const op2 = opts || {};
      try {
        say("exporting the document…");
        const r = await build(fmt, op2);
        const stem = safeStem(op2.name || S.bgiName || S.name) + (fmt === "cdr" ? " (for cdr)" : fmt === "svg" ? " (SVG)" : "");
        let saved = null;
        if (op2.save !== false) {
          const res = await win.fetch("/api/dtp/save?name=" + encodeURIComponent(stem + r.ext), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: r.bytes });
          const j = await res.json(); if (!res.ok) throw new Error(j.error || "the save was refused"); saved = j;
        }
        if (op2.download !== false) {
          const a = doc.createElement("a"); a.href = win.URL.createObjectURL(new win.Blob([r.bytes], { type: r.ext === ".zip" ? "application/zip" : r.ext === ".ai" ? "application/postscript" : "application/pdf" }));
          a.download = saved ? saved.name : stem + r.ext; doc.body.appendChild(a); a.click(); setTimeout(() => { win.URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        }
        const n = r.notes;
        say(`exported ${saved ? saved.name : stem + r.ext}: ${n.pages} page(s)` + (n.layers != null ? `, ${n.layers} layer(s) - ${n.vector} as paths, ${n.text} as real text${n.embedded ? ` (${n.embedded} in their own font)` : ""}, ${n.pictures} as pictures` : "")
          + (saved ? " · in the project's dtp folder" : "") + (op2.download !== false ? " · downloaded" : ""));
        return Object.assign({ ext: r.ext, size: r.bytes.length }, saved || {}, n);
      } catch (e) { say("Export failed: " + e.message); return null; }
    }
    function dialog() {
      if (!S.w) return say("open or make a document first");
      const old = $("pcDtpDlg"); if (old) old.remove();
      const d = doc.createElement("div"); d.id = "pcDtpDlg"; d.className = "pcdlg";
      d.style.cssText = "position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:9000;background:var(--pc-panel,#222);color:var(--pc-text,#eee);border:1px solid var(--pc-line,#444);border-radius:6px;padding:12px 14px;min-width:340px;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.5)";
      const fmt0 = store.get("dtp.fmt", "pdf"), n = E.pages ? E.pages.count() : 1;
      d.innerHTML = `<div style="font-weight:600;margin-bottom:8px">Export document (${n} page${n === 1 ? "" : "s"})</div>
        <div class="kxrow"><span style="width:60px">Format</span><select id="dtpFmt">${FORMATS.map(([v, l]) => `<option value="${v}"${v === fmt0 ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        <div class="kxrow"><span style="width:60px">Name</span><input id="dtpName" value="${esc(safeStem(S.bgiName || S.name))}" style="flex:1"></div>
        <label class="kxrow" title="Each type layer in its own font from this computer (only the letters used) - else Helvetica / Times / Courier"><input type="checkbox" id="dtpEmbed"${store.get("dtp.embed", true) ? " checked" : ""}> Embed fonts</label>
        <div style="color:var(--pc-dim,#999);margin:6px 0;line-height:1.4">Shapes go as paths, plain type as real text, everything else as pictures; each layer is a PDF / SVG layer. A .cdr file has no open way to be written - open the PDF (or the SVG pages) in your vector app and save as .cdr there.</div>
        <div class="kxrow" style="justify-content:flex-end;gap:6px"><button class="ghost" id="dtpCancel">Cancel</button><button id="dtpGo">⤓ Export</button></div>`;
      doc.body.appendChild(d);
      $("dtpCancel").onclick = () => d.remove();
      $("dtpGo").onclick = async () => {
        const f = $("dtpFmt").value, embed = $("dtpEmbed").checked, name = $("dtpName").value;
        store.set("dtp.fmt", f); store.set("dtp.embed", embed); d.remove();
        await exportDoc(f, { embed, name });
      };
    }
    const C = E.ui.addCmd;
    C("file.exportdtp", "Document (PDF / AI / SVG)…", "", dialog, { enabled: () => !!S.w });
    const F = E.ui.MENUS.find(([x]) => x === "File");
    if (F) { const items = F[1], at = items.indexOf("file.export"); items.splice(at >= 0 ? at + 1 : items.length, 0, "file.exportdtp"); }
    E.dtpOut = { build, exportDoc, dialog, pagesOut, vectorOf, isText };
  }

  const pure = { recorder, ellipseCurves, parseColor, plan, alphaBox, toPdfOps, buildPdf, buildSvg, b64, extOf, safeStem, FORMATS };
  const api = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCDtpOut = api;
})(typeof window !== "undefined" ? window : globalThis);
