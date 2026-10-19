#!/usr/bin/env node
/* bitGen Studio — 2.344.0: the swap dialog's Viggle (H3) engine, the app side.
 * Run: node scripts/test-viggleswap.js
 * Tim (with API-viggle-animate-h3_workflow-v1.2.0.json): "https://github.com/
 * deepbeepmeep/Wan2GP, uses a 3 step viggle animate. i have seen it on
 * youtube. can you see if we can add viggle to our styles\workflow".
 *   1. lib/viggleSwap: the job, the size (480), the summary; the engine list
 *      + the first-frame engines; ⚙ viggle_steps / viggle_strength;
 *   2. the wiring: core, routes/swapdlg, the worker, Setup (pack + models);
 *   3. static/swapdlg.js in jsdom: the Engine option, the first-frame strip,
 *      the ⚙ rows. */
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
const RS = require(path.join(ROOT, "lib", "rippleSwap"));
const VS = require(path.join(ROOT, "lib", "viggleSwap"));

// ---- 1. the libs
check("engines: h3, ripple, viggle; the first-frame engines are Ripple + Viggle", RS.ENGINE_IDS.join() === "h3,ripple,viggle,viggle_native"
  && RS.engineOf("viggle") === "viggle" && RS.usesFirstFrame("viggle") && RS.usesFirstFrame("ripple") && !RS.usesFirstFrame("h3"));
const p = VS.jobParams({ workflow: "/w/viggle_animate_h3_api.json", video: "/v.mp4", image: "/f.png", start: 5.5, frames: 120, seed: 7,
  width: 864, height: 480, steps: 3, strength: 0.9, loras: [{ path: "look.safetensors", weight: 0.5 }, { weight: 1 }] });
check("jobParams: mode viggle, the segment's own frames (no still to drop), 3 steps, the DMD strength, the swap LoRAs",
  p.mode === "viggle" && p.frames === 120 && p.start === 5.5 && Math.abs(p.dur - 5) < 1e-9 && p.steps === 3 && p.strength === 0.9
  && p.short_side === 480 && JSON.stringify(p.loras) === '[{"path":"look.safetensors","weight":0.5}]' && p.seed === 7, p);
check("jobParams refuses in words: too short, no workflow", /too short for a Viggle swap/.test(VS.jobParams({ frames: 3 }).error)
  && /viggle_animate_h3_api\.json is missing - it ships in the full zip/.test(VS.jobParams({ frames: 120 }).error));
check("defaults: 3 steps (the DMD schedule), DMD @ 1", VS.jobParams({ workflow: "w", frames: 48 }).steps === 3 && VS.jobParams({ workflow: "w", frames: 48 }).strength === 1);
check("summary", /^Viggle swap \(H3\) · 120 frames \(5\.00s from 5\.50s\) · DMD LoRA @ 0\.9 · 864x480 · 3 steps · \+1 LoRA\(s\)$/.test(VS.summary(p)), VS.summary(p));
check("size: the video's aspect at 480 (Viggle's canvas), or ⚙'s fixed size", JSON.stringify(VS.sizeFor({}, 1920, 1080)) === '{"width":864,"height":480,"auto":true}'
  && JSON.stringify(VS.sizeFor({ auto_size: false, width: 1152, height: 640 }, 1920, 1080)) === '{"width":1152,"height":640,"auto":false}');
check("⚙: viggle_steps 3 / viggle_strength 1 by default, clamped", RS.settingsBlank().viggle_steps === 3 && RS.settingsBlank().viggle_strength === 1
  && RS.settingsSafe({ viggle_steps: 999 }).viggle_steps === 50 && RS.settingsSafe({ viggle_strength: 9 }).viggle_strength === 3
  && RS.settingsSafe({ viggle_strength: 0 }).viggle_strength === 0);

check("2.346.0: the Sol-Attn speed patch is OFF unless ⚙ ticks it (it aborted ComfyUI on Tim's run)",
  RS.settingsBlank().viggle_solattn === false && RS.settingsSafe({ viggle_solattn: "yes" }).viggle_solattn === false && RS.settingsSafe({ viggle_solattn: true }).viggle_solattn === true
  && VS.jobParams({ workflow: "w", frames: 48 }).speed_patch === false && VS.jobParams({ workflow: "w", frames: 48, solattn: true }).speed_patch === true);
check("...the worker steps over SolAttnPatch unless asked, and says so", read("viggle_worker.py").includes('if not params.get("speed_patch") and "SolAttnPatch" not in skip and "SolAttnPatch" in info:')
  && read("viggle_worker.py").includes("the Sol-Attn speed patch is off"));

// ---- 1b. 2.350.0 (Tim: "the Viggle render came back ALL BLACK ... this was with viggle")
const SS = require(path.join(ROOT, "lib", "swapSession"));
check("2.350.0 ⚙ viggle_safe: off by default, only true is true; the job carries it",
  RS.settingsBlank().viggle_safe === false && RS.settingsSafe({ viggle_safe: "yes" }).viggle_safe === false && RS.settingsSafe({ viggle_safe: true }).viggle_safe === true
  && VS.jobParams({ workflow: "w", frames: 48 }).safe === false && VS.jobParams({ workflow: "w", frames: 48, safe: true }).safe === true);
{
  const st0 = { results: [{ id: "r1", seg: "a", job: "x", status: "running" }, { id: "r2", seg: "b", job: "y", status: "running" }] };
  const s1 = SS.sync(st0, (id) => ({ status: "done", output: id + ".mp4", safe: id === "x" }), (r, out) => out);
  check("2.350.0 sync: a take safe mode rescued is marked (and saved), and sync says so once",
    s1.safe === true && s1.state.results[0].safe === true && !("safe" in s1.state.results[1]) && SS.safe(s1.state).results[0].safe === true, s1);
  const s2 = SS.sync(s1.state, () => ({ status: "done", output: "z.mp4", safe: true }), (r, out) => out);
  check("...an already-filed row does not say it again", s2.safe === false);
}

// ---- 2. the wiring
const R = read("routes", "swapdlg.js"), CORE = read("lib", "core.js"), W = read("viggle_worker.py");
check("2.350.0 routes: jobOf reads the worker's \"safe mode fixed it\"; current() then switches ⚙ Viggle safe mode on",
  R.includes("safe: j.status === \"done\" && (j.log || []).some((l) => /\\[worker\\] safe mode fixed it/.test(String(l)))")
  && R.includes("if (s.safe && s.state.settings.viggle_safe !== true) s.state.settings = RS.settingsSafe({ ...s.state.settings, viggle_safe: true });"));
check("core: mode viggle -> viggle_worker.py", /viggle: "viggle_worker\.py"/.test(CORE));
check("routes: queue() sends the first-frame engines to queueRipple with the engine; /run makes their first frames; ⏫ refused",
  R.includes("if (RS.usesFirstFrame(o.engine || st.engine)) return queueRipple(st, seg, { ...o, engine: o.engine || st.engine });")
  && R.includes("if (RS.usesFirstFrame(st.engine)) {") && R.includes("if (upscale && RS.usesFirstFrame(r0.engine))"));
check("routes: Viggle = its own workflow, size (480), ⚙ viggle_steps / viggle_strength, the swap LoRAs, its summary",
  R.includes("const WF = viggle ? VS.WORKFLOW : RS.WORKFLOW;") && R.includes("const sz = (viggle ? VS : RS).sizeFor(set, vi.width, vi.height);")
  && R.includes("steps: set.viggle_steps, strength: set.viggle_strength, loras: swapLoras(),") && R.includes("solattn: set.viggle_solattn, safe: set.viggle_safe })") && R.includes("note: (native ? VN : viggle ? VS : RS).summary(p)"));
check("routes: the auto-render after a first frame works for any first-frame engine (the row keeps the engine)",
  R.includes("if (!seg || !RS.usesFirstFrame(st.engine) || !st.picture) continue;") && R.includes("aim: null, engine: st.engine }).state;"));
check("worker: the cut, the optional speed patches stepped over, the pack named, the models matched, the finish without dropping a frame",
  W.includes("LG.ripple_cut_args(src, clip,") && W.includes("VG.bypass(g0, skip)") && W.includes("github.com/Saganaki22/ComfyUI-Viggle-Animate-H3")
  && W.includes("name = pick(listed, want, pat)") && W.includes("RG.finish_args(raw, clip, output_dir / name, keep, has_a, drop_first=False)"));
check("the workflow ships (Tim's upload, verbatim)", JSON.parse(read("comfy_workflows", "viggle_animate_h3_api.json"))["1"].class_type === "ViggleAnimateConditioning");
const NP = JSON.parse(read("lib", "nodePacks.json")).packs, CAT = JSON.parse(read("lib", "modelCatalog.json"));
check("Setup: the Viggle pack (Saganaki22/ComfyUI-Viggle-Animate-H3)", NP.some((x) => x.id === "viggle" && x.url === "https://github.com/Saganaki22/ComfyUI-Viggle-Animate-H3"
  && x.provides.includes("ViggleAnimateConditioning") && x.provides.includes("ViggleTextCondLoader")));
check("Setup: the Viggle models (pruned int8 model, DMD r64 LoRA, the text conditioning) in their own group",
  CAT.groups.some((g) => g.id === "video_viggle")
  && ["viggle_pruned:comfy/diffusion_models:diffusion_models/minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors",
      "viggle_dmd:comfy/loras:loras/viggle_animate_dmd_lora_r64.safetensors",
      "viggle_textcond:comfy/text_cond:text_cond/fixed_embed_fwd_anyframe.safetensors"].every((k) => {
        const [id, dest, file] = k.split(":");
        return CAT.models.some((m) => m.id === id && m.dest === dest && m.file === file && m.repo === "drbaph/Viggle-Animate-ComfyUI" && m.group === "video_viggle" && m.size > 0);
      }));

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
  let STATE = { video: "movie.mp4", picture: "p.png", text: "", max: 5, ceiling: 362, max_seconds: 15, best_seconds: 5, picture_url: "",
    engine: "h3", engines: RS.ENGINES, quality: "full", segments: [{ id: "g1", start: 0, dur: 5, frames: 120 }], results: [],
    settings: RS.settingsBlank(), video_info: { width: 1920, height: 1080 }, render_size: { width: 1376, height: 768, auto: true }, loras: [] };
  const calls = [];
  w.fetch = async (url, o) => {
    const body = o && typeof o.body === "string" ? JSON.parse(o.body) : null;
    calls.push({ url, body });
    const J = (x) => ({ ok: true, json: async () => x });
    if (url === "/api/swapdlg/set" && body && body.engine) { STATE = { ...STATE, engine: body.engine, render_size: { width: 864, height: 480, auto: true } }; return J(STATE); }
    if (url === "/api/swapdlg/set" && body && body.settings) { STATE = { ...STATE, settings: { ...STATE.settings, ...body.settings } }; return J(STATE); }
    if (url === "/api/swapdlg") return J(STATE);
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
  const eng = dlg.querySelector(".swEng");
  check("Engine: MiniMax H3 / LTX Ripple / Viggle (H3)", Array.from(eng.options).map((x) => x.textContent).join() === "MiniMax H3,LTX Ripple,Viggle (H3),Viggle (native)");
  eng.value = "viggle"; eng.dispatchEvent(new w.Event("change"));
  await new Promise((r) => setTimeout(r, 40));
  check("on Viggle: the ✎ first-frame strip + ✎ First frames shown, Quality + ⏫ hidden, the line says what happens",
    !dlg.querySelector(".swFF").hidden && !dlg.querySelector(".swFFAll").hidden && dlg.querySelector(".swQualL").hidden && dlg.querySelector(".swUp").hidden
    && /Viggle: ⇄ Swap makes each segment's ✎ first frame .* Viggle-Animate on MiniMax H3, 3 steps/.test(dlg.querySelector(".swMsg").textContent), dlg.querySelector(".swMsg").textContent);
  dlg.querySelector(".swBar .swSet").click();
  await new Promise((r) => setTimeout(r, 20));
  const sd = d.querySelector("dialog.swSetDlg[open]");
  check("⚙: Viggle steps 3, Viggle DMD 1", sd.querySelector(".ssVSteps").value === "3" && sd.querySelector(".ssVStr").value === "1");
  check("⚙ ⟲ from video on Viggle = the video's aspect at 480", JSON.stringify(SD._api.sizeFrom(1920, 1080)) === '{"width":864,"height":480}');
  sd.querySelector(".ssVSteps").value = "5"; sd.querySelector(".ssVStr").value = "0.8";
  await SD._api.saveSettings();
  const c = calls.filter((x) => x.url === "/api/swapdlg/set" && x.body.settings).pop();
  check("...Save sends viggle_steps / viggle_strength", c && c.body.settings.viggle_steps === 5 && c.body.settings.viggle_strength === 0.8, c && c.body);
  const n = SD._api.failNews({ segments: [{ id: "g1", ff: { status: "running" } }], results: [] },
                             { segments: [{ id: "g1", ff: { status: "done" } }], results: [{ id: "r1", seg: "g1", status: "queued", engine: "viggle" }] });
  check("the news line names Viggle for a render that started on its own", /▶ #1 has its first frame - rendering with Viggle/.test(n), n);
  // 2.350.0
  dlg.querySelector(".swBar .swSet").click();
  await new Promise((r) => setTimeout(r, 20));
  const sd2 = d.querySelector("dialog.swSetDlg[open]");
  const sf = sd2.querySelector(".ssVSafe"), sp = sd2.querySelector(".ssVSol");
  check("2.350.0 ⚙: \"speed patches (Sol-Attn + fp16 accumulation)\" + \"safe mode\", both off", sf && !sf.checked && !sp.checked
    && /speed patches \(Sol-Attn \+ fp16 accumulation\)/.test(sp.parentNode.textContent) && /safe mode \(a black take is re-rendered like this automatically\)/.test(sf.parentNode.textContent));
  sf.checked = true;
  await SD._api.saveSettings();
  const c2 = calls.filter((x) => x.url === "/api/swapdlg/set" && x.body.settings).pop();
  check("...Save sends viggle_safe", c2 && c2.body.settings.viggle_safe === true && c2.body.settings.viggle_solattn === false, c2 && c2.body);
  const n3 = SD._api.failNews({ segments: [{ id: "g1" }], results: [{ id: "r1", seg: "g1", status: "running", engine: "viggle" }] },
                              { segments: [{ id: "g1" }], results: [{ id: "r1", seg: "g1", status: "done", engine: "viggle", safe: true }] });
  check("the news line: a black take safe mode rescued, and that ⚙ safe mode is on now", /🛟 #1 came back black - safe mode rendered it; ⚙ Viggle safe mode is on now/.test(n3), n3);
  done();
})();
function done() {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
