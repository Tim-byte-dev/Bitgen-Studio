#!/usr/bin/env node
/* bitGen Studio — 2.415.0 units: the MEDIUM Premiere jobs (part two)
 *   1. 🎚 the TRACK MIXER: faders to +6 dB, pan (the balance law) - lib/mixer.js, scripts/mixfx.py (pan_inputs,
 *      master_out, panned) and the page / route / worker carrying them; the WebAudio routing hook in the canvas
 *   2. DISTORT: lens / mirror / warp (wave, twirl) - static/clipfx.js normalize + distortAt, scripts/vfx_filters.py's
 *      filters RENDERED by ffmpeg and checked pixel by pixel against distortAt (the canvas's shader uses the same)
 *   3. the TRANSITIONS LIBRARY: every ffmpeg xfade transition in the catalogue (each one ffmpeg knows), a layer's
 *      boundary drawn as its shape (scripts/transitions.py boundary_chain RENDERED: a wipe reveals from the right),
 *      the canvas's preview maths (static/trprev.js)
 *   4. 🎯 COLOUR MATCH: quantile curves (monotone), a warm clip matched to a cool one lands on its colour
 * Tim: "lets do the medium jobs now". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + ")\n" + code], { encoding: "utf8", cwd: ROOT, maxBuffer: 64 << 20 });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "p10_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const rgb = (f, w, h, vf) => execFileSync("ffmpeg", ["-loglevel", "error", "-i", f, "-frames:v", "1", "-vf", (vf ? vf + "," : "") + "format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 });

/* ---- 1. the mixer */
const MX = require(path.join(ROOT, "lib", "mixer.js"));
check("faders: 0 .. 2 (+6 dB), the default 1; pans -1 .. 1, rubbish = centre", MX.gain(3) === 2 && MX.gain(-1) === 0 && MX.gain(undefined) === 1 && MX.pan(2) === 1 && MX.pan("x") === 0 && MX.pan(-0.25) === -0.25);
check("the balance law: right 50 % = the left at half, the right at full; hard left = the right silent", JSON.stringify(MX.panGains(0.5)) === "[0.5,1]" && JSON.stringify(MX.panGains(-1)) === "[1,0]" && JSON.stringify(MX.panGains(0)) === "[1,1]");
check("master: only when it moves ({volume}); dB of a gain", MX.master({ volume: 1 }) === null && MX.master({ volume: 0.5 }).volume === 0.5 && MX.db(2) === 6 && MX.db(0.5) === -6 && MX.db(0) === -Infinity);
const pj = JSON.parse(py(`import mixfx as M
p=[]; labs=M.pan_inputs(p, ["[a]","[b]","[c]"], [0, 0.5, -1])
q=[]; m=M.master_out(q, "[aout]", {"volume": 0.5})
print(json.dumps({"labs": labs, "p": p, "m": m, "q": q, "g": M.pan_gains(0.25), "pan1": M.panned({"video_pan": 0}), "pan2": M.panned({"audio": [{"clips": [{"pan": 0.3}]}]}),
  "pan3": M.panned({"master": {"volume": 1.2}}), "pan4": M.panned({"video_layers": [{"pan": -1}]}), "none": M.master_out([], "[aout]", None)}))`));
check("mixfx: an unpanned input untouched, panned ones through pan=stereo with the balance gains; the master a volume on the mix",
  pj.labs.join() === "[a],[pan1],[pan2]" && pj.p[0] === "[b]aformat=channel_layouts=stereo,pan=stereo|c0=0.5000*c0|c1=1.0000*c1[pan1]" && /c0=1\.0000\*c0\|c1=0\.0000\*c1/.test(pj.p[1])
  && pj.m === "[amaster]" && pj.q[0] === "[aout]volume=0.5000[amaster]" && pj.none === "[aout]", pj);
check("mixfx.panned: a pan anywhere (V1, a layer, a sound clip) or the master moved -> the compile's full sound pass", !pj.pan1 && pj.pan2 && pj.pan3 && pj.pan4 && near(pj.g[0], 0.75), pj);
const W = read("misc/worker.py"), RI = read("routes", "index.js"), TLD = read("ext", "timelinedock", "timelinedock.js"), CV = read("ext", "timelinedock", "canvas.js"), MJ = read("ext", "timelinedock", "mixer.js");
check("the worker: pans gathered with the mix inputs (V1, layers, sound clips), panned before the ducking / amix, the master after; post includes panned()",
  /pans\.append\(tl\.get\("video_pan"\) or 0\)/.test(W) && /pans\.append\(c\.get\("lpan"\) or 0\)/.test(W) && /pans\.append\(c\.get\("pan"\) or 0\)/.test(W)
  && /mix_in = _mixfx\.pan_inputs\(parts, mix_in, pans, say\)/.test(W) && /aout_lbl = _mixfx\.master_out\(parts, aout_lbl, tl\.get\("master"\), say\)/.test(W) && /or _mixfx\.panned\(tl\)/.test(W));
check("the route: lib/mixer for every fader (to +6 dB), pan, the master; the page sends V1 / layer / sound pans + the master (sound = layer x clip)",
  /video_volume: mixer\.gain\(t\.video_volume, 1\)/.test(RI) && /video_pan: mixer\.pan\(t\.video_pan\)/.test(RI) && /master: mixer\.master\(t\.master\)/.test(RI) && /pan: mixer\.pan\(L\.pan\)/.test(RI) && /pan: mixer\.pan\(c\.pan\)/.test(RI)
  && /video_pan: V1\.pan \|\| undefined/.test(TLD) && /master: X\.master \|\| undefined/.test(TLD) && /volume: \(L\.volume \?\? 1\) \* \(c\.volume \?\? 1\), pan: L\.pan \|\| undefined/.test(TLD));
check("the canvas hands every playing video / sound element to TlMixer.apply (routed only once the mixer is used); 🎚 strips: fader, pan, M, S, meter + the master",
  /TlMixer\.apply\(v, Ly\.lk, Ly\.L, 1\)/.test(CV) && /TlMixer\.apply\(a, Ly\.lk, Ly\.L, c\.volume == null \? 1 : \+c\.volume\)/.test(CV) && /if \(!r && !need\(\)\) return false;/.test(MJ)
  && /createStereoPanner/.test(MJ) && /createAnalyser/.test(MJ) && /mx-mute/.test(MJ) && /mx-solo/.test(MJ) && /MASTER/.test(MJ) && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("mixer.js"));

/* ---- 2. distort */
const FX = require(path.join(ROOT, "static", "clipfx.js"));
const nv = FX.normalize({ vfx: { lens: 140, mirror: "x", warp: { type: "twirl", amount: 300, size: 1 } } }).vfx;
check("normalize: lens clamped to 100, a bad mirror dropped, a twirl's amount / size clamped (100, 5), speed 0", nv.lens === 100 && !nv.mirror && nv.warp.amount === 100 && nv.warp.size === 5 && nv.warp.speed === 0, nv);
check("...a wave keeps its numbers; amount 0 = no warp; lens 0 = none", JSON.stringify(FX.normalize({ vfx: { warp: { type: "wave", amount: 40, size: 25, speed: 1.5 } } }).vfx.warp) === '{"type":"wave","amount":40,"size":25,"speed":1.5}'
  && FX.normalize({ vfx: { warp: { type: "wave", amount: 0 } } }) === null && FX.normalize({ vfx: { lens: 0 } }) === null);
const mh = FX.distortAt({ mirror: "h" }, 80, 10, 100, 50), mq = FX.distortAt({ mirror: "quad" }, 80, 40, 100, 50);
check("distortAt: mirror h samples the left half for the right (80 -> 20); quad folds both ways", mh[0] === 20 && mh[1] === 10 && mq[0] === 20 && mq[1] === 10);
const lc = FX.distortAt({ lens: 50 }, 50, 25, 100, 50), le = FX.distortAt({ lens: 50 }, 100, 50, 100, 50);
check("distortAt: lens leaves the centre, pulls a corner's sample from further out (barrel)", near(lc[0], 50) && near(lc[1], 25) && le[0] > 100 && le[1] > 50, { lc, le });
const vfDist = JSON.parse(py(`import vfx_filters as V
out = {}
for k, v in {"mirror": {"mirror": "h"}, "lens": {"lens": 50}, "wave": {"warp": {"type": "wave", "amount": 50, "size": 25, "speed": 0}}, "twirl": {"warp": {"type": "twirl", "amount": 60, "size": 80}}}.items():
    p = []; n = V.build(p, "[0:v]", "[v]", v, 160, 90); out[k] = {"p": p, "n": n}
out["any"] = [V.any_vfx({"lens": 10}), V.any_vfx({"mirror": "v"}), V.any_vfx({"warp": {"type": "wave", "amount": 5}}), V.any_vfx({})]
print(json.dumps(out))`));
check("vfx_filters: mirror / lens / wave / twirl as geq / lenscorrection, in the log's words; any_vfx sees them",
  /geq=lum='p\(if\(gt\(X,W\/2\),W-1-X,X\),Y\)'/.test(vfDist.mirror.p[0]) && /lenscorrection=cx=0\.5:cy=0\.5:k1=0\.2500:k2=0\.1250/.test(vfDist.lens.p[0]) && /sin\(2\*PI\*Y\/\(0\.25000\*H\)/.test(vfDist.wave.p[0])
  && /hypot\(ld\(0\),ld\(1\)\)/.test(vfDist.twirl.p[0]) && vfDist.mirror.n[0] === "mirrored left to right" && vfDist.lens.n[0] === "barrel 50" && vfDist.any.join() === "true,true,true,false", vfDist);
// rendered by ffmpeg, sampled where distortAt says
ff(["-f", "lavfi", "-i", "color=c=gray:s=160x90:r=25:d=1", "-vf", "format=rgb24,geq=r='X*1.5':g='Y*2.5':b='128+40*sin(X/9)'", "-frames:v", "1", "-c:v", "png", path.join(TMP, "src.png")]);
const SRC = rgb(path.join(TMP, "src.png"));
const px = (buf, x, y, w) => { const i = (Math.round(y) * w + Math.round(x)) * 3; return [buf[i], buf[i + 1], buf[i + 2]]; };
const bil = (buf, x, y, w, h) => {
  x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
  return [0, 1, 2].map((c) => { const a = buf[(y0 * w + x0) * 3 + c], b = buf[(y0 * w + x1) * 3 + c], d = buf[(y1 * w + x0) * 3 + c], e = buf[(y1 * w + x1) * 3 + c];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy; });
};
for (const [name, v] of [["mirror h", { mirror: "h" }], ["lens 50", { lens: 50 }], ["wave", { warp: { type: "wave", amount: 60, size: 30, speed: 0 } }], ["twirl", { warp: { type: "twirl", amount: 70, size: 90, speed: 0 } }]]) {
  const p = JSON.parse(py(`import vfx_filters as V
p=[]; V.build(p, "[0:v]", "[v]", json.loads(${JSON.stringify(JSON.stringify(v))}), 160, 90); print(json.dumps(p))`));
  const out = path.join(TMP, "d.png");
  ff(["-i", path.join(TMP, "src.png"), "-filter_complex", "[0:v]format=gbrp[s];" + p[0].replace(/^\[0:v\]/, "[s]"), "-map", "[v]", "-frames:v", "1", out]);
  const D = rgb(out);
  let worst = 0, n = 0;
  for (let y = 6; y < 84; y += 7) for (let x = 6; x < 154; x += 9) {
    const s = FX.distortAt(v, x, y, 160, 90, 0);
    if (s[0] < 1 || s[1] < 1 || s[0] > 158 || s[1] > 88) continue;              // the lens's edge: filled, not sampled
    const want = bil(SRC, s[0], s[1], 160, 90), got = px(D, x, y, 160);
    worst = Math.max(worst, ...[0, 1, 2].map((c) => Math.abs(want[c] - got[c]))); n++;
  }
  check(`DISTORT ${name}: ffmpeg's render = the source sampled where distortAt says (the canvas's shader maths) - ${n} points within a few levels`, n > 60 && worst <= 12, { worst, n });
}
const VG = read("static", "vfxgl.js"), CF = read("ext", "timelinedock", "clipfx.js");
check("the canvas: one more WebGL pass for lens / mirror / warp (after the grade, as the compile); ✨ Effects has lens, mirror, warp + amount / size / speed",
  /function glDistort\(src, w, h, v, tau\)/.test(VG) && /if \(v\.lens \|\| v\.mirror \|\| v\.warp\) first = glDistort/.test(VG) && /id="tfxLens"/.test(CF) && /id="tfxMirror"/.test(CF) && /id="tfxWarp"/.test(CF) && /id="tfxWarpV"/.test(CF));

/* ---- 3. transitions */
const TC = JSON.parse(read("lib", "transitions.json"));
const known = (spawnSync("ffmpeg", ["-hide_banner", "-h", "filter=xfade"], { encoding: "utf8" }).stdout || "").split("\n").map((l) => (l.trim().split(/\s+/)[0] || "")).filter(Boolean);
const xf = TC.transitions.filter((t) => t.xfade).map((t) => t.xfade);
check("the catalogue: " + TC.transitions.length + " transitions (was 18) in groups - every one an xfade this ffmpeg knows, no duplicates",
  TC.transitions.length >= 58 && xf.every((x) => known.includes(x)) && new Set(TC.transitions.map((t) => t.id)).size === TC.transitions.length && ["Slices", "Shapes", "Slides", "Wipes"].every((g) => TC.transitions.some((t) => t.group === g)), xf.filter((x) => !known.includes(x)));
const bc = JSON.parse(py(`import transitions as T
p=[]; d=T.boundary_chain(p, "[1:v]", "[sh1]", {"type": "wipeleft", "dur": 0.5}, {"type": "circleclose", "dur": 0.5}, 2.0, "b1")
q=[]; e=T.boundary_chain(q, "[2:v]", "[sh2]", {"type": "fade", "dur": 0.5}, None, 2.0, "b2")
print(json.dumps({"d": d, "p": p, "e": e, "q": q, "s": [T.shape_of({"type": "fadeblack"}), T.shape_of({"type": "slideup"}), T.shape_of(None)]}))`));
check("boundary_chain: a wipe in + an iris out = xfade against a see-through copy of the clip (offset 0 / at its end); a dissolve stays the alpha fade",
  bc.d.join() === "true,true" && bc.p.some((x) => /xfade=transition=wipeleft:duration=0\.5000:offset=0\[b1i\]/.test(x)) && bc.p.some((x) => /trim=start=1\.5000.*colorchannelmixer=aa=0/.test(x))
  && bc.p.some((x) => /xfade=transition=circleclose:duration=0\.5000:offset=1\.5000/.test(x)) && bc.e.join() === "false,false" && !bc.q.length && bc.s[0] === null && bc.s[1] === "slideup" && bc.s[2] === null, bc);
{
  ff(["-f", "lavfi", "-i", "color=c=white:s=160x90:r=25:d=2", "-filter_complex", bc.p.join(";").replace(/\[1:v\]/, "[0:v]") + ";[sh1]format=rgba[o]", "-map", "[o]", "-c:v", "png", "-f", "matroska", path.join(TMP, "b.mkv")]);
  const a = (t) => { const b = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", path.join(TMP, "b.mkv"), "-frames:v", "1", "-vf", "format=rgba", "-f", "rawvideo", "-"], { maxBuffer: 1 << 22 }); return (x, y) => b[(y * 160 + x) * 4 + 3]; };
  const m = a(0.25), mid = a(1.0), end = a(1.75);   // xfade's iris is not linear: 1.75 s = 50 % through it
  check("...rendered: a quarter way into the wipe the right side is there, the left still see-through; the middle whole; near the end only the centre (the iris closing)",
    m(150, 45) > 200 && m(10, 45) < 30 && mid(10, 45) > 200 && end(80, 45) > 200 && end(3, 3) < 30, { q: [m(150, 45), m(10, 45)], mid: mid(10, 45), end: [end(80, 45), end(3, 3)] });
}
const WK = read("misc/worker.py");
check("the worker: video and picture layers' boundaries through _shape (their alpha fade only for what is not a shape)",
  // 2.519.0: 2.498.0 / 2.505.0 route the video layer's input through src_v (its own picture, or the masked /
  // displaced one) before the same _shape call
  /src_v = f"\[\{i\}:v\]"/.test(WK) && /sin, sout = _shape\(parts, src_v, f"\[shp\{i\}\]"/.test(WK) && /"" if sin else _fade\(c\.get\("fade_in"\)/.test(WK) && /iin, iout = _shape\(parts, f"\[\{i\}:v\]", f"\[ishp\{i\}\]"/.test(WK));
const TP = require(path.join(ROOT, "static", "trprev.js"));
const L1 = { transitionIn: { type: "wipeleft", dur: 1 }, transitionOut: { type: "slideright", dur: 1 } };
check("trprev.at: the first clip's first second = entering (p), the last clip's last second = leaving; a middle clip never; short clips share",
  JSON.stringify(TP.at(L1, { start: 2 }, 2.5, 4, true, false)) === '{"type":"wipeleft","p":0.5,"dir":"in"}' && TP.at(L1, { start: 2 }, 5.5, 4, false, true).dir === "out"
  && TP.at(L1, { start: 2 }, 2.5, 4, false, false) === null && near(TP.at(L1, { start: 0 }, 0.3, 1, true, true).p, 0.6));
const rec = () => { const calls = []; return { calls, g: { globalAlpha: 1, beginPath() { calls.push("bp"); }, rect(...a) { calls.push("rect " + a.map((v) => Math.round(v)).join(",")); }, arc(...a) { calls.push("arc " + Math.round(a[2])); }, moveTo() {}, clip(r) { calls.push("clip " + (r || "")); }, translate(x, y) { calls.push("tr " + Math.round(x) + "," + Math.round(y)); } } }; };
const r1 = rec(); TP.apply(r1.g, { type: "wipeleft", p: 0.25, dir: "in" }, 100, 50);
const r2 = rec(); TP.apply(r2.g, { type: "wipeleft", p: 0.25, dir: "out" }, 100, 50);
const r3 = rec(); TP.apply(r3.g, { type: "slideright", p: 0.5, dir: "out" }, 100, 50);
const r4 = rec(); TP.apply(r4.g, { type: "fade", p: 0.25, dir: "in" }, 100, 50);
check("trprev.apply: a wipe in clips to the strip from the right (x 25..50 of a centred 100); out = the rest (even-odd); a slide out pushes the other way; a dissolve = alpha",
  r1.calls.join("|") === "bp|rect 25,-25,25,50|clip " && r2.calls.join("|") === "bp|rect -50,-25,100,50|rect 25,-25,25,50|clip evenodd" && r3.calls.join("|") === "tr 50,0" && near(r4.g.globalAlpha, 0.25), [r1.calls, r2.calls, r3.calls, r4.g.globalAlpha]);
check("the canvas finds each layer's first / last clip and draws its boundary through H3TrPrev; index.html loads static/trprev.js",
  /H3TrPrev\.at\(Ly\.L, c, t, clipEnd\(c, Ly\.kind\) - \(c\.start \|\| 0\), c === fst, c === lst\)/.test(CV) && /<script src="\/static\/trprev\.js"><\/script>/.test(read("static", "index.html")));

/* ---- 4. colour match */
const CM = require(path.join(ROOT, "lib", "colourMatch.js"));
const cv = CM.curve([0.1, 0.2, 0.2, 0.5, 0.9], [0.3, 0.2, 0.4, 0.6, 0.95], 1);
check("curve: monotone (a dip flattened), a flat stretch of the source one point, the ends extrapolated to 0 and 1",
  cv[0][0] === 0 && cv[cv.length - 1][0] === 1 && cv.every((p, i) => !i || (p[0] > cv[i - 1][0] && p[1] >= cv[i - 1][1])), cv);
check("...strength 50 % = half way to a straight line", JSON.stringify(CM.curve([0.5], [0.7], 0.5).find((p) => p[0] === 0.5)) === "[0.5,0.6]");
ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=1", "-vf", "format=rgb24,geq=r='30+X/2':g='40+Y':b='120+X/4'", "-c:v", "libx264", "-pix_fmt", "yuv444p", "-crf", "8", path.join(TMP, "cool.mp4")]);
ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=1", "-vf", "format=rgb24,geq=r='90+X/3':g='30+Y/2':b='20+X/5'", "-c:v", "libx264", "-pix_fmt", "yuv444p", "-crf", "8", path.join(TMP, "warm.mp4")]);
const m1 = CM.match({ file: path.join(TMP, "warm.mp4"), at: 0.5 }, { file: path.join(TMP, "cool.mp4"), at: 0.5 }, { strength: 100 });
const dist = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
check("match: the warm clip's R / G / B curves land its mean colour on the cool one's (within 4 levels; it started " + Math.round(dist(m1.before, m1.target)) + " away)",
  dist(m1.after, m1.target) <= 4 && dist(m1.before, m1.target) > 40 && ["r", "g", "b"].every((k) => m1.curves[k] && m1.curves[k].length >= 3), m1);
const m2 = CM.match({ file: path.join(TMP, "warm.mp4"), at: 0.5, fx: { grade: { exposure: 0.4 } } }, { file: path.join(TMP, "cool.mp4"), at: 0.5, fx: { grade: { temperature: -50 } } }, { strength: 100 });
check("...a graded reference is matched as the movie shows it (its grade), a graded source through its own exposure first", dist(m2.after, m2.target) <= 5 && m2.target[2] > m1.target[2], { m2: [m2.after, m2.target], t1: m1.target });
let ce = null; try { CM.match({ file: path.join(TMP, "nope.mp4"), at: 0 }, { file: path.join(TMP, "cool.mp4"), at: 0 }, {}); } catch (e) { ce = e; }
check("...a file it cannot read: refused in words (422)", ce && ce.status === 422 && /could not read a frame/.test(ce.message));
const CP = read("ext", "timelinedock", "colourpanel.js"), RC = read("routes", "clipfx.js");
check("🎨 Colour: 🎯 Match (another clip, strength) -> POST /api/clipfx/colourmatch (routes/clipfx.js) -> the R / G / B curves",
  /id="tcpMatchGo"/.test(CP) && /\/api\/clipfx\/colourmatch/.test(CP) && /G\.curves = cu/.test(CP) && /app\.post\("\/api\/clipfx\/colourmatch"/.test(RC) && /colourMatch\.match\(/.test(RC));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
