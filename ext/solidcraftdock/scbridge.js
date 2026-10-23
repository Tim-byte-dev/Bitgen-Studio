/* bitGen Studio — ext/solidcraftdock/scbridge.js (2.578.0): THE SOLIDCRAFT BRIDGE (window.H3SolidCraft).
 * Tim: "yes, lets build a solidcraft bridge, but we will put it in it's own docker".
 * SolidCraft's browser build runs in the docker's frame from /solidcraft-app/ - the app's own origin - so this page
 * talks to it directly:
 *   its command API      frame.contentWindow.solidcraft.execute(id, params) -> Promise (every UI action is a command:
 *                        solid.extrude, file.export, render.start …; .commands() lists the 400+, .inspect() the design)
 *   its file storage     the browser's private file storage (OPFS) - SolidCraft reads and writes "/opfs/<name>"; this
 *                        page reaches the same files (navigator.storage.getDirectory()), so a design or a part crosses
 *                        between SolidCraft and the project as a file
 * What the docker does with it (scdock.js):
 *   openFile(name, blob)      a design / STEP / STL … into SolidCraft (written to its storage, then doc.open)
 *   saveDesign(stem)          the design as <stem>.solidcraft -> Blob (file.save_as in its storage)
 *   exportPart(fmt)           step | stl | obj | 3mf -> Blob (file.export)
 *   view(name)                a view (iso, front … top, or a Named View saved in SolidCraft) applied in SolidCraft ->
 *                             its camera. SolidCraft's API has no "where is the viewport now", so the pictures use
 *                             the view picked in the docker (o.cam)
 *   snapshot(o)               a picture of the model from o.cam's angle: the OBJ export drawn with three.js
 *                             (static/vendor/three-m3d.min.js, via H3M3D.load) - transparent, any size, edges, at once
 *   render(o, onProgress)     SolidCraft's own render job of o.cam (lit, shaded; slower) -> PNG Blob
 *   sketchIn(dxf)             DXF text -> a SolidCraft sketch (sketch.insert_dxf)
 * Pure (scripts/test-solidcraft578.js): camDir, basis, fitOrtho, stemOf, parseSize, newer. */
(function (root) {
  "use strict";
  /** the unit vector from the view's target toward its camera. SolidCraft's camera (Z up, radians): yaw 0 = Front
   *  (from -Y), -90° = Right (from +X), 90° = Left, 180° = Back; pitch 90° = Top - read off its view.apply answers */
  function camDir(cam) {
    var y = +((cam || {}).yaw) || 0, p = +((cam || {}).pitch) || 0;
    return [-Math.cos(p) * Math.sin(y), -Math.cos(p) * Math.cos(y), Math.sin(p)];
  }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  /** the screen's right / up axes for a view direction (Z up; straight down / up: Y is up on the screen) */
  function basis(dir, yaw) {
    var d = norm(dir), up = [0, 0, 1];
    if (Math.abs(d[2]) > 0.9995) { var y = +yaw || 0; up = [Math.sin(y), Math.cos(y), 0]; }   // Top / Bottom: the view's "ahead" is up
    var right = norm(cross(up, d));        // camera looks along -d
    var u = norm(cross(d, right));
    return { right: right, up: u, dir: d, worldUp: up };
  }
  /** an orthographic frame that fits the box's 8 corners for this view, aspect w/h, margin (0.08 = 8 %) */
  function fitOrtho(min, max, dir, aspect, margin, yaw) {
    var B = basis(dir, yaw), c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    var hx = 0, hy = 0, hz = 0;
    for (var i = 0; i < 8; i++) {
      var p = [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]], q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      hx = Math.max(hx, Math.abs(dot(q, B.right))); hy = Math.max(hy, Math.abs(dot(q, B.up))); hz = Math.max(hz, Math.abs(dot(q, B.dir)));
    }
    var m = 1 + (margin == null ? 0.08 : margin);
    hx = Math.max(hx, 1e-6) * m; hy = Math.max(hy, 1e-6) * m;
    var a = aspect > 0 ? aspect : 1;
    if (hx / hy > a) hy = hx / a; else hx = hy * a;
    var dist = Math.max(hz * 2 + 10, 50);
    return { center: c, halfW: hx, halfH: hy, dist: dist, near: 0.1, far: dist + hz * 2 + 10, basis: B };
  }
  /** a design's name as a file stem */
  function stemOf(name) {
    var s = String(name == null ? "" : name).split(/[\\/]/).pop().replace(/\.(solidcraft|solvecraft|json|step|stp|stl|obj|3mf|igs|iges|glb|gltf)$/i, "");
    s = s.replace(/[^A-Za-z0-9 ._()&+,'-]+/g, "_").replace(/^[.\s_]+/, "").replace(/\s+/g, " ").trim().slice(0, 100);
    return s || "design";
  }
  /** "1920x1080" -> {w, h}; anything else -> null */
  function parseSize(v) { var m = /^(\d{2,5})x(\d{2,5})$/.exec(String(v || "")); return m ? { w: Math.min(8192, +m[1]), h: Math.min(8192, +m[2]) } : null; }
  function newer(a, b) {
    var pa = String(a || "").split(".").map(function (x) { return parseInt(x, 10) || 0; }), pb = String(b || "").split(".").map(function (x) { return parseInt(x, 10) || 0; });
    for (var i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    return false;
  }
  var PURE = { camDir: camDir, basis: basis, fitOrtho: fitOrtho, stemOf: stemOf, parseSize: parseSize, newer: newer };
  if (typeof module !== "undefined" && module.exports) { module.exports = PURE; return; }

  var doc = root.document;
  function frame() { return doc.getElementById("scFrame"); }
  function api() { try { var f = frame(); return f && f.contentWindow && f.contentWindow.solidcraft || null; } catch (e) { return null; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function withTimeout(p, ms, what) {
    return Promise.race([p, new Promise(function (_, no) { setTimeout(function () { no(new Error((what || "SolidCraft") + " did not answer in " + Math.round(ms / 1000) + " s")); }, ms); })]);
  }
  /** wait for SolidCraft's command API in the frame */
  function ready(ms) {
    var t0 = Date.now(), lim = ms || 60000;
    return (function poll() {
      if (api()) return Promise.resolve(api());
      if (Date.now() - t0 > lim) return Promise.reject(new Error("SolidCraft has not started"));
      return sleep(250).then(poll);
    })();
  }
  /** one SolidCraft command -> its result (an error's message is SolidCraft's own) */
  function exec(id, params, ms) {
    var S = api(); if (!S) return Promise.reject(new Error("SolidCraft is not open"));
    return withTimeout(Promise.resolve().then(function () { return S.execute(id, params || {}); }), ms || 60000, id)
      .catch(function (e) { throw new Error(String((e && e.message) || e).replace(/^Error:\s*/, "")); });
  }
  function inspect() { var S = api(); return S ? Promise.resolve(S.inspect()) : Promise.reject(new Error("SolidCraft is not open")); }

  /* ---- the shared private file storage */
  function opfs() { if (!(navigator.storage && navigator.storage.getDirectory)) return Promise.reject(new Error("this browser has no private file storage (OPFS)")); return navigator.storage.getDirectory(); }
  function put(name, blob) {
    return opfs().then(function (d) { return d.getFileHandle(name, { create: true }); }).then(function (h) {
      return h.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); });
    });
  }
  /** a file SolidCraft wrote - its write lands a moment after the command answers: wait for `bytes` */
  function get(name, bytes, ms) {
    var t0 = Date.now(), lim = ms || 30000;
    return opfs().then(function (d) {
      return (function poll() {
        return d.getFileHandle(name).then(function (h) { return h.getFile(); }).catch(function () { return null; }).then(function (f) {
          if (f && f.size > 0 && (!bytes || f.size >= bytes)) return f;
          if (Date.now() - t0 > lim) throw new Error(name + " was not written");
          return sleep(120).then(poll);
        });
      })();
    });
  }
  function del(name) { return opfs().then(function (d) { return d.removeEntry(name); }).catch(function () { /* gone already */ }); }

  /** a design / part into SolidCraft (a new tab there) */
  function openFile(name, blob) {
    var n = String(name).split(/[\\/]/).pop();
    return put(n, blob).then(function () { return exec("doc.open", { path: "/opfs/" + n }, 180000); });
  }
  /** the design as <stem>.solidcraft (SolidCraft's own Save then keeps going to the same file) */
  function saveDesign(stem) {
    var n = stemOf(stem) + ".solidcraft";
    return exec("file.save_as", { path: "/opfs/" + n }, 180000).then(function (r) { return get(n, r && r.bytes).then(function (f) { return { name: n, blob: f, result: r }; }); });
  }
  var FMT = { step: "step", stl: "stl", obj: "obj", "3mf": "3mf" };
  function exportPart(fmt) {
    var f = FMT[String(fmt || "").toLowerCase()]; if (!f) return Promise.reject(new Error("export as step, stl, obj or 3mf"));
    var n = "bitgen-export-" + Date.now().toString(36) + "." + f;
    return exec("file.export", { path: "/opfs/" + n }, 300000).then(function (r) {
      return get(n, r && r.bytes, 60000).then(function (file) { return file.arrayBuffer().then(function (b) { del(n); return new Blob([b], { type: f === "obj" ? "text/plain" : "application/octet-stream" }); }); });
    });
  }
  var ISO = { yaw: -Math.PI / 4, pitch: Math.atan(1 / Math.SQRT2) };
  /** a view applied in SolidCraft (its viewport turns there) -> its camera {target, yaw, pitch, distance, fov, up} */
  function view(name) { return exec("view.apply", { view: String(name || "iso") }).then(function (r) { return (r && r.camera) || null; }); }
  /** SolidCraft's Named Views (saved in the design) -> [{name, yaw, pitch, …}] */
  function views() { return exec("view.list", {}).then(function (r) { return (r && r.views) || []; }).catch(function () { return []; }); }

  /** the model from the view's angle, drawn here with three.js: {blob, w, h} (PNG, transparent background) */
  function snapshot(o) {
    o = o || {};
    var w = Math.max(16, Math.min(8192, o.w | 0 || 1024)), h = Math.max(16, Math.min(8192, o.h | 0 || 768));
    if (!root.H3M3D || !root.H3M3D.load) return Promise.reject(new Error("the 3D renderer (static/m3d.js) is not loaded"));
    return Promise.all([exportPart("obj").then(function (b) { return b.text(); }), root.H3M3D.load()]).then(function (res) {
      var cam = o.cam || ISO, text = res[0], T = res[1];
      if (!/\nf\s/.test(text)) throw new Error("the design has no solid bodies to show");
      var obj = new T.OBJLoader().parse(text);
      var scene = new T.Scene(), group = new T.Group();
      var mat = new T.MeshStandardMaterial({ color: o.color || 0xb4bcc8, metalness: 0.15, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: T.DoubleSide });
      var lineMat = new T.LineBasicMaterial({ color: 0x15171a });
      obj.traverse(function (m) {
        if (!m.isMesh) return;
        m.material = mat; group.add(m.clone());
        if (o.edges !== false) group.add(new T.LineSegments(new T.EdgesGeometry(m.geometry, 28), lineMat));
      });
      scene.add(group);
      var box = new T.Box3().setFromObject(group);
      var F = fitOrtho([box.min.x, box.min.y, box.min.z], [box.max.x, box.max.y, box.max.z], camDir(cam), w / h, 0.06, cam.yaw);
      var c = new T.OrthographicCamera(-F.halfW, F.halfW, F.halfH, -F.halfH, F.near, F.far);
      var d = F.basis.dir;
      c.position.set(F.center[0] + d[0] * F.dist, F.center[1] + d[1] * F.dist, F.center[2] + d[2] * F.dist);
      c.up.set(F.basis.worldUp[0], F.basis.worldUp[1], F.basis.worldUp[2]);
      c.lookAt(F.center[0], F.center[1], F.center[2]);
      scene.add(new T.HemisphereLight(0xffffff, 0x50555e, 1.6));
      var key = new T.DirectionalLight(0xffffff, 1.6);
      var B = F.basis; key.position.set(d[0] + B.up[0] * 0.8 - B.right[0] * 0.5, d[1] + B.up[1] * 0.8 - B.right[1] * 0.5, d[2] + B.up[2] * 0.8 - B.right[2] * 0.5);
      scene.add(key);
      var cv = doc.createElement("canvas"); cv.width = w; cv.height = h;
      var R = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
      R.setPixelRatio(1); R.setSize(w, h, false); R.setClearColor(0x000000, 0);
      if (o.background) R.setClearColor(new T.Color(o.background), 1);
      R.render(scene, c);
      return new Promise(function (ok, no) {
        cv.toBlob(function (b) {
          try { R.dispose(); mat.dispose(); lineMat.dispose(); } catch (e) { /* fine */ }
          if (b) ok({ blob: b, w: w, h: h }); else no(new Error("the picture could not be made"));
        }, "image/png");
      });
    });
  }

  /** SolidCraft's own render of the view (lit, shaded) -> {blob, w, h}; onProgress(0..1, phase) */
  function render(o, onProgress) {
    o = o || {};
    var w = Math.max(16, Math.min(4096, o.w | 0 || 1024)), h = Math.max(16, Math.min(4096, o.h | 0 || 768));
    if (w * h > 4194304) { var k = Math.sqrt(4194304 / (w * h)); w = Math.floor(w * k); h = Math.floor(h * k); }   // its 4-megapixel limit
    var n = "bitgen-render-" + Date.now().toString(36) + ".png", job = null;
    return Promise.all([exec("render.preflight", {}), exec("render.settings.get", {})]).then(function (r) {
      var set = Object.assign({}, (r[1] && r[1].defaults) || {});
      if (o.cam && o.cam.target) set.camera = { target: o.cam.target, yaw: o.cam.yaw, pitch: o.cam.pitch, distance: o.cam.distance, fov: o.cam.fov || 0, roll: o.cam.roll || 0, up: o.cam.up || "z" };
      else if (r[0] && r[0].request && r[0].request.camera) set.camera = r[0].request.camera;      // its own Iso framing
      set.width = w; set.height = h;
      return exec("render.start", { settings: set, transparent_background: o.background ? false : true });
    }).then(function (st) {
      job = st.job;
      var t0 = Date.now();
      return (function poll() {
        return exec("render.status", { job: job }).then(function (s) {
          if (s.error) throw new Error(typeof s.error === "string" ? s.error : JSON.stringify(s.error));
          var p = s.progress || {};
          if (onProgress) try { onProgress(p.total ? (p.phase === "encoding" ? 0.9 + 0.1 * p.done / p.total : Math.min(0.9, p.done / p.total)) : 0, p.phase || ""); } catch (e) { /* fine */ }
          if (s.frame) return s;
          if (Date.now() - t0 > 15 * 60000) throw new Error("the render took longer than 15 minutes");
          return sleep(400).then(poll);
        });
      })();
    }).then(function () {
      return exec("render.export", { job: job, path: "/opfs/" + n, overwrite: true });
    }).then(function (r) {
      return get(n, r && r.bytes, 60000).then(function (f) { return f.arrayBuffer(); }).then(function (b) { del(n); return { blob: new Blob([b], { type: "image/png" }), w: w, h: h }; });
    }).catch(function (e) { if (job) exec("render.cancel", { job: job }).catch(function () {}); throw e; });
  }

  /** DXF text -> a SolidCraft sketch (a new one on XY when none is being edited) */
  function sketchIn(dxf) { return exec("sketch.insert_dxf", { text: String(dxf || "") }); }

  root.H3SolidCraft = Object.assign({ frame: frame, api: api, ready: ready, exec: exec, inspect: inspect, put: put, get: get, del: del,
    openFile: openFile, saveDesign: saveDesign, exportPart: exportPart, view: view, views: views, ISO: ISO, snapshot: snapshot, render: render, sketchIn: sketchIn }, PURE);
})(typeof window !== "undefined" ? window : globalThis);
