// bitGen Studio — lib/scores.js (2.731.0): the project's sheet music (.abc scores) for the Music docker's Sheet music tab.
//
// Tim (verbatim): "in our music docker, sheet music tab can we have real sheet music with the notes drawn on the staff
// with it's clefs etc. and save as pdf?"
// The engraving happens in the page (static/abcscore.js); this only finds the scores: every .abc that a song, a
// 🎼 Write or a 📜 Transcribe left in the project (the output folder, the project root, final/ - the folders that
// GET /outputs/:name serves), newest first.
//   list()  -> [{name, size, mtime}]
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 500;
function dirs() {
  const pd = core.projDir(core.getProject());
  return [core.pDir("output"), pd, path.join(pd, "final")];
}
function list() {
  const seen = new Set(), out = [];
  for (const d of dirs()) {
    let names = [];
    try { names = fs.readdirSync(d); } catch { continue; }
    for (const n of names) {
      if (!/\.abc$/i.test(n) || seen.has(n)) continue;
      try {
        const st = fs.statSync(path.join(d, n));
        if (!st.isFile()) continue;
        seen.add(n);
        out.push({ name: n, size: st.size, mtime: st.mtimeMs });
      } catch { /* gone */ }
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, MAX);
}

module.exports = { list, dirs, MAX };
