#!/usr/bin/env node
/* bitGen Studio — 2.636.0 in a REAL browser: Ctrl+Alt+S OPENS SETTINGS (EVEN WHILE TYPING, EVEN WITH ⚙ GONE); THE
 * bitGen Default THEME - Ctrl+Alt+Shift+T, Settings ▸ Themes, ?theme=default.
 * Tim: "can you add ctrl+alt+s to open settings dialog, my settings button vanished. create a default theme that i can
 * revert to in case a theme malfunctions"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.636.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const ready = () => p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SafeTheme && window.H3ThemeEdit, null, { timeout: 60000 });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" }); await ready();
    // a theme that "breaks" the ⚙: invisible + another accent / size / theme
    await ev(() => { H3ThemeEdit.setStyles({ "#openSettings": { color: "#1d1a15", bg: "#1d1a15", border: "#1d1a15" } }); H3Theme.choose("slate", "#ff00ff", { panel: "#000000" }, "Broken"); if (window.applyUiScale) applyUiScale(140); });
    await p.waitForTimeout(200);
    const before = await ev(() => ({ c: getComputedStyle(document.getElementById("openSettings")).color, theme: document.documentElement.dataset.theme }));
    // typing in a box, then Ctrl+Alt+S
    await ev(() => { const t = document.querySelector("textarea"); if (t) t.focus(); });
    await p.keyboard.press("Control+Alt+s"); await p.waitForTimeout(400);
    const open1 = await ev(() => document.getElementById("settings").open);
    check("a theme hid the ⚙ - Ctrl+Alt+S (while typing in a box) opens Settings", before.theme === "slate" && open1, { before, open1 });
    await ev(() => document.getElementById("settings").close());
    await p.keyboard.press("Control+Alt+Shift+T"); await p.waitForTimeout(300);
    const after = await ev(() => ({ theme: document.documentElement.dataset.theme, tiger: getComputedStyle(document.documentElement).getPropertyValue("--tiger").trim(), styles: Object.keys(H3ThemeEdit.styles()).length, name: localStorage.getItem("h3.themeName"), fs: document.documentElement.style.fontSize, back: !!localStorage.getItem("h3.themeBackup") }));
    check("Ctrl+Alt+Shift+T: bitGen Default - Dark, its own accent, no element styles, UI size 100 %, the theme before kept", after.theme === "dark" && after.tiger === "#f59e2c" && after.styles === 0 && after.name === "bitGen Default" && after.fs === "14px" && after.back, after);
    // Settings ▸ Themes
    await p.keyboard.press("Control+Alt+s"); await p.waitForTimeout(300);
    await ev(() => { const t = document.querySelector('#settings [data-stab="themes"]'); if (t) t.click(); });
    await p.waitForFunction(() => document.querySelector("#s_thsaved [data-th-builtin]"), null, { timeout: 8000 }).catch(() => {});
    const tab = await ev(() => { const first = document.querySelector("#s_thsaved .thsaved"); return { first: first ? first.textContent : "", x: first ? !!first.querySelector(".thx") : null, def: !!document.getElementById("s_thdefault"), before: getComputedStyle(document.getElementById("s_thbefore")).display }; });
    check("Settings ▸ Themes: ⟲ bitGen Default, ↶ The theme before (there is one), the built-in bitGen Default card first, no ✕", tab.def && tab.before !== "none" && /bitGen Default/.test(tab.first) && tab.x === false, tab);
    await ev(() => document.getElementById("s_thbefore").click()); await p.waitForTimeout(300);
    const back = await ev(() => ({ theme: document.documentElement.dataset.theme, name: localStorage.getItem("h3.themeName"), styles: Object.keys(H3ThemeEdit.styles()).length }));
    check("↶ The theme before: Slate + its styles back", back.theme === "slate" && back.name === "Broken" && back.styles === 1, back);
    await ev(() => document.getElementById("settings").close());
    // ?theme=default in the address
    await p.goto(URL_ + "?theme=default", { waitUntil: "domcontentloaded" }); await ready(); await p.waitForTimeout(500);
    const url = await ev(() => ({ theme: document.documentElement.dataset.theme, styles: Object.keys(H3ThemeEdit.styles()).length, name: localStorage.getItem("h3.themeName") }));
    check("?theme=default in the address: bitGen Default before the page is used", url.theme === "dark" && url.styles === 0 && url.name === "bitGen Default", url);
    const gearTitle = await ev(() => document.getElementById("openSettings").title);
    check("the ⚙'s tooltip names Ctrl+Alt+S", /Ctrl\+Alt\+S/.test(gearTitle), gearTitle);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { if (window.H3SafeTheme) H3SafeTheme.reset({ quiet: true }); localStorage.removeItem("h3.themeBackup"); localStorage.removeItem("h3.themeName"); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
