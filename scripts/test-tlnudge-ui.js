#!/usr/bin/env node
/* bitGen Studio — 2.376.0: the timeline's ⚙ settings dialog and the ← / → clip nudge, in a REAL browser.
 * Tim: "please add a settings button to the right of the timeline docker. add nudge settings to a timeline settings
 * dialog, add a titlebar to the docker. nudge by number of frames - when user presses the left or right arrow nudge
 * the timeline clip left or right by the number of frames set in the settings dialog".
 * Run against the running app (H3_URL, default the e2e server on :8311). No Playwright here = SKIP (exit 0).
 *   1. ⚙ sits at the right end of the timeline's menu bar, icon only; the dialog has a titlebar (title + ✕) and the
 *      Nudge fields; Save writes ui.tl_nudge_frames / ui.tl_nudge_shift_frames to the settings;
 *   2. a selected clip on a video layer: → +3 frames, ← -3, Shift+→ +12, never before 0;
 *   3. V1 keeps its clips one after another: a V1 clip cannot pass the clip ahead of it;
 *   4. no selected clip / typing in an input = the arrows do nothing to the clips.
 *   node scripts/test-tlnudge-ui.js */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the timeline nudge browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 400))); }
};
const F = (f) => Math.round(f * 1000) / 1000;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  let saved = null;
  try {
    // 2.376.0: the boot applies the saved layout (/api/ui/layout) and the dockers' states (/api/dockers) ASYNC; under
    // the e2e's load they could land MID-TEST and close / un-maximize the dock under test (the editor test's
    // intermittent "element is not visible" on ⛶ / ✔ Apply / ＋). Wait for both answers before touching anything.
    // 2.381.0: ONE record now (docker_status.json, in the page's head) - wait until the boot has applied it (dsReady)
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 }).catch(() => null);
    await p.waitForTimeout(600);
    await p.waitForFunction(() => typeof window.tlNudgeSelected === "function" && window.TimelineSettings, null, { timeout: 20000 });
    await p.waitForTimeout(2000);
    saved = await p.evaluate(() => JSON.stringify({ ui: cfg.ui || {} }));
    // the dock open (an earlier leg may have collapsed it)
    for (let i = 0; i < 3; i++) {
      if (!/dockgone|collapsed/.test(await p.evaluate(() => document.getElementById("timelinedock").className))) break;
      await p.click('#timelinedock .bhead'); await p.waitForTimeout(300);
    }
    // 1
    const bar = await p.evaluate(() => { const b = [...document.querySelectorAll("#tlbar > button")]; return b.map((x) => x.id); });
    const last = bar[bar.length - 1];
    check("⚙ is the last button of the timeline's menu bar, icon only", last === "tlSettings"
      && await p.evaluate(() => document.getElementById("tlSettings").textContent.trim() === "⚙"), bar.slice(-3));
    await p.click("#tlSettings");
    await p.waitForSelector("#tlsDlg[open]", { timeout: 5000 });
    const ttl = await p.evaluate(() => [document.querySelector("#tlsTitle h2").textContent, !!document.getElementById("tlsClose"),
      document.querySelector("#tlsDlg legend").textContent]);
    check("the dialog: a titlebar (⚙ Timeline settings + ✕) and the Nudge settings", ttl[0] === "⚙ Timeline settings" && ttl[1] && ttl[2] === "Nudge", ttl);
    await p.fill("#tlsNudge", "3"); await p.fill("#tlsNudgeShift", "12");
    check("...each field says its length in seconds", await p.evaluate(() => document.getElementById("tlsNudgeS").textContent) === "= 0.125 s");
    await p.click("#tlsSave");
    await p.waitForFunction(() => !document.getElementById("tlsDlg").open, null, { timeout: 5000 });
    const ui = await (await fetch(URL_ + "api/config")).json().then((j) => j.ui || {});
    check("Save writes the nudge to the settings file (ui.tl_nudge_frames / ui.tl_nudge_shift_frames)", ui.tl_nudge_frames === 3 && ui.tl_nudge_shift_frames === 12, ui);

    // 2: a clip on a video layer
    await p.evaluate(() => {
      tl.vlayers = []; tl.video = [];
      window.tlPlaceScene({ n: 1, name: "nudge_a.mp4", label: "Nudge", start: 2, dur: 3 });
      tl.video = [{ name: "v1_a.mp4", start: 0, dur: 2, in: 0, out: 2 }, { name: "v1_b.mp4", start: 2, dur: 2, in: 0, out: 2 }];
      tlSave(); renderTimeline();
    });
    // select the way a click does (the clip element's own click handler); the narrow test clips may sit outside
    // the scrolled view, which a pointer click would wait on
    const select = (name) => p.evaluate((n) => {
      const el = [...document.querySelectorAll("#tlinner .clip")].find((x) => (x.title || "").startsWith(n));
      if (!el) throw new Error("no clip " + n);
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      document.activeElement && document.activeElement.blur && document.activeElement.blur();
    }, name);
    const startOf = (name) => p.evaluate((n) => { const all = tl.video.concat(...tl.vlayers.map((L) => L.clips)); return (all.find((c) => c.name === n) || {}).start; }, name);
    await select("nudge_a.mp4");
    await p.keyboard.press("ArrowRight");
    check("→ moves the selected clip 3 frames later", F(await startOf("nudge_a.mp4")) === F(2 + 3 / 24), await startOf("nudge_a.mp4"));
    await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
    check("← moves it 3 frames earlier (twice)", F(await startOf("nudge_a.mp4")) === F(2 - 3 / 24), await startOf("nudge_a.mp4"));
    await p.keyboard.press("Shift+ArrowRight");
    check("Shift + → moves it 12 frames", F(await startOf("nudge_a.mp4")) === F(2 + 9 / 24), await startOf("nudge_a.mp4"));
    await p.evaluate(() => { tlSelClip.start = 0.05; tlSave(); renderTimeline(); });
    await p.keyboard.press("ArrowLeft");
    check("never before 0", await startOf("nudge_a.mp4") === 0, await startOf("nudge_a.mp4"));
    check("the readout names the clip and the nudge", /nudge_a\.mp4 @ 0\.000s \(-3f\)/.test(await p.evaluate(() => document.getElementById("tlPh").textContent)));

    // 3: V1
    await select("v1_b.mp4");
    await p.keyboard.press("ArrowRight");
    check("V1: → leaves a gap (3 frames)", F(await startOf("v1_b.mp4")) === F(2 + 3 / 24));
    await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
    check("V1: ← stops at the clip ahead (one after another)", F(await startOf("v1_b.mp4")) === 2, await startOf("v1_b.mp4"));

    // 4
    await p.evaluate(() => { tlSelClip = null; document.querySelectorAll("#tlinner .clip.sel").forEach((x) => x.classList.remove("sel")); });
    const before = await startOf("v1_b.mp4");
    await p.keyboard.press("ArrowRight");
    check("no clip selected: the arrows leave the clips alone", await startOf("v1_b.mp4") === before);
    await select("v1_b.mp4");
    await p.evaluate(() => window.SecFloat && window.SecFloat.show && window.SecFloat.show("basic", true));   // 2.393.0: Basic Settings floats (S)
    // 2.431.0: with the image editor on screen the prompt docker is in Image mode (Basic Settings shows no seed) - Video for this
    await p.evaluate(() => { const s = document.getElementById("genModeSel"); if (s && s.value !== "video") { s.value = "video"; if (s.onchange) s.onchange(); } });
    await p.focus("#seed");
    await p.keyboard.press("ArrowRight");
    check("typing in an input: the arrows are the input's", await startOf("v1_b.mp4") === before);
    await p.evaluate(() => window.SecFloat && window.SecFloat.show && window.SecFloat.show("basic", false));
    check("no page errors", errs.length === 0, errs);
    await p.evaluate(() => { tl.vlayers = []; tl.video = []; tlSelClip = null; tlSave(); renderTimeline(); });
  } catch (e) {
    check("the browser run finished", false, String(e && e.message || e));
  } finally {
    try { if (saved) await fetch(URL_ + "api/config", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ui: { tl_nudge_frames: null, tl_nudge_shift_frames: null } }) }); } catch { /* best effort */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
