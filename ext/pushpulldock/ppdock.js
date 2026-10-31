/* bitGen Studio — ext/pushpulldock/ppdock.js (2.619.0): THE 📏 PUSHPULL DOCKER (window.H3PushPull) - the bar, the files, undo,
 * the keys, and the model's way into the rest of bitGen.
 *
 * Tim (verbatim): "can we add a final docker, i feel this one will complete bitgen, then just repairs and fixes -
 * https://github.com/ingelibre/ingetrazo - looks like a sketchup made for linux" - picked: our own SketchUp-style docker
 * (IngeTrazo is GPL desktop software; nothing of it is used here - this is written for bitGen).
 *   FILES     the name box + ＋ New / 📂 Open ▾ / 💾 (Ctrl+S): projects/<project>/pushpull/<name>.pp3d (GET / POST / DELETE
 *             /api/pushpull) - saved by itself a moment after every change, with the view
 *   UNDO      ↶ ↷ (Ctrl+Z / Ctrl+Y) - 200 steps
 *   VIEW      Iso / Top / Front / Right / Back / Left, Perspective / Parallel, ⤢ extents (Shift+Z), face styles, ☀ shadows
 *   GROUPS    ▣ Group (G) what is picked; with a group picked ▣ explodes it; double-click a group to edit inside (Esc leaves)
 *   ➜ SEND    🖼 a picture to the image editor · 🎞 a 3D layer on the timeline (sent again: its layers update) · 🏠 the House
 *             builder · 🟠 Blender · 🎮 Unreal - all through the project's 3D models (pp_<name>.glb, POST /api/tlcanvas/model)
 *   ⤓ EXPORT  .glb into the project's 3D models; .glb / .obj / .stl to this computer
 *   ⤒ IMPORT  a project 3D model (.glb / .gltf / .obj / .fbx) as a group (its triangles; flat neighbours drawn without the
 *             line between them)
 *   THE KEYS  over the docker: the tools' letters (pptools.js), Delete, Ctrl+A, G, Shift+Z, Esc; a number typed goes into
 *             the Measurements box (Enter applies it)
 * 2.620.0 (Tim: "add architectural tools like floor, walls,windows, ceiling,roof etc. ... add lights ... when maximized it
 *   takes bitgens full window minus the titlebar, it has it's own file menu. send to image editor button and send to time
 *   line button"): the architecture (pparch.js / pparchview.js / pparchtools.js) is in the model (M.arch) - saved, undone,
 *   sent and exported with it (its lights as glTF lights to Blender / Unreal); 🌙 Night / ⌂ Cut-away; 🖼 → Image editor and
 *   🎞 → Timeline on the bar; ☰ File + the full-window maximize in ppframe.js.
 */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  if (!doc || !$("pushpulldock")) return;
  // the first time it is here it starts HIDDEN (the status bar's 📏 PushPull button shows it) - a new docker does not push the
  // others down for someone who never asked for it; shown / hidden by hand is kept as every docker's (store g.<id>)
  try { if (root.localStorage.getItem("h3.g.pushpulldock") == null) { root.localStorage.setItem("h3.g.pushpulldock", "1"); $("pushpulldock").classList.add("dockgone"); } } catch (e) { /* fine */ }
  const G = () => root.PPGeo, O = () => root.PPOut;
  const PALETTE = ["#d8d2c4", "#f4f4f4", "#c8a882", "#8b5a2b", "#b5523b", "#9aa3ad", "#6b7280", "#3f3f46", "#1f2937", "#7fb3d5", "#a7c7e7", "#5b8c5a", "#8fbc8f", "#e9c46a", "#e76f51", "#264653"];
  const S = { M: null, V: null, T: null, name: "model 1", undo: [], redo: [], sel: { f: [], e: [], k: [] }, group: null, color: "#c8a882", saveT: 0, booted: false, over: false, dirty: false };

  function msg(t) { const m = $("ppMsg"); if (m) m.textContent = t || ""; }
  function info() {
    const el = $("ppInfo"); if (!el || !S.M) return;
    const s = S.sel, M = S.M, nf = (s.f || []).length, ne = (s.e || []).length + (s.k || []).length, np = (s.p || []).length;
    let t = "";
    if (nf) { let a = 0; s.f.forEach((id) => { const F = G().face(M, id); if (F) a += G().faceArea(M, F); }); t = nf + " face" + (nf > 1 ? "s" : "") + " · " + (+a.toFixed(3)) + " m²"; }
    if (ne) t += (t ? " · " : "") + ne + " line" + (ne > 1 ? "s" : "");
    if (np) t += (t ? " · " : "") + np + " corner" + (np > 1 ? "s" : "");
    const grp = nf && M.f.find((F) => F.id === s.f[0]); if (grp && grp.grp && !S.group) { const gg = M.g.find((x) => x.id === grp.grp); if (gg) t = "▣ " + gg.name + " · " + t; }
    const ar = S.T && S.T.arch ? S.T.arch.summary() : "";
    if (!t) t = (M.f.length || !ar ? M.f.length + " faces · " + M.e.length + " lines" + (M.g.length ? " · " + M.g.length + " groups" : "") : "") + (ar ? (M.f.length ? " · " : "") + ar : "");
    el.textContent = t;
    const gb = $("ppGroup"); if (gb) gb.textContent = groupPicked() ? "▣ Explode" : "▣ Group";
  }
  function groupPicked() { const s = S.sel; if (!s.f.length || S.group) return null; const F = G().face(S.M, s.f[0]); return F && F.grp && S.sel.f.every((id) => { const x = G().face(S.M, id); return x && x.grp === F.grp; }) ? F.grp : null; }

  /* ---------------- the model + undo */
  const snapshot = () => JSON.stringify(G().toJson(S.M));
  function setModel(M, keepSel) {
    S.M = M; if (!keepSel) S.sel = { f: [], e: [], k: [] };
    S.sel.f = S.sel.f.filter((id) => G().face(M, id)); S.sel.e = S.sel.e.filter((id) => M.e.some((E) => E.id === id)); S.sel.k = []; S.sel.p = [];
    if (S.group && !M.g.some((g) => g.id === S.group)) enterGroup(null, true);
    if (S.V) { S.V.setModel(M); S.V.setSel(S.sel); }
    info();
  }
  function commit(label, before) {
    if (before != null) { S.undo.push(before); if (S.undo.length > 200) S.undo.shift(); S.redo = []; }
    G().gc(S.M); setModel(S.M, true);
    S.dirty = true; soon();
    test("pp_" + String(label || "edit").split(" ")[0].replace(/\//g, ""), String(S.M.f.length));
  }
  function restore(json) { setModel(G().fromJson(JSON.parse(json)), true); }
  function undo() { if (!S.undo.length) { msg("↶ nothing to undo"); return; } S.redo.push(snapshot()); restore(S.undo.pop()); S.dirty = true; soon(); msg("↶ undone"); }
  function redo() { if (!S.redo.length) { msg("↷ nothing to redo"); return; } S.undo.push(snapshot()); restore(S.redo.pop()); S.dirty = true; soon(); msg("↷ redone"); }
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }

  /* ---------------- files */
  const api = (u, o) => fetch(u, o).then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || r.status); return j; }));
  const nameNow = () => (($("ppName").value || "").trim() || "model 1").replace(/[^\w .()-]+/g, "_").slice(0, 80);
  function save(quiet) {
    if (!S.M) return Promise.resolve(null);
    S.name = nameNow(); clearTimeout(S.saveT);
    return api("/api/pushpull/" + encodeURIComponent(S.name), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: G().toJson(S.M), view: S.V ? S.V.state() : null }) })
      .then((j) => { S.dirty = false; try { root.localStorage.setItem("pp.last", S.name); } catch (e) { /* fine */ } if (!quiet) msg("💾 " + j.name + " saved in the project"); test("pp_saved", j.name); return j; })
      .catch((e) => { msg("not saved: " + e.message); return null; });
  }
  function soon() { clearTimeout(S.saveT); S.saveT = setTimeout(() => save(true), 1500); }
  function open(name) {
    return api("/api/pushpull/" + encodeURIComponent(name)).then((j) => {
      S.name = name; $("ppName").value = name; S.undo = []; S.redo = []; S.group = null; paintGroup();
      setModel(G().fromJson(j.model)); if (S.T && S.T.arch) S.T.arch.setSel(null); if (j.view && S.V) S.V.restore(j.view); else if (S.V) S.V.extents();
      try { root.localStorage.setItem("pp.last", name); } catch (e) { /* fine */ }
      msg("📂 " + name); test("pp_opened", name);
    }).catch((e) => msg("not opened: " + e.message));
  }
  function freshName(list) { let n = 1; const names = new Set((list || []).map((x) => x.name)); while (names.has("model " + n)) n++; return "model " + n; }
  function newModel() {
    if (S.dirty) save(true);
    return api("/api/pushpull").then((j) => {
      S.name = freshName(j.models); $("ppName").value = S.name; S.undo = []; S.redo = []; S.group = null; paintGroup();
      setModel(G().newModel()); if (S.T && S.T.arch) S.T.arch.setSel(null); if (S.V) S.V.view("iso"); msg("＋ a new model - draw a rectangle (R) on the ground, then Push/Pull (P) it");
    });
  }

  /* ---------------- menus */
  function menu(anchor, items) {
    doc.querySelectorAll(".ppmenu").forEach((x) => x.remove());
    const m = doc.createElement("div"); m.className = "ppmenu";
    items.forEach((it) => { const d = doc.createElement("div"); if (it.head) { d.className = "h"; d.textContent = it.head; } else { d.textContent = it.label; d.onclick = () => { m.remove(); it.run(); }; if (it.title) d.title = it.title; } m.appendChild(d); });
    doc.body.appendChild(m);
    const r = anchor.getBoundingClientRect(); m.style.left = Math.min(r.left, root.innerWidth - m.offsetWidth - 8) + "px"; m.style.top = Math.min(r.bottom + 2, root.innerHeight - m.offsetHeight - 8) + "px";
    setTimeout(() => doc.addEventListener("pointerdown", function off(e) { if (!m.contains(e.target)) { m.remove(); doc.removeEventListener("pointerdown", off, true); } }, true), 0);
    return m;
  }
  const anc = (a, id) => (a && a.getBoundingClientRect ? a : $(id) || $("ppFile"));
  function openMenu(at) {
    api("/api/pushpull").then((j) => {
      const L = j.models || [];
      menu(anc(at, "ppFile"), [{ head: L.length ? "The project's models" : "No models in this project yet" }].concat(L.map((x) => ({ label: x.name + "  ·  " + new Date(x.saved).toLocaleString(), run: () => { if (S.dirty) save(true); open(x.name); } })))
        .concat(L.some((x) => x.name === nameNow()) ? [{ head: "This model" }, { label: "🗑 Delete \"" + nameNow() + "\" (to the recycle bin)", run: () => api("/api/pushpull/" + encodeURIComponent(nameNow()), { method: "DELETE" }).then(() => { msg("🗑 " + nameNow() + " deleted"); newModel(); }).catch((e) => msg(e.message)) }] : []));
    }).catch((e) => msg(e.message));
  }

  /* ---------------- the model out: .glb / .obj / .stl, the project's 3D models, the other dockers */
  function meshes() { return O().meshes(S.M, (F) => S.V.tri(F)).concat(S.A ? S.A.exportMeshes() : []); }
  const lightsOut = () => (S.A ? S.A.exportLights() : []);
  function need() { if (!S.M || (!S.M.f.length && !(S.M.arch && root.PPArch && root.PPArch.has(S.M.arch)))) throw new Error("the model is empty - draw a rectangle (R) and Push/Pull (P) it, or a room (U)"); }
  function toProject(ext, o) {
    need();
    const stem = "pp_" + nameNow().replace(/[^\w-]+/g, "_"), list = meshes();
    let body = null, name = stem + "." + (ext || "glb");
    if (!ext || ext === "glb") body = new Blob([O().glb(list, nameNow(), o && o.lights ? lightsOut() : null)], { type: "model/gltf-binary" });
    else if (ext === "obj") { const o = O().obj(list, stem); return post(stem + ".mtl", new Blob([o.mtl])).then(() => post(name, new Blob([o.obj]))); }
    return post(name, body);
    function post(n, b) { return fetch("/api/tlcanvas/model?name=" + encodeURIComponent(n), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: b }).then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || r.status); return j.name || n; })); }
  }
  function download(name, data, type) { const u = URL.createObjectURL(new Blob([data], { type: type || "application/octet-stream" })); const a = doc.createElement("a"); a.href = u; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000); }
  function showDock(id, btn) {
    const d = $(id); if (!d) return false;
    try { if (d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone(id, btn); if (d.classList.contains("collapsed") && typeof root.toggleCollapse === "function") root.toggleCollapse(id); } catch (e) { /* fine */ }
    return true;
  }
  const guard = (what, fn) => { try { return Promise.resolve(fn()).catch((e) => msg(what + ": " + (e.message || e))); } catch (e) { msg(what + ": " + (e.message || e)); return Promise.resolve(); } };
  function sendMenu(at) {
    menu(anc(at, "ppSend"), [
      { head: "Send the model" },
      { label: "🖼 A picture → the image editor", title: "The view as it is now (no grid / axes), the size of the editor's picture (else 1920 × 1080)", run: () => guard("→ Image editor", toEditor) },
      { label: "🖼 A picture with a clear background → the image editor", run: () => guard("→ Image editor", () => toEditor(true)) },
      { label: "🎞 A 3D layer → the timeline", run: () => guard("→ Timeline", toTimeline) },
      { label: "🏠 → the House builder", run: () => guard("→ House builder", toHouse) },
      { label: "🟠 → Blender (its own window) - with the lights", run: () => guard("→ Blender", () => toProject("glb", { lights: true }).then((saved) => api("/api/blender/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: saved }) }).then(() => msg("Blender is opening with " + saved)))) },
      { label: "🎮 → Unreal (the open project) - with the lights", run: () => guard("→ Unreal", () => toProject("glb", { lights: true }).then((saved) => { msg("importing " + saved + " into Unreal…"); return api("/api/unreal/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: saved }) }).then((j) => msg(saved + " → Unreal: " + ((j.assets || [])[0] || "imported"))); })) },
    ]);
  }
  function toEditor(clear) {
    need();
    if (!showDock("imageeditdock", "tIE")) throw new Error("the image editor is not installed (its extension)");
    if (typeof root.mountImageEditor === "function") try { root.mountImageEditor(); } catch (e) { /* fine */ }
    const E = root.imageEditorInstance && root.imageEditorInstance.E; if (!E) throw new Error("the image editor did not start");
    const w = E.S && E.S.w ? E.S.w : 1920, h = E.S && E.S.h ? E.S.h : 1080;
    S.V.setSel({ f: [], e: [], k: [] });
    const c = S.V.shot(w, h, { clean: true, transparent: !!clear }); S.V.setSel(S.sel);
    return new Promise((ok) => c.toBlob(ok, "image/png")).then((blob) => {
      const url = URL.createObjectURL(blob);
      return Promise.resolve(E.load(url, "📏 " + nameNow(), true)).then(() => { setTimeout(() => URL.revokeObjectURL(url), 60000); msg("🖼 " + nameNow() + " → the image editor (" + w + " × " + h + ")"); test("pp_to_editor", w + "x" + h); });
    });
  }
  function toTimeline() {
    return toProject().then((saved) => {
      const n = root.TlBody && root.TlBody.reload ? root.TlBody.reload(saved) : 0;
      if (n) { msg(saved + " sent again - " + n + " 3D layer(s) on the timeline updated"); return; }
      showDock("timelinedock", "tTL");
      if (!root.TlM3D || !root.TlM3D.add) throw new Error("the model is in the project's 3D models (" + saved + ") - open the timeline docker to place it");
      root.TlM3D.add("model", saved, { x: 0, y: 0 }); msg(saved + " → the timeline: a 3D layer at the playhead"); test("pp_to_timeline", saved);
    });
  }
  function toHouse() {
    if (!root.H3House || !root.H3House.addModel) throw new Error("the House builder is not loaded");
    return toProject().then((saved) => { try { root.H3House.show(true); } catch (e) { /* fine */ } return root.H3House.addModel(saved).then((it) => msg(saved + " → the House builder (" + it.w + " × " + it.d + " × " + it.h + " m)")); });
  }
  function exportMenu(at) {
    menu(anc(at, "ppExport"), [
      { head: "Into the project's 3D models" },
      { label: ".glb (the timeline, Blender, Unreal, the House builder)", run: () => guard("Export", () => toProject("glb").then((n) => msg("⤓ " + n + " in the project's 3D models"))) },
      { label: ".glb with the lights (glTF lights - Blender, Unreal, other 3D apps)", run: () => guard("Export", () => toProject("glb", { lights: true }).then((n) => msg("⤓ " + n + " (with " + lightsOut().length + " lights) in the project's 3D models"))) },
      { label: ".obj + .mtl", run: () => guard("Export", () => toProject("obj").then((n) => msg("⤓ " + n + " in the project's 3D models"))) },
      { head: "To this computer" },
      { label: ".glb (with the lights)", run: () => guard("Export", () => { need(); download("pp_" + nameNow() + ".glb", O().glb(meshes(), nameNow(), lightsOut()), "model/gltf-binary"); }) },
      { label: ".obj (+ .mtl)", run: () => guard("Export", () => { need(); const o = O().obj(meshes(), "pp_" + nameNow()); download("pp_" + nameNow() + ".obj", o.obj, "text/plain"); download("pp_" + nameNow().replace(/[^\w-]+/g, "_") + ".mtl", o.mtl, "text/plain"); }) },
      { label: ".stl (millimetres - 3D printing)", run: () => guard("Export", () => { need(); download("pp_" + nameNow() + ".stl", O().stl(meshes(), nameNow()), "model/stl"); }) },
    ]);
  }
  function importMenu(at) {
    api("/api/tlcanvas/models").then((j) => {
      const L = (j.models || []).filter((x) => /\.(glb|gltf|obj|fbx)$/i.test(x.name));
      menu(anc(at, "ppImport"), [{ head: L.length ? "The project's 3D models" : "No 3D models in this project" }].concat(L.map((x) => ({ label: x.name, run: () => guard("Import", () => importModel(x.name)) }))));
    }).catch((e) => msg(e.message));
  }
  async function importModel(name, blobUrl) {
    const T = S.V.T, url = blobUrl || "/api/tlcanvas/model/" + encodeURIComponent(name);
    msg("reading " + name + "…");
    const obj = await new Promise((ok, no) => {
      const ext = name.split(".").pop().toLowerCase();
      const L = ext === "obj" ? new T.OBJLoader() : ext === "fbx" && T.FBXLoader ? new T.FBXLoader() : new T.GLTFLoader();
      L.load(url, (r) => ok(r.scene || r), undefined, (e) => no(new Error("that model did not load" + (e && e.message ? ": " + e.message : ""))));
    });
    obj.updateMatrixWorld(true);
    const tris = [];
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, pos = geo.attributes.position; if (!pos) return;
      const col = o.material && o.material.color ? "#" + o.material.color.getHexString() : null, v = new T.Vector3();
      for (let i = 0; i + 2 < pos.count; i += 3) {
        const t = [0, 1, 2].map((k) => { v.fromBufferAttribute(pos, i + k).applyMatrix4(o.matrixWorld); return [v.x, -v.z, v.y]; });   // Y up -> Z up
        tris.push({ t, col });
      }
    });
    if (!tris.length) throw new Error("no triangles in " + name);
    if (tris.length > 40000) throw new Error(name + " has " + tris.length + " triangles - 40 000 at most here");
    // sat on the ground, beside what is there
    const b0 = S.M.v.length ? G().bbox(S.M) : null;
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    tris.forEach((x) => x.t.forEach((p) => { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } }));
    const shift = [b0 ? b0.max[0] + 1 - mn[0] : -(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2]];
    const before = snapshot(), gid = G().group(S.M, {}, name.replace(/\.[^.]+$/, ""));
    const grpRec = S.M.g.find((x) => x.id === gid); if (grpRec) grpRec.soft = true;
    let n = 0;
    tris.forEach((x) => {
      const P = x.t.map((p) => [p[0] + shift[0], p[1] + shift[1], p[2] + shift[2]]);
      const F = addTri(P, gid, x.col); if (F) n++;
    });
    commit("import", before);
    msg("⤒ " + name + " - " + n + " faces as the group \"" + name.replace(/\.[^.]+$/, "") + "\" (double-click it to edit inside)");
    S.V.extents();
  }
  /** a triangle straight in (no host search - imports are big) */
  function addTri(P, gid, col) {
    const g = G(), n = g.newell(P); if (g.v3.len(n) < 1e-12) return null;
    const loop = P.map((p) => g.vAt(S.M, p));
    if (new Set(loop).size < 3) return null;
    const F = { id: S.M.n++, loops: [loop], mat: col && /^#[0-9a-f]{6}$/i.test(col) ? col : null, grp: gid };
    S.M.f.push(F); return F;
  }

  /* ---------------- groups */
  function paintGroup() {
    const el = $("ppGrp"); if (!el) return;
    const gg = S.group && S.M && S.M.g.find((x) => x.id === S.group);
    el.style.display = gg ? "block" : "none"; el.textContent = gg ? "▣ editing \"" + gg.name + "\" - Esc leaves it" : "";
  }
  function enterGroup(gid, quiet) {
    S.group = gid || null; S.sel = { f: [], e: [], k: [] };
    if (S.V) { S.V.setGroup(S.group); S.V.setSel(S.sel); }
    paintGroup(); info();
    if (!quiet) msg(gid ? "▣ editing inside the group - its faces only; Esc (or a click outside it) leaves" : "▣ out of the group");
  }
  function groupBtn() {
    const g0 = groupPicked();
    if (g0) { const before = snapshot(); G().explode(S.M, g0); commit("explode", before); msg("▣ exploded - its faces are loose again"); return; }
    if (!S.sel.f.length && !S.sel.e.length) { msg("▣ pick faces / lines first (Select), then G"); return; }
    const before = snapshot(), id = G().group(S.M, S.sel, "Group " + (S.M.g.length + 1));
    if (S.group) { /* a group inside the group being edited: kept flat (one level) */ }
    commit("group", before); msg("▣ a group - picked as one; double-click it to edit inside"); void id;
  }
  function erase() {
    const s = S.sel; if (!s.f.length && !s.e.length && !s.k.length) return;
    const before = snapshot(), n = G().remove(S.M, { f: s.f, e: s.e, edgeKeys: s.k });
    S.sel = { f: [], e: [], k: [] }; commit("erase", before); msg("⌫ erased " + n);
  }

  /* ---------------- the docker comes up */
  function toolbar() {
    const box = $("ppTools"); if (!box || box.children.length) return;
    const AT = root.PPArchTools;
    const one = ([id, icon, label, key], hint) => {
      const b = doc.createElement("button"); b.type = "button"; b.className = "ghost"; b.id = "ppT_" + id; b.textContent = icon;
      b.title = label + " (" + (key === " " ? "Space" : key.toUpperCase()) + ") - " + hint; b.setAttribute("aria-label", label);
      b.onclick = () => { S.T.use(id); S.V.canvas.focus({ preventScroll: true }); };
      box.appendChild(b);
    };
    root.PPTools.TOOLS.forEach((t) => one(t, root.PPTools.HINT[t[0]]));
    if (AT && S.A) { const sep = doc.createElement("div"); sep.className = "pptsep"; sep.textContent = "Build"; box.appendChild(sep); AT.TOOLS.forEach((t) => one(t, AT.HINT[t[0]])); }
    const sw = $("ppSw");
    PALETTE.forEach((c) => { const b = doc.createElement("button"); b.type = "button"; b.style.background = c; b.title = c; b.dataset.c = c; b.onclick = () => setColor(c); sw.appendChild(b); });
    paintSw();
  }
  function setColor(c) { S.color = c; $("ppCol").value = c; paintSw(); if (S.T && S.T.name() !== "paint") S.T.use("paint"); }
  function paintSw() { doc.querySelectorAll("#ppSw button").forEach((b) => b.classList.toggle("on", b.dataset.c === S.color)); }
  function visible() { const v = $("ppView"); return !!(v && v.offsetParent !== null && v.clientWidth > 20 && v.clientHeight > 20); }
  async function boot() {
    if (S.booted || !visible()) return;
    S.booted = true;
    try {
      S.V = await root.PPView.create($("ppView"));
    } catch (e) { S.booted = false; $("ppLoad").textContent = "the 3D view did not start: " + (e.message || e); return; }
    $("ppLoad").remove();
    try { S.A = await root.PPArchView.attach(S.V); S.V.after = () => S.A.rebuild(); S.V.extraBox = () => S.A.box(); }
    catch (e) { S.A = null; msg("the architecture tools did not start: " + (e.message || e)); }
    S.M = G().newModel(); S.V.setModel(S.M);
    S.T = root.PPTools.create({
      V: S.V, model: () => S.M, sel: () => S.sel, setSel: (s) => { S.sel = Object.assign({ f: [], e: [], k: [], p: [] }, s); S.V.setSel(S.sel); info(); if (S.T && S.T.arch && !S.T.arch.sel()) S.T.arch.props(); },
      group: () => S.group, enterGroup, status: msg, vcbLabel: (t) => { $("ppVcbL").textContent = t || "Measurements"; }, vcbValue: (t) => { if (doc.activeElement !== $("ppVcb")) $("ppVcb").value = t || ""; },
      snapshot, commit, restore, redraw: () => { S.V.rebuild(); }, color: () => S.color, setColor, erase,
      toolChanged: (n) => { doc.querySelectorAll("#ppTools button").forEach((b) => b.classList.toggle("on", b.id === "ppT_" + n)); },
      archView: S.A ? () => S.A : null, onSel: () => info(), resized: () => { if (S.V) S.V.size(); },
    });
    toolbar(); S.T.use("select");
    const cv = S.V.canvas;
    cv.addEventListener("pointerdown", (e) => { cv.focus({ preventScroll: true }); if (e.button === 0) { try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } S.T.down(e); } });
    cv.addEventListener("pointermove", (e) => S.T.move(e));
    cv.addEventListener("pointerup", (e) => S.T.up(e));
    cv.addEventListener("dblclick", (e) => S.T.dbl(e));
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    $("pushpulldock").addEventListener("pointerenter", () => { S.over = true; });
    $("pushpulldock").addEventListener("pointerleave", () => { S.over = false; });
    let last = null; try { last = root.localStorage.getItem("pp.last"); } catch (e) { last = null; }
    const L = await api("/api/pushpull").catch(() => ({ models: [] }));
    if (last && (L.models || []).some((x) => x.name === last)) await open(last);
    else if ((L.models || []).length) await open(L.models[0].name);
    else { S.name = freshName([]); $("ppName").value = S.name; msg("draw a rectangle (R) on the ground, then Push/Pull (P) it up - type exact sizes any time (the box on the right)"); }
    test("pp_ready", "1");
  }
  function wire() {
    $("ppSave").onclick = () => save(false);
    $("ppToIE").onclick = () => guard("→ Image editor", () => toEditor(false));
    $("ppToTL").onclick = () => guard("→ Timeline", toTimeline);
    $("ppNight").onclick = () => { if (!S.A) return; S.A.setNight(!S.A.isNight); $("ppNight").classList.toggle("on", S.A.isNight); $("ppNight").textContent = S.A.isNight ? "☀ Day" : "🌙 Night"; msg(S.A.isNight ? "🌙 night - the rooms' lights light them (💡 X puts lights in)" : "☀ day"); };
    $("ppCut").onclick = () => { if (!S.A) return; S.A.cut(!S.A.cutaway); $("ppCut").classList.toggle("on", S.A.cutaway); msg(S.A.cutaway ? "⌂ cut-away - roofs and ceilings hidden" : "⌂ roofs and ceilings back"); };
    $("ppUndo").onclick = undo; $("ppRedo").onclick = redo;
    $("ppViewSel").onchange = (e) => { if (e.target.value && S.V) S.V.view(e.target.value); e.target.value = ""; };
    $("ppOrtho").onclick = () => { if (!S.V) return; S.V.ortho(!S.V.isOrtho); $("ppOrtho").textContent = S.V.isOrtho ? "⬛ Parallel" : "⬛ Persp"; };
    $("ppExt").onclick = () => S.V && S.V.extents();
    $("ppStyle").onchange = (e) => S.V && S.V.style(e.target.value);
    $("ppShadow").onchange = (e) => S.V && S.V.shadows(e.target.checked);
    $("ppGroup").onclick = () => S.M && groupBtn();
    $("ppSend").onclick = () => sendMenu(); $("ppExport").onclick = () => exportMenu(); $("ppImport").onclick = () => S.V && importMenu();
    $("ppCol").oninput = (e) => setColor(e.target.value);
    $("ppName").addEventListener("change", () => { const was = S.name; S.name = nameNow(); if (S.name !== was && S.M) save(false); });
    $("ppVcb").addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); if (S.T && S.T.vcb($("ppVcb").value)) { $("ppVcb").value = ""; S.V.canvas.focus({ preventScroll: true }); } }
      if (e.key === "Escape") { $("ppVcb").value = ""; S.V.canvas.focus({ preventScroll: true }); }
    });
    // the keys, over the docker (not while typing in its name box)
    doc.addEventListener("keydown", (e) => {
      if (!S.T || !S.booted) return;
      const a = doc.activeElement, inDock = a && a.closest && a.closest("#pushpulldock");
      if (!(S.over || inDock || $("pushpulldock").matches(":hover"))) return;
      if (a && a !== S.V.canvas && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if (doc.querySelector("dialog[open]")) return;
      const k = e.key, ctl = e.ctrlKey || e.metaKey;
      const done = () => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
      if (ctl && (k === "z" || k === "Z")) { done(); if (e.shiftKey) redo(); else undo(); return; }
      if (ctl && (k === "y" || k === "Y")) { done(); redo(); return; }
      if (ctl && (k === "s" || k === "S")) { done(); save(false); return; }
      if (ctl && (k === "a" || k === "A")) { done(); const s = { f: S.M.f.filter((F) => !S.group || F.grp === S.group).map((F) => F.id), e: S.M.e.filter((E) => !S.group || E.grp === S.group).map((E) => E.id), k: [] }; S.sel = s; S.V.setSel(s); info(); return; }
      if (!ctl && k === "Z" && e.shiftKey) { done(); S.V.extents(); return; }
      if (!ctl && (k === "g" || k === "G") && !e.altKey) { done(); groupBtn(); return; }
      // a number (or a unit) typed with a tool going: into the Measurements box
      if (!ctl && !e.altKey && /^[0-9.,\-;'"]$/.test(k)) { done(); const v = $("ppVcb"); v.value = k; v.focus({ preventScroll: true }); return; }
      if (S.T.key(e)) done();
      else if (k === " " && (a === S.V.canvas || !inDock)) e.preventDefault();      // Space never scrolls the page under the docker
    }, true);
    doc.addEventListener("keyup", (e) => { if (S.T) S.T.keyUp(e); }, true);
    setInterval(() => { if (!S.booted) boot(); }, 700);
    root.addEventListener("beforeunload", () => { if (S.dirty && S.M) { try { navigator.sendBeacon("/api/pushpull/" + encodeURIComponent(nameNow()), new Blob([JSON.stringify({ model: G().toJson(S.M), view: S.V ? S.V.state() : null })], { type: "application/json" })); } catch (e) { /* fine */ } } });
  }
  wire();
  root.H3PushPull = { state: S, open, save, newModel, undo, redo, toProject, toTimeline, toEditor, importModel, enterGroup, erase, tool: (n) => S.T && S.T.use(n), boot, setColor,
    menu, msg, api, nameNow, openMenu, exportMenu, importMenu, sendMenu, guard, info, download, meshes, lightsOut };
})(typeof window !== "undefined" ? window : globalThis);
