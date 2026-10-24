#!/usr/bin/env node
/* bitGen Studio — 2.380.0: the karaoke STYLE and the timeline's karaoke GENERATOR.
 * Run: node scripts/test-karaokestyle.js
 * Tim: "add a karaoke generator to timeline" + "add karaoke options to settings in videodocker and timelinedocker
 * settings - font, font-size, color, text-shadow, border color, background color, background opacity, font-opacity,
 * background-border color, background-border width, box shadow, ball size, ball color, ball outline color,
 * background-height, position-top:n px".
 *   1. lib/karaokeStyle: defaults, colours (#rgb ok), numbers clamped, the font name cleaned; read() from the settings;
 *   2. GET / POST /api/karaoke/style (saved in the settings file, normalized);
 *   3. scripts/karaoke_ass.py: the style's colours / opacity / outline / shadow / font size in the ASS styles, the
 *      position-top layout, the ball; karaoke_worker.py draws the BACKGROUND BAND (colour at its opacity, border lines,
 *      box shadow) under the lyrics - checked on a real render's pixels;
 *   4. lib/karaoke.queueSong (POST /api/karaoke/song): any song, a part of it, the timeline's picture size, the style;
 *   5. the wiring: both ⚙ open the same dialog, the timeline's 🎤, the help page. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFileSync, spawnSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const KS = require(path.join(ROOT, "lib", "karaokeStyle"));
const core = require(path.join(ROOT, "lib", "core"));

function req(port, method, u, body) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: data ? { "Content-Type": "application/json", "Content-Length": data.length } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; });
      res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = { raw: b.slice(0, 80) }; } ok({ status: res.statusCode, j }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}

(async () => {
  // 1
  const n = KS.normalize({ font: "Impact<script>", font_size: "999", color: "#F80", bg_opacity: -5, position_top: "120", ball_color: "nope", junk: 1 });
  check("normalize: font cleaned, numbers clamped, #rgb -> #rrggbb, a bad colour -> its default, unknown keys dropped",
    n.font === "Impactscript" && n.font_size === 400 && n.color === "#ff8800" && n.bg_opacity === 0 && n.position_top === 120
    && n.ball_color === KS.DEFAULTS.ball_color && !("junk" in n), n);
  check("the defaults draw the 2.373 look (white words, yellow sweep and ball, no background band, automatic position)",
    KS.DEFAULTS.color === "#ffffff" && KS.DEFAULTS.highlight === "#ffd500" && KS.DEFAULTS.bg_opacity === 0 && KS.DEFAULTS.position_top === -1);
  check("read() takes ui.karaoke_style from the settings", KS.read({ ui: { karaoke_style: { font_size: 30 } } }).font_size === 30
    && KS.read({}).font_size === 0);

  // 2
  const express = require("express");
  const app = express();
  require(path.join(ROOT, "routes", "index.js")).mount(app);
  const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
  const port = srv.address().port;
  const before = JSON.parse(JSON.stringify((core.getConfig().ui || {}).karaoke_style || null));
  try {
    let r = await req(port, "POST", "/api/karaoke/style", { style: { bg_opacity: 60, bg_color: "#102040", position_top: 400, font_size: 44, highlight: "#ff3366" } });
    const g = await req(port, "GET", "/api/karaoke/style");
    check("POST /api/karaoke/style saves the normalized style in the settings; GET answers it with the defaults",
      r.status === 200 && g.j.style.bg_opacity === 60 && g.j.style.highlight === "#ff3366" && g.j.defaults.bg_opacity === 0
      && core.getConfig().ui.karaoke_style.position_top === 400, g.j);

    // 4: the generator
    const P = "zz_ks380_" + process.pid, orig = core.getProject();
    core.ensureProject(P); core.setProject(P);
    const pd = core.projDir(P);
    try {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=20", path.join(pd, "sound", "tune.wav")]);
      fs.mkdirSync(path.join(pd, "lyrics"), { recursive: true });
      fs.writeFileSync(path.join(pd, "lyrics", "tune.txt"), "[verse]\nOne two three four\nFive six seven eight\nNine ten\n");
      const K = require(path.join(ROOT, "lib", "karaoke"));
      const realMake = core.makeJob; let cap = null;
      core.makeJob = (params) => { cap = params; return { id: "kcap", params, log: [], status: "queued" }; };
      const asr = { transcribe: async () => { throw new Error("no whisper here"); } };
      let q;
      try { q = await K.queueSong(P, { song: "tune.wav", start: 4, dur: 6, width: 1280, height: 720 }, { asr }); }
      finally { core.makeJob = realMake; }
      check("queueSong: the song's part [4 s, 10 s] at the timeline's picture size, the words inside it, the karaoke style",
        q && q.start === 4 && q.dur === 6 && cap && cap.mode === "karaoke" && cap.karaoke.width === 1280 && cap.karaoke.height === 720
        && cap.karaoke.dur === 6 && cap.karaoke.words.length > 0 && cap.karaoke.words.every((w) => w.start >= 0 && w.end <= 6.001)
        && cap.karaoke.style && cap.karaoke.style.position_top === 400, { q, k: cap && cap.karaoke && { ...cap.karaoke, words: cap.karaoke.words.length } });
      let err = null;
      try { await K.queueSong(P, { song: "nope.wav" }, { asr }); } catch (e) { err = e; }
      check("...a song that is not a sound asset is refused in words", err && /not in this project's sound assets/.test(err.message));
      r = await req(port, "POST", "/api/karaoke/song", { song: "nope.wav" });
      check("POST /api/karaoke/song answers JSON (400 with the reason)", r.status === 400 && /not in this project/.test(r.j.error), r);
    } finally { core.setProject(orig); fs.rmSync(pd, { recursive: true, force: true }); }
  } finally {
    const cfg = core.getConfig(); cfg.ui = { ...(cfg.ui || {}) };
    if (before) cfg.ui.karaoke_style = before; else delete cfg.ui.karaoke_style;
    core.setConfig(cfg);
    srv.close();
  }

  // 3: the ASS + a real render
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ks-"));
  const py = spawnSync("python3", ["-c", `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import karaoke_ass as K
words = [{"text": w, "line": 0 if i < 4 else 1, "start": 0.3 + i * 0.4, "end": 0.6 + i * 0.4} for i, w in enumerate("Hello neon city tonight we dance".split())]
st = {"font_size": 40, "color": "#00ff00", "highlight": "#ff0000", "font_opacity": 50, "border_color": "#0000ff", "border_width": 5,
      "text_shadow": 4, "ball_color": "#112233", "ball_outline_color": "#445566", "ball_size": 12, "position_top": 100}
ass, _ = K.build(words, 1280, 720, {"dur": 3, "style": st})
sty = [l for l in ass.splitlines() if l.startswith("Style:")]
print(json.dumps({"sing": [l for l in sty if l.startswith("Style: Sing")][0], "ball": [l for l in sty if l.startswith("Style: Ball")][0],
                  "g": K.geometry(1280, 720, {"style": st}), "gd": K.geometry(1280, 720),
                  "pos": [l for l in ass.splitlines() if ",Sing," in l][0]}))
`], { encoding: "utf8" });
  let A = {};
  try { A = JSON.parse(py.stdout.trim().split("\n").pop()); } catch { A = { err: py.stderr.slice(-400) }; }
  check("ASS: the sung colour, the colour, the outline colour at the font opacity (&H80 = 50%), the outline + shadow width, the size",
    /^Style: Sing,[^,]+,40,&H800000FF&,&H8000FF00&,&H80FF0000&,/.test(A.sing || "") && /,1,5,4,1,0,0,0,1$/.test(A.sing || ""), A.sing);
  check("ASS: the ball's colour and outline colour", /^Style: Ball,[^,]+,40,&H00332211&,&H00332211&,&H00665544&,/.test(A.ball || ""), A.ball);
  check("position top 100 px: the band starts at 100 and the singing line sits inside it; -1 keeps the 2.373 layout (80%)",
    A.g && A.g.band_top === 100 && A.g.y_cur > 100 && A.g.y_cur < 100 + A.g.band_h && A.gd && A.gd.y_cur === 576 && A.g.ball_r === 12, A);
  const job = { params: { karaoke: { words: [{ text: "Hi", line: 0, start: 0.2, end: 1 }], width: 320, height: 180, dur: 1, fps: 24, name: "ks",
    style: { bg_opacity: 50, bg_color: "#0000ff", bg_border_width: 4, bg_border_color: "#ff0000", position_top: 60, bg_height: 60, box_shadow: 10, font_size: 24 } } },
    output_dir: tmp };
  fs.writeFileSync(path.join(tmp, "job.json"), JSON.stringify(job));
  const run = spawnSync("python3", [path.join(ROOT, "misc", "karaoke_worker.py"), path.join(tmp, "job.json")], { cwd: tmp, encoding: "utf8" });
  const out = fs.readdirSync(tmp).find((f) => f.endsWith(".webm"));
  let px = null;
  if (out) {
    const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-c:v", "libvpx-vp9", "-i", path.join(tmp, out), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
    const at = (x, y) => { const i = (y * 320 + x) * 4; return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]]; };
    px = { band: at(10, 90), border: at(10, 61), above: at(10, 20), below: at(10, 150) };
  }
  check("karaoke_worker: the BACKGROUND BAND - its colour at 50% (alpha ~128) inside, its border line on top, transparent above",
    px && px.band[2] > 200 && Math.abs(px.band[3] - 128) < 20 && px.border[0] > 200 && px.border[3] > 240 && px.above[3] < 10, { px, log: (run.stdout || "").slice(-300) });
  check("...the box shadow: a soft dark edge just below the band (not fully transparent)", px && px.below[3] < 60 && px.below[3] >= 0
    && (() => { const raw2 = execFileSync("ffmpeg", ["-loglevel", "error", "-c:v", "libvpx-vp9", "-i", path.join(tmp, out), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
                const i = (124 * 320 + 10) * 4; return raw2[i + 3] > 10; })(), px);
  fs.rmSync(tmp, { recursive: true, force: true });

  // 5: wiring
  const VD = read("ext", "videodock", "dock.html"), VR = read("ext", "videodock", "rendersettings.js"), TS = read("ext", "timelinedock", "tlsettings.js"),
        TD = read("ext", "timelinedock", "dock.html"), KG = read("ext", "timelinedock", "karaokegen.js"), H = read("static", "index.html"),
        KJ = read("static", "karaokestyle.js"), HP = read("static", "help", "timeline.html");
  check("the video docker's ⚙ and the timeline's ⚙ open the SAME karaoke style dialog",
    /id="vdSetKaraoke"/.test(VD) && /window\.KaraokeStyle\.open\(\)/.test(VR) && /id="tlsKaraoke"/.test(TS) && /window\.KaraokeStyle\.open\(\)/.test(TS)
    && /<script src="\/static\/karaokestyle\.js">/.test(H));
  check("the dialog: a titlebar, every field Tim listed, a live preview, GET / POST /api/karaoke/style",
    /ks-title"><h2>🎤 Karaoke style/.test(KJ) && ["font", "font_size", "color", "text_shadow", "border_color", "bg_color", "bg_opacity", "font_opacity",
      "bg_border_color", "bg_border_width", "box_shadow", "ball_size", "ball_color", "ball_outline_color", "bg_height", "position_top"]
      .every((k) => KJ.includes('["' + k + '"')) && /id="ksPrev"/.test(KJ) && /\/api\/karaoke\/style/.test(KJ));
  check("the timeline's 🎤 (icon only) opens the generator; it posts /api/karaoke/song and places the overlay with tlPlaceKaraoke",
    /id="tlKaraokeGen"[^>]*>🎤<\/button>/.test(TD) && /\/api\/karaoke\/song/.test(KG) && /window\.tlPlaceKaraoke\(\{ name: out, start: p\.at/.test(KG)
    && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("karaokegen.js"));
  check("the help page explains the karaoke generator and the style (not the dock)", /id="karaoke"/.test(HP) && /Karaoke style/.test(HP));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
