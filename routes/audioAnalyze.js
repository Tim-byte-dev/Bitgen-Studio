/* bitGen Studio — sound analysis routes (2.508.0, lib/audioAnalyze.js).
 *
 *   GET /api/audio/analyze?name=&src=   a timeline clip's sound (src: sound | video | output | final, as the timeline
 *                                       names it) -> its loudness, waveform and spectrum over time (lib/audioAnalyze)
 * Used by the timeline's ♪ Audio → keys, its 🌫 Waveform / Spectrum layers and ƒx audio() (ext/timelinedock/tlaudio.js).
 * A file is named, never pathed (lib/frames.resolveMedia). */
"use strict";
const path = require("path");
const core = require("../lib/core");
const frames = require("../lib/frames");
const audio = require("../lib/audioAnalyze");

function mount(app) {
  app.get("/api/audio/analyze", async (req, res) => {
    const name = String(req.query.name || ""), file = frames.resolveMedia(name, String(req.query.src || "sound"));
    if (!file) return res.status(404).json({ error: name ? `${name} is not a sound or video in this project` : "name a clip first" });
    try { res.json(Object.assign({ name: path.basename(file) }, await audio.analyze(file, path.join(core.WORKSPACE, "audiocache")))); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}

module.exports = { mount };
