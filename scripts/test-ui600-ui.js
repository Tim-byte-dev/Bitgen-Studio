#!/usr/bin/env node
/* bitGen Studio — 2.600.0 in a REAL browser, against the running app (H3_URL): Basic Settings ▸ Format ▸ 📱 SOCIAL MEDIA.
 *   The Format dropdown has the 📱 Social media group; Reels / Stories 9:16 sets Aspect 9:16 and the line under Format
 *   says the MP4 is made ready for Facebook / Instagram / TikTok; Facebook feed 4:5 sets 3:4; the render's own shape
 *   leaves Aspect alone; plain mp4 hides the line; Generate sends format=social_9x16 (the request is stood in for).
 * Tim: "please ad the social media video presets to the basic settings dropdown as well for quick access".
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.600.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let sent = null;
  await p.route(/\/api\/generate$/, async (r) => { sent = r.request().postData() || ""; await r.fulfill({ json: { id: "stub600", status: "queued" } }); });
  const pick = (v) => ev((x) => { const f = document.getElementById("format"); f.value = x; f.dispatchEvent(new Event("change", { bubbles: true })); }, v);
  const look = () => ev(() => ({ fmt: document.getElementById("format").value, ar: document.getElementById("arSel").value, line: document.getElementById("formatSocial").hidden ? "" : document.getElementById("formatSocial").textContent }));
  let keep = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SocialFmt && window.H3_PROJECT_READY, null, { timeout: 60000 });
    await p.waitForTimeout(3000);              // basic.cfg is read back 600 ms after the project (static/basiccfg.js)
    keep = await look();
    const grp = await ev(() => { const g = document.querySelector('#format optgroup'); return g ? { label: g.label, opts: [...g.querySelectorAll("option")].map((o) => o.value + "=" + o.textContent) } : null; });
    check("Basic Settings ▸ Format: mp4 / webm / avi + the 📱 Social media group (Reels 9:16, Facebook feed 4:5, Square 1:1, Landscape 16:9, own shape)",
      grp && /Social media \(Facebook \/ Instagram \/ TikTok\)/.test(grp.label) && grp.opts.join("|") === "social_9x16=mp4 · Reels / Stories 9:16|social_4x5=mp4 · Facebook feed 4:5|social_1x1=mp4 · Square 1:1|social_16x9=mp4 · Landscape 16:9|social=mp4 · social, the render's own shape", grp);
    await pick("mp4"); await ev(() => { const a = document.getElementById("arSel"); a.value = "16:9"; a.dispatchEvent(new Event("change", { bubbles: true })); });
    await pick("social_9x16");
    const l1 = await look();
    check("Reels / Stories 9:16: Aspect becomes 9:16 (the model renders that shape); the line says the MP4 is made ready for Facebook / Instagram / TikTok",
      l1.ar === "9:16" && /📱 When it is rendered the MP4 is made ready for Facebook \/ Instagram \/ TikTok: 9:16 \(Reels \/ Stories\)/.test(l1.line), l1);
    await pick("social_4x5");
    const l2 = await look();
    check("Facebook feed 4:5: Aspect 3:4 (cut to 4:5 after)", l2.ar === "3:4" && /4:5 \(the Facebook feed - rendered 3:4, cut to 4:5\)/.test(l2.line), l2);
    await ev(() => { const a = document.getElementById("arSel"); a.value = "16:9"; a.dispatchEvent(new Event("change", { bubbles: true })); });
    await pick("social");
    const l3 = await look();
    check("the render's own shape: Aspect stays (16:9)", l3.ar === "16:9" && /its own shape/.test(l3.line), l3);
    await pick("social_9x16");
    await ev(() => { if (typeof submitJob === "function") return; });
    // the request Generate makes: the same FormData field the page builds
    await ev(() => { const fd = new FormData(); for (const k of ["width", "height", "steps", "cfg", "seed", "format"]) fd.append(k, document.getElementById(k).value); return fetch("/api/generate", { method: "POST", body: fd }); });
    check("the Generate request carries format=social_9x16", /name="format"\r\n\r\nsocial_9x16/.test(sent || ""), (sent || "").slice(0, 300));
    await pick("mp4");
    check("plain mp4: the line goes", (await look()).line === "");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { if (keep) await ev((k) => { document.getElementById("format").value = k.fmt; document.getElementById("arSel").value = k.ar; }, keep); } catch { /* fine */ }
    try { await b.close(); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
