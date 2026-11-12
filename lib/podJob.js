/* bitGen Studio — lib/podJob.js (2.764.6): A POD JOB THAT OUTLIVES ITS JUPYTER KERNEL, and telling when one stopped.
 *
 * Tim (verbatim): "if the model is gated, i am guessing krea2 is gated, downloading for 5 minutes so far and still 0%, check
 * to see if it is gated and report to the user"
 *   Krea-2 (Comfy-Org/Krea-2) is not gated. The 0% came from 2.763.4: every kernel bitGen opens is shut down once it has
 *   answered (lib/podModels.js runKernel), and the downloads / node installs ran as a thread INSIDE that kernel - shutting it
 *   down ended them, and their status file stayed at "downloading 0%" / "installing".
 *
 *   detach(code)   the job's Python (lib/podModels.js dlCode, lib/podNodes.js mirrorCode, lib/podPrep.js nodeCode) is
 *                  written to <cwd>/.bitgen_job_<status>.py and started as its OWN process (a new session - not stopped
 *                  with the kernel); its output goes to .bitgen_job_<status>.log. The kernel waits (20 s at most) for the
 *                  job's first status write, then prints the job's marker - or "bitgen-job-failed <the log's end>".
 *                  The job saves a heartbeat (S['beat'] + 1 every 15 s) while it runs.
 *   track(mem, s)  bitGen's side, each time it reads a job's status: no heartbeat change for 90 s while it says running =
 *                  the job is gone (the pod restarted, ran out of memory …) - every file / pack not finished is marked
 *                  failed with that reason and running = false; a download whose bytes have not moved for 3 minutes gets
 *                  stalled + a note.
 *   failed(said)   the kernel's answer -> "" | the reason the job did not start
 * Pure. Node: scripts/test-podjob7646.js (runs the detached Python for real with python3)
 */
"use strict";
const DEAD = () => +(process.env.H3_POD_JOB_DEAD || 90000);
const STALL = () => +(process.env.H3_POD_DL_STALL || 180000);
const BEAT = () => +(process.env.H3_POD_JOB_BEAT || 15);
const THREAD = "save(); threading.Thread(target=run, daemon=True).start()";

/** the status file a job writes ('.bitgen_dl.json' …) (pure) */
function statusName(code) { const m = /P = os\.path\.join\(os\.getcwd\(\), '(\.bitgen_\w+\.json)'\)/.exec(String(code || "")); return m ? m[1] : ""; }
/** the job's marker ('bitgen-started' …) (pure) */
function markerOf(code) { const m = /print\('(bitgen-(?:[\w-]+-)?started)'\)\s*$/.exec(String(code || "")); return m ? m[1] : ""; }
/** the job as its own program: run() in the main thread, a heartbeat thread, save() under a lock (pure) */
function jobProgram(code) {
  const c = String(code || "").replace(/\nprint\('bitgen-(?:[\w-]+-)?started'\)\s*$/, "");
  return c.replace(THREAD, [
    "import threading as _th, time as _tm",
    "_L = _th.Lock(); _save0 = save",
    "def save():",
    "    with _L: _save0()",
    "def _beat():",
    "    while S.get('running'):",
    `        _tm.sleep(${BEAT()}); S['beat'] = S.get('beat', 0) + 1; save()`,
    "S['beat'] = 0; save(); _th.Thread(target=_beat, daemon=True).start()",
    "try:",
    "    run()",
    "finally:",
    "    S['running'] = False; save()",
  ].join("\n"));
}
/** the kernel's code that starts the job as its own process (pure) */
function detach(code) {
  const st = statusName(code), mk = markerOf(code);
  if (!st || !mk || !String(code).includes(THREAD)) throw new Error("podJob.detach: not a bitGen pod job");
  const stem = ".bitgen_job_" + st.replace(/^\.bitgen_/, "").replace(/\.json$/, "");
  return [
    "import os, sys, subprocess, time",
    "d = os.getcwd()",
    `p = os.path.join(d, ${JSON.stringify(stem + ".py")}); lg = os.path.join(d, ${JSON.stringify(stem + ".log")}); st = os.path.join(d, ${JSON.stringify(st)})`,
    `open(p, 'w', encoding='utf-8').write(${JSON.stringify(jobProgram(code))})`,
    "if os.path.exists(st): os.remove(st)",
    "pr = subprocess.Popen([sys.executable, '-u', p], cwd=d, stdin=subprocess.DEVNULL, stdout=open(lg, 'wb'), stderr=subprocess.STDOUT, start_new_session=True)",
    "t0 = time.time()",
    "while time.time() - t0 < 20 and not os.path.exists(st) and pr.poll() is None: time.sleep(0.2)",
    "if os.path.exists(st): print(" + JSON.stringify(mk) + ")",
    "else:",
    "    time.sleep(0.5)",
    "    print('bitgen-job-failed ' + (open(lg, errors='ignore').read()[-300:] if os.path.exists(lg) else 'it did not start').replace('\\n', ' ').strip())",
  ].join("\n");
}
/** the kernel's answer -> "" | why the job did not start (pure) */
function failed(said) { const m = /bitgen-job-failed ([\s\S]*)$/.exec(String(said || "")); return m ? (m[1].trim() || "it did not start") : ""; }
/** bitGen's side of a job's status (pure apart from `now`): mem keeps what was seen last -> s with dead / stalled marked */
function track(mem, s, now) {
  const t = now === undefined ? Date.now() : +now;
  if (!s || typeof s !== "object") return s;
  const items = s.files || s.packs || [];
  if (s.running) {
    if (mem.beatAt === undefined || s.beat !== mem.beat) { mem.beat = s.beat; mem.beatAt = t; }
    if (t - mem.beatAt >= DEAD()) {
      const why = `the pod stopped this job (no sign of it for ${Math.round(DEAD() / 1000)} s - the pod may have restarted or run out of memory) - try again`;
      s.running = false; s.dead = why;
      items.forEach((f) => { if (/^(waiting|downloading|installing)$/.test(String(f.state))) f.state = "failed: " + why; });
      return s;
    }
  } else { mem.beatAt = undefined; }
  mem.done = mem.done || {};
  for (const f of s.files || []) {
    if (f.state !== "downloading") { delete mem.done[f.name]; continue; }
    const m = mem.done[f.name];
    if (!m || m.done !== f.done) { mem.done[f.name] = { done: f.done, at: t }; continue; }
    if (t - m.at >= STALL()) { f.stalled = true; f.note = `no data for ${Math.round((t - m.at) / 60000)} min - the download server is not sending it`; }
  }
  return s;
}
module.exports = { THREAD, statusName, markerOf, jobProgram, detach, failed, track };
