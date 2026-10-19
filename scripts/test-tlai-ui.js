#!/usr/bin/env node
/* bitGen Studio — 2.420.0 in a REAL browser against the REAL app (the stub renderer): 🤖 AI INSIDE THE TIMELINE - a new
 * take of a clip in its own slot (⇆ back to the first), ⇥ extend it from its last frame (the next clip moves on), 🎞
 * B-roll into a gap and a cutaway over the selection (its sound off), ♪ the beats of a song -> ⚑ markers and ✂ cuts -
 * every render with the prompt docker's words and the ⊖ negative.
 * Tim: "yes, please add your 2 suggestions". Run against the running app (H3_URL, default :8311). No Playwright = SKIP. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.420 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_tlaiui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "tlaiui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const VP9 = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "realtime", "-cpu-used", "8"];
ff(["-f", "lavfi", "-i", "testsrc2=s=320x180:r=24:d=4"].concat(VP9, [path.join(T, "uiai.webm")]));
ff(["-f", "lavfi", "-i", "aevalsrc='0.8*sin(2*PI*880*t)*exp(-40*mod(t,0.5))':s=44100:d=8", "-ac", "2", path.join(T, "uisong.wav")]);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2400, height: 1350 } });
  const errs = [], negs = [];   // negs: one per render job
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const jobIds = [];
  p.on("response", (r) => { if (/\/api\/(generate|ltx)$/.test(r.url()) && r.request().method() === "POST") r.json().then((j) => { if (j && j.id) jobIds.push(j.id); }).catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    for (const f of ["uiai.webm", "uisong.wav"]) { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlAI && window.H3TlAi && document.getElementById("tlAiBtn") && window.H3Neg, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      const gm = document.getElementById("genModeSel"); gm.value = "video"; gm.dispatchEvent(new Event("change"));
      const vs = document.getElementById("videoStyleSel"); if (vs) vs.value = "";
      tl.video = [{ name: "uiai.webm", src: "video", in: 0, out: 2, dur: 4, start: 0, opacity: 1 }, { name: "uiai.webm", src: "video", in: 2, out: 4, dur: 4, start: 3, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = [mkLayer("A1", [{ name: "uisong.wav", start: 0, in: 0, out: 8, dur: 8 }])]; tl.sel = null; tl.seqMarkers = [];
      const pr = document.getElementById("prompt"); pr.value = "a red fox runs through snow"; pr.dispatchEvent(new Event("input"));
      H3Neg.set("blurry, text");
      tlSave(); renderTimeline(); TlCanvas.go(0.5);
      tlSelClip = tl.video[0];
    });
    await p.click("#tlAiBtn");
    await p.waitForFunction(() => document.getElementById("taiTake") && /a red fox/.test(document.getElementById("taiPrompt").textContent), null, { timeout: 10000 });
    const pv = await ev(() => document.getElementById("taiPrompt").textContent);
    check("🤖 the dialog shows the prompt docker's words and the ⊖ negative it will render with", /a red fox runs through snow/.test(pv) && /blurry, text/.test(pv), pv);

    /* ---- 🔁 a new take */
    await p.click("#taiTake");
    await p.waitForFunction(() => tl.video[0].takes && tl.video[0].takes.length === 2, null, { timeout: 180000 }).catch(() => {});
    const t1 = await ev(() => { const c = tl.video[0]; return { n: c.takes && c.takes.length, name: c.name, start: c.start, len: +(c.out - c.in).toFixed(3), slot: c.slot, opts: document.querySelectorAll("#taiTakes option").length, msg: document.getElementById("taiMsg").textContent }; });
    check("🔁 New take: a new file in the clip's own slot (start 0, 2 s), the old one kept as take 1 (⇆ lists both)", t1.n === 2 && t1.name !== "uiai.webm" && t1.start === 0 && Math.abs(t1.len - 2) < 0.05 && t1.opts === 2, t1);
    await p.selectOption("#taiTakes", "0");
    const t0 = await ev(() => { const c = tl.video[0]; return { name: c.name, in: c.in, out: c.out, take: c.take }; });
    check("...⇆ take 1 brings the original back exactly", t0.name === "uiai.webm" && t0.in === 0 && t0.out === 2 && t0.take === 0, t0);

    /* ---- ⇥ extend */
    await ev(() => { document.getElementById("taiExtSecs").value = "2"; tlSelClip = tl.video[0]; });
    await p.click("#taiExtend");
    await p.waitForFunction(() => tl.video.length === 3, null, { timeout: 180000 }).catch(() => {});
    const ex = await ev(() => tl.video.map((c) => [c.name === "uiai.webm" ? "orig" : "new", +c.start.toFixed(3), +(c.out - c.in).toFixed(3)]));
    check("⇥ Extend 2 s: the new clip right after it (2 - 4 s), the next clip moved on (3 -> 5 s)", ex.length === 3 && ex[1][0] === "new" && ex[1][1] === 2 && Math.abs(ex[1][2] - 2) < 0.1 && ex[2][1] === 5, ex);

    /* ---- 🎞 B-roll: the gap 4 - 5 s, then a cutaway */
    await ev(() => { TlCanvas.go(4.5); document.getElementById("taiBrollHow").value = "gap"; });
    await p.click("#taiBroll");
    await p.waitForFunction(() => tl.video.length === 4, null, { timeout: 180000 }).catch(() => {});
    const br = await ev(() => tl.video.map((c) => [+c.start.toFixed(3), +(c.out - c.in).toFixed(3)]));
    check("🎞 B-roll fills the empty stretch of V1 under the position marker (4 - 5 s)", br.length === 4 && br[2][0] === 4 && Math.abs(br[2][1] - 1) < 0.05, br);
    await ev(() => { tl.sel = { a: 0.5, b: 1.5 }; document.getElementById("taiBrollHow").value = "cut"; });
    await p.click("#taiBroll");
    await p.waitForFunction(() => (tl.vlayers || []).some((L) => L.name === "B-roll"), null, { timeout: 180000 }).catch(() => {});
    const cw = await ev(() => { const L = (tl.vlayers || []).find((x) => x.name === "B-roll"); return L && { muted: L.muted, c: L.clips.map((c) => [c.start, +(c.out - c.in).toFixed(3)]) }; });
    check("...a cutaway over the ruler selection: a new 'B-roll' layer, 0.5 - 1.5 s, its sound off (V1's carries on)", cw && cw.muted === true && cw.c.length === 1 && cw.c[0][0] === 0.5 && Math.abs(cw.c[0][1] - 1) < 0.05, cw);
    for (const id of jobIds) { const g = await (await fetch(URL_ + "api/jobs/" + id)).json(); negs.push((g.params || {}).negative_prompt === "blurry, text"); }
    check("every render took the ⊖ negative docker's text (its job's negative_prompt)", negs.length >= 4 && negs.every(Boolean), negs);

    /* ---- ♪ beats */
    await ev(() => { tl.sel = null; });
    await p.click("#taiBeats");
    await p.waitForFunction(() => TlAI.beats() && TlAI.beats().beats.length, null, { timeout: 60000 }).catch(() => {});
    const bi = await ev(() => ({ info: document.getElementById("taiBeatInfo").textContent, b: TlAI.beats() }));
    check("♪ Find the beats of the song on A1: 120 BPM", bi.b && Math.abs(bi.b.tempo - 120) < 1.5 && /120/.test(bi.info), bi.info);
    await p.click("#taiMarkBeats");
    const mk = await ev(() => (tl.seqMarkers || []).filter((m) => /^♪/.test(m.name)).map((m) => m.t));
    check("⚑ Beat markers: one on every beat (purple, '♪ n')", mk.length >= 14 && Math.abs(mk[1] - mk[0] - 0.5) < 0.03, mk.slice(0, 5));
    await ev(() => { tlSelClip = tl.video[0]; document.getElementById("taiEvery").value = "1"; });
    await p.click("#taiCutBeats");
    const cb = await ev(() => tl.video.filter((c) => c.start < 2).map((c) => [+c.start.toFixed(3), +c.in.toFixed(3), +c.out.toFixed(3)]));
    check("✂ Cut the selected clip (0 - 2 s) on the beats: pieces at 0.5 / 1 / 1.5 s - the same file, nothing removed", cb.length === 4 && Math.abs(cb[1][0] - 0.5) < 0.02 && Math.abs(cb[2][0] - 1) < 0.02 && Math.abs(cb[3][0] - 1.5) < 0.02 && cb[3][2] === 2 && cb.every((x) => Math.abs(x[0] - x[1]) < 1e-6), cb);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.audio = []; tl.images = []; tl.seqMarkers = []; H3Neg.set(""); document.getElementById("prompt").value = ""; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
