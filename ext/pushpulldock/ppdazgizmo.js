/* bitGen Studio — ext/pushpulldock/ppdazgizmo.js (3.8.0): MOVE, TURN AND POSE THE DAZ CHARACTERS (AND THEIR ASSETS) IN THE
 * SKETCHER'S 3D VIEW (window.H3DazGizmo).
 * Tim: "allow user to move and pose the daz characters and assets".
 *   A picked character (its blue box - ppdazscene.js) gets a yellow ring at its feet:
 *     drag the character itself  -> it walks over the floor (Shift: 10 cm steps)
 *     drag the yellow ring       -> it turns round where it stands (Shift: 15° steps)
 *   🕺 Pose with a bone picked (a click on the body, or the bone list): three rings round that bone -
 *     red / green / blue = the bone's own X / Y / Z turns (the sliders' axes, held inside the same limits; Shift: 5° steps).
 *     The sliders follow; 🪞 Mirror turns the other side too.
 *   ✥ on an asset in the DAZ Explorer (a prop, hair, clothing - "In the model"): drag it to slide it on the character
 *     (Shift + drag: up / down), its green ring (at its foot) turns it. It stays on the bones it was worn on, so it still poses with them.
 *   The view's own orbit / pan and the Sketcher's tools are left alone everywhere else (a drag that starts on nothing here).
 * Pure (Node: scripts/test-3800.js): wrap, screenAngle, nearPolyline, ringPts, clamp, snap, asset (piece moves made safe),
 *   glOf (the character's Z-up frame -> the model's Y-up one). */
(function (root) {
  "use strict";
  const R = Math.PI / 180;
  /** an angle step folded into -180..180 */
  const wrap = (d) => { let x = ((d + 180) % 360 + 360) % 360 - 180; if (x === -180 && d > 0) x = 180; return x; };
  /** the screen angle (degrees, counter-clockwise, y up) of p round c */
  const screenAngle = (c, p) => Math.atan2(c[1] - p[1], p[0] - c[0]) / R;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const snap = (v, step) => (step > 0 ? Math.round(v / step) * step : v);
  /** the distance (px) from p to a closed screen polyline */
  function nearPolyline(pts, p) {
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]; if (!a || !b) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L > 0 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L, 0, 1) : 0;
      best = Math.min(best, Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]));
    }
    return best;
  }
  /** n points of a circle (centre c, unit axis a, radius r) in 3D */
  function ringPts(c, a, r, n) {
    const L = Math.hypot(a[0], a[1], a[2]) || 1, ax = [a[0] / L, a[1] / L, a[2] / L];
    const t = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let u = [ax[1] * t[2] - ax[2] * t[1], ax[2] * t[0] - ax[0] * t[2], ax[0] * t[1] - ax[1] * t[0]]; const lu = Math.hypot(u[0], u[1], u[2]); u = u.map((x) => x / lu);
    const v = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]], out = [];
    for (let i = 0; i < (n || 48); i++) { const q = (i / (n || 48)) * Math.PI * 2, cs = Math.cos(q) * r, sn = Math.sin(q) * r; out.push([c[0] + u[0] * cs + v[0] * sn, c[1] + u[1] * cs + v[1] * sn, c[2] + u[2] * cs + v[2] * sn]); }
    return out;
  }
  /** an asset's kept move made safe: pos [x, y, z] metres in the character's own frame (Z up, +-3 m), rot degrees round Z */
  function asset(m) {
    const p = m && Array.isArray(m.pos) && m.pos.length === 3 && m.pos.every((x) => isFinite(+x)) ? m.pos.map((x) => clamp(+x, -3, 3)) : [0, 0, 0];
    const rot = m && isFinite(+m.rot) ? wrap(+m.rot) : 0;
    return { pos: p, rot };
  }
  /** a move in the character's Z-up frame -> the built model's Y-up (glTF) one: X stays, Y up = Z, Z = -Y */
  const glOf = (p) => [p[0], p[2], -p[1]];
  const pure = { wrap, screenAngle, clamp, snap, nearPolyline, ringPts, asset, glOf };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }

  const st = { V: null, g: null, rings: [], drag: null, hover: -1, hooked: false };
  const D = () => root.H3DazTools, S = () => root.H3DazScene;
  const COL = { x: 0xff5a5a, y: 0x58e070, z: 0x5aa8ff, turn: 0xffc83d, asset: 0x7dffb0 };

  /** what the gizmo is for now: null | {kind: "char" | "bone" | "asset", c, r, bone?, piece?} */
  function mode() {
    const d = D(), s = S(); if (!d || !s || !d.state || !d.state.on) return null;
    const c = d.cur(), r = c && s.rig(c.id); if (!r || s.sel() !== c.id || !r.outer.visible) return null;
    const t = d.state;
    if (t.tab === "pose" && t.bone && r.bones.get(t.bone) && r.daz.bones[t.bone]) return { kind: "bone", c, r, bone: t.bone };
    if (t.asset && t.asset.id === c.id && s.pieceNode(c.id, t.asset.name)) return { kind: "asset", c, r, piece: t.asset.name };
    return { kind: "char", c, r };
  }
  function group(v) {
    let g = v.scene.getObjectByName("pp-daz-gizmo");
    if (!g) { g = new v.T.Group(); g.name = "pp-daz-gizmo"; g.renderOrder = 999; v.scene.add(g); }
    return g;
  }
  function clear(g) { while (g.children.length) { const o = g.children.pop(); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); } }
  function line(v, pts, col, on) {
    const T = v.T, geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(pts.flat(), 3));
    const L = new T.LineLoop(geo, new T.LineBasicMaterial({ color: col, depthTest: false, depthWrite: false, transparent: true, opacity: on ? 1 : 0.85 }));
    L.renderOrder = 999; L.frustumCulled = false; return L;
  }
  /** the world-space turn axis of one of a bone's slider axes (+1° on it turns the bone round this, right-handed) */
  function boneAxis(r, id, ax) {
    const T = r.T, f = r.F, b = r.bones.get(id), db = r.daz.bones[id], p = Object.assign({ x: 0, y: 0, z: 0 }, r.pose[id] || {});
    const P = b.parent ? b.parent.getWorldQuaternion(new T.Quaternion()) : new T.Quaternion(), rest = r.rest.get(b) || new T.Quaternion();
    const w = (rot) => { const q = f.boneQuat(db, rot); return P.clone().multiply(rest).multiply(new T.Quaternion(q[0], q[1], q[2], q[3])); };
    const p1 = Object.assign({}, p); p1[ax] = (+p1[ax] || 0) + 1;
    const d = w(p1).multiply(w(p).invert()); if (d.w < 0) { d.x = -d.x; d.y = -d.y; d.z = -d.z; d.w = -d.w; }
    const L = Math.hypot(d.x, d.y, d.z); return L < 1e-9 ? null : [d.x / L, d.y / L, d.z / L];
  }
  function boneRadius(r, id) {
    const T = r.T, me = r.bones.get(id).getWorldPosition(new T.Vector3());
    let d = 0; for (const [cid, cb] of r.bones) if (r.daz.bones[cid] && r.daz.bones[cid].parent === id) d = Math.max(d, cb.getWorldPosition(new T.Vector3()).distanceTo(me));
    return clamp(d ? d * 0.45 : 0.07, 0.05, 0.22);
  }
  function charRing(r) {
    const B = new r.T.Box3().expandByObject(r.outer); const s = B.isEmpty() ? 0.6 : Math.max(B.max.x - B.min.x, B.max.y - B.min.y);
    return { c: [r.place.x, r.place.y, 0.01], r: clamp(s * 0.55 + 0.12, 0.35, 2) };
  }
  /** the rings of the moment: [{kind, ax?, pts, col, c, axis}] - drawn and hit-tested */
  function rings(m) {
    if (!m) return [];
    const r = m.r, T = r.T;
    if (m.kind === "bone") {
      const c = r.bones.get(m.bone).getWorldPosition(new T.Vector3()).toArray(), rad = boneRadius(r, m.bone);
      return (root.H3DazPose ? root.H3DazPose.axisRows(r.daz.bones[m.bone]) : []).map((row) => { const a = boneAxis(r, m.bone, row.ax); return a && { kind: "bone", ax: row.ax, row, c, axis: a, pts: ringPts(c, a, rad), col: COL[row.ax] || 0xffffff }; }).filter(Boolean);
    }
    if (m.kind === "asset") {
      const b = S().pieceBox(m.c.id, m.piece); if (!b) return [];
      const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2] + 0.005], rad = clamp(Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) * 0.6 + 0.05, 0.08, 1.5);
      return [{ kind: "asset", c, axis: [0, 0, 1], pts: ringPts(c, [0, 0, 1], rad), col: COL.asset }];
    }
    const cr = charRing(r);
    return [{ kind: "turn", c: cr.c, axis: [0, 0, 1], pts: ringPts(cr.c, [0, 0, 1], cr.r, 64), col: COL.turn }];
  }
  /** draw the rings again (the scene changed, a bone / asset was picked, the tab changed) */
  function refresh() {
    const v = st.V || (S() && S().V()); if (!v || !v.T) return;
    st.V = v; const g = group(v); clear(g);
    st.rings = rings(mode());
    st.rings.forEach((q, i) => g.add(line(v, q.pts, q.col, i === st.hover || (st.drag && st.drag.ring === i))));
  }
  /* ---------------- the pointer */
  function scr(v, p) {
    const rc = v.canvas.getBoundingClientRect(), q = new v.T.Vector3(p[0], p[1], p[2]).project(v.cam());
    return q.z > 1 ? null : [rc.left + (q.x + 1) / 2 * rc.width, rc.top + (1 - q.y) / 2 * rc.height];
  }
  function ringAt(v, e, tol) {
    let best = -1, bd = tol || 9;
    st.rings.forEach((q, i) => { const d = nearPolyline(q.pts.map((p) => scr(v, p)).filter(Boolean), [e.clientX, e.clientY]); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const toCam = (v, c) => { const cam = v.cam(); if (cam.isOrthographicCamera) { const d = new v.T.Vector3(); cam.getWorldDirection(d); return [-d.x, -d.y, -d.z]; } return [cam.position.x - c[0], cam.position.y - c[1], cam.position.z - c[2]]; };
  /** metres per screen pixel at a point (an asset's up / down) */
  function mpp(v, c) {
    const cam = v.cam(), h = v.canvas.getBoundingClientRect().height || 1;
    if (cam.isOrthographicCamera) return (cam.top - cam.bottom) / (cam.zoom || 1) / h;
    return 2 * cam.position.distanceTo(new v.T.Vector3(c[0], c[1], c[2])) * Math.tan(cam.fov * R / 2) / h;
  }
  /** where a ray from the pointer meets the level plane z = h */
  function onLevel(v, e, h) { const ry = v.ray(e); if (!ry || Math.abs(ry.d[2]) < 1e-9) return null; const t = (h - ry.o[2]) / ry.d[2]; return t > 0 ? [ry.o[0] + ry.d[0] * t, ry.o[1] + ry.d[1] * t] : null; }
  function stop(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  function down(e) {
    const v = st.V; if (!v || e.button !== 0 || e.altKey) return;
    const m = mode(); if (!m) return;
    st.rings = rings(m);
    // a ring wins when the pointer is right on it; near it (9 px), only if the press is not on the character / asset itself
    let i = ringAt(v, e, 4); if (i < 0) { i = ringAt(v, e, 9); if (i >= 0 && m.kind !== "bone") { const h = S().hitPiece(e, m.c.id); if (h && (m.kind === "char" || h.piece === m.piece)) i = -1; } }
    let d = null;
    if (i >= 0) {
      const q = st.rings[i], c2 = scr(v, q.c);
      if (q.kind === "bone") {
        if (!c2) return;
        const fc = toCam(v, q.c), sign = q.axis[0] * fc[0] + q.axis[1] * fc[1] + q.axis[2] * fc[2] >= 0 ? 1 : -1;
        d = { kind: "bone", ring: i, m, ax: q.ax, row: q.row, c2, last: screenAngle(c2, [e.clientX, e.clientY]), sum: 0, v0: +((m.r.pose[m.bone] || {})[q.ax]) || 0, sign };
      } else {
        const g = onLevel(v, e, q.c[2]); if (!g) return;
        d = q.kind === "turn" ? { kind: "turn", ring: i, m, c: q.c, last: Math.atan2(g[1] - q.c[1], g[0] - q.c[0]) / R, sum: 0, rot0: m.r.place.rot }
          : { kind: "assetTurn", ring: i, m, c: q.c, last: Math.atan2(g[1] - q.c[1], g[0] - q.c[0]) / R, sum: 0, mv0: asset(S().pieceMove(m.c.id, m.piece)) };
      }
    } else {
      const S0 = S(), hit = S0.hitPiece(e, m.c.id); if (!hit) return;
      if (m.kind === "asset" && hit.piece === m.piece) {
        d = { kind: "asset", m, h: hit.point[2], g0: onLevel(v, e, hit.point[2]), y0: e.clientY, k: mpp(v, hit.point), mv0: asset(S0.pieceMove(m.c.id, m.piece)) };
        if (!d.g0) return;
      } else if (m.kind !== "bone") {
        const g0 = S0.ground(e); if (!g0) return;
        d = { kind: "move", m, g0, p0: Object.assign({}, m.r.place) };
      } else return;                                          // 🕺 Pose: a click on the body picks a bone (ppdaztools.js)
    }
    st.drag = Object.assign(d, { x0: e.clientX, y0s: e.clientY, moved: false });
    stop(e);
    try { v.canvas.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
    if (v.controls) v.controls.enabled = false;
  }
  function move(e) {
    const v = st.V; if (!v) return;
    const d = st.drag;
    if (!d) {                                                   // hover: the ring under the pointer lights up
      if (!st.rings.length) return;
      const i = ringAt(v, e); if (i !== st.hover) { st.hover = i; refresh(); v.draw(); }
      v.canvas.style.cursor = i >= 0 ? "grab" : "";
      return;
    }
    stop(e);
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0s) < 3) return;
    d.moved = true; v.canvas.style.cursor = "grabbing";
    const s = S(), id = d.m.c.id;
    if (d.kind === "move") {
      const g = s.ground(e); if (!g) return;
      let x = d.p0.x + g[0] - d.g0[0], y = d.p0.y + g[1] - d.g0[1]; if (e.shiftKey) { x = snap(x, 0.1); y = snap(y, 0.1); }
      s.place(id, { x: +x.toFixed(3), y: +y.toFixed(3) });
    } else if (d.kind === "turn" || d.kind === "assetTurn") {
      const g = onLevel(v, e, d.c[2]); if (!g) return;
      const a = Math.atan2(g[1] - d.c[1], g[0] - d.c[0]) / R; d.sum += wrap(a - d.last); d.last = a;
      if (d.kind === "turn") { let r = d.rot0 + d.sum; if (e.shiftKey) r = snap(r, 15); s.place(id, { rot: +(((r % 360) + 360) % 360).toFixed(1) }); }
      else { let r = d.mv0.rot + d.sum; if (e.shiftKey) r = snap(r, 15); s.pieceMove(id, d.m.piece, { pos: d.mv0.pos, rot: wrap(r) }); }
    } else if (d.kind === "bone") {
      const a = screenAngle(d.c2, [e.clientX, e.clientY]); d.sum += wrap(a - d.last); d.last = a;
      let val = clamp(d.v0 + d.sign * d.sum, d.row.min, d.row.max); val = e.shiftKey ? snap(val, 5) : Math.round(val * 2) / 2;
      D().setAxis(d.m.bone, d.ax, val);
    } else if (d.kind === "asset") {
      const rot = -d.m.r.place.rot * R, cs = Math.cos(rot), sn = Math.sin(rot), p = d.mv0.pos.slice();
      if (e.shiftKey) p[2] = d.mv0.pos[2] - (e.clientY - d.y0) * d.k;
      else { const g = onLevel(v, e, d.h); if (!g) return; const dx = g[0] - d.g0[0], dy = g[1] - d.g0[1]; p[0] += dx * cs - dy * sn; p[1] += dx * sn + dy * cs; }
      s.pieceMove(id, d.m.piece, { pos: p.map((x) => +x.toFixed(4)), rot: d.mv0.rot });
    }
  }
  function up(e) {
    const v = st.V, d = st.drag; if (!d) return;
    st.drag = null; if (v && v.controls) v.controls.enabled = true;
    try { v.canvas.releasePointerCapture(e.pointerId); } catch (x) { /* fine */ }
    if (v) v.canvas.style.cursor = "";
    if (!d.moved) { refresh(); if (v) v.draw(); return; }           // a press without a drag: a click (the explorer picks)
    stop(e);
    const t = D(), id = d.m.c.id;
    if (d.kind === "move" || d.kind === "turn") t.placed(id);
    else if (d.kind === "bone") t.posed();
    else t.assetMoved(id, d.m.piece);
    refresh(); if (v) v.draw();
  }
  /** on the view's canvas, after the DAZ Explorer's own click listeners (ppdaztools.js hookView) */
  function hook(v) {
    if (!v || !v.canvas || v.canvas.dataset.dzGizmo) return;
    v.canvas.dataset.dzGizmo = "1"; st.V = v;
    v.canvas.addEventListener("pointerdown", down, true);
    v.canvas.addEventListener("pointermove", move, true);
    v.canvas.addEventListener("pointerup", up, true);
    v.canvas.addEventListener("pointercancel", up, true);
    refresh();
  }
  root.H3DazGizmo = Object.assign({ hook, refresh, mode, rings: () => st.rings, dragging: () => !!st.drag, boneAxis }, pure);
  // loaded after the explorer (ext.json): its view hook may have run already - then the canvas is hooked from here
  try { const v = S() && S().V(), cv = v && v.canvas; if (cv && cv.ownerDocument && cv.ownerDocument.getElementById("ppView") && cv.ownerDocument.getElementById("ppView").dataset.dzHooked) hook(v); } catch (e) { /* later, from hookView */ }
})(typeof window !== "undefined" ? window : globalThis);
