#!/usr/bin/env node
/* bitGen Studio — 2.967.0 in a REAL browser: the four 🎤 extras on the Synth tab's row (Tim: "cool, go with the next" - the
 * 2.965.0 ideas): ■ Stop a running job (its process really ended), Key "Auto", ⧉ Mix (your voice over the instrumental -> one
 * file) and 🎧 hear yourself while 🎙 recording (Chromium's fake microphone). Against the running app (H3_URL), with stand-in
 * engines (scripts/stub-venv.py behind singvoice/<engine>/.venv/bin/python and venvs/demucs - made here, removed after). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const made = [], SLOW = path.join(os.tmpdir(), "ui967_slow");
function stubPy(f) {     // the stand-in python; STUB_SING_SLOW read from a file so this test can make ▶ slow, then fast
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `#!/bin/sh\nSTUB_SING_SLOW=$(cat "${SLOW}" 2>/dev/null || echo 0)\nexport STUB_SING_SLOW\nexec python3 "${path.join(ROOT, "scripts", "stub-venv.py")}" "$@"\n`);
  fs.chmodSync(f, 0o755);
}
function setup() {
  for (const d of ["singvoice", "sing_voices"]) if (fs.existsSync(path.join(ROOT, d))) throw new Error(d + "/ is already here - move it away first (this test makes its own)");
  made.push(path.join(ROOT, "singvoice"), path.join(ROOT, "sing_voices"));
  stubPy(path.join(ROOT, "singvoice", "seedvc", ".venv", "bin", "python")); fs.mkdirSync(path.join(ROOT, "singvoice", "seedvc", "src"), { recursive: true }); fs.writeFileSync(path.join(ROOT, "singvoice", "seedvc", "src", "inference.py"), "");
  stubPy(path.join(ROOT, "singvoice", "rvc", ".venv", "bin", "python")); fs.mkdirSync(path.join(ROOT, "singvoice", "rvc", "src"), { recursive: true }); fs.writeFileSync(path.join(ROOT, "singvoice", "rvc", "src", "core.py"), "");
  const v = path.join(ROOT, "singvoice", "rvc", "voices", "tim"); fs.mkdirSync(v, { recursive: true }); fs.writeFileSync(path.join(v, "tim_300e_1000s.pth"), "x"); fs.writeFileSync(path.join(v, "tim.index"), "x");
  const dp = path.join(ROOT, "venvs", "demucs", "bin", "python");
  if (!fs.existsSync(dp)) { made.push(path.join(ROOT, "venvs", "demucs")); stubPy(dp); }
}
function wav(f, secs) { const rate = 22050, n = Math.round(secs * rate), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(9000 * Math.sin(i * 0.04)), 44 + i * 2); fs.writeFileSync(f, b); return f; }
const stubsRunning = () => { try { return execSync("ps -eo args", { encoding: "utf8" }).split("\n").filter((l) => /stub-venv\.py/.test(l) && /singvoice_local/.test(l)).length; } catch { return -1; } };
function findAll(dir, re, out) { let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; } for (const e of es) { const f = path.join(dir, e.name); if (e.isDirectory()) findAll(f, re, out); else if (re.test(e.name)) out.push(f); } return out; }

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  setup(); fs.writeFileSync(SLOW, "0");
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } }); await ctx.grantPermissions(["microphone"]);
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const tl = () => ev(() => window.H3SynthTL.tl());
  const si = () => ev(() => window.H3SynthSing.info());
  const idle = (ms) => p.waitForFunction(() => !window.H3SynthSing.info().busy, null, { timeout: ms || 30000 });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && window.H3SynthSing && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(async () => { Object.keys(localStorage).filter((k) => /^h3\.synth\.sing\./.test(k)).forEach((k) => localStorage.removeItem(k));
      window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); ["rack", "keys", "loop"].forEach((f) => window.H3Synth.fold(f, true));
      window.H3SynthTL.setTL({ layers: [{ name: "ui967 song", clips: [] }] }); await window.H3SynthTL.addClip("kit:crash", 0, 0); window.H3SynthTL.select(0, null);
      await window.H3SynthSing.refresh(); });
    await sleep(300);
    // the row
    const r0 = await ev(() => { const v = (id) => { const e = document.getElementById(id); return e ? !e.hidden && e.getBoundingClientRect().width > 0 : false; };
      return { stop: v("sySingStop"), mix: v("sySingMix"), mon: v("sySingMon"), keys: [...document.querySelectorAll("#sySingKey option")].slice(0, 2).map((o) => o.value + "|" + o.textContent + "|" + o.disabled).join() }; });
    check("the row: ⧉ Mix and 🎧 shown, ■ Stop hidden while nothing runs; Key starts with Auto", r0.mix && r0.mon && !r0.stop && /^auto\|Auto\|false,-12\|-12\|false$/.test(r0.keys), r0);
    await p.selectOption("#sySingKey", "auto");
    await p.selectOption("#sySingEngine", "rvc");
    const k1 = await ev(() => ({ v: document.getElementById("sySingKey").value, dis: document.querySelector("#sySingKey option[value=auto]").disabled }));
    await p.selectOption("#sySingEngine", "seedvc");
    const k2 = await ev(() => document.querySelector("#sySingKey option[value=auto]").disabled);
    check("Key Auto with RVC: not offered (disabled, back to ±0); with Seed-VC it is again", k1.v === "0" && k1.dis && k2 === false, { k1, k2 });
    // ⧉ Mix with nothing sung yet
    await p.click("#sySingMix"); await sleep(150);
    check("⧉ Mix before anything is sung: says to ▶ first (nothing made)", /needs a layer sung in your voice/.test((await si()).msg) && (await tl()).layers.length === 1, await si());
    // a clip of your voice
    const clipf = wav(path.join(os.tmpdir(), "ui967 my voice.wav"), 3);
    await p.setInputFiles("#sySingFile", clipf); await p.waitForFunction(() => /ui967 my voice/.test(document.getElementById("sySingVoice").value), null, { timeout: 15000 });
    // ■ Stop a slow ▶
    fs.writeFileSync(SLOW, "25");
    await ev(() => window.H3SynthTL.select(0, null));
    await p.click("#sySingGo");
    await p.waitForFunction(() => { const i = window.H3SynthSing.info(); return i.busy === "convert" && i.job && /is singing/.test(i.msg); }, null, { timeout: 30000 });
    await sleep(800);
    const s1 = await ev(() => ({ shown: !document.getElementById("sySingStop").hidden, go: document.getElementById("sySingGo").disabled, mix: document.getElementById("sySingMix").disabled }));
    const running = stubsRunning();
    await p.click("#sySingStop");
    await idle(15000);
    const after = await si(), t1 = await tl();
    const jst = await ev((id) => fetch("/api/sing/job/" + id).then((r) => r.json()), after.job);
    await sleep(300);
    check("■ Stop is shown while ▶ runs (▶ / ⧉ locked); pressing it ends the engine's process for real", s1.shown && s1.go && s1.mix && running === 1 && stubsRunning() === 0, { s1, running, now: stubsRunning() });
    check("...the job is cancelled, nothing added (the song, its vocals and instrumental only), it says so, ■ hidden again",
      jst.job.state === "cancelled" && /■ Stopped - nothing added/.test(after.msg) && t1.layers.length === 3 && !t1.layers.some((l) => l.role === "voice") && await ev(() => document.getElementById("sySingStop").hidden) && jst.lines.some((l) => /\[stop\] ■ stopped/.test(l)), { st: jst.job.state, msg: after.msg, n: t1.layers.length });
    // ▶ again, Key Auto, fast
    fs.writeFileSync(SLOW, "0");
    await p.selectOption("#sySingKey", "auto");
    await ev(() => window.H3SynthTL.select(1, null));
    await p.click("#sySingGo");
    await p.waitForFunction(() => { const i = window.H3SynthSing.info(); return !i.busy && i.last && i.last.kind === "convert"; }, null, { timeout: 30000 });
    const ja = await ev((id) => fetch("/api/sing/job/" + id).then((r) => r.json()), (await si()).job);
    const t2 = await tl();
    check("▶ with Key Auto: the engine was asked for auto (shift 0, auto True); the voice layer under it",
      ja.lines.some((l) => /\[sing\] seedvc shift 0 auto True/.test(l)) && ja.lines.some((l) => /key auto \(fitted to your voice\)/.test(l)) && t2.layers.length === 4 && t2.layers[3].role === "voice", { lines: ja.lines.slice(-6), n: t2.layers.length });
    // ⧉ Mix
    await ev(() => window.H3SynthTL.select(0, null));       // not the voice layer: Mix finds the newest one
    await p.click("#sySingMix");
    await p.waitForFunction(() => { const i = window.H3SynthSing.info(); return !i.busy && i.last && i.last.kind === "mix"; }, null, { timeout: 30000 });
    const m = await si(), t3 = await tl();
    const peak = await ev(async (src) => { const r = await fetch("/api/synth/samples/file/" + encodeURIComponent(src.replace(/^my:/, ""))); const ab = await r.arrayBuffer(); const ac = new OfflineAudioContext(1, 1, 48000); const buf = await ac.decodeAudioData(ab); let pk = 0; const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); return { pk, secs: buf.duration }; }, t3.layers[4].clips[0].src);
    check("⧉ Mix: the voice over the instrumental -> a new layer \"… (mix)\" from 0:00, the two it came from muted, a sound in it",
      t3.layers.length === 5 && /\(mix\)$/.test(t3.layers[4].name) && t3.layers[4].clips[0].start === 0 && t3.layers[3].mute && t3.layers[2].mute && !t3.layers[4].mute && m.last.from.join() === "3,2" && peak.pk > 0.05, { names: t3.layers.map((l) => l.name + (l.mute ? " (m)" : "")), last: m.last, peak });
    check("...also in the project's Sound assets (it says its name)", m.last.sound && /ui967 song/.test(m.last.sound) && new RegExp("also " + m.last.sound.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " in the Sound assets").test(m.msg), m);
    // 🎧 hear yourself while recording
    await p.click("#sySingMon");
    const mo = await ev(() => ({ pressed: document.getElementById("sySingMon").getAttribute("aria-pressed"), on: document.getElementById("sySingMon").classList.contains("on"), ls: localStorage.getItem("h3.synth.sing.mon") }));
    await p.click("#sySingRec");
    await p.waitForFunction(() => window.H3SynthSing.info().recording, null, { timeout: 10000 });
    await sleep(500);
    const r1 = await si();
    await p.click("#sySingMon"); await sleep(150); const r2 = await si();
    await p.click("#sySingMon"); await sleep(150); const r3 = await si();
    await p.click("#sySingRec"); await sleep(400); const r4 = await si();
    check("🎧 on (remembered): while 🎙 records you hear the mic (a running AudioContext); off / on again mid-take; closed with ■",
      mo.pressed === "true" && mo.on && mo.ls === "1" && r1.monitoring && r1.monState === "running" && /🎧 you hear yourself/.test(r1.msg) && !r2.monitoring && r3.monitoring && !r4.recording && !r4.monitoring, { mo, r1: [r1.monitoring, r1.monState], r2: r2.monitoring, r3: r3.monitoring, r4: [r4.recording, r4.monitoring] });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { try { window.toggleMax("synthdock", false); window.H3Audio.tab("musicdock"); } catch (e) { /* 2.967.0: the Music tab back - the docker state is kept by the server */ } window.H3SynthTL.setTL(null); Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); await sleep(900); } catch (e) { /* gone */ }   // the docker state is saved 400 ms later
    await b.close();
    made.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
    try { fs.unlinkSync(SLOW); } catch (e) { /* gone */ }
    try { fs.readdirSync(path.join(ROOT, "synth_samples")).filter((n) => /ui967/.test(n)).forEach((n) => fs.unlinkSync(path.join(ROOT, "synth_samples", n))); } catch (e) { /* none */ }
    findAll(path.join(ROOT, "projects"), /^ui967 song/, []).forEach((f) => { try { fs.unlinkSync(f); } catch (e) { /* gone */ } });
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
