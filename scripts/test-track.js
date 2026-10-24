#!/usr/bin/env node
/* bitGen Studio — 2.499.0 units: TRACKING + CORNER PIN (scripts/track_points.py, lib/trackPoints.js, routes/trackpts.js,
 * ext/timelinedock/tltrack.js, lib/tlKeys.js pinKeys, worker.py's corner-pin branch).
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const T = require(path.join(ROOT, "ext", "timelinedock", "tltrack.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-9 : e);

/* ---- the maths */
const q = [[100, 50], [300, 80], [280, 260], [90, 240]], H = T.squareToQuad(q);
check("squareToQuad + mapH: the unit square's corners land on the quad's (a real perspective)", [[0, 0], [1, 0], [1, 1], [0, 1]].every((p, i) => { const m = T.mapH(H, p[0], p[1]); return near(m[0], q[i][0], 1e-6) && near(m[1], q[i][1], 1e-6); }) && H[6] !== 0);
const Ha = T.squareToQuad([[0, 0], [10, 0], [10, 5], [0, 5]]);
check("…a rectangle is just a scale (no perspective)", Ha[6] === 0 && Ha[7] === 0 && near(T.mapH(Ha, 0.5, 0.5)[0], 5) && near(T.mapH(Ha, 0.5, 0.5)[1], 2.5));
const A = T.affine3([[0, 0], [10, 0], [0, 10]], [[5, 5], [25, 5], [5, 15]]);
check("affine3: three points to three others (setTransform order)", near(A[0], 2) && near(A[1], 0) && near(A[2], 0) && near(A[3], 1) && near(A[4], 5) && near(A[5], 5) && T.affine3([[0, 0], [1, 1], [2, 2]], [[0, 0], [1, 1], [2, 2]]) === null);
const pin = { keys: [{ at: 0, q: [[0, 0], [100, 0], [100, 100], [0, 100]] }, { at: 2, q: [[50, 0], [150, 0], [150, 100], [50, 100]] }] };
check("quadAt: straight between the keys, held before / after; one key = it holds", near(T.quadAt(pin, 1)[0][0], 25) && near(T.quadAt(pin, 5)[0][0], 50) && near(T.quadAt(pin, -1)[0][0], 0) && near(T.quadAt({ keys: [pin.keys[1]] }, 7)[1][0], 150) && T.quadAt({}, 0) === null);
const pc = T.padCorners([[0, 0], [636, 0], [636, 356], [0, 356]], 640, 360, 2);
check("padCorners: the frame's corners when its inside (2 px in) is pinned to the quad - ffmpeg's order TL, TR, BL, BR", near(pc[0][0], -2 * 636 / 636, 1e-6) && near(pc[1][0], 638, 1e-6) && near(pc[2][1], 358, 1e-6) && near(pc[3][0], 638, 1e-6) && near(pc[3][1], 358, 1e-6), pc);
const pk = T.pinKeys(pin, 640, 360, 2, 24, 2);
check("pinKeys: every frame, thinned - a straight slide = 2 keys (p0x … p3y)", pk.length === 2 && pk[0].at === 0 && pk[1].at === 2 && ["p0x", "p0y", "p1x", "p1y", "p2x", "p2y", "p3x", "p3y"].every((k) => typeof pk[0][k] === "number"), pk);
const wob = { keys: Array.from({ length: 49 }, (_, i) => ({ at: i / 24, q: [[Math.sin(i / 3) * 30, 0], [100, 0], [100, 100], [0, 100]] })) };
check("pinKeys: a wobble keeps the frames where it bends", T.pinKeys(wob, 640, 360, 2, 24, 2).length > 10);
check("the modes + their first points (1, 2, 4, 4)", T.MODES.map((m) => m[0]).join() === "point,scalerot,pin,planar" && T.DEF_PTS.point.length === 1 && T.DEF_PTS.scalerot.length === 2 && T.DEF_PTS.pin.length === 4);

/* ---- the server side */
const TP = require(path.join(ROOT, "lib", "trackPoints.js"));
const bad = (o) => { try { TP.clean(o); return false; } catch (e) { return true; } };
check("trackPoints.clean: a name, a span, points (0..1, at most 8), a plane = 4 corners; box / width kept sane", bad({}) && bad({ name: "a.mp4", from: 2, to: 2 }) && bad({ name: "a.mp4", from: 0, to: 2 }) && bad({ name: "a.mp4", from: 0, to: 2, mode: "planar", pts: [[0, 0]] })
  && (() => { const c = TP.clean({ name: "../x/a.mp4", from: 0, to: 2, pts: [[2, -1]], box: 9, width: 99999 }); return c.name === "a.mp4" && c.pts[0][0] === 1 && c.pts[0][1] === 0 && c.box === 0.3 && c.width === 1920 && c.mode === "points"; })());
const TK = require(path.join(ROOT, "lib", "tlKeys.js"));
const pkk = TK.pinKeys({ pin: [{ at: 1, p0x: 1, p0y: 2, p1x: 3, p1y: 4, p2x: 5, p2y: 6, p3x: 7, p3y: 8 }, { at: 0, p0x: "x" }, { at: 0.5, p0x: 1, p0y: 1, p1x: 1, p1y: 1, p2x: 1, p2y: 1, p3x: 1, p3y: 1e9 }] });
check("tlKeys.pinKeys: whole keys only (a bad number drops the key), sorted, clamped", pkk.pin.length === 2 && pkk.pin[0].at === 0.5 && pkk.pin[0].p3y === 100000 && JSON.stringify(TK.pinKeys({})) === "{}");

/* ---- the tracker itself (a picture sliding 60 px / s right, 30 px / s down) */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trk499-"));
try {
  const pat = path.join(tmp, "p.png"), mv = path.join(tmp, "m.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "mandelbrot=s=160x120", "-frames:v", "1", "-y", pat]);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=0x404040:s=640x360:r=25:d=2", "-i", pat, "-filter_complex", "[0][1]overlay=x='100+t*60':y='80+t*30'", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", mv]);
  const runPy = (mode, pts) => JSON.parse(execFileSync("python3", [path.join(ROOT, "scripts", "track_points.py"), mv, "0", "2", mode, JSON.stringify(pts), "0.05", "640"], { encoding: "utf8", maxBuffer: 1 << 24 }));
  const r1 = runPy("points", [[180 / 640, 140 / 360]]), f25 = r1.track[25];
  check("track_points.py points: every frame (25 fps), the point follows the picture to a fraction of a pixel (1 s: 240, 170)", r1.frames >= 49 && near(r1.fps, 25, 0.01) && near(f25.pts[0][0] * 640, 240, 0.6) && near(f25.pts[0][1] * 360, 170, 0.6) && r1.lost.length === 0, { f25, m: r1.method });
  const r2 = runPy("planar", [[100 / 640, 80 / 360], [260 / 640, 80 / 360], [260 / 640, 200 / 360], [100 / 640, 200 / 360]]), g25 = r2.track[25];
  check("track_points.py planar: the surface's 4 corners carried (OpenCV) - or tracked as points without it", g25.pts.length === 4 && near(g25.pts[0][0] * 640, 160, 1.2) && near(g25.pts[2][1] * 360, 230, 1.2), { g25, m: r2.method });
} catch (e) { check("the tracker runs", false, String(e.message).slice(0, 400)); }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }

/* ---- wiring */
const TT = read("ext", "timelinedock", "tltrack.js"), CV = read("ext", "timelinedock", "canvas.js"), TD = read("ext", "timelinedock", "timelinedock.js"), PA = read("ext", "timelinedock", "tlparent.js"), RT = read("routes", "index.js"), W = read("misc/worker.py");
check("routes: /api/track/points (routes/trackpts.js, mounted from routes/index.js); the video layer's corner pin passed (tlKeys.pinKeys)", /require\("\.\/trackpts"\)\.mount\(app\);/.test(RT) && /app\.post\("\/api\/track\/points"/.test(read("routes", "trackpts.js")) && /\.\.\.tlKeys\.pinKeys\(c\),/.test(RT));
check("tltrack: 🎯 Track (mode, ◎ Place, size, ▶ Track, Apply to), the points tool, ▢ Corner pin (on, ✥ Edit corners), apply = position keys / scale + rotation / a pin", /id="tlpTkMode"/.test(TT) && /id="tlpTkPlace"/.test(TT) && /id="tlpTkRun"/.test(TT) && /id="tlpTkApply"/.test(TT) && /id="tlpPinOn"/.test(TT) && /id: "trackpts"/.test(TT) && /id: "pinedit"/.test(TT) && /target\.pin = \{ on: true, keys: keys \}/.test(TT) && /W\.rot = base\.rot \+ turn/.test(TT));
check("canvas: a pinned layer drawn through TlTrack.drawPin (both paths), never on the GPU path; srcAt / opac exported", (CV.match(/TlTrack\.drawPin\(/g) || []).length === 2 && /return \(c\.masks && c\.masks\.length\) \|\| c\.pin(?: \|\| c\.\w+)*;/.test(CV) && /srcAt: srcAt/.test(CV) && /opac: opac/.test(CV));
check("the compile: a pinned picture baked; a pinned video's corners sent (workerPin) and warped by worker.py (scale - pad 2 px - perspective, the corners keyed, laid on at 0, 0)", /\(c\.pin && c\.pin\.on !== false\)(?: \|\| \([^()]*(?:\([^()]*\))?\))*\) && c\.bake/.test(TD) && /pin: window\.TlTrack && TlTrack\.workerPin \? TlTrack\.workerPin\(c\) : undefined/.test(TD) && /pin: p\.pin \|\| null/.test(PA)
  && /pad=\{int\(fw\)\}:\{int\(fh\)\}:2:2:color=black@0,perspective=\{corners\}:sense=destination:eval=frame/.test(W) && /"x": "0", "y": "0"/.test(W));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tltrack.js after tlmask.js", EXT.indexOf("tltrack.js") === EXT.indexOf("tlmask.js") + 1);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
