#!/usr/bin/env node
/* bitGen Studio — 2.709.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): Settings ▸
 * Themes ▸ ⤒ Import keeps the theme in use as themes/<name>_old.json, uses the imported theme and saves it at once;
 * ↶ Revert brings the old one back (its own name, colours and element styles) and goes away again. No server / no
 * Playwright = SKIP.  Tim (verbatim): "can u add an import button to themes,save the current theme as
 * themename_old.json and save the imported theme automatically when imported add a revert button as well to revert to
 * the old theme if pressed" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.709.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const T = (n) => "zz709 " + n;           // unique theme names (removed at the end)
const names = async () => ((await (await fetch(URL0 + "api/themes")).json()).themes || []).map((t) => t.name);
const del = (n) => fetch(URL0 + "api/themes/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) });
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.709.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  const made = [T("Mine"), T("Mine") + "_old", T("Ocean"), T("Ocean") + "_old", "bitGen Default (imported)", T("Ocean") + " (imported)"];
  try {
    const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3Theme && document.getElementById("openSettings"), null, { timeout: 30000 });
    await p.evaluate(() => document.getElementById("openSettings").click()); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('[data-stab="themes"]').click()); await p.waitForTimeout(400);
    // the theme in use: Slate with a red accent, saved as "zz709 Mine"
    await p.evaluate(async (n) => { H3Theme.choose("slate", "#ff2020"); await H3Theme.saveAs(n); }, T("Mine"));
    const before = await p.evaluate(() => ({ c: H3Theme.current(), rv: document.getElementById("s_threvert").hidden, imp: !!document.getElementById("s_thimport").getClientRects().length }));
    check("Settings ▸ Themes has ⤒ Import; ↶ Revert is hidden until there is something to revert to", before.imp && before.rv === true && before.c.name === T("Mine"), before);
    // import "zz709 Ocean" (Light base, its own accent) through the file input
    const ocean = { name: T("Ocean"), base: "light", accent: "#1188cc", scale: 100, vars: { ink: "#eef6fb", panel: "#ffffff", "panel-2": "#dcebf5", line: "#a9c6d9", text: "#0d2433", dim: "#4d6b80", tiger: "#1188cc", "tiger-deep": "#0b6aa0", ok: "#2e8b57", bad: "#c0392b" }, styles: {} };
    await p.setInputFiles("#s_thfile", { name: "Ocean.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(ocean)) });
    await p.waitForFunction(() => /imported and saved/.test(document.getElementById("s_thmsg").textContent), null, { timeout: 10000 });
    const after = await p.evaluate(() => ({ c: H3Theme.current(), msg: document.getElementById("s_thmsg").textContent, rv: document.getElementById("s_threvert").hidden, ink: getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() }));
    const n1 = await names();
    check("⤒ Import: the theme in use kept as themes/<name>_old.json, the imported one in use and saved as themes/<its name>.json - both listed",
      n1.includes(T("Mine") + "_old") && n1.includes(T("Ocean")) && after.c.name === T("Ocean") && after.c.theme === "light" && after.c.accent === "#1188cc" && after.ink === "#eef6fb", { n1: n1.filter((x) => /zz709/.test(x)), after });
    check("…the message says both files, and ↶ Revert shows", /themes\/zz709 Ocean\.json/.test(after.msg) && /zz709 Mine_old\.json/.test(after.msg) && after.rv === false, after);
    const oldRec = await (await fetch(URL0 + "api/themes/" + encodeURIComponent(T("Mine") + "_old"))).json();
    check("…the _old file holds the theme that was in use (Slate, the red accent)", oldRec.base === "slate" && oldRec.accent === "#ff2020", oldRec);
    // revert
    await p.evaluate(() => document.getElementById("s_threvert").click());
    await p.waitForFunction(() => /back to/.test(document.getElementById("s_thmsg").textContent), null, { timeout: 10000 });
    const rev = await p.evaluate(() => ({ c: H3Theme.current(), rv: document.getElementById("s_threvert").hidden, ink: getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() }));
    check("↶ Revert: the old theme back in use under its own name (Slate, the red accent), the button hidden again; the imported theme stays saved",
      rev.c.name === T("Mine") && rev.c.theme === "slate" && rev.c.accent === "#ff2020" && rev.rv === true && (await names()).includes(T("Ocean")), rev);
    // the same import again (a name that is there already) is replaced, not doubled; a theme named like the built-in one gets "(imported)"
    await p.setInputFiles("#s_thfile", { name: "x.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(Object.assign({}, ocean, { name: "bitGen Default" }))) });
    await p.waitForFunction(() => /imported and saved/.test(document.getElementById("s_thmsg").textContent), null, { timeout: 10000 });
    const bi = await p.evaluate(() => H3Theme.current().name);
    check("a theme named like the built-in \"bitGen Default\" is saved as \"bitGen Default (imported)\"", bi === "bitGen Default (imported)" && (await names()).includes("bitGen Default (imported)"), bi);
    await p.setInputFiles("#s_thfile", { name: "Bad.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
    await p.waitForFunction(() => /could not import/.test(document.getElementById("s_thmsg").textContent), null, { timeout: 10000 });
    check("a file that is not a theme is refused (nothing saved, nothing changed)", (await p.evaluate(() => H3Theme.current().name)) === "bitGen Default (imported)");
    check("no page errors", errs.length === 0, errs);
    await p.evaluate(() => { try { localStorage.removeItem("h3.themeRevert"); } catch (e) {} H3Theme.choose("dark", "", {}, ""); });
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  for (const n of made.concat(["bitGen Default (imported)_old", T("Mine") + "_old_old"])) await del(n).catch(() => {});
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
