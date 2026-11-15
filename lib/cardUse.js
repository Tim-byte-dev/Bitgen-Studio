/* bitGen Studio — lib/cardUse.js (2.794.0): LOCAL MULTI-GPU PART 2 - THE LLM, THE VISION LLM AND SPEECH ON A CARD OF THEIR OWN;
 * Settings ▸ General ☐ "Offload to CPU / RAM when a model does not fit".
 * Tim (the agreed design's D): "the LLM / vision LLM already pin a card (core.ensureLlama / captioner: CUDA_VISIBLE_DEVICES + -ngl) -
 * "max layers" = layers worked out from the GGUF size vs the card's free VRAM; speech engines (PyTorch) get cuda:N. NEW Settings ▸
 * General ☐ "Offload to CPU / RAM when a model does not fit" (on: ComfyUI on that card without --highvram / with its RAM offload,
 * llama.cpp -ngl = what fits; off: everything on the card, a clear error when it does not fit)".
 *   CHOICE   ☁ Runs on ▸ LLM / Vision LLM / Text to speech / Speech to text / Song separation ▸ "Local - <card>" (lib/remoteHosts.js)
 *            = rgpu.local_cards[kind] (lib/gpuCards.js setPick). Plain "Local" = the device Settings ▸ LLM / Audio set, as before.
 *   A CARD   = CUDA_VISIBLE_DEVICES=<N> + CUDA_DEVICE_ORDER=PCI_BUS_ID (N is the card nvidia-smi and the list show); inside the
 *            process the card is cuda:0, so the speech jobs get device "cuda" (a cuda:N of their own would point past it).
 *   LAYERS   llama.cpp's -ngl: layersFor() from the GGUF's size + layer count (lib/gguf.js llmShape) + its context's KV cache vs the
 *            card's free VRAM (nvidia-smi, after the old model has left the card). Fits = every layer (-ngl 99, as before);
 *            offload ON = as many layers as fit, the rest in RAM; offload OFF = a clear error BEFORE llama-server starts.
 *            A Settings ▸ LLM "GPU layers" of your own (0-98) is kept as you set it.
 *   COMFYUI  offload OFF = --gpu-only (lib/gpuCards.js argsFor for a card's ComfyUI; lib/comfy.js for the main one when bitGen runs
 *            its main.py - a .bat / custom launch command is left as it is); ON = ComfyUI's own default (models moved to RAM
 *            when the card is full).
 *   SETTING  config.gpu_offload (default on) - GET / POST /api/carduse (routes/cardUse.js), static/cardoffload.js.
 * Pure (scripts/test-carduse794.js): KINDS, EXTRA, SPEECH, envFor, offloadOn, pickOf, layersFor, gb, speechJob.
 */
"use strict";
const KINDS = ["image", "video", "music", "llm", "vlm", "tts", "stt", "stems"];   // every kind a card can be picked for
const EXTRA = ["llm", "vlm", "tts", "stt", "stems"];                                // the ones that are not ComfyUI's
const SPEECH = ["tts", "stt", "stems"];
const MIB = 1024 * 1024;
const RESERVE_MB = 700;   // llama.cpp's own buffers + the CUDA context, kept free on the card

/* ---------------- pure */
const gb = (bytes) => Math.round(bytes / 1024 / MIB * 10) / 10;
/** the env a process needs to see only card N, numbered as nvidia-smi numbers it */
function envFor(n) { return { CUDA_VISIBLE_DEVICES: String(n), CUDA_DEVICE_ORDER: "PCI_BUS_ID" }; }
/** Settings ▸ General ☐ Offload (default on) */
function offloadOn(cfg) { return ((cfg || {}).gpu_offload) !== false; }
/** the card picked for a kind: r = rgpu -> N | null */
function pickOf(r, kind) { const v = ((r || {}).local_cards || {})[kind]; return Number.isInteger(v) && v >= 0 ? v : null; }
/**
 * llama.cpp's -ngl for a GGUF on a card.
 * o = {bytes (the file(s)), layers (block_count), freeMb (the card's free VRAM), kvBytes (the context's KV cache), offload,
 *      name, card} -> {ngl, all, note} | {error}
 * Unknown size / layers / free VRAM = every layer, as before (nothing to work it out from).
 */
function layersFor(o) {
  const q = o || {}, bytes = +q.bytes || 0, L = +q.layers || 0, freeMb = +q.freeMb || 0, kv = +q.kvBytes || 0;
  if (!bytes || !L || !freeMb) return { ngl: 99, all: true, note: "" };
  const avail = freeMb * MIB - RESERVE_MB * MIB, need = bytes + kv;
  const where = q.card != null ? "GPU " + q.card : "the card";
  if (need <= avail) return { ngl: 99, all: true, note: (q.name || "the model") + " fits on " + where + " (" + gb(need) + " GB of " + gb(freeMb * MIB) + " GB free)" };
  const say = (q.name || "the model") + " needs about " + gb(need) + " GB (" + gb(bytes) + " GB model" + (kv ? " + " + gb(kv) + " GB context" : "") + ") and " + where + " has " + gb(freeMb * MIB) + " GB free";
  if (!q.offload) return { error: say + " - tick Settings ▸ General ▸ Offload to CPU / RAM when a model does not fit, use a smaller context or model, or pick another card in ☁ Runs on" };
  const per = bytes / L, room = avail - kv;
  const n = Math.max(0, Math.min(L, Math.floor(room / per)));
  return { ngl: n, all: false, note: say + " - " + n + " of " + L + " layers on the card, the rest in RAM (slower)" };
}
/** a speech job sent to card N: device "cuda" (the card is cuda:0 inside) + the env -> {job, opts} (copies) */
function speechJob(job, opts, n) {
  if (n == null) return { job, opts };
  return { job: Object.assign({}, job, { device: "cuda" }), opts: Object.assign({}, opts || {}, { env: Object.assign({}, (opts || {}).env || {}, envFor(n)) }) };
}

/* ---------------- live */
const core = () => require("./core");
const cfg = () => core().getConfig() || {};
/** the card picked for a kind now (☁ Runs on ▸ Local - <card>) - only while the kind runs locally */
function pickNow(kind) { return pickOf(cfg().rgpu || {}, kind); }
function offloadNow() { return offloadOn(cfg()); }
function setOffload(on) { const c = core().getConfig(); c.gpu_offload = !!on; core().setConfig(c); return !!on; }
/** a speech job (tts / stt / stems) on its picked card, else unchanged -> {job, opts, card} */
function forSpeech(kind, job, opts) { const n = pickNow(kind); const r = speechJob(job, opts, n); r.card = n; return r; }
/** the free VRAM of nvidia-smi's card N in MB, or 0 when it cannot be read */
async function freeMbOf(n) {
  if (process.env.H3_E2E === "1" && process.env.H3_TEST_GPUS) {
    try { const g = JSON.parse(process.env.H3_TEST_GPUS)[n]; return g ? Math.max(0, (+g.mem_total || 0) - (+g.mem_used || 0)) : 0; } catch { return 0; }
  }
  try { const g = (await core().readGpus())[n]; return g ? Math.max(0, (+g.mem_total || 0) - (+g.mem_used || 0)) : 0; } catch { return 0; }
}
/** -ngl for a llama-server about to start on device "cudaN" (core.ensureLlama, captioner) */
async function layersNow(dev, o) {
  const m = /^cuda(\d+)$/.exec(String(dev || ""));
  if (!m) return { ngl: 99, all: true, note: "" };
  const fs = require("fs");
  let bytes = 0; for (const f of [].concat(o.files || [])) { try { if (f) bytes += fs.statSync(f).size; } catch { /* gone */ } }
  return layersFor({ bytes, layers: o.layers, kvBytes: o.kvBytes, freeMb: await freeMbOf(+m[1]), offload: o.offload != null ? !!o.offload : offloadNow(), name: o.name, card: +m[1] });
}
/** venv.runJson for a speech kind, on its picked card when one is picked (tts / stt / stems) */
function runJson(kind, python, script, job, opts) { const r = forSpeech(kind, job, opts); return require("./venv").runJson(python, script, r.job, r.opts); }
function view() { return { offload: offloadNow(), picks: Object.assign({}, (cfg().rgpu || {}).local_cards || {}) }; }
module.exports = { KINDS, EXTRA, SPEECH, RESERVE_MB, gb, envFor, offloadOn, pickOf, layersFor, speechJob, pickNow, offloadNow, setOffload, forSpeech, runJson, freeMbOf, layersNow, view };
