#!/usr/bin/env node
// Unit tests for lib/waveform.js — the peak data the timeline draws inside
// audio clips. The bucketing is pure maths over a PCM buffer, so it is tested
// against synthesised buffers here; scripts/e2e-stub-test.sh drives the real
// ffmpeg path and the endpoint.
// Run: node scripts/test-waveform.js
const path = require("path");
const fs = require("fs");
const os = require("os");
const W = require(path.join(__dirname, "..", "lib", "waveform"));

let pass = 0, fail = 0;
function ok(n) { pass++; console.log("PASS: " + n); }
function bad(n, got) { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); }
function check(n, cond, got) { cond ? ok(n) : bad(n, got); }

/** Build s16le mono PCM from a function of position 0..1. */
function pcm(samples, fn) {
  const b = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const v = Math.max(-1, Math.min(1, fn(i / (samples - 1))));
    b.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return b;
}

// ------------------------------------------------------------------ shape
{
  // silence in, silence out, full scale in the middle: the peaks must arc
  const r = W.bucket(pcm(48000, (t) => Math.sin(t * 400) * Math.min(t / 0.5, (1 - t) / 0.5)), 100);
  const at = (f) => r.peaks[Math.floor(f * 99)];
  check("bucket: returns exactly the buckets asked for", r.peaks.length === 100, r.peaks.length);
  check("bucket: the loud middle is louder than both ends",
    at(0.5) > at(0.02) && at(0.5) > at(0.98), [at(0.02), at(0.5), at(0.98)]);
  check("bucket: normalised so the loudest point is full scale",
    Math.max(...r.peaks) === 255, Math.max(...r.peaks));
  check("bucket: every value is a byte",
    r.peaks.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), r.peaks.slice(0, 4));
}
{
  // a QUIET recording must still draw a readable shape rather than a flat
  // line — peaks are normalised to the file's own loudest point
  const loud = W.bucket(pcm(8000, (t) => Math.sin(t * 200)), 50);
  const quiet = W.bucket(pcm(8000, (t) => Math.sin(t * 200) * 0.02), 50);
  check("bucket: a quiet file normalises to the same shape as a loud one",
    Math.max(...quiet.peaks) === 255 && Math.max(...loud.peaks) === 255,
    [Math.max(...quiet.peaks), Math.max(...loud.peaks)]);
}
{
  const r = W.bucket(Buffer.alloc(0), 10);
  check("bucket: an empty buffer is flat, not a crash",
    r.peaks.length === 10 && r.peaks.every((v) => v === 0) && r.seconds === 0, r);
}
{
  const r = W.bucket(pcm(2, () => 1), 64);
  check("bucket: more buckets than samples still fills the array",
    r.peaks.length === 64 && r.peaks.every((v) => Number.isInteger(v)), r.peaks.length);
}
{
  // seconds is derived from the sample count at the fixed decode rate
  const r = W.bucket(pcm(W.RATE * 3, () => 0.5), 20);
  check("bucket: seconds comes out of the sample count", Math.abs(r.seconds - 3) < 0.01, r.seconds);
}

// -------------------------------------------------------------- cache key
{
  const f = path.join(os.tmpdir(), "wavekey_test.bin");
  fs.writeFileSync(f, "a");
  const st1 = fs.statSync(f);
  const k1 = W.keyFor(f, st1);
  check("keyFor: stable for the same file", k1 === W.keyFor(f, st1), k1);
  // A REPLACED asset must produce a new key, or the timeline draws the old
  // song's waveform over the new one and nobody notices for an hour.
  const k2 = W.keyFor(f, { size: st1.size + 1, mtimeMs: st1.mtimeMs });
  check("keyFor: a different size is a different key", k1 !== k2, [k1, k2]);
  const k3 = W.keyFor(f, { size: st1.size, mtimeMs: st1.mtimeMs + 1000 });
  check("keyFor: a different mtime is a different key", k1 !== k3, [k1, k3]);
  check("keyFor: a different path is a different key",
    k1 !== W.keyFor(f + "x", st1), k1);
  fs.unlinkSync(f);
}

// ---------------------------------------------------------------- missing
W.peaks(path.join(os.tmpdir(), "definitely_not_here_9481.wav"), os.tmpdir())
  .then(() => bad("peaks: a missing file rejects", "resolved"))
  .catch((e) => check("peaks: a missing file rejects with a clear message",
    /no such file/i.test(e.message), e.message))
  .then(() => {
    console.log("=======================");
    console.log(`RESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
