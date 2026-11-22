#!/usr/bin/env node
/* bitGen Studio — 2.922.0 in a REAL browser: a song file into the Audio docker's 🎶 Song tab - its title, lyrics and details
 * from its own tags.
 * Tim: "if i load a song into our song tab in audio that was generated with bitgen, can we add the lyrics and details and
 * name from the meta tags?"
 * Against the e2e server (H3_URL, default :8311) and the stub ComfyUI on :8388: a song is MADE (a music style of its own,
 * /api/genmusic -> the music worker -> scripts/song_tags.py), then loaded back with 🎵 From file, dropped from the Gallery,
 * an older bitGen song (ComfyUI's graph tag only) and a stranger's mp3 uploaded. No Playwright / ffmpeg / stub = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/$/, "");
const STUB = "http://127.0.0.1:8388";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = (p, b) => fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });
const get = (p) => fetch(URL_ + p).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { console.log("SKIP: no ffmpeg here"); return; }
  try { if (!(await fetch(STUB + "/system_stats")).ok) throw 0; } catch { console.log("SKIP: no stub ComfyUI on :8388"); return; }
  const cfg0 = await get("/api/config");
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg922ui-"));
  let SID = "";
  const b = await chromium.launch();
  try {
    await post("/api/config", { engine: { backend: "comfy", comfy: { url: STUB } } });
    const st = await (await post("/api/styles", { name: "T922 Neon Style", kind: "music", arch: "minimax-music3", workflow: "comfy_workflows/audio_minimax_music3.json",
      caption: "Genre: synthwave. Vocal: soft female.", max_duration: 4 })).json();
    SID = st.style && st.style.id;
    const LYR = "[verse]\nneon lights on the wet street\n[chorus]\nwe run all night";
    const job = await (await post("/api/genmusic", { prompt: LYR, style_id: SID, title: "Neon Nights", format: "mp3", seed: 4242 })).json();
    let j = {};
    for (let i = 0; i < 90; i++) { j = await get("/api/jobs/" + job.id); if (j.status === "done" || j.status === "failed") break; await sleep(1000); }
    const log = ((await get("/api/jobs/" + job.id + "?log_from=0")).log || []).join("\n");
    const SONG = j.output || "";
    check("a song is made and the worker TAGS it (title, lyrics, details)", j.status === "done" && /^Neon-Nights_.*_s4242_.*\.mp3$/.test(SONG) && /\[worker\] tagged Neon-Nights_/.test(log), { status: j.status, SONG, log: log.slice(-600) });
    const where = await get("/api/outputs/where");
    const abs = path.join(where.dir, SONG);
    const tags = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format_tags", "-of", "json", abs], { encoding: "utf8" })).format.tags || {};
    check("...a music player sees its title and lyrics (ID3 TIT2 / USLT), ComfyUI's graph tag is still there", tags.title === "Neon Nights" && tags.lyrics === LYR && !!tags.prompt && !!tags.bitgen, Object.keys(tags));

    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL_ + "/");
    await p.waitForFunction(() => window.H3SongFile && window.H3MuSong && document.getElementById("muFromFile") && document.getElementById("musicSel"), null, { timeout: 60000 });
    await p.waitForFunction((id) => [...document.getElementById("musicSel").options].some((o) => o.value === id), SID, { timeout: 20000 }).catch(() => {});
    const blank = () => p.evaluate(() => { H3MuSong.apply({ title: "", lyrics: "", caption: "", dur: "", batch: 1, seed: "", style_id: "" }); document.getElementById("muStatus").textContent = ""; });
    const fields = () => p.evaluate(() => { const v = (id) => (document.getElementById(id) || {}).value; return { title: v("muTitle"), lyrics: v("muLyrics"), caption: v("muCaption"), style: v("musicSel"), dur: v("muDur"), seed: v("muSeed"), format: v("muFormat"), status: document.getElementById("muStatus").textContent, name: v("muSongName") }; });
    const settle = () => p.waitForFunction(() => /^🎵 (?!reading)/.test(document.getElementById("muStatus").textContent), null, { timeout: 20000 }).catch(() => {});

    // ---- 🎵 From file (a song from this computer)
    await blank();
    await p.evaluate(() => { const f = document.getElementById("muFormat"); f.value = "flac"; });
    await p.setInputFiles("#muFromFileIn", abs);
    await settle();
    const f1 = await fields();
    check("🎵 From file: the title, lyrics, caption, style, length, seed and save-as fill the Song tab", f1.title === "Neon Nights" && f1.lyrics === LYR && f1.caption === "Genre: synthwave. Vocal: soft female." && f1.style === SID
      && f1.dur === "4" && f1.seed === "4242" && f1.format === "mp3" && f1.name === "Neon Nights", f1);
    check("...and says what it found and where from (bitGen's tags)", /🎵 "Neon Nights" - title, lyrics, caption, style, length, seed, save-as/.test(f1.status) && /from bitGen's tags/.test(f1.status), f1.status);

    // ---- dropped from the Gallery (the app's own drag)
    await blank();
    await p.evaluate((name) => {
      dragPayload = { type: "output", kind: "sound", name: name };                     // what a Gallery song tile's dragstart sets
      const pane = document.getElementById("muPaneSong"), dt = new DataTransfer(); dt.setData("text/plain", name);
      const over = new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }); pane.dispatchEvent(over);
      window.__overOk = over.defaultPrevented && pane.classList.contains("muDropOn");
      pane.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
      dragPayload = null;
    }, SONG);
    await settle();
    const f2 = await fields();
    check("a song dragged from the Gallery onto the Song tab: it takes the drop (dashed outline) and fills in the same", (await p.evaluate(() => window.__overOk)) && f2.title === "Neon Nights" && f2.lyrics === LYR && f2.seed === "4242" && f2.style === SID, f2);

    // ---- an older bitGen song: only ComfyUI's graph tag (every bitGen song before 2.922.0)
    const graph = JSON.parse(tags.prompt);
    const old = path.join(T, "Paper-Moon_20261001-090909_s77_cd34ef.mp3");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=d=3", "-c:a", "libmp3lame", "-q:a", "5", "-metadata", "prompt=" + JSON.stringify(graph), old]);
    await blank();
    await p.evaluate(() => { document.getElementById("muLyrics").value = ""; });
    await p.setInputFiles("#muFromFileIn", old);
    await settle();
    const f3 = await fields();
    check("an OLDER bitGen song (ComfyUI's graph tag only): its lyrics, caption and seed from the graph, its title from the filename", f3.lyrics === LYR && f3.caption === "Genre: synthwave. Vocal: soft female." && f3.seed === "4242" && f3.title === "Paper Moon"
      && /from ComfyUI's graph tag/.test(f3.status) && /the filename/.test(f3.status), f3);

    // ---- a song from somewhere else / no details at all / not a song
    const other = path.join(T, "track01.mp3");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=d=2", "-c:a", "libmp3lame", "-q:a", "5", "-metadata", "title=Someone Else", "-metadata", "lyrics=la la la", "-metadata", "genre=Folk", other]);
    await blank();
    await p.setInputFiles("#muFromFileIn", other);
    await settle();
    const f4 = await fields();
    check("a song made elsewhere: its player tags (title, lyrics), the genre noted, the style left alone", f4.title === "Someone Else" && f4.lyrics === "la la la" && f4.style === "" && /Folk/.test(f4.status), f4);
    const bare = path.join(T, "bare.wav");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=d=2", "-c:a", "pcm_s16le", bare]);
    await p.evaluate(() => { document.getElementById("muLyrics").value = "my own words"; document.getElementById("muTitle").value = "Mine"; });
    await p.setInputFiles("#muFromFileIn", bare);
    await settle();
    const f5 = await fields();
    check("a song with no details: nothing changed (my words kept), it says so", f5.lyrics === "my own words" && f5.title === "Mine" && /no title, lyrics or details in its tags - nothing changed/.test(f5.status), f5);
    const txt = await fetch(URL_ + "/api/song-tags", { method: "POST", body: (() => { const fd = new FormData(); fd.append("audio", new Blob(["hello"]), "notes.txt"); return fd; })() });
    const outside = await fetch(URL_ + "/api/song-tags?src=output&name=" + encodeURIComponent("../../package.json"));
    check("not a song = 400; a name outside the project's folders = refused", txt.status === 400 && outside.status === 400, [txt.status, outside.status]);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { if (SID) await fetch(URL_ + "/api/styles/" + SID, { method: "DELETE" }); } catch { /* fine */ }
    try { await post("/api/config", { engine: { comfy: { url: (((cfg0.engine || {}).comfy) || {}).url || "http://127.0.0.1:8188" } } }); } catch { /* fine */ }
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
