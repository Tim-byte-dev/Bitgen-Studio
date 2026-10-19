#!/usr/bin/env node
/* bitGen Studio — 2.400.0 in a REAL browser: the queue's ONE running card + the preview's ⏫ SeedVR2.
 * Tim (verbatim): "in the queue docker merge the running card with the running cards details and progress card, add
 * seedvr2 for upscaling videos"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the SeedVR2 / queue browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let clip = "";
  try {
    const job = { id: "ab12cd34ef56", status: "running", project: "x", created: Date.now() / 1000 - 75, started: Date.now() / 1000 - 70,
      params: { mode: "ref2va", prompt: "A woman walks along a beach at sunset", width: 960, height: 544 },
      progress: { step: 3, total: 8, elapsed: 71, chunk: { i: 1, n: 2 } } };
    const other = { id: "ff00ff00ff00", status: "queued", project: "x", created: Date.now() / 1000, params: { mode: "seedvr2", prompt: "SeedVR2 ⏫ a.mp4", width: 640, height: 384 } };
    let jobs = [job, other];
    await p.route("**/api/jobs", (r) => r.fulfill({ json: jobs }));
    await p.route("**/api/jobs/history", (r) => r.fulfill({ json: { history: [] } }));
    const sent = [];
    await p.route("**/api/seedvr2", (r) => { if (r.request().method() !== "POST") return r.continue(); sent.push(JSON.parse(r.request().postData() || "{}")); r.fulfill({ json: { id: "sv1", note: "x", target: { width: 640, height: 384, mult: 2 } } }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.QueueRun && window.PvSeedVR2 && window.SeedVR2Panel, null, { timeout: 60000 });
    await p.waitForTimeout(800);

    // 1 the merged card
    await ev(() => { qTab = "pending"; GQ.items.length = 0;
      GQ.items.push({ id: "g1", mode: "video", text: "A woman walks along a beach at sunset", status: "running", jobId: "ab12cd34ef56" },
                     { id: "g2", mode: "video", text: "close-up", status: "waiting" });
      paintQueue(); return refreshJobs(); });
    await p.waitForTimeout(300);
    const t1 = await ev(() => {
      const card = document.querySelector("#genq .gq.run");
      return { cards: document.querySelectorAll("#genq .gq.run").length, id: card.querySelector(".gqid").textContent,
        run: card.querySelector(".gqrun").textContent, bar: card.querySelector(".gqbar > i").style.width,
        st: card.querySelector(".gqst").textContent, btns: card.querySelectorAll(".gqbtn").length,
        rows: [...document.querySelectorAll("#jobs .job")].map((x) => x.dataset.id), text: card.querySelector(".gqtext").textContent };
    });
    check("ONE running card: the queue row carries 'ab12cd34ef56 · ref2va · 960×544', a 19% bar, 'chunk 1/2 · step 3 of 8 · 1:11 · 19%', its ⏸ ▲ ▼ ✕, the prompt once; the job list shows only the other job",
      t1.cards === 1 && t1.id === "ab12cd34ef56 · ref2va · 960×544" && t1.bar === "19%" && t1.run === "chunk 1/2 · step 3 of 8 · 1:11 · 19%"
      && t1.st === "running" && t1.btns === 4 && /beach at sunset/.test(t1.text) && t1.rows.length === 1 && t1.rows[0] === "ff00ff00ff00", t1);
    await ev(() => document.querySelector("#genq .gq.run .gqtext").click());
    // 2.409.0: wait for the repaint (refreshJobs' two fetches) rather than a fixed 300 ms - a busier page start missed it
    await p.waitForFunction(() => { const c = document.querySelector("#genq .gq.run"); return c && c.classList.contains("sel"); }, null, { timeout: 5000 }).catch(() => {});
    const t2 = await ev(() => ({ sel: selJob, cls: document.querySelector("#genq .gq.run").classList.contains("sel") }));
    check("clicking the card follows that render (selJob, the card highlighted)", t2.sel === "ab12cd34ef56" && t2.cls, t2);
    jobs = [Object.assign({}, job, { progress: { step: 6, total: 8, elapsed: 130, chunk: { i: 2, n: 2 } } }), other];
    await ev(() => refreshJobs());
    await p.waitForTimeout(200);
    const t3 = await ev(() => { const c = document.querySelector("#genq .gq.run"); return { bar: c.querySelector(".gqbar > i").style.width, run: c.querySelector(".gqrun").textContent }; });
    check("the next poll moves the same card: chunk 2/2 step 6 of 8 = 88%", t3.bar === "88%" && /^chunk 2\/2 · step 6 of 8 · 2:10/.test(t3.run), t3);
    await ev(() => document.querySelector("#genq .gq.run .gqbtn").click());       // ⏸ must not also select / navigate
    const t4 = await ev(() => ({ paused: queuePaused, glyph: document.querySelector("#genq .gq.run .gqbtn").textContent }));
    await ev(() => { queuePaused = false; paintQueue(); });
    check("⏸ on the card still pauses the queue (a button click is not a card click)", t4.paused === true && t4.glyph === "▶", t4);
    jobs = [];
    await ev(() => { GQ.items.length = 0; paintQueue(); return refreshJobs(); });

    // 2 the preview's ⏫ SeedVR2
    const where = await (await fetch(URL_ + "api/outputs/where")).json();
    const proj = (where.dirs || where).find((x) => x.where === "project");
    clip = path.join(proj.dir, "output", `svui_${process.pid}.mp4`);
    fs.mkdirSync(path.dirname(clip), { recursive: true });
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x192:rate=24", "-t", "1", "-pix_fmt", "yuv420p", "-c:v", "libx264", clip]);
    const name = path.basename(clip);
    await ev((n) => { curVideo = null; playVideo(n); }, name);
    await p.waitForTimeout(600);
    await ev(() => document.getElementById("pvSeedvr2").click());
    await p.waitForFunction(() => /→/.test(document.getElementById("svPlan").textContent), null, { timeout: 15000 }).catch(() => {});
    const u1 = await ev(() => ({ shown: !document.getElementById("svPanel").classList.contains("hidden"), src: document.getElementById("svSrc").textContent,
      plan: document.getElementById("svPlan").textContent, size: document.getElementById("svSize").value, go: document.getElementById("svGo").disabled,
      btn: document.getElementById("pvSeedvr2").textContent }));
    check("⏫ SeedVR2 in the preview bar opens its panel for the video playing: '320×192 → 1800×1080' at 1080p, Upscale ready",
      u1.btn === "⏫ SeedVR2" && u1.shown && u1.src === name + " · preview" && u1.size === "1080" && u1.plan === "320×192 → 1800×1080 (×5.625)" && !u1.go, u1);
    await ev(() => { const s = document.getElementById("svSize"); s.value = "x2"; s.dispatchEvent(new Event("change")); document.getElementById("svColor").value = "wavelet"; });
    await p.waitForFunction(() => /640×384/.test(document.getElementById("svPlan").textContent), null, { timeout: 10000 }).catch(() => {});
    const u2 = await ev(() => document.getElementById("svPlan").textContent);
    await ev(() => document.getElementById("svGo").click());
    await p.waitForTimeout(600);
    const u3 = await ev(() => ({ shown: !document.getElementById("svPanel").classList.contains("hidden"), title: document.getElementById("vtitle").textContent, sel: selJob }));
    check("×2 says 640×384; ⏫ Upscale sends the name + the choices, says it was queued, closes, follows the job",
      /320×192 → 640×384/.test(u2) && sent.length === 1 && sent[0].name === name && sent[0].from === "preview" && sent[0].size === "x2" && sent[0].color === "wavelet" && sent[0].chunk
      && !u3.shown && /⏫ SeedVR2 queued: .* → 640×384/.test(u3.title) && u3.sel === "sv1", { u2, sent, u3 });
    await ev(() => { curVideo = "__preview__abc"; document.getElementById("pvSeedvr2").click(); });
    await p.waitForTimeout(300);
    const u4 = await ev(() => ({ go: document.getElementById("svGo").disabled, plan: document.getElementById("svPlan").textContent }));
    await ev(() => PvSeedVR2.close());
    check("a live preview (not a file) cannot be sent: Upscale off, says to select a video", u4.go && /select a video first/.test(u4.plan), u4);

    // 3 the ⚙ Upscaler
    const g = await ev(() => [...document.getElementById("vdSetUpscaler").options].map((o) => o.value + "|" + o.textContent));
    check("the video docker ⚙ Upscaler offers 'SeedVR2 (video)'", g.some((x) => /^seedvr2\|SeedVR2 \(video\)/.test(x)), g);
    check("no page errors", !errs.length, errs);
  } catch (e) {
    check("ran without throwing", false, String(e && e.stack || e));
  } finally {
    if (clip) try { fs.rmSync(clip, { force: true }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
