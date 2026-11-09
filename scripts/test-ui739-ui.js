#!/usr/bin/env node
/* bitGen Studio — 2.739.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): ✨ CREATE.
 * Tim (verbatim): "add a button - Create - this will use the audio file + lyrics from song or loaded file or transcribed
 * file, split the stems show the different waveforms and create the sheet music - i think this will make it less
 * complicated"
 *   - the make bar: Song (the project's songs - the Song tab's title picks its own - and 📂 a song from this computer) ·
 *     ✨ Create · Write from lyrics;
 *   - ✨ Create: 1 split into four layers (their waveforms shown) · 2 the lyrics (the Song tab's, else heard from the
 *     vocals) · 3 the sheet music transcribed from the song - then the score drawn with the words, playing that song in its
 *     layers; a song already split and lyrics already written skip those steps;
 *   - 📂 a song from this computer is copied into the project and picked; a step that fails stops Create and says where.
 * demucs, the speech model and the transcription job are answered by the test (none of them runs here).
 * No server / no Playwright = SKIP. The test's files are removed afterwards. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.739.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SONG = "E2E-Create739_20261109-170000.wav";
const ABCN = "E2E-Create739_20261109-170500.abc";
const LOCAL = "e2e create739 local.wav";
const ABC = "X:1\nT:Create\nM:4/4\nL:1/4\nQ:1/4=120\nV: Vocal name=\"Vocal\"\nV: Piano clef=bass name=\"Piano\"\nK:C\nV: Vocal\nC D E F|G A B c|c B A G|F E D C|]\nV: Piano\nC,4|D,4|E,4|C,4|]\n";
const HEARD = "drive into the blue every mile closer to you";
function wav(sec, hz) {
  const rate = 8000, n = Math.round(sec * rate), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(5000 * (0.4 + 0.6 * Math.abs(Math.sin(i / rate * 2))) * Math.sin(2 * Math.PI * hz * i / rate)), 44 + i * 2);
  return b;
}

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.739.0 browser test did not run"); process.exit(0); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.log("SKIP: the studio's output folder is not on this machine"); process.exit(0); }
  const projDir = ((where.dirs || []).find((d) => d.where === "project") || {}).dir || path.dirname(out);
  const sound = path.join(projDir, "sound");
  fs.mkdirSync(sound, { recursive: true });
  const st = SONG.replace(/\.wav$/, "");
  const made = [path.join(out, SONG), path.join(out, ABCN), path.join(sound, LOCAL)].concat(["vocals", "drums", "bass", "other"].map((k) => path.join(sound, st + "_" + k + ".wav")));
  fs.writeFileSync(made[0], wav(8, 330));
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const calls = { separate: [], asr: [], gen: [] };
    let sepFail = false;
    await p.route("**/api/stems/separate", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      calls.separate.push(body);
      if (sepFail) { await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "demucs is not installed — press Install in the Stems dock" }) }); return; }
      await sleep(300);
      [3, 4, 5, 6].forEach((k, i) => fs.writeFileSync(made[k], wav(8, 150 * (i + 1))));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, vocals: st + "_vocals.wav", drums: st + "_drums.wav", bass: st + "_bass.wav", other: st + "_other.wav" }) });
    });
    await p.route("**/api/asr/transcribe", async (route) => {
      calls.asr.push(JSON.parse(route.request().postData() || "{}"));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: HEARD, language: "en" }) });
    });
    await p.route("**/api/genmusic", async (route) => {
      const req = route.request(), body = req.postDataBuffer() ? req.postDataBuffer().toString("latin1") : "";
      calls.gen.push({ abc: /name="variant"\r\n\r\nabc/.test(body), ref: (body.match(/name="ref"; filename="([^"]+)"/) || [])[1] || "", riff: body.includes("RIFF") });
      fs.writeFileSync(made[1], ABC);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e739job" }) });
    });
    await p.route("**/api/jobs/e2e739job", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e739job", status: "done", output: ABCN, outputs: [ABCN] }) }));
    await p.goto(URL0);
    await p.waitForFunction(() => window.MuScore && window.SheetCreate && document.getElementById("goSheetCreate"), null, { timeout: 30000 });
    await ev(() => {
      try { localStorage.removeItem("h3.muScoreWords"); } catch (e) { /* */ }
      document.getElementById("muLyrics").value = "";
      const ti = document.getElementById("muTitle"); if (ti) ti.value = "E2E Create739";
      const ms = document.getElementById("musicSel");          // a style to send (the job is answered by the test)
      if (ms && !ms.value) { if (![...ms.options].some((o) => o.value)) ms.add(new Option("e2e style", "e2e-style")); ms.value = [...ms.options].find((o) => o.value).value; }
      if (typeof window.ensureComfyReady === "function") window.ensureComfyReady = () => Promise.resolve(true);   // the job is answered by the test
      document.querySelector('button[data-mutab="sheet"]').click();
    });
    await sleep(800);
    await ev(() => MuScore.refresh());
    await p.waitForFunction((n) => [...document.querySelectorAll("#muCreateSrc option")].some((o) => o.value === "output/" + n), SONG, { timeout: 15000 });
    await ev(() => SheetCreate.fill());

    const bar = await ev(() => ({ ids: [...document.querySelectorAll("#muSheetMake > *")].filter((x) => x.offsetParent).map((x) => x.id || x.className), pick: document.getElementById("muCreateSrc").value,
      last: [...document.getElementById("muCreateSrc").options].pop().textContent, transcribe: !!document.getElementById("goSheetTranscribe") }));
    check("the make bar: Song · ✨ Create · Write from lyrics - the Song tab's title picked its song; 📂 from this computer last; no separate Transcribe",
      bar.ids.slice(0, 4).join() === "muIn,goSheetCreate,muSep,goSheetWrite" && bar.pick === "output/" + SONG && bar.last === "📂 A song from this computer…" && !bar.transcribe, bar);

    await ev(() => document.getElementById("goSheetCreate").click());
    await p.waitForFunction(() => document.querySelectorAll("#muLayers canvas").length === 4, null, { timeout: 15000 }).catch(() => {});
    const mid = await ev(() => ({ lanes: [...document.querySelectorAll("#muLayers .muLane")].map((l) => l.dataset.lane), steps: [...document.querySelectorAll("#muCreateSteps .muStep")].map((x) => x.dataset.step + ":" + x.dataset.state) }));
    check("✨ Create: split into four layers - their waveforms shown while it goes on", mid.lanes.join() === "vocals,drums,bass,other" && mid.steps[0] === "split:done", mid);
    await p.waitForFunction((n) => MuScore.state.name === n, ABCN, { timeout: 20000 }).catch(() => {});
    await sleep(500);
    const r1 = await ev(() => ({ name: MuScore.state.name, steps: [...document.querySelectorAll("#muCreateSteps .muStep")].map((x) => x.dataset.step + ":" + x.dataset.state),
      lyrics: document.getElementById("muLyrics").value, words: document.querySelectorAll("#muScore text[data-w]").length, sound: document.getElementById("muPlaySound").value,
      tracks: MuScore.player().tracks().map((t) => t.key).join(), lanes: document.querySelectorAll("#muLayers .muLane").length, st: document.getElementById("muSheetStatus").textContent, btn: document.getElementById("goSheetCreate").textContent }));
    check("…the split asked for 4 layers of the song; the words heard in its vocal layer; the transcription sent the song itself",
      calls.separate.length === 1 && calls.separate[0].file === SONG && calls.separate[0].layers === 4 && calls.asr.length === 1 && calls.asr[0].name === st + "_vocals.wav" && calls.asr[0].mode === "lyrics"
      && calls.gen.length === 1 && calls.gen[0].abc && calls.gen[0].ref === SONG && calls.gen[0].riff, calls);
    check("…the score drawn, with the heard words under the notes (now in the Song tab's lyrics box)", r1.name === ABCN && r1.lyrics === HEARD && r1.words > 0, r1);
    check("…and it plays that song in its four layers", r1.sound === "song:output/" + SONG && r1.tracks === "vocals,drums,bass,other" && r1.lanes === 4, r1);
    check("…every step ticked off, the status says what was made", r1.steps.join() === "split:done,lyrics:done,sheet:done" && /✨ E2E-Create739_20261109-170500\.abc - the sheet music of E2E-Create739/.test(r1.st) && /heard from the vocals/.test(r1.st) && r1.btn === "✨ Create", r1);

    // again: the song is split, the lyrics are written - straight to the sheet music
    await ev(() => { document.getElementById("muLyrics").value = "my own words for the song"; });
    await ev(() => SheetCreate.create());
    await sleep(500);
    const r2 = await ev(() => ({ steps: [...document.querySelectorAll("#muCreateSteps .muStep")].map((x) => x.dataset.step + ":" + x.dataset.state), st: document.getElementById("muSheetStatus").textContent }));
    check("again: split already, lyrics already written - no split, no listening; the Song tab's words used", calls.separate.length === 1 && calls.asr.length === 0 + 1 && calls.gen.length === 2
      && r2.steps.join() === "split:done,lyrics:done,sheet:done" && /words from the Song tab/.test(r2.st), { calls, r2 });

    // 📂 a song from this computer: copied into the project, picked; a split that fails stops Create there
    // (a script's select is no user gesture, so the browser keeps its file box shut here - the test checks it was asked to open)
    await ev(() => { window.__fileAsked = 0; const f = document.getElementById("muSheetRef"), c = f.click.bind(f); f.click = () => { window.__fileAsked++; try { c(); } catch (e) { /* */ } }; });
    await p.selectOption("#muCreateSrc", "__file");
    const asked = await ev(() => window.__fileAsked);
    await p.setInputFiles("#muSheetRef", { name: LOCAL, mimeType: "audio/wav", buffer: wav(4, 262) });
    await p.waitForFunction((n) => document.getElementById("muCreateSrc").value === "sound/" + n, LOCAL, { timeout: 10000 }).catch(() => {});
    const u = await ev(() => ({ pick: document.getElementById("muCreateSrc").value, st: document.getElementById("muSheetStatus").textContent }));
    check("📂 a song from this computer: picking it opens the file box; the song is copied into the project and picked", asked === 1 && u.pick === "sound/" + LOCAL && fs.existsSync(made[2]) && /is in the project/.test(u.st), { asked, u });
    sepFail = true;
    await ev(() => SheetCreate.create());
    const r3 = await ev(() => ({ steps: [...document.querySelectorAll("#muCreateSteps .muStep")].map((x) => x.dataset.step + ":" + x.dataset.state), st: document.getElementById("muSheetStatus").textContent, btn: document.getElementById("goSheetCreate").disabled }));
    check("a split that fails: Create stops at the split and says why (the button is back)", r3.steps.join() === "split:fail,lyrics:,sheet:" && /Create stopped at the split: demucs is not installed/.test(r3.st) && !r3.btn && calls.gen.length === 2, r3);
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
