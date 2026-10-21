#!/usr/bin/env node
/* bitGen Studio — 2.562.0 units: nothing plays by itself (Tim: "don't automatically play videos or music").
 * A finished job / an opened take / the running job's joined preview / the lightbox / the StoryBoard's 👁 Watch / the
 * swap dialog's preview LOAD their video or song - ▶ (or Space) plays it. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const IX = rd("static", "index.html");
const fn = (src, start, end) => { const i = src.indexOf(start); return i < 0 ? "" : src.slice(i, src.indexOf(end, i + start.length)); };

const pv = fn(IX, "function playVideo(name) {", "\n}\n");
check("playVideo (a finished job, the Done tab's output, a timeline clip): the video is loaded - never .play()", pv.length > 200 && !/\.play\(/.test(pv), pv.slice(0, 200));
const live = fn(IX, "if (j.status === \"running\" && j.preview_version > 0", "if (j.status === \"done\" && j.output)");
check("the running job's joined preview reloads without starting", live.length > 100 && !/\.play\(/.test(live), live);
check("the lightbox: video and audio open with their controls, not autoplay", !/autoplay = true/.test(IX) && (IX.match(/autoplay = false/g) || []).length === 2);
// every <video> / <audio> written in the page or a docker's html
const files = ["static/index.html"].concat(fs.readdirSync(path.join(ROOT, "ext")).flatMap((d) => { try { return fs.readdirSync(path.join(ROOT, "ext", d)).filter((f) => /\.(html|js)$/.test(f)).map((f) => "ext/" + d + "/" + f); } catch { return []; } }));
const bad = [];
for (const f of files) { const s = rd(f); const m = s.match(/<(video|audio)\b[^>]*\bautoplay\b[^>]*>/g); if (m) bad.push(f + ": " + m.join(" | ").slice(0, 120)); }
check("no <video> / <audio> tag in the page or a docker carries autoplay", bad.length === 0, bad);
const CH = rd("ext", "videodock", "characters.js"), SW = rd("static", "swapdlg.js");
const watch = fn(CH, 'el("scWatch").addEventListener("click"', "});");
check("the StoryBoard's Watch opens the take paused; the swap dialog's preview loads without starting", watch.length > 50 && !/\.play\(/.test(watch) && !/v\.src = url;\s*try \{ var pr = v\.play\(\)/.test(SW), watch);
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
