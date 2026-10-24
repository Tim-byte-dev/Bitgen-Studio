#!/usr/bin/env node
/* bitGen Studio — 2.352.0: the native engine behind Viggle (native), the app side.
 * Run: node scripts/test-native.js
 * Tim: "the viggle doesn't render at all now, 200sec elapsed and no steps started" + keep ComfyUI as the
 * engine. Viggle (native) now runs on a resident server (int8 in RAM, streamed, loaded between segments)
 * and can use his ComfyUI Viggle files ("Both": your files when readable, else the download).
 *   1. lib/nativeEngine: paths (+ 2.351's folders), finding the ComfyUI Viggle files, the source per
 *      component (both / official / comfy, picks, checks), readiness, the words, what to download;
 *   2. routes/native + routes/viggleNative (makeJob stubbed - nothing spawns);
 *   3. the wiring: core, worker.py's installer, comfy_client's hand-back, rippleSwap, routes/swapdlg;
 *   4. the swap dialog's ⚙ Viggle block in jsdom: the sources line, 🔍 Use my ComfyUI files, ⤓ Install. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 500) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const NE = require(path.join(ROOT, "lib", "nativeEngine"));
const VN = require(path.join(ROOT, "lib", "viggleNative"));
const RS = require(path.join(ROOT, "lib", "rippleSwap"));
const touch = (f, body) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body || "x"); };

// ---- 1. the lib
check("the components are Viggle's only (no H3 video parts - ComfyUI stays the engine)",
  NE.COMPONENTS.map((c) => c.id).join() === "base,vae,audio_vae,viggle,viggle_lora,viggle_assets");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ne_"));
const R = (p) => (path.isAbsolute(p) ? p : path.join(tmp, p));
let P = NE.paths({}, tmp, path.join(tmp, "models"), R);
check("paths: venvs/native + models/native/{MiniMax-H3, Viggle-Animate} by default",
  P.venv === path.join(tmp, "venvs", "native") && P.root === path.join(tmp, "models", "native") && P.viggle === path.join(tmp, "models", "native", "Viggle-Animate"), P);
fs.mkdirSync(path.join(tmp, "venvs", "viggle"), { recursive: true });
fs.mkdirSync(path.join(tmp, "models", "viggle_native"), { recursive: true });
P = NE.paths({}, tmp, path.join(tmp, "models"), R);
check("...2.351's venvs/viggle + models/viggle_native are used when they are what exists (nothing re-downloaded)",
  P.venv === path.join(tmp, "venvs", "viggle") && P.root === path.join(tmp, "models", "viggle_native"), P);
const C = path.join(tmp, "ComfyUI", "models");
for (const f of ["diffusion_models/minimax_h3_ref2va_int8_convrot.safetensors", "diffusion_models/sub/minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors",
                 "diffusion_models/viggle_nvfp4.safetensors", "vae/minimax_h3_video_vae_int8_convrot.safetensors", "vae/minimax_h3_audio_vae_fp32.safetensors",
                 "loras/viggle_animate_dmd_lora_r64.safetensors", "loras/other.safetensors"]) touch(path.join(C, f));
touch(path.join(tmp, "extra_loras", "x_viggle_dmd.safetensors"));
const roots = NE.comfyRoots(path.join(tmp, "ComfyUI"), { base_path: tmp, entries: { loras: "extra_loras" } }, R);
const cands = NE.candidates(roots);
const bn = (l) => (l || []).map((f) => path.basename(f));
check("candidates: the Viggle model in a subfolder (the plain H3 ref2va and the nvfp4 file kept out), its DMD LoRA in loras + an extra_model_paths folder, both VAEs",
  bn(cands.viggle).join() === "minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors"
  && bn(cands.viggle_lora).sort().join() === "viggle_animate_dmd_lora_r64.safetensors,x_viggle_dmd.safetensors" && bn(cands.vae).length === 1 && bn(cands.audio_vae).length === 1, cands);
const P2 = NE.paths({ dir: path.join(tmp, "w") }, tmp, "/m", R);
let res = NE.resolve(NE.cfgOf({}), P2, cands);
check("resolve: nothing downloaded, ComfyUI files not checked yet -> unchecked (an unchecked file is never used)",
  res.viggle.how === "unchecked" && !res.viggle.source && res.base.how === "missing", res.viggle);
const checks = {};
for (const f of [...cands.viggle, ...cands.viggle_lora, ...cands.vae]) checks[NE.fileKey(f)] = { ok: !/x_viggle/.test(f), why: "ComfyUI file" };
res = NE.resolve(NE.cfgOf({ native: { checks } }), P2, cands);
check("resolve (both): checked-OK ComfyUI files are used; a failed one is listed with its reason", res.viggle.how === "comfy" && res.vae.how === "comfy"
  && res.viggle_lora.how === "comfy" && /r64/.test(res.viggle_lora.file) && res.viggle_lora.candidates.some((c) => c.ok === false), res.viggle_lora);
touch(path.join(P2.root, "Viggle-Animate", "transformer", "a.safetensors"));
res = NE.resolve(NE.cfgOf({ native: { checks, prefer: "official" } }), P2, cands);
check("resolve (official): the download wins even over a good ComfyUI file", res.viggle.how === "official");
res = NE.resolve(NE.cfgOf({ native: { checks, picks: { viggle: "official" } } }), P2, cands);
check("resolve: a pick of 'official' for one component", res.viggle.how === "official" && res.vae.how === "comfy");
res = NE.resolve(NE.cfgOf({ native: { checks } }), P2, cands);
const rd = NE.readiness(res, true, "viggle");
check("readiness: what is still missing (labels) + the download size", !rd.ready && rd.missing.sort().join() === "audio_vae,base,viggle_assets"
  && rd.gb === Math.round((0.03 + 0.6 + 0.01) * 10) / 10, rd);
check("notReady: the words name the parts + the swap dialog's ⚙ -> ⤓ Install",
  /^Viggle \(native\) is not installed yet - .*audio VAE/.test(NE.notReady(rd, "viggle")) && /⚙ -> Viggle native -> ⤓ Install$/.test(NE.notReady(rd, "viggle"))
  && /its Python environment/.test(NE.notReady(NE.readiness(res, false, "viggle"), "viggle")), NE.notReady(rd, "viggle"));
check("fetchList: only the official parts still missing (base first) - your ComfyUI files are not downloaded again",
  NE.fetchList(res, "viggle").join() === "base,audio_vae,viggle_assets", NE.fetchList(res, "viggle"));
check("settingsSafe: clamps + whitelists (no H3 / turbo settings)", JSON.stringify(NE.settingsSafe({ port: 5, pack: "x", prefer: "y", video: true, use_turbo: true }))
  === '{"prefer":"both","pack":"int8","port":1024}');
const conf = { engine: { comfy: { dir: path.join(tmp, "ComfyUI") } }, native: { dir: path.join(tmp, "w"), checks } };
let saved = 0;
const rc = NE.refreshConfig(conf, { BASE: tmp, MODELS_DIR: "/m", resolvePath: R, save: () => { saved++; } });
check("refreshConfig: config.native.sources / base / lora_dirs written once (and saved) - what the worker reads",
  rc.changed && saved === 1 && conf.native.sources.viggle.comfy && conf.native.base === P2.base && conf.native.lora_dirs.length >= 1
  && !NE.refreshConfig(conf, { BASE: tmp, MODELS_DIR: "/m", resolvePath: R, save: () => { saved++; } }).changed && saved === 1);

// ---- 2. the routes (captured app, makeJob stubbed)
const core = require(path.join(ROOT, "lib", "core"));
const handlers = {};
const app = { get: (p, f) => { handlers["GET " + p] = f; }, post: (p, f) => { handlers["POST " + p] = f; } };
const RN = require(path.join(ROOT, "routes", "native"));
RN.mount(app);
require(path.join(ROOT, "routes", "viggleNative")).mount(app);
check("routes: native status / check / config / install / server + the Viggle view (status / config / check / install)",
  ["GET /api/native/status", "POST /api/native/check", "POST /api/native/config", "POST /api/native/install", "POST /api/native/server",
   "GET /api/viggle-native/status", "POST /api/viggle-native/config", "POST /api/viggle-native/check", "POST /api/viggle-native/install"].every((k) => handlers[k]));
const resOf = () => { const r = { code: 200, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const origSet = core.setConfig;
core.setConfig = () => { /* keep the test off disk */ };
const r1 = resOf(); handlers["GET /api/native/status"]({}, r1);
check("status: the components with source + candidates, Viggle's readiness with words, no H3 part", r1.body && r1.body.components.length === 6
  && "note" in r1.body.viggle && !("h3" in r1.body) && !("video" in r1.body.settings) && r1.body.diffusers_commit === "d6726f3", r1.body && Object.keys(r1.body));
const made = [];
const mk = core.makeJob;
core.makeJob = (p) => { made.push(p); return { id: "j1" }; };
const r2 = resOf(); handlers["POST /api/viggle-native/install"]({ body: {} }, r2);
core.makeJob = mk;
core.setConfig = origSet;
const ip = made[0] || {};
check("⤓ Install: ONE job (install_native) - the venv, then the official parts Viggle still misses (base first), the pinned diffusers, the HF token",
  r2.body && r2.body.id === "j1" && ip.mode === "install_native" && Array.isArray(ip.fetch_components) && ip.fetch_components[0] === "base"
  && ip.diffusers_commit === "d6726f3" && "hf_token" in ip && /^\[install\] Viggle \(native\)/.test(ip.prompt), ip);
const rv = resOf(); handlers["GET /api/viggle-native/status"]({}, rv);
check("the Viggle view: ready / missing / note / size / where each part comes from", rv.body && "ready" in rv.body && Array.isArray(rv.body.missing)
  && "note" in rv.body && Array.isArray(rv.body.sources) && rv.body.sources.every((s) => "how" in s));

// ---- 3. the wiring
const CORE = read("lib", "core.js"), W = read("misc/worker.py"), SW = read("routes", "swapdlg.js");
check("core: DEFAULT_CONFIG.native (no video switch), install_native a tool mode, the sources refreshed before a Viggle (native) job",
  core.DEFAULT_CONFIG.native && core.DEFAULT_CONFIG.native.port === 8199 && !("video" in core.DEFAULT_CONFIG.native) && CORE.includes('"install_native"];')
  && CORE.includes('if ((job.params || {}).mode === "viggle_native") {') && !("viggle_native" in core.DEFAULT_CONFIG));
check("worker.py: H3 video stays on ComfyUI (no native branch); the installer builds venvs/native + fetches what is missing",
  !W.includes("native_video") && !W.includes('engine = "native"') && W.includes('"install_viggle", "install_native"):')
  && W.includes('fetch = Path(__file__).resolve().parent.parent / "scripts" / "native" / "fetch.py"') && W.includes('+ (["torchvision"] if which == "native" else [])'));
check("comfy_client: a ComfyUI job makes a loaded native Viggle engine hand back RAM + VRAM", read("scripts", "comfy_client.py").includes("_nc.free_for_comfy(cfg, say)"));
check("viggle_native_worker: ComfyUI's models freed first, then the resident server (the model stays loaded)",
  read("misc/viggle_native_worker.py").includes("NC.free_comfy(job[\"config\"], say)") && read("misc/viggle_native_worker.py").includes('fin = NC.run(base, "viggle", body, say)'));
check("rippleSwap: Viggle (native) an engine; vn_steps / vn_shift only", RS.engineOf("viggle_native") === "viggle_native"
  && JSON.stringify(RS.settingsSafe({ vn_steps: 6, vn_offload: "gpu" })).includes('"vn_steps":6,"vn_shift":3}') && !("vn_offload" in RS.settingsBlank()));
check("routes/swapdlg: readiness from the native engine; no ComfyUI needed for a native render with its frames",
  SW.includes('if (native) { const why = require("./viggleNative").statusView().note; if (why) return { error: why }; }')
  && SW.includes('const down = st.engine !== "viggle_native" || todo.some((g) => !ffReady(g)) ? await comfyUp() : "";'));
const jp = VN.jobParams({ video: "/v", image: "/f", start: 1, frames: 48, seed: 3, width: 864, height: 480, settings: { vn_steps: 5 } });
check("lib/viggleNative: 48 frames rendered as 124, capped at 345 (diffusers' 15.0 s), steps from ⚙", jp.render_frames === 124 && jp.steps === 5
  && VN.MAX_FRAMES === 345 && /at most 14\.38 s \(345 frames\)/.test(VN.jobParams({ frames: 350 }).error), jp);

// ---- 4. the swap dialog's ⚙ Viggle block (jsdom)
(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dialog checks are skipped)"); return done(); }
  const dom = new JSDOM('<!doctype html><body><button id="vdSwapDlg">⇄ Swap</button></body>', { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1/" });
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  const STATE = { video: "movie.mp4", picture: "p.png", text: "", max: 5, ceiling: 362, max_seconds: 15, best_seconds: 5, picture_url: "",
    engine: "viggle_native", engines: RS.ENGINES, quality: "full", segments: [{ id: "g1", start: 0, dur: 5, frames: 120 }], results: [],
    settings: RS.settingsBlank(), video_info: { width: 1920, height: 1080 }, render_size: { width: 864, height: 480, auto: true }, loras: [] };
  let VNS = { ready: false, venv_ready: true, weights_ready: false, missing: ["Viggle-Animate transformer"], download_gb: 66, root: "/m/native", dir_setting: "",
    note: "Viggle (native) is not installed yet - ...", job: null,
    sources: [{ id: "base", label: "configs", how: "official" }, { id: "vae", label: "video VAE", how: "comfy", file: "C:\\\\c\\\\vae\\\\minimax_h3_video_vae_int8_convrot.safetensors" },
              { id: "viggle", label: "Viggle-Animate transformer", how: "unchecked" }, { id: "viggle_lora", label: "Viggle DMD LoRA", how: "missing" }] };
  const calls = [];
  w.fetch = async (url, o) => {
    const body = o && typeof o.body === "string" ? JSON.parse(o.body) : null;
    calls.push({ url, body });
    const J = (x) => ({ ok: true, json: async () => x });
    if (url === "/api/viggle-native/status") return J(VNS);
    if (url === "/api/viggle-native/check") {
      VNS = { ...VNS, ready: true, weights_ready: true, missing: [], sources: VNS.sources.map((s) => (s.id === "viggle" ? { ...s, how: "comfy", file: "/c/minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors" } : s)) };
      return J({ checked: 3, ...VNS });
    }
    if (url.startsWith("/api/swapdlg/info")) return J({ name: "movie.mp4", fps: 24, frames: 288, duration: 12, width: 1920, height: 1080 });
    if (url.startsWith("/api/frames")) return J({ key: "k", frames: [] });
    return J(STATE);
  };
  w.mountTempLoras = () => {};
  w.eval(read("static", "swapdlg.js"));
  const SD = w.SwapDialog;
  SD.install({ size: () => ({}), styleId: () => "", styleName: () => "", drag: () => null, refVideo: () => "", note: () => {},
               confirm: async () => true, llmFile: () => "", refreshAssets: () => {} });
  d.getElementById("vdSwapDlg").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const dlg = d.querySelector("dialog.swdlg[open]");
  dlg.querySelector(".swBar .swSet").click();
  await new Promise((r) => setTimeout(r, 40));
  const sd = d.querySelector("dialog.swSetDlg[open]");
  const q = (c) => sd.querySelector("." + c);
  check("⚙ Viggle native: where each part comes from (your ComfyUI file by name / found - 🔍 to use it / missing), no memory knobs",
    /video VAE: minimax_h3_video_vae_int8_convrot\.safetensors/.test(q("ssVnSrc").textContent) && /Viggle-Animate transformer: ComfyUI file found - 🔍 to use it/.test(q("ssVnSrc").textContent)
    && /Viggle DMD LoRA: missing/.test(q("ssVnSrc").textContent) && !q("ssVnOff") && !q("ssVnBlocks") && !q("ssVnCheck").disabled, q("ssVnSrc").textContent);
  await SD._api.vnCheck();
  check("🔍 Use my ComfyUI files: posts the check, the Viggle model now comes from your file, ready", calls.some((c) => c.url === "/api/viggle-native/check")
    && /Viggle-Animate transformer: minimax_h3_ref2va_viggle_pruned_int8_convrot\.safetensors/.test(q("ssVnSrc").textContent) && /^✓ installed/.test(q("ssVnState").textContent)
    && /🔍 checked 3 ComfyUI file\(s\) - Viggle \(native\) is ready/.test(dlg.querySelector(".swMsg").textContent), q("ssVnSrc").textContent);
  done();
})();
function done() {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
