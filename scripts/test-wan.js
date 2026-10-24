#!/usr/bin/env node
/* bitGen Studio — 2.368.0: WAN 2.1 / WAN 2.2 STYLES (lib/wan.js, the starters, the /api/generate hand-off).
 * Run: node scripts/test-wan.js
 * Tim: "add a wan2.1 style so we can use wan as well, also wan2.2".
 *   1. lib/wan: a Wan style by arch, Wan's frames (4k+1 at 16 fps), sizes, the app's modes -> Wan's, H3's dialogue
 *      markup made plain, the job (pictures, the sound, steps / cfg that are Wan's own), the summary;
 *   2. the starters "Wan 2.1" / "Wan 2.2" and the wan21 / wan22 archs (phases 1 / 2, no workflow needed);
 *   3. the wiring: core runs mode "wan" with wan_worker.py, /api/generate hands a Wan style to lib/wan with the
 *      request as typed, the music video refuses one in words. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 900) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const wan = require(path.join(ROOT, "lib", "wan"));
const styles = require(path.join(ROOT, "lib", "styles"));

const T = fs.mkdtempSync(path.join(os.tmpdir(), "wan368_"));
const pic = path.join(T, "a.png"), pic2 = path.join(T, "b.png"), song = path.join(T, "s.wav");
for (const p of [pic, pic2, song]) fs.writeFileSync(p, "x");
const W21 = styles.normalize(styles.STARTER_STYLES.find((s) => s.name === "Wan 2.1"), null);
const W22 = styles.normalize(styles.STARTER_STYLES.find((s) => s.name === "Wan 2.2"), null);

// 1
check("isWanStyle: arch wan21 / wan22 video styles only",
  wan.isWanStyle(W21) && wan.isWanStyle(W22) && !wan.isWanStyle({ kind: "video", arch: "minimax-h3" })
  && !wan.isWanStyle({ kind: "image", arch: "wan21" }) && !wan.isWanStyle(null));
check("framesFor: 4k+1 at 16 fps (5 s = 81, 10 s cap = 161)",
  wan.framesFor(5) === 81 && wan.framesFor(30) === 161 && wan.framesFor(1) === 17 && wan.framesFor(0.1) === 5);
check("size: 16-px aligned, 256..1920", JSON.stringify(wan.size(1281, 719)) === '{"width":1280,"height":720}'
  && JSON.stringify(wan.size(100, 9999)) === '{"width":256,"height":1920}');
check("wanMode: Text -> t2v, Ref -> ref (VACE) / t2v with no picture, F/L -> i2v / flf2v",
  wan.wanMode("t2va", 2) === "t2v" && wan.wanMode("ref2va", 1) === "ref" && wan.wanMode("ref2va", 0) === "t2v"
  && wan.wanMode("fl2va", 1) === "i2v" && wan.wanMode("fl2va", 2) === "flf2v");
check("plainPrompt: H3's <d>[English] ...</d> and timbre / <Subject n> markup become plain words for Wan",
  wan.plainPrompt('<Subject 1> says warmly, in the timbre of <Audio 1>, <d>[English] Thank you!</d>') === 'subject 1 says warmly, "Thank you!"',
  wan.plainPrompt('<Subject 1> says warmly, in the timbre of <Audio 1>, <d>[English] Thank you!</d>'));
let p = wan.jobParams({ style: W22, appMode: "fl2va", prompt: "she dances", images: [pic, pic2],
  audio: { path: song, start: 3 }, seconds: 5, width: 1280, height: 720, seed: 9, steps: 0, cfg: 1 });
check("jobParams F/L with two pictures: mode wan, wan22 flf2v, start + end, the sound, 81 frames, steps / cfg left to Wan",
  p.mode === "wan" && p.wan_family === "wan22" && p.wan_mode === "flf2v" && p.images.start === pic && p.images.end === pic2
  && p.audio.path === song && p.audio.start === 3 && p.frames === 81 && p.steps === 0 && p.cfg === 0 && p.seed === 9
  && p.negative === W22.negative && p.video_style_name === "Wan 2.2" && p.interpolate === true, p);
p = wan.jobParams({ style: W21, appMode: "ref2va", prompt: "x", images: [pic], cfg: 5.5, steps: 12 });
check("jobParams Ref: the first picture is the VACE reference; an explicit cfg > 1 and steps ride",
  p.wan_mode === "ref" && p.images.ref === pic && p.cfg === 5.5 && p.steps === 12 && p.audio === null, p);
check("jobParams refuses a picture that is gone / not a picture",
  /gone/.test(wan.jobParams({ style: W21, appMode: "fl2va", images: [path.join(T, "nope.png")] }).error || "")
  && /not a picture/.test(wan.jobParams({ style: W21, appMode: "fl2va", images: [song] }).error || ""));
p = wan.fromGenerate({ style: W21, mode: "fl2va", prompt: "p", files: [pic], refAudios: [song], frames: 120, width: 960, height: 544, seed: -1, steps: 0, cfg: 1 });
check("fromGenerate: the request's frames (120 at 24 fps = 5 s -> 81), its first sound from 0, size kept",
  p.wan_mode === "i2v" && p.seconds === 5 && p.frames === 81 && p.audio.path === song && p.audio.start === 0
  && p.width === 960 && p.height === 544, p);
check("summary: family, what, length (16 -> 24), size, the sound",
  /^Wan 2\.1 from a first frame · 5s \(81 frames at 16 fps -> 24\) · 960x544 · sound s\.wav from 0s$/.test(wan.summary(p)), wan.summary(p));

// 2
const arch = JSON.parse(read("lib", "videoArch.json")).archs;
const a21 = arch.find((a) => a.id === "wan21"), a22 = arch.find((a) => a.id === "wan22");
check("videoArch: wan21 (1 phase) and wan22 (2 phases), both noting the built graph + per-mode file picking",
  a21 && a22 && a21.phases_max === 1 && a22.phases_max === 2 && /wan_worker\.py/.test(a21.note) && /PICKED/.test(a22.note)
  && a21.te[0].hint === "umt5_xxl_fp8_e4m3fn_scaled.safetensors");
check("starters: \"Wan 2.1\" / \"Wan 2.2\" (no workflow - the worker builds the graph; a negative prompt)",
  W21.arch === "wan21" && W22.arch === "wan22" && !W21.workflow && W22.phases.length >= 1 && /blurry/.test(W21.negative));

// 3
const CORE = read("lib", "core.js"), IDX = read("routes", "index.js");
check("core: mode wan -> wan_worker.py, mode vrworld -> vr_world_worker.py",
  /wan: "wan_worker\.py"/.test(CORE) && /vrworld: "vr_world_worker\.py"/.test(CORE));
check("/api/generate: a Wan style is handed to lib/wan.fromGenerate with the mode + prompt AS TYPED (before H3's speech format)",
  /const askedMode = mode, typedPrompt = prompt;/.test(IDX) && /wan\.fromGenerate\(\{ style: (?:vs|basicOverride\.withStyle\(vs, bo, \{ loras: true \}\)), mode: frameOp \? "fl2va" : askedMode, prompt: typedPrompt/.test(IDX)   // 2.388.0: Append / Prepend = fl2va; 2.409.0: the style through Basic Settings' override
  && IDX.indexOf("const askedMode") < IDX.indexOf("vs.formatSpeech(prompt"));
check("/api/musicvideo refuses a Wan style in words", /is a Wan style - Wan renders from the prompt docker/.test(IDX));
check("server.js untouched", !/wan/i.test(read("misc/server.js").replace(/warn/gi, "")));

fs.rmSync(T, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
