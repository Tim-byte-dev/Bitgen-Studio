#!/usr/bin/env node
/* bitGen Studio — 2.774.0 browser test: A RENDER THAT FAILED ON ITS POD SAYS IT GOES AGAIN (static/index.html job rows,
 * lib/podRetry.js via jobDict pod_held / retried_as) on a running studio (H3_URL, default :8311). The job list comes from
 * the page's own stand-in (page.route) - no pod is asked.
 * Tim (verbatim): "after the pod is setup for the style start the generation that initiated the create pod or select pod
 * dialog" + "yes, please do that"
 * No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.774.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.774.0 browser test did not run"); process.exit(0); }
  const real = await fetch(URL0 + "api/jobs").then((r) => r.json()).catch(() => null);
  check("GET /api/jobs answers a list (each job has pod_held / retried_as - lib/core.js jobDict)", Array.isArray(real) && real.every((j) => "pod_held" in j && "retried_as" in j), real && real.slice(0, 1));
  const P = { mode: "image", width: 1024, height: 1024, prompt: "a fox in the snow" };
  const JOBS = [{ id: "held774", status: "failed", params: P, pod_held: true, retried_as: null },
    { id: "went774", status: "failed", params: P, pod_held: false, retried_as: "new774" },
    { id: "plain774", status: "failed", params: P, pod_held: false, retried_as: null }];
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.route("**/api/jobs", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(JOBS) }));
    await p.route("**/api/jobs/history", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ history: [] }) }));
    await p.goto(URL0);
    await p.waitForFunction(() => typeof refreshJobs === "function" && document.querySelector('.qtab[data-qtab="done"]'), null, { timeout: 30000 });
    await p.evaluate(() => document.querySelector('.qtab[data-qtab="done"]').click());
    await p.waitForFunction(() => document.querySelector('#jobs .job[data-id="held774"]'), null, { timeout: 15000 });
    await sleep(300);
    const rows = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll("#jobs .job")].map((e) => { const s = e.querySelector(".st"); return [e.dataset.id, { t: s.textContent, title: s.title, cls: s.className }]; })));
    check("a failed pod render that is held says it goes again when its pod is ready (its tooltip: clear it to stop that)",
      rows.held774 && rows.held774.t === "failed · goes again when its pod is ready" && /clear it to stop that/.test(rows.held774.title) && /failed/.test(rows.held774.cls), rows.held774);
    check("…one that went again says so, naming the new job", rows.went774 && rows.went774.t === "failed · went again" && /new774/.test(rows.went774.title), rows.went774);
    check("…a plain failure still says failed", rows.plain774 && rows.plain774.t === "failed", rows.plain774);
    await p.evaluate(() => document.querySelector('.qtab[data-qtab="pending"]').click());
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
