#!/usr/bin/env node
/* bitGen Studio — 2.681.0 in a REAL browser: THE PREVIEW'S LOOK STAYS PICKED - 🌸 Anime picked in the look dropdown stays
 * after a reload; 🎨 Change style beside it renders that look on every press (two presses = two Anime requests, no menu).
 * The render is stubbed (page.route).
 * Tim (verbatim): "when a style type is set in image preview keep that style in the dropdown, user will click the change
 * style button next to it each time"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.681.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAT0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyD0aJPaIiU1OTAAAAABJRU5ErkJggg==";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const sent = []; let n = 0;
  await p.route("**/api/aiedit/engines", async (r) => { let j = {}; try { j = await (await r.fetch()).json(); } catch (e) { j = {}; } Object.assign(j, { edit: [{ id: "st_e2e681", name: "E2E edit" }], inpaint: [] }); await r.fulfill({ json: j }); });
  await p.route("**/api/aiedit", (r) => { const body = r.request().postDataBuffer().toString("latin1"); sent.push((/name="prompt"\r\n\r\n([^\r]*)/.exec(body) || [])[1] || ""); n++; return r.fulfill({ json: { jobs: [{ id: "e2e681_" + n, seed: 1 }], mode: "edit" } }); });
  await p.route("**/api/jobs/e2e681_*", (r) => { const k = r.request().url().split("_").pop(); return r.fulfill({ json: { status: "done", outputs: ["e2e681_out" + k + ".png"] } }); });
  await p.route("**/outputs/e2e681_out*.png", (r) => r.fulfill({ body: Buffer.from(PNG, "base64"), contentType: "image/png" }));
  const ready = () => p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Restyle && document.getElementById("lb_rslook") && document.getElementById("styleSel").options.length > 0, null, { timeout: 30000 });
  const open = () => ev((png) => { const s = document.getElementById("styleSel"); if (![...s.options].some((o) => o.value === "st_e2e681")) { const o = document.createElement("option"); o.value = "st_e2e681"; o.textContent = "E2E style"; s.appendChild(o); } s.value = "st_e2e681"; lbOpen([{ url: "data:image/png;base64," + png, kind: "image", name: "e2e681_source.png" }], 0); }, PNG);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" }); await ready(); await p.waitForTimeout(800);
    await ev(() => localStorage.removeItem("h3.restyle.look"));
    await open(); await p.waitForTimeout(300);
    const bar = await ev(() => { const s = document.getElementById("lb_rslook"), b = document.getElementById("lb_restyle"); return { look: s.value, next: s.nextElementSibling === b, text: b.textContent }; });
    check("the preview's bar: a look dropdown (Photoreal first) + 🎨 Change style right beside it", bar.look === "photoreal" && bar.next && bar.text === "🎨 Change style", bar);
    await p.selectOption("#lb_rslook", "anime"); await p.waitForTimeout(150);
    await p.reload({ waitUntil: "domcontentloaded" }); await ready(); await p.waitForTimeout(800); await open(); await p.waitForTimeout(300);
    check("🌸 Anime picked, then a reload: the dropdown still says Anime", (await ev(() => document.getElementById("lb_rslook").value)) === "anime");
    await p.click("#lb_restyle"); await p.waitForFunction(() => /done/.test(document.getElementById("lb_rsmsg").textContent), null, { timeout: 15000 });
    await ev(() => { document.getElementById("lb_rsmsg").textContent = ""; document.getElementById("styleSel").value = "st_e2e681"; });
    await p.click("#lb_restyle"); await p.waitForFunction(() => /done/.test(document.getElementById("lb_rsmsg").textContent), null, { timeout: 15000 });
    check("🎨 Change style pressed twice: two Anime renders, no menu in between; the look still picked", sent.length === 2 && sent.every((t) => /^Turn this into an anime illustration/.test(t)) && !(await ev(() => !!document.getElementById("lb_rsmenu"))) && (await ev(() => document.getElementById("lb_rslook").value)) === "anime", sent);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
