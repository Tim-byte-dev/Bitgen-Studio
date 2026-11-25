#!/usr/bin/env node
/* bitGen Studio — 2.965.0 in a REAL browser: 🎤 SING IT IN MY VOICE - the row above the Synth tab's timeline (Tim: "lets get all of
 * them and add them to a dropdown ... give it a go button (green triangle inside a circle pointing right). add another button to
 * separate the vocal from the instrumental in the same toolbar, separate the layer into 2 additional layers ... these buttons will
 * work on the selected layer"). Against the running app (H3_URL), with stand-in engines: singvoice/<engine>/.venv/bin/python and
 * venvs/demucs/bin/python are scripts/stub-venv.py (the runJson contract for real - no model), made here and removed after. */
"use strict";
const fs = require("fs");
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
const made = [];
function stubPy(f) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `#!/bin/sh\nexec python3 "${path.join(ROOT, "scripts", "stub-venv.py")}" "$@"\n`); fs.chmodSync(f, 0o755); }
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
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  setup();
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const tl = () => ev(() => window.H3SynthTL.tl());
  const si = () => ev(() => window.H3SynthSing.info());
  const waitLast = (kind, n) => p.waitForFunction((a) => { const i = window.H3SynthSing.info(); return !i.busy && i.last && i.last.kind === a[0] && window.H3SynthTL.tl().layers.length === a[1]; }, [kind, n], { timeout: 30000 });
  const STEMS = { installed: false };                              // 2.966.0: ✂ asks for the song separation first
  await p.route("**/api/stems", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ installed: STEMS.installed, model: "htdemucs", device: "auto" }) }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && window.H3SynthSing && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(async () => { Object.keys(localStorage).filter((k) => /^h3\.synth\.sing\./.test(k)).forEach((k) => localStorage.removeItem(k));
      window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true);
      window.H3SynthTL.setTL(null); await window.H3SynthSing.refresh(); });
    await sleep(400);
    const g = await ev(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { row: r("sySing").top, bar: document.querySelector("#syTL .sytlbar").getBoundingClientRect().top, cv: r("syTCanvas").top, go: r("sySingGo").width,
      opts: [...document.querySelectorAll("#sySingEngine option")].map((o) => o.value + "|" + o.textContent), voice: document.getElementById("sySingVoice").textContent, color: getComputedStyle(document.getElementById("sySingGo")).color }; });
    check("the 🎤 row sits above the timeline (above its bar and the layers)", g.row < g.bar && g.bar < g.cv, g);
    check("the model dropdown: Seed-VC, SoulX-Singer SVC (⬇ not installed yet here), RVC (Applio)",
      g.opts.length === 3 && /^seedvc\|Seed-VC/.test(g.opts[0]) && /^soulx\|SoulX-Singer.*not installed yet/.test(g.opts[1]) && /^rvc\|RVC \(Applio\)/.test(g.opts[2]) && !/not installed/.test(g.opts[0]), g.opts);
    check("▶ is green (a circle with a triangle); no clip yet = the voice list says so", /rgb\(46, 230, 107\)/.test(g.color) && g.go >= 26 && /no clip of your voice yet/.test(g.voice), g);
    // a song on layer 1, picked; ▶ with no voice
    await ev(async () => { window.H3SynthTL.setTL({ layers: [{ name: "My song", clips: [] }] }); await window.H3SynthTL.addClip("kit:crash", 0, 0); window.H3SynthTL.select(0, null); });
    await p.click("#sySingGo"); await sleep(150);
    check("▶ without a clip of your voice: says to record or add one (nothing done)", /Record \(or 📂 add\) a clip of your voice first/.test((await si()).msg) && (await tl()).layers.length === 1, await si());
    // 📂 a clip of your voice
    const clip = wav(path.join(require("os").tmpdir(), "ui965 my voice.wav"), 3);
    await p.setInputFiles("#sySingFile", clip); await p.waitForFunction(() => /ui965 my voice/.test(document.getElementById("sySingVoice").value), null, { timeout: 15000 });
    check("📂 a recording of your voice -> your clips, picked, its length shown", /ui965 my voice · 0:03/.test(await ev(() => document.getElementById("sySingVoice").selectedOptions[0].textContent)) && /is your voice now/.test((await si()).msg));
    // 2.966.0: ✂ with the song separation not installed -> the Download / Cancel box BEFORE anything is rendered
    await p.click("#sySingSep");
    await p.waitForSelector("#niDlg[open]", { timeout: 8000 }).catch(() => {});
    const nb = await ev(() => { const d = document.getElementById("niDlg"); return d ? { which: d.dataset.which, text: d.textContent } : null; });
    if (nb) await p.click("#niCancel");
    await p.waitForFunction(() => !window.H3SynthSing.info().busy, null, { timeout: 8000 }).catch(() => {});
    const nm = await si();
    check("✂ with the song separation not installed: the Download / Cancel box first; Cancel = nothing split, it says so",
      nb && nb.which === "demucs" && /splits the song on the picked layer/.test(nb.text) && /asks to download the song separation first/.test(nm.msg) && (await tl()).layers.length === 1, { nb, nm });
    STEMS.installed = true;
    // ✂ Separate vocals on the picked layer
    await p.click("#sySingSep"); await waitLast("separate", 3);
    const t1 = await tl(), l1 = (await si()).last;
    check("✂ Separate vocals: the picked layer -> 2 more layers (vocals, instrumental) from 0:00; the original kept, muted",
      t1.layers.length === 3 && t1.layers[0].name === "My song" && t1.layers[0].mute && t1.layers[1].role === "vocals" && t1.layers[2].role === "instrumental" && / · vocals$/.test(t1.layers[1].name) && / · instrumental$/.test(t1.layers[2].name) &&
      /^my:.* - vocals\.wav$/.test(t1.layers[1].clips[0].src) && /^my:.* - instrumental\.wav$/.test(t1.layers[2].clips[0].src) && t1.layers[1].clips[0].start === 0 && l1.vocals === 1 && l1.instrumental === 2 && !t1.layers[1].mute, { names: t1.layers.map((l) => [l.name, l.role, l.mute, l.clips[0] && l.clips[0].src]) });
    // ▶ on the vocals: Seed-VC, key +2
    await ev(() => window.H3SynthTL.select(1, null)); await p.selectOption("#sySingKey", "2"); await p.selectOption("#sySingQ", "best");
    await p.click("#sySingGo"); await waitLast("convert", 4);
    const t2 = await tl(), l2 = (await si()).last;
    const jl = await ev((id) => fetch("/api/sing/job/" + id).then((r) => r.json()), (await si()).job);
    check("▶ on the vocals (Seed-VC): a new layer in your voice from 0:00, the vocal muted; the engine got the key and the quality",
      t2.layers.length === 4 && t2.layers[3].role === "voice" && /\(Seed-VC\)$/.test(t2.layers[3].name) && t2.layers[1].mute && t2.layers[3].clips[0].start === 0 && /^my:.*\(ui965 my voice - Seed-VC\)\.wav$/.test(t2.layers[3].clips[0].src) &&
      l2.engine === "seedvc" && jl.lines.some((x) => /\[sing\] seedvc shift 2 quality best/.test(x)), { names: t2.layers.map((l) => [l.name, l.role, l.mute]), lines: jl.lines && jl.lines.slice(-5) });
    // RVC on the WHOLE song: separated first, then sung with the trained model
    await p.selectOption("#sySingEngine", "rvc"); await sleep(100);
    const rv = await ev(() => ({ v: document.getElementById("sySingVoice").value, t: document.getElementById("sySingVoice").textContent, train: !document.getElementById("sySingTrain").hidden }));
    check("RVC: your trained models in the voice list (tim, 300 epochs), 🎓 Train shown", rv.v === "tim" && /🎓 tim \(300 epochs\)/.test(rv.t) && rv.train, rv);
    await ev(() => window.H3SynthTL.select(0, null));
    await p.click("#sySingGo"); await waitLast("convert", 7);
    const t3 = await tl();
    check("▶ on the whole song: ✂ separated first (vocals + instrumental), then the vocal sung in your voice (RVC) - 3 more layers",
      t3.layers.length === 7 && t3.layers[4].role === "vocals" && t3.layers[5].role === "instrumental" && t3.layers[6].role === "voice" && /\(RVC\)$/.test(t3.layers[6].name) && t3.layers[4].mute && /\(tim - RVC\)\.wav$/.test(t3.layers[6].clips[0].src), t3.layers.map((l) => [l.name, l.role, l.mute]));
    // the instrumental is refused
    await ev(() => window.H3SynthTL.select(5, null)); await p.click("#sySingGo"); await sleep(150);
    check("▶ on the instrumental: refused (pick the vocals)", /That is the instrumental/.test((await si()).msg) && (await tl()).layers.length === 7);
    // SoulX is not installed: the Download / Cancel box, Cancel = nothing done
    await p.selectOption("#sySingEngine", "soulx"); await ev(() => window.H3SynthTL.select(1, null));
    await p.click("#sySingGo"); await p.waitForSelector("#niDlg", { timeout: 8000 });
    const dl = await ev(() => ({ t: document.getElementById("niTitle").textContent, w: document.querySelector("#niDlg .niwhy").textContent, which: document.getElementById("niDlg").dataset.which }));
    check("SoulX-Singer not installed: the Download / Cancel box for it (nothing rendered yet)", /SoulX-Singer SVC.*is not installed yet/.test(dl.t) && dl.which === "sing_soulx" && /uses SoulX-Singer/.test(dl.w) && !(await si()).busy, dl);
    await p.click("#niCancel"); await sleep(200);
    check("...Cancel: nothing done, said", /not installed - nothing done/.test((await si()).msg) && (await tl()).layers.length === 7, await si());
    // 🎓 train a model from your clips
    await p.selectOption("#sySingEngine", "rvc"); await p.click("#sySingTrain"); await p.waitForSelector("#sySingTrainBox");
    const tb = await ev(() => ({ clips: document.querySelectorAll("#sySingTrainBox [data-clip]").length, tot: document.getElementById("sySingTTot").textContent }));
    await p.fill("#sySingTName", "ui965_voice"); await p.click("#sySingTGo");
    await p.waitForFunction(() => document.getElementById("sySingVoice").value === "ui965_voice", null, { timeout: 20000 });
    check("🎓 Train: your clips ticked (with the total), a name -> the new model picked in the voice list", tb.clips === 1 && /0:03 of your voice - more is better/.test(tb.tot) && /ui965_voice is ready \(300 epochs\)/.test((await si()).msg), { tb, msg: (await si()).msg });
    check("the roles are kept in the saved timeline (a reload of the tab keeps what each layer holds)", await ev(() => { const t = window.H3SynthTLCore.cleanTL(JSON.parse(JSON.stringify(window.H3SynthTL.tl()))); return t.layers.map((l) => l.role || "-").join() === "-,vocals,instrumental,voice,vocals,instrumental,voice"; }));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { window.H3SynthTL.setTL(null); Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* gone */ }
    await b.close();
    made.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
    try { fs.readdirSync(path.join(ROOT, "synth_samples")).filter((n) => /^(sep|dry) My song|My song - |My song \(|ui965/.test(n)).forEach((n) => fs.unlinkSync(path.join(ROOT, "synth_samples", n))); } catch (e) { /* none */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
