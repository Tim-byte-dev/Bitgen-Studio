#!/usr/bin/env node
/* bitGen Studio — 2.408.0 in a REAL browser against the REAL app: the 🎤 karaoke dialog's ✎ Edit lyrics / ⏱ Words &
 * timing, and the 📝 Transcript dialog (cut words, undo, fillers, pauses, scene cuts).
 * Tim: "please add an edit lyrics box to the kareoke dialog - some of the words are wrong. and continue with the
 * premier catchup - do whats most useful next".
 * Speech-to-text is not needed: what it "heard" is answered by the test (page.route) - the rest is the real app.
 * Run against the running app (H3_URL, default :8311). No Playwright = SKIP (exit 0). */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.408 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const X = require(path.join(ROOT, "static", "textedit.js"));
const P = "zz_prem3ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem3ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "color=red:s=320x180:d=2:r=25", "-f", "lavfi", "-i", "color=blue:s=320x180:d=2:r=25", "-f", "lavfi", "-i", "testsrc=s=320x180:d=2:r=25",
    "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-filter_complex", "[0][1][2]concat=n=3:v=1[v]", "-map", "[v]", "-map", "3:a",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(T, "uishots.webm")]);
const HEARD = [["hello", 0.5], ["wurld", 1.0], ["how", 2.0], ["are", 2.4], ["yu", 2.8]];
const SAID = [{ start: 0.3, end: 0.6, word: "So" }, { start: 0.7, end: 0.9, word: "um" }, { start: 1.0, end: 1.4, word: "this" }, { start: 1.5, end: 1.8, word: "is" },
              { start: 3.6, end: 4.0, word: "the" }, { start: 4.1, end: 4.5, word: "test." }];

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    const pdir = path.join(ROOT, "projects", P);
    fs.mkdirSync(path.join(pdir, "sound"), { recursive: true });
    ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=5", path.join(pdir, "sound", "uisong.wav")]);
    { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, "uishots.webm"))]), "uishots.webm"); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    // what "speech-to-text heard": the song (until it has lyrics), the clip's words
    let lyricsSaved = false, sentWords = null;
    await p.route("**/api/karaoke/words**", async (route) => {
      const rq = route.request();
      if (rq.method() === "POST") { sentWords = JSON.parse(rq.postData() || "{}"); return route.continue(); }
      if (lyricsSaved) return route.continue();
      const words = HEARD.map(([w, t]) => ({ text: w, line: t < 1.5 ? 0 : 1, start: t, end: t + 0.3 }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, how: "the words speech-to-text heard (no lyrics file for this song)", lyrics: false, fixed: false, words, text: "hello wurld\nhow are yu" }) });
    });
    await p.route("**/api/karaoke/lyrics", async (route) => { if (route.request().method() === "POST") lyricsSaved = true; return route.continue(); });
    await p.route("**/api/textedit/words", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, words: SAID, cached: true }) }));

    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlKaraokeGen && window.TlTextEdit && document.getElementById("tlTextBtn"), null, { timeout: 30000 });
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "uishots.webm", src: "video", in: 0, out: 6, dur: 6, start: 0, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = [mkLayer("A1", [{ name: "uisong.wav", start: 0, in: 0, out: 5, dur: 5, volume: 1 }])];
      PXS = 60; tlSave(); renderTimeline();
    });

    /* ---- 🎤 karaoke: the lyrics box + the word list */
    await p.click("#tlKaraokeGen");
    await p.waitForFunction(() => document.getElementById("kgLyrics") && /hello wurld/.test(document.getElementById("kgLyrics").value), null, { timeout: 15000 });
    const k1 = await p.evaluate(() => ({ v: document.getElementById("kgLyrics").value, note: document.getElementById("kgNote").textContent,
      tabs: [document.getElementById("kgTabText").textContent, document.getElementById("kgTabWords").textContent], label: document.getElementById("kgLyrics").getAttribute("aria-label") }));
    check("🎤 no lyrics on file: the ✎ Edit lyrics box holds the words speech-to-text heard (the ones the karaoke showed), said so", k1.v === "hello wurld\nhow are yu"
      && /speech-to-text heard/.test(k1.note) && /Edit lyrics/.test(k1.tabs[0]) && /Words/.test(k1.tabs[1]) && k1.label === "Edit lyrics", k1);
    await p.evaluate(() => { const t = document.getElementById("kgLyrics"); t.value = "hello world\nhow are you"; });
    await p.click("#kgTabWords");
    await p.waitForFunction(() => document.querySelectorAll("#kgWords .kg-w").length === 5, null, { timeout: 15000 });
    const k2 = await p.evaluate(() => [...document.querySelectorAll('#kgWords input[data-k="text"]')].map((i) => i.value));
    check("⏱ Words & timing: the corrected lyrics saved first, then every word listed with its time (▶ to hear)", lyricsSaved && k2.join(" ") === "hello world how are you"
      && fs.readFileSync(path.join(pdir, "lyrics", "uisong.txt"), "utf8").trim() === "hello world\nhow are you", k2);
    await p.evaluate(() => {
      const i = document.querySelector('#kgWords [data-i="0"] input[data-k="text"]'); i.value = "Hello!"; i.dispatchEvent(new Event("change"));
      const s = document.querySelector('#kgWords [data-i="1"] input[data-k="start"]'); s.value = "1.25"; s.dispatchEvent(new Event("change"));
    });
    await p.click("#kgGo");
    // 2.410.0: 🎤 is a docker now - it stays open; Generate says it is rendering
    await p.waitForFunction(() => /Rendering|overlay/.test(document.getElementById("kgMsg").textContent), null, { timeout: 20000 }).catch(() => {});
    check("Generate keeps the corrected words (text + time) for the song", sentWords && sentWords.song === "uisong.wav" && sentWords.words[0].text === "Hello!" && sentWords.words[1].start === 1.25, sentWords && sentWords.words.slice(0, 2));
    const kw = await api("/api/karaoke/words?song=uisong.wav");
    check("... and the karaoke now uses them", kw.fixed && kw.words[0].text === "Hello!" && kw.words[1].text === "world", kw.words && kw.words.slice(0, 2));
    // 💾 Save words without generating, opened the way the video docker's ✎ opens it (a song + a callback)
    await p.evaluate(() => { window.__saved = null; TlKaraokeGen.open({ song: "uisong.wav", onSaved: (s) => { window.__saved = s; } }); });
    await p.waitForFunction(() => TlKaraokeGen.shown() && document.getElementById("kgLyrics").value.trim().length > 0, null, { timeout: 15000 });
    await p.evaluate(() => { const t = document.getElementById("kgLyrics"); t.value = "hello world\nhow are we"; document.getElementById("kgSave").click(); });
    await p.waitForFunction(() => window.__saved === "uisong.wav", null, { timeout: 15000 }).catch(() => {});
    const sv = await p.evaluate(() => ({ saved: window.__saved, open: TlKaraokeGen.shown(), msg: document.getElementById("kgMsg").textContent, song: document.getElementById("kgSong").selectedOptions[0].textContent }));
    check("💾 Save words: the lyrics kept without an overlay, the dialog stays open, the caller told (the video docker remakes its scenes)",
      sv.saved === "uisong.wav" && sv.open && /saved/.test(sv.msg) && /uisong/.test(sv.song) && fs.readFileSync(path.join(pdir, "lyrics", "uisong.txt"), "utf8").trim() === "hello world\nhow are we", sv);
    await p.evaluate(() => TlKaraokeGen.close());
    const vb = await p.evaluate(() => { const b = document.getElementById("vdKaraokeEdit"); return b ? { t: b.textContent, next: b.nextElementSibling && b.nextElementSibling.id } : null; });
    check("the video docker's 🎤 has a ✎ to fix the lyrics, beside its status", vb && vb.t === "✎" && vb.next === "vdKaraokeMsg", vb);

    /* ---- 📝 transcript */
    // the karaoke job lands its overlay on the timeline when it is done (that re-render clears the selection) - let it
    await p.waitForFunction(() => (tl.vlayers || []).some((L) => (L.clips || []).some((c) => /karaoke/i.test(c.name || ""))), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(500);
    // under the full gate's load the overlay can still land (and re-render, clearing the selection) after we select:
    // select, open, and if the dialog came up without the clip, close it and do it again
    let shown = false;
    for (let attempt = 0; attempt < 4 && !shown; attempt++) {
      // 2.414.0: V1 highlighted too - a karaoke overlay landing between the select and the click re-renders and drops the
      // selection; the panel then takes the highlighted layer's clip under the position marker
      await p.evaluate(() => {
        // the karaoke job's landing can re-load the timeline from the server: put the clip back if it went
        if (!(tl.video || []).some((c) => c.name === "uishots.webm")) { tl.video = [{ name: "uishots.webm", src: "video", in: 0, out: 6, dur: 6, start: 0, opacity: 1 }]; tlSave(); renderTimeline(); }
        window.__c = tl.video[0]; TlCanvas.select(__c, TlCanvas.layerOf(__c)); tl.selLayer = "v1"; });
      await p.click("#tlTextBtn");
      shown = await p.waitForFunction(() => document.querySelectorAll("#tteText .tte-w").length === 6, null, { timeout: 8000 }).then(() => true, () => false);
      if (!shown) { await p.evaluate(() => { const d = document.getElementById("tlTextDlg"); if (d && d.open) d.close(); }); await p.waitForTimeout(1500); }
    }
    if (!shown) throw new Error("the transcript did not show the 6 words: " + await p.evaluate(() => (document.getElementById("tlTextDlg") || {}).textContent));
    const t0 = await p.evaluate(() => { const d = document.getElementById("tlTextDlg"), bar = d.querySelector(".fx-title");
      return { title: bar.querySelector("h2").textContent, first: d.firstElementChild === bar, fill: [...document.querySelectorAll("#tteText .tte-w.fill")].map((s) => s.textContent),
               gap: !!document.querySelector("#tteText .tte-gap") }; });
    check("📝 Transcript: a dialog with a TITLE BAR, the clip's words, the filler marked, the long pause shown", t0.title === "Transcript" && t0.first && t0.fill.join() === "um" && t0.gap, t0);
    await p.click('#tteText .tte-w[data-i="2"]'); await p.click('#tteText .tte-w[data-i="3"]', { modifiers: ["Shift"] });
    const ch = await p.evaluate(() => Object.keys(TlTextEdit.state().chosen).join());
    check("click + shift-click choose a run of words (2.414.0: keyed clip|word)", ch === "0|2,0|3", ch);
    await p.click("#tteCut");
    const want = X.remove({ name: "uishots.webm", src: "video", in: 0, out: 6, dur: 6, start: 0 }, X.wordRanges(SAID, [2, 3]));
    const t1 = await p.evaluate(() => tl.video.map((c) => [c.start, c.in, c.out]));
    check("✂ Cut them: two pieces of the file, end to end - as static/textedit.js makes them", JSON.stringify(t1) === JSON.stringify(want.pieces.map((c) => [c.start, c.in, c.out])), { t1, want: want.pieces });
    await p.click("#tteUndo");
    check("↺ Undo puts the clip back", JSON.stringify(await p.evaluate(() => tl.video.map((c) => [c.start, c.in, c.out]))) === "[[0,0,6]]");
    await p.click("#tteFillers");
    const t2 = await p.evaluate(() => tl.video.map((c) => [c.start, c.in, c.out]));
    check("Remove filler words: 'um' out (two pieces, the second starting where 'this' starts)", t2.length === 2 && Math.abs(t2[1][1] - 0.98) < 0.01, t2);
    await p.click("#ttePauses");
    const len = await p.evaluate(() => tl.video.reduce((s, c) => s + (c.out - c.in), 0));
    check("Remove pauses over 0.8 s: the 1.8 s silence and the 1.5 s at the end shrink to 0.3 s each", Math.abs(len - (6 - 0.3 - 1.5 - 1.2)) < 0.05, len);
    await p.click("#tteUndo"); await p.click("#tteUndo");
    await p.click("#tteScenes");
    await p.waitForFunction(() => tl.video.length === 3, null, { timeout: 30000 }).catch(() => {});
    const t3 = await p.evaluate(() => ({ v: tl.video.map((c) => [c.start, c.in, c.out]), msg: document.getElementById("tteMsg").textContent }));
    const near3 = (a, b) => a.length === b.length && a.every((r, i) => r.every((v, j) => Math.abs(v - b[i][j]) < 0.05));
    check("✂ Scene cuts: split where the shots change (~2 s, ~4 s), in place", near3(t3.v, [[0, 0, 2], [2, 2, 4], [4, 4, 6]]) && /2 shot change/.test(t3.msg), t3);
    const t4 = await p.evaluate(() => document.querySelectorAll("#tteText .tte-piece").length);
    check("... the transcript follows the pieces", t4 === 3, t4);
    await p.dblclick('#tteText .tte-w[data-i="5"]');
    const ph = await p.evaluate(() => playhead);
    check("double-click a word: the position marker goes there", Math.abs(ph - 4.1) < 0.06, ph);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
