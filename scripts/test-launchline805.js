#!/usr/bin/env node
/* bitGen Studio — 2.805.0 units: a card's own ComfyUI from a .bat / .sh launcher or a custom launch command (lib/comfyLaunchLine.js,
 * lib/gpuCards.js launchFor) - Tim: "in gpu docker, when i select one of my gpu, it fails, when i select local it works".
 * Pure + source pins - no studio, no graphics card. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const ROOT = path.join(__dirname, "..");
const LL = require("../lib/comfyLaunchLine"), GC = require("../lib/gpuCards");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const W = "C:\\AI\\ComfyUI_windows_portable";
const hasW = (set) => (f) => set.includes(f);

check("tokens: quotes keep spaces", JSON.stringify(LL.tokens('"C:\\a b\\python.exe" -s main.py \'x y\'')) === JSON.stringify(["C:\\a b\\python.exe", "-s", "main.py", "x y"]));

// ComfyUI portable's own run_nvidia_gpu.bat
const bat = ".\\python_embeded\\python.exe -s ComfyUI\\main.py --windows-standalone-build\r\necho If you see this and ComfyUI did not start try updating your Nvidia Drivers to the latest.\r\npause\r\n";
const a = LL.fromScript(bat, W, "win32", hasW([]), "run_nvidia_gpu.bat");
check("portable run_nvidia_gpu.bat -> its python + main.py, absolute, its flags kept", a && a.cmd === W + "\\python_embeded\\python.exe" && a.args.join(" ") === "-s " + W + "\\ComfyUI\\main.py --windows-standalone-build" && a.cwd === W && /run_nvidia_gpu\.bat/.test(a.how), a);
const fast = LL.fromScript(".\\python_embeded\\python.exe -s ComfyUI\\main.py --windows-standalone-build --fast fp16_accumulation --port 8188 --cuda-device=0\r\npause", W, "win32", hasW([]));
check("the launcher's own --fast kept; its --port / --cuda-device dropped (the card's come after)", fast && fast.args.join(" ") === "-s " + W + "\\ComfyUI\\main.py --windows-standalone-build --fast fp16_accumulation", fast);
const dp0 = LL.fromScript('@echo off\r\nREM main.py is started below\r\n"%~dp0python_embeded\\python.exe" -s "%~dp0ComfyUI\\main.py" --use-sage-attention %*', W, "win32", hasW([]));
check("%~dp0, @echo off, REM lines, %* handled", dp0 && dp0.cmd === W + "\\python_embeded\\python.exe" && dp0.args.join(" ") === "-s " + W + "\\ComfyUI\\main.py --use-sage-attention", dp0);
const cdl = LL.fromScript("cd /d %~dp0ComfyUI\r\n..\\python_embeded\\python.exe main.py --lowvram", W, "win32", hasW([]));
check("cd before the python line moves where its relative paths start", cdl && cdl.cmd === W + "\\python_embeded\\python.exe" && cdl.args[0] === W + "\\ComfyUI\\main.py" && cdl.cwd === W + "\\ComfyUI", cdl);
const venv = LL.fromScript("call venv\\Scripts\\activate.bat && python main.py --listen", "D:\\ComfyUI", "win32", hasW(["D:\\ComfyUI\\venv\\Scripts\\python.exe"]));
check("an activated venv's bare python = the venv's python.exe", venv && venv.cmd === "D:\\ComfyUI\\venv\\Scripts\\python.exe" && venv.args.join(" ") === "D:\\ComfyUI\\main.py --listen", venv);
const sh = LL.fromScript('#!/bin/sh\ncd "$(dirname "$0")"\nexec ./venv/bin/python main.py --preview-method auto "$@" > comfy.log 2>&1\n', "/opt/comfy", "linux", hasW([]));
check("run.sh: exec, $@, a redirection, cd $(dirname $0)", sh && sh.cmd === "/opt/comfy/venv/bin/python" && sh.args.join(" ") === "/opt/comfy/main.py --preview-method auto", sh);
check("a variable we cannot know -> null (then ComfyUI's own layout)", LL.fromScript("%PYTHON% main.py", W, "win32", hasW([])) === null);
check("no main.py line (a launcher that calls another program) -> null", LL.fromScript("start ComfyUI.exe\r\npause", W, "win32", hasW([])) === null);
check("a custom launch command line is read the same way", (LL.fromScript("python_embeded\\python.exe -s ComfyUI\\main.py --highvram", W, "win32", hasW([])) || {}).args.join(" ") === "-s " + W + "\\ComfyUI\\main.py --highvram");
const dir = LL.direct(W, "win32", hasW([W + "\\python_embeded\\python.exe", W + "\\ComfyUI\\main.py"]));
check("direct(): ComfyUI portable's layout when the launcher has no python line", dir && /python_embeded\\python\.exe$/.test(dir.cmd) && dir.args.includes("--windows-standalone-build"), dir);
check("direct(): nothing known -> null", LL.direct(W, "win32", hasW([])) === null);

// gpuCards.launchFor: the .bat is read from the ComfyUI folder (a real temp folder, this platform's paths)
const T = fs.mkdtempSync(path.join(os.tmpdir(), "ll805-"));
fs.writeFileSync(path.join(T, "run_nvidia_gpu.bat"), "./python_embeded/python.exe -s ComfyUI/main.py --windows-standalone-build --fast\npause\n");
const lf = GC.launchFor({ dir: T }, T, { shellCmd: "run_nvidia_gpu.bat", cwd: T, how: "run_nvidia_gpu.bat" });
check("launchFor: the .bat detectLaunch found is read for its python line", lf && lf.cmd === path.resolve(T, "python_embeded/python.exe") && lf.args.includes("--fast") && !lf.error, lf);
const L = GC.argsFor(lf, 1);
check("argsFor after launchFor: + --port 8190 --cuda-device 1 (the old refusal is gone)", L && !L.error && L.args.slice(-4).join(" ") === "--port 8190 --cuda-device 1", L);
const none = GC.launchFor({ dir: T, launch: "start something.exe" }, T, { shellCmd: "start something.exe", cwd: T, how: "custom launch command" });
check("launchFor: nothing to go on -> a clear error naming the launch command", none && /no python \.\.\. main\.py line/.test(none.error) && /launch command/.test(none.error), none);
check("argsFor passes launchFor's error on", /no python/.test(GC.argsFor(none, 0).error));
check("launchFor: a plain python + main.py launch is left as it is", GC.launchFor({ dir: T }, T, { cmd: "/x/python", args: ["main.py"], cwd: T }).cmd === "/x/python");
fs.rmSync(T, { recursive: true, force: true });

check("pins: gpuCards.launchOf uses launchFor; remoteHosts' card note says a launch problem at once",
  /argsFor\(launchFor\(cfg, dir, C\.detectLaunch\(dir\)\)/.test(src("lib/gpuCards.js")) && /launchProblem\(n\)/.test(src("lib/remoteHosts.js")));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
