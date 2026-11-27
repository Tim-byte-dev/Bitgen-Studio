#!/usr/bin/env node
// bitGen Studio 2.992.0 - 🥁 Drumify in the 🎹 Edit Booth's step sequencer: a rhythm you tap / play / already have -> a drum
// pattern with the feel it was played with. Tim: "our own Magenta" - local only, no cloud. Browser: test-ui992-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const G = require("../ext/synthdock/synthgroove.js");
const K = require("../ext/synthdock/synthkit.js");
const T = require("../ext/synthdock/synthtlcore.js");
const J = (x) => JSON.stringify(x);
const on = (r) => r.hits.map((h, i) => (h ? i : -1)).filter((i) => i >= 0).join();
const row = (r, k) => r.rows.filter((x) => x.kind === k)[0];

// ---- reading a sound: our own kit, one sound at a time (100 ms of silence first)
const sr = 48000, one = (id, at) => { const x = K.make(id, sr), b = new Float32Array(sr); b.set(x.subarray(0, sr - Math.round(at * sr)), Math.round(at * sr)); return G.onsets([b], sr); };
const want = { kick: "low", boom: "low", tom: "low", snare: "mid", clap: "mid", rim: "mid", cowbell: "mid", chat: "high", ohat: "high", shaker: "high" };
const got = {}; Object.keys(want).forEach((id) => { got[id] = one(id, 0.1); });
check("each kit sound = ONE hit (the 808's long low tone too)", Object.keys(got).every((id) => got[id].length === 1), got);
check("…in its band: kick / 808 / tom = low, snare / clap / rim / cowbell = mid, hats / shaker = high", Object.keys(want).every((id) => J(got[id][0].bands) === J([want[id]])), got);
check("…at its time (within 4 ms)", Object.keys(got).every((id) => Math.abs(got[id][0].t - 0.1) <= 0.004), Object.keys(got).map((id) => got[id][0].t));
const mixOf = (list, n) => { const L = n * sr, m = new Float32Array(L); list.forEach(([t, id, g]) => { const x = K.make(id, sr), o = Math.round(t * sr); for (let i = 0; i < x.length && o + i < L; i++) m[o + i] += x[i] * g; }); return m; };
const beat = G.onsets([mixOf([[0, "kick", 0.8], [0.25, "chat", 0.5], [0.5, "snare", 0.8], [0.75, "chat", 0.5], [1, "kick", 0.8], [1, "chat", 0.5], [1.125, "chat", 0.5], [1.25, "kick", 0.8], [1.5, "snare", 0.8], [1.75, "chat", 0.5]], 2)], sr);
check("a beat: 9 hits, the first at 0 s, a kick still ringing never makes the hat after it a kick, kick + hat together = both",
  beat.length === 9 && beat[0].t < 0.003 && J(beat.map((h) => h.bands.join("+"))) === J(["low", "high", "mid", "high", "low+high", "high", "low", "mid", "high"]), beat);
check("…how loud: the quieter hats below the kicks / snares", beat[1].v < beat[0].v && beat[3].v < beat[2].v, beat.map((h) => h.v));
const st = mixOf([[0, "kick", 0.8], [0.5, "snare", 0.8]], 1), stereo = G.onsets([st, st.map((v) => v * 0.5)], sr);
check("stereo is mixed down; silence = no hits; nothing = no hits", stereo.length === 2 && G.onsets([new Float32Array(sr)], sr).length === 0 && G.onsets([], sr).length === 0 && G.onsets(null, sr).length === 0);
check("bandsOf (the classifier): a kick + its own mid bleed = kick only; kick + a lot of high = kick + hat; kick + a snare = kick + snare",
  J(G.bandsOf([1, 0.16, 0.02])) === J(["low"]) && J(G.bandsOf([1, 0.17, 0.4])) === J(["low", "high"]) && J(G.bandsOf([1, 0.3, 0.6])) === J(["low", "mid"]));

// ---- hits -> a pattern
const taps = [0, 1, 1.55, 2, 3].map((b) => ({ b, v: 0.75 }));
const r1 = G.drumify(taps, { div: 4, bars: 1, seed: 1 });
check("taps (all as hard): 1 and 3 = kick, 2 and 4 = snare, the 'and' of 2 = a pushed kick", on(row(r1, "kick")) === "0,6,8" && on(row(r1, "snare")) === "4,12", r1.rows.map(on));
check("…how late you played it kept (0.55 of a beat = 2.2 steps: step 2 + 0.2), the rest on the grid", Math.abs(row(r1, "kick").off[6] - 0.2) < 1e-9 && row(r1, "kick").off[0] === 0, row(r1, "kick").off);
check("…hats added (none played) and they lean late on the 'and's like you did", r1.info.added.indexOf("hats") >= 0 && row(r1, "hat").hits.filter(Boolean).length >= 7 && Math.abs(r1.info.feel[2] - 0.2) < 1e-9 && row(r1, "hat").off.filter((o, i) => i % 4 === 2 && row(r1, "hat").hits[i]).every((o) => o > 0.15), { feel: r1.info.feel, off: row(r1, "hat").off });
check("the same seed = the same pattern; the result has 4 rows (kick, snare, hats, open hat) with the kit's sounds",
  J(G.drumify(taps, { div: 4, bars: 1, seed: 1 })) === J(r1) && r1.rows.map((r) => r.kind + ":" + r.src).join() === "kick:kit:kick,snare:kit:snare,hat:kit:chat,open:kit:ohat");
const seeds = new Set(); for (let s = 1; s <= 12; s++) seeds.add(J(G.drumify(taps, { div: 4, bars: 1, seed: s }).rows.map((r) => r.hits)));
check("🎲 other seeds = other takes", seeds.size > 2, seeds.size);
const dyn = G.drumify([{ b: 0, v: 1 }, { b: 0.75, v: 1 }, { b: 1.5, v: 0.4 }, { b: 2, v: 0.6 }], { div: 4, bars: 1, seed: 3, hats: false });
check("played with dynamics: a loud off-beat = kick (the 'a' of 1), a soft one is not", row(dyn, "kick").hits[3] > 0 && !row(dyn, "kick").hits[6], dyn.rows.map(on));
const loudsoft = G.drumify([{ b: 0, v: 1 }, { b: 1, v: 0.5 }], { div: 4, bars: 1, hats: false, backbeat: false, kick: false });
check("how hard each was played = its strength (vel); 0.85 and up = an accent", row(loudsoft, "kick").vel[0] === 1 && row(loudsoft, "kick").hits[0] === 2 && row(loudsoft, "snare").vel[4] === 0.5 && row(loudsoft, "snare").hits[4] === 1, loudsoft.rows);
const bands = G.drumify([{ b: 0, v: 1, bands: ["low"] }, { b: 0.5, v: 0.6, bands: ["high"] }, { b: 1, v: 0.9, bands: ["mid"] }, { b: 1.5, v: 0.9, bands: ["low", "high"] }], { div: 4, bars: 1, hats: false, backbeat: false, kick: false });
check("a sound's bands decide: low = kick, mid = snare, high = hats, both = both", on(row(bands, "kick")) === "0,6" && on(row(bands, "snare")) === "4" && on(row(bands, "hat")) === "2,6", bands.rows.map(on));
const notes = G.drumify([{ b: 0, v: 0.9, m: 36 }, { b: 0.5, v: 0.9, m: 72 }, { b: 0.75, v: 0.9, m: 36 }, { b: 1.25, v: 0.9, m: 74 }], { div: 4, bars: 1, hats: false, backbeat: false });
check("a note clip: low notes off the beat = kick, high ones = hats", row(notes, "kick").hits[3] > 0 && row(notes, "hat").hits[2] > 0 && row(notes, "hat").hits[5] > 0, notes.rows.map(on));
const keep = G.drumify(taps, { div: 4, bars: 1, keep: "hat", hats: false, backbeat: false, kick: false });
check("Your hits = all hats: every hit a hat, nothing added", on(row(keep, "hat")) === "0,4,6,8,12" && !row(keep, "kick").hits.some(Boolean) && !row(keep, "snare").hits.some(Boolean) && !keep.info.added.length, keep.rows.map(on));
const bare = G.drumify([{ b: 1.5, v: 0.8 }], { div: 4, bars: 2 });
check("＋ kick on 1 (each bar) and ＋ backbeat (2 and 4) when there is none; 2 bars = 32 steps", bare.n === 32 && on(row(bare, "kick")).split(",").indexOf("16") >= 0 && row(bare, "kick").hits[0] > 0 && on(row(bare, "snare")).indexOf("4,12,20,28") === 0 && bare.info.added.indexOf("backbeat") >= 0 && bare.info.added.indexOf("kick on 1") >= 0, bare.rows.map(on));
const gh = G.drumify(taps, { div: 4, bars: 4, seed: 5, ghost: 1 }), g0 = G.drumify(taps, { div: 4, bars: 4, seed: 5, ghost: 0 });
check("Ghost notes: soft snares (about 30%) next to the backbeats; 0 = none", row(gh, "snare").vel.filter((v) => v > 0 && v < 0.4).length > 0 && row(g0, "snare").vel.filter((v) => v > 0 && v < 0.4).length === 0, { gh: row(gh, "snare").vel, g0: row(g0, "snare").vel });
const fold = G.drumify([{ b: 0, v: 0.5 }, { b: 4, v: 1 }, { b: 4.1, v: 0.9 }], { div: 4, bars: 1, hats: false, backbeat: false, kick: false });
check("a longer take folds onto the pattern: the same step again = the loudest, its timing the average (0, 0, +0.4 -> 0.133)", fold.n === 16 && row(fold, "kick").vel[0] === 1 && Math.abs(row(fold, "kick").off[0] - 0.133) < 1e-9, row(fold, "kick"));
check("the pattern is never over 64 steps (32nds: 2 bars at most), triplets have no 'and'",
  G.drumify(taps, { div: 8, bars: 4 }).n === 64 && G.drumify(taps, { div: 3, bars: 1 }).n === 12 && G.drumify([{ b: 0.333, v: 0.8 }], { div: 3, bars: 1 }).rows.length === 4);
check("kindOf: which drum a sound is, by its name", G.kindOf("kit:kick") === "kick" && G.kindOf("kit:boom") === "kick" && G.kindOf("kit:clap") === "snare" && G.kindOf("kit:chat") === "hat" && G.kindOf("kit:ohat") === "open" && G.kindOf("my:Open Hat.wav") === "open" && G.kindOf("kit:zap") === null);
check("summary: what was read and what was added", /^🥁 5 hits read -> kick 3 · snare 2 · hats \d+ \(added: hats\)$/.test(G.summary(r1)), G.summary(r1));

// ---- the step clip plays it (stepEvents) and keeps it (cleanTL)
const M = [{ t: 0, bpm: 120 }];
const clip = { kind: "steps", name: "Steps", start: 0, off: 0, len: 2, n: 16, div: 4, swing: 0, rows: [{ src: "kit:kick", vol: 1, hits: row(r1, "kick").hits, off: row(r1, "kick").off, vel: row(r1, "kick").vel }] };
check("stepEvents: a step played late is heard late (0.75 + 0.2 x 0.125 = 0.775 s) - Feel unset = as played", J(T.stepEvents(clip, M).map((e) => e.t)) === J([0, 0.775, 1]), T.stepEvents(clip, M));
check("…Feel 0.5 = half of it; Feel 0 = on the grid", T.stepEvents(Object.assign({}, clip, { feel: 0.5 }), M)[1].t === 0.7625 && T.stepEvents(Object.assign({}, clip, { feel: 0 }), M)[1].t === 0.75);
check("…its strength = row volume x vel (not the 70% / 100% of a plain cell)", Math.abs(T.stepEvents(clip, M)[0].v - 0.75) < 1e-9);
const early = Object.assign({}, clip, { len: 4, rows: [{ src: "kit:kick", vol: 1, hits: [1].concat(Array(15).fill(0)), off: [-0.4].concat(Array(15).fill(0)) }] });
check("…an early first hit is never before the clip's start", J(T.stepEvents(early, M).map((e) => e.t)) === J([0, 1.95]), T.stepEvents(early, M));
check("…with swing too (the late odd steps + the played timing)", T.stepEvents(Object.assign({}, clip, { swing: 0.5, rows: [{ src: "kit:rim", vol: 1, hits: [0, 1].concat(Array(14).fill(0)), off: [0, 0.2].concat(Array(14).fill(0)) }] }), M)[0].t === 0.2125);
const old = { kind: "steps", name: "S", start: 0, off: 0, len: 2, n: 16, div: 4, swing: 0, rows: [{ src: "kit:kick", vol: 0.9, hits: [2, 0, 1].concat(Array(13).fill(0)) }] };
check("an old step clip (no off / vel / feel) plays exactly as before", J(T.stepEvents(old, M).map((e) => [e.t, e.v])) === J([[0, 0.9], [0.25, 0.63]]), T.stepEvents(old, M));
const cl = T.cleanTL({ layers: [{ clips: [Object.assign({}, clip, { feel: 7, rows: [{ src: "kit:kick", vol: 1, hits: [1, 0, 2], off: [0.9, 0.3, -2], vel: [3, 0.5, 0.01] }] })] }] }).layers[0].clips[0];
check("cleanTL keeps off / vel (only on hits; off -0.5..0.5, vel 0.05..1) and feel 0..1", cl.feel === 1 && J(cl.rows[0].off.slice(0, 3)) === J([0.5, 0, -0.5]) && J(cl.rows[0].vel.slice(0, 3)) === J([1, 0, 0.05]) && cl.rows[0].off.length === 16, cl);
const cl2 = T.cleanTL({ layers: [{ clips: [old] }] }).layers[0].clips[0];
check("…and adds nothing to an old clip", !("feel" in cl2) && !("off" in cl2.rows[0]) && !("vel" in cl2.rows[0]), cl2);

// ---- wiring
const EJ = JSON.parse(src("ext/synthdock/ext.json")), SJ = src("ext/synthdock/synthsteps.js"), TJ = src("ext/synthdock/synthtl.js"), DJ = src("ext/synthdock/synthdock.js"), DH = src("ext/synthdock/dock.html"), GJ = src("ext/synthdock/synthgroove.js");
check("synthgroove.js loads after synthsteps.js (and after the kit it uses); still no server part", EJ.scripts.indexOf("synthgroove.js") === EJ.scripts.indexOf("synthsteps.js") + 1 && EJ.scripts.indexOf("synthkit.js") < EJ.scripts.indexOf("synthgroove.js") && !EJ.server);
check("the step box: Feel, 🥁 Drumify… (tap / a note clip / a sound, Bars, Your hits, ＋ hats / backbeat / kick, Ghost, ✨ Make, 🎲 Another, ↶ Put back)",
  ["syStepFeel", "syStepGroove", "syGrvFrom", "syGrvBars", "syGrvTap", "syGrvPad", "syGrvNotes", "syGrvSnd", "syGrvKeep", "syGrvHats", "syGrvBack", "syGrvKick", "syGrvGhost", "syGrvGo", "syGrvAgain", "syGrvUndo"].every((id) => SJ.includes('id="' + id + '"') || SJ.includes('chk("' + id + '"')));
check("● Tap: a bar of clicks first, hits on the audio clock as HEARD (getOutputTimestamp), any key (Shift = loud), Esc stops the tap",
  /getOutputTimestamp/.test(SJ) && /H3SynthClick\.play\(ctx, o\.dest\(\), list, at\)/.test(SJ) && /tap\(e\.shiftKey \? 1 : 0\.75, e\.timeStamp\)/.test(SJ) && /if \(Z\.tapping\) tapStop\(false\); else close\(\)/.test(SJ));
check("MIDI notes / drum pads / the keyboard feed ● Tap; the timeline hands over its note + sound clips, the clock and the loader",
  /H3SynthSteps\.tapping\(\)\) root\.H3SynthSteps\.tap\(vel\)/.test(DJ) && /H3SynthSteps\.tap\(b \/ 127\)/.test(DJ) && /function grooveClips\(kind\)/.test(TJ) && /noteClips: function \(\) \{ return grooveClips\("notes"\); \}/.test(TJ) && /load: load/.test(TJ));
check("the cells show it: brightness = vel, a tick = early / late (CSS --v / --o)", /--v/.test(DH) && /\.systep\.felt::after/.test(DH) && /var\(--o, 0\)/.test(DH));
check("honest words: our own rules, not an AI model, nothing downloaded / leaves the PC, light tasks", /not an AI model/.test(G.NOTE) && /nothing leaves your PC/.test(G.NOTE) && /Light tasks/.test(G.NOTE) && !/fetch\(|XMLHttpRequest|require\("(https?|net)"\)/.test(GJ));
check("server.js untouched", !/synth|groove/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
