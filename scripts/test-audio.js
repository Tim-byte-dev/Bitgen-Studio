#!/usr/bin/env node
/* bitGen Studio — 2.508.0 unit tests: ♪ AUDIO → KEYS, 🌫 WAVEFORM / SPECTRUM layers, ƒx audio()
 * (lib/audioAnalyze.js, routes/audioAnalyze.js, ext/timelinedock/tlaudio.js via tlgen.js, tlexpr.js).
 * Tim: "lets do steps 1,2,3 , 4,5,6 and 7" (step 2: audio -> keyframes, waveform and spectrum layers). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const AA = require(path.join(ROOT, "lib", "audioAnalyze.js"));
const AU = require(path.join(ROOT, "ext", "timelinedock", "tlaudio.js"));
const G = require(path.join(ROOT, "ext", "timelinedock", "tlgen.js"));
const X = require(path.join(ROOT, "ext", "timelinedock", "tlexpr.js"));
const KF = require(path.join(ROOT, "static", "keyframes.js"));

(async () => {
  /* the FFT against a plain DFT */
  const N = 64, re = new Float64Array(N), im = new Float64Array(N), x = [];
  for (let i = 0; i < N; i++) { x.push(Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1) + (i % 5) * 0.1); re[i] = x[i]; }
  AA.fft(re, im);
  let err = 0; for (let k = 0; k < N; k++) { let r = 0, j = 0; for (let n = 0; n < N; n++) { r += x[n] * Math.cos(-2 * Math.PI * k * n / N); j += x[n] * Math.sin(-2 * Math.PI * k * n / N); } err = Math.max(err, Math.abs(r - re[k]), Math.abs(j - im[k])); }
  check("fft: the same as a plain DFT", err < 1e-9, err);

  /* samples: 1 s of a 1 kHz full-scale sine, then 1 s of quiet */
  const sr = AA.SR, s = new Float32Array(sr * 2); for (let i = 0; i < sr; i++) s[i] = Math.sin(2 * Math.PI * 1000 * i / sr);
  const A = AA.rms(s, sr, 48);
  check("rms: a full-scale sine = 0.707, quiet = 0, 48 steps a second", A.length === 96 && Math.abs(A[20] - Math.SQRT1_2) < 0.01 && A[70] === 0, [A.length, A[20], A[70]]);
  const pk = AA.peaks(s, sr, 1200);
  check("peaks: min / max pairs 1200 a second (-1 .. 1 in the sine)", pk.length === 4800 && Math.min(pk[200], pk[202], pk[204]) < -0.95 && Math.max(pk[201], pk[203], pk[205]) > 0.95 && pk[3000] === 0 && pk[3001] === 0);
  const sp = AA.spectrum(s, sr, 24, 64, 30, 12000, 2048), E = AA.edges(64, 30, 12000);
  const b1k = E.findIndex((f, i) => f <= 1000 && E[i + 1] > 1000);
  check("spectrum: the band holding 1 kHz near 0 dB (level ~1), far bands and the quiet second near nothing",
    sp[10 * 64 + b1k] > 0.95 && sp[10 * 64 + 2] < 0.2 && sp[10 * 64 + 60] < 0.3 && sp[36 * 64 + b1k] === 0, [sp[10 * 64 + b1k], sp[10 * 64 + 2], sp[10 * 64 + 60], sp[36 * 64 + b1k]]);
  const fr = AA.fromSamples(s, sr), D = AU.prep(fr);
  check("pack / unpack (base64): loudness, peaks and spectrum come back (within a step)", Math.abs(D.amp[20] - A[20]) < 1e-4 && Math.abs(D.pk[201] - pk[201]) < 0.01 && Math.abs(D.spec[10 * 64 + b1k] - sp[10 * 64 + b1k]) < 0.005 && Math.abs(fr.peak - Math.SQRT1_2) < 0.01);
  check("levelOf: loudness to the loudest moment (1 in the tone, 0 in the quiet); the mids hold a 1 kHz tone, not the bass",
    Math.abs(AU.levelOf(D, 0.5, "amp") - 1) < 0.02 && AU.levelOf(D, 1.5, "amp") === 0 && AU.levelOf(D, 0.5, "mid") > 0.7 && AU.levelOf(D, 0.5, "bass") < 0.3, [AU.levelOf(D, 0.5, "mid"), AU.levelOf(D, 0.5, "bass")]);
  check("bandsOf: 64 levels -> n, each its share's loudest; peaksIn: the lowest / highest in a stretch",
    AU.bandsOf(Float32Array.from({ length: 64 }, (_, i) => i / 63), 4)[3] === 1 && AU.bandsOf(Float32Array.from({ length: 64 }, (_, i) => i / 63), 4).length === 4 && AU.peaksIn(D, 0.1, 0.2)[1] > 0.9 && AU.peaksIn(D, 1.2, 1.3)[1] === 0);

  /* a REAL file through ffmpeg: 100 Hz for 1 s, then 4 kHz for 1 s */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "au508-")), wav = path.join(tmp, "two.wav");
  try {
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=100:duration=1:sample_rate=48000", "-f", "lavfi", "-i", "sine=frequency=4000:duration=1:sample_rate=48000", "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1,volume=6", wav]);
    const j = await AA.analyze(wav, path.join(tmp, "cache")), R = AU.prep(j);
    check("analyze (ffmpeg): 2 s; the bass up in the first second, the treble in the second; remembered on disk",
      Math.abs(R.dur - 2) < 0.05 && AU.levelOf(R, 0.5, "bass") > 0.6 && AU.levelOf(R, 0.5, "treble") < 0.3 && AU.levelOf(R, 1.5, "treble") > 0.6 && AU.levelOf(R, 1.5, "bass") < 0.3 && fs.readdirSync(path.join(tmp, "cache")).length === 1,
      [R.dur, AU.levelOf(R, 0.5, "bass"), AU.levelOf(R, 0.5, "treble"), AU.levelOf(R, 1.5, "treble"), AU.levelOf(R, 1.5, "bass")]);
  } catch (e) { check("analyze (ffmpeg)", false, String(e.message || e)); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  /* keys */
  const lv = []; for (let i = 0; i < 48; i++) lv.push(i < 24 ? 0.2 : 0.8);
  const K = AU.toKeys(lv, 24, 1, 1.5, 0, 400);
  check("toKeys: quiet .. loud of the stretch = the two values; a step needs only its corners (thinned)", K.length <= 6 && K[0][1] === 1 && K[K.length - 1][1] === 1.5 && Math.abs(K[K.length - 1][0] - 47 / 24) < 1e-9, K);
  const noisy = []; for (let i = 0; i < 2400; i++) noisy.push(Math.abs(Math.sin(i * 1.3) * Math.cos(i * 0.37)));
  const K2 = AU.toKeys(noisy, 24, 0, 100, 0, 400), K3 = AU.toKeys(noisy, 24, 0, 100, 3, 400);
  const sp1 = AU.toKeys([0, 0, 0, 0, 1, 0, 0, 0, 0], 24, 0, 1, 1, 400), v3 = KF.value(sp1.map((p) => ({ at: p[0], op: p[1] })), 3 / 24, "op", 0);
  check("toKeys: at most 400 keys however busy the sound (100 s); smoothing spreads a spike over its neighbours", K2.length <= 400 && K2.length > 50 && K3.length <= 400 && v3 > 0.9, [K2.length, K3.length, v3]);
  check("simplify: a straight line = its two ends", AU.simplify([[0, 0], [1, 1], [2, 2], [3, 3]], 0.01).length === 2);

  /* the generator kinds + ƒx */
  check("tlgen: Waveform / Spectrum are generator kinds (cleaned by tlaudio: styles, bands 4..64, the sound named)",
    G.clean({ kind: "wave", style: "x" }).style === "wave" && G.clean({ kind: "spectrum", bands: 999 }).bands === 64 && G.clean({ kind: "spectrum" }).aud === "mix" && G.live({ gen: { kind: "wave" } }));
  const gc = { gen: Object.assign({}, AU.DEFAULTS.spectrum), kf: KF.set(KF.set(undefined, 0, { gn_gain: 100 }, 24), 2, { gn_gain: 300 }, 24) };
  check("keyable: gn_gain at 1 s (tlgen.params)", G.params(gc, 1, KF).gain === 200);
  const ev = X.evaluate('value + audio("bass") * 40', { time: 1, value: 10, audio: (w) => (w === "bass" ? 0.5 : 0) });
  check("ƒx audio(\"bass\"): the sound's level 0..1 (no sound = 0)", ev.ok && ev.v === 30 && X.evaluate("audio()", { time: 0, value: 0 }).v === 0, ev);
  check("ƒx presets still all parse (+ the two audio ones)", X.PRESETS.every((p) => X.compile(p[0]).ok) && X.PRESETS.some((p) => /audio\(/.test(p[0])));

  /* wiring */
  const RI = read("routes", "index.js"), RA = read("routes", "audioAnalyze.js"), TG = read("ext", "timelinedock", "tlgen.js"), TA = read("ext", "timelinedock", "tlaudio.js"), TE = read("ext", "timelinedock", "tlexpr.js");
  check("the route: GET /api/audio/analyze (a clip named, never pathed), mounted from routes/index.js (not server.js)",
    /require\("\.\/audioAnalyze"\)\.mount\(app\);/.test(RI) && /app\.get\("\/api\/audio\/analyze"/.test(RA) && /frames\.resolveMedia\(/.test(RA) && !/audioAnalyze/.test(read("misc/server.js")));
  check("the page: the 🌫 tool's Alt+click = a Waveform, Alt+Shift+click = a Spectrum; the kind list has both; drawn from the sound at the moment (cache keyed by the analysis' version)",
    /d\.alt && Math\.hypot/.test(TG) && />Waveform<\/option>/.test(TG) && />Spectrum<\/option>/.test(TG) && /TlAudio\.draw\(ag, o, \(c\.start \|\| 0\) \+ tau, W, H\)/.test(TG) && /TlAudio\.version\(\)/.test(TG));
  check("♪ Audio → keys in the Properties (sound, loudness / bass / mids / treble, the property, quiet / loud, smooth); the bake waits for the sound; ƒx audio() reads the mix",
    /id="tlpAuGo"/.test(TA) && /id="tlpAuWhat"/.test(TA) && /TlParent\.bakeAll = function \(\) \{ var self = this, args = arguments; return preload\(\)\.then/.test(TA) && /audio: audioVal/.test(TE) && /TlAudio\.level\("mix", what, tt\)/.test(TE));
  const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
  check("wiring: tlaudio.js before tlgen.js", EXT.indexOf("tlaudio.js") >= 0 && EXT.indexOf("tlaudio.js") < EXT.indexOf("tlgen.js"));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
