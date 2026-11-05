#!/usr/bin/env node
/* bitGen Studio — 2.669.0: ComfyUI CLEARED (misc\clear-comfy.bat) BEFORE A ComfyUI UPDATE AND WHEN bitGen Studio EXITS, EVERY
 * bitGen Studio PROCESS ENDED, THE TERMINAL WINDOW CLOSED - lib/clearComfy.js, lib/exitSweep.js, lib/comfyUpdate.js, the
 * shutdown route, lib/comfy.js's exit hooks, electron/main.js, start.bat. A real process is ended here (Linux / macOS);
 * on Windows the same code runs taskkill and the .bat.
 * Tim (verbatim): "when in settings-comfyui update run the misc\clear-comfy script to clear comfy ui completely, when bitgen
 * exits run that script , clear all bitgen process and close the terminal window" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const CC = require(path.join(ROOT, "lib", "clearComfy.js"));
const XS = require(path.join(ROOT, "lib", "exitSweep.js"));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  /* 1 clear-comfy.bat - run hidden, without its "press any key" */
  const BAT = read("misc/clear-comfy.bat");
  check("misc\\clear-comfy.bat: /nopause skips the closing pause (the app runs it itself)", /\/nopause/.test(BAT) && /set "NOPAUSE=1"/.test(BAT) && /if "!NOPAUSE!"=="0" pause/.test(BAT) && !/^pause\s*$/m.test(BAT.replace(/\r/g, "")));
  check("clearComfy.args: [the ComfyUI folder] /nostart /nopause", JSON.stringify(CC.args("E:\\ComfyUI")) === '["E:\\\\ComfyUI","/nostart","/nopause"]' && JSON.stringify(CC.args("")) === '["/nostart","/nopause"]');
  const calls = [];
  const fakeSpawn = (cmd, args, o) => { calls.push({ cmd, args, o }); const { EventEmitter } = require("events"); const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter();
    setTimeout(() => { p.stdout.emit("data", "\r\n================= bitGen Studio : clear ComfyUI =================\r\n[1/4] stopping ComfyUI processes...\r\n      killing PID 4242\r\n"); p.emit("close", 0); }, 10); return p; };
  const got = [];
  const bat = path.join(ROOT, "misc", "clear-comfy.bat");
  const r1 = await CC.run({ platform: "win32", dir: "E:\\ComfyUI", spawn: fakeSpawn, log: (l) => got.push(l), bat });
  check("clearComfy.run on Windows: cmd.exe /c \"…\\clear-comfy.bat\" \"E:\\ComfyUI\" /nostart /nopause, hidden; its lines to the log (the ===== rule left out)", r1.ok && calls[0].cmd === "cmd.exe" && /clear-comfy\.bat" "E:\\ComfyUI" \/nostart \/nopause"$/.test(calls[0].args[3]) && calls[0].o.windowsHide === true && got.join("|") === "[1/4] stopping ComfyUI processes...|      killing PID 4242", { a: calls[0] && calls[0].args, got });
  const r2 = CC.runSync({ platform: "win32", dir: "", bat, spawnSync: (cmd, args, o) => { calls.push({ cmd, args, o }); return { status: 0, stdout: "[4/4] checking...\r\n      :8188 is free\r\n", stderr: "" }; } });
  check("clearComfy.runSync (the exit): waited for, its lines kept, a timeout", r2.ok && r2.lines.length === 2 && calls[1].o.timeout > 0 && /\/nostart \/nopause"$/.test(calls[1].args[3]), r2);
  // the caches it deletes (Linux / macOS do it here): temp, __pycache__, the Manager's cache - never models / output / input / user
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "cc669-")), mk = (p) => fs.mkdirSync(path.join(T, p), { recursive: true });
  ["ComfyUI/main.py"].forEach((f) => { mk(path.dirname(f)); fs.writeFileSync(path.join(T, f), ""); });
  ["ComfyUI/temp", "ComfyUI/comfy/__pycache__", "ComfyUI/custom_nodes/pack/__pycache__", "ComfyUI/custom_nodes/ComfyUI-Manager/cache", "ComfyUI/models/__pycache__", "ComfyUI/output/__pycache__", "ComfyUI/user/x/__pycache__"].forEach(mk);
  const C = CC.cachesOf(T).map((p) => path.relative(T, p).replace(/\\/g, "/")).sort();
  check("cachesOf: temp, every __pycache__, ComfyUI-Manager's cache - not inside models / output / user", JSON.stringify(C) === JSON.stringify(["ComfyUI/comfy/__pycache__", "ComfyUI/custom_nodes/ComfyUI-Manager/cache", "ComfyUI/custom_nodes/pack/__pycache__", "ComfyUI/temp"]), C);
  // Linux / macOS: a real "ComfyUI" process ended, the caches gone
  const py = cp.spawn("python3", ["-c", "import time; time.sleep(60)", path.join(T, "ComfyUI", "main.py")], { stdio: "ignore" });
  await wait(300);
  const r3 = await CC.run({ platform: "linux", dir: T, log: () => {} });
  await wait(300);
  check("clearComfy on Linux: a running ComfyUI (python …/ComfyUI/main.py) ended, its caches deleted, models untouched", r3.ok && !alive(py.pid) && !fs.existsSync(path.join(T, "ComfyUI", "temp")) && !fs.existsSync(path.join(T, "ComfyUI", "comfy", "__pycache__")) && fs.existsSync(path.join(T, "ComfyUI", "models", "__pycache__")), { r3: r3.lines, alive: alive(py.pid) });
  try { py.kill("SIGKILL"); } catch { /* gone */ }

  /* 2 the exit sweep - which processes go */
  const L = [
    { pid: 10, name: "node.exe", cmd: "\"C:\\bitGen\\runtime\\node\\node.exe\" C:\\bitGen\\misc\\server.js" },          // the server itself
    { pid: 11, name: "electron.exe", cmd: "C:\\bitGen\\node_modules\\electron\\dist\\electron.exe C:\\bitGen\\electron" },
    { pid: 12, name: "python.exe", cmd: "python C:\\bitGen\\misc\\worker.py --job 3" },
    { pid: 13, name: "llama-server.exe", cmd: "C:\\BitGen\\runtime\\llama\\llama-server.exe -m x.gguf" },
    { pid: 14, name: "cmd.exe", cmd: "C:\\Windows\\system32\\cmd.exe /c \"\"C:\\bitGen\\start.bat\" \"" },
    { pid: 15, name: "python.exe", cmd: "C:\\bitGen\\comfy\\python_embeded\\python.exe -s ComfyUI\\main.py --windows-standalone-build" },
    { pid: 16, name: "python.exe", cmd: "python D:\\other\\script.py" },
    { pid: 17, name: "ffmpeg.exe", cmd: "C:\\bitGen\\runtime\\ffmpeg\\bin\\ffmpeg.exe -i a.mp4 b.mp4" },
    { pid: 18, name: "conhost.exe", cmd: "\\??\\C:\\Windows\\system32\\conhost.exe 0x4" },
    { pid: 19, name: "notepad.exe", cmd: "notepad C:\\bitGenOther\\x.txt" },
  ];
  const t1 = XS.targets(L, { base: "C:\\bitGen", self: 10, parent: 11, platform: "win32" }).sort((a, b) => a - b);
  check("targets (Windows): the workers, llama-server, ffmpeg, the ComfyUI in the folder - not the server, Electron, the console (start.bat closes itself), other folders (C:\\bitGenOther too); the folder's case ignored", JSON.stringify(t1) === "[12,13,15,17]", t1);
  check("…'Leave ComfyUI running' on: its ComfyUI is kept", JSON.stringify(XS.targets(L, { base: "C:\\bitGen", self: 10, parent: 11, platform: "win32", keepComfy: true }).sort((a, b) => a - b)) === "[12,13,17]");
  const t2 = XS.targets([{ pid: 5, name: "python3", cmd: "/opt/bitgen/venv/bin/python3 /opt/bitgen/misc/music_worker.py" }, { pid: 6, name: "bash", cmd: "bash /opt/bitgen/misc/bitgen-studio.sh" }, { pid: 7, name: "node", cmd: "node /opt/bitgen-old/misc/server.js" }], { base: "/opt/bitgen/", self: 1, parent: 2, platform: "linux" });
  check("targets (Linux): the worker - not the launcher's shell, not another folder", JSON.stringify(t2) === "[5]", t2);
  check("targets: no folder / a root folder = nothing (never a blind sweep)", XS.targets(L, { base: "C:", platform: "win32" }).length === 0 && XS.targets(L, { base: "", platform: "win32" }).length === 0);

  /* 3 run(): clear-comfy, then the processes; once */
  const ev = [];
  const fake = (keepAlive, clearOnExit) => ({ comfy: { shutdownAll: (r) => ev.push("shutdownAll:" + r), comfyCfg: () => ({ keepAlive, clearOnExit: clearOnExit !== false }) }, clear: { runSync: () => { ev.push("clear"); return { ok: true }; } }, list: L, kill: (p) => { ev.push("kill:" + p.join(",")); return p; }, base: "C:\\bitGen", platform: "win32", force: true, self: 10, parent: 11, log: () => {} });
  XS._reset(); const s1 = XS.run("app quit", fake(false)); const s1b = XS.run("again", fake(false));
  check("run: ComfyUI's own stop, then misc\\clear-comfy.bat, then bitGen Studio's processes - once only", JSON.stringify(ev) === JSON.stringify(["shutdownAll:app quit", "clear", "kill:12,13,15,17"]) && s1.cleared && s1b === s1, ev);
  ev.length = 0; XS._reset(); XS.run("SIGHUP", fake(true));
  check("…'Clear ComfyUI completely when bitGen Studio exits' (default on) outranks 'Leave ComfyUI running': cleared, its ComfyUI ended", JSON.stringify(ev) === JSON.stringify(["shutdownAll:SIGHUP", "clear", "kill:12,13,15,17"]), ev);
  ev.length = 0; XS._reset(); XS.run("SIGHUP", fake(true, false));
  check("…the clear off + 'Leave ComfyUI running' on: no clear, its ComfyUI not ended", JSON.stringify(ev) === JSON.stringify(["shutdownAll:SIGHUP", "kill:12,13,17"]), ev);
  ev.length = 0; XS._reset(); const s3 = XS.run("exit", Object.assign(fake(false), { force: false }));
  check("…anywhere but the app's server (a test, a script requiring lib/comfy.js): ComfyUI's own stop only - nothing else ended", JSON.stringify(ev) === '["shutdownAll:exit"]' && s3.swept === false, { ev, s3 });
  // a REAL process ended (Linux / macOS here): a "worker" run from a bitGen folder
  const B = fs.mkdtempSync(path.join(os.tmpdir(), "bg669-")); fs.mkdirSync(path.join(B, "misc"));
  const w = cp.spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)", path.join(B, "misc", "worker.py")], { stdio: "ignore" });
  await wait(300);
  XS._reset(); const s4 = XS.run("app quit", { force: true, base: B, comfy: { shutdownAll: () => {}, comfyCfg: () => ({ keepAlive: true, clearOnExit: false }) }, log: () => {} });
  await wait(300);
  check("a real process run from the bitGen folder is ended (and this test, not from it, lives on)", s4.killed.includes(w.pid) && !alive(w.pid) && alive(process.pid), s4);
  try { w.kill("SIGKILL"); } catch { /* gone */ }
  XS._reset();
  fs.rmSync(T, { recursive: true, force: true }); fs.rmSync(B, { recursive: true, force: true });

  /* 4 the wiring */
  const RI = read("routes/index.js"), CJ = read("lib/comfy.js"), EM = read("electron/main.js"), SB = read("start.bat").replace(/\r/g, ""), CU = read("lib/comfyUpdate.js"), XJ = read("lib/exitSweep.js");
  check("POST /api/shutdown runs the exit sweep (lib/exitSweep.js) before exiting; Ctrl+C / closing the console / Electron gone too (lib/comfy.js)", /require\("\.\.\/lib\/exitSweep"\)\.run\("app quit"\)/.test(RI) && /require\("\.\/exitSweep"\)\.run\(sig\)/.test(CJ) && /require\("\.\/exitSweep"\)\.run\("parent gone"\)/.test(CJ) && /process\.on\("exit", \(\) => \{ shutdownAll\("exit"\); \}\)/.test(CJ));
  check("never in the e2e test server unless H3_EXIT_SWEEP=1; only in misc/server.js", /H3_E2E !== "1" \|\| process\.env\.H3_EXIT_SWEEP === "1"/.test(XJ) && /server\\\.js\$/.test(XJ));
  check("Electron waits for its server to finish the sweep (its exit, 60 s at most) before quitting", /server\.once\("exit", done\)/.test(EM) && /setTimeout\(done, 60000\)/.test(EM));
  check("start.bat closes its window when the app has gone (exit, not exit /b)", /:done\n\npopd\n(::[^\n]*\n)*exit 0\n/.test(SB), SB.slice(SB.indexOf(":done"), SB.indexOf(":done") + 300));
  const IH = read("static/index.html"), CO = read("lib/comfy.js");
  check("Settings ▸ ComfyUI: 'Clear ComfyUI completely when bitGen Studio exits' (s_cclear, engine.comfy.clear_on_exit, default on)", /id="s_cclear" checked/.test(IH) && /clear_on_exit: \$\("s_cclear"\)/.test(IH) && /clearOnExit: c\.clear_on_exit !== false/.test(CO) && /clear_on_exit: true/.test(read("lib/core.js")));
  check("⤓ Update ComfyUI clears ComfyUI first (lib/clearComfy.js - misc\\clear-comfy.bat)", /require\("\.\/clearComfy"\)/.test(CU) && /CC\.run\(\{ dir: W\.main \|\| W\.root/.test(CU));
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
