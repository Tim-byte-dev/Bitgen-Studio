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
const LAYER_SUFFIX = /_(vocals|instrumental|drums|bass|other)$/i;
const findIn = (dir, base) => { for (const ext of AUDIO) { try { if (fs.statSync(path.join(dir, base + ext)).isFile()) return base + ext; } catch { /* next */ } } return ""; };
/** 2.738.0 (Tim: "when playing in sheet music play the actual song in it's separated layers, show the layers as
 *  waveforms"): a song's layers in the sound folder - the four of ✂ Split into layers (vocals, drums, bass, other), else
 *  the Stems docker's pair (vocals, instrumental); null = not separated. */
function layersFor(audio) {
  if (!audio) return null;
  const stem = String(audio).replace(/\.[^.]+$/, ""), dir = core.pDir("sound");
  const four = {};
  for (const k of ["vocals", "drums", "bass", "other"]) { const f = findIn(dir, stem + "_" + k); if (f) four[k] = f; }
  if (Object.keys(four).length === 4) return four;
  const v = findIn(dir, stem + "_vocals"), i = findIn(dir, stem + "_instrumental");
  return v && i ? { vocals: v, instrumental: i } : null;
}
/** 2.738.0: the project's songs - every audio file in the output folder, final/ and the sound folder that is not itself a
 *  layer - newest first, each with where it is (its URL: output/final -> /outputs/<name>, sound -> /passets/sound/<name>)
 *  and its layers */
function songs() {
  const pd = core.projDir(core.getProject()), seen = new Set(), out = [];
  for (const [src, d] of [["output", core.pDir("output")], ["final", path.join(pd, "final")], ["sound", core.pDir("sound")]]) {
    let names = [];
    try { names = fs.readdirSync(d); } catch { continue; }
    for (const n of names) {
      const ext = path.extname(n).toLowerCase();
      if (!AUDIO.includes(ext) || seen.has(n) || LAYER_SUFFIX.test(n.slice(0, -ext.length))) continue;
      try {
        const st = fs.statSync(path.join(d, n));
        if (!st.isFile()) continue;
        seen.add(n);
        const layers = layersFor(n);
        out.push({ name: n, src, mtime: st.mtimeMs, size: st.size, ...(layers ? { layers } : {}) });
      } catch { /* gone */ }
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, MAX);
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

module.exports = { list, songs, layersFor, dirs, audioFor, stemsFor, AUDIO, MAX };
