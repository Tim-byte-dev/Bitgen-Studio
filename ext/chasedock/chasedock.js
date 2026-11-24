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
 *   2.938.0     the 📡 jammer is a 🚀 rocket launcher: Space / F (a gamepad's A, X or right trigger; a tap) fires straight
 *               ahead - a car two burgers away is hit; the police's tricks drawn (🚧 roadblock, ⚡ nitro, spike strip, 🛡
 *               shield); headlight beams on every car; explosions light the street. P / Esc pause (Space fires now).
 *   2.939.0     settings (chasetheme.js): city, suburbs, forest, countryside - 🗺 Auto changes it each level; modern
 *               lighting: filmic tone mapping, soft moon / sun shadows, glowing headlights, light bars and lamps, the
 *               setting's sky; V cycles the views: overview, drone (high, following), driving (behind the roof)
 *   Sound       made on the spot with Web Audio (a siren that grows as the police close in, pick-ups, the jammer, a bust)
 *               - off to start with, M / 🔇 turns it on (kept)
 *   🏆          the best ten on this PC (GET / POST /api/police-chase/scores); a score that makes the ten is saved under
 *               bitGen's name for the player (2.940.0: Settings ▸ Security ▸ Preferred name, else the username - never asked)
 * window.H3Chase: newGame(seed), pause(why), resume(), camera(mode), sound(on), scores(), info() (tests)
 * 2.936.0 (Tim: "can i upload a blender file of the cars and the city maze? to make it a little more pleasing to the eye"):
 * an ART PACK, when installed - ext/chasedock/assets/pack.json (scripts/chase_assets.py makes it from a city .blend and a
 * roads kit; never in the repo, it ships as its own zip): the ground from its road pictures (straights turned to the road,
 * plain asphalt at the corners, pavers on the station square, pavement under the blocks) and each block a building of the
 * pack - a box wearing the five pictures Blender rendered of it, a random one, a random quarter turn. No pack = as before.
 * 2.937.0 (Tim: "it would be nice if the cars were the 3d models with a little aesthetics and the square cubes were hamburgers
 * or cakes"): the pack's cars (cars/getaway.glb, cars/police.glb from scripts/chase_car.py) replace the box cars - the police
 * paint in each car's colour, our light bar on its roof; the pick-ups are burgers and the bonus a cake (made here, no files).
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

  var G = { s: null, paused: true, why: "", auto: false, cam: ({ chase: "drone", drone: "drone", drive: "drive" })[LS.get("cam", "city")] || "city", theme: LS.get("theme", "auto"), sound: LS.get("sound", "0") === "1",
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
    // 2.939.0 modern lighting: filmic tone mapping, soft shadows from the moon / the low sun
    if (T.ACESFilmicToneMapping) { r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.15; }
    r.shadowMap.enabled = true; if (T.PCFSoftShadowMap) r.shadowMap.type = T.PCFSoftShadowMap;
    if ("outputColorSpace" in r && T.SRGBColorSpace) r.outputColorSpace = T.SRGBColorSpace;
    stage.insertBefore(r.domElement, stage.firstChild);
    var scene = new T.Scene();
    scene.fog = new T.Fog(0x070a14, 30, 70);
    var cam = new T.PerspectiveCamera(40, 1, 0.1, 200);
    var hemi = new T.HemisphereLight(0x9fb4ff, 0x1a1410, 1.25); scene.add(hemi);
    var sun = new T.DirectionalLight(0xffe6c8, 1.6); sun.position.set(-8, 18, 10); scene.add(sun); scene.add(sun.target);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    var V = { r: r, scene: scene, cam: cam, city: null, hemi: hemi, sun: sun, glowTex: glowTexture(), camPos: new T.Vector3(0, 30, 20), camLook: new T.Vector3(), player: null, police: [], lights: [] };
    var CM = G.pack && G.pack.cars || {};                          // 2.937.0: the pack's 3D cars, when there
    V.player = makeCar({ body: 0xff8a1c, roof: 0xffa94d, model: CM.getaway });
    scene.add(V.player.g);
    C.POLICE.forEach(function (p) {
      var c = makeCar({ body: p.color, roof: 0xf2f4f8, police: true, model: CM.police });
      c.accent = p.color; scene.add(c.g); V.police.push(c);
      var L = new T.PointLight(0xff2030, 0, 3.2, 2); scene.add(L); V.lights.push(L);
    });
    // the pick-ups
    fxSetup(V, scene);                                             // 2.938.0: rockets, explosions, roadblocks, spikes, shield, nitro, headlights
    V.jamGeo = new T.OctahedronGeometry(0.17);
    V.jamMat = new T.MeshStandardMaterial({ color: 0x39d0ff, emissive: 0x39d0ff, emissiveIntensity: 1.1, metalness: 0.2, roughness: 0.3 });
    V.bonus = makeCake();
    V.bonus.visible = false; scene.add(V.bonus);
    G.V = V;
    resize();
    if (root.ResizeObserver) new root.ResizeObserver(function () { resize(); kick(); }).observe(stage);
    return V;
  }
  /** 2.940.0: the docker on the whole screen / back (false when the browser says no - it stays maximized in the window) */
  /** 2.942.0 (Tim: "make full screen like (artist mode) when maximized"): maximized = the game alone on the whole screen, no
   *  frame - bitGen's bars, menus, dockers and the docker's own title bar hidden (body.pc-full), and the window goes full screen
   *  too, like the image editor's 🎨 Full Screen (Tim called it artist mode, its name before 2.836.0). The browser's own Esc only leaves the window's full screen (Esc pauses the game); the game
   *  stays frameless until 🗗 Exit, Ctrl+Esc, Ctrl+Shift+F or Shift+right-click. */
  function isFull() { return doc.body.classList.contains("pc-full"); }
  function setFull(on) {
    on = !!on; if (on === isFull()) return;
    doc.body.classList.toggle("pc-full", on);
    var de = doc.documentElement;
    if (on && !doc.fullscreenElement && de.requestFullscreen) { try { var p = de.requestFullscreen({ navigationUI: "hide" }); if (p && p.catch) p.catch(function () { /* no gesture - frameless in the window */ }); } catch (e) { /* old */ } }
    if (!on && doc.fullscreenElement === de && doc.exitFullscreen) { try { var q = doc.exitFullscreen(); if (q && q.catch) q.catch(function () {}); } catch (e) { /* fine */ } }
    setTimeout(function () { resize(); kick(); if (on) focus(); }, 80);
  }
  function exitFull() { if (typeof root.toggleMax === "function" && $("chasedock").classList.contains("maxed")) root.toggleMax("chasedock", false); else setFull(false); }
  function resize() {
    var V = G.V, st = $("pcStage"); if (!V || !st) return;
    var w = Math.max(50, st.clientWidth), h = Math.max(50, st.clientHeight);
    V.r.setSize(w, h, false); V.cam.aspect = w / h; V.cam.updateProjectionMatrix();
  }
  function box(w, h, d, m, x, y, z, g) { var o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; }
  /** a car, nose to -z: body, glass cabin, roof, wheels, lights; police: a red / blue light bar */
  function makeCar(o) {
    if (o.model) return modelCar(o);
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
  /** 2.937.0: a car from the pack's model (scripts/chase_car.py: nose -Z, wheels on the ground): its own materials per car,
   *  scaled to 0.8 of a tile; the police paint ("Body") in the car's colour and our light bar on the roof */
  function modelCar(o) {
    var g = new T.Group(), inner = new T.Group(), car = o.model.clone(true), mats = [], body = null;
    g.add(inner); inner.add(car);
    car.traverse(function (n) {
      if (!n.isMesh) return;
      var arr = [].concat(n.material).map(function (m0) {
        var m = m0.clone();
        if (o.police) { m.transparent = true; }
        if (m0.name === "Body") { body = m; if (o.police) { m.map = null; m.color.setHex(o.body); m.metalness = 0.4; m.roughness = 0.35; } }
        mats.push(m); return m;
      });
      n.material = Array.isArray(n.material) ? arr : arr[0];
    });
    var bb = new T.Box3().setFromObject(car), sz = bb.getSize(new T.Vector3()), k = 0.8 / Math.max(sz.x, sz.z, 1e-6);
    car.scale.multiplyScalar(k);
    bb = new T.Box3().setFromObject(car); var ctr = bb.getCenter(new T.Vector3());
    car.position.x -= ctr.x; car.position.z -= ctr.z; car.position.y -= bb.min.y;
    var top = bb.max.y - bb.min.y;
    var c = { g: g, inner: inner, mats: mats, mBody: body || mats[0] || new T.MeshStandardMaterial(), ang: 0, model: true };
    if (o.police) {
      var M = function (p) { return new T.MeshStandardMaterial(Object.assign({ transparent: true }, p)); };
      c.red = M({ color: 0x400008, emissive: 0xff1030, emissiveIntensity: 0 });
      c.blue = M({ color: 0x000840, emissive: 0x2050ff, emissiveIntensity: 0 });
      box(0.11, 0.04, 0.07, c.red, -0.06, top * 0.86 + 0.02, 0.03, inner); box(0.11, 0.04, 0.07, c.blue, 0.06, top * 0.86 + 0.02, 0.03, inner);
      mats.push(c.red, c.blue);
    }
    return c;
  }
  /** 2.937.0: the pick-ups - a burger (bun, patty, cheese, lettuce, bun), five instanced layers; the bonus - a cake */
  var BURGER = null;
  function burgerParts() {
    if (BURGER) return BURGER;
    var S = function (c, p) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, p || {})); };
    var lay = function (geo, y, mat) { geo.translate(0, y, 0); return { geo: geo, mat: mat }; };
    var top = new T.SphereGeometry(0.088, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); top.scale(1, 0.7, 1);
    var cheese = new T.BoxGeometry(0.15, 0.008, 0.15); cheese.rotateY(Math.PI / 4);
    BURGER = [
      lay(new T.CylinderGeometry(0.084, 0.074, 0.034, 18), 0.017, S(0xd9913f, { emissive: 0x2a1404 })),
      lay(new T.CylinderGeometry(0.092, 0.092, 0.03, 18), 0.049, S(0x5a2e17, { roughness: 0.9 })),
      lay(cheese, 0.068, S(0xffc928, { emissive: 0x3a2a00 })),
      lay(new T.CylinderGeometry(0.098, 0.098, 0.01, 14), 0.077, S(0x4fb83a, { emissive: 0x0c2a08 })),
      lay(top, 0.082, S(0xe39a45, { emissive: 0x2a1404, roughness: 0.5 })),
    ];
    return BURGER;
  }
  function makeCake() {
    var g = new T.Group(), S = function (c, p) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, p || {})); };
    var add = function (geo, mat, y) { var o = new T.Mesh(geo, mat); o.position.y = y; g.add(o); return o; };
    add(new T.CylinderGeometry(0.2, 0.2, 0.014, 24), S(0xf4f4f4), 0.007);                                 // the plate
    add(new T.CylinderGeometry(0.15, 0.15, 0.1, 24), S(0xf3a6c8, { emissive: 0x3a1020 }), 0.064);        // pink sponge
    add(new T.TorusGeometry(0.15, 0.012, 8, 32), S(0xffffff), 0.114).rotation.x = Math.PI / 2;           // icing ring
    add(new T.CylinderGeometry(0.1, 0.1, 0.075, 24), S(0xfff1d6, { emissive: 0x2a2010 }), 0.152);        // cream top tier
    add(new T.SphereGeometry(0.03, 12, 8), S(0xd0102a, { emissive: 0x500008, roughness: 0.3 }), 0.215);  // the cherry
    add(new T.CylinderGeometry(0.008, 0.008, 0.07, 8), S(0x7ec8ff), 0.225).position.x = 0.05;           // a candle
    add(new T.SphereGeometry(0.014, 8, 6), S(0xffd060, { emissive: 0xffa000, emissiveIntensity: 2 }), 0.27).position.x = 0.05;
    return g;
  }
  /* ---- 2.939.0: modern lighting - glows, the setting's sky and light ---- */
  function glowTexture() {
    var c = doc.createElement("canvas"); c.width = c.height = 64; var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  }
  function skyTexture(cols) {
    var c = doc.createElement("canvas"); c.width = 4; c.height = 256; var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    var t = new T.CanvasTexture(c); if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; return t;
  }
  function lightTheme(theme, m) {
    var V = G.V, th = (root.H3ChaseTheme && root.H3ChaseTheme.THEMES[theme]) || null; if (!th) return;
    if (V.scene.background && V.scene.background.dispose) V.scene.background.dispose();
    V.scene.background = skyTexture(th.sky); V.scene.fog.color.setHex(th.fog);
    V.hemi.color.setHex(th.hemi[0]); V.hemi.groundColor.setHex(th.hemi[1]); V.hemi.intensity = th.hemi[2];
    V.sun.color.setHex(th.moon[0]); V.sun.intensity = th.moon[1];
    V.sun.position.set(-m.W * 0.45, 16, m.H * 0.55); V.sun.target.position.set(0, 0, 0);
    var sc = V.sun.shadow.camera, half = Math.max(m.W, m.H) * 0.62;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 60; sc.updateProjectionMatrix();
  }
  /** glows on a car: two headlight halos, and on a police car a red and a blue halo over its light bar */
  var GLOWTEX = null;
  function addGlows(c, police) {
    var mk = function (col, sc, x, y, z) { var sp = new T.Sprite(new T.SpriteMaterial({ map: GLOWTEX, color: col, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); sp.scale.setScalar(sc); sp.position.set(x, y, z); c.g.add(sp); return sp; };
    c.headGlow = [mk(0xfff0c8, 0.22, -0.13, 0.16, -0.42), mk(0xfff0c8, 0.22, 0.13, 0.16, -0.42)];
    if (police) { c.redGlow = mk(0xff2030, 0.5, -0.07, 0.4, 0.03); c.blueGlow = mk(0x3060ff, 0.5, 0.07, 0.4, 0.03); }
    c.g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
  }
  /* ---- 2.938.0: rocket launchers, rockets, explosions, the police's tricks, headlights ---- */
  function SM(c, p) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5 }, p || {})); }
  function part(g, geo, mat, x, y, z) { var o = new T.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); g.add(o); return o; }
  /** the pick-up: a launcher tube on a grip, a red warhead peeping out, glowing a little */
  function makeLauncher() {
    var g = new T.Group(), tube = SM(0x3f5a2a, { metalness: 0.4 }), dark = SM(0x1a1d22), red = SM(0xd02020, { emissive: 0x501010 });
    var t = part(g, new T.CylinderGeometry(0.045, 0.045, 0.34, 14), tube, 0, 0.09, 0); t.rotation.x = Math.PI / 2;
    var w = part(g, new T.ConeGeometry(0.04, 0.08, 12), red, 0, 0.09, -0.2); w.rotation.x = -Math.PI / 2;
    part(g, new T.BoxGeometry(0.03, 0.07, 0.04), dark, 0, 0.035, 0.04);
    part(g, new T.BoxGeometry(0.06, 0.04, 0.05), dark, 0, 0.13, -0.02);
    var glow = part(g, new T.SphereGeometry(0.2, 12, 8), new T.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.12, depthWrite: false, blending: T.AdditiveBlending }), 0, 0.09, 0);
    glow.userData.glow = true;
    return g;
  }
  function makeRocket() {
    var g = new T.Group(), body = SM(0xdadde2, { metalness: 0.5 }), red = SM(0xd02020);
    var b = part(g, new T.CylinderGeometry(0.025, 0.025, 0.16, 10), body); b.rotation.x = Math.PI / 2;
    var n = part(g, new T.ConeGeometry(0.025, 0.06, 10), red, 0, 0, -0.11); n.rotation.x = -Math.PI / 2;
    var f = part(g, new T.ConeGeometry(0.035, 0.18, 10), new T.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }), 0, 0, 0.17);
    f.rotation.x = Math.PI / 2; g.userData.flame = f;
    return g;
  }
  /** Sarge's roadblock: a striped barrier on two legs and two cones */
  function makeBlock() {
    var g = new T.Group(), white = SM(0xf2f2f2, { emissive: 0x202020 }), red = SM(0xe02a1a, { emissive: 0x300800 }), leg = SM(0x333333), cone = SM(0xff7a1a, { emissive: 0x401800 });
    for (var i = 0; i < 6; i++) part(g, new T.BoxGeometry(0.12, 0.07, 0.04), i % 2 ? white : red, -0.3 + i * 0.12, 0.2, 0);
    part(g, new T.BoxGeometry(0.03, 0.18, 0.03), leg, -0.3, 0.09, 0); part(g, new T.BoxGeometry(0.03, 0.18, 0.03), leg, 0.3, 0.09, 0);
    part(g, new T.ConeGeometry(0.05, 0.14, 12), cone, -0.38, 0.07, 0.12); part(g, new T.ConeGeometry(0.05, 0.14, 12), cone, 0.38, 0.07, -0.12);
    var lamp = part(g, new T.SphereGeometry(0.025, 8, 6), SM(0xffb000, { emissive: 0xffb000, emissiveIntensity: 2 }), 0, 0.26, 0); g.userData.lamp = lamp;
    return g;
  }
  /** Flanker's spike strip: a dark band with a row of steel teeth */
  function makeSpikes() {
    var g = new T.Group(), steel = SM(0xb8c0c8, { metalness: 0.9, roughness: 0.3 });
    part(g, new T.BoxGeometry(0.7, 0.015, 0.12), SM(0x202226), 0, 0.008, 0);
    for (var i = 0; i < 9; i++) part(g, new T.ConeGeometry(0.018, 0.05, 6), steel, -0.32 + i * 0.08, 0.04, 0);
    return g;
  }
  function beamTexture() {
    var c = doc.createElement("canvas"); c.width = 64; c.height = 128; var g = c.getContext("2d");
    var gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, "rgba(255,240,200,0.85)"); gr.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(26, 128); g.lineTo(38, 128); g.lineTo(64, 0); g.lineTo(0, 0); g.closePath(); g.fill();
    return new T.CanvasTexture(c);
  }
  /** headlight beams on the road ahead of a car (a soft additive patch, turns with the car) */
  function addBeams(c, tex, color) {
    var mat = new T.MeshBasicMaterial({ map: tex, color: color || 0xfff0c8, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending });
    var beam = new T.Mesh(new T.PlaneGeometry(0.75, 1.3), mat); beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.012, -0.98);
    c.g.add(beam); c.beam = beam;
  }
  function fxSetup(V, scene) {
    GLOWTEX = V.glowTex;
    var pool = function (n, make) { var a = []; for (var i = 0; i < n; i++) { var o = make(); o.visible = false; scene.add(o); a.push(o); } return a; };
    V.rocketPool = pool(8, makeRocket);
    V.boomPool = pool(8, function () { return new T.Mesh(new T.SphereGeometry(0.3, 16, 10), new T.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); });
    V.blockPool = pool(6, makeBlock);
    V.spikePool = pool(6, makeSpikes);
    V.boomLight = new T.PointLight(0xff8830, 0, 4, 2); scene.add(V.boomLight);
    var bt = beamTexture();
    addBeams(V.player, bt); addGlows(V.player, false);
    V.police.forEach(function (c) {
      addBeams(c, bt); addGlows(c, true);
      var sh = new T.Mesh(new T.SphereGeometry(0.55, 20, 14), new T.MeshBasicMaterial({ color: 0x60c8ff, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending }));
      sh.position.y = 0.2; sh.visible = false; c.g.add(sh); c.shieldMesh = sh;
      var fl = new T.Mesh(new T.ConeGeometry(0.07, 0.4, 10), new T.MeshBasicMaterial({ color: 0x60b0ff, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending }));
      fl.rotation.x = Math.PI / 2; fl.position.set(0, 0.12, 0.62); fl.visible = false; c.g.add(fl); c.nitro = fl;
    });
    // the launcher on the getaway car's roof while it lasts
    var rl = makeLauncher(); rl.children.forEach(function (o) { if (o.userData.glow) o.visible = false; }); rl.scale.setScalar(1.1); rl.position.set(0, 0.3, 0.05);
    rl.visible = false; V.player.g.add(rl); V.player.launcher = rl;
    // 2.942.0: the explosions' fire, smoke and bits; the ⚡ speed boosts; turbo flames
    V.rocketPool.forEach(function (o) { o.scale.setScalar(2); });
    partsSetup(V, scene);
    V.boostPool = pool(3, makeBoost);
    var tf = function () { var f = new T.Mesh(new T.ConeGeometry(0.06, 0.42, 10), new T.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending })); f.rotation.x = Math.PI / 2; f.visible = false; return f; };
    V.player.turbo = [tf(), tf()]; V.player.turbo[0].position.set(-0.11, 0.1, 0.6); V.player.turbo[1].position.set(0.11, 0.1, 0.6);
    V.player.turbo.forEach(function (f) { V.player.g.add(f); });
  }
  /* ---------- 2.942.0: explosions - fire, smoke, flying bits, a shock ring; smoke trails behind rockets and wrecks ---------- */
  function partsSetup(V, scene) {
    var spr = function (add) { var m = new T.SpriteMaterial({ map: GLOWTEX, color: 0xffffff, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, toneMapped: !add }); var o = new T.Sprite(m); o.visible = false; scene.add(o); return o; };
    var P = V.parts = { fire: [], smoke: [], bits: [], rings: [], live: [], wait: 0 };
    for (var i = 0; i < 90; i++) P.fire.push(spr(true));
    for (var j = 0; j < 90; j++) P.smoke.push(spr(false));
    var bitMat = [SM(0x2a2622, { roughness: 0.9 }), SM(0x7a7f88, { metalness: 0.6 }), SM(0xff8a30, { emissive: 0xff5010, emissiveIntensity: 1.5 })];
    for (var k = 0; k < 48; k++) { var b = new T.Mesh(new T.BoxGeometry(0.06, 0.03, 0.08), bitMat[k % 3]); b.visible = false; b.castShadow = false; scene.add(b); P.bits.push(b); }
    for (var r = 0; r < 4; r++) { var ring = new T.Mesh(new T.RingGeometry(0.3, 0.42, 40), new T.MeshBasicMaterial({ color: 0xffc070, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring); P.rings.push(ring); }
  }
  function partFree(list) { for (var i = 0; i < list.length; i++) if (!list[i].visible) return list[i]; return null; }
  /** one particle: kind fire | smoke | bit | ring at world (x, y, z) with a velocity, a life, a start and end size */
  function emit(P, kind, x, y, z, vx, vy, vz, life, s0, s1, col) {
    var o = partFree(kind === "fire" ? P.fire : kind === "smoke" ? P.smoke : kind === "bit" ? P.bits : P.rings); if (!o) return;
    o.visible = true; o.position.set(x, y, z);
    if (o.material.color) o.material.color.setHex(col != null ? col : kind === "smoke" ? 0x3a3734 : 0xffb050);
    P.live.push({ o: o, kind: kind, vx: vx, vy: vy, vz: vz, life: life, age: 0, s0: s0, s1: s1, spin: (Math.random() - 0.5) * 14 });
  }
  /** a burst at a tile: small (a rocket at a wall), big (a police car), huge (the getaway car) */
  function burst(V, m, x, y, size) {
    var P = V.parts, w = world(m, x, y), R = Math.random, nF = [8, 32, 38][size], nS = [5, 16, 22][size], nB = [4, 14, 20][size], up = [1.2, 2.2, 2.8][size];
    if (size) { emit(P, "fire", w[0], 0.35, w[1], 0, 0, 0, 0.3, 0.9 + 0.4 * size, 1.7 + 0.6 * size, 0xfff4d0); emit(P, "fire", w[0], 0.4, w[1], 0, 0.4, 0, 0.6, 0.8 + 0.3 * size, 1.5 + 0.5 * size, 0xff9030); }   // the flash
    for (var i = 0; i < nF; i++) { var a = R() * 6.283, sp = R() * 1.6 * up; emit(P, "fire", w[0], 0.25, w[1], Math.cos(a) * sp, 0.6 + R() * up, Math.sin(a) * sp, 0.4 + R() * 0.5, 0.4 + 0.2 * size, 0.9 + 0.6 * size, R() < 0.3 ? 0xfff2b0 : R() < 0.6 ? 0xffa040 : 0xff5a1a); }
    for (var j = 0; j < nS; j++) { var b = R() * 6.283, sq = R() * 0.6; emit(P, "smoke", w[0] + Math.cos(b) * 0.15, 0.3 + R() * 0.3, w[1] + Math.sin(b) * 0.15, Math.cos(b) * sq, 0.5 + R() * 0.8, Math.sin(b) * sq, 1.1 + R() * 1.1, 0.4, 1.3 + 0.5 * size, 0x5e5953); }
    for (var k = 0; k < nB; k++) { var c = R() * 6.283, sb = 1 + R() * 2.4; emit(P, "bit", w[0], 0.3, w[1], Math.cos(c) * sb, 2 + R() * 2.5 * up / 2, Math.sin(c) * sb, 1.2 + R() * 0.6, 1, 1); }
    if (size) emit(P, "ring", w[0], 0.03, w[1], 0, 0, 0, 0.5, 0.4, 2.6 + size);
  }
  function partsUpdate(V, dt) {
    var P = V.parts; if (!P) return;
    P.live = P.live.filter(function (q) {
      q.age += dt; var k = q.age / q.life, o = q.o;
      if (k >= 1) { o.visible = false; return false; }
      if (q.kind === "bit") {
        q.vy -= 9.8 * dt; o.position.x += q.vx * dt; o.position.y += q.vy * dt; o.position.z += q.vz * dt;
        if (o.position.y < 0.02) { o.position.y = 0.02; q.vy *= -0.35; q.vx *= 0.6; q.vz *= 0.6; }
        o.rotation.x += q.spin * dt; o.rotation.z += q.spin * 0.7 * dt; return true;
      }
      o.position.x += q.vx * dt; o.position.y += q.vy * dt; o.position.z += q.vz * dt;
      var sz = q.s0 + (q.s1 - q.s0) * Math.sqrt(k);
      if (q.kind === "ring") { o.scale.setScalar(sz); o.material.opacity = 0.8 * (1 - k); return true; }
      o.scale.setScalar(sz);
      if (q.kind === "fire") { q.vx *= 0.94; q.vz *= 0.94; o.material.opacity = (1 - k) * 0.95; }
      else { q.vx *= 0.97; q.vz *= 0.97; o.material.opacity = Math.min(1, k * 6) * (1 - k) * 0.8; }
      return true;
    });
  }
  /** 2.942.0: ⚡ a speed boost - a glowing lightning bolt over a spinning ring */
  function makeBoost() {
    var g = new T.Group(), sh = new T.Shape();
    [[0.03, 0.2], [-0.07, 0.01], [0, 0.01], [-0.04, -0.2], [0.08, 0.03], [0.01, 0.03], [0.06, 0.2]].forEach(function (pt, i) { if (i) sh.lineTo(pt[0], pt[1]); else sh.moveTo(pt[0], pt[1]); });
    var bolt = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }), SM(0xffd23a, { emissive: 0xffb000, emissiveIntensity: 1.6, metalness: 0.3 }));
    bolt.position.set(0, 0.3, -0.02); bolt.scale.setScalar(1.3); g.add(bolt); g.userData.bolt = bolt;
    var ring = new T.Mesh(new T.TorusGeometry(0.26, 0.022, 8, 36), new T.MeshBasicMaterial({ color: 0x40e0ff, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring); g.userData.ring = ring;
    var glow = new T.Sprite(new T.SpriteMaterial({ map: GLOWTEX, color: 0xffd040, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending }));
    glow.scale.setScalar(0.9); glow.position.y = 0.3; g.add(glow);
    return g;
  }
  /** a car burnt out (k 0..1) - its paint darkened, kept to put back */
  function charCar(v, k) {
    if ((v.charK || 0) === k) return; v.charK = k;
    (v.mats || []).forEach(function (mt) {
      if (!mt.color || mt.blending === T.AdditiveBlending) return;
      if (!mt.userData.c0) mt.userData.c0 = mt.color.getHex();
      mt.color.setHex(mt.userData.c0); if (k) mt.color.multiplyScalar(1 - 0.85 * k);
    });
  }
  function fxDraw(V, s, m, t, dt) {
    var put = function (o, x, y) { var w = world(m, x, y); o.position.x = w[0]; o.position.z = w[1]; };
    var P = V.parts, R = Math.random;
    P.wait -= dt; var puff = P.wait <= 0; if (puff) P.wait = 0.045;
    V.rocketPool.forEach(function (o, i) {
      var r = s.rockets && s.rockets[i]; o.visible = !!r; if (!r) return;
      put(o, r.x, r.y); o.position.y = 0.3; o.rotation.y = ANG[r.dir]; o.userData.flame.scale.y = 0.8 + R() * 0.5;
      if (puff) { var D = C.DIRS[r.dir]; emit(P, "smoke", o.position.x - D[0] * 0.25, 0.3, o.position.z - D[1] * 0.25, (R() - 0.5) * 0.2, 0.15, (R() - 0.5) * 0.2, 0.55, 0.12, 0.45, 0xb8b4ae); emit(P, "fire", o.position.x - D[0] * 0.2, 0.3, o.position.z - D[1] * 0.2, 0, 0, 0, 0.12, 0.18, 0.05, 0xffc060); }
    });
    // 2.942.0: each new explosion - fire, smoke, bits (police car and getaway car bigger); the light follows the newest
    var boom = null, big = 0;
    (s.fx || []).forEach(function (f) {
      if (!f.seen && f.kind !== "shield") { f.seen = true; burst(V, m, f.x, f.y, f.kind === "crash" ? 2 : f.kind === "wreck" ? 1 : 0); }
      if (f.kind !== "shield" && (!boom || f.t < boom.t)) boom = f;
    });
    V.boomPool.forEach(function (o, i) {
      var f = (s.fx || [])[i]; o.visible = !!f && f.t < 0.7; if (!o.visible) return;
      put(o, f.x, f.y); o.position.y = 0.25;
      var sc = f.kind === "crash" ? 1.8 : f.kind === "wreck" ? 1.4 : 1;
      var k = f.t / 0.7; o.scale.setScalar(f.kind === "shield" ? 1.2 + k * 1.5 : (0.4 + k * 2.2) * sc); o.material.opacity = Math.max(0, 1 - k) * (f.kind === "shield" ? 0.5 : 0.9);
      o.material.color.setHex(f.kind === "shield" ? 0x60c8ff : k < 0.3 ? 0xfff0a0 : 0xff7030);
    });
    if (boom) {
      big = boom.kind === "crash" ? 16 : boom.kind === "wreck" ? 11 : 6;
      put(V.boomLight, boom.x, boom.y); V.boomLight.position.y = 0.6; V.boomLight.distance = boom.kind === "boom" ? 4 : 7;
      V.boomLight.intensity = big * Math.max(0, 1 - boom.t / (boom.kind === "boom" ? 0.5 : 0.9)) * (0.85 + R() * 0.3);
    } else V.boomLight.intensity = 0;
    // wrecks burn and smoke; the getaway car too, once caught
    if (puff) {
      s.police.forEach(function (c) { if (c.mode === "wreck") { var w = world(m, c.x, c.y); emit(P, "smoke", w[0] + (R() - 0.5) * 0.2, 0.35, w[1] + (R() - 0.5) * 0.2, (R() - 0.5) * 0.15, 0.7 + R() * 0.4, (R() - 0.5) * 0.15, 1.3, 0.25, 0.9, 0x4a4642); if (R() < 0.7) emit(P, "fire", w[0] + (R() - 0.5) * 0.25, 0.25, w[1] + (R() - 0.5) * 0.25, 0, 0.6, 0, 0.4, 0.45, 0.15); } });
      if (s.phase === "busted") { var pw0 = world(m, s.player.x, s.player.y); emit(P, "smoke", pw0[0] + (R() - 0.5) * 0.2, 0.4, pw0[1] + (R() - 0.5) * 0.2, (R() - 0.5) * 0.15, 0.8 + R() * 0.5, (R() - 0.5) * 0.15, 1.4, 0.3, 1.1, 0x4a4642); emit(P, "fire", pw0[0] + (R() - 0.5) * 0.3, 0.3, pw0[1] + (R() - 0.5) * 0.3, 0, 0.7, 0, 0.45, 0.5, 0.15); }
    }
    partsUpdate(V, dt);
    // ⚡ the speed boosts (blinking in their last 2 s)
    V.boostPool.forEach(function (o, i) {
      var b = (s.boosts || [])[i]; o.visible = !!b && (b.t > 2 || Math.floor(t * 8) % 2 === 0); if (!b) return;
      put(o, b.x, b.y); o.userData.bolt.rotation.y = t * 3; o.userData.bolt.position.y = 0.3 + Math.sin(t * 4 + i) * 0.05; o.userData.ring.rotation.z = -t * 2;
      o.userData.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 6 + i));
    });
    var tb = s.player.turbo > 0 && s.phase === "play";
    V.player.turbo.forEach(function (f) { f.visible = tb; if (tb) { f.scale.set(1, 0.7 + R() * 0.7, 1); f.material.color.setHex(R() < 0.5 ? 0x8fd8ff : 0xffffff); } });
    V.blockPool.forEach(function (o, i) {
      var b = (s.blocks || [])[i]; o.visible = !!b && (b.t > 1 || Math.floor(t * 8) % 2 === 0); if (!b) return;
      put(o, b.x, b.y); o.rotation.y = C.open(m, b.x - 1, b.y) || C.open(m, b.x + 1, b.y) ? Math.PI / 2 : 0;
      o.userData.lamp.material.emissiveIntensity = Math.floor(t * 4) % 2 ? 2.5 : 0.2;
    });
    V.spikePool.forEach(function (o, i) {
      var b = (s.spikes || [])[i]; o.visible = !!b; if (!b) return;
      put(o, b.x, b.y); o.rotation.y = C.open(m, b.x - 1, b.y) || C.open(m, b.x + 1, b.y) ? Math.PI / 2 : 0;
    });
    s.police.forEach(function (c, i) {
      var v = V.police[i];
      var wr = c.mode === "wreck";
      v.shieldMesh.visible = !!c.shield && c.mode !== "wait" && c.mode !== "back" && !wr;
      if (v.shieldMesh.visible) v.shieldMesh.material.opacity = 0.16 + Math.sin(t * 5) * 0.06;
      var nit = !wr && (c.boost > 0 || c.turbo > 0);                                     // 2.942.0: ⚡ a boost shows like nitro
      v.nitro.visible = nit; if (nit) { v.nitro.scale.y = 0.8 + Math.random() * 0.6; v.nitro.material.color.setHex(c.turbo > 0 ? 0xffd040 : 0x60b0ff); }
      v.beam.visible = c.mode !== "back" && !wr;
      var on = c.mode !== "jammed" && c.mode !== "back" && !wr, fl = Math.floor(t * 6) % 2;     // 2.939.0: the light bar's halos
      v.redGlow.visible = on && fl === 1; v.blueGlow.visible = on && fl === 0;
      v.headGlow.forEach(function (h) { h.visible = c.mode !== "back" && !wr; });
    });
    (V.fireflies || []).forEach(function (f, i) { f.position.y = 0.25 + f.userData.firefly * 0.08 + Math.sin(t * 2 + i) * 0.05; f.material.opacity = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7); });
    V.player.launcher.visible = s.jamT > 0 && s.phase !== "busted";
    // 2.942.0: the launcher turns to the car it fires at (back to the front after)
    var aimR = null; (s.rockets || []).forEach(function (r) { if (r.auto && r.flown < 1.4) aimR = r; });
    var la = aimR ? wrapA(ANG[aimR.dir] - V.player.ang) : 0;
    V.player.launcher.rotation.y += wrapA(la - V.player.launcher.rotation.y) * Math.min(1, dt * 18);
    V.player.beam.material.opacity = s.slowT > 0 && Math.floor(t * 10) % 2 ? 0.2 : 0.55;
  }
  var world = function (m, x, y) { return [x - m.W / 2 + 0.5, y - m.H / 2 + 0.5]; };

  /** the city for this level's maze: the painted ground, the buildings, the cash, the jammers */
  function buildCity(s) {
    var V = G.V, m = s.maze;
    if (V.city) { V.scene.remove(V.city); V.city.traverse(function (o) { if (o.geometry) o.geometry.dispose(); [].concat(o.material || []).forEach(function (mt) { if (mt.map) mt.map.dispose(); if (mt.emissiveMap) mt.emissiveMap.dispose(); mt.dispose(); }); }); }
    var city = new T.Group(); V.city = city; V.scene.add(city);
    // 2.939.0: the setting (city / suburbs / forest / countryside) - what stands on the blocks, the roads, the sky, the light
    var TH = root.H3ChaseTheme, theme = TH ? TH.pick(G.theme, s.level) : "city", CITY = theme === "city";
    var items = TH ? TH.plan(theme, m, s.seed + s.level * 31) : [];
    G.themeNow = theme; lightTheme(theme, m);
    // the ground: one canvas - 32 px a tile painted, or (2.936.0) 64 px a tile from the art pack's road pictures
    var RP = CITY && G.pack && G.pack.roadImgs, P = RP ? 64 : CITY ? 32 : 48, cv = doc.createElement("canvas"); cv.width = m.W * P; cv.height = m.H * P;
    var g = cv.getContext("2d");
    g.fillStyle = "#2b2e38"; g.fillRect(0, 0, cv.width, cv.height);                       // pavement under the blocks
    var home = {}; m.station.tiles.forEach(function (t) { home[t[0] + "," + t[1]] = 1; });
    if (RP) paintRoads(g, m, P, home, RP);
    if (!CITY) TH.paintGround(theme, g, m, P, home, items, s.seed + s.level);
    for (var y = 0; y < m.H && !RP && CITY; y++) for (var x = 0; x < m.W; x++) {
      if (!C.open(m, x, y)) continue;
      g.fillStyle = home[x + "," + y] ? "#1b2846" : "#17191f"; g.fillRect(x * P, y * P, P, P);
    }
    g.strokeStyle = RP ? "#a7abb3" : "#5b6070"; g.lineWidth = RP ? 3 : 2;               // kerbs
    for (var y2 = 0; y2 < m.H && CITY; y2++) for (var x2 = 0; x2 < m.W; x2++) {
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
    for (var y3 = 0; y3 < m.H && !RP && CITY; y3++) for (var x3 = 0; x3 < m.W; x3++) {             // (the pack's roads have their own)
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
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; city.add(ground);
    var under = new T.Mesh(new T.PlaneGeometry(m.W + 60, m.H + 60), new T.MeshStandardMaterial({ color: 0x0c0f18, roughness: 1 }));
    under.rotation.x = -Math.PI / 2; under.position.y = -0.01; city.add(under);
    // the buildings: lit windows, three heights (low enough to see the streets behind them)
    var win = windowTextures(), R = C.rng(s.seed * 31 + s.level), byH = [[], [], [], []];
    var PB = G.pack && G.pack.json.buildings && G.pack.json.buildings.length ? G.pack.json.buildings : null, packed = [];   // 2.936.0
    for (var y4 = 0; y4 < m.H && CITY; y4++) for (var x4 = 0; x4 < m.W; x4++) {
      if (C.open(m, x4, y4)) continue;
      var edge = x4 === 0 || y4 === 0 || x4 === m.W - 1 || y4 === m.H - 1;
      if (!edge && PB) { var vi = Math.floor(R() * PB.length); (packed[vi] = packed[vi] || []).push([x4, y4, Math.floor(R() * 4)]); continue; }
      byH[edge ? 0 : 1 + Math.floor(R() * 3)].push([x4, y4, R()]);
    }
    packed.forEach(function (list, vi) { if (list) packBuildings(city, m, PB[vi], list); });
    if (TH) TH.build(T, theme, m, items, city, world, V.glowTex);                       // houses, trees, barns, lamps, fireflies
    V.fireflies = []; city.children.forEach(function (o) { if (o.userData && o.userData.firefly != null) V.fireflies.push(o); });
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
      im.castShadow = floors > 0; im.receiveShadow = true; city.add(im);
    });
    // the pick-ups (2.937.0: burgers): one instanced mesh a layer, a burger a tile
    var cashIdx = [], k = 0;
    for (var i = 0; i < m.W * m.H; i++) if (s.items[i] === 1) cashIdx.push(i);
    V.cash = burgerParts().map(function (p) { var im = new T.InstancedMesh(p.geo, p.mat, Math.max(1, cashIdx.length)); im.count = cashIdx.length; city.add(im); return im; });
    V.cashIdx = cashIdx;
    V.jams = m.jammers.map(function (j) { var o = makeLauncher(); var w = world(m, j[0], j[1]); o.position.set(w[0], 0.25, w[1]); city.add(o); o.userData.k = j[1] * m.W + j[0]; return o; });
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
    var F = b.faces || {}, D = b.dressed || {}, LT = b.lights || {}, sz = b.size_m || [1, 1, 1];
    // 2.938.0: the dressed pictures (brick, glass) when the pack has them, and their lit windows glowing at night
    var mat = function (f) {
      if (!F[f]) return new T.MeshStandardMaterial({ color: 0x161b26 });
      var pic = packTexture(D[f] || F[f]);
      return LT[f] ? new T.MeshStandardMaterial({ map: pic, color: 0xe2e6f0, roughness: 0.6, metalness: 0.1, emissive: 0xffffff, emissiveMap: packTexture(LT[f]), emissiveIntensity: 0.95 })
        : new T.MeshStandardMaterial({ map: pic, color: 0xe2e6f0, roughness: 0.85, emissive: 0x2a2f3a, emissiveMap: pic, emissiveIntensity: 0.35 });
    };
    var mats = [mat("px"), mat("nx"), mat("py"), new T.MeshStandardMaterial({ color: 0x161b26 }), mat("pz"), mat("nz")];
    var k = 0.94 / Math.max(sz[0], sz[1], 0.01), sx = sz[0] * k, sd = sz[1] * k, h = Math.min(1.8, sz[2] * k);
    var im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mats, list.length), M = new T.Matrix4(), Q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0);
    list.forEach(function (t, i) {
      var w = world(m, t[0], t[1]); Q.setFromAxisAngle(Y, ROT[t[2]]);
      M.compose(new T.Vector3(w[0], h / 2, w[1]), Q, new T.Vector3(sx, h, sd)); im.setMatrixAt(i, M);
    });
    im.userData.pack = b.id; im.castShadow = true; im.receiveShadow = true;
    city.add(im);
  }
  /** pack.json + its road pictures, if the pack is installed (null when not - the painted city then) */
  function loadPack() {
    return fetch("/ext/chasedock/assets/pack.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || j.version !== 1) return null;
      var roads = j.roads || {}, names = Object.keys(roads), imgs = {};
      return Promise.all(names.map(function (n) {
        return new Promise(function (ok) { var im = new Image(); im.onload = function () { imgs[n] = im; ok(); }; im.onerror = function () { ok(); }; im.src = "/ext/chasedock/assets/" + roads[n]; });
      })).then(function () {
        G.pack = { json: j, roadImgs: Object.keys(imgs).length ? imgs : null, cars: {} };
        var cars = j.cars || {}, GL = T.GLTFLoader ? new T.GLTFLoader() : null;
        return Promise.all(Object.keys(cars).map(function (role) {        // 2.937.0: the 3D cars (a car that fails stays a box)
          return GL ? new Promise(function (ok) { GL.load("/ext/chasedock/assets/" + cars[role], function (gl) { G.pack.cars[role] = gl.scene; ok(); }, null, function () { ok(); }); }) : null;
        })).then(function () { return G.pack; });
      });
    }).catch(function () { return null; });
  }
  var WIN = null;
  function windowTextures() {
    if (WIN) return WIN;
    var mk = function (lit) {
      var c = doc.createElement("canvas"); c.width = 64; c.height = 64; var g = c.getContext("2d");
      g.fillStyle = lit ? "#000" : "#e8e8e8"; g.fillRect(0, 0, 64, 64);
      if (!lit) {                                   // 2.938.0: brick on the walls
        g.fillStyle = "#c98a72"; g.fillRect(0, 0, 64, 64);
        g.strokeStyle = "rgba(235,225,215,.8)"; g.lineWidth = 1;
        for (var by = 0; by < 64; by += 4) { g.beginPath(); g.moveTo(0, by + 0.5); g.lineTo(64, by + 0.5); g.stroke();
          for (var bx = (by / 4) % 2 ? 4 : 0; bx < 64; bx += 8) { g.beginPath(); g.moveTo(bx + 0.5, by); g.lineTo(bx + 0.5, by + 4); g.stroke(); } }
      }
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
      // 2.942.0: caught - the car is thrown up, rolls and lands burnt out on its side
      var cr = null; (s.fx || []).forEach(function (f) { if (f.kind === "crash") cr = f; });
      if (s.phase === "busted" && cr) {
        var kc = Math.min(1, cr.t / 0.75);
        pc.inner.position.y = Math.sin(kc * Math.PI) * 0.55; pc.inner.rotation.z = kc * 2.2; pc.inner.rotation.x = Math.sin(kc * Math.PI) * 0.6;
        charCar(pc, Math.min(1, cr.t / 0.4)); pc.beam.visible = false;
      } else {
        pc.ang += wrapA(want - pc.ang) * Math.min(1, dt * 14);
        pc.inner.position.y = p.moving && s.phase === "play" ? Math.abs(Math.sin(t * 30)) * 0.008 : 0; pc.inner.rotation.z = 0; pc.inner.rotation.x = 0;
        charCar(pc, 0); pc.beam.visible = true;
      }
      pc.g.rotation.y = pc.ang;
      // the police
      var flash = Math.floor(t * 6) % 2;
      s.police.forEach(function (c, i) {
        var v = V.police[i], w = world(m, c.x, c.y), L = V.lights[i];
        v.g.position.set(w[0], c.mode === "wait" ? Math.abs(Math.sin(t * 3 + i)) * 0.05 : 0, w[1]);
        v.ang += wrapA(ANG[c.dir < 0 ? 0 : c.dir] - v.ang) * Math.min(1, dt * 12);
        v.g.rotation.y = v.ang;
        var jam = c.mode === "jammed", back = c.mode === "back", blink = jam && s.jamT < 2 && Math.floor(t * 8) % 2, wreck = c.mode === "wreck";
        if (wreck) {                                       // 2.942.0: blown up - thrown, on its side, burnt out
          var kw = Math.min(1, (C.WRECK.police - c.wreckT) / 0.6);
          v.inner.position.y = Math.sin(kw * Math.PI) * 0.45; v.inner.rotation.z = kw * 1.4; charCar(v, 1);
        } else {
          v.inner.position.y = 0; charCar(v, 0);
          v.mBody.color.setHex(jam ? (blink ? 0xdddddd : 0x55586a) : v.accent);
          v.inner.rotation.z = jam ? Math.sin(t * 14 + i) * 0.06 : 0;
        }
        var op = back ? 0.28 : 1;
        v.mats.forEach(function (mt) { mt.opacity = op; mt.depthWrite = !back; });
        var on = !jam && !back && !wreck;
        v.red.emissiveIntensity = on && flash ? 2.2 : 0; v.blue.emissiveIntensity = on && !flash ? 2.2 : 0;
        L.position.set(w[0], 0.7, w[1]); L.color.setHex(flash ? 0xff2030 : 0x2050ff); L.intensity = on ? 2.4 : 0;
      });
      // cash, jammers, the bonus
      if (!M4) { M4 = new T.Matrix4(); Q = new T.Quaternion(); E3 = new T.Euler(); S3 = new T.Vector3(); }
      var P3 = new T.Vector3();
      V.cashIdx.forEach(function (k, j) {
        var on = s.items[k] === 1, x = k % m.W, y = (k / m.W) | 0, w = world(m, x, y);
        E3.set(0, t * 1.2 + j * 0.37, 0); Q.setFromEuler(E3); S3.setScalar(on ? 1.05 : 0); P3.set(w[0], 0.03 + Math.abs(Math.sin(t * 3 + j)) * 0.04, w[1]);
        M4.compose(P3, Q, S3); for (var L = 0; L < V.cash.length; L++) V.cash[L].setMatrixAt(j, M4);
      });
      V.cash.forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
      V.jams.forEach(function (o, j) { o.visible = s.items[o.userData.k] === 2; o.rotation.y = t * 2; o.position.y = 0.12 + Math.sin(t * 4 + j) * 0.04; });
      fxDraw(V, s, m, t, dt);
      V.bonus.visible = !!s.bonus && (s.bonus.t > 2 || Math.floor(t * 6) % 2 === 0);
      if (s.bonus) { var bw = world(m, s.bonus.x, s.bonus.y); V.bonus.position.set(bw[0], 0.02 + Math.abs(Math.sin(t * 3)) * 0.05, bw[1]); V.bonus.rotation.y = t * 1.5; }
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
    var fov = G.cam === "drive" && G.s && !G.demo ? 64 : 40;
    if (cam.fov !== fov) { cam.fov = fov; cam.near = fov > 50 ? 0.03 : 0.1; cam.updateProjectionMatrix(); }
    if (G.cam === "drone" && G.s && !G.demo) {                        // 2.939.0: the drone - high up behind the car, gliding
      var d = C.DIRS[face];
      wantP.set(pw[0] - d[0] * 2.6, 4.4, pw[1] - d[1] * 2.6); wantL.set(pw[0] + d[0] * 1.4, 0, pw[1] + d[1] * 1.4);
      k = Math.min(1, dt * 3.2); fog.near = 10; fog.far = 34;
    } else if (G.cam === "drive" && G.s && !G.demo) {                 // the driving view - just behind and above the roof
      var e = C.DIRS[face];
      wantP.set(pw[0] - e[0] * 0.95, 0.46, pw[1] - e[1] * 0.95); wantL.set(pw[0] + e[0] * 2.6, 0.16, pw[1] + e[1] * 2.6);
      k = Math.min(1, dt * 7); fog.near = 4; fog.far = 18;
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
    var rot = G.cam !== "city" ? s.player.face : cityRot(s.maze);
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
    if (light !== G.light) { G.light = light; G.V.r.setPixelRatio(light ? 1 : Math.min(2, root.devicePixelRatio || 1)); G.V.sun.castShadow = !light; resize(); }
    if (light && G.last && now - G.last < 32) { G.raf = root.requestAnimationFrame(loop); return; }
    var dt = G.last ? Math.min(0.1, (now - G.last) / 1000) : 1 / 60; G.last = now;
    pad();
    var running = G.s && !G.paused && !G.demo && G.s.phase !== "over";          // GAME OVER: one last picture, then still
    if (running) { var evs = C.step(G.s, dt, { dir: G.input, fire: G.fire }); G.input = -1; G.fire = false; evs.forEach(onEvent); }
    draw(dt, now / 1000);
    hud();
    G.frames++;
    // paused (or the title): one frame is enough - the loop stops until something changes
    if (running || (G.demo && G.paused === false) || G.camSettling > 0) { G.camSettling = Math.max(0, (G.camSettling || 0) - 1); G.raf = root.requestAnimationFrame(loop); }
    else if (G.demo) { G.demoT = (G.demoT || 0) + 1; if (G.demoT < 2) G.raf = root.requestAnimationFrame(loop); }
  }

  /* ---------------- the game ---------------- */
  function newGame(seed) {
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
    if (qual) saveScore();       // 2.940.0: no name asked - bitGen's own (Settings ▸ Security ▸ Preferred name)
  }
  /** 2.940.0 (Tim: "no need to ask for name, it should use name provided in bitgen"): the preferred name, else the
   *  username (static/securitytab.js), else "Driver" */
  function playerName() {
    var S = root.H3Security;
    if (!S) return Promise.resolve("Driver");
    return Promise.resolve(S.load ? S.load() : null).then(function () { return (S.name() || "").trim().slice(0, 16) || "Driver"; }, function () { return (S.name() || "").trim().slice(0, 16) || "Driver"; });
  }
  function saveScore() {
    var s = G.s; if (!s) return Promise.resolve(null);
    if (s.saved) return Promise.resolve(null);
    s.saved = true;
    return playerName().then(function (name) {
      return fetch("/api/police-chase/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, score: s.score, level: s.level }) });
    }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.scores) { G.scores = j.scores; G.hiFile = j.scores.length ? j.scores[0].score : 0; paintScores(j.rank); $("pcScores").classList.add("on"); hud(); }
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
    var tb = $("pcTurbo"); if (tb) { tb.style.display = live && s.player.turbo > 0 ? "block" : "none"; if (live && s.player.turbo > 0) tb.firstChild.style.width = Math.round(100 * s.player.turbo / C.BOOST.last) + "%"; }
    $("pcPause").textContent = live && G.paused && s.phase !== "over" ? "▶ Carry on" : "⏸ Pause";
    $("pcCam").textContent = ({ city: "🎥 Overview", drone: "🎥 Drone", drive: "🎥 Driving" })[G.cam];
    $("pcSound").textContent = G.sound ? "🔊" : "🔇";
    var key = !live ? "title" : G.paused ? "pause:" + G.why : s.phase + (s.phase === "ready" ? s.level : "");
    if (key === G.msgKey) return;
    G.msgKey = key;
    var m = $("pcMsg"), b = "", t = "", dim = false;
    if (!live) { b = "🚓 POLICE CHASE"; t = "Pick up every burger and keep away from the police. A 🚀 rocket launcher turns the tables for a few seconds - the police run, and it fires by itself at a police car two car lengths away (Space fires too): a hit blows it up, but they can dodge. Grab the ⚡ speed boosts before the police do. Watch out: Sarge drops 🚧 roadblocks, Cutter has ⚡ nitro, Flanker lays spike strips, Rookie wears a 🛡 shield.<br>Click here, then press Enter or an arrow key." + (G.pack && G.pack.json.credits && G.pack.json.credits.length ? '<br><small style="opacity:.65">' + G.pack.json.credits.map(esc).join(" · ") + "</small>" : ""); dim = true; }
    else if (G.paused) { b = "PAUSED"; t = (G.why && G.why !== "paused" ? esc(G.why) + " · " : "") + "P or a click carries on"; dim = true; }
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
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var done = true, live = G.s && !G.demo;
    if (e.code in KEYS) {
      if (!live) newGame();
      else if (G.s.phase === "over") { done = true; }
      else { if (G.paused) resume(); G.input = toWorld(KEYS[e.code]); }
      snd("unlock");
    }
    else if (e.code === "Space" || e.code === "KeyF" || e.code === "ControlRight") { if (live && !G.paused && G.s.phase === "play") G.fire = true; }   // 2.938.0: 🚀 fire
    else if (e.code === "KeyP" || e.code === "Escape") togglePause();
    else if (e.code === "KeyV" || e.code === "KeyC") setCamera(nextCam());
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
    if ((b(0) || b(2) || b(7)) && !G.padPrev.fire && G.s && !G.demo && !G.paused) G.fire = true;      // 2.938.0: A / X / right trigger fire
    G.padPrev.fire = b(0) || b(2) || b(7);
    var st = b(9);
    if (st && !G.padPrev.start) { if (!G.s || G.demo || G.s.phase === "over") newGame(); else togglePause(); }
    G.padPrev.start = st;
  }
  var CAMS = ["city", "drone", "drive"];
  function nextCam() { return CAMS[(CAMS.indexOf(G.cam) + 1) % CAMS.length]; }
  /** 2.939.0: V - the overview, the drone following the car, the driving view (C still works; "chase" = the drone) */
  function setCamera(c) { G.cam = c === "chase" ? "drone" : CAMS.indexOf(c) >= 0 ? c : "city"; LS.set("cam", G.cam); G.camSettling = 40; hud(); kick(); }
  function setTheme(id) { G.theme = id; LS.set("theme", id); G.mazeOf = null; G.camSettling = 4; kick(); }
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
    else if (e === "fire") { noise(0.12, 0.08); tone("sawtooth", 900, 200, 0.25, 0.05); }
    else if (e === "boom") { noise(0.45, 0.3); tone("sine", 120, 40, 0.4, 0.12); }
    else if (e === "block") { tone("square", 160, 120, 0.12, 0.06); }
    else if (e === "nitro") { tone("sawtooth", 300, 1200, 0.5, 0.05); }
    else if (e === "spikes") { tone("triangle", 1800, 1500, 0.08, 0.04); tone("triangle", 1800, 1500, 0.08, 0.04, 0.1); }
    else if (e === "slow") { noise(0.3, 0.12); tone("square", 500, 120, 0.4, 0.05); }
    else if (e === "shield") { tone("sine", 1500, 2200, 0.2, 0.07); }
    else if (e === "jammer") { tone("sawtooth", 220, 1400, 0.35, 0.07); tone("sine", 1400, 300, 0.3, 0.05, 0.3); }
    else if (e === "tag") { noise(0.18, 0.18); tone("square", 180, 60, 0.2, 0.08); tone("sine", 660, 1320, 0.15, 0.05, 0.12); }
    else if (e === "crash") { noise(0.9, 0.45); tone("sine", 90, 28, 0.9, 0.2); tone("sawtooth", 200, 40, 0.5, 0.06); }   // 2.942.0
    else if (e === "kaboom") { noise(0.7, 0.38); tone("sine", 110, 30, 0.7, 0.16); }
    else if (e === "dodge") { noise(0.18, 0.06); tone("square", 1400, 900, 0.18, 0.03); }
    else if (e === "turbo") { tone("sawtooth", 200, 1600, 0.45, 0.06); tone("sine", 800, 2400, 0.3, 0.04, 0.1); }
    else if (e === "turbocop") { tone("sawtooth", 600, 150, 0.4, 0.05); }
    else if (e === "boostup") { tone("sine", 1760, 2637, 0.1, 0.04); }
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
    st.addEventListener("blur", function () { setTimeout(function () { if (doc.activeElement !== st && G.s && !G.demo && !G.paused && G.s.phase !== "over") pause("the game lost the focus"); }, 0); });
    st.addEventListener("pointerdown", function (e) {
      if (e.target && (e.target.closest("#pcScores"))) return;
      G.swipe = { x: e.clientX, y: e.clientY };
      focus();
      if (G.s && !G.demo && G.paused && G.s.phase !== "over") resume();
      start();
    });
    st.addEventListener("pointerup", function (e) {
      var w = G.swipe; G.swipe = null; if (!w || !G.s || G.demo) return;
      var dx = e.clientX - w.x, dy = e.clientY - w.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { if (!G.paused && G.s.phase === "play") G.fire = true; return; }   // a tap fires
      G.input = toWorld(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 0 : 2));
    });
    // the bar's buttons keep the focus on the city (a click there is no reason to pause)
    Array.prototype.forEach.call(d.querySelectorAll(".pcbar button"), function (b) { b.addEventListener("pointerdown", function (e) { e.preventDefault(); }); });
    $("pcNew").addEventListener("click", function () { start().then(function () { newGame(); }); });
    $("pcPause").addEventListener("click", togglePause);
    $("pcCam").addEventListener("click", function () { setCamera(nextCam()); focus(); });
    if ($("pcTheme")) { $("pcTheme").value = G.theme; $("pcTheme").addEventListener("change", function () { setTheme($("pcTheme").value); focus(); }); }
    $("pcSound").addEventListener("click", function () { setSound(!G.sound); focus(); });
    $("pcHi").addEventListener("click", function () { var b = $("pcScores"); b.classList.toggle("on"); if (b.classList.contains("on")) loadScores(); focus(); });
    $("pcRender").value = G.render;
    $("pcRender").addEventListener("change", function () { G.render = $("pcRender").value === "pause" ? "pause" : "light"; LS.set("render", G.render); focus(); kick(); });
    $("pcCloseBtn").addEventListener("click", function (e) { e.stopPropagation(); if (typeof root.toggleDockGone === "function") root.toggleDockGone("chasedock", "tX_chasedock"); });
    doc.addEventListener("visibilitychange", function () { if (doc.hidden) { if (G.s && !G.demo && !G.paused) pause("the window went to the background"); } else kick(); });
    // 2.942.0: maximized = full screen like the image editor's (setFull); the ways out
    $("pcExitFull").addEventListener("click", function (e) { e.stopPropagation(); exitFull(); });
    root.addEventListener("keydown", function (e) {
      if (!isFull()) return;
      var k = String(e.key || ""), ctl = e.ctrlKey || e.metaKey;
      if ((ctl && k === "Escape") || (ctl && e.shiftKey && (e.code === "KeyF"))) { e.preventDefault(); e.stopImmediatePropagation(); exitFull(); return; }
      // a plain Esc outside the game: pause, never "un-maximize" (the page's own Esc)
      if (k === "Escape" && !ctl && !(e.target && e.target.closest && e.target.closest("#pcStage"))) { e.stopImmediatePropagation(); if (G.s && !G.demo && !G.paused) pause("paused"); }
    }, true);
    root.addEventListener("mousedown", function (e) { if (isFull() && e.button === 2 && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); exitFull(); } }, true);
    root.addEventListener("contextmenu", function (e) { if (isFull() && e.shiftKey) e.preventDefault(); }, true);
    doc.addEventListener("fullscreenchange", function () { setTimeout(function () { resize(); kick(); }, 80); });
    // the docker shown / unfolded -> draw again
    var wasGone = d.classList.contains("dockgone");
    if (root.MutationObserver) new root.MutationObserver(function () {
      var gone = d.classList.contains("dockgone");
      setFull(d.classList.contains("maxed") && !d.classList.contains("dockgone"));   // 2.942.0: maximized = full screen, any way
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
    pause: pause, resume: resume, camera: setCamera, theme: setTheme, sound: setSound, scores: loadScores, save: saveScore,
    state: function () { return G.demo ? null : G.s; },
    full: function (on) { if (on == null) return isFull(); if (typeof root.toggleMax === "function") root.toggleMax("chasedock", !!on); return isFull(); },   // 2.942.0
    _view: function () { return G.V; },                                     // 2.942.0: for the browser tests (the effects drawn)
    info: function () { return { ready: !!G.V, playing: !!(G.s && !G.demo), paused: G.paused, why: G.why, cam: G.cam, sound: G.sound, render: G.render, light: G.light,
                                 setting: G.themeNow || "", pack: G.pack ? { buildings: (G.pack.json.buildings || []).length, roads: !!G.pack.roadImgs, cars: Object.keys(G.pack.cars || {}).sort() } : null, drawn: G.drawn, frames: G.frames, looping: !!G.raf, shown: shown(), err: G.err, phase: G.s && !G.demo ? G.s.phase : "title" }; },
  };
})(window);
