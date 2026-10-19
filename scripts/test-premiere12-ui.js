#!/usr/bin/env node
/* bitGen Studio — 2.417.0 in a REAL browser against the REAL app: 🔊 a reversed 2x clip HEARD on the canvas (its sound
 * rendered with the compile's retime, playing in step), ⇄ the timeline exported as an AAF (downloaded), 🧩 a motion
 * graphics template dropped in at the playhead with its words changed, then the layers saved as a template of our own.
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.417 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_prem12ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem12ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const VP9 = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "realtime", "-cpu-used", "8"];
ff(["-f", "lavfi", "-i", "color=c=0x406080:s=320x180:r=25:d=4", "-f", "lavfi", "-i", "sine=f=440:d=2,apad=pad_dur=2", "-t", "4"].concat(VP9, ["-c:a", "libopus", path.join(T, "uitone.webm")]));
const MY = "zz-ui-" + process.pid;

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await b.newContext({ viewport: { width: 2400, height: 1350 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, "uitone.webm"))]), "uitone.webm"); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlRetimeSound && window.TlMogrt && window.H3Mogrt && document.getElementById("tlMogrtBtn") && document.getElementById("tlExchangeBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      document.documentElement.style.setProperty("--tlsh", "420px");
      tl.video = [{ name: "uitone.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1, fx: { speed: 2, reverse: true } }];
      tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tl.selLayer = "v1";
      PXS = 60; tlSave(); renderTimeline(); if (window.TlFloat) TlFloat.show(false); TlCanvas.go(0.2);
      const k = document.getElementById("tlKeepA"); if (k) k.checked = true;
    });

    /* ---- 1. 🔊 a reversed clip heard */
    await p.waitForFunction(() => { const s = TlRetimeSound.state(tl.video[0]); return s && s.state === "ready"; }, null, { timeout: 60000 }).catch(() => {});
    await ev(() => { TlCanvas.go(0.2); TlCanvas.play(); });
    await p.waitForTimeout(900);
    const hs = await ev(() => { const a = TlRetimeSound._A.get(tl.video[0]), S = TlCanvas.state;
      return { st: TlRetimeSound.state(tl.video[0]), has: !!a, paused: a ? a.paused : null, src: a ? a.src : "", at: a ? a.currentTime : -1, t: S.t, vmuted: TlCanvas.box(tl.video[0], "v1", S.t).src.muted }; });
    await ev(() => TlCanvas.pause());
    await p.waitForTimeout(200);
    const hp = await ev(() => { const a = TlRetimeSound._A.get(tl.video[0]); return a ? a.paused : null; });
    check("🔊 a reversed 2x clip: its sound rendered (ready), PLAYING on the canvas in step (its time = the playhead - the clip's start), the picture's own file silent; paused with the transport",
      hs.st && hs.st.state === "ready" && hs.has && hs.paused === false && /\/api\/clipfx\/retimed\/uitone_[0-9a-f]+\.webm/.test(hs.src) && Math.abs(hs.at - hs.t) < 0.35 && hs.vmuted === true && hp === true, { hs, hp });

    /* ---- 2. ⇄ AAF */
    await p.click("#tlExchangeBtn");
    await p.waitForFunction(() => document.getElementById("tixFmt"), null, { timeout: 10000 });
    await p.selectOption("#tixFmt", "aaf");
    await ev(() => { document.getElementById("tixName").value = "zz ui aaf"; });
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }).catch(() => null), p.click("#tixOut")]);
    const dlp = dl ? await dl.path().catch(() => null) : null;
    await p.waitForFunction(() => /picture \+/.test((document.getElementById("tixOutMsg") || {}).textContent || ""), null, { timeout: 30000 }).catch(() => {});
    const xm = await ev(() => document.getElementById("tixOutMsg").textContent);
    const magic = dlp ? fs.readFileSync(dlp).subarray(0, 8).toString("hex") : "";
    check("⇄ Exchange → AAF: the file downloads (zz ui aaf.aaf - a compound file, D0CF11E0…), the tracks said", dl && dl.suggestedFilename() === "zz ui aaf.aaf" && magic === "d0cf11e0a1b11ae1" && /1 picture \+ \d sound track/.test(xm), { name: dl && dl.suggestedFilename(), magic, xm });
    await ev(() => document.querySelector("#tlExchangeDlg .fx-x").click());

    /* ---- 3. 🧩 a template in, then ours out */
    await ev(() => { tl.video = [{ name: "uitone.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }]; tlSave(); renderTimeline(); TlCanvas.go(1); });
    await p.click("#tlMogrtBtn");
    await p.waitForFunction(() => document.querySelectorAll("#tmgList option").length >= 4, null, { timeout: 15000 });
    await p.selectOption("#tmgList", "lower-third");
    await p.waitForFunction(() => document.getElementById("tmgF_L1C0"), null, { timeout: 5000 });
    await p.fill("#tmgF_L1C0", "Tim Test");
    await p.click("#tmgInsert");
    await p.waitForFunction(() => /dropped in/.test((document.getElementById("tmgMsg") || {}).textContent || ""), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const ins = await ev(() => ({ n: tl.images.length, names: tl.images.map((L) => L.name), starts: tl.images.map((L) => L.clips[0].start), bar: tl.images[0] && tl.images[0].clips[0].name,
      txt: tl.images[1] && tl.images[1].clips[0].text && tl.images[1].clips[0].text.content, tname: tl.images[1] && tl.images[1].clips[0].name,
      size: tl.images[1] && tl.images[1].clips[0].text.size, W: TlCanvas.state.W, msg: document.getElementById("tmgMsg").textContent }));
    const png = ins.tname ? (await fetch(URL_ + "passets/images/" + encodeURIComponent(ins.tname))).status : 0;
    const k = ins.W / 1920;
    check("🧩 Lower third dropped in at the playhead (1 s): 3 layers, the bar picture copied in, the name changed to “Tim Test” (its picture saved), sized to the picture",
      ins.n === 3 && Math.abs(ins.starts[0] - 1) < 1e-6 && Math.abs(ins.starts[1] - 1.15) < 1e-6 && ins.bar === "mg_lower-third_lt_bar.png" && ins.txt === "Tim Test" && png === 200
      && ins.size === Math.max(4, Math.round(60 * k)), { ins, png });
    await ev(() => TlCanvas.go(3));
    await p.waitForTimeout(1200);
    const lit = await ev(() => { const S = TlCanvas.state, c = document.createElement("canvas"); c.width = 64; c.height = 36;
      const g = c.getContext("2d"); g.save(); g.scale(64 / S.W, 36 / S.H); TlCanvas.paintComp(g, 3); g.restore();
      const d = g.getImageData(0, 0, 64, 36).data; const at = (x, y) => [d[(y * 64 + x) * 4], d[(y * 64 + x) * 4 + 1], d[(y * 64 + x) * 4 + 2]];
      return { bar: at(Math.round(32 - 350 / 1920 * 64 + 12), Math.round(18 + 350 / 1080 * 36 + 1)), top: at(32, 4) }; });
    const bx = await ev(() => { const b = TlCanvas.box(tl.images[0].clips[0], "img", 3); return b && { cx: b.cx, cy: b.cy, w: b.w, h: b.h, src: b.src && (b.src.src || "canvas"), ok: b.src && b.src.complete, W: TlCanvas.state.W, H: TlCanvas.state.H, live: tl.images[0].visible }; });
    check("...the canvas draws it (the dark bar low on the left, the picture above it as it was)", lit.bar[0] < 60 && lit.bar[2] < 70 && Math.abs(lit.top[2] - 0x80) < 30, { lit, bx });
    // save the three layers (under the playhead - ticked) as our own template
    await ev(() => { TlCanvas.go(2); document.querySelector("#tlMogrtDlg .fx-x").click(); });
    await p.click("#tlMogrtBtn");
    await p.waitForFunction(() => document.querySelectorAll(".tmgL").length === 3, null, { timeout: 10000 });
    const ticks = await ev(() => [...document.querySelectorAll(".tmgL")].map((x) => x.checked));
    await ev((MY) => { document.getElementById("tmgName").value = MY; const l = document.querySelector('.tmgLab[data-k="L1C0"]'); if (l) l.value = "Who"; }, MY);
    await p.click("#tmgSave");
    await p.waitForFunction(() => /✓ saved/.test((document.getElementById("tmgMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await p.waitForFunction((MY) => (document.getElementById("tmgList") || {}).value === MY, MY, { timeout: 8000 }).catch(() => {});   // 2.470.0: the list is read again after the message (a race)
    const sv = await ev(() => ({ msg: document.getElementById("tmgMsg").textContent, sel: document.getElementById("tmgList").value, f: [...document.querySelectorAll("#tmgFields input")].map((x) => x.value) }));
    const got = await api("/api/mogrt/" + MY);
    check("...💾 Save as a template: the 3 ticked layers kept (2 editable texts, the bar picture with it), listed and picked, its field named “Who” with “Tim Test” in it",
      ticks.every(Boolean) && /3 layer\(s\), 2 editable text\(s\), 1 picture/.test(sv.msg) && sv.sel === MY && got.ok && got.template.fields[0].label === "Who" && got.template.layers[1].clips[0].text.content === "Tim Test"
      && sv.f[0] === "Tim Test", { ticks, sv, got });
    await ev(() => document.querySelector("#tlMogrtDlg .fx-x").click());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.audio = []; tl.images = []; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await fetch(URL_ + "api/mogrt/" + MY, { method: "DELETE" }); } catch { /* fine */ }
    try { fs.rmdirSync(path.join(ROOT, "mogrt", "user")); } catch { /* other saved templates */ }
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
