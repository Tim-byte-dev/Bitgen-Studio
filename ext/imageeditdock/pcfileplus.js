/* pcfileplus.js — MORE FILE TYPES, FILE INFO, PRINT, CONTACT SHEET, CROP AND STRAIGHTEN PHOTOS (2.485.0): the image
 * editor's gap, round F (part 1). window.PCFilePlus.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   Export As     + BMP (with transparency), TIFF (with transparency), GIF (256 colours, dithered or not, a clear
 *                 colour), TGA, AVIF (made by ffmpeg on this computer - routes/imgconvert.js)
 *   File ▸ File Info… (Alt+Shift+Ctrl+I)   title, author, description, keywords, copyright, URL - kept with the
 *                 document (.bgi) and written into exported PNG (text chunks) and JPEG (XMP) files
 *   File ▸ Print… (Ctrl+P)   scale to fit / a size in cm or inches at a resolution, centred, portrait / landscape,
 *                 the system's print dialog
 *   File ▸ Automate ▸ Contact Sheet…   pictures (files, or the open documents) in a grid on a new document: columns
 *                 x rows, page size, margins, captions with the file names - one layer per picture
 *   File ▸ Automate ▸ Crop and Straighten Photos   several photos scanned on one page: each found, turned straight
 *                 and opened as a document of its own
 * Pure (Node: scripts/test-fileplus.js): encodeBMP, encodeTIFF, encodeTGA, encodeGIF (quantize + LZW), crc32,
 * pngWithText, jpegWithXmp, sheetLayout, findPhotos (components + minimum-area rectangles), hull, minRect.
 */
(function (root) {
  "use strict";

  /* ---------------- encoders ---------------- */
  function encodeBMP(id) {
    const w = id.width, h = id.height, d = id.data, head = 14 + 108, size = head + w * h * 4, b = new Uint8Array(size), v = new DataView(b.buffer);
    b[0] = 0x42; b[1] = 0x4d; v.setUint32(2, size, true); v.setUint32(10, head, true);
    v.setUint32(14, 108, true); v.setInt32(18, w, true); v.setInt32(22, -h, true); v.setUint16(26, 1, true); v.setUint16(28, 32, true); v.setUint32(30, 3, true);   // BI_BITFIELDS, top-down
    v.setUint32(34, w * h * 4, true); v.setInt32(38, 2835, true); v.setInt32(42, 2835, true);
    v.setUint32(54, 0x00ff0000, true); v.setUint32(58, 0x0000ff00, true); v.setUint32(62, 0x000000ff, true); v.setUint32(66, 0xff000000, true); v.setUint32(70, 0x73524742, true);   // masks, "sRGB"
    for (let i = 0, o = head; i < w * h; i++, o += 4) { b[o] = d[i * 4 + 2]; b[o + 1] = d[i * 4 + 1]; b[o + 2] = d[i * 4]; b[o + 3] = d[i * 4 + 3]; }
    return b;
  }
  function encodeTIFF(id) {
    const w = id.width, h = id.height, d = id.data, n = 12, ifd = 8, ifdLen = 2 + n * 12 + 4, bpsAt = ifd + ifdLen, dataAt = bpsAt + 8, size = dataAt + w * h * 4;
    const b = new Uint8Array(size), v = new DataView(b.buffer);
    b[0] = 0x49; b[1] = 0x49; v.setUint16(2, 42, true); v.setUint32(4, ifd, true); v.setUint16(ifd, n, true);
    const tags = [[256, 4, 1, w], [257, 4, 1, h], [258, 3, 4, bpsAt], [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, dataAt], [277, 3, 1, 4], [278, 4, 1, h], [279, 4, 1, w * h * 4], [284, 3, 1, 1], [296, 3, 1, 1], [338, 3, 1, 2]];
    tags.forEach(([tag, type, count, val], k) => { const o = ifd + 2 + k * 12; v.setUint16(o, tag, true); v.setUint16(o + 2, type, true); v.setUint32(o + 4, count, true); if (type === 3 && count === 1) v.setUint16(o + 8, val, true); else v.setUint32(o + 8, val, true); });
    v.setUint32(ifd + 2 + n * 12, 0, true);
    for (let k = 0; k < 4; k++) v.setUint16(bpsAt + k * 2, 8, true);
    b.set(d, dataAt);
    return b;
  }
  function encodeTGA(id) {
    const w = id.width, h = id.height, d = id.data, b = new Uint8Array(18 + w * h * 4);
    b[2] = 2; b[12] = w & 255; b[13] = w >> 8; b[14] = h & 255; b[15] = h >> 8; b[16] = 32; b[17] = 0x28;      // true colour, 32 bits, 8 alpha bits, top-left
    for (let i = 0, o = 18; i < w * h; i++, o += 4) { b[o] = d[i * 4 + 2]; b[o + 1] = d[i * 4 + 1]; b[o + 2] = d[i * 4]; b[o + 3] = d[i * 4 + 3]; }
    return b;
  }
  /** a palette of up to `max` colours: median cut over the visible pixels */
  function quantize(d, max) {
    const px = []; for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) px.push((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    const uniq = Array.from(new Set(px));
    if (uniq.length <= max) return uniq.map((c) => [c >> 16, (c >> 8) & 255, c & 255]);
    let boxes = [px];
    while (boxes.length < max) {
      let bi = -1, bestR = -1, ch = 0;
      boxes.forEach((bx, k) => { if (bx.length < 2) return; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (const p of bx) { const v = (p >> (16 - c * 8)) & 255; if (v < lo) lo = v; if (v > hi) hi = v; } if (hi - lo > bestR) { bestR = hi - lo; bi = k; ch = c; } } });
      if (bi < 0 || bestR <= 0) break;
      const bx = boxes[bi].sort((a, c2) => ((a >> (16 - ch * 8)) & 255) - ((c2 >> (16 - ch * 8)) & 255)), mid = bx.length >> 1;
      boxes.splice(bi, 1, bx.slice(0, mid), bx.slice(mid));
    }
    return boxes.filter((b) => b.length).map((bx) => { let r = 0, g = 0, bb = 0; for (const p of bx) { r += p >> 16; g += (p >> 8) & 255; bb += p & 255; } return [Math.round(r / bx.length), Math.round(g / bx.length), Math.round(bb / bx.length)]; });
  }
  function encodeGIF(id, opts) {
    const w = id.width, h = id.height, d = id.data, o = opts || {};
    const hasClear = Array.from({ length: w * h }, (_, i) => d[i * 4 + 3] < 128).some(Boolean);
    const pal = quantize(d, hasClear ? 255 : 256), clearIx = hasClear ? pal.length : -1;
    if (hasClear) pal.push([0, 0, 0]);
    let bits = 1; while ((1 << bits) < pal.length) bits++; const psize = 1 << bits;
    const nearest = new Map();
    const near = (r, g, b) => { const k = (r << 16) | (g << 8) | b; let v = nearest.get(k); if (v != null) return v; let best = 0, bd = Infinity; for (let i = 0; i < pal.length; i++) { if (i === clearIx) continue; const p = pal[i], dd = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (dd < bd) { bd = dd; best = i; } } nearest.set(k, best); return best; };
    const idx = new Uint8Array(w * h), err = o.dither ? new Float32Array(w * h * 3) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4;
      if (d[i + 3] < 128) { idx[p] = clearIx; continue; }
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (err) { r = Math.max(0, Math.min(255, r + err[p * 3])); g = Math.max(0, Math.min(255, g + err[p * 3 + 1])); b = Math.max(0, Math.min(255, b + err[p * 3 + 2])); }
      const k = near(Math.round(r), Math.round(g), Math.round(b)); idx[p] = k;
      if (err) { const q = pal[k], e = [r - q[0], g - q[1], b - q[2]]; const put = (xx, yy, f) => { if (xx < 0 || xx >= w || yy >= h) return; const j = (yy * w + xx) * 3; err[j] += e[0] * f; err[j + 1] += e[1] * f; err[j + 2] += e[2] * f; }; put(x + 1, y, 7 / 16); put(x - 1, y + 1, 3 / 16); put(x, y + 1, 5 / 16); put(x + 1, y + 1, 1 / 16); }
    }
    const out = [];
    const u16 = (v) => out.push(v & 255, v >> 8);
    for (const c of "GIF89a") out.push(c.charCodeAt(0));
    u16(w); u16(h); out.push(0x80 | 0x70 | (bits - 1), 0, 0);
    for (let i = 0; i < psize; i++) { const c = pal[i] || [0, 0, 0]; out.push(c[0], c[1], c[2]); }
    if (hasClear) out.push(0x21, 0xf9, 4, 1, 0, 0, clearIx, 0);
    out.push(0x2c); u16(0); u16(0); u16(w); u16(h); out.push(0);
    const minCode = Math.max(2, bits); out.push(minCode);
    // LZW
    const clear = 1 << minCode, eoi = clear + 1; let next = eoi + 1, size = minCode + 1, dict = new Map(), buf = 0, nb = 0; const bytes = [];
    const emit = (c) => { buf |= c << nb; nb += size; while (nb >= 8) { bytes.push(buf & 255); buf >>>= 8; nb -= 8; } };
    emit(clear);
    let cur = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], key = cur * 4096 + k;
      if (dict.has(key)) { cur = dict.get(key); continue; }
      emit(cur);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
      else { emit(clear); dict = new Map(); next = eoi + 1; size = minCode + 1; }
      cur = k;
    }
    emit(cur); emit(eoi); if (nb > 0) bytes.push(buf & 255);
    for (let i = 0; i < bytes.length; i += 255) { const n = Math.min(255, bytes.length - i); out.push(n); for (let k = 0; k < n; k++) out.push(bytes[i + k]); }
    out.push(0, 0x3b);
    return Uint8Array.from(out);
  }
  /* ---------------- metadata ---------------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const latin1 = (s) => Uint8Array.from(Array.from(String(s)).map((ch) => { const c = ch.charCodeAt(0); return c < 256 ? c : 63; }));
  const utf8 = (s) => (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(String(s)) : Uint8Array.from(Buffer.from(String(s), "utf8")));
  const INFO_KEYS = [["title", "Title"], ["author", "Author"], ["description", "Description"], ["keywords", "Keywords"], ["copyright", "Copyright"], ["url", "Source"]];
  /** a PNG with iTXt chunks (UTF-8) for the file info, before IEND */
  function pngWithText(png, info) {
    const u = png instanceof Uint8Array ? png : new Uint8Array(png);
    const chunks = [];
    for (const [k, key] of INFO_KEYS) {
      const v = info && info[k]; if (!v) continue;
      const body = [...latin1(key), 0, 0, 0, 0, 0, ...utf8(v)];                             // keyword, no compression, no language / translated keyword
      const type = latin1("iTXt"), data = Uint8Array.from(body), len = new Uint8Array(4), crcb = new Uint8Array(4);
      new DataView(len.buffer).setUint32(0, data.length); const all = new Uint8Array(4 + data.length); all.set(type); all.set(data, 4); new DataView(crcb.buffer).setUint32(0, crc32(all));
      chunks.push(len, type, data, crcb);
    }
    if (!chunks.length) return u;
    // the IEND chunk: the last 12 bytes
    const at = u.length - 12, total = chunks.reduce((a, c) => a + c.length, 0), out = new Uint8Array(u.length + total);
    out.set(u.subarray(0, at)); let o = at; for (const c of chunks) { out.set(c, o); o += c.length; } out.set(u.subarray(at), o);
    return out;
  }
  const xesc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function xmpOf(info) {
    const li = (s) => `<rdf:Alt><rdf:li xml:lang="x-default">${xesc(s)}</rdf:li></rdf:Alt>`;
    const kw = String(info.keywords || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">`
      + (info.title ? `<dc:title>${li(info.title)}</dc:title>` : "") + (info.author ? `<dc:creator><rdf:Seq><rdf:li>${xesc(info.author)}</rdf:li></rdf:Seq></dc:creator>` : "")
      + (info.description ? `<dc:description>${li(info.description)}</dc:description>` : "") + (kw.length ? `<dc:subject><rdf:Bag>${kw.map((k) => `<rdf:li>${xesc(k)}</rdf:li>`).join("")}</rdf:Bag></dc:subject>` : "")
      + (info.copyright ? `<dc:rights>${li(info.copyright)}</dc:rights>` : "") + (info.url ? `<xmpRights:WebStatement>${xesc(info.url)}</xmpRights:WebStatement>` : "")
      + `</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  }
  /** a JPEG with the file info as XMP (an APP1 segment right after SOI) */
  function jpegWithXmp(jpg, info) {
    const u = jpg instanceof Uint8Array ? jpg : new Uint8Array(jpg);
    if (!info || !INFO_KEYS.some(([k]) => info[k])) return u;
    const ns = latin1("http://ns.adobe.com/xap/1.0/\0"), x = utf8(xmpOf(info)), len = 2 + ns.length + x.length;
    if (len > 65535) return u;
    const seg = new Uint8Array(4 + ns.length + x.length); seg[0] = 0xff; seg[1] = 0xe1; seg[2] = len >> 8; seg[3] = len & 255; seg.set(ns, 4); seg.set(x, 4 + ns.length);
    const out = new Uint8Array(u.length + seg.length); out.set(u.subarray(0, 2)); out.set(seg, 2); out.set(u.subarray(2), 2 + seg.length);
    return out;
  }
  /* ---------------- contact sheet ---------------- */
  function sheetLayout(n, o) {
    const cols = Math.max(1, o.cols | 0), rows = Math.max(1, o.rows | 0), W = o.W, H = o.H, m = o.margin || 0, gap = o.gap == null ? m / 2 : o.gap, cap = o.caption ? (o.fontSize || 24) * 1.6 : 0;
    const cw = (W - 2 * m - (cols - 1) * gap) / cols, ch = (H - 2 * m - (rows - 1) * gap) / rows, per = cols * rows, pages = [];
    for (let i = 0; i < n; i++) {
      const pg = Math.floor(i / per), k = i % per, c = k % cols, r = Math.floor(k / cols);
      (pages[pg] = pages[pg] || []).push({ i, x: m + c * (cw + gap), y: m + r * (ch + gap), w: cw, h: ch - cap, capY: m + r * (ch + gap) + ch - cap * 0.35 });
    }
    return { pages, cellW: cw, cellH: ch };
  }
  /* ---------------- crop and straighten photos ---------------- */
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  /** the smallest rectangle round a hull: {cx, cy, w, h, angle (rad, the rectangle's turn)} */
  function minRect(hp) {
    let best = null;
    for (let i = 0; i < hp.length; i++) {
      const a = hp[i], b = hp[(i + 1) % hp.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), s = Math.sin(ang);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of hp) { const u = x * c + y * s, v = -x * s + y * c; if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; }
      const area = (x1 - x0) * (y1 - y0);
      if (!best || area < best.area) { const cu = (x0 + x1) / 2, cv = (y0 + y1) / 2; best = { area, cx: cu * c - cv * s, cy: cu * s + cv * c, w: x1 - x0, h: y1 - y0, angle: ang }; }
    }
    if (!best) return null;
    // the smaller turn: a wide rectangle turned by under 45°
    let { angle, w, h } = best; while (angle > Math.PI / 4) { angle -= Math.PI / 2; [w, h] = [h, w]; } while (angle < -Math.PI / 4) { angle += Math.PI / 2; [w, h] = [h, w]; }
    return { cx: best.cx, cy: best.cy, w, h, angle };
  }
  /** photos on a scan: what differs from the page colour, in parts bigger than minArea (px) */
  function findPhotos(d, w, h, o) {
    const opt = o || {}, thr = opt.threshold || 30, minArea = opt.minArea || Math.max(400, w * h * 0.01);
    // the page colour: the median of the border
    const border = []; for (let x = 0; x < w; x++) { border.push(x * 4, ((h - 1) * w + x) * 4); } for (let y = 0; y < h; y++) border.push(y * w * 4, (y * w + w - 1) * 4);
    const med = [0, 1, 2].map((c) => { const v = border.map((i) => d[i + c]).sort((a, b) => a - b); return v[v.length >> 1]; });
    const fg = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) { const i = p * 4; fg[p] = Math.abs(d[i] - med[0]) + Math.abs(d[i + 1] - med[1]) + Math.abs(d[i + 2] - med[2]) > thr ? 1 : 0; }
    const lab = new Int32Array(w * h), out = []; let n = 0;
    for (let p0 = 0; p0 < w * h; p0++) {
      if (!fg[p0] || lab[p0]) continue;
      n++; const q = [p0], pts = []; lab[p0] = n; let area = 0;
      while (q.length) {
        const p = q.pop(), x = p % w, y = (p - x) / w; area++;
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !fg[p - 1] || !fg[p + 1] || !fg[p - w] || !fg[p + w];
        if (edge) pts.push([x + 0.5, y + 0.5]);
        for (const np of [p - 1, p + 1, p - w, p + w]) { if (np < 0 || np >= w * h) continue; const nx = np % w; if (Math.abs(nx - x) > 1) continue; if (fg[np] && !lab[np]) { lab[np] = n; q.push(np); } }
      }
      if (area < minArea) continue;
      const r = minRect(hull(pts)); if (r && r.w > 8 && r.h > 8) out.push(Object.assign(r, { area }));
    }
    return out.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  }
  const pure = { encodeBMP, encodeTIFF, encodeTGA, encodeGIF, quantize, crc32, pngWithText, jpegWithXmp, xmpOf, sheetLayout, findPhotos, hull, minRect, INFO_KEYS };

  /* ---------------- the page ---------------- */
  function install(E) {
    const { S, store } = E, doc = E.doc || root.document, win = doc.defaultView || root, kx = E.kx;
    const say = (t) => (E.say ? E.say(t) : null), esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    // canvas.toBlob for the new types
    const TYPES = { "image/bmp": encodeBMP, "image/tiff": encodeTIFF, "image/x-tga": encodeTGA, "image/gif": (id) => encodeGIF(id, { dither: store.get("gif.dither", true) }) };
    const tb = win.HTMLCanvasElement.prototype.toBlob;
    if (!tb.__fileplus) {
      const f = function (cb, type, q) {
        const t = String(type || "").toLowerCase(), c = this;
        if (TYPES[t]) { try { const id = c.getContext("2d").getImageData(0, 0, c.width, c.height); win.setTimeout(() => cb(new win.Blob([TYPES[t](id)], { type: t })), 0); } catch (e) { win.setTimeout(() => cb(null), 0); } return; }
        if (t === "image/avif") {
          tb.call(c, async (png) => {
            try { const r = await win.fetch("/api/imgconvert/avif?q=" + Math.round((q == null ? 0.8 : q) * 100), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: png }); if (!r.ok) throw new Error((await r.json()).error); cb(new win.Blob([await r.arrayBuffer()], { type: "image/avif" })); }
            catch (e) { say("AVIF: " + e.message); cb(null); }
          }, "image/png");
          return;
        }
        return tb.apply(this, arguments);
      };
      f.__fileplus = true; f.__jxl = tb.__jxl; win.HTMLCanvasElement.prototype.toBlob = f;
    }
    if (E.exportFormats && !E.exportFormats.some((x) => x[0] === "bmp"))
      E.exportFormats.push(["avif", "AVIF", "image/avif", "avif", true], ["gif", "GIF (256 colours)", "image/gif", "gif", false], ["tiff", "TIFF", "image/tiff", "tif", false], ["bmp", "BMP", "image/bmp", "bmp", false], ["tga", "TGA", "image/x-tga", "tga", false]);
    // the file info: written into exported PNG / JPEG files
    const infoOn = () => S.fileInfo && INFO_KEYS.some(([k]) => S.fileInfo[k]);
    E.fileInfoBlob = async (blob, type) => {
      if (!blob || !infoOn()) return blob;
      const u = new Uint8Array(await blob.arrayBuffer());
      if (/png/.test(type || blob.type)) return new win.Blob([pngWithText(u, S.fileInfo)], { type: "image/png" });
      if (/jpe?g/.test(type || blob.type)) return new win.Blob([jpegWithXmp(u, S.fileInfo)], { type: "image/jpeg" });
      return blob;
    };
    function dialog(title, html, ok, init) {
      const d = doc.createElement("div"); d.className = "kxdlg"; d.innerHTML = `<h4>${esc(title)}</h4>${html}<div class="bt"><button class="ghost cn">Cancel</button><button class="ghost ok">OK</button></div>`;
      kx.appendChild(d); if (E.ui.dragDialog) E.ui.dragDialog(d);
      d.querySelector(".cn").onclick = () => d.remove();
      d.querySelector(".ok").onclick = async () => { if ((await ok(d)) !== false) d.remove(); };
      if (init) init(d);
      return d;
    }
    const val = (d, s) => (d.querySelector(s) || {}).value;
    function fileInfo() {
      const I = S.fileInfo || {};
      dialog("File Info", INFO_KEYS.map(([k, n]) => `<div class="rw"><label>${n}</label>${k === "description" ? `<textarea data-fi="${k}" rows="3" style="grid-column:2/4">${esc(I[k] || "")}</textarea>` : `<input type="text" data-fi="${k}" value="${esc(I[k] || "")}" style="grid-column:2/4">`}</div>`).join("")
        + '<div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">Kept with the document (.bgi) and written into exported PNG and JPEG files.</div>',
        (d) => { const o = {}; d.querySelectorAll("[data-fi]").forEach((el) => { const v = el.value.trim(); if (v) o[el.dataset.fi] = v.slice(0, 4000); }); S.fileInfo = o; say("file info kept"); });
    }
    function print() {
      if (!S.w) return say("open a picture first");
      dialog("Print", `<div class="rw"><label>Size</label><select id="prMode" style="grid-column:2/4"><option value="fit">Scale to fit the page</option><option value="size">This size…</option><option value="pct">Scale (%)</option></select></div>
        <div class="rw"><label>Width / height</label><input type="number" id="prW" step="0.1" value="${(S.w / 300 * 2.54).toFixed(1)}"><select id="prU"><option value="cm">cm</option><option value="in">in</option></select></div>
        <div class="rw"><label>Resolution (ppi)</label><input type="number" id="prDpi" value="300" min="10" max="4800"></div><div class="rw"><label>Scale (%)</label><input type="number" id="prPct" value="100" min="1" max="1000"></div>
        <div class="rw"><label>Orientation</label><select id="prO" style="grid-column:2/4"><option value="auto">As the picture</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
        <div style="color:var(--pc-dim);font-size:11px;margin:4px 10px">OK opens the system's print dialog (the printer, the paper, copies, or Save as PDF).</div>`,
        (d) => {
          const mode = val(d, "#prMode"), u = val(d, "#prU"), dpi = +val(d, "#prDpi") || 300, pct = +val(d, "#prPct") || 100, o = val(d, "#prO");
          const ori = o === "auto" ? (S.w > S.h ? "landscape" : "portrait") : o;
          let css;
          if (mode === "fit") css = "max-width:100%;max-height:100vh;object-fit:contain";
          else if (mode === "pct") css = `width:${(S.w / 96 * pct / 100).toFixed(3)}in`;
          else { const wv = +val(d, "#prW") || 10; css = `width:${wv}${u}`; }
          if (mode !== "fit" && !(+val(d, "#prW"))) css = `width:${(S.w / dpi).toFixed(3)}in`;
          const url = E.flatten().toDataURL("image/png");
          const fr = doc.createElement("iframe"); fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; doc.body.appendChild(fr);
          const fd = fr.contentDocument; fd.open(); fd.write(`<!doctype html><html><head><title>${esc(S.name || "bitGen")}</title><style>@page{size:${ori};margin:10mm}html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center}img{${css}}</style></head><body><img src="${url}"></body></html>`); fd.close();
          const im = fd.querySelector("img"), go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { say("printing failed: " + e.message); } win.setTimeout(() => fr.remove(), 60000); };
          E.lastPrint = { css, ori, mode };
          if (im.complete) win.setTimeout(go, 50); else im.onload = go;
        });
    }
    // pictures from files (or the open documents)
    const pickFiles = () => new Promise((ok) => {
      const inp = doc.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = "image/*,.jxl"; inp.style.display = "none"; doc.body.appendChild(inp);
      inp.onchange = () => { const f = Array.from(inp.files || []); inp.remove(); ok(f); };
      inp.click();
    });
    const imgOf = (f) => new Promise((ok) => { const u = win.URL.createObjectURL(f), im = new win.Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = u; });
    /** each open document, flattened (the one in front stays in front) */
    function openDocs() {
      const was = E.docs.live(), out = [];
      for (const it of E.docs.list()) { if (it.id !== E.docs.live()) E.docs.activate(it.id); if (!S.w) continue; const f = E.flatten(), c = doc.createElement("canvas"); c.width = f.width; c.height = f.height; c.getContext("2d").drawImage(f, 0, 0); out.push({ name: S.name || it.name, canvas: c }); }
      if (was != null && E.docs.live() !== was) E.docs.activate(was);
      return out;
    }
    async function contactSheet(files) {
      dialog("Contact Sheet", `<div class="rw"><label>Pictures</label><select id="csSrc" style="grid-column:2/4"><option value="files">Choose files…</option>${E.docs ? '<option value="docs">The open documents</option>' : ""}</select></div>
        <div class="rw"><label>Page</label><select id="csPage" style="grid-column:2/4"><option value="2480x3508">A4 portrait (300 ppi)</option><option value="3508x2480">A4 landscape (300 ppi)</option><option value="2550x3300">Letter portrait (300 ppi)</option><option value="1920x1080">1920 x 1080</option></select></div>
        <div class="rw"><label>Columns / rows</label><input type="number" id="csC" value="4" min="1" max="30"><input type="number" id="csR" value="5" min="1" max="30"></div>
        <div class="rw"><label>Margin (px)</label><input type="number" id="csM" value="60" min="0" max="1000"></div>
        <div class="rw"><label><input type="checkbox" id="csCap" checked> Captions (file names)</label><input type="number" id="csF" value="28" min="6" max="200" title="Font size (px)"></div>`,
        async (d) => {
          let list = files || null;
          if (!list) {
            if (val(d, "#csSrc") === "docs" && E.docs) list = openDocs();
            else list = await pickFiles();
          }
          if (!list || !list.length) return say("no pictures");
          const [W, H] = val(d, "#csPage").split("x").map(Number), lay = sheetLayout(list.length, { cols: +val(d, "#csC"), rows: +val(d, "#csR"), W, H, margin: +val(d, "#csM"), caption: d.querySelector("#csCap").checked, fontSize: +val(d, "#csF") });
          const fs = +val(d, "#csF") || 28, cap = d.querySelector("#csCap").checked;
          for (const [pg, cells] of lay.pages.entries()) {
            E.openDoc(W, H, "Contact Sheet" + (lay.pages.length > 1 ? " " + (pg + 1) : ""), (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H); });
            for (const c of cells) {
              const it = list[c.i], src = it.canvas || (await imgOf(it)); if (!src) continue;
              const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height, k = Math.min(c.w / iw, c.h / ih), dw = iw * k, dh = ih * k;
              const L = E.makeLayer(String(it.name || "picture").replace(/\.[a-z0-9]+$/i, ""), W, H), g = L.canvas.getContext("2d");
              g.drawImage(src, c.x + (c.w - dw) / 2, c.y + (c.h - dh) / 2, dw, dh);
              if (cap) { g.fillStyle = "#222"; g.font = `${fs}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(it.name || "").slice(0, 60), c.x + c.w / 2, c.capY, c.w); }
              S.layers.push(L);
            }
            S.active = S.layers.length - 1; E.refresh(); E.renderLayersPanel();
          }
          say(`contact sheet: ${list.length} pictures on ${lay.pages.length} page${lay.pages.length > 1 ? "s" : ""}`);
        });
    }
    function cropStraighten() {
      if (!S.w) return say("open the scan first");
      const flat = E.flatten(), data = flat.getContext("2d").getImageData(0, 0, S.w, S.h).data;
      const found = findPhotos(data, S.w, S.h, { threshold: store.get("cs.thr", 40) });
      if (!found.length) return say("no photos found on the page (they need a plain page colour around them)");
      const base = S.name || "scan";
      found.forEach((r, k) => {
        const w = Math.max(1, Math.round(r.w)), h = Math.max(1, Math.round(r.h)), c = doc.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); g.translate(w / 2, h / 2); g.rotate(-r.angle); g.drawImage(flat, -r.cx, -r.cy);
        E.openDoc(w, h, `${base.replace(/\.[a-z0-9]+$/i, "")} photo ${k + 1}`, (gg) => gg.drawImage(c, 0, 0));
      });
      say(`${found.length} photo${found.length > 1 ? "s" : ""} found and opened`);
    }
    const C = E.ui.addCmd, docOpen = () => !!S.w;
    C("file.info", "File Info…", "Alt+Shift+Ctrl+I", fileInfo, { enabled: docOpen }, ["File", "file.download"]);
    C("file.print", "Print…", "Ctrl+P", print, { enabled: docOpen }, ["File", "file.info"]);
    C("auto.contact", "Automate: Contact Sheet…", "", () => contactSheet(), {}, ["File", "act.droplet"]);
    C("auto.cropstraighten", "Automate: Crop and Straighten Photos", "", cropStraighten, { enabled: docOpen }, ["File", "auto.contact"]);
    E.filePlus = { contactSheet, cropStraighten, fileInfo, print, findPhotos, pickFiles, imgOf, openDocs, dialog, addType: (t, fn) => { TYPES[String(t).toLowerCase()] = fn; } };   // 2.487.0: + addType (pcmode.js's CMYK TIFF)   // 2.486.0: pickers + dialog shared with pcmerge.js
  }

  const PCFilePlus = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCFilePlus;
  else root.PCFilePlus = PCFilePlus;
})(typeof window !== "undefined" ? window : globalThis);
