#!/usr/bin/env node
/* bitGen Studio — 2.676.0 in a REAL browser: THE IMAGE PREVIEW'S 🎨 STYLE ▾ - the button beside 💾 Save, its menu (the five
 * looks, "With <the prompt's style>"), a look picked: the picture sent to /api/aiedit (Edit with an edit model / Refine over
 * the whole picture with an SDXL style), Basic Settings' values only with Override style on, the result opened in the
 * preview. The server's render is stubbed here (page.route) - the request itself is what is checked.
 * Tim (verbatim): "in the image preview dialog, add a button with a dropdown to change the style of the picture,
 * photoreal, pixar, 2.5D, anime,cartoon. use the style chosen in prompt unless overide is checked to generate the image
 * from the image being previewed"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.676.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
// a 64 x 40 red PNG
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAT0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyD0aJPaIiU1OTAAAAABJRU5ErkJggg==";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const sent = [];
  let how = "edit";
  // the real answer (the image editor reads it too), its two lists made what this test needs
  await p.route("**/api/aiedit/engines", async (r) => { let j = {}; try { j = await (await r.fetch()).json(); } catch (e) { j = {}; }
    Object.assign(j, how === "edit" ? { edit: [{ id: "st_e2e676", name: "E2E edit" }], inpaint: [] } : how === "refine" ? { edit: [], inpaint: [{ id: "st_e2e676", name: "E2E SDXL", refine: true }] } : { edit: [], inpaint: [] });
    await r.fulfill({ json: j }); });
  await p.route("**/api/aiedit", async (r) => { const req = r.request(); sent.push({ ct: req.headers()["content-type"] || "", body: req.postDataBuffer() ? req.postDataBuffer().toString("latin1") : "" }); await r.fulfill({ json: { jobs: [{ id: "e2e676_" + sent.length, seed: 1 }], mode: how } }); });
  await p.route("**/api/jobs/e2e676_*", (r) => r.fulfill({ json: { status: "done", outputs: ["e2e676_result.png"] } }));
  const field = (s, k) => { const m = new RegExp('name="' + k + '"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--').exec(s.body); return m ? m[1] : null; };
  const hasFile = (s, k) => new RegExp('name="' + k + '"; filename=').test(s.body);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Restyle && document.getElementById("lb_restyle"), null, { timeout: 30000 });
    await p.waitForFunction(() => document.getElementById("styleSel").options.length > 0, null, { timeout: 20000 }); await p.waitForTimeout(800);
    const pickStyle = () => ev(() => { const s = document.getElementById("styleSel"); if (![...s.options].some((o) => o.value === "st_e2e676")) { const o = document.createElement("option"); o.value = "st_e2e676"; o.textContent = "E2E style"; s.appendChild(o); } s.value = "st_e2e676"; });
    await ev(() => { const s = document.getElementById("styleSel"); if (![...s.options].some((o) => o.value === "st_e2e676")) { const o = document.createElement("option"); o.value = "st_e2e676"; o.textContent = "E2E style"; s.appendChild(o); } s.value = "st_e2e676"; const ov = document.getElementById("ovrStyle"); if (ov) ov.checked = false; });
    await ev((png) => lbOpen([{ url: "data:image/png;base64," + png, kind: "image", name: "e2e676_source.png" }], 0), PNG);
    await p.waitForTimeout(300);
    const btn = await ev(() => { const b = document.getElementById("lb_restyle"), s = document.getElementById("lb_save"); return { text: b.textContent, before: b.nextElementSibling && b.nextElementSibling.nextElementSibling === s, shown: b.offsetParent !== null }; });
    check("🎨 Style ▾ in the preview's bar, beside 💾 Save", btn.text === "🎨 Style ▾" && btn.before && btn.shown, btn);
    await pickStyle(); await p.click("#lb_restyle"); await p.waitForTimeout(150);
    const menu = await ev(() => ({ hd: document.querySelector("#lb_rsmenu .hd").textContent, items: [...document.querySelectorAll("#lb_rsmenu .it")].map((d) => d.textContent) }));
    check("its menu: With <the prompt's style> + Photoreal, Pixar, 2.5D, Anime, Cartoon", /^With E2E style \(the prompt's style\)$/.test(menu.hd) && menu.items.join("|") === "📷 Photoreal|🧸 Pixar|🧊 2.5D|🌸 Anime|🖍 Cartoon", menu);
    await p.click('#lb_rsmenu .it[data-look="pixar"]');
    await p.waitForFunction(() => document.getElementById("lb_name").textContent === "e2e676_result.png", null, { timeout: 15000 });
    const s0 = sent[0];
    check("🧸 Pixar with an edit model: /api/aiedit mode edit, the prompt's style, the picture as the crop (~1 MP, its shape), the whole picture, no override", s0 && field(s0, "mode") === "edit" && field(s0, "style_id") === "st_e2e676" && hasFile(s0, "crop") && !hasFile(s0, "mask") && field(s0, "whole") === "1" && field(s0, "width") === "1296" && field(s0, "height") === "816" && /^Turn this into a Pixar-style/.test(field(s0, "prompt")) && field(s0, "ovr") === null, s0 && { mode: field(s0, "mode"), w: field(s0, "width"), h: field(s0, "height"), ovr: field(s0, "ovr") });
    const after = await ev(() => ({ name: document.getElementById("lb_name").textContent, n: lb.items.length, i: lb.i, msg: document.getElementById("lb_rsmsg").textContent }));
    check("…done: the result opens in the preview (after the source), the bar says so", after.name === "e2e676_result.png" && after.n === 2 && after.i === 1 && /done/.test(after.msg), after);
    // an SDXL style + Override style on
    how = "refine";
    await ev(() => { const ov = document.getElementById("ovrStyle"); if (ov) { ov.checked = true; ov.dispatchEvent(new Event("change", { bubbles: true })); } lb.i = 0; lbShow(); });
    await p.waitForTimeout(200);
    await pickStyle(); await p.click("#lb_restyle"); await p.waitForTimeout(150);
    const hd2 = await ev(() => document.querySelector("#lb_rsmenu .hd").textContent);
    check("Override style on: the menu says Basic Settings' values ride along", /\+ Basic Settings \(Override style is on\)/.test(hd2), hd2);
    await ev(() => { document.getElementById("lb_rsmsg").textContent = ""; });
    await p.click('#lb_rsmenu .it[data-look="anime"]');
    await p.waitForFunction(() => /done|can't|refused|not/.test(document.getElementById("lb_rsmsg").textContent), null, { timeout: 15000 });
    const msg1 = await ev(() => document.getElementById("lb_rsmsg").textContent); if (!/done/.test(msg1)) console.log("      (the bar: " + msg1 + ")");
    const s1 = sent[1], ovr = s1 && field(s1, "ovr");
    let o = null; try { o = JSON.parse(ovr); } catch (e) { o = null; }
    check("🌸 Anime with an SDXL style: Refine over the whole picture (a full-picture mask), strength 70, the look's words; Basic Settings' steps / cfg as ovr", s1 && field(s1, "mode") === "refine" && hasFile(s1, "mask") && hasFile(s1, "rgba") && field(s1, "strength") === "70" && /^anime style/.test(field(s1, "prompt")) && o && typeof o.steps === "number" && typeof o.cfg === "number", s1 && { mode: field(s1, "mode"), strength: field(s1, "strength"), ovr });
    // a style that can do neither
    how = "none";
    await ev(() => H3Restyle.run("cartoon").catch((e) => { document.getElementById("lb_rsmsg").textContent = "🎨 " + e.message; }));
    await p.waitForTimeout(300);
    check("a style that can remake neither way: said (pick an edit model or an SDXL / FLUX style), nothing sent", sent.length === 2 && /can't remake a picture - pick an edit model/.test(await ev(() => document.getElementById("lb_rsmsg").textContent)));
    await ev(() => lbOpen([{ url: "/x.mp4", kind: "video", name: "clip.mp4" }], 0)); await p.waitForTimeout(200);
    check("a video in the preview: no 🎨 Style button", await ev(() => document.getElementById("lb_restyle").style.display === "none"));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
