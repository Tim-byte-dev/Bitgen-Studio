#!/usr/bin/env node
/* bitGen Studio — scripts/test-fibo582.js (2.582.0): Fibo 2.0 in the edit tools - the two styles and their graphs
 * (comfy_workflows/img_fibo2_*.json), the image editor's ✨ Edit taking them (lib/aiEdit.js), the pictures named
 * <image_1>.. (lib/refWords.js, lib/qwenRefs.js), the files (lib/modelCatalog.json group fibo), Settings ▸ Add-ons ▸ Fibo
 * 2.0 (lib/fiboAddon.js: the w4a8 default, GGUF -> ComfyUI-GGUF, the shared encoder / VAE kept on remove), the families.
 * Tim: "please add fibo to the model edit tools https://huggingface.co/realrebelai/Fibo-2.0_GGUFs/tree/main. this model
 * should work with very low vram". No ComfyUI, no downloads. The graph patching itself: scripts/test-comfyimage.py. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const styles = require("../lib/styles");
  const st = (styles.STARTER_STYLES || []).filter((s) => /^Fibo 2\.0/.test(s.name));
  const T = st.find((s) => s.name === "Fibo 2.0 Edit Turbo"), Dv = st.find((s) => s.name === "Fibo 2.0 Dev");
  check("two starter styles: Fibo 2.0 Edit Turbo (4 steps, cfg 1) + Fibo 2.0 Dev (30 steps, cfg 5, pictures optional), arch fibo2, ComfyUI",
    T && Dv && T.arch === "fibo2" && T.engine === "comfy" && T.steps === 4 && T.cfg === 1 && Dv.steps === 30 && Dv.cfg === 5 && Dv.refs_optional === true, st);
  check("arch fibo2 in the catalogue (ComfyUI only, Qwen3-VL 4B + FLUX.2 VAE)", styles.archIds().includes("fibo2") && (() => { const a = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "imageArch.json"), "utf8")).archs.find((x) => x.id === "fibo2"); return a && a.comfy_only && /fibo2/.test(a.te[0].hint) && /flux2-vae/.test(a.vae.hint); })());
  for (const [f, unet, steps, cfg] of [["img_fibo2_edit.json", "fibo2_edit_turbo_w4a8_convrot.safetensors", 4, 1], ["img_fibo2_dev.json", "fibo2_dev_w4a8_convrot.safetensors", 30, 5]]) {
    const g = JSON.parse(fs.readFileSync(path.join(ROOT, "comfy_workflows", f), "utf8"));
    const by = (c) => Object.entries(g).filter(([k, v]) => k[0] !== "_" && v.class_type === c);
    const enc = by("TextEncodeFibo2")[0][1].inputs, ks = by("KSampler")[0][1].inputs;
    check(f + ": the repo's layout - UNETLoader (the w4a8 file) / CLIPLoader type fibo2 (Qwen3-VL 4B int8) / FLUX.2 VAE / TextEncodeFibo2 -> KSampler (positive 0, negative 1, latent 2), euler / simple",
      by("UNETLoader")[0][1].inputs.unet_name === unet && by("CLIPLoader")[0][1].inputs.type === "fibo2" && by("CLIPLoader")[0][1].inputs.clip_name === "qwen3vl_4b_int8_convrot.safetensors"
      && by("VAELoader")[0][1].inputs.vae_name === "flux2-vae.safetensors" && JSON.stringify([ks.positive, ks.negative, ks.latent_image]) === JSON.stringify([["10", 0], ["10", 1], ["10", 2]])
      && ks.steps === steps && ks.cfg === cfg && ks.sampler_name === "euler" && ks.scheduler === "simple" && enc.negative_prompt === "", { enc, ks });
    check(f + ": four pictures as images.image_1..4 straight from LoadImage (the prompt on a Primitive)",
      ["images.image_1", "images.image_2", "images.image_3", "images.image_4"].every((k) => Array.isArray(enc[k])) && by("LoadImage").length === 4 && JSON.stringify(enc.prompt) === '["9",0]');
  }
  const AE = require("../lib/aiEdit");
  check("the image editor's ✨ Edit takes both (TextEncodeFibo2 is an edit encoder) - the crop is picture 1",
    AE.isEditGraph(ROOT, T.workflow) && AE.isEditGraph(ROOT, Dv.workflow) && AE.editGraph(T, ROOT).workflow === T.workflow && AE.editGraph(T, ROOT).slots === 4, AE.editGraph(T, ROOT));
  const RW = require("../lib/refWords"), Q = require("../lib/qwenRefs");
  check("refWords: a Fibo style's pictures are <image_1>.. (its own word); <image_3> is read as a mention; Picture 2 -> <image_2>",
    RW.wordingFor(T, ROOT) === "fibo2" && RW.tag(1, "fibo2") === "<image_1>" && JSON.stringify(RW.mentions("put <image_3> next to picture 1")) === "[3,1]" && RW.retag("the hat from Picture 2", "fibo2") === "the hat from <image_2>"
    && RW.wordingFor(styles.STARTER_STYLES.find((s) => s.name === "Qwen Image 2.1 edit"), ROOT) === "qwen21");
  check("refWords.withRefs (✨ Edit with References pictures): the crop is <image_1>, the docker's picture 1 becomes <image_2>",
    /^<image_1> is the picture to change.*; <image_2> is a reference picture\.\nput the hat from <image_2> on him$/s.test(RW.withRefs("put the hat from picture 1 on him", [1], "fibo2")), RW.withRefs("put the hat from picture 1 on him", [1], "fibo2"));
  const qp = Q.prompt("the person in <Picture 1> wears the jacket", 2, ["person", "clothing"], "fibo2");
  const qn = Q.prompt("a portrait", 2, ["person", "clothing"], "fibo2");
  check("the reference dock with a Fibo style (genimage): <Picture n> -> <image_n>; a prompt naming none gets the line saying what each is",
    Q.refFormat(T, ROOT) === "fibo2" && qp.prompt === "the person in <image_1> wears the jacket" && /^<image_1> is the person, <image_2> is the clothing\.\na portrait$/.test(qn.prompt)
    && Q.prompt("in <Picture 1>", 1, [], "qwen21").prompt === "in <image1>" && Q.refFormat(styles.STARTER_STYLES.find((s) => s.name === "FLUX.1 Kontext edit"), ROOT) === "", { qp, qn });
  const ix = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8");
  check("/api/genimage names the dock's pictures for Qwen 2.1 AND Fibo (qwenRefs.refFormat)", /const refFmt = qwenRefs\.refFormat\(styled, core\.BASE\)/.test(ix) && /qwenRefs\.prompt\(p\.prompt, \(p\.images \|\| \[\]\)\.length, [^\n]*, refFmt\)/.test(ix));

  /* the files */
  const M = require("../lib/setupModels");
  const ids = ["fibo_edit_w4a8", "fibo_edit_q4", "fibo_edit_q5", "fibo_edit_q8", "fibo_edit_int8", "fibo_dev_w4a8", "fibo_dev_q4", "fibo_te", "fibo_vae"];
  const ms = ids.map((i) => M.byId(i));
  check("the catalogue: the low-VRAM files from realrebelai/Fibo-2.0_GGUFs (w4a8 -> diffusion_models, .gguf -> unet), the encoder + VAE from Comfy-Org/Fibo-2.0",
    ms.every(Boolean) && ms[0].repo === "realrebelai/Fibo-2.0_GGUFs" && ms[0].dest === "comfy/diffusion_models" && ms[1].dest === "comfy/unet" && /Q4_0\.gguf$/.test(ms[1].file)
    && ms[7].repo === "Comfy-Org/Fibo-2.0" && ms[7].as === "qwen3vl_4b_int8_convrot.safetensors" && ms[8].as === "flux2-vae.safetensors" && ms.every((m) => m.group === "fibo"), ms.map((m) => m && m.id));
  const FA = require("../lib/fiboAddon");
  check("the add-on: Edit Turbo (w4a8) + the encoder + the VAE by default, the encoder + VAE needed; a GGUF pick needs ComfyUI-GGUF",
    JSON.stringify(FA.wanted()) === '["edit","te","vae"]' && JSON.stringify(FA.wanted(["dev_q4"])) === '["dev_q4","te","vae"]' && FA.needsGguf(FA.wanted(["edit_q4"])) && !FA.needsGguf(FA.wanted(["edit", "dev"])));
  const T2 = fs.mkdtempSync(path.join(os.tmpdir(), "fibo582-"));
  const pl = { ok: true, models: path.join(T2, "models"), customNodes: path.join(T2, "custom_nodes"), python: "" };
  let s0 = FA.status(pl);
  check("status: nothing yet - not installed, nine files with their sizes", !s0.installed && s0.items.length === 9 && s0.items[0].size === "6.6 GB" && /not installed/.test(s0.note), s0.items.map((i) => i.id + " " + i.size));
  const got = [], packs = [], logs = [];
  const fakeDl = async (m) => { got.push(m.id); const p = M.destPath(m, { comfyModels: pl.models, app: T2 }); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "x"); return { ok: true }; };
  let r = await FA.install((l) => logs.push(l), ["edit"], { place: pl, download: fakeDl, packStatus: () => [{ id: "gguf", folder: "ComfyUI-GGUF", url: "u", present: false }], packInstall: async (p) => { packs.push(p.id); return { ok: true }; }, comfy: async () => ({ online: true, fibo2: true }), styles: () => [] });
  check("⤓ the default picks: the w4a8 Edit Turbo + encoder + VAE downloaded, no node pack (no GGUF), the licence said", r.ok && got.join() === "fibo_edit_w4a8,fibo_te,fibo_vae" && !packs.length && logs.some((l) => /CC BY-NC 4\.0/.test(l)) && logs.some((l) => /ComfyUI knows Fibo 2\.0/.test(l)), { r, got, logs });
  s0 = FA.status(pl);
  check("...then installed (a model + the encoder + the VAE)", s0.installed && /ready: Edit Turbo/.test(s0.note), s0.note);
  got.length = 0; logs.length = 0;
  r = await FA.install((l) => logs.push(l), ["edit_q4"], { place: pl, download: fakeDl, packStatus: () => [{ id: "gguf", folder: "ComfyUI-GGUF", url: "u", present: false }], packInstall: async (p) => { packs.push(p.id); return { ok: true }; }, comfy: async () => ({ online: true, fibo2: false }), styles: () => [] });
  check("⤓ a GGUF pick: ComfyUI-GGUF installed first, the .gguf into models/unet; an old ComfyUI is told to update",
    r.ok && packs.join() === "gguf" && got[0] === "fibo_edit_q4" && fs.existsSync(path.join(pl.models, "unet", "fibo2_edit_turbo-Q4_0.gguf")) && logs.some((l) => /does not know Fibo 2\.0 yet - update ComfyUI/.test(l)) && logs.some((l) => /style's Model/.test(l)), { got, logs });
  check("⤓ refused without a model ticked", /tick at least one/.test((await FA.install(() => {}, ["te"], { place: pl, download: fakeDl, styles: () => [] })).error || ""));
  r = await FA.remove(() => {}, pl);
  check("🗑 Remove: the Fibo models go; the Qwen3-VL 4B encoder + FLUX.2 VAE stay (FLUX 3 Klein uses them)",
    r.ok && !fs.existsSync(path.join(pl.models, "unet", "fibo2_edit_turbo-Q4_0.gguf")) && fs.existsSync(path.join(pl.models, "text_encoders", "qwen3vl_4b_int8_convrot.safetensors")) && fs.existsSync(path.join(pl.models, "vae", "flux2-vae.safetensors")));
  fs.rmSync(T2, { recursive: true, force: true });
  const A = require("../lib/addons").list().find((x) => x.id === "fibo");
  check("Settings ▸ Add-ons lists Fibo 2.0 (low VRAM, ComfyUI from 21 Oct 2026, the licence)", A && /low VRAM/.test(A.label) && /21 Oct 2026/.test(A.needs) && /CC BY-NC 4\.0/.test(A.needs) && A.items.length === 9);

  /* the Model manager + the doctor */
  const MC = require("../lib/modelCards");
  check("🧩 cards: fibo2_* files are the Fibo 2.0 family (image edit)", MC.nameFamily("unet/fibo2_edit_turbo-Q4_0.gguf") === "fibo" && MC.nameFamily("fibo2_dev_w4a8_convrot.safetensors") === "fibo" && MC.FAMILIES.fibo && MC.FAMILIES.fibo.category === "image edit");
  const D = require("../lib/styleDoctor");
  const ex = D.explain(["Prompt outputs failed validation: CLIPLoader: Value not in list [type] = fibo2"]);
  check("the style doctor: \"fibo2 not in list\" = ComfyUI older than 21 Oct 2026", ex && /Fibo 2\.0 needs ComfyUI from 21 Oct 2026/.test(JSON.stringify(ex)), ex);

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
