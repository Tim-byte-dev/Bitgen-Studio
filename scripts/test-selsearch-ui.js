#!/usr/bin/env node
/* bitGen Studio — 2.478.0 in a REAL browser: SEARCH IN EVERY DROPDOWN LIST (static/selsearch.js).
 * Tim (verbatim): "add a search/filter input to the dropdown lists like the comfyui nodes"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the dropdown search browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch(); global.__b = b;
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.__selSearch, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#ff0000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods, steps) => { await p.waitForTimeout(120); const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: steps || 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(100); };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(80); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(120); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, name: L && L.name,
      smart: L && L.smart ? JSON.parse(JSON.stringify(L.smart)) : null, fmask: !!(L && L.fmask), names: s.layers.map((x) => x.type + ":" + x.name) }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const count = (x0, y0, x1, y1, f) => ev(([a, b2, c, d, fs]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; const D = L.canvas.getContext("2d").getImageData(a, b2, c - a, d - b2).data; const fn = new Function("r", "g", "b", "a", "return " + fs); let n = 0; for (let i = 0; i < D.length; i += 4) if (fn(D[i], D[i + 1], D[i + 2], D[i + 3])) n++; return n; }, [x0, y0, x1, y1, f]);
    const layerData = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(0, 0, s.w, s.h).data); });
    const box = () => ev(() => { const b = document.querySelector(".selsearch"); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, rows: Array.from(b.querySelectorAll(".ssrow .t")).map((t) => t.textContent), count: b.querySelector(".sscount").textContent, focus: document.activeElement === b.querySelector("input"), vw: innerWidth, vh: innerHeight }; });
    // 1. the Layers panel's blend mode list
    await p.click("#kxBlend"); await p.waitForTimeout(250);
    let b = await box();
    check("a press on the Layers panel's blend mode list (16 modes) opens the search list: every mode, the box focused, inside the window", b && b.rows.length === 16 && b.focus && b.x >= 0 && b.y >= 0 && b.x + b.w <= b.vw && b.y + b.h <= b.vh, b);
    await p.keyboard.type("lig"); await p.waitForTimeout(150);
    b = await box();
    check("typing 'lig' narrows it to Lighten, Hard Light, Soft Light (best first), '3 of 16'", b && b.rows.join("|") === "Lighten|Hard Light|Soft Light" && b.count === "3 of 16", b && b.rows);
    await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    let s = await ev(() => { const st = window.imageEditorInstance.state; return { blend: st.layers[st.active].blend, ui: document.getElementById("kxBlend").value, open: !!document.querySelector(".selsearch"), undo: st.undo.length, tool: st.tool }; });
    check("↓ ↓ Enter picks Soft Light: the layer's blend mode changes, the list closed", s.blend === "soft-light" && s.ui === "soft-light" && !s.open, s);
    const undo0 = s.undo, tool0 = s.tool;
    // 2. a letter opens it searching; Esc closes it and the editor keeps its tool
    await p.focus("#kxBlend"); await p.keyboard.press("d"); await p.waitForTimeout(200);
    b = await box();
    check("a letter on the focused list opens it already searching ('d' -> Darken first)", b && b.rows[0] === "Darken", b && b.rows);
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    s = await ev(() => { const st = window.imageEditorInstance.state; return { blend: st.layers[st.active].blend, open: !!document.querySelector(".selsearch"), undo: st.undo.length, tool: st.tool }; });
    check("Esc closes it: nothing changed, and the editor did not take the Esc (its tool kept)", !s.open && s.blend === "soft-light" && s.undo === undo0 && s.tool === tool0, s);
    // 3. a press outside closes it
    await p.click("#kxBlend"); await p.waitForTimeout(200);
    await p.mouse.click(5, 5); await p.waitForTimeout(150);
    check("a press outside closes it", !(await box()));
    // 4. a dialog: File > New's presets, the letters in order
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(300);
    await p.click(".kxdlg.pcd #pdPre"); await p.waitForTimeout(200);
    b = await box();
    check("in a dialog too (File ▸ New's 8 presets), over the dialog", b && b.rows.length === 8 && await ev(() => { const r = document.querySelector(".selsearch").getBoundingClientRect(); const top = document.elementFromPoint(r.x + 20, r.y + r.height - 10); return !!(top && top.closest(".selsearch")); }), b);
    await ev(() => { window.__outside = 0; document.addEventListener("pointerdown", window.__outsideFn = () => { window.__outside++; }, true); });
    await p.keyboard.type("4k"); await p.waitForTimeout(100);
    const rb = await p.locator(".selsearch .ssrow").first().boundingBox();
    await p.mouse.click(rb.x + 10, rb.y + rb.height / 2); await p.waitForTimeout(200);
    const outside = await ev(() => { document.removeEventListener("pointerdown", window.__outsideFn, true); return window.__outside; });
    check("a click on a row is the list's own: a popover's outside-press listener never sees it", outside === 0, outside);
    const wh = await ev(() => [document.querySelector(".kxdlg.pcd #pdW").value, document.querySelector(".kxdlg.pcd #pdH").value]);
    check("'4k' + a click picks '3840 × 2160 (4K)' and the dialog's own change fills width + height", wh[0] === "3840" && wh[1] === "2160", wh);
    await p.click(".kxdlg.pcd .cancel").catch(() => ev(() => { const d = document.querySelector(".kxdlg.pcd"); if (d) d.remove(); }));
    await p.waitForTimeout(200);
    // 5. the setting
    await ev(() => document.getElementById("openSettings").onclick()); await p.waitForTimeout(800);
    const set = await ev(() => { const f = document.getElementById("s_selsearch"); return f ? f.value : null; });
    check("Settings ▸ General has 'Search in lists with 8 or more items'", set === "8", set);
    await ev(() => { const f = document.getElementById("s_selsearch"); f.value = "99"; f.dispatchEvent(new Event("change")); });
    await ev(() => { const x = document.querySelector("#settings .close, #settings [data-close], #sClose"); if (x) x.click(); else document.getElementById("settings").classList.remove("on"); });
    await p.waitForTimeout(300);
    const plain = await ev(() => { const sel = document.getElementById("kxBlend"); const e = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }); sel.dispatchEvent(e); return { prevented: e.defaultPrevented, min: window.__selSearch.min }; });
    await p.waitForTimeout(150);
    check("set to 99: the blend list (16) is the plain list again", !plain.prevented && plain.min === 99 && !(await box()), plain);
    await ev(() => window.__selSearch.setMin(8));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  await b0close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
async function b0close() { try { await global.__b.close(); } catch (e) { /* closed */ } }
