// bitGen Studio — WHERE A TAKE'S LOSSLESS MASTER LIVES (2.301.0).
//
// Tim (verbatim): "we create 2 separate files, 1 raw files and 1 mp4 to
// playback. quality will be more important than diskspace at this stage.
// user can delete raw files on project completion if they want to. save the
// raw renders in project name\raw".
//
// A scene render writes TWO files: the playback take in the project's video
// assets (projects/<p>/video/<take>.mp4 - what the players, the filmstrip and
// the gallery show) and its LOSSLESS master in projects/<p>/raw/<take
// stem>.avi (FFV1, full RGB, every frame a keyframe - scripts/rawmaster.py
// writes it). Anything that feeds a frame or a clip BACK into a render - the
// next scene's first/last frame, a frame added as a picture, the previous
// take's tail, the movie compile - reads the master when it exists, so no
// scene ever starts from a compressed picture. A take without a master (an
// older render, a workflow without a video joiner, the raw folder deleted)
// keeps working exactly as before, from its mp4.
const fs = require("fs");
const path = require("path");
const core = require("./core");

const DIR = "raw";

/** projects/<p>/raw - the job's raw_dir. */
function dir(project) {
  return path.join(core.projDir(project || core.getProject()), DIR);
}

/** The master for a take NAME in a project, or null. */
function forOutput(project, name) {
  if (!name) return null;
  const p = path.join(dir(project), path.parse(path.basename(String(name))).name + ".avi");
  return fs.existsSync(p) ? p : null;
}

/** The master for a take PATH (…/<project>/video/<take>.mp4), or null. */
function forTake(takePath) {
  if (!takePath) return null;
  const t = path.resolve(String(takePath));
  const p = path.join(path.dirname(path.dirname(t)), DIR, path.parse(t).name + ".avi");
  return fs.existsSync(p) ? p : null;
}

/** What to read a frame / clip from: the master when there is one. */
function sourceFor(takePath) {
  return forTake(takePath) || takePath;
}

/** The board registers a take under its SCENE name (scene1_chapter.mp4)
 *  while the worker named the master after its own output - move the
 *  master to the take's name so every lookup by the board's name finds it.
 *  Returns the master's new path, or null when the render had none. */
function adopt(project, fromName, toName) {
  const src = forOutput(project, fromName);
  if (!src || !toName) return null;
  const dest = path.join(dir(project), path.parse(path.basename(String(toName))).name + ".avi");
  if (dest === src) return dest;
  try {
    fs.rmSync(dest, { force: true });      // an orphan of a take that is gone
    fs.renameSync(src, dest);
    return dest;
  } catch { return null; }
}

module.exports = { DIR, dir, forOutput, forTake, sourceFor, adopt };
