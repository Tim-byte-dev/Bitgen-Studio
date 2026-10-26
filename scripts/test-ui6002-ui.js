#!/usr/bin/env node
/* bitGen Studio — 2.601.0 in a REAL browser, against the running app (H3_URL): Settings ▸ Audio ▸ the voice clone's
 * ▶ PLAY - the selection when there is one, the whole clip when there is none.
 *   A 3 s clip in the waveform: no selection -> ▶ Play plays 0 - 3 s, the button says ■ Stop, a playhead moves, at the
 *   end it is ▶ Play again; dragging 1 - 2 s then ▶ Play plays only that; ■ Stop stops it at once; a click on the
 *   waveform (no drag) clears the selection and says so - ▶ Play is the whole clip again.
 * Tim: "in settings - audio tab , change play selection to play - play the clip if no selection or play the selection
 * if there is a selection". No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.601.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const st = () => ev(() => ({ btn: document.getElementById("s_vcplay").textContent, playing: !!vcPlay, a: vcPlay ? +vcPlay.a.toFixed(2) : null, b: vcPlay ? +vcPlay.b.toFixed(2) : null, sel: vcSel ? [+vcSel.a.toFixed(2), +vcSel.b.toFixed(2)] : null, hint: document.getElementById("s_vcsel").textContent }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY, null, { timeout: 60000 });
    await ev(() => { if (typeof openSettings === "function") openSettings(); else document.getElementById("settings").showModal(); });
    await ev(() => document.querySelector('#settings .stabs [data-stab="audio"]').click());
    const label = await ev(() => document.getElementById("s_vcplay").textContent);
    check("the button says ▶ Play (was ▶ Play selection)", label === "▶ Play", label);
    // a 3 s clip in the waveform, the way vcShow puts a loaded one there
    await ev(async () => {
      const off = new OfflineAudioContext(1, 3 * 22050, 22050);
      const o = off.createOscillator(); o.frequency.value = 330; o.connect(off.destination); o.start();
      vcBuf = await off.startRendering(); vcSel = null;
      document.getElementById("s_vcwavewrap").style.display = "block"; drawWave();
      document.getElementById("s_vcwave").scrollIntoView();
    });
    await ev(() => document.getElementById("s_vcplay").click());
    await p.waitForTimeout(300);
    const s1 = await st();
    check("no selection: ▶ Play plays the WHOLE clip (0 - 3 s) and turns into ■ Stop", s1.playing && s1.a === 0 && s1.b === 3 && s1.btn === "■ Stop", s1);
    const px = await ev(() => { const c = document.getElementById("s_vcwave"), g = c.getContext("2d"); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) n++; return n; });
    check("…a white playhead is drawn on the waveform while it plays", px > 20, px);
    await p.waitForFunction(() => !vcPlay, null, { timeout: 8000 });
    check("…at the end it is ▶ Play again", (await st()).btn === "▶ Play");
    // drag 1 s - 2 s
    const box = await (await p.$("#s_vcwave")).boundingBox();
    await p.mouse.move(box.x + box.width / 3, box.y + 40); await p.mouse.down();
    await p.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 4 }); await p.mouse.move(box.x + box.width * 2 / 3, box.y + 40, { steps: 4 }); await p.mouse.up();
    await ev(() => document.getElementById("s_vcplay").click());
    await p.waitForTimeout(200);
    const s2 = await st();
    check("a selection (1 - 2 s): ▶ Play plays only that", s2.playing && Math.abs(s2.a - 1) < 0.05 && Math.abs(s2.b - 2) < 0.05 && s2.sel, s2);
    await ev(() => document.getElementById("s_vcplay").click());
    const s3 = await st();
    check("■ Stop stops it at once (▶ Play again)", !s3.playing && s3.btn === "▶ Play", s3);
    await p.mouse.click(box.x + box.width * 0.8, box.y + 40);
    await p.waitForTimeout(100);
    const s4 = await st();
    check("a click on the waveform (no drag) clears the selection and says ▶ Play plays the whole clip", s4.sel === null && /no selection - ▶ Play plays the whole clip/.test(s4.hint), s4);
    await ev(() => document.getElementById("s_vcplay").click());
    await p.waitForTimeout(150);
    const s5 = await st();
    check("…▶ Play is the whole clip again", s5.playing && s5.a === 0 && s5.b === 3, s5);
    await ev(() => vcStop());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { await b.close(); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
