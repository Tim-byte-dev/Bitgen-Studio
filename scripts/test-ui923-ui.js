#!/usr/bin/env node
/* bitGen Studio — 2.923.0 in a REAL browser: the 🎶 Song tab transcribes a song with no lyrics, with a progress bar.
 * Tim: "can we add a transcribe and put the lyrics in the song tab if no lyrics are found. let user know that it is
 * transcribing with a progress bar"
 * Against the e2e server (H3_URL, default :8311). Whisper is not installed there: the suite's stand-in hears the words
 * the page gives it (window.BG_TEST_SEGMENTS - the server takes them under H3_E2E only) through the same job, stages and
 * bar; without them the real path runs and says Speech to Text is not installed. No Playwright / ffmpeg = SKIP. */
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
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const get = (p) => fetch(URL_ + p).then((r) => r.json());
const SEGS = [{ start: 0, end: 2, text: "Neon lights on the wet street" }, { start: 2.2, end: 4, text: "we run all night" }, { start: 8, end: 10, text: "here comes the chorus" }];
const LYR = "Neon lights on the wet street\nwe run all night\n\nhere comes the chorus";

(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { console.log("SKIP: no ffmpeg here"); return; }
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg923ui-"));
  const bare = path.join(T, "my-demo.mp3");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=d=3", "-c:a", "libmp3lame", "-q:a", "5", bare]);
  const where = await get("/api/outputs/where");
  const inGallery = path.join(where.dir, "e2e923-gallery-song.mp3"); fs.copyFileSync(bare, inGallery);
  const b = await chromium.launch();
  try {
    const open = async (stub) => {
      const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
      const errs = []; p.on("pageerror", (e) => errs.push(e.message));
      if (stub) await p.addInitScript((segs) => { window.BG_TEST_SEGMENTS = segs;
        Object.defineProperty(window, "H3NeedInstall", { configurable: true, get() { return { ensure: () => Promise.resolve(true), status: () => Promise.resolve(true) }; }, set() {} }); }, SEGS);
      await p.goto(URL_ + "/");
      await p.waitForFunction(() => window.H3SongFile && window.H3MuSong && document.getElementById("muTranscribe"), null, { timeout: 60000 });
      await p.evaluate(() => { H3MuSong.apply({ title: "", lyrics: "", caption: "", dur: "", batch: 1, seed: "", style_id: "" }); });
      return { p, errs };
    };
    // the Song tab's buttons are pressed in the page: in this sandbox's saved layout the floating prompt docker covers them
    const state = (p) => p.evaluate(() => { const b = document.getElementById("muTrBox"); return { shown: !b.classList.contains("hidden"), busy: b.classList.contains("busy"), ok: b.classList.contains("ok"), bad: b.classList.contains("bad"),
      text: document.getElementById("muTrText").textContent, pct: document.getElementById("muTrPct").textContent, width: document.getElementById("muTrFill").style.width,
      lyrics: document.getElementById("muLyrics").value, status: document.getElementById("muStatus").textContent, use: !document.getElementById("muTrUse").classList.contains("hidden"),
      btn: document.getElementById("muTranscribe").disabled }; });
    const follow = async (p) => { const seen = []; for (let i = 0; i < 60; i++) { const s = await state(p); seen.push(s); if (s.ok || s.bad) break; await p.waitForTimeout(250); } return seen; };

    // ---- a song with no lyrics, from this computer: transcribed by itself
    const A = await open(true);
    check("before a song is loaded, 🎤 Transcribe is off and there is no bar", (await state(A.p)).btn === true && !(await state(A.p)).shown);
    await A.p.setInputFiles("#muFromFileIn", bare);
    const seen = await follow(A.p);
    const first = seen.find((s) => s.shown) || {}, mid = seen.filter((s) => /hearing the words/.test(s.text)), end = seen[seen.length - 1];
    check("loaded with no lyrics: the bar shows at once - 🎤 Transcribing my-demo.mp3, what it is doing, a striped bar while it cannot be measured",
      first.shown && /🎤 Transcribing my-demo\.mp3/.test(first.text) && seen.some((s) => s.busy && /loading the speech model|checking Speech to Text|starting/.test(s.text)), seen.slice(0, 4));
    const pcts = mid.map((s) => parseInt(s.pct, 10)).filter((n) => !isNaN(n));
    check("...then 'hearing the words' with a % that climbs (and the bar's width with it)", pcts.length >= 2 && pcts[pcts.length - 1] > pcts[0] && pcts.every((v, i) => !i || v >= pcts[i - 1]) && mid.some((s) => /%$/.test(s.width) && parseFloat(s.width) > 0), pcts);
    check("...done: green at 100 %, the heard words in the Lyrics box (a blank line at the singer's pause), told to check them, the whole mix said",
      end.ok && end.pct === "100 %" && end.lyrics === LYR && /Transcribed my-demo\.mp3 in \d+ s - the words are in the Lyrics box \(check them/.test(end.text) && /whole mix/.test(end.text) && /the heard words are in the Lyrics box/.test(end.status), end);
    check("🎤 Transcribe is on now (the song is loaded)", end.btn === false);

    // ---- 🎤 on purpose: the box has words -> the second press replaces them
    await A.p.evaluate(() => { document.getElementById("muLyrics").value = "my own words"; window.BG_TEST_SEGMENTS = [{ start: 0, end: 2, text: "a second hearing" }]; });
    await A.p.evaluate(() => document.getElementById("muTranscribe").click());
    const once = await state(A.p);
    check("🎤 once with words in the box: nothing yet - 'press 🎤 Transcribe again to replace them'", once.lyrics === "my own words" && /press 🎤 Transcribe again/.test(once.status), once);
    await A.p.evaluate(() => document.getElementById("muTranscribe").click());
    const again = (await follow(A.p)).pop();
    check("🎤 twice: transcribed again, the heard words replace mine", again.ok && again.lyrics === "a second hearing", again);

    // ---- a Gallery song dropped on the tab while the box holds words: kept, ⤵ offered
    await A.p.evaluate(() => { document.getElementById("muLyrics").value = "words of the last song"; window.BG_TEST_SEGMENTS = [{ start: 0, end: 2, text: "the gallery song's words" }]; });
    await A.p.evaluate((name) => {
      dragPayload = { type: "output", kind: "sound", name: name };
      const pane = document.getElementById("muPaneSong"), dt = new DataTransfer();
      pane.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
      pane.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })); dragPayload = null;
    }, path.basename(inGallery));
    const g = (await follow(A.p)).pop();
    check("a Gallery song (by name) with words already in the box: transcribed, but the box KEPT - ⤵ Use the heard words offered", g.ok && g.lyrics === "words of the last song" && g.use && /already had words/.test(g.text), g);
    await A.p.evaluate(() => document.getElementById("muTrUse").click());
    const u = await state(A.p);
    check("⤵ puts the heard words in", u.lyrics === "the gallery song's words" && !u.use, u);
    await A.p.evaluate(() => document.getElementById("muTrX").click());
    check("✕ hides the bar", !(await state(A.p)).shown);
    check("no page errors", A.errs.length === 0, A.errs);
    await A.p.close();

    // ---- the real path here: Speech to Text is not installed
    const B = await open(false);
    await B.p.setInputFiles("#muFromFileIn", bare);
    await B.p.waitForSelector("#niCancel", { timeout: 15000 }).catch(() => {});
    const asked = await B.p.evaluate(() => !!document.getElementById("niCancel"));
    check("Speech to Text not installed: the ⬇ Download / Cancel box asks first (static/needinstall.js)", asked);
    if (asked) await B.p.click("#niCancel");
    const nb = (await follow(B.p)).pop();
    check("...Cancel: the bar turns red and says it was not transcribed and why; the Lyrics box untouched", nb.bad && /Not transcribed - Speech to Text is not installed/.test(nb.text) && nb.lyrics === "", nb);
    const srv = await fetch(URL_ + "/api/song-tags/transcribe", { method: "POST", body: (() => { const fd = new FormData(); fd.append("src", "output"); fd.append("name", path.basename(inGallery)); return fd; })() }).then((r) => r.json());
    let sj = srv; for (let i = 0; i < 40 && sj.stage !== "error" && sj.stage !== "done"; i++) { await new Promise((r) => setTimeout(r, 250)); sj = await get("/api/song-tags/transcribe/" + srv.id); }
    check("the server's own check: no Speech to Text = the job stops with need: whisper and says how to get it", sj.stage === "error" && sj.need === "whisper" && /Speech to Text is not installed/.test(sj.error), sj);
    const nf = await fetch(URL_ + "/api/song-tags/transcribe", { method: "POST", body: (() => { const fd = new FormData(); fd.append("name", "nope-not-here.mp3"); return fd; })() });
    const gone = await fetch(URL_ + "/api/song-tags/transcribe/ffffffffffff");
    check("a song not in the project = 404; an unknown job = 404", nf.status === 404 && gone.status === 404, [nf.status, gone.status]);
    check("no page errors (the real path)", B.errs.length === 0, B.errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { fs.unlinkSync(inGallery); } catch { /* fine */ }
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
