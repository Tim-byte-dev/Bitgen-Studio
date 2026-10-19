#!/usr/bin/env node
/* bitGen Studio — 2.406.0: the timeline clip fx, the 🎚 Mix and the 💬 Captions in a REAL browser against the REAL app.
 * Tim: "lets start closing the gap and go with your suggestions as you see fit" (speed ramps / reverse, a colour grade
 * with LUTs, caption tracks, audio clean-up + ducking).
 *   1. a V1 clip selected -> the Properties panel has 🎬 Speed, 🎨 Colour, 🎧 Sound; speed 200 % halves it on the
 *      timeline (the clip's width) and the canvas shows the source's 2 s at 1 s; ⇄ reverse starts it at its end
 *   2. 🎨 the mono look greys the canvas; ＋ LUT imports a .cube (listed, picked); the canvas's grade = the compile's
 *      (a warm + contrast grade, compiled with ⚙ Compile and measured against the canvas at the same second)
 *   3. 🎧 the role + clean-up stored; 🎧 before / after asks the server for its wav; 🎚 Mix: a dialog with a TITLE BAR,
 *      roles per layer, ducking + loudness stored on the timeline
 *   4. 💬 Captions: a dialog with a TITLE BAR; ＋ a cue at the marker, edited; drawn on the canvas while it is up (and
 *      not after); ✨ From speech says what is missing when speech-to-text is not installed
 *   5. ⚙ Compile sends the fx, the roles, the mix and the captions; no page errors
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the clip fx browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const FX = require(path.join(ROOT, "static", "clipfx.js"));
const P = "zz_clipfxui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "clipfxui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "color=c=gray:s=320x180:r=30:d=4,geq=lum='20+50*T':cb=128:cr=128", "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-shortest", path.join(T, "uifxbase.webm")]);
ff(["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=2", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "20", "-deadline", "realtime", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-shortest", path.join(T, "uifxcolor.webm")]);
ff(["-f", "lavfi", "-i", "sine=frequency=220:duration=4", "-ac", "2", path.join(T, "uifxmusic.wav")]);
fs.writeFileSync(path.join(T, "My Look.cube"), FX.toCube(FX.buildLut({ grade: { saturation: 0 } }, null, 17), 17, "grey"));
function rgbAt(f, t) {
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "scale=320:180,format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 });
  const m = [0, 0, 0]; for (let i = 0; i < buf.length; i++) m[i % 3] += buf[i]; return m.map((v) => v / (buf.length / 3));
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    for (const f of ["uifxbase.webm", "uifxcolor.webm"]) {
      const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f);
      await fetch(URL_ + "api/passets", { method: "POST", body: fd });
    }
    fs.mkdirSync(path.join(ROOT, "projects", P, "sound"), { recursive: true });
    fs.copyFileSync(path.join(T, "uifxmusic.wav"), path.join(ROOT, "projects", P, "sound", "uifxmusic.wav"));
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlCanvas && window.TlClipFx && window.TlCaptions && window.H3ClipFx && window.H3GradeGL && document.getElementById("tlCapBtn") && document.getElementById("tlMixBtn"), null, { timeout: 30000 });
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "uifxbase.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }];
      tl.vlayers = []; tl.images = []; delete tl.mix; delete tl.captions;
      tl.audio = [mkLayer("A1", [{ name: "uifxmusic.wav", start: 0, in: 0, out: 4, dur: 4, volume: 1 }])];
      tlSave(); renderTimeline();
      window.__c = tl.video[0];
      TlCanvas.select(__c, TlCanvas.layerOf(__c));
    });
    // a frame of the canvas once the clip's video has seeked to where the canvas wants it
    const shot = async (t, region) => p.evaluate(async ([t, region]) => {
      TlCanvas.go(t);
      const c = __c, want = TlCanvas.srcAt(c, t);
      for (let i = 0; i < 80; i++) {
        TlCanvas.draw();
        const b = TlCanvas.box(c, "v1", t), v = b && b.src;
        if (v && v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - want) < 0.05) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 150));
      const url = TlCanvas.snapshot();
      const im = new Image(); im.src = url; await im.decode();
      const cv = document.createElement("canvas"); cv.width = 320; cv.height = 180;
      const g = cv.getContext("2d"); g.drawImage(im, 0, 0, 320, 180);
      const r = region || [0, 0, 320, 180];
      const d = g.getImageData(r[0], r[1], r[2], r[3]).data, m = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; }
      return m.map((v) => v / (d.length / 4));
    }, [t, region || null]);

    /* ---- 1. speed / reverse */
    const pr = await p.evaluate(() => ({ speed: !!document.getElementById("tfxSpeed"), colour: !!document.getElementById("tfxColour"), sound: !!document.getElementById("tfxSound") }));
    check("the Properties panel of a V1 clip: 🎬 Speed, 🎨 Colour, 🎧 Sound", pr.speed && pr.colour && pr.sound, pr);
    const plain2 = await shot(2);
    check("the canvas draws the clip (the browser decodes it)", plain2[0] > 20, plain2);
    const w0 = await p.evaluate(() => effDur(__c));
    await p.evaluate(() => { const d = document.getElementById("tfxSpeed"); d.open = true; const i = document.getElementById("tfxSp"); i.value = "200"; i.dispatchEvent(new Event("change")); });
    const s1 = await p.evaluate(() => ({ fx: __c.fx, eff: effDur(__c), src: TlCanvas.srcAt(__c, 1), len: document.getElementById("tfxLen").textContent, end: sceneEnd() }));
    check("speed 200 %: stored, the clip covers 2 s (was 4)", s1.fx && s1.fx.speed === 2 && Math.abs(s1.eff - 2) < 1e-6 && w0 === 4 && /4\.00 s of source → 2\.00 s/.test(s1.len), s1);
    const fast1 = await shot(1);
    check("speed 200 %: the canvas at 1 s shows the source's 2 s", Math.abs(fast1[0] - plain2[0]) < 6, [fast1, plain2]);
    await p.evaluate(() => { const i = document.getElementById("tfxRev"); i.checked = true; i.dispatchEvent(new Event("change")); });
    const plain38 = await p.evaluate(() => TlCanvas.srcAt(__c, 0.1));
    check("⇄ reverse: the clip starts at its end (source 3.8 s at 0.1 s)", Math.abs(plain38 - 3.8) < 1e-6, plain38);
    const rv = await shot(0.1);
    check("⇄ reverse: the canvas starts bright", rv[0] > fast1[0] + 40, [rv, fast1]);
    await p.evaluate(() => { TlCanvas.paintProps(); const r = document.getElementById("tfxRamp"); r.value = "slow → fast"; r.dispatchEvent(new Event("change")); });
    const rp = await p.evaluate(() => ({ fx: __c.fx, eff: effDur(__c), dis: document.getElementById("tfxSp").disabled }));
    check("ramp slow → fast: stored (reverse kept), its length = static/clipfx.js's, speed box off", rp.fx.ramp && rp.fx.reverse && Math.abs(rp.eff - FX.timelineLen(4, FX.normalize(rp.fx))) < 1e-6 && rp.dis, rp);
    await p.evaluate(() => { delete __c.fx; tlSave(); renderTimeline(); TlCanvas.paintProps(); });

    /* ---- 2. colour */
    await p.evaluate(() => { tl.video = [{ name: "uifxcolor.webm", src: "video", in: 0, out: 2, dur: 2, start: 0, opacity: 1 }]; window.__c = tl.video[0]; tl.audio = []; tlSave(); renderTimeline(); TlCanvas.select(__c, TlCanvas.layerOf(__c)); });
    const col0 = await shot(1);
    await p.evaluate(() => { document.getElementById("tfxColour").open = true; const s = document.getElementById("tfxLook"); s.value = "mono"; s.dispatchEvent(new Event("change")); });
    const mono = await shot(1);
    const lk = await p.evaluate(() => __c.fx);
    check("🎨 the mono look: stored (look + its grade), the canvas grey", lk && lk.look === "mono" && lk.grade.saturation === 0 && Math.abs(mono[0] - mono[1]) < 3 && Math.abs(mono[1] - mono[2]) < 3 && Math.abs(col0[0] - col0[2]) > 3, [lk, mono, col0]);
    await p.setInputFiles("#tfxLutFile", path.join(T, "My Look.cube"));
    await p.waitForFunction(() => __c.fx && __c.fx.lut === "My Look.cube", null, { timeout: 10000 }).catch(() => {});
    const lt = await p.evaluate(() => ({ fx: __c.fx, opts: [...document.querySelectorAll("#tfxLut option")].map((o) => o.value) }));
    check("＋ LUT: imported into the project, listed and picked", lt.fx && lt.fx.lut === "My Look.cube" && lt.opts.includes("My Look.cube") && fs.existsSync(path.join(ROOT, "projects", P, "luts", "My Look.cube")), lt);
    await p.evaluate(() => { tl.video = [{ name: "uifxbase.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }]; window.__c = tl.video[0]; tlSave(); renderTimeline(); TlCanvas.select(__c, TlCanvas.layerOf(__c)); });
    const grey1 = await shot(1);
    await p.evaluate(() => { __c.fx = { grade: { temperature: 60, contrast: 25, exposure: 0.3 } }; tlSave(); TlCanvas.paintProps(); });
    const warm = await shot(1);
    check("a warm grade on the canvas (the grey clip): red over blue", warm[0] - warm[2] > grey1[0] - grey1[2] + 8, [warm, grey1]);

    /* ---- 3. sound + mix */
    await p.evaluate(() => {
      const d = document.getElementById("tfxSound"); d.open = true;
      const v = document.getElementById("tfxVoice"); v.checked = true; v.dispatchEvent(new Event("change"));
      const g = document.getElementById("tfxGain"); g.value = "-6"; g.dispatchEvent(new Event("change"));
      const r = document.getElementById("tfxRole"); r.value = "voice"; r.dispatchEvent(new Event("change"));
    });
    const sd = await p.evaluate(() => ({ afx: __c.fx.afx, role: tl.v1.role, grade: !!__c.fx.grade }));
    check("🎧 voice clarity + gain stored on the clip (the grade kept), V1's role stored", sd.afx && sd.afx.voice && sd.afx.gain === -6 && sd.role === "voice" && sd.grade, sd);
    await p.evaluate(() => { tl.video = [{ name: "uifxbase.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }]; window.__c = tl.video[0]; tlSave(); renderTimeline(); TlCanvas.select(__c, TlCanvas.layerOf(__c)); document.getElementById("tfxSound").open = true; });
    const hear = p.waitForResponse((r) => /api\/clipfx\/afx-preview/.test(r.url()), { timeout: 20000 }).catch(() => null);
    await p.click("#tfxHear");
    const hr = await hear;
    check("🎧 before / after: the server answers a wav", hr && hr.status() === 200 && /audio\/wav/.test(hr.headers()["content-type"] || ""), hr && hr.status());
    await p.click("#tlMixBtn");
    const md = await p.evaluate(() => {
      const d = document.getElementById("tlMixDlg"), bar = d && d.querySelector(".fx-title");
      return { open: d && d.open, title: bar && bar.querySelector("h2").textContent, x: !!(bar && bar.querySelector(".fx-x")), first: d && d.firstElementChild === bar,
               roles: [...d.querySelectorAll("select[id^=tfxMR]")].length };
    });
    check("🎚 Mix: a dialog with a TITLE BAR (Mix + ✕), a role per layer (V1 - the sound layer is gone)", md.open && md.title === "Mix" && md.x && md.first && md.roles === 1, md);
    await p.evaluate(() => {
      const c = document.getElementById("tfxDuck"); c.checked = true; c.dispatchEvent(new Event("change"));
      const a = document.getElementById("tfxDuckAmt"); a.value = "15"; a.dispatchEvent(new Event("change"));
      const l = document.getElementById("tfxLoud"); l.checked = true; l.dispatchEvent(new Event("change"));
      const s = document.getElementById("tfxLoudT"); s.value = "-16"; s.dispatchEvent(new Event("change"));
    });
    const mx = await p.evaluate(() => tl.mix);
    check("🎚 ducking 15 dB + loudness -16 stored on the timeline", mx && mx.duck.on && mx.duck.amount === 15 && mx.loudness.on && mx.loudness.target === -16, mx);
    await p.keyboard.press("Escape");
    check("🎚 Esc closes it", !(await p.evaluate(() => document.getElementById("tlMixDlg").open)));

    /* ---- 4. captions */
    await p.click("#tlCapBtn");
    await p.waitForFunction(() => document.getElementById("tlCapDlg") && document.getElementById("tlCapDlg").open && document.getElementById("tcapBuild"), null, { timeout: 10000 });
    const cd = await p.evaluate(() => {
      const d = document.getElementById("tlCapDlg"), bar = d.querySelector(".fx-title");
      return { title: bar.querySelector("h2").textContent, x: !!bar.querySelector(".fx-x"), first: d.firstElementChild === bar, msg: document.getElementById("tcapMsg").textContent };
    });
    check("💬 Captions: a dialog with a TITLE BAR (Captions + ✕)", cd.title === "Captions" && cd.x && cd.first, cd);
    const noCap = await shot(1, [0, 120, 320, 60]);
    await p.evaluate(() => {
      TlCanvas.go(0.5); document.getElementById("tcapAdd").click();
      const tx = document.querySelector('#tcapList input[data-k="text"]'); tx.value = "HELLO FROM THE TEST"; tx.dispatchEvent(new Event("change"));
      const b = document.getElementById("tcapBox"); b.checked = true; b.dispatchEvent(new Event("change"));
      const bc = document.getElementById("tcapBoxC"); bc.value = "#ff0000"; bc.dispatchEvent(new Event("change"));
      const bo = document.getElementById("tcapBoxO"); bo.value = "100"; bo.dispatchEvent(new Event("change"));
      const sz = document.getElementById("tcapSize"); sz.value = "12"; sz.dispatchEvent(new Event("change"));
      const s = document.getElementById("tcapSrt"); s.checked = true; s.dispatchEvent(new Event("change"));
    });
    const cs = await p.evaluate(() => tl.captions);
    check("＋ a caption at the marker (0.5 .. 2.5 s), its words, the style, burn + .srt stored", cs && cs.cues.length === 1 && cs.cues[0].start === 0.5 && cs.cues[0].end === 2.5 && cs.cues[0].text === "HELLO FROM THE TEST"
      && cs.style.box && cs.style.box_color === "#ff0000" && cs.burn && cs.srt, cs);
    const onCap = await shot(1, [0, 120, 320, 60]), offCap = await shot(3, [0, 120, 320, 60]), offPlain = noCap;
    check("💬 drawn on the canvas while it is up (a red box at the bottom), not after", onCap[0] - onCap[2] > 40 && Math.abs(offCap[0] - offCap[2]) < 25, [onCap, offCap, offPlain]);
    await p.evaluate(() => document.getElementById("tcapBuild").click());
    await p.waitForFunction(() => !document.getElementById("tcapBuild").disabled, null, { timeout: 30000 });
    await p.waitForTimeout(300);
    const asrOn = await api("/api/captions/info");
    const after = await p.evaluate(() => ({ kept: tl.captions.cues.length, msg: document.getElementById("tcapMsg").textContent }));
    check("✨ From speech: without speech-to-text it says so (before and after asking) and the captions stay", asrOn.asr.installed ? true
      : /not installed/.test(cd.msg) && /⚠ speech-to-text \(faster-whisper\) is not installed/.test(after.msg) && after.kept === 1, { msg: cd.msg, after });
    await p.evaluate(() => document.querySelector("#tlCapDlg .fx-x").click());

    /* ---- 5. compile: what is sent, and the grade matches the canvas */
    await p.evaluate(() => {
      tl.video = [{ name: "uifxbase.webm", src: "video", in: 0, out: 2, dur: 4, start: 0, opacity: 1, fx: { grade: { temperature: 60, contrast: 25, exposure: 0.3 }, afx: { voice: true } } }];
      window.__c = tl.video[0]; tl.v1.role = "voice";
      tl.audio = [Object.assign(mkLayer("A1", [{ name: "uifxmusic.wav", start: 0, in: 0, out: 2, dur: 4, volume: 1, fx: { afx: { denoise: 0.4 } } }]), { role: "music" })];
      tl.captions.visible = false;            // the grade compare wants the clean picture
      tlSave(); renderTimeline(); TlCanvas.select(__c, TlCanvas.layerOf(__c));
    });
    const canvasWarm = await shot(1);
    let sent = null;
    await p.route("**/api/export", async (route) => { sent = JSON.parse(route.request().postData() || "{}"); await route.continue(); });
    const answered = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 20000 }).catch(() => null);
    await p.evaluate(() => document.getElementById("tlExport").click());
    const ar = await answered;
    const job = ar ? await ar.json().catch(() => null) : null;
    check("⚙ Compile sends the clip fx (+ dur), V1's role, the mix, the sound clip's clean-up + role; hidden captions stay home",
      sent && sent.video[0].fx.grade.temperature === 60 && sent.video[0].dur === 4 && sent.video_role === "voice" && sent.mix.duck.amount === 15
      && sent.audio[0].clips[0].fx.afx.denoise === 0.4 && sent.audio[0].clips[0].role === "music" && sent.captions === undefined, sent);
    let st = "", out = "";
    for (let i = 0; i < 180 && job; i++) { const g = await api("/api/jobs/" + job.id); st = g.status; out = g.output; if (st === "done" || st === "failed") break; await new Promise((r) => setTimeout(r, 1000)); }
    const file = out ? path.join(ROOT, "projects", P, out) : "";
    check("⚙ Compile: done", st === "done" && fs.existsSync(file), { st, out });
    if (st === "done") {
      const m = rgbAt(file, 1);
      check("the compile's grade = the canvas's (within 8 levels per channel)", m.every((v, i) => Math.abs(v - canvasWarm[i]) < 8), { compile: m, canvas: canvasWarm });
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
