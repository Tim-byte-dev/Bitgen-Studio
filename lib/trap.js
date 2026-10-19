"use strict";
/* 2.278.0 (Tim's field report: "⚠ Cannot read properties of undefined
 * (reading 'output')" in the video docker notifications, with no way to
 * tell WHERE): every route on the render/board surface now answers a
 * thrown error IN WORDS WITH ITS ADDRESS — "message @ file:line" — so
 * the next ⚠ names the exact line instead of leaving us to audit the
 * whole tree. A raw V8 TypeError with no address almost always means a
 * MIXED INSTALL (Windows skips overwriting files an app holds open, so
 * an update extracted over a running app leaves old files under new
 * ones); the address settles that in one look.
 *
 * No express dependency here beyond the (req, res) calling convention —
 * guard() wraps a handler, sync or async, and turns anything thrown into
 * a JSON {error} with the address, honouring an e.status when the
 * thrower set one. Process-level nets log the address to the console
 * (the console dock streams it) instead of dying silently. */

const path = require("path");

const ROOT = path.join(__dirname, "..") + path.sep;

/** "message @ file:line" — the first stack frame inside the app, with the
 *  install root stripped; node_modules and node internals are skipped so
 *  the line named is OURS. Falls back to the bare message. */
function where(e) {
  const msg = String((e && e.message) || e || "unknown error");
  const stack = String((e && e.stack) || "");
  for (const line of stack.split("\n").slice(1)) {
    const m = line.match(/\(?([^()\s]+):(\d+):\d+\)?\s*$/);
    if (!m) continue;
    const file = m[1];
    if (file.includes("node_modules") || file.startsWith("node:")) continue;
    const rel = file.startsWith(ROOT) ? file.slice(ROOT.length) : file;
    return `${msg} @ ${rel.replace(/\\/g, "/")}:${m[2]}`;
  }
  return msg;
}

/** Wrap an express handler (sync or async): a throw becomes
 *  res.status(e.status || 500).json({ error: where(e) }) instead of an
 *  HTML error page or an unhandled rejection. Headers already sent →
 *  logged, never double-answered. */
function guard(fn) {
  return function (req, res, next) {
    const boom = (e) => {
      const said = where(e);
      console.error("[trap] " + said);
      if (res.headersSent) return;
      res.status((e && e.status) || 500).json({ error: said });
    };
    try {
      const r = fn(req, res, next);
      if (r && typeof r.catch === "function") r.catch(boom);
    } catch (e) { boom(e); }
  };
}

/* The safety nets: an escape that reaches the process still gets an
 * address in the console (which the console dock streams) instead of a
 * silent death or a bare message. Registered once, however many files
 * require this module. */
if (!process.__bitgenTrapNets) {
  process.__bitgenTrapNets = true;
  process.on("unhandledRejection", (e) =>
    console.error("[trap] unhandled rejection: " + where(e)));
  process.on("uncaughtException", (e) =>
    console.error("[trap] uncaught exception: " + where(e)));
}

module.exports = { where, guard };
