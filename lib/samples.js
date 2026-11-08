// bitGen Studio — lib/samples.js (2.726.0): the sample picture a brand-new install starts with.
// Tim (verbatim): "use this as one of the starting images and change the theme to match" - for the image tools: the bitGen brain
// picture (misc/samples/bitgen-neural.jpg) is put in the FIRST project's Assets ▸ Images the moment that project is created on
// a fresh install (no other project yet), so the image editor, ✨ AI edits and image-to-video have a picture to try at once.
// Never again after that: not in a project made later, not after it is deleted, not into an existing project.
"use strict";
const fs = require("fs");
const path = require("path");

const SAMPLES = [{ file: "bitgen-neural.jpg", kind: "images" }];
const SRC = path.join(__dirname, "..", "misc", "samples");

/** is `projectsRoot` empty of projects except `name`? (a fresh install) */
function freshInstall(projectsRoot, name) {
  let list = [];
  try { list = fs.readdirSync(projectsRoot, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name); } catch { return true; }
  return list.every((n) => n === name);
}

/** called by lib/core.js ensureProject right after it CREATED project dir `d` (it did not exist): the samples go in when this is
 *  the install's first project. Returns the files copied ([] = none). Never throws. */
function seed(d, projectsRoot, name, src) {
  const from = src || SRC, out = [];
  try {
    if (!freshInstall(projectsRoot, name)) return out;
    for (const s of SAMPLES) {
      const a = path.join(from, s.file), b = path.join(d, s.kind, s.file);
      if (!fs.existsSync(a) || fs.existsSync(b)) continue;
      fs.mkdirSync(path.dirname(b), { recursive: true });
      fs.copyFileSync(a, b); out.push(path.join(s.kind, s.file));
    }
  } catch { /* a sample never stops a project opening */ }
  return out;
}

module.exports = { SAMPLES, SRC, freshInstall, seed };
