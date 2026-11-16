#!/usr/bin/env node
/* bitGen Studio — 2.804.0 units: the laser connection held by bitGen's server (lib/laserLink.js, routes/laserLink.js) -
 * over Wi-Fi (TCP, against a stand-in GRBL on this computer) and over USB (serialport's mock port); the Laser panel's send
 * controls and the SVG for other laser software (pclaser.js svgOf). */
"use strict";
const path = require("path"), fs = require("fs"), net = require("net");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const LL = require("../lib/laserLink");
const Z = require("../ext/imageeditdock/pclaser.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 5000)) { if (f()) return true; await wait(20); } return false; };

/** a stand-in GRBL on a TCP port: "ok" per line (slowly), status reports, feed hold / resume / soft reset */
function fakeGrbl(delay) {
  const got = [], rt = [];
  let state = "Idle";
  const srv = net.createServer((sock) => {
    let buf = "";
    sock.write("Grbl 1.1h ['$' for help]\r\n");
    sock.on("data", (b) => {
      for (const ch of b.toString("latin1")) {
        if (ch === "?") { sock.write(`<${state}|MPos:1.000,2.000,0.000|FS:0,0>\r\n`); continue; }
        if (ch === "!") { rt.push("!"); state = "Hold:0"; continue; }
        if (ch === "~") { rt.push("~"); state = "Run"; continue; }
        if (ch === "\x18") { rt.push("reset"); state = "Idle"; buf = ""; sock.write("\r\nGrbl 1.1h ['$' for help]\r\n"); continue; }
        if (ch === "\n") {
          const line = buf.trim(); buf = ""; if (!line) continue; got.push(line);
          setTimeout(() => { if (sock.destroyed) return; if (/BAD/.test(line)) sock.write("error:2\r\n"); else sock.write("ok\r\n"); }, delay || 0);
          continue;
        }
        if (ch !== "\r") buf += ch;
      }
    });
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, port: srv.address().port, got, rt, set: (s) => { state = s; } })));
}

(async () => {
  check("cleanLines: comments and blank lines out, trimmed", JSON.stringify(LL.cleanLines("; a\nG21 ; mm\n\n  G0 X1 (note) Y2 \nM2")) === '["G21","G0 X1  Y2","M2"]');
  check("parseStatus: GRBL's <state|MPos:…> -> state + position; anything else null", JSON.stringify(LL.parseStatus("<Run|MPos:10.000,5.500,0.000|FS:1000,500>")) === '{"state":"Run","pos":[10,5.5,0]}' && LL.parseStatus("<Hold:0|WPos:1,2,3>").state === "Hold" && LL.parseStatus("ok") === null);
  const fr = LL.frameLines({ x0: 0, y0: 0, x1: 10, y1: 5 }, { power: 0 }), fp = LL.frameLines({ x0: 0, y0: 0, x1: 10, y1: 5 }, { power: 0.01, speed: 2000, sMax: 1000 });
  check("frameLines: laser off = G0 round the box; at 1 % = M3 S10, G1 F2000 round it, M5", JSON.stringify(fr) === '["G21","G90","G0 X0 Y0","G0 X10 Y0","G0 X10 Y5","G0 X0 Y5","G0 X0 Y0"]' && fp.includes("M3 S10") && fp.includes("G1 X10 Y0 F2000") && fp[fp.length - 1] === "M5", fp);

  /* Wi-Fi: TCP */
  const g = await fakeGrbl(15);
  let st = await LL.connect({ kind: "tcp", host: "127.0.0.1", port: g.port }, "grbl");
  await until(() => LL.status().banner && LL.status().machine.state);
  st = LL.status();
  check("Wi-Fi: connect over TCP; the banner read; GRBL status polled (?) -> state Idle, position 1, 2", st.connected && st.kind === "tcp" && /Grbl 1\.1h/.test(st.banner) && st.machine.state === "Idle" && JSON.stringify(st.machine.pos) === "[1,2,0]", st);
  await LL.send("$X");
  check("send: one console line -> ok", g.got.includes("$X"));
  const code = ["; job", "G21", "G90", "M4 S0"].concat(Array.from({ length: 60 }, (_, i) => `G1 X${i} Y0 S500 F1000`)).concat(["M5", "M2"]).join("\n");
  LL.start(code, "Sign.gcode");
  await until(() => LL.status().job.done >= 10);
  LL.pause();
  const atPause = LL.status().job.done;
  await wait(200);
  const afterPause = LL.status().job.done;
  check("start: streamed line by line (comments out); ⏸ pause = GRBL feed hold (!) and no more lines sent", g.rt.includes("!") && afterPause - atPause <= 1 && LL.status().job.paused && !g.got.some((l) => l.startsWith(";")), { atPause, afterPause });
  LL.resume();
  await until(() => !LL.status().job.running, 8000);
  st = LL.status();
  check("resume (~) -> the job runs to the end: every line sent once, in order", g.rt.includes("~") && st.job.done === st.job.total && st.job.total === 65 && g.got.slice(-65).join("\n") === LL.cleanLines(code).join("\n") && !st.job.error, { done: st.job.done, total: st.job.total, err: st.job.error });
  let refused = ""; try { LL.start("", "x"); } catch (e) { refused = e.message; }
  check("start: empty G-code refused", /empty/.test(refused));
  LL.start(code, "Again.gcode");
  await until(() => LL.status().job.done >= 5);
  LL.stop();
  await wait(150);
  st = LL.status();
  check("■ STOP: GRBL soft reset (Ctrl-X) at once, the job ends 'stopped', no more lines after", g.rt.includes("reset") && !st.job.running && st.job.error === "stopped" && st.job.done < st.job.total, st.job);
  LL.start("G21\nG1 X1 BAD\nG1 X2", "Bad.gcode");
  await until(() => !LL.status().job.running);
  st = LL.status();
  check("an error from the machine stops the job (and says it)", /error:2/.test(st.job.error) && st.job.done === 1, st.job);
  g.set("Alarm"); await wait(500);
  refused = ""; try { LL.start("G21", "x"); } catch (e) { refused = e.message; }
  check("in ALARM: Start refused until Home / Unlock", /ALARM/.test(refused), refused);
  g.set("Idle"); await wait(500);
  await LL.frame({ x0: 0, y0: 0, x1: 10, y1: 5 }, { power: 0 });
  check("▭ Frame: the box traced with G0 (laser off)", g.got.slice(-4).join("|") === "G0 X10 Y0|G0 X10 Y5|G0 X0 Y5|G0 X0 Y0", g.got.slice(-6));
  LL.disconnect();
  check("disconnect", !LL.status().connected);
  g.srv.close();

  /* bitGen closing with a job running: STOP first */
  const g2 = await fakeGrbl(30);
  await LL.connect({ kind: "tcp", host: "127.0.0.1", port: g2.port }, "grbl");
  LL.start(code, "Long.gcode"); await until(() => LL.status().job.done >= 3);
  LL.stopIfRunning("test exit"); await wait(100);
  check("bitGen exiting with a job running = STOP (lib/exitSweep.js calls stopIfRunning first)", g2.rt.includes("reset") && LL.status().job.error === "stopped" && /stopIfRunning/.test(fs.readFileSync(path.join(ROOT, "lib/exitSweep.js"), "utf8")));
  LL.disconnect(); g2.srv.close();

  /* USB: serialport's mock port, Marlin */
  let sp = null; try { sp = require("serialport"); } catch { sp = null; }
  if (sp && sp.SerialPortMock) {
    const { SerialPortMock } = sp;
    SerialPortMock.binding.createPort("/dev/LASER", { echo: false, record: true });
    const spy = {}; class Spy extends SerialPortMock { constructor(o) { super(o); spy.inst = this; } }
    LL.setSerialLib({ SerialPort: Spy });
    await LL.connect({ kind: "serial", path: "/dev/LASER", baud: 115200 }, "marlin");
    const port = SerialPortMock.binding.openPorts ? null : null; void port;
    st = LL.status();
    check("USB: connect a serial port (serialport, mocked) as Marlin - no status polling", st.connected && st.kind === "serial" && st.target === "/dev/LASER" && st.flavor === "marlin");
    LL.stop(); await wait(50);
    const rec = (() => { try { return Buffer.from(spy.inst.port.recording).toString(); } catch { return ""; } })();
    check("Marlin STOP = M410 (quick stop) + M5, written to the port", /M410\nM5\n/.test(rec), rec.slice(0, 80));
    LL.disconnect(); LL.setSerialLib(undefined);
  } else check("serialport installed (npm install) for USB", false, "serialport missing");
  const ports = await LL.ports();
  check("ports(): says whether USB support is here", typeof ports.serial === "boolean" && Array.isArray(ports.ports));

  /* the SVG for other laser software */
  const svg = Z.svgOf([{ name: "Cut", op: "line", paths: [{ pts: [[0, 0], [100, 0], [100, 50]], closed: false }] }, { name: "Plate", op: "fill", rings: [[[10, 10], [20, 10], [20, 20], [10, 20]]] }, { name: "Photo", op: "image", png: new Uint8Array([1, 2, 3]) }], 500, 400, 0.2, (u) => Buffer.from(u).toString("base64"));
  check("svgOf: the page in mm (100 × 80), one layer per operation: Line red strokes, Fill black shapes, Image the picture", /width="100mm" height="80mm" viewBox="0 0 100 80"/.test(svg) && /<path d="M0 0L20 0L20 10" fill="none" stroke="#ff0000"/.test(svg) && /fill="#000000" fill-rule="evenodd"/.test(svg) && /xlink:href="data:image\/png;base64,AQID"/.test(svg) && (svg.match(/inkscape:groupmode="layer"/g) || []).length === 3, svg.slice(0, 600));

  /* source pins */
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8"), LZ = src("ext/imageeditdock/pclaser.js"), PJ = JSON.parse(src("package.json"));
  check("routes/laserLink.js mounted from routes/index.js (not server.js); serialport a dependency", /require\("\.\/laserLink"\)\.mount\(app\)/.test(src("routes/index.js")) && !/laserLink/.test(src("misc/server.js")) && !!PJ.dependencies.serialport);
  check("the panel: USB / Wi-Fi, Connect, Home, Unlock, Frame, ▶ Start (asks first), Pause / Resume, ■ STOP (+ in the title bar), console, log; ⤓ SVG + PNG", ["lzKind", "lzPortSel", "lzHost", "lzConnect", "lzHome", "lzUnlock", "lzFrame", "lzStart", "lzPause", "lzResume", "lzStop", "lzStopTop", "lzCmd", "lzLog", "lzSvg"].every((id) => LZ.includes(`id="${id}"`)) && /The laser is about to fire/.test(LZ));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); process.exit(1); });
