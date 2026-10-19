#!/usr/bin/env node
// Unit tests for lib/adopt.js — bringing a GALLERY file into the project's
// asset folders so it can be addressed by name. Run: node scripts/test-adopt.js
//
// WHAT THESE ARE REALLY GUARDING: the reference dock hands ref_videos and
// ref_audios to POST /api/generate as bare NAMES, and that route resolves them
// under projects/<p>/video and /sound and nowhere else. So the failure this
// module prevents is not a crash — it is a job that starts happily with a
// reference that silently is not there, and a render that comes back subtly
// wrong. Every check below is about the name being TRUE afterwards.
const fs = require("fs");
const os = require("os");
const path = require("path");
const A = require(path.join(__dirname, "..", "lib", "adopt"));

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

// core.PKINDS, copied here on purpose: if the real table ever changes, these
// tests keep testing the RULE rather than silently following the change.
const KINDS = { images: [".png", ".jpg", ".jpeg", ".webp", ".bmp"],
                video: [".webm", ".avi", ".mp4", ".mov", ".mkv"],
                sound: [".wav", ".mp3", ".ogg", ".flac", ".m4a", ".opus"] };

function fresh() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-"));
  const mk = (n) => { const p = path.join(root, n); fs.mkdirSync(p, { recursive: true }); return p; };
  const d = { root, project: root, output: mk("output"), final: mk("final"),
              images: mk("images"), video: mk("video"), sound: mk("sound") };
  d.opts = {
    searchDirs: [d.project, d.output, d.final],
    dirs: { images: d.images, video: d.video, sound: d.sound },
    kinds: KINDS,
  };
  return d;
}
const write = (dir, name, body) => {
  fs.writeFileSync(path.join(dir, name), body);
  return path.join(dir, name);
};

// ------------------------------------------------------------- happy path
{
  const d = fresh();
  write(d.output, "shot 001.webm", "RENDER BYTES");
  const r = A.adopt("shot 001.webm", d.opts);
  check("adopts a render out of output/ into the video assets",
    r.ok && r.kind === "video" && r.name === "shot 001.webm", r);
  check("hard link, not a copy", r.how === "link", r);
  check("the asset is readable and complete",
    fs.readFileSync(path.join(d.video, "shot 001.webm"), "utf8") === "RENDER BYTES", null);
  // THE POINT OF A LINK: a render can be gigabytes, and a reference is not a
  // reason to store it twice.
  const a = fs.statSync(path.join(d.output, "shot 001.webm"));
  const b = fs.statSync(path.join(d.video, "shot 001.webm"));
  check("one set of bytes under two names",
    !a.ino || !b.ino || (a.ino === b.ino && a.dev === b.dev), { a: a.ino, b: b.ino });
  // and the name the generator will be handed actually resolves
  check("the returned name resolves inside the asset folder",
    fs.existsSync(path.join(d.video, r.name)), r);
}

// ------------------------------------------------------ every search folder
{
  const d = fresh();
  write(d.final, "cut.mp4", "EXPORTED");
  check("finds a file in final/", A.adopt("cut.mp4", d.opts).ok, null);
  const d2 = fresh();
  write(d2.project, "myproject.mp4", "COMPILED");
  const r = A.adopt("myproject.mp4", d2.opts);
  check("finds the compiled movie in the project root", r.ok && r.how === "link", r);
}

// ------------------------------------------------------------ kind routing
{
  const d = fresh();
  write(d.output, "still.png", "PNG");
  write(d.output, "voice.wav", "WAV");
  check("a .png goes to the images assets", A.adopt("still.png", d.opts).kind === "images", null);
  check("a .wav goes to the sound assets", A.adopt("voice.wav", d.opts).kind === "sound", null);
  check("the .png landed in images/, not video/",
    fs.existsSync(path.join(d.images, "still.png")) && !fs.existsSync(path.join(d.video, "still.png")), null);
}

// -------------------------------------------------------- the .webp problem
// .webp is BOTH a still format and one of this app's video output formats, so
// the extension genuinely cannot answer the question. The caller (which knows
// which gallery tab the item was showing in) answers it instead.
{
  const d = fresh();
  write(d.output, "clip.webp", "ANIMATED");
  const r = A.adopt("clip.webp", { ...d.opts, hint: "video" });
  check("a hint routes a .webp render to the video assets", r.ok && r.kind === "video", r);

  const d2 = fresh();
  write(d2.output, "pic.webp", "STILL");
  const r2 = A.adopt("pic.webp", d2.opts);
  check("with no hint a .webp stays an image (matching core.kindOf)",
    r2.ok && r2.kind === "images", r2);

  // A hint on an UNAMBIGUOUS extension is ignored — otherwise a forged or buggy
  // request could file a .png under sound/ and the dock would show a picture
  // that never plays.
  const d3 = fresh();
  write(d3.output, "still.png", "PNG");
  const r3 = A.adopt("still.png", { ...d3.opts, hint: "sound" });
  check("a hint cannot override an unambiguous extension", r3.kind === "images", r3);
  check("kindFor is the single rule behind all of that",
    A.kindFor("a.webp", KINDS, "video") === "video"
    && A.kindFor("a.webp", KINDS) === "images"
    && A.kindFor("a.png", KINDS, "video") === "images"
    && A.kindFor("a.txt", KINDS) === null, null);
}

// ----------------------------------------------------- already there = fine
// v2.65.0 auto-registers finished renders into the video assets, so the COMMON
// case is that the gallery file and the asset are already one file. Calling
// that an error would make the normal path look broken.
{
  const d = fresh();
  const src = write(d.output, "auto.webm", "BYTES");
  fs.linkSync(src, path.join(d.video, "auto.webm"));
  const r = A.adopt("auto.webm", d.opts);
  check("an already-registered render reports exists, not failure",
    r.ok && r.how === "exists" && r.name === "auto.webm", r);
  check("and it did not pile up a second copy",
    fs.readdirSync(d.video).length === 1, fs.readdirSync(d.video));
  // twice more, to be sure nothing accumulates on repeated drags
  A.adopt("auto.webm", d.opts); A.adopt("auto.webm", d.opts);
  check("adopting the same file repeatedly is idempotent",
    fs.readdirSync(d.video).length === 1, fs.readdirSync(d.video));
}

// ------------------------------------------------- a clash is uniquified
// Overwriting an asset is silent data loss twice over: the old file is gone AND
// every timeline clip still naming it now plays different footage.
{
  const d = fresh();
  write(d.output, "take.webm", "THE RENDER");
  write(d.video, "take.webm", "A DIFFERENT FILE ALREADY HERE");
  const r = A.adopt("take.webm", d.opts);
  check("a name clash is uniquified", r.ok && r.name === "take (2).webm", r);
  check("the existing asset is untouched",
    fs.readFileSync(path.join(d.video, "take.webm"), "utf8") === "A DIFFERENT FILE ALREADY HERE", null);
  check("the new one holds the render's bytes",
    fs.readFileSync(path.join(d.video, "take (2).webm"), "utf8") === "THE RENDER", null);
}

// -------------------------------------------------------------- refusals
{
  const d = fresh();
  const miss = A.adopt("nothing.webm", d.opts);
  check("a file that is not there is refused with code missing",
    !miss.ok && miss.code === "missing", miss);
  check("...and says which file", /nothing\.webm/.test(miss.error), miss);

  write(d.output, "notes.txt", "x");
  const un = A.adopt("notes.txt", d.opts);
  check("an unsupported extension is refused", !un.ok && un.code === "unsupported", un);

  check("an empty name is refused", !A.adopt("", d.opts).ok, null);
  check("'..' is refused rather than naming a directory",
    !A.adopt("..", d.opts).ok, A.adopt("..", d.opts));
  // basename() strips it, but the refusal must be explicit rather than accidental
  write(d.output, "esc.webm", "x");
  const esc = A.adopt("../../../etc/esc.webm", d.opts);
  check("a traversal attempt is reduced to a plain basename",
    esc.ok && esc.name === "esc.webm", esc);

  const nod = A.adopt("esc.webm", { ...d.opts, dirs: { images: d.images } });
  check("no destination folder for the kind is its own reason",
    !nod.ok && nod.code === "no-dir", nod);
}

// ------------------------------------------------------------ never throws
// This runs behind a route that must answer with a reason, and behind a
// drag-and-drop handler where an exception is invisible to the user.
{
  for (const [n, args] of [
    ["no opts at all", [ "x.webm" ]],
    ["null name", [null, {}]],
    ["undefined everything", [undefined, undefined]],
    ["a number for a name", [42, { kinds: KINDS, dirs: {}, searchDirs: [] }]],
    ["searchDirs holding junk", ["a.webm", { kinds: KINDS, dirs: {}, searchDirs: [null, 7] }]],
  ]) {
    let threw = null, r = null;
    try { r = A.adopt(...args); } catch (e) { threw = e.message; }
    check("never throws: " + n, threw === null && r && r.ok === false, threw || r);
  }
}

// ------------------------------------------------------- findSource order
{
  const d = fresh();
  write(d.project, "same.mp4", "PROJECT ROOT");
  write(d.output, "same.mp4", "OUTPUT");
  const src = A.findSource("same.mp4", d.opts.searchDirs);
  check("the first search folder wins a name lookup",
    fs.readFileSync(src, "utf8") === "PROJECT ROOT", src);
  check("findSource answers null for a name nowhere in the list",
    A.findSource("ghost.mp4", d.opts.searchDirs) === null, null);
}

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
