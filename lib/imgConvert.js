// bitGen Studio — lib/imgConvert.js (2.485.0): picture formats the browser cannot write, made with ffmpeg on this
// computer. Used by routes/imgconvert.js (the image editor's Export As ▸ AVIF).
//   caps()                      {avif: bool, encoder}
//   toAvif(pngBuffer, quality)  Buffer (an .avif still)        quality 1…100 (higher is better)
//   crfOf(quality)              the encoder's constant-quality number for a 1…100 quality
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");

const FFMPEG = process.env.BITGEN_FFMPEG || "ffmpeg";
const MAX = 64 * 1024 * 1024;
let capsCache = null;

function caps() {
  if (capsCache) return capsCache;
  let enc = "";
  try {
    const r = spawnSync(FFMPEG, ["-hide_banner", "-encoders"], { encoding: "utf8", timeout: 15000 });
    const out = String(r.stdout || "");
    enc = ["libaom-av1", "libsvtav1", "librav1e"].find((e) => new RegExp("\\s" + e + "\\s").test(out)) || "";
  } catch (_) { enc = ""; }
  capsCache = { avif: !!enc, encoder: enc };
  return capsCache;
}
/** 1…100 → the encoder's constant quality (lower is better): 100 → 0 … 1 → 63 */
function crfOf(q) { const v = Math.max(1, Math.min(100, Math.round(+q || 80))); return Math.round((100 - v) * 63 / 99); }

function isPng(b) { return Buffer.isBuffer(b) && b.length > 8 && b.readUInt32BE(0) === 0x89504e47; }

function toAvif(png, quality) {
  if (!isPng(png)) throw Object.assign(new Error("send a PNG"), { status: 400 });
  if (png.length > MAX) throw Object.assign(new Error("the picture is too big"), { status: 413 });
  const c = caps();
  if (!c.avif) throw Object.assign(new Error("ffmpeg on this computer has no AV1 encoder (libaom-av1, libsvtav1 or librav1e)"), { status: 501 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bg-avif-")), src = path.join(dir, "in.png"), dst = path.join(dir, "out.avif");
  try {
    fs.writeFileSync(src, png);
    const crf = String(crfOf(quality));
    const enc = c.encoder === "libaom-av1" ? ["-c:v", "libaom-av1", "-crf", crf, "-b:v", "0", "-cpu-used", "6", "-still-picture", "1"]
      : c.encoder === "libsvtav1" ? ["-c:v", "libsvtav1", "-crf", crf, "-preset", "8"]
      : ["-c:v", "librav1e", "-qp", String(Math.round(crfOf(quality) * 255 / 63))];
    // no transparency: clear areas come out black (the help says so)
    const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-frames:v", "1", ...enc, "-pix_fmt", "yuv420p", "-f", "avif", dst];
    const r = spawnSync(FFMPEG, args, { encoding: "utf8", timeout: 120000 });
    if (r.status !== 0 || !fs.existsSync(dst)) throw new Error("ffmpeg: " + String(r.stderr || r.error || "failed").trim().split("\n").slice(-2).join(" "));
    return fs.readFileSync(dst);
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}
module.exports = { caps, crfOf, toAvif, isPng, MAX };
