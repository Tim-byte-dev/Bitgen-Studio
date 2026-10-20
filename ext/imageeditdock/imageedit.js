/* imageedit.js — THE IMAGE EDITOR: KRITA-STYLE, SELECTION FIRST, WITH AI (2.332.0).
 *
 * 2.108.0, Tim: "create another bottom docker below timeline docker for an
 * image editor, add select tools like krita has and the ability to generate
 * infill for the selection that blends with the rest of the image like
 * krita's ai diffusion plugin does."
 * 2.332.0, Tim: "are we able to make the editor docker like krita editor?"
 * -> "we just need about 20 brush presets, selections tools are the most
 * important, to select and edit via qwen edit, kontext or regenerate that
 * portion like krita ai diffusion does, https://github.com/Acly/krita-ai-
 * diffusion...our own version".
 *
 * THE DOCUMENT is a stack of LAYERS (canvases) with visibility, opacity and
 * blend modes, one SELECTION (a 0..255 mask of the picture's size - soft
 * after Feather), and an UNDO history that covers every pixel, selection,
 * layer and canvas change (Ctrl+Z / Ctrl+Shift+Z).
 *
 * SELECTION (the heart of it, as in Krita): rectangle, ellipse, freehand,
 * polygon, magic wand, selection brush; replace / add (Shift) / subtract
 * (Alt) / intersect (Shift+Alt); all, none, invert, grow, shrink, border,
 * smooth, feather, select-opaque; marching ants. Everything else respects
 * it: brushes only paint inside it, fill fills it, move lifts it, the AI
 * regenerates it.
 *
 * PAINT: 20 brush presets (brushes.js - round, soft, airbrush, pencil, ink,
 * marker, chalk, charcoal, watercolor, oil bristle, splatter, spray, texture,
 * glow, dodge, burn, smudge, blur, two erasers) with pen pressure; eraser,
 * fill, colour picker, move, pan/zoom.
 *
 * ✨ AI, the Krita AI Diffusion way (the server side is lib/aiEdit.js):
 *   Generate   / Refine (strength) / Remove / Background  with an inpaint style
 *   Edit       an instruction with Qwen Image Edit 2511, FLUX.1 Kontext or
 *              FLUX.2 Klein edit
 * The model never sees the whole picture: the selection's box padded by a
 * CONTEXT margin (or the whole picture for an Edit with nothing selected),
 * scaled down to the MP budget, is rendered; the answer comes back as a NEW
 * LAYER that holds the model's pixels only inside the FEATHERED selection.
 * Several results can be made at once and compared before one is applied.
 * Expand grows the canvas and selects the new strip for Generate.
 *
 * The pure parts (selection maths, feather, composite, hole fill, edges,
 * sizes) are plain functions on typed arrays, unit-tested in Node.
 *
 * 2.333.0, Tim: "yes, please build that [Krita-style control layers], can
 * you also add some photoshop like filters":
 *   ◈ CONTROL LAYERS - any layer can guide Generate / Refine / Remove /
 *     Background through a ControlNet: 8 types (scribble, line art, soft edge,
 *     canny, depth, normal, pose, segmentation), drawn by hand or ⟲ From
 *     image, each with strength, a start-end range and its ControlNet model.
 *   🎚 ADJUST / ✦ FILTER - 24 Photoshop-style adjustments and filters
 *     (filters.js) on the active layer, inside the selection, live preview,
 *     one undo step, Ctrl+F repeats.
 *
 * 2.389.0, Tim: "can we build our image editor to have the same functionality and look as
 * https://github.com/storytold/photocraft" (asked how: "Rebuild ours, in phases") - PhotoCraft is a clean-room
 * Photoshop, so the editor now LOOKS and WORKS like Photoshop: a menu bar (File Edit Image Layer Select Filter View
 * Window Help, every item a command - Ctrl+K finds any of them), the options bar, a tool column of Photoshop's tool
 * groups and keys (flyouts), and the right-hand panels (Color / Swatches, Properties / Adjustments / ✨ AI / Control,
 * Layers / History) in three themes (Pro dark, Studio light, Classic). The document gained Photoshop's layer kinds:
 * adjustment layers, groups, layer masks, clipping, fill opacity, locks, layer styles, text and shape layers, fill
 * layers. Split by job (the editor stays one mount):
 *   imageedit.js  this file - the document, history, selection, the canvas, the core tools, ✨ AI, filters
 *   pcdoc.js      the layer tree + the compositor (masks, clipping, adjustments, styles, groups)
 *   pctools.js    crop, gradient, clone / healing / spot healing / history brush, dodge / burn / sponge, blur /
 *                 sharpen / smudge, pencil, type, shapes, zoom, free transform, the Image menu's size / rotate / trim
 *   pcui.js       the menu bar + commands + shortcuts, the tool column, the options bar, the panels, the dialogs
 */
(function (root) {
  "use strict";

  /* ======================= pure helpers (tested in Node) ======================= */
  const P = {};

  /** Bounding box of a mask, or null when empty. {x,y,w,h} */
  P.bbox = function (mask, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };

  /** Pad a box by `margin` on every side, clamp to the picture, then snap the
   *  size UP to a multiple of `mult` (models want /16 or /64 sizes) without
   *  leaving the picture; returns {x,y,w,h}. */
  P.contextRect = function (box, w, h, margin, mult) {
    mult = mult || 16;
    let x = Math.max(0, box.x - margin), y = Math.max(0, box.y - margin);
    let x1 = Math.min(w, box.x + box.w + margin), y1 = Math.min(h, box.y + box.h + margin);
    let cw = x1 - x, ch = y1 - y;
    const up = (v, lim) => Math.min(lim, Math.ceil(v / mult) * mult);
    cw = up(cw, w); ch = up(ch, h);
    x = Math.max(0, Math.min(x, w - cw)); y = Math.max(0, Math.min(y, h - ch));
    return { x, y, w: cw, h: ch };
  };

  /** Cut the mask (0/255) to a box. Uint8Array of box.w*box.h. */
  P.cropMask = function (mask, w, box) {
    const out = new Uint8Array(box.w * box.h);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++)
      out[y * box.w + x] = mask[(box.y + y) * w + (box.x + x)];
    return out;
  };

  /** Feather: a soft edge `r` px wide INSIDE the selection (0..255 ramp), so
   *  the infill fades into the original instead of ending at a hard line.
   *  Separable box blur run twice ≈ Gaussian, then re-clamped so nothing
   *  outside the original selection gains weight (the model's pixels must not
   *  leak past the edge). Returns Uint8Array. */
  P.feather = function (mask, w, h, r) {
    if (!r || r < 1) return Uint8Array.from(mask);
    const f = new Float32Array(mask), tmp = new Float32Array(w * h);
    const blur = (src, dst, rad) => {
      // horizontal
      for (let y = 0; y < h; y++) {
        let acc = 0; const row = y * w;
        for (let x = -rad; x <= rad; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
          dst[row + x] = acc / (2 * rad + 1);
          acc += src[row + Math.min(w - 1, x + rad + 1)] - src[row + Math.max(0, x - rad)];
        }
      }
      // vertical
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -rad; y <= rad; y++) acc += dst[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
          src[y * w + x] = acc / (2 * rad + 1);
          acc += dst[Math.min(h - 1, y + rad + 1) * w + x] - dst[Math.max(0, y - rad) * w + x];
        }
      }
    };
    const rad = Math.max(1, Math.round(r / 2));
    blur(f, tmp, rad); blur(f, tmp, rad);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < out.length; i++) out[i] = mask[i] ? Math.min(255, Math.round(f[i])) : 0;
    return out;
  };


  /** Grow (r>0) / shrink (r<0) a mask by |r| px with a SQUARE structuring
   *  element - separable, via running counts, so it is O(pixels) whatever the
   *  radius (2.332.0: the old nested loop froze a 4K picture). */
  P.morph = function (mask, w, h, r) {
    if (!r) return Uint8Array.from(mask);
    const grow = r > 0, rad = Math.abs(r);
    const on = new Uint8Array(w * h);
    for (let i = 0; i < on.length; i++) on[i] = mask[i] ? 1 : 0;
    const pass = (src, dst, len, lines, idx) => {
      for (let l = 0; l < lines; l++) {
        let acc = 0;
        const at = (k) => (k < 0 || k >= len ? (grow ? 0 : 0) : src[idx(l, k)]);
        for (let k = -rad; k <= rad; k++) acc += at(k);
        for (let k = 0; k < len; k++) {
          // outside the picture counts as UNselected, so shrink eats the border
          const full = 2 * rad + 1;
          dst[idx(l, k)] = grow ? (acc > 0 ? 1 : 0) : (acc === full ? 1 : 0);
          acc += at(k + rad + 1) - at(k - rad);
        }
      }
    };
    const tmp = new Uint8Array(w * h), out1 = new Uint8Array(w * h);
    pass(on, tmp, w, h, (l, k) => l * w + k);
    pass(tmp, out1, h, w, (l, k) => k * w + l);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < out.length; i++) out[i] = out1[i] ? 255 : 0;
    return out;
  };


  /** Composite: dst (RGBA of the whole picture, w wide) gets src (RGBA of the
   *  crop box) blended in where fmask (crop-sized, 0..255) says. */
  P.composite = function (dst, w, src, box, fmask) {
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
      const a = fmask[y * box.w + x] / 255;
      if (!a) continue;
      const di = ((box.y + y) * w + (box.x + x)) * 4, si = (y * box.w + x) * 4;
      for (let c = 0; c < 3; c++) dst[di + c] = Math.round(dst[di + c] * (1 - a) + src[si + c] * a);
      dst[di + 3] = 255;
    }
    return dst;
  };

  /** Magic wand: flood-fill from (sx,sy) over pixels within `tol` (0..255,
   *  max channel difference) of the seed colour. Returns a 0/255 mask. */
  P.wand = function (rgba, w, h, sx, sy, tol, contiguous) {
    const out = new Uint8Array(w * h);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return out;
    const si = (sy * w + sx) * 4, r0 = rgba[si], g0 = rgba[si + 1], b0 = rgba[si + 2];
    const near = (i) => Math.abs(rgba[i * 4] - r0) <= tol && Math.abs(rgba[i * 4 + 1] - g0) <= tol && Math.abs(rgba[i * 4 + 2] - b0) <= tol;
    if (!contiguous) { for (let i = 0; i < w * h; i++) if (near(i)) out[i] = 255; return out; }
    const stack = [sy * w + sx]; out[stack[0]] = 255;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i - x) / w;
      const nb = [];
      if (x > 0) nb.push(i - 1); if (x < w - 1) nb.push(i + 1); if (y > 0) nb.push(i - w); if (y < h - 1) nb.push(i + w);
      for (const j of nb) if (!out[j] && near(j)) { out[j] = 255; stack.push(j); }
    }
    return out;
  };

  /** Rasterize a polygon (array of [x,y]) into a 0/255 mask (even-odd). */
  P.polygonMask = function (pts, w, h) {
    const out = new Uint8Array(w * h);
    if (pts.length < 3) return out;
    for (let y = 0; y < h; y++) {
      const xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi <= y + 0.5) !== (yj <= y + 0.5)) xs.push(xi + (y + 0.5 - yi) * (xj - xi) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(w - 1, Math.floor(xs[k + 1] - 0.5)); x++) out[y * w + x] = 255;
    }
    return out;
  };

  P.ellipseMask = function (cx, cy, rx, ry, w, h) {
    const out = new Uint8Array(w * h);
    if (rx < 0.5 || ry < 0.5) return out;
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(h - 1, Math.ceil(cy + ry)); y++)
      for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(w - 1, Math.ceil(cx + rx)); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) out[y * w + x] = 255;
      }
    return out;
  };

  P.rectMask = function (x0, y0, x1, y1, w, h) {
    const out = new Uint8Array(w * h);
    const a = Math.max(0, Math.min(x0, x1)), b = Math.min(w - 1, Math.max(x0, x1) - 1);
    const c = Math.max(0, Math.min(y0, y1)), d = Math.min(h - 1, Math.max(y0, y1) - 1);
    for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) out[y * w + x] = 255;
    return out;
  };

  /** Combine a new shape into the selection: replace | add | subtract |
   *  intersect (Krita: Shift add, Alt subtract, Shift+Alt intersect). */
  P.combine = function (sel, shape, mode) {
    if (mode === "add") { for (let i = 0; i < sel.length; i++) if (shape[i] > sel[i]) sel[i] = shape[i]; return sel; }
    if (mode === "subtract") { for (let i = 0; i < sel.length; i++) if (shape[i]) sel[i] = Math.max(0, sel[i] - shape[i]); return sel; }
    if (mode === "intersect") { for (let i = 0; i < sel.length; i++) sel[i] = Math.min(sel[i], shape[i]); return sel; }
    sel.set(shape); return sel;
  };

  P.count = (m) => { let n = 0; for (let i = 0; i < m.length; i++) if (m[i]) n++; return n; };

  /* ---- 2.332.0 additions (the Krita-style editor) ---- */
  P.invert = (m) => { const o = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) o[i] = 255 - m[i]; return o; };

  /** A ring |r| px wide around the selection's edge (Krita's Border). */
  P.border = function (mask, w, h, r) {
    const g = P.morph(mask, w, h, Math.abs(r) || 1), s = P.morph(mask, w, h, -(Math.abs(r) || 1));
    const o = new Uint8Array(w * h);
    for (let i = 0; i < o.length; i++) o[i] = g[i] && !s[i] ? 255 : 0;
    return o;
  };

  /** Smooth a hard selection's jaggies: feather both ways, then threshold. */
  P.smooth = function (mask, w, h, r) {
    const f = P.feather(P.morph(mask, w, h, Math.max(1, r)), w, h, Math.max(2, r * 2));
    const o = new Uint8Array(w * h);
    for (let i = 0; i < o.length; i++) o[i] = f[i] >= 128 ? 255 : 0;
    return o;
  };

  /** Shift a mask by (dx, dy) (the move tool carries the selection along). */
  P.shift = function (mask, w, h, dx, dy) {
    const o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const sy = y - dy; if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) { const sx = x - dx; if (sx >= 0 && sx < w) o[y * w + x] = mask[sy * w + sx]; }
    }
    return o;
  };

  /** Selection from a layer's alpha (Krita: Select Opaque). */
  P.fromAlpha = function (rgba, w, h, min) {
    const o = new Uint8Array(w * h), t = min == null ? 1 : min;
    for (let i = 0; i < o.length; i++) o[i] = rgba[i * 4 + 3] >= t ? rgba[i * 4 + 3] : 0;
    return o;
  };

  /** Grow the canvas: new size + where the old picture lands, per side. */
  P.expand = function (w, h, side, px) {
    const n = Math.max(0, Math.round(px) || 0);
    const l = side === "left" || side === "all" ? n : 0, r = side === "right" || side === "all" ? n : 0;
    const t = side === "top" || side === "all" ? n : 0, b = side === "bottom" || side === "all" ? n : 0;
    return { w: w + l + r, h: h + t + b, ox: l, oy: t };
  };

  /** The size to RENDER a crop at: at most `maxPixels`, snapped to `mult`,
   *  never upscaled. -> {w, h, scale} */
  P.fitSize = function (w, h, maxPixels, mult) {
    const m = mult || 16, cap = Math.max(64 * 64, maxPixels || 1048576);
    const k = Math.min(1, Math.sqrt(cap / (w * h)));
    const sw = Math.max(m, Math.round((w * k) / m) * m), sh = Math.max(m, Math.round((h * k) / m) * m);
    return { w: sw, h: sh, scale: sw / w };
  };

  /** Fill the masked hole of a crop from its surroundings (push-pull: a
   *  pyramid of the known pixels, averaged down and spread back up), so
   *  Remove and Expand hand the model a continuation instead of the object /
   *  an empty strip. rgba is modified in place; alpha becomes 255 in the hole. */
  P.fillHole = function (rgba, mask, w, h) {
    const lv = [{ w, h, c: new Float32Array(w * h * 3), a: new Float32Array(w * h) }];
    for (let i = 0; i < w * h; i++) {
      const known = !mask[i] && rgba[i * 4 + 3] > 0 ? 1 : 0;
      lv[0].a[i] = known;
      for (let k = 0; k < 3; k++) lv[0].c[i * 3 + k] = rgba[i * 4 + k] * known;
    }
    while (lv[lv.length - 1].w > 1 || lv[lv.length - 1].h > 1) {       // push: average down
      const s = lv[lv.length - 1], nw = Math.max(1, Math.ceil(s.w / 2)), nh = Math.max(1, Math.ceil(s.h / 2));
      const d = { w: nw, h: nh, c: new Float32Array(nw * nh * 3), a: new Float32Array(nw * nh) };
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        const si = y * s.w + x, di = (y >> 1) * nw + (x >> 1);
        d.a[di] += s.a[si];
        for (let k = 0; k < 3; k++) d.c[di * 3 + k] += s.c[si * 3 + k];
      }
      lv.push(d);
      if (lv.length > 20) break;
    }
    for (let L = lv.length - 2; L >= 0; L--) {                          // pull: fill the gaps from coarser
      const s = lv[L], up = lv[L + 1];
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        const i = y * s.w + x;
        if (s.a[i] >= 1) continue;
        const ui = Math.min(up.h - 1, y >> 1) * up.w + Math.min(up.w - 1, x >> 1);
        if (up.a[ui] <= 0) continue;
        const need = 1 - s.a[i];
        for (let k = 0; k < 3; k++) s.c[i * 3 + k] += (up.c[ui * 3 + k] / up.a[ui]) * need;
        s.a[i] = 1;
      }
    }
    const b = lv[0];
    for (let i = 0; i < w * h; i++) {
      if (!mask[i] && rgba[i * 4 + 3] > 0) continue;
      const a = b.a[i] || 1;
      for (let k = 0; k < 3; k++) rgba[i * 4 + k] = Math.round(b.c[i * 3 + k] / a);
      rgba[i * 4 + 3] = 255;
    }
    return rgba;
  };

  /** The selection's outline as axis-aligned segments [x0,y0,x1,y1] (runs
   *  merged) - the marching ants are ONE dashed path, not a per-pixel scan. */
  P.edges = function (m, w, h, thr) {
    const t = thr == null ? 128 : thr, on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] >= t;
    const seg = [];
    for (let y = 0; y <= h; y++) {                    // horizontal edges between row y-1 and y
      let start = -1;
      for (let x = 0; x <= w; x++) {
        const e = x < w && on(x, y - 1) !== on(x, y);
        if (e && start < 0) start = x;
        if (!e && start >= 0) { seg.push([start, y, x, y]); start = -1; }
      }
    }
    for (let x = 0; x <= w; x++) {                    // vertical edges between column x-1 and x
      let start = -1;
      for (let y = 0; y <= h; y++) {
        const e = y < h && on(x - 1, y) !== on(x, y);
        if (e && start < 0) start = y;
        if (!e && start >= 0) { seg.push([x, start, x, y]); start = -1; }
      }
    }
    return seg;
  };

  /** Alpha of a crop-sized patch from a 0..255 mask (the AI result's layer:
   *  the model's pixels only where the feathered selection says). */
  P.maskAlpha = function (rgba, fmask) {
    for (let i = 0; i < fmask.length; i++) rgba[i * 4 + 3] = Math.round(rgba[i * 4 + 3] * fmask[i] / 255);
    return rgba;
  };

  /* ======================= the editor ======================= */
  // selection tools (the six Krita-style ones, ids unchanged since 2.108.0)
  const TOOLS = [
    ["rect", "▭", "Rectangular Marquee (M)"],
    ["ellipse", "◯", "Elliptical Marquee (Shift+M)"],
    ["lasso", "〰", "Lasso (L)"],
    ["poly", "⬠", "Polygonal Lasso (Shift+L) — click points, double-click or Enter to close"],
    ["wand", "✨", "Magic Wand (W) — click a colour; Ctrl = every matching colour"],
    ["brush", "◎", "Quick Selection brush (Shift+W) — paint the selection; Alt erases"],
  ];
  const PAINT = [
    ["paint", "🖌", "Brush (B)"],
    ["erase", "⌫", "Eraser (E)"],
    ["fill", "🪣", "Paint Bucket (Shift+G)"],
    ["picker", "💉", "Eyedropper (I)"],
    ["move", "✥", "Move (V)"],
    ["hand", "✋", "Hand (H, or hold Space / middle button). Wheel zooms"],
  ];
  const MODES = [
    ["generate", "Generate", "Regenerate the selection from the prompt (100 %) — Krita's Fill / Add content"],
    ["refine", "Refine", "Rework the selection at a strength below 100 % — keeps the shapes, changes the detail"],
    ["remove", "Remove", "Remove what is selected and continue the surroundings (the prompt is optional)"],
    ["edit", "Edit", "Follow an instruction with an edit model — Qwen Image Edit, FLUX Kontext, Klein edit"],
    ["background", "Background", "Keep the selection, regenerate everything else"],
    ["compose", "Compose", "Layers as references: Ctrl-click layers in the Layers panel (in order - the first is the scene) and say what to make from them - Qwen Image Edit 2511 / Qwen Image 2.1 edit / Klein edit"],
  ];
  const BLEND_NAMES = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn",
    "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];

  /* THE LOOK (2.389.0): PhotoCraft / Photoshop - a flat, dense UI in three themes. The editor's own variables
     (--line, --dim, --tiger ...) are re-pointed at the theme inside .kx, so every older control follows it. */
  const CSS = `
  .kx{--pc-bg:#2b2b2b;--pc-panel:#323232;--pc-panel2:#3c3c3c;--pc-input:#232323;--pc-line:#1d1d1d;--pc-sep:#474747;--pc-text:#d6d6d6;--pc-dim:#9b9b9b;--pc-accent:#2680eb;--pc-hover:#454545;--pc-canvas:#1e1e1e;--pc-on:#1f4f86;
      --line:var(--pc-sep);--dim:var(--pc-dim);--tiger:var(--pc-accent);--text:var(--pc-text);--panel:var(--pc-panel);--panel-2:var(--pc-panel2);--card:var(--pc-panel);--bg:var(--pc-bg);
      display:flex;flex-direction:column;height:100%;min-height:0;font:12px/1.35 "Segoe UI",system-ui,-apple-system,sans-serif;color:var(--pc-text);background:var(--pc-bg);position:relative}
  .kx[data-theme=studio]{--pc-bg:#e6e6e6;--pc-panel:#f0f0f0;--pc-panel2:#ffffff;--pc-input:#ffffff;--pc-line:#c3c3c3;--pc-sep:#cdcdcd;--pc-text:#2b2b2b;--pc-dim:#6b6b6b;--pc-accent:#1473e6;--pc-hover:#dcdcdc;--pc-canvas:#c9c9c9;--pc-on:#cfe1fa}
  .kx[data-theme=classic]{--pc-bg:#535353;--pc-panel:#4a4a4a;--pc-panel2:#5c5c5c;--pc-input:#3a3a3a;--pc-line:#2f2f2f;--pc-sep:#626262;--pc-text:#ececec;--pc-dim:#bdbdbd;--pc-accent:#2d8ceb;--pc-hover:#5f5f5f;--pc-canvas:#282828;--pc-on:#2a5e9c}
  /* 2.393.0 (Tim: "when image editor use the bitgen titlebar and statusbar so it still looks like part of bitgen"): the
     bitGen theme (the default) - the app's own colours, its menu bar under the editor's title and its status bar */
  .kx[data-theme=bitgen]{--pc-bg:var(--th-ink,#14120f);--pc-panel:var(--th-panel,#1d1a15);--pc-panel2:var(--th-panel-2,#26221b);--pc-input:var(--th-ink,#14120f);--pc-line:var(--th-line,#3a342a);--pc-sep:var(--th-line,#3a342a);--pc-text:var(--th-text,#e8e2d6);--pc-dim:var(--th-dim,#9a917f);--pc-accent:var(--th-tiger,#f59e2c);--pc-hover:var(--th-ui-hover,#2f2a21);--pc-canvas:var(--th-ui-canvas,#0f0d0b);--pc-on:var(--th-ui-on,#4a3414);
      font-family:var(--body,"Segoe UI",system-ui,sans-serif)}
  .kx[data-theme=bitgen] .pcmenu{height:var(--mbar,36px);padding:0 10px;gap:2px;background:var(--pc-panel);border-bottom:1px solid var(--pc-line)}
  body.ie-full .kx .pcmenu .pcbrand{display:flex}
  .kx[data-theme=bitgen] .pcmenu .mi{height:26px;line-height:26px;padding:0 9px;border-radius:5px;font-size:.78rem;color:var(--pc-text)}
  .kx[data-theme=bitgen] .pcmenu .mi:hover,.kx[data-theme=bitgen] .pcmenu .mi.open{background:var(--pc-panel2);color:var(--pc-accent)}
  .kx[data-theme=bitgen] .pcmenu .mr{gap:6px}
  .kx[data-theme=bitgen] .pcmenu .mr button{height:24px;min-width:26px;padding:0 7px;font-size:.76rem;border:1px solid var(--pc-line);border-radius:5px;color:var(--pc-dim)}
  .kx[data-theme=bitgen] .pcmenu .mr button:hover,.kx[data-theme=bitgen] .pcmenu .mr button.on{border-color:var(--pc-accent);color:var(--pc-accent)}
  .kx[data-theme=bitgen] .kxstatus{height:var(--sbar,30px);display:flex;align-items:center;flex:none;padding:0 10px;font-size:.72rem;color:var(--pc-dim);background:var(--pc-panel);border-top:1px solid var(--pc-line)}
  .kx[data-theme=bitgen] .pcfly div:hover{color:#14120f}
  .kx[data-theme=bitgen] .kxdlg .ok{color:#14120f!important}
  .kx[data-theme=bitgen] .kxtools .ietool.on{color:var(--pc-accent)}
  .pcmenu .pcbrand{display:none;align-items:center;gap:7px;margin-right:10px;padding-right:12px;border-right:1px solid var(--pc-line);white-space:nowrap}
  .pcmenu .pcbrand .bi{color:var(--pc-accent);font-size:.8rem}
  .pcmenu .pcbrand .bn{font-family:var(--disp,"Arial Narrow",sans-serif);font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--pc-dim)}
  /* full screen keeps bitGen around it: the app's title bar, menu bar and status bar stay, the editor fills between */
  body.ie-full #imageeditdock:not(.dockgone){position:fixed!important;left:0;right:0;top:var(--mbar,36px);bottom:var(--sbar,30px);z-index:46;height:auto!important;max-height:none!important;margin:0;display:flex!important;flex-direction:column}
  body.shell.ie-full #imageeditdock{top:calc(32px + var(--mbar,36px))}
  body.ie-full #imageeditdock > .bbody{flex:1 1 auto;height:auto!important;min-height:0}
  body.ie-full #imageeditdock > .hsplit,body.ie-full #imageeditdock > .bhead{display:none}
  /* ... and its status line moves into bitGen's status bar (#sbIe) */
  body.ie-full .kx .kxstatus{display:none}
  #sbIe{display:none}
  body.ie-full #sbIe{display:block;flex:1;min-width:0;font-family:var(--mono,monospace);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text,#e8e2d6)}
  body.ie-full #sbIe::before{content:"Editor · ";color:var(--tiger,#f59e2c)}
  body.ie-full #statusbar .sblog{display:none}
  .kx button,.kx .ghost{background:var(--pc-panel2);color:var(--pc-text);border:1px solid var(--pc-line);border-radius:3px;font:inherit;cursor:pointer}
  .kx button:hover,.kx .ghost:hover{border-color:var(--pc-accent)}
  .kx select,.kx input[type=number],.kx input[type=text],.kx textarea{background:var(--pc-input);color:var(--pc-text);border:1px solid var(--pc-line);border-radius:3px}
  .kx input[type=range]{accent-color:var(--pc-accent)}
  .pcmenu{display:flex;align-items:center;gap:0;height:26px;flex:none;padding:0 4px;background:var(--pc-bg);border-bottom:1px solid var(--pc-line);user-select:none}
  .pcmenu .mi{padding:0 8px;height:22px;line-height:22px;border-radius:3px;cursor:default;white-space:nowrap}
  .pcmenu .mi:hover,.pcmenu .mi.open{background:var(--pc-hover)}
  .pcmenu .mr{margin-left:auto;display:flex;gap:3px;align-items:center}
  .pcmenu .mr button{height:20px;min-width:22px;padding:0 5px;font-size:11px;background:transparent;border-color:transparent}
  .pcmenu .mr button:hover{border-color:var(--pc-sep)}
  .kxbar{display:flex;flex-wrap:wrap;gap:5px;align-items:center;min-height:30px;padding:2px 8px;border-bottom:1px solid var(--pc-line);background:var(--pc-panel)}
  .kxbar .sep{width:1px;height:18px;background:var(--pc-sep);margin:0 3px}
  .kxbar label{display:flex;gap:4px;align-items:center;color:var(--pc-dim)}
  .kxbar input[type=range]{width:78px}
  .kxbar input[type=number]{width:52px}
  .kxbar .tn{font-weight:600;color:var(--pc-text);min-width:84px;display:flex;gap:6px;align-items:center}
  .kxmain{flex:1 1 auto;display:flex;min-height:0}
  .kxtools{flex:none;width:40px;display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 2px;border-right:1px solid var(--pc-line);background:var(--pc-panel);overflow:auto}
  .kxtools .ietool{position:relative;width:32px;height:28px;padding:0;font-size:15px;line-height:1;background:transparent;border:1px solid transparent;border-radius:3px;display:flex;align-items:center;justify-content:center}
  .kxtools .ietool svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
  .kxtools .ietool:hover{background:var(--pc-hover)}
  .kxtools .ietool.on{background:var(--pc-on);border-color:var(--pc-accent);color:#fff}
  .kxtools .ietool.grp::after{content:"";position:absolute;right:2px;bottom:2px;border:3px solid transparent;border-right-color:var(--pc-dim);border-bottom-color:var(--pc-dim)}
  .kxtools .gap{height:5px;flex:none;width:26px;border-bottom:1px solid var(--pc-sep);margin-bottom:4px}
  .kxsw{position:relative;width:36px;height:42px;flex:none;margin-top:6px}
  .kxsw input{position:absolute;width:22px;height:22px;padding:0;border:1px solid #000;box-shadow:0 0 0 1px #9a917f;border-radius:2px;cursor:pointer;background:none}
  .kxsw .fg{left:1px;top:1px;z-index:2}.kxsw .bg{left:12px;top:13px}
  .kxsw.fgnone .fg{background:linear-gradient(to top right,transparent calc(50% - 1px),#e02020 calc(50% - 1px),#e02020 calc(50% + 1px),transparent calc(50% + 1px)),repeating-conic-gradient(#bbb 0 25%,#fff 0 50%) 0 0/8px 8px!important}.kxsw.fgnone .fg::-webkit-color-swatch{opacity:0}
  .kxsw .sx,.kxsw .sd{position:absolute;width:13px;height:13px;font-size:11px;line-height:12px;color:var(--pc-text,#e8e2d6);cursor:pointer;background:var(--pc-panel);border:1px solid var(--pc-line);border-radius:3px;padding:0;text-align:center}
  .kxsw .sx:hover,.kxsw .sd:hover{color:var(--pc-accent);border-color:var(--pc-accent)}
  .kxsw .sx{right:-1px;top:0;z-index:3}.kxsw .sd{left:0;bottom:-3px;z-index:3;font-size:9px}
  .kxtools .qm{margin-top:6px;width:26px;height:22px;font-size:11px;padding:0}
  .kxtools .qm.on{background:#a33;color:#fff}
  .pcfly{position:absolute;z-index:70;background:var(--pc-panel);border:1px solid var(--pc-line);box-shadow:0 6px 18px rgba(0,0,0,.45);padding:3px 0;min-width:200px}
  .pcfly div{display:flex;gap:8px;align-items:center;padding:4px 10px;cursor:default;white-space:nowrap}
  .pcfly div:hover{background:var(--pc-accent);color:#fff}
  .pcfly div.on::before{content:"■";font-size:8px}
  .pcfly .k{margin-left:auto;color:var(--pc-dim)}
  .pcfly div:hover .k{color:#fff}
  .kxstage{flex:1 1 auto;position:relative;overflow:hidden;outline:none;background:var(--pc-canvas);touch-action:none}
  .kxpaper{position:absolute;left:0;top:0;transform-origin:0 0;background:repeating-conic-gradient(#cfcfcf 0 25%,#fff 0 50%) 0 0/16px 16px;box-shadow:0 0 0 1px rgba(0,0,0,.4),0 4px 18px rgba(0,0,0,.35)}
  .kxpaper canvas{position:absolute;left:0;top:0}
  .kxpaper .ov{pointer-events:none}
  .kxpaper.px canvas{image-rendering:pixelated}
  .kxhint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--pc-dim);text-align:center;padding:20px;pointer-events:none;font-size:12px}
  .pcruler{position:absolute;z-index:5;background:var(--pc-panel);pointer-events:none;display:none}
  .kx.rulers .pcruler{display:block}
  .pcruler.h{left:0;right:0;top:0;height:16px;border-bottom:1px solid var(--pc-line)}
  .pcruler.v{left:0;top:0;bottom:0;width:16px;border-right:1px solid var(--pc-line)}
  .pctext{position:absolute;z-index:6;background:transparent;border:1px dashed var(--pc-accent);outline:none;resize:none;overflow:hidden;white-space:pre;padding:0;margin:0;transform-origin:0 0;color:transparent;caret-color:var(--pc-accent)}
  .kxside{flex:none;width:300px;border-left:1px solid var(--pc-line);overflow:auto;display:flex;flex-direction:column;background:var(--pc-bg);gap:4px;padding:4px 0}
  .pcgrp{background:var(--pc-panel);border-top:1px solid var(--pc-line);border-bottom:1px solid var(--pc-line);display:flex;flex-direction:column;min-height:0}
  .pcgrp.off{display:none}
  .pctabs{display:flex;gap:0;background:var(--pc-bg);border-bottom:1px solid var(--pc-line);flex:none;overflow-x:auto;scrollbar-width:none}
  .pctabs button{background:transparent;border:0;border-radius:0;padding:4px 8px;color:var(--pc-dim);font-weight:600;font-size:11px;white-space:nowrap;flex:none}
  .pctabs button.on{background:var(--pc-panel);color:var(--pc-text);box-shadow:inset 0 2px 0 var(--pc-accent)}
  .pctabs button.off{display:none}
  .pcbody{display:none;padding:6px 8px;min-height:0;overflow:auto}
  .pcbody.on{display:block}
  .kxsec{padding:0}
  .kxsec h4{display:none}
  .kxmodes{display:flex;flex-wrap:wrap;gap:2px;margin-bottom:4px}
  .kxmodes button{flex:1 1 auto;padding:2px 4px;font-size:11px}
  .kxtools button.on,.kxbar button.on,.kxmodes button.on{border-color:var(--pc-accent);color:var(--pc-accent)}
  .kxrow{display:flex;gap:4px;align-items:center;margin:3px 0;color:var(--pc-dim);flex-wrap:wrap}
  .kxrow select{max-width:180px;flex:1 1 auto}
  .kxrow input[type=number]{width:52px}
  .kxsec textarea{width:100%;box-sizing:border-box;min-height:44px;resize:vertical;font:inherit}
  .kxrun{width:100%;margin-top:4px;border-color:var(--pc-accent)!important;background:var(--pc-accent)!important;color:#fff!important;font-weight:600}
  .kxres{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
  .kxres canvas{width:62px;height:62px;object-fit:contain;border:1px solid var(--pc-line);cursor:pointer;background:#111}
  .kxres canvas.on{border-color:var(--pc-accent)}
  .kxres .kxth{position:relative;display:inline-block;line-height:0}.kxres .kxthok{position:absolute;right:2px;bottom:2px;padding:0 4px;font-size:11px;line-height:16px;min-width:0;background:var(--pc-accent);color:#fff;border:0;border-radius:3px;cursor:pointer;opacity:.85}.kxres .kxthok:hover{opacity:1}
  .kxres .wait{width:62px;height:62px;border:1px dashed var(--pc-sep);display:flex;align-items:center;justify-content:center;color:var(--pc-dim)}
  .kxlayers{display:flex;flex-direction:column;gap:0;max-height:300px;min-height:60px;overflow:auto;background:var(--pc-input);border:1px solid var(--pc-line)}
  .kxlayer{display:flex;align-items:center;gap:4px;padding:2px 4px;border-bottom:1px solid var(--pc-line);cursor:default;min-height:30px;user-select:none}
  .kxlayer.on{background:var(--pc-on)}
  .kxlayer.pick{box-shadow:inset 3px 0 0 #e0a030;background:color-mix(in srgb,var(--pc-on) 65%,transparent)}
  .kxlayer .pkb{flex:none;min-width:16px;height:16px;border-radius:8px;background:#e0a030;color:#111;font:700 10px/16px sans-serif;text-align:center;margin-left:4px}
  .kxlayer.drop-top{box-shadow:inset 0 2px 0 var(--pc-accent)}.kxlayer.drop-bottom{box-shadow:inset 0 -2px 0 var(--pc-accent)}.kxlayer.drop-in{outline:1px solid var(--pc-accent)}
  .kxlayer canvas{width:36px;height:26px;background:repeating-conic-gradient(#bbb 0 25%,#fff 0 50%) 0 0/8px 8px;flex:none;border:1px solid var(--pc-line)}
  .kxlayer canvas.sel{outline:2px solid var(--pc-text);outline-offset:-1px}
  .kxlayer canvas.mk{background:#000}
  .kxlayer canvas.mk.off{opacity:.45}
  .kxlayer .ic{width:36px;height:26px;flex:none;display:flex;align-items:center;justify-content:center;font-size:15px;border:1px solid var(--pc-line);background:var(--pc-panel2)}
  .kxlayer .nm{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kxlayer .eye{width:20px;padding:0;border:0;background:transparent;cursor:pointer;color:var(--pc-text)}
  .kxlayer .tw{width:12px;padding:0;border:0;background:transparent;color:var(--pc-dim);cursor:pointer;font-size:9px}
  .kxlayer .clip{color:var(--pc-dim);font-size:11px}
  .kxlayer .fx{font-style:italic;color:var(--pc-dim);font-size:11px;cursor:pointer}
  .kxlayer .lk{font-size:10px;color:var(--pc-dim)}
  .kxlayer .lb{width:4px;align-self:stretch;flex:none}
  .kxlbtns{display:flex;gap:1px;flex-wrap:wrap;margin-top:4px;justify-content:flex-end}
  .kxlbtns button{padding:0 3px;min-width:22px;height:22px}
  .pclocks{display:flex;gap:3px;align-items:center;color:var(--pc-dim);margin:3px 0}
  .pclocks button{padding:0 4px;height:20px;font-size:11px}
  .pclocks button.on{border-color:var(--pc-accent);color:var(--pc-accent)}
  .kxpop{position:absolute;z-index:50;background:var(--pc-panel);border:1px solid var(--pc-line);padding:6px;display:grid;grid-template-columns:repeat(4,86px);gap:4px;box-shadow:0 6px 18px rgba(0,0,0,.5)}
  .kxpop .pb{display:flex;flex-direction:column;align-items:center;gap:2px;padding:3px;border:1px solid var(--pc-line);cursor:pointer;font-size:10px;text-align:center}
  .kxpop .pb.on{border-color:var(--pc-accent)}
  .kxpop .pb canvas{width:78px;height:30px;background:#e8e4dc}
  .kx.side-off .kxside{display:none}
  .kx.tools-off .kxtools,.kx.opts-off .kxbar{display:none}
  .kx:fullscreen{background:var(--pc-bg)}
  .kx.narrow .kxside{position:absolute;right:0;top:56px;bottom:20px;z-index:20;box-shadow:-6px 0 16px rgba(0,0,0,.5)}
  .kx.narrow.side-off .kxside{display:none}
  .kx select,.kx input[type=number],.kx input[type=text]{width:auto;min-width:0;height:22px;padding:0 4px;font-size:11px;line-height:20px;box-sizing:border-box}
  .kx input[type=number]{width:54px}
  .kx .kxrow select{flex:1 1 90px;max-width:190px}
  .kx button.ghost{padding:2px 6px;font-size:11px;min-height:22px}
  .kx textarea{font-size:11px;padding:4px}
  .kxctl{border:1px solid var(--pc-sep);border-radius:3px;padding:4px;margin-bottom:4px}
  .kxctl.off{opacity:.55}
  .kxctl .hd{display:flex;gap:4px;align-items:center}
  .kxctl .hd .nm{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
  .kxctl .rg{display:grid;grid-template-columns:52px 1fr 34px;gap:2px 4px;align-items:center;color:var(--pc-dim);margin-top:3px}
  .kxctl .rg input[type=range]{width:100%}
  .kxmenu{position:absolute;z-index:60;background:var(--pc-panel);border:1px solid var(--pc-line);padding:3px 0;min-width:220px;box-shadow:0 6px 18px rgba(0,0,0,.5);max-height:80vh;overflow:auto}
  .kxmenu div{display:flex;gap:16px;padding:4px 14px 4px 22px;cursor:default;white-space:nowrap}
  .kxmenu div .k{margin-left:auto;color:var(--pc-dim)}
  .kxmenu div.sub::after{content:"▸";margin-left:auto;color:var(--pc-dim)}
  .kxmenu div.dis{color:var(--pc-dim);opacity:.6}
  .kxmenu div.chk::before{content:"✓";position:absolute;margin-left:-14px}
  .kxmenu div:not(.dis):hover,.kxmenu div.open{background:var(--pc-accent);color:#fff}
  .kxmenu div:not(.dis):hover .k{color:#fff}
  .kxmenu hr{border:0;border-top:1px solid var(--pc-sep);margin:3px 0}
  .kxdlg{position:fixed;z-index:10060;left:50%;top:50%;transform:translate(-50%,-50%);width:290px;background:var(--pc-panel);border:1px solid var(--pc-line);border-radius:4px;padding:0 0 8px;box-shadow:0 10px 30px rgba(0,0,0,.55)}
  .kxdlg.wide{width:560px}
  .kxdlg h4{margin:0 0 6px;padding:6px 10px;font-size:12px;color:var(--pc-text);background:var(--pc-bg);border-bottom:1px solid var(--pc-line);cursor:move}
  .kxdlg .rw{display:grid;grid-template-columns:1fr 54px;gap:2px 6px;align-items:center;margin:4px 10px;color:var(--pc-dim)}
  .kxdlg .rw label{grid-column:1/3}
  .kxdlg .rw input[type=range]{width:100%}
  .kxdlg .bt{display:flex;gap:4px;justify-content:flex-end;margin:8px 10px 0;align-items:center}
  .kxdlg .ok{background:var(--pc-accent)!important;color:#fff!important;border-color:var(--pc-accent)!important}
  .pccurve{display:block;width:256px;height:256px;margin:4px auto;background:var(--pc-input);border:1px solid var(--pc-line);cursor:crosshair;touch-action:none}
  .kxstatus{font-size:11px;color:var(--pc-dim);padding:2px 8px;border-top:1px solid var(--pc-line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--pc-panel)}`;

  let uid = 0;
  function mount(host, api) {
    if (!host || host.dataset.mounted) return null;
    host.dataset.mounted = "1";
    const doc = host.ownerDocument || document;
    const win = doc.defaultView || root;
    const B = win.IEBrushes || (typeof require === "function" ? require("./brushes.js") : null);
    const D = win.PCDoc || (typeof require === "function" ? require("./pcdoc.js") : null);
    if (!doc.getElementById("kxCss")) { const st = doc.createElement("style"); st.id = "kxCss"; st.textContent = CSS; doc.head.appendChild(st); }
    const store = {
      get(k, d) { try { const v = win.localStorage.getItem("kx." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
      set(k, v) { try { win.localStorage.setItem("kx." + k, JSON.stringify(v)); } catch { /* private window */ } },
      /* 2.393.0: the bitGen theme once, for everyone (Window ▸ Theme still picks Pro / Studio / Classic after) */
      migrate() { if (this.get("themeV", 0) < 393) { this.set("theme", "bitgen"); this.set("themeV", 393); } },
    };
    store.migrate();
    const S = {
      w: 0, h: 0, name: "", layers: [], active: 0, sel: null, selVer: 0,
      tool: "rect", mode: "replace", tol: 32, selBrush: 24, feather: 24, context: 64, res: 1, count: 1, strength: 50,
      aiMode: "generate", zoom: 1, panX: 0, panY: 0, pts: [], drag: null, busy: false,
      fg: store.get("fg", "#000000"), bg: store.get("bg", "#ffffff"),
      preset: store.get("preset", "basic"), size: null, opacity: null, flow: null,
      undo: [], redo: [], stroke: null, float: null, results: [], preview: null, lastPaint: null, space: false,
      // 2.389.0
      maskEdit: false, qm: null, histSrc: new Map(), lastSel: null, autoSelect: store.get("autosel", false),
      sampleAll: store.get("sampleall", true), contiguous: true,
    };
    const P2 = B ? B.byId(S.preset) : null;
    S.size = store.get("size." + S.preset, P2 ? P2.size : 24);
    S.opacity = store.get("opacity." + S.preset, P2 ? P2.opacity : 1);
    S.flow = store.get("flow." + S.preset, P2 ? P2.flow : 1);

    const tab = (grp, id, label, on) => `<button type="button" data-tab="${id}" data-grp="${grp}"${on ? ' class="on"' : ""}>${label}</button>`;
    host.innerHTML = `
      <div class="kx" data-theme="${store.get("theme", "bitgen")}">
        <div class="pcmenu" id="pcMenu">
          <span class="pcbrand" title="bitGen Studio - image editor"><span class="bi">▦</span><span class="bn">Image editor</span></span>
          <span id="pcMenus" style="display:contents"></span>
          <span class="mr">
            <button class="ghost" id="kxUndo" title="Undo (Ctrl+Z)">↶</button>
            <button class="ghost" id="kxRedo" title="Redo (Ctrl+Shift+Z)">↷</button>
            <button class="ghost" id="kxZout" title="Zoom out (Ctrl+-)">−</button>
            <span id="kxZoom" style="min-width:38px;text-align:center;color:var(--pc-dim);font-size:11px">100%</span>
            <button class="ghost" id="kxZin" title="Zoom in (Ctrl++)">+</button>
            <button class="ghost" id="kxFit" title="Fit on screen (Ctrl+0)">⤢</button>
            <button class="ghost" id="kx100" title="100 % (Ctrl+1)">1:1</button>
            <button class="ghost" id="ieOpen" title="Open a picture (Ctrl+O; or drop one onto the canvas; Shift+drop adds it as a layer)">📂</button>
            <button class="ghost" id="ieSave" title="Save the picture (all visible layers) into the project's Images (Ctrl+S)">💾</button>
            <button class="ghost" id="kxFull" title="Full screen editor (F; Esc leaves)">⛶</button>
            <button class="ghost" id="kxPanel" title="Show / hide the panels (Tab)">▤</button>
          </span>
        </div>
        <div class="kxbar" id="kxBar"><span class="tn" id="pcToolName"></span><span class="sep"></span><span id="kxOpts" style="display:contents"></span></div>
        <div class="kxmain">
          <div class="kxtools" id="kxTools">
            <div class="kxsw" title="Foreground / background colour (X swaps, D = default black / white)">
              <input type="color" class="fg" id="kxFg"><input type="color" class="bg" id="kxBg">
              <button class="sx" id="kxSwap" title="Swap (X)">⇄</button><button class="sd" id="kxDef" title="Default colours (D)">◩</button>
            </div>
          </div>
          <div class="kxstage" id="ieStage" tabindex="0">
            <div class="pcruler h"><canvas id="pcRulerH"></canvas></div><div class="pcruler v"><canvas id="pcRulerV"></canvas></div>
            <div class="kxhint" id="ieHint">Drop a picture here (gallery, assets, refs or a file), File ▸ Open (Ctrl+O) or File ▸ New (Ctrl+N).<br>Select an area, then ✨ Generate / Refine / Remove / Edit it with AI — or paint, adjust and compose it by hand.</div>
            <div class="kxpaper" id="kxPaper"><canvas id="ieCanvas"></canvas><canvas id="ieOverlay" class="ov"></canvas></div>
          </div>
          <div class="kxside" id="pcPanels">
            <div class="pcgrp" data-g="color">
              <div class="pctabs">${tab("color", "pcColor", "Color", true)}${tab("color", "pcSwatches", "Swatches")}${tab("color", "pcChar", "Character")}${tab("color", "pcPara", "Paragraph")}</div>
              <div class="pcbody on" data-body="pcColor" id="pcColor"></div>
              <div class="pcbody" data-body="pcSwatches" id="pcSwatches"></div>
              <div class="pcbody" data-body="pcChar" id="pcChar"></div>
              <div class="pcbody" data-body="pcPara" id="pcPara"></div>
            </div>
            <div class="pcgrp off" data-g="dock">
              <div class="pctabs">${tab("dock", "dkXf", "Transform", true)}${tab("dock", "dkShape", "Shaping")}${tab("dock", "dkAlign", "Align")}${tab("dock", "dkProps", "Object")}</div>
              <div class="pcbody on" data-body="dkXf" id="dkXf"></div>
              <div class="pcbody" data-body="dkShape" id="dkShape"></div>
              <div class="pcbody" data-body="dkAlign" id="dkAlign"></div>
              <div class="pcbody" data-body="dkProps" id="dkProps"></div>
            </div>
            <div class="pcgrp" data-g="props">
              <div class="pctabs">${tab("props", "pcProps", "Properties", true)}${tab("props", "pcAdjs", "Adjustments")}${tab("props", "kxAi", "✨ AI")}${tab("props", "kxCtl", "◈ Control")}</div>
              <div class="pcbody on" data-body="pcProps" id="pcProps"></div>
              <div class="pcbody" data-body="pcAdjs" id="pcAdjs"></div>
              <div class="pcbody kxsec" data-body="kxAi" id="kxAi">
                <h4>✨ AI</h4>
                <div class="kxmodes" id="kxModes">${MODES.map(([id, label, tip]) => `<button class="ghost" data-mode="${id}" title="${tip}">${label}</button>`).join("")}</div>
                <textarea id="iePrompt" placeholder="What should appear in the selection (empty = the main prompt box)"></textarea>
                <div class="kxrow" id="kxRowStyle"><span>style</span><select id="ieStyle" title="The image style Regenerate / Refine / Remove render with (its inpaint graph, model and LoRAs — Settings → Image)"></select></div>
                <div class="kxrow" id="kxRowEdit"><span>model</span><select id="ieEditStyle" title="The edit model: Qwen Image Edit 2511, FLUX.1 Kontext, FLUX.2 Klein edit"></select></div>
                <div class="kxrow" id="kxRowPicks" style="display:none" title="Ctrl-click layers in the Layers panel to pick them, in order: 1 = the scene, 2 and 3 = what to bring in">
                  <span id="kxPicksTxt" style="flex:1;color:var(--pc-dim)">Ctrl-click layers to pick them (1 = the scene)</span>
                  <button class="ghost" id="kxPicksRefs" title="The picked layers into the reference dock - Generate in the prompt docker uses them">→ References</button>
                  <button class="ghost" id="kxPicksClear" title="Un-pick them all">✕</button>
                </div>
                <div class="kxrow" id="kxRowRef" style="display:none" title="2.539.0: a picture from the References docker goes with the Edit as Picture 2 - &quot;put the lamp from Picture 2 on the table&quot;"><span>reference</span><select id="kxRef"><option value="">- none -</option></select></div>
                <div class="kxrow" id="kxRowStrength"><span>strength</span><input type="range" id="kxStrength" min="5" max="95" step="5"><span id="kxStrengthV"></span></div>
                <div class="kxrow"><span title="Results to make (each is its own render, next seeds)">results</span>
                  <select id="kxCount">${[1, 2, 3, 4].map((n) => `<option>${n}</option>`).join("")}</select>
                  <span title="Surrounding picture the model sees around the selection (px)">context</span><input type="number" id="ieContext" min="0" max="1024">
                </div>
                <div class="kxrow"><span title="Soft edge inside the selection where the result blends in (px)">feather</span><input type="number" id="ieFeather" min="0" max="256">
                  <span title="The most megapixels a crop is rendered at (bigger crops are scaled down, the result scaled back up)">MP</span>
                  <select id="kxRes">${[0.5, 1, 1.5, 2, 3].map((n) => `<option value="${n}">${n}</option>`).join("")}</select>
                </div>
                <button class="ghost kxrun" id="kxRun">✨ Generate</button>
                <div class="kxres" id="kxResults"></div>
                <div class="kxrow" id="kxResBtns" style="display:none">
                  <button class="ghost" id="kxApply" title="Keep the shown result as a new layer (Enter)">✔ Apply as layer</button>
                  <button class="ghost" id="kxDiscard" title="Throw the results away (Esc)">✕ Discard</button>
                </div>
                <div class="kxrow" style="margin-top:6px" title="Grow the canvas and select the new strip - then ✨ Generate continues the picture into it">
                  <span>expand</span>
                  <select id="kxExpSide"><option value="all">all sides</option><option value="left">left</option><option value="right">right</option><option value="top">top</option><option value="bottom">bottom</option></select>
                  <input type="number" id="kxExpPx" min="16" max="2048" value="256">
                  <button class="ghost" id="kxExpand">⤢ Expand</button>
                </div>
              </div>
              <div class="pcbody kxsec" data-body="kxCtl" id="kxCtl">
                <h4 title="Krita-style control layers: a layer that guides Generate / Refine / Remove with a ControlNet - drawn by hand, or made from the picture">◈ Control layers</h4>
                <div id="kxCtlList"></div>
                <div class="kxrow">
                  <select id="kxCtlType" title="The control type for a new control layer"></select>
                  <button class="ghost" id="kxCtlAdd" title="A new, empty control layer of this type above the active layer - draw on it (black lines for scribble / line art / edges)">＋ layer</button>
                  <button class="ghost" id="kxCtlMake" title="Make the ACTIVE layer a control layer of this type">◈ active</button>
                </div>
              </div>
            </div>
            <div class="pcgrp" data-g="layers" style="flex:1 1 auto">
              <div class="pctabs">${tab("layers", "pcLayers", "Layers", true)}${tab("layers", "pcPaths", "Paths")}${tab("layers", "pcChannels", "Channels")}${tab("layers", "pcHistory", "History")}${tab("layers", "pcActions", "Actions")}${tab("layers", "pcComps", "Comps")}</div>
              <div class="pcbody on" data-body="pcLayers" id="pcLayers">
                <div class="kxrow"><select id="kxBlend" title="Blend mode">${BLEND_NAMES.map((b) => `<option value="${b}">${b.replace(/(^|-)([a-z])/g, (m, a, c) => (a ? " " : "") + c.toUpperCase())}</option>`).join("")}</select>
                  <span title="Layer opacity">Opacity</span><input type="number" id="kxLOpacityN" min="0" max="100" style="width:46px"><input type="range" id="kxLOpacity" min="0" max="100" title="Layer opacity" style="width:60px"><span id="kxLOpacityV" style="display:none"></span></div>
                <div class="pclocks" id="pcLocks"><span>Lock:</span>
                  <button class="ghost" data-lock="alpha" title="Lock transparent pixels - paint only where there already are pixels">▦</button>
                  <button class="ghost" data-lock="px" title="Lock image pixels - no painting or filters">🖌</button>
                  <button class="ghost" data-lock="pos" title="Lock position - no moving">✥</button>
                  <button class="ghost" data-lock="all" title="Lock all">🔒</button>
                  <span style="margin-left:auto" title="Fill opacity - the pixels, not the layer styles">Fill</span><input type="number" id="pcFill" min="0" max="100" style="width:46px">
                </div>
                <div class="kxlayers" id="kxLayers"></div>
                <div class="kxlbtns">
                  <button class="ghost" id="kxLFx" title="Add a layer style (fx)">fx</button>
                  <button class="ghost" id="kxLMask" title="Add a layer mask (from the selection when there is one)">◫</button>
                  <button class="ghost" id="kxLAdjBtn" title="New fill or adjustment layer">◐</button>
                  <button class="ghost" id="kxLGroup" title="New group (Ctrl+G groups the active layer)">🗀</button>
                  <button class="ghost" id="kxLAdd" title="New layer (Ctrl+Shift+N)">＋</button>
                  <button class="ghost" id="kxLDup" title="Duplicate layer">⧉</button>
                  <button class="ghost" id="kxLCopy" title="Layer via copy - the selection on a new layer (Ctrl+J)">⎘</button>
                  <button class="ghost" id="kxLUp" title="Bring forward (Ctrl+])">▲</button>
                  <button class="ghost" id="kxLDown" title="Send backward (Ctrl+[)">▼</button>
                  <button class="ghost" id="kxLMerge" title="Merge down (Ctrl+E)">⤓</button>
                  <button class="ghost" id="kxLDel" title="Delete layer">🗑</button>
                </div>
              </div>
              <div class="pcbody" data-body="pcPaths" id="pcPaths"></div>
              <div class="pcbody" data-body="pcChannels" id="pcChannels"></div>
              <div class="pcbody" data-body="pcHistory" id="pcHistory"></div>
              <div class="pcbody" data-body="pcActions" id="pcActions"></div>
              <div class="pcbody" data-body="pcComps" id="pcComps"></div>
            </div>
          </div>
        </div>
        <div class="kxstatus" id="ieStatus"></div>
        <input type="file" id="ieFile" accept="image/*,.jxl" class="hidden" style="display:none">
      </div>`;
    const $ = (id) => host.querySelector("#" + id);
    const kx = host.querySelector(".kx");
    const stage = $("ieStage"), paper = $("kxPaper"), cv = $("ieCanvas"), ov = $("ieOverlay"), status = $("ieStatus");
    const say = (t) => { status.textContent = t; };
    const newCanvas = (w, h) => { const c = doc.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
    const ctx = (c) => (c && c.getContext ? c.getContext("2d") : null);
    const layer = () => S.layers[S.active] || null;
    const hasSel = () => !!(S.sel && S.selCount);
    const FX = win.IEFilters || (typeof require === "function" ? require("./filters.js") : null);
    const E = { S, P, B, D, FX, doc, win, host, kx, $, say, store, newCanvas, ctx, layer, hasSel, stage, cv, ov, paper,
                tools: {}, overlayHooks: [], ui: {}, BLEND_NAMES, TOOLS, PAINT };

    /* ---------------- layers: the objects ---------------- */
    function makeLayer(name, w, h, type) {
      return { id: ++uid, name, type: type || "pixel", canvas: newCanvas(w || S.w, h || S.h), visible: true, opacity: 1, fillOpacity: 1,
               blend: type === "group" ? "pass-through" : "normal", control: null, parent: null, clip: false, locks: {}, styles: null,
               mask: null, label: "none", open: true, ver: 0 };
    }
    function newMask(fill, w, h) {
      const c = newCanvas(w || S.w, h || S.h), g = ctx(c);
      if (g) { g.fillStyle = fill || "#ffffff"; g.fillRect(0, 0, c.width, c.height); }
      return { canvas: c, on: true, density: 1, feather: 0, linked: true, ver: 0 };
    }
    /** what a paint / fill / filter on the active layer changes: its mask while the mask is the target, else its pixels */
    function target(L) {
      L = L || layer(); if (!L) return null;
      if (S.qm) return S.qm;
      if (S.fmaskEdit && L.fmask) return L.fmask.canvas;            // 2.422.0: a smart object's FILTER mask (pcsmart.js)
      if (L.mask && (S.maskEdit || L.type === "adjust" || L.type === "fill")) return L.mask.canvas;
      return L.type === "pixel" ? L.canvas : null;
    }
    const onMask = (L) => !S.qm && !!(L && ((S.fmaskEdit && L.fmask) || (L.mask && (S.maskEdit || L.type === "adjust" || L.type === "fill"))));
    /** 2.422.0: what a pixel edit of L changes: "qm" | "fmask" (a smart filter mask) | "mask" | null (its pixels) */
    const whichOf = (L) => (S.qm ? "qm" : onMask(L) ? (S.fmaskEdit && L.fmask ? "fmask" : "mask") : null);
    /** may the active layer be painted / filtered? says why not */
    function canPaint(L) {
      L = L || layer();
      if (!L) { say("open a picture first"); return false; }
      if (S.qm) return true;
      if (onMask(L)) return true;
      if (L.type === "group") { say("the active layer is a group - pick a layer inside it"); return false; }
      if (L.type !== "pixel") { say(`a ${L.type} layer cannot be painted - Layer ▸ Rasterize Layer first (or paint on its mask)`); return false; }
      if (L.locks && (L.locks.px || L.locks.all)) { say("the layer's pixels are locked (🔒 in the Layers panel)"); return false; }
      if (!L.visible) { say("the active layer is hidden - show it to paint on it"); return false; }
      return true;
    }

    /* ---------------- history ---------------- */
    // 2.421.0: the document's PATHS (pcpen.js - the work path, saved paths, the picked one) undo with the layers
    // 2.423.0: + the ALPHA CHANNELS (saved selections, pcrefine.js) - each {id, name, w, h, data} is never changed in
    // place (a change = a new object), so the snapshot keeps them by reference
    const snapPaths = () => ({ paths: D.clone(S.paths || []), work: D.clone(S.work || null), ptarget: D.clone(S.ptarget || null), channels: (S.channels || []).map((c) => Object.assign({}, c)) });
    const putPaths = (s) => { if (s && "paths" in s) { S.paths = D.clone(s.paths) || []; S.work = D.clone(s.work); S.ptarget = D.clone(s.ptarget); } if (s && s.channels) S.channels = s.channels.map((c) => Object.assign({}, c)); };
    function snapStruct() { return Object.assign({ list: S.layers.map((L) => D.snapLayer(L)), active: S.active }, snapPaths()); }
    function putStruct(s) {
      S.layers = s.list.map((x) => D.putLayer(x));
      S.active = Math.max(0, Math.min(s.active, S.layers.length - 1));
      putPaths(s);
      for (const L of S.layers) if (D.isLive(L)) D.rasterize(L);
      renderControls();
    }
    function snapDoc() {
      const cp = (c) => { const n = newCanvas(c.width, c.height); const g = ctx(n); if (g) g.drawImage(c, 0, 0); return n; };
      return Object.assign({ w: S.w, h: S.h, active: S.active, sel: S.sel ? Uint8Array.from(S.sel) : null,
               layers: S.layers.map((L) => ({ snap: D.snapLayer(L), canvas: cp(L.canvas), mask: L.mask ? cp(L.mask.canvas) : null })),
               extras: (E.docExtras || []).map((x) => x.snap()) }, snapPaths());   // 2.487.0: E.docExtras - more document state in a doc step (pcmode.js: the mode)
    }
    function putDoc(d) {
      S.w = d.w; S.h = d.h;
      S.layers = d.layers.map((x) => {
        const L = D.putLayer(x.snap);
        const c = newCanvas(x.canvas.width, x.canvas.height); const g = ctx(c); if (g) g.drawImage(x.canvas, 0, 0); L.canvas = c;
        if (L.mask && x.mask) { const m = newCanvas(x.mask.width, x.mask.height); ctx(m).drawImage(x.mask, 0, 0); L.mask.canvas = m; L.mask.ver = (L.mask.ver || 0) + 1; }
        L.ver = (L.ver || 0) + 1;
        return L;
      });
      S.active = Math.min(d.active, S.layers.length - 1); setSel(d.sel ? Uint8Array.from(d.sel) : new Uint8Array(S.w * S.h), true);
      putPaths(d);
      if (d.extras) (E.docExtras || []).forEach((x, i) => { if (i < d.extras.length) x.put(d.extras[i]); });
      sizeCanvases();
    }
    function push(e) { S.undo.push(e); if (S.undo.length > 80) S.undo.shift(); S.redo.length = 0; if (E.ui.history) E.ui.history(); if (E.onPush) { try { E.onPush(e); } catch (er) { /* a listener's own trouble */ } } }   // 2.468.0: E.onPush (pcactionsx.js records hand-made selections)
    const pxCanvas = (e) => (e.qm ? S.qm : e.fmask ? (e.L.fmask && e.L.fmask.canvas) : e.mask ? (e.L.mask && e.L.mask.canvas) : e.L.canvas);
    function applyEntry(e, back) {
      if (e.t === "px") {
        const c = pxCanvas(e), g = ctx(c); if (g) g.putImageData(back ? e.before : e.after, e.rect.x, e.rect.y);
        if (e.fmask && e.L.fmask) { e.L.fmask.ver = (e.L.fmask.ver || 0) + 1; D.rasterize(e.L); }
        else if (e.mask && e.L.mask) e.L.mask.ver = (e.L.mask.ver || 0) + 1; else e.L.ver = (e.L.ver || 0) + 1;
      }
      else if (e.t === "sel") setSel(Uint8Array.from(back ? e.before : e.after), true);
      else if (e.t === "struct") putStruct(back ? e.before : e.after);
      else if (e.t === "doc") putDoc(back ? e.before : e.after);
      else if (e.t === "multi") (back ? e.list.slice().reverse() : e.list).forEach((x) => applyEntry(x, back));
    }
    function undo() { const e = S.undo.pop(); if (!e) return say("nothing to undo"); applyEntry(e, true); S.redo.push(e); refresh(); renderLayersPanel(); say("undone: " + (e.label || e.t)); }
    function redo() { const e = S.redo.pop(); if (!e) return say("nothing to redo"); applyEntry(e, false); S.undo.push(e); refresh(); renderLayersPanel(); say("redone: " + (e.label || e.t)); }
    /** the History panel: step back / forward to entry n (0 = as opened) */
    function historyTo(n) { while (S.undo.length > n && S.undo.length) undo(); while (S.undo.length < n && S.redo.length) redo(); }
    /** begin a pixel change on a layer (or its mask / the quick mask): a copy to diff against */
    function beginPx(L, which) {
      const src = which === "qm" ? S.qm : which === "fmask" ? L.fmask.canvas : which === "mask" ? L.mask.canvas : (which && which.getContext ? which : L.canvas);
      const c = newCanvas(src.width, src.height); const g = ctx(c); if (g) g.drawImage(src, 0, 0); return c;
    }
    function endPx(L, copy, rect, label, which) {
      const isMask = which === "mask", isQm = which === "qm", isF = which === "fmask";
      const canvas = isQm ? S.qm : isF ? L.fmask.canvas : isMask ? L.mask.canvas : L.canvas;
      const r = rect || { x: 0, y: 0, w: canvas.width, h: canvas.height };
      const g0 = ctx(copy), g1 = ctx(canvas);
      if (!g0 || !g1 || r.w <= 0 || r.h <= 0) return null;
      // 🔒 transparent pixels: the result keeps the old alpha
      if (!isMask && !isQm && !isF && L.locks && L.locks.alpha) { g1.save(); g1.globalCompositeOperation = "destination-in"; g1.drawImage(copy, 0, 0); g1.restore(); }
      // 2.467.0: only the TARGETED colour channels change (the Channels panel - pcrefine.js / pcchannels.js); the others keep their old values
      if (!isMask && !isQm && !isF && S.chTarget && win.PCChannels && !win.PCChannels.all(S.chTarget)) {
        const a = g0.getImageData(r.x, r.y, r.w, r.h), b = g1.getImageData(r.x, r.y, r.w, r.h);
        win.PCChannels.keepChannels(a.data, b.data, S.chTarget); g1.putImageData(b, r.x, r.y);
      }
      if (isF) { L.fmask.ver = (L.fmask.ver || 0) + 1; D.rasterize(L); }        // the smart filters re-applied through it
      else if (isMask) L.mask.ver = (L.mask.ver || 0) + 1; else L.ver = (L.ver || 0) + 1;
      return { t: "px", L, mask: isMask, fmask: isF, qm: isQm, rect: r, before: g0.getImageData(r.x, r.y, r.w, r.h), after: g1.getImageData(r.x, r.y, r.w, r.h), label };
    }
    /** a pixel change on what target() names, as one undo step: f(canvas, g) */
    function pxOp(label, f) {
      const L = layer(); if (!L || !canPaint(L)) return false;
      const which = whichOf(L), c = target(L), copy = beginPx(L, which);
      if (f(c, ctx(c)) === false) return false;
      const px = endPx(L, copy, null, label, which); if (px) push(px);
      refresh(); renderLayersPanel();
      return true;
    }

    /* ---------------- selection ---------------- */
    let selCanvasCache = null, tintCache = null, edgePath = null;
    function setSel(m, silent) {
      S.sel = m; S.selVer++; S.selCount = m ? P.count(m) : 0;
      selCanvasCache = null; tintCache = null; edgePath = null;
      if (!silent) drawOverlay();
    }
    function changeSel(next, label) {
      const before = S.sel ? Uint8Array.from(S.sel) : new Uint8Array(S.w * S.h);
      if (P.count(before)) S.lastSel = before;
      setSel(next);
      push({ t: "sel", before, after: Uint8Array.from(next), label: label || "selection" });
      info();
    }
    function selCanvas() {                     // alpha = the selection (null when empty)
      if (!hasSel()) return null;
      if (selCanvasCache) return selCanvasCache;
      const c = newCanvas(S.w, S.h), g = ctx(c); if (!g) return null;
      const id = g.createImageData(S.w, S.h);
      for (let i = 0; i < S.sel.length; i++) id.data[i * 4 + 3] = S.sel[i];
      g.putImageData(id, 0, 0);
      return (selCanvasCache = c);
    }
    function tintCanvas() {
      if (tintCache) return tintCache;
      const s = selCanvas(); if (!s) return null;
      const c = newCanvas(S.w, S.h), g = ctx(c);
      g.fillStyle = "rgba(38,128,235,0.10)"; g.fillRect(0, 0, S.w, S.h);
      g.globalCompositeOperation = "destination-in"; g.drawImage(s, 0, 0);
      return (tintCache = c);
    }
    function edges() {
      if (edgePath) return edgePath;
      if (!hasSel() || typeof win.Path2D !== "function") return null;
      const p = new win.Path2D();
      for (const [x0, y0, x1, y1] of P.edges(S.sel, S.w, S.h)) { p.moveTo(x0, y0); p.lineTo(x1, y1); }
      return (edgePath = p);
    }
    const selMode = (e) => (e.shiftKey && e.altKey ? "intersect" : e.shiftKey ? "add" : e.altKey ? "subtract" : S.mode);
    function applyShape(shape, mode, label) {
      const next = S.sel ? Uint8Array.from(S.sel) : new Uint8Array(S.w * S.h);
      changeSel(P.combine(next, shape, mode), label);
    }

    /* ---------------- rendering ---------------- */
    let rafPending = false;
    function refresh() { renderLayers(); drawOverlay(); info(); }
    function renderSoon() { if (rafPending) return; rafPending = true; (win.requestAnimationFrame || ((f) => setTimeout(f, 16)))(() => { rafPending = false; renderLayers(); drawOverlay(); }); }
    win.addEventListener("h3textfx", () => renderSoon());                    // 2.411.0: a text effect preset's sharper picture is in
    let scratch = null, scratchM = null;
    /** the active layer's pixels as they are DURING a stroke / a move / a transform */
    function liveSrc(L) {
      if (L !== layer()) return L.canvas;
      const st = S.stroke, onStrokeBuf = st && st.buffer && !S.strokeMask && !S.qm;
      if (!onStrokeBuf && !S.float) return L.canvas;
      if (!scratch || scratch.width !== S.w || scratch.height !== S.h) scratch = newCanvas(S.w, S.h);
      const t = ctx(scratch);
      t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = "source-over"; t.globalAlpha = 1; t.clearRect(0, 0, S.w, S.h); t.drawImage(L.canvas, 0, 0);
      if (onStrokeBuf) {
        let buf = st.buffer;
        const sc = selCanvas();
        if (sc) { const tmp = newCanvas(S.w, S.h), tg = ctx(tmp); tg.drawImage(buf, 0, 0); tg.globalCompositeOperation = "destination-in"; tg.drawImage(sc, 0, 0); buf = tmp; }
        t.globalAlpha = st.opacity; t.globalCompositeOperation = st.blend; t.drawImage(buf, 0, 0);
        if (L.locks && L.locks.alpha) { t.globalAlpha = 1; t.globalCompositeOperation = "destination-in"; t.drawImage(L.canvas, 0, 0); }
      }
      if (S.float) {
        t.globalAlpha = 1; t.globalCompositeOperation = "source-over";
        const f = S.float;
        if (f.m) { t.setTransform(f.m[0], f.m[1], f.m[2], f.m[3], f.m[4], f.m[5]); t.imageSmoothingQuality = "high"; t.drawImage(f.c, 0, 0); t.setTransform(1, 0, 0, 1, 0, 0); }
        else t.drawImage(f.c, f.dx, f.dy);
      }
      return scratch;
    }
    /** the active layer's MASK during a stroke on it */
    function liveMask(L) {
      if (L !== layer() || !S.stroke || !S.strokeMask || !L.mask || S.fmaskEdit) return null;
      if (!scratchM || scratchM.width !== S.w || scratchM.height !== S.h) scratchM = newCanvas(S.w, S.h);
      const t = ctx(scratchM), st = S.stroke;
      t.globalCompositeOperation = "source-over"; t.globalAlpha = 1; t.clearRect(0, 0, S.w, S.h); t.drawImage(L.mask.canvas, 0, 0);
      if (st.buffer) {
        let buf = st.buffer; const sc = selCanvas();
        if (sc) { const tmp = newCanvas(S.w, S.h), tg = ctx(tmp); tg.drawImage(buf, 0, 0); tg.globalCompositeOperation = "destination-in"; tg.drawImage(sc, 0, 0); buf = tmp; }
        t.globalAlpha = st.opacity; t.globalCompositeOperation = st.blend; t.drawImage(buf, 0, 0);
      }
      return scratchM;
    }
    const docEnv = (extra) => Object.assign({
      newCanvas, srcFor: liveSrc, maskSrc: liveMask, compositeOf: (b) => (B ? B.compositeOf(b) : "source-over"),
      adjust: (kind, data, w, h, params) => (FX ? FX.run(kind, data, w, h, params) : null),
    }, extra || {});
    function renderLayers() {
      const g = ctx(cv); if (!g || !S.w) return;
      if (D) D.render({ w: S.w, h: S.h, layers: S.layers }, docEnv({ into: cv, screen: true }));
      if (E.viewFinish) E.viewFinish(cv, true);                                  // 2.487.0: the document's mode, proof colours, gamut warning (pcmode.js)
      if (S.preview) { g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.drawImage(S.preview, 0, 0); }
      if (S.viewMask && layer() && layer().mask) {            // Alt-click on a mask thumbnail: the mask itself
        g.globalCompositeOperation = "source-over"; g.drawImage(layer().mask.canvas, 0, 0);
      } else if (maskOverlayOn()) drawMaskOverlay(g, layer());
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    /* 2.391.0 (Tim: "in image editor, show the mask as the user is drawing so the user can see the mask being drawn"):
       while a brush paints a layer MASK, what the mask hides is tinted red over the picture (Photoshop's rubylith) and
       follows the brush dab by dab - the stroke's live mask (liveMask). "\" (View ▸ Mask Overlay) keeps it on whenever
       the mask is the target, not only during a stroke. Canvas ops only (no pixel loop): red, the mask SCREENed over
       it (white stays white, black stays red), MULTIPLIED onto the picture at the overlay's opacity. */
    S.maskOverlay = store.get("maskov", false); S.maskTint = store.get("masktint", "#ff0000"); S.maskTintA = store.get("masktinta", 0.5);
    let scratchO = null;
    function maskOverlayOn() {
      const L = layer();
      return !!(L && L.mask && !S.qm && !S.fmaskEdit && (S.strokeMask || (S.maskOverlay && onMask(L))));
    }
    function drawMaskOverlay(g, L) {
      const m = liveMask(L) || L.mask.canvas;
      if (!scratchO || scratchO.width !== S.w || scratchO.height !== S.h) scratchO = newCanvas(S.w, S.h);
      const o = ctx(scratchO);
      o.globalAlpha = 1; o.globalCompositeOperation = "source-over"; o.fillStyle = S.maskTint; o.fillRect(0, 0, S.w, S.h);
      o.globalCompositeOperation = "screen"; o.drawImage(m, 0, 0);
      g.save(); g.globalCompositeOperation = "multiply"; g.globalAlpha = S.maskTintA; g.drawImage(scratchO, 0, 0); g.restore();
    }
    E.maskOverlayOn = maskOverlayOn;
    let antsPhase = 0, cursor = null;
    function drawOverlay() {
      const g = ctx(ov); if (!g || !S.w) return;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S.w, S.h);
      const px = 1 / S.zoom;
      if (S.qm) {                                     // quick mask: red over what is NOT selected
        const t = newCanvas(S.w, S.h), tg = ctx(t);
        tg.fillStyle = "rgba(255,0,0,0.5)"; tg.fillRect(0, 0, S.w, S.h);
        tg.globalCompositeOperation = "destination-out"; tg.drawImage(S.qm, 0, 0);
        const st = S.stroke;
        if (st && st.buffer) { tg.globalAlpha = st.opacity; tg.globalCompositeOperation = st.blend === "destination-out" ? "source-over" : "destination-out"; if (st.blend === "destination-out") tg.fillStyle = "rgba(255,0,0,0.5)"; tg.drawImage(st.buffer, 0, 0); }
        g.drawImage(t, 0, 0);
      } else if (hasSel()) {
        const tc = tintCanvas(); if (tc) g.drawImage(tc, 0, 0);
        const p = edges();
        if (p) {
          g.lineWidth = px; g.setLineDash([4 * px, 4 * px]);
          g.strokeStyle = "#000"; g.lineDashOffset = -antsPhase * px; g.stroke(p);
          g.strokeStyle = "#fff"; g.lineDashOffset = (4 - antsPhase) * px; g.stroke(p);
          g.setLineDash([]);
        }
      }
      if (S.pts.length) {
        g.strokeStyle = "#fff"; g.lineWidth = px; g.setLineDash([3 * px, 3 * px]);
        g.beginPath(); S.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
      }
      const T = E.tools[S.tool];
      const brushy = ["paint", "erase", "brush"].includes(S.tool) || (T && T.brush);
      if (cursor && brushy) {
        const r = (S.tool === "brush" ? S.selBrush : S.size) / 2;
        g.lineWidth = px; g.strokeStyle = "rgba(255,255,255,.85)";
        g.beginPath(); g.arc(cursor[0], cursor[1], Math.max(0.5, r), 0, Math.PI * 2); g.stroke();
        g.strokeStyle = "rgba(0,0,0,.6)"; g.beginPath(); g.arc(cursor[0], cursor[1], Math.max(0.5, r) + px, 0, Math.PI * 2); g.stroke();
      }
      for (const f of E.overlayHooks) { try { g.save(); f(g, px, cursor); } catch (e) { /* a hook must not stop the canvas */ } finally { g.restore(); } }
    }
    setInterval(() => { if (hasSel() && !S.qm && host.isConnected !== false && S.w) { antsPhase = (antsPhase + 1) % 8; drawOverlay(); } }, 180);
    function info() {
      const L = layer();
      const b = hasSel() ? P.bbox(S.sel, S.w, S.h) : null;
      say(S.w ? `${S.name || "picture"} ${S.w}×${S.h} · ${L ? (L.type !== "pixel" ? L.type + " " : "") + "layer " + L.name + (onMask(L) ? " (mask)" : "") : "-"} · `
        + (S.qm ? "QUICK MASK (Q leaves)" : b ? `selection ${b.w}×${b.h}` : "nothing selected")
        + ` · ${Math.round(S.zoom * 100)}% · ${S.tool}` : "no picture open");
      $("kxZoom").textContent = Math.round(S.zoom * 100) + "%";
    }

    /* ---------------- view ---------------- */
    function sizeCanvases() {
      for (const c of [cv, ov]) { c.width = S.w; c.height = S.h; }
      paper.style.width = S.w + "px"; paper.style.height = S.h + "px";
      selCanvasCache = tintCache = edgePath = null; scratch = null; scratchM = null;
    }
    function applyView() {
      paper.style.transform = `translate(${Math.round(S.panX)}px, ${Math.round(S.panY)}px) scale(${S.zoom})`;
      paper.classList.toggle("px", S.zoom >= 2);
      drawOverlay(); info();
      if (E.ui.rulers) E.ui.rulers();
    }
    function fitView() {
      if (!S.w) return;
      const aw = Math.max(50, stage.clientWidth - 24), ah = Math.max(50, stage.clientHeight - 24);
      S.zoom = Math.min(1, aw / S.w, ah / S.h) || 1;
      S.panX = (stage.clientWidth - S.w * S.zoom) / 2; S.panY = (stage.clientHeight - S.h * S.zoom) / 2;
      applyView();
    }
    function zoomAt(f, cx, cy) {
      const z = Math.max(0.02, Math.min(32, S.zoom * f));
      const px = cx == null ? stage.clientWidth / 2 : cx, py = cy == null ? stage.clientHeight / 2 : cy;
      S.panX = px - (px - S.panX) * (z / S.zoom); S.panY = py - (py - S.panY) * (z / S.zoom); S.zoom = z;
      S.userView = true;
      applyView();
    }
    const pos = (e) => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left - S.panX) / S.zoom, (e.clientY - r.top - S.panY) / S.zoom]; };

    /* ---------------- document ---------------- */
    /* 2.430.0 (Tim: "in image editor open/create new file in a modular docker, when docked show open documents as
       tabs"): every New / Open is a document of its own (pcdocs.js keeps the one open now in its window / tab);
       opts.inPlace = the same document's content replaced (a PDF's next page, pcpdf.js) */
    function openDoc(w, h, name, paint, opts) {
      const inPlace = !!(opts && opts.inPlace);
      if (E.docBefore) E.docBefore(inPlace, name);
      if (E.beforeOpen) E.beforeOpen(name);                                                  // 2.424.0: a PDF page open now is kept (pcpdf.js)
      S.w = w; S.h = h; S.name = name || "";
      const L = makeLayer("Background", S.w, S.h); const g = ctx(L.canvas); if (g && paint) paint(g);
      S.layers = [L]; S.active = 0; S.undo = []; S.redo = []; S.results = []; S.preview = null; S.float = null; S.pts = [];
      S.maskEdit = false; S.qm = null; S.lastSel = null; S.histSrc = new Map();
      S.paths = []; S.work = null; S.ptarget = null; if (E.pathsReset) E.pathsReset();   // 2.421.0
      S.channels = [];                                                                       // 2.423.0
      sizeCanvases(); setSel(new Uint8Array(S.w * S.h), true);
      $("ieHint").style.display = "none";
      snapHistorySource();
      S.userView = false; fitView(); refresh(); renderLayersPanel(); renderResults();
      if (E.ui.history) E.ui.history();
      if (E.docAfter) E.docAfter(inPlace, name);
      if (api && api.onOpen) api.onOpen(name);
    }
    /** 2.430.0: no document (the last one closed) - the canvas empty, the hint back */
    function blankDoc() {
      S.w = 0; S.h = 0; S.name = ""; S.layers = []; S.active = 0; S.undo = []; S.redo = []; S.results = []; S.preview = null; S.float = null; S.pts = [];
      S.paths = []; S.work = null; S.ptarget = null; S.channels = []; S.qm = null; S.maskEdit = false; S.lastSel = null; S.histSrc = new Map(); S.drag = null; S.stroke = null;
      S.sel = null; S.selCount = 0; S.selVer++;
      for (const c of [cv, ov]) { c.width = 1; c.height = 1; ctx(c) && ctx(c).clearRect(0, 0, 1, 1); }
      paper.style.width = "0px"; paper.style.height = "0px";
      selCanvasCache = tintCache = edgePath = null; scratch = null; scratchM = null;
      $("ieHint").style.display = "";
      info(); renderLayersPanel(); renderResults();
      if (E.ui.history) E.ui.history();
      if (api && api.onOpen) api.onOpen("");
    }
    function openImage(img, name) {
      openDoc(img.naturalWidth || img.width, img.naturalHeight || img.height, name, (g) => g.drawImage(img, 0, 0));
    }
    /** the History Brush's source: every layer as it was opened / when "Set history source" was pressed */
    function snapHistorySource() {
      S.histSrc = new Map();
      for (const L of S.layers) if (L.type === "pixel") { const c = newCanvas(L.canvas.width, L.canvas.height); ctx(c).drawImage(L.canvas, 0, 0); S.histSrc.set(L.id, c); }
    }
    /** a new layer above the active one (inside it when the active layer is an open group) - one undo step */
    function addLayer(L, label, into) {
      const before = snapStruct(), A = layer();
      S.layers = D.insert(S.layers, L, A ? A.id : null, into != null ? into : !!(A && A.type === "group" && A.open !== false));
      S.active = S.layers.indexOf(L);
      push({ t: "struct", before, after: snapStruct(), label: label || "new layer" });
      S.maskEdit = false;
      refresh(); renderLayersPanel();
      return L;
    }
    function addImageLayer(img, name) {
      if (!S.w) return openImage(img, name);
      const L = makeLayer(name || "Layer", S.w, S.h); const g = ctx(L.canvas);
      if (g) { const k = Math.min(1, S.w / img.naturalWidth, S.h / img.naturalHeight); const w = img.naturalWidth * k, h = img.naturalHeight * k; g.drawImage(img, (S.w - w) / 2, (S.h - h) / 2, w, h); }
      addLayer(L, "place layer", false);
    }
    function load(src, name, asLayer) {
      const img = new win.Image();
      img.onload = () => (asLayer ? addImageLayer(img, name) : openImage(img, name));
      img.onerror = () => say("could not load " + (name || src));
      img.crossOrigin = "anonymous";
      img.src = src;
    }
    /** the picture as saved / as the AI sees it: every visible layer (control layers never) */
    function flatten() {
      const c = newCanvas(S.w, S.h);
      if (D) { const out = D.render({ w: S.w, h: S.h, layers: S.layers }, docEnv({ srcFor: (L) => L.canvas, maskSrc: null, skipControl: true, into: c })); return E.viewFinish && out ? E.viewFinish(out, false) : out; }   // 2.487.0: + the mode (pcmode.js)
      return c;
    }

    /* ---------------- layers panel (pcui draws it; this is the fallback + the shared repaint) ---------------- */
    function renderLayersPanel() {
      if (E.ui.layers) { E.ui.layers(); renderControls(); return; }
      const box = $("kxLayers"); box.innerHTML = "";
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i];
        const row = doc.createElement("div"); row.className = "kxlayer" + (i === S.active ? " on" : ""); row.dataset.i = i;
        row.textContent = (L.visible ? "👁 " : "· ") + L.name; row.onclick = () => { S.active = i; renderLayersPanel(); info(); };
        box.appendChild(row);
      }
      renderControls();
    }
    function structOp(label, fn) {
      if (!S.w) return false;
      const before = snapStruct();
      if (fn() === false) return false;
      push({ t: "struct", before, after: snapStruct(), label });
      refresh(); renderLayersPanel();
      return true;
    }
    function setActive(i, mask) {
      S.active = Math.max(0, Math.min(S.layers.length - 1, i)); S.maskEdit = !!mask && !!(layer() && layer().mask); S.fmaskEdit = false;
      S.viewMask = false; renderLayersPanel(); info(); renderLayers();
    }
    const L_ = () => layer();
    function newLayer() { return addLayer(makeLayer("Layer " + (S.layers.filter((x) => x.type === "pixel").length + 1)), "new layer"); }
    function duplicateLayer() {
      const L = L_(); if (!L) return;
      const d = makeLayer(L.name + " copy", S.w, S.h, L.type);
      for (const k of ["opacity", "fillOpacity", "blend", "clip", "label"]) d[k] = L[k];
      for (const k of ["styles", "adj", "text", "shape", "fill", "locks", "vmask", "smart", "frame", "artboard", "sketch"]) d[k] = D.clone(L[k]);   // 2.462.0: + sketch
      if (L.fmask) { d.fmask = { canvas: newCanvas(S.w, S.h), on: L.fmask.on, ver: 0 }; ctx(d.fmask.canvas).drawImage(L.fmask.canvas, 0, 0); }   // 2.422.0
      ctx(d.canvas).drawImage(L.canvas, 0, 0);
      if (L.mask) { d.mask = newMask("#000"); ctx(d.mask.canvas).drawImage(L.mask.canvas, 0, 0); Object.assign(d.mask, { on: L.mask.on, density: L.mask.density, feather: L.mask.feather }); }
      if (L.type === "group" || (L.frame && S.layers.some((x) => x.parent === L.id))) {   // a group (2.442.0: a frame) copies its whole contents
        const before = snapStruct(), kids = D.descendants(S.layers, L.id);
        const map = new Map([[L.id, d.id]]);
        const copies = kids.map((k) => { const c = makeLayer(k.name, S.w, S.h, k.type); Object.assign(c, D.clone(Object.assign({}, k, { canvas: null, mask: null, fmask: null, _skey: null })), { id: c.id, canvas: c.canvas, mask: null, fmask: null });
          if (k.fmask) { c.fmask = { canvas: newCanvas(S.w, S.h), on: k.fmask.on, ver: 0 }; ctx(c.fmask.canvas).drawImage(k.fmask.canvas, 0, 0); }
          ctx(c.canvas).drawImage(k.canvas, 0, 0); if (k.mask) { c.mask = newMask("#000"); ctx(c.mask.canvas).drawImage(k.mask.canvas, 0, 0); } map.set(k.id, c.id); return c; });
        copies.forEach((c, i) => { c.parent = map.get(kids[i].parent) || null; });
        const at = S.layers.indexOf(L);
        d.parent = L.parent; S.layers.splice(at + 1, 0, ...copies, d); S.layers = D.normalize(S.layers); S.active = S.layers.indexOf(d);
        push({ t: "struct", before, after: snapStruct(), label: "duplicate group" }); refresh(); renderLayersPanel();
        return;
      }
      addLayer(d, "duplicate layer", false);
    }
    function deleteLayer() {
      structOp("delete layer", () => {
        const L = L_(); if (!L) return false;
        const left = D.remove(S.layers, L.id);
        if (!left.length) { say("the last layer stays"); return false; }
        const i = S.active; S.layers = left; S.active = Math.max(0, Math.min(i - 1, S.layers.length - 1)); S.maskEdit = false;
      });
    }
    function moveLayer(dir) {
      structOp(dir > 0 ? "bring forward" : "send backward", () => {
        const L = L_(); if (!L) return false;
        const next = D.move(S.layers, L.id, dir); if (next === S.layers) return false;
        S.layers = next; S.active = S.layers.indexOf(L);
      });
    }
    function moveLayerEnd(dir) {
      structOp(dir > 0 ? "bring to front" : "send to back", () => { const L = L_(); if (!L) return false; S.layers = D.moveEnd(S.layers, L.id, dir); S.active = S.layers.indexOf(L); });
    }
    /** drop layer `id` above / below / into layer `refId` (the Layers panel's drag) */
    function dropLayer(id, refId, where) {
      if (id === refId) return;
      structOp("move layer", () => {
        const L = S.layers.find((x) => x.id === id), R = S.layers.find((x) => x.id === refId); if (!L || !R) return false;
        if (D.descendants(S.layers, id).some((x) => x.id === refId)) { say("a group cannot go inside itself"); return false; }
        let list = S.layers.filter((x) => x !== L);
        const kids = D.descendants(S.layers, id);
        list = list.filter((x) => !kids.includes(x));
        if (where === "in") list = D.insert(list, L, R.id, true);
        else if (where === "top") list = D.insert(list, L, R.id, false);
        else {                                          // below R: above the layer under R (or first of R's list)
          const T = D.toTree(list), r = D.findNode(T, R.id);
          L.parent = r.parent ? r.parent.L.id : null;
          r.list.splice(r.i, 0, { L, kids: [] }); list = D.fromTree(T);
        }
        // put the group's contents back under it
        if (kids.length) { const at = list.indexOf(L); list.splice(at, 0, ...kids); }
        S.layers = D.normalize(list); S.active = S.layers.indexOf(L);
      });
    }
    function groupActive() {
      const L = L_(); if (!L) return;
      structOp("group layers", () => { const G = makeLayer("Group " + (S.layers.filter((x) => x.type === "group").length + 1), S.w, S.h, "group"); S.layers = D.group(S.layers, [L.id], G); S.active = S.layers.indexOf(G); });
    }
    function newGroup() { return addLayer(makeLayer("Group " + (S.layers.filter((x) => x.type === "group").length + 1), S.w, S.h, "group"), "new group"); }
    function ungroupActive() {
      const L = L_(); if (!L || L.type !== "group") return say("the active layer is not a group");
      structOp("ungroup", () => { const kids = D.descendants(S.layers, L.id).filter((k) => k.parent === L.id); S.layers = D.ungroup(S.layers, L.id); S.active = Math.max(0, S.layers.indexOf(kids[kids.length - 1] || S.layers[0])); });
    }
    function toggleClip() {
      const L = L_(); if (!L) return;
      structOp(L.clip ? "release clipping mask" : "create clipping mask", () => { L.clip = !L.clip; });
    }
    /** merge the active layer into the one below it (its mask, styles, opacity and blend baked in) */
    function mergeDown() {
      const top = L_();
      if (!S.w || !top) return;
      const T = D.toTree(S.layers), r = D.findNode(T, top.id);
      if (!r || r.i === 0) return say("nothing below to merge into (inside its group)");
      const below = r.list[r.i - 1].L;
      if (below.type !== "pixel") return say(`the layer below is a ${below.type} layer - rasterize it first`);
      const copy = beginPx(below), before = snapStruct(), g = ctx(below.canvas);
      if (top.type === "adjust") {
        const id = g.getImageData(0, 0, S.w, S.h), t = newCanvas(S.w, S.h); ctx(t).putImageData(id, 0, 0);
        D.applyAdjust(docEnv(), top, t, S.w, S.h);
        g.clearRect(0, 0, S.w, S.h); g.drawImage(t, 0, 0);
      } else if (top.visible) {
        const look = D.renderLayer({ w: S.w, h: S.h, layers: S.layers }, docEnv({ srcFor: (x) => x.canvas, maskSrc: null }), top);
        g.save(); g.globalAlpha = top.opacity; g.globalCompositeOperation = B ? B.compositeOf(top.blend === "pass-through" ? "normal" : top.blend) : "source-over";
        if (look) g.drawImage(look, 0, 0); g.restore();
      }
      const px = endPx(below, copy, null, "merge");
      S.layers = D.remove(S.layers, top.id); S.active = S.layers.indexOf(below);
      push({ t: "multi", list: [px, { t: "struct", before, after: snapStruct() }].filter(Boolean), label: "merge down" });
      refresh(); renderLayersPanel();
    }
    /** every visible layer (control layers excepted) -> one layer; flatten = also on white, the hidden ones dropped */
    function mergeVisible(flat) {
      if (!S.w) return;
      const before = snapDoc(), pic = flatten();
      const keepCtl = S.layers.filter((L) => L.control);
      const M = makeLayer(flat ? "Background" : "Merged", S.w, S.h), g = ctx(M.canvas);
      if (flat) { g.fillStyle = "#ffffff"; g.fillRect(0, 0, S.w, S.h); }
      g.drawImage(pic, 0, 0);
      const hidden = flat ? [] : S.layers.filter((L) => !L.control && !D.shown(S.layers, L) && L.type !== "group");
      hidden.forEach((L) => { L.parent = null; });
      S.layers = [...hidden, M, ...keepCtl.map((L) => Object.assign(L, { parent: null }))];
      S.active = S.layers.indexOf(M); S.maskEdit = false;
      push({ t: "doc", before, after: snapDoc(), label: flat ? "flatten image" : "merge visible" });
      refresh(); renderLayersPanel();
    }
    /** text / shape / fill -> ordinary pixels (and styles = baked when `styles`) */
    function rasterizeLayer(styles) {
      const L = L_(); if (!L) return;
      if (L.type === "adjust" || L.type === "group") return say(`a ${L.type} layer has no pixels to rasterize - merge it down instead`);
      const before = snapStruct(), copy = beginPx(L);
      if (styles && D.hasStyles(L)) { const look = D.renderLayer({ w: S.w, h: S.h, layers: S.layers }, docEnv({ srcFor: (x) => x.canvas, maskSrc: null }), Object.assign({}, L, { mask: null })); const g = ctx(L.canvas); g.clearRect(0, 0, S.w, S.h); g.drawImage(look, 0, 0); }
      if (L.type === "pixel" && !(styles && D.hasStyles(L))) return say("already a pixel layer");
      const px = endPx(L, copy, null, "rasterize");
      L.type = "pixel"; delete L.text; delete L.shape; delete L.fill; delete L.smart; delete L.sketch; L.fmask = null; if (styles) { L.styles = null; L.fillOpacity = 1; }
      push({ t: "multi", list: [px, { t: "struct", before, after: snapStruct() }].filter(Boolean), label: styles ? "rasterize layer style" : "rasterize layer" });
      refresh(); renderLayersPanel();
    }
    /** Layer via Copy (Ctrl+J) / via Cut (Shift+Ctrl+J): the selection's pixels on a new layer */
    function layerFromSelection(cut) {
      if (!S.w) return;
      const L = layer(); if (!L || L.type !== "pixel") return say("Layer via Copy works on a pixel layer");
      const sc = selCanvas();
      const d = makeLayer(L.name + (sc ? (cut ? " (cut)" : " (selection)") : " copy")), g = ctx(d.canvas);
      g.drawImage(L.canvas, 0, 0);
      if (sc) { g.globalCompositeOperation = "destination-in"; g.drawImage(sc, 0, 0); }
      if (cut && sc) {
        const copy = beginPx(L), lg = ctx(L.canvas); lg.save(); lg.globalCompositeOperation = "destination-out"; lg.drawImage(sc, 0, 0); lg.restore();
        const px = endPx(L, copy, null, "cut");
        const before = snapStruct(); S.layers = D.insert(S.layers, d, L.id, false); S.active = S.layers.indexOf(d);
        push({ t: "multi", list: [px, { t: "struct", before, after: snapStruct() }].filter(Boolean), label: "layer via cut" });
        refresh(); renderLayersPanel(); return;
      }
      addLayer(d, "layer via copy", false);
    }
    /* masks */
    function addMask(kind) {
      const L = L_(); if (!L) return;
      if (L.type === "pixel" && S.layers.indexOf(L) === 0 && S.layers.length === 1 && L.name === "Background" && kind == null) { /* fine - PS needs a non-background layer, we do not */ }
      const sc = selCanvas();
      const k = kind || (sc ? "selection" : "reveal");
      if (L.mask && !/^(selection|hideSelection)$/.test(k)) return say("the layer already has a mask");
      structOp("add layer mask", () => {
        const m = newMask(k === "hide" || k === "hideSelection" ? "#000000" : "#ffffff");
        if ((k === "selection" || k === "hideSelection") && sc) {
          const g = ctx(m.canvas);
          if (k === "selection") { g.fillStyle = "#000"; g.fillRect(0, 0, S.w, S.h); }
          const t = newCanvas(S.w, S.h), tg = ctx(t); tg.fillStyle = k === "selection" ? "#fff" : "#000"; tg.fillRect(0, 0, S.w, S.h);
          tg.globalCompositeOperation = "destination-in"; tg.drawImage(sc, 0, 0); g.drawImage(t, 0, 0);
        }
        L.mask = m; S.maskEdit = true;
      });
    }
    function deleteMask(apply) {
      const L = L_(); if (!L || !L.mask) return say("the layer has no mask");
      if (apply && L.type === "pixel") {
        const copy = beginPx(L), before = snapStruct(), g = ctx(L.canvas), a = D.maskAlpha(L, docEnv({ maskSrc: null }), S.w, S.h);
        if (a) { g.save(); g.globalCompositeOperation = "destination-in"; g.drawImage(a, 0, 0); g.restore(); }
        const px = endPx(L, copy, null, "apply mask"); L.mask = null; S.maskEdit = false;
        push({ t: "multi", list: [px, { t: "struct", before, after: snapStruct() }].filter(Boolean), label: "apply layer mask" });
        refresh(); renderLayersPanel(); return;
      }
      structOp("delete layer mask", () => { L.mask = null; S.maskEdit = false; });
    }
    function toggleMask() { const L = L_(); if (!L || !L.mask) return; structOp(L.mask.on === false ? "enable mask" : "disable mask", () => { L.mask.on = L.mask.on === false; L.mask.ver++; }); }
    /** the mask (or the layer's opaque pixels) as the selection - Ctrl+click a thumbnail */
    function selectFrom(L, fromMask) {
      L = L || layer(); if (!L) return;
      if (fromMask && L.mask) { const d = ctx(L.mask.canvas).getImageData(0, 0, S.w, S.h).data, m = new Uint8Array(S.w * S.h); for (let i = 0; i < m.length; i++) m[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]); changeSel(m, "load mask"); }
      else { const look = L.type === "pixel" ? L.canvas : D.renderLayer({ w: S.w, h: S.h, layers: S.layers }, docEnv(), L); changeSel(P.fromAlpha(ctx(look).getImageData(0, 0, S.w, S.h).data, S.w, S.h, 1), "load transparency"); }
    }
    /* adjustment / fill layers */
    function newAdjust(kind) {
      if (!S.w) return say("open a picture first");
      const f = FX && FX.byId(kind); if (!f) return say("unknown adjustment " + kind);
      const L = makeLayer(f.name, S.w, S.h, "adjust");
      L.adj = { kind, params: FX.defaults(f) };
      L.mask = newMask("#fff");
      const sc = selCanvas();
      if (sc) { const g = ctx(L.mask.canvas); g.fillStyle = "#000"; g.fillRect(0, 0, S.w, S.h); const t = newCanvas(S.w, S.h), tg = ctx(t); tg.fillStyle = "#fff"; tg.fillRect(0, 0, S.w, S.h); tg.globalCompositeOperation = "destination-in"; tg.drawImage(sc, 0, 0); g.drawImage(t, 0, 0); }
      addLayer(L, "new " + f.name + " layer");
      if (E.ui.showTab) E.ui.showTab("pcProps");
      return L;
    }
    function newFill(kind) {
      if (!S.w) return say("open a picture first");
      const L = makeLayer(kind === "gradient" ? "Gradient Fill" : "Color Fill", S.w, S.h, "fill");
      L.fill = kind === "gradient" ? { kind: "gradient", c1: S.fg, c2: S.bg, angle: 90, style: "linear" } : { kind: "solid", color: S.fg };
      L.mask = newMask("#fff");
      const sc = selCanvas();
      if (sc) { const g = ctx(L.mask.canvas); g.fillStyle = "#000"; g.fillRect(0, 0, S.w, S.h); const t = newCanvas(S.w, S.h), tg = ctx(t); tg.fillStyle = "#fff"; tg.fillRect(0, 0, S.w, S.h); tg.globalCompositeOperation = "destination-in"; tg.drawImage(sc, 0, 0); g.drawImage(t, 0, 0); }
      D.rasterize(L);
      addLayer(L, "new fill layer");
      if (E.ui.showTab) E.ui.showTab("pcProps");
      return L;
    }
    /** a settings change on a layer (adjustment params, text, shape, fill, styles) as one undo step - live edits call
     *  liveSet (no history) and commit with setLayer */
    let liveBefore = null;
    function liveSet(L, f) { if (!liveBefore) liveBefore = snapStruct(); f(L); if (D.isLive(L)) D.rasterize(L); renderSoon(); }
    function cancelLive() { if (!liveBefore) return; putStruct(liveBefore); liveBefore = null; refresh(); renderLayersPanel(); }
    function commitLive(label) { if (!liveBefore) return; push({ t: "struct", before: liveBefore, after: snapStruct(), label: label || "layer settings" }); liveBefore = null; refresh(); renderLayersPanel(); }
    function setLayer(L, label, f) { commitLive(); structOp(label, () => { if (f(L) === false) return false; if (D.isLive(L)) D.rasterize(L); }); }

    /* ---------------- tools & options bar ---------------- */
    function setTool(t) {
      if (E.tools[S.tool] && E.tools[S.tool].leave && S.tool !== t) { try { E.tools[S.tool].leave(); } catch (e) { /* fine */ } }
      S.tool = t; S.pts = [];
      host.querySelectorAll(".ietool").forEach((b) => b.classList.toggle("on", b.dataset.tool === t || (b.dataset.tools || "").split(",").includes(t)));
      renderOptions(); drawOverlay(); info();
      stage.style.cursor = (E.tools[t] && E.tools[t].cursor) || ({ hand: "grab", picker: "crosshair", move: "move", fill: "crosshair" }[t]) || (["paint", "erase", "brush"].includes(t) ? "none" : "crosshair");
    }
    function presetButton() {
      const p = B ? B.byId(S.preset) : { icon: "●", name: "brush" };
      return `<button class="ghost" id="kxPreset" title="Brush presets">${p.icon} ${p.name} ▾</button>`;
    }
    /** the options bar - the tool's own (pctools) or the core tools' */
    function renderOptions() {
      const o = $("kxOpts"); let h = "";
      if (E.ui.toolName) E.ui.toolName(S.tool);
      const T = E.tools[S.tool];
      if (T && T.options) { o.innerHTML = T.options(); if (T.bindOptions) T.bindOptions(o); bindCommon(o); return; }
      if (["rect", "ellipse", "lasso", "poly", "wand", "brush"].includes(S.tool)) {
        h += ["replace", "add", "subtract", "intersect"].map((m) => `<button class="ghost kxsm${S.mode === m ? " on" : ""}" data-sm="${m}" title="${{ replace: "New selection", add: "Add to selection (Shift)", subtract: "Subtract from selection (Alt)", intersect: "Intersect with selection (Shift+Alt)" }[m]}">${{ replace: "▢", add: "⊕", subtract: "⊖", intersect: "⊗" }[m]}</button>`).join("");
        h += `<span class="sep"></span><label title="Soft edge of the next selection (px) - Select ▸ Modify ▸ Feather does an existing one">Feather <input type="number" id="pcSelFeather" min="0" max="250" value="${S.selFeather || 0}"></label>`;
        if (S.tool === "wand") h += `<label title="Magic-wand tolerance (0-255)">Tolerance <input type="number" id="ieTol" min="0" max="255" value="${S.tol}"></label><label><input type="checkbox" id="pcContig" ${S.contiguous ? "checked" : ""}> Contiguous</label>`;
        if (S.tool === "brush") h += `<label title="Selection brush size">Size <input type="number" id="ieBrush" min="1" max="600" value="${S.selBrush}"></label>`;
        h += `<span class="sep"></span><button class="ghost" id="pcSelAll" title="Select all (Ctrl+A)">All</button><button class="ghost" id="pcSelInv" title="Inverse (Shift+Ctrl+I)">Inverse</button><button class="ghost" id="pcSelNone" title="Deselect (Ctrl+D)">Deselect</button>`;
      } else if (S.tool === "paint" || S.tool === "erase") {
        h += presetButton()
          + `<label title="Brush size ([ and ])">Size <input type="range" id="kxSize" min="1" max="600" value="${Math.round(S.size)}"><input type="number" id="kxSizeN" min="1" max="600" value="${Math.round(S.size)}"></label>`
          + `<label title="Stroke opacity (1-0 keys: 10-100 %)">Opacity <input type="range" id="kxOpa" min="1" max="100" value="${Math.round(S.opacity * 100)}"></label>`
          + `<label title="Flow: each dab's strength (strokes build up to the opacity)">Flow <input type="range" id="kxFlow" min="1" max="100" value="${Math.round(S.flow * 100)}"></label>`;
      } else if (S.tool === "fill") {
        h += `<label title="Fill tolerance when there is no selection">Tolerance <input type="number" id="ieTol" min="0" max="255" value="${S.tol}"></label>`;
      } else if (S.tool === "picker") {
        h += `<label>Sample <select id="pcSample"><option value="all"${S.sampleAll ? " selected" : ""}>All layers</option><option value="cur"${S.sampleAll ? "" : " selected"}>Current layer</option></select></label>`;
      } else if (S.tool === "move") {
        h += `<label title="A click picks the topmost layer with pixels there"><input type="checkbox" id="pcAuto" ${S.autoSelect ? "checked" : ""}> Auto-select layer</label><span class="sep"></span>`
          + ["left", "hcenter", "right", "top", "vcenter", "bottom"].map((a) => `<button class="ghost pcalign" data-al="${a}" title="Align the layer ${a === "hcenter" ? "horizontal centres" : a === "vcenter" ? "vertical centres" : a + " edges"} to the selection (or the canvas)">${{ left: "⇤", hcenter: "↔", right: "⇥", top: "⤒", vcenter: "↕", bottom: "⤓" }[a]}</button>`).join("")
          + `<span class="sep"></span><button class="ghost" id="pcXform" title="Free Transform (Ctrl+T): drag inside = move, corners / edges = scale, outside = rotate, Ctrl + an edge = skew; Enter keeps, Esc cancels">⤡ Transform</button>`;   // 2.550.0
      }
      o.innerHTML = h;
      o.querySelectorAll(".kxsm").forEach((b) => { b.onclick = () => { S.mode = b.dataset.sm; renderOptions(); }; });
      const tol = o.querySelector("#ieTol"); if (tol) tol.onchange = () => { S.tol = Math.max(0, Math.min(255, +tol.value || 0)); };
      const sb = o.querySelector("#ieBrush"); if (sb) sb.onchange = () => { S.selBrush = Math.max(1, +sb.value || 24); };
      const sf = o.querySelector("#pcSelFeather"); if (sf) sf.onchange = () => { S.selFeather = Math.max(0, Math.min(250, +sf.value || 0)); };
      const cg = o.querySelector("#pcContig"); if (cg) cg.onchange = () => { S.contiguous = cg.checked; };
      const sz = o.querySelector("#kxSize"), szn = o.querySelector("#kxSizeN");
      if (sz) { sz.oninput = () => { setSize(+sz.value); szn.value = sz.value; }; szn.onchange = () => { setSize(+szn.value); sz.value = szn.value; }; }
      const op = o.querySelector("#kxOpa"); if (op) op.oninput = () => { S.opacity = op.value / 100; store.set("opacity." + S.preset, S.opacity); };
      const fl = o.querySelector("#kxFlow"); if (fl) fl.oninput = () => { S.flow = fl.value / 100; store.set("flow." + S.preset, S.flow); };
      const pb = o.querySelector("#kxPreset"); if (pb) pb.onclick = (e) => { e.stopPropagation(); togglePresets(pb); };
      const sp = o.querySelector("#pcSample"); if (sp) sp.onchange = () => { S.sampleAll = sp.value === "all"; store.set("sampleall", S.sampleAll); };
      const au = o.querySelector("#pcAuto"); if (au) au.onchange = () => { S.autoSelect = au.checked; store.set("autosel", S.autoSelect); };
      o.querySelectorAll(".pcalign").forEach((b) => { b.onclick = () => alignLayer(b.dataset.al); });
      const xf = o.querySelector("#pcXform"); if (xf) xf.onclick = () => { if (E.startTransform) E.startTransform(); };   // 2.550.0
      bindCommon(o);
    }
    function bindCommon(o) {
      const a = o.querySelector("#pcSelAll"); if (a) a.onclick = () => selectAll();
      const i = o.querySelector("#pcSelInv"); if (i) i.onclick = () => selectInverse();
      const n = o.querySelector("#pcSelNone"); if (n) n.onclick = () => deselect();
    }
    function setSize(v) { S.size = Math.max(1, Math.min(600, v || 1)); store.set("size." + S.preset, S.size); drawOverlay(); }
    function choosePreset(id) {
      const p = B.byId(id); S.preset = p.id; store.set("preset", p.id);
      S.size = store.get("size." + p.id, p.size); S.opacity = store.get("opacity." + p.id, p.opacity); S.flow = store.get("flow." + p.id, p.flow);
      if (S.tool !== "paint" && S.tool !== "erase") S.tool = "paint";
      setTool(p.engine === "erase" ? "erase" : S.tool);
    }
    let pop = null;
    function togglePresets(anchor) {
      if (pop) { pop.remove(); pop = null; return; }
      if (!B) return;
      pop = doc.createElement("div"); pop.className = "kxpop";
      const r = anchor.getBoundingClientRect();
      for (const p of B.PRESETS) {
        const it = doc.createElement("div"); it.className = "pb" + (p.id === S.preset ? " on" : ""); it.title = p.name;
        const c = newCanvas(156, 60); sampleStroke(c, p);
        const lab = doc.createElement("span"); lab.textContent = `${p.icon} ${p.name}`;
        it.append(c, lab);
        it.onclick = () => { choosePreset(p.id); pop.remove(); pop = null; };
        pop.appendChild(it);
      }
      const kr = kx.getBoundingClientRect();
      pop.style.left = Math.max(0, r.left - kr.left) + "px"; pop.style.top = (r.bottom - kr.top + 2) + "px";
      kx.appendChild(pop);
    }
    doc.addEventListener("pointerdown", (e) => { if (pop && !pop.contains(e.target)) { pop.remove(); pop = null; } });
    function sampleStroke(c, p) {                       // the preset's own thumbnail
      const g = ctx(c); if (!g) return;
      g.fillStyle = "#e8e4dc"; g.fillRect(0, 0, c.width, c.height);
      if (p.engine === "smudge" || p.engine === "blur" || p.engine === "erase") {
        const grd = g.createLinearGradient(0, 0, c.width, 0); grd.addColorStop(0, "#c0392b"); grd.addColorStop(0.5, "#f1c40f"); grd.addColorStop(1, "#2980b9");
        g.fillStyle = grd; g.fillRect(0, 12, c.width, 36);
      }
      const size = Math.min(p.size, 30) * (p.tip === "spray" ? 1.6 : 1);
      const st = new B.Stroke({ doc, layer: c, preset: p, size, color: p.color || "#222222" });
      for (let i = 0; i <= 24; i++) { const t = i / 24; st.add(10 + t * (c.width - 20), 30 + Math.sin(t * Math.PI * 2) * 10, 0.3 + 0.7 * Math.sin(t * Math.PI)); }
      st.end();
    }

    /* ---------------- move: the layer, the selected pixels, a text / shape layer, a group ---------------- */
    /** shift a layer's content by (dx, dy): pixels (and a linked mask) or a text / shape layer's settings */
    function shiftLayer(L, dx, dy, list) {
      if (L.type === "text" && L.text) { L.text.x += dx; L.text.y += dy; D.rasterize(L); }
      else if (L.type === "shape" && L.shape) { L.shape.x += dx; L.shape.y += dy; D.rasterize(L); }
      else if (L.type === "smart" && E.smartShift) E.smartShift(L, dx, dy);   // 2.422.0: a smart object moves its transform
      else if (L.type === "sketch" && L.sketch && win.PCSketch) { win.PCSketch.translate(L.sketch, dx, dy); D.rasterize(L); }   // 2.462.0: a sketch moves its points
      else if (L.type === "pixel") {
        const copy = beginPx(L), g = ctx(L.canvas), t = newCanvas(S.w, S.h); ctx(t).drawImage(L.canvas, 0, 0);
        g.clearRect(0, 0, S.w, S.h); g.drawImage(t, dx, dy);
        const px = endPx(L, copy, null, "move"); if (px && list) list.push(px);
      }
      if (L.type === "pixel" || L.type === "text" || L.type === "shape" || L.type === "smart" || L.type === "sketch") shiftMask(L, dx, dy, list);
      if (E.shiftVmask) E.shiftVmask(L, dx, dy);          // 2.421.0: a linked VECTOR mask moves too (the struct step records it)
    }
    /** a LINKED mask moves with its layer (Photoshop's chain between the thumbnails) */
    function shiftMask(L, dx, dy, list) {
      if (!L.mask || L.mask.linked === false || (!dx && !dy)) return;
      const copy = beginPx(L, "mask"), g = ctx(L.mask.canvas), t = newCanvas(S.w, S.h); ctx(t).drawImage(L.mask.canvas, 0, 0);
      g.fillStyle = "#fff"; g.fillRect(0, 0, S.w, S.h); g.drawImage(t, dx, dy);
      const px = endPx(L, copy, null, "move mask", "mask"); if (px && list) list.push(px);
    }
    /** the topmost shown layer with a pixel at (x, y) - Auto-select */
    function layerAt(x, y) {
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i];
        if (L.type === "group" || L.type === "adjust" || L.control || !D.shown(S.layers, L)) continue;
        if (E.hitLayer) { const h = E.hitLayer(L, x, y); if (h === false) continue; if (h === true) return i; if (h && typeof h === "object") { const j = S.layers.indexOf(h); if (j >= 0) return j; } }   // 2.442.0: frames (pcframes.js); 2.457.0: a layer = pick it instead (a dimension part picks its group)
        const g = ctx(L.canvas); if (!g) continue;
        if (g.getImageData(Math.max(0, Math.min(S.w - 1, x)), Math.max(0, Math.min(S.h - 1, y)), 1, 1).data[3] > 8) return i;
      }
      return -1;
    }
    function alphaBox(c) {
      const d = ctx(c).getImageData(0, 0, c.width, c.height).data, m = new Uint8Array(c.width * c.height);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 0 ? 255 : 0;
      return P.bbox(m, c.width, c.height);
    }
    function alignLayer(how) {
      const L = layer(); if (!L || L.type === "adjust" || L.type === "group") return say("align moves a pixel, text or shape layer");
      if (L.locks && (L.locks.pos || L.locks.all)) return say("the layer's position is locked");
      const box = L.type === "text" ? D.textBox(L.text, ctx(L.canvas)) : alphaBox(L.canvas);
      if (!box) return say("the layer is empty");
      const ref = hasSel() ? P.bbox(S.sel, S.w, S.h) : { x: 0, y: 0, w: S.w, h: S.h };
      const dx = { left: ref.x - box.x, right: ref.x + ref.w - (box.x + box.w), hcenter: ref.x + ref.w / 2 - (box.x + box.w / 2) }[how] || 0;
      const dy = { top: ref.y - box.y, bottom: ref.y + ref.h - (box.y + box.h), vcenter: ref.y + ref.h / 2 - (box.y + box.h / 2) }[how] || 0;
      if (!dx && !dy) return;
      const before = snapStruct(), list = [];
      shiftLayer(L, Math.round(dx), Math.round(dy), list);
      push({ t: "multi", list: list.concat([{ t: "struct", before, after: snapStruct() }]), label: "align" });
      refresh(); renderLayersPanel();
    }
    /** a group's layers that move with it - not what is inside a frame in it (that follows its frame - pcframes.js) */
    const inGroup = (G) => D.descendants(S.layers, G.id).filter((x) => !(win.PCFrames && win.PCFrames.underFrame(S.layers, x, G.id)));
    /** arrow keys with the move tool: 1 px (Shift: 10) */
    function nudge(dx, dy) {
      const L = layer(); if (!L) return;
      if (L.locks && (L.locks.pos || L.locks.all)) return say("the layer's position is locked");
      const before = snapStruct(), list = [];
      const all = L.type === "group" ? inGroup(L) : [L];
      for (const x of all) shiftLayer(x, dx, dy, list);
      if (E.moveBoard) E.moveBoard(L, dx, dy);              // 2.447.0: an artboard's rectangle goes with it (pcartboards.js)
      push({ t: "multi", list: list.concat([{ t: "struct", before, after: snapStruct() }]), label: "nudge" });
      refresh(); renderLayersPanel();
    }

    /* ---------------- pointer ---------------- */
    const pressureOf = (e) => (e.pointerType === "mouse" || !e.pressure ? 1 : e.pressure);
    function effectivePreset() {
      const p = B.byId(S.preset);
      if (S.tool !== "erase" && !(S.fgNone && S.tool === "paint")) return p;               // 2.430.0: ⊠ transparent paints transparency
      if (p.engine === "erase") return p;
      if (p.engine !== "paint") return B.byId("erase");
      return Object.assign({}, p, { engine: "erase", blend: null, color: null, id: p.id + "-erase" });
    }
    /** start a brush stroke on what target() names - every brush-like tool comes through here */
    function beginStroke(e, fx, fy, opts) {
      const L = layer();
      if (!L || !B || !canPaint(L)) return false;
      const which = whichOf(L);
      let preset = (opts && opts.preset) || effectivePreset(), color = (opts && opts.color) || S.fg;
      if ((which === "mask" || which === "fmask") && S.tool === "erase") { preset = Object.assign({}, preset, { engine: "paint", blend: null, id: preset.id + "-maskerase" }); color = S.bg; }   // Photoshop: the eraser paints the background colour into a mask
      const c = target(L), copy = beginPx(L, which);
      S.stroke = new B.Stroke(Object.assign({ doc, layer: c, preset, size: S.size, opacity: S.opacity, flow: S.flow, color, selCanvas: S.qm ? null : selCanvas() }, (opts && opts.stroke) || {}));
      S.strokeMask = which === "mask" || which === "fmask";
      S.drag = { paint: true, copy, which, label: (opts && opts.label) || (S.tool === "erase" ? "erase" : "paint") };
      if (e.shiftKey && S.lastPaint) S.stroke.add(S.lastPaint[0], S.lastPaint[1], pressureOf(e));
      S.stroke.add(fx, fy, pressureOf(e));
      stage.setPointerCapture(e.pointerId); renderSoon();
      return true;
    }
    function endStroke(fx, fy, dd) {
      const d = dd || S.drag; if (!d || !d.paint) return;
      if (S.drag === d) S.drag = null;
      const L = layer(), rect = S.stroke.end(); S.stroke = null; S.strokeMask = false;
      S.lastPaint = [fx, fy];
      if (rect) {
        const px = endPx(L, d.copy, rect, d.label, d.which); if (px) push(px);
        // 2.423.0: a tool may finish its stroke itself (the Healing Brush blends it - pcheal.js); px.after follows
        const TT = E.tools[S.tool]; if (TT && TT.after) { try { TT.after(L, d, rect, px); } catch (e) { say(e.message); } }
      }
      if (d.which === "qm") S.qmDirty = true;
      refresh(); renderLayersPanel();
    }
    E.beginStroke = beginStroke; E.endStroke = endStroke; E.pressureOf = pressureOf;
    stage.addEventListener("pointerdown", (e) => {
      if (!S.w) return;
      stage.focus();
      if (pop) { pop.remove(); pop = null; }
      if (E.ui.closeMenus) E.ui.closeMenus();
      const [fx, fy] = E.snapPos ? E.snapPos(e, pos(e)) : pos(e), x = Math.floor(fx), y = Math.floor(fy);   // 2.440.0: snapping (pcguides.js)
      if (e.button === 1 || S.space || S.tool === "hand") { S.drag = { pan: true, x: e.clientX, y: e.clientY, px: S.panX, py: S.panY }; stage.setPointerCapture(e.pointerId); return; }
      if (e.button !== 0) return;
      const T = E.tools[S.tool];
      if (T && T.down) { S.drag = { ext: T }; stage.setPointerCapture(e.pointerId); if (T.down(e, fx, fy) === false) S.drag = null; return; }
      const L = layer();
      if ((S.tool === "paint" || S.tool === "erase") && (e.altKey || e.ctrlKey || e.metaKey)) return pickColor(x, y);   // Alt (Photoshop) / Ctrl picks
      switch (S.tool) {
        case "wand": return applyShape(featherShape(P.wand(ctx(S.sampleAll ? flattenCache() : (layer() || {}).canvas || flattenCache()).getImageData(0, 0, S.w, S.h).data, S.w, S.h, x, y, S.tol, S.contiguous && !e.ctrlKey)), selMode(e), "magic wand");
        case "poly": S.pts.push([fx, fy]); drawOverlay(); return;
        case "picker": S.drag = { pick: true }; stage.setPointerCapture(e.pointerId); return pickColor(x, y, e.altKey);
        case "fill": return fillAt(x, y);
        case "brush": S.drag = { selBrush: true, erase: e.altKey, before: Uint8Array.from(S.sel) }; selBrushAt(fx, fy, e.altKey); stage.setPointerCapture(e.pointerId); return;
        case "paint": case "erase": beginStroke(e, fx, fy); return;
        case "move": {
          if (S.autoSelect || e.ctrlKey || e.metaKey) { const i = layerAt(x, y); if (i >= 0 && i !== S.active) setActive(i); }
          const many = !e.ctrlKey && !e.metaKey && E.multiMove ? E.multiMove(fx, fy) : null;   // 2.474.0: several picked (pcmultisel.js) - they move together
          if (many && many.length > 1) { S.drag = { moveSet: true, multi: many, x0: fx, y0: fy, before: snapStruct(), list: [], last: [0, 0] }; stage.setPointerCapture(e.pointerId); return; }
          const A = layer(); if (!A) return;
          if (A.locks && (A.locks.pos || A.locks.all)) return say("the layer's position is locked");
          if (A.type === "adjust" || (A.type === "fill" && !A.mask)) return say(`a ${A.type} layer covers the whole picture - nothing to move`);
          if (A.type !== "pixel") {                      // text / shape / group / fill (its mask): live settings, one step
            S.drag = { moveSet: true, x0: fx, y0: fy, before: snapStruct(), list: [], last: [0, 0] };
            stage.setPointerCapture(e.pointerId); return;
          }
          const copy = beginPx(A), c = newCanvas(S.w, S.h), g = ctx(c);
          let sc = selCanvas();
          g.drawImage(A.canvas, 0, 0);
          // 2.550.0 (Tim: "the move tool doesn't work. make the move tool move the selection or layer"): a selection with
          // none of this layer's pixels in it (a pasted layer sits elsewhere) moved nothing - the whole layer moves then
          if (sc) { g.globalCompositeOperation = "destination-in"; g.drawImage(sc, 0, 0); g.globalCompositeOperation = "source-over"; if (!alphaBox(c)) { g.clearRect(0, 0, S.w, S.h); g.drawImage(A.canvas, 0, 0); sc = null; } }
          if (sc) { const lg = ctx(A.canvas); lg.save(); lg.globalCompositeOperation = "destination-out"; lg.drawImage(sc, 0, 0); lg.restore(); }
          else ctx(A.canvas).clearRect(0, 0, S.w, S.h);
          S.float = { c, dx: 0, dy: 0 }; S.drag = { move: true, x0: fx, y0: fy, copy, selBefore: S.sel ? Uint8Array.from(S.sel) : null, whole: !sc };
          stage.setPointerCapture(e.pointerId); renderSoon(); return;
        }
        default:                                         // rect / ellipse / lasso
          S.drag = { x0: x, y0: y, pts: [[fx, fy]], mode: selMode(e) }; stage.setPointerCapture(e.pointerId);
      }
    });
    stage.addEventListener("pointermove", (e) => {
      if (!S.w) return;
      const [fx, fy] = E.snapPos ? E.snapPos(e, pos(e)) : pos(e), x = Math.floor(fx), y = Math.floor(fy);   // 2.440.0: snapping (pcguides.js)
      cursor = [fx, fy];
      const d = S.drag;
      if (E.ui.rulers && kx.classList.contains("rulers")) E.ui.rulers(cursor);
      if (!d) { const T = E.tools[S.tool]; if (T && T.hover) T.hover(e, fx, fy); if (["paint", "erase", "brush"].includes(S.tool) || (T && (T.brush || T.hover))) drawOverlay(); return; }
      if (d.pan) { S.panX = d.px + e.clientX - d.x; S.panY = d.py + e.clientY - d.y; S.userView = true; applyView(); return; }
      if (d.ext) { if (d.ext.move) d.ext.move(e, fx, fy); return; }
      if (d.pick) { pickColor(x, y, e.altKey); return; }
      if (d.selBrush) { selBrushAt(fx, fy, d.erase); return; }
      if (d.paint) {
        const evs = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
        for (const ce of (evs.length ? evs : [e])) { const [cx, cy] = pos(ce); S.stroke.add(cx, cy, pressureOf(ce)); }
        renderSoon(); return;
      }
      if (d.move) { let dx = Math.round(fx - d.x0), dy = Math.round(fy - d.y0); if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } S.float.dx = dx; S.float.dy = dy; renderSoon(); return; }
      if (d.moveSet) {
        let dx = Math.round(fx - d.x0), dy = Math.round(fy - d.y0); if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        const ddx = dx - d.last[0], ddy = dy - d.last[1]; if (!ddx && !ddy) return;
        d.last = [dx, dy];
        const A = layer(), all = d.multi ? d.multi : A.type === "group" ? inGroup(A) : [A];
        for (const L of all) shiftLayer(L, ddx, ddy, d.list);
        if (E.moveBoard) E.moveBoard(A, ddx, ddy);          // 2.447.0: an artboard's rectangle goes with it
        renderSoon(); return;
      }
      if (S.tool === "lasso") { d.pts.push([fx, fy]); S.pts = d.pts; drawOverlay(); return; }
      let ex = x, ey = y;
      if (e.shiftKey && (S.tool === "rect" || S.tool === "ellipse")) { const s = Math.max(Math.abs(x - d.x0), Math.abs(y - d.y0)); ex = d.x0 + Math.sign(x - d.x0 || 1) * s; ey = d.y0 + Math.sign(y - d.y0 || 1) * s; }
      if (S.tool === "rect") S.pts = [[d.x0, d.y0], [ex, d.y0], [ex, ey], [d.x0, ey], [d.x0, d.y0]];
      if (S.tool === "ellipse") {
        const cx = (d.x0 + ex) / 2, cy = (d.y0 + ey) / 2, rx = Math.abs(ex - d.x0) / 2, ry = Math.abs(ey - d.y0) / 2;
        S.pts = Array.from({ length: 41 }, (_, i) => [cx + rx * Math.cos(i / 40 * Math.PI * 2), cy + ry * Math.sin(i / 40 * Math.PI * 2)]);
      }
      d.ex = ex; d.ey = ey;
      drawOverlay();
    });
    /** the options bar's Feather on a new selection shape */
    function featherShape(m) { const f = S.selFeather || 0; return f > 0 ? P.feather(P.morph(m, S.w, S.h, Math.round(f / 2)), S.w, S.h, f) : m; }
    const up = (e) => {
      const d = S.drag; if (!d) return;
      S.drag = null;
      if (d.pan || d.pick) return;
      const [fx, fy] = E.snapPos ? E.snapPos(e, pos(e)) : pos(e), x = Math.floor(fx), y = Math.floor(fy);   // 2.440.0: snapping (pcguides.js)
      if (d.ext) { if (d.ext.up) d.ext.up(e, fx, fy); return; }
      if (d.selBrush) { push({ t: "sel", before: d.before, after: Uint8Array.from(S.sel), label: "selection brush" }); info(); return; }
      if (d.paint) { endStroke(fx, fy, d); return; }
      if (d.move) {
        const L = layer(), g = ctx(L.canvas); g.drawImage(S.float.c, S.float.dx, S.float.dy);
        const { dx, dy } = S.float; S.float = null;
        const list = [endPx(L, d.copy, null, "move")];
        if (d.whole) shiftMask(L, dx, dy, list);
        if (d.whole && L.vmask && L.vmask.linked !== false && (dx || dy) && E.shiftVmask) { const vb = snapStruct(); E.shiftVmask(L, dx, dy); list.push({ t: "struct", before: vb, after: snapStruct() }); }
        if (d.selBefore && hasSel() && (dx || dy)) { const nx = P.shift(S.sel, S.w, S.h, dx, dy); list.push({ t: "sel", before: d.selBefore, after: Uint8Array.from(nx) }); setSel(nx, true); }
        push({ t: "multi", list: list.filter(Boolean), label: "move" }); refresh(); renderLayersPanel(); return;
      }
      if (d.moveSet) { if (d.last[0] || d.last[1]) push({ t: "multi", list: d.list.concat([{ t: "struct", before: d.before, after: snapStruct() }]), label: "move" }); refresh(); renderLayersPanel(); return; }
      if (S.tool === "lasso") { S.pts = []; if (d.pts.length > 2) applyShape(featherShape(P.polygonMask(d.pts, S.w, S.h)), d.mode, "freehand select"); else drawOverlay(); return; }
      S.pts = [];
      const ex = d.ex == null ? x : d.ex, ey = d.ey == null ? y : d.ey;
      if (ex === d.x0 && ey === d.y0) { if (d.mode === "replace") changeSel(new Uint8Array(S.w * S.h), "deselect"); drawOverlay(); return; }
      let shape;
      if (S.tool === "rect") shape = P.rectMask(d.x0, d.y0, ex + (ex >= d.x0 ? 1 : 0), ey + (ey >= d.y0 ? 1 : 0), S.w, S.h);
      else if (S.tool === "ellipse") shape = P.ellipseMask((d.x0 + ex) / 2, (d.y0 + ey) / 2, Math.abs(ex - d.x0) / 2, Math.abs(ey - d.y0) / 2, S.w, S.h);
      if (shape) applyShape(featherShape(shape), d.mode, S.tool + " select");
    };
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("pointerleave", () => { cursor = null; if (!S.drag) drawOverlay(); });
    stage.addEventListener("dblclick", (e) => {
      if (S.tool === "poly" && S.pts.length >= 3) { closePoly(); return; }
      const T = E.tools[S.tool]; if (T && T.dblclick) { const [fx, fy] = pos(e); T.dblclick(e, fx, fy); }
    });
    stage.addEventListener("wheel", (e) => {
      if (!S.w) return;
      e.preventDefault();
      if (e.shiftKey) { S.panX -= e.deltaY; S.userView = true; applyView(); return; }
      if (!(e.ctrlKey || e.altKey) && E.ui.wheelPans && E.ui.wheelPans()) { S.panX -= e.deltaX; S.panY -= e.deltaY; S.userView = true; applyView(); return; }
      const r = stage.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    function closePoly() { const pts = S.pts; S.pts = []; applyShape(featherShape(P.polygonMask(pts, S.w, S.h)), S.mode, "polygon select"); }
    function selBrushAt(x, y, erase) {
      const r = S.selBrush / 2, shape = P.ellipseMask(x, y, r, r, S.w, S.h);
      S.sel = P.combine(S.sel, shape, erase ? "subtract" : "add"); setSel(S.sel);
    }
    let flatCache = null;
    function flattenCache() { flatCache = flatten(); return flatCache; }
    function pickColor(x, y, toBg) {
      const src = S.sampleAll ? flattenCache() : (layer() && layer().type !== "group" && layer().type !== "adjust" ? layer().canvas : flattenCache());
      const g = ctx(src); if (!g) return;
      const d = g.getImageData(Math.max(0, Math.min(S.w - 1, x)), Math.max(0, Math.min(S.h - 1, y)), 1, 1).data;
      const hex = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
      if (toBg) setBg(hex); else setFg(hex);
      say(`picked ${hex}${toBg ? " (background)" : ""}`);
    }
    function fillAt(x, y) {
      const L = layer(); if (!L || !canPaint(L)) return;
      pxOp("fill", (c, g) => {
        let region;
        if (hasSel() && S.sel[y * S.w + x]) region = S.sel;
        else {
          const src = S.sampleAll && !S.qm && !onMask(L) ? flattenCache() : c;
          region = P.wand(ctx(src).getImageData(0, 0, S.w, S.h).data, S.w, S.h, x, y, S.tol, true);
          if (hasSel()) region = P.combine(Uint8Array.from(region), S.sel, "intersect");
        }
        const t = newCanvas(S.w, S.h), cg = ctx(t), id = cg.createImageData(S.w, S.h), [r, gg, b] = B.hexRgb(S.fg);
        for (let i = 0; i < region.length; i++) if (region[i]) { id.data[i * 4] = r; id.data[i * 4 + 1] = gg; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = region[i]; }
        cg.putImageData(id, 0, 0);
        if (S.fgNone) { g.save(); g.globalCompositeOperation = "destination-out"; g.drawImage(t, 0, 0); g.restore(); } else g.drawImage(t, 0, 0);   // 2.430.0
      });
    }
    function clearSelectionArea() {
      const L = layer(); if (!L || !hasSel()) return say("select an area to clear");
      if (onMask(L)) return pxOp("clear mask", (c, g) => { const t = newCanvas(S.w, S.h), tg = ctx(t); tg.fillStyle = "#000"; tg.fillRect(0, 0, S.w, S.h); tg.globalCompositeOperation = "destination-in"; tg.drawImage(selCanvas(), 0, 0); g.drawImage(t, 0, 0); });
      pxOp("clear", (c, g) => { g.save(); g.globalCompositeOperation = "destination-out"; g.drawImage(selCanvas(), 0, 0); g.restore(); });
    }
    /** Edit ▸ Fill: the selection (or everything) with a colour, at an opacity / blend */
    function fillSelection(color, opacity, blend) {
      return pxOp("fill", (c, g) => {
        const t = newCanvas(S.w, S.h), tg = ctx(t); tg.fillStyle = color || S.fg; tg.fillRect(0, 0, S.w, S.h);
        const sc = selCanvas(); if (sc) { tg.globalCompositeOperation = "destination-in"; tg.drawImage(sc, 0, 0); }
        g.save(); g.globalAlpha = opacity == null ? 1 : opacity; g.globalCompositeOperation = B ? B.compositeOf(blend || "normal") : "source-over"; g.drawImage(t, 0, 0); g.restore();
      });
    }
    function fillSelectionFg() { if (!hasSel()) return say("select an area to fill"); if (S.fgNone) return clearSelectionArea(); fillSelection(S.fg); }

    /* ---------------- selection commands ---------------- */
    const needDoc = (f) => () => { if (!S.w) return say("open a picture first"); return f(); };
    const selectAll = needDoc(() => changeSel(new Uint8Array(S.w * S.h).fill(255), "select all"));
    const deselect = needDoc(() => changeSel(new Uint8Array(S.w * S.h), "deselect"));
    const reselect = needDoc(() => { if (!S.lastSel) return say("nothing to reselect"); changeSel(Uint8Array.from(S.lastSel), "reselect"); });
    const selectInverse = needDoc(() => changeSel(P.invert(S.sel), "inverse"));
    function modifySel(kind, px) {
      if (!S.w) return;
      const n = Math.max(1, Math.min(500, +px || 8));
      if (kind === "expand") changeSel(P.morph(S.sel, S.w, S.h, n), "expand");
      else if (kind === "contract") changeSel(P.morph(S.sel, S.w, S.h, -n), "contract");
      else if (kind === "border") changeSel(P.border(S.sel, S.w, S.h, n), "border");
      else if (kind === "smooth") changeSel(P.smooth(S.sel, S.w, S.h, n), "smooth");
      else if (kind === "feather") { const g = P.morph(S.sel, S.w, S.h, Math.round(n / 2)); changeSel(P.feather(g, S.w, S.h, n), "feather"); }
    }
    /** Select ▸ Color Range: every pixel near the foreground colour (fuzziness 0..255) */
    function colorRange(hex, fuzz) {
      if (!S.w) return;
      const [r, g, b] = B.hexRgb(hex || S.fg), d = ctx(flattenCache()).getImageData(0, 0, S.w, S.h).data, m = new Uint8Array(S.w * S.h), f = Math.max(1, +fuzz || 40);
      for (let i = 0; i < m.length; i++) { const dist = Math.max(Math.abs(d[i * 4] - r), Math.abs(d[i * 4 + 1] - g), Math.abs(d[i * 4 + 2] - b)); m[i] = dist <= f ? Math.round(255 * (1 - (dist / f) * 0.5)) : 0; }
      changeSel(m, "color range");
    }
    /* quick mask (Q): the selection as a red overlay you paint - brush adds, eraser removes */
    function quickMask(on) {
      if (!S.w) return;
      on = on == null ? !S.qm : !!on;
      if (on && !S.qm) {
        const c = newCanvas(S.w, S.h), g = ctx(c), id = g.createImageData(S.w, S.h);
        for (let i = 0; i < S.sel.length; i++) id.data[i * 4 + 3] = S.sel[i];
        g.putImageData(id, 0, 0); S.qm = c; S.qmBefore = Uint8Array.from(S.sel);
        if (!["paint", "erase", "fill"].includes(S.tool)) setTool("paint");
        say("Quick Mask: paint (B) adds to the selection, the eraser (E) takes away; Q again makes it the selection");
      } else if (!on && S.qm) {
        const d = ctx(S.qm).getImageData(0, 0, S.w, S.h).data, m = new Uint8Array(S.w * S.h);
        for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
        // the strokes made in quick mask fold into ONE selection step
        while (S.undo.length && S.undo[S.undo.length - 1].qm) S.undo.pop();
        S.qm = null; setSel(m); push({ t: "sel", before: S.qmBefore || new Uint8Array(S.w * S.h), after: Uint8Array.from(m), label: "quick mask" });
      }
      refresh(); if (E.ui.qm) E.ui.qm(!!S.qm);
    }

    /* ---------------- colours ---------------- */
    /* 2.430.0: S.lastColor = the colour picked last (the palette, a swatch, the pickers, the eyedropper - "none" for ⊠):
       closed curves / shapes are filled with it (pcpalette.js); S.fgNone = the foreground is ⊠ transparent - a brush
       erases, the bucket / Fill clear */
    function setFg(v) { S.fg = v; S.fgNone = false; S.lastColor = v; $("kxFg").value = v; store.set("fg", v); store.set("lastColor", v); paintNone(); if (E.ui.color) E.ui.color(); }
    function setBg(v) { S.bg = v; S.lastColor = v; $("kxBg").value = v; store.set("bg", v); store.set("lastColor", v); if (E.ui.color) E.ui.color(); }
    function setFgNone() { S.fgNone = true; S.lastColor = "none"; store.set("lastColor", "none"); paintNone(); if (E.ui.color) E.ui.color(); }
    function paintNone() { const sw = kx.querySelector(".kxsw"); if (sw) sw.classList.toggle("fgnone", !!S.fgNone); }
    S.lastColor = store.get("lastColor", S.fg); S.fgNone = false;
    $("kxFg").value = S.fg; $("kxBg").value = S.bg;
    $("kxFg").oninput = () => setFg($("kxFg").value);
    $("kxBg").oninput = () => setBg($("kxBg").value);
    $("kxSwap").onclick = () => { const f = S.fg; setFg(S.bg); setBg(f); };
    $("kxDef").onclick = () => { setFg("#000000"); setBg("#ffffff"); };

    /* ---------------- buttons ---------------- */
    $("kxUndo").onclick = undo; $("kxRedo").onclick = redo;
    $("kxZin").onclick = () => zoomAt(1.25); $("kxZout").onclick = () => zoomAt(0.8);
    $("kxFit").onclick = () => { S.userView = false; fitView(); }; $("kx100").onclick = () => zoomAt(1 / S.zoom);
    $("ieOpen").onclick = () => { $("ieFile").dataset.layer = ""; $("ieFile").click(); };
    $("ieFile").onchange = (e) => { const f = e.target.files[0]; if (f) load(URL.createObjectURL(f), f.name, !!$("ieFile").dataset.layer); e.target.value = ""; };
    async function saveToImages(blob, name) {
      if (!S.w) { say("nothing to save"); return null; }
      blob = blob || await new Promise((r) => flatten().toBlob(r, "image/png"));
      name = name || (S.name || "edited").replace(/\.[a-z0-9]+$/i, "") + "-edit-" + Date.now().toString(36) + ".png";
      if (api && api.save) { const saved = await api.save(blob, name); say(saved ? `saved as ${saved}` : "save failed"); return saved; }
      return null;
    }
    $("ieSave").onclick = () => saveToImages();
    $("kxLAdd").onclick = () => { if (S.w) newLayer(); };
    $("kxLDup").onclick = () => { if (S.w) duplicateLayer(); };
    $("kxLCopy").onclick = () => layerFromSelection();
    $("kxLUp").onclick = () => moveLayer(1);
    $("kxLDown").onclick = () => moveLayer(-1);
    $("kxLDel").onclick = () => E.deleteLayer();   // 2.547.0: E. - every picked layer (pcmultisel.js)
    $("kxLMerge").onclick = () => mergeDown();
    $("kxLMask").onclick = () => { if (S.w) addMask(); };
    $("kxLGroup").onclick = () => { if (S.w) newGroup(); };
    $("kxBlend").onchange = () => structOp("blend mode", () => { layer().blend = $("kxBlend").value; });
    const setOpacity = (v, commit) => {
      const L = layer(); if (!L) return;
      v = Math.max(0, Math.min(100, Math.round(+v || 0)));
      if (commit) structOp("opacity", () => { L.opacity = v / 100; }); else { L.opacity = v / 100; renderSoon(); }
      $("kxLOpacity").value = v; $("kxLOpacityN").value = v; $("kxLOpacityV").textContent = v + "%";
    };
    let opBefore = null;
    $("kxLOpacity").oninput = () => { if (!opBefore && layer()) opBefore = layer().opacity; setOpacity($("kxLOpacity").value, false); };
    $("kxLOpacity").onchange = () => { const L = layer(); if (L && opBefore != null) { const v = L.opacity; L.opacity = opBefore; opBefore = null; setOpacity(v * 100, true); } };
    $("kxLOpacityN").onchange = () => setOpacity($("kxLOpacityN").value, true);
    $("pcFill").onchange = () => { const L = layer(); if (!L) return; const v = Math.max(0, Math.min(100, +$("pcFill").value || 0)); structOp("fill opacity", () => { L.fillOpacity = v / 100; }); };
    host.querySelectorAll("#pcLocks [data-lock]").forEach((b) => { b.onclick = () => { const L = layer(); if (!L) return; structOp("lock", () => { L.locks = Object.assign({}, L.locks || {}); L.locks[b.dataset.lock] = !L.locks[b.dataset.lock]; }); }; });

    /* ---------------- keyboard (only while the editor has focus) ---------------- */
    /* 2.549.0 (Tim: "group layers work from the context menu but not with the shortcut keys"): a click in the Layers
       panel (a row is not focusable) left the focus on the page - Ctrl+G / Ctrl+E / Shift+Del never reached the editor.
       A press anywhere in the editor that is not a box or a button hands the focus to the canvas (no scroll). */
    host.addEventListener("pointerdown", (e) => {
      const t = e.target;
      if (!t || !t.closest || t.closest("input, textarea, select, button, [contenteditable], a, .h3fp-t, #ieBlendWrap")) return;   // 2.550.0: not the Blender view (its own keys)
      root.setTimeout(() => { const a = doc.activeElement; if (!a || a === doc.body || !host.contains(a)) { try { stage.focus({ preventScroll: true }); } catch (er) { stage.focus(); } } }, 0);
    }, true);
    host.addEventListener("keydown", (e) => {
      const t = e.target, tag = (t && t.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag) && t.type !== "range") return;
      if (t && t.isContentEditable) return;
      const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
      // the tool in charge first (Enter / Esc on a crop, a transform, a text), then the shortcuts (pcui), then the core
      const T = E.tools[S.tool];
      if (T && T.key && T.key(e) === true) { e.preventDefault(); e.stopPropagation(); return; }
      if (E.ui.key && E.ui.key(e) === true) { e.preventDefault(); e.stopPropagation(); return; }
      let done = true;
      if (c && k === "z" && !e.shiftKey && !e.altKey) undo();
      else if ((c && k === "z" && e.shiftKey) || (c && k === "y")) redo();
      else if (c) done = false;
      else if (k === " ") { S.space = true; stage.style.cursor = "grab"; }
      else if (k === "enter") { if (S.tool === "poly" && S.pts.length >= 3) closePoly(); else if (S.results.length) applyResult(); else done = false; }
      else if (k === "escape") { if (S.pts.length) { S.pts = []; drawOverlay(); } else if (S.results.length) discardResults(); else if (S.viewMask) { S.viewMask = false; renderLayers(); } else if (fullOn()) setFull(false); else done = false; }
      else if (k === "delete") { if (hasSel()) clearSelectionArea(); else if (layer()) deleteLayer(); else done = false; }   // 2.451.0 (Tim): Del deletes the current layer (a selection: clears it, Photoshop's)
      else if (k === "backspace") fillSelectionFg();
      else if (k === "[") { setSize(S.size / 1.15); renderOptions(); }
      else if (k === "]") { setSize(S.size * 1.15); renderOptions(); }
      else if (S.tool === "move" && /^arrow/.test(k)) { const n = e.shiftKey ? 10 : 1; nudge(k === "arrowleft" ? -n : k === "arrowright" ? n : 0, k === "arrowup" ? -n : k === "arrowdown" ? n : 0); }
      else done = false;
      if (done) { e.preventDefault(); e.stopPropagation(); }
    });
    host.addEventListener("keyup", (e) => { if (e.key === " ") { S.space = false; setTool(S.tool); } });

    /* ---------------- ◈ CONTROL LAYERS (2.333.0) ----------------
       Krita AI Diffusion's control layers, ours: a layer with `control`
       {type, strength, start, end, model, on} guides Generate / Refine /
       Remove / Background through a ControlNet (image_worker chains one
       ControlNetApplyAdvanced per layer on the primary sampler). It is drawn
       by hand or made with "From image" (the type's preprocessor on the
       picture). LINE types (scribble, line art, soft edge, canny) are shown
       the way you draw them - dark lines on transparent - and sent the way a
       ControlNet reads them: white lines on black. Control layers are never
       part of the picture (flatten skips them). */
    const CTL_TYPES_DEFAULT = [["scribble", "Scribble", true], ["lineart", "Line art", true], ["softedge", "Soft edge", true],
      ["canny", "Canny edge", true], ["depth", "Depth", false], ["normal", "Normal map", false], ["pose", "Pose", false], ["segmentation", "Segmentation", false]]
      .map(([id, label, lines]) => ({ id, label, lines }));
    const ctlTypes = () => (S.engines && S.engines.control_types) || CTL_TYPES_DEFAULT;
    const ctlLabel = (t) => ((ctlTypes().find((x) => x.id === t) || {}).label || t);
    const isLines = (t) => !!(ctlTypes().find((x) => x.id === t) || {}).lines;
    let cnModels = { models: [], suggest: {} };
    async function paintControlNets() {
      if (!api || !api.controlnets) return;
      try { cnModels = (await api.controlnets()) || cnModels; } catch { /* offline */ }
      renderControls();
    }
    function paintCtlTypes() {
      const sel = $("kxCtlType"), want = sel.value || store.get("ctltype", "scribble");
      sel.innerHTML = ctlTypes().map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
      sel.value = ctlTypes().some((t) => t.id === want) ? want : "scribble";
    }
    $("kxCtlType").onchange = () => store.set("ctltype", $("kxCtlType").value);
    function newControl(type) { return { type, strength: isLines(type) ? 0.8 : 0.7, start: 0, end: 1, model: "", on: true }; }
    $("kxCtlAdd").onclick = needDocCtl(() => {
      const type = $("kxCtlType").value;
      const L = makeLayer(`${ctlLabel(type)} control`); L.control = newControl(type); L.opacity = isLines(type) ? 1 : 0.6;
      addLayer(L, "new control layer", false);
      if (isLines(type)) { choosePreset("ink"); setFg("#000000"); }
      say(`${ctlLabel(type)} control layer added - ` + (isLines(type) ? "draw the lines with the brush, or ⟲ From image" : "⟲ From image makes it from the picture"));
    });
    $("kxCtlMake").onclick = needDocCtl(() => {
      const L = layer(), type = $("kxCtlType").value;
      if (S.active === 0 && S.layers.length === 1) return say("the only layer is the picture - add a control layer (＋ layer) instead");
      structOp("make control layer", () => { L.control = newControl(type); });
    });
    function needDocCtl(f) { return () => { if (!S.w) return say("open a picture first"); f(); }; }
    function ctlStruct(L, label, f) { const before = snapStruct(); f(); push({ t: "struct", before, after: snapStruct(), label }); refresh(); renderLayersPanel(); }
    function renderControls() {
      const box = $("kxCtlList"); if (!box) return;
      const list = S.layers.map((L, i) => [L, i]).filter(([L]) => L.control).reverse();
      if (!list.length) { box.innerHTML = `<div class="kxrow" style="font-size:11px">No control layers. Pick a type and ＋ layer, then draw on it or ⟲ From image.</div>`; return; }
      box.innerHTML = "";
      for (const [L, i] of list) {
        const c = L.control, el = doc.createElement("div"); el.className = "kxctl" + (c.on ? "" : " off");
        const auto = cnModels.suggest && cnModels.suggest[c.type];
        const opts = [`<option value="">auto${auto ? ` (${auto.split(/[\\/]/).pop()})` : " - none found"}</option>`]
          .concat((cnModels.models || []).map((m) => `<option value="${m.replace(/"/g, "&quot;")}"${m === c.model ? " selected" : ""}>${m.split(/[\\/]/).pop()}</option>`));
        el.innerHTML = `
          <div class="hd"><input type="checkbox" class="on" ${c.on ? "checked" : ""} title="Use this control layer on the next ✨ run">
            <span class="nm" title="Select the layer">${(i === S.active ? "▸ " : "")}${L.name.replace(/</g, "&lt;")}</span>
            <button class="ghost fi" title="Make it from the picture (the ${ctlLabel(c.type)} preprocessor on the visible layers)">⟲ From image</button>
            <button class="ghost rm" title="Make it an ordinary layer again">✕</button></div>
          <div class="kxrow"><select class="ty">${ctlTypes().map((t) => `<option value="${t.id}"${t.id === c.type ? " selected" : ""}>${t.label}</option>`).join("")}</select>
            <select class="md" title="The ControlNet model (ComfyUI's models/controlnet). auto = one whose name says the type, else a union / ProMax model">${opts.join("")}</select></div>
          <div class="rg"><span>strength</span><input type="range" class="st" min="0" max="2" step="0.05" value="${c.strength}"><span class="v st">${c.strength}</span>
            <span title="Where in the sampling the control starts guiding">start</span><input type="range" class="s0" min="0" max="95" step="5" value="${Math.round(c.start * 100)}"><span class="v s0">${Math.round(c.start * 100)}%</span>
            <span title="Where it stops guiding">end</span><input type="range" class="s1" min="5" max="100" step="5" value="${Math.round(c.end * 100)}"><span class="v s1">${Math.round(c.end * 100)}%</span></div>`;
        const q = (sel) => el.querySelector(sel);
        q(".nm").onclick = () => setActive(i);
        q("input.on").onchange = () => ctlStruct(L, "control on/off", () => { c.on = q("input.on").checked; });
        q(".rm").onclick = () => ctlStruct(L, "not a control layer", () => { L.control = null; });
        q(".ty").onchange = () => ctlStruct(L, "control type", () => { c.type = q(".ty").value; });
        q(".md").onchange = () => { c.model = q(".md").value; };
        const rng = (cls, fmt, set) => { const r = q("input." + cls); r.oninput = () => { set(+r.value); q("span.v." + cls).textContent = fmt(+r.value); }; };
        rng("st", (v) => v, (v) => { c.strength = v; });
        rng("s0", (v) => v + "%", (v) => { c.start = v / 100; if (c.end <= c.start) { c.end = Math.min(1, c.start + 0.05); } });
        rng("s1", (v) => v + "%", (v) => { c.end = v / 100; if (c.end <= c.start) { c.start = Math.max(0, c.end - 0.05); } });
        q(".fi").onclick = () => controlFromImage(L);
        box.appendChild(el);
      }
    }
    /** "From image": the visible picture through the type's preprocessor,
     *  back into the control layer (line maps as dark lines on transparent). */
    async function controlFromImage(L) {
      if (!api || !api.preprocess) return say("not connected (reload the page)");
      if (S.busy) return say("still working on the last one");
      const type = L.control.type;
      S.busy = true;
      say(`⟲ ${ctlLabel(type)} from the picture…`);
      try {
        const url = await api.preprocess(await blobOf(flatten()), type, say);
        if (!url) return;
        const im = await imgOf(url);
        const copy = beginPx(L), g = ctx(L.canvas);
        g.clearRect(0, 0, S.w, S.h);
        if (isLines(type)) {
          const t = newCanvas(S.w, S.h), tg = ctx(t); tg.drawImage(im, 0, 0, S.w, S.h);
          const d = tg.getImageData(0, 0, S.w, S.h);
          for (let i = 0; i < d.data.length; i += 4) {           // white lines on black -> black lines, alpha = the line
            const v = Math.max(d.data[i], d.data[i + 1], d.data[i + 2]);
            d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = v;
          }
          g.putImageData(d, 0, 0);
        } else g.drawImage(im, 0, 0, S.w, S.h);
        const px = endPx(L, copy, null, "control from image"); if (px) push(px);
        refresh(); renderLayersPanel();
        say(`${ctlLabel(type)} control made from the picture - edit it with the brush / eraser if you like`);
      } catch (e) { say("From image failed: " + e.message); }
      finally { S.busy = false; }
    }
    /** A control layer as the ControlNet reads it, for the crop box at the render size. */
    function controlImage(L, box, fit) {
      const c = newCanvas(fit.w, fit.h), g = ctx(c);
      const lines = isLines(L.control.type);
      g.fillStyle = lines ? "#ffffff" : "#000000"; g.fillRect(0, 0, fit.w, fit.h);
      g.drawImage(L.canvas, box.x, box.y, box.w, box.h, 0, 0, fit.w, fit.h);
      if (lines) { g.globalCompositeOperation = "difference"; g.fillStyle = "#ffffff"; g.fillRect(0, 0, fit.w, fit.h); g.globalCompositeOperation = "source-over"; }
      return c;
    }
    function activeControls() { return S.layers.filter((L) => L.control && L.control.on).slice(0, 4); }

    /* ---------------- 🎚 ADJUST / ✦ FILTER (2.333.0; 2.389.0: Image ▸ Adjustments / the Filter menu) ----------------
       filters.js does the pixels; here: the dialog with a live preview on what target() names (the layer, its mask
       or the quick mask - inside the selection, blended by its soft edge), OK = one undo step, Cancel = as it was,
       Ctrl+F = again. */
    let fxDlg = null, fxLast = null;
    /** The region a filter works on: the selection's box grown by the
     *  filter's reach (so a blur sees the pixels around it), or everything. */
    function fxRegion(f, params) {
      if (!hasSel() || S.qm) return { x: 0, y: 0, w: S.w, h: S.h };
      const b = P.bbox(S.sel, S.w, S.h), pad = FX.pad(f, params);
      const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
      return { x, y, w: Math.min(S.w, b.x + b.w + pad) - x, h: Math.min(S.h, b.y + b.h + pad) - y };
    }
    function fxCompute(f, params, copy, tgt) {
      const R = fxRegion(f, params), g0 = ctx(copy);
      const orig = g0.getImageData(R.x, R.y, R.w, R.h);
      const out = FX.run(f.id, orig.data, R.w, R.h, params, { x: R.x, y: R.y, W: S.w, H: S.h });
      const m = hasSel() && !S.qm ? P.cropMask(S.sel, S.w, R) : null;
      const blended = new win.ImageData(Uint8ClampedArray.from(orig.data), R.w, R.h);
      FX.blend(blended.data, out, m);
      const g1 = ctx(tgt);
      g1.putImageData(g0.getImageData(0, 0, S.w, S.h), 0, 0);            // back to the original first
      g1.putImageData(blended, R.x, R.y);
      return R;
    }
    function paramHtml(q, v) {
      if (E.paramTypes && E.paramTypes[q.type]) return E.paramTypes[q.type].html(q, v, E);   // 2.480.0: kinds of their own (filters2.js)
      if (q.type === "range") return `<div class="rw"><label>${q.label}</label><input type="range" data-p="${q.id}" min="${q.min}" max="${q.max}" step="${q.step}" value="${v}"><input type="number" data-n="${q.id}" min="${q.min}" max="${q.max}" step="${q.step}" value="${v}"></div>`;
      if (q.type === "select") return `<div class="rw"><label>${q.label}</label><select data-p="${q.id}" style="grid-column:1/3">${q.options.map((o) => `<option${o === v ? " selected" : ""}>${o}</option>`).join("")}</select></div>`;
      if (q.type === "color") return `<div class="rw"><span>${q.label}</span><input type="color" data-p="${q.id}" value="${v}"></div>`;
      if (q.type === "curve") return `<div class="rw" style="display:block"><label>${q.label}</label><div data-curve="${q.id}"></div></div>`;
      return `<div class="rw"><label><input type="checkbox" data-p="${q.id}" ${v ? "checked" : ""}> ${q.label}</label></div>`;
    }
    /** wire a block of param controls to `params`, calling changed() on every edit (dialogs + Properties) */
    function bindParams(box, f, params, changed) {
      box.querySelectorAll("[data-p]").forEach((el) => {
        const id2 = el.dataset.p, q = f.params.find((x) => x.id === id2), num = box.querySelector(`[data-n="${id2}"]`);
        const read = () => (q.type === "check" ? el.checked : q.type === "select" || q.type === "color" ? el.value : +el.value);
        el.oninput = el.onchange = (ev) => { params[id2] = read(); if (num) num.value = el.value; changed(ev && ev.type === "change"); };
        if (num) num.onchange = () => { el.value = num.value; params[id2] = +num.value; changed(true); };
      });
      box.querySelectorAll("[data-curve]").forEach((el) => {
        const id2 = el.dataset.curve;
        if (E.ui.curveWidget) E.ui.curveWidget(el, params[id2], (v, done) => { params[id2] = v; changed(done); });
      });
      box.querySelectorAll("[data-pt]").forEach((el) => {                 // 2.480.0: kinds of their own (filters2.js)
        const T = E.paramTypes && E.paramTypes[el.dataset.pt], q = f.params.find((x) => x.id === el.dataset.pid);
        if (T && q) T.bind(el, q, params, changed, E);
      });
    }
    function openFilter(id, again) {
      const f = FX.byId(id), L = layer();
      if (!S.w || !L) return say("open a picture first");
      if (!canPaint(L)) return;
      if (fxDlg) fxDlg.cancel();
      const which = whichOf(L), tgt = target(L);
      const params = Object.assign(FX.defaults(f), again && fxLast && fxLast.id === id ? D.clone(fxLast.params) : D.clone(store.get("fx." + id, {})));
      const copy = beginPx(L, which);
      if (again || !f.params.length) {                                  // no dialog: straight on
        const R = fxCompute(f, params, copy, tgt);
        const px = endPx(L, copy, R, f.name, which); if (px) push(px);
        fxLast = { id, params }; refresh(); renderLayersPanel();
        if (E.onFilterDone) E.onFilterDone(id, D.clone(params));                 // 2.427.0: Actions record it
        return say(`${f.name} applied${hasSel() ? " inside the selection" : ""} - Ctrl+Z undoes, Ctrl+F repeats`);
      }
      const dlg = doc.createElement("div"); dlg.className = "kxdlg";
      dlg.innerHTML = `<h4>${f.name}</h4>` + f.params.map((q) => paramHtml(q, params[q.id])).join("") + `<div class="bt"><label style="margin-right:auto;color:var(--pc-dim)"><input type="checkbox" class="pv" checked> Preview</label>
        <button class="ghost rs" title="Back to the defaults">Reset</button><button class="ghost cn">Cancel</button><button class="ghost ok">OK</button></div>`;
      kx.appendChild(dlg);
      if (E.ui.dragDialog) E.ui.dragDialog(dlg);
      let timer = null, done = false;
      const preview = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (done) return;
          if (dlg.querySelector(".pv").checked) fxCompute(f, params, copy, tgt); else ctx(tgt).putImageData(ctx(copy).getImageData(0, 0, S.w, S.h), 0, 0);
          if (which === "mask") L.mask.ver++;
          renderSoon();
        }, S.w * S.h > 3e6 ? 260 : 90);
      };
      bindParams(dlg, f, params, preview);
      dlg.querySelector(".pv").onchange = preview;
      // 2.397.0: a filter with a centre (Lens Flare, Swirl, Radial Blur) - a click on the picture puts the centre there
      let pick = null;
      const drop = f.params.find((q) => q.type === "color" && q.eyedrop);   // 2.480.0: a click on the picture picks the colour (Replace Color)
      if (drop) {
        pick = (ev) => {
          if (ev.button !== 0 || !stage.contains(ev.target)) return;
          const [fx, fy] = pos(ev); if (fx < 0 || fy < 0 || fx >= S.w || fy >= S.h) return;
          ev.stopPropagation(); ev.preventDefault();
          const d = ctx(copy).getImageData(Math.floor(fx), Math.floor(fy), 1, 1).data, hx = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
          params[drop.id] = hx; const el = dlg.querySelector(`[data-p="${drop.id}"]`); if (el) el.value = hx;
          preview();
        };
        win.addEventListener("pointerdown", pick, true);
        const hint = doc.createElement("div"); hint.className = "fxpick"; hint.style.cssText = "margin:2px 10px 6px;color:var(--pc-dim);font-size:11px"; hint.textContent = "Click the picture to pick the colour.";
        dlg.insertBefore(hint, dlg.querySelector(".bt"));
      } else if (f.params.some((q) => q.id === "cx") && f.params.some((q) => q.id === "cy")) {
        pick = (ev) => {
          if (ev.button !== 0 || !stage.contains(ev.target)) return;
          const [fx, fy] = pos(ev); if (fx < 0 || fy < 0 || fx > S.w || fy > S.h) return;
          ev.stopPropagation(); ev.preventDefault();
          params.cx = Math.round(fx / S.w * 100); params.cy = Math.round(fy / S.h * 100);
          for (const k of ["cx", "cy"]) { const el = dlg.querySelector(`[data-p="${k}"]`), n = dlg.querySelector(`[data-n="${k}"]`); if (el) el.value = params[k]; if (n) n.value = params[k]; }
          preview();
        };
        win.addEventListener("pointerdown", pick, true);                // before the tools see it (they listen on the stage)
        const hint = doc.createElement("div"); hint.className = "fxpick"; hint.style.cssText = "margin:2px 10px 6px;color:var(--pc-dim);font-size:11px"; hint.textContent = "Click the picture to put the centre there.";
        dlg.insertBefore(hint, dlg.querySelector(".bt"));
      }
      const unpick = () => { if (pick) win.removeEventListener("pointerdown", pick, true); pick = null; };
      const cancel = () => { unpick(); if (done) return; done = true; clearTimeout(timer); ctx(tgt).putImageData(ctx(copy).getImageData(0, 0, S.w, S.h), 0, 0); if (which === "mask") L.mask.ver++; dlg.remove(); fxDlg = null; refresh(); };
      dlg.querySelector(".cn").onclick = () => { cancel(); say(f.name + " cancelled"); if (E.onFilterCancel) E.onFilterCancel(id); };
      dlg.querySelector(".rs").onclick = () => {
        Object.assign(params, FX.defaults(f));
        dlg.querySelectorAll("[data-p]").forEach((el) => { const q = f.params.find((x) => x.id === el.dataset.p); if (q.type === "check") el.checked = !!params[q.id]; else el.value = params[q.id]; const num = dlg.querySelector(`[data-n="${q.id}"]`); if (num) num.value = params[q.id]; });
        dlg.querySelectorAll("[data-curve]").forEach((el) => { el.innerHTML = ""; if (E.ui.curveWidget) E.ui.curveWidget(el, params[el.dataset.curve], (v, d2) => { params[el.dataset.curve] = v; preview(d2); }); });
        dlg.querySelectorAll("[data-pt]").forEach((el) => {                 // 2.480.0: kinds of their own, drawn again
          const q = f.params.find((x) => x.id === el.dataset.pid), T = q && E.paramTypes[el.dataset.pt]; if (!T) return;
          const t = doc.createElement("div"); t.innerHTML = T.html(q, params[q.id], E); const n = t.firstElementChild; el.replaceWith(n); T.bind(n, q, params, preview, E);
        });
        preview();
      };
      dlg.querySelector(".ok").onclick = () => {
        unpick();
        if (done) return; done = true; clearTimeout(timer);
        const R = fxCompute(f, params, copy, tgt);
        const px = endPx(L, copy, R, f.name, which); if (px) push(px);
        fxLast = { id, params: D.clone(params) }; store.set("fx." + id, params);
        dlg.remove(); fxDlg = null; refresh(); renderLayersPanel();
        if (E.onFilterDone) E.onFilterDone(id, D.clone(params));                 // 2.427.0: Actions record it
        say(`${f.name} applied${hasSel() ? " inside the selection" : ""} - Ctrl+Z undoes, Ctrl+F repeats`);
      };
      fxDlg = { cancel };
      preview();
    }
    function repeatFilter() { if (!fxLast) return say("no filter to repeat yet"); openFilter(fxLast.id, true); }
    /** a filter / adjustment straight on, no dialog (Auto Tone / Contrast / Color, Desaturate ...) - one undo step */
    function applyFilter(id, params, label) {
      const f = FX.byId(id), L = layer();
      if (!f || !S.w || !L || !canPaint(L)) return false;
      const which = whichOf(L), tgt = target(L), copy = beginPx(L, which);
      const R = fxCompute(f, Object.assign(FX.defaults(f), params || {}), copy, tgt);
      const px = endPx(L, copy, R, label || f.name, which); if (px) push(px);
      refresh(); renderLayersPanel(); say((label || f.name) + " applied");
      return true;
    }

    /* ---------------- ✨ AI ---------------- */
    S.feather = store.get("feather", 24); S.context = store.get("context", 64); S.res = store.get("res", 1);
    S.count = store.get("count", 1); S.strength = store.get("strength", 50);
    $("ieFeather").value = S.feather; $("ieContext").value = S.context; $("kxRes").value = String(S.res);
    $("kxCount").value = String(S.count); $("kxStrength").value = S.strength; $("kxStrengthV").textContent = S.strength + "%";
    $("ieFeather").onchange = () => { S.feather = Math.max(0, Math.min(256, +$("ieFeather").value || 0)); store.set("feather", S.feather); };
    $("ieContext").onchange = () => { S.context = Math.max(0, Math.min(1024, +$("ieContext").value || 0)); store.set("context", S.context); };
    $("kxRes").onchange = () => { S.res = +$("kxRes").value || 1; store.set("res", S.res); };
    $("kxCount").onchange = () => { S.count = +$("kxCount").value || 1; store.set("count", S.count); };
    $("kxStrength").oninput = () => { S.strength = +$("kxStrength").value; $("kxStrengthV").textContent = S.strength + "%"; store.set("strength", S.strength); };
    function setAiMode(m) {
      S.aiMode = m;
      host.querySelectorAll("#kxModes button").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
      const ed = m === "edit" || m === "compose";
      $("kxRowStyle").style.display = ed ? "none" : "";
      $("kxRowEdit").style.display = ed ? "" : "none";
      if ($("kxRowPicks")) $("kxRowPicks").style.display = m === "compose" ? "" : "none";
      $("kxRowStrength").style.display = m === "refine" ? "" : "none";
      if ($("kxRowRef")) { $("kxRowRef").style.display = m === "edit" ? "" : "none"; if (m === "edit") paintRefs(); }   // 2.539.0
      $("kxRun").textContent = "✨ " + { generate: "Generate", refine: "Refine", remove: "Remove", edit: "Edit", background: "New background", compose: "Compose" }[m];
      if (E.onAiMode) { try { E.onAiMode(m); } catch (e) { /* the prompt docker link must not stop the panel */ } }   // 2.444.0: pcpromptlink.js
      $("iePrompt").placeholder = { generate: "What should appear in the selection (empty = the main prompt box)",
        refine: "Describe the selection as it should look (empty = the main prompt box)",
        remove: "Optional: what the background there is (empty = continue the surroundings)",
        edit: "The instruction: \"make her jacket red\", \"remove the glasses\", \"turn it into a watercolor\"",
        background: "The new background (the selection is kept)",
        compose: "What to make from the picked layers: \"put the dog from Layer 2 on the sofa in Layer 1\" (a layer's name = its picture)" }[m];
      store.set("aimode", m);
    }
    host.querySelectorAll("#kxModes button").forEach((b) => { b.onclick = () => setAiMode(b.dataset.mode); });
    setAiMode(store.get("aimode", "generate"));
    // 2.541.0: the prompt docker's ▾ Generate / Edit / Refine … dropdown (pcimgop.js) sets the mode and Refine's strength
    E.setAiMode = setAiMode;
    E.setStrength = (v) => { const n = Math.max(5, Math.min(95, Math.round((+v || 50) / 5) * 5)); S.strength = n; $("kxStrength").value = n; $("kxStrengthV").textContent = n + "%"; store.set("strength", n); return n; };

    /* 2.539.0: the References docker's pictures (their descriptions) for an Edit's Picture 2 */
    function paintRefs() {
      const sel = $("kxRef"); if (!sel) return;
      const cur = sel.value, list = api && api.refList ? api.refList() : [];
      sel.innerHTML = `<option value="">- none -</option>` + list.map((r) => `<option value="${r.i}">${String(r.desc || r.name).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))}${r.role && r.role !== "person" ? " · " + r.role : ""}</option>`).join("");
      if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
    }
    if ($("kxRef")) $("kxRef").addEventListener("mousedown", paintRefs);
    if ($("kxRef")) $("kxRef").addEventListener("focus", paintRefs);
    function tevIe(n, w) { try { if (win.H3TestEvent) win.H3TestEvent(n, w); } catch (e) { /* the 🧪 list */ } }
    async function paintEngines() {
      if (!api || !api.engines) return;
      let e = null; try { e = await api.engines(); } catch { e = null; }
      if (!e) return;
      const sel = $("ieEditStyle"), want = sel.value || store.get("editstyle", "") || e.defaults.edit;
      sel.innerHTML = e.edit.length ? e.edit.map((s) => `<option value="${s.id}">${s.name}</option>`).join("") : `<option value="">(no edit-capable style)</option>`;
      if (e.edit.some((s) => s.id === want)) sel.value = want;
      S.engines = e;
      paintCtlTypes(); paintControlNets();
    }
    $("ieEditStyle").onchange = () => store.set("editstyle", $("ieEditStyle").value);
    paintEngines();

    const imgOf = (url) => new Promise((resolve, reject) => { const im = new win.Image(); im.crossOrigin = "anonymous"; im.onload = () => resolve(im); im.onerror = () => reject(new Error("could not load the result")); im.src = url; });
    const blobOf = (c) => new Promise((r) => c.toBlob(r, "image/png"));

    /** opt (2.444.0, the prompt docker driving it - pcpromptlink.js): {prompt, editStyle, into: true = ✔ Apply blends
     *  into the layer that was selected, whole: no selection = the whole picture}
     *  2.541.0: source = a canvas of the picture's size to work from INSTEAD of the layers (the 🟧 Blender scene rendered
     *  for an Edit / Refine - pc3d.js), always the whole of it; label = what ✔ Apply calls the new layer
     *  2.542.0: direct = each result goes straight in as a NEW LAYER (no preview over the canvas - Tim: "create a new
     *  layer. right now the canvas is getting the rendered image and it cannot be deleted"); keep = the layer to leave picked */
    async function runAI(opt) {
      opt = opt && typeof opt === "object" && !opt.type ? opt : {};
      if (!S.w) return say("open a picture first");
      if (S.busy) return say("still working on the last one");
      if (!api || !api.aiedit) return say("the AI is not connected (reload the page)");
      const mode = S.aiMode;
      if (mode === "compose") return E.runCompose ? E.runCompose() : say("Compose is not loaded (reload the page)");
      const source = opt.source && opt.source.width === S.w && opt.source.height === S.h ? opt.source : null;   // 2.541.0
      if (!source) { if (E.beforeGenerate) E.beforeGenerate(mode); }   // 2.442.0: a closed shape active - into it (pcframes.js); 2.541.0: not for a source picture
      let sel = hasSel() && !source ? Uint8Array.from(S.sel) : null;
      if (mode === "background") { if (!sel) return say("select what to KEEP first - everything else gets a new background"); sel = P.invert(sel); }
      if (!sel && mode === "generate" && opt.whole) sel = new Uint8Array(S.w * S.h).fill(255);
      if (!sel && (mode === "generate" || mode === "remove")) return say("select the area first (or Select All)");
      const whole = !sel;
      if (whole) sel = new Uint8Array(S.w * S.h).fill(255);
      const bb = P.bbox(sel, S.w, S.h); if (!bb) return say("the selection is empty");
      const box = whole ? { x: 0, y: 0, w: S.w, h: S.h } : P.contextRect(bb, S.w, S.h, S.context, 16);
      const cropMask = P.cropMask(sel, S.w, box);
      const src = source || flatten();
      // the crop at full resolution (holes filled for Remove / an expanded strip)
      const full = newCanvas(box.w, box.h), fg = ctx(full);
      fg.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      const fid = fg.getImageData(0, 0, box.w, box.h);
      let hasHole = false;
      for (let i = 0; i < cropMask.length; i++) if (cropMask[i] && fid.data[i * 4 + 3] < 250) { hasHole = true; break; }
      if (mode === "remove" || hasHole) { P.fillHole(fid.data, mode === "remove" ? cropMask : new Uint8Array(cropMask.length), box.w, box.h); fg.putImageData(fid, 0, 0); }
      // what the model renders at (<= the MP budget)
      const fit = P.fitSize(box.w, box.h, S.res * 1048576, 16);
      const crop = newCanvas(fit.w, fit.h), cg = ctx(crop); cg.imageSmoothingQuality = "high"; cg.drawImage(full, 0, 0, fit.w, fit.h);
      const mFull = newCanvas(box.w, box.h), mg = ctx(mFull), mid = mg.createImageData(box.w, box.h);
      for (let i = 0; i < cropMask.length; i++) mid.data[i * 4 + 3] = 255 - cropMask[i];      // transparent = the selection
      mg.putImageData(mid, 0, 0);
      const mask = newCanvas(fit.w, fit.h); ctx(mask).drawImage(mFull, 0, 0, fit.w, fit.h);
      // the same crop with the selection TRANSPARENT (one-slot inpaint graphs read the hole from alpha)
      const rgba = newCanvas(fit.w, fit.h), rg = ctx(rgba); rg.drawImage(crop, 0, 0);
      rg.globalCompositeOperation = "destination-in"; rg.drawImage(mask, 0, 0);
      let prompt = (opt.prompt != null ? String(opt.prompt).trim() : "") || $("iePrompt").value.trim() || (api.mainPrompt ? api.mainPrompt() : "");
      if (!prompt && hasHole && mode === "generate") prompt = "the same scene continues naturally, seamless, same style and light";
      const req = { mode: mode === "background" ? "generate" : mode, prompt, count: S.count, strength: mode === "refine" ? S.strength : 100,
                    style_id: mode === "edit" ? (opt.editStyle || $("ieEditStyle").value) : (opt.style || $("ieStyle").value), width: fit.w, height: fit.h,   // 2.550.0: opt.style
                    crop: await blobOf(crop), mask: await blobOf(mask), rgba: await blobOf(rgba) };
      // 2.539.0: Edit + a picture from the References docker (Picture 2)
      if (mode === "edit" && $("kxRef") && $("kxRef").value !== "") {
        const rr = (api.refList ? api.refList() : [])[+$("kxRef").value];
        if (rr) {
          try { req.ref = rr.file || await (await win.fetch(rr.url)).blob(); req.ref_desc = rr.desc || ""; tevIe("ie_ref", "edit"); }
          catch (e) { return say("could not read that reference picture: " + e.message); }
        }
      }
      // ◈ the control layers ride along (not with an Edit - an edit model takes the picture itself)
      const ctls = mode === "edit" ? [] : activeControls();
      if (ctls.length) {
        req.controls = [];
        for (const L of ctls) req.controls.push({ type: L.control.type, strength: L.control.strength, start: L.control.start, end: L.control.end,
                                                  model: L.control.model || "", blob: await blobOf(controlImage(L, box, fit)) });
      }
      if (mode === "edit" && activeControls().length) say("control layers guide Generate / Refine / Remove - an Edit model takes the picture itself, so they are left out");
      S.busy = true; $("kxRun").disabled = true;
      discardResults(true);
      // 2.437.0: ✨ Generate Fill in Shape / in Mask (pcgenfill.js) - the result goes onto that layer (clipped / masked)
      const ctxInfo = { box, cropMask, whole, feather: whole || S.genInto ? 0 : S.feather, mode, prompt, into: S.genInto || null, label: opt.label || "", source: source || null,
        blendInto: !S.genInto && opt.into && mode === "generate" && layer() ? layer().id : null };   // 2.444.0: ✔ Apply = into that layer
      S.genInto = null;
      say(`${mode}: ${box.w}×${box.h} crop` + (fit.scale < 1 ? ` rendered at ${fit.w}×${fit.h}` : "") + ` · ${S.count} result(s)`
        + (req.controls ? ` · ${req.controls.length} control layer(s)` : "") + "…");
      try {
        const r = await api.aiedit(req, say);
        if (!r || !r.jobs) return;
        S.results = r.jobs.map((j) => ({ id: j.id, seed: j.seed, url: null, layer: null, info: ctxInfo }));
        if (!opt.direct) renderResults();
        let added = 0;
        await Promise.all(S.results.map(async (res, i) => {
          const url = await api.awaitResult(res.id, say);
          if (!url) { res.failed = true; if (!opt.direct) renderResults(); return; }
          const im = await imgOf(url);
          res.url = url; res.layer = resultLayer(im, ctxInfo);
          if (opt.direct) {                                      // 2.542.0: straight in as a new layer
            const L = makeLayer(`${ctxInfo.label || "✨ " + mode}: ${(prompt || "").slice(0, 28)}` + (S.results.length > 1 ? ` ${i + 1}` : ""));
            ctx(L.canvas).drawImage(res.layer, 0, 0);
            addLayer(L, "AI result", false); added++;
            if (opt.keep && S.layers.includes(opt.keep)) S.active = S.layers.indexOf(opt.keep);   // the scene's layer stays picked (Blender mode)
            refresh(); renderLayersPanel();
            return;
          }
          renderResults();
          if (!S.preview || i === 0) showResult(S.results.indexOf(res));
        }));
        if (opt.direct) { discardResults(true); say(added ? `${added} new layer(s) from the ${mode} - hide (👁) or delete them like any layer` : "no result came back - see the job log"); return; }
        const ok = S.results.filter((x) => x.layer).length;
        say(ok ? `${ok} result(s) - click one to compare, ✔ Apply keeps it as a new layer (Enter), ✕ Discard (Esc)` : "no result came back - see the job log");
      } catch (e) { say(`${mode} failed: ${e.message}`); }
      finally { S.busy = false; $("kxRun").disabled = false; }
    }
    /* ---------------- ✨ COMPOSE: the picked layers as references (2.390.0) ----------------
       Tim: "we add 3 images to image editor, layer 1, layer 2 and layer 3, and we prompt using our local models to use
       them as reference and create a scene". Picture 1 = the first picked layer at the picture's size (the scene - the
       answer lands on it 1:1), Picture 2..3 = the others cut to what they hold; routes/aiedit.js /api/aiedit/compose. */
    /** one layer as a picture by itself (its mask, opacity and styles applied; a group with what is in it) */
    function layerPicture(L) {
      const c = newCanvas(S.w, S.h);
      const list = L.type === "group" ? D.descendants(S.layers, L.id).concat([L]) : [L];
      const was = list.map((x) => x.visible);
      list.forEach((x) => { x.visible = true; });
      try { D.render({ w: S.w, h: S.h, layers: list.map((x) => (x === L ? Object.assign(Object.create(Object.getPrototypeOf(x)), x, { parent: null }) : x)) },
                     docEnv({ srcFor: (x) => x.canvas, maskSrc: null, skipControl: true, into: c })); }
      finally { list.forEach((x, k) => { x.visible = was[k]; }); }
      return c;
    }
    /** a picture on white, at most `mp` megapixels; trim = cut to its own pixels first */
    function onWhite(c, mp, trim) {
      let box = { x: 0, y: 0, w: c.width, h: c.height };
      if (trim) { const b = alphaBox(c); if (b) box = b; }
      const fit = P.fitSize(box.w, box.h, mp * 1048576, 16);
      const o = newCanvas(fit.w, fit.h), g = ctx(o);
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, fit.w, fit.h); g.imageSmoothingQuality = "high";
      g.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, fit.w, fit.h);
      return o;
    }
    /** opt (2.543.0 - the prompt docker's ▾ Compose / Edit / Replace background with layers picked): {prompt, layers, direct} */
    async function runCompose(opt) {
      opt = opt && typeof opt === "object" && !opt.type ? opt : {};
      if (!api || !api.compose) return say("Compose is not connected (reload the page)");
      // 2.546.0: opt.pics = pictures instead of layers ({canvas, name}: a Blender scene + the References docker's pictures)
      const given = Array.isArray(opt.pics) && opt.pics.length ? opt.pics : null;
      const picks = given ? given.map((p) => ({ name: p.name || "picture", pic: p.canvas })) : (opt.layers || (E.picked ? E.picked() : [])).filter((L) => L && !L.control);
      if (!picks.length) return say("Ctrl-click the layers to use in the Layers panel first - in order: the first is the scene, then the things to bring in (up to 3)");
      if (picks.length > 3) return say("at most 3 layers (the edit models take three pictures) - Ctrl-click one to un-pick it");
      if (S.busy) return say("still working on the last one");
      const prompt = (opt.prompt != null ? String(opt.prompt).trim() : "") || $("iePrompt").value.trim() || (api.mainPrompt ? api.mainPrompt() : "");
      if (!prompt) return say("say what to make from the layers (\"put the dog from Layer 2 on the sofa in Layer 1\")");
      const pics = [];
      for (let k = 0; k < picks.length; k++) pics.push(await blobOf(onWhite(given ? picks[k].pic : layerPicture(picks[k]), k === 0 ? S.res : 1, !given && k > 0)));
      const fit = P.fitSize(S.w, S.h, S.res * 1048576, 16);
      S.busy = true; $("kxRun").disabled = true;
      discardResults(true);
      const ctxInfo = { box: { x: 0, y: 0, w: S.w, h: S.h }, cropMask: null, whole: true, feather: 0, mode: "compose", prompt };
      say(`compose: ${picks.map((L, k) => `Picture ${k + 1} = ${L.name}`).join(", ")} · ${S.count} result(s)…`);
      try {
        const r = await api.compose({ pics, names: picks.map((L) => L.name), prompt, style_id: $("ieEditStyle").value, count: S.count, width: fit.w, height: fit.h, scene_refs: opt.sceneRefs || undefined }, say);
        if (!r || !r.jobs) return;
        S.results = r.jobs.map((j) => ({ id: j.id, seed: j.seed, url: null, layer: null, info: ctxInfo }));
        if (!opt.direct) renderResults();
        let added = 0;
        await Promise.all(S.results.map(async (res, i) => {
          const url = await api.awaitResult(res.id, say);
          if (!url) { res.failed = true; if (!opt.direct) renderResults(); return; }
          const im = await imgOf(url);
          res.url = url; res.layer = resultLayer(im, ctxInfo);
          if (opt.direct) {                                      // 2.543.0: straight in as a new layer
            const L = makeLayer((opt.label ? opt.label : `🧩 ${prompt.slice(0, 32)}`) + (S.results.length > 1 ? ` ${i + 1}` : ""));
            ctx(L.canvas).drawImage(res.layer, 0, 0); addLayer(L, "AI result", false); added++;
            if (opt.keep && S.layers.includes(opt.keep)) S.active = S.layers.indexOf(opt.keep);
            refresh(); renderLayersPanel();
            return;
          }
          renderResults();
          if (!S.preview || i === 0) showResult(S.results.indexOf(res));
        }));
        if (opt.direct) { discardResults(true); say(added ? `${added} new layer(s) from ${picks.map((L) => L.name).join(" + ")}` : "no result came back - see the job log"); return; }
        const ok = S.results.filter((x) => x.layer).length;
        say(ok ? `${ok} result(s) - click one to compare, ✔ Apply keeps it as a new layer (Enter), ✕ Discard (Esc)` : "no result came back - see the job log");
      } catch (e) { say(`compose failed: ${e.message}`); }
      finally { S.busy = false; $("kxRun").disabled = false; }
    }
    E.runCompose = runCompose; E.layerPicture = layerPicture; E.onWhite = onWhite;

    /** the result as a full-size transparent layer: the model's pixels inside
     *  the feathered selection only */
    function resultLayer(im, I) {
      const c = newCanvas(S.w, S.h), g = ctx(c);
      const patch = newCanvas(I.box.w, I.box.h), pg = ctx(patch);
      pg.imageSmoothingQuality = "high"; pg.drawImage(im, 0, 0, I.box.w, I.box.h);
      if (!I.whole || I.feather) {
        const fm = P.feather(I.cropMask, I.box.w, I.box.h, I.feather);
        const d = pg.getImageData(0, 0, I.box.w, I.box.h); P.maskAlpha(d.data, fm); pg.putImageData(d, 0, 0);
      }
      g.drawImage(patch, I.box.x, I.box.y);
      return c;
    }
    function renderResults() {
      const box = $("kxResults"); box.innerHTML = "";
      S.results.forEach((r, i) => {
        if (!r.layer) { const w = doc.createElement("div"); w.className = "wait"; w.textContent = r.failed ? "✕" : "…"; w.title = r.failed ? "failed - see the job log" : "rendering"; box.appendChild(w); return; }
        const t = newCanvas(124, 124), g = ctx(t), b = r.info.box, k = Math.min(124 / b.w, 124 / b.h);
        g.drawImage(r.info.source || flatCache || cv, b.x, b.y, b.w, b.h, (124 - b.w * k) / 2, (124 - b.h * k) / 2, b.w * k, b.h * k);
        g.drawImage(r.layer, b.x, b.y, b.w, b.h, (124 - b.w * k) / 2, (124 - b.h * k) / 2, b.w * k, b.h * k);
        t.title = `result ${i + 1} (seed ${r.seed})`;
        if (S.previewIndex === i) t.className = "on";
        t.onclick = () => showResult(i);
        // 2.541.0 (Tim: "if user selects apply on the thumbnail then add a new layer"): each result has its own ✔
        const w = doc.createElement("span"); w.className = "kxth"; w.appendChild(t);
        const ok = doc.createElement("button"); ok.type = "button"; ok.className = "kxthok"; ok.textContent = "✔"; ok.title = `Apply result ${i + 1} as a layer`;
        ok.onclick = (ev) => { ev.stopPropagation(); showResult(i); applyResult(); };
        w.appendChild(ok); box.appendChild(w);
      });
      $("kxResBtns").style.display = S.results.some((r) => r.layer) ? "" : "none";
    }
    function showResult(i) {
      const r = S.results[i]; if (!r || !r.layer) return;
      S.preview = r.layer; S.previewIndex = i; renderLayers(); renderResults();
    }
    function applyResult() {
      const r = S.results[S.previewIndex]; if (!r || !r.layer) return say("no result shown");
      const into = r.info.into, T = into ? S.layers.find((x) => x.id === into.id) : null;
      const L = makeLayer(T ? `✨ fill in ${T.name}: ${(r.info.prompt || "").slice(0, 24)}` : r.info.label ? `${r.info.label}: ${(r.info.prompt || "").slice(0, 28)}` : `✨ ${r.info.mode}: ${(r.info.prompt || "").slice(0, 28)}`);
      ctx(L.canvas).drawImage(r.layer, 0, 0);
      if (T && win.PCGenFill) {                                   // 2.437.0: onto the shape (clipped) / inside the mask (its copy)
        win.PCGenFill.placeOnto(E, L, T, into.how);
        discardResults(true); refresh(); renderLayersPanel();
        if (into.how === "frame") { say(`applied inside ${T.name} - the picture is in the frame (Layer ▸ Frame ▸ Edit Frame Contents to move it there)`); return; }
        say(into.how === "mask" ? `applied inside ${T.name}'s mask - a new layer above it with the same mask` : `applied inside ${T.name} - a new layer clipped to it (↳), move it or paint its edges freely`);
        return;
      }
      // 2.444.0: the prompt docker's Generate - the result BLENDS into the layer that was selected (Krita AI): its
      // feathered selection painted onto that layer's pixels, one undo step (a non-pixel layer: a new layer as before)
      const B = r.info.blendInto != null ? S.layers.find((x) => x.id === r.info.blendInto) : null;
      if (B && B.type === "pixel" && canPaint(B)) {
        const copy = beginPx(B); ctx(B.canvas).drawImage(r.layer, 0, 0);
        const px = endPx(B, copy, null, "✨ generate into " + B.name); if (px) push(px);
        S.active = S.layers.indexOf(B);
        discardResults(true); refresh(); renderLayersPanel();
        say(`blended into ${B.name} (inside the selection) - Ctrl+Z takes it out`);
        return;
      }
      addLayer(L, "apply AI result", false);
      discardResults(true); refresh(); renderLayersPanel();
      say("applied as a new layer - hide it (👁) to compare, merge it down (Ctrl+E) to flatten");
    }
    function discardResults(silent) {
      S.results = []; S.preview = null; S.previewIndex = -1; renderResults(); renderLayers();
      if (!silent) say("results discarded");
    }
    $("kxRun").onclick = () => { flattenCache(); runAI(); };
    $("kxApply").onclick = applyResult;
    $("kxDiscard").onclick = () => discardResults();

    /** a whole-document change (canvas size, crop, rotate ...) as one undo step: f() changes S.w/S.h/layers */
    function docOp(label, f) {
      if (!S.w) { say("open a picture first"); return false; }
      const before = snapDoc();
      if (f() === false) return false;
      sizeCanvases();
      push({ t: "doc", before, after: snapDoc(), label });
      S.userView = false; fitView(); refresh(); renderLayersPanel();
      return true;
    }
    /** every layer's canvas (and mask) redrawn by draw(oldCanvas, newCtx) at the new size; text / shape settings by fixParams */
    function remapLayers(W, H, draw, fixParams, maskFill) {
      for (const L of S.layers) {
        const c = newCanvas(W, H); draw(L.canvas, ctx(c), L); L.canvas = c; L.ver = (L.ver || 0) + 1;
        if (L.mask) { const m = newCanvas(W, H), mg = ctx(m); mg.fillStyle = maskFill || "#ffffff"; mg.fillRect(0, 0, W, H); draw(L.mask.canvas, mg, L); L.mask.canvas = m; L.mask.ver = (L.mask.ver || 0) + 1; }
        if (fixParams && (L.type === "text" || L.type === "shape")) fixParams(L);
      }
      S.w = W; S.h = H;
      for (const L of S.layers) if (D.isLive(L)) D.rasterize(L);
      setSel(new Uint8Array(W * H), true);
    }
    $("kxExpand").onclick = needDoc(() => {
      const side = $("kxExpSide").value, px = Math.max(16, Math.min(2048, +$("kxExpPx").value || 256));
      const E2 = P.expand(S.w, S.h, side, px), ow = S.w, oh = S.h;
      docOp("expand canvas", () => {
        remapLayers(E2.w, E2.h, (src, g) => g.drawImage(src, E2.ox, E2.oy), (L) => { const p = L.text || L.shape; p.x += E2.ox; p.y += E2.oy; });
        if (E.mapPaths) E.mapPaths([1, 0, 0, 1, E2.ox, E2.oy]);
        const inside = P.rectMask(E2.ox, E2.oy, E2.ox + ow, E2.oy + oh, S.w, S.h);
        setSel(P.invert(inside), true);
      });
      setAiMode("generate");
      say(`canvas ${S.w}×${S.h} - the new strip is selected: ✨ Generate continues the picture into it`);
    });

    /* ---------------- drops ---------------- */
    stage.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    /* 2.549.0 (Tim: "dragging an image onto the canvas from gallery, assets or references should give user option to add
       as layer or add as new document"): a picture dropped while a document is open asks - ▦ As a layer / 🗋 As a new
       document (Enter = layer, Esc = neither); Shift held = a layer at once, nothing open = a new document */
    function askDrop(x, y, name, go) {
      const old = doc.getElementById("ieDropAsk"); if (old) old.remove();
      const box = doc.createElement("div"); box.id = "ieDropAsk"; box.className = "kxmenu"; box.setAttribute("role", "dialog");
      box.style.cssText = "position:fixed;z-index:100001;padding:6px;display:flex;flex-direction:column;gap:4px;min-width:200px";
      const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      box.innerHTML = `<div style="font-size:11px;color:var(--pc-dim);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</div>`
        + `<button type="button" class="ghost" data-as="layer">▦ Add as a layer</button><button type="button" class="ghost" data-as="doc">🗋 Open as a new document</button>`;
      doc.body.appendChild(box);
      const bw = box.offsetWidth || 220, bh = box.offsetHeight || 90;
      box.style.left = Math.max(4, Math.min(x, (win.innerWidth || 1200) - bw - 4)) + "px"; box.style.top = Math.max(4, Math.min(y, (win.innerHeight || 800) - bh - 4)) + "px";
      const done = (as) => { box.remove(); doc.removeEventListener("keydown", key, true); doc.removeEventListener("pointerdown", out, true); if (as) { tevIe("ie_drop", as); go(as === "layer"); } };
      const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); } else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done("layer"); } };
      const out = (e) => { if (!box.contains(e.target)) done(null); };
      box.querySelectorAll("[data-as]").forEach((b) => { b.onclick = () => done(b.dataset.as); });
      doc.addEventListener("keydown", key, true); win.setTimeout(() => doc.addEventListener("pointerdown", out, true), 0);
      const first = box.querySelector("[data-as=layer]"); if (first) first.focus();
      return box;
    }
    function dropPicture(e, url, name) {
      if (!S.w) return load(url, name, false);
      if (e.shiftKey) return load(url, name, true);
      askDrop(e.clientX, e.clientY, name, (asLayer) => load(url, name, asLayer));
    }
    E.askDrop = askDrop;
    stage.addEventListener("drop", (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && /^image\//.test(f.type)) { dropPicture(e, URL.createObjectURL(f), f.name); return; }
      if (api && api.dropUrl) { const d = api.dropUrl(e); if (d) { dropPicture(e, d.url, d.name); if (d.asLayer && S.w) tevIe("ie_ref", "drop"); } }
    });
    if (typeof win.ResizeObserver === "function") new win.ResizeObserver(() => { if (S.w && !S.userView) fitView(); if (E.ui.rulers) E.ui.rulers(); }).observe(stage);
    // a narrow dock (a column layout) gets the panels as an overlay, hidden until ▤ - the canvas keeps the room
    let wasNarrow = null;
    function layoutMode() {
      const narrow = host.clientWidth > 0 && host.clientWidth < 820;
      if (narrow !== wasNarrow) { kx.classList.toggle("narrow", narrow); kx.classList.toggle("side-off", narrow); wasNarrow = narrow; }
    }
    $("kxPanel").onclick = () => { kx.classList.toggle("side-off"); $("kxPanel").classList.toggle("on", !kx.classList.contains("side-off")); if (S.w && !S.userView) fitView(); };
    if (typeof win.ResizeObserver === "function") new win.ResizeObserver(layoutMode).observe(host);
    /* 2.393.0 (Tim: "when image editor use the bitgen titlebar and statusbar so it still looks like part of bitgen"):
       FULL SCREEN is the whole app in full screen with the editor filling the room between bitGen's own title bar /
       menu bar and its status bar (body.ie-full) - not the editor alone. Esc, F or ⛶ leave. A browser that refuses
       full screen still gets the editor filling the window. */
    const fullOn = () => doc.body.classList.contains("ie-full");
    function setFull(on) {
      on = !!on;
      const dk = doc.getElementById("imageeditdock");
      if (on && dk && dk.classList.contains("collapsed") && typeof win.toggleCollapse === "function") win.toggleCollapse("imageeditdock");
      doc.body.classList.toggle("ie-full", on);
      $("kxFull").classList.toggle("on", on);
      $("kxFull").title = on ? "Leave full screen (F or Esc)" : "Full screen editor - bitGen's bars stay (F; Esc leaves)";
      const de = doc.documentElement;
      if (on && !doc.fullscreenElement && de.requestFullscreen) { try { de.requestFullscreen().then(() => { S.fsOurs = true; }, () => { S.fsOurs = false; }); } catch (e) { /* jsdom */ } }
      if (!on && doc.fullscreenElement && S.fsOurs && doc.exitFullscreen) { S.fsOurs = false; try { doc.exitFullscreen().catch(() => {}); } catch (e) { /* jsdom */ } }
      S.userView = false;
      setTimeout(() => { layoutMode2(); if (S.w) fitView(); try { win.dispatchEvent(new win.Event("resize")); } catch (e) { /* jsdom */ } }, 120);
    }
    function toggleFull() { setFull(!fullOn()); }
    // the editor's status line, mirrored into bitGen's status bar (shown there in full screen)
    (function mirrorStatus() {
      const sb = doc.getElementById("statusbar"); if (!sb || doc.getElementById("sbIe")) return;
      const m = doc.createElement("span"); m.id = "sbIe"; m.title = "The image editor's status";
      const after = doc.getElementById("sbjobs"); if (after) after.after(m); else sb.appendChild(m);
      const copy = () => { m.textContent = status.textContent; };
      copy();
      if (typeof win.MutationObserver === "function") new win.MutationObserver(copy).observe(status, { childList: true, characterData: true, subtree: true });
    })();
    $("kxFull").onclick = toggleFull;
    function layoutMode2() { const n = kx.clientWidth < 820; kx.classList.toggle("narrow", n); if (!n) kx.classList.remove("side-off"); wasNarrow = n; }
    // the browser's own Esc leaves full screen - the editor goes back into its docker with it
    doc.addEventListener("fullscreenchange", () => setTimeout(() => {
      if (!doc.fullscreenElement && S.fsOurs) { S.fsOurs = false; if (fullOn()) setFull(false); }
      else if (!fullOn()) layoutMode();
      if (S.w && !S.userView) fitView();
    }, 120));
    layoutMode();
    stage.addEventListener("wheel", () => { S.userView = true; }, { passive: true });

    // the shared surface the tools (pctools.js) and the UI (pcui.js) build on
    Object.assign(E, {
      makeLayer, newMask, target, onMask, whichOf, canPaint, snapStruct, putStruct, snapDoc, putDoc, push, undo, redo, historyTo, beginPx, endPx, pxOp,
      setSel, changeSel, applyShape, selCanvas, refresh, renderSoon, renderLayers, drawOverlay, info, sizeCanvases, applyView, fitView, zoomAt, pos,
      openDoc, openImage, load, blankDoc, setFgNone, addLayer, addImageLayer, flatten, flattenCache, renderLayersPanel, structOp, setActive, newLayer, duplicateLayer,
      deleteLayer, moveLayer, moveLayerEnd, dropLayer, groupActive, newGroup, ungroupActive, toggleClip, mergeDown, mergeVisible, rasterizeLayer,
      layerFromSelection, addMask, deleteMask, toggleMask, selectFrom, newAdjust, newFill, liveSet, commitLive, cancelLive, setLayer, setTool, renderOptions,
      setSize, choosePreset, shiftLayer, shiftMask, layerAt, alignLayer, nudge, pickColor, fillAt, clearSelectionArea, fillSelection, selectAll, deselect, reselect,
      selectInverse, modifySel, colorRange, quickMask, setFg, setBg, openFilter, repeatFilter, applyFilter, paramHtml, bindParams, docEnv, docOp, remapLayers,
      snapHistorySource, saveToImages, toggleFull, setFull, setAiMode, runAI, applyResult, discardResults, controlFromImage, closePoly, alphaBox,
      blobOf, imgOf, api,
    });
    if (win.PCTools && win.PCTools.install) win.PCTools.install(E);
    if (win.PCUI && win.PCUI.install) win.PCUI.install(E);
    if (win.PCDocs && win.PCDocs.install) win.PCDocs.install(E);   // 2.430.0: documents - floating windows / tabs
    if (win.PCSam && win.PCSam.install) win.PCSam.install(E);     // 2.390.0: Segment Anything, ✨ Compose, → References
    if (win.PCPsd && win.PCPsd.install) win.PCPsd.install(E);     // 2.390.0: PSD files
    if (win.PCFill && win.PCFill.install) win.PCFill.install(E);   // 2.396.0: swap recolours a plain Background, the Paint Bucket (fg / bg / gradient)
    if (win.PCText && win.PCText.install) win.PCText.install(E);   // 2.397.0: Type on a Path, Vertical Type, warp / circle / 3D text
    if (win.PCType && win.PCType.install) win.PCType.install(E);   // 2.426.0: Character / Paragraph panels + styles, paragraph text
    if (win.PCRuns && win.PCRuns.install) win.PCRuns.install(E);   // 2.449.0: per-letter settings inside one text layer
    if (win.PCPen && win.PCPen.install) win.PCPen.install(E);      // 2.421.0: Pen, paths, vector masks, custom shapes
    if (win.PCVLine && win.PCVLine.install) win.PCVLine.install(E);
    if (win.PCDraw && win.PCDraw.install) win.PCDraw.install(E);
    if (win.PCPalette && win.PCPalette.install) win.PCPalette.install(E);
    if (win.PCGrad && win.PCGrad.install) win.PCGrad.install(E);   // 2.434.0: the Gradient Editor (many stops, each with its opacity)   // 2.430.0: CorelDRAW's colour palette on the right, ⊠ transparent, auto-fill
    if (win.PCDockers && win.PCDockers.install) win.PCDockers.install(E);   // 2.429.0: CorelDRAW's dockers - Transform, Shaping, Align and Distribute, Object Properties    // 2.428.0: CorelDRAW's shape tools (F6), Artistic Media, dimensions + connectors (F8)  // 2.425.0: CorelDRAW's curve tools (F5), Shape tool (F10), Outline Pen (F12), vector line <-> path, Curvature Pen, path align
    if (win.PCSmart && win.PCSmart.install) win.PCSmart.install(E);  // 2.422.0: smart objects + smart filters
    if (win.PCLinked && win.PCLinked.install) win.PCLinked.install(E);   // 2.469.0: linked smart objects (projects/<p>/linked)
    if (win.PCWarp && win.PCWarp.install) win.PCWarp.install(E);    // 2.422.0: skew / distort / perspective / warp, puppet warp, content-aware scale, liquify
    if (win.PCRefine && win.PCRefine.install) win.PCRefine.install(E);  // 2.423.0: Select and Mask, magnetic lasso, quick selection, sky, channels
    if (win.PCHeal && win.PCHeal.install) win.PCHeal.install(E);      // 2.423.0: patch, content-aware move / fill, red eye, mixer brush, erasers, healing
    if (win.PCPdf && win.PCPdf.install) win.PCPdf.install(E);        // 2.424.0: PDF files - open (pages, text as type layers), edit, save
    if (win.PCActions && win.PCActions.install) win.PCActions.install(E);
    if (win.PCActionsX && win.PCActionsX.install) win.PCActionsX.install(E);   // 2.468.0: recorded strokes / selections, conditionals, Image Processor, droplets
    if (win.PCComps && win.PCComps.install) win.PCComps.install(E);   // 2.434.0: Layer Comps   // 2.427.0: Actions (record / play / edit) + File ▸ Automate ▸ Batch
    if (win.PCBgi && win.PCBgi.install) win.PCBgi.install(E);     // 2.436.0: the project file - File ▸ Save / Open Project (.bgi)
    if (win.PCGenFill && win.PCGenFill.install) win.PCGenFill.install(E);   // 2.437.0: ✨ Generate Fill in Shape / in Mask
    if (win.PCPattern && win.PCPattern.install) win.PCPattern.install(E);   // 2.437.0: the pattern library (patterns/<name>.png)
    if (win.PCPanels && win.PCPanels.install) win.PCPanels.install(E);   // 2.438.0: the Layers / Colour groups float; named dockers
    if (win.PCPropBar && win.PCPropBar.install) win.PCPropBar.install(E);   // 2.439.0: the property bar (X Y W H 🔒, corners, outline) + draw modes
    if (win.PCGuides && win.PCGuides.install) win.PCGuides.install(E);   // 2.440.0: rulers in units, guidelines, snapping
    if (win.PCDims && win.PCDims.install) win.PCDims.install(E);
    if (win.PCFrames && win.PCFrames.install) win.PCFrames.install(E);
    if (win.PCPrefs && win.PCPrefs.install) win.PCPrefs.install(E);   // 2.444.0: ⚙ the editor's settings (tabs modules add)
    if (win.PCImgOp && win.PCImgOp.install) win.PCImgOp.install(E);   // 2.541.0: the prompt docker's ▾ Generate / Edit / Refine / Fill / Replace background / Remove
    if (win.PCPromptLink && win.PCPromptLink.install) win.PCPromptLink.install(E);
    if (win.PCArtboards && win.PCArtboards.install) win.PCArtboards.install(E);   // 2.447.0: artboards   // 2.444.0: ✨ Edit / Generate run from the prompt docker   // 2.442.0: frames (PowerClip) - layers inside a closed shape   // 2.441.0: CAD dimensions - exact points, live ends, the scale
    if (win.PCCaFill && win.PCCaFill.install) win.PCCaFill.install(E);   // 2.448.0: the Content-Aware Fill workspace
    if (win.PCDimGroup && win.PCDimGroup.install) win.PCDimGroup.install(E);   // 2.457.0: dimensions as groups of parts (before the handles: its parts win)
    if (win.PCDimAuto && win.PCDimAuto.install) win.PCDimAuto.install(E);   // 2.458.0: auto / floorplan dimensions + the Chain Dimension tool
    if (win.PC3D && win.PC3D.install) win.PC3D.install(E);
    if (win.PCBlendLayer && win.PCBlendLayer.install) win.PCBlendLayer.install(E);   // 2.542.0: a Blender layer - the timeline's scene tools over the canvas   // 2.460.0: a Daz / Blender scene as a 3D layer (camera, pose, render, generate)
    if (win.PCSketchTools && win.PCSketchTools.install) win.PCSketchTools.install(E);   // 2.462.0: sketch layers (a CAD sketch: constraints + dimensions)
    if (win.PCSketchCADUI && win.PCSketchCADUI.install) win.PCSketchCADUI.install(E);   // 2.464.0: the sketch's Measure tool, units, DXF / SVG out, DXF in
    if (win.PCHandles && win.PCHandles.install) win.PCHandles.install(E);   // 2.452.0: the Move tool's scale / rotate handles, transform options
    if (win.PCSelHl && win.PCSelHl.install) win.PCSelHl.install(E);       // 2.470.0: hover / picked outlines, a click on nothing picks nothing, the Move tool after drawing
    if (win.PCMultiSel && win.PCMultiSel.install) win.PCMultiSel.install(E);   // 2.474.0: Esc = no tool, the selection box, several layers picked, Del
    if (win.PCCadBar && win.PCCadBar.install) win.PCCadBar.install(E);     // 2.470.0: the CAD toolbar along the top (static/cadbar.js)
    if (win.PCBody && win.PCBody.install) win.PCBody.install(E);           // 2.471.0: parametric 3D bodies (static/body3d.js) - the SOLID tab, the 🧊 Body tab
    if (win.PCUnreal && win.PCUnreal.install) win.PCUnreal.install(E);     // 2.472.0: Unreal Engine 5.8 + MetaHuman layers (static/unreal.js) - the UNREAL tab
    if (win.PCUECam && win.PCUECam.install) win.PCUECam.install(E);       // 2.475.0: the Unreal camera tool + the 🎥 Camera tab (lens, f-stop, exposure, presets)
    if (win.PCUELights && win.PCUELights.install) win.PCUELights.install(E); // 2.476.0: Unreal lights, volumetric lights + fog (static/uerig.js) - the 💡 Lights tab + the light tool
    if (win.IEFilters2 && win.IEFilters2.install) win.IEFilters2.install(E); // 2.480.0: more adjustments (Shadows / Highlights, Selective Color, Color Lookup…) + Apply Image
    if (win.IEFilters3 && win.IEFilters3.install) win.IEFilters3.install(E); // 2.481.0: the Filter menu's round B (filters3.js + filters4.js) - the Custom filter's 5 x 5 kernel
    if (win.IEFilters5 && win.IEFilters5.install) win.IEFilters5.install(E); // 2.482.0: Filter ▸ Develop Filter… + Lens Correction… (filters5.js)
    if (win.PCMeasure && win.PCMeasure.install) win.PCMeasure.install(E);   // 2.483.0: Navigator / Histogram / Info / Notes, sampler, ruler, note, count, perspective crop, Grow / Similar / Focus Area, Matting
    if (win.IEBrushDyn && win.IEBrushDyn.install) win.IEBrushDyn.install(E); // 2.484.0: the 🖌 Brush tab - Brush Settings, presets, .abr brushes (brushdyn.js)
    if (win.PCFilePlus && win.PCFilePlus.install) win.PCFilePlus.install(E); // 2.485.0: BMP / TIFF / GIF / TGA / AVIF export, File Info, Print, Contact Sheet, Crop and Straighten Photos (pcfileplus.js)
    if (win.PCMerge && win.PCMerge.install) win.PCMerge.install(E);       // 2.486.0: Auto-Align / Auto-Blend Layers, Photomerge, Merge to HDR (pcmerge.js)
    if (win.PCMode && win.PCMode.install) win.PCMode.install(E);         // 2.487.0: Image ▸ Mode, Proof Colors, Gamut Warning, CMYK TIFF (pcmode.js)
    if (win.PCSubject && win.PCSubject.install) win.PCSubject.install(E);   // 2.488.0: Select ▸ Subject (built in / AI matte), Layer ▸ Remove Background (pcsubject.js)

    paintCtlTypes();
    setTool("rect"); info(); renderLayersPanel();
    return { load, state: S, P, undo, redo, setTool, setAiMode, applyResult, discardResults, flatten, choosePreset, runAI, paintEngines,
             openImage, layerFromSelection, clearSelectionArea, fillAt, changeSel,
             openFilter, repeatFilter, controlFromImage, controlImage, renderControls, paintControlNets, E };
  }

  const api = { P, mount, TOOLS, PAINT, MODES, CSS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ImageEdit = api;
})(typeof window !== "undefined" ? window : globalThis);
