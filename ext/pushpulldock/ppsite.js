/* bitGen Studio — ext/pushpulldock/ppsite.js (2.657.0): THE SITE of the 📏 Sketcher - swimming pools (window.PPSite /
 * require()); 2.658.0 adds the driveways.
 *
 * Tim (verbatim): "... and a swimming pool creator(with edge tiles or decking) and a driveway tool that can be adjusted with
 * bezier curves."
 *
 * The model keeps them in M.arch (saved with it, undone with it):
 *   pools  [{id, name, pts (its inside edge, counter-clockwise), z (the water's edge / coping level), shallow, deep (m),
 *           deepAt 0 | 1 (which end of its length is deep), edge tiles | deck | both | none, edgeW (the coping tiles' width),
 *           deckW (the decking's width), lining / edgeCol / deckCol (a colour, "mat:<key>" or "tex:<id>"), water (bool),
 *           waterCol}]
 *   clean(list)   build(A, out, hid)  the polygons pparch.build() draws (the water, the tiled shell, the coping, the decking)
 *   outer(pool)   its outside edge (the coping + decking)  - holes(A) the ground cut away under every pool (ppterrain.js)
 *   offset(P, d)  a counter-clockwise outline moved out by d (mitred);  depthAt(pool, p);  axis(pool);  volume(pool) m³
 *   panel(kit, pool, A)  its settings in the Sketcher's panel (pparchtools.js props)
 * Pure parts tested in Node: scripts/test-pool657.js; the clicks: scripts/test-ui657-ui.js. */
(function (root) {
  "use strict";
  const DEF = { lining: "#5fb6d9", edgeCol: "mat:tile", deckCol: "mat:oak", water: "#3aa3d4" };
  const EDGES = [["tiles", "Edge tiles (coping)"], ["deck", "Decking"], ["both", "Edge tiles + decking"], ["none", "No edge"]];
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const num = (v, d, lo, hi) => { const x = +v; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const colOk = (c, d) => (typeof c === "string" && (/^#[0-9a-f]{6}$/i.test(c) || /^(mat:[a-z_]{2,24}|tex:[a-z0-9_]{1,24})$/.test(c)) ? c.toLowerCase() : d);
  const area2 = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

  function cleanPool(o) {
    if (!o || !Array.isArray(o.pts)) return null;
    const pts = o.pts.slice(0, 200).filter((p) => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1])).map((p) => [r3(+p[0]), r3(+p[1])]);
    if (pts.length < 3 || Math.abs(area2(pts)) < 0.05) return null;
    if (area2(pts) < 0) pts.reverse();
    const shallow = num(o.shallow, 1.0, 0.2, 6), deep = num(o.deep, 1.8, 0.2, 6);
    return { id: Number.isInteger(+o.id) && +o.id > 0 ? +o.id : 0, name: String(o.name || "Pool").slice(0, 60), pts, z: r3(num(o.z, 0, -100, 1000)), shallow, deep, deepAt: +o.deepAt === 0 ? 0 : 1,
      edge: EDGES.some((e) => e[0] === o.edge) ? o.edge : "tiles", edgeW: num(o.edgeW, 0.35, 0.05, 2), deckW: num(o.deckW, 1.5, 0.1, 10),
      lining: colOk(o.lining, DEF.lining), edgeCol: colOk(o.edgeCol, DEF.edgeCol), deckCol: colOk(o.deckCol, DEF.deckCol), water: o.water !== false, waterCol: colOk(o.waterCol, DEF.water) };
  }
  const clean = (list) => (Array.isArray(list) ? list : []).slice(0, 50).map(cleanPool).filter(Boolean);

  /** a counter-clockwise outline moved OUT by d (each corner mitred; a very sharp one capped) */
  function offset(P, d) {
    const n = P.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
      const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]], l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
      const n1 = [e1[1] / l1, -e1[0] / l1], n2 = [e2[1] / l2, -e2[0] / l2];      // the outside of a counter-clockwise edge is its right
      const k = 1 + n1[0] * n2[0] + n1[1] * n2[1], m = [n1[0] + n2[0], n1[1] + n2[1]];
      let f = k > 1e-6 ? d / k : d; const L = Math.hypot(m[0], m[1]) * f; if (L > 4 * Math.abs(d)) f *= 4 * Math.abs(d) / L;   // a sharp corner capped
      out.push([r3(b[0] + m[0] * f), r3(b[1] + m[1] * f)]);
    }
    return out;
  }
  /** its length's direction (the longest edge) and where the outline starts / ends along it */
  function axis(q) {
    let best = null; q.pts.forEach((a, i) => { const b = q.pts[(i + 1) % q.pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || L > best.L + 1e-9) best = { L, u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] }; });
    const u = best.u, t = q.pts.map((p) => p[0] * u[0] + p[1] * u[1]);
    return { u, t0: Math.min.apply(null, t), t1: Math.max.apply(null, t) };
  }
  /** the depth at a plan point: shallow at one end of its length, deep at the other, a straight slope between */
  function depthAt(q, p, ax) {
    const A = ax || axis(q), L = A.t1 - A.t0; let f = L > 1e-9 ? (p[0] * A.u[0] + p[1] * A.u[1] - A.t0) / L : 0;
    f = Math.min(1, Math.max(0, f)); if (q.deepAt === 0) f = 1 - f;
    return q.shallow + (q.deep - q.shallow) * f;
  }
  const outerW = (q) => (q.edge === "tiles" ? q.edgeW : q.edge === "deck" ? q.deckW : q.edge === "both" ? q.edgeW + q.deckW : 0);
  const outer = (q) => (outerW(q) > 0 ? offset(q.pts, outerW(q)) : q.pts.map((p) => p.slice()));
  /** the ground cut away under the pools (their outside edge) */
  const holes = (A) => ((A && A.pools) || []).map(outer);
  /** the water it holds (m³) */
  function volume(q) {
    // the floor is a plane, so the mean depth over the outline = the depth at the outline's centroid
    let cx = 0, cy = 0, a = 0; const P = q.pts;
    for (let i = 0; i < P.length; i++) { const p = P[i], r = P[(i + 1) % P.length], c = p[0] * r[1] - r[0] * p[1]; a += c; cx += (p[0] + r[0]) * c; cy += (p[1] + r[1]) * c; }
    a /= 2; cx /= 6 * a; cy /= 6 * a;
    return r3(Math.abs(a) * (depthAt(q, [cx, cy]) - 0.12));
  }

  /* ---------------- the geometry (pparch.build's polygons: {rings, n, col, alpha, tag, layer}) */
  function build(A, out, hid) {
    ((A && A.pools) || []).forEach((q) => {
      if (hid && hid("pool:" + q.id)) return;
      const ax = axis(q), Z = (p) => q.z - depthAt(q, p, ax), tag = (part) => ({ ak: "pool", id: q.id, part });
      const n = q.pts.length;
      // the walls inside: each edge from the edge level down to the floor (facing in)
      for (let i = 0; i < n; i++) {
        const a = q.pts[i], b = q.pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
        const nl = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L, 0];          // a counter-clockwise outline's inside is its left
        out.polys.push({ rings: [[[a[0], a[1], q.z], [a[0], a[1], Z(a)], [b[0], b[1], Z(b)], [b[0], b[1], q.z]]], n: nl, col: q.lining, tag: tag("wall"), layer: "main" });
        out.lines.push([[a[0], a[1], q.z], [b[0], b[1], q.z]], [[a[0], a[1], q.z], [a[0], a[1], Z(a)]]);
      }
      // the floor: a plane sloping from the shallow end to the deep end
      const fl = q.pts.map((p) => [p[0], p[1], Z(p)]);
      const k = (q.deep - q.shallow) / Math.max(1e-9, ax.t1 - ax.t0) * (q.deepAt === 0 ? -1 : 1), nf = [ax.u[0] * k, ax.u[1] * k, 1], nn = Math.hypot(nf[0], nf[1], nf[2]);
      out.polys.push({ rings: [fl], n: [nf[0] / nn, nf[1] / nn, nf[2] / nn], col: q.lining, tag: tag("floor"), layer: "main" });
      // the water, a little under the edge
      if (q.water) out.polys.push({ rings: [q.pts.map((p) => [p[0], p[1], q.z - 0.12])], n: [0, 0, 1], col: q.waterCol, alpha: 0.55, tag: tag("water"), layer: "main" });
      // the coping tiles and / or the decking round it
      const band = (w0, w1, col, part, dz) => {
        const inn = w0 > 0 ? offset(q.pts, w0) : q.pts, ou = offset(q.pts, w1);
        out.polys.push({ rings: [ou.map((p) => [p[0], p[1], q.z + dz]), inn.slice().reverse().map((p) => [p[0], p[1], q.z + dz])], n: [0, 0, 1], col, tag: tag(part), layer: "main" });
        // its outer face down to the ground (a step when it stands proud of it)
        for (let i = 0; i < ou.length; i++) { const a = ou[i], b = ou[(i + 1) % ou.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
          out.polys.push({ rings: [[[a[0], a[1], q.z + dz], [b[0], b[1], q.z + dz], [b[0], b[1], q.z - 0.15], [a[0], a[1], q.z - 0.15]]], n: [(b[1] - a[1]) / L, -(b[0] - a[0]) / L, 0], col, tag: tag(part), layer: "main" }); }
        out.lines.push(...ou.map((a, i) => [[a[0], a[1], q.z + dz], [ou[(i + 1) % ou.length][0], ou[(i + 1) % ou.length][1], q.z + dz]]));
      };
      if (q.edge === "tiles" || q.edge === "both") band(0, q.edgeW, q.edgeCol, "coping", 0.03);
      if (q.edge === "deck") band(0, q.deckW, q.deckCol, "deck", 0.04);
      if (q.edge === "both") band(q.edgeW, q.edgeW + q.deckW, q.deckCol, "deck", 0.04);
    });
  }

  /** a pool from two corners (a rectangle) or the clicked corners (a free shape) */
  function make(A, pts, o) {
    o = o || {};
    const q = cleanPool(Object.assign({ name: "Pool " + (((A && A.pools) || []).length + 1) }, o, { pts, id: A ? A.n++ : 1 }));
    if (!q) return null;
    if (A) { if (!A.pools) A.pools = []; A.pools.push(q); }
    return q;
  }
  const rect = (a, b) => { const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]); return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; };
  function size(q) { const ax = axis(q), v = [-ax.u[1], ax.u[0]], s = q.pts.map((p) => p[0] * v[0] + p[1] * v[1]); return { l: r3(ax.t1 - ax.t0), w: r3(Math.max.apply(null, s) - Math.min.apply(null, s)) }; }
  /** a rectangle pool resized about its first corner (along its length / across) */
  function resize(q, l, w) {
    if (q.pts.length !== 4) return false;
    const ax = axis(q), u = ax.u, v = [-u[1], u[0]];
    const s0 = Math.min.apply(null, q.pts.map((p) => p[0] * v[0] + p[1] * v[1])), t0 = ax.t0;
    const o = [u[0] * t0 + v[0] * s0, u[1] * t0 + v[1] * s0];
    q.pts = [[0, 0], [l, 0], [l, w], [0, w]].map(([a, b]) => [r3(o[0] + u[0] * a + v[0] * b), r3(o[1] + u[1] * a + v[1] * b)]);
    return true;
  }

  /* ---------------- its panel (pparchtools.js props) - kit = {head, numIn, selIn, chkIn, matIn, btns, hint, ch, erase} */
  function panel(kit, q) {
    const S = size(q);
    kit.head("🏊 " + q.name + " · " + volume(q) + " m³ of water");
    if (q.pts.length === 4) { kit.numIn("Length", S.l, kit.ch((v) => { resize(q, Math.max(0.5, v), S.w); }), 0.1, 0.5, 100, "m"); kit.numIn("Width", S.w, kit.ch((v) => { resize(q, S.l, Math.max(0.5, v)); }), 0.1, 0.5, 100, "m"); }
    kit.numIn("Water's edge at", q.z, kit.ch((v) => { q.z = v; }), 0.05, -100, 1000, "m");
    kit.numIn("Shallow end", q.shallow, kit.ch((v) => { q.shallow = v; }), 0.1, 0.2, 6, "m");
    kit.numIn("Deep end", q.deep, kit.ch((v) => { q.deep = v; }), 0.1, 0.2, 6, "m");
    kit.btns([["⇄ Swap the deep end", kit.ch(() => { q.deepAt = q.deepAt ? 0 : 1; })]]);
    kit.selIn("Edge", q.edge, EDGES, kit.ch((v) => { q.edge = v; }));
    if (q.edge === "tiles" || q.edge === "both") { kit.numIn("Edge tiles' width", q.edgeW, kit.ch((v) => { q.edgeW = v; }), 0.05, 0.05, 2, "m"); kit.matIn("Edge tiles", q.edgeCol, kit.ch((v) => { q.edgeCol = v; })); }
    if (q.edge === "deck" || q.edge === "both") { kit.numIn("Decking's width", q.deckW, kit.ch((v) => { q.deckW = v; }), 0.1, 0.1, 10, "m"); kit.matIn("Decking", q.deckCol, kit.ch((v) => { q.deckCol = v; })); }
    kit.matIn("Lining (tiles)", q.lining, kit.ch((v) => { q.lining = v; }));
    kit.chkIn("Water", q.water, kit.ch((v) => { q.water = v; }));
    if (q.water) kit.colIn("Water colour", q.waterCol, kit.ch((v) => { q.waterCol = v; }));
    kit.btns([["🗑 Delete", kit.erase]]);
    kit.hint("Drag it (Select) · Delete removes it. Made on the ⛰ ground, the ground is cut and levelled round it.");
  }

  const api = { DEF, EDGES, clean, cleanPool, offset, axis, depthAt, outer, outerW, holes, volume, build, make, rect, size, resize, panel, area2 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPSite = api;
})(typeof window !== "undefined" ? window : globalThis);
