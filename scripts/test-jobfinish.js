#!/usr/bin/env node
/* bitGen Studio — 2.308.0: A FINISHED RENDER ALWAYS LEAVES "RUNNING".
 * Run: node scripts/test-jobfinish.js
 *
 * Tim (verbatim): "the queued scene doesn't stop running, and next scene is
 * queued even when the comfyui job is completed".
 *   1. LIVE: a worker that exits while a process it started still holds its
 *      output pipe - the old spawn never reached "close" (the job, the card
 *      and the queue behind it stayed running); the new exit fallback closes
 *      the pipes and the job finishes. The worker also gets NO stdin;
 *   2. the scene poll: a reconcile that throws answers the board (never a
 *      500 every poll); a harvest that throws fails THAT scene in words; a
 *      throw while queueing the next scene fails it instead of stalling;
 *   3. the worker: the lossless frames come down in parallel inside a time
 *      budget (proved LIVE in scripts/test-rawmaster.py), children get no
 *      stdin. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const CO = read("lib", "core.js"), RC = read("routes", "characters.js"), W = read("misc/worker.py");

// a "worker" that starts a long-lived grandchild holding its stdout, then exits
// 2.338.0: the grandchildren are killed by the PID they print - never by a
// name pattern, which also hit the sleeper of a second gate running at once
const SLEEPERS = [];
const pidsOf = (buf) => { for (const m of String(buf).matchAll(/@@PID (\d+)/g)) SLEEPERS.push(+m[1]); };
const WORKER = [
  "import subprocess, sys",
  "p = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'])",
  "print('@@PID %d' % p.pid, flush=True)",
  "print('@@OUT x.mp4', flush=True)",
].join("\n");

function runOld() {
  return new Promise((resolve) => {
    const child = spawn("python3", ["-u", "-c", WORKER]);
    child.stdout.on("data", pidsOf);
    let closed = false;
    child.on("close", () => { closed = true; });
    child.on("exit", () => setTimeout(() => { resolve(closed); child.stdout.destroy(); child.stderr.destroy(); }, 1500));
  });
}
function runNew() {
  // the SAME lines lib/core.js now runs (pinned below)
  return new Promise((resolve) => {
    const t0 = Date.now();
    const job = { finished: 0, log: [] };
    const child = spawn("python3", ["-u", "-c", WORKER], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", pidsOf);
    child.on("close", () => { job.finished = Date.now(); resolve({ ms: job.finished - t0, log: job.log, stdin: child.stdin }); });
    child.on("exit", () => {
      setTimeout(() => {
        if (job.finished) return;
        job.log.push("[bitgen-studio] the worker exited but a process it started still held its output open - finishing the job anyway");
        try { child.stdout.destroy(); } catch {}
        try { child.stderr.destroy(); } catch {}
      }, 1000).unref();
    });
  });
}

(async () => {
  // ---- 1. LIVE ---------------------------------------------------------------------
  const oldClosed = await runOld();
  check("LIVE (the bug): a worker that exits while its child holds the output pipe never reaches 'close' - the job stayed running",
    oldClosed === false, oldClosed);
  const n = await runNew();
  check("LIVE (the fix): the exit fallback closes the pipes - the job finishes within seconds, and says why",
    n.ms < 8000 && /finishing the job anyway/.test(n.log.join("\n")) && n.stdin === null, n);
  for (const pid of SLEEPERS) { try { process.kill(pid); } catch {} }
  check("lib/core.js runs exactly that: no stdin for the worker, the exit fallback after 5 s",
    // 2.519.0: 2.479.0 added an env (BITGEN_NODE) to the same spawn options - still no stdin for the worker
    /\{ cwd: job\.dir, stdio: \["ignore", "pipe", "pipe"\][,\s}]/.test(CO)
    && /child\.on\("exit", \(\) => \{\s*setTimeout\(\(\) => \{\s*if \(job\.finished\) return;[\s\S]{0,300}child\.stdout\.destroy\(\);[\s\S]{0,80}child\.stderr\.destroy\(\);[\s\S]{0,40}\}, 5000\)\.unref\(\);/.test(CO));

  // ---- 2. the scene poll ------------------------------------------------------------
  check("GET /api/scenes: a reconcile that throws still answers the board (logged, sync_error) - never a 500 every poll",
    /app\.get\("\/api\/scenes", \(req, res\) => \{[\s\S]{0,500}try \{ st = syncJobs\(req\.query\.project\); \}\s*catch \(e\) \{[\s\S]{0,200}st = scenes\.load\(req\.query\.project\);/.test(RC));
  check("syncJobs: a harvest that throws fails THAT scene in words (it leaves running either way)",
    RC.includes("st = scenes.failed(st, r.n, `the take could not be filed: "));
  check("syncJobs: a throw while queueing the next scene fails it instead of stalling the queue",
    RC.includes("try { q = queueScene(project, sh.n, { upscale: false }); }")
    && RC.includes("catch (e) { q = { error: String(e && e.message || e).slice(0, 300) }; }"));
  {
    let ok = false;
    try { require(path.join(ROOT, "routes", "characters.js")); ok = true; } catch (e) { ok = String(e.message); }
    check("the scene routes still load with the guards in place", ok === true, ok);
  }

  // ---- 3. the worker ------------------------------------------------------------------
  check("worker: the lossless frames come down in parallel with a per-frame timeout inside a budget, progress said",
    W.includes("MASTER_FETCH_BUDGET = 600") && W.includes("MASTER_FETCH_TIMEOUT = 60")
    && W.includes("ex = cf.ThreadPoolExecutor(max_workers=max(1, workers))")
    && W.includes('say(f"[comfy] lossless master: fetching {len(frames)} frame(s) from ComfyUI...")')
    && W.includes('raise RuntimeError(f"the frame download passed its {budget}s budget")'));
  check("worker: every ffmpeg it runs gets no stdin", W.includes("argv, stdin=subprocess.DEVNULL,"));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
