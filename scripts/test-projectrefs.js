#!/usr/bin/env node
// lib/projectRefs.js — the project's reference media (2.101.0).
// node scripts/test-projectrefs.js
//
// THE LAYOUT IS THE INSTRUCTION: <project>/reference/images, /videos, /audio,
// and the .prj carries the names under `references`. Media is never deleted.
const fs = require("fs");
const os = require("os");
const path = require("path");
const R = require(path.join(__dirname, "..", "lib", "projectRefs"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));
const fresh = () => fs.mkdtempSync(path.join(os.tmpdir(), "projrefs-"));

{
  const d = fresh();
  R.ensureDirs(d);
  check("the three folders are reference/images, reference/videos, reference/audio (Tim's names)",
    ["images", "videos", "audio"].every((k) => fs.existsSync(path.join(d, "reference", k))),
    fs.readdirSync(path.join(d, "reference")));
  check("dirFor refuses an unknown kind rather than inventing a folder",
    (() => { try { R.dirFor(d, "sound"); return false; } catch { return true; } })(), null);
}

{
  const d = fresh();
  const a = R.placeBytes(d, "images", "face.png", Buffer.from("AAA"));
  check("a picture lands in reference/images under its own name", a === "face.png" && fs.existsSync(path.join(d, "reference", "images", "face.png")), a);
  const same = R.placeBytes(d, "images", "face.png", Buffer.from("AAA"));
  check("the same name + same bytes is reused, not duplicated", same === "face.png" && fs.readdirSync(path.join(d, "reference", "images")).length === 1, same);
  const diff = R.placeBytes(d, "images", "face.png", Buffer.from("BBB"));
  check("the same name + different bytes gets -2, the original is untouched",
    diff === "face-2.png" && fs.readFileSync(path.join(d, "reference", "images", "face.png"), "utf8") === "AAA", diff);
  const evil = R.placeBytes(d, "images", "../../etc/passwd", Buffer.from("x"));
  check("a traversal name is basename'd and sanitised", !evil.includes("/") && !evil.includes("..") && fs.existsSync(path.join(d, "reference", "images", evil)), evil);
}

{
  const d = fresh();
  const src = path.join(d, "clip.mp4"); fs.writeFileSync(src, "vid");
  check("placeFile copies an existing asset into the kind folder", R.placeFile(d, "videos", src) === "clip.mp4"
    && fs.readFileSync(path.join(d, "reference", "videos", "clip.mp4"), "utf8") === "vid", fs.readdirSync(path.join(d, "reference", "videos")));
  check("...and the source is left where it was (copy, not move)", fs.existsSync(src), null);
  check("...a missing source is null, never a throw", R.placeFile(d, "audio", path.join(d, "nope.wav")) === null, null);
}

{
  const m = R.normalize({ images: [{ file: "a.png", subject: "3", role: "prop" }, "b.png", { name: "c.png" }, { file: "" }],
                          videos: ["v.mp4", { file: "w.mp4" }], audios: ["s.wav"] });
  check("normalize: images keep subject/role, accept strings and {name}, drop empties",
    m.images.length === 3 && m.images[0].subject === 3 && m.images[0].role === "prop" && m.images[1].file === "b.png" && m.images[2].file === "c.png", m.images);
  check("normalize: videos accept strings and objects", JSON.stringify(m.videos) === '["v.mp4","w.mp4"]', m.videos);
  check("normalize: the legacy 'audios' key is read as 'audio'", JSON.stringify(m.audio) === '["s.wav"]', m.audio);
  check("normalize: subject clamps to 1..9", R.normalize({ images: [{ file: "a", subject: 40 }] }).images[0].subject === 9, null);
  check("normalize: at most 9 pictures, 3 videos, 3 sounds",
    R.normalize({ images: Array.from({ length: 12 }, (_, i) => `${i}.png`), videos: ["1", "2", "3", "4"] }).images.length === 9
    && R.normalize({ videos: ["1", "2", "3", "4"] }).videos.length === 3, null);
  check("isEmpty is true for nothing and false for one picture", R.isEmpty({}) && R.isEmpty(null) && !R.isEmpty({ images: ["a.png"] }), null);
}

{
  const d = fresh();
  R.placeBytes(d, "images", "here.png", Buffer.from("1"));
  R.placeBytes(d, "audio", "here.wav", Buffer.from("1"));
  const v = R.verify(d, { images: [{ file: "here.png" }, { file: "gone.png" }], videos: ["gone.mp4"], audio: ["here.wav"] });
  check("verify keeps entries whose file exists and drops the rest",
    v.manifest.images.length === 1 && v.manifest.videos.length === 0 && v.manifest.audio.length === 1, v.manifest);
  check("...and NAMES what went missing (kind/file) instead of guessing", JSON.stringify(v.missing) === '["images/gone.png","videos/gone.mp4"]', v.missing);
  check("servePath never leaves the kind folder",
    R.servePath(d, "images", "../../x.png") === path.join(d, "reference", "images", "x.png"), R.servePath(d, "images", "../../x.png"));
}

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
