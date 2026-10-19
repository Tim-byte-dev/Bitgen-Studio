/* brushes.js — THE IMAGE EDITOR'S BRUSH ENGINE + 20 PRESETS (2.332.0).
 *
 * Tim: "we just need about 20 brush presets, selections tools are the most
 * important". Krita-style: a brush is a TIP stamped along the stroke every
 * `spacing` x its size (dabs), each dab at `flow`, the whole stroke laid on
 * the layer at `opacity` (so a stroke never builds past its opacity - Krita's
 * "wash" mode), pen pressure scaling size and/or flow. A stroke only paints
 * INSIDE the selection when there is one, exactly as in Krita.
 *
 *   engine "paint"   dabs into a stroke buffer, composited at the end with
 *                    the preset's blend (normal, multiply, soft-light ...)
 *   engine "erase"   the same buffer, composited destination-out
 *   engine "smudge"  drags the colour under the brush along the stroke
 *   engine "blur"    softens under the brush
 *
 * The pure parts (presets, dab spacing, pressure, the tip's alpha) are plain
 * functions tested in Node; Stroke draws with a 2D canvas in the page.
 */
(function (root) {
  "use strict";

  /* ------------------------------ the presets ------------------------------ */
  // size px, opacity/flow 0..1, hardness 0..1 (1 = hard edge), spacing
  // (fraction of the size between dabs), tip: round | square | grain | bristle
  // | spray, pressure: which of size/flow the pen drives, blend: the stroke's
  // composite onto the layer, scatter/jitter for the spray and splatter tips.
  const PRESETS = [
    { id: "basic",     name: "Basic round",       icon: "●", engine: "paint", tip: "round",   size: 24,  opacity: 1,    flow: 1,    hardness: 0.95, spacing: 0.08, pressure: { size: true, flow: false } },
    { id: "soft",      name: "Soft round",        icon: "◍", engine: "paint", tip: "round",   size: 60,  opacity: 0.8,  flow: 0.35, hardness: 0.05, spacing: 0.1,  pressure: { size: false, flow: true } },
    { id: "airbrush",  name: "Airbrush",          icon: "☁", engine: "paint", tip: "round",   size: 120, opacity: 0.6,  flow: 0.08, hardness: 0,    spacing: 0.05, pressure: { size: false, flow: true } },
    { id: "pencil",    name: "Pencil",            icon: "✎", engine: "paint", tip: "grain",   size: 4,   opacity: 0.9,  flow: 0.8,  hardness: 0.9,  spacing: 0.15, grain: 0.45, pressure: { size: false, flow: true } },
    { id: "ink",       name: "Ink pen",           icon: "✒", engine: "paint", tip: "round",   size: 8,   opacity: 1,    flow: 1,    hardness: 1,    spacing: 0.05, pressure: { size: true, flow: false }, minSize: 0.15 },
    { id: "marker",    name: "Marker",            icon: "▮", engine: "paint", tip: "square",  size: 22,  opacity: 0.7,  flow: 1,    hardness: 0.85, spacing: 0.06, pressure: { size: false, flow: false }, blend: "multiply" },
    { id: "chalk",     name: "Chalk",             icon: "▦", engine: "paint", tip: "grain",   size: 36,  opacity: 0.9,  flow: 0.7,  hardness: 0.6,  spacing: 0.12, grain: 0.7, pressure: { size: true, flow: true }, rotate: true },
    { id: "charcoal",  name: "Charcoal",          icon: "▩", engine: "paint", tip: "grain",   size: 28,  opacity: 0.85, flow: 0.5,  hardness: 0.3,  spacing: 0.1,  grain: 0.85, pressure: { size: true, flow: true }, rotate: true },
    { id: "water",     name: "Watercolor wash",   icon: "💧", engine: "paint", tip: "round",   size: 90,  opacity: 0.45, flow: 0.12, hardness: 0.1,  spacing: 0.08, pressure: { size: true, flow: true }, blend: "multiply" },
    { id: "oil",       name: "Oil bristle",       icon: "🖌", engine: "paint", tip: "bristle", size: 40,  opacity: 1,    flow: 0.9,  hardness: 0.8,  spacing: 0.04, bristles: 18, pressure: { size: true, flow: false }, rotate: true },
    { id: "splatter",  name: "Splatter",          icon: "✺", engine: "paint", tip: "spray",   size: 80,  opacity: 1,    flow: 1,    hardness: 0.9,  spacing: 0.6,  scatter: 1, drops: 6, dropSize: [0.04, 0.18], pressure: { size: true, flow: false } },
    { id: "spray",     name: "Spray can",         icon: "⁂", engine: "paint", tip: "spray",   size: 70,  opacity: 0.9,  flow: 0.6,  hardness: 1,    spacing: 0.15, scatter: 1, drops: 40, dropSize: [0.01, 0.03], pressure: { size: false, flow: true } },
    { id: "texture",   name: "Texture stamp",     icon: "▤", engine: "paint", tip: "grain",   size: 64,  opacity: 0.7,  flow: 0.4,  hardness: 0.5,  spacing: 0.35, grain: 0.95, pressure: { size: false, flow: true }, rotate: true, jitter: 1 },
    { id: "glow",      name: "Glow",              icon: "✦", engine: "paint", tip: "round",   size: 70,  opacity: 0.7,  flow: 0.2,  hardness: 0,    spacing: 0.08, pressure: { size: false, flow: true }, blend: "screen" },
    { id: "dodge",     name: "Dodge (lighten)",   icon: "☼", engine: "paint", tip: "round",   size: 80,  opacity: 0.35, flow: 0.25, hardness: 0.1,  spacing: 0.08, pressure: { size: false, flow: true }, blend: "soft-light", color: "#ffffff" },
    { id: "burn",      name: "Burn (darken)",     icon: "◐", engine: "paint", tip: "round",   size: 80,  opacity: 0.35, flow: 0.25, hardness: 0.1,  spacing: 0.08, pressure: { size: false, flow: true }, blend: "soft-light", color: "#000000" },
    { id: "smudge",    name: "Smudge",            icon: "☝", engine: "smudge", tip: "round",  size: 40,  opacity: 1,    flow: 0.6,  hardness: 0.3,  spacing: 0.08, pressure: { size: false, flow: true } },
    { id: "blur",      name: "Blur",              icon: "◌", engine: "blur",   tip: "round",  size: 50,  opacity: 1,    flow: 0.5,  hardness: 0.2,  spacing: 0.15, pressure: { size: false, flow: true } },
    { id: "erase",     name: "Eraser hard",       icon: "⌫", engine: "erase",  tip: "round",  size: 30,  opacity: 1,    flow: 1,    hardness: 0.95, spacing: 0.06, pressure: { size: true, flow: false } },
    { id: "erasesoft", name: "Eraser soft",       icon: "⌦", engine: "erase",  tip: "round",  size: 80,  opacity: 1,    flow: 0.3,  hardness: 0,    spacing: 0.08, pressure: { size: false, flow: true } },
  ];
  const byId = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];

  /* ------------------------------ pure helpers ----------------------------- */
  /** A small seeded RNG (mulberry32) - grain and spray look the same each time. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Size and flow at a pen pressure (0..1). A mouse reports 0.5 while held -
   *  the page passes 1 for it. minSize = the size at zero pressure. */
  function atPressure(preset, size, flow, pressure) {
    const pr = Math.max(0, Math.min(1, pressure == null ? 1 : pressure));
    const ps = preset.pressure || {};
    const minS = preset.minSize != null ? preset.minSize : 0.2;
    return {
      size: Math.max(1, ps.size ? size * (minS + (1 - minS) * pr) : size),
      flow: Math.max(0.005, ps.flow ? flow * (0.15 + 0.85 * pr) : flow),
    };
  }

  /** Dab positions from a to b every `step` px, carrying the remainder so
   *  a stroke made of many short moves stays evenly spaced.
   *  -> {pts: [[x, y, t]], carry} (t = 0..1 along the segment) */
  function dabs(a, b, step, carry) {
    const s = Math.max(0.5, step);
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    const pts = [];
    let d = s - (carry || 0);
    if (len === 0) return { pts, carry: carry || 0 };
    while (d <= len) {
      const t = d / len;
      pts.push([a[0] + dx * t, a[1] + dy * t, t]);
      d += s;
    }
    return { pts, carry: len - (d - s) };
  }

  /** The tip's ALPHA (0..255) for a size px square: round / square with the
   *  hardness falloff, grain = round x seeded noise, bristle = N soft dots
   *  along one axis. -> {size, alpha: Uint8ClampedArray(size*size)} */
  function tipAlpha(preset, sizePx, seed) {
    const n = Math.max(1, Math.ceil(sizePx));
    const out = new Uint8ClampedArray(n * n);
    const r = n / 2, hard = Math.max(0, Math.min(1, preset.hardness == null ? 1 : preset.hardness));
    const rnd = rng(seed || 7);
    const edge = (d) => {                     // d = distance / radius (0..1+)
      if (d >= 1) return 0;
      if (d <= hard) return 1;
      const t = (d - hard) / Math.max(1e-6, 1 - hard);
      return 1 - t * t * (3 - 2 * t);           // smoothstep falloff
    };
    if (preset.tip === "sampled" && preset.sample) {          // 2.484.0: a picture tip (an .abr brush, a saved one): its grey = the paint
      const sm = preset.sample, sw = sm.w, sh = sm.h, data = sampleData(sm), k = n / Math.max(sw, sh);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const sx = (x + 0.5 - (n - sw * k) / 2) / k, sy = (y + 0.5 - (n - sh * k) / 2) / k;
        if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) continue;
        out[y * n + x] = data[(sy | 0) * sw + (sx | 0)];
      }
      return { size: n, alpha: out };
    }
    if (preset.tip === "bristle") {
      const k = Math.max(3, preset.bristles || 12);
      const dots = [];
      for (let i = 0; i < k; i++) dots.push([(i + 0.5) / k * n, r + (rnd() - 0.5) * n * 0.25, (0.35 + rnd() * 0.65), 0.6 + rnd() * 0.4]);
      const dr = Math.max(0.8, n / k * 0.9);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        let a = 0;
        for (const [cx, cy, w, sc] of dots) {
          const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 0.6) / (dr * sc);
          if (d < 1) a = Math.max(a, (1 - d * d) * w);
        }
        out[y * n + x] = Math.round(255 * Math.min(1, a) * edge(Math.hypot(x + 0.5 - r, y + 0.5 - r) / r));
      }
      return { size: n, alpha: out };
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = (x + 0.5 - r) / r, dy = (y + 0.5 - r) / r;
      let a = preset.tip === "square" ? edge(Math.max(Math.abs(dx), Math.abs(dy))) : edge(Math.hypot(dx, dy));
      if (preset.tip === "grain" && a > 0) {
        const g = preset.grain == null ? 0.5 : preset.grain;
        a *= 1 - g * rnd();
      }
      out[y * n + x] = Math.round(255 * a);
    }
    return { size: n, alpha: out };
  }

  /** a sampled tip's grey bytes (an array, a Uint8Array, or base64 text - kept that way in brushes/<name>.json) */
  function sampleData(sm) {
    if (sm._bytes) return sm._bytes;
    let b = sm.data;
    if (typeof b === "string") { const bin = typeof atob === "function" ? atob(b) : Buffer.from(b, "base64").toString("binary"); b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); }
    else if (!(b instanceof Uint8Array)) b = Uint8Array.from(b || []);
    Object.defineProperty(sm, "_bytes", { value: b, enumerable: false, configurable: true });
    return b;
  }

  /** Canvas composite names for the blend modes a layer or brush may use. */
  const BLENDS = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn",
    "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
  const compositeOf = (b) => (!b || b === "normal" ? "source-over" : BLENDS.includes(b) ? b : "source-over");

  /* --------------------------- the stroke (page) --------------------------- */
  function hexRgb(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || "#000000"));
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
  }
  const tipCache = new Map();
  function tipCanvas(doc, preset, sizePx, color) {
    const key = `${preset.id}|${preset.v || 0}|${Math.round(sizePx)}|${color}`;          // 2.484.0: v = the preset's settings changed
    if (tipCache.has(key)) return tipCache.get(key);
    const t = tipAlpha(preset, Math.round(sizePx), 11);
    const c = doc.createElement("canvas"); c.width = t.size; c.height = t.size;
    const g = c.getContext("2d"), id = g.createImageData(t.size, t.size), [cr, cg, cb] = hexRgb(color);
    for (let i = 0; i < t.alpha.length; i++) { id.data[i * 4] = cr; id.data[i * 4 + 1] = cg; id.data[i * 4 + 2] = cb; id.data[i * 4 + 3] = t.alpha[i]; }
    g.putImageData(id, 0, 0);
    if (tipCache.size > 400) tipCache.clear();
    tipCache.set(key, c);
    return c;
  }

  /**
   * One stroke on one layer. opts: {doc (document), layer (canvas), preset,
   * size, opacity, flow, color, selCanvas (alpha = the selection, or null)}.
   * add(x, y, pressure) as the pen moves; end() lays it down and returns the
   * dirty rect {x, y, w, h} (or null). While painting, `buffer` + `blend` +
   * `opacity` let the page preview the stroke over the layer.
   */
  function Stroke(o) {
    this.o = o; this.p = o.preset; this.doc = o.doc;
    const L = o.layer;
    this.W = L.width; this.H = L.height;
    this.color = this.p.color || o.color || "#000000";
    this.opacity = Math.max(0, Math.min(1, o.opacity == null ? this.p.opacity : o.opacity));
    this.flow = Math.max(0.005, Math.min(1, o.flow == null ? this.p.flow : o.flow));
    this.size = Math.max(1, o.size || this.p.size);
    this.last = null; this.carry = 0; this.rnd = rng(Date.now() & 0xffff);
    this.dirty = null;
    // 2.389.0: o.dab(layer, x, y, n, flow, stroke) = a tool's OWN dab (clone stamp, healing, dodge / burn / sponge,
    // sharpen, history brush - ext/imageeditdock/pctools.js): spacing, pressure and the selection clip come from here
    this.direct = this.p.engine === "smudge" || this.p.engine === "blur" || typeof o.dab === "function";
    this.blend = this.p.engine === "erase" ? "destination-out" : compositeOf(this.p.blend);
    if (this.direct) {
      // before-copy: the selection clip is applied against it at the end
      this.before = this.doc.createElement("canvas"); this.before.width = this.W; this.before.height = this.H;
      this.before.getContext("2d").drawImage(L, 0, 0);
    } else {
      this.buffer = this.doc.createElement("canvas"); this.buffer.width = this.W; this.buffer.height = this.H;
      this.bg = this.buffer.getContext("2d");
    }
  }
  Stroke.prototype.grow = function (x, y, r) {
    const x0 = Math.max(0, Math.floor(x - r - 2)), y0 = Math.max(0, Math.floor(y - r - 2));
    const x1 = Math.min(this.W, Math.ceil(x + r + 2)), y1 = Math.min(this.H, Math.ceil(y + r + 2));
    if (x1 <= x0 || y1 <= y0) return;
    if (!this.dirty) { this.dirty = { x0, y0, x1, y1 }; return; }
    const d = this.dirty;
    d.x0 = Math.min(d.x0, x0); d.y0 = Math.min(d.y0, y0); d.x1 = Math.max(d.x1, x1); d.y1 = Math.max(d.y1, y1);
  };
  Stroke.prototype.dab = function (x, y, pressure, angle) {
    // 2.484.0: Brush Settings (shape dynamics, scattering, texture, dual brush, colour dynamics, transfer, the tip's
    // angle / roundness / flip) - brushdyn.js draws such a dab
    if (!this.direct && root.IEBrushDyn && root.IEBrushDyn.active(this.p)) return root.IEBrushDyn.dab(this, x, y, pressure, angle);
    const at = atPressure(this.p, this.size, this.flow, pressure);
    const s = at.size, r = s / 2;
    this.grow(x, y, r * (this.p.tip === "spray" ? 1.2 : 1));
    if (this.direct) return this.directDab(x, y, s, at.flow);
    const g = this.bg;
    g.globalAlpha = at.flow;
    if (this.p.tip === "spray") {
      const drops = this.p.drops || 10, [lo, hi] = this.p.dropSize || [0.02, 0.1];
      for (let i = 0; i < drops; i++) {
        const a = this.rnd() * Math.PI * 2, d = Math.sqrt(this.rnd()) * r * (this.p.scatter || 1);
        const ds = Math.max(1, s * (lo + (hi - lo) * this.rnd()));
        g.drawImage(tipCanvas(this.doc, { id: "drop", tip: "round", hardness: this.p.hardness }, ds, this.color),
          x + Math.cos(a) * d - ds / 2, y + Math.sin(a) * d - ds / 2);
      }
      return;
    }
    const tip = tipCanvas(this.doc, this.p, s, this.color);
    if (this.p.rotate) {
      const rot = (angle || 0) + (this.p.jitter ? (this.rnd() - 0.5) * Math.PI * this.p.jitter : 0);
      g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(tip, -tip.width / 2, -tip.height / 2); g.restore();
    } else g.drawImage(tip, x - tip.width / 2, y - tip.height / 2);
  };
  Stroke.prototype.directDab = function (x, y, s, flow) {
    if (typeof this.o.dab === "function") return this.o.dab(this.o.layer, x, y, Math.max(2, Math.round(s)), flow, this);
    const L = this.o.layer, g = L.getContext("2d"), n = Math.max(2, Math.round(s));
    const sx = Math.round(x - n / 2), sy = Math.round(y - n / 2);
    const tmp = this.doc.createElement("canvas"); tmp.width = n; tmp.height = n;
    const t = tmp.getContext("2d");
    if (this.p.engine === "blur") {
      t.filter = `blur(${Math.max(1, n / 10).toFixed(1)}px)`;
      t.drawImage(L, sx - 4, sy - 4, n + 8, n + 8, -4, -4, n + 8, n + 8);
      t.filter = "none";
    } else {                                            // smudge: the picked-up colour
      if (!this.pick) { this.pick = this.doc.createElement("canvas"); this.pick.width = n; this.pick.height = n;
        this.pick.getContext("2d").drawImage(L, sx, sy, n, n, 0, 0, n, n); }
      t.drawImage(this.pick, 0, 0, n, n);
    }
    t.globalCompositeOperation = "destination-in";
    t.drawImage(tipCanvas(this.doc, this.p, n, "#000000"), 0, 0, n, n);
    g.save(); g.globalAlpha = flow; g.drawImage(tmp, sx, sy); g.restore();
    if (this.p.engine === "smudge") {                  // pick up what is under the brush now
      const pg = this.pick.getContext("2d");
      if (this.pick.width !== n) { this.pick.width = n; this.pick.height = n; }
      pg.globalAlpha = 0.35; pg.drawImage(L, sx, sy, n, n, 0, 0, n, n); pg.globalAlpha = 1;
    }
  };
  Stroke.prototype.add = function (x, y, pressure) {
    // 2.484.0: smoothing (0..1): the brush follows the pointer on a string - steadier lines
    const sm = this.p.smoothing || 0;
    if (sm > 0) { if (!this.sm) this.sm = [x, y]; else { const k = 1 - Math.min(0.95, sm); this.sm = [this.sm[0] + (x - this.sm[0]) * k, this.sm[1] + (y - this.sm[1]) * k]; } x = this.sm[0]; y = this.sm[1]; }
    if (!this.last) { this.dab(x, y, pressure, 0); this.last = [x, y, pressure]; return; }
    const at = atPressure(this.p, this.size, this.flow, pressure);
    const step = Math.max(0.5, at.size * (this.p.spacing || 0.1));
    const r = dabs(this.last, [x, y], step, this.carry);
    const ang = Math.atan2(y - this.last[1], x - this.last[0]);
    const p0 = this.last[2];
    for (const [px, py, t] of r.pts) this.dab(px, py, p0 + (pressure - p0) * t, ang);
    this.carry = r.carry;
    this.last = [x, y, pressure];
  };
  /** Lay the stroke down, clipped to the selection. -> dirty rect or null */
  Stroke.prototype.end = function () {
    const L = this.o.layer, g = L.getContext("2d"), sel = this.o.selCanvas;
    if (!this.dirty) return null;
    const d = this.dirty, rect = { x: d.x0, y: d.y0, w: d.x1 - d.x0, h: d.y1 - d.y0 };
    if (this.direct) {
      if (sel) {                                        // outside the selection: the pixels from before
        const after = this.doc.createElement("canvas"); after.width = this.W; after.height = this.H;
        const a = after.getContext("2d"); a.drawImage(L, 0, 0);
        a.globalCompositeOperation = "destination-in"; a.drawImage(sel, 0, 0);
        const keep = this.doc.createElement("canvas"); keep.width = this.W; keep.height = this.H;
        const k = keep.getContext("2d"); k.drawImage(this.before, 0, 0);
        k.globalCompositeOperation = "destination-out"; k.drawImage(sel, 0, 0);
        g.clearRect(0, 0, this.W, this.H); g.drawImage(keep, 0, 0); g.drawImage(after, 0, 0);
      }
      return rect;
    }
    if (sel) { this.bg.globalAlpha = 1; this.bg.globalCompositeOperation = "destination-in"; this.bg.drawImage(sel, 0, 0); }
    g.save(); g.globalAlpha = this.opacity; g.globalCompositeOperation = this.blend; g.drawImage(this.buffer, 0, 0); g.restore();
    return rect;
  };

  const api = { PRESETS, byId, rng, atPressure, dabs, tipAlpha, BLENDS, compositeOf, hexRgb, Stroke, tipCanvas, sampleData };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IEBrushes = api;
})(typeof window !== "undefined" ? window : globalThis);
