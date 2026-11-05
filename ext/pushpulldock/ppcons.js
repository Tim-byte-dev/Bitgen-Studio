/* bitGen Studio — ext/pushpulldock/ppcons.js (2.667.0): CONSTRUCTION PLANES + LINES, AND THE SHAPES - window.PPCons / require().
 *
 * Tim (verbatim): "add construction to the objects panel as a heading, planes and construction lines will live in that
 * dropdown, add shapes, for all shapes that are created - user can rename anything in the objects panel, when user clicks a
 * shape allow user to push/pull the shape when dragged"
 *
 *   CONSTRUCTION (kept in M.arch.cons - saved, undone with the model)
 *     planes  {id, name, p, n, size, hidden} - 📌 on the sketch plane's chip keeps the plane in use, or the objects panel's
 *             ＋ makes one (ground XY / front XZ / side YZ through the origin, or the sketch plane); a click on its row makes
 *             it the sketch plane again (the drawing tools draw in it), ⊥ looks straight at it
 *     lines   {id, name, a, b, hidden} - 📏 Tape measure with Ctrl held on its second click; drawn dashed far past both
 *             points; the drawing tools snap onto them ("On Guide" - ppview.js snap reads V.guides)
 *   SHAPES  what the drawing tools made (PPGeo faces / lines): each connected piece (faces sharing corners) is a shape -
 *           "Solid n" when closed, else "Shape n"; loose lines "Lines n"; each group one shape under its own name. A name
 *           given in the objects panel rides on its faces (F.nm) / lines (E.nm) / the group (g.name).
 * Pure (Node: scripts/test-cons667.js): shapes(M), shapeName(M, sh), renameShape(M, sh, name), addPlane(A, o), addLine(A,
 *   a, b, o), removeCons(A, kind, id), samePlane(P, n, p), planeOf(kind).
 */
(function (root) {
  "use strict";
  const nextId = (A) => { const id = A.n || 1; A.n = id + 1; return id; };
  const consOf = (A) => { if (!A.cons || typeof A.cons !== "object") A.cons = { planes: [], lines: [] }; A.cons.planes = A.cons.planes || []; A.cons.lines = A.cons.lines || []; return A.cons; };
  const unit = (n) => { const L = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / L, n[1] / L, n[2] / L]; };
  const ekey = (a, b) => (a < b ? a + "-" + b : b + "-" + a);

  /** the shapes of a geometry model: [{key, kind: group | solid | shape | lines, def (its default name), f: [face ids],
   *  e: [line ids], grp}] - oldest first */
  function shapes(M) {
    if (!M || !Array.isArray(M.f)) return [];
    const out = [], par = new Map();
    const find = (x) => { let r = x; while (par.get(r) !== r) r = par.get(r); let y = x; while (par.get(y) !== r) { const n = par.get(y); par.set(y, r); y = n; } return r; };
    const join = (a, b) => { const A0 = find(a), B0 = find(b); if (A0 !== B0) par.set(A0, B0); };
    const loose = M.f.filter((F) => !F.grp), lines = (M.e || []).filter((E) => !E.grp);
    loose.forEach((F) => { const k = "f" + F.id; par.set(k, k); F.loops.forEach((l) => l.forEach((v) => { const vk = "v" + v; if (!par.has(vk)) par.set(vk, vk); join(k, vk); })); });
    lines.forEach((E) => { const k = "e" + E.id; par.set(k, k); [E.a, E.b].forEach((v) => { const vk = "v" + v; if (!par.has(vk)) par.set(vk, vk); join(k, vk); }); });
    const comps = new Map();
    loose.forEach((F) => { const r = find("f" + F.id); if (!comps.has(r)) comps.set(r, { f: [], e: [] }); comps.get(r).f.push(F.id); });
    lines.forEach((E) => { const r = find("e" + E.id); if (!comps.has(r)) comps.set(r, { f: [], e: [] }); comps.get(r).e.push(E.id); });
    const list = [...comps.values()].map((c) => Object.assign(c, { min: Math.min(...c.f.concat(c.e)) })).sort((a, b) => a.min - b.min);
    let ns = 0, nl = 0, nb = 0;
    list.forEach((c) => {
      if (!c.f.length) { nl++; out.push({ key: "lines:" + c.min, kind: "lines", def: "Lines " + nl, f: [], e: c.e, grp: null, min: c.min }); return; }
      const cnt = new Map();
      c.f.forEach((id) => { const F = M.f.find((x) => x.id === id); F.loops.forEach((l) => l.forEach((v, i) => { const k = ekey(v, l[(i + 1) % l.length]); cnt.set(k, (cnt.get(k) || 0) + 1); })); });
      const closed = c.f.length >= 4 && [...cnt.values()].every((n) => n === 2);
      if (closed) { nb++; out.push({ key: "shape:" + c.min, kind: "solid", def: "Solid " + nb, f: c.f, e: c.e, grp: null, min: c.min }); }
      else { ns++; out.push({ key: "shape:" + c.min, kind: "shape", def: "Shape " + ns, f: c.f, e: c.e, grp: null, min: c.min }); }
    });
    (M.g || []).forEach((g) => {
      const f = M.f.filter((F) => F.grp === g.id).map((F) => F.id), e = (M.e || []).filter((E) => E.grp === g.id).map((E) => E.id);
      if (f.length || e.length) out.push({ key: "geogroup:" + g.id, kind: "group", def: g.name || "Group", f, e, grp: g.id, min: g.id });
    });
    return out;
  }
  /** its name: the group's, else the first name found on its faces / lines, else its default */
  function shapeName(M, sh) {
    if (sh.grp) { const g = (M.g || []).find((x) => x.id === sh.grp); return (g && g.name) || sh.def; }
    for (const id of sh.f) { const F = M.f.find((x) => x.id === id); if (F && F.nm) return F.nm; }
    for (const id of sh.e) { const E = M.e.find((x) => x.id === id); if (E && E.nm) return E.nm; }
    return sh.def;
  }
  function renameShape(M, sh, name) {
    const t = String(name == null ? "" : name).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, 60); if (!t) return false;
    if (sh.grp) { const g = (M.g || []).find((x) => x.id === sh.grp); if (!g) return false; g.name = t; return true; }
    sh.f.forEach((id) => { const F = M.f.find((x) => x.id === id); if (F) F.nm = t; });
    sh.e.forEach((id) => { const E = M.e.find((x) => x.id === id); if (E) E.nm = t; });
    return true;
  }
  /** the standard planes through the origin */
  function planeOf(kind) {
    return { xy: { n: [0, 0, 1], p: [0, 0, 0], name: "Ground plane (XY)" }, xz: { n: [0, 1, 0], p: [0, 0, 0], name: "Front plane (XZ)" }, yz: { n: [1, 0, 0], p: [0, 0, 0], name: "Side plane (YZ)" } }[kind] || null;
  }
  /** the same plane (either way round) */
  function samePlane(P, n, p) {
    const a = unit(n), d = Math.abs(a[0] * P.n[0] + a[1] * P.n[1] + a[2] * P.n[2]); if (d < 0.9999) return false;
    return Math.abs((p[0] - P.p[0]) * P.n[0] + (p[1] - P.p[1]) * P.n[1] + (p[2] - P.p[2]) * P.n[2]) < 1e-4;
  }
  function addPlane(A, o) {
    const C = consOf(A); if (!o || !o.n || !o.p) return null;
    const had = C.planes.find((P) => samePlane(P, o.n, o.p)); if (had) return had;
    const P = { id: nextId(A), name: String(o.name || "Plane " + (C.planes.length + 1)).slice(0, 60), p: o.p.slice(0, 3), n: unit(o.n), size: Math.max(0.2, Math.min(100, +o.size || 2)), hidden: false };
    C.planes.push(P); return P;
  }
  function addLine(A, a, b, o) {
    const C = consOf(A); if (!a || !b || Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-6) return null;
    const L = { id: nextId(A), name: String((o && o.name) || "Construction line " + (C.lines.length + 1)).slice(0, 60), a: a.slice(0, 3), b: b.slice(0, 3), hidden: false };
    C.lines.push(L); return L;
  }
  function removeCons(A, kind, id) {
    const C = consOf(A), k = kind === "plane" ? "planes" : "lines", n = C[k].length;
    C[k] = C[k].filter((x) => x.id !== id); return C[k].length < n;
  }
  const api = { shapes, shapeName, renameShape, planeOf, samePlane, addPlane, addLine, removeCons };
  if (typeof module !== "undefined" && module.exports && !root.document) { module.exports = api; return; }

  /* ---------------- the view: planes (a light square + grid), lines (dashed, far past both points) */
  const doc = root.document, H = () => root.H3PushPull;
  let grp = null, selLine = null;
  const view = () => { const h = H(); return h && h.state ? h.state.V : null; };
  const arch = () => { const h = H(); return h && h.state && h.state.M ? h.state.M.arch : null; };
  function paint() {
    const V = view(); if (!V || !V.T || !V.scene) return;
    const T = V.T, A = arch(), C = A && A.cons ? A.cons : { planes: [], lines: [] };
    if (!grp) { grp = new T.Group(); grp.name = "pp-construction"; V.scene.add(grp); V.hideOnShot = (V.hideOnShot || []).concat([grp]); }
    while (grp.children.length) { const c = grp.children.pop(); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
    const sp = root.PPSketchPlane && root.PPSketchPlane.get ? root.PPSketchPlane.get() : null;
    C.planes.forEach((P) => {
      if (P.hidden) return;
      const B = root.PPSketchPlane && root.PPSketchPlane.basis ? root.PPSketchPlane.basis(P.n) : null; if (!B) return;
      const s = P.size || 2, o = P.p, Q = (a, b) => new T.Vector3(o[0] + B.u[0] * a + B.v[0] * b, o[1] + B.u[1] * a + B.v[1] * b, o[2] + B.u[2] * a + B.v[2] * b);
      const active = sp && samePlane(P, sp.n, sp.p), col = active ? 0xf59e2c : 0x6f9fd8;
      const m = new T.Mesh(new T.BufferGeometry().setFromPoints([Q(-s, -s), Q(s, -s), Q(s, s), Q(-s, -s), Q(s, s), Q(-s, s)]), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false }));
      m.raycast = () => {}; m.renderOrder = 8; grp.add(m);
      const L = [Q(-s, -s), Q(s, -s), Q(s, -s), Q(s, s), Q(s, s), Q(-s, s), Q(-s, s), Q(-s, -s)];
      const ln = new T.LineSegments(new T.BufferGeometry().setFromPoints(L), new T.LineDashedMaterial({ color: col, dashSize: 0.15, gapSize: 0.1 })); ln.computeLineDistances(); ln.raycast = () => {}; grp.add(ln);
    });
    const guides = [];
    C.lines.forEach((Ln) => {
      if (Ln.hidden) return;
      const d = unit([Ln.b[0] - Ln.a[0], Ln.b[1] - Ln.a[1], Ln.b[2] - Ln.a[2]]), m = [(Ln.a[0] + Ln.b[0]) / 2, (Ln.a[1] + Ln.b[1]) / 2, (Ln.a[2] + Ln.b[2]) / 2], R = 60;
      guides.push({ a: Ln.a.slice(), d, id: Ln.id });
      const on = selLine === Ln.id;
      const g = new T.BufferGeometry().setFromPoints([new T.Vector3(m[0] - d[0] * R, m[1] - d[1] * R, m[2] - d[2] * R), new T.Vector3(m[0] + d[0] * R, m[1] + d[1] * R, m[2] + d[2] * R)]);
      const ln = new T.Line(g, new T.LineDashedMaterial({ color: on ? 0xf59e2c : 0x4f86c6, dashSize: 0.12, gapSize: 0.08 })); ln.computeLineDistances(); ln.raycast = () => {}; grp.add(ln);
    });
    V.guides = guides;                                                    // the snapping's "On Guide" (ppview.js)
    if (V.draw) V.draw();
  }
  /** edit the model's construction - one undo step */
  function edit(label, fn) {
    const h = H(); if (!h || !h.state || !h.state.M) return null;
    const before = h.snapshot ? h.snapshot() : null;
    if (!h.state.M.arch) h.state.M.arch = root.PPArch.empty();
    const r = fn(h.state.M.arch, h.state.M);
    if (h.commit) h.commit(label, before);
    paint(); return r;
  }
  const status = (t) => { try { H().msg(t); } catch (e) { /* not booted */ } };
  /** 📌 the sketch plane in use kept as a construction plane */
  function keepPlane() {
    const sp = root.PPSketchPlane && root.PPSketchPlane.get ? root.PPSketchPlane.get() : null;
    if (!sp) { status("📌 click a face first (➤ Select) - it becomes the sketch plane, then 📌 keeps it in Construction"); return null; }
    const P = edit("plane", (A) => addPlane(A, { n: sp.n, p: sp.p, size: Math.max(1, (sp.size || 1.5) * 1.3) }));
    if (P) status("📌 " + P.name + " kept - in the objects panel's Construction (click it there to draw in it again)");
    return P;
  }
  function standardPlane(kind) { const s = planeOf(kind); if (!s) return null; const P = edit("plane", (A) => addPlane(A, { n: s.n, p: s.p, name: s.name, size: 3 })); if (P) use(P); return P; }
  /** a construction plane made the sketch plane */
  function use(P) {
    if (!P || !root.PPSketchPlane) return;
    root.PPSketchPlane.set(P.n, P.p, P.name, P.size);
    paint(); status("✎ " + P.name + " is the sketch plane - ✏ Line / ▭ Rectangle / ◯ Circle / ⬠ Polygon draw in it · ⊥ Look at");
  }
  function addGuide(a, b) { const L = edit("construction line", (A) => addLine(A, a, b)); if (L) status("┄ " + L.name + " - in Construction; the drawing tools snap onto it"); return L; }
  function pickLine(id) { selLine = id; paint(); }
  function boot() { const h = H(); if (!h || !h.state || !h.state.booted || !h.state.V) return false; paint(); return true; }
  if (!boot()) { let k = 0; const t = setInterval(() => { if (boot() || ++k > 240) clearInterval(t); }, 500); }
  root.PPCons = Object.assign({ paint, keepPlane, standardPlane, use, addGuide, pickLine, selLine: () => selLine, edit }, api);
})(typeof window !== "undefined" ? window : globalThis);
