/* bitGen Studio — ext/pushpulldock/pproads.js (2.673.0): ROADS in the 📏 Sketcher, like SimCity's road tool (window.PPRoads /
 * require()).
 *
 * Tim (verbatim): "in sketcher add a road tool like Sim City's road tool, to draw roads on the map, roads will follow the
 * contour of the ground unless too steep, then offer a tunnel or cut the terrain to pass. offer several types of roads just
 * like sim city, autoplace traffic lights and signs etc"
 *
 * The model keeps them in M.arch (saved with it, undone with it):
 *   roads   [{id, name, type (TYPES), nodes [{p [x, y], a, b}] (as a driveway's - curved: handles made smooth),
 *            curved, mode follow | cut | tunnel, z (the level without a ⛰ ground), prof {sig, z [..]} (the graded
 *            profile, kept while its nodes are unchanged), cut, fill (m³ moved when last graded)}]
 *   roadSet {side left | right (which side traffic keeps to - left: Australia / UK, white centre lines; right: US, yellow),
 *            auto (traffic lights + signs placed at junctions and along the roads)}
 *   TYPES             dirt, street, road, oneway, avenue, highway - lanes, widths, footpaths, median, speed, max grade
 *   section(type)     {c (kerb from the centre), m (median half), H (the whole half width), ...}
 *   path(r, step)     the centre line;   profile(A, r) {P, s, g (ground), z (the road), kind [ground|cut|fill|tunnel|bridge],
 *                     steepest (the ground's grade along it), steep (steeper than its type takes)}
 *   setMode(A, r, m)  follow / cut / tunnel: the profile graded (cut: an even grade, the ground cut + filled to it; tunnel:
 *                     through high ground in a tunnel, over a deep valley on a bridge, cut / filled between) -> {cut, fill}
 *   grade(T, r, pr)   the ground cut / filled to a road's profile (level across it, batters 1 : 2 out to the ground)
 *   junctions(A)      where roads cross / meet: {p, z, R, arms [{id, dir, rank, ctl signal | stop | give | null}], kind}
 *   build(A, out, hid) pparch.build's polygons: carriageways, kerbs + footpaths, medians / barriers, markings, junctions,
 *                     tunnels (portals), bridges (deck, parapets, piers), traffic lights, stop / give-way / speed / one-way /
 *                     street-name signs
 *   outline(r), roadAt(A, p), make(A, pts, o), panel(kit, r, A), icon(type)
 * Pure parts tested in Node: scripts/test-roads673.js; the clicks: scripts/test-ui673-ui.js. */
(function (root) {
  "use strict";
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const num = (v, d, lo, hi) => { const x = +v; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const STEP = 2;                                   // metres between two samples along a road
  const TUN = 6.5, BRIDGE = 4.5, CLEAR = 5.2;       // cover over a tunnel, height under a bridge (m); a tunnel's height
  const COL = { asphalt: "#3a3c40", dirt: "mat:soil", walk: "mat:concrete", kerb: "#a9a59d", grass: "mat:grass", white: "#f2f2ee", yellow: "#e6c02a",
    barrier: "#b4b0a8", lining: "#8e8a83", portal: "#a7a299", dark: "#0d0d0e", pole: "#5b5f64", head: "#1c1d1f", red: "#d0262b", amber: "#f0a21a",
    green: "#2fb34a", signW: "#f4f4f2", signG: "#1f7a3e", signB: "#141414", deck: "#9d998f" };
  // lanes (all), lane width, shoulder, footpath, median (whole), speed (km/h), max grade (rise / run)
  const TYPES = {
    dirt: { label: "Dirt road", icon: "Dirt", lanes: 1, lane: 4, sh: 0, walk: 0, med: 0, speed: 40, max: 0.2, rank: 0 },
    street: { label: "Street", icon: "Street", lanes: 2, lane: 3, sh: 0, walk: 1.8, med: 0, speed: 40, max: 0.15, rank: 1 },
    road: { label: "Road", icon: "Road", lanes: 2, lane: 3.5, sh: 0.5, walk: 2, med: 0, speed: 60, max: 0.12, rank: 2 },
    oneway: { label: "One-way road", icon: "One-way", lanes: 2, lane: 3.3, sh: 0.3, walk: 2, med: 0, speed: 50, max: 0.12, rank: 2, oneway: true },
    avenue: { label: "Avenue", icon: "Avenue", lanes: 4, lane: 3.3, sh: 0.3, walk: 2.5, med: 3, speed: 70, max: 0.08, rank: 3 },
    highway: { label: "Highway", icon: "Highway", lanes: 6, lane: 3.6, sh: 2.5, walk: 0, med: 3, speed: 100, max: 0.06, rank: 3, barrier: true },
  };
  const KEYS = Object.keys(TYPES), MODES = ["follow", "cut", "tunnel"];
  const MODE_LABELS = { follow: "On the ground", cut: "Cut + fill the ground", tunnel: "Tunnel / bridge" };
  function section(type) {
    const t = TYPES[type] || TYPES.road, m = t.med / 2, per = t.med ? t.lanes / 2 : t.lanes;
    const c = t.med ? m + per * t.lane + t.sh : (t.lanes * t.lane) / 2 + t.sh;
    return { t, m, c, H: c + t.walk, per };
  }

  /* ---------------- the model */
  function cleanNode(n) {
    if (!n || !Array.isArray(n.p) || !Number.isFinite(+n.p[0]) || !Number.isFinite(+n.p[1])) return null;
    const v = (q) => (Array.isArray(q) && Number.isFinite(+q[0]) && Number.isFinite(+q[1]) ? [r3(+q[0]), r3(+q[1])] : [0, 0]);
    return { p: [r3(+n.p[0]), r3(+n.p[1])], a: v(n.a), b: v(n.b) };
  }
  function cleanRoad(o) {
    if (!o || !Array.isArray(o.nodes)) return null;
    const nodes = o.nodes.slice(0, 400).map(cleanNode).filter(Boolean);
    if (nodes.length < 2) return null;
    const r = { id: Number.isInteger(+o.id) && +o.id > 0 ? +o.id : 0, name: String(o.name || "Road").slice(0, 60), type: TYPES[o.type] ? o.type : "road", nodes,
      curved: o.curved !== false, mode: MODES.includes(o.mode) ? o.mode : "follow", z: r3(num(o.z, 0, -100, 1000)), cut: r3(num(o.cut, 0, 0, 1e9)), fill: r3(num(o.fill, 0, 0, 1e9)) };
    if (o.prof && typeof o.prof.sig === "string" && Array.isArray(o.prof.z) && o.prof.z.length < 20000 && o.prof.z.every((v) => Number.isFinite(+v))) r.prof = { sig: o.prof.sig.slice(0, 64), z: o.prof.z.map((v) => r3(+v)) };
    return r;
  }
  const cleanRoads = (list) => (Array.isArray(list) ? list : []).slice(0, 200).map(cleanRoad).filter(Boolean);
  const cleanSet = (o) => ({ side: o && o.side === "right" ? "right" : "left", auto: !(o && o.auto === false) });

  /* ---------------- the centre line (a driveway's Bézier nodes; straight when not curved) */
  function bez(n0, n1, t) {
    const P0 = n0.p, P1 = [n0.p[0] + n0.b[0], n0.p[1] + n0.b[1]], P2 = [n1.p[0] + n1.a[0], n1.p[1] + n1.a[1]], P3 = n1.p, u = 1 - t;
    return [u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]];
  }
  function path(r, step) {
    const out = [], st = step || STEP;
    for (let i = 0; i + 1 < r.nodes.length; i++) {
      const n0 = r.nodes[i], n1 = r.nodes[i + 1];
      let L = 0, q = n0.p; for (let k = 1; k <= 8; k++) { const x = bez(n0, n1, k / 8); L += Math.hypot(x[0] - q[0], x[1] - q[1]); q = x; }
      const m = Math.max(1, Math.min(400, Math.ceil(L / st)));
      for (let k = i ? 1 : 0; k <= m; k++) out.push(bez(n0, n1, k / m));
    }
    return out;
  }
  function smooth(r) {
    const N = r.nodes;
    N.forEach((n, i) => {
      if (!r.curved) { n.a = [0, 0]; n.b = [0, 0]; return; }
      const a = N[Math.max(0, i - 1)].p, b = N[Math.min(N.length - 1, i + 1)].p, t = [(b[0] - a[0]) / 6, (b[1] - a[1]) / 6];
      n.b = i < N.length - 1 ? [r3(t[0]), r3(t[1])] : [0, 0]; n.a = i > 0 ? [r3(-t[0]), r3(-t[1])] : [0, 0];
    });
    return r;
  }
  const sig = (r) => { let h = 0; const s = r.type + "|" + r.nodes.map((n) => n.p.concat(n.a, n.b).join(",")).join(";"); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return r.mode + ":" + (h >>> 0).toString(36) + ":" + s.length; };
  function length(r) { const P = path(r, 0.5); let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return r3(L); }
  const tangents = (P) => P.map((c, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; });

  /* ---------------- the profile: on the ground, or graded (an even grade no steeper than its type takes) */
  function limit(g, s, m) {
    const pass = (z, fwd) => { const n = z.length; if (fwd) for (let i = 1; i < n; i++) { const d = m * (s[i] - s[i - 1]); z[i] = Math.min(z[i - 1] + d, Math.max(z[i - 1] - d, z[i])); } else for (let i = n - 2; i >= 0; i--) { const d = m * (s[i + 1] - s[i]); z[i] = Math.min(z[i + 1] + d, Math.max(z[i + 1] - d, z[i])); } return z; };
    const a = pass(pass(g.slice(), true), false), b = pass(pass(g.slice(), false), true);
    return pass(pass(a.map((v, i) => (v + b[i]) / 2), true), false);
  }
  const ease = (g, w) => g.map((_, i) => { let s = 0, n = 0; for (let k = -w; k <= w; k++) { const j = i + k; if (j >= 0 && j < g.length) { s += g[j]; n++; } } return s / n; });
  function profile(A, r) {
    const T = A && A.terrain, PT = root.PPTerrain, t = TYPES[r.type] || TYPES.road;
    const P = path(r), s = [0]; for (let i = 1; i < P.length; i++) s.push(s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const g = P.map((p) => (T && PT ? PT.at(T, p[0], p[1]) : r.z || 0));
    const follow = ease(g, 2);
    let steepest = 0;                                   // the ground's grade along it, over ~10 m
    for (let i = 0; i < P.length; i++) { const j = P.findIndex((_, k) => k > i && s[k] - s[i] >= 10); if (j < 0) break; steepest = Math.max(steepest, Math.abs(follow[j] - follow[i]) / (s[j] - s[i])); }
    let z;
    const sg = sig(r);
    if (r.mode !== "follow" && r.prof && r.prof.sig === sg && r.prof.z.length === P.length) z = r.prof.z.slice();
    else if (r.mode === "follow") z = r.prof && r.prof.sig === sg && r.prof.z.length === P.length ? r.prof.z.slice() : follow;
    else z = limit(g, s, t.max);
    const kind = z.map((v, i) => { const d = v - g[i]; if (r.mode === "tunnel" && -d > TUN) return "tunnel"; if (r.mode === "tunnel" && d > BRIDGE) return "bridge"; return d < -0.05 ? "cut" : d > 0.05 ? "fill" : "ground"; });
    // short tunnels / bridges are cut / filled instead
    for (let i = 0; i < kind.length;) {
      const k = kind[i]; let j = i; while (j + 1 < kind.length && kind[j + 1] === k) j++;
      if ((k === "tunnel" && s[j] - s[i] < 20) || (k === "bridge" && s[j] - s[i] < 12)) for (let q = i; q <= j; q++) kind[q] = k === "tunnel" ? "cut" : "fill";
      i = j + 1;
    }
    let gradeMax = 0; for (let i = 1; i < z.length; i++) gradeMax = Math.max(gradeMax, Math.abs(z[i] - z[i - 1]) / Math.max(1e-6, s[i] - s[i - 1]));
    return { P, s, g, z, kind, sig: sg, steepest: r3(steepest), grade: r3(gradeMax), max: t.max, steep: r.mode === "follow" && steepest > t.max + 0.005 };
  }

  /* ---------------- grading the ground to a road (level across it; batters 1 : 2 out to the ground) */
  function grade(T, r, pr) {
    if (!T || !pr || pr.P.length < 2) return { cut: 0, fill: 0 };
    const S = section(r.type), w0 = S.H + 0.6, B = 2, ext = w0 + 25, A0 = T.cell * T.cell;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    pr.P.forEach((p) => { minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]); maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]); });
    const i0 = Math.max(0, Math.floor((minx - ext - T.x0) / T.cell)), i1 = Math.min(T.nx, Math.ceil((maxx + ext - T.x0) / T.cell));
    const j0 = Math.max(0, Math.floor((miny - ext - T.y0) / T.cell)), j1 = Math.min(T.ny, Math.ceil((maxy + ext - T.y0) / T.cell));
    let cut = 0, fill = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = T.x0 + i * T.cell, y = T.y0 + j * T.cell;
      let best = null;
      for (let k = 0; k + 1 < pr.P.length; k++) {
        const a = pr.P[k], b = pr.P[k + 1], ab = [b[0] - a[0], b[1] - a[1]], L = ab[0] * ab[0] + ab[1] * ab[1];
        const u = L ? Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1]) / L)) : 0, d = Math.hypot(x - a[0] - ab[0] * u, y - a[1] - ab[1] * u);
        if (!best || d < best.d) best = { d, k, u };
      }
      if (!best || best.d > ext) continue;
      const kk = best.u < 0.5 ? best.k : best.k + 1, kd = pr.kind[kk];
      if (kd === "tunnel" || kd === "bridge") continue;
      const z = pr.z[best.k] + (pr.z[best.k + 1] - pr.z[best.k]) * best.u - 0.03, idx = j * (T.nx + 1) + i, h0 = T.h[idx];
      let h = h0;
      if (best.d <= w0) h = z;
      else { h = Math.min(h, z + (best.d - w0) / B); h = Math.max(h, z - (best.d - w0) / B); }
      h = r3(h);
      if (h !== h0) { if (h < h0) cut += (h0 - h) * A0; else fill += (h - h0) * A0; T.h[idx] = h; }
    }
    return { cut: r3(cut), fill: r3(fill) };
  }
  /** a road's way past steep ground: follow (on the ground, levelled across), cut (an even grade, cut + filled), tunnel */
  function setMode(A, r, mode) {
    r.mode = MODES.includes(mode) ? mode : "follow"; delete r.prof;
    const pr = profile(A, r);
    r.prof = { sig: pr.sig, z: pr.z.map(r3) };
    const T = A && A.terrain;
    const v = T ? grade(T, r, pr) : { cut: 0, fill: 0 };
    r.cut = v.cut; r.fill = v.fill;
    return { cut: v.cut, fill: v.fill, profile: pr };
  }

  /* ---------------- junctions: where roads cross or meet (found again on every build - never stored) */
  function segX(a, b, c, d) {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { p: [a[0] + r[0] * t, a[1] + r[1] * t], t, u } : null;
  }
  function nearestOn(P, q) {
    let best = null;
    for (let k = 0; k + 1 < P.length; k++) {
      const a = P[k], b = P[k + 1], ab = [b[0] - a[0], b[1] - a[1]], L = ab[0] * ab[0] + ab[1] * ab[1];
      const u = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / L)) : 0, p = [a[0] + ab[0] * u, a[1] + ab[1] * u], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (!best || d < best.d) best = { d, k, u, p };
    }
    return best;
  }
  function junctions(A, profs) {
    const roads = (A && A.roads) || [], PR = profs || new Map(roads.map((r) => [r.id, profile(A, r)]));
    const cand = [];
    const armsAt = (r, k, u) => {                  // the road's directions out of a point on its segment k at u
      const P = PR.get(r.id).P, T = tangents(P), t = T[u < 0.5 ? k : k + 1] || T[k], st = PR.get(r.id).s, sAt = st[k] + (st[k + 1] - st[k]) * u, L = st[st.length - 1], out = [];
      if (sAt < L - 1.5) out.push({ id: r.id, dir: t.slice(), flowOut: true });
      if (sAt > 1.5) out.push({ id: r.id, dir: [-t[0], -t[1]], flowOut: false });
      return out;
    };
    roads.forEach((a, ia) => roads.forEach((b, ib) => {
      if (ib <= ia) return;
      const Pa = PR.get(a.id).P, Pb = PR.get(b.id).P;
      for (let i = 0; i + 1 < Pa.length; i++) for (let j = 0; j + 1 < Pb.length; j++) {
        const x = segX(Pa[i], Pa[i + 1], Pb[j], Pb[j + 1]); if (!x) continue;
        cand.push({ p: x.p, arms: armsAt(a, i, x.t).concat(armsAt(b, j, x.u)) });
      }
    }));
    roads.forEach((a) => {                          // a road's end on another road (a T) or at its end (a corner)
      const Pa = PR.get(a.id).P;
      [[Pa[0], tangents(Pa)[0]], [Pa[Pa.length - 1], tangents(Pa)[Pa.length - 1].map((v) => -v)]].forEach(([e, inward], ei) => {
        roads.forEach((b) => {
          if (b.id === a.id) return;
          const q = nearestOn(PR.get(b.id).P, e); if (!q || q.d > section(b.type).H + 1.5) return;
          cand.push({ p: q.p, arms: [{ id: a.id, dir: inward, flowOut: ei === 0 }].concat(armsAt(b, q.k, q.u)) });
        });
      });
    });
    // one junction per place: within 4 m merged; one arm per road and way
    const J = [];
    cand.forEach((c) => {
      const j = J.find((x) => Math.hypot(x.p[0] - c.p[0], x.p[1] - c.p[1]) < 4);
      if (!j) { J.push({ p: c.p.slice(), arms: c.arms.slice(), n: 1 }); return; }
      j.p = [(j.p[0] * j.n + c.p[0]) / (j.n + 1), (j.p[1] * j.n + c.p[1]) / (j.n + 1)]; j.n++;
      c.arms.forEach((m) => { if (!j.arms.some((x) => x.id === m.id && x.dir[0] * m.dir[0] + x.dir[1] * m.dir[1] > 0.85)) j.arms.push(m); });
    });
    return J.map((j) => {
      const arms = j.arms.map((m) => { const r = roads.find((x) => x.id === m.id), S = section(r.type); return Object.assign(m, { type: r.type, rank: S.t.rank, c: S.c, H: S.H, oneway: !!S.t.oneway }); });
      const zs = arms.map((m) => { const pr = PR.get(m.id), q = nearestOn(pr.P, j.p); return pr.z[q.k] + (pr.z[q.k + 1] - pr.z[q.k]) * q.u; });
      const z = zs.reduce((a, b) => a + b, 0) / zs.length, R = Math.max(...arms.map((m) => m.H)) + 0.5;
      // who gives way: two major roads (3+ major arms) = traffic lights; minor + minor = stop (4 ways) / give way (a T: the
      // road that ends); a minor road onto a major one = stop on the minor road. One-way arms traffic leaves by: nothing.
      const n = arms.length, maj = arms.filter((m) => m.rank >= 2).length, top = Math.max(...arms.map((m) => m.rank));
      let kind = "none";
      if (n >= 3) {
        if (maj >= 3) { kind = "signal"; arms.forEach((m) => { m.ctl = "signal"; }); }
        else if (top <= 1) { if (n >= 4) { kind = "allstop"; arms.forEach((m) => { m.ctl = "stop"; }); } else { kind = "give"; const ends = new Set(arms.filter((m) => arms.filter((x) => x.id === m.id).length === 1).map((m) => m.id)); arms.forEach((m) => { m.ctl = ends.has(m.id) ? "give" : null; }); } }
        else { kind = "stop"; arms.forEach((m) => { m.ctl = m.rank < top ? "stop" : null; }); }
      }
      arms.forEach((m) => { if (m.oneway && m.flowOut) m.ctl = null; if (!m.ctl) m.ctl = null; });
      return { p: [r3(j.p[0]), r3(j.p[1])], z: r3(z), R: r3(R), arms, kind };
    });
  }

  /* ---------------- the geometry */
  function build(A, out, hid) {
    const roads = ((A && A.roads) || []).filter((r) => !(hid && hid("road:" + r.id)));
    if (!roads.length) return;
    const set = cleanSet(A.roadSet), lhs = set.side === "left";
    const PR = new Map(roads.map((r) => [r.id, profile(A, r)]));
    const J = junctions({ roads, terrain: A.terrain }, PR);
    const n3 = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
    const tri = (a, b, c, col, tag) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (Math.hypot(n[0], n[1], n[2]) < 1e-12) return; n = n3(n); out.polys.push({ rings: [[a, b, c]], n, col, tag, layer: "main" }); };
    const quadUp = (a, b, c, d, col, tag) => { const up = (x, y, z) => { tri(x, y, z, col, tag); const p = out.polys[out.polys.length - 1]; if (p && p.n[2] < 0) { p.n = p.n.map((v) => -v); p.rings[0].reverse(); } }; up(a, b, c); up(a, c, d); };
    const quadOut = (a, b, c, d, col, tag, hint) => { [[a, b, c], [a, c, d]].forEach((t) => { tri(t[0], t[1], t[2], col, tag); const p = out.polys[out.polys.length - 1]; if (p && hint && p.n[0] * hint[0] + p.n[1] * hint[1] + p.n[2] * hint[2] < 0) { p.n = p.n.map((v) => -v); p.rings[0].reverse(); } }); };
    /** a vertical panel facing f (horizontal), centred at c (3D), w wide, h tall - front col, back grey */
    const panel = (c, f, w, h, col, tag, back) => { const rt = [-f[1], f[0], 0], A0 = [c[0] - rt[0] * w / 2, c[1] - rt[1] * w / 2, c[2] - h / 2], B0 = [c[0] + rt[0] * w / 2, c[1] + rt[1] * w / 2, c[2] - h / 2];
      const A1 = [A0[0], A0[1], A0[2] + h], B1 = [B0[0], B0[1], B0[2] + h]; quadOut(A0, B0, B1, A1, col, tag, [f[0], f[1], 0]); if (back) quadOut(A0, B0, B1, A1, back, tag, [-f[0], -f[1], 0]); };
    const ngon = (c, f, rad, k, col, tag, rot) => { const rt = [-f[1], f[0]], R = []; for (let i = 0; i < k; i++) { const a = (rot || 0) + 2 * Math.PI * i / k; R.push([c[0] + rt[0] * Math.cos(a) * rad, c[1] + rt[1] * Math.cos(a) * rad, c[2] + Math.sin(a) * rad]); }
      out.polys.push({ rings: [R], n: [f[0], f[1], 0], col, tag, layer: "main" }); out.polys.push({ rings: [R.slice().reverse()], n: [-f[0], -f[1], 0], col: COL.barrier, tag, layer: "main" }); };
    const box = (p, u, hu, hv, z0, z1, col, tag) => { const v = [-u[1], u[0]], C = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [p[0] + u[0] * a * hu + v[0] * b * hv, p[1] + u[1] * a * hu + v[1] * b * hv]);
      for (let i = 0; i < 4; i++) { const a = C[i], b = C[(i + 1) % 4], m = [(a[0] + b[0]) / 2 - p[0], (a[1] + b[1]) / 2 - p[1], 0]; quadOut([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], col, tag, m); }
      quadUp(...C.map((q) => [q[0], q[1], z1]), col, tag); };
    const signs = [];                                     // [{kind, p, z, f, ...}] - drawn after the roads
    roads.forEach((r) => {
      const pr = PR.get(r.id), S = section(r.type), t = S.t, P = pr.P, T = tangents(P), N = T.map((q) => [-q[1], q[0]]), n = P.length;
      const tag = (part) => ({ ak: "road", id: r.id, part });
      const at = (i, off, dz) => [P[i][0] + N[i][0] * off, P[i][1] + N[i][1] * off, pr.z[i] + (dz || 0)];
      const jd = P.map((p) => J.reduce((m, j) => (j.arms.some((x) => x.id === r.id) ? Math.min(m, Math.hypot(p[0] - j.p[0], p[1] - j.p[1]) - j.R) : m), Infinity));
      const kind = pr.kind;
      const stripI = (i, a, b, dz, col, part) => quadUp(at(i, a, dz), at(i, b, dz), at(i + 1, b, dz), at(i + 1, a, dz), col, tag(part));
      const sideI = (i, off, z0, z1, col, part, out1) => quadOut(at(i, off, z0), at(i + 1, off, z0), at(i + 1, off, z1), at(i, off, z1), col, tag(part), [N[i][0] * out1, N[i][1] * out1, 0]);
      const strip = (a, b, dz, col, part, keep) => { for (let i = 0; i + 1 < n; i++) if (!keep || keep(i)) stripI(i, a, b, dz, col, part); };
      const side = (off, z0, z1, col, part, out1, keep) => { for (let i = 0; i + 1 < n; i++) if (!keep || keep(i)) sideI(i, off, z0, z1, col, part, out1); };
      const surf = t.rank === 0 ? COL.dirt : COL.asphalt, notJ = (i) => jd[i] > 0 && jd[i + 1] > 0, inTun = (i) => kind[i] === "tunnel" && kind[i + 1] === "tunnel";
      // the carriageway(s), the median, the footpaths (cut back at junctions)
      if (S.m) { strip(-S.c, -S.m, 0, surf, "carriageway"); strip(S.m, S.c, 0, surf, "carriageway"); }
      else strip(-S.c, S.c, 0, surf, "carriageway");
      if (S.m && t.barrier) { strip(-S.m, S.m, 0, surf, "carriageway"); strip(-0.3, 0.3, 0.85, COL.barrier, "barrier", notJ); side(-0.3, 0, 0.85, COL.barrier, "barrier", -1, notJ); side(0.3, 0, 0.85, COL.barrier, "barrier", 1, notJ); }
      else if (S.m) { strip(-S.m, S.m, 0.15, COL.grass, "median", notJ); side(-S.m, 0, 0.15, COL.kerb, "kerb", -1, notJ); side(S.m, 0, 0.15, COL.kerb, "kerb", 1, notJ); strip(-S.m, S.m, 0, surf, "carriageway", (i) => !notJ(i)); }
      if (t.walk) { const k = (i) => notJ(i) && !inTun(i); strip(S.c, S.H, 0.15, COL.walk, "footpath", k); strip(-S.H, -S.c, 0.15, COL.walk, "footpath", k); side(S.c, 0, 0.15, COL.kerb, "kerb", -1, k); side(-S.c, 0, 0.15, COL.kerb, "kerb", 1, k); side(S.H, -0.3, 0.15, COL.kerb, "kerb", 1, k); side(-S.H, -0.3, 0.15, COL.kerb, "kerb", -1, k); }
      if (t.barrier) { const k = (i) => notJ(i) && !inTun(i); [S.c + 0.3, -S.c - 0.3].forEach((o) => { strip(o - 0.08, o + 0.08, 0.75, COL.barrier, "guardrail", k); side(o + Math.sign(o) * 0.08, 0.45, 0.75, COL.barrier, "guardrail", Math.sign(o), k); }); }
      // the markings: centre / lane lines (dashed 3 m on, 6 m off), edge lines - stopped short of junctions
      const white = COL.white, centreCol = lhs ? white : COL.yellow, mk = 0.012;
      const line = (off, w, col, dash) => { for (let i = 0; i + 1 < n; i++) { if (!(jd[i] > 1.5 && jd[i + 1] > 1.5)) continue; if (dash && (pr.s[i] % 9) >= 3) continue; quadUp(at(i, off - w / 2, mk), at(i, off + w / 2, mk), at(i + 1, off + w / 2, mk), at(i + 1, off - w / 2, mk), col, tag("marking")); } };
      if (t.rank > 0) {
        if (!S.m) {
          if (t.oneway) line(0, 0.12, white, true);
          else if (lhs || t.rank === 1) line(0, 0.12, t.rank === 1 ? white : centreCol, true);
          else { line(-0.12, 0.1, COL.yellow, false); line(0.12, 0.1, COL.yellow, false); }
          if (t.rank >= 2) { line(S.c - 0.35, 0.12, white, false); line(-S.c + 0.35, 0.12, white, false); }
        } else {
          [1, -1].forEach((sg) => {
            for (let k = 1; k < S.per; k++) line(sg * (S.m + (t.barrier ? 1 : 0) + k * t.lane - (t.barrier ? 0.5 : 0)), 0.12, white, true);
            line(sg * (S.c - (t.barrier ? 2.2 : 0.35)), 0.12, white, false); line(sg * (S.m + 0.35), 0.12, lhs ? white : COL.yellow, false);
          });
        }
        if (t.oneway) for (let i = 0; i + 1 < n; i++) if (Math.floor(pr.s[i] / 40) !== Math.floor(pr.s[i + 1] / 40) && jd[i] > 8) [-S.c / 2, S.c / 2].forEach((o) => {   // arrows along the flow
          const c = at(i, o, mk), f = T[i], l = N[i], pt = (a, b) => [c[0] + f[0] * a + l[0] * b, c[1] + f[1] * a + l[1] * b, c[2]];
          quadUp(pt(-2, -0.12), pt(0.6, -0.12), pt(0.6, 0.12), pt(-2, 0.12), white, tag("marking")); tri(pt(0.6, -0.5), pt(2, 0), pt(0.6, 0.5), white, tag("marking"));
        });
      }
      // a tunnel: walls + ceiling inside, a portal at each end (its mouth dark); a bridge: deck, parapets, piers
      const half = S.H + 0.3;
      for (let i = 0; i + 1 < n; i++) {
        if (inTun(i)) {
          sideI(i, half, 0, CLEAR, COL.lining, "tunnel", -1); sideI(i, -half, 0, CLEAR, COL.lining, "tunnel", 1);
          const c0 = at(i, -half, CLEAR), c1 = at(i, half, CLEAR), c2 = at(i + 1, half, CLEAR), c3 = at(i + 1, -half, CLEAR);
          quadOut(c0, c1, c2, c3, COL.lining, tag("tunnel"), [0, 0, -1]);
        }
        if (kind[i] === "bridge" || kind[i + 1] === "bridge") {
          quadOut(at(i, -half, -0.9), at(i, half, -0.9), at(i + 1, half, -0.9), at(i + 1, -half, -0.9), COL.deck, tag("bridge"), [0, 0, -1]);
          [half, -half].forEach((o) => { sideI(i, o, -0.9, 1.1, COL.deck, "bridge", Math.sign(o)); sideI(i, o - Math.sign(o) * 0.25, 0, 1.1, COL.deck, "bridge", -Math.sign(o)); stripI(i, o - Math.sign(o) * 0.25, o, 1.1, COL.deck, "bridge"); });
          if (Math.floor(pr.s[i] / 24) !== Math.floor(pr.s[i + 1] / 24) && kind[i] === "bridge") [-S.H * 0.55, S.H * 0.55].forEach((o) => { const q = at(i, o); box(q, T[i], 0.6, 0.6, pr.g[i] - 0.5, pr.z[i] - 0.9, COL.deck, tag("pier")); });
        }
      }
      for (let i = 0; i + 1 < n; i++) if ((kind[i] === "tunnel") !== (kind[i + 1] === "tunnel")) {   // a portal
        const k = kind[i] === "tunnel" ? i : i + 1, f = kind[i] === "tunnel" ? T[k].map((v) => v) : T[k].map((v) => -v), face = [f[0], f[1], 0], top = Math.max(CLEAR + 1.5, pr.g[k] - pr.z[k] + 0.3);
        const p = (o, h) => at(k, o, h);
        quadOut(p(-half - 1.2, 0), p(-half, 0), p(-half, top), p(-half - 1.2, top), COL.portal, tag("portal"), face);
        quadOut(p(half, 0), p(half + 1.2, 0), p(half + 1.2, top), p(half, top), COL.portal, tag("portal"), face);
        quadOut(p(-half, CLEAR), p(half, CLEAR), p(half, top), p(-half, top), COL.portal, tag("portal"), face);
        const back = (o, h) => { const q = p(o, h); return [q[0] - f[0] * 0.4, q[1] - f[1] * 0.4, q[2]]; };
        quadOut(back(-half, 0), back(half, 0), back(half, CLEAR), back(-half, CLEAR), COL.dark, tag("portal"), face);
      }
      // speed signs: 25 m in, then every 300 m, each way it is driven (on the kerb its traffic keeps to)
      if (set.auto && t.rank > 0) for (let i = 1; i < n; i++) {
        const sOn = (v) => Math.floor((v - 25) / 300) !== Math.floor((pr.s[i - 1] - 25) / 300) && v >= 25;
        if (!sOn(pr.s[i]) || jd[i] < 6 || kind[i] === "tunnel") continue;
        [1, -1].forEach((way) => {
          if (t.oneway && way < 0) return;
          const tv = [T[i][0] * way, T[i][1] * way], kerbSide = lhs ? 1 : -1, l = [-tv[1], tv[0]], off = (S.H ? S.H - 0.4 : S.c + 0.8) * kerbSide;
          signs.push({ kind: "speed", p: [P[i][0] + l[0] * off, P[i][1] + l[1] * off], z: pr.z[i] + (t.walk ? 0.15 : 0), f: [-tv[0], -tv[1]], v: t.speed, id: r.id });
        });
      }
    });
    // the junctions: an asphalt patch, then (auto) traffic lights / stop / give-way signs, stop lines, crossings, name signs
    J.forEach((j, ji) => {
      if (j.arms.length < 3) return;
      const tag = (part) => ({ ak: "road", id: j.arms[0].id, part, junction: ji });
      const ring = []; for (let k = 0; k < 24; k++) { const a = 2 * Math.PI * k / 24; ring.push([j.p[0] + Math.cos(a) * j.R, j.p[1] + Math.sin(a) * j.R, j.z + 0.006]); }
      out.polys.push({ rings: [ring], n: [0, 0, 1], col: COL.asphalt, tag: tag("junction"), layer: "main" });
      if (!set.auto) return;
      j.arms.forEach((m) => {
        if (!m.ctl) return;
        const d = m.dir, tv = [-d[0], -d[1]], l = [-tv[1], tv[0]], kerb = lhs ? 1 : -1, cross = m.ctl === "signal" && m.H > m.c, dStop = j.R + (cross ? 4.5 : 0.8);
        const P0 = [j.p[0] + d[0] * dStop, j.p[1] + d[1] * dStop], z = j.z + 0.014;
        // the stop line across the lanes that come in (all of a one-way road)
        const from = m.oneway ? -m.c : 0, to = m.c, a0 = kerb * from, a1 = kerb * to, pt = (dd, o) => [P0[0] + d[0] * dd + l[0] * o, P0[1] + d[1] * dd + l[1] * o, z];
        if (m.rank > 0) quadUp(pt(0, a0), pt(0, a1), pt(0.4, a1), pt(0.4, a0), COL.white, tag("marking"));
        if (cross) for (let o = -m.c + 0.4; o < m.c - 0.3; o += 1.2) { const q = (dd, oo) => [j.p[0] + d[0] * dd + l[0] * oo, j.p[1] + d[1] * dd + l[1] * oo, z]; quadUp(q(j.R + 0.8, o), q(j.R + 0.8, o + 0.6), q(j.R + 3.8, o + 0.6), q(j.R + 3.8, o), COL.white, tag("crossing")); }
        const off = kerb * (m.c + 0.7);
        signs.push({ kind: m.ctl, p: [P0[0] + d[0] * 0.8 + l[0] * off, P0[1] + d[1] * 0.8 + l[1] * off], z: j.z + 0.15, f: d.slice(), big: m.rank >= 3, reach: m.c * 0.7, inward: [-l[0] * kerb, -l[1] * kerb], id: m.id });
        if (m.oneway) signs.push({ kind: "oneway", p: [j.p[0] + d[0] * (j.R + 1.2) - l[0] * kerb * (m.c + 0.7), j.p[1] + d[1] * (j.R + 1.2) - l[1] * kerb * (m.c + 0.7)], z: j.z + 0.15, f: [-l[0], -l[1]], flow: m.flowOut ? d.slice() : tv, id: m.id });
      });
      const a = j.arms[0].dir, b = (j.arms.find((m) => m.id !== j.arms[0].id) || j.arms[1]).dir, mid = [a[0] + b[0], a[1] + b[1]], L = Math.hypot(mid[0], mid[1]) || 1;
      signs.push({ kind: "name", p: [j.p[0] + mid[0] / L * (j.R + 1.5), j.p[1] + mid[1] / L * (j.R + 1.5)], z: j.z + 0.15, a, b, id: j.arms[0].id });
    });
    signs.forEach((g) => {
      const tag = { ak: "road", id: g.id, part: "sign" }, f = g.f || [1, 0], u = Math.hypot(f[0], f[1]) ? f : [1, 0];
      const pole = (h) => box(g.p, [u[0], u[1]], 0.05, 0.05, g.z, g.z + h, COL.pole, tag), top = (h) => [g.p[0] + u[0] * 0.07, g.p[1] + u[1] * 0.07, g.z + h];
      if (g.kind === "signal") {
        const head = (q) => { box(q, u, 0.15, 0.2, q[2] - 0.5, q[2] + 0.5, COL.head, tag); [[0.3, COL.red], [0, COL.amber], [-0.3, COL.green]].forEach(([dz, col]) => ngon([q[0] + u[0] * 0.16, q[1] + u[1] * 0.16, q[2] + dz], u, 0.1, 10, col, tag)); };
        pole(g.big ? 5.6 : 3.6); head([g.p[0], g.p[1], g.z + 2.8]);
        if (g.big) { const e = [g.p[0] + g.inward[0] * g.reach, g.p[1] + g.inward[1] * g.reach]; box([(g.p[0] + e[0]) / 2, (g.p[1] + e[1]) / 2], g.inward, g.reach / 2, 0.05, g.z + 5.4, g.z + 5.55, COL.pole, tag); head([e[0], e[1], g.z + 4.9]); }
      } else if (g.kind === "stop") { pole(2.4); ngon(top(2.1), u, 0.38, 8, COL.red, tag, Math.PI / 8); ngon(top(2.1).map((v, i) => v + (i < 2 ? u[i] * 0.01 : 0)), u, 0.3, 8, COL.signW, tag, Math.PI / 8); ngon(top(2.1).map((v, i) => v + (i < 2 ? u[i] * 0.02 : 0)), u, 0.27, 8, COL.red, tag, Math.PI / 8); }
      else if (g.kind === "give") { pole(2.3); ngon(top(2.0), u, 0.45, 3, COL.red, tag, -Math.PI / 2); ngon(top(2.0).map((v, i) => v + (i < 2 ? u[i] * 0.01 : 0)), u, 0.28, 3, COL.signW, tag, -Math.PI / 2); }
      else if (g.kind === "speed") { pole(2.4); ngon(top(2.0), u, 0.3, 20, lhs ? COL.red : COL.signW, tag); ngon(top(2.0).map((v, i) => v + (i < 2 ? u[i] * 0.01 : 0)), u, lhs ? 0.24 : 0.27, 20, COL.signW, tag); }
      else if (g.kind === "oneway") { pole(2.6); panel(top(2.3), u, 0.9, 0.3, COL.signB, tag, COL.barrier); const fl = g.flow, c = top(2.3), dir = fl[0] * -u[1] + fl[1] * u[0] >= 0 ? 1 : -1, rt = [-u[1] * dir, u[0] * dir]; tri([c[0] + rt[0] * 0.38 + u[0] * 0.01, c[1] + rt[1] * 0.38 + u[1] * 0.01, c[2]], [c[0] + rt[0] * 0.18 + u[0] * 0.01, c[1] + rt[1] * 0.18 + u[1] * 0.01, c[2] + 0.1], [c[0] + rt[0] * 0.18 + u[0] * 0.01, c[1] + rt[1] * 0.18 + u[1] * 0.01, c[2] - 0.1], COL.signW, tag); }
      else if (g.kind === "name") { box(g.p, [1, 0], 0.05, 0.05, g.z, g.z + 2.9, COL.pole, tag); [g.a, g.b].forEach((d, k) => { const nn = [-d[1], d[0]], c = [g.p[0] + d[0] * 0.5, g.p[1] + d[1] * 0.5, g.z + 2.6 + k * 0.22]; panel(c, nn, 0.95, 0.18, COL.signG, tag, COL.signG); }); }
    });
  }

  /* ---------------- the plan: the outline (left edge out, right edge back); a road under a point */
  function outline(r) {
    const P = path(r), T = tangents(P), H = section(r.type).H;
    return P.map((c, i) => [c[0] - T[i][1] * H, c[1] + T[i][0] * H]).concat(P.map((c, i) => [c[0] + T[i][1] * H, c[1] - T[i][0] * H]).reverse());
  }
  function roadAt(A, p, extra) {
    let best = null;
    ((A && A.roads) || []).forEach((r) => { const q = nearestOn(path(r), p); if (q && q.d <= section(r.type).H + (extra || 0) && (!best || q.d < best.d)) best = { r, d: q.d, q }; });
    return best;
  }
  /** a click near a road: its end (to carry on from), or a point on its centre line (a T) -> [x, y] | null */
  function snap(A, p, tol) {
    let best = null;
    ((A && A.roads) || []).forEach((r) => {
      const P = path(r);
      [P[0], P[P.length - 1]].forEach((e) => { const d = Math.hypot(e[0] - p[0], e[1] - p[1]); if (d <= Math.max(tol, 3) && (!best || d < best.d - 0.5)) best = { p: e.slice(), d, end: true, id: r.id }; });
      const q = nearestOn(P, p); if (q && q.d <= section(r.type).H && (!best || (!best.end && q.d < best.d))) best = best && best.end ? best : { p: q.p, d: q.d, end: false, id: r.id };
    });
    return best ? { p: [r3(best.p[0]), r3(best.p[1])], end: best.end, id: best.id } : null;
  }
  function make(A, pts, o) {
    const op = o || {}, type = TYPES[op.type] ? op.type : "road", n = ((A && A.roads) || []).filter((r) => r.type === type).length + 1;
    const r = cleanRoad({ name: TYPES[type].label + " " + n, type, curved: op.curved !== false, mode: "follow", nodes: pts.map((p) => ({ p, a: [0, 0], b: [0, 0] })), id: A ? A.n++ : 1 });
    if (!r) return null;
    smooth(r);
    if (A) { if (!A.roads) A.roads = []; A.roads.push(r); }
    return r;
  }
  const pct = (g) => Math.round(g * 1000) / 10 + " %";
  /** a cross-section picture for the type picker */
  function icon(type, w, h) {
    w = w || 48; h = h || 28; const S = section(type), t = S.t, k = (w - 4) / (2 * Math.max(S.H, 6)), cx = w / 2, y = h - 10, X = (o) => (cx + o * k).toFixed(1);
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '">';
    const rect = (a, b, yy, hh, col) => { s += '<rect x="' + X(a) + '" y="' + yy + '" width="' + Math.max(0.5, (b - a) * k).toFixed(1) + '" height="' + hh + '" fill="' + col + '"/>'; };
    rect(-S.c, S.c, y, 5, t.rank === 0 ? "#8a7356" : "#3a3c40");
    if (t.walk) { rect(-S.H, -S.c, y - 1.5, 6.5, "#b9b4aa"); rect(S.c, S.H, y - 1.5, 6.5, "#b9b4aa"); }
    if (S.m) rect(-S.m, S.m, y - (t.barrier ? 5 : 1.5), t.barrier ? 10 : 6.5, t.barrier ? "#b4b0a8" : "#5c8a3a");
    if (t.rank > 0) { const lanes = []; if (!S.m) for (let i = 1; i < t.lanes; i++) lanes.push(-S.c + t.sh + i * t.lane); else for (let i = 1; i < S.per; i++) { lanes.push(S.m + i * t.lane); lanes.push(-S.m - i * t.lane); }
      lanes.forEach((o) => rect(o - 0.08, o + 0.08, y + 1.5, 2, "#f2f2ee")); }
    if (t.oneway) s += '<path d="M' + (cx - 6) + " " + (y - 5) + " H" + (cx + 3) + " l-2 -2 M" + (cx + 3) + " " + (y - 5) + " l-2 2" + '" stroke="#f2f2ee" fill="none" stroke-width="1.2"/>';
    return s + "</svg>";
  }
  /** a road's panel (pparchtools props) */
  function panel(kit, r, A) {
    const pr = profile(A, r), t = TYPES[r.type], S = section(r.type);
    kit.head("🛤 " + r.name + " · " + length(r) + " m");
    if (kit.txtIn) kit.txtIn("Name", r.name, kit.ch((v) => { r.name = v; }));
    kit.selIn("Type", r.type, KEYS.map((k) => [k, TYPES[k].label + " - " + (Math.round(section(k).H * 20) / 10) + " m wide"]), kit.ch((v) => { r.type = v; if (r.mode !== "follow") setMode(A, r, r.mode); }));
    kit.hint(t.lanes + " lane" + (t.lanes > 1 ? "s" : "") + (t.oneway ? " one way" : "") + (S.m ? ", a " + (t.barrier ? "barrier" : "planted median") : "") + (t.walk ? ", footpaths " + t.walk + " m" : "") + " · " + t.speed + " km/h · " + pct(t.max) + " steepest");
    kit.selIn("Past steep ground", r.mode, MODES.map((m) => [m, MODE_LABELS[m]]), kit.ch((v) => { setMode(A, r, v); }));
    if (pr.steep) kit.hint("⚠ The ground is " + pct(pr.steepest) + " steep along it - more than a " + t.label.toLowerCase() + " takes (" + pct(t.max) + "). ⛏ Cut the ground to an even grade, or 🚇 tunnel through the high ground (a bridge over a deep valley).");
    if (pr.steep) kit.btns([["⛏ Cut the ground", kit.ch(() => { setMode(A, r, "cut"); }), "An even grade no steeper than " + pct(t.max) + " - the ground cut and filled to it"], ["🚇 Tunnel / bridge", kit.ch(() => { setMode(A, r, "tunnel"); }), "Through high ground in a tunnel, over a deep valley on a bridge"]]);
    const tun = pr.kind.filter((k) => k === "tunnel").length, bri = pr.kind.filter((k) => k === "bridge").length;
    kit.hint("Grade " + pct(pr.grade) + (r.mode !== "follow" ? " · cut " + Math.round(r.cut) + " m³, filled " + Math.round(r.fill) + " m³" : "") + (tun ? " · tunnel ≈ " + tun * STEP + " m" : "") + (bri ? " · bridge ≈ " + bri * STEP + " m" : ""));
    kit.chkIn("Curved (through its points)", r.curved, kit.ch((v) => { r.curved = v; smooth(r); }));
    const set = A.roadSet = cleanSet(A.roadSet);
    kit.chkIn("Traffic lights + signs (every road)", set.auto, kit.ch((v) => { A.roadSet = Object.assign(cleanSet(A.roadSet), { auto: v }); }));
    kit.selIn("Traffic keeps to the", set.side, [["left", "Left (Australia, UK - white centre lines)"], ["right", "Right (US, Europe - yellow centre lines)"]], kit.ch((v) => { A.roadSet = Object.assign(cleanSet(A.roadSet), { side: v }); }));
    kit.btns([["⛏ Grade again", kit.ch(() => { setMode(A, r, r.mode); }), "The ground under it levelled again (after its points moved)"], ["🗑 Delete", kit.erase]]);
    kit.hint("Its points: the 🛤 Road tool - click the road, drag its points. Junctions get traffic lights / stop / give-way signs by the roads that meet.");
  }

  const api = { TYPES, KEYS, MODES, MODE_LABELS, COL, STEP, TUN, BRIDGE, CLEAR, section, cleanRoad, cleanRoads, cleanSet, bez, path, smooth, sig, length, tangents,
    limit, profile, grade, setMode, junctions, build, outline, roadAt, snap, nearestOn, make, icon, panel, pct };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPRoads = api;
})(typeof window !== "undefined" ? window : globalThis);
