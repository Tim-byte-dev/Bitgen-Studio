#!/usr/bin/env node
/* bitGen Studio — 2.748.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311) started from
 * THIS folder: THE API KEYS IN settings/, ENCRYPTED.
 * Tim (verbatim): "save the users api keys in a file in a folder called settings, maybe encrypt the keys and decrptt them
 * when using the app. so user doesn't need to add them with new updates"
 *   - a RunPod key typed in Settings ▸ Remote GPU and saved: custom.settings does not hold it; settings/keys.json holds it
 *     encrypted (not as text); the tab shows it again after a reload (decrypted for the app);
 *   - Settings ▸ General lists the keys file and the names of the keys saved (never a value);
 *   - Settings ▸ Save (the whole page's settings sent back) keeps it out of custom.settings too.
 * The key is removed afterwards. No server / no Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.748.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch { return ""; } };
const KEY = "rpa_UI748_" + "x".repeat(20);

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.748.0 browser test did not run"); process.exit(0); }
  const info = await api("/api/settings/info");
  if (path.resolve(path.dirname(info.custom)) !== path.resolve(ROOT)) { console.log("SKIP: the studio at " + URL0 + " runs from another folder - the 2.748.0 browser test did not run"); process.exit(0); }
  const v0 = await api("/api/remotegpu");
  await fetch(URL0 + "api/remotegen/enabled", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: true }) }).catch(() => {});   // 2.754.0: the tab shows its parts only with Use remote generation ticked
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const open = async (tab) => { await ev((t) => { if (!document.getElementById("settings").open) document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="' + t + '"]').click(); }, tab); await sleep(600); };
    await p.goto(URL0);
    await p.waitForFunction(() => typeof cfg !== "undefined" && cfg && document.getElementById("openSettings"), null, { timeout: 30000 });   // eslint-disable-line no-undef
    await sleep(600);
    await open("rgpu");
    await p.check('#stab-rgpu input[name="rgmode"][value="serverless"]'); await sleep(200);   // its part shows (nothing is used yet)
    await p.fill("#rgSlsKey", KEY);
    await p.press("#rgSlsKey", "Tab");                                    // each box saves itself when it changes (static/remotegpu.js)
    await sleep(1200);
    const cs = read("custom.settings"), kj = read("settings/keys.json");
    check("a RunPod key saved in Settings ▸ Remote GPU: not in custom.settings; in settings/keys.json, encrypted (not as text)", !cs.includes(KEY) && /"rgpu\.runpod\.key": "v1:/.test(kj) && !kj.includes(KEY), { inCustom: cs.includes(KEY), kj: kj.slice(0, 300) });
    check("…the app reads it decrypted (Remote GPU says a key is set)", (await api("/api/remotegpu")).runpod.key_set === true);
    await p.reload(); await p.waitForFunction(() => typeof cfg !== "undefined" && cfg, null, { timeout: 30000 }); await sleep(600);   // eslint-disable-line no-undef
    await open("rgpu");
    check("…after a reload the tab shows the key again", await ev(() => document.getElementById("rgKey").value) === KEY && await ev(() => document.getElementById("rgSlsKey").value) === KEY);
    await open("general");
    await p.waitForFunction(() => /keys: /.test(document.getElementById("s_setinfo").textContent), null, { timeout: 8000 }).catch(() => {});
    const si = await ev(() => document.getElementById("s_setinfo").textContent);
    check("Settings ▸ General: the keys file and the names of the keys saved - never a value", /keys: +.*settings[\\/]keys\.json \(encrypted: [^)]*rgpu\.runpod\.key[^)]*\)/.test(si) && !si.includes(KEY), si);
    await ev(() => document.getElementById("s_save").click()); await sleep(1500);
    check("Settings ▸ Save (every setting sent back): the key still not in custom.settings, still saved", !read("custom.settings").includes(KEY) && (await api("/api/remotegpu")).runpod.key_set === true);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    await fetch(URL0 + "api/remotegen/enabled", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: null }) }).catch(() => {});   // 2.754.0: back to never chosen
    await api("/api/remotegpu/save", { runpod: { key: (v0.runpod || {}).key || "" } }).catch(() => {});
  }
  check("put back: the test key is gone from settings/", !read("settings/keys.json").includes("UI748") && !(await api("/api/remotegpu")).runpod.key_set === !(v0.runpod || {}).key);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
