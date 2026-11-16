#!/usr/bin/env node
/* bitGen Studio — 2.804.0 in a REAL browser: THE LASER PANEL SENDS - over Wi-Fi (TCP) to a stand-in GRBL started here: connect, frame,
 * start (asked first), pause, STOP, the console; ⤓ SVG + PNG for other laser software. Tim: "can we access bambu labs h2d?
 * and please continue. bitgen is using eclipse can we send over usb/wifi using eclipse?". Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), net = require("net");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the laser send browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const has = (bin) => { try { execSync("command -v " + bin, { stdio: "ignore" }); return true; } catch { return false; } };

function fakeGrbl(delay) {
  const got = [], rt = [];
  let state = "Idle";
  const srv = net.createServer((sock) => {
    let buf = "";
    sock.write("Grbl 1.1h ['$' for help]\r\n");
    sock.on("data", (b) => { for (const ch of b.toString("latin1")) {
      if (ch === "?") { sock.write(`<${state}|MPos:3.000,4.000,0.000|FS:0,0>\r\n`); continue; }
      if (ch === "!") { rt.push("!"); state = "Hold:0"; continue; }
      if (ch === "~") { rt.push("~"); state = "Run"; continue; }
      if (ch === "\x18") { rt.push("reset"); state = "Idle"; buf = ""; sock.write("\r\nGrbl 1.1h ['$' for help]\r\n"); continue; }
      if (ch === "\n") { const line = buf.trim(); buf = ""; if (!line) continue; got.push(line); setTimeout(() => { if (!sock.destroyed) sock.write("ok\r\n"); }, delay); continue; }
      if (ch !== "\r") buf += ch;
    } });
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, port: srv.address().port, got, rt })));
}
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  const g = await fakeGrbl(25);
  const state = () => ev(() => window.imageEditorInstance.E.laser.linkStatus());
  const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 8000)) { if (await f()) return true; await p.waitForTimeout(100); } return false; };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.laser && window.imageEditorInstance.E.laser.connect, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => fetch("/api/laser/link/disconnect", { method: "POST" }));
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => document.getElementById("kxFull").click()); await p.waitForTimeout(800);
    await ev(() => {
      const E = window.imageEditorInstance.E, D = window.PCDoc;
      E.pages.newDocument({ preset: "Custom", wmm: 100, hmm: 80, orient: "landscape", dpi: 127 }, 1, "Coaster");
      const L = E.makeLayer("Ring", E.S.w, E.S.h, "shape"); L.shape = Object.assign({}, D.SHAPE_DEFAULT || {}, { kind: "ellipse", x: 100, y: 50, w: 300, h: 300, fill: "#000000", fillOn: true, strokeOn: false }); D.rasterize(L); E.addLayer(L, "ring", false);
      L.laser = { op: "line", power: 70, speed: 900, passes: 1 };
      const P = E.makeLayer("Photo", E.S.w, E.S.h); const gg = P.canvas.getContext("2d"); gg.fillStyle = "#555"; gg.fillRect(150, 150, 200, 100); E.addLayer(P, "photo", false);
      P.laser = { op: "image", power: 40, speed: 3000, interval: 1, dither: "floyd" };
      E.ui.run("win.laser");
    });
    await p.waitForTimeout(700);

    /* 1 connect over Wi-Fi */
    await ev((port) => { const k = document.getElementById("lzKind"); k.value = "tcp"; k.dispatchEvent(new Event("change")); document.getElementById("lzHost").value = "127.0.0.1"; document.getElementById("lzTcpPort").value = String(port); }, g.port);
    const stopHidden = await ev(() => document.getElementById("lzStopTop").style.display === "none");
    await p.click("#lzConnect");
    await until(async () => { const s = await state(); return s && s.connected && s.machine.state; });
    let st = await state(), label = await ev(() => document.getElementById("lzLinkState").textContent);
    check("🔌 Connect over Wi-Fi (TCP): bitGen's server connects, GRBL's status shows (Idle, X3 Y4); the title-bar ■ STOP appears", st.connected && st.kind === "tcp" && /Idle/.test(label) && /X3 Y4/.test(label) && stopHidden && (await ev(() => document.getElementById("lzStopTop").style.display === "")), { label, stopHidden });

    /* 2 frame (laser off) */
    await p.click("#lzFrame");
    await until(() => g.got.filter((l) => /^G0 X/.test(l)).length >= 5);
    check("▭ Frame: the job's box traced with G0 moves (laser off)", g.got.filter((l) => /^G0 X/.test(l)).length >= 5 && !g.got.some((l) => /^M3/.test(l)), g.got.slice(-6));

    /* 3 start: asks first */
    await p.click("#lzStart"); await p.waitForTimeout(400);
    const asked = await ev(() => !!document.getElementById("lzConfirm") && /about to fire/.test(document.getElementById("lzConfirm").textContent));
    await p.click("#lzNo"); await p.waitForTimeout(300);
    const notStarted = !((await state()).job && (await state()).job.running);
    check("▶ Start asks first (the laser is about to fire) - Cancel starts nothing", asked && notStarted);
    const before = g.got.length;
    await p.click("#lzStart"); await p.waitForTimeout(300); await p.click("#lzYes");
    await until(async () => { const s = await state(); return s.job && s.job.running && s.job.done > 20; });
    st = await state();
    check("…▶ Start the job: the G-code saved and streamed by the server (GRBL header first, progress counting)", st.job.running && /Coaster\.gcode/.test(st.job.name) && g.got.slice(before, before + 3).join("|") === "G21|G90|M4 S0" && (await ev(() => document.getElementById("lzProg").value)) > 0, { job: st.job, first: g.got.slice(before, before + 4) });
    await p.click("#lzPause"); await p.waitForTimeout(400);
    st = await state(); const n1 = st.job.done; await p.waitForTimeout(400); const n2 = (await state()).job.done;
    check("⏸ Pause: feed hold (!) sent, no more lines", g.rt.includes("!") && st.job.paused && n2 - n1 <= 1, { n1, n2 });
    await p.click("#lzResume"); await p.waitForTimeout(400);
    await shot("3-running");
    await p.click("#lzStopTop"); await p.waitForTimeout(400);
    st = await state();
    check("■ STOP (title bar): soft reset sent, the job ends 'stopped'", g.rt.includes("~") && g.rt.includes("reset") && !st.job.running && st.job.error === "stopped", st.job);

    /* 4 console */
    await ev(() => { document.getElementById("lzCmd").value = "$$"; }); await p.click("#lzSend"); await p.waitForTimeout(400);
    const log = await ev(() => document.getElementById("lzLog").textContent);
    check("console: a line sent ($$), the log shows what went out and came back", g.got.includes("$$") && /› \$\$/.test(log) && /‹ ok/.test(log), log.slice(-200));

    /* 5 SVG + PNG for other laser software */
    await p.click("#lzSvg"); await p.waitForTimeout(1500);
    const ls = await ev(() => fetch("/api/dtp/list").then((r) => r.json()));
    check("⤓ SVG + PNG: Coaster (laser SVG).zip saved (the SVG in mm + the picture layer as PNG)", ls.files.some((f) => f.name === "Coaster (laser SVG).zip"), ls.files.map((f) => f.name));
    await p.click("#lzDisconnect"); await p.waitForTimeout(300);
    check("Disconnect", !(await state()).connected);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e && e.stack)); }
  await b.close(); g.srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
