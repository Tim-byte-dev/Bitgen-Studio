#!/usr/bin/env node
/* bitGen Studio — 2.805.0 against the RUNNING app (+ a real browser): the image preview's style dropdown + ☐ Basic Settings beside
 * 🎨 Change style; the look, the button, the style and the tick only while a picture is shown.
 * Tim (verbatim): "in preview dialog add a style dropdown next to the change style button, add a checkbox next to it to use basic
 * settings. use the last basic settings the style used to change the style of the preview picture (show change style dropdown ,
 * button and the new button and new dropdown only when in picture mode".
 * /api/aiedit is answered by the test (nothing rendered). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAT0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyD0aJPaIiU1OTAAAAABJRU5ErkJggg==";

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const sent = [];
  await p.route("**/api/aiedit", async (r) => {
    const body = r.request().postDataBuffer().toString("latin1"), f = (n) => ((new RegExp('name="' + n + '"\\r\\n\\r\\n([^\\r]*)')).exec(body) || [])[1];
    sent.push({ style_id: f("style_id"), ovr: f("ovr"), seed: f("seed") });
    await r.fulfill({ status: 400, json: { error: "e2e805 stop" } });
  });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Restyle && document.getElementById("lb_rsstyle") && document.getElementById("styleSel").options.length > 1 && window.H3StyleBasic && H3StyleBasic.ready(), null, { timeout: 40000 });
    await p.waitForTimeout(1500);
    const ids = await ev(() => [...document.getElementById("styleSel").options].map((o) => o.value).filter(Boolean));
    const own = await ev(() => document.getElementById("styleSel").value), other = ids.find((x) => x !== own);
    check("the test server has two image styles at least", ids.length >= 2 && !!other, ids);
    await ev((png) => lbOpen([{ url: "data:image/png;base64," + png, kind: "image", name: "e2e805_a.png" }, { url: "/nothing.mp4", kind: "video", name: "e2e805_b.mp4" }], 0), PNG);
    await p.waitForTimeout(300);
    const bar = await ev(() => { const g = (i) => document.getElementById(i), v = (i) => !!g(i) && g(i).offsetParent !== null;
      return { order: g("lb_restyle").nextElementSibling === g("lb_rsstyle") && g("lb_rsstyle").nextElementSibling === g("lb_rsbasicw"), shown: ["lb_rslook", "lb_restyle", "lb_rsstyle", "lb_rsbasicw"].every(v),
        opts: [...g("lb_rsstyle").options].map((o) => o.value), first: g("lb_rsstyle").options[0].textContent, tick: g("lb_rsbasicw").textContent, cb: g("lb_rsbasic").type }; });
    check("a picture: the look, 🎨 Change style, then the style dropdown, then ☐ Basic Settings - all shown", bar.order && bar.shown && bar.tick === "Basic Settings" && bar.cb === "checkbox", bar);
    check("the style dropdown = ✎ The prompt's style + the prompt's image styles", bar.first === "✎ The prompt's style" && bar.opts[0] === "" && ids.every((x) => bar.opts.includes(x)), bar.opts);
    await ev(() => { lb.i = 1; lbShow(); }); await p.waitForTimeout(300);
    const vid = await ev(() => ["lb_rslook", "lb_restyle", "lb_rsstyle", "lb_rsbasicw", "lb_rsmsg"].map((i) => document.getElementById(i).style.display));
    check("a video shown: all of them hidden (picture mode only)", vid.every((d) => d === "none"), vid);
    await ev(() => { lb.i = 0; lbShow(); }); await p.waitForTimeout(300);
    check("back to the picture: shown again", await ev(() => ["lb_rslook", "lb_restyle", "lb_rsstyle", "lb_rsbasicw"].every((i) => document.getElementById(i).style.display === "")));
    // another style, with Basic Settings kept for it (as misc/basic_settings.tmp holds them), ☐ Basic Settings ticked
    await ev((id) => { H3StyleBasic.file().styles["image:" + id] = { kind: "image", id, style: "x", basic: { imgSteps: "23", imgCfg: "4.5", imgSeed: "77", imgCkpt: "e2e805_ckpt.safetensors" } };
      const s = document.getElementById("lb_rsstyle"); s.value = id; s.dispatchEvent(new Event("change"));
      const c = document.getElementById("lb_rsbasic"); c.checked = true; c.dispatchEvent(new Event("change")); }, other);
    const tipT = await ev(() => { document.getElementById("lb_rsbasicw").dispatchEvent(new Event("mouseenter")); return document.getElementById("lb_rsbasicw").title; });
    check("the tick's tooltip says what that style last had", /23 steps, CFG 4\.5, e2e805_ckpt\.safetensors, seed 77/.test(tipT), tipT);
    await p.click("#lb_restyle");
    await p.waitForFunction(() => /e2e805 stop|can't remake/.test(document.getElementById("lb_rsmsg").textContent), null, { timeout: 15000 }).catch(() => {});
    const msg = await ev(() => document.getElementById("lb_rsmsg").textContent);
    if (/can't remake/.test(msg)) console.log("SKIP: " + other + " cannot restyle on this server (" + msg + ")");
    else {
      const s0 = sent[sent.length - 1] || {};
      check("🎨 Change style renders with the picked style and the Basic Settings it last had (steps, CFG, checkpoint, seed)", s0.style_id === other && /"steps":23/.test(s0.ovr || "") && /"cfg":4\.5/.test(s0.ovr || "") && /e2e805_ckpt/.test(s0.ovr || "") && s0.seed === "77", s0);
      // untick: its own settings
      await ev(() => { const c = document.getElementById("lb_rsbasic"); c.checked = false; c.dispatchEvent(new Event("change")); });
      await p.click("#lb_restyle"); await p.waitForTimeout(1500);
      const s1 = sent[sent.length - 1] || {};
      check("☐ unticked: no Basic Settings sent (the style's own)", sent.length >= 2 && s1.style_id === other && s1.ovr === undefined, s1);
      // a style with nothing kept: said, the style's own
      await ev((id) => { delete H3StyleBasic.file().styles["image:" + id]; const c = document.getElementById("lb_rsbasic"); c.checked = true; c.dispatchEvent(new Event("change")); }, other);
      await ev(() => { window.__m = []; const m = document.getElementById("lb_rsmsg"); new MutationObserver(() => window.__m.push(m.textContent)).observe(m, { childList: true, characterData: true, subtree: true }); });
      await p.click("#lb_restyle"); await p.waitForTimeout(1500);
      const s2 = sent[sent.length - 1] || {}, said = await ev(() => window.__m.join(" | "));
      check("a style with no Basic Settings kept yet: nothing sent and that is no error", s2.style_id === other && s2.ovr === undefined, { s2, said });
    }
    // kept after a reload
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("lb_rsstyle"), null, { timeout: 40000 });
    await p.waitForTimeout(800);
    const kept = await ev(() => ({ s: document.getElementById("lb_rsstyle").value, c: document.getElementById("lb_rsbasic").checked }));
    check("the style picked and the tick are kept after a reload", kept.s === other && kept.c === true, kept);
    await ev(() => { localStorage.removeItem("h3.restyle.style"); localStorage.removeItem("h3.restyle.basic"); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the browser part stopped - " + (e.stack || e.message)); }
  await br.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
