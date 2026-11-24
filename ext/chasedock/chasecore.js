/* bitGen Studio — ext/chasedock/chasecore.js (2.935.0): POLICE CHASE - the game's rules (window.H3ChaseCore; pure, no DOM).
 *
 * Tim (2.935.0): a small 3D maze-chase game as a docker for a break during work - "lets make it with cars, call it police
 * chase". Our own game: you drive the getaway car round a city of blocks, pick up every bag of cash and keep away from the
 * police. A 📡 radio jammer turns the tables for a few seconds: the police lose you, slow down and scatter, and a car you
 * bump is sent back to the station. Every level is a new city (a seeded maze, mirrored so it looks planned).
 *
 * The board is a grid of tiles: 1 = road, 0 = a city block. Cars sit on tile centres and drive along the roads at so many
 * tiles a second; they decide where to go at each tile centre.
 *   rng(seed) -> () => [0, 1)                       mulberry32
 *   makeMaze(seed, W, H) -> {W, H, grid, station {x, y, tiles}, start, jammers [[x, y] x4], homes [[x, y] x4]}
 *   newGame(seed, hi) -> state;  step(state, dt, input {dir}) -> [event]   ("cash", "jammer", "tag", "busted", "clear",
 *                                "over", "extra", "bonus", "bonusup", "go", "back", "mode")
 *   targetOf(state, i) -> [x, y]   where police car i heads now;  open(maze, x, y) -> bool
 * 2.938.0 (Tim: "we make pacmans magic pills into rocket launchers so we can chase the police cars and fire from 2
 * hamburgers away. give each police car it's own ability"): the 📡 jammer is now a 🚀 ROCKET LAUNCHER - while it lasts
 * (s.jamT) the police run and step(s, dt, {fire: true}) fires a rocket straight ahead (s.rockets): it flies ROCKET.range
 * tiles (2 burgers away) or to the next block, and a police car it hits goes back to the station like a bump. Each police
 * car has its own ability (ABILITY): Sarge drops a 🚧 roadblock behind him (blocks the getaway car; a rocket blows it up),
 * Cutter fires up ⚡ nitro on a straight with you in sight, Flanker drops a spike strip (drive over it: slowed), Rookie wears
 * a 🛡 shield that stops one rocket (back again when he comes out of the station). New events: fire, boom, block, nitro,
 * spikes, slow, shield. s.blocks / s.spikes / s.fx (explosions) for the view.
 *   POLICE  the four patrol cars: Sarge (straight at you), Cutter (where you are going), Flanker (from the side),
 *           Rookie (sometimes takes a wrong turn)
 */
(function (root) {
  "use strict";
  var DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];          // up, left, down, right (the tie-break order)
  var NAMES = ["up", "left", "down", "right"];
  var EPS = 1e-6;
  var POLICE = [
    { kind: "sarge", name: "Sarge", color: 0x2f6bff },
    { kind: "cutter", name: "Cutter", color: 0x23b5c9 },
    { kind: "flanker", name: "Flanker", color: 0x8a5cff },
    { kind: "rookie", name: "Rookie", color: 0x3fbf6a },
  ];
  // patrol / pursue - the police patrol their corners, then pursue; a jammer stops the clock
  var MODES = [["patrol", 7], ["pursue", 20], ["patrol", 7], ["pursue", 20], ["patrol", 5], ["pursue", 20], ["patrol", 5], ["pursue", Infinity]];
  var SCORE = { cash: 10, jammer: 50, tag: 200, extraAt: 10000 };
  var ROCKET = { range: 2.4, speed: 13, cooldown: 0.35, hit: 0.55 };          // range: hits a car two burgers away
  var ABILITY = {
    sarge: { name: "Roadblock", every: 9, last: 5 },
    cutter: { name: "Nitro", every: 7, last: 1.6, boost: 1.6, sight: 8 },
    flanker: { name: "Spike strip", every: 8, last: 9, slow: 0.55, slowFor: 2.5 },
    rookie: { name: "Shield" },
  };

  function rng(seed) {
    var a = (Number(seed) >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function open(m, x, y) { return x >= 0 && y >= 0 && x < m.W && y < m.H && m.grid[y * m.W + x] === 1; }

  /** a city: a maze on the odd tiles, made on the left half and mirrored, no dead ends, a few extra loops, a 3 x 3 police
   *  station square in the middle, the getaway car's start below it, a jammer in each corner */
  function makeMaze(seed, W, H) {
    W = Math.max(11, (W | 0) | 1); H = Math.max(11, (H | 0) | 1);
    if (((W - 1) / 2) % 2 !== 0) W += 2;                    // the middle column must be between two node columns
    var R = rng(seed), g = new Uint8Array(W * H), mid = (W - 1) / 2;
    var set = function (x, y) { g[y * W + x] = 1; g[y * W + (W - 1 - x)] = 1; };   // always mirrored
    var at = function (x, y) { return g[y * W + x]; };
    // 1. a depth-first maze over the left half's nodes (odd x <= mid - 1, odd y)
    var seen = {}, stack = [[1, 1]];
    set(1, 1); seen["1,1"] = 1;
    while (stack.length) {
      var c = stack[stack.length - 1], nb = [];
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + DIRS[d][0] * 2, ny = c[1] + DIRS[d][1] * 2;
        if (nx >= 1 && nx <= mid - 1 && ny >= 1 && ny <= H - 2 && !seen[nx + "," + ny]) nb.push([nx, ny, d]);
      }
      if (!nb.length) { stack.pop(); continue; }
      var p = nb[Math.floor(R() * nb.length)];
      set(c[0] + DIRS[p[2]][0], c[1] + DIRS[p[2]][1]); set(p[0], p[1]);
      seen[p[0] + "," + p[1]] = 1; stack.push([p[0], p[1]]);
    }
    // 2. the two halves joined across the middle column - at least three crossings
    var rows = []; for (var y = 1; y <= H - 2; y += 2) rows.push(y);
    var cross = rows.filter(function () { return R() < 0.45; });
    [rows[0], rows[rows.length - 1], rows[Math.floor(rows.length / 2)]].forEach(function (r) { if (cross.indexOf(r) < 0) cross.push(r); });
    cross.forEach(function (r) { g[r * W + mid] = 1; });
    // 3. no dead ends (a chase needs a way round): each one opened towards another road
    var deg = function (x, y) { var n = 0; for (var d = 0; d < 4; d++) if (at(x + DIRS[d][0], y + DIRS[d][1])) n++; return n; };
    for (var yy = 1; yy <= H - 2; yy++) for (var xx = 1; xx <= mid; xx++) {
      if (!at(xx, yy) || deg(xx, yy) !== 1) continue;
      var walls = [];
      for (var d2 = 0; d2 < 4; d2++) {
        var wx = xx + DIRS[d2][0], wy = yy + DIRS[d2][1], bx = xx + DIRS[d2][0] * 2, by = yy + DIRS[d2][1] * 2;
        if (!at(wx, wy) && bx >= 1 && bx <= W - 2 && by >= 1 && by <= H - 2 && at(bx, by)) walls.push([wx, wy]);
      }
      if (walls.length) { var w = walls[Math.floor(R() * walls.length)]; if (w[0] === mid) g[w[1] * W + mid] = 1; else set(w[0], w[1]); }
    }
    // 4. a few more loops
    for (var y3 = 1; y3 <= H - 2; y3++) for (var x3 = 1; x3 < mid; x3++) {
      if (at(x3, y3) || (x3 % 2 === 0 && y3 % 2 === 0)) continue;             // even / even = the corner of a block, always
      var hz = x3 % 2 === 0 ? at(x3 - 1, y3) && at(x3 + 1, y3) : at(x3, y3 - 1) && at(x3, y3 + 1);
      if (hz && R() < 0.07) set(x3, y3);
    }
    // 5. the police station: a 3 x 3 square in the middle; the start: the road below it, two rows up from the bottom
    var cy = ((H - 1) / 2) | 0;
    var tiles = [];
    for (var sy = cy - 1; sy <= cy + 1; sy++) for (var sx = mid - 1; sx <= mid + 1; sx++) { g[sy * W + sx] = 1; tiles.push([sx, sy]); }
    var startY = H - 2; if (startY % 2 === 0) startY--;
    g[startY * W + mid] = 1;
    return { W: W, H: H, grid: g, station: { x: mid, y: cy, tiles: tiles }, start: [mid, startY],
             jammers: [[1, 1], [W - 2, 1], [1, startY], [W - 2, startY]],
             homes: [[W - 2, -2], [1, -2], [W - 2, H + 1], [1, H + 1]] };
  }
  /** how many road tiles can be reached from (x, y) (tests: the whole city is one piece) */
  function reach(m, x, y) {
    var seen = new Uint8Array(m.W * m.H), q = [[x, y]], n = 0;
    seen[y * m.W + x] = 1;
    while (q.length) {
      var c = q.shift(); n++;
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + DIRS[d][0], ny = c[1] + DIRS[d][1];
        if (open(m, nx, ny) && !seen[ny * m.W + nx]) { seen[ny * m.W + nx] = 1; q.push([nx, ny]); }
      }
    }
    return n;
  }

  /* ---- the game ---- */
  function speeds(level) {
    var l = Math.max(0, level - 1);
    return { player: Math.min(6.6, 5.2 + 0.15 * l), police: Math.min(6.4, 4.75 + 0.2 * l), jammed: 2.7, back: 10,
             jam: Math.max(2.5, 8 - 0.7 * l), release: Math.max(0.8, 3.5 - 0.4 * l) };
  }
  function newGame(seed, hi) {
    var s = { seed: (Number(seed) >>> 0) || 1, level: 1, score: 0, hi: Number(hi) || 0, lives: 3, extraGiven: false, events: [] };
    s.R = rng(s.seed * 7 + 3);
    newLevel(s);
    return s;
  }
  function newLevel(s) {
    var size = s.level >= 5 ? [29, 19] : s.level >= 3 ? [25, 19] : [21, 17];
    s.maze = makeMaze(s.seed + s.level * 7919, size[0], size[1]);
    var m = s.maze;
    s.items = new Uint8Array(m.W * m.H);
    var home = {}; m.station.tiles.forEach(function (t) { home[t[0] + "," + t[1]] = 1; });
    s.left = 0;
    for (var i = 0; i < m.W * m.H; i++) {
      var x = i % m.W, y = (i / m.W) | 0;
      if (m.grid[i] === 1 && !home[x + "," + y] && !(x === m.start[0] && y === m.start[1])) { s.items[i] = 1; s.left++; }
    }
    m.jammers.forEach(function (j) { var k = j[1] * m.W + j[0]; if (!s.items[k]) s.left++; s.items[k] = 2; });   // a jammer counts as a pick-up
    s.eaten = 0; s.bonus = null;
    resetCars(s);
  }
  function resetCars(s) {
    var m = s.maze, sp = speeds(s.level), st = m.station;
    s.player = { x: m.start[0], y: m.start[1], dir: 1, moving: false, want: -1, face: 1, started: false };
    var spots = [[st.x, st.y - 1], [st.x - 1, st.y], [st.x + 1, st.y], [st.x, st.y + 1]];
    s.police = POLICE.map(function (p, i) {
      return { kind: p.kind, name: p.name, color: p.color, x: spots[i][0], y: spots[i][1], dir: i % 2 ? 3 : 1, mode: "wait",
               releaseAt: i * sp.release, home: m.homes[i], cd: abilityEvery(p.kind, s.level) * (0.5 + 0.2 * i), boost: 0,
               shield: p.kind === "rookie", last: null };
    });
    s.t = 0; s.modeIdx = 0; s.modeT = MODES[0][1]; s.mode = MODES[0][0]; s.jamT = 0; s.chain = 0;
    s.rockets = []; s.blocks = []; s.spikes = []; s.fx = []; s.fireCd = 0; s.slowT = 0;
    s.phase = "ready"; s.phaseT = 2;
  }
  var dist2 = function (ax, ay, bx, by) { return (ax - bx) * (ax - bx) + (ay - by) * (ay - by); };

  /** where police car i is heading now */
  function targetOf(s, i) {
    var c = s.police[i], p = s.player, m = s.maze;
    if (c.mode === "back" || c.mode === "wait") return [m.station.x, m.station.y];
    if (s.mode === "patrol") return c.home;
    var px = Math.round(p.x), py = Math.round(p.y), d = DIRS[p.face];
    if (c.kind === "cutter") return [px + d[0] * 4, py + d[1] * 4];
    if (c.kind === "flanker") return [px - d[1] * 3, py + d[0] * 3];
    return [px, py];                                       // sarge, rookie
  }
  function options(m, x, y, rev) {
    var o = [];
    for (var d = 0; d < 4; d++) if (d !== rev && open(m, x + DIRS[d][0], y + DIRS[d][1])) o.push(d);
    return o.length ? o : (rev >= 0 && open(m, x + DIRS[rev][0], y + DIRS[rev][1]) ? [rev] : []);
  }
  function choosePolice(s, i, x, y) {
    var c = s.police[i], rev = c.dir >= 0 ? (c.dir + 2) % 4 : -1, o = options(s.maze, x, y, rev);
    if (!o.length) return -1;
    if (c.mode === "jammed" || (c.kind === "rookie" && c.mode === "run" && s.R() < 0.35)) return o[Math.floor(s.R() * o.length)];
    var t = targetOf(s, i), best = o[0], bd = Infinity;
    o.forEach(function (d) { var v = dist2(x + DIRS[d][0], y + DIRS[d][1], t[0], t[1]); if (v < bd - EPS) { bd = v; best = d; } });
    return best;
  }
  function blockedAt(s, x, y) { for (var i = 0; i < (s.blocks || []).length; i++) if (s.blocks[i].x === x && s.blocks[i].y === y) return true; return false; }
  function openFor(s, x, y) { return open(s.maze, x, y) && !blockedAt(s, x, y); }      // the getaway car: roadblocks too
  function abilityEvery(kind, level) { var a = ABILITY[kind]; return a && a.every ? Math.max(a.every * 0.55, a.every - 0.5 * (level - 1)) : 0; }
  function choosePlayer(s, x, y) {
    var p = s.player;
    if (p.want >= 0 && openFor(s, x + DIRS[p.want][0], y + DIRS[p.want][1])) return p.want;
    // once driving, the car keeps going the way it goes (a turn asked for too early waits for its road)
    if ((p.moving || p.started) && openFor(s, x + DIRS[p.dir][0], y + DIRS[p.dir][1])) return p.dir;
    return -1;
  }
  /** the getaway car's rocket: straight ahead from the car, while the launcher lasts */
  function fire(s, out) {
    var p = s.player;
    if (s.jamT <= 0 || s.fireCd > 0) return false;
    s.fireCd = ROCKET.cooldown;
    s.rockets.push({ x: p.x, y: p.y, dir: p.face, flown: 0 });
    ev(s, out, "fire");
    return true;
  }
  function boom(s, out, x, y) { s.fx.push({ kind: "boom", x: x, y: y, t: 0 }); ev(s, out, "boom"); }
  function tagCar(s, out, c) { s.chain++; c.mode = "back"; c.boost = 0; addScore(s, out, SCORE.tag * Math.pow(2, Math.min(3, s.chain - 1))); ev(s, out, "tag"); }
  /** is there a straight, open road from the police car to the getaway car, no further than n tiles? */
  function inSight(s, c, n) {
    var p = s.player, cx = Math.round(c.x), cy = Math.round(c.y), px = Math.round(p.x), py = Math.round(p.y);
    if (cx !== px && cy !== py) return -1;
    var d = cx === px ? (py > cy ? 2 : 0) : (px > cx ? 3 : 1), len = Math.abs(px - cx) + Math.abs(py - cy);
    if (len > n || len === 0) return -1;
    for (var k = 1; k < len; k++) if (!open(s.maze, cx + DIRS[d][0] * k, cy + DIRS[d][1] * k)) return -1;
    return d;
  }
  /** each police car's own trick, at its tile centres while it is out chasing (not jammed, not going back) */
  function ability(s, out, c, x, y) {
    if (c.mode !== "run") { c.last = [x, y]; return; }
    var A = ABILITY[c.kind], p = s.player, prev = c.last; c.last = [x, y];
    if (!A || c.cd > 0) return;
    var st = s.maze.station, inStation = Math.abs(x - st.x) <= 1 && Math.abs(y - st.y) <= 1;
    if (c.kind === "sarge" || c.kind === "flanker") {
      // dropped on the tile just left - never on the station square, never under or just in front of the getaway car
      if (!prev || inStation || (prev[0] === s.maze.start[0] && prev[1] === s.maze.start[1])) return;
      if (dist2(prev[0], prev[1], p.x, p.y) < 1.6 * 1.6 || blockedAt(s, prev[0], prev[1])) return;
      if (c.kind === "sarge") { s.blocks.push({ x: prev[0], y: prev[1], t: A.last }); ev(s, out, "block"); }
      else { s.spikes.push({ x: prev[0], y: prev[1], t: A.last }); ev(s, out, "spikes"); }
      c.cd = abilityEvery(c.kind, s.level);
    } else if (c.kind === "cutter") {
      if (inSight(s, c, A.sight) >= 0) { c.boost = A.last; c.cd = abilityEvery(c.kind, s.level); ev(s, out, "nitro"); }
    }
  }
  /** drive e `dist` tiles; choose(x, y) at each tile centre -> a direction or -1 (stop) */
  function drive(e, dist, choose, arrive) {
    var guard = 0;
    while (dist > EPS && guard++ < 50) {
      var cx = Math.round(e.x), cy = Math.round(e.y);
      if (Math.abs(e.x - cx) < EPS && Math.abs(e.y - cy) < EPS) {
        e.x = cx; e.y = cy;
        if (arrive) arrive(cx, cy);
        var d = choose(cx, cy);
        if (d < 0) { e.moving = false; return; }
        e.dir = d; e.moving = true;
        var st = Math.min(dist, 1);
        e.x += DIRS[d][0] * st; e.y += DIRS[d][1] * st; dist -= st;
      } else {
        var D = DIRS[e.dir], tx = D[0] > 0 ? Math.ceil(e.x - EPS) : D[0] < 0 ? Math.floor(e.x + EPS) : e.x,
            ty = D[1] > 0 ? Math.ceil(e.y - EPS) : D[1] < 0 ? Math.floor(e.y + EPS) : e.y;
        var rem = Math.abs(tx - e.x) + Math.abs(ty - e.y), st2 = Math.min(dist, rem);
        e.x += D[0] * st2; e.y += D[1] * st2; dist -= st2;
        if (Math.abs(rem - st2) < EPS) { e.x = Math.round(e.x); e.y = Math.round(e.y); }
      }
    }
  }
  function ev(s, out, name) { out.push(name); }
  function addScore(s, out, n) {
    s.score += n;
    if (!s.extraGiven && s.score >= SCORE.extraAt) { s.extraGiven = true; s.lives++; ev(s, out, "extra"); }
    if (s.score > s.hi) s.hi = s.score;
  }

  /** one moment of the game. input = {dir: 0..3 | -1}; returns what happened (for the sounds) */
  function step(s, dt, input) {
    var out = [];
    dt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    if (input && input.dir >= 0 && input.dir < 4) {
      var pl = s.player; pl.want = input.dir;
      // the first key: the car sets off that way, or - its road closed - the first open way round from it
      if (!pl.started) { pl.started = true; for (var q = 0; q < 4; q++) { var dd = (input.dir + q) % 4; if (open(s.maze, Math.round(pl.x) + DIRS[dd][0], Math.round(pl.y) + DIRS[dd][1])) { pl.dir = dd; break; } } }
    }
    if (s.phase === "over") return out;
    if (s.phase !== "play") {
      s.phaseT -= dt;
      if (s.phaseT > 0) return out;
      if (s.phase === "ready") { s.phase = "play"; ev(s, out, "go"); }
      else if (s.phase === "busted") {
        if (s.lives <= 0) { s.phase = "over"; ev(s, out, "over"); }
        else { resetCars(s); s.phaseT = 1.5; }
      } else if (s.phase === "clear") { s.level++; newLevel(s); }
      return out;
    }
    var n = Math.max(1, Math.ceil(dt / (1 / 120)));
    if (input && input.fire) fire(s, out);
    for (var k = 0; k < n && s.phase === "play"; k++) tick(s, dt / n, out);
    return out;
  }
  function tick(s, dt, out) {
    var sp = speeds(s.level), p = s.player, m = s.maze;
    s.t += dt;
    // the clock: patrol / pursue (stopped while jammed)
    if (s.jamT > 0) {
      s.jamT -= dt;
      if (s.jamT <= 0) { s.jamT = 0; s.police.forEach(function (c) { if (c.mode === "jammed") c.mode = "run"; }); }
    } else {
      s.modeT -= dt;
      if (s.modeT <= 0 && s.modeIdx < MODES.length - 1) {
        s.modeIdx++; s.mode = MODES[s.modeIdx][0]; s.modeT = MODES[s.modeIdx][1];
        s.police.forEach(function (c) { if (c.mode === "run") c.dir = (c.dir + 2) % 4; });
        ev(s, out, "mode");
      }
    }
    // timers: the rocket's reload, the spikes' slow-down, roadblocks and spike strips, explosions, abilities
    s.fireCd = Math.max(0, s.fireCd - dt); s.slowT = Math.max(0, s.slowT - dt);
    s.blocks = s.blocks.filter(function (b) { b.t -= dt; return b.t > 0; });
    s.spikes = s.spikes.filter(function (b) { b.t -= dt; return b.t > 0; });
    s.fx = s.fx.filter(function (f) { f.t += dt; return f.t < 0.7; });
    s.police.forEach(function (c) { if (c.cd > 0) c.cd -= dt; if (c.boost > 0) c.boost = Math.max(0, c.boost - dt); });
    // the getaway car: a U-turn at once, anywhere
    if (p.want >= 0 && p.moving && p.want === (p.dir + 2) % 4) { p.dir = p.want; }
    drive(p, sp.player * (s.slowT > 0 ? ABILITY.flanker.slow : 1) * dt, function (x, y) { return choosePlayer(s, x, y); });
    if (p.moving) p.face = p.dir;
    // a spike strip under the car: slowed for a moment (the strip is used up)
    for (var si = 0; si < s.spikes.length; si++) {
      if (dist2(p.x, p.y, s.spikes[si].x, s.spikes[si].y) < 0.4 * 0.4) { s.spikes.splice(si, 1); s.slowT = ABILITY.flanker.slowFor; ev(s, out, "slow"); break; }
    }
    // rockets: straight on, a block or the range stops them; a police car hit = back to the station (Rookie's shield stops one)
    s.rockets = s.rockets.filter(function (r) {
      var D = DIRS[r.dir], stepD = Math.min(ROCKET.speed * dt, ROCKET.range - r.flown);
      r.x += D[0] * stepD; r.y += D[1] * stepD; r.flown += stepD;
      for (var ci = 0; ci < s.police.length; ci++) {
        var c = s.police[ci];
        if (c.mode === "wait" || c.mode === "back") continue;
        if (dist2(r.x, r.y, c.x, c.y) < ROCKET.hit * ROCKET.hit) {
          if (c.shield) { c.shield = false; s.fx.push({ kind: "shield", x: c.x, y: c.y, t: 0 }); ev(s, out, "shield"); }
          else tagCar(s, out, c);
          boom(s, out, r.x, r.y); return false;
        }
      }
      var ax = Math.round(r.x + D[0] * 0.45), ay = Math.round(r.y + D[1] * 0.45);
      if (!open(m, ax, ay)) { boom(s, out, r.x, r.y); return false; }
      for (var bi = 0; bi < s.blocks.length; bi++) {
        var b = s.blocks[bi];
        if (dist2(r.x, r.y, b.x, b.y) < 0.5 * 0.5) { s.blocks.splice(bi, 1); boom(s, out, b.x, b.y); return false; }
      }
      if (r.flown >= ROCKET.range - 1e-9) { boom(s, out, r.x, r.y); return false; }
      return true;
    });
    // burgers, rocket launchers, the cake
    var tx = Math.round(p.x), ty = Math.round(p.y), ti = ty * m.W + tx;
    if (Math.abs(p.x - tx) + Math.abs(p.y - ty) < 0.45 && s.items[ti]) {
      var it = s.items[ti]; s.items[ti] = 0; s.left--; s.eaten++;
      if (it === 1) { addScore(s, out, SCORE.cash); ev(s, out, "cash"); }
      else {
        addScore(s, out, SCORE.jammer); ev(s, out, "jammer");
        s.jamT = sp.jam; s.chain = 0;
        s.police.forEach(function (c) { if (c.mode === "run" || c.mode === "jammed") { if (c.mode === "run") c.dir = (c.dir + 2) % 4; c.mode = "jammed"; } });
      }
      if (s.eaten === 70 || s.eaten === 170) { s.bonus = { x: m.start[0], y: m.start[1], t: 9, value: Math.min(2000, 100 * s.level + 100) }; ev(s, out, "bonusup"); }
      if (s.left <= 0) { s.phase = "clear"; s.phaseT = 2.2; ev(s, out, "clear"); return; }
    }
    if (s.bonus) {
      s.bonus.t -= dt;
      if (dist2(p.x, p.y, s.bonus.x, s.bonus.y) < 0.25) { addScore(s, out, s.bonus.value); ev(s, out, "bonus"); s.bonus = null; }
      else if (s.bonus.t <= 0) s.bonus = null;
    }
    // the police
    s.police.forEach(function (c, i) {
      if (c.mode === "wait") { if (s.t >= c.releaseAt) { c.mode = s.jamT > 0 ? "jammed" : "run"; } else return; }
      var v = c.mode === "back" ? sp.back : c.mode === "jammed" ? sp.jammed : sp.police * (c.boost > 0 ? ABILITY.cutter.boost : 1);
      drive(c, v * dt, function (x, y) { return choosePolice(s, i, x, y); }, function (x, y) {
        if (c.mode === "back" && x === m.station.x && y === m.station.y) {
          c.mode = s.jamT > 0 ? "jammed" : "run"; if (c.kind === "rookie") c.shield = true; ev(s, out, "back");
        }
        ability(s, out, c, x, y);
      });
    });
    // caught - or, while jammed, a police car bumped back to the station
    for (var i = 0; i < s.police.length; i++) {
      var c = s.police[i];
      if (c.mode === "wait" || c.mode === "back") continue;
      if (dist2(p.x, p.y, c.x, c.y) < 0.6 * 0.6) {
        if (c.mode === "jammed") tagCar(s, out, c);
        else { s.lives--; s.phase = "busted"; s.phaseT = 1.8; ev(s, out, "busted"); return; }
      }
    }
  }

  var API = { DIRS: DIRS, NAMES: NAMES, POLICE: POLICE, MODES: MODES, SCORE: SCORE, rng: rng, open: open, makeMaze: makeMaze,
              reach: reach, speeds: speeds, newGame: newGame, newLevel: newLevel, step: step, targetOf: targetOf, drive: drive,
              ROCKET: ROCKET, ABILITY: ABILITY, fire: fire, inSight: inSight, openFor: openFor };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.H3ChaseCore = API;
})(typeof window !== "undefined" ? window : this);
