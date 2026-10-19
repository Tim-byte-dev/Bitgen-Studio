#!/usr/bin/env node
/* bitGen Studio — 2.465.0 in a REAL browser: PUPPET PIN DEPTH + ROTATION (pcwarp.js / pcmesh.js) and the PATCH tool's
 * Normal (Diffusion, Transparent) / Content-Aware (Structure, Color) modes + Content-Aware Move's Structure / Color
 * (pcheal.js / pcretouch.js).
 * Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the puppet pin / patch browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.imageEditorInstance.E.warp, null, { timeout: 60000 });
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
    const opt = (sel) => ev((s) => { const e = document.querySelector(s); return e ? (e.type === "checkbox" ? e.checked : e.value) : null; }, sel);
    const setOpt = (sel, v) => ev(([s, v]) => { const e = document.querySelector(s); if (e.type === "checkbox") e.checked = v; else e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); }, [sel, v]);
    const pin = () => ev(() => { const P = window.imageEditorInstance.E.warp.puppetState(); return P && P.sel >= 0 ? JSON.parse(JSON.stringify(P.pins[P.sel])) : null; });

    /* 1 PUPPET WARP: a bar, three pins; the middle pin turned (Alt-drag, then Fixed 90°), its depth up */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#00aa00"; g.fillRect(100, 280, 400, 30); L.ver++; E.refresh(); E.ui.run("xf.puppet"); });
    await click(110, 295); await click(490, 295); await click(300, 295);
    let pp = await pin();
    check("Puppet Warp: the new pin is the picked one - Pin Depth ⬆ / ⬇ and Rotate (Auto) on the options bar", pp && Math.round(pp.X) === 300 && (await opt("#ppRot")) === "auto" && (await ev(() => !document.querySelector("#ppFwd").disabled)), pp);
    await drag(325, 295, 300, 320, ["Alt"], 10);
    pp = await pin();
    check("Alt-drag round the picked pin turns it: Fixed, +90° (shown on the options bar)", pp && Math.abs(pp.a - Math.PI / 2) < 0.05 && (await opt("#ppRot")) === "fixed" && Math.abs(+(await opt("#ppAng")) - 90) < 3, pp);
    await setOpt("#ppRot", "auto"); pp = await pin();
    const autoA = pp && pp.a;
    await setOpt("#ppRot", "fixed"); await setOpt("#ppAng", "90"); pp = await pin();
    check("Rotate Auto clears it; Fixed + 90 typed sets it again", autoA === undefined && pp && Math.abs(pp.a - Math.PI / 2) < 1e-9, { autoA, pp });
    const above = await ev(() => { const s = window.imageEditorInstance.state, c = s.float && s.float.c; if (!c) return -1; const D = c.getContext("2d").getImageData(290, 255, 21, 24).data; let n = 0; for (let i = 0; i < D.length; i += 4) if (D[i + 3] > 200 && D[i + 1] > 120) n++; return n; });
    check("...the bar's middle turned with it (the live preview): green now stands up above the bar round the pin (it held the turn there)", above > 40, above);
    await p.click("#ppFwd"); await p.click("#ppFwd"); await p.click("#ppBack"); pp = await pin();
    check("Pin Depth ⬆ ⬆ ⬇: depth +1 (shown)", pp && pp.z === 1 && (await ev(() => document.getElementById("ppZ").textContent)) === "1", pp);
    const u0 = (await st()).undo;
    await key("Enter");
    const s1 = await st(), kept = await count(290, 255, 311, 279, "a > 200 && g > 120");
    check("Enter applies it - one undo step, the turned part kept", s1.tool !== "puppet" && s1.undo === u0 + 1 && kept > 40, { tool: s1.tool, u: s1.undo, u0, kept });

    /* 2 PATCH Content-Aware: a red blemish on vertical stripes, dragged onto the horizontal ones (Structure 7, Color 0) */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d");
      for (let y = 0; y < 400; y++) for (let x = 0; x < 600; x++) { const v = x < 300 ? ((x >> 2) % 2 ? 210 : 90) : ((y >> 2) % 2 ? 210 : 90); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1); }
      g.fillStyle = "#ff0000"; g.fillRect(100, 180, 40, 40); L.ver++; E.refresh(); E.changeSel(E.P.rectMask(96, 176, 144, 224, 600, 400), "blemish"); E.setTool("patch"); });
    await p.waitForTimeout(200);
    await setOpt("#ptPType", "ca"); await p.waitForTimeout(150);
    check("Patch ▸ Content-Aware: Structure + Color on the options bar (Source / Destination not used)", (await opt("#ptPSt")) !== null && (await opt("#ptPCol")) !== null && (await ev(() => document.querySelector("#ptPMode").disabled)) && (await opt("#ptPDif")) === null);
    await setOpt("#ptPSt", "7"); await setOpt("#ptPCol", "0");
    await drag(120, 200, 420, 200);
    let red = 1; for (let i = 0; i < 60 && red; i++) { await p.waitForTimeout(250); red = await count(100, 180, 140, 220, "r > 200 && g < 60"); }
    const stripes = await ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active], D = L.canvas.getContext("2d").getImageData(104, 184, 32, 32).data; let gx = 0, gy = 0; for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) { const i = (y * 32 + x) * 4; gx += Math.abs(D[i] - D[i + 4]); gy += Math.abs(D[i] - D[i + 128]); } return { gx, gy }; });
    check("...dragged onto the horizontal stripes: the blemish rebuilt from there (no red; its stripes run across - the up-down change wins)", red === 0 && stripes.gy > stripes.gx * 1.3, { red, stripes });
    await ev(() => window.imageEditorInstance.E.deselect());

    /* 3 PATCH Normal: Transparent = half over what was there; Diffusion on the bar */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const L = E.layer(), g = L.canvas.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, 600, 400); g.fillStyle = "#000000"; g.fillRect(100, 100, 40, 40); L.ver++; E.refresh(); E.changeSel(E.P.rectMask(96, 96, 144, 144, 600, 400), "dark"); });
    await setOpt("#ptPType", "normal"); await p.waitForTimeout(150);
    check("Patch ▸ Normal: Source / Destination, Transparent, Diffusion (5)", (await opt("#ptPTr")) !== null && (await opt("#ptPDif")) === "5" && !(await ev(() => document.querySelector("#ptPMode").disabled)));
    await setOpt("#ptPTr", true);
    await drag(120, 120, 320, 120); await p.waitForTimeout(400);
    const half = await lpx(120, 120);
    await ev(() => window.imageEditorInstance.E.undo());
    await setOpt("#ptPTr", false);
    await drag(120, 120, 320, 120); await p.waitForTimeout(400);
    const full = await lpx(120, 120);
    check("Transparent: the grey texture only half over the black (~64); without it, grey all through (~128)", Math.abs(half[0] - 64) < 16 && Math.abs(full[0] - 128) < 12, { half, full });
    await ev(() => window.imageEditorInstance.E.deselect());

    /* 4 Content-Aware Move: Structure + Color */
    await ev(() => window.imageEditorInstance.E.setTool("cmove")); await p.waitForTimeout(150);
    check("Content-Aware Move: Structure (4) + Color (0) on the options bar", (await opt("#ptMSt")) === "4" && (await opt("#ptMCol")) === "0");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
