/* bitGen Studio — ext/pushpulldock/ppjoinery.js (2.689.0): THE SKETCHER'S CUPBOARDS & SHELVING - built-in robes, walk-in
 * robes, linen / pantry / broom cupboards, bookshelves, shelving units.
 * Tim (verbatim): "add a shelf/cupboard dialog for builtin cupboards, walk-in robes etc. must be customizable and be able to
 * save as template"
 *
 * A piece of joinery is a furniture item (A.items, PPFurn) of type "joinery" carrying its design: it.spec. Its w / d / h are the
 * design's outside size (dims). The design (clean / DEFAULT / PRESETS):
 *   {name, layout run | L | U, w (the back run's length = the outside width), d (the cupboard's depth), h (its height),
 *    side (L / U: the outside depth - the side runs' length + d), lside left | right (L), t (board thickness), plinth (kick
 *    height, 0 = none), doors none | hinged | sliding | bifold | glass, showDoors (3D), handle none | bar | knob | edge,
 *    col {body, doors, handles} (#rrggbb or "mat:<key>" - the Sketcher's paints), runs [{bays: [{w (inside width, 0 = share
 *    what is left), kind hang | double | shelves | drawers | shoes | open, shelves, drawers}]}]}
 * The item's own frame (PPFurn): x across, y its depth with the BACK at -D/2 (against the wall) and the FRONT at +D/2, z up.
 * A run = {s back-start corner, u along, f front, L, d} - the back run along +x; L / U side runs start at the back run's front
 * face (no overlap in the corners), the left one's front faces +x, the right one's -x.
 *   runsOf(spec) -> runs, bays(run, bays, t) -> [{x0, x1, b}], boxes(spec) -> [{c [x,y,z], s [sx,sy,sz], part, col}] (local)
 *   plan(spec) -> [{a, b, dash}] (local, for the floorplan), elevation(spec, i) -> SVG markup (the dialog's front view)
 *   dims(spec) -> {w, d, h}, cleanItem(o), makeItem(spec, p, z, rot), group(T, it) (three.js), label(it)
 * Pure - Node-testable (no DOM, no three.js until group()). */
(function (root) {
  "use strict";
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const n = (v, d, lo, hi) => { const x = +v; return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  const LAYOUTS = { run: "Straight run", L: "L-shape", U: "U-shape (walk-in)" };
  const DOORS = { none: "No doors (open)", hinged: "Hinged doors", sliding: "Sliding doors", bifold: "Bi-fold doors", glass: "Glass doors" };
  const HANDLES = { none: "None (push to open)", bar: "Bar handles", knob: "Knobs", edge: "Edge pulls" };
  const KINDS = { hang: "Hanging rail", double: "Double hanging", shelves: "Shelves", drawers: "Drawers + shelves", shoes: "Shoe shelves", open: "Open (empty)" };
  const COLS = { body: "#ece7dc", doors: "#ddd6c8", handles: "#8c8c8c" };
  const colOk = (c, d) => (typeof c === "string" && (/^#[0-9a-f]{6}$/i.test(c) || /^mat:[a-z0-9_]{1,40}$/i.test(c)) ? c : d);
  function runCount(layout) { return layout === "U" ? 3 : layout === "L" ? 2 : 1; }
  const bay = (kind, o) => Object.assign({ w: 0, kind, shelves: kind === "shoes" ? 5 : kind === "drawers" ? 2 : 4, drawers: 3 }, o || {});
  const DEFAULT = { name: "Built-in robe", layout: "run", w: 2.4, d: 0.6, h: 2.4, side: 2, lside: "left", t: 0.018, plinth: 0.1, doors: "sliding", showDoors: true, handle: "edge",
    col: Object.assign({}, COLS), runs: [{ bays: [bay("hang"), bay("shelves", { w: 0.45, shelves: 5 }), bay("double")] }] };
  const P = (o) => clean(Object.assign({}, DEFAULT, o, { col: Object.assign({}, COLS, o.col || {}) }));
  const PRESETS = [
    ["robe2", P({ name: "Built-in robe · sliding doors" })],
    ["robeh", P({ name: "Built-in robe · hinged doors", w: 1.8, doors: "hinged", handle: "bar", runs: [{ bays: [bay("hang"), bay("drawers", { w: 0.5, drawers: 3, shelves: 2 }), bay("hang")] }] })],
    ["wirU", P({ name: "Walk-in robe · U", layout: "U", w: 2.4, side: 2.1, doors: "none", handle: "bar", runs: [{ bays: [bay("double"), bay("shelves", { w: 0.5, shelves: 6 }), bay("double")] }, { bays: [bay("hang"), bay("shoes", { w: 0.6 })] }, { bays: [bay("hang"), bay("drawers", { w: 0.6, drawers: 4, shelves: 2 })] }] })],
    ["wirL", P({ name: "Walk-in robe · L", layout: "L", w: 2.2, side: 1.8, doors: "none", handle: "bar", runs: [{ bays: [bay("double"), bay("drawers", { w: 0.6, drawers: 4 }), bay("hang")] }, { bays: [bay("shelves", { shelves: 6 }), bay("hang")] }] })],
    ["linen", P({ name: "Linen cupboard", w: 0.9, d: 0.5, doors: "hinged", handle: "knob", runs: [{ bays: [bay("shelves", { shelves: 6 })] }] })],
    ["pantry", P({ name: "Pantry", w: 1.2, d: 0.6, doors: "hinged", handle: "bar", runs: [{ bays: [bay("shelves", { shelves: 6 }), bay("shelves", { shelves: 6 })] }] })],
    ["broom", P({ name: "Broom cupboard", w: 0.6, d: 0.6, doors: "hinged", handle: "knob", runs: [{ bays: [bay("shelves", { shelves: 1 })] }] })],
    ["books", P({ name: "Bookshelf", w: 1.8, d: 0.35, h: 2.1, plinth: 0.08, doors: "none", handle: "none", col: { body: "mat:wood_light" }, runs: [{ bays: [bay("shelves", { shelves: 5 }), bay("shelves", { shelves: 5 }), bay("shelves", { shelves: 5 })] }] })],
    ["garage", P({ name: "Shelving unit", w: 2, d: 0.45, h: 1.8, plinth: 0, doors: "none", handle: "none", col: { body: "#9aa0a6" }, runs: [{ bays: [bay("shelves", { shelves: 4 }), bay("shelves", { shelves: 4 })] }] })],
  ].map(([id, spec]) => ({ id: "preset:" + id, name: spec.name, spec }));
  /** the design checked - every number held to sense, the runs one a layout needs (pure) */
  function clean(o0) {
    const o = o0 && typeof o0 === "object" ? o0 : {}, layout = LAYOUTS[o.layout] ? o.layout : "run", d = n(o.d, 0.6, 0.15, 1.5);
    const w = n(o.w, 2.4, 0.3, 12), side = layout === "run" ? d : n(o.side, 2, d + 0.3, 12);
    const runs = (Array.isArray(o.runs) ? o.runs : []).slice(0, 3).map((r) => ({ bays: (Array.isArray(r && r.bays) ? r.bays : []).slice(0, 24).map((b) => ({
      w: n(b && b.w, 0, 0, 6), kind: KINDS[b && b.kind] ? b.kind : "shelves", shelves: Math.round(n(b && b.shelves, 4, 0, 20)), drawers: Math.round(n(b && b.drawers, 3, 0, 10)) })) }));
    while (runs.length < runCount(layout)) runs.push({ bays: [bay("hang")] });
    runs.length = runCount(layout);
    runs.forEach((r) => { if (!r.bays.length) r.bays.push(bay("shelves")); });
    const c = o.col && typeof o.col === "object" ? o.col : {};
    return { name: String(o.name || "Cupboard").slice(0, 60), layout, w, d, h: n(o.h, 2.4, 0.3, 4), side, lside: o.lside === "right" ? "right" : "left",
      t: n(o.t, 0.018, 0.009, 0.05), plinth: n(o.plinth, 0.1, 0, 0.3), doors: DOORS[o.doors] ? o.doors : "none", showDoors: o.showDoors !== false,
      handle: HANDLES[o.handle] ? o.handle : "none", col: { body: colOk(c.body, COLS.body), doors: colOk(c.doors, COLS.doors), handles: colOk(c.handles, COLS.handles) }, runs };
  }
  const dims = (s) => ({ w: s.w, d: s.layout === "run" ? s.d : s.side, h: s.h });
  /** how deep the doors are (they sit in the cupboard's own depth - its outline stays the design's) */
  function doorDepth(s) {                                                   // + the handles' reach (all inside the outline)
    const hd = s.handle === "none" ? 0 : s.handle === "knob" ? 0.031 : 0.026, drawers = s.runs && s.runs.some((r) => r.bays.some((b) => b.kind === "drawers"));
    if (s.doors === "none") return drawers ? hd : 0;              // hidden doors (showDoors) keep their room - nothing resizes
    return s.doors === "sliding" ? 0.051 : 0.02 + hd;
  }
  /** the runs in the item's frame (pure) */
  function runsOf(s) {
    const D = dims(s).d, W = s.w, out = [{ name: "Back", s: [-W / 2, -D / 2], u: [1, 0], f: [0, 1], L: W, d: s.d }];
    const left = { name: "Left", s: [-W / 2, D / 2], u: [0, -1], f: [1, 0], L: D - s.d, d: s.d }, right = { name: "Right", s: [W / 2, -D / 2 + s.d], u: [0, 1], f: [-1, 0], L: D - s.d, d: s.d };
    if (s.layout === "U") out.push(left, right); else if (s.layout === "L") out.push(s.lside === "right" ? right : left);
    return out;
  }
  /** the bays along a run: inside widths (fixed ones as given, the rest share what is left) -> [{x0, x1, b}] (pure) */
  function bays(run, list, t) {
    const inner = run.L - t * (list.length + 1), fixed = list.filter((b) => b.w > 0), auto = list.length - fixed.length;
    let fs = fixed.reduce((a, b) => a + b.w, 0), k = 1;
    if (!auto && fs > 0) k = inner / fs; else if (fs > inner - auto * 0.1) k = Math.max(0, (inner - auto * 0.1)) / (fs || 1);
    const aw = auto ? Math.max(0.1, (inner - fs * k) / auto) : 0;
    let x = t;
    return list.map((b) => { const w = b.w > 0 ? b.w * k : aw, o = { x0: x, x1: x + w, b }; x += w + t; return o; });
  }
  /** every board, rail, drawer front, door and handle as a box in the item's frame (pure) */
  function boxes(s0) {
    const s = s0 && s0.runs ? s0 : clean(s0), t = s.t, p = s.plinth, h = s.h, dd = doorDepth(s), out = [];
    runsOf(s).forEach((R, ri) => {
      if (R.L < 0.05) return;
      const dc = R.d - dd;                                                  // the carcass' depth (the doors in front of it)
      const box = (a0, a1, b0, b1, z0, z1, part, col) => {
        if (a1 - a0 < 1e-4 || b1 - b0 < 1e-4 || z1 - z0 < 1e-4) return;
        const xs = [R.s[0] + R.u[0] * a0 + R.f[0] * b0, R.s[0] + R.u[0] * a1 + R.f[0] * b1], ys = [R.s[1] + R.u[1] * a0 + R.f[1] * b0, R.s[1] + R.u[1] * a1 + R.f[1] * b1];
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        out.push({ c: [r4((x0 + x1) / 2), r4((y0 + y1) / 2), r4((z0 + z1) / 2)], s: [r4(x1 - x0), r4(y1 - y0), r4(z1 - z0)], part, col, run: ri });
      };
      const B = s.col.body, zb = p + t, zt = h - t, list = bays(R, s.runs[ri].bays, t);
      box(0, t, 0, dc, 0, h, "side", B); box(R.L - t, R.L, 0, dc, 0, h, "side", B);          // the two ends
      box(t, R.L - t, 0, dc, h - t, h, "top", B); box(t, R.L - t, 0, dc, p, p + t, "base", B);
      box(t, R.L - t, 0, 0.006, zb, zt, "back", B);
      if (p > 0) box(t, R.L - t, dc - 0.066, dc - 0.05, 0, p, "plinth", B);                // the kick board, set back 5 cm
      list.forEach((q, i) => {
        if (i < list.length - 1) box(q.x1, q.x1 + t, 0.006, dc, zb, zt, "partition", B);
        const sh = (z) => box(q.x0, q.x1, 0.006, dc - 0.02, z, z + t, "shelf", B);
        const rail = (z) => box(q.x0, q.x1, dc / 2 - 0.0125, dc / 2 + 0.0125, z - 0.0125, z + 0.0125, "rail", s.col.handles);
        const even = (z0, z1, k) => { for (let j = 1; j <= k; j++) sh(z0 + (z1 - z0) * j / (k + 1) - t / 2); };
        const k = q.b.kind;
        if (k === "shelves") even(zb, zt, q.b.shelves);
        else if (k === "shoes") for (let j = 1; j <= q.b.shelves; j++) { const z = zb + j * 0.2; if (z < zt - 0.05) sh(z); }
        else if (k === "hang") { const zs = zt - 0.32; if (zs > zb + 0.9) { sh(zs); rail(zs - 0.07); } else rail(zt - 0.07); }
        else if (k === "double") { const zs = zt - 0.32, zm = zb + (zs - zb) / 2; sh(zs); rail(zs - 0.07); sh(zm); rail(zm - 0.07); }
        else if (k === "drawers") {
          const dh = 0.22; let z = zb;
          for (let j = 0; j < q.b.drawers && z + dh <= zt; j++) { box(q.x0 + 0.002, q.x1 - 0.002, dc - 0.02, dc, z + 0.002, z + dh - 0.002, "drawer", s.col.doors);
            if (s.handle !== "none" && (s.doors === "none" || !s.showDoors)) handle(q.x0, q.x1, z + dh / 2 - 0.01, z + dh / 2 + 0.01, dc, true); z += dh; }
          if (z < zt - 0.1) { sh(z); even(z + t, zt, q.b.shelves); }
        }
      });
      // the doors: hinged / bi-fold / glass per bay, sliding across the run
      function handle(a0, a1, z0, z1, b, flat) {
        const mid = (a0 + a1) / 2, H = s.handle, C = s.col.handles;
        if (H === "bar") flat ? box(mid - 0.08, mid + 0.08, b, b + 0.025, z0, z1, "handle", C) : box(a0, a1, b, b + 0.025, z0, z1, "handle", C);
        else if (H === "knob") box(mid - 0.015, mid + 0.015, b, b + 0.03, (z0 + z1) / 2 - 0.015, (z0 + z1) / 2 + 0.015, "handle", C);
        else if (H === "edge") box(a0, a1, b, b + 0.012, z1 - 0.02, z1, "handle", C);
      }
      if (s.doors === "none" || !s.showDoors) return;
      const DC = s.doors === "glass" ? "glass" : s.col.doors, dz0 = p + 0.003, dz1 = h - 0.003, hz = Math.min(1.1, h * 0.45);
      if (s.doors === "sliding") {
        const m = Math.max(2, Math.ceil(R.L / 1.2)), pw = R.L / m + 0.03;
        for (let j = 0; j < m; j++) { const a0 = Math.max(0, j * R.L / m - (j ? 0.015 : 0)), a1 = Math.min(R.L, a0 + pw), b0 = j % 2 ? dc + 0.024 : dc + 0.002;
          box(a0, a1, b0, b0 + 0.019, dz0, dz1, "door", DC);
          if (s.handle !== "none") { const e = j % 2 ? a0 + 0.03 : a1 - 0.045; box(e, e + 0.015, b0 + 0.019, b0 + 0.026, hz - 0.15, hz + 0.15, "handle", s.col.handles); } }
        return;
      }
      list.forEach((q, i) => {
        const a0 = i === 0 ? 0 : q.x0 - t / 2, a1 = i === list.length - 1 ? R.L : q.x1 + t / 2, w = a1 - a0;
        const leaves = s.doors === "bifold" ? (w > 1 ? 4 : 2) : (w > 0.6 ? 2 : 1), lw = w / leaves;
        for (let j = 0; j < leaves; j++) {
          const l0 = a0 + j * lw + 0.0015, l1 = a0 + (j + 1) * lw - 0.0015;
          box(l0, l1, dc, dc + 0.019, dz0, dz1, "door", DC);
          if (s.handle === "none") continue;
          const meet = leaves === 1 ? (i % 2 ? l0 + 0.04 : l1 - 0.06) : j < leaves / 2 ? l1 - 0.06 : l0 + 0.04;
          if ((leaves === 1) || j === leaves / 2 - 1 || j === leaves / 2) {
            if (s.handle === "edge") box(meet, meet + 0.02, dc + 0.019, dc + 0.03, hz - 0.2, hz + 0.2, "handle", s.col.handles);
            else handle(meet, meet + 0.02, s.handle === "knob" ? hz - 0.02 : hz - 0.12, s.handle === "knob" ? hz + 0.02 : hz + 0.12, dc + 0.019, false);
          }
        }
      });
    });
    return out;
  }
  /** the floorplan lines in the item's frame: each run's outline, a dashed line where clothes hang, the doors (pure) */
  function plan(s0) {
    const s = s0 && s0.runs ? s0 : clean(s0), out = [], dd = doorDepth(s);
    runsOf(s).forEach((R, ri) => {
      if (R.L < 0.05) return;
      const P2 = (a, b) => [r4(R.s[0] + R.u[0] * a + R.f[0] * b), r4(R.s[1] + R.u[1] * a + R.f[1] * b)];
      const seg = (a0, b0, a1, b1, dash) => out.push({ a: P2(a0, b0), b: P2(a1, b1), dash: !!dash });
      seg(0, 0, R.L, 0); seg(R.L, 0, R.L, R.d); seg(R.L, R.d, 0, R.d); seg(0, R.d, 0, 0);
      const dc = R.d - dd, list = bays(R, s.runs[ri].bays, s.t);
      list.forEach((q, i) => {
        if (i < list.length - 1) seg(q.x1 + s.t / 2, 0, q.x1 + s.t / 2, dc);
        if (q.b.kind === "hang" || q.b.kind === "double") seg(q.x0, dc / 2, q.x1, dc / 2, true);
      });
      if (s.doors === "sliding") { seg(0, dc + 0.012, R.L * 0.55, dc + 0.012); seg(R.L * 0.45, dc + 0.034, R.L, dc + 0.034); }
      else if (s.doors !== "none") list.forEach((q, i) => {          // hinged: a quarter swing per leaf
        const a0 = i === 0 ? 0 : q.x0 - s.t / 2, a1 = i === list.length - 1 ? R.L : q.x1 + s.t / 2, w = a1 - a0;
        const leaves = s.doors === "bifold" ? (w > 1 ? 4 : 2) : (w > 0.6 ? 2 : 1);
        if (s.doors === "bifold") { for (let j = 0; j < leaves; j += 2) { const m = a0 + (j + 1) * w / leaves, k = w / leaves * 0.7; seg(m - w / leaves, R.d, m, R.d + k); seg(m, R.d + k, m + w / leaves, R.d); } return; }
        const arcs = leaves === 1 ? [[i % 2 ? a1 : a0, i % 2 ? -1 : 1, w]] : [[a0, 1, w / 2], [a1, -1, w / 2]];
        arcs.forEach(([hx, dir, r]) => { let prev = [hx + dir * r, R.d]; for (let k = 1; k <= 8; k++) { const ang = k / 8 * Math.PI / 2, q2 = [hx + dir * r * Math.cos(ang), R.d + r * Math.sin(ang)]; seg(prev[0], prev[1], q2[0], q2[1], true); prev = q2; } seg(hx, R.d, hx, R.d + r); });
      });
    });
    return out;
  }
  /** the front view of run i as SVG (the dialog's picture) - boards, shelves, rails, drawers; the doors dashed over them */
  function elevation(s0, ri, size) {
    const s = s0 && s0.runs ? s0 : clean(s0), R = runsOf(s)[ri || 0]; if (!R) return "";
    const W = size && size.w || 360, H = size && size.h || 240, pad = 10, k = Math.min((W - pad * 2) / Math.max(R.L, 0.3), (H - pad * 2) / s.h);
    const X = (a) => pad + a * k, Y = (z) => H - pad - z * k, t = s.t, p = s.plinth, list = bays(R, s.runs[ri || 0].bays, t), o = [];
    const rect = (a0, z0, a1, z1, cls) => o.push(`<rect class="${cls}" x="${X(a0).toFixed(1)}" y="${Y(z1).toFixed(1)}" width="${Math.max(0.5, (a1 - a0) * k).toFixed(1)}" height="${Math.max(0.5, (z1 - z0) * k).toFixed(1)}"/>`);
    rect(0, 0, R.L, s.h, "ppj-body"); rect(0, 0, t, s.h, "ppj-b"); rect(R.L - t, 0, R.L, s.h, "ppj-b"); rect(t, s.h - t, R.L - t, s.h, "ppj-b"); rect(t, p, R.L - t, p + t, "ppj-b");
    if (p > 0) rect(t, 0, R.L - t, p, "ppj-kick");
    const zb = p + t, zt = s.h - t;
    list.forEach((q, i) => {
      if (i < list.length - 1) rect(q.x1, zb, q.x1 + t, zt, "ppj-b");
      const sh = (z) => rect(q.x0, z, q.x1, z + t, "ppj-b"), rail = (z) => o.push(`<line class="ppj-rail" x1="${X(q.x0 + 0.02).toFixed(1)}" y1="${Y(z).toFixed(1)}" x2="${X(q.x1 - 0.02).toFixed(1)}" y2="${Y(z).toFixed(1)}"/>`);
      const even = (z0, z1, m) => { for (let j = 1; j <= m; j++) sh(z0 + (z1 - z0) * j / (m + 1) - t / 2); }, kd = q.b.kind;
      if (kd === "shelves") even(zb, zt, q.b.shelves);
      else if (kd === "shoes") for (let j = 1; j <= q.b.shelves; j++) { const z = zb + j * 0.2; if (z < zt - 0.05) sh(z); }
      else if (kd === "hang") { const zs = zt - 0.32; if (zs > zb + 0.9) { sh(zs); rail(zs - 0.07); } else rail(zt - 0.07); }
      else if (kd === "double") { const zs = zt - 0.32, zm = zb + (zs - zb) / 2; sh(zs); rail(zs - 0.07); sh(zm); rail(zm - 0.07); }
      else if (kd === "drawers") { let z = zb; for (let j = 0; j < q.b.drawers && z + 0.22 <= zt; j++) { rect(q.x0 + 0.004, z + 0.004, q.x1 - 0.004, z + 0.216, "ppj-drawer"); z += 0.22; } if (z < zt - 0.1) { sh(z); even(z + t, zt, q.b.shelves); } }
      o.push(`<text class="ppj-w" x="${X((q.x0 + q.x1) / 2).toFixed(1)}" y="${(Y(zb) - 3).toFixed(1)}">${Math.round((q.x1 - q.x0) * 1000)}</text>`);
    });
    if (s.doors !== "none") {
      if (s.doors === "sliding") { const m = Math.max(2, Math.ceil(R.L / 1.2)); for (let j = 0; j < m; j++) rect(j * R.L / m, p, (j + 1) * R.L / m, s.h, "ppj-door"); }
      else list.forEach((q, i) => { const a0 = i === 0 ? 0 : q.x0 - t / 2, a1 = i === list.length - 1 ? R.L : q.x1 + t / 2, w = a1 - a0, lv = s.doors === "bifold" ? (w > 1 ? 4 : 2) : (w > 0.6 ? 2 : 1);
        for (let j = 0; j < lv; j++) rect(a0 + j * w / lv, p, a0 + (j + 1) * w / lv, s.h, "ppj-door"); });
    }
    o.push(`<text class="ppj-dim" x="${(W / 2).toFixed(1)}" y="${(H - 1).toFixed(1)}">${R.name} · ${Math.round(R.L * 1000)} × ${Math.round(s.h * 1000)} mm</text>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${o.join("")}</svg>`;
  }
  /** the plan seen from above as SVG (the dialog's small map) */
  function planSvg(s0, size) {
    const s = s0 && s0.runs ? s0 : clean(s0), D = dims(s), W = size && size.w || 160, H = size && size.h || 120, pad = 8;
    const k = Math.min((W - 2 * pad) / D.w, (H - 2 * pad - 14) / (D.d + 0.4)), X = (x) => W / 2 + x * k, Y = (y) => pad + (y + D.d / 2) * k;
    const L = plan(s).map((q) => `<line class="${q.dash ? "ppj-rail" : "ppj-pl"}" x1="${X(q.a[0]).toFixed(1)}" y1="${Y(q.a[1]).toFixed(1)}" x2="${X(q.b[0]).toFixed(1)}" y2="${Y(q.b[1]).toFixed(1)}"/>`);
    L.push(`<line class="ppj-wall" x1="${X(-D.w / 2 - 0.1).toFixed(1)}" y1="${(Y(-D.d / 2) - 2).toFixed(1)}" x2="${X(D.w / 2 + 0.1).toFixed(1)}" y2="${(Y(-D.d / 2) - 2).toFixed(1)}"/>`);
    L.push(`<text class="ppj-dim" x="${(W / 2).toFixed(1)}" y="${(H - 2).toFixed(1)}">${Math.round(D.w * 1000)} × ${Math.round(D.d * 1000)} mm · the wall at the top</text>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${L.join("")}</svg>`;
  }
  /** a joinery item: {type "joinery", x, y, z, rot, w, d, h, spec} - its size from the design */
  function makeItem(spec, p, z, rot) { const s = clean(spec), D = dims(s); return { type: "joinery", x: r4(p[0]), y: r4(p[1]), z: r4(z || 0), rot: ((Math.round(+rot || 0) % 360) + 360) % 360, w: D.w, d: D.d, h: D.h, color: "", spec: s }; }
  function cleanItem(o) {
    const s = clean(o.spec), D = dims(s);
    return { id: o.id, type: "joinery", x: n(o.x, 0, -1e4, 1e4), y: n(o.y, 0, -1e4, 1e4), z: n(o.z, 0, -100, 1000), rot: n(o.rot, 0, -720, 720), pitch: 0, roll: 0, w: D.w, d: D.d, h: D.h, color: "", spec: s };
  }
  /** the item's spec changed (the dialog / its panel): its size follows */
  function apply(it, spec) { const s = clean(spec), D = dims(s); it.spec = s; it.w = D.w; it.d = D.d; it.h = D.h; return it; }
  const label = (it) => (it && it.spec && it.spec.name) || "Cupboard";

  /* ---- three.js: the boxes as meshes - one shared unit cube, scaled; a material per colour */
  let CUBE = null; const MATS = new Map();
  function mat(T, col) {
    const key = col; if (MATS.has(key)) return MATS.get(key);
    let m;
    if (col === "glass") m = new T.MeshStandardMaterial({ color: 0xbfd8e6, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1 });
    else { const F = root.PPFurn, L = F && F.look ? F.look(T, col) : { color: col, map: null, rough: 0.8 }; m = new T.MeshStandardMaterial({ color: L.color || "#cccccc", map: L.map || null, roughness: L.rough != null ? L.rough : 0.8 }); }
    MATS.set(key, m); return m;
  }
  function group(T, it) {
    const G3 = new T.Group(); G3.userData.tag = { ak: "item", id: it.id };
    if (!CUBE) CUBE = new T.BoxGeometry(1, 1, 1);
    boxes(it.spec || DEFAULT).forEach((b) => { const me = new T.Mesh(CUBE, mat(T, b.col)); me.position.set(b.c[0], b.c[1], b.c[2]); me.scale.set(b.s[0], b.s[1], b.s[2]); me.castShadow = me.receiveShadow = b.col !== "glass"; me.userData.part = b.part; G3.add(me); });
    G3.position.set(it.x, it.y, it.z || 0); G3.rotation.order = "ZXY"; G3.rotation.z = -(it.rot || 0) * Math.PI / 180;
    return G3;
  }

  const api = { LAYOUTS, DOORS, HANDLES, KINDS, COLS, DEFAULT, PRESETS, bay, clean, dims, doorDepth, runsOf, bays, boxes, plan, elevation, planSvg, makeItem, cleanItem, apply, label, group };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PPJoinery = api;
})(typeof window !== "undefined" ? window : globalThis);
