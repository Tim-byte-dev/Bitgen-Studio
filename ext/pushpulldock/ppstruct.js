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
    const over = (A.roofs || []).find((rf) => (rf.rooms || []).indexOf(R.id) >= 0), cover = over && roofMat(over) ? roofMat(over).load : S.roof;   // 2.695.0: the covering over this room
    const g = LOAD.roofG[cover] * rlw + LOAD.wallG * above, q = LOAD.roofQ * rlw;
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
  /* ---- 2.694.0 (Tim: "go ahead" - roof framing after wall framing): a roof's frame - RAFTERS (common rafters down every roof
     face at the spacing, a ridge board, hip / valley rafters on the sloped edges two faces share, ceiling joists on the top plates,
     an underpurlin half way up a long slope with struts to the ceiling joists) or TRUSSES (one at each spacing, top chords on the
     roof's underside, a bottom chord on the plates, webs - laid out only: the truss maker designs them). Rafters and ceiling joists
     are checked by the same guide sums (roof sheet 0.4 / tiles 0.9 kPa + 0.25 kPa; ceiling 0.2 kPa); struts / purlins / hips are
     not. rf.fr = {kind rafters | trusses | none, rafter, cj (+ span: its supports - hanging beams / walls), purlin (run that needs
     one, 0 = never), trussAt} */
  /* 2.695.0 (Tim: "can we add roof material types like colourbond, concrete tiles , etc"): the roof's covering - its weight class
     for the frame / lintel checks, a typical minimum pitch (CHECK THE MAKER'S - said in the panel), its default colour, the
     pattern drawn on the roof (sheets: lines down the slope at the rib spacing; tiles / slate / shingles: courses + staggered
     joints) and the words ✨ Photo uses. Generic names only - no brand names in what the user sees (the 2.459.0 rule). */
  const ROOFMATS = {
    "steel-corr": { label: "Pre-painted steel - corrugated", load: "sheet", min: 5, col: "#5c6166", pat: "down", at: 0.152, words: "corrugated pre-painted steel" },
    "steel-rib": { label: "Pre-painted steel - ribbed (trapezoidal)", load: "sheet", min: 3, col: "#6b7269", pat: "down", at: 0.19, words: "ribbed pre-painted steel sheeting" },
    "steel-seam": { label: "Pre-painted steel - standing seam", load: "sheet", min: 1, col: "#44494e", pat: "down", at: 0.4, words: "standing seam steel" },
    "tile-concrete": { label: "Concrete tiles", load: "tile", min: 15, col: "#6f6a63", pat: "courses", at: 0.33, w: 0.33, words: "concrete roof tiles" },
    "tile-terracotta": { label: "Terracotta tiles", load: "tile", min: 20, col: "#b0562f", pat: "courses", at: 0.33, w: 0.25, words: "terracotta roof tiles" },
    slate: { label: "Slate", load: "tile", min: 20, col: "#3e4347", pat: "courses", at: 0.25, w: 0.3, words: "natural slate" },
    shingle: { label: "Asphalt shingles", load: "sheet", min: 18, col: "#4a4541", pat: "courses", at: 0.14, w: 0.33, words: "asphalt shingles" },
    polycarb: { label: "Clear polycarbonate sheet", load: "sheet", min: 5, col: "#cfe2e8", pat: "down", at: 0.152, words: "clear polycarbonate roofing" } };
  const roofMat = (rf) => (rf && ROOFMATS[rf.mat]) || null;
  /** the roof's dead load class: its covering's, else the model's Roof covering setting */
  const roofLoadOf = (A, rf) => { const m = roofMat(rf); return m ? m.load : cleanStruct(A.struct).roof; };
  /** the covering's pattern on one roof face (Q = its underside in the roof's frame, dz = the roof's thickness, P = to the world)
   *  -> pushed into lines */
  function roofPattern(Q, dz, mat, P, lines) {
    const M = ROOFMATS[mat]; if (!M || Q.length < 3) return 0;
    const nrm = unit(v3.crs(v3.sub(Q[1], Q[0]), v3.sub(Q[2], Q[0]))), n = nrm[2] < 0 ? v3.mul(nrm, -1) : nrm; if (Math.abs(n[2]) < 1e-6) return 0;
    const zmin = Math.min(...Q.map((p) => p[2])), lo = Q.filter((p) => Math.abs(p[2] - zmin) < 1e-6); if (lo.length < 2) return 0;
    const e = unit([lo[1][0] - lo[0][0], lo[1][1] - lo[0][1], 0]); let g = [-e[1], e[0], 0];
    const c = Q.reduce((s0, p) => [s0[0] + p[0] / Q.length, s0[1] + p[1] / Q.length], [0, 0]); if ((c[0] - lo[0][0]) * g[0] + (c[1] - lo[0][1]) * g[1] < 0) g = [-g[0], -g[1], 0];
    const Q2 = Q.map((p) => [p[0], p[1]]), z = (x, y) => Q[0][2] - (n[0] * (x - Q[0][0]) + n[1] * (y - Q[0][1])) / n[2] + dz + 0.004, W3 = (p) => P(p[0], p[1], z(p[0], p[1]));
    const es = Q2.map((p) => p[0] * e[0] + p[1] * e[1]), gs = Q2.map((p) => p[0] * g[0] + p[1] * g[1]); let k = 0;
    const seg = (p0, d, t0, t1) => { lines.push([W3([p0[0] + d[0] * t0, p0[1] + d[1] * t0]), W3([p0[0] + d[0] * t1, p0[1] + d[1] * t1])]); k++; };
    const along = Math.hypot(1, Math.tan(Math.acos(Math.min(1, Math.abs(n[2])))));     // a course spacing measured up the slope -> in plan
    if (M.pat === "down") { for (let s = Math.min(...es) + M.at; s < Math.max(...es) - 1e-6; s += M.at) { const p0 = [e[0] * s, e[1] * s]; spans(Q2, p0, [g[0], g[1]]).forEach(([t0, t1]) => seg(p0, g, t0, t1)); } return k; }
    let row = 0;
    for (let t = Math.min(...gs) + M.at / along; t < Math.max(...gs) - 1e-6; t += M.at / along, row++) {
      const p0 = [g[0] * t, g[1] * t]; spans(Q2, p0, [e[0], e[1]]).forEach(([s0, s1]) => { seg(p0, e, s0, s1);
        const off = row % 2 ? M.w / 2 : 0; for (let s = s0 + off + M.w; s < s1 - 1e-6; s += M.w) { const b = [p0[0] + e[0] * s, p0[1] + e[1] * s]; const st = M.at / along; seg(b, [-g[0], -g[1]], 0, Math.min(st, t - Math.min(...gs))); } });
    }
    return k;
  }
  const ROOFFR = [["rafters", "Rafters (pitched)"], ["trusses", "Trusses (layout only)"], ["none", "None"]];
  function cleanRoofFr(x) {
    const o = x && typeof x === "object" ? x : {};
    return { kind: ROOFFR.some((k) => k[0] === o.kind) ? o.kind : "rafters", rafter: cleanMember(o.rafter, { D: 140, B: 45, n: 1, grade: "MGP10", at: 0.6 }),
      cj: Object.assign(cleanMember(o.cj, { D: 120, B: 35, n: 1, grade: "MGP10", at: 0.6 }), { span: num(o.cj && o.cj.span, 2.4, 0.6, 8) }),
      purlin: num(o.purlin, 2.4, 0, 10), trussAt: num(o.trussAt, 0.6, 0.45, 1.2) };
  }
  const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    crs: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len: (a) => Math.hypot(a[0], a[1], a[2]) };
  const unit = (a) => { const L = v3.len(a) || 1; return v3.mul(a, 1 / L); };
  const inPoly2 = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  /** a roof's members in the ROOF's own frame (x along the ridge 0..W, y across 0..D, z up) -> {F, P (to the world), beams [{part, a,
   *  b, w, d}], checks, n} | null - roofs of type flat / follow are not framed (a note) */
  function roofFrames(A, rf, H) {
    const fr = cleanRoofFr(rf.fr); if (fr.kind === "none" || rf.type === "follow" || rf.type === "flat") return null;
    const F = H.roofFrame(A, rf); if (!F) return null;
    let o = F.o, V = F.V; const { U, W, D, top, t } = F, ov = rf.over;
    if (rf.flip) { o = [o[0] + V[0] * D, o[1] + V[1] * D]; V = [-V[0], -V[1]]; }
    const tp = Math.tan(rf.pitch * Math.PI / 180); if (tp < 1e-3) return null;
    const P = (x, y, z) => [o[0] + U[0] * x + V[0] * y, o[1] + U[1] * x + V[1] * y, z];
    const tops = H.roofShape(rf.type, W, D, ov, top, tp, t, rf).tops;
    const planes = tops.map((Q) => { const n = unit(v3.crs(v3.sub(Q[1], Q[0]), v3.sub(Q[2], Q[0]))); return { Q, n: n[2] < 0 ? v3.mul(n, -1) : n, d0: Q[0] }; }).filter((p) => Math.abs(p.n[2]) > 1e-6);
    const zAt = (x, y) => { let z = null; planes.forEach((pl) => { if (!inPoly2([x, y], pl.Q)) return; const zz = pl.d0[2] - (pl.n[0] * (x - pl.d0[0]) + pl.n[1] * (y - pl.d0[1])) / pl.n[2]; if (z === null || zz > z) z = zz; }); return z; };
    const beams = [], n = { rafters: 0, rafterLen: 0, hips: 0, ridge: 0, cj: 0, cjLen: 0, purlinLen: 0, struts: 0, trusses: 0 };
    const beam = (part, a, b, w, d) => { if (v3.len(v3.sub(b, a)) > 0.02) beams.push({ part, a: P(a[0], a[1], a[2]), b: P(b[0], b[1], b[2]), w, d }); };
    const R = fr.rafter, rd = R.D / 1000, rb = R.B * R.n / 1000, C = fr.cj, cd = C.D / 1000, cb = C.B * C.n / 1000;
    // ceiling joists on the plates, across the building (both kinds: a truss's bottom chord is its own)
    let runMax = 0;
    if (fr.kind === "rafters") {
      for (let x = cb / 2; x <= W - cb / 2 + 1e-6; x += C.at) { beam("ceiling joist", [x, 0, top + cd / 2], [x, D, top + cd / 2], cb, cd); n.cj++; n.cjLen += D; }
      planes.forEach((pl) => {
        const Q = pl.Q, zmin = Math.min(...Q.map((p) => p[2]));
        const lo = Q.filter((p) => Math.abs(p[2] - zmin) < 1e-6); if (lo.length < 2) return;           // a face with an eave
        const e = unit([lo[1][0] - lo[0][0], lo[1][1] - lo[0][1], 0]); let g = [-e[1], e[0], 0];         // along the eave / up the slope (plan)
        const c = Q.reduce((s0, p) => [s0[0] + p[0] / Q.length, s0[1] + p[1] / Q.length], [0, 0]);
        if ((c[0] - lo[0][0]) * g[0] + (c[1] - lo[0][1]) * g[1] < 0) g = [-g[0], -g[1], 0];
        const Q2 = Q.map((p) => [p[0], p[1]]), es = Q2.map((p) => p[0] * e[0] + p[1] * e[1]), gs = Q2.map((p) => p[0] * g[0] + p[1] * g[1]), o2 = lo[0];
        const run = Math.max(...gs) - Math.min(...gs); runMax = Math.max(runMax, run);
        const zOn = (x, y) => pl.d0[2] - (pl.n[0] * (x - pl.d0[0]) + pl.n[1] * (y - pl.d0[1])) / pl.n[2] - rd / 2 / Math.max(0.2, pl.n[2]);
        for (let s1 = Math.min(...es) + rb / 2; s1 <= Math.max(...es) - rb / 2 + 1e-6; s1 += R.at) {
          const p0 = [e[0] * s1, e[1] * s1]; spans(Q2, p0, [g[0], g[1]]).forEach(([t0, t1]) => { const a = [p0[0] + g[0] * t0, p0[1] + g[1] * t0], b = [p0[0] + g[0] * t1, p0[1] + g[1] * t1];
            beam("rafter", [a[0], a[1], zOn(a[0], a[1])], [b[0], b[1], zOn(b[0], b[1])], rb, rd); n.rafters++; n.rafterLen += Math.hypot(t1 - t0, (t1 - t0) * tp); }); }
        if (fr.purlin > 0 && run > fr.purlin) {                                                          // an underpurlin half way up, struts down to the ceiling joists
          const gm = Math.min(...gs) + run / 2, p0 = [g[0] * gm, g[1] * gm];
          spans(Q2, p0, [e[0], e[1]]).forEach(([t0, t1]) => { const a = [p0[0] + e[0] * t0, p0[1] + e[1] * t0], b = [p0[0] + e[0] * t1, p0[1] + e[1] * t1], zp = (x, y) => zOn(x, y) - rd / 2 - 0.06;
            beam("underpurlin", [a[0], a[1], zp(a[0], a[1])], [b[0], b[1], zp(b[0], b[1])], 0.075, 0.12); n.purlinLen += t1 - t0;
            stations(t0, t1, 1.8, 0.3).forEach((tt) => { const q = [p0[0] + e[0] * tt, p0[1] + e[1] * tt]; const zt = zp(q[0], q[1]) - 0.06; if (zt - (top + cd) > 0.1) { beam("strut", [q[0], q[1], top + cd], [q[0], q[1], zt], 0.07, 0.07); n.struts++; } }); });
        }
        void o2;
      });
      // the ridge + hips / valleys: the edges two faces share (level = ridge, sloped = hip / valley)
      const seen = new Map(); planes.forEach((pl) => pl.Q.forEach((p, i) => { const q = pl.Q[(i + 1) % pl.Q.length], k = [p, q].map((x) => x.map((c) => c.toFixed(4)).join(",")).sort().join("|"); seen.set(k, (seen.get(k) || []).concat([[p, q]])); }));
      seen.forEach((v) => { if (v.length < 2) return; const [p, q] = v[0], down = (x) => [x[0], x[1], x[2] - rd * 0.6];
        const below = (Q) => Q.reduce((m, x) => Math.max(m, x[2]), -Infinity) <= p[2] + 1e-6;   // a ridge: both faces fall away from it; else a break between two slopes
        if (Math.abs(p[2] - q[2]) < 1e-6 && seen.size && planes.filter((pl) => pl.Q.some((x) => Math.abs(x[2] - p[2]) < 1e-6 && Math.hypot(x[0] - p[0], x[1] - p[1]) < 1e-4)).every((pl) => below(pl.Q))) { beam("ridge", down(p), down(q), 0.035, rd + 0.05); n.ridge += Math.hypot(q[0] - p[0], q[1] - p[1]); }
        else if (Math.abs(p[2] - q[2]) < 1e-6) { beam("break purlin", down(p), down(q), 0.075, rd + 0.05); n.purlinLen += Math.hypot(q[0] - p[0], q[1] - p[1]); }
        else { beam("hip / valley rafter", down(p), down(q), rb, rd + 0.05); n.hips++; } });
    } else {                                                                                             // trusses: the layout
      for (let x = 0.05; x <= W - 0.05 + 1e-6; x += fr.trussAt) {
        const ys = []; for (let k = 0; k <= 24; k++) ys.push(-ov + (D + 2 * ov) * k / 24);
        const pts = ys.map((y) => { const z = zAt(x, y); return z === null ? null : [x, y, z - 0.05]; });
        let any = false; for (let k = 0; k + 1 < pts.length; k++) if (pts[k] && pts[k + 1]) { beam("truss top chord", pts[k], pts[k + 1], 0.035, 0.09); any = true; }
        if (!any) continue;
        beam("truss bottom chord", [x, 0, top + 0.045], [x, D, top + 0.045], 0.035, 0.09);
        const zy = (y) => { const z = zAt(x, y); return z === null ? null : z - 0.1; };
        [[D / 4, D / 2], [3 * D / 4, D / 2], [D / 4, D / 4], [3 * D / 4, 3 * D / 4], [D / 2, D / 2]].forEach(([yb, yt]) => { const zt = zy(yt); if (zt !== null && zt > top + 0.12) beam("truss web", [x, yb, top + 0.09], [x, yt, zt], 0.035, 0.07); });
        n.trusses++;
      }
    }
    // the checks (rafters + ceiling joists): the sloped span between its supports
    const G = LOAD.roofG[roofLoadOf(A, rf)], cosA = Math.cos(Math.atan(tp));                // 2.695.0: the roof's own covering
    const rSpan = fr.kind === "rafters" ? (fr.purlin > 0 && runMax > fr.purlin ? runMax / 2 : runMax) / cosA : 0;
    const rl = { g: G * R.at, q: LOAD.roofQ * R.at }, cl = { g: 0.2 * C.at, q: 0 };
    const checks = fr.kind === "rafters" && rSpan > 0 ? {
      rafter: Object.assign(check(R, rSpan, rl.g, rl.q), { size: sizeName(R), best: choose(rSpan, rl.g, rl.q, R.grade, { n: 1, at: R.at }) }),
      cj: Object.assign(check(C, C.span, cl.g, cl.q), { size: sizeName(C), best: choose(C.span, cl.g, cl.q, C.grade, { n: 1, at: C.at }) }) } : null;
    return { fr, beams, n, checks, rSpan, run: runMax };
  }
  /** a beam between two points as 6 faces: width w across (level), depth d square to it */
  function drawBeam(bm, col, tag, out) {
    const ax = unit(v3.sub(bm.b, bm.a)); let side = v3.crs(ax, [0, 0, 1]); if (v3.len(side) < 1e-6) side = [1, 0, 0]; side = unit(side); const up = unit(v3.crs(side, ax));
    const hw = v3.mul(side, bm.w / 2), hd = v3.mul(up, bm.d / 2), C = (p, sw, sd) => v3.add(v3.add(p, v3.mul(hw, sw)), v3.mul(hd, sd));
    const a = [C(bm.a, -1, -1), C(bm.a, 1, -1), C(bm.a, 1, 1), C(bm.a, -1, 1)], b = [C(bm.b, -1, -1), C(bm.b, 1, -1), C(bm.b, 1, 1), C(bm.b, -1, 1)];
    const quad = (r, nn) => out.polys.push({ rings: [r], n: nn, col, tag, layer: "main" });
    quad([a[0], a[3], a[2], a[1]], v3.mul(ax, -1)); quad([b[0], b[1], b[2], b[3]], ax);
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, nn = k === 0 ? v3.mul(up, -1) : k === 1 ? side : k === 2 ? up : v3.mul(side, -1); quad([a[k], a[k2], b[k2], b[k]], nn); }
  }
  const ROOFCOL = { "break purlin": "#a97f50", rafter: "#c59a62", "ceiling joist": "#d0a874", ridge: "#b5895a", "hip / valley rafter": "#b5895a", underpurlin: "#a97f50", strut: "#a97f50", "truss top chord": "#c9a06a", "truss bottom chord": "#c9a06a", "truss web": "#bf9562" };
  /** every member of the model -> rows {what, size, count, len} (the plans / panel schedule) */
  function schedule(A, H) {
    const rows = [];
    (A.rooms || []).forEach((R) => plan(A, R, H).members.forEach((m) => rows.push(Object.assign({ room: R.name }, m))));
    lintels(A, H).forEach((L) => rows.push({ room: L.I.R.name, kind: "Lintel (" + L.op.kind + " " + Math.round(L.op.w * 1000) + ")", size: L.size, count: 1, len: L.span + 0.1 }));
    (A.roofs || []).forEach((rf) => { const F = roofFrames(A, rf, H); if (!F) return; const nm = "Roof " + rf.id, f = F.fr;
      if (f.kind === "rafters") rows.push({ room: nm, kind: "Rafters", size: sizeName(f.rafter) + " @ " + Math.round(f.rafter.at * 1000), count: F.n.rafters, len: F.n.rafterLen },
        { room: nm, kind: "Ceiling joists", size: sizeName(f.cj) + " @ " + Math.round(f.cj.at * 1000), count: F.n.cj, len: F.n.cjLen }, { room: nm, kind: "Ridge board", size: "", count: 0, len: F.n.ridge },
        { room: nm, kind: "Hip / valley rafters", size: "", count: F.n.hips, len: 0 }, { room: nm, kind: "Underpurlins + struts", size: "", count: F.n.struts, len: F.n.purlinLen });
      else rows.push({ room: nm, kind: "Trusses (the truss maker's design)", size: "@ " + Math.round(f.trussAt * 1000), count: F.n.trusses, len: 0 }); });
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
    (A.roofs || []).forEach((rf) => { if (hid("roof:" + rf.id)) return; const F = roofFrames(A, rf, H); if (!F) return; const tag = { ak: "roof", id: rf.id, part: "frame" };
      F.beams.forEach((bm) => drawBeam(bm, ROOFCOL[bm.part] || "#c59a62", tag, out)); });
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
  const api = { ROOFMATS, roofMat, roofLoadOf, roofPattern, ROOFFR, cleanRoofFr, roofFrames, drawBeam, STEEL, FRAMES, wallFrames, frameTotals, JOIST, GRADES, SIZES, FLOORS, SITES, PIERS, LOAD, LIMIT, clean, cleanLint, cleanStruct, cleanMember, check, choose, floorChecks, plan, lintel, lintels, schedule, build, sizeName, spans, stations };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPStruct = api;
})(typeof window !== "undefined" ? window : globalThis);
