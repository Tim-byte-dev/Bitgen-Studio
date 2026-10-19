#!/usr/bin/env node
/* bitGen Studio — 2.411.0 in a REAL browser against the REAL app: TEXT EFFECT PRESETS, live. The timeline's text
 * Properties and the image editor's Type tool + text Properties get Presets ▾ (the two made from Tim's PSDs, your imports,
 * the classic looks); picking one draws the text through it at once, typing updates it as you go (a quick picture, then
 * the sharp one), ⚙ Compile's PNG is the sharp one; ＋ Import a PSD text effect… adds a PSD (a fixture written with
 * ag-psd) to "Your imports", 🗑 removes it.
 * Tim: "are you able to add these styles to a presets dropdown in the text tool properties in timeline docker and image
 * editor?" ... "it would be nice if it was live". Run against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.411 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_tfxui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: body === "DELETE" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: body === "DELETE" ? undefined : JSON.stringify(body) })).json();
// a small text effect PSD: one GUID smart object (a linked document with a text layer), two side copies, a face with 2 shadows
const A = require(path.join(ROOT, "static", "vendor", "ag-psd.js"));
const G = "20953ddb-9391-11ec-b4f1-c15674f50bc4";
const tq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
const sl = (name, t, extra) => Object.assign({ name, placedLayer: { id: G, placed: G, type: "raster", transform: t, width: 200, height: 100 } }, extra || {});
const inner = A.writePsdBuffer({ width: 200, height: 100, children: [{ name: "word", text: { text: "Hi", style: { font: { name: "Foo-Regular" }, fontSize: 40, fillColor: { r: 0, g: 128, b: 255 } } } }] }, { invalidateTextLayers: false });
const FIX = path.join(os.tmpdir(), "ui-fixture-text-effect.psd");
fs.writeFileSync(FIX, A.writePsdBuffer({ width: 400, height: 300, linkedFiles: [{ id: G, name: "word.psb", data: inner }], children: [
  { name: "bg" }, { name: "side", children: [sl("copy 2", tq(96, 108, 304, 208), { effects: { solidFill: [{ enabled: true, color: { r: 20, g: 40, b: 160 }, opacity: 1 }] } }), sl("copy 1", tq(98, 104, 302, 204), { effects: { solidFill: [{ enabled: true, color: { r: 40, g: 80, b: 200 }, opacity: 1 }] } })] },
  sl("Your text here", tq(100, 100, 300, 200), { effects: { solidFill: [{ enabled: true, color: { r: 255, g: 220, b: 0 }, opacity: 1 }],
    dropShadow: [{ enabled: true, color: { r: 0, g: 0, b: 0 }, opacity: 0.5, angle: 90, distance: { units: "Pixels", value: 10 }, size: { units: "Pixels", value: 6 } },
                 { enabled: true, color: { r: 0, g: 0, b: 0 }, opacity: 0.3, angle: 90, distance: { units: "Pixels", value: 20 }, size: { units: "Pixels", value: 12 } }] } })] }));

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  let imported = null;
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    const pdir = path.join(ROOT, "projects", P);
    const booted = Promise.all([
      p.waitForResponse((r) => /\/api\/ui\/layout(\?|$)/.test(r.url()), { timeout: 60000 }).catch(() => null),
      p.waitForResponse((r) => /\/api\/dockers(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 60000 }).catch(() => null),
    ]);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await booted;
    await p.waitForFunction(() => window.H3TextFx && window.TlTextFx && window.TlCanvas && window.TlFloat && H3TextFx.list().length >= 12, null, { timeout: 60000 });
    await p.waitForTimeout(600);

    /* ---- 1. the timeline */
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline();
      TlFloat.show(true); TlFloat.place(1700, 120);
      TlCanvas.addText({ x: TlCanvas.state.W / 2, y: TlCanvas.state.H / 2 });
      window.__c = tl.images[0].clips[0];
      Object.assign(__c.text, { content: "ARENA", font: "Arial Black", size: Math.round(TlCanvas.state.H * 0.18), bold: true });
      TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.paintProps();
    });
    await p.waitForSelector("#tlpFxRow .tfx-sel");
    const opts = await ev(() => [...document.querySelectorAll("#tlpFxRow .tfx-sel option")].map((o) => o.value + "=" + o.textContent));
    const groups = await ev(() => [...document.querySelectorAll("#tlpFxRow .tfx-sel optgroup")].map((g) => g.label));
    check("timeline text Properties: Presets ▾ - no preset, the PSD text effects (Arena Gold 3D, Trend Candy 3D), the classic looks, ＋ Import a PSD",
      opts[0] === "=— no preset —" && opts.includes("psd:arena-gold-3d=Arena Gold 3D") && opts.includes("psd:trend-candy-3d=Trend Candy 3D") && opts.includes("style:gold=Gold")
      && opts[opts.length - 1] === "__import=＋ Import a PSD text effect…" && groups.join() === "PSD text effects,Classic", { opts, groups });
    const gold = () => ev(() => new Promise((res) => {
      const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 100 && d[i + 1] < 215 && d[i + 2] < 90) n++; res(n); };
      TlCanvas.draw(); im.src = TlCanvas.snapshot();
    }));
    const g0 = await gold();
    await p.selectOption("#tlpFxRow .tfx-sel", "psd:arena-gold-3d");
    const t0 = Date.now();
    await p.waitForFunction(() => { const r = H3TextFx._results; for (const k of r.keys()) if (k.startsWith("psd:arena-gold-3d|") && k.includes("ARENA")) return true; return false; }, null, { timeout: 20000 });
    const tFirst = Date.now() - t0;
    await p.waitForTimeout(150);
    const g1 = await gold();
    const s1 = await ev(() => ({ fx: __c.text.fx, note: document.getElementById("tlpFxNote").textContent, shadowOff: document.getElementById("tlpShadow").disabled, pv: !!document.querySelector("#tlpFxRow .tfx-pv") }));
    check("picking Arena Gold 3D: the text is drawn gold through the PSD's stack at once (" + tFirst + " ms); outline / shadow give way to the preset's; a live preview of the look",
      s1.fx === "psd:arena-gold-3d" && g0 < 50 && g1 > 2000 && s1.shadowOff && /draws its own colours/.test(s1.note) && /blantic/.test(s1.note) && s1.pv, { g0, g1, s1, tFirst });
    // live: type more letters - the picture follows (a quick one at once, the sharp one when typing pauses)
    await ev(() => { const t = document.getElementById("tlpText"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
    await p.keyboard.type(" GO", { delay: 60 });
    await p.waitForFunction(() => { for (const k of H3TextFx._results.keys()) if (k.includes("ARENA GO")) return true; return false; }, null, { timeout: 15000 });
    const quick = await ev(() => { for (const [k, r] of H3TextFx._results) if (k.includes("ARENA GO")) return { fast: r.fast, w: r.canvas.width }; return null; });
    await p.waitForFunction(() => { for (const [k, r] of H3TextFx._results) if (k.includes("ARENA GO") && !r.fast) return true; return false; }, null, { timeout: 30000 });
    const sharp = await ev(() => { for (const [k, r] of H3TextFx._results) if (k.includes("ARENA GO") && !r.fast) return { w: r.canvas.width, h: r.canvas.height }; return null; });
    const wide = await ev(() => TlCanvas.box(__c, "img", TlCanvas.state.t));
    check("typing ' GO': the effect follows the new words live (a picture of 'ARENA GO' while typing, the sharp one after the pause - same size), the canvas uses it",
      quick && sharp && Math.abs(quick.w - sharp.w) <= 2 && wide && wide.w > 0, { quick, sharp, cost: await ev(() => H3TextFx.costOf("psd:arena-gold-3d")) });
    // ⚙ Compile's picture: the sharp one
    await ev(() => TlCanvas.flushText());
    await p.waitForFunction((n) => !!n, fs.existsSync(path.join(pdir, "images")) ? 1 : 0).catch(() => {});
    let png = null; for (let i = 0; i < 40 && !png; i++) { const f = await ev(() => __c.name); const fp = path.join(pdir, "images", f); if (fs.existsSync(fp)) png = fp; else await p.waitForTimeout(250); }
    const dim = png ? JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "json", png], { encoding: "utf8" })).streams[0] : {};
    check("⚙ Compile's text picture is the SHARP render (its size = the full picture of 'ARENA GO')", png && dim.width === sharp.w && dim.height === sharp.h, { png, dim, sharp });
    await p.selectOption("#tlpFxRow .tfx-sel", "");
    await p.waitForTimeout(300);
    const g2 = await gold();
    check("— no preset —: plain text again (outline / shadow back)", !(await ev(() => __c.text.fx)) && g2 < 200 && !(await ev(() => document.getElementById("tlpShadow").disabled)), g2);

    /* ---- 2. ＋ Import a PSD text effect… (a fixture written with ag-psd), 🗑 */
    await ev(() => TlCanvas.paintProps());
    await p.waitForSelector("#tlpFxRow .tfx-file", { state: "attached" });
    await p.setInputFiles("#tlpFxRow .tfx-file", FIX);
    await p.waitForFunction(() => window.__c.text.fx && /^user:/.test(window.__c.text.fx), null, { timeout: 20000 });
    imported = await ev(() => H3TextFx.byId(__c.text.fx));
    const og = await ev(() => [...document.querySelectorAll("#tlpFxRow .tfx-sel optgroup")].map((g) => g.label));
    const msg = await ev(() => document.getElementById("sblog").textContent);
    check("＋ Import a PSD: the file read in the page, saved as yours (named from the file), picked, listed under 'Your imports'; what was left out is said",
      imported && imported.name === "Ui Fixture" && imported.nodes.length === 2 && og.includes("Your imports") && /added/.test(msg) && /left out/.test(msg)
      && (await api("/api/textfx/presets")).presets.some((x) => x.id === imported.id), { imported: imported && imported.name, og, msg });
    await p.waitForTimeout(500);
    const blue = await ev(() => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data; let y = 0, bl = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] > 220 && d[i + 1] > 190 && d[i + 2] < 60) y++; if (d[i + 2] > 140 && d[i] < 70) bl++; } res({ y, bl }); };
      TlCanvas.draw(); im.src = TlCanvas.snapshot(); }));
    check("...the imported effect draws: its yellow face over its blue side copies", blue.y > 1000 && blue.bl > 300, blue);
    await p.click("#tlpFxRow .tfx-del");
    await p.waitForFunction(() => !window.__c.text.fx, null, { timeout: 10000 });
    check("🗑 deletes your import (gone from the list and the server); the text is plain again",
      !(await api("/api/textfx/presets")).presets.some((x) => x.id === imported.id) && !(await ev((id) => !!H3TextFx.byId(id), imported.id)));
    imported = null;

    /* ---- 3. the image editor */
    await ev(() => { TlFloat.show(false); });
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForFunction(() => window.imageEditorInstance && window.imageEditorInstance.E, null, { timeout: 30000 });
    await p.click("#kxFull"); await p.waitForTimeout(700);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#0d5ea0"); E.setFg("#ffffff"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "1200"); await p.fill(".kxdlg.pcd #pdH", "500"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    await ev(() => window.imageEditorInstance.E.setTool("type"));
    await ev(() => window.imageEditorInstance.E.renderOptions && window.imageEditorInstance.E.renderOptions());
    await p.waitForSelector("#ptFxBox .tfx-sel");
    await p.selectOption("#ptFxBox .tfx-sel", "psd:trend-candy-3d");
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    await ev(() => { const E = window.imageEditorInstance.E; E.S.typeSize = 150; });
    await p.mouse.click(...await T(150, 150)); await p.waitForTimeout(250);
    await p.keyboard.type("TRE", { delay: 80 });
    await p.waitForTimeout(250);
    const lay = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; const d = L.canvas.getContext("2d").getImageData(0, 0, L.canvas.width, L.canvas.height).data;
      let yel = 0, blu = 0, x1 = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 100) continue; if (d[i] > 220 && d[i + 1] > 150 && d[i + 2] < 90) yel++; if (d[i + 2] > 180 && d[i] < 120) blu++; const x = (i / 4) % L.canvas.width; if (x > x1) x1 = x; }
      return { fx: L.text && L.text.fx, str: L.text && L.text.str, yel, blu, x1 }; });
    const e1 = await lay();
    await p.keyboard.type("ND", { delay: 80 });
    await p.waitForTimeout(250);
    const e2 = await lay();
    await p.waitForTimeout(1200);
    const e3 = await lay();
    check("image editor: Presets ▾ in the Type tool's bar (Trend Candy 3D) - new text is typed THROUGH it: yellow face, blue side, live (the picture widens as letters come)",
      e1.fx === "psd:trend-candy-3d" && e1.yel > 500 && e1.blu > 100 && e3.str === "TREND" && e3.x1 > e1.x1 + 60, { e1, e2, e3 });
    await p.keyboard.press("Control+Enter"); await p.waitForTimeout(300);
    const pp = await ev(() => { const r = document.querySelector("#ppTFxRow .tfx-sel"); return r ? r.value : null; });
    check("...its Properties show the same Preset (change it there too)", pp === "psd:trend-candy-3d", pp);
    const flatY = await ev(() => { const c = window.imageEditorInstance.E.flatten(), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 220 && d[i + 1] > 150 && d[i + 2] < 90) n++; return n; });
    check("...the picture (flattened - what Save / Send writes) has the effect", flatY > 1000, flatY);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { if (imported) await api("/api/textfx/presets/" + encodeURIComponent(imported.id), "DELETE"); } catch { /* fine */ }
    try { await ev(() => { tl.images = []; tlSave(); }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(FIX, { force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
