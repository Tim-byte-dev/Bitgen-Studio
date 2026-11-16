// bitGen Studio — lib/laserLink.js (2.804.0): the image editor's laser, driven from bitGen's own server - over USB
// (a serial port, the `serialport` package - N-API, the same build under plain Node and inside the Electron app) or
// over Wi-Fi (a TCP / telnet port: FluidNC, grblHAL, ESP3D … usually port 23).
//
// Tim (verbatim): "can we access bambu labs h2d? and please continue. bitgen is using eclipse can we send over
// usb/wifi using eclipse?" - the app's server runs inside the Electron app, so the server holds the connection: the
// job keeps streaming while the panel is closed, and a page reload does not drop it.
//
//   connect({kind: "serial", path, baud} | {kind: "tcp", host, port}, flavor "grbl" | "marlin")
//   status()            {connected, kind, target, flavor, banner, machine: {state, pos}, job: {name, total, done,
//                        running, paused, error, startedAt, endedAt}, log: [last 200 lines], serial (the package is here)}
//   send(line)          one line from the console (not while a job runs)
//   start(gcode, name)  stream it line by line - one line at a time, the next after the machine's "ok"
//   pause / resume      GRBL: "!" feed hold / "~"; Marlin: lines held back (M5 first)
//   stop()              GRBL: Ctrl-X (0x18 soft reset - stops at once, laser off); Marlin: M410 quick stop + M5
//   home / unlock       GRBL $H / $X; Marlin G28 X Y / M999
//   frame(box, power)   trace the job's box (mm) - laser off (G0) or at a low power
//   ports()             the serial ports
// A STOP is sent when bitGen's server exits with a job running. Pure helpers (Node: scripts/test-laserlink804.js):
// cleanLines, parseStatus, frameLines.
"use strict";
const net = require("net");

const BAUD = 115200, LINE_TIMEOUT = 120000, LOG_MAX = 200;
/** the lines a job sends: comments and blank lines out, each trimmed (GRBL's line limit is 80 characters - longer refused) */
function cleanLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.replace(/;.*$/, "").replace(/\(.*?\)/g, "").trim()).filter(Boolean);
}
/** GRBL's status report "<Idle|MPos:1.000,2.000,0.000|FS:0,0>" -> {state, pos: [x, y, z]} | null */
function parseStatus(s) {
  const m = /^<([^|>]+)(?:\|([^>]*))?>$/.exec(String(s || "").trim()); if (!m) return null;
  const out = { state: m[1].split(":")[0], pos: null };
  for (const part of (m[2] || "").split("|")) { const [k, v] = part.split(":"); if ((k === "MPos" || k === "WPos") && v) out.pos = v.split(",").map(Number); }
  return out;
}
/** the lines that trace a box {x0, y0, x1, y1} (mm): laser off (G0) or at power p (0..1) of sMax */
function frameLines(box, o) {
  const p = Math.max(0, Math.min(1, +(o && o.power) || 0)), f = Math.max(100, +(o && o.speed) || 3000), grbl = !o || o.flavor !== "marlin", S = Math.round(p * ((o && o.sMax) || (grbl ? 1000 : 255)));
  const r = (v) => Math.round(v * 1000) / 1000, c = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1], [box.x0, box.y0]];
  const L = ["G21", "G90", `G0 X${r(c[0][0])} Y${r(c[0][1])}`];
  if (p > 0) L.push(grbl ? `M3 S${S}` : `M3 S${S}`);
  for (const [x, y] of c.slice(1)) L.push((p > 0 ? "G1" : "G0") + ` X${r(x)} Y${r(y)}` + (p > 0 ? ` F${f}` : ""));
  if (p > 0) L.push("M5");
  return L;
}

/* ---------------- the connection ---------------- */
let serialLib;            // undefined = not looked for yet, null = not installed
function serial() { if (serialLib === undefined) { try { serialLib = require("serialport"); } catch { serialLib = null; } } return serialLib; }
let transportFactory = null;   // tests: (spec) -> transport
function setTransportFactory(f) { transportFactory = f; }
function setSerialLib(x) { serialLib = x; }   // tests: serialport's SerialPortMock

const S = { link: null, kind: "", target: "", flavor: "grbl", banner: "", machine: { state: "", pos: null }, job: null, log: [], waiters: [], buf: "", poll: null, error: "" };
function log(dir, line) { S.log.push({ t: Date.now(), dir, line: String(line).slice(0, 200) }); if (S.log.length > LOG_MAX) S.log.splice(0, S.log.length - LOG_MAX); }
function onLine(raw) {
  const line = String(raw).replace(/\r$/, "").trim(); if (!line) return;
  const st = parseStatus(line);
  if (st) { S.machine = { state: st.state, pos: st.pos || S.machine.pos }; return; }   // status reports are not logged (4 a second)
  log("<", line);
  if (/^Grbl\b|^\[MSG|^FluidNC|^Marlin|^start$/i.test(line)) S.banner = S.banner || line;
  if (/^ALARM/i.test(line)) { S.machine.state = "Alarm"; if (S.job && S.job.running) failJob(line); }
  if (/^ok\b/i.test(line) || /^error/i.test(line)) { const w = S.waiters.shift(); if (w) { clearTimeout(w.timer); w.done(/^error/i.test(line) ? new Error(line) : null); } }
}
function failJob(why) { if (S.job) { S.job.error = String(why); S.job.running = false; S.job.paused = false; S.job.endedAt = Date.now(); } }
function open(spec) {
  if (transportFactory) return transportFactory(spec);
  if (spec.kind === "tcp") {
    return new Promise((ok, no) => {
      const sock = net.connect({ host: spec.host, port: +spec.port || 23 });
      const t = { write: (s) => sock.write(s), close: () => sock.destroy(), on: (ev, f) => { if (ev === "data") sock.on("data", (b) => f(b.toString("utf8"))); else if (ev === "close") sock.on("close", f); } };
      sock.setTimeout(8000, () => { sock.destroy(); no(new Error(`no answer from ${spec.host}:${spec.port || 23}`)); });
      sock.once("connect", () => { sock.setTimeout(0); ok(t); });
      sock.once("error", (e) => no(e));
    });
  }
  const lib = serial(); if (!lib) return Promise.reject(Object.assign(new Error("USB needs the serial-port support - run the installer again (or npm install) to add it"), { status: 501 }));
  return new Promise((ok, no) => {
    const port = new lib.SerialPort({ path: spec.path, baudRate: +spec.baud || BAUD, autoOpen: false });
    port.open((e) => {
      if (e) return no(e);
      ok({ write: (s) => port.write(s), close: () => port.close(() => {}), on: (ev, f) => { if (ev === "data") port.on("data", (b) => f(b.toString("utf8"))); else if (ev === "close") port.on("close", f); } });
    });
  });
}
function rawWrite(s) { if (!S.link) throw Object.assign(new Error("not connected"), { status: 409 }); S.link.write(s); }
/** one line, the promise settles on the machine's "ok" / "error" */
function sendLine(line) {
  return new Promise((ok, no) => {
    if (!S.link) return no(Object.assign(new Error("not connected"), { status: 409 }));
    const w = { done: (e) => (e ? no(e) : ok()), timer: null };
    w.timer = setTimeout(() => { const i = S.waiters.indexOf(w); if (i >= 0) S.waiters.splice(i, 1); no(new Error("no answer to " + line)); }, LINE_TIMEOUT);
    if (w.timer.unref) w.timer.unref();
    S.waiters.push(w); log(">", line); S.link.write(line + "\n");
  });
}
async function connect(spec, flavor) {
  if (S.link) disconnect();
  const sp = Object.assign({}, spec || {});
  if (sp.kind !== "tcp" && sp.kind !== "serial") throw Object.assign(new Error("kind: serial (USB) or tcp (Wi-Fi)"), { status: 400 });
  if (sp.kind === "tcp" && !sp.host) throw Object.assign(new Error("the machine's address (host) first"), { status: 400 });
  if (sp.kind === "serial" && !sp.path) throw Object.assign(new Error("pick the USB port first"), { status: 400 });
  const t = await open(sp);
  Object.assign(S, { link: t, kind: sp.kind, target: sp.kind === "tcp" ? `${sp.host}:${+sp.port || 23}` : sp.path, flavor: flavor === "marlin" ? "marlin" : "grbl", banner: "", machine: { state: "", pos: null }, buf: "", error: "" });
  t.on("data", (chunk) => { S.buf += chunk; let i; while ((i = S.buf.search(/\r?\n/)) >= 0) { const line = S.buf.slice(0, i); S.buf = S.buf.slice(i + (S.buf[i] === "\r" ? 2 : 1)); onLine(line); } if (/^<[^>]*>$/.test(S.buf.trim())) { onLine(S.buf); S.buf = ""; } });
  t.on("close", () => { if (S.link === t) { failJob("the connection closed"); dropLink(); } });
  if (S.flavor === "grbl") { S.poll = setInterval(() => { try { if (S.link) S.link.write("?"); } catch { /* closed */ } }, 400); if (S.poll.unref) S.poll.unref(); try { t.write("\r\n\r\n"); } catch { /* fine */ } }
  log("·", `connected to ${S.target} (${S.flavor === "grbl" ? "GRBL" : "Marlin"})`);
  return status();
}
function dropLink() { clearInterval(S.poll); S.poll = null; for (const w of S.waiters.splice(0)) { clearTimeout(w.timer); w.done(new Error("disconnected")); } S.link = null; }
function disconnect() {
  if (S.job && S.job.running) stop();
  const t = S.link; dropLink(); if (t) { try { t.close(); } catch { /* gone */ } log("·", "disconnected"); }
  return status();
}
async function send(line) {
  if (S.job && S.job.running) throw Object.assign(new Error("a job is running - pause or stop it first"), { status: 409 });
  const l = String(line || "").trim(); if (!l) throw Object.assign(new Error("nothing to send"), { status: 400 });
  if (l === "?" || l === "!" || l === "~") { rawWrite(l); return status(); }
  await sendLine(l); return status();
}
/** stream a job; resolves when it ends (start() itself does not wait for that) */
async function run(lines) {
  const J = S.job;
  for (let i = 0; i < lines.length; i++) {
    while (J.paused && J.running) await new Promise((r) => setTimeout(r, 100));
    if (!J.running || S.job !== J) return;
    try { await sendLine(lines[i]); } catch (e) { if (J.running) { failJob(e.message); try { rawWrite(S.flavor === "grbl" ? "\x18" : "M5\n"); } catch { /* gone */ } } return; }
    J.done = i + 1;
  }
  J.running = false; J.endedAt = Date.now(); log("·", `job done: ${J.name} (${J.total} lines)`);
}
function start(gcode, name) {
  if (!S.link) throw Object.assign(new Error("connect to the laser first"), { status: 409 });
  if (S.job && S.job.running) throw Object.assign(new Error("a job is already running"), { status: 409 });
  if (S.flavor === "grbl" && /^Alarm/i.test(S.machine.state || "")) throw Object.assign(new Error("the machine is in ALARM - home it or unlock ($X) first"), { status: 409 });
  const lines = cleanLines(gcode);
  if (!lines.length) throw Object.assign(new Error("the G-code is empty"), { status: 400 });
  const long = lines.find((l) => l.length > 255); if (long) throw Object.assign(new Error("a line is too long for the machine: " + long.slice(0, 40)), { status: 400 });
  S.job = { name: String(name || "job"), total: lines.length, done: 0, running: true, paused: false, error: "", startedAt: Date.now(), endedAt: 0 };
  log("·", `job started: ${S.job.name} (${lines.length} lines)`);
  run(lines);
  return status();
}
function pause() {
  if (!S.job || !S.job.running) throw Object.assign(new Error("no job running"), { status: 409 });
  S.job.paused = true;
  if (S.flavor === "grbl") rawWrite("!"); else rawWrite("M5\n");
  log("·", "paused"); return status();
}
function resume() {
  if (!S.job || !S.job.running || !S.job.paused) throw Object.assign(new Error("nothing paused"), { status: 409 });
  if (S.flavor === "grbl") rawWrite("~");
  S.job.paused = false; log("·", "resumed"); return status();
}
/** STOP: at once, laser off - always allowed */
function stop() {
  const wasRunning = !!(S.job && S.job.running);
  if (S.job && S.job.running) { S.job.running = false; S.job.paused = false; S.job.error = "stopped"; S.job.endedAt = Date.now(); }
  for (const w of S.waiters.splice(0)) { clearTimeout(w.timer); w.done(new Error("stopped")); }
  if (S.link) { try { rawWrite(S.flavor === "grbl" ? "\x18" : "M410\nM5\n"); } catch { /* gone */ } }
  log("·", "STOP" + (wasRunning ? " (the job was running)" : ""));
  return status();
}
const home = () => send(S.flavor === "grbl" ? "$H" : "G28 X Y");
const unlock = () => send(S.flavor === "grbl" ? "$X" : "M999");
async function frame(box, o) {
  if (S.job && S.job.running) throw Object.assign(new Error("a job is running"), { status: 409 });
  const b = box || {};
  if (![b.x0, b.y0, b.x1, b.y1].every(Number.isFinite)) throw Object.assign(new Error("no job box to frame"), { status: 400 });
  for (const l of frameLines(b, Object.assign({ flavor: S.flavor }, o || {}))) await sendLine(l);
  return status();
}
async function ports() {
  const lib = serial(); if (!lib) return { serial: false, ports: [] };
  try { return { serial: true, ports: (await lib.SerialPort.list()).map((p) => ({ path: p.path, maker: p.manufacturer || "", id: [p.vendorId, p.productId].filter(Boolean).join(":") })) }; }
  catch (e) { return { serial: true, ports: [], error: e.message }; }
}
function status() {
  return { connected: !!S.link, kind: S.kind, target: S.target, flavor: S.flavor, banner: S.banner, machine: Object.assign({}, S.machine), job: S.job ? Object.assign({}, S.job) : null, log: S.log.slice(-LOG_MAX), serial: !!serial() };
}
// bitGen's server going away with a job running: STOP first (lib/exitSweep.js calls stopIfRunning on every way out;
// the exit hook is the last chance)
function stopIfRunning(why) { try { if (S.job && S.job.running) { log("·", "bitGen is closing" + (why ? ` (${why})` : "")); stop(); } } catch { /* best effort */ } }
let hooked = false;
function hookExit() { if (hooked) return; hooked = true; process.on("exit", () => stopIfRunning("exit")); }
function reset() { if (S.link) disconnect(); Object.assign(S, { job: null, log: [], banner: "", machine: { state: "", pos: null } }); }

module.exports = { cleanLines, parseStatus, frameLines, stopIfRunning, connect, disconnect, send, start, pause, resume, stop, home, unlock, frame, ports, status, hookExit, setTransportFactory, setSerialLib, reset, BAUD };
