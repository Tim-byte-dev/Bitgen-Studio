/* bitGen Studio — ext/pushpulldock/ppplan.js (2.647.0): THE SKETCHER'S FLOORPLAN VIEW (window.PPPlan / require()).
 *
 * Tim (verbatim): "add floorplan view to sketcher, the buttons will still draw what they are set too but with floorplan
 * symbols in floorplan mode. esc deselects all tools and changes to orbit mode in all views, rooms will have width and length
 * properties"
 *
 * 📐 Floorplan (the toolbar button, View ▾ Floorplan): the view looks straight down (parallel), in the app's theme colours
 *   (2.649.0 - it was on paper), one storey at a time,
 * and the building is drawn as a plan - cut through the walls:
 *   walls       solid (poché) - every room's walls on that storey as one shape, the doors / windows / openings cut out of it
 *   rooms       a light floor + the room's name, its Width × Length and its area in the middle
 *   doors       the leaf open 90° into the room + its swing (a quarter circle) - single (hinge side = its Flip), double (two
 *               leaves), sliding (two panels), an opening = the header dashed
 *   windows     the wall's two faces + the glass (one line, two for two panes, two offset for a slider) + the sill outside
 *   stairs      the outline, every tread, the walking line with its arrow and UP
 *   furniture   its outline (on white) and its name;  lights  a circle and a cross;  floors (slabs)  a thin outline
 *   cameras     as in 3D (picked, moved, turned the same way)
 * Every tool works as in 3D (what it makes is drawn with these symbols); a click picks a plan symbol (a door / window, a
 * light, a piece, the stairs, a wall, a room). Orbit turns the plan round (it stays flat); pan / zoom as always. Iso / Top /
 * Front ... or a camera's view leaves it; so does the 📐 button again (the 3D view comes back as it was).
 *
 *   pure: levels(A) the storeys' floor levels;  symbols(A, z, o) -> {fills, lines, texts};  pickAt(A, p, z) -> a tag | null
 *   three: attach(V, AV) -> plan {on(), set(v), level(), setLevel(z), levels(), rebuild()}   V = ppview, AV = pparchview
 * Node: scripts/test-plan647.js (with globalThis.polygonClipping). */
(function (root) {
  "use strict";
  const P = () => root.PPArch || (typeof require === "function" ? require("./pparch.js") : null);
  const PC = () => root.polygonClipping || null;
  const EPS = 1e-6;
  const COL0 = { fill: "#ffffff", grid: "#e3ded2", floorBase: "", paper: "#f7f5f0", wall: "#2b2c30", wallIn: "#7d7f86", seam: "#a3a5ab", ink: "#2b2c30", glass: "#2f7fc4", door: "#3a3b40", stair: "#55575d", furn: "#6b6d73", light: "#c58b00", slab: "#8d8f95", text: "#1f2024", dim: "#5b5d63" };
  const sameZ = (a, b) => Math.abs(a - b) < 0.01;
  const r4 = (x) => Math.round(x * 1e4) / 1e4;

  /** the storeys: every room's floor level (lowest first) */
  function levels(A) {
    const zs = [];
    ((A && A.rooms) || []).forEach((R) => { if (Number.isFinite(R.z) && !zs.some((z) => sameZ(z, R.z))) zs.push(R.z); });
    return zs.sort((a, b) => a - b);
  }
  const rgbOf = (h) => { let m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); if (!m) { const s3 = /^#?([0-9a-f]{3})$/i.exec(String(h || "")); if (s3) m = [0, s3[1].split("").map((x) => x + x).join("")]; } if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  /** a floor colour from the room's (a material / #rgb / #rrggbb) - mostly the base (default paper 72 %; 2.649.0: the floorplan
   *  passes the theme's panel colour) */
  function tint(c, hex, base, k) {
    const B = rgbOf(base || "#f7f5f0") || [247, 245, 240], K = k == null ? 0.72 : k;
    if (base) { const f = rgbOf(hex ? hex(c) : c) || B; return "#" + f.map((v, i) => Math.round(v * (1 - K) + B[i] * K).toString(16).padStart(2, "0")).join(""); }
    let h = hex ? hex(c) : c; if (typeof h !== "string") h = "";
    let m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) { const s = /^#?([0-9a-f]{3})$/i.exec(h); if (s) m = [0, s[1].split("").map((x) => x + x).join("")]; }
    if (!m) return "#ece8df";
    const n = parseInt(m[1], 16), mix = (v, w) => Math.round(v * 0.28 + w * 0.72);
    const r = mix((n >> 16) & 255, 247), g = mix((n >> 8) & 255, 245), b = mix(n & 255, 240);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  const fmtM = (v) => (+(+v).toFixed(2)) + "";
  function ring(pts) { const r = pts.map((p) => [p[0], p[1]]); const a = r[0], b = r[r.length - 1]; if (a[0] !== b[0] || a[1] !== b[1]) r.push([a[0], a[1]]); return r; }
  function area2(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  /** a circle's / an arc's points */
  function arc(c, r, a0, a1, n) { const out = []; n = n || 16; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; out.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); } return out; }

  /** the plan of the storey at z: {fills: [{rings, col, k}], lines: [{pts, col, dash, k}], texts: [{p, t, h, col, bold}]}
   *  k = the layer (floor < furn < wall < sym < label) - o: {hex(col) -> #rrggbb, footprint(item), label(item)} */
  function symbols(A, z, o) {
    o = o || {};
    const out = { fills: [], lines: [], texts: [] };
    if (!A || !A.rooms) return out;
    const COL = Object.assign({}, COL0, o.col || {});                    // 2.649.0: the theme's colours (attach passes them)
    const Q = P(), hid = Q.hiddenOf(A);
    const rooms = A.rooms.filter((R) => sameZ(R.z, z) && !hid("room:" + R.id));
    const ids = new Set(rooms.map((R) => R.id));
    const L = (pts, col, k, dash) => out.lines.push({ pts: pts.map((p) => [r4(p[0]), r4(p[1])]), col, k: k || "sym", dash: !!dash });
    // what stands on the floor (stairs, furniture) - a room's label goes where none of it is
    const occ = [];
    (A.stairs || []).forEach((s) => { if (!sameZ(s.z, z) || hid("stair:" + s.id)) return; const a = s.ang * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]], q = [s.x - v[0] * s.w / 2, s.y - v[1] * s.w / 2];
      occ.push([q, [q[0] + u[0] * s.len, q[1] + u[1] * s.len], [q[0] + u[0] * s.len + v[0] * s.w, q[1] + u[1] * s.len + v[1] * s.w], [q[0] + v[0] * s.w, q[1] + v[1] * s.w]]); });
    if (o.footprint) (A.items || []).forEach((it) => { if (!hid("item:" + it.id) && Math.abs((it.z || 0) - z) < 0.3) { const F = o.footprint(it); if (F && F.length >= 3) occ.push(F); } });
    const labelAt = (I) => {
      const c = Q.centroid(I); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; I.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      const offs = [[0, 0]]; [0.22, 0.34].forEach((f) => { const dx = (x1 - x0) * f, dy = (y1 - y0) * f; offs.push([0, dy], [0, -dy], [dx, 0], [-dx, 0], [dx, dy], [-dx, dy], [dx, -dy], [-dx, -dy]); });
      const cands = offs.map(([a, b]) => [c[0] + a, c[1] + b + 0.27]);
      const free = (q) => [[0, 0.12], [0, -0.62], [-0.6, -0.27], [0.6, -0.27], [-0.5, 0.1], [0.5, 0.1], [-0.5, -0.6], [0.5, -0.6]].every(([a, b]) => { const r = [q[0] + a, q[1] + b]; return Q.inPoly(r, I) && !occ.some((F) => Q.inPoly(r, F)); });
      const ok = cands.find(free); return ok || [c[0], c[1] + 0.27];
    };
    // the floors + the rooms' names / sizes
    rooms.forEach((R) => {
      if (!R.closed) return;
      const I = Q.interior(R); if (!I || I.length < 3) return;
      if (!hid("room:" + R.id + ":floor")) out.fills.push({ rings: [ring(I)], col: tint(R.floor, o.hex, COL.floorBase || null, COL.floorBase ? 0.82 : null), k: "floor", tag: { ak: "room", id: R.id } });
      const c = labelAt(I), S = Q.roomSize(R), ar = Q.roomArea(R);
      out.texts.push({ p: c, t: R.name || "Room", h: 0.24, col: COL.text, bold: true });
      if (S) out.texts.push({ p: [c[0], c[1] - 0.3], t: fmtM(S.w) + " × " + fmtM(S.l) + " m", h: 0.17, col: COL.dim });
      out.texts.push({ p: [c[0], c[1] - 0.55], t: (+ar.toFixed(2)) + " m²", h: 0.17, col: COL.dim });
    });
    // the walls: one shape, the openings cut out
    // 2.660.0: interior walls a lighter fill under the exterior ones (Q.wallKind - auto: a room on both sides)
    const quads = [], inQ = []; rooms.forEach((R) => Q.wallQuads(R).forEach((q) => { if (!hid("room:" + R.id + ":wall:" + q.i)) { const r = area2(q.quad) < 0 ? q.quad.slice().reverse() : q.quad; quads.push(r); if (Q.wallKind && Q.wallKind(A, R, q.i) === "int") inQ.push(r); } }));
    const ops = (A.ops || []).filter((op) => ids.has(op.room) && !hid("op:" + op.id)).map((op) => Q.opInfo(A, op)).filter(Boolean);
    if (quads.length) {
      let U = null; const pc = PC();
      if (pc) {
        try {
          U = pc.union.apply(null, quads.map((q) => [ring(q)]));
          if (ops.length && U.length) U = pc.difference.apply(null, [U].concat(ops.map((I) => [ring(I.rect.map((p, i) => {   // the cut: the wall's thickness only (not the 3 cm past it)
            const y = (i < 2 ? -1 : 1) * I.T / 2, x = i === 0 || i === 3 ? I.x0 : I.x1; return [I.o[0] + I.u[0] * x + I.nl[0] * y, I.o[1] + I.u[1] * x + I.nl[1] * y]; }))])));
        } catch (e) { U = null; }
      }
      if (!U) U = quads.map((q) => [ring(q)]);                                        // no polygon-clipping: the walls one by one
      // 2.660.0: the interior walls' part of the shape - the lighter fill (the exterior walls' dark one stays round them)
      let UI = null; if (inQ.length && pc && inQ.length < quads.length) { try { const ex = quads.filter((q) => !inQ.includes(q)); UI = pc.difference(pc.intersection(U, pc.union.apply(null, inQ.map((q) => [ring(q)]))), pc.union.apply(null, ex.map((q) => [ring(q)]))); } catch (e) { UI = null; } }
      else if (inQ.length && pc) UI = U;
      U.forEach((poly) => out.fills.push({ rings: poly, col: COL.wall, k: "wall" }));
      if (UI) UI.forEach((poly) => out.fills.push({ rings: poly, col: COL.wallIn || COL.dim, k: "wall", int: true }));
      // 2.661.0: a typed wall's layer seams (ppwalltype.js) - thin lines across its fill
      const WT = root.PPWallType;
      if (WT) rooms.forEach((R) => { if (!R.wt) return; Q.wallQuads(R).forEach((q) => { const T = R.wt[q.i] && !hid("room:" + R.id + ":wall:" + q.i) ? WT.find(A, R.wt[q.i]) : null; if (T) WT.seams(T, q.quad).forEach((sg) => L(sg, COL.seam || COL.dim, "seam")); }); });
    }
    // the doors, windows and openings
    ops.forEach((I) => {
      const op = I.op, k = I.T / 2, Pt = (x, y) => [I.o[0] + I.u[0] * x + I.nl[0] * y, I.o[1] + I.u[1] * x + I.nl[1] * y];
      const x0 = I.x0, x1 = I.x1, w = x1 - x0;
      L([Pt(x0, -k), Pt(x0, k)], COL.ink, "sym"); L([Pt(x1, -k), Pt(x1, k)], COL.ink, "sym");          // the jambs
      if (op.kind === "window") {
        L([Pt(x0, -k), Pt(x1, -k)], COL.ink); L([Pt(x0, k), Pt(x1, k)], COL.ink);                   // the wall's faces
        if (op.style === "slider") { L([Pt(x0, -0.02), Pt(x0 + w * 0.55, -0.02)], COL.glass); L([Pt(x1 - w * 0.55, 0.02), Pt(x1, 0.02)], COL.glass); }
        else if (op.style === "double") { L([Pt(x0, -0.025), Pt(x1, -0.025)], COL.glass); L([Pt(x0, 0.025), Pt(x1, 0.025)], COL.glass); }
        else L([Pt(x0, 0), Pt(x1, 0)], COL.glass);
        L([Pt(x0 - 0.05, -k - 0.05), Pt(x1 + 0.05, -k - 0.05)], COL.ink);                         // the sill, outside
        return;
      }
      if (op.kind === "opening" || op.style === "opening") { L([Pt(x0, -k), Pt(x1, -k)], COL.dim, "sym", true); L([Pt(x0, k), Pt(x1, k)], COL.dim, "sym", true); return; }
      if (op.style === "sliding") {
        const m = (x0 + x1) / 2;
        L([Pt(x0, -0.03), Pt(m + 0.05, -0.03)], COL.door); L([Pt(m - 0.05, 0.03), Pt(x1, 0.03)], COL.door);
        L([Pt(m - 0.15, k + 0.12), Pt(m + 0.15, k + 0.12)], COL.dim); L([Pt(m + 0.15, k + 0.12), Pt(m + 0.08, k + 0.16)], COL.dim);   // ↔ its slide
        return;
      }
      // a leaf open 90° into the room (its inside = the wall's left) + its swing
      const leaf = (hx, s, len) => {
        const H = Pt(hx, k), a0 = Math.atan2(I.u[1] * s, I.u[0] * s), a1 = Math.atan2(I.nl[1], I.nl[0]);
        let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        L([H, [H[0] + I.nl[0] * len, H[1] + I.nl[1] * len]], COL.door, "sym");
        L(arc(H, len, a0, a0 + d, 14), COL.door, "sym", false);
      };
      if (op.style === "double") { leaf(x0, 1, w / 2); leaf(x1, -1, w / 2); }
      else if (op.flip) leaf(x1, -1, w); else leaf(x0, 1, w);
    });
    // the stairs (from this storey)
    (A.stairs || []).forEach((s) => {
      if (!sameZ(s.z, z) || hid("stair:" + s.id)) return;
      const a = s.ang * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]], n = Math.max(2, Math.round(s.rise / 0.18)), g = s.len / n;
      const oo = [s.x - v[0] * s.w / 2, s.y - v[1] * s.w / 2], Pt = (x, y) => [oo[0] + u[0] * x + v[0] * y, oo[1] + u[1] * x + v[1] * y];
      out.fills.push({ rings: [ring([Pt(0, 0), Pt(s.len, 0), Pt(s.len, s.w), Pt(0, s.w)])], col: COL.fill, k: "furn", tag: { ak: "stair", id: s.id } });
      L([Pt(0, 0), Pt(s.len, 0), Pt(s.len, s.w), Pt(0, s.w), Pt(0, 0)], COL.stair, "sym");
      for (let i = 1; i < n; i++) L([Pt(i * g, 0), Pt(i * g, s.w)], COL.stair, "sym");
      L([Pt(Math.min(0.15, s.len / 4), s.w / 2), Pt(s.len - 0.12, s.w / 2)], COL.ink, "sym");
      L([Pt(s.len - 0.32, s.w / 2 - 0.12), Pt(s.len - 0.12, s.w / 2), Pt(s.len - 0.32, s.w / 2 + 0.12)], COL.ink, "sym");
      out.texts.push({ p: Pt(Math.min(0.45, s.len / 3), s.w / 2 + 0.18), t: "UP", h: 0.15, col: COL.ink, bold: true });
    });
    // the floors without walls (slabs)
    (A.slabs || []).forEach((sl) => { if (hid("slab:" + sl.id) || !(Math.abs(sl.z - z) < 0.35) || !sl.pts) return; L(ring(sl.pts), COL.slab, "floor"); });
    // the furniture
    (A.items || []).forEach((it) => {
      if (hid("item:" + it.id) || !(Math.abs((it.z || 0) - z) < 0.3)) return;
      const F = o.footprint ? o.footprint(it) : null; if (!F || F.length < 3) return;
      out.fills.push({ rings: [ring(F)], col: COL.fill, k: "furn", tag: { ak: "item", id: it.id } });
      L(ring(F), COL.furn, "furn");
      const c = [(F[0][0] + F[2][0]) / 2, (F[0][1] + F[2][1]) / 2], t = o.label ? o.label(it) : it.type || "";
      const underLabel = out.texts.some((x) => Q.inPoly(x.p, F) || Q.inPoly([x.p[0], x.p[1] - 0.55], F));   // a room's name there: the piece unnamed
      if (t && !underLabel && Math.min(it.w || 0, it.d || 0) >= 0.3) out.texts.push({ p: c, t, h: Math.min(0.13, Math.max(0.08, Math.min(it.w, it.d) / 4)), col: COL.furn });
    });
    // the lights: a circle and a cross
    (A.lights || []).forEach((Lt) => {
      if (hid("light:" + Lt.id)) return;
      const R = Lt.room != null ? A.rooms.find((x) => x.id === Lt.room) : null;
      if (R ? !ids.has(R.id) : !(Lt.z >= z - 0.05 && Lt.z <= z + 4)) return;
      const r = Lt.type === "chandelier" || Lt.type === "pendant" ? 0.18 : 0.12, c = [Lt.x, Lt.y], q = r * 0.72;
      L(arc(c, r, 0, 2 * Math.PI, 20), COL.light, "sym");
      L([[c[0] - q, c[1] - q], [c[0] + q, c[1] + q]], COL.light, "sym"); L([[c[0] - q, c[1] + q], [c[0] + q, c[1] - q]], COL.light, "sym");
    });
    // 2.657.0: 🏊 the pools - the water, the edge tiles / decking round it, its name and size
    const lv0 = levels(A);
    if (root.PPSite && (!lv0.length || sameZ(z, lv0[0]))) (A.pools || []).forEach((q) => {      // on the lowest storey
      if (hid("pool:" + q.id)) return;
      const O = root.PPSite.outer(q);
      if (O !== q.pts && root.PPSite.outerW(q) > 0) out.fills.push({ rings: [ring(O), ring(q.pts.slice().reverse())], col: tint(q.edge === "tiles" ? q.edgeCol : q.deckCol, o.hex, COL.floorBase || null, COL.floorBase ? 0.6 : null), k: "floor", tag: { ak: "pool", id: q.id } });
      out.fills.push({ rings: [ring(q.pts)], col: COL.glass, k: "floor", tag: { ak: "pool", id: q.id } });
      L(q.pts.concat([q.pts[0]]), COL.wall, "wall"); if (root.PPSite.outerW(q) > 0) L(O.concat([O[0]]), COL.dim, "sym");
      let cx = 0, cy = 0; q.pts.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= q.pts.length; cy /= q.pts.length;
      const S = root.PPSite.size(q);
      out.texts.push({ p: [cx, cy + 0.15], t: q.name, h: 0.24, col: COL.fill, bold: true }, { p: [cx, cy - 0.2], t: fmtM(S.l) + " × " + fmtM(S.w) + " m · " + fmtM(q.shallow) + "-" + fmtM(q.deep) + " m deep", h: 0.17, col: COL.fill });
    });
    // 2.659.0: 🛣 the driveways - the surface, its centre line dashed
    if (root.PPSite && (!lv0.length || sameZ(z, lv0[0]))) (A.drives || []).forEach((d) => {
      if (hid("drive:" + d.id)) return;
      out.fills.push({ rings: [ring(root.PPSite.driveOutline(d))], col: tint(d.col, o.hex, COL.floorBase || null, COL.floorBase ? 0.6 : null), k: "floor", tag: { ak: "drive", id: d.id } });
      const C = root.PPSite.path(d, 0.5); L(C, COL.dim, "sym", true);
      const E = root.PPSite.driveOutline(d); L(E.concat([E[0]]), COL.dim, "sym");
    });
    // 2.653.0: ⛰ the ground's contour lines (the majors labelled) + the drawn ones - on the lowest storey, under everything
    const zs = levels(A);
    if (A.terrain && root.PPTerrain && (!zs.length || sameZ(z, zs[0]))) {
      const G = root.PPTerrain.planLines(A.terrain, { minor: COL.dim, major: COL.text, drawn: COL.glass, pad: COL.light })   // the grid is COL.grid - the lines stand out of it;
      G.lines.forEach((l) => out.lines.push({ pts: l.pts.map((p) => [r4(p[0]), r4(p[1])]), col: l.col, k: "contour", dash: !!l.dash }));   // 2.656.0: a pad's outline dashed
      G.texts.forEach((t) => out.texts.push(t));
    }
    return out;
  }

  /** what a click at p (the plan's x, y) on the storey at z means - the same tags as the 3D view's picking */
  function pickAt(A, p, z) {
    if (!A || !A.rooms) return null;
    const Q = P(), hid = Q.hiddenOf(A);
    const rooms = A.rooms.filter((R) => sameZ(R.z, z) && !hid("room:" + R.id)), ids = new Set(rooms.map((R) => R.id));
    const lt = (A.lights || []).filter((Lt) => !hid("light:" + Lt.id) && (Lt.room != null ? ids.has(Lt.room) : Lt.z >= z - 0.05 && Lt.z <= z + 4))
      .map((Lt) => ({ Lt, d: Math.hypot(Lt.x - p[0], Lt.y - p[1]) })).filter((x) => x.d < 0.22).sort((a, b) => a.d - b.d)[0];
    if (lt) return { ak: "light", id: lt.Lt.id };
    const pool = (A.pools || []).find((q) => !hid("pool:" + q.id) && Q.inPoly(p, root.PPSite ? root.PPSite.outer(q) : q.pts));   // 2.657.0
    if (pool) return { ak: "pool", id: pool.id };
    const drv = root.PPSite ? (A.drives || []).find((d) => !hid("drive:" + d.id) && Q.inPoly(p, root.PPSite.driveOutline(d))) : null;   // 2.659.0
    if (drv) return { ak: "drive", id: drv.id };
    for (const op of A.ops || []) {
      if (!ids.has(op.room) || hid("op:" + op.id)) continue;
      const I = Q.opInfo(A, op); if (!I) continue;
      const d = [p[0] - I.o[0], p[1] - I.o[1]], x = d[0] * I.u[0] + d[1] * I.u[1], y = d[0] * I.nl[0] + d[1] * I.nl[1];
      const swing = op.kind === "door" && op.style !== "sliding" && op.style !== "opening" ? (op.style === "double" ? (I.x1 - I.x0) / 2 : I.x1 - I.x0) : 0;   // a door: its swing too
      if (x >= I.x0 - 0.02 && x <= I.x1 + 0.02 && y >= -I.T / 2 - 0.06 && y <= I.T / 2 + Math.max(0.06, swing)) return { ak: "op", id: op.id };
    }
    const it = (A.items || []).filter((x) => !hid("item:" + x.id) && Math.abs((x.z || 0) - z) < 0.3 && root.PPFurn && Q.inPoly(p, root.PPFurn.footprint(x)))[0];
    if (it) return { ak: "item", id: it.id };
    for (const s of A.stairs || []) {
      if (!sameZ(s.z, z) || hid("stair:" + s.id)) continue;
      const a = s.ang * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]], d = [p[0] - s.x, p[1] - s.y], x = d[0] * u[0] + d[1] * u[1], y = d[0] * v[0] + d[1] * v[1];
      if (x >= 0 && x <= s.len && Math.abs(y) <= s.w / 2) return { ak: "stair", id: s.id };
    }
    for (const R of rooms) {
      for (const q of Q.wallQuads(R)) if (!hid("room:" + R.id + ":wall:" + q.i) && Q.inPoly(p, q.quad)) return { ak: "wall", room: R.id, edge: q.i };
    }
    let best = null; rooms.forEach((R) => { if (!R.closed || !Q.inPoly(p, R.pts)) return; if (!best || Q.roomArea(R) < Q.roomArea(best)) best = R; });
    if (best) return { ak: "room", id: best.id };
    const sl = (A.slabs || []).find((s) => !hid("slab:" + s.id) && Math.abs(s.z - z) < 0.35 && s.pts && Q.inPoly(p, s.pts));
    return sl ? { ak: "slab", id: sl.id } : null;
  }

  /** 2.650.0 (Tim: "when an object is selected like a wall etc, highlight it so user knows they have selected the object same in
   *  floorplan view, hover over object highlights the object in a different color unless it is selected"): the plan shape of
   *  a picked / hovered thing -> [ring ...] (2D, closed): a wall = its quad, a room = its outside outline (a free wall: its
   *  quads), a room's floor / ceiling ... = its inside, a door / window = its cut, stairs / a piece / a floor = their outline, a
   *  light / camera = a small disc */
  function hlShapes(A, t, z, o) {
    if (!A || !t) return [];
    const Q = P(), out = [], disc = (x, y, r) => { const c = arc([x, y], r, 0, 2 * Math.PI, 18); c.pop(); return ring(c); };
    const rid = t.ak === "room" ? t.id : t.ak === "wall" || t.ak === "wpt" || t.ak === "wtop" ? t.room : null;
    if (rid != null) {
      const R = Q.room(A, rid); if (!R || !sameZ(R.z, z)) return [];
      const e = t.edge != null && (t.part === "wall" || t.ak !== "room") ? t.edge : null;
      if (e != null) { const q = Q.wallQuads(R).find((w) => w.i === e); if (q) out.push(ring(q.quad)); return out; }
      if (t.part && R.closed) { const I = Q.interior(R); if (I) out.push(ring(I)); return out; }
      if (R.closed) { const X = Q.exterior(R); if (X) out.push(ring(X)); } else Q.wallQuads(R).forEach((q) => out.push(ring(q.quad)));
      return out;
    }
    const x = Q.find(A, t.ak, t.id); if (!x) return [];
    if (t.ak === "op") { const I = Q.opInfo(A, x); if (I && sameZ(I.R.z, z)) out.push(ring(I.rect)); }
    else if (t.ak === "stair") { if (!sameZ(x.z, z)) return []; const a = x.ang * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]], q = [x.x - v[0] * x.w / 2, x.y - v[1] * x.w / 2]; out.push(ring([q, [q[0] + u[0] * x.len, q[1] + u[1] * x.len], [q[0] + u[0] * x.len + v[0] * x.w, q[1] + u[1] * x.len + v[1] * x.w], [q[0] + v[0] * x.w, q[1] + v[1] * x.w]])); }
    else if (t.ak === "item") { const F = o && o.footprint ? o.footprint(x) : null; if (F && F.length >= 3) out.push(ring(F)); }
    else if (t.ak === "slab") { if (x.pts) out.push(ring(x.pts)); }
    else if (t.ak === "light") out.push(disc(x.x, x.y, 0.24));
    else if (t.ak === "cam") out.push(disc(x.x, x.y, 0.3));
    else if (t.ak === "roof") (x.rooms || []).forEach((id) => { const R = Q.room(A, id); const X = R && Q.exterior(R); if (X && sameZ(R.z, z)) out.push(ring(X)); });
    return out;
  }
  /* ---------------- three.js: the plan in the Sketcher's view */
  const ORDER = { contour: 2, floor: 3, furn: 4, wall: 5, seam: 5, sym: 6, label: 7 };   // 2.661.0: + a wall's layer seams (over its fill)
  function attach(V, AV) {
    const T = V.T, scene = V.scene;
    const G = new T.Group(); G.name = "pp-plan"; G.visible = false; scene.add(G);
    const HL = new T.Group(); HL.name = "pp-plan-hl"; scene.add(HL);           // 2.650.0: the picked / hovered highlight on the plan
    function clearHL() { while (HL.children.length) { const c = HL.children.pop(); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); } plan.hl = 0; }
    const plan = { isOn: false, z: 0, keep: null };
    const named = (n) => scene.getObjectByName(n);
    const HIDE = ["pp-arch", "pp-fixtures", "pp-furniture", "pp-terrain"];   // 2.653.0: the ground - its contours are drawn on the plan
    const texCache = new Map();
    function clear() { while (G.children.length) { const c = G.children.pop(); c.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) { if (x.material.map && !x.material.map.userData.cached) x.material.map.dispose(); x.material.dispose(); } }); } }
    function mat(col) { return new T.MeshBasicMaterial({ color: new T.Color(col), side: T.DoubleSide, depthTest: false, depthWrite: false }); }
    function textSprite(t) {
      const key = t.t + "|" + t.col + "|" + (t.bold ? 1 : 0);
      let tex = texCache.get(key), asp;
      if (!tex) {
        const c = document.createElement("canvas"), g = c.getContext("2d"), px = 64, font = (t.bold ? "600 " : "") + px + "px system-ui, sans-serif";
        g.font = font; const w = Math.ceil(g.measureText(t.t).width) + 12; c.width = w; c.height = px + 16;
        g.font = font; g.fillStyle = t.col; g.textBaseline = "middle"; g.textAlign = "center"; g.fillText(t.t, w / 2, c.height / 2);
        tex = new T.CanvasTexture(c); tex.userData.cached = true; tex.userData.asp = w / c.height; if (texCache.size > 400) texCache.clear(); texCache.set(key, tex);
      }
      asp = tex.userData.asp;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
      sp.scale.set(t.h * 1.25 * asp, t.h * 1.25, 1); sp.renderOrder = ORDER.label; sp.raycast = () => {};
      return sp;
    }
    function rebuild() {
      clear();
      if (!plan.isOn) return;
      const A = V.M && V.M.arch; if (!A || !P().has(A)) { V.draw(); return; }
      const F = root.PPFurn;
      let S; try { S = symbols(A, plan.z, { col: themeCols(V.theme), hex: F ? (c) => F.hex(c) : null, footprint: F ? (it) => F.footprint(it) : null, label: F ? (it) => F.label(it) : null }); }
      catch (e) { console.warn("Sketcher floorplan:", e); V.draw(); return; }
      const zc = plan.z + 1.0;                                            // the cut, a metre above the floor
      S.fills.forEach((f) => {
        if (!f.rings || !f.rings.length || f.rings[0].length < 4) return;
        const toV = (r) => r.slice(0, -1).map((p) => new T.Vector2(p[0], p[1]));
        const sh = new T.Shape(toV(f.rings[0])); f.rings.slice(1).forEach((h) => sh.holes.push(new T.Path(toV(h))));
        const m = new T.Mesh(new T.ShapeGeometry(sh), mat(f.col)); m.position.z = zc; m.renderOrder = ORDER[f.k] || 3; m.raycast = () => {}; G.add(m);
      });
      S.lines.forEach((l) => {
        const g = new T.BufferGeometry().setFromPoints(l.pts.map((p) => new T.Vector3(p[0], p[1], zc)));
        const ln = new T.Line(g, l.dash ? new T.LineDashedMaterial({ color: new T.Color(l.col), dashSize: 0.08, gapSize: 0.06, depthTest: false, depthWrite: false }) : new T.LineBasicMaterial({ color: new T.Color(l.col), depthTest: false, depthWrite: false }));
        if (l.dash) ln.computeLineDistances(); ln.renderOrder = (ORDER[l.k] || 6) + 0.5; ln.raycast = () => {}; G.add(ln);
      });
      S.texts.forEach((t) => { const sp = textSprite(t); sp.position.set(t.p[0], t.p[1], zc); G.add(sp); });
      // the plan's 1 m grid in the theme's line colour (the view's own grid is hidden) round what is drawn, 10 m past it
      const bb = P().bbox(A), x0 = Math.floor(Math.min(bb ? bb.min[0] : -10, -2) - 10), x1 = Math.ceil(Math.max(bb ? bb.max[0] : 10, 2) + 10), y0 = Math.floor(Math.min(bb ? bb.min[1] : -10, -2) - 10), y1 = Math.ceil(Math.max(bb ? bb.max[1] : 10, 2) + 10);
      const gp = []; for (let x = x0; x <= x1; x++) gp.push(x, y0, zc, x, y1, zc); for (let y = y0; y <= y1; y++) gp.push(x0, y, zc, x1, y, zc);
      const gg = new T.BufferGeometry(); gg.setAttribute("position", new T.Float32BufferAttribute(gp, 3));
      const gl = new T.LineSegments(gg, new T.LineBasicMaterial({ color: new T.Color(themeCols(V.theme).grid || COL0.grid), depthTest: false, depthWrite: false })); gl.renderOrder = 1; gl.raycast = () => {}; G.add(gl);
      plan.last = { fills: S.fills.length, lines: S.lines.length, texts: S.texts.length };
      V.draw();
    }
    let grid0 = null, polar0 = null;
    function paper() { /* 2.649.0: the theme's background stays (the floorplan keeps the app's colours) */ }
    // a theme changed (Settings ▸ Themes): the plan in its colours (ppview's retheme runs first)
    if (root.addEventListener) root.addEventListener("h3theme", () => setTimeout(() => { if (plan.isOn) rebuild(); }, 80));
    function set(v, noRestore) {
      v = !!v; if (v === plan.isOn) { if (v) rebuild(); return plan; }
      const c = V.controls;
      if (v) {
        plan.keep = V.state(); plan.isOn = true;
        const zs = levels(V.M && V.M.arch); if (!zs.some((z) => sameZ(z, plan.z))) plan.z = zs.length ? zs[0] : 0;
        if (!V.isOrtho) V.ortho(true);
        V.view("top");
        polar0 = [c.minPolarAngle, c.maxPolarAngle]; c.minPolarAngle = 0; c.maxPolarAngle = 1e-3; c.update();
        HIDE.forEach((n) => { const o = named(n); if (o) o.visible = false; });
        grid0 = [V.grid.visible, V.axes ? V.axes.visible : true]; V.grid.visible = false; if (V.axes) V.axes.visible = false;   // the plan's own light grid instead
        G.visible = true; paper(); rebuild();
      } else {
        plan.isOn = false; G.visible = false; clear(); clearHL();
        HIDE.forEach((n) => { const o = named(n); if (o) o.visible = true; });
        if (polar0) { c.minPolarAngle = polar0[0]; c.maxPolarAngle = polar0[1]; c.update(); }
        if (grid0) { V.grid.visible = grid0[0]; if (V.axes) V.axes.visible = grid0[1]; }
        if (AV && AV.setNight) AV.setNight(AV.isNight);                       // the sky as it was (day / night, the theme)
        if (!noRestore && plan.keep) V.restore(plan.keep);
        plan.keep = null;
      }
      if (AV && AV.setSel) AV.setSel(AV.sel);
      V.draw();
      return plan;
    }
    function setLevel(z) { if (!Number.isFinite(+z)) return; plan.z = +z; rebuild(); }
    // picking: the plan's own (the 3D walls' headers would hide a door from above)
    if (AV) {
      AV.planPick = (ev) => {
        if (!plan.isOn) return undefined;
        const r = V.ray(ev); if (!r || Math.abs(r.d[2]) < 1e-9) return null;
        const t = (plan.z - r.o[2]) / r.d[2], p = [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t];
        const tag = pickAt(V.M && V.M.arch, p, plan.z); if (!tag) return null;
        return { tag, point: [p[0], p[1], plan.z], n: [0, 0, 1], dist: 1 };
      };
      AV.planOnNow = () => plan.isOn;
      AV.onRebuild = () => { if (plan.isOn) rebuild(); };
      AV.onLayers = () => { if (plan.isOn) { HIDE.forEach((n) => { const o = named(n); if (o) o.visible = false; }); paper(); } };
      // the picked / hovered outline over the plan
      AV.onPaint = (g, st) => {
        clearHL();
        if (!plan.isOn) return;
        g.traverse((x) => { x.renderOrder = 8.5; if (x.material) [].concat(x.material).forEach((m) => { m.depthTest = false; }); });
        // 2.650.0: the picked things filled in the accent, the one under the pointer in blue (not when it is picked)
        const A = V.M && V.M.arch, F = root.PPFurn, o = { footprint: F ? (it) => F.footprint(it) : null }; if (!A || !st) return;
        const zc = plan.z + 1.0, put = (t, col, op) => hlShapes(A, t, plan.z, o).forEach((rg) => {
          if (rg.length < 4) return; const sh = new T.Shape(rg.slice(0, -1).map((p) => new T.Vector2(p[0], p[1])));
          const m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: new T.Color(col), transparent: true, opacity: op, side: T.DoubleSide, depthTest: false, depthWrite: false }));
          m.position.z = zc; m.renderOrder = 8; m.raycast = () => {}; HL.add(m);
          const ln = new T.LineLoop(new T.BufferGeometry().setFromPoints(rg.slice(0, -1).map((p) => new T.Vector3(p[0], p[1], zc))), new T.LineBasicMaterial({ color: new T.Color(col), depthTest: false, depthWrite: false }));
          ln.renderOrder = 8.6; ln.raycast = () => {}; HL.add(ln);
        });
        [st.sel].concat(st.more || []).filter(Boolean).forEach((t) => put(t, st.accent, 0.42));
        if (st.hover) put(st.hover, st.hoverCol, 0.32);
        plan.hl = HL.children.length;
      };
    }
    V.planOn = () => plan.isOn;
    return { hl: () => plan.hl || 0, on: () => plan.isOn, set, level: () => plan.z, setLevel, levels: () => levels(V.M && V.M.arch), rebuild, last: () => plan.last || null, group: G };
  }

  /** 2.649.0 (Tim: "when in floorplan mode keep the theme colors of the app"): the plan's colours from the view's theme
   *  {bg, pan, line, dim, text, accent} - walls / lines in the theme's text colour, floors its panel, the accent for glass and
   *  lights, the grid its line colour; the background stays the theme's */
  function themeCols(th) {
    const t = th || {};
    if (!t.text || !t.bg) return {};
    const mix = (a, b, k) => { const A = rgbOf(a), B = rgbOf(b); return A && B ? "#" + A.map((v, i) => Math.round(v * (1 - k) + B[i] * k).toString(16).padStart(2, "0")).join("") : a; };
    return { wall: t.text, wallIn: mix(t.text, t.bg, 0.45), seam: mix(t.text, t.bg, 0.65), ink: t.text, door: t.text, text: t.text, dim: t.dim || t.text, stair: t.dim || t.text, furn: t.dim || t.text, slab: t.dim || t.text,
      glass: t.accent || t.text, light: t.accent || t.text, fill: mix(t.pan || t.bg, t.bg, 0.35), floorBase: t.pan || t.bg, grid: t.line || mix(t.bg, t.text, 0.15), paper: t.bg };
  }
  const COL = COL0;
  const api = { levels, symbols, pickAt, tint, themeCols, hlShapes, attach, COL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPPlan = api;
})(typeof window !== "undefined" ? window : globalThis);
