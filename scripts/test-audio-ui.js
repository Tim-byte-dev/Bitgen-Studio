#!/usr/bin/env node
/* bitGen Studio — 2.508.0 in a REAL browser: ♪ AUDIO → KEYS, 🌫 WAVEFORM and SPECTRUM layers (tlaudio.js, routes/audioAnalyze.js).
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" (step 2: audio -> keyframes, waveform and spectrum layers)
 *   1. a sound clip (quiet, then a 100 Hz tone, then a 4 kHz tone): the analysis hears bass, then treble
 *   2. ♪ Audio → keys on a picture's scale: quiet = 1, loud = 2
 *   3. the 🌫 tool: Alt+click = a Waveform (flat in the quiet, full in the tone); Alt+Shift+click = a Spectrum (the low
 *      bars up in the bass, the high bars in the treble)
 *   4. ⚙ Compile: COMPILE = CANVAS at two moments, the movie has the sound
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_au508). No
 * Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the audio browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_au508";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(args), { stdio: "ignore" });
function rgbOf(file, w, h, at) {
  const a = ["-loglevel", "error"].concat(at != null ? ["-ss", String(at)] : []).concat(["-i", file, "-frames:v", "1",
    "-vf", `scale=${w}:${h}:flags=neighbor`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  return execFileSync("ffmpeg", a, { maxBuffer: 64 * 1024 * 1024 });
}
const meanDiff = (A, B) => { let d = 0; for (let i = 0; i < A.length; i++) d += Math.abs(A[i] - B[i]); return d / A.length; };

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    ["video", "images", "sound"].forEach((d) => fs.mkdirSync(path.join(pd, d), { recursive: true }));
    ff(["-f", "lavfi", "-i", "color=c=0x202020:s=640x360:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-an", path.join(pd, "video", "au_base.webm")]);
    ff(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-f", "lavfi", "-i", "sine=frequency=100:duration=1:sample_rate=48000", "-f", "lavfi", "-i", "sine=frequency=4000:duration=1:sample_rate=48000",
        "-filter_complex", "[0:a]atrim=0:1[q];[1:a]volume=6[b];[2:a]volume=6[t];[q][b][t]concat=n=3:v=0:a=1", path.join(pd, "sound", "au_tones.wav")]);
    ff(["-f", "lavfi", "-i", "testsrc=s=160x60:r=1:d=1", "-frames:v", "1", path.join(pd, "images", "au_pic.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlGen && TlGen.ready && window.TlAudio && TlAudio.ready, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "au_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [];
      tl.audio = [mkLayer("A1", [{ name: "au_tones.wav", start: 0, dur: 3, in: 0, out: 3 }])];
      tl.images = [mkLayer("Pic", [{ name: "au_pic.png", start: 0, len: 3, opacity: 1, tf: { x: -220, y: -110, scale: 1, rot: 0 } }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0); await p.waitForTimeout(500);
    const scr = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
    const comp = (t) => p.evaluate((t) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(0, 0, 640, 360).data); }, t);
    const region = (px, x0, y0, x1, y1) => { const o = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 640 + x) * 4; o.push(px[i], px[i + 1], px[i + 2]); } return o; };
    const lum = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

    /* 1. the analysis */
    await p.evaluate(() => TlAudio.preload());
    const lv = await p.evaluate(() => ({ q: TlAudio.level("mix", "amp", 0.5), lb: TlAudio.level("mix", "amp", 1.5), b: TlAudio.level("mix", "bass", 1.5), t1: TlAudio.level("mix", "treble", 1.5), t: TlAudio.level("mix", "treble", 2.5), b2: TlAudio.level("mix", "bass", 2.5) }));
    check("the sound read: quiet at 0.5 s, loud at 1.5 s; the bass in the 100 Hz second, the treble in the 4 kHz one", lv.q < 0.05 && lv.lb > 0.8 && lv.b > 0.6 && lv.t1 < 0.3 && lv.t > 0.6 && lv.b2 < 0.3, lv);

    /* 2. ♪ Audio → keys */
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], TlCanvas.layerOf(tl.images[0].clips[0]))); await p.waitForTimeout(400);
    await p.selectOption("#tlpAuSrc", "mix"); await p.selectOption("#tlpAuWhat", "amp"); await p.selectOption("#tlpAuProp", "scale");
    await p.fill("#tlpAuLo", "1"); await p.fill("#tlpAuHi", "2"); await p.fill("#tlpAuSm", "0");
    await p.click("#tlpAuGo");
    await p.waitForFunction(() => (tl.images[0].clips[0].kf || []).filter((k) => k.scale != null).length > 1, null, { timeout: 30000 });
    const sk = await p.evaluate(() => { const c = tl.images[0].clips[0]; return { n: c.kf.filter((k) => k.scale != null).length, a: H3Keyframes.value(c.kf, 0.5, "scale", 0), b: H3Keyframes.value(c.kf, 1.5, "scale", 0), c2: H3Keyframes.value(c.kf, 2.5, "scale", 0) }; });
    check("♪ Make keys on the picture's scale: quiet = 1, the tones = 2 (a few keys, not one a frame)", Math.abs(sk.a - 1) < 0.05 && sk.b > 1.9 && sk.c2 > 1.9 && sk.n < 40, sk);

    /* 3. waveform + spectrum */
    await p.evaluate(() => TlCanvas.setTool("gen"));
    const wpt = await scr(420, 100); await p.keyboard.down("Alt"); await p.mouse.click(wpt[0], wpt[1]); await p.keyboard.up("Alt"); await p.waitForTimeout(400);
    await p.evaluate(() => TlCanvas.setTool("gen"));
    const spt = await scr(320, 180); await p.keyboard.down("Alt"); await p.keyboard.down("Shift"); await p.mouse.click(spt[0], spt[1]); await p.keyboard.up("Shift"); await p.keyboard.up("Alt"); await p.waitForTimeout(400);
    const made = await p.evaluate(() => tl.images.map((L) => [L.name, L.clips[0].gen && L.clips[0].gen.kind, L.clips[0].gen && L.clips[0].gen.y]));
    check("🌫 Alt+click = an Audio Waveform there, Alt+Shift+click = an Audio Spectrum", made.some((m) => m[1] === "wave" && /Waveform/.test(m[0]) && m[2] === -80) && made.some((m) => m[1] === "spectrum" && /Spectrum/.test(m[0])), made);
    const sel = await p.evaluate(() => { const L = tl.images.find((L) => L.clips[0].gen && L.clips[0].gen.kind === "spectrum"); TlCanvas.select(L.clips[0], TlCanvas.layerOf(L.clips[0])); return true; });
    await p.waitForTimeout(400);
    const ui = await p.evaluate(() => ({ kind: (document.getElementById("tlpGnKind") || {}).value, aud: !!document.getElementById("tlpGnAud"), st: (document.getElementById("tlpGnAStyle") || {}).value, bands: !!document.querySelector('[data-gn="bands"]') }));
    const q05 = await comp(0.5), q15 = await comp(1.5), q25 = await comp(2.5);
    const wq = lum(region(q05, 300, 40, 600, 160)), wl = lum(region(q15, 300, 40, 600, 160));
    const L15 = lum(region(q15, 50, 200, 300, 352)), R15 = lum(region(q15, 340, 200, 600, 352)), L25 = lum(region(q25, 50, 200, 300, 352)), R25 = lum(region(q25, 340, 200, 600, 352));
    check("the Waveform: a thin line in the quiet, a full wave in the tone", sel && wl > wq + 8, { wq, wl });
    check("the Spectrum (sound, style, bands in its Properties): the low bars up in the bass second, the high bars in the treble second",
      ui.kind === "spectrum" && ui.aud && ui.st === "bars" && ui.bands && L15 > R15 + 3 && R25 > L25 + 3, { ui, L15, R15, L25, R25 });

    /* 4. the compile */
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(400); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_au_1.png"), await snapAt(1.5)); fs.writeFileSync(path.join(pd, "temp_au_2.png"), await snapAt(2.5));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 400000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 400 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile: done", stt === "done" && fs.existsSync(movie), [stt, log.slice(-6)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_au_1.png"), W, H), m1 = rgbOf(movie, W, H, 1.5), c2 = rgbOf(path.join(pd, "temp_au_2.png"), W, H), m2 = rgbOf(movie, W, H, 2.5);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      const aud = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", movie], { encoding: "utf8" }).trim();
      check("COMPILE = CANVAS at 1.5 s and 2.5 s (a waveform, a spectrum, a picture scaled by the sound): mean difference under 7; the movie has the sound", d1 < 7 && d2 < 7 && /audio/.test(aud), [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100, aud]);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 700));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
