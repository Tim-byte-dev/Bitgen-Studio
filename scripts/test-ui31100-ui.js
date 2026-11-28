#!/usr/bin/env node
/* bitGen Studio — 3.11.0 in a REAL browser: ✍ Continue in the Edit Booth's 🎹 piano roll - its row (bars, model, instrument,
 * creativity, one instrument), ✨ Write (what it sends, the new notes added, the clip grown), 🎲 Again, ↶ Take back, and the
 * add-on's Download box when it is not installed. /api/amt/* are stood in for (the job end to end: scripts/test-amt-31100.py).
 * Tim: "okay let go with 1" (the Anticipatory Music Transformer for ✍ Continue) */
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
  // the stand-ins
  let posted = [], mode = "ok", polls = 0, take = 0;
  const TAKES = [[{ m: 62, t: 2, d: 0.4, v: 0.8 }, { m: 65, t: 2.5, d: 0.4, v: 0.8 }], [{ m: 70, t: 2.25, d: 0.5, v: 0.8 }]];
  await p.route("**/api/amt/continue", async (rt) => {
    posted.push(JSON.parse(rt.request().postData() || "{}")); polls = 0;
    if (mode === "409") return rt.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "not installed", needs: "amt", missing: [{ id: "w_small" }] }) });
    rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: { id: "amt" + posted.length, status: "queued" }, from: 2, to: 4 }) });
  });
  await p.route("**/api/amt/notes/*", (rt) => {
    polls++;
    if (polls < 2) return rt.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ status: "running", progress: { pct: 40 } }) });
    rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "done", notes: TAKES[take++ % 2], from: 2, to: 4, device: "cuda" }) });
  });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && window.H3SynthRoll && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && window.H3SynthRoll && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); }); await sleep(500);
    const st = await ev(async () => (await fetch("/api/amt")).json());
    check("GET /api/amt: the add-on's state and the instruments", typeof st.ready === "boolean" && st.models && "small" in st.models && st.instr[0].label === "Piano", st);
    // a note clip, its piano roll
    await ev(async () => { const T = window.H3SynthTL; T.setTL(null); await T.addNotes([{ m: 60, t: 0, d: 0.5, v: 0.6 }, { m: 64, t: 0.5, d: 0.5, v: 0.8 }, { m: 67, t: 1, d: 0.7, v: 1 }], "Melody", null, 0, 0); T.openRoll(0, 0); });
    await p.waitForSelector("#syRollCont");
    check("the piano roll has ✍ Continue; its row hidden until asked", await ev(() => getComputedStyle(document.getElementById("syRollContBox")).display === "none"));
    await p.click("#syRollCont"); await sleep(200);
    const row = await ev(() => ({ shown: getComputedStyle(document.getElementById("syRollContBox")).display !== "none", bars: document.getElementById("syContBars").value, model: document.getElementById("syContModel").value, instr: document.getElementById("syContInstr").value, only: document.getElementById("syContOnly").checked, top: document.getElementById("syContTop").value, again: document.getElementById("syContAgain").disabled }));
    check("✍ opens its row: 2 bars, Small, Piano, one instrument, creativity 0.97; 🎲 Again off (nothing written yet)", row.shown && row.bars === "2" && row.model === "small" && row.instr === "0" && row.only && row.top === "0.97" && row.again, row);
    await p.selectOption("#syContBars", "1"); await p.selectOption("#syContInstr", "33");
    await p.click("#syContGo");
    await p.waitForFunction(() => window.H3SynthTL.tl().layers[0].clips[0].notes.length === 5, null, { timeout: 10000 });
    const P0 = posted[0];
    check("✨ Write sends the clip's notes, its tempo, 1 bar, bass, small, one instrument, the creativity", P0 && P0.notes.length === 3 && P0.notes[1].m === 64 && P0.bpm > 0 && P0.bars === 1 && P0.instr === 33 && P0.model === "small" && P0.only === true && P0.top_p === 0.97, P0);
    const c1 = await ev(() => { const c = window.H3SynthTL.tl().layers[0].clips[0]; return { n: c.notes.map((x) => x.m), len: c.len, msg: document.getElementById("syContMsg").textContent, again: document.getElementById("syContAgain").disabled, roll: window.H3SynthRoll.info().notes }; });
    check("…the new notes added to the clip (in time order), the clip grown to the bars written, the roll shows them", c1.n.join() === "60,64,67,62,65" && c1.len >= 4 && c1.roll === 5, c1);
    check("…said; 🎲 Again and ↶ Take back on", /2 new notes/.test(c1.msg) && !c1.again, c1.msg);
    check("…the row's settings kept for next time", await ev(() => localStorage.getItem("h3.synth.amt.bars") === "1" && localStorage.getItem("h3.synth.amt.instr") === "33"));
    await p.click("#syContAgain");
    await p.waitForFunction(() => window.H3SynthTL.tl().layers[0].clips[0].notes.length === 4, null, { timeout: 10000 });
    check("🎲 Again: the last take back, a new one written (another request)", posted.length === 2 && (await ev(() => window.H3SynthTL.tl().layers[0].clips[0].notes.map((x) => x.m).join())) === "60,64,67,70");
    await p.click("#syContBack"); await sleep(150);
    const c3 = await ev(() => { const c = window.H3SynthTL.tl().layers[0].clips[0]; return { n: c.notes.map((x) => x.m).join(), len: c.len, back: document.getElementById("syContBack").disabled }; });
    check("↶ Take back: the clip as it was (its notes, its length)", c3.n === "60,64,67" && c3.len < 4 && c3.back, c3);
    // not installed
    mode = "409";
    await ev(() => { window.__acts = []; window.H3Addons = Object.assign(window.H3Addons || {}, { act: (id, w) => window.__acts.push(id + ":" + w), refresh: async () => {} }); });
    await p.click("#syContGo"); await sleep(500);
    check("not installed (409 needs amt): the add-on's Download box opens, said in the row", (await ev(() => window.__acts.join())) === "amt:install" && /needs its add-on/.test(await ev(() => document.getElementById("syContMsg").textContent)));
    await p.click("#syRollCont"); await sleep(100);
    check("✍ again folds the row away", await ev(() => getComputedStyle(document.getElementById("syRollContBox")).display === "none"));
    await ev(() => window.H3SynthRoll.close());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
