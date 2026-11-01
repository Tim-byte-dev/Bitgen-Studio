#!/usr/bin/env node
/* bitGen Studio — 2.634.0: SETUP IN COLOUR - DONE GREEN, INSTALLING LIGHT GREEN, WARNINGS ORANGE, ERRORS RED - AND "STILL
 * WORKING" WHILE A STEP IS QUIET, SO NOBODY THINKS SETUP STALLED.
 * Tim: "in the setup file report completed in green, currently installing in a lighter green, warnings in orange and errors
 * in red. when waiting installing, let the user know so they don't think the setup stalled"
 *   electron/installer.html (the setup wizard, in jsdom): tone(), step rows, log lines, the pulse line, download rows
 *   installer/tone.sh (+ its copy in install_all.sh / .command): tone_of, busy's "still ..." lines (run here)
 *   installer/tone.ps1 + bootstrap.ps1, install_all.bat, start.bat: checked as text (no Windows here) */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { JSDOM } = require("jsdom");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 30));

(async () => {
  /* ---------------- the wizard */
  const html = read("electron/installer.html");
  check("the colours: done green, running a lighter green, warnings orange, errors red", /--ok: #45c35e; --run: #aef2b9; --bad: #ef4f43; --warn: #ff9a3c/.test(html));
  let evCb = null, endInstall = null, endDl = null;
  const Gpu = require("../lib/setupGpu"), Tune = require("../lib/setupTune");
  const gpu = Gpu.profile(Gpu.parseNvidia("0, NVIDIA GeForce RTX 4090, 24564, 560.0, 8.9"), 64 * 1073741824, "win32");
  const api = {
    detect: async () => ({ platform: "win32", arch: "x64", gpu, plan: Tune.summary(gpu), recommended: [], python: "py", git: "git", ffmpeg: "", comfy: { configured: "", defaultDir: "C:\\c" }, omnivoice: false, llama: false, done: false }),
    browse: async () => "", inspect: async () => ({ ok: false }), token: async () => ({ ok: false }),
    models: async () => ({ groups: [{ id: "video", label: "Video" }], rows: [{ id: "m1", group: "video", label: "Model one", available: true, present: false, ticked: true, recommended: true, size: 2e9 }] }),
    disk: async () => 5e11, finish: async () => {}, skip: async () => {}, minimize: async () => {}, close: async () => {},
    install: () => new Promise((r) => { endInstall = r; }), download: () => new Promise((r) => { endDl = r; }),
    onEvent: (cb) => { evCb = cb; },
  };
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, beforeParse(w) { w.h3setup = api; } });
  const w = dom.window, $ = (id) => w.document.getElementById(id);
  await tick(60);
  const T = (l, e) => w.eval("tone")(l, e);
  check("tone(): our own [ok] / [..] / [warn] / [skip] / [error] lines", T("[ok] Python 3.12") === "ok" && T("[..] 3 node packs to add") === "run" && T("[warn] KJNodes: clone failed", true) === "warn" && T("[skip] Klein: gated", true) === "warn" && T("[error] could not fetch ComfyUI", true) === "err");
  check("tone(): pip / git output - Successfully installed green, Collecting / Cloning light green, WARNING orange, ERROR red",
    T("Successfully installed torch-2.7") === "ok" && T("Collecting numpy", true) === "run" && T("Cloning into 'ComfyUI'...", true) === "run" && T("WARNING: pip is out of date", true) === "warn" && T("ERROR: No matching distribution", true) === "err");
  check("tone(): a program's stderr is not an error by itself (git / pip progress) - plain", T("remote: Counting objects: 100% (5/5)", true) === "" && T("  Resolved https://github.com/x", true) === "");
  // page 1 -> Install (the plan's steps listed)
  if ($("cb_llama")) $("cb_llama").checked = false;
  $("b_install").onclick(); await tick();
  check("Install: the installing page, the pulse line under the bar", (w.document.querySelector(".page.on") || {}).id === "pg_install" && !!$("ipulse"));
  evCb({ type: "step", id: "python", state: "run" });
  evCb({ type: "log", line: "[..] setting up Python", err: false });
  evCb({ type: "step", id: "python", state: "ok" });
  evCb({ type: "step", id: "comfy", state: "run" });
  evCb({ type: "log", line: "Collecting torch", err: true });
  evCb({ type: "log", line: "[warn] something odd", err: true });
  evCb({ type: "log", line: "[error] it broke", err: true });
  evCb({ type: "log", line: "remote: Counting objects", err: true });
  await tick();
  const cls = [...$("ilog").children].map((s) => s.className);
  check("the log: light green, orange, red - and git's stderr plain (not red)", cls.slice(-5).join() === "run,run,warn,err,", cls);
  check("the steps: Python done (green), ComfyUI installing (light green, a turning icon)", $("st_python").className === "ok" && $("st_comfy").className === "run" && /h3spin/.test(html) && /\.slist li\.run \{ color: var\(--run\)/.test(html));
  w.eval("pulseTick()");
  check("the pulse: what is installing + for how long", /Installing ComfyUI…/.test($("ipulse").textContent) && /· \d+ s/.test($("ipulse").textContent), $("ipulse").textContent);
  w.eval("PULSE.last = Date.now() - 45000; PULSE.t0 = Date.now() - 200000; pulseTick()");
  const q = $("ipulse").textContent;
  check("quiet for 45 s: \"Still working - no new output for 45 s\", why (ComfyUI + PyTorch are several GB), \"Setup has not stalled\"; its row shows the time",
    /Still working - no new output for 45 s/.test(q) && /PyTorch are several GB/.test(q) && /has not stalled/.test(q) && /3m 20s/.test(q) && /3m 20s/.test($("st_comfy").textContent), q);
  w.eval("PULSE.last = Date.now() - 700000; pulseTick()");
  check("quiet for over 10 min: says where to look (connection, setup.log) - in orange", /check your internet connection and setup\.log/.test($("ipulse").textContent) && $("ipulse").classList.contains("long"), $("ipulse").textContent);
  evCb({ type: "sub", id: "comfy", label: "PyTorch" }); w.eval("pulseTick()");
  check("a step's part (sub) shows in the pulse and its row", /Installing ComfyUI - PyTorch…/.test($("ipulse").textContent) && /PyTorch · /.test($("st_comfy").textContent), $("ipulse").textContent);
  evCb({ type: "step", id: "comfy", state: "warn", error: "2 packs failed" });
  evCb({ type: "step", id: "packs", state: "err", error: "no git" });
  check("a step with warnings orange, a failed one red", $("st_comfy").className === "warn" && $("st_packs").className === "err" && /\.slist li\.warn \{ color: var\(--warn\)/.test(html) && /\.slist li\.err \{ color: var\(--bad\)/.test(html));
  endInstall({ ok: true, steps: {}, warnings: [] }); await tick(60);
  // downloads
  $("b_download").onclick(); await tick();
  evCb({ type: "file", id: "m1", state: "run", got: 5e8, total: 2e9 }); await tick();
  check("a model downloading: its row light green (turning)", $("d_m1").classList.contains("run"), $("d_m1").className);
  w.eval("PULSE.dlLast = Date.now() - 30000; pulseTick()");
  check("a download quiet for 30 s: \"Still downloading - no new data for 30 s ... it has not stalled\"", /Downloading Model one…/.test($("dpulse").textContent) && /Still downloading - no new data for 30 s/.test($("dpulse").textContent) && /not stalled/.test($("dpulse").textContent), $("dpulse").textContent);
  evCb({ type: "file", id: "m1", state: "ok" }); await tick();
  check("downloaded: green", $("d_m1").classList.contains("okd") && !$("d_m1").classList.contains("run"));
  endDl({ ok: true, done: ["m1"], failed: [] }); await tick(60);
  check("done: the pulse stops", !w.eval("PULSE.timer") && $("dpulse").textContent === "");
  check("the done page: notes orange, a stop's errors red", /#done_list li \{ color: var\(--warn\); \} #done_list\.err li \{ color: var\(--bad\); \}/.test(html) && /\$\("done_list"\)\.classList\.add\("err"\)/.test(html));
  w.close();

  /* ---------------- the Unix installers */
  const TONE = read("installer/tone.sh"), code = TONE.split("\n").filter((l) => !l.startsWith("#")).join("\n").trim();
  const IA = read("install_all.sh");
  check("install_all.sh carries installer/tone.sh's code exactly (it runs on its own, before the app is there)", IA.includes(code) && read("install_all.command") === IA);
  check("bootstrap.sh sources installer/tone.sh (a plain fallback without it); downloads / npm / pip run through busy", /\. "\$HERE\/tone\.sh"/.test(read("installer/bootstrap.sh")) && (read("installer/bootstrap.sh").match(/busy "/g) || []).length >= 7);
  if (process.platform !== "win32") {
    const T2 = fs.mkdtempSync(path.join(os.tmpdir(), "tone634_"));
    const sc = path.join(T2, "t.sh");
    fs.writeFileSync(sc, `. "${path.join(R0, "installer", "tone.sh")}"\nC_OK=G; C_RUN=L; C_WARN=O; C_ERR=R\nfor l in "[ok] x" "[..] y" "WARNING: z" "ERROR: q" "plain" "bootstrap done" "     more"; do printf '%s|' "$(tone_of "$l")"; done; echo\nTONE_EVERY=1 busy "testing" sleep 2.5; echo "rc=$?"\nbusy "failing" sh -c 'exit 3'; echo "rc=$?"\n`);
    const { spawnSync } = require("child_process");
    const t0 = Date.now(), r = spawnSync("sh", [sc], { encoding: "utf8", env: Object.assign({}, process.env, { NO_COLOR: "" }) }), took = Date.now() - t0;
    const lines = r.stdout.split("\n");
    check("tone_of: [ok] green, [..] light green, WARNING orange, ERROR red, plain nothing, \"… done\" green, a continuation light green", lines[0] === "G|L|O|R||G|L|", lines[0]);
    check("busy: \"... still testing (0m 1s) - it has not stalled\" while it runs, then the command's own result; it does not hang on (no left-over sleep)",
      /\.\.\. still testing \(0m 1s\) - it has not stalled/.test(r.stdout) && /\.\.\. still testing \(0m 2s\)/.test(r.stdout) && /rc=0/.test(r.stdout) && /rc=3/.test(r.stdout) && took < 8000, { out: r.stdout, took });
    const r2 = spawnSync("sh", ["-c", `. "${path.join(R0, "installer", "tone.sh")}"; printf '%s' "$C_OK"`], { encoding: "utf8" });
    check("not a terminal (a log, a pipe): no colour codes", r2.stdout === "", r2.stdout);
    fs.rmSync(T2, { recursive: true, force: true });
  }

  /* ---------------- Windows (as text) */
  const PS = read("installer/tone.ps1"), BS = read("installer/bootstrap.ps1");
  check("tone.ps1: Tone (ok / run / warn / err), Say in 256 colours on a VT console, the console's colours otherwise, plain to a log; NO_COLOR", /function Tone\(/.test(PS) && /38;5;40/.test(PS) && /38;5;157/.test(PS) && /38;5;208/.test(PS) && /38;5;196/.test(PS) && /IsOutputRedirected/.test(PS) && /SupportsVirtualTerminal/.test(PS) && /DarkGreen/.test(PS) && /NO_COLOR/.test(PS) && !/[^\x00-\x7f]/.test(PS));
  check("bootstrap.ps1 dot-sources it (fallback without), its steps tagged [..] / [ok], the quiet ones say \"it has not stalled\"", /\. \$tonePs/.test(BS) && (BS.match(/Say "\[ok\]|Say \("\[ok\]/g) || []).length >= 8 && (BS.match(/has not stalled/g) || []).length >= 4 && !/[^\x00-\x7f]/.test(BS));
  for (const f of ["install_all.bat", "start.bat"]) {
    const B = read(f);
    check(f + ": VT colours (done green, working light green, WARN orange, ERROR red; NO_COLOR) on every [ok] / [..] / [WARN] / [ERROR] line + :long \"it has not stalled\"",
      /prompt #\$H#\$E#/.test(B) && /if not defined NO_COLOR if defined ESC/.test(B) && /C_RUN=%ESC%\[38;5;157m/.test(B) && !/^\s*(?:.* do |if .* )?echo \[(ok|\.\.|WARN|ERROR)\]/m.test(B)
      && /^:long\r?$/m.test(B) && /it has not stalled/.test(B) && (B.match(/call :long "/g) || []).length >= 3);
  }
  check("install_all.bat is still CRLF (downloaded on its own)", /\r\n/.test(fs.readFileSync(path.join(R0, "install_all.bat"), "latin1")) && !/[^\r]\n/.test(fs.readFileSync(path.join(R0, "install_all.bat"), "latin1")));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
