/* pctunnel.js — 🕳 TEXT TUNNEL (3.16.0), window.PCTunnel (E.tunnel once installed).
 *
 * Tim (verbatim): "can we add these text effects to image editor as a preset, we draw a shape like a square or circle and it
 * creates this 3d text effect?" - the Illustrator "3D tunnel typography" look: a word repeated in rows down four walls (or
 * round rings) that shrink toward a hole in the middle, the words big at the edge and tiny deep inside.
 *
 *   Layer ▸ 🕳 Text Tunnel Tool             a tool: drag a square / rectangle (or a circle / ellipse) on the picture - the
 *                                           tunnel is drawn in it on a new layer (Shift = a true square / circle, Alt = from
 *                                           the centre). The options bar: a PRESET (⬛ Square tunnel, ⚪ Circle tunnel,
 *                                           ▭ Corridor, 🌀 Deep fade, ↗ Off-centre, 🎯 Two-colour rings, 🗼 Tower from above),
 *                                           the words, the shape, font, weight, colours, rows, hole size, fade into the depth,
 *                                           wall shading, where the hole sits (the vanishing point), words per row, which way
 *                                           the letters face, a wall colour.
 *   Layer ▸ 🕳 Text Tunnel From Shape       the active SHAPE layer (a rectangle -> square tunnel, an ellipse -> circle tunnel) or
 *                                           the selection becomes the tunnel's box; a shape layer is hidden under it.
 * A tunnel layer keeps its settings (L.tunnel, saved in a .bgi): pick it and the tool's options change IT (live, one undo a
 * change); moved or scaled with the Move tool, a re-draw follows it. The hole stays see-through.
 *
 * How it is drawn: each wall is the TOP wall turned 90° at a time. The top wall's rows are laid out flat (a word fitted to
 * each row) and copied into the picture one screen line at a time - the line at screen y is the depth u where the ring
 * s(u) = 1 / (1 + u (D - 1)) (D = outer / hole) puts it: true one-point perspective, so the rows crowd toward the hole.
 * The circle: each ring's letters set round it, one by one, their height the ring's thickness.
 * Pure (Node: scripts/test-31600.js): PRESETS, clean, presetOf, sOf, uOfS, ringAt, geom, rowsOf, wallFrame, ringsOf, refit.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const DEF = { text: "DESIGN", shape: "rect", font: "Arial Black", weight: 900, color: "#ffffff", color2: "#ff9b2f", alt: false,
    rows: 8, hole: 22, fade: 0, shade: 0, vx: 0, vy: 0, per: 1, face: "in", gap: 10, bgOn: false, bg: "#0b3b3f" };
  const PRESETS = [
    { id: "square", name: "⬛ Square tunnel", p: { shape: "rect", rows: 8, hole: 22, fade: 0, shade: 0, vx: 0, vy: 0, per: 1, face: "in", alt: false } },
    { id: "circle", name: "⚪ Circle tunnel", p: { shape: "ellipse", rows: 8, hole: 20, fade: 0, shade: 0, vx: 0, vy: 0, per: 0, face: "in", alt: false } },
    { id: "corridor", name: "▭ Corridor", p: { shape: "rect", rows: 10, hole: 34, fade: 20, shade: 30, vx: 0, vy: 0, per: 1, face: "in", alt: false } },
    { id: "deep", name: "🌀 Deep fade", p: { shape: "rect", rows: 16, hole: 8, fade: 80, shade: 0, vx: 0, vy: 0, per: 1, face: "in", alt: false } },
    { id: "offset", name: "↗ Off-centre", p: { shape: "rect", rows: 9, hole: 22, fade: 0, shade: 25, vx: 45, vy: -35, per: 1, face: "in", alt: false } },
    { id: "rings", name: "🎯 Two-colour rings", p: { shape: "ellipse", rows: 10, hole: 16, fade: 0, shade: 0, vx: 0, vy: 0, per: 0, face: "in", alt: true } },
    { id: "tower", name: "🗼 Tower from above", p: { shape: "rect", rows: 8, hole: 30, fade: 0, shade: 0, vx: 0, vy: 0, per: 1, face: "out", alt: false } },
  ];
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v).toLowerCase() : d);
  /** a tunnel's settings made safe (anything missing = the default) */
  function clean(p) {
    p = p || {};
    const text = String(p.text == null ? DEF.text : p.text).replace(/[\r\n\t]+/g, " ").trim().slice(0, 80) || DEF.text;
    return { text, shape: p.shape === "ellipse" ? "ellipse" : "rect", font: String(p.font || DEF.font).replace(/["'<>;{}]/g, "").slice(0, 60) || DEF.font,
      weight: [100, 200, 300, 400, 500, 600, 700, 800, 900].includes(+p.weight) ? +p.weight : DEF.weight,
      color: hex(p.color, DEF.color), color2: hex(p.color2, DEF.color2), alt: !!p.alt,
      rows: Math.round(num(p.rows, 2, 40, DEF.rows)), hole: num(p.hole, 3, 85, DEF.hole), fade: num(p.fade, 0, 100, 0), shade: num(p.shade, 0, 100, 0),
      vx: num(p.vx, -90, 90, 0), vy: num(p.vy, -90, 90, 0), per: Math.round(num(p.per, 0, 12, DEF.per)), face: p.face === "out" ? "out" : "in",
      gap: num(p.gap, 0, 60, DEF.gap), bgOn: !!p.bgOn, bg: hex(p.bg, DEF.bg), preset: typeof p.preset === "string" ? p.preset.slice(0, 20) : "" };
  }
  /** a preset over the current settings (its words, font and colours kept) */
  function presetOf(id, cur) {
    const P = PRESETS.find((x) => x.id === id);
    return clean(Object.assign({}, clean(cur), P ? P.p : {}, { preset: P ? P.id : "" }));
  }
  /** the depth ratio D (outer / hole) */
  const depthOf = (p) => 100 / Math.max(1, p.hole);
  /** the ring's size at depth u (0 = the outer edge, 1 = the hole): one-point perspective */
  const sOf = (u, D) => 1 / (1 + u * (D - 1));
  /** the depth u of the ring of size s */
  const uOfS = (s, D) => (D <= 1 ? 0 : Math.max(0, Math.min(1, (1 / Math.max(1e-6, s) - 1) / (D - 1))));
  /** the ring at depth u for a box {x, y, w, h}: {cx, cy, hx, hy} - its middle slides toward the vanishing point (vx / vy: % of
   *  the room there is, so the hole never leaves the box) */
  function ringAt(box, p, u) {
    const D = depthOf(p), s = sOf(u, D), hx0 = box.w / 2, hy0 = box.h / 2, room = 1 - 1 / D, g = room > 0 ? (1 - s) / room : 0;
    const ox = (p.vx / 100) * hx0 * room, oy = (p.vy / 100) * hy0 * room;
    return { cx: box.x + hx0 + ox * g, cy: box.y + hy0 + oy * g, hx: hx0 * s, hy: hy0 * s };
  }
  /** the outline, the hole and the four corner lines (for the guide while dragging, and the tests) */
  function geom(box, p) {
    const o = ringAt(box, p, 0), i = ringAt(box, p, 1);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [[o.cx + a * o.hx, o.cy + b * o.hy], [i.cx + a * i.hx, i.cy + b * i.hy]]);
    return { outer: o, inner: i, corners };
  }
  /** the rows of a wall / the rings: [{i, u0, u1, color, alpha}] */
  function rowsOf(p) {
    const out = [];
    for (let i = 0; i < p.rows; i++) {
      const u0 = i / p.rows, u1 = (i + 1) / p.rows;
      out.push({ i, u0, u1, color: p.alt && i % 2 ? p.color2 : p.color, alpha: Math.max(0.02, 1 - (p.fade / 100) * ((i + 0.5) / p.rows)) });
    }
    return out;
  }
  /** wall k (0 top, 1 right, 2 bottom, 3 left) seen as the TOP wall: it is turned k x 90° about the box's middle -
   *  {turn (radians), a (half the edge), b (half the depth across), ox, oy (the vanishing offset in that frame), shade} */
  function wallFrame(box, p, k) {
    const hx0 = box.w / 2, hy0 = box.h / 2, D = depthOf(p), room = 1 - 1 / D;
    const ox = (p.vx / 100) * hx0 * room, oy = (p.vy / 100) * hy0 * room;
    const th = -k * Math.PI / 2, c = Math.round(Math.cos(th)), s = Math.round(Math.sin(th));
    const lx = ox * c - oy * s, ly = ox * s + oy * c;     // the offset turned into the wall's own frame
    return { k, turn: k * Math.PI / 2, a: k % 2 ? hy0 : hx0, b: k % 2 ? hx0 : hy0, ox: lx, oy: ly, D, room,
      shade: (p.shade / 100) * [0, 0.35, 0.55, 0.35][k] };
  }
  /** the rings of a circle tunnel: [{i, r0, r1, cx, cy, color, alpha}] (circle space: the radius of the box's width) */
  function ringsOf(box, p) {
    const D = depthOf(p), R = box.w / 2;
    return rowsOf(p).map((r) => {
      const um = (r.u0 + r.u1) / 2, c = ringAt(box, p, um);
      return Object.assign(r, { r0: R * sOf(r.u0, D), r1: R * sOf(r.u1, D), cx: c.cx, cy: c.cy });
    });
  }
  /** a tunnel that was moved / scaled since it was drawn: its box moved and scaled the same way as its pixels. A side cut off
   *  by the picture's edge (W x H) does not count as a resize - the other side says where it went. */
  function refit(box, was, now, W, H) {
    if (!was || !now || !(was.w > 0) || !(was.h > 0)) return box;
    const axis = (p0, s0, p1, s1, size) => {
      const cutA = p1 <= 0, cutB = size > 0 && p1 + s1 >= size;
      if (cutA && cutB) return [0, 1];
      if (cutA) return [(p1 + s1) - (p0 + s0), 1];                  // cut on the left / top: the far side moved this much
      if (cutB) return [p1 - p0, 1];
      return [null, s1 / s0];
    };
    const [dx, kx] = axis(was.x, was.w, now.x, now.w, W || 0), [dy, ky] = axis(was.y, was.h, now.y, now.h, H || 0);
    const X = dx == null ? now.x + (box.x - was.x) * kx : box.x + dx, Y = dy == null ? now.y + (box.y - was.y) * ky : box.y + dy;
    return { x: X, y: Y, w: box.w * kx, h: box.h * ky };
  }
  /** the box a drag makes: Shift = square, Alt = from the start point out */
  function dragBox(x0, y0, x1, y1, sq, centre) {
    let w = x1 - x0, h = y1 - y0;
    if (sq) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
    if (centre) return { x: x0 - Math.abs(w), y: y0 - Math.abs(h), w: Math.abs(w) * 2, h: Math.abs(h) * 2 };
    return { x: Math.min(x0, x0 + w), y: Math.min(y0, y0 + h), w: Math.abs(w), h: Math.abs(h) };
  }
  const pure = { DEF, PRESETS, clean, presetOf, depthOf, sOf, uOfS, ringAt, geom, rowsOf, wallFrame, ringsOf, refit, dragBox };

  /* ================================ drawing (a canvas) ================================ */
  function fontOf(p, px, D) {
    const st = (D && D.FONT_STACK) || {}, fam = st[p.font] || `'${p.font}', 'Arial Black', Arial, sans-serif`;
    return `${p.weight} ${Math.max(1, Math.round(px))}px ${fam}`;
  }
  /** the word's ink box at size 100: {w, asc, desc} */
  function inkOf(g, p, word, D) {
    g.font = fontOf(p, 100, D); const m = g.measureText(word);
    const asc = m.actualBoundingBoxAscent || 72, desc = m.actualBoundingBoxDescent || 0;
    const l = m.actualBoundingBoxLeft || 0, r = m.actualBoundingBoxRight || m.width;
    return { w: Math.max(1, l + r), left: l, asc, desc, adv: m.width };
  }
  /** a word stretched to fill the cell (x, y, w, h); turned over when the letters face out */
  function fitWord(g, p, word, ink, x, y, w, h, out, D) {
    g.save(); g.translate(x + w / 2, y + h / 2); if (out) g.rotate(Math.PI);
    g.scale(w / ink.w, h / (ink.asc + ink.desc)); g.font = fontOf(p, 100, D); g.textBaseline = "alphabetic"; g.textAlign = "left";
    g.fillText(word, -ink.w / 2 + ink.left, -(ink.asc + ink.desc) / 2 + ink.asc); g.restore();
  }
  /** the top wall's rows laid out flat: a canvas Wsrc wide (the outer edge), the rows down it */
  function wallSource(mk, p, f, D) {
    const Wsrc = Math.max(8, Math.min(4096, Math.round(f.a * 2)));
    const rowPx = f.b * (1 - sOf(1 / p.rows, f.D)) * 1.25;                 // the outer row's height on the screen (a little over)
    const rowH = Math.max(12, Math.min(900, Math.round(rowPx))), H = Math.min(8192, rowH * p.rows);
    const c = mk(Wsrc, H), g = c.getContext("2d"), word = p.text, ink = inkOf(g, p, word, D);
    const per = p.per > 0 ? p.per : 1, cw = Wsrc / per, rh = H / p.rows, pad = (p.gap / 100) * rh / 2;
    for (const r of rowsOf(p)) {
      g.globalAlpha = r.alpha; g.fillStyle = r.color;
      for (let j = 0; j < per; j++) fitWord(g, p, word, ink, j * cw + cw * 0.015, r.i * rh + pad, cw * 0.97, rh - pad * 2, p.face === "out", D);
    }
    g.globalAlpha = 1;
    return c;
  }
  /** one wall into g (the picture): each screen line from the outer edge to the hole takes the source line at its depth */
  function drawWall(g, mk, box, p, k, D) {
    const f = wallFrame(box, p, k), src = wallSource(mk, p, f, D), H = src.height, W = src.width;
    const G = f.room > 0 ? 1 / f.room : 0, a = f.a, b = f.b;
    const yOf = (s) => f.oy * (1 - s) * G - b * s, xOf = (s) => [f.ox * (1 - s) * G - a * s, f.ox * (1 - s) * G + a * s];
    const sIn = 1 / f.D, yTop = yOf(1), yHole = yOf(sIn);
    g.save();
    g.translate(box.x + box.w / 2, box.y + box.h / 2); g.rotate(f.turn);
    // the wall's own shape (so the corners meet cleanly on the diagonals)
    const [il, ir] = xOf(sIn);
    g.beginPath(); g.moveTo(-a, -b); g.lineTo(a, -b); g.lineTo(ir, yHole); g.lineTo(il, yHole); g.closePath(); g.clip();
    if (p.bgOn) { g.fillStyle = p.bg; g.fill(); }
    g.imageSmoothingEnabled = true; if ("imageSmoothingQuality" in g) g.imageSmoothingQuality = "high";
    const sOfY = (y) => (f.oy * G - y) / (f.oy * G + b);                    // the inverse of yOf
    for (let y = Math.floor(yTop); y < yHole; y++) {
      const s0 = Math.min(1, sOfY(Math.max(yTop, y))), s1 = Math.max(sIn, sOfY(Math.min(yHole, y + 1)));
      const u0 = uOfS(s0, f.D), u1 = uOfS(s1, f.D); if (!(u1 > u0)) continue;
      const v0 = u0 * H, vh = Math.max(0.5, (u1 - u0) * H), [xl, xr] = xOf(s0);
      g.drawImage(src, 0, v0, W, Math.min(vh, H - v0), xl, y, xr - xl, 1.6);
    }
    if (f.shade > 0) { g.globalCompositeOperation = "source-atop"; g.fillStyle = `rgba(0,0,0,${f.shade})`; g.fillRect(-a - 2, -b - 2, a * 2 + 4, yHole + b + 4); }
    g.restore();
  }
  /** a circle (or an ellipse) tunnel into g: each ring's letters set round it */
  function drawRings(g, box, p, D) {
    const R = box.w / 2, sy = box.h / Math.max(1, box.w), word = p.text;
    g.save(); g.translate(0, box.y + box.h / 2); g.scale(1, sy); g.translate(0, -(box.y + box.h / 2));
    const toC = (cy) => box.y + box.h / 2 + (cy - (box.y + box.h / 2)) / sy;   // the ring's middle in circle space
    const rings = ringsOf(box, p);
    if (p.bgOn) {
      const i = ringAt(box, p, 1); g.fillStyle = p.bg; g.beginPath(); g.arc(box.x + R, box.y + box.h / 2, R, 0, Math.PI * 2);
      g.moveTo(i.cx + i.hx, toC(i.cy)); g.arc(i.cx, toC(i.cy), i.hx, 0, Math.PI * 2, true); g.fill("evenodd");
    }
    const ink = inkOf(g, p, word + " ", D), inkW = inkOf(g, p, word, D);
    let k = 0;
    for (const r of rings) {
      const t = r.r0 - r.r1, pad = (p.gap / 100) * t / 2, band = Math.max(0.5, t - pad * 2), rm = r.r1 + pad + band / 2;
      const fs = 100 * band / (inkW.asc + inkW.desc), C = 2 * Math.PI * rm;
      if (!k) k = p.per > 0 ? p.per : Math.max(1, Math.round(C / (ink.adv * fs / 100)));   // how many times round (the outer ring decides; all keep it)
      const sx = C / (k * ink.adv * fs / 100), cx = r.cx, cy = toC(r.cy);
      g.globalAlpha = r.alpha; g.fillStyle = r.color; g.font = fontOf(p, fs, D); g.textAlign = "center"; g.textBaseline = "alphabetic";
      const base = (inkW.asc - inkW.desc) / 2 * fs / 100;      // the baseline below the band's middle
      let ang = 0; const str = (word + " ").repeat(k);
      for (const ch of str) {
        const cwid = g.measureText(ch).width * sx, da = cwid / rm;
        if (ch !== " ") {
          g.save(); g.translate(cx, cy); g.rotate(ang + da / 2);
          if (p.face === "out") { g.translate(0, -rm); g.rotate(Math.PI); g.scale(sx, 1); g.fillText(ch, 0, base); }
          else { g.translate(0, -rm); g.scale(sx, 1); g.fillText(ch, 0, base); }
          g.restore();
        }
        ang += da;
      }
    }
    g.globalAlpha = 1; g.restore();
  }
  /** the whole tunnel into a canvas c (cleared first) */
  function render(c, box, p, mk, D) {
    p = clean(p);
    const g = c.getContext("2d"); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.restore();
    if (!(box.w >= 4 && box.h >= 4)) return c;
    if (p.shape === "ellipse") drawRings(g, box, p, D);
    else for (const k of [0, 1, 2, 3]) drawWall(g, mk, box, p, k, D);
    return c;
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, store = E.store, D = E.D;
    const say = (t) => (E.say ? E.say(t) : null);
    const mk = (w, h) => E.newCanvas(w, h);
    const cur = () => clean(store.get("tunnel.p", null) || DEF);
    const tun = () => { const L = E.layer(); return L && L.tunnel && L.type === "pixel" ? L : null; };
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    /** draw L's tunnel again where its pixels are now */
    function redraw(L, p) {
      const T = L.tunnel, now = E.alphaBox(L.canvas);
      const box = now && T.drawn ? refit(T.box, T.drawn, now, L.canvas.width, L.canvas.height) : T.box;
      render(L.canvas, box, p, mk, D); L.ver = (L.ver || 0) + 1;
      L.tunnel = { box, p: clean(p), drawn: E.alphaBox(L.canvas) };
    }
    /** a new tunnel layer above the active one */
    function make(box, p, o) {
      if (!S.w) { say("open a picture first"); return null; }
      p = clean(p);
      const name = "🕳 " + p.text.slice(0, 24) + (p.shape === "ellipse" ? " rings" : " tunnel");
      let L = null;
      E.structOp("🕳 text tunnel", () => {
        L = E.makeLayer(name, S.w, S.h);
        render(L.canvas, box, p, mk, D);
        L.tunnel = { box, p, drawn: E.alphaBox(L.canvas) };
        const ref = E.layer();
        S.layers = ref ? E.D.insert(S.layers, L, ref.id, false) : S.layers.concat([L]);
        if (o && o.hide) o.hide.visible = false;
        S.active = S.layers.indexOf(L);
      });
      say(`🕳 ${name} - ${p.rows} rows, the hole ${Math.round(p.hole)} %`);
      return L;
    }
    /** the active shape layer / the selection as the box */
    function fromShape() {
      const L = E.layer(); let box = null, shape = null, hide = null;
      if (L && L.type === "shape" && L.shape) { const s = L.shape; box = { x: s.x, y: s.y, w: s.w, h: s.h }; shape = s.kind === "ellipse" ? "ellipse" : "rect"; hide = L; }
      else if (E.hasSel && E.hasSel()) box = E.P.bbox(S.sel, S.w, S.h);
      if (!box || box.w < 8 || box.h < 8) { say("🕳 draw a rectangle or an ellipse with the shape tool (or make a selection) first"); return null; }
      const p = cur(); if (shape) p.shape = shape;
      const T = make(box, p, { hide }); E.refresh(); E.renderLayersPanel(); return T;
    }

    // ---- the options: change the picked tunnel live (one undo a change), else the settings for the next one
    let live = null, raf = 0;
    function applyLive(p, done) {
      const L = tun();
      store.set("tunnel.p", p);
      if (!L) return;
      if (!live || live.L !== L) live = { L, copy: E.beginPx(L), before: JSON.parse(JSON.stringify(L.tunnel)) };
      const go = () => { raf = 0; redraw(live.L, p); E.refresh(); };
      if (done) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; } go();
        const e = E.endPx(live.L, live.copy, null, "🕳 tunnel settings");
        if (e) E.push({ t: "multi", list: [e], label: "🕳 tunnel settings", tunnel: { L: live.L, before: live.before, after: JSON.parse(JSON.stringify(live.L.tunnel)) } });
        live = null; E.renderLayersPanel();
      } else if (!raf) raf = (root.requestAnimationFrame || ((f) => setTimeout(f, 16)))(go);
    }
    const prevUndo = E.onUndo;
    E.onUndo = function (e, back) {
      if (prevUndo) prevUndo.apply(this, arguments);
      if (e && e.tunnel && e.tunnel.L) { e.tunnel.L.tunnel = JSON.parse(JSON.stringify(back ? e.tunnel.before : e.tunnel.after)); if (S.tool === "tunnel") E.renderOptions(); }
    };

    const FONTS = ["Arial Black", "Impact"].concat(Object.keys((D && D.FONT_STACK) || {}).filter((f) => !/^(serif|sans-serif|monospace)$/.test(f)));
    let st = null;
    E.tools.tunnel = {
      id: "tunnel", name: "🕳 Text Tunnel", cursor: "crosshair",
      options() {
        const L = tun(), p = L ? clean(L.tunnel.p) : cur();
        const n = (id, v, lo, hi, w, tip) => `<input type="number" id="${id}" min="${lo}" max="${hi}" value="${Math.round(v)}" style="width:${w || 48}px" title="${tip || ""}">`;
        return `<label title="A ready-made look - it keeps your words, font and colours">Preset <select id="tnPre"><option value="">-</option>${PRESETS.map((x) => `<option value="${x.id}"${p.preset === x.id ? " selected" : ""}>${x.name}</option>`).join("")}</select></label>
          <label title="The words repeated down the walls">Words <input type="text" id="tnText" value="${esc(p.text)}" style="width:110px"></label>
          <select id="tnShape" title="Square / rectangle walls or round rings"><option value="rect"${p.shape === "rect" ? " selected" : ""}>⬛ Square</option><option value="ellipse"${p.shape === "ellipse" ? " selected" : ""}>⚪ Circle</option></select>
          <input type="text" id="tnFont" list="tnFonts" value="${esc(p.font)}" style="width:96px" title="Font"><datalist id="tnFonts">${FONTS.map((f) => `<option value="${esc(f)}">`).join("")}</datalist>
          <select id="tnWeight" title="Weight">${[400, 700, 900].map((w) => `<option value="${w}"${p.weight === w ? " selected" : ""}>${w === 900 ? "Black" : w === 700 ? "Bold" : "Regular"}</option>`).join("")}</select>
          <input type="color" id="tnColor" value="${p.color}" title="The letters' colour">
          <label title="Every other row in the second colour"><input type="checkbox" id="tnAlt"${p.alt ? " checked" : ""}>2nd</label><input type="color" id="tnColor2" value="${p.color2}" title="The second colour">
          <label title="How many rows down each wall (rings round a circle)">Rows ${n("tnRows", p.rows, 2, 40)}</label>
          <label title="How big the hole in the middle is (% of the shape)">Hole % ${n("tnHole", p.hole, 3, 85)}</label>
          <label title="The rows fade away into the depth">Fade ${n("tnFade", p.fade, 0, 100)}</label>
          <label title="The side and bottom walls darker - more 3D (square)">Shade ${n("tnShade", p.shade, 0, 100)}</label>
          <label title="Where the hole sits: left / right and up / down (% of the room there is)">Hole at ${n("tnVx", p.vx, -90, 90, 44, "left - / right +")}${n("tnVy", p.vy, -90, 90, 44, "up - / down +")}</label>
          <label title="Words in each row (0 on a circle = as many as fit round)">Per row ${n("tnPer", p.per, 0, 12, 40)}</label>
          <select id="tnFace" title="Which way the letters stand"><option value="in"${p.face === "in" ? " selected" : ""}>Letters face the hole</option><option value="out"${p.face === "out" ? " selected" : ""}>Letters face out</option></select>
          <label title="Fill the walls behind the letters"><input type="checkbox" id="tnBgOn"${p.bgOn ? " checked" : ""}>Walls</label><input type="color" id="tnBg" value="${p.bg}" title="The walls' colour">
          <button class="ghost" id="tnFromShape" title="The active rectangle / ellipse shape layer (or the selection) becomes a tunnel">⬛→🕳 From shape</button>
          <span style="color:var(--pc-dim)">${L ? `Changing <b>${esc(L.name)}</b> - drag for a new one` : "Drag a square or a circle (Shift = even, Alt = from the middle)"}</span>`;
      },
      bindOptions(o) {
        const q = (id) => o.querySelector("#" + id);
        const read = () => { const L = tun(), base = L ? clean(L.tunnel.p) : cur();
          return clean(Object.assign(base, { text: q("tnText").value, shape: q("tnShape").value, font: q("tnFont").value, weight: +q("tnWeight").value,
            color: q("tnColor").value, alt: q("tnAlt").checked, color2: q("tnColor2").value, rows: +q("tnRows").value, hole: +q("tnHole").value,
            fade: +q("tnFade").value, shade: +q("tnShade").value, vx: +q("tnVx").value, vy: +q("tnVy").value, per: +q("tnPer").value,
            face: q("tnFace").value, bgOn: q("tnBgOn").checked, bg: q("tnBg").value })); };
        ["tnText", "tnFont", "tnColor", "tnColor2", "tnRows", "tnHole", "tnFade", "tnShade", "tnVx", "tnVy", "tnPer", "tnBg"].forEach((id) => {
          const el = q(id); if (!el) return; el.oninput = () => applyLive(read(), false); el.onchange = () => applyLive(read(), true); });
        ["tnShape", "tnWeight", "tnAlt", "tnFace", "tnBgOn"].forEach((id) => { const el = q(id); if (el) el.onchange = () => applyLive(read(), true); });
        const pre = q("tnPre"); if (pre) pre.onchange = () => { if (!pre.value) return; applyLive(presetOf(pre.value, read()), true); E.renderOptions(); };
        const fs = q("tnFromShape"); if (fs) fs.onclick = () => { fromShape(); E.renderOptions(); };
      },
      down(e, fx, fy) { st = { x0: fx, y0: fy, box: null }; return true; },
      move(e, fx, fy) { if (!st) return; st.box = dragBox(st.x0, st.y0, fx, fy, e.shiftKey, e.altKey); E.drawOverlay(); },
      up() {
        if (!st) return; const s = st; st = null; E.drawOverlay();
        if (!s.box || s.box.w < 8 || s.box.h < 8) return;
        make(s.box, cur()); E.refresh(); E.renderLayersPanel(); E.renderOptions();
      },
    };
    // the guide while dragging: the shape, the hole and the corner lines
    E.overlayHooks.push((g, px) => {
      if (S.tool !== "tunnel" || !st || !st.box) return;
      const p = cur(), G = geom(st.box, p), o = G.outer, i = G.inner;
      g.save(); g.lineWidth = 1.5 * px; g.strokeStyle = "#ff9b2f"; g.setLineDash([6 * px, 4 * px]); g.beginPath();
      if (p.shape === "ellipse") { g.ellipse(o.cx, o.cy, o.hx, o.hy, 0, 0, Math.PI * 2); g.moveTo(i.cx + i.hx, i.cy); g.ellipse(i.cx, i.cy, i.hx, i.hy, 0, 0, Math.PI * 2); }
      else { g.rect(o.cx - o.hx, o.cy - o.hy, o.hx * 2, o.hy * 2); g.rect(i.cx - i.hx, i.cy - i.hy, i.hx * 2, i.hy * 2); for (const [a, b] of G.corners) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } }
      g.stroke(); g.restore();
    });
    E.ui.addCmd("layer.tunneltool", "🕳 Text Tunnel Tool", "", () => { if (!S.w) return say("open a picture first"); E.setTool("tunnel"); }, {}, ["Layer", "layer.groundshadow"]);
    E.ui.addCmd("layer.tunnelshape", "🕳 Text Tunnel From Shape", "", () => fromShape(),
      { enabled: () => { const L = E.layer(); return !!((L && L.type === "shape") || (E.hasSel && E.hasSel())); } }, ["Layer", "layer.tunneltool"]);
    E.tunnel = { make, fromShape, redraw, render: (c, box, p) => render(c, box, p, mk, D), settings: cur, set: (p) => store.set("tunnel.p", clean(p)) };
  }

  const PCTunnel = Object.assign({ install, render }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCTunnel;
  else root.PCTunnel = PCTunnel;
})(typeof window !== "undefined" ? window : globalThis);
