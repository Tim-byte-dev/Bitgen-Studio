#!/usr/bin/env node
/* bitGen Studio — 2.492.0 in a REAL browser: SHAPE LAYERS + OPERATORS (ext/timelinedock/tlshape.js) - drawn with the ◆
 * tool, edited in the Properties, an animated Trim Paths + a Repeater, baked and compiled (COMPILE = CANVAS).
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested. we a getting close to building a fully featured professional app"
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_sh492). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the shape layers browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_sh492";
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
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "sh_base.webm")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlShape, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "sh_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = []; tl.audio = []; tl.images = []; tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0); await p.waitForTimeout(500);
    // ◆ the Shape tool: drag a box
    const tb = await p.evaluate(() => !!document.getElementById("tlTool_shape"));
    await p.click("#tlTool_shape");
    const r0 = await p.evaluate(() => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), a = TlCanvas.toScreen(220, 120), z = TlCanvas.toScreen(420, 240); return { ax: r.left + a.x, ay: r.top + a.y, zx: r.left + z.x, zy: r.top + z.y }; });
    await p.mouse.move(r0.ax, r0.ay); await p.mouse.down(); await p.mouse.move(r0.zx, r0.zy, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
    const made = await p.evaluate(() => { const L = tl.images[tl.images.length - 1], c = L && L.clips[0]; return c && { name: L.name, kind: c.shape && c.shape.kind, w: c.shape && c.shape.w, h: c.shape && c.shape.h, tf: c.tf, tool: TlCanvas.state.tool }; });
    check("◆ Shape tool (Q): a dragged 200 x 120 box makes 'Shape 1' there (a rectangle), then back to Move", tb && made && made.name === "Shape 1" && made.kind === "rect" && Math.abs(made.w - 200) <= 2 && Math.abs(made.h - 120) <= 2 && Math.abs(made.tf.x) <= 1 && Math.abs(made.tf.y) <= 1 && made.tool === "move", made);
    const props = await p.evaluate(() => ({ kind: !!document.getElementById("tlpShKind"), ops: Array.from(document.querySelectorAll(".tlp-shape [data-shb]")).map((e) => e.dataset.shb) }));
    check("the Properties: kind, fill (gradient), stroke and the 8 operators", props.kind && ["grad", "trim", "rep", "offset", "pucker", "twist", "zig", "wig", "round"].every((k) => props.ops.includes(k)), props);
    // an ellipse, red, a white stroke
    await p.selectOption("#tlpShKind", "ellipse"); await p.waitForTimeout(200);
    await p.evaluate(() => { const set = (sel, v) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); }; set('.tlp-shape [data-shc="fill"]', "#ff2020"); set('.tlp-shape [data-shc="stroke"]', "#ffffff"); set('.tlp-shape [data-sh="strokeW"]', "8"); });
    // Trim Paths, keyed 0 % -> 100 % over 2 s
    await p.evaluate(() => { const el = document.querySelector('.tlp-shape [data-shb="trim"]'); el.checked = true; el.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(200);
    await p.evaluate(() => { const el = document.querySelector('.tlp-shape [data-sh="tend"]'); el.value = "0"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); });
    await p.click('.tlp-shape [data-shk="tend"]'); await p.waitForTimeout(200);
    await goT(2); await p.waitForTimeout(300);
    await p.evaluate(() => { TlCanvas.paintProps(); const el = document.querySelector('.tlp-shape [data-sh="tend"]'); el.value = "100"; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(200);
    const tr = await p.evaluate(() => { const c = tl.images[0].clips[0]; return { keys: (c.kf || []).filter((k) => k.sh_tend != null).map((k) => [k.at, k.sh_tend]), mid: TlShape.at(c, 1).tend, kind: c.shape.kind }; });
    check("Trim Paths keyed with ◇: end 0 % at the start, 100 % at 2 s (auto-keyed) - 50 % half way", tr.keys.length === 2 && tr.keys[0][1] === 0 && tr.keys[1][1] === 100 && Math.abs(tr.mid - 50) < 0.01 && tr.kind === "ellipse", tr);
    const g = await p.evaluate(() => { TlGraph.open(tl.images[0].clips[0]); return Array.from(document.querySelectorAll("#tgProp option")).map((o) => o.textContent); });
    check("the 📈 Graph Editor lists the keyed shape number", g.some((t) => /Shape tend/.test(t)), g);
    await p.evaluate(() => TlGraph.close());
    // a Repeater: 3 copies 150 px apart
    await goT(2.5);
    await p.evaluate(() => { const el = document.querySelector('.tlp-shape [data-shb="rep"]'); el.checked = true; el.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(200);
    await p.evaluate(() => { const set = (k, v) => { const el = document.querySelector('.tlp-shape [data-sh="' + k + '"]'); el.value = v; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); }; set("rcopies", "3"); set("rx", "150"); set("roffset", "-1"); set("rscale", "80"); });
    await p.waitForTimeout(300);
    const pic = await p.evaluate(() => { const c = tl.images[0].clips[0], cv = TlShape.picture(c, 2.5), g2 = document.createElement("canvas"); g2.width = 640; g2.height = 360; const x = g2.getContext("2d"); TlCanvas.paintComp(x, 2.5); const at = (a, b2) => Array.from(x.getImageData(a, b2, 1, 1).data).slice(0, 3); return { w: cv.width, left: at(320 - 150, 180), mid: at(320, 180), right: at(320 + 150, 180) }; });
    check("Repeater: three ellipses - left, middle and right copies drawn (the picture grows to hold them)", pic.w > 500 && pic.left[0] > 150 && pic.mid[0] > 150 && pic.right[0] > 150 && pic.mid[2] < 120, pic);
    const early = await p.evaluate(() => { const g2 = document.createElement("canvas"); g2.width = 640; g2.height = 360; const x = g2.getContext("2d"); TlCanvas.paintComp(x, 0); const d = x.getImageData(0, 0, 640, 360).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150) n++; return n; });
    check("at the start the trim is 0 %: nothing of the shape is drawn yet", early < 50, early);
    // the compile
    const shot = async (t) => { await goT(t); await p.waitForTimeout(500); await goT(t); await p.waitForTimeout(300); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_sh_1.png"), await shot(1)); fs.writeFileSync(path.join(pd, "temp_sh_2.png"), await shot(2.5));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 180000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    const bk = await p.evaluate(() => tl.images[0].clips[0].bake);
    let stt = "", log = [];
    for (let i = 0; i < 150 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile: the shape layer baked by the page (video/tlb_<id>.webm) and overlaid", /^tlb_u[a-z0-9]+\.webm$/.test(bk || "") && stt === "done" && fs.existsSync(movie) && log.some((l) => /a baked layer/.test(l)), [bk, stt, log.slice(-5)]);
    if (stt === "done") {
      const W = 640, H = 360, d1 = meanDiff(rgbOf(path.join(pd, "temp_sh_1.png"), W, H), rgbOf(movie, W, H, 1)), d2 = meanDiff(rgbOf(path.join(pd, "temp_sh_2.png"), W, H), rgbOf(movie, W, H, 2.5));
      check("COMPILE = CANVAS for an animated trim and a repeater (mean difference under 6, two moments)", d1 < 6 && d2 < 6, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
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
