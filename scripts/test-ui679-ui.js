#!/usr/bin/env node
/* bitGen Studio — 2.679.0 in a REAL browser: THE RESTYLE'S RESULT SHOWN + ⇆ BEFORE / AFTER - a 🎨 Style render finishes:
 * the result shown in the preview (opened again if it was closed meanwhile); ⇆ Before / after shows the original and the
 * result side by side; gone on another picture; a result opened later (from its name) still has its original.
 * The render is stubbed (page.route).
 * Tim (verbatim): "after the style change render is complete in image preview, show the finished image in preview, add a
 * sbs button so user can see before and after style change"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.679.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAT0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyD0aJPaIiU1OTAAAAABJRU5ErkJggg==";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  let polls = 0, release = false;
  await p.route("**/api/aiedit/engines", async (r) => { let j = {}; try { j = await (await r.fetch()).json(); } catch (e) { j = {}; } Object.assign(j, { edit: [{ id: "st_e2e679", name: "E2E edit" }], inpaint: [] }); await r.fulfill({ json: j }); });
  await p.route("**/api/aiedit", (r) => r.fulfill({ json: { jobs: [{ id: "e2e679_job", seed: 1 }], mode: "edit" } }));
  await p.route("**/api/jobs/e2e679_job", (r) => { polls++; return r.fulfill({ json: release ? { status: "done", outputs: ["e2e679_result.png"] } : { status: "running", progress: { step: 3, total: 8 } } }); });
  await p.route("**/outputs/e2e679_result.png", (r) => r.fulfill({ body: Buffer.from(PNG, "base64"), contentType: "image/png" }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Restyle && document.getElementById("lb_sbs") && document.getElementById("styleSel").options.length > 0, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await ev((png) => { localStorage.removeItem("h3.restyle.pairs"); const s = document.getElementById("styleSel"); const o = document.createElement("option"); o.value = "st_e2e679"; o.textContent = "E2E style"; s.appendChild(o); s.value = "st_e2e679"; lbOpen([{ url: "data:image/png;base64," + png, kind: "image", name: "e2e679_source.png" }], 0); }, PNG);
    await p.waitForTimeout(300);
    check("an ordinary picture: no ⇆ Before / after", await ev(() => document.getElementById("lb_sbs").style.display === "none"));
    await ev(() => { document.getElementById("styleSel").value = "st_e2e679"; });
    await p.selectOption("#lb_rslook", "anime"); await p.click("#lb_restyle");
    for (let i = 0; i < 40 && polls === 0; i++) await p.waitForTimeout(250);   // the render is running
    await p.waitForTimeout(1500);
    // the preview closed while it renders - the result must still be shown when it is done
    await ev(() => document.getElementById("lb").close()); release = true;
    await p.waitForFunction(() => document.getElementById("lb").open && document.getElementById("lb_name").textContent === "e2e679_result.png", null, { timeout: 15000 });
    const st = await ev(() => ({ n: lb.items.length, i: lb.i, first: lb.items[0].name, sbs: document.getElementById("lb_sbs").style.display !== "none" }));
    check("done while the preview was closed: it opens again ON the finished picture (the original before it)", st.n === 2 && st.i === 1 && st.first === "e2e679_source.png", st);
    check("…⇆ Before / after offered on the result", st.sbs, st);
    await p.click("#lb_sbs"); await p.waitForTimeout(300);
    const v = await ev(() => { const V = document.getElementById("lb_sbsview"); return V && { caps: [...V.querySelectorAll("figcaption")].map((c) => c.textContent), imgs: [...V.querySelectorAll("img")].map((i) => i.src.slice(0, 30)), on: document.getElementById("lb_sbs").classList.contains("on"), w: V.getBoundingClientRect().width }; });
    check("⇆ Before / after: the original and the result side by side, labelled", v && v.caps[0] === "Before · e2e679_source.png" && v.caps[1] === "After · 🌸 Anime · e2e679_result.png" && /^data:image\/png/.test(v.imgs[0]) && v.on && v.w > 300, v);
    if (process.env.H3_SHOT) await p.screenshot({ path: path.join(process.env.H3_SHOT, "restyle679-sbs.png") });
    await p.click("#lb_sbs"); await p.waitForTimeout(200);
    check("…clicked again: back to the picture", await ev(() => !document.getElementById("lb_sbsview") && !document.getElementById("lb_sbs").classList.contains("on")));
    await p.click("#lb_sbs"); await p.waitForTimeout(200); await ev(() => { lb.i = 0; lbShow(); }); await p.waitForTimeout(300);
    check("another picture shown: the side by side gone, the button hidden (the original has no 'before')", await ev(() => !document.getElementById("lb_sbsview") && document.getElementById("lb_sbs").style.display === "none"));
    await ev(() => { document.getElementById("lb").close(); lbOpen([{ url: "/outputs/e2e679_result.png", kind: "image", name: "e2e679_result.png" }], 0); }); await p.waitForTimeout(300);
    check("the result opened later on its own (as from the gallery): ⇆ Before / after still there (remembered)", await ev(() => document.getElementById("lb_sbs").style.display !== "none" && !!JSON.parse(localStorage.getItem("h3.restyle.pairs"))["e2e679_result.png"]));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
