#!/usr/bin/env node
/* bitGen Studio — 2.416.0 in a REAL browser against the REAL app: 🎨 ◯ a MASK on the grade (the canvas dark inside only,
 * inverted outside only), 🎯 TRACK it along a moving ball, 🎥 MULTI-CAMERA (two angles synced by their sound, V1 the
 * program, key 2 cuts to the second angle there), 🪶 PROXIES (a 2560-wide clip found heavy, its proxy made, the canvas
 * playing it). Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior".
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.416 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_prem11ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem11ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const VP9 = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "realtime", "-cpu-used", "8"];
ff(["-f", "lavfi", "-i", "color=c=0xb0b0b0:s=320x180:r=25:d=3"].concat(VP9, [path.join(T, "uiflat.webm")]));
ff(["-f", "lavfi", "-i", "testsrc2=s=640x360:r=25:d=4", "-f", "lavfi", "-i", "color=c=0xffd040:s=80x80:r=25:d=4", "-filter_complex",
    "[1:v]format=rgba,geq=r='255':g='210':b='60':a='if(lt(hypot(X-40,Y-40),38),255,0)'[o];[0:v]eq=brightness=-0.2[b];[b][o]overlay=x='100+t*100':y='140+40*sin(t*2)'"].concat(VP9, [path.join(T, "uiball.webm")]));
ff(["-f", "lavfi", "-i", "anoisesrc=d=12:c=pink:r=48000:a=0.3", "-af", "volume='0.3+0.7*abs(sin(t*3))*gt(sin(t*1.7),0)':eval=frame", path.join(T, "ev.wav")]);
ff(["-f", "lavfi", "-i", "color=red:s=320x180:r=25:d=8", "-ss", "1.5", "-t", "8", "-i", path.join(T, "ev.wav"), "-shortest"].concat(VP9, ["-c:a", "libopus", path.join(T, "uicamA.webm")]));
ff(["-f", "lavfi", "-i", "color=blue:s=320x180:r=25:d=8", "-ss", "3.25", "-t", "8", "-i", path.join(T, "ev.wav"), "-af", "volume=0.3,highpass=f=300", "-shortest"].concat(VP9, ["-c:a", "libopus", path.join(T, "uicamB.webm")]));
ff(["-f", "lavfi", "-i", "color=c=0x30a030:s=2560x1440:r=25:d=2"].concat(VP9, [path.join(T, "uibig.webm")]));

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
    for (const f of ["uiflat.webm", "uiball.webm", "uicamA.webm", "uicamB.webm", "uibig.webm"]) { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlMulticam && window.TlProxy && window.H3Multicam && document.getElementById("tlMulticamBtn") && document.getElementById("tlProxyBtn") && document.getElementById("tlColourBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      document.documentElement.style.setProperty("--tlsh", "420px");
      tl.video = [{ name: "uiflat.webm", src: "video", in: 0, out: 3, dur: 3, start: 0, opacity: 1, fx: { grade: { exposure: -3 } } }];
      tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tl.selLayer = "v1"; delete tl.multicam;
      PXS = 60; tlSave(); renderTimeline(); if (window.TlFloat) TlFloat.show(false); TlCanvas.go(1);
      window.__c = tl.video[0]; TlCanvas.select(__c, TlCanvas.layerOf(__c));
    });
    await p.waitForTimeout(600);
    const px = () => ev(() => { const S = TlCanvas.state, c = document.createElement("canvas"); c.width = 32; c.height = 18;
      const g = c.getContext("2d"); g.save(); g.scale(32 / S.W, 18 / S.H); TlCanvas.paintComp(g, S.t); g.restore();
      const d = g.getImageData(0, 0, 32, 18).data; return { centre: d[(9 * 32 + 16) * 4], corner: d[(1 * 32 + 1) * 4] }; });

    /* ---- 1. ◯ a mask on the grade */
    await p.click("#tlColourBtn");
    await p.waitForFunction(() => document.getElementById("tcpMaskShape"), null, { timeout: 10000 });
    const before = await px();
    await p.selectOption("#tcpMaskShape", "ellipse");
    await p.waitForFunction(() => document.querySelector('#tcpMask [data-mk="feather"]'), null, { timeout: 5000 });
    await ev(() => { const r = document.querySelector('#tcpMask [data-mk="feather"]'); r.value = "0"; r.dispatchEvent(new Event("change")); TlCanvas.draw(); });
    await p.waitForTimeout(500);
    const inside = await px();
    await ev(() => { const c = document.getElementById("tcpMaskInv"); c.checked = true; c.dispatchEvent(new Event("change")); TlCanvas.draw(); });
    await p.waitForTimeout(500);
    const outside = await px();
    const mk = await ev(() => tl.video[0].fx.mask);
    check("◯ Mask: the whole picture dark before; an ellipse = the grade inside only (the corner as shot); invert = outside only - kept on the clip",
      before.centre < 100 && before.corner < 100 && inside.centre < 100 && inside.corner > 150 && outside.centre > 150 && outside.corner < 100 && mk.shape === "ellipse" && mk.invert === true && mk.feather === 0, { before, inside, outside, mk });

    /* ---- 2. 🎯 track */
    await ev(() => {
      tl.video = [{ name: "uiball.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1, fx: { grade: { exposure: 1 }, mask: { shape: "ellipse", x: 190 / 640, y: (180 + 40 * Math.sin(1)) / 360, w: 0.07, h: 0.12, feather: 0.02 } } }];
      tlSave(); renderTimeline(); window.__c = tl.video[0]; TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.go(0.5);
      document.querySelector("#tlColourDlg .fx-x").click();
    });
    await p.click("#tlColourBtn");
    await p.waitForFunction(() => document.getElementById("tcpMaskTrack"), null, { timeout: 10000 });
    await ev(() => document.getElementById("tcpMaskTrack").click());
    await p.waitForFunction(() => /tracked \d+ samples/.test((document.getElementById("tcpMaskMsg") || {}).textContent || ""), null, { timeout: 60000 }).catch(() => {});
    const tr = await ev(() => { const m = tl.video[0].fx.mask, at = H3ClipFx.maskAt(m, 2.0); return { n: (m.track || []).length, first: m.track && m.track[0].at, at, msg: document.getElementById("tcpMaskMsg").textContent }; });
    check("🎯 Track from the position marker (0.5 s): ~35 samples to the clip's end; at 2 s the mask is on the ball (within 3 % of the frame)",
      tr.n >= 30 && tr.first >= 0.45 && Math.abs(tr.at.x * 640 - 340) < 20 && Math.abs(tr.at.y * 360 - (180 + 40 * Math.sin(4))) < 15, tr);
    await ev(() => document.querySelector("#tlColourDlg .fx-x").click());

    /* ---- 3. 🎥 multi-camera */
    await ev(() => {
      tl.video = [{ name: "uicamA.webm", src: "video", in: 0, out: 8, dur: 8, start: 0, opacity: 1 }];
      tl.vlayers = [mkLayer("V2", [{ name: "uicamB.webm", src: "video", in: 0, out: 8, dur: 8, start: 0, opacity: 1 }])];
      tlSave(); renderTimeline(); TlCanvas.go(0);
    });
    await p.click("#tlMulticamBtn");
    await p.waitForFunction(() => document.getElementById("tmcMake"), null, { timeout: 10000 });
    await ev(() => document.getElementById("tmcMake").click());
    await p.waitForFunction(() => tl.multicam && document.querySelectorAll("#tlMulticamDlg .tmc-tile").length === 2, null, { timeout: 60000 }).catch(() => {});
    const m1 = await ev(() => ({ a: tl.multicam && tl.multicam.angles.map((x) => [x.name, x.off]), v1: tl.video.map((c) => [c.name, c.start, c.soundOut]), layers: tl.vlayers.length,
      snd: (tl.audio || []).filter((L) => L.mcSound).map((L) => L.clips.map((c) => [c.name, c.src, c.start])), msg: (document.getElementById("tmcMsg") || {}).textContent }));
    check("🎥 Sync by sound: camB placed 1.75 s after camA; V1 = the program (camA, its own sound out), the angle's layer gone, a 🎥 Sound layer (camA's sound)",
      m1.a && m1.a[1][0] === "uicamB.webm" && Math.abs(m1.a[1][1] - 1.75) < 0.02 && m1.v1.length === 1 && m1.v1[0][0] === "uicamA.webm" && m1.v1[0][2] === true && m1.layers === 0
      && m1.snd.length === 1 && m1.snd[0][0][0] === "uicamA.webm" && m1.snd[0][0][1] === "video", m1);
    await ev(() => { TlCanvas.go(4); });
    await p.waitForTimeout(300);
    await ev(() => document.body.focus());
    await p.keyboard.press("Digit2");
    await p.waitForTimeout(300);
    const m2 = await ev(() => ({ cuts: tl.multicam.cuts, v1: tl.video.map((c) => [c.name, c.start, +c.in.toFixed(2)]), on: [...document.querySelectorAll("#tlMulticamDlg .tmc-tile")].map((x) => x.classList.contains("on")) }));
    check("...key 2 at 4 s: a cut to camB there - V1 = camA then camB (from its own 2.25 s), the playing angle outlined",
      m2.cuts.length === 2 && m2.v1.length === 2 && m2.v1[1][0] === "uicamB.webm" && Math.abs(m2.v1[1][1] - 4) < 0.05 && Math.abs(m2.v1[1][2] - 2.25) < 0.05 && m2.on[1] === true && m2.on[0] === false, m2);
    await ev(() => { document.getElementById("tmcFlat").click(); document.querySelector("#tlMulticamDlg .fx-x").click(); });
    const fl = await ev(() => ({ mc: !!tl.multicam, v1: tl.video.length, mcKeys: tl.video.some((c) => c.mc != null) }));
    check("...⇲ Flatten: the cuts stay as ordinary clips, multi-camera ends", !fl.mc && fl.v1 === 2 && !fl.mcKeys, fl);

    /* ---- 4. 🪶 proxies */
    await ev(() => { tl.audio = []; tl.video = [{ name: "uibig.webm", src: "video", in: 0, out: 2, dur: 2, start: 0, opacity: 1 }]; tlSave(); renderTimeline(); TlCanvas.go(1); });
    await p.click("#tlProxyBtn");
    await p.waitForFunction(() => /2560×1440/.test((document.getElementById("tpxList") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    const row = await ev(() => document.getElementById("tpxList").textContent);
    await ev(() => document.getElementById("tpxHeavy").click());
    await p.waitForFunction(() => /✓ made/.test((document.getElementById("tpxList") || {}).textContent || ""), null, { timeout: 120000 }).catch(() => {});
    await ev(() => { const c = document.getElementById("tpxOn"); c.checked = true; c.dispatchEvent(new Event("change")); TlCanvas.go(1); TlCanvas.draw(); });
    await p.waitForTimeout(800);
    const src = await ev(() => { const bx = TlCanvas.box(tl.video[0], "v1", 1); return bx && bx.src ? (bx.src.currentSrc || bx.src.src || "") : ""; });
    check("🪶 Proxies: the 2560-wide clip listed heavy; 🪶 Make for the heavy ones -> ✓ made; play proxies on = the canvas plays /api/proxy/file/…",
      /● 2560×1440/.test(row) && /\/api\/proxy\/file\/uibig_[0-9a-f]+\.webm/.test(src), { row: row.slice(0, 300), src });
    await ev(() => { delete tl.proxies; tlSave(); document.querySelector("#tlProxyDlg .fx-x").click(); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.audio = []; delete tl.multicam; delete tl.proxies; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
