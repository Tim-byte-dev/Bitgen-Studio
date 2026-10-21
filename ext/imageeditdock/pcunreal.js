/* pcunreal.js — UNREAL ENGINE 5.8 + METAHUMAN LAYERS in the image editor (2.472.0), window.PCUnreal.
 *
 * Tim (verbatim): "can we add an unreal engine 5.8 bridge, get ue5.8 scenes/projects ... unreal models/assets metahuman
 * and render in our image editor and timeline" - the bridge: static/unreal.js -> lib/unreal.js -> the bitGen Bridge
 * plugin in the Unreal Editor (ue/bitGenBridge).
 *
 *   The CAD toolbar's UNREAL tab (and Layer ▸ New Unreal Layer… / New MetaHuman Layer…):
 *     Unreal Layer      a level of the open Unreal project seen through one of its cameras (or the level viewport
 *                       as it is now) -> a picture layer (a smart object: move / scale / filters keep working)
 *     MetaHuman Layer   a MetaHuman of the project, in the pose of an animation at a time, framed Face / Bust / Full
 *                       body, turned - on a clear background (only the figure is drawn)
 *   The 🎮 Unreal tab (Properties) of such a layer: the camera's Turn / Tilt / Dolly / Field of view nudges (or the
 *   figure's turn, pose time, framing), "Use the viewport now", ⟳ Render again (one undo step), the status of the link.
 *   L.smart.ue = {kind: "scene" | "metahuman", level, camera, metahuman, preset, turn, w, h, alpha}.
 *   2.540.0 🖼 References (an Unreal Layer): 🔍 Find the objects (the mesh actors in view - bitGen Bridge 1.3.0), each
 *   gets a reference docker picture (by its name - SM_Car_01 = the car - or picked); ✨ Make it real sends the layer's
 *   picture + those pictures to an edit model (lib/realRefs.js) -> a new layer.
 * Pure (Node: scripts/test-unreal.js): stillRequest(u) - the layer's settings -> the request for /api/unreal/still.
 */
(function (root) {
  "use strict";
  /** a layer's settings -> /api/unreal/still's body */
  function stillRequest(u, framing) {
    const o = { w: u.w || 1280, h: u.h || 720, alpha: !!u.alpha };
    if (u.level) o.level = u.level;
    if (u.lens) o.lens = Object.assign({}, u.lens);
    if (u.rig) o.rig = u.rig;                                                             // 2.476.0: lights + fog (pcuelights.js)                                       // 2.475.0: the lens (pcuecam.js)
    if (u.kind === "metahuman") {
      const f = framing(u.preset || "bust", u.turn || 0);
      o.camera = u.camera && u.camera.loc ? { loc: u.camera.loc, rot: u.camera.rot, fov: u.camera.fov || f.camera.fov }   // 2.475.0: moved with the camera tool
        : { loc: f.camera.loc, rot: f.camera.rot, fov: u.fov || f.camera.fov };
      o.metahuman = { bp: u.metahuman.bp, time: +u.metahuman.time || 0, loc: f.figure.loc, rot: f.figure.rot };
      if (u.metahuman.anim) o.metahuman.anim = u.metahuman.anim;
      o.onlyMetahuman = true; o.alpha = u.alpha !== false;
    } else {
      const c = u.camera || { viewport: true };
      o.camera = c.name ? { name: c.name, yaw: +c.yaw || 0, pitch: +c.pitch || 0, dolly: +c.dolly || 0, fov: c.fov ? +c.fov : undefined } : c.loc ? { loc: c.loc, rot: c.rot, fov: +c.fov || 60 } : { viewport: true, fov: +c.fov || 90 };
    }
    return o;
  }

  function install(E) {
    const { S, doc, say, kx } = E, SM = root.PCSmart, X = root.PCMesh, U = () => root.UEBridge;
    if (!SM || !X || !E.stage) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(label)}</option>`;
    const isUE = (L) => !!(L && L.type === "smart" && L.smart && L.smart.ue);
    const cur = () => { const L = S.w ? E.layer() : null; return isUE(L) ? L : null; };
    let busy = 0, msg = "";
    const setMsg = (m) => { msg = m || ""; const el = $("ueMsg"); if (el) el.textContent = msg; };
    async function take(u) {
      if (!U()) throw new Error("static/unreal.js is not loaded");
      busy++; setMsg("Unreal is drawing it…");
      try { const r = await U().still(stillRequest(u, U().framing)); const c = await U().loadStill(r); u.lastCamera = r.camera || null; return c; }
      finally { busy--; setMsg(""); }
    }
    /** a new layer from the picture (fitted to the canvas, the middle) */
    function addLayer(c, u, name) {
      const id = SM.addSource(c, null), k = Math.min(S.w / c.width, S.h / c.height), w = c.width * k, h = c.height * k;
      let L = null;
      E.structOp("new unreal layer", () => {
        L = E.makeLayer(name, S.w, S.h, "smart");
        L.smart = { src: id, w: c.width, h: c.height, t: { quad: X.rectQuad((S.w - w) / 2, (S.h - h) / 2, w, h), warp: null }, filters: [], ue: u };
        const A = E.layer(); S.layers.splice(A ? S.layers.indexOf(A) + 1 : S.layers.length, 0, L); S.active = S.layers.indexOf(L);
        SM.render(L);
      });
      E.refresh(); E.renderLayersPanel();
      if (E.ui.showTab) E.ui.showTab("kue");
      return L;
    }
    /** render again: the same place on the canvas (scaled round the middle if the picture's size changed) */
    async function rerender(L, u2, label) {
      const L0 = L || cur(); if (!L0) return say("pick an Unreal / MetaHuman layer first");
      const u = JSON.parse(JSON.stringify(u2 || L0.smart.ue));
      try {
        const c = await take(u), id = SM.addSource(c, null), sm = L0.smart;
        E.structOp(label || "render unreal layer", () => {
          if (c.width !== sm.w || c.height !== sm.h) {
            const q = sm.t.quad, cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2, kx2 = c.width / sm.w, ky = c.height / sm.h;
            sm.t.quad = q.map(([x, y]) => [cx + (x - cx) * kx2, cy + (y - cy) * ky]);
          }
          sm.src = id; sm.w = c.width; sm.h = c.height; sm.ue = u; SM.render(L0); L0.ver = (L0.ver || 0) + 1;
        });
        E.refresh(); paintTab(); say(`${L0.name}: drawn again by Unreal`);
        return true;
      } catch (e) { say("Unreal: " + e.message); setMsg(e.message); return false; }
    }
    /* ---- the dialogs */
    async function lists(kinds) { const out = {}; for (const k of kinds) { try { out[k] = await U().list(k); } catch (e) { out.error = e.message; out[k] = []; } } return out; }
    async function sceneDialog() {
      if (!S.w) return say("open or make a picture first");
      const st = await U().status(); if (!st.connected) return say("Unreal: " + st.error);
      const l = await lists(["levels", "cameras"]);
      E.ui.dialog("New Unreal Layer", `<div class="hint" style="padding:2px 0 6px">Unreal ${esc(st.engine)} · ${esc(st.project)}</div>`
        + `<div class="rw"><span>Level</span><select id="ueLv">${opt("", "", "the one open now")}${l.levels.map((x) => opt(x.path, "", x.path)).join("")}</select></div>`
        + `<div class="rw"><span>Camera</span><select id="ueCam">${opt("", "", "the level viewport (as it is now)")}${l.cameras.map((x) => opt(x.name, "", `${x.name} (${Math.round(x.fov)}°)`)).join("")}</select></div>`
        + `<div class="rw"><span>Size</span><input type="number" id="ueW" value="${S.w}" min="16" max="8192" style="width:70px"> x <input type="number" id="ueH" value="${S.h}" min="16" max="8192" style="width:70px"></div>`
        + '<label class="rw"><input type="checkbox" id="ueA"> a clear background (Unreal\'s alpha - see Settings ▸ 3D)</label>', (d) => {
        const q = (id) => d.querySelector("#" + id), cam = q("ueCam").value;
        const u = { kind: "scene", level: q("ueLv").value || "", camera: cam ? { name: cam, yaw: 0, pitch: 0, dolly: 0 } : { viewport: true }, w: +q("ueW").value || S.w, h: +q("ueH").value || S.h, alpha: q("ueA").checked };
        take(u).then((c) => { if (!u.camera.name && u.lastCamera) u.camera = { loc: u.lastCamera.loc, rot: u.lastCamera.rot, fov: u.lastCamera.fov }; addLayer(c, u, "Unreal " + (cam || "view")); say("Unreal layer: the 🎮 Unreal tab moves its camera"); }).catch((e) => say("Unreal: " + e.message));
      }, { okLabel: "Render" });
    }
    async function metaDialog() {
      if (!S.w) return say("open or make a picture first");
      const st = await U().status(); if (!st.connected) return say("Unreal: " + st.error);
      const l = await lists(["metahumans", "anims", "levels"]);
      if (!l.metahumans.length) return say("Unreal: no MetaHumans in the project (/Game/MetaHumans/<name>/BP_<name>)");
      E.ui.dialog("New MetaHuman Layer", `<div class="rw"><span>MetaHuman</span><select id="ueMh">${l.metahumans.map((x) => opt(x.object || x.path, "", x.name)).join("")}</select></div>`
        + `<div class="rw"><span>Pose from</span><select id="ueAn">${opt("", "", "(its own pose)")}${l.anims.map((x) => opt(x.object || x.path, "", x.name)).join("")}</select><span>at</span><input type="number" id="ueT" value="0" min="0" step="0.1" style="width:60px"><span>s</span></div>`
        + `<div class="rw"><span>Framing</span><select id="ueFr">${opt("face", "bust", "Face")}${opt("bust", "bust", "Bust")}${opt("full", "bust", "Full body")}</select><span>Turn</span><input type="number" id="ueTu" value="0" step="15" style="width:60px"><span>°</span></div>`
        + `<div class="rw"><span>Level (light)</span><select id="ueLv">${opt("", "", "the one open now")}${l.levels.map((x) => opt(x.path, "", x.path)).join("")}</select></div>`
        + `<div class="rw"><span>Size</span><input type="number" id="ueW" value="${Math.min(S.w, 2048)}" style="width:70px"> x <input type="number" id="ueH" value="${Math.min(S.h, 2048)}" style="width:70px"></div>`, (d) => {
        const q = (id) => d.querySelector("#" + id), mh = l.metahumans.find((x) => (x.object || x.path) === q("ueMh").value);
        const u = { kind: "metahuman", level: q("ueLv").value || "", metahuman: { bp: q("ueMh").value, anim: q("ueAn").value || "", time: +q("ueT").value || 0, name: mh ? mh.name : "" }, preset: q("ueFr").value, turn: +q("ueTu").value || 0, w: +q("ueW").value || 1024, h: +q("ueH").value || 1024, alpha: true };
        take(u).then((c) => { addLayer(c, u, "MetaHuman " + (mh ? mh.name : "")); say("MetaHuman layer: the 🎮 Unreal tab turns, poses and frames it"); }).catch((e) => say("Unreal: " + e.message));
      }, { okLabel: "Render" });
    }
    async function useViewport(L0) {
      const L = L0 || cur(); if (!L) return;
      try { const v = await U().viewport(); const u = JSON.parse(JSON.stringify(L.smart.ue)); u.camera = { loc: v.loc, rot: v.rot, fov: (u.camera && u.camera.fov) || v.fov }; return rerender(L, u, "unreal camera from the viewport"); }
      catch (e) { say("Unreal: " + e.message); return false; }
    }
    /* ---- the 🎮 Unreal tab */
    const ctl = kx.querySelector('.pcgrp .pctabs [data-tab="kxCtl"]');
    if (ctl) {
      const tabs = ctl.parentElement, holder = tabs.parentElement;
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "kue"; b.dataset.grp = "props"; b.textContent = "🎮 Unreal";
      b.onclick = () => E.ui.showTab("kue");
      (tabs.querySelector('[data-tab="kbody"]') || tabs.querySelector('[data-tab="ksk"]') || ctl).after(b);
      const body = doc.createElement("div"); body.className = "pcbody kxsec"; body.dataset.body = "kue"; body.id = "kueBody"; holder.appendChild(body);
      const css = doc.createElement("style");
      css.textContent = "#kueBody{padding:6px 8px;font-size:11px}#kueBody .r{display:flex;gap:4px;align-items:center;margin:3px 0;flex-wrap:wrap}#kueBody .r>span:first-child{min-width:62px;color:var(--pc-dim)}#kueBody input[type=number]{width:62px}#kueBody #ueMsg{color:var(--pc-dim);margin-top:6px;min-height:14px}";
      doc.head.appendChild(css);
      const prev = E.ui.showTab;
      E.ui.showTab = function (id) { const r = prev.apply(this, arguments); if (id === "kue") paintTab(); return r; };
    }
    function paintTab() {
      const host = $("kueBody"); if (!host || !host.classList.contains("on")) return;
      const L = cur();
      if (!L) { host.innerHTML = `<div id="ueMsg">${esc(msg || "Pick an Unreal or MetaHuman layer - or make one: UNREAL ▸ Unreal Layer / MetaHuman Layer (the CAD toolbar).")}</div><div class="r"><button class="ghost" id="ueSt">Check the link</button></div>`; host.querySelector("#ueSt").onclick = () => U().status().then((s) => setMsg(s.connected ? `✓ Unreal ${s.engine} · ${s.level}` : "✕ " + s.error)); return; }
      const u = L.smart.ue, isMH = u.kind === "metahuman", c = u.camera || {};
      const field = (id, label, v, step) => `<div class="r"><span>${label}</span><input type="number" id="${id}" value="${esc(v)}" step="${step || 1}"></div>`;
      host.innerHTML = `<div class="r"><b>${esc(L.name)}</b><span class="hint">${esc(u.level || "the open level")} · ${u.w} x ${u.h}</span></div>`
        + (isMH ? `<div class="r"><span>Framing</span><select id="ueFr">${opt("face", u.preset, "Face")}${opt("bust", u.preset, "Bust")}${opt("full", u.preset, "Full body")}</select></div>` + field("ueTu", "Turn (°)", u.turn || 0, 15) + field("ueT", "Pose at (s)", (u.metahuman && u.metahuman.time) || 0, 0.1) + field("ueFov", "Field of view", u.fov || "", 1)
          : c.name ? `<div class="r"><span>Camera</span><b>${esc(c.name)}</b></div>` + field("ueYaw", "Turn (°)", c.yaw || 0, 1) + field("uePit", "Tilt (°)", c.pitch || 0, 1) + field("ueDol", "Dolly (cm)", c.dolly || 0, 10) + field("ueFov", "Field of view", c.fov || "", 1)
          : field("ueFov", "Field of view", c.fov || 90, 1) + `<div class="r"><span>Camera</span><span class="hint">${esc(c.loc ? "at " + c.loc.map((x) => Math.round(x)).join(", ") : "the viewport")}</span></div>`)
        + '<div class="r"><button class="ghost" id="ueRe">⟳ Render again</button>' + (isMH ? "" : '<button class="ghost" id="ueVp" title="The level viewport\'s camera as it is in Unreal now">🎥 Use the viewport now</button>') + "</div>"
        + (isMH ? "" : refsHtml(L, u))                                                     // 2.540.0
        + `<div id="ueMsg">${esc(msg)}</div>`;
      const q = (s) => host.querySelector(s), nv = (s) => (q(s) && q(s).value !== "" ? +q(s).value : undefined);
      q("#ueRe").onclick = () => {
        const u2 = JSON.parse(JSON.stringify(u));
        if (isMH) { u2.preset = q("#ueFr").value; u2.turn = nv("#ueTu") || 0; u2.metahuman.time = nv("#ueT") || 0; u2.fov = nv("#ueFov"); }
        else if (c.name) Object.assign(u2.camera, { yaw: nv("#ueYaw") || 0, pitch: nv("#uePit") || 0, dolly: nv("#ueDol") || 0, fov: nv("#ueFov") });
        else u2.camera.fov = nv("#ueFov") || 90;
        rerender(L, u2);
      };
      if (q("#ueVp")) q("#ueVp").onclick = () => useViewport(L);
      if (q("#ueFind")) q("#ueFind").onclick = () => findObjects(L);
      if (q("#ueReal")) q("#ueReal").onclick = () => makeReal(L);
      if (q("#ueRefs") && root.RealRefs) root.RealRefs.bindList(q("#ueRefs"), (name, v) => { const mm = Object.assign({}, u.rr || {}); if (v === "") delete mm[name]; else mm[name] = v; u.rr = mm; paintTab(); });
    }
    /* ---- 2.540.0: 🖼 the reference docker's pictures for the level's objects in view */
    const objs = new Map();                       // layer id -> [{name, box}] (found for its camera)
    const rrRefs = () => (root.H3Refs ? root.H3Refs.images() : []);
    function refsHtml(L, u) {
      if (!root.RealRefs) return "";
      const o = objs.get(L.id), refs = rrRefs(), items = o ? root.RealRefs.resolve(o, refs, u.rr || {}) : [];
      return `<h5>🖼 References <span class="hint">${o ? items.length + " of " + o.length + " object(s) have a picture" : "which reference docker picture each object becomes"}</span></h5>`
        + `<div class="r"><button class="ghost" id="ueFind" title="Ask Unreal which mesh actors this camera sees (bitGen Bridge 1.3.0)">🔍 Find the objects</button>`
        + `<button class="ghost" id="ueReal" ${items.length ? "" : "disabled"} title="This picture + the objects' reference pictures -> an edit model (the prompt docker's words are added) -> a new layer">✨ Make it real</button></div>`
        + (o ? `<div id="ueRefs">${root.RealRefs.listHtml(o, refs, u.rr || {})}</div>` : "");
    }
    async function findObjects(L) {
      const u = L.smart.ue; setMsg("🔍 asking Unreal which objects this camera sees…");
      try { const j = await U().actors(stillRequest(u, U().framing)); objs.set(L.id, j.objects || []); setMsg(`🔍 ${(j.objects || []).length} object(s) in view`); }
      catch (e) { setMsg("🔍 " + e.message + (/unknown command/.test(e.message) ? " - update the bitGen Bridge plugin to 1.3.0 (🎮 Load UE project does it)" : "")); }
      paintTab();
    }
    async function makeReal(L) {
      const u = L.smart.ue, o = objs.get(L.id) || [], refs = rrRefs(), items = root.RealRefs.resolve(o, refs, u.rr || {});
      if (!items.length) { setMsg("🖼 no object has a reference picture yet"); return null; }
      const text = (doc.getElementById("prompt") || {}).value || "";
      setMsg(`🖼 ✨ making it real with ${new Set(items.map((x) => x.ref)).size} reference picture(s)…`);
      try {
        const up = await root.RealRefs.upload(items, refs);
        const blob = await new Promise((r) => L.canvas.toBlob(r, "image/png"));
        const fd = new root.FormData(); fd.append("frame", blob, "unreal.png");
        fd.append("spec", JSON.stringify({ kind: "image", source: "unreal", token: up.token, items: up.items, prompt: text.trim(), style_id: (doc.getElementById("ieEditStyle") || {}).value || "" }));
        const r = await root.fetch("/api/realrefs/start", { method: "POST", body: fd }), j = await r.json();
        if (!r.ok) throw new Error(j.error || "refused");
        setMsg("🖼 " + j.note + " - job " + j.edit);
        if (root.H3TestEvent) root.H3TestEvent("ie_realrefs", "unreal");
        const url = E.api && E.api.awaitResult ? await E.api.awaitResult(j.edit, say, (t) => setMsg("🖼 " + j.note + " - job " + j.edit + (t ? " · " + t : ""))) : null;   // 2.574.0: its step
        if (!url) { setMsg("🖼 no picture came back - see the job log"); return null; }
        const img = await new Promise((res, rej) => { const im = new root.Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("the result did not load")); im.src = url; });
        E.addImageLayer(img, "✨ " + L.name + " real");
        setMsg("✓ the real picture is a new layer above");
        return j;
      } catch (e) { setMsg("🖼 " + e.message); return null; }
    }
    E.overlayHooks.push(() => { const host = $("kueBody"), L = cur(), k = L ? L.id + ":" + (L.ver || 0) : "-"; if (host && host.dataset.k !== k) { host.dataset.k = k; paintTab(); } });
    /* ---- commands + the UNREAL tab of the CAD toolbar */
    const C = E.ui.addCmd, has = () => !!cur();
    if (C) {
      C("ue.scene", "New Unreal Layer…", "", sceneDialog, {}, ["Layer", "solid.totimeline", true]);
      C("ue.metahuman", "New MetaHuman Layer…", "", metaDialog, {}, ["Layer", "ue.scene"]);
      C("ue.rerender", "Render Unreal Layer Again", "", () => rerender(), { enabled: has }, ["Layer", "ue.metahuman"]);
    }
    const addTab = () => {
      if (!E.cadBar || !E.cadBar.addTab) return false;
      const sv = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
      E.cadBar.addTab({ id: "unreal", label: "Unreal", groups: [
        { label: "Layers", show: 2, items: [{ id: "u_scene", label: "Unreal Layer", icon: sv('<circle cx="12" cy="12" r="9"/><path d="M8 16V9l4 3 4-3v7"/>'), run: sceneDialog },
          { id: "u_mh", label: "MetaHuman Layer", icon: sv('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>'), run: metaDialog }] },
        { label: "Camera", show: 4, items: [{ id: "u_cam", label: "Camera", icon: "🎥", run: () => E.setTool("uecam"), enabled: () => has() && !!E.tools.uecam, active: () => S.tool === "uecam" },   // 2.475.0 (pcuecam.js)
          { id: "u_props", label: "Lens & Exposure", icon: "◎", run: () => E.ui.showTab && E.ui.showTab("kuecam"), enabled: () => has() && !!E.tools.uecam },
          { id: "u_vp", label: "Use Viewport", icon: "⇩", run: () => useViewport(), enabled: has }, { id: "u_re", label: "Render Again", icon: "⟳", run: () => rerender(), enabled: has }] },
        { label: "Lights", show: 2, items: [{ id: "u_lights", label: "Lights", icon: "💡", run: () => E.setTool("uelight"), enabled: () => has() && !!E.tools.uelight, active: () => S.tool === "uelight" },   // 2.476.0 (pcuelights.js)
          { id: "u_fog", label: "Lights & Fog", icon: "🌫", run: () => E.ui.showTab && E.ui.showTab("kuelights"), enabled: () => has() && !!E.tools.uelight }] },
        { label: "Bridge", show: 1, items: [{ id: "u_set", label: "Unreal Settings", icon: "⚙", run: () => { if (root.Settings3D) root.Settings3D.open(); } }, { id: "u_st", label: "Check the Link", icon: "🔗", run: () => U().status().then((s) => say(s.connected ? `Unreal ${s.engine}: ${s.project} · ${s.level}` : "Unreal: " + s.error)) }] },
      ] });
      return true;
    };
    if (!addTab()) root.setTimeout(addTab, 300);
    E.unreal = { findObjects, makeReal, objects: (L) => objs.get(L.id) || null, isUE, sceneDialog, metaDialog, rerender, useViewport, take, addLayer, paintTab, busy: () => busy > 0 };
  }
  const PCUnreal = { install, stillRequest };
  if (typeof module !== "undefined" && module.exports) module.exports = PCUnreal;
  else root.PCUnreal = PCUnreal;
})(typeof window !== "undefined" ? window : globalThis);
