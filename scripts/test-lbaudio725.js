#!/usr/bin/env node
/* bitGen Studio — 2.725.0: A SOUND IN THE PREVIEW DIALOG (static/lbaudio.js) - pure + wiring.
 * Tim (verbatim): "when user starts to play an audio show a random visualization, next button will play the next audio in
 * the docker the file was clicked in our preview dialog where we show pictures when a picture is clicked not the preview
 * docker with the button in statusbar"
 *   VIZ / CALM, pick (random, never the last look twice), nextAudio (the next / previous SOUND, pictures skipped, wrapping,
 *   the only sound = itself, none = -1), every look has its draw function (the browser test draws them); the wiring: index.html's lightbox
 *   hands its <audio> to H3LbAudio.mount and lbGo asks H3LbAudio.go first; the dialog's sound is kept out of the Preview
 *   docker's visualizer (data-noviz - ext/previewdock/audioviz.js); the Gallery / Assets / References give sounds as
 *   kind audio. The real browser: scripts/test-ui725-ui.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const A = require(path.join(ROOT, "static", "lbaudio.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

check("VIZ: six looks (bars, mirror, wave, ring, stars, ripples); CALM (reduced motion): bars, mirror, wave", JSON.stringify(A.VIZ) === JSON.stringify(["bars", "mirror", "wave", "ring", "stars", "ripples"]) && JSON.stringify(A.CALM) === JSON.stringify(["bars", "mirror", "wave"]));
let again = 0;
for (let k = 0; k < 400; k++) { const l = A.VIZ[k % 6]; if (A.pick(A.VIZ, l) === l) again++; }
check("pick: at random, never the look just shown (400 tries)", again === 0);
const got = new Set(); for (let k = 0; k < 300; k++) got.add(A.pick(A.VIZ, null));
check("…every look comes up", got.size === 6, [...got]);
check("…rnd() maps across the rest (0 -> the first that is not the last, 0.999 -> the last); one look only = that one; no list = VIZ",
  A.pick(A.VIZ, "bars", () => 0) === "mirror" && A.pick(A.VIZ, "bars", () => 0.999) === "ripples" && A.pick(["wave"], "wave", () => 0.5) === "wave" && A.VIZ.includes(A.pick(null, null)));
const L = [{ kind: "audio" }, { kind: "image" }, { kind: "audio" }, { kind: "video" }, { kind: "audio" }];
check("nextAudio: the next sound (a picture between skipped), wrapping at the end", A.nextAudio(L, 0, 1) === 2 && A.nextAudio(L, 2, 1) === 4 && A.nextAudio(L, 4, 1) === 0);
check("…the previous sound, wrapping at the start", A.nextAudio(L, 0, -1) === 4 && A.nextAudio(L, 4, -1) === 2 && A.nextAudio(L, 2, -1) === 0);
check("…from a picture: the next sound after it; the only sound = itself (it plays again); no sound / no list = -1",
  A.nextAudio(L, 1, 1) === 2 && A.nextAudio([{ kind: "audio" }, { kind: "image" }], 0, 1) === 0 && A.nextAudio([{ kind: "image" }], 0, 1) === -1 && A.nextAudio([], 0, 1) === -1);

const src = rd("static/lbaudio.js");
check("the page part has a draw function for every look", A.VIZ.every((v) => new RegExp("\\n    " + v + "\\(g, w, h, f, wv, t, H\\)").test(src)));

const H = rd("static/index.html");
check("index.html: the lightbox hands its <audio> to H3LbAudio.mount (after it is in .lbaud)", /wrap\.querySelector\("\.lbaud"\)\.appendChild\(a\);\n[^\n]*\n\s+if \(window\.H3LbAudio\) H3LbAudio\.mount\(a\);/.test(H));
check("…lbGo asks H3LbAudio.go(d) first (a sound -> the next / previous SOUND, played), else pages as before", /function lbGo\(d\) \{\n  if \(lb\.items\.length < 2\) return;\n[^\n]*\n[^\n]*\n  if \(window\.H3LbAudio && H3LbAudio\.go\(d\)\) return;\n  lb\.i = \(lb\.i \+ d/.test(H));
check("…loads static/lbaudio.js (after lbfollow.js); Prev / Next / ‹ › / ← → all go through lbGo",
  /<script src="\/static\/lbfollow\.js"><\/script>[^\n]*\n<script src="\/static\/lbaudio\.js"><\/script>/.test(H) && /\$\("lb_next"\)\.onclick = \(\) => lbGo\(1\);/.test(H) && /\$\("lb_nx"\)\.onclick = \(\) => lbGo\(1\);/.test(H) && /e\.key === "ArrowRight"\) \{ e\.preventDefault\(\); lbGo\(1\); \}/.test(H));
check("the dialog's sound is NOT the Preview docker's: mount marks it data-noviz, and audioviz.js skips data-noviz",
  /a\.dataset\.noviz = "1";/.test(src) && /el\.dataset\.noviz === "1"\) return false;/.test(rd("ext/previewdock/audioviz.js")));
check("the docks give sounds to the preview as kind audio: the Gallery's songs, Assets ▸ Sound, References' sounds",
  (H.match(/dataset\.lbKind = "audio";/g) || []).length >= 2 && /el\.dataset\.lbKind = kind === "images" \? "image" : kind === "video" \? "video" : "audio";/.test(H));
check("the play starts the look, a pause holds it (dimmed), Next autoplays (only after a click on ‹ ›)",
  /a\.addEventListener\("play", \(\) => start\(a\)\);/.test(src) && /classList\.add\("paused"\)/.test(src) && /if \(S\.autoplay\) \{ S\.autoplay = false;/.test(src) && /L\.i = j; S\.autoplay = true;/.test(src));
const UI = JSON.parse(rd("static/i18n/ui/ja.json")), ZH = JSON.parse(rd("static/i18n/ui/zh-CN.json")), TW = JSON.parse(rd("static/i18n/ui/zh-TW.json"));
const word = (d) => (d.strings || d)["Another visualization"];
check("🎲's tooltip in 日本語 / 简体中文 / 繁體中文", !!word(UI) && !!word(ZH) && !!word(TW) && /Another visualization/.test(rd("static/i18n/ui/dynamic.json")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
