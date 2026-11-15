/* bitGen Studio — lib/gpuCards.js (2.791.0): LOCAL MULTI-GPU - "Local - <card>" IN ☁ RUNS ON, ONE COMFYUI PER PICKED CARD.
 * Tim (the agreed design's D, "go ahead with part D"): "Local - <card> per type. ComfyUI runs on ONE card per process -> one
 * ComfyUI per picked card (--cuda-device N, its own port 8188, 8189 ...; jobs routed by type in gpuSplit.forJob like a remote target)"
 *   CARDS     this computer's NVIDIA cards (core.readGpus - nvidia-smi, PCI order); H3_TEST_GPUS (JSON, with H3_E2E=1) for the tests
 *   CHOICE    rgpu.local_cards = {image: N, video: N, music: N} - set by ☁ Runs on ▸ "Local - <card>" (lib/remoteHosts.js); plain
 *             "Local" = the ComfyUI of Settings ▸ ComfyUI, as before. Only ComfyUI's kinds (pictures, video, songs).
 *   ITS COMFYUI  the same ComfyUI folder + launcher as the main one (comfy.detectLaunch: python + main.py; a custom launch command
 *             or a .bat launcher cannot take the card - said), + --port <8189 + N> --cuda-device N, CUDA_DEVICE_ORDER=PCI_BUS_ID (so
 *             N is the card nvidia-smi / the list shows), its log comfyui-gpu<N>.log beside the app; started when a job needs it,
 *             waited for, kept running, stopped when bitGen exits. Its model lists are the main one's (the same folders).
 *   gate(params)  core.js, before a local job of such a kind starts: {wait, note} while its ComfyUI starts | {error} | {card, url}
 *             (the job's ComfyUI address - gpuSplit.forJob) | null (no card picked)
 *   COSTS     two ComfyUIs = their RAM twice; a model used on two cards is loaded on each.
 * H3_GPU_CARD_CMD (JSON array with {port} / {card}, H3_E2E=1 only) = the tests' stand-in ComfyUI instead.
 * Pure (scripts/test-gpucards791.js): portFor, cardsFrom, labelOf, argsFor, kindOf, pickOf.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const KINDS = ["image", "video", "music"];
const BASE_PORT = 8189;

/* ---------------- pure */
const portFor = (n) => BASE_PORT + (+n || 0);
function cardsFrom(gpus) { return (gpus || []).map((g, i) => ({ index: i, name: String((g && g.name) || "GPU " + i).trim(), vram_mb: +(g && (g.mem_total || g.vram_mb)) || 0 })); }
function labelOf(c) { return "Local - " + c.name + " (GPU " + c.index + (c.vram_mb ? ", " + Math.round(c.vram_mb / 1024) + " GB" : "") + ")"; }
/** the launch for a card (pure): d = comfy.detectLaunch's answer -> {cmd, args, cwd} | {error} */
function argsFor(d, n) {
  if (!d) return { error: "no ComfyUI launcher found (Settings ▸ ComfyUI ▸ Folder)" };
  if (d.shellCmd || !d.cmd || /\.(bat|cmd|sh)$/i.test(String((d.args || [])[0] || ""))) return { error: "Settings ▸ ComfyUI starts ComfyUI with " + (d.shellCmd ? "a custom launch command" : d.how) + " - bitGen cannot give that a card of its own. Leave the launch command empty (bitGen then runs ComfyUI's main.py itself), or pick plain Local" };
  return { cmd: d.cmd, args: (d.args || []).concat(["--port", String(portFor(n)), "--cuda-device", String(n)]), cwd: d.cwd };
}
/** the job's kind among ComfyUI's (pure) */
function kindOf(mode) { try { const k = require("./gpuSplit").kindOf(mode); return KINDS.includes(k) ? k : null; } catch { return null; } }
/** the card picked for a kind (pure): r = rgpu -> N | null */
function pickOf(r, kind) { const v = ((r || {}).local_cards || {})[kind]; return Number.isInteger(v) && v >= 0 ? v : null; }

/* ---------------- live */
const core = () => require("./core");
const rg = () => ((core().getConfig() || {}).rgpu) || {};
async function cards() {
  if (process.env.H3_E2E === "1" && process.env.H3_TEST_GPUS) { try { return cardsFrom(JSON.parse(process.env.H3_TEST_GPUS)); } catch { return []; } }
  try { return cardsFrom(await core().readGpus()); } catch { return []; }
}
let CACHE = { at: 0, list: [] };
/** the cards, a minute old at most (Runs on asks often) */
async function list() { if (Date.now() - CACHE.at > 60000) CACHE = { at: Date.now(), list: await cards() }; return CACHE.list; }
function cached() { return CACHE.list; }

function setPick(kind, n) {
  if (!KINDS.includes(kind)) return;
  const c = core().getConfig(), r = c.rgpu = c.rgpu || {}, m = Object.assign({}, r.local_cards || {});
  if (n == null) delete m[kind]; else m[kind] = +n;
  r.local_cards = m; core().setConfig(c);
}

const PROCS = {};   // card -> {proc, port, phase starting|up|failed, note, at, log}
function ping(port) {
  return new Promise((ok) => {
    const q = http.get({ host: "127.0.0.1", port, path: "/system_stats", timeout: 2500 }, (r) => { r.resume(); ok(r.statusCode === 200); });
    q.on("error", () => ok(false)); q.on("timeout", () => { q.destroy(); ok(false); });
  });
}
function launchOf(n) {
  if (process.env.H3_E2E === "1" && process.env.H3_GPU_CARD_CMD) {
    try { const a = JSON.parse(process.env.H3_GPU_CARD_CMD).map((x) => String(x).replace("{port}", String(portFor(n))).replace("{card}", String(n))); return { cmd: a[0], args: a.slice(1), cwd: core().BASE }; } catch { /* the real one */ }
  }
  const C = require("./comfy"), cfg = C.comfyCfg();
  if (cfg.launch) return { error: "Settings ▸ ComfyUI starts ComfyUI with a custom launch command - bitGen cannot give that a card of its own. Empty it (bitGen then runs ComfyUI's main.py itself), or pick plain Local" };
  if (!cfg.dir) return { error: "set the ComfyUI folder first (Settings ▸ ComfyUI)" };
  return argsFor(C.detectLaunch(core().resolvePath(cfg.dir)), n);
}
let HOOKED = false;
function start(n) {
  const port = portFor(n), P = PROCS[n];
  if (P && (P.phase === "starting" || P.phase === "up")) return P;
  const L = launchOf(n);
  if (L.error) return (PROCS[n] = { phase: "failed", note: L.error, port, at: Date.now() });
  const logPath = path.join(core().BASE, "comfyui-gpu" + n + ".log");
  let fd = null; try { fd = fs.openSync(logPath, "a"); } catch { fd = null; }
  const env = Object.assign({}, process.env, { PYTHONUNBUFFERED: "1", PYTHONIOENCODING: process.env.PYTHONIOENCODING || "utf-8", TQDM_DISABLE: process.env.TQDM_DISABLE || "1", CUDA_DEVICE_ORDER: "PCI_BUS_ID" });
  let proc;
  try { proc = require("child_process").spawn(L.cmd, L.args, { cwd: L.cwd, env, windowsHide: true, stdio: ["ignore", fd == null ? "ignore" : fd, fd == null ? "ignore" : fd] }); }
  catch (e) { return (PROCS[n] = { phase: "failed", note: "could not start ComfyUI for GPU " + n + ": " + e.message, port, at: Date.now() }); }
  if (fd != null) { try { fs.closeSync(fd); } catch { /* the child has it */ } }
  const R = PROCS[n] = { proc, port, phase: "starting", note: "starting ComfyUI for GPU " + n + " (port " + port + ")", at: Date.now(), log: logPath };
  proc.on("error", (e) => { R.phase = "failed"; R.note = "ComfyUI for GPU " + n + " did not start: " + e.message; });
  proc.on("close", (code) => { if (R.phase !== "failed") { R.phase = "failed"; R.note = "ComfyUI for GPU " + n + " stopped (code " + code + ") - see " + path.basename(logPath); } });
  if (!HOOKED) { HOOKED = true; process.once("exit", stopAll); }
  return R;
}
function stopAll() { for (const n of Object.keys(PROCS)) { const R = PROCS[n]; try { if (R.proc && R.phase !== "failed") R.proc.kill(); } catch { /* gone */ } delete PROCS[n]; } }
const MAX_WAIT = () => +(process.env.H3_GPU_CARD_WAIT || 10 * 60000);
/** core.js before a local job of a ComfyUI kind -> null | {wait, note} | {error} | {card, url, note} */
function gate(params) {
  const q = params || {}, kind = kindOf(q.mode);
  if (!kind) return null;
  const n = pickOf(rg(), kind); if (n == null) return null;
  const list = cached(), card = list.find((c) => c.index === n);
  const name = card ? card.name + " (GPU " + n + ")" : "GPU " + n;
  if (list.length && !card) return { error: "☁ Runs on ▸ " + kind + " picks GPU " + n + ", which this computer does not have now - pick another card or plain Local" };
  const port = portFor(n), url = "http://127.0.0.1:" + port;
  let R = PROCS[n];
  if (R && R.phase === "up") return { card: n, url, note: "renders on " + name + " - its own ComfyUI on port " + port };
  if (R && R.phase === "failed") { delete PROCS[n]; return { error: R.note }; }
  if (!R) {
    // one already answering on its port (started earlier, by hand or before a restart) is used as it is
    R = PROCS[n] = { phase: "checking", note: "looking for ComfyUI on GPU " + n, port, at: Date.now() };
    ping(port).then((up) => { if (up) { R.phase = "up"; R.note = "ComfyUI for GPU " + n + " answers on port " + port; } else { const S = start(n); if (S !== R) Object.assign(R, S); } });
    return { wait: 1500, note: R.note };
  }
  if (Date.now() - R.at > MAX_WAIT()) { R.phase = "failed"; R.note = "ComfyUI for GPU " + n + " did not answer in " + Math.round(MAX_WAIT() / 60000) + " min - see " + path.basename(R.log || "comfyui-gpu" + n + ".log"); }
  else if (R.phase === "starting" && !R.pinging) { R.pinging = true; ping(port).then((up) => { R.pinging = false; if (up) { R.phase = "up"; R.note = "ComfyUI for GPU " + n + " is up on port " + port; } }); }
  return { wait: 2000, note: R.note + " - " + Math.round((Date.now() - R.at) / 1000) + " s" };
}
function status() { const out = {}; for (const [n, R] of Object.entries(PROCS)) out[n] = { phase: R.phase, note: R.note, port: R.port }; return out; }
module.exports = { KINDS, BASE_PORT, portFor, cardsFrom, labelOf, argsFor, kindOf, pickOf, cards, list, cached, setPick, start, stopAll, gate, status };
