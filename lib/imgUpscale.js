/* bitGen Studio — PICTURE UPSCALING (2.733.0).
 *
 * Tim (verbatim): "if we select an image thumbnail and press the enhance buton can we upscale the image"
 *
 * The prompt docker's ⏫ Enhance upscaled the selected VIDEO (SeedVR2, 2.401.0); now, when the last thing clicked was a
 * PICTURE - a gallery image, an Image asset or a picture in the reference dock (static/selvideo.js) - it opens the
 * picture panel (static/imgupscalepanel.js) and one job (mode "imgupscale", misc/imgupscale_worker.py,
 * scripts/imgupscale_graph.py) makes it bigger: SeedVR2 (Tim's image workflow), an upscale model in ComfyUI, or lanczos.
 * The result is a PNG in the project's output folder - the gallery's Images. The choices are the project's
 * (imgupscale.json). A reference-dock picture lives in the browser, so it is sent first (saveUpload) and named by a token.
 * Names only from the client - never a path. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const seedvr2 = require("./seedvr2");                // probe (ffprobe) + target (the sizes)

const FILE = "imgupscale.json";
const SIZES = ["x2", "x3", "x4", "1080", "1440", "2160"];
const METHODS = ["seedvr2", "model", "lanczos"];
const COLORS = ["lab", "wavelet", "adain", "none"];
const DEFAULTS = { size: "x2", method: "seedvr2", model: "", color: "lab", denoise: 1, seed: -1 };
const IMAGE_RX = /\.(png|jpe?g|webp|bmp)$/i;
const MAX_SIDE = 8192;                                 // the biggest side made (SeedVR2's tiled VAE copes; a 16K PNG is silly)
const MAX_UPLOAD = 64 * 1024 * 1024;
const UPLOAD_DIR = "imgupscale";

function normalize(o) {
  const s = o && typeof o === "object" ? o : {};
  const out = { ...DEFAULTS };
  if (SIZES.includes(String(s.size))) out.size = String(s.size);
  if (METHODS.includes(String(s.method))) out.method = String(s.method);
  const m = String(s.model || "").trim();
  out.model = m && !m.includes("..") && /\.(safetensors|pth|pt|ckpt|gguf|bin)$/i.test(m) ? m.slice(0, 300) : "";
  if (COLORS.includes(String(s.color))) out.color = String(s.color);
  const d = parseFloat(s.denoise);
  if (Number.isFinite(d)) out.denoise = Math.max(0.05, Math.min(1, Math.round(d * 100) / 100));
  const sd = parseInt(s.seed, 10);
  out.seed = Number.isSafeInteger(sd) && sd >= 0 ? sd : -1;
  return out;
}
const fileFor = (projDir) => path.join(projDir, FILE);
function read(projDir) { try { return normalize(JSON.parse(fs.readFileSync(fileFor(projDir), "utf8"))); } catch { return normalize({}); } }
function save(projDir, patch) {
  const s = normalize({ ...read(projDir), ...(patch || {}) });
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(fileFor(projDir), JSON.stringify(s, null, 2));
  return s;
}

/** where uploads (reference-dock pictures) wait for their job */
function uploadDir(tmpRoot) { return path.join(tmpRoot, UPLOAD_DIR); }
/** the bytes look like a picture LoadImage reads (PNG, JPEG, WebP, BMP) -> its extension, else "" */
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return "";
  if (buf[0] === 0x89 && buf.toString("latin1", 1, 4) === "PNG") return ".png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return ".webp";
  if (buf.toString("latin1", 0, 2) === "BM") return ".bmp";
  return "";
}
/** a reference-dock picture sent by the page -> {name (a token), from: "upload"} | throws {status, message} */
function saveUpload(tmpRoot, buf, original) {
  const bad = (m, st) => { const e = new Error(m); e.status = st || 400; return e; };
  if (!Buffer.isBuffer(buf) || !buf.length) throw bad("the picture is empty");
  if (buf.length > MAX_UPLOAD) throw bad("the picture is over 64 MB");
  const ext = sniff(buf);
  if (!ext) throw bad("that is not a PNG, JPEG, WebP or BMP picture");
  const stem = path.basename(String(original || "picture")).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").trim().slice(0, 60) || "picture";
  const d = uploadDir(tmpRoot);
  fs.mkdirSync(d, { recursive: true });
  const name = `${crypto.randomBytes(6).toString("hex")}_${stem}${ext}`;
  fs.writeFileSync(path.join(d, name), buf);
  return { name, from: "upload", stem };
}

/** A picture the app can name -> its absolute path, or null. from: gallery (output, project root, final) | asset (the
 *  project's images/ first) | upload (a token from saveUpload). */
function resolve(projDir, name, from, tmpRoot) {
  const base = path.basename(String(name || ""));
  if (!base || !IMAGE_RX.test(base)) return null;
  const outs = [path.join(projDir, "output"), projDir, path.join(projDir, "final")];
  const dirs = from === "upload" ? [uploadDir(tmpRoot || "")] : from === "asset" ? [path.join(projDir, "images"), ...outs] : [...outs, path.join(projDir, "images")];
  for (const d of dirs) {
    const p = path.join(d, base);
    try { if (fs.statSync(p).isFile()) return p; } catch { /* next */ }
  }
  return null;
}

/** the size for a w x h picture: a factor or a short side (the aspect kept) -> {width, height, mult} | {error} */
function target(size, w, h) {
  if (!(w > 0 && h > 0)) return { error: "could not read the picture's size (is ffprobe installed?)" };
  const t = seedvr2.target(String(size || DEFAULTS.size), w, h);
  if (t.error) return { error: t.error.replace("the video", "the picture") };
  if (t.width > MAX_SIDE || t.height > MAX_SIDE) return { error: `${t.width}x${t.height} is more than ${MAX_SIDE} px a side - pick a smaller size` };
  return { width: t.width, height: t.height, mult: t.mult };
}

const LABEL = { seedvr2: "SeedVR2", model: "an upscale model", lanczos: "lanczos" };
/** The job's params for `file` with the options `o`. {params, note, target} | {error} */
function jobParams(file, size, o, extra) {
  const s = normalize(o), x = extra || {};
  if (!size) return { error: `could not read ${path.basename(String(file))} (is ffprobe installed?)` };
  const t = target(s.size, size.width, size.height);
  if (t.error) return { error: t.error };
  const shown = x.display_name || path.basename(file);
  const label = `⏫ ${shown} → ${t.width}×${t.height}`;
  const stem = String(x.stem || path.basename(file).replace(/\.[^.]+$/, "")).replace(/[^A-Za-z0-9 ._()-]+/g, "_").slice(0, 80) || "picture";
  const params = { mode: "imgupscale", source: file, width: t.width, height: t.height, method: s.method,
    ...(s.model && s.method !== "lanczos" ? { model: s.model } : {}),
    color: s.color, denoise: s.denoise, seed: s.seed, output_name: `${stem}_upscaled_${t.width}x${t.height}.png`,
    prompt: label, label };
  const note = `${shown} ${size.width}x${size.height} -> ${t.width}x${t.height} with ${LABEL[s.method]}`
    + (s.method === "seedvr2" ? ` (colour match ${s.color}, denoise ${s.denoise})` : s.method === "model" && s.model ? ` (${s.model})` : "");
  return { params, note, target: t };
}

module.exports = { FILE, SIZES, METHODS, COLORS, DEFAULTS, IMAGE_RX, MAX_SIDE, normalize, read, save, fileFor, sniff, saveUpload,
  uploadDir, resolve, target, jobParams, probe: seedvr2.probe };
