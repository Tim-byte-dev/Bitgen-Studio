#!/usr/bin/env node
/* bitGen Studio — 2.384.0: render details, steps and seeds in a REAL browser (the server's answers are stubbed where a
 * GPU job would be needed: a running job, a finished one, a rendering scene).
 * Run against the running app (H3_URL, default the e2e server on :8311). No Playwright here = SKIP (exit 0).
 *   1. the dock pins: lit while NOT pinned, dim once pinned; the LLM tokens lines;
 *   2. the queue: "step n of total · m:ss" on the running job, ⓘ on the finished one -> the details dialog (♻ Use puts
 *      its seed in Basic Settings);
 *   3. the preview dialog's right pane;
 *   4. Basic Settings' 🎲 / ♻ + "last seed used";
 *   5. the video docker's ⚙ Seed (same seed for every scene, ♻ the last one) saves;
 *   6. a rendering scene: "running step n of total", its bar, its time; its seed box saves. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the render details browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); }
};
const now = () => Date.now() / 1000;
const META = { seed: 424242, cfg: 4, steps: 8, sampler: "euler", models: ["klein.safetensors"], loras: [{ name: "grain.safetensors", weight: 0.8 }],
  mode: "image", width: 1024, height: 1024, prompt: "a tiger in the rain", seconds: 75, finished: 1790000000 };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  let savedRS = null, savedSeed = null;
  await p.route("**/api/jobs", (route) => route.fulfill({ json: [
    { id: "run111", status: "running", started: now() - 75, params: { mode: "t2va", width: 960, height: 544, prompt: "running one" },
      progress: { step: 3, total: 8, pct: 38, elapsed: 75, chunk: { i: 1, n: 1 } }, meta: {} },
    { id: "done222", status: "done", started: 1, finished: 76, output: "img_done.png", params: { mode: "image", width: 1024, height: 1024, prompt: "a tiger in the rain" }, meta: META },
  ] }));
  await p.route("**/api/job-meta/last-seed", (route) => route.fulfill({ json: { seed: 424242, id: "done222" } }));
  await p.route("**/api/job-meta?name=*", (route) => route.fulfill({ json: { name: "img_done.png", source: "job", id: "done222", meta: META } }));
  // a dropped connection under load must not crash the run: route.fetch is retried, then a stub answers
  const passOn = async (route, dflt) => {
    for (let i = 0; i < 4; i++) {
      try { const r = await route.fetch(); return await r.json(); } catch { await new Promise((ok) => setTimeout(ok, 300)); }
    }
    return dflt;
  };
  await p.route("**/api/stats", async (route) => {
    const j = await passOn(route, {});
    j.running = { id: "run111", started: now() - 80, log_tail: "x", progress: { step: 4, total: 8, pct: 50, elapsed: 80, chunk: { i: 1, n: 1 } } };
    route.fulfill({ json: j }).catch(() => null);
  });
  await p.route("**/api/scenes/render-settings", async (route) => {
    if (route.request().method() === "POST") { savedRS = JSON.parse(route.request().postData() || "{}").settings; }
    const j = await passOn(route, { settings: {} });
    j.settings = { ...j.settings, ...(savedRS || {}), last_seed: 515151 };
    route.fulfill({ json: j }).catch(() => null);
  });
  await p.route((u) => u.pathname === "/api/scenes", (route) => route.fulfill({ json: { project: "p", style: "", plan: { shots: [], prompt_prefix: [] }, pending: [],
    list: [{ n: 1, id: "clip_01", prompt: ["walk"], status: "running", job: "run111", progress: { step: 5, total: 8, pct: 63, elapsed: 125, chunk: { i: 1, n: 1 } } },
           { n: 2, id: "clip_02", prompt: ["run"], status: "rendered", output: "scene_2.mp4", render_seconds: 134, seed_used: 777, user_seed: 4242 }] } }));
  await p.route((u) => /^\/api\/scenes\/\d+\/seed$/.test(u.pathname), (route) => { savedSeed = JSON.parse(route.request().postData() || "{}"); route.fulfill({ json: { ok: true, user_seed: savedSeed.seed } }); });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3JobMeta && typeof dsReady !== "undefined" && dsReady, null, { timeout: 30000 });
    await p.waitForTimeout(1500);

    // 1
    const pins = await p.evaluate(() => {
      const b0 = document.querySelector("#promptdock .pinbtn");
      if (b0.classList.contains("on")) b0.click();
      const off = getComputedStyle(b0); const a = [off.opacity, off.filter];
      b0.click(); const on = getComputedStyle(b0); const r = [on.opacity, on.filter]; b0.click();
      return { unpinned: a, pinned: r };
    });
    check("pins: lit while not pinned (full opacity, colour), dim grey once pinned", pins.unpinned[0] === "1" && pins.unpinned[1] === "none"
      && +pins.pinned[0] < 0.6 && /grayscale/.test(pins.pinned[1]), pins);
    const tok = await p.evaluate(() => [...document.querySelector("#sec-llmtok .toklines").children].map((x) => x.id || x.tagName + ":" + x.textContent.trim().slice(0, 20)));
    check("LLM tokens: one item per line (≈ in prompt / Reply budget / slider / Tokens consumed / in-out)",
      tok[0] === "tokCount" && /LABEL:Reply budget/.test(tok[1]) && tok[2] === "tokMax" && /SPAN:Tokens consumed:/.test(tok[3]) && tok[4] === "tokUsedIO", tok);

    // 2
    await p.evaluate(() => refreshJobs());
    await p.waitForTimeout(500);
    const runTxt = await p.evaluate(() => { const r = document.querySelector('#jobs .job[data-id="run111"] .st'); return r && r.textContent; });
    check("queue: the running job says 'step n of total · m:ss' instead of 'running'", /^step [34] of 8 · 1:[12][05]$/.test(runTxt || ""), runTxt);
    await p.evaluate(() => { qTab = "done"; refreshJobs(); });
    await p.waitForTimeout(500);
    await p.click('#jobs .job[data-id="done222"] .jinfo');
    await p.waitForTimeout(250);
    const dl = await p.evaluate(() => ({ open: document.getElementById("jmDlg").open, title: document.getElementById("jmTitle").textContent,
      text: document.getElementById("jmBody").textContent }));
    check("...the finished job's ⓘ opens the details dialog: seed, cfg, steps, sampler, model, LoRAs, size, time, prompt",
      dl.open && /done222/.test(dl.title) && ["424242", "CFG4", "Steps8", "euler", "klein.safetensors", "grain.safetensors · 0.8", "1024×1024", "1m 15s", "a tiger in the rain"].every((s) => dl.text.replace(/\s+/g, "").includes(s.replace(/\s+/g, ""))), dl);
    await p.click('#jmBody [data-jmseed]');
    check("...♻ Use puts the seed in Basic Settings", await p.evaluate(() => document.getElementById("seed").value) === "424242");
    await p.evaluate(() => { document.getElementById("jmDlg").close(); qTab = "pending"; refreshJobs(); });

    // 3
    await p.evaluate(() => lbOpen([{ url: "/static/icon.png", kind: "image", name: "img_done.png" }], 0));
    await p.waitForTimeout(600);
    const pane = await p.evaluate(() => { const m = document.getElementById("lb_meta"); return { vis: m.offsetWidth > 100, text: m.textContent }; });
    check("the preview dialog has a right pane with the render details", pane.vis && /Render details/.test(pane.text) && /424242/.test(pane.text) && /klein\.safetensors/.test(pane.text), pane);
    await p.click("#lb_info");
    check("...ⓘ hides it", await p.evaluate(() => document.getElementById("lb_meta").offsetWidth === 0));
    await p.click("#lb_info");
    await p.evaluate(() => document.getElementById("lb").close());

    // 4 (2.393.0: Basic Settings floats - S shows it)
    await p.evaluate(() => window.SecFloat && window.SecFloat.show && window.SecFloat.show("basic", true)); await p.waitForTimeout(200);
    await p.click("#seedRand");
    const r1 = await p.evaluate(() => document.getElementById("seed").value);
    await p.click("#seedLast");
    const r2 = await p.evaluate(() => [document.getElementById("seed").value, document.getElementById("seedLastV").textContent]);
    check("Basic Settings: 🎲 = -1 (random), ♻ = the last seed used (shown under the box)", r1 === "-1" && r2[0] === "424242" && /last seed used: 424242/.test(r2[1]), [r1, r2]);
    await p.evaluate(() => window.SecFloat && window.SecFloat.show && window.SecFloat.show("basic", false));

    // 5
    await p.evaluate(() => { const d = document.getElementById("videodock"); if (/collapsed|dockgone/.test(d.className)) toggleCollapse("videodock"); });
    await p.click("#vdSetBtn"); await p.waitForTimeout(700);
    const last = await p.evaluate(() => document.getElementById("vdSetSeedLast").textContent);
    await p.click("#vdSetSeedUse"); await p.waitForTimeout(700);
    check("video docker ⚙: 'last seed used' shown; ♻ sets it as THE seed and turns on 'Same seed for every scene' (saved)",
      /515151/.test(last) && savedRS && savedRS.seed_mode === "same" && savedRS.seed === 515151, [last, savedRS]);
    await p.click("#vdSetBtn");

    // 6
    await p.waitForFunction(() => document.querySelector('[data-sc="1"]'), null, { timeout: 15000 }).catch(() => null);
    const sc = await p.evaluate(() => {
      const c1 = document.querySelector('[data-sc="1"]'), c2 = document.querySelector('[data-sc="2"]');
      const bar = c1 && c1.querySelector(".scprog i");
      return { t1: c1 && c1.textContent, bar: bar && bar.style.width, t2: c2 && c2.textContent,
               seed2: c2 && c2.querySelector("[data-scseed]").value, reuse: !!(c2 && c2.querySelector("[data-scseeduse]")) };
    });
    check("a rendering scene: 'rendering step 5 of 8 · 2:05' (2.391.1: rendering, not running) and a progress bar (63%)", /rendering step 5 of 8 · 2:05/.test(sc.t1 || "") && sc.bar === "63%", sc);
    check("...a rendered one: its render time and the seed it used; its own seed in its box; ♻ for the last take's seed",
      /rendered in 2:14 · seed 777/.test(sc.t2 || "") && sc.seed2 === "4242" && sc.reuse, sc);
    await p.fill('[data-sc="1"] [data-scseed]', "1234");
    await p.press('[data-sc="1"] [data-scseed]', "Tab");
    await p.waitForTimeout(400);
    check("...the scene's seed box saves (POST /api/scenes/:n/seed)", savedSeed && savedSeed.seed === 1234, savedSeed);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 600));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
