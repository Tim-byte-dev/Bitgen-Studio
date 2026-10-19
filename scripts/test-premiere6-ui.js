#!/usr/bin/env node
/* bitGen Studio — 2.411.0 in a REAL browser against the REAL app: the J / K / L shuttle - L plays, again 2x / 4x / 8x
 * (measured: the position marker moves that fast), J backwards (the same, stopping at the start), K stops (back to 1x),
 * K held + L / J = one frame; the speed beside ▶; over the canvas too; L over the timeline is NOT LLM tokens (it still
 * is elsewhere); typing in a box types; the 📤 dialog's ⚡ graphics-card switch and the two new presets.
 * Tim: "yes please and any premier leftovers that you can do comfortably".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.411 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_prem6ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem6ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "color=c=0x404040:s=320x180:d=20:r=25", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "45", "-deadline", "realtime", path.join(T, "ui6.webm")]);

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
    { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, "ui6.webm"))]), "ui6.webm"); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlKeys && window.TlCanvas && TlCanvas.shuttle && window.SecFloat && SecFloat.started && window.TlDeliver, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      document.documentElement.style.setProperty("--tlsh", "560px");
      tl.video = [{ name: "ui6.webm", src: "video", in: 0, out: 20, dur: 20, start: 0, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tl.seqMarkers = []; tl.selLayer = "v1";
      PXS = 40; tlSave(); renderTimeline(); if (window.TlFloat) TlFloat.show(false); TlCanvas.go(0);
    });
    await p.waitForTimeout(600);
    const key = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(120); };
    const lp = await ev(() => { const r = document.getElementById("tlscroll").getBoundingClientRect();
      for (let y = r.top + 30; y < r.bottom - 5; y += 8) for (let x = r.left + 200; x < r.right - 20; x += 60) {
        const e = document.elementFromPoint(x, y); if (e && e.closest("#tlscroll") && !e.closest(".clip, #playhead, .tlmk")) return { x, y }; }
      return { x: r.left + 300, y: r.top + 40 }; });
    await p.mouse.move(lp.x, lp.y);
    const st = () => ev(() => ({ t: TlCanvas.state.t, playing: TlCanvas.state.playing, rate: TlCanvas.state.rate, badge: (document.getElementById("tlCRate") || {}).textContent || "",
      llm: !SecFloat.windows.llmtok || SecFloat.windows.llmtok.el.classList.contains("sf-hidden") ? "hidden" : "shown" }));
    // how fast the position marker moves (timeline seconds per wall second) - the page's own clock
    const speed = () => ev(() => new Promise((res) => { const t0 = TlCanvas.state.t, w0 = performance.now(); setTimeout(() => res((TlCanvas.state.t - t0) / ((performance.now() - w0) / 1000)), 700); }));
    const llm0 = (await st()).llm;

    /* ---- 1. L L L L L, K */
    await key("l");
    const a1 = await st(), v1 = await speed();
    check("L over the layers: plays forwards at 1x (no speed shown); LLM tokens left alone", a1.playing && a1.rate === 1 && a1.badge === "" && v1 > 0.6 && v1 < 1.4 && a1.llm === llm0, { a1, v1, llm0 });
    await key("l");
    const a2 = await st(), v2 = await speed();
    check("L again: 2x (▶ 2× beside ▶, the marker twice as fast)", a2.rate === 2 && a2.badge === "▶ 2×" && v2 > 1.4 && v2 < 2.6, { a2, v2 });
    await key("l"); await key("l");
    const a8 = await st(), v8 = await speed();
    await key("l");
    const a9 = await st();
    check("...again: 4x, again 8x - and no faster", a8.rate === 8 && a8.badge === "▶ 8×" && v8 > 5 && a9.rate === 8, { a8, v8, a9 });
    await key("k");
    const k1 = await st();
    await p.waitForTimeout(300);
    const k2 = await st();
    check("K: stops (back to 1x, no speed shown, the marker stays)", !k1.playing && k1.rate === 1 && k1.badge === "" && Math.abs(k2.t - k1.t) < 1e-6, { k1, k2 });

    /* ---- 2. J backwards */
    await ev(() => TlCanvas.go(6));
    await key("j");
    const j1 = await st(), vj = await speed();
    check("J: plays BACKWARDS at 1x (◀ 1× shown, the marker moves back)", j1.playing && j1.rate === -1 && j1.badge === "◀ 1×" && vj < -0.6 && vj > -1.4, { j1, vj });
    await key("j");
    const j2 = await st(), vj2 = await speed();
    check("J again: 2x backwards", j2.rate === -2 && j2.badge === "◀ 2×" && vj2 < -1.4, { j2, vj2 });
    await key("l");
    const j3 = await st();
    check("L while going backwards: forwards at 1x again", j3.rate === 1 && j3.playing, j3);
    await key("k");
    await ev(() => TlCanvas.go(0.4));
    await key("j"); await key("j"); await key("j");
    await p.waitForFunction(() => !TlCanvas.state.playing, null, { timeout: 4000 }).catch(() => {});
    const j4 = await st();
    check("...backwards to the start: stops there (at 0)", !j4.playing && j4.t < 0.05, j4);

    /* ---- 3. K + L / K + J: one frame */
    await ev(() => TlCanvas.go(2));
    const fps = await ev(() => (typeof TLFPS === "number" ? TLFPS : 24));
    await p.keyboard.down("k"); await key("l"); await key("l"); await p.keyboard.up("k");
    const s1 = await st();
    await p.keyboard.down("k"); await key("j"); await p.keyboard.up("k");
    const s2 = await st();
    check("hold K + L L: two frames on (paused); K + J: one back", !s1.playing && Math.abs(s1.t - (2 + 2 / fps)) < 1e-6 && !s2.playing && Math.abs(s2.t - (2 + 1 / fps)) < 1e-6, { s1, s2, fps });
    await key("l");
    const s3 = await st();
    await key("k");
    check("...K let go: L plays again (not a step)", s3.playing && s3.rate === 1, s3);

    /* ---- 4. over the canvas; typing; outside the timeline */
    const cw = await ev(() => { const r = document.getElementById("tlCanvasWrap").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.move(cw.x, cw.y);
    await key("l"); await key("l");
    const c1 = await st();
    await key("k");
    check("over the canvas too: L L = 2x, K stops; LLM tokens left alone", c1.playing && c1.rate === 2 && c1.llm === llm0 && !(await st()).playing, c1);
    const tb = await ev(() => { const i = document.createElement("input"); i.id = "zzType6"; i.style.cssText = "position:fixed;left:10px;top:10px;z-index:99999"; document.getElementById("timelinedock").appendChild(i); i.focus(); return true; });
    await key("l"); await key("j"); await key("k");
    const ty = await ev(() => ({ v: document.getElementById("zzType6").value, playing: TlCanvas.state.playing }));
    await ev(() => document.getElementById("zzType6").remove());
    check("typing in a box in the timeline: l j k are typed, the preview does not move", tb && ty.v === "ljk" && !ty.playing, ty);
    await p.mouse.move(5, 700);
    await ev(() => document.body.focus());
    await key("l");
    const o1 = await st();
    await key("l");
    const o2 = await st();
    check("outside the timeline: L is LLM tokens again (shows / hides), no shuttle", !o1.playing && o1.llm !== llm0 && o2.llm === llm0, { o1, o2, llm0 });

    /* ---- 5. 📤 ⚡ + the new presets */
    await p.click("#tlDeliverBtn");
    await p.waitForSelector("#tdlHw");
    const keep = await ev(() => JSON.stringify(tl.deliver || []));
    await p.click("#tdlAdd");
    await p.selectOption('#tdlRows .fx-row:last-child select[data-k="preset"]', "av1");
    await p.waitForTimeout(150);
    const dv = await ev(() => { const r = document.querySelector("#tdlRows .fx-row:last-child"); return { opts: [...r.querySelector('select[data-k="preset"]').options].map((o) => o.textContent),
      q: !!r.querySelector('select[data-k="quality"]'), last: (tl.deliver || []).slice(-1)[0] }; });
    await p.check("#tdlHw");
    const hw = await ev(() => tl.deliverHw);
    await ev((k) => { tl.deliver = JSON.parse(k); tlSave(); }, keep);
    check("📤 ＋: the formats list MP4 · AV1 + MP4 · H.265 10-bit; AV1 has its quality choice; ⚡ the graphics card's encoder kept on the timeline",
      dv.opts.includes("MP4 · AV1") && dv.opts.includes("MP4 · H.265 10-bit") && dv.q && dv.last && dv.last.preset === "av1" && hw === true, { hw, dv });
    await ev(() => { document.querySelector("#tlDeliverDlg .fx-x").click(); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { TlCanvas.pause(); delete tl.deliverHw; tl.video = []; tl.sel = null; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
