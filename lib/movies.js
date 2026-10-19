/* bitGen Studio — movies (2.150.0, by instruction: "add a file menu bar at
 * the top of the videodock tab, New ... load ... save ... compile").
 *
 * A MOVIE is everything the Video docker is showing, as one saved bundle:
 * the cast (profiles AND their sheet/voice files), the board (chapters,
 * scenes, plan — with volatile job ids blanked, because a loaded movie must
 * never resurrect a dead job id), the rendered takes, the reference
 * pictures WITH their names, types and descriptions (2.195.0, by
 * instruction), and every environment's folder (profile, pano, extracted
 * view). It lives under projects/<p>/movies/<slug>/ — part of the project
 * tree like everything else; no second store is invented.
 *
 * NEW never deletes: the current cast folders are MOVED into a timestamped
 * stash under movies/ ("clears ... from the docker without deleting the
 * files"), the board is blanked, and the gallery's render files stay
 * exactly where they are.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const core = require("./core");
const chars = require("./characters");
const scenes = require("./scenes");
const chapterRefs = require("./chapterRefs");
const envs = require("./environments");

function root(project) {
  return path.join(core.projDir(project || core.getProject()), "movies");
}
function idOf(name) {
  return chars.slug(name).replace(/\s+/g, "_") || "movie";
}
function dirOf(name, project) { return path.join(root(project), idOf(name)); }

/** Hard link first (autoAssets' rule), copy across volumes; false = missing. */
function cp(src, dst) {
  try {
    if (!fs.existsSync(src)) return false;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.rmSync(dst, { force: true });
    try { fs.linkSync(src, dst); } catch { fs.copyFileSync(src, dst); }
    return true;
  } catch { return false; }
}

/** Every take name the board references, upscaled and base alike. */
function renderNames(st) {
  const names = new Set();
  for (const r of (st.list || [])) {
    if (r.output) names.add(path.basename(r.output));
    if (r.upscaled) names.add(path.basename(r.upscaled));
  }
  return [...names];
}

function list(project) {
  let out = [];
  try {
    for (const d of fs.readdirSync(root(project), { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith("_unsaved-")) continue;
      const mp = path.join(root(project), d.name, "movie.json");
      if (!fs.existsSync(mp)) continue;
      try {
        const j = JSON.parse(fs.readFileSync(mp, "utf8"));
        out.push({ id: d.name, name: j.name || d.name, saved: j.saved || "",
                   scenes: ((j.scenes || {}).list || []).length,
                   characters: (j.characters || []).length });
      } catch { /* an unreadable movie.json is not a movie */ }
    }
  } catch { /* no movies folder yet */ }
  return out.sort((a, b) => String(b.saved).localeCompare(String(a.saved)));
}

/**
 * SAVE replaces its named movie (saying "Save" twice is one movie, current).
 * The scenes state is stored with job/upjob/pending cleared — statuses,
 * takes and keeps survive; live machinery does not.
 */
function save(name, project) {
  const clean = String(name || "").trim();
  if (!clean) return { error: "a movie needs a name" };
  const st = scenes.load(project);
  const cast = chars.list(project);
  if (!cast.length && !(st.list || []).length)
    return { error: "nothing to save — the docker has no cast and no scenes" };
  const dir = dirOf(clean, project);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const missing = [];
  let files = 0;
  for (const c of cast) {
    for (const f of [...(c.images || []), ...(c.voices || [])]) {
      cp(path.join(chars.charDir(c.name, project), f),
         path.join(dir, "characters", chars.slug(c.name), f))
        ? files++ : missing.push(`${c.name}/${f}`);
    }
  }
  let renders = 0;
  for (const nm of renderNames(st)) {
    cp(path.join(core.projDir(project || core.getProject()), "video", nm),
       path.join(dir, "renders", nm))
      ? renders++ : missing.push(`renders/${nm}`);
  }
  // EVERYTHING IN THE VIDEO DOCKER (2.195.0, Tim: "when user saves a movie,
  // save all the reference pictures, their names, types and descriptions
  // and all the scenes and the scene board and the location/environment
  // pictures and details, everything in the video docker"). The reference
  // FILES ride references/, their names/types/descriptions ride movie.json
  // verbatim as the store's own map; each environment's WHOLE folder
  // (env.json + pano + extracted view) rides environments/ — the folder is
  // the store, so copying it copies everything.
  const refMap = chapterRefs.load(project);
  let refFiles = 0;
  for (const arr of Object.values(refMap)) {
    for (const e of (arr || [])) {
      if (!e || !e.file) continue;
      cp(path.join(chapterRefs.dir(project), e.file),
         path.join(dir, "references", e.file))
        ? refFiles++ : missing.push(`references/${e.file}`);
    }
  }
  let envCount = 0;
  const envList = envs.list(project);
  for (const ev of envList) {
    try {
      fs.cpSync(envs.envDir(ev.name, project),
                path.join(dir, "environments",
                          path.basename(envs.envDir(ev.name, project))),
                { recursive: true });
      envCount++;
    } catch { missing.push(`environments/${ev.name}`); }
  }
  const board = scenes.safe(st);
  board.pending = [];
  board.list = board.list.map((r) => ({ ...r, job: "", upjob: "" }));
  const movie = { name: clean, saved: new Date().toISOString(),
                  characters: cast, chapters: board.chapters, scenes: board,
                  references: refMap, environments: envList };
  fs.writeFileSync(path.join(dir, "movie.json"),
                   JSON.stringify(movie, null, 2), "utf8");
  return { ok: true, id: idOf(clean), name: clean, files, renders,
           references: refFiles, environments: envCount, missing };
}

/**
 * LOAD is additive on disk and authoritative on state: profiles and asset
 * files are written back (existing files with the same name are left — the
 * name IS the identity here, as everywhere in the project tree), render
 * files return to the project's Video assets so the gallery shows them, and
 * the saved board replaces the current one.
 */
function load(name, project) {
  const dir = dirOf(name, project);
  let movie;
  try { movie = JSON.parse(fs.readFileSync(path.join(dir, "movie.json"), "utf8")); }
  catch { return { error: `no saved movie called "${name}"` }; }
  let charsBack = 0, files = 0, renders = 0;
  const missing = [];
  for (const c of (movie.characters || [])) {
    try { chars.writeProfile(c, project); charsBack++; }
    catch (e) { missing.push(`${c.name}: ${e.message}`); continue; }
    for (const f of [...(c.images || []), ...(c.voices || [])]) {
      const dst = path.join(chars.charDir(c.name, project), f);
      if (fs.existsSync(dst)) { files++; continue; }
      cp(path.join(dir, "characters", chars.slug(c.name), f), dst)
        ? files++ : missing.push(`${c.name}/${f}`);
    }
  }
  const vids = path.join(core.projDir(project || core.getProject()), "video");
  for (const nm of renderNames(scenes.safe(movie.scenes))) {
    const dst = path.join(vids, nm);
    if (fs.existsSync(dst)) { renders++; continue; }
    cp(path.join(dir, "renders", nm), dst) ? renders++ : missing.push(`renders/${nm}`);
  }
  // 2.195.0: the reference pictures and environments come back too. Files
  // and folders are additive (an existing name is the same thing — never
  // overwritten); the reference map merges per chapter via the store's own
  // restore, so names, types and descriptions land where they were saved.
  let refsBack = 0;
  for (const arr of Object.values(movie.references || {})) {
    for (const e of (arr || [])) {
      if (!e || !e.file) continue;
      const dst = path.join(chapterRefs.dir(project), e.file);
      if (fs.existsSync(dst)) { refsBack++; continue; }
      cp(path.join(dir, "references", e.file), dst)
        ? refsBack++ : missing.push(`references/${e.file}`);
    }
  }
  chapterRefs.restore(project, movie.references || {});
  let envsBack = 0;
  try {
    for (const d of fs.readdirSync(path.join(dir, "environments"),
                                   { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const dst = path.join(envs.envRoot(project), d.name);
      try {
        if (!fs.existsSync(dst))
          fs.cpSync(path.join(dir, "environments", d.name), dst,
                    { recursive: true });
        envsBack++;
      } catch { missing.push(`environments/${d.name}`); }
    }
  } catch { /* a movie saved before 2.195.0 has no environments/ folder */ }
  scenes.save(scenes.safe(movie.scenes), project);
  return { ok: true, name: movie.name || name, characters: charsBack,
           files, renders, references: refsBack, environments: envsBack,
           missing };
}

/**
 * NEW: clear the docker, delete nothing. The cast folders are MOVED into a
 * timestamped stash (movies/_unsaved-<ts>/characters/), the board is
 * blanked (chapters and scenes with it), and the gallery's render files are
 * untouched. Environments are left alone — the instruction named
 * characters, chapters and scenes, and a location can outlive a movie.
 */
function newMovie(project) {
  const cast = chars.list(project);
  let stash = null, stashed = 0;
  if (cast.length) {
    stash = "_unsaved-" + new Date().toISOString().replace(/[:.]/g, "-");
    const sdir = path.join(root(project), stash, "characters");
    fs.mkdirSync(sdir, { recursive: true });
    for (const c of cast) {
      const from = chars.charDir(c.name, project);
      // 2.216.0: character folders are named by ID now, but the stash is a
      // HUMAN recovery archive — it keeps the name, like the movie bundle
      try { fs.renameSync(from, path.join(sdir, chars.slug(c.name) || path.basename(from)));
            stashed++; }
      catch { /* a folder that will not move stays — never delete instead */ }
    }
  }
  scenes.save(scenes.blank(), project);
  return { ok: true, stashed, stash,
           note: stashed
             ? `cast moved to movies/${stash}/ — nothing was deleted`
             : "board cleared — there was no cast to stash" };
}

module.exports = { root, idOf, dirOf, list, save, load, newMovie, renderNames };
