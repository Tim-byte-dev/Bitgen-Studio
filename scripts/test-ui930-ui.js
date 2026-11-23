#!/usr/bin/env node
/* bitGen Studio — 2.930.0 in a REAL browser: 🪪 Character Sheet in the image editor's icon bar.
 * Tim: "add an icon only button for character sheet in image-editor top icon only menubar".
 * 🪪 sits right after ✨ Create, icon only ("Character Sheet" in its tip); pressed, the Character Creator's sheet dialog
 * opens (the StoryBoard's 🖼 NEW - 🧍 Mannequin…, ✨ Lifelike, ▶ Generate sheet); File ▸ 🪪 Character Sheet… too.
 * Against the running app (H3_URL). No Playwright = SKIP. */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.quickBar && document.getElementById("chNewPic"), null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    const btn = await ev(() => { const q = document.querySelector('#pcQuickBar [data-qcmd="file.charsheet"]'); return q ? { text: q.textContent, label: q.getAttribute("aria-label"), off: q.disabled, last: q === [...document.querySelectorAll("#pcQuickBar [data-qcmd]")].pop(), afterCreate: q.previousElementSibling && q.previousElementSibling.dataset.qcmd === "file.createai" } : null; });
    check("🪪 in the image editor's icon bar, icon only, right after ✨ Create (\"Character Sheet\" in its tip), not greyed", btn && btn.text === "🪪" && btn.label === "Character Sheet" && !btn.off && btn.last && btn.afterCreate, btn);
    await ev(() => document.querySelector('#pcQuickBar [data-qcmd="file.charsheet"]').click());
    await p.waitForFunction(() => document.getElementById("chMaskDlg") && document.getElementById("chMaskDlg").open, null, { timeout: 10000 }).catch(() => {});
    check("…pressed: the character sheet dialog opens (empty, on its Sheet tab - 🧍 Mannequin…, ✨ Lifelike, ▶ Generate sheet)", await ev(() => !!(document.getElementById("chMaskDlg").open && document.getElementById("h3sMannequin"))));
    await ev(() => document.getElementById("chMaskDlg").close());
    const menu = await ev(() => window.imageEditorInstance.E.ui.CMD.get("file.charsheet"));
    check("File ▸ 🪪 Character Sheet… is a menu command too", !!menu);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
