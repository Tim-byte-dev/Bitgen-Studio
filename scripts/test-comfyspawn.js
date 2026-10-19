#!/usr/bin/env node
// The ENVIRONMENT we hand a ComfyUI we launch. Run: node scripts/test-comfyspawn.js
//
// WHY THIS IS WORTH A TEST OF ITS OWN. We spawn ComfyUI with piped stdio and no
// console, so Python block-buffers its streams — and ComfyUI-Manager's
// prestartup wrapper flushes that handle, which is the documented site of
// "OSError: [Errno 22] Invalid argument" on Windows. It surfaces mid-sampling,
// because that is when tqdm starts writing progress to stderr. Tim's renders
// died exactly there, inside SamplerCustomAdvanced, on graphs that were fine.
//
// The env vars are invisible: nothing in the UI shows them and no other test
// would notice them disappearing in a refactor. Hence this.
const fs = require("fs");
const PAGE = require("../lib/extensions").pageHtml(require("path").join(__dirname, ".."));

const path = require("path");

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

const SRC = fs.readFileSync(path.join(__dirname, "..", "lib", "comfy.js"), "utf8");

check("the launch environment is built from the real one, not replaced",
  /const env = \{ \.\.\.process\.env,/.test(SRC),
  "replacing env would strip PATH and CUDA_VISIBLE_DEVICES and ComfyUI would not start");
check("PYTHONUNBUFFERED is set for the ComfyUI we launch",
  /PYTHONUNBUFFERED: "1"/.test(SRC),
  "block-buffered stderr + ComfyUI-Manager's flush wrapper = OSError Errno 22 mid-sampling");
check("PYTHONIOENCODING defaults to utf-8",
  /PYTHONIOENCODING: process\.env\.PYTHONIOENCODING \|\| "utf-8"/.test(SRC),
  "cp1252 stderr dies on one non-ASCII character in a model name or prompt");
check("TQDM_DISABLE is set, removing the writer whose flush fails",
  /TQDM_DISABLE: process\.env\.TQDM_DISABLE \|\| "1"/.test(SRC),
  "no progress bar, no mid-sampling stderr burst, no flush to die on — and job "
  + "progress reaches the UI over the websocket, which does not go through tqdm");
check("...but an explicit PYTHONIOENCODING from the user still wins",
  /process\.env\.PYTHONIOENCODING \|\|/.test(SRC),
  "overriding somebody's deliberate encoding choice would be rude and unexplainable");

/* Every spawn INSIDE start() has to carry it, not just the one that was easiest
   to edit. Scoped to start(): the file also spawns pip and a PowerShell folder
   picker, and neither launches ComfyUI — a check that swept those in would fail
   for the wrong reason, which is worse than not checking at all. */
{
  const fn = SRC.slice(SRC.indexOf("async function start("));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  // 2.100.0: the spawn options are spread from lib/comfyStdio.js (`...so`) and
  // the env is still passed explicitly beside them, so the match runs to the
  // closing paren even though the option object spans lines.
  const spawns = body.match(/spawn\([^;]*?\}\)/gs) || [];
  check("every spawn in the launch path passes the env",
    spawns.length >= 3 && spawns.every((c) => /env/.test(c)),
    spawns.map((c) => c.replace(/\s+/g, " ").slice(0, 90)));
}
// the shell path on Windows goes through cmd.exe, which is the one most easily
// forgotten because the env has to survive an extra hop
check("the Windows cmd.exe path carries it too",
  /spawn\("cmd\.exe",[^)]*env \}\)/s.test(SRC), null);
check("and the POSIX shell path", /spawn\("sh",[^)]*env \}\)/s.test(SRC), null);

/* ---- 2.100.0: NO PIPES AT ALL ----
   A ComfyUI with piped stdio and no console is the configuration whose stderr
   flush raises [Errno 22] mid-sampling on Windows (ComfyUI-Manager #2458), and
   an undrained pipe stalls it outright. stdout/stderr now go to a FILE that is
   tailed into the app log, or to a real console window — lib/comfyStdio.js. */
const STDIO = require(path.join(__dirname, "..", "lib", "comfyStdio.js"));
check("the launch path never creates a stdio pipe",
  !/proc\.stdout\.on\(/.test(SRC) && !/proc\.stderr\.on\(/.test(SRC)
  && /stdio\.spawnOptions\(/.test(SRC), "pipes are back");
check("stdio mode defaults to file and rejects junk",
  STDIO.stdioMode({}) === "file" && STDIO.stdioMode({ stdio: "pipe" }) === "file"
  && STDIO.stdioMode({ stdio: "Console" }) === "console", null);
{
  const fo = STDIO.spawnOptions("file", { cwd: "/x", env: { TQDM_DISABLE: "1", A: "b" }, fd: 7 });
  check("file mode: stdout+stderr are the file descriptor, stdin ignored, hidden window",
    Array.isArray(fo.stdio) && fo.stdio[0] === "ignore" && fo.stdio[1] === 7 && fo.stdio[2] === 7
    && fo.windowsHide === true && !fo.detached, fo);
  check("...and the launch env reaches it untouched", fo.env.TQDM_DISABLE === "1" && fo.env.A === "b", fo.env);
  const co = STDIO.spawnOptions("console", { cwd: "/x", env: { TQDM_DISABLE: "1", A: "b" }, fd: 7, userEnv: {} });
  check("console mode: detached, visible window, nothing captured",
    co.stdio === "ignore" && co.detached === true && co.windowsHide === false, co);
  check("...and TQDM is NOT disabled there (a real console can take the bar — the decisive test wants it)",
    co.env.TQDM_DISABLE === undefined && co.env.A === "b", co.env);
  const cu = STDIO.spawnOptions("console", { cwd: "/x", env: { TQDM_DISABLE: "1" }, userEnv: { TQDM_DISABLE: "1" } });
  check("...unless the user set TQDM_DISABLE themselves", cu.env.TQDM_DISABLE === "1", cu.env);
}
{
  // the tail must survive a file that does not exist yet, deliver whole lines,
  // and cope with CRLF (a Windows child) — read through a temp file for real
  const os = require("os");
  const tmp = path.join(os.tmpdir(), "h3-tail-" + process.pid + ".log");
  try { fs.unlinkSync(tmp); } catch {}
  const got = [];
  const stopT = STDIO.tailFile(tmp, (l) => got.push(l), 0);
  fs.writeFileSync(tmp, "one\r\ntwo\npart");
  check("tailFile exposes a stop() and does not throw on a missing file", typeof stopT === "function", null);
  stopT();                                        // stop() drains what is there
  check("tailFile delivers whole lines across CRLF and LF and flushes the tail on stop",
    got.join("|") === "one|two|part", got);
  try { fs.unlinkSync(tmp); } catch {}
  check("the log file lives beside the settings, named comfy.log",
    STDIO.logPath("/h3") === path.join("/h3", "comfy.log") && STDIO.LOG_NAME === "comfy.log", STDIO.logPath("/h3"));
}
check("lib/comfy.js exports relaunchConsole and the stop() kills the tail with the process",
  /relaunchConsole/.test(SRC) && /state\.stopTail/.test(SRC.slice(SRC.indexOf("function stop()"))), null);
check("the relaunch route exists — POST /api/comfy/relaunch-console — and is not in server.js",
  /app\.post\("\/api\/comfy\/relaunch-console"/.test(fs.readFileSync(path.join(__dirname, "..", "routes", "index.js"), "utf8"))
  && !/relaunch-console/.test(fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8")), null);
{
  const HTML = PAGE;
  check("Settings -> ComfyUI has the stdio choice and the relaunch button, and the Save payload carries it",
    /id="s_cstdio"/.test(HTML) && /id="s_cconsole"/.test(HTML) && /stdio: \$\("s_cstdio"\)/.test(HTML)
    && /\/api\/comfy\/relaunch-console/.test(HTML), null);
  const DEF = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "default.settings"), "utf8"));
  const CORE = require(path.join(__dirname, "..", "lib", "core.js"));
  check("the shipped default is 'file' in BOTH layers (default.settings and DEFAULT_CONFIG)",
    DEF.engine.comfy.stdio === "file" && CORE.DEFAULT_CONFIG.engine.comfy.stdio === "file", [DEF.engine.comfy.stdio, CORE.DEFAULT_CONFIG.engine.comfy.stdio]);
}

/* ---- the orphan problem (2.81.3) ----
   Quitting the app left the ComfyUI we launched running as a hidden orphan:
   Electron's before-quit called server.kill(), which on Windows is
   TerminateProcess, so the server's exit handlers — the shutdown sweep — never
   ran. Then a hand-started ComfyUI cannot bind 8188. Three layers now, and each
   line here is one that a refactor could silently drop. */
const ROUTES = fs.readFileSync(path.join(__dirname, "..", "routes", "index.js"), "utf8");
const EMAIN = fs.readFileSync(path.join(__dirname, "..", "electron", "main.js"), "utf8");
check("the server has a clean-shutdown endpoint that sweeps ComfyUI",
  /app\.post\("\/api\/shutdown"/.test(ROUTES) && /shutdownAll\("app quit"\)/.test(ROUTES),
  null);
check("...which replies BEFORE it dies, so the caller is not left hanging",
  /res\.json\(\{ ok: true, stopping: true \}\);[\s\S]{0,40}setTimeout/.test(ROUTES),
  "reply first, sweep second");
check("Electron quits THROUGH that endpoint, not over it",
  /e\.preventDefault\(\)/.test(EMAIN) && /path: "\/api\/shutdown"/.test(EMAIN),
  "server.kill() on Windows is TerminateProcess: no exit handlers run");
check("...and still quits if the server is unreachable or slow",
  /req\.on\("error", done\)/.test(EMAIN) && /req\.on\("timeout"/.test(EMAIN),
  "a dead server must not make the app unquittable");
check("Electron hands the server its pid",
  /H3_PARENT_PID: String\(process\.pid\)/.test(EMAIN), null);
check("the server watches that pid and sweeps when it vanishes",
  /process\.env\.H3_PARENT_PID/.test(SRC) && /shutdownAll\("parent gone"\)/.test(SRC),
  "Task Manager and crashes fire no before-quit at all");
check("...with a probe, not a signal, on an unref'd timer",
  /process\.kill\(ppid, 0\)/.test(SRC) && /watch\.unref\(\)/.test(SRC),
  "kill(pid,0) is liveness; a ref'd timer would keep the server immortal");


// ===== a launch that lost the port, and the status bar (2.85.1) =============
// Tim's ComfyUI dies within seconds of launching when a previous session left
// one running: WinError 10048. That reads as "ComfyUI is broken" and is really
// "ComfyUI is already running, invisibly" — the same orphan the reboots killed.
{
  const C = require(path.join(__dirname, "..", "lib", "comfy"));
  const src = fs.readFileSync(path.join(__dirname, "..", "lib", "comfy.js"), "utf8");
  check("the port-clash wording is recognised on every platform that says it",
    C.PORT_BUSY.includes("10048") && C.PORT_BUSY.some((p) => /eaddrinuse/i.test(p)),
    C.PORT_BUSY);
  check("recovery runs clear-comfy.bat rather than reimplementing the kill",
    /clear-comfy\.bat/.test(src) && /\/nostart/.test(src), null);
  check("...and it is RATE LIMITED, because it kills processes and restarts them",
    /portFightAt/.test(src) && /5 \* 60 \* 1000/.test(src), null);
  check("...and only fires on a launch that died FAST — an hour of uptime is "
    + "not a port clash whatever the log says",
    /ranFor > 60000/.test(src), null);
  check("...and the child is killed if the .bat sits on its own pause",
    /p\.kill\(\)/.test(src) && /45000/.test(src), null);
  const html = PAGE;
  // BY INSTRUCTION: no button says this. It is a state, and states live in the
  // status bar beside jobs, LLM and the address.
  check("no button is labelled with ComfyUI's run state",
    !/textContent = "[^"]*(?:Start ComfyUI|starting ComfyUI)/.test(html),
    (html.match(/textContent = "[^"]*ComfyUI[^"]*"/g) || []).slice(0, 3));
  check("there is no Start ComfyUI button left at all",
    !/id="comfyBtn"/.test(html), null);
  check("the status bar carries the three states instead",
    /ComfyUI: running/.test(html) && /ComfyUI: starting/.test(html)
    && /ComfyUI: not running/.test(html), null);
  check("...in the status bar, next to the other states",
    /id="sbcomfy"/.test(html) && html.indexOf('id="sbcomfy"') > html.indexOf('id="sbllm"'),
    null);
}

// ===== free VRAM (2.98.0) ===================================================
// The "Free VRAM now" button and the workers' clear-before-generation both end
// in ComfyUI's POST /free. The button's half lives here in lib/comfy.js and is
// reached through routes/index.js; the workers' half is scripts/comfy_client.py
// (tested in scripts/test-comfyfree.py). What can rot invisibly: the flags
// (a /free without unload_models frees nothing), the wait (the reply only
// means the flags are SET), and the default (an old config.json must stay ON).
{
  const C = require(path.join(__dirname, "..", "lib", "comfy"));
  const src = fs.readFileSync(path.join(__dirname, "..", "lib", "comfy.js"), "utf8");
  const routes = fs.readFileSync(path.join(__dirname, "..", "routes", "index.js"), "utf8");
  const core = fs.readFileSync(path.join(__dirname, "..", "lib", "core.js"), "utf8");
  check("lib/comfy.js exports freeMemory and vram", typeof C.freeMemory === "function" && typeof C.vram === "function", Object.keys(C));
  check("/free is asked for BOTH unload_models and free_memory",
    /JSON\.stringify\(\{ unload_models: true, free_memory: true \}\)/.test(src), null);
  check("...and the code WAITS for the unload to land rather than trusting the empty 200",
    /moved = true/.test(src) && /el >= 2000/.test(src) && /el >= 15000/.test(src), null);
  check("an unreachable ComfyUI is a clean {ok:false}, not a throw",
    /if \(!\(await reachable\(cfg\.url\)\)\)\s*return \{ ok: false/.test(src), null);
  check("the config default is ON and only an explicit false turns it off",
    /free_before_gen: true,/.test(core) && /freeBeforeGen: c\.free_before_gen !== false/.test(src), null);
  check("status() reports the switch and ComfyUI's own VRAM view",
    /free_before_gen: cfg\.freeBeforeGen/.test(src) && /vram: up \? await vram\(cfg\.url\) : \[\]/.test(src), null);
  check("the route exists — POST /api/comfy/free — and is not in server.js",
    /app\.post\("\/api\/comfy\/free"/.test(routes)
    && !/comfy\/free/.test(fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8")), null);
  check("...answering 503, not 200, when ComfyUI could not be asked",
    /res\.status\(j\.ok \? 200 : 503\)\.json\(j\)/.test(routes), null);
  check("fmtVram prints GB to one decimal and 'unknown' for nothing",
    C.fmtVram([{ free: 3 * 2 ** 30, total: 32 * 2 ** 30 }]) === "3.0/32.0 GB free" && C.fmtVram([]) === "unknown",
    C.fmtVram([{ free: 3 * 2 ** 30, total: 32 * 2 ** 30 }]));
}

/* 2.219.0 — start.bat's "Install ComfyUI y/N" lands the official portable
   build in <app>\comfy\, and comfyCfg() DISCOVERS it there when Settings has
   no folder configured. The discovery is functional-tested against every
   layout detectLaunch understands, and the batch/installer wiring is pinned
   by shape (a .bat cannot run on the suite's Linux). */
{
  const os = require("os");
  const C = require("../lib/comfy");
  const mk = (build) => {
    const b = fs.mkdtempSync(path.join(os.tmpdir(), "bgcomfy-"));
    build(path.join(b, "comfy"));
    return b;
  };
  const w = (p) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, ""); };

  let b = mk((d) => { w(path.join(d, "python_embeded", "python.exe")); w(path.join(d, "ComfyUI", "main.py")); });
  check("discovery: the portable layout resolves to comfy\\ (python_embeded launches it)",
    C.discoveredDir(b) === "comfy", C.discoveredDir(b));
  fs.rmSync(b, { recursive: true, force: true });

  b = mk((d) => w(path.join(d, "ComfyUI", "main.py")));
  check("discovery: a git clone in comfy\\ComfyUI resolves to THE LAUNCHABLE folder — "
    + "resolving to comfy\\ is what launched Tim's clone with system python (sqlalchemy crash)",
    C.discoveredDir(b) === "comfy/ComfyUI", C.discoveredDir(b));
  fs.rmSync(b, { recursive: true, force: true });

  b = mk((d) => w(path.join(d, "main.py")));
  check("discovery: a git-clone layout in comfy\\ is discovered",
    C.discoveredDir(b) === "comfy", C.discoveredDir(b));
  fs.rmSync(b, { recursive: true, force: true });

  b = mk((d) => w(path.join(d, "run_nvidia_gpu.bat")));
  check("discovery: a run*.bat layout in comfy\\ is discovered",
    C.discoveredDir(b) === "comfy", C.discoveredDir(b));
  fs.rmSync(b, { recursive: true, force: true });

  b = mk((d) => w(path.join(d, ".declined")));
  check("discovery: a comfy\\ holding only the declined marker is NOT a ComfyUI",
    C.discoveredDir(b) === "", C.discoveredDir(b));
  fs.rmSync(b, { recursive: true, force: true });

  b = fs.mkdtempSync(path.join(os.tmpdir(), "bgcomfy-"));
  check("discovery: no comfy folder at all discovers nothing",
    C.discoveredDir(b) === "", C.discoveredDir(b));
  fs.rmSync(b, { recursive: true, force: true });

  check("comfyCfg: an EXPLICIT Settings folder always beats discovery",
    /dir: c\.dir \|\| discoveredDir\(\),/.test(SRC), null);

  const BAT = fs.readFileSync(path.join(__dirname, "..", "start.bat"), "utf8");
  check("2.222.0 start.bat: an installed comfy\\ is noted; a missing one defers to the wizard, no prompt",
    /if exist "%~dp0comfy\\ComfyUI\\main\.py"/.test(BAT)
    && !/\[y\/N\]/.test(BAT), null);

  const PS = fs.readFileSync(path.join(__dirname, "..", "get-comfy.ps1"), "utf8");
  check("get-comfy.ps1: the OFFICIAL manual-install clone URL; Manager via requiredNodes()",
    /\$comfyRepo = "https:\/\/github\.com\/Comfy-Org\/ComfyUI\.git"/.test(PS)
    && /docs\.comfy\.org\/installation\/manual_install/.test(PS)
    && /requiredNodes\(\)/.test(PS), null);
  check("get-comfy.ps1: torch per the docs — --extra-index-url, cu130 first — and a +cu verify after",
    /--extra-index-url "https:\/\/download\.pytorch\.org\/whl\/\$cu"/.test(PS)
    && /"cu130", "cu128", "cu126"/.test(PS)
    && /-notmatch "\\\+cu"/.test(PS), null);
  check("get-comfy.ps1: warns when the MSVC redistributable the docs require is missing",
    /vcruntime140\.dll/.test(PS) && /latest-supported-vc-redist/.test(PS), null);
  check("get-comfy.ps1: the clone gets its OWN venv — deps never touch system python",
    /venv\\Scripts\\python\.exe/.test(PS) && /-m venv/.test(PS)
    && /install -r \(Join-Path \$cui "requirements\.txt"\)/.test(PS), null);
  check("get-comfy.ps1: writes run.bat (venv python + main.py) so detectLaunch #1 wins — "
    + "the system-python launch that died on sqlalchemy cannot recur",
    /run\.bat/.test(PS) && /venv\\Scripts\\python\.exe -s main\.py/.test(PS), null);
  check("get-comfy.ps1: node-pack list comes from lib/comfy.js through node -e (one source of truth)",
    /require\('\.\/lib\/comfy'\)\.requiredNodes\(\)/.test(PS), null);
  check("get-comfy.ps1: missing git exits 2 with instructions — consent to install lives in the UI",
    /exit 2/.test(PS) && /Find-Git/.test(PS) && /Git\\cmd\\git\.exe/.test(PS), null);
  check("get-comfy.ps1: every step is an idempotent ENSURE — re-running repairs a half-install",
    /idempotent ENSURE/.test(PS) && /already cloned in comfy/.test(PS), null);
  check("2.222.1: EAP is Continue — EAP=Stop died on git's redirected-stderr PROGRESS before installing",
    /\$ErrorActionPreference = "Continue"/.test(PS)
    && !/\$ErrorActionPreference = "Stop"/.test(PS), null);
  check("2.222.1: native stderr is MERGED (2>&1) on clones and pip so progress reads as progress",
    (PS.match(/2>&1 \| ForEach-Object/g) || []).length >= 6, (PS.match(/2>&1/g) || []).length);
  check("2.222.1: the one-element $py array bug is gone (PS range 1..N on @('python') is $null)",
    /if \(\$py\.Length -gt 1\)/.test(PS) && !/\$py\[1\.\.\(\$py\.Length\)\]/.test(PS), null);
  check("get-comfy.ps1: adopts the folder into Settings at the end",
    /adoptInstall\(/.test(PS), null);
  check("get-comfy.ps1: asking to install voids a remembered N",
    /Remove-Item \(Join-Path \$dest "\.declined"\)/.test(PS), null);
  check("lib/comfy.js: requiredNodes = lib/nodePacks.json (2.331.0) - Manager first, the accel + MMH3 upscaler packs in it, one list",
    JSON.stringify(C.requiredNodes().map((n) => n.folder).slice(0, 4))
      === JSON.stringify(["ComfyUI-Manager", "ComfyUI-KJNodes", "ComfyUI-Spectrum-MiniMax-H3", "Comfyui-MMH3-UltimateUpscale"])
      && C.requiredNodes().length === require("../lib/setupPacks").LIST.length,
    C.requiredNodes());
  check("lib/comfy.js: adoptInstall never overwrites an explicitly configured folder (shape)",
    /if \(\(c\.dir \|\| ""\)\.trim\(\)\) return \{ adopted: false/.test(SRC)
    && /core\.setConfig\(cfg\)/.test(SRC), null);
  const BAT2 = fs.readFileSync(path.join(__dirname, "..", "start.bat"), "utf8");
  check("2.222.0 start.bat: NO questions at all — the setup window owns the whole install",
    !/set \/p/.test(BAT2) && !/COMFYANS|GITANS|:ensuregit/.test(BAT2)
    && /setup window will handle it/.test(BAT2), null);
  check("get-comfy.ps1: takes -Dest (the user's chosen folder) and adopts THAT folder",
    /param\(\[string\]\$Dest = ""\)/.test(PS)
    && /adoptInstall\(undefined, process\.argv\[1\]\)/.test(PS), null);
  check("lib/comfy.js: adoption turns run-ComfyUI-on-startup ON by default",
    /cfg\.engine\.comfy\.autostart = true/.test(SRC), null);
}

console.log("=======================");
/* ---- 2.223.11: extra_model_paths.yaml management ---- */
{
  const cp = require("../lib/comfyPaths");
  const CS = path.join(__dirname, "..", "custom.settings");
  const before = fs.existsSync(CS) ? fs.readFileSync(CS) : null;
  const root = fs.mkdtempSync(path.join(require("os").tmpdir(), "cfp-"));
  try {
    fs.mkdirSync(path.join(root, "ComfyUI"), { recursive: true });
    fs.writeFileSync(path.join(root, "ComfyUI", "main.py"), "");
    fs.writeFileSync(path.join(root, "ComfyUI", "extra_model_paths.yaml"),
      "comfyui:\n  base_path: D:/old\n  checkpoints: \"D:/old/checkpoints\"\n# user comment\n");
    const core = require("../lib/core");
    const cfg = core.getConfig();
    cfg.engine = cfg.engine || {}; cfg.engine.comfy = cfg.engine.comfy || {};
    const prevDir = cfg.engine.comfy.dir;
    cfg.engine.comfy.dir = root;
    const r1 = cp.save({ base_path: "E:\\models", entries: { checkpoints: "checkpoints", vae: "vae" } });
    check("modelpaths: relative names write against their OWN base — no substring false-skip",
      r1.written.sort().join(",") === "checkpoints,vae" && r1.skipped.length === 0, r1);
    const r2 = cp.save({ entries: { controlnet: "D:/old/checkpoints" } });
    check("modelpaths: a path already in the file (any section) is SKIPPED, per the instruction",
      r2.skipped.join(",") === "controlnet", r2);
    const r3 = cp.save({ entries: { loras: "D:\\OLD\\Checkpoints\\" } });
    check("modelpaths: the already-there check is case-, slash- and trailing-slash-insensitive",
      r3.skipped.join(",") === "loras", r3);
    const txt = fs.readFileSync(path.join(root, "ComfyUI", "extra_model_paths.yaml"), "utf8");
    check("modelpaths: the user's own sections and comments survive VERBATIM; ours is one bitgen block",
      txt.includes("# user comment") && txt.includes("base_path: D:/old")
      && (txt.match(/^bitgen:/gm) || []).length === 1
      && /is_default: true/.test(txt), null);
    const rd = cp.read();
    check("modelpaths: read() round-trips base + entries and names the file",
      rd.base_path === "E:\\models" && rd.entries.vae === "vae"
      && rd.file.endsWith("extra_model_paths.yaml") && rd.types.length === 11, rd);
    if (prevDir === undefined) delete cfg.engine.comfy.dir; else cfg.engine.comfy.dir = prevDir;
  } finally {
    before === null ? fs.rmSync(CS, { force: true }) : fs.writeFileSync(CS, before);
    fs.rmSync(root, { recursive: true, force: true });
  }
  const UI = fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8");
  check("Folders sub-tab: rows for every type, the 📁 folder dialog (2.326.0: static/filedialog.js, every OS), ⚡ auto-add fills the standard names, 💾 posts",
    /data-ctab="folders"/.test(UI) && /function cfRowsPaint/.test(UI)
    && /window\.FileDialog\.open\(\{ mode: "dir", title: "Select Folder",/.test(UI) && !/\/api\/comfy\/pickdir/.test(UI)
    && /standard folders filled/.test(UI)
    && /\/api\/comfy\/modelpaths/.test(UI)
    && /if \(b\.dataset\.ctab === "folders"\) cfLoad\(\)/.test(UI), null);
}

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
