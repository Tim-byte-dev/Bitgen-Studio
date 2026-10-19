// scripts/test-channels.js — 2.467.0: CHANNEL EDITING + SPOT CHANNELS (ext/imageeditdock/pcchannels.js, the Channels
// panel in pcrefine.js, imageedit.js's endPx): only the targeted colour channels change; spot inks; the wiring.
// Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor" - the gap row
// "editing a single colour channel's pixels; spot channels".
"use strict";
const fs = require("fs"), path = require("path");
const C = require("../ext/imageeditdock/pcchannels.js");
const ROOT = path.join(__dirname, "..");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra).slice(0, 500))); if (!ok) fail++; };

check("targetOf: \"r\" / \"rg\" / \"rgb\" / a set", JSON.stringify(C.targetOf("r")) === '{"r":true,"g":false,"b":false}' && C.all(C.targetOf("rgb")) && C.all(C.targetOf("")) && JSON.stringify(C.targetOf(new Set(["g", "b"]))) === '{"r":false,"g":true,"b":true}');
const before = Uint8ClampedArray.from([10, 20, 30, 255, 40, 50, 60, 128]), after = Uint8ClampedArray.from([200, 200, 200, 0, 0, 0, 0, 255]);
C.keepChannels(before, after, C.targetOf("r"));
check("keepChannels (red targeted): only red takes the edit; green, blue and the alpha stay", JSON.stringify([...after]) === "[200,20,30,255,0,50,60,128]", [...after]);
const a2 = Uint8ClampedArray.from([1, 2, 3, 4]);
check("...all targeted: the edit as it is", JSON.stringify([...C.keepChannels(Uint8ClampedArray.from([9, 9, 9, 9]), a2, null)]) === "[1,2,3,4]");
const ink = C.inkOf(Uint8Array.from([255, 128, 0]), "#00a0ff", 50);
check("inkOf: the spot colour, alpha = density x solidity", JSON.stringify([...ink.slice(0, 8)]) === "[0,160,255,128,0,160,255,64]" && ink[11] === 0, [...ink]);
const over = C.overInk(Uint8ClampedArray.from([255, 255, 255, 255, 255, 255, 255, 255]), Uint8Array.from([255, 0]), "#000000", 100);
check("overInk: full ink at 100% covers; no ink leaves the picture", JSON.stringify([...over]) === "[0,0,0,255,255,255,255,255]");
const v1 = C.viewOf(Uint8ClampedArray.from([10, 20, 30, 0]), C.targetOf("g")), v2 = C.viewOf(Uint8ClampedArray.from([10, 20, 30, 0]), C.targetOf("rb"));
check("viewOf: one channel = grey, two = those two (the third dark)", JSON.stringify([...v1]) === "[20,20,20,255]" && JSON.stringify([...v2]) === "[10,0,30,255]");

const ext = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/imageeditdock/ext.json"), "utf8")).scripts;
const IE = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/imageedit.js"), "utf8"), RF = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcrefine.js"), "utf8"), BG = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcbgi.js"), "utf8");
check("wiring: pcchannels.js right before pcrefine.js; imageedit's endPx keeps the untargeted channels (S.chTarget)", ext.indexOf("pcchannels.js") === ext.indexOf("pcrefine.js") - 1 && /S\.chTarget && win\.PCChannels && !win\.PCChannels\.all\(S\.chTarget\)/.test(IE) && /keepChannels\(a\.data, b\.data, S\.chTarget\)/.test(IE));
check("wiring: the Channels panel targets (click / Shift-click / Ctrl+3-5), paints an alpha / spot channel (✎ / ✔ through the quick-mask canvas), New Spot Channel…, Merge Spot Channel, the spot inks drawn over the picture", /function targetCh\(k, toggle\)/.test(RF) && /function editChannel\(id\)/.test(RF) && /function endEditChannel\(keep\)/.test(RF) && /id="chSpotB"/.test(RF) && /id="chEditB"/.test(RF) && /id="chMergeB"/.test(RF) && /C\("ch\.spot", "New Spot Channel…"/.test(RF) && /C\("ch\.mergespot", "Merge Spot Channel"/.test(RF) && /E\.overlayHooks\.splice\(1, 0,/.test(RF) && /targetCh\(k, false\)/.test(RF));
check("wiring: a .bgi keeps a spot channel's ink colour + solidity", /c\.spot \? \{ spot: clone\(c\.spot\) \}/.test(BG) && /c\.spot \? \{ spot: \{ color: String\(c\.spot\.color/.test(BG));
console.log(fail ? `\n${fail} FAILED` : "\nall channel checks passed");
process.exit(fail ? 1 : 0);
