#!/usr/bin/env node
/* bitGen Studio — 2.530.0 in a REAL browser: ⌕ THE COMMAND PALETTE - Ctrl+K and the 🔍 menu-bar button open it; it holds
 * the dockers, the floating windows, the menu / statusbar buttons, every Settings field, the workspaces, the Generate
 * modes, the styles, the guide's sections and the shortcut keys; 'lora' finds the trainer and Enter opens it; a hidden
 * docker found by name comes back on screen; a Settings field opens the dialog on its tab; a guide section opens the 📖
 * Help window; a shortcut opens its group's key table; ↑ ↓ / Esc; what was run comes first next time; a Ctrl+K a docker
 * already used (defaultPrevented) is left to it.
 * Against the running app (H3_URL, default :8311). It puts back what it changed (the timeline shown, windows closed). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.530 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const type = async (q) => { await p.fill("#palIn", q); await p.waitForTimeout(150); return ev(() => H3Palette.state().list.map((e) => e.group + ": " + e.label)); };
  let tlWasGone = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Palette && document.getElementById("palBtn"), null, { timeout: 60000 });
    await p.waitForFunction(() => H3Palette.state().help, null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(500);
    await ev(() => { try { localStorage.removeItem("h3pal.recent"); } catch (e) { /* fine */ } H3Palette.state().recent = []; });
    await p.mouse.click(900, 600); await p.keyboard.press("Control+k"); await p.waitForTimeout(400);
    await p.fill("#palIn", ""); await p.waitForTimeout(1700); await p.fill("#palIn", " "); await p.waitForTimeout(150);   // the index refreshes while it is open
    const st = await ev(() => ({ open: H3Palette.state().open, focus: document.activeElement && document.activeElement.id, groups: [...new Set(H3Palette.state().all.map((e) => e.group))], n: H3Palette.state().all.length,
      styles: [].concat([...((document.getElementById("styleSel") || {}).options || [])], [...((document.getElementById("videoStyleSel") || {}).options || [])]).filter((o) => o.value).length }));
    check("Ctrl+K opens the palette, the cursor in its box", st.open && st.focus === "palIn", st);
    check("…over everything: dockers, windows, the menu bar, Settings, workspaces, Generate modes, the styles (when there are some), the guide, the keys", ["Docker", "Window", "Menu", "Settings", "Workspace", "Generate", "Help", "Keys"].concat(st.styles ? ["Style"] : []).every((g) => st.groups.includes(g)) && st.n > 300, st);
    let l = await type("lora");
    check("'lora' -> the LoRA trainer and the LoRA settings", l.slice(0, 4).some((x) => /Window: .*LoRA/.test(x)) && l.slice(0, 4).some((x) => /^Settings: LoRA/.test(x)), l.slice(0, 6));
    l = await type("house");
    check("'house' -> the 🏠 House builder first", /House builder/.test(l[0]), l.slice(0, 3));
    l = await type("depth map");
    check("'depth map' -> the House builder (shots + depth maps) and the guide's sections on it", l.some((x) => /House builder/.test(x)) && l.some((x) => /^Help: /.test(x)), l.slice(0, 6));
    await type("house"); await p.keyboard.press("Enter"); await p.waitForTimeout(800);
    check("Enter runs it: the House builder opens, the palette closes", await ev(() => SecFloat.state("house").shown && !H3Palette.state().open));
    await ev(() => SecFloat.show("house", false));

    // a hidden docker by name
    tlWasGone = await ev(() => document.getElementById("timelinedock").classList.contains("dockgone"));
    if (!tlWasGone) await ev(() => toggleDockGone("timelinedock", "tT"));
    await p.click("#palBtn"); await p.waitForTimeout(300);
    check("🔍 in the menu bar opens it too", await ev(() => H3Palette.state().open));
    await type("timeline");
    const firstTl = await ev(() => H3Palette.state().list[0].id);
    await p.keyboard.press("Enter"); await p.waitForTimeout(600);
    check("'timeline' + Enter: the hidden Timeline docker is back on screen", firstTl === "dock:timelinedock" && !(await ev(() => document.getElementById("timelinedock").classList.contains("dockgone"))), firstTl);

    // a Settings field
    await p.keyboard.press("Control+k"); await p.waitForTimeout(250);
    l = await type("lora folder");
    await p.keyboard.press("Enter"); await p.waitForTimeout(900);
    const set = await ev(() => ({ open: document.getElementById("settings").open, tab: (document.querySelector("#settings .stabs .active") || {}).dataset && document.querySelector("#settings .stabs .active").dataset.stab, lit: !!document.querySelector("#settings .palflash") }));
    check("a Settings field: the dialog opens on its tab, the field lit", set.open && set.tab === "paths" && set.lit, { set, l: l.slice(0, 3) });
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    if (await ev(() => document.getElementById("settings").open)) await ev(() => document.getElementById("settings").close());

    // the guide
    await p.keyboard.press("Control+k"); await p.waitForTimeout(250);
    await type("controlnet face fix");
    await p.keyboard.press("Enter"); await p.waitForTimeout(800);
    const hlp = await ev(() => ({ shown: SecFloat.state("help").shown, h: (document.querySelector("#hlpBody .hlpc h3") || {}).textContent, li: document.querySelectorAll("#hlpBody .hlpc li").length, opts: document.querySelectorAll("#hlpBody select option").length }));
    check("a guide section opens the 📖 Help window (its text, lists - and every other section to pick)", hlp.shown && /ControlNet and face fix/.test(hlp.h) && hlp.li > 2 && hlp.opts > 150, hlp);
    await p.keyboard.press("Control+k"); await p.waitForTimeout(250);
    await type("ctrl+alt+shift+b");
    await p.keyboard.press("Enter"); await p.waitForTimeout(500);
    check("a shortcut opens its group's key table", /Anywhere in the app/.test(await ev(() => document.querySelector("#hlpBody .hlpc h3").textContent)) && await ev(() => /Ctrl\+Alt\+Shift\+B/.test(document.querySelector("#hlpBody .hlpc table").textContent)));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, "ui530-help.png") });
    await ev(() => SecFloat.show("help", false));

    // keys inside the box, recent first
    await p.keyboard.press("Control+k"); await p.waitForTimeout(250);
    await type("");
    const rec = await ev(() => H3Palette.state().list.slice(0, 3).map((e) => e.id));
    check("what was run comes first (empty box)", rec[0] === "key:0:0" || /^key:/.test(rec[0]), rec);
    await type("music"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown");
    check("↑ ↓ move the pick", (await ev(() => H3Palette.state().sel)) === 2);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, "ui530-palette.png") });
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("Esc closes it", !(await ev(() => H3Palette.state().open)));

    // a Ctrl+K a docker already used is left to it
    await ev(() => { window.__grab = (e) => { if (e.ctrlKey && e.key === "k") e.preventDefault(); }; document.addEventListener("keydown", window.__grab, true); });
    await p.keyboard.press("Control+k"); await p.waitForTimeout(250);
    check("a Ctrl+K a docker already handled (the timeline's split) does not open the palette", !(await ev(() => H3Palette.state().open)));
    await ev(() => document.removeEventListener("keydown", window.__grab, true));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { if (tlWasGone === true) await ev(() => { if (!document.getElementById("timelinedock").classList.contains("dockgone")) toggleDockGone("timelinedock", "tT"); }); } catch { /* fine */ }
    try { await ev(() => { try { localStorage.removeItem("h3pal.recent"); } catch (e) { /* fine */ } }); } catch { /* fine */ }
    try { await b.close(); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
