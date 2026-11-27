/* bitGen Studio — ext/pushpulldock/ppdazscene.js (2.983.0): DAZ CHARACTERS IN THE SKETCHER'S OWN 3D SCENE (window.H3DazScene).
 * Tim: "move all of the daz features out of the dialog and into the main sketcher docker ... the character will be in the
 * sketcher scene when dragged from the library to the scene. when the character is selected, other daz assets can be used on
 * that character, like hair, clothes, genitals, shoes, poses etc". NOT A REPLACEMENT FOR DAZ STUDIO - light tasks.
 * Each built character (<name>_daz.glb) is a live rigged object in the Sketcher's three.js scene (H3PushPull.state.V.scene) -
 * not turned into the Sketcher's own faces (those are static and capped at 40 000 triangles): outer group = the place (x, y on
 * the Sketcher's floor, a turn round its Z), inner = glTF's Y-up turned to the Sketcher's Z-up. The pose engine is the 🕺 one
 * (static/dazformula.js boneQuat + H3DazPose.muscleWeights - the figure's own JCMs follow), the motion the 🎬 one
 * (static/dazmotion.js). The Sketcher draws on demand: every change calls V.draw().
 *   put(c) / remove(id) / select(id) / place(id, {x, y, rot}) / show(id, on) / pose(id, pose) / rig(id) / list()
 *   pickChar(ev) -> id | ""      pickBone(ev, id) -> bone id      ground(ev) -> [x, y] (the floor, z 0)
 *   motion.load(id, buf, name) / at(t) / play(on) / off() / bake()                         Pure: placeOf, groundHit */
(function (root) {
  "use strict";
  /** a kept place made safe: x / y metres on the floor, rot degrees round the Sketcher's Z */
  const placeOf = (p) => ({ x: isFinite(+(p && p.x)) ? +p.x : 0, y: isFinite(+(p && p.y)) ? +p.y : 0, rot: isFinite(+(p && p.rot)) ? ((+p.rot % 360) + 360) % 360 : 0 });
  /** a ray {o, d} onto the floor (z 0) -> [x, y] | null (looking up / along it) */
  const groundHit = (r) => { if (!r || !r.d || Math.abs(r.d[2]) < 1e-9) return null; const t = -r.o[2] / r.d[2]; return t > 0 ? [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t] : null; };
  /** 2.985.0: a piece of a built character from its glTF node name "<name> (<kind>)" -> {name, kind} | null */
  const pieceOf = (nodeName) => { const m = /^(.*) \((figure|eyes|mouth|graft|hair|clothing|other)\)$/.exec(String(nodeName || "")); return m ? { name: m[1], kind: m[2] } : null; };
  /** 2.985.0: the hips' move / the whole figure's turn + move of a pose made safe (metres, degrees) */
  const vec3 = (a) => (Array.isArray(a) && a.length === 3 && a.every((v) => isFinite(+v)) ? a.map(Number) : [0, 0, 0]);
  const figOf = (f) => ({ rot: { x: +(f && f.rot && f.rot.x) || 0, y: +(f && f.rot && f.rot.y) || 0, z: +(f && f.rot && f.rot.z) || 0 }, move: vec3(f && f.move) });
  const pure = { placeOf, groundHit, pieceOf, figOf, vec3 };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }

  const doc = root.document, rigs = new Map(), st = { sel: "", onChange: null, motion: null };
  const V = () => { const P = root.H3PushPull; return P && P.state && P.state.V ? P.state.V : null; };
  function script(src, name) {
    if (root[name]) return Promise.resolve(root[name]);
    return new Promise((ok, no) => { const sc = doc.createElement("script"); sc.src = src; sc.onload = () => (root[name] ? ok(root[name]) : no(new Error(src + " did not load"))); sc.onerror = () => no(new Error(src + " is missing")); doc.head.appendChild(sc); });
  }
  const F = () => script("/static/dazformula.js", "H3DazFormula");
  const changed = (why) => { const v = V(); if (v) v.draw(); if (st.onChange) try { st.onChange(why); } catch (e) { /* the panels */ } };
  function group() {
    const v = V(); if (!v) return null;
    let g = v.scene.getObjectByName("pp-daz");
    if (!g) { g = new v.T.Group(); g.name = "pp-daz"; v.scene.add(g); }
    // 2.985.0: Zoom extents and the ✨ Photo's depth map reach the characters
    if (!v.moreBoxes) v.moreBoxes = []; if (!v.moreBoxes.includes(box3)) v.moreBoxes.push(box3);
    return g;
  }
  function box3() {
    const v = V(); if (!v || !rigs.size) return null;
    const B = new v.T.Box3(); for (const r of rigs.values()) if (r.outer.visible) B.expandByObject(r.outer);
    return B.isEmpty() ? null : { min: [B.min.x, B.min.y, B.min.z], max: [B.max.x, B.max.y, B.max.z] };
  }
  function setPlace(r, p) { const q = placeOf(p); r.place = q; r.outer.position.set(q.x, q.y, 0); r.outer.rotation.set(0, 0, q.rot * Math.PI / 180); r.outer.updateMatrixWorld(true); }
  /** the character's .glb into the Sketcher (again, if it was there: its place and pose kept) */
  async function put(c) {
    const v = V(); if (!v) throw new Error("open the Sketcher first - its 3D view loads with it");
    if (!c || !c.last) throw new Error("🧍 Build the character first");
    const T = v.T, f = await F(), g = await new Promise((ok, no) => new T.GLTFLoader().load("/api/tlcanvas/model/" + encodeURIComponent(c.last), ok, undefined, (e) => no(new Error("that model did not load" + (e && e.message ? ": " + e.message : "")))));
    let daz = null; const meshes = [];
    g.scene.traverse((o) => { if (o.userData && o.userData.daz && !daz) daz = o.userData.daz; if (o.isSkinnedMesh || (o.isMesh && o.morphTargetInfluences)) { meshes.push(o); o.frustumCulled = false; } });
    if (!daz) throw new Error(c.last + " was not built by bitGen 2.979.0 or later - 🧍 Build it again");
    const old = rigs.get(c.id), outer = new T.Group(), inner = new T.Group(); inner.rotation.x = Math.PI / 2; outer.add(inner); inner.add(g.scene);
    outer.name = "pp-daz-" + c.id; outer.userData.dazId = c.id;
    const byName = new Map(); g.scene.traverse((o) => { if (o.isBone) byName.set((o.userData && o.userData.name) || o.name, o); });
    const bones = new Map(), rest = new Map(); for (const id of Object.keys(daz.bones)) { const b = byName.get(daz.bones[id].name) || byName.get(id); if (b) { bones.set(id, b); rest.set(b, b.quaternion.clone()); } }
    g.scene.updateMatrixWorld(true);
    const restPos = new Map(), restLocal = new Map(); for (const [id, b] of bones) { const q = b.getWorldPosition(new T.Vector3()); restPos.set(id, [q.x, q.y, q.z]); restLocal.set(id, [b.position.x, b.position.y, b.position.z]); }
    const r = { id: c.id, model: c.last, name: c.name, outer, inner, root: g.scene, daz, bones, rest, meshes, restPos, restLocal, pose: (old && old.pose) || c.pose || {}, weights: {}, muscles: c.muscles !== false, box: null, F: f, T,
      hips: vec3((old && old.hips) || c.hips), fig: figOf((old && old.fig) || c.figPose), hidden: new Set((old && old.hidden) || c.hidePieces || []) };
    if (old) { group().remove(old.outer); if (old.box) { group().remove(old.box); old.box.geometry.dispose(); } if (st.motion && st.motion.id === c.id) motionOff(true); }
    group().add(outer); rigs.set(c.id, r); setPlace(r, (old && old.place) || c.place);
    outer.visible = c.hidden ? false : true;
    pieceVis(r);
    apply(r); if (st.sel === c.id) select(c.id, true); else changed("put");
    return r;
  }
  function remove(id) { const r = rigs.get(id); if (!r) return; if (st.motion && st.motion.id === id) motionOff(); if (r.box) r.box.parent && r.box.parent.remove(r.box); r.outer.parent && r.outer.parent.remove(r.outer); rigs.delete(id); if (st.sel === id) st.sel = ""; changed("remove"); }
  function clear() { for (const id of [...rigs.keys()]) remove(id); }
  function select(id, quiet) {
    const v = V(); st.sel = rigs.has(id) ? id : "";
    for (const r of rigs.values()) { if (r.box) { r.box.parent && r.box.parent.remove(r.box); r.box.geometry.dispose(); r.box = null; } }
    const r = rigs.get(st.sel);
    if (r && v) { r.box = new v.T.BoxHelper(r.outer, 0x38e1ff); r.box.name = "pp-daz-sel"; group().add(r.box); }
    if (!quiet || r) changed("select");
  }
  function place(id, p) { const r = rigs.get(id); if (!r) return; setPlace(r, Object.assign({}, r.place, p)); if (r.box) r.box.update(); changed("place"); }
  function show(id, on) { const r = rigs.get(id); if (!r) return; r.outer.visible = !!on; if (r.box) r.box.visible = !!on; changed("show"); }
  /** the pose onto the bones + the muscle shapes' weights onto every piece */
  function apply(r) {
    const f = r.F, P = root.H3DazPose;
    // 2.985.0: the hips' move and the whole figure's turn / move (a lying or kneeling pose) - kept with the character
    const h = r.bones.get("hip") || r.bones.get("hips") || r.bones.get("pelvis"), hl = h && (r.restLocal.get("hip") || r.restLocal.get("hips") || r.restLocal.get("pelvis"));
    if (h && hl) h.position.set(hl[0] + r.hips[0], hl[1] + r.hips[1], hl[2] + r.hips[2]);
    const rb = Object.values(r.daz.bones || {}).find((b) => b && b.parent == null), fq = f.boneQuat({ order: (rb && rb.order) || "YZX", orient: [0, 0, 0] }, r.fig.rot);
    r.root.quaternion.set(fq[0], fq[1], fq[2], fq[3]); r.root.position.set(r.fig.move[0], r.fig.move[1], r.fig.move[2]); r.root.updateMatrixWorld(true);
    for (const [id, b] of r.bones) { const q = r.pose[id] ? f.boneQuat(r.daz.bones[id], r.pose[id]) : [0, 0, 0, 1]; b.quaternion.set(q[0], q[1], q[2], q[3]).premultiply(r.rest.get(b)); }
    r.weights = r.muscles && P && P.muscleWeights ? P.muscleWeights(r.daz, r.pose, f) : {};
    for (const m of r.meshes) { const d = m.morphTargetDictionary, inf = m.morphTargetInfluences; if (!d || !inf) continue; for (const id of Object.keys(r.daz.rest || {})) { const i = d["jcm:" + id]; if (i != null) inf[i] = r.weights[id] || 0; } }
    if (r.box) r.box.update();
  }
  function pose(id, p, o) { const r = rigs.get(id); if (!r) return null; if (p) r.pose = p; if (o && o.muscles != null) r.muscles = !!o.muscles; if (o && o.hips) r.hips = vec3(o.hips); if (o && o.fig) r.fig = figOf(o.fig); apply(r); changed("pose"); return r; }
  /** 2.985.0: the pieces a character was built of (figure, eyes, mouth, graft, hair, clothing) and which are shown */
  function pieces(id) {
    const r = rigs.get(id); if (!r) return [];
    const out = []; r.root.traverse((o) => { const p = pieceOf((o.userData && o.userData.name) || ""); if (p && !out.some((q) => q.name === p.name && q.kind === p.kind)) out.push(Object.assign(p, { shown: !r.hidden.has(p.name) })); });
    return out;
  }
  function pieceVis(r) { r.root.traverse((o) => { const p = pieceOf((o.userData && o.userData.name) || ""); if (p) o.visible = !r.hidden.has(p.name); }); }
  function pieceShow(id, name, on) { const r = rigs.get(id); if (!r) return; if (on) r.hidden.delete(name); else r.hidden.add(name); pieceVis(r); changed("piece"); }
  function ndc(ev, v) { const rc = v.canvas.getBoundingClientRect(); return new v.T.Vector2(((ev.clientX - rc.left) / rc.width) * 2 - 1, -((ev.clientY - rc.top) / rc.height) * 2 + 1); }
  function hit(ev, only) {
    const v = V(); if (!v || !rigs.size) return null;
    const rc = new v.T.Raycaster(); v.cam().updateMatrixWorld(); rc.setFromCamera(ndc(ev, v), v.cam());
    const ms = []; for (const r of rigs.values()) if (r.outer.visible && (!only || r.id === only)) ms.push(...r.meshes);
    const h = rc.intersectObjects(ms, false)[0]; if (!h) return null;
    let o = h.object; while (o && !(o.userData && o.userData.dazId)) o = o.parent;
    return o ? { id: o.userData.dazId, h } : null;
  }
  const pickChar = (ev) => { const x = hit(ev); return x ? x.id : ""; };
  /** the bone that moves the clicked spot most (the face's strongest joint) */
  function pickBone(ev, id) {
    const x = hit(ev, id); if (!x || !x.h.face || !x.h.object.isSkinnedMesh) return "";
    const o = x.h.object, si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight; if (!si || !sw) return "";
    let best = -1, bw = 0; for (const vi of [x.h.face.a, x.h.face.b, x.h.face.c]) for (let k = 0; k < 4; k++) { const w = sw.getComponent(vi, k); if (w > bw) { bw = w; best = si.getComponent(vi, k); } }
    const bone = best >= 0 && o.skeleton.bones[best], r = rigs.get(x.id); if (!bone || !r) return "";
    for (const [bid, b] of r.bones) if (b === bone) return bid;
    return "";
  }
  function ground(ev) { const v = V(); return v ? groundHit(v.ray(ev)) : null; }
  /* ---------------- 🎬 motion on a character (Mixamo FBX - static/dazmotion.js) */
  async function motionLoad(id, buf, name) {
    const r = rigs.get(id); if (!r) throw new Error("pick a character in the scene first");
    const MO = await script("/static/dazmotion.js", "H3DazMotion"), T = r.T; let g;
    try { g = new T.FBXLoader().parse(buf, ""); } catch (e) { throw new Error(name + " is not an FBX bitGen can read (" + e.message + ") - Mixamo's ⤓ Download, Format FBX"); }
    const clips = (g.animations || []).filter((c) => c.duration > 0); if (!clips.length) throw new Error(name + " has no animation in it (on Mixamo, pick an animation before ⤓ Download)");
    const srcB = []; g.traverse((o) => { if (o.isBone || /mixamorig/i.test(o.name)) srcB.push(o); });
    g.updateMatrixWorld(true);
    const src = {}, names = new Set(srcB.map((o) => o.name));
    for (const o of srcB) { const q = o.getWorldQuaternion(new T.Quaternion()), p = o.getWorldPosition(new T.Vector3()); src[o.name] = { parent: o.parent && names.has(o.parent.name) ? o.parent.name : null, q: [q.x, q.y, q.z, q.w], p: [p.x, p.y, p.z] }; }
    const daz = {}; for (const [bid] of r.bones) daz[bid] = { parent: (r.daz.bones[bid] || {}).parent || null, pos: r.restPos.get(bid) };
    const map = MO.mapBones(Object.keys(daz), Object.keys(src));
    if (Object.keys(map).length < 4) throw new Error("only " + Object.keys(map).length + " bone(s) of " + name + " match this figure - is it a Mixamo FBX (mixamorig bones)?");
    if (st.motion) motionOff(true);
    const S = MO.setup({ daz, src, map }), mixer = new T.AnimationMixer(g), action = mixer.clipAction(clips[0]); action.play();
    st.motion = { id, MO, g, srcB, S, mixer, clips, action, dur: clips[0].duration, t: 0, playing: false, inPlace: false, speed: 1, name: String(name || "motion").replace(/\.fbx$/i, ""), mapped: Object.keys(map).length, raf: 0, last: 0 };
    motionAt(0); return st.motion;
  }
  function motionAt(t) {
    const M = st.motion, r = M && rigs.get(M.id); if (!M || !r) return null;
    M.t = Math.max(0, Math.min(M.dur, t)); M.mixer.setTime(Math.min(M.t, M.dur - 1e-4)); M.g.updateMatrixWorld(true);   // exactly the end wraps to 0
    const src = {}, T = r.T; for (const o of M.srcB) { const q = o.getWorldQuaternion(new T.Quaternion()), p = o.getWorldPosition(new T.Vector3()); src[o.name] = { q: [q.x, q.y, q.z, q.w], p: [p.x, p.y, p.z] }; }
    const fr = M.MO.frame(M.S, src, { inPlace: M.inPlace });
    r.pose = M.MO.channels(r.daz.bones, fr.local); apply(r);
    const hb = r.bones.get(M.S.hip), hr = r.restLocal.get(M.S.hip); if (hb && hr) hb.position.set(hr[0] + fr.hips[0], hr[1] + fr.hips[1], hr[2] + fr.hips[2]);
    if (r.box) r.box.update();
    changed("motion"); return fr;
  }
  function motionPlay(on) {
    const M = st.motion; if (!M) return; M.playing = !!on; M.last = performance.now(); cancelAnimationFrame(M.raf);
    const tick = () => { if (!st.motion || st.motion !== M || !M.playing) return; const now = performance.now(), dt = (now - M.last) / 1000; M.last = now; let t = M.t + dt * M.speed; if (t > M.dur) t %= Math.max(1e-6, M.dur); motionAt(t); M.raf = requestAnimationFrame(tick); };
    if (on) M.raf = requestAnimationFrame(tick); else changed("motion");
  }
  function motionOff(quiet) {
    const M = st.motion; if (!M) return; cancelAnimationFrame(M.raf); st.motion = null;
    const r = rigs.get(M.id); if (r) { const hb = r.bones.get(M.S.hip), hr = r.restLocal.get(M.S.hip); if (hb && hr) hb.position.set(hr[0], hr[1], hr[2]); r.pose = {}; apply(r); }
    if (!quiet) changed("motion-off");
  }
  async function motionBake() {
    const M = st.motion, r = M && rigs.get(M.id); if (!M || !r) throw new Error("open a Mixamo .fbx first");
    motionPlay(false);
    const fps = 30, n = Math.max(2, Math.min(3600, Math.round(M.dur * fps) + 1)), times = [], rot = {}, tr = {}, weights = [];
    const body = r.meshes.find((m) => m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).some((k) => /^jcm:/.test(k))) || r.meshes.find((m) => m.morphTargetDictionary);
    const tn = body ? Object.entries(body.morphTargetDictionary).sort((a, b) => a[1] - b[1]).map((x) => x[0]) : [], hipName = (r.daz.bones[M.S.hip] || {}).name, hr = r.restLocal.get(M.S.hip);
    for (let f = 0; f < n; f++) {
      const t = Math.min(M.dur, f / fps), fr = motionAt(t); times.push(+t.toFixed(4));
      for (const [bid, b] of r.bones) { const q = b.quaternion, nm = r.daz.bones[bid].name; (rot[nm] = rot[nm] || []).push(q.x, q.y, q.z, q.w); }
      if (hipName && hr) (tr[hipName] = tr[hipName] || []).push(hr[0] + fr.hips[0], hr[1] + fr.hips[1], hr[2] + fr.hips[2]);
      for (const k of tn) weights.push(/^jcm:/.test(k) ? +(r.weights[k.slice(4)] || 0).toFixed(4) : 0);
    }
    for (const nm of Object.keys(rot)) { const a = rot[nm]; let still = true; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i + 3]) < 0.99999) { still = false; break; } if (still) delete rot[nm]; }
    const res = await fetch("/api/dazlib/motion/bake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: r.model, clip: M.name, times, rotations: rot, translations: tr, weights: weights.some((x) => x) ? weights : [] }) });
    const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || res.statusText);
    return j;
  }
  root.H3DazScene = Object.assign({ put, remove, clear, select, place, show, pose, apply, pickChar, pickBone, ground, pieces, pieceShow, box: box3,
    rig: (id) => rigs.get(id) || null, list: () => [...rigs.keys()], sel: () => st.sel, onChange: (fn) => { st.onChange = fn; }, V,
    motion: { load: motionLoad, at: motionAt, play: motionPlay, off: motionOff, bake: motionBake, state: () => st.motion } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
