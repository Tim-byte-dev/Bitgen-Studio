#!/usr/bin/env node
/* bitGen Studio — 2.516.0 in a REAL browser: ◇ KEYFRAMES ON ANY PROPERTY (static/anykeys.js, ext/timelinedock/tlanykey.js).
 * Tim (verbatim): "finish the last row" - AFTER-EFFECTS-GAP.md: "Keyframes on any property ... every effect setting, mask
 * points, text settings left". A text's size keyed with its ◇ (and keyed again by changing it later on), V1's colour
 * (exposure) and lens keyed, a video layer's mask feather keyed - the canvas moves them, the 📈 graph editor lists them,
 * and ⚙ Compile draws the same frames (the text baked by the page, the look cross-faded, the lens by command, the mask
 * video made by the page). Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.516 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_ak516";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const rgbAt = (file, w, h, at) => execFileSync("ffmpeg", ["-loglevel", "error"].concat(at != null ? ["-ss", String(at)] : []).concat(["-i", file, "-frames:v", "1", "-vf", `scale=${w}:${h}:flags=neighbor`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]), { maxBuffer: 64 * 1024 * 1024 });
const meanDiff = (A, B) => { let d = 0; for (let i = 0; i < A.length; i++) d += Math.abs(A[i] - B[i]); return d / A.length; };
const mean = (A) => { let s = 0; for (let i = 0; i < A.length; i++) s += A[i]; return s / A.length; };
/** the mean of a box of a w-wide rgb24 picture (V1 alone there: left of the layer, above the text) */
const boxMean = (A, w, x0, y0, x1, y1) => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 3; s += A[i] + A[i + 1] + A[i + 2]; n += 3; } return s / n; };

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const pd = path.join(ROOT, "projects", P);
  try {
    await api("/api/projects/load", { name: P });
    fs.mkdirSync(path.join(pd, "video"), { recursive: true });
    const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
    ff(["-f", "lavfi", "-i", "color=c=0x707070:s=640x360:r=24:d=3,drawgrid=w=80:h=80:t=2:c=0x303030", "-f", "lavfi", "-i", "sine=frequency=330:duration=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "24", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(pd, "video", "ak_v1.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0xe0e040:s=320x180:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "24", "-deadline", "realtime", path.join(pd, "video", "ak_lay.webm")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlAnyKey && TlAnyKey.ready && window.H3AnyKeys && window.TlGraph && window.TlMask && TlMask.ready, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      delete tl.cam3; delete tl.frame;
      tl.video = [{ name: "ak_v1.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = [mkLayer("Lay", [{ name: "ak_lay.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1, uid: "ulay516", tf: { x: 150, y: 80, scale: 1, rot: 0 },
        masks: [{ on: true, mode: "add", feather: 0, expand: 0, op: 100, inv: false, closed: true, pts: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]].map((q) => ({ x: q[0], y: q[1], ix: q[0], iy: q[1], ox: q[0], oy: q[1] })) }] }])];
      tl.images = []; tl.audio = [];
      tlSave(); renderTimeline();
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => ev((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    const props = () => p.waitForTimeout(450);

    /* 1. a text's size: ◇ at 0 s (40 px), changed at 2 s (120 px) = a second key by itself */
    await goT(0);
    await ev(() => { TlCanvas.addText({ x: 200, y: 260 }); const c = tl.images[tl.images.length - 1].clips[0]; c.start = 0; c.len = 3; c.text.size = 40; c.text.content = "KEY"; TlCanvas.paintProps(); });
    await props();
    const sb = await p.$('[data-akey="text.size"]');
    check("◇ beside the text's size (and its outline, posterize time ...) in the Properties", !!sb, await ev(() => [...document.querySelectorAll("[data-akey]")].map((x) => x.getAttribute("data-akey"))));
    await p.click('[data-akey="text.size"]'); await p.waitForTimeout(200);
    await goT(2); await ev(() => TlCanvas.paintProps()); await props();
    await ev(() => { const x = document.getElementById("tlpSize"); x.value = "120"; x.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.waitForTimeout(300);
    const tk = await ev(() => { const c = tl.images[tl.images.length - 1].clips[0], ks = (c.kf || []).filter((k) => k["@text.size"] != null); const h = (t) => TlCanvas.box(c, "img", t).h; return { ks: ks.map((k) => [k.at, k["@text.size"]]), h0: 0, graph: !!(window.TlGraph && TlGraph.state) }; });
    const hs = await ev(() => { const c = tl.images[tl.images.length - 1].clips[0], out = []; for (const t of [0.1, 1, 1.9]) { const u = H3AnyKeys.apply(c, t, H3Keyframes); out.push(TlCanvas.box(c, "img", t).h); u(); } return out; });
    check("the size keyed: 40 at 0 s (◇), 120 at 2 s (changed there = keyed there); the text grows on the canvas in between",
      tk.ks.length === 2 && tk.ks[0][0] === 0 && tk.ks[0][1] === 40 && Math.abs(tk.ks[1][0] - 2) < 0.05 && tk.ks[1][1] === 120 && hs[0] < hs[1] && hs[1] < hs[2], { tk, hs });
    const gp = await ev(() => { const c = tl.images[tl.images.length - 1].clips[0]; TlCanvas.select(c, { lk: "i:" + (tl.images.length - 1) }); TlGraph.open && TlGraph.open(); const s = document.getElementById("tgProp"); return s ? [...s.options].map((o) => o.value) : []; });
    check("📈 the graph editor lists the keyed setting (@text.size)", gp.includes("@text.size"), gp);
    await ev(() => { if (TlGraph.close) TlGraph.close(); });

    /* 2. V1's exposure keyed (-1.5 at 0 s -> +1 at 2 s) and its lens (0 -> 60) */
    await goT(0);
    await ev(() => { TlCanvas.select(tl.video[0], { lk: "v1" }); TlCanvas.paintProps(); });
    await props();
    const v1b = await ev(() => ({ exp: !!document.querySelector('[data-akey="fx.grade.exposure"]'), lens: !!document.querySelector('[data-akey="fx.vfx.lens"]'), mask: !!document.querySelector('[data-akey^="masks."]') }));
    await ev(() => { const c = tl.video[0]; TlAnyKey.keyAt(c, "fx.grade.exposure", -1.5); TlAnyKey.keyAt(c, "fx.vfx.lens", 0); TlCanvas.state.t = 2; TlAnyKey.keyAt(c, "fx.grade.exposure", 1); TlAnyKey.keyAt(c, "fx.vfx.lens", 60); TlCanvas.state.t = 0; tlSave(); TlCanvas.mark(); });
    check("V1: ◇ on its colour (exposure) and its lens, none on masks (V1 has none)", v1b.exp && v1b.lens && !v1b.mask, v1b);

    /* 3. the video layer's mask feather keyed (0 -> 40 px) */
    await ev(() => { const c = tl.vlayers[0].clips[0]; TlCanvas.select(c, { lk: "vl:0" }); TlCanvas.paintProps(); });
    await props();
    const mb = await ev(() => !!document.querySelector('[data-akey="masks.0.feather"]'));
    await ev(() => { const c = tl.vlayers[0].clips[0]; TlCanvas.state.t = 0; TlAnyKey.keyAt(c, "masks.0.feather", 0); TlCanvas.state.t = 2; TlAnyKey.keyAt(c, "masks.0.feather", 40); TlCanvas.state.t = 0; tlSave(); TlCanvas.mark(); });
    check("a video layer's mask: ◇ on its feather / expansion / opacity", mb);

    /* 4. the canvas moves them; ⚙ Compile draws the same */
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(1000); await goT(t); await p.waitForTimeout(400); return Buffer.from((await ev(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    const T = [0.25, 1, 1.75];
    for (const t of T) fs.writeFileSync(path.join(pd, `temp_ak_${t}.png`), await snapAt(t));
    const cv = T.map((t) => rgbAt(path.join(pd, `temp_ak_${t}.png`), 320, 180));
    const vb = cv.map((A) => boxMean(A, 320, 100, 30, 140, 55));
    check("the canvas: V1 brighter as its exposure key rises (0.25 s < 1 s < 1.75 s where only V1 shows)", vb[0] + 10 < vb[1] && vb[1] + 10 < vb[2], vb);
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 240000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 400 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    const bk = await ev(() => ({ tb: tl.images[tl.images.length - 1].clips[0].bake, mb: tl.vlayers[0].clips[0].mbake }));
    check("before the compile: the keyed text baked by the page, the keyed mask's video made", /^tlb_/.test(bk.tb || "") && /^tlb_/.test(bk.mb || ""), bk);
    if (stt === "done" && fs.existsSync(movie)) {
      const mv = T.map((t) => rgbAt(movie, 320, 180, t)), d = T.map((t, i) => Math.round(meanDiff(cv[i], mv[i]) * 100) / 100);
      check("⚙ Compile: the look cross-faded (\"the look keyed\") and the lens by command (\"lens keyed\") in the log", log.some((l) => /look keyed/.test(l)) && log.some((l) => /lens keyed/.test(l)), log.filter((l) => /keyed|effect/.test(l)).slice(-6));
      const mb2 = mv.map((A) => boxMean(A, 320, 100, 30, 140, 55));
      check("COMPILE = CANVAS at 0.25 / 1 / 1.75 s (keyed exposure + lens on V1, a keyed text size, a keyed mask feather): mean difference under 9", d.every((x) => x < 9) && mb2[0] + 10 < mb2[1] && mb2[1] + 10 < mb2[2], { d, v1: mb2 });
    } else check("⚙ Compile finished", false, [stt, log.slice(-8)]);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
