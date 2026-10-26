// bitGen Studio v2 — ComfyUI process manager + native Windows folder picker.
// All ComfyUI start/stop/status logic lives here (server.js stays minimal;
// endpoints mount from routes/index.js).
//
//   status()           -> reachable / managed / starting / dir / launch info
//   start()            -> launch ComfyUI from cfg.engine.comfy.dir
//   stop()             -> kill a studio-managed ComfyUI (never touches an
//                         externally started one)
//   pickFolderNative() -> real Windows 11 IFileOpenDialog folder picker
//                         (FOS_PICKFOLDERS) via PowerShell; returns the path.
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const core = require("./core");
const stdio = require("./comfyStdio");   // 2.100.0: file / real-console stdio

// ------------------------------------------------------------------ state
// Only ComfyUI instances *we* spawned are tracked here. An externally started
// ComfyUI shows as reachable but managed:false (stop() refuses to touch it).
// logBase = absolute index of log[0], so /api/comfy/log?from=N stays stable
// even after old lines are dropped from the ring.
let state = { proc: null, startedAt: null, how: null, log: [], logBase: 0,
              everStarted: false, swept: false, portFight: 0, portFightAt: 0,
              stdioMode: null, stopTail: null, logFile: null };

/* A LAUNCH THAT DIED ON THE PORT, in the words the three platforms use for it.
   Windows is the one that matters here (WinError 10048), but a ComfyUI behind
   WSL or on Linux says EADDRINUSE, and there is no reason to recognise only
   one. Deliberately narrow: this list gates an automatic process kill, so a
   phrase that merely CONTAINS "address" has no business in it. */
const PORT_BUSY = [
  "10048",                       // WSAEADDRINUSE, Windows
  "eaddrinuse",
  "address already in use",
  "only one usage of each socket address",
];

function clog(line) {
  state.log.push(String(line).replace(/\r?\n$/, ""));
  const over = state.log.length - 2000;
  if (over > 0) { state.log.splice(0, over); state.logBase += over; }
}

// Incremental read for the in-app console: lines from absolute index `from`.
function logFrom(from) {
  const abs = Math.max(from | 0, state.logBase);
  return { log: state.log.slice(abs - state.logBase),
           log_next: state.logBase + state.log.length };
}

// 2.219.0: start.bat's "Install ComfyUI y/N" puts the official Windows
// portable build (embedded python + CUDA torch) into <app>\comfy\ — when
// Settings has NO folder configured, discover it there so a batch install
// needs no Settings edit at all. An explicitly configured folder always
// wins, and nothing is discovered unless the layout is really one
// detectLaunch understands (portable, clone, or a run*.bat).
function discoveredDir(base) {
  const d = path.join(base || core.BASE, "comfy");
  try {
    // portable FIRST: it also has ComfyUI/main.py, but must resolve to comfy\
    // so python_embeded is what launches it
    if (fs.existsSync(path.join(d, "python_embeded", "python.exe"))
      && fs.existsSync(path.join(d, "ComfyUI", "main.py"))) return "comfy";
    if (fs.existsSync(path.join(d, "main.py"))) return "comfy";
    // 2.221.0: a git clone in comfy\ComfyUI\ resolves to THAT folder — the
    // launchable one. Resolving to comfy\ here is exactly what launched
    // Tim's clone with SYSTEM python and died on ModuleNotFoundError.
    if (fs.existsSync(path.join(d, "ComfyUI", "main.py"))) return "comfy/ComfyUI";
    if (fs.readdirSync(d).some((n) => /^run.*\.bat$/i.test(n))) return "comfy";
  } catch { /* no comfy folder — nothing to discover */ }
  return "";
}

// 2.221.0, by instruction: "if comyui is installed at setup then set the
// comfy folder in settings-comfyui tab to the folder the new comfy is
// installed". Persists the discovered folder into Settings (custom.settings
// diff layer via core.setConfig) — an explicitly configured folder is never
// overwritten. Called by the setup window and start.bat after a successful
// misc\\get-comfy.ps1 run; both run BEFORE the server, so no write race.
// 2.222.0 additions, by instruction: "let user choose folder for comfy
// install (or add new) automatically set this in comfyui tab (folder
// location) and set run comfyui on startup as default, start comfyui
// immediately". `installDir` is the CHOSEN install folder (absolute); the
// launchable dir inside it is found the same way discovery finds the
// default location. Adoption also flips engine.comfy.autostart ON — the
// server then starts ComfyUI at boot (lib/autostart.js), which is what
// makes "start comfyui immediately" true the moment the app launches.
// An explicitly configured folder is still NEVER overwritten.
function adoptInstall(base, installDir) {
  const b = base || core.BASE;
  const cfg = core.getConfig();
  const c = ((cfg.engine || {}).comfy || {});
  if ((c.dir || "").trim()) return { adopted: false, dir: c.dir, why: "already configured" };
  let dir = "";
  if (installDir) {
    const launch = fs.existsSync(path.join(installDir, "main.py")) ? installDir
      : fs.existsSync(path.join(installDir, "ComfyUI", "main.py")) ? path.join(installDir, "ComfyUI")
      : "";
    if (!launch) return { adopted: false, dir: "", why: "no install found in " + installDir };
    // keep the setting relative when the install lives inside the app folder
    const rel = path.relative(b, launch);
    dir = rel && !rel.startsWith("..") && !path.isAbsolute(rel)
      ? rel.split(path.sep).join("/") : launch;
  } else {
    dir = discoveredDir(b);
    if (!dir) return { adopted: false, dir: "", why: "no install found in comfy\\" };
  }
  cfg.engine = cfg.engine || {};
  cfg.engine.comfy = cfg.engine.comfy || {};
  cfg.engine.comfy.dir = dir;
  cfg.engine.comfy.autostart = true;      // run ComfyUI on startup, by default
  core.setConfig(cfg);
  return { adopted: true, dir, autostart: true };
}

// 2.221.0: the node packs OUR app needs inside ComfyUI — ComfyUI-Manager
// (by instruction) plus the packs the accelerator panels already install on
// demand. ONE list, read by misc\\get-comfy.ps1 through `node -e`, so the
// installer and the in-app buttons can never drift apart.
// 2.331.0: the list is lib/nodePacks.json now (the setup wizard installs
// every pack in it; this keeps misc\\get-comfy.ps1 on the same list)
function requiredNodes() {
  return require("./setupPacks").LIST.map((p) => ({ url: p.url, folder: p.folder, subdir: p.subdir || "" }));
}

// 2.220.0: should the Electron shell show the SETUP window before the app?
// Same gate as start.bat's console "Install ComfyUI y/N": only when no
// ComfyUI is installed in <app>\comfy\ (any layout discovery understands),
// none is configured in Settings, and the user has not declined before.
function setupNeeded(base) {
  const b = base || core.BASE;
  const c = ((core.getConfig().engine || {}).comfy || {});
  if ((c.dir || "").trim()) return false;          // configured elsewhere
  if (fs.existsSync(path.join(b, "comfy", ".declined"))) return false;
  return discoveredDir(b) === "";                  // any installed layout
}

function comfyCfg() {
  const eng = core.getConfig().engine || {};
  const c = eng.comfy || {};
  return {
    backend: eng.backend || "sdcli",
    url: (c.url || "http://127.0.0.1:8188").replace(/\/$/, ""),
    dir: c.dir || discoveredDir(),
    launch: (c.launch || "").trim(),
    // Leave ComfyUI running when bitGen Studio exits. ComfyUI takes a long time to
    // load its models, so killing it on every restart of the studio is
    // expensive; default ON. The explicit Stop button is unaffected.
    keepAlive: c.keep_alive !== false,
    // Clear ComfyUI's models + cache before every generation (2.98.0). The
    // workers read the same key from config.json; this copy paints the box.
    freeBeforeGen: c.free_before_gen !== false,
    // 2.100.0: where a ComfyUI we launch writes its console — "file"
    // (default; tailed into the app) or "console" (a real window of its own).
    stdio: stdio.stdioMode(c),
  };
}

async function reachable(url) {
  try {
    const r = await fetch(url + "/system_stats", { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

// ------------------------------------------------------------- VRAM (2.98.0)
// ComfyUI's /system_stats lists its devices with vram_total / vram_free. This
// is ComfyUI's OWN view of the card it renders on (torch.cuda.mem_get_info),
// which is the figure that decides whether a graph fits — nvidia-smi in the
// status bar is the machine-wide one and includes every other process.
async function vram(url, timeoutMs = 3000) {
  try {
    const r = await fetch(url + "/system_stats", { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.devices || []).map((d) => ({
      name: String(d.name || d.type || "gpu"),
      free: +d.vram_free || 0, total: +d.vram_total || 0 }));
  } catch { return []; }
}
const fmtVram = (devs) => (devs || []).map((d) =>
  `${(d.free / 2 ** 30).toFixed(1)}/${(d.total / 2 ** 30).toFixed(1)} GB free`).join(", ") || "unknown";

// POST /free {unload_models, free_memory}: ComfyUI's prompt thread unloads every
// model it holds, resets the execution cache, then gc + torch empty_cache. The
// reply is an empty 200 and only means the FLAGS are set — the unload lands
// when that thread next wakes — so this polls /system_stats until the free
// figure stops moving (or ~8 s) and reports before -> after. The same call the
// workers make from scripts/comfy_client.py before each generation; this one is
// the "Free VRAM now" button and the status-bar link.
async function freeMemory() {
  const cfg = comfyCfg();
  if (!(await reachable(cfg.url)))
    return { ok: false, error: `ComfyUI is not reachable at ${cfg.url}` };
  const before = await vram(cfg.url);
  try {
    const r = await fetch(cfg.url + "/free", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(30000) });
    if (!r.ok) return { ok: false, error: `ComfyUI answered HTTP ${r.status} to /free` };
  } catch (e) { return { ok: false, error: `POST /free failed: ${e.message || e}` }; }
  // Same wait as scripts/comfy_client.py free_memory(): return once the free
  // figure has MOVED away from `before` and then held still for a poll (the
  // unload finished), or after 2 s if nothing moves (nothing was loaded). Two
  // readings of the OLD figure are not "done" — the unload takes seconds.
  const same = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 64 * 2 ** 20);
  const base = before.map((d) => d.free);
  let last = null, after = [], moved = false;
  const t0 = Date.now();
  for (;;) {
    await new Promise((res) => setTimeout(res, 500));
    after = await vram(cfg.url);
    const key = after.map((d) => d.free);
    const el = Date.now() - t0;
    if (!moved && key.length && !same(key, base)) moved = true;
    else if (moved && last && same(key, last)) break;
    else if (!moved && el >= 2000) break;
    if (el >= 15000) break;
    last = key;
  }
  const line = `VRAM: ${fmtVram(before)} -> ${fmtVram(after)} (models unloaded, cache emptied)`;
  clog("[free] " + line);
  return { ok: true, before, after, line };
}

// --------------------------------------------------------- launch detection
// Known Windows layouts, tried in order (a custom launch command wins):
//   1. your own run.bat in the folder root (e.g. activates a venv, runs main.py)
//   2. portable zip:    run_nvidia_gpu.bat (and variants)
//   3. portable manual: python_embeded\python.exe + ComfyUI\main.py
//   4. git clone:       main.py run with the configured python (last resort —
//                       fails if ComfyUI's deps live in a venv; use run.bat)
function detectLaunch(dirAbs) {
  const cfg = comfyCfg();
  const j = (...p) => path.join(dirAbs, ...p);
  if (cfg.launch)
    return { shellCmd: cfg.launch, cwd: dirAbs, how: "custom launch command" };
  for (const b of ["run.bat",
                   "run_nvidia_gpu.bat", "run_nvidia_gpu_fast_fp16_accumulation.bat",
                   "run_nvidia_gpu_fp16_fast.bat", "run_cpu.bat"])
    if (fs.existsSync(j(b))) return { shellCmd: b, cwd: dirAbs, how: b };
  // 2.331.0 (cross-platform setup): macOS / Linux - the setup's run.sh,
  // else ComfyUI's own venv python; never the system python first
  if (process.platform !== "win32") {
    if (fs.existsSync(j("run.sh"))) return { cmd: "sh", args: [j("run.sh")], cwd: dirAbs, how: "run.sh" };
    for (const v of ["venv", ".venv"])
      if (fs.existsSync(j(v, "bin", "python")) && fs.existsSync(j("main.py")))
        return { cmd: j(v, "bin", "python"), args: ["-s", j("main.py")], cwd: dirAbs, how: `${v} python + main.py` };
  } else {
    for (const v of ["venv", ".venv"])
      if (fs.existsSync(j(v, "Scripts", "python.exe")) && fs.existsSync(j("main.py")))
        return { cmd: j(v, "Scripts", "python.exe"), args: ["-s", j("main.py")], cwd: dirAbs, how: `${v} python + main.py` };
  }
  if (fs.existsSync(j("python_embeded", "python.exe")) && fs.existsSync(j("ComfyUI", "main.py")))
    return { cmd: j("python_embeded", "python.exe"),
             args: ["-s", j("ComfyUI", "main.py"), "--windows-standalone-build"],
             cwd: dirAbs, how: "embedded python + ComfyUI\\main.py" };
  if (fs.existsSync(j("main.py")))
    return { cmd: core.getConfig().python, args: [j("main.py")],
             cwd: dirAbs, how: "system python + main.py" };
  return null;
}

// ------------------------------------------------ comfy-kitchen acceleration
// Comfy Kitchen (github.com/Comfy-Org/comfy-kitchen) is a KERNEL library that
// lives inside ComfyUI's own Python process — bitGen Studio can never call it
// directly. It only pays off when the weights being multiplied are in a format
// it has kernels for (FP8 needs SM 8.9 / Ada, NVFP4 and MXFP8 need SM 10.0 /
// Blackwell). int8_convrot MiniMax H3 weights are NOT one of those formats, so
// the honest answer for most setups is "little or no gain" — this panel says
// so instead of promising a speedup.
function comfyPython() {
  const dir = (comfyCfg().dir || "").trim();
  if (dir) {
    const dirAbs = path.isAbsolute(dir) ? dir : path.join(core.BASE, dir);
    const emb = path.join(dirAbs, "python_embeded",
                          process.platform === "win32" ? "python.exe" : "python");
    if (fs.existsSync(emb)) return { exe: emb, how: "ComfyUI portable python_embeded" };
    for (const v of ["venv", ".venv"]) {
      const p = process.platform === "win32"
        ? path.join(dirAbs, v, "Scripts", "python.exe")
        : path.join(dirAbs, v, "bin", "python");
      if (fs.existsSync(p)) return { exe: p, how: `ComfyUI ${v}` };
    }
  }
  return { exe: core.getConfig().python, how: "configured python (may not be ComfyUI's)" };
}

// compute capability per GPU, e.g. 8.9 (Ada), 12.0 (Blackwell)
function gpuComputeCaps() {
  try {
    const r = spawnSync("nvidia-smi",
      ["--query-gpu=name,compute_cap", "--format=csv,noheader"],
      { encoding: "utf8", timeout: 8000, windowsHide: true });
    if (r.status !== 0 || !r.stdout) return [];
    return r.stdout.trim().split(/\r?\n/).filter(Boolean).map((l) => {
      const [name, cap] = l.split(",").map((x) => (x || "").trim());
      return { name, cap, sm: parseFloat(cap) || 0 };
    });
  } catch { return []; }
}

function accelStatus() {
  const py = comfyPython();
  let kitchen = null, torch = null, err = null;
  try {
    const probe = "import json,importlib.metadata as md\n" +
      "o={'kitchen':None,'torch':None,'backends':None}\n" +
      "try: o['kitchen']=md.version('comfy-kitchen')\n" +
      "except Exception: pass\n" +
      "try:\n" +
      " import torch as t; o['torch']=t.__version__\n" +
      "except Exception: pass\n" +
      "try:\n" +
      " import comfy_kitchen as ck; o['backends']=list(ck.list_backends())\n" +
      "except Exception: pass\n" +
      "print(json.dumps(o))";
    const r = spawnSync(py.exe, ["-c", probe],
                        { encoding: "utf8", timeout: 30000, windowsHide: true });
    const line = (r.stdout || "").trim().split(/\r?\n/).pop();
    const j = JSON.parse(line);
    kitchen = j.kitchen ? { version: j.kitchen, backends: j.backends || [] } : null;
    torch = j.torch;
  } catch (e) { err = String(e.message || e); }
  const gpus = gpuComputeCaps();
  const best = gpus.reduce((a, g) => Math.max(a, g.sm), 0);
  const tier = best >= 10 ? "blackwell" : best >= 8.9 ? "ada" : best > 0 ? "older" : "unknown";
  const notes = [];
  if (tier === "blackwell")
    notes.push("Blackwell (SM " + best + "): FP8, NVFP4 and MXFP8 kernels all usable.");
  else if (tier === "ada")
    notes.push("Ada (SM " + best + "): FP8 kernels usable; NVFP4/MXFP8 need Blackwell.");
  else if (tier === "older")
    notes.push("SM " + best + ": below FP8 (8.9) — Comfy Kitchen has no kernels for this card.");
  else notes.push("No NVIDIA GPU reported by nvidia-smi.");
  notes.push("Only helps weights already in FP8/NVFP4/MXFP8. The int8_convrot "
    + "MiniMax H3 checkpoints are not, so expect little change unless you also "
    + "switch to an fp8/nvfp4 model file (the nvfp4_awq text encoder does qualify).");
  notes.push("Needs CUDA runtime 13+ and NVIDIA driver r580+; installs into "
    + "ComfyUI's python, not bitGen Studio's.");
  return {
    python: py.exe, python_how: py.how, torch, kitchen, gpus, tier, best_sm: best,
    installable: tier === "ada" || tier === "blackwell",
    extra: tier === "blackwell" ? "comfy-kitchen[cublas]" : "comfy-kitchen",
    error: err, notes,
  };
}

// pip install into ComfyUI's interpreter; output streams into the app console
function accelInstall(opts) {
  const st = accelStatus();
  // 2.601.0: ⟳ Reinstall - the package itself again (--force-reinstall --no-deps: ComfyUI's torch is never touched)
  const again = !!(opts && opts.reinstall);
  if (state.installing) return { started: false, reason: "an install is already running" };
  state.installing = true; beginInstall("kitchen");
  clog(`[kitchen] installing ${st.extra} into ${st.python}`);
  clog("[kitchen] restart ComfyUI afterwards for it to be picked up");
  const p = spawn(st.python, ["-m", "pip", "install", "--upgrade"].concat(again ? ["--force-reinstall", "--no-deps"] : [], [st.extra]),
                  { windowsHide: true });
  const feed = (d) => String(d).split(/\r?\n/).forEach((l) => l && clog("[kitchen] " + l));
  p.stdout.on("data", feed);
  p.stderr.on("data", feed);
  p.on("error", (e) => { state.installing = false; clog("[kitchen] failed: " + e.message); });
  p.on("close", (c) => {
    state.installing = false;
    clog(c === 0 ? "[kitchen] install finished — restart ComfyUI to load the kernels"
                 : `[kitchen] pip exited with code ${c}`);
  });
  return { started: true, python: st.python, package: st.extra };
}

// ---------------------------------------------- video accelerators (2.116.0)
// Sage attention + Spectrum for the MiniMax H3 VIDEO styles (Tim: "add sage +
// spectrum accelerators to our minimax style - if yes please give me the
// links and setup"). Three installable pieces, all inside ComfyUI's OWN
// environment (bitGen Studio never imports them):
//   sage      the `sageattention` python library. Windows wheels are built per
//             torch/CUDA pair; the wrong pair is EXACTLY the "DLL load failed
//             while importing _fused" in minimax-fixed.txt. The status probe
//             reads ComfyUI's torch tag and picks the matching stable-ABI
//             wheel from woct0rdho's releases (torch >= 2.10, python >= 3.10).
//   kjnodes   ComfyUI-KJNodes — the graph nodes that APPLY sage per-model
//             (PathchSageAttentionKJ / the H3 memeff patch). git clone/pull.
//   spectrum  ComfyUI-Spectrum-MiniMax-H3 — feature-forecast accelerator for
//             native H3 (~30% fewer transformer steps, approximate). git
//             clone/pull, no python dependencies of its own.
// The worker injects the nodes when a video style asks (apply_video_accel);
// this section only makes the packs exist. Restart ComfyUI after any install.
const VACCEL = {
  wheels: {   // stable ABI (cp310-abi3): one wheel per CUDA major, any torch >= 2.10
    cu130: "https://github.com/woct0rdho/SageAttention/releases/download/v2.2.0-windows.post6/sageattention-2.2.0+cu130torch2.10.0andhigher.post6-cp310-abi3-win_amd64.whl",
    cu128: "https://github.com/woct0rdho/SageAttention/releases/download/v2.2.0-windows.post6/sageattention-2.2.0+cu128torch2.10.0andhigher.post6-cp310-abi3-win_amd64.whl",
  },
  releases: "https://github.com/woct0rdho/SageAttention/releases",
  repos: {
    kjnodes: { url: "https://github.com/kijai/ComfyUI-KJNodes.git",
               folder: "ComfyUI-KJNodes", label: "KJNodes (sage patch nodes)" },
    spectrum: { url: "https://github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3.git",
                folder: "ComfyUI-Spectrum-MiniMax-H3", label: "Spectrum (H3 feature forecast)" },
    // 2.312.0 (Tim: "Add a workflow for comfyui upscaler,
    // https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale"): the
    // latent upscale pack the video docker's ⚙ upscaler runs
    upscale: { url: "https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale.git",
               folder: "Comfyui-MMH3-UltimateUpscale", label: "MMH3 Ultimate Upscale (latent upscaler)" },
    // 2.503.0 (Tim linked both with the "secret sauce" workflow): Yusu's one-node MiniMax H3 front end (it wraps
    // ComfyUI's native H3 nodes - bitGen Studio drives those itself; this is for imported workflows that use it) and
    // RunningHub's DLSS 5 neural rendering / upscale / frame generation (NVIDIA RTX; the NVIDIA DLLs are the user's
    // own - ComfyUI/models/dlss5/, see the pack's README)
    yusu: { url: "https://github.com/yusu-02/ComfyUI-Yusu-MiniMaxH3-Unified.git",
            folder: "ComfyUI-Yusu-MiniMaxH3-Unified", label: "Yusu MiniMax H3 Unified (one-node H3 front end)" },
    // 2.536.0 (Tim: "add veda as an optional video accelerator"): learned sparse attention for MiniMax H3 (ComfyUI
    // 0.38+). Its kernel is Triton (NVIDIA SM80+): after the clone, pip installs its requirements.txt into ComfyUI's
    // python, and on Windows triton-windows when no triton is there. The predictor is a model-catalog download.
    veda: { url: "https://github.com/veda-sparse/Veda-on-ComfyUI.git",
            folder: "Veda-on-ComfyUI", label: "Veda sparse attention (MiniMax H3)", pip: true },
    dlss5: { url: "https://github.com/RH-RunningHub/ComfyUI-RH-DLSS5.git",
             folder: "ComfyUI-RH-DLSS5", label: "RH DLSS 5 (enhance / upscale / frame generation - NVIDIA RTX)" },
  },
};

// <dir>/ComfyUI/custom_nodes (portable) or <dir>/custom_nodes (git clone) —
// whichever exists; else inferred from where main.py sits. null = no folder set.
function comfyCustomNodesDir() {
  const dir = (comfyCfg().dir || "").trim();
  if (!dir) return null;
  const dirAbs = path.isAbsolute(dir) ? dir : path.join(core.BASE, dir);
  for (const c of [path.join(dirAbs, "ComfyUI", "custom_nodes"),
                   path.join(dirAbs, "custom_nodes")])
    if (fs.existsSync(c)) return c;
  if (fs.existsSync(path.join(dirAbs, "ComfyUI", "main.py")))
    return path.join(dirAbs, "ComfyUI", "custom_nodes");
  if (fs.existsSync(path.join(dirAbs, "main.py")))
    return path.join(dirAbs, "custom_nodes");
  return null;
}

/** 2.312.0: is a VACCEL pack folder present? (no python probe - cheap) */
function packInstalled(what) {
  const r = VACCEL.repos[what];
  const nodesDir = comfyCustomNodesDir();
  return { what, label: r ? r.label : what, folder: r ? r.folder : "", nodes_dir: nodesDir,
           installed: !!(r && nodesDir && fs.existsSync(path.join(nodesDir, r.folder))) };
}

function videoAccelStatus() {
  const py = comfyPython();
  let sage = null, triton = null, torch = null, err = null;
  try {
    // versions via pip METADATA only — importing torch takes seconds and
    // this probe now runs on every Settings open (2.116.1); md.version
    // carries the full local tag ("2.13.0+cu130") which is all we need.
    const probe = "import json,importlib.metadata as md\n" +
      "o={'sage':None,'triton':None,'torch':None}\n" +
      "for k,names in (('sage',('sageattention',)),('triton',('triton','triton-windows')),('torch',('torch',))):\n" +
      " for n in names:\n" +
      "  try:\n" +
      "   o[k]=md.version(n); break\n" +
      "  except Exception: pass\n" +
      "print(json.dumps(o))";
    const r = spawnSync(py.exe, ["-c", probe],
                        { encoding: "utf8", timeout: 30000, windowsHide: true });
    const j = JSON.parse((r.stdout || "").trim().split(/\r?\n/).pop());
    sage = j.sage; triton = j.triton; torch = j.torch;
  } catch (e) { err = String(e.message || e); }
  const cu = (String(torch || "").match(/\+cu(\d{3})/) || [])[1];   // "130"/"128"
  const wheel = process.platform === "win32" && cu && VACCEL.wheels["cu" + cu]
    ? VACCEL.wheels["cu" + cu] : null;
  const nodesDir = comfyCustomNodesDir();
  const repos = {};
  for (const [k, r] of Object.entries(VACCEL.repos))
    repos[k] = { ...r, installed: !!(nodesDir && fs.existsSync(path.join(nodesDir, r.folder))) };
  const git = spawnSync("git", ["--version"],
                        { encoding: "utf8", timeout: 8000, windowsHide: true });
  const notes = [];
  notes.push(sage
    ? `sageattention ${sage} is installed in ComfyUI's python`
      + (triton ? ` (triton ${triton})` : " — triton NOT found; some backends need it")
    : "sageattention is NOT installed in ComfyUI's python");
  if (torch && !wheel && process.platform === "win32")
    notes.push(`torch ${torch}: no prebuilt wheel known for this CUDA tag — pick one at ${VACCEL.releases}`);
  if (sage && torch && wheel)
    notes.push("if a render says 'DLL load failed while importing _fused', the "
      + "installed wheel was built for another torch — reinstall (the button "
      + "picks the wheel matching ComfyUI's torch).");
  notes.push("Sage backends: 'auto' is fine on Blackwell; "
    + "sageattn_qk_int8_pv_fp16_cuda is the least likely to overflow if a "
    + "clip comes out black or noisy.");
  notes.push("Spectrum is APPROXIMATE (~30% fewer H3 transformer steps): fast "
    + "motion can drift vs a native run. Its defaults are the audio-safe path; "
    + "A/B the same seed when quality matters.");
  notes.push("restart ComfyUI after any install; the render itself verifies "
    + "the nodes exist and names what is missing.");
  return {
    python: py.exe, python_how: py.how, torch, sage, triton,
    wheel, wheel_fallback: "sageattention",   // pypi source build (needs a toolchain)
    releases: VACCEL.releases,
    nodes_dir: nodesDir, repos, git_ok: git.status === 0,
    installing: !!state.installing, error: err, notes,
  };
}

/** 2.536.0: what pip installs after a pack's clone (pure): the lines of its requirements.txt (comments / blanks
 *  / -r lines dropped); on Windows a plain "triton" requirement becomes triton-windows (triton itself has no Windows
 *  wheels), and triton-windows is added when ComfyUI's python has no triton yet. [] = nothing to install. */
function pipArgsFor(target, triton, platform, text) {
  let body = text;
  if (body == null) { try { body = target && fs.existsSync(path.join(target, "requirements.txt")) ? fs.readFileSync(path.join(target, "requirements.txt"), "utf8") : ""; } catch { body = ""; } }
  const win = platform === "win32", out = [];
  for (const raw of String(body || "").split(/\r?\n/)) {
    const l = raw.replace(/#.*$/, "").trim();
    if (!l || l.startsWith("-")) continue;
    if (win && /^triton(?![-_\w])/i.test(l)) { if (!out.includes("triton-windows")) out.push("triton-windows"); continue; }
    out.push(l);
  }
  if (win && !triton && !out.includes("triton-windows")) out.push("triton-windows");
  return out;
}

/* 2.601.0 (Tim: "let the user know the status next to the button and disable the button when download/install
   starts"): the install running now - its tag and where its lines start in the console, so the Settings button can
   show "⏳ <the last line>" beside it and "✓ / ✗" when it ends (GET /api/comfy/install-state). */
function beginInstall(tag) { state.inst = { tag, from: state.logBase + state.log.length, at: Date.now() }; }
const INST_BAD = /exited with code [1-9]|\bfailed\b|NOT updated/i;   // pip's own "ERROR: dependency resolver" notes are not a failure
/** pure: lines of one install + still running? -> {running, ok, text} */
function installVerdict(lines, installing) {
  const a = (lines || []).map((l) => String(l).replace(/^\[[^\]]{1,24}\]\s*/, "").trim()).filter(Boolean);
  const last = a[a.length - 1] || "";
  if (installing) return { running: true, text: last.length > 90 ? last.slice(0, 87) + "…" : last };
  const bad = a.slice(-2).find((l) => INST_BAD.test(l));
  return bad ? { ok: false, error: bad.slice(0, 160) } : { ok: true, text: /restart ComfyUI/i.test(last) ? "Installed - restart ComfyUI to pick it up" : "Installed" };
}
function installState() {
  const i = state.inst;
  if (!i) return { installing: !!state.installing, tag: null };
  const lines = state.log.slice(Math.max(0, i.from - state.logBase));
  return Object.assign({ installing: !!state.installing, tag: i.tag, at: i.at, lines: lines.slice(-30) }, installVerdict(lines, !!state.installing));
}

// pip (sage) or git clone/pull (kjnodes/spectrum) into the ComfyUI install;
// output streams into the app console like the kitchen installer above.
function videoAccelInstall(what) {
  const st = videoAccelStatus();
  if (state.installing) return { started: false, reason: "an install is already running" };
  const done = (tag) => (c) => {
    state.installing = false;
    clog(c === 0 ? `[${tag}] finished — restart ComfyUI to pick it up`
                 : `[${tag}] exited with code ${c}`);
  };
  const feed = (tag) => (d) => String(d).split(/\r?\n/).forEach((l) => l && clog(`[${tag}] ` + l));
  if (what === "sage") {
    const args = ["-m", "pip", "install", "--upgrade"];
    if (process.platform === "win32") {
      args.push("triton-windows", st.wheel || st.wheel_fallback);
      if (!st.wheel) clog("[sage] no prebuilt wheel matches ComfyUI's torch — "
        + "trying the pypi source package (needs a build toolchain); manual "
        + "wheels: " + VACCEL.releases);
    } else args.push(st.wheel_fallback);
    state.installing = true; beginInstall("sage");
    clog(`[sage] installing into ${st.python}: ${args.slice(4).join(" ")}`);
    const p = spawn(st.python, args, { windowsHide: true });
    p.stdout.on("data", feed("sage")); p.stderr.on("data", feed("sage"));
    p.on("error", (e) => { state.installing = false; clog("[sage] failed: " + e.message); });
    p.on("close", (c) => {
      if (c !== 0) { state.installing = false; clog(`[sage] pip exited with code ${c}`); return; }
      // ONE BUTTON, THE WHOLE SAGE STORY (2.116.1, Tim: "2 buttons ...
      // Install Sage and install spectrum"): the wheel alone cannot be
      // applied — the KJNodes pack holds the patch nodes — so the sage
      // install CHAINS a KJNodes clone/update before releasing the
      // one-install-at-a-time lock. A missing folder/git does not fail the
      // wheel half; it says exactly what was skipped and why.
      if (!st.nodes_dir || !st.git_ok) {
        state.installing = false;
        clog("[sage] wheel installed. KJNodes NOT updated: "
          + (!st.nodes_dir ? "set the ComfyUI folder first (Settings -> ComfyUI)"
                           : "git is not on PATH — install Git for Windows")
          + " — a render that needs the nodes will name them.");
        return;
      }
      const target = path.join(st.nodes_dir, VACCEL.repos.kjnodes.folder);
      const fresh = !fs.existsSync(target);
      try { fs.mkdirSync(st.nodes_dir, { recursive: true }); } catch {}
      const gargs = fresh ? ["clone", "--depth", "1", VACCEL.repos.kjnodes.url, target]
                          : ["-C", target, "pull", "--ff-only"];
      clog(`[sage] ${fresh ? "cloning" : "updating"} KJNodes -> ${target}`);
      const g = spawn("git", gargs, { windowsHide: true });
      g.stdout.on("data", feed("sage")); g.stderr.on("data", feed("sage"));
      g.on("error", (e) => { state.installing = false; clog("[sage] KJNodes step failed: " + e.message); });
      g.on("close", done("sage"));
    });
    return { started: true, what, python: st.python,
             wheel: st.wheel || st.wheel_fallback, kjnodes: true };
  }
  const r = VACCEL.repos[what];
  if (!r) return { started: false, reason: `unknown install target "${what}"` };
  if (!st.nodes_dir)
    return { started: false, reason: "set the ComfyUI folder first (Settings -> ComfyUI)" };
  if (!st.git_ok)
    return { started: false, reason: "git is not on PATH — install Git for Windows, then retry" };
  const target = path.join(st.nodes_dir, r.folder);
  const fresh = !fs.existsSync(target);
  try { fs.mkdirSync(st.nodes_dir, { recursive: true }); } catch {}
  const args = fresh ? ["clone", "--depth", "1", r.url, target]
                     : ["-C", target, "pull", "--ff-only"];
  state.installing = true; beginInstall(what);
  clog(`[${what}] ${fresh ? "cloning " + r.url : "updating"} -> ${target}`);
  const p = spawn("git", args, { windowsHide: true });
  p.stdout.on("data", feed(what)); p.stderr.on("data", feed(what));
  p.on("error", (e) => { state.installing = false; clog(`[${what}] failed: ` + e.message); });
  if (!r.pip) p.on("close", done(what));
  else p.on("close", (c) => {                                  // 2.536.0: its python requirements next
    if (c !== 0) { done(what)(c); return; }
    const pkgs = pipArgsFor(target, st.triton, process.platform);
    if (!pkgs.length) { done(what)(0); return; }
    clog(`[${what}] pip install ${pkgs.join(" ")} into ${st.python}`);
    const q = spawn(st.python, ["-m", "pip", "install", ...pkgs], { windowsHide: true });
    q.stdout.on("data", feed(what)); q.stderr.on("data", feed(what));
    q.on("error", (e) => { state.installing = false; clog(`[${what}] pip failed: ` + e.message); });
    q.on("close", done(what));
  });
  return { started: true, what, target, fresh };
}

// ------------------------------------------------------- workflow checklist
// Mirrors worker.py's lookup exactly: path from cfg.engine.comfy.workflows
// (fallback comfy_workflows/<mode>.json; t2va additionally falls back to the
// fl2va template with frame inputs stripped), and the same API-format test
// (every top-level value is an object with a class_type). Drives the green/red
// checklist in Settings → ComfyUI.
function workflowStatus() {
  const eng = core.getConfig().engine || {};
  const wfMap = (eng.comfy || {}).workflows || {};
  const out = [];
  for (const mode of ["t2va", "ref2va", "fl2va"]) {
    const rel = wfMap[mode] || `comfy_workflows/${mode}.json`;
    const abs = core.resolvePath(rel);
    const row = { mode, path: rel, exists: fs.existsSync(abs), api_format: false, error: null };
    if (row.exists) {
      try {
        const g = JSON.parse(fs.readFileSync(abs, "utf8"));
        row.api_format = g && typeof g === "object" && !Array.isArray(g) &&
          Object.values(g).length > 0 &&
          Object.values(g).every((v) => v && typeof v === "object" && "class_type" in v);
        if (!row.api_format) row.error = "UI export — use Export (API) in ComfyUI and save over it";
      } catch (e) { row.error = "unreadable JSON: " + e.message; }
    } else if (mode === "t2va" && !wfMap[mode]) {
      row.error = "not mapped — t2va reuses the fl2va template (frame inputs stripped)";
    } else {
      row.error = "missing";
    }
    out.push(row);
  }
  return out;
}

// ------------------------------------------------------------------ status
async function status() {
  const cfg = comfyCfg();
  const dirAbs = cfg.dir ? core.resolvePath(cfg.dir) : "";
  const up = await reachable(cfg.url);
  const managed = !!state.proc;
  let launch_hint = null;
  if (dirAbs && fs.existsSync(dirAbs)) {
    const d = detectLaunch(dirAbs);
    launch_hint = d ? d.how : "no launcher found (run_*.bat / main.py) — set a custom launch command";
  }
  return {
    backend: cfg.backend,
    url: cfg.url,
    dir: cfg.dir,
    dir_exists: !!dirAbs && fs.existsSync(dirAbs),
    reachable: up,
    managed,                                  // we spawned it this session
    starting: managed && !up,                 // process alive, API not up yet
    how: state.how,
    uptime: managed && state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : null,
    launch_hint,
    workflows: workflowStatus(),
    keep_alive: cfg.keepAlive,
    free_before_gen: cfg.freeBeforeGen,
    stdio: cfg.stdio,                         // the setting
    stdio_running: managed ? state.stdioMode : null,   // what THIS process got
    log_file: state.logFile,
    vram: up ? await vram(cfg.url) : [],       // ComfyUI's own free/total per card
    log_tail: state.log.slice(-6),
  };
}

// ------------------------------------------------------------------- start
async function start(opts) {
  const cfg = comfyCfg();
  // 2.100.0: opts.stdio ("file" | "console") overrides the setting for THIS
  // launch — the "relaunch in a real console" button uses it.
  const mode = stdio.stdioMode({ stdio: (opts || {}).stdio }) === "console"
      || (!(opts || {}).stdio && cfg.stdio === "console") ? "console" : "file";
  if (await reachable(cfg.url)) return { already_running: true, url: cfg.url };
  if (state.proc) return { starting: true, how: state.how };
  if (!cfg.dir)
    throw new Error("Set the ComfyUI folder first (Settings → ComfyUI).");
  const dirAbs = core.resolvePath(cfg.dir);
  if (!fs.existsSync(dirAbs))
    throw new Error(`ComfyUI folder not found: ${dirAbs}`);
  const d = detectLaunch(dirAbs);
  if (!d)
    throw new Error("No launcher found in that folder (looked for run.bat, " +
      "run_nvidia_gpu.bat, python_embeded\\python.exe + ComfyUI\\main.py, or main.py). " +
      "Set a custom launch command in Settings → ComfyUI.");

  state.log = []; state.logBase = 0;
  clog(`[comfy] launching via ${d.how} in ${d.cwd}`);
  /* THE ENVIRONMENT WE HAND COMFYUI IS PART OF THE LAUNCH, not a detail.

     We spawn with PIPED stdio and windowsHide, so ComfyUI gets no console.
     Python then switches its streams to block-buffered, and ComfyUI-Manager's
     prestartup wrapper calls original_stderr.flush() on that handle — which is
     the documented site of "OSError: [Errno 22] Invalid argument" on Windows
     (ComfyUI-Manager issue #2458, ComfyUI PR #11629). It surfaces mid-sampling
     because that is when tqdm starts writing progress to stderr, which is
     exactly where Tim's renders die: inside SamplerCustomAdvanced, on graphs
     that are otherwise fine.

     PYTHONUNBUFFERED makes those streams unbuffered, so the flush the wrapper
     performs is not the one that fails. It also makes OUR log stream live
     rather than arriving in 8 KB lumps, which is worth having on its own.

     PYTHONIOENCODING is a separate Windows trap: without it Python encodes
     stderr as cp1252 and a single non-ASCII character in a model name or a
     prompt kills the process with UnicodeEncodeError.

     THIS IS A HYPOTHESIS WITH A MECHANISM, NOT A PROVEN FIX. The decisive test
     is whether a render survives against a ComfyUI started BY HAND in a real
     console but fails against one started here — see HANDOVER.md. */
  const env = { ...process.env, PYTHONUNBUFFERED: "1",
                PYTHONIOENCODING: process.env.PYTHONIOENCODING || "utf-8",
                /* TQDM_DISABLE removes the WRITER whose flush fails, which
                   holds whether the broken handle is our pipe or the wrapper
                   ComfyUI-Manager installs: no progress bar, no mid-sampling
                   stderr burst, no flush to die on (tqdm >= 4.66 honours the
                   env var). Nothing of value is lost — job progress reaches the
                   UI over ComfyUI's websocket, which does not go through tqdm,
                   and a carriage-return progress bar was noise in a streamed
                   log anyway. Respected if the user set their own. */
                TQDM_DISABLE: process.env.TQDM_DISABLE || "1" };
  /* 2.100.0: NO PIPES. stdout/stderr go to a FILE (tailed into this log) or
     to a REAL console window — see lib/comfyStdio.js for why: a pipe with no
     console behind it is the handle whose flush raises [Errno 22] mid-sampling
     on Windows. A file write cannot; a console is what ComfyUI expects. */
  let logf = null;
  if (mode === "file") {
    try { logf = stdio.openLogFile(core.BASE); }
    catch (e) { clog(`[comfy] could not open ${stdio.LOG_NAME} (${e.message}); launching in a real console instead`); }
  }
  const useMode = logf ? "file" : "console";
  const so = stdio.spawnOptions(useMode, { cwd: d.cwd, env, fd: logf ? logf.fd : undefined });
  clog(`[comfy] stdio: ${useMode === "file" ? `-> ${logf.path} (tailed here)` : "a real console window (nothing captured here)"}`);
  let proc;
  if (d.shellCmd) {
    proc = process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", d.shellCmd], { ...so, env })
      : spawn("sh", ["-c", d.shellCmd], { ...so, env });
  } else {
    proc = spawn(d.cmd, d.args, { ...so, env });
  }
  if (logf) { try { fs.closeSync(logf.fd); } catch { /* child owns it now */ } }
  if (useMode === "console" && proc.unref) proc.unref();   // detached: never holds the server open
  state.proc = proc;
  state.everStarted = true;
  state.startedAt = Date.now();
  state.how = d.how;
  state.stdioMode = useMode;
  state.logFile = logf ? logf.path : null;
  if (state.stopTail) { try { state.stopTail(); } catch { /* old tail */ } state.stopTail = null; }
  if (logf) state.stopTail = stdio.tailFile(logf.path, clog, 0);
  proc.on("error", (e) => { clog(`[comfy] failed to start: ${e.message}`);
                            state.proc = null; });
  proc.on("close", (code, signal) => {
    clog(code != null ? `[comfy] process exited with code ${code}`
                      : `[comfy] process terminated${signal ? ` (${signal})` : ""}`);
    if (state.proc === proc) state.proc = null;
    if (state.stopTail) { try { state.stopTail(); } catch { /* ignore */ } state.stopTail = null; }
    if (code) recoverIfPortFight().catch(() => { /* clog'd inside */ });
  });
  return { started: true, how: d.how, url: cfg.url, stdio: useMode, log_file: state.logFile };
}

/**
 * RELAUNCH IN A REAL CONSOLE (2.100.0) — the decisive [Errno 22] test as one
 * button. Stops the ComfyUI H3 manages (an externally started one is left
 * alone and reported), then starts it again with a console window of its own.
 * Also flips the setting so every later auto-launch does the same, unless
 * `keep_setting` is true.
 */
async function relaunchConsole(opts) {
  const o = opts || {};
  const cfg = comfyCfg();
  if (!state.proc && await reachable(cfg.url))
    return { relaunched: false, reason: "ComfyUI is running but was not started by bitGen Studio — "
             + "close it yourself (or run misc\\clear-comfy.bat /start), then press this again." };
  if (state.proc) {
    stop();
    // give the port a moment to free before the new one asks for it
    for (let i = 0; i < 25 && await reachable(cfg.url); i++)
      await new Promise((r) => setTimeout(r, 400));
  }
  if (!o.keep_setting) {
    const c = core.getConfig();
    c.engine = c.engine || {}; c.engine.comfy = c.engine.comfy || {};
    c.engine.comfy.stdio = "console";
    core.setConfig(c);                       // persists the diff (custom.settings)
  }
  const r = await start({ stdio: "console" });
  return { relaunched: !!r.started, ...r };
}

/**
 * A LAUNCH THAT DIED BECAUSE SOMETHING ELSE HOLDS THE PORT: clear it and go again.
 *
 * Tim's instruction, and it is the same orphan the reboots were killing. Until
 * 2.81.3 a quit could leave the ComfyUI we launched alive and HIDDEN, still
 * holding :8188. The next launch then exits within seconds on WinError 10048,
 * which looks like "ComfyUI is broken" and is actually "ComfyUI is already
 * running, invisibly". misc\\clear-comfy.bat exists to fix exactly that, so run it.
 *
 * THREE THINGS KEEP THIS FROM BECOMING A LOOP, because a script that kills
 * processes and restarts them must not be able to run away:
 *   - ONCE per five minutes (`portFightAt`), so a machine where something else
 *     genuinely owns 8188 — another ComfyUI, a proxy — is not fought forever;
 *   - only when the log actually says the port was the problem;
 *   - only when the exit was FAST. A ComfyUI that ran for an hour and then died
 *     did not die of a port clash, whatever else is in its log.
 */
async function recoverIfPortFight() {
  const ranFor = state.startedAt ? Date.now() - state.startedAt : 0;
  if (ranFor > 60000) return false;                 // it started fine; not this
  const tail = state.log.slice(-40).join("\n").toLowerCase();
  if (!PORT_BUSY.some((p) => tail.includes(p))) return false;
  if (Date.now() - state.portFightAt < 5 * 60 * 1000) {
    clog("[comfy] the port is still held after a clear — not trying again. "
       + "Run misc\\clear-comfy.bat yourself, or see what owns it: "
       + "netstat -ano | findstr :8188");
    return false;
  }
  state.portFightAt = Date.now();
  state.portFight += 1;
  clog("[comfy] that launch died because something already holds the port — "
     + "almost always a ComfyUI left running by a previous session.");
  const bat = path.join(core.BASE, "misc", "clear-comfy.bat");   // 2.591.0: misc/
  if (process.platform !== "win32" || !fs.existsSync(bat)) {
    clog("[comfy] misc\\clear-comfy.bat is not available here; stop whatever owns "
       + "the port and start ComfyUI again.");
    return false;
  }
  clog("[comfy] running misc\\clear-comfy.bat /nostart to free it...");
  await new Promise((resolve) => {
    const p = spawn("cmd.exe", ["/d", "/s", "/c", `"${bat}" /nostart`],
                    { cwd: core.BASE, windowsHide: true });
    p.stdout.on("data", (b) => String(b).split("\n").filter(Boolean)
      .forEach((l) => clog("[clear] " + l.trim())));
    p.stderr.on("data", (b) => String(b).split("\n").filter(Boolean)
      .forEach((l) => clog("[clear] " + l.trim())));
    p.on("error", (e) => { clog("[clear] could not run: " + e.message); resolve(); });
    p.on("close", () => resolve());
    // The .bat ends in `pause`, so it would sit there forever waiting for a
    // keypress nobody can give it. /nostart still asks nothing, but a wedged
    // child must not wedge the app.
    setTimeout(() => { try { p.kill(); } catch { /* already gone */ } resolve(); }, 45000);
  });
  clog("[comfy] port cleared — starting ComfyUI again.");
  try {
    await start();
    return true;
  } catch (e) {
    clog("[comfy] the retry failed too: " + e.message);
    return false;
  }
}

// -------------------------------------------------------------------- stop
function stop() {
  if (!state.proc) return { stopped: false, reason: "not managed by bitGen Studio" };
  if (process.platform === "win32")
    spawnSync("taskkill", ["/pid", String(state.proc.pid), "/T", "/F"]);
  else state.proc.kill("SIGTERM");
  state.proc = null;
  if (state.stopTail) { try { state.stopTail(); } catch { /* ignore */ } state.stopTail = null; }
  clog("[comfy] stopped by user");
  return { stopped: true };
}

// -------------------------------------- native Windows 11 folder picker
// Real IFileOpenDialog with FOS_PICKFOLDERS (the modern Explorer-style picker,
// not the old tree view) driven from PowerShell via a tiny C# COM shim.
// Windows-only; other platforms fall back to the in-app browser (fsdlg).
const PICKER_PS = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class H3FolderPicker {
  [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
  class FileOpenDialog { }
  [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"),
   InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileOpenDialog {
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint c, IntPtr rg);
    void SetFileTypeIndex(uint i);
    void GetFileTypeIndex(out uint i);
    void Advise(IntPtr p, out uint c);
    void Unadvise(uint c);
    void SetOptions(uint fos);
    void GetOptions(out uint fos);
    void SetDefaultFolder(IntPtr psi);
    void SetFolder(IntPtr psi);
    void GetFolder(out IntPtr psi);
    void GetCurrentSelection(out IntPtr psi);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void GetResult(out IShellItem psi);
    void AddPlace(IntPtr psi, int f);
    void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string e);
    void Close(int hr);
    void SetClientGuid(ref Guid g);
    void ClearClientData();
    void SetFilter(IntPtr p);
    void GetResults(out IntPtr p);
    void GetSelectedItems(out IntPtr p);
  }
  [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"),
   InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IShellItem psi);
    void GetDisplayName(uint sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string name);
    void GetAttributes(uint mask, out uint attribs);
    void Compare(IShellItem psi, uint hint, out int order);
  }
  public static string Pick(string title) {
    var dlg = (IFileOpenDialog)(new FileOpenDialog());
    dlg.SetOptions(0x20 | 0x40);          // FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM
    if (!String.IsNullOrEmpty(title)) dlg.SetTitle(title);
    if (dlg.Show(IntPtr.Zero) != 0) return "";
    IShellItem item; dlg.GetResult(out item);
    string p; item.GetDisplayName(0x80058000, out p);   // SIGDN_FILESYSPATH
    return p;
  }
}
'@
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Write-Output ("H3PICK:" + [H3FolderPicker]::Pick("Select ComfyUI folder"))
`;

function pickFolderNative() {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32")
      return reject(new Error("Native picker is Windows-only — use the in-app 📁 browser instead."));
    const enc = Buffer.from(PICKER_PS, "utf16le").toString("base64");
    const p = spawn("powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-EncodedCommand", enc],
      { windowsHide: true });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => { try { p.kill(); } catch {}
      reject(new Error("folder picker timed out")); }, 300000);   // 5 min to browse
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", () => {
      clearTimeout(t);
      const m = /H3PICK:(.*)/.exec(out);
      if (!m) return reject(new Error("picker failed: " + (err.trim().split("\n")[0] || "no output")));
      const sel = m[1].trim();
      resolve(sel ? { path: sel } : { cancelled: true });
    });
  });
}

// ----------------------------------------------- app-exit ComfyUI shutdown
// When bitGen Studio closes, ComfyUI must not linger. shutdownAll() first kills
// the managed process tree, then sweeps EVERY ComfyUI process on the machine
// (matched by 'ComfyUI ... main.py' / standalone-build markers in the
// command line, plus anything launched from the configured ComfyUI folder).
// Everything is SYNCHRONOUS — it runs inside process exit handlers.
function shutdownAll(reason) {
  if (state.swept) return { stopped: true };
  const c = comfyCfg();
  // Closing the studio's console window fires SIGHUP, which used to come
  // straight through here and take ComfyUI down with it. With keepAlive set,
  // ComfyUI is left running — reopening the studio then finds it already up.
  if (c.keepAlive) {
    clog(`[comfy] ${reason || "app exit"} — leaving ComfyUI running `
       + "(Settings -> ComfyUI -> 'Leave ComfyUI running' is on)");
    return { stopped: false, kept: true };
  }
  state.swept = true;
  // Sweep whenever ComfyUI is the engine or this session ever launched one;
  // in pure sd-cli mode an unrelated, user-started ComfyUI is left alone.
  const sweep = c.backend === "comfy" || state.everStarted;
  try {
    if (state.proc && state.proc.pid) {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/pid", String(state.proc.pid), "/T", "/F"],
                  { windowsHide: true, timeout: 15000 });
      else { try { state.proc.kill("SIGKILL"); } catch {} }
      state.proc = null;
    }
  } catch {}
  if (!sweep) return { stopped: true };
  try {
    const dir = (c.dir || "").trim();
    if (process.platform === "win32") {
      // match ComfyUI\main.py, the portable standalone flag, or the folder
      // Tim configured; skip our own PID and the sweep's own PowerShell
      // (its command line contains the patterns too).
      const esc = (s) => s.replace(/'/g, "''");
      const conds = ["$_.CommandLine -match 'ComfyUI[\\\\/].*main\\.py'",
                     "$_.CommandLine -like '*windows-standalone-build*'"];
      if (dir) conds.push(`$_.CommandLine -like '*${esc(dir)}*'`);
      const ps = "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine " +
        `-and $_.ProcessId -ne $PID -and $_.ProcessId -ne ${process.pid} ` +
        `-and (${conds.join(" -or ")}) } | ForEach-Object { ` +
        "try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }";
      spawnSync("powershell.exe",
                ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
                { windowsHide: true, timeout: 20000 });
    } else {
      spawnSync("pkill", ["-9", "-f", "ComfyUI/.*main\\.py"], { timeout: 10000 });
      if (dir) spawnSync("pkill", ["-9", "-f", dir], { timeout: 10000 });
    }
  } catch {}
  clog(`[comfy] shutdown sweep (${reason || "app exit"})`);
  return { stopped: true };
}

// Register once: normal exit, Ctrl+C (SIGINT), kill (SIGTERM), console-window
// close on Windows (SIGHUP with a short grace period).
let hooked = false;
function installExitHooks() {
  if (hooked) return;
  hooked = true;
  process.on("exit", () => { shutdownAll("exit"); });
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => { shutdownAll(sig); process.exit(0); });
  }
  /* THE PARENT WATCHDOG. All of the hooks above need this process to DIE
     POLITELY — and when Electron is killed from Task Manager, or crashes, or
     (before 2.81.3) called server.kill() on Windows, none of them run:
     TerminateProcess gives a process no last words. Electron therefore hands us
     its pid, and if that process vanishes we sweep and leave under our own
     power. kill(pid, 0) is a liveness probe, not a signal — it throws ESRCH
     when the pid is gone. Polling every 2s is invisible; an orphaned ComfyUI
     holding port 8188 and the VRAM is not. */
  const ppid = parseInt(process.env.H3_PARENT_PID || "", 10);
  if (ppid > 0) {
    const watch = setInterval(() => {
      try { process.kill(ppid, 0); }
      catch {
        clearInterval(watch);
        clog("[comfy] parent app is gone — shutting down");
        shutdownAll("parent gone");
        process.exit(0);
      }
    }, 2000);
    watch.unref();      // the watchdog must never be what keeps us alive
  }
}
installExitHooks();

// Used by Generate: bring ComfyUI up if it is not already answering. Returns
// immediately after spawning — the caller polls status() for readiness, so a
// slow model load never blocks the HTTP request.
/**
 * Bring ComfyUI up if it is not already answering.
 *
 * `force` exists because the VIDEO backend setting is the wrong question for an
 * IMAGE job. A style carries its own engine, so a user can perfectly well run
 * video on sd-cli and images through ComfyUI — and before 2.73.0 that
 * combination silently skipped the launch and the render failed on a ComfyUI
 * that was never started. The caller knows which engine its job needs; it says
 * so rather than having this guess from a global.
 */
async function ensure(opts) {
  const o = opts || {};
  const cfg = comfyCfg();
  if (!o.force && cfg.backend !== "comfy")
    return { skipped: "engine is not comfy", reachable: false };
  if (await reachable(cfg.url)) return { reachable: true, started: false };
  if (state.proc) return { reachable: false, started: false, starting: true };
  const r = await start();
  return { ...r, reachable: false, started: true, starting: true };
}

/* ------------------------------------------------- /object_info (2.120.0)
   ComfyUI's own node schema: every installed class with its inputs, their
   types and `input_order`. It is where the CANVAS gets the widget order from,
   which is what makes it the right source for converting a UI export into an
   API prompt (lib/graphToApi.js) instead of a hand-written table that stops
   dead on the first unfamiliar node pack.

   Throws when ComfyUI is not reachable, and the caller says so: guessing a
   widget order produces a workflow that renders the wrong thing with no error,
   which is strictly worse than a message telling the user to start ComfyUI. */
async function objectInfo(timeoutMs = 30000) {
  const url = comfyCfg().url;
  const r = await fetch(url + "/object_info", { signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`ComfyUI answered HTTP ${r.status} to /object_info`);
  const j = await r.json();
  if (!j || typeof j !== "object") throw new Error("ComfyUI's /object_info was not an object");
  return j;
}

module.exports = { installState, installVerdict, pipArgsFor, discoveredDir, setupNeeded, adoptInstall, requiredNodes, status, start, stop, relaunchConsole, ensure, shutdownAll, accelStatus, accelInstall, videoAccelStatus, videoAccelInstall, packInstalled, pickFolderNative, comfyCfg, objectInfo, logFrom, workflowStatus, recoverIfPortFight, PORT_BUSY, vram, freeMemory, fmtVram };
