/* bitGen Studio — ext/pushpulldock/ppproject.js (3.6.0): 📽 PROJECT A PICTURE ONTO ANY SKETCHER MODEL (window.PPProject / require()).
 * Tim chose "Picture onto any model" - "Both" (characters already paint photos into their own UVs; this is the Sketcher's
 * half). The CURRENT VIEW is the projector: a picture is thrown from where the view stands, like a slide projector, onto the
 * drawn shapes, the building (walls, floors, ceilings, roofs, doors, stairs ...) and the ground that the view sees.
 *
 *   M.arch.proj = [{id, name, src, cam {kind persp | ortho, pos, quat, fov, aspect, half, near}, parts [keys], on, view}]
 *     saved, undone and sent with the model (pparch.js clean -> clean() here). parts = what the view saw when it was thrown
 *     (a grid of rays from the projector) or only what was picked; keys: f:<face> wall:<room | x> room:<id>[:floor | :ceil]
 *     <ak>:<id> terrain. A part gets the picture on its triangles that face the projector (drawn faces: either side) and lie
 *     inside its frustum - CLIPPED exactly at the frustum's sides (no stretched edge pixels) and subdivided until the
 *     per-vertex UVs follow the perspective (glTF has no projective texturing). A later projection wins where two overlap.
 *   In the view: one overlay mesh per projection over the model (ppview.js calls paint(V) after every rebuild) - the model's
 *     own meshes, picking and materials are untouched. Out: forGlb(list) splits the exported triangles the same way, so the
 *     .glb (→ Blender / Unreal / the timeline / the project's 3D models) carries the pictures as real textures (ppglb.js).
 *     ✨ Photo shoots the view (the projection is in it) and its materials board gets a tile per projection (ppreal.js).
 * Pure (Node: scripts/test-3600.js): toCam, uvOf, fitCam, facing, clipTri, splitTri, triKey, partKey, selKeys, clean, split,
 *   tiles, urlOf, okSrc.
 */
(function (root) {
  "use strict";
  const MAX = 24, NEAR = 0.05, TOL = 0.002, MAXL = 5, BUDGET = 250000;
  const fin = (x) => typeof x === "number" && Number.isFinite(x);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** v turned by the quaternion q = [x, y, z, w] (inv: by its conjugate) */
  function rot(q, v, inv) {
    const s = inv ? -1 : 1, x = q[0] * s, y = q[1] * s, z = q[2] * s, w = q[3];
    const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
    return [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])];
  }
  /** a world point in the projector's own space (three.js cameras: looking down -z, y up, x right) */
  const toCam = (cam, p) => rot(cam.quat, sub(p, cam.pos), true);
  function ext(cam) {
    if (cam.kind === "ortho") { const hy = cam.half, hx = cam.half * cam.aspect; return { hx, hy }; }
    const ty = Math.tan(cam.fov * Math.PI / 360); return { tx: ty * cam.aspect, ty };
  }
  /** the frustum's sides as functions of a camera-space point: >= 0 inside */
  function planes(cam) {
    const e = ext(cam);
    if (cam.kind === "ortho") return [(c) => e.hx - c[0], (c) => e.hx + c[0], (c) => e.hy - c[1], (c) => e.hy + c[1]];
    const n = cam.near || NEAR;
    return [(c) => -c[2] * e.tx - c[0], (c) => -c[2] * e.tx + c[0], (c) => -c[2] * e.ty - c[1], (c) => -c[2] * e.ty + c[1], (c) => -c[2] - n];
  }
  /** the picture's [u, v] at a world point (v up, as three.js reads a picture) - null behind a perspective projector */
  function uvOf(cam, p) {
    const c = toCam(cam, p), e = ext(cam);
    if (cam.kind === "ortho") return [(c[0] / e.hx + 1) / 2, (c[1] / e.hy + 1) / 2];
    const w = -c[2]; if (!(w > 1e-9)) return null;
    return [(c[0] / (w * e.tx) + 1) / 2, (c[1] / (w * e.ty) + 1) / 2];
  }
  const depth = (cam, p) => (cam.kind === "ortho" ? 1 : -toCam(cam, p)[2]);
  /** the view's lens fitted round a picture of aspect pa: the whole picture inside the view, never stretched */
  function fitCam(cam, pa) {
    const out = Object.assign({}, cam), av = cam.aspect;
    if (!(pa > 0)) return out;
    if (cam.kind === "ortho") { if (pa >= av) out.half = cam.half * av / pa; }
    else if (pa >= av) { const tx = Math.tan(cam.fov * Math.PI / 360) * av; out.fov = Math.atan(tx / pa) * 360 / Math.PI; }
    out.aspect = pa; return out;
  }
  /** does the triangle face the projector? (two: either side - a drawn face has no inside) */
  function facing(cam, t, two) {
    const n = cross(sub(t[1], t[0]), sub(t[2], t[0])), L = len(n); if (L < 1e-14) return false;
    let d;
    if (cam.kind === "ortho") d = rot(cam.quat, [0, 0, 1]);
    else { const c = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3, (t[0][2] + t[1][2] + t[2][2]) / 3]; d = sub(cam.pos, c); }
    const s = dot(n, d) / (L * (len(d) || 1));
    return two ? Math.abs(s) > 0.1 : s > 0.1;
  }
  const area = (t) => len(cross(sub(t[1], t[0]), sub(t[2], t[0]))) / 2;
  function fan(P) { const out = []; for (let i = 1; i + 1 < P.length; i++) { const t = [P[0], P[i], P[i + 1]]; if (area(t) > 1e-12) out.push(t); } return out; }
  /** a convex polygon cut by f (world point -> signed): {in, out} (Sutherland-Hodgman, both halves, order kept) */
  function cut(P, f) {
    const IN = [], OUT = [], g = P.map(f);
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], ga = g[i], gb = g[(i + 1) % P.length];
      (ga >= 0 ? IN : OUT).push(a);
      if ((ga >= 0) !== (gb >= 0)) { const m = lerp(a, b, ga / (ga - gb)); IN.push(m); OUT.push(m); }
    }
    return { in: IN.length >= 3 ? IN : [], out: OUT.length >= 3 ? OUT : [] };
  }
  /** a triangle clipped to the projector's frustum -> {inside: [tris], outside: [tris]} (areas add up to the triangle's) */
  function clipTri(cam, t) {
    let IN = t.slice(); const OUT = [];
    for (const pl of planes(cam)) {
      const r = cut(IN, (p) => pl(toCam(cam, p)));
      if (r.out.length) OUT.push(...fan(r.out));
      IN = r.in; if (!IN.length) break;
    }
    return { inside: IN.length ? fan(IN) : [], outside: OUT };
  }
  /** how far the straight (affine) UVs stray from the projector's (perspective) ones over a triangle */
  function err(cam, t, uv) {
    if (cam.kind === "ortho") return 0;
    const w = t.map((p) => depth(cam, p)); let e = 0;
    for (let i = 0; i < 3; i++) { const j = (i + 1) % 3, du = Math.hypot(uv[i][0] - uv[j][0], uv[i][1] - uv[j][1]); e = Math.max(e, du * Math.abs(w[i] - w[j]) / (w[i] + w[j] || 1)); }
    return e;
  }
  /** t (inside the frustum) -> pieces {p, uv} small enough that their UVs follow the perspective */
  function subdiv(cam, t, out, lvl, bud) {
    const uv = t.map((p) => uvOf(cam, p)); if (uv.some((x) => !x)) return;
    if ((lvl || 0) < MAXL && bud.n < BUDGET && err(cam, t, uv) > TOL) {
      const ab = lerp(t[0], t[1], 0.5), bc = lerp(t[1], t[2], 0.5), ca = lerp(t[2], t[0], 0.5);
      [[t[0], ab, ca], [ab, t[1], bc], [ca, bc, t[2]], [ab, bc, ca]].forEach((q) => subdiv(cam, q, out, (lvl || 0) + 1, bud));
      return;
    }
    bud.n++; out.push({ p: t, uv });
  }
  /** a triangle shared out among the projectors that cover it (the last wins where they overlap) ->
   *  {hit: [[{p, uv}] per projector], rest: [tris]} - what no projector takes keeps the model's own material */
  function splitTri(t, cams, bud) {
    bud = bud || { n: 0 };
    const hit = cams.map(() => []); let rest = [t];
    for (let k = cams.length - 1; k >= 0 && rest.length; k--) {
      const next = [];
      rest.forEach((q) => { const r = clipTri(cams[k], q); r.inside.forEach((x) => subdiv(cams[k], x, hit[k], 0, bud)); next.push(...r.outside); });
      rest = next;
    }
    return { hit, rest };
  }
  /** the same triangle in the view (float32 buffers) and in an export (numbers) -> the same key, whatever its winding */
  const triKey = (a, b, c) => [a, b, c].map((p) => Math.fround(p[0]) + "," + Math.fround(p[1]) + "," + Math.fround(p[2])).sort().join("|");
  /** a built part of the building (pparch.js tags) -> its key */
  function partKey(tag) {
    if (!tag || typeof tag !== "object") return null;
    if (tag.ak === "terrain") return "terrain";
    if (tag.ak === "wall") return +tag.room > 0 ? "wall:" + (+tag.room) + (tag.edge != null && Number.isInteger(+tag.edge) ? ":" + (+tag.edge) : "") : "wall:x";
    if (tag.ak === "room") return +tag.id > 0 ? "room:" + (+tag.id) + (tag.part === "floor" || tag.part === "ceil" ? ":" + tag.part : "") : null;
    return /^[a-z]{2,10}$/.test(String(tag.ak)) && +tag.id > 0 ? tag.ak + ":" + (+tag.id) : null;
  }
  /** a wall's triangle -> ITS wall "wall:<room>:<edge>" (the building tags only a room's walls together, the outside walls
   *  all as one) - found the way a click finds it (pparchview.js resolve): a step into the wall from the face, the nearest edge */
  function wallKey(PA, Ar, tag, c, n) {
    if (!tag || tag.ak !== "wall") return partKey(tag);
    if (+tag.room > 0 && tag.edge != null && Number.isInteger(+tag.edge)) return "wall:" + (+tag.room) + ":" + (+tag.edge);
    if (!PA || !Ar) return partKey(tag);
    const h = Math.hypot(n[0], n[1]) || 1, at = [c[0] - n[0] / h * 0.05, c[1] - n[1] / h * 0.05];
    try {
      if (+tag.room > 0) {
        const R = PA.room(Ar, +tag.room); if (!R) return partKey(tag);
        let best = null, bd = Infinity; PA.edgesOf(R).forEach((e) => { if (PA.isGone && PA.isGone(R, e.i)) return; const d = PA.segDist(at, e.a, e.b).d; if (d < bd) { bd = d; best = e.i; } });
        return best == null ? partKey(tag) : "wall:" + R.id + ":" + best;
      }
      const w = PA.nearestWall(Ar, at, 0.6, c[2]); return w ? "wall:" + w.room + ":" + w.edge : "wall:x";
    } catch (e) { return partKey(tag); }
  }
  /** does a projection's part list take this key? (a room's "wall:<room>" takes each of its walls) */
  const takes = (set, key) => set.has(key) || (/^wall:\d+:\d+$/.test(key) && set.has(key.slice(0, key.lastIndexOf(":"))));
  /** a PICKED part (pparchview.js resolve: a room's wall is {ak room, part wall}) -> the keys it means */
  function selKeys(t) {
    if (!t || typeof t !== "object") return [];
    if (t.ak === "terrain") return ["terrain"];
    if (t.ak === "room" && +t.id > 0) {
      const id = +t.id;
      if (t.part === "wall") return ["wall:" + id + (t.edge != null && Number.isInteger(+t.edge) ? ":" + (+t.edge) : "")];
      if (t.part === "floor" || t.part === "ceil") return ["room:" + id + ":" + t.part];
      return ["wall:" + id, "room:" + id + ":floor", "room:" + id + ":ceil", "room:" + id];
    }
    const k = partKey(t); return k ? [k] : [];
  }
  const KEY = /^(f:\d+|terrain|wall:(x|\d+(:\d+)?)|room:\d+(:(floor|ceil))?|[a-z]{2,10}:\d+)$/;
  /** a picture the model may keep: the project's images or the gallery (no "..") or a small data: picture */
  const okSrc = (s) => typeof s === "string" && ((/^\/(passets\/images|outputs)\/[^?#]{1,240}$/.test(s) && !/(^|\/)\.\.(\/|$)/.test(s)) || (/^data:image\/(png|jpeg|webp);base64,/.test(s) && s.length < 4e6));
  /** a src as an address the page can load (the file name encoded) */
  const urlOf = (s) => (/^(data|blob):/.test(String(s)) ? String(s) : String(s).replace(/^\/(passets\/images|outputs)\/(.*)$/, (m, d, n) => "/" + d + "/" + encodeURIComponent(n)));
  const num = (x, lo, hi) => fin(+x) && +x >= lo && +x <= hi;
  function cleanCam(c) {
    if (!c || typeof c !== "object") return null;
    const kind = c.kind === "ortho" ? "ortho" : "persp";
    const pos = Array.isArray(c.pos) && c.pos.length === 3 && c.pos.every((x) => fin(+x)) ? c.pos.map(Number) : null;
    const q = Array.isArray(c.quat) && c.quat.length === 4 && c.quat.every((x) => fin(+x)) ? c.quat.map(Number) : null;
    if (!pos || !q) return null;
    const L = Math.hypot(q[0], q[1], q[2], q[3]); if (!(L > 0.5)) return null;
    if (!num(c.aspect, 0.05, 20)) return null;
    const out = { kind, pos, quat: q.map((x) => x / L), aspect: +c.aspect, near: num(c.near, 0.001, 10) ? +c.near : NEAR };
    if (kind === "ortho") { if (!num(c.half, 1e-4, 1e5)) return null; out.half = +c.half; }
    else { if (!num(c.fov, 0.5, 170)) return null; out.fov = +c.fov; }
    return out;
  }
  function cleanView(v) {
    if (!v || !Array.isArray(v.p) || v.p.length !== 3 || !v.p.every((x) => fin(+x))) return null;
    const t = Array.isArray(v.t) && v.t.length === 3 && v.t.every((x) => fin(+x)) ? v.t.map(Number) : [0, 0, 0];
    return { p: v.p.map(Number), t, ortho: !!v.ortho, k: num(v.k, 1e-4, 1e6) ? +v.k : 10, zoom: num(v.zoom, 1e-4, 1e4) ? +v.zoom : 1 };
  }
  /** the model's projections, checked (pparch.js clean) */
  function clean(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).map((p) => {
      if (!p || typeof p !== "object") return null;
      const id = String(p.id || ""); if (!/^[a-z0-9_]{1,24}$/.test(id) || seen.has(id) || !okSrc(p.src)) return null;
      const cam = cleanCam(p.cam); if (!cam) return null;
      seen.add(id);
      const parts = [...new Set((Array.isArray(p.parts) ? p.parts : []).filter((k) => typeof k === "string" && KEY.test(k)))].slice(0, 5000);
      return { id, name: String(p.name || "Picture").slice(0, 80), src: p.src, cam, parts, on: p.on !== false, view: cleanView(p.view) };
    }).filter(Boolean).slice(-MAX);
  }
  const live = (A) => ((A && A.proj) || []).filter((p) => p && p.on !== false && p.cam && (p.parts || []).length);
  function freshId(list) { let n = 1; const ids = new Set((list || []).map((p) => p.id)); while (ids.has("p" + n)) n++; return "p" + n; }
  /** ✨ Photo's materials board (ppreal.js usedPictures): a tile per projection shown */
  const tiles = (A) => live(A).map((p) => ({ id: "proj_" + p.id, src: p.src, name: p.name, where: ["picture projected onto the model (" + p.name + ")"] }));
  /** an export's meshes [{color, pos, nrm, idx, alpha}] -> the same with every covered triangle split: the projected pieces in a
   *  textured mesh per projection {uv (glTF's: v down), src}, the rest kept as it was. cover: Map(triKey -> [projection indices]) */
  function split(list, cover, projs) {
    if (!cover || !cover.size || !(projs || []).length) return list;
    const tex = projs.map((p) => ({ color: "#ffffff", alpha: 1, pos: [], nrm: [], idx: [], uv: [], src: p.src, proj: p.id, name: "Projected " + p.name })), out = [], bud = { n: 0 };
    const put = (g, t, n, uv) => { const b = g.pos.length / 3; t.forEach((p, k) => { g.pos.push(p[0], p[1], p[2]); g.nrm.push(n[0], n[1], n[2]); if (uv) g.uv.push(uv[k][0], 1 - uv[k][1]); }); g.idx.push(b, b + 1, b + 2); };
    (list || []).forEach((g) => {
      if (g.uv || g.src || (g.alpha != null && g.alpha < 1)) { out.push(g); return; }     // glass and textured meshes stay whole
      const ng = Object.assign({}, g, { pos: [], nrm: [], idx: [] });
      for (let i = 0; i + 2 < g.idx.length; i += 3) {
        const P = [0, 1, 2].map((k) => { const q = g.idx[i + k] * 3; return [g.pos[q], g.pos[q + 1], g.pos[q + 2]]; });
        const q0 = g.idx[i] * 3, N = [g.nrm[q0], g.nrm[q0 + 1], g.nrm[q0 + 2]];
        const cov = cover.get(triKey(P[0], P[1], P[2])) || null;
        if (!cov) { put(ng, P, N); continue; }
        const r = splitTri(P, cov.map((j) => projs[j].cam), bud);
        r.rest.forEach((t) => put(ng, t, N));
        r.hit.forEach((arr, k) => arr.forEach((h) => put(tex[cov[k]], h.p, N, h.uv)));
      }
      if (ng.idx.length) out.push(ng);
    });
    return out.concat(tex.filter((t) => t.idx.length));
  }
  const pure = { MAX, KEY, rot, toCam, uvOf, fitCam, facing, clipTri, splitTri, triKey, partKey, wallKey, takes, selKeys, clean, cleanCam, okSrc, urlOf, split, tiles, live, freshId, area };
  if (!root || !root.document) { if (typeof module !== "undefined" && module.exports) module.exports = pure; if (root) root.PPProject = pure; return; }

  /* ---------------- in the page */
  const doc = root.document, PJ = { cover: new Map(), list: [], tex: new Map(), mats: new Map(), group: null, box: null };
  /** what to throw pictures on: [{obj, tris, keys, two}] - the drawn faces, the building (each wall its own), the ground */
  function targets(V) {
    const T = V.T, out = [], A = V.archView, Ar = V.M && V.M.arch;
    const add = (obj, two, keyOf) => { const tris = trisOf(T, obj); out.push({ obj, tris, two, keys: tris.map((t, i) => keyOf(i, t)) }); };
    (V.faceMeshes ? V.faceMeshes() : []).forEach((m) => { if (m.visible) add(m, true, (i) => "f:" + m.userData.tri2f[i]); });
    if (A) {
      (A.meshes || []).forEach((m) => {
        if (!m.visible || (m.userData.alpha || 1) < 1) return;
        add(m, false, (i, t) => { const tag = A.tags[m.userData.t2[i]]; if (!tag || tag.ak !== "wall") return partKey(tag); const n = cross(sub(t[1], t[0]), sub(t[2], t[0])); return wallKey(root.PPArch, Ar, tag, [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3, (t[0][2] + t[1][2] + t[2][2]) / 3], n); });
      });
      const TV = A.terrainView; if (TV && TV.mesh && TV.mesh.visible) add(TV.mesh, false, () => "terrain");
    }
    return out;
  }
  function trisOf(T, o) {
    const g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count / 3 : P.count / 3, v = new T.Vector3(); o.updateMatrixWorld(true);
    const at = (k) => { v.fromBufferAttribute(P, I ? I.getX(k) : k).applyMatrix4(o.matrixWorld); return [v.x, v.y, v.z]; };
    const out = []; for (let i = 0; i < n; i++) out.push([at(i * 3), at(i * 3 + 1), at(i * 3 + 2)]); return out;
  }
  function texOf(V, src) {
    const T = V.T; let e = PJ.tex.get(src);
    if (!e) { const t = new T.TextureLoader().load(urlOf(src), () => V.draw(), undefined, () => { if (V.diag) V.diag("📽 the picture " + src + " did not load"); }); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; e = { t }; PJ.tex.set(src, e); }
    return e.t;
  }
  function matOf(V, p) {
    const T = V.T, k = p.id + "|" + p.src; let m = PJ.mats.get(k);
    if (!m) { m = new T.MeshStandardMaterial({ map: texOf(V, p.src), color: 0xffffff, roughness: 0.85, metalness: 0, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); PJ.mats.set(k, m); }
    return m;
  }
  /** after every rebuild of the view (ppview.js): the projections as overlay meshes + the cover the export needs */
  function paint(V) {
    const T = V.T;
    if (!PJ.group) { PJ.group = new T.Group(); PJ.group.name = "pp-projections"; V.scene.add(PJ.group); }
    while (PJ.group.children.length) { const c = PJ.group.children.pop(); if (c.geometry) c.geometry.dispose(); }
    PJ.cover = new Map(); PJ.list = live(V.M && V.M.arch);
    const keep = new Set(PJ.list.map((p) => p.id + "|" + p.src)); PJ.mats.forEach((m, k) => { if (!keep.has(k)) { m.dispose(); PJ.mats.delete(k); } });
    const srcs = new Set(PJ.list.map((p) => p.src)); PJ.tex.forEach((e, s) => { if (!srcs.has(s)) { e.t.dispose(); PJ.tex.delete(s); } });
    if (!PJ.list.length) return;
    const parts = PJ.list.map((p) => new Set(p.parts)), buf = PJ.list.map(() => ({ pos: [], uv: [] })), bud = { n: 0 };
    targets(V).forEach((tg) => {
      tg.tris.forEach((t, i) => {
        const key = tg.keys[i]; if (!key) return;
        const cov = []; PJ.list.forEach((p, j) => { if (takes(parts[j], key) && facing(p.cam, t, tg.two)) cov.push(j); });
        if (!cov.length) return;
        PJ.cover.set(triKey(t[0], t[1], t[2]), cov);
        splitTri(t, cov.map((j) => PJ.list[j].cam), bud).hit.forEach((arr, k) => { const b = buf[cov[k]]; arr.forEach((h) => { h.p.forEach((q, n) => { b.pos.push(q[0], q[1], q[2]); b.uv.push(h.uv[n][0], h.uv[n][1]); }); }); });
      });
    });
    const shown = V.styleName !== "wire" && V.styleName !== "xray" && V.styleName !== "mono";
    buf.forEach((b, j) => {
      if (!b.pos.length) return;
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(b.pos, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(b.uv, 2)); g.computeVertexNormals();
      const m = new T.Mesh(g, matOf(V, PJ.list[j])); m.raycast = () => {}; m.receiveShadow = true; m.renderOrder = 1; m.visible = shown; m.userData.proj = PJ.list[j].id;
      PJ.group.add(m);
    });
  }
  /** the export (ppdock.js): split + the pictures' bytes for the .glb */
  async function forGlb(list) {
    const out = split(list, PJ.cover, PJ.list), cache = new Map();
    for (const g of out) {
      if (!g.src || g.img) continue;
      if (!cache.has(g.src)) cache.set(g.src, bytesOf(g.src).catch(() => null));
      const im = await cache.get(g.src);
      if (im) g.img = Object.assign({ key: g.src }, im); else { delete g.uv; g.color = "#999999"; }
    }
    return out;
  }
  /** a picture -> {mime png | jpeg, bytes} (glTF's own two; anything else drawn into a PNG) */
  async function bytesOf(src) {
    const r = await fetch(urlOf(src)); if (!r.ok) throw new Error(String(r.status));
    const b = await r.blob();
    if (/^image\/(png|jpeg)$/.test(b.type)) return { mime: b.type, bytes: new Uint8Array(await b.arrayBuffer()) };
    const bm = await createImageBitmap(b), c = doc.createElement("canvas"); c.width = bm.width; c.height = bm.height; c.getContext("2d").drawImage(bm, 0, 0);
    const pb = await new Promise((ok) => c.toBlob(ok, "image/png"));
    return { mime: "image/png", bytes: new Uint8Array(await pb.arrayBuffer()) };
  }
  /** the view's camera -> a projector fitted round a picture of aspect pa */
  function camOf(c, pa) {
    c.updateMatrixWorld();
    const base = c.isOrthographicCamera
      ? { kind: "ortho", half: (c.top - c.bottom) / 2 / (c.zoom || 1), aspect: (c.right - c.left) / (c.top - c.bottom) }
      : { kind: "persp", fov: c.fov, aspect: c.aspect, near: Math.max(0.01, Math.min(1, c.near || NEAR)) };
    return fitCam(Object.assign(base, { pos: c.position.toArray(), quat: c.quaternion.toArray() }), pa);
  }
  /** what the projector sees: a grid of rays through its picture, the first part each meets */
  function seen(V, cam, nx, ny) {
    const T = V.T, tg = targets(V), rc = new T.Raycaster(), seenK = new Set(), keysOf = new Map(tg.map((x) => [x.obj, x.keys]));
    const C = cam.kind === "ortho" ? new T.OrthographicCamera(-cam.half * cam.aspect, cam.half * cam.aspect, cam.half, -cam.half, -1000, 5000) : new T.PerspectiveCamera(cam.fov, cam.aspect, cam.near || NEAR, 5000);
    C.position.fromArray(cam.pos); C.quaternion.fromArray(cam.quat); C.updateMatrixWorld(); C.updateProjectionMatrix();
    nx = nx || 64; ny = ny || 40;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      rc.setFromCamera(new T.Vector2((i + 0.5) / nx * 2 - 1, (j + 0.5) / ny * 2 - 1), C);
      const hits = []; tg.forEach((x) => T.Mesh.prototype.raycast.call(x.obj, rc, hits));
      if (!hits.length) continue;
      hits.sort((a, b) => a.distance - b.distance);
      const k = keysOf.get(hits[0].object)[hits[0].faceIndex]; if (k) seenK.add(k);
    }
    return [...seenK];
  }
  /** what is picked now -> its keys */
  function pickedKeys(S) {
    const keys = new Set();
    ((S.sel && S.sel.f) || []).forEach((id) => keys.add("f:" + id));
    if (S.A) [S.A.sel].concat(S.A.more || []).forEach((t) => selKeys(t).forEach((k) => keys.add(k)));
    return [...keys];
  }
  const imgSize = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => no(new Error("the picture did not load")); im.src = urlOf(src); });
  /** 📽 throw the picked picture from the view: P = window.H3PushPull */
  async function project(P, pick, onlyPicked) {
    const S = P.state, V = S.V; if (!S.M || !V) throw new Error("open a model first");
    if (!pick) throw new Error("pick a picture first");
    const saved = pick.src ? { src: pick.src, name: pick.name } : await (async () => { const r = await root.H3PicPick.toProject(pick); return { name: r.name, src: (r.where === "output" ? "/outputs/" : "/passets/images/") + r.name }; })();
    if (!okSrc(saved.src)) throw new Error("that picture can't be kept with the model");
    const sz = await imgSize(saved.src);
    if (S.P && S.P.on && S.P.on() && P.leavePlan) P.leavePlan();
    const cam = camOf(V.cam(), sz.w / sz.h);
    const parts = onlyPicked ? pickedKeys(S) : seen(V, cam);
    if (!parts.length) throw new Error(onlyPicked ? "nothing is picked" : "the view sees nothing of the model to throw it on");
    const b0 = P.snapshot(), A = root.PPArch.of(S.M);
    A.proj = clean((A.proj || []).concat([{ id: freshId(A.proj), name: saved.name || "Picture", src: saved.src, cam, parts, on: true, view: V.state() }]));
    P.commit("project picture", b0);
    const n = PJ.group ? PJ.group.children.length : 0;
    return { parts: parts.length, shown: n, id: A.proj[A.proj.length - 1].id };
  }
  function edit(P, fn, label) { const S = P.state, b0 = P.snapshot(), A = root.PPArch.of(S.M); fn(A); A.proj = clean(A.proj); P.commit(label || "projection", b0); }
  /* the 📽 popup */
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function close() { if (PJ.box) { PJ.box.remove(); PJ.box = null; } }
  function pop(anchor, P) {
    if (PJ.box) { close(); return; }
    const S = P.state; if (!S.M) { P.msg("📽 open a model first"); return; }
    const box = doc.createElement("div"); box.className = "ppmp"; box.id = "ppProjPop";
    box.style.cssText = "position:fixed;z-index:2147483100;width:380px;padding:8px;background:var(--panel,#1c1915);border:1px solid var(--line,#3a342a);border-radius:8px;box-shadow:0 8px 24px #0008;font-size:12px";
    box.innerHTML = '<b>📽 Project a picture</b><button type="button" class="ghost" id="ppjX" style="float:right" title="Close">✕</button>'
      + '<div style="opacity:.8;margin:4px 0">The view is the projector: the picture is thrown from where you are looking, onto what this view sees - like a slide projector. Turn the view first, then ▶.</div>'
      + '<div id="ppjPick"></div>'
      + '<div style="margin:6px 0"><label><input type="radio" name="ppjOn" value="seen" checked> onto what this view sees</label> &nbsp;<label><input type="radio" name="ppjOn" value="picked" id="ppjPicked"> only what is picked</label></div>'
      + '<button type="button" id="ppjGo">▶ Project from this view</button> <span id="ppjSay"></span>'
      + '<div id="ppjList" style="margin-top:8px;max-height:180px;overflow:auto"></div>';
    doc.body.appendChild(box); PJ.box = box;
    const r = anchor.getBoundingClientRect(); box.style.left = Math.max(8, Math.min(innerWidth - 400, r.left)) + "px"; box.style.top = Math.min(innerHeight - 200, r.bottom + 4) + "px";
    const say = (t) => { box.querySelector("#ppjSay").textContent = t || ""; };
    let picker = null, pick = null;
    if (root.H3PicPick) picker = root.H3PicPick.mount(box.querySelector("#ppjPick"), { title: "The picture to project", onPick: (it) => { pick = it; say("🖼 " + it.name); } });
    else box.querySelector("#ppjPick").textContent = "the picture picker did not load (pppicpick.js)";
    void picker;
    box.querySelector("#ppjX").onclick = close;
    const list = () => {
      const L = (root.PPArch.of(S.M).proj || []), el = box.querySelector("#ppjList");
      el.innerHTML = L.length ? "<b>On this model</b>" : '<span style="opacity:.7">no pictures projected yet</span>';
      L.forEach((p) => {
        const row = doc.createElement("div"); row.className = "ppj-row"; row.dataset.id = p.id; row.style.cssText = "display:flex;gap:4px;align-items:center;margin-top:3px";
        row.innerHTML = '<input type="checkbox" title="Shown (and exported)"' + (p.on !== false ? " checked" : "") + '><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(p.name) + " - " + p.parts.length + ' part(s)">' + esc(p.name) + '</span><button type="button" class="ghost" data-a="view" title="Look from where it was thrown">👁</button><button type="button" class="ghost" data-a="del" title="Take it off the model">🗑</button>';
        row.querySelector("input").onchange = (e) => edit(P, (A) => { const x = (A.proj || []).find((q) => q.id === p.id); if (x) x.on = e.target.checked; }, "projection shown");
        row.querySelector('[data-a="view"]').onclick = () => { if (p.view && S.V) { if (P.leavePlan) P.leavePlan(); S.V.restore(p.view); } };
        row.querySelector('[data-a="del"]').onclick = () => { edit(P, (A) => { A.proj = (A.proj || []).filter((q) => q.id !== p.id); }, "projection removed"); list(); };
        el.appendChild(row);
      });
    };
    list();
    box.querySelector("#ppjGo").onclick = async () => {
      const only = box.querySelector("#ppjPicked").checked;
      say("📽 …");
      try { const r = await project(P, pick, only); say("📽 on " + r.parts + " part(s)"); P.msg("📽 " + (pick && pick.name) + " projected onto " + r.parts + " part(s) - ⤓ Export .glb carries it"); list(); }
      catch (e) { say("⚠ " + (e.message || e)); }
    };
  }
  root.PPProject = Object.assign({}, pure, { paint, forGlb, bytesOf, camOf, seen, pickedKeys, project, edit, pop, close, state: () => PJ });
  if (typeof module !== "undefined" && module.exports) module.exports = root.PPProject;
})(typeof window !== "undefined" ? window : globalThis);
