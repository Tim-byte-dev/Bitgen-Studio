// bitGen Studio — project creation.
//
// Split out of routes so the name check has one home. That check matters more
// than it looks: a project name becomes a directory name, so anything with a
// path separator or a leading dot would let a "new project" write outside the
// projects folder entirely. Names are validated here, once, rather than at
// each call site.
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX_NAME = 60;

/** null when the name is usable, otherwise the reason it is not. */
function nameError(name) {
  const n = String(name == null ? "" : name).trim();
  if (!n) return "a project name is required";
  if (n.length > MAX_NAME) return `keep the name under ${MAX_NAME} characters`;
  if (/[\\/:*?"<>|]/.test(n)) return "a project name cannot contain \\ / : * ? \" < > |";
  if (/^\.+$/.test(n) || n.startsWith(".")) return "a project name cannot start with a dot";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(n))
    return `"${n}" is reserved by Windows — pick another name`;
  return null;
}

const list = () => {
  fs.mkdirSync(core.PROJECTS_DIR, { recursive: true });
  return fs.readdirSync(core.PROJECTS_DIR).filter((d) =>
    fs.statSync(path.join(core.PROJECTS_DIR, d)).isDirectory());
};

const exists = (name) => list().some((p) => p.toLowerCase() === String(name).trim().toLowerCase());

/** Create and switch to a new project. Refuses to touch one that already
 *  exists — "New" must never be a silent overwrite of somebody's work. */
function create(name, description) {
  const err = nameError(name);
  if (err) { const e = new Error(err); e.status = 400; throw e; }
  const n = String(name).trim();
  if (exists(n)) {
    const e = new Error(`a project called "${n}" already exists — open it, or pick another name`);
    e.status = 409;
    throw e;
  }
  core.ensureProject(n);
  core.setProject(n);
  const data = {
    description: String(description == null ? "" : description).slice(0, 2000),
    created: new Date().toISOString(),
  };
  fs.writeFileSync(core.prjPath(core.getProject()), JSON.stringify(data, null, 2));
  return { name: core.getProject(), data };
}

/* SAVE AS (2.372.0, Tim: "when i click save project the song and scenes in videodocker get cleared. everything
   should be saving including the prompt and prompt chat and all the dockers, references, assets, galleries etc.
   when i load the project it should load everything from where i saved it"): saving under a NEW name copies the
   WHOLE project folder - the scene board and its song (they live in the .prj), the prompt chat, characters,
   environments, references, assets, gallery output, timelines, render settings - so the copy opens exactly as the
   original stood. The .prj is renamed to the new folder's name and any absolute path to the old folder inside the
   project's text files is pointed at the new one. The recycle bin stays behind. An EXISTING project is never
   overwritten (the same rule as New). */
const TEXT_RX = /\.(prj|json|chat|seg|txt|lrc|srt|md)$/i;
function rewritePaths(dir, fromDir, toDir) {
  const pairs = [[fromDir, toDir], [JSON.stringify(fromDir).slice(1, -1), JSON.stringify(toDir).slice(1, -1)]]
    .filter(([a, b]) => a && a !== b);
  let n = 0;
  const walk = (d) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!TEXT_RX.test(e.name)) continue;
      try {
        if (fs.statSync(p).size > 8 * 1024 * 1024) continue;
        const t = fs.readFileSync(p, "utf8");
        let u = t;
        for (const [a, b] of pairs) u = u.split(a).join(b);
        if (u !== t) { fs.writeFileSync(p, u); n++; }
      } catch { /* an unreadable file is copied as it was */ }
    }
  };
  walk(dir);
  return n;
}

function copy(fromName, toName) {
  const err = nameError(toName);
  if (err) { const e = new Error(err); e.status = 400; throw e; }
  const to = String(toName).trim();
  if (exists(to)) {
    const e = new Error(`a project called "${to}" already exists - open it, or save under another name`);
    e.status = 409;
    throw e;
  }
  const src = core.projDir(fromName), dst = core.projDir(to);
  core.ensureProject(fromName);
  fs.cpSync(src, dst, { recursive: true, errorOnExist: false,
                        filter: (p) => path.basename(p) !== "recycle_bin" || path.dirname(p) !== src });
  // the project file is named after its folder
  const oldPrj = path.join(dst, path.basename(src) + ".prj");
  const newPrj = core.prjPath(to);
  if (oldPrj !== newPrj && fs.existsSync(oldPrj)) fs.renameSync(oldPrj, newPrj);
  const rewritten = rewritePaths(dst, src, dst);
  core.ensureProject(to);
  return { name: to, from: fromName, rewritten };
}

/** The .prj the page saves INTO: every key the server keeps there (the scene board + its song under `scenes`,
 *  `chapterRefs`, ...) survives; the page's own keys replace theirs. */
function mergeState(prev, data) {
  const out = { ...(prev && typeof prev === "object" ? prev : {}) };
  for (const [k, v] of Object.entries(data || {})) if (v !== undefined) out[k] = v;
  return out;
}

/* RESET (2.374.0, Tim: "add a reset button to the menubar in the left docker - delete the current project folder
   and re-create it from the original name and description - this needs a verify msgbox"): the CURRENT project's
   folder is deleted - everything in it, its recycle bin too - and made again, empty, under the same name with the
   description it had. The page asks first; the name must be sent back as the confirmation.
   2.378.0 (Tim: "the reset project button doesn't work, it should delete the project folder and recreate it new,
   clean. all the dockers should be cleared of everything including whats in the cache - it should be a new
   project"): lib/projectReset - the project's queued / running jobs are STOPPED (no longer a refusal), every job of
   the project leaves memory (the queue's Done list) with its working folder, and the folder is moved aside before
   it is deleted, so a file still open somewhere cannot keep the old project alive; the files that could not be
   deleted (in use) are returned as `leftover` and deleted on the next start. Async (a stopped job is waited for). */
async function reset(name, opts) {
  const o = opts || {};
  const R = require("./projectReset");
  const cur = core.getProject();
  const want = String(name == null ? "" : name).trim();
  if (!want || want !== cur) {
    const e = new Error(`confirm with the current project's name ("${cur}")`); e.status = 400; throw e;
  }
  const dir = core.projDir(cur);
  const root = path.resolve(core.PROJECTS_DIR);
  if (path.dirname(path.resolve(dir)) !== root) { const e = new Error("refusing to delete outside the projects folder"); e.status = 400; throw e; }
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(core.prjPath(cur), "utf8")) || {}; } catch { /* no project file yet */ }
  const description = String(prev.description || "");
  const st = await R.stopJobs(cur, o);
  const fj = R.forgetJobs(cur, o);
  const rm = R.removeTree(dir);
  core.ensureProject(cur);
  core.setProject(cur);
  const data = { description, created: new Date().toISOString(), reset_from: prev.created || undefined };
  fs.writeFileSync(core.prjPath(cur), JSON.stringify(data, null, 2));
  return { name: cur, data, stopped: st.stopped, jobs_cleared: fj.forgotten,
           leftover: rm.leftover.length ? rm.leftover : undefined };
}

module.exports = { nameError, list, exists, create, copy, mergeState, rewritePaths, reset, MAX_NAME };
