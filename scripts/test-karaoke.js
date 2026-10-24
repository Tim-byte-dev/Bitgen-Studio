#!/usr/bin/env node
/* bitGen Studio — 2.373.0: a song's lyrics file, and the video docker's 🎤 Karaoke overlays.
 * Run: node scripts/test-karaoke.js
 * Tim: "when bitgen produces a song save the lyrics in a txt file in the project folder. is it possible to add a
 * kareoke layer to the timeline, and generate the kareoke style bouncing ball in videodocker - if it is possible
 * can we add a checkbox to videodocker menu for kareoke - when the video renders, render another video with
 * transparent background with the kareoke lyrics that can be added as an overlay layer in timeline - first render
 * of the scene won't have the kareoke lyrics".
 *   1. lyrics: section tags dropped, the KNOWN words timed by speech-to-text (missed words placed between their
 *      neighbours), the even fallback, a window of the song shifted to the overlay's 0;
 *   2. the lyrics file: lyrics/<song>.txt, the render record as a fallback;
 *   3. timing: one transcription per song (cached), the fallbacks said in words;
 *   4. the board: 🎤 on queues the rendered scenes, an overlay job per take (the take's size and length, the
 *      scene's window), harvest -> waiting for the timeline, placed clears it, the produced film's Karaoke layer;
 *   5. the ASS: one singing row at a time, every word swept, a ball that lands on each word as it starts;
 *   6. the wiring: core (worker, lyrics save), worker.py (alpha overlays, silent layers), routes, dock, page. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 700) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const K = require(path.join(ROOT, "lib", "karaoke"));

(async () => {
  // 1
  const lw = K.lyricWords("[verse]\nHello neon city tonight\n\n[chorus]\nWe dance, until the light!\n");
  check("lyricWords: [tags] and empty lines dropped, a line number per lyric line",
    lw.length === 9 && lw[0].text === "Hello" && lw[0].line === 0 && lw[4].text === "We" && lw[4].line === 1, lw);
  const heard = [{ text: "hello", start: 1, end: 1.4 }, { text: "neon", start: 1.5, end: 2 },
                 { text: "tonight", start: 3, end: 3.6 }, { text: "we", start: 5, end: 5.3 },
                 { text: "dance", start: 5.4, end: 6 }, { text: "light", start: 8, end: 8.8 }];
  const al = K.align(lw, heard);
  const by = (t) => al.words.find((w) => w.text === t);
  check("align: the lyric words keep the LYRICS' spelling and take speech-to-text's times",
    al.matched === 6 && by("Hello").start === 1 && by("dance,").start === 5.4 && by("light!").end === 8.8, al);
  check("align: a word speech-to-text missed sits between its neighbours (city between neon and tonight)",
    by("city").start >= 2 && by("city").end <= 3 && by("until").start >= 6 && by("the").end <= 8);
  check("align: the times run forward", al.words.every((w, i) => w.end > w.start && (i === 0 || w.start >= al.words[i - 1].start - 1e-9)));
  const ev = K.evenTiming(lw, 30);
  check("evenTiming: spread over the song after a short lead-in", ev.length === 9 && ev[0].start > 0 && ev[8].end <= 30 && ev[8].end > 20, ev.slice(-1));
  const win = K.windowWords(al.words, 5, 2);
  check("windowWords: only the window's words, shifted so 0 = the scene's first frame",
    win.length >= 2 && win[0].text === "We" && win[0].start === 0 && win.every((w) => w.end <= 2), win);

  // 2 + 3 + 4 in a temp project
  const orig = core.getProject();
  const P = "zzkar" + process.pid;
  const pdir = core.projDir(P);
  try {
    core.ensureProject(P);
    core.setProject(P);
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:duration=12",
                         path.join(pdir, "sound", "song.wav")]);
    check("saveLyrics: lyrics/<song stem>.txt", K.saveLyrics(pdir, "song.wav", "Hello neon city tonight\nWe dance") === "song.txt"
      && fs.readFileSync(path.join(pdir, "lyrics", "song.txt"), "utf8").startsWith("Hello neon"));
    check("lyricsFor: the txt first", K.lyricsFor(P, "song.wav").startsWith("Hello neon"));
    fs.mkdirSync(path.join(pdir, "songs"), { recursive: true });
    fs.writeFileSync(path.join(pdir, "songs", "Other.music"), JSON.stringify({ filename: "other.flac", lyrics: "from the record" }));
    check("lyricsFor: a song without a txt falls back to its render record", K.lyricsFor(P, "other.flac") === "from the record");
    let calls = 0;
    const asr = { transcribe: async () => { calls++; return { segments: [
      { start: 1, end: 3, text: "hello neon city tonight", words: [
        { text: "hello", start: 1, end: 1.4 }, { text: "neon", start: 1.5, end: 2 }, { text: "city", start: 2.1, end: 2.5 },
        { text: "tonight", start: 2.6, end: 3 }] },
      { start: 6, end: 7, text: "we dance", words: [{ text: "we", start: 6, end: 6.3 }, { text: "dance", start: 6.4, end: 7 }] }] }; } };
    let t = await K.timing(P, "song.wav", { asr });
    check("timing: the lyrics timed by speech-to-text, said so", calls === 1 && /timed by speech-to-text \(6 of 6/.test(t.how) && t.words[4].start === 6, t.how);
    t = await K.timing(P, "song.wav", { asr });
    check("timing: cached - one transcription per song", calls === 1 && fs.existsSync(path.join(pdir, "karaoke", "song.timing.json")));
    const bad = { transcribe: async () => { throw new Error("faster-whisper is not installed"); } };
    t = await K.timing(P, "song.wav", { asr: bad, fresh: true });
    check("timing: no speech-to-text = the lyrics spread evenly, the reason said", /spread evenly \(no speech-to-text: faster-whisper/.test(t.how) && t.words.length === 6, t.how);
    fs.unlinkSync(path.join(pdir, "lyrics", "song.txt"));
    t = await K.timing(P, "song.wav", { asr, fresh: true });
    check("timing: no lyrics file = what speech-to-text heard, a line per pause", /no lyrics file/.test(t.how) && t.words[0].line === 0 && t.words[4].line === 1, t);
    K.saveLyrics(pdir, "song.wav", "Hello neon city tonight\nWe dance");

    // 4: the board
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=24:d=4",
                         "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(pdir, "video", "scene_1_take.mp4")]);
    const st = { audio: "song.wav", list: [
      { n: 1, status: "rendered", output: "scene_1_take.mp4", audio_start: 5, audio_dur: 4 },
      { n: 2, status: "idle" }] };
    const realMake = core.makeJob;
    const made = [];
    core.makeJob = (params) => { const j = { id: "kj" + made.length, params, finished: null, status: "queued", log: [] }; made.push(j); core.jobs.set(j.id, j); return j; };
    try {
      check("🎤 off: a landing take queues nothing", K.onTake(P, st, 1, { asr }) === false && made.length === 0);
      const on = K.setOn(P, true, st, { asr });
      check("🎤 on: the rendered scenes are queued (scene 2 has no take)", on.on === true && on.queued.join() === "1", on);
      for (let i = 0; i < 50 && !made.length; i++) await new Promise((ok) => setTimeout(ok, 40));
      const kp = made[0] && made[0].params;
      check("the overlay job: karaoke mode, the take's size and length, the scene's window of the song, its words from 0",
        kp && kp.mode === "karaoke" && kp.karaoke.width === 320 && kp.karaoke.height === 180
        && Math.abs(kp.karaoke.dur - 4) < 0.2 && kp.karaoke.window.startsWith("5s") && kp.karaoke.words[0].text === "We"
        && kp.karaoke.words[0].start >= 0 && kp.karaoke.words[0].start < 2, kp && kp.karaoke);
      let b = K.readBoard(P);
      check("the board: scene 1 queued with its job and take", b.scenes["1"].status === "queued" && b.scenes["1"].job === "kj0" && b.scenes["1"].take === "scene_1_take.mp4", b.scenes["1"]);
      made[0].finished = Date.now() / 1000; made[0].status = "done"; made[0].output = "scene_1_karaoke_x.webm";
      check("harvest: a finished overlay is filed and waits for the timeline", K.harvest(P) === true
        && K.readBoard(P).scenes["1"].status === "done" && K.readBoard(P).scenes["1"].pending === true);
      check("placed: the page's ack clears the wait (a stale name is refused)",
        K.placed(P, 1, "old.webm").ok === false && K.placed(P, 1, "scene_1_karaoke_x.webm").ok === true
        && K.readBoard(P).scenes["1"].pending === false);
      fs.writeFileSync(path.join(pdir, "video", "scene_1_karaoke_x.webm"), "x");
      const L = K.timelineLayer(P, [{ n: 1, take: "scene_1_take.mp4", start: 3 }, { n: 2, take: "b.mp4", start: 7 }]);
      check("the produced film: a Karaoke layer (on top, silent) with the overlay at its take's start",
        L && L.karaoke === true && L.muted === true && L.clips.length === 1 && L.clips[0].start === 3 && L.clips[0].src === "video", L);
      check("...an overlay made for an OLDER take is not used",
        K.timelineLayer(P, [{ n: 1, take: "scene_1_take_v2.mp4", start: 0 }]) === null);
      const off = K.setOn(P, false, st);
      check("🎤 off again: nothing queued", off.on === false && off.queued.length === 0 && K.onTake(P, st, 1) === false);
      const st2 = { audio: "", list: st.list };
      const e = await K.queueScene(P, st2, 1, { asr });
      check("a board with no song: the scene says why", e.status === "failed" && /no song/.test(e.error), e);
    } finally { core.makeJob = realMake; for (const j of made) core.jobs.delete(j.id); }
  } finally {
    try { core.setProject(orig); } catch { /* restored */ }
    fs.rmSync(pdir, { recursive: true, force: true });
  }

  // 5: the ASS (python)
  const py = spawnSync("python3", ["-c", `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import karaoke_ass as K
words = []
t = 0.5
for li, line in enumerate(["Hello neon city tonight", "We dance until the morning light", "Never let it die"]):
    for w in line.split():
        words.append({"text": w, "line": li, "start": round(t, 2), "end": round(t + 0.4, 2)}); t += 0.5
    t += 0.3
ass, fonts = K.build(words, 1280, 720, {"dur": t + 1})
ev = [l for l in ass.splitlines() if l.startswith("Dialogue:")]
def secs(s):
    h, m, x = s.split(":"); return int(h) * 3600 + int(m) * 60 + float(x)
sing = [l.split(",") for l in ev if ",Sing," in l]
rows = {}
for p in sing:
    rows.setdefault((p[1], p[2]), 0); rows[(p[1], p[2])] += 1
spans = sorted((secs(a), secs(b)) for (a, b) in rows)
overlap = any(spans[i][1] > spans[i + 1][0] + 1e-6 for i in range(len(spans) - 1))
ball = [l.split(",") for l in ev if ",Ball," in l]
bs = sorted((secs(p[1]), secs(p[2])) for p in ball)
gaps = [bs[i + 1][0] - bs[i][1] for i in range(len(bs) - 1)]
lands = 0
for w in words:
    if any(abs(e - w["start"]) < 0.02 for (_, e) in bs): lands += 1
print(json.dumps({"words": len(sing), "rows": len(rows), "overlap": overlap, "ball": len(ball),
                  "maxgap": max(gaps) if gaps else 0, "lands": lands, "kf": all("\\\\kf" in ",".join(p) for p in sing),
                  "move": all("\\\\move(" in ",".join(p) for p in ball), "next": sum(1 for l in ev if ",Next," in l)}))
`], { encoding: "utf8" });
  let a = {};
  try { a = JSON.parse(py.stdout.trim().split("\n").pop()); } catch { a = { err: py.stderr.slice(-400) }; }
  check("ASS: a Sing event per word (swept with \\kf), three lines = three rows", a.words === 14 && a.kf === true && a.rows === 3, a);
  check("ASS: ONE singing row at a time (a line leaves before the next arrives)", a.overlap === false, a);
  check("ASS: the next line waits dimmed underneath", a.next === 2, a);
  check("ASS: the ball moves (\\move) without a gap and LANDS on every word as it starts", a.move === true && a.maxgap < 0.011 && a.lands === 14, a);

  // 6: wiring
  const CORE = read("lib", "core.js"), W = read("misc/worker.py"), KW = read("misc/karaoke_worker.py"), IDX = read("routes", "index.js"),
        CH = read("routes", "characters.js"), DOCK = read("ext", "videodock", "dock.html"), H = read("static", "index.html");
  check("core: the karaoke worker, no VRAM hand-over for it, the song's lyrics saved as lyrics/<sound asset>.txt",
    /karaoke: "karaoke_worker\.py"/.test(CORE) && /\["export", "karaoke"\]\.includes/.test(CORE)
    && /require\("\.\/karaoke"\)\.saveLyrics\(projDir\(currentProject\), soundName \|\| audio, job\.params\.prompt/.test(CORE));
  check("karaoke_worker.py: a transparent canvas, the ASS with alpha, VP9 yuva420p + alpha_mode, @@OUT",
    /color=c=black@0\.0/.test(KW) && /:alpha=1/.test(KW) && /yuva420p/.test(KW) && /alpha_mode=1/.test(KW) && /@@OUT/.test(KW));
  check("worker.py: an alpha webm overlay is read through libvpx; a silent overlay adds no audio",
    /def has_alpha\(p\)/.test(W) && /if has_alpha\(c\["path"\]\):/.test(W) && /"libvpx-vp9" if _stream_codec/.test(W)
    && /if not has_audio\(Path\(c\["path"\]\)\):\s+# 2\.373\.0/.test(W));
  check("routes: /api/karaoke mounted from routes/karaoke.js; the scene poll queues + files overlays; the film gets the layer",
    /require\("\.\/karaoke"\)\.mount\(app\)/.test(IDX) && /karaoke"\)\.onTake\(project, st, r\.n\)/.test(CH)
    && /karaoke"\)\.harvest\(project\)/.test(CH) && /karaoke"\)\.timelineLayer\(b\.project/.test(CH));
  check("the video docker: the 🎤 Karaoke checkbox + karaoke.js", /id="vdKaraoke"/.test(DOCK) && /🎤 Karaoke<\/label>/.test(DOCK)
    && JSON.parse(read("ext", "videodock", "ext.json")).scripts.includes("karaoke.js"));
  const KJ = read("ext", "videodock", "karaoke.js");
  check("karaoke.js: the checkbox posts /api/karaoke/on, ready overlays go to tlPlaceKaraoke then /placed",
    /\/api\/karaoke\/on/.test(KJ) && /window\.tlPlaceKaraoke\(/.test(KJ) && /\/placed"/.test(KJ));
  check("the page: ONE Karaoke layer kept on top (also when a scene lands), an overlay replaces its scene's old one",
    /function tlKaraokeOnTop\(\)/.test(H) && /tl\.vlayers\.push\(L\);\s*tlKaraokeOnTop\(\);/.test(H)
    && /c\.kar_n === o\.n/.test(H) && /window\.tlPlaceKaraoke = tlPlaceKaraoke;/.test(H));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
