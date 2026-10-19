#!/usr/bin/env node
/* bitGen Studio — 2.505.0 in a REAL browser: 🌫 GENERATOR LAYERS and 〰 DISTORT (ext/timelinedock/tlgen.js, tldist.js).
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).."
 *   1. the 🌫 tool: a click makes a fractal noise layer over the frame, a drag a gradient ramp (dark -> light along it)
 *   2. 🌫 Generator in the Properties: changing the scale changes the picture; the noise moves by itself (evolution)
 *   3. 〰 Turbulent displace on a VIDEO layer moves its pixels; 〰 Displacement map on a picture from the noise layer
 *   4. ⚙ Compile: the generators + the distorted picture baked, the video layer's two map videos baked (lossless) and
 *      laid on with ffmpeg displace - COMPILE = CANVAS at two moments
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_gn505). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the generator / distort browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_gn505";
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
    ff(["-f", "lavfi", "-i", "color=c=0x404040:s=640x360:r=24:d=3", "-f", "lavfi", "-i", "sine=frequency=330:duration=3",
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "gn_base.webm")]);
    ff(["-f", "lavfi", "-i", "testsrc2=s=320x180:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "12", "-deadline", "realtime", path.join(pd, "video", "gn_wave.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=white:s=200x200", "-vf", "geq=r='255*mod(floor(X/20)+floor(Y/20),2)':g='60':b='255*mod(floor(X/20)+floor(Y/20)+1,2)'", "-frames:v", "1", path.join(pd, "images", "gn_check.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlGen && TlGen.ready && window.TlDist && TlDist.ready, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "gn_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [mkLayer("Wave", [{ name: "gn_wave.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, tf: { x: -150, y: 60, scale: 1, rot: 0 } }])];
      tl.audio = [];
      tl.images = [mkLayer("Check", [{ name: "gn_check.png", start: 0, len: 3, opacity: 1, tf: { x: 180, y: 60, scale: 1, rot: 0 } }])];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(1); await p.waitForTimeout(600);
    const scr = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
    const comp = (t) => p.evaluate((t) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(0, 0, 640, 360).data); }, t);
    const region = (px, x0, y0, x1, y1) => { const o = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 640 + x) * 4; o.push(px[i], px[i + 1], px[i + 2]); } return o; };
    const before = await comp(1);

    /* 1. the 🌫 tool */
    await p.evaluate(() => TlCanvas.setTool("gen"));
    const c0 = await scr(320, 180); await p.mouse.click(c0[0], c0[1]); await p.waitForTimeout(400);
    await p.evaluate(() => TlCanvas.setTool("gen"));
    const a = await scr(40, 30), z = await scr(600, 30); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(z[0], z[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
    const made = await p.evaluate(() => tl.images.map((L) => ({ n: L.name, gen: L.clips[0].gen, len: L.clips[0].len })));
    const noise = made.find((x) => x.gen && x.gen.kind === "fractal"), ramp = made.find((x) => x.gen && x.gen.kind === "ramp");
    check("🌫 tool: a click = a Fractal Noise layer, a drag = a Gradient Ramp from where it was pressed to where it was let go",
      noise && ramp && /Fractal Noise/.test(noise.n) && /Gradient Ramp/.test(ramp.n) && ramp.gen.x0 === -280 && ramp.gen.x1 === 280 && ramp.gen.y0 === -150, made);
    // both layers see-through so the rest shows: the noise at 40 %, the ramp at 35 %
    await p.evaluate(() => { tl.images.forEach((L) => { const c = L.clips[0]; if (c.gen && c.gen.kind === "fractal") c.opacity = 0.4; if (c.gen && c.gen.kind === "ramp") c.opacity = 0.35; }); tlSave(); TlCanvas.mark(); });
    const g1 = await comp(1);
    const top = region(g1, 0, 0, 640, 40);
    let leftL = 0, rightL = 0; for (let y = 0; y < 30; y++) { const i = (y * 640 + 50) * 4, j = (y * 640 + 590) * 4; leftL += g1[i]; rightL += g1[j]; }
    const vals = region(g1, 0, 300, 640, 360).filter((_, i) => i % 3 === 0), mean = vals.reduce((s, v) => s + v, 0) / vals.length, sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    check("the picture: the ramp brighter on the right than the left; the noise gives grain where the frame was flat grey", rightL > leftL + 30 * 25 && sd > 4, { leftL, rightL, sd, top: top.length });

    /* 2. 🌫 Generator in the Properties */
    await p.evaluate(() => { const L = tl.images.find((L) => L.clips[0].gen && L.clips[0].gen.kind === "fractal"); TlCanvas.select(L.clips[0], TlCanvas.layerOf(L.clips[0])); });
    await p.waitForTimeout(300);
    const props = await p.evaluate(() => ({ kind: !!document.getElementById("tlpGnKind"), scale: !!document.querySelector('[data-gn="scale"]'), keys: document.querySelectorAll("[data-gnk]").length }));
    const sa = await comp(1);
    await p.fill('[data-gn="scale"]', "30"); await p.dispatchEvent('[data-gn="scale"]', "input"); await p.waitForTimeout(200);
    const sb = await comp(1), sc = await comp(1.5);
    check("🌫 Generator: its kind, keyable settings; scale 30 changes the picture; it evolves by itself (1 s vs 1.5 s differ)",
      props.kind && props.scale && props.keys >= 10 && meanDiff(region(sa, 0, 300, 640, 360), region(sb, 0, 300, 640, 360)) > 1 && meanDiff(region(sb, 0, 300, 640, 360), region(sc, 0, 300, 640, 360)) > 1, props);

    /* 3. 〰 Distort */
    const wave0 = region(await comp(1), 20, 170, 300, 290);
    await p.evaluate(() => TlCanvas.select(tl.vlayers[0].clips[0], TlCanvas.layerOf(tl.vlayers[0].clips[0]))); await p.waitForTimeout(300);
    await p.selectOption("#tlpDsKind", "turb"); await p.waitForTimeout(300);
    await p.fill('[data-ds="amount"]', "18"); await p.dispatchEvent('[data-ds="amount"]', "input"); await p.waitForTimeout(200);
    const wave1 = region(await comp(1), 20, 170, 300, 290);
    const dv = await p.evaluate(() => tl.vlayers[0].clips[0].dist);
    check("〰 Turbulent displace on the video layer: stored (amount 18) and its pixels move", dv && dv.kind === "turb" && dv.amount === 18 && meanDiff(wave0, wave1) > 3, { dv, d: meanDiff(wave0, wave1) });
    const chk0 = region(await comp(1), 400, 170, 600, 330);
    await p.evaluate(() => TlCanvas.select(tl.images[0].clips[0], TlCanvas.layerOf(tl.images[0].clips[0]))); await p.waitForTimeout(300);
    await p.selectOption("#tlpDsKind", "map"); await p.waitForTimeout(300);
    const nuid = await p.evaluate(() => tl.images.find((L) => L.clips[0].gen && L.clips[0].gen.kind === "fractal").clips[0].uid);
    await p.selectOption("#tlpDsSrc", nuid); await p.waitForTimeout(300);
    const chk1 = region(await comp(1), 400, 170, 600, 330);
    check("〰 Displacement map on the picture, from the fractal noise layer: its squares bend", meanDiff(chk0, chk1) > 3, meanDiff(chk0, chk1));

    /* 4. the compile */
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_gn_1.png"), await snapAt(1)); fs.writeFileSync(path.join(pd, "temp_gn_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 300000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 400 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    const baked = await p.evaluate(() => ({ imgs: tl.images.map((L) => !!L.clips[0].bake), maps: tl.vlayers[0].clips[0].dbake }));
    check("⚙ Compile finished: the generators + the distorted picture baked, the video layer's two map videos made and laid on (displace)",
      stt === "done" && fs.existsSync(movie) && baked.imgs.every(Boolean) && baked.maps && /^tlb_.*_dmx\.webm$/.test(baked.maps.x) && log.some((l) => /its distortion \(the maps/.test(l)), [stt, baked, log.slice(-6)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_gn_1.png"), W, H), m1 = rgbOf(movie, W, H, 1), c2 = rgbOf(path.join(pd, "temp_gn_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      const reg = (A, B, x0, y0, x1, y1) => { let d = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 3; for (let k = 0; k < 3; k++) { d += Math.abs(A[i + k] - B[i + k]); n++; } } return d / n; };
      check("COMPILE = CANVAS at 1 s and 2 s (noise, ramp, a displaced video, a displacement-mapped picture): mean difference under 7", d1 < 7 && d2 < 7, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
      check("…the displaced video's own area under 12 at 2 s (its pixels moved the same way)", reg(c2, m2, 30, 180, 290, 280) < 12, Math.round(reg(c2, m2, 30, 180, 290, 280) * 100) / 100);
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
