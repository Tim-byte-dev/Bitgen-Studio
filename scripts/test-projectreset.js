#!/usr/bin/env node
/* bitGen Studio — 2.378.0: ↺ Reset project makes a NEW project, whatever was running or open.
 * Run: node scripts/test-projectreset.js
 * Tim: "the reset project button doesn't work, it should delete the project folder and recreate it new, clean. all the
 * dockers should be cleared of everything including whats in the cache - it should be a new project".
 *   1. lib/projectReset.stopJobs: a queued job cancelled and out of the queue, a RUNNING one's process killed and
 *      waited for; both marked discarded - lib/core.recordJob never writes them into the new folder;
 *   2. forgetJobs: every job of the project out of memory and the job order, its workspace/jobs/<id> folder deleted;
 *      another project's jobs untouched;
 *   3. removeTree: the folder moved aside and deleted; when it cannot be moved, everything deletable is deleted and the
 *      files still in use are listed + remembered; sweep deletes them on the next start (unless written again);
 *   4. POST /api/projects/reset end to end: a running job stopped, the queue's Done list empty, the folder new;
 *   5. the page: the name from the server, the busy jobs in the verify box, the media let go before the reset, the
 *      reopened page reports what the reset did and any file still in use. */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const R = require(path.join(ROOT, "lib", "projectReset"));
const projects = require(path.join(ROOT, "lib", "projects"));

function req(port, method, u, body) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: data ? { "Content-Type": "application/json", "Content-Length": data.length } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; });
      res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = { raw: b.slice(0, 80) }; } ok({ status: res.statusCode, j }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}
const sleeper = () => spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
function fakeRunning(id, project) {
  const child = sleeper();
  const job = { id, status: "running", project, child, dir: path.join(core.JOBS_DIR, id) };
  child.on("close", () => { job.child = null; });
  return job;
}

(async () => {
  const orig = core.getProject();
  const P = "zz_reset378_" + process.pid;
  const pdir = core.projDir(P);
  const touched = [];
  try {
    // 1
    const q = { id: "q1", status: "queued", project: P };
    const run = fakeRunning("r1", P);
    const theirs = { id: "o1", status: "queued", project: "someone-else" };
    const jobs = new Map([["q1", q], ["r1", run], ["o1", theirs]]);
    const queue = [q, theirs];
    const t0 = Date.now();
    const st = await R.stopJobs(P, { jobs, queue });
    check("stopJobs: the queued job cancelled and out of the queue, the running one's process killed and waited for",
      st.stopped === 2 && q.status === "cancelled" && run.status === "cancelled" && run.child === null
      && queue.length === 1 && queue[0] === theirs && theirs.status === "queued" && Date.now() - t0 < 8000, { st, queue: queue.map((j) => j.id) });
    check("...both marked discarded", q.discarded === true && run.discarded === true && !theirs.discarded);
    core.ensureProject(P);
    core.recordJob(Object.assign({}, q, { project: P }));
    check("lib/core.recordJob: a discarded job never writes jobs.info", !fs.existsSync(path.join(pdir, "jobs.info")));

    // 2
    const jdir = path.join(core.JOBS_DIR, "zzjob" + process.pid);
    fs.mkdirSync(jdir, { recursive: true }); fs.writeFileSync(path.join(jdir, "job.json"), "{}");
    const done = { id: "d1", status: "done", project: P, dir: jdir };
    const jobs2 = new Map([["d1", done], ["o1", theirs]]);
    const order = ["d1", "o1"];
    const fj = R.forgetJobs(P, { jobs: jobs2, order });
    check("forgetJobs: the project's jobs out of memory and the order, their working folder deleted; another project's kept",
      fj.forgotten === 1 && fj.folders === 1 && !jobs2.has("d1") && jobs2.has("o1") && order.join() === "o1" && !fs.existsSync(jdir), fj);

    // 3
    const put = (rel, txt) => { const f = path.join(pdir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt || rel); return f; };
    put("output/a.mp4"); put("chat/c.chat"); put(".cache/waveform/x.json");
    let rm = R.removeTree(pdir);
    const trashLeft = () => { try { return fs.readdirSync(R.TRASH()).filter((n) => n.startsWith(path.basename(pdir) + "-")); } catch { return []; } };
    check("removeTree: the folder moved aside and deleted (the trash holds nothing of it)", rm.moved === true && rm.leftover.length === 0
      && !fs.existsSync(pdir) && trashLeft().length === 0, { rm, t: trashLeft() });

    put("output/b.mp4"); const busy = put("video/busy.mp4"); put("images/p.png");
    const realRename = fs.renameSync, realRm = fs.rmSync;
    fs.renameSync = () => { const e = new Error("EPERM: in use"); e.code = "EPERM"; throw e; };
    fs.rmSync = function (p, o) { if (path.resolve(p) === path.resolve(busy)) { const e = new Error("EBUSY"); e.code = "EBUSY"; throw e; } return realRm.call(fs, p, o); };
    try { rm = R.removeTree(pdir); } finally { fs.renameSync = realRename; fs.rmSync = realRm; }
    const pend = JSON.parse(fs.readFileSync(R.PENDING(), "utf8"));
    check("...cannot be moved (Windows: a file open): every other file deleted, the one in use listed and remembered",
      rm.moved === false && rm.leftover.join() === "video/busy.mp4" && fs.existsSync(busy)
      && !fs.existsSync(path.join(pdir, "output", "b.mp4")) && !fs.existsSync(path.join(pdir, "images"))
      && pend.some((e) => e.path === busy), { rm, pend });
    const again = put("video/again.mp4");
    fs.writeFileSync(R.PENDING(), JSON.stringify(pend.concat([{ path: again, mtimeMs: 1, at: "x" }])));
    fs.mkdirSync(path.join(R.TRASH(), "zz-old-" + process.pid, "sub"), { recursive: true });
    const sw = R.sweep();
    check("sweep (the next start): the remembered file deleted, a file written again since kept, the trash emptied",
      !fs.existsSync(busy) && fs.existsSync(again) && sw.files >= 1 && !fs.existsSync(path.join(R.TRASH(), "zz-old-" + process.pid))
      && !fs.existsSync(R.PENDING()), sw);
    check("routes/recycleBin mounts the sweep once at start", /require\("\.\.\/lib\/projectReset"\)\.sweepOnce\(\)/.test(read("routes", "recycleBin.js")));

    // 4
    fs.rmSync(pdir, { recursive: true, force: true });
    core.ensureProject(P); core.setProject(P);
    fs.writeFileSync(core.prjPath(P), JSON.stringify({ description: "Rain", created: "2026-02-03T00:00:00Z", prompt: "old" }));
    put("output/old.mp4"); put("songs/s.music");
    const express = require("express");
    const app = express(); app.use(express.json());
    require(path.join(ROOT, "routes", "index.js")).mount(app);
    const srv = app.listen(0, "127.0.0.1");
    await new Promise((ok) => srv.once("listening", ok));
    const port = srv.address().port;
    const live = fakeRunning("zzlive" + process.pid, P);
    const fin = { id: "zzfin" + process.pid, status: "done", project: P, dir: path.join(core.JOBS_DIR, "zzfin" + process.pid), log: [], params: {} };
    for (const j of [live, fin]) { j.log = []; j.params = {}; core.jobs.set(j.id, j); core.order.push(j.id); touched.push(j.id); }
    let g = await req(port, "GET", "/api/jobs");
    const before = g.j.filter((j) => j.project === P).length;
    const x = await req(port, "POST", "/api/projects/reset", { name: P });
    g = await req(port, "GET", "/api/jobs");
    const prj = JSON.parse(fs.readFileSync(core.prjPath(P), "utf8"));
    check("POST /api/projects/reset with a job RUNNING: it is stopped (no refusal), the folder new, the description kept",
      x.status === 200 && x.j.stopped === 1 && live.child === null && live.status === "cancelled"
      && prj.description === "Rain" && prj.prompt === undefined && !fs.existsSync(path.join(pdir, "output", "old.mp4"))
      && !fs.existsSync(path.join(pdir, "songs", "s.music")) && fs.existsSync(path.join(pdir, "output")), x.j);
    check("...the queue's Done list of the project is empty afterwards (it was not before)", before === 2
      && g.j.filter((j) => j.project === P).length === 0 && x.j.jobs_cleared === 2 && !core.order.includes(fin.id), { before, after: g.j.length });
    check("...the stopped job's end never writes into the new folder", (await new Promise((ok) => setTimeout(ok, 300)), !fs.existsSync(path.join(pdir, "jobs.info"))));
    srv.close();
  } finally {
    for (const id of touched) { core.jobs.delete(id); const i = core.order.indexOf(id); if (i >= 0) core.order.splice(i, 1); }
    try { core.setProject(orig); } catch { /* restored */ }
    fs.rmSync(pdir, { recursive: true, force: true });
  }

  // 5
  const JS = read("static", "recyclebin.js"), H = read("static", "index.html");
  check("the page: the project name from the server (never a stale label)", /fetch\("\/api\/projects"\)[\s\S]{0,200}pj\.current/.test(JS));
  check("...the verify box says the busy jobs are stopped and the queue / cache cleared",
    /still queued or running - /.test(JS) && /The queue's finished jobs of this project and their cached files are cleared too/.test(JS));
  check("...every video / sound let go before the reset (an open file cannot be deleted on Windows)",
    /function releaseMedia\(\)[\s\S]{0,400}removeAttribute\("src"\)[\s\S]{0,200}m\.load\(\)/.test(JS) && /resetBusy\(true\);\s*releaseMedia\(\);\s*return post\("\/api\/projects\/reset"/.test(JS));
  check("...the reopened page reports the stopped / cleared jobs and shows the files still in use",
    /sessionStorage\.setItem\("h3\.resetInfo"/.test(JS) && /sessionStorage\.getItem\("h3\.resetInfo"\)/.test(H)
    && /still open in another program and could not be deleted yet/.test(H));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
