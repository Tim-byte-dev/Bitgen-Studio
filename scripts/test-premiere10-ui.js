#!/usr/bin/env node
/* bitGen Studio — 2.415.0 in a REAL browser against the REAL app: 🎚 the MIXER (a strip per track + the master: pan,
 * fader to +6 dB, mute; live meters while the canvas plays - a sound layer panned left reads louder on the left),
 * ✨ DISTORT on the canvas (a mirrored clip is symmetric), a layer's WIPE previewed on the canvas (a quarter way in:
 * the right side shows it, the left what is under it), 🎨 🎯 COLOUR MATCH (the curves set from another clip).
 * Tim: "lets do the medium jobs now".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.415 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_prem10ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem10ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const VP9 = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime"];
ff(["-f", "lavfi", "-i", "color=c=0x404040:s=320x180:r=25:d=4", "-f", "lavfi", "-i", "sine=frequency=440:duration=4"].concat(VP9, ["-c:a", "libopus", "-shortest", path.join(T, "mxgrey.webm")]));
ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=4", "-vf", "format=rgb24,geq=r='X*0.7':g='Y*1.3':b='128+60*sin(X/15)'"].concat(VP9, [path.join(T, "mxpat.webm")]));
ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=2", "-vf", "format=rgb24,geq=r='30+X/2':g='40+Y':b='120+X/4'"].concat(VP9, [path.join(T, "mxcool.webm")]));
ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=25:d=2", "-vf", "format=rgb24,geq=r='90+X/3':g='30+Y/2':b='20+X/5'"].concat(VP9, [path.join(T, "mxwarm.webm")]));

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2400, height: 1350 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    const pdir = path.join(ROOT, "projects", P);
    for (const f of ["mxgrey.webm", "mxpat.webm", "mxcool.webm", "mxwarm.webm"]) { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    fs.mkdirSync(path.join(pdir, "sound"), { recursive: true });
    ff(["-f", "lavfi", "-i", "sine=frequency=660:duration=4", "-af", "volume=0.5", "-ac", "2", path.join(pdir, "sound", "mx660.wav")]);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlMixer && document.getElementById("tlMixerBtn") && window.H3TrPrev && window.H3Vfx && document.getElementById("tlColourBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      document.documentElement.style.setProperty("--tlsh", "420px");
      tl.video = [{ name: "mxgrey.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }];
      tl.vlayers = [mkLayer("V2", [{ name: "mxpat.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }])];
      tl.audio = [Object.assign(mkLayer("A1", [{ name: "mx660.wav", in: 0, out: 4, dur: 4, start: 0 }]), { role: "music" })];
      tl.images = []; tl.sel = null; tl.seqMarkers = []; tl.selLayer = "v1"; tl.master = undefined;
      PXS = 60; tlSave(); renderTimeline(); if (window.TlFloat) TlFloat.show(false); TlCanvas.go(0.5);
    });
    await p.waitForTimeout(500);

    /* ---- 1. 🎚 the mixer */
    await p.click("#tlMixerBtn");
    await p.waitForFunction(() => document.getElementById("tlMixerDlg") && document.getElementById("tlMixerDlg").open && document.querySelectorAll("#tlMixerDlg .mx-s").length === 4, null, { timeout: 10000 });
    const strips = await ev(() => [...document.querySelectorAll("#tlMixerDlg .mx-s")].map((s) => s.dataset.lk + ":" + s.querySelector(".mx-n").textContent));
    const set = (sel, v) => ev(([s, x]) => { const el = document.querySelector(s); el.value = String(x); el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); }, [sel, v]);
    await set('#tlMixerDlg .mx-s[data-lk="a:0"] .mx-p', -100);
    await set('#tlMixerDlg .mx-s[data-lk="v1"] .mx-f', 150);
    await set('#tlMixerDlg .mx-s[data-lk="master"] .mx-f', 50);
    await ev(() => document.querySelector('#tlMixerDlg .mx-s[data-lk="vl:0"] .mx-mute').click());
    const m1 = await ev(() => ({ pan: tl.audio[0].pan, v1: tl.v1.volume, master: tl.master, mute: tl.vlayers[0].muted, db: document.querySelector('#tlMixerDlg .mx-s[data-lk="v1"] .mx-db').textContent,
      pv: document.querySelector('#tlMixerDlg .mx-s[data-lk="a:0"] .mx-pv').textContent, mdb: document.querySelector('#tlMixerDlg .mx-s[data-lk="master"] .mx-db').textContent }));
    check("🎚 Mixer: a strip for V1, V2, A1 + MASTER; pan A1 hard left (L 100), V1's fader +3.5 dB (1.5), the master -6 dB, V2 muted - all on the timeline",
      strips.join("|") === "v1:🎞 V1|vl:0:🎞 V2|a:0:🔊 A1|master:MASTER" && m1.pan === -1 && m1.v1 === 1.5 && m1.master && m1.master.volume === 0.5 && m1.mute === true && m1.db === "+3.5 dB" && m1.pv === "L 100" && m1.mdb === "-6.0 dB", { strips, m1 });
    await ev(() => document.querySelector('#tlMixerDlg .mx-s[data-lk="vl:0"] .mx-mute').click());
    // play: the elements go through the mixer's buses; the meters read them
    await ev(() => { TlMixer.resume(); TlCanvas.go(0.2); TlCanvas.play(); });
    let lv = null;
    for (let i = 0; i < 20; i++) {
      await p.waitForTimeout(250);
      lv = await ev(() => TlMixer.levels());
      if (lv["a:0"] && lv["a:0"].l > 0.02 && lv.v1 && lv.v1.l > 0.02) break;
    }
    const st = await ev(() => TlMixer.state());
    await ev(() => TlCanvas.pause());
    if (st.ctx === "running") {
      check("...playing: the meters move - A1 (panned left) loud on the left, nothing on the right; V1 on both; the master too",
        lv["a:0"].l > 0.05 && lv["a:0"].r < lv["a:0"].l * 0.05 && lv.v1.l > 0.02 && lv.v1.r > 0.02 && lv.master.l > 0.02, { lv, st });
    } else console.log("SKIP: this browser's audio context is " + st.ctx + " - the live meters were not read");
    const meterDrawn = await ev(() => { const cv = document.querySelector('#tlMixerDlg canvas.mx-m[data-lk="a:0"]'); const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 100) lit++; return lit; });
    check("...the meter canvases are drawn (bars + the 0 dB line)", meterDrawn > 0, meterDrawn);
    await ev(() => { document.querySelector("#tmxDone").click(); tl.master = undefined; tl.v1.volume = 1; delete tl.audio[0].pan; tlSave(); });

    /* ---- 2. ✨ distort on the canvas */
    const half = () => ev(() => {
      const S = TlCanvas.state, c = document.createElement("canvas"); c.width = 64; c.height = 36;
      const g = c.getContext("2d"); g.save(); g.scale(64 / S.W, 36 / S.H); TlCanvas.paintComp(g, 1); g.restore();
      const d = g.getImageData(0, 0, 64, 36).data; let worst = 0;
      for (let y = 4; y < 32; y += 4) for (let x = 4; x < 30; x += 4) for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(d[(y * 64 + x) * 4 + k] - d[(y * 64 + 63 - x) * 4 + k]));
      return worst; });
    await ev(() => { TlCanvas.go(1); TlCanvas.draw(); });
    await p.waitForTimeout(800);
    const asym = await half();
    await ev(() => { if (window.TlFloat) TlFloat.show(true); const c = tl.vlayers[0].clips[0]; TlCanvas.select(c, TlCanvas.layerOf(c)); TlCanvas.paintProps(); document.getElementById("tfxEffects").open = true; });
    await p.waitForFunction(() => document.getElementById("tfxMirror"), null, { timeout: 10000 });
    await p.selectOption("#tfxMirror", "h");
    await ev(() => { TlCanvas.go(1); TlCanvas.draw(); });
    await p.waitForTimeout(800);
    const sym = await half();
    const mfx = await ev(() => tl.vlayers[0].clips[0].fx && tl.vlayers[0].clips[0].fx.vfx);
    check("✨ Effects → mirror left → right: the clip's vfx.mirror = h; the canvas picture becomes symmetric (it was not)", mfx && mfx.mirror === "h" && asym > 30 && sym < 16, { asym, sym, mfx });
    await ev(() => { delete tl.vlayers[0].clips[0].fx; tlSave(); if (window.TlFloat) TlFloat.show(false); });

    /* ---- 3. a layer's wipe on the canvas */
    await ev(() => { tl.vlayers[0].transitionIn = { type: "wipeleft", dur: 1 }; tl.vlayers[0].clips[0].start = 0.5; tlSave(); renderTimeline(); TlCanvas.go(0.75); TlCanvas.draw(); });
    await p.waitForTimeout(800);
    const wp = await ev(() => {
      const S = TlCanvas.state, c = document.createElement("canvas"); c.width = 64; c.height = 36;
      const g = c.getContext("2d"); g.save(); g.scale(64 / S.W, 36 / S.H); TlCanvas.paintComp(g, 0.75); g.restore();
      const d = g.getImageData(0, 0, 64, 36).data, at = (x) => [d[(18 * 64 + x) * 4], d[(18 * 64 + x) * 4 + 1], d[(18 * 64 + x) * 4 + 2]];
      return { left: at(8), right: at(60) }; });
    check("TRANSITIONS on the canvas: a quarter way into V2's wipe left, the right side shows V2's picture, the left still V1's grey under it",
      Math.abs(wp.left[0] - 64) < 14 && Math.abs(wp.left[2] - 64) < 14 && (Math.abs(wp.right[0] - 64) > 25 || Math.abs(wp.right[1] - 64) > 25), wp);
    await ev(() => { tl.vlayers[0].transitionIn = { type: "none", dur: 0.5 }; tlSave(); });

    /* ---- 4. 🎯 colour match */
    await ev(() => {
      tl.video = [{ name: "mxwarm.webm", src: "video", in: 0, out: 2, dur: 2, start: 0, opacity: 1 }];
      tl.vlayers = [mkLayer("V2", [{ name: "mxcool.webm", src: "video", in: 0, out: 2, dur: 2, start: 3, opacity: 1 }])];
      tl.audio = []; tlSave(); renderTimeline(); TlCanvas.go(1);
      const c = tl.video[0]; TlCanvas.select(c, TlCanvas.layerOf(c));
    });
    await p.click("#tlColourBtn");
    await p.waitForFunction(() => document.getElementById("tcpMatchGo"), null, { timeout: 10000 });
    const opts = await ev(() => [...document.querySelectorAll("#tcpMatchRef option")].map((o) => o.textContent));
    await ev(() => document.getElementById("tcpMatchGo").click());
    await p.waitForFunction(() => /Matched to/.test((document.getElementById("tcpMatchMsg") || {}).textContent || ""), null, { timeout: 30000 }).catch(() => {});
    const mt = await ev(() => ({ cu: tl.video[0].fx && tl.video[0].fx.grade && tl.video[0].fx.grade.curves, msg: document.getElementById("tcpMatchMsg").textContent }));
    check("🎨 🎯 Match: the other clip offered (mxcool · V2); the warm clip's R / G / B curves set from it, said in words", opts.length === 1 && /mxcool\.webm · V2/.test(opts[0])
      && mt.cu && mt.cu.r && mt.cu.g && mt.cu.b && /Matched to mxcool\.webm \(100 %\)/.test(mt.msg), { opts, mt });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.audio = []; tl.master = undefined; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
