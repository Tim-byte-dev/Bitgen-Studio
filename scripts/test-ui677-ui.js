#!/usr/bin/env node
/* bitGen Studio — 2.677.0 in a REAL browser: THE RESTYLE'S PROGRESS BAR UNDER THE PICTURE - 🎨 Style ▾ ▸ a look: the bar
 * under the picture (above the preview's bar) shows queued (a moving stripe), the sampler's steps filling it, done (full,
 * green, then gone). The render is stubbed (page.route) - the job goes queued -> loading -> step 5 / 25 -> 20 / 25 -> done.
 * Tim (verbatim): "show the progress of the generation with a small bar below the picture"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.677.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAT0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyD0aJPaIiU1OTAAAAABJRU5ErkJggg==";
const STEPS = [{ status: "queued" }, { status: "queued" }, { status: "running" }, { status: "running", progress: { step: 5, total: 25 } }, { status: "running", progress: { step: 5, total: 25 } }, { status: "running", progress: { step: 20, total: 25 } }, { status: "running", progress: { step: 20, total: 25 } }, { status: "done", outputs: ["e2e677_result.png"] }];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  let polls = 0;
  await p.route("**/api/aiedit/engines", async (r) => { let j = {}; try { j = await (await r.fetch()).json(); } catch (e) { j = {}; } Object.assign(j, { edit: [{ id: "st_e2e677", name: "E2E edit" }], inpaint: [] }); await r.fulfill({ json: j }); });
  await p.route("**/api/aiedit", (r) => r.fulfill({ json: { jobs: [{ id: "e2e677_job", seed: 1 }], mode: "edit" } }));
  await p.route("**/api/jobs/e2e677_job", (r) => { const j = STEPS[Math.min(polls, STEPS.length - 1)]; polls++; return r.fulfill({ json: j }); });
  const seen = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Restyle && document.getElementById("lb_rsbar") && document.getElementById("styleSel").options.length > 0, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await ev((png) => { const s = document.getElementById("styleSel"); const o = document.createElement("option"); o.value = "st_e2e677"; o.textContent = "E2E style"; s.appendChild(o); s.value = "st_e2e677"; lbOpen([{ url: "data:image/png;base64," + png, kind: "image", name: "e2e677_source.png" }], 0); }, PNG);
    await p.waitForTimeout(300);
    const place = await ev(() => { const B = document.getElementById("lb_rsbar"); return { hidden: getComputedStyle(B).display === "none", before: B.nextElementSibling && B.nextElementSibling.classList.contains("lbbar"), after: B.previousElementSibling && B.previousElementSibling.classList.contains("lbbody") }; });
    check("the bar sits under the picture (after it, above the preview's bar), hidden while nothing runs", place.hidden && place.before && place.after, place);
    await ev(() => { document.getElementById("styleSel").value = "st_e2e677"; });
    await p.selectOption("#lb_rslook", "pixar"); await p.click("#lb_restyle");
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(250);
      const v = await ev(() => { const B = document.getElementById("lb_rsbar"); return { cls: B.className, w: B.querySelector(".fl").style.width, tx: B.querySelector(".tx").textContent, shown: getComputedStyle(B).display !== "none" }; });
      const last = seen[seen.length - 1]; if (!last || last.cls !== v.cls || last.w !== v.w || last.tx !== v.tx) seen.push(v);
      if (process.env.H3_SHOT && /step 20 of 25/.test(v.tx) && !seen.shot) { seen.shot = true; await p.screenshot({ path: path.join(process.env.H3_SHOT, "restyle677-bar.png") }); }
      if (/done/.test(v.tx) && v.shown && seen.some((x) => /done/.test(x.tx))) { if (seen.filter((x) => /done/.test(x.tx)).length) break; }
    }
    const q = seen.find((x) => /queued/.test(x.tx)), lo = seen.find((x) => /loading the models/.test(x.tx)), s5 = seen.find((x) => /step 5 of 25/.test(x.tx)), s20 = seen.find((x) => /step 20 of 25/.test(x.tx)), dn = seen.find((x) => /done/.test(x.tx));
    check("queued, then loading the models: a moving stripe (no number)", q && /\bwait\b/.test(q.cls) && q.shown && lo && /\bwait\b/.test(lo.cls), seen);
    check("the steps fill it: step 5 of 25 = 20 %, step 20 of 25 = 80 % (\"🧸 Pixar · step 20 of 25 · 80 %\")", s5 && s5.w === "20%" && /\brun\b/.test(s5.cls) && s20 && s20.w === "80%" && s20.tx === "🧸 Pixar · step 20 of 25 · 80 %", seen);
    check("done: full and green", dn && dn.w === "100%" && /\bdone\b/.test(dn.cls), dn);
    await p.waitForTimeout(3600);
    check("…then it goes (the result opened in the preview)", await ev(() => getComputedStyle(document.getElementById("lb_rsbar")).display === "none" && document.getElementById("lb_name").textContent === "e2e677_result.png"));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
