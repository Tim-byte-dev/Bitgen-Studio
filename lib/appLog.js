// bitGen Studio — lib/appLog.js (2.522.0): THE APP CONSOLE, kept. Every console.log / info / warn / error line of the
// server process (the app's own lines and what it relays from ComfyUI, llama-server and the workers) goes into a ring
// of the last 3000 lines, each with its time - the 🐞 Bug report docker attaches it (lib/bugReport.js).
// Started once from routes/bugReport.js (never server.js); the console still prints as before.
//   start()  lines(n)  text(n)  _push(line) (tests)
"use strict";
const util = require("util");

const MAX = 3000;
const RING = [];
let started = false;

function push(level, args) {
  let s;
  try { s = util.format(...args); } catch { s = String(args && args[0]); }
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0"), mm = String(t.getMinutes()).padStart(2, "0"), ss = String(t.getSeconds()).padStart(2, "0");
  for (const line of String(s).split(/\r?\n/)) {
    if (!line.trim()) continue;
    RING.push(`${hh}:${mm}:${ss} ${level === "log" || level === "info" ? "" : level.toUpperCase() + " "}${line.slice(0, 2000)}`);
  }
  if (RING.length > MAX) RING.splice(0, RING.length - MAX);
}
function start() {
  if (started) return;
  started = true;
  for (const level of ["log", "info", "warn", "error"]) {
    const orig = console[level].bind(console);
    console[level] = (...args) => { push(level, args); orig(...args); };
  }
  process.on("uncaughtExceptionMonitor", (e) => push("error", ["uncaught: " + (e && e.stack || e)]));
}
function lines(n) { return RING.slice(-(n || MAX)); }
function text(n) { return lines(n).join("\n"); }

module.exports = { start, lines, text, MAX, _push: (l) => push("log", [l]) };
