#!/usr/bin/env node
/* bitGen Studio — 2.501.0: ⏱ TIME REMAPPING ON A CURVE in a REAL browser against the REAL app.
 * Tim: "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on)..".
 *   1. a V1 clip's 🎬 Speed has ⏱ Time remap; on = 2 keys that play it as it is (speed / reverse / ramp off)
 *   2. ❄ Freeze at the playhead: the clip 1 s longer, the canvas holds that frame through it
 *   3. dragging a key on the curve: it moves (the clip's length = the last key's time); the key row shows it;
 *      double-click adds a key, double-click on it removes it
 *   4. a falling stretch plays backwards on the canvas
 *   5. ⚙ Compile sends the remap; the compiled frames = the canvas's at the same moments; it lasts as long; no page errors
 * Run against the running app (H3_URL, default :8311). No Playwright = SKIP (exit 0). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the time remap browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_remapui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "remapui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=30:d=4,geq=lum='20+50*T':cb=128:cr=128", "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-shortest", path.join(T, "rmbase.webm")]);
const lumAt = (f, t) => { const b = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "scale=32:18,format=rgb24", "-f", "rawvideo", "-"]); let s = 0; for (let i = 0; i < b.length; i += 3) s += b[i]; return s / (b.length / 3); };

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, "rmbase.webm"))]), "rmbase.webm");
    await fetch(URL_ + "api/passets", { method: "POST", body: fd });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlCanvas && window.TlClipFx && window.TlRemap && window.H3ClipFx && window.TlCanvas.snapshot, null, { timeout: 30000 });
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "rmbase.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = []; delete tl.mix; delete tl.captions;
      tlSave(); renderTimeline();
      window.__c = tl.video[0];
      TlCanvas.select(__c, TlCanvas.layerOf(__c));
    });
    await p.waitForFunction(() => document.getElementById("tfxSpeed"), null, { timeout: 15000 });
    await p.evaluate(() => { document.getElementById("tfxSpeed").open = true; });
    await new Promise((r) => setTimeout(r, 200));
    const shot = async (t) => p.evaluate(async (t) => {
      TlCanvas.go(t);
      const c = __c, want = TlCanvas.srcAt(c, t);
      for (let i = 0; i < 80; i++) {
        TlCanvas.draw();
        const bx = TlCanvas.box(c, "v1", t), v = bx && bx.src;
        if (v && v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - want) < 0.05) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 150));
      const url = TlCanvas.snapshot(), im = new Image(); im.src = url; await im.decode();
      const cv = document.createElement("canvas"); cv.width = 32; cv.height = 18;
      const g = cv.getContext("2d"); g.drawImage(im, 0, 0, 32, 18);
      const d = g.getImageData(0, 0, 32, 18).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i];
      return s / (d.length / 4);
    }, t);

    /* ---- 1. on */
    await p.evaluate(() => { __c.fx = { speed: 2 }; tlSave(); renderTimeline(); TlCanvas.paintProps(); });
    const has = await p.evaluate(() => !!document.getElementById("tfxRmOn") && !document.getElementById("tfxRmCv"));
    check("🎬 Speed has ⏱ Time remap (off: no curve)", has);
    await p.evaluate(() => { const i = document.getElementById("tfxRmOn"); i.checked = true; i.dispatchEvent(new Event("change")); });
    const on = await p.evaluate(() => ({ fx: __c.fx, eff: effDur(__c), cv: !!document.getElementById("tfxRmCv"), sp: document.getElementById("tfxSp").disabled, rv: document.getElementById("tfxRev").disabled, rp: document.getElementById("tfxRamp").disabled, src: TlCanvas.srcAt(__c, 1) }));
    check("on: 2 keys that play it as it was (2 s showing 4 s of source), speed / reverse / ramp off, the curve shown",
      on.fx.remap && on.fx.remap.length === 2 && near(on.fx.remap[1].t, 2) && near(on.fx.remap[1].q, 4) && !on.fx.speed && near(on.eff, 2) && near(on.src, 2) && on.cv && on.sp && on.rv && on.rp, on);

    /* ---- 2. freeze */
    await p.evaluate(() => { TlCanvas.go(1); const i = document.getElementById("tfxRmFrzD"); i.value = "1"; i.dispatchEvent(new Event("input")); document.getElementById("tfxRmFrz").click(); });
    const fz = await p.evaluate(() => ({ rm: __c.fx.remap, eff: effDur(__c), a: TlCanvas.srcAt(__c, 1.2), b: TlCanvas.srcAt(__c, 1.9), c: TlCanvas.srcAt(__c, 2.5) }));
    check("❄ Freeze at 1 s: a flat stretch 1-2 s (source 2 s held), the clip 3 s long, the rest later", fz.rm.length === 4 && near(fz.eff, 3) && near(fz.a, 2) && near(fz.b, 2) && near(fz.c, 3), fz);
    const f1 = await shot(1.2), f2 = await shot(1.9), f3 = await shot(2.7);
    check("❄ the canvas holds the frame through the freeze, then plays on", Math.abs(f1 - f2) < 3 && f3 > f2 + 20, [f1, f2, f3]);

    /* ---- 3. the curve */
    await p.evaluate(() => TlCanvas.paintProps());
    const box = await p.evaluate(() => { const el = document.getElementById("tfxRmCv"); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const kxy = await p.evaluate(() => { const rm = __c.fx.remap, W = 240, H = 110, P = 8, Tm = Math.max(0.5, rm[rm.length - 1].t * 1.15), L = 4; const k = rm[3]; return { x: P + k.t / Tm * (W - 2 * P), y: H - P - k.q / L * (H - 2 * P), W, H }; });
    const sx = box.w / kxy.W, sy = box.h / kxy.H;
    await p.mouse.move(box.x + kxy.x * sx, box.y + kxy.y * sy);
    await p.mouse.down();
    await p.mouse.move(box.x + (kxy.x + 30) * sx, box.y + (kxy.y + 40) * sy, { steps: 6 });
    await p.mouse.up();
    const dg = await p.evaluate(() => ({ rm: __c.fx.remap, eff: effDur(__c), t: document.getElementById("tfxRmT").value, q: document.getElementById("tfxRmQ").value }));
    check("dragging the last key: later + an earlier source second; the clip's length = its time; the key row shows it",
      dg.rm[3].t > 3.1 && dg.rm[3].q < 3.6 && near(dg.eff, dg.rm[3].t) && near(+dg.t, dg.rm[3].t) && near(+dg.q, dg.rm[3].q), dg);
    const mid = await p.evaluate(() => { const rm = __c.fx.remap, Tm = Math.max(0.5, rm[rm.length - 1].t * 1.15); return { x: 8 + 0.5 * (240 - 16) / Tm, y: 110 - 8 - 3.5 / 4 * (110 - 16) }; });
    await p.mouse.dblclick(box.x + mid.x * sx, box.y + mid.y * sy);
    const ad = await p.evaluate(() => __c.fx.remap);
    check("double-click on the curve adds a key there (0.5 s showing about 3.5 s)", ad.length === 5 && near(ad[1].t, 0.5, 0.05) && near(ad[1].q, 3.5, 0.1), ad);
    await p.mouse.dblclick(box.x + mid.x * sx, box.y + mid.y * sy);
    const rmv = await p.evaluate(() => __c.fx.remap);
    check("double-click on a key removes it", rmv.length === 4, rmv);

    /* ---- 4. backwards */
    await p.evaluate(() => { __c.fx = H3ClipFx.normalize({ remap: [{ t: 0, q: 0 }, { t: 1, q: 3 }, { t: 3, q: 0.5 }] }); tlSave(); renderTimeline(); TlCanvas.paintProps(); });
    const b1 = await shot(1.2), b2 = await shot(2.6);
    check("a falling stretch plays backwards on the canvas (darker later)", b1 > b2 + 25, [b1, b2]);

    /* ---- 5. compile */
    const cv = [await shot(0.5), await shot(1.5), await shot(2.5)];
    let sent = null;
    await p.route("**/api/export", async (route) => { sent = JSON.parse(route.request().postData() || "{}"); await route.continue(); });
    const answered = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 20000 }).catch(() => null);
    await p.evaluate(() => document.getElementById("tlExport").click());
    const ar = await answered;
    const job = ar ? await ar.json().catch(() => null) : null;
    check("⚙ Compile sends the remap", sent && sent.video[0].fx && sent.video[0].fx.remap && sent.video[0].fx.remap.length === 3, sent && sent.video);
    let st = "", out = "";
    for (let i = 0; i < 180 && job; i++) { const g = await api("/api/jobs/" + job.id); st = g.status; out = g.output; if (st === "done" || st === "failed") break; await new Promise((r) => setTimeout(r, 1000)); }
    const file = out ? path.join(ROOT, "projects", P, out) : "";
    check("⚙ Compile: done", st === "done" && fs.existsSync(file), { st, out });
    if (st === "done") {
      const m = [lumAt(file, 0.5), lumAt(file, 1.5), lumAt(file, 2.5)];
      const dur = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
      check("the compiled frames = the canvas's (within 10 levels) and it lasts 3 s", m.every((v, i) => Math.abs(v - cv[i]) < 10) && near(dur, 3, 0.1), { compile: m, canvas: cv, dur });
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
