// bitGen Studio — HOW MANY SCENES THE WRITER MAKES (2.323.0).
//
// Tim (verbatim): "can we add scenes to the video docker, and the llm counts
// the scenes (or we have a txt file with number of scenes) and populates the
// scenes with the soundtrack being optional".
//
// The order (a song loaded on the board wins over all of these - its
// segments ARE the scenes, routes/characters.js):
//   1. the video docker's Scenes field (the board's scene_count);
//   2. projects/<name>/scenes.txt - its first whole number (1..40);
//   3. a number in the request ("write 6 scenes");
//   4. the LLM decides (the existing probe).
"use strict";
const fs = require("fs");
const path = require("path");

const FILE = "scenes.txt";
const MAX = 40;

/** The number in projects/<p>/scenes.txt, or 0. */
function fromFile(projDir) {
  try {
    const m = /\d{1,3}/.exec(fs.readFileSync(path.join(projDir, FILE), "utf8"));
    const n = m ? parseInt(m[0], 10) : 0;
    return n >= 1 && n <= MAX ? n : 0;
  } catch { return 0; }
}

/** {n, source} from the field, the file, the brief's own number - or null
 *  (the LLM decides). briefN = screenplay.sceneCount(brief) (0 = none). */
function pick(field, projDir, briefN) {
  const f = parseInt(field, 10);
  if (Number.isFinite(f) && f >= 1 && f <= MAX) return { n: f, source: "the StoryBoard's Scenes field" };
  const t = fromFile(projDir);
  if (t) return { n: t, source: FILE };
  const b = parseInt(briefN, 10);
  if (Number.isFinite(b) && b >= 1) return { n: Math.min(MAX, b), source: "your request" };
  return null;
}

module.exports = { FILE, MAX, fromFile, pick };
