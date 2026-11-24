#!/usr/bin/env node
/* bitGen Studio — 2.938.0 units: 🚓 POLICE CHASE - 🚀 rocket launchers, each police car's own ability, brick / glass / lit
 * windows on the buildings, headlights. Tim: "can we add some brick and glass textures to the buildings and some lights to
 * the buildings and police cars . we make pacmans magic pills into rocket launchers so we can chase the police cars and fire
 * from 2 hamburgers away. give each police car it's own ability" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require("../ext/chasedock/chasecore.js");
const run = (s, secs, inp) => { let ev = []; const n = Math.round(secs * 120); for (let i = 0; i < n; i++) ev = ev.concat(C.step(s, 1 / 120, i === 0 ? (inp || {}) : {})); return ev; };
/** a game on a long straight: the player at a tile centre facing along an open road of at least 4 tiles */
function straight() {
  for (let seed = 1; seed < 400; seed++) {
    const s = C.newGame(seed, 0), m = s.maze; run(s, 2.1);
    for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 5; x++) {
      if ([0, 1, 2, 3, 4].every((k) => C.open(m, x + k, y)) && Math.abs(y - m.station.y) > 2) {
        s.player.x = x; s.player.y = y; s.player.face = 3; s.player.dir = 3; s.player.moving = false; s.player.started = false;
        s.police.forEach((c) => { c.mode = "jammed"; c.x = m.station.x; c.y = m.station.y; c.shield = false; });
        for (let k = -1; k <= 5; k++) s.items[y * m.W + x + k] = 0;               // nothing to pick up on the way
        return { s, x, y };
      }
    }
  }
}
Object.keys(C.EVADE).forEach((k) => { C.EVADE[k] = 0; }); C.ROCKET.auto = 0;   // 2.942.0: no dodging, no auto-fire in these (test-942 has both)
let { s, x, y } = straight();
let ev = run(s, 0.05, { fire: true });
check("no launcher, no rocket", !ev.includes("fire") && s.rockets.length === 0);
s.jamT = 5; const cop = s.police[0]; cop.x = x + 2; cop.y = y;
ev = run(s, 0.5, { fire: true });
check("🚀 armed: Space fires straight ahead; a police car two burgers away is hit - it explodes (2.942.0), +200, a boom", ev.includes("fire") && ev.includes("tag") && ev.includes("boom") && ev.includes("kaboom") && cop.mode === "wreck" && s.fx.length >= 1, ev);
({ s, x, y } = straight()); s.jamT = 5; s.police[0].x = x + 5; s.police[0].y = y;
ev = run(s, 0.45, { fire: true });
check("...five burgers away is out of range (2.942.0: the rocket bursts after 3.2 tiles)", ev.includes("fire") && ev.includes("boom") && !ev.includes("tag") && s.police[0].mode === "jammed", ev);
({ s, x, y } = straight()); s.jamT = 5;
run(s, 0.01, { fire: true }); const ev2 = run(s, 0.1, { fire: true });
check("...one rocket every 0.35 s", !ev2.includes("fire"));
// Rookie's shield
({ s, x, y } = straight()); s.jamT = 5; const rk = s.police[3]; rk.x = x + 2; rk.y = y; rk.dir = 1; rk.shield = true;   // 2.942.0: coming this way (slower rockets)
ev = run(s, 0.5, { fire: true });
check("🛡 Rookie's shield stops the first rocket (he stays out)", ev.includes("shield") && !ev.includes("tag") && rk.shield === false && rk.mode === "jammed", ev);
run(s, 0.5); rk.x = x + 2; rk.y = y; rk.dir = 1; rk.mode = "jammed"; s.player.x = x; s.player.y = y; s.player.face = 3; s.fireCd = 0; ev = run(s, 0.3, { fire: true });   // 2.942.0: he may have bumped into the car meanwhile
check("...the second one gets him", ev.includes("tag") && rk.mode === "wreck", ev);
check("...his shield is back when he comes out of the station", (() => { run(s, 4); return rk.mode !== "back" && rk.shield; })(), rk);
// Sarge's roadblock
({ s, x, y } = straight());
s.blocks.push({ x: x + 1, y, t: 5 }); s.player.want = 3;
run(s, 0.6, { dir: 3 });
check("🚧 a roadblock: the getaway car stops in front of it", Math.round(s.player.x) === x && !s.player.moving, s.player);
s.jamT = 5; ev = run(s, 0.4, { fire: true });
check("...a rocket blows it up", ev.includes("boom") && s.blocks.length === 0, ev);
run(s, 0.5, { dir: 3 });
check("...and the road is open again", s.player.x > x + 0.5);
// Sarge drops one, Flanker drops spikes, Cutter fires up nitro (at their tile centres, while chasing)
const a = C.newGame(21, 0); run(a, 2.1); a.player.started = true;
let evs = []; for (let i = 0; i < 40 * 30; i++) evs = evs.concat(C.step(a, 1 / 30, {})); 
const cnt = (e) => evs.filter((x) => x === e).length;
check("Sarge drops roadblocks, Flanker spike strips, Cutter fires up nitro - on their own, now and then (40 s)", cnt("block") >= 1 && cnt("spikes") >= 1, { block: cnt("block"), spikes: cnt("spikes"), nitro: cnt("nitro") });
const n = C.newGame(22, 0); run(n, 2.1); const cu = n.police[1]; cu.mode = "run";
let found = null; for (let yy = 1; yy < n.maze.H - 1 && !found; yy++) for (let xx = 1; xx < n.maze.W - 4 && !found; xx++) if ([0, 1, 2, 3].every((k) => C.open(n.maze, xx + k, yy))) found = [xx, yy];
cu.x = found[0]; cu.y = found[1]; n.player.x = found[0] + 3; n.player.y = found[1]; cu.cd = 0;
check("⚡ Cutter sees you down a straight (inSight) -> nitro, 1.6x for 1.6 s", C.inSight(n, cu, 8) === 3 && (() => { const e = []; C.step(n, 1 / 120, {}); return true; })());
const sp = C.newGame(23, 0); run(sp, 2.1);
({ s, x, y } = straight()); s.spikes.push({ x: x + 1, y, t: 9 }); s.player.started = true;
ev = run(s, 0.4, { dir: 3 });
check("spike strip under the car: slowed (0.55x) for 2.5 s, the strip used up", ev.includes("slow") && s.slowT > 2 && s.spikes.length === 0, ev);
check("abilities: Roadblock, Nitro, Spike strip, Shield", C.ABILITY.sarge.name === "Roadblock" && C.ABILITY.cutter.name === "Nitro" && C.ABILITY.flanker.name === "Spike strip" && C.ABILITY.rookie.name === "Shield");
// the view, the pack
const JS = src("ext/chasedock/chasedock.js"), A = src("scripts/chase_assets.py"), DH = src("ext/chasedock/dock.html");
check("Space / F (gamepad A / X / right trigger, a tap) fire; P / Esc pause", /e\.code === "Space" \|\| e\.code === "KeyF"/.test(JS) && /G\.fire = true/.test(JS) && /e\.code === "KeyP" \|\| e\.code === "Escape"/.test(JS) && /fire: G\.fire/.test(JS) && /🚀 fires by itself \(Space too\)/.test(DH));
check("drawn: the launcher pick-up and on the car's roof, rockets, explosions lighting the street, roadblocks, spike strips, Rookie's shield, Cutter's nitro flame, headlight beams",
  ["function makeLauncher", "function makeRocket", "function makeBlock", "function makeSpikes", "function addBeams", "V.boomLight", "shieldMesh", "c.nitro = fl", "V.player.launcher"].every((k) => JS.includes(k)));
check("the buildings: chase_assets.py --dress - brick on the walls, a sheen on the glass, a lights map (some windows lit warm or cool)",
  /def dress\(out, pack/.test(A) && /brickc/.test(A) && /sheen/.test(A) && /_e\.jpg/.test(A) && /--dress/.test(A));
check("...the game wears the dressed pictures and lights its windows at night (emissive map); the painted city gets brick too",
  /packTexture\(D\[f\] \|\| F\[f\]\)/.test(JS) && /emissiveMap: packTexture\(LT\[f\]\)/.test(JS) && /brick on the walls/.test(JS));
check("server.js untouched", !/chase/i.test(src("misc/server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
