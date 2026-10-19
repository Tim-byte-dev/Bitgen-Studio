"use strict";
/**
 * autoAssets.js — a finished render shows up in the asset dock by itself (2.65.0).
 *
 * THE GAP THIS CLOSES: the worker writes renders into `projects/<p>/output/`,
 * but the asset dock lists `projects/<p>/{video,images,sound}`. Those are two
 * different folders, so every generated video had to be found in the gallery
 * and dragged back in by hand before it could be used as a timeline clip or a
 * continuation source. Now a successful render is registered into the video
 * assets the moment it lands.
 *
 * HARD LINK, NOT COPY. output/ and video/ are both inside the project folder,
 * so they are always on the same volume and a hard link is free and instant —
 * which matters when a render is a couple of gigabytes and the alternative is
 * doubling it on disk every single time. Both names point at ONE set of bytes;
 * deleting either one leaves the other intact and complete. Copy is the
 * fallback for the cases where linking cannot work (a project folder on a
 * network share, an exotic filesystem, a permissions refusal).
 *
 * SYMLINKS ARE NOT AN OPTION: Windows needs Developer Mode or an elevated
 * process to create one, and this app is aimed at an ordinary desktop user.
 *
 * NO CALLER MAY EVER FAIL BECAUSE OF THIS. A render that finished is a render
 * that finished; not appearing in the dock is a nuisance, but turning a
 * successful two-hour generation into a failed job would be a catastrophe.
 * Every entry point returns a result object and throws nothing.
 */
const fs = require("fs");
const path = require("path");

// The asset dock's video column, and what the timeline can use as a clip.
const VIDEO_EXT = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v"]);

/**
 * The asset dock's IMAGE column (2.66.0 — generated stills).
 *
 * Deliberately a SECOND set rather than a widened VIDEO_EXT: isVideo() answers
 * "can the timeline treat this as footage", which a .png is not, and callers
 * (and tests) rely on that answer. The two sets pick a destination folder; they
 * are not one blurred "media" list.
 *
 * .webp is knowingly absent. It is BOTH a still format and one of this app's
 * video output formats (see the /api/outputs filter and enc_args in worker.py),
 * so classifying it by extension alone would file some renders as pictures.
 * Anything ambiguous stays with video, where the timeline can still use it.
 */
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".bmp"]);

/**
 * The asset dock's SOUND column (2.90.0 — generated songs).
 *
 * A third set for the same reason IMAGE_EXT is a second one: it picks a
 * destination folder (`sound/`), and isVideo()/isImage() keep answering their
 * own questions. The list is PKINDS.sound from lib/core.js, which is what the
 * Sound tab of the Assets dock lists — a song that registered into sound/ but
 * did not show in that tab would be a file nobody can find. .webm stays with
 * video for the reason given above IMAGE_EXT.
 */
const AUDIO_EXT = new Set([".wav", ".mp3", ".ogg", ".flac", ".m4a", ".opus"]);

/**
 * Modes whose output must NOT be auto-registered.
 *
 * `export` is the important one. A compile writes THE project's movie to
 * `<project>.mp4` and REPLACES it on every recompile. A hard link captures the
 * bytes that existed at link time, so the asset copy would quietly go stale
 * the first time you recompiled — you would be editing against last hour's
 * cut while the gallery showed this one. Renders in output/ are numbered and
 * never rewritten, which is exactly what makes them safe to link.
 */
const SKIP_MODES = new Set(["export", "download", "probe", "frames", "asr", "tts", "chat"]);

function isVideo(name) {
  return VIDEO_EXT.has(path.extname(String(name || "")).toLowerCase());
}
function isImage(name) {
  return IMAGE_EXT.has(path.extname(String(name || "")).toLowerCase());
}
function isAudio(name) {
  return AUDIO_EXT.has(path.extname(String(name || "")).toLowerCase());
}

/** "video" | "image" | "audio" | null — which asset column this file belongs in. */
function kindOf(name) {
  if (isVideo(name)) return "video";
  if (isImage(name)) return "image";
  if (isAudio(name)) return "audio";
  return null;
}

/** Same bytes already on disk under both names? Then there is nothing to do. */
function sameFile(a, b) {
  try {
    const x = fs.statSync(a), y = fs.statSync(b);
    // ino is 0 on some Windows filesystems, so fall back to size+mtime, which
    // is what a hard link preserves exactly and a coincidence rarely matches.
    if (x.ino && y.ino) return x.ino === y.ino && x.dev === y.dev;
    return x.size === y.size && Math.abs(x.mtimeMs - y.mtimeMs) < 2;
  } catch { return false; }
}

/**
 * A free name in `dir` for `name`.
 * Returns null when the exact name is already the same file (nothing to do).
 *
 * The uniquify-rather-than-overwrite rule is the same one POST /api/passets
 * learned: overwriting an asset is silent data loss twice over, because the
 * old file is gone AND every timeline clip still naming it now plays
 * different footage.
 */
function freeName(dir, name) {
  const target = path.join(dir, name);
  if (!fs.existsSync(target)) return name;
  if (sameFile(target, target)) { /* exists; decided by the caller below */ }
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  for (let n = 2; n < 1000; n++) {
    const cand = `${stem} (${n})${ext}`;
    if (!fs.existsSync(path.join(dir, cand))) return cand;
  }
  return null;
}

/**
 * Register `outputName` (a file in `outputDir`) into the matching asset folder:
 * `videoDir` for footage, `imageDir` for a generated still, `soundDir` for a
 * generated song.
 *
 * Resolves to one of:
 *   {added:true,  name, kind, how:"link"|"copy"}  registered
 *   {added:false, reason:"exists", name, kind}    already there, same bytes
 *   {added:false, reason:"not-video"|"no-image-dir"|"missing"|"skipped-mode"|"error", ...}
 *
 * "not-video" is kept as the reason for an unrecognised extension because that
 * is the existing contract callers and tests are written against — an image
 * with nowhere to go says "no-image-dir" instead, which is a different fault
 * (a caller that did not pass imageDir) and deserves a different name.
 */
function register(outputName, opts) {
  const o = opts || {};
  try {
    const name = path.basename(String(outputName || ""));
    if (!name) return { added: false, reason: "missing" };
    if (o.mode && SKIP_MODES.has(o.mode)) return { added: false, reason: "skipped-mode", mode: o.mode };
    const kind = kindOf(name);
    if (!kind) return { added: false, reason: "not-video", name };
    const destDir = kind === "image" ? o.imageDir
                  : kind === "audio" ? o.soundDir : o.videoDir;
    // "no-image-dir" is the historical reason name for "the caller passed no
    // folder for this kind"; a song with no soundDir reports "no-sound-dir" so
    // the two faults stay distinguishable in a log.
    if (!destDir)
      return { added: false, reason: kind === "audio" ? "no-sound-dir" : "no-image-dir",
               name, kind };

    const src = path.join(o.outputDir, name);
    if (!fs.existsSync(src)) return { added: false, reason: "missing", name, kind };

    fs.mkdirSync(destDir, { recursive: true });

    // Already registered? Re-running a job, or a restart replaying history,
    // must not pile up "render (2).webm", "render (3).webm"...
    const direct = path.join(destDir, name);
    if (fs.existsSync(direct) && sameFile(direct, src))
      return { added: false, reason: "exists", name, kind };

    const use = fs.existsSync(direct) ? freeName(destDir, name) : name;
    if (!use) return { added: false, reason: "error", name, kind, error: "no free name" };
    const dest = path.join(destDir, use);

    try {
      fs.linkSync(src, dest);
      return { added: true, name: use, kind, how: "link" };
    } catch (e) {
      // EXDEV (different volume), EPERM, or a filesystem with no link support
      try {
        fs.copyFileSync(src, dest);
        return { added: true, name: use, kind, how: "copy", linkError: e.code || String(e.message) };
      } catch (e2) {
        return { added: false, reason: "error", name, kind, error: String(e2.message || e2) };
      }
    }
  } catch (e) {
    return { added: false, reason: "error", error: String(e.message || e) };
  }
}

module.exports = { register, isVideo, isImage, isAudio, kindOf, sameFile, freeName,
                   VIDEO_EXT, IMAGE_EXT, AUDIO_EXT, SKIP_MODES };
