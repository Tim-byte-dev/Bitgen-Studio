#!/usr/bin/env node
/* bitGen Studio — 2.610.0 in a REAL browser: 🧬 MORPH between two layers of the timeline.
 * Tim: "lets automate the morph - add a morph tab to the properties docker, properties will be, character 1, character 2 ,
 * layer 1, layer 2 where the layers will be where the 2 clips are then automatically write the prompt and take the first
 * and last images from the layers, create the movie and insert the clip on a morph layer between the 2 layers starting at
 * the end of layer 1 and start layer 2 at the end of the morph".
 *   the tab beside Properties; the prompt written from the characters (and kept when edited); the two frames as the canvas
 *   shows them (V1's red video at its end, the blue picture at its start); 🧬 Make: ONE first + last frame render (both
 *   pictures sent, the prompt, the negatives); a "🧬 Morph" layer with the clip from the end of layer 1, layer 2 moved to
 *   its end, the morph's sound off; ↶ undoes it all.
 * Against the running app (H3_URL, default the e2e server on :8311 - its stub renderer). No Playwright = SKIP. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.610.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_morph_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "morphui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "color=c=red:s=320x180:r=24:d=4", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", path.join(T, "monkey.webm")]);
ff(["-f", "lavfi", "-i", "color=c=blue:s=320x180", "-frames:v", "1", path.join(T, "human.png")]);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const posts = [], jobs = [];
  p.on("request", (r) => { if (/\/api\/(generate|ltx)$/.test(r.url()) && r.method() === "POST") posts.push(r.url()); });
  p.on("response", (r) => { if (/\/api\/(generate|ltx)$/.test(r.url()) && r.request().method() === "POST") r.json().then((j) => { if (j && j.id) jobs.push(j.id); }).catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    for (const f of ["monkey.webm", "human.png"]) { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f); await fetch(URL_ + "api/passets", { method: "POST", body: fd }); }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlMorph && TlMorph.ready && window.TlCanvas && document.getElementById("tlpTabs"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      if (typeof setVar === "function") setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      const gm = document.getElementById("genModeSel"); if (gm) { gm.value = "video"; gm.dispatchEvent(new Event("change")); }
      const vs = document.getElementById("videoStyleSel"); if (vs) vs.value = "";
      if (window.H3Neg) H3Neg.set("low quality");
      tl.video = [{ name: "monkey.webm", src: "video", in: 0, out: 3, dur: 4, start: 0, opacity: 1 }];
      tl.vlayers = []; tl.audio = []; tl.images = [mkLayer("Human", [{ name: "human.png", start: 6, len: 4, opacity: 1, tf: { x: 0, y: 0, scale: 1, rot: 0 } }])];
      delete tl.morph; tlSave(); renderTimeline(); TlCanvas.go(0.5);
    });
    await p.waitForTimeout(800);

    /* the tab */
    const tabs = await ev(() => [...document.querySelectorAll("#tlpTabs button")].map((b) => b.textContent.trim()));
    await p.click('#tlpTabs button[data-tlt="morph"]'); await p.waitForTimeout(200);
    const ui = await ev(() => ({ on: document.getElementById("tlMorph").classList.contains("on"), propsHidden: getComputedStyle(document.getElementById("tlProps")).display === "none",
      fields: ["tlmC1", "tlmC2", "tlmL1", "tlmL2", "tlmSecs", "tlmPrompt", "tlmGo"].every((id) => !!document.getElementById(id)), layers: [...document.getElementById("tlmL1").options].map((o) => o.value + "=" + o.textContent) }));
    check("🧬 Morph is a tab beside Properties: Character 1 / 2, Layer 1 / 2 (the layers with a video or picture), length, the prompt, 🧬 Make",
      tabs.join("|") === "Properties|🧬 Morph" && ui.on && ui.propsHidden && ui.fields && ui.layers.includes("v1=V1") && ui.layers.includes("i:0=Human"), { tabs, ui });

    await p.fill("#tlmC1", "a chimpanzee"); await p.fill("#tlmC2", "an old man");
    await p.selectOption("#tlmL1", "v1"); await p.selectOption("#tlmL2", "i:0");
    await p.fill("#tlmSecs", "2"); await p.dispatchEvent("#tlmSecs", "change");
    await p.waitForTimeout(200);
    const pr = await ev(() => ({ prompt: document.getElementById("tlmPrompt").value, u1: document.getElementById("tlmU1").textContent, u2: document.getElementById("tlmU2").textContent, m: tl.morph }));
    check("the prompt is written for you from the two characters; the clips it uses are named (V1's ends 0-3 s - its last frame, Human's starts at 6 s - its first)",
      /^A chimpanzee slowly and seamlessly transforms into an old man/.test(pr.prompt) && /continuous/.test(pr.prompt) && /monkey\.webm \(0\.00–3\.00 s\)/.test(pr.u1) && /last frame/.test(pr.u1) && /human\.png \(6\.00–10\.00 s\)/.test(pr.u2) && /first frame/.test(pr.u2)
      && pr.m.c1 === "a chimpanzee" && pr.m.l2 === "i:0" && pr.m.secs === 2, pr);

    /* the two frames as shown */
    const fr = await ev(async () => {
      const S = TlCanvas.state, o = TlMorph.pick(), px = async (blob) => { const im = await createImageBitmap(blob), c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); const d = g.getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return { w: c.width, h: c.height, rgb: [d[0], d[1], d[2]] }; };
      const a = await TlMorph.frameAsShown(o.c1, "v1", 2.95, true, 640, 360), z = await TlMorph.frameAsShown(o.c2, "i:0", 6, false, 640, 360);
      return { a: await px(a), z: await px(z), end1: o.end1 };
    });
    check("its first frame = the red video's last frame, its last frame = the blue picture - both at the render's size, as the canvas shows them",
      fr.end1 === 3 && fr.a.w === 640 && fr.a.rgb[0] > 180 && fr.a.rgb[2] < 80 && fr.z.rgb[2] > 180 && fr.z.rgb[0] < 80, fr);

    /* 🧬 make it */
    await p.click("#tlmGo");
    await p.waitForFunction(() => (tl.vlayers || []).some((L) => /Morph/.test(L.name)), null, { timeout: 240000 }).catch(() => {});
    await p.waitForTimeout(400);
    const done = await ev(() => { const i = tl.vlayers.findIndex((L) => /Morph/.test(L.name)), L = tl.vlayers[i], c = L && L.clips[0];
      return { i, n: tl.vlayers.length, muted: L && L.muted, c: c && { name: c.name, start: c.start, len: +(c.out - c.in).toFixed(3), morph: c.morph }, img: tl.images[0].clips[0].start, msg: document.getElementById("tlmMsg").textContent, v1: tl.video[0].start }; });
    check("🧬 Make the morph: a '🧬 Morph' layer with the new clip starting at the end of layer 1 (3 s), its sound off",
      done.i >= 0 && done.c && done.c.start === 3 && done.c.name !== "monkey.webm" && done.c.len > 1 && done.muted === true && done.c.morph.c2 === "an old man", done);
    check("…layer 2 (the picture) now starts where the morph ends; layer 1 untouched", Math.abs(done.img - (3 + done.c.len)) < 0.01 && done.v1 === 0, done);
    const job = jobs.length ? await (await fetch(URL_ + "api/jobs/" + jobs[0])).json() : {};
    const pa = job.params || {}, js = JSON.stringify(pa);
    if (process.env.DEBUG) console.log(js.slice(0, 1500));
    check("ONE first + last frame render: fl2va with both pictures (the first and the last frame), the written prompt, the negatives (yours + the morph's)",
      posts.length === 1 && /\/api\/generate$/.test(posts[0]) && /fl2va/.test(pa.mode || js) && (js.match(/morph_(first|last)/g) || []).length >= 2 && /A chimpanzee slowly and seamlessly transforms into an old man/.test(js) && /low quality, cut, scene change/.test(js), { posts, keys: Object.keys(pa), js: js.slice(0, 600) });
    /* undo */
    await ev(() => document.getElementById("tlUndo").click()); await p.waitForTimeout(300);
    const un = await ev(() => ({ morph: (tl.vlayers || []).some((L) => /Morph/.test(L.name)), img: tl.images[0].clips[0].start }));
    check("↶ undoes it: no morph layer, the picture back at 6 s", !un.morph && un.img === 6, un);

    /* an edited prompt is kept */
    await ev(() => { const t = document.getElementById("tlmPrompt"); t.value = "my own words"; t.dispatchEvent(new Event("input")); });
    await p.fill("#tlmC1", "a gorilla");
    const ed = await ev(() => ({ v: document.getElementById("tlmPrompt").value, own: tl.morph.own }));
    await p.click("#tlmRe"); await p.waitForTimeout(150);
    const re = await ev(() => document.getElementById("tlmPrompt").value);
    check("a prompt you edit stays yours (characters changed after it); ↺ writes it again", ed.v === "my own words" && ed.own === true && /^A gorilla slowly/.test(re), { ed, re });

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.images = []; delete tl.morph; tlSave(); document.querySelector('#tlpTabs button[data-tlt="props"]').click(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
