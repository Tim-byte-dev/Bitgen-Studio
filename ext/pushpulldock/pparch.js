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
 *   roofs   {id, rooms [ids], type: gable | hip | shed | flat, pitch°, over (overhang), th, col, ridge: auto | u | v}
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
 * Pure (Node: scripts/test-arch620.js - with globalThis.polygonClipping = require(static/vendor/polygon-clipping.umd.min.js)). */
(function (root) {
  "use strict";
  const EPS = 1e-6;
  const PC = () => { const p = root.polygonClipping; if (!p) throw new Error("static/vendor/polygon-clipping.umd.min.js is not loaded"); return p; };
  const DEF = { h: 2.7, t: 0.15, wall: "#f4f1ea", floor: "#c8a882", ceil: "#fbfbf8", ext: "#e9e3d7", door: "#8b5a2b", frame: "#f4f4f4", glass: "#9ec5e8", roof: "#8a4f3d", stair: "#b08a62", slab: "#bdb7ab", top: "#d9d3c7" };
  const OPS = { door: { w: 0.9, h: 2.1, sill: 0, style: "single" }, window: { w: 1.2, h: 1.2, sill: 0.9, style: "double" }, opening: { w: 1.0, h: 2.1, sill: 0, style: "plain" } };
  const STYLES = { door: ["single", "double", "sliding", "glass"], window: ["single", "double", "slider"], opening: ["plain"] };
  const ROOFS = ["gable", "hip", "shed", "flat"];
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
  function inPoly(p, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
    return c;
  }
  function lineX(p, u, q, w) { const d = crs(u, w); if (Math.abs(d) < 1e-9) return null; const t = crs(sub(q, p), w) / d; return add(p, mul(u, t)); }
  function segDist(p, a, b) { const ab = sub(b, a), L = dot(ab, ab); let t = L ? dot(sub(p, a), ab) / L : 0; t = Math.max(0, Math.min(1, t)); return { d: len(sub(p, add(a, mul(ab, t)))), t, along: t * Math.sqrt(L) }; }
  const hex = (c, d) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : d);
  const num = (x, d, lo, hi) => { x = +x; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const pt2 = (p) => (Array.isArray(p) && p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1]) ? [+p[0], +p[1]] : null);
  const ring = (P) => { const R = P.map((p) => [p[0], p[1]]); R.push([P[0][0], P[0][1]]); return R; };

  /* ---------------- the data */
  function empty() { return { n: 1, ext: DEF.ext, rooms: [], ops: [], roofs: [], slabs: [], stairs: [], lights: [] }; }
  function of(M) { if (!M.arch) M.arch = empty(); return M.arch; }
  const has = (A) => !!(A && (A.rooms.length || A.slabs.length || A.stairs.length || A.lights.length || A.roofs.length));
  function clean(o) {
    const A = empty(); if (!o || typeof o !== "object") return A;
    A.ext = hex(o.ext, DEF.ext);
    const id = (x) => (Number.isInteger(+x) && +x > 0 ? +x : 0);
    A.rooms = (Array.isArray(o.rooms) ? o.rooms : []).map((R) => {
      if (!R || !Array.isArray(R.pts)) return null;
      const closed = R.closed !== false, pts = R.pts.map(pt2).filter(Boolean);
      if (pts.length < (closed ? 3 : 2)) return null;
      if (closed && area2(pts) < 0) pts.reverse();
      return { id: id(R.id), name: String(R.name || (closed ? "Room" : "Wall")).slice(0, 60), pts, closed, z: num(R.z, 0, -100, 1000), h: num(R.h, DEF.h, 0.1, 50), t: num(R.t, DEF.t, 0.02, 2),
        wall: hex(R.wall, DEF.wall), floor: hex(R.floor, DEF.floor), ceilCol: hex(R.ceilCol, DEF.ceil), floorOn: R.floorOn !== false, ceilOn: R.ceilOn !== false };
    }).filter(Boolean);
    const rid = new Set(A.rooms.map((R) => R.id));
    A.ops = (Array.isArray(o.ops) ? o.ops : []).map((x) => {
      if (!x || !OPS[x.kind] || !rid.has(+x.room)) return null;
      const d = OPS[x.kind];
      return { id: id(x.id), kind: x.kind, room: +x.room, edge: Math.max(0, Math.floor(+x.edge || 0)), at: num(x.at, 1, -1000, 1000), w: num(x.w, d.w, 0.2, 20), h: num(x.h, d.h, 0.2, 20), sill: num(x.sill, d.sill, 0, 20),
        style: STYLES[x.kind].includes(x.style) ? x.style : d.style, col: hex(x.col, x.kind === "door" ? DEF.door : DEF.frame), flip: !!x.flip };
    }).filter(Boolean);
    A.roofs = (Array.isArray(o.roofs) ? o.roofs : []).map((x) => {
      if (!x) return null; const rooms = (Array.isArray(x.rooms) ? x.rooms : []).map(Number).filter((r) => rid.has(r)); if (!rooms.length) return null;
      return { id: id(x.id), rooms, type: ROOFS.includes(x.type) ? x.type : "gable", pitch: num(x.pitch, 30, 0, 75), over: num(x.over, 0.4, 0, 5), th: num(x.th, 0.15, 0.02, 2), col: hex(x.col, DEF.roof), ridge: ["auto", "u", "v"].includes(x.ridge) ? x.ridge : "auto" };
    }).filter(Boolean);
    A.slabs = (Array.isArray(o.slabs) ? o.slabs : []).map((x) => { if (!x || !Array.isArray(x.pts)) return null; const pts = x.pts.map(pt2).filter(Boolean); if (pts.length < 3) return null; if (area2(pts) < 0) pts.reverse(); return { id: id(x.id), pts, z: num(x.z, 0, -100, 1000), th: num(x.th, 0.2, 0.01, 5), col: hex(x.col, DEF.slab) }; }).filter(Boolean);
    A.stairs = (Array.isArray(o.stairs) ? o.stairs : []).map((x) => (x ? { id: id(x.id), x: num(x.x, 0, -1e5, 1e5), y: num(x.y, 0, -1e5, 1e5), ang: num(x.ang, 0, -720, 720), w: num(x.w, 1, 0.3, 10), len: num(x.len, 3.6, 0.3, 50), rise: num(x.rise, 2.7, 0.1, 20), z: num(x.z, 0, -100, 1000), col: hex(x.col, DEF.stair) } : null)).filter(Boolean);
    A.lights = (Array.isArray(o.lights) ? o.lights : []).map((x) => {
      if (!x || !LIGHTS[x.type]) return null; const d = LIGHTS[x.type];
      return { id: id(x.id), type: x.type, x: num(x.x, 0, -1e5, 1e5), y: num(x.y, 0, -1e5, 1e5), z: num(x.z, 2.7, -100, 1000), room: rid.has(+x.room) ? +x.room : null, col: hex(x.col, KELVIN[0][1]),
        lm: num(x.lm, d.lm, 0, 100000), on: x.on !== false, drop: num(x.drop, d.drop || 0.6, 0.05, 10), ang: num(x.ang, d.ang || 40, 5, 85), dir: num(x.dir, 0, -720, 720) };
    }).filter(Boolean);
    // ids: kept unique, the counter past them all
    let mx = +o.n || 1; const seen = new Set();
    const all = [].concat(A.rooms, A.ops, A.roofs, A.slabs, A.stairs, A.lights);
    all.forEach((x) => { mx = Math.max(mx, x.id + 1); });
    all.forEach((x) => { if (!x.id || seen.has(x.id)) x.id = mx++; seen.add(x.id); });
    A.n = mx;
    return A;
  }
  const nid = (A) => A.n++;
  const room = (A, id) => A.rooms.find((R) => R.id === id) || null;
  const find = (A, ak, id) => { const L = { room: A.rooms, op: A.ops, roof: A.roofs, slab: A.slabs, stair: A.stairs, light: A.lights }[ak]; return L ? L.find((x) => x.id === id) || null : null; };

  /* ---------------- rooms, walls */
  function addRoom(A, pts, o) {
    const p = pts.map(pt2).filter(Boolean), closed = !(o && o.closed === false);
    if (p.length < (closed ? 3 : 2)) return null;
    if (closed && Math.abs(area2(p)) < 0.01) return null;
    if (closed && area2(p) < 0) p.reverse();
    const n = A.rooms.filter((R) => R.closed === closed).length + 1;
    const R = Object.assign({ id: nid(A), name: closed ? "Room " + n : "Wall " + n, pts: p, closed, z: 0, h: DEF.h, t: DEF.t, wall: DEF.wall, floor: DEF.floor, ceilCol: DEF.ceil, floorOn: true, ceilOn: true }, o || {}, { pts: p, closed });
    A.rooms.push(R); return R;
  }
  function rectPts(a, b) { const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]); return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  function edgesOf(R) {
    const P = R.pts, n = P.length, out = [];
    for (let i = 0; i < (R.closed ? n : n - 1); i++) { const a = P[i], b = P[(i + 1) % n], L = len(sub(b, a)); out.push({ i, a, b, L, u: norm(sub(b, a)) }); }
    return out;
  }
  /** each edge's wall as a mitred quad [left start, left end, right end, right start] (left = inside for a counter-clockwise room) */
  function wallQuads(R) {
    const E = edgesOf(R), h = R.t / 2, n = E.length;
    const corner = (e0, e1, s, at) => {        // the corner of side s (1 left / -1 right) between e0 and e1, at the vertex at
      const perp = add(at, mul(left(e1 ? e1.u : e0.u), s * h));
      if (!e0 || !e1 || e0.L < EPS || e1.L < EPS) return e1 ? add(at, mul(left(e1.u), s * h)) : add(at, mul(left(e0.u), s * h));
      const x = lineX(add(e0.a, mul(left(e0.u), s * h)), e0.u, add(e1.a, mul(left(e1.u), s * h)), e1.u);
      if (!x || len(sub(x, at)) > 6 * h + 1e-9) return perp;          // parallel / too sharp: square
      return x;
    };
    return E.map((e, k) => {
      if (e.L < EPS) return null;
      const prev = R.closed ? E[(k - 1 + n) % n] : E[k - 1], next = R.closed ? E[(k + 1) % n] : E[k + 1];
      const nl = left(e.u);
      const lS = prev ? corner(prev, e, 1, e.a) : add(e.a, mul(nl, h)), rS = prev ? corner(prev, e, -1, e.a) : add(e.a, mul(nl, -h));
      const lE = next ? corner(e, next, 1, e.b) : add(e.b, mul(nl, h)), rE = next ? corner(e, next, -1, e.b) : add(e.b, mul(nl, -h));
      return Object.assign({}, e, { nl, quad: [lS, lE, rE, rS] });
    }).filter(Boolean);
  }
  /** the room's inside (the floor / ceiling): its centre line moved in by half the wall */
  function interior(R) {
    if (!R.closed) return null;
    const E = edgesOf(R).filter((e) => e.L > EPS), n = E.length, h = R.t / 2, out = [];
    for (let k = 0; k < n; k++) {
      const e0 = E[(k - 1 + n) % n], e1 = E[k];
      const x = lineX(add(e0.a, mul(left(e0.u), h)), e0.u, add(e1.a, mul(left(e1.u), h)), e1.u);
      out.push(x && len(sub(x, e1.a)) < 6 * h + 1e-9 ? x : add(e1.a, mul(left(e1.u), h)));
    }
    return out;
  }
  const centroid = (P) => { let x = 0, y = 0; P.forEach((p) => { x += p[0]; y += p[1]; }); return [x / P.length, y / P.length]; };
  const roomArea = (R) => (R.closed ? Math.abs(area2(interior(R))) : 0);

  /** the opening's place on its wall (null: its wall is gone) - pushed clear of the corners */
  function opInfo(A, op) {
    const R = room(A, op.room); if (!R) return null;
    const e = edgesOf(R)[op.edge]; if (!e || e.L < EPS) return null;
    const m = R.t / 2 + 0.03, lo = op.w / 2 + m, hi = e.L - op.w / 2 - m;
    const at = hi >= lo ? Math.min(hi, Math.max(lo, op.at)) : e.L / 2;
    const c = add(e.a, mul(e.u, at)), nl = left(e.u);
    // the thickest wall on this line (a shared wall): the cut goes right through it
    let T = R.t;
    A.rooms.forEach((Q) => { if (Q === R || Math.abs(Q.z - R.z) > 0.01) return; edgesOf(Q).forEach((f) => { if (Math.abs(crs(f.u, e.u)) < 0.02 && segDist(c, f.a, f.b).d < 0.01) T = Math.max(T, Q.t); }); });
    const x0 = at - op.w / 2, x1 = at + op.w / 2, k = T / 2 + 0.03;
    const P = (x, y) => add(add(e.a, mul(e.u, x)), mul(nl, y));
    return { op, R, e, at, c, u: e.u, nl, T, x0, x1, o: e.a, z0: R.z + op.sill, z1: R.z + Math.min(op.sill + op.h, R.h), rect: [P(x0, -k), P(x1, -k), P(x1, k), P(x0, k)] };
  }

  /* ---------------- the geometry */
  function build(A, opt) {
    const out = { polys: [], lines: [], roofLines: [], lights: [] };
    if (!A) return out;
    const o = opt || {};
    walls(A, out);
    A.rooms.forEach((R) => {
      if (!R.closed) return;
      const inn = interior(R); if (!inn || Math.abs(area2(inn)) < 1e-4) return;
      if (R.floorOn) out.polys.push({ rings: [inn.map((p) => [p[0], p[1], R.z + 0.002])], n: [0, 0, 1], col: R.floor, tag: { ak: "room", id: R.id, part: "floor" }, layer: "main" });
      if (R.ceilOn) out.polys.push({ rings: [inn.map((p) => [p[0], p[1], R.z + R.h - 0.003]).reverse()], n: [0, 0, -1], col: R.ceilCol, tag: { ak: "room", id: R.id, part: "ceil" }, layer: "ceil" });
    });
    A.ops.forEach((op) => { const I = opInfo(A, op); if (I) fixture(I, out); });
    A.roofs.forEach((rf) => roof(A, rf, out));
    A.slabs.forEach((s) => prism(s.pts, s.z - s.th, s.z, s.col, { ak: "slab", id: s.id }, out));
    A.stairs.forEach((s) => stair(s, out));
    A.lights.forEach((L) => out.lights.push(Object.assign({}, L, { p: [L.x, L.y, L.z], def: LIGHTS[L.type] })));
    void o;
    return out;
  }
  /** the walls of every storey as one solid: bands between the heights where something changes, each band's plan the union of
   * the walls standing through it minus the openings cut through it */
  function walls(A, out) {
    const W = [];
    A.rooms.forEach((R) => wallQuads(R).forEach((q) => W.push({ poly: q.quad, z0: R.z, z1: R.z + R.h, R })));
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
      F.push(U);
    }
    const inner = A.rooms.filter((R) => R.closed).map((R) => ({ R, P: interior(R) }));
    const colOf = (p, z) => { const hit = inner.find((x) => z > x.R.z - EPS && z < x.R.z + x.R.h + EPS && inPoly(p, x.P)); return hit ? hit.R : null; };
    for (let k = 0; k < F.length; k++) {
      const a = zs[k], b = zs[k + 1], zm = (a + b) / 2;
      F[k].forEach((poly) => poly.forEach((rg) => {
        for (let j = 0; j + 1 < rg.length; j++) {
          const p = rg[j], q = rg[j + 1], d = sub(q, p), L = len(d); if (L < 1e-7) continue;
          const nO = [d[1] / L, -d[0] / L], R = colOf(add(mul(add(p, q), 0.5), mul(nO, 0.03)), zm);
          out.polys.push({ rings: [[[p[0], p[1], a], [q[0], q[1], a], [q[0], q[1], b], [p[0], p[1], b]]], n: [nO[0], nO[1], 0], col: R ? R.wall : A.ext, tag: { ak: "wall", room: R ? R.id : null }, layer: "main" });
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
      crease.forEach((poly) => poly.forEach((rg) => { for (let j = 0; j + 1 < rg.length; j++) out.lines.push([[rg[j][0], rg[j][1], z], [rg[j + 1][0], rg[j + 1][1], z]]); }));
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
      const handle = (hx) => { box(o, u, n, hx - 0.015, hx + 0.015, 0.02, 0.07, z0 + 0.98, z0 + 1.02, "#c0c0c0", tag, out, 1, true); box(o, u, n, hx - 0.015, hx + 0.015, -0.07, -0.02, z0 + 0.98, z0 + 1.02, "#c0c0c0", tag, out, 1, true); };
      if (op.style === "single") { box(o, u, n, a, b, -0.02, 0.02, z0 + 0.005, top, op.col, tag, out); handle(op.flip ? a + 0.08 : b - 0.08); }
      else if (op.style === "double") { const m = (a + b) / 2; box(o, u, n, a, m - 0.002, -0.02, 0.02, z0 + 0.005, top, op.col, tag, out); box(o, u, n, m + 0.002, b, -0.02, 0.02, z0 + 0.005, top, op.col, tag, out); handle(m - 0.06); handle(m + 0.06); }
      else if (op.style === "glass") {
        const s = 0.07; box(o, u, n, a, a + s, -0.02, 0.02, z0 + 0.005, top, op.col, tag, out); box(o, u, n, b - s, b, -0.02, 0.02, z0 + 0.005, top, op.col, tag, out);
        box(o, u, n, a + s, b - s, -0.02, 0.02, z0 + 0.005, z0 + 0.15, op.col, tag, out); box(o, u, n, a + s, b - s, -0.02, 0.02, top - s, top, op.col, tag, out);
        box(o, u, n, a + s, b - s, -0.005, 0.005, z0 + 0.15, top - s, DEF.glass, tag, out, 0.3, true); handle(op.flip ? a + 0.04 : b - 0.04);
      } else {                                 // sliding: two glass panels, one in front of the other
        const m = (a + b) / 2, pane = (p0, p1, y) => { box(o, u, n, p0, p1, y - 0.02, y + 0.02, z0 + 0.005, top, op.col, tag, out, 1, true); box(o, u, n, p0 + 0.05, p1 - 0.05, y - 0.006, y + 0.006, z0 + 0.06, top - 0.05, DEF.glass, tag, out, 0.3, true); };
        pane(a, m + 0.04, -0.025); pane(m - 0.04, b, 0.025);
        [[a, m + 0.04, -0.025], [m - 0.04, b, 0.025]].forEach(([p0, p1, y]) => { const P = (x, z) => [o[0] + u[0] * x + n[0] * y, o[1] + u[1] * x + n[1] * y, z]; out.lines.push([P(p0, z0), P(p1, z0)], [P(p1, z0), P(p1, top)], [P(p1, top), P(p0, top)], [P(p0, top), P(p0, z0)]); });
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
      const m = (a + b) / 2;
      box(o, u, n, a, m + 0.03, -0.03, -0.005, g0, g1, col, tag, out, 1, true); box(o, u, n, m - 0.03, b, 0.005, 0.03, g0, g1, col, tag, out, 1, true);
      box(o, u, n, a + 0.04, m - 0.01, -0.02, -0.014, g0 + 0.04, g1 - 0.04, DEF.glass, tag, out, 0.3, true); box(o, u, n, m + 0.01, b - 0.04, 0.014, 0.02, g0 + 0.04, g1 - 0.04, DEF.glass, tag, out, 0.3, true);
      return;
    }
    if (op.style === "double") { const m = (a + b) / 2; box(o, u, n, m - fw / 2, m + fw / 2, -d, d, g0, g1, col, tag, out); box(o, u, n, a, m - fw / 2, -0.005, 0.005, g0, g1, DEF.glass, tag, out, 0.3, true); box(o, u, n, m + fw / 2, b, -0.005, 0.005, g0, g1, DEF.glass, tag, out, 0.3, true); return; }
    box(o, u, n, a, b, -0.005, 0.005, g0, g1, DEF.glass, tag, out, 0.3, true);
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
    const u = e0.u, v = left(u), pts = Rs.flatMap((R) => wallQuads(R).flatMap((q) => q.quad));
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    pts.forEach((p) => { const a = dot(p, u), b = dot(p, v); u0 = Math.min(u0, a); u1 = Math.max(u1, a); v0 = Math.min(v0, b); v1 = Math.max(v1, b); });
    const top = Math.max(...Rs.map((R) => R.z + R.h)), t = Math.max(...Rs.map((R) => R.t));
    let W = u1 - u0, D = v1 - v0, o = add(mul(u, u0), mul(v, v0)), U = u, Vv = v;
    const along = rf.ridge === "u" ? true : rf.ridge === "v" ? false : W >= D;
    if (!along) { o = add(o, mul(u, W)); U = v; Vv = mul(u, -1); const k = W; W = D; D = k; }     // the ridge runs along U
    return { o, U, V: Vv, W, D, top, t };
  }
  function roof(A, rf, out) {
    const F = roofFrame(A, rf); if (!F) return;
    const { o, U, V, W, D, top, t } = F, ov = rf.over, tp = Math.tan(rf.pitch * Math.PI / 180), tag = { ak: "roof", id: rf.id }, col = rf.col;
    const P = (x, y, z) => [o[0] + U[0] * x + V[0] * y, o[1] + U[1] * x + V[1] * y, z];
    if (rf.type === "flat" || tp < 1e-3) { const pts = [[-ov, -ov], [W + ov, -ov], [W + ov, D + ov], [-ov, D + ov]].map(([x, y]) => { const p = P(x, y, 0); return [p[0], p[1]]; }); prism(pts, top, top + rf.th, col, tag, out, "roof"); return; }
    const dz = rf.th / Math.cos(Math.atan(tp)), eave = top - ov * tp;
    let tops = [];                             // the top surface: planar polygons (x, y, z) in the roof's frame
    if (rf.type === "shed") tops = [[[-ov, -ov, eave], [W + ov, -ov, eave], [W + ov, D + ov, top + (D + ov) * tp], [-ov, D + ov, top + (D + ov) * tp]]];
    else if (rf.type === "gable") {
      const rz = top + D / 2 * tp;
      tops = [[[-ov, -ov, eave], [W + ov, -ov, eave], [W + ov, D / 2, rz], [-ov, D / 2, rz]], [[-ov, D / 2, rz], [W + ov, D / 2, rz], [W + ov, D + ov, eave], [-ov, D + ov, eave]]];
    } else {                                   // hip: four slopes, the ridge D/2 in from each end
      const rz = top + D / 2 * tp, r1 = [D / 2, D / 2, rz], r2 = [Math.max(D / 2, W - D / 2), D / 2, rz];
      const c0 = [-ov, -ov, eave], c1 = [W + ov, -ov, eave], c2 = [W + ov, D + ov, eave], c3 = [-ov, D + ov, eave];
      tops = W - D > 1e-6 ? [[c0, c1, r2, r1], [c2, c3, r1, r2], [c3, c0, r1], [c1, c2, r2]] : [[c0, c1, r1], [c1, c2, r1], [c2, c3, r1], [c3, c0, r1]];
    }
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
    // the gable ends (and a shed's high side) walled up under the roof, in the outside walls' colour
    const wallUp = (pts2, x0, x1) => { const Q = pts2; out.polys.push({ rings: [Q.map(([y, z]) => P(x0, y, z))], n: [-U[0], -U[1], 0], col: A.ext, tag, layer: "roof" }); out.polys.push({ rings: [Q.map(([y, z]) => P(x1, y, z)).reverse()], n: [U[0], U[1], 0], col: A.ext, tag, layer: "roof" });
      Q.forEach((p, i) => { const q = Q[(i + 1) % Q.length], d = [q[0] - p[0], q[1] - p[1]], l = Math.hypot(d[0], d[1]) || 1; out.polys.push({ rings: [[P(x0, p[0], p[1]), P(x1, p[0], p[1]), P(x1, q[0], q[1]), P(x0, q[0], q[1])]], n: [V[0] * d[1] / l, V[1] * d[1] / l, -d[0] / l], col: A.ext, tag, layer: "roof" }); out.roofLines.push([P(x0, p[0], p[1]), P(x0, q[0], q[1])], [P(x1, p[0], p[1]), P(x1, q[0], q[1])]); }); };
    if (rf.type === "gable") { const tri = [[0, top], [D, top], [D / 2, top + D / 2 * tp]]; wallUp(tri.slice().reverse(), 0, t); wallUp(tri.slice().reverse(), W - t, W); }
    if (rf.type === "shed") { const tri = [[0, top], [D, top], [D, top + D * tp]]; wallUp(tri.slice().reverse(), 0, t); wallUp(tri.slice().reverse(), W - t, W); wallUp([[D - t, top], [D, top], [D, top + D * tp], [D - t, top + (D - t) * tp]].reverse(), t, W - t); }
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
  function removeRoom(A, id) {
    A.rooms = A.rooms.filter((R) => R.id !== id);
    A.ops = A.ops.filter((x) => x.room !== id);
    A.lights = A.lights.filter((L) => L.room !== id);
    A.roofs.forEach((rf) => { rf.rooms = rf.rooms.filter((r) => r !== id); }); A.roofs = A.roofs.filter((rf) => rf.rooms.length);
  }
  function remove(A, ak, id) {
    if (ak === "room") { removeRoom(A, id); return true; }
    const key = { op: "ops", roof: "roofs", slab: "slabs", stair: "stairs", light: "lights" }[ak]; if (!key) return false;
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
      edgesOf(R).forEach((e) => { if (e.L < EPS) return; const s = segDist(p, e.a, e.b); if (s.d <= Math.max(maxD, R.t / 2 + 0.02) && (!best || s.d < best.d)) best = { R, room: R.id, edge: e.i, at: s.along, d: s.d, e, side: dot(sub(p, e.a), left(e.u)) >= 0 ? 1 : -1 }; });
    });
    return best;
  }
  function addOp(A, kind, w, o) {
    const d = OPS[kind]; if (!d || !w) return null;
    const x = Object.assign({ id: nid(A), kind, room: w.room, edge: w.edge, at: w.at, w: d.w, h: d.h, sill: d.sill, style: d.style, col: kind === "door" ? DEF.door : DEF.frame, flip: false }, o || {});
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
    A.roofs.forEach((rf) => { const F = roofFrame(A, rf); if (F) pts.push([F.o[0], F.o[1], F.top + F.D / 2 * Math.tan(rf.pitch * Math.PI / 180)]); });
    if (!pts.length) return null;
    const mn = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), mx = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
    return { min: mn, max: mx };
  }
  /** plan points worth snapping to (corners + wall middles) */
  function snapPoints(A, z) {
    const out = [];
    A.rooms.forEach((R) => { if (z != null && Math.abs(R.z - z) > 0.01) return; R.pts.forEach((p) => out.push({ p: [p[0], p[1], R.z], kind: "Endpoint" })); edgesOf(R).forEach((e) => out.push({ p: [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2, R.z], kind: "Midpoint" })); });
    return out;
  }

  const api = { DEF, OPS, STYLES, ROOFS, LIGHTS, KELVIN, empty, of, has, clean, find, room, addRoom, rectPts, edgesOf, wallQuads, interior, opInfo, build, snapMove, moveRooms, rotateRoom, setRoom, resizeRect,
    removeRoom, remove, duplicateRoom, roomAt, nearestWall, addOp, addLight, lightSpot, addRoof, level, bbox, snapPoints, roofFrame, area2, inPoly, centroid, roomArea, segDist };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPArch = api;
})(typeof window !== "undefined" ? window : globalThis);
