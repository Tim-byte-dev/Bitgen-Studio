/* bitGen Studio — ext/pushpulldock/ppprofile.js (2.640.0): THE SKETCHER'S PROFILES (window.PPProfile) - the cross-sections
 * swept along a room's skirting / cornice, round a door / window (its frame - the architrave) and under a window (its sill).
 * Tim (verbatim): "create a dialog to create profiles for skirting and cornices, list the profiles in the skirting and cornice
 * properties with a dropdown showing the visual profiles. do the same for door frames, window frames and window sills."
 *
 * A profile: {id, name, kind, pts: [[x, y], ...]} - a closed polygon in METRES (counter-clockwise once cleaned):
 *   skirt        x = out from the wall face, y = up from the floor
 *   cornice      x = out from the wall face, y = DOWN from the ceiling
 *   doorframe    x = out from the wall face (how far it stands proud), y = across it, out from the opening's edge
 *   windowframe  as doorframe
 *   sill         x = out from the wall face into the room, y = up from its underside (its top = the window's bottom)
 * Built-in ones have ids "preset:<kind>-<name>"; the user's are kept per project (routes/ppProfiles.js -> lib/ppProfiles.js,
 * projects/<p>/pushpull/profiles.json) and a model carries a copy of every one it uses (arch.profiles) so it draws anywhere.
 *
 *   KINDS, PRESETS, presets(kind), byId(id, list), resolve(A, id, kind) (a missing / wrong-kind one -> the kind's default)
 *   clean(p) -> p | null, cleanList(list), size(p), fit(p, kind, target) -> [[a, b]] the section scaled for the sweep
 *   svg(p, w, h) a thumbnail (an <svg> string), newId()
 *   sweep(chain, closed, sec, map, col, tag) -> {polys, lines}  the section [[a, b]] swept along a 2D chain: a = offset to the
 *     chain's LEFT (mitred at its corners), b = the other way (map(q2, b) -> [x, y, z]); open chains get end caps
 * Pure (Node: scripts/test-profile640.js). */
(function (root) {
  "use strict";
  const KINDS = {
    skirt: { label: "Skirting", axes: ["out from the wall", "up from the floor"], def: "preset:skirt-square" },
    cornice: { label: "Cornice", axes: ["out from the wall", "down from the ceiling"], def: "preset:cornice-square" },
    doorframe: { label: "Door frame", axes: ["out from the wall face", "across, from the opening's edge"], def: "preset:doorframe-flat" },
    windowframe: { label: "Window frame", axes: ["out from the wall face", "across, from the opening's edge"], def: "preset:windowframe-flat" },
    sill: { label: "Window sill", axes: ["out from the wall", "up from its underside"], def: "preset:sill-square" },
  };

  /* ---------------- small 2D maths */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
  const crs = (a, b) => a[0] * b[1] - a[1] * b[0], len = (a) => Math.hypot(a[0], a[1]);
  const norm = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l] : [1, 0]; };
  const left = (u) => [-u[1], u[0]];
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  function area2(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function lineX(p, u, q, w) { const d = crs(u, w); if (Math.abs(d) < 1e-9) return null; const t = crs(sub(q, p), w) / d; return add(p, mul(u, t)); }
  /** points round a centre (cx, cy), radii rx / ry, from angle a0 to a1 (degrees), n steps - both ends included */
  function arc(cx, cy, rx, ry, a0, a1, n) { const out = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return out; }
  /** an S (ogee) from p to q: eased both ways */
  function ess(p, q, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, e = t - Math.sin(2 * Math.PI * t) / (2 * Math.PI); out.push([p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * t]); } return out; }

  /* ---------------- the built-in profiles (native sizes in metres) */
  const P = (kind, key, name, pts) => ({ id: "preset:" + kind + "-" + key, name, kind, pts, preset: true });
  const frames = (kind) => [
    P(kind, "flat", "Flat", [[0, 0], [0.018, 0], [0.018, 0.07], [0, 0.07]]),
    P(kind, "bullnose", "Bullnose", [[0, 0], [0.018, 0]].concat(arc(0.009, 0.061, 0.009, 0.009, 0, 90, 8)).concat([[0, 0.07]])),
    P(kind, "chamfer", "Chamfered", [[0, 0], [0.018, 0], [0.018, 0.058], [0.008, 0.07], [0, 0.07]]),
    P(kind, "splayed", "Splayed", [[0, 0], [0.022, 0], [0.022, 0.006], [0.01, 0.07], [0, 0.07]]),
    P(kind, "colonial", "Colonial (moulded)", [[0, 0], [0.022, 0], [0.022, 0.008]].concat(ess([0.022, 0.012], [0.012, 0.04], 10)).concat(arc(0.012, 0.048, 0.004, 0.008, -90, 90, 6)).concat([[0.008, 0.07], [0, 0.07]])),
    P(kind, "lambstongue", "Lamb's tongue", [[0, 0], [0.02, 0], [0.02, 0.014]].concat(arc(0.006, 0.014, 0.014, 0.056, 0, 90, 10).slice(1)).concat([[0, 0.07]])),
  ];
  const PRESETS = [
    P("skirt", "square", "Square", [[0, 0], [0.015, 0], [0.015, 0.1], [0, 0.1]]),
    P("skirt", "pencil", "Pencil round", [[0, 0], [0.018, 0]].concat(arc(0.014, 0.096, 0.004, 0.004, 0, 90, 5)).concat([[0, 0.1]])),
    P("skirt", "bullnose", "Bullnose", [[0, 0], [0.018, 0]].concat(arc(0.009, 0.091, 0.009, 0.009, 0, 90, 8)).concat([[0, 0.1]])),
    P("skirt", "chamfer", "Chamfered", [[0, 0], [0.018, 0], [0.018, 0.088], [0.006, 0.1], [0, 0.1]]),
    P("skirt", "ogee", "Ogee", [[0, 0], [0.018, 0], [0.018, 0.07]].concat(ess([0.018, 0.07], [0.006, 0.1], 12).slice(1)).concat([[0, 0.1]])),
    P("skirt", "torus", "Torus (bead)", [[0, 0], [0.018, 0], [0.018, 0.074]].concat(arc(0.018, 0.0815, 0.0075, 0.0075, -90, 90, 10).slice(1)).concat([[0.018, 0.09], [0.008, 0.1], [0, 0.1]])),
    P("skirt", "lambstongue", "Lamb's tongue", [[0, 0], [0.018, 0], [0.018, 0.06]].concat(arc(0.004, 0.06, 0.014, 0.04, 0, 90, 10).slice(1)).concat([[0, 0.1]])),
    P("cornice", "square", "Square", [[0, 0], [0.06, 0], [0.06, 0.08], [0, 0.08]]),
    P("cornice", "cove", "Cove", [[0, 0], [0.09, 0]].concat(arc(0.09, 0.09, 0.09, 0.09, 270, 180, 12).slice(1)).concat([[0, 0]]).slice(0, -1)),
    P("cornice", "quadrant", "Quadrant (quarter round)", [[0, 0]].concat(arc(0, 0, 0.07, 0.07, 0, 90, 10))),
    P("cornice", "ogee", "Ogee (crown)", [[0, 0], [0.1, 0], [0.1, 0.012]].concat(ess([0.1, 0.012], [0.012, 0.1], 14).slice(1)).concat([[0, 0.1]])),
    P("cornice", "stepped", "Stepped", [[0, 0], [0.09, 0], [0.09, 0.02], [0.07, 0.02], [0.07, 0.045], [0.045, 0.045], [0.045, 0.07], [0.02, 0.07], [0.02, 0.09], [0, 0.09]]),
    P("cornice", "coveband", "Cove + band", [[0, 0], [0.11, 0], [0.11, 0.018], [0.09, 0.018]].concat(arc(0.09, 0.09, 0.072, 0.072, 270, 180, 12).slice(1)).concat([[0.012, 0.11], [0, 0.11]])),
  ].concat(frames("doorframe"), frames("windowframe"), [
    P("sill", "square", "Square", [[0, 0], [0.06, 0], [0.06, 0.03], [0, 0.03]]),
    P("sill", "bullnose", "Bullnose", [[0, 0], [0.06, 0]].concat(arc(0.045, 0.015, 0.015, 0.015, 0, 90, 8)).concat([[0, 0.03]])),
    P("sill", "nosing", "Round nosing", [[0, 0], [0.05, 0]].concat(arc(0.05, 0.015, 0.015, 0.015, -90, 90, 12).slice(1)).concat([[0, 0.03]])),
    P("sill", "chamfer", "Chamfered", [[0, 0], [0.055, 0], [0.065, 0.012], [0.065, 0.03], [0, 0.03]]),
    P("sill", "apron", "With an apron", [[0, -0.06], [0.02, -0.06], [0.02, 0], [0.065, 0], [0.065, 0.03], [0, 0.03]]),
  ]);
  PRESETS.forEach((p) => { p.pts = clean(p).pts; });
  const presets = (kind) => PRESETS.filter((p) => p.kind === kind);

  /* ---------------- checking */
  function clean(p) {
    if (!p || typeof p !== "object" || !KINDS[p.kind] || !Array.isArray(p.pts)) return null;
    let pts = p.pts.filter((q) => Array.isArray(q) && Number.isFinite(+q[0]) && Number.isFinite(+q[1])).map((q) => [r6(Math.min(1, Math.max(-0.5, +q[0]))), r6(Math.min(1, Math.max(-0.5, +q[1])))]);
    const Q = []; pts.forEach((q) => { if (!Q.length || len(sub(q, Q[Q.length - 1])) > 1e-5) Q.push(q); });
    while (Q.length > 2 && len(sub(Q[0], Q[Q.length - 1])) <= 1e-5) Q.pop();
    pts = Q.slice(0, 400);
    if (pts.length < 3 || Math.abs(area2(pts)) < 1e-8) return null;
    if (area2(pts) < 0) pts.reverse();
    const id = typeof p.id === "string" && /^(preset:)?[a-z0-9_-]{1,40}$/.test(p.id) ? p.id : newId();
    return { id, name: String(p.name || KINDS[p.kind].label).slice(0, 60), kind: p.kind, pts };
  }
  function cleanList(list) { const seen = new Set(); return (Array.isArray(list) ? list : []).map(clean).filter((p) => p && !p.id.startsWith("preset:") && !seen.has(p.id) && seen.add(p.id)).slice(0, 500); }
  let seq = 0;
  function newId() { return "p" + Date.now().toString(36) + (seq++).toString(36); }
  const byId = (id, list) => (list || []).find((p) => p.id === id) || PRESETS.find((p) => p.id === id) || null;
  /** the profile a part uses: the model's own / a built-in; a missing one (or another kind's) -> the kind's default */
  function resolve(A, id, kind) {
    const p = id ? byId(id, A && A.profiles) : null;
    return p && p.kind === kind ? p : byId(KINDS[kind].def);
  }
  function size(p) {
    const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  }
  /** the section for the sweep, [[x, y]] scaled: skirting to its height (y only - its depth stays), a cornice to its size
      (both ways), frames / sills as drawn */
  function fit(p, kind, target) {
    const s = size(p);
    if (kind === "skirt" && target > 0 && s.maxY > 1e-6) { const k = target / s.maxY; return p.pts.map((q) => [q[0], q[1] * k]); }
    if (kind === "cornice" && target > 0 && s.maxY > 1e-6) { const k = target / s.maxY; return p.pts.map((q) => [q[0] * k, q[1] * k]); }
    return p.pts.map((q) => q.slice());
  }

  /* ---------------- a thumbnail */
  /** the profile drawn in a w × h box: the wall (and floor / ceiling) as a thin line, the profile filled with currentColor */
  function svg(p, w, h) {
    w = w || 48; h = h || 48;
    if (!p || !p.pts || p.pts.length < 3) return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"></svg>';
    const s = size(p), pad = 5, span = Math.max(s.w, s.h, 1e-4), k = (Math.min(w, h) - 2 * pad) / span;
    // which way is up on screen: skirting / sill - y up; cornice - y down (the ceiling on top); frames - x up (the wall below)
    const map = p.kind === "cornice" ? (q) => [pad + (q[0] - s.minX) * k, pad + (q[1] - s.minY) * k]
      : p.kind === "doorframe" || p.kind === "windowframe" ? (q) => [pad + (q[1] - s.minY) * k, h - pad - (q[0] - s.minX) * k]
        : (q) => [pad + (q[0] - s.minX) * k, h - pad - (q[1] - s.minY) * k];
    const pts = p.pts.map((q) => map(q).map((v) => v.toFixed(2)).join(",")).join(" ");
    const o = map([0, 0]), ref = p.kind === "cornice" ? "M" + o[0].toFixed(1) + " " + h + "V" + o[1].toFixed(1) + "H" + w
      : p.kind === "doorframe" || p.kind === "windowframe" ? "M0 " + o[1].toFixed(1) + "H" + w : "M" + o[0].toFixed(1) + " 0V" + o[1].toFixed(1) + "H" + w;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" class="ppprofsvg"><path d="' + ref + '" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1"/><polygon points="' + pts + '" fill="currentColor" fill-opacity="0.85" stroke="currentColor" stroke-width="0.6"/></svg>';
  }

  /* ---------------- the sweep */
  const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] };
  const unit3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : null; };
  /** the chain's point j moved a to its left - mitred where two segments meet (square when they are parallel / too sharp) */
  function offAt(C, closed, j, a) {
    const n = C.length, p = C[j], segU = (i) => norm(sub(C[(i + 1) % n], C[i]));
    const hasPrev = closed || j > 0, hasNext = closed || j < n - 1;
    if (Math.abs(a) < 1e-12) return p.slice();
    if (!hasPrev) return add(p, mul(left(segU(j)), a));
    if (!hasNext) return add(p, mul(left(segU(j - 1)), a));
    const u0 = segU((j - 1 + n) % n), u1 = segU(j);
    const x = lineX(add(p, mul(left(u0), a)), u0, add(p, mul(left(u1), a)), u1);
    if (!x || len(sub(x, p)) > 6 * Math.abs(a) + 1e-9) return add(p, mul(left(u1), a));
    return x;
  }
  function sweep(chain, closed, sec, map, col, tag) {
    const out = { polys: [], lines: [] };
    const C = []; (chain || []).forEach((q) => { if (!C.length || len(sub(q, C[C.length - 1])) > 1e-6) C.push([q[0], q[1]]); });
    if (closed) while (C.length > 2 && len(sub(C[0], C[C.length - 1])) <= 1e-6) C.pop();
    const S = (sec || []).filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
    if (C.length < 2 || (closed && C.length < 3) || S.length < 3) return out;
    if (area2(S) < 0) S.reverse();               // counter-clockwise in (a, b): an edge's outward normal is (db, -da)
    const n = C.length, m = S.length, segs = closed ? n : n - 1;
    const M = C.map((_, j) => S.map(([a, b]) => map(offAt(C, closed, j, a), b)));
    // the section's corners (a sharp turn) run as lines along the chain
    const sharp = S.map((q, k) => { const p0 = S[(k - 1 + m) % m], p1 = S[(k + 1) % m], d0 = norm(sub(q, p0)), d1 = norm(sub(p1, q)); return Math.abs(Math.atan2(crs(d0, d1), d0[0] * d1[0] + d0[1] * d1[1])) > 35 * Math.PI / 180; });
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % n, u = norm(sub(C[j1], C[j])), mid = mul(add(C[j], C[j1]), 0.5);
      for (let k = 0; k < m; k++) {
        const k1 = (k + 1) % m, A = M[j][k], B = M[j1][k], Cc = M[j1][k1], D = M[j][k1];
        const nn = unit3(v3.cross(v3.sub(Cc, A), v3.sub(D, B))); if (!nn) continue;
        // which way is out: the section edge's outward normal (db, -da), carried into 3D at the segment's middle
        const e = sub(S[k1], S[k]), bm = (S[k][1] + S[k1][1]) / 2, am = (S[k][0] + S[k1][0]) / 2, base = map(add(mid, mul(left(u), am)), bm);
        const L3 = v3.sub(map(add(mid, mul(left(u), am + 1e-3)), bm), base), B3 = v3.sub(map(add(mid, mul(left(u), am)), bm + 1e-3), base);
        const outw = [L3[0] * e[1] - B3[0] * e[0], L3[1] * e[1] - B3[1] * e[0], L3[2] * e[1] - B3[2] * e[0]];
        const nf = v3.dot(nn, outw) < 0 ? [-nn[0], -nn[1], -nn[2]] : nn;
        out.polys.push({ rings: [[A, B, Cc, D]], n: nf, col, tag, layer: "main" });
        if (sharp[k]) out.lines.push([A, B]);
      }
    }
    // the corners of the chain: the mitre as a line round the section
    for (let j = closed ? 0 : 1; j < (closed ? n : n - 1); j++) {
      const u0 = norm(sub(C[j], C[(j - 1 + n) % n])), u1 = norm(sub(C[(j + 1) % n], C[j]));
      if (Math.abs(crs(u0, u1)) > 0.2 || u0[0] * u1[0] + u0[1] * u1[1] < 0) for (let k = 0; k < m; k++) out.lines.push([M[j][k], M[j][(k + 1) % m]]);
    }
    if (!closed) {                                 // the two ends: the section itself
      [[0, 1], [n - 1, n - 2]].forEach(([j, jn]) => {
        const d = unit3(v3.sub(M[j][0], M[jn][0])); if (!d) return;
        const ring = M[j].slice();
        out.polys.push({ rings: [ring], n: d, col, tag, layer: "main" });          // d points away from the chain: outward
        for (let k = 0; k < m; k++) out.lines.push([M[j][k], M[j][(k + 1) % m]]);
      });
    }
    return out;
  }

  const api = { KINDS, PRESETS, presets, clean, cleanList, newId, byId, resolve, size, fit, svg, sweep, offAt, area2 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPProfile = api;
})(typeof window !== "undefined" ? window : globalThis);
