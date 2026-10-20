/* bitGen Studio — A .blend IN THE PREVIEW CANVAS (2.403.0), window.TlBlend.
 *
 * Tim (verbatim): "can we preview the blender scene in our preview canvas (load the blend) file and navigate the scene,
 * select the segment we want to render to real? even better id we could edit the scene, move objects etc" - edits:
 * move / rotate / scale, hide / duplicate / delete, keyframes; saving: "an option dropdown in the properties for blender
 * in our toolbox - to write back to blender, copy to new file, only render in our scene, keep the blender filename.tmp
 * in current project folder. save it as .blend if save button is pressed".
 *
 * 🟧 in the canvas tools opens a .blend (the file dialog) - the server copies it to <project>/blender/<name>.tmp and
 * Blender exports what this shows (lib/blendView.js, scripts/blend_scene.py). Over the preview canvas:
 *   🎥 Scene camera  looks through the .blend's active camera (its animation plays), framed at the render's aspect
 *   🧭 Free view     orbit (drag), pan (right-drag / Shift-drag), zoom (wheel); F = frame everything
 *   click an object to select it (or pick it in the Properties' list); G / R / S = move / rotate / scale widget
 *   ⏮ ▶ the scene's frames, [ In / Out ] = the segment to render
 * The toolbox Properties (key 1 floats it) hold the scene: the object list (👁 hide), the selected object (◆ Key at
 * this frame, ✕ its key, ⧉ Duplicate, 🗑 Delete, ↺ Reset), Save to (Only bitGen | Write back to the original .blend |
 * Copy beside it) + 💾 Save, and Render to real (camera: the scene's or this view, engine, the look, 3DREAL, strength,
 * Render in bitGen -> LTX 2.3 3D render -> real). Ctrl+Z undoes an edit.
 * Edits are glTF-local (what three.js shows for a node) and saved to <name>.edits.json as you go: an object Blender
 * animates - or that already has keys here - gets a KEY at the current frame when moved (auto-key), any other object
 * gets a new rest place. The preview plays a keyed object between its Blender keys and yours (linear; Blender eases).
 *
 * 2.404.0 (Tim: "is it possible for our llm to use blender to create 3d models?" -> "can we add option 1 + the image to
 * workflow?"): ✨ Build a scene with AI - the description goes to the local LLM, which writes a plan Blender builds
 * (lib/sceneAI.js); its detailed objects are drawn with the image style picked in Basic Settings and turned into 3D
 * (Hunyuan3D 2.1 = the shape, TRELLIS.2 = textured). The scene opens here when it is built. ＋ Model adds any .glb in
 * the project's models3d/ (a picture sent to 🧊 3D lands there) - one object, 1 m tall, where the view looks.  * 2.542.0 (Tim: "add blender button to open scene tools to image-editor as a blender layer - open blender scene etc. the same
 *   as the timeline docker"): the same tools can be LENT to another docker - TlBlend.attach({wrap, props, onShow}) moves
 *   this view (#tlBlendView) into `wrap` and the Properties into `props` (the image editor: pcblendlayer.js), detach() puts
 *   them back; snapshot(w, h) = the view as shown at any size (no widget / grid); still({w, h, engine}) = Blender renders
 *   this frame through the view (or the scene camera) -> a PNG (lib/blendView.still). One scene, one set of edits.
 * 2.546.0 (Tim: "add zoom in and zoom out controls for blender - alt+drag foward = zoom in,alt+drag back=zoom out, add a
 *   zoom to object button. remove auto key and media player from image-edit mode"): 🔍＋ / 🔍－ in the view's buttons and
 *   Alt+drag (up / away = in, down / back = out) move the free view toward / away from what it looks at (from the scene
 *   camera, the free view takes over at the camera's place first); ⌖ (Z) frames the picked object (nothing picked = all),
 *   from the side the view looks from. Lent to the image editor (attach) the play bar and Auto-key are gone (one still
 *   picture - no segment to play; moves there are not auto-keyed), Space does not play.
 * 2.540.0 🖼 REFERENCES (Tim: "the block is a car, the reference for the car is in our reference docker ... animated with
 *   our 3dreal"): Render to real's 🖼 References - each mesh gets a reference docker picture (by its name - car, sofa,
 *   lamp … - or picked in its dropdown); ticked, Blender also renders the first frame + where each mesh is on it, an edit
 *   model makes that frame a photo with the pictures (lib/realRefs.js), and 3DREAL animates it along the render.
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && window.H3M3D && $("tlTools") && $("tlCanvasWrap")); } catch (e) { return false; } }
  function boot() { if (!$("tlCanvas")) return; if (!ready()) { setTimeout(boot, 80); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
  function j(r) { return r.json().then(function (x) { if (!r.ok) throw new Error(x.error || r.status); return x; }); }
  function post(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(j); }
  function log(s) { try { if (typeof logLine === "function") logLine("[blender] " + s); } catch (e) { /* fine */ } }
  var store0 = { get: function (k, d) { try { var v = localStorage.getItem("tlb." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
                 set: function (k, v) { try { localStorage.setItem("tlb." + k, JSON.stringify(v)); } catch (e) { /* fine */ } } };

  function start() {
    var T = null, R = null, scene = null, root = null, mixer = null, clips = [], camFree = null, camScene = null, orbit = null, tc = null, grid = null;
    var ext = null;                  // 2.542.0: another docker borrowing the view + the Properties ({wrap, props, onShow})
    var S = { on: false, st: null, meta: {}, E: { objects: {} }, sel: null, frame: 1, inF: 1, outF: 1, playing: false, view: store0.get("view", "scene"),
              gmode: "translate", nodes: {}, rest: {}, orig: {}, clones: {}, undo: [], busy: "", render: null, studio: store0.get("studio", true),
              autoKey: store0.get("autokey", false), models: {}, modelList: [], ai: null, aiOpen: false };
    var studio = [];

    /* ---------- the button + the overlay + the props container */
    if (!$("tlbCss")) {
      var css = document.createElement("style"); css.id = "tlbCss";
      css.textContent = "#tlCanvasWrap{position:relative}"
        + "#tlBlendView{position:absolute;inset:0;z-index:6;background:#16181c;display:none;flex-direction:column}"
        + "#tlBlendView.ext #tlbBar{display:none}"   // 2.546.0: no player in the image editor
        + "#tlBlendView.on{display:flex}#tlbStage{flex:1;position:relative;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}"
        + "#tlbGl{display:block;outline:none;touch-action:none}"
        + "#tlbHud{position:absolute;left:6px;top:6px;display:flex;gap:4px;flex-wrap:wrap;z-index:2}#tlbHud button{padding:1px 7px;font-size:.72rem}"
        + "#tlbHud button.on{background:var(--tiger);color:#14120f;border-color:var(--tiger)}"
        + "#tlbMsg{position:absolute;right:8px;top:8px;font-size:.7rem;color:#ddd;background:rgba(0,0,0,.45);padding:2px 6px;border-radius:4px;max-width:60%;z-index:2}"
        + "#tlbBar{display:flex;gap:4px;align-items:center;padding:3px 6px;border-top:1px solid var(--line);font-size:.7rem}"
        + "#tlbBar button,#tlbBar span{white-space:nowrap}#tlbBar button{padding:1px 6px;font-size:.72rem}#tlbBar input[type=range]{flex:1;min-width:60px}"
        + "#tlbRange{position:relative;height:4px;flex:1;min-width:60px;background:#333;border-radius:2px}#tlbRangeSel{position:absolute;top:0;bottom:0;background:var(--tiger);opacity:.7}"
        + "#tlBlendProps .tlb-list{max-height:140px;overflow:auto;border:1px solid var(--line);border-radius:4px;margin:3px 0}"
        + "#tlBlendProps .tlb-o{display:flex;gap:4px;align-items:center;padding:1px 4px;cursor:pointer;white-space:nowrap}"
        + "#tlBlendProps .tlb-o.sel{background:rgba(255,140,40,.25)}#tlBlendProps .tlb-o .eye{cursor:pointer;opacity:.85}"
        + "#tlBlendProps .tlb-o.off .nm{opacity:.45;text-decoration:line-through}#tlBlendProps .tlb-o .ty{color:var(--dim);font-size:.62rem}"
        + "#tlBlendProps .tlb-keys{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px}#tlBlendProps .tlb-keys button{padding:0 5px;font-size:.66rem}"
        + "#tlBlendProps .tlp-row button{padding:1px 6px;font-size:.72rem}#tlBlendProps .tlb-st{color:var(--dim);font-size:.66rem;margin-top:3px;word-break:break-all}"
        + "#tlBlendProps select,#tlBlendProps input,#tlBlendProps textarea{width:100%;font-size:.72rem;padding:2px 4px;min-width:0}"
        + "#tlBlendProps textarea{resize:vertical;min-height:40px}#tlBlendProps input[type=checkbox]{width:auto}"
        + "#tlBlendProps .tlp-g{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:3px 5px;align-items:center;margin:3px 0}"
        + "#tlBlendProps .tlp-row{display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin:3px 0}"
        + "#tlBlendProps .tlb-sec{border-top:1px solid var(--line);margin-top:6px;padding-top:4px}";
      document.head.appendChild(css);
    }
    var btn = document.createElement("button");
    btn.className = "ghost"; btn.id = "tlTool_blend"; btn.type = "button"; btn.textContent = "🟧";
    btn.title = "Blender scene (.blend) - open it here, look around, move / key / hide / duplicate objects, pick a segment and render it to real (LTX 2.3 · 3DREAL)";
    btn.setAttribute("aria-label", "Blender scene");
    var tools = $("tlTools");
    var sep = document.createElement("span"); sep.className = "tlt-sep";
    tools.appendChild(sep); tools.appendChild(btn);
    var ov = document.createElement("div"); ov.id = "tlBlendView";
    ov.innerHTML = '<div id="tlbStage"><canvas id="tlbGl" tabindex="0"></canvas>'
      + '<div id="tlbHud"><button class="ghost" id="tlbCamScene" type="button" title="Look through the scene\'s camera (what renders)">🎥 Scene camera</button>'
      + '<button class="ghost" id="tlbCamFree" type="button" title="Free view: drag = orbit, right-drag / Shift-drag = pan, wheel = zoom, F = frame all">🧭 Free view</button>'
      + '<button class="ghost" id="tlbG" type="button" title="Move (G)">✥</button><button class="ghost" id="tlbR" type="button" title="Rotate (R)">⟲</button>'
      + '<button class="ghost" id="tlbS" type="button" title="Scale (S)">⤡</button>'
      + '<button class="ghost" id="tlbStudio" type="button" title="Studio light on / off (the .blend\'s own lights stay on)">💡</button>'
      + '<button class="ghost" id="tlbZoomIn" type="button" title="Zoom in (Alt+drag up = in, down = out; the wheel too)">🔍＋</button>'      // 2.546.0
      + '<button class="ghost" id="tlbZoomOut" type="button" title="Zoom out (Alt+drag down)">🔍－</button>'
      + '<button class="ghost" id="tlbZoomObj" type="button" title="Zoom to the picked object (Z) - nothing picked = the whole scene">⌖ Zoom to object</button></div>'
      + '<div id="tlbMsg"></div></div>'
      + '<div id="tlbBar"><button class="ghost" id="tlbFirst" type="button" title="The segment\'s first frame">⏮</button>'
      + '<button class="ghost" id="tlbPlay" type="button" title="Play / pause the scene (the segment loops)">▶</button>'
      + '<input type="range" id="tlbFrame" min="1" max="2" step="1" value="1" title="The scene\'s frame">'
      + '<span id="tlbF" style="font-family:var(--mono);min-width:5.5em">1</span>'
      + '<button class="ghost" id="tlbIn" type="button" title="Segment start = this frame">[ In</button>'
      + '<div id="tlbRange" title="The segment to render"><div id="tlbRangeSel"></div></div>'
      + '<button class="ghost" id="tlbOut" type="button" title="Segment end = this frame">Out ]</button>'
      + '<span id="tlbSeg" style="font-family:var(--mono)"></span></div>';
    $("tlCanvasWrap").appendChild(ov);
    var PR = document.createElement("div"); PR.id = "tlBlendProps"; PR.style.display = "none";
    var cv = $("tlbGl");

    function placeProps() {          // the props sit where the canvas's Properties are (the toolbox when floated)
      if (ext) {                     // 2.542.0: lent to another docker - its own box
        if (PR.parentNode !== ext.props) ext.props.appendChild(PR);
        PR.style.cssText = S.on ? "display:block;padding:6px 8px;font-size:.72rem;overflow:auto" : "display:none";
        return;
      }
      var P = $("tlProps"); if (!P || !P.parentNode) return;
      if (PR.parentNode !== P.parentNode || PR.nextSibling !== P) P.parentNode.insertBefore(PR, P);
      PR.style.display = S.on ? "" : "none"; P.style.display = S.on ? "none" : "";
      if (S.on) { PR.className = P.className; PR.style.cssText = "display:block;padding:6px 8px;font-size:.72rem;overflow:auto;max-height:100%"; }
    }
    function msg(s) { $("tlbMsg").textContent = s || ""; $("tlbMsg").style.display = s ? "" : "none"; }

    /* ---------- open / load */
    function openDialog() {
      if (!window.FileDialog || !FileDialog.open) { var p = prompt("The .blend file's full path:"); if (p) openPath(p); return; }
      FileDialog.open({ mode: "file", title: "Open a Blender scene", okLabel: "Open", key: "blend", filters: [{ label: "Blender scenes", exts: [".blend"] }] })
        .then(function (r) { if (r && r.path) openPath(r.path); });
    }
    function openPath(p, fresh) {
      show(true); msg("Blender is reading " + String(p).split(/[\\/]/).pop() + " …");
      return post("/api/blendview/open", { path: p, fresh: !!fresh }).then(function (st) { log("opened " + st.source + " (working copy " + st.stem + ".tmp)"); return load(st); })
        .catch(function (e) { msg(""); if (!S.st) show(false); alert(String(e.message || e)); throw e; });
    }
    function show(on) {
      S.on = !!on; ov.classList.toggle("on", S.on); btn.classList.toggle("on", S.on && !ext);
      placeProps();
      if (S.on) { paint(); (R ? Promise.resolve() : three().then(setupGl)).then(function () { resize(); paint(); dirty(); listModels(); }); }
      else stop();
      if (ext && ext.onShow) { try { ext.onShow(S.on); } catch (e) { /* the borrower's */ } }
    }
    /* 2.542.0: lend the view + the Properties to another docker (the image editor's Blender layer) */
    function attach(h) {
      if (ext && ext !== h) detach();
      if (!ext) {                    // the timeline's own Properties back on if the scene was showing there
        var P = $("tlProps"); if (P) P.style.display = "";
        if (S.on) { S.on = false; ov.classList.remove("on"); btn.classList.remove("on"); stop(); }
      }
      ext = h; h.wrap.appendChild(ov); ov.classList.add("ext"); placeProps();
      return openUi();
    }
    function detach() {
      if (!ext) return;
      var h = ext; S.on = false; ov.classList.remove("on"); stop();
      ext = null; ov.classList.remove("ext"); $("tlCanvasWrap").appendChild(ov);
      if (PR.parentNode === h.props) h.props.removeChild(PR);
      placeProps();
    }
    /** the scene tools on screen: the open scene, else the server's current one, else 📂 Open */
    function openUi() {
      if (S.st) { show(true); return Promise.resolve(S.st); }
      return fetch("/api/blendview/current").then(j).then(function (c) { show(true); return c && c.stem ? load(c) : null; }).catch(function () { show(true); return null; });
    }
    btn.addEventListener("click", function () {
      if (ext) { var h = ext; detach(); if (h.onTaken) { try { h.onTaken(); } catch (e) { /* the borrower's */ } } }
      if (S.on) { show(false); return; }
      if (S.st) { show(true); return; }
      // no scene yet: the view opens with 📂 Open and ✨ Build a scene with AI in the Properties
      fetch("/api/blendview/current").then(j).then(function (c) { show(true); if (c && c.stem) load(c); }).catch(function () { show(true); });
    });

    function three() { return window.H3M3D.load().then(function (t) { T = t; }); }
    function setupGl() {
      if (R) return;
      R = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
      R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      R.setClearColor(0x1d2026, 1);
      try { R.outputColorSpace = T.SRGBColorSpace; } catch (e) { /* older three */ }
      scene = new T.Scene();
      camFree = new T.PerspectiveCamera(40, 16 / 9, 0.05, 5000);
      camFree.position.set(8, 6, 8);
      orbit = new T.OrbitControls(camFree, cv);
      orbit.addEventListener("change", dirty);
      tc = new T.TransformControls(camFree, cv);
      tc.addEventListener("dragging-changed", function (ev) { orbit.enabled = !ev.value && S.view === "free"; if (ev.value) S.dragFrom = snapshot(); else committed(); });
      tc.addEventListener("objectChange", dirty);
      scene.add(tc.getHelper ? tc.getHelper() : tc);
      var hemi = new T.HemisphereLight(0xffffff, 0x444455, 1.6), dir = new T.DirectionalLight(0xffffff, 1.8);
      dir.position.set(5, 10, 7); studio = [hemi, dir]; studio.forEach(function (l) { scene.add(l); });
      grid = new T.GridHelper(40, 40, 0x555555, 0x333333); grid.userData.noPick = true; scene.add(grid);
      new ResizeObserver(resize).observe($("tlbStage"));
      wireInput();
    }
    function load(st) {
      return three().then(function () {
        setupGl();
        S.st = st; S.meta = st.meta || {}; S.E = st.edits && st.edits.objects ? st.edits : { objects: {} };
        S.inF = num(store0.get("in." + st.stem, S.meta.frame_start), S.meta.frame_start || 1);
        S.outF = num(store0.get("out." + st.stem, S.meta.frame_end), S.meta.frame_end || 1);
        S.frame = Math.max(S.meta.frame_start || 1, Math.min(S.meta.frame_end || 1, S.frame || 1));
        msg("loading the scene …");
        return new Promise(function (ok, no) {
          new T.GLTFLoader().load(st.glb, function (g) {
            if (root) { scene.remove(root); }
            if (mixer) mixer.stopAllAction();
            root = g.scene; scene.add(root);
            clips = g.animations || [];
            mixer = new T.AnimationMixer(root);
            clips.forEach(function (c) { var a = mixer.clipAction(c); a.play(); });
            S.nodes = {}; S.rest = {}; S.clones = {};
            root.traverse(function (o) {
              var id = o.userData && o.userData.bitgen_id;
              if (id && !S.nodes[id]) { S.nodes[id] = o; S.rest[id] = trsOf(o); }
              if (o.isLight && o.intensity > 50) o.intensity = o.intensity / 683 * 4;   // W -> a usable preview level
            });
            var camId = S.meta.camera, cn = camId && S.nodes[camId];
            camScene = null;
            if (cn) cn.traverse(function (o) { if (!camScene && o.isCamera) camScene = o; });
            if (!camScene && g.cameras && g.cameras.length) camScene = g.cameras[0];
            origKeys();
            rebuild();
            if (!S.st._framed) { frameAll(); S.st._framed = true; }
            setView(camScene ? S.view : "free");
            $("tlbFrame").min = S.meta.frame_start || 1; $("tlbFrame").max = S.meta.frame_end || 1;
            msg(""); paint(); dirty(); ok(st);
          }, undefined, function (e) { msg("the preview could not be read"); no(e); });
        });
      });
    }
    function trsOf(o) { return { t: [o.position.x, o.position.y, o.position.z], r: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w], s: [o.scale.x, o.scale.y, o.scale.z] }; }
    function setTrs(o, e) { o.position.set(e.t[0], e.t[1], e.t[2]); o.quaternion.set(e.r[0], e.r[1], e.r[2], e.r[3]); o.scale.set(e.s[0], e.s[1], e.s[2]); }
    function objMeta(id) { var src = (S.E.objects[id] || {}).src; return ((S.meta.objects || []).find(function (o) { return o.id === (src || id); })) || {}; }
    function animated(id) { return !(S.E.objects[id] || {}).src && !!objMeta(id).animated; }
    /** an animated object's own keys, read off the clip at its Blender key frames (meta.objects[].keys) */
    function origKeys() {
      S.orig = {};
      (S.meta.objects || []).forEach(function (m) {
        var n = S.nodes[m.id]; if (!m.animated || !n || !Array.isArray(m.keys)) return;
        var d = {};
        m.keys.forEach(function (f) { mixer.setTime(f / fps()); n.updateMatrix(); d[f] = trsOf(n); });
        S.orig[m.id] = d;
      });
    }
    function fps() { return S.meta.fps || 24; }

    /* ---------- edits -> the scene */
    function rebuild() {
      Object.keys(S.clones).forEach(function (id) { var c = S.clones[id]; if (c.parent) c.parent.remove(c); });
      S.clones = {};
      Object.keys(S.nodes).forEach(function (id) { var n = S.nodes[id]; setTrs(n, S.rest[id]); n.visible = !(objMeta(id).hidden); });
      Object.keys(S.E.objects).forEach(function (id) {
        var e = S.E.objects[id];
        if (e.src && S.nodes[e.src] && !S.clones[id]) {
          var src = S.nodes[e.src], c = src.clone(true);
          c.userData = Object.assign({}, src.userData, { bitgen_id: id, dupOf: e.src });
          (src.parent || root).add(c); S.clones[id] = c;
        }
        if (e.import && !S.clones[id]) {                // 2.404.0: a model added here (models3d/)
          var M = S.models[e.import];
          if (M && M.scene) {
            var g = new T.Group(); g.add(M.scene.clone(true));
            g.userData = { bitgen_id: id, imported: e.import };
            root.add(g); S.clones[id] = g;
          } else if (!M) loadModel(e.import).then(function () { rebuild(); paint(); }).catch(function (er) { msg(e.import + ": " + (er.message || er)); });
        }
      });
      Object.keys(S.E.objects).forEach(function (id) {
        var e = S.E.objects[id], n = node(id); if (!n) return;
        if (e.base && !(e.keys && Object.keys(e.keys).length)) setTrs(n, e.base);
        if (e.hidden !== undefined) n.visible = !e.hidden;
        if (e.deleted) n.visible = false;
      });
      if (S.sel && (!node(S.sel) || isDeleted(S.sel))) select(null);
      drawFrame();
    }
    function node(id) { return S.clones[id] || S.nodes[id] || null; }
    /** a model file in models3d/ -> {scene} (once per file) */
    function loadModel(name) {
      if (S.models[name] && S.models[name].p) return S.models[name].p;
      var rec = S.models[name] = {};
      rec.p = new Promise(function (ok, no) {
        new T.GLTFLoader().load("/api/tlcanvas/model/" + encodeURIComponent(name), function (g) { rec.scene = g.scene; rec.scene.updateMatrixWorld(true); ok(rec); },
          undefined, function () { delete S.models[name]; no(new Error("could not read " + name + " (a .glb / .gltf)")); });
      });
      return rec.p;
    }
    /** ＋ Model: the file as one new object, 1 m tall, its base on the ground where the view looks */
    function addModel(name) {
      if (!S.st || !name) return Promise.resolve(null);
      return loadModel(name).then(function (M) {
        var b = new T.Box3().setFromObject(M.scene), sz = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
        var k = sz.y > 1e-6 ? 1 / sz.y : 1;
        var tg = orbit ? orbit.target : new T.Vector3();
        pushUndo();
        var stem = String(name).replace(/\.[^.]+$/, "").replace(/[^\w .()-]+/g, " ").trim() || "Model", id = stem, n = 2;
        while (node(id) || S.E.objects[id]) id = stem + " " + (n++);
        S.E.objects[id] = { import: name, base: { t: [tg.x - c.x * k, -b.min.y * k, tg.z - c.z * k], r: [0, 0, 0, 1], s: [k, k, k] } };
        persist(); rebuild(); select(id);
        log("added " + name + " as " + id);
        return id;
      });
    }
    function listModels() {
      return fetch("/api/tlcanvas/models").then(j).then(function (r) {
        S.modelList = (r.models || []).map(function (m) { return typeof m === "string" ? m : m.name; }).filter(function (n) { return /\.(glb|gltf)$/i.test(n || ""); });
        paint(); return S.modelList;
      }).catch(function () { return S.modelList; });
    }
    function isDeleted(id) { return !!(S.E.objects[id] || {}).deleted; }
    function lerpTrs(a, b, k) {
      var qa = new T.Quaternion(a.r[0], a.r[1], a.r[2], a.r[3]), qb = new T.Quaternion(b.r[0], b.r[1], b.r[2], b.r[3]);
      qa.slerp(qb, k);
      var L = function (x, y) { return x.map(function (v, i) { return v + (y[i] - v) * k; }); };
      return { t: L(a.t, b.t), r: [qa.x, qa.y, qa.z, qa.w], s: L(a.s, b.s) };
    }
    /** an object with keys here: its Blender keys (animated) + these, linear between, held outside */
    function keyedAt(id, f) {
      var e = S.E.objects[id] || {}, ks = {};
      var o = S.orig[id] || {};
      Object.keys(o).forEach(function (k) { ks[k] = o[k]; });
      Object.keys(e.keys || {}).forEach(function (k) { ks[k] = e.keys[k]; });
      var fs = Object.keys(ks).map(Number).sort(function (a, b) { return a - b; });
      if (!fs.length) return null;
      if (f <= fs[0]) return ks[fs[0]];
      if (f >= fs[fs.length - 1]) return ks[fs[fs.length - 1]];
      for (var i = 1; i < fs.length; i++) if (f <= fs[i]) return lerpTrs(ks[fs[i - 1]], ks[fs[i]], (f - fs[i - 1]) / (fs[i] - fs[i - 1]));
      return null;
    }
    function drawFrame() {
      if (!mixer) return;
      mixer.setTime(S.frame / fps());
      Object.keys(S.E.objects).forEach(function (id) {
        var e = S.E.objects[id], n = node(id); if (!n) return;
        if (e.keys && Object.keys(e.keys).length) { var v = keyedAt(id, S.frame); if (v && !(tc && tc.dragging && tc.object === n)) setTrs(n, v); }
      });
      if (window.TlBlendPose) { try { window.TlBlendPose.apply(); } catch (er) { /* the pose preview */ } }   // 2.461.0: blendpose.js
      dirty();
    }

    /* ---------- render loop */
    var need = false, raf = 0, lastT = 0;
    function dirty() { need = true; if (!raf && S.on) raf = requestAnimationFrame(loop); }
    function stop() { S.playing = false; $("tlbPlay").textContent = "▶"; }
    function loop(ts) {
      raf = 0;
      if (!S.on || !R) return;
      if (S.playing) {
        if (!lastT) lastT = ts;
        var adv = (ts - lastT) / 1000 * fps();
        if (adv >= 1) {
          lastT = ts; S.frame += Math.floor(adv);
          if (S.frame > S.outF || S.frame < S.inF) S.frame = S.inF;
          drawFrame(); paintBar();
        }
        need = true;
      } else lastT = 0;
      if (need) { need = false; try { orbit.update(); } catch (e) { /* fine */ } R.render(scene, curCam()); }
      if (S.playing || need) raf = requestAnimationFrame(loop);
    }
    function curCam() { return S.view === "scene" && camScene ? camScene : camFree; }
    function aspect() { return Math.max(0.2, (S.meta.width || 16) / (S.meta.height || 9)); }
    function resize() {
      if (!R) return;
      var box = $("tlbStage").getBoundingClientRect();
      var W = Math.max(64, box.width), H = Math.max(64, box.height), a = aspect();
      var w = W, h = W / a;                                     // the render's aspect - what is seen is what renders
      if (h > H) { h = H; w = H * a; }
      R.setSize(Math.floor(w), Math.floor(h), true);
      camFree.aspect = a; camFree.updateProjectionMatrix();
      if (camScene) { camScene.aspect = a; camScene.updateProjectionMatrix(); }
      dirty();
    }
    function setView(v) {
      S.view = v === "scene" && camScene ? "scene" : "free"; store0.set("view", S.view);
      orbit.enabled = S.view === "free";
      tc.camera = curCam();
      $("tlbCamScene").classList.toggle("on", S.view === "scene"); $("tlbCamFree").classList.toggle("on", S.view === "free");
      $("tlbCamScene").disabled = !camScene;
      paint(); dirty();
    }
    function frameAll() {
      if (!root) return;
      var b = new T.Box3();
      root.traverse(function (o) { if (o.isMesh && o.visible) b.expandByObject(o); });
      frameBox(b, null);
    }
    /** the free view onto box b - from dir (the side it looks from now) or the default corner; 2.546.0 */
    function frameBox(b, dir) {
      if (!b || b.isEmpty()) return false;
      var c = b.getCenter(new T.Vector3()), r = Math.max(0.05, b.getSize(new T.Vector3()).length() / 2);
      var d = r / Math.sin(camFree.fov * Math.PI / 360) * 1.1;
      var v = dir && dir.lengthSq() > 1e-9 ? dir.clone().normalize() : new T.Vector3(1, 0.7, 1).normalize();
      camFree.position.copy(c).add(v.multiplyScalar(d));
      camFree.near = Math.max(0.005, d / 500); camFree.far = Math.max(50, d * 50); camFree.updateProjectionMatrix();
      orbit.target.copy(c); orbit.update(); dirty();
      return true;
    }
    /** 2.546.0: the scene camera's view handed to the free view (so zooming from it works) */
    function freeFromScene() {
      if (S.view !== "scene" || !camScene) return;
      camScene.updateMatrixWorld(true);
      var p = camScene.getWorldPosition(new T.Vector3()), q = camScene.getWorldQuaternion(new T.Quaternion());
      var fwd = new T.Vector3(0, 0, -1).applyQuaternion(q), b = new T.Box3();
      if (root) root.traverse(function (o) { if (o.isMesh && o.visible) b.expandByObject(o); });
      var dist = b.isEmpty() ? 5 : Math.max(0.5, b.getCenter(new T.Vector3()).sub(p).dot(fwd));
      camFree.position.copy(p); camFree.quaternion.copy(q);
      if (camScene.fov) camFree.fov = camScene.fov;
      camFree.updateProjectionMatrix();
      orbit.target.copy(p).add(fwd.multiplyScalar(dist));
      setView("free"); orbit.update();
    }
    /** 2.546.0: f < 1 = in (closer), > 1 = out; never through what it looks at */
    function zoomBy(f) {
      if (!camFree || !orbit) return;
      freeFromScene();
      var v = camFree.position.clone().sub(orbit.target), L = v.length();
      var n = Math.max(0.02, Math.min(5000, L * f));
      camFree.position.copy(orbit.target).add(v.multiplyScalar(n / Math.max(1e-6, L)));
      orbit.update(); dirty();
      if (window.H3TestEvent) { try { window.H3TestEvent("blend_zoom", f < 1 ? "in" : "out"); } catch (e) { /* the 🧪 list */ } }
    }
    /** 2.546.0: ⌖ the picked object (nothing picked = everything), from the side the view looks from */
    function zoomToObject() {
      if (!root) return;
      freeFromScene();
      var n = S.sel ? node(S.sel) : null, b = new T.Box3();
      if (n) n.traverse(function (o) { if (o.isMesh) b.expandByObject(o); });
      if (b.isEmpty()) { frameAll(); return; }
      frameBox(b, camFree.position.clone().sub(orbit.target));
      if (window.H3TestEvent) { try { window.H3TestEvent("blend_zoom", "object"); } catch (e) { /* the 🧪 list */ } }
    }

    /* ---------- selection, widgets */
    function select(id) {
      S.sel = id && node(id) && !isDeleted(id) ? id : null;
      if (S.sel) { tc.attach(node(S.sel)); tc.setMode(S.gmode); } else tc.detach();
      paint(); dirty();
    }
    function setGizmo(m) { S.gmode = m; if (tc) tc.setMode(m); ["G", "R", "S"].forEach(function (k, i) { $("tlb" + k).classList.toggle("on", ["translate", "rotate", "scale"][i] === m); }); }
    function wireInput() {
      var down = null;
      // 2.546.0: Alt+drag = zoom (up / away = in, down / back = out) - caught before the orbit and the widget see it
      var az = null;
      $("tlbStage").addEventListener("pointerdown", function (ev) {
        if (!ev.altKey || ev.button !== 0 || ev.target !== cv) return;
        ev.preventDefault(); ev.stopPropagation(); az = { y: ev.clientY, id: ev.pointerId };
        try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
      }, true);
      $("tlbStage").addEventListener("pointermove", function (ev) {
        if (!az) return;
        ev.stopPropagation();
        var dy = ev.clientY - az.y; az.y = ev.clientY;
        if (dy) zoomBy(Math.exp(dy * 0.006));
      }, true);
      var azEnd = function (ev) { if (!az) return; ev.stopPropagation(); try { cv.releasePointerCapture(az.id); } catch (e) { /* fine */ } az = null; down = null; };
      $("tlbStage").addEventListener("pointerup", azEnd, true);
      $("tlbStage").addEventListener("pointercancel", azEnd, true);
      cv.addEventListener("pointerdown", function (ev) { down = { x: ev.clientX, y: ev.clientY }; cv.focus(); });
      cv.addEventListener("pointerup", function (ev) {
        if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4 || (tc && tc.dragging) || ev.button !== 0) { down = null; return; }
        down = null;
        if (tc.axis) return;                    // a click on the widget, not the scene
        var r = cv.getBoundingClientRect();
        var p = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
        var ray = new T.Raycaster(); ray.setFromCamera(p, curCam());
        var hits = ray.intersectObject(root, true).filter(function (h) { return h.object.visible; });
        for (var i = 0; i < hits.length; i++) {
          var o = hits[i].object;
          while (o && !(o.userData && o.userData.bitgen_id)) o = o.parent;
          if (o) { select(o.userData.bitgen_id); return; }
        }
        select(null);
      });
      cv.addEventListener("keydown", keys);
      ov.addEventListener("keydown", keys);
    }
    function keys(ev) {
      if (!S.on || /input|textarea|select/i.test((ev.target && ev.target.tagName) || "") && ev.target !== cv) return;
      var k = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === "z") { undo(); ev.preventDefault(); return; }
      if (k === "g") setGizmo("translate"); else if (k === "r") setGizmo("rotate"); else if (k === "s") setGizmo("scale");
      else if (k === "f") frameAll(); else if (k === "z" && !ev.ctrlKey && !ev.metaKey) zoomToObject(); else if (k === "delete" && S.sel) del();   // 2.546.0: Z
      else if (k === " " && !ext) { play(); } else return;                                                                                  // 2.546.0: no player lent
      ev.preventDefault();
    }

    /* ---------- edits */
    function snapshot() { return JSON.stringify(S.E); }
    function pushUndo(s) { S.undo.push(s || snapshot()); if (S.undo.length > 60) S.undo.shift(); }
    var saveT = 0;
    function persist() {
      clearTimeout(saveT);
      saveT = setTimeout(function () { if (S.st) post("/api/blendview/edits", { stem: S.st.stem, edits: S.E }).catch(function (e) { msg("edits not saved: " + e.message); }); }, 400);
      paint();
    }
    function E(id) { return S.E.objects[id] || (S.E.objects[id] = {}); }
    function hasKeys(id) { var e = S.E.objects[id]; return !!(e && e.keys && Object.keys(e.keys).length); }
    /** after a widget drag: a key at this frame (animated / keyed / auto-key), else a new rest place */
    function committed() {           // 2.546.0: Auto-key only in the timeline (not lent to the image editor)
      var id = S.sel; if (!id) return;
      var n = node(id), before = S.dragFrom; S.dragFrom = null;
      var now = trsOf(n);
      pushUndo(before);
      if (animated(id) || hasKeys(id) || (S.autoKey && !ext)) { var e = E(id); e.keys = e.keys || {}; e.keys[String(S.frame)] = now; delete e.base; }
      else E(id).base = now;
      persist(); drawFrame();
    }
    function setSelTrs(trs) {                     // the numbers in the Properties / tests
      var id = S.sel; if (!id) return;
      S.dragFrom = snapshot(); setTrs(node(id), trs); committed();
    }
    function keyNow() { var id = S.sel; if (!id) return; pushUndo(); var e = E(id); e.keys = e.keys || {}; e.keys[String(S.frame)] = trsOf(node(id)); delete e.base; persist(); drawFrame(); }
    function unkeyNow() {
      var id = S.sel, e = S.E.objects[id]; if (!e || !e.keys || !e.keys[String(S.frame)]) return;
      pushUndo(); delete e.keys[String(S.frame)]; if (!Object.keys(e.keys).length) delete e.keys; persist(); rebuild();
    }
    function hide(id, on) { pushUndo(); E(id).hidden = on === undefined ? !(node(id) && !node(id).visible) : !!on; persist(); rebuild(); }
    function dup() {
      var id = S.sel; if (!id) return;
      pushUndo();
      var imp = (S.E.objects[id] || {}).import;
      var src = imp ? id : (S.E.objects[id] || {}).src || id, n = 1, nid;
      do { nid = src + ".bg" + (n++); } while (S.nodes[nid] || S.E.objects[nid]);
      var base = trsOf(node(id));
      base.t = [base.t[0] + 0.5, base.t[1], base.t[2]];        // beside it, so it can be seen and grabbed
      S.E.objects[nid] = imp ? { import: imp, base: base } : { src: src, base: base };
      persist(); rebuild(); select(nid);
    }
    function del() {
      var id = S.sel; if (!id) return;
      pushUndo();
      var de = S.E.objects[id] || {};
      if (de.src || de.import) delete S.E.objects[id]; else E(id).deleted = true;
      persist(); select(null); rebuild();
    }
    function resetObj() { var id = S.sel; if (!id || !S.E.objects[id]) return; pushUndo(); var e = S.E.objects[id]; if (e.src) S.E.objects[id] = { src: e.src, base: e.base }; else if (e.import) S.E.objects[id] = { import: e.import, base: e.base }; else delete S.E.objects[id]; persist(); rebuild(); }
    function undo() { if (!S.undo.length) return; S.E = JSON.parse(S.undo.pop()); persist(); rebuild(); }

    /* ---------- frames, segment */
    function goto(f) { S.frame = Math.round(Math.max(S.meta.frame_start || 1, Math.min(S.meta.frame_end || 1, num(f, S.frame)))); drawFrame(); paintBar(); paintKeysRow(); }
    function play() { S.playing = !S.playing; $("tlbPlay").textContent = S.playing ? "⏸" : "▶"; if (S.playing && (S.frame >= S.outF || S.frame < S.inF)) goto(S.inF); dirty(); }
    function setRange(a, b) {
      S.inF = Math.round(num(a, S.inF)); S.outF = Math.round(num(b, S.outF));
      if (S.outF < S.inF) { var t = S.inF; S.inF = S.outF; S.outF = t; }
      store0.set("in." + S.st.stem, S.inF); store0.set("out." + S.st.stem, S.outF); paintBar(); paint();
    }
    function paintBar() {
      var a = S.meta.frame_start || 1, b = S.meta.frame_end || 1, span = Math.max(1, b - a);
      $("tlbFrame").value = S.frame; $("tlbF").textContent = S.frame + " / " + b;
      var sel = $("tlbRangeSel"); sel.style.left = ((S.inF - a) / span * 100) + "%"; sel.style.width = Math.max(0.5, (S.outF - S.inF) / span * 100) + "%";
      var secs = (S.outF - S.inF + 1) / fps();
      $("tlbSeg").textContent = S.inF + "–" + S.outF + " · " + secs.toFixed(1) + " s"; $("tlbSeg").style.color = secs > 30 ? "#ff6b5e" : "";
    }

    /* ---------- save, render */
    function save() {
      if (!S.st || S.busy) return;
      var mode = $("tlbMode") ? $("tlbMode").value : S.st.mode;
      S.busy = "save"; paint(); msg("Blender is saving …");
      clearTimeout(saveT);
      return post("/api/blendview/edits", { stem: S.st.stem, edits: S.E }).then(function () { return post("/api/blendview/save", { stem: S.st.stem, mode: mode }); })
        .then(function (st) {
          S.busy = ""; S.undo = []; log("saved: " + (st.written || []).join(" · ")); msg("saved ✓");
          setTimeout(function () { msg(""); }, 2500);
          var keep = S.sel, f = S.frame; S.st._framed = true;
          return load(Object.assign(st, { _framed: true })).then(function () { goto(f); if (keep && node(keep)) select(keep); });
        })
        .catch(function (e) { S.busy = ""; msg(""); paint(); alert("Save failed: " + (e.message || e)); });
    }
    function viewOf() {
      camFree.updateMatrixWorld(true);
      return { matrix: Array.prototype.slice.call(camFree.matrixWorld.elements), fov: camFree.fov };
    }
    function renderReal(opts) {
      if (!S.st || S.busy) return Promise.resolve(null);
      var o = opts || {};
      var useView = o.view !== undefined ? !!o.view : ($("tlbCamMode") ? $("tlbCamMode").value === "view" : S.view === "free");
      var body = {
        stem: S.st.stem, start: S.inF, end: S.outF, view: useView ? viewOf() : null,
        engine: o.engine || ($("tlbEngine") ? $("tlbEngine").value : "WORKBENCH"),
        prompt: o.prompt !== undefined ? o.prompt : ($("tlbLook") ? $("tlbLook").value : ""),
        ic_lora: o.ic_lora !== undefined ? o.ic_lora : ($("tlbReal") ? $("tlbReal").value : ""),
        ic_strength: o.ic_strength !== undefined ? o.ic_strength : ($("tlbStr") ? num($("tlbStr").value, 1) : 1),
        render: o.render !== undefined ? !!o.render : ($("tlbNow") ? $("tlbNow").checked : true),
      };
      if ((S.outF - S.inF + 1) / fps() > 30.5) { alert("The segment is longer than 30 s - LTX renders up to 30 s. Set In / Out closer."); return Promise.resolve(null); }
      S.busy = "render"; S.rrState = null; paint();
      // 2.540.0: 🖼 with the reference docker's pictures - uploaded first, Blender's first frame made real with them
      var refs = rrRefs(), items = window.RealRefs && store0.get("rr.on", false) ? RealRefs.resolve(rrObjects(), refs, rrMan(S.st)) : [];
      var withRefs = o.refs !== undefined ? !!o.refs : items.length > 0;
      var pre = withRefs && items.length ? RealRefs.upload(items, refs).then(function (u) { body.realrefs = { token: u.token, items: u.items, style_id: $("tlbRefStyle") ? $("tlbRefStyle").value : "" }; }) : Promise.resolve();
      return pre.then(function () { return post("/api/blendview/edits", { stem: S.st.stem, edits: S.E }); }).then(function () { return post("/api/blendview/render", body); }).then(function (r) {
        S.render = { id: r.id, state: "running", done: 0, of: r.of }; paint();
        return new Promise(function (ok) {
          (function poll() {
            fetch("/api/blendview/render/" + r.id).then(j).then(function (st) {
              S.render = st; paint();
              if (st.state === "running") { setTimeout(poll, 800); return; }
              S.busy = ""; paint();
              if (st.state === "done" && st.realrefs) {         // 2.540.0: first frame (references) -> 3DREAL
                log("frames " + body.start + "-" + body.end + " -> Video assets " + st.name + " · 🖼 " + (st.note || "") + " · first frame job " + st.job);
                if (typeof refreshJobs === "function") refreshJobs();
                RealRefs.follow(st.realrefs, function (cs) { S.rrState = cs; paint(); if (cs.real && typeof refreshJobs === "function" && !S._rrSel) { S._rrSel = 1; refreshJobs(); } });
              } else if (st.state === "done") {
                log("frames " + body.start + "-" + body.end + " -> Video assets " + st.name + (st.job ? " · LTX 2.3 3DREAL job " + st.job : ""));
                if (st.job && typeof refreshJobs === "function") { refreshJobs().then(function () { try { selectJob(st.job); } catch (e) { /* fine */ } }); }
              } else alert("Render failed: " + st.error);
              ok(st);
            }).catch(function () { setTimeout(poll, 1500); });
          })();
        });
      }).catch(function (e) { S.busy = ""; paint(); alert(String(e.message || e)); return null; });
    }

    /* ---------- the toolbox Properties */
    function paint() {
      placeProps();
      if (!S.on) return;
      ["Scene", "Free"].forEach(function () { /* the HUD is painted by setView */ });
      $("tlbStudio").classList.toggle("on", S.studio); studio.forEach(function (l) { l.visible = S.studio; });
      setGizmo(S.gmode);
      if (!S.st) {
        PR.innerHTML = '<div class="tlp-t">Blender scene</div><div class="tlp-row"><button class="ghost" id="tlbOpen" type="button" title="Open a .blend">📂 Open a .blend</button>'
          + '<button class="ghost" id="tlbClose" type="button" title="' + (ext ? "Close the scene tools (the layer keeps the view)" : "Back to the timeline\'s canvas") + '">✕</button></div>' + aiHtml(true);
        wireProps();
        if ($("tlbAiEngine")) $("tlbAiEngine").value = store0.get("tlbAiEngine", "auto");
        return;
      }
      var st = S.st, m = S.meta, id = S.sel, e = (id && S.E.objects[id]) || {};
      var objs = (m.objects || []).map(function (o) { return o.id; }).concat(Object.keys(S.E.objects).filter(function (k) { return S.E.objects[k].src || S.E.objects[k].import; }));
      var focus = document.activeElement && PR.contains(document.activeElement) ? document.activeElement.id : null;
      var h = '<div class="tlp-t">Blender scene · ' + esc(st.stem) + '</div>'
        + '<div class="tlb-st" title="' + esc(st.source) + '">' + esc(st.source) + '<br>working copy: ' + esc(st.project) + '/blender/' + esc(st.stem) + '.tmp</div>'
        + '<div class="tlp-row"><button class="ghost" id="tlbOpen" type="button" title="Open another .blend">📂 Open</button>'
        + '<button class="ghost" id="tlbReload" type="button" title="Drop the edits and read the .blend again">⟲ Reload</button>'
        + '<button class="ghost" id="tlbClose" type="button" title="' + (ext ? "Close the scene tools - the layer keeps this view (the scene stays open)" : "Back to the timeline\'s canvas (the scene stays open)") + '">✕</button></div>'
        + aiHtml(false)
        + '<div class="tlb-sec"><b>Objects</b> <span class="tlb-st">(click to select · 👁 hide)</span><div class="tlb-list">'
        + objs.map(function (oid) {
          var n = node(oid), ty = (S.E.objects[oid] || {}).import ? "model" : (objMeta(oid).type || "").toLowerCase(), del = isDeleted(oid), off = del || (n && !n.visible);
          if (del) return "";
          return '<div class="tlb-o' + (oid === id ? " sel" : "") + (off ? " off" : "") + '" data-o="' + esc(oid) + '"><span class="eye" data-eye="' + esc(oid) + '">'
            + (off ? "◌" : "👁") + '</span><span class="nm">' + esc(oid) + '</span><span class="ty">' + esc(ty) + (S.E.objects[oid] ? " ✎" : "") + (hasKeys(oid) ? " ◆" : "") + "</span></div>";
        }).join("") + "</div>"
        + '<div class="tlp-row"><select id="tlbAddSel" title="A 3D model in the project\'s models3d/ (🧊 on a gallery picture makes one)" style="flex:1">'
        + (S.modelList.length ? S.modelList.map(function (nm) { return '<option>' + esc(nm) + '</option>'; }).join("") : '<option value="">no .glb in models3d yet</option>')
        + '</select><button class="ghost" id="tlbAdd" type="button" title="Add it to the scene, 1 m tall, where the view looks"' + (S.modelList.length ? "" : " disabled") + '>＋ Model</button></div>';
      if (id) {
        var n = node(id), p = n ? n.getWorldPosition(new T.Vector3()) : null;
        h += '<div><b>' + esc(id) + '</b>' + (animated(id) ? ' <span class="tlb-st">animated in Blender - a move here is a key</span>' : "") + '</div>'
          + '<div class="tlp-g"><span>X</span><input type="number" step="0.1" id="tlbX" value="' + (p ? p.x.toFixed(3) : 0) + '" title="Blender X (world)">'
          + '<span>Y</span><input type="number" step="0.1" id="tlbY" value="' + (p ? (-p.z).toFixed(3) : 0) + '" title="Blender Y (world)">'
          + '<span>Z</span><input type="number" step="0.1" id="tlbZ" value="' + (p ? p.y.toFixed(3) : 0) + '" title="Blender Z (world, up)">'
          + '<span>Size</span><input type="number" step="0.05" id="tlbSc" value="' + (n ? n.scale.x.toFixed(3) : 1) + '" title="Uniform scale (the widget\'s S scales one axis)"></div>'
          + '<div class="tlp-row"><button class="ghost" id="tlbKey" type="button" title="Key its place at frame ' + S.frame + '">◆ Key</button>'
          + '<button class="ghost" id="tlbUnkey" type="button" title="Remove this frame\'s key"' + (e.keys && e.keys[String(S.frame)] ? "" : " disabled") + '>✕ Key</button>'
          + '<button class="ghost" id="tlbDup" type="button" title="Duplicate it (beside it)">⧉</button>'
          + '<button class="ghost" id="tlbHide" type="button" title="Hide / show it in the render">' + (n && n.visible ? "◌ Hide" : "👁 Show") + '</button>'
          + '<button class="ghost" id="tlbDel" type="button" title="Delete it (Ctrl+Z brings it back)">🗑</button>'
          + '<button class="ghost" id="tlbReset" type="button" title="Undo every edit on it">↺</button></div>'
          + '<div class="tlb-keys" id="tlbKeys"></div>';
      }
      if (!ext) h += '<div class="tlp-row"><label title="Every move keys the object at this frame (objects Blender animates are always keyed)"><input type="checkbox" id="tlbAuto"'
        + (S.autoKey ? " checked" : "") + '> Auto-key every move</label></div>';    // 2.546.0: not in the image editor
      h += '<div class="tlb-sec"><b>Save</b><div class="tlp-row"><select id="tlbMode" title="Where 💾 Save writes the scene">'
        + '<option value="bitgen">Only in bitGen (' + esc(st.stem) + '.blend in the project)</option>'
        + '<option value="writeback">Write back to the original .blend (keeps .blend1)</option>'
        + '<option value="copy">Copy to a new file (' + esc(st.stem) + '_bitgen.blend beside it)</option></select></div>'
        + '<div class="tlp-row"><button class="ghost" id="tlbSave" type="button"' + (S.busy ? " disabled" : "") + ' title="Blender writes the edits in (the project copy is always saved as .blend)">💾 Save</button>'
        + '<span class="tlb-st">' + Object.keys(S.E.objects).length + ' edited' + (st.saved && st.saved.at ? " · saved " + new Date(st.saved.at).toLocaleTimeString() : "") + '</span></div></div>'
        + '<div class="tlb-sec"><b>Render to real</b> <span class="tlb-st">frames ' + S.inF + '–' + S.outF + ' ([ In / Out ] under the view)</span>'
        + '<div class="tlp-g"><span>Camera</span><select id="tlbCamMode"><option value="scene"' + (S.view === "scene" && camScene ? " selected" : "") + (camScene ? "" : " disabled")
        + '>The scene camera</option><option value="view"' + (S.view === "free" || !camScene ? " selected" : "") + '>This view (still)</option></select>'
        + '<span>Engine</span><select id="tlbEngine"><option value="WORKBENCH">Solid (fast)</option><option value="EEVEE">EEVEE</option><option value="SCENE">Scene\'s own</option></select></div>'
        + '<textarea id="tlbLook" placeholder="Looks like … (3DREAL\'s trigger is added)">' + esc(store0.get("look." + st.stem, "")) + '</textarea>'
        + '<div class="tlp-g"><span>3DREAL</span><select id="tlbReal"><option value="">Auto (newest)</option><option value="3DREAL-strong-v2.safetensors">strong v2</option>'
        + '<option value="3DREAL-strong.safetensors">strong</option><option value="3DREAL-light.safetensors">light</option></select>'
        + '<span>Strength</span><input type="number" id="tlbStr" min="0" max="2" step="0.05" value="' + num(store0.get("str", 1), 1) + '"></div>'
        + '<div class="tlp-row"><label><input type="checkbox" id="tlbNow"' + (store0.get("now", true) ? " checked" : "") + '> Render in bitGen (LTX 2.3 · 3DREAL)</label></div>'
        + refsHtml(st)                                                                  // 2.540.0: 🖼 the reference docker's pictures
        + '<div class="tlp-row"><button class="ghost" id="tlbGo" type="button"' + (S.busy ? " disabled" : "") + '>🎬 Render to real</button>'
        + '<span class="tlb-st">' + renderLine() + '</span></div></div>';
      PR.innerHTML = h;
      $("tlbMode").value = st.mode || "bitgen";
      if ($("tlbAiEngine")) $("tlbAiEngine").value = store0.get("tlbAiEngine", "auto");
      $("tlbEngine").value = store0.get("engine", "WORKBENCH"); $("tlbReal").value = store0.get("real", "");
      wireProps();
      paintKeysRow();
      if (window.TlBlendPose) { try { window.TlBlendPose.props(PR); } catch (er) { /* the Pose section */ } }   // 2.461.0: blendpose.js
      if (focus && $(focus)) $(focus).focus();
    }
    /* 2.540.0 (Tim: "the block is a car, the reference for the car is in our reference docker ... and is animated with our
       3dreal"): each mesh -> a reference docker picture (by its name, or picked); with it on, Render to real = Blender's
       first frame made real with those pictures (an edit model), then 3DREAL animates it along the render */
    function rrObjects() { return ((S.meta && S.meta.objects) || []).filter(function (o) { return /^(MESH|CURVE|SURFACE|META|FONT)$/.test(o.type || "MESH") && !o.hidden && !(S.E.objects[o.id] || {}).deleted; }).map(function (o) { return { name: o.id }; }); }
    function rrRefs() { return window.H3Refs ? window.H3Refs.images() : []; }
    function rrMan(st) { return store0.get("rr." + st.stem, {}) || {}; }
    function rrStyles() {
      if (S.rrStyles) return; S.rrStyles = [];
      fetch("/api/realrefs/styles").then(j).then(function (l) { S.rrStyles = Array.isArray(l) ? l : []; var sel = $("tlbRefStyle"); if (sel) paint(); }).catch(function () { /* offline */ });
    }
    function refsHtml(st) {
      if (!window.RealRefs) return "";
      rrStyles();
      var on = !!store0.get("rr.on", false), refs = rrRefs(), objs = rrObjects(), items = RealRefs.resolve(objs, refs, rrMan(st));
      return '<div class="tlb-sec"><b>🖼 References</b> <span class="tlb-st">' + (refs.length ? items.length + " of " + objs.length + " object(s) have a picture" : "the reference docker has no pictures") + "</span>"
        + '<div class="tlp-row"><label title="Blender\'s first frame becomes a photo with the reference docker\'s pictures (an edit model: Picture 1 = the render, 2… = the references), then 3DREAL animates that photo along the render"><input type="checkbox" id="tlbRefsOn"' + (on ? " checked" : "") + "> Use them (a real first frame)</label>"
        + '<select id="tlbRefStyle" title="The edit model that makes the first frame - the one that takes the most pictures first">' + (S.rrStyles || []).map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === store0.get("rr.style", "") ? " selected" : "") + ">" + esc(x.name) + " (" + (x.max - 1) + " ref" + (x.max - 1 === 1 ? "" : "s") + ")</option>"; }).join("") + "</select></div>"
        + (on ? '<div id="tlbRefList">' + RealRefs.listHtml(objs, refs, rrMan(st)) + "</div>" : "") + "</div>";
    }
    function renderLine() {
      var r = S.render; if (!r) return "";
      if (S.rrState) return esc(RealRefs.stepText(S.rrState));
      if (r.state === "running") return "Blender " + (r.done || 0) + " / " + (r.of || "?") + " frames …";
      if (r.state === "done") return "✓ " + esc(r.name || "") + (r.job ? " · job " + esc(r.job) : "");
      if (r.state === "error") return "✗ " + esc(r.error || "");
      return "";
    }
    function paintKeysRow() {
      var K = $("tlbKeys"); if (!K || !S.sel) return;
      var e = S.E.objects[S.sel] || {}, own = Object.keys(S.orig[S.sel] || {}), mine = Object.keys(e.keys || {});
      var all = own.concat(mine).map(Number).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
      K.innerHTML = all.length ? all.map(function (f) { return '<button class="ghost" type="button" data-f="' + f + '" title="' + (mine.indexOf(String(f)) >= 0 ? "your key" : "Blender's key") + ' - go there"'
        + (f === S.frame ? ' style="border-color:var(--tiger)"' : "") + ">" + (mine.indexOf(String(f)) >= 0 ? "◆" : "◇") + f + "</button>"; }).join("") : '<span class="tlb-st">no keys</span>';
      Array.prototype.forEach.call(K.querySelectorAll("[data-f]"), function (b) { b.onclick = function () { goto(+b.dataset.f); paint(); }; });
    }
    function wireProps() {
      var on = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); };
      on("tlbOpen", "click", openDialog);
      on("tlbReload", "click", function () { if (S.st && confirm("Drop every edit and read " + S.st.source + " again?")) openPath(S.st.source, true); });
      on("tlbClose", "click", function () { show(false); });
      Array.prototype.forEach.call(PR.querySelectorAll("[data-o]"), function (el) { el.onclick = function (ev) { if (ev.target.dataset.eye) return; select(el.dataset.o); }; });
      Array.prototype.forEach.call(PR.querySelectorAll("[data-eye]"), function (el) { el.onclick = function () { hide(el.dataset.eye); }; });
      var place = function () {
        var id = S.sel, n = node(id); if (!n) return;
        var w = new T.Vector3(num($("tlbX").value, 0), num($("tlbZ").value, 0), -num($("tlbY").value, 0));   // Blender -> glTF
        if (n.parent) n.parent.worldToLocal(w);
        var tr = trsOf(n); tr.t = [w.x, w.y, w.z];
        var sc = num($("tlbSc").value, 1); tr.s = [sc, sc, sc];
        setSelTrs(tr);
      };
      ["tlbX", "tlbY", "tlbZ", "tlbSc"].forEach(function (k) { on(k, "change", place); });
      on("tlbKey", "click", keyNow); on("tlbUnkey", "click", unkeyNow); on("tlbDup", "click", dup);
      on("tlbHide", "click", function () { hide(S.sel); }); on("tlbDel", "click", del); on("tlbReset", "click", resetObj);
      on("tlbAuto", "change", function () { S.autoKey = $("tlbAuto").checked; store0.set("autokey", S.autoKey); });
      on("tlbMode", "change", function () { var v = $("tlbMode").value; post("/api/blendview/mode", { stem: S.st.stem, mode: v }).then(function (st) { S.st.mode = st.mode; }).catch(function () { /* kept here */ }); S.st.mode = v; });
      on("tlbSave", "click", save);
      on("tlbCamMode", "change", function () { setView($("tlbCamMode").value === "view" ? "free" : "scene"); });
      on("tlbEngine", "change", function () { store0.set("engine", $("tlbEngine").value); });
      on("tlbReal", "change", function () { store0.set("real", $("tlbReal").value); });
      on("tlbStr", "change", function () { store0.set("str", num($("tlbStr").value, 1)); });
      on("tlbNow", "change", function () { store0.set("now", $("tlbNow").checked); });
      on("tlbLook", "input", function () { store0.set("look." + S.st.stem, $("tlbLook").value); });
      on("tlbGo", "click", function () { renderReal(); });
      on("tlbRefsOn", "change", function () { store0.set("rr.on", $("tlbRefsOn").checked); paint(); });
      on("tlbRefStyle", "change", function () { store0.set("rr.style", $("tlbRefStyle").value); });
      if ($("tlbRefList") && window.RealRefs) RealRefs.bindList($("tlbRefList"), function (name, v) { var m = rrMan(S.st); if (v === "") delete m[name]; else m[name] = v; store0.set("rr." + S.st.stem, m); paint(); });
      on("tlbAdd", "click", function () { var v = $("tlbAddSel") && $("tlbAddSel").value; if (v) addModel(v).catch(function (er) { alert(String(er.message || er)); }); });
      on("tlbAiToggle", "click", function () { S.aiOpen = !S.aiOpen; paint(); });
      on("tlbAiGo", "click", function () { aiBuild(); });
      on("tlbAiStop", "click", function () { if (S.ai && S.ai.id) post("/api/sceneai/stop", { id: S.ai.id }).catch(function () { /* fine */ }); });
      on("tlbAiPrompt", "input", function () { store0.set("aiPrompt", $("tlbAiPrompt").value); });
      ["tlbAiSecs", "tlbAiMax", "tlbAiEngine"].forEach(function (k) { on(k, "change", function () { store0.set(k, $(k).value); }); });
      on("tlbAiModels", "change", function () { store0.set("tlbAiModels", $("tlbAiModels").checked); });
    }

    /* ---------- ✨ Build a scene with AI (lib/sceneAI.js) */
    function imageStyleId() { var s = $("styleSel"); return s ? s.value : ""; }
    function imageStyleName() { var s = $("styleSel"); return s && s.selectedIndex >= 0 && s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : ""; }
    function aiHtml(open) {
      var a = S.ai, running = !!(a && a.state === "running");
      var show = open || S.aiOpen || running;
      var h = '<div class="tlb-sec"><b>✨ ' + (S.st ? "New scene" : "Build a scene") + ' with AI</b> '
        + (open ? "" : '<button class="ghost" id="tlbAiToggle" type="button" style="padding:0 6px;font-size:.66rem">' + (show ? "▾" : "▸") + '</button>');
      if (!show) return h + '</div>';
      h += '<div class="tlb-st">Describe it - the LLM lays it out, Blender builds it, it opens here. Detailed things (an animal, a statue …) '
        + 'are drawn with your image style and turned into 3D.</div>'
        + '<textarea id="tlbAiPrompt" placeholder="e.g. a rainy street at night, two parked cars, a man with an umbrella, a dog, the camera slowly moving forward">'
        + esc(store0.get("aiPrompt", "")) + '</textarea>'
        + '<div class="tlp-g"><span>Seconds</span><input type="number" id="tlbAiSecs" min="1" max="30" step="1" value="' + num(store0.get("tlbAiSecs", 5), 5) + '">'
        + '<span>Max 3D</span><input type="number" id="tlbAiMax" min="0" max="8" step="1" value="' + num(store0.get("tlbAiMax", 3), 3) + '" title="How many detailed objects may become 3D models (each is a picture + a 3D job in the queue)">'
        + '<span>3D</span><select id="tlbAiEngine" title="Image to 3D (ComfyUI)"><option value="auto">Hunyuan3D 2.1 - shape (default)</option>'
        + '<option value="trellis">TRELLIS.2 - textured</option><option value="hunyuan">Hunyuan3D only</option></select>'
        + '<span></span><label title="Off = every object is drawn from Blender\'s simple shapes (no pictures, no 3D jobs)"><input type="checkbox" id="tlbAiModels"'
        + (store0.get("tlbAiModels", true) ? " checked" : "") + '> 3D models</label></div>'
        + '<div class="tlb-st">pictures with: ' + esc(imageStyleName() || "(pick an image style in Basic Settings)") + '</div>'
        + '<div class="tlp-row"><button class="ghost" id="tlbAiGo" type="button"' + (running ? " disabled" : "") + '>✨ Build</button>'
        + (running ? '<button class="ghost" id="tlbAiStop" type="button">■ Stop</button>' : "") + '</div>'
        + '<div class="tlb-st" id="tlbAiLog" style="max-height:120px;overflow:auto;white-space:pre-wrap">' + aiLog() + '</div>';
      return h + '</div>';
    }
    function aiLog() { var a = S.ai; return a ? esc((a.lines || []).slice(-8).join("\n") + (a.state === "error" ? "\n✗ " + (a.error || "") : "")) : ""; }
    function aiBuild(o) {
      var x = o || {};
      var prompt = x.prompt !== undefined ? x.prompt : ($("tlbAiPrompt") ? $("tlbAiPrompt").value : "");
      if (!String(prompt).trim()) { alert("Describe the scene first"); return Promise.resolve(null); }
      var body = { prompt: prompt, seconds: x.seconds || ($("tlbAiSecs") ? num($("tlbAiSecs").value, 5) : 5),
        engine: x.engine || ($("tlbAiEngine") ? $("tlbAiEngine").value : "auto"),
        models: x.models !== undefined ? !!x.models : ($("tlbAiModels") ? $("tlbAiModels").checked : true),
        maxModels: x.maxModels !== undefined ? x.maxModels : ($("tlbAiMax") ? num($("tlbAiMax").value, 3) : 3),
        image_style_id: x.image_style_id !== undefined ? x.image_style_id : imageStyleId() };
      if ($("tlbAiEngine")) store0.set("tlbAiEngine", body.engine);
      return post("/api/sceneai/build", body).then(function (r) {
        S.ai = { id: r.id, state: "running", lines: ["starting …"] }; S.aiOpen = true; paint();
        log("✨ building a scene: " + String(prompt).slice(0, 80));
        return new Promise(function (ok) {
          (function poll() {
            fetch("/api/sceneai/status?id=" + r.id).then(j).then(function (st) {
              var was = S.ai && S.ai.state;
              S.ai = st;
              if ($("tlbAiLog")) $("tlbAiLog").innerHTML = aiLog();
              if ((st.jobs || []).length && typeof refreshJobs === "function") { try { refreshJobs(); } catch (e) { /* fine */ } }
              if (st.state === "running") { if (was !== "running") paint(); setTimeout(poll, 1000); return; }
              if (st.state === "done" && st.scene) {
                listModels();
                log("✨ " + ((st.plan || {}).title || "scene") + " built -> " + st.file);
                S.st = null; load(st.scene).then(function () { S.aiOpen = false; paint(); ok(st); });
                return;
              }
              paint(); ok(st);
            }).catch(function () { setTimeout(poll, 1500); });
          })();
        });
      }).catch(function (e) { alert(String(e.message || e)); return null; });
    }

    /* ---------- the HUD + bar */
    $("tlbCamScene").onclick = function () { setView("scene"); };
    $("tlbCamFree").onclick = function () { setView("free"); };
    $("tlbG").onclick = function () { setGizmo("translate"); }; $("tlbR").onclick = function () { setGizmo("rotate"); }; $("tlbS").onclick = function () { setGizmo("scale"); };
    $("tlbStudio").onclick = function () { S.studio = !S.studio; store0.set("studio", S.studio); paint(); dirty(); };
    $("tlbZoomIn").onclick = function () { zoomBy(1 / 1.25); };           // 2.546.0
    $("tlbZoomOut").onclick = function () { zoomBy(1.25); };
    $("tlbZoomObj").onclick = zoomToObject;
    $("tlbFirst").onclick = function () { goto(S.inF); };
    $("tlbPlay").onclick = play;
    $("tlbFrame").addEventListener("input", function () { goto($("tlbFrame").value); });
    $("tlbIn").onclick = function () { setRange(S.frame, Math.max(S.frame, S.outF)); };
    $("tlbOut").onclick = function () { setRange(Math.min(S.frame, S.inF), S.frame); };
    msg("");

    // the canvas's Properties are repainted often - keep ours in front of them while the scene is shown
    setInterval(function () { if (S.on) placeProps(); }, 700);

    /* 2.542.0: the view as shown, at any size (the widget + the grid left out) */
    function viewPicture(w, h) {      // (not snapshot() - that is the edits' undo copy)
      if (!R || !root) return null;
      w = Math.max(16, Math.round(w)); h = Math.max(16, Math.round(h));
      var cam = curCam(), pr = R.getPixelRatio(), a0 = cam.aspect, hp = tc && (tc.getHelper ? tc.getHelper() : tc), hv = hp ? hp.visible : false, gv = grid ? grid.visible : false;
      if (hp) hp.visible = false; if (grid) grid.visible = false;
      R.setPixelRatio(1); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      R.render(scene, cam);
      var c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(R.domElement, 0, 0, w, h);
      if (hp) hp.visible = hv; if (grid) grid.visible = gv;
      cam.aspect = a0; cam.updateProjectionMatrix(); R.setPixelRatio(pr); resize();
      return c;
    }
    /** 2.542.0: Blender renders this frame through the view (free view) or the scene camera -> {png} (lib/blendView.still) */
    function stillReal(o) {
      o = o || {};
      if (!S.st) return Promise.reject(new Error("no Blender scene is open"));
      var body = { stem: S.st.stem, frame: S.frame, view: S.view === "free" || !camScene ? viewOf() : null, engine: o.engine || "EEVEE", w: o.w, h: o.h };
      return post("/api/blendview/edits", { stem: S.st.stem, edits: S.E }).then(function () { return post("/api/blendview/still", body); }).then(function (r) {
        return new Promise(function (ok, no) {
          (function poll() {
            fetch("/api/blendview/still/" + r.id).then(j).then(function (st) {
              if (st.state === "running") { setTimeout(poll, 600); return; }
              if (st.state === "done" && st.png) ok(st); else no(new Error(st.error || "Blender wrote no picture"));
            }).catch(function () { setTimeout(poll, 1500); });
          })();
        });
      });
    }

    window.TlBlend = {
      attach: attach, detach: detach, openUi: openUi, snapshot: viewPicture, still: stillReal, host: function () { return ext; },
      open: openPath, show: show, state: S, select: select, setTrs: setSelTrs, key: keyNow, unkey: unkeyNow, dup: dup, del: del,
      hide: hide, reset: resetObj, undo: undo, goto: goto, setRange: setRange, setView: setView, setGizmo: setGizmo, save: save,
      render: renderReal, view: viewOf, node: node, frameAll: frameAll, zoomBy: zoomBy, zoomToObject: zoomToObject,
      look: function () { return camFree && orbit ? { dist: camFree.position.distanceTo(orbit.target), target: orbit.target.toArray(), view: S.view } : null; },   // 2.546.0: where the free view looks (tests)
      trs: function (id) { var n = node(id); return n ? trsOf(n) : null; },
      draw: function () { if (R) R.render(scene, curCam()); }, _cam: curCam,
      addModel: addModel, models: listModels, ai: aiBuild,
      // 2.461.0 (blendpose.js): the pose preview + the image editor hand-over
      root: function () { return root; }, three: function () { return T; }, camFree: function () { return camFree; }, orbit: function () { return orbit; },
      persist: persist, pushUndo: pushUndo, drawFrame: drawFrame, msg: msg, paint: paint,
      // 2.405.0: the scene open on the server changed (a Daz merge / a Daz scene opened) - show it again, the view kept
      reload: function () {
        return fetch("/api/blendview/current").then(j).then(function (c) {
          if (!c || !c.stem) return null;
          var same = S.st && S.st.stem === c.stem;
          if (same) c._framed = true;
          show(true); return load(c);
        });
      },
    };
  }
})();
