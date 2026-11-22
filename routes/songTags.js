// bitGen Studio — routes/songTags.js (2.922.0): a song file's title, lyrics and details for the Audio docker's 🎶 Song tab.
//
// Tim: "if i load a song into our song tab in audio that was generated with bitgen, can we add the lyrics and details and
// name from the meta tags?"
//   POST /api/song-tags            multipart "audio" (a song from this computer) -> lib/songTags.read (the upload is deleted)
//   GET  /api/song-tags?src=&name= a song of this project: src output (the Gallery) | sound (Sound assets) - never outside
//                                   the project's folders (lib/mediaMeta.resolve)
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
