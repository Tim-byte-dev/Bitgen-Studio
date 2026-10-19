#!/usr/bin/env node
/* bitGen Studio — 2.416.0 units: the bigger Premiere rows (part one)
 *   1. MASKS / POWER WINDOWS: static/clipfx.js normMask / maskAt / maskAlpha, scripts/vfx_filters.py's mask RENDERED by
 *      ffmpeg and checked pixel by pixel against maskAlpha (ellipse, box, rotation, feather, invert, a tracked centre)
 *   2. 🎯 TRACKING: scripts/track.py follows a ball across a busy picture (OpenCV and numpy alike)
 *   3. 🎥 MULTI-CAMERA: scripts/audiosync.py finds the lag between two recordings of one moment (and says when there is
 *      none); static/multicam.js places the angles, cuts between them, builds the program + its sound
 *   4. 🪶 PROXIES: what counts as heavy; the page / route wiring
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8", cwd: ROOT, maxBuffer: 64 << 20 });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "p11_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });

/* ---- 1. masks */
const FX = require(path.join(ROOT, "static", "clipfx.js"));
const m0 = FX.normalize({ mask: { shape: "ellipse", x: 3, w: 9, feather: 2, track: [{ at: 2, x: 0.7, y: 0.5 }, { at: 0, x: 0.3, y: 0.5 }, { at: "x" }] } }).mask;
check("normMask: clamped (x 1.5, w 2, feather 0.5), the track sorted, bad samples dropped; no shape = no mask", m0.x === 1.5 && m0.w === 2 && m0.feather === 0.5 && m0.track.length === 2 && m0.track[0].at === 0
  && FX.normalize({ mask: { shape: "star" } }) === null, m0);
check("maskAt: the track between its samples, held before / after; no track = its own centre", near(FX.maskAt(m0, 1).x, 0.5) && FX.maskAt(m0, -1).x === 0.3 && FX.maskAt(m0, 9).x === 0.7 && FX.maskAt({ x: 0.2, y: 0.4 }, 1).y === 0.4);
const E = { shape: "ellipse", x: 0.5, y: 0.5, w: 0.5, h: 0.5, rot: 0, feather: 0 };
check("maskAlpha: inside 1, outside 0 (hard edge); invert swaps; a box", FX.maskAlpha(E, 160, 90, 320, 180) === 1 && FX.maskAlpha(E, 10, 10, 320, 180) === 0
  && FX.maskAlpha(Object.assign({}, E, { invert: true }), 10, 10, 320, 180) === 1 && FX.maskAlpha(Object.assign({}, E, { shape: "rect" }), 239, 90, 320, 180) === 1 && FX.maskAlpha(Object.assign({}, E, { shape: "rect" }), 241, 90, 320, 180) === 0);
check("...a feather: half on the edge, a smooth ramp either side", near(FX.maskAlpha(Object.assign({}, E, { feather: 0.1 }), 240, 90, 320, 180), 0.5, 1e-9) && FX.maskAlpha(Object.assign({}, E, { feather: 0.1 }), 235, 90, 320, 180) > 0.5 && FX.maskAlpha(Object.assign({}, E, { feather: 0.1 }), 245, 90, 320, 180) < 0.5);
check("...rotation: a long thin box turned 90° covers up-down, not across", FX.maskAlpha({ shape: "rect", x: 0.5, y: 0.5, w: 0.6, h: 0.05, rot: 90, feather: 0 }, 160, 40, 320, 180) === 1 && FX.maskAlpha({ shape: "rect", x: 0.5, y: 0.5, w: 0.6, h: 0.05, rot: 90, feather: 0 }, 60, 90, 320, 180) === 0);
// rendered: a grey ramp, the look = an inverting LUT; out = before x (1 - a) + inverted x a
ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=2", "-vf", "format=gray,geq=lum='30+X*0.6',format=yuv444p", "-c:v", "libx264", "-crf", "4", "-pix_fmt", "yuv444p", path.join(TMP, "ramp.mp4")]);
{ const N = 17, L = ["TITLE \"inv\"", "LUT_3D_SIZE " + N]; for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) L.push([r, g, b].map((v) => (1 - v / (N - 1)).toFixed(6)).join(" ")); fs.writeFileSync(path.join(TMP, "inv.cube"), L.join("\n") + "\n"); }
const lum = (f, t) => execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 22 });
const SRC = lum(path.join(TMP, "ramp.mp4"), 0.5);
for (const [name, mk, t] of [
  ["a feathered ellipse", { shape: "ellipse", x: 0.45, y: 0.5, w: 0.5, h: 0.7, rot: 0, feather: 0.12 }, 0.5],
  ["a turned box", { shape: "rect", x: 0.55, y: 0.45, w: 0.4, h: 0.3, rot: 30, feather: 0.04 }, 0.5],
  ["an inverted ellipse", { shape: "ellipse", x: 0.5, y: 0.5, w: 0.4, h: 0.4, rot: 0, feather: 0.08, invert: true }, 0.5],
  ["a TRACKED ellipse (0.3 -> 0.7 over a second: at 0.5 s in the middle)", { shape: "ellipse", x: 0.5, y: 0.5, w: 0.3, h: 0.4, rot: 0, feather: 0.06, track: [{ at: 0, x: 0.3, y: 0.5 }, { at: 1, x: 0.7, y: 0.5 }] }, 0.5]]) {
  const p = JSON.parse(py(`import vfx_filters as V
p=[]; n=V.build(p, "[0:v]", "[v]", {}, 320, 180, lut=${JSON.stringify(path.join(TMP, "inv.cube"))}, mask=json.loads(${JSON.stringify(JSON.stringify(mk))})); print(json.dumps({"p": p, "n": n}))`));
  const out = path.join(TMP, "m.mkv");
  ff(["-i", path.join(TMP, "ramp.mp4"), "-filter_complex", p.p.join(";"), "-map", "[v]", "-t", "1", "-c:v", "ffv1", out]);
  const D = lum(out, t), m = FX.normMask(mk);
  let worst = 0, n = 0;
  for (let y = 3; y < 180; y += 6) for (let x = 3; x < 320; x += 7) {
    const a = FX.maskAlpha(m, x + 0.5, y + 0.5, 320, 180, t), s = SRC[y * 320 + x], want = s * (1 - a) + (255 - s) * a;
    worst = Math.max(worst, Math.abs(D[y * 320 + x] - want)); n++;
  }
  // a still mask is placed exactly; a moving one to the nearest whole pixel each frame (half a pixel on a soft edge)
  const tol = mk.track ? 20 : 6;
  check(`MASK ${name}: ffmpeg's render = maskAlpha's blend of the picture and its look (${n} points, within ${tol} levels${mk.track ? " - half a pixel on the soft edge" : ""}); the log's words`, worst <= tol && p.n.some((w) => /the look (inside|outside)/.test(w)), { worst, notes: p.n });
}
const kp = JSON.parse(py(`import vfx_filters as V
p=[]; V.build(p, "[0:v]", "[v]", {"key": {"color": "#00ff00"}, "blur": 3}, 320, 180, mask={"shape": "ellipse"}); print(json.dumps(p))`));
check("...a keyed clip: the key on the whole picture first, the mask times its alpha (alphaextract + multiply), the result keeps its alpha",
  kp[0].includes("chromakey") && kp.some((x) => /alphaextract/.test(x)) && kp.some((x) => /blend=all_mode=multiply/.test(x)) && /overlay=format=auto,format=yuva420p\[v\]$/.test(kp[kp.length - 1]), kp);
const nm = JSON.parse(py(`import vfx_filters as V
p=[]; V.build(p, "[0:v]", "[v]", {}, 320, 180, mask={"shape": "ellipse"}); print(json.dumps(p))`));
check("...a mask with no look (no grade, no effects): nothing to mask - the picture as it is", nm.length === 1 && /null\[v\]$/.test(nm[0]), nm);
const W = read("worker.py"), CR = read("scripts", "clipfx_render.py"), CF = read("lib", "clipFx.js"), CV = read("ext", "timelinedock", "canvas.js"), CP = read("ext", "timelinedock", "colourpanel.js");
check("the compile passes fx.mask (a clip: clipfx_render; an adjustment layer: the worker, its track from its start); the canvas masks the look the same way",
  /mask=fx\.get\("mask"\)/.test(CR) && /mask=adj\.get\("mask"\)/.test(W) && /if \(fx\.mask\) out\.mask = fx\.mask;/.test(CF)
  && /pic = masked\(pre, pic, fx\.mask, \(t \|\| 0\) - \(\+c\.start \|\| 0\)\)/.test(CV) && /F\.maskAlpha\(m, \(x \+ 0\.5\) \* w \/ mw/.test(CV));
check("🎨 Colour: ◯ Mask (shape, invert, centre / size / rotation / feather, 🎯 Track, ✕ track) + its outline on the canvas",
  /id="tcpMaskShape"/.test(CP) && /id="tcpMaskInv"/.test(CP) && /data-mk="/.test(CP) && /id="tcpMaskTrack"/.test(CP) && /\/api\/clipfx\/track/.test(CP) && /TlCanvas\.onDraw\(outline\)/.test(CP));

/* ---- 2. tracking */
ff(["-f", "lavfi", "-i", "testsrc2=s=640x360:r=25:d=4", "-f", "lavfi", "-i", "color=c=0xffd040:s=80x80:r=25:d=4", "-filter_complex",
    "[1:v]format=rgba,geq=r='255':g='210':b='60':a='if(lt(hypot(X-40,Y-40),38),255,0)'[o];[0:v]eq=brightness=-0.2[b];[b][o]overlay=x='100+t*100':y='140+40*sin(t*2)'",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(TMP, "ball.mp4")]);
const tk = JSON.parse(py(`import track as T, math
out = {}
for impl in ("cv", "np"):
    if impl == "np": T.cv2 = None
    d = T.track(${JSON.stringify(path.join(TMP, "ball.mp4"))}, 0.5, 3.5, (140 + 50) / 640, (180 + 40 * math.sin(1)) / 360, 0.07, 0.12)
    out[impl] = {"method": d["method"], "n": len(d["track"]), "gaps": d["gaps"], "err": max(math.hypot(p["x"] * 640 - (140 + p["t"] * 100), p["y"] * 360 - (180 + 40 * math.sin(p["t"] * 2))) for p in d["track"])}
print(json.dumps(out))`));
check("🎯 track.py follows a yellow ball across testsrc2's busy bars for 3 s (30 samples), within 20 px of 640 - with OpenCV and with numpy alone",
  tk.cv.n >= 29 && tk.cv.err < 20 && tk.np.method === "numpy" && tk.np.n >= 29 && tk.np.err < 20 && !tk.cv.gaps.length, tk);
ff(["-f", "lavfi", "-i", "testsrc2=s=640x360:r=25:d=4", "-f", "lavfi", "-i", "color=c=0xffd040:s=80x80:r=25:d=4", "-filter_complex",
    "[1:v]format=rgba,geq=r='255':g='210':b='60':a='if(lt(hypot(X-40,Y-40),38),255,0)'[o];[0:v]eq=brightness=-0.2[b];[b][o]overlay=x='100+t*100':y='140+40*sin(t*2)':enable='lt(t,2)'",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(TMP, "gone.mp4")]);
const lt = JSON.parse(py(`import track as T, math
d = T.track(${JSON.stringify(path.join(TMP, "gone.mp4"))}, 0.5, 3.5, (140 + 50) / 640, (180 + 40 * math.sin(1)) / 360, 0.07, 0.12)
print(json.dumps({"n": len(d["track"]), "lost": d["lost"], "gaps": d["gaps"], "last": d["track"][-1]}))`));
check("...the ball gone at 2 s: said lost from 2 s (a gap to the end), the mask held where it was last seen", lt.n >= 29 && lt.lost >= 1.9 && lt.lost <= 2.2 && lt.gaps.length && lt.gaps[lt.gaps.length - 1][1] >= 3.3
  && Math.abs(lt.last.x * 640 - 330) < 25, lt);
check("lib/track.js + POST /api/clipfx/track (routes/clipfx.js)", /track\.py/.test(read("lib", "track.js")) && /app\.post\("\/api\/clipfx\/track"/.test(read("routes", "clipfx.js")));

/* ---- 3. multi-camera */
ff(["-f", "lavfi", "-i", "anoisesrc=d=12:c=pink:r=48000:a=0.3", "-af", "volume='0.3+0.7*abs(sin(t*3))*gt(sin(t*1.7),0)':eval=frame", path.join(TMP, "ev.wav")]);
ff(["-f", "lavfi", "-i", "color=red:s=160x90:r=25:d=8", "-ss", "1.5", "-t", "8", "-i", path.join(TMP, "ev.wav"), "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(TMP, "camA.mp4")]);
ff(["-f", "lavfi", "-i", "color=blue:s=160x90:r=25:d=8", "-ss", "3.25", "-t", "8", "-i", path.join(TMP, "ev.wav"), "-af", "volume=0.3,highpass=f=300", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(TMP, "camB.mp4")]);
ff(["-f", "lavfi", "-i", "color=green:s=160x90:r=25:d=6", "-f", "lavfi", "-i", "sine=440:d=6", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(TMP, "camC.mp4")]);
const as = JSON.parse(execFileSync("python3", [path.join(ROOT, "scripts", "audiosync.py"), path.join(TMP, "camA.mp4"), path.join(TMP, "camB.mp4"), path.join(TMP, "camC.mp4")], { encoding: "utf8" }));
check("audiosync: B (a quieter, thinner mic) is the same moment 1.75 s later in A - found to the sample, a clear match; C (a tone) has no match, said",
  near(as.results[0].lag, 1.75, 0.005) && as.results[0].ok && as.results[0].score > 0.5 && !as.results[1].ok && /no clear match/.test(as.results[1].why), as);
const MC = require(path.join(ROOT, "static", "multicam.js"));
const fs1 = MC.fromSync([{ name: "a.mp4", start: 2, in: 0, dur: 8 }, { name: "b.mp4", start: 0, in: 0, dur: 8 }, { name: "c.mp4", start: 5, in: 1, dur: 6 }], [{ ok: true, lag: 1.75 }, { ok: false, why: "no" }]);
check("fromSync: the reference stays (its file from 2 s), B 1.75 s after it, C (no match) where it was (its file's 0 at 4 s), marked", fs1.angles[0].off === 2 && fs1.angles[1].off === 3.75 && fs1.angles[2].off === 4 && fs1.angles[2].unsynced && fs1.bad.length === 1);
const mc = { angles: fs1.angles, sound: 1, cuts: [{ t: 2, a: 0 }] };
mc.cuts = MC.switchAt(mc, 5, 1); mc.cuts = MC.switchAt(mc, 7.5, 2); mc.cuts = MC.switchAt(mc, 7.51, 0); mc.cuts = MC.switchAt(mc, 9, 0);
check("switchAt: a cut on the same frame replaces the last one, two in a row to one angle become one; an opening cut at the start",
  JSON.stringify(mc.cuts) === '[{"t":2,"a":0},{"t":5,"a":1},{"t":7.51,"a":0}]', mc.cuts);
const prog = MC.program(mc, 25);
check("program: V1's clips = the cuts - each angle's file from (t - its place), its own sound out; to the end of what the last angle covers",
  JSON.stringify(prog.map((c) => [c.name, c.start, c.in, c.out, c.soundOut, c.mc])) === JSON.stringify([["a.mp4", 2, 0, 3, true, 0], ["b.mp4", 5, 1.24, 3.76, true, 1], ["a.mp4", 7.52, 5.52, 8, true, 0]]), prog);
check("soundClip: the chosen sound angle (B) under the whole program; angleAt", JSON.stringify(MC.soundClip(mc)) === '{"name":"b.mp4","src":"video","in":0,"out":8,"dur":8,"start":3.75,"mcSound":true}' && MC.angleAt(mc, 6) === 1 && MC.angleAt(mc, 8) === 0);
const MJ = read("ext", "timelinedock", "multicam.js");
check("🎥 the page: tick the angles + the sound one, ⇆ Sync by sound (POST /api/multicam/sync), V1 = the program, keys 1 - 9 / a click cut live, ⇲ Flatten",
  /\/api\/multicam\/sync/.test(MJ) && /Digit\(\[1-9\]\)/.test(MJ) && /X\(\)\.switchAt\(m, t, i, fps\(\)\)/.test(MJ) && /id="tmcFlat"/.test(MJ) && /🎥 Sound/.test(MJ) && /routes\/multicam|require\("\.\/multicam"\)\.mount\(app\)/.test(read("routes", "index.js")));

/* ---- 4. proxies */
const PX = require(path.join(ROOT, "lib", "proxy.js"));
check("heavy: 3840×2160, HEVC / ProRes, over 40 Mbit/s; a 1080p H.264 at 12 Mbit/s is not",
  PX.heavyOf({ w: 3840, h: 2160, codec: "h264", mbps: 20 }).join() === "3840×2160" && PX.heavyOf({ w: 1920, h: 1080, codec: "hevc", mbps: 8 }).join() === "hevc"
  && PX.heavyOf({ w: 1920, h: 1080, codec: "prores", mbps: 120 }).length === 2 && PX.heavyOf({ w: 1920, h: 1080, codec: "h264", mbps: 12 }).length === 0);
const PJ = read("ext", "timelinedock", "proxy.js");
check("🪶 the page: play proxies (tl.proxies), make for the heavy ones / all, the canvas reads TlProxy.url (the compile the originals); routes/proxy.js mounted",
  /tl\.proxies = \$\("tpxOn"\)\.checked/.test(PJ) && /id="tpxHeavy"/.test(PJ) && /var pu = TlProxy\.url\(c\); if \(pu\) return pu;/.test(CV) && /require\("\.\/proxy"\)\.mount\(app\)/.test(read("routes", "index.js"))
  && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("proxy.js") && /<script src="\/static\/multicam\.js"><\/script>/.test(read("static", "index.html")));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
