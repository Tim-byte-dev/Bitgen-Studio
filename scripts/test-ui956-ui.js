#!/usr/bin/env node
/* bitGen Studio — 2.956.0 in a REAL browser (Tim: "when record button is pressed in keyboard or looper , save the file on stop. allow
 * the synth or keyboard to load any of the saved files. save the timeline file as filename.sfx, looper files _loop_ random name.sfx
 * and keyboard as _key_random name.sfx. add a save button to timeline, if save does not have a filename ask for filename(dialog) ,
 * if it does have a filename overwrite the file loaded. add a save as button."). Against the running app (H3_URL). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const files = () => ev(() => fetch("/api/synth/files").then((r) => r.json()).then((j) => j.files));
  const made = [], samples = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthFile && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); }); await sleep(600);
    await p.click("#syBody", { position: { x: 900, y: 6 } });
    const before = (await files()).map((f) => f.name);
    /* ---- the keyboard: ● ... ■ = saved */
    await p.click("#syScRec"); await sleep(200);
    for (const m of [60, 62, 64]) { await ev((n) => window.H3Synth.noteOn(n, 0.9), m); await sleep(250); await ev((n) => window.H3Synth.noteOff(n), m); }
    await sleep(300); await p.click("#syScStop");
    await p.waitForFunction((b0) => window.H3SynthScore.take() && window.H3SynthScore.take().file, before, { timeout: 15000 });
    const key = await ev(() => { const t = window.H3SynthScore.take(); return { file: t.file, src: t.src }; });
    let fl = await files();
    made.push(key.file); samples.push(key.src.slice(3));
    check("■ on the keyboard: saved at once - _key_<random name>.sfx in the project, its sound _key_<same>.wav in 📂 My samples", /^_key_[a-z]+-[a-z]+-\d\d\.sfx$/.test(key.file) && key.src === "my:" + key.file.replace(/\.sfx$/, ".wav")
      && fl.some((f) => f.name === key.file && f.kind === "key"), { key, fl: fl.map((f) => f.name + ":" + f.kind) });
    const kj = await ev((n) => fetch("/api/synth/files/" + encodeURIComponent(n)).then((r) => r.json()), key.file);
    check("…the file holds the sheet music, the patch and the take", kj.format === "bitgen-synth" && kj.kind === "key" && /K:C/.test(kj.abc) && kj.patch && kj.patch.cut > 0 && kj.take === key.src && kj.seconds > 0.5, kj);
    /* ---- the looper: ⏺ ... ⏺ = saved */
    await ev(() => { window.H3SynthLoop.loop().bpm = 133; });
    await p.click("#syLRec"); await sleep(900); await p.click("#syLRec");
    await p.waitForFunction(() => window.H3SynthLoop.take() && window.H3SynthLoop.take().file, null, { timeout: 15000 });
    const lp = await ev(() => { const t = window.H3SynthLoop.take(); return { file: t.file, src: t.src }; });
    made.push(lp.file); samples.push(lp.src.slice(3));
    const lj = await ev((n) => fetch("/api/synth/files/" + encodeURIComponent(n)).then((r) => r.json()), lp.file);
    check("⏺ stop on the looper: _loop_<random name>.sfx saved - the loop as it was (133 BPM) + its take", /^_loop_[a-z]+-[a-z]+-\d\d\.sfx$/.test(lp.file) && lj.kind === "loop" && lj.loop.bpm === 133 && lj.take === lp.src, { lp, kind: lj.kind, bpm: lj.loop && lj.loop.bpm });
    /* ---- the timeline: 💾 Save asks a name the first time */
    check("the timeline bar: its file (unsaved), 💾 Save, Save as…, 🗂 Load", (await ev(() => document.getElementById("syTName").textContent)) === "unsaved" && (await ev(() => ["syTSave", "syTSaveAs", "syTLoad"].every((i) => document.getElementById(i)))));
    await ev(() => window.H3SynthTL.setTL(null));
    await ev(() => window.H3SynthTL.addClip("kit:crash", 0, 0));
    await p.click("#syTSave");
    await p.waitForSelector("#syDlg input", { timeout: 5000 });
    const nm = "t956 song " + Date.now() % 100000;
    await p.fill("#syDlg input", nm); await p.click("#syDlg [data-ok]");
    await p.waitForFunction((n) => window.H3Synth.tlFile() === n + ".sfx", nm, { timeout: 8000 });
    made.push(nm + ".sfx");
    let tj = await ev((n) => fetch("/api/synth/files/" + encodeURIComponent(n)).then((r) => r.json()), nm + ".sfx");
    check("💾 Save with no file yet: a name dialog -> <name>.sfx in the project (the timeline + the whole tab), the bar shows its name",
      tj.kind === "tl" && tj.tl.layers[0].clips.length === 1 && tj.loop.bpm === 133 && !!tj.patch && (await ev(() => document.getElementById("syTName").textContent)) === nm, { kind: tj.kind, name: await ev(() => document.getElementById("syTName").textContent) });
    // 💾 again: no dialog, written over
    await ev(() => window.H3SynthTL.addClip("kit:kick", 1, 1));
    await p.click("#syTSave"); await sleep(600);
    tj = await ev((n) => fetch("/api/synth/files/" + encodeURIComponent(n)).then((r) => r.json()), nm + ".sfx");
    check("💾 Save again: no dialog, the file loaded / saved is written over", !(await ev(() => document.getElementById("syDlg"))) && tj.tl.layers[1].clips.length === 1 && /written over/.test(await ev(() => document.getElementById("syMsg").textContent)), tj.tl.layers.map((l) => l.clips.length));
    // Save as… a new name; then Save as… onto an existing name -> overwrite?
    await p.click("#syTSaveAs"); await p.waitForSelector("#syDlg input");
    check("Save as…: always asks, the current name filled in", (await ev(() => document.querySelector("#syDlg input").value)) === nm);
    await p.fill("#syDlg input", nm + " b"); await p.press("#syDlg input", "Enter");
    await p.waitForFunction((n) => window.H3Synth.tlFile() === n + " b.sfx", nm, { timeout: 8000 }); made.push(nm + " b.sfx");
    await p.click("#syTSaveAs"); await p.waitForSelector("#syDlg input"); await p.fill("#syDlg input", nm); await p.click("#syDlg [data-ok]");
    await p.waitForSelector("#syDlg [data-ok]"); await sleep(150);
    const ow = await ev(() => document.querySelector("#syDlg").textContent);
    check("…onto a name that is there: asks before writing over it", /already in this project/.test(ow), ow);
    await p.click("#syDlg [data-no]"); await sleep(200);
    check("…Cancel keeps the file it had", (await ev(() => window.H3Synth.tlFile())) === nm + " b.sfx" && !(await ev(() => document.getElementById("syDlg"))));
    /* ---- 🗂 Load: any file, anywhere */
    await ev(() => window.H3SynthTL.setTL(null)); await ev(() => { window.H3SynthLoop.loop().bpm = 90; });
    await p.click("#syLLoad"); await p.waitForSelector("#syDlg .item");
    const tabs = await ev(() => ({ on: document.querySelector("#syDlg [data-k].on").dataset.k, items: [...document.querySelectorAll("#syDlg .item b")].map((x) => x.textContent) }));
    check("🗂 Load in the looper: the project's files, the loop takes first (its tab picked)", tabs.on === "loop" && tabs.items.includes(lp.file.replace(/\.sfx$/, "")) && !tabs.items.includes(nm), tabs);
    await p.click('#syDlg [data-k="all"]');
    const all = await ev(() => [...document.querySelectorAll("#syDlg .item b")].map((x) => x.textContent));
    check("…All: every kind (any file loads anywhere)", [key.file, lp.file, nm + ".sfx"].every((f) => all.includes(f.replace(/\.sfx$/, ""))), all);
    await p.click(`#syDlg .item[data-n="${lp.file}"]`); await sleep(400);
    check("…a loop take: its loop is back (133 BPM) and → 🎞 Timeline has its take", (await ev(() => window.H3SynthLoop.loop().bpm)) === 133 && (await ev(() => window.H3SynthLoop.take().src)) === lp.src && !(await ev(() => document.getElementById("syLSend").disabled)));
    await ev(() => { window.H3SynthScore.open("X:1\nT:x\nK:C\nC|]\n", "x"); });
    await p.click("#syDkLoad"); await p.waitForSelector("#syDlg .item"); await p.click(`#syDlg .item[data-n="${key.file}"]`); await sleep(400);
    check("🗂 on the keyboard: a keyboard take - its sheet (3 notes) and its take back", (await ev(() => window.H3SynthScore.info().steps)) === 3 && (await ev(() => window.H3SynthScore.take().src)) === key.src);
    await p.click("#syScSend");
    await p.waitForFunction((s) => window.H3SynthTL.tl().layers.some((l) => l.clips.some((c) => c.src === s)), key.src, { timeout: 8000 });
    check("…→ 🎞 puts the loaded take on the timeline (no new copy of the sound)", (await ev(() => window.H3SynthTL.tl().layers.filter((l) => l.name === "Keys take").length)) === 1);
    await p.click("#syTLoad"); await p.waitForSelector("#syDlg .item"); await p.click(`#syDlg .item[data-n="${nm}.sfx"]`); await sleep(500);
    const back = await ev(() => ({ file: window.H3Synth.tlFile(), clips: window.H3SynthTL.tl().layers.map((l) => l.clips.length), bar: document.getElementById("syTName").textContent }));
    check("🗂 a timeline file: the timeline (and the whole tab) back; 💾 Save now writes over it", back.file === nm + ".sfx" && back.clips[0] === 1 && back.clips[1] === 1 && back.bar === nm, back);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      for (const n of made) await ev((nm) => fetch("/api/synth/files/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), n);
      for (const n of samples) await ev((nm) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), n);
      await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
