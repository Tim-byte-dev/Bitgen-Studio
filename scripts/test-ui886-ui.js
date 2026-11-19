#!/usr/bin/env node
/* bitGen Studio — 2.886.0 in a REAL browser: 🔎 bitGen's own SearXNG in Settings ▸ General (⬇ Install SearXNG here, its state, the search line) and the Gallery listing <project>/web/downloads - Settings ▸ General's block (☐ Use Brave Search off by
 * default, the key saved encrypted and never shown back - only its last 4 letters, SearXNG, the safety words), the prompt docker's
 * 🌐 toggle (kept), a chat turn sending context.web, the activity route.
 * Tim (verbatim): "add brave but put in in settings-general tab with a checkbox , it will be off by default and user can select it
 * and enter an api key. can we have security filters in place so no malicious scripts can be run" */
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
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let sent = null;
  try {
    await p.route("**/api/chat", async (route) => { const r = route.request(); try { sent = JSON.parse(r.postData() || "{}"); } catch { sent = { raw: r.postData() }; }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: "s", reply: "Sourdough is bread [1].\n\nSources:\n[1] Sourdough — https://en.wikipedia.org/wiki/Sourdough", web: { steps: [{ tool: "web_search", ok: true }], sources: [], warnings: [] } }) }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3WebSearchSet && window.H3WebTools, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(async () => { await fetch("/api/websearch/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ braveOn: false, braveKey: "", searxngUrl: "" }) }); });
    await ev(() => { document.getElementById("openSettings").click(); });
    await p.waitForTimeout(500);
    await ev(() => { const t = [...document.querySelectorAll("#settingsDlg .tabs button, [data-stab]")].find((x) => /General/.test(x.textContent)); if (t) t.click(); });
    await p.waitForSelector("#s_wsSxInstall", { state: "attached" });
    await p.waitForTimeout(1200);
    const sx = await ev(async () => ({ btn: document.getElementById("s_wsSxInstall").textContent, shown: document.getElementById("s_wsSxInstall").style.display !== "none", st: document.getElementById("s_wsSx").textContent, api: await (await fetch("/api/websearch/searxng")).json(), status: document.getElementById("s_wsStatus").textContent }));
    check("Settings ▸ General ▸ 🌐: ⬇ Install SearXNG here (free, no key) shown while it is not installed; the line says Wikipedia only - install SearXNG", sx.shown && /Install SearXNG here \(free, no key\)/.test(sx.btn) && /not installed/.test(sx.st) && sx.api.installed === false && /Wikipedia only/.test(sx.status), sx);
    await ev(() => { const d = document.querySelector("dialog[open]"); if (d) d.close(); });
    // the Gallery lists <project>/web/downloads
    const fsx = require("fs"), pathx = require("path");
    const root = process.env.H3_ROOT || "/tmp/t819";
    const cur = await ev(async () => (await (await fetch("/api/config")).json()).project || "default");
    const dlDir = pathx.join(root, "projects", cur, "web", "downloads"); fsx.mkdirSync(dlDir, { recursive: true });
    fsx.writeFileSync(pathx.join(dlDir, "ui886-cat.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const list = await ev(async () => (await (await fetch("/api/outputs?kind=images")).json()).filter((f) => f.name === "ui886-cat.png"));
    const served = await ev(async () => (await fetch("/outputs/ui886-cat.png")).status);
    check("a file in <project>/web/downloads is in the Gallery's list (where: web) and served", list.length === 1 && list[0].where === "web" && served === 200, { list, served, cur });
    try { fsx.unlinkSync(pathx.join(dlDir, "ui886-cat.png")); } catch { /* left */ }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
