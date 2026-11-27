// bitGen Studio — lib/synthSong.js (3.1.0): 💾 SAVE SONG - the Edit Booth's timeline, every layer mixed, as an MP3 or a WAV.
// Tim: "add a button to edit booth timeline to save as mp3 or wav. compile all the layers into a song".
// The browser mixes the timeline (synthtl.js render(): every layer with its effects, lanes, keyframes and the limiter) into a
// WAV; this files it: the song in the project's Sound assets (sound/) + a copy in output/ (the gallery's Audio tab), MP3
// (LAME, 320 kb/s) or 16-bit WAV, with its title / date / "bitGen Studio" in its tags. routes/synth.js POST /api/synth/song.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const core = require("./core");

const FORMATS = ["mp3", "wav"];
/** a song's file stem (pure): letters, digits, spaces, - _ ( ) . only, 80 at most, "song" when nothing is left */
function stemOf(name) {
  const s = String(name || "").replace(/\.(mp3|wav|flac|ogg|m4a)$/i, "").replace(/[^\w \-().]+/g, " ").replace(/\s+/g, " ").replace(/^[.\s]+/, "").trim().slice(0, 80);
  return s || "song";
}
/** a name not taken in dir (pure-ish): "x.mp3", "x (2).mp3" … */
function freeName(dir, stem, ext) {
  let n = stem + "." + ext, k = 2;
  while (fs.existsSync(path.join(dir, n))) n = `${stem} (${k++}).${ext}`;
  return n;
}
/** ffmpeg's arguments for the song (pure): the mix -> 44.1 kHz stereo MP3 320k / 16-bit WAV + its tags */
function ffArgs(src, dest, fmt, meta) {
  const m = meta || {}, a = ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-ac", "2", "-ar", "44100"];
  if (fmt === "mp3") a.push("-c:a", "libmp3lame", "-b:a", "320k", "-id3v2_version", "4", "-write_id3v1", "0");
  else a.push("-c:a", "pcm_s16le");
  const tags = fmt === "mp3" ? [["title", m.title], ["date", m.date], ["artist", m.artist], ["encoded_by", "bitGen Studio"]] : [["title", m.title], ["date", m.date], ["artist", m.artist], ["ISFT", "bitGen Studio"]];
  for (const [k, v] of tags) if (v != null && String(v) !== "") a.push("-metadata", k + "=" + String(v));
  a.push(dest);
  return a;
}
/** the mixed WAV at `src` -> the song in the Sound assets + the gallery -> {name, gallery, format, seconds} */
function save(src, name, format, opts) {
  const fmt = FORMATS.includes(String(format || "").toLowerCase()) ? String(format).toLowerCase() : "mp3", o = opts || {};
  const sd = core.pDir("sound"); fs.mkdirSync(sd, { recursive: true });
  const stem = stemOf(name), file = freeName(sd, stem, fmt), dest = path.join(sd, file);
  const d = new Date(), date = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const r = (o.spawn || spawnSync)("ffmpeg", ffArgs(src, dest, fmt, { title: stem, date, artist: o.artist || "" }), { encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(dest)) throw new Error("ffmpeg could not make the " + fmt.toUpperCase() + ": " + (String(r.stderr || "").trim().split("\n").pop() || "failed"));
  let gallery = "";
  try { const gd = core.pDir("output"); fs.mkdirSync(gd, { recursive: true }); gallery = freeName(gd, "song_" + stem, fmt); fs.copyFileSync(dest, path.join(gd, gallery)); } catch { gallery = ""; }
  let seconds = null; try { seconds = core.probeDuration(dest); } catch { seconds = null; }
  return { name: file, gallery, format: fmt, seconds };
}
module.exports = { FORMATS, stemOf, freeName, ffArgs, save };
