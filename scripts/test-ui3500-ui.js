#!/usr/bin/env node
/* bitGen Studio — 3.5.0 in a REAL browser: a pi-H3 style with its adapter missing asks, and you tick what to download.
 * Tim: "can u add https://hanshengchen.com/blog/pi-h3/ , when asking the user to download, let user choose which model to dl" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0); process.exit(0); }
  const real = await (await fetch(URL0 + "api/pih3")).json();
  check("GET /api/pih3 answers (not installed here)", real && real.installed === false && Array.isArray(real.items), real);
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    let sent = null, gens = 0;
    await p.route("**/api/pih3", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sent ? { installed: true, have: { dwd2: false, dwd4: true } } : { installed: false, have: { dwd2: true, dwd4: false } }) }));
    await p.route("**/api/addons/pih3/install", (r) => { sent = JSON.parse(r.request().postData() || "{}"); return r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
    await p.route(/\/api\/addons\/job/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ lines: ["[ok] pi-H3 installed"], next: 1, job: { id: "pih3", state: "done" } }) }));
    await p.route(/\/api\/generate$/, (r) => { gens++; return r.fulfill({ status: 400, contentType: "application/json", body: '{"error":"test stop"}' }); });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3PiH3 && window.H3NeedInstall && typeof videoStyles !== "undefined" && videoStyles.some((s) => s.name === "pi-H3 (4 steps)"), null, { timeout: 90000 });
    const ids = await ev(() => videoStyles.filter((s) => /^pi-H3/.test(s.name)).map((s) => s.name));
    check("both pi-H3 styles are in the video styles", ids.sort().join() === "pi-H3 (2 steps),pi-H3 (4 steps)", ids);
    await ev(() => { const s = document.getElementById("videoStyleSel"); s.value = videoStyles.find((x) => x.name === "pi-H3 (4 steps)").id; s.dispatchEvent(new Event("change")); });
    await sleep(300);
    check("the ⓘ pi-H3 hint shows beside the style", await ev(() => !document.getElementById("pih3Tip").hidden));
    const pr = ev(() => window.H3PiH3.ensure().then((v) => (window.__pi = v)));
    await p.waitForSelector("#niDlg #niPick input[type=checkbox]", { timeout: 20000 });
    const box = await ev(() => [...document.querySelectorAll("#niPick input")].map((c) => c.dataset.item + ":" + (c.checked ? 1 : 0) + (c.disabled ? "d" : "")));
    check("the box (2-step here, 4 picked): every item to tick - the 4-step adapter ticked, the 2-step not, the needed ones locked",
      box.includes("dwd4:1") && box.includes("dwd2:0") && box.includes("nodes:1d") && box.includes("base:1d") && box.includes("kjsol:0") && box.includes("dwd4_bf16:0"), box);
    await p.check('#niPick input[data-item="dwd4_bf16"]'); await p.uncheck('#niPick input[data-item="dwd4"]');
    await p.click("#niGo");
    await p.waitForFunction(() => window.__pi !== undefined, null, { timeout: 20000 }); await pr;
    check("⬇ Download sends what you ticked (the needed ones + the bf16 4-step, not the int8 one); then it goes on",
      sent && sent.items.join() === "nodes,dwd4_bf16,base,te,vae" && (await ev(() => window.__pi)) === true, sent);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
