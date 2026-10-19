#!/usr/bin/env node
/* bitGen Studio — 2.515.0 units: STEP 8 of the After Effects gap list - 🧍 the AI cut-out through a shot (+ refine
 * edge), 📷 the 3D camera tracker, 🩹 content-aware fill for video - and the theme edit mode's Ctrl+Shift+Alt+E / Ctrl+S.
 * Tim (verbatim): "when user presses ctrl+shift+alt+e go into edit mode,ctrl+s saves the theme and exits edit mode -
 * this is so users can edit dialogs like the settings dialog. and do number 8 of the after effects list".
 * The Python parts run on made-up shots (a red disc moving over a panning background; two textured planes filmed by
 * a moving camera with a known lens) and are checked against what is known - SKIP without OpenCV. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const near = (a, b, e) => Math.abs(a - b) <= e;

/* ---- pure: the page modules */
const CU = require("../ext/timelinedock/tlcutout.js"), CT = require("../ext/timelinedock/tlcamtrack.js"), VF = require("../ext/timelinedock/tlvfill.js"), SC = require("../ext/timelinedock/tlscene.js"), T3 = require("../ext/timelinedock/tl3d.js");
let P = CU.addMark([], 1.0, 0.3, 0.4, true, 24); P = CU.addMark(P, 1.01, 0.6, 0.4, false, 24); P = CU.addMark(P, 2.0, 0.5, 0.5, true, 24);
const rm = CU.removeNear(P, 1.0, 0.601, 0.401, 0.01, 24);
check("🧍 marks: a mark within half a frame joins that frame's; ✕ near one takes it away; a frame with none left goes",
  P.length === 2 && P[0].pts.length === 2 && P[0].pts[1][2] === 0 && rm.hit && rm.prompts[0].pts.length === 1 && CU.removeNear(CU.addMark([], 3, 0.5, 0.5, true, 24), 3, 0.5, 0.5, 0.01, 24).prompts.length === 0, { P, rm });
const B = CU.setBox([], 1, [0.8, 0.9, 0.2, 0.1], 24);
check("🧍 ▭ a box is kept corner-ordered; no box and no clicks = no marks", JSON.stringify(B[0].box) === "[0.2,0.1,0.8,0.9]" && CU.setBox(B, 1, null, 24).length === 0, B);
const clip = { name: "a.mp4", in: 2, out: 6, cut: { file: "cut_a_x.webm", from: 1.5, to: 6.04, use: true } };
check("🧍 the cut-out covers the clip (in 2 .. out 6 inside 1.5 .. 6.04) -> its file starts 1.5 s into the source; past it / not used = 0",
  CU.covers(clip.cut, clip) && CU.off(clip) === 1.5 && !CU.covers(clip.cut, { in: 1, out: 6 }) && CU.off({ in: 2, out: 6, cut: Object.assign({}, clip.cut, { use: false }) }) === 0);
check("🧍 refine edge cleaned (feather 0..100, choke -50..50 whole, smooth 0..100, snap on by default)", JSON.stringify(CU.clean({ refine: { feather: 500, choke: -7.6, smooth: -3 } })) === JSON.stringify({ feather: 100, choke: -8, smooth: 0, edge: true }));
check("TlScene.range: the clip's source in .. out (no out = its length)", JSON.stringify(SC.range({ in: 1, out: 4 })) === "[1,4]" && JSON.stringify(SC.range({ in: 0, dur: 7 })) === "[0,7]");

// 📷 the solve's camera -> the 🧊 camera: projecting a point the tl3d way = the pinhole the solve used
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mm = (A, Bm) => { const o = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(A[i * 3] * Bm[j] + A[i * 3 + 1] * Bm[3 + j] + A[i * 3 + 2] * Bm[6 + j]); return o; };
const R = mm(rotZ(0.12), rotY(0.3)), Cc = [0.2, -0.1, 0.15], D = 900, W = 1280, H = 720, X = [0.1, 0.05, 1.3];
const fr = { R, C: Cc }, cam = CT.camOf(fr, D);
const v = [X[0] - Cc[0], X[1] - Cc[1], X[2] - Cc[2]], xc = [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
const want = [W / 2 + D * xc[0] / xc[2], H / 2 + D * xc[1] / xc[2]];
const got = T3.project(T3.camClean(cam), W, H, CT.toWorld(X, D));
check("📷 a solved frame -> the 🧊 3D camera (position, aim, zoom, ROLL): a scene point lands where the solve's pinhole puts it", near(got[0], want[0], 0.01) && near(got[1], want[1], 0.01) && near(cam.roll, -0.12 * 180 / Math.PI, 0.01), { got, want, roll: cam.roll });
check("📷 the first frame (R = I, C = 0) is tl3d's straight-ahead view: the camera at (0, 0, -zoom), no roll", (() => { const c0 = CT.camOf({ R: [1, 0, 0, 0, 1, 0, 0, 0, 1], C: [0, 0, 0] }, 1000); return c0.x === 0 && c0.y === 0 && c0.z === -1000 && c0.tz === 0 && Math.abs(c0.roll) < 1e-9; })());
check("🧊 tl3d basis turns by roll (0 = as before)", (() => { const b0 = T3.basis(T3.camClean({})), b1 = T3.basis(T3.camClean({ roll: 90 })); return near(b0.r[0], 1, 1e-9) && near(b1.r[1], 1, 1e-9) && near(b1.d[0], -1, 1e-9); })());
const pl = CT.fitPlane([[0, 100, 0], [100, 100, 50], [-80, 100, 300], [40, 100, 200]], [0, 0, -1000]);
check("📷 the plane through picked points: its normal (toward the camera)", near(Math.abs(pl.n[1]), 1, 1e-6) && pl.n[1] < 0, pl);
const ang = CT.eulerOf([Math.cos(0.4), Math.sin(0.4), 0], [-Math.sin(0.4), Math.cos(0.4), 0], [0, 0, 1]);
const Rt = T3.rot(30, -20, 15), eu = CT.eulerOf([Rt[0], Rt[3], Rt[6]], [Rt[1], Rt[4], Rt[7]], [Rt[2], Rt[5], Rt[8]]);
check("📷 a card's rotation -> tl3d's turns (Rx . Ry . Rz) and back", near(ang.rz, 0.4 * 180 / Math.PI, 1e-6) && near(eu.rx, 30, 1e-6) && near(eu.ry, -20, 1e-6) && near(eu.rz, 15, 1e-6), eu);
const flat = CT.place("flat", [[0, 100, 0], [100, 100, 50], [-80, 100, 300]], [0, 0, -1000], 200, 100), st = CT.place("stand", [[0, 100, 0], [100, 100, 50], [-80, 100, 300]], [0, 0, -1000], 200, 100);
const nF = (() => { const r = T3.rot(flat.rx, flat.ry, flat.rz); return [r[2], r[5], r[8]]; })(), dS = (() => { const r = T3.rot(st.rx, st.ry, st.rz); return [r[1], r[4], r[7]]; })();
check("📌 flat on a floor: the card's face is the floor (its normal down into it); standing: upright (its down = the floor's down), lifted half its height",
  near(nF[1], 1, 1e-6) && near(dS[1], 1, 1e-6) && near(st.y, 100 - 50, 1e-6), { flat, st, nF, dS });
check("📷 the solve's frame for a source second (nearest, clamped)", CT.frameAt({ from: 1, fps: 10, frames: [{ k: 0 }, { k: 1 }, { k: 2 }] }, 1.14).k === 1 && CT.frameAt({ from: 1, fps: 10, frames: [{ k: 0 }, { k: 1 }] }, 9).k === 1);
check("🩹 the hole: the cut-out's file (alpha, from its first source second) or the masks' grey video (from the clip's in); none = why",
  JSON.stringify(VF.holeOf({ cut: { file: "cut_x.webm", from: 2 } }, VF.clean({}))) === JSON.stringify({ hole: { name: "cut_x.webm", kind: "alpha", t0: 2 }, why: "" })
  && VF.holeOf({ mbake: "tlb_u1m.webm", in: 3 }, VF.clean({ what: "mask" })).hole.kind === "grey" && VF.holeOf({ in: 3 }, VF.clean({ what: "mask" })).hole === null && /cut out/.test(VF.holeOf({}, VF.clean({})).why));

/* ---- the app side */
const ST = require("../lib/sceneTools"), TK = require("../lib/tlKeys");
const cp = ST.cleanPrompts([{ t: 1, pts: [[2, -1, 0], [0.5, 0.5]], box: [0, 0, 2, 1] }, { t: 2 }, "x"]);
check("lib/sceneTools cleanPrompts: clicks kept to 0..1 (1 = the subject unless 0), a box, an empty prompt dropped", cp.length === 1 && JSON.stringify(cp[0].pts) === "[[1,0,0],[0.5,0.5,1]]" && JSON.stringify(cp[0].box) === "[0,0,1,1]", cp);
check("lib/tlKeys cutKeys: nothing without a cut-out / when not used / not one of ours", JSON.stringify(TK.cutKeys({})) === "{}" && JSON.stringify(TK.cutKeys({ cut: { file: "cut_a.webm", use: false } })) === "{}" && JSON.stringify(TK.cutKeys({ cut: { file: "../x.webm", from: 0, to: 5 } })) === "{}");
const IDX = read("routes", "index.js"), SRV = (() => { try { return read("server.js"); } catch { return ""; } })();
check("routes/scene.js mounted from routes/index.js; the compile's video layers take cutKeys; server.js untouched", /require\("\.\/scene"\)\.mount\(app\)/.test(IDX) && /\.\.\.tlKeys\.cutKeys\(c\)/.test(IDX) && !/sceneTools|routes\/scene/.test(SRV));
check("the page sends a used cut-out to the compile (timelinedock.js exportBody: cut {file, from, to})", /cut: c\.cut && c\.cut\.use === true && c\.cut\.file \? \{ file: c\.cut\.file, from: c\.cut\.from, to: c\.cut\.to, use: true \}/.test(read("ext", "timelinedock", "timelinedock.js")));
const RT = read("routes", "scene.js");
check("routes: status, sam2 install, cutout, camtrack, fill, cam solve, job, cancel", ["/api/scene/status", "/api/scene/sam2/install", "/api/scene/cutout", "/api/scene/camtrack", "/api/scene/fill", "/api/scene/cam/:name", "/api/scene/job/:id", "/api/scene/job/:id/cancel"].every((u) => RT.includes('"' + u + '"')));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")), files = JSON.stringify(EXT);
check("the timeline extension loads tlscene / tlcutout / tlcamtrack / tlvfill", ["tlscene.js", "tlcutout.js", "tlcamtrack.js", "tlvfill.js", "tlanykey.js"].every((f) => files.includes('"' + f + '"')));
const CV = read("ext", "timelinedock", "canvas.js");
check("canvas.js: a cut-out layer plays its file (vidUrl -> TlCutout.url), seeked where it starts (vidAt); tlvbake seeks the same", /TlCutout\.url\(c\)/.test(CV) && /function vidAt\(c, t\) \{ return srcAt\(c, t\) - vidOff\(c\); \}/.test(CV) && (CV.match(/var want = vidAt\(/g) || []).length === 3 && /C\.vidAt \|\| C\.srcAt/.test(read("ext", "timelinedock", "tlvbake.js")));
const SAM = read("lib", "sceneTools.js");
check("SAM 2: into the AI matte's venv (torch + sam2 + sam2.1_hiera_small.pt in models/sam2), its config", /sam2\.1_hiera_small\.pt/.test(SAM) && /configs\/sam2\.1\/sam2\.1_hiera_s\.yaml/.test(SAM) && /"pip", "install", "sam2"/.test(SAM) && /build_sam2_video_predictor/.test(read("scripts", "roto.py")) && /propagate_in_video/.test(read("scripts", "roto.py")));

/* ---- theme edit mode: Ctrl+Shift+Alt+E (with the dialogs), Ctrl+S */
const TE = read("static", "themeedit.js");
check("theme edit: Ctrl+Shift+Alt+E = edit mode with the dialogs (listened for from <head>); Ctrl+S saves the theme and leaves (before the app's own Ctrl+S)",
  /e\.ctrlKey && e\.shiftKey && e\.altKey/.test(TE) && /KeyE/.test(TE) && /toggle\(!on, \{ dialogs: true \}\)/.test(TE) && /root\.addEventListener\("keydown", hotkey, true\)/.test(TE) && /saveAndLeave\(\)/.test(TE) && /e\.code === "KeyS"/.test(TE));
check("theme edit with the dialogs: dialogs are picked (not left alone), Settings stays open, the panel's file dialog still works, Esc never closes the dialog, boxes go inside the open modal",
  /dlgs \? \(panel && el\.closest\("\.fdlg"\)\) : el\.closest\(DIALOG_SEL\)/.test(TE) && /if \(on && !dlgs\) \{ const s = doc\.getElementById\("settings"\)/.test(TE) && /e\.preventDefault\(\); e\.stopPropagation\(\); closePanel\(\); return;/.test(TE) && /\(topModal\(\) \|\| doc\.body\)\.appendChild\(b\)/.test(TE));

/* ---- the Python parts on made-up shots */
const py = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const hasCv = spawnSync(py, ["-c", "import cv2, numpy, scipy"], { encoding: "utf8" }).status === 0;
if (!hasCv) console.log("SKIP: OpenCV / scipy are not in " + py + " - the cut-out / camera / fill runs did not run");
else {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg515-")), S = path.join(ROOT, "scripts");
  const runPy = (code, ...args) => spawnSync(py, ["-c", code, ...args], { encoding: "utf8", env: { ...process.env, PYTHONPATH: S }, maxBuffer: 64 * 1024 * 1024 });
  const job = (script, o) => { const f = path.join(T, script + ".json"); fs.writeFileSync(f, JSON.stringify(o)); const r = spawnSync(py, [path.join(S, script + ".py"), f], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); const ls = (r.stdout || "").split("\n").filter((l) => l.startsWith("{")); let last = null; try { last = JSON.parse(ls[ls.length - 1]); } catch { last = null; } return { code: r.status, err: (r.stderr || "").slice(-400), last }; };
  const GEN = `
import sys, numpy as np, cv2, scene_io as sio
W, H, N = 640, 360, 48
rng = np.random.default_rng(1)
bg = cv2.GaussianBlur((rng.random((H, W, 3)) * 60 + 40).astype(np.uint8), (0, 0), 1.2)
wr = sio.Writer(sys.argv[1], W, H, 24, "h264", crf=14)
for i in range(N):
    f = np.roll(bg, i * 2, axis=1).copy()
    cv2.circle(f, (160 + i * 4, 180), 50, (230, 60, 50), -1)
    cv2.rectangle(f, (480 - i * 2, 60), (560 - i * 2, 140), (60, 200, 230), -1)
    wr.write(f)
wr.close()`;
  const clipF = path.join(T, "clip.mp4"); runPy(GEN, clipF);
  const cut = job("roto", { input: clipF, output: path.join(T, "cut.webm"), from: 0, to: 2, method: "flow", work: 640, prompts: [{ t: 0.5, pts: [[0.344, 0.5, 1], [0.8, 0.28, 0]], box: null }], refine: { feather: 1, choke: 0, smooth: 30, edge: true } });
  const IOU = `
import sys, numpy as np, cv2, scene_io as sio
v = []
for i, f in sio.frames(sys.argv[1], 0, 2, 640, 360, "rgba", alpha_codec="libvpx-vp9"):
    g = np.zeros((360, 640), np.uint8); cv2.circle(g, (160 + i * 4, 180), 50, 1, -1)
    m = f[..., 3] > 127; v.append((m & (g > 0)).sum() / max(1, (m | (g > 0)).sum()))
print(len(v), min(v), sum(v) / len(v))`;
  const io = cut.code === 0 ? runPy(IOU, path.join(T, "cut.webm")).stdout.trim().split(" ").map(Number) : [0, 0, 0];
  check("🧍 roto.py (built in: GrabCut + the motion) follows the clicked disc through 48 frames and leaves the square it was told is not it (IoU > 0.9 every frame)",
    cut.code === 0 && cut.last && cut.last.ok && cut.last.frames === 48 && io[0] === 48 && io[1] > 0.9, { cut, io });
  const fl = job("vfill", { input: clipF, output: path.join(T, "filled.mp4"), from: 0, to: 2, hole: { file: path.join(T, "cut.webm"), kind: "alpha", t0: 0 }, grow: 4, feather: 3, reach: 2 });
  const ERR = `
import sys, numpy as np, cv2, scene_io as sio
rng = np.random.default_rng(1)
bg = cv2.GaussianBlur((rng.random((360, 640, 3)) * 60 + 40).astype(np.uint8), (0, 0), 1.2)
e = []
for i, f in sio.frames(sys.argv[1], 0, 2, 640, 360, "rgb24"):
    g = np.roll(bg, i * 2, axis=1).copy(); cv2.rectangle(g, (480 - i * 2, 60), (560 - i * 2, 140), (60, 200, 230), -1)
    m = np.zeros((360, 640), np.uint8); cv2.circle(m, (160 + i * 4, 180), 50, 1, -1)
    e.append(np.abs(f.astype(int) - g.astype(int)).mean(-1)[m > 0].mean())
print(len(e), max(e))`;
  const fe = fl.code === 0 ? runPy(ERR, path.join(T, "filled.mp4")).stdout.trim().split(" ").map(Number) : [0, 99];
  check("🩹 vfill.py takes the disc out: the background behind it comes back from the other frames (> 60% of the hole), every frame within 8 grey levels of the clean plate",
    fl.code === 0 && fl.last && fl.last.ok && fl.last.from_frames > 0.6 && fe[0] === 48 && fe[1] < 8, { fl, fe });
  const CAM = `
import sys, math, json, numpy as np, cv2, scene_io as sio
W, H, N = 960, 540, 60
f = (W / 2) / math.tan(math.radians(55) / 2); K = np.array([[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]])
rng = np.random.default_rng(3)
def tex(n=1024):
    t = cv2.GaussianBlur((rng.random((n, n, 3)) * 255).astype(np.uint8), (0, 0), 2)
    for _ in range(500):
        c = tuple(int(x) for x in rng.integers(0, 255, 3)); p = tuple(int(x) for x in rng.integers(0, n, 2)); r = int(rng.integers(4, 30))
        cv2.circle(t, p, r, c, -1) if rng.random() < .5 else cv2.rectangle(t, p, (p[0] + r, p[1] + r), c, -1)
    return t
planes = [(np.array([-6, 1.0, 1.0]), np.array([12 / 1024, 0, 0]), np.array([0, 0, 13 / 1024]), tex()), (np.array([-6, -5.0, 14.0]), np.array([12 / 1024, 0, 0]), np.array([0, 6 / 1024, 0]), tex())]
def rotY(a): c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
gt = []
wr = sio.Writer(sys.argv[1], W, H, 24, "h264", crf=12)
for i in range(N):
    u = i / (N - 1); C = np.array([-1.0 + 2.0 * u, -0.3 * u, 0.6 * u]); R = rotY(math.radians(-6 + 10 * u)); t = -R @ C
    img = np.zeros((H, W, 3), np.uint8)
    for O, U, V, T in planes:
        cv2.warpPerspective(T, K @ np.column_stack([R @ U, R @ V, R @ O + t]), (W, H), dst=img, borderMode=cv2.BORDER_TRANSPARENT)
    wr.write(img[..., ::-1].copy()); gt.append({"C": C.tolist(), "R": R.ravel().tolist()})
wr.close(); json.dump(gt, open(sys.argv[2], "w"))`;
  const camF = path.join(T, "cam.mp4"), gtF = path.join(T, "gt.json"); runPy(CAM, camF, gtF);
  const ct = job("camtrack", { input: camF, from: 0, to: 2.5, fov: 0, mode: "auto" });
  let pathErr = 9, rotErr = 99;
  if (ct.code === 0 && ct.last && ct.last.frames) {
    const gt = JSON.parse(fs.readFileSync(gtF, "utf8")), R0 = gt[0].R, F = ct.last.frames;
    const A = gt.map((g) => { const d = [g.C[0] - gt[0].C[0], g.C[1] - gt[0].C[1], g.C[2] - gt[0].C[2]]; return [R0[0] * d[0] + R0[1] * d[1] + R0[2] * d[2], R0[3] * d[0] + R0[4] * d[1] + R0[5] * d[2], R0[6] * d[0] + R0[7] * d[1] + R0[8] * d[2]]; });
    const Bc = F.map((x) => x.C); let num = 0, den = 0; A.forEach((a, i) => { for (let k = 0; k < 3; k++) { num += a[k] * Bc[i][k]; den += Bc[i][k] * Bc[i][k]; } });
    const s = num / Math.max(1e-12, den), trav = Math.hypot(...A[A.length - 1]);
    pathErr = Math.max(...A.map((a, i) => Math.hypot(a[0] - s * Bc[i][0], a[1] - s * Bc[i][1], a[2] - s * Bc[i][2]))) / trav;
    rotErr = Math.max(...gt.map((g, i) => { const Rg = mm(g.R, [R0[0], R0[3], R0[6], R0[1], R0[4], R0[7], R0[2], R0[5], R0[8]]), Rs = F[i].R; const M = mm(Rg, [Rs[0], Rs[3], Rs[6], Rs[1], Rs[4], Rs[7], Rs[2], Rs[5], Rs[8]]); return Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2))) * 180 / Math.PI; }));
  }
  check("📷 camtrack.py solves a moving camera filming two planes: every frame, the lens within 5° of 55°, the path within 8% of its travel, the turns within 1.5°, a sub-pixel error",
    ct.code === 0 && ct.last && ct.last.ok && ct.last.mode === "free" && ct.last.solved === 60 && near(ct.last.fov, 55, 5) && pathErr < 0.08 && rotErr < 1.5 && ct.last.err < 1 && ct.last.points.length > 200, { code: ct.code, err: ct.err, mode: ct.last && ct.last.mode, fov: ct.last && ct.last.fov, e: ct.last && ct.last.err, solved: ct.last && ct.last.solved, pathErr, rotErr });
  try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
