#!/usr/bin/env node
// bitGen Studio 2.972.0 - the Audio docker's 🎹 tab is the EDIT BOOTH, and its keyboard has a home keyboard's INSTRUMENTS.
// Tim: "change synth tab name in audio docker to Edit Booth. Add preset instruments to the keyboard like piano, organ, and all
// the other synthesized sounds on the electronic keyboards". The pure parts: synthinst.js (the banks, the voices, the string and
// drawbar makers) and synthcore.js (the hidden instrument settings). The browser leg (the VOICE row, sounds rendered and
// measured) is scripts/test-ui972-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const I = require(path.join(ROOT, "ext/synthdock/synthinst.js"));
const C = require(path.join(ROOT, "ext/synthdock/synthcore.js"));
const SR = 48000;
function pitch(x, lo, hi, at) { let best = -1, bl = 0; const s = Math.round(SR * (at || 0.15)), n = 4096; for (let L = Math.floor(SR / hi); L <= Math.ceil(SR / lo); L++) { let r = 0; for (let i = 0; i < n; i++) r += x[s + i] * x[s + i + L]; if (r > best) { best = r; bl = L; } } return SR / bl; }
function rms(x, a, b) { a = Math.round(a * SR); b = Math.round(b * SR); let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); }
const peak = (x) => { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); return m; };
const cents = (a, b) => 1200 * Math.log2(a / b);

/* ---------------- the banks and the voices ---------------- */
const cats = I.CATS.map((c) => c[0]);
check("14 banks in a home keyboard's order: Piano, Mallets, Organ, Guitar, Bass, Strings, Choir, Brass, Reed, Pipe, Lead, Pad, World, Synth",
  cats.join() === "Piano,Mallets,Organ,Guitar,Bass,Strings,Choir,Brass,Reed,Pipe,Lead,Pad,World,Synth" && I.CATS.every((c) => c[1] && c[1].length <= 7 && c[2]));
check("every bank has voices; 70+ instruments + our 14 synth patches (SYNTH); Init first, names never twice",
  cats.every((c) => C.bank(c).length > 0) && I.INSTRUMENTS.length >= 70 && C.bank("Synth").length === 14 && C.PRESETS[0].name === "Init"
  && new Set(C.PRESETS.map((x) => x.name)).size === C.PRESETS.length, cats.map((c) => c + ":" + C.bank(c).length));
check("the PRESETS run bank by bank (◀ ▶ PATCH steps through a bank before the next)",
  (() => { const seq = C.PRESETS.slice(1).map((x) => x.cat), ord = (c) => cats.indexOf(c); return seq.every((c, i) => !i || ord(seq[i - 1]) <= ord(c)) && seq[seq.length - 1] === "Synth"; })());
check("the voices people look for are there: grand / bright piano, electric pianos, harpsichord, vibraphone, marimba, organs, accordion, guitars, basses, strings, choir, trumpet, sax, flute",
  ["Grand Piano", "Bright Piano", "Tine E.Piano", "Harpsichord", "Vibraphone", "Marimba", "Glockenspiel", "Tubular Bells", "Drawbar Organ", "Church Organ", "Accordion", "Harmonica",
   "Nylon Guitar", "Steel Guitar", "Distortion Guitar", "Finger Bass", "Slap Bass", "String Ensemble", "Violin", "Harp", "Choir Aahs", "Trumpet", "Brass Section", "Alto Sax",
   "Clarinet", "Flute", "Pan Flute", "Koto", "Kalimba"].every((n) => C.patch(n)));
check("generic names only - no maker's or product's name anywhere in the voices",
  !/rhodes|wurli|hammond|leslie|clavinet|mellotron|steinway|yamaha|roland|korg|casio|moog|dx7|dx-7|fender|gibson|strat|hohner|nord|kurzweil|bosendorfer|bösendorfer|ensoniq|oberheim|prophet|juno|jupiter|minimoog/i.test(C.PRESETS.map((x) => x.name).join(" ") + src("ext/synthdock/synthinst.js")));
check("every voice is a safe patch exactly as written (each value in range, a known choice) - cleanPatch changes nothing",
  C.PRESETS.every((x) => { const c = C.cleanPatch(x.p); return Object.keys(x.p).every((k) => C.BY[k] && c[k] === x.p[k]); }),
  C.PRESETS.filter((x) => { const c = C.cleanPatch(x.p); return Object.keys(x.p).some((k) => c[k] !== x.p[k]); }).map((x) => x.name));
check("each tone's start: the strings (pluck / strike) play with osc A and B off; FM rides osc A (a sine); the organ's bars on osc A; no delay unless a voice asks",
  I.INSTRUMENTS.filter((x) => /pluck|strike/.test(x.p.tone)).every((x) => x.p.aLvl === 0 && x.p.bLvl === 0)
  && I.INSTRUMENTS.filter((x) => x.p.tone === "fm").every((x) => x.p.aWave === "sine" && C.patch(x.name).aLvl > 0)
  && I.INSTRUMENTS.filter((x) => x.p.tone === "organ").every((x) => /^[0-8]{9}$/.test(x.p.bars) && x.p.bLvl === 0)
  && I.INSTRUMENTS.filter((x) => !x.p.dMix).length >= 60);
check("all four instrument engines are used: fm, organ, pluck, strike (+ the plain synth)", ["fm", "organ", "pluck", "strike", undefined].every((t) => I.INSTRUMENTS.some((x) => x.p.tone === t)));

/* ---------------- the hidden settings ---------------- */
const hid = C.PARAMS.filter((p) => p.hide);
check("13 hidden settings (no knob - the instruments set them): tone, FM ratio / depth / fall / hold, drawbars, key click, string brightness / ring, stiffness, hammer, strings apart, velocity -> brightness",
  hid.map((p) => p.id).join() === "tone,fmR,fmI,fmD,fmS,bars,click,kDamp,kSus,stB,stHam,stDet,fVel" && C.BY.tone.ch.join() === "synth,fm,organ,pluck,strike" && C.BY.tone.def === "synth");
check("...the knobs on the rack stay the 39 (none of the hidden ones get a knob - synthdock.js ORDER)",
  C.PARAMS.filter((p) => !p.hide).length === 39 && !hid.some((p) => new RegExp('"' + p.id + '"').test(src("ext/synthdock/synthdock.js").match(/var ORDER = \{[\s\S]*?\};/)[0])));
check("drawbars as text: 9 digits 0-8 kept, anything else = 888000000; the defaults keep an old patch sounding as it did (tone synth)",
  C.cleanValue("bars", "800000008") === "800000008" && C.cleanValue("bars", "999") === "888000000" && C.cleanValue("bars", 12) === "888000000" && C.show("bars", "880000000") === "880000000"
  && C.toNorm("bars", "123") === 0 && C.fromNorm("bars", 0.5) === "888000000" && C.cleanPatch({ aWave: "saw" }).tone === "synth" && C.cleanPatch({ tone: "laser" }).tone === "synth");

/* ---------------- the makers ---------------- */
const d = I.drawbars("800000008");
check("drawbars(): the bars are harmonics of the note an octave down - 16' = 1st, 8' = 2nd, 1' = 16th; 8 = full, each step 3 dB less, 0 = none",
  d.imag.length === 17 && d.imag[1] === 1 && d.imag[16] === 1 && d.imag[2] === 0 && I.drawbars("080000000").imag[3] === 1 && I.drawbars("080000000").imag[2] === 0 && Math.abs(I.drawbars("070000000").imag[3] - Math.pow(10, -3 / 20)) < 1e-6 && I.drawbars("x").imag[2] === 1);
const pl = I.pluck(110, SR, { damp: 0.7, sus: 3, seed: 1 });
check("pluck(): a plucked A2 is in tune (within 10 cents), fades, peaks at 0.9 and ends at silence (no click)",
  Math.abs(cents(pitch(pl, 80, 160), 110)) < 10 && rms(pl, 0, 0.1) > 10 * rms(pl, 2, 2.1) && Math.abs(peak(pl) - 0.9) < 1e-3 && pl[pl.length - 1] === 0,
  { hz: pitch(pl, 80, 160), a: rms(pl, 0, 0.1), b: rms(pl, 2, 2.1) });
const p440 = I.pluck(440, SR, { damp: 0.5, sus: 2 }), p1k = I.pluck(1046.5, SR, { damp: 0.5, sus: 2 });
check("...in tune up the keyboard too (A4, C6 - the fractional delay)", Math.abs(cents(pitch(p440, 300, 600), 440)) < 12 && Math.abs(cents(pitch(p1k, 800, 1300), 1046.5)) < 20, [pitch(p440, 300, 600), pitch(p1k, 800, 1300)]);
const dark = I.pluck(220, SR, { damp: 0.1, sus: 2 }), bright = I.pluck(220, SR, { damp: 0.95, sus: 2 });
const zc = (x) => { let n = 0; for (let i = 4800; i < 9600; i++) if ((x[i] >= 0) !== (x[i - 1] >= 0)) n++; return n; };
check("...brightness: a bright pluck has more highs (more zero crossings) than a dark one", zc(bright) > zc(dark) * 1.3, [zc(bright), zc(dark)]);
const st = I.strike(261.63, SR, { damp: 0.55, sus: 2.6, B: 0.0004, ham: 0.35, det: 1.2 });
check("strike(): a struck middle C is in tune, rings then dies away (two stages), ends silent", Math.abs(cents(pitch(st, 200, 330, 0.3), 261.63)) < 15 && rms(st, 0.05, 0.15) > 3 * rms(st, 2.5, 2.6) && st[st.length - 1] === 0,
  { hz: pitch(st, 200, 330, 0.3) });
const lowC = I.strike(65.41, SR, { damp: 0.55, sus: 2.6 }), hiC = I.strike(1046.5, SR, { damp: 0.55, sus: 2.6 });
check("...a low note lasts longer than a high one (like a piano: longer strings)", lowC.length > hiC.length * 1.5, [lowC.length / SR, hiC.length / SR]);
check("...a few milliseconds to make even the longest low note (the made notes are kept, the keys on screen made ahead)", (() => { const t = Date.now(); I.strike(32.7, SR, { damp: 0.8, sus: 4, B: 0.0004, det: 2 }); return Date.now() - t < 1500; })());
check("zone(): every 3rd key (a semitone either way at most)", [60, 61, 62, 63, 64].map(I.zone).join() === "60,60,63,63,63" && [...Array(128).keys()].every((m) => Math.abs(I.zone(m) - m) <= 1));

/* ---------------- the engine, the deck, the rename ---------------- */
const V = src("ext/synthdock/synthvoice.js"), D = src("ext/synthdock/synthdock.js"), H = src("ext/synthdock/dock.html"), EJ = JSON.parse(src("ext/synthdock/ext.json"));
check("engine: FM = a sine modulator on osc A's frequency, depth falling fmI -> fmI x fmS over fmD, louder notes deeper; bend / LFO move it too",
  /var mo = ctx\.createOscillator\(\), mg = ctx\.createGain\(\), mmul = p\.fmR \* Math\.pow\(2, p\.aOct\), mf = f \* mmul, dev = p\.fmI \* mf \* \(0\.4 \+ 0\.6 \* vel\);/.test(V)
  && /mg\.gain\.setTargetAtTime\(dev \* p\.fmS, t \+ 0\.002, Math\.max\(0\.003, p\.fmD \/ 3\)\)/.test(V) && /if \(o\.which === "a"\) mg\.connect\(o\.n\.frequency\)/.test(V) && /E\.bendSrc\.connect\(mo\.detune\)/.test(V));
check("engine: organ = osc A plays the drawbars' PeriodicWave an octave down + a key click; strings = the zone's made note from a buffer, played to the key",
  /add\("a", wave\(p\.aWave\), uni, i, pw \? f \/ 2 : f, p\.aLvl \/ Math\.sqrt\(uni\), pw\)/.test(V) && /this\.ctx\.createPeriodicWave\(d\.real, d\.imag\)/.test(V)
  && /bs\.playbackRate\.value = Math\.pow\(2, \(mm - zb\.root\) \/ 12\)/.test(V) && /ZMAX = 48/.test(V) && /var ZB = new Map\(\)/.test(V) && /cg\.gain\.setTargetAtTime\(0, t \+ 0\.001, 0\.004\)/.test(V));
check("engine: soft notes darker (fVel), a string note never slides in mono (re-plucked), the click never ends the voice early",
  /if \(p\.fVel > 0 && vel != null\) base \*= Math\.pow\(0\.15 \+ 0\.85 \* vel, p\.fVel \* 2\.5\)/.test(V) && /if \(cur && bufTone\(p\)\) \{ E\.release\(cur, t, true\); cur = null; \}/.test(V)
  && /var lasting = v\.o\.filter\(function \(o\) \{ return o\.which !== "c"; \}\)\[0\]/.test(V));
check("the deck: a VOICE row over the keys - a button a bank (made from CATS), again = the next voice, the voice's name lit beside it; MIDI program change picks a patch",
  /<div class="syvoice" id="syVoice" role="group" aria-label="Voices"><small>VOICE<\/small><div class="syvgrid" id="syVoiceGrid"><\/div><b id="syVoiceName"[^>]*><\/b><\/div>\s*<canvas id="syPiano"/.test(H)
  && /var x = list\[\(i \+ 1\) % list\.length\];/.test(D) && /else if \(st === 0xc0\) \{ var all = allPresets\(\); if \(a < all\.length\) pickPreset\(all\[a\]\); \}/.test(D) && /g1\.label = c\[2\] \+ " " \+ c\[0\]/.test(D)
  && /function warm\(\) \{ if \(G\.E && G\.E\.warm\) G\.E\.warm\(base\(\) - 12, base\(\) \+ 48 \+ 12\); \}/.test(D));
check("the tab is the EDIT BOOTH: the Audio docker's tab, its header, its extension name, Audio's tip; synthinst.js loads before synthcore.js",
  require(path.join(ROOT, "static/audiodock.js")).TABS.synthdock.name === "Edit Booth" && EJ.name === "Edit Booth" && /▾ Edit Booth<button/.test(H)
  && /Music, SFX and Edit Booth as its tabs/.test(src("static/index.html")) && EJ.scripts[0] === "synthinst.js" && EJ.scripts[1] === "synthcore.js");
check("nothing added to misc/server.js; the version is 2.972.0 or later", !/synthinst|Edit Booth/.test(src("misc/server.js")) && require("../package.json").version >= "2.972.0");

console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
