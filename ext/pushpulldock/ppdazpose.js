/* bitGen Studio — ext/pushpulldock/ppdazpose.js (2.979.0): 🧍 POSE A DAZ CHARACTER + 💪 ITS MUSCLE REACTIONS (window.H3DazPose).
 * Tim: "continue with the daz in sketcher please. is there a way we can do live physics like deform [a character's] lips when
 * she puts makeup on or her body when she touches it, physical muscle reactions to animate?" - steps 1 + 2 of
 * claude/DAZ-SOFT-PHYSICS-PLAN.md. NOT A REPLACEMENT FOR DAZ STUDIO - light tasks; Daz Studio is a very powerful character
 * creator (its posing, its full rig, dForce).
 * A <name>_daz.glb (📚 Daz library) in a three.js view that keeps its skeleton (the Sketcher's own model is static faces):
 * pick a bone (the list or a click on the body), turn it (its own axes and limits from the figure), the other side mirrored if
 * asked; the figure's JCMs - its own muscle shapes, evaluated with static/dazformula.js from the formulas the build put in the
 * .glb (mesh extras.daz) - follow live as morph-target weights; a figure with none gets our own flex. Poses kept per model
 * (localStorage h3.dazpose.<model>) and ⤓ / 📂 as .json.
 * Pure (Node - test-979): axisRows(bone), boneTree(bones), poseInputs(daz, pose, F), muscleWeights(daz, pose, F), topActive(w, n). */
(function (root) {
  "use strict";
  const NOTE = "This is not a replacement for Daz Studio - it is made for light tasks. Daz Studio is a very powerful character creator: use it for real posing and animation.";
  /** the slider rows of a bone: its twist axis (the rotation order's first letter) marked, the figure's own limits */
  function axisRows(b) {
    const o = /^[XYZ]{3}$/i.test((b && b.order) || "") ? b.order.toLowerCase() : "xyz", lim = (b && b.lim) || {};
    return ["x", "y", "z"].map((ax) => ({ ax, twist: o[0] === ax, label: ax.toUpperCase() + (o[0] === ax ? " (twist)" : ""), min: (lim[ax] || [-180, 180])[0], max: (lim[ax] || [-180, 180])[1] }));
  }
  /** the bones in tree order with their depth (roots first, children under their parent) */
  function boneTree(bones) {
    const ids = Object.keys(bones || {}), kids = new Map(), out = [];
    ids.forEach((id) => { const p = bones[id].parent; const k = p && bones[p] ? p : ""; const L = kids.get(k) || []; L.push(id); kids.set(k, L); });
    const go = (k, d) => (kids.get(k) || []).forEach((id) => { out.push({ id, depth: d }); go(id, d + 1); });
    go("", 0);
    ids.forEach((id) => { if (!out.some((x) => x.id === id)) out.push({ id, depth: 0 }); });
    return out;
  }
  /** pose {boneId: {x, y, z}} -> the formulas' bone inputs {id: {x, y, z, bend}} */
  function poseInputs(daz, pose, F) {
    const out = {};
    for (const id of Object.keys(pose || {})) {
      const b = (daz.bones || {})[id], r = pose[id] || {}; if (!b) continue;
      out[id] = { x: +r.x || 0, y: +r.y || 0, z: +r.z || 0, bend: F.swing(F.boneQuat(b, r), F.twistAxis(b)) };
    }
    return out;
  }
  /** the muscle shapes' weights for a pose: each one's value minus the value it has at rest (that is already in the mesh) */
  function muscleWeights(daz, pose, F) {
    const v = F.evaluate(daz.model || { mods: {}, formulas: [] }, { bones: poseInputs(daz, pose, F) }), w = {};
    for (const id of Object.keys(daz.rest || {})) w[id] = (v[id] || 0) - (daz.rest[id] || 0);
    return w;
  }
  const topActive = (w, n) => Object.keys(w || {}).filter((k) => Math.abs(w[k]) > 0.005).sort((a, b) => Math.abs(w[b]) - Math.abs(w[a])).slice(0, n || 8).map((k) => ({ id: k, v: w[k] }));
  const pure = { NOTE, axisRows, boneTree, poseInputs, muscleWeights, topActive };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const st = { model: "", daz: null, pose: {}, sel: "", mirror: true, muscles: true, view: null, weights: {}, F: null };
  const say = (t) => { const m = $("pdpMsg"); if (m) m.textContent = t || ""; };
  function script(src, name) {
    if (root[name]) return Promise.resolve(root[name]);
    return new Promise((ok, no) => { const sc = doc.createElement("script"); sc.src = src; sc.onload = () => (root[name] ? ok(root[name]) : no(new Error(src + " did not load"))); sc.onerror = () => no(new Error(src + " is missing")); doc.head.appendChild(sc); });
  }
  const three = () => script("/static/vendor/three-m3d.min.js", "H3THREE");
  const formulas = () => script("/static/dazformula.js", "H3DazFormula");
  function css() {
    if ($("pdpCss")) return;
    const s = doc.createElement("style"); s.id = "pdpCss";
    s.textContent = "#pdpDlg{padding:0;border:1px solid var(--line,#3a352d);border-radius:8px;background:var(--panel,#1b1915);color:var(--fg,#e8e2d4);width:min(1180px,97vw);max-height:95vh}"
      + "#pdpDlg .pdp{display:flex;flex-direction:column;max-height:95vh;font-size:12px}.pdp-bar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line,#3a352d);cursor:move}.pdp-bar b{flex:1;font-size:13px}"
      + ".pdp-note{margin:6px 10px 0;padding:6px 8px;border-left:3px solid var(--tiger,#f59e2c);background:#2a2418;border-radius:3px}"
      + ".pdp-body{display:flex;gap:10px;padding:8px 10px;min-height:0}#pdpView{flex:1;min-width:0;height:min(68vh,640px);background:#0b0d11;border-radius:6px;display:block;cursor:crosshair}"
      + ".pdp-side{width:320px;flex:none;display:flex;flex-direction:column;gap:6px;overflow:auto;max-height:min(68vh,640px)}.pdp-side fieldset{border:1px solid var(--line,#3a352d);border-radius:6px;padding:5px 8px;margin:0;display:flex;flex-direction:column;gap:4px}.pdp-side legend{opacity:.75;font-size:11px}"
      + "#pdpBone{width:100%;font-family:inherit}.pdp-ax{display:flex;gap:6px;align-items:center}.pdp-ax span{width:62px}.pdp-ax input[type=range]{flex:1}.pdp-ax output{width:44px;text-align:right}"
      + ".pdp-act{display:flex;gap:6px;align-items:center;font-size:11px}.pdp-act span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pdp-act i{display:block;height:6px;background:#38e1ff;border-radius:3px}.pdp-act em{width:70px;background:#0006;border-radius:3px;font-style:normal}"
      + ".pdp-foot{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--line,#3a352d)}.pdp-foot .hint{flex:1}";
    doc.head.appendChild(s);
  }
  function ensure() {
    let d = $("pdpDlg"); if (d) return d;
    css();
    d = doc.createElement("dialog"); d.id = "pdpDlg"; d.setAttribute("aria-label", "Pose a Daz character");
    d.innerHTML = '<div class="pdp"><div class="pdp-bar" data-dlg-drag title="Drag to move"><b>🧍 Pose <span id="pdpName"></span></b><select id="pdpModel" title="A character built with 📚 Daz library"></select><button type="button" class="ghost" id="pdpX" title="Close (Esc)">✕</button></div>'
      + '<div class="pdp-note" role="note">' + esc(NOTE) + "</div>"
      + '<div class="pdp-body"><canvas id="pdpView" aria-label="The character - click a body part to pick its bone, drag to turn round, the wheel to zoom"></canvas><div class="pdp-side">'
      + '<fieldset><legend>Bone (or click the body)</legend><input type="search" id="pdpBoneQ" placeholder="Find a bone (e.g. forearm, thigh)…"><select id="pdpBone" size="9"></select></fieldset>'
      + '<fieldset><legend>Turn it</legend><div id="pdpAxes"></div><label><input type="checkbox" id="pdpMirror" checked> Mirror to the other side</label>'
      + '<div style="display:flex;gap:6px"><button type="button" class="ghost" id="pdpResetBone">↺ This bone</button><button type="button" class="ghost" id="pdpResetAll">↺ The whole pose</button></div></fieldset>'
      + '<fieldset><legend>💪 Muscle reactions</legend><label><input type="checkbox" id="pdpMuscle" checked> the figure\'s own (JCMs) follow the joints</label><div id="pdpKind" class="hint"></div><div id="pdpActive"></div></fieldset>'
      + '<fieldset><legend>The pose</legend><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="ghost" id="pdpKeep" title="Kept for this character on this computer - back when you open it again">💾 Keep</button><button type="button" class="ghost" id="pdpDown">⤓ .json</button><button type="button" class="ghost" id="pdpLoadB">📂 .json…</button><input type="file" id="pdpLoad" accept=".json,application/json" hidden></div></fieldset>'
      + '</div></div><div class="pdp-foot"><span class="hint" id="pdpMsg" role="status"></span></div></div>';
    doc.body.appendChild(d);
    $("pdpX").onclick = () => d.close();
    d.addEventListener("close", stopView);
    $("pdpModel").onchange = () => { const v = $("pdpModel").value; if (v && v !== st.model) load(v); };
    let bq = 0; $("pdpBoneQ").oninput = () => { clearTimeout(bq); bq = setTimeout(boneList, 200); };
    $("pdpBone").onchange = () => pick($("pdpBone").value);
    $("pdpMirror").onchange = () => { st.mirror = $("pdpMirror").checked; };
    $("pdpMuscle").onchange = () => { st.muscles = $("pdpMuscle").checked; apply(); };
    $("pdpResetBone").onclick = () => { if (!st.sel) return; delete st.pose[st.sel]; const o = mirrorOf(st.sel); if (st.mirror && o) delete st.pose[o]; axes(); apply(); };
    $("pdpResetAll").onclick = () => { st.pose = {}; axes(); apply(); };
    $("pdpKeep").onclick = keep; $("pdpDown").onclick = down; $("pdpLoadB").onclick = () => $("pdpLoad").click();
    $("pdpLoad").onchange = async () => { const f = $("pdpLoad").files[0]; $("pdpLoad").value = ""; if (!f) return; try { setPose(JSON.parse(await f.text())); say("📂 " + f.name); } catch (e) { say("⚠ " + e.message); } };
    return d;
  }
  async function models() {
    try {
      const r = await fetch("/api/tlcanvas/models"), j = await r.json(), L = (j.models || []).map((x) => x.name).filter((n) => /_daz(_\d+)?\.glb$/i.test(n));
      $("pdpModel").innerHTML = '<option value="">' + (L.length ? "another character…" : "no 📚 Daz characters built yet") + "</option>" + L.map((n) => "<option" + (n === st.model ? " selected" : "") + ">" + esc(n) + "</option>").join("");
    } catch (e) { /* the list is a help only */ }
  }
  const nameOf = (id) => ((st.daz && st.daz.bones[id]) || {}).name || id;
  function mirrorOf(id) {
    const F = st.F; if (!F || !st.daz) return ""; const m = F.mirrorName(id);
    return m && st.daz.bones[m] ? m : "";
  }
  function boneList() {
    const sel = $("pdpBone"), q = ($("pdpBoneQ").value || "").toLowerCase(); if (!st.daz) { sel.innerHTML = ""; return; }
    const T = boneTree(st.daz.bones).filter((x) => !q || (x.id + " " + (st.daz.bones[x.id].label || "")).toLowerCase().includes(q));
    sel.innerHTML = T.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === st.sel ? " selected" : "") + ">" + "  ".repeat(Math.min(12, q ? 0 : x.depth)) + esc(st.daz.bones[x.id].label || x.id) + (st.pose[x.id] ? " •" : "") + "</option>").join("");
  }
  function pick(id) { if (!st.daz || !st.daz.bones[id]) return; st.sel = id; axes(); boneList(); marker(); say("🦴 " + (st.daz.bones[id].label || id) + (mirrorOf(id) ? " (mirrored: " + mirrorOf(id) + ")" : "")); }
  function axes() {
    const box = $("pdpAxes"); if (!st.sel || !st.daz) { box.innerHTML = '<span class="hint">pick a bone</span>'; return; }
    const b = st.daz.bones[st.sel], r = st.pose[st.sel] || {};
    box.innerHTML = axisRows(b).map((a) => '<label class="pdp-ax" title="' + (a.twist ? "turns the bone round its own length" : "bends the joint") + '"><span>' + a.label + '</span><input type="range" data-ax="' + a.ax + '" min="' + a.min + '" max="' + a.max + '" step="0.5" value="' + (+r[a.ax] || 0) + '"><output>' + (+r[a.ax] || 0).toFixed(1) + "°</output></label>").join("");
    box.querySelectorAll("input[data-ax]").forEach((inp) => {
      inp.oninput = () => { setRot(st.sel, inp.dataset.ax, +inp.value); inp.nextElementSibling.textContent = (+inp.value).toFixed(1) + "°"; };
      inp.ondblclick = () => { inp.value = 0; inp.oninput(); };
    });
  }
  function setRot(id, ax, v) {
    const r = Object.assign({ x: 0, y: 0, z: 0 }, st.pose[id]); r[ax] = v; st.pose[id] = r;
    const o = st.mirror && mirrorOf(id); if (o) st.pose[o] = st.F.mirrorRot(r);
    apply();
  }
  function setPose(p) {
    const P = (p && p.pose) || p || {}; st.pose = {};
    for (const id of Object.keys(P)) if (st.daz && st.daz.bones[id]) st.pose[id] = { x: +P[id].x || 0, y: +P[id].y || 0, z: +P[id].z || 0 };
    axes(); boneList(); apply();
  }
  function keep() { try { root.localStorage.setItem("h3.dazpose." + st.model, JSON.stringify(st.pose)); say("💾 kept - back when you open " + st.model + " again"); } catch (e) { say("⚠ " + e.message); } }
  function down() {
    const a = doc.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: "bitgen-dazpose", v: 1, model: st.model, pose: st.pose }, null, 1)], { type: "application/json" }));
    a.download = st.model.replace(/\.glb$/i, "") + "_pose.json"; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }
  /** the pose onto the bones + the muscle shapes' weights onto every piece's morph targets */
  function apply() {
    const v = st.view; if (!v || !st.daz) return;
    const F = st.F;
    for (const [id, bone] of v.bones) {
      const q = st.pose[id] ? F.boneQuat(st.daz.bones[id], st.pose[id]) : [0, 0, 0, 1], r = v.rest.get(bone);
      bone.quaternion.set(q[0], q[1], q[2], q[3]); if (r) bone.quaternion.premultiply(r);
    }
    st.weights = st.muscles ? muscleWeights(st.daz, st.pose, F) : {};
    for (const m of v.meshes) {
      const d = m.morphTargetDictionary, inf = m.morphTargetInfluences; if (!d || !inf) continue;
      for (const id of Object.keys(st.daz.rest || {})) { const i = d["jcm:" + id]; if (i != null) inf[i] = st.weights[id] || 0; }
    }
    const top = topActive(st.weights, 8), act = $("pdpActive");
    if (act) act.innerHTML = top.length ? top.map((t) => '<div class="pdp-act"><span title="' + esc(t.id) + '">' + esc(t.id) + "</span><em><i style=\"width:" + Math.min(100, Math.abs(t.v) * 100).toFixed(0) + '%"></i></em></div>').join("") : '<span class="hint">' + (st.muscles ? "bend a joint - its muscle shapes show here" : "off") + "</span>";
    marker();
  }
  function marker() {
    const v = st.view; if (!v || !v.mark) return;
    const b = v.bones.get(st.sel); v.mark.visible = !!b;
    if (b) { b.updateWorldMatrix(true, false); b.getWorldPosition(v.mark.position); }
  }
  function stopView() { const v = st.view; if (!v) return; st.view = null; cancelAnimationFrame(v.raf); try { v.r.dispose(); } catch (e) { /* fine */ } }
  async function load(model) {
    stopView(); st.model = model; st.daz = null; st.pose = {}; st.sel = ""; $("pdpName").textContent = model; say("reading " + model + "…");
    try {
      const T = await three(); st.F = await formulas();
      const cv = $("pdpView"), r = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); if ("outputColorSpace" in r && T.SRGBColorSpace) r.outputColorSpace = T.SRGBColorSpace;
      const W = cv.clientWidth || 800, H = cv.clientHeight || 600; r.setSize(W, H, false); r.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      const sc = new T.Scene(), cam = new T.PerspectiveCamera(35, W / H, 0.01, 200);
      sc.add(new T.HemisphereLight(0xffffff, 0x334455, 1.3)); const sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); sc.add(sun);
      const g = await new Promise((ok, no) => new T.GLTFLoader().load("/api/tlcanvas/model/" + encodeURIComponent(model), ok, undefined, (e) => no(new Error("that model did not load" + (e && e.message ? ": " + e.message : "")))));
      sc.add(g.scene);
      const meshes = [], bones = new Map(), rest = new Map(); let daz = null;
      g.scene.traverse((o) => { if (o.userData && o.userData.daz && !daz) daz = o.userData.daz; if (o.isSkinnedMesh || (o.isMesh && o.morphTargetInfluences)) meshes.push(o); });
      if (!daz) throw new Error(model + " was not built by 📚 Daz library 2.979.0 or later - 🧍 Build it again to pose it");
      st.daz = daz;
      const byName = new Map(); g.scene.traverse((o) => { if (o.isBone) byName.set((o.userData && o.userData.name) || o.name, o); });
      for (const id of Object.keys(daz.bones)) { const b = byName.get(daz.bones[id].name) || byName.get(id); if (b) { bones.set(id, b); rest.set(b, b.quaternion.clone()); } }
      const box = new T.Box3().setFromObject(g.scene), c = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3()), h = Math.max(size.y, size.x, 0.3);
      cam.position.set(c.x, c.y + h * 0.05, c.z + h * 2.4); const ctl = new T.OrbitControls(cam, cv); ctl.target.copy(c); ctl.enableDamping = true; ctl.update();
      const mark = new T.Mesh(new T.SphereGeometry(h * 0.012, 12, 8), new T.MeshBasicMaterial({ color: 0x38e1ff, depthTest: false })); mark.renderOrder = 9; mark.visible = false; sc.add(mark);
      st.view = { r, sc, cam, ctl, raf: 0, meshes, bones, rest, mark, T };
      clickPick(cv, T);
      const loop = () => { if (!st.view) return; ctl.update(); r.render(sc, cam); st.view.raf = requestAnimationFrame(loop); };
      loop();
      let kept = null; try { kept = JSON.parse(root.localStorage.getItem("h3.dazpose." + model) || "null"); } catch (e) { kept = null; }
      const n = Object.keys(daz.rest || {}).length;
      $("pdpKind").textContent = daz.muscles === "jcm" ? "💪 " + n + " muscle shape(s) from the figure's own JCM formulas" : daz.muscles === "flex" ? "💪 the figure has no JCMs - our own flex on " + n + " limb(s) (a light bulge)" : "no muscle shapes in this build";
      boneList(); setPose(kept || {});
      const first = ["lForearmBend", "l_forearm", "lForeArm", "lForearm", "LeftForeArm"].find((x) => daz.bones[x]) || Object.keys(daz.bones)[1] || Object.keys(daz.bones)[0];
      if (first) pick(first);
      say("🧍 " + bones.size + " bones" + (kept ? " · 💾 your kept pose" : "") + " - click the body to pick a bone, drag to turn round");
      models();
    } catch (e) { stopView(); say("⚠ " + e.message); }
  }
  /** a click (not a drag) on the body picks the bone that moves that spot most */
  function clickPick(cv, T) {
    let down = null;
    cv.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
    cv.addEventListener("pointerup", (e) => {
      const v = st.view; if (!v || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
      const rc = cv.getBoundingClientRect(), ray = new T.Raycaster();
      ray.setFromCamera(new T.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1), v.cam);
      const hit = ray.intersectObjects(v.meshes, false)[0]; if (!hit || !hit.face || !hit.object.isSkinnedMesh) return;
      const o = hit.object, si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight; if (!si || !sw) return;
      let best = -1, bw = 0;
      for (const vi of [hit.face.a, hit.face.b, hit.face.c]) for (let k = 0; k < 4; k++) { const w = sw.getComponent(vi, k); if (w > bw) { bw = w; best = si.getComponent(vi, k); } }
      const bone = best >= 0 && o.skeleton.bones[best]; if (!bone) return;
      for (const [id, b] of v.bones) if (b === bone) { pick(id); return; }
    });
  }
  function open(model) { const d = ensure(); if (!d.open) d.showModal(); models(); if (model) load(model); else if (!st.model) say("pick a character built with 📚 Daz library"); }
  root.H3DazPose = Object.assign({ open, load, setRot, setPose, pick, apply, state: st, info: () => ({ model: st.model, sel: st.sel, bones: st.view ? st.view.bones.size : 0, muscles: st.daz && st.daz.muscles, weights: st.weights, pose: st.pose,
    influences: st.view ? st.view.meshes.map((m) => (m.morphTargetDictionary ? Object.fromEntries(Object.entries(m.morphTargetDictionary).map(([k, i]) => [k, m.morphTargetInfluences[i]])) : {})) : [] }) }, pure);
})(typeof window !== "undefined" ? window : globalThis);
