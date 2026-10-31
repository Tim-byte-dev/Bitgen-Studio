/* bitGen Studio — ext/pushpulldock/pparchview.js (2.620.0): THE ARCHITECTURE IN THE 3D VIEW (window.PPArchView) - the rooms'
 * walls / floors / ceilings, the doors and windows, roofs, stairs, floors, and the LIGHTS (each a real three.js light + its
 * fixture: a recessed downlight, a ceiling light, a pendant, a chandelier, a spot, a wall light, a floor / table lamp).
 *
 *   attach(V) -> A   (async: loads static/vendor/polygon-clipping.umd.min.js)   V = the PushPull view (ppview.js)
 *   A.rebuild()      from V.M.arch (pparch.js build) - called by V.rebuild() (V.after)
 *   A.pick(ev)       {tag: {ak, id, part, room}, point, n, dist} the architecture under the mouse (null: none)
 *   A.setSel(t) / A.setHover(t)   a blue / orange outline round {ak, id}
 *   A.setNight(on)   🌙 the sun + sky turned down: the lights light the rooms;  A.cut(on) the roofs + ceilings hidden (a look in)
 *   A.exportMeshes() [{color, pos, nrm, idx, alpha}] (ppglb.js) - the walls, fixtures ...;  A.exportLights() for glTF's lights
 *   A.box()          its extents (for ⤢) */
(function (root) {
  "use strict";
  const G = () => root.PPGeo, P = () => root.PPArch;
  let loading = null;
  function loadPC() {
    if (root.polygonClipping) return Promise.resolve();
    if (!loading) loading = new Promise((ok, no) => { const s = document.createElement("script"); s.src = "/static/vendor/polygon-clipping.umd.min.js"; s.onload = () => (root.polygonClipping ? ok() : no(new Error("polygon-clipping did not load"))); s.onerror = () => { loading = null; no(new Error("static/vendor/polygon-clipping.umd.min.js is missing")); }; document.head.appendChild(s); });
    return loading;
  }
  // lumens -> three.js candela, then a little lower: the view has no camera exposure, a 1-to-1 room is burnt white
  const CD = (lm) => (lm / (4 * Math.PI)) * 0.1;

  async function attach(V) {
    await loadPC();
    const T = V.T, scene = V.scene;
    const geo = new T.Group(); geo.name = "pp-arch"; scene.add(geo);           // the built geometry (rebuilt)
    const fix = new T.Group(); fix.name = "pp-fixtures"; scene.add(fix);       // the lights' fixtures + lights
    const selG = new T.Group(); scene.add(selG);
    const A = { V, isNight: false, cutaway: false, meshes: [], tags: [], built: null, sel: null, hover: null };
    V.hideOnShot = (V.hideOnShot || []).concat([selG]);
    const mats = new Map();
    function clear(g) { while (g.children.length) { const c = g.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isLight && o.dispose) o.dispose(); }); } }
    function mat(col, alpha, emissive) {
      const sty = V.styleName, k = col + "|" + alpha + "|" + (emissive || "") + "|" + sty;
      if (mats.has(k)) return mats.get(k);
      const c = sty === "mono" && alpha >= 1 && !emissive ? "#f4f4f4" : col;
      const m = new T.MeshStandardMaterial({ color: c, roughness: alpha < 1 ? 0.05 : 0.85, metalness: 0, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        transparent: alpha < 1 || sty === "xray", opacity: sty === "xray" ? Math.min(alpha, 0.4) : alpha, depthWrite: !(alpha < 1 || sty === "xray"),
        emissive: emissive ? new T.Color(emissive) : new T.Color(0), emissiveIntensity: emissive ? 1 : 0 });
      mats.set(k, m); return m;
    }
    /** a planar polygon (rings, normal) -> triangles facing n */
    function triPoly(pl) {
      const g = G(), n = pl.n, B = g.basis(n), o = pl.rings[0][0];
      const to = (r) => r.map((p) => { const q = g.to2(p, o, B); return new T.Vector2(q[0], q[1]); });
      let tr; try { tr = T.ShapeUtils.triangulateShape(to(pl.rings[0]), pl.rings.slice(1).map(to)); } catch (e) { tr = []; }
      const all = pl.rings.flat();
      return tr.map((t) => { const a = all[t[0]], b = all[t[1]], c = all[t[2]]; const nn = g.v3.cross(g.v3.sub(b, a), g.v3.sub(c, a)); return g.v3.dot(nn, n) >= 0 ? [a, b, c] : [a, c, b]; });
    }
    function rebuild() {
      clear(geo); clear(fix); A.meshes = []; A.tags = [];
      mats.forEach((m) => m.dispose()); mats.clear();
      const M = V.M, Ar = M && M.arch;
      if (!Ar || !P().has(Ar)) { A.built = null; paintSel(); return; }
      let B; try { B = P().build(Ar); } catch (e) { console.warn("PushPull architecture:", e); A.built = null; return; }
      A.built = B;
      const sty = V.styleName, by = new Map();
      B.polys.forEach((pl) => {
        const alpha = pl.alpha || 1, key = pl.col + "|" + alpha + "|" + (pl.layer || "main");
        if (!by.has(key)) by.set(key, { col: pl.col, alpha, layer: pl.layer || "main", pos: [], t2: [] });
        const b = by.get(key); let ti = A.tags.indexOf(pl.tag);
        if (ti < 0) { A.tags.push(pl.tag); ti = A.tags.length - 1; }
        triPoly(pl).forEach((t) => { t.forEach((p) => b.pos.push(p[0], p[1], p[2])); b.t2.push(ti); });
      });
      by.forEach((b) => {
        if (!b.pos.length) return;
        const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(b.pos, 3)); g.computeVertexNormals();
        const mesh = new T.Mesh(g, mat(b.col, b.alpha)); mesh.userData = { t2: b.t2, layer: b.layer, alpha: b.alpha };
        mesh.castShadow = b.alpha >= 1; mesh.receiveShadow = true; mesh.visible = sty !== "wire"; mesh.renderOrder = b.alpha < 1 ? 2 : 0;
        geo.add(mesh); A.meshes.push(mesh);
      });
      if (sty !== "shaded") {
        [["main", B.lines], ["roof", B.roofLines]].forEach(([layer, L]) => {
          if (!L.length) return;
          const pos = []; L.forEach(([a, b]) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2]));
          const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
          const ls = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x1b1d21 })); ls.userData = { layer }; geo.add(ls);
        });
      }
      B.lights.forEach((L) => fixture(L));
      layers(); paintSel();
    }
    /* ---- the lights: a fixture + a three.js light each */
    function fixture(L) {
      const g = new T.Group(), tag = { ak: "light", id: L.id }, on = L.on, col = L.col;
      g.position.set(L.p[0], L.p[1], L.p[2] - ((P().LIGHTS[L.type] || {}).mount === "ceil" ? 0.004 : 0)); g.userData = { tag };   // just under the ceiling
      const body = mat(L.type === "chandelier" ? "#c9a74a" : "#e8e8e8", 1), bulb = mat("#ffffff", 1, on ? col : null), dark = mat("#2b2b2b", 1);
      const add = (geom, m, x, y, z, rx) => { const o = new T.Mesh(geom, m); o.position.set(x || 0, y || 0, z || 0); if (rx) o.rotation.x = rx; o.userData = { tag }; g.add(o); return o; };
      const cyl = (rt, rb, h, seg, open) => { const c = new T.CylinderGeometry(rt, rb, h, seg || 20, 1, !!open); c.rotateX(Math.PI / 2); return c; };   // three's Y up -> Z up
      const lights = [];
      const point = (z, k) => { const l = new T.PointLight(col, CD(L.lm) * (k || 1), 12, 2); l.position.set(0, 0, z); lights.push(l); };
      const spot = (z, ang) => { const l = new T.SpotLight(col, CD(L.lm) * 2.2, 12, (ang || L.ang) * Math.PI / 360, 0.55, 2); l.position.set(0, 0, z); l.target.position.set(0, 0, z - 3); g.add(l.target); lights.push(l); };
      switch (L.type) {
        case "downlight": add(cyl(0.055, 0.055, 0.012), bulb, 0, 0, -0.008); add(cyl(0.07, 0.07, 0.006, 24), body, 0, 0, -0.004); spot(-0.02); break;
        case "ceiling": { const d = new T.SphereGeometry(0.2, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); d.rotateX(Math.PI / 2); d.scale(1, 1, 0.35); add(d, bulb, 0, 0, 0); add(cyl(0.21, 0.21, 0.015, 28), body, 0, 0, -0.008); point(-0.12); break; }
        case "pendant": { const dr = L.drop; add(cyl(0.004, 0.004, dr, 6), dark, 0, 0, -dr / 2); add(cyl(0.04, 0.04, 0.02, 12), dark, 0, 0, -0.01);
          const shade = new T.ConeGeometry(0.2, 0.22, 28, 1, true); shade.rotateX(Math.PI / 2); add(shade, mat("#3a3f45", 1), 0, 0, -dr - 0.06); add(new T.SphereGeometry(0.045, 14, 10), bulb, 0, 0, -dr - 0.12); spot(-dr - 0.12, 110); point(-dr - 0.1, 0.35); break; }
        case "chandelier": { const dr = L.drop; add(cyl(0.006, 0.006, dr, 6), mat("#c9a74a", 1), 0, 0, -dr / 2); add(cyl(0.05, 0.02, 0.28, 16), body, 0, 0, -dr - 0.1);
          const arms = 6, r = 0.32;
          for (let i = 0; i < arms; i++) {
            const a = i / arms * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r;
            const arm = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, r, 6), body); arm.position.set(x / 2, y / 2, -dr - 0.18); arm.rotation.z = a - Math.PI / 2; arm.userData = { tag }; g.add(arm);
            add(cyl(0.03, 0.02, 0.03, 12), body, x, y, -dr - 0.165); add(cyl(0.012, 0.012, 0.08, 8), mat("#f7f2e2", 1), x, y, -dr - 0.11);
            add(new T.SphereGeometry(0.022, 10, 8), bulb, x, y, -dr - 0.055);
          }
          add(new T.TorusGeometry(r, 0.008, 6, 40), body, 0, 0, -dr - 0.18); point(-dr - 0.06); break; }
        case "spot": { add(cyl(0.02, 0.02, 0.04, 10), dark, 0, 0, -0.02); const h = add(cyl(0.045, 0.035, 0.13, 18), dark, 0, 0.03, -0.1, 0.5); void h; add(new T.CircleGeometry(0.034, 18), bulb, 0, 0.06, -0.155, Math.PI + 0.5); spot(-0.16); break; }
        case "wall": { const d = L.dir * Math.PI / 180; g.rotation.z = d; add(new T.BoxGeometry(0.03, 0.1, 0.22), body, -0.005, 0, 0);
          const sh = new T.CylinderGeometry(0.09, 0.07, 0.16, 20, 1, true); sh.rotateX(Math.PI / 2); add(sh, mat("#f3ead8", 1, on ? col : null), 0.09, 0, 0.02); const l = new T.PointLight(col, CD(L.lm), 12, 2); l.position.set(0.2, 0, 0.02); lights.push(l); break; }
        case "floorlamp": { add(cyl(0.16, 0.16, 0.025, 24), dark, 0, 0, 0.0125); add(cyl(0.012, 0.012, 1.45, 8), dark, 0, 0, 0.74);
          const sh = new T.CylinderGeometry(0.17, 0.22, 0.3, 28, 1, true); sh.rotateX(Math.PI / 2); add(sh, mat("#f3ead8", 1, on ? col : null), 0, 0, 1.52); point(1.5); break; }
        default: { add(cyl(0.08, 0.1, 0.03, 20), dark, 0, 0, 0.015); add(cyl(0.01, 0.01, 0.32, 8), dark, 0, 0, 0.18);   // a table lamp
          const sh = new T.CylinderGeometry(0.11, 0.15, 0.2, 24, 1, true); sh.rotateX(Math.PI / 2); add(sh, mat("#f3ead8", 1, on ? col : null), 0, 0, 0.4); point(0.38); }
      }
      if (on) lights.forEach((l) => { l.castShadow = false; l.userData = { light: true }; l.visible = A.isNight; g.add(l); });
      fix.add(g);
    }
    /* ---- what shows */
    function layers() {
      geo.children.forEach((o) => { const L = o.userData && o.userData.layer; if (L === "roof" || L === "ceil") o.visible = !A.cutaway && (o.isMesh ? V.styleName !== "wire" : true); });
      const hemi = V.hemi, sun = V.sun;
      if (hemi) hemi.intensity = A.isNight ? 0.12 : 0.9;
      // the rooms' lights light at night - by day the sun does (no light shines through a wall here: it would by day too)
      fix.traverse((o) => { if (o.isLight) o.visible = A.isNight; });
      if (sun) sun.intensity = A.isNight ? 0 : 1.6;
      const bg = A.isNight ? 0x0b0d12 : new T.Color((V.theme && V.theme.bg) || "#14120f").getHex(); V.R.setClearColor(bg, 1); V.clear = bg; V.nightOn = A.isNight;   // 2.624.0: the theme's sky by day
      V.draw();
    }
    function setNight(on) { A.isNight = !!on; layers(); }
    function cut(on) { A.cutaway = !!on; layers(); paintSel(); }

    /* ---- picking */
    const rc = new T.Raycaster();
    function pick(ev) {
      const r = V.canvas.getBoundingClientRect();
      V.cam().updateMatrixWorld(); rc.setFromCamera(new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), V.cam());
      const objs = A.meshes.filter((m) => m.visible || V.styleName === "wire").concat(fix.children);
      const hits = rc.intersectObjects(objs, true);
      for (const h of hits) {
        let tag = null;
        if (h.object.userData && h.object.userData.t2) tag = A.tags[h.object.userData.t2[h.faceIndex]];
        else { let o = h.object; while (o && !(o.userData && o.userData.tag)) o = o.parent; tag = o && o.userData.tag; }
        if (!tag) continue;
        const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new T.Vector3(0, 0, 1);
        const d = [rc.ray.direction.x, rc.ray.direction.y, rc.ray.direction.z]; if (n.x * d[0] + n.y * d[1] + n.z * d[2] > 0) n.negate();
        return { tag, point: [h.point.x, h.point.y, h.point.z], n: [n.x, n.y, n.z], dist: h.distance };
      }
      return null;
    }
    /** the thing a click means: a wall face -> the room it faces (outside: the nearest wall's room) */
    function resolve(hit) {
      if (!hit) return null;
      const t = hit.tag, Ar = V.M.arch;
      if (t.ak !== "wall") return { ak: t.ak, id: t.id, part: t.part || null };
      const at = [hit.point[0] - hit.n[0] * 0.05, hit.point[1] - hit.n[1] * 0.05];
      if (t.room) {                                                     // 2.624.0: + which of its walls
        const R = P().room(Ar, t.room); let edge = t.edge != null ? t.edge : null;
        if (R && edge == null) { let bd = Infinity; P().edgesOf(R).forEach((e) => { const d = P().segDist(at, e.a, e.b).d; if (d < bd) { bd = d; edge = e.i; } }); }
        return { ak: "room", id: t.room, part: "wall", edge };
      }
      const w = P().nearestWall(Ar, at, 0.6, hit.point[2]);
      return w ? { ak: "room", id: w.room, part: "wall", edge: w.edge } : null;
    }
    /* ---- the outline of what is picked */
    function outline(t, color, out) {
      const Ar = V.M && V.M.arch; if (!t || !Ar) return;
      const segs = [];
      const loop = (pts, z) => pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; segs.push([[p[0], p[1], z], [q[0], q[1], z]]); });
      if (t.ak === "wpt" || t.ak === "wtop") {                         // 2.624.0: a cut / a top edge of a wall
        const pts = P().topPoints(Ar, t.room, t.edge); const R = P().room(Ar, t.room); if (!pts.length || !R) return;
        if (t.ak === "wpt") { const q = pts[t.k]; if (!q) return; segs.push([[q[0], q[1], R.z], q]); const d = 0.12; segs.push([[q[0] - d, q[1], q[2]], [q[0] + d, q[1], q[2]]], [[q[0], q[1] - d, q[2]], [q[0], q[1] + d, q[2]]], [[q[0], q[1], q[2] - d], [q[0], q[1], q[2] + d]]); }
        else { const a = pts[t.k], b = pts[t.k + 1]; if (!a || !b) return; segs.push([a, b], [[a[0], a[1], a[2] + 0.02], [b[0], b[1], b[2] + 0.02]]); }
      } else if (t.ak === "room") {
        const R = P().room(Ar, t.id); if (!R) return;
        const Q = P().wallQuads(R);
        Q.forEach((q) => { [R.z, R.z + R.h].forEach((z) => loop(q.quad, z)); });
        R.pts.forEach((p) => segs.push([[p[0], p[1], R.z], [p[0], p[1], R.z + R.h]]));
      } else if (t.ak === "op") {
        const op = Ar.ops.find((x) => x.id === t.id), I = op && P().opInfo(Ar, op); if (!I) return;
        loop(I.rect, I.z0); loop(I.rect, I.z1); I.rect.forEach((p) => segs.push([[p[0], p[1], I.z0], [p[0], p[1], I.z1]]));
      } else {
        const box = new T.Box3();
        if (t.ak === "light") fix.children.forEach((g) => { if (g.userData.tag && g.userData.tag.id === t.id) box.expandByObject(g); });
        else A.meshes.forEach((m) => { const pos = m.geometry.attributes.position, t2 = m.userData.t2, v = new T.Vector3(); for (let i = 0; i < t2.length; i++) { const tg = A.tags[t2[i]]; if (tg.ak === t.ak && tg.id === t.id) for (let k = 0; k < 3; k++) box.expandByPoint(v.fromBufferAttribute(pos, i * 3 + k)); } });
        if (box.isEmpty()) return; box.expandByScalar(0.03);
        const a = box.min, b = box.max, c = [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]];
        loop(c, a.z); loop(c, b.z); c.forEach((p) => segs.push([[p[0], p[1], a.z], [p[0], p[1], b.z]]));
      }
      if (!segs.length) return;
      const pos = []; segs.forEach(([p, q]) => pos.push(p[0], p[1], p[2], q[0], q[1], q[2]));
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      const ls = new T.LineSegments(g, new T.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 })); ls.renderOrder = 12; out.add(ls);
    }
    function paintSel() { clear(selG); const th = V.theme || {}; outline(A.sel, new T.Color(th.accent || "#f59e2c").getHex(), selG); if (A.hover && JSON.stringify(A.hover) !== JSON.stringify(A.sel)) outline(A.hover, new T.Color(th.text || "#e8e2d6").getHex(), selG); V.draw(); }   // 2.624.0: the theme's accent / text
    function setSel(t) { A.sel = t ? Object.assign({}, t) : null; paintSel(); }
    function setHover(t) { const k = JSON.stringify(t || null); if (k === JSON.stringify(A.hover)) return; A.hover = t || null; paintSel(); }

    /* ---- out: the model's files */
    function exportMeshes() {
      const by = new Map(), v = new T.Vector3(), w = new T.Vector3(), x = new T.Vector3();
      const take = (o, col, alpha) => {
        const pos = o.geometry.index ? o.geometry.toNonIndexed().attributes.position : o.geometry.attributes.position; o.updateMatrixWorld(true);
        const k = col + "|" + alpha; if (!by.has(k)) by.set(k, { color: col, alpha, pos: [], nrm: [], idx: [] });
        const b = by.get(k);
        for (let i = 0; i + 2 < pos.count; i += 3) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); w.fromBufferAttribute(pos, i + 1).applyMatrix4(o.matrixWorld); x.fromBufferAttribute(pos, i + 2).applyMatrix4(o.matrixWorld);
          const n = new T.Vector3().subVectors(w, v).cross(new T.Vector3().subVectors(x, v)); if (n.lengthSq() < 1e-20) continue; n.normalize();
          const base = b.pos.length / 3; [v, w, x].forEach((p) => { b.pos.push(p.x, p.y, p.z); b.nrm.push(n.x, n.y, n.z); }); b.idx.push(base, base + 1, base + 2);
        }
      };
      A.meshes.forEach((m) => { if (m.visible) take(m, "#" + m.material.color.getHexString(), m.userData.alpha || 1); });
      fix.traverse((o) => { if (o.isMesh) take(o, "#" + o.material.color.getHexString(), 1); });
      return [...by.values()].filter((b) => b.idx.length);
    }
    function exportLights() {
      const B = A.built; if (!B) return [];
      return B.lights.filter((L) => L.on).map((L) => {
        const spotty = L.type === "downlight" || L.type === "spot", dz = { downlight: -0.02, ceiling: -0.12, pendant: -L.drop - 0.1, chandelier: -L.drop - 0.06, spot: -0.16, wall: 0.02, floorlamp: 1.5, tablelamp: 0.38 }[L.type] || 0;
        return { name: (P().LIGHTS[L.type] || {}).label || L.type, type: spotty ? "spot" : "point", color: L.col, cd: L.lm / (4 * Math.PI) * (spotty ? 2.2 : 1), p: [L.p[0], L.p[1], L.p[2] + dz], ang: L.ang };
      });
    }
    function box() { const Ar = V.M && V.M.arch; return Ar && P().has(Ar) ? P().bbox(Ar) : null; }
    Object.assign(A, { rebuild, pick, resolve, setSel, setHover, setNight, cut, exportMeshes, exportLights, box, layers, group: geo, fixtures: fix });
    return A;
  }
  root.PPArchView = { attach, loadPC, CD };
})(typeof window !== "undefined" ? window : globalThis);
