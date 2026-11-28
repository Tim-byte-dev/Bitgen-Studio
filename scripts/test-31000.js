#!/usr/bin/env node
/* bitGen Studio — 3.10.0: the Edit Booth timeline's 🆕 New and 🧹 Clear (ext/synthdock/synthtlcore.js cleared / hasContent,
 * synthdock.js newSong / clearTL, dock.html) - pure + the wiring. In a real browser: scripts/test-ui31000-ui.js.
 * Tim: "add a "new" button to the edit booth timeline so user can work on a new song, add a clear button to clear the edit
 * booth timeline" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const T = require(path.join(ROOT, "ext/synthdock/synthtlcore.js"));

const t = T.newTL();
check("a new timeline has nothing on it", T.hasContent(t) === false && t.layers.length === 4);
t.zoom = 90; t.tempoOn = true; t.tempo = [{ t: 0, bpm: 96, ramp: false }]; t.master = 0.8;
t.layers[0].name = "Drums"; t.layers[0].vol = 1.3; t.layers[0].mute = true; t.layers[0].clips.push({ src: "kit:kick", t: 0, len: 1 });
t.layers[1].keys.push({ t: 1, v0: 0.5, v1: 1 }); t.layers[2].auto.pan.push({ t: 2, v: 0.2 }); t.layers[3].comps = { g1: 0 };
t.markers.push({ t: 3, name: "Chorus" }); t.loop = { on: true, punch: false, a: 1, b: 3 };
check("hasContent: a clip, a keyframe, a lane point or a marker", T.hasContent(t)
  && T.hasContent(Object.assign(T.newTL(), { markers: [{ t: 1, name: "x" }] }))
  && T.hasContent((() => { const x = T.newTL(); x.layers[2].auto.cut.push({ t: 1, v: 0.3 }); return x; })())
  && T.hasContent((() => { const x = T.newTL(); x.layers[1].keys.push({ t: 1, v0: 1, v1: 1 }); return x; })()));
const c = T.cleared(t);
check("🧹 cleared: no clips, keyframes, lane points, take comps or markers; the ⟳ range off", !T.hasContent(c) && c.layers.every((L) => !L.clips.length && !L.keys.length && !Object.keys(L.comps).length) && !c.markers.length && !c.loop.on, c);
check("…the layers stay (names, volume, mute), the tempo track, the master and the zoom too", c.layers.length === 4 && c.layers[0].name === "Drums" && c.layers[0].vol === 1.3 && c.layers[0].mute && c.tempoOn && c.tempo[0].bpm === 96 && c.master === 0.8 && c.zoom === 90);
check("…and the timeline it came from is untouched (a copy - ↶ Undo has the old one)", t.layers[0].clips.length === 1 && t.markers.length === 1);
check("…a cleared timeline is a clean one (cleanTL keeps it as it is)", JSON.stringify(T.cleanTL(c).layers.map((L) => [L.name, L.clips.length])) === JSON.stringify(c.layers.map((L) => [L.name, 0])));

const html = read("ext/synthdock/dock.html"), dk = read("ext/synthdock/synthdock.js");
check("🆕 New and 🧹 Clear on the timeline's bar, before the song's name and 💾 Save", /id="syTNew"[^>]*>🆕 New</.test(html) && /id="syTClear"[^>]*>🧹 Clear</.test(html) && html.indexOf('id="syTNew"') < html.indexOf('id="syTName"') && html.indexOf('id="syTClear"') < html.indexOf('id="syTSave"'));
check("New: asks first when there is something to lose; a fresh timeline (your zoom / snap kept), no file name, Save song's name blank", /function newSong\(\)/.test(dk) && /TLC\.hasContent\(TL\.tl\(\)\)/.test(dk) && /t = TLC\.newTL\(\); t\.zoom = keep\.zoom; t\.snap = keep\.snap;/.test(dk) && /G\.tlFile = ""; LS\.set\("tlfile", ""\); tlName\(\);/.test(dk) && /sySongName"\); if \(sn\) sn\.value = ""/.test(dk));
check("Clear: says when it is already empty, asks first, keeps the name", /already empty/.test(dk) && /putTL\(TLC\.cleared\(TL\.tl\(\)\)\)/.test(dk));
check("both are one ↶ Undo step (touch) and kept (the tl in localStorage)", /function putTL\(t\) \{ TL\.setTL\(t\); touch\(\); LS\.set\("tl", JSON\.stringify\(TL\.tl\(\)\)\); \}/.test(dk));
check("synthtlcore exports cleared / hasContent; it loads before synthdock.js", /cleared: cleared, hasContent: hasContent/.test(read("ext/synthdock/synthtlcore.js")) && (() => { const s = JSON.parse(read("ext/synthdock/ext.json")).scripts; return s.indexOf("synthtlcore.js") < s.indexOf("synthdock.js"); })());
console.log("\n" + pass + " passed, " + fail + " failed");
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
