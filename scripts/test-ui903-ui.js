#!/usr/bin/env node
/* bitGen Studio — 2.903.0 in a REAL browser (Tim: "when viewing a video add a button to advance 1 frame and go back 1 frame.
 * and a button to capture the frame"): a real 24 fps VP9 video (ffmpeg's numbered test pattern, 48 frames) uploaded to the
 * project and opened in the preview - the frame info from ffprobe, ⏵ / ⏴ and the , . keys land on exact frames, 📷 Capture
 * frame saves THAT frame (pixel for pixel what ffmpeg decodes as frame n) at the video's size into Assets + the Gallery,
 * Shift+📷 also into References; a picture in the preview hides the frame buttons. Against the running app (H3_URL). */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync, spawnSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rgbMd5 = (args) => { const r = spawnSync("ffmpeg", ["-v", "error"].concat(args, ["-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]), { maxBuffer: 64 << 20 }); return require("crypto").createHash("md5").update(r.stdout).digest("hex"); };
(async () => {
  try { const r = await fetch(URL_); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui903-")), tag = "frames903x" + Date.now().toString(36), src = path.join(dir, tag + ".webm");
  if (spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=24:duration=2", "-c:v", "libvpx-vp9", "-b:v", "400k", "-pix_fmt", "yuv420p", src]).status !== 0) { console.log("SKIP: no ffmpeg with VP9"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3LbFrame && typeof lbOpen === "function" && document.getElementById("lb_fgrp"), null, { timeout: 60000 });
    const up = await ev(async (bytes) => { const fd = new FormData(); fd.append("file", new File([new Uint8Array(bytes.b)], bytes.n + ".webm", { type: "video/webm" })); return (await fetch("/api/passets", { method: "POST", body: fd })).json(); }, { b: [...fs.readFileSync(src)], n: tag });
    const vname = up.name || up.file || tag + ".webm", vurl = "/passets/video/" + encodeURIComponent(vname);
    const inf = await ev(async (u) => (await fetch("/api/videoframe/info?url=" + encodeURIComponent(u))).json(), vurl);
    check("GET /api/videoframe/info: the real frame rate, frame count and size (ffprobe)", inf.fps === 24 && inf.frames === 48 && inf.w === 320 && inf.h === 240, inf);
    await ev((u) => lbOpen([{ kind: "video", url: u.u, name: u.n }], 0), { u: vurl, n: vname });
    await p.waitForFunction(() => { const v = document.querySelector("#lb_wrap video"); return v && v.readyState >= 2 && !document.getElementById("lb_fgrp").hidden && /frame 1 \/ 48/.test(document.getElementById("lb_fno").textContent); }, null, { timeout: 20000 });
    check("a video in the preview: ⏴ frame n / total ⏵ and 📷 Capture frame in the bar", await ev(() => ["lb_fprev", "lb_fno", "lb_fnext", "lb_fcap"].every((id) => document.getElementById(id) && document.getElementById(id).offsetParent)));
    const at = () => ev(() => ({ t: document.querySelector("#lb_wrap video").currentTime, label: document.getElementById("lb_fno").textContent, paused: document.querySelector("#lb_wrap video").paused }));
    const settle = () => p.waitForFunction(() => !document.querySelector("#lb_wrap video").seeking, null, { timeout: 5000 }).then(() => p.waitForTimeout(150));
    await ev(() => document.querySelector("#lb_wrap video").play().catch(() => {}));
    await p.waitForTimeout(200);
    for (let i = 0; i < 3; i++) { await p.click("#lb_fnext"); await settle(); }
    let s = await at();
    check("⏵ three times: paused, in the middle of a frame (played a moment first), the label = that frame", s.paused && /^frame \d+ \/ 48$/.test(s.label) && Math.abs(s.t - (Math.floor(s.t * 24) + 0.5) / 24) < 0.002 && +s.label.split(" ")[1] === Math.floor(s.t * 24) + 1, s);
    await ev(() => H3LbFrame.step(-100)); await settle();
    s = await at();
    check("back past the start stays on frame 1", /^frame 1 \/ 48$/.test(s.label), s);
    await p.keyboard.press("."); await settle(); await p.keyboard.press("."); await settle(); await p.keyboard.press("."); await settle(); await p.keyboard.press(","); await settle();
    s = await at();
    check("the . and , keys step one frame on / back (frame 3)", /^frame 3 \/ 48$/.test(s.label) && Math.abs(s.t - 2.5 / 24) < 0.002, s);
    const pos = await ev(() => lb.i);
    check("…and do not change the file shown", pos === 0);
    await p.click("#lb_fcap");
    await p.waitForFunction(() => /saved as/.test(document.getElementById("lb_fmsg").textContent) || /not saved/.test(document.getElementById("lb_fmsg").textContent), null, { timeout: 20000 });
    const msg = await ev(() => document.getElementById("lb_fmsg").textContent);
    check("📷 Capture frame: saved as <video>_frame3.png in Assets + the Gallery", msg === "📷 frame 3 saved as " + tag + "_frame2.png (Assets + Gallery)", msg);
    const png = await ev(async (n) => { const a = await fetch("/passets/images/" + n); const g = await fetch("/outputs/" + n); return { a: a.ok, g: g.ok, bytes: [...new Uint8Array(await a.arrayBuffer())] }; }, tag + "_frame2.png");
    const out = path.join(dir, "cap.png"); fs.writeFileSync(out, Buffer.from(png.bytes));
    const dims = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", out], { encoding: "utf8" }).stdout.trim();
    check("…in the project's images (Assets) and output (Gallery), at the video's own 320 x 240", png.a && png.g && dims === "320,240", { a: png.a, g: png.g, dims });
    check("…and it IS frame 3 - pixel for pixel what ffmpeg decodes as frame index 2", rgbMd5(["-i", out]) === rgbMd5(["-i", src, "-vf", "select=eq(n\\,2)"]) && rgbMd5(["-i", out]) !== rgbMd5(["-i", src, "-vf", "select=eq(n\\,3)"]));
    const nRefs0 = await ev(() => (typeof refs !== "undefined" ? refs.length : -1));
    await ev(() => H3LbFrame.capture(true));
    await p.waitForTimeout(800);
    const nRefs1 = await ev(() => (typeof refs !== "undefined" ? refs.length : -1));
    check("Shift+📷: also into the References docker", nRefs1 === nRefs0 + 1 && /\+ References/.test(await ev(() => document.getElementById("lb_fmsg").textContent)), { nRefs0, nRefs1 });
    await ev(() => lbOpen([{ kind: "image", url: "/static/icon.png", name: "icon.png" }], 0));
    await p.waitForTimeout(300);
    check("a picture in the preview: no frame buttons", await ev(() => document.getElementById("lb_fgrp").hidden));
    const bad = await ev(async () => { const r = await fetch("/api/videoframe/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "/etc/passwd", frame: 0 }) }); return { s: r.status, j: await r.json() }; });
    check("capture refuses an address outside the project's folders", bad.s === 404 && /not in this project/.test(bad.j.error), bad);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
