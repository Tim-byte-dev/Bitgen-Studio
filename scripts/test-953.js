#!/usr/bin/env node
// bitGen Studio 2.953.0 - 🎹 the Synth station, the Audio docker's 4th tab (Tim: "can we add a synthstation that looks something
// like this in Audio docker with a midi keyboard and hammer head style looper that the user can add new samples to ?").
// The rules (synthcore.js), the built-in kit (synthkit.js), the samples library (lib/synthSamples.js) and its routes
// (routes/synth.js), the wiring. The browser test is scripts/test-ui953-ui.js.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const C = require("../ext/synthdock/synthcore.js"), K = require("../ext/synthdock/synthkit.js");

/* ---- notes, keys */
check("notes: A4 = 440 Hz, C4 = 261.63, names (C4 = 60, C-1 = 0), black keys", Math.abs(C.freq(69) - 440) < 1e-9 && Math.abs(C.freq(60) - 261.6256) < 1e-3
  && C.noteName(60) === "C4" && C.noteName(0) === "C-1" && C.noteName(61) === "C#4" && C.isBlack(61) && !C.isBlack(64), [C.noteName(60), C.noteName(0)]);
check("the computer keys: Z = the octave's C, S = C#, , = the next C, Q = the next C too, ] = 31 semitones; KeyboardEvent.code (any layout)",
  C.KEYS.KeyZ === 0 && C.KEYS.KeyS === 1 && C.KEYS.Comma === 12 && C.KEYS.KeyQ === 12 && C.KEYS.Digit2 === 13 && C.KEYS.BracketRight === 31 && Object.keys(C.KEYS).every((k) => /^(Key[A-Z]|Digit\d|Comma|Period|Semicolon|Slash|BracketLeft|BracketRight|Equal)$/.test(k)));

/* ---- the knobs */
const ids = C.PARAMS.map((p) => p.id);
check("39 controls on 7 panels (oscillators, filter, the two envelopes, LFO, effects, master) + 13 hidden instrument settings (2.972.0), every one on a known panel, no id twice",
  C.PARAMS.filter((p) => !p.hide).length === 39 && C.PARAMS.filter((p) => p.hide).length === 13 && C.SECTIONS.length === 7 && new Set(ids).size === ids.length && C.PARAMS.every((p) => C.SECTIONS.some((s) => s.id === p.sec)), C.PARAMS.length);
check("every default sits in its range / is one of its choices", C.PARAMS.every((p) => p.ch ? p.ch.includes(p.def) : p.re ? p.re.test(p.def) : p.def >= p.min && p.def <= p.max));
check("a knob's position and its value agree both ways (linear, exp - Cutoff 40 Hz..18 kHz, whole numbers)",
  C.PARAMS.filter((p) => !p.ch && !p.re).every((p) => { const v = C.fromNorm(p.id, C.toNorm(p.id, p.def)); return Math.abs(v - p.def) <= Math.max(1e-3, Math.abs(p.def) * 1e-3) + (p.c === "int" ? 0 : 0); })
  && C.fromNorm("cut", 0) === 40 && C.fromNorm("cut", 1) === 18000 && Math.abs(C.fromNorm("cut", 0.5) - Math.sqrt(40 * 18000)) < 1 && C.fromNorm("uni", 0.5) === 4 && Number.isInteger(C.fromNorm("bSemi", 0.37)));
check("a choice: its index over 0..1 (Wave A: saw / square / triangle / sine)", C.toNorm("aWave", "saw") === 0 && C.toNorm("aWave", "sine") === 1 && C.fromNorm("aWave", 0.4) === "square" && C.fromNorm("fType", 1) === "bandpass");
check("cleanPatch: out of range clamped, junk = the default, unknown keys dropped, a choice must be known",
  (() => { const p = C.cleanPatch({ cut: 99999, res: "x", aWave: "laser", uni: 3.6, evil: "<script>", vol: -1 }); return p.cut === 18000 && p.res === C.BY.res.def && p.aWave === "saw" && p.uni === 4 && !("evil" in p) && p.vol === 0 && Object.keys(p).length === C.PARAMS.length; })());
check("the readout in words: Hz / kHz, ms / s, cents, semitones, percent, ± for the two-way knobs",
  C.show("cut", 2400) === "2.40 kHz" && C.show("cut", 440) === "440 Hz" && C.show("aA", 0.004) === "4 ms" && C.show("aR", 2.6) === "2.60 s" && C.show("bSemi", 12) === "+12 st"
  && C.show("aDet", -7) === "-7 ct" && C.show("aLvl", 0.8) === "80%" && C.show("fEnv", 0.35) === "+35%" && C.show("aWave", "saw") === "saw", [C.show("cut", 2400), C.show("fEnv", 0.35)]);
const names = C.PRESETS.map((x) => x.name);
check("our own patches (14 in the SYNTH bank + 2.972.0's instruments, our names - nobody else's), each a safe patch; Init = the defaults",
  C.bank("Synth").length === 14 && C.PRESETS.length > 80 && new Set(names).size === names.length && names[0] === "Init" && JSON.stringify(C.patch("Init")) === JSON.stringify(C.defaults())
  && C.PRESETS.every((x) => Object.keys(x.p).every((k) => C.BY[k]) && JSON.stringify(C.cleanPatch(x.p)) === JSON.stringify(C.patch(x.name))) && C.patch("Deep Sub Bass").mode === "mono" && C.patch("nope") === null, names);
check("…no brand's product names in the station", !/tachyon|luxon|pulsar|kabayun|serum|massive|sylenth|hammerhead|rebirth/i.test(names.join(" ") + src("ext/synthdock/dock.html").replace(/<!--[\s\S]*?-->/g, "")));

/* ---- the loop */
const L = C.newLoop();
check("a new loop: 8 rows (the kit), 8 patterns x 16 steps, A-C with a beat to start from, D-H empty, 120 BPM",
  L.rows.length === 8 && L.pats.length === 8 && L.pats.every((g) => g.length === 8 && g.every((r) => r.length === 16)) && [0, 1, 2].every((p) => C.hasSteps(L, p)) && [3, 4, 5, 6, 7].every((p) => !C.hasSteps(L, p))
  && L.bpm === 120 && L.rows.every((r) => /^kit:/.test(r.snd)) && C.KIT.length === 12 && L.rows.every((r) => C.KIT.some((k) => "kit:" + k[0] === r.snd)));
check("a pad: click = on / off, accent = on with an accent / back to plain", (() => { const l = C.newLoop(); return C.toggle(l, 3, 0, 5) === 1 && C.toggle(l, 3, 0, 5, true) === 2 && C.toggle(l, 3, 0, 5, true) === 1 && C.toggle(l, 3, 0, 5) === 0; })());
check("cleanLoop: a save made safe - always 8 x 16 x 8, steps 0 / 1 / 2, BPM 40-240, swing 0-0.5, a sound must be kit: / my: / sfx: with no ..",
  (() => { const j = C.cleanLoop({ bpm: 999, swing: 3, pat: 12, rows: [{ snd: "my:../../etc/passwd", vol: 7, pitch: 99 }, { snd: "my:kick 2.wav", pan: -4 }], pats: [[[1, 2, 3, "x", 1]]] });
           return j.bpm === 240 && j.swing === 0.5 && j.pat === 7 && j.rows.length === 8 && j.rows[0].snd === "kit:kick" && j.rows[0].vol === 1 && j.rows[0].pitch === 24 && j.rows[1].snd === "my:kick 2.wav" && j.rows[1].pan === -1
             && j.pats.length === 8 && j.pats[0][0].join("") === "1200100000000000" && j.pats[1].every((r) => r.every((v) => v === 0)); })()
  && JSON.stringify(C.cleanLoop(null)) === JSON.stringify(C.newLoop()) && C.okSnd("sfx:boom.wav") === "sfx:boom.wav" && C.okSnd("http://x") === null && C.okSnd("kit:<b>") === null);
check("mute / solo: a muted row is silent; with a solo row only the solo rows play", (() => { const l = C.newLoop(); l.rows[1].mute = true; const a = !C.audible(l, 1) && C.audible(l, 0); l.rows[2].solo = true; return a && C.audible(l, 2) && !C.audible(l, 0); })());
check("the clock: a 16th at 120 BPM = 0.125 s; swing pushes the off-beats only (0.33 ~ triplets)",
  C.stepDur(120) === 0.125 && C.stepTime(4, 120, 0) === 0.5 && C.stepTime(5, 120, 0.5) === 0.625 + 0.0625 && C.stepTime(4, 120, 0.5) === 0.5);
check("⛓ chain: every pattern with a step on, in order; off = the one picked; an empty chain = the one picked",
  (() => { const l = C.newLoop(); const a = C.order(l).join() === "0"; l.chain = true; const b = C.order(l).join() === "0,1,2"; l.pats.forEach((g) => g.forEach((r) => r.fill(0))); l.pat = 4; return a && b && C.order(l).join() === "4"; })());
const ev = C.events(L, 2);
check("events (the WAV render): every hit of 2 passes in time order, accents louder, 2 bars = 4 s at 120 BPM",
  ev.bars === 2 && ev.seconds === 4 && ev.events.length === 2 * L.pats[0].flat().filter((v) => v).length && ev.events.every((e, i, a) => !i || a[i - 1].t <= e.t)
  && ev.events.some((e) => e.vel === 1) && ev.events.some((e) => e.vel === 0.7) && ev.events.filter((e) => e.bar === 1)[0].t >= 2, { bars: ev.bars, n: ev.events.length });

/* ---- WAV, the kit */
const w = C.wav([new Float32Array([0, 1, -1, 2]), new Float32Array([0, 0.5, -0.5, 0])], 48000), dv = new DataView(w.buffer);
check("wav(): RIFF / WAVE, PCM 16-bit, 2 channels, 48 kHz, the samples clipped and interleaved",
  Buffer.from(w.slice(0, 4)).toString() === "RIFF" && Buffer.from(w.slice(8, 12)).toString() === "WAVE" && dv.getUint16(20, true) === 1 && dv.getUint16(22, true) === 2 && dv.getUint32(24, true) === 48000
  && dv.getUint16(34, true) === 16 && dv.getUint32(40, true) === 16 && w.length === 60 && dv.getInt16(48, true) === 32767 && dv.getInt16(52, true) === -32768 && dv.getInt16(56, true) === 32767 && dv.getInt16(50, true) === 16384);
const kit = C.KIT.map((k) => [k[0], K.make(k[0], 48000)]);
check("the built-in kit: all 12 made here from waves and noise - finite, peak 0.9, short (0.05-2 s), the same every time",
  kit.every(([, x]) => x && x.length > 2000 && x.length < 96000 && x.every(Number.isFinite) && Math.abs(Math.max(...x.map(Math.abs)) - 0.9) < 1e-6)
  && K.make("snare", 48000).every((v, i) => v === kit[2][1][i]) && K.make("nope", 48000) === null, kit.map(([k, x]) => [k, x && x.length]));
check("…a kick is low (most of it under 200 Hz), a closed hat is bright and short", (() => {
  const zc = (x) => { let n = 0; for (let i = 1; i < x.length; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) n++; return n / (x.length / 48000) / 2; };
  return zc(K.make("kick", 48000).slice(2400, 12000)) < 200 && zc(K.make("chat", 48000)) > 3000 && K.make("chat", 48000).length < K.make("ohat", 48000).length; })());

/* ---- the samples library */
const S = require("../lib/synthSamples.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t953-"));
S.setDir(tmp);
const up = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "t953u-")), "upload");
fs.writeFileSync(up, Buffer.from(w));
const a1 = S.add(up, "My Kick.wav"), a2 = S.add(up, "My Kick.wav"), a3 = S.add(up, "../../evil.wav"), a4 = S.add(up, "notes.txt");
check("add: a WAV is kept as it is, a second one gets (2), a path is cut to its name, not a sound file = refused in words",
  a1.name === "My Kick.wav" && !a1.made && a2.name === "My Kick (2).wav" && a3.name === "evil.wav" && fs.existsSync(path.join(tmp, "evil.wav")) && /not a sound file/.test(a4.error || ""), [a1, a2, a3, a4]);
check("list: the sound files A-Z; fileOf only inside the folder; remove", S.list().map((x) => x.name).join("|") === "evil.wav|My Kick (2).wav|My Kick.wav" && S.fileOf("../My Kick.wav") === path.join(tmp, "My Kick.wav")
  && S.fileOf("nope.wav") === null && S.fileOf(".hidden.wav") === null && S.remove("evil.wav").name === "evil.wav" && S.remove("evil.wav").status === 404 && S.list().length === 2, S.list());
check("the project file's name: what was asked (safe), the upload's own kind", S.exportName("synth loop A 120bpm", "loop.wav") === "synth loop A 120bpm.wav" && S.exportName("take", "take.webm") === "take.webm"
  && S.exportName("../x/y.wav", "a.exe") === "y.wav" && S.exportName("", "") === "synth.wav");
const routes = {};
require("../routes/synth.js").mount({ get: (p, ...h) => { routes["GET " + p] = h.pop(); }, post: (p, ...h) => { routes["POST " + p] = h.pop(); } });
const res = (ok) => { const r = { code: 200, set() { return r; }, status(n) { r.code = n; return r; }, json(j) { ok({ status: r.code, j }); }, sendFile(f) { ok({ status: r.code, file: f }); } }; return r; };
const call = (k, req) => new Promise((ok) => routes[k](req, res(ok)));
(async () => {
  check("routes/synth.js: GET / POST /api/synth/samples, the file, delete, to-project", ["GET /api/synth/samples", "POST /api/synth/samples", "GET /api/synth/samples/file/:name", "POST /api/synth/samples/delete", "POST /api/synth/to-project"].every((k) => routes[k]), Object.keys(routes));
  const g = await call("GET /api/synth/samples", {});
  const f = await call("GET /api/synth/samples/file/:name", { params: { name: "My Kick.wav" } }), nf = await call("GET /api/synth/samples/file/:name", { params: { name: "../../package.json" } });
  fs.writeFileSync(up + "2", Buffer.from(w));
  const p = await call("POST /api/synth/samples", { files: [{ path: up + "2", originalname: "snare.wav" }, { path: up + "2", originalname: "readme.md" }] });
  const d = await call("POST /api/synth/samples/delete", { body: { name: "snare.wav" } }), d2 = await call("POST /api/synth/samples/delete", { body: { name: "snare.wav" } });
  const t1 = await call("POST /api/synth/to-project", { body: { to: "elsewhere" }, file: { path: up, originalname: "x.wav" } }), t2 = await call("POST /api/synth/to-project", { body: {} });
  check("…the list, a file (none outside the folder), an upload (a non-sound refused beside it, the upload's temp file gone), delete (twice = 404), to-project: a bad target / no file = 400",
    g.j.samples.length === 2 && f.file === path.join(tmp, "My Kick.wav") && nf.status === 404 && p.status === 200 && p.j.added[0].name === "snare.wav" && /not a sound file/.test(p.j.errors[0])
    && !fs.existsSync(up + "2") && d.j.ok && d2.status === 404 && t1.status === 400 && t2.status === 400, { g: g.j, p: p.j, t1, t2 });
  S.setDir(null);

  /* ---- the wiring */
  const EJ = JSON.parse(src("ext/synthdock/ext.json")), DH = src("ext/synthdock/dock.html"), JS = src("ext/synthdock/synthdock.js"), LJ = src("ext/synthdock/synthloop.js"), AU = src("static/audiodock.js"), IX = src("static/index.html");
  check("ext/synthdock: ext.json (Synth, column 67 - next to SFX, the rules first, the station last; no server part - the routes are core, like SFX's)",
    EJ.id === "synthdock" && EJ.name === "Edit Booth" /* 2.972.0 */ && EJ.order === 67 && EJ.scripts.join() === "synthinst.js,synthcore.js,synthkit.js,synthvoice.js,synthknob.js,synthclick.js,synthrec.js,synthloop.js,synthpads.js,synthscore.js,synthtlcore.js,synthtl.js,synthsing.js,synthroll.js,synthmix.js,synthsteps.js,synthundo.js,synthfile.js,synthdock.js" /* 2.954.0: + pads, the score, the timeline */ && !EJ.server
    && EJ.scripts.every((s) => fs.existsSync(path.join(ROOT, "ext/synthdock", s))));
  check("the Audio docker: 🎹 Synth is its 4th tab; the shell has its marker after SFX; no statusbar button of its own (tSy in GONE_DOCKS); Audio's tip says so",
    require("../static/audiodock.js").IDS.join() === "musicdock,sfxdock,synthdock" /* 2.966.0: Stems gone */ && require("../static/audiodock.js").TABS.synthdock.icon === "🎹" && require("../static/audiodock.js").TABS.synthdock.name === "Edit Booth" /* 2.972.0 */
    && /<!-- ext:dock sfxdock -->\s*<!-- ext:dock synthdock -->/.test(IX) && /tSy: "synthdock"/.test(IX) && /title="Audio docker - Music, SFX and Edit Booth as its tabs"/.test(IX) && /2\.953\.0/.test(AU));
  check("dock.html: ▾ Synth (Audio's tabs dress it), ⛶, the focusable station, its own Space, the rack, the screen, the wheels, the keyboard, the looper, the library, the file box",
    /▾ Edit Booth<button class="maxbtn" data-max="synthdock"/.test(DH) && /id="syBody" tabindex="0"/.test(DH) && /data-own-space="1"/.test(DH)
    && ["syPreset", "sySave", "sySample", "syRec", "syPanic", "syMidiIn", "syRack", "syScope", "syBend", "syMod", "syOct", "syPiano", "syPlay", "syBpm", "syPats", "syChain", "syCopy", "syClear", "syPasses", "syWav", "syToSfx", "syToSound", "syLibBtn", "syLib", "syDrop", "syRows", "syFile", "syMsg"].every((id) => DH.includes('id="' + id + '"')));
  check("synthdock.js: hidden the first time; the sound wakes on a click (the browser's rule); keys only while the station has the focus, never passed on; ⛶ = the whole window, Esc back",
    /localStorage\.getItem\("h3\.g\.synthdock"\) == null\) root\.localStorage\.setItem\("h3\.g\.synthdock", "1"\)/.test(JS) && /body\.addEventListener\("keydown", onKey\)/.test(JS) && /e\.preventDefault\(\); e\.stopPropagation\(\);/.test(JS)
    && !/document\.addEventListener\("keydown"|doc\.addEventListener\("keydown"/.test(JS) && /classList\.toggle\("sy-full", on\)/.test(JS) && /e\.key !== "Escape"/.test(JS) && /body\.sy-full #synthdock \{ position: fixed/.test(DH));
  check("…MIDI (Web MIDI): notes with velocity, note-off as 0x80 or a 0 velocity, the mod wheel (CC1), sustain (CC64), volume (CC7), pitch bend; asked for only when the station is used",
    /requestMIDIAccess\(\{ sysex: false \}\)/.test(JS) && /st === 0x90 && b > 0/.test(JS) && /st === 0x80 \|\| \(st === 0x90 && b === 0\)/.test(JS) && /a === 1\)/.test(JS) && /a === 64\)/.test(JS) && /a === 7\)/.test(JS) && /st === 0xe0/.test(JS)
    && !/midiStart\(\);\s*\}\)\(/.test(JS));
  check("…hidden or folded = the loop and every note stop; the scope draws only while it is on screen", /function hideStop\(\) \{ if \(!shown\(\)\) \{ if \(LP\.playing\(\)\) LP\.play\(false\); allOff\(\);/.test(JS) && /if \(!G\.E \|\| !shown\(\)\) return;/.test(JS));
  check("…the samples: 📂 to /api/synth/samples, 🎙 Sample it the same way, the loop / a take to /api/synth/to-project; patches and the loop kept in this browser (h3.synth.*)",
    /"\/api\/synth\/samples", \{ method: "POST", body: fd \}/.test(JS) && /"\/api\/synth\/to-project", \{ method: "POST", body: fd \}/.test(JS) && /V\.sampleNote\(G\.p, m, 1\)/.test(JS)
    && /LS\.set\("user", JSON\.stringify\(G\.user\)\)/.test(JS) && /LS\.set\("loop", JSON\.stringify\(LP\.loop\(\)\)\)/.test(JS) && !/window\.prompt|root\.prompt\(/.test(JS));
  check("synthloop.js: a look-ahead clock on the AudioContext (the screen follows it), a row's sound from the kit / /api/synth/samples/file / /api/sfx/file, a file dropped on a row",
    /setInterval\(tick, 25\)/.test(LJ) && /ctx\.currentTime \+ 0\.14/.test(LJ) && /"\/api\/synth\/samples\/file\/"/.test(LJ) && /"\/api\/sfx\/file\/"/.test(LJ) && /addEventListener\("drop"/.test(LJ) && /new OAC\(2,/.test(LJ));
  check("2.953.1 (Tim: \"can u make the keyboard look a little more like a keyboard\"): a case with a nameplate, the wheels in a well, a felt strip, ivory keys with a front lip, black keys with a top face + sloped front + a shadow, a pressed key goes down",
    /class="sydeck"/.test(DH) /* 2.954.0: the deck (no nameplate - no branding) */ && /\.sywheels \{[^}]*inset 0 2px 6px #000/.test(DH) && /var KB = \{ n: 48, geo: null, felt: 7 \}/.test(JS) && /function keyPath\(x, X, Y, W, H, r\)/.test(JS)
    && /\/\/ the front lip/.test(JS) && /x\.shadowOffsetY = on \? 1 : 3;/.test(JS) && /H = h - F - \(on \? 3 : 1\)/.test(JS) && /var y = Math\.max\(0, py - g\.F\);/.test(JS));
  check("routes/index.js mounts routes/synth.js; server.js untouched", /require\("\.\/synth"\)\.mount\(app\)/.test(src("routes/index.js")) && !/synth/i.test(src("misc/server.js")));
  check("synth_samples/ is this PC's: .gitignore, misc/_gitignore, make_zips.sh", /^synth_samples\/$/m.test(src(".gitignore")) && /^synth_samples\/$/m.test(src("misc/_gitignore")) && /! -path "\.\/synth_samples\/\*"/.test(src("scripts/make_zips.sh")));
  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
