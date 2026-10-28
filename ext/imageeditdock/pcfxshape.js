/* pcfxshape.js — THE IMAGE EDITOR: A TEXT PRESET KEPT ON A SHAPED TEXT (2.607.0), window.PCFxShape.
 *
 * Tim (verbatim): "is it possible to keep the text presets when operations when shape tools like 3d , warp etc are used".
 * A text effect preset (t.fx - static/textfx.js) was only drawn on a STRAIGHT text: the moment ⌒ Shape / 3D warped it,
 * put it round a circle or along a path, made it 3D or vertical (pctext.js) - or the Character / Paragraph panels
 * (pctype.js) or per-letter settings (pcruns.js) took over its drawing - the preset was dropped and the plain letters
 * came back. Now the words are drawn in their shape first (plainly) and the preset's whole stack (its copies, strokes,
 * bevels, overlays, shadows) is laid over THAT drawing, live as before (a quick picture while you type / drag a slider,
 * the sharp one when you stop):
 *   warp / circle / path / vertical / caps / underline   the shaped letters get the preset
 *   3D (extrude)                                         the sides are drawn from the plain letters (in the preset's own
 *                                                        colour, darker - unless a side colour is set), the preset face on top
 * The effects keep the size they have on the straight words (scaled by the letters' height, not the shape's).
 *   shaped(t)                  does this text draw through pctext / pctype / pcruns (and so needs this to keep its preset)?
 *   draw(g, t, slot, onUpdate) -> true when drawn (false = not ready yet: draw it plainly, onUpdate comes when it is)
 *   sideColor(t, face)         the 3D sides' colour (pure apart from avgColor)
 */
(function (root) {
  "use strict";
  const extOn = (t) => !!(t && t.extrude && t.extrude.on && +t.extrude.depth > 0);
  function shaped(t) {
    if (!t || !t.fx) return false;
    return !!((root.PCRuns && root.PCRuns.owns(t)) || (root.PCText && root.PCText.wants(t)) || (root.PCType && root.PCType.owns(t)));
  }
  /** the words drawn plainly in their shape (no 3D, no turn - pcdoc turns the layer after) */
  function plain(g, t) {
    const D = root.PCDoc;
    if (root.PCRuns && root.PCRuns.owns(t)) root.PCRuns.draw(g, t);
    else if (root.PCText && root.PCText.wants(t)) root.PCText.draw(g, t);
    else if (root.PCType && root.PCType.owns(t)) root.PCType.draw(g, t);
    else if (D) D.drawText(g, t);
  }
  const newCanvas = (ref, w, h) => {
    const d = ref && ref.ownerDocument; const c = d ? d.createElement("canvas") : new root.OffscreenCanvas(w, h);
    c.width = Math.max(1, w); c.height = Math.max(1, h); return c;
  };
  /** what the drawing depends on - the preset's job key */
  function keyOf(t, W, H) {
    const o = {}; for (const k of Object.keys(t)) if (k !== "fx" && k !== "rot" && k !== "xm") o[k] = t[k];
    return W + "x" + H + "|" + JSON.stringify(o);
  }
  function sideColor(t, face) {
    const e = t.extrude || {}; if (e.color) return e.color;
    const X = root.H3TextFx, PT = root.PCText, avg = X && X.avgColor ? X.avgColor(face) : null;
    return PT && PT.darker ? PT.darker(avg || t.color || "#000000", 0.55) : (avg || "#333333");
  }
  function draw(g, t, slot, onUpdate) {
    const X = root.H3TextFx, D = root.PCDoc;
    if (!X || !X.faceLive || !D || !shaped(t)) return false;
    const c = g.canvas, W = c.width, H = c.height;
    const flat = Object.assign({}, t, { extrude: null, rot: 0, xm: null }); delete flat.fx;
    const make = () => {
      const F = newCanvas(c, W, H), fg = F.getContext("2d");
      plain(fg, flat);
      const b = D.textBox0(flat, fg), pad = Math.ceil((+t.size || 48) * 0.6);
      const spec = { text: t.caps ? String(t.str || "").toUpperCase() : t.str, font: t.font, size: t.size, weight: t.weight, italic: t.italic, leading: t.leading || 1.2 };
      return { canvas: F, box: { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 }, hRef: X.inkHeight(spec), color: t.color };
    };
    const r = X.faceLive(slot, keyOf(flat, W, H), t.fx, make, onUpdate);
    if (!r) return false;
    if (extOn(t) && root.PCText) {
      // the 3D sides from the plain letters, back to front, darker towards the back; the preset's face on top
      const F = newCanvas(c, W, H), fg = F.getContext("2d"); plain(fg, flat);
      const e = t.extrude, ink = r.ink;
      const x0 = Math.max(0, ink.x - 2), y0 = Math.max(0, ink.y - 2), w = Math.min(W - x0, ink.w + 4), h = Math.min(H - y0, ink.h + 4);
      if (w > 0 && h > 0) {
        const side = newCanvas(c, w, h), sg = side.getContext("2d"), dark = newCanvas(c, w, h), dg = dark.getContext("2d");
        sg.drawImage(F, x0, y0, w, h, 0, 0, w, h); sg.globalCompositeOperation = "source-in"; sg.fillStyle = sideColor(t, r.canvas); sg.fillRect(0, 0, w, h);
        dg.drawImage(F, x0, y0, w, h, 0, 0, w, h); dg.globalCompositeOperation = "source-in"; dg.fillStyle = "#000"; dg.fillRect(0, 0, w, h);
        for (const s of root.PCText.extrudeSteps(e.depth, e.angle, e.shade == null ? 0.5 : e.shade)) {
          g.drawImage(side, x0 + s.dx, y0 + s.dy);
          if (s.dark > 0) { g.save(); g.globalAlpha = s.dark; g.drawImage(dark, x0 + s.dx, y0 + s.dy); g.restore(); }
        }
      }
    }
    g.drawImage(r.canvas, Math.round(r.x), Math.round(r.y));
    return true;
  }
  const api = { shaped, draw, sideColor, keyOf, plain };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCFxShape = api;
})(typeof window !== "undefined" ? window : globalThis);
