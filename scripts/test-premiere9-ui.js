#!/usr/bin/env node
/* bitGen Studio — 2.414.0 in a REAL browser against the REAL app: ⧉ NEST a timeline (the menu-bar button, the chooser,
 * the compile, a new layer with the ⧉ badge), the nested timeline saved again -> ↻ out of date -> Properties ↻ Re-render;
 * a timeline into itself refused; ⇄ Exchange to FCPXML (Final Cut Pro X) and back in; 📝 the transcript across the
 * WHOLE SEQUENCE (two clips on two layers as one text, a cut in the second ripples every layer).
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.414 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const X = require(path.join(ROOT, "static", "textedit.js"));
const P = "zz_prem9ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem9ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "color=c=0xd02020:s=320x180:r=25:d=3", "-f", "lavfi", "-i", "sine=frequency=500:duration=3", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(T, "nred.webm")]);
ff(["-f", "lavfi", "-i", "color=c=0x2040d0:s=320x180:r=25:d=4", "-f", "lavfi", "-i", "sine=frequency=300:duration=4", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", "-c:a", "libopus", "-shortest", path.join(T, "nblue.webm")]);
const SAID = { "nred.webm": [{ start: 0.3, end: 0.6, word: "one" }, { start: 0.8, end: 1.1, word: "two" }],
               "nblue.webm": [{ start: 0.5, end: 0.8, word: "three" }, { start: 1.0, end: 1.4, word: "four" }, { start: 2.0, end: 2.3, word: "five" }] };

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2400, height: 1350 }, acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    const pdir = path.join(ROOT, "projects", P);
    for (const f of ["nred.webm", "nblue.webm"]) { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    fs.mkdirSync(path.join(pdir, "sound"), { recursive: true });
    ff(["-f", "lavfi", "-i", "sine=frequency=220:duration=4", path.join(pdir, "sound", "nmusic.wav")]);
    await api("/api/timelines/inner", { tl: { video: [{ name: "nred.webm", src: "video", in: 0.5, out: 2.5, dur: 3, start: 0, opacity: 1 }], vlayers: [], audio: [], images: [] }, activate: false });
    await p.route("**/api/textedit/words", async (route) => {
      const nm = (JSON.parse(route.request().postData() || "{}").name) || "";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, words: SAID[nm] || [], cached: true }) });
    });
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlNest && document.getElementById("tlNestBtn") && window.TlTextEdit && document.getElementById("tlTextBtn") && document.getElementById("tlExchangeBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      document.documentElement.style.setProperty("--tlsh", "420px");
      tl.video = [{ name: "nblue.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tl.seqMarkers = []; tl.selLayer = "v1";
      PXS = 60; tlSave(); renderTimeline(); if (window.TlFloat) TlFloat.show(false); TlCanvas.go(0.5); setPlayhead(0.5);
    });
    await p.waitForTimeout(400);

    /* ---- 1. ⧉ nest through the button + the chooser */
    await p.click("#tlNestBtn");
    await p.waitForFunction(() => { const d = document.getElementById("askdlg"); return d && d.open && [...document.querySelectorAll("#ask_list button")].some((x) => x.textContent === "inner"); }, null, { timeout: 15000 });
    const offered = await ev(() => [...document.querySelectorAll("#ask_list button")].map((x) => x.textContent));
    await ev(() => [...document.querySelectorAll("#ask_list button")].find((x) => x.textContent === "inner").click());
    await p.waitForFunction(() => (tl.vlayers || []).some((L) => L.name === "⧉ inner" && L.clips[0] && L.clips[0].nest === "inner"), null, { timeout: 120000 }).catch(() => {});
    const n1 = await ev(() => { const L = (tl.vlayers || []).find((x) => x.name === "⧉ inner"); const c = L && L.clips[0];
      const el = [...document.querySelectorAll("#tlinner .clip")].find((e) => e._clip === c), bd = el && el.querySelector(".tlnest");
      return { offered: null, c, badge: bd ? bd.textContent : null, stale: bd ? bd.classList.contains("stale") : null }; });
    check("⧉ Nest: the chooser offers the other timelines (not this one); \"inner\" compiled into ONE clip on a new layer \"⧉ inner\" at the position marker (2 s, its file in video/)",
      offered.includes("inner") && !offered.includes("main") && n1.c && n1.c.src === "video" && /^nest_inner_[0-9a-f]{8}\.mp4$/.test(n1.c.name) && Math.abs(n1.c.dur - 2) < 0.1 && n1.c.start === 0.5
      && /^[0-9a-f]{16}$/.test(n1.c.nestHash || "") && fs.existsSync(path.join(pdir, "video", n1.c.name)), { offered, n1 });
    check("...the clip wears the ⧉ badge (up to date)", n1.badge === "⧉ inner" && n1.stale === false, n1);

    /* ---- 2. the nested timeline changed -> ↻ out of date -> ↻ Re-render */
    await api("/api/timelines/inner", { tl: { video: [{ name: "nred.webm", src: "video", in: 0.5, out: 1.5, dur: 3, start: 0, opacity: 1 }], vlayers: [], audio: [], images: [] }, activate: false });
    await p.waitForTimeout(1700);
    await ev(() => TlNest.refresh());
    await p.waitForFunction(() => { const b = document.querySelector("#tlinner .clip .tlnest"); return b && b.classList.contains("stale"); }, null, { timeout: 10000 }).catch(() => {});
    const s1 = await ev(() => { const bd = document.querySelector("#tlinner .clip .tlnest"); return { t: bd && bd.textContent, stale: bd && bd.classList.contains("stale") }; });
    check("\"inner\" saved again (trimmed): the badge says ↻ out of date", s1.stale === true && /out of date/.test(s1.t), s1);
    await ev(() => { const L = tl.vlayers.find((x) => x.name === "⧉ inner"); window.__c = L.clips[0]; if (window.TlFloat) TlFloat.show(true); TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.paintProps(); });
    await p.waitForFunction(() => document.getElementById("tlpNestRe"), null, { timeout: 10000 });
    const old = await ev(() => ({ hash: __c.nestHash, row: document.getElementById("tlpNestRow").textContent }));
    await ev(() => document.getElementById("tlpNestRe").click());
    await p.waitForFunction((h) => { const L = tl.vlayers.find((x) => x.name === "⧉ inner"); return L && L.clips[0].nestHash !== h; }, old.hash, { timeout: 120000 }).catch(() => {});
    const s2 = await ev(() => { const L = tl.vlayers.find((x) => x.name === "⧉ inner"), c = L.clips[0]; const bd = document.querySelector("#tlinner .clip .tlnest");
      return { c: { name: c.name, dur: c.dur, start: c.start, out: c.out, hash: c.nestHash }, t: bd && bd.textContent, stale: bd && bd.classList.contains("stale") }; });
    check("Properties: ⧉ inner out of date, ↻ Re-render -> the shorter render (1 s), same place, a new hash, the badge up to date again",
      /out of date/.test(old.row) && s2.c.hash !== old.hash && Math.abs(s2.c.dur - 1) < 0.1 && s2.c.start === 0.5 && s2.c.out <= s2.c.dur + 1e-6 && s2.stale === false && s2.t === "⧉ inner", { old, s2 });
    const self = await ev(() => TlNest.add(tlName).then(() => "added", (e) => e.message));
    check("nesting this timeline into itself: refused in words", /cannot be nested in itself/.test(self), self);

    /* ---- 3. ⇄ FCPXML out and back */
    await ev(() => { if (window.TlFloat) TlFloat.show(false); });
    await p.click("#tlExchangeBtn");
    await p.waitForFunction(() => document.getElementById("tlExchangeDlg") && document.getElementById("tlExchangeDlg").open && document.getElementById("tixOut"), null, { timeout: 10000 });
    await p.selectOption("#tixFmt", "fcpx");
    await ev(() => { document.getElementById("tixName").value = "UI FCP"; });
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }), p.click("#tixOut")]);
    const xf = path.join(T, "UI FCP.fcpxml"); await dl.saveAs(xf);
    const fx = fs.readFileSync(xf, "utf8");
    check("⇄ FCPXML (Final Cut Pro X) downloaded: version 1.10, the storyline's clip, the nest's render as a connected clip (lane 1)",
      dl.suggestedFilename() === "UI FCP.fcpxml" && /<fcpxml version="1\.10">/.test(fx) && /<spine><asset-clip [^>]*name="nblue\.webm"/.test(fx) && /lane="1"[^>]*name="nest_inner_/.test(fx), fx.slice(0, 600));
    await p.setInputFiles("#tixFile", xf);
    await p.waitForFunction(() => document.getElementById("tixOpen"), null, { timeout: 10000 });
    const inTxt = await ev(() => document.getElementById("tixIn").textContent);
    await ev(() => { document.getElementById("tixAs").value = "from fcp"; document.getElementById("tixOpen").click(); });
    await p.waitForFunction(() => typeof tlName !== "undefined" && tlName === "from fcp", null, { timeout: 10000 }).catch(() => {});
    const im = await ev(() => ({ name: tlName, v: tl.video.map((c) => c.name), l: (tl.vlayers || []).map((L) => L.clips.map((c) => [c.name, c.start])) }));
    check("...brought back in (an .fcpxml): \"from fcp\" opens with V1 + the nest's clip on a layer at 0.5 s (to the frame)",
      /2 clip\(s\)/.test(inTxt) && im.name === "from fcp" && im.v.join() === "nblue.webm" && im.l.length === 1 && /^nest_inner_/.test(im.l[0][0][0]) && Math.abs(im.l[0][0][1] - 0.5) <= 0.041, { inTxt, im });   // FCPXML times are whole frames (0.5 s at 25 fps -> frame 13)

    /* ---- 4. 📝 the transcript across the whole sequence */
    await ev(() => {
      tl.video = [{ name: "nred.webm", src: "video", in: 0, out: 3, dur: 3, start: 0, opacity: 1 }];
      tl.vlayers = [Object.assign(mkLayer("V2", [{ name: "nblue.webm", src: "video", in: 0, out: 3, dur: 4, start: 3.5, opacity: 1 }]))];
      tl.audio = [Object.assign(mkLayer("Music", [{ name: "nmusic.wav", in: 0, out: 4, dur: 4, start: 7 }]), { role: "music" })];
      tl.images = []; tlSave(); renderTimeline();
      window.__c = tl.video[0]; TlCanvas.select(__c, TlCanvas.layerOf(__c));
    });
    await p.click("#tlTextBtn");
    await p.waitForFunction(() => document.querySelectorAll("#tteText .tte-w").length === 2, null, { timeout: 10000 }).catch(() => {});
    const c0 = await ev(() => document.querySelectorAll("#tteText .tte-w").length);
    await p.selectOption("#tteScope", "seq");
    await p.waitForFunction(() => document.querySelectorAll("#tteText .tte-w").length === 5, null, { timeout: 10000 }).catch(() => {});
    const sq = await ev(() => ({ words: [...document.querySelectorAll("#tteText .tte-w")].map((s) => s.dataset.u + ":" + s.textContent), heads: [...document.querySelectorAll("#tteText .tte-piece")].map((s) => s.textContent),
      title: document.querySelector("#tlTextDlg .fx-body b").textContent }));
    check("📝 scope \"the whole sequence\": the V1 clip's words then the V2 clip's - one text, each clip named with its layer",
      c0 === 2 && sq.words.join() === "0:one,0:two,1:three,1:four,1:five" && /nred\.webm · V1/.test(sq.heads[0]) && /nblue\.webm · V2 · 3\.50 s/.test(sq.heads[1]) && sq.title === "the whole sequence", sq);
    await p.click('#tteText .tte-w[data-u="1"][data-i="1"]');
    await p.click("#tteCut");
    const want = X.remove({ name: "nblue.webm", src: "video", in: 0, out: 3, dur: 4, start: 3.5, opacity: 1 }, X.wordRanges(SAID["nblue.webm"], [1]));
    const cut = await ev(() => ({ v1: tl.video.map((c) => [c.start, c.in, c.out]), v2: tl.vlayers[0].clips.map((c) => [c.start, c.in, c.out]), m: tl.audio[0].clips[0].start, msg: document.getElementById("tteMsg").textContent }));
    check("✂ \"four\" cut: the V2 clip in two pieces (static/textedit.js's maths), V1 untouched, the music after it moved up by the same (" + want.removed + " s) - every layer",
      JSON.stringify(cut.v2) === JSON.stringify(want.pieces.map((c) => [c.start, c.in, c.out])) && JSON.stringify(cut.v1) === "[[0,0,3]]" && Math.abs(cut.m - (7 - want.removed)) < 1e-6 && /on every layer/.test(cut.msg), { cut, want });
    await p.click("#tteUndo");
    const un = await ev(() => ({ v2: tl.vlayers[0].clips.map((c) => [c.start, c.in, c.out]), m: tl.audio[0].clips[0].start }));
    check("↺ Undo puts every layer back", JSON.stringify(un.v2) === "[[3.5,0,3]]" && un.m === 7, un);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
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
