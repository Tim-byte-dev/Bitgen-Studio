#!/usr/bin/env node
/* bitGen Studio — 2.387.0 PATH LAYERS in a REAL browser.
 * Tim: "can we add a paths layer , then generate parts of the scene on each path layer so animals, cars, people can be
 * rendered separately have transparent backgrounds and compose the scene" (per layer: in place + follow path, or along
 * the path with Wan ATI; green screen + AI matte / chroma key).
 * Run against the running app (H3_URL, default the e2e server on :8311); a project of its own, "default" back after.
 * The picture / video renders are STUBBED (their answers + real files in the project); the cut-out is the server's own
 * (lib/matte.js, chroma key). No Playwright here = SKIP (exit 0).
 *   1. ＋ Path layer: a path layer (⤳ in the layers, its span on the timeline), the ⤳ Path tool;
 *   2. the tool: clicks lay points, a drag moves one, Alt-click removes one; the panel writes the layer's settings;
 *   3. ✨ Generate, in place: picture -> video -> the green cut away -> clips moving along the path (◆ keyframes), the
 *      mirror where the path turns back, the size from start to end, the subject's feet on the path;
 *   4. ⟲ Place again after moving a point;
 *   5. along the path (Wan ATI): the start picture + 121-point tracks sent, one full-frame see-through clip. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the path layers browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_paths_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => {
  for (let i = 0; ; i++) {
    try { return await (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json(); }
    catch (e) { if (i >= 5) throw e; await new Promise((ok) => setTimeout(ok, 500 * (i + 1))); }
  }
};
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2100, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  let ati = null, gen = null;
  try {
    await api("/api/projects/load", { name: P });
    const pd = path.join(ROOT, "projects", P);
    fs.mkdirSync(path.join(pd, "output"), { recursive: true });
    // the stubbed renders' files: a green-screen still, a walk on the spot (a red box bobbing), the ATI take (full frame)
    ff(["-f", "lavfi", "-i", "color=c=0x00b140:s=832x480", "-f", "lavfi", "-i", "color=c=0xd02020:s=120x200", "-filter_complex", "[0][1]overlay=356:200", "-frames:v", "1", path.join(pd, "output", "pstill.png")]);
    ff(["-f", "lavfi", "-i", "color=c=0x00b140:s=832x480:r=24:d=2", "-f", "lavfi", "-i", "color=c=0xd02020:s=120x200:r=24:d=2",
        "-filter_complex", "[0][1]overlay=x=356:y='200+10*sin(t*6)'", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(pd, "output", "pwalk.mp4")]);
    ff(["-f", "lavfi", "-i", "color=c=0x00b140:s=832x464:r=24:d=2", "-f", "lavfi", "-i", "color=c=0x2040d0:s=80x80:r=24:d=2",
        "-filter_complex", "[0][1]overlay=x='50+t*300':y=200", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(pd, "output", "pati.mp4")]);
    const jobs = { j1: "pstill.png", j2: "pwalk.mp4", j3: "pati.mp4" };
    await p.route("**/api/genimage", (r) => r.fulfill({ json: { id: "j1", status: "queued" } }));
    await p.route("**/api/generate", (r) => { gen = r.request().postData() || ""; r.fulfill({ json: { id: "j2", status: "queued" } }); });
    await p.route("**/api/pathgen/ati", (r) => { ati = r.request().postData() || ""; r.fulfill({ json: { id: "j3", status: "queued" } }); });
    await p.route(/\/api\/jobs\/j[123]$/, (r) => { const id = r.request().url().split("/").pop(); r.fulfill({ json: { id, status: "done", outputs: [jobs[id]], progress: null } }); });
    await p.route(/\/api\/styles(\?.*)?$/, (r) => r.fulfill({ json: { styles: [
      { id: "img1", name: "Stub picture", kind: "image", arch: "sdxl" },
      { id: "vid1", name: "Stub H3", kind: "video", arch: "h3" },
      { id: "wan1", name: "Wan 2.1", kind: "video", arch: "wan21" }], kind: "all", incomplete: {} } }));
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlPaths && window.TlFloat && typeof dsReady !== "undefined" && dsReady, null, { timeout: 30000 });
    await p.waitForTimeout(700);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (d.classList.contains("dockgone")) toggleDockGone("timelinedock", "tT");
      if (d.classList.contains("collapsed")) toggleCollapse("timelinedock");
      setVar("th", 760);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); setPlayhead(0);
      TlFloat.show(true); TlFloat.place(1700, 90);
    });
    await p.waitForTimeout(400);

    // 1
    await p.click("#tlAddPath");
    const one = await p.evaluate(() => {
      const L = tl.vlayers[tl.vlayers.length - 1];
      return { path: !!(L && L.path), tool: TlCanvas.state.tool, panel: !document.getElementById("tlPathPanel").classList.contains("off"),
               inFloat: document.getElementById("tlPathPanel").parentElement.id, span: !!document.querySelector("#tlinner .pathspan"),
               icon: [...document.querySelectorAll("#tlLayerList .tll-ic")].some((x) => x.textContent === "⤳") };
    });
    check("＋ Path layer: a path layer, ⤳ in the layers list, its dashed span on the timeline, the ⤳ Path tool on", one.path && one.tool === "path" && one.span && one.icon, one);
    check("...its panel in the floating Tools & Properties", one.panel && one.inFloat === "tlFloat", one);

    // 2
    const pt = async (x, y) => p.evaluate((q) => { const r = document.getElementById("tlCanvas").getBoundingClientRect(); const s = TlCanvas.toScreen(q[0], q[1]); return { x: r.left + s.x, y: r.top + s.y }; }, [x, y]);
    const W = await p.evaluate(() => [TlCanvas.state.W, TlCanvas.state.H]);
    const A = await pt(W[0] * 0.15, W[1] * 0.75), B = await pt(W[0] * 0.5, W[1] * 0.7), Cc = await pt(W[0] * 0.85, W[1] * 0.72), Dd = await pt(W[0] * 0.6, W[1] * 0.6);
    for (const q of [A, B, Cc, Dd]) { await p.mouse.click(q.x, q.y); await p.waitForTimeout(80); }
    let pts = await p.evaluate(() => TlPaths.selPath().path.pts);
    check("⤳ clicks lay the path's points (picture pixels)", pts.length === 4 && Math.abs(pts[0][0] - W[0] * 0.15) < 4 && Math.abs(pts[2][1] - W[1] * 0.72) < 4, pts);
    await p.keyboard.down("Alt"); await p.mouse.click(Dd.x, Dd.y); await p.keyboard.up("Alt");
    pts = await p.evaluate(() => TlPaths.selPath().path.pts);
    const B2 = await pt(W[0] * 0.5, W[1] * 0.55);
    await p.mouse.move(B.x, B.y); await p.mouse.down(); await p.mouse.move(B2.x, B2.y, { steps: 5 }); await p.mouse.up();
    const pts2 = await p.evaluate(() => TlPaths.selPath().path.pts);
    check("...Alt-click removes one, a drag moves one", pts.length === 3 && pts2.length === 3 && Math.abs(pts2[1][1] - W[1] * 0.55) < 4, [pts, pts2]);
    await p.evaluate((v) => { const e = document.getElementById("prompt"); e.value = v; e.dispatchEvent(new Event("input")); }, "a red fox");   // 2.419.0: the tool reads the prompt docker
    await p.selectOption("#ppKind", "animal");
    await p.fill("#ppDur", "4"); await p.dispatchEvent("#ppDur", "change");
    await p.fill("#ppSize", "20"); await p.dispatchEvent("#ppSize", "input");
    await p.fill("#ppSizeEnd", "10"); await p.dispatchEvent("#ppSizeEnd", "input");
    await p.selectOption("#ppEase", "linear");
    await p.selectOption("#ppMatte", "key");
    const s2 = await p.evaluate(() => TlPaths.selPath().path.subject);
    check("the panel: what follows it, kind, length, sizes start -> end, pace, the cut-out", s2.prompt === "a red fox" && s2.kind === "animal" && s2.size === 20 && s2.sizeEnd === 10 && s2.ease === "linear" && s2.matte === "key"
      && await p.evaluate(() => TlPaths.selPath().path.dur === 4), s2);

    // 3 - in place: the path goes right and then back LEFT (the mirror)
    await p.evaluate(() => { const L = TlPaths.selPath(); L.path.pts = [[200, 500], [900, 480], [1000, 470], [400, 450]]; L.path.start = 0.5; tlSave(); });
    await p.click("#ppGo");
    await p.waitForFunction(() => { const L = TlPaths.selPath(); return L && L.path.status && L.path.status.state; }, null, { timeout: 120000 });
    const g3 = await p.evaluate(() => { const L = TlPaths.selPath(); return { st: L.path.status, gen: L.path.gen, clips: L.clips.map((c) => ({ name: c.name, start: c.start, in: c.in, out: c.out, kf: c.kf.length, k0: c.kf[0], kl: c.kf[c.kf.length - 1] })) }; });
    check("✨ Generate (in place): picture -> video (fl2va, the still as its first frame) -> the green cut away -> clips on the layer",
      g3.st.state === "done" && g3.gen && /^pathv_.*\.webm$/.test(g3.gen.name) && g3.clips.length >= 2 && /mode/.test(gen) && /fl2va/.test(gen) && /in place/.test(gen), g3);
    check("...the clips cover the path's time (0.5 s + 4 s), looped every 2 s (the video's length)",
      Math.abs(g3.clips[0].start - 0.5) < 1e-3 && Math.abs(g3.clips[g3.clips.length - 1].start + (g3.clips[g3.clips.length - 1].out - g3.clips[g3.clips.length - 1].in) - 4.5) < 0.01
      && g3.clips.every((c) => c.out - c.in <= 2.001 && c.kf >= 2), g3.clips);
    check("...where the path turns back, the MIRROR (pathv_<id>_l.webm)", g3.clips.some((c) => /_l\.webm$/.test(c.name)) && /_l\.webm$/.test(g3.clips[g3.clips.length - 1].name) && !/_l\./.test(g3.clips[0].name), g3.clips.map((c) => c.name));
    const feet = await p.evaluate(() => {
      const L = TlPaths.selPath(), g = L.path.gen, c = L.clips[0], k = c.kf[0], S = TlCanvas.state;
      // where the subject's feet (the bottom middle of its box) land on the picture at the start
      const fx = S.W / 2 + k.x + (g.bbox.x + g.bbox.w / 2 - g.w / 2) * k.scale, fy = S.H / 2 + k.y + (g.bbox.y + g.bbox.h - g.h / 2) * k.scale;
      const kl = L.clips[L.clips.length - 1].kf.slice(-1)[0];
      return { fx, fy, h0: g.height * k.scale, h1: g.height * kl.scale, H: S.H };
    });
    check("...its feet on the path's start (200, 500), 20% of the picture tall there, 10% at the end",
      Math.abs(feet.fx - 200) < 3 && Math.abs(feet.fy - 500) < 3 && Math.abs(feet.h0 - 0.2 * feet.H) < 2 && Math.abs(feet.h1 - 0.1 * feet.H) < 2, feet);
    // the compile can read them: real see-through files in video/
    check("...the cut-out is see-through VP9 (alpha) in the project's video folder, its mirror too",
      fs.existsSync(path.join(pd, "video", g3.gen.name)) && fs.existsSync(path.join(pd, "video", g3.gen.left))
      && /ALPHA_MODE\s*[=:]\s*1/i.test(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream_tags", path.join(pd, "video", g3.gen.name)], { encoding: "utf8" })));

    // 4 - move a point, place again
    const x0 = g3.clips[0].k0.x;
    await p.evaluate(() => { const L = TlPaths.selPath(); L.path.pts[0] = [300, 520]; TlPaths.place(L); });
    const x1 = await p.evaluate(() => TlPaths.selPath().clips[0].kf[0].x);
    check("⟲ Place again: the clips follow the path as it is now (the start moved 100 px right)", Math.abs(x1 - x0 - 100) < 1.5, [x0, x1]);

    // 5 - along the path (Wan ATI)
    await p.selectOption("#ppMode", "ati");
    await p.waitForTimeout(150);
    await p.selectOption("#ppVid", "wan1");
    await p.click("#ppGo");
    await p.waitForFunction(() => { const L = TlPaths.selPath(); return L && L.path.gen && L.path.gen.mode === "ati" && L.path.status && L.path.status.state !== "running"; }, null, { timeout: 120000 }).catch(() => null);
    const g5 = await p.evaluate(() => { const L = TlPaths.selPath(); return { st: L.path.status, gen: L.path.gen, clips: L.clips.map((c) => ({ name: c.name, start: c.start, tf: c.tf, kf: !!c.kf })), W: TlCanvas.state.W }; });
    const tr = (/name="tracks"\r\n\r\n([^\r]*)/.exec(ati || "") || [])[1];
    let tracks = null; try { tracks = JSON.parse(tr); } catch { tracks = null; }
    check("Along the path (Wan ATI): the start picture + the path as 121 points in the video's pixels, a Wan 2.1 style",
      !!ati && /name="start"; filename="path_start.png"/.test(ati) && /name="style_id"\r\n\r\nwan1/.test(ati) && tracks && tracks.length === 1 && tracks[0].length === 121
      && tracks[0][0].x < tracks[0][60].x, { tr: (tr || "").slice(0, 120) });
    check("...one full-frame see-through clip on the layer (scaled to the picture's width), no keyframes",
      g5.st.state === "done" && g5.clips.length === 1 && /^pathv_/.test(g5.clips[0].name) && Math.abs(g5.clips[0].tf.scale - g5.W / g5.gen.w) < 1e-3 && !g5.clips[0].kf, g5);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 800));
  } finally {
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
