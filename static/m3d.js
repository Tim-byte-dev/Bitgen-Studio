/* bitGen Studio — 3D LAYERS: the renderer (2.382.0), window.H3M3D.
 *
 * Tim (verbatim): "can we add 3d model(fbx, obj) to timeline canvas and 3d text?"
 *
 * A 3D layer is a VIDEO-layer clip carrying `m3d` (ext/timelinedock/m3d.js makes and edits it). This draws it with
 * three.js (static/vendor/three-m3d.min.js - loaded the first time a 3D layer is shown, never from the internet):
 *   frame(c, tau)          -> {canvas, w, h} the clip's picture at tau seconds into it (transparent background), or
 *                             null while its model / font is still loading (onChange fires when it is ready)
 *   bake(c, {fps, onProgress}) -> renders every frame, sends them (POST /api/tlcanvas/m3d/frame) and has the server
 *                             encode video/m3d_<id>.webm (see-through VP9) - what the compile overlays, so what the
 *                             canvas shows is what Compile writes. Resolves {name, dur, frames}.
 *   rotAt(c, tau)          -> the X / Y / Z rotation (°) at tau: the base rotation (◆ keyframed "rx" / "ry" / "rz" when
 *                             keyed) + spin (°/s) x tau
 *   defaults(type, W, H)   -> a new layer's spec
 *   sig(c)                 -> what a bake depends on (the spec, the length, the rotation keyframes)
 * The spec (c.m3d): {type: "text" | "model", text, font, bold, italic, depth, bevel, model, keepMat, color, metal,
 * rough, light, rx, ry, rz, spinX, spinY, spinZ, w, h, anim}.
 * 2.385.0 (Tim: "allow user to add lights to 3d scene - allow user to change the brightness of the lights - allow user
 * to add materials to 3d objects ... add 3d interactive rotate and transform and move widgets"):
 *   studio            the three built-in lights on (default) / off; `light` stays their brightness
 *   lights            [{id, type: point | spot | sun | ambient | sky, on, color, power (brightness 0-20), x, y, z, angle}]
 *                     - world space around the object (it is 1 unit across, centred; the camera looks from +Z)
 *   mat               the material beyond colour / metal / rough: {preset, emissive, glow, opacity, clearcoat, glass, ior,
 *                     wire, flat, map (a picture in models3d), repeat}; PRESETS below
 *   parts             a model's parts: {"<n>": "own" | "layer" | <preset>} (n = the mesh's place in the file)
 *   pz, sx, sy, sz    depth (toward the camera, units) and the object's own scale per axis - keyframed like rx / ry / rz
 *   view(c)           where the last frame put the object in its picture: centre, the radius of its unit sphere and its
 *                     rotated X / Y / Z axes in picture pixels - the canvas's 3D widgets are drawn from it
 *   parts(c)          a loaded model's parts [{n, name}]; reload(name) - a model file that changed (the Blender link) w x h is the picture's size in pixels (what the canvas
 * places with the clip's X / Y / Scale / Rotation, like a video's own size). The object is centred and framed to fit
 * (models: their bounding sphere, so a spin never leaves the picture; text: its box, with a margin).
 */
(function () {
  "use strict";
  var T = null, loading = null, listeners = [];
  var R = null, scene = null, cam = null, amb = null, key = null, fill = null;
  var fonts = {}, models = {}, objs = {}, outs = new WeakMap(), views = new WeakMap(), texs = {}, lightSets = {}, modelVer = {};
  /* 2.385.0 material presets: what a preset sets (null colour = keep the layer's colour) */
  var PRESETS = {
    gold: { label: "Gold", color: "#ffcc55", metal: 1, rough: 0.25 },
    silver: { label: "Silver", color: "#e6e8ea", metal: 1, rough: 0.2 },
    chrome: { label: "Chrome", color: "#ffffff", metal: 1, rough: 0.03 },
    copper: { label: "Copper", color: "#d9825b", metal: 1, rough: 0.3 },
    steel: { label: "Brushed steel", color: "#b8bcc2", metal: 1, rough: 0.45 },
    plastic: { label: "Glossy plastic", color: null, metal: 0, rough: 0.25, clearcoat: 0.6 },
    clay: { label: "Matte clay", color: "#c9b8a6", metal: 0, rough: 0.95 },
    rubber: { label: "Rubber", color: "#232323", metal: 0, rough: 0.9 },
    glass: { label: "Glass", color: "#ffffff", metal: 0, rough: 0.03, glass: 1, ior: 1.5 },
    frosted: { label: "Frosted glass", color: "#f4f8ff", metal: 0, rough: 0.35, glass: 1, ior: 1.45 },
    carpaint: { label: "Car paint", color: "#b0121b", metal: 0.6, rough: 0.3, clearcoat: 1 },
    neon: { label: "Neon glow", color: "#33aaff", metal: 0, rough: 0.5, emissive: "#33aaff", glow: 3 },
    wire: { label: "Wireframe", color: null, metal: 0, rough: 0.6, wire: true }
  };
  var LIGHT_TYPES = { point: "Point", spot: "Spot", sun: "Sun", ambient: "Ambient", sky: "Sky" };
  function changed() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* a listener never breaks the renderer */ } }); }
  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }

  function load() {
    if (T) return Promise.resolve(T);
    if (loading) return loading;
    loading = new Promise(function (ok, no) {
      if (window.H3THREE) { T = window.H3THREE; return ok(T); }
      var s = document.createElement("script");
      s.src = "/static/vendor/three-m3d.min.js";
      s.onload = function () { T = window.H3THREE; if (T) ok(T); else no(new Error("three.js did not load")); };
      s.onerror = function () { loading = null; no(new Error("static/vendor/three-m3d.min.js is missing")); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function setup() {
    if (R) return;
    var cv = document.createElement("canvas");
    R = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    R.setClearColor(0x000000, 0);
    R.outputColorSpace = T.SRGBColorSpace;
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(30, 1, 0.01, 1000);
    amb = new T.AmbientLight(0xffffff, 0.6);
    key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4);
    fill = new T.DirectionalLight(0xffffff, 0.5); fill.position.set(-3, -1, 2);
    scene.add(amb, key, fill);
  }
  /* ---- 2.385.0 the material: colour / metal / rough (the layer's) + mat (preset and the rest) */
  function matSpec(m, preset) {
    var x = m.mat || {}, P = preset ? PRESETS[preset] : null;
    var o = { color: m.color || "#ffffff", metal: num(m.metal, 0.2), rough: num(m.rough, 0.4), emissive: x.emissive || "#000000",
              glow: num(x.glow, 0), opacity: num(x.opacity, 1), clearcoat: num(x.clearcoat, 0), glass: num(x.glass, 0),
              ior: num(x.ior, 1.5), wire: !!x.wire, flat: !!x.flat, map: x.map || "", repeat: num(x.repeat, 1) };
    if (P) Object.keys(P).forEach(function (k) { if (k !== "label" && P[k] != null) o[k] = P[k]; });
    return o;
  }
  function tex(name, repeat) {
    var k = name + "|" + repeat;
    if (texs[k]) return texs[k].t;
    texs[k] = { t: null };
    new T.TextureLoader().load("/api/tlcanvas/model/" + encodeURIComponent(name), function (t) {
      t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat);
      texs[k].t = t; Object.keys(objs).forEach(function (kk) { if (kk.indexOf(name) >= 0) delete objs[kk]; }); changed();
    }, undefined, function () { texs[k].err = true; });
    return null;
  }
  function texReady(m) { var x = m.mat || {}; return x.map ? tex(x.map, Math.max(0.01, num(x.repeat, 1))) : null; }
  function physical(o) {
    var M = new T.MeshPhysicalMaterial({
      color: new T.Color(o.color), metalness: Math.max(0, Math.min(1, o.metal)), roughness: Math.max(0, Math.min(1, o.rough)),
      emissive: new T.Color(o.emissive || "#000000"), emissiveIntensity: Math.max(0, Math.min(20, o.glow)),
      clearcoat: Math.max(0, Math.min(1, o.clearcoat)), transmission: Math.max(0, Math.min(1, o.glass)),
      ior: Math.max(1, Math.min(2.333, o.ior)), wireframe: o.wire, flatShading: o.flat,
      transparent: o.opacity < 1 || o.glass > 0, opacity: Math.max(0, Math.min(1, o.opacity)), thickness: o.glass > 0 ? 0.5 : 0 });
    if (o.map) { var t = tex(o.map, Math.max(0.01, o.repeat)); if (t) M.map = t; }
    return M;
  }
  function mat(m) { return physical(matSpec(m)); }
  /* ---- 2.385.0 the lights: the studio three (on unless studio === false, brightness = light) + the layer's own */
  function lightsFor(m) {
    var list = Array.isArray(m.lights) ? m.lights : [];
    var k = JSON.stringify(list);
    if (lightSets[k]) return lightSets[k];
    var g = new T.Group();
    list.forEach(function (L) {
      if (!L || L.on === false) return;
      var col = new T.Color(L.color || "#ffffff"), b = Math.max(0, Math.min(20, num(L.power, 1))), o;
      var pos = [num(L.x, 2), num(L.y, 2), num(L.z, 3)];
      if (L.type === "ambient") o = new T.AmbientLight(col, 0.6 * b);
      else if (L.type === "sky") o = new T.HemisphereLight(col, new T.Color("#202020"), 0.8 * b);
      else if (L.type === "sun") { o = new T.DirectionalLight(col, 1.6 * b); o.position.set(pos[0], pos[1], pos[2]); }
      else if (L.type === "spot") {
        o = new T.SpotLight(col, 25 * b, 0, Math.max(1, Math.min(89, num(L.angle, 30))) * Math.PI / 180, 0.35, 2);
        o.position.set(pos[0], pos[1], pos[2]); g.add(o.target);
      } else { o = new T.PointLight(col, 25 * b, 0, 2); o.position.set(pos[0], pos[1], pos[2]); }
      g.add(o);
    });
    g.userData.lights = true;
    Object.keys(lightSets).forEach(function (kk) { delete lightSets[kk]; });   // one set kept: the last one asked for
    lightSets[k] = g;
    return g;
  }

  function defaults(type, W, H) {
    W = W || 1280; H = H || 720;
    var base = { type: type, color: "#f59e2c", metal: 0.25, rough: 0.35, light: 1, rx: 0, ry: 0, rz: 0,
                 spinX: 0, spinY: type === "model" ? 30 : 0, spinZ: 0, anim: true };
    if (type === "text") {
      base.text = "3D Text"; base.font = "Arial"; base.bold = true; base.italic = false; base.depth = 0.25; base.bevel = 0.03;
      base.w = Math.round(W * 0.7); base.h = Math.round(H * 0.3);
    } else {
      base.model = ""; base.keepMat = true; base.color = "#d8d2c4";
      base.w = Math.round(H * 0.6); base.h = Math.round(H * 0.6);
    }
    return base;
  }
  function kfVal(c, tau, prop, d) {
    var K = window.H3Keyframes;
    return K && K.has(c.kf, prop) ? num(K.value(c.kf, tau, prop, d), d) : d;
  }
  function rotAt(c, tau) {
    var m = c.m3d || {};
    return { x: kfVal(c, tau, "rx", num(m.rx, 0)) + num(m.spinX, 0) * tau,
             y: kfVal(c, tau, "ry", num(m.ry, 0)) + num(m.spinY, 0) * tau,
             z: kfVal(c, tau, "rz", num(m.rz, 0)) + num(m.spinZ, 0) * tau };
  }
  /* 2.385.0: depth and the object's own scale - keyed like the rotation */
  function placeAt(c, tau) {
    var m = c.m3d || {};
    return { pz: kfVal(c, tau, "pz", num(m.pz, 0)), sx: kfVal(c, tau, "sx", num(m.sx, 1)),
             sy: kfVal(c, tau, "sy", num(m.sy, 1)), sz: kfVal(c, tau, "sz", num(m.sz, 1)) };
  }
  var KEYED = ["rx", "ry", "rz", "pz", "sx", "sy", "sz"];
  function sig(c) {
    var kf = (c.kf || []).filter(function (k) { return KEYED.some(function (p) { return p in k; }); })
      .map(function (k) { return [k.at].concat(KEYED.map(function (p) { return k[p]; }), [k.ease || ""]); });
    var len = Math.max(0, num(c.out, 0) - num(c.in, 0)) || num(c.dur, 0);
    return JSON.stringify([c.m3d, Math.round(len * 1000), kf]);
  }

  /* ---- what a spec draws: a font (the machine's TTF, routes/tlCanvas.js) and a model file */
  function font(m) {
    var k = (m.font || "Arial") + "|" + (m.bold ? 1 : 0) + (m.italic ? 1 : 0);
    if (fonts[k]) return fonts[k];
    fonts[k] = { ready: false };
    fetch("/api/tlcanvas/font?family=" + encodeURIComponent(m.font || "Arial") + "&bold=" + (m.bold ? 1 : 0) + "&italic=" + (m.italic ? 1 : 0))
      .then(function (r) { if (!r.ok) throw new Error("no font"); return r.arrayBuffer(); })
      .then(function (buf) { fonts[k] = { ready: true, font: new T.Font(new T.TTFLoader().parse(buf)) }; changed(); })
      .catch(function (e) { fonts[k] = { ready: true, error: String(e.message || e) }; changed(); });
    return fonts[k];
  }
  function model(name) {
    if (models[name]) return models[name];
    models[name] = { ready: false };
    var url = "/api/tlcanvas/model/" + encodeURIComponent(name) + (modelVer[name] ? "?v=" + modelVer[name] : ""), base = "/api/tlcanvas/model/";
    var done = function (obj) {
      var clips = obj.animations || [];
      models[name] = { ready: true, obj: obj, clips: clips, mixer: clips.length ? new T.AnimationMixer(obj) : null };
      if (models[name].mixer) clips.forEach(function (a) { models[name].mixer.clipAction(a).play(); });
      changed();
    };
    var fail = function (e) { models[name] = { ready: true, error: String((e && e.message) || e) }; changed(); };
    if (/\.(glb|gltf)$/i.test(name)) {         // 2.385.0: glTF (what the Blender add-on sends)
      var gl = new T.GLTFLoader(); gl.setResourcePath(base);
      gl.load(url, function (g) { var sc = g.scene || g.scenes[0]; sc.animations = g.animations || []; done(sc); }, undefined, fail);
    } else if (/\.fbx$/i.test(name)) {
      var fl = new T.FBXLoader(); fl.setResourcePath(base);
      fl.load(url, done, undefined, fail);
    } else {
      var mtl = name.replace(/\.obj$/i, ".mtl");
      fetch(base + encodeURIComponent(mtl), { method: "HEAD" }).then(function (r) {
        var ol = new T.OBJLoader();
        if (!r.ok) return ol.load(url, done, undefined, fail);
        var ml = new T.MTLLoader(); ml.setPath(base); ml.setResourcePath(base);
        ml.load(encodeURIComponent(mtl), function (mats) { mats.preload(); ol.setMaterials(mats); ol.load(url, done, undefined, fail); },
                undefined, function () { ol.load(url, done, undefined, fail); });
      }).catch(fail);
    }
    return models[name];
  }
  /* the clip's object, centred on the origin and scaled to a unit size; rebuilt when its look changes */
  function object(c) {
    var m = c.m3d || {}, k;
    if (m.type === "text") {
      k = JSON.stringify(["t", m.text, m.font, m.bold, m.italic, m.depth, m.bevel, matSpec(m), !!texReady(m)]);
      var f = font(m);
      if (!f.ready) return null;
      if (f.error) return { error: "font: " + f.error };
      var hit = objs[k];
      if (!hit) {
        var g = new T.TextGeometry(String(m.text == null ? "" : m.text) || " ", { font: f.font, size: 1, depth: Math.max(0.001, num(m.depth, 0.25)),
          curveSegments: 10, bevelEnabled: num(m.bevel, 0) > 0, bevelThickness: num(m.bevel, 0), bevelSize: num(m.bevel, 0) * 0.6, bevelSegments: 3 });
        g.computeBoundingBox(); g.center();
        var mesh = new T.Mesh(g, mat(m));
        var root = new T.Group(); root.add(mesh);
        var bb = g.boundingBox, sz = new T.Vector3(); bb.getSize(sz);
        hit = objs[k] = { root: root, box: sz, fit: "box" };
      }
      return hit;
    }
    if (!m.model) return { error: "pick a model file" };
    var md = model(m.model);
    if (!md.ready) return null;
    if (md.error) return { error: md.error };
    k = JSON.stringify(["m", m.model, m.keepMat, matSpec(m), m.parts || {}, !!texReady(m), modelVer[m.model] || 0]);
    if (!objs[k]) {
      var o = md.obj;
      var box3 = new T.Box3().setFromObject(o), ctr = new T.Vector3(), s3 = new T.Vector3();
      box3.getCenter(ctr); box3.getSize(s3);
      var r = Math.max(1e-6, s3.length() / 2);
      var holder = new T.Group(), inner = new T.Group();
      inner.add(o); inner.position.set(-ctr.x / r, -ctr.y / r, -ctr.z / r); inner.scale.setScalar(1 / r);
      holder.add(inner);
      // the file's own materials are kept aside, so "keep materials" can always come back; 2.385.0: each PART can
      // have its own (the file's, the layer's, a preset)
      var mm = mat(m), parts = m.parts || {}, list = [], pn = 0;
      o.traverse(function (n) {
        if (!n.isMesh) return;
        if (!n.userData.origMat) n.userData.origMat = n.material;
        var i = pn++, use = parts[String(i)] || (m.keepMat ? "own" : "layer");
        list.push({ n: i, name: n.name || (n.userData.origMat && n.userData.origMat.name) || "part " + (i + 1) });
        n.material = use === "own" ? n.userData.origMat : use === "layer" ? mm : PRESETS[use] ? physical(matSpec(m, use)) : mm;
      });
      // one model file is one object: an older look of it lets go (it moved under this holder)
      var mk = JSON.stringify(m.model);
      Object.keys(objs).forEach(function (kk) { if (kk !== k && kk.indexOf('["m",' + mk + ",") === 0) delete objs[kk]; });
      objs[k] = { root: holder, box: new T.Vector3(2, 2, 2), fit: "sphere", mixer: md.mixer, inner: inner, parts: list };
    }
    return objs[k];
  }

  /* the picture at tau: the object rotated, framed in w x h, on a transparent background */
  function frame(c, tau) {
    var m = c.m3d; if (!m) return null;
    if (!T) { load().then(changed).catch(function () { changed(); }); return null; }
    setup();
    var o = object(c);
    if (!o) return null;
    var w = Math.max(16, Math.min(4096, Math.round(num(m.w, 640)))), h = Math.max(16, Math.min(4096, Math.round(num(m.h, 640))));
    var out = outs.get(c);
    if (!out) { out = document.createElement("canvas"); outs.set(c, out); }
    if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    var g = out.getContext("2d");
    g.clearRect(0, 0, w, h);
    if (o.error) {
      g.fillStyle = "rgba(196,43,28,.35)"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff"; g.font = Math.max(12, Math.round(h / 14)) + "px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("3D: " + o.error, w / 2, h / 2, w - 10);
      return { canvas: out, w: w, h: h, error: o.error };
    }
    // the object alone in the scene, with its lights
    scene.children.filter(function (n) { return n.userData.m3d || n.userData.lights; }).forEach(function (n) { scene.remove(n); });
    o.root.userData.m3d = true;
    scene.add(o.root);
    scene.add(lightsFor(m));
    var rot = rotAt(c, tau), D = Math.PI / 180, pl = placeAt(c, tau);
    o.root.rotation.set(rot.x * D, rot.y * D, rot.z * D);
    o.root.scale.set(Math.max(0.01, pl.sx), Math.max(0.01, pl.sy), Math.max(0.01, pl.sz));
    if (o.mixer && m.anim !== false) o.mixer.setTime(tau);
    var L = m.studio === false ? 0 : Math.max(0, num(m.light, 1));
    amb.intensity = 0.6 * L; key.intensity = 1.6 * L; fill.intensity = 0.5 * L;
    // framing: fit the sphere (r = 1) or the text's box (with 12% margin) into w x h
    R.setPixelRatio(1); R.setSize(w, h, false);
    cam.aspect = w / h;
    var vfov = cam.fov * D, aspect = w / h, dist;
    if (o.fit === "sphere") {
      var fitH = 1.08 / Math.sin(vfov / 2), fitW = 1.08 / Math.sin(Math.atan(Math.tan(vfov / 2) * aspect));
      dist = Math.max(fitH, fitW);
    } else {
      var bw = o.box.x * 1.12, bh = o.box.y * 1.12;
      dist = Math.max(bh / 2 / Math.tan(vfov / 2), bw / 2 / (Math.tan(vfov / 2) * aspect)) + o.box.z / 2;
    }
    cam.position.set(0, 0, dist); cam.near = Math.max(0.001, dist / 100); cam.far = dist * 100; cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    o.root.position.set(0, 0, Math.max(-dist * 4, Math.min(dist - 0.3, pl.pz)));   // depth: never behind the lens
    o.root.updateMatrixWorld(true);
    R.render(scene, cam);
    g.drawImage(R.domElement, 0, 0);
    views.set(c, viewOf(o.root, w, h, dist));
    return { canvas: out, w: w, h: h };
  }

  /* 2.385.0 where the object sits in its picture (the canvas's 3D widgets): picture pixels */
  function viewOf(root, w, h, dist) {
    var P = function (v) { var p = v.clone().project(cam); return [(p.x + 1) / 2 * w, (1 - p.y) / 2 * h]; };
    var c0 = root.position.clone(), q = root.quaternion;
    var ctr = P(c0), right = P(c0.clone().add(new T.Vector3(1, 0, 0)));
    var ax = {};
    [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]].forEach(function (a) {
      var v = new T.Vector3(a[1][0], a[1][1], a[1][2]).applyQuaternion(q).multiplyScalar(1.1);
      var e = P(c0.clone().add(v)); ax[a[0]] = [e[0] - ctr[0], e[1] - ctr[1]];
    });
    return { w: w, h: h, cx: ctr[0], cy: ctr[1], r: Math.hypot(right[0] - ctr[0], right[1] - ctr[1]), ax: ax, dist: dist, pz: c0.z };
  }
  function partsOf(c) {
    var m = c.m3d || {}; if (m.type !== "model" || !m.model) return [];
    var hit = null;
    Object.keys(objs).forEach(function (k) { if (k.indexOf('["m",' + JSON.stringify(m.model) + ",") === 0) hit = objs[k]; });
    return hit && hit.parts ? hit.parts : [];
  }
  function reload(name) {
    modelVer[name] = Date.now();
    delete models[name];
    var mk = '["m",' + JSON.stringify(name) + ",";
    Object.keys(objs).forEach(function (k) { if (k.indexOf(mk) === 0) delete objs[k]; });
    changed();
  }

  /* ---- the bake: every frame -> the server -> video/m3d_<id>.webm */
  function bake(c, o) {
    o = o || {};
    var fps = o.fps || 24;
    var len = Math.max(0, num(c.out, 0) - num(c.in, 0)) || num(c.dur, 0) || 5;
    var n = Math.max(1, Math.round(len * fps));
    var id = c.mid;
    return load().then(function () {
      setup();
      // wait for the model / font (a first bake can come before the canvas drew it)
      return new Promise(function (ok, no) {
        var tries = 0;
        (function poll() {
          var f = frame(c, 0);
          if (f && f.error) return no(new Error(f.error));
          if (f) return ok();
          if (++tries > 600) return no(new Error("the 3D model / font did not load"));
          setTimeout(poll, 100);
        })();
      });
    }).then(function () {
      // frame 0 first (it starts the bake afresh on the server), then up to 4 frames in flight - each frame's PNG is
      // taken from the picture the moment it is drawn (toBlob copies it), so the next one can be drawn meanwhile
      // 2.385.0: a model reloaded mid-bake (the Blender live link) draws nothing for a moment - wait for it
      var drawn = function (i) {
        return new Promise(function (ok, no) {
          var tries = 0;
          (function again() {
            var f = frame(c, i / fps);
            if (f && f.error) return no(new Error(f.error));
            if (f) return f.canvas.toBlob(ok, "image/png");     // taken NOW: the next frame redraws the same canvas
            if (++tries > 600) return no(new Error("the 3D model / font did not load"));
            setTimeout(again, 100);
          })();
        });
      };
      var send = function (i) {
        return drawn(i).then(function (blob) {
          return fetch("/api/tlcanvas/m3d/frame?id=" + encodeURIComponent(id) + "&i=" + i, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob });
        }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); }); });
      };
      var sent = 0;
      var tick = function () { sent++; if (o.onProgress) o.onProgress(sent, n); };
      return send(0).then(tick).then(function () {
        return new Promise(function (ok, no) {
          var next = 1, live = 0, failed = false;
          var pump = function () {
            if (failed) return;
            if (next >= n && !live) return ok();
            while (live < 4 && next < n) {
              live++;
              send(next++).then(function () { live--; tick(); pump(); }).catch(function (e) { failed = true; no(e); });
            }
          };
          pump();
        });
      });
    }).then(function () {
      return fetch("/api/tlcanvas/m3d/encode", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, fps: fps, frames: n }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
    });
  }

  window.H3M3D = { load: load, frame: frame, bake: bake, rotAt: rotAt, defaults: defaults, sig: sig,
                   placeAt: placeAt, KEYED: KEYED, PRESETS: PRESETS, LIGHT_TYPES: LIGHT_TYPES, matSpec: matSpec,
                   view: function (c) { return views.get(c) || null; }, parts: partsOf, reload: reload,
                   onChange: function (fn) { listeners.push(fn); }, get ready() { return !!T; } };
})();
