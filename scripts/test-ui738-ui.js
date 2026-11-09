#!/usr/bin/env node
/* bitGen Studio — 2.738.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): THE SONG IN ITS
 * LAYERS. Tim (verbatim): "when playing in sheet music play the actual song in it's separated layers, show the layers as
 * waveforms. right now it sounds like a 1980's watch"
 *   - Sound lists the notes, then every song in the project; a score finds its song by itself (the same title), and what
 *     is picked is remembered for that score (the notes too);
 *   - a song split into four layers plays as those four, in step, each a lane: its waveform drawn from GET /api/waveform,
 *     on / off (Shift+click = alone), the playhead moving, a click on a wave plays from there;
 *   - a song not split: one Song lane + ✂ Split into layers (the split itself answered by the test, with layers: 4);
 *   - the notes: a hint to pick the recording, the staff toggles, and they sound (the soft piano strikes).
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.738.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SCORE = "E2E-Layers738_20261109-160000.abc";          // written from lyrics: no audio beside it
const SONG = "E2E-Layers738_20261109-155500.wav";           // the song with the same title, in the output folder
const PLAIN = "E2E-Plain738_20261109-150000.wav";           // another song, not split
const ABC = "X:1\nT:Layers\nM:4/4\nL:1/4\nQ:1/4=120\nV: Vocal name=\"Vocal\"\nV: Piano clef=bass name=\"Piano\"\nK:C\nV: Vocal\nC D E F|G A B c|c B A G|F E D C|]\nV: Piano\nC,4|D,4|E,4|C,4|]\n";
function wav(sec, hz, amp) {                              // a tone with a slow swell, 8 kHz mono 16-bit
  const rate = 8000, n = Math.round(sec * rate), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round((amp || 6000) * (0.3 + 0.7 * Math.abs(Math.sin(i / rate))) * Math.sin(2 * Math.PI * hz * i / rate)), 44 + i * 2);
  return b;
}

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.738.0 browser test did not run"); process.exit(0); }
  const where = await fetch(URL0 + "api/outputs/where").then((r) => r.json()).catch(() => null);
  const out = where && where.dir;
  if (!out || !fs.existsSync(out)) { console.log("SKIP: the studio's output folder is not on this machine"); process.exit(0); }
  const projDir = ((where.dirs || []).find((d) => d.where === "project") || {}).dir || path.dirname(out);
  const sound = path.join(projDir, "sound");
  fs.mkdirSync(sound, { recursive: true });
  const st = SONG.replace(/\.wav$/, ""), pl = PLAIN.replace(/\.wav$/, "");
  const made = [path.join(out, SCORE), path.join(out, SONG), path.join(out, PLAIN)]
    .concat(["vocals", "drums", "bass", "other"].map((k) => path.join(sound, st + "_" + k + ".wav")))
    .concat(["vocals", "drums", "bass", "other"].map((k) => path.join(sound, pl + "_" + k + ".wav")));
  fs.writeFileSync(made[0], ABC); fs.writeFileSync(made[1], wav(10, 330)); fs.writeFileSync(made[2], wav(10, 262));
  [3, 4, 5, 6].forEach((k, i) => fs.writeFileSync(made[k], wav(10, 196 * (i + 1), 2000 + 2500 * i)));
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    let asked = null;
    await p.route("**/api/stems/separate", async (route) => {
      asked = JSON.parse(route.request().postData() || "{}");
      [7, 8, 9, 10].forEach((k, i) => fs.writeFileSync(made[k], wav(10, 150 * (i + 1))));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, vocals: pl + "_vocals.wav", drums: pl + "_drums.wav", bass: pl + "_bass.wav", other: pl + "_other.wav" }) });
    });
    const open = async () => {
      await p.goto(URL0);
      await p.waitForFunction(() => window.MuScore && document.getElementById("muLayers"), null, { timeout: 30000 });
      await ev(() => document.querySelector('button[data-mutab="sheet"]').click());
      await sleep(800);
      await ev(() => MuScore.refresh());
      await p.waitForFunction((n) => [...document.querySelectorAll("#muScoreList option")].some((o) => o.value === n), SCORE, { timeout: 15000 });
      await p.selectOption("#muScoreList", SCORE);
      await p.waitForFunction(() => MuScore.player() && MuScore.state.result, null, { timeout: 15000 });
      await sleep(400);
    };
    await open();
    await ev(() => { try { localStorage.removeItem("h3.muScoreSong"); } catch (e) { /* */ } });
    await open();

    const s0 = await ev(() => { const sel = document.getElementById("muPlaySound"); return { first: sel.options[0].value + "|" + sel.options[0].textContent, pick: sel.value, label: sel.selectedOptions[0].textContent, n: sel.options.length, mode: MuScore.player().mode }; });
    check("Sound: the notes first, then the project's songs; this score (written from lyrics, nothing beside it) found its song by the title", s0.first === "synth|🎹 the notes (no recording)" && s0.pick === "song:output/" + SONG && /· 4 layers$/.test(s0.label) && s0.n > 2 && s0.mode === "song", s0);
    await p.waitForFunction(() => [...document.querySelectorAll("#muLayers canvas")].every((c) => +c.dataset.peaks > 0), null, { timeout: 20000 }).catch(() => {});
    const L = await ev(() => ({ lanes: [...document.querySelectorAll("#muLayers .muLane")].map((l) => l.dataset.lane), btns: [...document.querySelectorAll("#muLayers .muMix")].map((x) => x.textContent + ":" + x.getAttribute("aria-pressed")),
      peaks: [...document.querySelectorAll("#muLayers canvas")].map((c) => +c.dataset.peaks), drawn: [...document.querySelectorAll("#muLayers canvas")].map((c) => { const g = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < g.length; i += 4) if (g[i]) n++; return n; }),
      split: !!document.getElementById("muStemSep"), tracks: MuScore.player().tracks().map((t) => t.key), staffToggles: document.querySelectorAll("#muPlayMix .muMix").length }));
    check("four lanes - Vocals, Drums, Bass, Other - all on, each with its waveform drawn (1200 peaks)", L.lanes.join() === "vocals,drums,bass,other" && L.btns.join() === "Vocals:true,Drums:true,Bass:true,Other:true"
      && L.peaks.every((n) => n === 1200) && L.drawn.every((n) => n > 200), L);
    check("…the song plays as those four layers (no split button, no staff toggles in the transport)", L.tracks.join() === "vocals,drums,bass,other" && !L.split && L.staffToggles === 0, L);

    await ev(() => MuScore.player().seek(0.5));
    await ev(() => MuScore.player().play());
    await sleep(1500);
    const P1 = await ev(() => ({ tr: MuScore.player().tracks(), head: parseFloat(document.querySelector("#muLayers .muHead").style.left), played: parseFloat(document.querySelector("#muLayers .muPlayed").style.width) }));
    await ev(() => MuScore.player().pause());
    const ts = P1.tr.map((t) => t.t);
    check("▶: the four layers play together, in step (within 0.1 s), the playhead moves along every lane", P1.tr.every((t) => !t.paused) && Math.max(...ts) - Math.min(...ts) < 0.1 && ts[0] > 1.5 && P1.head > 10 && Math.abs(P1.head - P1.played) < 0.01, P1);

    await ev(() => document.querySelector('#muLayers [data-track="drums"]').click());
    const m1 = await ev(() => ({ tr: MuScore.player().tracks().map((t) => t.key + ":" + t.on).join(), off: [...document.querySelectorAll("#muLayers .muLane.off")].map((l) => l.dataset.lane) }));
    check("Drums off: muted, its lane greyed", m1.tr === "vocals:true,drums:false,bass:true,other:true" && m1.off.join() === "drums", m1);
    await ev(() => document.querySelector('#muLayers [data-track="vocals"]').dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
    check("Shift+click Vocals: the vocals alone", (await ev(() => MuScore.player().tracks().map((t) => t.on).join())) === "true,false,false,false");
    await ev(() => document.querySelector('#muLayers [data-track="vocals"]').dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
    check("…again: every layer back", (await ev(() => MuScore.player().tracks().map((t) => t.on).join())) === "true,true,true,true");

    const sk = await ev(() => { const w = document.querySelector('#muLayers .muWave[data-key="bass"]'), r = w.getBoundingClientRect();
      w.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + r.width * 0.5, clientY: r.top + 5 }));
      return { pos: MuScore.player().position(), a: MuScore.player().audio.currentTime, dur: MuScore.player().audio.duration }; });
    check("a click on a wave plays from there (the middle = 5 s of 10)", Math.abs(sk.a - sk.dur / 2) < 0.15 && Math.abs(sk.pos - sk.a) < 0.15, sk);

    // another song, not split: one Song lane + ✂ Split into layers, the choice remembered
    await p.selectOption("#muPlaySound", "song:output/" + PLAIN);
    await sleep(500);
    const n1 = await ev((sc) => ({ lanes: [...document.querySelectorAll("#muLayers .muLane")].map((l) => l.dataset.lane), split: !!document.getElementById("muStemSep"), tracks: MuScore.player().tracks().length,
      saved: JSON.parse(localStorage.getItem("h3.muScoreSong") || "{}")[sc] }), SCORE);
    check("a song that is not split: one Song lane, ✂ Split into layers; the pick remembered for this score", n1.lanes.join() === "song" && n1.split && n1.tracks === 1 && n1.saved === "output/" + PLAIN, n1);
    await ev(() => document.getElementById("muStemSep").click());
    await p.waitForFunction(() => document.querySelectorAll("#muLayers .muLane").length === 4, null, { timeout: 15000 }).catch(() => {});
    const n2 = await ev(() => ({ lanes: [...document.querySelectorAll("#muLayers .muLane")].map((l) => l.dataset.lane), pick: document.getElementById("muPlaySound").value, label: document.getElementById("muPlaySound").selectedOptions[0].textContent, tracks: MuScore.player().tracks().length, st: document.getElementById("muSheetStatus").textContent }));
    check("✂ Split into layers: asked for 4 layers of that song, its four lanes appear, still that song", asked && asked.file === PLAIN && asked.layers === 4 && n2.lanes.join() === "vocals,drums,bass,other" && n2.tracks === 4
      && n2.pick === "song:output/" + PLAIN && /· 4 layers$/.test(n2.label) && /split into its layers/.test(n2.st), { asked, n2 });

    // the notes: a hint, the staff toggles, and they sound
    await p.selectOption("#muPlaySound", "synth");
    await sleep(300);
    const y = await ev(() => ({ hint: document.getElementById("muLayers").textContent, hidden: document.getElementById("muLayers").hidden, staff: [...document.querySelectorAll("#muPlayMix .muMix")].map((x) => x.textContent), mode: MuScore.player().mode }));
    check("🎹 the notes: no lanes but a hint to pick the recording; a toggle per staff", !y.hidden && /pick the recording under Sound/.test(y.hint) && y.staff.join() === "Vocal,Piano" && y.mode === "synth", y);
    await ev(() => { MuScore.player().seek(0); return MuScore.player().play(); });
    await sleep(1300);
    const sy = await ev(() => { const s = MuScore.player().struck(); MuScore.player().pause(); return s; });
    check("…and they sound (the soft piano strikes both staves)", sy[0] > 0 && sy[1] > 0, sy);
    await open();
    check("the choice is kept after a reload (the notes, for this score)", (await ev(() => document.getElementById("muPlaySound").value)) === "synth");
    await ev((sc) => { const m = JSON.parse(localStorage.getItem("h3.muScoreSong") || "{}"); delete m[sc]; localStorage.setItem("h3.muScoreSong", JSON.stringify(m)); }, SCORE);
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
