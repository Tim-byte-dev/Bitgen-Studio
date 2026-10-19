"use strict";
/**
 * CHARACTER REFMODS (2.225.0, Tim: "can we use this to create character
 * lora's /refmods in our character creator?" ... "now proceed with the
 * refmod") — the ComfyUI-MiniMaxH3Mod pack extracts NO-TRAINING H3
 * reference mods: refs are VAE-encoded once, saved as tiny .safetensors in
 * ComfyUI's models/refmods/, and injected back through the native refs
 * payload. A character's mod carries their identity, so H3_Video_Ref
 * renders stop spending image slots on sheets.
 *
 * EVERY node/input name below is VERIFIED against the pack's source at the
 * pinned commit (never guessed — the doctrine):
 *
 *   https://github.com/Luisacaotica/ComfyUI-MiniMaxH3Mod
 *   commit cd27d1109a0da5f0a162ab59d53c6507251d4c34   <-- PIN. The repo is
 *   🚧 under construction with a single maintainer; if extraction starts
 *   failing after a pack update, diff the node schemas against this commit.
 *
 *   MiniMaxH3RefModExtract ("Create H3 RefMod"): autogrow image slots
 *     serialize as dotted keys `refs_image.ref_image_0` .. `_15` (0-based —
 *     the SAME io.Autogrow machinery the shipped ref2va.json export proves
 *     with its `ref_images.ref_image_0`); mode "Full Reference" stores the
 *     real VAE encode (max identity — the old name was "full");
 *     concept_type "identity"; ref_resolution 1024; save=true makes the
 *     NODE ITSELF write models/refmods/<name>.safetensors — no Save node
 *     needed. Output 0: H3_REF_MODS.
 *   MiniMaxH3RefModInspect: mods + vae -> ("details", "image_preview",
 *     "audio_preview"); preview "stored" decodes the stored latent's first
 *     frame — wired to SaveImage it gives the extraction job a REAL file
 *     output (graph_worker refuses a graph that produces nothing) AND the
 *     user a picture of what the mod actually holds.
 *   VAELoader vae_name "minimax_h3_video_vae_fp16.safetensors" — cloned
 *     VERBATIM from Tim's own working ref2va.json export (node 119).
 *
 * The RENDER-side splice (Load H3 RefMods + Apply H3 RefMod before the
 * sampler) lives in worker.py `_apply_refmods` — graph surgery is the
 * worker's trade, and one implementation only (the JS/Python no-duplication
 * rule). This file builds the EXTRACTION graph and names things.
 */
const path = require("path");

const PIN = "cd27d1109a0da5f0a162ab59d53c6507251d4c34";
const MAX_REFS = 16;          // the Extract autogrow's max=16 (verified)
const MAX_MOD_SLOTS = 8;      // the Loader's MAX_SLOTS = 8 (verified)
const NONE_SLOT = "(none)";   // the Loader's empty-slot value (verified)
// the H3 video VAE exactly as Tim's working ref2va export loads it
const VAE_NODE = { class_type: "VAELoader",
                   inputs: { vae_name: "minimax_h3_video_vae_fp16.safetensors" } };

/** The character's mod name — stable, tag-safe (letters/digits/_ only),
 *  prefixed so bitGen's mods are recognisable in the pack's dropdown. */
function modName(name) {
  const s = String(name || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return "bitgen_" + (s || "character");
}

/**
 * Build the extraction graph for one character. `files` = absolute paths of
 * the training pictures (the dataset folder's walk, capped at the pack's 16
 * image slots — the caller says when some stayed out). Returns
 * { graph, uploads, name } where uploads is graph_worker's own
 * [{node, input, path, kind}] contract: the worker uploads each file to
 * ComfyUI and writes the returned name into that node input.
 */
function extractGraph(character, files, opts) {
  const o = opts || {};
  const name = o.name || modName(character);
  const refs = (files || []).slice(0, MAX_REFS);
  if (refs.length < 1) throw new Error("no training pictures — the dataset folder is empty");
  const g = {};
  const uploads = [];
  const extractInputs = {
    name,
    mode: "Full Reference",           // the real encode: max identity
    concept_type: "identity",
    ref_resolution: 1024,
    pool_h: 16, pool_w: 16,           // Compressed-mode dials; inert here
    latent_frames: 16,
    identity: 0,                      // refinement steps — Compressed only
    merge: false, motion_only: false,
    max_tokens: 0,
    subfolder: "",                    // flat: the Loader's dropdown lists it plainly
    description: String(o.description || "").slice(0, 300),
    save: true,                       // the node writes models/refmods/<name>.safetensors
    budget_policy: "truncate",
  };
  refs.forEach((f, i) => {
    const id = "img_" + i;
    g[id] = { class_type: "LoadImage", inputs: { image: path.basename(f) } };
    // 0-based dotted autogrow keys — the ref2va export's own serialization
    extractInputs["refs_image.ref_image_" + i] = [id, 0];
    uploads.push({ node: id, input: "image", path: f, kind: "image" });
  });
  g.vae = { class_type: VAE_NODE.class_type,
            inputs: { ...VAE_NODE.inputs } };
  extractInputs.vae = ["vae", 0];
  g.extract = { class_type: "MiniMaxH3RefModExtract", inputs: extractInputs };
  // the PREVIEW tail: decode the stored latent's first frame and save it —
  // the job's one real file (graph_worker requires one) and the user's
  // window into what the mod holds
  g.inspect = { class_type: "MiniMaxH3RefModInspect",
                inputs: { mods: ["extract", 0], index: 0, preview: "stored",
                          strength: 0.5, vae: ["vae", 0],
                          visual_preview: "first_frame" } };
  g.save = { class_type: "SaveImage",
             inputs: { images: ["inspect", 1],
                       filename_prefix: "refmod_" + name } };
  return { graph: g, uploads, name };
}

/** Where a mod lands inside a ComfyUI install (verified: common.py
 *  refmods_dir -> models/refmods, created on first run). */
function modPath(comfyDir, name) {
  return path.join(comfyDir, "models", "refmods", String(name) + ".safetensors");
}

module.exports = { PIN, MAX_REFS, MAX_MOD_SLOTS, NONE_SLOT,
                   modName, extractGraph, modPath };
