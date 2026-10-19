// bitGen Studio — lib/projectReset.js (2.378.0): everything ↺ Reset project does besides writing the new .prj.
//
// Tim: "the reset project button doesn't work, it should delete the project folder and recreate it new, clean. all
// the dockers should be cleared of everything including whats in the cache - it should be a new project".
//
// Why 2.374.0's reset could leave a project behind:
//   * a file still open (Windows: a worker, ffmpeg, ComfyUI, Explorer's preview, the page's own <video>) made
//     fs.rmSync stop at the first file it could not delete - most of the folder survived, and the one line that said
//     so went to the log of a page that was reloading;
//   * a queued / running job of the project refused the whole reset;
//   * the queue's Done list lives in memory per project NAME - a reset project (same name) showed every old job.
// Now:
//   stopJobs   - the project's queued jobs are cancelled, a running one is stopped (its process tree killed) and waited
//                for; every one is marked `discarded` so lib/core.recordJob never writes it into the new folder;
//   forgetJobs - all of the project's jobs leave memory (the Done list) and their working folders
//                (workspace/jobs/<id>: copies of inputs, previews, logs) are deleted;
//   removeTree - the folder is first MOVED out of the way (workspace/reset-trash/<name>-<time>), so the project is new
//                at once even when something inside is in use, and the moved copy is deleted; if it cannot even be
//                moved, every file that CAN be deleted is (several passes), and the ones still in use are listed -
//                the page shows them - and remembered in workspace/reset-trash/pending.json;
//   sweep      - on the next start (this module loads with the routes) the trash and the remembered files are
//                deleted, once nothing holds them.
const fs = require("fs");
const path = require("path");
const core = require("./core");

const TRASH = () => path.join(core.WORKSPACE, "reset-trash");
const PENDING = () => path.join(TRASH(), "pending.json");

function sleepSync(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* no wait */ } }
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

function projectJobs(cur, jobs) {
  return [...(jobs || core.jobs).values()].filter((j) => j && (j.project || cur) === cur);
}

/** Cancel the project's queued jobs, stop a running one and wait (up to waitMs) for its process to go. */
async function stopJobs(cur, o) {
  const opt = o || {};
  const jobs = opt.jobs || core.jobs;
  const queue = opt.queue || core.queue;
  const kill = opt.killTree || core.killTree;
  const busy = projectJobs(cur, jobs).filter((j) => j.status === "queued" || j.status === "running");
  for (const j of busy) {
    j.discarded = true;
    j.status = "cancelled";
    const qi = queue.indexOf(j);
    if (qi >= 0) queue.splice(qi, 1);
    if (j.child) { try { kill(j); } catch { /* gone already */ } }
  }
  const until = Date.now() + (opt.waitMs == null ? 8000 : opt.waitMs);
  while (busy.some((j) => j.child) && Date.now() < until) await sleep(100);
  return { stopped: busy.length, still_running: busy.filter((j) => j.child).map((j) => j.id) };
}

/** Every job of the project out of memory (the queue's Done list) and its working folder deleted. */
function forgetJobs(cur, o) {
  const opt = o || {};
  const jobs = opt.jobs || core.jobs;
  const order = opt.order || core.order;
  const mine = projectJobs(cur, jobs);
  const jobsDir = path.resolve(opt.jobsDir || core.JOBS_DIR);
  let folders = 0;
  for (const j of mine) {
    j.discarded = true;
    jobs.delete(j.id);
    if (j.dir && path.dirname(path.resolve(j.dir)) === jobsDir) {
      try { fs.rmSync(j.dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); folders++; }
      catch { /* still in use - its folder is only a cache */ }
    }
  }
  for (let i = order.length - 1; i >= 0; i--) if (!jobs.has(order[i])) order.splice(i, 1);
  return { forgotten: mine.length, folders };
}

/** Every file under dir (deepest first), then the folders. */
function walk(dir) {
  const files = [], dirs = [];
  const go = (d) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory() && !e.isSymbolicLink()) { go(p); dirs.push(p); } else files.push(p);
    }
  };
  go(dir);
  return { files, dirs };
}

/** Delete what can be deleted, file by file, in a few passes; the files still there afterwards. */
function deleteEach(dir, passes) {
  let left = [];
  for (let pass = 0; pass < (passes || 4); pass++) {
    const w = walk(dir);
    left = [];
    for (const f of w.files) {
      try { fs.rmSync(f, { force: true }); }
      catch { try { fs.chmodSync(f, 0o666); fs.rmSync(f, { force: true }); } catch { left.push(f); } }
    }
    for (const d of w.dirs) { try { fs.rmdirSync(d); } catch { /* not empty - a file in it is still in use */ } }
    try { fs.rmdirSync(dir); } catch { /* idem */ }
    left = left.filter((f) => fs.existsSync(f));
    if (!left.length) break;
    sleepSync(300);
  }
  return left;
}

function readPending() { try { return JSON.parse(fs.readFileSync(PENDING(), "utf8")) || []; } catch { return []; } }
function writePending(list) {
  try {
    fs.mkdirSync(TRASH(), { recursive: true });
    if (list.length) fs.writeFileSync(PENDING(), JSON.stringify(list, null, 1));
    else fs.rmSync(PENDING(), { force: true });
  } catch { /* the next reset tries again */ }
}

/** The project folder gone: moved aside and deleted, or (when it cannot be moved) deleted file by file.
 *  Returns {moved, leftover: [paths relative to the project folder]}. */
function removeTree(dir) {
  if (!fs.existsSync(dir)) return { moved: false, leftover: [] };
  fs.mkdirSync(TRASH(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(TRASH(), path.basename(dir) + "-" + stamp);
  let moved = false;
  for (let i = 0; i < 5 && !moved; i++) {
    try { fs.renameSync(dir, dest); moved = true; } catch { sleepSync(200); }
  }
  if (moved) {
    // the project is already new; the old copy goes now, or on the next start if something still holds a file
    try { fs.rmSync(dest, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
    catch { deleteEach(dest, 2); }
    return { moved: true, leftover: [] };
  }
  const left = deleteEach(dir, 4);
  if (left.length) {
    const now = readPending();
    for (const f of left) {
      let m = 0; try { m = fs.statSync(f).mtimeMs; } catch { /* gone */ }
      if (!now.some((e) => e.path === f)) now.push({ path: f, mtimeMs: m, at: new Date().toISOString() });
    }
    writePending(now);
  }
  return { moved: false, leftover: left.map((f) => path.relative(dir, f).split(path.sep).join("/")) };
}

/** On start: the trash emptied and the files a reset could not delete (unchanged since) deleted. */
function sweep() {
  const out = { trash: 0, files: 0 };
  let ents = [];
  try { ents = fs.readdirSync(TRASH(), { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (!e.isDirectory()) continue;
    const p = path.join(TRASH(), e.name);
    try { fs.rmSync(p, { recursive: true, force: true }); out.trash++; } catch { deleteEach(p, 1); }
  }
  const keep = [];
  for (const e of readPending()) {
    try {
      if (!fs.existsSync(e.path)) continue;
      if (e.mtimeMs && Math.abs(fs.statSync(e.path).mtimeMs - e.mtimeMs) > 1) continue;   // written again: the new project's
      fs.rmSync(e.path, { force: true }); out.files++;
    } catch { keep.push(e); }
  }
  writePending(keep);
  return out;
}

let swept = false;
function sweepOnce() {
  if (swept) return; swept = true;
  setTimeout(() => { try { sweep(); } catch { /* next start */ } }, 2000).unref();
}

module.exports = { stopJobs, forgetJobs, removeTree, deleteEach, sweep, sweepOnce, TRASH, PENDING };
