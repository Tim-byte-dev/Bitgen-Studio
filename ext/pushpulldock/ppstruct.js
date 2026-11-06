/* bitGen Studio — 2.692.0: the Sketcher's STRUCTURE - floor systems under a room and lintels over doors / windows.
 * Tim (verbatim): "is it possible to add framing, wood/steel to australian standards? and flooring solutions like slab, pier,
 * raised etc" + (asked where span data should come from) "just use the standards don't import anything - don't do anything to
 * jepordize the free license".
 *
 * NO SUPPLIER OR STANDARDS TABLES ARE COPIED HERE. Member sizes are the user's pick from common stock sizes and grades; each is
 * CHECKED by plain beam sums (simply supported, uniform load) from the grades' published characteristic properties (AS 1720.1
 * style: f'b and E) and the loads a house floor / roof carries (AS 1170.1 style domestic floor 1.5 kPa). The check is a GUIDE -
 * the real sizes come from AS 1684 / the supplier's span tables and a certifier or engineer signs off. Slab depths, edge beams and
 * pier spacings are the user's settings (AS 2870 / the engineer's design); the site class is recorded, not used to size anything.
 *
 * room.fs = {type none | slab | waffle | raft | suspended | raised, site A|S|M|H1|H2|E|P, slab (m), edgeW, edgeD, podH, ribW,
 *   ribAt, beamAt, pier {kind concrete | steel | brick | timber, w, at}, joist {D, B, n, grade, at}, bearer {D, B, n, grade, at},
 *   sheet}  (m, sizes in mm)          A.struct = {show (walls see-through + lintels), roof sheet | tile, grade}
 * op.lint = {D, B, n, grade} | null (auto) - the lintel over a door / window in an outside wall.
 * Pure + geometry through the helpers pparch passes in (box, prism, exterior, opInfo, wallKind, edgesOf). Browser + Node. */
(function (root) {
  "use strict";
  /** characteristic bending strength f'b and modulus of elasticity E (MPa), density (kg/m³) - the published grade values */
  const GRADES = { MGP10: { E: 10000, fb: 17, rho: 500, label: "MGP10 pine" }, MGP12: { E: 12700, fb: 28, rho: 550, label: "MGP12 pine" },
    MGP15: { E: 15200, fb: 41, rho: 600, label: "MGP15 pine" }, F17: { E: 14000, fb: 42, rho: 1000, label: "F17 hardwood" } };
  /** common stock sections D × B (mm) */
  const SIZES = [[70, 35], [70, 45], [90, 35], [90, 45], [120, 35], [120, 45], [140, 35], [140, 45], [190, 35], [190, 45], [240, 35], [240, 45], [290, 45]];
  const FLOORS = [["none", "Floor only (no structure shown)"], ["slab", "Slab on ground (edge beams)"], ["waffle", "Waffle pod slab"], ["raft", "Stiffened raft slab"],
    ["suspended", "Suspended slab on piers"], ["raised", "Raised timber floor (piers, bearers, joists)"]];
  const SITES = ["A", "S", "M", "H1", "H2", "E", "P"];
  const PIERS = { concrete: { w: 0.1, col: "#a7a49c", label: "Concrete stumps" }, steel: { w: 0.075, col: "#7d8288", label: "Steel piers" }, brick: { w: 0.23, col: "#9a5a44", label: "Brick piers" }, timber: { w: 0.1, col: "#8a6a45", label: "Timber stumps" } };
  /** loads (kPa): a house floor's dead (40 kg/m² of flooring + framing) and live; the roof's dead by covering and its live */
  const LOAD = { floorG: 0.4, floorQ: 1.5, roofG: { sheet: 0.4, tile: 0.9 }, roofQ: 0.25, wallG: 0.3 };
  const LIMIT = { long: 300, longMax: 15, short: 360, shortMax: 12 };            // span / n, mm
  const JOIST = { point: 1.8, stiff: { kN: 1, mm: 2 } };                          // a joist: 1.8 kN concentrated (strength), 1 kN -> <= 2 mm (bounce)
  const PHI = 0.85, K1 = { perm: 0.57, live: 0.8 };
  const COL = { concrete: "#b9b5ab", timber: "#c59a62", sheet: "#d7b98a", lintel: "#c9874a" };
  const num = (v, d, lo, hi) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const pick = (v, list, d) => (list.indexOf(v) >= 0 ? v : d);

  function cleanMember(m, d) {
    const o = m && typeof m === "object" ? m : {};
    return { D: Math.round(num(o.D, d.D, 35, 600)), B: Math.round(num(o.B, d.B, 25, 200)), n: Math.round(num(o.n, d.n || 1, 1, 4)), grade: GRADES[o.grade] ? o.grade : d.grade || "MGP10", at: num(o.at, d.at, 0.3, 6) };
  }
  /** a room's floor system, every value held to sense */
  function clean(fs) {
    const o = fs && typeof fs === "object" ? fs : {}, p = o.pier && typeof o.pier === "object" ? o.pier : {};
    const type = pick(o.type, FLOORS.map((f) => f[0]), "none"), kind = PIERS[p.kind] ? p.kind : "concrete";
    return { type, site: pick(o.site, SITES, "M"), slab: num(o.slab, type === "suspended" ? 0.15 : 0.1, 0.05, 0.6), edgeW: num(o.edgeW, 0.3, 0.1, 1.5), edgeD: num(o.edgeD, 0.4, 0.1, 2),
      podH: num(o.podH, 0.225, 0.1, 0.5), ribW: num(o.ribW, 0.11, 0.05, 0.5), ribAt: num(o.ribAt, 1.2, 0.6, 3), beamAt: num(o.beamAt, 4, 1, 8),
      pier: { kind, w: num(p.w, PIERS[kind].w, 0.05, 0.6), at: num(p.at, 1.8, 0.6, 5) },
      joist: cleanMember(o.joist, { D: 140, B: 45, n: 1, grade: "MGP10", at: 0.45 }), bearer: cleanMember(o.bearer, { D: 190, B: 45, n: 2, grade: "MGP10", at: 1.8 }),
      sheet: num(o.sheet, 0.019, 0.01, 0.05) };
  }
  const cleanLint = (l) => (l && typeof l === "object" ? cleanMember(l, { D: 140, B: 45, n: 2, grade: "MGP10", at: 1 }) : null);
  /** 2.693.0: light-gauge steel stud profiles - web D x flange B (mm), named generically */
  const STEEL = [{ id: "c75", D: 75, B: 35, label: "C 75 × 35 steel" }, { id: "c89", D: 89, B: 41, label: "C 89 × 41 steel" }, { id: "c92", D: 92, B: 41, label: "C 92 × 41 steel" }, { id: "c150", D: 150, B: 41, label: "C 150 × 41 steel" }];
  const FRAMES = [["timber", "Timber"], ["steel", "Light-gauge steel"], ["none", "None"]];
  const cleanStruct = (s) => { const o = s && typeof s === "object" ? s : {}, st = o.stud && typeof o.stud === "object" ? o.stud : {};
    return { show: !!o.show, roof: o.roof === "tile" ? "tile" : "sheet", grade: GRADES[o.grade] ? o.grade : "MGP10",
      frame: FRAMES.some((f) => f[0] === o.frame) ? o.frame : "timber", stud: { D: Math.round(num(st.D, 90, 45, 300)), B: Math.round(num(st.B, 35, 25, 100)), grade: GRADES[st.grade] ? st.grade : "MGP10", at: num(st.at, 0.45, 0.3, 0.9) },
      steel: STEEL.some((x) => x.id === o.steel) ? o.steel : "c89", plates: o.plates === 1 ? 1 : 2, nog: num(o.nog, 1.2, 0.6, 2), brace: o.brace !== false }; };
  const studOf = (S) => (S.frame === "steel" ? STEEL.find((x) => x.id === S.steel) : { D: S.stud.D, B: S.stud.B, label: S.stud.D + " × " + S.stud.B + " " + S.stud.grade });
  const sizeName = (m) => (m.n > 1 ? m.n + "/" : "") + m.D + " × " + m.B + " " + m.grade;

  /** the beam sums for a member on a simply supported span (m) with line loads g / q (kN/m, the member's own weight added):
   *  strength 1.35G (k1 0.57) and 1.2G + 1.5Q (k1 0.8), φ 0.85; deflection long-term 2G + 0.4Q <= span/300 (15 mm), live Q <=
   *  span/360 (12 mm); o.point (kN) a concentrated load at midspan, o.stiff {kN, mm} the deflection it may make -> {util (worst ratio), strength, long, short (mm), limits, ok} */
  function check(m, span, g, q, o) {
    const opt = o || {};
    const G = GRADES[m.grade] || GRADES.MGP10, b = m.B * m.n, d = m.D, Z = b * d * d / 6, I = b * d * d * d / 12, L = span * 1000;
    const self = G.rho * (b / 1000) * (d / 1000) * 9.81 / 1000, gg = g + self;
    const M1 = 1.35 * gg * span * span / 8, M2 = (1.2 * gg + 1.5 * q) * span * span / 8;        // kNm
    const cap = (k1) => PHI * k1 * G.fb * Z / 1e6;                                                // kNm
    const M3 = opt.point ? 1.2 * gg * span * span / 8 + 1.5 * opt.point * span / 4 : 0;         // a floor's concentrated load at midspan
    const strength = Math.max(M1 / cap(K1.perm), M2 / cap(K1.live), M3 / cap(K1.live));
    const defl = (w) => 5 * w * Math.pow(L, 4) / (384 * G.E * I);                               // w kN/m = N/mm -> mm
    const long = defl(2 * gg + 0.4 * q), short = defl(q);
    const lim = { long: Math.min(L / LIMIT.long, LIMIT.longMax), short: Math.min(L / LIMIT.short, LIMIT.shortMax) };
    const bounce = opt.stiff ? opt.stiff.kN * 1000 * Math.pow(L, 3) / (48 * G.E * I) : 0;      // a floor's stiffness: 1 kN at midspan
    const util = Math.max(strength, long / lim.long, short / lim.short, opt.stiff ? bounce / opt.stiff.mm : 0);
    return { util, strength, long, short, bounce, lim: Object.assign(lim, opt.stiff ? { bounce: opt.stiff.mm } : {}), ok: util <= 1 + 1e-9, span };
  }
  /** the smallest stock section (area) that passes, n pieces of it (n given or 1..maxN) -> member | null */
  function choose(span, g, q, grade, o, co) {
    const opt = o || {}, ns = opt.n ? [opt.n] : [1, 2, 3], Bs = opt.B ? [opt.B] : null;
    const all = [];
    SIZES.forEach(([D, B]) => { if (Bs && Bs.indexOf(B) < 0) return; ns.forEach((n) => all.push({ D, B, n, grade, at: opt.at || 1 })); });
    all.sort((a, b) => a.D * a.B * a.n - b.D * b.B * b.n || a.D - b.D);
    return all.find((m) => check(m, span, g, q, co).ok) || null;
  }

  /* ---- loads on each member */
  const joistLoad = (fs) => ({ g: LOAD.floorG * fs.joist.at, q: LOAD.floorQ * fs.joist.at, span: fs.bearer.at });
  const bearerLoad = (fs) => ({ g: LOAD.floorG * fs.bearer.at, q: LOAD.floorQ * fs.bearer.at, span: fs.pier.at });   // an inside bearer: its floor load width = the bearer spacing
  /** a raised floor's joists + bearers checked -> {joist, bearer} (check results + the suggested sizes) */
  function floorChecks(fs0) {
    const fs = clean(fs0); if (fs.type !== "raised") return null;
    const jl = joistLoad(fs), bl = bearerLoad(fs);
    return { joist: Object.assign(check(fs.joist, jl.span, jl.g, jl.q, JOIST), { size: sizeName(fs.joist), best: choose(jl.span, jl.g, jl.q, fs.joist.grade, { n: 1, at: fs.joist.at }, JOIST) }),
      bearer: Object.assign(check(fs.bearer, bl.span, bl.g, bl.q), { size: sizeName(fs.bearer), best: choose(bl.span, bl.g, bl.q, fs.bearer.grade, { at: fs.bearer.at }) }) };
  }

  /* ---- geometry */
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  /** where the line p + t u crosses the polygon P -> [[t0, t1] ...] (inside intervals) */
  function spans(P, p, u) {
    const ts = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], d = [b[0] - a[0], b[1] - a[1]], den = u[0] * d[1] - u[1] * d[0];
      if (Math.abs(den) < 1e-12) continue;
      const w = [a[0] - p[0], a[1] - p[1]], t = (w[0] * d[1] - w[1] * d[0]) / den, s = (w[0] * u[1] - w[1] * u[0]) / den;
      if (s >= -1e-9 && s < 1 - 1e-9) ts.push(t);
    }
    ts.sort((a, b) => a - b); const out = [];
    for (let k = 0; k + 1 < ts.length; k += 2) if (ts[k + 1] - ts[k] > 1e-6) out.push([ts[k], ts[k + 1]]);
    return out;
  }
  /** evenly spaced lines no further apart than `at` from lo to hi (both ends, `inset` in) */
  function stations(lo, hi, at, inset) {
    const a = lo + inset, b = hi - inset; if (b <= a) return [(lo + hi) / 2];
    const n = Math.max(1, Math.ceil((b - a) / at - 1e-9)); return Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
  }
  /** the room's long direction (its longest outside edge) */
  function axes(X) {
    let best = null; X.forEach((a, i) => { const b = X[(i + 1) % X.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || L > best.L) best = { L, u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] }; });
    const u = best.u, n = [-u[1], u[0]], o = X[0];
    const us = X.map((p) => dot([p[0] - o[0], p[1] - o[1]], u)), ns = X.map((p) => dot([p[0] - o[0], p[1] - o[1]], n));
    return { o, u, n, u0: Math.min(...us), u1: Math.max(...us), n0: Math.min(...ns), n1: Math.max(...ns) };
  }
  const groundAt = (A, x, y) => (A.terrain && root.PPTerrain && root.PPTerrain.at ? root.PPTerrain.at(A.terrain, x, y) : 0);
  /** a room's floor system as parts: [{part, kind, o, u, n, x0, x1, y0, y1, z0, z1, col} (boxes) | {part, prism: pts, z0, z1, col}]
   *  + members [{kind, size, count, len (m total)}] + notes */
  function plan(A, R, H) {
    const fs = clean(R.fs), out = { parts: [], members: [], notes: [], fs };
    if (!R.closed || fs.type === "none") return out;
    const X = H.exterior(R); if (!X || X.length < 3) return out;
    const z = R.z, ax = axes(X), at = (s, t) => [ax.o[0] + ax.u[0] * s + ax.n[0] * t, ax.o[1] + ax.u[1] * s + ax.n[1] * t];
    const add = (kind, o, u, n, x0, x1, y0, y1, z0, z1, col) => out.parts.push({ part: kind, o, u, n, x0, x1, y0, y1, z0, z1, col });
    const piersUnder = (pts, top, w, col) => pts.forEach((p) => { const g = groundAt(A, p[0], p[1]); if (top - g < 0.02) return; add("pier", p, ax.u, ax.n, -w / 2, w / 2, -w / 2, w / 2, Math.min(g, top - 0.02), top, col); });
    if (fs.type === "slab" || fs.type === "waffle" || fs.type === "raft") {
      const deep = fs.type === "waffle" ? fs.podH + 0.085 : fs.slab;
      out.parts.push({ part: "slab", prism: X, z0: z - (fs.type === "waffle" ? 0.085 : fs.slab), z1: z, col: COL.concrete });
      // edge beams: a ring edgeW wide round the outline, edgeD deep (waffle: the slab's full depth)
      const ed = fs.type === "waffle" ? deep : fs.edgeD;
      X.forEach((a, i) => { const b = X[(i + 1) % X.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) return; const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]];
        add("edge beam", a, u, n, 0, L, 0, fs.edgeW, z - ed, z - (fs.type === "waffle" ? 0.085 : fs.slab), COL.concrete); });
      if (fs.type !== "slab") {
        const step = fs.type === "waffle" ? fs.ribAt : fs.beamAt, w = fs.type === "waffle" ? fs.ribW : fs.edgeW, top = z - (fs.type === "waffle" ? 0.085 : fs.slab), bot = z - (fs.type === "waffle" ? deep : fs.edgeD);
        stations(ax.n0, ax.n1, step, fs.edgeW).slice(1, -1).forEach((t) => spans(X, at(0, t), ax.u).forEach(([s0, s1]) => add(fs.type === "waffle" ? "rib" : "beam", at(0, t), ax.u, ax.n, s0, s1, -w / 2, w / 2, bot, top, COL.concrete)));
        stations(ax.u0, ax.u1, step, fs.edgeW).slice(1, -1).forEach((s) => spans(X, at(s, 0), ax.n).forEach(([t0, t1]) => add(fs.type === "waffle" ? "rib" : "beam", at(s, 0), ax.n, [-ax.u[0], -ax.u[1]], t0, t1, -w / 2, w / 2, bot, top, COL.concrete)));
      }
      out.notes.push("Site class " + fs.site + " - the slab, its beams and their depths are your engineer's / AS 2870 design; these are the sizes you set.");
      return out;
    }
    if (fs.type === "suspended") {
      out.parts.push({ part: "slab", prism: X, z0: z - fs.slab, z1: z, col: COL.concrete });
      const pts = []; stations(ax.n0, ax.n1, fs.pier.at, fs.pier.w).forEach((t) => stations(ax.u0, ax.u1, fs.pier.at, fs.pier.w).forEach((s) => { const p = at(s, t); if (H.inPoly(p, X)) pts.push(p); }));
      piersUnder(pts, z - fs.slab, Math.max(fs.pier.w, 0.25), COL.concrete);
      out.members.push({ kind: "Piers", size: Math.round(Math.max(fs.pier.w, 0.25) * 1000) + " mm", count: pts.length, len: 0 });
      out.notes.push("Site class " + fs.site + " - a suspended slab is the engineer's design; the piers are at the spacing you set.");
      return out;
    }
    // raised timber floor: flooring sheet, joists across the bearers, bearers on piers
    const J = fs.joist, B = fs.bearer, jD = J.D / 1000, jB = J.B * J.n / 1000, bD = B.D / 1000, bB = B.B * B.n / 1000;
    const zs = z - fs.sheet, zj = zs - jD, zb = zj - bD;
    out.parts.push({ part: "flooring", prism: X, z0: zs, z1: z, col: COL.sheet });
    let bl = 0, jl = 0, np = 0, nj = 0;
    const bearers = stations(ax.n0, ax.n1, B.at, bB / 2), piers = [];
    bearers.forEach((t) => spans(X, at(0, t), ax.u).forEach(([s0, s1]) => {
      add("bearer", at(0, t), ax.u, ax.n, s0, s1, -bB / 2, bB / 2, zb, zj, COL.timber); bl += s1 - s0;
      stations(s0, s1, fs.pier.at, fs.pier.w / 2).forEach((s) => piers.push(at(s, t)));
    }));
    stations(ax.u0, ax.u1, J.at, jB / 2).forEach((s) => spans(X, at(s, 0), ax.n).forEach(([t0, t1]) => { add("joist", at(s, 0), ax.n, [-ax.u[0], -ax.u[1]], t0, t1, -jB / 2, jB / 2, zj, zs, COL.timber); jl += t1 - t0; nj++; }));
    piersUnder(piers, zb, fs.pier.w, PIERS[fs.pier.kind].col); np = piers.length;
    const low = piers.map((p) => zb - groundAt(A, p[0], p[1])), clear = low.length ? Math.min(...low) : 0;
    out.clear = clear;
    out.members.push({ kind: "Joists", size: sizeName(J) + " @ " + Math.round(J.at * 1000), count: nj, len: jl },
      { kind: "Bearers", size: sizeName(B) + " @ " + Math.round(B.at * 1000), count: bearers.length, len: bl },
      { kind: PIERS[fs.pier.kind].label, size: Math.round(fs.pier.w * 1000) + " mm @ " + Math.round(fs.pier.at * 1000), count: np, len: 0 });
    if (clear < 0.15) out.notes.push("Only " + Math.round(clear * 1000) + " mm under the bearers - raise the room's Floor level for the clearance your code asks (ventilation / termite inspection).");
    return out;
  }
  /** a door / window's lintel - in an outside wall only -> {op, span, g, q, m (the member used), auto, check, rlw} | null */
  function lintel(A, op, H) {
    const I = H.opInfo(A, op); if (!I) return null;
    const R = I.R; if (H.wallKind(A, R, op.edge) === "int") return null;
    const e = I.e, nl = [-e.u[1], e.u[0]], o = e.a;
    const depth = R.pts.reduce((mx, p) => Math.max(mx, Math.abs(dot([p[0] - o[0], p[1] - o[1]], nl))), 0);
    const rlw = depth / 2 + 0.45, S = cleanStruct(A.struct);                          // half the room's depth + the eave
    const above = Math.max(0, R.h - (op.sill + op.h)), span = op.w + 0.1;
    const g = LOAD.roofG[S.roof] * rlw + LOAD.wallG * above, q = LOAD.roofQ * rlw;
    const auto = !op.lint, m = op.lint ? cleanLint(op.lint) : (choose(span, g, q, S.grade, { n: 2, B: 45 }) || { D: 290, B: 45, n: 3, grade: S.grade, at: 1 });
    return { op, I, span, g, q, rlw, m, auto, size: sizeName(m), check: check(m, span, g, q) };
  }
  function lintels(A, H) { return (A.ops || []).map((op) => lintel(A, op, H)).filter(Boolean); }
  /* ---- 2.693.0 (Tim: "you choose, we will go one at a time" - wall framing after 2.692.0's floors + lintels): every wall's frame -
     bottom plate (cut at doors), top plate(s), studs at the spacing, a jamb stud each side of an opening, jack studs over the head /
     under a window's sill trimmer, noggings in rows, a strap brace in each clear panel 1.8 m or longer; corners get a post. Laid
     out by common practice; stud sizes are NOT checked (AS 1684's stud tables: height, spacing, wind) - said in the panel. */
  /** one room's walls framed -> [{R, i, parts [box descriptors {part, o, u, n, x0..z1, col} | {part, strap: [x0, z0, x1, z1], e, D}], n {...}}] */
  function wallFrames(A, R, H, S0) {
    const S = S0 || cleanStruct(A.struct); if (S.frame === "none" || R.noFrame) return [];
    const sd = studOf(S), D = sd.D / 1000, B = sd.B / 1000, steel = S.frame === "steel", col = steel ? "#9aa0a6" : COL.timber, nTop = steel ? 1 : S.plates;
    const at = A.rooms.indexOf(R), out = [], np = R.pts.length;
    H.wallQuads(R).forEach((q) => {
      const e = q, mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
      // a wall two rooms share is framed once (by the first room)
      if (A.rooms.slice(0, Math.max(0, at)).some((Q) => Math.abs(Q.z - R.z) < 0.01 && H.edgesOf(Q).some((f) => Math.abs(f.u[0] * e.u[1] - f.u[1] * e.u[0]) < 0.02 && H.segDist(mid, f.a, f.b).d < 0.01))) return;
      const al = (p) => dot([p[0] - e.a[0], p[1] - e.a[1]], e.u);
      let s0 = Math.min(al(q.quad[0]), al(q.quad[3])), s1 = Math.max(al(q.quad[1]), al(q.quad[2]));
      const k0 = e.i, k1 = R.closed ? (e.i + 1) % np : e.i + 1, corners = [];
      if (H.wallsAt(R, k0).length >= 2) { s0 += D / 2; corners.push(0); }
      if (H.wallsAt(R, k1).length >= 2) { s1 -= D / 2; corners.push(1); }
      if (s1 - s0 < 2 * B) return;
      const z0 = R.z, ztop = R.z + H.minTop(R, e.i), zs = z0 + B, zt = ztop - nTop * B, parts = [], n = { studs: 0, jambs: 0, jacks: 0, studLen: 0, plate: 0, nog: 0, braces: 0 };
      const bx = (part, x0, x1, za, zb, c) => { if (x1 - x0 > 1e-4 && zb - za > 1e-4) parts.push({ part, o: e.a, u: e.u, n: e.nl, x0, x1, y0: -D / 2, y1: D / 2, z0: za, z1: zb, col: c || col }); };
      const ops = (A.ops || []).filter((op) => op.room === R.id && op.edge === e.i).map((op) => { const I = H.opInfo(A, op); if (!I) return null; const L = lintel(A, op, H);
        return { op, x0: I.x0, x1: I.x1, zb: op.kind === "door" ? z0 : I.z0, zh: I.z1, hd: L ? L.m.D / 1000 : D, win: op.kind !== "door" && I.z0 > z0 + 0.05, lint: !!L }; }).filter(Boolean);
      // plates: the bottom one cut at doors
      let cuts = ops.filter((o) => !o.win && o.zb <= z0 + 1e-6).map((o) => [o.x0, o.x1]).sort((a, b) => a[0] - b[0]), x = s0;
      cuts.forEach(([a, b]) => { bx("bottom plate", x, Math.max(x, a), z0, zs); n.plate += Math.max(0, a - x); x = Math.max(x, b); }); bx("bottom plate", x, s1, z0, zs); n.plate += Math.max(0, s1 - x);
      for (let k = 0; k < nTop; k++) { bx("top plate", s0, s1, ztop - (k + 1) * B, ztop - k * B); n.plate += s1 - s0; }
      // studs: at the spacing from the start, the end one, none in an opening (jack studs there instead)
      const xs = []; for (let p = s0 + B / 2; p < s1 - B / 2 - 1e-6; p += S.stud.at) xs.push(p);
      const xe = s1 - B / 2; if (xs.length > 1 && xe - xs[xs.length - 1] < B) xs[xs.length - 1] = xe - B;   // the last one too close: beside the end stud (a bay never wider than the spacing)
      xs.push(xe);
      const inOp = (p) => ops.find((o) => p > o.x0 - B * 1.5 && p < o.x1 + B * 1.5);
      xs.forEach((p) => { const o = inOp(p);
        if (!o) { bx("stud", p - B / 2, p + B / 2, zs, zt); n.studs++; n.studLen += zt - zs; return; }
        if (p <= o.x0 || p >= o.x1) return;                       // beside the opening: its jamb stud stands there
        const top0 = o.zh + o.hd; if (zt - top0 > 0.03) { bx("jack stud", p - B / 2, p + B / 2, top0, zt); n.jacks++; n.studLen += zt - top0; }
        if (o.win && o.zb - B - zs > 0.03) { bx("jack stud", p - B / 2, p + B / 2, zs, o.zb - B); n.jacks++; n.studLen += o.zb - B - zs; } });
      ops.forEach((o) => {
        [[o.x0 - B, o.x0], [o.x1, o.x1 + B]].forEach(([a, b]) => { if (a >= s0 - 1e-6 && b <= s1 + 1e-6) { bx("jamb stud", a, b, zs, zt); n.jambs++; n.studLen += zt - zs; } });
        if (!o.lint) bx("head", o.x0 - B, o.x1 + B, o.zh, Math.min(zt, o.zh + o.hd));                 // an inside wall's head (an outside one: its lintel)
        if (o.win) bx("sill trimmer", o.x0, o.x1, o.zb - B, o.zb);
      });
      // noggings in rows, broken at openings
      for (let z = zs + S.nog; z < zt - 0.15; z += S.nog) {
        let x2 = s0; const hits = ops.filter((o) => z + B > o.zb - B && z < o.zh + o.hd).map((o) => [o.x0 - B, o.x1 + B]).sort((a, b) => a[0] - b[0]);
        hits.forEach(([a, b]) => { bx("nogging", x2, Math.max(x2, a), z, z + B); n.nog += Math.max(0, a - x2); x2 = Math.max(x2, b); }); bx("nogging", x2, s1, z, z + B); n.nog += Math.max(0, s1 - x2);
      }
      // a strap brace in each clear panel (no opening) 1.8 m or longer - nominal: the bracing design is AS 1684's / the engineer's
      if (S.brace) { let x3 = s0; const gaps = []; ops.map((o) => [o.x0 - B, o.x1 + B]).sort((a, b) => a[0] - b[0]).forEach(([a, b]) => { gaps.push([x3, a]); x3 = Math.max(x3, b); }); gaps.push([x3, s1]);
        gaps.forEach(([a, b]) => { if (b - a < 1.8) return; const run = Math.min(b - a - 0.1, (zt - zs) * 1.2); parts.push({ part: "strap brace", strap: [a + 0.05, zs, a + 0.05 + run, zt], e, D }); n.braces++; }); }
      corners.filter((c) => c === 0).forEach((c) => { const v = e.a; parts.push({ part: "corner post", o: v, u: e.u, n: e.nl, x0: -D / 2, x1: D / 2, y0: -D / 2, y1: D / 2, z0: zs, z1: zt, col, post: k1 }); });
      out.push({ R, i: e.i, parts, n, s0, s1 });
    });
    return out;
  }
  /** a room's framing totals -> {studs, jambs, jacks, studLen, plate, nog, braces, walls} */
  function frameTotals(A, R, H) {
    const t = { studs: 0, jambs: 0, jacks: 0, studLen: 0, plate: 0, nog: 0, braces: 0, walls: 0 };
    wallFrames(A, R, H).forEach((w) => { t.walls++; Object.keys(w.n).forEach((k) => { t[k] += w.n[k]; }); });
    return t;
  }
  /** every member of the model -> rows {what, size, count, len} (the plans / panel schedule) */
  function schedule(A, H) {
    const rows = [];
    (A.rooms || []).forEach((R) => plan(A, R, H).members.forEach((m) => rows.push(Object.assign({ room: R.name }, m))));
    lintels(A, H).forEach((L) => rows.push({ room: L.I.R.name, kind: "Lintel (" + L.op.kind + " " + Math.round(L.op.w * 1000) + ")", size: L.size, count: 1, len: L.span + 0.1 }));
    const S = cleanStruct(A.struct), sn = studOf(S) ? studOf(S).label : "";
    if (S.frame !== "none") (A.rooms || []).forEach((R) => { const t = frameTotals(A, R, H); if (!t.walls) return;
      rows.push({ room: R.name, kind: "Studs (common + jamb + jack)", size: sn + " @ " + Math.round(S.stud.at * 1000), count: t.studs + t.jambs + t.jacks, len: t.studLen },
        { room: R.name, kind: "Plates", size: sn, count: 0, len: t.plate }, { room: R.name, kind: "Noggings", size: sn, count: 0, len: t.nog });
      if (t.braces) rows.push({ room: R.name, kind: "Strap braces (nominal)", size: "metal strap", count: t.braces, len: 0 }); });
    return rows;
  }
  /** add the structure to pparch's build output (H = pparch's helpers) */
  function build(A, out, hid, H) {
    (A.rooms || []).forEach((R) => {
      if (!R.closed || hid("room:" + R.id + ":struct")) return;
      plan(A, R, H).parts.forEach((p) => { const tag = { ak: "room", id: R.id, part: "struct" };
        if (p.prism) H.prism(p.prism, p.z0, p.z1, p.col, tag, out); else H.box(p.o, p.u, p.n, p.x0, p.x1, p.y0, p.y1, p.z0, p.z1, p.col, tag, out); });
    });
    const S = cleanStruct(A.struct); if (!S.show) return;
    if (S.frame !== "none") (A.rooms || []).forEach((R) => { if (hid("room:" + R.id) || hid("room:" + R.id + ":struct")) return;
      wallFrames(A, R, H, S).forEach((w) => { if (hid("room:" + R.id + ":wall:" + w.i)) return; const tag = { ak: "room", id: R.id, part: "frame", edge: w.i };
        w.parts.forEach((p) => {
          if (!p.strap) { H.box(p.o, p.u, p.n, p.x0, p.x1, p.y0, p.y1, p.z0, p.z1, p.col, tag, out); return; }
          const [xa, za, xb, zb] = p.strap, e = p.e, wd = 0.03;
          [1, -1].forEach((sg) => { const y = sg * (p.D / 2 + 0.003), P = (x, z) => [e.a[0] + e.u[0] * x + e.nl[0] * y, e.a[1] + e.u[1] * x + e.nl[1] * y, z];
            const rg = [P(xa, za), P(xa + wd, za), P(xb + wd, zb), P(xb, zb)]; out.polys.push({ rings: [sg > 0 ? rg : rg.slice().reverse()], n: [e.nl[0] * sg, e.nl[1] * sg, 0], col: "#6f747a", tag, layer: "main" }); });
        }); }); });
    lintels(A, H).forEach((L) => { if (hid("op:" + L.op.id)) return; const I = L.I, D = L.m.D / 1000, w = L.m.B * L.m.n / 1000;
      H.box(I.o, I.u, I.nl, I.x0 - 0.05, I.x1 + 0.05, -w / 2, w / 2, I.z1, I.z1 + D, L.check.ok ? COL.lintel : "#d0402b", { ak: "op", id: L.op.id, part: "lintel" }, out); });
  }
  const api = { STEEL, FRAMES, wallFrames, frameTotals, JOIST, GRADES, SIZES, FLOORS, SITES, PIERS, LOAD, LIMIT, clean, cleanLint, cleanStruct, cleanMember, check, choose, floorChecks, plan, lintel, lintels, schedule, build, sizeName, spans, stations };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPStruct = api;
})(typeof window !== "undefined" ? window : globalThis);
