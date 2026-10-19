/* pc3d.js — A DAZ / BLENDER SCENE AS A 3D LAYER: camera, pose, render, generate (2.460.0), window.PC3D.
 *
 * Tim (verbatim): "bridge daz3d to image editor and timeline - allow me to move the camera and adjust poses in daz3d
 * through the image editor or timeline docker. use the image in the daz layer to generate a new image / if we can't do it
 * wit daz directly we can send daz scene to blender" - asked: Blender + an experimental Daz live link.
 *
 *   Layer ▸ New 3D Layer (Daz / Blender)…   a scene sent from Daz Studio (bitGen Bridge ▸ Scene - it lands as a .blend)
 *                                          or any of the project's .blend files -> a 3D LAYER: an ordinary picture layer
 *                                          (masks, filters, moving all work) that Blender draws again on demand
 *                                          (lib/layer3d.js keeps one Blender per scene open - a view in about a second).
 *   The 🧊 3D tab (Properties group):
 *     Camera   🎥 the scene's own camera, Front / Back / Left / Right / Top, Turn / Tilt / Distance / Lens (fov);
 *              🖐 Drag the view: on the canvas drag = orbit, Shift+drag = pan, Ctrl+drag or the wheel = zoom (a wire
 *              box of the scene follows the pointer; Blender draws the view when you let go)
 *     Pose     the figure (armature) + a bone (type to find it), X / Y / Z turns in degrees on top of the file's own
 *              pose; Reset bone / Reset pose
 *     Frame    which frame of an animated scene
 *     Render   Quick (Workbench) / EEVEE / Cycles, ☐ transparent background, ▶ Render (the layer's full size)
 *     ✨ Generate from it   the prompt docker in Edit mode with this picture: a new image made from the 3D view
 *     🖼 References 2.540.0 each mesh -> a reference docker picture (by its name - car, sofa, lamp … - or picked); with
 *                           any, ✨ Generate from it sends the view + those pictures to an edit model (lib/realRefs.js,
 *                           Picture 1 = the view, "the grey shape on the left becomes the car in Picture 2") -> a layer
 *     Daz live link (2.461.0, EXPERIMENTAL)  📡 Camera → Daz / 📡 Pose → Daz / ↺, ☐ as I change - Daz Studio's "bitGen
 *              Live Link" script takes them (lib/dazLive.js): its viewport looks through a "bitGen Camera" placed like
 *              this view, the same-named bones turn
 *   Every change is one undo step (the layer's pixels + its camera / pose). The .bgi keeps L.l3d.
 *   2.541.0 (Tim: "add blender bridge to image-editor so user can modify model/view/camera ... if image editor is in blender
 *   mode and the user clicks edit use the blender scene to render the picture from the prompt add it to the gallery, if
 *   user selects apply on the thumbnail then add a new layer to the image-editor"):
 *     Model    pick an object (or click it on the canvas with 🖐 Drag the object), Move X / Y / Z (m), Turn X / Y / Z (°),
 *              Scale %, hidden, Reset object / Reset all; 🖐 Drag the object: drag = along the ground (left-right /
 *              away-near as the camera sees it), Shift = up / down, Ctrl = turn round Z. L.l3d.objs = {name: {move, turn,
 *              scale, hide}} - Blender applies them on top of the file's own places (lib/layer3d.js cleanObjects,
 *              scripts/blend_layer3d.py apply_objects); the original .blend is never changed.
 *     BLENDER MODE = a 3D layer selected: the prompt docker's ▾ Edit / Refine (pcimgop.js) render the scene with Blender
 *              (the layer's engine, the picture's full size - the layer itself is left as it is) and send THAT picture
 *              with the prompt to the edit model / Refine (editFromScene); the results come into the ✨ AI panel's
 *              gallery, ✔ on a result keeps it as a new layer.
 * Pure (Node: scripts/test-layer3d.js, test-model3d541.js): orbitPos, basis, project, orbitDrag, VIEWS, setBone, boxPoints,
 * setObj, objDrag, objBox, pickObject, editable.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const rad = (d) => (d * Math.PI) / 180;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  /** where an orbit camera is (Blender's Z up) - the same sum as scripts/blend_layer3d.py view_cam */
  function orbitPos(c) {
    const y = rad(c.yaw || 0), p = rad(c.pitch || 0), d = c.dist || 5, t = c.target || [0, 0, 0];
    return [t[0] + d * Math.cos(p) * Math.cos(y), t[1] + d * Math.cos(p) * Math.sin(y), t[2] + d * Math.sin(p)];
  }
  /** the camera's forward / right / up */
  function basis(c) {
    const f = norm(sub(c.target || [0, 0, 0], orbitPos(c)));
    let r = cross(f, [0, 0, 1]); if (Math.hypot(...r) < 1e-6) r = [1, 0, 0];
    r = norm(r);
    return { f, r, u: cross(r, f), pos: orbitPos(c) };
  }
  /** a world point on a w x h picture (the fov across the longer side, like Blender's AUTO sensor fit); null behind */
  function project(c, w, h, p) {
    const B = basis(c), v = sub(p, B.pos), z = dot(v, B.f);
    if (z <= 1e-6) return null;
    const fpx = (Math.max(w, h) / 2) / Math.tan(rad(c.fov || 40) / 2);
    return [w / 2 + (dot(v, B.r) * fpx) / z, h / 2 - (dot(v, B.u) * fpx) / z];
  }
  /** a drag of (dx, dy) px: "orbit" turns round the target, "pan" moves the target, "zoom" changes the distance */
  function orbitDrag(c0, dx, dy, how, h) {
    const c = { target: (c0.target || [0, 0, 0]).slice(), dist: c0.dist || 5, yaw: c0.yaw || 0, pitch: c0.pitch || 0, fov: c0.fov || 40 };
    if (how === "pan") {
      const B = basis(c), k = (2 * c.dist * Math.tan(rad(c.fov) / 2)) / Math.max(1, h || 500);
      for (let i = 0; i < 3; i++) c.target[i] += (-dx * B.r[i] + dy * B.u[i]) * k;
    } else if (how === "zoom") c.dist = Math.max(1e-3, c.dist * Math.exp(dy * 0.01));
    else { c.yaw = (((c.yaw - dx * 0.4) % 360) + 540) % 360 - 180; c.pitch = Math.max(-89, Math.min(89, c.pitch + dy * 0.3)); }
    return c;
  }
  const VIEWS = { front: [-90, 0], back: [90, 0], left: [180, 0], right: [0, 0], top: [-90, 89] };
  /** the pose with one bone's turn set (zero turns dropped; an empty figure dropped) */
  function setBone(pose, arm, bone, xyz) {
    const p = JSON.parse(JSON.stringify(pose || {})), v = (xyz || [0, 0, 0]).map((x) => Math.round((+x || 0) * 100) / 100);
    p[arm] = p[arm] || {};
    if (v.some((x) => x !== 0)) p[arm][bone] = v; else delete p[arm][bone];
    if (!Object.keys(p[arm]).length) delete p[arm];
    return p;
  }
  /** 2.461.0 (the Daz live link): an orbit (Blender m, Z up) as Daz sees it - cm, Y up: (100x, 100z, -100y) */
  function dazView(c) {
    const d = (p) => [p[0] * 100, p[2] * 100, -p[1] * 100];
    return { pos: d(orbitPos(c)), target: d(c.target || [0, 0, 0]), fov: c.fov || 40 };
  }
  /** the 8 corners of the scene's box (centre ± radius / √3) + 4 floor points, for the wire preview */
  function boxPoints(center, radius) {
    const c = center || [0, 0, 0], r = (radius || 1) / Math.sqrt(3), out = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push([c[0] + x * r, c[1] + y * r, c[2] + z * r]);
    return out;
  }

  /* ---- 2.541.0: the MODEL - an object's edit {move: [x,y,z] m, turn: [x,y,z] °, scale: k, hide} on top of the file's place */
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  /** the objects that can be moved: everything but cameras and bitGen's own helpers */
  const editable = (objects) => (objects || []).filter((o) => o && o.name && o.type !== "CAMERA" && !/^bitgen_/.test(o.name));
  /** objs with one object's edit changed (patch merged; a no-op edit dropped) */
  function setObj(objs, name, patch) {
    const all = JSON.parse(JSON.stringify(objs || {})), e = Object.assign({}, all[name] || {}, patch || {}), c = {};
    const v3 = (a) => (Array.isArray(a) ? a.slice(0, 3).map((x) => r4(+x || 0)) : [0, 0, 0]);
    if (v3(e.move).some((x) => x !== 0)) c.move = v3(e.move);
    if (v3(e.turn).some((x) => x !== 0)) c.turn = v3(e.turn).map((x) => Math.round(x * 100) / 100);
    const k = Math.max(0.01, Math.min(100, Number(e.scale) || 1)); if (Math.abs(k - 1) > 1e-6) c.scale = r4(k);
    if (e.hide === true) c.hide = true;
    if (Object.keys(c).length) all[name] = c; else delete all[name];
    return all;
  }
  /** a drag of (dx, dy) px on an object seen through camera c: "move" = along the ground (right / away), "lift" = up /
   *  down, "turn" = round Z -> its new edit (e0 = the edit before the drag) */
  function objDrag(c, e0, dx, dy, how, h) {
    const e = { move: ((e0 && e0.move) || [0, 0, 0]).slice(), turn: ((e0 && e0.turn) || [0, 0, 0]).slice(), scale: (e0 && e0.scale) || 1, hide: !!(e0 && e0.hide) };
    if (how === "turn") { e.turn[2] = Math.round((((e.turn[2] - dx * 0.5) % 360) + 540) % 360 - 180); return e; }
    const B = basis(c), k = (2 * (c.dist || 5) * Math.tan(rad(c.fov || 40) / 2)) / Math.max(1, h || 500);
    if (how === "lift") { e.move[2] = r4(e.move[2] - dy * k); return e; }
    let fw = [B.f[0], B.f[1], 0]; const l = Math.hypot(fw[0], fw[1]); fw = l > 1e-6 ? [fw[0] / l, fw[1] / l, 0] : [B.u[0], B.u[1], 0];
    let rt = [B.r[0], B.r[1], 0]; const lr = Math.hypot(rt[0], rt[1]) || 1; rt = [rt[0] / lr, rt[1] / lr, 0];
    for (let i = 0; i < 2; i++) e.move[i] = r4(e.move[i] + dx * k * rt[i] - dy * k * fw[i]);
    return e;
  }
  /** an object's box on the picture (its file box moved by its edit) -> [x0, y0, x1, y1] px, or null */
  function objBox(o, e, c, w, h) {
    if (!o || !o.box) return null;
    const mv = (e && e.move) || [0, 0, 0], [lo, hi] = o.box, pts = [];
    for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) { const p = project(c, w, h, [x + mv[0], y + mv[1], z + mv[2]]); if (p) pts.push(p); }
    if (pts.length < 2) return null;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  /** the object under (x, y) on the picture - the smallest box that holds the point - or null */
  function pickObject(objects, objs, c, w, h, x, y) {
    let best = null, area = Infinity;
    for (const o of editable(objects)) {
      if ((objs || {})[o.name] && objs[o.name].hide) continue;
      const b = objBox(o, (objs || {})[o.name], c, w, h); if (!b || x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      const a = (b[2] - b[0]) * (b[3] - b[1]); if (a < area) { area = a; best = o.name; }
    }
    return best;
  }

  /** 2.540.0: the scene's meshes on a w x h picture through camera c -> [{name, box}] (their world boxes projected) */
  function objectsOnPicture(objects, c, w, h) {
    const RR = root.RealRefs || (typeof require === "function" ? (() => { try { return require("../../static/realrefs.js"); } catch (e) { return null; } })() : null);
    return (objects || []).filter((o) => /^(MESH|CURVE|SURFACE|META|FONT)$/.test(o.type || "")).map((o) => {
      let box = null;
      if (o.box && RR) { const [lo, hi] = o.box, pts = []; for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) pts.push(project(c, w, h, [x, y, z])); box = RR.boxOf(pts, w, h); }
      return { name: o.name, box };
    }).filter((o) => !o.box || (o.box[2] > 0 && o.box[3] > 0));
  }

  /* ================================ the editor ================================ */
  function install(E) {
    const S = E.S, D = E.D, doc = E.doc || root.document, say = E.say, kx = E.kx, stage = E.stage, store = E.store;
    if (!E.ui || !kx || !stage) return;
    const $ = (id) => doc.getElementById(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const api = async (url, body) => { const r = await root.fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };
    const is3d = (L) => !!(L && L.l3d && L.l3d.id);
    const cur = () => { const L = S.w ? E.layer() : null; return is3d(L) ? L : null; };
    const metas = new Map();             // scene id -> {meta, name}
    async function metaOf(id) { if (!metas.has(id)) metas.set(id, await api("/api/layer3d/" + encodeURIComponent(id))); return metas.get(id); }
    const camOf = (L) => L.l3d.cam || (metas.get(L.l3d.id) && metas.get(L.l3d.id).meta.orbit) || { target: [0, 0, 1], dist: 5, yaw: -90, pitch: 5, fov: 40 };
    let msg = "";
    const status = (t) => { msg = t; const m = $("l3Msg"); if (m) m.textContent = t; };

    /* ---- rendering into the layer (one undo step: its pixels + its l3d) */
    let token = 0;
    /** 2.541.0: Blender draws the layer's scene (camera, pose, model, frame) -> {img, st, job} - nothing is changed */
    async function renderImage(L, final, qw, qh) {
      const l = L.l3d;
      const job = { cam: l.cam, pose: l.pose, objects: l.objs || {}, w: qw, h: qh, engine: final ? l.engine : "WORKBENCH", samples: l.samples || 32, transparent: !!l.transparent, frame: l.frame };
      const { rid } = await api(`/api/layer3d/${encodeURIComponent(l.id)}/render`, job);
      let st = null;
      for (let i = 0; i < 6000; i++) {
        await new Promise((r) => root.setTimeout(r, i < 20 ? 100 : 300));
        st = await api("/api/layer3d/render/" + rid);
        if (st.state === "done" || st.state === "error") break;
      }
      if (!st || st.state !== "done") return { st, job, img: null };
      const img = await new Promise((res, rej) => { const im = new root.Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("the render did not load")); im.src = st.png + "&t=" + Date.now(); });
      return { st, job, img };
    }
    async function render(L, opt) {
      if (!is3d(L)) return null;
      const o = opt || {}, final = !!o.final, my = ++token, l = L.l3d;
      const [qw, qh] = final ? [S.w, S.h] : sizeFit(S.w, S.h, 640);
      status(final ? `rendering ${S.w} x ${S.h} with ${l.engine === "WORKBENCH" ? "Quick" : l.engine}…` : "drawing the view…");
      L.l3d.busy = true;
      try {
        const { st, job, img } = await renderImage(L, final, qw, qh);
        if (!img) { if (my === token || final) status("Blender: " + ((st && st.error) || "no picture")); return null; }
        if (my !== token && !final) return null;                     // a newer view is on its way
        const before = o.before || (stash && stash.L === L ? stash.before : E.snapStruct()), copy = E.beginPx(L);
        const g = L.canvas.getContext("2d"); g.clearRect(0, 0, S.w, S.h); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, S.w, S.h);
        L.l3d.last = { w: qw, h: qh, engine: job.engine, ms: st.ms };
        const px = E.endPx(L, copy, null, o.label || "3D view");
        E.push({ t: "multi", list: [px, { t: "struct", before, after: E.snapStruct() }].filter(Boolean), label: o.label || "3D view" });
        stash = null;
        E.refresh(); E.renderLayersPanel();
        status(`${final ? "rendered" : "view"} ${qw} x ${qh} · ${job.engine === "WORKBENCH" ? "Quick" : job.engine} · ${st.ms} ms`);
        return L;
      } catch (e) { status("3D: " + e.message); say("3D layer: " + e.message); return null; }
      finally { L.l3d.busy = false; paint(); E.drawOverlay(); }
    }
    function sizeFit(w, h, longest) { const k = Math.min(1, longest / Math.max(w, h)); return [Math.max(16, Math.round(w * k)), Math.max(16, Math.round(h * k))]; }
    /** change the layer's camera / pose / settings -> one undo step with the new view */
    let soon = 0, pend = null, stash = null;          // stash: the layer as it was before the changes not drawn yet (one undo step)
    function change(L, f, label, now) {
      if (!stash || stash.L !== L) stash = { L, before: E.snapStruct() };
      f(L.l3d);
      if (dazAuto) { root.clearTimeout(dazT); dazT = root.setTimeout(() => { dazSend(L, "view"); dazSend(L, "pose"); }, 300); }
      pend = { L, label };
      root.clearTimeout(soon);
      const go = () => { const p = pend; pend = null; render(p.L, { label: p.label }); };
      if (now) go(); else soon = root.setTimeout(go, 220);
      E.drawOverlay(); paint(false);
    }

    /* ---- a new 3D layer */
    async function openScene(src) {
      status("opening the scene in Blender…"); say("opening the scene in Blender…");
      const sc = await api("/api/layer3d/open", { path: src });
      metas.set(sc.id, sc);
      const res = (sc.meta && sc.meta.resolution) || [1280, 720];
      if (!S.w) { const k = Math.min(1, 1280 / Math.max(res[0], res[1])); E.openDoc(Math.round(res[0] * k), Math.round(res[1] * k), sc.name + ".png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, g.canvas.width, g.canvas.height); }); }
      let L = null;
      E.structOp("new 3D layer", () => {
        L = E.makeLayer("3D: " + sc.name, S.w, S.h, "pixel");
        L.l3d = { id: sc.id, name: sc.name, cam: null, pose: {}, objs: {}, engine: "WORKBENCH", samples: 32, transparent: false, frame: null };
        const A = E.layer();
        S.layers = D.insert(S.layers, L, A ? A.id : null, false);
        S.active = S.layers.indexOf(L);
      });
      E.ui.showTab("k3d");
      paint(true);
      await render(L, { label: "3D view" });
      say(`3D layer "${sc.name}": move the camera and pose the figure in the 🧊 3D tab`);
      return L;
    }
    async function newDialog() {
      let items = [];
      try { items = (await api("/api/layer3d/sources")).items || []; } catch (e) { say("3D: " + e.message); }
      const rows = items.map((x, i) => `<option value="${i}">${x.kind === "daz" ? "Daz · " : ""}${esc(x.name)}</option>`).join("");
      E.ui.dialog("New 3D Layer (Daz / Blender)", `<div class="rw"><span>Scene</span><select id="l3Src" style="grid-column:2/4">${rows || '<option value="">(none in this project yet)</option>'}</select></div>
        <div class="rw"><span>or a .blend file</span><input type="text" id="l3Path" placeholder="C:\\\\scenes\\\\room.blend" style="grid-column:2/4"></div>
        <div style="padding:4px 10px;color:var(--pc-dim)">From Daz Studio: Scripts ▸ bitGen ▸ bitGen Bridge ▸ <b>Scene</b> sends the scene (figures, their rig, props, lights, cameras) here as a Blender scene. Blender draws the layer; the original files are never changed.</div>`,
      (dl) => {
        const p = dl.querySelector("#l3Path").value.trim(), i = dl.querySelector("#l3Src").value;
        const src = p || (items[+i] && items[+i].path);
        if (!src) { say("pick a scene or type the path of a .blend"); return false; }
        openScene(src).catch((e) => { status("3D: " + e.message); say("3D layer: " + e.message); });
      }, { okLabel: "Open" });
    }

    /* ---- the 🧊 3D tab */
    const grp = kx.querySelector('.pcgrp .pctabs [data-tab="kxCtl"]');
    if (grp) {
      const tabs = grp.parentElement, holder = tabs.parentElement;
      const b = doc.createElement("button"); b.type = "button"; b.dataset.tab = "k3d"; b.dataset.grp = "props"; b.textContent = "🧊 3D";
      b.onclick = () => E.ui.showTab("k3d");
      grp.after(b);
      const body = doc.createElement("div"); body.className = "pcbody kxsec"; body.dataset.body = "k3d"; body.id = "k3dBody";
      holder.appendChild(body);
      const css = doc.createElement("style");
      css.textContent = ".pcgrp[data-g=\"props\"] .pctabs{flex-wrap:wrap}#k3dBody{padding:6px 8px;font-size:11px}#k3dBody .r{display:flex;gap:4px;align-items:center;margin:3px 0;flex-wrap:wrap}#k3dBody .r>span:first-child{min-width:54px;color:var(--pc-dim)}"
        + "#k3dBody input[type=number]{width:58px}#k3dBody input[type=range]{flex:1;min-width:80px}#k3dBody h5{margin:8px 0 2px;font-size:11px;color:var(--pc-text)}#k3dBody .on{background:var(--pc-accent);color:#000}#l3Msg{color:var(--pc-dim);margin-top:6px;min-height:14px}";
      doc.head.appendChild(css);
      const prevShow = E.ui.showTab;
      E.ui.showTab = function (id) { const r = prevShow.apply(this, arguments); if (id === "k3d") paint(true); return r; };
    }
    let dragOn = false, bone = { arm: "", name: "" };
    let objOn = false, objName = "";                   // 2.541.0: 🖐 Drag the object + the object picked in the Model list
    /* ---- 2.461.0: the EXPERIMENTAL Daz live link (lib/dazLive.js; Daz runs Scripts ▸ bitGen ▸ bitGen Live Link) */
    let dazAuto = false, dazT = 0, dazLine = "Daz Studio: run Scripts ▸ bitGen ▸ bitGen Live Link there to link it";
    try { dazAuto = !!store.get("l3.dazAuto", false); } catch (er) { /* fine */ }
    async function dazSend(L, what) {
      try {
        let body;
        if (what === "view") body = { type: "view", cam: dazView(camOf(L)) };
        else if (what === "pose") { const p = L.l3d.pose || {}, arm = bone.arm || Object.keys(p)[0] || ""; body = { type: "pose", figure: arm, bones: p[arm] || {} }; }
        else body = { type: "reset" };
        const r = await api("/api/daz/live/cmd", body);
        status(r.connected ? `sent to Daz (${what})` : `queued for Daz (${what}) - Daz is not linked yet`);
        return r;
      } catch (e) { status("Daz live link: " + e.message); return null; }
    }
    async function dazStatus() {
      try {
        const s = await api("/api/daz/live");
        dazLine = s.connected ? `Daz linked${s.info && s.info.figure ? " · " + s.info.figure + (s.info.bones && s.info.bones.length ? ` (${s.info.bones.length} bones)` : "") : ""}${s.queued ? " · " + s.queued + " waiting" : ""}`
          : "Daz Studio: run Scripts ▸ bitGen ▸ bitGen Live Link there to link it";
      } catch (e) { dazLine = "Daz live link: " + e.message; }
      const el = $("l3Daz"); if (el) el.textContent = dazLine;
      return dazLine;
    }
    root.setInterval(() => { const b = $("k3dBody"); if (b && b.classList.contains("on") && cur()) dazStatus(); }, 3000);
    function paint(full) {
      const body = $("k3dBody"); if (!body || !body.classList.contains("on")) return;
      const L = cur(), lid = L ? String(L.id) : "none";
      if (full !== true && body.dataset.lid === lid && (!L || body.querySelector("#l3Yaw"))) { if (L && metas.get(L.l3d.id)) fill(L, metas.get(L.l3d.id)); const mm = $("l3Msg"); if (mm) mm.textContent = msg; return; }
      body.dataset.lid = lid;
      if (!L) { body.innerHTML = `<div style="color:var(--pc-dim)">Pick a 3D layer - or <button type="button" class="ghost" id="l3New">＋ New 3D Layer (Daz / Blender)…</button></div><div id="l3Msg">${esc(msg)}</div>`; $("l3New").onclick = newDialog; return; }
      const m = metas.get(L.l3d.id); if (!m) { body.dataset.lid = ""; metaOf(L.l3d.id).then(() => paint(true)).catch((e) => status("3D: " + e.message)); body.innerHTML = '<div id="l3Msg">reading the scene…</div>'; return; }
      const arms = (m.meta.armatures || []), l = L.l3d;
      if (!bone.arm || !arms.some((a) => a.name === bone.arm)) bone = { arm: arms[0] ? arms[0].name : "", name: arms[0] && arms[0].bones[0] ? arms[0].bones[0].name : "" };
      const A = arms.find((a) => a.name === bone.arm);
      if (A && !A.bones.some((x) => x.name === bone.name)) bone.name = A.bones[0] ? A.bones[0].name : "";
      body.innerHTML = `<div class="r"><b>${esc(l.name)}</b><span style="color:var(--pc-dim)">${esc((m.meta.armatures || []).length)} figure(s) · ${esc((m.meta.cameras || []).length)} camera(s)</span></div>
        <h5>Camera</h5>
        <div class="r"><button type="button" class="ghost${l.cam ? "" : " on"}" id="l3Scene" title="The scene's own camera (as Daz / Blender set it)">🎥 Scene camera</button>
          <button type="button" class="ghost${dragOn ? " on" : ""}" id="l3Drag" title="Drag on the canvas: orbit · Shift = pan · Ctrl = zoom · the wheel zooms">🖐 Drag the view</button></div>
        <div class="r">${Object.keys(VIEWS).map((k) => `<button type="button" class="ghost" data-view="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>
        <div class="r"><span>Turn °</span><input type="number" id="l3Yaw" step="5"><span>Tilt °</span><input type="number" id="l3Pitch" step="5" min="-89" max="89"></div>
        <div class="r"><span>Distance</span><input type="number" id="l3Dist" step="0.1" min="0.01"><span>Lens °</span><input type="number" id="l3Fov" step="1" min="1" max="170"></div>
        ${modelHtml(L, m)}
        <h5>Pose</h5>
        ${arms.length ? `<div class="r"><span>Figure</span><select id="l3Arm">${arms.map((a) => `<option${a.name === bone.arm ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div>
        <div class="r"><span>Bone</span><input type="text" id="l3BoneQ" placeholder="find…" style="width:70px"><select id="l3Bone" style="flex:1">${(A ? A.bones : []).map((x) => `<option${x.name === bone.name ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
        ${["X", "Y", "Z"].map((k, i) => `<div class="r"><span>${k} °</span><input type="range" id="l3R${k}" min="-180" max="180" step="1"><input type="number" id="l3N${k}" min="-180" max="180" step="1" data-i="${i}"></div>`).join("")}
        <div class="r"><button type="button" class="ghost" id="l3ResetB">Reset bone</button><button type="button" class="ghost" id="l3ResetP">Reset pose</button></div>` : `<div style="color:var(--pc-dim)">No figure (armature) in this scene.</div>`}
        <h5>Daz live link <span style="color:var(--pc-dim);font-weight:400">(experimental)</span></h5>
        <div class="r"><span id="l3Daz" style="min-width:0;color:var(--pc-dim)">${esc(dazLine)}</span></div>
        <div class="r"><button type="button" class="ghost" id="l3DazView" title="Daz Studio's viewport looks through a 'bitGen Camera' placed like this view">📡 Camera → Daz</button>
          <button type="button" class="ghost" id="l3DazPose" title="The turned bones of this figure turn the same-named bones in Daz (Daz's own X / Y / Z - they may not match)">📡 Pose → Daz</button>
          <button type="button" class="ghost" id="l3DazBack" title="Take the turns sent to Daz back">↺</button>
          <label title="Send the camera and the pose to Daz on every change"><input type="checkbox" id="l3DazAuto"${dazAuto ? " checked" : ""}> as I change</label></div>
        <h5>Frame + render</h5>
        <div class="r"><span>Frame</span><input type="number" id="l3Frame" step="1" placeholder="${esc(m.meta.frame || "")}" title="${esc((m.meta.frames || []).join(" - "))}"></div>
        <div class="r"><span>Engine</span><select id="l3Eng"><option value="WORKBENCH">Quick</option><option value="EEVEE">EEVEE</option><option value="CYCLES">Cycles</option></select>
          <label title="No background - only what is in the scene"><input type="checkbox" id="l3Tr"> transparent</label></div>
        ${refsHtml(L, m)}
        <div class="r"><button type="button" id="l3Render">▶ Render</button><button type="button" class="ghost" id="l3Gen" title="Make a new image from this view with the prompt docker (Edit mode: the edit model + this picture)">✨ Generate from it</button></div>
        <div id="l3Msg">${esc(msg)}</div>`;
      fill(L, m); bind(L, m);
    }
    /* 2.541.0: the MODEL - the scene's objects moved / turned / scaled / hidden on top of the file's own places */
    function modelHtml(L, m) {
      const list = editable(m.meta.objects);
      if (!list.length) return `<h5>Model</h5><div style="color:var(--pc-dim)">No objects listed for this scene (open it again to read them).</div>`;
      if (!list.some((o) => o.name === objName)) objName = (list.find((o) => o.type === "MESH") || list[0]).name;
      const objs = L.l3d.objs || {}, n = Object.keys(objs).length;
      const xyz = (pre, step, t) => ["X", "Y", "Z"].map((k) => `<input type="number" id="${pre}${k}" step="${step}" title="${t} ${k}">`).join("");
      return `<h5 title="Move, turn, scale or hide the scene's objects - Blender draws them there; the .blend itself is never changed">Model <span style="color:var(--pc-dim);font-weight:400">${n ? n + " object(s) changed" : "as in the file"}</span></h5>
        <div class="r"><span>Object</span><select id="l3Obj" style="flex:1">${list.map((o) => `<option value="${esc(o.name)}"${o.name === objName ? " selected" : ""}>${objs[o.name] ? "• " : ""}${esc(o.name)} (${esc(String(o.type || "").toLowerCase())})</option>`).join("")}</select></div>
        <div class="r"><button type="button" class="ghost${objOn ? " on" : ""}" id="l3ObjDrag" title="On the canvas: click an object to pick it; drag = along the ground (as the camera sees it) · Shift = up / down · Ctrl = turn">🖐 Drag the object</button>
          <label title="Leave it out of the picture"><input type="checkbox" id="l3ObjHide"> hidden</label></div>
        <div class="r"><span>Move m</span>${xyz("l3M", 0.05, "Move (metres, world)")}</div>
        <div class="r"><span>Turn °</span>${xyz("l3T", 5, "Turn (degrees, world axes, round its own origin)")}</div>
        <div class="r"><span>Scale %</span><input type="number" id="l3Sc" step="5" min="1" max="10000"><button type="button" class="ghost" id="l3ObjReset" title="This object back where the file has it">Reset object</button><button type="button" class="ghost" id="l3ObjAll" title="Every object back where the file has it">Reset all</button></div>`;
    }
    /* 2.540.0: 🖼 the reference docker's pictures for the scene's meshes */
    const rrRefs = () => (root.H3Refs ? root.H3Refs.images() : []);
    const rrObjects = (L, m) => objectsOnPicture(m.meta.objects, camOf(L), S.w || 1280, S.h || 720);
    function refsHtml(L, m) {
      if (!root.RealRefs) return "";
      const objs = rrObjects(L, m), refs = rrRefs(), items = root.RealRefs.resolve(objs, refs, L.l3d.rr || {});
      return `<h5 title="Which reference docker picture each object becomes - by its name (car, sofa, lamp …) or picked here. With any, ✨ Generate from it sends this view + those pictures to an edit model">🖼 References <span style="color:var(--pc-dim);font-weight:400">${refs.length ? items.length + " of " + objs.length + " object(s)" : "the reference docker has no pictures"}</span></h5>
        <div id="l3Refs">${root.RealRefs.listHtml(objs, refs, L.l3d.rr || {})}</div>`;
    }
    function fill(L, m) {
      const c = drag && drag.L === L && drag.cam ? drag.cam : camOf(L), r1 = (v) => Math.round(v * 100) / 100, set = (id, v) => { const e = $(id); if (e && doc.activeElement !== e) e.value = v; };
      set("l3Yaw", r1(c.yaw)); set("l3Pitch", r1(c.pitch)); set("l3Dist", r1(c.dist)); set("l3Fov", r1(c.fov));
      const rot = ((L.l3d.pose || {})[bone.arm] || {})[bone.name] || [0, 0, 0];
      ["X", "Y", "Z"].forEach((k, i) => { set("l3R" + k, rot[i]); set("l3N" + k, rot[i]); });
      set("l3Frame", L.l3d.frame == null ? "" : L.l3d.frame); set("l3Eng", L.l3d.engine);
      const tr = $("l3Tr"); if (tr) tr.checked = !!L.l3d.transparent;
      const sb = $("l3Scene"); if (sb) sb.classList.toggle("on", !L.l3d.cam);
      if ($("l3Obj")) {                                                 // 2.541.0: the picked object's edit
        const e = (objDrag0 && objDrag0.L === L && objDrag0.e) || (L.l3d.objs || {})[objName] || {}, mv = e.move || [0, 0, 0], tn = e.turn || [0, 0, 0];
        ["X", "Y", "Z"].forEach((k, i) => { set("l3M" + k, r1(mv[i])); set("l3T" + k, r1(tn[i])); });
        set("l3Sc", Math.round((e.scale || 1) * 1000) / 10);
        const hb = $("l3ObjHide"); if (hb) hb.checked = !!e.hide;
        const db = $("l3ObjDrag"); if (db) db.classList.toggle("on", objOn);
      }
      void m;
    }
    function bind(L, m) {
      const q = (id) => $(id);
      q("l3Scene").onclick = () => change(L, (l) => { l.cam = null; }, "3D: scene camera", true);
      q("l3Drag").onclick = () => { dragOn = !dragOn; if (dragOn && objOn) { objOn = false; const ob = q("l3ObjDrag"); if (ob) ob.classList.remove("on"); } q("l3Drag").classList.toggle("on", dragOn); say(dragOn ? "drag on the canvas: orbit · Shift = pan · Ctrl = zoom · wheel = zoom" : "the canvas is yours again"); };
      body().querySelectorAll("[data-view]").forEach((b) => { b.onclick = () => change(L, (l) => { const c = Object.assign({}, camOf(L)); [c.yaw, c.pitch] = VIEWS[b.dataset.view]; l.cam = c; }, "3D: " + b.dataset.view + " view", true); });
      const camNum = (id, key, lo, hi) => { q(id).onchange = (e) => change(L, (l) => { const c = Object.assign({}, camOf(L)); c[key] = Math.max(lo, Math.min(hi, +e.target.value || 0)); l.cam = c; }, "3D camera", true); };
      camNum("l3Yaw", "yaw", -360, 360); camNum("l3Pitch", "pitch", -89, 89); camNum("l3Dist", "dist", 0.001, 1e6); camNum("l3Fov", "fov", 1, 170);
      if (q("l3Arm")) {
        q("l3Arm").onchange = (e) => { bone = { arm: e.target.value, name: "" }; paint(true); };
        q("l3Bone").onchange = (e) => { bone.name = e.target.value; fill(L, m); };
        q("l3BoneQ").oninput = (e) => { const t = e.target.value.toLowerCase(), o = [...q("l3Bone").options].find((x) => x.value.toLowerCase().includes(t)); if (o) { q("l3Bone").value = o.value; bone.name = o.value; fill(L, m); } };
        ["X", "Y", "Z"].forEach((k, i) => {
          const upd = (v, now) => { const r0 = ((L.l3d.pose || {})[bone.arm] || {})[bone.name] || [0, 0, 0]; if (Math.max(-180, Math.min(180, +v || 0)) === r0[i]) return; change(L, (l) => { const r = (((l.pose || {})[bone.arm] || {})[bone.name] || [0, 0, 0]).slice(); r[i] = Math.max(-180, Math.min(180, +v || 0)); l.pose = setBone(l.pose, bone.arm, bone.name, r); }, "3D pose: " + bone.name, now); };
          q("l3R" + k).oninput = (e) => { q("l3N" + k).value = e.target.value; upd(e.target.value, false); };
          q("l3N" + k).onchange = (e) => upd(e.target.value, true);
        });
        q("l3ResetB").onclick = () => change(L, (l) => { l.pose = setBone(l.pose, bone.arm, bone.name, [0, 0, 0]); }, "3D pose: reset " + bone.name, true);
        q("l3ResetP").onclick = () => change(L, (l) => { l.pose = {}; }, "3D pose: reset", true);
      }
      if (q("l3Obj")) {                                                 // 2.541.0: the Model
        const edit = (patch, label) => change(L, (l) => { l.objs = setObj(l.objs, objName, patch); }, label || "3D model: " + objName, true);
        q("l3Obj").onchange = (e) => { objName = e.target.value; fill(L, m); E.drawOverlay(); };
        q("l3ObjDrag").onclick = () => { objOn = !objOn; if (objOn) { dragOn = false; const d = q("l3Drag"); if (d) d.classList.remove("on"); } q("l3ObjDrag").classList.toggle("on", objOn); E.drawOverlay(); say(objOn ? "click an object on the canvas to pick it · drag = along the ground · Shift = up / down · Ctrl = turn" : "the canvas is yours again"); };
        q("l3ObjHide").onchange = (e) => edit({ hide: e.target.checked }, (e.target.checked ? "3D model: hide " : "3D model: show ") + objName);
        const vec = (pre, key) => () => edit({ [key]: ["X", "Y", "Z"].map((k) => +q(pre + k).value || 0) });
        ["X", "Y", "Z"].forEach((k) => { q("l3M" + k).onchange = vec("l3M", "move"); q("l3T" + k).onchange = vec("l3T", "turn"); });
        q("l3Sc").onchange = (e) => edit({ scale: Math.max(1, +e.target.value || 100) / 100 });
        q("l3ObjReset").onclick = () => change(L, (l) => { const o = Object.assign({}, l.objs || {}); delete o[objName]; l.objs = o; }, "3D model: reset " + objName, true);
        q("l3ObjAll").onclick = () => change(L, (l) => { l.objs = {}; }, "3D model: reset all", true);
      }
      q("l3Frame").onchange = (e) => change(L, (l) => { l.frame = e.target.value === "" ? null : Math.round(+e.target.value); }, "3D frame", true);
      q("l3Eng").onchange = (e) => { L.l3d.engine = e.target.value; };
      q("l3Tr").onchange = (e) => { L.l3d.transparent = e.target.checked; };
      q("l3Render").onclick = () => render(L, { final: true, label: "3D render" });
      q("l3DazView").onclick = () => dazSend(L, "view");
      q("l3DazPose").onclick = () => dazSend(L, "pose");
      q("l3DazBack").onclick = () => dazSend(L, "reset");
      q("l3DazAuto").onchange = (e) => { dazAuto = e.target.checked; try { store.set("l3.dazAuto", dazAuto); } catch (er) { /* fine */ } if (dazAuto) { dazSend(L, "view"); dazSend(L, "pose"); } };
      q("l3Gen").onclick = () => generate(L);
      if ($("l3Refs") && root.RealRefs) root.RealRefs.bindList($("l3Refs"), (name, v) => { const mm = Object.assign({}, L.l3d.rr || {}); if (v === "") delete mm[name]; else mm[name] = v; L.l3d.rr = mm; paint(true); });
      body().querySelectorAll("input").forEach((x) => x.addEventListener("keydown", (ev) => ev.stopPropagation()));
    }
    const body = () => $("k3dBody");
    function generate(L) {
      const p = doc.getElementById("prompt"), text = p ? p.value.trim() : "";
      // 2.540.0: objects with a reference docker picture -> the view + the pictures to an edit model (lib/realRefs.js)
      const m0 = metas.get(L.l3d.id);
      if (m0 && root.RealRefs && !L.l3d.busy) {
        const items = root.RealRefs.resolve(rrObjects(L, m0), rrRefs(), L.l3d.rr || {});
        if (items.length) { generateWithRefs(L, items, text); return true; }
      }
      if (!text) { say("type in the prompt docker what to make of this 3D view (e.g. \"a photo of a woman waving in a sunny park\"), then ✨ Generate from it"); if (p) p.focus(); return false; }
      if (L.l3d.busy) { say("the 3D view is still being drawn"); return false; }
      const mb = kx.querySelector('#kxModes [data-mode="edit"]'); if (mb) mb.click();      // the Edit tab: the prompt docker follows (image mode, the edit model)
      E.ui.showTab("k3d");
      status("✨ generating from this view with the prompt docker…");
      root.setTimeout(() => { if (typeof root.runGenerate === "function") root.runGenerate(); else say("the prompt docker is not loaded"); }, 400);
      return true;
    }

    async function generateWithRefs(L, items, text) {
      const refs = rrRefs();
      status(`🖼 ✨ making this view real with ${new Set(items.map((x) => x.ref)).size} reference picture(s)…`);
      try {
        const u = await root.RealRefs.upload(items, refs);
        const blob = await new Promise((r) => L.canvas.toBlob(r, "image/png"));
        const fd = new root.FormData(); fd.append("frame", blob, "view.png");
        fd.append("spec", JSON.stringify({ kind: "image", source: "blender", token: u.token, items: u.items, prompt: text, style_id: ($("ieEditStyle") || {}).value || "" }));
        const r = await root.fetch("/api/realrefs/start", { method: "POST", body: fd }), j = await r.json();
        if (!r.ok) throw new Error(j.error || "refused");
        status("🖼 " + j.note + " - job " + j.edit);
        if (root.H3TestEvent) root.H3TestEvent("ie_realrefs", "blender");
        const url = E.api && E.api.awaitResult ? await E.api.awaitResult(j.edit, say) : null;
        if (!url) { status("🖼 no picture came back - see the job log"); return null; }
        const img = await new Promise((res, rej) => { const im = new root.Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("the result did not load")); im.src = url; });
        E.addImageLayer(img, "✨ " + L.l3d.name + " real");
        status("✓ the real picture is a new layer above");
        return j;
      } catch (e) { status("🖼 " + e.message); say("references: " + e.message); return null; }
    }

    /* ---- 2.541.0: 🖐 dragging an OBJECT on the canvas (click = pick it) */
    let objDrag0 = null;
    const ptOf = (e) => (E.pos ? E.pos(e) : (() => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left - (S.panX || 0)) / (S.zoom || 1), (e.clientY - r.top - (S.panY || 0)) / (S.zoom || 1)]; })());
    stage.addEventListener("pointerdown", (e) => {
      const L = cur(); if (!objOn || !L || e.button !== 0 || S.space) return;
      const m = metas.get(L.l3d.id); if (!m) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const [x, y] = ptOf(e), hit = pickObject(m.meta.objects, L.l3d.objs, camOf(L), S.w, S.h, x, y);
      if (hit && hit !== objName) { objName = hit; paint(true); }
      objDrag0 = { L, x: e.clientX, y: e.clientY, name: objName, e0: (L.l3d.objs || {})[objName] || {}, how: e.shiftKey ? "lift" : (e.ctrlKey || e.metaKey) ? "turn" : "move", before: E.snapStruct(), moved: false };
      try { stage.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
      E.drawOverlay();
    }, true);
    stage.addEventListener("pointermove", (e) => {
      if (!objDrag0) return; e.stopImmediatePropagation();
      const dx = (e.clientX - objDrag0.x) / (S.zoom || 1), dy = (e.clientY - objDrag0.y) / (S.zoom || 1);
      if (!objDrag0.moved && Math.hypot(dx, dy) < 3) return;
      objDrag0.moved = true;
      objDrag0.e = objDrag(camOf(objDrag0.L), objDrag0.e0, dx, dy, objDrag0.how, S.h);
      E.drawOverlay(); fill(objDrag0.L, metas.get(objDrag0.L.l3d.id));
    }, true);
    const objUp = (e) => {
      if (!objDrag0) return; if (e) e.stopImmediatePropagation();
      const d = objDrag0; objDrag0 = null;
      if (!d.moved || !d.e) { E.drawOverlay(); return; }
      if (!stash || stash.L !== d.L) stash = { L: d.L, before: d.before };
      change(d.L, (l) => { l.objs = setObj(l.objs, d.name, d.e); }, "3D model: " + d.name, true);
    };
    stage.addEventListener("pointerup", objUp, true); stage.addEventListener("pointercancel", objUp, true);

    /* ---- 🖐 dragging the view on the canvas */
    let drag = null;
    stage.addEventListener("pointerdown", (e) => {
      const L = cur(), mid = e.button === 1 && !!L && (e.shiftKey || dragOn);    // 2.494.0: Shift + middle = orbit, middle (🖐 on) = pan
      if (!mid && (!dragOn || !L || e.button !== 0 || S.space)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      drag = { L, x: e.clientX, y: e.clientY, c0: camOf(L), how: mid ? (e.shiftKey ? "orbit" : "pan") : e.shiftKey ? "pan" : (e.ctrlKey || e.metaKey) ? "zoom" : "orbit", before: E.snapStruct() };
      try { stage.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
    }, true);
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return; e.stopImmediatePropagation();
      drag.cam = orbitDrag(drag.c0, (e.clientX - drag.x) / (S.zoom || 1), (e.clientY - drag.y) / (S.zoom || 1), drag.how, S.h);
      E.drawOverlay(); fill(drag.L, metas.get(drag.L.l3d.id));
    }, true);
    const up = (e) => {
      if (!drag) return; if (e) e.stopImmediatePropagation();
      const d = drag; drag = null;
      if (!d.cam) { E.drawOverlay(); return; }
      if (!stash || stash.L !== d.L) stash = { L: d.L, before: d.before };
      change(d.L, (l) => { l.cam = d.cam; }, "3D camera", true);
    };
    stage.addEventListener("pointerup", up, true); stage.addEventListener("pointercancel", up, true);
    stage.addEventListener("wheel", (e) => {
      const L = cur(); if (!dragOn || !L) return;
      e.preventDefault(); e.stopImmediatePropagation();
      change(L, (l) => { l.cam = orbitDrag(camOf(L), 0, e.deltaY > 0 ? 12 : -12, "zoom"); }, "3D camera", false);
    }, { capture: true, passive: false });
    // 2.541.0: the picked object's box while 🖐 Drag the object is on (where it goes while dragging)
    E.overlayHooks.push((g, px) => {
      const L = cur(); if (!L || !objOn) return;
      const m = metas.get(L.l3d.id); if (!m) return;
      const o = editable(m.meta.objects).find((x) => x.name === objName); if (!o) return;
      const b = objBox(o, objDrag0 && objDrag0.e ? objDrag0.e : (L.l3d.objs || {})[objName], drag && drag.cam ? drag.cam : camOf(L), S.w, S.h); if (!b) return;
      g.save(); g.strokeStyle = "#f5792c"; g.lineWidth = 2 * px; g.setLineDash([6 * px, 4 * px]); g.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
      g.setLineDash([]); g.fillStyle = "#f5792c"; g.font = `${11 * px}px sans-serif`; g.fillText(objName, b[0] + 3 * px, Math.max(11 * px, b[1] - 4 * px));
      g.restore();
    });
    // the wire box while the view moves
    E.overlayHooks.push((g, px) => {
      const L = cur(); if (!L) return;
      const m = metas.get(L.l3d.id); if (!m || !(drag || L.l3d.busy || (pend && pend.L === L)) || objOn) return;
      const c = drag && drag.cam ? drag.cam : camOf(L), pts = boxPoints(m.meta.center, m.meta.radius).map((p) => project(c, S.w, S.h, p));
      g.save(); g.strokeStyle = "#2680eb"; g.lineWidth = 1.5 * px; g.setLineDash([5 * px, 4 * px]);
      const E2 = [[0, 1], [0, 2], [1, 3], [2, 3], [4, 5], [4, 6], [5, 7], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      g.beginPath(); for (const [a, b] of E2) { if (!pts[a] || !pts[b]) continue; g.moveTo(pts[a][0], pts[a][1]); g.lineTo(pts[b][0], pts[b][1]); } g.stroke();
      g.restore();
    });

    /* ---- 2.541.0: BLENDER MODE - the prompt docker's Edit / Refine work from the scene rendered by Blender */
    async function editFromScene(L, text, mode, editStyle) {
      if (!is3d(L)) { say("pick a 3D layer first"); return null; }
      const t = String(text || "").trim();
      if (!t && mode === "edit") { say("type in the prompt docker what to make of the Blender scene (e.g. \"a photo of a woman waving in a sunny park\")"); return null; }
      if (L.l3d.busy) { say("the 3D view is still being drawn"); return null; }
      if (S.busy) { say("still working on the last one"); return null; }
      const eng = L.l3d.engine === "WORKBENCH" ? "Quick" : L.l3d.engine;
      status(`🟧 Blender renders the scene ${S.w} x ${S.h} (${eng}) for the ${mode}…`); say(`🟧 Blender renders the scene (${eng}) for the ${mode}…`);
      L.l3d.busy = true;
      let img = null;
      try { const r = await renderImage(L, true, S.w, S.h); img = r.img; if (!img) { status("Blender: " + ((r.st && r.st.error) || "no picture")); say("Blender: " + ((r.st && r.st.error) || "no picture")); return null; } }
      catch (e) { status("3D: " + e.message); say("3D layer: " + e.message); return null; }
      finally { L.l3d.busy = false; paint(); }
      const c = E.newCanvas(S.w, S.h), g = c.getContext("2d");
      if (L.l3d.transparent) { g.fillStyle = "#ffffff"; g.fillRect(0, 0, S.w, S.h); }
      g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, S.w, S.h);
      status(`🟧 the scene rendered - ${mode === "edit" ? "the edit model" : "Refine"} takes it with the prompt…`);
      if (root.H3TestEvent) { try { root.H3TestEvent("ie_blender_edit", mode); } catch (e) { /* the 🧪 list */ } }
      if (S.aiMode !== mode && E.setAiMode) E.setAiMode(mode);
      await E.runAI({ prompt: t, editStyle: editStyle || "", source: c, whole: true, into: false, label: "🟧 " + L.l3d.name + " " + mode });
      return c;
    }

    /* ---- commands */
    const C = E.ui.addCmd;
    C("layer.new3d", "New 3D Layer (Daz / Blender)…", "", newDialog, {}, ["Layer", null, true]);
    C("layer.render3d", "Render 3D Layer", "", () => { const L = cur(); if (!L) return say("pick a 3D layer first"); render(L, { final: true, label: "3D render" }); }, { enabled: () => !!cur() }, ["Layer", "layer.new3d"]);
    // the tab follows the picked layer
    const prevHist = E.ui.history;
    E.ui.history = function () { const r = prevHist ? prevHist.apply(this, arguments) : undefined; try { paint(); } catch (er) { /* fine */ } return r; };
    E.layer3d = { isCurrent: () => !!cur(), current: cur, editFromScene, renderImage, objName: () => objName, pickObj: (n) => { objName = n; paint(true); }, setObjDrag: (v) => { objOn = !!v; if (objOn) dragOn = false; paint(true); },
      openScene, newDialog, render, change, generate, generateWithRefs, rrObjects, camOf, metaOf, paint, dazSend, dazStatus, state: () => ({ dragOn, bone: Object.assign({}, bone), msg }), setDrag: (v) => { dragOn = !!v; paint(true); } };
  }

  const PC3D = { objectsOnPicture, orbitPos, basis, project, orbitDrag, VIEWS, setBone, boxPoints, dazView, setObj, objDrag, objBox, pickObject, editable, install };
  if (typeof module !== "undefined" && module.exports) module.exports = PC3D;
  else root.PC3D = PC3D;
})(typeof window !== "undefined" ? window : globalThis);
