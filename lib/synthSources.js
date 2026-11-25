/* bitGen Studio — lib/synthSources.js (2.954.0): EVERY SOUND the 🎹 Synth station's timeline can take (routes/synth.js).
 * Tim: "add a timeline below that with waveforms that can be added from all sources".
 *   my     📂 My samples            <install>/synth_samples (lib/synthSamples.js)
 *   sfx    💥 this project's SFX     projects/<p>/sfx (lib/sfx.js)
 *   snd    🔊 the Sound assets       projects/<p>/sound - songs added there, the stems, speech, the loops sent → 🔊
 *   out    🎵 songs and the gallery  projects/<p>, /output, /final - the music docker's renders, the gallery's Audio tab
 * groups() -> [{id, name, items: [{name, size, mtime}]}]; fileOf(group, name) -> the file inside that group's folders | null.
 * Only sound files (AUDIO), only base names - nothing outside the folders.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const sfx = require("./sfx");
const S = require("./synthSamples");

const AUDIO = [".wav", ".mp3", ".flac", ".ogg", ".oga", ".m4a", ".aac", ".opus"];
const GROUPS = [["my", "📂 My samples"], ["sfx", "💥 This project's SFX"], ["snd", "🔊 Sound assets (stems too)"], ["out", "🎵 Songs and the gallery's audio"]];
function dirs(group) {
  if (group === "my") return [S.dir()];
  if (group === "sfx") return [sfx.dir()];
  if (group === "snd") return [core.pDir("sound")];
  if (group === "out") return core.outputDirs();
  return [];
}
function isAudio(n) { return AUDIO.includes(path.extname(n).toLowerCase()) && !n.startsWith("."); }
function items(group) {
  const seen = new Set(), out = [];
  for (const d of dirs(group)) {
    let names = [];
    try { names = fs.readdirSync(d); } catch { names = []; }
    for (const n of names) {
      if (!isAudio(n) || seen.has(n)) continue;
      let st; try { st = fs.statSync(path.join(d, n)); } catch { continue; }
      if (!st.isFile()) continue;
      seen.add(n); out.push({ name: n, size: st.size, mtime: st.mtimeMs / 1000 });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}
function groups() { return GROUPS.map(([id, name]) => ({ id, name, items: items(id) })); }
function fileOf(group, name) {
  const n = sfx.safeName(name);
  if (!n || !isAudio(n)) return null;
  for (const d of dirs(group)) {
    const p = path.join(d, n);
    try { if (fs.statSync(p).isFile()) return p; } catch { /* next */ }
  }
  return null;
}
module.exports = { AUDIO, GROUPS, dirs, items, groups, fileOf };
