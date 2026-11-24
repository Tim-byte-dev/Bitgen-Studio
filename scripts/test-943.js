#!/usr/bin/env node
/* bitGen Studio — 2.943.0 units: 🚓 POLICE CHASE SOUND - ext/chasedock/chasesound.js: our own chase music from a step sequencer
 * (faster and fuller as the police close in, a power variation with the 🚀 launcher, muffled while paused), the engine, tyre
 * squeals, layered explosions, the ⚙ mixer's kept settings; chasedock.js wired to it (stop rules, the mixer).
 * Tim: "before we start, are u able to add sound and sfx to police chase?" -> "please add your suggestions. i am too lazy
 * right now to create my own" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const S = require("../ext/chasedock/chasesound.js");
const CORE = src("ext/chasedock/chasecore.js"), J = src("ext/chasedock/chasedock.js"), D = src("ext/chasedock/dock.html"), SJ = src("ext/chasedock/chasesound.js");

// every event the rules make has a sound (back / go / mode are silent bookkeeping)
const evs = [...new Set([...CORE.matchAll(/ev\(s, out, "([a-z]+)"\)/g)].map((m) => m[1]))].filter((e) => !["back", "go", "mode"].includes(e)).sort();
const missing = evs.filter((e) => !S.NAMES.includes(e));
check("every game event has a sound (" + evs.length + " events)", evs.length >= 20 && missing.length === 0, missing);
check("...the pre-2.943 sounds all kept", ["siren"].length && ["cash", "fire", "boom", "crash", "kaboom", "dodge", "turbo", "turbocop", "boostup", "busted", "clear", "extra", "bonus", "start", "over", "block", "nitro", "spikes", "slow", "shield", "jammer", "tag"].every((n) => S.NAMES.includes(n)));
check("...each recipe is layers of [wave, from, to, s, gain, delay] / [noise, s, gain] or a layered blast", Object.keys(S.SFX).every((k) => {
  const r = S.SFX[k]; if (r === "blast") return !!S.BLAST[k];
  return Array.isArray(r) && r.length && r.every((L) => L[0] === "noise" ? L[1] > 0 && L[2] > 0 : ["sine", "square", "sawtooth", "triangle"].includes(L[0]) && L[1] >= 20 && L[2] >= 20 && L[3] > 0 && L[4] > 0 && L[4] <= 0.3);
}));

// the music
const stepsOf = (o) => { const all = []; for (let b = 0; b < S.BARS; b++) for (let st = 0; st < S.STEPS; st++) all.push(S.stepNotes(b, st, o)); return all; };
const far = stepsOf({ intensity: 0 }), close = stepsOf({ intensity: 1 }), power = stepsOf({ intensity: 0, power: true });
const count = (all, v) => all.reduce((n, x) => n + x.filter((q) => q.v === v).length, 0);
check("the loop: 8 bars of 16 sixteenths; the lead is 8 bars of 16 (an original call and answer)", S.STEPS === 16 && S.BARS === 8 && S.LEAD.length === 8 && S.LEAD.every((b) => b.length === 16) && S.BASS.length === 16);
check("far from the police: bass + drums only (no lead)", count(far, "lead") === 0 && count(far, "bass") > 40 && count(far, "kick") >= 24 && count(far, "snare") >= 16, { lead: count(far, "lead") });
check("close: the lead comes in, more kicks and hats, a fill at the end of the loop", count(close, "lead") > 40 && count(close, "kick") > count(far, "kick") && count(close, "hat") > count(far, "hat") && count(close, "snare") > count(far, "snare"));
check("the 🚀 power variation: four on the floor, an arpeggio on every step, pumping octave bass, no lead",
  count(power, "kick") === 32 && count(power, "arp") === 128 && count(power, "lead") === 0 && S.stepNotes(0, 1, { power: true }).find((q) => q.v === "bass").n - S.stepNotes(0, 0, { power: true }).find((q) => q.v === "bass").n === 12);
const notes = [].concat(...close, ...power).filter((q) => q.n != null).map((q) => q.n);
check("...every note in range (bass A1..A3, the tunes under C7) and lasts 1-4 steps", notes.every((n) => n >= 40 && n <= 96) && [].concat(...close).every((q) => q.len == null || (q.len >= 1 && q.len <= 4)));
check("...the lead stays in A natural minor (the white notes only)", S.LEAD.flat().filter((n) => n != null).every((n) => [9, 11, 0, 2, 4, 5, 7].includes(n % 12)));
check("tempo: 126 far, faster as they close in, 166 on your tail; power never under 150",
  S.bpmFor(0) === 126 && S.bpmFor(0.5) === 146 && S.bpmFor(1) === 166 && S.bpmFor(0, true) === 150 && S.bpmFor(1, true) === 166);
check("intensity: none chasing = 0, 12 tiles = 0, 2 tiles = 1, between rises", S.intensityFor(Infinity) === 0 && S.intensityFor(12) === 0 && S.intensityFor(2) === 1 && S.intensityFor(1) === 1 && S.intensityFor(7) === 0.5);
const mp = S.musicMix({ paused: true, intensity: 1 }), mo = S.musicMix({ intensity: 0 }), mc = S.musicMix({ intensity: 1 });
check("paused: quieter and muffled; brighter the closer they are; ducked while busted",
  mp.gain < 0.5 && mp.cut <= 800 && mo.gain === 1 && mc.cut > mo.cut && S.musicMix({ busted: true }).gain < 0.5 && S.musicMix({ power: true }).cut >= 12000, { mp, mo, mc });
check("midiHz: A4 = 440, A3 = 220", S.midiHz(69) === 440 && Math.abs(S.midiHz(57) - 220) < 1e-9);

// the engine
const en = (o) => S.engineNote(Object.assign({ play: true, moving: true, base: 5.2, speed: 5.2 }, o));
check("engine: off when not playing (busted, paused, title)", S.engineNote({ play: false, moving: true, speed: 5 }).on === false && S.engineNote({}).on === false);
check("...idles when stopped (low, quiet)", en({ moving: false }).f === 42 && en({ moving: false }).g < en({}).g);
check("...pitch follows the speed: spikes lower, ⚡ turbo higher and a roar (louder, open filter)",
  en({ speed: 2.86, slowed: true }).f < en({}).f && en({ speed: 7.54, turbo: true }).f > en({}).f && en({ speed: 7.54, turbo: true }).g > en({}).g && en({ speed: 7.54, turbo: true }).cut === 2400 && en({ speed: 2.86, slowed: true }).cut < en({}).cut);
check("...rises steadily with the speed", [1, 2, 3, 4, 5, 6, 7, 8].map((v) => en({ speed: v }).f).every((f, i, a) => i === 0 || f >= a[i - 1]));

// squeals
check("tyre squeal: a corner at speed 0.7, a U-turn 1; none going straight, standing, slowed by spikes or with no direction yet",
  S.turned(0, 1, true, 1) === 0.7 && S.turned(0, 3, true, 1) === 0.7 && S.turned(1, 3, true, 1) === 1 && S.turned(2, 2, true, 1) === 0 && S.turned(0, 1, false, 1) === 0 && S.turned(0, 1, true, 0.55) === 0 && S.turned(-1, 1, true, 1) === 0);

// explosions
const B = S.BLAST;
check("explosions layered: a sub boom, a crack, a body, a fire tail, debris clinks - crash the biggest, kaboom big, boom small",
  ["crash", "kaboom", "boom"].every((k) => B[k].sub.length === 4 && B[k].crack.length === 2 && B[k].fire.length === 2 && B[k].debris > 0)
  && B.crash.sub[3] > B.kaboom.sub[3] && B.kaboom.sub[3] > B.boom.sub[3] && B.crash.sub[2] > B.kaboom.sub[2] && B.kaboom.sub[2] > B.boom.sub[2]
  && B.crash.fire[0] > B.kaboom.fire[0] && B.kaboom.fire[0] > B.boom.fire[0] && B.crash.debris > B.kaboom.debris && B.kaboom.debris > B.boom.debris
  && B.crash.sub[1] < 40 && B.crash.sub[0] < 120);
let k = 0; const seq = () => [0, 0.999, 0.5, 0.25, 0.75, 0.1][k++ % 6];
const dt = S.debrisTimes(6, seq);
check("...debris 0.4-0.9 s after, in order", dt.length === 6 && dt.every((t) => t >= 0.4 && t <= 0.9) && dt.every((t, i) => i === 0 || t >= dt[i - 1]), dt);
check("...panned to where it happened on the screen, never hard left / right", S.panOf(-1) === -0.7 && S.panOf(1) === 0.7 && S.panOf(0) === 0 && S.panOf(0.5) === 0.35 && S.panOf(3) === 0.7 && S.panOf(NaN) === 0);

// the mixer
const store = (o) => (key, d) => (key in o ? o[key] : d);
check("mixer: defaults music 60, effects 80, start = never set (the last M decides)", JSON.stringify(S.prefs(store({}))) === JSON.stringify({ music: 60, sfx: 80, start: null }));
check("...kept values read back; junk falls back; clamped 0-100", JSON.stringify(S.prefs(store({ music: "35", sfx: "100", startsound: "1" }))) === JSON.stringify({ music: 35, sfx: 100, start: true })
  && JSON.stringify(S.prefs(store({ music: "loud", sfx: "250", startsound: "0" }))) === JSON.stringify({ music: 60, sfx: 100, start: false }) && S.clampVol(-5, 50) === 0 && S.clampVol("", 50) === 50);
check("...a slider -> a gain: 0 = silent, rising, effects' default 80 as loud as before (about 1)", S.gainOf(0) === 0 && Math.abs(S.gainOf(80) - 1.024) < 1e-9 && [0, 10, 30, 50, 70, 90, 100].map(S.gainOf).every((g, i, a) => i === 0 || g > a[i - 1]));

// the wiring
check("ext.json loads chasesound.js after the rules and settings, before the docker", JSON.parse(src("ext/chasedock/ext.json")).scripts.join() === "chasecore.js,chasetheme.js,chasesound.js,chasedock.js");
check("chasedock.js no longer makes sounds itself (one AudioContext, in chasesound.js)", !/function tone\(|function noise\(|new AC\(\)|AudioContext/.test(J) && (SJ.match(/new AC\(\)/g) || []).length === 1);
check("...plays every event through H3ChaseSound with a pan; squeals after each step; soundTick each frame and 4x a second",
  /AU\.play\(e, \{ pan: panFor\(e\) \}\)/.test(J) && /evs\.forEach\(onEvent\); squealCheck\(pd\); soundTick\(\);/.test(J) && /setInterval\(function \(\) \{ soundTick\(\);/.test(J));
check("...stop rules: hidden / folded / background -> rest; title + GAME OVER -> stop; a pause other than P / Esc -> rest; a deliberate pause keeps quiet music 45 s",
  /if \(!shown\(\)\) \{ AU\.rest\(\); return; \}/.test(J) && /if \(!live \|\| s\.phase === "over"\) \{ AU\.stopAll\(\); return; \}/.test(J)
  && /var deliberate = G\.paused && G\.why === "paused" && Date\.now\(\) - \(G\.pausedAt \|\| 0\) < PAUSE_MUSIC/.test(J) && /if \(G\.paused && !deliberate\) \{ AU\.rest\(\); return; \}/.test(J) && /PAUSE_MUSIC = 45000/.test(J));
check("...the engine runs only while playing; the siren only while playing; nothing made while the sound is off",
  /engine: \{ play: play,/.test(J) && /siren: play \}/.test(J) && /if \(!AU \|\| !G\.sound\) return;/.test(J) && /if \(!on\) return null;/.test(SJ) && /made on first use/.test(SJ));
check("...M stays the master switch (AU.on); start-with-sound-on beats the last M when set",
  /if \(AU\) AU\.on\(G\.sound\);/.test(J) && /sound: PR\.start == null \? LS\.get\("sound", "0"\) === "1" : PR\.start/.test(J));
check("⚙ mixer in the bar: music + effects sliders, start with sound on, kept as h3.chase.music / sfx / startsound",
  /id="pcMix"/.test(D) && /id="pcVolMusic" min="0" max="100"/.test(D) && /id="pcVolSfx" min="0" max="100"/.test(D) && /id="pcStartSound"/.test(D)
  && /LS\.set\(which, PR\[which\]\)/.test(J) && /LS\.set\("startsound", PR\.start \? "1" : "0"\)/.test(J));
check("...opening it pauses (a deliberate pause: the music plays on, muffled); its keys never steer the car; Esc closes it",
  /if \(G\.s && !G\.demo && !G\.paused && G\.s\.phase !== "over"\) pause\("paused"\); \}/.test(J) && /if \(mixOpen && e\.key === "Escape"\) \{ mixer\(false\)/.test(J) && /e\.target\.closest\("#pcMixBox"\)\) return;/.test(J) && /pause\(inMix \? "paused" : "the game lost the focus"\)/.test(J));
check("H3Chase.audio() / mixer() / mix() for the tests", /audio: function \(\) \{ return AU \? AU\.info\(\) : null; \}/.test(J) && /mixer: mixer, mix: function/.test(J));
check("the tunes are our own and no sound files are shipped (nothing to license)", !fs.readdirSync(path.join(ROOT, "ext/chasedock")).some((f) => /\.(mp3|wav|ogg|flac|m4a)$/i.test(f)) && /our own/.test(SJ));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
