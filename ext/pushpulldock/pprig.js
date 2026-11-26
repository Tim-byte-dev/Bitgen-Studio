/* bitGen Studio — ext/pushpulldock/pprig.js (2.976.0): 🦴 RIG IT in the Sketcher (window.H3Rig).
 * Tim: "are we able to make a 3d model of a person animal and car from a photo... like daz studio does it with facegen?" ->
 * "yes please". The Sketcher's 🦴 Rig ▾ lists the project's 3D models; a pick -> POST /api/rig (routes/rig.js) -> a UniRig job
 * (misc/rig_worker.py) -> <name>_rigged.glb in the project's models3d (⤒ Import, the timeline's 3D layers, Blender).
 * Not installed (409 needs "unirig") -> H3Addons.act("unirig", "install"): the add-on's own Install / Cancel box.
 *   rig(name, {skin}) -> Promise<{job, model} | null>; menu(anchor); pure: rigName(name), canRig(name) (Node: test-976). */
(function (root) {
  "use strict";
  const RX = /\.(glb|gltf|obj|fbx|dae|vrm)$/i;
  function canRig(name) { return RX.test(String(name || "")) && !/_rigged(_\d+)?\.glb$/i.test(String(name || "")); }
  function rigName(name) { return String(name || "").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60) + "_rigged.glb"; }
  const pure = { canRig, rigName };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }
  const doc = root.document;
  const P = () => root.H3PushPull;
  function say(t) { const p = P(); if (p && p.msg) p.msg(t); else if (typeof root.toast === "function") root.toast(t); }
  async function rig(name, o) {
    const x = o || {};
    say("🦴 checking the rigging add-on…");
    let r, j;
    try { r = await fetch("/api/rig", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, skin: x.skin !== false }) }); j = await r.json().catch(() => ({})); }
    catch (e) { say("⚠ " + e.message); return null; }
    if (r.status === 409 && j.needs) {
      const A = root.H3Addons;
      if (A && A.act) { try { if (A.refresh) await A.refresh(); } catch (e) { /* the list */ } A.act(j.needs, "install"); }
      say("🦴 Rig it needs its add-on (UniRig) - Settings ▸ Add-ons ▸ 🦴 Rig it; then 🦴 again");
      return null;
    }
    if (!r.ok) { say("⚠ " + (j.error || r.statusText)); return null; }
    say("🦴 rigging " + name + " - it is in the job list; " + j.model + " comes into the project's 3D models (⤒ Import)");
    return j;
  }
  function menu(anchor) {
    const p = P(); if (!p || !p.menu) return;
    fetch("/api/tlcanvas/models").then((r) => r.json()).then((j) => {
      const L = (j.models || []).filter((m) => canRig(m.name));
      p.menu(anchor || doc.getElementById("ppRig"), [{ head: L.length ? "🦴 Rig a 3D model (a skeleton + skin weights - UniRig)" : "No 3D models to rig in this project - 🧊 Convert to 3D or 🧱 Picture → 3D scene make them" }]
        .concat(L.map((m) => ({ label: m.name, title: "→ " + rigName(m.name), run: () => rig(m.name) }))));
    }).catch((e) => say("⚠ " + e.message));
  }
  root.H3Rig = Object.assign({ rig, menu }, pure);
})(typeof window !== "undefined" ? window : globalThis);
