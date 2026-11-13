#!/usr/bin/env node
/* bitGen Studio — 2.778.0 browser test: "A FILE DID NOT GET ONTO THE POD - TRY AGAIN?" (static/podfails.js, lib/podFails.js) on a
 * running studio (H3_URL, default :8311; H3_E2E=1 for POST /api/pods/fails-e2e): a failure opens one box per pod with each file,
 * how it failed and why; Not now = not asked again; a new failure asks again; ↻ Try again starts the retry and closes the box.
 * Tim (verbatim): "if a file fails to upload to the pod ask the user if they want to try again"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.778.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (u, b) => (await fetch(URL0 + u, b === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json();

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.778.0 browser test did not run"); process.exit(0); }
  const probe = await fetch(URL0 + "api/pods/fails-e2e", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (probe.status === 404) { console.log("SKIP: the studio was not started with H3_E2E=1 - the 2.778.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 950 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.addInitScript(() => { window.H3_PODFAILS_MS = 500; });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3PodFails, null, { timeout: 60000 });
    await sleep(1500);
    check("no box while nothing failed", !(await p.$("#podFailDlg")));
    await api("api/pods/fails-e2e", { pod: "podA1", styles: [], fails: [
      { name: "Krea2/krea2_nsfw-aio-2.safetensors", how: "download", why: "Civitai refused it - add your Civitai API key (HTTP 401)" },
      { name: "mylora.safetensors", how: "upload", why: "sending mylora.safetensors to the pod: HTTP 413" }] });
    await p.waitForSelector("#podFailDlg[open]", { timeout: 10000 });
    const a = await p.evaluate(() => { const d = document.getElementById("podFailDlg"); return { h: d.querySelector("h2").textContent, note: d.querySelector(".pfnote").textContent,
      names: [...d.querySelectorAll(".pfname")].map((x) => x.textContent), how: [...d.querySelectorAll(".pfhow")].map((x) => x.textContent), why: [...d.querySelectorAll(".pfwhy")].map((x) => x.textContent),
      btns: [...d.querySelectorAll(".rowbtns button")].map((x) => x.textContent), focus: document.activeElement && document.activeElement.id }; });
    check("a failure opens the box: '2 files did not get onto the pod', the pod named, Try again?", a.h === "2 files did not get onto the pod" && /Pod podA1/.test(a.note) && /Try again\?/.test(a.note), a);
    check("…each file with how it failed and why", a.names.join() === "krea2_nsfw-aio-2.safetensors,mylora.safetensors" && /could not download/.test(a.how[0]) && /from this computer failed/.test(a.how[1]) && /Civitai API key/.test(a.why[0]) && /413/.test(a.why[1]), a);
    check("…buttons Not now / ↻ Try again (focused)", a.btns.join("|") === "Not now|↻ Try again" && a.focus === "pfRetry", a);
    await p.click("#pfNotNow"); await sleep(1500);
    const f1 = (await api("api/pods/fails")).fails;
    check("Not now: the box closes and is not asked again", !(await p.$("#podFailDlg")) && f1.length === 2 && f1.every((f) => f.asked), f1);
    await api("api/pods/fails-e2e", { pod: "podA1", styles: [], fails: [{ name: "mylora.safetensors", how: "upload", why: "HTTP 502 again" }] });
    await p.waitForSelector("#podFailDlg[open]", { timeout: 10000 });
    const one = await p.evaluate(() => document.querySelector("#podFailDlg h2").textContent);
    check("a failure again is asked again ('A file did not get onto the pod')", one === "A file did not get onto the pod", one);
    await p.click("#pfRetry"); await sleep(1200);
    const f2 = (await api("api/pods/fails")).fails;
    check("↻ Try again: the retry starts (the file tried once more), the box closes and does not ask again meanwhile", !(await p.$("#podFailDlg")) && f2.length && f2.every((f) => f.asked && f.tries === 1), f2);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
