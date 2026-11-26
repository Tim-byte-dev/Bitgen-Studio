#!/usr/bin/env node
/* bitGen Studio — 2.953.0 in a REAL browser (Tim: "can we add a synthstation that looks something like this in Audio docker with a
 * midi keyboard and hammer head style looper that the user can add new samples to ?"): the Audio docker's 🎹 Synth tab - the
 * rack of knobs, the sound (a real AudioContext: the scope sees it), the keyboard (mouse, computer keys, MIDI messages), the
 * patches, the looper (pads, accents, painting, playing, patterns, ⛓), 📂 samples (upload, a file dropped on a row), 🎙 Sample it,
 * ⬇ WAV, → 💥 SFX, → 🔊, ⏺ Rec, hidden = quiet, ⛶ = the whole window and Esc back, kept over a reload. Against the running app
 * (H3_URL). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const C = require("../ext/synthdock/synthcore.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// a short test tone as a WAV (our own maths)
const tone = (hz, sec) => { const n = Math.round(48000 * sec), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = 0.6 * Math.sin(2 * Math.PI * hz * i / 48000) * (1 - i / n); return Buffer.from(C.wav([x], 48000)); };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctxB = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const p = await ctxB.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const info = () => ev(() => window.H3Synth.info());
  const made = [];   // samples to delete at the end
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Audio && window.H3Synth && window.H3SynthLoop && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); localStorage.removeItem("h3.g.synthdock"); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Audio && window.H3Synth && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    let i0 = await info();
    check("the first time: the Synth tab is not on screen by itself; nothing made yet (no AudioContext before a click)", !i0.shown && i0.state === "none", i0);
    /* ---- the Audio docker's 4th tab */
    await ev(() => window.H3Audio.toggle(true)); await sleep(300);
    const shownTab = await ev(() => window.H3Audio.IDS.filter((i) => !document.getElementById(i).classList.contains("dockgone"))[0]);
    const tabs = await ev((id) => [...document.querySelectorAll("#" + id + " .bhead [data-autab]")].map((x) => x.textContent).join("|"), shownTab);
    check("the Audio docker's tabs: 🎵 Music · 💥 SFX · 🎹 Edit Booth (Stems retired in 2.966.0; renamed 2.972.0)", tabs === "🎵 Music|💥 SFX|🎹 Edit Booth" /* 2.972.0 */, tabs);
    await p.click("#" + shownTab + ' [data-autab="synthdock"]'); await sleep(500);
    const on = await ev(() => window.H3Audio.IDS.filter((i) => !document.getElementById(i).classList.contains("dockgone")));
    const head = await ev(() => [...document.querySelector("#synthdock > .bhead").childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim());
    check("🎹 Synth: the station alone on screen, its title bar reads Audio with the tab lit", on.join() === "synthdock" && /^▾ Audio$/.test(head) && (await ev(() => document.querySelector('#synthdock [data-autab="synthdock"]').classList.contains("on"))), { on, head });
    // ⛶ = the whole window (room for the rack in any layout)
    await ev(() => window.toggleMax("synthdock", true)); await sleep(400);
    const full = await ev(() => { const r = document.getElementById("synthdock").getBoundingClientRect(); return { cls: document.body.classList.contains("sy-full"), w: r.width, h: r.height }; });
    check("⛶: the station fills the window", full.cls && full.w >= 1490 && full.h >= 940, full);
    /* ---- the rack */
    const rack = await ev(() => ({ panels: [...document.querySelectorAll("#syRack .sypanel h4")].map((h) => h.textContent), knobs: document.querySelectorAll("#syRack [data-p]").length,
      sliders: document.querySelectorAll('#syRack [role="slider"]').length, presets: document.querySelectorAll("#syPreset option").length, sel: document.getElementById("syPreset").value }));
    check("the rack: Oscillators · Filter · Filter env · Amp env · LFO · Effects · Master + the screen; 39 controls (33 knobs as sliders, 6 switches); 14 patches + the instruments (2.972.0), Neon Lead to start",
      rack.panels.join("|") === "Oscillators|Filter|Filter env|Amp env|LFO|Effects|Master" && rack.knobs === 39 && rack.sliders === 33 && rack.presets === (await ev(() => window.H3SynthCore.PRESETS.length)) && rack.presets > 80 && rack.sel === "o:Neon Lead", rack);
    // a knob dragged up: the cutoff rises, the patch is marked changed
    const cut0 = (await info()).p.cut, kb = await p.locator('#syRack [data-p="cut"] canvas').boundingBox();
    await p.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2); await p.mouse.down(); await p.mouse.move(kb.x + kb.width / 2, kb.y - 40, { steps: 6 }); await p.mouse.up();
    let i1 = await info();
    const shownText = await ev(() => document.querySelector('#syRack [data-p="cut"] .sykv').textContent);
    check("a knob dragged up: Cutoff higher, its value in words under it, the patch marked * (changed)", i1.p.cut > cut0 * 1.5 && /kHz|Hz/.test(shownText) && i1.dirty && /\*$/.test(await ev(() => { const s = document.getElementById("syPreset"); return s.options[s.selectedIndex].textContent; })), { cut0, cut: i1.p.cut, shownText });
    await p.dblclick('#syRack [data-p="cut"] canvas');
    check("…double-click = its default (2.40 kHz)", (await info()).p.cut === 2400, (await info()).p.cut);
    await p.focus('#syRack [data-p="res"]'); await p.keyboard.press("ArrowUp"); await p.keyboard.press("ArrowUp");
    check("…the arrow keys turn a focused knob", Math.abs((await info()).p.res - (C.patch("Neon Lead").res + 0.4)) < 0.01, (await info()).p.res);
    await p.click('#syRack [data-p="aWave"] button');
    check("a switch: click = the next wave (saw -> square)", (await info()).p.aWave === "square" && (await ev(() => document.querySelector('#syRack [data-p="aWave"] button').textContent)) === "SQUARE");
    await p.click('#syRack [data-p="aWave"] button', { button: "right" });
    check("…right-click = the one before", (await info()).p.aWave === "saw");
    /* ---- the sound, the keys */
    i1 = await info();
    check("the first click woke the sound (a running AudioContext)", i1.state === "running", i1.state);
    const pk = await p.locator("#syPiano").boundingBox();
    await p.mouse.move(pk.x + 5, pk.y + pk.height - 12); await p.mouse.down(); await sleep(250);
    const held = await info();
    const peak = await ev(() => { const a = window.H3Synth.engine().scope, x = new Float32Array(a.fftSize); a.getFloatTimeDomainData(x); let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); return m; });
    check("the keyboard on screen: the lowest key held = C3 (the octave shown) sounds - the scope sees it", held.down.join() === "48" && held.voices >= 1 && peak > 0.02, { down: held.down, peak });
    await p.mouse.move(pk.x + pk.width * 0.5, pk.y + pk.height - 12, { steps: 4 }); await sleep(120);
    const slid = await info();
    await p.mouse.up(); await sleep(150);
    check("…dragged along the keys it glides to the next ones; let go = nothing held", slid.down.length === 1 && slid.down[0] > 52 && (await info()).down.length === 0, slid.down);
    await p.focus("#syBody");
    await p.keyboard.down("z"); await p.keyboard.down("e"); await sleep(120);
    const keys = await info();
    await p.keyboard.up("z"); await p.keyboard.up("e"); await sleep(80);
    check("the computer keys while the station has the focus: Z = C3, E = E4 (the row above); up = off", keys.down.slice().sort((a, b) => a - b).join() === "48,64" && (await info()).down.length === 0, keys.down);
    await p.keyboard.press("ArrowUp"); await p.keyboard.down("z"); await sleep(60);
    const k2 = await info(); await p.keyboard.up("z");
    check("↑ = an octave up (C4 shown; Z = C4)", k2.oct === 4 && k2.down.join() === "60" && (await ev(() => document.getElementById("syOct").textContent)) === "C4", k2);
    await p.keyboard.press("ArrowDown");
    const leak = await ev(() => { let got = 0; const f = () => { got++; }; document.addEventListener("keydown", f); const e = new KeyboardEvent("keydown", { code: "KeyX", key: "x", bubbles: true }); document.getElementById("syBody").dispatchEvent(e);
      document.removeEventListener("keydown", f); document.getElementById("syBody").dispatchEvent(new KeyboardEvent("keyup", { code: "KeyX", key: "x", bubbles: true })); return got; });
    check("…a note key is never passed on to the app's own shortcuts", leak === 0, leak);
    // MIDI (the messages a keyboard sends)
    await ev(() => window.H3Synth.midi([0x90, 67, 100]));
    const m1 = await info();
    await ev(() => { window.H3Synth.midi([0xb0, 1, 127]); window.H3Synth.midi([0xe0, 127, 127]); });
    const wheels = await ev(() => ({ mod: window.H3Synth.engine().modV, bend: window.H3Synth.engine().bendV, modAria: document.getElementById("syMod").getAttribute("aria-valuenow") }));
    await ev(() => { window.H3Synth.midi([0x90, 67, 0]); window.H3Synth.midi([0xe0, 0, 64]); window.H3Synth.midi([0xb0, 1, 0]); });
    check("MIDI: note on (velocity), the mod wheel CC1 (its wheel follows), pitch bend; a note-on at 0 = off", m1.down.join() === "67" && wheels.mod === 1 && wheels.bend > 0.99 && wheels.modAria === "100" && (await info()).down.length === 0, { m1: m1.down, wheels });
    await ev(() => { window.H3Synth.midi([0xb0, 64, 127]); window.H3Synth.midi([0x90, 60, 90]); window.H3Synth.midi([0x80, 60, 0]); });
    const sus = await ev(() => window.H3Synth.engine().sounding());
    await ev(() => window.H3Synth.midi([0xb0, 64, 0])); await sleep(50);
    check("…sustain (CC64) holds a released note until the pedal comes up", sus >= 1 && (await ev(() => window.H3Synth.engine().sounding())) === 0, sus);
    /* ---- patches */
    await p.selectOption("#syPreset", "o:Deep Sub Bass");
    const sub = await info();
    check("a patch picked: its knobs (Deep Sub Bass = mono, a sub), the knobs redrawn, not marked changed", sub.p.mode === "mono" && sub.p.sub === 0.7 && !sub.dirty
      && (await ev(() => document.querySelector('#syRack [data-p="mode"] button').textContent)) === "MONO", sub.p);
    await ev(() => { window.H3Synth.noteOn(48, 0.8); window.H3Synth.noteOn(55, 0.8); });
    const mono = await ev(() => window.H3Synth.engine().sounding());
    await ev(() => { window.H3Synth.noteOff(55); window.H3Synth.noteOff(48); });
    check("…mono: two keys = one voice (it slides)", mono === 1, mono);
    await p.click("#syNext");
    check("▶ = the next patch", (await info()).preset === "o:Silver Pluck", (await info()).preset);
    await ev(() => window.H3Synth.set("cut", 5000));
    await p.click("#sySave"); await p.fill("#syName", "T953 Pluck"); await p.click("#syNameOk");
    const saved = await info();
    check("💾: a patch of my own (named in the bar - no pop-up), listed under My patches, picked", saved.user.join() === "T953 Pluck" && saved.preset === "u:T953 Pluck" && !saved.dirty
      && (await ev(() => [...document.querySelectorAll('#syPreset optgroup[label="My patches"] option')].map((o) => o.textContent).join())) === "T953 Pluck", saved.user);
    await p.click("#syDelPreset");
    check("🗑 deletes it (ours cannot be deleted)", (await info()).user.length === 0 && (await ev(() => document.getElementById("syDelPreset").disabled)));
    await p.selectOption("#syPreset", "o:Neon Lead");
    /* ---- the looper */
    await p.click('#syPats button[data-p="3"]');
    const pad = (r, s) => '#syRows .systeps button[data-r="' + r + '"][data-s="' + s + '"]';
    await p.click(pad(0, 0)); await p.click(pad(0, 8), { modifiers: ["Shift"] }); await p.click(pad(1, 4), { button: "right" });
    await p.locator(pad(3, 0)).scrollIntoViewIfNeeded();   // 2.955.0: the tab is taller (the parts' title bars) - the pads may be below the fold
    const b0 = await p.locator(pad(3, 0)).boundingBox(), b3 = await p.locator(pad(3, 3)).boundingBox();
    await p.mouse.move(b0.x + 5, b0.y + 5); await p.mouse.down(); await p.mouse.move(b3.x + 5, b3.y + 5, { steps: 8 }); await p.mouse.up();
    let li = (await info()).loop;
    check("pads on pattern D: click = on, Shift-click / right-click = an accent, a drag paints four in a row", li.pat === 3 && li.on[0] === "1000000020000000" && li.on[1] === "0000200000000000" && li.on[3] === "1111000000000000"
      && (await ev(() => document.querySelector('#syPats button[data-p="3"]').classList.contains("has"))), li.on);
    await p.fill("#syBpm", "150"); await p.press("#syBpm", "Enter");
    await p.click("#syPlay"); await sleep(1300);
    li = (await info()).loop;
    const lit = await ev(() => document.querySelectorAll("#syRows .systeps button.now").length);
    check("▶ Play: the clock runs (hits on time, the step light moves over all 8 rows), 150 BPM, the button says Stop", li.playing && li.hits >= 6 && li.step >= 0 && li.bpm === 150 && lit === 8
      && (await ev(() => document.getElementById("syPlay").textContent)) === "■ Stop", { li: { playing: li.playing, hits: li.hits, step: li.step, bpm: li.bpm }, lit });
    await p.click("#syChain"); await sleep(2200);
    const chainPats = new Set();
    for (let k = 0; k < 14; k++) { chainPats.add((await info()).loop.playPat); await sleep(250); }
    check("⛓ chain: A, B, C and D play one after another", [0, 1, 2, 3].filter((x) => chainPats.has(x)).length >= 3 && (await info()).loop.chain, [...chainPats]);
    await p.click("#syChain");
    await p.focus("#syBody"); await p.keyboard.press("Space"); await sleep(150);
    check("Space (the station's own) stops it", !(await info()).loop.playing);
    /* ---- samples */
    await p.click("#syLibBtn");
    await p.setInputFiles("#syFile", [{ name: "T953 beep.wav", mimeType: "audio/wav", buffer: tone(880, 0.3) }]);
    await p.waitForFunction(() => window.H3Synth.info().my.includes("T953 beep.wav"), null, { timeout: 10000 }); made.push("T953 beep.wav");
    const lib = await ev(() => ({ rows: [...document.querySelectorAll("#syLibList span")].map((s) => s.textContent), opts: [...document.querySelectorAll('#syRows .syr[data-r="7"] optgroup[label="📂 My samples"] option')].map((o) => o.value) }));
    check("📂 ＋ Add files: into My samples - listed, and offered in every row's sounds", lib.rows.includes("T953 beep.wav") && lib.opts.includes("my:T953 beep.wav"), lib);
    await ev(() => { const s = [...document.querySelectorAll("#syLibList > div")].find((d) => d.querySelector("span").textContent === "T953 beep.wav").querySelector("select"); s.value = "7"; s.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => window.H3SynthLoop.info().rows[7].ready, null, { timeout: 8000 });
    li = (await info()).loop;
    check("…→ row 8: the row plays it (loaded, its name in the row)", li.rows[7].snd === "my:T953 beep.wav" && li.rows[7].ready && (await ev(() => document.querySelector('#syRows .syr[data-r="7"] select').value)) === "my:T953 beep.wav", li.rows[7]);
    // a file dropped on a row
    const b64 = tone(220, 0.25).toString("base64");
    await ev((b) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const dt = new DataTransfer(); dt.items.add(new File([u], "T953 drop.wav", { type: "audio/wav" }));
      const row = document.querySelector('#syRows .syr[data-r="5"]'); row.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true })); row.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })); }, b64);
    await p.waitForFunction(() => /^my:T953 drop/.test(window.H3SynthLoop.info().rows[5].snd), null, { timeout: 10000 }); made.push("T953 drop.wav");
    check("a sound file dropped on row 6: added to My samples and put in that row", (await info()).loop.rows[5].snd === "my:T953 drop.wav" && (await info()).my.includes("T953 drop.wav"), (await info()).loop.rows[5]);
    // 🎙 Sample it
    const got = await ev(() => window.H3Synth.sample());
    if (got && got.name) made.push(got.name);
    check("🎙 Sample it: one note of the patch is a new sample (Neon Lead C4.wav) in My samples, said in words", !!got && /^Neon Lead C4( \(\d+\))?\.wav$/.test(got.name) && (await info()).my.includes(got.name)
      && /is in My samples/.test(await ev(() => document.getElementById("syMsg").textContent)), got);
    /* ---- out: WAV, SFX, Sound, Rec */
    await p.click('#syPats button[data-p="0"]');
    const dl = p.waitForEvent("download", { timeout: 20000 }); await p.click("#syWav"); const d = await dl;
    const fp = await d.path(), wavBytes = require("fs").readFileSync(fp);
    check("⬇ WAV: the loop (2 times round) downloads as a 16-bit stereo 48 kHz WAV, about 3.2 s at 150 BPM", /^synth loop A 150bpm\.wav$/.test(d.suggestedFilename()) && wavBytes.slice(0, 4).toString() === "RIFF"
      && wavBytes.readUInt16LE(22) === 2 && wavBytes.readUInt32LE(24) === 48000 && wavBytes.length > 48000 * 4 * 3.1, { name: d.suggestedFilename(), bytes: wavBytes.length });
    const toSfx = await ev(() => window.H3Synth.exportLoop("sfx"));
    const sfxList = await ev(() => fetch("/api/sfx").then((r) => r.json()));
    check("→ 💥 SFX: the loop is a sound effect of this project (the SFX tab lists it)", !!toSfx && toSfx.ok && sfxList.files.some((f) => f.name === toSfx.name) && (await info()).sfx.includes(toSfx.name), toSfx);
    const toSnd = await ev(() => window.H3Synth.exportLoop("sound"));
    check("→ 🔊: into the Sound assets too", !!toSnd && toSnd.ok && /Sound assets/.test(toSnd.note), toSnd);
    await p.click("#syRec"); await ev(() => window.H3Synth.noteOn(64, 1)); await sleep(1100); await ev(() => window.H3Synth.noteOff(64));
    check("⏺ Rec: recording (the button says ⏹ Stop rec)", (await info()).recording && (await ev(() => document.getElementById("syRec").textContent)) === "⏹ Stop rec");
    await p.click("#syRec");
    await p.waitForFunction(() => /synth take .*is in this project's SFX/.test(document.getElementById("syMsg").textContent), null, { timeout: 15000 }).catch(() => {});
    check("…⏹: the take is in this project's SFX", /synth take .*\.wav is in this project's SFX/.test(await ev(() => document.getElementById("syMsg").textContent)), await ev(() => document.getElementById("syMsg").textContent));
    /* ---- hidden = quiet; Esc; kept */
    await p.click("#syPlay"); await ev(() => window.H3Synth.noteOn(60, 1)); await sleep(200);
    await p.keyboard.press("Escape"); await sleep(400);
    check("Esc: back to the docker (not the whole window any more)", !(await ev(() => document.body.classList.contains("sy-full"))) && !(await ev(() => document.getElementById("synthdock").classList.contains("maxed"))));
    await ev(() => window.H3Audio.tab("musicdock")); await sleep(500);
    const hid = await info();
    check("another tab (Music): the station put away - the loop stopped, every note off", !hid.shown && !hid.loop.playing && hid.down.length === 0 && hid.voices === 0, { shown: hid.shown, playing: hid.loop.playing, down: hid.down, v: hid.voices });
    await ev(() => window.H3Synth.set("cut", 3333)); await sleep(500);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthLoop && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    const back = await info();
    check("kept over a reload: the knobs (Cutoff 3333), the loop (150 BPM, pattern D's pads, row 8's sample)", Math.round(back.p.cut) === 3333 && back.loop.bpm === 150 && back.loop.rows[7].snd === "my:T953 beep.wav"
      && C.cleanLoop(JSON.parse(await ev(() => localStorage.getItem("h3.synth.loop")))).pats[3][3].join("") === "1111000000000000", { cut: back.p.cut, bpm: back.loop.bpm });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try { for (const n of made) await ev((nm) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), n); } catch (e) { /* the page is gone */ }
    try { await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
