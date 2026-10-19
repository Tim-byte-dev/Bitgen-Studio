#!/usr/bin/env node
/* bitGen Studio — scripts/mmfixture518.js (2.518.0): a small fake ComfyUI folder for the 🧩 Model manager tests
 * (test-modelmgr518.js, test-ui518-ui.js). Real file FORMATS (safetensors headers with metadata + tensor names, a GGUF
 * header, a Civitai Helper .civitai.info, a preview PNG) - tiny files, no weights.
 *   node scripts/mmfixture518.js <dir>     makes <dir>/ComfyUI/{main.py, models/...}
 */
"use strict";
const fs = require("fs");
const path = require("path");

function safetensors(file, meta, keys) {
  const h = {};
  if (meta) h.__metadata__ = meta;
  for (const k of keys) h[k] = { dtype: "F16", shape: [1], data_offsets: [0, 2] };
  const j = Buffer.from(JSON.stringify(h), "utf8");
  const len = Buffer.alloc(8); len.writeBigUInt64LE(BigInt(j.length));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([len, j, Buffer.from([0, 0])]));
}
function gguf(file, arch) {
  const parts = [];
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); parts.push(b); };
  const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); parts.push(b); };
  const str = (s) => { const b = Buffer.from(s, "utf8"); u64(b.length); parts.push(b); };
  parts.push(Buffer.from("GGUF", "latin1")); u32(3); u64(0); u64(2);
  str("general.alignment"); u32(4); u32(32);                // uint32 first (the parser must skip it)
  str("general.architecture"); u32(8); str(arch);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat(parts));
}
// a 2x2 PNG
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a730000001649444154789c63f8cfc0f09f818181e1ff7f0606000037f005fd8a5a6fb10000000049454e44ae426082", "hex");

function make(dir) {
  const C = path.join(dir, "ComfyUI"), M = path.join(C, "models");
  fs.mkdirSync(M, { recursive: true });
  fs.writeFileSync(path.join(C, "main.py"), "# fake ComfyUI for the tests\n");
  for (const d of ["checkpoints", "diffusion_models", "loras", "vae", "text_encoders"]) fs.mkdirSync(path.join(M, d), { recursive: true });
  safetensors(path.join(M, "checkpoints", "ponyDiffusionV6XL.safetensors"), { "modelspec.architecture": "stable-diffusion-xl-v1-base" },
    ["conditioner.embedders.1.model.ln_final.weight", "first_stage_model.decoder.conv_in.weight", "model.diffusion_model.input_blocks.0.0.weight"]);
  safetensors(path.join(M, "checkpoints", "juggernautXL_v9.safetensors"), null,
    ["conditioner.embedders.1.model.ln_final.weight", "first_stage_model.decoder.conv_in.weight", "model.diffusion_model.input_blocks.0.0.weight"]);
  fs.writeFileSync(path.join(M, "checkpoints", "juggernautXL_v9.preview.png"), PNG);
  gguf(path.join(M, "diffusion_models", "mystery-model-Q8_0.gguf"), "flux");
  safetensors(path.join(M, "diffusion_models", "wan2.2_t2v_14B_fp8.safetensors"), null, ["blocks.0.cross_attn.k.weight", "blocks.0.self_attn.q.weight"]);
  safetensors(path.join(M, "diffusion_models", "qwen_image_edit_2511_fp8.safetensors"), null, ["transformer_blocks.0.attn.to_q.weight"]);
  safetensors(path.join(M, "loras", "sdxl", "detail_tweaker_xl.safetensors"),
    { ss_base_model_version: "sdxl_base_v1-0", ss_output_name: "detail_tweaker_xl",
      ss_tag_frequency: JSON.stringify({ "10_detail": { "highly detailed": 40, "sharp focus": 31, "intricate": 12 } }) },
    ["lora_unet_input_blocks_4_1_proj_in.lora_down.weight", "lora_te2_text_model_encoder_layers_0_mlp_fc1.lora_up.weight"]);
  fs.writeFileSync(path.join(M, "loras", "sdxl", "detail_tweaker_xl.preview.png"), PNG);
  safetensors(path.join(M, "loras", "anime_lineart.safetensors"), null, ["lora_unet_input_blocks_4_1_proj_in.lora_down.weight"]);
  fs.writeFileSync(path.join(M, "loras", "anime_lineart.civitai.info"), JSON.stringify({
    id: 555001, modelId: 44001, name: "v2.0", baseModel: "Illustrious", trainedWords: ["lineart", "monochrome"], publishedAt: "2026-03-14T10:00:00.000Z",
    stats: { thumbsUpCount: 90, thumbsDownCount: 10 },
    model: { name: "Anime Lineart", type: "LORA", nsfw: false },
    description: "<p>Clean <b>lineart</b> for anime pictures.</p><p>Weight 0.6 - 0.9.</p>",
    images: [{ url: "https://image.civitai.com/x/abc/width=450/1.jpeg", type: "image", nsfwLevel: 1, meta: { cfgScale: 5, steps: 28, sampler: "Euler a" } },
             { url: "https://image.civitai.com/x/abc/width=450/2.jpeg", type: "image", nsfwLevel: 1, meta: { cfgScale: 6, steps: 30, sampler: "Euler a" } },
             { url: "https://image.civitai.com/x/abc/width=450/3.jpeg", type: "image", nsfwLevel: 1, meta: { cfgScale: 5.5, steps: 24 } }],
  }));
  safetensors(path.join(M, "vae", "sdxl_vae.safetensors"), null, ["decoder.conv_in.weight"]);
  safetensors(path.join(M, "text_encoders", "qwen_3_06b_base.safetensors"), null, ["model.layers.0.mlp.up_proj.weight"]);
  return { comfy: C, models: M };
}
module.exports = { make, safetensors, gguf, PNG };
if (require.main === module) { const d = process.argv[2]; if (!d) { console.log("usage: node scripts/mmfixture518.js <dir>"); process.exit(1); } console.log(JSON.stringify(make(d))); }
