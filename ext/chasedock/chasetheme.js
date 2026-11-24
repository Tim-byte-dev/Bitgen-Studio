/* bitGen Studio — ext/chasedock/chasetheme.js (2.939.0): POLICE CHASE's SETTINGS - the city, the suburbs, the forest and
 * the countryside (window.H3ChaseTheme).
 *
 * Tim: "i would like this old arcade style but with modern graphics and lighting. can we also have mazes with forests,
 * surburban housing, rural settings etc?"
 * The maze stays the same game; a setting changes what stands on the blocks, what the roads are made of, the sky and the
 * light. Everything here is made in code (no files, no one else's art):
 *   suburbs      lawns, houses with pitched roofs and lit windows facing the road, garden trees, hedges round the edge,
 *                street lamps; asphalt with kerbs and a dashed middle line; dusk
 *   forest       pines and round trees on a mossy floor, rocks, bushes, fireflies; dirt tracks with wheel ruts; moonlight
 *                and mist
 *   countryside  fields in rows (wheat, green crops), hay bales, red barns, silos, fences along the edge; gravel lanes;
 *                a warm sunset
 *   city         the buildings as before (the art pack's or the painted ones) + street lamps; night
 * THEMES, ORDER, pick(id, level) ("auto" = a new setting each level) and plan(id, maze, seed) -> [{type, x, y, rot, s, c}]
 * (tile coordinates, what stands where) are pure - scripts/test-939.js. paintGround() and build() need a canvas / three.js.
 */
(function (root) {
  "use strict";
  var THEMES = {
    city: { name: "City", sky: ["#05070f", "#141a2c"], fog: 0x0a0e1a, hemi: [0x9fb4ff, 0x1a1410, 1.0], moon: [0xbfd0ff, 1.5], lamps: 0.22 },
    suburbs: { name: "Suburbs", sky: ["#1b1638", "#e07a4f"], fog: 0x3a2a3a, hemi: [0xffc9a0, 0x22301c, 1.1], moon: [0xffc08a, 1.9], lamps: 0.16 },
    forest: { name: "Forest", sky: ["#02060a", "#0f2420"], fog: 0x0b1712, hemi: [0x8fb8d8, 0x10180c, 0.8], moon: [0xa8c8ff, 1.3], lamps: 0 },
    country: { name: "Countryside", sky: ["#2a3a6a", "#f3a65a"], fog: 0x6a5a58, hemi: [0xffe0b0, 0x2a2410, 1.25], moon: [0xffd29a, 2.2], lamps: 0 },
  };
  var ORDER = ["city", "suburbs", "forest", "country"];
  function pick(id, level) { return THEMES[id] ? id : ORDER[(Math.max(1, level | 0) - 1) % ORDER.length]; }
  function rng(seed) { var a = (Number(seed) >>> 0) || 1; return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  function open(m, x, y) { return x >= 0 && y >= 0 && x < m.W && y < m.H && m.grid[y * m.W + x] === 1; }
  /** the quarter turn that faces a block's front to a road next to it (0 = faces -y ... like the car's DIRS) */
  function facing(m, x, y, R) { var o = []; for (var d = 0; d < 4; d++) if (open(m, x + DIRS[d][0], y + DIRS[d][1])) o.push(d); return o.length ? o[Math.floor(R() * o.length)] : Math.floor(R() * 4); }

  /** what stands where: [{type, x, y (tile coords, centre = integer), rot (quarter turns), s (size), c (colour index)}] */
  function plan(id, m, seed) {
    id = THEMES[id] ? id : "city";
    var R = rng((seed | 0) * 13 + id.length * 101), out = [], st = m.station;
    var add = function (type, x, y, rot, s, c) { out.push({ type: type, x: x, y: y, rot: rot || 0, s: s || 1, c: c || 0 }); };
    for (var y = 0; y < m.H; y++) for (var x = 0; x < m.W; x++) {
      if (open(m, x, y)) {
        // street lamps on some road tiles, at the kerb next to a block
        if (THEMES[id].lamps && !(Math.abs(x - st.x) <= 1 && Math.abs(y - st.y) <= 1) && R() < THEMES[id].lamps) {
          for (var d = 0; d < 4; d++) if (!open(m, x + DIRS[d][0], y + DIRS[d][1])) { add("lamp", x + DIRS[d][0] * 0.44, y + DIRS[d][1] * 0.44, d); break; }
        }
        continue;
      }
      var edge = x === 0 || y === 0 || x === m.W - 1 || y === m.H - 1, j = function (k) { return (R() - 0.5) * k; };
      if (id === "city") continue;                                    // the city's blocks are its buildings
      if (id === "suburbs") {
        if (edge) { add("hedge", x, y, 0, 1, Math.floor(R() * 3)); if (R() < 0.25) add("tree", x + j(0.4), y + j(0.4), 0, 0.7 + R() * 0.3, Math.floor(R() * 4)); continue; }
        if (R() < 0.72) {
          add("house", x, y, facing(m, x, y, R), 0.9 + R() * 0.15, Math.floor(R() * 6));
          if (R() < 0.5) add("tree", x + (R() < 0.5 ? -0.36 : 0.36), y + (R() < 0.5 ? -0.36 : 0.36), 0, 0.45 + R() * 0.2, Math.floor(R() * 4));
        } else {
          add("tree", x + j(0.3) - 0.2, y + j(0.3) - 0.15, 0, 0.7 + R() * 0.3, Math.floor(R() * 4));
          add("tree", x + j(0.3) + 0.22, y + j(0.3) + 0.18, 0, 0.55 + R() * 0.3, Math.floor(R() * 4));
          add("bush", x + j(0.6), y + j(0.6), 0, 0.8, Math.floor(R() * 3));
        }
      } else if (id === "forest") {
        var n = edge ? 2 : 2 + Math.floor(R() * 2);
        for (var k = 0; k < n; k++) add(R() < 0.7 ? "pine" : "tree", x + j(0.62), y + j(0.62), 0, 0.65 + R() * 0.55, Math.floor(R() * 4));
        if (!edge && R() < 0.35) add("rock", x + j(0.6), y + j(0.6), Math.floor(R() * 4), 0.6 + R() * 0.6, 0);
        if (!edge && R() < 0.3) add("bush", x + j(0.6), y + j(0.6), 0, 0.7, Math.floor(R() * 3));
        if (!edge && R() < 0.25) add("firefly", x + j(0.8), y + j(0.8), 0, 1, 0);
      } else if (id === "country") {
        if (edge) { add("fence", x, y, (x === 0 || x === m.W - 1) ? 1 : 0, 1, 0); if (R() < 0.15) add("tree", x + j(0.3), y + j(0.3), 0, 0.8, Math.floor(R() * 4)); continue; }
        var r = R();
        if (r < 0.14) add("barn", x, y, facing(m, x, y, R), 0.95, 0);
        else if (r < 0.2) add("silo", x, y, 0, 0.9 + R() * 0.2, 0);
        else if (r < 0.38) { add("tree", x + j(0.4), y + j(0.4), 0, 0.75 + R() * 0.3, Math.floor(R() * 4)); if (R() < 0.5) add("bush", x + j(0.6), y + j(0.6), 0, 0.8, 0); }
        else { add("field", x, y, Math.floor(R() * 2), 1, Math.floor(R() * 3)); var b = Math.floor(R() * 3); for (var h = 0; h < b; h++) add("hay", x + j(0.6), y + j(0.6), Math.floor(R() * 4), 1, 0); }
      }
    }
    return out;
  }

  /* ---------------- the ground (a 2D canvas; tests skip) ---------------- */
  function speckle(g, x, y, P, n, cols, R) { for (var i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(R() * cols.length)]; g.fillRect(x + R() * P, y + R() * P, 1 + R() * 2, 1 + R() * 2); } }
  /** paint the roads and blocks of a setting (not the city - chasedock.js paints that) */
  function paintGround(id, g, m, P, home, items, seed) {
    var R = rng(seed * 7 + 3), fields = {};
    (items || []).forEach(function (it) { if (it.type === "field") fields[it.x + "," + it.y] = it; });
    for (var y = 0; y < m.H; y++) for (var x = 0; x < m.W; x++) {
      var X = x * P, Y = y * P, road = open(m, x, y);
      if (road && home[x + "," + y]) { g.fillStyle = "#4a4e58"; g.fillRect(X, Y, P, P); speckle(g, X, Y, P, 10, ["#585c66", "#3e424c"], R); continue; }
      if (id === "suburbs") {
        if (road) { g.fillStyle = "#2a2c31"; g.fillRect(X, Y, P, P); speckle(g, X, Y, P, 14, ["#33353b", "#24262b"], R); }
        else { g.fillStyle = "#3c6a32"; g.fillRect(X, Y, P, P); speckle(g, X, Y, P, 40, ["#4a7c3c", "#335a2a", "#56873f"], R); }
      } else if (id === "forest") {
        if (road) { g.fillStyle = "#6b5236"; g.fillRect(X, Y, P, P); speckle(g, X, Y, P, 30, ["#7c6142", "#5a442c", "#8a7050"], R); }
        else { g.fillStyle = "#1f3320"; g.fillRect(X, Y, P, P); speckle(g, X, Y, P, 50, ["#2a4428", "#172816", "#3a5030", "#4a3a22"], R); }
      } else if (id === "country") {
        if (road) { g.fillStyle = "#8a7a5c"; g.fillRect(X, Y, P, P); speckle(g, X, Y, P, 36, ["#9a8a6a", "#76684c", "#a89878"], R); }
        else {
          var f = fields[x + "," + y], rows = [["#c8a84a", "#b8963c"], ["#5a8a3a", "#4a7a30"], ["#8a9a3a", "#7a8a30"]][f ? f.c : 1];
          g.fillStyle = f ? rows[0] : "#4f7a36"; g.fillRect(X, Y, P, P);
          if (f) { g.fillStyle = rows[1]; for (var k = 0; k < P; k += Math.max(3, P / 8)) { if (f.rot) g.fillRect(X + k, Y, Math.max(1, P / 16), P); else g.fillRect(X, Y + k, P, Math.max(1, P / 16)); } }
          else speckle(g, X, Y, P, 30, ["#5c8a40", "#42682e"], R);
        }
      }
    }
    // the road's edges and marks
    for (var y2 = 0; y2 < m.H; y2++) for (var x2 = 0; x2 < m.W; x2++) {
      if (!open(m, x2, y2) || home[x2 + "," + y2]) continue;
      var X2 = x2 * P, Y2 = y2 * P;
      for (var d = 0; d < 4; d++) {
        if (open(m, x2 + DIRS[d][0], y2 + DIRS[d][1])) continue;
        g.strokeStyle = id === "suburbs" ? "#b8b8b0" : id === "forest" ? "rgba(40,30,18,.8)" : "rgba(90,80,60,.9)"; g.lineWidth = id === "suburbs" ? 3 : 2;
        g.beginPath();
        var a = [[X2, Y2 + 1, X2 + P, Y2 + 1], [X2 + 1, Y2, X2 + 1, Y2 + P], [X2, Y2 + P - 1, X2 + P, Y2 + P - 1], [X2 + P - 1, Y2, X2 + P - 1, Y2 + P]][d];
        g.moveTo(a[0], a[1]); g.lineTo(a[2], a[3]); g.stroke();
      }
      var lr = open(m, x2 - 1, y2) && open(m, x2 + 1, y2) && !open(m, x2, y2 - 1) && !open(m, x2, y2 + 1);
      var ud = open(m, x2, y2 - 1) && open(m, x2, y2 + 1) && !open(m, x2 - 1, y2) && !open(m, x2 + 1, y2);
      if (id === "suburbs") {
        g.strokeStyle = "rgba(255, 214, 90, .7)"; g.lineWidth = 2; g.setLineDash([P / 6, P / 6]); g.beginPath();
        if (lr) { g.moveTo(X2, Y2 + P / 2); g.lineTo(X2 + P, Y2 + P / 2); } if (ud) { g.moveTo(X2 + P / 2, Y2); g.lineTo(X2 + P / 2, Y2 + P); }
        g.stroke(); g.setLineDash([]);
      } else if (id === "forest" && (lr || ud)) {
        g.strokeStyle = "rgba(60,44,26,.75)"; g.lineWidth = Math.max(2, P / 14); g.beginPath();
        if (lr) { g.moveTo(X2, Y2 + P * 0.35); g.lineTo(X2 + P, Y2 + P * 0.35); g.moveTo(X2, Y2 + P * 0.65); g.lineTo(X2 + P, Y2 + P * 0.65); }
        else { g.moveTo(X2 + P * 0.35, Y2); g.lineTo(X2 + P * 0.35, Y2 + P); g.moveTo(X2 + P * 0.65, Y2); g.lineTo(X2 + P * 0.65, Y2 + P); }
        g.stroke();
      }
    }
  }

  /* ---------------- the 3D pieces (three.js; one instanced mesh a part) ---------------- */
  function build(T, id, m, items, city, world, glowTex) {
    var groups = {}, M = new T.Matrix4(), Q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0), col = new T.Color();
    var std = function (c, p) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, flatShading: true }, p || {})); };
    var PART = {
      house_body: [new T.BoxGeometry(0.6, 0.34, 0.48), std(0xffffff), 0.17],
      house_roof: [(function () { var g = new T.CylinderGeometry(0.37, 0.37, 0.66, 3, 1); g.rotateZ(Math.PI / 2); g.rotateX(Math.PI / 6); g.scale(1, 0.62, 0.9); return g; })(), std(0xffffff), 0.45],
      house_win: [new T.BoxGeometry(0.62, 0.08, 0.5), std(0x222222, { emissive: 0xffc070, emissiveIntensity: 1.3 }), 0.2],
      house_door: [new T.BoxGeometry(0.1, 0.16, 0.02), std(0x4a2a18), 0.08],
      trunk: [new T.CylinderGeometry(0.035, 0.05, 0.3, 6), std(0x5a3a22), 0.15],
      crown: [new T.IcosahedronGeometry(0.2, 0), std(0xffffff), 0.42],
      pine1: [new T.ConeGeometry(0.2, 0.36, 7), std(0xffffff), 0.36],
      pine2: [new T.ConeGeometry(0.15, 0.3, 7), std(0xffffff), 0.56],
      bush: [new T.IcosahedronGeometry(0.11, 0), std(0xffffff), 0.08],
      rock: [new T.DodecahedronGeometry(0.09, 0), std(0x7a7a80), 0.05],
      hedge: [new T.BoxGeometry(0.96, 0.22, 0.96), std(0xffffff), 0.11],
      fence_rail: [new T.BoxGeometry(0.98, 0.03, 0.03), std(0x8a6a44), 0.16],
      fence_post: [new T.BoxGeometry(0.04, 0.22, 0.04), std(0x7a5a38), 0.11],
      hay: [(function () { var g = new T.CylinderGeometry(0.09, 0.09, 0.12, 12); g.rotateZ(Math.PI / 2); return g; })(), std(0xd8b850), 0.09],
      barn_body: [new T.BoxGeometry(0.7, 0.4, 0.55), std(0xa8322a), 0.2],
      barn_roof: [(function () { var g = new T.CylinderGeometry(0.42, 0.42, 0.74, 3, 1); g.rotateZ(Math.PI / 2); g.rotateX(Math.PI / 6); g.scale(1, 0.55, 0.85); return g; })(), std(0x3a3a3e), 0.52],
      barn_door: [new T.BoxGeometry(0.22, 0.26, 0.02), std(0xf0f0e8), 0.13],
      silo: [new T.CylinderGeometry(0.16, 0.16, 0.8, 14), std(0xb8bcc0, { metalness: 0.5, roughness: 0.4 }), 0.4],
      silo_top: [new T.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x9aa0a6, { metalness: 0.5 }), 0.8],
      lamp_post: [new T.CylinderGeometry(0.012, 0.016, 0.62, 6), std(0x2a2c30, { metalness: 0.6 }), 0.31],
      lamp_head: [new T.BoxGeometry(0.1, 0.03, 0.05), std(0xfff2c8, { emissive: 0xffe0a0, emissiveIntensity: 2 }), 0.62],
    };
    var HOUSE = [0xe8dcc8, 0xc8d8e8, 0xf0e0a0, 0xd8b8a8, 0xb8d0b0, 0xe0c8d8], ROOF = [0x6a2a22, 0x3a3e48, 0x5a4030, 0x2e4a5a, 0x6a5a48, 0x4a2a2a];
    var LEAF = [0x3a7a32, 0x2e6a2a, 0x4a8a3a, 0x2a5a30], PINE = [0x1e4a2a, 0x24532e, 0x1a4024, 0x2a5a34], HEDGE = [0x2e5a26, 0x36662c, 0x284e22];
    var put = function (part, it, dx, dz, sc, c, ry) {
      (groups[part] = groups[part] || []).push({ x: it.x, y: it.y, dx: dx || 0, dz: dz || 0, s: (sc || 1) * (it.s || 1), c: c, ry: ry == null ? it.rot * Math.PI / 2 : ry });
    };
    items.forEach(function (it) {
      var sh = 0.85 + ((it.x * 7.3 + it.y * 3.1) % 1) * 0.3;
      if (it.type === "house") { put("house_body", it, 0, 0, 1, HOUSE[it.c % 6]); put("house_roof", it, 0, 0, 1, ROOF[it.c % 6]); put("house_win", it, 0, 0, 1); put("house_door", it, 0, -0.245, 1); }
      else if (it.type === "tree") { put("trunk", it, 0, 0, 1, null, 0); put("crown", it, 0, 0, 1, LEAF[it.c % 4], it.x * 3); }
      else if (it.type === "pine") { put("trunk", it, 0, 0, 0.8, null, 0); put("pine1", it, 0, 0, 1, PINE[it.c % 4], it.x); put("pine2", it, 0, 0, 1, PINE[(it.c + 1) % 4], it.y); }
      else if (it.type === "bush") put("bush", it, 0, 0, 1, LEAF[(it.c + 1) % 4], it.x * 5);
      else if (it.type === "rock") put("rock", it, 0, 0, 1, 0x7a7a80 * 0 + 0x80808a, it.x * 2);
      else if (it.type === "hedge") put("hedge", it, 0, 0, 1, HEDGE[it.c % 3], 0);
      else if (it.type === "fence") { put("fence_rail", it, 0, 0, 1); [-0.45, 0, 0.45].forEach(function (o) { put("fence_post", it, o, 0, 1); }); }
      else if (it.type === "hay") put("hay", it, 0, 0, 1, 0xd8b850 * 0 + (sh > 1 ? 0xe0c060 : 0xc8a848));
      else if (it.type === "barn") { put("barn_body", it); put("barn_roof", it); put("barn_door", it, 0, -0.285, 1); }
      else if (it.type === "silo") { put("silo", it); put("silo_top", it); }
      else if (it.type === "lamp") { put("lamp_post", it, 0, 0, 1, null, 0); put("lamp_head", it, 0, 0, 1, null, it.rot * Math.PI / 2); }
    });
    Object.keys(groups).forEach(function (part) {
      var P = PART[part], list = groups[part]; if (!P) return;
      var im = new T.InstancedMesh(P[0], P[1], list.length);
      list.forEach(function (q, i) {
        var w = world(m, q.x, q.y), c = Math.cos(q.ry), s = Math.sin(q.ry);
        // the part's own offset (dx, dz) turns with the piece; y: the part's height above the ground, scaled
        var ox = q.dx * c + q.dz * s, oz = -q.dx * s + q.dz * c;
        Q.setFromAxisAngle(Y, q.ry);
        M.compose(new T.Vector3(w[0] + ox * q.s, P[2] * q.s, w[1] + oz * q.s), Q, new T.Vector3(q.s, q.s, q.s));
        im.setMatrixAt(i, M);
        if (q.c != null) { col.setHex(q.c); im.setColorAt(i, col); }
      });
      im.castShadow = part !== "house_win" && part !== "lamp_head"; im.receiveShadow = true;
      city.add(im);
    });
    // glows: lamps (a halo + a pool of light on the road) and the forest's fireflies
    if (glowTex) {
      var halo = new T.SpriteMaterial({ map: glowTex, color: 0xffd89a, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      var poolM = new T.MeshBasicMaterial({ map: glowTex, color: 0xffc070, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending });
      var fly = new T.SpriteMaterial({ map: glowTex, color: 0xd8ff70, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      items.forEach(function (it) {
        var w = world(m, it.x, it.y);
        if (it.type === "lamp") {
          var sp = new T.Sprite(halo); sp.scale.setScalar(0.35); sp.position.set(w[0], 0.62, w[1]); city.add(sp);
          var d = DIRS[it.rot], pw = world(m, it.x - d[0] * 0.3, it.y - d[1] * 0.3);
          var pool = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), poolM); pool.rotation.x = -Math.PI / 2; pool.position.set(pw[0], 0.015, pw[1]); city.add(pool);
        } else if (it.type === "firefly") {
          for (var k = 0; k < 3; k++) { var f = new T.Sprite(fly); f.scale.setScalar(0.08); f.position.set(w[0] + (k - 1) * 0.15, 0.25 + k * 0.08, w[1] + ((k * 7) % 3 - 1) * 0.12); f.userData.firefly = k; city.add(f); }
        }
      });
    }
    return groups;
  }

  var API = { THEMES: THEMES, ORDER: ORDER, pick: pick, plan: plan, paintGround: paintGround, build: build };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.H3ChaseTheme = API;
})(typeof window !== "undefined" ? window : this);
