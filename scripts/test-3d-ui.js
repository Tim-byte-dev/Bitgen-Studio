#!/usr/bin/env node
/* bitGen Studio — 2.510.0 in a REAL browser: 🧊 2D LAYERS IN 3D - cards, the 3D camera, depth of field, shadows (tl3d.js).
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" (step 4: 2D layers in 3D)
 *   1. 🧊 3D layer on a picture: with the default camera nothing moves; depth z 1000 = half its size
 *   2. a small card in front casts its shadow on it when the light is on; depth of field blurs the far card
 *   3. the 🧊 Orbit tool moves the camera; camera keys glide; a 3D video layer needs the page bake
 *   4. ⚙ Compile: COMPILE = CANVAS at two moments (the camera moving)
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_3d510). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 3D browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_3d510";
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
    fs.mkdirSync(path.join(pd, "video"), { recursive: true }); fs.mkdirSync(path.join(pd, "images"), { recursive: true });
    ff(["-f", "lavfi", "-i", "color=c=0x202020:s=640x360:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-an", path.join(pd, "video", "d3_base.webm")]);
    ff(["-f", "lavfi", "-i", "testsrc2=s=160x90:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "12", "-deadline", "realtime", path.join(pd, "video", "d3_clip.webm")]);
    ff(["-f", "lavfi", "-i", "testsrc=s=400x220:r=1:d=1", "-frames:v", "1", path.join(pd, "images", "d3_back.png")]);
    ff(["-f", "lavfi", "-i", "color=c=0xffcc33:s=60x60:d=1", "-frames:v", "1", path.join(pd, "images", "d3_front.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.Tl3D && Tl3D.ready && window.TlVBake && TlVBake.ready, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "d3_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [mkLayer("Clip", [{ name: "d3_clip.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: 220, y: 110, scale: 1, rot: 0 } }])];
      tl.audio = []; delete tl.cam3;
      tl.images = [mkLayer("Back", [{ name: "d3_back.png", start: 0, len: 3, opacity: 1, tf: { x: 0, y: 0, scale: 1, rot: 0 } }]),
                   mkLayer("Front", [{ name: "d3_front.png", start: 0, len: 3, opacity: 1, tf: { x: -150, y: -80, scale: 1, rot: 0 } }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0); await p.waitForTimeout(800);
    const scr = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
    const comp = (t) => p.evaluate((t) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(0, 0, 640, 360).data); }, t);
    const region = (px, x0, y0, x1, y1) => { const o = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 640 + x) * 4; o.push(px[i], px[i + 1], px[i + 2]); } return o; };
    const lum = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const edge = (px, x0, y0, x1, y1) => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1 - 1; x++) { const i = (y * 640 + x) * 4; s += Math.abs(px[i] - px[i + 4]) + Math.abs(px[i + 1] - px[i + 5]); n++; } return s / n; };
    const pick = (i) => p.evaluate((i) => { const c = tl.images[i].clips[0]; TlCanvas.select(c, TlCanvas.layerOf(c)); }, i);
    const setNum = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, "input"); await p.waitForTimeout(150); };

    /* 1. a card */
    const flat = await comp(0);
    await pick(0); await p.waitForTimeout(300); await p.click("#tlp3On"); await p.waitForTimeout(400);
    const as3d = await comp(0);
    check("🧊 3D layer with the default camera: the picture is where it was (a card at z 0 = its 2D self)", meanDiff(flat, as3d) < 1.5, meanDiff(flat, as3d));
    await setNum('[data-d3="z"]', 1000);
    const deep = await comp(0);
    check("depth z 1000: the card is half its size (its old edge is now background, its middle still picture)",
      lum(region(deep, 125, 135, 205, 225)) < 40 && lum(region(flat, 125, 135, 205, 225)) > 60 && lum(region(deep, 230, 135, 260, 225)) > 45, [lum(region(deep, 125, 135, 205, 225)), lum(region(flat, 125, 135, 205, 225)), lum(region(deep, 230, 135, 260, 225))]);

    /* 2. shadows + depth of field */
    await pick(1); await p.waitForTimeout(300); await p.click("#tlp3On"); await p.waitForTimeout(300); await setNum('[data-d3="z"]', -300);
    const noLight = await comp(0);
    await p.click("#tlp3Light"); await p.waitForTimeout(400);
    await setNum('[data-cm="lx"]', -288); await setNum('[data-cm="ly"]', -154); await setNum('[data-cm="lz"]', -1500);
    const lit = await comp(0);
    const sh0 = lum(region(noLight, 305, 165, 335, 195)), sh1 = lum(region(lit, 305, 165, 335, 195)), out0 = lum(region(noLight, 230, 130, 250, 150)), out1 = lum(region(lit, 230, 130, 250, 150));
    check("💡 the light on: the small card in front throws its shadow on the middle of the far card (darker there, not elsewhere)", sh1 < sh0 - 25 && Math.abs(out1 - out0) < 4, { sh0, sh1, out0, out1 });
    const sharp = edge(lit, 230, 130, 410, 230);
    await p.click("#tlp3Dof"); await p.waitForTimeout(400);
    const dof = await comp(0), soft = edge(dof, 230, 130, 410, 230);
    check("depth of field (focus 1000, aperture 12): the far card (2000 away) goes soft", soft < sharp * 0.6, { sharp, soft });

    /* 3. orbit + camera keys + a 3D video layer */
    await p.evaluate(() => TlCanvas.setTool("orbit"));
    const o0 = await scr(320, 300), o1 = await scr(380, 300);
    await p.mouse.move(o0[0], o0[1]); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(o0[0] + (o1[0] - o0[0]) * k / 6, o0[1]); await p.mouse.up(); await p.waitForTimeout(400);
    const camO = await p.evaluate(() => JSON.parse(JSON.stringify(tl.cam3)));
    const orb = await comp(0);
    check("🧊 Orbit: a drag swings the camera round where it aims (x moves, the distance kept), the picture turns", Math.abs(camO.x) > 100 && Math.abs(Math.hypot(camO.x, camO.y || 0, camO.z) - 1000) < 2 && meanDiff(orb, dof) > 2, camO);
    await p.evaluate(() => TlCanvas.setTool("move")); await pick(0); await p.waitForTimeout(300);
    await p.click('[data-cmk="z"]'); await p.waitForTimeout(300);
    await goT(2); await p.waitForTimeout(300); await pick(0); await p.waitForTimeout(300);
    const z0 = camO.z; await setNum('[data-cm="z"]', Math.round(z0 + 400));
    const cz = await p.evaluate(() => ({ k: (tl.cam3.kf || []).filter((k) => k.cz != null).map((k) => [k.at, k.cz]), mid: Tl3D.cam(1).z }));
    check("camera keys: ◇ at 0 s, a change at 2 s = a second key; at 1 s the camera is between", cz.k.length === 2 && cz.k[1][0] === 2 && Math.abs(cz.mid - (z0 + 200)) < 30, cz);
    await p.evaluate(() => { const c = tl.vlayers[0].clips[0]; TlCanvas.select(c, TlCanvas.layerOf(c)); }); await p.waitForTimeout(300);
    await p.click("#tlp3On"); await p.waitForTimeout(300); await setNum('[data-d3="ry"]', 35);
    const vneeds = await p.evaluate(() => TlVBake.needs(tl.vlayers[0].clips[0]));
    check("a 3D video layer (y turn 35°) needs the page bake", vneeds === true);

    /* 4. the compile */
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(400); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_d3_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_d3_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 400000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 400 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    const baked = await p.evaluate(() => ({ imgs: tl.images.map((L) => !!L.clips[0].bake), vb: tl.vlayers[0].clips[0].vbake }));
    check("⚙ Compile: the cards baked, the 3D video baked whole", stt === "done" && fs.existsSync(movie) && baked.imgs.every(Boolean) && /_vb\.webm$/.test(baked.vb || ""), [stt, baked, log.slice(-6)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_d3_1.png"), W, H), m1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_d3_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      check("COMPILE = CANVAS at 1 s and 2 s (the camera moving between its keys, shadows, depth of field, a 3D video): mean difference under 7", d1 < 7 && d2 < 7, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 700));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; delete tl.cam3; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
