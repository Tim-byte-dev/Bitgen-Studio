// bitGen Studio — lib/scores.js (2.731.0): the project's sheet music (.abc scores) for the Music docker's Sheet music tab.
//
// Tim (verbatim): "in our music docker, sheet music tab can we have real sheet music with the notes drawn on the staff
// with it's clefs etc. and save as pdf?"
// The engraving happens in the page (static/abcscore.js); this only finds the scores: every .abc that a song, a
// 🎼 Write or a 📜 Transcribe left in the project (the output folder, the project root, final/ - the folders that
// GET /outputs/:name serves), newest first.
//   list()  -> [{name, size, mtime, audio?, stems?}]   2.733.0: audio = the song beside it (the same name, an audio file) -
//              what the Sheet Music tab's ▶ plays while it lights the notes. 2.737.0: stems = {vocals, instrumental} - that
//              song separated (the Stems docker / POST /api/stems/separate: <song>_vocals / _instrumental in the project's
//              sound folder, served at /passets/sound/<name>), so the tab can turn the vocals and the instruments on and off
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 500;
const AUDIO = [".wav", ".mp3", ".flac", ".ogg", ".opus", ".m4a", ".aac"];
/** the song a score belongs to: <stem>.<audio ext> in the same folder (music_worker.py names the .abc after it) */
function audioFor(dir, name) {
  const stem = name.replace(/\.abc$/i, "");
  for (const ext of AUDIO) { try { if (fs.statSync(path.join(dir, stem + ext)).isFile()) return stem + ext; } catch { /* next */ } }
  return "";
}
/** 2.737.0: the song's two stems in the sound folder (lib/stems.js names them <song>_vocals / <song>_instrumental) */
function stemsFor(audio) {
  if (!audio) return null;
  const stem = audio.replace(/\.[^.]+$/, ""), dir = core.pDir("sound"), out = {};
  for (const part of ["vocals", "instrumental"]) {
    for (const ext of AUDIO) { try { if (fs.statSync(path.join(dir, stem + "_" + part + ext)).isFile()) { out[part] = stem + "_" + part + ext; break; } } catch { /* next */ } }
  }
  return out.vocals && out.instrumental ? out : null;
}
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
        const audio = audioFor(d, n), stems = stemsFor(audio);
        out.push({ name: n, size: st.size, mtime: st.mtimeMs, ...(audio ? { audio } : {}), ...(stems ? { stems } : {}) });
      } catch { /* gone */ }
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, MAX);
}

module.exports = { list, dirs, audioFor, stemsFor, AUDIO, MAX };
