#!/usr/bin/env node
// bitGen Studio 2.956.0 - 🎹 the Synth tab's .sfx files: keyboard / looper takes saved on stop (_key_ / _loop_ + a random name),
// the timeline saved as <name>.sfx (💾 Save asks a name once, then writes over; Save as…), 🗂 Load any file anywhere.
// Tim: "when record button is pressed in keyboard or looper , save the file on stop. allow the synth or keyboard to load any of the
// saved files. save the timeline file as filename.sfx, looper files _loop_ random name.sfx and keyboard as _key_random name.sfx.
// add a save button to timeline, if save does not have a filename ask for filename(dialog) , if it does have a filename overwrite
// the file loaded. add a save as button." Browser test: scripts/test-ui956-ui.js.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const SFL = require("../ext/synthdock/synthfile.js"), SF = require("../lib/synthFiles.js");
let seed = 0; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
check("randomName(): _loop_ / _key_ + a word-word-number name", /^_loop_[a-z]+-[a-z]+-\d\d$/.test(SFL.randomName("_loop_", rnd)) && /^_key_[a-z]+-[a-z]+-\d\d$/.test(SFL.randomName("_key_")));
check("pack() / check(): {format bitgen-synth, v 1, kind tl | loop | key}", SFL.check(SFL.pack("tl", { tl: {} })) === "tl" && SFL.check(SFL.pack("key", {})) === "key" && SFL.check({ format: "x", kind: "tl" }) === null && SFL.check(SFL.pack("song", {})) === null);
check("safe(): .sfx added, no folders, odd characters dropped", SF.safe("my song") === "my song.sfx" && SF.safe("../../x/evil.sfx") === "evil.sfx" && SF.safe("a<b>|c.sfx") === "abc.sfx" && SF.safe("") === "" && SF.safe("...") === "" && SF.safe(".hidden") === "");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t956-")); SF.setDir(tmp);
const d = SFL.pack("tl", { tl: { layers: [] } });
const w1 = SF.write("song", d, false), w2 = SF.write("song", d, false), w3 = SF.write("song", d, true), w4 = SF.write("x", { kind: "tl" }, false);
check("write(): a new file; the same name again = 409 (there already) unless overwrite; not a synth file = 400", w1.name === "song.sfx" && w2.status === 409 && w3.overwrote && w4.status === 400, [w1, w2, w3, w4]);
SF.write("_loop_a-b-12", SFL.pack("loop", { loop: {} }), false); SF.write("_key_c-d-34", SFL.pack("key", { abc: "" }), false);
fs.writeFileSync(path.join(tmp, "_loop_broken.sfx"), "{nope");
const L = SF.list();
check("list(): every .sfx with its kind (a damaged one by its name), newest first", L.length === 4 && L.find((f) => f.name === "song.sfx").kind === "tl" && L.find((f) => f.name === "_key_c-d-34.sfx").kind === "key" && L.find((f) => f.name === "_loop_broken.sfx").kind === "loop", L);
let threw = null; try { SF.read("_loop_broken"); } catch (e) { threw = e; }
check("read(): the JSON (name and saved time stamped in); a damaged / missing one throws", SF.read("song").kind === "tl" && SF.read("song").name === "song.sfx" && !!SF.read("song").saved && !!threw && (() => { try { SF.read("nope"); return false; } catch (e) { return e.status === 404; } })());
check("remove()", SF.remove("song").name === "song.sfx" && SF.remove("song").status === 404);
SF.setDir(null);
const RS = src("routes/synth.js"), JS = src("ext/synthdock/synthdock.js"), DH = src("ext/synthdock/dock.html"), EJ = JSON.parse(src("ext/synthdock/ext.json"));
check("routes: GET /api/synth/files (+ /:name), POST /api/synth/files {name, data, overwrite}, POST /api/synth/files/delete", ["app.get(\"/api/synth/files\"", "app.get(\"/api/synth/files/:name\"", "app.post(\"/api/synth/files\"", "app.post(\"/api/synth/files/delete\""].every((x) => RS.includes(x)));
check("synthfile.js loads before the station", EJ.scripts.indexOf("synthfile.js") >= 0 && EJ.scripts.indexOf("synthfile.js") < EJ.scripts.indexOf("synthdock.js"));
check("saved on stop: the keyboard (onTake -> autoSave key: sheet + patch + take) and the looper (autoSave loop: the loop + take) - the WAV and the .sfx share the random name",
  /onTake: function \(t, abc\) \{ autoSave\("key", t,/.test(JS) && /onTake: function \(t\) \{ autoSave\("loop", t,/.test(JS) && /var base = FL\.randomName\("_" \+ kind \+ "_"\)/.test(JS) && /base \+ "\.wav"/.test(JS) && /postFile\(base, FL\.pack\(kind/.test(JS)
  && /O\.onTake\(Z\.take, Z\.abc\)/.test(src("ext/synthdock/synthscore.js")) && /if \(O\.onTake\) O\.onTake\(t\)/.test(src("ext/synthdock/synthloop.js")));
check("the timeline: 💾 Save writes over its file, else asks (nameDialog); Save as… always asks; a name that is there asks before writing over",
  /var named = \(!as && G\.tlFile\) \? Promise\.resolve\(\{ name: G\.tlFile, over: true \}\)/.test(JS) && /FL\.nameDialog\(/.test(JS) && /r\.status === 409/.test(JS) && /FL\.confirm\(\{ title: "Overwrite\?"/.test(JS)
  && ["syTName", "syTSave", "syTSaveAs", "syTLoad", "syLLoad", "syDkLoad"].every((id) => DH.includes('id="' + id + '"')));
check("🗂 Load: any file, anywhere - applied by its kind (key: sheet + patch + take; loop: the loop + take; tl: the whole tab + its file name)",
  /function applyFile\(f, name\)/.test(JS) && /if \(k === "key"\)/.test(JS) && /else if \(k === "loop"\)/.test(JS) && /G\.tlFile = name; LS\.set\("tlfile", name\)/.test(JS) && !/window\.prompt|root\.prompt\(/.test(JS + src("ext/synthdock/synthfile.js")));
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
