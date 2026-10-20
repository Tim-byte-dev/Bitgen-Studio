#!/usr/bin/env node
/* bitGen Studio — 2.547.0 in a REAL browser: several picked layers - the 🗑 button deletes them all, Ctrl+G groups them,
 * Ctrl+G on one group ungroups it (pcmultisel.js); ↺ Built-in puts the Krea 2 styles back (static/stylerestore.js,
 * routes/stylesRestore.js).
 * Tim: "the krea2 style is gone,please add them back. when the user selects multiple layers in the image-editor and
 * presses the delete button, delete all the selected layers, if the user pressed ctrl+g then group the layers, if user
 * selects 1 group and presses ctrl+g then ungroup that group."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.547.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.multi && window.H3StyleRestore, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#ff0000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "400"); await p.fill(".kxdlg.pcd #pdH", "300"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(150); };
    const mk = (names) => ev((names) => { const E = window.imageEditorInstance.E; for (const n of names) { E.newLayer(); E.layer().name = n; } E.multi.clear(); E.renderLayersPanel(); }, names);
    const st = () => ev(() => { const E = window.imageEditorInstance.E, S = E.S; return { names: S.layers.map((L) => L.name), types: S.layers.map((L) => L.type), parents: S.layers.map((L) => { const g = S.layers.find((x) => x.id === L.parent); return g ? g.name : null; }), active: E.layer() && E.layer().name, undo: S.undo.length, picks: E.multi.list().map((L) => L.name) }; });
    const pick = (names) => ev((names) => { const E = window.imageEditorInstance.E, ids = names.map((n) => E.S.layers.find((L) => L.name === n).id); E.multi.set(ids); }, names);
    await mk(["A", "B", "C", "D"]);
    // 1 the 🗑 button deletes every picked layer
    await pick(["B", "D"]);
    let s0 = await st();
    await p.click("#kxLDel"); await p.waitForTimeout(300);
    let s1 = await st();
    check("B and D picked, 🗑 in the Layers panel: BOTH deleted (one undo step), A and C left", !s1.names.includes("B") && !s1.names.includes("D") && s1.names.includes("A") && s1.names.includes("C") && s1.undo === s0.undo + 1 && s1.picks.length === 0, { s0, s1 });
    await key("Control+z"); s1 = await st();
    check("...Ctrl+Z brings both back", s1.names.includes("B") && s1.names.includes("D"), s1);
    // Layer ▸ Delete Layer (Shift+Del) the same
    await pick(["A", "C"]); await ev(() => window.imageEditorInstance.E.ui.run("layer.del")); await p.waitForTimeout(250); s1 = await st();
    check("Layer ▸ Delete Layer (Shift+Del) with A and C picked: both deleted", !s1.names.includes("A") && !s1.names.includes("C") && s1.names.includes("B"), s1);
    await key("Control+z");
    // one layer, nothing picked: only it
    await ev(() => { const E = window.imageEditorInstance.E; E.multi.clear(); E.setActive(E.S.layers.findIndex((L) => L.name === "D")); });
    const n0 = (await st()).names.length; await p.click("#kxLDel"); await p.waitForTimeout(250); s1 = await st();
    check("one layer (nothing picked): 🗑 deletes just it, as before", s1.names.length === n0 - 1 && !s1.names.includes("D"), s1);
    await key("Control+z");
    // 2 Ctrl+G groups the picked layers
    await pick(["A", "C", "D"]);
    await key("Control+g"); s1 = await st();
    const g = s1.names[s1.types.indexOf("group")];
    check("A, C and D picked, Ctrl+G: ONE new group holding the three (B stays outside), the group selected, the panel's order kept",
      !!g && s1.active === g && ["A", "C", "D"].every((n) => s1.parents[s1.names.indexOf(n)] === g) && s1.parents[s1.names.indexOf("B")] === null
      && s1.names.indexOf("A") < s1.names.indexOf("C") && s1.names.indexOf("C") < s1.names.indexOf("D") && s1.picks.length === 0, s1);
    // 3 one group selected, Ctrl+G: ungroup
    await key("Control+g"); const s2 = await st();
    check("the group selected (alone), Ctrl+G again: UNGROUPED - A, C, D back at the top level, no group left", !s2.types.includes("group") && ["A", "C", "D"].every((n) => s2.parents[s2.names.indexOf(n)] === null), s2);
    // one plain layer: grouped alone (as before)
    await ev(() => { const E = window.imageEditorInstance.E; E.multi.clear(); E.setActive(E.S.layers.findIndex((L) => L.name === "B")); });
    await key("Control+g"); const s3 = await st();
    check("one plain layer, Ctrl+G: it goes in a group of its own (as before)", s3.types.includes("group") && s3.parents[s3.names.indexOf("B")] === s3.active, s3);

    // 4 ↺ Built-in: Krea 2 back
    const sid = await ev(async () => { const j = await (await fetch("/api/styles?kind=image")).json(); const s = (j.styles || []).find((x) => x.name === "Krea 2 Turbo"); return s ? s.id : null; });
    if (sid) await ev((id) => fetch("/api/styles/" + encodeURIComponent(id), { method: "DELETE" }), sid);
    const miss = await ev(async () => (await (await fetch("/api/styles/missing?kind=image")).json()).missing);
    check("a deleted Krea 2 Turbo is listed as a missing built-in style", miss.includes("Krea 2 Turbo"), miss);
    const btn = await ev(() => { const b = document.getElementById("styleRestore_image"); return b ? { prev: b.previousElementSibling.id, text: b.textContent } : null; });
    check("Settings ▸ Image styles: ↺ Built-in after ✕ Delete (Video styles too)", btn && btn.prev === "s_styledel" && btn.text === "↺ Built-in" && (await ev(() => !!document.getElementById("styleRestore_video"))), btn);
    const run = ev(() => window.H3StyleRestore.run("image"));
    await p.waitForSelector("#note_ok", { state: "visible", timeout: 10000 });
    const q = await ev(() => document.getElementById("note_body").textContent);
    await p.click("#note_ok");
    const made = await run;
    const back = await ev(async () => { const j = await (await fetch("/api/styles?kind=image")).json(); return { names: (j.styles || []).map((x) => x.name).filter((n) => /Krea/.test(n)), sel: [...document.getElementById("styleSel").options].some((o) => /Krea 2 Turbo/.test(o.textContent)) }; });
    check("↺ asks first (it names Krea 2 Turbo), then it is back - in the list and the prompt docker's Style", /Krea 2 Turbo/.test(q) && made.includes("Krea 2 Turbo") && back.names.includes("Krea 2 Turbo") && back.sel, { q, made, back });
    const again = await ev(async () => (await (await fetch("/api/styles/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json()).made);
    check("nothing missing = nothing written (a style is never overwritten)", Array.isArray(again) && again.length === 0, again);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
