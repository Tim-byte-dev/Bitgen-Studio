#!/usr/bin/env node
/* bitGen Studio — 2.684.0 in a REAL browser: THE IMAGE PREVIEW'S LOOK DROPDOWN FITS THE BAR. The app's select{width:100%}
 * stretched #lb_rslook across the preview's bar and folded every button onto two lines; now it is as wide as its words,
 * the bar's buttons' height, and every button keeps one line - wide and narrow windows.
 * Tim (verbatim): "fix the style dropdown in preview image it is too long and breaks the aesthetic"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.684.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAT0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyD0aJPaIiU1OTAAAAABJRU5ErkJggg==";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const measure = () => ev(() => {
    const s = document.getElementById("lb_rslook"), bar = s.closest(".lbbar"), btns = [...bar.querySelectorAll("button")].filter((x) => x.offsetParent !== null);
    const R = (e) => e.getBoundingClientRect(), sr = R(s), cr = R(document.getElementById("lb_restyle"));
    const lh = btns.map((x) => { const r = R(x), l = parseFloat(getComputedStyle(x).lineHeight) || parseFloat(getComputedStyle(x).fontSize) * 1.3; return { id: x.id || x.textContent.trim().slice(0, 12), lines: Math.round((r.height - 12) / l) }; });
    return { w: Math.round(sr.width), h: Math.round(sr.height), bh: Math.round(cr.height), dTop: Math.round(Math.abs(sr.top - cr.top)), barW: Math.round(R(bar).width), over: bar.scrollWidth > bar.clientWidth + 1, wrapped: lh.filter((x) => x.lines > 1) };
  });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Restyle && document.getElementById("lb_rslook"), null, { timeout: 30000 });
    await ev((png) => lbOpen([{ url: "data:image/png;base64," + png, kind: "image", name: "e2e684.png" }], 0), PNG);
    await p.waitForTimeout(400);
    const m = await measure();
    check("the look dropdown is as wide as its words (under 160 px, not across the bar)", m.w > 60 && m.w < 160 && m.w < m.barW / 4, m);
    check("…the height of 🎨 Change style beside it, on the same line", Math.abs(m.h - m.bh) <= 2 && m.dTop <= 2, m);
    check("every button in the bar keeps one line; nothing overflows", m.wrapped.length === 0 && !m.over, m);
    await p.setViewportSize({ width: 1100, height: 800 }); await p.waitForTimeout(300);
    const n = await measure();
    check("a narrower window (1100 px): the same - small, one line, nothing overflows", n.w < 160 && n.wrapped.length === 0 && !n.over, n);
    const st = await ev(() => { const c = getComputedStyle(document.getElementById("lb_rslook")), v = getComputedStyle(document.getElementById("lb_save")); return { r: c.borderTopLeftRadius, bg: c.backgroundColor, sr: v.borderTopLeftRadius, sbg: v.backgroundColor }; });
    check("its corners + background match the bar's buttons (💾 Save)", st.r === st.sr && st.bg === st.sbg, st);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
