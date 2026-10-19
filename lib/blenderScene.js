/* bitGen Studio — A BLENDER SCENE, RENDERED PHOTOREAL BY LTX 2.3 + 3DREAL (2.402.0).
 *
 * Tim (verbatim): "https://huggingface.co/fal/LTX-2.3-3DREAL-LoRA, can we use this lora and our blender bridge to
 * layout a 3d scene in blender and render it in bitgen using ltx2.3 - please add a style for ltx2.3".
 *
 * The add-on's "Render scene → bitGen" (blender/bitgen_bridge) renders the scene through ITS camera (Solid / EEVEE /
 * the scene's engine, the long side at most 1280, multiples of 32) into an .mp4 and POSTs it here:
 *   save(buf, meta)  -> {name, path, seconds}   the render into the open project's Video folder (blender_<name>.mp4,
 *                                                never over an older one) - it shows in Video assets and can be put in
 *                                                the reference dock for the LTX 2.3 style's "3D render -> real" mode
 *   queue(saved, meta) -> {job, params, note} | {error}   with "Render in bitGen" ticked: an LTX 2.3 job in mode
 *                                                3dreal (lib/ltx.jobParams -> ltx_worker.py: Comfy-Org's LTX 2.3
 *                                                IC-LoRA template, fal's 3DREAL LoRA, the render as the guide)
 * meta = {name, prompt, seconds, width, height, fps, ic_lora, ic_strength, seed, style_id, first (2.540.0: a picture = its real
 * first frame - lib/realRefs.js makes it from the references)}. routes/blender.js mounts it. */
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const VIDEO_EXT = [".mp4", ".webm", ".mov", ".mkv"];
const bad = (msg, status) => { const e = new Error(msg); e.status = status || 400; return e; };

/** a file-name-safe stem */
function stem(name) {
  const b = path.basename(String(name || "scene")).replace(/\.[a-z0-9]{2,4}$/i, "");
  return (b.replace(/[^A-Za-z0-9 ._()-]+/g, " ").trim().replace(/\s+/g, "_") || "scene").slice(0, 60);
}
/** is it a video container we can read (mp4/mov: "ftyp" at 4; webm/mkv: EBML 1A 45 DF A3) */
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return "";
  if (buf.slice(4, 8).toString("latin1") === "ftyp") return ".mp4";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return ".webm";
  return "";
}

function save(buf, meta, dirOverride) {
  const m = meta || {};
  const ext = sniff(buf);
  if (!ext) throw bad("send the render as a video (.mp4 / .webm) - the add-on renders the scene with FFmpeg");
  const dir = dirOverride || core.pDir("video");
  fs.mkdirSync(dir, { recursive: true });
  const base = (m.prefix === "daz_" ? "daz_" : "blender_") + stem(m.name);     // 2.405.0: the Daz bridge's renders are daz_<name>
  let name = base + ext, k = 1;
  while (fs.existsSync(path.join(dir, name))) name = `${base}_${++k}${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  const fps = Math.max(1, Math.min(120, +m.fps || 24));
  const frames = Math.max(0, Math.floor(+m.frames || 0));
  const seconds = frames ? Math.max(1, Math.min(30, Math.ceil(frames / fps))) : Math.max(1, Math.min(30, Math.round(+m.seconds || 5)));
  return { name, path: path.join(dir, name), seconds };
}

/** the LTX 2.3 style the job runs on: the asked id when it is LTX 2.3, "LTX 2.3", any ltx-2.3 */
function style23(id) {
  const styles = require("./styles");
  const ltx = require("./ltx");
  const all = styles.read(core.STYLES_DIR, "video").filter((s) => s.arch === ltx.ARCH23);
  return all.find((s) => s.id === String(id || "")) || all.find((s) => s.name === "LTX 2.3") || all[0] || null;
}

function queue(saved, meta) {
  const m = meta || {};
  const ltx = require("./ltx");
  const style = style23(m.style_id);
  if (!style) return { error: "no LTX 2.3 video style - restart bitGen Studio to seed \"LTX 2.3\" (Settings -> Video styles)" };
  const p = ltx.jobParams({
    style, workflow: ltx.workflowFor(style, core.BASE), mode: "3dreal",
    prompt: String(m.prompt || ""), images: m.first && fs.existsSync(m.first) ? [m.first] : [], audio: null,   // 2.540.0: a real first frame (lib/realRefs)
    video: { path: saved.path, start: 0 },
    seconds: saved.seconds, width: m.width, height: m.height, seed: m.seed == null || m.seed === "" ? -1 : m.seed,
    ic_lora: m.ic_lora, ic_strength: m.ic_strength,
  });
  if (p.error) return { error: p.error };
  p.from_blender = { name: saved.name };
  const job = core.makeJob(p);
  try { job.log.push(`[blender] the scene render ${saved.name} -> LTX 2.3 3DREAL (render -> real)`); } catch { /* fine */ }
  return { job, params: p, note: ltx.summary(p) };
}

module.exports = { save, queue, sniff, stem, style23 };
