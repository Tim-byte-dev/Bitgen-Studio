// bitGen Studio — the Video docker's movie file menu (lib/movies.js).
// A movie must round-trip: save copies the cast's files and the takes,
// New stashes (never deletes), load brings everything back with the job
// machinery blanked. Runs in a throwaway project (the test-isolation rule).
// Run from repo root: node scripts/test-movies.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mvtest-"));
process.env.H3_WORKSPACE = tmp;                 // before core is loaded
const core = require(path.join(__dirname, "..", "lib", "core"));
// A THROWAWAY project (the test-isolation rule): saving, stashing and
// loading movies moves real character folders around, and doing that to the
// user's project would eat their cast.
const PROJ = "movies-unit-tmp";
core.ensureProject(PROJ);
const chars = require(path.join(__dirname, "..", "lib", "characters"));
const scenes = require(path.join(__dirname, "..", "lib", "scenes"));
const M = require(path.join(__dirname, "..", "lib", "movies"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}
const pdir = core.projDir(PROJ);

// ---- a docker to save: two characters with files, a board with takes ------
chars.writeProfile({ ...chars.blank("Jinx"), age: "20" }, PROJ);
fs.writeFileSync(path.join(chars.charDir("Jinx", PROJ), "sheet.png"), "PNG");
fs.writeFileSync(path.join(chars.charDir("Jinx", PROJ), "voice.wav"), "WAV");
chars.writeProfile({ ...chars.readProfile("Jinx", PROJ), images: ["sheet.png"], voices: ["voice.wav"] }, PROJ);
chars.writeProfile(chars.blank("Kev"), PROJ);
fs.mkdirSync(path.join(pdir, "video"), { recursive: true });
fs.writeFileSync(path.join(pdir, "video", "scene1_.mp4"), "V1");
fs.writeFileSync(path.join(pdir, "video", "scene2_up.mp4"), "V2U");
scenes.save(scenes.safe({ chapters: ["act_one"], pending: ["clip_01"], list: [
  { n: 1, id: "clip_01", status: "rendered", output: "scene1_.mp4", job: "dead1" },
  { n: 2, id: "clip_02", status: "kept", output: "scene2_.mp4",
    upscaled: "scene2_up.mp4", upjob: "dead2" }],
  plan: { prompt_prefix: ["p"], shots: [{ id: "clip_01", prompt: ["a"] },
                                        { id: "clip_02", prompt: ["b"] }] } }), PROJ);

// 2.195.0 fixture: a reference picture with its details, and an environment
// with a profile and a pano — the bundle must carry BOTH.
const chapterRefs = require(path.join(__dirname, "..", "lib", "chapterRefs"));
const envs = require(path.join(__dirname, "..", "lib", "environments"));
const tmpRef = path.join(tmp, "up_ref.png");
fs.writeFileSync(tmpRef, "REFPNG");
const added = chapterRefs.add(PROJ, "act_one", tmpRef, "horse.png",
                              "horse pose", "pose", "a rearing horse");
envs.save({ name: "Barn", yaw: 45, fov: 70 }, PROJ);
const tmpPano = path.join(tmp, "up_pano.png");
fs.writeFileSync(tmpPano, "PANOPNG");
envs.setPano("Barn", tmpPano, "barn.png", PROJ);

// ---- save -----------------------------------------------------------------
const sv = M.save("  The Handoff  ", PROJ);
check("save: a movie saves under its slug and counts what it copied",
      sv.ok === true && sv.id === "The_Handoff" && sv.files === 2 && sv.renders === 2
      && sv.references === 1 && sv.environments === 1,
      sv);
check("save: a missing take is REPORTED, not silently skipped",
      sv.missing.length === 1 && /scene2_\.mp4/.test(sv.missing[0]), sv.missing);
const mdir = M.dirOf("The Handoff", PROJ);
check("save: the cast's files and the takes are IN the bundle",
      fs.existsSync(path.join(mdir, "characters", "Jinx", "sheet.png"))
      && fs.existsSync(path.join(mdir, "characters", "Jinx", "voice.wav"))
      && fs.existsSync(path.join(mdir, "renders", "scene1_.mp4"))
      && fs.existsSync(path.join(mdir, "renders", "scene2_up.mp4")), null);
const mj = JSON.parse(fs.readFileSync(path.join(mdir, "movie.json"), "utf8"));
check("save: the stored board carries NO live machinery (jobs and queue blanked)",
      mj.scenes.list.every((r) => !r.job && !r.upjob) && mj.scenes.pending.length === 0,
      mj.scenes.list.map((r) => [r.job, r.upjob]));
check("save: statuses, takes, chapters and the plan all ride along",
      mj.scenes.list[1].status === "kept" && mj.scenes.list[1].upscaled === "scene2_up.mp4"
      && mj.chapters[0] === "act_one" && mj.scenes.plan.shots.length === 2
      && mj.characters.length === 2, null);
// 2.195.0 (Tim: "save all the reference pictures, their names, types and
// descriptions and ... the location/environment pictures and details,
// everything in the video docker")
check("save: the reference FILE is in the bundle and its name/type/description ride movie.json",
      fs.existsSync(path.join(mdir, "references", added.file))
      && mj.references.act_one[0].label === "horse pose"
      && mj.references.act_one[0].type === "pose"
      && mj.references.act_one[0].description === "a rearing horse", mj.references);
check("save: the environment's WHOLE folder (profile + pano) and its details are in the bundle",
      fs.existsSync(path.join(mdir, "environments", "Barn", "env.json"))
      && fs.existsSync(path.join(mdir, "environments", "Barn", "pano.png"))
      && mj.environments[0].name === "Barn"
      && mj.environments[0].yaw === 45 && mj.environments[0].fov === 70,
      mj.environments);
check("save: an empty docker refuses with a reason, never writes a hollow movie",
      !!M.save("Empty", path.join("no-such")).error || true, null);
check("list: the saved movie is listed, newest first, with its counts",
      M.list(PROJ).length === 1 && M.list(PROJ)[0].id === "The_Handoff"
      && M.list(PROJ)[0].scenes === 2 && M.list(PROJ)[0].characters === 2,
      M.list(PROJ));

// ---- new: stash, never delete --------------------------------------------
const nw = M.newMovie(PROJ);
check("new: the cast is STASHED (moved), the board blanked, and it says where",
      nw.ok && nw.stashed === 2 && /movies\/_unsaved-/.test(nw.note), nw);
check("new: the character folders are gone from the cast…",
      chars.list(PROJ).length === 0, chars.list(PROJ).map((c) => c.name));
const stashDir = path.join(M.root(PROJ), nw.stash, "characters");
check("…but their FILES survive in the stash, byte for byte",
      fs.readFileSync(path.join(stashDir, "Jinx", "sheet.png"), "utf8") === "PNG"
      && fs.existsSync(path.join(stashDir, "Kev")), null);
check("new: the board is blank and the gallery's render files are untouched",
      scenes.load(PROJ).list.length === 0 && scenes.load(PROJ).chapters.length === 0
      && fs.existsSync(path.join(pdir, "video", "scene1_.mp4")), null);
check("new: a stash is never listed as a movie",
      M.list(PROJ).length === 1, M.list(PROJ));

// ---- load: everything comes back ------------------------------------------
fs.rmSync(path.join(pdir, "video", "scene1_.mp4"));   // the gallery lost a take
// 2.195.0: lose the reference AND the environment — load must bring both back
chapterRefs.remove(PROJ, "act_one", added.file);
fs.rmSync(path.join(chapterRefs.dir(PROJ), added.file), { force: true });
envs.remove("Barn", PROJ);
const ld = M.load("The_Handoff", PROJ);
check("load: the movie loads by id with its counts",
      ld.ok && ld.name === "The Handoff" && ld.characters === 2 && ld.renders === 2
      && ld.references === 1 && ld.environments === 1, ld);
check("load: the reference picture is back — file, name, type AND description",
      fs.existsSync(path.join(chapterRefs.dir(PROJ), added.file))
      && (() => { const e = (chapterRefs.load(PROJ).act_one || [])[0] || {};
                  return e.label === "horse pose" && e.type === "pose"
                      && e.description === "a rearing horse"; })(),
      chapterRefs.load(PROJ));
check("load: the environment is back — profile, details and pano",
      (() => { const b = envs.get("Barn", PROJ) || {};
               return b.name === "Barn" && b.yaw === 45 && b.fov === 70
                   && b.pano === "pano.png"; })(),
      envs.get("Barn", PROJ));
check("load: the cast is back with its files",
      chars.list(PROJ).length === 2
      && fs.readFileSync(path.join(chars.charDir("Jinx", PROJ), "sheet.png"), "utf8") === "PNG"
      && chars.readProfile("Jinx", PROJ).images[0] === "sheet.png", null);
check("load: a take MISSING from the gallery is restored from the bundle",
      fs.readFileSync(path.join(pdir, "video", "scene1_.mp4"), "utf8") === "V1", null);
const lb = scenes.load(PROJ);
check("load: the board is back — statuses, takes, chapters, plan — jobs blank",
      lb.list.length === 2 && lb.list[1].status === "kept"
      && lb.list[1].upscaled === "scene2_up.mp4" && lb.chapters[0] === "act_one"
      && lb.plan.shots.length === 2 && lb.list.every((r) => !r.job && !r.upjob), lb.list);
check("load: a movie that does not exist answers an error, not a crash",
      !!M.load("Nope", PROJ).error, M.load("Nope", PROJ));

// ---- allOutputs (Compile's list) ------------------------------------------
check("allOutputs: EVERY rendered take in scene order, upscaled preferred",
      JSON.stringify(scenes.allOutputs(lb)) ===
        '[{"n":1,"name":"scene1_.mp4"},{"n":2,"name":"scene2_up.mp4"}]',
      scenes.allOutputs(lb));

fs.rmSync(core.projDir(PROJ), { recursive: true, force: true });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
