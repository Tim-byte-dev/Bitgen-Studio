#!/usr/bin/env node
/* bitGen Studio — 2.379.0: ◆ keyframes on the timeline canvas TWEEN, in a REAL browser - and the compile draws the
 * same tween.
 * Tim: "say we add a text to the preview canvas add a keyframe to the timeline on that text layer then add another
 * keyframe at a different time and scale or move or change color can we create a tween between the keyframes?"
 * Run against the running app (H3_URL, default the e2e server on :8311) from the app folder (it writes test media into
 * projects/e2e_kf379). No Playwright here = SKIP (exit 0).
 *   1. a text layer; ◇ Key at the playhead keys its position / scale / rotation / opacity / colour;
 *   2. later on: the Properties' X / Y / Scale / Rot / colour go into a SECOND keyframe (auto-key) - two ◆ on the clip;
 *   3. between them the canvas draws the tween (the values = static/keyframes.js); the ease menu changes the curve;
 *      ◀ / ▶ jump between the keyframes;
 *   4. a picture with keyframed opacity + position;
 *   5. COMPILE PARITY through the real ⚙ Compile button: the compiled frames in the middle of the tween and after it
 *      match the canvas's own pictures (the text's colour tween included).
 *   node scripts/test-keyframes-ui.js */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the keyframe browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_kf379";
const KF = require(path.join(ROOT, "static", "keyframes.js"));
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); }
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
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    ff(["-f", "lavfi", "-i", "color=c=0x208030:s=640x360:r=24:d=5", "-f", "lavfi", "-i", "sine=frequency=330:duration=5",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "kf_base.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=blue:s=120x120", "-frames:v", "1", path.join(pd, "images", "kf_blue.png")]);

    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.H3Keyframes, null, { timeout: 20000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "kf_base.webm", src: "video", start: 0, dur: 5, in: 0, out: 5, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);

    // 1: a text layer at 0.5 s, keyed there
    await goT(0.5);
    const c0 = await p.evaluate(async () => {
      TlCanvas.addText({ x: 320 - 160, y: 180 + 40 });
      const c = tl.images[tl.images.length - 1].clips[0];
      const ta = document.getElementById("tlpText"); ta.value = "KEY"; ta.dispatchEvent(new Event("input"));
      const sz = document.getElementById("tlpSize"); sz.value = "72"; sz.dispatchEvent(new Event("input"));
      const col = document.getElementById("tlpColor"); col.value = "#ffffff"; col.dispatchEvent(new Event("input"));
      await new Promise((ok) => setTimeout(ok, 200));
      return { tf: c.tf, start: c.start, kf: c.kf || null, keyBtn: document.getElementById("tlpKAdd") && document.getElementById("tlpKAdd").textContent };
    });
    check("a text layer at the playhead, no keyframes yet (◇ Key offered)", c0.start === 0.5 && !c0.kf && /◇/.test(c0.keyBtn), c0);
    await p.click("#tlpKAdd");
    await p.waitForTimeout(200);
    const k1 = await p.evaluate(() => JSON.parse(JSON.stringify(tl.images[tl.images.length - 1].clips[0].kf || [])));
    check("◇ Key keys EVERYTHING at the playhead: position, scale, rotation, opacity, colour (at +0 s into the clip)",
      k1.length === 1 && k1[0].at === 0 && k1[0].x === -160 && k1[0].y === 40 && k1[0].scale === 1 && k1[0].rot === 0 && k1[0].op === 1
      && k1[0].color === "#ffffff", k1);

    // 2: later: move, scale, rotate, recolour -> a second keyframe (auto-key)
    await goT(2.5);
    await p.evaluate(() => {
      const set = (id, v) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); };
      set("tlpX", 150); set("tlpY", -60); set("tlpS", 200); set("tlpR", 30); set("tlpColor", "#ff0000");
    });
    await p.waitForTimeout(400);
    const k2 = await p.evaluate(() => ({ kf: JSON.parse(JSON.stringify(tl.images[tl.images.length - 1].clips[0].kf)),
      tf: tl.images[tl.images.length - 1].clips[0].tf, color: tl.images[tl.images.length - 1].clips[0].text.color,
      diamonds: document.querySelectorAll("#tlinner .clip .kfd").length }));
    const second = k2.kf.find((k) => k.at === 2);
    check("changing X / Y / Scale / Rot / colour two seconds later MADE a second keyframe there (auto-key)",
      k2.kf.length === 2 && second && second.x === 150 && second.y === -60 && second.scale === 2 && second.rot === 30 && second.color === "#ff0000", k2.kf);
    check("...the clip's own static values untouched (the keyframes animate them)", k2.tf.x === -160 && k2.tf.y === 40 && k2.color === "#ffffff", k2);
    check("...two ◆ diamonds on the clip in the timeline", k2.diamonds === 2, k2.diamonds);

    // 3: the tween between them
    const mid = await p.evaluate(() => { const c = tl.images[tl.images.length - 1].clips[0]; return { tf: TlCanvas.tfAt(c, 1.5), col: TlCanvas.textAt(c, 1.5).color }; });
    const kfNow = k2.kf;
    check("the canvas tweens: at 1.5 s (half way) position / scale / rotation / colour are half way",
      mid.tf.x === -5 && mid.tf.y === -10 && mid.tf.scale === 1.5 && mid.tf.rot === 15 && mid.col === KF.value(kfNow, 1, "color", "#000"), mid);
    await goT(0.5);
    await p.waitForTimeout(150);
    await p.selectOption("#tlpKEase", "inout");
    const eased = await p.evaluate(() => { const c = tl.images[tl.images.length - 1].clips[0]; return { ease: c.kf[0].ease, tf: TlCanvas.tfAt(c, 1.0) }; });
    const want = KF.value([Object.assign({}, kfNow[0], { ease: "inout" }), kfNow[1]], 0.5, "x", 0);
    check("the ease menu: ease in + out on the first keyframe changes the curve (a quarter of the way = less than linear)",
      eased.ease === "inout" && near(eased.tf.x, want, 0.01) && eased.tf.x < -160 + (310 * 0.25), { eased, want });
    await p.click("#tlpKNext");
    const atNext = await p.evaluate(() => TlCanvas.state.t);
    await p.click("#tlpKPrev");
    const atPrev = await p.evaluate(() => TlCanvas.state.t);
    check("▶ / ◀ jump to the next / previous keyframe", near(atNext, 2.5, 1e-6) && near(atPrev, 0.5, 1e-6), [atNext, atPrev]);

    // 4: a picture with keyframed opacity + position
    await p.evaluate(() => {
      const c = { name: "kf_blue.png", start: 0, len: 4, opacity: 1, tf: { x: 220, y: 100, scale: 1, rot: 0 },
                  kf: [{ at: 0.5, x: 220, y: 100, op: 1 }, { at: 3, x: 220, y: -100, op: 0.2 }] };
      tl.images.unshift(mkLayer("I1", [c])); tlSave(); renderTimeline();
    });
    await p.waitForTimeout(800);

    // 5: compile parity - the real ⚙ Compile
    const snapAt = async (t) => {
      await goT(t);
      await p.waitForTimeout(700);
      await goT(t);
      await p.waitForTimeout(300);
      return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64");
    };
    const sMid = await snapAt(1.5), sEnd = await snapAt(3.2);
    fs.writeFileSync(path.join(pd, "temp_kf_mid.png"), sMid); fs.writeFileSync(path.join(pd, "temp_kf_end.png"), sEnd);
    await p.evaluate(() => TlCanvas.flushText());
    await p.waitForTimeout(500);
    check("the keyed text colour's white twin is on disk for the compile", fs.readdirSync(path.join(pd, "images")).some((n) => /^text_.+_w\.png$/.test(n)));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 30000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let st = "", log = [];
    for (let i = 0; i < 120 && job.id; i++) {
      const d = await api("/api/jobs/" + job.id);
      st = d.status; log = d.log || [];
      if (st === "done" || st === "failed") break;
      await new Promise((ok) => setTimeout(ok, 1000));
    }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile (the real button) finished, with the keyframes tweened", st === "done" && fs.existsSync(movie)
      && log.some((l) => /keyframe\(s\) tweened .*position \/ scale \/ rotation.*colour/.test(l))
      && log.some((l) => /kf_blue\.png: 2 keyframe\(s\) tweened .*opacity/.test(l)), [st, log.filter((l) => /worker/.test(l)).slice(-6)]);
    if (st === "done") {
      const W = 640, H = 360;
      const cm = rgbOf(path.join(pd, "temp_kf_mid.png"), W, H), mm = rgbOf(movie, W, H, 1.5);
      const ce = rgbOf(path.join(pd, "temp_kf_end.png"), W, H), me = rgbOf(movie, W, H, 3.2);
      const dMid = meanDiff(cm, mm), dEnd = meanDiff(ce, me), dMove = meanDiff(cm, ce);
      check("COMPILE = CANVAS in the middle of the tween (mean difference per channel under 8)", dMid < 8, Math.round(dMid * 100) / 100);
      check("...and after the last keyframe", dEnd < 8, Math.round(dEnd * 100) / 100);
      check("...and the two moments really differ (it moved)", dMove > 3, Math.round(dMove * 100) / 100);
      // the picture's opacity half way: at 1.5 s, op = 1 + (0.2 - 1) * (1 / 2.5) = 0.68 over green
      const at = (buf, x, y) => { const i = (y * W + x) * 3; return [buf[i], buf[i + 1], buf[i + 2]]; };
      const yAt = Math.round(180 + KF.value([{ at: 0.5, y: 100 }, { at: 3, y: -100 }], 1.5, "y", 0));
      const bl = at(mm, 320 + 220, yAt), cb = at(cm, 320 + 220, yAt);
      check("...the picture's tweened opacity and position: the same blue-over-green in both", Math.abs(bl[2] - cb[2]) <= 14 && bl[2] > 120 && bl[2] < 230, [bl, cb]);
      // a SQUARE picture stays square (2.379.0: scale2ref's h=-1 used to squash every picture to the frame's 16:9)
      const tall = (buf) => { let n = 0; for (let y = 0; y < H; y++) { const i = (y * W + 540) * 3; if (buf[i + 2] > 120 && buf[i + 1] < 120) n++; } return n; };
      check("...a square picture stays square in the compile (120 px tall, as on the canvas)", Math.abs(tall(mm) - 120) <= 4 && Math.abs(tall(cm) - 120) <= 4, [tall(mm), tall(cm)]);
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
