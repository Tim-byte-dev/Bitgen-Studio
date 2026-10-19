#!/usr/bin/env node
/* bitGen Studio — 2.451.0 in a REAL browser: the editor's Edit / Generate tabs drive the PROMPT DOCKER (even when it was
 * in Video, even with no picture open), Del deletes the current layer, the prompt docker's QUICK PROMPTS (💾, the ⚡
 * dropdown, 🗑). Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the quick prompts browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const api = async (u, b) => { const r = await fetch(URL_.replace(/\/$/, "") + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return r.json(); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  let mine = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.promptLink && document.getElementById("qpSel"), null, { timeout: 60000 });
    await p.waitForTimeout(5000);                       // the project's saved prompt-docker settings land first
    /* 1 the Edit tab with the prompt docker in Video and no picture open */
    await ev(() => {
      const g = document.getElementById("genModeSel"); g.value = "video"; g.onchange && g.onchange();
      const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock");
      const E = window.imageEditorInstance.E; E.ui.showTab("kxAi"); document.querySelector('#kxModes button[data-mode="generate"]').click();
    });
    await p.waitForTimeout(300);
    await ev(() => { const g = document.getElementById("genModeSel"); g.value = "video"; g.onchange && g.onchange(); document.querySelector('#kxModes button[data-mode="refine"]').click(); });
    await p.waitForTimeout(200);
    const st = () => ev(() => { const s = document.getElementById("styleSel"); return { gm: document.getElementById("genModeSel").value, style: s.selectedOptions[0] ? s.selectedOptions[0].textContent : "", go: document.getElementById("go").textContent.trim(),
      run: getComputedStyle(document.getElementById("kxRun")).display, model: getComputedStyle(document.getElementById("kxRowEdit")).display, open: !!window.imageEditorInstance.E.S.w }; });
    await ev(() => document.querySelector('#kxModes button[data-mode="edit"]').click()); await p.waitForTimeout(500);
    const e1 = await st();
    await shot("1-edit");
    check("Edit tab clicked (prompt docker was in 🎬 Video, no picture open): the prompt docker goes to 🖼 Image, its style to Qwen Image 2.1 edit, its button reads ✏ Edit; the tab's own ✨ Edit button and model row are gone",
      e1.gm === "image" && /qwen image 2\.1 edit/i.test(e1.style) && /Edit/.test(e1.go) && e1.run === "none" && e1.model === "none" && !e1.open, e1);
    await ev(() => document.querySelector('#kxModes button[data-mode="generate"]').click()); await p.waitForTimeout(400);
    const g1 = await st();
    check("Generate tab: the button reads ✨ Generate, the tab's own button hidden, the style it had before put back", g1.gm === "image" && /Generate/.test(g1.go) && g1.run === "none" && !/qwen image 2\.1 edit/i.test(g1.style), g1);
    await ev(() => document.querySelector('#kxModes button[data-mode="edit"]').click()); await p.waitForTimeout(300);
    await ev(() => { document.getElementById("prompt").value = "make it blue"; });
    await ev(() => runGenerate()); await p.waitForTimeout(300);
    const said = await ev(() => document.getElementById("ieStatus") ? document.getElementById("ieStatus").textContent : "");
    check("...✏ Edit with nothing open says to open a picture (nothing queued)", /open a picture to edit/.test(said), said);
    await ev(() => document.querySelector('#kxModes button[data-mode="refine"]').click()); await p.waitForTimeout(300);
    const r1 = await st();
    check("another tab (Refine): the prompt docker back in 🎬 Video, its own Generate", r1.gm === "video" && r1.go === "Generate", r1);

    /* 2 Del deletes the current layer (no selection) */
    const d2 = await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(200, 120, "del.png", (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 200, 120); }); E.newLayer(); E.newLayer(); E.deselect(); return E.S.layers.length; });
    await ev(() => document.getElementById("ieStage").focus()); await p.keyboard.press("Delete"); await p.waitForTimeout(200);
    const d3 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(100);
    const d4 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    check("Del (nothing selected) deletes the current layer; undo brings it back", d2 === 3 && d3 === 2 && d4 === 3, { d2, d3, d4 });

    /* 3 quick prompts */
    const stamp = "QP test " + Date.now().toString(36);
    await ev((s) => { const t = document.getElementById("prompt"); t.value = s + "\nwide shot, golden hour"; }, stamp);
    await p.click("#qpSave"); await p.waitForTimeout(500);
    mine.push(stamp);
    const q1 = await ev((s) => ({ opts: [...document.querySelectorAll("#qpSel option")].map((o) => o.textContent), msg: document.getElementById("qpMsg").textContent }), stamp);
    const srv = await api("/api/quickprompts");
    check("💾 saves the prompt; the ⚡ dropdown lists it by its FIRST line (kept in quick_prompts.json)", q1.opts.includes(stamp) && /saved/.test(q1.msg) && srv.prompts.some((x) => x.name === stamp && /golden hour/.test(x.text)), q1);
    await ev(() => { document.getElementById("prompt").value = ""; });
    await ev((s) => { const sel = document.getElementById("qpSel"), o = [...sel.options].find((x) => x.textContent === s); sel.value = o.value; sel.dispatchEvent(new Event("change")); }, stamp);
    await p.waitForTimeout(200);
    const q2 = await ev(() => document.getElementById("prompt").value);
    check("picking it in ⚡ puts the whole prompt back in the box", q2 === stamp + "\nwide shot, golden hour", q2);
    await p.click("#qpDel"); await p.waitForTimeout(500);
    const q3 = await ev((s) => [...document.querySelectorAll("#qpSel option")].some((o) => o.textContent === s), stamp);
    if (!q3) mine = [];
    check("🗑 deletes the one picked last", !q3, q3);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    for (const n of mine) { try { await api("/api/quickprompts/delete", { name: n }); } catch { /* fine */ } }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
