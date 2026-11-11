#!/usr/bin/env node
/* bitGen Studio — 2.737.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): PARTS + THE MIX.
 * Tim (verbatim): "in sheet music , can we separate the instruments and have sheet music for each instrument and another for
 * vocals? and have toggle buttons to play each instrument and vocals?"
 *   - tabs on the score viewer: Full score, then each staff (the vocal one marked); a part's tab engraves that staff alone,
 *     named at the top, the words only on the vocal part; ⛶ Read and the PDF name carry the part; the place is kept;
 *   - the notes played by the browser: a toggle per staff (Shift+click = that one alone) - a staff turned off is not struck;
 *   - the song: its stems (vocals + instrumental, from the Stems docker) play in step and Vocals / Instruments turn each on
 *     and off; a song not separated yet offers ✂ Separate vocals (the separation itself is answered here, not run).
 *   2.738.0: the song's toggles are on its layer lanes (#muLayers), and the split makes four layers.
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.737.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STEM = "E2E-Parts737_20261109-150000";
const STEM2 = "E2E-PartsNoStems737_20261109-150000";
const ABC = `X:1
T:Parts
M:4/4
L:1/4
Q:1/4=120
V: Vocal clef=treble name="Vocal" snm="Voc."
V: Piano clef=treble name="Piano" snm="Pno."
V: Bass clef=bass name="Bass" snm="Bs."
K:C
V: Vocal
C D E F|G A B c|c B A G|F E D C|]
V: Piano
[CEG]4|[DFA]4|[EGB]4|[CEG]4|]
V: Bass
C,4|D,4|E,4|C,4|]
`;
const LYRICS = "one two three four five six seven eight";
function wav(sec, hz) {                                   // a quiet tone, 8 kHz mono 16-bit
  const rate = 8000, n = Math.round(sec * rate), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(1200 * Math.sin(2 * Math.PI * hz * i / rate)), 44 + i * 2);
  return b;
}

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.737.0 browser test did not run"); process.exit(0); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.log("SKIP: the studio's output folder is not on this machine"); process.exit(0); }
  const projDir = ((where.dirs || []).find((d) => d.where === "project") || {}).dir || path.dirname(out);
  const sound = path.join(projDir, "sound");
  fs.mkdirSync(sound, { recursive: true });
  const made = [path.join(out, STEM + ".abc"), path.join(out, STEM + ".wav"), path.join(sound, STEM + "_vocals.wav"), path.join(sound, STEM + "_instrumental.wav"),
    path.join(out, STEM2 + ".abc"), path.join(out, STEM2 + ".wav"), path.join(sound, STEM2 + "_vocals.wav"), path.join(sound, STEM2 + "_drums.wav"),
    path.join(sound, STEM2 + "_bass.wav"), path.join(sound, STEM2 + "_other.wav")];
  fs.writeFileSync(made[0], ABC); fs.writeFileSync(made[1], wav(9, 330)); fs.writeFileSync(made[2], wav(9, 440)); fs.writeFileSync(made[3], wav(9, 220));
  fs.writeFileSync(made[4], ABC); fs.writeFileSync(made[5], wav(9, 330));
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    // the separation is answered here (demucs is not run by a test): the two stems written, then the reply
    // the song separation / speech to text count as installed here (2.740.0 asks to download them otherwise - test-ui740)
    await p.route("**/api/stems", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ installed: true, model: "htdemucs", device: "auto" }) }));
    await p.route("**/api/asr", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ installed: true, engine: "whisper" }) }));
    await p.route("**/api/stems/separate", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      [6, 7, 8, 9].forEach((k, i) => fs.writeFileSync(made[k], wav(9, 220 + 110 * i)));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, vocals: STEM2 + "_vocals.wav", drums: STEM2 + "_drums.wav", bass: STEM2 + "_bass.wav", other: STEM2 + "_other.wav", asked: body.file, layers: body.layers }) });
    });
    await p.goto(URL0);
    await p.waitForFunction(() => window.MuScore && document.getElementById("muParts") && document.getElementById("muPlayMix"), null, { timeout: 30000 });
    await ev((t) => { document.getElementById("muLyrics").value = t; try { localStorage.removeItem("h3.muScoreWords"); } catch (e) { /* */ } }, LYRICS);
    await ev(() => document.querySelector('button[data-mutab="sheet"]').click());
    await sleep(800);
    await ev(() => MuScore.refresh());
    await p.waitForFunction((n) => [...document.querySelectorAll("#muScoreList option")].some((o) => o.value === n), STEM + ".abc", { timeout: 15000 });
    await p.selectOption("#muScoreList", STEM + ".abc");
    await p.waitForFunction(() => MuScore.player() && !document.getElementById("muParts").hidden, null, { timeout: 15000 });
    await ev((t) => { document.getElementById("muLyrics").value = t; MuScore.words(true); }, LYRICS);   // the Song tab's own lyrics may have loaded since
    await sleep(300);

    const tabs = () => ev(() => [...document.querySelectorAll("#muParts [data-part]")].map((x) => x.textContent + (x.getAttribute("data-vocal") ? "(v)" : "") + (x.getAttribute("aria-selected") === "true" ? "*" : "")));
    const staves = () => ev(() => ({ voices: MuScore.state.result.voices, shown: MuScore.state.result.shown, words: document.querySelectorAll("#muScore text[data-w]").length,
      texts: [...document.querySelectorAll("#muScore svg text")].slice(0, 6).map((t) => t.textContent), status: document.getElementById("muSheetStatus").textContent }));
    check("tabs on the viewer: Full score, then each staff - the vocal one marked; the full score at first", JSON.stringify(await tabs()) === JSON.stringify(["Full score*", "Vocal(v)", "Piano", "Bass"]), await tabs());
    const f0 = await staves();
    check("the full score: three staves, the words under the vocal (nine syllables: se-ven)", f0.voices === 3 && f0.words === 9, f0);

    await ev(() => document.querySelector('#muParts [data-part="1"]').click());
    await sleep(300);
    const pi = await staves();
    check("Piano: that staff alone, named at the top, no words; the status says the part", pi.voices === 1 && JSON.stringify(pi.shown) === "[1]" && pi.words === 0 && pi.texts.includes("Piano") && /part: Piano/.test(pi.status), pi);
    check("…its tab is the one selected", JSON.stringify(await tabs()) === JSON.stringify(["Full score", "Vocal(v)", "Piano*", "Bass"]));
    await ev(() => document.querySelector('#muParts [data-part="0"]').click());
    await sleep(300);
    const vo = await staves();
    check("Vocal: its staff alone with the words", vo.voices === 1 && JSON.stringify(vo.shown) === "[0]" && vo.words === 9 && vo.texts.includes("Vocal"), vo);
    await ev(() => MuScore.openView());
    await sleep(300);
    const rv = await ev(() => ({ title: document.getElementById("muSvTitle").textContent, staves: MuScore.state.result.voices }));
    await ev(() => document.getElementById("muScoreView").close());
    check("⛶ Read shows the part, titled with it", /^Parts - Vocal - 1 page$/.test(rv.title), rv);

    // the song with its stems: Vocals / Instruments
    const mix = () => ev(() => [...document.querySelectorAll("#muPlayMix .muMix, #muLayers .muMix")].map((x) => x.textContent + ":" + x.getAttribute("aria-pressed")));
    const m1 = await ev(() => ({ mode: MuScore.player().mode, tracks: MuScore.player().tracks().map((t) => t.key + ":" + t.on), sound: document.getElementById("muPlaySound").value }));
    check("the song has stems: it plays as vocals + instrumental, the toggles Vocals and Instruments on", m1.mode === "song" && m1.tracks.join() === "vocals:true,instrumental:true"
      && JSON.stringify(await mix()) === JSON.stringify(["Vocals:true", "Instruments:true"]), { m1, mix: await mix() });
    await ev(() => document.querySelector('#muLayers [data-track="vocals"]').click());
    const m2 = await ev(() => MuScore.player().tracks().map((t) => t.key + ":" + t.on).join());
    check("Vocals off: the vocal stem muted, the button shows it off", m2 === "vocals:false,instrumental:true" && JSON.stringify(await mix()) === JSON.stringify(["Vocals:false", "Instruments:true"]), m2);
    await ev(() => MuScore.player().seek(1.0));
    await ev(() => MuScore.player().play());
    await sleep(1500);
    const m3 = await ev(() => { const tr = MuScore.player().tracks(); return { tr, pos: MuScore.player().position() }; });
    await ev(() => MuScore.player().pause());
    check("…both stems play in step (the same place within 0.1 s)", m3.tr.length === 2 && m3.tr.every((t) => !t.paused) && Math.abs(m3.tr[0].t - m3.tr[1].t) < 0.1 && m3.pos > 1.8, m3);
    await ev(() => document.querySelector('#muLayers [data-track="vocals"]').click());
    check("Vocals on again", (await ev(() => MuScore.player().tracks().map((t) => t.on).join())) === "true,true");
    await ev(() => document.querySelector('#muParts [data-part="1"]').click());
    await sleep(300);
    const kept = await ev(() => ({ pos: MuScore.player().position(), mix: [...document.querySelectorAll("#muLayers .muMix")].length }));
    check("another part keeps the place in the song (and the mix)", Math.abs(kept.pos - m3.pos) < 0.3 && kept.mix === 2, { kept, was: m3.pos });

    // the notes played by the browser: a toggle per staff
    await p.selectOption("#muPlaySound", "synth");
    await sleep(200);
    check("the notes: a toggle per staff, all on", JSON.stringify(await mix()) === JSON.stringify(["Vocal:true", "Piano:true", "Bass:true"]), await mix());
    await ev(() => document.querySelector('#muPlayMix [data-staff="1"]').click());
    await ev(() => { MuScore.player().seek(0); return MuScore.player().play(); });
    await sleep(1600);
    const s1 = await ev(() => { const s = MuScore.player().struck(); MuScore.player().pause(); return s; });
    check("Piano off: its notes are not struck, the vocal and the bass are", !s1[1] && s1[0] > 0 && s1[2] > 0 && JSON.stringify(await mix()) === JSON.stringify(["Vocal:true", "Piano:false", "Bass:true"]), s1);
    await p.click('#muPlayMix [data-staff="2"]', { modifiers: ["Shift"] }).catch(async () => {
      await ev(() => document.querySelector('#muPlayMix [data-staff="2"]').dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
    });
    check("Shift+click Bass: the bass alone", JSON.stringify(await mix()) === JSON.stringify(["Vocal:false", "Piano:false", "Bass:true"]), await mix());
    await ev(() => document.querySelector('#muPlayMix [data-staff="2"]').dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
    check("…Shift+click it again: all of them back", JSON.stringify(await mix()) === JSON.stringify(["Vocal:true", "Piano:true", "Bass:true"]), await mix());

    // a song not separated yet
    await p.selectOption("#muScoreList", STEM2 + ".abc");
    await p.waitForFunction((n) => MuScore.state.name === n && MuScore.player(), STEM2 + ".abc", { timeout: 15000 });
    await sleep(300);
    const n1 = await ev(() => ({ sep: !!document.getElementById("muStemSep"), mode: MuScore.player().mode, part: MuScore.state.part, tabs: [...document.querySelectorAll("#muParts [aria-selected=true]")].map((x) => x.textContent) }));
    check("another score starts on its full score; its song not separated: ✂ Split into layers", n1.sep && n1.mode === "song" && n1.part === -1 && n1.tabs.join() === "Full score", n1);
    await ev(() => document.getElementById("muStemSep").click());
    await p.waitForFunction(() => document.querySelectorAll("#muLayers .muMix").length === 4, null, { timeout: 10000 }).catch(() => {});
    const n2 = await ev(() => ({ mix: [...document.querySelectorAll("#muLayers .muMix")].map((x) => x.textContent), tracks: MuScore.player().tracks().length, st: document.getElementById("muSheetStatus").textContent }));
    check("✂ Split: the song's four layers found - Vocals, Drums, Bass, Other to toggle", n2.mix.join() === "Vocals,Drums,Bass,Other" && n2.tracks === 4 && /split into its layers/.test(n2.st), n2);
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
