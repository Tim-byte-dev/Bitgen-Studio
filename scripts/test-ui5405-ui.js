#!/usr/bin/env node
/* bitGen Studio — 2.540.5 in a REAL browser: Settings ▸ General ▸ ⟳ Updates.
 * The section (this version, git clone / zip, the repo); 🔍 Check for updates -> GitHub's answer (here answered in
 * the page: 2.999.0, 2 commits) -> ⤓ Update now asks, the job's log streams in, ✓ Updated … restart; ⟳ Restart now in
 * the desktop app (h3shell.relaunch) - in a browser it says to start start.bat again. The update itself is answered
 * in the page too (the real one is scripts/test-updater5405.js). Against the running app (H3_URL, default :8311). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.540.5 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.setDefaultTimeout(30000);
  const ev = (f, a) => p.evaluate(f, a);
  const dialogs = []; p.on("dialog", (d) => { dialogs.push(d.message()); d.accept(); });
  let started = 0, polls = 0;
  await p.route("**/api/update/check", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ current: "2.540.5", latest: "2.999.0", newer: true, behind: 2, ahead: 0, commits: ["abc1234 2.999.0 - something new", "def5678 2.998.0 - a fix"], mode: "git", repo: "Tim-byte-dev/bitgen-studio", branch: "main", error: "" }) }));
  await p.route("**/api/update/start", (r) => { started++; r.fulfill({ contentType: "application/json", body: '{"ok":true}' }); });
  await p.route("**/api/update/job*", (r) => {
    if (!started) return r.fulfill({ contentType: "application/json", body: '{"job":null,"lines":[],"next":0}' });
    polls++;
    const done = polls > 1;
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ job: { state: done ? "done" : "running", from: "2.540.5", to: done ? "2.999.0" : "", mode: "git", restart: done, error: "" },
      lines: done ? ["[ok] moved", "[done] updated 2.540.5 -> 2.999.0 - restart bitGen Studio to finish"] : ["[..] fetching"], next: done ? 3 : 1 }) });
  });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Updater && document.getElementById("upSec"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("settings"); if (!d.open) d.showModal(); document.querySelector('#settings [data-stab="general"]').click(); });
    await p.waitForFunction(() => /bitGen Studio \d/.test(document.getElementById("upInfo").textContent), null, { timeout: 45000 }).catch(async (e) => { console.log("upInfo:", await ev(() => document.getElementById("upInfo").outerHTML)); throw e; });
    const info = await ev(() => document.getElementById("upInfo").textContent);
    check("Settings ▸ General ▸ ⟳ Updates: this version, how it was installed, the GitHub repo; ⤓ Update now off until a check finds one",
      /bitGen Studio 2\.\d+\.\d+/.test(info) && /(git clone|installed from a zip) of Tim-byte-dev\/bitgen-studio \(main\)/.test(info) && await ev(() => document.getElementById("upGo").disabled), info);
    await p.click("#upCheck");
    await p.waitForFunction(() => /2\.999\.0/.test(document.getElementById("upMsg").textContent));
    const chk = await ev(() => ({ msg: document.getElementById("upMsg").textContent, commits: [...document.querySelectorAll("#upCommits li")].map((x) => x.textContent), go: document.getElementById("upGo").disabled }));
    check("🔍 Check for updates: the newer version, the new commits listed, ⤓ Update now on", /2\.999\.0 is on GitHub/.test(chk.msg) && /2 new commit/.test(chk.msg) && chk.commits.length === 2 && !chk.go, chk);
    await p.click("#upGo");
    await p.waitForFunction(() => /Updated/.test((document.getElementById("upHead") || {}).textContent || ""), null, { timeout: 15000 });
    const done = await ev(() => ({ head: document.getElementById("upHead").textContent, log: document.getElementById("upLog").textContent, rb: { hidden: document.getElementById("upRestart").hidden, dis: document.getElementById("upRestart").disabled, txt: document.getElementById("upRestart").textContent } }));
    check("⤓ Update now asks first (projects / settings / models untouched), then the log streams in and it ends ✓ Updated 2.540.5 → 2.999.0",
      dialogs.some((m) => /Update bitGen Studio 2\.540\.5 to 2\.999\.0/.test(m) && /not touched/.test(m)) && started === 1 && /✓ Updated 2\.540\.5 → 2\.999\.0/.test(done.head) && /\[done\] updated/.test(done.log), { dialogs, done });
    check("…⟳ Restart: in a browser it says to start start.bat again (the desktop app relaunches itself)", !done.rb.hidden && done.rb.dis && /start\.bat/.test(done.rb.txt), done.rb);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
