#!/usr/bin/env node
/* bitGen Studio — 2.502.0 in a REAL browser: EDIT IMAGE MODE's image style dropdown (ext/imageeditdock/ieeditonly.js).
 * Tim: "in edit image mode, show only models that can edit the images in the image dropdown" (+ "add flux 3 klein model").
 *   1. the editor closed: every image style is offered (SDXL, FLUX 3 Klein, ...)
 *   2. opened: only the styles /api/aiedit/engines says can edit (FLUX 3 Klein edit, FLUX 3 Klein - it swaps to its edit
 *      graph -, Qwen edit, Kontext ...); a picked SDXL is swapped for an edit style
 *   3. a style reload while it is open keeps the filter
 *   4. closed: all of them again, SDXL picked back; reopened: the edit style picked last time comes back
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the edit image mode browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "closed", hidden: false, maximized: false } } }) }); } catch { /* old server */ }
    const eng = await (await fetch(URL_ + "api/aiedit/engines")).json();
    const editIds = (eng.edit || []).map((s) => s.id);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { ["h3.ie.modeWas", "h3.ie.styleWas", "h3.ie.editStyle"].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* fine */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.IeEditOnly && document.getElementById("styleSel") && document.getElementById("styleSel").options.length > 3, null, { timeout: 60000 });
    await p.waitForTimeout(2600);
    const ieShow = (on) => ev((on) => { const d = document.getElementById("imageeditdock");
      if (on) { if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); }
      else if (!d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); }, on);
    const look = () => ev(() => { const s = document.getElementById("styleSel");
      return { value: s.value, name: s.selectedOptions[0] ? s.selectedOptions[0].textContent : "", shown: [...s.options].filter((o) => !o.hidden && !o.disabled).map((o) => o.value),
               names: [...s.options].filter((o) => !o.hidden).map((o) => o.textContent.replace(/ ⚠.*$/, "")), all: s.options.length, cls: s.classList.contains("ie-editonly") }; });
    await ieShow(false); await p.waitForTimeout(300);
    const sdxl = await ev(() => { const o = [...document.getElementById("styleSel").options].find((x) => /^SDXL/.test(x.textContent)); return o ? o.value : ""; });
    await ev((v) => { const s = document.getElementById("styleSel"); s.value = v; s.onchange(); }, sdxl);
    const L0 = await look();
    check("closed: every image style is offered (SDXL and FLUX 3 Klein among them); SDXL picked",
      L0.shown.length === L0.all && L0.names.includes("SDXL") && L0.names.includes("FLUX 3 Klein") && L0.names.includes("FLUX 3 Klein edit") && L0.value === sdxl && !L0.cls, L0);
    check("the server: FLUX 3 Klein and FLUX 3 Klein edit can edit, SDXL cannot",
      (eng.edit || []).some((s) => s.name === "FLUX 3 Klein") && (eng.edit || []).some((s) => s.name === "FLUX 3 Klein edit") && !editIds.includes(sdxl), eng.edit);
    await ieShow(true); await p.waitForTimeout(700);
    const L1 = await look();
    check("edit image mode: only the styles that can edit are offered; SDXL hidden; an edit style picked in its place",
      L1.cls && L1.shown.length === editIds.length && L1.shown.every((v) => editIds.includes(v)) && !L1.shown.includes(sdxl) && editIds.includes(L1.value) && L1.names.includes("FLUX 3 Klein edit"), L1);
    const f3e = await ev(() => { const o = [...document.getElementById("styleSel").options].find((x) => x.textContent.startsWith("FLUX 3 Klein edit")); return o ? o.value : ""; });
    await ev((v) => { const s = document.getElementById("styleSel"); s.value = v; s.dispatchEvent(new Event("change")); if (s.onchange) s.onchange(); }, f3e);
    await ev(() => refreshStyles()); await p.waitForTimeout(900);
    const L2 = await look();
    check("a style reload while it is open keeps the filter and the pick", L2.cls && L2.shown.every((v) => editIds.includes(v)) && L2.value === f3e, L2);
    await ieShow(false); await p.waitForTimeout(700);
    const L3 = await look();
    check("closed: every style again, the SDXL that was picked before is back", !L3.cls && L3.shown.length === L3.all && L3.value === sdxl, L3);
    await ieShow(true); await p.waitForTimeout(700);
    const L4 = await look();
    check("reopened: the edit style picked last time (FLUX 3 Klein edit) comes back", L4.cls && L4.value === f3e, L4);
    await ieShow(false); await p.waitForTimeout(300);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the browser run finished\n      got " + JSON.stringify(String(e && e.stack || e)).slice(0, 900));
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
