#!/usr/bin/env node
// bitGen Studio 2.954.0 - 🎹 the Synth tab's deck (49 natural keys, no branding), drum pads, the score screen (record sheet music
// live, open a sheet, learn to play it) and the timeline (sounds from every source, waveforms, per-layer volume knobs, keyframes
// with a start and an end volume). Tim: "make the keyboard narrower and taller ... add a drum pad next to the hammerhead style
// looper. add a timeline below that with waveforms that can be added from all sources, add knobs to each timeline layer for
// volume. add keyframes to each layer, start volume end volume on each key frame" + "make the keyboard look like this ... record
// sheet music live from the keyboard or load sheet music so user can learn to play" + "remove all the branding".
// The browser test is scripts/test-ui954-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
global.H3SynthCore = require("../ext/synthdock/synthcore.js");
const PD = require("../ext/synthdock/synthpads.js"), SC = require("../ext/synthdock/synthscore.js"), T = require("../ext/synthdock/synthtlcore.js"), A = require("../static/abcscore.js");

/* ---- the drum pads */
check("pads: 16 keys (Z X C V = 1-4 ... 1 2 3 4 = 13-16), laid out 13-16 on top, 1-4 at the bottom", Object.keys(PD.PAD_KEYS).length === 16 && PD.PAD_KEYS.KeyZ === 0 && PD.PAD_KEYS.KeyV === 3 && PD.PAD_KEYS.KeyQ === 8 && PD.PAD_KEYS.Digit4 === 15
  && PD.ORDER.join() === "12,13,14,15,8,9,10,11,4,5,6,7,0,1,2,3" && new Set(Object.values(PD.PAD_KEYS)).size === 16);
check("pads 9-16 have sounds of their own; a save made safe (a bad sound = the default, ranges kept)", PD.DEFAULTS.length === 8 && PD.cleanPads(null).every((x, i) => x.snd === PD.DEFAULTS[i].snd)
  && (() => { const c = PD.cleanPads([{ snd: "my:x.wav", vol: 9, pitch: -99 }, { snd: "http://evil" }]); return c[0].snd === "my:x.wav" && c[0].vol === 1 && c[0].pitch === -24 && c[1].snd === "kit:cowbell"; })());
check("velocity: the middle of a pad = 1, a corner = 0.45", PD.velocity(0.5, 0.5) === 1 && PD.velocity(0, 0) === 0.45 && PD.velocity(1, 1) === 0.45 && PD.velocity(0.5, 0.25) > 0.7 && PD.velocity(0.5, 0.25) < 1);

/* ---- the score screen */
check("abcPitch: middle C = C, c = C5, c' = C6, C, = C3, C,, = C2, sharps", [60, 72, 84, 48, 36, 61, 70, 59].map(SC.abcPitch).join(" ") === "C c c' C, C,, ^C ^A B,");
const played = [{ m: 60, t0: 10, t1: 10.25 }, { m: 64, t0: 10.25, t1: 10.5 }, { m: 67, t0: 10.5, t1: 10.75 }, { m: 60, t0: 11, t1: 12.6 }, { m: 64, t0: 11.01, t1: 12.6 }, { m: 72, t0: 12.75, t1: 13.2 }];
const abc = SC.toAbc(played, { bpm: 120, title: "Take" });
check("toAbc: from the first note, 16ths at the BPM, chords together, rests in the gaps, a bar line every 16, finished with |]",
  /^X:1\nT:Take\nM:4\/4\nL:1\/16\nQ:1\/4=120\nK:C\n/.test(abc) && /C2 E2 G2 z2 \[CE\]8 \| \[CE\]5 z c4 z6 \|\]/.test(abc), abc);
const r = A.render(abc), st = SC.steps(r.timing);
check("…the app's engraver reads it back: the same notes at the same places (C E G, the chord, c)", !r.warnings.length && st.map((s) => s.midis.join("+")).join(" ") === "60 64 67 60+64 60+64 72" && st[3].t0 === 8 * 120, st.map((s) => [s.t0, s.midis]));
check("…a long note is tied over the bar line", /c4 c12- \| c8 z8 \|\]/.test(SC.toAbc([{ m: 72, t0: 0, t1: 0.5 }, { m: 72, t0: 0.5, t1: 3 }], { bpm: 120 })) && /-/.test(SC.toAbc([{ m: 60, t0: 0, t1: 1.6 }, { m: 62, t0: 1.5, t1: 2.6 }], { bpm: 120 })));
check("…nothing played = one bar's rest", /z16\|\]/.test(SC.toAbc([], { bpm: 100 })));
const ode = A.render("X:1\nT:Ode\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nE E F G|G F E D|C C D E|E3/2 D/ D2|]\n");
check("steps(): a loaded sheet as the notes to play, in order (Ode to Joy: 15)", SC.steps(ode.timing).length === 15 && SC.steps(ode.timing).map((s) => s.midis[0]).join() === "64,64,65,67,67,65,64,62,60,60,62,64,64,62,62");

/* ---- the timeline */
const k = [{ t: 2, a: 0, b: 1 }, { t: 4, a: 0.5, b: 0.2 }];
check("a keyframe = a START and an END volume: from its time the layer goes from start to end, reached at the next keyframe (the last: at the end); 100% before the first",
  T.env(k, 0, 10) === 1 && T.env(k, 2, 10) === 0 && T.env(k, 3, 10) === 0.5 && T.env(k, 4, 10) === 0.5 && Math.abs(T.env(k, 7, 10) - 0.35) < 1e-9 && Math.abs(T.env(k, 10, 10) - 0.2) < 1e-9);
check("automation(): the line from the playhead as Web Audio calls (set where it is, then per keyframe: set its start, ramp to its end)",
  JSON.stringify(T.automation(k, 3, 10)) === JSON.stringify([{ op: "set", t: 3, v: 0.5 }, { op: "ramp", t: 4, v: 1 }, { op: "set", t: 4, v: 0.5 }, { op: "ramp", t: 10, v: 0.2 }])
  && T.automation(k, 0, 10)[0].v === 1 && T.automation([], 0, 10).length === 1);
const tl = T.newTL();
tl.layers[0].clips.push({ src: "kit:kick", name: "k", start: 1, off: 0, len: 0.5 }); tl.layers[1].clips.push({ src: "snd:song.wav", name: "s", start: 0, off: 2, len: 2 });
check("schedule(): from the playhead - what starts when, how far into each sound; a muted layer is silent, a solo one alone",
  JSON.stringify(T.schedule(tl, 0.5).map(({ pi, c, ...r }) => r)) === /* 2.960.0: + pi, c (the piece played) */ JSON.stringify([{ layer: 1, clip: 0, src: "snd:song.wav", kind: "audio", when: 0, skip: 0.5, off: 2.5, dur: 1.5 }, { layer: 0, clip: 0, src: "kit:kick", kind: "audio", when: 0.5, skip: 0, off: 0, dur: 0.5 }]) /* 2.957.0: + kind, skip */
  && (() => { tl.layers[1].mute = true; const a = T.schedule(tl, 0).length === 1; tl.layers[1].mute = false; tl.layers[0].solo = true; const b = T.schedule(tl, 0).map((s) => s.layer).join() === "0"; tl.layers[0].solo = false; return a && b; })());
check("trim: the left edge keeps the sound in place (start + offset move together), never before the sound's start; the right edge no further than its end; 20 ms at least",
  (() => { const c = { start: 1, off: 0, len: 3 }; T.trimStart(c, 1.5); const a = c.start === 1.5 && c.off === 0.5 && c.len === 2.5; T.trimStart(c, 0); const b = c.start === 1 && c.off === 0 && c.len === 3;
           T.trimEnd(c, 10, 3.5); const d = c.len === 3.5; T.trimEnd(c, 0, 3.5); return a && b && d && c.len === T.MIN; })());
check("addKey(): a keyframe holding the line's value there (start = end), kept in time order", (() => { const l = T.newLayer(0); l.keys.push({ t: 2, a: 0, b: 1 }, { t: 4, a: 1, b: 1 }); const i = T.addKey(l, 3, 10); return i === 1 && l.keys[1].a === 0.5 && l.keys[1].b === 0.5 && l.keys.map((x) => x.t).join() === "2,3,4"; })());
check("cleanTL(): a save made safe - 16 layers at most, a sound must be kit: / my: / sfx: / snd: / out:, volumes 0-150% (keyframes 0-100%), keyframes sorted",
  (() => { const j = T.cleanTL({ zoom: 9999, layers: Array.from({ length: 20 }, () => ({ vol: 9, clips: [{ src: "my:a.wav", start: -4, len: 0 }, { src: "file:///etc/passwd" }, { src: "out:../x.wav" }], keys: [{ t: 5, a: 3, b: -1 }, { t: 1 }] })) });
           return j.layers.length === 16 && j.zoom === 400 && j.layers[0].vol === 1.5 && j.layers[0].clips.length === 1 && j.layers[0].clips[0].start === 0 && j.layers[0].clips[0].len === T.MIN
             && j.layers[0].keys.map((x) => x.t).join() === "1,5" && j.layers[0].keys[1].a === 1 && j.layers[0].keys[1].b === 0; })() && T.cleanTL(null).layers.length === 4);
check("the end, snapping to the looper's 16ths, the time in words, the waveform's min / max", T.end(tl) === 2 && T.snap(1.06, 120, true) === 1 && T.snap(1.06, 120, false) === 1.06 && T.fmt(75.25) === "1:15.3"
  && (() => { const p = T.peaks(new Float32Array([0, 0.5, -0.25, 1, 0, 0, -1, 0]), 8, 2); return p.length === 4 && p[0] === -0.25 && p[1] === 1 && p[2] === -1 && p[3] === 0; })());

/* ---- every source */
const SRCL = require("../lib/synthSources.js");
check("lib/synthSources.js: My samples, the project's SFX, the Sound assets (stems too), songs + the gallery; sound files only, nothing outside the folders",
  SRCL.GROUPS.map((g) => g[0]).join() === "my,sfx,snd,out" && SRCL.fileOf("snd", "../../package.json") === null && SRCL.fileOf("nope", "a.wav") === null && SRCL.fileOf("my", "x.exe") === null && Array.isArray(SRCL.groups()));
const RS = src("routes/synth.js");
check("routes/synth.js: GET /api/synth/sources and /api/synth/source/:group/:name", /app\.get\("\/api\/synth\/sources"/.test(RS) && /app\.get\("\/api\/synth\/source\/:group\/:name"/.test(RS) && /SRC\.fileOf\(req\.params\.group, req\.params\.name\)/.test(RS));

/* ---- the wiring */
const DH = src("ext/synthdock/dock.html"), JS = src("ext/synthdock/synthdock.js"), TJ = src("ext/synthdock/synthtl.js"), LJ = src("ext/synthdock/synthloop.js");
check("the deck (dock.html): wheels, 16 pads + ⏺ Loop / ✎ Edit, the score screen, PATCH / OCTAVE / SHEET buttons, the volume knob, the transport ⏮ ■ ▶ ●, 49 keys 870 x 172",
  ["syDeck", "syBend", "syMod", "syPadBox", "syPadGrid", "syPadRec", "syPadEdit", "syScoreBox", "syScoreView", "syDkPrev", "syDkNext", "syOctDn", "syOctUp", "syDkVol", "syScOpen", "syScSave", "syScLearn", "syScStart", "syScStop", "syScPlay", "syScRec", "syScoreFile", "syPiano"].every((id) => DH.includes('id="' + id + '"'))
  && /#syPiano \{ flex: 0 0 auto; width: 870px;[^}]*height: 172px;/.test(DH) && /var KB = \{ n: 48,/.test(JS));
check("no branding on screen: no maker's or product name in the docker (comments aside), no nameplate", !/akai|professional|synth ?station|production keyboard|sykeyhead|sybrand/i.test(DH.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, ""))
  && !/Synth station/.test(src("static/audiodock.js")));
check("the timeline (dock.html): its bar (▶ ⏮ the time, ＋ Sound, ⌗ Snap, zoom, ⬇ WAV, → SFX, → 🔊), the sources, the keyframe knobs (over the layers), the heads, the canvas - ids of its own (syT…)",
  ["syTL", "syTPlay", "syTStart", "syTPos", "syTAddBtn", "syTSnap", "syTZoomIn", "syTZoomOut", "syTWav", "syTToSfx", "syTToSound", "syTPick", "syTKeyEd", "syTHeads", "syTScroll", "syTCanvas", "syTFile"].every((id) => DH.includes('id="' + id + '"'))
  && /\.sytlkey \{[^}]*position: absolute;/.test(DH) && !/id="tl[A-Z]/.test(DH));
check("synthdock.js: notes go to the score (● Rec / 🎓 Learn); MIDI channel 10 = the pads (36-51); the guide keys drawn green; every source to the pads + the timeline; all three kept (h3.synth.pads / sheet / tl)",
  /if \(SC\) SC\.noteOn\(m, vel\);/.test(JS) /* 2.957.0: + the velocity */ && /if \(!G\.down\[m\] && SC\) SC\.noteOff\(m\);/.test(JS) && /\(d\[0\] & 0x0f\) === 9/.test(JS) && /PD\.hit\(a - 36, b \/ 127\)/.test(JS)
  && /G\.guide\[k\.m\]/.test(JS) && /"\/api\/synth\/sources"/.test(JS) && /LS\.set\("pads"/.test(JS) && /LS\.set\("sheet", a\)/.test(JS) && /LS\.set\("tl", JSON\.stringify\(t\)\)/.test(JS)
  && /if \(SC\) SC\.stop\(\); if \(TL\) TL\.stop\(\);/.test(JS));
check("synthtl.js: a layer's Vol (0-150%) and Pan knobs; per layer volume -> pan -> the keyframe line (set / ramp) -> out; 5 ms fades per clip; the nearest handle wins; offline mixdown",
  /l\.vol = Math\.round\(n \* 150\) \/ 100/.test(TJ) && /T\.automation\(l\.keys, from, endT\)/.test(TJ) && /linearRampToValueAtTime\(op\.v, when\)/.test(TJ) && /Math\.max\(f\.fi, 0\.005\)/.test(TJ) /* 2.957.0: the clip's gain line, 5 ms at least */
  && /var best = null, bd = 8;/.test(TJ) && /new OAC\(2,/.test(TJ) && /addEventListener\("dblclick"/.test(TJ));
check("synthloop.js: a pad hit plays its row; ⏺ Loop writes it on the nearest step of the pattern playing; a row's sound may be snd: / out: (the sources route)",
  /function hit\(r, vel\)/.test(LJ) && /function recordHit\(r, vel\)/.test(LJ) && /L\.pats\[p\]\[r\]\[k\] = vel >= 0\.85 \? 2 : 1/.test(LJ) && /"\/api\/synth\/source\/" \+ m\[1\]/.test(LJ));
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
