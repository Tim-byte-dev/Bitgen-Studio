#!/usr/bin/env node
// bitGen Studio 2.973.0 - the 🎹 Edit Booth timeline's ▶ (Tim: "the play button doen't work for edit booth timeline, but add a
// dropdown to the left of the play button All and layer so either play all or only the selected layer, if no layer is selected
// play all. if keyboard and looper are playing let them play, both of their volumes are adjustable"). The pure parts and the
// pins; the browser leg (a missing file, All / Layer by each layer's meter, the looper and keys going on) is test-ui973-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require(path.join(ROOT, "ext/synthdock/synthtlcore.js"));
check("fmt: rounded to tenths first - 239.97 s = 4:00.0 (was 3:60.0), 59.96 = 1:00.0, 61.24 = 1:01.2", T.fmt(239.97) === "4:00.0" && T.fmt(59.96) === "1:00.0" && T.fmt(61.24) === "1:01.2" && T.fmt(-3) === "0:00.0" && T.fmt(9.95) === "0:10.0", [T.fmt(239.97), T.fmt(9.95)]);
const tl = T.cleanTL({ layers: [{ name: "A", clips: [{ src: "kit:kick", start: 0, len: 1 }] }, { name: "B", mute: true, clips: [{ src: "kit:snare", start: 0, len: 1 }] }, { name: "C", solo: false, clips: [{ src: "kit:clap", start: 0, len: 1 }] }] });
check("schedule(tl, from, force): force = the layers played whatever their mute / solo say (▶ Layer); without it mute counts as before",
  T.schedule(tl, 0).map((s) => s.layer).join() === "0,2" && T.schedule(tl, 0, 1).map((s) => s.layer).join() === "1" && T.schedule(tl, 0, [0, 1]).map((s) => s.layer).join() === "0,1");
const TJ = src("ext/synthdock/synthtl.js"), D = src("ext/synthdock/dock.html"), LJ = src("ext/synthdock/synthloop.js"), SD = src("ext/synthdock/synthdock.js");
check("THE FIX: a sound that cannot be read no longer stops ▶ - the rest plays, the missing ones are said, kept in S.missing, drawn struck through",
  /return load\(n\)\.then\(function \(b\) \{ delete S\.missing\[n\]; return \[n, b\]; \}, function \(\) \{ S\.missing\[n\] = true; return \[n, null\]; \}\)/.test(TJ)
  && /not there any more - skipped \(drawn struck through\)/.test(TJ) && /var gone = !c\.kind && S\.missing\[c\.src\];/.test(TJ) && /"⚠ missing: "/.test(TJ));
check("All / Layer: the dropdown just left of ▶ Play; Layer = the picked layer alone (forced - heard even if muted), nothing picked = all; kept (h3.synth.tl.what)",
  /<select id="syTWhat"[^>]*><option value="all">All<\/option><option value="layer">Layer<\/option><\/select>\s*<button class="ghost" id="syTPlay"/.test(D)
  && /function playOnly\(\) \{ return playWhat\(\) === "layer" && S\.picked && S\.sel >= 0 && S\.sel < TLD\.layers\.length \? S\.sel : null; \}/.test(TJ)
  && /S\.only = S\.rec \? null : playOnly\(\);/.test(TJ) && /mixInto\(ctx, O\.dest\(\), from, at, bufs, S\.only, S\.only != null\)/.test(TJ) && /mixInto\(ctx, O\.dest\(\), AB\.a, at2, S\.bufs, S\.only, S\.only != null\)/.test(TJ)
  && /"h3\.synth\.tl\.what"/.test(TJ) && /"Layer \(none picked = all\)"/.test(TJ));
check("picked = a click on a layer's name or in its lane (or select()); a new / loaded timeline = nothing picked",
  /S\.sel = i; S\.picked = true; paintWhat\(\);/.test(TJ) && /if \(h\.l != null && h\.l >= 0\) \{ S\.picked = true;/.test(TJ) && /S\.picked = false; S\.missing = \{\};/.test(TJ));
check("▶ / ■ never touch the keyboard or the looper (stop() tears down the timeline's own nodes only)",
  !/LP\.play\(false\)|O\.loop\.play|allOff/.test(TJ.slice(TJ.indexOf("function play()"), TJ.indexOf("function paintPlay()"))));
check("the looper's own volume: a Vol knob in its bar (rows + pads, 0-150 %, h3.synth.lvol) on its bus; the keyboard keeps its VOLUME knob",
  /<span id="sySwingK"><\/span>\s*<span id="syLVolK"><\/span>/.test(D) && /bus\.gain\.value = lvol;/.test(LJ) && /"h3\.synth\.lvol"/.test(LJ) && /aria-label", "Looper volume"/.test(LJ) && /id="syDkVol"/.test(D));
check("Space: the timeline when the timeline has the focus, else the looper (as before)", /if \(TL && e\.target\.closest && e\.target\.closest\("#syTL"\)\) TL\.toggle\(\); else LP\.play\(\);/.test(SD));
check("nothing in misc/server.js; version 2.973.0 or later", !/syTWhat|lvol/.test(src("misc/server.js")) && require("../package.json").version >= "2.973.0");
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
