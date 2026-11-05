/* bitGen Studio — ext/pushpulldock/pparch.js (2.620.0): THE ARCHITECTURE of the 📏 PushPull docker (window.PPArch / require()).
 *
 * Tim (verbatim): "add architectural tools like floor, walls,windows, ceiling,roof  etc. rooms will be able to be dragged,
 * their  walls can snap to another room and share the wall, door or window etc. add lights, downlights, pendant lights,
 * chandelier lights, ceiling mounted lights etc."
 *
 * The model keeps its architecture beside its faces - M.arch (saved with it, undone with it):
 *   rooms   {id, name, pts [[x, y] ...] (the walls' CENTRE line, counter-clockwise), closed, z (its floor level), h (wall
 *           height = its ceiling), t (wall thickness), wall / floor / ceilCol colours, floorOn, ceilOn}
 *           closed: false = a free-standing wall (the Wall tool's run) - no floor, no ceiling
 *   ops     doors / windows / openings ON a room's wall: {id, kind: door | window | opening, room, edge, at (its middle, metres
 *           from the edge's start), w, h, sill, style, col, flip} - they go where their room goes
 *   roofs   {id, rooms [ids], type: gable | hip | shed (skillion) | dutch | jerkin | gambrel | mansard | saltbox | pyramid |
 *           butterfly | flat | follow, pitch°, over (overhang), th, col, ridge: auto | u | v, k (the type's proportion - ROOF_K),
 *           pitch2 (gambrel / mansard: the lower, steeper pitch), flip (the other side high: skillion, saltbox)}   2.666.0
 *   slabs   floors without walls (decks, a storey's plate): {id, pts, z (its top), th, col}
 *   stairs  {id, x, y, ang°, w, len, rise, z, col}
 *   lights  {id, type: downlight | ceiling | pendant | chandelier | wall | spot | floorlamp | tablelamp, x, y, z, room, col, lm,
 *           on, drop, ang, dir}
 *
 * SHARED WALLS: every room's walls are mitred quads round its centre line; the walls of a storey are made as ONE solid -
 * the union of all the quads (polygon-clipping), cut by the openings - so two rooms whose walls lie on one line have ONE
 * wall there, and a door / window in it goes through both. Each wall face takes the colour of the room it faces (outside:
 * arch.ext). snapMove() pulls a dragged room's wall onto a neighbour's (and its corners onto the neighbour's corners).
 *
 *   build(A) -> {polys: [{rings, n, col, alpha, tag, layer}], lines: [[p, q] ...], lights: [...]}   planar polygons in 3D
 *           (Z up, metres; rings[0] the outline, the rest holes) for the view (ppview / pparchview) to triangulate
 * 2.621.x -> 2.624.0 (Tim: "when user creates walls add offset input to offset wall from edge of floor, allow user to drag walls
 * but show snap regions on floor and allow user to snap wall to floor edge, when user double clicks the the top of a wall cut
 * the face allow the use to drag that edge up and down and delete the edge when the del button is pressed and edge is
 * selected. allow user to select edges on the wall to change slope of the wall. in ceiling options add flat ceiling, follow
 * slope of walls, with roof follow slope of walls add eaves width input"):
 *   WALL TOPS   room.tops = {edge: [[t, h] ...]} - the top of a wall along it (t 0..1, h above its floor); none = flat at h.
 *               cutTop (a point where it is double-clicked), moveTopPoint / moveTopSeg (dragged up / down - a corner moves
 *               the wall beside it too), removeTopPoint / removeTopSeg (Delete). The walls' bands stand to each wall's
 *               lowest top; above it a wall's own piece follows its profile.
 *   CEILING     room.ceil "flat" (at h) | "follow" (a rectangle room: the surface between its two opposite walls' tops)
 *   ROOF        type "follow": the same surface over the walls' outer tops, out past them by the eaves (rf.over)
 *   FLOOR EDGE  slabEdges, snapToFloor (a wall's outside face onto a floor's edge, `off` in from it), offsetOnFloor (a wall
 *               drawn along a floor's edge moved in so its outside face is `off` from the edge), moveEdge (one wall of a
 *               room dragged out / in)
 * Pure (Node: scripts/test-arch620.js - with globalThis.polygonClipping = require(static/vendor/polygon-clipping.umd.min.js)). */
(function (root) {
  "use strict";
  const EPS = 1e-6;
  const PC = () => { const p = root.polygonClipping; if (!p) throw new Error("static/vendor/polygon-clipping.umd.min.js is not loaded"); return p; };
  const DEF = { h: 2.7, t: 0.15, wall: "#f4f1ea", floor: "#c8a882", ceil: "#fbfbf8", ext: "#e9e3d7", door: "#8b5a2b", frame: "#f4f4f4", glass: "#9ec5e8", roof: "#8a4f3d", stair: "#b08a62", slab: "#bdb7ab", top: "#d9d3c7", trim: "#f2efe8" };   // 2.639.0: + skirting / cornice
  const OPS = { door: { w: 0.9, h: 2.1, sill: 0, style: "single" }, window: { w: 1.2, h: 1.2, sill: 0.9, style: "double" }, opening: { w: 1.0, h: 2.1, sill: 0, style: "plain" } };
  const STYLES = { door: ["single", "double", "sliding", "glass"], window: ["single", "double", "slider"], opening: ["plain"] };
  const ROOFS = ["gable", "hip", "shed", "dutch", "jerkin", "gambrel", "mansard", "saltbox", "pyramid", "butterfly", "flat", "follow"];   // 2.624.0: follow = on the walls' tops (their slope); 2.666.0: + dutch ... butterfly
  /** 2.666.0 (Tim: "can you add roof options, gable, skilion, hip etc"): the names people know them by */
  const ROOF_LABELS = { gable: "Gable", hip: "Hip", shed: "Skillion (lean-to)", dutch: "Dutch gable (gablet)", jerkin: "Clipped gable (jerkinhead)", gambrel: "Gambrel (barn)", mansard: "Mansard", saltbox: "Saltbox", pyramid: "Pyramid", butterfly: "Butterfly", flat: "Flat", follow: "Follows the walls' slope" };
  /** the proportion each type has (rf.k, 0.05 - 0.95; null = this): dutch = the hip's part of the rise (the gablet above it), jerkin =
   *  the clipped part at the top, gambrel / mansard = how far in the slope breaks (of half the width), saltbox = the ridge from the
   *  front (of the depth) */
  const ROOF_K = { dutch: 0.5, jerkin: 0.3, gambrel: 0.35, mansard: 0.35, saltbox: 0.33 };
  const ROOF_ALIAS = { skillion: "shed", skilion: "shed", "lean-to": "shed", leanto: "shed", "dutch-gable": "dutch", gablet: "dutch", jerkinhead: "jerkin", "clipped-gable": "jerkin", barn: "gambrel", "m-roof": "butterfly", pyramidal: "pyramid" };
  // the lights: their usual brightness (lumens) + the fixture's sizes
  const LIGHTS = {
    downlight: { label: "Downlight (recessed)", lm: 650, ang: 50, mount: "ceil" },
    ceiling: { label: "Ceiling-mounted", lm: 1400, mount: "ceil" },
    pendant: { label: "Pendant", lm: 800, drop: 0.7, mount: "ceil" },
    chandelier: { label: "Chandelier", lm: 2400, drop: 0.8, mount: "ceil" },
    spot: { label: "Spot (track)", lm: 500, ang: 28, mount: "ceil" },
    wall: { label: "Wall light (sconce)", lm: 450, hz: 1.8, mount: "wall" },
    floorlamp: { label: "Floor lamp", lm: 1100, mount: "floor" },
    tablelamp: { label: "Table lamp", lm: 450, mount: "floor" },
  };
  const KELVIN = [["2700", "#ffcf9e", "Warm white 2700K"], ["3000", "#ffdbb4", "Soft white 3000K"], ["4000", "#fff1e0", "Neutral 4000K"], ["5000", "#fff9f5", "Daylight 5000K"], ["6500", "#f2f5ff", "Cool 6500K"]];

  /* ---------------- small 2D maths */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1], crs = (a, b) => a[0] * b[1] - a[1] * b[0], len = (a) => Math.hypot(a[0], a[1]);
  const norm = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l] : [1, 0]; };
  const left = (u) => [-u[1], u[0]];
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  function area2(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function segDistPoly(p, P) { let d = Infinity; P.forEach((a, i) => { d = Math.min(d, segDist(p, a, P[(i + 1) % P.length]).d); }); return d; }
  function inPoly(p, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
    return c;
  }
  function lineX(p, u, q, w) { const d = crs(u, w); if (Math.abs(d) < 1e-9) return null; const t = crs(sub(q, p), w) / d; return add(p, mul(u, t)); }
  function segDist(p, a, b) { const ab = sub(b, a), L = dot(ab, ab); let t = L ? dot(sub(p, a), ab) / L : 0; t = Math.max(0, Math.min(1, t)); return { d: len(sub(p, add(a, mul(ab, t)))), t, along: t * Math.sqrt(L) }; }
  const hex = (c, d) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : typeof c === "string" && /^(mat:[a-z_]{2,24}|tex:[a-z0-9_]{1,24})$/.test(c) ? c : d);   // 2.651.0: + "tex:<id>" - a picture (A.tex)
  /* 2.651.0 (Tim: "can we add material tools to sketcher, so wall_1 interior, wall_1 exterior, windows, etc, and use reference
     images for the texture, background etc."): the model's PICTURE MATERIALS A.tex [{id, name, src, size (m a repeat), rot (°),
     avg (its average colour)}] - src a project image (/passets/images/<name>) - and its BACKGROUND A.bg {kind: "backdrop" |
     "sky", src, name, rot (°, the sky turned)} */
  const okSrc = (s) => typeof s === "string" && (/^\/passets\/images\/[^?#]{1,240}$/.test(s) || (/^data:image\/(png|jpeg|webp);base64,/.test(s) && s.length < 4e6));
  function cleanTex(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).map((t) => {
      if (!t || typeof t !== "object" || !/^[a-z0-9_]{1,24}$/.test(String(t.id)) || seen.has(String(t.id)) || !okSrc(t.src)) return null; seen.add(String(t.id));
      return { id: String(t.id), name: String(t.name || "Picture").slice(0, 80), src: t.src, size: num(t.size, 1, 0.05, 100), rot: num(t.rot, 0, -360, 360), avg: /^#[0-9a-f]{6}$/i.test(t.avg) ? t.avg.toLowerCase() : "#999999" };
    }).filter(Boolean).slice(0, 200);
  }
  function cleanBg(b) {
    if (!b || typeof b !== "object" || !["backdrop", "sky"].includes(b.kind) || !okSrc(b.src)) return null;
    return { kind: b.kind, src: b.src, name: String(b.name || "Background").slice(0, 80), rot: num(b.rot, 0, -360, 360) };
  }
  const num = (x, d, lo, hi) => { x = +x; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const pt2 = (p) => (Array.isArray(p) && p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1]) ? [+p[0], +p[1]] : null);
  const ring = (P) => { const R = P.map((p) => [p[0], p[1]]); R.push([P[0][0], P[0][1]]); return R; };

  /* ---------------- the data */
  /** 2.667.0: construction - planes {id, name, p, n (unit), size, hidden} and lines {id, name, a, b (two points it runs
   *  through - drawn far past them), hidden} */
  function cleanCons(c) {
    const v3 = (q) => (Array.isArray(q) && q.length >= 3 && q.slice(0, 3).every((x) => Number.isFinite(+x)) ? [+q[0], +q[1], +q[2]] : null);
    const o = c && typeof c === "object" ? c : {}, idOf = (x) => (Number.isInteger(+x) && +x > 0 ? +x : 0);
    const planes = (Array.isArray(o.planes) ? o.planes : []).map((P0) => {
      if (!P0) return null; const p = v3(P0.p), n0 = v3(P0.n); if (!p || !n0) return null; const L = Math.hypot(n0[0], n0[1], n0[2]); if (!(L > 1e-6)) return null;
      return { id: idOf(P0.id), name: String(P0.name || "Plane").slice(0, 60), p, n: n0.map((x) => x / L), size: num(P0.size, 2, 0.2, 100), hidden: !!P0.hidden };
    }).filter(Boolean).slice(0, 500);
    const lines = (Array.isArray(o.lines) ? o.lines : []).map((L0) => {
      if (!L0) return null; const a = v3(L0.a), b = v3(L0.b); if (!a || !b || Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-6) return null;
      return { id: idOf(L0.id), name: String(L0.name || "Construction line").slice(0, 60), a, b, hidden: !!L0.hidden };
    }).filter(Boolean).slice(0, 2000);
    return { planes, lines };
  }
  /** 2.667.0: names given in the objects panel to rows that have none of their own (walls, floors, roofs, lights …): {key: name} */
  function cleanLabels(o) {
    const out = {}; if (!o || typeof o !== "object") return out;
    Object.keys(o).slice(0, 5000).forEach((k) => { const v = String(o[k] == null ? "" : o[k]).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, 60); if (v && /^[a-z]+:\d+(:[a-z]+(:\d+)?)?$/.test(k)) out[k] = v; });
    return out;
  }
  function empty() { return { n: 1, ext: DEF.ext, rooms: [], ops: [], roofs: [], slabs: [], stairs: [], lights: [], items: [], cams: [], hide: [], groups: [], profiles: [], terrain: null, pools: [], drives: [], wtypes: [], cons: { planes: [], lines: [] }, labels: {} }; }   // 2.667.0: + construction planes / lines, the names given in the objects panel   // 2.653.0: + the ground (ppterrain.js)
  function of(M) { if (!M.arch) M.arch = empty(); return M.arch; }
  const has = (A) => !!(A && (A.rooms.length || A.slabs.length || A.stairs.length || A.lights.length || A.roofs.length || (A.items || []).length || (A.cams || []).length || A.terrain || (A.pools || []).length || (A.drives || []).length));   // 2.653.0: a model of only ground has something too
  function clean(o) {
    const A = empty(); if (!o || typeof o !== "object") return A;
    A.ext = hex(o.ext, DEF.ext);
    const id = (x) => (Number.isInteger(+x) && +x > 0 ? +x : 0);
    const WT = root.PPWallType;                                       // 2.661.0: the wall types (ppwalltype.js) - before the rooms that use them
    A.wtypes = WT ? WT.cleanTypes(o.wtypes) : [];
    const wtIds = new Set(WT ? WT.list(A).map((T) => T.id) : []);
    A.rooms = (Array.isArray(o.rooms) ? o.rooms : []).map((R) => {
      if (!R || !Array.isArray(R.pts)) return null;
      const closed = R.closed !== false, pts = R.pts.map(pt2).filter(Boolean);
      if (pts.length < (closed ? 3 : 2)) return null;
      if (closed && area2(pts) < 0) pts.reverse();
      return { id: id(R.id), name: String(R.name || (closed ? "Room" : "Wall")).slice(0, 60), pts, closed, z: num(R.z, 0, -100, 1000), h: num(R.h, DEF.h, 0.1, 50), t: num(R.t, DEF.t, 0.02, 2),
        wall: hex(R.wall, DEF.wall), floor: hex(R.floor, DEF.floor), ceilCol: hex(R.ceilCol, DEF.ceil), floorOn: R.floorOn !== false, ceilOn: R.ceilOn !== false, slab: !!R.slab,
        ceil: R.ceil === "follow" ? "follow" : "flat", tops: cleanTops(R.tops, closed ? pts.length : pts.length - 1),
        // 2.639.0: skirting (at the floor) + cornice (under the ceiling) round the room's inside
        skirtOn: closed && !!R.skirtOn, skirtH: num(R.skirtH, 0.1, 0.02, 0.6), corniceOn: closed && !!R.corniceOn, corniceH: num(R.corniceH, 0.08, 0.02, 0.6), trim: hex(R.trim, DEF.trim),
        // 2.640.0: the profiles they are swept with (ppprofile.js ids - "" = the kind's default), their own colours, one wall's own inside colour
        skirtP: pid(R.skirtP), cornP: pid(R.cornP), skirtCol: hex(R.skirtCol, hex(R.trim, DEF.trim)), cornCol: hex(R.cornCol, hex(R.trim, DEF.trim)), wcol: cleanWcol(R.wcol, closed ? pts.length : pts.length - 1),
        wext: cleanWcol(R.wext, closed ? pts.length : pts.length - 1),   // 2.651.0: each wall's OUTSIDE (none = the building's outside colour A.ext)
        // 2.660.0: the walls taken out (edge numbers - the floor / ceiling stay, the side open) + each wall's interior / exterior (none = auto)
        gone: cleanGone(R.gone, closed ? pts.length : pts.length - 1), wkind: cleanKind(R.wkind, closed ? pts.length : pts.length - 1),
        wt: WT ? WT.cleanWt(R.wt, closed ? pts.length : pts.length - 1, wtIds) : {}, tw: {}, jw: cleanJw(R.jw, pts.length) };   // 2.664.0: jw - a corner's / an end's own size   // 2.661.0: each wall's type (tw: its thickness - sync below)
    }).filter(Boolean);
    if (WT) WT.sync(A);
    const rid = new Set(A.rooms.map((R) => R.id));
    A.ops = (Array.isArray(o.ops) ? o.ops : []).map((x) => {
      if (!x || !OPS[x.kind] || !rid.has(+x.room)) return null;
      if (isGone(A.rooms.find((R) => R.id === +x.room), Math.floor(+x.edge || 0))) return null;     // 2.660.0: its wall taken out
      const d = OPS[x.kind];
      return { id: id(x.id), kind: x.kind, room: +x.room, edge: Math.max(0, Math.floor(+x.edge || 0)), at: num(x.at, 1, -1000, 1000), w: num(x.w, d.w, 0.2, 20), h: num(x.h, d.h, 0.2, 20), sill: num(x.sill, d.sill, 0, 20),
        style: STYLES[x.kind].includes(x.style) ? x.style : d.style, col: hex(x.col, x.kind === "door" ? DEF.door : DEF.frame), flip: !!x.flip,
        open: num(x.open, 0, 0, 100), dir: !!x.dir,               // 2.631.0: how far it is open (%), which way
        frameP: pid(x.frameP), sillP: x.kind === "window" ? pid(x.sillP) : "", trimCol: hex(x.trimCol, DEF.trim), glass: hex(x.glass, DEF.glass) };   // 2.651.0: + its glass; 2.640.0: its frame (architrave) + sill profiles ("" = none)
    }).filter(Boolean);
    A.roofs = (Array.isArray(o.roofs) ? o.roofs : []).map((x) => {
      if (!x) return null; const rooms = (Array.isArray(x.rooms) ? x.rooms : []).map(Number).filter((r) => rid.has(r)); if (!rooms.length) return null;
      return { id: id(x.id), rooms, type: roofType(x.type), pitch: num(x.pitch, 30, 0, 75), over: num(x.over, 0.4, 0, 5), th: num(x.th, 0.15, 0.02, 2), col: hex(x.col, DEF.roof), ridge: ["auto", "u", "v"].includes(x.ridge) ? x.ridge : "auto",
        k: x.k == null || x.k === "" ? null : num(x.k, null, 0.05, 0.95), pitch2: num(x.pitch2, 60, 5, 85), flip: !!x.flip,   // 2.666.0
        eave: EAVES.includes(x.eave) ? x.eave : "plain", fascia: !!x.fascia, fasciaH: num(x.fasciaH, 0.2, 0.05, 0.6), gutter: GUTTERS.includes(x.gutter) ? x.gutter : "none",
        downpipes: x.downpipes !== false, trimCol: hex(x.trimCol, DEF.trim), gutterCol: hex(x.gutterCol, "#d7d4cc") };   // 2.668.0: eaves, fascia, gutters
    }).filter(Boolean);
    A.slabs = (Array.isArray(o.slabs) ? o.slabs : []).map((x) => { if (!x || !Array.isArray(x.pts)) return null; const pts = x.pts.map(pt2).filter(Boolean); if (pts.length < 3) return null; if (area2(pts) < 0) pts.reverse(); return { id: id(x.id), pts, z: num(x.z, 0, -100, 1000), th: num(x.th, 0.2, 0.01, 5), col: hex(x.col, DEF.slab) }; }).filter(Boolean);
    A.stairs = (Array.isArray(o.stairs) ? o.stairs : []).map((x) => (x ? { id: id(x.id), x: num(x.x, 0, -1e5, 1e5), y: num(x.y, 0, -1e5, 1e5), ang: num(x.ang, 0, -720, 720), w: num(x.w, 1, 0.3, 10), len: num(x.len, 3.6, 0.3, 50), rise: num(x.rise, 2.7, 0.1, 20), z: num(x.z, 0, -100, 1000), col: hex(x.col, DEF.stair) } : null)).filter(Boolean);
    A.lights = (Array.isArray(o.lights) ? o.lights : []).map((x) => {
      if (!x || !LIGHTS[x.type]) return null; const d = LIGHTS[x.type];
      return { id: id(x.id), type: x.type, x: num(x.x, 0, -1e5, 1e5), y: num(x.y, 0, -1e5, 1e5), z: num(x.z, 2.7, -100, 1000), room: rid.has(+x.room) ? +x.room : null, col: hex(x.col, KELVIN[0][1]),
        lm: num(x.lm, d.lm, 0, 100000), on: x.on !== false, drop: num(x.drop, d.drop || 0.6, 0.05, 10), ang: num(x.ang, d.ang || 40, 5, 85), dir: num(x.dir, 0, -720, 720) };
    }).filter(Boolean);
    // 2.628.0: the 🛋 furniture (ext/pushpulldock/ppfurn.js - the House builder's library)
    A.items = root.PPFurn ? root.PPFurn.clean(o.items) : (Array.isArray(o.items) ? o.items.filter((x) => x && typeof x.type === "string") : []);
    A.items.forEach((x) => { x.id = id(x.id); });
    A.cams = root.PPCam ? root.PPCam.clean(o.cams) : [];                 // 2.629.0: 📷 the cameras (ppcam.js)
    A.cams.forEach((x) => { x.id = id(x.id); });
    // 2.639.0: the 🗂 outline docker's hidden things (keys - ppoutline.js) + the room groups
    A.hide = [...new Set((Array.isArray(o.hide) ? o.hide : []).filter((k) => typeof k === "string" && /^[a-z]+:\d+(:[a-z]+(:\d+)?)?$/.test(k)))].slice(0, 5000);
    A.groups = (Array.isArray(o.groups) ? o.groups : []).map((g) => (g && typeof g === "object" ? { id: id(g.id), name: String(g.name || "Group").slice(0, 60), rooms: [...new Set((Array.isArray(g.rooms) ? g.rooms : []).map(Number).filter((r) => rid.has(r)))], hidden: !!g.hidden, open: g.open !== false } : null)).filter(Boolean);
    A.profiles = root.PPProfile ? root.PPProfile.cleanList(o.profiles) : (Array.isArray(o.profiles) ? o.profiles : []);   // 2.640.0: the profiles the model uses
    A.tex = cleanTex(o.tex); A.bg = cleanBg(o.bg);
    // 2.653.0 (Tim: "terrain elevation tools like contour lines and shape the ground to match the contours"): ⛰ the ground (ppterrain.js)
    A.terrain = root.PPTerrain ? root.PPTerrain.clean(o.terrain) : (o.terrain && typeof o.terrain === "object" ? JSON.parse(JSON.stringify(o.terrain)) : null);
    A.pools = root.PPSite ? root.PPSite.clean(o.pools) : (Array.isArray(o.pools) ? JSON.parse(JSON.stringify(o.pools)) : []);
    A.drives = root.PPSite ? root.PPSite.cleanDrives(o.drives) : (Array.isArray(o.drives) ? JSON.parse(JSON.stringify(o.drives)) : []);   // 2.659.0: 🛣 driveways   // 2.657.0: 🏊 pools (ppsite.js)                       // 2.651.0: the picture materials + the background
    // 2.667.0 (Tim: "add construction to the objects panel as a heading, planes and construction lines will live in that dropdown
    // ... user can rename anything in the objects panel"): construction planes / lines + the names given to rows
    A.cons = cleanCons(o.cons); A.labels = cleanLabels(o.labels);
    // ids: kept unique, the counter past them all
    let mx = +o.n || 1; const seen = new Set();
    const all = [].concat(A.rooms, A.ops, A.roofs, A.slabs, A.stairs, A.lights, A.items, A.cams, A.groups, A.pools, A.drives, A.cons.planes, A.cons.lines);
    all.forEach((x) => { mx = Math.max(mx, x.id + 1); });
    all.forEach((x) => { if (!x.id || seen.has(x.id)) x.id = mx++; seen.add(x.id); });
    A.n = mx;
    return A;
  }
  const pid = (x) => (typeof x === "string" && /^(preset:)?[a-z0-9_-]{1,40}$/.test(x) ? x : "");
  /** 2.640.0: one wall's own inside colour {edge: colour} */
  /** 2.664.0: {point: {w (across, m), l (past the end, m)}} - an end piece / a corner made wider (a pier) */
  function cleanJw(o, nPts) { const out = {}; if (o && typeof o === "object") Object.keys(o).forEach((k) => { const i = +k, x = o[k]; if (!Number.isInteger(i) || i < 0 || i >= nPts || !x || typeof x !== "object") return; const q = {}; if (+x.w > 0) q.w = Math.min(5, Math.max(0.02, +x.w)); if (x.l != null && Number.isFinite(+x.l)) q.l = Math.min(5, Math.max(0, +x.l)); if (Object.keys(q).length) out[i] = q; }); return out; }
  /** 2.660.0: the walls a room has had taken out - [edge ...] sorted, each once */
  function cleanGone(o, nEdges) { return Array.isArray(o) ? [...new Set(o.map((x) => +x).filter((i) => Number.isInteger(i) && i >= 0 && i < nEdges))].sort((a, b) => a - b) : []; }
  /** 2.660.0: {edge: "int" | "ext"} - a wall set to interior / exterior by hand (the rest: auto, wallKind) */
  function cleanKind(o, nEdges) { const out = {}; if (o && typeof o === "object") Object.keys(o).forEach((k) => { const i = +k; if (Number.isInteger(i) && i >= 0 && i < nEdges && (o[k] === "int" || o[k] === "ext")) out[i] = o[k]; }); return out; }
  function cleanWcol(o, nEdges) { const out = {}; if (o && typeof o === "object") Object.keys(o).forEach((k) => { const i = +k, c = hex(o[k], null); if (Number.isInteger(i) && i >= 0 && i < nEdges && c) out[i] = c; }); return out; }
  /** 2.624.0: the wall tops, checked - {edge: [[t, h] ...]} sorted, the two ends there, a flat one dropped */
  function cleanTops(o, nEdges) {
    const out = {};
    if (!o || typeof o !== "object") return out;
    Object.keys(o).forEach((k) => {
      const i = +k; if (!Number.isInteger(i) || i < 0 || i >= nEdges || !Array.isArray(o[k])) return;
      const P = o[k].filter((p) => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1])).map((p) => [Math.min(1, Math.max(0, +p[0])), Math.min(50, Math.max(0.05, +p[1]))]).sort((a, b) => a[0] - b[0]);
      const Q = []; P.forEach((p) => { if (!Q.length || p[0] - Q[Q.length - 1][0] > 1e-4) Q.push(p); });
      if (Q.length < 2 || Q[0][0] > 1e-6 || Q[Q.length - 1][0] < 1 - 1e-6) return;
      out[i] = Q;
    });
    return out;
  }
  const nid = (A) => A.n++;
  const room = (A, id) => A.rooms.find((R) => R.id === id) || null;
  const find = (A, ak, id) => { const L = { room: A.rooms, op: A.ops, roof: A.roofs, slab: A.slabs, stair: A.stairs, light: A.lights, item: A.items, cam: A.cams, pool: A.pools, drive: A.drives }[ak]; return L ? L.find((x) => x.id === id) || null : null; };

  /* ---------------- rooms, walls */
  function addRoom(A, pts, o) {
    const p = pts.map(pt2).filter(Boolean), closed = !(o && o.closed === false);
    if (p.length < (closed ? 3 : 2)) return null;
    if (closed && Math.abs(area2(p)) < 0.01) return null;
    if (closed && area2(p) < 0) p.reverse();
    const n = A.rooms.filter((R) => R.closed === closed).length + 1;
    const R = Object.assign({ id: nid(A), name: closed ? "Room " + n : "Wall " + n, pts: p, closed, z: 0, h: DEF.h, t: DEF.t, wall: DEF.wall, floor: DEF.floor, ceilCol: DEF.ceil, floorOn: true, ceilOn: true, ceil: "flat",
      skirtOn: closed, skirtH: 0.1, corniceOn: closed, corniceH: 0.08, trim: DEF.trim, skirtP: "", cornP: "", skirtCol: DEF.trim, cornCol: DEF.trim, wcol: {}, wext: {}, gone: [], wkind: {}, jw: {} }, o || {}, { pts: p, closed });   // 2.639.0: a new room comes with skirting + cornice
    A.rooms.push(R); return R;
  }
  function rectPts(a, b) { const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]); return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  function edgesOf(R) {
    const P = R.pts, n = P.length, out = [];
    for (let i = 0; i < (R.closed ? n : n - 1); i++) { const a = P[i], b = P[(i + 1) % n], L = len(sub(b, a)); out.push({ i, a, b, L, u: norm(sub(b, a)) }); }
    return out;
  }
  /** each edge's wall as a mitred quad [left start, left end, right end, right start] (left = inside for a counter-clockwise room) */
  const isGone = (R, i) => !!(R && R.gone && R.gone.length && R.gone.indexOf(i) !== -1);   // 2.660.0
  /** 2.661.0: one wall's thickness - its wall type's layers (R.tw, kept by clean / PPWallType.sync) else the room's */
  const tw = (R, i) => (R && R.tw && R.tw[i] > 0 ? R.tw[i] : R.t);
  /** 2.662.0 (Tim: "end walls in a square not a triangle"): each wall a rectangle from its corner to its corner - its ends
      square; the corners filled by joints (below) - the walls together the same shape as the mitred ones */
  function wallQuads(R) {
    return edgesOf(R).map((e) => {
      if (e.L < EPS || isGone(R, e.i)) return null;
      const nl = left(e.u), h = tw(R, e.i) / 2;
      return Object.assign({}, e, { nl, quad: [add(e.a, mul(nl, h)), add(e.b, mul(nl, h)), add(e.b, mul(nl, -h)), add(e.a, mul(nl, -h))] });
    }).filter(Boolean);
  }
  /** 2.662.0: the corners / ends of a room's walls - each a piece of its own [{k (the corner's point number), v, poly, walls
      [edge ...], kind "corner" | "end", out (an end: the way it faces)}]: a corner = the hull of the two walls' square ends and
      their mitre points (the true corner), an end (an open wall's, beside a wall taken out / hidden) = a square cap past it.
      skip(i): that wall not there (hidden) */
  function joints(R, skip) {
    const E = edgesOf(R), n = E.length, P = R.pts, out = [], has = (e) => !!(e && e.L > EPS && !isGone(R, e.i) && !(skip && skip(e.i)));
    for (let k = 0; k < P.length; k++) {
      const v = P[k], e0 = R.closed ? E[(k - 1 + n) % n] : E[k - 1], e1 = E[k] || null;
      const a0 = has(e0) ? e0 : null, a1 = has(e1) ? e1 : null;
      if (a0 && a1) {
        const h0 = tw(R, a0.i) / 2, h1 = tw(R, a1.i) / 2, n0 = left(a0.u), n1 = left(a1.u);
        if (Math.abs(crs(a0.u, a1.u)) < 1e-6 && dot(a0.u, a1.u) > 0 && Math.abs(h0 - h1) < 1e-9) continue;     // straight on, as thick: nothing to fill
        const pts = [add(v, mul(n0, h0)), add(v, mul(n0, -h0)), add(v, mul(n1, h1)), add(v, mul(n1, -h1))];
        [1, -1].forEach((sg) => { const x = lineX(add(a0.a, mul(n0, sg * h0)), a0.u, add(a1.a, mul(n1, sg * h1)), a1.u); if (x && len(sub(x, v)) <= 6 * Math.max(h0, h1) + 1e-9) pts.push(x); });
        const jw = R.jw && R.jw[k];
        if (jw && jw.w) { const s2 = jw.w / 2; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => pts.push(add(v, add(mul(a0.u, a * s2), mul(n0, b * s2))))); }   // 2.664.0: a pier this wide round the corner
        const poly = hull2(pts); if (poly.length >= 3 && Math.abs(area2(poly)) > 1e-8) out.push({ k, v, poly, walls: [a0.i, a1.i], kind: "corner", w: jw && jw.w ? jw.w : null });
      } else if (a0 || a1) {
        const e = a0 || a1, o = a0 ? e.u : mul(e.u, -1), nl = left(e.u), t0 = tw(R, e.i), jw = (R.jw && R.jw[k]) || {};
        const W = jw.w || t0, Lp = jw.l != null ? jw.l : t0 / 2, back = W > t0 + 1e-9 ? Math.max(Lp, W / 2) : 0, w2 = W / 2;   // 2.664.0: its own width / length; wider than the wall = a pier round the end
        const s0 = add(v, mul(o, -back)), s1 = add(v, mul(o, Math.max(Lp, 1e-4)));
        out.push({ k, v, poly: [add(s0, mul(nl, w2)), add(s0, mul(nl, -w2)), add(s1, mul(nl, -w2)), add(s1, mul(nl, w2))], walls: [e.i], kind: "end", out: o, w: W, l: Lp, t: t0 });
      }
    }
    return out;
  }
  /** 2.662.0: polygons' rings without the points on a straight run (polygon-clipping keeps them) - closed rings in, closed out */
  function simplifyRings(U) {
    return (U || []).map((poly) => poly.map((rg) => {
      const r = rg.slice(0, -1); if (r.length < 4) return rg;
      let ch = true;
      while (ch && r.length > 3) { ch = false; for (let i = 0; i < r.length; i++) { const a = r[(i - 1 + r.length) % r.length], b = r[i], c = r[(i + 1) % r.length], u = sub(b, a), w = sub(c, b);
        if (len(sub(b, a)) < 1e-9 || (Math.abs(crs(u, w)) < 1e-9 * Math.max(1, len(u) * len(w)) && dot(u, w) > 0)) { r.splice(i, 1); ch = true; break; } } }
      return r.concat([r[0]]);
    }));
  }
  /** a convex hull (2D, counter-clockwise) */
  function hull2(pts) {
    const P2 = pts.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (P2.length < 3) return P2;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    P2.forEach((p) => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); });
    for (let i = P2.length - 1; i >= 0; i--) { const p = P2[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  /** 2.662.0: the joint (a room's corner / a wall's end) at a point (x, y) - and whether the point is in it ONLY (past the walls'
      own rectangles: its outside corner, an end's cap) -> {R, ...joint, only} | null */
  function jointAt(A, p, z) {
    let best = null;
    (A.rooms || []).forEach((R) => {
      if (z != null && (z < R.z - 0.05 || z > R.z + R.h + 3)) return;
      joints(R).forEach((j) => { if (!inPoly([p[0], p[1]], j.poly)) return; const only = !wallQuads(R).some((q) => inPoly([p[0], p[1]], q.quad)); if (!best || (only && !best.only)) best = Object.assign({ R, only }, j); });
    });
    return best;
  }
  /** the walls as mitred quads (their corners meeting on the bisector) - the roofs / follow ceilings / layer seams use them */
  function mitreQuads(R) {
    const E = edgesOf(R), n = E.length, G = (e) => (e && isGone(R, e.i) ? null : e), hw = (e) => tw(R, e.i) / 2;
    const corner = (e0, e1, s, at, own) => {   // the corner of side s (1 left / -1 right) between e0 and e1, at the vertex at (own: the wall it is for)
      const h0 = hw(e0), h1 = hw(e1), o = own || e1, perp = add(at, mul(left(o.u), s * hw(o)));
      if (e0.L < EPS || e1.L < EPS) return perp;
      const x = lineX(add(e0.a, mul(left(e0.u), s * h0)), e0.u, add(e1.a, mul(left(e1.u), s * h1)), e1.u);
      if (!x || len(sub(x, at)) > 6 * Math.max(h0, h1) + 1e-9) return perp;          // parallel / too sharp: square
      return x;
    };
    const cornerE = (e, next, s) => corner(e, next, s, e.b, e);
    return E.map((e, k) => {
      if (e.L < EPS || isGone(R, e.i)) return null;                   // 2.660.0: a wall taken out - none (the ones beside it end square)
      const prev = G(R.closed ? E[(k - 1 + n) % n] : E[k - 1]), next = G(R.closed ? E[(k + 1) % n] : E[k + 1]);
      const nl = left(e.u), h = hw(e);
      const lS = prev ? corner(prev, e, 1, e.a, e) : add(e.a, mul(nl, h)), rS = prev ? corner(prev, e, -1, e.a, e) : add(e.a, mul(nl, -h));
      const lE = next ? cornerE(e, next, 1) : add(e.b, mul(nl, h)), rE = next ? cornerE(e, next, -1) : add(e.b, mul(nl, -h));
      return Object.assign({}, e, { nl, quad: [lS, lE, rE, rS] });
    }).filter(Boolean);
  }
  /** the room's inside (the floor / ceiling): its centre line moved in by half the wall */
  /** 2.631.0: the room's outside outline (the centre line moved out half a wall) - its auto floor slab */
  function exterior(R) {
    if (!R.closed) return null;
    const E = edgesOf(R).filter((e) => e.L > EPS), n = E.length, h = -R.t / 2, out = [], hh = (e) => -tw(R, e.i) / 2;   // 2.661.0: each wall's own
    for (let k = 0; k < n; k++) {
      const e0 = E[(k - 1 + n) % n], e1 = E[k], h0 = hh(e0), h1 = hh(e1);
      const x = lineX(add(e0.a, mul(left(e0.u), h0)), e0.u, add(e1.a, mul(left(e1.u), h1)), e1.u);
      out.push(x && len(sub(x, e1.a)) < 6 * -Math.min(h, h0, h1) + 1e-9 ? x : add(e1.a, mul(left(e1.u), h1)));
    }
    return out;
  }
  function interior(R) {
    if (!R.closed) return null;
    const E = edgesOf(R).filter((e) => e.L > EPS), n = E.length, h = R.t / 2, out = [], hh = (e) => (isGone(R, e.i) ? 0 : tw(R, e.i) / 2);   // 2.660.0: an open side - to the line; 2.661.0: each wall's own
    for (let k = 0; k < n; k++) {
      const e0 = E[(k - 1 + n) % n], e1 = E[k], h0 = hh(e0), h1 = hh(e1);
      const x = lineX(add(e0.a, mul(left(e0.u), h0)), e0.u, add(e1.a, mul(left(e1.u), h1)), e1.u);
      out.push(x && len(sub(x, e1.a)) < 6 * Math.max(h, h0, h1) + 1e-9 ? x : add(e1.a, mul(left(e1.u), h1)));
    }
    return out;
  }
  /* ---------------- 2.624.0: the wall tops */
  function profile(R, i) { const P = R.tops && R.tops[i]; return P && P.length >= 2 ? P : [[0, R.h], [1, R.h]]; }
  function topAt(R, i, t) {
    const P = profile(R, i);
    if (t <= P[0][0]) return P[0][1] + (P.length > 1 && t < 0 ? (P[1][1] - P[0][1]) / Math.max(1e-6, P[1][0] - P[0][0]) * t : 0);
    for (let k = 0; k + 1 < P.length; k++) { const a = P[k], b = P[k + 1]; if (t <= b[0] + 1e-12) return a[1] + (b[1] - a[1]) * (t - a[0]) / Math.max(1e-9, b[0] - a[0]); }
    const a = P[P.length - 2], b = P[P.length - 1];
    return b[1] + (b[1] - a[1]) / Math.max(1e-6, b[0] - a[0]) * (t - b[0]);
  }
  const flatTop = (R, i) => profile(R, i).every((p) => Math.abs(p[1] - R.h) < 1e-6) ;
  const minTop = (R, i) => Math.min(...profile(R, i).map((p) => p[1]));
  function putProfile(R, i, P) { if (!R.tops) R.tops = {}; const Q = cleanTops({ [i]: P }, 1e9)[i]; if (!Q || (Q.length === 2 && Q.every((p) => Math.abs(p[1] - R.h) < 1e-6))) delete R.tops[i]; else R.tops[i] = Q; }
  /** the wall beside an end of edge i (i's start = the previous edge's end) -> [edge, end 0 | 1] | null */
  function besideEnd(R, i, end) { const n = R.closed ? R.pts.length : R.pts.length - 1; if (end === 0) { const j = i - 1; return j >= 0 ? [j, 1] : R.closed ? [n - 1, 1] : null; } const j = i + 1; return j < n ? [j, 0] : R.closed ? [0, 0] : null; }
  function setEnd(R, i, end, h) { const P = profile(R, i).map((p) => p.slice()); P[end === 0 ? 0 : P.length - 1][1] = h; putProfile(R, i, P); }
  /** a cut in the top of wall i at t (where it was double-clicked) -> the point's index */
  function cutTop(A, id, i, t) {
    const R = room(A, id); if (!R) return -1;
    const e = edgesOf(R)[i]; if (!e) return -1;
    const tt = Math.min(1 - 0.02 / Math.max(e.L, 0.05), Math.max(0.02 / Math.max(e.L, 0.05), t));
    const P = profile(R, i).map((p) => p.slice());
    const near = P.findIndex((p) => Math.abs(p[0] - tt) * e.L < 0.03); if (near >= 0) return near;
    P.push([tt, topAt(R, i, tt)]); P.sort((a, b) => a[0] - b[0]);
    if (!R.tops) R.tops = {}; R.tops[i] = P;           // kept even while flat (the cut is there to be dragged)
    return P.findIndex((p) => p[0] === tt);
  }
  function moveTopPoint(A, id, i, k, h) {
    const R = room(A, id); if (!R) return false;
    const P = profile(R, i).map((p) => p.slice()); if (!P[k]) return false;
    const hh = Math.min(50, Math.max(0.05, h)); P[k][1] = hh;
    if (!R.tops) R.tops = {}; R.tops[i] = P;
    if (k === 0 || k === P.length - 1) { const b = besideEnd(R, i, k === 0 ? 0 : 1); if (b) setEnd(R, b[0], b[1], hh); }
    return true;
  }
  function moveTopSeg(A, id, i, k, dh, base) {
    const R = room(A, id); if (!R) return false;
    const P = (base || profile(R, i)).map((p) => p.slice()); if (!P[k] || !P[k + 1]) return false;
    moveTopPoint(A, id, i, k, P[k][1] + dh); moveTopPoint(A, id, i, k + 1, P[k + 1][1] + dh);
    return true;
  }
  /** Delete on a cut: it goes (an end goes back to the room's height, the wall beside it too) */
  function removeTopPoint(A, id, i, k) {
    const R = room(A, id); if (!R) return false;
    const P = profile(R, i).map((p) => p.slice()); if (!P[k]) return false;
    if (k === 0 || k === P.length - 1) { moveTopPoint(A, id, i, k, R.h); putProfile(R, i, profile(R, i)); return true; }
    P.splice(k, 1); putProfile(R, i, P); return true;
  }
  /** Delete on a top edge: its cuts go (it is one straight top again); an edge from corner to corner goes flat */
  function removeTopSeg(A, id, i, k) {
    const R = room(A, id); if (!R) return false;
    const P = profile(R, i).map((p) => p.slice()); if (!P[k] || !P[k + 1]) return false;
    const inner = [k, k + 1].filter((x) => x > 0 && x < P.length - 1);
    if (inner.length) { const Q = P.filter((_, x) => !inner.includes(x)); putProfile(R, i, Q); return true; }
    moveTopPoint(A, id, i, 0, R.h); moveTopPoint(A, id, i, P.length - 1, R.h); putProfile(R, i, profile(R, i)); return true;
  }
  /** where a point on a wall (plan + z) is on its top: {room, edge, t, s, h (its top there), k (a cut / end within tol), seg} */
  function topHit(A, p, z, tol) {
    const w = nearestWall(A, p, 0.6, null); if (!w) return null;
    const R = w.R, e = w.e, t = Math.max(0, Math.min(1, w.at / e.L)), h = R.z + topAt(R, w.edge, t);
    if (Math.abs(z - h) > Math.max(tol, 0.04)) return null;
    const P = profile(R, w.edge);
    let k = -1, best = Infinity; P.forEach((q, x) => { const d = Math.abs(q[0] - t) * e.L; if (d < tol && d < best) { best = d; k = x; } });
    let seg = 0; for (let x = 0; x + 1 < P.length; x++) if (t >= P[x][0] - 1e-9 && t <= P[x + 1][0] + 1e-9) { seg = x; break; }
    return { room: R.id, edge: w.edge, t, s: w.at, h, k, seg, R, e };
  }
  /** the 3D points of a wall's top (its centre line) - for the outline of what is picked */
  function topPoints(A, id, i) {
    const R = room(A, id); if (!R) return [];
    const e = edgesOf(R)[i]; if (!e) return [];
    return profile(R, i).map(([t, h]) => [e.a[0] + (e.b[0] - e.a[0]) * t, e.a[1] + (e.b[1] - e.a[1]) * t, R.z + h]);
  }
  /** a wall's piece above its lowest top, following its profile (the bands stand to the lowest top) */
  function upperPiece(R, q, out, ext) {
    const P = profile(R, q.i), z0 = R.z + minTop(R, q.i), [lS, lE, rE, rS] = q.quad, tag = { ak: "wall", room: R.closed ? R.id : null, edge: q.i, part: "top" };
    const at = (A2, B2, t, h) => [A2[0] + (B2[0] - A2[0]) * t, A2[1] + (B2[1] - A2[1]) * t, R.z + h];
    const IN = P.map(([t, h]) => at(lS, lE, t, h)), OUT = P.map(([t, h]) => at(rS, rE, t, h));
    const inCol = R.closed ? R.wall : ext, nl = q.nl, n = P.length;
    const base = (A2) => [A2[0], A2[1], z0];
    out.polys.push({ rings: [[base(lS)].concat(IN, [base(lE)])], n: [nl[0], nl[1], 0], col: inCol, tag, layer: "main" });
    out.polys.push({ rings: [[base(rS)].concat(OUT, [base(rE)])], n: [-nl[0], -nl[1], 0], col: ext, tag, layer: "main" });
    for (let k = 0; k + 1 < n; k++) {
      const a = IN[k], b = IN[k + 1], c = OUT[k + 1], d = OUT[k], du = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dv = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      let nn = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]]; if (nn[2] < 0) nn = nn.map((x) => -x);
      out.polys.push({ rings: [[a, b, c, d]], n: nn, col: DEF.top, tag, layer: "main" });
      out.lines.push([a, b], [d, c]);
    }
    [[0, lS, rS, [-q.u[0], -q.u[1], 0]], [n - 1, lE, rE, [q.u[0], q.u[1], 0]]].forEach(([k, L1, R1, nn]) => {
      if (P[k][1] + R.z <= z0 + 1e-6) return;
      out.polys.push({ rings: [[base(L1), base(R1), OUT[k], IN[k]]], n: nn, col: ext, tag, layer: "main" });
    });
    P.forEach((_, k) => { out.lines.push([IN[k], OUT[k]]); if (IN[k][2] > z0 + 1e-6) out.lines.push([base(k === 0 ? lS : k === n - 1 ? lE : IN[k]), IN[k]], [base(k === 0 ? rS : k === n - 1 ? rE : OUT[k]), OUT[k]]); });
    return { quad: q.quad, z: z0 };
  }
  /** 2.624.0: the surface between a rectangle room's two opposite walls' tops (inner faces for a ceiling, outer + eaves for a
      roof) -> rows of points [[p3 ...] per t] across [A_ext?, A, C, C_ext?] | null (not a rectangle) */
  function followGrid(R, outer, eaves) {
    if (!R.closed || R.pts.length !== 4) return null;
    const Q = mitreQuads(R); if (Q.length !== 4) return null;
    const sloped = (i) => !flatTop(R, i) || !flatTop(R, (i + 2) % 4);
    const a = sloped(0) || !sloped(1) ? 0 : 1, c = a + 2, qa = Q[a], qc = Q[c];
    const lineA = outer ? [qa.quad[3], qa.quad[2]] : [qa.quad[0], qa.quad[1]], lineC = outer ? [qc.quad[3], qc.quad[2]] : [qc.quad[0], qc.quad[1]];
    const ts = new Set([0, 1]); profile(R, a).forEach((p) => ts.add(r6(p[0]))); profile(R, c).forEach((p) => ts.add(r6(1 - p[0])));
    const e = eaves || 0, La = len(sub(lineA[1], lineA[0])) || 1;
    let T = [...ts].sort((x, y) => x - y); if (e > 0) T = [-e / La].concat(T, [1 + e / La]);
    const at = (L, t) => [L[0][0] + (L[1][0] - L[0][0]) * t, L[0][1] + (L[1][1] - L[0][1]) * t];
    const rows = T.map((t) => {
      const pa = at(lineA, t), pc = at(lineC, 1 - t), za = R.z + topAt(R, a, t), zc = R.z + topAt(R, c, 1 - t);
      const row = [[pa[0], pa[1], za], [pc[0], pc[1], zc]];
      if (e > 0) {
        const dir = norm(sub(pa, pc)), D = len(sub(pa, pc)) || 1, sl = (za - zc) / D;
        row.unshift([pa[0] + dir[0] * e, pa[1] + dir[1] * e, za + sl * e]); row.push([pc[0] - dir[0] * e, pc[1] - dir[1] * e, zc - sl * e]);
      }
      return row;
    });
    return { rows, a, c };
  }
  const tri = (a, b, c, up) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map((x) => x / l); if ((n[2] < 0) === up) n = n.map((x) => -x); return n; };
  function gridPolys(rows, dz, up, col, tag, layer, out, lines) {
    for (let r = 0; r + 1 < rows.length; r++) for (let k = 0; k + 1 < rows[r].length; k++) {
      const a = rows[r][k], b = rows[r + 1][k], c = rows[r + 1][k + 1], d = rows[r][k + 1], sh = (p) => [p[0], p[1], p[2] + dz];
      [[a, b, c], [a, c, d]].forEach((t) => { const tt = t.map(sh); out.polys.push({ rings: [tt], n: tri(tt[0], tt[1], tt[2], up), col, tag, layer }); });
      if (lines) { lines.push([sh(a), sh(b)]); if (r === 0) lines.push([sh(a), sh(d)]); if (r + 2 === rows.length) lines.push([sh(b), sh(c)]); if (k + 2 === rows[r].length) lines.push([sh(d), sh(c)]); }
    }
  }
  /* ---------------- 2.624.0: floors' edges - a wall's outside face onto them */
  function slabEdges(A) {
    const out = [];
    A.slabs.forEach((sl) => sl.pts.forEach((a, i) => { const b = sl.pts[(i + 1) % sl.pts.length], u = norm(sub(b, a)); if (len(sub(b, a)) > EPS) out.push({ a, b, u, n: left(u), slab: sl.id, z: sl.z }); }));
    return out;
  }
  /** a wall's outside-face line (closed room: the right side; a free wall: both) for edge e of R moved by d */
  function faceLines(R, e, d) { const nl = left(e.u), h = tw(R, e.i) / 2, a = add(e.a, d); return (R.closed ? [-1] : [-1, 1]).map((sg) => ({ p: add(a, mul(nl, sg * h)), sg })); }
  /** rooms ids moved by d: a wall's outside face within tol of a floor edge's line (`off` in from it) is put there */
  function snapToFloor(A, ids, d, tol, off, only) {
    const E = slabEdges(A); if (!E.length) return { d, hit: null };
    let best = null;
    A.rooms.forEach((R) => { if (!ids.includes(R.id)) return; edgesOf(R).forEach((e) => {
      if (e.L < EPS || (only != null && e.i !== only)) return;
      faceLines(R, e, d).forEach((f) => E.forEach((s) => {
        if (Math.abs(crs(e.u, s.u)) > 0.02) return;
        const dist = dot(sub(f.p, s.a), s.n), want = off || 0, diff = want - dist;
        if (Math.abs(diff) > tol) return;
        const s0 = dot(add(e.a, d), s.u), s1 = dot(add(e.b, d), s.u), t0 = dot(s.a, s.u), t1 = dot(s.b, s.u);
        if (Math.min(Math.max(s0, s1), Math.max(t0, t1)) - Math.max(Math.min(s0, s1), Math.min(t0, t1)) < -tol) return;
        if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { diff, s, room: R.id, edge: e.i };
      }));
    }); });
    if (!best) return { d, hit: null };
    return { d: add(d, mul(best.s.n, best.diff)), hit: { slab: best.s.slab, a: best.s.a, b: best.s.b, n: best.s.n, room: best.room, edge: best.edge } };
  }
  /** a wall drawn along a floor's edge: moved in so its outside face is `off` from that edge -> {pts, moved} */
  function offsetOnFloor(A, pts, closed, t, off) {
    const E = slabEdges(A), n = pts.length, segs = closed ? n : n - 1, sh = [];
    let moved = 0;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n], u = norm(sub(b, a));
      const s = E.find((x) => Math.abs(crs(u, x.u)) < 0.02 && segDist(a, x.a, x.b).d < 1e-3 && segDist(b, x.a, x.b).d < 1e-3);
      sh.push(s ? mul(s.n, (off || 0) + t / 2) : [0, 0]); if (s) moved++;
    }
    if (!moved) return { pts: pts.map((p) => [p[0], p[1]]), moved: 0 };
    const L = (i) => { const a = pts[i], b = pts[(i + 1) % n]; return { p: add(a, sh[i]), u: norm(sub(b, a)) }; };
    const out = pts.map((p, j) => {
      const prev = j - 1 >= 0 ? j - 1 : closed ? segs - 1 : -1, next = j < segs ? j : -1;
      if (prev < 0) return add(p, sh[next]); if (next < 0) return add(p, sh[prev]);
      const l0 = L(prev), l1 = L(next), x = lineX(l0.p, l0.u, l1.p, l1.u);
      return x || add(p, sh[next]);
    });
    return { pts: out.map((p) => [r6(p[0]), r6(p[1])]), moved };
  }
  /** one wall of a room moved out (+) / in (-) by dist, square to itself - the room stretches */
  function moveEdge(A, id, i, dist) {
    const R = room(A, id); if (!R) return false;
    const e = edgesOf(R)[i]; if (!e) return false;
    const m = mul(left(e.u), -dist), n = R.pts.length;          // + = out (the right side of a counter-clockwise room)
    R.pts[i] = add(R.pts[i], m); R.pts[(i + 1) % n] = add(R.pts[(i + 1) % n], m);
    return true;
  }
  /** 2.639.0 (Alt+drag a wall): its line moved freely by v (plan) - the walls on either side stretch / shorten to it */
  function moveEdgeBy(A, id, i, v) {
    const R = room(A, id); if (!R || !v) return false;
    const n = R.pts.length, j = R.closed ? (i + 1) % n : i + 1; if (!R.pts[i] || !R.pts[j]) return false;
    R.pts[i] = add(R.pts[i], v); R.pts[j] = add(R.pts[j], v);
    if (R.closed && area2(R.pts) < 0) { R.pts[i] = sub(R.pts[i], v); R.pts[j] = sub(R.pts[j], v); return false; }     // turned inside out: refused
    return true;
  }
  /** 2.639.0: what the 🗂 outline docker hides -> hid(key): "room:3" (the whole room), "room:3:walls" / "room:3:wall:1",
      "room:3:floor" / ":ceil" / ":skirt" / ":cornice" / ":slab", "op:5", "roof:7", "slab:8", "stair:9", "light:4", "item:6",
      "cam:2"; a hidden group hides its rooms; a room hidden hides its doors / windows (and "room:3:doors" / ":windows") */
  function hiddenOf(A) {
    const S = new Set((A && A.hide) || []);
    ((A && A.groups) || []).forEach((g) => { if (g.hidden) g.rooms.forEach((r) => S.add("room:" + r)); });
    if (!S.size) return () => false;
    const opOf = {}; ((A && A.ops) || []).forEach((o) => { opOf[o.id] = o; });
    return (key) => {
      if (S.has(key)) return true;
      const m = /^room:(\d+):(\w+)(?::(\d+))?$/.exec(key);
      if (m) return S.has("room:" + m[1]) || (m[2] === "wall" && S.has("room:" + m[1] + ":walls"));
      const o = /^op:(\d+)$/.exec(key), op = o && opOf[o[1]];
      if (op) return S.has("room:" + op.room) || S.has("room:" + op.room + ":" + (op.kind === "window" ? "windows" : "doors"));
      return false;
    };
  }
  /** 2.639.0: skirting at the floor + cornice under the ceiling, along the room's inner faces (a door leaves a gap in the skirting)
      2.640.0: each SWEPT with its profile (ppprofile.js) - mitred at the corners, capped at a door; boxes without PPProfile */
  function trims(A, R, out, hid) {
    if (!R.closed || (!R.skirtOn && !R.corniceOn)) return;
    const inn = interior(R); if (!inn) return;
    const E = edgesOf(R).filter((e) => e.L > EPS), n = inn.length, PF = root.PPProfile;
    const skirt = R.skirtOn && !hid("room:" + R.id + ":skirt"), corn = R.corniceOn && !hid("room:" + R.id + ":cornice") && R.ceilOn;
    const gapsOf = (k, e, a, u, L) => A.ops.filter((o) => o.room === R.id && o.edge === e.i && (o.kind === "door" || o.kind === "opening") && o.sill < 0.05).map((o) => {
      const I = opInfo(A, o); if (!I) return null; const c = add(e.a, mul(e.u, I.at)), sC = dot(sub(c, a), u), fw = frameWidth(A, o);    // the frame's width too
      return [Math.max(0, sC - o.w / 2 - fw), Math.min(L, sC + o.w / 2 + fw)];
    }).filter(Boolean).sort((x, y) => x[0] - y[0]);
    if (PF) {
      const tagS = { ak: "room", id: R.id, part: "skirt" }, tagC = { ak: "room", id: R.id, part: "cornice" };
      if (skirt) {
        const sec = PF.fit(PF.resolve(A, R.skirtP, "skirt"), "skirt", R.skirtH), z = R.z;
        const per = []; let S0 = 0; const starts = [];
        for (let k = 0; k < n; k++) { const e = E[k], a = inn[k], b = inn[(k + 1) % n], u = norm(sub(b, a)), L = len(sub(b, a)); starts.push(S0); if (e && isGone(R, e.i)) per.push([S0, S0 + L]); else if (e) gapsOf(k, e, a, u, L).forEach((g) => per.push([S0 + g[0], S0 + g[1]])); S0 += L; }
        chainsBetween(inn, starts, S0, per).forEach((c) => merge(out, PF.sweep(c.pts, c.closed, sec, (q, b) => [q[0], q[1], z + b], R.skirtCol, tagS)));
      }
      if (corn) {
        const sec = PF.fit(PF.resolve(A, R.cornP, "cornice"), "cornice", R.corniceH);
        const tops = E.map((e) => R.z + (flatTop(R, e.i) ? R.h : minTop(R, e.i)) - 0.002);
        if (tops.every((t) => Math.abs(t - tops[0]) < 1e-6) && !E.some((e) => isGone(R, e.i))) merge(out, PF.sweep(inn, true, sec, (q, b) => [q[0], q[1], tops[0] - b], R.cornCol, tagC));
        else for (let k = 0; k < n; k++) if (!(E[k] && isGone(R, E[k].i))) merge(out, PF.sweep([inn[k], inn[(k + 1) % n]], false, sec, (q, b) => [q[0], q[1], tops[k] - b], R.cornCol, tagC));   // walls of different heights: one run each
      }
      return;
    }
    for (let k = 0; k < n; k++) {
      const e = E[k]; if (!e || isGone(R, e.i)) continue;
      const a = inn[k], b = inn[(k + 1) % n], u = norm(sub(b, a)), L = len(sub(b, a)), w = left(u); if (L < 0.02) continue;
      if (skirt) {
        const gaps = gapsOf(k, e, a, u, L);
        let x = 0; const runs = [];
        gaps.forEach((g) => { if (g[0] > x) runs.push([x, Math.min(L, g[0])]); x = Math.max(x, g[1]); });
        if (x < L) runs.push([x, L]);
        runs.forEach(([x0, x1]) => { if (x1 - x0 > 0.01) box(a, u, w, x0, x1, 0, 0.015, R.z, R.z + R.skirtH, R.skirtCol || R.trim, { ak: "room", id: R.id, part: "skirt" }, out, 1, true); });
      }
      if (corn) {
        const top = R.z + (flatTop(R, e.i) ? R.h : minTop(R, e.i)), d = R.corniceH * 0.75;
        box(a, u, w, 0, L, 0, d, top - R.corniceH, top - 0.004, R.cornCol || R.trim, { ak: "room", id: R.id, part: "cornice" }, out, 1, true);
      }
    }
  }
  const merge = (out, r) => { r.polys.forEach((p) => out.polys.push(p)); r.lines.forEach((l) => out.lines.push(l)); };
  /** 2.640.0: a closed loop P (its corners start at perimeter distance starts[k], total T) with gaps [s0, s1] taken out ->
      the pieces left: [{pts, closed}] (no gaps: the whole loop, closed) */
  function chainsBetween(P, starts, T, gaps) {
    const n = P.length;
    if (!gaps.length) return [{ pts: P.map((p) => p.slice()), closed: true }];
    const at = (s) => { s = ((s % T) + T) % T; let k = n - 1; for (let i = 0; i < n; i++) if (starts[i] <= s + 1e-12 && (i === n - 1 || starts[i + 1] > s + 1e-12)) { k = i; break; } const a = P[k], b = P[(k + 1) % n], L = len(sub(b, a)) || 1; return add(a, mul(sub(b, a), (s - starts[k]) / L)); };
    const G = gaps.map((g) => g.slice()).sort((x, y) => x[0] - y[0]), M = [];
    G.forEach((g) => { if (M.length && g[0] <= M[M.length - 1][1] + 1e-9) M[M.length - 1][1] = Math.max(M[M.length - 1][1], g[1]); else M.push(g); });
    const out = [];
    M.forEach((g, i) => {
      const s0 = g[1], s1 = i + 1 < M.length ? M[i + 1][0] : M[0][0] + T;
      if (s1 - s0 < 0.01) return;
      const pts = [at(s0)];
      for (let w = 0; w < 2; w++) for (let k = 0; k < n; k++) { const s = starts[k] + w * T; if (s > s0 + 1e-9 && s < s1 - 1e-9) pts.push(P[k].slice()); }
      pts.push(at(s1));
      out.push({ pts, closed: false });
    });
    return out;
  }
  /** 2.640.0: how far a door / window's frame (architrave) reaches out from its opening (0: none) */
  function frameWidth(A, op) {
    const PF = root.PPProfile; if (!PF || !op.frameP || op.kind === "opening") return 0;
    const p = PF.resolve(A, op.frameP, op.kind === "door" ? "doorframe" : "windowframe"), s = PF.size(p);
    return Math.max(0, s.maxY);
  }
  /** 2.640.0: one wall's colour inside (its own, else the room's) */
  const wallCol = (R, i) => (R.wcol && R.wcol[i]) || R.wall;
  const wallExt = (A, R, i) => (R.wext && R.wext[i]) || A.ext;             // 2.651.0: a wall's outside
  /** 2.651.0: the wall a point (x, y) at height z lies in - {R, i} (the room's wall quads, the closest) | null */
  function wallOwner(A, p, z) {
    const jj = jointAt(A, p, z); if (jj && jj.only) { let bi = jj.walls[0], bd = Infinity; jj.walls.forEach((i) => { const e = edgesOf(jj.R)[i], d = segDist([p[0], p[1]], e.a, e.b).d; if (d < bd) { bd = d; bi = i; } }); return { R: jj.R, i: bi }; }   // 2.662.0: a corner / an end
    let best = null;
    (A.rooms || []).forEach((R) => { if (z != null && (z < R.z - 0.05 || z > R.z + R.h + 3)) return; wallQuads(R).forEach((q) => { if (inPoly([p[0], p[1]], q.quad)) { const e = edgesOf(R)[q.i], d = e ? segDist([p[0], p[1]], e.a, e.b).d : 0; if (!best || d < best.d) best = { R, i: q.i, d }; } }); });
    return best ? { R: best.R, i: best.i } : null;
  }
  /** 2.640.0: one wall's own height (the walls beside it keep theirs) */
  function setWallHeight(A, id, i, h) { const R = room(A, id); if (!R || !edgesOf(R)[i]) return false; putProfile(R, i, [[0, num(h, R.h, 0.05, 50)], [1, num(h, R.h, 0.05, 50)]]); return true; }
  /** 2.640.0: one wall's length - a rectangle room keeps its shape (resized), else the wall's end corner moves along it */
  function setWallLength(A, id, i, L) {
    const R = room(A, id); if (!R) return false;
    const E = edgesOf(R), e = E[i]; L = +L; if (!e || !(L > 0.05)) return false;
    if (R.closed && R.pts.length === 4 && E.every((a, k) => Math.abs(dot(a.u, E[(k + 1) % 4].u)) < 1e-6)) {
      const w = i % 2 === 0 ? L : E[0].L, d = i % 2 === 0 ? E[1].L : L;
      return resizeRect(A, id, w, d);
    }
    const n = R.pts.length, j = R.closed ? (i + 1) % n : i + 1, old = R.pts[j];
    R.pts[j] = [r6(e.a[0] + e.u[0] * L), r6(e.a[1] + e.u[1] * L)];
    if (R.closed && area2(R.pts) <= 0) { R.pts[j] = old; return false; }
    return true;
  }
  /** one wall's line moved by dist: snapped onto a parallel wall of another room / a floor's edge (outside face, off) */
  function snapEdge(A, id, i, dist, tol, off) {
    const R = room(A, id); if (!R) return { dist, hit: null };
    const e = edgesOf(R)[i]; if (!e) return { dist, hit: null };
    const out = mul(left(e.u), -1), a = add(e.a, mul(out, dist));
    let best = null;
    A.rooms.forEach((Q) => { if (Q === R || Math.abs(Q.z - R.z) > 0.01) return; edgesOf(Q).forEach((f) => { if (f.L < EPS || Math.abs(crs(f.u, e.u)) > 0.02) return; const d2 = dot(sub(f.a, a), out); if (Math.abs(d2) < tol && (!best || Math.abs(d2) < Math.abs(best.d))) best = { d: d2, kind: "wall", room: Q.id }; }); });
    slabEdges(A).forEach((s) => { if (Math.abs(crs(s.u, e.u)) > 0.02) return; const face = add(a, mul(out, R.t / 2)), dd = (off || 0) - dot(sub(face, s.a), s.n), along = dd * dot(s.n, out); if (Math.abs(dd) < tol && (!best || Math.abs(dd) < Math.abs(best.d))) best = { d: along, kind: "floor", slab: s.slab, a: s.a, b: s.b, n: s.n }; });
    return best ? { dist: dist + best.d, hit: best } : { dist, hit: null };
  }
  const centroid = (P) => { let x = 0, y = 0; P.forEach((p) => { x += p[0]; y += p[1]; }); return [x / P.length, y / P.length]; };
  const roomArea = (R) => (R.closed ? Math.abs(area2(interior(R))) : 0);

  /** the opening's place on its wall (null: its wall is gone) - pushed clear of the corners */
  function opInfo(A, op) {
    const R = room(A, op.room); if (!R) return null;
    const e = edgesOf(R)[op.edge]; if (!e || e.L < EPS) return null;
    const m = tw(R, op.edge) / 2 + 0.03, lo = op.w / 2 + m, hi = e.L - op.w / 2 - m;
    const at = hi >= lo ? Math.min(hi, Math.max(lo, op.at)) : e.L / 2;
    const c = add(e.a, mul(e.u, at)), nl = left(e.u);
    // the thickest wall on this line (a shared wall): the cut goes right through it
    let T = tw(R, op.edge);
    A.rooms.forEach((Q) => { if (Q === R || Math.abs(Q.z - R.z) > 0.01) return; edgesOf(Q).forEach((f) => { if (Math.abs(crs(f.u, e.u)) < 0.02 && segDist(c, f.a, f.b).d < 0.01) T = Math.max(T, tw(Q, f.i)); }); });
    const x0 = at - op.w / 2, x1 = at + op.w / 2, k = T / 2 + 0.03;
    const P = (x, y) => add(add(e.a, mul(e.u, x)), mul(nl, y));
    return { op, R, e, at, c, u: e.u, nl, T, x0, x1, o: e.a, z0: R.z + op.sill, z1: R.z + Math.min(op.sill + op.h, R.h), rect: [P(x0, -k), P(x1, -k), P(x1, k), P(x0, k)] };
  }

  /* ---------------- the geometry */
  function build(A, opt) {
    const out = { polys: [], lines: [], roofLines: [], lights: [] };
    if (!A) return out;
    const o = opt || {}, hid = hiddenOf(A);           // 2.639.0: what the outline docker hides is not built
    walls(A, out, hid);
    A.rooms.forEach((R) => {
      if (!R.closed) return;
      const inn = interior(R); if (!inn || Math.abs(area2(inn)) < 1e-4) return;
      trims(A, R, out, hid);
      if (R.floorOn && !hid("room:" + R.id + ":floor")) out.polys.push({ rings: [inn.map((p) => [p[0], p[1], R.z + 0.002])], n: [0, 0, 1], col: R.floor, tag: { ak: "room", id: R.id, part: "floor" }, layer: "main" });
      const ceilOn = R.ceilOn && !hid("room:" + R.id + ":ceil");
      const fg = ceilOn && R.ceil === "follow" ? followGrid(R, false, 0) : null;          // 2.624.0: the walls' slope
      if (fg) gridPolys(fg.rows, -0.003, false, R.ceilCol, { ak: "room", id: R.id, part: "ceil" }, "ceil", out, null);
      else if (ceilOn) out.polys.push({ rings: [inn.map((p) => [p[0], p[1], R.z + R.h - 0.003]).reverse()], n: [0, 0, -1], col: R.ceilCol, tag: { ak: "room", id: R.id, part: "ceil" }, layer: "ceil" });
    });
    A.ops.forEach((op) => { const I = opInfo(A, op); if (I && !hid("op:" + op.id)) { fixture(I, out); frames(A, I, out); } });
    A.roofs.forEach((rf) => { if (!hid("roof:" + rf.id)) roof(A, rf, out); });
    A.slabs.forEach((s) => { if (!hid("slab:" + s.id)) prism(s.pts, s.z - s.th, s.z, s.col, { ak: "slab", id: s.id }, out); });
    A.rooms.forEach((R) => { if (R.closed && R.slab && !hid("room:" + R.id + ":slab")) { const X = exterior(R); if (X) prism(X, R.z - 0.2, R.z, DEF.slab, { ak: "room", id: R.id, part: "slab" }, out); } });   // 2.631.0: the auto floor
    A.stairs.forEach((s) => { if (!hid("stair:" + s.id)) stair(s, out); });
    if (root.PPSite) { root.PPSite.build(A, out, hid); root.PPSite.buildDrives(A, out, hid); }   // 2.657.0: 🏊 the pools; 2.659.0: 🛣 the driveways
    A.lights.forEach((L) => !hid("light:" + L.id) && out.lights.push(Object.assign({}, L, { p: [L.x, L.y, L.z], def: LIGHTS[L.type] })));
    void o;
    return out;
  }
  /** the walls of every storey as one solid: bands between the heights where something changes, each band's plan the union of
   * the walls standing through it minus the openings cut through it */
  function walls(A, out, hid0) {
    const W = [], hid = hid0 || (() => false);
    const U = [];      // 2.624.0: the walls whose top is not flat stand to their lowest top; their own piece goes above
    A.rooms.forEach((R) => wallQuads(R).forEach((q) => { if (hid("room:" + R.id + ":wall:" + q.i)) return; const flat = flatTop(R, q.i); W.push({ poly: q.quad, z0: R.z, z1: R.z + (flat ? R.h : minTop(R, q.i)), R }); if (!flat) U.push({ R, q }); }));
    // 2.662.0: the corners / ends - as high as the higher wall's end there
    A.rooms.forEach((R) => joints(R, (i) => hid("room:" + R.id + ":wall:" + i)).forEach((j) => { const top = Math.max(...j.walls.map((i) => topAt(R, i, i === j.k ? 0 : 1))); W.push({ poly: j.poly, z0: R.z, z1: R.z + top, R }); }));   // wall i starts at point i
    if (!W.length) return;
    const O = A.ops.map((op) => opInfo(A, op)).filter((I) => I && I.z1 > I.z0 + 1e-4);
    const zs = [...new Set(W.flatMap((w) => [w.z0, w.z1]).concat(O.flatMap((I) => [I.z0, I.z1])).map(r6))].sort((a, b) => a - b);
    const pc = PC(), F = [];
    for (let k = 0; k < zs.length - 1; k++) {
      const a = zs[k], b = zs[k + 1];
      const ws = W.filter((w) => w.z0 <= a + EPS && w.z1 >= b - EPS);
      if (!ws.length) { F.push([]); continue; }
      let U;
      try {
        U = pc.union.apply(null, ws.map((w) => [ring(w.poly)]));
        const os = O.filter((I) => I.z0 <= a + EPS && I.z1 >= b - EPS);
        if (os.length && U.length) U = pc.difference.apply(null, [U].concat(os.map((I) => [ring(I.rect)])));
      } catch (e) { U = ws.map((w) => [ring(area2(w.poly) < 0 ? w.poly.slice().reverse() : w.poly)]); }   // a union that fails: the walls one by one
      F.push(simplifyRings(U));       // 2.662.0: the joints' points along a straight face taken out - one face a wall
    }
    const pieces = U.map(({ R, q }) => upperPiece(R, q, out, A.ext));
    // 2.624.0: a cut in a wall's top shows as a line down both its faces (to its floor)
    A.rooms.forEach((R) => wallQuads(R).forEach((q) => { if (hid("room:" + R.id + ":wall:" + q.i)) return; const P = profile(R, q.i); if (P.length < 3) return; const [lS, lE, rE, rS] = q.quad;
      P.slice(1, -1).forEach(([t, h]) => { [[lS, lE], [rS, rE]].forEach(([A2, B2]) => { const x = A2[0] + (B2[0] - A2[0]) * t, y = A2[1] + (B2[1] - A2[1]) * t; out.lines.push([[x, y, R.z], [x, y, R.z + Math.min(h, minTop(R, q.i))]]); }); }); }));
    const underPiece = (p, q2, z) => pieces.some((pc) => Math.abs(pc.z - z) < 1e-6 && [p, q2, [(p[0] + q2[0]) / 2, (p[1] + q2[1]) / 2]].every((x) => inPoly(x, pc.quad) || segDistPoly(x, pc.quad) < 1e-4));
    const inner = A.rooms.filter((R) => R.closed).map((R) => ({ R, P: interior(R) }));
    const faceCol = (R, m) => { if (!R.wcol || !Object.keys(R.wcol).length) return R.wall; let bi = 0, bd = Infinity; edgesOf(R).forEach((e) => { const d = segDist(m, e.a, e.b).d; if (d < bd) { bd = d; bi = e.i; } }); return wallCol(R, bi); };   // 2.640.0
    // 2.651.0: an OUTSIDE face's own wall - the room whose wall it is part of (just inside the face), that wall's outside material
    const extCol = (p, q, nO, z) => { const m = mul(add(p, q), 0.5), pin = sub(m, mul(nO, 0.03)), w = wallOwner(A, pin, z); if (w && w.R.wext && w.R.wext[w.i]) return w.R.wext[w.i];
      if (w && w.R.wkind && w.R.wkind[w.i] === "int") return wallCol(w.R, w.i);   // 2.660.0: a wall set to interior - its inside colour both sides
      const T = w && w.R.wt && w.R.wt[w.i] && root.PPWallType ? root.PPWallType.find(A, w.R.wt[w.i]) : null, oc = T && root.PPWallType.outerCol(T);   // 2.661.0: its type's outside layer
      return oc || A.ext; };
    // 2.661.0: a typed wall's layer seams on its top (a flat top)
    if (root.PPWallType) A.rooms.forEach((R) => { if (!R.wt) return; mitreQuads(R).forEach((q) => { const id = R.wt[q.i]; if (!id || hid("room:" + R.id + ":wall:" + q.i) || !flatTop(R, q.i)) return; const T = root.PPWallType.find(A, id); if (!T) return;
      root.PPWallType.seams(T, q.quad).forEach(([a, b]) => out.lines.push([[a[0], a[1], R.z + R.h + 0.002], [b[0], b[1], R.z + R.h + 0.002]])); }); });
    const colOf = (p, z) => { const hit = inner.find((x) => z > x.R.z - EPS && z < x.R.z + x.R.h + EPS && inPoly(p, x.P)); return hit ? hit.R : null; };
    for (let k = 0; k < F.length; k++) {
      const a = zs[k], b = zs[k + 1], zm = (a + b) / 2;
      F[k].forEach((poly) => poly.forEach((rg) => {
        for (let j = 0; j + 1 < rg.length; j++) {
          const p = rg[j], q = rg[j + 1], d = sub(q, p), L = len(d); if (L < 1e-7) continue;
          const nO = [d[1] / L, -d[0] / L], R = colOf(add(mul(add(p, q), 0.5), mul(nO, 0.03)), zm);
          out.polys.push({ rings: [[[p[0], p[1], a], [q[0], q[1], a], [q[0], q[1], b], [p[0], p[1], b]]], n: [nO[0], nO[1], 0], col: R ? faceCol(R, mul(add(p, q), 0.5)) : extCol(p, q, nO, zm), tag: { ak: "wall", room: R ? R.id : null }, layer: "main" });
          // a vertical line at a real corner
          const pr = rg[j === 0 ? rg.length - 2 : j - 1], din = norm(sub(p, pr)), dout = norm(d);
          if (Math.abs(crs(din, dout)) > 0.02 || dot(din, dout) < 0) out.lines.push([[p[0], p[1], a], [p[0], p[1], b]]);
        }
      }));
    }
    for (let k = 0; k < zs.length; k++) {
      const z = zs[k], below = k > 0 ? F[k - 1] : [], above = k < F.length ? F[k] : [];
      if (!below.length && !above.length) continue;
      const top = below.length ? (above.length ? pc.difference(below, above) : below) : [];
      const bot = above.length ? (below.length ? pc.difference(above, below) : above) : [];
      top.forEach((poly) => out.polys.push({ rings: poly.map((rg) => rg.slice(0, -1).map((p) => [p[0], p[1], z])), n: [0, 0, 1], col: DEF.top, tag: { ak: "wall", room: null }, layer: "main" }));
      bot.forEach((poly) => out.polys.push({ rings: poly.map((rg) => rg.slice(0, -1).map((p) => [p[0], p[1], z]).reverse()), n: [0, 0, -1], col: A.ext, tag: { ak: "wall", room: null }, layer: "main" }));
      const crease = below.length && above.length ? pc.xor(below, above) : below.length ? below : above;
      crease.forEach((poly) => poly.forEach((rg) => { for (let j = 0; j + 1 < rg.length; j++) { if (pieces.length && underPiece(rg[j], rg[j + 1], z)) continue; out.lines.push([[rg[j][0], rg[j][1], z], [rg[j + 1][0], rg[j + 1][1], z]]); } }));
    }
  }
  /** an oriented box: o + u·x + n·y + z, x0..x1 × y0..y1 × z0..z1 - six quads + twelve lines */
  function box(o, u, n, x0, x1, y0, y1, z0, z1, col, tag, out, alpha, noLines) {
    const P = (x, y, z) => [o[0] + u[0] * x + n[0] * y, o[1] + u[1] * x + n[1] * y, z];
    const c = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
    const flipped = crs(u, n) < 0;           // a right-handed (u, n, z) keeps the normals outward
    const F = [[0, 3, 2, 1, [0, 0, -1]], [4, 5, 6, 7, [0, 0, 1]], [0, 1, 5, 4, [-n[0], -n[1], 0]], [2, 3, 7, 6, [n[0], n[1], 0]], [1, 2, 6, 5, [u[0], u[1], 0]], [3, 0, 4, 7, [-u[0], -u[1], 0]]];
    F.forEach((f) => { const r = [c[f[0]], c[f[1]], c[f[2]], c[f[3]]]; out.polys.push({ rings: [flipped ? r.reverse() : r], n: f[4], col, alpha: alpha || 1, tag, layer: "main" }); });
    if (!noLines) [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([i, j]) => out.lines.push([c[i], c[j]]));
  }
  /** a door / window in its opening */
  function fixture(I, out) {
    const op = I.op, tag = { ak: "op", id: op.id }, u = I.u, n = I.nl, o = I.o, x0 = I.x0, x1 = I.x1, z0 = I.z0, z1 = I.z1, T = I.T;
    if (op.kind === "opening") return;
    if (op.kind === "door") {
      const fw = 0.05, d = T / 2 + 0.012, col = DEF.frame;
      box(o, u, n, x0, x0 + fw, -d, d, z0, z1, col, tag, out); box(o, u, n, x1 - fw, x1, -d, d, z0, z1, col, tag, out); box(o, u, n, x0, x1, -d, d, z1 - fw, z1, col, tag, out);
      const a = x0 + fw, b = x1 - fw, top = z1 - fw;
      // 2.631.0: a leaf hinged at x = hx, its free end toward `way` (+1 = +u, -1 = -u), turned op.open % of 90° to the room's
      // side (op.dir: the other side) - the leaf's own frame: x along it from the hinge, y across it
      const ang = (op.open || 0) / 100 * Math.PI / 2, sgn = op.dir ? -1 : 1;
      const leaf = (hx, way, L, draw) => {
        const c = Math.cos(ang), s2 = Math.sin(ang) * sgn, lu = [u[0] * c * way + n[0] * s2, u[1] * c * way + n[1] * s2], ln = [n[0] * c - u[0] * s2 * way, n[1] * c - u[1] * s2 * way];
        const lo = [o[0] + u[0] * hx, o[1] + u[1] * hx];
        draw((x0b, x1b, y0, y1, za, zb, col, alpha, noLines) => box(lo, lu, ln, x0b, x1b, y0, y1, za, zb, col, tag, out, alpha, noLines), L);
      };
      const handleL = (B, hx) => { B(hx - 0.015, hx + 0.015, 0.02, 0.07, z0 + 0.98, z0 + 1.02, "#c0c0c0", 1, true); B(hx - 0.015, hx + 0.015, -0.07, -0.02, z0 + 0.98, z0 + 1.02, "#c0c0c0", 1, true); };
      if (op.style === "single") leaf(op.flip ? b : a, op.flip ? -1 : 1, b - a, (B, L) => { B(0, L, -0.02, 0.02, z0 + 0.005, top, op.col); handleL(B, L - 0.08); });
      else if (op.style === "double") { const L = (b - a) / 2 - 0.002; leaf(a, 1, L, (B) => { B(0, L, -0.02, 0.02, z0 + 0.005, top, op.col); handleL(B, L - 0.06); }); leaf(b, -1, L, (B) => { B(0, L, -0.02, 0.02, z0 + 0.005, top, op.col); handleL(B, L - 0.06); }); }
      else if (op.style === "glass") {
        leaf(op.flip ? b : a, op.flip ? -1 : 1, b - a, (B, L) => {
          const s = 0.07; B(0, s, -0.02, 0.02, z0 + 0.005, top, op.col); B(L - s, L, -0.02, 0.02, z0 + 0.005, top, op.col);
          B(s, L - s, -0.02, 0.02, z0 + 0.005, z0 + 0.15, op.col); B(s, L - s, -0.02, 0.02, top - s, top, op.col);
          B(s, L - s, -0.005, 0.005, z0 + 0.15, top - s, (op.glass || DEF.glass), 0.3, true); handleL(B, L - 0.04);
        });
      } else {                                 // sliding: two glass panels, one in front of the other (2.631.0: the front one slides open)
        const m0 = (a + b) / 2, slide = (op.open || 0) / 100 * (m0 - a) * (op.dir ? -1 : 1), m = m0, pane = (p0, p1, y) => { box(o, u, n, p0, p1, y - 0.02, y + 0.02, z0 + 0.005, top, op.col, tag, out, 1, true); box(o, u, n, p0 + 0.05, p1 - 0.05, y - 0.006, y + 0.006, z0 + 0.06, top - 0.05, (op.glass || DEF.glass), Object.assign({}, tag, { part: "glass" }), out, 0.3, true); };
        const sa = op.dir ? 0 : slide, sb = op.dir ? slide : 0;         // the dir checkbox: the other pane slides
        pane(a + sa, m + 0.04 + sa, -0.025); pane(m - 0.04 + sb, b + sb, 0.025);
        [[a + sa, m + 0.04 + sa, -0.025], [m - 0.04 + sb, b + sb, 0.025]].forEach(([p0, p1, y]) => { const P = (x, z) => [o[0] + u[0] * x + n[0] * y, o[1] + u[1] * x + n[1] * y, z]; out.lines.push([P(p0, z0), P(p1, z0)], [P(p1, z0), P(p1, top)], [P(p1, top), P(p0, top)], [P(p0, top), P(p0, z0)]); });
      }
      return;
    }
    // a window: a frame in the middle of the wall, the glass, a sill outside (outside = the right side of the room's wall)
    const fw = 0.06, d = 0.045, col = op.col;
    box(o, u, n, x0, x0 + fw, -d, d, z0, z1, col, tag, out); box(o, u, n, x1 - fw, x1, -d, d, z0, z1, col, tag, out);
    box(o, u, n, x0 + fw, x1 - fw, -d, d, z0, z0 + fw, col, tag, out); box(o, u, n, x0 + fw, x1 - fw, -d, d, z1 - fw, z1, col, tag, out);
    if (op.sill > 0.05) box(o, u, n, x0 - 0.04, x1 + 0.04, -(T / 2 + 0.05), -d, z0 - 0.035, z0, col, tag, out);
    const a = x0 + fw, b = x1 - fw, g0 = z0 + fw, g1 = z1 - fw;
    if (op.style === "slider") {
      const m = (a + b) / 2, sl = (op.open || 0) / 100 * (m - a), s1 = op.dir ? 0 : sl, s2 = op.dir ? -sl : 0;     // 2.631.0: a pane slid open
      box(o, u, n, a + s1, m + 0.03 + s1, -0.03, -0.005, g0, g1, col, tag, out, 1, true); box(o, u, n, m - 0.03 + s2, b + s2, 0.005, 0.03, g0, g1, col, tag, out, 1, true);
      box(o, u, n, a + 0.04 + s1, m - 0.01 + s1, -0.02, -0.014, g0 + 0.04, g1 - 0.04, (op.glass || DEF.glass), Object.assign({}, tag, { part: "glass" }), out, 0.3, true); box(o, u, n, m + 0.01 + s2, b - 0.04 + s2, 0.014, 0.02, g0 + 0.04, g1 - 0.04, (op.glass || DEF.glass), Object.assign({}, tag, { part: "glass" }), out, 0.3, true);
      return;
    }
    if (op.open > 0) {                                                   // 2.631.0: casement sashes turned open (outside; dir: inside)
      const ang = op.open / 100 * Math.PI / 2, sg = op.dir ? 1 : -1;
      const sash = (hx, way, L) => {
        const c = Math.cos(ang), s2 = Math.sin(ang) * sg, lu = [u[0] * c * way + n[0] * s2, u[1] * c * way + n[1] * s2], ln = [n[0] * c - u[0] * s2 * way, n[1] * c - u[1] * s2 * way], lo = [o[0] + u[0] * hx, o[1] + u[1] * hx];
        const B = (x0b, x1b, y0, y1, za, zb, cl, al, nl) => box(lo, lu, ln, x0b, x1b, y0, y1, za, zb, cl, tag, out, al, nl);
        const w = 0.035; B(0, w, -0.02, 0.02, g0, g1, col); B(L - w, L, -0.02, 0.02, g0, g1, col); B(w, L - w, -0.02, 0.02, g0, g0 + w, col); B(w, L - w, -0.02, 0.02, g1 - w, g1, col);
        B(w, L - w, -0.005, 0.005, g0 + w, g1 - w, (op.glass || DEF.glass), 0.3, true);
      };
      if (op.style === "double") { const m = (a + b) / 2; box(o, u, n, m - fw / 2, m + fw / 2, -d, d, g0, g1, col, tag, out); sash(a, 1, m - fw / 2 - a); sash(b, -1, b - m - fw / 2); }
      else sash(a, 1, b - a);
      return;
    }
    if (op.style === "double") { const m = (a + b) / 2; box(o, u, n, m - fw / 2, m + fw / 2, -d, d, g0, g1, col, tag, out); box(o, u, n, a, m - fw / 2, -0.005, 0.005, g0, g1, (op.glass || DEF.glass), Object.assign({}, tag, { part: "glass" }), out, 0.3, true); box(o, u, n, m + fw / 2, b, -0.005, 0.005, g0, g1, (op.glass || DEF.glass), Object.assign({}, tag, { part: "glass" }), out, 0.3, true); return; }
    box(o, u, n, a, b, -0.005, 0.005, g0, g1, (op.glass || DEF.glass), Object.assign({}, tag, { part: "glass" }), out, 0.3, true);
  }
  /** 2.640.0: a door / window's frame (architrave - its profile swept round the opening; a door: both faces, a window: the
      room's side) and a window's sill (its profile under the window inside, reaching back into the opening) */
  function frames(A, I, out) {
    const PF = root.PPProfile, op = I.op; if (!PF || op.kind === "opening" || (!op.frameP && !op.sillP)) return;
    const tag = { ak: "op", id: op.id, part: "frame" }, u = I.u, n = I.nl, o = I.o, T = I.T, x0 = I.x0, x1 = I.x1, z0 = I.z0, z1 = I.z1;
    const sill = op.kind === "window" && op.sillP ? PF.resolve(A, op.sillP, "sill") : null;
    if (op.frameP) {
      const pf = PF.resolve(A, op.frameP, op.kind === "door" ? "doorframe" : "windowframe"), sec = pf.pts.map((q) => [q[1], q[0]]);   // a = across (away from the opening), b = out from the wall face
      // round the opening in (along the wall, height): up its left side, along its top, down its right side (+ its bottom: a window without a sill)
      const closed = op.kind === "window" && !sill, chain = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]];
      (op.kind === "door" ? [1, -1] : [1]).forEach((face) => {
        const map = (q, b) => { const d = face * (T / 2 + b); return [o[0] + u[0] * q[0] + n[0] * d, o[1] + u[1] * q[0] + n[1] * d, q[1]]; };
        merge(out, PF.sweep(chain, closed, sec, map, op.trimCol, Object.assign({}, tag, { part: "frame" })));
      });
    }
    if (sill) {
      const s = PF.size(sill), back = Math.max(0, T / 2 - 0.045), ear = 0.03 + frameWidth(A, op);
      const sec = sill.pts.map((q) => [q[0] <= s.minX + 1e-6 ? -back : q[0], q[1]]);   // its back reaches the window's frame
      const P2 = (x) => [o[0] + u[0] * x + n[0] * T / 2, o[1] + u[1] * x + n[1] * T / 2];
      merge(out, PF.sweep([P2(x0 - ear), P2(x1 + ear)], false, sec, (q, b) => [q[0], q[1], z0 - s.maxY + b], op.trimCol, Object.assign({}, tag, { part: "sill" })));
    }
  }
  /** a plan polygon as a solid z0..z1 */
  function prism(P, z0, z1, col, tag, out, layer) {
    const pts = area2(P) < 0 ? P.slice().reverse() : P;
    out.polys.push({ rings: [pts.map((p) => [p[0], p[1], z1])], n: [0, 0, 1], col, tag, layer: layer || "main" });
    out.polys.push({ rings: [pts.map((p) => [p[0], p[1], z0]).reverse()], n: [0, 0, -1], col, tag, layer: layer || "main" });
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length], d = norm(sub(q, p));
      out.polys.push({ rings: [[[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]]], n: [d[1], -d[0], 0], col, tag, layer: layer || "main" });
      (layer === "roof" ? out.roofLines : out.lines).push([[p[0], p[1], z0], [q[0], q[1], z0]], [[p[0], p[1], z1], [q[0], q[1], z1]], [[p[0], p[1], z0], [p[0], p[1], z1]]);
    });
  }
  /** a straight flight: its side profile pushed across its width (the line clicked runs up its middle) */
  function stair(s, out) {
    const n = Math.max(2, Math.round(s.rise / 0.18)), g = s.len / n, r = s.rise / n, a = s.ang * Math.PI / 180;
    const u = [Math.cos(a), Math.sin(a)], v = left(u), o = [s.x - v[0] * s.w / 2, s.y - v[1] * s.w / 2], tag = { ak: "stair", id: s.id };
    const prof = [[0, 0]]; for (let i = 0; i < n; i++) { prof.push([i * g, (i + 1) * r]); prof.push([(i + 1) * g, (i + 1) * r]); } prof.push([s.len, 0]);
    const P = (x, y, z) => [o[0] + u[0] * x + v[0] * y, o[1] + u[1] * x + v[1] * y, s.z + z];
    out.polys.push({ rings: [prof.map(([x, z]) => P(x, 0, z))], n: [-v[0], -v[1], 0], col: s.col, tag, layer: "main" });
    out.polys.push({ rings: [prof.map(([x, z]) => P(x, s.w, z)).reverse()], n: [v[0], v[1], 0], col: s.col, tag, layer: "main" });
    prof.forEach((p, i) => {
      const q = prof[(i + 1) % prof.length], d = [q[0] - p[0], q[1] - p[1]], L = Math.hypot(d[0], d[1]); if (L < 1e-9) return;
      const nn = [d[1] / L, -d[0] / L];       // the outward normal in (along, up); the profile runs clockwise in (x, z)
      out.polys.push({ rings: [[P(p[0], 0, p[1]), P(p[0], s.w, p[1]), P(q[0], s.w, q[1]), P(q[0], 0, q[1])]], n: [-u[0] * nn[0], -u[1] * nn[0], -nn[1]], col: s.col, tag, layer: "main" });
      out.lines.push([P(p[0], 0, p[1]), P(q[0], 0, q[1])], [P(p[0], s.w, p[1]), P(q[0], s.w, q[1])], [P(p[0], 0, p[1]), P(p[0], s.w, p[1])]);
    });
  }
  /** a roof over its rooms: the rectangle round their walls (turned like the first room), its type, pitch and overhang */
  function roofFrame(A, rf) {
    const Rs = rf.rooms.map((id) => room(A, id)).filter(Boolean); if (!Rs.length) return null;
    const e0 = edgesOf(Rs[0]).find((e) => e.L > EPS); if (!e0) return null;
    const u = e0.u, v = left(u), pts = Rs.flatMap((R) => mitreQuads(R).flatMap((q) => q.quad));
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    pts.forEach((p) => { const a = dot(p, u), b = dot(p, v); u0 = Math.min(u0, a); u1 = Math.max(u1, a); v0 = Math.min(v0, b); v1 = Math.max(v1, b); });
    const top = Math.max(...Rs.map((R) => R.z + R.h)), t = Math.max(...Rs.map((R) => R.t));
    let W = u1 - u0, D = v1 - v0, o = add(mul(u, u0), mul(v, v0)), U = u, Vv = v;
    const along = rf.ridge === "u" ? true : rf.ridge === "v" ? false : W >= D;
    if (!along) { o = add(o, mul(u, W)); U = v; Vv = mul(u, -1); const k = W; W = D; D = k; }     // the ridge runs along U
    return { o, U, V: Vv, W, D, top, t };
  }
  /** 2.666.0: a roof type from what was saved / asked (skillion = shed ...); unknown = gable */
  function roofType(t) { const s = String(t || "").toLowerCase().trim(); return ROOFS.includes(s) ? s : ROOF_ALIAS[s] || "gable"; }
  /** 2.666.0: a roof's shape in its frame (x along the ridge 0..W, y across 0..D from the walls' outside, z up; top = the walls'
   *  top, tp = tan(pitch), ov = the overhang): {tops: planar polygons (the roof's underside), ups: [[profile (y, z) CCW, x0, x1]]
   *  - the gable ends / high sides walled up under it, extruded from x0 to x1}. Pure (scripts/test-roofs666.js). */
  function roofShape(type, W, D, ov, top, tp, t, rf) {
    const H = D / 2, eave = top - ov * tp, o = rf || {}, kk = o.k != null ? o.k : ROOF_K[type];
    const c0 = [-ov, -ov, eave], c1 = [W + ov, -ov, eave], c2 = [W + ov, D + ov, eave], c3 = [-ov, D + ov, eave];
    const ends = (prof) => [[prof, 0, t], [prof, W - t, W]];
    const hip = () => { const rz = top + H * tp, r1 = [H, H, rz], r2 = [Math.max(H, W - H), H, rz]; return { tops: W - D > 1e-6 ? [[c0, c1, r2, r1], [c2, c3, r1, r2], [c3, c0, r1], [c1, c2, r2]] : [[c0, c1, r1], [c1, c2, r1], [c2, c3, r1], [c3, c0, r1]], ups: [] }; };
    if (type === "shed") return { tops: [[[-ov, -ov, eave], [W + ov, -ov, eave], [W + ov, D + ov, top + (D + ov) * tp], [-ov, D + ov, top + (D + ov) * tp]]],
      ups: ends([[0, top], [D, top], [D, top + D * tp]]).concat([[[[D - t, top], [D, top], [D, top + D * tp], [D - t, top + (D - t) * tp]], t, W - t]]) };
    if (type === "gable") { const rz = top + H * tp; return { tops: [[c0, c1, [W + ov, H, rz], [-ov, H, rz]], [[-ov, H, rz], [W + ov, H, rz], c2, c3]], ups: ends([[0, top], [D, top], [H, rz]]) }; }
    if (type === "hip") return hip();
    if (type === "pyramid") { const ap = [W / 2, H, top + Math.min(W, D) / 2 * tp]; return { tops: [[c0, c1, ap], [c1, c2, ap], [c2, c3, ap], [c3, c0, ap]], ups: [] }; }
    if (type === "dutch") {                    // a hip up to the gablet's foot, a small gable above it at each end
      const yb = kk * H, s = ov + yb, xg1 = -ov + s, xg2 = W + ov - s, zb = top + yb * tp, rz = top + H * tp;
      if (xg2 - xg1 < 0.2) return hip();
      const g = [[yb, zb], [D - yb, zb], [H, rz]];
      return { tops: [[c0, c1, [xg2, yb, zb], [xg2, H, rz], [xg1, H, rz], [xg1, yb, zb]], [c2, c3, [xg1, D - yb, zb], [xg1, H, rz], [xg2, H, rz], [xg2, D - yb, zb]],
        [c1, c2, [xg2, D - yb, zb], [xg2, yb, zb]], [c3, c0, [xg1, yb, zb], [xg1, D - yb, zb]]],
        ups: [[g, xg1, xg1 + 0.04], [g, xg2 - 0.04, xg2]] };
    }
    if (type === "jerkin") {                   // a gable whose top is hipped back
      const yc = (1 - kk) * H, hx = H - yc, zc = top + yc * tp, rz = top + H * tp;
      if (W - 2 * hx < 0.2) return hip();
      return { tops: [[c0, c1, [W + ov, yc, zc], [W, yc, zc], [W - hx, H, rz], [hx, H, rz], [0, yc, zc], [-ov, yc, zc]],
        [c2, c3, [-ov, D - yc, zc], [0, D - yc, zc], [hx, H, rz], [W - hx, H, rz], [W, D - yc, zc], [W + ov, D - yc, zc]],
        [[0, D - yc, zc], [0, yc, zc], [hx, H, rz]], [[W, yc, zc], [W, D - yc, zc], [W - hx, H, rz]]],
        ups: ends([[0, top], [D, top], [D - yc, zc], [yc, zc]]) };
    }
    if (type === "gambrel" || type === "mansard") {   // a steep lower slope (pitch2) breaking to a shallower upper one (pitch)
      const tl = Math.tan(o.pitch2 != null ? o.pitch2 * Math.PI / 180 : Math.PI / 3), b = Math.min(kk, 0.9) * H, zb = top + b * tl, eL = top - ov * tl;
      const d0 = [-ov, -ov, eL], d1 = [W + ov, -ov, eL], d2 = [W + ov, D + ov, eL], d3 = [-ov, D + ov, eL];
      if (type === "gambrel") {
        const rz = zb + (H - b) * tp;
        return { tops: [[d0, d1, [W + ov, b, zb], [-ov, b, zb]], [[-ov, b, zb], [W + ov, b, zb], [W + ov, H, rz], [-ov, H, rz]],
          [[-ov, H, rz], [W + ov, H, rz], [W + ov, D - b, zb], [-ov, D - b, zb]], [[-ov, D - b, zb], [W + ov, D - b, zb], d2, d3]],
          ups: ends([[0, top], [D, top], [D - b, zb], [H, rz], [b, zb]]) };
      }
      const i0 = [b, b, zb], i1 = [W - b, b, zb], i2 = [W - b, D - b, zb], i3 = [b, D - b, zb], Wi = W - 2 * b, Hi = (D - 2 * b) / 2;
      const tops = [[d0, d1, i1, i0], [d1, d2, i2, i1], [d2, d3, i3, i2], [d3, d0, i0, i3]];
      if (tp < 1e-3 || Hi < 0.05) tops.push([i0, i1, i2, i3]);
      else { const rz = zb + Hi * tp, r1 = [b + Hi, H, rz], r2 = [Math.max(b + Hi, W - b - Hi), H, rz];
        if (Wi - 2 * Hi > 1e-6) tops.push([i0, i1, r2, r1], [i2, i3, r1, r2], [i3, i0, r1], [i1, i2, r2]); else tops.push([i0, i1, r1], [i1, i2, r1], [i2, i3, r1], [i3, i0, r1]); }
      return { tops, ups: [] };
    }
    if (type === "saltbox") {                  // the ridge off centre: a short steep front, a long shallow back - both eaves level
      const r = Math.min(Math.max(kk, 0.1), 0.9) * D, rz = top + r * tp, tb = (rz - top) / (D - r), eB = top - ov * tb;
      return { tops: [[c0, c1, [W + ov, r, rz], [-ov, r, rz]], [[-ov, r, rz], [W + ov, r, rz], [W + ov, D + ov, eB], [-ov, D + ov, eB]]], ups: ends([[0, top], [D, top], [r, rz]]) };
    }
    if (type === "butterfly") {                // two slopes down to a valley in the middle, the outside walls up to the high eaves
      const zw = top + H * tp, zo = top + (H + ov) * tp;
      return { tops: [[[-ov, -ov, zo], [W + ov, -ov, zo], [W + ov, H, top], [-ov, H, top]], [[-ov, H, top], [W + ov, H, top], [W + ov, D + ov, zo], [-ov, D + ov, zo]]],
        ups: ends([[0, top], [H, top], [0, zw]]).concat(ends([[H, top], [D, top], [D, zw]]), [[[[0, top], [t, top], [t, top + (H - t) * tp], [0, zw]], t, W - t], [[[D - t, top], [D, top], [D, zw], [D - t, top + (H - t) * tp]], t, W - t]]) };
    }
    return hip();
  }
  /** 2.666.0: a small picture of a roof type (an SVG string) - a 6 x 4 m room under it, seen from the front right, from
   *  what build() makes (so the picture is always the real shape); cached */
  const ICONS = new Map();
  function roofIcon(type, size) {
    const key = type + "|" + (size || 56); if (ICONS.has(key)) return ICONS.get(key);
    const A = empty(), R = addRoom(A, rectPts([0, 0], [6, 4]), { h: 2.4 });
    addRoof(A, [R.id], { type: roofType(type), pitch: 32, over: 0.3, th: 0.12, pitch2: 64 });
    const B = build(A), V = [0.5, -0.8, 0.55], L = Math.hypot(V[0], V[1], V[2]); V[0] /= L; V[1] /= L; V[2] /= L;
    const U = [-V[1], V[0], 0], Ul = Math.hypot(U[0], U[1]); U[0] /= Ul; U[1] /= Ul;
    const Wv = [V[1] * U[2] - V[2] * U[1], V[2] * U[0] - V[0] * U[2], V[0] * U[1] - V[1] * U[0]];
    const d3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sun = [0.35, -0.55, 0.76];
    const faces = [];
    B.polys.forEach((q) => {
      if (!q.n || q.layer === "ceil" || !q.tag || (q.tag.ak !== "wall" && q.tag.ak !== "roof")) return;
      if (d3(q.n, V) <= 0.02) return;
      let dep = 0, cnt = 0; const rings = q.rings.map((r) => r.map((p) => { dep += -d3(p, V); cnt++; return [d3(p, U), -d3(p, Wv)]; }));
      const lit = 0.55 + 0.45 * Math.max(0, d3(q.n, sun)), base = q.tag.ak === "roof" && q.col !== A.ext ? [194, 106, 74] : [222, 214, 199];
      faces.push({ rings, dep: dep / cnt, col: "rgb(" + base.map((c) => Math.round(c * lit)).join(",") + ")" });
    });
    faces.sort((a, b) => b.dep - a.dep);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    faces.forEach((f) => f.rings.forEach((r) => r.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); })));
    const w = x1 - x0 || 1, h = y1 - y0 || 1, sz = size || 56, k = sz / Math.max(w, h * 1.3), f = (v) => (+v.toFixed(1));
    const body = faces.map((F) => '<path d="' + F.rings.map((r) => "M" + r.map((p) => f((p[0] - x0) * k) + " " + f((p[1] - y0) * k)).join("L") + "Z").join("") + '" fill="' + F.col + '" stroke="#2a2622" stroke-width="0.6" stroke-linejoin="round"/>').join("");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + f(w * k) + '" height="' + f(h * k) + '" viewBox="0 0 ' + f(w * k) + " " + f(h * k) + '">' + body + "</svg>";
    ICONS.set(key, svg); return svg;
  }
  /* 2.668.0 (Tim: "please add eaves and eave styles to sketcher like open eaves, boxed eaves,closed eaves, and facias and
     gutters"): what hangs on a roof's edges. EAVE edges = a top face's lowest line that is on the roof's border (the low side of a
     slope), RAKE edges = the sloped border lines (a gable's verge). rf.eave: plain (just the overhang) | open (rafter tails
     showing, 600 mm apart) | boxed (a flat soffit from the fascia back to the wall) | closed (a lining under the rafters, on the
     slope); rf.fascia (+ barge boards up the rakes, rf.fasciaH tall, 25 mm thick, rf.trimCol); rf.gutter none | quad | half
     (on the fascia, rf.gutterCol) + rf.downpipes (one near the end of each eave run, down the wall to the floor). Pure. */
  const EAVES = ["plain", "open", "boxed", "closed"], GUTTERS = ["none", "quad", "half"];
  function eaveParts(A, rf, tops, cnt, keyOf, P, dz, out, tag0) {
    const eave = EAVES.includes(rf.eave) ? rf.eave : "plain", fas = !!rf.fascia, gut = GUTTERS.includes(rf.gutter) && rf.gutter !== "none" ? rf.gutter : null;
    if (eave === "plain" && !fas && !gut) return;
    const s3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], a3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], m3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
    const d3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], c3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const n3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const newell = (R) => { let x = 0, y = 0, z = 0; R.forEach((p, i) => { const q = R[(i + 1) % R.length]; x += (p[1] - q[1]) * (p[2] + q[2]); y += (p[2] - q[2]) * (p[0] + q[0]); z += (p[0] - q[0]) * (p[1] + q[1]); }); return n3([x, y, z]); };
    const trim = rf.trimCol || DEF.trim, gcol = rf.gutterCol || "#d7d4cc", wood = "#9c7650";
    const face = (R, col, part, nHint) => { let n = newell(R); if (nHint && d3(n, nHint) < 0) { R = R.slice().reverse(); n = m3(n, -1); } out.polys.push({ rings: [R], n, col, tag: Object.assign({}, tag0, { part }), layer: "roof" }); };
    /** a cross-section prof [[o, u] ...] (CCW) swept from A to B: o along side, u along up (both across the sweep) */
    const sweep = (A0, B0, side, up, prof, col, part) => {
      const at = (Q, q) => a3(a3(Q, m3(side, q[0])), m3(up, q[1])), d = n3(s3(B0, A0));
      prof.forEach((q, i) => { const r = prof[(i + 1) % prof.length], nl = n3(a3(m3(side, r[1] - q[1]), m3(up, -(r[0] - q[0])))); face([at(A0, q), at(B0, q), at(B0, r), at(A0, r)], col, part, nl); out.roofLines.push([at(A0, q), at(B0, q)]); });
      face(prof.map((q) => at(A0, q)), col, part, m3(d, -1)); face(prof.map((q) => at(B0, q)), col, part, d);
    };
    /** a thin board under a quad (top corners given): its top, bottom (th lower) and sides */
    const slab = (Q, th, col, part) => {
      const low = Q.map((q) => [q[0], q[1], q[2] - th]);
      face(Q, col, part, [0, 0, 1]); face(low, col, part, [0, 0, -1]);
      Q.forEach((q, i) => { const r = Q[(i + 1) % Q.length], c = Q.reduce((a, x) => a3(a, m3(x, 1 / Q.length)), [0, 0, 0]), mid = m3(a3(q, r), 0.5); face([q, r, low[(i + 1) % Q.length], low[i]], col, part, n3([mid[0] - c[0], mid[1] - c[1], 0])); out.roofLines.push([q, r]); });
    };
    // the border lines: eaves (a face's lowest, the face rising away from it) and rakes (sloped)
    const eaves = [], rakes = [];
    tops.forEach((Q) => {
      const zmin = Math.min(...Q.map((p) => p[2])), cx = Q.reduce((a, p) => a + p[0], 0) / Q.length, cy = Q.reduce((a, p) => a + p[1], 0) / Q.length;
      Q.forEach((p, i) => {
        const q = Q[(i + 1) % Q.length]; if (cnt.get(keyOf(p, q)) > 1) return;
        const flat = Math.abs(p[2] - q[2]) < 1e-6;
        if (flat && Math.abs(p[2] - zmin) < 1e-6 && Q.some((r) => r[2] > zmin + 1e-6)) eaves.push({ p, q, Q, c: [cx, cy] });
        else if (!flat) rakes.push({ p, q, Q, c: [cx, cy] });
      });
    });
    const keyP = (p) => p.map((c) => c.toFixed(5)).join(",");
    const ends = new Map(); eaves.forEach((e) => [e.p, e.q].forEach((x) => ends.set(keyP(x), (ends.get(keyP(x)) || 0) + 1)));
    const corner = (x) => (ends.get(keyP(x)) || 0) > 1;
    const ft = 0.025, fh = Math.max(dz + 0.01, rf.fasciaH || 0.2), ov = rf.over || 0, gw = 0.125, gd = 0.1;
    const roomsZ = rf.rooms.map((id) => room(A, id)).filter(Boolean).map((R) => R.z), ground = roomsZ.length ? Math.min(...roomsZ) : 0;
    eaves.forEach((e) => {
      const pw = P(e.p[0], e.p[1], e.p[2]), qw = P(e.q[0], e.q[1], e.q[2]), dW = n3(s3(qw, pw)), cw = P(e.c[0], e.c[1], e.p[2]);
      let oW = n3([dW[1], -dW[0], 0]); if (d3(oW, s3(cw, pw)) > 0) oW = m3(oW, -1);           // out = away from the face
      const L = Math.hypot(qw[0] - pw[0], qw[1] - pw[1]), cp = corner(e.p), cq = corner(e.q);
      const hi = e.Q.reduce((b, r) => (r[2] > b[2] ? r : b), e.Q[0]), hw = P(hi[0], hi[1], hi[2]), run = Math.abs(d3(s3(hw, pw), oW)) || 1, tpe = (hw[2] - pw[2]) / run;   // its slope
      const ext = (k) => [a3(pw, m3(dW, cp ? -k : 0)), a3(qw, m3(dW, cq ? k : 0))];
      const Z = [0, 0, 1];
      if (fas) { const [A0, B0] = ext(ft); sweep(A0, B0, oW, Z, [[0, dz - fh], [ft, dz - fh], [ft, dz], [0, dz]], trim, "fascia"); }
      const back = (k) => m3(oW, -k), inner = (x, end) => a3(a3(x, back(ov)), m3(dW, end === "p" ? (cp ? ov : 0) : (cq ? -ov : 0)));
      if (ov > 0.02 && eave === "boxed") {                           // a flat soffit at the fascia's bottom, back to the wall
        const zb = (fas ? dz - fh : -0.05);
        slab([a3(pw, [0, 0, zb]), a3(qw, [0, 0, zb]), a3(inner(qw, "q"), [0, 0, zb]), a3(inner(pw, "p"), [0, 0, zb])], 0.012, trim, "soffit");
      }
      if (ov > 0.02 && eave === "closed") {                          // a lining on the rafters' underside (on the slope)
        const zi = ov * tpe - 0.004;
        slab([a3(pw, [0, 0, -0.004]), a3(qw, [0, 0, -0.004]), a3(inner(qw, "q"), [0, 0, zi]), a3(inner(pw, "p"), [0, 0, zi])], 0.012, trim, "soffit");
      }
      if (ov > 0.02 && eave === "open") {                            // rafter tails, 600 mm apart, out to the fascia
        const n = Math.max(1, Math.floor((L - 0.1) / 0.6)), off = (L - (n - 1) * 0.6) / 2, ax = n3(a3(back(1), [0, 0, tpe]));
        let up = n3(c3(dW, ax)); if (up[2] < 0) up = m3(up, -1);
        for (let k = 0; k < n; k++) {
          const t = off + k * 0.6; if ((cp && t < ov + 0.05) || (cq && t > L - ov - 0.05)) continue;
          const s0 = a3(a3(pw, m3(dW, t)), back(fas ? 0 : -0.02)), s1 = a3(a3(s0, back(ov)), [0, 0, ov * tpe]);
          sweep(s0, s1, dW, up, [[-0.0225, -0.09], [0.0225, -0.09], [0.0225, 0], [-0.0225, 0]], wood, "rafter");
        }
      }
      if (gut) {                                                     // the gutter on the fascia (open at the top)
        const o0 = fas ? ft : 0, top = dz - 0.02, bot = top - gd, t = 0.004, [A0, B0] = ext(o0 + gw);
        const prof = gut === "quad"
          ? [[o0, top], [o0, bot], [o0 + gw, bot], [o0 + gw, top + 0.01], [o0 + gw - t, top + 0.01], [o0 + gw - t, bot + t], [o0 + t, bot + t], [o0 + t, top]]
          : (() => { const r = gw / 2, c = [o0 + r, top], P0 = []; for (let i = 0; i <= 8; i++) { const a = Math.PI + Math.PI * i / 8; P0.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } for (let i = 8; i >= 0; i--) { const a = Math.PI + Math.PI * i / 8; P0.push([c[0] + (r - t) * Math.cos(a), c[1] + (r - t) * Math.sin(a)]); } return P0; })();
        sweep(A0, B0, oW, Z, prof, gcol, "gutter");
        if (rf.downpipes !== false) {                                // down the wall near the run's end, a pipe across to it
          const at = a3(qw, m3(dW, -Math.min(0.35, L / 2))), wall = a3(at, back(ov - 0.05)), zt = at[2] + bot - 0.12, pr = [[-0.045, -0.03], [0.045, -0.03], [0.045, 0.03], [-0.045, 0.03]];
          if (zt > ground + 0.3) {
            sweep([wall[0], wall[1], ground], [wall[0], wall[1], zt], dW, oW, pr.map(([a, b]) => [a, b + 0.035]), gcol, "downpipe");
            const g0 = a3(at, [oW[0] * (o0 + gw / 2), oW[1] * (o0 + gw / 2), bot]), w0 = [wall[0] + oW[0] * 0.035, wall[1] + oW[1] * 0.035, zt];
            const ax = n3(s3(w0, g0)); let up = n3(c3(ax, dW)); if (up[2] < 0) up = m3(up, -1);
            sweep(g0, w0, dW, up, [[-0.03, -0.025], [0.03, -0.025], [0.03, 0.025], [-0.03, 0.025]], gcol, "downpipe");
          }
        }
      }
    });
    if (fas) rakes.forEach((e) => {                                  // barge boards up the gable's verges
      const pw = P(e.p[0], e.p[1], e.p[2]), qw = P(e.q[0], e.q[1], e.q[2]), d = n3(s3(qw, pw)), cw = P(e.c[0], e.c[1], (e.p[2] + e.q[2]) / 2);
      let side = n3([d[1], -d[0], 0]); if (Math.hypot(side[0], side[1]) < 1e-6) return; if (d3(side, s3(cw, pw)) > 0) side = m3(side, -1);
      let up = n3(c3(side, d)); if (up[2] < 0) up = m3(up, -1);
      sweep(pw, qw, side, up, [[0, dz - fh], [ft, dz - fh], [ft, dz], [0, dz]], trim, "fascia");
    });
  }
  function roof(A, rf, out) {
    if (rf.type === "follow") {       // 2.624.0: each rectangle room's walls' tops, out past them by the eaves
      const tag = { ak: "roof", id: rf.id };
      rf.rooms.map((id) => room(A, id)).filter(Boolean).forEach((R) => {
        const fg = followGrid(R, true, rf.over); if (!fg) return;
        gridPolys(fg.rows, rf.th, true, rf.col, tag, "roof", out, out.roofLines);
        gridPolys(fg.rows, 0, false, rf.col, tag, "roof", out, null);
        const rows = fg.rows, ring2 = rows.map((r) => r[0]).concat(rows[rows.length - 1].slice(1), rows.map((r) => r[r.length - 1]).reverse().slice(1), rows[0].slice(1, -1).reverse());
        ring2.forEach((p, k) => { const q = ring2[(k + 1) % ring2.length], up = (x) => [x[0], x[1], x[2] + rf.th], c = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], ctr = centroid(R.pts), dv = norm(sub(c, ctr));
          out.polys.push({ rings: [[p, q, up(q), up(p)]], n: [dv[0], dv[1], 0], col: rf.col, tag, layer: "roof" }); out.roofLines.push([p, q]); });
      });
      return;
    }
    const F = roofFrame(A, rf); if (!F) return;
    let { o, V } = F; const { U, W, D, top, t } = F, ov = rf.over;
    if (rf.flip) { o = add(o, mul(V, D)); V = mul(V, -1); }              // 2.666.0: the other side high (skillion / saltbox)
    const tp = Math.tan(rf.pitch * Math.PI / 180), tag = { ak: "roof", id: rf.id }, col = rf.col;
    const P = (x, y, z) => [o[0] + U[0] * x + V[0] * y, o[1] + U[1] * x + V[1] * y, z];
    if (rf.type === "flat" || (tp < 1e-3 && rf.type !== "mansard" && rf.type !== "gambrel")) { const pts = [[-ov, -ov], [W + ov, -ov], [W + ov, D + ov], [-ov, D + ov]].map(([x, y]) => { const p = P(x, y, 0); return [p[0], p[1]]; }); prism(pts, top, top + rf.th, col, tag, out, "roof"); return; }
    const tl = rf.type === "gambrel" || rf.type === "mansard" ? Math.tan((rf.pitch2 != null ? rf.pitch2 : 60) * Math.PI / 180) : tp;
    const dz = rf.th / Math.cos(Math.atan(Math.max(tp, tl)));
    const SH = roofShape(rf.type, W, D, ov, top, tp, t, rf), tops = SH.tops;   // 2.666.0: every type's shape (roofShape)
    const nrm = (Q) => { const a = Q[0], b = Q[1], c = Q[2], x = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], y = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]], l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l]; };
    const W3 = (Q, k) => Q.map(([x, y, z]) => P(x, y, z + (k || 0)));   // Q = the underside (it sits on the walls' outer top edge); + dz = the top
    const keyOf = (p, q) => [p, q].map((x) => x.map((c) => c.toFixed(5)).join(",")).sort().join("|");
    const cnt = new Map(); tops.forEach((Q) => Q.forEach((p, i) => { const k = keyOf(p, Q[(i + 1) % Q.length]); cnt.set(k, (cnt.get(k) || 0) + 1); }));
    tops.forEach((Q) => {
      const a = W3(Q, dz), b = W3(Q), n = nrm(a);
      out.polys.push({ rings: [n[2] >= 0 ? a : a.slice().reverse()], n: n[2] >= 0 ? n : n.map((x) => -x), col, tag, layer: "roof" });
      out.polys.push({ rings: [n[2] >= 0 ? b.slice().reverse() : b], n: n[2] >= 0 ? n.map((x) => -x) : n, col, tag, layer: "roof" });
      Q.forEach((p, i) => {
        const q = Q[(i + 1) % Q.length], A2 = P(p[0], p[1], p[2] + dz), B2 = P(q[0], q[1], q[2] + dz);
        out.roofLines.push([A2, B2]);
        if (cnt.get(keyOf(p, q)) > 1) return;            // a ridge / hip: inside the roof
        const A3 = [A2[0], A2[1], A2[2] - dz], B3 = [B2[0], B2[1], B2[2] - dz];
        const mx = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], cx = [W / 2, D / 2], dir = [mx[0] - cx[0], mx[1] - cx[1]], wv = [U[0] * dir[0] + V[0] * dir[1], U[1] * dir[0] + V[1] * dir[1]], wl = Math.hypot(wv[0], wv[1]) || 1;
        out.polys.push({ rings: [[A2, A3, B3, B2]], n: [wv[0] / wl, wv[1] / wl, 0], col, tag, layer: "roof" });
        out.roofLines.push([A3, B3], [A2, A3]);
      });
    });
    eaveParts(A, rf, tops, cnt, keyOf, P, dz, out, tag);                  // 2.668.0: eaves, fascias, barge boards, gutters, downpipes
    // the gable ends (and a shed's high side) walled up under the roof, in the outside walls' colour
    const wallUp = (pts2, x0, x1) => { const Q = pts2; out.polys.push({ rings: [Q.map(([y, z]) => P(x0, y, z))], n: [-U[0], -U[1], 0], col: A.ext, tag, layer: "roof" }); out.polys.push({ rings: [Q.map(([y, z]) => P(x1, y, z)).reverse()], n: [U[0], U[1], 0], col: A.ext, tag, layer: "roof" });
      Q.forEach((p, i) => { const q = Q[(i + 1) % Q.length], d = [q[0] - p[0], q[1] - p[1]], l = Math.hypot(d[0], d[1]) || 1; out.polys.push({ rings: [[P(x0, p[0], p[1]), P(x1, p[0], p[1]), P(x1, q[0], q[1]), P(x0, q[0], q[1])]], n: [V[0] * d[1] / l, V[1] * d[1] / l, -d[0] / l], col: A.ext, tag, layer: "roof" }); out.roofLines.push([P(x0, p[0], p[1]), P(x0, q[0], q[1])], [P(x1, p[0], p[1]), P(x1, q[0], q[1])]); }); };
    SH.ups.forEach(([prof, x0, x1]) => wallUp(prof.slice().reverse(), x0, x1));
  }

  /* ---------------- moving rooms: the snap that shares a wall */
  /** the rooms ids moved by d (plan), their wall pulled onto a neighbour's within tol: -> {d, hit: {room, kind} | null} */
  function snapMove(A, ids, d, tol) {
    const mine = A.rooms.filter((R) => ids.includes(R.id)), others = A.rooms.filter((R) => !ids.includes(R.id));
    if (!mine.length || !others.length) return { d, hit: null };
    let best = null;
    mine.forEach((R) => edgesOf(R).forEach((e) => {
      if (e.L < EPS) return;
      const a = add(e.a, d), b = add(e.b, d), nl = left(e.u);
      others.forEach((Q) => {
        if (Math.abs(Q.z - R.z) > 0.01) return;
        edgesOf(Q).forEach((f) => {
          if (f.L < EPS || Math.abs(crs(e.u, f.u)) > 0.02) return;
          const off = dot(sub(f.a, a), nl); if (Math.abs(off) > tol) return;
          // they must face each other along the line (overlap, or nearly)
          const s0 = dot(a, f.u), s1 = dot(b, f.u), t0 = dot(f.a, f.u), t1 = dot(f.b, f.u);
          const ov = Math.min(Math.max(s0, s1), Math.max(t0, t1)) - Math.max(Math.min(s0, s1), Math.min(t0, t1)); if (ov < -tol) return;
          if (!best || Math.abs(off) < Math.abs(best.off)) best = { off, nl, e: { a, b }, f, Q, u: f.u };
        });
      });
    }));
    if (!best) return { d, hit: null };
    let D = add(d, mul(best.nl, best.off));
    // and along the shared line: a corner onto a corner
    let along = null;
    const ends = mine.flatMap((R) => R.pts.map((p) => add(p, D))), theirs = others.filter((Q) => Math.abs(Q.z - mine[0].z) < 0.01).flatMap((Q) => Q.pts);
    ends.forEach((p) => theirs.forEach((q) => { const dd = sub(q, p); if (Math.abs(dot(dd, left(best.u))) > 1e-6) return; const s = dot(dd, best.u); if (Math.abs(s) < tol && (!along || Math.abs(s) < Math.abs(along))) along = s; }));
    if (along != null) D = add(D, mul(best.u, along));
    return { d: D, hit: { room: best.Q.id, kind: along != null ? "corner" : "wall" } };
  }
  function moveRooms(A, ids, d) {
    if (!d || (Math.abs(d[0]) < 1e-12 && Math.abs(d[1]) < 1e-12)) return;
    A.rooms.forEach((R) => { if (ids.includes(R.id)) R.pts = R.pts.map((p) => add(p, d)); });
    A.lights.forEach((L) => { if (ids.includes(L.room)) { L.x += d[0]; L.y += d[1]; } });
  }
  function rotateRoom(A, id, deg) {
    const R = room(A, id); if (!R) return;
    const c = centroid(R.pts), a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    const rot = (p) => { const q = sub(p, c); return [r6(c[0] + q[0] * co - q[1] * si), r6(c[1] + q[0] * si + q[1] * co)]; };
    R.pts = R.pts.map(rot);
    A.lights.forEach((L) => { if (L.room === id) { const p = rot([L.x, L.y]); L.x = p[0]; L.y = p[1]; L.dir += deg; } });
  }
  /** a room's numbers changed: its lights keep to its ceiling / floor */
  function setRoom(A, id, patch) {
    const R = room(A, id); if (!R) return null;
    const top0 = R.z + R.h, z0 = R.z;
    Object.assign(R, patch);
    R.h = num(R.h, DEF.h, 0.1, 50); R.t = num(R.t, DEF.t, 0.02, 2); R.z = num(R.z, 0, -100, 1000);
    A.lights.forEach((L) => { if (L.room !== id) return; if (Math.abs(L.z - top0) < 0.02) L.z = R.z + R.h; else L.z += R.z - z0; });
    return R;
  }
  /** a room as a rectangle w × d (keeps its first corner and direction) */
  function resizeRect(A, id, w, d) {
    const R = room(A, id); if (!R || !R.closed || R.pts.length !== 4) return false;
    const e = edgesOf(R), u = e[0].u, v = left(u), p0 = R.pts[0];
    R.pts = [p0, add(p0, mul(u, w)), add(add(p0, mul(u, w)), mul(v, d)), add(p0, mul(v, d))].map((p) => [r6(p[0]), r6(p[1])]);
    return true;
  }
  /** 2.647.0 (Tim: "rooms will have width and length properties"): a room's size along its first wall (width) and across it
   *  (length) - the box round its centre line in that wall's frame. Any closed room, not only a rectangle. */
  function roomSize(R) {
    if (!R || !R.pts || R.pts.length < 2) return null;
    const e = edgesOf(R).find((x) => x.L > EPS); if (!e) return null;
    const u = e.u, v = left(u), p0 = R.pts[0];
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    R.pts.forEach((p) => { const d = sub(p, p0), a = dot(d, u), b = dot(d, v); u0 = Math.min(u0, a); u1 = Math.max(u1, a); v0 = Math.min(v0, b); v1 = Math.max(v1, b); });
    return { w: r6(u1 - u0), l: r6(v1 - v0), u, v, o: p0, u0, v0 };
  }
  /** 2.647.0: a room made w wide (along its first wall) and l long (across it) - a rectangle keeps its corner; any other shape
   *  is stretched from its box's corner, its doors / windows kept at the same place along their walls (in proportion) */
  function resizeRoom(A, id, w, l) {
    const R = room(A, id); if (!R || !R.closed || !(w > 0.05) || !(l > 0.05)) return false;
    const e = edgesOf(R);
    const rect = e.length === 4 && e.every((a, i) => Math.abs(dot(a.u, e[(i + 1) % 4].u)) < 1e-6);
    if (rect) return resizeRect(A, id, w, l);
    const S = roomSize(R); if (!S || S.w < EPS || S.l < EPS) return false;
    const kw = w / S.w, kl = l / S.l, L0 = e.map((x) => x.L);
    R.pts = R.pts.map((p) => { const d = sub(p, S.o), a = S.u0 + (dot(d, S.u) - S.u0) * kw, b = S.v0 + (dot(d, S.v) - S.v0) * kl; const q = add(add(S.o, mul(S.u, a)), mul(S.v, b)); return [r6(q[0]), r6(q[1])]; });
    const L1 = edgesOf(R).map((x) => x.L);
    A.ops.forEach((op) => { if (op.room === id && L0[op.edge] > EPS && L1[op.edge] != null) op.at = r6(op.at * L1[op.edge] / L0[op.edge]); });
    return true;
  }
  /** 2.648.0 (Tim: "pick tool to select a single object, ctrl+click will add to the selection"): several picked parts moved
   *  together by d [dx, dy] - a room (or one of its walls / parts) moves the whole room (its doors, windows and lights with
   *  it); furniture, lights, stairs, cameras and floors move by themselves; a door / window alone stays on its wall */
  function moveMany(A, tags, d) {
    if (!A || !tags || !d || (Math.abs(d[0]) < 1e-12 && Math.abs(d[1]) < 1e-12)) return;
    const ids = [...new Set(tags.filter((t) => t && (t.ak === "room" || ((t.ak === "wall" || t.ak === "wpt" || t.ak === "wtop") && t.room != null))).map((t) => (t.ak === "room" ? t.id : t.room)))];
    moveRooms(A, ids, d);
    const seen = new Set();
    tags.forEach((t) => {
      if (!t || seen.has(t.ak + ":" + t.id)) return; seen.add(t.ak + ":" + t.id);
      const x = ["item", "light", "stair", "cam", "slab"].includes(t.ak) ? find(A, t.ak, t.id) : null; if (!x) return;
      if (t.ak === "slab") { x.pts = x.pts.map((p) => [r6(p[0] + d[0]), r6(p[1] + d[1])]); return; }
      if (t.ak === "light" && ids.includes(x.room)) return;                 // moved with its room
      x.x = r6(x.x + d[0]); x.y = r6(x.y + d[1]);
    });
  }
  /** 2.648.0 (Tim: "add a zoom to selection tool"): the box round a picked part of the building {min, max} (3D, metres) |
   *  null - t = the Sketcher's pick {ak, id, part?, edge?, room?} (a room's wall: that wall; a roof: its rooms + its pitch) */
  function selBox(A, t) {
    if (!A || !t) return null;
    const P3 = []; const box = () => { if (!P3.length) return null; const mn = [0, 1, 2].map((k) => Math.min(...P3.map((p) => p[k]))), mx = [0, 1, 2].map((k) => Math.max(...P3.map((p) => p[k]))); return [...mn, ...mx].every(Number.isFinite) ? { min: mn, max: mx } : null; };
    const flat = (pts, z0, z1) => pts.forEach((p) => { P3.push([p[0], p[1], z0], [p[0], p[1], z1]); });
    const x = t.id != null ? find(A, t.ak, t.id) : null;
    if (t.ak === "room" || t.ak === "wall" || t.ak === "wpt" || t.ak === "wtop") {
      const R = room(A, t.ak === "room" ? t.id : (t.room != null ? t.room : t.id)); if (!R) return null;
      const e = t.edge != null ? edgesOf(R)[t.edge] : null;
      if (e && (t.part === "wall" || t.ak !== "room")) flat([e.a, e.b], R.z, R.z + R.h); else flat(R.pts, R.z, R.z + R.h);
      return box();
    }
    if (!x) return null;
    if (t.ak === "op") { const I = opInfo(A, x); if (!I) return null; flat(I.rect, I.z0, I.z1); return box(); }
    if (t.ak === "roof") { (x.rooms || []).forEach((id) => { const R = room(A, id); if (R) flat(R.pts, R.z, R.z + R.h + Math.max(1, (x.over || 0) + 2.5)); }); return box(); }
    if (t.ak === "slab") { flat(x.pts || [], (x.z || 0) - (x.th || 0.2), x.z || 0); return box(); }
    if (t.ak === "stair") { const a = x.ang * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]], o = [x.x - v[0] * x.w / 2, x.y - v[1] * x.w / 2];
      flat([o, [o[0] + u[0] * x.len, o[1] + u[1] * x.len], [o[0] + u[0] * x.len + v[0] * x.w, o[1] + u[1] * x.len + v[1] * x.w], [o[0] + v[0] * x.w, o[1] + v[1] * x.w]], x.z, x.z + x.rise); return box(); }
    if (t.ak === "item") { const r = Math.hypot(x.w || 0.5, x.d || 0.5) / 2; flat([[x.x - r, x.y - r], [x.x + r, x.y + r]], x.z || 0, (x.z || 0) + (x.h || 1)); return box(); }
    if (t.ak === "light") { flat([[x.x - 0.3, x.y - 0.3], [x.x + 0.3, x.y + 0.3]], x.z - 0.3, x.z + 0.3); return box(); }
    if (t.ak === "cam") { flat([[x.x - 0.6, x.y - 0.6], [x.x + 0.6, x.y + 0.6]], x.z - 0.6, x.z + 0.6); return box(); }
    return null;
  }
  function removeRoom(A, id) {
    A.rooms = A.rooms.filter((R) => R.id !== id);
    A.ops = A.ops.filter((x) => x.room !== id);
    A.lights = A.lights.filter((L) => L.room !== id);
    A.roofs.forEach((rf) => { rf.rooms = rf.rooms.filter((r) => r !== id); }); A.roofs = A.roofs.filter((rf) => rf.rooms.length);
  }
  function remove(A, ak, id) {
    if (ak === "room") { removeRoom(A, id); return true; }
    const key = { op: "ops", roof: "roofs", slab: "slabs", stair: "stairs", light: "lights", item: "items", cam: "cams", pool: "pools", drive: "drives" }[ak]; if (!key || !A[key]) return false;
    const n0 = A[key].length; A[key] = A[key].filter((x) => x.id !== id); return A[key].length < n0;
  }
  function duplicateRoom(A, id, d) {
    const R = room(A, id); if (!R) return null;
    const C = JSON.parse(JSON.stringify(R)); C.id = nid(A); C.name = R.name + " copy"; C.pts = C.pts.map((p) => add(p, d)); A.rooms.push(C);
    A.ops.filter((x) => x.room === id).forEach((x) => A.ops.push(Object.assign({}, x, { id: nid(A), room: C.id })));
    A.lights.filter((L) => L.room === id).forEach((L) => A.lights.push(Object.assign({}, L, { id: nid(A), room: C.id, x: L.x + d[0], y: L.y + d[1] })));
    return C;
  }
  /** the room (closed) whose inside holds p (plan) - the highest floor at or under z when z is given */
  function roomAt(A, p, z) {
    let best = null;
    A.rooms.forEach((R) => { if (!R.closed || !inPoly(p, R.pts)) return; if (z != null && R.z > z + 0.05) return; if (!best || R.z > best.z || (R.z === best.z && roomArea(R) < roomArea(best))) best = R; });
    return best;
  }
  /** the wall (any room's edge) nearest p within maxD: {room, edge, at, d, side} */
  function nearestWall(A, p, maxD, z) {
    let best = null;
    A.rooms.forEach((R) => {
      if (z != null && (z < R.z - 0.05 || z > R.z + R.h + 0.05)) return;
      edgesOf(R).forEach((e) => { if (e.L < EPS || isGone(R, e.i)) return; const s = segDist(p, e.a, e.b); if (s.d <= Math.max(maxD, tw(R, e.i) / 2 + 0.02) && (!best || s.d < best.d)) best = { R, room: R.id, edge: e.i, at: s.along, d: s.d, e, side: dot(sub(p, e.a), left(e.u)) >= 0 ? 1 : -1 }; });
    });
    return best;
  }
  function addOp(A, kind, w, o) {
    const d = OPS[kind]; if (!d || !w) return null;
    const x = Object.assign({ id: nid(A), kind, room: w.room, edge: w.edge, at: w.at, w: d.w, h: d.h, sill: d.sill, style: d.style, col: kind === "door" ? DEF.door : DEF.frame, flip: false, frameP: "", sillP: "", trimCol: DEF.trim }, o || {});
    A.ops.push(x); return x;
  }
  function addLight(A, type, p, o) {
    const d = LIGHTS[type]; if (!d) return null;
    const L = Object.assign({ id: nid(A), type, x: p[0], y: p[1], z: p[2], room: null, col: KELVIN[0][1], lm: d.lm, on: true, drop: d.drop || 0.6, ang: d.ang || 40, dir: 0 }, o || {});
    A.lights.push(L); return L;
  }
  /** where a light of this type goes when placed at p (plan) [+ the hit z]: the ceiling of the room under it, a wall, the floor */
  function lightSpot(A, type, p, hitZ) {
    const d = LIGHTS[type] || LIGHTS.downlight, R = roomAt(A, p, hitZ);
    if (d.mount === "ceil") return { z: R ? R.z + R.h : (hitZ != null ? hitZ : 0) + DEF.h, room: R ? R.id : null };
    if (d.mount === "floor") return { z: hitZ != null ? hitZ : R ? R.z : 0, room: R ? R.id : null };
    return { z: (R ? R.z : hitZ != null ? Math.max(0, hitZ - 1) : 0) + (d.hz || 1.8), room: R ? R.id : null };
  }
  function addRoof(A, rooms, o) {
    const ids = rooms.filter((r) => room(A, r)); if (!ids.length) return null;
    const rf = Object.assign({ id: nid(A), rooms: ids, type: "gable", pitch: 30, over: 0.4, th: 0.15, col: DEF.roof, ridge: "auto" }, o || {}, { rooms: ids });
    A.roofs.push(rf); return rf;
  }
  const level = (A, z) => A.rooms.filter((R) => R.closed && Math.abs(R.z - z) < 0.01).map((R) => R.id);
  function bbox(A) {
    const pts = [];
    A.rooms.forEach((R) => R.pts.forEach((p) => { pts.push([p[0], p[1], R.z]); pts.push([p[0], p[1], R.z + R.h]); }));
    A.slabs.forEach((s) => s.pts.forEach((p) => pts.push([p[0], p[1], s.z])));
    A.stairs.forEach((s) => { pts.push([s.x, s.y, s.z], [s.x + Math.cos(s.ang * Math.PI / 180) * s.len, s.y + Math.sin(s.ang * Math.PI / 180) * s.len, s.z + s.rise]); });
    A.lights.forEach((L) => pts.push([L.x, L.y, L.z]));
    (A.items || []).forEach((it) => { pts.push([it.x - it.w / 2, it.y - it.d / 2, it.z], [it.x + it.w / 2, it.y + it.d / 2, it.z + it.h]); });
    (A.cams || []).forEach((c) => pts.push([c.x - 0.5, c.y - 0.5, c.z - 0.5], [c.x + 0.5, c.y + 0.5, c.z + 0.5]));   // 2.633.0: zoom extents shows the cameras (+ their rings)
    A.roofs.forEach((rf) => { const F = roofFrame(A, rf); if (F) pts.push([F.o[0], F.o[1], F.top + F.D / 2 * Math.tan(rf.pitch * Math.PI / 180)]); });
    (A.drives || []).forEach((d) => (root.PPSite ? root.PPSite.driveOutline(d) : d.nodes.map((n) => n.p)).forEach((p) => pts.push([p[0], p[1], d.z])));   // 2.659.0
    (A.pools || []).forEach((q) => { const O = root.PPSite ? root.PPSite.outer(q) : q.pts; O.forEach((p) => { pts.push([p[0], p[1], q.z], [p[0], p[1], q.z - q.deep]); }); });   // 2.657.0
    if (A.terrain && root.PPTerrain) { const tb = root.PPTerrain.bounds(A.terrain); pts.push(tb.min, tb.max); }   // 2.653.0: the ground
    if (!pts.length) return null;
    const mn = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), mx = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
    return { min: mn, max: mx };
  }
  /** plan points worth snapping to (corners + wall middles) */
  function snapPoints(A, z) {
    const out = [];
    A.slabs.forEach((sl) => sl.pts.forEach((p, i) => { const q = sl.pts[(i + 1) % sl.pts.length]; out.push({ p: [p[0], p[1], z != null ? z : sl.z], kind: "Endpoint" }, { p: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z != null ? z : sl.z], kind: "Midpoint" }); }));   // 2.624.0: a floor's corners
    A.rooms.forEach((R) => { if (z != null && Math.abs(R.z - z) > 0.01) return; R.pts.forEach((p) => out.push({ p: [p[0], p[1], R.z], kind: "Endpoint" })); edgesOf(R).forEach((e) => out.push({ p: [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2, R.z], kind: "Midpoint" })); });
    return out;
  }

  /* ---------------- 2.625.0: a door / window's grips */
  /** l / r (its sides: the width), t (its top: the height), b (its bottom: the elevation - not a door) -> [{key, p (on the
      wall's centre line), sides: [p on each face of the wall]}] */
  function opHandles(A, op) {
    const I = opInfo(A, op); if (!I) return [];
    const zm = (I.z0 + I.z1) / 2, xm = (I.x0 + I.x1) / 2, k = I.T / 2 + 0.03;
    const at = (x, z) => [I.o[0] + I.u[0] * x, I.o[1] + I.u[1] * x, z];
    const H = [{ key: "l", p: at(I.x0, zm) }, { key: "r", p: at(I.x1, zm) }, { key: "t", p: at(xm, I.z1) }];
    if (op.kind !== "door") H.push({ key: "b", p: at(xm, I.z0) });
    H.forEach((h) => { h.sides = [-1, 1].map((sg) => [h.p[0] + I.nl[0] * k * sg, h.p[1] + I.nl[1] * k * sg, h.p[2]]); });
    return H;
  }
  /** a grip dragged to `along` (metres from its wall's start) / `z` (height): the width / height / elevation */
  function resizeOp(A, op, key, along, z) {
    const I = opInfo(A, op); if (!I) return false;
    const R = I.R, MIN = 0.2;
    if (key === "l" || key === "r") {
      let x0 = I.x0, x1 = I.x1;
      if (key === "l") x0 = Math.min(x1 - MIN, Math.max(0, along)); else x1 = Math.max(x0 + MIN, Math.min(I.e.L, along));
      op.w = r6(x1 - x0); op.at = r6((x0 + x1) / 2);
    } else if (key === "t") op.h = r6(Math.max(MIN, Math.min(R.h - op.sill, z - R.z - op.sill)));
    else if (key === "b") {
      if (op.kind === "door") return false;
      const top = op.sill + op.h, s0 = Math.max(0, Math.min(top - MIN, z - R.z));
      op.sill = r6(s0); op.h = r6(top - s0);
    } else return false;
    return true;
  }

  /* ---------------- 2.660.0 (Tim: "allow me to remove just 1 wall from a room, allow me to toggle walls to interior/exterior") */
  /** the other rooms' walls on the same line as R's wall i (overlapping it, parallel, within their half thicknesses) - [{R, i}] */
  function twinWalls(A, R, i) {
    const e = edgesOf(R)[i], out = []; if (!e || e.L < EPS) return out;
    (A.rooms || []).forEach((Q) => { if (Q === R || Q.z > R.z + R.h - 0.05 || Q.z + Q.h < R.z + 0.05) return; edgesOf(Q).forEach((f) => {
      if (f.L < EPS || isGone(Q, f.i) || Math.abs(crs(e.u, f.u)) > 0.02) return;
      const tol = (tw(R, i) + tw(Q, f.i)) / 2 + 0.01, d1 = segDist(f.a, e.a, e.b), d2 = segDist(f.b, e.a, e.b), m = segDist(mul(add(e.a, e.b), 0.5), f.a, f.b);
      const off = Math.abs(dot(sub(f.a, e.a), left(e.u))); if (off > tol) return;
      const s0 = dot(sub(f.a, e.a), e.u), s1 = dot(sub(f.b, e.a), e.u), over = Math.min(e.L, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1));
      if (over > 0.1 && (d1.d < tol || d2.d < tol || m.d < tol)) out.push({ R: Q, i: f.i });
    }); });
    return out;
  }
  /** take one wall out of a room (its doors / windows go with it; also: the walls of the rooms beside on the same line) -
      [{R, i}] taken out | null */
  function removeWall(A, id, i, withTwins) {
    const R = room(A, id), e = R && edgesOf(R)[i]; if (!e || isGone(R, i)) return null;
    const list = [{ R, i }].concat(withTwins ? twinWalls(A, R, i) : []);
    list.forEach((w) => { w.R.gone = (w.R.gone || []).concat([w.i]).sort((a, b) => a - b); });
    A.ops = (A.ops || []).filter((o) => !list.some((w) => w.R.id === o.room && w.i === o.edge));
    return list;
  }
  /** the walls taken out of a room back (i: just that one) -> how many */
  function restoreWalls(A, id, i) {
    const R = room(A, id); if (!R || !R.gone || !R.gone.length) return 0;
    const n0 = R.gone.length; R.gone = i == null ? [] : R.gone.filter((k) => k !== i); return n0 - R.gone.length;
  }
  /** a wall's kind: "int" (it has a room on both sides - or set so) | "ext" (one side outdoors - or set so); auto = none set:
      a point just past its outside face (a free wall: either face) inside another room's floor */
  function wallKind(A, R, i) {
    if (R.wkind && R.wkind[i]) return R.wkind[i];
    return autoKind(A, R, i);
  }
  function autoKind(A, R, i) {
    const e = edgesOf(R)[i]; if (!e) return "ext";
    const m = mul(add(e.a, e.b), 0.5), n = left(e.u), d = tw(R, i) / 2 + 0.08, z = R.z + 0.5;
    const probes = R.closed ? [sub(m, mul(n, d))] : [sub(m, mul(n, d)), add(m, mul(n, d))];
    const inRoom = (p) => (A.rooms || []).some((Q) => Q !== R && Q.closed && z > Q.z - 0.05 && z < Q.z + Q.h && inPoly(p, interior(Q) || []));
    return probes.some(inRoom) ? "int" : "ext";
  }
  /** set a wall interior / exterior (null / "auto": back to auto) */
  function setWallKind(A, id, i, k) {
    const R = room(A, id); if (!R || !edgesOf(R)[i]) return false;
    R.wkind = Object.assign({}, R.wkind || {});
    if (k === "int" || k === "ext") R.wkind[i] = k; else delete R.wkind[i];
    return true;
  }

  /* ---------------- 2.663.0 (Tim: "allow user to select segments of the wall after a split(dbl click) and delete / move the
     selected wall, if user moves the segment add walls on each side of the segment and join to the main room") */
  /** every per-wall record of a room after a point went in at position i + 1 (edge i split in two, s = where along it 0..1):
      the edges after it one on, edge i's own settings on both halves, its top's profile cut in two, its doors / windows on
      the half they are in; point-keyed records (jw) one on past it; the outline's hidden walls */
  function shiftEdges(A, R, i, s) {
    const up = (o, copy) => { if (!o || typeof o !== "object") return o; const out = {}; Object.keys(o).forEach((k) => { const j = +k; if (j < i) out[j] = o[k]; else if (j === i) { out[i] = o[k]; if (copy) out[i + 1] = JSON.parse(JSON.stringify(o[k])); } else out[j + 1] = o[k]; }); return out; };
    ["wcol", "wext", "wkind", "wt", "tw"].forEach((k) => { if (R[k]) R[k] = up(R[k], true); });
    if (R.gone && R.gone.length) R.gone = R.gone.flatMap((j) => (j < i ? [j] : j === i ? [i, i + 1] : [j + 1]));
    if (R.tops && R.tops[i]) {
      const P0 = R.tops[i], hS = topAt(R, i, s), a = P0.filter((q) => q[0] < s - 1e-9).map((q) => [q[0] / s, q[1]]).concat([[1, hS]]), b = [[0, hS]].concat(P0.filter((q) => q[0] > s + 1e-9).map((q) => [(q[0] - s) / (1 - s), q[1]]));
      R.tops = up(R.tops, false); R.tops[i] = a; R.tops[i + 1] = b; R.tops = cleanTops(R.tops, 1e9);
    } else if (R.tops) R.tops = up(R.tops, false);
    if (R.jw) { const out = {}; Object.keys(R.jw).forEach((k) => { const j = +k; out[j > i ? j + 1 : j] = R.jw[k]; }); R.jw = out; }
    (A.ops || []).forEach((o) => { if (o.room !== R.id) return; if (o.edge > i) o.edge++; else if (o.edge === i && o._L != null && o.at > o._L) { o.edge = i + 1; o.at -= o._L; } delete o._L; });
    if (A.hide && A.hide.length) A.hide = A.hide.flatMap((key) => { const m = new RegExp("^room:" + R.id + ":wall:(\\d+)$").exec(key); if (!m) return [key]; const j = +m[1]; return j < i ? [key] : j === i ? [key, "room:" + R.id + ":wall:" + (i + 1)] : ["room:" + R.id + ":wall:" + (j + 1)]; });
  }
  /** a wall split in two at a point (its nearest point on the wall's line; not within 5 cm of its ends) -> the new point's
      number | -1. Double-click a wall (Select) - each piece is then a wall of its own (picked, moved, taken out) */
  function splitWall(A, id, i, p, minEnd) {
    const R = room(A, id); if (!R) return -1;
    const e = edgesOf(R)[i]; if (!e || e.L < EPS) return -1;
    const at = Math.max(0, Math.min(e.L, dot(sub([p[0], p[1]], e.a), e.u))), me = minEnd == null ? 0.05 : minEnd;
    if (at < me || at > e.L - me) return -1;
    const q = [r6(e.a[0] + e.u[0] * at), r6(e.a[1] + e.u[1] * at)];
    (A.ops || []).forEach((o) => { if (o.room === R.id && o.edge === i) o._L = at; });
    shiftEdges(A, R, i, at / e.L);
    R.pts.splice(i + 1, 0, q);
    return i + 1;
  }
  /** before a wall is moved across its line: a wall beside it running straight on (a split) gets a point doubled where they
      meet - moved, the doubled point becomes a new short wall joining it to the rest of the room -> the wall's number now */
  function openEnds(A, id, i) {
    const R = room(A, id); if (!R) return i;
    const E = edgesOf(R), e = E[i]; if (!e || e.L < EPS) return i;
    const n = E.length, straight = (f) => f && f.L > EPS && Math.abs(crs(f.u, e.u)) < 1e-6 && dot(f.u, e.u) > 0;
    const opsOn = (k, L) => (A.ops || []).forEach((o) => { if (o.room === R.id && o.edge === k) o._L = L; });
    let k = i;
    const prev = R.closed ? E[(i - 1 + n) % n] : E[i - 1];
    if (straight(prev) && prev.i !== i) { opsOn(i, 0); shiftEdges(A, R, i, 0); R.pts.splice(i + 1, 0, R.pts[i].slice()); k = i + 1; }   // p_i doubled: edge i = the new short wall
    const E2 = edgesOf(R), n2 = E2.length, next = R.closed ? E2[(k + 1) % n2] : E2[k + 1];
    if (straight(next) && next.i !== k) { opsOn(k, Infinity); shiftEdges(A, R, k, 1); R.pts.splice(k + 1, 0, R.pts[(k + 1) % R.pts.length].slice()); }   // its far point doubled
    return k;
  }

  /** 2.664.0: an end piece's / a corner's size (w across, l past the end; null = as the wall) */
  function setJoint(A, id, k, o) { const R = room(A, id); if (!R || !R.pts[k]) return false; R.jw = Object.assign({}, R.jw || {}); const q = Object.assign({}, R.jw[k] || {}, o || {}); Object.keys(q).forEach((x) => { if (q[x] == null) delete q[x]; }); if (Object.keys(q).length) R.jw[k] = cleanJw({ 0: q }, 1)[0]; else delete R.jw[k]; if (!R.jw[k]) delete R.jw[k]; return true; }
  const api = { frames, tw, isGone, setJoint, cleanJw, splitWall, openEnds, shiftEdges, joints, jointAt, mitreQuads, hull2, twinWalls, removeWall, restoreWalls, wallKind, autoKind, setWallKind, cleanGone, cleanKind, frameWidth, wallCol, setWallHeight, setWallLength, chainsBetween, exterior, opHandles, resizeOp, profile, topAt, flatTop, minTop, cutTop, moveTopPoint, moveTopSeg, removeTopPoint, removeTopSeg, topHit, topPoints, followGrid, slabEdges, snapToFloor, offsetOnFloor, moveEdge, moveEdgeBy, hiddenOf, trims, snapEdge, cleanTops,
    cleanCons, cleanLabels, DEF, OPS, STYLES, ROOFS, ROOF_LABELS, ROOF_K, roofType, roofShape, roofIcon, EAVES, GUTTERS, eaveParts, LIGHTS, KELVIN, empty, of, has, clean, find, room, addRoom, rectPts, edgesOf, wallQuads, interior, opInfo, build, snapMove, moveRooms, rotateRoom, setRoom, resizeRect,
    removeRoom, remove, duplicateRoom, roomSize, resizeRoom, selBox, moveMany, wallOwner, wallExt, cleanTex, cleanBg, roomAt, nearestWall, addOp, addLight, lightSpot, addRoof, level, bbox, snapPoints, roofFrame, area2, inPoly, centroid, roomArea, segDist };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPArch = api;
})(typeof window !== "undefined" ? window : globalThis);
