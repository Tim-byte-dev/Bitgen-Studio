#!/usr/bin/env node
/* bitGen Studio — 2.740.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): A PART NOT
 * INSTALLED = ⬇ DOWNLOAD / CANCEL, INSTALLED IN PLACE (static/needinstall.js - window.H3NeedInstall).
 * Tim (verbatim): "Create stopped at the split: demucs is not installed — press Install in the Stems dock , if a model
 * needs to be installed show the download/cancel msgbox and download the model instead of asking user to find install"
 *   - ✨ Create on a song with the separation not installed: the box (what it is, what it does, its size), Cancel has the
 *     focus - Enter / Cancel = Create stops at the split, nothing queued;
 *   - ⬇ Download: the install is queued (POST /api/audio/install {which: demucs}), its progress bar + last log line show,
 *     then the box closes by itself and Create GOES ON - the split, then (lyrics box empty, speech not installed) the
 *     second box for Whisper: Cancel = the sheet music without words; next time ⬇ Download = the words heard;
 *   - the Stems docker's Separate asks the same way.
 * The installs, the split, the speech model and the transcription are answered by the test. No server / no Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.740.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SONG = "E2E-Need740_20261109-180000.wav";
const ABCN = "E2E-Need740_20261109-180500.abc";
const ABC = "X:1\nT:Need\nM:4/4\nL:1/4\nQ:1/4=120\nV: Vocal name=\"Vocal\"\nK:C\nV: Vocal\nC D E F|G A B c|]\n";
const HEARD = "one two three four five six seven eight";
function wav(sec, hz) {
  const rate = 8000, n = Math.round(sec * rate), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(4000 * Math.sin(2 * Math.PI * hz * i / rate)), 44 + i * 2);
  return b;
}

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.740.0 browser test did not run"); process.exit(0); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.log("SKIP: the studio's output folder is not on this machine"); process.exit(0); }
  const projDir = ((where.dirs || []).find((d) => d.where === "project") || {}).dir || path.dirname(out);
  const sound = path.join(projDir, "sound");
  fs.mkdirSync(sound, { recursive: true });
  const st = SONG.replace(/\.wav$/, "");
  const made = [path.join(out, SONG), path.join(out, ABCN)].concat(["vocals", "drums", "bass", "other"].map((k) => path.join(sound, st + "_" + k + ".wav")));
  fs.writeFileSync(made[0], wav(6, 330));
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const S = { demucs: false, whisper: false, installs: [], polls: {}, separate: 0, asr: 0, gen: 0 };
    await p.route("**/api/stems", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ installed: S.demucs, model: "htdemucs", device: "auto" }) }));
    await p.route("**/api/asr", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ installed: S.whisper, engine: "whisper" }) }));
    await p.route("**/api/audio/install", async (route) => {
      const w = JSON.parse(route.request().postData() || "{}").which;
      S.installs.push(w); S.polls[w] = 0;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2einst_" + w, venv: "venvs/" + w }) });
    });
    await p.route("**/api/jobs/e2einst_*", async (route) => {
      const w = route.request().url().match(/e2einst_([a-z]+)/)[1];
      const n = ++S.polls[w];
      if (n < 3) { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2einst_" + w, status: "running", progress: { pct: 30 * n }, log: ["Collecting torch (" + w + ")"], log_next: n }) }); return; }
      S[w] = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2einst_" + w, status: "done", progress: { pct: 100 }, log: ["installed " + w], log_next: n }) });
    });
    await p.route("**/api/stems/separate", async (route) => {
      S.separate++;
      [2, 3, 4, 5].forEach((k, i) => fs.writeFileSync(made[k], wav(6, 150 * (i + 1))));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, vocals: st + "_vocals.wav", drums: st + "_drums.wav", bass: st + "_bass.wav", other: st + "_other.wav" }) });
    });
    await p.route("**/api/asr/transcribe", async (route) => { S.asr++; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: HEARD }) }); });
    await p.route("**/api/genmusic", async (route) => { S.gen++; fs.writeFileSync(made[1], ABC); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e740job" }) }); });
    await p.route("**/api/jobs/e2e740job", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e740job", status: "done", output: ABCN, outputs: [ABCN] }) }));
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3NeedInstall && window.SheetCreate && document.getElementById("goSheetCreate"), null, { timeout: 30000 });
    await ev(() => {
      document.getElementById("muLyrics").value = "";
      const ti = document.getElementById("muTitle"); if (ti) ti.value = "E2E Need740";
      const ms = document.getElementById("musicSel");
      if (ms && !ms.value) { if (![...ms.options].some((o) => o.value)) ms.add(new Option("e2e style", "e2e-style")); ms.value = [...ms.options].find((o) => o.value).value; }
      if (typeof window.ensureComfyReady === "function") window.ensureComfyReady = () => Promise.resolve(true);
      document.querySelector('button[data-mutab="sheet"]').click();
    });
    await sleep(700);
    await ev(() => MuScore.refresh());
    await p.waitForFunction((n) => [...document.querySelectorAll("#muCreateSrc option")].some((o) => o.value === "output/" + n), SONG, { timeout: 15000 });
    await ev((n) => { SheetCreate.fill("output/" + n); }, SONG);
    const box = () => ev(() => { const d = document.getElementById("niDlg"); return d ? { which: d.dataset.which, open: d.open, title: d.querySelector("h2").textContent, text: d.textContent, focus: document.activeElement && document.activeElement.id,
      line: d.querySelector(".niline").textContent, bar: d.querySelector(".nibar").style.display, go: d.querySelector("#niGo").textContent } : null; });

    // 1 Cancel (Enter) = Create stops at the split
    await ev(() => document.getElementById("goSheetCreate").click());
    await p.waitForSelector("#niDlg[open]", { timeout: 8000 }).catch(() => {});
    const b1 = await box();
    check("✨ Create, the separation not installed: the ⬇ Download / Cancel box - what it is, what it does, its size; Cancel has the focus",
      b1 && b1.open && b1.which === "demucs" && /Song separation \(demucs\) is not installed yet/.test(b1.title) && /Splits a song into its layers/.test(b1.text) && /about 2\.5 GB/.test(b1.text) && /✨ Create splits the song into its layers/.test(b1.text) && b1.focus === "niCancel", b1);
    await p.keyboard.press("Enter");
    await sleep(400);
    const c1 = await ev(() => ({ dlg: !!document.getElementById("niDlg"), steps: [...document.querySelectorAll("#muCreateSteps .muStep")].map((x) => x.dataset.step + ":" + x.dataset.state).join(), st: document.getElementById("muSheetStatus").textContent }));
    check("Enter (= Cancel): the box goes, Create stops at the split and says to download it; nothing queued, nothing split",
      !c1.dlg && c1.steps === "split:fail,lyrics:,sheet:" && /stopped at the split: the song separation is not installed/.test(c1.st) && S.installs.length === 0 && S.separate === 0, { c1, S });

    // 2 ⬇ Download: installed in place, Create goes on - then the speech box: Cancel = no words
    await ev(() => { document.getElementById("muLyrics").value = ""; document.getElementById("goSheetCreate").click(); });   // (the Song tab may have loaded its saved lyrics since)
    await p.waitForSelector("#niDlg[open]", { timeout: 8000 });
    await p.click("#niGo");
    await p.waitForFunction(() => /Collecting torch/.test((document.querySelector("#niDlg .niline") || {}).textContent || ""), null, { timeout: 8000 }).catch(() => {});
    const b2 = await box();
    check("⬇ Download: the install queued (demucs), the bar and its last log line show, the button busy", S.installs.join() === "demucs" && b2 && b2.bar === "block" && /Collecting torch \(demucs\)/.test(b2.line) && /Downloading/.test(b2.go), { b2, S });
    await p.waitForFunction(() => { const d = document.getElementById("niDlg"); return d && d.dataset.which === "whisper"; }, null, { timeout: 15000 }).catch(() => {});
    const b3 = await box();
    check("…installed, the box closed by itself and Create went on: split done; the lyrics box is empty and speech is not installed - its own box",
      S.demucs && S.separate === 1 && b3 && b3.which === "whisper" && /Speech to text \(Whisper\)/.test(b3.title) && /Cancel = the sheet music without words/.test(b3.text), { b3, S });
    await p.click("#niCancel");
    await p.waitForFunction((n) => MuScore.state.name === n, ABCN, { timeout: 15000 }).catch(() => {});
    await sleep(400);
    const c2 = await ev(() => ({ steps: [...document.querySelectorAll("#muCreateSteps .muStep")].map((x) => x.dataset.step + ":" + x.dataset.state).join(), st: document.getElementById("muSheetStatus").textContent, words: document.querySelectorAll("#muScore text[data-w]").length }));
    check("Cancel on speech: the sheet music is made without words, and says so", c2.steps === "split:done,lyrics:skip,sheet:done" && S.asr === 0 && S.gen === 1 && c2.words === 0 && /no words: speech to text is not installed/.test(c2.st), { c2, S });

    // 3 next time ⬇ Download speech: the words are heard
    await ev(() => { document.getElementById("muLyrics").value = ""; SheetCreate.create(); });
    await p.waitForSelector("#niDlg[open]", { timeout: 8000 });
    const b4 = await box();
    await p.click("#niGo");
    await p.waitForFunction((g) => !document.getElementById("niDlg") && document.querySelectorAll("#muScore text[data-w]").length > 0, null, { timeout: 20000 }).catch(() => {});
    const c3 = await ev(() => ({ lyrics: document.getElementById("muLyrics").value, words: document.querySelectorAll("#muScore text[data-w]").length, steps: [...document.querySelectorAll("#muCreateSteps .muStep")].map((x) => x.dataset.step + ":" + x.dataset.state).join() }));
    check("again: the separation is there now (no box for it); ⬇ Download speech -> installed, the words heard and under the notes",
      b4 && b4.which === "whisper" && S.installs.join() === "demucs,whisper" && S.whisper && S.asr === 1 && c3.lyrics === HEARD && c3.words > 0 && c3.steps === "split:done,lyrics:done,sheet:done", { b4, c3, S });

    // 4 the Stems docker's Separate asks the same way
    S.demucs = false;
    const st4 = await ev((n) => {
      const sel = document.getElementById("stSong"), go = document.getElementById("stGo");
      if (!sel || !go) return "no stems docker";
      if (![...sel.options].some((o) => o.value === n)) sel.add(new Option(n, n));
      sel.value = n; go.click(); return "ok";
    }, SONG);
    await p.waitForSelector("#niDlg[open]", { timeout: 8000 }).catch(() => {});
    const b5 = await box();
    if (b5) await p.click("#niCancel");
    await sleep(300);
    const m5 = await ev(() => (document.getElementById("stMsg") || {}).textContent || "");
    check("the Stems docker's Separate: the same box; Cancel = it says Separate asks to download it, nothing split", st4 === "ok" && b5 && b5.which === "demucs" && /Separate splits/.test(b5.text) && /Separate asks to download it/.test(m5) && S.separate === 1, { st4, b5, m5 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    for (const f of made) { try { fs.unlinkSync(f); } catch { /* gone */ } }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
