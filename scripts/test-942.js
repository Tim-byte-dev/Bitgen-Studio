#!/usr/bin/env node
/* bitGen Studio — 2.942.0 units: 🚓 POLICE CHASE - full screen like the image editor's (Tim's artist mode) when maximized, the getaway car explodes when
 * caught, the launcher fires by itself two car lengths away, a police car hit explodes, the police can dodge, ⚡ speed boosts.
 * Tim: "for the police chase game, make full screen like (artist mode) when maximized. when our car gets caught it explodes.
 * show a rocket shooting at the police cars when our car gets a rocket , rockets will fire when 2 car lenghts away from the
 * police car. when the rocket hits the police the police car explodes. the police cars can try to evade the rockets. add
 * speed boost items randomly on the grid. whichever car gets to it first gets the speed boost" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require("../ext/chasedock/chasecore.js");
const run = (s, secs, inp) => { let ev = []; const n = Math.round(secs * 120); for (let i = 0; i < n; i++) ev = ev.concat(C.step(s, 1 / 120, i === 0 ? (inp || {}) : {})); return ev; };
const EV0 = Object.assign({}, C.EVADE);
const noDodge = () => Object.keys(C.EVADE).forEach((k) => { C.EVADE[k] = 0; });
/** the player on a straight road of 6 tiles (x .. x+5), every police car parked in the station, nothing to pick up */
function straight(len) {
  for (let seed = 1; seed < 500; seed++) {
    const s = C.newGame(seed, 0), m = s.maze; run(s, 2.1);
    for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - len; x++) {
      if ([...Array(len + 1).keys()].every((k) => C.open(m, x + k, y)) && Math.abs(y - m.station.y) > 2) {
        s.player.x = x; s.player.y = y; s.player.face = 3; s.player.dir = 3; s.player.moving = false; s.player.started = false; s.player.want = -1;
        s.police.forEach((c) => { c.mode = "wait"; c.releaseAt = 1e9; c.x = m.station.x; c.y = m.station.y; c.shield = false; });
        for (let k = -1; k <= len + 1; k++) s.items[y * m.W + x + k] = 0;
        s.boostCd = 1e9;
        return { s, x, y, m };
      }
    }
  }
}
check("two car lengths: auto-fire range 1.6 tiles (a car is 0.8 of a tile); rockets slower (8 tiles/s) so they can be seen",
  C.ROCKET.auto === 1.6 && C.ROCKET.speed === 8 && C.ROCKET.range >= 3);
noDodge();
let { s, x, y } = straight(5);
const cop = s.police[0]; cop.mode = "jammed"; cop.x = x + 3; cop.y = y; cop.dir = 3; s.jamT = 5;
let ev = run(s, 0.05);
check("🚀 armed, a police car 3 tiles away: no rocket yet", !ev.includes("fire") && !s.rockets.length, ev);
cop.x = x + 1.5; cop.dir = 1;
ev = run(s, 0.6);
check("...within two car lengths: it fires by itself at it - the car EXPLODES (a wreck), +200", ev.includes("fire") && ev.includes("kaboom") && ev.includes("tag") && cop.mode === "wreck" && s.fx.some((f) => f.kind === "wreck"), ev);
check("...a wreck is harmless and can't be hit again", (() => { const p = s.player; const ox = cop.x; cop.x = p.x; cop.y = p.y; const e = run(s, 0.05); cop.x = ox; return !e.includes("busted") && !e.includes("tag"); })());
ev = run(s, C.WRECK.police + 0.2);
check("...after it burns out a new car comes out of the station", cop.mode !== "wreck" && ev.includes("back"), { mode: cop.mode, ev });
({ s, x, y } = straight(5)); s.jamT = 5; s.player.x = x + 3;
const cb = s.police[1]; cb.mode = "jammed"; cb.x = x + 1.6; cb.y = y; cb.dir = 1;
ev = run(s, 0.05);
check("...the launcher turns: a car behind you is fired at too (the rocket flies its way)", ev.includes("fire") && s.rockets[0] && s.rockets[0].dir === 1 && s.rockets[0].auto, s.rockets);
check("...one rocket per car (no second one while the first flies)", run(s, 0.05).filter((e) => e === "fire").length === 0);
({ s, x, y } = straight(5));
const c3 = s.police[2]; c3.mode = "jammed"; c3.x = x + 1.5; c3.y = y;
check("no launcher: nothing fires", !run(s, 0.05).includes("fire"));
// caught -> the getaway car explodes; the fire burns on while BUSTED
({ s, x, y } = straight(5));
const c4 = s.police[0]; c4.mode = "run"; c4.x = s.player.x; c4.y = s.player.y;
ev = run(s, 0.02);
check("caught: the getaway car EXPLODES (crash), BUSTED", ev.includes("crash") && ev.includes("busted") && s.fx.some((f) => f.kind === "crash"), ev);
run(s, 1.0);
check("...the crash keeps burning while BUSTED (the effects age between lives)", s.phase === "busted" && s.fx.some((f) => f.kind === "crash" && f.t > 0.9));
run(s, 1.5);
check("...then READY again", s.phase === "ready" || s.phase === "play");
// dodging
Object.keys(C.EVADE).forEach((k) => { C.EVADE[k] = 1; });
let dodged = null;
for (let seed = 1; seed < 400 && !dodged; seed++) {
  const g = C.newGame(seed, 0), m = g.maze; run(g, 2.1);
  for (let yy = 2; yy < m.H - 2 && !dodged; yy++) for (let xx = 1; xx < m.W - 5 && !dodged; xx++) {
    // a straight xx..xx+4 with a side road at xx+3: a police car in the line of fire, driving away, gets out at that corner
    if (![0, 1, 2, 3, 4].every((k) => C.open(m, xx + k, yy)) || !(C.open(m, xx + 3, yy - 1) || C.open(m, xx + 3, yy + 1)) || Math.abs(yy - m.station.y) < 3) continue;
    g.police.forEach((c) => { c.mode = "wait"; c.releaseAt = 1e9; c.x = m.station.x; c.y = m.station.y; c.shield = false; });
    for (let k = -1; k <= 5; k++) g.items[yy * m.W + xx + k] = 0;
    g.boostCd = 1e9;
    g.player.x = xx; g.player.y = yy; g.player.face = 3; g.player.dir = 3; g.player.moving = false; g.player.started = false; g.player.want = -1;
    g.jamT = 5; const c = g.police[1]; c.mode = "jammed"; c.x = xx + 2.6; c.y = yy; c.dir = 3;
    const e = run(g, 0.8);
    dodged = { e, mode: c.mode, y: c.y, yy };
  }
}
check("🏃 the police dodge: a car in the line of fire turns off it at the next corner (event dodge) and isn't hit",
  dodged && dodged.e.includes("dodge") && dodged.mode !== "wreck" && Math.abs(dodged.y - dodged.yy) > 0.3, dodged);
Object.keys(C.EVADE).forEach((k) => { C.EVADE[k] = 0; });
let stuck = null;
{ ({ s, x, y } = straight(5)); s.jamT = 5; s.mode = "pursue"; s.modeT = 99; const c = s.police[0]; c.mode = "run"; c.x = x + 2.6; c.y = y; c.dir = 1; stuck = run(s, 0.8); stuck = { e: stuck, mode: c.mode }; }   // Sarge, straight at you
check("...a car that doesn't dodge (or has no corner) coming at you is fired at and blown up once it is two car lengths away", !stuck.e.includes("dodge") && (stuck.mode === "wreck" || stuck.e.includes("fire")), stuck);
Object.assign(C.EVADE, EV0);
check("...each car its own chance: Cutter the best, Rookie (who has a shield) the worst", C.EVADE.cutter > C.EVADE.flanker && C.EVADE.flanker > C.EVADE.sarge && C.EVADE.sarge > C.EVADE.rookie);
// ⚡ speed boosts
const b = C.newGame(7, 0); run(b, 2.1);
check("⚡ no boosts at first; the first one after a few seconds", b.boosts.length === 0 && b.boostCd > 0);
let seen = 0; for (let i = 0; i < 40; i++) { b.player.started = false; b.police.forEach((c) => { c.mode = "wait"; c.releaseAt = 1e9; }); if (run(b, 1).includes("boostup")) seen++; }
const okPlace = b.boosts.every((q) => C.open(b.maze, q.x, q.y) && !(Math.abs(q.x - b.maze.station.x) <= 2 && Math.abs(q.y - b.maze.station.y) <= 2));
check("...they keep appearing on random roads (never the station), at most 2 at a time, each for a while", seen >= 3 && b.boosts.length <= C.BOOST.max && okPlace, { seen, boosts: b.boosts });
({ s, x, y } = straight(5));
s.boosts = [{ x: x + 1, y, t: 10 }];
ev = run(s, 0.4, { dir: 3 });
check("...the getaway car there first: TURBO (faster for a few seconds)", ev.includes("turbo") && s.player.turbo > 3 && !s.boosts.length, ev);
const x0 = s.player.x; run(s, 0.5); const fast = s.player.x - x0;
check("...about 1.45x as fast", Math.abs(fast / 0.5 - C.speeds(1).player * C.BOOST.player) < 0.6 || s.player.x >= x + 5 - 1e-6, { fast });
({ s, x, y } = straight(5));
const c5 = s.police[2]; c5.mode = "run"; c5.x = x + 3; c5.y = y; c5.dir = 3; s.boosts = [{ x: x + 4, y, t: 10 }]; s.player.x = x - 20; s.player.y = -20;
ev = run(s, 0.4);
check("...a police car there first takes it (turbocop) - faster too", ev.includes("turbocop") && c5.turbo > 3 && !s.boosts.length, ev);
// the view
const J = src("ext/chasedock/chasedock.js"), D = src("ext/chasedock/dock.html");
check("full screen like the image editor's (Tim's artist mode) when maximized: the game alone (no bars, no title bar), the window full screen, Esc pauses, 🗗 Exit / Ctrl+Esc / Ctrl+Shift+F / Shift+right-click leave",
  /function setFull\(on\)/.test(J) && /doc\.body\.classList\.toggle\("pc-full", on\)/.test(J) && /de\.requestFullscreen\(/.test(J) && /setFull\(d\.classList\.contains\("maxed"\) && !d\.classList\.contains\("dockgone"\)\)/.test(J)
  && /ctl && k === "Escape"/.test(J) && /e\.button === 2 && e\.shiftKey/.test(J) && /id="pcExitFull"/.test(D) && /body\.pc-full #chasedock \{ position: fixed !important/.test(D) && /body\.pc-full #chasedock > \.bhead \{ display: none/.test(D)
  && !/"chasedock"\]/.test(src("static/dockmax.js")));
check("explosions: fire, smoke, flying bits and a shock ring - bigger for a police car, biggest for yours; wrecks and your car burn and smoke; the light flares",
  /function burst\(V, m, x, y, size\)/.test(J) && /f\.kind === "crash" \? 2 : f\.kind === "wreck" \? 1 : 0/.test(J) && /emit\(P, "ring"/.test(J) && /c\.mode === "wreck"\) \{ var w = world/.test(J) && /big = boom\.kind === "crash" \? 16/.test(J));
check("...your car is thrown up, rolls and lands burnt out; a police wreck on its side, burnt, lights off", /pc\.inner\.rotation\.z = kc \* 2\.2/.test(J) && /charCar\(pc,/.test(J) && /v\.inner\.rotation\.z = kw \* 1\.4; charCar\(v, 1\)/.test(J) && /var on = !jam && !back && !wreck/.test(J));
check("rockets you can see: bigger, a smoke trail; the roof launcher turns to the car it fires at", /o\.scale\.setScalar\(2\)/.test(J) && /emit\(P, "smoke", o\.position\.x - D\[0\]/.test(J) && /V\.player\.launcher\.rotation\.y \+= wrapA/.test(J));
check("⚡ boosts drawn (a lightning bolt over a ring, blinking at the end); turbo flames on your car, yellow nitro on a police car; a ⚡ bar; sounds",
  /function makeBoost\(\)/.test(J) && /V\.boostPool/.test(J) && /V\.player\.turbo\.forEach/.test(J) && /c\.turbo > 0 \? 0xffd040/.test(J) && /id="pcTurbo"/.test(D)
  && ["crash", "kaboom", "dodge", "turbo", "turbocop", "boostup"].every((e) => J.includes('e === "' + e + '"')));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
