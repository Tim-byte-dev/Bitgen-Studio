/* ext/slidesdock/slidedraw.js — 🎞 SLIDES (2.832.0): a slide DRAWN ON A CANVAS - window.SlideDraw. The PDF's pages (and any
 * picture of a slide) - the same looks as the DOM slide (slidesdock.js renderSlide): the background, text wrapped word by word
 * in the box (alignment, top / middle / bottom, bullets in the accent, bold / italic / underline), shapes as their paths (fill,
 * outline), pictures (cover / contain), rotation.
 *   draw(ctx, slide, deck, scale, images)   images = {src: HTMLImageElement} (load first with loadImages)
 *   loadImages(deck, slides) -> Promise<{src: img}>
 *   wrap(ctx, text, width) -> lines           (pure given a ctx with measureText; Node-tested with a stand-in)
 *   toCanvas(slide, deck, width) -> Promise<canvas>
 */
(function (root) {
  "use strict";
  const K = () => root.SlideCore;
  /** a paragraph's lines in `width` px (words; a word too long for a line is cut) */
  function wrap(ctx, text, width) {
    const out = [], words = String(text).split(/(\s+)/);
    let line = "";
    for (const w of words) {
      if (!w) continue;
      const tryL = line + w;
      if (ctx.measureText(tryL.replace(/\s+$/, "")).width <= width || !line.trim()) {
        if (!line.trim() && ctx.measureText(w).width > width && w.trim()) {   // one long word: cut it
          let part = "";
          for (const ch of w) { if (ctx.measureText(part + ch).width > width && part) { out.push(part); part = ""; } part += ch; }
          line = part; continue;
        }
        line = tryL;
      } else { out.push(line.replace(/\s+$/, "")); line = /^\s+$/.test(w) ? "" : w; }
    }
    out.push(line.replace(/\s+$/, ""));
    return out;
  }
  function drawText(g, it, deck, box) {
    const L = K().textLook(it, deck), T = K().theme(deck), pad = 4, w = box.w - pad * 2;
    const font = `${L.i ? "italic " : ""}${L.b ? "700" : "400"} ${L.size}px '${L.font}', sans-serif`;
    g.font = font; g.textBaseline = "alphabetic";
    const lh = L.size * 1.2, ind = L.bullets ? L.size * 1.1 : 0, rows = [];
    for (const p of String(it.text || "").split("\n")) {
      if (!p) { rows.push({ t: "", first: false }); continue; }
      wrap(g, p, w - ind).forEach((t, i) => rows.push({ t, first: i === 0 }));
    }
    const total = rows.length * lh;
    let y = box.y + pad + (L.valign === "middle" ? (box.h - pad * 2 - total) / 2 : L.valign === "bottom" ? box.h - pad * 2 - total : 0);
    g.save(); g.beginPath(); g.rect(box.x, box.y, box.w, box.h); g.clip();
    for (const r of rows) {
      const base = y + L.size * 0.95;
      if (r.t) {
        const tw = g.measureText(r.t).width, x0 = box.x + pad + ind;
        const x = L.align === "center" ? x0 + (w - ind - tw) / 2 : L.align === "right" ? x0 + (w - ind - tw) : x0;
        if (L.bullets && r.first) { g.fillStyle = T.accent; g.fillText("•", box.x + pad, base); }
        g.fillStyle = L.color; g.fillText(r.t, x, base);
        if (L.u) { g.fillRect(x, base + L.size * 0.1, tw, Math.max(1, L.size / 16)); }
      }
      y += lh;
    }
    g.restore();
  }
  /** 2.835.0: a table - equal columns and rows, the header in the accent, banded rows, lines; each cell's words wrapped */
  function drawTable(g, it, deck) {
    const L = K().tableLook(it, deck), rows = it.rows || [[""]], nr = rows.length, nc = Math.max(1, rows[0].length), cw = it.w / nc, rh = it.h / nr;
    const pad = Math.max(3, L.size * 0.35), lh = L.size * 1.2;
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
      const x = it.x + j * cw, y = it.y + i * rh, hd = i === 0 && L.hasHead;
      const bg = hd ? L.head : L.band && i % 2 === (L.hasHead ? 0 : 1) ? L.band : null;
      if (bg) { g.fillStyle = bg; g.fillRect(x, y, cw, rh); }
      g.strokeStyle = L.line; g.lineWidth = 1; g.strokeRect(x, y, cw, rh);
      const t = String(rows[i][j] == null ? "" : rows[i][j]); if (!t) continue;
      g.save(); g.beginPath(); g.rect(x, y, cw, rh); g.clip();
      g.font = `${hd ? "bold " : ""}${L.size}px "${L.font}", sans-serif`; g.fillStyle = hd ? L.headColor : L.color; g.textBaseline = "alphabetic";
      const lines = wrap(g, t, cw - pad * 2), top = y + (rh - lines.length * lh) / 2;
      lines.forEach((ln, k) => g.fillText(ln, x + pad, top + (k + 0.8) * lh));
      g.restore();
    }
  }
  function drawItem(g, it, deck, images) {
    const box = { x: it.x, y: it.y, w: it.w, h: it.h };
    g.save();
    if (it.rot) { const cx = it.x + it.w / 2, cy = it.y + it.h / 2; g.translate(cx, cy); g.rotate(it.rot * Math.PI / 180); g.translate(-cx, -cy); }
    if (it.type === "text") drawText(g, it, deck, box);
    else if (it.type === "shape") {
      const S = K().shapeLook(it, deck), line = it.shape === "line", P2 = root.Path2D, D = root.DOMMatrix;
      const p = new P2(); p.addPath(new P2(K().shapePath(it.shape)), new D().translate(it.x, it.y).scale(it.w / 100, it.h / 100));
      if (!line && S.fill !== "none") { g.fillStyle = S.fill; g.fill(p); }
      const stroke = line ? (S.fill === "none" ? S.line : S.fill) : S.line, sw = line ? Math.max(1, it.lw || 4) : S.lw;
      if (stroke !== "none" && sw) { g.strokeStyle = stroke; g.lineWidth = sw; g.lineJoin = "round"; g.stroke(p); }
      if (String(it.text || "")) drawText(g, Object.assign({}, it, { st: Object.assign({ align: "center", valign: "middle", color: "#ffffff" }, it.st || {}) }), deck, box);
    } else if (it.type === "table") drawTable(g, it, deck);                 // 2.835.0
    else if (it.type === "chart") { const im = images && images["chart:" + it.id]; if (im && im.naturalWidth) g.drawImage(im, it.x, it.y, it.w, it.h); }
    else if (it.type === "image") {
      const im = images && images[it.src];
      if (im && im.naturalWidth) {
        const iw = im.naturalWidth, ih = im.naturalHeight, k = it.fit === "contain" ? Math.min(it.w / iw, it.h / ih) : Math.max(it.w / iw, it.h / ih);
        const dw = iw * k, dh = ih * k;
        g.beginPath(); g.rect(it.x, it.y, it.w, it.h); g.clip();
        g.drawImage(im, it.x + (it.w - dw) / 2, it.y + (it.h - dh) / 2, dw, dh);
      }
    }
    g.restore();
  }
  function draw(g, slide, deck, scale, images) {
    g.save(); g.scale(scale, scale);
    g.fillStyle = K().bgOf(slide, deck); g.fillRect(0, 0, deck.w, deck.h);
    for (const it of slide.items) {
      if (it.type === "text" && !String(it.text || "")) continue;          // an empty placeholder: nothing
      drawItem(g, it, deck, images);
    }
    g.restore();
  }
  function loadImages(deck, slides) {
    const want = new Set(); for (const s of slides || deck.slides) for (const it of s.items) if (it.type === "image" && it.src) want.add(it.src);
    const out = {};
    // 2.835.0: a chart = its SVG (slidedata.js, the spreadsheet's chart engine) as a picture
    const charts = []; for (const s of slides || deck.slides) for (const it of s.items) if (it.type === "chart") charts.push(it);
    const svgOf = (it) => { try { return root.H3SlideData ? root.H3SlideData.chartSvg(it, deck) : null; } catch (e) { return null; } };
    const chartsReady = charts.length && root.H3SlideData ? root.H3SlideData.engine() : Promise.resolve();
    return chartsReady.then(() => Promise.all(charts.map((it) => new Promise((res) => {
      const svg = svgOf(it); if (!svg) return res();
      const im = new root.Image(); im.onload = () => { out["chart:" + it.id] = im; res(); }; im.onerror = () => res(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    })))).then(() => Promise.all([...want].map((src) => new Promise((res) => {
      const u = src.startsWith("media:") ? deck.media[src.slice(6)] : ""; if (!u) return res();
      const im = new root.Image(); im.onload = () => { out[src] = im; res(); }; im.onerror = () => res(); im.src = u;
    })))).then(() => out);
  }
  async function toCanvas(slide, deck, width) {
    const c = root.document.createElement("canvas"), k = (width || 1920) / deck.w;
    c.width = Math.round(deck.w * k); c.height = Math.round(deck.h * k);
    try { if (root.document.fonts && root.document.fonts.ready) await root.document.fonts.ready; } catch (e) { /* fine */ }
    draw(c.getContext("2d"), slide, deck, k, await loadImages(deck, [slide]));
    return c;
  }
  const api = { wrap, draw, drawItem, drawTable, loadImages, toCanvas };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.SlideDraw = api;
})(typeof window !== "undefined" ? window : globalThis);
