/* bitGen Studio — ext/chasedock/chasedock.js (2.935.0): POLICE CHASE - the 3D city, the cars, the keys, the sound and the
 * high scores (window.H3Chase). The rules are chasecore.js (window.H3ChaseCore); the scores file is chaseserver.js.
 *
 * Tim: "for a little playtime during work" -> "lets make it with cars, call it police chase".
 *   The city    three.js (static/vendor/three-m3d.min.js, loaded on first open): the roads painted on one canvas texture
 *               (kerbs, lane marks, the police station square), the blocks as lit-window buildings of a few heights
 *   The cars    the orange getaway car; four police cars (Sarge, Cutter, Flanker, Rookie - each its own colour) with
 *               flashing red / blue light bars that light the street; jammed: grey and slow; bumped: a see-through car
 *               driving back to the station
 *   Camera      🎥 City (the whole board, tilted; turned a quarter in a tall narrow docker) or Chase (behind your car) - C.
 *               The keys follow the screen: in Chase, ↑ is straight on and ← / → turn left / right
 *   Keys        arrows / WASD (and a gamepad's d-pad or stick, a swipe on a touch screen) only while the game has the
 *               focus (click the city) - they never reach the rest of the app; P / Space / Esc pause, M sound, Enter new game
 *   Kind to work  paused when the docker is hidden or folded, the window is in the background or the game loses the
 *               focus; nothing is drawn while paused. While a render runs: play lighter (30 frames a second, one pixel
 *               per pixel) or pause (the select - kept). Hidden the first time (the 🚓 button on the top bar shows it).
 *   Sound       made on the spot with Web Audio (a siren that grows as the police close in, pick-ups, the jammer, a bust)
 *               - off to start with, M / 🔇 turns it on (kept)
 *   🏆          the best ten on this PC (GET / POST /api/police-chase/scores); a score that makes the ten asks for a name
 * window.H3Chase: newGame(seed), pause(why), resume(), camera(mode), sound(on), scores(), info() (tests)
 * 2.936.0 (Tim: "can i upload a blender file of the cars and the city maze? to make it a little more pleasing to the eye"):
 * an ART PACK, when installed - ext/chasedock/assets/pack.json (scripts/chase_assets.py makes it from a city .blend and a
 * roads kit; never in the repo, it ships as its own zip): the ground from its road pictures (straights turned to the road,
 * plain asphalt at the corners, pavers on the station square, pavement under the blocks) and each block a building of the
 * pack - a box wearing the five pictures Blender rendered of it, a random one, a random quarter turn. No pack = as before.
 */
(function (root) {
  "use strict";
  var doc = root.document, C = root.H3ChaseCore;
  if (!doc || !C) return;
  var $ = function (id) { return doc.getElementById(id); };
  var LS = {
    get: function (k, d) { try { var v = root.localStorage.getItem("h3.chase." + k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { root.localStorage.setItem("h3.chase." + k, String(v)); } catch (e) { /* private mode */ } },
  };
  // hidden the first time - a game is not what the app opens with
  try { if (root.localStorage.getItem("h3.g.chasedock") == null) root.localStorage.setItem("h3.g.chasedock", "1"); } catch (e) { /* fine */ }

  var T = null, loading = null;
  function three() {
    if (root.H3THREE) return Promise.resolve(T = root.H3THREE);
    if (!loading) loading = new Promise(function (ok, no) {
      var s = doc.createElement("script"); s.src = "/static/vendor/three-m3d.min.js";
      s.onload = function () { if (root.H3THREE) ok(T = root.H3THREE); else no(new Error("three.js did not load")); };
      s.onerror = function () { loading = null; no(new Error("static/vendor/three-m3d.min.js is missing")); };
      doc.head.appendChild(s);
    });
    return loading;
  }

  var G = { s: null, paused: true, why: "", auto: false, cam: LS.get("cam", "city") === "chase" ? "chase" : "city", sound: LS.get("sound", "0") === "1",
            render: LS.get("render", "light") === "pause" ? "pause" : "light", input: -1, raf: 0, last: 0, drawn: 0, frames: 0, V: null,
            scores: [], hiFile: 0, msgKey: "", padPrev: {}, swipe: null, light: false, mazeOf: null, err: "" };

  /* ---------------- the 3D view ---------------- */
  var ANG = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  var wrapA = function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  function setupView() {
    var stage = $("pcStage");
    var r = new T.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    r.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    r.setClearColor(0x070a14);
    if ("outputColorSpace" in r && T.SRGBColorSpace) r.outputColorSpace = T.SRGBColorSpace;
    stage.insertBefore(r.domElement, stage.firstChild);
    var scene = new T.Scene();
    scene.fog = new T.Fog(0x070a14, 30, 70);
    var cam = new T.PerspectiveCamera(40, 1, 0.1, 200);
    scene.add(new T.HemisphereLight(0x9fb4ff, 0x1a1410, 1.25));
    var sun = new T.DirectionalLight(0xffe6c8, 1.6); sun.position.set(-8, 18, 10); scene.add(sun);
    var V = { r: r, scene: scene, cam: cam, city: null, camPos: new T.Vector3(0, 30, 20), camLook: new T.Vector3(), player: null, police: [], lights: [] };
    V.player = makeCar({ body: 0xff8a1c, roof: 0xffa94d });
    scene.add(V.player.g);
    C.POLICE.forEach(function (p) {
      var c = makeCar({ body: p.color, roof: 0xf2f4f8, police: true });
      c.accent = p.color; scene.add(c.g); V.police.push(c);
      var L = new T.PointLight(0xff2030, 0, 3.2, 2); scene.add(L); V.lights.push(L);
    });
    // the pick-ups
    V.jamGeo = new T.OctahedronGeometry(0.17);
    V.jamMat = new T.MeshStandardMaterial({ color: 0x39d0ff, emissive: 0x39d0ff, emissiveIntensity: 1.1, metalness: 0.2, roughness: 0.3 });
    V.bonus = new T.Mesh(new T.OctahedronGeometry(0.22), new T.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb000, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.2 }));
    V.bonus.visible = false; scene.add(V.bonus);
    G.V = V;
    resize();
    if (root.ResizeObserver) new root.ResizeObserver(function () { resize(); kick(); }).observe(stage);
    return V;
  }
  function resize() {
    var V = G.V, st = $("pcStage"); if (!V || !st) return;
    var w = Math.max(50, st.clientWidth), h = Math.max(50, st.clientHeight);
    V.r.setSize(w, h, false); V.cam.aspect = w / h; V.cam.updateProjectionMatrix();
  }
  function box(w, h, d, m, x, y, z, g) { var o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; }
  /** a car, nose to -z: body, glass cabin, roof, wheels, lights; police: a red / blue light bar */
  function makeCar(o) {
    var g = new T.Group(), inner = new T.Group(); g.add(inner);
    var M = function (p) { return new T.MeshStandardMaterial(Object.assign({ transparent: true }, p)); };
    var mBody = M({ color: o.body, metalness: 0.45, roughness: 0.4 }), mRoof = M({ color: o.roof, metalness: 0.3, roughness: 0.45 });
    var mGlass = M({ color: 0x141a26, metalness: 0.7, roughness: 0.15 }), mTyre = M({ color: 0x0d0d0d, roughness: 0.9 });
    var mHead = M({ color: 0xfff2c0, emissive: 0xfff2c0, emissiveIntensity: 1.2 }), mTail = M({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 0.8 });
    box(0.40, 0.13, 0.70, mBody, 0, 0.13, 0, inner);
    box(0.34, 0.11, 0.38, mGlass, 0, 0.245, 0.05, inner);
    box(0.32, 0.025, 0.30, mRoof, 0, 0.31, 0.05, inner);
    [[-0.2, -0.22], [0.2, -0.22], [-0.2, 0.22], [0.2, 0.22]].forEach(function (p) {
      var w = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.06, 12), mTyre); w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.075, p[1]); inner.add(w);
    });
    [-0.12, 0.12].forEach(function (x) { box(0.08, 0.04, 0.02, mHead, x, 0.15, -0.355, inner); box(0.08, 0.035, 0.02, mTail, x, 0.15, 0.355, inner); });
    g.scale.setScalar(1.15);
    var c = { g: g, inner: inner, mats: [mBody, mRoof, mGlass, mTyre, mHead, mTail], mBody: mBody, ang: 0 };
    if (o.police) {
      c.red = M({ color: 0x400008, emissive: 0xff1030, emissiveIntensity: 0 });
      c.blue = M({ color: 0x000840, emissive: 0x2050ff, emissiveIntensity: 0 });
      box(0.12, 0.045, 0.08, c.red, -0.065, 0.345, 0.05, inner); box(0.12, 0.045, 0.08, c.blue, 0.065, 0.345, 0.05, inner);
      c.mats.push(c.red, c.blue);
    }
    return c;
  }
  var world = function (m, x, y) { return [x - m.W / 2 + 0.5, y - m.H / 2 + 0.5]; };

  /** the city for this level's maze: the painted ground, the buildings, the cash, the jammers */
  function buildCity(s) {
    var V = G.V, m = s.maze;
    if (V.city) { V.scene.remove(V.city); V.city.traverse(function (o) { if (o.geometry) o.geometry.dispose(); [].concat(o.material || []).forEach(function (mt) { if (mt.map) mt.map.dispose(); if (mt.emissiveMap) mt.emissiveMap.dispose(); mt.dispose(); }); }); }
    var city = new T.Group(); V.city = city; V.scene.add(city);
    // the ground: one canvas - 32 px a tile painted, or (2.936.0) 64 px a tile from the art pack's road pictures
    var RP = G.pack && G.pack.roadImgs, P = RP ? 64 : 32, cv = doc.createElement("canvas"); cv.width = m.W * P; cv.height = m.H * P;
    var g = cv.getContext("2d");
    g.fillStyle = "#2b2e38"; g.fillRect(0, 0, cv.width, cv.height);                       // pavement under the blocks
    var home = {}; m.station.tiles.forEach(function (t) { home[t[0] + "," + t[1]] = 1; });
    if (RP) paintRoads(g, m, P, home, RP);
    for (var y = 0; y < m.H && !RP; y++) for (var x = 0; x < m.W; x++) {
      if (!C.open(m, x, y)) continue;
      g.fillStyle = home[x + "," + y] ? "#1b2846" : "#17191f"; g.fillRect(x * P, y * P, P, P);
    }
    g.strokeStyle = RP ? "#a7abb3" : "#5b6070"; g.lineWidth = RP ? 3 : 2;               // kerbs
    for (var y2 = 0; y2 < m.H; y2++) for (var x2 = 0; x2 < m.W; x2++) {
      if (!C.open(m, x2, y2)) continue;
      C.DIRS.forEach(function (d) {
        if (C.open(m, x2 + d[0], y2 + d[1])) return;
        g.beginPath();
        var x0 = x2 * P, y0 = y2 * P;
        if (d[1] === -1) { g.moveTo(x0, y0 + 1); g.lineTo(x0 + P, y0 + 1); }
        if (d[1] === 1) { g.moveTo(x0, y0 + P - 1); g.lineTo(x0 + P, y0 + P - 1); }
        if (d[0] === -1) { g.moveTo(x0 + 1, y0); g.lineTo(x0 + 1, y0 + P); }
        if (d[0] === 1) { g.moveTo(x0 + P - 1, y0); g.lineTo(x0 + P - 1, y0 + P); }
        g.stroke();
      });
    }
    g.strokeStyle = "rgba(255, 214, 90, .55)"; g.lineWidth = 1.5; g.setLineDash([6, 6]);  // lane marks on the straights
    for (var y3 = 0; y3 < m.H && !RP; y3++) for (var x3 = 0; x3 < m.W; x3++) {             // (the pack's roads have their own)
      if (!C.open(m, x3, y3) || home[x3 + "," + y3]) continue;
      var lr = C.open(m, x3 - 1, y3) && C.open(m, x3 + 1, y3) && !C.open(m, x3, y3 - 1) && !C.open(m, x3, y3 + 1);
      var ud = C.open(m, x3, y3 - 1) && C.open(m, x3, y3 + 1) && !C.open(m, x3 - 1, y3) && !C.open(m, x3 + 1, y3);
      g.beginPath();
      if (lr) { g.moveTo(x3 * P, y3 * P + P / 2); g.lineTo(x3 * P + P, y3 * P + P / 2); g.stroke(); }
      if (ud) { g.moveTo(x3 * P + P / 2, y3 * P); g.lineTo(x3 * P + P / 2, y3 * P + P); g.stroke(); }
    }
    g.setLineDash([]);
    g.fillStyle = "rgba(220, 230, 255, .85)"; g.textAlign = "center"; g.textBaseline = "middle";
    var fs = Math.round(P * 0.62); g.font = "bold " + fs + "px system-ui, sans-serif";
    var tw = g.measureText("POLICE").width; if (tw > P * 2.7) { fs = Math.floor(fs * P * 2.7 / tw); g.font = "bold " + fs + "px system-ui, sans-serif"; }
    g.fillText("POLICE", (m.station.x + 0.5) * P, (m.station.y + 0.5) * P);
    var gt = new T.CanvasTexture(cv); if (T.SRGBColorSpace) gt.colorSpace = T.SRGBColorSpace; gt.anisotropy = 4;
    var ground = new T.Mesh(new T.PlaneGeometry(m.W, m.H), new T.MeshStandardMaterial({ map: gt, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; city.add(ground);
    var under = new T.Mesh(new T.PlaneGeometry(m.W + 60, m.H + 60), new T.MeshStandardMaterial({ color: 0x0c0f18, roughness: 1 }));
    under.rotation.x = -Math.PI / 2; under.position.y = -0.01; city.add(under);
    // the buildings: lit windows, three heights (low enough to see the streets behind them)
    var win = windowTextures(), R = C.rng(s.seed * 31 + s.level), byH = [[], [], [], []];
    var PB = G.pack && G.pack.json.buildings && G.pack.json.buildings.length ? G.pack.json.buildings : null, packed = [];   // 2.936.0
    for (var y4 = 0; y4 < m.H; y4++) for (var x4 = 0; x4 < m.W; x4++) {
      if (C.open(m, x4, y4)) continue;
      var edge = x4 === 0 || y4 === 0 || x4 === m.W - 1 || y4 === m.H - 1;
      if (!edge && PB) { var vi = Math.floor(R() * PB.length); (packed[vi] = packed[vi] || []).push([x4, y4, Math.floor(R() * 4)]); continue; }
      byH[edge ? 0 : 1 + Math.floor(R() * 3)].push([x4, y4, R()]);
    }
    packed.forEach(function (list, vi) { if (list) packBuildings(city, m, PB[vi], list); });
    var tints = [0x8a93a8, 0x9c8f86, 0x7f8fa0, 0xa59a8a, 0x8796b0, 0x9aa3a8];
    byH.forEach(function (list, floors) {
      if (!list.length) return;
      var h = floors === 0 ? 0.2 : 0.34 * floors + 0.14, geo = new T.BoxGeometry(0.98, h, 0.98), mats;
      if (floors === 0) mats = new T.MeshStandardMaterial({ color: 0x232838, roughness: 0.9 });
      else {
        var map = win.map.clone(), em = win.em.clone(); [map, em].forEach(function (t) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1, floors); t.needsUpdate = true; });
        var side = new T.MeshStandardMaterial({ map: map, emissive: 0xffd27a, emissiveMap: em, emissiveIntensity: 0.9, roughness: 0.75 });
        var top = new T.MeshStandardMaterial({ color: 0x3a3f4c, roughness: 0.9 });
        mats = [side, side, top, top, side, side];
      }
      var im = new T.InstancedMesh(geo, mats, list.length), M4 = new T.Matrix4(), col = new T.Color();
      list.forEach(function (b, i) {
        var w = world(m, b[0], b[1]); M4.makeTranslation(w[0], h / 2, w[1]); im.setMatrixAt(i, M4);
        if (floors) { col.setHex(tints[Math.floor(b[2] * tints.length)]); im.setColorAt(i, col); }
      });
      city.add(im);
    });
    // the cash: one instanced mesh, a bundle per tile
    var cashIdx = [], k = 0;
    for (var i = 0; i < m.W * m.H; i++) if (s.items[i] === 1) cashIdx.push(i);
    var cash = new T.InstancedMesh(new T.BoxGeometry(0.17, 0.08, 0.11), new T.MeshStandardMaterial({ color: 0x35c463, emissive: 0x0c4a20, emissiveIntensity: 0.9, roughness: 0.5 }), Math.max(1, cashIdx.length));
    cash.count = cashIdx.length; city.add(cash);
    V.cash = cash; V.cashIdx = cashIdx;
    V.jams = m.jammers.map(function (j) { var o = new T.Mesh(V.jamGeo, V.jamMat); var w = world(m, j[0], j[1]); o.position.set(w[0], 0.25, w[1]); city.add(o); o.userData.k = j[1] * m.W + j[0]; return o; });
    G.mazeOf = m;
    k = 0;
    return k;
  }
  /* ---- 2.936.0: the art pack (ext/chasedock/assets/pack.json, made by scripts/chase_assets.py - not in the repo) ---- */
  var ROT = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  /** what a road tile is: "h" / "v" a straight (left-right / up-down), "x" anything else (pure) */
  function roadKind(m, x, y) {
    var l = C.open(m, x - 1, y), r = C.open(m, x + 1, y), u = C.open(m, x, y - 1), d = C.open(m, x, y + 1);
    return l && r && !u && !d ? "h" : u && d && !l && !r ? "v" : "x";
  }
  function paintRoads(g, m, P, home, RP) {
    for (var y = 0; y < m.H; y++) for (var x = 0; x < m.W; x++) {
      var road = C.open(m, x, y), img = !road ? RP.pavement : home[x + "," + y] ? RP.plaza : roadKind(m, x, y) === "x" ? RP.plain : RP.straight;
      if (!img) continue;
      if (road && roadKind(m, x, y) === "v" && !home[x + "," + y]) {
        g.save(); g.translate(x * P + P / 2, y * P + P / 2); g.rotate(Math.PI / 2); g.drawImage(img, -P / 2, -P / 2, P, P); g.restore();
      } else g.drawImage(img, x * P, y * P, P, P);
    }
  }
  var packTex = {};
  function packTexture(url) {
    if (packTex[url]) return packTex[url];
    var t = new T.TextureLoader().load("/ext/chasedock/assets/" + url, function () { G.camSettling = Math.max(G.camSettling || 0, 2); kick(); });
    if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return (packTex[url] = t);
  }
  /** one building of the pack on every tile in list [[x, y, quarter turns]]: a box wearing its five pictures */
  function packBuildings(city, m, b, list) {
    var F = b.faces || {}, sz = b.size_m || [1, 1, 1];
    var mat = function (f) { return F[f] ? new T.MeshStandardMaterial({ map: packTexture(F[f]), color: 0xe2e6f0, roughness: 0.85, emissive: 0x2a2f3a, emissiveMap: packTexture(F[f]), emissiveIntensity: 0.35 }) : new T.MeshStandardMaterial({ color: 0x161b26 }); };
    var mats = [mat("px"), mat("nx"), mat("py"), new T.MeshStandardMaterial({ color: 0x161b26 }), mat("pz"), mat("nz")];
    var k = 0.94 / Math.max(sz[0], sz[1], 0.01), sx = sz[0] * k, sd = sz[1] * k, h = Math.min(1.8, sz[2] * k);
    var im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mats, list.length), M = new T.Matrix4(), Q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0);
    list.forEach(function (t, i) {
      var w = world(m, t[0], t[1]); Q.setFromAxisAngle(Y, ROT[t[2]]);
      M.compose(new T.Vector3(w[0], h / 2, w[1]), Q, new T.Vector3(sx, h, sd)); im.setMatrixAt(i, M);
    });
    im.userData.pack = b.id;
    city.add(im);
  }
  /** pack.json + its road pictures, if the pack is installed (null when not - the painted city then) */
  function loadPack() {
    return fetch("/ext/chasedock/assets/pack.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || j.version !== 1) return null;
      var roads = j.roads || {}, names = Object.keys(roads), imgs = {};
      return Promise.all(names.map(function (n) {
        return new Promise(function (ok) { var im = new Image(); im.onload = function () { imgs[n] = im; ok(); }; im.onerror = function () { ok(); }; im.src = "/ext/chasedock/assets/" + roads[n]; });
      })).then(function () { G.pack = { json: j, roadImgs: Object.keys(imgs).length ? imgs : null }; return G.pack; });
    }).catch(function () { return null; });
  }
  var WIN = null;
  function windowTextures() {
    if (WIN) return WIN;
    var mk = function (lit) {
      var c = doc.createElement("canvas"); c.width = 64; c.height = 64; var g = c.getContext("2d");
      g.fillStyle = lit ? "#000" : "#e8e8e8"; g.fillRect(0, 0, 64, 64);
      var R = C.rng(77);
      for (var r = 0; r < 2; r++) for (var q = 0; q < 4; q++) {
        var on = R() < 0.55;
        g.fillStyle = lit ? (on ? "#fff" : "#000") : (on ? "#f7e3a8" : "#2a3140");
        g.fillRect(6 + q * 14, 8 + r * 30, 9, 16);
      }
      var t = new T.CanvasTexture(c); if (!lit && T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; return t;
    };
    WIN = { map: mk(false), em: mk(true) };
    return WIN;
  }

  /* ---------------- drawing ---------------- */
  var M4 = null, Q = null, E3 = null, S3 = null;
  function draw(dt, t) {
    var V = G.V, s = G.s; if (!V) return;
    if (s) {
      if (G.mazeOf !== s.maze) buildCity(s);
      var m = s.maze;
      // the getaway car
      var p = s.player, pw = world(m, p.x, p.y), pc = V.player;
      pc.g.position.set(pw[0], 0, pw[1]);
      var want = ANG[p.face];
      if (s.phase === "busted") pc.ang += dt * 9; else pc.ang += wrapA(want - pc.ang) * Math.min(1, dt * 14);
      pc.g.rotation.y = pc.ang;
      pc.inner.position.y = p.moving && s.phase === "play" ? Math.abs(Math.sin(t * 30)) * 0.008 : 0;
      pc.mBody.emissive && pc.mBody.emissive.setHex(s.phase === "busted" && Math.floor(t * 8) % 2 ? 0x662200 : 0x000000);
      // the police
      var flash = Math.floor(t * 6) % 2;
      s.police.forEach(function (c, i) {
        var v = V.police[i], w = world(m, c.x, c.y), L = V.lights[i];
        v.g.position.set(w[0], c.mode === "wait" ? Math.abs(Math.sin(t * 3 + i)) * 0.05 : 0, w[1]);
        v.ang += wrapA(ANG[c.dir < 0 ? 0 : c.dir] - v.ang) * Math.min(1, dt * 12);
        v.g.rotation.y = v.ang;
        var jam = c.mode === "jammed", back = c.mode === "back", blink = jam && s.jamT < 2 && Math.floor(t * 8) % 2;
        v.mBody.color.setHex(jam ? (blink ? 0xdddddd : 0x55586a) : v.accent);
        v.inner.rotation.z = jam ? Math.sin(t * 14 + i) * 0.06 : 0;
        var op = back ? 0.28 : 1;
        v.mats.forEach(function (mt) { mt.opacity = op; mt.depthWrite = !back; });
        var on = !jam && !back;
        v.red.emissiveIntensity = on && flash ? 2.2 : 0; v.blue.emissiveIntensity = on && !flash ? 2.2 : 0;
        L.position.set(w[0], 0.7, w[1]); L.color.setHex(flash ? 0xff2030 : 0x2050ff); L.intensity = on ? 2.4 : 0;
      });
      // cash, jammers, the bonus
      if (!M4) { M4 = new T.Matrix4(); Q = new T.Quaternion(); E3 = new T.Euler(); S3 = new T.Vector3(); }
      var P3 = new T.Vector3();
      V.cashIdx.forEach(function (k, j) {
        var on = s.items[k] === 1, x = k % m.W, y = (k / m.W) | 0, w = world(m, x, y);
        E3.set(0, t * 1.6 + j * 0.37, 0); Q.setFromEuler(E3); S3.setScalar(on ? 1 : 0); P3.set(w[0], 0.12 + Math.sin(t * 3 + j) * 0.02, w[1]);
        M4.compose(P3, Q, S3); V.cash.setMatrixAt(j, M4);
      });
      V.cash.instanceMatrix.needsUpdate = true;
      V.jams.forEach(function (o, j) { o.visible = s.items[o.userData.k] === 2; o.rotation.y = t * 2; o.position.y = 0.25 + Math.sin(t * 4 + j) * 0.05; });
      V.bonus.visible = !!s.bonus && (s.bonus.t > 2 || Math.floor(t * 6) % 2 === 0);
      if (s.bonus) { var bw = world(m, s.bonus.x, s.bonus.y); V.bonus.position.set(bw[0], 0.3 + Math.sin(t * 3) * 0.05, bw[1]); V.bonus.rotation.y = t * 2.2; }
      camera(dt, m, pw, p.face);
    } else if (!G.mazeOf) {
      // the attract screen: a demo city behind the title
      G.s = C.newGame(Date.now() % 100000, 0); G.s.phase = "over"; G.demo = true;
      draw(dt, t); return;
    }
    V.r.render(V.scene, V.cam);
    G.drawn++;
  }
  /** the city view turns a quarter when the docker is tall and narrow (a landscape city fills a portrait docker) */
  function cityRot(m) { var V = G.V; return V && m && V.cam.aspect < 0.9 && m.W > m.H ? 1 : 0; }
  function camera(dt, m, pw, face) {
    var V = G.V, cam = V.cam, k = Math.min(1, dt * 4.5), wantP = new T.Vector3(), wantL = new T.Vector3(), fog = V.scene.fog;
    if (G.cam === "chase" && G.s && !G.demo) {
      var d = C.DIRS[face];
      wantP.set(pw[0] - d[0] * 3.2, 3.1, pw[1] - d[1] * 3.2); wantL.set(pw[0] + d[0] * 1.6, 0, pw[1] + d[1] * 1.6);
      fog.near = 9; fog.far = 30;
    } else {
      var rot = cityRot(m), BW = rot ? m.H : m.W, BH = rot ? m.W : m.H, az = rot * Math.PI / 2;
      var vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect), phi = 64 * Math.PI / 180;
      var dw = (BW / 2 + 0.6) / Math.tan(hf / 2), dh = (BH * Math.sin(phi) / 2 + 0.6) / Math.tan(vf / 2) + BH * Math.cos(phi) / 2;
      var dd = Math.max(dw, dh) * 1.02, hz = Math.cos(phi) * dd;
      wantP.set(Math.sin(az) * hz, Math.sin(phi) * dd, Math.cos(az) * hz); wantL.set(Math.sin(az) * 0.3, 0, Math.cos(az) * 0.3);
      fog.near = dd + Math.max(BW, BH); fog.far = dd * 1.5 + Math.max(BW, BH) * 2;
      if (!G.camSet || !(G.camSettling > 0)) k = 1;            // the city view stands still - it only glides when switched to
    }
    if (G.camJump) { k = 1; G.camJump = false; }
    V.camPos.lerp(wantP, k); V.camLook.lerp(wantL, k); G.camSet = true;
    cam.position.copy(V.camPos); cam.lookAt(V.camLook);
  }
  /** a key's direction on the screen -> the direction in the city: the chase camera turns with the car (up = ahead),
   *  the city view with its quarter turn */
  function toWorld(d) {
    var s = G.s; if (!s || d < 0) return d;
    var rot = G.cam === "chase" ? s.player.face : cityRot(s.maze);
    return (d + rot) % 4;
  }

  /* ---------------- the loop: nothing runs while it is not needed ---------------- */
  function shown() {
    var d = $("chasedock"), st = $("pcStage");
    return !!(d && st && !d.classList.contains("dockgone") && !d.classList.contains("collapsed") && !doc.hidden && st.offsetWidth > 0 && st.offsetHeight > 0);
  }
  function rendering() {
    try { var L = root.liveJobsById; return !!L && Object.keys(L).some(function (k) { return L[k] && L[k].status === "running"; }); } catch (e) { return false; }
  }
  function kick() { if (!G.raf && G.V && shown()) { G.last = 0; G.raf = root.requestAnimationFrame(loop); } }
  function loop(now) {
    G.raf = 0;
    if (!shown()) { if (G.s && !G.paused && !G.demo) pause("the docker is hidden"); return; }
    var busy = rendering();
    if (busy && G.render === "pause" && !G.paused && G.s && !G.demo) { pause("a render is running - it gets the graphics card", true); }
    if (!busy && G.auto && G.paused) { resume(); }
    var light = busy && G.render === "light";
    if (light !== G.light) { G.light = light; G.V.r.setPixelRatio(light ? 1 : Math.min(2, root.devicePixelRatio || 1)); resize(); }
    if (light && G.last && now - G.last < 32) { G.raf = root.requestAnimationFrame(loop); return; }
    var dt = G.last ? Math.min(0.1, (now - G.last) / 1000) : 1 / 60; G.last = now;
    pad();
    var running = G.s && !G.paused && !G.demo && G.s.phase !== "over";          // GAME OVER: one last picture, then still
    if (running) { var evs = C.step(G.s, dt, { dir: G.input }); G.input = -1; evs.forEach(onEvent); }
    draw(dt, now / 1000);
    hud();
    G.frames++;
    // paused (or the title): one frame is enough - the loop stops until something changes
    if (running || (G.demo && G.paused === false) || G.camSettling > 0) { G.camSettling = Math.max(0, (G.camSettling || 0) - 1); G.raf = root.requestAnimationFrame(loop); }
    else if (G.demo) { G.demoT = (G.demoT || 0) + 1; if (G.demoT < 2) G.raf = root.requestAnimationFrame(loop); }
  }

  /* ---------------- the game ---------------- */
  function newGame(seed) {
    hideName();
    G.s = C.newGame(seed == null ? (Date.now() % 1000000) : seed, Math.max(G.hiFile, G.s && !G.demo ? G.s.hi : 0));
    G.demo = false; G.paused = false; G.why = ""; G.auto = false; G.camJump = true; G.msgKey = "";
    snd("start");
    focus(); kick(); hud();
    return G.s;
  }
  function pause(why, auto) {
    if (!G.s || G.demo || G.s.phase === "over") return;
    G.paused = true; G.why = why || "paused"; G.auto = !!auto; sirenOff(); hud(); kick();
  }
  function resume() {
    if (!G.s || G.demo || G.s.phase === "over") return;
    G.paused = false; G.why = ""; G.auto = false; G.last = 0; hud(); kick();
  }
  function togglePause() { if (!G.s || G.demo || G.s.phase === "over") return; if (G.paused) { focus(); resume(); } else pause("paused"); }
  function onEvent(e) {
    snd(e);
    if (e === "over") gameOver();
  }
  function gameOver() {
    sirenOff();
    var s = G.s, top = G.scores, qual = s.score > 0 && (top.length < 10 || s.score > top[top.length - 1].score);
    if (qual) {
      var n = $("pcName"), inp = $("pcNameIn");
      n.classList.add("on"); inp.value = LS.get("name", ""); setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) { /* fine */ } }, 50);
    }
  }
  function hideName() { var n = $("pcName"); if (n) n.classList.remove("on"); }
  function saveScore() {
    var s = G.s; if (!s) return Promise.resolve(null);
    var name = ($("pcNameIn").value || "").trim() || "Driver";
    LS.set("name", name); hideName();
    return fetch("/api/police-chase/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, score: s.score, level: s.level }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.scores) { G.scores = j.scores; G.hiFile = j.scores.length ? j.scores[0].score : 0; paintScores(j.rank); $("pcScores").classList.add("on"); }
        focus(); return j;
      }).catch(function () { return null; });
  }
  function loadScores() {
    return fetch("/api/police-chase/scores").then(function (r) { return r.json(); }).then(function (j) {
      G.scores = (j && j.scores) || []; G.hiFile = G.scores.length ? G.scores[0].score : 0; paintScores(0); hud(); return G.scores;
    }).catch(function () { return G.scores; });
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function paintScores(rank) {
    var b = $("pcScores"); if (!b) return;
    b.innerHTML = "<b>🏆 High scores</b>" + (G.scores.length
      ? "<table>" + G.scores.map(function (x, i) { return "<tr" + (rank === i + 1 ? ' class="me"' : "") + "><td>" + (i + 1) + ".</td><td>" + esc(x.name) + "</td><td class=\"n\">" + x.score + "</td><td class=\"n\">L" + x.level + "</td></tr>"; }).join("") + "</table>"
      : '<div class="hint" style="margin-top:6px">No scores yet - be the first.</div>');
  }

  /* ---------------- the HUD ---------------- */
  function hud() {
    var s = G.s, live = s && !G.demo;
    if (!$("pcScore")) return;
    $("pcScore").textContent = live ? s.score : 0;
    $("pcBest").textContent = Math.max(G.hiFile, live ? s.hi : 0);
    $("pcLevel").textContent = live ? s.level : 1;
    $("pcLives").textContent = live ? new Array(Math.max(0, s.lives) + 1).join("🚗") : "";
    var jb = $("pcJam"); jb.style.display = live && s.jamT > 0 ? "block" : "none";
    if (live && s.jamT > 0) jb.firstChild.style.width = Math.round(100 * s.jamT / C.speeds(s.level).jam) + "%";
    $("pcPause").textContent = live && G.paused && s.phase !== "over" ? "▶ Carry on" : "⏸ Pause";
    $("pcCam").textContent = G.cam === "chase" ? "🎥 Chase" : "🎥 City";
    $("pcSound").textContent = G.sound ? "🔊" : "🔇";
    var key = !live ? "title" : G.paused ? "pause:" + G.why : s.phase + (s.phase === "ready" ? s.level : "");
    if (key === G.msgKey) return;
    G.msgKey = key;
    var m = $("pcMsg"), b = "", t = "", dim = false;
    if (!live) { b = "🚓 POLICE CHASE"; t = "Pick up every bag of cash and keep away from the police. A 📡 jammer turns the tables for a few seconds - bump a police car to send it back to the station.<br>Click here, then press Enter or an arrow key." + (G.pack && G.pack.json.credits && G.pack.json.credits.length ? '<br><small style="opacity:.65">' + G.pack.json.credits.map(esc).join(" · ") + "</small>" : ""); dim = true; }
    else if (G.paused) { b = "PAUSED"; t = (G.why && G.why !== "paused" ? esc(G.why) + " · " : "") + "P, Space or a click carries on"; dim = true; }
    else if (s.phase === "ready") { b = "LEVEL " + s.level; t = "Get ready…"; }
    else if (s.phase === "busted") { b = "BUSTED!"; t = s.lives > 0 ? s.lives + " car" + (s.lives > 1 ? "s" : "") + " left" : ""; }
    else if (s.phase === "clear") { b = "CITY CLEARED"; t = "On to the next city…"; }
    else if (s.phase === "over") { b = "GAME OVER"; t = "Score " + s.score + " · level " + s.level + "<br>Enter for a new game"; dim = true; }
    m.innerHTML = b ? "<b>" + b + "</b><span>" + t + "</span>" : "";
    m.classList.toggle("dim", dim);
  }

  /* ---------------- input ---------------- */
  var KEYS = { ArrowUp: 0, KeyW: 0, ArrowLeft: 1, KeyA: 1, ArrowDown: 2, KeyS: 2, ArrowRight: 3, KeyD: 3 };
  function focus() { var st = $("pcStage"); if (st && doc.activeElement !== st) { try { st.focus({ preventScroll: true }); } catch (e) { st.focus(); } } }
  function onKey(e) {
    if (e.target && e.target.id === "pcNameIn") { if (e.key === "Enter") { e.preventDefault(); saveScore(); } e.stopPropagation(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var done = true, live = G.s && !G.demo;
    if (e.code in KEYS) {
      if (!live) newGame();
      else if (G.s.phase === "over") { done = true; }
      else { if (G.paused) resume(); G.input = toWorld(KEYS[e.code]); }
      snd("unlock");
    }
    else if (e.code === "KeyP" || e.code === "Space" || e.code === "Escape") togglePause();
    else if (e.code === "KeyC") setCamera(G.cam === "chase" ? "city" : "chase");
    else if (e.code === "KeyM") setSound(!G.sound);
    else if (e.code === "Enter") { if (!live || G.s.phase === "over") newGame(); else if (G.paused) resume(); }
    else done = false;
    if (done) { e.preventDefault(); e.stopPropagation(); }
  }
  function pad() {
    var gp = null;
    try { var all = root.navigator.getGamepads ? root.navigator.getGamepads() : []; for (var i = 0; i < all.length; i++) if (all[i] && all[i].connected) { gp = all[i]; break; } } catch (e) { gp = null; }
    if (!gp) return;
    var b = function (n) { return !!(gp.buttons[n] && gp.buttons[n].pressed); }, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, d = -1;
    if (b(12) || ay < -0.55) d = 0; else if (b(14) || ax < -0.55) d = 1; else if (b(13) || ay > 0.55) d = 2; else if (b(15) || ax > 0.55) d = 3;
    if (d >= 0 && G.s && !G.demo && !G.paused) G.input = toWorld(d);
    var st = b(9);
    if (st && !G.padPrev.start) { if (!G.s || G.demo || G.s.phase === "over") newGame(); else togglePause(); }
    G.padPrev.start = st;
  }
  function setCamera(c) { G.cam = c === "chase" ? "chase" : "city"; LS.set("cam", G.cam); G.camSettling = 40; hud(); kick(); }
  function setSound(on) { G.sound = !!on; LS.set("sound", G.sound ? "1" : "0"); if (!G.sound) sirenOff(); else snd("unlock"); hud(); }

  /* ---------------- sound: made on the spot ---------------- */
  var A = null;
  function actx() {
    if (!G.sound) return null;
    if (!A) {
      var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
      try { var c = new AC(), mst = c.createGain(); mst.gain.value = 0.35; mst.connect(c.destination); A = { c: c, m: mst, siren: null }; } catch (e) { return null; }
    }
    if (A.c.state === "suspended") { try { A.c.resume(); } catch (e) { /* the next key */ } }
    return A;
  }
  function tone(type, f0, f1, dur, vol, at) {
    var a = actx(); if (!a) return;
    var t = a.c.currentTime + (at || 0), o = a.c.createOscillator(), g = a.c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.m); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    var a = actx(); if (!a) return;
    var n = Math.floor(a.c.sampleRate * dur), buf = a.c.createBuffer(1, n, a.c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = a.c.createBufferSource(), g = a.c.createGain(); g.gain.value = vol; s.buffer = buf; s.connect(g); g.connect(a.m); s.start();
  }
  var blip = 0;
  function snd(e) {
    if (!G.sound) return;
    if (e === "unlock") { actx(); return; }
    if (e === "cash") { blip ^= 1; tone("square", blip ? 1046 : 1318, blip ? 1046 : 1318, 0.05, 0.05); }
    else if (e === "jammer") { tone("sawtooth", 220, 1400, 0.35, 0.07); tone("sine", 1400, 300, 0.3, 0.05, 0.3); }
    else if (e === "tag") { noise(0.18, 0.18); tone("square", 180, 60, 0.2, 0.08); tone("sine", 660, 1320, 0.15, 0.05, 0.12); }
    else if (e === "busted") { noise(0.4, 0.25); [880, 660, 880, 660].forEach(function (f, i) { tone("triangle", f, f, 0.22, 0.07, 0.25 + i * 0.25); }); }
    else if (e === "clear" || e === "extra") { [523, 659, 784, 1046].forEach(function (f, i) { tone("square", f, f, 0.12, 0.05, i * 0.1); }); }
    else if (e === "bonus") { tone("sine", 784, 1568, 0.25, 0.08); }
    else if (e === "bonusup") { tone("sine", 1568, 1568, 0.08, 0.04); tone("sine", 2093, 2093, 0.08, 0.04, 0.09); }
    else if (e === "start") { [392, 523, 659].forEach(function (f, i) { tone("triangle", f, f, 0.14, 0.06, i * 0.13); }); }
    else if (e === "over") { [392, 330, 262, 196].forEach(function (f, i) { tone("triangle", f, f, 0.25, 0.07, i * 0.22); }); }
  }
  function sirenOff() { if (A && A.siren) { try { A.siren.o.stop(); } catch (e) { /* stopped */ } A.siren = null; } }
  /** the siren: two tones, louder as the nearest police car closes in (silent while jammed) */
  function siren() {
    var s = G.s;
    if (!G.sound || !s || G.demo || G.paused || s.phase !== "play") { sirenOff(); return; }
    var near = Infinity;
    s.police.forEach(function (c) { if (c.mode === "run") near = Math.min(near, Math.hypot(c.x - s.player.x, c.y - s.player.y)); });
    var a = actx(); if (!a) return;
    if (!a.siren) {
      var o = a.c.createOscillator(), g = a.c.createGain(); o.type = "sine"; g.gain.value = 0; o.connect(g); g.connect(a.m); o.start();
      a.siren = { o: o, g: g };
    }
    var t = a.c.currentTime, v = near === Infinity ? 0 : Math.max(0, Math.min(0.06, 0.06 * (1 - near / 10)));
    a.siren.g.gain.setTargetAtTime(v, t, 0.1);
    a.siren.o.frequency.setTargetAtTime(Math.floor(t / 0.45) % 2 ? 960 : 720, t, 0.02);
  }

  /* ---------------- wiring ---------------- */
  function boot() {
    var d = $("chasedock"), st = $("pcStage");
    if (!d || !st) return;
    try { if (root.localStorage.getItem("h3.g.chasedock") === "1" && !d.dataset.pcSeen) d.classList.add("dockgone"); } catch (e) { /* fine */ }
    d.dataset.pcSeen = "1";
    st.addEventListener("keydown", onKey);
    st.addEventListener("blur", function () { setTimeout(function () { if (doc.activeElement !== st && !(doc.activeElement && doc.activeElement.id === "pcNameIn") && G.s && !G.demo && !G.paused && G.s.phase !== "over") pause("the game lost the focus"); }, 0); });
    st.addEventListener("pointerdown", function (e) {
      if (e.target && (e.target.closest("#pcName") || e.target.closest("#pcScores"))) return;
      G.swipe = { x: e.clientX, y: e.clientY };
      focus();
      if (G.s && !G.demo && G.paused && G.s.phase !== "over") resume();
      start();
    });
    st.addEventListener("pointerup", function (e) {
      var w = G.swipe; G.swipe = null; if (!w || !G.s || G.demo) return;
      var dx = e.clientX - w.x, dy = e.clientY - w.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      G.input = toWorld(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 0 : 2));
    });
    // the bar's buttons keep the focus on the city (a click there is no reason to pause)
    Array.prototype.forEach.call(d.querySelectorAll(".pcbar button"), function (b) { b.addEventListener("pointerdown", function (e) { e.preventDefault(); }); });
    $("pcNew").addEventListener("click", function () { start().then(function () { newGame(); }); });
    $("pcPause").addEventListener("click", togglePause);
    $("pcCam").addEventListener("click", function () { setCamera(G.cam === "chase" ? "city" : "chase"); focus(); });
    $("pcSound").addEventListener("click", function () { setSound(!G.sound); focus(); });
    $("pcHi").addEventListener("click", function () { var b = $("pcScores"); b.classList.toggle("on"); if (b.classList.contains("on")) loadScores(); focus(); });
    $("pcRender").value = G.render;
    $("pcRender").addEventListener("change", function () { G.render = $("pcRender").value === "pause" ? "pause" : "light"; LS.set("render", G.render); focus(); kick(); });
    $("pcNameOk").addEventListener("click", saveScore);
    $("pcCloseBtn").addEventListener("click", function (e) { e.stopPropagation(); if (typeof root.toggleDockGone === "function") root.toggleDockGone("chasedock", "tX_chasedock"); });
    doc.addEventListener("visibilitychange", function () { if (doc.hidden) { if (G.s && !G.demo && !G.paused) pause("the window went to the background"); } else kick(); });
    // the docker shown / unfolded -> draw again
    var wasGone = d.classList.contains("dockgone");
    if (root.MutationObserver) new root.MutationObserver(function () {
      var gone = d.classList.contains("dockgone");
      // shown from its button and not all in view in the column: ⛶ - it takes the column's whole height (static/dockmax.js push)
      if (wasGone && !gone && typeof root.toggleMax === "function" && !d.classList.contains("maxed")) setTimeout(function () {
        var col = $("maincol"), r = d.getBoundingClientRect(), c = col ? col.getBoundingClientRect() : r;
        if (!d.classList.contains("dockgone") && (r.bottom > c.bottom + 2 || r.top < c.top - 2 || st.offsetHeight < 300)) root.toggleMax("chasedock", true);
      }, 60);
      wasGone = gone;
      if (shown()) { start(); kick(); } else if (G.s && !G.demo && !G.paused) pause("the docker is hidden");
    }).observe(d, { attributes: true, attributeFilter: ["class"] });
    setInterval(function () { siren(); if (G.V && shown() && !G.raf && G.s && !G.demo && !G.paused && G.s.phase !== "over") kick(); if (G.V && shown() && G.paused && G.auto && !rendering()) { resume(); } }, 250);
    if (shown()) start();
    hud();
  }
  var started = null;
  function start() {
    if (started) return started;
    started = three().then(loadPack).then(function () { setupView(); loadScores(); kick(); return true; })
      .catch(function (e) { G.err = String((e && e.message) || e); var m = $("pcMsg"); if (m) m.innerHTML = "<b>⚠</b><span>" + esc(G.err) + "</span>"; started = null; return false; });
    return started;
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();

  root.H3Chase = {
    newGame: function (seed) { return start().then(function () { return newGame(seed); }); },
    pause: pause, resume: resume, camera: setCamera, sound: setSound, scores: loadScores, save: saveScore,
    state: function () { return G.demo ? null : G.s; },
    info: function () { return { ready: !!G.V, playing: !!(G.s && !G.demo), paused: G.paused, why: G.why, cam: G.cam, sound: G.sound, render: G.render, light: G.light,
                                 pack: G.pack ? { buildings: (G.pack.json.buildings || []).length, roads: !!G.pack.roadImgs } : null, drawn: G.drawn, frames: G.frames, looping: !!G.raf, shown: shown(), err: G.err, phase: G.s && !G.demo ? G.s.phase : "title" }; },
  };
})(window);
