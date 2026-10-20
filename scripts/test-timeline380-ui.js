#!/usr/bin/env node
/* bitGen Studio — 2.380.0: the timeline in a REAL browser - a clean selection bar, ❔ help, ⬚ / 🖌 + ✨ Fill, the
 * karaoke style dialog and the 🎤 karaoke generator.
 * Tim: "in the timeline remove no selection — drag on the ruler, or ⟦ In / Out ⟧ at the playhead [Scene 1] - only show
 * timestart:timefinish - n ... all explanations should go in a help file not in the main ui. add a selection box and
 * masking tools - allow user to generate an image or video in that selection that blends with the rest of the scene.
 * add a karaoke generator to timeline. add karaoke options to settings in videodocker and timelinedocker settings".
 * Run against the running app (H3_URL, default the e2e server on :8311) from the app folder (test media in
 * projects/e2e_tl380). The AI (inpaint, video) is answered by the test - the canvas, the layer files, the masked
 * video, the karaoke render and placement are real. No Playwright here = SKIP (exit 0). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the timeline 2.380 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_tl380";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(args), { stdio: "ignore" });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2100, height: 1300 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  let styleBefore = null;
  try {
    await api("/api/projects/load", { name: P });
    styleBefore = (await api("/api/karaoke/style")).style;
    const pd = path.join(ROOT, "projects", P);
    for (const d of ["video", "output", "sound", "lyrics", "images"]) fs.mkdirSync(path.join(pd, d), { recursive: true });
    ff(["-f", "lavfi", "-i", "color=c=0x208030:s=640x360:r=24:d=6", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", path.join(pd, "video", "t380_base.webm")]);
    ff(["-f", "lavfi", "-i", "testsrc2=s=320x240:r=24:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(pd, "output", "t380_vid.mp4")]);
    ff(["-f", "lavfi", "-i", "color=c=blue:s=400x300", "-frames:v", "1", path.join(pd, "output", "t380_res.png")]);
    ff(["-f", "lavfi", "-i", "sine=frequency=300:duration=12", path.join(pd, "sound", "t380_song.wav")]);
    fs.writeFileSync(path.join(pd, "lyrics", "t380_song.txt"), "[verse]\nHello neon city tonight\nWe dance until the light\nNever let it die\n");
    // the AI answers (the page's own requests)
    await p.route("**/api/aiedit/engines", (r) => r.fulfill({ json: { inpaint: [{ id: "st1", name: "Fill style" }], edit: [], defaults: { inpaint: "st1" } } }));
    await p.route("**/api/aiedit", (r) => r.fulfill({ json: { jobs: [{ id: "t380img" }], mode: "generate", workflow: "x" } }));
    await p.route("**/api/generate", (r) => r.fulfill({ json: { id: "t380vid", status: "queued" } }));
    await p.route("**/api/jobs/t380img", (r) => r.fulfill({ json: { id: "t380img", status: "done", output: "t380_res.png" } }));
    await p.route("**/api/jobs/t380vid", (r) => r.fulfill({ json: { id: "t380vid", status: "done", output: "t380_vid.mp4" } }));

    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.TlCanvas && window.TlFill && window.TlKaraokeGen && window.KaraokeStyle && window.H3Help, null, { timeout: 30000 });
    // the floating prompt docker can sit over the timeline at this window size (where it was left) - out of the way
    await p.evaluate(() => { const pd = document.getElementById("promptdock"); if (pd && /pf-float/.test(pd.className)) pd.style.visibility = "hidden"; });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 860);
      // 2.443.0: 🧰 stays inside the timeline docker (over its preview row) - docked beside the canvas here so it covers
      // neither the canvas nor the layers / ✨ Fill column this test works in
      if (window.TlFloat && TlFloat.dock) TlFloat.dock("L");
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "t380_base.webm", src: "video", start: 0, dur: 6, in: 0, out: 6, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = [mkLayer("A1", [{ name: "t380_song.wav", start: 1, in: 2, out: 10, dur: 12 }])];
      tl.sel = null; tlSave(); renderTimeline(); setPlayhead(1.5); TlCanvas.state.t = 1.5;
    });
    await p.waitForFunction(() => TlCanvas.state.W === 640, null, { timeout: 20000 });

    // 1: the selection bar
    const s0 = await p.evaluate(() => document.getElementById("tlSelInfo").textContent);
    await p.evaluate(() => { tl.sel = { a: 2, b: 3.5 }; tlSave(); renderTimeline(); });
    const s1 = await p.evaluate(() => document.getElementById("tlSelInfo").textContent);
    check("the selection bar: empty without a selection, only start:end - frames with one", s0 === "" && s1 === "2.00:3.50 - 36", [s0, s1]);
    check("no tool explanation on the canvas", await p.evaluate(() => { TlCanvas.setTool("move"); return document.getElementById("tlCHint").textContent; }) === "");

    // 2: help
    await p.click("#tlHelp");
    await p.waitForSelector("#hpDlg[open]");
    await p.waitForFunction(() => document.querySelectorAll("#hpBody h3").length > 4, null, { timeout: 5000 });
    const hp = await p.evaluate(() => [document.getElementById("hpTitle").textContent, [...document.querySelectorAll("#hpBody h3")].map((h) => h.id)]);
    check("❔ opens the timeline's help (a titlebar; canvas, fill, keyframes, selection, karaoke, settings)",
      hp[0] === "❔ Timeline" && ["canvas", "fill", "keyframes", "selection", "karaoke", "settings"].every((k) => hp[1].includes(k)), hp);
    await p.click("#hpClose");

    // 3: ⬚ select + ✨ Fill (image)
    await p.click("#tlTool_select");
    const geo = await p.evaluate(() => { const v = TlCanvas.state.view, rc = document.getElementById("tlCanvas").getBoundingClientRect(); return { x: rc.x + v.ox, y: rc.y + v.oy, z: v.z }; });
    const sx = (x) => geo.x + x * geo.z, sy = (y) => geo.y + y * geo.z;
    await p.mouse.move(sx(200), sy(100)); await p.mouse.down(); await p.mouse.move(sx(300), sy(160), { steps: 4 }); await p.mouse.move(sx(400), sy(220), { steps: 4 }); await p.mouse.up();
    await p.waitForTimeout(200);
    const sel = await p.evaluate(() => ({ bb: TlFill.bbox(), shown: getComputedStyle(document.getElementById("tlFill")).display !== "none", size: document.getElementById("tlfSize").textContent }));
    check("⬚ Select: dragging makes the selection (200,100 200x120); the ✨ Fill panel shows its size",
      sel.bb && sel.bb.x === 200 && sel.bb.y === 100 && sel.bb.w === 200 && sel.bb.h === 120 && sel.shown && sel.size === "200×120", sel);
    await p.evaluate((v) => { const e = document.getElementById("prompt"); e.value = v; e.dispatchEvent(new Event("input")); }, "a blue sign");   // 2.419.0: the tool reads the prompt docker
    await p.click("#tlfGo");
    await p.waitForFunction(() => tl.images.length === 1, null, { timeout: 30000 }).catch(() => {});
    const im = await p.evaluate(() => ({ clips: tl.images.map((L) => L.clips[0]), bb: TlFill.bbox() }));
    const c = im.clips[0] || {};
    check("✨ Image: a new picture layer over the area (its centre -20,-20 = the area + context), for the ruler selection (2 s, 1.5 s long); the selection cleared",
      c.name && /^layer_f/.test(c.name) && c.start === 2 && c.len === 1.5 && c.tf && c.tf.x === -20 && c.tf.y === -20 && im.bb === null, im);
    if (c.name) {
      const f = path.join(pd, "images", c.name);
      const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-i", f, "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
      const W = 300, at = (x, y) => raw[(y * W + x) * 4 + 3];
      check("...the layer picture: opaque in the selection's middle, see-through outside it, soft (feathered) at the edge",
        at(150, 110) > 240 && at(5, 5) < 10 && at(50, 110) > 5 && at(50, 110) < 250, [at(150, 110), at(5, 5), at(50, 110)]);
    }
    // 🖌 Mask + ✨ Video
    await p.click("#tlTool_mask");
    await p.mouse.move(sx(100), sy(260)); await p.mouse.down(); await p.mouse.move(sx(180), sy(290), { steps: 6 }); await p.mouse.up();
    const mb = await p.evaluate(() => TlFill.bbox());
    check("🖌 Mask: painting makes the selection", mb && mb.w > 60 && mb.h > 20, mb);
    await p.evaluate(() => { tl.sel = null; tlSave(); renderTimeline(); });
    await p.selectOption("#tlfMode", "video");
    await p.fill("#tlfSecs", "3"); await p.dispatchEvent("#tlfSecs", "change");
    await p.evaluate((v) => { const e = document.getElementById("prompt"); e.value = v; e.dispatchEvent(new Event("input")); }, "flames");   // 2.419.0: the tool reads the prompt docker
    await p.click("#tlfGo");
    await p.waitForFunction(() => tl.vlayers.filter((L) => !L.karaoke).length === 1, null, { timeout: 90000 }).catch(() => {});
    const vl = await p.evaluate(() => tl.vlayers.filter((L) => !L.karaoke).map((L) => L.clips[0]));
    const v = vl[0] || {};
    check("✨ Video: a new video layer with the masked clip (video/fillv_*.webm), at the position marker, as long as the clip",
      /^fillv_.+\.webm$/.test(v.name || "") && v.src === "video" && Math.abs(v.start - 1.5) < 0.05 && Math.abs((v.dur || 0) - 3) < 0.2, vl);
    if (v.name) {
      const pr = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name:stream_tags=alpha_mode", "-of", "json",
        path.join(pd, "video", v.name)], { encoding: "utf8" })).streams[0];
      check("...a VP9 clip WITH alpha (it blends into the scene)", pr.codec_name === "vp9" && String((pr.tags || {}).alpha_mode || (pr.tags || {}).ALPHA_MODE) === "1", pr);
    }

    // 4: the karaoke style dialog from the timeline's ⚙
    await p.click("#tlSettings"); await p.waitForSelector("#tlsDlg[open]");
    await p.click("#tlsKaraoke"); await p.waitForSelector("#ksDlg[open]");
    await p.waitForTimeout(300);
    await p.fill("#ks_bg_opacity", "40"); await p.fill("#ks_position_top", "240");
    await p.click("#ksSave"); await p.waitForTimeout(500);
    const st = (await api("/api/karaoke/style")).style;
    check("⚙ → 🎤 Karaoke style: the dialog saves (background 40%, position top 240 px)", st.bg_opacity === 40 && st.position_top === 240, st);
    await p.click("#tlsCancel");

    // 5: the 🎤 generator - the A1 song clip, the ruler selection
    await p.evaluate(() => { tl.sel = { a: 3, b: 6 }; tlSave(); renderTimeline(); });
    await p.click("#tlKaraokeGen"); await p.waitForSelector("#kgDlg:not(.off)");   // 2.410.0: a docker
    await p.waitForFunction(() => document.getElementById("kgLyrics").value.length > 10, null, { timeout: 5000 }).catch(() => {});
    const g = await p.evaluate(() => ({ songs: [...document.querySelectorAll("#kgSong option")].map((o) => o.textContent), part: document.getElementById("kgPart").value,
      lyr: document.getElementById("kgLyrics").value, plan: TlKaraokeGen.plan(0) }));
    check("🎤: the song clip on A1 first, the ruler selection picked, its lyrics loaded; the part = the song's 4 s - 7 s, placed at 3 s",
      /^A1 · t380_song\.wav @ 1\.00s/.test(g.songs[0]) && g.part === "sel" && /Hello neon city/.test(g.lyr)
      && g.plan.start === 4 && g.plan.dur === 3 && g.plan.at === 3, g);
    await p.click("#kgGo");
    await p.waitForFunction(() => ((tl.vlayers.find((L) => L.karaoke) || { clips: [] }).clips || []).length > 0, null, { timeout: 90000 }).catch(() => {});
    const kl = await p.evaluate(() => { const L = tl.vlayers.find((x) => x.karaoke); return L ? { top: tl.vlayers[tl.vlayers.length - 1] === L, clips: L.clips } : null; });
    check("...Generate renders the overlay and puts it on the Karaoke layer (on top) at 3 s, 3 s long",
      kl && kl.top && kl.clips.length === 1 && /^t380_song_karaoke_.+\.webm$/.test(kl.clips[0].name) && kl.clips[0].start === 3 && Math.abs(kl.clips[0].dur - 3) < 0.05, kl);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 600));
  } finally {
    try { await p.evaluate(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tl.sel = null; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
    try { if (styleBefore) await api("/api/karaoke/style", { style: styleBefore }); } catch { /* best effort */ }
    try { await api("/api/projects/load", { name: "default" }); } catch { /* best effort */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
