// bitGen Studio — routes/songTags.js (2.922.0): a song file's title, lyrics and details for the Audio docker's 🎶 Song tab.
//
// Tim: "if i load a song into our song tab in audio that was generated with bitgen, can we add the lyrics and details and
// name from the meta tags?"
//   POST /api/song-tags            multipart "audio" (a song from this computer) -> lib/songTags.read (the upload is deleted)
//   GET  /api/song-tags?src=&name= a song of this project: src output (the Gallery) | sound (Sound assets) - never outside
//                                   the project's folders (lib/mediaMeta.resolve)
//   POST /api/song-tags/transcribe + GET /api/song-tags/transcribe/:id (2.923.0) - the words heard, below
//   -> {song: {title, lyrics, caption, style_id, style_name, dur, seed, format, bpm, keyscale, timesig, language},
//       from: {field: bitgen | job | graph | record | tags | name | file}, found, file, style_found, bitgen}
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");

const AUDIO = /\.(flac|mp3|wav|ogg|opus|m4a|aac)$/i;

function mount(app) {
  const up = multer({ dest: path.join(os.tmpdir(), "bitgen-songtags"), limits: { fileSize: 400 * 1024 * 1024, files: 1 } });
  app.post("/api/song-tags", up.single("audio"), (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: "no song file" });
    const name = path.basename(String(f.originalname || "song"));
    try {
      if (!AUDIO.test(name)) return res.status(400).json({ error: `"${name}" is not a song file (flac, mp3, wav, ogg, opus, m4a)` });
      res.json(require("../lib/songTags").read(f.path, { name }));
    } catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
    finally { fs.unlink(f.path, () => {}); }
  });
  // 2.923.0 (Tim: "can we add a transcribe and put the lyrics in the song tab if no lyrics are found. let user know that it
  // is transcribing with a progress bar"): the words heard (lib/songLyrics.js) - a job the Song tab follows
  //   POST /api/song-tags/transcribe   multipart: audio (a file from this computer) OR src + name (the Gallery / Sound
  //                                    assets); separate=0 = hear the whole mix -> the job's state {id, stage, pct, note}
  //   GET  /api/song-tags/transcribe/:id -> {stage, pct, note, mix, lyrics, language, error, need}
  app.post("/api/song-tags/transcribe", up.single("audio"), (req, res) => {
    const b = req.body || {}, f = req.file;
    try {
      let file = "", name = "", keep = true;
      if (f) {
        name = path.basename(String(f.originalname || "song"));
        if (!AUDIO.test(name)) { fs.unlink(f.path, () => {}); return res.status(400).json({ error: `"${name}" is not a song file (flac, mp3, wav, ogg, opus, m4a)` }); }
        file = f.path + path.extname(name).toLowerCase(); fs.renameSync(f.path, file); keep = false;
      } else {
        name = path.basename(String(b.name || ""));
        if (!AUDIO.test(name)) return res.status(400).json({ error: "a song file is needed (flac, mp3, wav, ogg, opus, m4a)" });
        const mm = require("../lib/mediaMeta");
        for (const s of b.src ? [String(b.src)] : ["output", "sound"]) { file = mm.resolve(s, name); if (file) break; }
        if (!file) return res.status(404).json({ error: `"${name}" is not in this project's Gallery or Sound assets` });
      }
      let test; if (process.env.H3_E2E === "1" && b.test_segments) { try { test = JSON.parse(b.test_segments); } catch { test = undefined; } }
      res.json(require("../lib/songLyrics").start({ file, name, keep, separate: b.separate !== "0", test }));
    } catch (e) { if (f) fs.unlink(f.path, () => {}); res.status(500).json({ error: String(e && e.message || e) }); }
  });
  app.get("/api/song-tags/transcribe/:id", (req, res) => {
    const j = require("../lib/songLyrics").get(req.params.id);
    if (!j) return res.status(404).json({ error: "no such transcription (it finished more than 30 minutes ago, or bitGen restarted)" });
    res.json(j);
  });
  app.get("/api/song-tags", (req, res) => {
    const name = path.basename(String(req.query.name || ""));
    if (!AUDIO.test(name)) return res.status(400).json({ error: "a song file's name is needed (flac, mp3, wav, ogg, opus, m4a)" });
    const mm = require("../lib/mediaMeta");
    const srcs = req.query.src ? [String(req.query.src)] : ["output", "sound"];
    let abs = "";
    for (const s of srcs) { abs = mm.resolve(s, name); if (abs) break; }
    if (!abs) return res.status(404).json({ error: `"${name}" is not in this project's Gallery or Sound assets` });
    try { res.json(require("../lib/songTags").read(abs, { name })); }
    catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
  });
}

module.exports = { mount };
