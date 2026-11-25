#!/usr/bin/env node
// bitGen Studio 2.955.0 - 🎹 the Synth tab: → 🎞 send the keyboard's / the looper's last take to a new timeline layer, ⏺ Rec in the
// looper, drag sounds from the gallery / assets / references onto the timeline (this layer or a new one?), 📂 Open → new layer,
// the tab's parts as dockers that fold. Tim: "add a send to timeline button in keyboard, send last recorded piece, add a record
// button to looper and send button to send last recorded piece to timeline, allow user to drag audio from gallery, assets,
// reference to timeline ask if track goes on the layer it is dragged to or create a new layer. allow user to open audio file to new
// layer, make the keyboard and looper panels into collapsible dockers inside the synth tab". Browser test: test-ui955-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const R = require("../ext/synthdock/synthrec.js");
const a = new Float32Array(48000), b2 = new Float32Array(48000); a[24000] = 0.5; b2[30000] = 0.2;
const t = R.trimLead([a, b2], 48000);
check("trimLead(): the silence before the first sound cut (10 ms kept), every channel the same length; all silence = nothing",
  t[0].length === 48000 - 24000 + 480 && t[1].length === t[0].length && t[0][480] === 0.5 && R.trimLead([new Float32Array(100)], 48000)[0].length === 0, t[0].length);
const EJ = JSON.parse(src("ext/synthdock/ext.json")), DH = src("ext/synthdock/dock.html"), RJ = src("ext/synthdock/synthrec.js"), LJ = src("ext/synthdock/synthloop.js"),
  SJ = src("ext/synthdock/synthscore.js"), TJ = src("ext/synthdock/synthtl.js"), JS = src("ext/synthdock/synthdock.js"), IX = src("static/index.html");
check("ext.json: synthrec.js before the looper and the score", EJ.scripts.indexOf("synthrec.js") >= 0 && EJ.scripts.indexOf("synthrec.js") < EJ.scripts.indexOf("synthloop.js"));
check("the recorder: plain samples (a ScriptProcessor tap, silent to the speakers), no codec", /createScriptProcessor\(4096, 2, 2\)/.test(RJ) && /mute\.gain\.value = 0/.test(RJ) && !/MediaRecorder/.test(RJ));
check("the keyboard: ● records the synth's sound beside the sheet (the lead silence cut); → 🎞 (#syScSend, off until a take) sends it",
  /H3SynthRec\.create\(E\.ctx, E\.out\)/.test(SJ) && /Z\.krec\.stop\(\{ trim: true \}\)/.test(SJ) && /id="syScSend"[^>]*disabled/.test(DH) && /O\.send\(Z\.take, "Keys take"\)/.test(SJ));
check("the looper: its own bus (rows + every pad); ⏺ Rec (#syLRec) starts the loop and records the bus, ⏺ / ■ end the take; → 🎞 Timeline (#syLSend)",
  /function out\(\) \{ var ctx = O\.ctx\(\); if \(!bus/.test(LJ) && !/voice\(ctx, O\.dest\(\)/.test(LJ) && /R\.rec = root\.H3SynthRec\.create\(ctx, out\(\)\)/.test(LJ) && /R\.rec\.start\(\); play\(true\)/.test(LJ)
  && /if \(R\.rec && R\.rec\.on\(\)\) \{ S\.playing = false; endRec\(\); \}/.test(LJ) && /id="syLRec"/.test(DH) && /id="syLSend"[^>]*disabled/.test(DH) && /dest: function \(\) \{ return LP\.bus\(\); \}/.test(JS));
check("a take -> a WAV in 📂 My samples -> a new layer named for it at the playhead", /function sendTake\(take, label\)/.test(JS) && /C\.wav\(take\.chans, take\.sampleRate\)/.test(JS) && /TL\.addNewLayer\(src, label\)/.test(JS) /* 2.956.0: the take's own saved WAV when it has one */);
check("drops on the timeline: ＋ Sound, the app's drags (gallery = out:, assets / references = snd:), several at once (h3multi), files; then a box - here / a new layer / ✕",
  /function dropped\(e\)/.test(TJ) && /it\.type === "output" \? "out:" \+ it\.name : it\.type === "asset" \? "snd:" \+ it\.name/.test(TJ) && /typeof dragPayload !== "undefined"/.test(TJ) && /text\/h3multi/.test(TJ)
  && /function ask\(cx, cy, li, name, done\)/.test(TJ) && /data-w=\\"here\\"/.test(TJ) && /data-w=\\"new\\"/.test(TJ));
check("the references' sounds drag like a sound asset (index.html)", /el\.draggable = true;\s*el\.ondragstart = \(ev\) => \{ dragPayload = \{ type: "asset", kind: "sound", name: n \}; ev\.dataTransfer\.setData\("text\/plain", n\); \};/.test(IX));
check("📂 Open → new layer (#syTOpen + #syTOpenFile): each file on a layer of its own", /id="syTOpen"/.test(DH) && /id="syTOpenFile"[^>]*multiple/.test(DH) && /addNewLayer\("my:" \+ a\.name/.test(TJ));
check("the parts fold: Synth / Keyboard / Looper / Timeline title bars (buttons, aria-expanded), kept in h3.synth.fold",
  /\["rack", "syRack", "🎛 Synth"\], \["keys", "syDeck", "🎹 Keyboard"\], \["loop", "\.syloop", "🥁 Looper"\], \["tl", "syTL", "🎞 Timeline"\]/.test(JS) && /h\.setAttribute\("aria-expanded"/.test(JS)
  && /LS\.set\("fold", JSON\.stringify\(f\)\)/.test(JS) && /\.sysec\.folded \.sysecbody \{ display: none; \}/.test(DH));
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
