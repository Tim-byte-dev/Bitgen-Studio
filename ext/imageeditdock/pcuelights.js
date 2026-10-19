/* pcuelights.js — UNREAL LIGHTS, VOLUMETRIC LIGHTS AND FOG in the image editor (2.476.0), window.PCUELights.
 *
 * Tim (verbatim): "allow user to add unreal lights to the scene, volumetric lights, volumetric fog etc. in bitgen image
 * editor and timeline. it would be good to be able to do it all in one app - bitgen studio."
 *
 *   The 💡 LIGHTS TAB (Properties; Window ▸ Unreal Lights; UNREAL ▸ Lights & Fog) of an Unreal / MetaHuman layer
 *   (static/uerig.js draws it): presets (three-point, golden hour, night street, neon, softbox), ＋ Point / Spot / Rect /
 *   Sun / Sky, each light's colour or temperature, intensity, reach, soft size, cone, size, VOLUMETRIC scattering
 *   (light shafts), shadows, place + aim; the HEIGHT FOG with VOLUMETRIC fog (density, falloff, colour, start, albedo,
 *   extinction, view distance) and fog presets; "keep them in the Unreal level". Each change renders the layer again
 *   (one undo step); the lights + fog go with every still of the layer (L.smart.ue.rig).
 *   The 💡 LIGHT TOOL (UNREAL ▸ Lights): every light of the layer as a marker where it is in the picture (its colour;
 *   a spot / rect shows where it points); click one to pick it, DRAG it across the picture (it keeps its distance from
 *   the camera), Shift + drag = nearer / further, Alt + drag = turn its aim; letting go renders it - one undo step.
 * Pure (Node: scripts/test-uelights.js): markers(u, aspect) - where each light shows on the layer's picture.
 */
(function (root) {
  "use strict";
  const R = () => root.UERig, C = () => root.PCUECam;
  /** the layer's lights as markers on its picture: [{id, u, v, z, type, color, to: {u, v} | null}] (behind the camera = left out) */
  function markers(u, aspect) {
    const cam = C() && C().camOf(u); if (!cam || !u.rig || !R()) return [];
    const out = [];
    for (const l of u.rig.lights || []) {
      if (l.type === "sky") continue;
      const p = R().project(cam, aspect, l.loc); if (!(p.z > 0)) continue;
      let to = null;
      if (l.type === "spot" || l.type === "rect" || l.type === "directional") {
        const B = R().basis(l.rot), q = R().project(cam, aspect, [l.loc[0] + B.f[0] * 80, l.loc[1] + B.f[1] * 80, l.loc[2] + B.f[2] * 80]);
        if (q.z > 0) to = { u: q.u, v: q.v };
      }
      out.push({ id: l.id, u: p.u, v: p.v, z: p.z, type: l.type, color: l.color, on: l.on !== false, to });
    }
    return out;
  }
  const pure = { markers };

  function install(E) {
    const { S, doc, say, kx } = E, SM = root.PCSmart;
    if (!E.stage || !E.unreal || !SM || !R()) return;
    const $ = (id) => doc.getElementById(id);
    const cur = () => { const L = S.w ? E.layer() : null; return L && E.unreal.isUE(L) ? L : null; };
    let sel = null, drag = null, msg = "";
    const quadAt = (L, a, b) => { const q = L.smart.t.quad; return [q[0][0] + (q[1][0] - q[0][0]) * a + (q[3][0] - q[0][0]) * b, q[0][1] + (q[1][1] - q[0][1]) * a + (q[3][1] - q[0][1]) * b]; };
    const uvOf = (L, x, y) => { const X = root.PCMesh; try { const p = X.applyH(X.homography(L.smart.t.quad, X.UNIT), x, y); return { u: p[0], v: p[1] }; } catch (e) { return null; } };
    const aspectOf = (L) => L.smart.w / L.smart.h;
    function change(L, rig, label) {
      const u = JSON.parse(JSON.stringify(L.smart.ue)); u.rig = rig;
      return E.unreal.rerender(L, u, label || "unreal lights");
    }
    /* ---- the 💡 Lights tab */
    const ctl = kx.querySelector('.pcgrp .pctabs [data-tab="kxCtl"]');
    if (ctl) {
      const tabs = ctl.parentElement, holder = tabs.parentElement;
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "kuelights"; b.dataset.grp = "props"; b.textContent = "💡 Lights";
      b.onclick = () => E.ui.showTab("kuelights");
      (tabs.querySelector('[data-tab="kuecam"]') || tabs.querySelector('[data-tab="kue"]') || ctl).after(b);
      const body = doc.createElement("div"); body.className = "pcbody kxsec"; body.dataset.body = "kuelights"; body.id = "kuelightsBody"; body.style.padding = "6px 8px"; holder.appendChild(body);
      const prev = E.ui.showTab;
      E.ui.showTab = function (id) { const r = prev.apply(this, arguments); if (id === "kuelights") paintTab(); return r; };
    }
    let ed = null, t = 0;
    function paintTab() {
      const host = $("kuelightsBody"); if (!host || !host.classList.contains("on")) return;
      const L = cur();
      if (!L) { ed = null; host.innerHTML = `<div style="color:var(--pc-dim)">${msg || "Pick an Unreal or MetaHuman layer - its lights and fog are here (UNREAL ▸ Unreal Layer makes one)."}</div>`; return; }
      ed = R().editor(host, L.smart.ue.rig || { lights: [], fog: {} }, (rig, label) => {
        root.clearTimeout(t); t = root.setTimeout(() => change(L, rig, label), 300);
      }, { cam: () => C() && C().camOf(L.smart.ue), sel, onSel: (i) => { sel = i; E.drawOverlay(); },
        extra: '<div class="r"><button class="ghost" id="ulTool" title="Drag the lights on the picture">💡 Move them on the picture (light tool)</button></div>' });
      const tb = host.querySelector("#ulTool"); if (tb) tb.onclick = () => E.setTool("uelight");
    }
    E.overlayHooks.push(() => { const host = $("kuelightsBody"), L = cur(), k = L ? L.id + ":" + (L.ver || 0) : "-"; if (host && host.dataset.k !== k && !drag) { host.dataset.k = k; paintTab(); } });
    /* ---- the markers */
    const showMarkers = () => S.tool === "uelight" || ($("kuelightsBody") && $("kuelightsBody").classList.contains("on"));
    E.overlayHooks.push((g, px) => {
      const L = cur(); if (!L || !showMarkers() || !L.smart.ue.rig) return;
      const u = drag ? drag.u : L.smart.ue;
      for (const m of markers(u, aspectOf(L))) {
        const [x, y] = quadAt(L, m.u, m.v), r = 9 * px, T = R().TYPES[m.type];
        g.save();
        if (m.to) { const [tx, ty] = quadAt(L, m.to.u, m.to.v); g.strokeStyle = m.color; g.lineWidth = 2 * px; g.setLineDash([4 * px, 3 * px]); g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]); }
        g.globalAlpha = m.on ? 1 : 0.45;
        g.fillStyle = m.color; g.strokeStyle = m.id === sel ? "#ff8a00" : "rgba(0,0,0,.75)"; g.lineWidth = (m.id === sel ? 3 : 1.5) * px;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = "#000"; g.font = `${11 * px}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(T ? T.icon : "•", x, y + 0.5 * px);
        g.restore();
      }
    });
    function hitMarker(L, x, y) {
      const best = markers(L.smart.ue, aspectOf(L)).map((m) => { const [mx, my] = quadAt(L, m.u, m.v); return { m, d: Math.hypot(mx - x, my - y) }; }).sort((a, b) => a.d - b.d)[0];
      return best && best.d <= 14 / (S.zoom || 1) ? best.m : null;
    }
    /* ---- the 💡 light tool */
    E.tools.uelight = {
      id: "uelight", name: "Unreal Light", cursor: "pointer",
      options: () => '<span class="tn">💡 Unreal Light</span><span class="sep"></span><span style="color:var(--pc-dim)">' + (cur() ? "drag a light across the picture · Shift + drag = nearer / further · Alt + drag = its aim · the 💡 Lights tab adds lights, fog and volumetric fog" : "pick an Unreal / MetaHuman layer (UNREAL ▸ Unreal Layer)") + "</span>",
      down(e, x, y) {
        const L = cur(); if (!L) { say("pick an Unreal or MetaHuman layer first"); return false; }
        const m = hitMarker(L, x, y); if (!m) { if (E.ui.showTab) E.ui.showTab("kuelights"); say("no light there - add one in the 💡 Lights tab"); return false; }
        sel = m.id; if (ed) ed.select(sel);
        const u = JSON.parse(JSON.stringify(L.smart.ue));
        drag = { L, id: m.id, u, u0: JSON.parse(JSON.stringify(u)), cam: C().camOf(u), x: e.clientX, y: e.clientY, m, how: e.shiftKey ? "depth" : e.altKey ? "aim" : "move", moved: false };
        E.drawOverlay(); return true;
      },
      move(e, x, y) {
        if (!drag) return;
        const L = drag.L, l = drag.u.rig.lights.find((q) => q.id === drag.id), l0 = drag.u0.rig.lights.find((q) => q.id === drag.id); if (!l) return;
        if (drag.how === "move") { const p = uvOf(L, x, y); if (!p) return; l.loc = R().unproject(drag.cam, aspectOf(L), p.u, p.v, drag.m.z); }
        else if (drag.how === "depth") { const z = Math.max(20, drag.m.z * Math.pow(1.01, e.clientY - drag.y)); l.loc = R().unproject(drag.cam, aspectOf(L), drag.m.u, drag.m.v, z); }
        else { l.rot = [l0.rot[0], Math.max(-89, Math.min(89, l0.rot[1] - (e.clientY - drag.y) * 0.4)), l0.rot[2] + (e.clientX - drag.x) * 0.4].map((v) => Math.round(v * 10) / 10); }
        drag.moved = true; E.drawOverlay();
      },
      up() {
        if (!drag) return; const d = drag; drag = null;
        if (!d.moved) { E.drawOverlay(); if (E.ui.showTab) E.ui.showTab("kuelights"); return; }
        change(d.L, d.u.rig, d.how === "aim" ? "aim unreal light" : "move unreal light");
      },
      key(e) { if (e.key === "Escape" && drag) { drag = null; E.drawOverlay(); return true; }
        if ((e.key === "Delete" || e.key === "Backspace") && sel) { const L = cur(); if (!L || !L.smart.ue.rig) return false; const rig = JSON.parse(JSON.stringify(L.smart.ue.rig)); rig.lights = rig.lights.filter((q) => q.id !== sel); sel = null; change(L, rig, "delete unreal light"); return true; }
        return false; },
    };
    /* ---- commands */
    const Cm = E.ui.addCmd, has = () => !!cur();
    if (Cm) {
      Cm("ue.lights", "Unreal Light Tool", "", () => E.setTool("uelight"), { enabled: has }, ["Layer", "ue.camera"]);
      Cm("win.uelights", "Unreal Lights", "", () => E.ui.showTab && E.ui.showTab("kuelights"), {}, ["Window", "win.uecam"]);
    }
    E.ueLights = { markers: (L) => markers((L || cur()).smart.ue, aspectOf(L || cur())), select: (i) => { sel = i; if (ed) ed.select(i); E.drawOverlay(); }, selected: () => sel, change, paintTab, dragging: () => !!drag, editor: () => ed };
  }
  const PCUELights = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCUELights;
  else root.PCUELights = PCUELights;
})(typeof window !== "undefined" ? window : globalThis);
