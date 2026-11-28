#!/usr/bin/env node
/* bitGen Studio — 3.10.0 in a REAL browser: the Edit Booth timeline's 🆕 New (a new song - empty, unnamed) and 🧹 Clear
 * (the clips gone, the layers and the name kept), each asked first and one ↶ Undo step. Against the running app (H3_URL).
 * Tim: "add a "new" button to the edit booth timeline so user can work on a new song, add a clear button to clear the edit
 * booth timeline" */
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
  const sum = () => ev(() => { const t = window.H3SynthTL.tl(); return { layers: t.layers.map((L) => L.name), clips: t.layers.reduce((a, L) => a + L.clips.length, 0), markers: t.markers.length, name: document.getElementById("syTName").textContent, msg: (document.getElementById("syMsg") || {}).textContent || "" }; });
  const dlgYes = async () => { await p.waitForSelector("#syDlg [data-ok]", { timeout: 5000 }); await p.click("#syDlg [data-ok]"); await sleep(200); };
  let saved = "";
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true); }); await sleep(600);
    check("🆕 New and 🧹 Clear on the timeline's bar", await ev(() => !!document.getElementById("syTNew") && !!document.getElementById("syTClear") && document.getElementById("syTNew").offsetParent !== null));
    // a song: two clips, a marker, a named layer - saved under a name
    await ev(async () => { const T = window.H3SynthTL, t = T.tl(); t.layers[0].name = "Drums"; T.setTL(t); await T.addClip("kit:crash", 0, 0); await T.addClip("kit:boom", 1, 0.25); });
    await p.click("#syTMark"); await sleep(500);
    await p.click("#syTSave"); await p.waitForSelector("#syDlgName"); await p.fill("#syDlgName", "ui31000 song"); await p.click("#syDlg [data-ok]");
    await p.waitForFunction(() => document.getElementById("syTName").textContent === "ui31000 song", null, { timeout: 10000 }); saved = "ui31000 song.sfx";
    await ev(() => { const n = document.getElementById("sySongName"); if (n) n.value = "ui31000 song"; });
    const s0 = await sum();
    check("a song on the timeline: 2 clips, a marker, saved as ui31000 song", s0.clips === 2 && s0.markers === 1 && s0.name === "ui31000 song" && s0.layers[0] === "Drums", s0);
    await sleep(600);
    // 🧹 Clear - cancel first
    await p.click("#syTClear"); await p.waitForSelector("#syDlg [data-no]"); await p.click("#syDlg [data-no]"); await sleep(150);
    check("🧹 Clear asks first - Cancel keeps everything", (await sum()).clips === 2);
    await p.click("#syTClear"); await dlgYes();
    const s1 = await sum();
    check("🧹 Clear: the clips and the marker gone; the layers (Drums) and the song's name stay", s1.clips === 0 && s1.markers === 0 && s1.layers.join() === s0.layers.join() && s1.name === "ui31000 song" && /cleared/.test(s1.msg), s1);
    check("…kept (a reload would bring the empty timeline)", await ev(() => JSON.parse(localStorage.getItem("h3.synth.tl")).layers.every((L) => !L.clips.length)));
    await sleep(700); await p.click("#syUndo"); await sleep(300);
    check("↶ Undo brings the clips back (one step)", (await sum()).clips === 2 && (await sum()).markers === 1, await sum());
    await p.click("#syTClear"); await dlgYes(); await sleep(150);
    await p.click("#syTClear"); await sleep(200);
    check("🧹 on an empty timeline: no question, it says so", !(await ev(() => !!document.getElementById("syDlg"))) && /already empty/.test((await sum()).msg));
    await sleep(700); await p.click("#syUndo"); await sleep(300);
    // 🆕 New
    await p.click("#syTNew"); await dlgYes();
    const s2 = await sum();
    check("🆕 New: an empty timeline of 4 fresh layers, no name (unsaved), Save song's name blank", s2.clips === 0 && s2.markers === 0 && s2.layers.join() === "Layer 1,Layer 2,Layer 3,Layer 4" && s2.name === "unsaved"
      && (await ev(() => document.getElementById("sySongName").value)) === "" && (await ev(() => localStorage.getItem("h3.synth.tlfile"))) === "", s2);
    await p.click("#syTSave"); await p.waitForSelector("#syDlgName");
    check("…💾 Save then asks for a name", (await ev(() => document.getElementById("syDlgName").value)) === "my song");
    await p.click("#syDlg [data-no]"); await sleep(150);
    const f = await ev((n) => fetch("/api/synth/files/" + encodeURIComponent(n)).then((r) => r.json()), saved);
    check("…the old song stays saved as it was (its 2 clips)", f && f.tl && f.tl.layers.reduce((a, L) => a + L.clips.length, 0) === 2);
    await sleep(700); await p.click("#syUndo"); await sleep(300);
    check("↶ Undo brings the old timeline back", (await sum()).clips === 2);
    await p.click("#syTNew"); await dlgYes(); await sleep(150);
    await p.click("#syTNew"); await sleep(200);
    check("🆕 New on an empty, unsaved timeline: no question", !(await ev(() => !!document.getElementById("syDlg"))) && /new song/i.test((await sum()).msg));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      if (saved) await ev((nm) => fetch("/api/synth/files/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), saved);
      await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
