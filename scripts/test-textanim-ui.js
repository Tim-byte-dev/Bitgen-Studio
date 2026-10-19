#!/usr/bin/env node
/* bitGen Studio — 2.493.0 in a REAL browser: TEXT ANIMATORS (ext/timelinedock/tltextanim.js) - a Typewriter preset, a
 * custom per-word animator, every letter on its own on the canvas, baked and compiled (COMPILE = CANVAS).
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested. we a getting close to building a fully featured professional app"
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_ta493). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the text animators browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_ta493";
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
    ff(["-f", "lavfi", "-i", "color=c=0x203040:s=640x360:r=24:d=3", "-f", "lavfi", "-i", "sine=frequency=330:duration=3",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "ta_base.webm")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlTextAnim, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "ta_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = []; tl.audio = []; tl.images = []; tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0); await p.waitForTimeout(400);
    await p.evaluate(async () => {
      TlCanvas.addText({ x: 320, y: 180 });
      const c = tl.images[tl.images.length - 1].clips[0];
      const ta = document.getElementById("tlpText"); ta.value = "HELLO WORLD"; ta.dispatchEvent(new Event("input"));
      const sz = document.getElementById("tlpSize"); sz.value = "60"; sz.dispatchEvent(new Event("input"));
      const col = document.getElementById("tlpColor"); col.value = "#ffffff"; col.dispatchEvent(new Event("input"));
      c.len = 3; tlSave(); await new Promise((ok) => setTimeout(ok, 300)); TlCanvas.paintProps();
    });
    await p.waitForTimeout(300);
    const ui = await p.evaluate(() => ({ add: !!document.getElementById("tlpTaAdd"), presets: Array.from(document.querySelectorAll("#tlpTaPreset option")).map((o) => o.value) }));
    check("✨ Text Animators in the text's Properties: ＋ Animator and the presets", ui.add && ["", "typewriter", "fadeup", "popin", "slidein", "wave", "blurin"].every((k) => ui.presets.includes(k)), ui);
    await p.selectOption("#tlpTaPreset", "typewriter"); await p.click("#tlpTaAdd"); await p.waitForTimeout(300);
    const tw = await p.evaluate(() => { const c = tl.images[0].clips[0]; return { anim: c.text.anim, keys: (c.kf || []).filter((k) => k.ta0_start != null).map((k) => [k.at, k.ta0_start]) }; });
    check("Typewriter: an opacity-0 animator, its range start keyed 0 → 100 % over 2 s", tw.anim.length === 1 && tw.anim[0].op === 0 && tw.keys.length === 2 && tw.keys[1][0] === 2 && tw.keys[1][1] === 100, tw);
    const lit = (t) => p.evaluate((t) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const x = g.getContext("2d"); TlCanvas.paintComp(x, t); const d = x.getImageData(0, 0, 640, 360).data; let n = 0, xmax = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) { n++; xmax = Math.max(xmax, (i / 4) % 640); } return { n, xmax }; }, t);
    const t0 = await lit(0), t1 = await lit(1), t2 = await lit(2.5);
    check("on the canvas: nothing typed at the start, the first half by 1 s (it ends half way along), all of it after 2 s", t0.n < 30 && t1.n > 200 && t1.n < t2.n * 0.7 && t1.xmax < 330 && t2.xmax > 420, { t0, t1, t2 });
    // a custom per-word animator: words come up from below, keyed by its offset
    await p.selectOption("#tlpTaPreset", ""); await p.click("#tlpTaAdd"); await p.waitForTimeout(300);
    await p.evaluate(() => { const set = (sel, v, ev) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event(ev || "input")); el.dispatchEvent(new Event("change")); }; set('[data-tas="1:based"]', "words", "change"); set('[data-ta="1:y"]', "80"); set('[data-ta="1:end"]', "50"); });
    await p.waitForTimeout(300);
    const wd = await p.evaluate(() => { const c = tl.images[0].clips[0]; return { a: c.text.anim[1], pic: TlTextAnim.picture(c, 2.5).height }; });
    check("a custom animator by words (y 80 on the first half = the first word lower)", wd.a.based === "words" && wd.a.y === 80 && wd.a.end === 50 && wd.pic > 100, wd);
    const gr = await p.evaluate(() => { TlGraph.open(tl.images[0].clips[0]); const o = Array.from(document.querySelectorAll("#tgProp option")).map((x) => x.textContent); TlGraph.close(); return o; });
    check("the 📈 Graph Editor lists the animator's keyed start", gr.some((t) => /Text 1 start/.test(t)), gr);
    // the compile
    const shot = async (t) => { await goT(t); await p.waitForTimeout(500); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_ta_1.png"), await shot(1)); fs.writeFileSync(path.join(pd, "temp_ta_2.png"), await shot(2.5));
    await p.evaluate(() => TlCanvas.flushText());
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 180000 });
    await p.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); document.getElementById("tlExport").click(); });
    const job = await (await resp).json();
    const bk = await p.evaluate(() => tl.images[0].clips[0].bake);
    let stt = "", log = [];
    for (let i = 0; i < 150 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile: the animated text baked by the page and overlaid", /^tlb_u[a-z0-9]+\.webm$/.test(bk || "") && stt === "done" && fs.existsSync(movie) && log.some((l) => /a baked layer/.test(l)), [bk, stt, log.slice(-5)]);
    if (stt === "done") {
      const W = 640, H = 360, d1 = meanDiff(rgbOf(path.join(pd, "temp_ta_1.png"), W, H), rgbOf(movie, W, H, 1)), d2 = meanDiff(rgbOf(path.join(pd, "temp_ta_2.png"), W, H), rgbOf(movie, W, H, 2.5));
      check("COMPILE = CANVAS for a typewriter + a per-word animator (mean difference under 6, two moments)", d1 < 6 && d2 < 6, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 600));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
