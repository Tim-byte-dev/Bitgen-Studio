#!/usr/bin/env node
/* bitGen Studio — the image editor in a REAL browser (2.332.0).
 *
 * The canvas work (brush dabs, selection clipping, layers, the AI results as
 * layers) cannot run in jsdom, so this drives Chromium through Playwright
 * against the running app (H3_URL, default the e2e server on :8311, with the
 * stub ComfyUI behind it). No Playwright on this machine = SKIP (exit 0):
 * the unit tests (scripts/test-aiedit.js) still cover the maths.
 *   node scripts/test-imageeditor-ui.js
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the editor's browser test did not run"); process.exit(0); }

const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 400))); }
};

(async () => {
  const pic = path.join(os.tmpdir(), "ieui_test.png");
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x4682b4:s=640x400", "-frames:v", "1", pic]);
  const b = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? undefined : undefined });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    // 2.345.0: the editor dock opens NORMAL - an earlier leg (or a user) may
    // have left it minimized in dockers.json, which hid its layer buttons
    try {
      // 2.381.0: docker_status.json is the layout record
      await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) });
    } catch { /* an older server: carry on */ }
    // 2.376.0: the boot applies the saved layout (/api/ui/layout) and the dockers' states (/api/dockers) ASYNC; under
    // the e2e's load they could land MID-TEST and close / un-maximize the dock under test (the editor test's
    // intermittent "element is not visible" on ⛶ / ✔ Apply / ＋). Wait for both answers before touching anything.
    // 2.381.0: ONE record now (docker_status.json, in the page's head) - wait until the boot has applied it (dsReady)
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 }).catch(() => null);
    await p.waitForTimeout(600);
    await p.waitForFunction(() => window.imageEditorInstance && typeof window.imageEditorInstance.load === "function", null, { timeout: 20000 });
    // 2.375.1: the saved layout / dockers state lands ASYNC after boot - under the e2e's load it could collapse the
    // dock AFTER this check, and a later click waited 30 s on a hidden button (#kxFull / #kxApply). Let it land,
    // then open the dock - and again before the clicks that need it.
    await p.waitForTimeout(1500);
    const ensureOpen = async () => {
      for (let i = 0; i < 3; i++) {
        if (!/dockgone|collapsed/.test(await p.evaluate(() => document.getElementById("imageeditdock").className))) return;
        await p.click("#tIE"); await p.waitForTimeout(400);
      }
    };
    await ensureOpen();
    await p.setInputFiles("#ieFile", pic);
    await p.waitForFunction(() => window.imageEditorInstance.state.w === 640, null, { timeout: 10000 });
    await ensureOpen();
    await p.click("#kxFull"); await p.waitForTimeout(800);
    const S = () => p.evaluate(() => { const s = window.imageEditorInstance.state; return { zoom: s.zoom, panX: s.panX, panY: s.panY, sel: s.selCount, layers: s.layers.length, undo: s.undo.length, active: s.active }; });
    let s = await S();
    const st = await p.locator("#ieStage").boundingBox();
    check("the picture opens as the Background layer, fitted in the stage", s.layers === 1 && s.zoom > 0.3 && st && st.width > 600, s);
    const T = (x, y) => [st.x + s.panX + x * s.zoom, st.y + s.panY + y * s.zoom];
    const drag = async (a, c, steps = 12) => { await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...c, { steps }); await p.mouse.up(); await p.waitForTimeout(120); };
    await drag(T(200, 100), T(440, 300));
    s = await S();
    check("rectangle select: ~240x200 px selected, one undo step", s.sel >= 238 * 198 && s.sel <= 242 * 202 && s.undo === 1, s);
    const base = await p.evaluate(() => Array.from(window.imageEditorInstance.state.layers[0].canvas.getContext("2d").getImageData(150, 200, 1, 1).data));
    const near = (a, c) => a.slice(0, 3).every((v, i) => Math.abs(v - c[i]) <= 3);
    await p.keyboard.press("b");
    await drag(T(100, 200), T(540, 200), 30);
    const px = await p.evaluate(() => { const g = window.imageEditorInstance.state.layers[0].canvas.getContext("2d");
      return [Array.from(g.getImageData(150, 200, 1, 1).data), Array.from(g.getImageData(320, 200, 1, 1).data)]; });
    check("the brush paints only INSIDE the selection", near(px[0], base) && px[1][0] < 60 && px[1][2] < 60, [base, px]);
    await p.keyboard.press("Control+z");
    const un = await p.evaluate(() => Array.from(window.imageEditorInstance.state.layers[0].canvas.getContext("2d").getImageData(320, 200, 1, 1).data));
    await p.keyboard.press("Control+Shift+z");
    const re = await p.evaluate(() => Array.from(window.imageEditorInstance.state.layers[0].canvas.getContext("2d").getImageData(320, 200, 1, 1).data));
    check("undo takes the stroke back, redo puts it back", near(un, base) && re[0] < 60, [un, re]);
    await p.click("#kxPreset"); await p.waitForTimeout(300);
    const n = await p.evaluate(() => document.querySelectorAll(".kxpop .pb").length);
    check("the brush preset picker shows 20 presets with their stroke previews", n === 20, n);
    await p.evaluate(() => [...document.querySelectorAll(".kxpop .pb")].find((x) => /Chalk/.test(x.textContent)).click());
    check("choosing Chalk makes it the brush", await p.evaluate(() => window.imageEditorInstance.state.preset) === "chalk");
    await p.click("#kxLAdd"); s = await S();
    check("a new layer lands above the active one and becomes active", s.layers === 2 && s.active === 1, s);
    await p.click("#kxLMerge"); s = await S();
    check("merge down leaves one layer", s.layers === 1, s);
    // ✨ Edit with Qwen: the whole flow against the stub ComfyUI
    // 2.389.0: the ✨ AI panel is a tab of the Properties group (the Photoshop layout)
    await p.evaluate(() => window.imageEditorInstance.E.ui.showTab("kxAi"));
    await p.click('#kxModes button[data-mode="edit"]');
    const qid = await p.evaluate(() => { const o = [...document.querySelectorAll("#ieEditStyle option")].find((x) => /Qwen Image Edit/.test(x.textContent)); return o ? o.value : ""; });
    check("the Edit model list offers Qwen Image Edit 2511", !!qid);
    // 2.451.0: the Edit tab drives the PROMPT DOCKER (its model row is gone) - the edit model is the prompt docker's style
    await p.evaluate((v) => { const s = document.getElementById("styleSel"); s.value = v; if (s.onchange) s.onchange(); }, qid);
    await p.evaluate((v) => { const e = document.getElementById("prompt"); e.value = v; e.dispatchEvent(new Event("input")); }, "make the sky stormy");   // 2.419.0: the tool reads the prompt docker
    await p.selectOption("#kxCount", "2");
    await p.evaluate(() => runGenerate());   // 2.451.0: the prompt docker's ✏ Edit (the panel's own button is gone)
    await p.waitForFunction(() => { const r = window.imageEditorInstance.state.results; return r.length === 2 && r.every((x) => x.layer || x.failed); }, null, { timeout: 120000 });
    const rs = await p.evaluate(() => window.imageEditorInstance.state.results.map((r) => ({ ok: !!r.layer, seed: r.seed })));
    check("Edit x2: two results came back, next seeds, the first previewed", rs.length === 2 && rs.every((r) => r.ok) && rs[1].seed === rs[0].seed + 1
      && await p.evaluate(() => !!window.imageEditorInstance.state.preview), rs);
    const inside = await p.evaluate(() => { const r = window.imageEditorInstance.state.results[0].layer.getContext("2d");
      return [r.getImageData(320, 200, 1, 1).data[3], r.getImageData(20, 20, 1, 1).data[3]]; });
    check("the result layer holds the model's pixels inside the selection only (feathered), nothing outside", inside[0] === 255 && inside[1] === 0, inside);
    if (!(await p.locator("#kxApply").isVisible())) await ensureOpen();
    await p.click("#kxApply"); s = await S();
    check("✔ Apply keeps it as a new layer (undoable)", s.layers === 2 && await p.evaluate(() => window.imageEditorInstance.state.layers[1].name.startsWith("✨ edit")), s);
    await p.click("#kxUndo"); s = await S();
    check("...and undo removes it again", s.layers === 1, s);
    // Expand: the canvas grows and the new strip is selected
    await p.selectOption("#kxExpSide", "right"); await p.fill("#kxExpPx", "128"); await p.click("#kxExpand");
    const ex = await p.evaluate(() => { const s = window.imageEditorInstance.state; return { w: s.w, h: s.h, sel: s.selCount, mode: s.aiMode }; });
    check("Expand right by 128: 768x400, the new 128 px strip selected, Generate ready", ex.w === 768 && ex.h === 400 && ex.sel === 128 * 400 && ex.mode === "generate", ex);
    // ◈ 2.333.0: a Depth control layer made "From image", riding a Generate
    await p.evaluate(() => window.imageEditorInstance.E.ui.showTab("kxCtl"));
    await p.selectOption("#kxCtlType", "depth"); await p.click("#kxCtlAdd"); await p.waitForTimeout(200);
    await p.click("#kxCtlList .fi");
    await p.waitForFunction(() => { const L = window.imageEditorInstance.state.layers.find((x) => x.control);
      return L && L.canvas.getContext("2d").getImageData(300, 200, 1, 1).data[3] > 0; }, null, { timeout: 90000 });
    check("◈ a Depth control layer filled ⟲ From image (the preprocessor job) and it is not part of the picture",
      await p.evaluate(() => { const e = window.imageEditorInstance; const f = e.flatten().getContext("2d").getImageData(300, 200, 1, 1).data;
        const bg = e.state.layers[0].canvas.getContext("2d").getImageData(300, 200, 1, 1).data; return f[0] === bg[0] && f[1] === bg[1] && f[2] === bg[2]; }));
    await p.evaluate(() => { const L = window.imageEditorInstance.state.layers.find((x) => x.control); L.control.model = "e2e_cn_depth.safetensors"; L.control.start = 0.2; });
    await p.evaluate(() => window.imageEditorInstance.E.ui.showTab("kxAi"));
    await p.click('#kxModes button[data-mode="generate"]');
    const sdx = await p.evaluate(() => { const o = [...document.querySelectorAll("#ieStyle option")].find((x) => x.textContent === "SDXL"); return o ? o.value : ""; });
    await p.selectOption("#ieStyle", sdx); await p.selectOption("#kxCount", "1"); await p.evaluate((v) => { const e = document.getElementById("prompt"); e.value = v; e.dispatchEvent(new Event("input")); }, "more of the sky");   // 2.419.0: the tool reads the prompt docker
    await p.evaluate(() => runGenerate());   // 2.451.0: the prompt docker's ✨ Generate
    await p.waitForFunction(() => { const r = window.imageEditorInstance.state.results; return r.length === 1 && (r[0].layer || r[0].failed); }, null, { timeout: 120000 });
    const jp = await p.evaluate(async () => { const id = window.imageEditorInstance.state.results[0].id; return (await (await fetch("/api/jobs/" + id)).json()).params; });
    check("◈ Generate carried the control layer: depth, the model picked on the layer, start 20 %, ControlNet on the job",
      jp && jp.aiedit_controls && jp.aiedit_controls.length === 1 && jp.aiedit_controls[0].type === "depth"
      && jp.aiedit_controls[0].model === "e2e_cn_depth.safetensors" && jp.aiedit_controls[0].start === 0.2
      && await p.evaluate(() => !!window.imageEditorInstance.state.results[0].layer), jp && jp.aiedit_controls);
    await p.click("#kxDiscard");
    // 🎚 / ✦ 2.333.0: Pixelate inside a selection, Invert + Ctrl+F repeat
    await p.evaluate(() => { const e = window.imageEditorInstance; e.state.active = 0; e.changeSel(e.P.rectMask(100, 100, 300, 300, e.state.w, e.state.h), "t"); });
    const b0 = await p.evaluate(() => { const g = window.imageEditorInstance.state.layers[0].canvas.getContext("2d"); return [Array.from(g.getImageData(150, 150, 1, 1).data), Array.from(g.getImageData(20, 20, 1, 1).data)]; });
    await p.evaluate(() => window.imageEditorInstance.openFilter("gaussian"));
    await p.waitForSelector(".kxdlg");
    check("✦ a filter opens its dialog with its sliders", await p.evaluate(() => document.querySelectorAll(".kxdlg input[type=range]").length) === 1);
    await p.click(".kxdlg .cn");
    // 2.389.0: Image ▸ Adjustments ▸ Invert (the menu bar)
    await p.click("#kxAdj"); await p.hover(".kxmenu div.sub"); await p.waitForTimeout(150);
    await p.click('.kxmenu [data-cmd="adj.invert"]');
    const b1 = await p.evaluate(() => { const g = window.imageEditorInstance.state.layers[0].canvas.getContext("2d"); return [Array.from(g.getImageData(150, 150, 1, 1).data), Array.from(g.getImageData(20, 20, 1, 1).data)]; });
    check("🎚 Invert changes the selection only", b1[0][0] === 255 - b0[0][0] && b1[1].join() === b0[1].join(), [b0, b1]);
    await p.locator("#ieStage").focus();
    await p.keyboard.press("Control+f");
    const b2 = await p.evaluate(() => Array.from(window.imageEditorInstance.state.layers[0].canvas.getContext("2d").getImageData(150, 150, 1, 1).data));
    check("Ctrl+F repeats it (inverted back)", b2.join() === b0[0].join(), [b0[0], b2]);
    await p.keyboard.press("Control+z");
    check("...and Ctrl+Z undoes the repeat", await p.evaluate(() => window.imageEditorInstance.state.layers[0].canvas.getContext("2d").getImageData(150, 150, 1, 1).data[0]) === b1[0][0]);
  } catch (e) { check("the browser run finished", false, e.message); }
  check("no page errors", !errs.length, errs);
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
