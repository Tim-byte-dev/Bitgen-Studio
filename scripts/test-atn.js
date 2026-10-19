// scripts/test-atn.js — 2.469.0: PHOTOSHOP .atn ACTION FILES IN (ext/imageeditdock/pcatn.js): a synthetic .atn written
// here byte by byte the way Photoshop writes them (version 16, Unicode strings, action descriptors with units, enums,
// references, lists) is read back, mapped onto bitGen steps (filters with their settings, layer / selection commands,
// opacity + blend mode, rotate / flip, Stop) and the unmatched ones come in switched off.
// Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
"use strict";
const fs = require("fs"), path = require("path");
const T = require("../ext/imageeditdock/pcatn.js");
const A = require("../ext/imageeditdock/pcactions.js");
const ROOT = path.join(__dirname, "..");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra).slice(0, 600))); if (!ok) fail++; };

const { bytes } = require("./atn-fixture.js");
fs.writeFileSync(path.join(require("os").tmpdir(), "atn-test.atn"), bytes);

const r = T.read(bytes);
check("read: version 16, the set's name, 2 actions, their items, events (long + TEXT ids), names, dialog / enabled flags", r.version === 16 && r.name === "Photo Fix" && r.actions.length === 2 && r.actions[0].name === "Soften" && r.actions[0].fkey === 2 && r.actions[0].items.length === 6 && r.actions[1].items[5].event === "placeEvent" && r.actions[0].items[1].dialog && r.actions[1].items[6].enabled === false);
check("read: descriptors - units, longs, enums, references, nested objects and lists", r.actions[0].items[0].desc["Rds "].units === "#Pxl" && r.actions[0].items[0].desc["Rds "].value === 3.5 && r.actions[0].items[1].desc.Thsh === 3 && r.actions[0].items[3].desc["T   "]["Md  "].value === "Scrn" && r.actions[0].items[2].desc.null[0].class === "Lyr " && r.actions[0].items[5].desc.Adjs[0].Strt === -20, r.actions[0].items[3].desc);
const { set, notes } = T.toSet(r), s0 = set.actions[0].steps, s1 = set.actions[1].steps;
check("toSet: Gaussian Blur 3.5, Unsharp Mask 80 / 1.2 / 3 (stops in its dialog), Duplicate Layer, opacity 65, blend Multiply, Hue / Saturation 10 / -20 / 5", s0[0].kind === "filter" && s0[0].id === "gaussian" && s0[0].params.radius === 3.5 && s0[1].id === "unsharp" && s0[1].params.amount === 80 && s0[1].params.radius === 1.2 && s0[1].params.threshold === 3 && s0[1].modal === true
  && s0[2].kind === "cmd" && s0[2].id === "layer.dup" && s0[3].kind === "set" && s0[3].what === "opacity" && s0[3].value === 65 && s0[4].what === "blend" && s0[4].value === "multiply" && s0[5].id === "huesat" && s0[5].params.hue === 10 && s0[5].params.saturation === -20 && s0[5].params.lightness === 5, s0);
check("toSet: Rotate 90° CW, Flip Horizontal, Select All, Inverse, Stop (with Continue), Flatten (kept switched off); \"Place\" has no match - comes in switched off and named", s1[0].id === "image.rot90" && s1[1].id === "image.fliph" && s1[2].id === "sel.all" && s1[3].id === "sel.inverse" && s1[4].kind === "stop" && s1[4].msg === "Check the sky" && s1[4].cont === true
  && s1[5].kind === "stop" && s1[5].on === false && /Place/.test(s1[5].msg) && s1[6].id === "layer.flatten" && s1[6].on === false && notes.mapped === 12 && notes.skipped === 1, { s1, notes });
const norm = A.normalize([set]);
check("the set survives bitGen's own normalize (every step kept)", norm.length === 1 && norm[0].actions[0].steps.length === 6 && norm[0].actions[1].steps.length === 7);
let err = ""; try { T.read(Uint8Array.from([0, 0, 0, 12, 0, 0])); } catch (e) { err = e.message; }
let err2 = ""; try { T.read(bytes.subarray(0, 60)); } catch (e) { err2 = e.message; }
check("a file that is no .atn / cut short: a plain error", /not an .atn action file/.test(err) && /ends too early/.test(err2), [err, err2]);
const AC = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcactions.js"), "utf8"), ext = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/imageeditdock/ext.json"), "utf8")).scripts;
check("wiring: Load Actions… takes .atn (loadAtn -> PCAtn.read + toSet), pcatn.js right before pcactions.js", /loadIn\.accept = "\.json,\.atn,application\/json"/.test(AC) && /function loadAtn\(bytes, name\)/.test(AC) && /T\.toSet\(T\.read\(bytes\)\)/.test(AC) && ext.indexOf("pcatn.js") === ext.indexOf("pcactions.js") - 1);
console.log(fail ? `\n${fail} FAILED` : "\nall .atn checks passed");
process.exit(fail ? 1 : 0);
