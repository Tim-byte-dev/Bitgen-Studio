/* bitGen Studio — ext/pushpulldock/ppplane.js (2.663.0): ✎ THE SKETCH PLANE + ⊥ LOOK AT - window.PPSketchPlane.
 *
 * Tim (verbatim): "when user clicks a face, make that the sketch plane, add a look at button like fusion 360 has"
 *
 *   A face clicked with ➤ Select (a wall's face, a floor, a roof, a face of the model) becomes the sketch plane (2.687.0:
 *   nothing drawn over it - no orange square / grid), the bar's chip names it (✕ / Esc / a click on nothing ends it), and ✏ Line / ▭ Rectangle / ◯ Circle /
 *   ⬠ Polygon draw in that plane - wherever the pointer goes - instead of on the ground or the face under the pointer.
 *   ⊥ Look at (the bar): the view turns straight at the sketch plane (Fusion's Look At), it in the middle.
 * Pure (Node: scripts/test-plane663.js): basis(n) - two directions in the plane; norm(n).
 */
(function (root) {
  "use strict";
  const norm = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  /** two directions across the plane (u level when it can be: a wall's plane = along the wall + up) */
  function basis(n0) { const n = norm(n0), up = Math.abs(n[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1], u = norm(cross(up, n)), v = cross(n, u); return { n, u, v }; }
  const api = { basis, norm };
  if (typeof module !== "undefined" && module.exports && !root.document) { module.exports = api; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id), H = () => root.H3PushPull;
  let plane = null, grp = null;
  const V = () => { const h = H(); return h && h.state && h.state.V; };
  function status(t) { const m = $("ppMsg"); if (m) m.textContent = t; }
  function draw() {
    const v = V(); if (!v || !v.T || !v.scene) return;
    if (!grp) { grp = new v.T.Group(); grp.name = "pp-plane-ui"; v.scene.add(grp); v.hideOnShot = (v.hideOnShot || []).concat([grp]); }
    while (grp.children.length) { const c = grp.children.pop(); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
    // 2.687.0 (Tim: "when clicking on a face keep the face as a plane but do not show the plane grid - there is too much on
    // the screen"): the sketch plane is no longer drawn (the orange square + its 13 x 13 grid are gone) - the clicked face
    // keeps its pick highlight and the bar's ✎ chip names the plane; the tools still draw in it. A KEPT plane
    // (📌 - PPCons construction planes) keeps its faint dashed outline.
    if (v.draw) v.draw();
  }
  function chip() {
    const bar = $("ppBar"); if (!bar) return;
    let c = $("ppPlaneChip");
    if (!c) {
      const look = doc.createElement("button"); look.className = "ghost gbtn"; look.id = "ppLookAt"; look.type = "button"; look.textContent = "⊥ Look at";
      look.title = "Look at: the view turns straight at the sketch plane (the face you clicked with Select)";
      look.onclick = () => lookAt();
      c = doc.createElement("span"); c.id = "ppPlaneChip"; c.className = "hint"; c.style.cssText = "display:none;align-items:center;gap:4px;padding:1px 6px;border:1px solid var(--tiger,#f59e2c);border-radius:10px;color:var(--tiger,#f59e2c);font-size:11px;white-space:nowrap";
      const plan = $("ppPlan"); if (plan && plan.parentNode === bar) { plan.after(look); look.after(c); } else { bar.appendChild(look); bar.appendChild(c); }
    }
    c.style.display = plane ? "inline-flex" : "none";
    c.innerHTML = plane ? "✎ " + String(plane.label).replace(/[&<>"]/g, "") + ' <button type="button" class="ghost" id="ppPlaneKeep" title="Keep this plane - it goes in the objects panel\'s Construction (click it there to draw in it again)" style="padding:0 3px;font-size:11px">📌</button><button type="button" class="ghost" id="ppPlaneOff" title="End the sketch plane (Esc)" style="padding:0 3px;font-size:11px">✕</button>' : "";
    const keep = $("ppPlaneKeep"); if (keep) keep.onclick = () => { if (root.PPCons) root.PPCons.keepPlane(); };   // 2.667.0
    const off = $("ppPlaneOff"); if (off) off.onclick = () => clear();
    const lk = $("ppLookAt"); if (lk) lk.classList.toggle("on", !!plane);
  }
  /** the sketch plane: n (its normal), p (a point in it), label (what it is) */
  function set(n, p, label, size) {
    if (!n || !p || !(Math.hypot(n[0], n[1], n[2]) > 0.5)) return;
    plane = { n: norm(n), p: [p[0], p[1], p[2]], label: label || "a face", size: size || 1.5 };
    draw(); chip(); if (root.PPCons) try { root.PPCons.paint(); } catch (e) { /* fine */ } if (root.PPOutline && root.PPOutline.paint) try { root.PPOutline.paint(); } catch (e) { /* fine */ }
    if (root.H3TestEvent) try { root.H3TestEvent("sketchplane", plane.label); } catch (e) { /* the 🧪 list */ }
  }
  function clear() { if (!plane) return; plane = null; draw(); chip(); if (root.PPCons) try { root.PPCons.paint(); } catch (e) { /* fine */ } if (root.PPOutline && root.PPOutline.paint) try { root.PPOutline.paint(); } catch (e) { /* fine */ } status("✎ the sketch plane ended - the tools draw on the ground / the face under the pointer again"); }
  function lookAt() {
    const v = V(); if (!v || !v.lookAlong) return;
    if (!plane) { status("⊥ Look at: click a face first (➤ Select) - it becomes the sketch plane, then ⊥ looks straight at it"); return; }
    if (H().leavePlan) try { H().leavePlan(); } catch (e) { /* fine */ }
    v.lookAlong(plane.n, plane.p, Math.max(2, (plane.size || 1.5) * 1.6));
    status("⊥ looking straight at " + plane.label + " - ✏ Line / ▭ Rectangle / ◯ Circle / ⬠ Polygon draw in it");
  }
  function boot() { const h = H(); if (!h || !h.state || !h.state.booted || !$("ppBar")) return false; chip(); return true; }
  if (!boot()) { let k = 0; const t = setInterval(() => { if (boot() || ++k > 240) clearInterval(t); }, 500); }
  Object.assign(api, { get: () => plane, set, clear, lookAt, draw });
  root.PPSketchPlane = api;
})(typeof window !== "undefined" ? window : globalThis);
