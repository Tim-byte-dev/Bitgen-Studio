#!/usr/bin/env node
/* bitGen Studio — 2.433.0 units: the 🎤 Karaoke docker's word NUDGES and the line under the preview marker
 * (ext/timelinedock/kgnudge.js) + karaokegen.js's wiring.
 * Tim: "in karaoke docker add a nudge left and nudge right button to each word in the timing. if the user ctrl+click the
 * button then nudge all the following words by the same amount, shift+ctrl+click all the words following and the word
 * we are editing will be nudged by the larger nudge setting . shift+click will nudge the single word by the larger
 * nudge - highlight the line of words that the marker is over". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const K = require(path.join(ROOT, "ext", "timelinedock", "kgnudge.js"));
const mk = () => [["one", 0.5, 0], ["two", 1.2, 0], ["three", 2, 1], ["four", 2.8, 1], ["five", 3.6, 1]].map(([t, s, l]) => ({ text: t, start: s, end: Math.round((s + 0.4) * 100) / 100, line: l }));

check("plan: click = the nudge, this word; Shift = the larger; Ctrl / ⌘ = + every word after it; ◀ = negative",
  JSON.stringify(K.plan({}, 1, 0.05, 0.25)) === '{"amount":0.05,"following":false}' && JSON.stringify(K.plan({ shiftKey: true }, -1, 0.05, 0.25)) === '{"amount":-0.25,"following":false}'
  && JSON.stringify(K.plan({ ctrlKey: true }, 1, 0.1, 0.5)) === '{"amount":0.1,"following":true}' && JSON.stringify(K.plan({ shiftKey: true, metaKey: true }, -1, 0.1, 0.5)) === '{"amount":-0.5,"following":true}');
check("...no / bad settings = 0.05 / 0.25", K.plan({}, 1).amount === 0.05 && K.plan({ shiftKey: true }, 1, "x", 0).amount === 0.25);
let w = mk(), m = K.nudge(w, 1, 0.05, false);
check("nudge one word: start and end together (2 decimals), nothing else", m.join() === "1" && w[1].start === 1.25 && w[1].end === 1.65 && w[0].start === 0.5 && w[2].start === 2);
w = mk(); m = K.nudge(w, 2, -0.25, true);
check("nudge it and every word after it", m.join() === "2,3,4" && w[2].start === 1.75 && w[3].start === 2.55 && w[4].start === 3.35 && w[4].end === 3.75 && w[1].start === 1.2);
w = mk(); m = K.nudge(w, 0, -2, true);
check("...never before 0 s: the move is cut short for all of them (the spacing kept)", w[0].start === 0 && w[1].start === 0.7 && w[4].start === 3.1 && m.length === 5);
w = mk(); w[0].start = 0; w[0].end = 0.4;
check("...already at 0 = nothing moves; bad index / 0 = nothing", K.nudge(w, 0, -0.1, false).length === 0 && K.nudge(w, 9, 0.1, false).length === 0 && K.nudge(w, 1, 0, false).length === 0);
w = mk();
check("wordAt: the word being sung; a pause = -1", K.wordAt(w, 1.3) === 1 && K.wordAt(w, 0.1) === -1 && K.wordAt(w, 3.7) === 4 && K.wordAt(w, 6) === -1);
check("lineAt: the sung word's line; else the next line starting within 1.5 s; else none", K.lineAt(w, 2.9).line === 1 && K.lineAt(w, 0.6).line === 0 && K.lineAt(w, 0.1).line === 0 && K.lineAt(w, 9) === null && K.lineAt([], 1) === null);
const KG = read("ext", "timelinedock", "karaokegen.js"), EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("ext.json: kgnudge.js right before karaokegen.js", EXT.indexOf("kgnudge.js") === EXT.indexOf("karaokegen.js") - 1);
check("karaokegen: ◀ ▶ on every word (data-nd), the nudge + larger nudge boxes kept (kg.nudge / kg.nudgeBig), the click's plan with its direction",
  /data-nd="-1"/.test(KG) && /data-nd="1"/.test(KG) && /id="kgNudge"/.test(KG) && /id="kgNudgeBig"/.test(KG) && /sset\(id === "kgNudge" \? "kg\.nudge" : "kg\.nudgeBig"/.test(KG) && /KGN\(\)\.plan\(e, dir,/.test(KG));
check("...the line under the marker lit (.nowln on all its words) and the 👁 draft draws the same line", /classList\.add\("nowln"\)/.test(KG) && /var la = KGN\(\) \? KGN\(\)\.lineAt\(ws, st\) : null;/.test(KG));
check("server.js untouched", !/kgnudge|nowln/.test(read("misc/server.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
