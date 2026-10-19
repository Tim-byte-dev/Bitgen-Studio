"use strict";
/**
 * modelInstall.js — make a model visible to a DIFFERENT ComfyUI loader (2.79.0).
 *
 * THE PROBLEM, in Tim's words: "it generates the pic if i copy the model to the
 * comfy diffusion folder, but not when it's outside that folder... i think it is
 * because the loader is unet not checkpoint". Exactly right, and nothing in this
 * app could fix it — until now it could only explain it.
 *
 * ComfyUI resolves a combo value inside the search paths registered for THAT
 * FOLDER TYPE. A FLUX diffusion model living in `models/Checkpoint/` is a
 * checkpoint as far as ComfyUI is concerned, so `UNETLoader` — which lists
 * `diffusion_models` — cannot see it, whatever the file actually contains.
 * Copying it across works, and that is what Tim had been doing by hand.
 *
 * HARD LINK, NOT COPY, for the reason lib/adopt.js gives: these files are
 * routinely 10-20 GB, and on one volume a link is instant and free. G:\\models\\
 * Checkpoint and G:\\models\\diffusion_models are the same volume, which is the
 * common case precisely because both come from one `base_path` in the yaml.
 *
 * A CROSS-VOLUME REQUEST IS REFUSED, NOT QUIETLY COPIED. Linking E: to G: is
 * impossible, and silently falling back to a copy would spend twenty gigabytes
 * and several minutes without asking. The caller gets `code:"cross-device"` plus
 * the byte count and must pass `allowCopy` to mean it.
 *
 * THE SUBFOLDER IS PRESERVED, and that is the point that makes this seamless:
 * a model named `flux_klein_9B/aisha.safetensors` under checkpoints becomes
 * `flux_klein_9B/aisha.safetensors` under diffusion_models. The style's saved
 * value does not change — it simply starts working.
 *
 * NEVER OVERWRITES. If the target name is taken by different bytes it refuses
 * rather than uniquifying: unlike an asset import, the NAME here is load-bearing
 * (it is what the workflow will ask ComfyUI for), so inventing a new one would
 * defeat the entire operation.
 */
const fs = require("fs");
const path = require("path");

/** Same file, by inode where the platform reports one. */
function sameFile(a, b) {
  try {
    const x = fs.statSync(a), y = fs.statSync(b);
    if (x.ino && y.ino) return x.ino === y.ino && x.dev === y.dev;
    return x.size === y.size;
  } catch { return false; }
}

/**
 * Choose where to put it. Prefers a root that already exists; failing that, one
 * the yaml declared whose PARENT exists, which it then creates.
 *
 * That second case is Tim's exactly: his yaml maps
 * `diffusion_models: models/diffusion_models/` under `base_path: G:/`, but the
 * folder was never made — so the line searches nothing and ComfyUI has no unet
 * path on that drive at all. Creating it is what the yaml already asked for.
 */
function pickTarget(roots) {
  const list = Array.isArray(roots) ? roots : [];
  const live = list.find((r) => r && r.exists);
  if (live) return { dir: live.dir, created: false };
  for (const r of list) {
    if (!r || !r.dir) continue;
    try {
      if (fs.statSync(path.dirname(r.dir)).isDirectory())
        return { dir: r.dir, created: true };
    } catch { /* parent missing too — try the next */ }
  }
  return null;
}

/**
 * opts = {
 *   name,        the entry name, subfolder and extension kept
 *   fromRoots,   [{dir, exists}] roots of the category it IS in
 *   toRoots,     [{dir, exists}] roots of the category it NEEDS to be in
 *   allowCopy,   proceed across volumes (the caller has seen the size)
 * }
 * Never throws.
 */
function install(opts) {
  const o = opts || {};
  try {
    const rel = String(o.name || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!rel || rel.split("/").includes(".."))
      return { ok: false, code: "bad-name", error: "no usable file name" };

    let src = null;
    for (const r of o.fromRoots || []) {
      const p = path.join(r.dir || "", ...rel.split("/"));
      try { if (fs.statSync(p).isFile()) { src = p; break; } } catch { /* next */ }
    }
    if (!src)
      return { ok: false, code: "missing", error: `${rel} is not in any folder for its current kind` };

    const target = pickTarget(o.toRoots);
    if (!target)
      return { ok: false, code: "no-target",
               error: "ComfyUI has no search folder for that loader on this machine, "
                    + "and none could be created — add one to extra_model_paths.yaml" };

    const dest = path.join(target.dir, ...rel.split("/"));
    if (fs.existsSync(dest)) {
      // already done is a success, not an error — the same reasoning as adopt.js
      if (sameFile(dest, src))
        return { ok: true, how: "exists", path: dest, dir: target.dir, name: rel };
      return { ok: false, code: "clash",
               error: `${rel} already exists there as a different file. Renaming it `
                    + `would defeat the point — the workflow asks ComfyUI for this `
                    + `exact name.` };
    }

    let size = 0;
    try { size = fs.statSync(src).size; } catch { /* reported as 0 */ }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      fs.linkSync(src, dest);
      return { ok: true, how: "link", path: dest, dir: target.dir, name: rel,
               created_dir: target.created, size };
    } catch (e) {
      if ((e.code === "EXDEV" || e.code === "EPERM") && !o.allowCopy)
        return { ok: false, code: "cross-device", error:
                 `${src} and ${target.dir} are on different drives, so this cannot `
               + `be a free hard link — it would copy ${(size / 1073741824).toFixed(2)} GB.`,
                 size, from: src, to: target.dir };
      try {
        fs.copyFileSync(src, dest);
        return { ok: true, how: "copy", path: dest, dir: target.dir, name: rel,
                 created_dir: target.created, size };
      } catch (e2) {
        try { fs.rmSync(dest, { force: true }); } catch {}   // no half-written model
        return { ok: false, code: "error", error: String(e2.message || e2) };
      }
    }
  } catch (e) {
    return { ok: false, code: "error", error: String(e.message || e) };
  }
}

module.exports = { install, pickTarget, sameFile };
