"use strict";
/**
 * waveform.js — peak data for drawing an audio clip's waveform (2.64.0).
 *
 * THE one place peaks are extracted. The timeline draws a waveform inside every
 * audio clip; this turns a media file into a small array of amplitude peaks the
 * browser can stretch to any clip width and zoom level.
 *
 * WHY PEAKS AND NOT THE AUDIO ITSELF: the browser could decode the file with
 * the WebAudio API, but that means downloading and decoding every soundtrack in
 * full just to draw a 200px-wide picture of it — a 5-minute song is tens of
 * megabytes, decoded to hundreds in memory, on every timeline render. ffmpeg
 * downsamples to 8 kHz mono here and hands back BUCKETS bytes instead.
 *
 * THE ARRAY IS ALWAYS THE WHOLE FILE, NEVER THE TRIMMED CLIP. Peaks are indexed
 * 0..BUCKETS across the SOURCE file's full duration, so the same response
 * serves every clip cut from that file and survives any trim, drag or zoom
 * without a refetch. The UI slices by in/out. Do not add trim parameters here.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

// 8 kHz is well below anything musical, which is the point: peaks are a
// picture, not audio. One byte per bucket, 1200 buckets ~= 1.2 KB per file.
const RATE = 8000;
const BUCKETS = 1200;
const MAX_SECONDS = 60 * 60;      // refuse to sit in ffmpeg forever on a bad file

// In-flight de-duplication. A timeline with six clips cut from the same song
// paints six at once on first render; without this that is six ffmpeg
// processes decoding the same file to produce identical bytes.
const inflight = new Map();

function cacheDir(base) {
  return path.join(base, ".cache", "waveform");
}

/**
 * Cache key = path + size + mtime. Size and mtime are what make a REPLACED
 * asset produce a new key: POST /api/passets uniquifies same-named drops, but
 * a file can still be overwritten on disk from outside the app, and serving
 * the old song's waveform for the new one is the kind of silent wrongness
 * that takes an hour to notice.
 */
function keyFor(file, st) {
  return crypto.createHash("sha1")
    .update(`${file}|${st.size}|${st.mtimeMs}|${BUCKETS}|${RATE}`)
    .digest("hex").slice(0, 32);
}

/** Bucket signed 16-bit mono PCM into BUCKETS peaks, each 0..255. */
function bucket(pcm, buckets = BUCKETS) {
  const samples = Math.floor(pcm.length / 2);
  const out = new Array(buckets).fill(0);
  if (!samples) return { peaks: out, seconds: 0 };
  let loudest = 1;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor((b * samples) / buckets);
    const to = Math.max(from + 1, Math.floor(((b + 1) * samples) / buckets));
    let peak = 0;
    // Step through wide buckets rather than reading every sample: a 5-minute
    // song at 8 kHz is 2.4M samples and the picture is 1200 pixels wide, so
    // sampling ~64 points per bucket is visually identical and much cheaper.
    const step = Math.max(1, Math.floor((to - from) / 64));
    for (let i = from; i < to && i < samples; i += step) {
      const v = Math.abs(pcm.readInt16LE(i * 2));
      if (v > peak) peak = v;
    }
    out[b] = peak;
    if (peak > loudest) loudest = peak;
  }
  // Normalised to the file's OWN loudest point, so a quiet recording still
  // draws a readable shape instead of a flat line.
  for (let b = 0; b < buckets; b++) out[b] = Math.round((out[b] / loudest) * 255);
  return { peaks: out, seconds: samples / RATE, loudest };
}

/** Decode `file` to mono PCM and reduce it to peaks. Resolves {peaks, seconds}. */
function extract(file) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-v", "error", "-nostdin",
      "-t", String(MAX_SECONDS), "-i", file,
      "-map", "0:a:0",              // first audio stream only
      "-ac", "1", "-ar", String(RATE),
      "-f", "s16le", "-",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    let err = "";
    let bytes = 0;
    ff.stdout.on("data", (d) => { chunks.push(d); bytes += d.length; });
    ff.stderr.on("data", (d) => { if (err.length < 4000) err += d.toString(); });
    ff.on("error", (e) => reject(new Error(`ffmpeg could not start: ${e.message}`)));
    ff.on("close", (code) => {
      // A file with NO audio stream is not an error the caller should have to
      // handle as one — an image layer or a silent render is a perfectly
      // ordinary thing to ask about. It returns a flat, empty waveform.
      if (!bytes) {
        if (/does not contain any stream|Stream map|Output file (is empty|#0 does not)/i.test(err))
          return resolve({ peaks: new Array(BUCKETS).fill(0), seconds: 0, silent: true });
        if (code !== 0) return reject(new Error(err.trim().split("\n").pop() || `ffmpeg exit ${code}`));
        return resolve({ peaks: new Array(BUCKETS).fill(0), seconds: 0, silent: true });
      }
      resolve(bucket(Buffer.concat(chunks, bytes)));
    });
  });
}

/**
 * Peaks for `file`, from the cache when possible.
 * `base` is the directory the .cache folder lives under (the project root).
 * Resolves {peaks:[0..255], seconds, buckets, cached, silent?}.
 */
async function peaks(file, base) {
  let st;
  try {
    st = fs.statSync(file);
  } catch {
    throw new Error(`no such file: ${path.basename(file)}`);
  }
  const dir = cacheDir(base);
  const hit = path.join(dir, keyFor(file, st) + ".json");
  try {
    const j = JSON.parse(fs.readFileSync(hit, "utf8"));
    if (Array.isArray(j.peaks) && j.peaks.length) return { ...j, cached: true };
  } catch { /* miss or corrupt cache entry — just rebuild it */ }

  if (inflight.has(hit)) return inflight.get(hit);
  const job = extract(file).then((r) => {
    const rec = { peaks: r.peaks, seconds: r.seconds, buckets: BUCKETS, silent: !!r.silent };
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(hit, JSON.stringify(rec));
    } catch { /* an unwritable cache must never fail the request */ }
    return { ...rec, cached: false };
  }).finally(() => inflight.delete(hit));
  inflight.set(hit, job);
  return job;
}

module.exports = { peaks, extract, bucket, keyFor, cacheDir, BUCKETS, RATE };
