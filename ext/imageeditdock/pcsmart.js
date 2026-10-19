/* pcsmart.js — THE IMAGE EDITOR'S SMART OBJECTS AND SMART FILTERS (2.422.0), window.PCSmart.
 *
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first" - gap 2 of the Photoshop list: smart objects + smart
 * filters. Photoshop's behaviour, our own code:
 *
 *   A SMART OBJECT   a layer of type "smart": L.smart = {src, w, h, t: {quad, warp}, filters: [...]} - `src` names an
 *                    immutable SOURCE in this file's store (its pixels, w x h, and the layers it was made from), `t` is
 *                    where it sits: a quad (TL, TR, BR, BL - move / scale / rotate / skew / distort / perspective) or a
 *                    16-point warp patch (pcmesh.js). The layer's canvas is always RE-DRAWN from the source, so scaling
 *                    down and up again loses nothing. Duplicates share the source (edit one, all change).
 *   CONVERT          Layer ▸ Smart Objects ▸ Convert to Smart Object (a pixel / text / shape / fill layer or a group:
 *                    the layers go INSIDE, editable; the smart object = how they look, cropped to their content).
 *   EDIT CONTENTS    the inside opens in the editor (a banner: ✔ Done / ✕ Cancel); Done = a new source for every layer
 *                    that used the old one, one undo step. Nested smart objects nest sessions.
 *   SMART FILTERS    any Filter / Image ▸ Adjustments item on a smart object is ADDED, not baked: a list under the layer
 *                    (on / off, double-click = its settings again, opacity, delete, order), all through one FILTER MASK
 *                    (white = the filters show; painted like a layer mask). Liquify and Puppet Warp are smart filters
 *                    too (pcwarp.js; their data in this file's field store).
 *   ALSO             New Smart Object via Copy (its own source), Replace Contents…, Export Contents (PNG), Rasterize,
 *                    Convert to Layers (the inside back as a group), Properties; the move tool / crop / image size /
 *                    rotate move the transform (the source untouched).
 */
(function (root) {
  "use strict";
  const STORE = new Map();          // id -> {id, canvas, w, h, doc}
  const FIELDS = new Map();         // id -> a liquify field {w, h, dx, dy, box}
  let sid = 0;
  const M = () => root.PCMesh;
  function addSource(canvas, doc) { const id = "so" + (++sid) + "-" + Date.now().toString(36); STORE.set(id, { id, canvas, w: canvas.width, h: canvas.height, doc: doc || null }); return id; }
  function addField(f) { const id = "lq" + (++sid) + "-" + Date.now().toString(36); FIELDS.set(id, f); return id; }
  const mk = (like, w, h) => { const d = like && like.ownerDocument; const c = d ? d.createElement("canvas") : new root.OffscreenCanvas(w, h); c.width = w; c.height = h; return c; };

  /** draw a source through a transform t = {quad, warp} onto g */
  function drawSource(g, src, t) {
    const X = M(); if (!src || !t) return;
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    if (t.warp) X.drawMesh(g, src, X.meshOf(t));   // 2.450.0: a gridded / split warp too (t.wgrid)
    else if (X.isAffineQuad(t.quad, 0.01)) { const m = X.affineOfQuad(t.quad, src.width, src.height); g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); g.drawImage(src, 0, 0); }
    else X.drawMesh(g, src, X.quadMesh(t.quad, 24));
    g.restore();
  }
  /** apply ONE smart filter to rgba (W x H); returns the new rgba */
  /* 2.434.0 (the gap list: "Smart filter blend modes (opacity only)"): a smart filter's Blending Options - its result
     blended onto what came in by a MODE, then by its opacity. Per channel, 0..1: b = below (the input), s = the filter. */
  const BLEND_MODES = ["normal", "dissolve", "darken", "multiply", "color-burn", "linear-burn", "lighten", "screen", "color-dodge", "linear-dodge", "overlay", "soft-light", "hard-light",
    "vivid-light", "linear-light", "pin-light", "difference", "exclusion", "subtract", "divide", "hue", "saturation", "color", "luminosity"];
  function blendCh(m, b, s) {
    switch (m) {
      case "darken": return Math.min(b, s);
      case "multiply": return b * s;
      case "color-burn": return b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s);
      case "linear-burn": return Math.max(0, b + s - 1);
      case "lighten": return Math.max(b, s);
      case "screen": return b + s - b * s;
      case "color-dodge": return b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s));
      case "linear-dodge": return Math.min(1, b + s);
      case "overlay": return b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
      case "hard-light": return s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
      case "soft-light": { if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b); const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b); return b + (2 * s - 1) * (d - b); }
      case "vivid-light": return s <= 0.5 ? (s <= 0 ? 0 : Math.max(0, 1 - (1 - b) / (2 * s))) : (s >= 1 ? 1 : Math.min(1, b / (2 * (1 - s))));
      case "linear-light": return Math.max(0, Math.min(1, b + 2 * s - 1));
      case "pin-light": return s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1);
      case "difference": return Math.abs(b - s);
      case "exclusion": return b + s - 2 * b * s;
      case "subtract": return Math.max(0, b - s);
      case "divide": return s <= 0 ? 1 : Math.min(1, b / s);
      default: return s;
    }
  }
  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  function clipC(r, g, b) {
    const l = lum(r, g, b), n = Math.min(r, g, b), x = Math.max(r, g, b);
    if (n < 0) { r = l + (r - l) * l / (l - n); g = l + (g - l) * l / (l - n); b = l + (b - l) * l / (l - n); }
    if (x > 1) { r = l + (r - l) * (1 - l) / (x - l); g = l + (g - l) * (1 - l) / (x - l); b = l + (b - l) * (1 - l) / (x - l); }
    return [r, g, b];
  }
  const setLum = (c, l) => { const d = l - lum(c[0], c[1], c[2]); return clipC(c[0] + d, c[1] + d, c[2] + d); };
  const sat = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
  function setSat(c, s) {
    const o = c.slice(), idx = [0, 1, 2].sort((p, q) => o[p] - o[q]), [mn, md, mx] = idx;
    if (o[mx] > o[mn]) { o[md] = ((o[md] - o[mn]) * s) / (o[mx] - o[mn]); o[mx] = s; } else { o[md] = 0; o[mx] = 0; }
    o[mn] = 0; return o;
  }
  /** one pixel (0..1 rgb): the mode's colour of s over b */
  function blendPx(m, b, s) {
    if (m === "hue") return setLum(setSat(s, sat(b)), lum(b[0], b[1], b[2]));
    if (m === "saturation") return setLum(setSat(b, sat(s)), lum(b[0], b[1], b[2]));
    if (m === "color") return setLum(s, lum(b[0], b[1], b[2]));
    if (m === "luminosity") return setLum(b, lum(s[0], s[1], s[2]));
    return [blendCh(m, b[0], s[0]), blendCh(m, b[1], s[1]), blendCh(m, b[2], s[2])];
  }
  /** the filter's output onto its input: blend mode, then opacity (a = 0..1); "dissolve" = a random share of pixels */
  function blendInto(rgba, out, mode, a) {
    const m = BLEND_MODES.includes(mode) ? mode : "normal";
    if (m === "normal" && a >= 1) return out;
    const mix = Uint8ClampedArray.from(rgba);
    let seed = 1234567;
    for (let i = 0; i < mix.length; i += 4) {
      if (m === "dissolve") { seed = (seed * 1103515245 + 12345) & 0x7fffffff; if (seed / 0x7fffffff < a) { mix[i] = out[i]; mix[i + 1] = out[i + 1]; mix[i + 2] = out[i + 2]; mix[i + 3] = out[i + 3]; } continue; }
      const b = [rgba[i] / 255, rgba[i + 1] / 255, rgba[i + 2] / 255], s = [out[i] / 255, out[i + 1] / 255, out[i + 2] / 255];
      const c = m === "normal" ? s : blendPx(m, b, s);
      for (let k = 0; k < 3; k++) mix[i + k] = Math.round(rgba[i + k] + (c[k] * 255 - rgba[i + k]) * a);
      mix[i + 3] = Math.round(rgba[i + 3] + (out[i + 3] - rgba[i + 3]) * a);
    }
    return mix;
  }
  function runFilter(f, rgba, W, H, canvasLike) {
    const X = M(), FX = root.IEFilters;
    if (f.id === "liquify") {
      const F = FIELDS.get(f.field); if (!F) return rgba;
      const b = f.box || { x: 0, y: 0, w: W, h: H };
      if (b.x === 0 && b.y === 0 && b.w === W && b.h === H) return X.applyField(rgba, W, H, F);
      // a field over a box of the picture: cut, liquify, put back
      const bx = Math.max(0, Math.round(b.x)), by = Math.max(0, Math.round(b.y)), bw = Math.min(W - bx, Math.round(b.w)), bh = Math.min(H - by, Math.round(b.h));
      if (bw < 2 || bh < 2) return rgba;
      const part = new Uint8ClampedArray(bw * bh * 4);
      for (let y = 0; y < bh; y++) part.set(rgba.subarray(((by + y) * W + bx) * 4, ((by + y) * W + bx + bw) * 4), y * bw * 4);
      const o = X.applyField(part, bw, bh, F), out = Uint8ClampedArray.from(rgba);
      for (let y = 0; y < bh; y++) out.set(o.subarray(y * bw * 4, (y + 1) * bw * 4), ((by + y) * W + bx) * 4);
      return out;
    }
    if (f.id === "puppet") {
      if (!f.pins || !f.pins.length || !f.box) return rgba;
      const c = mk(canvasLike, W, H), g = c.getContext("2d"); g.putImageData(new ImageData(Uint8ClampedArray.from(rgba), W, H), 0, 0);
      const o = mk(canvasLike, W, H), og = o.getContext("2d");
      // what is outside the pinned box stays; the box is re-drawn through the mesh
      og.drawImage(c, 0, 0); og.clearRect(f.box.x, f.box.y, f.box.w, f.box.h);
      X.drawMesh(og, c, X.puppetMesh(f.box, f.pins, f.n || 20), f.box);
      return og.getImageData(0, 0, W, H).data;
    }
    if (!FX || !FX.byId(f.id)) return rgba;
    const out = FX.run(f.id, Uint8ClampedArray.from(rgba), W, H, f.params || {});
    const a = f.opacity == null ? 1 : f.opacity;
    return blendInto(rgba, out, f.blend || "normal", a);                 // 2.434.0: + its blend mode
  }
  /** re-draw a smart layer's canvas from its source (cached: nothing changed = nothing done); L._fast skips filters */
  function render(L) {
    const sm = L.smart, c = L.canvas; if (!sm || !c) return;
    const W = c.width, H = c.height;
    const fm = L.fmask ? [L.fmask.ver || 0, L.fmask.on !== false] : null;
    const key = JSON.stringify([sm.src, W, H, sm.t, L._fast ? 0 : sm.filters, fm]);
    if (L._skey === key) return;
    const g = c.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const S0 = STORE.get(sm.src);
    if (S0) drawSource(g, S0.canvas, sm.t);
    const on = L._fast ? [] : (sm.filters || []).filter((f) => f.on !== false);
    if (on.length) {
      const base = g.getImageData(0, 0, W, H).data;
      let cur = base;
      for (const f of on) { try { cur = runFilter(f, cur, W, H, c); } catch (e) { if (root.console) console.warn("[smart filter] " + f.id + ": " + e.message); } }
      if (L.fmask && L.fmask.on !== false && L.fmask.canvas) {
        const m = L.fmask.canvas.getContext("2d").getImageData(0, 0, W, H).data, out = new Uint8ClampedArray(base.length);
        for (let i = 0; i < base.length; i += 4) {
          const k = (0.299 * m[i] + 0.587 * m[i + 1] + 0.114 * m[i + 2]) / 255;
          for (let ch = 0; ch < 4; ch++) out[i + ch] = base[i + ch] + (cur[i + ch] - base[i + ch]) * k;
        }
        cur = out;
      }
      g.putImageData(new ImageData(Uint8ClampedArray.from(cur), W, H), 0, 0);
    }
    L._skey = key; L.ver = (L.ver || 0) + 1;
  }
  /** a transform t moved by the matrix m (crop, image size, rotate, the move tool) */
  function mapT(t, m) {
    const P = (p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
    return Object.assign({ quad: t.quad.map(P), warp: t.warp ? t.warp.map(P) : null }, t.warp && t.wgrid ? { wgrid: JSON.parse(JSON.stringify(t.wgrid)) } : {});
  }
  function mapFilters(filters, m) {
    const P = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    for (const f of filters || []) {
      if (f.id === "puppet" && f.pins) {
        f.pins = f.pins.map((p) => { const [x, y] = P(p.x, p.y), [X, Y] = P(p.X, p.Y); return { x, y, X, Y }; });
        if (f.box) { const q = [[f.box.x, f.box.y], [f.box.x + f.box.w, f.box.y + f.box.h]].map(([x, y]) => P(x, y)); f.box = { x: Math.min(q[0][0], q[1][0]), y: Math.min(q[0][1], q[1][1]), w: Math.abs(q[1][0] - q[0][0]), h: Math.abs(q[1][1] - q[0][1]) }; }
      }
      if (f.id === "liquify" && f.box) {          // the field itself is in the box's own units: only the box moves / scales
        const q = [[f.box.x, f.box.y], [f.box.x + f.box.w, f.box.y + f.box.h]].map(([x, y]) => P(x, y));
        f.box = { x: Math.min(q[0][0], q[1][0]), y: Math.min(q[0][1], q[1][1]), w: Math.abs(q[1][0] - q[0][0]), h: Math.abs(q[1][1] - q[0][1]) };
      }
    }
    return filters;
  }

  /* ================================ the page ================================ */
  function install(E) {
    const X = M(); if (!X || !E.tools) return;
    const { S, D, doc, $, say, ctx, newCanvas, store } = E;
    const FX = root.IEFilters;
    if (!doc.getElementById("pcsmartCss")) {
      const st = doc.createElement("style"); st.id = "pcsmartCss";
      st.textContent = ".kx canvas.so{outline:1px solid var(--pc-dim);outline-offset:-1px;background-image:linear-gradient(135deg,transparent 70%,var(--pc-accent) 70%)}"
        + ".kx .sfrow{padding-left:46px!important;font-size:11px;min-height:22px}.kx .sfrow .nm{color:var(--pc-dim)}.kx .sfrow canvas{width:26px;height:19px}"
        + ".kx .sfitem{padding-left:58px!important;font-size:11px;min-height:20px}.kx .sfitem .x{margin-left:auto;opacity:.6;cursor:pointer;padding:0 4px}.kx .sfitem .x:hover{opacity:1}"
        + ".kx .sobanner{position:absolute;left:50%;top:6px;transform:translateX(-50%);z-index:40;display:flex;gap:8px;align-items:center;padding:5px 10px;border:1px solid var(--pc-accent);"
        + "border-radius:6px;background:var(--pc-panel);color:var(--pc-text);box-shadow:0 4px 16px rgba(0,0,0,.4);font-size:12px}";
      doc.head.appendChild(st);
    }
    const isSmart = (L) => !!L && L.type === "smart" && !!L.smart;
    const cur = () => { const L = E.layer(); return isSmart(L) ? L : null; };
    const env = () => E.docEnv({ srcFor: (x) => x.canvas, maskSrc: null });
    const copyCanvas = (c, w, h, dx, dy) => { const n = newCanvas(w || c.width, h || c.height); ctx(n).drawImage(c, dx || 0, dy || 0); return n; };
    const refresh = () => { E.refresh(); E.renderLayersPanel(); };

    /* ---------------- convert ---------------- */
    /** fresh copies of layers (new ids), moved by (-ox, -oy) onto a w x h canvas: the inside of a smart object */
    function innerDoc(list, w, h, ox, oy) {
      const map = new Map(), out = [];
      for (const L of list) {
        const n = E.makeLayer(L.name, w, h, L.type);
        const keep = { id: n.id, canvas: n.canvas };
        Object.assign(n, D.clone(Object.assign({}, L, { canvas: null, mask: null, fmask: null, _skey: null })), keep);
        ctx(n.canvas).drawImage(L.canvas, -ox, -oy);
        if (L.mask) { n.mask = E.newMask("#ffffff", w, h); ctx(n.mask.canvas).drawImage(L.mask.canvas, -ox, -oy); Object.assign(n.mask, { on: L.mask.on, density: L.mask.density, feather: L.mask.feather, linked: L.mask.linked }); }
        if (L.fmask) { n.fmask = { canvas: newCanvas(w, h), on: L.fmask.on, ver: 0 }; ctx(n.fmask.canvas).drawImage(L.fmask.canvas, -ox, -oy); }
        if (n.text) { n.text.x -= ox; n.text.y -= oy; }
        if (n.shape) { n.shape.x -= ox; n.shape.y -= oy; }
        if (n.vmask && n.vmask.path && root.PCPath) n.vmask.path = root.PCPath.translate(n.vmask.path, -ox, -oy);
        if (n.smart) { n.smart.t = mapT(n.smart.t, [1, 0, 0, 1, -ox, -oy]); mapFilters(n.smart.filters, [1, 0, 0, 1, -ox, -oy]); }
        map.set(L.id, n.id); out.push(n);
      }
      for (const n of out) n.parent = n.parent != null && map.has(n.parent) ? map.get(n.parent) : null;
      for (const n of out) if (D.isLive(n)) D.rasterize(n);
      return { w, h, active: Math.max(0, out.length - 1), sel: null, paths: [], work: null, ptarget: null,
        layers: out.map((n) => ({ snap: D.snapLayer(n), canvas: copyCanvas(n.canvas), mask: n.mask ? copyCanvas(n.mask.canvas) : null })) };
    }
    /** the active layer (a group: with everything in it) -> a smart object in its place */
    function convert() {
      const L = E.layer(); if (!L) return say("open a picture first");
      if (isSmart(L)) return say("it is a smart object already (Layer ▸ Smart Objects ▸ New Smart Object via Copy makes an independent one)");
      if (L.type === "adjust") return say("an adjustment layer has no pixels of its own - convert the layers it changes (with it, in a group)");
      const list = L.type === "group" ? D.descendants(S.layers, L.id).concat([L]) : [L];
      const look = D.renderLayer({ w: S.w, h: S.h, layers: S.layers }, env(), L);
      const b = E.alphaBox(look) || { x: 0, y: 0, w: S.w, h: S.h };
      const srcC = copyCanvas(look, b.w, b.h, -b.x, -b.y);
      const id = addSource(srcC, innerDoc(list.slice().sort((a, c) => S.layers.indexOf(a) - S.layers.indexOf(c)), b.w, b.h, b.x, b.y));
      return E.structOp("convert to smart object", () => {
        const n = E.makeLayer(L.name, S.w, S.h, "smart");
        for (const k of ["visible", "opacity", "clip", "label", "parent", "locks"]) n[k] = D.clone(L[k]);
        n.blend = L.blend === "pass-through" ? "normal" : L.blend;
        n.smart = { src: id, w: b.w, h: b.h, t: { quad: X.rectQuad(b.x, b.y, b.w, b.h), warp: null }, filters: [] };
        const at = S.layers.indexOf(L), gone = new Set(list.map((x) => x.id));
        S.layers = S.layers.filter((x) => !gone.has(x.id));
        S.layers.splice(Math.min(at - (list.length - 1), S.layers.length), 0, n);
        S.layers = D.normalize(S.layers); S.active = S.layers.indexOf(n);
        render(n);
        say(`"${L.name}" is a smart object (${b.w} × ${b.h}) - Ctrl+T transforms it without losing pixels, filters stay editable, double-click its thumbnail edits the contents`);
      });
    }
    function viaCopy() {
      const L = cur(); if (!L) return say("pick a smart object first");
      const s0 = STORE.get(L.smart.src); if (!s0) return;
      const id = addSource(copyCanvas(s0.canvas), s0.doc);
      return E.structOp("new smart object via copy", () => {
        const n = E.makeLayer(L.name + " copy", S.w, S.h, "smart");
        for (const k of ["visible", "opacity", "blend", "clip", "label", "parent", "locks", "styles", "vmask"]) n[k] = D.clone(L[k]);
        n.smart = Object.assign(D.clone(L.smart), { src: id });
        if (L.fmask) { n.fmask = { canvas: copyCanvas(L.fmask.canvas), on: L.fmask.on, ver: 0 }; }
        S.layers.splice(S.layers.indexOf(L) + 1, 0, n); S.layers = D.normalize(S.layers); S.active = S.layers.indexOf(n);
        render(n);
      });
    }
    function rasterize() { const L = cur(); if (!L) return say("pick a smart object first"); E.rasterizeLayer(false); }
    function exportContents() {
      const L = cur(); if (!L) return say("pick a smart object first");
      const s0 = STORE.get(L.smart.src); if (!s0) return;
      s0.canvas.toBlob((b) => { const a = doc.createElement("a"); a.href = URL.createObjectURL(b); a.download = String(L.name).replace(/[^\w.-]+/g, "_") + ".png"; doc.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }, "image/png");
      say("the smart object's contents (" + s0.w + " × " + s0.h + ") as a PNG");
    }
    let rin = null;
    function replaceContents(file) {
      const L = cur(); if (!L) return say("pick a smart object first");
      const go = (f) => {
        const url = URL.createObjectURL(f), im = new root.Image();
        im.onload = () => {
          const c = newCanvas(im.naturalWidth, im.naturalHeight); ctx(c).drawImage(im, 0, 0); URL.revokeObjectURL(url);
          const id = addSource(c, null), old = L.smart.src;
          E.structOp("replace contents", () => { for (const x of S.layers) if (isSmart(x) && x.smart.src === old) { x.smart.src = id; x.smart.w = c.width; x.smart.h = c.height; render(x); } });
          say(`contents replaced by ${f.name} (${c.width} × ${c.height}) - it keeps the smart object's place and size`);
        };
        im.onerror = () => say(f.name + ": not a picture this browser can read");
        im.src = url;
      };
      if (file) return go(file);
      if (!rin) { rin = doc.createElement("input"); rin.type = "file"; rin.accept = "image/*"; rin.style.display = "none"; E.kx.appendChild(rin); }
      rin.onchange = () => { const f = rin.files && rin.files[0]; rin.value = ""; if (f) go(f); };
      rin.click();
    }
    /** Convert to Layers: the inside back in the document (a group where the smart object was; its transform must be
     *  a plain move / scale for the layers to fit - else say so and use Rasterize) */
    function toLayers() {
      const L = cur(); if (!L) return say("pick a smart object first");
      const s0 = STORE.get(L.smart.src); if (!s0 || !s0.doc) return say("this smart object has no layers inside (it was made from a picture) - Rasterize makes it pixels");
      const q = L.smart.t.quad;
      if (L.smart.t.warp || !X.isAffineQuad(q, 0.5) || Math.abs(q[1][1] - q[0][1]) > 0.5 || Math.abs(q[3][0] - q[0][0]) > 0.5 || Math.abs((q[1][0] - q[0][0]) - s0.w) > 0.5 || Math.abs((q[3][1] - q[0][1]) - s0.h) > 0.5)
        return say("Convert to Layers needs the smart object at its own size, unturned (it is transformed) - Rasterize keeps how it looks");
      const ox = Math.round(q[0][0]), oy = Math.round(q[0][1]);
      return E.structOp("convert to layers", () => {
        const g = E.makeLayer(L.name, S.w, S.h, "group"); g.parent = L.parent;
        const tmp = s0.doc.layers.map((x) => { const n = E.makeLayer(x.snap.name, S.w, S.h, x.snap.type); D.putLayer(Object.assign({}, x.snap, { L: n, mask: null, fmask: null })); n.canvas = newCanvas(S.w, S.h); ctx(n.canvas).drawImage(x.canvas, ox, oy);
          if (x.mask) { n.mask = E.newMask("#ffffff"); ctx(n.mask.canvas).drawImage(x.mask, ox, oy); } return { n, old: x.snap.L.id }; });
        const ids = new Map(tmp.map((t) => [t.old, t.n.id]));
        for (const { n } of tmp) {
          n.parent = n.parent != null && ids.has(n.parent) ? ids.get(n.parent) : g.id;
          if (n.text) { n.text.x += ox; n.text.y += oy; } if (n.shape) { n.shape.x += ox; n.shape.y += oy; }
          if (n.vmask && n.vmask.path && root.PCPath) n.vmask.path = root.PCPath.translate(n.vmask.path, ox, oy);
          if (n.smart) { n.smart.t = mapT(n.smart.t, [1, 0, 0, 1, ox, oy]); mapFilters(n.smart.filters, [1, 0, 0, 1, ox, oy]); n._skey = null; }
          if (D.isLive(n)) D.rasterize(n);
        }
        const at = S.layers.indexOf(L);
        S.layers.splice(at, 1, ...tmp.map((t) => t.n), g); S.layers = D.normalize(S.layers); S.active = S.layers.indexOf(g);
      });
    }

    /* ---------------- edit contents: a session (nested ones stack) ---------------- */
    const sessions = [];
    E.smartBusy = () => sessions.length > 0;     // 2.430.0: another document can not come to the front while a smart object's contents are open
    let banner = null;
    function showBanner() {
      if (banner) banner.remove(); banner = null;
      const top = sessions[sessions.length - 1]; if (!top) return;
      banner = doc.createElement("div"); banner.className = "sobanner"; banner.id = "pcSoBanner";
      banner.innerHTML = `<span>▣ Editing the contents of <b></b>${sessions.length > 1 ? ` (${sessions.length} deep)` : ""}</span><button class="ghost" id="pcSoDone" title="Save into the smart object (every layer that uses it)">✔ Done</button><button class="ghost" id="pcSoCancel">✕ Cancel</button>`;
      banner.querySelector("b").textContent = top.name;
      banner.querySelector("#pcSoDone").onclick = () => finish(true);
      banner.querySelector("#pcSoCancel").onclick = () => finish(false);
      const stage = E.stage; (stage && stage.parentElement ? stage.parentElement : E.kx).appendChild(banner);
    }
    function editContents(L) {
      L = L || cur(); if (!isSmart(L)) return say("pick a smart object first");
      const s0 = STORE.get(L.smart.src); if (!s0) return say("this smart object's contents are gone");
      if (S.qm) E.quickMask();
      if (E.ui.closeMenus) E.ui.closeMenus();
      sessions.push({ main: E.snapDoc(), undo: S.undo, redo: S.redo, name: S.name, src: s0.id, layer: L.name, view: { zoom: S.zoom, panX: S.panX, panY: S.panY, user: S.userView } });
      sessions[sessions.length - 1].name = L.name;
      let inner = s0.doc;
      if (!inner) { const n = E.makeLayer("Layer 0", s0.w, s0.h); ctx(n.canvas).drawImage(s0.canvas, 0, 0); inner = { w: s0.w, h: s0.h, active: 0, sel: null, paths: [], work: null, ptarget: null, layers: [{ snap: D.snapLayer(n), canvas: copyCanvas(n.canvas), mask: null }] }; }
      S.undo = []; S.redo = []; S.name = L.name + " (contents)";
      E.putDoc(inner); S.fmaskEdit = false; S.maskEdit = false;
      S.userView = false; E.fitView(); refresh(); if (E.ui.history) E.ui.history();
      showBanner();
      say(`editing the contents of "${L.name}" - ✔ Done saves them into the smart object (every copy of it), ✕ Cancel leaves it as it was`);
      return true;
    }
    function finish(ok) {
      const ss = sessions.pop(); if (!ss) return false;
      let flat = null, innerSnap = null;
      if (ok) { flat = copyCanvas(E.flatten()); innerSnap = E.snapDoc(); }
      E.putDoc(ss.main); S.undo = ss.undo; S.redo = ss.redo; S.name = ss.name;
      Object.assign(S, { zoom: ss.view.zoom, panX: ss.view.panX, panY: ss.view.panY, userView: ss.view.user });
      if (ok) {
        const id = addSource(flat, innerSnap);
        E.structOp("edit contents", () => { for (const x of S.layers) if (isSmart(x) && x.smart.src === ss.src) { x.smart.src = id; x.smart.w = flat.width; x.smart.h = flat.height; render(x); } });
      }
      E.applyView(); refresh(); if (E.ui.history) E.ui.history();
      showBanner();
      say(ok ? `"${ss.layer}" updated from its contents` : "contents left as they were");
      return true;
    }

    /* ---------------- smart filters ---------------- */
    function ensureFmask(L) { if (!L.fmask) L.fmask = { canvas: (() => { const c = newCanvas(S.w, S.h), g = ctx(c); g.fillStyle = "#ffffff"; g.fillRect(0, 0, S.w, S.h); return c; })(), on: true, ver: 0 }; }
    /** add (or, idx given, re-edit) a smart filter: a dialog with a live preview for filters with settings */
    function smartFilter(L, id, again, idx) {
      const f = FX && FX.byId(id); if (!f) return say("unknown filter " + id);
      const editing = idx != null && L.smart.filters[idx];
      const params = editing ? D.clone(editing.params || {}) : Object.assign(FX.defaults(f), again && lastSmart && lastSmart.id === id ? D.clone(lastSmart.params) : D.clone(store.get("fx." + id, {})));
      const before = E.snapStruct();
      const put = (p) => {
        if (editing) L.smart.filters[idx] = Object.assign({}, L.smart.filters[idx], { params: D.clone(p) });
        else { if (L.smart.filters.length && L.smart.filters[L.smart.filters.length - 1]._new) L.smart.filters.pop(); L.smart.filters.push({ id, params: D.clone(p), on: true, opacity: 1, _new: true }); }
        ensureFmask(L); render(L); E.renderSoon();
      };
      const done = (keep) => {
        L.smart.filters.forEach((x) => { delete x._new; });
        if (!keep) { E.putStruct(before); refresh(); return; }
        E.push({ t: "struct", before, after: E.snapStruct(), label: (editing ? "smart filter settings: " : "smart filter: ") + f.name });
        lastSmart = { id, params: D.clone(params) }; store.set("fx." + id, params);
        refresh();
      };
      if (!f.params.length || again) { put(params); done(true); return say(`${f.name} added as a SMART filter - on / off, settings and order stay editable under the layer`); }
      put(params);
      const box = doc.createElement("div"); box.id = "pcSfParams";
      E.ui.dialog(f.name + (editing ? " (smart filter settings)" : " (smart filter)"), "", () => { done(true); }, { cancel: () => done(false), init(d) {
        const host = d.querySelector(".pcdb"); host.appendChild(box);
        const work = D.clone(params);
        box.innerHTML = f.params.map((q) => E.paramHtml(q, work[q.id])).join("");
        let t = null;
        E.bindParams(box, f, work, () => { clearTimeout(t); t = setTimeout(() => { Object.assign(params, D.clone(work)); put(params); }, 60); });
      } });
    }
    let lastSmart = null;
    const baseOpen = E.openFilter, baseRepeat = E.repeatFilter, baseApply = E.applyFilter;
    const smartTarget = () => { const L = cur(); return L && !S.qm && !S.fmaskEdit && !S.maskEdit ? L : null; };
    E.openFilter = function (id, again) { const L = smartTarget(); if (L) return smartFilter(L, id, again); return baseOpen.apply(this, arguments); };
    E.repeatFilter = function () { const L = smartTarget(); if (L) { if (!lastSmart) return say("no smart filter to repeat yet"); return smartFilter(L, lastSmart.id, true); } return baseRepeat.apply(this, arguments); };
    E.applyFilter = function (id, params, label) {
      const L = smartTarget(); if (!L) return baseApply.apply(this, arguments);
      const f = FX.byId(id); if (!f) return false;
      E.structOp("smart filter: " + (label || f.name), () => { L.smart.filters.push({ id, params: Object.assign(FX.defaults(f), params || {}), on: true, opacity: 1, label: label || null }); ensureFmask(L); render(L); });
      say((label || f.name) + " added as a smart filter"); return true;
    };
    function filterName(f) { if (f.label) return f.label; if (f.id === "liquify") return "Liquify"; if (f.id === "puppet") return "Puppet Warp"; const d = FX && FX.byId(f.id); return d ? d.name : f.id; }
    function editFilter(L, i) {
      const f = L.smart.filters[i]; if (!f) return;
      if (f.id === "liquify" && E.liquify) return E.liquify(L, i);
      if (f.id === "puppet" && E.puppet) return E.puppet(L, i);
      const d = FX && FX.byId(f.id); if (!d || !d.params.length) return say(filterName(f) + " has no settings");
      smartFilter(L, f.id, false, i);
    }
    function filterOp(L, label, fn) { E.structOp(label, () => { if (fn() === false) return false; render(L); }); }

    /* ---------------- the Layers panel: Smart Filters rows ---------------- */
    const thumb = (src) => { const c = newCanvas(26, 19), g = ctx(c); if (g && S.w) { const k = Math.min(26 / S.w, 19 / S.h); g.drawImage(src, (26 - S.w * k) / 2, (19 - S.h * k) / 2, S.w * k, S.h * k); } return c; };
    E.ui.layerExtra = (Ly, i, row, box) => {
      if (!isSmart(Ly) || !(Ly.smart.filters || []).length) return;
      const head = doc.createElement("div"); head.className = "kxlayer sfrow" + (i === S.active && S.fmaskEdit ? " on" : "");
      if (Ly.fmask) {
        const mk2 = thumb(Ly.fmask.canvas); mk2.className = "mk" + (Ly.fmask.on === false ? " off" : "") + (i === S.active && S.fmaskEdit ? " sel" : "");
        mk2.title = "Smart filter mask - click to paint on it (black hides the filters there); Shift-click turns it off";
        mk2.onclick = (e) => { e.stopPropagation(); E.setActive(i, false); if (e.shiftKey) return filterOp(Ly, "filter mask on / off", () => { Ly.fmask.on = Ly.fmask.on === false; Ly.fmask.ver++; }); S.fmaskEdit = true; E.renderLayersPanel(); E.info(); say("painting on the smart filter mask - black hides the filters, white shows them"); };
        head.appendChild(mk2);
      }
      const nm = doc.createElement("span"); nm.className = "nm"; nm.textContent = "Smart Filters"; head.appendChild(nm);
      const all = doc.createElement("button"); all.className = "eye"; all.textContent = Ly.smart.filters.some((f) => f.on !== false) ? "👁" : "·"; all.title = "All smart filters on / off";
      all.onclick = (e) => { e.stopPropagation(); const on = !Ly.smart.filters.some((f) => f.on !== false); filterOp(Ly, "smart filters on / off", () => { Ly.smart.filters.forEach((f) => { f.on = on; }); }); };
      head.prepend(all);
      head.onclick = () => E.setActive(i, false);
      box.appendChild(head);
      Ly.smart.filters.slice().reverse().forEach((f, r) => {
        const k = Ly.smart.filters.length - 1 - r;
        const it = doc.createElement("div"); it.className = "kxlayer sfitem"; it.dataset.sf = k;
        const eye = doc.createElement("button"); eye.className = "eye"; eye.textContent = f.on === false ? "·" : "👁"; eye.title = "On / off";
        eye.onclick = (e) => { e.stopPropagation(); filterOp(Ly, "smart filter on / off", () => { Ly.smart.filters[k].on = Ly.smart.filters[k].on === false; }); };
        const bl = f.blend && f.blend !== "normal" ? f.blend.replace(/-/g, " ") : "";
        const n = doc.createElement("span"); n.className = "nm"; n.textContent = filterName(f) + (bl || (f.opacity != null && f.opacity < 1) ? ` (${[bl, f.opacity != null && f.opacity < 1 ? Math.round(f.opacity * 100) + "%" : ""].filter(Boolean).join(" ")})` : "");
        n.title = "double-click: its settings · right-click: Blending Options (mode, opacity)";
        n.ondblclick = (e) => { e.stopPropagation(); E.setActive(i, false); editFilter(Ly, k); };
        const up = doc.createElement("span"); up.className = "x"; up.textContent = "▲"; up.title = "Later in the order (on top)";
        up.onclick = (e) => { e.stopPropagation(); if (k >= Ly.smart.filters.length - 1) return; filterOp(Ly, "smart filter order", () => { const a = Ly.smart.filters; [a[k], a[k + 1]] = [a[k + 1], a[k]]; }); };
        const x = doc.createElement("span"); x.className = "x"; x.textContent = "✕"; x.title = "Delete this smart filter";
        x.onclick = (e) => { e.stopPropagation(); filterOp(Ly, "delete smart filter", () => { Ly.smart.filters.splice(k, 1); if (!Ly.smart.filters.length) Ly.fmask = null; }); };
        it.oncontextmenu = (e) => {
          e.preventDefault(); e.stopPropagation();
          E.ui.dialog("Blending Options (" + filterName(f) + ")", `<div class="rw"><span>Mode</span><select id="sfBl">${BLEND_MODES.map((m) => `<option value="${m}"${(f.blend || "normal") === m ? " selected" : ""}>${m.replace(/-/g, " ")}</option>`).join("")}</select></div>
            <div class="rw"><span>Opacity (%)</span><input type="number" id="sfOp" min="0" max="100" value="${Math.round((f.opacity == null ? 1 : f.opacity) * 100)}"></div>`,
            (d) => { const v = Math.max(0, Math.min(100, +d.querySelector("#sfOp").value || 0)) / 100, m = d.querySelector("#sfBl").value;
              filterOp(Ly, "smart filter blending", () => { Ly.smart.filters[k].opacity = v; if (m === "normal") delete Ly.smart.filters[k].blend; else Ly.smart.filters[k].blend = m; }); });
        };
        it.append(eye, n, up, x);
        it.onclick = () => E.setActive(i, false);
        box.appendChild(it);
      });
    };

    /* ---------------- Properties ---------------- */
    E.ui.smartProps = (A) => {
      const s0 = STORE.get(A.smart.src), q = A.smart.t.quad, wdt = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), hgt = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
      const shared = S.layers.filter((x) => isSmart(x) && x.smart.src === A.smart.src).length;
      return `<div style="color:var(--pc-dim)">Smart object · contents ${s0 ? s0.w + " × " + s0.h : "?"}${s0 && s0.doc ? ` (${s0.doc.layers.length} layer${s0.doc.layers.length > 1 ? "s" : ""})` : ""} · shown ${Math.round(wdt)} × ${Math.round(hgt)}${A.smart.t.warp ? " · warped" : X.isAffineQuad(q, 0.5) ? "" : " · distorted"}${shared > 1 ? ` · ${shared} copies share it` : ""}</div>
        <div class="kxrow" style="flex-wrap:wrap"><button class="ghost" id="ppSoEdit" title="Open the inside (double-click the thumbnail does it too)">✎ Edit Contents</button><button class="ghost" id="ppSoXf" title="Ctrl+T - re-drawn from the contents, nothing lost">⤢ Transform</button>
          <button class="ghost" id="ppSoRep">⇄ Replace…</button><button class="ghost" id="ppSoExp">⤓ Export</button><button class="ghost" id="ppSoLay">⧉ To Layers</button><button class="ghost" id="ppSoRas">▦ Rasterize</button></div>
        <div style="color:var(--pc-dim);font-size:11px">Filters added to it stay editable (under the layer); Liquify and Puppet Warp too.</div>`;
    };
    E.ui.bindSmartProps = () => {
      const q = (id) => $(id);
      q("ppSoEdit").onclick = () => editContents(); q("ppSoXf").onclick = () => E.startTransform(); q("ppSoRep").onclick = () => replaceContents();
      q("ppSoExp").onclick = () => exportContents(); q("ppSoLay").onclick = () => toLayers(); q("ppSoRas").onclick = () => rasterize();
    };

    /* ---------------- the move tool / crop / size / rotate move the transform ---------------- */
    E.smartShift = (L, dx, dy) => { if (!isSmart(L)) return; L.smart.t = mapT(L.smart.t, [1, 0, 0, 1, dx, dy]); mapFilters(L.smart.filters, [1, 0, 0, 1, dx, dy]); render(L); };
    const baseMap = E.mapPaths;
    E.mapPaths = (m, shapes) => {
      if (baseMap) baseMap(m, shapes);
      for (const L of S.layers) if (isSmart(L)) { L.smart.t = mapT(L.smart.t, m); mapFilters(L.smart.filters, m); L._skey = null; render(L); }
    };
    E.smartEdit = (L) => editContents(L);

    /* ---------------- commands ---------------- */
    if (E.ui.addCmd) {
      const C = E.ui.addCmd, hasL = () => !!(S.w && E.layer()), sm = () => !!cur();
      C("so.convert", "Smart Objects: Convert to Smart Object", "", convert, { enabled: () => hasL() && !sm() }, ["Layer", "layer.flatten", true]);
      C("so.copy", "Smart Objects: New Smart Object via Copy", "", viaCopy, { enabled: sm }, ["Layer", "so.convert"]);
      C("so.edit", "Smart Objects: Edit Contents", "", () => editContents(), { enabled: sm }, ["Layer", "so.copy"]);
      C("so.replace", "Smart Objects: Replace Contents…", "", () => replaceContents(), { enabled: sm }, ["Layer", "so.edit"]);
      C("so.export", "Smart Objects: Export Contents…", "", exportContents, { enabled: sm }, ["Layer", "so.replace"]);
      C("so.layers", "Smart Objects: Convert to Layers", "", toLayers, { enabled: sm }, ["Layer", "so.export"]);
      C("so.raster", "Smart Objects: Rasterize", "", rasterize, { enabled: sm }, ["Layer", "so.layers"]);
      C("so.smartfilters", "Convert for Smart Filters", "", convert, { enabled: () => hasL() && !sm() }, ["Filter", "filter.last", true]);
      C("so.done", "Smart Objects: Done Editing Contents", "", () => finish(true), { enabled: () => sessions.length > 0 });
      C("so.cancel", "Smart Objects: Cancel Editing Contents", "", () => finish(false), { enabled: () => sessions.length > 0 });
    }
    E.smart = { convert, viaCopy, editContents, finish, replaceContents, exportContents, toLayers, rasterize, smartFilter, editFilter, render, sessions: () => sessions.length, addField, FIELDS, STORE };
  }

  const api = { STORE, FIELDS, addSource, addField, drawSource, runFilter, render, mapT, mapFilters, install, BLEND_MODES, blendPx, blendInto };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCSmart = api;
})(typeof window !== "undefined" ? window : globalThis);
