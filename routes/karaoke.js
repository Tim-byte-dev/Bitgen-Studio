// bitGen Studio — routes/karaoke.js (2.373.0): the video docker's 🎤 Karaoke and a song's lyrics file.
//
// Tim: "when bitgen produces a song save the lyrics in a txt file in the project folder. is it possible to add a
// kareoke layer to the timeline, and generate the kareoke style bouncing ball in videodocker - if it is possible
// can we add a checkbox to videodocker menu for kareoke - when the video renders, render another video with
// transparent background with the kareoke lyrics that can be added as an overlay layer in timeline".
//
//   GET  /api/karaoke                 the 🎤 flag, every scene's overlay (status / file / waiting for the timeline),
//                                     the board song and whether it has lyrics on file
//   POST /api/karaoke/on              {on} - turning it on queues overlays for the scenes already rendered
//   POST /api/karaoke/scene/:n        (re)make scene n's overlay for its current take
//   GET  /api/karaoke/style           2.380.0 {style, defaults} - how every overlay looks (lib/karaokeStyle.js)
//   POST /api/karaoke/style           {style} -> normalized, saved in the settings file (ui.karaoke_style)
//   POST /api/karaoke/song            2.380.0 {song, start, dur, width, height} - the timeline's 🎤 karaoke generator:
//                                     an overlay for any song (a sound asset) and part of it -> {job, words, how}
//   POST /api/karaoke/:n/placed       {output} - the page put it on the timeline's Karaoke layer
//   GET  /api/karaoke/lyrics?song=    the song's lyrics (lyrics/<song>.txt, else its render record)
//   POST /api/karaoke/lyrics          {song, text} - write lyrics/<song>.txt (your own songs, or a correction)
//   GET  /api/karaoke/words?song=     2.408.0 {how, lyrics, fixed, words, text} - the timed words the overlay will show
//                                     (speech-to-text runs once if needed); `text` fills the 🎤 dialog's lyrics box
//   POST /api/karaoke/words           2.408.0 {song, words} - corrected words (text + times) for this song; [] = undo
// The work is lib/karaoke.js; the scene poll (routes/characters.js) queues and files the overlays.
const path = require("path");
const karaoke = require("../lib/karaoke");
const scenes = require("../lib/scenes");

function mount(app) {
  app.get("/api/karaoke", (req, res) => {
    const project = req.query.project;
    try { karaoke.harvest(project); } catch { /* the poll still answers */ }
    const st = scenes.load(project);
    const song = st.audio || "";
    res.json({ ...karaoke.readBoard(project), song, lyrics: !!(song && karaoke.lyricsFor(project, song).trim()) });
  });

  app.post("/api/karaoke/on", (req, res) => {
    const b = req.body || {};
    const r = karaoke.setOn(b.project, b.on === true || b.on === "true", scenes.load(b.project));
    res.json({ ok: true, ...r });
  });

  app.post("/api/karaoke/scene/:n", async (req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    if (!scenes.at(st, req.params.n)) return res.status(404).json({ error: "no such scene" });
    const e = await karaoke.queueScene(b.project, st, req.params.n);
    res.status(e && e.status === "failed" ? 400 : 200).json({ ok: !(e && e.status === "failed"), ...(e || {}) });
  });

  // 2.380.0 the karaoke STYLE (lib/karaokeStyle.js) - one for the video docker's scenes and the timeline's generator,
  // kept in the settings file (custom.settings ui.karaoke_style)
  app.get("/api/karaoke/style", (_req, res) => {
    const ks = require("../lib/karaokeStyle");
    res.json({ style: ks.read(), defaults: ks.DEFAULTS });
  });
  app.post("/api/karaoke/style", (req, res) => {
    const ks = require("../lib/karaokeStyle"), core = require("../lib/core");
    const style = ks.normalize((req.body || {}).style);
    const cfg = core.getConfig();
    cfg.ui = { ...(cfg.ui || {}), karaoke_style: style };
    core.setConfig(cfg);
    res.json({ ok: true, style });
  });

  // 2.380.0 (Tim: "add a karaoke generator to timeline"): {song, start, dur, width, height} -> {job, ...}
  app.post("/api/karaoke/song", async (req, res) => {
    const b = req.body || {};
    try {
      const r = await karaoke.queueSong(b.project, b);
      res.json({ ok: true, job: r.job.id, words: r.words, how: r.how, start: r.start, dur: r.dur, song: r.song });
    } catch (e) { res.status(400).json({ error: String(e && e.message || e) }); }
  });

  app.post("/api/karaoke/:n/placed", (req, res) => {
    const b = req.body || {};
    const r = karaoke.placed(b.project, req.params.n, b.output);
    res.status(r.ok ? 200 : 409).json(r);
  });

  app.get("/api/karaoke/lyrics", (req, res) => {
    const song = path.basename(String(req.query.song || ""));
    if (!song) return res.status(400).json({ error: "song required" });
    res.json({ song, text: karaoke.lyricsFor(req.query.project, song) });
  });

  app.post("/api/karaoke/lyrics", (req, res) => {
    const b = req.body || {};
    const song = path.basename(String(b.song || ""));
    if (!song) return res.status(400).json({ error: "song required" });
    const f = karaoke.saveLyrics(require("../lib/core").projDir(b.project || require("../lib/core").getProject()),
                                 song, b.text);
    if (!f) return res.status(400).json({ error: "the lyrics are empty" });
    res.json({ ok: true, file: "lyrics/" + f });
  });

  // 2.408.0 (Tim: "please add an edit lyrics box to the kareoke dialog - some of the words are wrong")
  app.get("/api/karaoke/words", async (req, res) => {
    const song = path.basename(String(req.query.song || ""));
    if (!song) return res.status(400).json({ error: "song required" });
    try {
      const t = await karaoke.timing(req.query.project, song, { fresh: req.query.fresh === "1" });
      res.json({ ok: true, song: t.song, how: t.how, lyrics: !!t.lyrics, fixed: !!t.fixed, words: t.words, text: karaoke.wordsText(t.words) });
    } catch (e) { res.status(e.status || 400).json({ error: String(e.message || e) }); }
  });
  app.post("/api/karaoke/words", (req, res) => {
    const b = req.body || {};
    const song = path.basename(String(b.song || ""));
    if (!song) return res.status(400).json({ error: "song required" });
    try { res.json({ ok: true, words: karaoke.saveWords(b.project, song, b.words) }); }
    catch (e) { res.status(e.status || 400).json({ error: String(e.message || e) }); }
  });
}

module.exports = { mount };
