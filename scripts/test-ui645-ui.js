#!/usr/bin/env node
/* bitGen Studio — 2.645.0 in a REAL browser: Ctrl+P BRINGS THE PROMPT DOCKER TO THE FRONT (static/promptfront.js).
 * Tim (verbatim): "if user presses ctrl P bring the prompt docker to front".
 * Closed, folded, under a floating window, under a maximized docker, in a closed ▣ docker - Ctrl+P: seen, on top, the prompt
 * box focused. Typing in another box too. Not in 🎨 Artist mode (its colour palette). Never the browser's print. The image
 * editor's Print is Ctrl+Shift+P. Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.645.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  let gid = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PromptFront && window.PFloat && PFloat.started && window.H3DockGroup && window.H3DGDock, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    // a known start: the prompt docker open, floating, nothing over it
    await ev(() => { const d = document.getElementById("promptdock"); if (d.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); if (d.classList.contains("collapsed")) toggleCollapse("promptdock"); PFloat.float(320, 220, 640, 300); });
    await p.waitForTimeout(300);
    const st = () => ev(() => { const d = document.getElementById("promptdock"); return { gone: d.classList.contains("dockgone"), folded: d.classList.contains("collapsed"), seen: !H3PromptFront.coveredBy(), focus: (document.activeElement || {}).id || "" }; });
    const ctrlP = async () => { await p.mouse.move(8, 520); await p.keyboard.press("Control+p"); await p.waitForTimeout(500); return st(); };
    check("the key: Ctrl+P / Cmd+P, not with Shift or Alt", await ev(() => [{ ctrlKey: true, key: "p" }, { metaKey: true, key: "P" }, { ctrlKey: true, code: "KeyP", key: "π" }].every((e) => H3PromptFront.isKey(e)) && ![{ ctrlKey: true, shiftKey: true, key: "p" }, { ctrlKey: true, altKey: true, key: "p" }, { key: "p" }].some((e) => H3PromptFront.isKey(e))));

    await ev(() => toggleDockGone("promptdock", "tP"));
    let s0 = await st(), s = await ctrlP();
    check("closed -> Ctrl+P opens it, the prompt box focused", s0.gone && !s.gone && s.seen && s.focus === "prompt", { s0, s });
    await ev(() => { document.activeElement && document.activeElement.blur(); toggleCollapse("promptdock"); });
    s0 = await st(); s = await ctrlP();
    check("folded -> Ctrl+P unfolds it, focused", s0.folded && !s.folded && s.seen && s.focus === "prompt", { s0, s });

    // another floating window over it (the floating dockers' level), then a maximized docker's level
    await ev(() => { document.activeElement && document.activeElement.blur(); const w = document.createElement("div"); w.id = "t645cover"; const r = document.getElementById("prompt").getBoundingClientRect(); w.style.cssText = `position:fixed;left:${r.left - 40}px;top:${r.top - 40}px;width:${r.width + 80}px;height:${r.height + 80}px;z-index:47;background:#333`; document.body.appendChild(w); });
    await p.waitForTimeout(200); s0 = await st(); s = await ctrlP();
    check("under another floating window -> Ctrl+P lifts it over it, focused", !s0.seen && s.seen && s.focus === "prompt" && await ev(() => document.getElementById("promptdock").classList.contains("pf-front")), { s0, s });
    await ev(() => document.getElementById("t645cover").remove()); await p.waitForTimeout(2000);
    check("…the window gone: the lift ends by itself (its own level again)", await ev(() => !document.querySelector(".pf-front")));
    await ev(() => { const w = document.createElement("div"); w.id = "t645max"; w.style.cssText = "position:fixed;inset:0;z-index:9000;background:#222"; document.body.appendChild(w); });
    await p.waitForTimeout(200); s0 = await st(); s = await ctrlP();
    check("under a maximized docker (z 9000, the Sketcher's) -> Ctrl+P puts it over that", !s0.seen && s.seen && s.focus === "prompt", { s0, s });
    await ev(() => document.getElementById("t645max").remove()); await p.waitForTimeout(2000);

    // typing in another box: still
    await ev(() => { const i = document.createElement("input"); i.id = "t645in"; i.style.cssText = "position:fixed;left:4px;top:4px;z-index:5"; document.body.appendChild(i); i.focus(); });
    await p.keyboard.type("abc"); await p.keyboard.press("Control+p"); await p.waitForTimeout(400);
    check("typing in another box: Ctrl+P still goes to the prompt (the box keeps its text)", await ev(() => document.activeElement.id === "prompt" && document.getElementById("t645in").value === "abc"));
    await ev(() => document.getElementById("t645in").remove());
    // never the browser's print: the key's default is prevented
    const prevented = await ev(() => { const e = new KeyboardEvent("keydown", { key: "p", code: "KeyP", ctrlKey: true, bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return e.defaultPrevented; });
    check("the browser's own Ctrl+P (print) is held back", prevented);

    // a closed ▣ docker holding the prompt docker
    await ev(async () => { await H3DockGroup.toggle(true); }); await p.waitForTimeout(800);
    gid = await ev(() => H3DockGroup.groups().slice(-1)[0]);
    await ev((g) => H3DGDock.takeIn("pf.promptdock", g), gid); await p.waitForTimeout(1200);
    const inG = await ev(() => { const r = H3Panels.list().find((x) => x.id === "pf.promptdock"); return r && r.state; });
    await ev(async (g) => { document.activeElement && document.activeElement.blur(); await H3DockGroup.toggle(false, g); }, gid); await p.waitForTimeout(800);
    s0 = await st(); s = await ctrlP(); await p.waitForTimeout(500); s = await st();
    check("in a ▣ docker that is closed -> Ctrl+P shows that docker, the prompt focused", inG === "in" && !s0.seen && s.seen && s.focus === "prompt" && await ev((g) => H3DockGroup.shown(g), gid), { inG, s0, s });

    // 2.646.0: 🎨 Artist mode - Ctrl+P brings the prompt docker too (its palette moved to Alt+P); 2.646.0's own test does the real one
    // the image editor's Print
    const pk = await ev(() => { const E = window.imageEditorInstance && window.imageEditorInstance.E; const c = E && E.ui && E.ui.CMD && E.ui.CMD.get("file.print"); return c ? c.key : "(no editor)"; });
    check("the image editor's File ▸ Print is Ctrl+Shift+P now", pk === "Shift+Ctrl+P" || pk === "(no editor)", pk);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    // put things back: the prompt docker out of the ▣ docker, floating, open; the ▣ docker removed
    try { await ev(async (g) => { if (g && H3DockGroup.remove) { try { await Promise.race([H3DockGroup.remove(g, true), new Promise((r) => setTimeout(r, 3000))]); } catch (e) { /* fine */ } } PFloat.float(320, 220, 640, 300); const d = document.getElementById("promptdock"); if (d.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); H3PromptFront.unlift(); }, gid); await p.waitForTimeout(600); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
