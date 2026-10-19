/* bitGen Studio — POSES IN THE TIMELINE'S .blend PREVIEW + THE HAND-OVER TO THE IMAGE EDITOR (2.461.0), window.TlBlendPose.
 *
 * Tim (verbatim): "bridge daz3d to image editor and timeline - allow me to move the camera and adjust poses in daz3d through
 * the image editor or timeline docker. use the image in the daz layer to generate a new image / if we can't do it wit daz
 * directly we can send daz scene to blender".
 *
 * A Daz scene sent with bitGen Bridge ▸ Scene opens in the timeline's 🟧 .blend preview (blendview.js - the camera moves
 * there already: 🎥 scene camera / 🧭 free view). This adds to its Properties:
 *   Pose      the figure (armature) + a bone (type to find it), X / Y / Z turns in degrees on top of its own pose / motion;
 *             Reset bone / Reset pose. The preview turns the bone at once (three.js, Blender's XYZ order); Blender gets
 *             the pose in the edits ({pose: {armature: {bone: [x, y, z]}}}) and keys it on top of the motion when it
 *             saves / renders (scripts/blend_pose.py). Ctrl+Z undoes it like any edit.
 *   📡 View + pose → Daz   EXPERIMENTAL (lib/dazLive.js): Daz Studio running "bitGen Live Link" looks through a bitGen
 *             Camera placed like the free view and turns the same-named bones.
 *   🧊 To the image editor   the scene as a 3D LAYER of the image editor (pc3d.js) with this pose and this view (the free
 *             view's place, or the scene camera) - there ✨ Generate from it makes a new image of it.
 * Pure (Node: scripts/test-blendpose.js): setBone, blenderView (a three.js camera + target -> the 3D layer's orbit).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /** the pose with one bone's turn set (zero turns and empty figures dropped) */
  function setBone(pose, arm, bone, xyz) {
    var p = JSON.parse(JSON.stringify(pose || {})), v = (xyz || [0, 0, 0]).map(function (x) { return Math.round((+x || 0) * 100) / 100; });
    p[arm] = p[arm] || {};
    if (v.some(function (x) { return x !== 0; })) p[arm][bone] = v; else delete p[arm][bone];
    if (!Object.keys(p[arm]).length) delete p[arm];
    return p;
  }
  /** a three.js (glTF, Y up) camera place + its target + vertical fov -> the 3D layer's orbit (Blender, Z up; the fov
   *  across the LONGER side of a picture of `aspect`, as Blender's AUTO sensor fit) */
  function blenderView(pos, target, vfov, aspect) {
    var b = function (p) { return [p[0], -p[2], p[1]]; }, P = b(pos), Tg = b(target);
    var v = [P[0] - Tg[0], P[1] - Tg[1], P[2] - Tg[2]], d = Math.hypot(v[0], v[1], v[2]) || 1;
    var a = aspect || 16 / 9, fov = a >= 1 ? 2 * Math.atan(Math.tan((vfov * Math.PI) / 360) * a) * 180 / Math.PI : vfov;
    return { target: Tg, dist: d, yaw: Math.atan2(v[1], v[0]) * 180 / Math.PI, pitch: Math.asin(Math.max(-1, Math.min(1, v[2] / d))) * 180 / Math.PI, fov: fov };
  }
  var api = { setBone: setBone, blenderView: blenderView };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  var pick = { arm: "", bone: "" };
  var B = function () { return window.TlBlend; };
  var S = function () { return B() && B().state; };
  function arms() { var s = S(); return (s && s.meta && s.meta.armatures) || []; }
  function pose() { var s = S(); return (s && s.E && s.E.pose) || {}; }
  /* ---- the preview: three.js bones turned (on top of the animation the mixer just set, or of their rest) */
  var touched = [];
  function boneObj(arm, name) {
    var s = S(), n = s && s.nodes && s.nodes[arm]; if (!n) return null;
    var T = B().three(), want = T && T.PropertyBinding ? T.PropertyBinding.sanitizeNodeName(name) : name, hit = null;
    n.traverse(function (o) { if (!hit && o.isBone && (o.name === want || o.name === name)) hit = o; });
    return hit;
  }
  function apply() {
    var T = B() && B().three(); if (!T || !S() || !S().st) return;
    var p = pose(), seen = [];
    Object.keys(p).forEach(function (arm) {
      Object.keys(p[arm]).forEach(function (name) {
        var o = boneObj(arm, name); if (!o) return;
        var cur = o.quaternion.clone(), u = o.userData;
        var base = u.h3set && cur.equals(u.h3set) ? u.h3base : cur;      // the mixer did not touch it since: our base still stands
        var r = p[arm][name], d = new T.Quaternion().setFromEuler(new T.Euler(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180, "ZYX"));   // Blender's XYZ = three's ZYX
        u.h3base = base.clone(); o.quaternion.copy(base.clone().multiply(d)); u.h3set = o.quaternion.clone();
        seen.push(o);
      });
    });
    touched.forEach(function (o) { if (seen.indexOf(o) < 0 && o.userData.h3set) { if (o.quaternion.equals(o.userData.h3set)) o.quaternion.copy(o.userData.h3base); delete o.userData.h3set; delete o.userData.h3base; } });
    touched = seen;
  }
  function setPose(p, label) {
    var s = S(); if (!s || !s.st) return;
    if (JSON.stringify(p) === JSON.stringify(s.E.pose || {})) return;          // no change (a second change event)
    B().pushUndo(); s.E.pose = p; if (!Object.keys(p).length) delete s.E.pose;
    B().persist(); B().drawFrame(); B().msg(label || ""); setTimeout(function () { B().msg(""); }, 1200);
  }
  /* ---- the Pose section + 🧊 To the image editor, after the Properties are painted */
  function props(PR) {
    var s = S(); if (!s || !s.st) return;
    try { apply(); if (B().draw) B().draw(); } catch (e) { /* the preview follows the edits (an undo paints too) */ }
    var A = arms(), sec = document.createElement("div"); sec.className = "tlb-sec"; sec.id = "tlbPose";
    if (A.length) {
      if (!pick.arm || !A.some(function (a) { return a.name === pick.arm; })) pick = { arm: A[0].name, bone: "" };
      var arm = A.filter(function (a) { return a.name === pick.arm; })[0];
      if (!arm.bones.some(function (b) { return b.name === pick.bone; })) pick.bone = arm.bones[0] ? arm.bones[0].name : "";
      var r = (pose()[pick.arm] || {})[pick.bone] || [0, 0, 0];
      sec.innerHTML = '<b>Pose</b> <span class="tlb-st">(turns on top of its own pose / motion - Blender keys them when it saves / renders)</span>'
        + '<div class="tlp-g"><span>Figure</span><select id="tlbPArm">' + A.map(function (a) { return "<option" + (a.name === pick.arm ? " selected" : "") + ">" + esc(a.name) + "</option>"; }).join("") + "</select>"
        + '<span>Bone</span><select id="tlbPBone">' + arm.bones.map(function (b) { return "<option" + (b.name === pick.bone ? " selected" : "") + ">" + esc(b.name) + "</option>"; }).join("") + "</select></div>"
        + '<div class="tlp-row"><input type="text" id="tlbPQ" placeholder="find a bone…" style="flex:1"></div>'
        + '<div class="tlp-g">' + ["X", "Y", "Z"].map(function (k, i) { return "<span>" + k + " °</span><input type=\"number\" id=\"tlbP" + k + "\" min=\"-180\" max=\"180\" step=\"5\" value=\"" + r[i] + "\">"; }).join("") + "</div>"
        + '<div class="tlp-row"><button class="ghost" id="tlbPRB" type="button">Reset bone</button><button class="ghost" id="tlbPRP" type="button">Reset pose</button>'
        + '<span class="tlb-st">' + Object.keys(pose()).reduce(function (n, a) { return n + Object.keys(pose()[a]).length; }, 0) + " bone(s) turned</span></div>";
    } else sec.innerHTML = '<b>Pose</b> <span class="tlb-st">no figure (armature) in this scene</span>';
    sec.innerHTML += '<div class="tlp-row"><button class="ghost" id="tlbTo3d" type="button" title="Open this scene as a 3D layer of the image editor with this pose and this view - there ✨ Generate from it makes a new image of it">🧊 To the image editor</button>'
      + '<button class="ghost" id="tlbDaz" type="button" title="EXPERIMENTAL: Daz Studio (running Scripts ▸ bitGen ▸ bitGen Live Link) looks through a bitGen Camera placed like this view and turns the same-named bones">📡 View + pose → Daz</button></div>';
    var save = PR.querySelector("#tlbSave"), at = save ? save.closest(".tlb-sec") : null;
    if (at && at.parentNode) at.parentNode.insertBefore(sec, at); else PR.appendChild(sec);
    var on = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); };
    on("tlbPArm", "change", function () { pick = { arm: $("tlbPArm").value, bone: "" }; B().paint(); });
    on("tlbPBone", "change", function () { pick.bone = $("tlbPBone").value; B().paint(); });
    on("tlbPQ", "input", function () { var t = $("tlbPQ").value.toLowerCase(), o = Array.prototype.filter.call($("tlbPBone").options, function (x) { return x.value.toLowerCase().indexOf(t) >= 0; })[0]; if (o) { $("tlbPBone").value = o.value; pick.bone = o.value; var rr = (pose()[pick.arm] || {})[pick.bone] || [0, 0, 0]; ["X", "Y", "Z"].forEach(function (k, i) { $("tlbP" + k).value = rr[i]; }); } });
    ["X", "Y", "Z"].forEach(function (k, i) {
      on("tlbP" + k, "change", function () { var rr = ((pose()[pick.arm] || {})[pick.bone] || [0, 0, 0]).slice(); rr[i] = Math.max(-180, Math.min(180, +$("tlbP" + k).value || 0)); setPose(setBone(pose(), pick.arm, pick.bone, rr), pick.bone + " turned"); });
    });
    on("tlbPRB", "click", function () { setPose(setBone(pose(), pick.arm, pick.bone, [0, 0, 0]), pick.bone + " reset"); });
    on("tlbPRP", "click", function () { setPose({}, "pose reset"); });
    on("tlbTo3d", "click", function () { to3d(); });
    on("tlbDaz", "click", function () { toDaz(); });
    Array.prototype.forEach.call(sec.querySelectorAll("input"), function (x) { x.addEventListener("keydown", function (ev) { ev.stopPropagation(); }); });
  }
  /* ---- 🧊 To the image editor (a 3D layer with this pose + view) */
  function to3d() {
    var s = S(); if (!s || !s.st) return Promise.resolve(null);
    var ie = window.imageEditorInstance && window.imageEditorInstance.E;
    if (!ie || !ie.layer3d) { alert("The image editor is not loaded (its extension)."); return Promise.resolve(null); }
    var d = $("imageeditdock");
    try { if (d && d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("imageeditdock", "tIE"); if (d && d.classList.contains("collapsed") && typeof toggleCollapse === "function") toggleCollapse("imageeditdock"); } catch (e) { /* fine */ }
    var p = JSON.parse(JSON.stringify(pose())), free = s.view === "free";
    var cam = null;
    if (free && B().camFree() && B().orbit()) {
      var c = B().camFree(), o = B().orbit();
      cam = { pos: [c.position.x, c.position.y, c.position.z], target: [o.target.x, o.target.y, o.target.z], fov: c.fov };
    }
    B().msg("opening it in the image editor …");
    return ie.layer3d.openScene(s.st.source).then(function (L) {
      B().msg("");
      if (!L) return null;
      if (!Object.keys(p).length && !cam) return L;
      ie.layer3d.change(L, function (l) { l.pose = p; if (cam) l.cam = blenderView(cam.pos, cam.target, cam.fov, ie.S.w / Math.max(1, ie.S.h)); }, "3D: from the timeline", true);
      return L;
    }).catch(function (e) { B().msg(""); alert(String(e.message || e)); return null; });
  }
  /* ---- 📡 the EXPERIMENTAL Daz live link (lib/dazLive.js): the free view + the pose -> Daz (cm, Y up = glTF x 100) */
  function toDaz() {
    var s = S(); if (!s || !s.st) return Promise.resolve(null);
    var post = function (b) { return fetch("/api/daz/live/cmd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); };
    var jobs = [], p = pose(), arm = pick.arm || Object.keys(p)[0] || "";
    if (s.view === "free" && B().camFree() && B().orbit()) {
      var c = B().camFree(), o = B().orbit(), k = function (v) { return [v.x * 100, v.y * 100, v.z * 100]; }, aspect = (s.meta.width || 16) / (s.meta.height || 9);
      jobs.push(post({ type: "view", cam: { pos: k(c.position), target: k(o.target), fov: aspect >= 1 ? 2 * Math.atan(Math.tan(c.fov * Math.PI / 360) * aspect) * 180 / Math.PI : c.fov } }));
    }
    if (arm && p[arm]) jobs.push(post({ type: "pose", figure: arm, bones: p[arm] }));
    if (!jobs.length) { B().msg("nothing to send - turn a bone or use the 🧭 free view"); setTimeout(function () { B().msg(""); }, 2000); return Promise.resolve(null); }
    return Promise.all(jobs).then(function (rs) { var r = rs[rs.length - 1] || {}; B().msg(r.connected ? "sent to Daz" : "queued for Daz - run bitGen Live Link in Daz Studio"); setTimeout(function () { B().msg(""); }, 2500); return rs; });
  }
  window.TlBlendPose = { props: props, apply: apply, to3d: to3d, toDaz: toDaz, setBone: setBone, blenderView: blenderView, pick: function () { return pick; } };
})();
