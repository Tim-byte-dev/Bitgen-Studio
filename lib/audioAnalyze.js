/* bitGen Studio — lib/audioAnalyze.js (2.508.0): a sound file -> its LOUDNESS, its WAVEFORM and its SPECTRUM over time.
 *
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 2: "Audio → keyframes, plus waveform and spectrum
 * layers". The timeline's ♪ Audio → keys, its 🌫 Waveform / Spectrum generator layers and ƒx audio() read this
 * (routes/audioAnalyze.js -> ext/timelinedock/tlaudio.js).
 *   analyze(file) -> {dur, rate, amp (b64 Uint16, RMS 0..1 at `rate` a second), prate, peaks (b64 Int8 min / max pairs at
 *     `prate` a second), srate, bands, spec (b64 Uint8, `bands` levels a step at `srate` a second: 0 = -72 dB, 255 =
 *     0 dB), edges (the bands' Hz), peak (the loudest RMS)}
 *   The file is decoded once by ffmpeg (mono, 24 kHz, at most 10 minutes) and remembered (workspace/audiocache, keyed
 *   by the file's path, size and time).
 * Pure (Node: scripts/test-audio.js): rms(samples, sr, rate), peaks(samples, sr, rate), fft(re, im), edges(n, lo, hi),
 *   spectrum(samples, sr, srate, n, lo, hi, N), pack / unpack.
 */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { execFile } = require("child_process");

const SR = 24000, RATE = 48, PRATE = 1200, SRATE = 24, BANDS = 64, LO = 30, HI = 12000, NFFT = 2048, MAX_S = 600;
const DB = 72;

function rms(x, sr, rate) {
  const n = Math.ceil(x.length / sr * rate), out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const a = Math.floor(k * sr / rate), b = Math.min(x.length, Math.floor((k + 1) * sr / rate));
    let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i];
    out[k] = b > a ? Math.sqrt(s / (b - a)) : 0;
  }
  return out;
}
function peaks(x, sr, rate) {
  const n = Math.ceil(x.length / sr * rate), out = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) {
    const a = Math.floor(k * sr / rate), b = Math.min(x.length, Math.floor((k + 1) * sr / rate));
    let lo = 0, hi = 0; for (let i = a; i < b; i++) { if (x[i] < lo) lo = x[i]; if (x[i] > hi) hi = x[i]; }
    out[2 * k] = lo; out[2 * k + 1] = hi;
  }
  return out;
}
/** in-place radix-2 FFT (re.length a power of two) */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/** n + 1 log-spaced band edges from lo to hi Hz */
const edges = (n, lo, hi) => { const e = []; for (let i = 0; i <= n; i++) e.push(lo * Math.pow(hi / lo, i / n)); return e; };
/** each step's band levels 0..1 (the loudest bin in the band, -72 dB .. 0 dB of a full-scale sine) */
function spectrum(x, sr, srate, n, lo, hi, N) {
  const steps = Math.ceil(x.length / sr * srate), out = new Float32Array(steps * n), E = edges(n, lo, hi);
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const re = new Float64Array(N), im = new Float64Array(N), ref = N / 4;
  const bin = E.map((f) => f * N / sr);
  for (let s = 0; s < steps; s++) {
    const c = Math.floor((s + 0.5) * sr / srate), a = c - N / 2;
    for (let i = 0; i < N; i++) { const j = a + i; re[i] = j >= 0 && j < x.length ? x[j] * win[i] : 0; im[i] = 0; }
    fft(re, im);
    for (let b = 0; b < n; b++) {
      const i0 = Math.max(1, Math.floor(bin[b])), i1 = Math.max(i0 + 1, Math.ceil(bin[b + 1]));
      let m = 0; for (let i = i0; i < i1 && i < N / 2; i++) m = Math.max(m, Math.hypot(re[i], im[i]));
      const db = 20 * Math.log10(Math.max(1e-9, m / ref));
      out[s * n + b] = Math.max(0, Math.min(1, (db + DB) / DB));
    }
  }
  return out;
}
const pack = {
  u16: (a) => { const b = Buffer.alloc(a.length * 2); for (let i = 0; i < a.length; i++) b.writeUInt16LE(Math.round(Math.max(0, Math.min(1, a[i])) * 65535), 2 * i); return b.toString("base64"); },
  i8: (a) => { const b = Buffer.alloc(a.length); for (let i = 0; i < a.length; i++) b.writeInt8(Math.round(Math.max(-1, Math.min(1, a[i])) * 127), i); return b.toString("base64"); },
  u8: (a) => { const b = Buffer.alloc(a.length); for (let i = 0; i < a.length; i++) b[i] = Math.round(Math.max(0, Math.min(1, a[i])) * 255); return b.toString("base64"); },
};
const unpack = {
  u16: (s) => { const b = Buffer.from(s, "base64"), o = new Float32Array(b.length / 2); for (let i = 0; i < o.length; i++) o[i] = b.readUInt16LE(2 * i) / 65535; return o; },
  i8: (s) => { const b = Buffer.from(s, "base64"), o = new Float32Array(b.length); for (let i = 0; i < o.length; i++) o[i] = b.readInt8(i) / 127; return o; },
  u8: (s) => { const b = Buffer.from(s, "base64"), o = new Float32Array(b.length); for (let i = 0; i < o.length; i++) o[i] = b[i] / 255; return o; },
};
/** the analysis of decoded mono samples at sr */
function fromSamples(x, sr) {
  const A = rms(x, sr, RATE);
  let peak = 0; for (let i = 0; i < A.length; i++) peak = Math.max(peak, A[i]);
  return { dur: x.length / sr, rate: RATE, amp: pack.u16(A), prate: PRATE, peaks: pack.i8(peaks(x, sr, PRATE)), srate: SRATE, bands: BANDS,
    spec: pack.u8(spectrum(x, sr, SRATE, BANDS, LO, HI, NFFT)), edges: edges(BANDS, LO, HI).map((f) => Math.round(f)), peak: Math.round(peak * 1e5) / 1e5 };
}
function decode(file) {
  return new Promise((ok, no) => execFile("ffmpeg", ["-v", "error", "-i", file, "-t", String(MAX_S), "-vn", "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"],
    { encoding: "buffer", maxBuffer: MAX_S * SR * 4 + 1024 * 1024 }, (err, out, se) => {
      if (err && !(out && out.length)) {
        if (/does not contain any stream|Output file .* does not contain|matches no streams/i.test(String(se || ""))) return ok(new Float32Array(0));
        return no(new Error(String(se || err.message).trim().split("\n").pop() || "ffmpeg could not read the sound"));
      }
      const n = Math.floor(out.length / 4), x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = out.readFloatLE(4 * i);
      ok(x);
    }));
}
const mem = new Map();
/** analyze a file (remembered in memory and in cacheDir) */
async function analyze(file, cacheDir) {
  const st = fs.statSync(file), key = crypto.createHash("sha1").update([path.resolve(file), st.size, st.mtimeMs, RATE, SRATE, BANDS].join("|")).digest("hex").slice(0, 20);
  if (mem.has(key)) return mem.get(key);
  const cf = cacheDir ? path.join(cacheDir, key + ".json") : null;
  if (cf && fs.existsSync(cf)) { try { const j = JSON.parse(fs.readFileSync(cf, "utf8")); mem.set(key, j); return j; } catch { /* rebuild */ } }
  const r = fromSamples(await decode(file), SR);
  if (cf) { try { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cf, JSON.stringify(r)); } catch { /* memory only */ } }
  if (mem.size > 24) mem.delete(mem.keys().next().value);
  mem.set(key, r);
  return r;
}
module.exports = { SR, RATE, PRATE, SRATE, BANDS, LO, HI, NFFT, MAX_S, DB, rms, peaks, fft, edges, spectrum, pack, unpack, fromSamples, decode, analyze };
