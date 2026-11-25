#!/usr/bin/env node
// bitGen Studio 2.957.0 - 🎹 the Cakewalk-style three (Tim: "go with your suggestion"): note clips + a piano roll, clip editing
// (split, duplicate, fades, automatic crossfades, gain), undo / redo across the Synth tab. Browser test: test-ui957-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require("../ext/synthdock/synthtlcore.js"), RL = require("../ext/synthdock/synthroll.js"), U = require("../ext/synthdock/synthundo.js");
const nc = { kind: "notes", name: "n", start: 1, len: 2, off: 0, gain: 1, fi: 0, fo: 0, notes: [{ m: 60, t: 0, d: 0.5, v: 0.8 }, { m: 62, t: 0.8, d: 0.6, v: 0.8 }, { m: 64, t: 1.5, d: 0.4, v: 1 }] };
const sp = T.splitClip(nc, 2);
check("split a note clip: the notes go to the side they start on; one crossing the cut ends there", sp[0].len === 1 && sp[1].start === 2 && sp[0].notes.length === 2 && Math.abs(sp[0].notes[1].d - 0.2) < 1e-9 && sp[1].notes.length === 1 && sp[1].notes[0].t === 0.5);
const ac = { src: "kit:kick", start: 0, off: 0.2, len: 2, gain: 0.5, fi: 0.3, fo: 0.4 }, sa = T.splitClip(ac, 1);
check("split an audio clip: the right half plays on from the cut (offset), the fades stay on the outside", sa[0].len === 1 && sa[1].off === 1.2 && sa[0].fi === 0.3 && sa[0].fo === 0 && sa[1].fi === 0 && sa[1].fo === 0.4 && T.splitClip(ac, 0) === null && T.splitClip(ac, 5) === null);
check("duplicate: a copy right after it", T.dupClip(ac).start === 2 && T.dupClip(ac).off === 0.2);
const fx = T.fades([{ start: 0, len: 2, fi: 0, fo: 0 }, { start: 1.5, len: 2, fi: 0, fo: 0.1 }, { start: 5, len: 1, fi: 0.2, fo: 0 }]);
check("fades: an overlap is a crossfade (the earlier fades out, the later in, over the overlap); its own fades kept", fx[0].fo === 0.5 && fx[1].fi === 0.5 && fx[1].fo === 0.1 && fx[2].fi === 0.2, fx);
const pts = T.clipEnv({ len: 2, gain: 0.5 }, 0.2, 0.3);
check("the clip's gain line: 0 -> gain over the fade in, gain, -> 0 over the fade out; envAt reads it", JSON.stringify(pts) === "[[0,0],[0.2,0.5],[1.7,0.5],[2,0]]" && T.envAt(pts, 0.1) === 0.25 && T.envAt(pts, 1) === 0.5 && Math.abs(T.envAt(pts, 1.85) - 0.25) < 1e-9
  && JSON.stringify(T.clipEnv({ len: 1, gain: 1 }, 0, 0)) === "[[0,1],[1,1]]");
check("quantize: onto the grid (strength 1), half way at 0.5; cleanNotes keeps them safe and in order",
  JSON.stringify(T.quantize([{ m: 60, t: 0.13, d: 0.2, v: 1 }], 0.25, 1)) === JSON.stringify([{ m: 60, t: 0.25, d: 0.25, v: 1 }]) && Math.abs(T.quantize([{ m: 60, t: 0.2, d: 0.25, v: 1 }], 0.25, 0.5)[0].t - 0.225) < 1e-9
  && JSON.stringify(T.cleanNotes([{ m: 200, t: 2, d: 0, v: 9 }, { m: 60, t: 1 }, null, { t: 1 }])) === JSON.stringify([{ m: 60, t: 1, d: 0.25, v: 0.8 }, { m: 127, t: 2, d: 0.01, v: 1 }]));
const cl = T.cleanTL({ layers: [{ clips: [nc, { src: "kit:kick", start: 0, len: 1, gain: 7, fi: 3, fo: -1 }, { kind: "notes", notes: "x" }] }] }).layers[0].clips;
check("cleanTL keeps note clips (notes cleaned, the patch) and every clip's gain 0-2 and fades within the clip", cl.length === 3 && cl[0].kind === "notes" && cl[0].notes.length === 3 && cl[1].gain === 2 && cl[1].fi === 1 && cl[1].fo === 0 && cl[2].notes.length === 0);
check("schedule: note clips too (kind, how far in)", (() => { const tl = T.newTL(); tl.layers[0].clips.push(nc); const s = T.schedule(tl, 1.5); return s.length === 1 && s[0].kind === "notes" && s[0].skip === 0.5; })());
check("the piano roll's noteAt: the note under (t, pitch), its edge", JSON.stringify(RL.noteAt(nc.notes, 0.9, 62, 0.1)) === JSON.stringify({ i: 1, edge: false }) && RL.noteAt(nc.notes, 1.35, 62, 0.1).edge === true && RL.noteAt(nc.notes, 0.9, 61, 0.1) === null
  && JSON.stringify(RL.clampNote({ m: 130.4, t: -1, d: 0 }, 2)) === JSON.stringify({ m: 127, t: 0, d: 0.02 }));
// undo: quietMs 0 = every touch a step
let st = { a: 1 }; const u = U.create({ get: () => st, set: (s2) => { st = s2; }, quietMs: 0 });
st = { a: 2 }; u.touch(); st = { a: 3 }; u.touch();
const u1 = u.undo(), s1 = st.a, u2 = u.undo(), s2 = st.a, u3 = u.undo(); u.redo(); const s3 = st.a; st = { a: 9 }; u.touch();
check("undo / redo: steps back and forward; a new change drops the steps ahead; nothing left = false", u1 && s1 === 2 && u2 && s2 === 1 && !u3 && s3 === 2 && !u.canRedo() && u.size().past === 2, { s1, s2, s3, size: u.size() });
const u4 = U.create({ get: () => st, set: (s5) => { st = s5; u4.touch(); }, quietMs: 0 }); st = { a: 10 }; u4.touch(); u4.undo();
check("…a restore is never a new step (set() while it restores is ignored)", u4.size().past === 0 && u4.size().future === 1);
const DH = src("ext/synthdock/dock.html"), JS = src("ext/synthdock/synthdock.js"), TJ = src("ext/synthdock/synthtl.js"), EJ = JSON.parse(src("ext/synthdock/ext.json"));
check("ext.json: synthroll.js after the timeline, synthundo.js before the station", EJ.scripts.indexOf("synthroll.js") > EJ.scripts.indexOf("synthtl.js") /* 2.965.0: synthsing.js between */ && EJ.scripts.indexOf("synthundo.js") < EJ.scripts.indexOf("synthdock.js"));
check("buttons: ↶ ↷ (#syUndo / #syRedo), ＋ ♪ Notes, → 🎞 ♪ (#syScSendN); the clip bar: ✂ Split, ⧉ Duplicate, 🎹 Piano roll",
  ["syUndo", "syRedo", "syTNotes", "syScSendN"].every((id) => DH.includes('id="' + id + '"')) && /"syTSplit"/.test(TJ) && /"syTDup"/.test(TJ) && /"syTRollBtn"/.test(TJ));
check("the timeline plays note clips with the synth (an engine per clip, the clip's patch) and every clip through its gain line", /new V\.Engine\(ctx, \{ dest: g \}\)/.test(TJ) && /T\.clipEnv\(c, Math\.max\(f\.fi, 0\.005\), Math\.max\(f\.fo, 0\.005\)\)/.test(TJ) && /T\.fades\(l\.clips\)/.test(TJ));
check("keys: S = split, Ctrl+D = duplicate (the timeline); Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z = undo / redo (the tab); Esc closes the piano roll before the full window",
  /k === "s" && !e\.ctrlKey/.test(TJ) && /k === "d" && \(e\.ctrlKey/.test(TJ) && /k === "z" && !e\.shiftKey/.test(JS) && /k === "y" \|\| \(k === "z" && e\.shiftKey\)/.test(JS) && /if \(\$\("syRollBack"\) \|\| (?:\$\("syStepBack"\) \|\| )?\$\("syDlg"\)/.test(JS));
check("undo covers the timeline, the loop, the knobs, the pads; every change touches it", /get: function \(\) \{ return \{ tl: TL \? TL\.tl\(\) : null, loop: LP\.loop\(\), patch: G\.p, pads:/.test(JS) && (JS.match(/touch\(\);/g) || []).length >= 4);
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
