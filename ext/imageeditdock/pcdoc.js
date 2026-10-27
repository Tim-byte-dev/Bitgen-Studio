/* pcdoc.js — THE IMAGE EDITOR'S LAYERED DOCUMENT, PHOTOSHOP-STYLE (2.389.0), window.PCDoc.
 *
 * Tim (verbatim): "can we build our image editor to have the same functionality and look as
 * https://github.com/storytold/photocraft" - asked how: "Rebuild ours, in phases". PhotoCraft is a clean-room
 * Photoshop; this file is the part of a Photoshop document the editor did not have - written from Photoshop's
 * public behaviour, no code of theirs:
 *
 *   LAYER TYPES   pixel | adjust (a non-destructive adjustment: filters.js's Adjustments, with a mask) | group
 *                 (pass-through or its own blend) | text (editable type, re-drawn from its settings) | shape (an
 *                 editable rectangle / ellipse / line / polygon - or, 2.421.0, kind "path": any Bézier outline with
 *                 combine / subtract / intersect / exclude components, pcpath.js) | fill (solid colour or gradient)
 *   PER LAYER     visibility, opacity, FILL opacity (the pixels, not the styles), 16 blend modes, a LAYER MASK
 *                 (white shows, black hides; density + feather, never touching the pixels), 2.421.0 a VECTOR MASK
 *                 (L.vmask = {path, on, density, feather, linked, invert} - pcpath.js), CLIPPING (shown only
 *                 where the layer below it is), LOCKS (transparency, pixels, position, all), a colour label and
 *                 LAYER STYLES: drop shadow, inner shadow, outer glow, inner glow, stroke (outside / inside /
 *                 centre), colour overlay, gradient overlay
 *   THE TREE      S.layers stays a flat bottom-to-top array (everything that walked it still works); a layer in a
 *                 group carries `parent` = the group's id and sits directly BELOW its group, contiguous. toTree /
 *                 fromTree convert; every move / group / ungroup goes through the tree so that never breaks. 2.442.0: a
 *                 FRAME (a closed shape with L.frame - pcframes.js) holds layers the same way (CorelDRAW's PowerClip).
 *   render(doc, env)  the composite: a sibling list bottom-up, each layer with the CLIP stack above it, an adjustment
 *                 layer re-colouring what is below it (inside its group), a pass-through group drawing straight into
 *                 its parent, any other group composited as one picture. `env` gives the canvases (the page's live
 *                 stroke preview included) - so the same function draws the screen, the AI's crop and the save.
 *
 * The tree helpers and the snapshots are pure (tested in Node); the compositing needs a 2D canvas (the browser test).
 */
(function (root) {
  "use strict";

  const ADJ_KINDS = [
    ["brightness", "Brightness / Contrast", "☀"], ["levels", "Levels", "▥"], ["curves", "Curves", "∿"],
    ["exposure", "Exposure", "±"], ["vibrance", "Vibrance", "▽"], ["huesat", "Hue / Saturation", "◑"],
    ["colorbalance", "Color Balance", "⚖"], ["bw", "Black & White", "◧"], ["photofilter", "Photo Filter", "◎"],
    ["channelmixer", "Channel Mixer", "⊕"], ["gradientmap", "Gradient Map", "▤"], ["invert", "Invert", "◐"],
    ["posterize", "Posterize", "▦"], ["threshold", "Threshold", "◩"],
  ];
  // 2.397.0: Photoshop's list and order (+ Bevel & Emboss, Satin, Pattern Overlay - drawn by pcstyles.js)
  const STYLE_KINDS = [
    ["bevel", "Bevel & Emboss"], ["stroke", "Stroke"], ["innerShadow", "Inner Shadow"], ["innerGlow", "Inner Glow"], ["satin", "Satin"],
    ["colorOverlay", "Color Overlay"], ["gradientOverlay", "Gradient Overlay"], ["patternOverlay", "Pattern Overlay"], ["outerGlow", "Outer Glow"], ["shadow", "Drop Shadow"],
  ];
  const STYLE_DEFAULTS = {
    shadow: { on: false, color: "#000000", opacity: 0.75, angle: 120, distance: 8, size: 10 },
    innerShadow: { on: false, color: "#000000", opacity: 0.75, angle: 120, distance: 5, size: 6 },
    outerGlow: { on: false, color: "#ffffbe", opacity: 0.75, size: 14 },
    innerGlow: { on: false, color: "#ffffbe", opacity: 0.75, size: 10 },
    stroke: { on: false, color: "#ff0000", opacity: 1, size: 3, position: "outside" },
    colorOverlay: { on: false, color: "#ff0000", opacity: 1, blend: "normal" },
    gradientOverlay: { on: false, c1: "#000000", c2: "#ffffff", opacity: 1, angle: 90, style: "linear", scale: 100, reverse: false, blend: "normal" },
    // 2.397.0
    bevel: { on: false, style: "inner bevel", depth: 100, direction: "up", size: 6, soften: 0, angle: 120, altitude: 30, hiColor: "#ffffff", hiOpacity: 0.75, shColor: "#000000", shOpacity: 0.75 },
    satin: { on: false, color: "#000000", opacity: 0.5, angle: 19, distance: 11, size: 14, invert: false, blend: "multiply" },
    patternOverlay: { on: false, pattern: "checker", scale: 100, c1: "#000000", c2: "#ffffff", opacity: 1, blend: "normal" },
  };
  const LABELS = ["none", "red", "orange", "yellow", "green", "blue", "violet", "gray"];
  const LABEL_HEX = { red: "#d0473f", orange: "#e08a2c", yellow: "#d8c13a", green: "#4aa25a", blue: "#3f7fd0", violet: "#8f5bd0", gray: "#8a8a8a" };
  const TEXT_DEFAULT = { str: "Text", font: "Arial", size: 48, weight: 400, italic: false, color: "#000000", align: "left", leading: 1.2, tracking: 0, x: 40, y: 40 };
  const SHAPE_DEFAULT = { kind: "rect", x: 0, y: 0, w: 100, h: 100, radius: 0, sides: 5, fill: "#3d7bd9", fillOn: true, stroke: "#000000", strokeW: 0, strokeOn: false, dash: false };

  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

  /* =============================== the tree (pure) =============================== */
  /** 2.442.0: a FRAME (CorelDRAW's PowerClip - pcframes.js) holds layers like a group: a closed shape with L.frame */
  const isFrameL = (L) => !!(L && L.frame && L.type === "shape");
  /** flat bottom-to-top layers -> [{L, kids}] bottom-to-top (a layer whose parent is gone lands at the root) */
  function toTree(layers) {
    const byId = new Map(), root = [];
    for (const L of layers) byId.set(L.id, { L, kids: [] });
    for (const L of layers) {
      const n = byId.get(L.id), p = L.parent != null ? byId.get(L.parent) : null;
      if (p && (p.L.type === "group" || isFrameL(p.L)) && p !== n) p.kids.push(n); else { if (L.parent != null && !p) L.parent = null; root.push(n); }
    }
    return root;
  }
  /** the tree back to the flat array: a group's (a frame's) children (bottom-up) right BELOW it */
  function fromTree(nodes, out) {
    out = out || [];
    for (const n of nodes) { if (n.kids.length) fromTree(n.kids, out); out.push(n.L); }
    return out;
  }
  const normalize = (layers) => fromTree(toTree(layers));
  function findNode(nodes, id, parent) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].L.id === id) return { list: nodes, i, parent: parent || null };
      const r = findNode(nodes[i].kids, id, nodes[i]); if (r) return r;
    }
    return null;
  }
  function descendants(layers, id) {
    const r = findNode(toTree(layers), id); const out = [];
    const walk = (n) => { for (const k of n.kids) { out.push(k.L); walk(k); } };
    if (r) walk(r.list[r.i]);
    return out;
  }
  function depth(layers, L) {
    let d = 0, p = L.parent; const byId = new Map(layers.map((x) => [x.id, x]));
    while (p != null && byId.has(p) && d < 50) { d++; p = byId.get(p).parent; }
    return d;
  }
  /** one step up (dir > 0) / down (dir < 0) among its siblings; past the end of a group it leaves the group */
  function move(layers, id, dir) {
    const T = toTree(layers), r = findNode(T, id); if (!r) return layers;
    const { list, i, parent } = r, node = list[i];
    if (dir > 0 && i < list.length - 1) { list.splice(i, 1); list.splice(i + 1, 0, node); }
    else if (dir < 0 && i > 0) { list.splice(i, 1); list.splice(i - 1, 0, node); }
    else if (parent) {                                   // out of the group, just above / below it
      const pr = findNode(T, parent.L.id);
      list.splice(i, 1);
      pr.list.splice(dir > 0 ? pr.i + 1 : pr.i, 0, node);
      node.L.parent = parent.L.parent != null ? parent.L.parent : null;
    } else return layers;
    return fromTree(T);
  }
  /** to the top (dir > 0) / bottom of its sibling list */
  function moveEnd(layers, id, dir) {
    const T = toTree(layers), r = findNode(T, id); if (!r) return layers;
    const node = r.list.splice(r.i, 1)[0];
    if (dir > 0) r.list.push(node); else r.list.unshift(node);
    return fromTree(T);
  }
  /** `L` into the list: above the layer `refId` (or as the top child of that group when `into`) */
  function insert(layers, L, refId, into) {
    const T = toTree(layers), r = refId != null ? findNode(T, refId) : null, node = { L, kids: [] };
    if (!r) { L.parent = null; T.push(node); return fromTree(T); }
    const ref = r.list[r.i];
    if (into && (ref.L.type === "group" || isFrameL(ref.L))) { L.parent = ref.L.id; ref.kids.push(node); }
    else { L.parent = r.parent ? r.parent.L.id : null; r.list.splice(r.i + 1, 0, node); }
    return fromTree(T);
  }
  /** put the layers `ids` (siblings, or anything - they are lifted out) into the new group `G`, where the top one was */
  function group(layers, ids, G) {
    const T = toTree(layers), set = new Set(ids);
    let at = null, nodes = [];
    const lift = (list, parent) => {
      for (let i = 0; i < list.length; i++) {
        if (set.has(list[i].L.id)) {
          const n = list.splice(i, 1)[0]; nodes.push(n);
          at = { list, i, parent }; i--;
          continue;
        }
        lift(list[i].kids, list[i]);
      }
    };
    lift(T, null);
    if (!at) return layers;
    const g = { L: G, kids: nodes };
    G.parent = at.parent ? at.parent.L.id : null;
    for (const n of nodes) n.L.parent = G.id;
    at.list.splice(Math.min(at.i, at.list.length), 0, g);
    return fromTree(T);
  }
  function ungroup(layers, gid) {
    const T = toTree(layers), r = findNode(T, gid); if (!r) return layers;
    const g = r.list[r.i]; if (g.L.type !== "group") return layers;
    for (const k of g.kids) k.L.parent = g.L.parent != null ? g.L.parent : null;
    r.list.splice(r.i, 1, ...g.kids);
    return fromTree(T);
  }
  /** a layer and everything in it removed */
  function remove(layers, id) {
    const drop = new Set([id, ...descendants(layers, id).map((L) => L.id)]);
    return layers.filter((L) => !drop.has(L.id));
  }
  /** shown on screen = it and every group it is in are visible */
  function shown(layers, L) {
    const byId = new Map(layers.map((x) => [x.id, x]));
    let x = L, n = 0;
    while (x && n++ < 60) { if (!x.visible) return false; x = x.parent != null ? byId.get(x.parent) : null; }
    return true;
  }

  /* ============================ snapshots (undo) - pure ============================ */
  const STRUCT = ["name", "visible", "opacity", "fillOpacity", "blend", "type", "parent", "clip", "label", "open"];
  const DEEP = ["control", "locks", "styles", "adj", "text", "shape", "fill", "vmask", "smart", "frame", "artboard", "dimg", "dimPart", "l3d", "sketch", "bscene"];   // 2.542.0: + a Blender layer's scene (pcblendlayer.js)   // 2.462.0: + a sketch layer's sketch (pcsketch.js)   // 2.460.0: + a 3D layer (pc3d.js)   // 2.457.0: + a dimension group and its parts (pcdimgroup.js)   // 2.442.0: + a frame (pcframes.js)   // 2.422.0: + a smart object's settings (pcsmart.js)   // 2.421.0: + the vector mask (pcpath.js)
  function snapLayer(L) {
    const s = { L };
    for (const k of STRUCT) s[k] = L[k];
    for (const k of DEEP) s[k] = clone(L[k]);
    s.mask = L.mask || null;
    s.fmask = L.fmask || null;                       // 2.422.0: a smart object's filter mask (kept by reference, like the mask)
    s.maskProps = L.mask ? { on: L.mask.on, density: L.mask.density, feather: L.mask.feather, linked: L.mask.linked } : null;
    return s;
  }
  function putLayer(s) {
    const L = s.L;
    for (const k of STRUCT) L[k] = s[k];
    for (const k of DEEP) L[k] = clone(s[k]);
    L.mask = s.mask || null;
    L.fmask = s.fmask || null;
    if (L.mask && s.maskProps) Object.assign(L.mask, s.maskProps);
    return L;
  }

  /* ============================ text / shape / fill drawing ============================ */
  const FONT_STACK = { Arial: "Arial, Helvetica, sans-serif", Helvetica: "Helvetica, Arial, sans-serif", Georgia: "Georgia, serif",
    "Times New Roman": "'Times New Roman', Times, serif", Verdana: "Verdana, sans-serif", "Courier New": "'Courier New', monospace",
    Impact: "Impact, 'Arial Black', sans-serif", "Trebuchet MS": "'Trebuchet MS', sans-serif", "Segoe UI": "'Segoe UI', system-ui, sans-serif",
    "Comic Sans MS": "'Comic Sans MS', cursive", serif: "serif", "sans-serif": "sans-serif", monospace: "monospace" };
  const fontCss = (t) => `${t.italic ? "italic " : ""}${t.weight || 400} ${Math.max(1, t.size)}px ${FONT_STACK[t.font] || `'${String(t.font || "Arial").replace(/'/g, "")}', sans-serif`}`;
  /** 2.604.0: a text's own 2 x 2 matrix [a, b, c, d] (canvas order) round its centre - turned (t.rot, degrees) then the
   *  rest of a transform type keeps as type: t.xm (a skew / a stretch / a flip, the Move tool's side handles) - or null */
  function textMat(t) {
    const a = +(t && t.rot) || 0, X = t && Array.isArray(t.xm) && t.xm.length === 4 && t.xm.every((v) => isFinite(+v)) ? t.xm.map(Number) : null;
    if (!a && !X) return null;
    const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), R = [c, s, -s, c];
    if (!X) return R;
    return [R[0] * X[0] + R[2] * X[1], R[1] * X[0] + R[3] * X[1], R[0] * X[2] + R[2] * X[3], R[1] * X[2] + R[3] * X[3]];
  }
  /** 2.452.0: a TURNED text (t.rot, degrees - the Move tool's rotate handles) - the box round its turned corners
   *  (2.604.0: and skewed / stretched - textMat) */
  function textBox(t, g) {
    const b = textBox0(t, g), M = textMat(t);
    if (!M) return b;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => [cx + M[0] * (x - cx) + M[2] * (y - cy), cy + M[1] * (x - cx) + M[3] * (y - cy)]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
    return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
  }
  /** a text layer's box in picture px, not turned (approximate without a canvas: 0.55 em per character) */
  function textBox0(t, g) {
    if (root.PCRuns && root.PCRuns.owns(t)) return root.PCRuns.box(t, g);   // 2.449.0: per-letter settings (pcruns.js)
    if (root.PCText && root.PCText.wants(t)) return root.PCText.box(t, g);   // 2.397.0: path / warp / vertical / 3D (pctext.js)
    if (root.PCType && root.PCType.owns(t)) return root.PCType.box(t, g);    // 2.426.0: scales, indents, paragraph text (pctype.js)
    const lines = String(t.str || "").split("\n"), lh = t.size * (t.leading || 1.2);
    let w = 0;
    // 2.602.0 (Tim: "make the select tool fit the text that is typed dynamically"): measured in the TEXT'S font and
    // tracking - the layer's context still had the canvas default (10px sans-serif), so every box (the typing frame, the
    // Move tool's handles, Align, a click's hit test) was far too narrow for the letters
    if (g && g.measureText) {
      g.save(); g.font = fontCss(t);
      if ("letterSpacing" in g) g.letterSpacing = ((t.tracking || 0) / 1000 * t.size).toFixed(2) + "px";
      for (const ln of lines) w = Math.max(w, g.measureText(ln).width);
      g.restore();
    } else for (const ln of lines) w = Math.max(w, ln.length * t.size * (0.55 + (t.tracking || 0) / 1000));
    const x = t.align === "center" ? t.x - w / 2 : t.align === "right" ? t.x - w : t.x;
    return { x, y: t.y, w: Math.max(1, w), h: Math.max(lh, lines.length * lh) };
  }
  function drawText(g, t) {
    g.save();
    g.font = fontCss(t); g.fillStyle = t.color || "#000"; g.textBaseline = "top"; g.textAlign = t.align || "left";
    if ("letterSpacing" in g) g.letterSpacing = ((t.tracking || 0) / 1000 * t.size).toFixed(2) + "px";
    const lh = t.size * (t.leading || 1.2);
    String(t.str || "").split("\n").forEach((ln, i) => g.fillText(ln, t.x, t.y + i * lh));
    g.restore();
  }
  function shapePath(g, s) {
    if (s.kind === "path") { if (root.PCPath) root.PCPath.traceAll(g, s.path); else g.beginPath(); return; }   // 2.421.0: a pen-drawn / edited shape
    g.beginPath();
    const x = Math.min(s.x, s.x + s.w), y = Math.min(s.y, s.y + s.h), w = Math.abs(s.w), h = Math.abs(s.h);
    if (s.kind === "ellipse") g.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
    else if (s.kind === "line") { g.moveTo(s.x, s.y); g.lineTo(s.x + s.w, s.y + s.h); }
    else if (s.kind === "polygon" || s.kind === "triangle") {
      const n = s.kind === "triangle" ? 3 : Math.max(3, Math.min(64, s.sides || 5));
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; const px = x + w / 2 + Math.cos(a) * w / 2, py = y + h / 2 + Math.sin(a) * h / 2; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.closePath();
    } else if (Array.isArray(s.radii) && s.radii.some((v) => v > 0) && typeof g.roundRect === "function") g.roundRect(x, y, w, h, s.radii.map((v) => Math.max(0, Math.min(+v || 0, w / 2, h / 2))));   // 2.439.0: each corner its own
    else if (s.radius > 0 && typeof g.roundRect === "function") g.roundRect(x, y, w, h, Math.min(s.radius, w / 2, h / 2));
    else g.rect(x, y, w, h);
  }
  function drawShape(g, s) {
    if (s.kind === "path") { if (root.PCPath) { g.save(); root.PCPath.drawPathShape(g, s); g.restore(); } return; }
    g.save(); shapePath(g, s);
    if (s.kind !== "line" && s.fillOn !== false) { g.fillStyle = s.fill || "#000"; g.fill(); }
    const sw = s.kind === "line" ? Math.max(1, s.strokeW || 4) : (s.strokeOn ? s.strokeW || 0 : 0);
    if (sw > 0) {
      g.lineWidth = sw; g.strokeStyle = s.kind === "line" ? (s.strokeOn ? s.stroke : s.fill) || "#000" : s.stroke || "#000";
      g.lineJoin = "round"; g.lineCap = "round";
      if (s.dash && g.setLineDash) g.setLineDash([sw * 3, sw * 2]);
      g.stroke();
    }
    g.restore();
  }
  function drawFill(g, f, W, H) {
    if (f && f.kind === "pattern") {                      // 2.437.0: a pattern from the library (pcpattern.js), tiled at its scale
      const P = root.PCPattern, t = P && P.scaled ? P.scaled(f.pattern, f.scale) : null;
      if (t) { const pat = g.createPattern(t, "repeat"); if (pat.setTransform && (f.ox || f.oy) && root.DOMMatrix) pat.setTransform(new root.DOMMatrix().translate(f.ox || 0, f.oy || 0)); g.fillStyle = pat; }
      else g.fillStyle = "rgba(128,128,128,0.35)";      // still loading (the layer is drawn again when it is in)
      g.fillRect(0, 0, W, H); return;
    }
    if (!f || f.kind !== "gradient") { g.fillStyle = (f && f.color) || "#808080"; g.fillRect(0, 0, W, H); return; }
    const a = ((f.angle == null ? 90 : f.angle) * Math.PI) / 180, cx = W / 2, cy = H / 2;
    const r = Math.abs(W * Math.cos(a)) / 2 + Math.abs(H * Math.sin(a)) / 2;
    const grd = f.style === "radial" ? g.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) / 2)
      : g.createLinearGradient(cx - Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * r, cy - Math.sin(a) * r);
    if (Array.isArray(f.stops) && f.stops.length > 1) gradStopsInto(grd, f.stops);   // 2.434.0: the Gradient Editor's stops
    else { grd.addColorStop(0, f.c1 || "#000"); grd.addColorStop(1, f.c2 || "#fff"); }
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
  }
  /** [{t, c "#rrggbb", a}] onto a canvas gradient (2.434.0) */
  function gradStopsInto(grd, stops) {
    for (const s of stops) {
      const n = parseInt(String(s.c || "#000000").slice(1), 16) || 0, a = s.a == null ? 1 : Math.max(0, Math.min(1, +s.a));
      grd.addColorStop(Math.max(0, Math.min(1, +s.t || 0)), `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`);
    }
  }
  /** a text / shape / fill layer's pixels redrawn from its settings into L.canvas */
  /** a layer drawn from its settings (re-drawn after an undo / a size change): text, shape, fill, smart object */
  const isLive = (L) => !!L && (L.type === "text" || L.type === "shape" || L.type === "fill" || L.type === "smart" || L.type === "sketch");   // 2.462.0: + a sketch (pcsketch.js)
  function rasterize(L) {
    const c = L.canvas, g = c && c.getContext ? c.getContext("2d") : null; if (!g) return;
    if (L.type === "smart") { if (L.smart && root.PCSmart) root.PCSmart.render(L); return; }   // 2.422.0: from its source (cached)
    g.clearRect(0, 0, c.width, c.height);
    if (L.type === "text" && L.text) {
      if (root.PCRuns && root.PCRuns.owns(L.text)) root.PCRuns.draw(g, L.text);   // 2.449.0: per-letter settings (pcruns.js)
      else if (root.PCText && root.PCText.wants(L.text)) root.PCText.draw(g, L.text);
      // 2.411.0: a TEXT EFFECT PRESET (static/textfx.js) - live: a quick picture now, the sharp one when typing pauses
      else if (L.text.fx && root.H3TextFx && root.H3TextFx.drawText(g, L.text, "pc:" + L.id, () => {
        rasterize(L); try { root.dispatchEvent(new root.CustomEvent("h3textfx", { detail: { id: L.id } })); } catch (e) { /* jsdom */ } })) { /* drawn */ }
      else if (root.PCType && root.PCType.owns(L.text)) root.PCType.draw(g, L.text);   // 2.426.0: Character / Paragraph panels, paragraph text (pctype.js)
      else drawText(g, L.text);
      // 2.452.0: a turned text (the Move tool's rotate handles): drawn straight, then turned round its own centre
      // 2.604.0: + skewed / stretched / flipped (t.xm - the side handles) - textMat, still type
      const M = textMat(L.text);
      if (M) {
        const b = textBox0(L.text, g), cx = b.x + b.w / 2, cy = b.y + b.h / 2, d = c.ownerDocument;
        const t = d ? d.createElement("canvas") : new root.OffscreenCanvas(c.width, c.height); t.width = c.width; t.height = c.height;
        t.getContext("2d").drawImage(c, 0, 0);
        g.save(); g.clearRect(0, 0, c.width, c.height); g.translate(cx, cy); g.transform(M[0], M[1], M[2], M[3], 0, 0); g.translate(-cx, -cy); g.imageSmoothingQuality = "high"; g.drawImage(t, 0, 0); g.restore();
      }
    }
    else if (L.type === "shape" && L.shape) { if (L.shape.kind === "path" && root.PCPath) root.PCPath.fitShape(L.shape); drawShape(g, L.shape); }
    else if (L.type === "fill") drawFill(g, L.fill, c.width, c.height);
    else if (L.type === "sketch" && L.sketch && root.PCSketch) root.PCSketch.draw(g, L.sketch);   // 2.462.0: a sketch layer
    L.ver = (L.ver || 0) + 1;
  }

  /* ================================ the compositor ================================ */
  const copyOf = (env, src, W, H) => { const c = env.newCanvas(W, H); c.getContext("2d").drawImage(src, 0, 0); return c; };
  /** the mask as an ALPHA canvas (white = shown), density + feather applied; cached per mask version */
  function maskAlpha(L, env, W, H) {
    const M = L.mask; if (!M || M.on === false || !M.canvas) return null;
    const src = (env.maskSrc && env.maskSrc(L)) || M.canvas;
    const key = `${M.ver || 0}|${M.density == null ? 1 : M.density}|${M.feather || 0}|${W}x${H}`;
    if (src === M.canvas && M._a && M._key === key) return M._a;
    const t = env.newCanvas(W, H), tg = t.getContext("2d");
    tg.drawImage(src, 0, 0);
    const d = tg.getImageData(0, 0, W, H), D = M.density == null ? 1 : M.density;
    for (let i = 0; i < d.data.length; i += 4) {
      const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
      d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = Math.round(255 - (255 - lum) * D);
    }
    tg.putImageData(d, 0, 0);
    let out = t;
    if (M.feather > 0) { out = env.newCanvas(W, H); const og = out.getContext("2d"); og.filter = `blur(${M.feather}px)`; og.drawImage(t, 0, 0); og.filter = "none"; }
    if (src === M.canvas) { M._a = out; M._key = key; }
    return out;
  }
  function masked(env, L, content, W, H) {
    const m = maskAlpha(L, env, W, H);
    // 2.421.0: + the VECTOR mask (a path - pcpath.js), on top of the pixel mask
    const v = L.vmask && L.vmask.on !== false && root.PCPath ? root.PCPath.vmaskAlpha(L, W, H, env.newCanvas) : null;
    if (!m && !v) return content;
    const c = copyOf(env, content, W, H), g = c.getContext("2d");
    g.globalCompositeOperation = "destination-in"; if (m) g.drawImage(m, 0, 0); if (v) g.drawImage(v, 0, 0); g.globalCompositeOperation = "source-over";
    return c;
  }
  // 2.411.0: styles.shadows = MORE drop shadows (a PSD text effect stacks 5 - 8 of them)
  const hasStyles = (L) => !!(L.styles && Object.entries(L.styles).some(([k, s]) => (k === "shadows" ? Array.isArray(s) && s.some((x) => x && x.on) : s && s.on)));
  /** content tinted one colour where it is (its silhouette) */
  function silhouette(env, content, color, W, H) {
    const c = copyOf(env, content, W, H), g = c.getContext("2d");
    g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
    return c;
  }
  function inverse(env, content, color, W, H) {
    const c = env.newCanvas(W, H), g = c.getContext("2d");
    g.fillStyle = color; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "destination-out"; g.drawImage(content, 0, 0); g.globalCompositeOperation = "source-over";
    return c;
  }
  /** grow a silhouette by r px (round): copies around a circle */
  function dilate(env, sil, r, W, H) {
    const c = env.newCanvas(W, H), g = c.getContext("2d");
    g.drawImage(sil, 0, 0);
    if (r <= 0) return c;
    const rings = r > 4 ? [r, r * 0.66, r * 0.33] : [r];
    for (const rr of rings) { const n = Math.max(8, Math.min(48, Math.round(rr * 4))); for (let k = 0; k < n; k++) { const a = k * 2 * Math.PI / n; g.drawImage(sil, Math.cos(a) * rr, Math.sin(a) * rr); } }
    return c;
  }
  /** the layer's look: its content at FILL opacity with the overlays, and the styles around / inside it */
  function styled(env, L, content, W, H) {
    const fo = L.fillOpacity == null ? 1 : L.fillOpacity;
    if (!hasStyles(L) && fo >= 1) return content;
    const st = L.styles || {}, out = env.newCanvas(W, H), g = out.getContext("2d");
    const blurOf = (px) => (px > 0 ? `blur(${(px / 2).toFixed(1)}px)` : "none");
    const shs = (Array.isArray(st.shadows) ? st.shadows.slice().reverse() : []).concat(st.shadow ? [st.shadow] : []);
    for (const s1 of shs) {
      if (!s1 || !s1.on) continue;
      const a = (s1.angle || 0) * Math.PI / 180, dx = -Math.cos(a) * (s1.distance || 0), dy = Math.sin(a) * (s1.distance || 0);
      g.save(); g.globalAlpha = s1.opacity == null ? 0.75 : s1.opacity; g.filter = blurOf(s1.size); g.drawImage(silhouette(env, content, s1.color || "#000", W, H), dx, dy); g.restore();
    }
    const og = st.outerGlow;
    if (og && og.on) {
      const sil = silhouette(env, content, og.color || "#ffffbe", W, H);
      g.save(); g.globalAlpha = og.opacity == null ? 0.75 : og.opacity; g.filter = blurOf(og.size); g.globalCompositeOperation = "screen";
      g.drawImage(sil, 0, 0); g.drawImage(sil, 0, 0); g.restore();
    }
    // the content (fill opacity) with its overlays - 2.397.0: pcstyles.js (pattern / gradient / colour, blend modes)
    let body = content;
    const co = st.colorOverlay, go = st.gradientOverlay, PS = root.PCStyles;
    if (PS) body = PS.overlays(env, st, content, W, H);
    else if ((co && co.on) || (go && go.on)) {
      body = copyOf(env, content, W, H); const bg = body.getContext("2d");
      bg.globalCompositeOperation = "source-atop";
      if (go && go.on) {
        const a = (go.angle == null ? 90 : go.angle) * Math.PI / 180, r = Math.hypot(W, H) / 2;
        const grd = bg.createLinearGradient(W / 2 - Math.cos(a) * r, H / 2 + Math.sin(a) * r, W / 2 + Math.cos(a) * r, H / 2 - Math.sin(a) * r);
        grd.addColorStop(0, go.c1 || "#000"); grd.addColorStop(1, go.c2 || "#fff");
        bg.globalAlpha = go.opacity == null ? 1 : go.opacity; bg.fillStyle = grd; bg.fillRect(0, 0, W, H);
      }
      if (co && co.on) { bg.globalAlpha = co.opacity == null ? 1 : co.opacity; bg.fillStyle = co.color || "#f00"; bg.fillRect(0, 0, W, H); }
      bg.globalAlpha = 1; bg.globalCompositeOperation = "source-over";
    }
    g.save(); g.globalAlpha = fo; g.drawImage(body, 0, 0); g.restore();
    const sa = st.satin;                                                     // 2.397.0
    if (PS && sa && sa.on) { g.save(); g.globalAlpha = sa.opacity == null ? 0.5 : sa.opacity; g.globalCompositeOperation = PS.compOf(sa.blend || "multiply"); g.drawImage(PS.satinCanvas(env, content, sa, W, H), 0, 0); g.restore(); }
    for (const [k, off] of [["innerGlow", false], ["innerShadow", true]]) {
      const s = st[k]; if (!s || !s.on) continue;
      const a = (s.angle || 0) * Math.PI / 180, d = off ? (s.distance || 0) : 0;
      const t = env.newCanvas(W, H), tg = t.getContext("2d");
      tg.filter = blurOf(s.size); tg.drawImage(inverse(env, content, s.color || "#000", W, H), -Math.cos(a) * d, Math.sin(a) * d); tg.filter = "none";
      tg.globalCompositeOperation = "destination-in"; tg.drawImage(content, 0, 0);
      g.save(); g.globalAlpha = s.opacity == null ? 0.75 : s.opacity; if (!off) g.globalCompositeOperation = "screen"; g.drawImage(t, 0, 0); g.restore();
    }
    const bv = st.bevel;                                                     // 2.397.0: Bevel & Emboss
    if (PS && bv && bv.on && bv.style !== "stroke emboss") PS.drawBevel(env, L, content, bv, W, H, g);
    const sk = st.stroke;
    if (sk && sk.on && sk.size > 0) {
      const col = sk.color || "#f00", pos = sk.position || "outside";
      const ring = env.newCanvas(W, H), rg = ring.getContext("2d");
      const outR = pos === "outside" ? sk.size : pos === "center" ? sk.size / 2 : 0, inR = pos === "inside" ? sk.size : pos === "center" ? sk.size / 2 : 0;
      if (outR > 0) {
        // 2.411.0: env.dilate - the text effects draw the stroke from the letters' own outlines (exact, two draws)
        const dd = env.dilate ? env.dilate(content, outR, col) : null;
        rg.drawImage(dd || dilate(env, silhouette(env, content, col, W, H), outR, W, H), 0, 0);
        rg.globalCompositeOperation = "destination-out"; rg.drawImage(content, 0, 0); rg.globalCompositeOperation = "source-over";
      }
      if (inR > 0) {
        const t = silhouette(env, content, col, W, H), tg = t.getContext("2d");
        tg.globalCompositeOperation = "destination-in"; tg.drawImage(dilate(env, inverse(env, content, "#000", W, H), inR, W, H), 0, 0);
        rg.drawImage(t, 0, 0);
      }
      if (sk.fill === "gradient" && PS && PS.gradientFill) {                // 2.411.0: a gradient stroke
        rg.globalCompositeOperation = "source-in";
        rg.drawImage(PS.gradientFill(env, { stops: sk.stops, c1: sk.c1, c2: sk.c2, angle: sk.angle == null ? 90 : sk.angle, style: sk.style || "linear", scale: sk.scale || 100, reverse: !!sk.reverse },
          W, H, PS.alphaBox(content, W, H)), 0, 0);
        rg.globalCompositeOperation = "source-over";
      }
      g.save(); g.globalAlpha = sk.opacity == null ? 1 : sk.opacity; g.drawImage(ring, 0, 0); g.restore();
      // 2.411.0: STROKE EMBOSS - the bevel lights the stroke's ring (the letter and its stroke as one raised shape)
      if (PS && bv && bv.on && bv.style === "stroke emboss") {
        const un = copyOf(env, content, W, H); un.getContext("2d").drawImage(ring, 0, 0);
        const b = PS.bevelCanvases(env, L, un, Object.assign({}, bv, { style: "inner bevel" }), W, H);
        const clipTo = (c) => { const t = copyOf(env, c, W, H), tg = t.getContext("2d"); tg.globalCompositeOperation = "destination-in"; tg.drawImage(ring, 0, 0); return t; };
        PS.drawLit(g, clipTo(b.hi), clipTo(b.sh), bv);
      }
    }
    return out;
  }
  /** an adjustment layer re-colours `target` in place: through its mask, at its opacity */
  function applyAdjust(env, L, target, W, H) {
    if (!L.adj || !env.adjust) return;
    const g = target.getContext("2d"), d = g.getImageData(0, 0, W, H);
    const out = env.adjust(L.adj.kind, d.data, W, H, L.adj.params || {});
    if (!out) return;
    const m = maskAlpha(L, env, W, H), op = L.opacity == null ? 1 : L.opacity;
    if (!m && op >= 1) { for (let i = 0; i < out.length; i += 4) { d.data[i] = out[i]; d.data[i + 1] = out[i + 1]; d.data[i + 2] = out[i + 2]; } g.putImageData(d, 0, 0); return; }
    for (let i = 3; i < out.length; i += 4) out[i] = 255;           // the mix weight is the mask x opacity, never the alpha
    const t = env.newCanvas(W, H), tg = t.getContext("2d"), id = tg.createImageData(W, H);
    id.data.set(out); tg.putImageData(id, 0, 0);
    if (m) { tg.globalCompositeOperation = "destination-in"; tg.drawImage(m, 0, 0); }
    g.save(); g.globalAlpha = op; g.globalCompositeOperation = "source-atop"; g.drawImage(t, 0, 0); g.restore();
  }
  const isShown = (env, L) => L.visible !== false && !(env.skipControl && L.control);
  function contentOf(env, node, W, H) {
    const L = node.L;
    if (L.type === "group") {
      if (L.artboard && root.PCArtboards) return root.PCArtboards.content(env, node, W, H, renderList);   // 2.447.0: an artboard
      const c = env.newCanvas(W, H); renderList(env, node.kids, c, W, H); return c;
    }
    if (root.PCFrames && root.PCFrames.holds(node)) return root.PCFrames.content(env, node, W, H, renderList);   // 2.442.0: a frame and what is in it
    return env.srcFor(L);
  }
  function drawUnit(env, node, clips, acc, W, H) {
    const L = node.L;
    if (!isShown(env, L)) return;                           // a hidden base hides its clipped layers too
    const g = acc.getContext("2d");
    if (L.type === "adjust") { applyAdjust(env, L, acc, W, H); for (const c of clips) drawUnit(env, c, [], acc, W, H); return; }
    const blend = L.blend || (L.type === "group" ? "pass-through" : "normal");
    if (L.type === "group" && !L.artboard && blend === "pass-through" && !(L.mask && L.mask.on !== false) && (L.opacity == null || L.opacity >= 1) && !hasStyles(L)) {
      renderList(env, node.kids, acc, W, H);
      for (const c of clips) drawUnit(env, c, [], acc, W, H);
      return;
    }
    let content = masked(env, L, contentOf(env, node, W, H), W, H);
    if (clips.length) {
      const base = content;
      content = copyOf(env, base, W, H);
      const cg = content.getContext("2d");
      for (const c of clips) {
        const C = c.L; if (!isShown(env, C)) continue;
        if (C.type === "adjust") { applyAdjust(env, C, content, W, H); continue; }
        const cc = copyOf(env, styled(env, C, masked(env, C, contentOf(env, c, W, H), W, H), W, H), W, H), ccg = cc.getContext("2d");
        ccg.globalCompositeOperation = "destination-in"; ccg.drawImage(base, 0, 0);
        cg.save(); cg.globalAlpha = C.opacity == null ? 1 : C.opacity; cg.globalCompositeOperation = env.compositeOf(C.blend || "normal"); cg.drawImage(cc, 0, 0); cg.restore();
      }
    }
    const fin = styled(env, L, content, W, H);
    g.save(); g.globalAlpha = L.opacity == null ? 1 : L.opacity;
    g.globalCompositeOperation = env.compositeOf(blend === "pass-through" ? "normal" : blend);
    g.drawImage(fin, 0, 0); g.restore();
  }
  function renderList(env, nodes, acc, W, H) {
    for (let i = 0; i < nodes.length;) {
      const base = nodes[i], clips = [];
      let j = i + 1;
      while (j < nodes.length && nodes[j].L.clip) { clips.push(nodes[j]); j++; }
      drawUnit(env, base, clips, acc, W, H);
      i = j;
    }
  }
  /**
   * The composite of a document. doc = {w, h, layers}; env = {newCanvas(w, h), srcFor(L) -> the layer's pixels (the page
   * puts the live stroke / moved pixels in), maskSrc(L)? -> a live mask, adjust(kind, rgba, w, h, params) -> rgba,
   * compositeOf(blend), skipControl (the save / the AI: control layers are not part of the picture), into? (a canvas)}
   */
  function render(doc, env) {
    const W = doc.w, H = doc.h, acc = env.into || env.newCanvas(W, H);
    if (env.into) { const g = acc.getContext("2d"); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.clearRect(0, 0, W, H); }
    renderList(env, toTree(doc.layers), acc, W, H);
    return acc;
  }
  /** one layer as it looks (mask + styles + fill), alone - Merge Down / Rasterize / the thumbnail */
  function renderLayer(doc, env, L) {
    const node = findNode(toTree(doc.layers), L.id); if (!node) return null;
    const W = doc.w, H = doc.h, acc = env.newCanvas(W, H);
    const n = node.list[node.i];
    const was = L.visible; L.visible = true;
    try { drawUnit(Object.assign({}, env, { skipControl: false }), Object.assign({}, n, { L: Object.assign({}, L, { clip: false, opacity: 1, blend: L.type === "group" ? "normal" : "normal" }) }), [], acc, W, H); }
    finally { L.visible = was; }
    return acc;
  }

  const api = { ADJ_KINDS, STYLE_KINDS, STYLE_DEFAULTS, LABELS, LABEL_HEX, TEXT_DEFAULT, SHAPE_DEFAULT, FONT_STACK,
                toTree, fromTree, normalize, findNode, descendants, depth, move, moveEnd, insert, group, ungroup, remove, shown,
                snapLayer, putLayer, clone, isLive, fontCss, textBox, textBox0, textMat, drawText, drawShape, drawFill, shapePath, rasterize,
                maskAlpha, styled, applyAdjust, render, renderLayer, hasStyles };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCDoc = api;
})(typeof window !== "undefined" ? window : globalThis);
