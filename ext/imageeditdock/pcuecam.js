/* pcuecam.js — THE UNREAL CAMERA in the image editor: move it in the scene + its properties (2.475.0), window.PCUECam.
 *
 * Tim (verbatim): "add the unreal camera to image editor allow user to move the camera in the scene to change camera
 * angles, roll, pitch and yaw. add a properties docker for the unreal camera, lens, f-stop, exposure, fov and camera
 * presets ... it would be good to be able to do it all in one app - bitgen studio."
 *
 *   The 🎥 UNREAL CAMERA TOOL (UNREAL ▸ Camera, or C with an Unreal / MetaHuman layer picked) - drag on the picture:
 *     Orbit       round what the camera looks at (the focus distance, else 5 m)         drag
 *     Look        turn the camera where it stands (yaw / pitch)                        Ctrl + drag
 *     Pan         slide it sideways / up and down                                      Shift + drag
 *     Roll        tilt the horizon                                                      Alt + drag
 *     Dolly       forward / back                                                        the wheel (or the Dolly mode)
 *     Zoom        the focal length                                                      Ctrl + wheel
 *     Focus       click what should be sharp (Unreal measures the distance)             the Focus mode
 *   While dragging, Unreal draws small previews (one at a time); letting go renders it at full size - one undo step.
 *   Thirds and the focus point are drawn over the layer.
 *   The 🎥 CAMERA TAB (Properties; Window ▸ Unreal Camera): PRESETS (lenses: 18 / 24 / 35 / 50 / 85 / 135 / 200 mm,
 *   macro, anamorphic look; your own saved ones), FILMBACK (full frame, Super 35, APS-C, Micro 4/3, IMAX, phone),
 *   FOCAL LENGTH <-> FIELD OF VIEW (linked), F-STOP + FOCUS DISTANCE (depth of field; 🎯 click to focus), EXPOSURE (EV),
 *   PLACE (X Y Z cm) and TURN (roll / pitch / yaw °), From / To Unreal's viewport, ⟳ Render.
 *   The layer keeps it: L.smart.ue.camera {loc, rot, fov} + L.smart.ue.lens {focal, sensor, fstop, focus, exposure}.
 * Pure (Node: scripts/test-uecam.js): lensOf(u), camOf(u), withLens(u, patch), MODES.
 */
(function (root) {
  "use strict";
  const MODES = [["orbit", "⟲", "Orbit (drag)"], ["look", "👁", "Look (Ctrl + drag)"], ["pan", "✥", "Pan (Shift + drag)"], ["dolly", "⇕", "Dolly (drag up / down, or the wheel)"], ["roll", "↻", "Roll (Alt + drag)"], ["focus", "🎯", "Focus (click what should be sharp)"]];
  const LENS0 = { focal: 35, sensor: 36, fstop: 2.8, focus: 0, exposure: 0 };
  const U = () => root.UEBridge;
  /** the layer's lens (defaults filled in; the focal length from its field of view when it has none) */
  function lensOf(u) {
    const l = Object.assign({}, LENS0, u.lens || {});
    const c = camOf(u);
    if (!(u.lens && u.lens.focal) && c && c.fov && U()) l.focal = Math.round(U().focalOf(c.fov, l.sensor) * 10) / 10;
    return l;
  }
  /** the layer's camera as {loc, rot, fov} - from what Unreal answered last when it was a named camera / the viewport */
  function camOf(u) {
    const c = u.camera || {};
    if (c.loc) return { loc: c.loc.slice(), rot: (c.rot || [0, 0, 0]).slice(), fov: c.fov || 60 };
    if (u.lastCamera && u.lastCamera.loc) return { loc: u.lastCamera.loc.slice(), rot: u.lastCamera.rot.slice(), fov: u.lastCamera.fov || 60 };
    if (u.kind === "metahuman" && U()) { const f = U().framing(u.preset || "bust", u.turn || 0); return { loc: f.camera.loc.slice(), rot: f.camera.rot.slice(), fov: u.fov || f.camera.fov }; }
    return null;
  }
  /** a copy of the layer's settings with a lens patch; the field of view follows the focal length / filmback */
  function withLens(u, patch) {
    const v = JSON.parse(JSON.stringify(u)), l = Object.assign(lensOf(u), patch || {});
    if (patch && patch.fov != null && U()) l.focal = Math.round(U().focalOf(patch.fov, l.sensor) * 10) / 10;
    delete l.fov; v.lens = l;
    const c = camOf(v); if (c) { c.fov = U() ? Math.round(U().fovOf(l.focal, l.sensor) * 100) / 100 : c.fov; v.camera = c; }
    return v;
  }
  const pure = { MODES, LENS0, lensOf, camOf, withLens };

  function install(E) {
    const { S, doc, say, kx, store } = E, SM = root.PCSmart;
    if (!E.stage || !E.unreal || !SM) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(label)}</option>`;
    const cur = () => { const L = S.w ? E.layer() : null; return L && E.unreal.isUE(L) ? L : null; };
    let mode = store.get("uecam.mode", "orbit"), drag = null, msg = "", focusPt = null;
    const setMsg = (m) => { msg = m || ""; const el = $("ucMsg"); if (el) el.textContent = msg; };

    /* ---- live previews while dragging: small, one at a time, put on the layer without an undo step */
    let inFlight = false, wanted = null;
    async function preview(L, u) {
      wanted = u; if (inFlight) return; inFlight = true;
      try {
        while (wanted) {
          const v = wanted; wanted = null;
          const k = Math.min(1, 480 / (v.w || 1280)), small = Object.assign({}, v, { w: Math.max(64, Math.round((v.w || 1280) * k)), h: Math.max(36, Math.round((v.h || 720) * k)) });
          const c = await E.unreal.take(small);
          if (!drag || drag.L !== L) break;
          const sm = L.smart; sm.src = SM.addSource(c, null); sm.w = c.width; sm.h = c.height; SM.render(L); E.refresh();
        }
      } catch (e) { setMsg("Unreal: " + e.message); }
      finally { inFlight = false; }
    }
    /** the drag is over: put the layer back as it was, then render the end camera at full size - one undo step */
    async function finish(L, u, label) {
      const d = drag; drag = null;
      if (d) { const sm = L.smart; sm.src = d.sm0.src; sm.w = d.sm0.w; sm.h = d.sm0.h; SM.render(L); }
      return E.unreal.rerender(L, u, label || "unreal camera");
    }
    function startDrag(L) { const sm = L.smart; return { L, sm0: { src: sm.src, w: sm.w, h: sm.h }, u0: JSON.parse(JSON.stringify(sm.ue)), cam0: camOf(sm.ue), x: 0, y: 0 }; }
    const distOf = (u) => { const l = lensOf(u); return l.focus > 0 ? l.focus : 500; };

    /* ---- the tool */
    E.tools.uecam = {
      id: "uecam", name: "Unreal Camera", cursor: "move",
      options: () => {
        const L = cur();
        return '<span class="tn">🎥 Unreal Camera</span><span class="sep"></span>'
          + MODES.map(([m, ic, t]) => `<button class="ghost kxsm${mode === m ? " on" : ""}" data-ucm="${m}" title="${esc(t)}">${ic} ${m[0].toUpperCase() + m.slice(1)}</button>`).join("")
          + '<span class="sep"></span><span style="color:var(--pc-dim)">' + (L ? "drag on the picture · Shift pan · Ctrl look · Alt roll · wheel dolly · Ctrl+wheel zoom" : "pick an Unreal / MetaHuman layer (UNREAL ▸ Unreal Layer)") + "</span>";
      },
      bindOptions: (o) => { o.querySelectorAll("[data-ucm]").forEach((b) => { b.onclick = () => { mode = b.dataset.ucm; store.set("uecam.mode", mode); E.renderOptions(); }; }); },
      down(e, x, y) {
        const L = cur(); if (!L) { say("pick an Unreal or MetaHuman layer first"); return false; }
        const cam = camOf(L.smart.ue); if (!cam) { say("render the layer once first (⟳) - then its camera can move"); return false; }
        if (mode === "focus" && !e.shiftKey && !e.ctrlKey && !e.altKey) { focusClick(L, x, y); return false; }
        drag = startDrag(L); drag.x = e.clientX; drag.y = e.clientY;
        drag.how = e.shiftKey ? "pan" : (e.ctrlKey || e.metaKey) ? "look" : e.altKey ? "roll" : mode === "focus" ? "orbit" : mode;
        return true;
      },
      move(e) {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y, u = JSON.parse(JSON.stringify(drag.u0));
        u.camera = U().moveCam(drag.cam0, drag.how, dx, dy, distOf(drag.u0));
        drag.u = u; drag.L.smart.ue = u; preview(drag.L, u); E.drawOverlay(); paintTab();
      },
      up() {
        if (!drag) return;
        const d = drag, u = d.u; d.L.smart.ue = d.u0;
        if (!u) { drag = null; return; }
        finish(d.L, u, "unreal camera " + d.how);
      },
      key(e) { if (e.key === "Escape" && drag) { const d = drag; drag = null; const sm = d.L.smart; sm.ue = d.u0; sm.src = d.sm0.src; sm.w = d.sm0.w; sm.h = d.sm0.h; SM.render(d.L); E.refresh(); return true; } return false; },
    };
    // the wheel: dolly / Ctrl = zoom (one step per stop, rendered when the wheel rests)
    let wheelT = 0, wheelU = null;
    E.stage.addEventListener("wheel", (e) => {
      if (S.tool !== "uecam") return; const L = cur(); if (!L) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const base = wheelU || L.smart.ue;
      if (e.ctrlKey || e.metaKey) { const l = lensOf(base); wheelU = withLens(base, { focal: Math.max(8, Math.min(600, Math.round(l.focal * (e.deltaY > 0 ? 0.92 : 1.08) * 10) / 10)) }); }
      else { const cam = camOf(base); if (!cam) return; wheelU = JSON.parse(JSON.stringify(base)); wheelU.camera = U().moveCam(cam, "dolly", 0, e.deltaY > 0 ? 25 : -25, distOf(base)); }
      paintTab(wheelU);
      root.clearTimeout(wheelT); wheelT = root.setTimeout(() => { const u = wheelU; wheelU = null; E.unreal.rerender(L, u, e.ctrlKey || e.metaKey ? "unreal zoom" : "unreal dolly"); }, 350);
    }, { capture: true, passive: false });
    async function focusClick(L, x, y) {
      const q = L.smart.t.quad, X = root.PCMesh;
      let u = 0.5, v = 0.5;
      try { const H = X.homography(q, X.UNIT); const p = X.applyH(H, x, y); u = p[0]; v = p[1]; }          // the picture's point -> 0..1 of the Unreal picture
      catch (er) { const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]); u = (x - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs)); v = (y - Math.min(...ys)) / (Math.max(...ys) - Math.min(...ys)); }
      if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return say("Focus: click on the Unreal picture");
      const cam = camOf(L.smart.ue); setMsg("Unreal measures the distance…");
      try {
        const r = await U().focusAt(cam, u, v, L.smart.w / L.smart.h);
        if (!r.hit) { setMsg("nothing there to focus on (the sky?)"); return; }
        focusPt = { L: L.id, u, v };
        await E.unreal.rerender(L, withLens(L.smart.ue, { focus: Math.round(r.focus) }), "unreal focus");
        setMsg(`focused at ${(r.focus / 100).toFixed(2)} m`);
      } catch (e) { setMsg("Unreal: " + e.message); }
    }
    /* ---- thirds + the focus point over the layer while the tool is out */
    E.overlayHooks.push((g, px) => {
      if (S.tool !== "uecam") return; const L = cur(); if (!L) return;
      const q = L.smart.t.quad, at = (a, b) => [q[0][0] + (q[1][0] - q[0][0]) * a + (q[3][0] - q[0][0]) * b, q[0][1] + (q[1][1] - q[0][1]) * a + (q[3][1] - q[0][1]) * b];
      g.save(); g.lineWidth = px; g.strokeStyle = "rgba(255,255,255,.55)"; g.setLineDash([4 * px, 4 * px]); g.beginPath();
      for (const k of [1 / 3, 2 / 3]) { let p = at(k, 0), r = at(k, 1); g.moveTo(...p); g.lineTo(...r); p = at(0, k); r = at(1, k); g.moveTo(...p); g.lineTo(...r); }
      g.stroke(); g.setLineDash([]);
      if (focusPt && focusPt.L === L.id) { const [fx, fy] = at(focusPt.u, focusPt.v); g.strokeStyle = "#3fb950"; g.lineWidth = 2 * px; g.strokeRect(fx - 9 * px, fy - 9 * px, 18 * px, 18 * px); }
      g.restore();
    });

    /* ---- the 🎥 Camera tab (Properties) */
    const ctl = kx.querySelector('.pcgrp .pctabs [data-tab="kxCtl"]');
    if (ctl) {
      const tabs = ctl.parentElement, holder = tabs.parentElement;
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "kuecam"; b.dataset.grp = "props"; b.textContent = "🎥 Camera";
      b.onclick = () => E.ui.showTab("kuecam");
      (tabs.querySelector('[data-tab="kue"]') || ctl).after(b);
      const body = doc.createElement("div"); body.className = "pcbody kxsec"; body.dataset.body = "kuecam"; body.id = "kuecamBody"; holder.appendChild(body);
      const css = doc.createElement("style");
      css.textContent = "#kuecamBody{padding:6px 8px;font-size:11px}#kuecamBody .r{display:flex;gap:4px;align-items:center;margin:3px 0;flex-wrap:wrap}#kuecamBody .r>span:first-child{min-width:64px;color:var(--pc-dim)}#kuecamBody h5{margin:8px 0 2px;font-size:11px}"
        + "#kuecamBody input[type=number]{width:62px}#kuecamBody input[type=range]{flex:1;min-width:70px}#kuecamBody select{max-width:190px}#ucMsg{color:var(--pc-dim);margin-top:6px;min-height:14px}";
      doc.head.appendChild(css);
      const prev = E.ui.showTab;
      E.ui.showTab = function (id) { const r = prev.apply(this, arguments); if (id === "kuecam") paintTab(); return r; };
    }
    const mine = () => store.get("uecam.presets", []);
    function paintTab(uShow) {
      const host = $("kuecamBody"); if (!host || !host.classList.contains("on")) return;
      const L = cur();
      if (!L) { host.innerHTML = `<div id="ucMsg">${esc(msg || "Pick an Unreal or MetaHuman layer - its camera and lens are here. UNREAL ▸ Camera moves it in the scene.")}</div>`; return; }
      const u = uShow || L.smart.ue, l = lensOf(u), c = camOf(u) || { loc: [0, 0, 0], rot: [0, 0, 0], fov: 60 }, Ub = U();
      const fov = Ub ? Math.round(Ub.fovOf(l.focal, l.sensor) * 100) / 100 : c.fov;
      const n = (id, v, step, w) => `<input type="number" id="${id}" value="${esc(Math.round(v * 100) / 100)}" step="${step || 1}"${w ? ` style="width:${w}px"` : ""}>`;
      host.innerHTML = `<div class="r"><b>${esc(L.name)}</b><span class="hint">${u.w} x ${u.h}</span></div>`
        + `<h5>Presets</h5><div class="r"><select id="ucPre">${opt("", "", "- a lens preset -")}${Ub.LENSES.map(([k, t]) => opt("b:" + k, "", t)).join("")}${mine().map((p, i) => opt("m:" + i, "", "★ " + p.name)).join("")}</select><button class="ghost" id="ucSave" title="Save this lens + exposure as your own preset">＋ Save</button></div>`
        + `<h5>Lens</h5><div class="r"><span>Focal length</span><input type="range" id="ucFr" min="8" max="300" step="1" value="${Math.min(300, l.focal)}">${n("ucF", l.focal, 0.5)}<span>mm</span></div>`
        + `<div class="r"><span>Field of view</span>${n("ucV", fov, 0.5)}<span>°</span></div>`
        + `<div class="r"><span>Filmback</span><select id="ucS">${Ub.FILMBACKS.map(([k, t, w]) => opt(w, l.sensor, t)).join("")}${Ub.FILMBACKS.some((x) => x[2] === l.sensor) ? "" : opt(l.sensor, l.sensor, l.sensor + " mm")}</select></div>`
        + `<h5>Depth of field</h5><div class="r"><span>F-stop</span><select id="ucA">${Ub.FSTOPS.map((f) => opt(f, l.fstop, "f/" + f)).join("")}${Ub.FSTOPS.includes(l.fstop) ? "" : opt(l.fstop, l.fstop, "f/" + l.fstop)}</select></div>`
        + `<div class="r"><span>Focus</span>${n("ucD", l.focus, 10)}<span>cm</span><button class="ghost" id="ucFocus" title="Click what should be sharp (the Focus mode of the camera tool)">🎯 Click to focus</button></div>`
        + `<div class="hint" style="padding:0 0 2px">Focus 0 = everything sharp (no depth of field)</div>`
        + `<h5>Exposure</h5><div class="r"><span>EV</span><input type="range" id="ucEr" min="-5" max="5" step="0.1" value="${l.exposure}">${n("ucE", l.exposure, 0.1)}</div>`
        + `<h5>Place (cm) · turn (°)</h5><div class="r"><span>X Y Z</span>${n("ucX", c.loc[0], 10)}${n("ucY", c.loc[1], 10)}${n("ucZ", c.loc[2], 10)}</div>`
        + `<div class="r"><span>Roll Pitch Yaw</span>${n("ucRo", c.rot[0], 1)}${n("ucPi", c.rot[1], 1)}${n("ucYa", c.rot[2], 1)}</div>`
        + '<div class="r"><button class="ghost" id="ucTool">🎥 Move it (camera tool)</button><button class="ghost" id="ucFrom" title="Unreal\'s level viewport camera now">⇩ From Unreal\'s viewport</button><button class="ghost" id="ucTo" title="Unreal\'s level viewport looks through this camera">⇧ To Unreal\'s viewport</button><button class="ghost" id="ucRe">⟳ Render</button></div>'
        + `<div id="ucMsg">${esc(msg)}</div>`;
      if (uShow) return;
      const q = (s) => host.querySelector(s), val = (s) => +q(s).value;
      let t = 0;
      const soon = (u2, label) => { root.clearTimeout(t); t = root.setTimeout(() => E.unreal.rerender(L, u2, label), 300); };
      const lens = (patch, label) => soon(withLens(L.smart.ue, patch), label);
      q("#ucFr").oninput = () => { q("#ucF").value = q("#ucFr").value; q("#ucV").value = Math.round(Ub.fovOf(val("#ucFr"), l.sensor) * 100) / 100; };
      q("#ucFr").onchange = () => lens({ focal: val("#ucFr") }, "unreal focal length");
      q("#ucF").onchange = () => lens({ focal: val("#ucF") }, "unreal focal length");
      q("#ucV").onchange = () => lens({ fov: val("#ucV") }, "unreal field of view");
      q("#ucS").onchange = () => lens({ sensor: val("#ucS") }, "unreal filmback");
      q("#ucA").onchange = () => lens({ fstop: val("#ucA") }, "unreal f-stop");
      q("#ucD").onchange = () => lens({ focus: Math.max(0, val("#ucD")) }, "unreal focus");
      q("#ucEr").oninput = () => { q("#ucE").value = q("#ucEr").value; };
      q("#ucEr").onchange = () => lens({ exposure: val("#ucEr") }, "unreal exposure");
      q("#ucE").onchange = () => lens({ exposure: val("#ucE") }, "unreal exposure");
      const place = () => { const u2 = JSON.parse(JSON.stringify(L.smart.ue)); u2.camera = { loc: [val("#ucX"), val("#ucY"), val("#ucZ")], rot: [val("#ucRo"), val("#ucPi"), val("#ucYa")], fov }; soon(u2, "unreal camera place"); };
      ["#ucX", "#ucY", "#ucZ", "#ucRo", "#ucPi", "#ucYa"].forEach((s) => { q(s).onchange = place; });
      q("#ucPre").onchange = () => {
        const v = q("#ucPre").value; if (!v) return;
        if (v[0] === "b") { const p = Ub.LENSES.find((x) => x[0] === v.slice(2)); lens(Object.assign({}, p[2]), "unreal lens preset"); setMsg(p[1]); }
        else { const p = mine()[+v.slice(2)]; if (p) lens(Object.assign({}, p.lens), "unreal lens preset"); }
      };
      q("#ucSave").onclick = () => {
        const nm = (root.prompt ? root.prompt("Name this preset", `${l.focal}mm f/${l.fstop}`) : "") || ""; if (!nm.trim()) return;
        const list = mine().filter((p) => p.name !== nm.trim()); list.push({ name: nm.trim().slice(0, 40), lens: { focal: l.focal, sensor: l.sensor, fstop: l.fstop, focus: l.focus, exposure: l.exposure } });
        store.set("uecam.presets", list); setMsg("preset saved: " + nm.trim()); paintTab();
      };
      q("#ucFocus").onclick = () => { mode = "focus"; store.set("uecam.mode", mode); E.setTool("uecam"); setMsg("click what should be sharp on the Unreal picture"); };
      q("#ucTool").onclick = () => E.setTool("uecam");
      q("#ucFrom").onclick = () => E.unreal.useViewport(L);
      q("#ucTo").onclick = () => { const c2 = camOf(L.smart.ue); if (!c2) return; U().setViewport(c2).then(() => setMsg("Unreal's viewport now looks through this camera")).catch((e) => setMsg("Unreal: " + e.message)); };
      q("#ucRe").onclick = () => E.unreal.rerender(L);
    }
    E.overlayHooks.push(() => { const host = $("kuecamBody"), L = cur(), k = L ? L.id + ":" + (L.ver || 0) : "-"; if (host && host.dataset.k !== k && !drag) { host.dataset.k = k; paintTab(); } });
    /* ---- commands + the UNREAL tab's buttons */
    const C = E.ui.addCmd, has = () => !!cur();
    if (C) {
      C("ue.camera", "Unreal Camera Tool", "", () => E.setTool("uecam"), { enabled: has }, ["Layer", "ue.rerender"]);
      C("win.uecam", "Unreal Camera", "", () => E.ui.showTab && E.ui.showTab("kuecam"), {}, ["Window", "win.cadbar"]);
    }
    E.ueCam = { mode: (m) => { if (m) { mode = m; store.set("uecam.mode", m); } return mode; }, paintTab, camOf, lensOf, withLens, focusClick, preview: () => inFlight, dragging: () => !!drag };
  }
  const PCUECam = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCUECam;
  else root.PCUECam = PCUECam;
})(typeof window !== "undefined" ? window : globalThis);
