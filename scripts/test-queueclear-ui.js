#!/usr/bin/env node
/* bitGen Studio — 2.345.1: the Queue dock's 🧹 Clear in a REAL browser.
 * Tim: "add a clear button to the queue docker. this will clear the list of
 * done jobs". Run against the running app (H3_URL, default the e2e server on
 * :8311) - it CLEARS that server's finished-jobs list, so the e2e runs it last.
 * No Playwright here = SKIP (exit 0).
 *   1. 🧹 Clear is on the Pending tab AND the Done tab, labelled with how many
 *      finished items it would clear;
 *   2. a click empties the Done list (server + page), nothing queued/running
 *      touched; the button greys out and the console says what it did.
 *   node scripts/test-queueclear-ui.js */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the queue's browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 400))); }
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => /Done/.test((document.getElementById("qtabDone") || {}).textContent || ""), null, { timeout: 20000 });
    // 2.346.0: THE bug - the tab loop bound every .qtab, so ⏹ / 🧹 were tab
    // switches; ⏹ on Pending must leave the Pending tab on
    await p.click("#qtabPending"); await p.waitForTimeout(400);
    // 2.381.0: the ⏹ / ⏹✕ boxes left the queue's menu bar (Tim: "remove checkboxes in queue menubar")
    check("2.381.0: no ⏹ / ⏹✕ boxes in the queue's menu bar; Pending stays the open tab",
      await p.evaluate(() => !document.getElementById("qStopJob") && !document.getElementById("qStopAll")
        && !document.querySelector("#qdock .qfhead input[type=checkbox]") && document.getElementById("qtabPending").classList.contains("on")));
    const hasHist = await fetch(URL_ + "api/jobs/history").then((r) => r.json()).then((j) => (j.history || []).length).catch(() => 0);
    const hasMem = await fetch(URL_ + "api/jobs").then((r) => r.json()).then((j) => j.filter((x) => !["queued", "running"].includes(x.status)).length).catch(() => 0);
    if (hasHist + hasMem) await p.waitForFunction(() => /\(\d+\)/.test(document.getElementById("qtabDone").textContent), null, { timeout: 20000 });
    const st = () => p.evaluate(() => {
      const c = document.getElementById("qClearDone");
      return { hidden: c.classList.contains("hidden") || c.offsetParent === null, disabled: c.disabled, text: c.textContent,
               done: document.getElementById("qtabDone").textContent, pending: document.getElementById("qtabPending").textContent };
    });
    let s = await st();
    const nDone = +((s.done.match(/\((\d+)\)/) || [])[1] || 0);
    check("🧹 Clear shows on the Pending tab, labelled with the finished count", !s.hidden && s.text.startsWith("🧹 Clear")
      && (nDone ? new RegExp("\\(\\d+\\)").test(s.text) && !s.disabled : s.disabled), s);
    await p.click("#qtabDone"); await p.waitForTimeout(300);
    s = await st();
    check("...and on the Done tab", !s.hidden && s.text.startsWith("🧹 Clear"), s);
    if (!nDone) { console.log("(no finished jobs on this server - the click check is skipped)"); }
    else {
      await p.click("#qClearDone");
      await p.waitForFunction(() => !/\(\d+\)/.test(document.getElementById("qtabDone").textContent), null, { timeout: 10000 });
      s = await st();
      const hist = await (await fetch(URL_ + "api/jobs/history")).json().catch(() => null);
      check("a click empties the Done list: the tab says Done, the button greys out to plain \"🧹 Clear\"",
        s.done === "Done" && s.disabled && s.text === "🧹 Clear", s);
      check("...the page says what it did (no files deleted)", await p.evaluate(() => /\[queue\] 🧹 cleared \d+ finished job\(s\) from the list \(no files deleted\)/.test(document.getElementById("log").textContent)));
      check("...and the server kept only the queued / running ones", !hist || !(hist.list || hist.history || []).some((h) => ["done", "failed", "cancelled"].includes(h.status)), hist);
      const r = await fetch(URL_ + "api/jobs");
      const L = await r.json().catch(() => null);
      check("...and GET /api/jobs still answers (a cleared id left in the job order used to break it)", r.status === 200 && Array.isArray(L)
        && !L.some((j) => !j || ["done", "failed", "cancelled"].includes(j.status)), { status: r.status, L });
    }
  } catch (e) { check("the browser run finished", false, e.message); }
  check("no page errors", !errs.length, errs);
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
