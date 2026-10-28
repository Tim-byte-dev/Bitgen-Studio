/* pclivewarp.js — THE IMAGE EDITOR: A WARP GRID ON TEXT AND SHAPE LAYERS THAT STAY TEXT / SHAPES (2.608.0),
 * window.PCLiveWarp.
 *
 * Tim (verbatim): "can we fill shapes with text, please add 5 more preset warps and an interactive warp grid for text and
 * shapes".
 * Edit ▸ Transform ▸ Warp (or ⌗ Warp Grid in the right-click menu / the ⌒ Shape dialog) on a TEXT or SHAPE layer: the
 * same grid as on a picture - drag a point or anywhere inside to bend, the 16 presets, Grid Default / 3 x 3 / 4 x 4 /
 * 5 x 5 / custom, split lines - but the layer stays live: the text can still be typed into (its preset kept), the shape's
 * colours / stroke / size changed, and the warp follows (the grid is kept relative to the layer's own box: longer text
 * = a longer warp). Undo is one step. The preset "Custom" puts the grid back flat; Layer ▸ Remove Warp Grid takes it off.
 *   holder.mesh = {P: [[u, v] ...] (the lattice in fractions of the unwarped picture's box), G: the grid (pcmesh) | null}
 * Pure (Node): rest(G) (the flat lattice, fractions), isFlat(mesh), toAbs(P, box), toRel(P, box), wbox(mesh, box).
 * The page: on(L), draw(L, paint) (pcdoc.rasterize: the plain picture is painted only when the layer changed - a
 * drag on the grid only re-warps it), dirty(L), base(L) -> {box}, set(L, P, G, box), tidy(L), boxOf(L).
 */
(function (root) {
  "use strict";
  const gridOf = (G) => (G && G.c ? G : { c: 1, r: 1, us: [0, 1], vs: [0, 1] });
  /** the flat lattice of grid G - (3c + 1) x (3r + 1) points in 0..1 */
  function rest(G) {
    const g = gridOf(G), W = 3 * g.c + 1, H = 3 * g.r + 1, out = [];
    const at = (ks, q) => { const i = Math.min(ks.length - 2, Math.floor(q / 3)), f = q / 3 - i; return ks[i] + (ks[i + 1] - ks[i]) * f; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.push([at(g.us, x), at(g.vs, y)]);
    return out;
  }
  function isFlat(m) {
    if (!m || !Array.isArray(m.P)) return true;
    const R = rest(m.G); if (R.length !== m.P.length) return false;
    return m.P.every((p, k) => Math.abs(p[0] - R[k][0]) < 1e-4 && Math.abs(p[1] - R[k][1]) < 1e-4);
  }
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const toAbs = (P, b) => P.map(([u, v]) => [b.x + u * b.w, b.y + v * b.h]);
  const toRel = (P, b) => P.map(([x, y]) => [r6((x - b.x) / Math.max(1e-9, b.w)), r6((y - b.y) / Math.max(1e-9, b.h))]);
  function wbox(m, b) {
    if (!m || !m.P || !b) return b;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of toAbs(m.P, b)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1 - x0) + 1, h: Math.ceil(y1 - y0) + 1 };
  }
  const holder = (L) => (L && L.type === "text" ? L.text : L && L.type === "shape" ? L.shape : null);
  const can = (L) => !!holder(L);
  const on = (L) => { const h = holder(L); return !!(h && h.mesh && Array.isArray(h.mesh.P) && h.mesh.P.length >= 16); };
  const api = { rest, isFlat, toAbs, toRel, wbox, holder, can, on };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root || !root.document) return;

  /* ---------------- the page ---------------- */
  const cache = new WeakMap();                     // L -> {key, src (the plain picture, cropped), box}
  const keyOf = (L) => { const c = L.canvas; return c.width + "x" + c.height + "|" + JSON.stringify(holder(L), (k, v) => (k === "mesh" || k === "_wbox" ? undefined : v)); };
  function alphaBox(c) {
    const W = c.width, H = c.height, d = c.getContext("2d").getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) { const row = y * W * 4; for (let x = 0; x < W; x++) if (d[row + x * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  /** the plain (unwarped) picture of L: painted when the layer changed since the last time */
  function plain(L, paint) {
    const key = keyOf(L), hit = cache.get(L);
    if (hit && hit.key === key) return hit;
    const c = L.canvas; paint();
    const box = alphaBox(c); let src = null;
    if (box) { src = c.ownerDocument.createElement("canvas"); src.width = box.w; src.height = box.h; src.getContext("2d").drawImage(c, -box.x, -box.y); }
    const o = { key, src, box }; cache.set(L, o); return o;
  }
  function setBox(h, b) { try { Object.defineProperty(h, "_wbox", { value: b, configurable: true, writable: true, enumerable: false }); } catch (e) { /* frozen */ } }
  /** pcdoc.rasterize: L's picture through its warp grid -> true when drawn */
  function draw(L, paint) {
    const h = holder(L), X = root.PCMesh, SM = root.PCSmart; if (!h || !on(L) || !X || !SM) return false;
    const o = plain(L, paint), c = L.canvas, g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    if (!o.box || !o.src) return true;
    const P = toAbs(h.mesh.P, o.box), G = h.mesh.G && h.mesh.G.c ? h.mesh.G : null;
    SM.drawSource(g, o.src, Object.assign({ quad: X.latCorners(P, G), warp: P }, G ? { wgrid: G } : {}));
    setBox(h, wbox(h.mesh, o.box));
    return true;
  }
  const dirty = (L) => { cache.delete(L); };
  /** the unwarped box (paints it when needed) */
  function base(L) {
    const D = root.PCDoc, h = holder(L); if (!h || !D) return null;
    const o = plain(L, () => { const m = h.mesh; delete h.mesh; try { D.rasterize(L); } finally { if (m) h.mesh = m; } });
    if (on(L)) D.rasterize(L);
    return o.box ? { box: o.box } : null;
  }
  function set(L, P, G, box) { const h = holder(L); if (!h) return; h.mesh = { P: toRel(P, box), G: G && G.c ? JSON.parse(JSON.stringify(G)) : null }; }
  function tidy(L) { const h = holder(L); if (h && h.mesh && isFlat(h.mesh)) { delete h.mesh; setBox(h, null); } }
  function boxOf(L) { const h = holder(L); return h && h.mesh && h._wbox ? h._wbox : null; }
  Object.assign(api, { draw, dirty, base, set, tidy, boxOf, alphaBox });
  root.PCLiveWarp = api;
})(typeof window !== "undefined" ? window : globalThis);
