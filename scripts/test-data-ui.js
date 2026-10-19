#!/usr/bin/env node
/* bitGen Studio — 2.511.0 in a REAL browser: ✒ VARIABLE MASK FEATHER, 📋 DATA-DRIVEN ANIMATION and TEMPLATE FIELDS (tlmask.js, tldata.js).
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" (steps 5 and 6: variable mask feather; data from CSV / JSON, exposed template fields)
 *   1. ✒ Mask Pen: Shift+drag a mask point = its own feather - that corner soft, the others sharp
 *   2. ⤓ a CSV imported; a text's {{sales.region}} follows the current row
 *   3. 📋 Data → keys: a column keyed onto x; 📋 Template fields: an exposed opacity changed from the list
 *   4. ⚙ Compile: COMPILE = CANVAS at two moments
 * Against the running app (H3_URL, default the e2e server on :8311), from the app folder (projects/e2e_dt511). No
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the data browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_dt511";
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
    ff(["-f", "lavfi", "-i", "color=c=0x202020:s=640x360:r=24:d=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-an", path.join(pd, "video", "dt_base.webm")]);
    ff(["-f", "lavfi", "-i", "color=c=0xf0f0f0:s=200x200:d=1", "-frames:v", "1", path.join(pd, "images", "dt_sq.png")]);
    ff(["-f", "lavfi", "-i", "testsrc=s=80x50:r=1:d=1", "-frames:v", "1", path.join(pd, "images", "dt_logo.png")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlData && TlData.ready && window.TlMask && TlMask.ready, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "dt_base.webm", src: "video", start: 0, dur: 3, in: 0, out: 3, opacity: 1 }];
      tl.vlayers = []; tl.audio = []; delete tl.data;
      const pt = TlMask.pt;
      const sq = { name: "dt_sq.png", start: 0, len: 3, opacity: 1, tf: { x: -150, y: -40, scale: 1, rot: 0 }, masks: [Object.assign({}, TlMask.DEFAULTS, { feather: 2, pts: [pt(0.1, 0.1), pt(0.9, 0.1), pt(0.9, 0.9), pt(0.1, 0.9)] })] };
      const tx = { start: 0, len: 3, opacity: 1, tid: "dt1", name: "text_dt1.png", text: { content: "{{sales.region}}: {{sales.amount}}", size: 40, color: "#ffffff", font: "Arial" }, tf: { x: 140, y: 110, scale: 1, rot: 0 } };
      const Lt = mkLayer("Label", [tx]); Lt.text = true;
      tl.images = [mkLayer("Square", [sq]), mkLayer("Logo", [{ name: "dt_logo.png", start: 0, len: 3, opacity: 1, tf: { x: 150, y: -100, scale: 1, rot: 0 } }]), Lt];
      tlSave(); renderTimeline(); TlCanvas.uploadText(tx);
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });
    const goT = (t) => p.evaluate((t) => { setPlayhead(t); TlCanvas.state.t = t; TlCanvas.draw(); TlCanvas.paintLayers(); }, t);
    await goT(0); await p.waitForTimeout(800);
    const scr = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(), s = TlCanvas.toScreen(x, y); return [r.left + s.x, r.top + s.y]; }, [x, y]);
    const comp = (t) => p.evaluate((t) => { const g = document.createElement("canvas"); g.width = 640; g.height = 360; const c = g.getContext("2d"); TlCanvas.paintComp(c, t); return Array.from(c.getImageData(0, 0, 640, 360).data); }, t);
    const soft = (px, x0, y0, x1, y1) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = px[(y * 640 + x) * 4]; if (v > 50 && v < 220) n++; } return n; };
    const pick = (i) => p.evaluate((i) => { const c = tl.images[i].clips[0]; TlCanvas.select(c, TlCanvas.layerOf(c)); }, i);

    /* 1. variable feather: Shift+drag the top-right point */
    await pick(0); await p.waitForTimeout(300);
    await p.evaluate(() => TlCanvas.setTool("maskpen"));
    const corner = await p.evaluate(() => { const c = tl.images[0].clips[0], b = TlCanvas.box(c, "img", 0); return [b.cx + 0.4 * b.w, b.cy - 0.4 * b.h]; });
    const s0 = await scr(corner[0], corner[1]), s1 = await scr(corner[0] + 30, corner[1] - 30);
    await p.keyboard.down("Shift"); await p.mouse.move(s0[0], s0[1]); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(s0[0] + (s1[0] - s0[0]) * k / 6, s0[1] + (s1[1] - s0[1]) * k / 6); await p.mouse.up(); await p.keyboard.up("Shift"); await p.waitForTimeout(500);
    const fe = await p.evaluate(() => tl.images[0].clips[0].masks[0].pts.map((q) => q.fe));
    const px0 = await comp(0);
    const cx = Math.round(corner[0]), cy = Math.round(corner[1]), ox = cx - 160, oy = cy + 160;
    const sTR = soft(px0, cx - 30, cy - 30, cx + 30, cy + 30), sBL = soft(px0, ox - 30, oy - 30, ox + 30, oy + 30);
    check("✒ Shift+drag a mask point = its own feather (about the drag's length); that corner of the mask goes soft, the opposite one stays sharp",
      fe[1] > 30 && fe[1] < 60 && fe[0] == null && sTR > sBL * 3 && sTR > 150, { fe, sTR, sBL });

    /* 2. data: import a CSV, the text follows the row */
    await p.evaluate(() => TlCanvas.setTool("move")); await pick(1); await p.waitForTimeout(300);
    await p.setInputFiles("#tlpDtFile", { name: "sales.csv", mimeType: "text/csv", buffer: Buffer.from("region,amount\nNorth,10\nSouth,25\nWest,40\n") });
    await p.waitForFunction(() => tl.data && tl.data.sets && tl.data.sets.sales, null, { timeout: 10000 }); await p.waitForTimeout(400);
    const tA = await comp(0);
    const txt1 = await p.evaluate(() => TlData.fill(tl.images[2].clips[0].text.content));
    await p.fill('[data-dtrow="sales"]', "3"); await p.dispatchEvent('[data-dtrow="sales"]', "input"); await p.waitForTimeout(500);
    const tB = await comp(0);
    const txt3 = await p.evaluate(() => TlData.fill(tl.images[2].clips[0].text.content));
    const reg = (A, B, x0, y0, x1, y1) => { let d = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 640 + x) * 4; d += Math.abs(A[i] - B[i]); n++; } return d / n; };
    check("⤓ a CSV imported as the data set sales (3 rows); the text's {{sales.region}}: {{sales.amount}} reads row 1, then row 3 when the row changes",
      txt1 === "North: 10" && txt3 === "West: 40" && reg(tA, tB, 360, 260, 560, 320) > 3, { txt1, txt3, d: reg(tA, tB, 360, 260, 560, 320) });
    await p.fill('[data-dtrow="sales"]', "2"); await p.dispatchEvent('[data-dtrow="sales"]', "input"); await p.waitForTimeout(300);

    /* 3. data -> keys, template fields */
    await pick(1); await p.waitForTimeout(300);
    await p.selectOption("#tlpDtCol", "amount"); await p.selectOption("#tlpDtProp", "x"); await p.fill("#tlpDtSpr", "1"); await p.fill("#tlpDtMul", "4"); await p.fill("#tlpDtAdd", "100");
    await p.click("#tlpDtGo"); await p.waitForTimeout(400);
    const xk = await p.evaluate(() => (tl.images[1].clips[0].kf || []).filter((k) => k.x != null).map((k) => [k.at, k.x]));
    check("📋 Data → keys: the amount column on the logo's x, a row a second, x 4 + 100", JSON.stringify(xk) === "[[0,140],[1,200],[2,260]]", xk);
    await p.selectOption("#tlpTfProp", "op"); await p.fill("#tlpTfLbl", "Logo opacity"); await p.click("#tlpTfAdd"); await p.waitForTimeout(400);
    const exI = await p.evaluate(() => { const el = document.querySelector("[data-tfv]"); return el ? el.getAttribute("data-tfv") : null; });
    await p.fill('[data-tfv="' + exI + '"]', "0.4"); await p.dispatchEvent('[data-tfv="' + exI + '"]', "input"); await p.waitForTimeout(300);
    const ex = await p.evaluate(() => ({ e: tl.images[1].clips[0].expose, op: tl.images[1].clips[0].opacity, n: TlData.exposedAll().length }));
    check("📋 Template fields: the logo's opacity exposed as \"Logo opacity\"; changed from the timeline's field list", ex.e && ex.e.op === "Logo opacity" && ex.op === 0.4 && ex.n === 1, ex);

    /* 4. the compile */
    const snapAt = async (t) => { await goT(t); await p.waitForTimeout(900); await goT(t); await p.waitForTimeout(400); return Buffer.from((await p.evaluate(() => TlCanvas.snapshot())).split(",")[1], "base64"); };
    fs.writeFileSync(path.join(pd, "temp_dt_1.png"), await snapAt(0.5)); fs.writeFileSync(path.join(pd, "temp_dt_2.png"), await snapAt(2));
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 400000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let stt = "", log = [];
    for (let i = 0; i < 400 && job.id; i++) { const d = await api("/api/jobs/" + job.id); stt = d.status; log = d.log || []; if (stt === "done" || stt === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = path.join(pd, P + ".mp4");
    check("⚙ Compile: done", stt === "done" && fs.existsSync(movie), [stt, log.slice(-6)]);
    if (stt === "done") {
      const W = 640, H = 360, c1 = rgbOf(path.join(pd, "temp_dt_1.png"), W, H), m1 = rgbOf(movie, W, H, 0.5), c2 = rgbOf(path.join(pd, "temp_dt_2.png"), W, H), m2 = rgbOf(movie, W, H, 2);
      const d1 = meanDiff(c1, m1), d2 = meanDiff(c2, m2);
      check("COMPILE = CANVAS at 0.5 s and 2 s (a variable-feather mask, a data text on row 2, data keys, an exposed opacity): mean difference under 7", d1 < 7 && d2 < 7, [Math.round(d1 * 100) / 100, Math.round(d2 * 100) / 100]);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 700));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; delete tl.data; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
