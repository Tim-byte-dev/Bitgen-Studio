#!/usr/bin/env node
/* bitGen Studio — 2.753.1 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311).
 * Tim (verbatim): "add this link to the top of the runpod section in app (open externally) and on the website
 * https://runpod.io?ref=gbj9zxqh"
 *   Settings ▸ Remote generation: RunPod pod and RunPod Serverless each start with "Make a RunPod account ↗" - that link,
 *   target _blank (Electron hands it to the browser - electron/main.js setWindowOpenHandler -> shell.openExternal); a
 *   click opens a new window, not this one. No server / no Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.753.1 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const REF = "https://runpod.io?ref=gbj9zxqh";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.753.1 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    await ctx.route(/runpod\.io/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>RunPod</title>" }));   // never the real site
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteGpu && document.getElementById("rgMode"), null, { timeout: 30000 });
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="rgpu"]').click(); });
    await p.waitForTimeout(400);
    const look = async (mode) => { await p.check(`#stab-rgpu input[name="rgmode"][value="${mode}"]`); await p.waitForTimeout(250);
      return ev((m) => { const sec = document.querySelector(`#stab-rgpu .rgsec[data-rg="${m}"]`), a = sec.querySelector(".rgRef a"), first = sec.querySelector(".rgRef");
        const r = a.getBoundingClientRect();
        return { href: a.getAttribute("href"), target: a.target, rel: a.rel, text: a.textContent, line: first.textContent, top: first.previousElementSibling && first.previousElementSibling.matches("label.f"), shown: r.width > 0 && r.height > 0 }; }, mode); };
    const pod = await look("runpod"), sls = await look("serverless");
    for (const [n, x] of [["RunPod pod", pod], ["RunPod Serverless", sls]])
      check(`${n}: the referral link at the top (right under its heading), shown, opens outside the studio (target _blank, rel noopener)`, x.href === REF && x.target === "_blank" && /noopener/.test(x.rel)
        && x.text === "Make a RunPod account ↗" && /bitGen's referral link: signing up with it helps fund bitGen Studio/.test(x.line) && x.top && x.shown, x);
    const [pop] = await Promise.all([ctx.waitForEvent("page", { timeout: 8000 }), p.click('#stab-rgpu .rgsec[data-rg="serverless"] .rgRef a')]);
    await pop.waitForLoadState().catch(() => {});
    check("…a click opens it in a new window (in the app: the browser), the studio stays", /runpod\.io\/?\?ref=gbj9zxqh/.test(pop.url()) && /127\.0\.0\.1/.test(p.url()), { pop: pop.url(), app: p.url() });
    await p.check('#stab-rgpu input[name="rgmode"][value="local"]');
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
