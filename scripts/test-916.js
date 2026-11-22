#!/usr/bin/env node
// bitGen Studio 2.916.0 - the 📱 app's references: pictures, videos and sounds from the camera / microphone, the phone, or the PC
// (Tim: "in the android app add a button for reference images and video and audio, user can select from phone gallery, camera
// or the pc it is connected to using the host bitgen"). Run: node scripts/test-916.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const A = require("../lib/appApi");
check("av(): reference names - bare, at most 3, an array or JSON", JSON.stringify(A.av('["a.mp4","../x/b.mp4","c.mp4","d.mp4"]')) === '["a.mp4","b.mp4","c.mp4"]' && A.av("nope").length === 0 && A.av(["s.wav"])[0] === "s.wav");
const g = A.formFor("generate", { prompt: "a kite", ref_videos: ["clip.mp4"], ref_audios: ["song.wav"] }, []);
const fv = (k) => (g.fields.find((x) => x[0] === k) || [])[1];
check("/api/generate gets ref_videos / ref_audios and ref2va (no pictures needed)", fv("mode") === "ref2va" && fv("ref_videos") === '["clip.mp4"]' && fv("ref_audios") === '["song.wav"]', g.fields);
const g0 = A.formFor("generate", { prompt: "a kite" }, []);
check("…and none = text only as before (no ref fields)", g0.fields.find((x) => x[0] === "mode")[1] === "t2va" && !g0.fields.some((x) => x[0] === "ref_videos"));
const l = A.formFor("ltx", { prompt: "x", ref_videos: ["v.mp4"], ref_audios: [] }, []);
check("LTX gets them too", (l.fields.find((x) => x[0] === "ref_videos") || [])[1] === '["v.mp4"]');
const R = require("../lib/appRefs");
check("appRefs: images / video / audio from the project's Images / Video / Sound + the Gallery", R.KDIR.audio === "sound" && R.RX.video.test("a.mp4") && R.RX.audio.test("a.m4a") && !R.RX.images.test("a.mp4") && typeof R.resolve === "function" && typeof R.readPicture === "function");
const rs = src("lib/appRefs.js");
check("appRefs.resolve: bare names only, only those folders; a Gallery file is copied into the assets", /path\.basename\(String/.test(rs) && /copyFileSync\(src, to\)/.test(rs) && /RX\[kind\]\.test\(n\)/.test(rs));
const ra = src("routes/appApi.js");
check("routes: GET /api/app/files + POST /api/app/refs; /api/app/video takes pc_pictures + ref_videos + ref_audios", /\/api\/app\/files/.test(ra) && /\/api\/app\/refs/.test(ra) && /pc_pictures/.test(ra) && /R\.resolve\(js\(b\.ref_videos\), "video"\)/.test(ra) && /R\.resolve\(js\(b\.ref_audios\), "audio"\)/.test(ra));
const html = src("mobile/www/index.html"), app = src("mobile/www/app.js");
check("the app: ＋ Picture / ＋ Video / ＋ Audio; camera / microphone, the phone, 💻 the PC", /data-add="image"/.test(html) && /data-add="video"/.test(html) && /data-add="audio"/.test(html)
  && /id="vidCam" accept="video\/\*" capture/.test(html) && /id="audCam" accept="audio\/\*" capture/.test(html) && /id="srcPc"/.test(html) && /id="pcPick"/.test(html));
check("the app: the PC's files (GET /api/app/files), phone videos / sounds sent first (/api/remote/upload), PC ones by name; 9 / 3 / 3", /\/api\/app\/files\?kind=/.test(app) && /\/api\/remote\/upload/.test(app) && /fd\.append\("ref_videos"/.test(app) && /fd\.append\("pc_pictures"/.test(app) && /image: 9, video: 3, audio: 3/.test(app));

console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
