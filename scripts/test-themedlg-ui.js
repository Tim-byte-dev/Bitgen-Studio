#!/usr/bin/env node
/* bitGen Studio — 2.455.0 in a REAL browser: EDIT THEME MODE LEAVES DIALOGS WORKING (static/themeedit.js). Tim:
 * "dialogs don't get edited in theme edit mode - when i try to select an icon and the dialogs open they are non
 * functional and editable- they should work properly". Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the theme edit dialogs browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  let stylesBefore = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit && document.getElementById("thEditBtn") && window.imageEditorInstance && window.imageEditorInstance.E, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    stylesBefore = await ev(() => JSON.stringify(window.H3ThemeEdit.styles ? window.H3ThemeEdit.styles() : {}));
    /* 1 the mode on; a button picked: the Style panel */
    await p.click("#thEditBtn"); await p.waitForTimeout(200);
    const go = await (await p.$("#go")).boundingBox();
    await p.mouse.click(go.x + go.width / 2, go.y + go.height / 2); await p.waitForTimeout(300);
    const t1 = await ev(() => ({ on: window.H3ThemeEdit.isOn(), panel: !!document.getElementById("thEditPanel"), title: (document.querySelector("#thEditPanel .th b") || {}).textContent || "" }));
    check("edit theme mode on, the Generate button clicked = picked (the Style panel)", t1.on && t1.panel, t1);

    /* 2 the panel's "a picture as the icon": the file dialog opens AND WORKS (its clicks reach it, it is not picked) */
    await p.click("#teIcImgB"); await p.waitForTimeout(800);
    const fd = await ev(() => !!document.querySelector("dialog.fdlg[open]"));
    await shot("2-filedialog");
    let t2 = { fd };
    if (fd) {
      const cb = await (await p.$("dialog.fdlg[open] .fd-cancel")).boundingBox();
      await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.waitForTimeout(150);
      const hi = await ev(() => { const h = document.getElementById("thEditHi"); return !!h && h.style.display !== "none" && h.getBoundingClientRect().width > 0 && (() => { const r = h.getBoundingClientRect(), d = document.querySelector("dialog.fdlg[open]").getBoundingClientRect(); return r.left >= d.left - 4 && r.right <= d.right + 4 && r.top >= d.top - 4 && r.bottom <= d.bottom + 4; })(); });
      await p.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.waitForTimeout(400);
      t2 = { fd, hi, closed: !(await ev(() => !!document.querySelector("dialog.fdlg[open]"))), title: await ev(() => (document.querySelector("#thEditPanel .th b") || {}).textContent || "") };
    }
    check("the Style panel's 🖼 icon picture: the file dialog opens, nothing in it is outlined, its Cancel WORKS (it closes); the picked element stays the Generate button",
      t2.fd && !t2.hi && t2.closed && t2.title === t1.title, t2);

    /* 3 an app dialog (the image editor's) works while the mode is on */
    await ev(() => window.imageEditorInstance.E.ui.dialog("Test dialog", '<input id="tdIn" type="number" value="3">', () => { window.__tdOk = +document.getElementById("tdIn").value; }));
    await p.waitForTimeout(200);
    const inp = await (await p.$("#tdIn")).boundingBox();
    await p.mouse.click(inp.x + 10, inp.y + inp.height / 2); await p.keyboard.press("Control+a"); await p.keyboard.type("7");
    const okb = await (await p.$(".kxdlg.pcd .ok")).boundingBox();
    await p.mouse.click(okb.x + okb.width / 2, okb.y + okb.height / 2); await p.waitForTimeout(300);
    const t3 = await ev(() => ({ ok: window.__tdOk, gone: !document.querySelector(".kxdlg.pcd"), title: (document.querySelector("#thEditPanel .th b") || {}).textContent || "", on: window.H3ThemeEdit.isOn() }));
    check("an editor dialog while the mode is on: typing into it and its OK work (7 taken); the mode stays on, nothing re-picked", t3.ok === 7 && t3.gone && t3.on && t3.title === t1.title, t3);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { await ev(() => { if (window.H3ThemeEdit.isOn()) window.H3ThemeEdit.toggle(false); }); } catch { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
