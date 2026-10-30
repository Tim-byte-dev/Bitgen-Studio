/* bitGen Studio — ext/pushpulldock/ppview.js (2.619.0): THE PUSH/PULL 3D VIEW - drawing the model, the camera, picking and
 * SketchUp-style INFERENCE (window.PPView).
 *
 *   create(host) -> V      a three.js view (static/vendor/three-m3d.min.js) in host: Z up, metres
 *   V.setModel(M) / V.rebuild()     the faces (per colour), their edges, the stray lines, the grid + the red / green / blue axes
 *   V.ray(ev)               {o, d} the mouse ray;  V.screen(p) [x, y] a point on screen
 *   V.pick(ev, o)           {face, edge, point, n} what is under the mouse (o.group: inside that group only)
 *   V.snap(ev, o)           the INFERENCE: Endpoint > Midpoint > On Red / Green / Blue Axis (from o.from) > On Edge > On Face >
 *                           o.plane > On Ground -> {p, kind, label, color, face, n}; o.lock = an axis kept (arrows / Shift)
 *   V.preview({lines, dashed, marker, tip, faces})   the tool's rubber band, the inference marker + its words
 *   V.setSel(sel) / V.setHover(h)    the picked faces / lines in blue
 *   V.view(name)  iso | top | front | back | left | right;  V.ortho(on);  V.extents();  V.style(s): edges | shaded | wire | xray | mono
 *   V.shadows(on);  V.tri(F) the face as triangles (for .glb / .obj / .stl);  V.shot(w, h) -> canvas;  V.state() / V.restore(s) the camera
 */
(function (root) {
  "use strict";
  const G = () => root.PPGeo;
  let loading = null;
  function three() {
    if (root.H3THREE) return Promise.resolve(root.H3THREE);
    if (!loading) loading = new Promise((ok, no) => { const s = document.createElement("script"); s.src = "/static/vendor/three-m3d.min.js"; s.onload = () => (root.H3THREE ? ok(root.H3THREE) : no(new Error("three.js did not load"))); s.onerror = () => { loading = null; no(new Error("static/vendor/three-m3d.min.js is missing")); }; document.head.appendChild(s); });
    return loading;
  }
  const AX = [{ dir: [1, 0, 0], color: "#e0302c", label: "On Red Axis" }, { dir: [0, 1, 0], color: "#2ca02c", label: "On Green Axis" }, { dir: [0, 0, 1], color: "#2c6ce0", label: "On Blue Axis" }];
  const SNAP = { Origin: "#f59e2c", Endpoint: "#16a34a", Midpoint: "#06b6d4", "On Edge": "#dc2626", "On Face": "#2563eb", "On Ground": "#9ca3af", "On Plane": "#9ca3af", Center: "#a855f7" };

  async function create(host) {
    const T = await three();
    const V = { T, host, M: null, sel: { f: [], e: [] }, hover: null, group: null, styleName: "edges", isOrtho: false };
    host.style.position = host.style.position || "relative";
    const R = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    R.setClearColor(0xeef0f2, 1);
    R.shadowMap.enabled = false; R.shadowMap.type = T.PCFSoftShadowMap;
    R.domElement.style.cssText = "display:block;width:100%;height:100%;outline:none;touch-action:none";
    R.domElement.tabIndex = 0;
    host.appendChild(R.domElement);
    const scene = new T.Scene();
    const persp = new T.PerspectiveCamera(35, 1, 0.01, 5000); persp.up.set(0, 0, 1); persp.position.set(9, -12, 8);
    const ortho = new T.OrthographicCamera(-10, 10, 10, -10, -5000, 5000); ortho.up.set(0, 0, 1); ortho.position.copy(persp.position);
    let cam = persp;
    const controls = new T.OrbitControls(cam, R.domElement);
    controls.enableDamping = false; controls.zoomToCursor = true; controls.screenSpacePanning = true;
    controls.mouseButtons = { LEFT: -1, MIDDLE: T.MOUSE.ROTATE, RIGHT: T.MOUSE.PAN };
    controls.target.set(0, 0, 0);
    const hemi = new T.HemisphereLight(0xffffff, 0x8a8f99, 0.9); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(8, -6, 14); scene.add(sun); scene.add(sun.target);
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; sun.shadow.camera.far = 200;
    // the ground grid on the XY plane + the axes (solid on the + side, dotted on the - side)
    const grid = new T.GridHelper(40, 40, 0xc3c7cd, 0xd9dce0); grid.rotation.x = Math.PI / 2; grid.position.z = -0.0005; scene.add(grid);
    // 2.620.0: the grid is drawn first and writes no depth - a floor on the ground always covers it (no lines through floors)
    (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => { m.depthWrite = false; }); grid.renderOrder = -1;
    const axes = new T.Group(); scene.add(axes);
    AX.forEach((a) => {
      const pos = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(...a.dir.map((x) => x * 1000))]);
      axes.add(new T.Line(pos, new T.LineBasicMaterial({ color: a.color })));
      const neg = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(...a.dir.map((x) => -x * 1000))]), new T.LineDashedMaterial({ color: a.color, dashSize: 0.25, gapSize: 0.18 }));
      neg.computeLineDistances(); axes.add(neg);
    });
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.ShadowMaterial({ opacity: 0.18 })); ground.receiveShadow = true; ground.position.z = -0.001; ground.visible = false; scene.add(ground);
    const model = new T.Group(); scene.add(model);
    const over = new T.Group(); scene.add(over);              // selection / hover
    const prev = new T.Group(); scene.add(prev);              // the tool's rubber band
    const tip = document.createElement("div");
    tip.style.cssText = "position:absolute;pointer-events:none;font:11px var(--mono,monospace);padding:1px 6px;border-radius:3px;background:#fffbe6;color:#222;border:1px solid #c9b458;display:none;white-space:nowrap;z-index:3";
    host.appendChild(tip);
    let faceMeshes = [], edges = [], dirty = true, raf = 0;

    function size() {
      const w = Math.max(10, host.clientWidth), h = Math.max(10, host.clientHeight);
      R.setSize(w, h, false); persp.aspect = w / h; persp.updateProjectionMatrix();
      const k = ortho.userData.k || 10; ortho.left = -k * w / h; ortho.right = k * w / h; ortho.top = k; ortho.bottom = -k; ortho.updateProjectionMatrix();
      draw();
    }
    function draw() { if (raf) return; raf = root.requestAnimationFrame(() => { raf = 0; R.render(scene, cam); }); }
    controls.addEventListener("change", () => { if (cam === ortho) syncOrthoZoom(); draw(); });
    try { new root.ResizeObserver(size).observe(host); } catch (e) { root.addEventListener("resize", size); }

    function syncOrthoZoom() { /* the orthographic camera keeps its own zoom (OrbitControls zooms it) */ }
    function clear(g) { while (g.children.length) { const c = g.children.pop(); if (c.geometry) c.geometry.dispose(); if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose()); } }
    /** a face as triangles (positions) - its plane's 2D outline through three.js's triangulator (holes too) */
    function tri(F) {
      const M = V.M, g = G(), P = g.facePlane(M, F), B = g.basis(P.n), o = P.p;
      const to = (l) => l.map((i) => { const q = g.to2(M.v[i], o, B); return new T.Vector2(q[0], q[1]); });
      const outer = to(F.loops[0]), holes = F.loops.slice(1).map(to);
      let tris; try { tris = T.ShapeUtils.triangulateShape(outer, holes); } catch (e) { tris = []; }
      const all = F.loops.flat();
      // three wants the outline counter-clockwise; its triangles come back in the points' order - kept facing the normal
      return tris.map((t) => {
        const a = M.v[all[t[0]]], b = M.v[all[t[1]]], c = M.v[all[t[2]]];
        const n = g.v3.cross(g.v3.sub(b, a), g.v3.sub(c, a));
        return g.v3.dot(n, P.n) >= 0 ? [a, b, c] : [a, c, b];
      });
    }
    function rebuild() {
      clear(model); faceMeshes = []; edges = [];
      const M = V.M; if (!M) { draw(); return; }
      const g = G(), by = new Map(), seen = new Set();
      const sty = V.styleName;
      // an imported group (soft) draws no line between two flat neighbours (its triangles read as one surface)
      const soft = new Set((M.g || []).filter((x) => x.soft).map((x) => x.id)), byKey = new Map();
      if (soft.size) M.f.forEach((F) => { if (soft.has(F.grp)) F.loops.forEach((l) => g.loopEdges(l).forEach(([a, c]) => { const k = g.edgeKey(a, c); (byKey.get(k) || byKey.set(k, []).get(k)).push(F); })); });
      const hidden = (k) => { const L = byKey.get(k); if (!L || L.length !== 2) return false; return g.v3.dot(g.faceNormal(M, L[0]), g.faceNormal(M, L[1])) > 0.9995; };
      M.f.forEach((F) => {
        const col = sty === "mono" ? "#f4f4f4" : (F.mat || "#d8d2c4");
        const dim = V.group && F.grp !== V.group;
        const key = col + (dim ? "_d" : "");
        if (!by.has(key)) by.set(key, { col, dim, pos: [], tri2f: [] });
        const b = by.get(key);
        tri(F).forEach((t) => { t.forEach((p) => b.pos.push(p[0], p[1], p[2])); b.tri2f.push(F.id); });
        F.loops.forEach((l) => g.loopEdges(l).forEach(([a, c]) => { const k = g.edgeKey(a, c); if (seen.has(k)) return; seen.add(k); if (soft.has(F.grp) && hidden(k)) return; edges.push({ a, b: c, key: k, face: F.id, grp: F.grp }); }));
      });
      M.e.forEach((E) => { const k = g.edgeKey(E.a, E.b); if (seen.has(k)) return; seen.add(k); edges.push({ a: E.a, b: E.b, key: k, line: E.id, grp: E.grp }); });
      by.forEach((b) => {
        const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(b.pos, 3)); geo.computeVertexNormals();
        const mat = new T.MeshStandardMaterial({ color: b.col, roughness: 0.9, metalness: 0, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
          transparent: sty === "xray" || b.dim, opacity: sty === "xray" ? 0.45 : b.dim ? 0.35 : 1, depthWrite: !(sty === "xray") });
        const mesh = new T.Mesh(geo, mat); mesh.userData.tri2f = b.tri2f; mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.visible = sty !== "wire";
        model.add(mesh); faceMeshes.push(mesh);
      });
      if (sty !== "shaded") {
        const pts = [], dpts = [];
        edges.forEach((E) => { const A = M.v[E.a], Bv = M.v[E.b]; (V.group && E.grp !== V.group ? dpts : pts).push(A[0], A[1], A[2], Bv[0], Bv[1], Bv[2]); });
        const lg = new T.BufferGeometry(); lg.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
        model.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x1b1d21 })));
        if (dpts.length) { const dg = new T.BufferGeometry(); dg.setAttribute("position", new T.Float32BufferAttribute(dpts, 3)); model.add(new T.LineSegments(dg, new T.LineBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.6 }))); }
      }
      if (V.after) try { V.after(); } catch (e) { console.warn("PushPull architecture:", e); }   // 2.620.0: pparchview.js
      paintSel(); draw();
    }
    function paintSel() {
      clear(over);
      const M = V.M; if (!M) return;
      const fs = new Set(V.sel.f || []), es = new Set(V.sel.e || []), hov = V.hover;
      const add = (ids, color, opacity) => {
        const pos = []; M.f.forEach((F) => { if (ids.has(F.id)) tri(F).forEach((t) => t.forEach((p) => pos.push(p[0], p[1], p[2]))); });
        if (!pos.length) return;
        const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        over.add(new T.Mesh(geo, new T.MeshBasicMaterial({ color, transparent: true, opacity, side: T.DoubleSide, depthTest: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
      };
      add(fs, 0x2563eb, 0.35);
      if (hov && hov.face && !fs.has(hov.face)) add(new Set([hov.face]), 0xf59e2c, 0.22);
      const lp = [];
      M.f.forEach((F) => { if (fs.has(F.id)) F.loops.forEach((l) => G().loopEdges(l).forEach(([a, b]) => { const A = M.v[a], B = M.v[b]; lp.push(A[0], A[1], A[2], B[0], B[1], B[2]); })); });
      M.e.forEach((E) => { if (es.has(E.id)) { const A = M.v[E.a], B = M.v[E.b]; lp.push(A[0], A[1], A[2], B[0], B[1], B[2]); } });
      if (hov && hov.edge) { const E = edges.find((x) => x.key === hov.edge); if (E) { const A = M.v[E.a], B = M.v[E.b]; lp.push(A[0], A[1], A[2], B[0], B[1], B[2]); } }
      if (lp.length) { const lg = new T.BufferGeometry(); lg.setAttribute("position", new T.Float32BufferAttribute(lp, 3)); over.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x2563eb, depthTest: false }))); }
    }

    /* ---- the mouse in the scene */
    const rc = new T.Raycaster();
    function ndc(ev) { const r = R.domElement.getBoundingClientRect(); return new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); }
    function ray(ev) { rc.setFromCamera(ndc(ev), cam); const o = rc.ray.origin, d = rc.ray.direction; return { o: [o.x, o.y, o.z], d: [d.x, d.y, d.z] }; }
    function screen(p) { const r = R.domElement.getBoundingClientRect(), v = new T.Vector3(p[0], p[1], p[2]).project(cam); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height, v.z]; }
    function mouse(ev) { const r = R.domElement.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    function hitFace(ev, grp) {
      rc.setFromCamera(ndc(ev), cam);
      const hits = rc.intersectObjects(faceMeshes.filter((m) => m.visible || V.styleName === "wire"), false);
      for (const h of hits) {
        const fid = h.object.userData.tri2f[h.faceIndex]; const F = G().face(V.M, fid); if (!F) continue;
        if (grp !== undefined && grp !== null && F.grp !== grp) continue;
        return { face: fid, point: [h.point.x, h.point.y, h.point.z], n: G().faceNormal(V.M, F), dist: h.distance };
      }
      return null;
    }
    const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    function segScreenDist(m, A, B) {
      const a = screen(A), b = screen(B); if (a[2] > 1 || b[2] > 1) return { d: Infinity, t: 0 };
      const ab = [b[0] - a[0], b[1] - a[1]], L = ab[0] * ab[0] + ab[1] * ab[1]; let t = L ? ((m[0] - a[0]) * ab[0] + (m[1] - a[1]) * ab[1]) / L : 0; t = Math.max(0, Math.min(1, t));
      return { d: d2(m, [a[0] + ab[0] * t, a[1] + ab[1] * t]), t };
    }
    function closestOnSegToRay(A, B, r) {
      const g = G(), d1 = g.v3.sub(B, A), L = g.v3.len(d1); if (L < 1e-12) return A;
      const c = g.linesClosest(A, d1, r.o, r.d); const t = Math.max(0, Math.min(1, c.t)); return g.v3.add(A, g.v3.mul(d1, t));
    }
    const inGroup = (x, o) => !(o && o.group !== undefined && o.group !== null) || x.grp === o.group;
    function pick(ev, o) {
      const M = V.M, m = mouse(ev);
      let best = null;
      edges.forEach((E) => { if (!inGroup(E, o)) return; const s = segScreenDist(m, M.v[E.a], M.v[E.b]); if (s.d < 6 && (!best || s.d < best.d)) best = { d: s.d, E }; });
      const hf = hitFace(ev, o && o.group);
      if (best) {                                        // a line near the mouse - unless a face is clearly in front of it
        const r = ray(ev), p = closestOnSegToRay(M.v[best.E.a], M.v[best.E.b], r);
        if (!hf || G().v3.len(G().v3.sub(p, r.o)) <= hf.dist + 1e-3) return { edge: best.E.key, line: best.E.line || null, faceOfEdge: best.E.face || null, point: p, grp: best.E.grp };
      }
      if (hf) { const F = G().face(M, hf.face); return { face: hf.face, point: hf.point, n: hf.n, grp: F ? F.grp : null }; }
      return null;
    }
    function planeHit(r, n, p) { const g = G(), den = g.v3.dot(n, r.d); if (Math.abs(den) < 1e-9) return null; const t = g.v3.dot(g.v3.sub(p, r.o), n) / den; return t > 0 ? g.v3.add(r.o, g.v3.mul(r.d, t)) : null; }
    function snap(ev, o) {
      const opt = o || {}, M = V.M, g = G(), m = mouse(ev), r = ray(ev);
      const found = (p, kind, extra) => Object.assign({ p, kind, label: kind, color: SNAP[kind] || "#444" }, extra || {});
      if (opt.lock != null && opt.from) {                                      // an axis kept: the point on it
        const a = AX[opt.lock], c = g.linesClosest(opt.from, a.dir, r.o, r.d);
        return found(c.point, a.label, { color: a.color, axis: opt.lock });
      }
      // endpoints + midpoints
      let best = null;
      const usedV = new Set(); edges.forEach((E) => { if (inGroup(E, opt)) { usedV.add(E.a); usedV.add(E.b); } });
      usedV.forEach((i) => { const s = screen(M.v[i]); if (s[2] > 1) return; const d = d2(m, s); if (d < 10 && (!best || d < best.d)) best = { d, p: M.v[i], kind: "Endpoint" }; });
      if (!best) edges.forEach((E) => { if (!inGroup(E, opt)) return; const mid = g.v3.mul(g.v3.add(M.v[E.a], M.v[E.b]), 0.5), s = screen(mid); if (s[2] > 1) return; const d = d2(m, s); if (d < 9 && (!best || d < best.d)) best = { d, p: mid, kind: "Midpoint" }; });
      if (!best) { const so = screen([0, 0, 0]), d0 = d2(m, so); if (so[2] <= 1 && d0 < 10) best = { d: d0, p: [0, 0, 0], kind: "Origin" }; }
      (opt.extra || []).forEach((x) => { const s = screen(x.p); const d = d2(m, s); if (d < 10 && (!best || d < best.d)) best = { d, p: x.p, kind: x.kind || "Center" }; });
      if (best) return found(best.p, best.kind);
      // the red / green / blue axes through the last point
      if (opt.from) {
        let ax = null;
        AX.forEach((a, i) => { const c = g.linesClosest(opt.from, a.dir, r.o, r.d), s = screen(c.point), d = d2(m, s); if (d < 12 && Math.abs(c.t) > 1e-6 && (!ax || d < ax.d)) ax = { d, p: c.point, i }; });
        if (ax) return found(ax.p, AX[ax.i].label, { color: AX[ax.i].color, axis: ax.i });
      }
      // on an edge / a face
      let be = null;
      edges.forEach((E) => { if (!inGroup(E, opt)) return; const s = segScreenDist(m, M.v[E.a], M.v[E.b]); if (s.d < 6 && (!be || s.d < be.d)) be = { d: s.d, E }; });
      const hf = hitFace(ev, opt.group);
      if (be) { const p = closestOnSegToRay(M.v[be.E.a], M.v[be.E.b], r); if (!hf || g.v3.len(g.v3.sub(p, r.o)) <= hf.dist + 1e-3) return found(p, "On Edge", { edge: be.E.key }); }
      if (opt.plane) { const p = planeHit(r, opt.plane.n, opt.plane.p); if (p) return found(p, "On Plane", { n: opt.plane.n }); }
      if (hf) return found(hf.point, "On Face", { face: hf.face, n: hf.n });
      const p = planeHit(r, [0, 0, 1], [0, 0, 0]) || g.v3.add(r.o, g.v3.mul(r.d, 10));
      return found(p, "On Ground", { n: [0, 0, 1] });
    }

    /* ---- the tool's rubber band */
    function preview(o) {
      clear(prev);
      const p = o || {};
      const seg = (list, color, dashed) => {
        if (!list || !list.length) return;
        const pos = []; list.forEach(([a, b]) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2]));
        const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        const L = new T.LineSegments(geo, dashed ? new T.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06, depthTest: false }) : new T.LineBasicMaterial({ color, depthTest: false }));
        if (dashed) L.computeLineDistances(); L.renderOrder = 10; prev.add(L);
      };
      seg(p.lines, p.color || 0x111111, false);
      (p.dashed || []).forEach((d) => seg([d.seg], d.color || 0x888888, true));
      if (p.faces && p.faces.length) {
        const pos = []; p.faces.forEach((t) => t.forEach((q) => pos.push(q[0], q[1], q[2])));
        const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ color: p.faceColor || 0x2563eb, transparent: true, opacity: 0.25, side: T.DoubleSide, depthTest: false })); mesh.renderOrder = 9; prev.add(mesh);
      }
      if (p.marker) {
        const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(p.marker.p, 3));
        const pts = new T.Points(geo, new T.PointsMaterial({ color: p.marker.color || "#16a34a", size: 9, sizeAttenuation: false, depthTest: false })); pts.renderOrder = 11; prev.add(pts);
      }
      if (p.tip && p.tipAt) { const s = screen(p.tipAt); tip.textContent = p.tip; tip.style.left = Math.round(s[0] + 14) + "px"; tip.style.top = Math.round(s[1] + 10) + "px"; tip.style.display = "block"; }
      else tip.style.display = "none";
      draw();
    }

    /* ---- the camera */
    function fitBox() {
      const M = V.M, xb = V.extraBox ? V.extraBox() : null;
      let b = M && M.v.length ? G().bbox(M) : xb || { min: [-2, -2, 0], max: [2, 2, 2] };
      if (xb && M && M.v.length) b = { min: [0, 1, 2].map((k) => Math.min(b.min[k], xb.min[k])), max: [0, 1, 2].map((k) => Math.max(b.max[k], xb.max[k])) };
      const c = G().v3.mul(G().v3.add(b.min, b.max), 0.5), r = Math.max(1, G().v3.len(G().v3.sub(b.max, b.min)) / 2);
      return { c, r };
    }
    function view(name) {
      const { c, r } = fitBox(), vf = persp.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * persp.aspect), D = r / Math.sin(Math.min(vf, hf) / 2) * 1.2;
      const dirs = { iso: [1, -1.3, 0.9], top: [0, -1e-4, 1], front: [0, -1, 0], back: [0, 1, 0], left: [-1, 0, 0], right: [1, 0, 0] };
      const d = G().v3.norm(dirs[name] || dirs.iso);
      controls.target.set(c[0], c[1], c[2]);
      [persp, ortho].forEach((k) => { k.position.set(c[0] + d[0] * D, c[1] + d[1] * D, c[2] + d[2] * D); k.lookAt(c[0], c[1], c[2]); });
      ortho.userData.k = r * 1.3 / Math.min(1, persp.aspect); ortho.zoom = 1; size();
      controls.update(); draw();
    }
    function extents() {
      const { c, r } = fitBox(), dir = G().v3.norm(G().v3.sub([cam.position.x, cam.position.y, cam.position.z], [controls.target.x, controls.target.y, controls.target.z]));
      const vf = persp.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * persp.aspect);   // a narrow docker: its width decides
      const D = r / Math.sin(Math.min(vf, hf) / 2) * 1.15;
      controls.target.set(c[0], c[1], c[2]);
      [persp, ortho].forEach((k) => k.position.set(c[0] + dir[0] * D, c[1] + dir[1] * D, c[2] + dir[2] * D));
      ortho.userData.k = r * 1.2 / Math.min(1, persp.aspect); ortho.zoom = 1; size(); controls.update(); draw();
    }
    function setOrtho(on) {
      V.isOrtho = !!on; const from = cam, to = on ? ortho : persp;
      to.position.copy(from.position); to.quaternion.copy(from.quaternion);
      if (on) { const dist = from.position.distanceTo(controls.target); ortho.userData.k = Math.max(0.5, dist * Math.tan((persp.fov * Math.PI / 180) / 2)); ortho.zoom = 1; }
      cam = to; controls.object = cam; size(); controls.update(); draw();
    }
    function setStyle(s) { V.styleName = ["edges", "shaded", "wire", "xray", "mono"].includes(s) ? s : "edges"; rebuild(); }
    function shadows(on) { R.shadowMap.enabled = !!on; sun.castShadow = !!on; ground.visible = !!on; faceMeshes.forEach((m) => { m.material.needsUpdate = true; }); rebuild(); }
    function shot(w, h, o) {
      const keep = new T.Vector2(); R.getSize(keep);
      const showGrid = !(o && o.clean);
      grid.visible = showGrid; axes.visible = showGrid; prev.visible = false; over.visible = !(o && o.clean);
      const hid = (V.hideOnShot || []).filter((x) => x.visible); if (o && o.clean) hid.forEach((x) => { x.visible = false; });
      const pa = persp.aspect, ol = [ortho.left, ortho.right];
      R.setSize(w, h, false); persp.aspect = w / h; persp.updateProjectionMatrix();
      const k = ortho.userData.k || 10; ortho.left = -k * w / h; ortho.right = k * w / h; ortho.updateProjectionMatrix();
      if (o && o.transparent) R.setClearColor(0x000000, 0);
      R.render(scene, cam);
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(R.domElement, 0, 0, w, h);
      R.setClearColor(V.clear != null ? V.clear : 0xeef0f2, 1); grid.visible = true; axes.visible = true; prev.visible = true; over.visible = true; hid.forEach((x) => { x.visible = true; });
      persp.aspect = pa; ortho.left = ol[0]; ortho.right = ol[1];
      R.setSize(keep.x, keep.y, false); size();
      return c;
    }
    function state() { return { p: cam.position.toArray(), t: controls.target.toArray(), ortho: V.isOrtho, k: ortho.userData.k || 10, zoom: ortho.zoom }; }
    function restore(s) {
      if (!s || !Array.isArray(s.p)) return;
      if (!!s.ortho !== V.isOrtho) setOrtho(!!s.ortho);
      cam.position.fromArray(s.p); controls.target.fromArray(s.t || [0, 0, 0]); ortho.userData.k = s.k || 10; ortho.zoom = s.zoom || 1; size(); controls.update(); draw();
    }
    function leftDrag(mode) { controls.mouseButtons.LEFT = mode === "orbit" ? T.MOUSE.ROTATE : mode === "pan" ? T.MOUSE.PAN : -1; }

    Object.assign(V, {
      R, scene, controls, canvas: R.domElement, cam: () => cam, hemi, sun, grid, ground,
      setModel(M) { V.M = M; rebuild(); }, rebuild, setSel(s) { V.sel = s || { f: [], e: [] }; paintSel(); draw(); }, setHover(h) { V.hover = h; paintSel(); draw(); },
      setGroup(gid) { V.group = gid || null; rebuild(); },
      ray, screen, pick, snap, preview, tri, view, extents, ortho: setOrtho, style: setStyle, shadows, shot, state, restore, leftDrag, size, draw, edges: () => edges,
    });
    size(); view("iso");
    return V;
  }
  root.PPView = { create, three, AX, SNAP };
})(typeof window !== "undefined" ? window : globalThis);
