// bitGen Studio — SETUP: running things and fetching things (2.331.0).
//
// The one place the installer spawns a process or downloads a file, on
// Windows, macOS and Linux alike, with every line streamed to the wizard's
// log (and setup.log). No PowerShell, no curl: Node's own https with
// redirects, a Range RESUME for the multi-GB model files, and progress.
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");

const IS_WIN = process.platform === "win32";

/** Run a command; each output line goes to log(line, isErr). -> exit code
 *  (a spawn failure is -1 with its message logged, never a throw).
 *  2.540.2 (Tim's first install stopped after "Cloning into ..." with no further line): opts.timeout (ms) - a
 *  command still running then is stopped (its whole process tree on Windows) and run() answers -2, logged, so one
 *  stuck step can never hang the setup. */
function run(cmd, args, opts) {
  const o = opts || {};
  const log = o.log || (() => {});
  return new Promise((resolve) => {
    let child, timer = null, done = false;
    const finish = (code) => { if (done) return; done = true; if (timer) clearTimeout(timer); resolve(code); };
    log("> " + [cmd].concat(args || []).map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" "), false);
    try {
      child = spawn(cmd, args || [], { cwd: o.cwd, env: o.env || process.env, windowsHide: true,
                                       shell: !!o.shell, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) { log(`${cmd}: ${e.message}`, true); return finish(-1); }
    if (o.timeout > 0) timer = setTimeout(() => {
      log(`[warn] ${path.basename(String(cmd))} was still running after ${Math.round(o.timeout / 60000 * 10) / 10} min - stopped`, true);
      killTree(child);
      finish(-2);
    }, o.timeout);
    const feed = (err) => {
      let buf = "";
      return (d) => {
        buf += String(d);
        const parts = buf.split(/\r?\n|\r/);
        buf = parts.pop();
        for (const l of parts) if (l.trim()) log(l, err);
      };
    };
    child.stdout.on("data", feed(false));
    child.stderr.on("data", feed(true));
    child.on("error", (e) => { log(`${cmd}: ${e.message}`, true); finish(-1); });
    child.on("close", (code) => finish(code == null ? -1 : code));
  });
}
/** Stop a child and everything it started (git spawns helpers; on Windows a plain kill leaves them running). */
function killTree(child) {
  if (!child || child.exitCode != null) return;
  try {
    if (IS_WIN && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else child.kill("SIGKILL");
  } catch { /* already gone */ }
}

/** A command on PATH (or in `extra` dirs first) -> its full path, or "". */
function which(name, extra) {
  const exts = IS_WIN ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";").concat([""]) : [""];
  const dirs = (extra || []).concat(String(process.env.PATH || "").split(path.delimiter)).filter(Boolean);
  for (const d of dirs) for (const e of exts) {
    const p = path.join(d, name + e.toLowerCase());
    const P = path.join(d, name + e);
    for (const c of [P, p]) {
      try { if (fs.statSync(c).isFile()) return c; } catch { /* next */ }
    }
  }
  return "";
}

function getter(url) { return url.startsWith("http://") ? http : https; }

/** GET a URL following redirects -> {status, headers, res} (res unconsumed). */
function open(url, headers, hops) {
  const n = hops || 0;
  return new Promise((resolve, reject) => {
    const req = getter(url).get(url, { headers: Object.assign({ "User-Agent": "bitGen-Studio-setup" }, headers || {}) }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && n < 8) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        // an auth header must never follow a redirect to ANOTHER host (the
        // HF CDN signs its own URLs; our token is not theirs to see)
        const h = Object.assign({}, headers || {});
        if (new URL(next).host !== new URL(url).host) delete h.Authorization;
        return resolve(open(next, h, n + 1));
      }
      resolve({ status: res.statusCode, headers: res.headers, res, url });
    });
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("no answer for 60 s")));
  });
}

/** GET JSON -> {status, json} ({status: 0} on a network failure). */
async function getJson(url, headers) {
  try {
    const r = await open(url, headers);
    let body = "";
    r.res.setEncoding("utf8");
    await new Promise((ok, bad) => { r.res.on("data", (d) => { body += d; }); r.res.on("end", ok); r.res.on("error", bad); });
    let json = null;
    try { json = JSON.parse(body); } catch { json = null; }
    return { status: r.status, json, body };
  } catch (e) { return { status: 0, json: null, error: e.message }; }
}

/**
 * Download url -> dest with RESUME: bytes land in dest + ".part"; a restart
 * asks for the rest (Range) and appends. onProgress({got, total}) about
 * every 1%. Resolves {ok, bytes} or {ok:false, status, error}; the .part
 * survives a failure so the next try continues.
 */
async function download(url, dest, opts) {
  const o = opts || {};
  const part = dest + ".part";
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let have = 0;
  try { have = fs.statSync(part).size; } catch { have = 0; }
  const headers = Object.assign({}, o.headers || {});
  if (have > 0) headers.Range = `bytes=${have}-`;
  let r;
  try { r = await open(url, headers); }
  catch (e) { return { ok: false, status: 0, error: e.message }; }
  if (r.status === 416 && have > 0) {                 // the .part is already whole
    r.res.resume();
    fs.renameSync(part, dest);
    return { ok: true, bytes: have, resumed: true };
  }
  if (r.status !== 200 && r.status !== 206) {
    r.res.resume();
    return { ok: false, status: r.status, error: `HTTP ${r.status}` };
  }
  const append = r.status === 206 && have > 0;
  if (!append) have = 0;
  const len = parseInt(r.headers["content-length"] || "0", 10) || 0;
  const total = len ? len + have : (o.size || 0);
  const out = fs.createWriteStream(part, { flags: append ? "a" : "w" });
  let got = have, lastPct = -1;
  return new Promise((resolve) => {
    r.res.on("data", (d) => {
      got += d.length;
      const pct = total ? Math.floor((got / total) * 100) : -1;
      if (o.onProgress && pct !== lastPct) { lastPct = pct; o.onProgress({ got, total }); }
    });
    r.res.on("error", (e) => { out.end(); resolve({ ok: false, status: r.status, error: e.message }); });
    out.on("error", (e) => resolve({ ok: false, status: r.status, error: e.message }));
    r.res.pipe(out);
    out.on("finish", () => {
      if (total && got < total) return resolve({ ok: false, status: r.status, error: `stopped at ${got} of ${total} bytes - run it again to resume` });
      try { fs.renameSync(part, dest); } catch (e) { return resolve({ ok: false, error: e.message }); }
      if (o.onProgress) o.onProgress({ got, total: total || got });
      resolve({ ok: true, bytes: got, resumed: append });
    });
  });
}

/** Human bytes. */
function gb(n) {
  const v = +n || 0;
  return v >= 1073741824 ? (v / 1073741824).toFixed(1) + " GB" : v >= 1048576 ? Math.round(v / 1048576) + " MB"
    : Math.max(1, Math.round(v / 1024)) + " KB";
}

module.exports = { IS_WIN, run, killTree, which, open, getJson, download, gb };
