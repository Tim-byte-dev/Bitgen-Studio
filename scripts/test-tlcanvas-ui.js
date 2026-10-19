#!/usr/bin/env node
/* bitGen Studio — 2.377.0: the timeline docker's preview canvas, toolbar and layers panel, in a REAL browser - and
 * the compile drawing exactly what the canvas shows.
 * Tim: "Add a preview canvas to the timeline docker. user can drag videos, pictures and audio into the canvas and it
 * gets placed on a separate layer. user will be able to enter text and edit text. create a layers docker on the right
 * of the timeline docker the same height as the preview canvas, add a photoshop style toolbar to the left of the
 * preview canvas. user will be able to play preview in the preview canvas, similar to after effects".
 * Run against the running app (H3_URL, default the e2e server on :8311) from the app folder (it writes test media
 * into projects/e2e_cv377). No Playwright here = SKIP (exit 0).
 *   1. the stage: toolbar | canvas | layers, the layers panel as tall as the stage, ⧉ hides / shows it;
 *   2. a picture dropped on the canvas lands on a NEW layer at the playhead, where it was dropped; a sound on a new
 *      sound layer;
 *   3. Move: click selects, dragging moves it (X / Y follow), the layers panel highlights it;
 *   4. Text: a click makes a text layer; typing re-draws it and saves images/text_<id>.png;
 *   5. ▶ plays (the position marker runs), ⏸ stops; Space toggles over the stage;
 *   6. COMPILE PARITY: V1 + a moved / scaled / rotated video layer + a moved picture + a text layer -> the compiled
 *      frame at 2 s matches the canvas's own picture at 2 s (the layers' colours where the canvas put them).
 *   node scripts/test-tlcanvas-ui.js */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the timeline canvas browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_cv377";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(args), { stdio: "ignore" });
/* a frame as raw RGB (w x h) */
function rgbOf(file, w, h, at) {
  const a = ["-loglevel", "error"].concat(at != null ? ["-ss", String(at)] : []).concat(["-i", file, "-frames:v", "1",
    "-vf", `scale=${w}:${h}:flags=neighbor`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  return execFileSync("ffmpeg", a, { maxBuffer: 64 * 1024 * 1024 });
}
const px = (buf, w, x, y) => { const i = (Math.round(y) * w + Math.round(x)) * 3; return [buf[i], buf[i + 1], buf[i + 2]]; };
const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    // VP9 media: the test browser has no H.264 decoder (the app's Electron does)
    ff(["-f", "lavfi", "-i", "color=c=0x208030:s=640x360:r=24:d=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "cv_base.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=red:s=200x120:r=24:d=6", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", path.join(pd, "video", "cv_red.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=blue:s=160x160", "-frames:v", "1", path.join(pd, "images", "cv_blue.png")]);
    ff(["-f", "lavfi", "-i", "sine=frequency=500:duration=3", path.join(pd, "sound", "cv_beep.wav")]);

    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && typeof window.TlCanvas.snapshot === "function", null, { timeout: 20000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); setPlayhead(2);
    });
    await p.waitForTimeout(600);

    // 1
    const g = await p.evaluate(() => ["tlTools", "tlCanvasWrap", "tlLayersPanel", "tlStage"].map((id) => {
      const r = document.getElementById(id).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
    // 2.385.0 (Tim: "put timeline docker tools properties in a floating docker"): the toolbar is in #tlFloat now
    check("the stage: the canvas, the layers panel RIGHT of it; the toolbar in the floating Tools & Properties docker",
      g[1][0] + g[1][2] <= g[2][0] + 1 && await p.evaluate(() => document.getElementById("tlTools").parentElement.id === "tlFloat"), g);
    check("...the layers panel as tall as the stage (the canvas + its transport)", Math.abs(g[2][3] - g[3][3]) <= 2 && g[3][3] > 150, g);
    check("...the toolbar: Move, Text, Hand, Zoom, Fit, the colour", await p.evaluate(() =>
      ["tlTool_move", "tlTool_text", "tlTool_hand", "tlTool_zoom", "tlTool_fit", "tlTool_color"].every((id) => !!document.getElementById(id))));

    // 2: drops (the app's own drag payload)
    const wrap = await p.locator("#tlCanvasWrap").boundingBox();
    const dropAt = async (payload, sx, sy) => p.evaluate(({ payload, sx, sy }) => {
      dragPayload = payload;
      const dt = new DataTransfer();
      const el = document.getElementById("tlCanvasWrap");
      el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientX: sx, clientY: sy, dataTransfer: dt }));
      el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, clientX: sx, clientY: sy, dataTransfer: dt }));
      dragPayload = null;
    }, { payload, sx, sy });
    await dropAt({ type: "asset", kind: "video", name: "cv_base.webm", duration: 6 }, wrap.x + 50, wrap.y + 50);
    // V1 sets the picture size (640x360) once its video loads - measure the view after that
    await p.waitForFunction(() => TlCanvas.state.W === 640 && TlCanvas.state.H === 360, null, { timeout: 15000 });
    await p.waitForTimeout(300);
    const view = await p.evaluate(() => ({ z: TlCanvas.state.view.z, ox: TlCanvas.state.view.ox, oy: TlCanvas.state.view.oy, W: TlCanvas.state.W, H: TlCanvas.state.H }));
    // the picture dropped 100 px (picture pixels) right of / 50 above the centre
    const sx = wrap.x + view.ox + (view.W / 2 + 100) * view.z, sy = wrap.y + view.oy + (view.H / 2 - 50) * view.z;
    await dropAt({ type: "asset", kind: "images", name: "cv_blue.png" }, sx, sy);
    await dropAt({ type: "asset", kind: "sound", name: "cv_beep.wav", duration: 3 }, sx, sy);
    await p.waitForTimeout(400);
    const after = await p.evaluate(() => ({ v1: tl.video.map((c) => [c.name, c.start]), img: tl.images.map((L) => [L.name, L.clips[0].name, L.clips[0].start, L.clips[0].tf]),
      aud: tl.audio.map((L) => [L.name, L.clips[0].name, L.clips[0].start]) }));
    check("a video dropped on an empty timeline becomes V1 at the playhead", after.v1.length === 1 && after.v1[0][0] === "cv_base.webm" && after.v1[0][1] === 2, after.v1);
    check("a picture dropped lands on a NEW image layer at the playhead, where it was dropped",
      after.img.length === 1 && after.img[0][1] === "cv_blue.png" && after.img[0][2] === 2
      && Math.abs(after.img[0][3].x - 100) <= 2 && Math.abs(after.img[0][3].y + 50) <= 2, after.img);
    check("a sound dropped lands on a NEW sound layer at the playhead", after.aud.length === 1 && after.aud[0][1] === "cv_beep.wav" && after.aud[0][2] === 2, after.aud);
    check("...and the layers panel lists them (top first)", await p.evaluate(() =>
      [...document.querySelectorAll("#tlLayerList .tll-nm b")].map((x) => x.textContent).join(",")) === "I1,V1,A1");

    // 3: Move - click selects, drag moves
    await p.evaluate(() => { tl.video[0].start = 0; tl.images[0].clips[0].start = 0; tlSave(); renderTimeline(); setPlayhead(2); TlCanvas.setTool("move"); });
    await p.waitForTimeout(500);
    await p.mouse.move(sx, sy); await p.mouse.down();
    await p.mouse.move(sx + 30, sy + 20, { steps: 6 }); await p.mouse.up();
    const mv = await p.evaluate(() => ({ tf: tl.images[0].clips[0].tf, sel: tlSelClip === tl.images[0].clips[0],
      row: (document.querySelector("#tlLayerList .tll-row.sel b") || {}).textContent, X: document.getElementById("tlpX").value }));
    check("Move: a click selects the picture, dragging moves it by the view's zoom",
      mv.sel && mv.row === "I1" && Math.abs(mv.tf.x - (100 + 30 / view.z)) <= 2 && Math.abs(mv.tf.y - (-50 + 20 / view.z)) <= 2, mv);
    check("...the Properties X follows", Math.abs(+mv.X - mv.tf.x) <= 1, mv);

    // 4: Text
    await p.evaluate(() => TlCanvas.setTool("text"));
    const tx = wrap.x + view.ox + (view.W / 2) * view.z, ty = wrap.y + view.oy + (view.H * 0.8) * view.z;
    await p.mouse.click(tx, ty);
    await p.waitForTimeout(300);
    await p.fill("#tlpText", "Canvas text");
    await p.waitForTimeout(900);
    const tid = await p.evaluate(() => { const L = tl.images.find((x) => x.clips[0] && x.clips[0].text); return L && [L.name, L.clips[0].tid, L.clips[0].text.content, L.clips[0].name]; });
    check("Text: a click makes a text layer, typing edits it", tid && tid[2] === "Canvas text" && tid[3] === "text_" + tid[1] + ".png", tid);
    const pngOk = tid && fs.existsSync(path.join(pd, "images", tid[3]));
    check("...its picture is saved as images/text_<id>.png for the compile", pngOk);

    // 5: play
    await p.evaluate(() => { setPlayhead(0.5); TlCanvas.setTool("move"); });
    await p.click("#tlCPlay"); await p.waitForTimeout(900);
    const pl = await p.evaluate(() => [TlCanvas.state.playing, playhead]);
    await p.click("#tlCPlay");
    const pz = await p.evaluate(() => [TlCanvas.state.playing, playhead]);
    check("▶ plays the preview - the position marker runs - and ⏸ stops it", pl[0] === true && pl[1] > 1.0 && pz[0] === false, [pl, pz]);
    await p.mouse.move(wrap.x + 20, wrap.y + 20);
    await p.keyboard.press("Space"); await p.waitForTimeout(400);
    const sp = await p.evaluate(() => TlCanvas.state.playing);
    await p.keyboard.press("Space");
    check("Space over the stage plays / pauses", sp === true && await p.evaluate(() => TlCanvas.state.playing) === false);

    // 6: compile parity
    await p.evaluate(() => {
      tl.audio = [];
      tl.vlayers = [mkLayer("V2", [{ name: "cv_red.webm", src: "video", start: 0, dur: 6, in: 0, out: 6, opacity: 1,
        tf: { x: -150, y: 60, scale: 0.75, rot: 30 } }])];
      tlSave(); renderTimeline(); setPlayhead(2);
    });
    await p.waitForTimeout(1500);
    const snap = await p.evaluate(() => TlCanvas.snapshot());
    const snapFile = path.join(pd, "temp_cv_snap.png");
    fs.writeFileSync(snapFile, Buffer.from(snap.split(",")[1], "base64"));
    await p.evaluate(() => TlCanvas.flushText());
    const payload = await p.evaluate(() => ({
      video: tl.video.map((c) => ({ ...c })), video_layers: tl.vlayers.map((L) => ({ name: L.name, clips: L.clips.map((c) => ({ ...c })) })),
      images: tl.images.map((L) => ({ clips: L.clips.map((c) => ({ ...c })) })), audio: [] }));
    const job = await api("/api/export", payload);
    let st = "";
    for (let i = 0; i < 120 && job.id; i++) {
      st = (await api("/api/jobs/" + job.id)).status;
      if (st === "done" || st === "failed") break;
      await new Promise((ok) => setTimeout(ok, 1000));
    }
    const movie = path.join(pd, P + ".mp4");
    check("the compile finished", st === "done" && fs.existsSync(movie), st);
    if (st === "done") {
      const W = 640, H = 360;
      const A = rgbOf(snapFile, W, H), B = rgbOf(movie, W, H, 2.0);
      const red = [W / 2 - 150, H / 2 + 60], blue = [W / 2 + 100 + 30 / view.z, H / 2 - 50 + 20 / view.z], green = [40, 40];
      const pts = { red: [px(A, W, ...red), px(B, W, ...red)], blue: [px(A, W, ...blue), px(B, W, ...blue)], base: [px(A, W, ...green), px(B, W, ...green)] };
      check("COMPILE = CANVAS: the rotated, scaled video layer is where the canvas drew it (red in both)",
        near(pts.red[0], [255, 0, 0], 40) && near(pts.red[1], [255, 0, 0], 60), pts.red);
      check("...the moved picture too (blue in both)", near(pts.blue[0], [0, 0, 255], 40) && near(pts.blue[1], [0, 0, 255], 60), pts.blue);
      check("...and V1 underneath (the base colour in both)", near(pts.base[0], pts.base[1], 40), pts.base);
      // the rotated red box's corner area: 30° rotation leaves the box's unrotated corner showing the base, in both
      const off = [W / 2 - 150 + 75 * 0.95, H / 2 + 60 - 45 * 0.95];
      check("...the rotation matches (just inside the unrotated corner: not red in either)",
        !near(px(A, W, ...off), [255, 0, 0], 60) && !near(px(B, W, ...off), [255, 0, 0], 60), [px(A, W, ...off), px(B, W, ...off)]);
      let diff = 0;
      for (let i = 0; i < A.length; i++) diff += Math.abs(A[i] - B[i]);
      diff /= A.length;
      check("...the whole frame agrees (mean difference per channel under 12)", diff < 12, Math.round(diff * 100) / 100);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 600));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
