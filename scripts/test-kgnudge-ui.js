#!/usr/bin/env node
/* bitGen Studio — 2.433.0 in a REAL browser against the REAL app: the 🎤 Karaoke docker's ◀ ▶ word NUDGES (click /
 * Shift / Ctrl / Shift+Ctrl) and the line under the preview marker lit (ext/timelinedock/kgnudge.js + karaokegen.js).
 * Tim: "in karaoke docker add a nudge left and nudge right button to each word in the timing. if the user ctrl+click the
 * button then nudge all the following words by the same amount, shift+ctrl+click all the words following and the word
 * we are editing will be nudged by the larger nudge setting . shift+click will nudge the single word by the larger
 * nudge - highlight the line of words that the marker is over". The heard words are answered by the test. No
 * Playwright / ffmpeg = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the karaoke nudge browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { console.log("SKIP: no ffmpeg"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_kgnudge_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const HEARD = [["one", 0.5, 0], ["two", 1.2, 0], ["three", 2.0, 1], ["four", 2.8, 1], ["five", 3.6, 1]];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    const pdir = path.join(ROOT, "projects", P);
    fs.mkdirSync(path.join(pdir, "sound"), { recursive: true });
    ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=5", path.join(pdir, "sound", "songn.wav")]);
    await p.route("**/api/karaoke/words**", (route) => {
      if (route.request().method() === "POST") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      const words = HEARD.map(([w, t, ln]) => ({ text: w, line: ln, start: t, end: Math.round((t + 0.4) * 100) / 100 }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, how: "heard", lyrics: false, fixed: false, words, text: "one two\nthree four five" }) });
    });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { localStorage.removeItem("h3.kg.nudge"); localStorage.removeItem("h3.kg.nudgeBig"); } catch (e) { /* fine */ } });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlKaraokeGen && window.KGNudge && window.TlCanvas, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (d.classList.contains("dockgone")) toggleDockGone("timelinedock", "tTL");
      if (d.classList.contains("collapsed")) toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = [mkLayer("A1", [{ name: "songn.wav", start: 1, in: 0, out: 5, dur: 5, volume: 1 }])];
      tl.sel = null; tl.selLayer = "a1"; PXS = 60; tlSave(); renderTimeline(); TlCanvas.go(0);
    });
    await p.waitForTimeout(500);
    await p.click("#tlKaraokeGen");
    await p.waitForFunction(() => TlKaraokeGen.shown(), null, { timeout: 15000 });
    await p.click("#kgTabWords");
    await p.waitForFunction(() => document.querySelectorAll("#kgWords .kg-w").length === 5, null, { timeout: 15000 });
    const W = () => ev(() => TlKaraokeGen.words().map((w) => [w.start, w.end]));
    const inputs = () => ev(() => [...document.querySelectorAll("#kgWords .kg-w")].map((r) => +r.querySelector('input[data-k="start"]').value));

    /* 1 the buttons + the settings */
    const ui = await ev(() => ({ nd: [...document.querySelectorAll("#kgWords .kg-w")].map((r) => [...r.querySelectorAll("[data-nd]")].map((x) => x.textContent).join("")), s: document.getElementById("kgNudge").value, big: document.getElementById("kgNudgeBig").value }));
    check("⏱ every word has ◀ ▶; the nudge 0.05 s and the larger nudge 0.25 s above the list", ui.nd.length === 5 && ui.nd.every((x) => x === "◀▶") && ui.s === "0.05" && ui.big === "0.25", ui);

    /* 2 click / Shift / Ctrl / Shift+Ctrl */
    await p.click('#kgWords [data-i="1"] [data-nd="1"]');
    let w = await W();
    check("▶ click: that word only, by the nudge (two: 1.2 -> 1.25, its end with it)", w[1][0] === 1.25 && w[1][1] === 1.65 && w[0][0] === 0.5 && w[2][0] === 2, w);
    await p.click('#kgWords [data-i="1"] [data-nd="1"]', { modifiers: ["Shift"] });
    w = await W();
    check("▶ Shift+click: that word only, by the larger nudge (1.25 -> 1.5)", w[1][0] === 1.5 && w[2][0] === 2 && w[0][0] === 0.5, w);
    await p.click('#kgWords [data-i="2"] [data-nd="-1"]', { modifiers: ["Control"] });
    w = await W();
    check("◀ Ctrl+click: that word AND every word after it by the nudge (three / four / five -0.05), the ones before stay", w[2][0] === 1.95 && w[3][0] === 2.75 && w[4][0] === 3.55 && w[1][0] === 1.5 && w[0][0] === 0.5, w);
    await p.click('#kgWords [data-i="3"] [data-nd="1"]', { modifiers: ["Shift", "Control"] });
    w = await W();
    check("▶ Shift+Ctrl+click: that word and the words after it by the larger nudge (four / five +0.25)", w[3][0] === 3 && w[4][0] === 3.8 && w[2][0] === 1.95, w);
    const inp = await inputs();
    check("...the start boxes (and the time buttons) follow", inp.join() === w.map((x) => x[0]).join() && await ev(() => document.querySelector('#kgWords [data-i="4"] .t').textContent) === "0:03.80", inp);

    /* 3 the settings change the amounts and are kept; never before 0 */
    await p.fill("#kgNudge", "0.1"); await p.dispatchEvent("#kgNudge", "change");
    await p.click('#kgWords [data-i="0"] [data-nd="-1"]');
    w = await W();
    check("the nudge set to 0.1 s: ◀ moves one 0.1 s (0.5 -> 0.4), kept for next time", w[0][0] === 0.4 && await ev(() => localStorage.getItem("h3.kg.nudge")) === "0.1", w);
    await p.fill("#kgNudgeBig", "2"); await p.dispatchEvent("#kgNudgeBig", "change");
    await p.click('#kgWords [data-i="0"] [data-nd="-1"]', { modifiers: ["Shift", "Control"] });
    w = await W();
    check("...a move past 0 s is cut short for every word it moves (their spacing kept): one at 0, two 1.1", w[0][0] === 0 && w[1][0] === 1.1 && w[4][0] === 3.4, w);
    const msg = await ev(() => document.getElementById("kgNote").textContent);
    check("...the note says what moved", /5 words moved -0\.40 s/.test(msg), msg);

    /* 4 the line under the marker */
    await ev(() => TlCanvas.go(1 + 2.5)); await p.waitForTimeout(300);
    const l1 = await ev(() => [...document.querySelectorAll("#kgWords .kg-w.nowln")].map((r) => r.dataset.i).join());
    await ev(() => TlCanvas.go(1 + 0.5)); await p.waitForTimeout(300);
    const l0 = await ev(() => [...document.querySelectorAll("#kgWords .kg-w.nowln")].map((r) => r.dataset.i).join());
    check("the line under the marker is lit, all its words (2.5 s = the second line: three / four / five; 0.5 s = the first: one / two)", l1 === "2,3,4" && l0 === "0,1", [l1, l0]);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the browser run finished\n      got " + JSON.stringify(String(e && e.stack || e)).slice(0, 900));
  } finally {
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
