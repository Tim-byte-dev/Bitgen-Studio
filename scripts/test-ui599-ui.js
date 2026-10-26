#!/usr/bin/env node
/* bitGen Studio — 2.599.0 in a REAL browser, against the running app (H3_URL): THE "Resetting Project..." LOCK SCREEN.
 *   ↺ Reset project (confirmed) on a throwaway project: at once a cover over the whole window - a spinning ring,
 *   "Resetting Project" with its dots running, what is happening now, the seconds - nothing behind it can be clicked
 *   or typed into; it stays through the server's reset (made slow here) AND the page reload, and goes only when the
 *   empty project is open ("✓ Project reset"), then the app is usable again. A refused reset takes the cover down.
 * Tim: "when resetting a project put a lock screen at the front and say "Resetting Project..." but animate it until the
 * project resets". The original project is opened again after. No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.599.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();
const P = "zz-reset599";

(async () => {
  const before = (await (await fetch(URL_ + "api/projects")).json()).current;
  try { await post("api/projects/new", { name: P, description: "lock screen test" }); } catch { /* there */ }
  await post("api/projects/load", { name: P });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const lock = () => ev(() => { const l = document.getElementById("h3lock"); if (!l) return null; const r = l.getBoundingClientRect();
    return { t: l.querySelector(".t").textContent, s: l.querySelector(".s").textContent, c: l.querySelector(".c").textContent, done: l.classList.contains("done"),
      cover: r.width >= innerWidth - 1 && r.height >= innerHeight - 1, z: getComputedStyle(l).zIndex, spin: getComputedStyle(l.querySelector(".ring")).animationName, busy: l.getAttribute("aria-busy") }; });
  try {
    let slow = 2500, refuse = false;
    await p.route(/\/api\/projects\/reset$/, async (r) => { await new Promise((x) => setTimeout(x, slow)); if (refuse) return r.fulfill({ status: 400, json: { error: "refused for the test" } }); return r.continue(); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.H3Lock && window.resetProject && document.getElementById("projReset"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    // a refused reset: the cover comes and goes
    refuse = true; slow = 600;
    await ev(() => { window.appConfirm = () => Promise.resolve(true); window.appNote = (m) => { window.__note = m; }; window.resetProject(); });
    await p.waitForTimeout(250);
    const r0 = await lock();
    await p.waitForFunction(() => !document.getElementById("h3lock") && window.__note, null, { timeout: 10000 });
    check("a refused reset: the cover shows, then goes, and says why", r0 && /Resetting Project/.test(r0.t) && /refused for the test/.test(await ev(() => window.__note)), r0);
    // the real one
    refuse = false; slow = 2500;
    await ev(() => { window.__clicked = 0; document.addEventListener("click", () => { window.__clicked++; }, true); window.resetProject(); });
    await p.waitForTimeout(300);
    const l1 = await lock();
    check("↺ Reset (confirmed): at once a cover over the WHOLE window, on top of everything - a spinning ring, \"Resetting Project\", what is happening now",
      l1 && l1.cover && Number(l1.z) > 1e9 && /^Resetting Project\.{1,3}$/.test(l1.t) && /Deleting "zz-reset599" and creating it again, empty/.test(l1.s) && l1.spin === "h3lockspin" && l1.busy === "true", l1);
    const seen = new Set();
    for (let i = 0; i < 6; i++) { const x = await lock(); if (x) seen.add(x.t); await p.waitForTimeout(250); }
    check("…animated: the dots run (Resetting Project. / .. / ...) while it works", seen.size >= 2, [...seen]);
    const blocked = await ev(() => { const btn = document.getElementById("projReset"); const r = btn.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return top && top.closest("#h3lock") ? true : top && top.id; });
    await p.keyboard.press("KeyS");
    check("…nothing behind it can be reached: the cover is what a click lands on; keys stop at it", blocked === true, blocked);
    // the reload: the cover is there again at once and stays until the project is back
    await p.waitForEvent("load", { timeout: 20000 });
    const l2 = await lock();
    check("after the reload the cover is back at once (\"Opening … every docker empty\") while the page loads the project", l2 && /Resetting Project/.test(l2.t) && /Opening "zz-reset599"/.test(l2.s), l2);
    await p.waitForFunction(() => { const l = document.getElementById("h3lock"); return l && l.classList.contains("done"); }, null, { timeout: 60000 });
    const l3 = await lock();
    check("…the project is back: ✓ Project reset (the project ready first)", l3 && l3.t === "Project reset" && l3.busy === "false" && (await ev(() => window.H3_PROJECT_READY === true)), l3);
    await p.waitForFunction(() => !document.getElementById("h3lock"), null, { timeout: 5000 });
    const free = await ev(() => { const btn = document.getElementById("projReset"); const r = btn.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!top && !top.closest("#h3lock"); });
    const logged = await ev(() => (document.getElementById("console") || document.body).textContent.includes('"zz-reset599" reset'));
    check("then it fades out and the app is usable; the console says the project was reset", free && logged && (await ev(() => sessionStorage.getItem("h3.lock"))) === null, { free, logged });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    try { await post("api/projects/load", { name: before || "default" }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
