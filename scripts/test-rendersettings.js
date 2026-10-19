#!/usr/bin/env node
/* bitGen Studio — 2.312.0: THE VIDEO DOCKER'S ⚙ RENDER SETTINGS.
 * Run: node scripts/test-rendersettings.js
 *
 * Tim (verbatim): "add a settings button to the right of the video docker
 * menu bar. in the video docker . on click show a dropdown, with
 * resolution, steps, cfg, lora adder, sage attention checkbox, spectrum
 * checkbox, comfy kitchen checkbox, upscaler dropdown, upscale resolution.
 * Add a workflow for comfyui upscaler,
 * https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale".
 *   1. lib/renderSettings: normalize, the size rules, the upscale size,
 *      jobOverrides (blank = unchanged; accelerators; Kitchen = fp8 load;
 *      the upscale stage, skipped when not larger), save/read LIVE;
 *   2. the wiring: both board job builders, the routes, the pack entry,
 *      the model category;
 *   3. jsdom: the ⚙ sits at the right end of the menubar, opens the panel,
 *      paints the record, saves on change, lists the upscalers, the LoRA
 *      adder uses the core rows, the pack install button.
 * The worker's stage splice runs in scripts/test-upscalestage.py; a board
 * render carrying all of it runs LIVE in the e2e. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const RS = require(path.join(ROOT, "lib", "renderSettings"));

// ---- 1. the lib -----------------------------------------------------------------------
{
  const n = RS.normalize({ res: "720", aspect: "9:16", steps: "8", cfg: "4.25", sage: true, spectrum: "yes",
    kitchen: true, upscaler: "up.safetensors", upscale_res: "2160" });
  check("normalize keeps the valid fields (a non-boolean checkbox is off)",
    n.res === "720" && n.aspect === "9:16" && n.steps === 8 && n.cfg === 4.25 && n.sage === true
    && n.spectrum === false && n.kitchen === true && n.upscaler === "up.safetensors" && n.upscale_res === "2160", n);
  const j = RS.normalize({ res: "999", aspect: "2:1", steps: 0, cfg: "", upscaler: "../x", upscale_res: "5" });
  check("...and blanks the junk (unknown size / aspect, steps 0, empty cfg, a path escape, an unknown upscale size)",
    j.res === "" && j.aspect === "16:9" && j.steps === null && j.cfg === null && j.upscaler === "" && j.upscale_res === "1080", j);
  check("dims: Basic Settings' rule (short side, 16-px aligned)",
    JSON.stringify(RS.dims("720", "16:9")) === '{"width":1280,"height":720}'
    && JSON.stringify(RS.dims("540", "9:16")) === '{"width":544,"height":960}' && RS.dims("", "16:9") === null,
    [RS.dims("720", "16:9"), RS.dims("540", "9:16")]);
  check("upscaleDims: the short side, 32-px aligned, the render's aspect (1080 of 1280x720 = 1920x1088, the export's own size)",
    JSON.stringify(RS.upscaleDims("1080", 1280, 720)) === '{"width":1920,"height":1088}'
    && JSON.stringify(RS.upscaleDims("2160", 720, 1280)) === '{"width":2176,"height":3872}', RS.upscaleDims("2160", 720, 1280));
  const style = { name: "MMH3_NativeAudio_MV", accel: { sage: "off", spectrum: "off" }, phases: [{ model: "" }] };
  const blank = RS.jobOverrides(RS.normalize({}), { width: 960, height: 544, style });
  check("jobOverrides, nothing set: the job keeps its size, steps 0, cfg 1, no upscale, accelerators off",
    blank.width === 960 && blank.height === 544 && blank.steps === 0 && blank.cfg === 1 && blank.upscale_stage === null
    && blank.video_style.accel.sage === "off" && blank.video_style.accel.spectrum === "off" && !blank.video_style.phases[0].dtype, blank);
  const full = RS.jobOverrides(n, { width: 960, height: 544, style });
  check("jobOverrides, everything set: 720p 9:16, steps 8, cfg 4.25, Sage auto, Spectrum off, Kitchen loads fp8_e4m3fn_fast",
    full.width === 720 && full.height === 1280 && full.steps === 8 && full.cfg === 4.25
    && full.video_style.accel.sage === "auto" && full.video_style.accel.spectrum === "off"
    && full.video_style.phases[0].dtype === "fp8_e4m3fn_fast" && style.phases[0].dtype === undefined, full);
  check("...the upscale stage: the file and 2160p of 720x1280 = 2176x3872",
    full.upscale_stage && full.upscale_stage.model === "up.safetensors"
    && full.upscale_stage.width === 2176 && full.upscale_stage.height === 3872, full.upscale_stage);
  check("2.315.0: upscale_auto is OFF by default - the stage is described (the ⚙ preview) but a render does not run it, said",
    RS.normalize({}).upscale_auto === false && full.upscale_auto === false
    && full.notes.some((x) => /upscaler ready: up\.safetensors -> 2176x3872 - ⏫ upscales a take/.test(x))
    && RS.jobOverrides(RS.normalize({ ...n, upscale_auto: true }), { width: 960, height: 544, style }).upscale_auto === true
    && RS.normalize({ upscale_auto: "yes" }).upscale_auto === false, full.notes);
  const small = RS.jobOverrides(RS.normalize({ res: "1080", upscaler: "up.safetensors", upscale_res: "720" }), { width: 1, height: 1, style });
  check("...an upscale that is not larger than the render is skipped, said",
    small.upscale_stage === null && small.notes.some((x) => /upscale skipped/.test(x)), small.notes);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "rs-"));
  try {
    RS.save(d, { res: "720", sage: true });
    const r1 = RS.save(d, { steps: 12 });
    check("save/read LIVE: a patch merges into the record on disk (render_settings.json)",
      r1.res === "720" && r1.sage === true && r1.steps === 12 && RS.read(d).steps === 12
      && fs.existsSync(path.join(d, "render_settings.json")), r1);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

// ---- 2. the wiring ----------------------------------------------------------------------
{
  const RC = read("routes", "characters.js"), CM = read("lib", "comfy.js"), MD = read("lib", "comfyModels.js");
  check("both board job builders take their size / steps / cfg / style / upscale from the ⚙ record (2.338.0: + the LTX scene's size)",
    (RC.match(/const rs = renderSettings\.jobOverrides\(/g) || []).length === 3
    // 2.409.0: the LTX scene's style carries Basic Settings' temp LoRAs when Override is on
    && RC.includes("const rs = renderSettings.jobOverrides(rsRec, { width: d0.width, height: d0.height,\n    style: extraV.length ? { ...style, loras: tempLoras.merge(style.loras, extraV) } : style });")
    && (RC.match(/width: rs\.width, height: rs\.height, frames, steps: rs\.steps, cfg: rs\.cfg,/g) || []).length === 2
    // 2.315.0: a plain render runs the stage only with "Upscale every render";
    // the ⏫ of a convert-style scene upscales the take itself
    && RC.includes(": rs.upscale_stage && rs.upscale_auto && !upscale ? { upscale_stage: rs.upscale_stage } : {}),")
    && RC.includes("...(rs.upscale_stage && rs.upscale_auto ? { upscale_stage: rs.upscale_stage } : {}),"));
  check("the routes: GET/POST /api/scenes/render-settings (the LoRAs and the pack state ride the GET)",
    RC.includes('app.get("/api/scenes/render-settings"') && RC.includes('app.post("/api/scenes/render-settings"')
    && RC.includes('loras: tempLoras.read(pdir, "video"), upscale_pack: pack,'));
  check("the pack: Settings' pack installer knows the MMH3 Ultimate Upscale repo; packInstalled is a cheap folder check",
    CM.includes('upscale: { url: "https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale.git",')
    && CM.includes("function packInstalled(what)"));
  check("the models scan knows latent_upscale_models (folder + the pack's loader combo)",
    MD.includes('latent_upscale_models: ["latent_upscale_models"],')
    && MD.includes('latent_upscale_models: [["MMH3LatentUpscaleWithModelParams", "model_name"]],'));
  check("the upscaler workflow ships: comfy_workflows/MMH3_UltimateUpscale_stage.json",
    fs.existsSync(path.join(ROOT, "comfy_workflows", "MMH3_UltimateUpscale_stage.json")));
}

// ---- 3. jsdom: the ⚙ --------------------------------------------------------------------------
{
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const posts = [], mounted = [], added = [];
let saved = { res: "", aspect: "16:9", steps: null, cfg: null, sage: false, spectrum: false, kitchen: false, upscaler: "", upscale_res: "1080" };
w.mountTempLoras = (kind, host, list) => mounted.push([kind, host, list]);
w.addTempLoraTo = (kind, host) => added.push([kind, host]);
w.fetch = (u, o) => {
  u = String(u).split("?")[0];
  const ok = (b) => Promise.resolve({ ok: true, json: () => Promise.resolve(b) });
  if (u === "/api/scenes/render-settings" && o && o.method === "POST") {
    const b = JSON.parse(o.body); posts.push(b.settings); saved = { ...saved, ...b.settings };
    return ok({ saved: true, settings: saved, preview: { width: 1280, height: 720, upscale: saved.upscaler ? { width: 1920, height: 1088 } : null } });
  }
  if (u === "/api/scenes/render-settings")
    return ok({ settings: { ...saved, res: "720", sage: true, upscaler: "old_up.safetensors" }, loras: [{ path: "a.safetensors", weight: 0.8 }],
                upscale_pack: { installed: false } });
  if (u === "/api/comfymodels") return ok({ categories: { latent_upscale_models: { files: [{ name: "minimax_h3_latent_upscaler_3d_bf16.safetensors" }] } } });
  if (u === "/api/comfy/vaccel/install") { posts.push({ install: JSON.parse(o.body) }); return ok({ started: true, target: "custom_nodes/Comfyui-MMH3-UltimateUpscale" }); }
  return ok({});
};
global.window = w; global.document = w.document;
w.eval(fs.readFileSync("ext/videodock/rendersettings.js", "utf8"));
const q = (s) => w.document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = {};
  const bar = q("#mvBar");
  out.last = bar.lastElementChild && bar.lastElementChild.id;
  out.btn = [q("#vdSetBtn").textContent, q("#vdSetBtn").getAttribute("aria-label")];
  out.hidden = q("#vdSetPanel").style.display;
  q("#vdSetBtn").click();
  await wait(80);
  out.open = q("#vdSetPanel").style.display;
  out.painted = [q("#vdSetRes").value, q("#vdSetSage").checked, q("#vdSetUpscaler").value,
    [...q("#vdSetUpscaler").options].map((o) => o.value), q("#vdSetAspect").disabled];
  out.mounted = mounted;
  out.pack = [q("#vdSetPack").textContent, q("#vdSetPackInstall").style.display];
  q("#vdSetSteps").value = "7"; q("#vdSetSteps").dispatchEvent(new w.Event("change"));
  q("#vdSetUpscaler").value = "minimax_h3_latent_upscaler_3d_bf16.safetensors";
  q("#vdSetUpscaler").dispatchEvent(new w.Event("change"));
  q("#vdSetKitchen").checked = true; q("#vdSetKitchen").dispatchEvent(new w.Event("change"));
  await wait(400);
  out.posts = posts.slice();
  out.size = q("#vdSetSize").textContent;
  // 2.315.0: "Upscale every render" - off by default, saved as upscale_auto
  out.autoBefore = [q("#vdSetUpAuto").checked, q("#vdSetUpAuto").disabled];
  q("#vdSetUpAuto").checked = true; q("#vdSetUpAuto").dispatchEvent(new w.Event("change"));
  await wait(400);
  out.autoPost = posts[posts.length - 1];
  out.size2 = q("#vdSetSize").textContent;
  q("#vdSetLoraAdd").click();
  out.added = added;
  q("#vdSetPackInstall").click();
  await wait(60);
  out.install = posts.find((p) => p.install);
  out.msg = q("#vdSetMsg").textContent;
  w.document.body.click();
  out.closed = q("#vdSetPanel").style.display;
  console.log("@@RS " + JSON.stringify(out));
  process.exit(0);
})();`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@RS ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 600) }; }
  check("jsdom: the ⚙ is the LAST thing in the video docker's menubar, labelled, the panel shut",
    d && d.last === "vdSetWrap" && d.btn[0] === "⚙" && d.btn[1] === "Render settings" && d.hidden === "none", d);
  check("jsdom: ⚙ opens the panel and paints the record (720p, Sage on, a saved upscaler not in the scan kept; 2.400.0 SeedVR2 (video) after Off)",
    d && d.open === "flex" && JSON.stringify(d.painted)
      === '["720",true,"old_up.safetensors",["","seedvr2","dlss5","minimax_h3_latent_upscaler_3d_bf16.safetensors","old_up.safetensors"],false]', d && d.painted);
  check("jsdom: the LoRA rows are the core's, on the same video list (mountTempLoras into the panel)",
    d && JSON.stringify(d.mounted) === '[["video","vdSetLoras",[{"path":"a.safetensors","weight":0.8}]]]'
    && JSON.stringify(d.added) === '[["video","vdSetLoras"]]', d && [d.mounted, d.added]);
  check("jsdom: changes save (debounced into ONE post with the whole record: steps 7, the upscaler, Kitchen)",
    d && d.posts.length === 1 && d.posts[0].steps === 7 && d.posts[0].kitchen === true
    && d.posts[0].upscaler === "minimax_h3_latent_upscaler_3d_bf16.safetensors" && d.posts[0].res === "720", d && d.posts);
  check("jsdom: the answer's preview says the size (1280x720, ⏫ upscales a take to 1920x1088 - 2.315.0 no auto upscale)",
    d && /renders at 1280x720 · ⏫ upscales a take to 1920x1088/.test(d.size), d && d.size);
  check("jsdom (2.315.0): \"Upscale every render\" starts OFF (enabled once an upscaler is picked), saves upscale_auto, and the preview then says every render is upscaled",
    d && JSON.stringify(d.autoBefore) === "[false,false]" && d.autoPost && d.autoPost.upscale_auto === true
    && /renders at 1280x720 -> upscaled to 1920x1088/.test(d.size2), d && [d.autoBefore, d.autoPost, d.size2]);
  check("jsdom: no pack -> it says so and ⬇ clones it (what: upscale)",
    d && /not in ComfyUI's custom_nodes/.test(d.pack[0]) && d.pack[1] === ""
    && d.install && d.install.install.what === "upscale" && /restart ComfyUI/.test(d.msg), d && [d.pack, d.install, d.msg]);
  check("jsdom: a click outside closes it", d && d.closed === "none", d && d.closed);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
