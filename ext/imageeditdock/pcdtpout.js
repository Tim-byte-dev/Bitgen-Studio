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
 *   2.800.0  a page's master (pcpages.js) = its own layers as "Master / <layer>" (paths and real text, its {page} filled
 *            in); As spreads (facing pages) = each spread one PDF / SVG page (joinSpread: the right page moved over).
 *
 *   2.802.0  PRINT-READY (Tim: "please go with next" - desktop publishing part 4): Bleed (mm - the page's content that
 *            touches the edge carried past it: paths moved out, pictures' edge pixels stretched), crop marks,
 *            registration marks, page information (a slug), MediaBox / BleedBox / TrimBox set, the marks on their own
 *            PDF layer; CMYK: vector and text colours as DeviceCMYK, pictures as CMYK images (pcmode.js's press model -
 *            coated / uncoated / newsprint; greys as black ink only), fonts embedded. Not a certified PDF/X file (no
 *            output-intent profile).
 *
 * Pure (Node: scripts/test-dtpout799.js, test-masters800.js, test-print802.js): cmykSimple, bleedSegs, marksOps,
 * printBoxes, joinSpread, recorder, ellipseCurves, parseColor, plan, alphaBox, toPdfOps, buildPdf (given
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
  function toPdfOps(item, k, H, cmykOf) {
    const X = (x) => r3(x * k), Y = (y) => r3((H - y) * k), c = parseColor(item.color) || { r: 0, g: 0, b: 0 };
    const out = [], col = cmykOf ? cmykOf(c.r, c.g, c.b).slice(0, 4).map(r3) : [r3(c.r / 255), r3(c.g / 255), r3(c.b / 255)];
    const F = cmykOf ? "k" : "rg", Sk = cmykOf ? "K" : "RG";
    for (const s of item.segs) {
      if (s[0] === "M") out.push(["m", X(s[1]), Y(s[2])]);
      else if (s[0] === "L") out.push(["l", X(s[1]), Y(s[2])]);
      else if (s[0] === "C") out.push(["c", X(s[1]), Y(s[2]), X(s[3]), Y(s[4]), X(s[5]), Y(s[6])]);
      else if (s[0] === "Z") out.push(["h"]);
    }
    if (item.t === "fill") return [[F, ...col]].concat(out, [[item.rule === "evenodd" ? "f*" : "f"]]);
    const pre = [[Sk, ...col], ["w", r3(item.width * k)], ["J", CAP[item.cap] || 0], ["j", JOIN[item.join] || 0]];
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
  /* ---- 2.802.0: print-ready ---- */
  /** a plain RGB -> CMYK (0..1) without a press model (tests; greys = black ink only) */
  function cmykSimple(r, g, b) {
    if (r === g && g === b) return [0, 0, 0, 1 - r / 255];
    const R = r / 255, G = g / 255, B = b / 255, K = 1 - Math.max(R, G, B);
    if (K >= 1) return [0, 0, 0, 1];
    return [(1 - R - K) / (1 - K), (1 - G - K) / (1 - K), (1 - B - K) / (1 - K), K];
  }
  /** a path that touches the page's edge carried past it by the bleed b (px): points within half a pixel of an edge go out */
  function bleedSegs(segs, W, H, b) {
    if (!(b > 0)) return segs;
    const fx = (x) => (x <= 0.5 ? x - b : x >= W - 0.5 ? x + b : x), fy = (y) => (y <= 0.5 ? y - b : y >= H - 0.5 ? y + b : y);
    return segs.map((sg) => sg.map((v, j) => (j === 0 ? v : j % 2 === 1 ? fx(v) : fy(v))));
  }
  const MARK = { gap: 3, len: 12, room: 24, reg: 4 };
  /** the page boxes in pt: trim w x h, bleed b, marks (crop / registration / slug) -> {W, H (the media), M (trim's offset), trim, bleed} */
  function printBoxes(w, h, b, marks) {
    const M = (b || 0) + (marks ? MARK.room : 0);
    return { W: w + 2 * M, H: h + 2 * M, M, trim: [M, M, w, h], bleed: [M - (b || 0), M - (b || 0), w + 2 * (b || 0), h + 2 * (b || 0)] };
  }
  /** printer's marks as line / circle ops in pt (y up): crop marks at the trim's corners outside the bleed, registration
   *  targets at the middle of each side; -> [["line", x0, y0, x1, y1] | ["circle", cx, cy, r]] */
  function marksOps(w, h, b, o) {
    const bx = printBoxes(w, h, b, true), M = bx.M, x0 = M, y0 = M, x1 = M + w, y1 = M + h, d = (b || 0) + MARK.gap, L = MARK.len, out = [];
    if (o.crop) {
      for (const [x, y, sx, sy] of [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]]) {
        out.push(["line", x + sx * d, y, x + sx * (d + L), y]);       // horizontal, level with the trim edge
        out.push(["line", x, y + sy * d, x, y + sy * (d + L)]);       // vertical
      }
    }
    if (o.reg) {
      const c = d + L / 2, R = MARK.reg;
      for (const [cx, cy] of [[(x0 + x1) / 2, y0 - c], [(x0 + x1) / 2, y1 + c], [x0 - c, (y0 + y1) / 2], [x1 + c, (y0 + y1) / 2]]) {
        out.push(["circle", cx, cy, R]); out.push(["line", cx - R * 1.6, cy, cx + R * 1.6, cy]); out.push(["line", cx, cy - R * 1.6, cx, cy + R * 1.6]);
      }
    }
    return out.map((m) => m.map((v, i) => (i ? r3(v) : v)));
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
    const pr = o.print || null, cmykOf = pr && pr.cmyk ? pr.cmyk : null, marked = !!(pr && (pr.crop || pr.reg || pr.slug));
    if (pr) Object.assign(notes, { print: true, cmyk: !!cmykOf, bleed: pr.bleed || 0, standard: 0 });
    const colour = (c) => (cmykOf ? PL.cmyk(...cmykOf(c.r, c.g, c.b).slice(0, 4)) : PL.rgb(c.r / 255, c.g / 255, c.b / 255));
    for (let pi = 0; pi < pages.length; pi++) {
      const p = pages[pi], k = p.k, H = p.h;
      const bPt = pr ? Math.max(0, +pr.bleed || 0) : 0, bx = printBoxes(r3(p.w * k), r3(p.h * k), bPt, marked);
      const page = pdf.addPage([r3(bx.W), r3(bx.H)]);
      if (pr) { page.setMediaBox(0, 0, r3(bx.W), r3(bx.H)); page.setBleedBox(...bx.bleed.map(r3)); page.setTrimBox(...bx.trim.map(r3)); page.setCropBox(0, 0, r3(bx.W), r3(bx.H)); }
      const bPx = bPt / k;
      const res = page.node.Resources ? page.node.Resources() : page.node.lookup(N("Resources"));
      let props = res.lookup(N("Properties"));
      if (!props) { props = pdf.context.obj({}); res.set(N("Properties"), props); }
      const gsKey = {};
      const gs = (a) => { const key = r3(a); if (!gsKey[key]) gsKey[key] = page.node.newExtGState("GS", pdf.context.obj({ Type: "ExtGState", ca: key, CA: key })); return gsKey[key]; };
      const group = [PL.PDFHexString.fromText(p.name || ("Page " + (pi + 1)))];
      if (bx.M) page.pushOperators(op("q"), op("cm", [1, 0, 0, 1, r3(bx.M), r3(bx.M)]));   // the trim's corner = (M, M)
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
              for (const o2 of toPdfOps(bPx ? Object.assign({}, v, { segs: bleedSegs(v.segs, p.w, p.h, bPx) }) : v, k, H, cmykOf)) {
                if (o2[0] === "d") page.pushOperators(PL.setDashPattern(o2[1], o2[2]));
                else page.pushOperators(op(o2[0], o2.slice(1)));
              }
              page.pushOperators(op("Q"));
            }
            notes.vector++;
          } else if (it.t === "img") {
            if (cmykOf && it.rgba && it.iw && it.ih) {    // 2.802.0: a CMYK picture (+ its transparency as a soft mask)
              const n = it.iw * it.ih, cm = new Uint8Array(n * 4), al = new Uint8Array(n); let soft = false;
              for (let i = 0; i < n; i++) {
                const c4 = cmykOf(it.rgba[i * 4], it.rgba[i * 4 + 1], it.rgba[i * 4 + 2]);
                cm[i * 4] = Math.round(c4[0] * 255); cm[i * 4 + 1] = Math.round(c4[1] * 255); cm[i * 4 + 2] = Math.round(c4[2] * 255); cm[i * 4 + 3] = Math.round(c4[3] * 255);
                al[i] = it.rgba[i * 4 + 3]; if (al[i] < 255) soft = true;
              }
              const sm = soft ? pdf.context.register(pdf.context.flateStream(al, { Type: "XObject", Subtype: "Image", Width: it.iw, Height: it.ih, ColorSpace: "DeviceGray", BitsPerComponent: 8 })) : null;
              const ref = pdf.context.register(pdf.context.flateStream(cm, Object.assign({ Type: "XObject", Subtype: "Image", Width: it.iw, Height: it.ih, ColorSpace: "DeviceCMYK", BitsPerComponent: 8 }, sm ? { SMask: sm } : {})));
              const nm = page.node.newXObject("ImC", ref);
              page.pushOperators(op("q"));
              if (it.alpha != null && it.alpha < 1) page.pushOperators(op("gs", [gs(it.alpha)]));
              page.pushOperators(op("cm", [r3(it.w * k), 0, 0, r3(it.h * k), r3(it.x * k), r3((H - it.y - it.h) * k)]), op("Do", [nm]), op("Q"));
              notes.cmykPictures = (notes.cmykPictures || 0) + 1;
            } else {
              const im = await pdf.embedPng(it.png);
              page.drawImage(im, Object.assign({ x: r3(it.x * k), y: r3((H - it.y - it.h) * k), width: r3(it.w * k), height: r3(it.h * k) }, it.alpha != null && it.alpha < 1 ? { opacity: it.alpha } : {}));
            }
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
            if (!font) { font = await stdFont(o.stdOf ? o.stdOf(it) : "Helvetica"); if (pr) notes.standard++; }
            const c = parseColor(it.color) || { r: 0, g: 0, b: 0 }, size = r3(it.size * k), tr = r3(((it.tracking || 0) / 1000) * size);
            for (const ln of it.lines) {
              if (!ln.s) continue;
              let x = ln.x * k; const wd = (() => { try { return font.widthOfTextAtSize(ln.s, size); } catch (e) { return size * 0.55 * [...ln.s].length; } })() + tr * Math.max(0, [...ln.s].length - 1);
              if (it.align === "center") x -= wd / 2; else if (it.align === "right") x -= wd;
              let str = ln.s;
              try { font.encodeText(str); } catch (e) { str = [...str].map((ch) => { try { font.encodeText(ch); return ch; } catch (e2) { notes.lost = (notes.lost || 0) + 1; return "?"; } }).join(""); }
              if (tr) page.pushOperators(PL.setCharacterSpacing(tr));
              page.drawText(str, Object.assign({ x: r3(x), y: r3((H - ln.y) * k), size, font, color: colour(c) }, it.alpha != null && it.alpha < 1 ? { opacity: it.alpha } : {}));
              if (tr) page.pushOperators(PL.setCharacterSpacing(0));
            }
            notes.text++;
          }
        }
        page.pushOperators(op("EMC"));
        notes.layers++;
      }
      if (bx.M) page.pushOperators(op("Q"));
      // 2.802.0: printer's marks + page information on their own PDF layer, in registration colour (every ink) / black
      if (marked) {
        const ref = pdf.context.register(pdf.context.obj({ Type: "OCG", Name: PL.PDFHexString.fromText((p.name || "Page " + (pi + 1)) + " / Printer's marks") }));
        all.push(ref); group.push(ref);
        const tag = "OC" + all.length; props.set(N(tag), ref);
        page.pushOperators(op("BDC", [N("OC"), N(tag)]), op("q"), cmykOf ? op("K", [1, 1, 1, 1]) : op("RG", [0, 0, 0]), op("w", [0.25]));
        const W0 = r3(p.w * k), H0 = r3(p.h * k);
        for (const m of marksOps(W0, H0, bPt, { crop: !!pr.crop, reg: !!pr.reg })) {
          if (m[0] === "line") page.pushOperators(op("m", [m[1], m[2]]), op("l", [m[3], m[4]]), op("S"));
          else { const [, cx, cy, R] = m, kk = 0.5523 * R; page.pushOperators(op("m", [r3(cx + R), cy]), op("c", [r3(cx + R), r3(cy + kk), r3(cx + kk), r3(cy + R), cx, r3(cy + R)]), op("c", [r3(cx - kk), r3(cy + R), r3(cx - R), r3(cy + kk), r3(cx - R), cy]), op("c", [r3(cx - R), r3(cy - kk), r3(cx - kk), r3(cy - R), cx, r3(cy - R)]), op("c", [r3(cx + kk), r3(cy - R), r3(cx + R), r3(cy - kk), r3(cx + R), cy]), op("S")); }
        }
        page.pushOperators(op("Q"));
        if (pr.slug) {
          const f = await stdFont("Helvetica"), txt = [pr.doc || "", p.name || "Page " + (pi + 1), pr.date || "", cmykOf ? "CMYK" : "RGB", bPt ? "bleed " + Math.round(bPt * 25.4 / 72 * 10) / 10 + " mm" : ""].filter(Boolean).join("  ·  ");
          let t2 = txt; try { f.encodeText(t2); } catch (e) { t2 = [...t2].map((ch) => { try { f.encodeText(ch); return ch; } catch (e2) { return "?"; } }).join(""); }
          page.drawText(t2, { x: r3(bx.M), y: 4, size: 6, font: f, color: cmykOf ? PL.cmyk(0, 0, 0, 1) : PL.rgb(0, 0, 0) });
        }
        page.pushOperators(op("EMC"));
      }
      order.push(pdf.context.obj(group));
      notes.pages++;
    }
    pdf.catalog.set(N("OCProperties"), pdf.context.obj({ OCGs: all, D: { Name: PL.PDFHexString.fromText("bitGen layers"), Order: order, ON: all, BaseState: N("ON") } }));
    return { bytes: await pdf.save(), notes };
  }
  /** pages side by side as one page (a spread): the second one's items moved right by the first one's width; layer
   *  names get the page's name in front */
  function joinSpread(outs) {
    if (!outs || outs.length < 2) return outs && outs[0];
    const H = Math.max(...outs.map((o) => o.h)), out = { w: 0, h: H, k: outs[0].k, name: outs.map((o) => o.name).join(" + "), layers: [] };
    for (const o of outs) {
      const dx = out.w, dy = 0;
      const mv = (it) => {
        if (it.t === "vec") return { t: "vec", items: it.items.map((v) => Object.assign({}, v, { segs: v.segs.map((sg) => sg.map((n, j) => (j === 0 ? n : (j % 2 === 1 ? n + dx : n + dy)))) })) };
        if (it.t === "img") return Object.assign({}, it, { x: it.x + dx, y: it.y + dy });
        if (it.t === "text") return Object.assign({}, it, { lines: it.lines.map((l) => Object.assign({}, l, { x: l.x + dx, y: l.y + dy })) });
        return it;
      };
      for (const L of o.layers) out.layers.push({ name: o.name + " / " + L.name, items: L.items.map(mv) });
      out.w += o.w;
    }
    return out;
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
    /** 2.801.0: paragraph text (a box, linked frames, text wrap, justify, indents, spacing) the export can write as lines -
     *  not the character tricks (scales, baseline shift, small caps, super / sub, faux styles, OpenType features, lines) */
    const n0 = (v) => (isFinite(+v) ? +v : 0);
    const plainPara = (t) => !!(root.PCType && root.PCType.owns && root.PCType.owns(t)) && (!t.hscale || +t.hscale === 100) && (!t.vscale || +t.vscale === 100) && !n0(t.baseline)
      && !t.smallcaps && !t.pos && !t.fauxBold && !t.fauxItalic && !t.underline && !t.strike && !(root.PCOType && root.PCOType.engineOn && root.PCOType.engineOn(t));
    const isText = (L) => L.type === "text" && L.text && plainLayer(L) && !L.text.fx && !L.text.rot && !L.text.xm && !L.text.mesh
      && !(root.PCText && root.PCText.wants(L.text)) && (!(root.PCType && root.PCType.owns && root.PCType.owns(L.text)) || plainPara(L.text)) && !(root.PCRuns && root.PCRuns.owns && root.PCRuns.owns(L.text));
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
    const scratchG = ctx(newCanvas(8, 8));
    /** paragraph text laid out as it is drawn (pctype.js): its shown lines, a justified line word by word */
    function paraLines(t, off) {
      const PT = root.PCType, m = PT.canvasMeasure(t, scratchG), Lo = PT.layout(t, m), out = [];
      for (const ln of Lo.lines) {
        if (ln.over || !ln.text) continue;
        if (ln.gap > 0) { let x = ln.x; for (const part of ln.text.split(/( +)/).filter((q) => q.length)) { if (/^ +$/.test(part)) { x += m(part) + ln.gap * part.length; continue; } out.push({ s: part, x, y: ln.y + off }); x += m(part); } }
        else out.push({ s: ln.text, x: ln.x, y: ln.y + off });
      }
      return out;
    }
    function textOf(L) {
      const t = L.text, lh = t.size * (t.leading || 1.2), off = baseOff(t);
      const c = parseColor(t.color || "#000000") || { r: 0, g: 0, b: 0, a: 1 };
      const para = plainPara(t);
      return { t: "text", lines: para ? paraLines(t, off) : String(t.str || "").split("\n").map((s, i) => ({ s, x: t.x, y: t.y + i * lh + off })), size: t.size, color: hex(c), alpha: c.a * (L.opacity == null ? 1 : L.opacity),
        family: String(t.font || "sans-serif").split(",")[0].replace(/["']/g, "").trim(), weight: t.weight || 400, italic: !!t.italic, tracking: t.tracking || 0, align: para ? "left" : t.align || "left", css: t.font };
    }
    /** the open page (S) as an export page: its layers as paths / text / pictures */
    async function pageOut(name, k, pageIdx) {
      const W = S.w, H = S.h, layers = S.layers;
      const leaves = layers.filter((L) => L.type !== "group" && L.visible !== false && D.shown(layers, L));
      const info = leaves.map((L) => {
        let kind = "raster";
        if (L.master != null && E.pages && E.pages.masterOut) kind = "master";   // 2.800.0: its master's own layers
        else if (L.type === "text" && isText(L) && (o.anyText || !PP().winAnsi || PP().winAnsi(L.text.str))) kind = "text";
        else if (vectorOf(L, W, H)) kind = "vector";
        const path = []; let p = L.parent; for (let g = 0; p != null && g < 50; g++) { const G = layers.find((x) => x.id === p); if (!G) break; path.unshift(G.name); p = G.parent; }
        return { id: L.id, name: path.concat([L.name || "Layer"]).join(" / "), kind, needsBelow: L.type === "adjust" || (L.blend || "normal") !== "normal" || !!L.clip };
      });
      const out = { w: W, h: H, k, name, layers: [] };
      for (const g of plan(info)) {
        const items = [];
        if (g.kind === "master") {
          const ML = layers.find((x) => x.id === g.ids[0]);
          const mo = await E.pages.masterOut(ML.master, pageIdx == null ? 0 : pageIdx, () => pageOut("Master", k, -1));
          if (mo) for (const ml of mo.layers) out.layers.push({ name: "Master / " + ml.name, items: ml.items });
          continue;
        }
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
          // 2.802.0: bleed - a picture that touches the page's edge gets its edge pixels stretched past it
          const bp = o.bleedMm ? Math.ceil((o.bleedMm / 25.4) * (72 / k)) : 0;
          const ex = { l: bp && b.x <= 0 ? bp : 0, t: bp && b.y <= 0 ? bp : 0, r: bp && b.x + b.w >= W ? bp : 0, d: bp && b.y + b.h >= H ? bp : 0 };
          const cw = b.w + ex.l + ex.r, chh = b.h + ex.t + ex.d, cut = newCanvas(cw, chh), cg = ctx(cut);
          cg.drawImage(pic, b.x, b.y, b.w, b.h, ex.l, ex.t, b.w, b.h);
          if (ex.l) cg.drawImage(pic, b.x, b.y, 1, b.h, 0, ex.t, ex.l, b.h);
          if (ex.r) cg.drawImage(pic, b.x + b.w - 1, b.y, 1, b.h, ex.l + b.w, ex.t, ex.r, b.h);
          if (ex.t) cg.drawImage(cut, 0, ex.t, cw, 1, 0, 0, cw, ex.t);
          if (ex.d) cg.drawImage(cut, 0, ex.t + b.h - 1, cw, 1, 0, ex.t + b.h, cw, ex.d);
          const img = { t: "img", png: await pngOf(cut), x: b.x - ex.l, y: b.y - ex.t, w: cw, h: chh };
          if (o.cmyk) Object.assign(img, { rgba: cg.getImageData(0, 0, cw, chh).data, iw: cw, ih: chh });   // for a CMYK picture
          items.push(img);
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
      if (P && P.settle) P.settle();
      let pages;
      if (P && P.list().length) pages = await P.eachPage(async (pg, i) => pageOut(pg.name || "Page " + (i + 1), 72 / (pg.dpi || 150), i));
      else pages = [await pageOut("Page 1", 72 / 150, 0)];
      if (o.spreads && P && P.facing()) pages = P.spreads().map((g) => (g.length > 1 ? joinSpread(g.map((i) => pages[i])) : pages[g[0]]));
      return pages;
    }
    const stdOf = (it) => { const f = PP().fontOf ? PP().fontOf((it.css || it.family || "") + (it.weight >= 600 ? " bold" : "") + (it.italic ? " italic" : ""), "") : null; return f && PP().stdName ? PP().stdName(f) : "Helvetica"; };
    async function fontFor(it) {
      const r = await win.fetch(`/api/fonts/file?family=${encodeURIComponent(it.family)}&bold=${it.weight >= 600 ? 1 : 0}&italic=${it.italic ? 1 : 0}`);
      return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    }
    /** build the file(s): fmt pdf | ai | svg | cdr -> {bytes, ext, notes} */
    async function build(fmt, opts) {
      const op2 = opts || {};
      const pr = fmt !== "svg" && op2.print ? op2.print : null;
      const embed = !!op2.embed || !!pr;                     // print-ready: the fonts go inside
      const pages = await pagesOut({ anyText: embed, spreads: !!op2.spreads, bleedMm: pr ? Math.max(0, +pr.bleedMm || 0) : 0, cmyk: !!(pr && pr.cmyk) });
      const title = safeStem(S.bgiName || S.name);
      let pdf = null, notes = { pages: pages.length };
      if (fmt !== "svg") {
        const PL = await pdflib(); let fk = null;
        if (embed) { try { fk = await fontkitLib(); } catch (e) { fk = null; } }
        let print = null;
        if (pr) {
          let cmyk = null;
          if (pr.cmyk) {
            const MO = root.PCMode;
            if (MO && MO.buildLut) { const lut = MO.buildLut({ press: pr.press || "coated", gcr: "medium" }, 17), out = [0, 0, 0, 0]; cmyk = (r, g, b) => (r === g && g === b ? [0, 0, 0, 1 - r / 255] : MO.lutAt(lut, lut.cmyk, 4, r, g, b, out)); }
            else cmyk = cmykSimple;
          }
          print = { bleed: Math.max(0, +pr.bleedMm || 0) * 72 / 25.4, crop: !!pr.crop, reg: !!pr.reg, slug: !!pr.slug, cmyk, doc: title, date: new Date().toISOString().slice(0, 10) };
        }
        const r = await buildPdf(PL, pages, { title, fontkit: fk, fontFor: fk ? fontFor : null, stdOf, print });
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
          + (n.print ? ` · print-ready${n.cmyk ? " CMYK" : ""}${n.bleed ? `, ${Math.round(n.bleed * 25.4 / 72 * 10) / 10} mm bleed` : ""}${n.standard ? ` - ${n.standard} type layer(s) in a standard font (not embedded: their font is not on this computer)` : ""}` : "")
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
      const pv = Object.assign({ on: false, bleedMm: 3, crop: true, reg: true, slug: true, cmyk: true, press: "coated" }, store.get("dtp.print", {}) || {});
      d.innerHTML = `<div style="font-weight:600;margin-bottom:8px">Export document (${n} page${n === 1 ? "" : "s"})</div>
        <div class="kxrow"><span style="width:60px">Format</span><select id="dtpFmt">${FORMATS.map(([v, l]) => `<option value="${v}"${v === fmt0 ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        <div class="kxrow"><span style="width:60px">Name</span><input id="dtpName" value="${esc(safeStem(S.bgiName || S.name))}" style="flex:1"></div>
        ${E.pages && E.pages.facing() ? `<label class="kxrow" title="Facing pages: each spread (2 + 3, 4 + 5 …) as one page"><input type="checkbox" id="dtpSpreads"${store.get("dtp.spreads", true) ? " checked" : ""}> As spreads</label>` : ""}
        <div id="dtpPrintBox" style="border:1px solid var(--pc-line,#444);border-radius:4px;padding:6px;margin:6px 0">
          <label class="kxrow" title="For a print shop: bleed, marks, page boxes, CMYK, fonts embedded"><input type="checkbox" id="dtpPrint"${pv.on ? " checked" : ""}> <b>Print-ready</b></label>
          <div id="dtpPrintOpts"${pv.on ? "" : ' style="display:none"'}>
            <div class="kxrow"><span style="width:60px">Bleed</span><input type="number" id="dtpBleed" value="${pv.bleedMm}" min="0" max="20" step="0.5" style="width:60px"> mm</div>
            <div class="kxrow" style="flex-wrap:wrap;gap:8px"><label><input type="checkbox" id="dtpCrop"${pv.crop ? " checked" : ""}> Crop marks</label><label><input type="checkbox" id="dtpReg"${pv.reg ? " checked" : ""}> Registration marks</label><label><input type="checkbox" id="dtpSlug"${pv.slug ? " checked" : ""}> Page information</label></div>
            <div class="kxrow"><span style="width:60px">Colour</span><select id="dtpColour"><option value="rgb"${pv.cmyk ? "" : " selected"}>RGB</option><option value="cmyk"${pv.cmyk ? " selected" : ""}>CMYK</option></select><select id="dtpPress" title="The press the CMYK numbers are made for"${pv.cmyk ? "" : ' style="display:none"'}>${[["coated", "Coated paper"], ["uncoated", "Uncoated paper"], ["newsprint", "Newsprint"]].map(([v, l]) => `<option value="${v}"${v === pv.press ? " selected" : ""}>${l}</option>`).join("")}</select></div>
            <div style="color:var(--pc-dim,#999);line-height:1.4">Content touching the page edge is carried into the bleed; fonts are embedded. A simple press model, not a colour profile - ask your printer for a proof.</div>
          </div>
        </div>
        <label class="kxrow" title="Each type layer in its own font from this computer (only the letters used) - else Helvetica / Times / Courier"><input type="checkbox" id="dtpEmbed"${store.get("dtp.embed", true) ? " checked" : ""}> Embed fonts</label>
        <div style="color:var(--pc-dim,#999);margin:6px 0;line-height:1.4">Shapes go as paths, plain type as real text, everything else as pictures; each layer is a PDF / SVG layer. A .cdr file has no open way to be written - open the PDF (or the SVG pages) in your vector app and save as .cdr there.</div>
        <div class="kxrow" style="justify-content:flex-end;gap:6px"><button class="ghost" id="dtpCancel">Cancel</button><button id="dtpGo">⤓ Export</button></div>`;
      doc.body.appendChild(d);
      $("dtpCancel").onclick = () => d.remove();
      const showPrint = () => { const svg = $("dtpFmt").value === "svg"; $("dtpPrintBox").style.display = svg ? "none" : ""; $("dtpPrintOpts").style.display = $("dtpPrint").checked ? "" : "none"; $("dtpPress").style.display = $("dtpColour").value === "cmyk" ? "" : "none"; };
      $("dtpFmt").onchange = showPrint; $("dtpPrint").onchange = showPrint; $("dtpColour").onchange = showPrint; showPrint();
      $("dtpGo").onclick = async () => {
        const f = $("dtpFmt").value, embed = $("dtpEmbed").checked, name = $("dtpName").value, spreads = !!($("dtpSpreads") && $("dtpSpreads").checked);
        const pr = { on: $("dtpPrint").checked, bleedMm: Math.max(0, Math.min(20, +$("dtpBleed").value || 0)), crop: $("dtpCrop").checked, reg: $("dtpReg").checked, slug: $("dtpSlug").checked, cmyk: $("dtpColour").value === "cmyk", press: $("dtpPress").value };
        store.set("dtp.fmt", f); store.set("dtp.embed", embed); store.set("dtp.print", pr); if ($("dtpSpreads")) store.set("dtp.spreads", spreads); d.remove();
        await exportDoc(f, { embed, name, spreads, print: pr.on && f !== "svg" ? pr : null });
      };
    }
    const C = E.ui.addCmd;
    C("file.exportdtp", "Document (PDF / AI / SVG)…", "", dialog, { enabled: () => !!S.w });
    const F = E.ui.MENUS.find(([x]) => x === "File");
    if (F) { const items = F[1], at = items.indexOf("file.export"); items.splice(at >= 0 ? at + 1 : items.length, 0, "file.exportdtp"); }
    E.dtpOut = { build, exportDoc, dialog, pagesOut, vectorOf, isText };
  }

  const pure = { cmykSimple, bleedSegs, marksOps, printBoxes, MARK, joinSpread, recorder, ellipseCurves, parseColor, plan, alphaBox, toPdfOps, buildPdf, buildSvg, b64, extOf, safeStem, FORMATS };
  const api = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCDtpOut = api;
})(typeof window !== "undefined" ? window : globalThis);
