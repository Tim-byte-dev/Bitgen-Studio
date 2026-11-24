#!/usr/bin/env node
/* bitGen Studio — 2.935.0 units: 🚓 POLICE CHASE - the rules (ext/chasedock/chasecore.js), the high scores
 * (ext/chasedock/chaseserver.js) and how the docker is put together (dock.html, chasedock.js, the top bar, ⛶).
 * Tim: "lets make it with cars, call it police chase". */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require("../ext/chasedock/chasecore.js");

// --- the cities
let bad = [];
for (const [w, h] of [[21, 17], [25, 19], [29, 19]]) for (let seed = 1; seed <= 120; seed++) {
  const m = C.makeMaze(seed, w, h);
  let roads = 0, dead = 0, asym = 0, border = 0;
  for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
    if (C.open(m, x, y) !== C.open(m, m.W - 1 - x, y)) asym++;
    if (!C.open(m, x, y)) continue;
    roads++;
    if (x === 0 || y === 0 || x === m.W - 1 || y === m.H - 1) border++;
    if (C.DIRS.filter((d) => C.open(m, x + d[0], y + d[1])).length < 2) dead++;
  }
  const one = C.reach(m, m.start[0], m.start[1]) === roads;
  if (!one || dead || asym || border) bad.push({ w, h, seed, one, dead, asym, border });
}
check("360 cities (21x17, 25x19, 29x19): one piece, no dead ends, mirrored, closed at the edge", !bad.length, bad.slice(0, 3));
const m0 = C.makeMaze(7, 21, 17);
check("the police station: a 3 x 3 square of road in the middle; the start below it; a jammer in each corner (on a road)",
  m0.station.tiles.length === 9 && m0.station.tiles.every((t) => C.open(m0, t[0], t[1])) && m0.station.x === 10 && m0.station.y === 8
  && m0.start[0] === 10 && m0.start[1] === 15 && C.open(m0, 10, 15) && m0.jammers.every((j) => C.open(m0, j[0], j[1])), m0.station);
check("the same seed = the same city, another seed = another", Buffer.from(C.makeMaze(7, 21, 17).grid).equals(Buffer.from(m0.grid)) && !Buffer.from(C.makeMaze(8, 21, 17).grid).equals(Buffer.from(m0.grid)));

// --- a game
const s = C.newGame(4242, 0), m = s.maze;
let cash = 0, jam = 0; for (let i = 0; i < s.items.length; i++) { if (s.items[i] === 1) cash++; if (s.items[i] === 2) jam++; }
check("a new game: level 1, 3 cars, a bag of cash on every road but the station and the start, 4 jammers, left = all of them",
  s.level === 1 && s.lives === 3 && s.score === 0 && jam === 4 && s.left === cash + jam && !s.items[m.start[1] * m.W + m.start[0]]
  && m.station.tiles.every((t) => !s.items[t[1] * m.W + t[0]]), { cash, jam, left: s.left });
const run = (st, secs, dir) => { let ev = []; const n = Math.round(secs * 60); for (let i = 0; i < n; i++) ev = ev.concat(C.step(st, 1 / 60, { dir: i === 0 && dir != null ? dir : -1 })); return ev; };
let ev = run(s, 1.9);
check("READY for two seconds - the police wait, nothing moves", s.phase === "ready" && s.player.x === m.start[0] && s.police.every((c) => c.mode === "wait"));
ev = run(s, 0.2);
check("...then GO", s.phase === "play" && ev.includes("go"), ev);
const x0 = s.player.x;
ev = run(s, 0.3);
check("no key yet: the getaway car waits at the start", s.player.x === x0 && !s.player.moving);
ev = run(s, 1, 1);
check("← : it drives left at its speed and picks up the cash on the way (+10 a bag)", s.player.x < x0 - 4 && s.score >= 40 && ev.filter((e) => e === "cash").length === s.score / 10, { x: s.player.x, score: s.score });
const xa = s.player.x;
run(s, 0.2, 3);
check("a U-turn happens at once, between two tiles", s.player.dir === 3 && s.player.x > xa);
// a key for a road that is closed now waits for it; a closed road ahead stops the car
const s2 = C.newGame(4242, 0); run(s2, 2.1);
run(s2, 0.05, 0);                      // ↑ at the start: closed there (a block above) - the car sets off the first open way round
check("the first key on a closed road: the car still sets off (the first open way round), the turn kept for later",
  s2.player.started && s2.player.moving && s2.player.want === 0, s2.player);

// --- the police
check("four police cars: Sarge, Cutter, Flanker, Rookie - out of the station one after another",
  s.police.map((c) => c.name).join() === "Sarge,Cutter,Flanker,Rookie" && s.police[0].releaseAt === 0 && s.police[1].releaseAt > 0 && s.police[3].releaseAt > s.police[2].releaseAt);
const t = C.newGame(1, 0); run(t, 2.1);
t.police.forEach((c) => { c.mode = "run"; }); t.mode = "pursue"; t.player.x = 5; t.player.y = 9; t.player.face = 3;
check("pursuing: Sarge heads for you, Cutter for 4 tiles ahead of you, Flanker for 3 to your side",
  C.targetOf(t, 0).join() === "5,9" && C.targetOf(t, 1).join() === "9,9" && C.targetOf(t, 2).join() === "5,12", [C.targetOf(t, 0), C.targetOf(t, 1), C.targetOf(t, 2)]);
t.mode = "patrol";
check("patrolling: each to its own corner", C.targetOf(t, 0).join() === t.maze.homes[0].join() && C.targetOf(t, 3).join() === t.maze.homes[3].join());
t.police[0].mode = "back";
check("bumped while jammed: back to the station", C.targetOf(t, 0).join() === t.maze.station.x + "," + t.maze.station.y);
const mo = C.newGame(3, 0); run(mo, 2.1); mo.player.started = false;
ev = run(mo, 7.2);
check("the clock: 7 s of patrol, then the police pursue (and turn round)", mo.mode === "pursue" && ev.includes("mode"), mo.mode);

// --- the jammer, a bump, a bust
const j = C.newGame(9, 0); run(j, 2.1); run(j, 2);                   // the police out
const jk = j.maze.jammers[0];
j.player.x = jk[0]; j.player.y = jk[1] + 1; j.player.started = true; j.player.dir = 0; j.player.moving = true;
j.police.forEach((c) => { if (c.mode === "wait") c.mode = "run"; c.x = j.maze.station.x; c.y = j.maze.station.y; });
const before = j.score;
ev = run(j, 0.3);
check("📡 a jammer: +50, the police jammed (grey, slow) for the level's time", ev.includes("jammer") && j.score - before >= 50 && j.jamT > 0 && j.police.every((c) => c.mode === "jammed"), { ev, jamT: j.jamT, modes: j.police.map((c) => c.mode) });
const pc = j.police[0]; pc.x = Math.round(j.player.x); pc.y = Math.round(j.player.y);
const sc1 = j.score; ev = run(j, 0.02);
check("...bump one: it is sent back to the station (+200), the next +400", ev.includes("tag") && pc.mode === "back" && j.score - sc1 >= 200 && j.chain === 1, { ev, mode: pc.mode });
const pc2 = j.police[1]; pc2.x = j.player.x; pc2.y = j.player.y; const sc2 = j.score; run(j, 0.02);
check("...the second +400", pc2.mode === "back" && j.score - sc2 >= 400);
run(j, 12);
check("...the jam wears off; the bumped cars reach the station and come out again", j.jamT === 0 && j.police.every((c) => c.mode !== "jammed" && c.mode !== "back") , j.police.map((c) => c.mode));
const b = C.newGame(11, 0); run(b, 2.1); run(b, 3);
const cop = b.police.find((c) => c.mode === "run"); cop.x = b.player.x; cop.y = b.player.y;
ev = run(b, 0.02);
check("caught: BUSTED, a car less", ev.includes("busted") && b.phase === "busted" && b.lives === 2, { ev, lives: b.lives });
run(b, 2.4);   // 2.942.0: the crash burns 2.2 s
check("...back to the start, the police in the station, READY again (the cash stays picked up)", b.phase === "ready" && b.player.x === b.maze.start[0] && b.police.every((c) => c.mode === "wait"));
b.lives = 1; run(b, 2.1); const cop2 = b.police[0]; cop2.mode = "run"; cop2.x = b.player.x; cop2.y = b.player.y; run(b, 0.02); ev = run(b, 2.4);
check("the last car caught: GAME OVER", b.phase === "over" && ev.includes("over") && b.lives === 0);
// a city cleared
const c = C.newGame(5, 0); run(c, 2.1); const g1 = Buffer.from(c.maze.grid);
for (let i = 0; i < c.items.length; i++) if (c.items[i]) { c.items[i] = 0; c.left--; }
c.items[c.maze.start[1] * c.maze.W + c.maze.start[0] - 1] = 1; c.left = 1;
ev = run(c, 0.5, 1);
check("the last bag: CITY CLEARED", ev.includes("clear") && c.phase === "clear", ev);
run(c, 2.5);
check("...level 2: a new city, the cash back, READY", c.level === 2 && c.phase === "ready" && c.left > 100 && !Buffer.from(c.maze.grid).equals(g1));
check("faster police and a shorter jam as the levels go up; bigger cities from level 3", C.speeds(4).police > C.speeds(1).police && C.speeds(4).jam < C.speeds(1).jam
  && (() => { const x = C.newGame(1, 0); x.level = 3; C.newLevel(x); return x.maze.W === 25; })());
const e = C.newGame(6, 0); run(e, 2.1); e.score = 9995; e.items[e.maze.start[1] * e.maze.W + e.maze.start[0] - 1] = 1; e.left++;
ev = run(e, 0.3, 1);
check("an extra car at 10,000 points (once)", ev.includes("extra") && e.lives === 4 && e.hi >= 10005, { ev, lives: e.lives });
// a bot plays: the game can be won and lost
const bot = (st) => {
  const p = st.player, mz = st.maze, px = Math.round(p.x), py = Math.round(p.y); let best = -1, bv = -1e9;
  C.DIRS.forEach(([dx, dy], d) => {
    if (!C.open(mz, px + dx, py + dy)) return;
    const seen = new Set([px + "," + py, (px + dx) + "," + (py + dy)]); const q = [[px + dx, py + dy, 1]]; let found = 99;
    while (q.length) { const [x, y, n] = q.shift(); if (st.items[y * mz.W + x]) { found = n; break; } if (n > 40) break;
      for (const [ex, ey] of C.DIRS) { const nx = x + ex, ny = y + ey; if (C.open(mz, nx, ny) && !seen.has(nx + "," + ny)) { seen.add(nx + "," + ny); q.push([nx, ny, n + 1]); } } }
    let danger = 0; st.police.forEach((c) => { if (c.mode === "run") { const dd = Math.hypot(c.x - px - dx, c.y - py - dy); if (dd < 3) danger += (3 - dd) * 20; } });
    const v = -found - danger; if (v > bv) { bv = v; best = d; }
  });
  return best;
};
let levels = 0, overs = 0;
for (let g = 0; g < 12; g++) { const st = C.newGame(g + 100, 0); let tt = 0; while (st.phase !== "over" && tt < 400) { C.step(st, 1 / 30, { dir: bot(st) }); tt += 1 / 30; } levels += st.level - 1; if (st.phase === "over") overs++; }
check("a simple bot (12 games): clears cities and still gets caught - the game can be won and lost", levels >= 3 && overs >= 6, { levels, overs });

// --- the high scores
const S = require("../ext/chasedock/chaseserver.js");
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "t935-")), "police_chase.json");
S.setFile(f);
let r = S.add([], { name: "  Tim <b>  ", score: 1234.9, level: 3 });
check("a score: the name cleaned (16 letters, no <>), whole points, rank 1", r.rank === 1 && r.scores[0].name === "Tim b" && r.scores[0].score === 1234 && r.scores[0].level === 3, r);
let list = [];
for (let i = 1; i <= 12; i++) list = S.add(list, { name: "D" + i, score: i * 100 }).scores;
check("the best ten, highest first", list.length === 10 && list[0].score === 1200 && list[9].score === 300);
check("...a score below the ten: rank 0", S.add(list, { name: "x", score: 50 }).rank === 0 && S.add(list, { name: "y", score: 5000 }).rank === 1);
let threw = null; try { S.clean({ score: "lots" }); } catch (err) { threw = err; }
check("not a score -> refused (400)", threw && threw.status === 400);
const routes = {};
S.mount({ get: (p, h) => { routes["GET " + p] = h; }, post: (p, mw, h) => { routes["POST " + p] = h; } });
const call = (k, body) => new Promise((ok) => { routes[k]({ body }, { json: (j) => ok({ status: 200, j }), status: (n) => ({ json: (j) => ok({ status: n, j }) }) }); });
(async () => {
  const p1 = await call("POST /api/police-chase/scores", { name: "Lili", score: 777, level: 2 });
  const g1 = await call("GET /api/police-chase/scores");
  const p2 = await call("POST /api/police-chase/scores", { name: "Bad", score: -5 });
  check("GET / POST /api/police-chase/scores: kept in police_chase.json, read back; a bad score = 400",
    p1.j.rank === 1 && g1.j.scores[0].name === "Lili" && JSON.parse(fs.readFileSync(f, "utf8")).scores.length === 1 && p2.status === 400, { p1, g1, p2 });
  S.setFile(null);

  // --- the docker
  const EJ = JSON.parse(src("ext/chasedock/ext.json")), DH = src("ext/chasedock/dock.html"), JS = src("ext/chasedock/chasedock.js");
  check("ext/chasedock: ext.json (Police Chase, chasecore.js then chasedock.js, its own server part chaseserver.js)",
    EJ.id === "chasedock" && EJ.name === "Police Chase" && EJ.scripts.join() === "chasecore.js,chasetheme.js,chasedock.js" /* 2.939.0: + the settings */ && EJ.server === "chaseserver.js");
  check("dock.html: 🚓 Police Chase, ▶ New game, ⏸ Pause, 🎥, 🔇, 🏆, While rendering, the stage (focusable), the HUD, the name box",
    /▾ 🚓 Police Chase/.test(DH) && ["pcNew", "pcPause", "pcCam", "pcSound", "pcHi", "pcRender", "pcStage", "pcScore", "pcBest", "pcLives", "pcJam", "pcMsg", "pcScores"].every((id) => DH.includes('id="' + id + '"'))
    && /id="pcStage" tabindex="0"/.test(DH) && /data-own-space="1"/.test(DH));
  check("chasedock.js: three.js loaded on first open; the keys only while the game has the focus and never passed on to the app",
    /\/static\/vendor\/three-m3d\.min\.js/.test(JS) && /st\.addEventListener\("keydown", onKey\)/.test(JS) && /e\.preventDefault\(\); e\.stopPropagation\(\);/.test(JS) && !/document\.addEventListener\("keydown"|doc\.addEventListener\("keydown"/.test(JS));
  check("...kind to work: paused when hidden / folded / in the background / out of focus; nothing drawn while paused; a render running = lighter or paused",
    /classList\.contains\("dockgone"\)/.test(JS) && /classList\.contains\("collapsed"\)/.test(JS) && /visibilitychange/.test(JS) && /the game lost the focus/.test(JS)
    && /root\.liveJobsById/.test(JS) && /G\.render === "pause"/.test(JS) && /now - G\.last < 32/.test(JS) && /one frame is enough - the loop stops/.test(JS));
  check("...hidden the first time; sound off to start with; the scores from /api/police-chase/scores; no window.prompt",
    /localStorage\.getItem\("h3\.g\.chasedock"\) == null\) root\.localStorage\.setItem\("h3\.g\.chasedock", "1"\)/.test(JS) && /LS\.get\("sound", "0"\) === "1"/.test(JS)
    && /\/api\/police-chase\/scores/.test(JS) && !/window\.prompt|root\.prompt\(/.test(JS));
  check("the top bar: 🚓 after 📐 SolidCraft and 📏 Sketcher; ⛶ = Artist-mode full screen (2.942.0 - no longer static/dockmax.js)",
    /\["tX_chasedock", "🚓", "Police Chase"\]/.test(src("static/appstrip.js")) && !/"chasedock"\]/.test(src("static/dockmax.js")) && /function setFull\(on\)/.test(src("ext/chasedock/chasedock.js")));
  check("police_chase.json is this PC's: .gitignore + make_zips.sh", /^police_chase\.json$/m.test(src(".gitignore")) && /! -name "police_chase\.json"/.test(src("scripts/make_zips.sh")));
  check("server.js untouched", !/police|chase/i.test(src("misc/server.js")));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
