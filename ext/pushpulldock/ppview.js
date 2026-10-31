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
    // 2.624.0 (Tim: "in push/pull docker make it the same theme colors as bitgen"): the sky, the grid and the tip take the theme's
    // colours (--ink / --panel / --line / --dim / --text / --tiger) - read again when the theme changes (h3theme)
    const css = (k, d) => { try { const v = getComputedStyle(document.documentElement).getPropertyValue(k).trim(); return v || d; } catch (e) { return d; } };
    const hexOf = (c, d) => { try { const x = new T.Color(c); return "#" + x.getHexString(); } catch (e) { return d; } };
    function themeCols() {
      const bg = hexOf(css("--ink", css("--bg", "#14120f")), "#14120f"), pan = hexOf(css("--panel-2", "#26221b"), "#26221b");
      const line = hexOf(css("--line", "#3a342a"), "#3a342a"), dim = hexOf(css("--dim", "#9a917f"), "#9a917f");
      return { bg, pan, line, dim, text: hexOf(css("--text", "#e8e2d6"), "#e8e2d6"), accent: hexOf(css("--tiger", "#f59e2c"), "#f59e2c") };
    }
    V.theme = themeCols();
    R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    R.setClearColor(new T.Color(V.theme.bg), 1); V.clear = new T.Color(V.theme.bg).getHex();
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
    const sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(8, -6, 14); scene.add(sun); scene.add(sun.target); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.mapSize.set(2048, 2048);   // 2.627.0: no shadow acne (stripes) on the faces
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; sun.shadow.camera.far = 200;
    // the ground grid on the XY plane + the axes (solid on the + side, dotted on the - side)
    const grid = new T.GridHelper(40, 40, new T.Color(V.theme.dim), new T.Color(V.theme.line)); grid.rotation.x = Math.PI / 2; grid.position.z = -0.0005; scene.add(grid);
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
    const prev = new T.Group(); prev.name = "pp-preview"; scene.add(prev);              // the tool's rubber band
    const tip = document.createElement("div");
    tip.style.cssText = "position:absolute;pointer-events:none;font:11px var(--mono,monospace);padding:1px 6px;border-radius:3px;background:var(--panel-2,#26221b);color:var(--text,#e8e2d6);border:1px solid var(--tiger,#f59e2c);display:none;white-space:nowrap;z-index:3";
    function retheme() {
      V.theme = themeCols();
      const gm = Array.isArray(grid.material) ? grid.material : [grid.material];
      if (gm[0] && gm[0].color) gm[0].color.set(V.theme.dim); if (gm[1] && gm[1].color) gm[1].color.set(V.theme.line);
      if (!V.nightOn) { V.clear = new T.Color(V.theme.bg).getHex(); R.setClearColor(V.clear, 1); }
      draw();
    }
    root.addEventListener("h3theme", () => setTimeout(retheme, 30));
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
        const lk = root.PPFurn ? root.PPFurn.look(T, b.col) : { color: b.col, map: null, rough: 0.9 };      // 2.629.0: "mat:<key>" = the House builder's material
        if (lk.map) geo.setAttribute("uv", new T.Float32BufferAttribute(root.PPFurn.uvs(b.pos), 2));
        const mat = new T.MeshStandardMaterial({ color: lk.color, map: lk.map || null, roughness: lk.rough, metalness: 0, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
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
      add(fs, new T.Color(V.theme.accent).getHex(), 0.35);   // 2.624.0: the theme's accent
      if (hov && hov.face && !fs.has(hov.face)) add(new Set([hov.face]), new T.Color(V.theme.text).getHex(), 0.18);
      const lp = [];
      M.f.forEach((F) => { if (fs.has(F.id)) F.loops.forEach((l) => G().loopEdges(l).forEach(([a, b]) => { const A = M.v[a], B = M.v[b]; lp.push(A[0], A[1], A[2], B[0], B[1], B[2]); })); });
      M.e.forEach((E) => { if (es.has(E.id)) { const A = M.v[E.a], B = M.v[E.b]; lp.push(A[0], A[1], A[2], B[0], B[1], B[2]); } });
      if (hov && hov.edge) { const E = edges.find((x) => x.key === hov.edge); if (E) { const A = M.v[E.a], B = M.v[E.b]; lp.push(A[0], A[1], A[2], B[0], B[1], B[2]); } }
      (V.sel.k || []).forEach((k) => { const [a, b] = String(k).split("_").map(Number), A = M.v[a], B = M.v[b]; if (A && B) lp.push(A[0], A[1], A[2], B[0], B[1], B[2]); });   // 2.625.0: picked edges
      const vp = []; (V.sel.p || []).forEach((i) => { const q = M.v[i]; if (q) vp.push(q[0], q[1], q[2]); });                                                        // picked corners
      if (hov && hov.vertex != null && M.v[hov.vertex]) { const q = M.v[hov.vertex]; vp.push(q[0], q[1], q[2]); }
      if (vp.length) { const pg = new T.BufferGeometry(); pg.setAttribute("position", new T.Float32BufferAttribute(vp, 3)); over.add(new T.Points(pg, new T.PointsMaterial({ color: new T.Color(V.theme.accent).getHex(), size: 9, sizeAttenuation: false, depthTest: false }))); }
      if (lp.length) { const lg = new T.BufferGeometry(); lg.setAttribute("position", new T.Float32BufferAttribute(lp, 3)); over.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: new T.Color(V.theme.accent).getHex(), depthTest: false }))); }
    }

    /* ---- the mouse in the scene */
    const rc = new T.Raycaster();
    function ndc(ev) { const r = R.domElement.getBoundingClientRect(); return new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); }
    function ray(ev) { cam.updateMatrixWorld(); rc.setFromCamera(ndc(ev), cam); const o = rc.ray.origin, d = rc.ray.direction; return { o: [o.x, o.y, o.z], d: [d.x, d.y, d.z] }; }
    function screen(p) { cam.updateMatrixWorld(); const r = R.domElement.getBoundingClientRect(), v = new T.Vector3(p[0], p[1], p[2]).project(cam); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height, v.z]; }
    function mouse(ev) { const r = R.domElement.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    function hitFace(ev, grp) {
      cam.updateMatrixWorld(); rc.setFromCamera(ndc(ev), cam);      // 2.624.0: a camera moved since the last frame (not drawn yet) is picked where it is now
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
      o = o || {};
      const keep = new T.Vector2(); R.getSize(keep);
      const showGrid = !o.clean;
      grid.visible = showGrid; axes.visible = showGrid; prev.visible = false; over.visible = !o.clean;
      const hid = (V.hideOnShot || []).filter((x) => x.visible); if (o.clean) hid.forEach((x) => { x.visible = false; });
      const pa = persp.aspect, ol = [ortho.left, ortho.right];
      R.setSize(w, h, false); persp.aspect = w / h; persp.updateProjectionMatrix();
      const k = ortho.userData.k || 10; ortho.left = -k * w / h; ortho.right = k * w / h; ortho.updateProjectionMatrix();
      // 2.629.0: o.camera - a camera of the model's (its own pose / lens), else the view's
      const C = o.camera || cam; if (o.camera) { C.aspect = w / h; C.updateProjectionMatrix(); C.updateMatrixWorld(); }
      if (o.transparent) R.setClearColor(0x000000, 0);
      // 2.627.0: a PHOTO source (no lines, shadows, a daylight sky) / a DEPTH map (near = white, far = black) for the edit model
      // 2.629.0: + a NORMAL map; o.camera's depth is linear (0.3 m .. the model's size) - the House builder's shader
      const lines = [], hadSh = R.shadowMap.enabled, fit = { near: persp.near, far: persp.far };
      if (o.photo) { if (!hadSh) shadows(true); R.setClearColor(0xc9dcec, 1); }      // (shadows() rebuilds - the lines are hidden after it)
      if (o.photo || o.depth || o.normal) scene.traverse((x) => { if ((x.isLine || x.isLineSegments || x.isPoints || x.isSprite) && x.visible) { lines.push(x); x.visible = false; } });
      const { c: bc, r: br } = fitBox();
      if (o.depth) {
        ground.visible = false; R.setClearColor(0x000000, 1);
        if (o.camera) scene.overrideMaterial = new T.ShaderMaterial({ uniforms: { near: { value: 0.3 }, far: { value: Math.max(8, br * 2.4) } }, side: T.DoubleSide,
          vertexShader: "varying float vZ; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }",
          fragmentShader: "uniform float near; uniform float far; varying float vZ; void main(){ float d = clamp((vZ - near) / (far - near), 0.0, 1.0); float v = 1.0 - pow(d, 0.6); gl_FragColor = vec4(vec3(v), 1.0); }" });
        else {
          scene.overrideMaterial = new T.MeshDepthMaterial();
          const d = cam.position.distanceTo(new T.Vector3(bc[0], bc[1], bc[2]));
          if (cam === persp) { persp.near = Math.max(0.01, d - br * 1.05); persp.far = d + br * 1.05; persp.updateProjectionMatrix(); }
        }
      }
      if (o.normal) { ground.visible = false; scene.overrideMaterial = new T.MeshNormalMaterial({ side: T.DoubleSide }); R.setClearColor(0x8080ff, 1); }
      R.render(scene, C);
      if (o.depth || o.normal) { scene.overrideMaterial = null; persp.near = fit.near; persp.far = fit.far; persp.updateProjectionMatrix(); ground.visible = R.shadowMap.enabled; }
      if (o.photo && !hadSh) shadows(false);
      lines.forEach((x) => { x.visible = true; });
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(R.domElement, 0, 0, w, h);
      R.setClearColor(V.clear != null ? V.clear : new T.Color(V.theme.bg).getHex(), 1); grid.visible = true; axes.visible = true; prev.visible = true; over.visible = true; hid.forEach((x) => { x.visible = true; });
      persp.aspect = pa; ortho.left = ol[0]; ortho.right = ol[1];
      R.setSize(keep.x, keep.y, false); size();
      return c;
    }
    /** 2.629.0: a 360° panorama (equirectangular W × W/2) from p, its middle facing yaw (degrees, clockwise seen from above) -
        the photo look (no lines, shadows, a daylight sky); the House builder's way (a cube camera + its shader), Z up */
    function pano(p, yaw, W) {
      W = W || 4096; const H = W / 2, keep = new T.Vector2(); R.getSize(keep);
      grid.visible = false; axes.visible = false; prev.visible = false; over.visible = false;
      const hid = (V.hideOnShot || []).filter((x) => x.visible); hid.forEach((x) => { x.visible = false; });
      const hadSh = R.shadowMap.enabled; if (!hadSh) shadows(true);
      const lines = []; scene.traverse((x) => { if ((x.isLine || x.isLineSegments || x.isPoints || x.isSprite) && x.visible) { lines.push(x); x.visible = false; } });
      const bg0 = scene.background; scene.background = new T.Color(0xc9dcec);
      const rt = new T.WebGLCubeRenderTarget(Math.min(2048, W / 4), { generateMipmaps: false }), cc = new T.CubeCamera(0.05, 500, rt);
      cc.position.set(p[0], p[1], p[2]); scene.add(cc); cc.update(R, scene); scene.remove(cc);
      const mat = new T.ShaderMaterial({ uniforms: { tCube: { value: rt.texture }, yaw: { value: (yaw || 0) * Math.PI / 180 } }, depthTest: false, depthWrite: false,
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: "uniform samplerCube tCube; uniform float yaw; varying vec2 vUv;"
          + "vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c)); }"
          + "void main(){ float lon = -yaw - (vUv.x - 0.5) * 6.28318530718; float lat = (vUv.y - 0.5) * 3.14159265359;"
          + " vec3 d = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)); vec4 c = textureCube(tCube, d); gl_FragColor = vec4(toSRGB(c.rgb), 1.0); }" });
      const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat), sc = new T.Scene(); sc.add(quad);
      R.setSize(W, H, false); R.render(sc, new T.OrthographicCamera(-1, 1, 1, -1, 0, 1));
      const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(R.domElement, 0, 0, W, H);
      rt.dispose(); mat.dispose(); quad.geometry.dispose(); scene.background = bg0;
      if (!hadSh) shadows(false);
      lines.forEach((x) => { x.visible = true; }); hid.forEach((x) => { x.visible = true; });
      grid.visible = true; axes.visible = true; prev.visible = true; over.visible = true;
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
      setModel(M) { V.M = M; rebuild(); }, pano, rebuild, setSel(s) { V.sel = s || { f: [], e: [] }; paintSel(); draw(); }, setHover(h) { V.hover = h; paintSel(); draw(); },
      setGroup(gid) { V.group = gid || null; rebuild(); },
      ray, screen, pick, snap, preview, tri, view, extents, ortho: setOrtho, style: setStyle, shadows, shot, state, restore, leftDrag, size, draw, edges: () => edges,
    });
    size(); view("iso");
    return V;
  }
  root.PPView = { create, three, AX, SNAP };
})(typeof window !== "undefined" ? window : globalThis);
