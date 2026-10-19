#!/usr/bin/env node
/* bitGen Studio — 2.515.0 in a REAL browser: THEME EDIT MODE WITH THE DIALOGS (Ctrl+Shift+Alt+E, Ctrl+S) and STEP 8 of
 * the After Effects gap list on the timeline - 🧍 cut out a subject through a shot (the canvas and ⚙ Compile see
 * through round it), 🩹 remove it (content-aware fill), 📷 solve the camera and 📌 place a layer in the scene.
 * Tim (verbatim): "when user presses ctrl+shift+alt+e go into edit mode,ctrl+s saves the theme and exits edit mode -
 * this is so users can edit dialogs like the settings dialog. and do number 8 of the after effects list".
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder. No Playwright = SKIP. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync, execFileSync, spawnSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.515 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_sc515";
const PY = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const rgbAt = (file, w, h, at) => execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(at), "-i", file, "-frames:v", "1", "-vf", `scale=${w}:${h}:flags=neighbor`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 * 1024 * 1024 });
const px = (buf, w, x, y) => { const i = (y * w + x) * 3; return [buf[i], buf[i + 1], buf[i + 2]]; };
const meanDiff = (A, B) => { let d = 0; for (let i = 0; i < A.length; i++) d += Math.abs(A[i] - B[i]); return d / A.length; };

(async () => {
  const hasCv = spawnSync(PY, ["-c", "import cv2, numpy, scipy"]).status === 0;
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const THEMES = path.join(ROOT, "themes");
  const pd = path.join(ROOT, "projects", P);
  try {
    for (const f of fs.existsSync(THEMES) ? fs.readdirSync(THEMES) : []) if (/\.tmp$|^zzHot515/.test(f)) fs.rmSync(path.join(THEMES, f), { force: true });
    await api("/api/projects/load", { name: P });
    fs.mkdirSync(path.join(pd, "video"), { recursive: true });
    // the shots: a red disc moving over a panning texture (+ a yellow square that is NOT it), a plain V1, the camera shot
    const GEN = `
import sys, math, numpy as np, cv2
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import scene_io as sio
W, H, N = 640, 360, 48
rng = np.random.default_rng(1)
bg = cv2.GaussianBlur((rng.random((H, W, 3)) * 60 + 40).astype(np.uint8), (0, 0), 1.2)
wr = sio.Writer(sys.argv[1], W, H, 24, "vp9", crf=14)
for i in range(N):
    f = np.roll(bg, i * 2, axis=1).copy()
    cv2.circle(f, (160 + i * 4, 180), 50, (230, 60, 50), -1)
    cv2.rectangle(f, (480 - i * 2, 60), (560 - i * 2, 140), (230, 220, 40), -1)
    wr.write(f)
wr.close()
W, H, N = 960, 540, 48
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
wr = sio.Writer(sys.argv[2], W, H, 24, "vp9", crf=12)
for i in range(N):
    u = i / (N - 1); C = np.array([-0.8 + 1.6 * u, -0.25 * u, 0.5 * u]); R = rotY(math.radians(-5 + 8 * u)); t = -R @ C
    img = np.zeros((H, W, 3), np.uint8)
    for O, U, V, T in planes:
        cv2.warpPerspective(T, K @ np.column_stack([R @ U, R @ V, R @ O + t]), (W, H), dst=img, borderMode=cv2.BORDER_TRANSPARENT)
    wr.write(img[..., ::-1].copy())
wr.close()`;
    if (hasCv) spawnSync(PY, ["-c", GEN, path.join(pd, "video", "sc_disc.webm"), path.join(pd, "video", "sc_cam.webm")], { stdio: "ignore" });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x2050c0:s=640x360:r=24:d=2", "-f", "lavfi", "-i", "sine=frequency=330:duration=2", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "sc_blue.webm")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit && document.getElementById("thEditBtn") && window.TlCanvas && window.TlCutout && TlCutout.ready && window.TlCamTrack && TlCamTrack.ready && window.TlVFill && TlVFill.ready, null, { timeout: 60000 });
    await p.waitForTimeout(800);

    /* 1. Ctrl+Shift+Alt+E: edit mode WITH the dialogs - Settings stays open, its parts are styled; Ctrl+S saves + leaves */
    await ev(() => { localStorage.removeItem("h3.themeStyles"); H3ThemeEdit.setStyles({}); });
    await p.click("#openSettings");
    await p.waitForFunction(() => document.getElementById("settings").open, null, { timeout: 8000 }).catch(() => {});
    await p.keyboard.press("Control+Shift+Alt+KeyE"); await p.waitForTimeout(300);
    const a1 = await ev(() => ({ on: H3ThemeEdit.isOn(), dl: H3ThemeEdit.dialogs(), open: document.getElementById("settings").open }));
    const sb = await ev(() => { const x = [...document.querySelectorAll("#settings button")].filter((y) => y.offsetParent && y.getBoundingClientRect().width > 20)[0]; x.id = x.id || "zzSB515"; const r = x.getBoundingClientRect(); return { id: x.id, x: r.left + r.width / 2, y: r.top + r.height / 2, fw: getComputedStyle(x).fontWeight }; });
    await p.mouse.click(sb.x, sb.y); await p.waitForTimeout(400);
    const a2 = await ev(() => ({ inDlg: !!document.querySelector("#settings #thEditPanel"), scope: H3ThemeEdit.scope(), open: document.getElementById("settings").open }));
    check("Ctrl+Shift+Alt+E: edit theme mode with the dialogs - Settings stays open; a click on its button picks it (no click reaches it) and the Style panel opens INSIDE the dialog", a1.on && a1.dl && a1.open && a2.inDlg && a2.open && a2.scope === "#" + sb.id, { a1, a2 });
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    const a3 = await ev(() => ({ panel: !!document.getElementById("thEditPanel"), open: document.getElementById("settings").open, on: H3ThemeEdit.isOn() }));
    check("Esc in that mode closes the Style panel - never the dialog", !a3.panel && a3.open && a3.on, a3);
    await p.mouse.click(sb.x, sb.y); await p.waitForTimeout(300);
    await ev(() => { const x = document.getElementById("teWeight"); x.value = "800"; x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(300);
    await p.keyboard.press("Control+KeyS"); await p.waitForTimeout(400);
    const a4 = await ev(() => ({ box: !!document.querySelector("#settings #thExitBox"), named: H3ThemeEdit.session(), row: document.getElementById("thxAsRow") ? document.getElementById("thxAsRow").style.display : "x" }));
    if (await ev(() => !!document.getElementById("thxName"))) { await p.fill("#thxName", "zzHot515"); await p.click("#thxAsGo"); }
    else await p.waitForTimeout(100);
    await p.waitForTimeout(900);
    const a5 = await ev((id) => ({ on: H3ThemeEdit.isOn(), open: document.getElementById("settings").open, cur: H3Theme.current().name, fw: getComputedStyle(document.getElementById(id)).fontWeight }), sb.id);
    const saved = (() => { const f = path.join(THEMES, (a5.cur || "zzHot515") + ".json"); try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } })();
    check("Ctrl+S: the theme saved (a new one asks for its name - the box inside the dialog) and edit mode left; the dialog's button keeps its new look",
      (a4.box || a4.named !== "Untitled") && !a5.on && a5.open && a5.fw === "800" && saved && saved.styles && saved.styles["#" + sb.id] && saved.styles["#" + sb.id].weight == 800, { a4, a5, saved: saved && saved.styles });
    await ev(() => document.getElementById("settings").close());
    for (const f of fs.existsSync(THEMES) ? fs.readdirSync(THEMES) : []) if (/^zzHot515|\.tmp$/.test(f)) fs.rmSync(path.join(THEMES, f), { force: true });
    await ev(() => { localStorage.removeItem("h3.themeStyles"); H3ThemeEdit.setStyles({}); });

    if (!hasCv) { console.log("SKIP: no OpenCV for the scene tools' part"); }
    else {
      /* 2. 🧍 the cut-out on a video layer */
      await ev(() => {
        const d = document.getElementById("timelinedock");
        if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
        setVar("th", 820);
        if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
        delete tl.cam3; delete tl.frame;
        tl.video = [{ name: "sc_blue.webm", src: "video", start: 0, dur: 2, in: 0, out: 2, opacity: 1 }];
        tl.vlayers = [mkLayer("Disc", [{ name: "sc_disc.webm", src: "video", start: 0, dur: 2, in: 0, out: 2, opacity: 1, uid: "udisc1", tf: { x: 0, y: 0, scale: 1, rot: 0 } }])];
        tl.audio = []; tl.images = [];
        tlSave(); renderTimeline();
      });
      await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
      const goT = (t) => ev((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
      const scr = (x, y) => ev(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
      await goT(0.5); await p.waitForTimeout(900);
      await ev(() => { TlCanvas.select(tl.vlayers[0].clips[0], { lk: "vl:0" }); TlCanvas.paintProps(); });
      await p.waitForTimeout(300);
      const sec = await ev(() => ({ cut: !!document.querySelector(".tlp-cutout"), cam: !!document.querySelector(".tlp-camtrack"), fill: !!document.querySelector(".tlp-vfill") }));
      check("a video clip's Properties: 🧍 Cut out, 📷 3D camera track, 🩹 Remove", sec.cut && sec.cam && sec.fill, sec);
      await p.click('.tlp-cutout [data-cut="inc"]'); await p.waitForTimeout(150);
      let q = await scr(160 + 12 * 4, 180); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(200);       // the disc at 0.5 s (frame 12)
      await p.click('.tlp-cutout [data-cut="exc"]'); await p.waitForTimeout(150);
      q = await scr(520 - 12 * 2 - 0, 100); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(200);       // the square (not it)
      await ev(() => { document.getElementById("tlpCutWay").value = "flow"; document.getElementById("tlpCutWay").dispatchEvent(new Event("change")); });
      await p.waitForTimeout(200);
      const marks = await ev(() => tl.vlayers[0].clips[0].cut.prompts);
      check("✚ / ✖ on the canvas: a subject click and a not-it click at 0.5 s (the picture's 0..1)", marks.length === 1 && Math.abs(marks[0].t - 0.5) < 0.03 && marks[0].pts.length === 2 && marks[0].pts[0][2] === 1 && marks[0].pts[1][2] === 0 && Math.abs(marks[0].pts[0][0] - 208 / 640) < 0.02, marks);
      await p.click("#tlpCutGo");
      await p.waitForFunction(() => tl.vlayers[0].clips[0].cut && tl.vlayers[0].clips[0].cut.file, null, { timeout: 180000 });
      await p.waitForTimeout(500);
      const ck = await ev(() => { const c = tl.vlayers[0].clips[0]; return { file: c.cut.file, use: c.cut.use, url: TlCutout.url(c), made: c.cut.made }; });
      check("▶ Cut out: video/cut_*.webm made (built in), used by the video layer - the canvas plays it", /^cut_sc_disc_[0-9a-f]{10}\.webm$/.test(ck.file) && ck.use === true && /\/passets\/video\/cut_/.test(ck.url || "") && fs.existsSync(path.join(pd, "video", ck.file)), ck);
      const snapAt = async (t) => { await goT(t); await p.waitForTimeout(1200); await goT(t); await p.waitForTimeout(400); return Buffer.from((await ev(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
      fs.writeFileSync(path.join(pd, "temp_sc_1.png"), await snapAt(1));
      const cv1 = rgbAt(path.join(pd, "temp_sc_1.png"), 640, 360, 0);
      const disc = px(cv1, 640, 160 + 24 * 4, 180), square = px(cv1, 640, 520 - 48, 100), bgp = px(cv1, 640, 40, 300);
      const blueish = (c) => c[2] > 150 && c[0] < 70;
      check("the canvas: the disc shows (red), round it the layer is see-through - V1's blue shows where the texture and the square were", disc[0] > 180 && disc[1] < 100 && blueish(square) && blueish(bgp), { disc, square, bgp });
      // ⚙ Compile = canvas
      const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 180000 });
      await p.click("#tlExport");
      const job = await (await resp).json();
      let stt = "", log = [];
      for (let i = 0; i < 300 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
      const movie = path.join(pd, P + ".mp4");
      if (stt === "done" && fs.existsSync(movie)) {
        const m1 = rgbAt(movie, 640, 360, 1), d1 = meanDiff(cv1, m1), md = px(m1, 640, 160 + 24 * 4, 180), ms = px(m1, 640, 520 - 48, 100);
        check("⚙ Compile reads the cut-out: the same see-through layer (COMPILE = CANVAS at 1 s, mean difference under 8)", d1 < 8 && md[0] > 180 && blueish(ms), { d1: Math.round(d1 * 100) / 100, md, ms });
      } else check("⚙ Compile finished", false, [stt, log.slice(-6)]);

      /* 3. 🩹 remove the disc (content-aware fill) */
      await ev(() => { TlCanvas.select(tl.vlayers[0].clips[0], { lk: "vl:0" }); TlCanvas.paintProps(); });
      await p.waitForTimeout(200);
      await p.click("#tlpVfGo");
      await p.waitForFunction(() => /_fill[0-9a-f]{10}\.webm$/.test(tl.vlayers[0].clips[0].name), null, { timeout: 240000 });
      await p.waitForTimeout(400);
      const fz = await ev(() => { const c = tl.vlayers[0].clips[0]; return { name: c.name, of: c.vfill.of, use: c.cut.use, info: c.vfill.info }; });
      const fm = rgbAt(path.join(pd, "video", fz.name), 640, 360, 1), fd = px(fm, 640, 160 + 24 * 4, 180);
      check("▶ Remove: the layer plays <clip>_fill<hash>.webm (its cut-out off); at 1 s the disc is gone - the texture behind it, from other frames", fz.of === "sc_disc.webm" && fz.use === false && fd[0] < 140 && fz.info && fz.info.from_frames > 0.5, { fz, fd });
      await ev(() => { TlCanvas.select(tl.vlayers[0].clips[0], { lk: "vl:0" }); TlCanvas.paintProps(); });
      await p.click("#tlpVfOrig"); await p.waitForTimeout(200);
      check("↺ Original: the clip back on its own file", await ev(() => tl.vlayers[0].clips[0].name === "sc_disc.webm"));

      /* 4. 📷 solve the camera of a V1 shot; pick points on the floor; 📌 a new text flat on it - it sticks to the scene */
      await ev(() => { tl.video = [{ name: "sc_cam.webm", src: "video", start: 0, dur: 2, in: 0, out: 2, opacity: 1 }]; tl.vlayers = []; tl.images = []; delete tl.cam3; tlSave(); renderTimeline(); });
      await p.waitForFunction(() => TlCanvas.state.W === 960, null, { timeout: 20000 });
      await goT(0); await p.waitForTimeout(800);
      await ev(() => { TlCanvas.select(tl.video[0], { lk: "v1" }); TlCanvas.paintProps(); });
      await p.waitForTimeout(300);
      await p.click("#tlpCamGo");
      await p.waitForFunction(() => tl.video[0].cam3d && tl.video[0].cam3d.file && TlCamTrack.solveOf(tl.video[0]), null, { timeout: 240000 });
      await p.waitForTimeout(500);
      const sv = await ev(() => tl.video[0].cam3d.info);
      check("▶ Solve: every frame solved (a moving camera), the lens near 55°, a sub-pixel error, the scene's points", sv && sv.solved === sv.frames && sv.mode === "free" && Math.abs(sv.fov - 55) < 6 && sv.err < 1 && sv.points > 200, sv);
      await ev(() => { TlCanvas.select(tl.video[0], { lk: "v1" }); TlCanvas.paintProps(); });
      await p.click("#tlpCamPick"); await p.waitForTimeout(150);
      const a = await scr(330, 430), bb = await scr(630, 520);                 // a box over the floor
      await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(bb[0], bb[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
      const nsel = await ev(() => (tl.video[0].cam3d.sel || []).length);
      check("📷 Pick: a box dragged over the floor picks the points in it", nsel >= 5, nsel);
      await ev(() => { TlCanvas.select(tl.video[0], { lk: "v1" }); TlCanvas.paintProps(); });
      await p.waitForTimeout(200);
      await ev(() => { document.getElementById("tlpCamTgt").value = ""; document.getElementById("tlpCamHow").value = "flat"; });
      await p.click("#tlpCamPlace"); await p.waitForTimeout(800);
      const pl = await ev(() => {
        const L = tl.images[tl.images.length - 1], c = L && L.clips[0], cam = (t) => Tl3D.camAt(tl.cam3, t, H3Keyframes);
        if (!c || !c.d3) return null;
        const sol = TlCamTrack.solveOf(tl.video[0]), sel = tl.video[0].cam3d.sel, D = tl.cam3.zoom;
        const P = sel.map((i) => TlCamTrack.toWorld(sol.points[i], D)), mid = TlCamTrack.fitPlane(P, [0, 0, -D]).c;
        const W = TlCanvas.state.W, H = TlCanvas.state.H;
        const at = (t) => { const cm = cam(t); const cardC = [c.tf.x, c.tf.y, c.d3.z]; return { card: Tl3D.project(cm, W, H, cardC), mid: Tl3D.project(cm, W, H, mid) }; };
        const pts = (t) => { const cm = cam(t); return sel.slice(0, 5).map((i) => Tl3D.project(cm, W, H, TlCamTrack.toWorld(sol.points[i], D))); };
        return { keys: (tl.cam3.kf || []).length, d3: c.d3, text: !!c.text, a0: at(0), a1: at(1.5), p0: pts(0), p1: pts(1.5), start: c.start, len: c.len };
      });
      const moved = pl ? Math.hypot(pl.a1.mid[0] - pl.a0.mid[0], pl.a1.mid[1] - pl.a0.mid[1]) : 0;
      check("📌 Place (＋ New text, flat on them): a 🧊 3D text card over the clip's length, the 3D camera keyed every frame from the solve; the card stays on the picked floor as the camera moves (its centre = theirs, both moving on the picture)",
        pl && pl.text && pl.d3 && pl.d3.on && pl.keys >= 40 && Math.abs(pl.a0.card[0] - pl.a0.mid[0]) < 1 && Math.abs(pl.a1.card[1] - pl.a1.mid[1]) < 1 && moved > 20 && Math.abs(pl.len - 2) < 0.05, { pl, moved });
      await goT(1); await p.waitForTimeout(600);
      if (process.env.SHOT) { await ev(() => { TlCanvas.select(tl.video[0], { lk: "v1" }); TlCanvas.paintProps(); }); await p.waitForTimeout(1500); await p.screenshot({ path: process.env.SHOT }); }
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; delete tl.cam3; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    for (const f of fs.existsSync(THEMES) ? fs.readdirSync(THEMES) : []) if (/^zzHot515|\.tmp$/.test(f)) fs.rmSync(path.join(THEMES, f), { force: true });
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
