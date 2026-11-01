#!/usr/bin/env node
/* bitGen Studio — 2.642.0 in a REAL browser: SETTINGS ▸ ABOUT - the version, "Produced and Developed by Tim Paul",
 * "Programmer - Claude Opus 5.5" and the credits to everyone whose work bitGen uses. Against the running app (H3_URL).
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.642.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    const api = await (await fetch(URL_ + "api/about")).json();
    check("GET /api/about: the name, the version, the two credit lines, the sections", api.name === "bitGen Studio" && /^\d+\.\d+\.\d+$/.test(api.version) && api.credits.length === 2 && api.sections.length === 9, api.credits);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3About && document.querySelector('#settings .stabs [data-stab="about"]'), null, { timeout: 60000 });
    await p.waitForTimeout(1500);                                         // the tabs added after load (Add-ons, Dockers ...)
    const last = await ev(() => { const t = [...document.querySelectorAll("#settings .stabs button")]; return { last: t[t.length - 1].dataset.stab, n: t.length, addons: !!document.querySelector('#settings .stabs [data-stab="addons"]') }; });
    check("Settings has an About tab - the last one (after Add-ons / Dockers)", last.last === "about" && last.n > 10, last);
    await ev(() => H3About.open());
    await p.waitForFunction(() => document.querySelector("#stab-about .abcred"), null, { timeout: 15000 });
    const s = await ev(() => { const box = document.getElementById("stab-about"); return { shown: box.classList.contains("active") && box.offsetParent !== null, open: document.getElementById("settings").open,
      head: box.querySelector(".abhead").textContent, cred: [...box.querySelectorAll(".abcred div")].map((x) => x.textContent), h4: [...box.querySelectorAll("h4")].map((x) => x.textContent),
      li: box.querySelectorAll("li").length, ext: [...box.querySelectorAll("a")].every((a) => a.target === "_blank" && /^https:/.test(a.href)), links: box.querySelectorAll("a").length,
      active: (document.querySelector("#settings .stabs button.active") || {}).dataset.stab }; });
    check("H3About.open(): Settings open on the About tab", s.open && s.shown && s.active === "about", s);
    check("…bitGen Studio and its version", s.head.includes("bitGen Studio") && s.head.includes("Version " + api.version), s.head);
    check("…\"Produced and Developed by Tim Paul\" and \"Programmer - Claude Opus 5.5\"", JSON.stringify(s.cred) === JSON.stringify(["Produced and Developed by Tim Paul", "Programmer - Claude Opus 5.5"]), s.cred);
    check("…the credits to everyone whose work is used: 9 groups, every project, links open in the browser", s.h4.length === 9 && s.h4.includes("Ideas and inspiration") && s.li > 60 && s.links > 30 && s.ext, s);
    await ev(() => document.querySelector('#settings .stabs [data-stab="general"]').click());
    check("another tab hides About", await ev(() => !document.getElementById("stab-about").classList.contains("active")));
    await ev(() => document.querySelector('#settings .stabs [data-stab="about"]').click());
    check("…the About tab again (a click on it)", await ev(() => document.getElementById("stab-about").classList.contains("active") && document.querySelectorAll("#stab-about li").length > 60));
    await ev(() => { const d = document.getElementById("settings"); if (d.open) d.close(); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
