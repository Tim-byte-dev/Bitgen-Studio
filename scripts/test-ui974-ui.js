#!/usr/bin/env node
/* bitGen Studio — 2.974.0 in a REAL browser.
 *   Edit Booth: a grip under each part - drag the Synth part 120 px taller (its screen grows), ↑ makes it 20 px shorter, the
 *   Keyboard part dragged short scrolls inside, a fresh page keeps both, double-click = its own height again.
 *   SFX ▸ 🧬 Clone a voice: an 8 s sound opened -> its waveform with START / END (the first 8 s), the START marker dragged to
 *   ~2 s and END to ~6 s, the shaded part dragged 1 s right, ← → on a marker, typed seconds, ▶ the part; 🧬 Save voice -> the
 *   server keeps ~4 s (the part) and the voice is picked in 🗣 Speech & dialog. The voice is deleted after.
 * Tim: "in audio docker edith booth, allow me to resize all the panels heights individually. in the sfx tab add clone voice,
 * then add that voice to read the text. add the saved file to the gallery. the clone voice will show a wave form and the user
 * will be able to select a region of the waveform with a draggable start marker and a draggable end marker to use as the sample" */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const VOICE = "ui974_voice";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui974_")), wav = path.join(tmp, "Speaker sample.wav");
  try { execSync(`ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=220:duration=8" -af "volume='0.3+0.3*sin(2*PI*t)':eval=frame" -ac 1 -ar 44100 "${wav}"`); } catch (e) { console.log("SKIP: no ffmpeg"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] }), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sleep = (ms) => p.waitForTimeout(ms);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Synth && window.H3VoiceClone && window.H3VoiceClone.state && window.H3SpeechDialog, null, { timeout: 60000 });
    await sleep(1200);
    await ev(() => { localStorage.removeItem("h3.synth.secH"); ["rack", "keys", "loop", "tl"].forEach((k) => H3Synth.height(k, null)); H3Synth.fold("rack", false); H3Synth.fold("keys", false); });

    /* ---------------- the Edit Booth's heights ---------------- */
    await ev(() => { H3Audio.tab("synthdock"); toggleMax("synthdock", true); });
    await sleep(800);
    const grips = await ev(() => ["rack", "keys", "loop", "tl"].map((k) => { const g = document.getElementById("sySecG_" + k); return g && g.getAttribute("role") + ":" + g.getAttribute("aria-label"); }));
    check("a grip under each part (Synth, Keyboard, Looper, Timeline) - a separator with its name", grips.join("|") === "separator:Height of Synth|separator:Height of Keyboard|separator:Height of Looper|separator:Height of Timeline", grips);
    const h0 = await ev(() => ({ body: document.querySelector("#sySec_rack > .sysecbody").getBoundingClientRect().height, scope: document.getElementById("syScope").getBoundingClientRect().height }));
    const g = await p.locator("#sySecG_rack").boundingBox();
    await p.mouse.move(g.x + g.width / 2, g.y + 4); await p.mouse.down(); await p.mouse.move(g.x + g.width / 2, g.y + 64, { steps: 4 }); await p.mouse.move(g.x + g.width / 2, g.y + 124, { steps: 4 }); await p.mouse.up();
    await sleep(300);
    const h1 = await ev(() => ({ body: document.querySelector("#sySec_rack > .sysecbody").getBoundingClientRect().height, scope: document.getElementById("syScope").getBoundingClientRect().height, kept: JSON.parse(localStorage.getItem("h3.synth.secH") || "{}"), sized: document.getElementById("sySec_rack").classList.contains("sized") }));
    check("drag the Synth grip down 120 px: the part is 120 px taller, its screen grew with it, kept", Math.abs(h1.body - h0.body - 120) <= 3 && h1.scope > h0.scope + 60 && h1.sized && Math.abs(h1.kept.rack - Math.round(h1.body)) <= 1, { h0, h1 });
    await p.focus("#sySecG_rack"); await p.keyboard.press("ArrowUp"); await sleep(150);
    const h2 = await ev(() => document.querySelector("#sySec_rack > .sysecbody").getBoundingClientRect().height);
    check("↑ on the grip = 20 px shorter", Math.abs(h1.body - h2 - 20) <= 2, { h1: h1.body, h2 });
    await ev(() => H3Synth.height("keys", 110));
    await sleep(200);
    const k1 = await ev(() => { const bd = document.querySelector("#sySec_keys > .sysecbody"); return { h: bd.getBoundingClientRect().height, scroll: bd.scrollHeight > bd.clientHeight + 20, over: getComputedStyle(bd).overflowY }; });
    check("the Keyboard part made short (110 px) scrolls inside instead of squashing the keys", Math.abs(k1.h - 110) <= 1 && k1.scroll && k1.over === "auto", k1);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Synth && document.getElementById("sySecG_rack"), null, { timeout: 60000 });
    await sleep(800);
    const k2 = await ev(() => ({ rack: document.querySelector("#sySec_rack > .sysecbody").style.height, keys: document.querySelector("#sySec_keys > .sysecbody").style.height }));
    check("a fresh page keeps each part's height", parseFloat(k2.rack) === Math.round(h2) && k2.keys === "110px", k2);
    await p.dblclick("#sySecG_keys"); await sleep(200);
    const k3 = await ev(() => ({ h: document.querySelector("#sySec_keys > .sysecbody").style.height, sized: document.getElementById("sySec_keys").classList.contains("sized"), kept: JSON.parse(localStorage.getItem("h3.synth.secH") || "{}") }));
    check("double-click the grip = the part's own height again (forgotten)", k3.h === "" && !k3.sized && !("keys" in k3.kept) && "rack" in k3.kept, k3);
    await ev(() => { H3Synth.height("rack", null); toggleMax("synthdock", false); });

    /* ---------------- SFX ▸ 🧬 Clone a voice ---------------- */
    await ev(() => { H3Audio.tab("sfxdock"); toggleMax("sfxdock", true); }); await sleep(800);
    await ev(() => { document.getElementById("vcBox").open = true; document.getElementById("vcBox").scrollIntoView(); });
    const before = await ev(() => ({ wave: document.getElementById("vcWave").hidden, edit: document.getElementById("vcEdit").hidden, proj: document.querySelectorAll("#vcProj optgroup").length }));
    await p.setInputFiles("#vcFile", wav);
    await p.waitForFunction(() => H3VoiceClone.state.dur > 7, null, { timeout: 15000 });
    await sleep(300);
    const w0 = await ev(() => { const c = document.getElementById("vcCanvas"), g2 = c.getContext("2d"), d = g2.getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i + 1] > 180 && d[i] < 120) lit++; return { info: H3VoiceClone.info(), lit, wave: document.getElementById("vcWave").hidden, name: document.getElementById("vcName").value, len: document.getElementById("vcLen").textContent }; });
    check("📂 a file: the waveform is drawn (the part lit), START at 0 and END at 8 s (the whole of a sound under 10 s); a name from the file",
      before.wave && before.edit && before.proj >= 1 && !w0.wave && w0.lit > 400 && w0.info.a === 0 && Math.abs(w0.info.b - 8) < 0.05 && w0.name === "Speaker_sample" && /a good length/.test(w0.len), { before, w0 });
    await p.locator("#vcWave").scrollIntoViewIfNeeded(); await sleep(200);
    const box = await p.locator("#vcWave").boundingBox(), xOf = (t) => box.x + (t / 8) * box.width;
    await p.mouse.move(xOf(0) + 2, box.y + 30); await p.mouse.down(); await p.mouse.move(xOf(1), box.y + 30, { steps: 3 }); await p.mouse.move(xOf(2), box.y + 30, { steps: 3 }); await p.mouse.up();
    await p.mouse.move(xOf(8) - 2, box.y + 30); await p.mouse.down(); await p.mouse.move(xOf(7), box.y + 30, { steps: 3 }); await p.mouse.move(xOf(6), box.y + 30, { steps: 3 }); await p.mouse.up();
    const w1 = await ev(() => H3VoiceClone.info());
    check("drag the START marker to ~2 s and the END marker to ~6 s", Math.abs(w1.a - 2) < 0.1 && Math.abs(w1.b - 6) < 0.1, w1);
    await p.mouse.move(xOf(4), box.y + 40); await p.mouse.down(); await p.mouse.move(xOf(4.5), box.y + 40, { steps: 3 }); await p.mouse.move(xOf(5), box.y + 40, { steps: 3 }); await p.mouse.up();
    const w2 = await ev(() => H3VoiceClone.info());
    check("drag the shaded part 1 s right: both markers move, the length stays", Math.abs(w2.a - 3) < 0.1 && Math.abs(w2.b - 7) < 0.1 && Math.abs((w2.b - w2.a) - (w1.b - w1.a)) < 0.02, w2);
    await p.focus("#vcMA"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("Shift+ArrowLeft");
    const w3 = await ev(() => ({ i: H3VoiceClone.info(), now: document.getElementById("vcMA").getAttribute("aria-valuenow"), field: document.getElementById("vcA").value }));
    check("← and Shift+← on the START marker: 0.1 s and 1 s earlier; the Start box and the slider say so", Math.abs(w3.i.a - (w2.a - 1.1)) < 0.02 && w3.now === w3.i.a.toFixed(2) && w3.field === w3.i.a.toFixed(2), w3);
    await p.fill("#vcB", "5.5"); await p.dispatchEvent("#vcB", "change");
    await p.fill("#vcA", "1.5"); await p.dispatchEvent("#vcA", "change");
    const w4 = await ev(() => H3VoiceClone.info());
    check("typed seconds move the markers (Start 1.5, End 5.5)", w4.a === 1.5 && w4.b === 5.5, w4);
    await p.click("#vcPlay"); await sleep(400);
    const pl = await ev(() => ({ playing: !!H3VoiceClone.state.src, btn: document.getElementById("vcPlay").textContent }));
    await p.click("#vcPlay");
    check("▶ Play the part plays (and ■ stops)", pl.playing && pl.btn === "■ Stop" && !(await ev(() => !!H3VoiceClone.state.src)), pl);
    await p.fill("#vcName", VOICE); await p.fill("#vcText", "a test voice");
    await p.click("#vcSave");
    await p.waitForFunction(() => /saved/.test(document.getElementById("vcMsg").textContent) || /⚠/.test(document.getElementById("vcMsg").textContent), null, { timeout: 20000 });
    const sv = await ev(async (n) => { const t = await (await fetch("/api/tts")).json(); const v = (t.voices || []).find((x) => x.name === n); return { msg: document.getElementById("vcMsg").textContent, v, picked: document.getElementById("spVoice").value }; }, VOICE);
    check("🧬 Save voice: the server keeps just the part (~4 s of the 8) as \"" + VOICE + "\" with its words; it is PICKED as the Voice in 🗣 Speech & dialog to read the text",
      sv.v && sv.v.kind === "clone" && Math.abs(sv.v.seconds - 4) < 0.15 && sv.v.text === "a test voice" && sv.picked === VOICE && /picked as the Voice/.test(sv.msg), sv);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the run threw - " + (e && e.stack || e)); }
  try { await ev(async (n) => { await fetch("/api/tts/voices/" + encodeURIComponent(n), { method: "DELETE" }); localStorage.removeItem("h3.synth.secH"); toggleMax("sfxdock", false); H3Audio.tab("musicdock"); }, VOICE); await sleep(900); } catch { /* fine */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
