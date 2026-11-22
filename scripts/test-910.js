#!/usr/bin/env node
// bitGen Studio 2.910.0 - the 📱 bitGen app: 🎵 music (Tim: "add music") and the Galaxy Z Fold layout ("make the app
// resizable, i have a galaxy fold z , i would like to be able to use it in compact mode and fullscreen mode").
// Run: node scripts/test-910.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// the PC side
const A = require("../lib/appApi");
const info = A.info();
const ace = (info.music_styles || []).find((m) => /ACE-Step/.test(m.name));
check("/api/app/info lists the music styles with their sound words, length and the engine's limit", Array.isArray(info.music_styles) && ace && /indie pop/i.test(ace.caption) && ace.seconds === 120 && ace.max_seconds >= 120, ace);
check("…and the PC's last music style", "music" in info.ui);
const T = require("../lib/timeEstimate");
const f = T.features({ mode: "music", style_id: "m", max_duration: 60, style: { id: "m", max_duration: 120 } });
check("timeEstimate.features: a song's length is its max_duration (60 s = 1440 units), kind music", f.kind === "music" && f.frames === 1440 && f.style === "m", f);
check("…the style's own length when the job has none", T.features({ mode: "music", style: { id: "m", max_duration: 30 } }).frames === 720);
const TE = require("../static/timeest.js");
check("the studio's ⏱ follows 🎶 Music too (the Music dock's duration)", JSON.stringify(TE.requestOf({ mode: "audio", mstyle: "m", mname: "ACE", mdur: "90" })) === JSON.stringify({ kind: "music", style: "m", name: "ACE", seconds: 90 }));

// the app
const html = src("mobile/www/index.html"), js = src("mobile/www/app.js"), css = src("mobile/www/app.css");
check("app: 🎵 Music in Create (sound, title, seconds, file) and the Gallery's Music tab", /data-kind="music"/.test(html) && /id="muCaption"/.test(html) && /id="muTitle"/.test(html)
  && /id="muSecs"/.test(html) && /id="muFormat"/.test(html) && /data-g="audio"/.test(html));
check("app: a song goes to /api/genmusic with the lyrics, sound, length, title and file type", /api\("\/api\/genmusic"/.test(js) && /mb\.caption = cap/.test(js) && /mb\.max_duration = secs/.test(js) && /mb\.title = ttl/.test(js) && /format: \$\("muFormat"\)\.value/.test(js));
check("app: the Gallery plays a song (<audio> - 2.915.0: with a visualisation, showSong)", /if \(k === "audio"\) return showSong\(u, name\)/.test(js) && /<audio controls autoplay playsinline>/.test(js) && /\?kind=audio/.test(js));
check("app: compact / wide by the screen's width, live (matchMedia + resize)", /matchMedia\("\(min-width: 700px\)"\)/.test(js) && /addEventListener\("resize", layout\)/.test(js) && /body\.wide #panes \{ display: grid/.test(css));
check("app: the fold's hinge - each pane on its own side (horizontal-viewport-segments), Flex mode for the viewer (vertical)", /@media \(horizontal-viewport-segments: 2\)/.test(css) && /@media \(vertical-viewport-segments: 2\)/.test(css) && /env\(viewport-segment-width 0 0/.test(css));
check("app: the phone's bars from env() or Capacitor 8's SystemBars variables", /var\(--safe-area-inset-top, 0px\)/.test(css) && /viewport-fit=cover/.test(html));
check("app: ⛶ full screen = SystemBars.hide / show, remembered", /sb\.hide\(\{\}\) : sb\.show\(\{\}\)/.test(js) && /kset\("fullscreen"/.test(js) && /id="fsBtn"/.test(html));
check("app: [hidden] beats display (the compact / music rows really hide)", /\[hidden\] \{ display: none !important; \}/.test(css));
const man = src("mobile/android/app/src/main/AndroidManifest.xml");
check("manifest: resizeable, size changes, configChanges keep the activity on fold / unfold", /android:resizeableActivity="true"/.test(man) && /android\.supports_size_changes/.test(man)
  && /configChanges="[^"]*screenSize[^"]*smallestScreenSize[^"]*screenLayout/.test(man));
for (const f2 of ["lib/appApi.js", "lib/timeEstimate.js", "static/timeest.js", "mobile/www/app.js"]) {
  const bad = src(f2).split("\n").filter((l) => /[,(+]\s*\/\/ /.test(l) && !/^\s*\/\//.test(l) && !/eslint-disable/.test(l));
  check(`${f2}: no // comment mid-expression`, !bad.length, bad);
}
console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
