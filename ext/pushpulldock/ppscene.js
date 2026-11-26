/* bitGen Studio — ext/pushpulldock/ppscene.js (2.975.0): 🧱 PICTURE → 3D SCENE in the Sketcher (window.H3PicScene).
 * Tim: "is this worth adding to sketcher docker https://github.com/neilsonnn/image-blaster" -> "yes, please do 1-5".
 * One picture in (the gallery, or one from this computer) -> the server (lib/picScene.js, routes/picScene.js) finds its
 * objects, cuts each out + makes the clean plate (Qwen Image 2.1 edit), grows the plate into the 360° surroundings (the
 * 360 outpaint LoRA), makes a 3D model per object (Hunyuan3D 2.1 / TRELLIS.2), a sound for the place + each object (Stable
 * Audio Open 1.0) and puts it all in one scene .glb in the project's 3D models. Here: the dialog, the steps as they go, then
 *   ⤒ Open in the Sketcher   the scene's objects as a group (the panorama sphere left out - it is the view, not a shape)
 *   👁 Look round in 3D       the .glb with the surroundings round you (three.js, drag to look, wheel to step back)
 *   ▶ the sounds              the ambience + each object's effect
 *   ⤓ Download                the .glb (Blender, Unity, Unreal, Godot open it)
 *   🌍 Walk-in world          (5b) the panorama -> a layered 3D world (HunyuanWorld 1.0 - Settings ▸ Add-ons; not installed =
 *                             H3Addons.act("hyworld", "install"): its Install / Cancel box with the size and the licence)
 * Before it starts: the edit style's models (H3ModelsFound.ensure), then the sound models (GET /api/picscene/needs ->
 * H3ModelsFound.box: ⬇ Download / Cancel - Cancel = this scene without sounds).
 * Pure: stateIcon, lensOf (Node: scripts/test-975.js reads the source; the browser leg is test-ui975-ui.js). */
(function (root) {
  "use strict";
  const doc = root.document;
  const $ = (id) => doc && doc.getElementById(id);
  const ICON = { wait: "○", run: "◐", done: "✔", fail: "✖", skip: "–" };
  const STEP_NAME = { find: "1 · Find the objects (the Vision model)", cut: "2 · Cut them out + the clean plate (Qwen Image 2.1 edit)", pano: "3 · The 360° surroundings (the 360 outpaint LoRA)",
    mesh: "4 · A 3D model each (Hunyuan3D 2.1 / TRELLIS.2)", sound: "5 · The sounds (Stable Audio Open 1.0)", scene: "6 · The scene .glb",
    world: "7 · 🌍 The walk-in world (HunyuanWorld 1.0 add-on)" };
  const LENS = [{ id: "65", label: "Phone / normal (65°)" }, { id: "80", label: "Wide (80°)" }, { id: "100", label: "Very wide (100°)" }, { id: "40", label: "Zoomed in (40°)" }];
  const SFX_FILES = [{ name: "stable-audio-open-1.0.safetensors", cat: "checkpoints" }, { name: "t5_base.safetensors", cat: "text_encoders" }];
  function stateIcon(s) { return ICON[s] || "○"; }
  function lensOf(id) { return (LENS.find((l) => l.id === String(id)) || LENS[0]).id; }
  const pure = { stateIcon, lensOf, LENS, STEP_NAME, SFX_FILES };
  if (!doc) { if (typeof module !== "undefined") module.exports = pure; return; }

  const LS = { get: (k, d) => { try { const v = root.localStorage.getItem("h3.picscene." + k); return v == null ? d : v; } catch (e) { return d; } },
    set: (k, v) => { try { root.localStorage.setItem("h3.picscene." + k, String(v)); } catch (e) { /* private mode */ } } };
  const st = { pick: null, picker: null, id: null, timer: 0, scene: null, view: null };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  async function jget(u) { const r = await fetch(u); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; }
  const fileUrl = (f) => "/api/picscene/" + encodeURIComponent(st.id) + "/file?f=" + encodeURIComponent(f);
  function say(t) { const m = $("pscMsg"); if (m) m.textContent = t || ""; }

  function css() {
    if ($("pscCss")) return;
    const s = doc.createElement("style"); s.id = "pscCss";
    s.textContent = "#pscDlg{padding:0;border:1px solid var(--line,#3a352d);border-radius:8px;background:var(--panel,#1b1915);color:var(--fg,#e8e2d4);width:min(980px,96vw);max-height:94vh}"
      + "#pscDlg .psc{display:flex;flex-direction:column;max-height:94vh}.psc-bar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line,#3a352d);cursor:move}"
      + ".psc-bar b{font-size:13px;flex:1}.psc-body{display:flex;gap:10px;padding:10px;min-height:0;overflow:auto;font-size:12px}"
      + ".psc-side{width:300px;flex:none;display:flex;flex-direction:column;gap:6px}.psc-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}"
      + ".psc-pics{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;max-height:220px;overflow:auto;border:1px solid var(--line,#3a352d);border-radius:5px;padding:4px}"
      + ".psc-pics img{width:100%;aspect-ratio:16/10;object-fit:cover;border:2px solid transparent;border-radius:4px;cursor:pointer;background:#000}.psc-pics img.sel{border-color:#38e1ff}"
      + ".psc-row{display:flex;gap:6px;align-items:center}.psc-row>span{width:96px;flex:none;opacity:.85}.psc-row select,.psc-row input[type=number]{flex:1;min-width:0}"
      + ".psc-steps{display:flex;flex-direction:column;gap:3px}.psc-step{display:flex;gap:6px;align-items:baseline}.psc-step i{font-style:normal;width:14px;text-align:center}"
      + ".psc-step.run i{color:#38e1ff}.psc-step.done i{color:#7bd389}.psc-step.fail i{color:#ff6b6b}.psc-step small{opacity:.7;margin-left:4px}"
      + ".psc-objs{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}.psc-obj{border:1px solid var(--line,#3a352d);border-radius:5px;padding:4px;display:flex;flex-direction:column;gap:3px}"
      + ".psc-obj img{width:100%;aspect-ratio:1;object-fit:contain;background:#fff;border-radius:3px}.psc-obj b{font-size:11px}.psc-pano{width:100%;aspect-ratio:2;object-fit:cover;border-radius:4px;background:#000}"
      + ".psc-foot{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--line,#3a352d);flex-wrap:wrap}.psc-foot .hint{flex:1;opacity:.8}"
      + "#pscView{width:100%;height:min(56vh,520px);background:#000;border-radius:5px;display:none}.psc-note{opacity:.7;font-size:11px}";
    doc.head.appendChild(s);
  }
  function ensure() {
    let d = $("pscDlg"); if (d) return d;
    css();
    d = doc.createElement("dialog"); d.id = "pscDlg"; d.setAttribute("aria-label", "Picture to 3D scene");
    d.innerHTML = '<div class="psc">'
      + '<div class="psc-bar" data-dlg-drag title="Drag to move"><b>🧱 Picture → 3D scene</b><button type="button" class="ghost" id="pscX" title="Close (Esc) - a scene being made keeps going">✕</button></div>'
      + '<div class="psc-body"><div class="psc-side">'
      + '<div class="psc-row"><span>The picture</span></div><div id="pscPicker"></div>'
      + '<label class="psc-row"><span>Objects (at most)</span><input type="number" id="pscMax" min="1" max="8" step="1"></label>'
      + '<label class="psc-row"><span>The lens</span><select id="pscLens">' + LENS.map((l) => '<option value="' + l.id + '">' + esc(l.label) + "</option>").join("") + "</select></label>"
      + '<label class="psc-row"><span>3D engine</span><select id="pscEngine"><option value="auto">Auto</option><option value="hunyuan">Hunyuan3D 2.1 (shape)</option><option value="trellis">TRELLIS.2 (shape + colours)</option></select></label>'
      + '<label class="psc-row"><input type="checkbox" id="pscPano"> The 360° surroundings round the camera</label>'
      + '<label class="psc-row"><input type="checkbox" id="pscSound"> Sounds - the place + each object</label>'
      + '<label class="psc-row" title="HunyuanWorld 1.0 (Settings ▸ Add-ons): the panorama becomes a layered 3D world you can walk into - 24 GB of graphics memory, not for use in the EU / UK / South Korea, FLUX.1 Fill is non-commercial"><input type="checkbox" id="pscWorld"> 🌍 Walk-in world too (an add-on)</label>'
      + '<p class="psc-note">Everything runs on this computer, one job after another in the job list - a few minutes a model. Models: Qwen Image 2.1 edit + the 360 outpaint LoRA (Qwen Research License - non-commercial), Hunyuan3D 2.1 / TRELLIS.2 (their own licences), Stable Audio Open 1.0 (Stability AI Community License - free under US$1M a year).</p>'
      + '<div class="psc-row"><span>Made before</span><select id="pscOld"><option value="">…</option></select></div>'
      + '</div><div class="psc-main">'
      + '<div class="psc-steps" id="pscSteps"></div>'
      + '<img class="psc-pano" id="pscPanoImg" alt="The 360° surroundings" hidden>'
      + '<div class="psc-objs" id="pscObjs"></div>'
      + '<div id="pscSounds" class="psc-row" style="flex-wrap:wrap"></div>'
      + '<canvas id="pscView" aria-label="The scene in 3D - drag to look round, the wheel to step back"></canvas>'
      + "</div></div>"
      + '<div class="psc-foot"><span class="hint" id="pscMsg" role="status"></span>'
      + '<button type="button" class="ghost" id="pscStop" hidden>■ Stop</button>'
      + '<button type="button" class="ghost" id="pscOpen" hidden title="The scene\'s objects into this Sketcher model as a group (the panorama stays out)">⤒ Open in the Sketcher</button>'
      + '<button type="button" class="ghost" id="pscLook" hidden title="The scene with its surroundings round you - drag to look round, the wheel to step back">👁 Look round in 3D</button>'
      + '<a class="ghost gbtn" id="pscDl" hidden download>⤓ Download .glb</a>'
      + '<button type="button" class="ghost" id="pscWorldGo" hidden title="🌍 The panorama -> a layered 3D world you can walk into (HunyuanWorld 1.0 add-on)">🌍 Walk-in world</button>'
      + '<button type="button" class="ghost" id="pscWorldLook" hidden title="Walk round the world (drag to look, the wheel to move)">👁 The world</button>'
      + '<a class="ghost gbtn" id="pscWorldDl" hidden download>⤓ World .glb</a>'
      + '<button type="button" class="ghost" id="pscRetry" hidden title="Carry on from the step that failed - what was made is kept (download a missing model first)">↻ Try again</button>'
      + '<button type="button" class="primary" id="pscGo">🧱 Make the scene</button></div></div>';
    doc.body.appendChild(d);
    $("pscX").onclick = () => close();
    d.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    $("pscMax").value = LS.get("max", "5"); $("pscLens").value = lensOf(LS.get("lens", "65")); $("pscEngine").value = LS.get("engine", "auto");
    $("pscPano").checked = LS.get("pano", "1") === "1"; $("pscSound").checked = LS.get("sound", "1") === "1"; $("pscWorld").checked = LS.get("world", "0") === "1";
    st.picker = root.H3PicPick ? root.H3PicPick.mount($("pscPicker"), { title: "The picture", onPick: (it) => { st.pick = it; say("🖼 " + it.name); } }) : null;
    $("pscGo").onclick = () => start();
    $("pscStop").onclick = () => { if (st.id) fetch("/api/picscene/" + encodeURIComponent(st.id) + "/cancel", { method: "POST" }).then(() => say("■ stopping after the job that is running…")); };
    $("pscOpen").onclick = () => toSketcher();
    $("pscRetry").onclick = () => retryIt();
    $("pscLook").onclick = () => look();
    $("pscWorldLook").onclick = () => look(true);
    $("pscWorldGo").onclick = () => worldGo();
    $("pscOld").onchange = () => { const v = $("pscOld").value; if (v) follow(v); };
    return d;
  }
  function close() { const d = $("pscDlg"); if (d && d.open) d.close(); clearTimeout(st.timer); stopView(); }
  async function oldScenes() {
    const s = $("pscOld"); if (!s) return;
    try { const j = await jget("/api/picscene"); s.innerHTML = '<option value="">' + ((j.scenes || []).length ? "…" : "(none yet)") + "</option>" + (j.scenes || []).map((x) => '<option value="' + esc(x.id) + '">' + esc(x.name + " - " + x.status + " (" + x.objects + ")") + "</option>").join(""); } catch (e) { /* fine */ }
  }
  function open() {
    const d = ensure(); if (!d.open) d.showModal();
    if (st.picker) st.picker.refresh(); oldScenes();
    if (st.id) follow(st.id);
  }

  /* ---- start: the models first, then the run ---- */
  async function start() {
    const pk = st.pick;
    if (!pk) { say("pick a picture first - 🖼 Gallery, 🗂 Assets, 📌 References, 📁 a folder or 📄 a file"); return; }
    const o = { max: Math.max(1, Math.min(8, +$("pscMax").value || 5)), hfov: +$("pscLens").value || 65, engine: $("pscEngine").value, pano: $("pscPano").checked, sound: $("pscSound").checked, world: $("pscWorld").checked };
    LS.set("max", o.max); LS.set("lens", o.hfov); LS.set("engine", o.engine); LS.set("pano", o.pano ? "1" : "0"); LS.set("sound", o.sound ? "1" : "0"); LS.set("world", o.world ? "1" : "0");
    if (o.world && o.pano && !(await worldReady())) o.world = false;
    const MF = root.H3ModelsFound;
    if (MF) {
      // 2.978.0 (Tim: "if the models are not on the local drive then download all missing models before starting the job"):
      // ONE check - the edit style, the 360 LoRA, the 3D engine, the sound models - the Download box gets them all, then it runs
      say("checking every model the run needs…");
      let info = null; try { info = await jget("/api/pano360"); } catch (e) { info = null; }
      if (!info || !info.style_id) { say("⚠ the Qwen Image 2.1 edit style is not there - Settings ▸ Styles ▸ restore the starter styles"); return; }
      let need = null; try { need = await jget("/api/picscene/needs?engine=" + encodeURIComponent(o.engine) + "&sound=" + (o.sound ? "1" : "0")); } catch (e) { need = null; }
      const req = { kind: "image", style_id: info.style_id, extra_loras: o.pano && info.lora ? [{ path: info.lora, weight: info.lora_weight }] : [], files: (need && need.files) || [], from: "Picture → 3D scene" };
      if (!(await MF.ensure(req))) { say("not started - models are missing (⬇ Download them, then 🧱 Make the scene)"); return; }
    }
    try {
      let r;
      if (!pk.where) {
        const blob = pk.blob || await fetch(pk.url).then((x) => x.blob());
        const q = new URLSearchParams({ name: pk.name, max: o.max, hfov: o.hfov, engine: o.engine, pano: o.pano ? "1" : "0", sound: o.sound ? "1" : "0", world: o.world ? "1" : "0" });
        r = await fetch("/api/picscene?" + q, { method: "POST", headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob });
      } else r = await fetch("/api/picscene", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ name: pk.name, where: pk.where }, o)) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText);
      follow(j.id, j);
    } catch (e) { say("⚠ " + e.message); }
  }
  function follow(id, first) {
    clearTimeout(st.timer); st.id = id; stopView();
    const tick = async () => {
      let s = first; first = null;
      if (!s) { try { s = await jget("/api/picscene/" + encodeURIComponent(id)); } catch (e) { say("⚠ " + e.message); return; } }
      if (st.id !== id) return;
      paint(s);
      if (s.status === "running") st.timer = setTimeout(tick, 2000); else oldScenes();
    };
    tick();
  }
  function paint(s) {
    st.scene = s;
    $("pscSteps").innerHTML = Object.keys(STEP_NAME).map((k) => { const x = (s.steps || {})[k] || { state: "wait" };
      return '<div class="psc-step ' + esc(x.state) + '"><i>' + stateIcon(x.state) + "</i><span>" + esc(STEP_NAME[k]) + "</span><small>" + esc(x.msg) + "</small></div>"; }).join("");
    const pi = $("pscPanoImg"); if (s.pano) { const u = fileUrl(s.pano); if (pi.dataset.u !== u) { pi.src = u; pi.dataset.u = u; } pi.hidden = false; } else pi.hidden = true;
    $("pscObjs").innerHTML = (s.objects || []).map((o) => '<div class="psc-obj">' + (o.cut ? '<img alt="" src="' + esc(fileUrl(o.cut)) + '">' : "") + "<b>" + esc(o.name) + "</b>"
      + (o.place ? '<span class="psc-note">' + o.place.dist.toFixed(1) + " m away, " + o.place.height.toFixed(1) + " m high</span>" : "")
      + (o.glb ? '<span class="psc-note">🧊 ' + esc(o.glb) + "</span>" : "") + (o.glb ? '<button type="button" class="ghost" data-rig="' + esc(o.glb) + '" title="🦴 A skeleton + skin weights for this model (UniRig add-on)">🦴 Rig</button>' : "") + (o.sfx ? '<audio controls preload="none" src="' + esc(fileUrl(o.sfx)) + '"></audio>' : "") + "</div>").join("");
    $("pscObjs").querySelectorAll("[data-rig]").forEach((b) => { b.onclick = () => (root.H3Rig ? root.H3Rig.rig(b.dataset.rig).then((j) => { if (j) say("🦴 " + j.model + " is being made - the job list"); }) : say("🦴 Rig it did not load")); });
    $("pscSounds").innerHTML = s.ambient ? '<span>The place</span><audio controls loop preload="none" src="' + esc(fileUrl(s.ambient)) + '"></audio>' : "";
    const done = s.status === "done" && s.sceneGlb;
    $("pscRetry").hidden = !["failed", "cancelled"].includes(s.status);
    $("pscStop").hidden = s.status !== "running"; $("pscGo").disabled = s.status === "running";
    ["pscOpen", "pscLook"].forEach((k) => { $(k).hidden = !done; });
    const wd = s.status !== "running" && !!s.worldGlb, wdl = $("pscWorldDl");
    $("pscWorldGo").hidden = !(s.status === "done" && s.pano && !s.worldGlb); $("pscWorldLook").hidden = !wd; wdl.hidden = !wd;
    if (wd) { wdl.href = "/api/tlcanvas/model/" + encodeURIComponent(s.worldGlb); wdl.setAttribute("download", s.worldGlb); }
    const dl = $("pscDl"); dl.hidden = !done; if (done) { dl.href = "/api/tlcanvas/model/" + encodeURIComponent(s.sceneGlb); dl.setAttribute("download", s.sceneGlb); }
    say(s.status === "running" ? "◐ " + (s.msg || "working…") + " - it keeps going if you close this" : s.status === "done" ? "✔ " + s.sceneGlb + (s.worldGlb ? " + 🌍 " + s.worldGlb : "") + " in the project's 3D models" + (s.steps && s.steps.world && s.steps.world.state === "fail" ? " (🌍 " + s.steps.world.msg + ")" : "") : s.status === "failed" ? "⚠ " + (s.error || s.msg) : s.status === "cancelled" ? "■ stopped" : s.msg);
  }

  async function retryIt() {
    const s = st.scene; if (!s) return;
    const MF = root.H3ModelsFound;
    if (MF) {   // the models again first (a failed 3D / sound job is most often a missing model)
      let info = null, need = null; try { info = await jget("/api/pano360"); need = await jget("/api/picscene/needs?engine=" + encodeURIComponent((s.opts || {}).engine || "") + "&sound=" + ((s.opts || {}).sound ? "1" : "0")); } catch (e) { /* checked by the jobs */ }
      if (info && info.style_id && !(await MF.ensure({ kind: "image", style_id: info.style_id, extra_loras: (s.opts || {}).pano && info.lora ? [{ path: info.lora, weight: info.lora_weight }] : [], files: (need && need.files) || [], from: "Picture → 3D scene" }))) { say("not started - models are missing"); return; }
    }
    try { const r = await fetch("/api/picscene/" + encodeURIComponent(s.id) + "/retry", { method: "POST" }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); follow(j.id, j); }
    catch (e) { say("⚠ " + e.message); }
  }
  /* ---- the result ---- */
  async function toSketcher() {
    const s = st.scene, P = root.H3PushPull; if (!s || !s.sceneGlb) return;
    if (!P || !P.importModel || !P.state || !P.state.V) { say("open the Sketcher first (its 3D view loads with it)"); return; }
    try { await P.importModel(s.sceneGlb, null, { skip: /panorama/i }); say("⤒ " + s.sceneGlb + " is in the Sketcher model"); close(); }
    catch (e) { say("⚠ " + e.message + " - 👁 Look round in 3D or ⤓ Download still work"); }
  }
  function three() {
    if (root.H3THREE) return Promise.resolve(root.H3THREE);
    return new Promise((ok, no) => { const sc = doc.createElement("script"); sc.src = "/static/vendor/three-m3d.min.js"; sc.onload = () => (root.H3THREE ? ok(root.H3THREE) : no(new Error("three.js did not load"))); sc.onerror = () => no(new Error("static/vendor/three-m3d.min.js is missing")); doc.head.appendChild(sc); });
  }
  function stopView() { const v = st.view; if (!v) return; st.view = null; cancelAnimationFrame(v.raf); try { v.r.dispose(); } catch (e) { /* fine */ } const c = $("pscView"); if (c) c.style.display = "none"; }
  /** the 🌍 add-on there? no = its Install / Cancel box (Settings ▸ Add-ons' own) and the scene goes on without the world */
  async function worldReady() {
    let w = null; try { w = await jget("/api/picscene/world"); } catch (e) { w = null; }
    if (w && w.installed) return true;
    const A = root.H3Addons;
    if (A && A.act) { try { if (A.refresh) await A.refresh(); } catch (e) { /* the list */ } A.act("hyworld", "install"); }
    say("🌍 HunyuanWorld 1.0 is not installed" + (w && w.note ? " - " + w.note : "") + " - when it is, 🌍 Walk-in world on the finished scene");
    return false;
  }
  async function worldGo() {
    const s = st.scene; if (!s || !s.pano) return;
    if (!(await worldReady())) return;
    try { const r = await fetch("/api/picscene/" + encodeURIComponent(s.id) + "/world", { method: "POST" }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); follow(j.id, j); }
    catch (e) { say("⚠ " + e.message); }
  }
  async function look(theWorld) {
    const s = st.scene, file = s && (theWorld ? s.worldGlb : s.sceneGlb); if (!file) return;
    if (st.view) { stopView(); return; }
    try {
      const T = await three(), cv = $("pscView"); cv.style.display = "block";
      const r = new T.WebGLRenderer({ canvas: cv, antialias: true }); if ("outputColorSpace" in r && T.SRGBColorSpace) r.outputColorSpace = T.SRGBColorSpace;
      const W = cv.clientWidth || 800, H = cv.clientHeight || 450; r.setSize(W, H, false); r.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      const sc = new T.Scene(), cam = new T.PerspectiveCamera(60, W / H, 0.05, 500);
      sc.add(new T.HemisphereLight(0xffffff, 0x444444, 1.2)); const sun = new T.DirectionalLight(0xffffff, 1.5); sun.position.set(3, 8, 4); sc.add(sun);
      const g = await new Promise((ok, no) => new T.GLTFLoader().load("/api/tlcanvas/model/" + encodeURIComponent(file), ok, undefined, (e) => no(new Error("the scene did not load" + (e && e.message ? ": " + e.message : "")))));
      sc.add(g.scene);
      cam.position.set(0, 1.6, 0.01);
      const ctl = new T.OrbitControls(cam, cv); ctl.target.set(0, 1.6, -0.5); ctl.enableDamping = true; ctl.maxDistance = 30; ctl.update();
      st.view = { r, raf: 0 };
      const loop = () => { if (!st.view) return; ctl.update(); r.render(sc, cam); st.view.raf = requestAnimationFrame(loop); };
      loop(); say("👁 drag to look round, the wheel to step back - 👁 again to close");
    } catch (e) { stopView(); say("⚠ " + e.message); }
  }

  root.H3PicScene = Object.assign({ open, close, follow, start, worldGo, state: st }, pure);
})(typeof window !== "undefined" ? window : globalThis);
