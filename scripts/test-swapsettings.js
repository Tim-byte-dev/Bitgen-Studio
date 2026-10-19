#!/usr/bin/env node
/* bitGen Studio — 2.342.0: the swap dialog's ⚙ settings + LTX Ripple on Tim's
 * own workflow. Run: node scripts/test-swapsettings.js
 * Tim: "use this workflow for the character swap, i tested it in comfy and it
 * works. maybe have a settings (icon only button) in the menubar with load
 * video in character swap ... in the settings dialog, show video settings,
 * video size (get from video), duration, steps, add lora button (like our
 * other add lora inputs), seed (random or fixed)".
 *   1. the record keeps settings; the "swap" temporary LoRA list;
 *   2. the wiring: routes/swapdlg (view: the video's size, the render size,
 *      the LoRAs; /set {settings}; H3 takes the fixed seed / set size;
 *      Ripple = mode "ripple" on LTX_Ripple_FFAF_Edit_v11_api.json),
 *      core.WORKER_FOR, ripple_worker, the node packs + the conv VAE;
 *   3. static/swapdlg.js in jsdom: ⚙ beside 📂 Load video, the dialog, Save. */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const SS = require(path.join(ROOT, "lib", "swapSession"));
const TL = require(path.join(ROOT, "lib", "tempLoras"));

// ---- 1. the record
check("the record keeps the ⚙ settings (defaults on an old record)", JSON.stringify(SS.blank().settings) === JSON.stringify(require(path.join(ROOT, "lib", "rippleSwap")).settingsBlank())
  && SS.safe({ settings: { auto_size: false, width: 1152, height: 768, steps: 12, seed_mode: "fixed", seed: 9 } }).settings.width === 1152
  && SS.safe({}).settings.seed_mode === "random");
check("a \"swap\" temporary LoRA list (projects/<p>/swap-loras-temp.json)", TL.KINDS.includes("swap") && /swap-loras-temp\.json$/.test(TL.file("/p", "swap")));

// ---- 2. the wiring
const R = read("routes", "swapdlg.js"), CORE = read("lib", "core.js"), W = read("ripple_worker.py");
check("view: the video's own size, the size a render uses, the swap LoRAs", R.includes('video_info: vi, render_size: (RS.isViggle(st.engine) ? VS : RS).sizeFor(st.settings, vi && vi.width, vi && vi.height), loras: swapLoras(),'));
check("/set merges {settings}", R.includes("if (b.settings && typeof b.settings === \"object\") st.settings = RS.settingsSafe({ ...st.settings, ...b.settings });"));
check("H3 takes the fixed seed and a set size", R.includes("RS.seedFor(st.settings, () => crypto.randomInt(0, 2 ** 31))")
  && R.includes("if (st.settings && st.settings.auto_size === false && st.settings.width && st.settings.height)"));
check("Ripple: Tim's workflow (its _api.json), the size / steps / strength / LoRAs from ⚙, refused in words when the file is missing",
  R.includes('const WF = viggle ? VS.WORKFLOW : RS.WORKFLOW;') && R.includes('const wf = path.join(core.BASE, "comfy_workflows", WF);') && R.includes("steps: set.steps,")
  && R.includes("strength: set.strength, loras: swapLoras() });") && R.includes("it ships in the full zip (unzip it over the install)"));
check("core: mode ripple -> ripple_worker.py", /ripple: "ripple_worker\.py"/.test(CORE));
check("ripple_worker: the cut, the classes asked (packs named), the LoRAs matched to ComfyUI's list, the finish",
  W.includes("LG.ripple_cut_args(src, clip,") && W.includes('"Frames Slice": "RES4LYF"') && W.includes('"LTXAddVideoICLoRAGuide": "ComfyUI-LTXVideo"')
  && W.includes("match_lora(loras, want)") && W.includes("RG.finish_args(raw, clip, output_dir / name, keep, has_a)"));
const NP = JSON.parse(read("lib", "nodePacks.json")).packs, CAT = JSON.parse(read("lib", "modelCatalog.json")).models;
check("Setup knows the two packs Tim's workflow adds (LTXVideo, RES4LYF) and its conv video VAE",
  NP.some((p) => p.id === "ltxvideo" && p.provides.includes("LTXAddVideoICLoRAGuide")) && NP.some((p) => p.id === "res4lyf" && p.provides.includes("Frames Slice"))
  && CAT.some((m) => m.id === "ltx25_vvae_conv" && m.file === "vae/ltx-2.5-video-vae-conv-bf16.safetensors"));
check("the workflows ship in the full zip: Tim's UI export + its API conversion", fs.existsSync(path.join(ROOT, "comfy_workflows", "LTX_Ripple_FFAF_Edit_v11.json"))
  && fs.existsSync(path.join(ROOT, "comfy_workflows", "LTX_Ripple_FFAF_Edit_v11_api.json")));

// ---- 3. the dialog (jsdom)
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
  const calls = [], loraCalls = [];
  let STATE = { video: "movie.mp4", picture: "", text: "", max: 5.17, ceiling: 362, max_seconds: 15.083, best_seconds: 5.17, picture_url: "",
    engine: "ripple", engines: [], quality: "full", segments: [], results: [],
    settings: { auto_size: true, width: 0, height: 0, steps: 8, seed_mode: "random", seed: 0, strength: 1.35 },
    video_info: { width: 1920, height: 1080, fps: 24, duration: 12 }, render_size: { width: 1376, height: 768, auto: true },
    loras: [{ path: "ltx/style.safetensors", weight: 0.7 }] };
  w.fetch = async (url, o) => {
    const body = o && o.body && typeof o.body === "string" ? JSON.parse(o.body) : null;
    calls.push({ url, body });
    const J = (x) => ({ ok: true, json: async () => x });
    if (url === "/api/swapdlg/set" && body && body.settings) {
      STATE = { ...STATE, settings: { ...STATE.settings, ...body.settings }, max: body.max, render_size: { width: body.settings.width, height: body.settings.height, auto: false } };
      return J(STATE);
    }
    if (url === "/api/swapdlg") return J(STATE);
    if (url.startsWith("/api/swapdlg/info")) return J({ name: "movie.mp4", fps: 24, frames: 288, duration: 12, width: 1920, height: 1080 });
    if (url.startsWith("/api/frames")) return J({ key: "k", frames: [] });
    return J({ ...STATE, note: "ok" });
  };
  w.mountTempLoras = (kind, host, list) => { loraCalls.push(["mount", kind, host, list]); };
  w.addTempLoraTo = (kind, host) => { loraCalls.push(["add", kind, host]); };
  w.eval(read("static", "swapdlg.js"));
  const SD = w.SwapDialog;
  SD.install({ size: () => ({ width: "960", height: "544" }), styleId: () => "", styleName: () => "", drag: () => null,
               refVideo: () => "", note: () => {}, confirm: async () => true, llmFile: () => "", refreshAssets: () => {} });
  d.getElementById("vdSwapDlg").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const dlg = d.querySelector("dialog.swdlg[open]");
  const set = dlg && dlg.querySelector(".swBar .swSet");
  const load = dlg && dlg.querySelector(".swBar .swLoad");
  check("⚙ is an icon-only button right after 📂 Load video in the menubar", set && set.textContent === "⚙" && load && load.nextElementSibling === set
    && /size, duration, steps, LoRAs, seed/.test(set.title));
  set.click();
  await new Promise((r) => setTimeout(r, 20));
  const sd = d.querySelector("dialog.swSetDlg[open]");
  const q = (c) => sd.querySelector("." + c);
  check("the settings dialog opens: size from the video (1376 × 768, the video is 1920×1080), duration = the segment Max, 8 steps, 1.35, seed Random",
    sd && q("ssAuto").checked && q("ssW").value === "1376" && q("ssH").value === "768" && q("ssW").disabled && /1920×1080/.test(q("ssFrom").textContent)
    && q("ssDur").value === "5.17" && q("ssSteps").value === "8" && q("ssStr").value === "1.35" && q("ssSeedMode").value === "random" && q("ssSeed").disabled);
  check("the LoRAs: the \"swap\" list painted with the app's own LoRA rows, ＋ Add LoRA adds one", (() => {
    q("ssAddLora").click();
    return JSON.stringify(loraCalls) === JSON.stringify([["mount", "swap", "swSetLoras", [{ path: "ltx/style.safetensors", weight: 0.7 }]], ["add", "swap", "swSetLoras"]]);
  })(), loraCalls);
  q("ssFromBtn").click();
  check("⟲ from video fills the video's size and lets it be edited", !q("ssAuto").checked && !q("ssW").disabled && q("ssW").value === "1376");
  q("ssW").value = "1152"; q("ssH").value = "768"; q("ssDur").value = "4"; q("ssSteps").value = "12"; q("ssStr").value = "1.2";
  q("ssSeedMode").value = "fixed"; q("ssSeedMode").dispatchEvent(new w.Event("change")); q("ssSeed").value = "4242";
  await SD._api.saveSettings();
  const c = calls.filter((x) => x.url === "/api/swapdlg/set").pop();
  check("Save: POST /api/swapdlg/set {settings, max} - the fixed size, 12 steps, 1.2, the fixed seed, 4 s segments",
    c && JSON.stringify(c.body) === JSON.stringify({ settings: { auto_size: false, width: 1152, height: 768, steps: 12, strength: 1.2, seed_mode: "fixed", seed: 4242, auto_render: true, viggle_steps: 3, viggle_strength: 1, viggle_solattn: false, viggle_safe: false, vn_steps: 4, vn_shift: 3 }, max: 4 }), c && c.body);
  check("...the dialog closes and the line says what was set", !d.querySelector("dialog.swSetDlg[open]")
    && /⚙ 1152×768 · 4\.00 s segments · 12 steps · seed 4242 · 1 LoRA/.test(dlg.querySelector(".swMsg").textContent), dlg.querySelector(".swMsg").textContent);
  check("pure: sizeFrom = the video's aspect at 768 in 32s", JSON.stringify(SD._api.sizeFrom(1080, 1920)) === '{"width":768,"height":1376}');
  done();
})();
function done() {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
