#!/usr/bin/env node
/* bitGen Studio — 2.413.0 in a REAL browser against the REAL app: a RAMPED clip's edge dragged = exactly that much
 * shorter (frame-exact, the frame at the new edge the one that was there), Ctrl+K on a REVERSED clip, ✨ stabilise's
 * smoothing / locked and the canvas switching to the steady preview once it is made, 📤 the "follow" fit.
 * Tim: "do the smaller jobs and complete the 10 partly done jobs".
 * Run against the running app (H3_URL, default :8311). No Playwright = SKIP (exit 0). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync, spawnSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.413 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_prem8ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem8ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "testsrc2=s=400x260:r=25:d=8", "-f", "lavfi", "-i", "sine=frequency=330:duration=8", "-vf", "crop=320:180:'40+30*sin(t*17)':'40+25*cos(t*23)'",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(T, "ui8.webm")]);
const hasVidstab = /vidstabtransform/.test(spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" }).stdout || "");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2560, height: 1400 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, "ui8.webm"))]), "ui8.webm"); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlKeys && window.H3EditTools && H3EditTools.trimEdge && window.TlStab && window.H3ClipFx && window.TlDeliver, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      document.documentElement.style.setProperty("--tlsh", "480px");
      tl.video = [{ name: "ui8.webm", src: "video", in: 0, out: 6, dur: 8, start: 0, opacity: 1, fx: H3ClipFx.normalize({ ramp: [{ p: 0, s: 0.5 }, { p: 1, s: 2 }] }) }];
      tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tl.seqMarkers = []; tl.selLayer = "v1";
      PXS = 60; tlSave(); renderTimeline(); if (window.TlFloat) TlFloat.show(false); TlCanvas.go(0);
    });
    await p.waitForTimeout(400);

    /* ---- 1. a ramped clip's head dragged 1 s */
    const before = await ev(() => { const c = tl.video[0]; return { len: H3ClipFx.clipLen(c), at1: H3ClipFx.srcTime(c, 1) }; });
    const hb = await ev(() => { const h = document.querySelector("#tlinner .clip .h.l"); const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.move(hb.x, hb.y); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(hb.x + 60 * k / 6, hb.y);
    await p.mouse.up(); await p.waitForTimeout(250);
    const after = await ev(() => { const c = tl.video[0]; return { len: H3ClipFx.clipLen(c), first: H3ClipFx.srcTime(c, 0), in: c.in, ramp: c.fx && c.fx.ramp }; });
    check("a RAMPED clip's head dragged 1 s: exactly 1 s shorter, its first frame the one that was 1 s in (not an average rate)",
      Math.abs(after.len - (before.len - 1)) < 0.02 && Math.abs(after.first - before.at1) < 0.01 && after.ramp && after.ramp.length >= 2, { before, after });

    /* ---- 2. Ctrl+K on a reversed clip */
    await ev(() => { tl.video = [{ name: "ui8.webm", src: "video", in: 1, out: 7, dur: 8, start: 0, opacity: 1, fx: { reverse: true } }]; tlSave(); renderTimeline();
      window.__c = tl.video[0]; TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.go(2); });
    const lp = await ev(() => { const r = document.getElementById("tlscroll").getBoundingClientRect();
      for (let y = r.top + 30; y < r.bottom - 5; y += 8) for (let x = r.left + 600; x < r.right - 20; x += 60) {
        const e = document.elementFromPoint(x, y); if (e && e.closest("#tlscroll") && !e.closest(".clip, #playhead, .tlmk, .tlab")) return { x, y }; }
      return { x: r.left + 800, y: r.top + 40 }; });
    await p.mouse.move(lp.x, lp.y);
    await p.keyboard.press("Control+k"); await p.waitForTimeout(250);
    const sp = await ev(() => tl.video.map((c) => ({ start: c.start, in: c.in, out: c.out, rev: !!(c.fx && c.fx.reverse) })));
    check("Ctrl+K on a REVERSED clip (it used to be refused): two reversed halves - the left plays the source's end (5..7), the right from 5 down", sp.length === 2 && sp.every((x) => x.rev)
      && sp[0].in === 5 && sp[0].out === 7 && sp[1].start === 2 && sp[1].in === 1 && sp[1].out === 5, sp);

    /* ---- 3. stabilise: smoothing, locked, the steady preview */
    await ev(() => { tl.video = [{ name: "ui8.webm", src: "video", in: 0, out: 4, dur: 8, start: 0, opacity: 1 }]; tlSave(); renderTimeline(); if (window.TlFloat) TlFloat.show(true);
      window.__c = tl.video[0]; TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.paintProps(); document.getElementById("tfxEffects").open = true; });
    const dis = await ev(() => document.getElementById("tfxStabS").disabled);
    await ev(() => { const s = document.getElementById("tfxStab"); s.checked = true; s.dispatchEvent(new Event("change")); });
    await ev(() => { const r = document.getElementById("tfxStabS"); r.value = "80"; r.dispatchEvent(new Event("change")); });
    const st1 = await ev(() => ({ v: tl.video[0].fx && tl.video[0].fx.vfx && tl.video[0].fx.vfx.stabilise, s: document.getElementById("tfxStabState").textContent }));
    check("✨ stabilise: smoothing + locked enabled with it; 80 % kept ({smooth 80}); the steady preview asked for", dis && st1.v && st1.v.smooth === 80 && st1.v.lock === false && /steadying|✓|as shot/.test(st1.s), st1);
    if (hasVidstab) {
      await p.waitForFunction(() => /✓ the canvas shows it steadied/.test(document.getElementById("tfxStabState") ? document.getElementById("tfxStabState").textContent : "") || (window.TlStab && TlStab.state(tl.video[0]) && TlStab.state(tl.video[0]).state === "ready"), null, { timeout: 120000 }).catch(() => {});
      await ev(() => { TlCanvas.go(1); TlCanvas.draw(); });
      await p.waitForTimeout(600);
      const st2 = await ev(() => { const bx = TlCanvas.box(tl.video[0], "v1", 1); const v = bx && bx.src; return { url: TlStab.url(tl.video[0]), src: v && v.currentSrc || (v && v.src) || "", state: TlStab.state(tl.video[0]) }; });
      check("...once made, the canvas plays the steady file (/api/clipfx/stabilised/…)", st2.state && st2.state.state === "ready" && /\/api\/clipfx\/stabilised\//.test(st2.url || "") && /\/api\/clipfx\/stabilised\//.test(st2.src), st2);
    } else console.log("SKIP: no vidstab in this ffmpeg - the steady preview was not waited for");

    /* ---- 4. 📤 follow */
    await p.click("#tlDeliverBtn");
    await p.waitForSelector("#tdlAdd");
    await p.click("#tdlAdd");
    await p.selectOption('#tdlRows .fx-row:last-child select[data-k="aspect"]', "9:16");
    await p.waitForTimeout(150);
    const fits = await ev(() => { const s = document.querySelector('#tdlRows .fx-row:last-child select[data-k="fit"]'); return { opts: [...s.options].map((o) => o.value), dis: s.disabled, title: s.title }; });
    await p.selectOption('#tdlRows .fx-row:last-child select[data-k="fit"]', "follow");
    await p.waitForTimeout(150);
    const dl = await ev(() => (tl.deliver || []).slice(-1)[0]);
    check("📤 a 9:16 row's fit offers follow (the crop follows the subject), kept on the timeline", fits.opts.includes("follow") && !fits.dis && /follows the subject/.test(fits.title) && dl && dl.fit === "follow", { fits, dl });
    await ev(() => { tl.deliver = []; tlSave(); document.querySelector("#tlDeliverDlg .fx-x").click(); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.video = []; tl.deliver = []; tl.sel = null; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
