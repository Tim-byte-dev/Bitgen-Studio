#!/usr/bin/env node
/* bitGen Studio — 2.316.0: BASIC SETTINGS -> CONTROLNET, the app side.
 * Run: node scripts/test-cnbasic.js
 *
 * Tim (verbatim): "add controlnet accordian menuitem to basic settings in left
 * docker, checkbox - use controlnet, dropdown-types, dropdown-preprocessor,
 * dropdown model folder, dropdown model, cfg slider, steps slider, lora folder,
 * lora dropdown, add lora button, lora weight slider. show the first image
 * generated, the controlnet preprocessor gen and the final generation in the
 * gallery"
 *   1. lib/cnBasics: normalize, save/read LIVE, jobSpec (off / no model / on);
 *   2. the "cnet" temporary LoRA list (lib/tempLoras);
 *   3. the routes: GET/POST /api/controlnet/basic, /api/temploras carries cnet,
 *      /api/genimage attaches the pass only when the request asks for it.
 * The accordion runs in test-imagedom.js; the graphs in test-cnstage.py; the
 * whole path LIVE in the e2e. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const CB = require(path.join(ROOT, "lib", "cnBasics"));
const TL = require(path.join(ROOT, "lib", "tempLoras"));

// ---- 1. the record ------------------------------------------------------------------------
{
  const d0 = CB.normalize({});
  check("normalize: off by default, Pose, no ControlNet, no second model, its own steps / cfg, strength 1",
    d0.v === 2 && d0.enabled === false && d0.type === "pose" && d0.controlnet === "" && d0.model === ""
    && d0.model_cat === "" && d0.steps === null && d0.cfg === null && d0.strength === 1, d0);
  const n = CB.normalize({ v: 2, enabled: true, type: "DEPTH", controlnet: "sdxl/depth.safetensors",
    model: "SDXL/jugg.safetensors", model_cat: "checkpoints", steps: "28", cfg: "4.55", strength: 3 });
  check("...keeps the valid fields (type case-folded, cfg to 0.1, strength capped at 2)",
    n.enabled && n.type === "depth" && n.controlnet === "sdxl/depth.safetensors" && n.model === "SDXL/jugg.safetensors"
    && n.model_cat === "checkpoints" && n.steps === 28 && n.cfg === 4.6 && n.strength === 2, n);
  const j = CB.normalize({ v: 2, enabled: "yes", type: "canny", controlnet: "../x", model: "../y", model_cat: "loras", steps: 0, cfg: 0 });
  check("...and blanks the junk (a non-boolean tick, an unknown type / category, path escapes, steps / cfg 0 = the model's own)",
    j.enabled === false && j.type === "pose" && j.controlnet === "" && j.model === "" && j.model_cat === ""
    && j.steps === null && j.cfg === null, j);
  check("2.320.0: final_only - off by default, a real tick only, carried to the job",
    CB.normalize({}).final_only === false && CB.normalize({ final_only: "yes" }).final_only === false
    && CB.normalize({ final_only: true }).final_only === true
    && CB.jobSpec({ v: 2, enabled: true, final_only: true, controlnet: "c", model: "SDXL/x.safetensors", model_cat: "checkpoints" },
                  [], [], ROOT).final_only === true);
  // 2.321.0 (Tim: "add the second model prompt + negative prompt, the strength
  // slider and the end slider and a checkbox above the positive prompt to use
  // prompt docker prompt")
  const pr = CB.normalize({ use_main_prompt: false, prompt: "  photo... realistic, a woman  ", negative: "anime, cartoon",
                            strength: 0.63, end: 0.7 });
  check("2.321.0 record: Use prompt docker prompt ON by default; the second model's prompt / negative keep every character (an ellipsis too); strength 0-2; end 5-100%",
    CB.normalize({}).use_main_prompt === true && CB.normalize({}).end === 1 && CB.normalize({}).prompt === ""
    && pr.use_main_prompt === false && pr.prompt === "photo... realistic, a woman" && pr.negative === "anime, cartoon"
    && pr.strength === 0.63 && pr.end === 0.7 && CB.normalize({ end: 0 }).end === 0.05 && CB.normalize({ end: 5 }).end === 1, pr);
  const base = { v: 2, enabled: true, controlnet: "c", model: "SDXL/x.safetensors", model_cat: "checkpoints" };
  const jOwn = CB.jobSpec({ ...base, use_main_prompt: false, prompt: "photo", negative: "cartoon", strength: 0.6, end: 0.75 }, [], [], ROOT);
  const jMain = CB.jobSpec({ ...base, prompt: "ignored while ticked" }, [], [], ROOT);
  check("...jobSpec: its own prompt only when unticked (an empty one is refused in words), the negative when written, strength + end always",
    jOwn.prompt === "photo" && jOwn.negative === "cartoon" && jOwn.use_main_prompt === false && jOwn.strength === 0.6 && jOwn.end === 0.75
    && !("prompt" in jMain) && !("negative" in jMain) && jMain.use_main_prompt === true && jMain.end === 1
    && /the second model's prompt is empty/.test(CB.jobSpec({ ...base, use_main_prompt: false }, [], [], ROOT).error), [jOwn, jMain]);
  const old = CB.normalize({ enabled: true, type: "depth", preprocessor: "x.pth", model: "sdxl/depth_cn.safetensors" });
  check("2.317.0: a 2.316.0 record (the ControlNet in `model`) moves it to `controlnet`, the second model left to pick",
    old.controlnet === "sdxl/depth_cn.safetensors" && old.model === "" && !("preprocessor" in old), old);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "cnb-"));
  try {
    CB.save(d, { v: 2, enabled: true, type: "lineart" });
    const r = CB.save(d, { v: 2, controlnet: "cn.safetensors" });
    check("save/read LIVE: a patch merges into projects/<p>/controlnet_basic.json",
      r.enabled && r.type === "lineart" && r.controlnet === "cn.safetensors" && CB.read(d).controlnet === "cn.safetensors"
      && fs.existsSync(path.join(d, "controlnet_basic.json")), r);
    // ---- 2. the cnet LoRA list
    TL.write(d, "cnet", [{ path: "cn/a.safetensors", weight: 0.7 }]);
    check("the ControlNet LoRAs are the \"cnet\" temporary list (projects/<p>/cnet-loras-temp.json)",
      TL.KINDS.includes("cnet") && fs.existsSync(path.join(d, "cnet-loras-temp.json"))
      && TL.read(d, "cnet")[0].path === "cn/a.safetensors" && TL.read(d, "cnet")[0].weight === 0.7);
    let threw = "";
    try { TL.write(d, "music", []); } catch (e) { threw = e.message; }
    check("...an unknown kind is still refused (2.342.0: + swap)", /image, video, cnet or swap/.test(threw), threw);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
  // ---- the SECOND model's workflow
  const STY = [{ id: "s1", name: "Aisha", kind: "image", engine: "comfy", workflow: "comfy_workflows/x.json",
                 model: "flux_klein_9B\\aisha.safetensors", loras: [{ path: "a", weight: 1 }] },
               { id: "s2", name: "Chain", kind: "image", chain: { first_id: "s1" }, model: "jugg.safetensors" }];
  const sec = (model, cat) => CB.secondStyle({ v: 2, model, model_cat: cat }, STY, ROOT);
  const own = sec("flux_klein_9B/aisha.safetensors", "diffusion_models");
  check("secondStyle: an image style that already renders the file wins (its workflow; its LoRAs dropped - they belong to its own look)",
    own.style && own.style.id === "s1" && own.style.workflow === "comfy_workflows/x.json" && own.style.loras.length === 0
    && /image style "Aisha"/.test(own.how), own);
  const ck = sec("SDXL/jugg.safetensors", "checkpoints"), kl = sec("flux-2-klein-9b.safetensors", "diffusion_models"),
        kb = sec("flux-2-klein-base-9b-fp8.safetensors", "diffusion_models"), kc = sec("flux-2-klein-9b.safetensors", "checkpoints");
  check("...else by family: a checkpoint -> the SDXL template; a Klein unet -> the Klein template (base -> base); a Klein checkpoint -> the Klein checkpoint template",
    ck.style.workflow === CB.TEMPLATES.sdxl && ck.style.model === "SDXL/jugg.safetensors" && ck.style.model_override === true
    && kl.style.workflow === CB.TEMPLATES.klein && kb.style.workflow === CB.TEMPLATES.klein_base
    && kc.style.workflow === CB.TEMPLATES.klein_ckpt && kl.style.arch === "flux2klein9b" && ck.style.arch === "sdxl"
    && Object.values(CB.TEMPLATES).every((t) => fs.existsSync(path.join(ROOT, t))), [ck, kl, kb, kc]);
  check("...an unknown diffusion model / no model is refused in words (make an image style for it)",
    /save an image style that uses it/.test(sec("qwen_image.safetensors", "diffusion_models").error)
    && /pick the second model/.test(sec("", "").error));
  check("jobSpec: off -> null; no ControlNet -> names the Preprocessor; on -> the ControlNet + the second model + its LoRAs",
    CB.jobSpec({ enabled: false }) === null
    && /no ControlNet is picked \(Basic Settings -> ControlNet -> Preprocessor/.test(CB.jobSpec({ v: 2, enabled: true }).error)
    && /pick the second model/.test(CB.jobSpec({ v: 2, enabled: true, controlnet: "c" }, [], STY, ROOT).error)
    && (() => { const x = CB.jobSpec({ v: 2, enabled: true, type: "depth", controlnet: "c.safetensors", model: "SDXL/jugg.safetensors",
        model_cat: "checkpoints", steps: 20 }, [{ path: "l", weight: 0.5 }], STY, ROOT);
      return x.node === "DepthAnythingV2Preprocessor" && x.controlnet === "c.safetensors" && x.steps === 20
        && x.second.workflow === CB.TEMPLATES.sdxl && x.loras[0].path === "l" && /img_sdxl_t2i/.test(x.second_how); })());
}

// ---- 3. the routes ----------------------------------------------------------------------------
{
  const RI = read("routes", "index.js");
  check("GET/POST /api/controlnet/basic (the record + its LoRAs + the types)",
    RI.includes('app.get("/api/controlnet/basic"') && RI.includes('app.post("/api/controlnet/basic"')
    && RI.includes('res.json({ settings: cnBasics.read(pdir), loras: tempLoras.read(pdir, "cnet"),'));
  check("/api/temploras and the project answer carry the cnet list",
    RI.includes('cnet: tempLoras.read(pdir, "cnet") });          // 2.316.0')
    && RI.includes('cnet: tempLoras.read(pdir, "cnet") };   // 2.111.0 (+ 2.316.0 ControlNet)'));
  check("/api/genimage attaches the pass only when the request asks - 2.318.0: with the panel's settings sent inline (always on), or true = the saved record",
    RI.includes('if (b.controlnet === true || (b.controlnet && typeof b.controlnet === "object")) {')
    && RI.includes('? cnBasics.normalize({ ...b.controlnet, v: 2, enabled: true }) : cnBasics.read(pdir);')
    && RI.includes("const cn = cnBasics.jobSpec(rec, tempLoras.read(pdir, \"cnet\"),")
    && RI.includes('styles.read(core.STYLES_DIR, "image"), core.BASE);')
    && RI.includes("if (cn && cn.error) return res.status(400).json({ error: cn.error });")
    && RI.includes("if (cn) p.controlnet = cn; }")
    && RI.includes('if (cn && cn.final_only) cn.temp_dir = path.join(pdir, "temp", "controlnet");'));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
