/* pcpsd.js — PHOTOSHOP FILES in the image editor (2.390.0), window.PCPsd.
 *
 * Tim (verbatim): "can we open psd files?" -> yes: File ▸ Open PSD… (or drop a .psd on the editor), File ▸ Open PSD from
 * Project…, File ▸ Save as PSD…. The file is read and written right here in the page by ag-psd (MIT, Agamnentzar -
 * static/vendor/ag-psd.js, loaded the first time it is needed, never from the internet); a saved PSD is kept in the
 * project's psd/ folder (lib/psdStore.js, routes/psd.js) and offered as a download.
 *
 * What comes across (both ways): pixel layers (where they sit), groups (open / closed, pass-through), visibility,
 * opacity, the 16 blend modes we draw (Photoshop's others open as Normal - said), clipping masks, layer masks (on / off)
 * and the layer styles we have (drop / inner shadow, outer / inner glow, stroke, colour overlay, a 2-colour gradient
 * overlay). Text and smart-object layers open as their pixels (named "T …" / "▣ …"); adjustment layers have no pixels in a
 * PSD we can draw, so they are left out on open and on save (said, with how many); text / fill layers and the plain
 * shapes are saved as pixels. 2.421.0: VECTOR MASKS both ways, and a PATH shape layer as Photoshop's vector shape layer
 * (its path, solid fill and stroke - with its pixels, so any reader shows it). The PSD's composite image is written too, so any viewer shows the picture as it looks here.
 * The mappings are pure (tested in Node); the reading / writing runs in the browser test with the real ag-psd.
 */
(function (root) {
  "use strict";

  const GRADS = ["linear", "radial", "angle", "reflected", "diamond"];
  const OURS = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light",
    "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
  /** Photoshop's blend name -> ours ("pass through" -> "pass-through"; one we cannot draw -> null) */
  function blendIn(name, isGroup) {
    const n = String(name || "normal").toLowerCase().trim().replace(/\s+/g, "-");
    if (n === "pass-through") return isGroup ? "pass-through" : "normal";
    return OURS.includes(n) ? n : null;
  }
  function blendOut(b, isGroup) {
    if (b === "pass-through") return isGroup ? "pass through" : "normal";
    return OURS.includes(b) ? b.replace(/-/g, " ") : "normal";
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function hexToRgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); const n = m ? parseInt(m[1], 16) : 0;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(c) {
    if (!c) return "#000000";
    let r = c.r, g = c.g, b = c.b;
    if (r == null && c.fr != null) { r = c.fr * 255; g = c.fg * 255; b = c.fb * 255; }
    const h = (v) => clamp(Math.round(+v || 0), 0, 255).toString(16).padStart(2, "0");
    return "#" + h(r) + h(g) + h(b);
  }
  const px = (v) => ({ units: "Pixels", value: Math.round(+v || 0) });
  const unit = (u, d) => (u == null ? d : typeof u === "number" ? u : Number.isFinite(+u.value) ? +u.value : d);   // 2.411.0: 0 stays 0
  const first = (x) => (Array.isArray(x) ? x[0] : x);
  const on = (e) => !!e && e.enabled !== false;

  /** our layer styles -> ag-psd's `effects` (null = none on) */
  function stylesToEffects(st) {
    const s = st || {}, fx = {};
    if (s.shadow && s.shadow.on) fx.dropShadow = [{ enabled: true, color: hexToRgb(s.shadow.color), opacity: s.shadow.opacity, angle: s.shadow.angle, distance: px(s.shadow.distance), size: px(s.shadow.size), blendMode: "multiply" }];
    if (s.innerShadow && s.innerShadow.on) fx.innerShadow = [{ enabled: true, color: hexToRgb(s.innerShadow.color), opacity: s.innerShadow.opacity, angle: s.innerShadow.angle, distance: px(s.innerShadow.distance), size: px(s.innerShadow.size), blendMode: "multiply" }];
    if (s.outerGlow && s.outerGlow.on) fx.outerGlow = { enabled: true, color: hexToRgb(s.outerGlow.color), opacity: s.outerGlow.opacity, size: px(s.outerGlow.size), blendMode: "screen" };
    if (s.innerGlow && s.innerGlow.on) fx.innerGlow = { enabled: true, color: hexToRgb(s.innerGlow.color), opacity: s.innerGlow.opacity, size: px(s.innerGlow.size), blendMode: "screen", source: "edge" };
    if (s.stroke && s.stroke.on) fx.stroke = [{ enabled: true, size: px(s.stroke.size), position: s.stroke.position === "inside" ? "inside" : /^cent/.test(s.stroke.position) ? "center" : "outside", fillType: "color", color: hexToRgb(s.stroke.color), opacity: s.stroke.opacity, blendMode: "normal" }];
    if (s.colorOverlay && s.colorOverlay.on) fx.solidFill = [{ enabled: true, color: hexToRgb(s.colorOverlay.color), opacity: s.colorOverlay.opacity, blendMode: "normal" }];
    if (s.gradientOverlay && s.gradientOverlay.on) {
      const g = s.gradientOverlay;
      fx.gradientOverlay = [{ enabled: true, opacity: g.opacity, angle: g.angle, type: "linear", blendMode: "normal",
        gradient: { name: "bitGen", type: "solid", smoothness: 1, colorStops: [{ color: hexToRgb(g.c1), location: 0, midpoint: 0.5 }, { color: hexToRgb(g.c2), location: 1, midpoint: 0.5 }],
                    opacityStops: [{ opacity: 1, location: 0, midpoint: 0.5 }, { opacity: 1, location: 1, midpoint: 0.5 }] } }];
    }
    // 2.397.0: Bevel & Emboss and Satin too (a Pattern Overlay needs the pattern's own data block - not written)
    if (s.bevel && s.bevel.on) { const b = s.bevel;
      fx.bevel = { enabled: true, style: b.style || "inner bevel", technique: "smooth", strength: b.depth == null ? 100 : b.depth, direction: b.direction === "down" ? "down" : "up",
        size: px(b.size), soften: px(b.soften), angle: b.angle == null ? 120 : b.angle, altitude: b.altitude == null ? 30 : b.altitude, useGlobalLight: false,
        highlightBlendMode: "screen", highlightColor: hexToRgb(b.hiColor || "#ffffff"), highlightOpacity: b.hiOpacity == null ? 0.75 : b.hiOpacity,
        shadowBlendMode: "multiply", shadowColor: hexToRgb(b.shColor || "#000000"), shadowOpacity: b.shOpacity == null ? 0.75 : b.shOpacity }; }
    if (s.satin && s.satin.on) { const t = s.satin;
      fx.satin = { enabled: true, color: hexToRgb(t.color), opacity: t.opacity == null ? 0.5 : t.opacity, angle: t.angle == null ? 19 : t.angle, distance: px(t.distance),
        size: px(t.size), invert: !!t.invert, antialiased: true, blendMode: t.blend || "multiply" }; }
    return Object.keys(fx).length ? fx : null;
  }
  /** 2.411.0: a gradient's colour stops -> [{c, at 0..1}] */
  const stopsIn = (g) => (g && Array.isArray(g.colorStops) ? g.colorStops.map((x) => ({ c: rgbToHex(x.color), at: clamp(+x.location || 0, 0, 1) })) : []);
  const curveIn = (c) => (c && Array.isArray(c.curve) && c.curve.length >= 2 ? c.curve.map((p) => [Math.round(+p.x || 0), Math.round(+p.y || 0)]) : null);
  const blendFx = (b, d) => { const n = String(b || "").toLowerCase().replace(/\s+/g, "-"); return n === "linear-burn" ? "multiply" : n === "linear-dodge" ? "screen" : OURS.includes(n) ? n : d; };
  /** ag-psd's `effects` -> our styles (defaults filled in from `defaults`) - those we do not have are counted */
  function effectsToStyles(fx, defaults) {
    if (!fx || fx.disabled) return { styles: null, skipped: 0 };
    const D = defaults || {}, out = {};
    const base = (k) => Object.assign({}, D[k] || {}, { on: true });
    const ds = first(fx.dropShadow), is = first(fx.innerShadow), og = first(fx.outerGlow), ig = first(fx.innerGlow), sk = first(fx.stroke), sf = first(fx.solidFill), go = first(fx.gradientOverlay);
    // 2.411.0: every enabled drop shadow (a PSD text effect stacks several): the first is `shadow`, the rest `shadows`
    const dsAll = (Array.isArray(fx.dropShadow) ? fx.dropShadow : fx.dropShadow ? [fx.dropShadow] : []).filter(on)
      .map((d) => Object.assign(base("shadow"), { color: rgbToHex(d.color), opacity: d.opacity != null ? d.opacity : 0.75, angle: d.angle != null ? d.angle : 120, distance: unit(d.distance, 8), size: unit(d.size, 10) }));
    if (dsAll.length) { out.shadow = dsAll[0]; if (dsAll.length > 1) out.shadows = dsAll.slice(1); }
    if (on(is)) out.innerShadow = Object.assign(base("innerShadow"), { color: rgbToHex(is.color), opacity: is.opacity != null ? is.opacity : 0.75, angle: is.angle != null ? is.angle : 120, distance: unit(is.distance, 5), size: unit(is.size, 6) });
    if (on(og)) out.outerGlow = Object.assign(base("outerGlow"), { color: rgbToHex(og.color), opacity: og.opacity != null ? og.opacity : 0.75, size: unit(og.size, 14) });
    if (on(ig)) out.innerGlow = Object.assign(base("innerGlow"), { color: rgbToHex(ig.color), opacity: ig.opacity != null ? ig.opacity : 0.75, size: unit(ig.size, 10) });
    if (on(sk)) {
      out.stroke = Object.assign(base("stroke"), { color: rgbToHex(sk.color), opacity: sk.opacity != null ? sk.opacity : 1, size: unit(sk.size, 3), position: sk.position === "center" ? "centre" : sk.position || "outside" });
      if (sk.fillType === "gradient" && sk.gradient && stopsIn(sk.gradient).length >= 2)                     // 2.411.0
        Object.assign(out.stroke, { fill: "gradient", stops: stopsIn(sk.gradient), angle: sk.gradient.angle != null ? sk.gradient.angle : 90, style: sk.gradient.style || "linear", reverse: !!sk.gradient.reverse });
    }
    if (on(sf)) out.colorOverlay = Object.assign(base("colorOverlay"), { color: rgbToHex(sf.color), opacity: sf.opacity != null ? sf.opacity : 1 });
    if (on(go) && go.gradient && Array.isArray(go.gradient.colorStops) && go.gradient.colorStops.length) {
      const cs = go.gradient.colorStops;
      out.gradientOverlay = Object.assign(base("gradientOverlay"), { c1: rgbToHex(cs[0].color), c2: rgbToHex(cs[cs.length - 1].color), opacity: go.opacity != null ? go.opacity : 1, angle: go.angle != null ? go.angle : 90 });
      // 2.411.0: every stop, the style, the scale, reverse, the blend mode
      if (cs.length > 2 || cs.some((x, i) => Math.abs((+x.location || 0) - (i ? 1 : 0)) > 0.01)) out.gradientOverlay.stops = stopsIn(go.gradient);
      Object.assign(out.gradientOverlay, { style: GRADS.includes(go.type) ? go.type : "linear", scale: Math.round(clamp((go.scale == null ? 1 : +go.scale) * 100, 10, 150)),
        reverse: !!go.reverse, blend: blendFx(go.blendMode, "normal") });
    }
    if (out.colorOverlay && sf) out.colorOverlay.blend = blendFx(sf.blendMode, "normal");
    const bv = first(fx.bevel), sa = first(fx.satin);                     // 2.397.0
    if (on(bv)) out.bevel = Object.assign(base("bevel"), { style: bv.style === "stroke emboss" ? "stroke emboss" : /outer|inner|pillow|^emboss/.test(bv.style || "") ? bv.style : "inner bevel",
      // 2.411.0: ag-psd gives the strength as 1.47 for 147 %
      depth: bv.strength == null ? 100 : +bv.strength <= 10 ? Math.round(+bv.strength * 100) : +bv.strength, direction: bv.direction === "down" ? "down" : "up", size: unit(bv.size, 6), soften: unit(bv.soften, 0),
      angle: bv.angle != null ? bv.angle : 120, altitude: bv.altitude != null ? bv.altitude : 30, hiColor: rgbToHex(bv.highlightColor || { r: 255, g: 255, b: 255 }),
      hiOpacity: bv.highlightOpacity != null ? bv.highlightOpacity : 0.75, shColor: rgbToHex(bv.shadowColor), shOpacity: bv.shadowOpacity != null ? bv.shadowOpacity : 0.75,
      hiBlend: blendFx(bv.highlightBlendMode, "screen"), shBlend: blendFx(bv.shadowBlendMode, "multiply") });
    // 2.411.0: the gloss contour; 2.413.0: + the PROFILE contour ("Contour" under Bevel & Emboss - the vendored ag-psd now
    // keeps both: contour = TrnS, the gloss; shapeContour = MpgS, the profile) and its range
    if (out.bevel && curveIn(bv.contour) && (bv.shapeContour || !bv.useShape)) out.bevel.gloss = curveIn(bv.contour);
    if (out.bevel && bv.useShape && curveIn(bv.shapeContour || bv.contour)) {
      out.bevel.shape = curveIn(bv.shapeContour || bv.contour);
      out.bevel.range = bv.range == null ? 50 : Math.round(Math.max(1, Math.min(100, +bv.range <= 1 ? +bv.range * 100 : +bv.range)));
    }
    if (on(sa)) out.satin = Object.assign(base("satin"), { color: rgbToHex(sa.color), opacity: sa.opacity != null ? sa.opacity : 0.5, angle: sa.angle != null ? sa.angle : 19,
      distance: unit(sa.distance, 11), size: unit(sa.size, 14), invert: !!sa.invert, blend: blendFx(sa.blendMode, "multiply") });
    const skipped = ["patternOverlay"].filter((k) => on(first(fx[k]))).length;
    return { styles: Object.keys(out).length ? out : null, skipped };
  }

  function install(E) {
    const { S, D, doc, win, kx, $, say, newCanvas, ctx } = E;
    if (!E.ui || !E.ui.addCmd) return;
    let lib = null;
    function agPsd() {
      if (win.agPsd) return Promise.resolve(win.agPsd);
      if (lib) return lib;
      lib = new Promise((ok, no) => {
        const s = doc.createElement("script");
        s.src = "/static/vendor/ag-psd.js";
        s.onload = () => (win.agPsd ? ok(win.agPsd) : no(new Error("ag-psd did not load")));
        s.onerror = () => { lib = null; no(new Error("static/vendor/ag-psd.js is missing")); };
        doc.head.appendChild(s);
      });
      return lib;
    }

    /* ---------------- open ---------------- */
    async function openBuffer(buf, name) {
      const A = await agPsd();
      say(`opening ${name}…`);
      const psd = A.readPsd(buf, { skipThumbnail: true });
      if (!psd.width || !psd.height) throw new Error("the PSD has no size");
      const notes = { adjust: 0, text: 0, smart: 0, blend: 0, fx: 0, empty: 0, vector: 0 };
      E.openDoc(psd.width, psd.height, String(name || "picture.psd").replace(/\.ps[db]$/i, ".png"), psd.canvas && !(psd.children || []).length ? (g) => g.drawImage(psd.canvas, 0, 0) : null);
      if (!(psd.children || []).length) { say(`${name}: one flat picture (no layers in the file)`); return; }
      const W = psd.width, H = psd.height;
      // 2.469.0: smart objects' EMBEDDED files (PNG / JPEG / GIF / PSD) -> their contents, so they open as smart objects (pclinked.js)
      const soSrc = new Map();
      if (root.PCLinked && root.PCSmart) for (const lf of psd.linkedFiles || []) {
        if (!lf || !lf.id || !lf.data) continue;
        try {
          const u8 = lf.data instanceof Uint8Array ? lf.data : new Uint8Array(lf.data), k = root.PCLinked.sniff(u8); let c = null;
          if (k === "psd") { const inner = A.readPsd(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.length), { skipThumbnail: true }); c = inner.canvas || null; }
          else if (k) { const bmp = await win.createImageBitmap(new win.Blob([u8])); c = newCanvas(bmp.width, bmp.height); ctx(c).drawImage(bmp, 0, 0); }
          if (c) soSrc.set(lf.id, c);
        } catch (e) { /* that one opens as pixels */ }
      }
      // 2.425.0: vector lines' outline pens (arrowheads...) kept in the file's XMP by bitGen, in vector-shape order
      let vlines = []; let vk = 0;
      try { const m = /bitgen:vlines="([^"]*)"/.exec((psd.imageResources && psd.imageResources.xmpMetadata) || ""); if (m) vlines = JSON.parse(decodeURIComponent(m[1])) || []; } catch (e) { vlines = []; }
      const build = (kids) => (kids || []).map((ch) => {
        const isG = Array.isArray(ch.children);
        if (!isG && ch.adjustment) { notes.adjust++; return null; }
        const L = E.makeLayer(String(ch.name || (isG ? "Group" : "Layer")).slice(0, 60), W, H, isG ? "group" : "pixel");
        L.visible = !ch.hidden;
        L.opacity = ch.opacity != null ? clamp(+ch.opacity, 0, 1) : 1;
        const b = blendIn(ch.blendMode, isG);
        if (b) L.blend = b; else { L.blend = "normal"; notes.blend++; }
        L.clip = !!ch.clipping;
        if (isG) { L.open = ch.opened !== false; return { L, kids: build(ch.children).filter(Boolean) }; }
        if (ch.text) { notes.text++; L.name = "T " + L.name; }
        if (ch.placedLayer) {
          const src = soSrc.get(ch.placedLayer.id), q = root.PCLinked ? root.PCLinked.quadOf(ch.placedLayer.nonAffineTransform || ch.placedLayer.transform) : null;
          if (src && q) { notes.smartKept = (notes.smartKept || 0) + 1; L.type = "smart"; L.smart = { src: root.PCSmart.addSource(src, null), w: src.width, h: src.height, t: { quad: q, warp: null }, filters: [] }; }
          else { notes.smart++; L.name = "▣ " + L.name; }
        }
        if (ch.canvas) ctx(L.canvas).drawImage(ch.canvas, ch.left || 0, ch.top || 0); else notes.empty++;
        if (ch.mask && (ch.mask.canvas || ch.mask.defaultColor != null)) {
          const m = E.newMask(ch.mask.defaultColor ? "#ffffff" : "#000000", W, H);
          if (ch.mask.canvas) ctx(m.canvas).drawImage(ch.mask.canvas, ch.mask.left || 0, ch.mask.top || 0);
          m.on = !ch.mask.disabled;
          L.mask = m;
        }
        // 2.421.0: a VECTOR mask -> L.vmask; a vector SHAPE layer (vector mask + a solid colour fill) -> a path shape layer
        const PP = root.PCPath;
        if (PP && ch.vectorMask && !ch.text) {
          const path = PP.fromPsd(ch.vectorMask, W, H);
          if (path.subs.length) {
            notes.vector++;
            const vf = ch.vectorFill, vs = ch.vectorStroke;
            if (vf && vf.type === "color") {
              const sw = vs && vs.strokeEnabled ? unit(vs.lineWidth, 0) : 0;
              L.type = "shape";
              L.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "path", path, fill: rgbToHex(vf.color), fillOn: !vs || vs.fillEnabled !== false,
                stroke: vs && vs.content && vs.content.color ? rgbToHex(vs.content.color) : "#000000", strokeW: sw, strokeOn: sw > 0 });
              const vl = vlines[vk++];
              if (vl && vl.line && vl.name === L.name) { L.shape.line = vl.line; if (vl.fillOn != null) L.shape.fillOn = vl.fillOn; }
              PP.syncShape(L.shape); D.rasterize(L);
            } else L.vmask = { path, on: !ch.vectorMask.disable, density: 1, feather: 0, linked: !ch.vectorMask.notLink, invert: !!ch.vectorMask.invert };
          }
        }
        const st = effectsToStyles(ch.effects, D.STYLE_DEFAULTS);
        if (st.styles) L.styles = st.styles;
        notes.fx += st.skipped;
        return { L, kids: [] };
      }).filter(Boolean);
      const tree = build(psd.children);
      const fix = (nodes, parent) => nodes.forEach((n) => { n.L.parent = parent; fix(n.kids, n.L.id); });
      fix(tree, null);
      S.layers = D.fromTree(tree);
      for (const L of S.layers) if (L.type === "smart" && L.smart && root.PCSmart) root.PCSmart.render(L);     // 2.469.0
      if (!S.layers.length) S.layers = [E.makeLayer("Background", W, H)];
      S.active = S.layers.length - 1;
      S.undo = []; S.redo = [];
      E.snapHistorySource(); E.refresh(); E.renderLayersPanel(); if (E.ui.history) E.ui.history();
      const said = [notes.adjust && `${notes.adjust} adjustment layer(s) left out`, notes.text && `${notes.text} text layer(s) as pixels`,
        notes.smartKept && `${notes.smartKept} smart object(s) kept as smart objects`, notes.smart && `${notes.smart} smart object(s) as pixels`, notes.vector && `${notes.vector} vector mask(s) / shape(s) kept as paths`, notes.blend && `${notes.blend} blend mode(s) we do not draw opened as Normal`,
        notes.fx && `${notes.fx} pattern overlay(s) left out (the PSD's own patterns are not read)`].filter(Boolean);
      say(`${name}: ${S.layers.length} layer(s), ${W}×${H}` + (said.length ? " · " + said.join(" · ") : ""));
      return { layers: S.layers.length, notes };
    }
    async function openFile(f) {
      try { return await openBuffer(await f.arrayBuffer(), f.name); } catch (e) { say(`${f.name}: could not open it as a PSD - ${e.message}`); return null; }
    }
    async function openFromProject(name) {
      try {
        const r = await win.fetch("/api/psd/file/" + encodeURIComponent(name));
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "not found");
        return await openBuffer(await r.arrayBuffer(), name);
      } catch (e) { say(`${name}: ${e.message}`); return null; }
    }

    /* ---------------- save ---------------- */
    async function toBuffer() {
      const A = await agPsd();
      const notes = { adjust: 0, control: 0 };
      const vls = []; let vk = 0;          // 2.425.0: vector lines, in vector-shape order
      const lfs = new Map();               // 2.469.0: smart objects' contents (embedded linked files), by source
      const node = (n) => {
        const L = n.L;
        if (L.control) { notes.control++; return null; }
        if (L.type === "adjust") { notes.adjust++; return null; }
        const o = { name: String(L.name || "Layer").slice(0, 60), hidden: !L.visible, opacity: L.opacity == null ? 1 : L.opacity, blendMode: blendOut(L.blend, L.type === "group"), clipping: !!L.clip };
        if (L.type === "group") {
          o.opened = L.open !== false; o.children = n.kids.map(node).filter(Boolean);
          if (L.artboard) { const a = L.artboard; o.artboard = { rect: { top: a.y, left: a.x, bottom: a.y + a.h, right: a.x + a.w }, presetName: String(L.name || "Artboard").slice(0, 60) }; }   // 2.447.0
          return o;
        }
        if (L.frame && n.kids.length) {                // 2.442.0: a frame = a group: the shape, its contents clipped to it
          const base = node({ L: Object.assign(Object.create(Object.getPrototypeOf(L)), L, { frame: null, clip: false }), kids: [] });
          const inner = n.kids.map(node).filter(Boolean).map((k) => Object.assign(k, { clipping: true }));
          return { name: o.name, hidden: o.hidden, opacity: o.opacity, blendMode: blendOut("pass-through", true), clipping: o.clipping, opened: L.open !== false, children: [base].concat(inner).filter(Boolean) };
        }
        o.canvas = L.canvas;
        // 2.469.0: a smart object goes out as a PLACED layer, its contents embedded (pclinked.js) - a warped one as pixels
        if (L.type === "smart" && L.smart && !L.smart.t.warp && root.PCLinked && root.PCSmart) {
          const s0 = root.PCSmart.STORE.get(L.smart.src);
          if (s0) {
            const id = root.PCLinked.guid("src:" + L.smart.src);
            o.placedLayer = { id, placed: root.PCLinked.guid("layer:" + L.id + ":" + L.smart.src), type: "raster", transform: root.PCLinked.transformOf(L.smart.t.quad), width: s0.w, height: s0.h };
            if (!lfs.has(id)) lfs.set(id, { id, name: String(L.name || "smart").replace(/[^\w .()-]+/g, "_").slice(0, 60) + ".png", canvas: s0.canvas });
          }
        }
        if (L.mask) o.mask = { canvas: L.mask.canvas, left: 0, top: 0, right: S.w, bottom: S.h, defaultColor: 255, disabled: L.mask.on === false };
        // 2.421.0: a PATH shape goes out as a vector shape layer (its pixels too); a vector mask as a vector mask
        const PP = root.PCPath, sh = L.shape;
        if (PP && L.type === "shape" && sh && sh.kind === "path" && sh.path && sh.path.subs.length) {
          o.vectorMask = PP.toPsd(sh.path);
          o.vectorFill = { type: "color", color: hexToRgb(sh.fill) };
          o.vectorStroke = { strokeEnabled: !!sh.strokeOn && sh.strokeW > 0, fillEnabled: sh.fillOn !== false, lineWidth: px(sh.strokeW || 0), lineAlignment: "center",
            lineCapType: "round", lineJoinType: "round", opacity: 1, content: { type: "color", color: hexToRgb(sh.stroke) } };
          // 2.425.0: a VECTOR LINE's outline pen as far as Photoshop's stroke goes (dashes as multiples of the width, caps, corners, position)
          const VB = root.PCBez;
          if (sh.line && VB) {
            const ln = Object.assign({}, VB.LINE_DEFAULT, sh.line), w = sh.strokeW || 1;
            Object.assign(o.vectorStroke, { lineCapType: ln.cap, lineJoinType: ln.join, miterLimit: ln.miter, lineAlignment: ln.pos === "inside" ? "inside" : ln.pos === "outside" ? "outside" : "center",
              lineDashSet: VB.dashOf(ln, w).map((v) => ({ units: "None", value: Math.round(v / w * 1000) / 1000 })), fillEnabled: sh.fillOn !== false && sh.path.subs.some((q) => q.closed) });
            vls[vk] = { name: o.name, line: ln, fillOn: sh.fillOn };
          }
          vk++;
        } else if (PP && L.vmask && L.vmask.path) o.vectorMask = Object.assign(PP.toPsd(L.vmask.path), { disable: L.vmask.on === false, notLink: L.vmask.linked === false, invert: !!L.vmask.invert });
        const fx = stylesToEffects(L.styles); if (fx) o.effects = fx;
        return o;
      };
      const psd = { width: S.w, height: S.h, children: D.toTree(S.layers).map(node).filter(Boolean), canvas: E.flatten() };
      // 2.425.0: the vector lines' outline pens (Photoshop has no arrowheads) - in the XMP, read back by bitGen
      if (vls.some(Boolean)) psd.imageResources = { xmpMetadata: `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:bitgen="https://bitgen.studio/ns/1.0/" bitgen:vlines="${encodeURIComponent(JSON.stringify(vls))}"/></rdf:RDF></x:xmpmeta>` };
      // 2.469.0: the smart objects' contents as embedded linked files (PNG)
      if (lfs.size) {
        psd.linkedFiles = [];
        for (const f of lfs.values()) { const b = await new Promise((ok) => f.canvas.toBlob(ok, "image/png")); psd.linkedFiles.push({ id: f.id, name: f.name, type: "png ", creator: "8BIM", data: new Uint8Array(await b.arrayBuffer()) }); }
      }
      let ab;
      try { ab = A.writePsd(psd, { trimImageData: true, generateThumbnail: true, noBackground: true }); notes.smartKept = lfs.size ? [...lfs.keys()].length : 0; }
      catch (e) {
        if (!lfs.size) throw e;
        // the placed layers could not be written: the smart objects go as their pixels (as before)
        const strip = (list) => (list || []).forEach((x) => { delete x.placedLayer; strip(x.children); });
        strip(psd.children); delete psd.linkedFiles; notes.smartPixels = lfs.size;
        ab = A.writePsd(psd, { trimImageData: true, generateThumbnail: true, noBackground: true });
      }
      return { buf: ab, notes };
    }
    async function saveAs(name, download) {
      if (!S.w) return say("open a picture first");
      try {
        const { buf, notes } = await toBuffer();
        const nm = String(name || S.name || "picture").replace(/\.(png|jpe?g|webp|psd|jxl)$/i, "") + ".psd";
        const r = await win.fetch("/api/psd/save?name=" + encodeURIComponent(nm), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: buf });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "the save was refused");
        if (download) {
          const a = doc.createElement("a"); a.href = win.URL.createObjectURL(new win.Blob([buf], { type: "image/vnd.adobe.photoshop" })); a.download = j.name;
          doc.body.appendChild(a); a.click(); setTimeout(() => { win.URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        }
        const said = [notes.adjust && `${notes.adjust} adjustment layer(s) left out (their look is in the composite)`, notes.control && `${notes.control} control layer(s) left out`, notes.smartKept && `${notes.smartKept} smart object content(s) embedded`, notes.smartPixels && `${notes.smartPixels} smart object(s) as pixels`].filter(Boolean);
        say(`saved ${j.name} (${Math.round(j.size / 1024)} KB) in the project's psd folder${download ? " and downloaded" : ""}` + (said.length ? " · " + said.join(" · ") : ""));
        return j;
      } catch (e) { say("Save as PSD failed: " + e.message); return null; }
    }

    /* ---------------- the UI ---------------- */
    const input = doc.createElement("input"); input.type = "file"; input.accept = ".psd,.psb,image/vnd.adobe.photoshop"; input.style.display = "none"; input.id = "pcPsdFile";
    input.onchange = () => { const f = input.files && input.files[0]; input.value = ""; if (f) openFile(f); };
    kx.appendChild(input);
    async function projectDialog() {
      let files = []; try { files = (await (await win.fetch("/api/psd/list")).json()).files || []; } catch { files = []; }
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      E.ui.dialog("Open PSD from Project", files.length
        ? `<select id="pdList" size="${Math.min(10, Math.max(3, files.length))}" style="width:100%">${files.map((f, i) => `<option value="${esc(f.name)}"${i ? "" : " selected"}>${esc(f.name)} — ${Math.round(f.size / 1024)} KB</option>`).join("")}</select>`
        : `<div style="color:var(--pc-dim)">No PSD saved in this project yet - File ▸ Save as PSD… keeps one here.</div>`,
      (d) => { const s = d.querySelector("#pdList"); if (s && s.value) openFromProject(s.value); }, { okLabel: "Open" });
    }
    function saveDialog() {
      const nm = String(S.name || "picture").replace(/\.(png|jpe?g|webp|psd|jxl)$/i, "");
      E.ui.dialog("Save as PSD", `<div class="kxrow"><span>Name</span><input type="text" id="psN" value="${String(nm).replace(/"/g, "&quot;")}" style="flex:1"><span>.psd</span></div>
        <div class="kxrow"><label><input type="checkbox" id="psDl" checked> also download it</label></div>
        <div class="kxrow" style="color:var(--pc-dim)">Kept in the project's psd folder. Layers, groups, masks, opacity, blend modes and layer styles go in; text / shape / fill layers as pixels.</div>`,
      (d) => { saveAs(d.querySelector("#psN").value.trim() || nm, d.querySelector("#psDl").checked); }, { okLabel: "💾 Save" });
    }
    const docOpen = () => !!S.w;
    E.ui.addCmd("file.openpsd", "Open PSD…", "", () => input.click(), {}, ["File", "file.open"]);
    E.ui.addCmd("file.openpsdproj", "Open PSD from Project…", "", () => projectDialog(), {}, ["File", "file.openpsd"]);
    E.ui.addCmd("file.savepsd", "Save as PSD…", "Shift+Ctrl+S", () => saveDialog(), { enabled: docOpen }, ["File", "file.save"]);
    // a .psd dropped on the editor opens as a PSD (before the picture drop sees it)
    const stage = E.stage;
    if (stage) stage.addEventListener("drop", (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && /\.ps[db]$/i.test(f.name)) { e.preventDefault(); e.stopImmediatePropagation(); openFile(f); }
    }, true);
    Object.assign(E, { psdOpenBuffer: openBuffer, psdToBuffer: toBuffer, psdSaveAs: saveAs, psdOpenFromProject: openFromProject, agPsd });
  }

  const api = { install, blendIn, blendOut, hexToRgb, rgbToHex, stylesToEffects, effectsToStyles, OURS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCPsd = api;
})(typeof window !== "undefined" ? window : globalThis);
