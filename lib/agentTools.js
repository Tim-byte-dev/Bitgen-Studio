// lib/agentTools.js — 2.887.0: 🧰 FILES AND COMMANDS FOR THE LLM (the second step of "abilities like claude code gives").
// Tim: "is it possible to give bitgen llm live websearch ability and abilities like claude code gives?" -> the plan he went with:
// 2.885.0 the tool loop + web search · 2.886.0 SearXNG + downloads · 2.887.0 THIS: file tools + commands, each change ASKED.
//
// ONE FOLDER the user picks (Settings ▸ General ▸ 🧰, or the prompt docker's 🧰): the LLM works only inside it.
//   list / read / search   look at the folder's files (text only, size caps) - nothing changes, nothing is asked
//   write / edit           a whole file or one exact piece of text - the user SEES THE CHANGE (a diff) and says yes or no;
//                          the old file is copied to <project>/agent/backups/<time>/ first (↶ in the log puts it back)
//   run_command            one command line in the folder - the user sees it and says yes or no EVERY time; a time limit
//                          (Settings, 60 s by default) ends it and everything it started; its output comes back to the LLM
//   Every change and command goes in <project>/agent/actions.log (Settings ▸ General ▸ 🧰 📜 Log).
// SAFETY (in code, never left to the model): paths are resolved INSIDE the folder (.. and links that lead out are refused,
// .git inside is never written); the folder can't be a whole drive, your home folder or bitGen's own folder; binary files
// are not read; a turn that read web pages can't use these tools and a turn that used them can't go on the web
// (lib/llmAgent.js refuse) - so nothing from the folder can be sent to a web page and no web page can change a file.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const core = () => require("./core");

const MAX_READ_BYTES = 5 * 1024 * 1024, READ_LINES = 400, READ_CHARS = 24000;
const MAX_WRITE = 2 * 1024 * 1024, MAX_OUT = 16000, ASK_WAIT = 5 * 60 * 1000;
const SKIP_DIRS = new Set([".git", "node_modules", ".venv", "venv", "__pycache__", ".hg", ".svn", "dist", "build", ".next", ".cache"]);
const bad = (msg, status) => Object.assign(new Error(msg), { status: status || 400 });

/* ------------------------------ the folder ------------------------------ */
function settings() {
  const a = (core().getConfig().agent) || {};
  const folder = typeof a.folder === "string" ? a.folder : "";
  const t = +a.timeout;
  return { folder, timeout: t >= 5 && t <= 600 ? Math.round(t) : 60, exists: !!folder && isDir(folder) };
}
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const real = (p) => { try { return fs.realpathSync.native(p); } catch (e) { return path.resolve(p); } };
const same = (a, b) => process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
const inside = (child, parent) => { const r = path.relative(parent, child); return r === "" || (!!r && !r.startsWith("..") && !path.isAbsolute(r)); };
/** why this folder can't be the LLM's folder, or "" */
function folderProblem(dir) {
  if (!dir) return "";
  if (!path.isAbsolute(dir)) return "pick the folder with its whole path";
  if (!isDir(dir)) return "that folder does not exist";
  const r = real(dir);
  if (same(r, path.parse(r).root)) return "pick a folder, not a whole drive";
  if (same(r, real(os.homedir()))) return "pick a folder inside your home folder, not the whole home folder";
  const app = real(core().BASE || path.join(__dirname, ".."));
  if (inside(app, r)) return "that folder holds bitGen Studio itself - pick a folder of your own work";
  if (inside(r, path.join(app, "settings"))) return "bitGen's settings folder can't be used";
  return "";
}
function save(b) {
  const c = core().getConfig(), a = c.agent = Object.assign({}, c.agent || {});
  if (b.folder != null) {
    const v = String(b.folder).trim();
    if (v) { const why = folderProblem(path.resolve(v)); if (why) throw bad(why); a.folder = path.resolve(v); } else a.folder = "";
  }
  if (b.timeout != null) { const t = Math.round(+b.timeout); if (!(t >= 5 && t <= 600)) throw bad("the time limit is 5 to 600 seconds"); a.timeout = t; }
  core().setConfig(c);
  return view();
}
function view() { const s = settings(); return { folder: s.folder, timeout: s.timeout, exists: s.exists, problem: s.folder ? folderProblem(s.folder) : "" }; }

/** a path the LLM gave -> its place inside the folder (or an error): {abs, rel} */
function resolveIn(root, p, o) {
  if (!root) throw bad("no folder is picked for the LLM (Settings ▸ General ▸ 🧰)");
  const R = real(root);
  let want = String(p == null ? "" : p).trim().replace(/^["']|["']$/g, "");
  if (want === "" || want === ".") want = ".";
  const abs = path.resolve(R, want);
  if (!inside(abs, R)) throw bad(`"${want}" is outside the folder - only files inside ${R} can be used`);
  // a link inside the folder that points out of it: the real place of the deepest part that exists must stay inside
  let probe = abs; while (!fs.existsSync(probe) && probe !== R) probe = path.dirname(probe);
  if (!inside(real(probe), R)) throw bad(`"${want}" leads outside the folder (a link) - refused`);
  const rel = path.relative(R, abs).split(path.sep).join("/") || ".";
  if (o && o.write && rel.split("/").some((x) => x.toLowerCase() === ".git")) throw bad("files inside .git are never changed");
  return { abs, rel, root: R };
}
const looksBinary = (buf) => { const n = Math.min(buf.length, 8000); for (let i = 0; i < n; i++) if (buf[i] === 0) return true; return false; };

/* ------------------------------ looking (nothing changes) ------------------------------ */
function list(root, p) {
  const { abs, rel } = resolveIn(root, p);
  if (!isDir(abs)) throw bad(`"${rel}" is not a folder`);
  const out = [];
  const walk = (dir, depth) => {
    let names; try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    names.sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
    for (const d of names) {
      if (out.length >= 300) return;
      const full = path.join(dir, d.name), r = path.relative(abs, full).split(path.sep).join("/");
      if (d.isSymbolicLink()) { out.push({ path: r, type: "link" }); continue; }   // never followed (it could lead out of the folder)
      if (d.isDirectory()) { out.push({ path: r + "/", type: "folder" }); if (depth < 1 && !SKIP_DIRS.has(d.name)) walk(full, depth + 1); }
      else { let size = 0; try { size = fs.statSync(full).size; } catch (e) { /* gone */ } out.push({ path: r, type: "file", size }); }
    }
  };
  walk(abs, 0);
  return { path: rel, entries: out, more: out.length >= 300 };
}
function read(root, p, from) {
  const { abs, rel } = resolveIn(root, p);
  let st; try { st = fs.statSync(abs); } catch (e) { throw bad(`"${rel}" does not exist`); }
  if (st.isDirectory()) throw bad(`"${rel}" is a folder - use file_list`);
  if (st.size > MAX_READ_BYTES) throw bad(`"${rel}" is ${Math.round(st.size / 1048576)} MB - too big to read (5 MB at most)`);
  const buf = fs.readFileSync(abs);
  if (looksBinary(buf)) throw bad(`"${rel}" is not a text file`);
  const lines = buf.toString("utf8").replace(/\r\n/g, "\n").split("\n");
  const start = Math.max(1, Math.min(lines.length, Math.round(+from) || 1));
  let text = "", n = start;
  for (; n <= lines.length && n < start + READ_LINES; n++) { const l = `${n}\t${lines[n - 1]}\n`; if (text.length + l.length > READ_CHARS) break; text += l; }
  return { path: rel, lines: lines.length, from: start, to: n - 1, text, more: n <= lines.length };
}
function search(root, pattern, p) {
  const pat = String(pattern || "").trim();
  if (!pat) throw bad("say what to search for");
  let re; try { re = new RegExp(pat, /[A-Z]/.test(pat) ? "" : "i"); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); }
  const { abs, rel } = resolveIn(root, p);
  const hits = []; let files = 0;
  const visit = (full) => {
    if (hits.length >= 100 || files >= 3000) return;
    let st; try { st = fs.lstatSync(full); } catch (e) { return; }
    if (st.isSymbolicLink()) return;   // links are never followed (one could lead out of the folder, or round in a circle)
    if (st.isDirectory()) { let names; try { names = fs.readdirSync(full); } catch (e) { return; } for (const n of names.sort()) if (!SKIP_DIRS.has(n)) visit(path.join(full, n)); return; }
    if (st.size > 2 * 1024 * 1024) return;
    files++;
    let buf; try { buf = fs.readFileSync(full); } catch (e) { return; }
    if (looksBinary(buf)) return;
    const r = path.relative(real(root), full).split(path.sep).join("/");
    buf.toString("utf8").split(/\r?\n/).forEach((l, i) => { if (hits.length < 100 && re.test(l)) hits.push({ path: r, line: i + 1, text: l.trim().slice(0, 200) }); });
  };
  visit(abs);
  return { pattern: pat, path: rel, hits, files, more: hits.length >= 100 };
}

/* ------------------------------ the change shown before it is made ------------------------------ */
/** the lines that changed, with 2 lines round them: [{t: " " | "-" | "+" | "@", s}] - 400 rows at most */
function diff(a, b) {
  const A = String(a == null ? "" : a).replace(/\r\n/g, "\n").split("\n"), B = String(b).replace(/\r\n/g, "\n").split("\n");
  let p = 0; while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let s = 0; while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  const a1 = A.slice(p, A.length - s), b1 = B.slice(p, B.length - s);
  let ops = [];
  if (a1.length * b1.length <= 4e6) {
    const n = a1.length, m = b1.length, L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a1[i] === b1[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) { if (a1[i] === b1[j]) { ops.push([" ", a1[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) ops.push(["-", a1[i++]]); else ops.push(["+", b1[j++]]); }
    while (i < n) ops.push(["-", a1[i++]]); while (j < m) ops.push(["+", b1[j++]]);
  } else ops = a1.map((x) => ["-", x]).concat(b1.map((x) => ["+", x]));
  const all = A.slice(0, p).map((x) => [" ", x]).concat(ops, A.slice(A.length - s).map((x) => [" ", x]));
  let added = 0, removed = 0; all.forEach((o) => { if (o[0] === "+") added++; else if (o[0] === "-") removed++; });
  const keep = new Set(); all.forEach((o, k) => { if (o[0] !== " ") for (let d = -2; d <= 2; d++) keep.add(k + d); });
  const rows = []; let lineA = 1, gap = false;
  all.forEach((o, k) => {
    if (keep.has(k)) { if (gap || (!rows.length && k > 0)) rows.push({ t: "@", s: `line ${lineA}` }); gap = false; rows.push({ t: o[0], s: o[1] }); } else gap = true;
    if (o[0] !== "+") lineA++;
  });
  return { rows: rows.slice(0, 400), more: rows.length > 400, added, removed };
}
const asText = (d) => d.rows.map((r) => (r.t === "@" ? "@@ " + r.s + " @@" : r.t + " " + r.s)).join("\n") + (d.more ? "\n… (more changes)" : "");
function planWrite(root, p, content) {
  const { abs, rel } = resolveIn(root, p, { write: true });
  const text = String(content == null ? "" : content);
  if (Buffer.byteLength(text) > MAX_WRITE) throw bad("that file would be over 2 MB - too big to write");
  let before = null;
  if (fs.existsSync(abs)) {
    if (isDir(abs)) throw bad(`"${rel}" is a folder`);
    const buf = fs.readFileSync(abs); if (looksBinary(buf)) throw bad(`"${rel}" is not a text file - it is never overwritten`);
    before = buf.toString("utf8");
  }
  if (before === text) throw bad(`"${rel}" already has exactly that text - nothing to change`);
  return { kind: "write", abs, rel, isNew: before == null, before, after: text, diff: diff(before == null ? "" : before, text) };
}
function planEdit(root, p, oldText, newText, all) {
  const { abs, rel } = resolveIn(root, p, { write: true });
  if (!fs.existsSync(abs) || isDir(abs)) throw bad(`"${rel}" does not exist - use file_write to make a new file`);
  const buf = fs.readFileSync(abs); if (looksBinary(buf)) throw bad(`"${rel}" is not a text file`);
  const before = buf.toString("utf8"), crlf = /\r\n/.test(before);
  const o = String(oldText == null ? "" : oldText), n = String(newText == null ? "" : newText);
  if (!o) throw bad("say the exact text to replace (old)");
  // the model writes \n; a Windows file has \r\n - the same text either way
  const O = crlf ? o.replace(/\r?\n/g, "\r\n") : o, N = crlf ? n.replace(/\r?\n/g, "\r\n") : n;
  const count = before.split(O).length - 1;
  if (!count) throw bad(`that exact text is not in "${rel}" - read the file again and copy the text exactly`);
  if (count > 1 && !all) throw bad(`that text is in "${rel}" ${count} times - give more of the text round it so it is found once, or "all": true`);
  const after = all ? before.split(O).join(N) : before.replace(O, () => N);
  return { kind: "edit", abs, rel, isNew: false, before, after, count: all ? count : 1, diff: diff(before, after) };
}
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
/** make the change: the old file copied into backups first, then written whole (a temporary file renamed over it) */
function applyWrite(plan, backups) {
  let backup = "";
  if (!plan.isNew && backups) {
    backup = path.join(backups, stamp(), plan.rel);
    fs.mkdirSync(path.dirname(backup), { recursive: true }); fs.copyFileSync(plan.abs, backup);
  }
  fs.mkdirSync(path.dirname(plan.abs), { recursive: true });
  const tmp = plan.abs + ".bgtmp-" + process.pid;
  fs.writeFileSync(tmp, plan.after); fs.renameSync(tmp, plan.abs);
  return { path: plan.rel, isNew: plan.isNew, backup, bytes: Buffer.byteLength(plan.after), added: plan.diff.added, removed: plan.diff.removed };
}

/* ------------------------------ commands ------------------------------ */
/** one command line in the folder: the system's shell, a time limit (the command and everything it started are ended), the
 * output (stdout + stderr as they came) - its last 16 000 letters */
function runCommand(root, command, o) {
  const cmd = String(command || "").trim();
  if (!cmd) return Promise.reject(bad("say the command to run"));
  if (cmd.length > 4000) return Promise.reject(bad("that command is too long"));
  const { abs } = resolveIn(root, (o && o.cwd) || ".");
  const ms = Math.max(5, Math.min(600, +(o && o.timeout) || 60)) * 1000;
  const { spawn } = require("child_process");
  const win = process.platform === "win32";
  return new Promise((resolve) => {
    const t0 = Date.now(); let out = "", cut = false, timedOut = false, done = false;
    const add = (b) => { out += b.toString("utf8"); if (out.length > MAX_OUT * 2) { out = out.slice(-MAX_OUT); cut = true; } };
    let ch;
    try {
      ch = spawn(cmd, { cwd: abs, shell: true, windowsHide: true, detached: !win, env: Object.assign({}, process.env, { BITGEN_AGENT: "1" }), stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) { resolve({ code: -1, out: String(e.message || e), ms: 0, timedOut: false, truncated: false }); return; }
    ch.stdout.on("data", add); ch.stderr.on("data", add);
    const kill = () => {
      try { if (win) require("child_process").spawn("taskkill", ["/pid", String(ch.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" }); else process.kill(-ch.pid, "SIGKILL"); }
      catch (e) { try { ch.kill("SIGKILL"); } catch (e2) { /* gone */ } }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, ms);
    const finish = (code, signal, err) => {
      if (done) return; done = true; clearTimeout(timer);
      if (err) add(Buffer.from(String(err.message || err)));
      if (out.length > MAX_OUT) { out = out.slice(-MAX_OUT); cut = true; }
      resolve({ code: code == null ? -1 : code, signal: signal || "", out, ms: Date.now() - t0, timedOut, truncated: cut });
    };
    ch.on("error", (e) => finish(-1, "", e));
    ch.on("close", (code, signal) => finish(code, signal));
  });
}

/* ------------------------------ the log ------------------------------ */
function agentDir(project) {
  const c = core();
  try { return path.join(c.projDir(project || c.getProject()), "agent"); } catch (e) { return path.join(c.BASE || os.tmpdir(), "agent"); }
}
function log(entry, project) {
  try { const d = agentDir(project); fs.mkdirSync(d, { recursive: true }); fs.appendFileSync(path.join(d, "actions.log"), JSON.stringify(Object.assign({ at: new Date().toISOString() }, entry)) + "\n"); }
  catch (e) { /* the change itself still stands */ }
}
function readLog(project, n) {
  let t = ""; try { t = fs.readFileSync(path.join(agentDir(project), "actions.log"), "utf8"); } catch (e) { return []; }
  return t.split("\n").filter(Boolean).slice(-(n || 200)).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean).reverse();
}
/** ↶ put a backed-up file back (a write's backup from the log) - the file as it is now is backed up first */
function restore(project, backup) {
  const d = path.join(agentDir(project), "backups");
  const b = path.resolve(String(backup || ""));
  if (!inside(b, d) || !fs.existsSync(b)) throw bad("that backup is not there");
  const rel = path.relative(d, b).split(path.sep).slice(1).join("/");
  const s = settings();
  const { abs } = resolveIn(s.folder, rel, { write: true });
  let saved = "";
  if (fs.existsSync(abs)) { saved = path.join(d, stamp() + "-undo", rel); fs.mkdirSync(path.dirname(saved), { recursive: true }); fs.copyFileSync(abs, saved); }
  fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.copyFileSync(b, abs);
  log({ kind: "restore", path: rel, from: b, backup: saved }, project);
  return { ok: true, path: rel, backup: saved };
}

/* ------------------------------ asking the user ------------------------------ */
// The tool loop runs inside the chat's own request; a change waits here until the page (ext/promptdock/ptagent.js, polling
// GET /api/agent/asks) shows it and the user answers (POST /api/agent/answer) - no answer in 5 minutes = no.
const ASKS = new Map(); let seq = 0;
function ask(detail, waitMs) {
  const id = "a" + Date.now().toString(36) + (++seq);
  return new Promise((resolve) => {
    const t = setTimeout(() => { ASKS.delete(id); resolve({ ok: false, why: "no answer in " + Math.round((waitMs || ASK_WAIT) / 60000) + " minutes" }); }, waitMs || ASK_WAIT);
    ASKS.set(id, { id, at: Date.now(), detail, done: (r) => { clearTimeout(t); ASKS.delete(id); resolve(r); } });
  });
}
function asks() { return [...ASKS.values()].map((a) => Object.assign({ id: a.id, at: a.at }, a.detail)); }
function answer(id, ok, all) { const a = ASKS.get(String(id)); if (!a) return false; a.done({ ok: !!ok, all: !!all, why: ok ? "" : "the user said no" }); return true; }
function cancelAll(why) { for (const a of [...ASKS.values()]) a.done({ ok: false, why: why || "cancelled" }); }

/* ------------------------------ the tools the LLM is given (lib/llmAgent.js) ------------------------------ */
// risk "local" = looks at the folder (always allowed once a folder is picked); "write" / "exec" = asked every time
const TOOLS = {
  file_list: { risk: "local", about: "list the files and folders in the user's folder (or a folder inside it)", args: { path: "a folder inside it (optional, . = the folder itself)" },
    async run(a, ctx) { return list(ctx.folder, a.path); } },
  file_read: { risk: "local", about: "read a text file (400 lines at a time, numbered; from_line for the next part)", args: { path: "the file, relative to the folder", from_line: "the first line (optional)" },
    async run(a, ctx) { return read(ctx.folder, a.path, a.from_line); } },
  file_search: { risk: "local", about: "find the lines matching a word or regular expression in the folder's text files", args: { pattern: "the word / regular expression", path: "a folder or file inside it (optional)" },
    async run(a, ctx) { return search(ctx.folder, a.pattern || a.query, a.path); } },
  file_write: { risk: "write", about: "write a whole text file (a new one, or all of an existing one) - the user sees the change and must say yes", args: { path: "the file, relative to the folder", content: "the whole new text of the file" },
    async run(a, ctx) { return change(planWrite(ctx.folder, a.path, a.content), ctx); } },
  file_edit: { risk: "write", about: "replace one exact piece of text in a file (read it first; old must be copied exactly) - the user sees the change and must say yes", args: { path: "the file", old: "the exact text now in the file", new: "the text to put instead" },
    async run(a, ctx) { return change(planEdit(ctx.folder, a.path, a.old != null ? a.old : a.old_text, a.new != null ? a.new : a.new_text, a.all === true), ctx); } },
  run_command: { risk: "exec", about: "run one command line in the folder (build, test, git status ...) - the user sees it and must say yes each time; it is stopped after the time limit", args: { command: "the command line" },
    async run(a, ctx) {
      const cmd = String(a.command || a.cmd || "").trim(); if (!cmd) throw bad("say the command to run");
      const r = ctx.ask ? await ctx.ask({ kind: "exec", command: cmd, folder: real(ctx.folder), timeout: ctx.timeout }) : { ok: false, why: "nobody to ask" };
      if (!r.ok) { log({ kind: "command", command: cmd, folder: ctx.folder, approved: false, why: r.why }, ctx.project); throw bad("not run - " + (r.why || "the user said no")); }
      const out = await runCommand(ctx.folder, cmd, { timeout: ctx.timeout });
      log({ kind: "command", command: cmd, folder: ctx.folder, approved: true, code: out.code, ms: out.ms, timedOut: out.timedOut }, ctx.project);
      (ctx.commands = ctx.commands || []).push({ command: cmd, code: out.code, timedOut: out.timedOut });
      return Object.assign({ command: cmd }, out);
    } },
};
async function change(plan, ctx) {
  let r = ctx.allowAllWrites ? { ok: true } : null;
  if (!r) r = ctx.ask ? await ctx.ask({ kind: "write", path: plan.rel, isNew: plan.isNew, folder: real(ctx.folder), added: plan.diff.added, removed: plan.diff.removed, rows: plan.diff.rows, more: plan.diff.more }) : { ok: false, why: "nobody to ask" };
  if (!r.ok) { log({ kind: plan.kind, path: plan.rel, folder: ctx.folder, approved: false, why: r.why }, ctx.project); throw bad("not changed - " + (r.why || "the user said no")); }
  if (r.all) ctx.allowAllWrites = true;
  const done = applyWrite(plan, path.join(agentDir(ctx.project), "backups"));
  log({ kind: plan.kind, path: plan.rel, folder: ctx.folder, approved: true, isNew: plan.isNew, added: done.added, removed: done.removed, backup: done.backup }, ctx.project);
  (ctx.changes = ctx.changes || []).push(done);
  return done;
}

module.exports = { settings, view, save, folderProblem, resolveIn, list, read, search, diff, asText, planWrite, planEdit, applyWrite, runCommand, log, readLog, restore, agentDir, ask, asks, answer, cancelAll, TOOLS, SKIP_DIRS };
