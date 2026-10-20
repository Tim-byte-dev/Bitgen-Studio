#!/usr/bin/env node
/* bitGen Studio — 2.554.0 in a REAL browser: a style that cannot see around a selection (Krea 2, 👁 off / no edit model)
 * makes its picture at the SELECTION'S box, so what it draws is the selection's size (ext/imageeditdock/imageedit.js
 * fitSel). Tim: "i think it doesn't know to resize it to the size of the selection - it works if i use qwen2.1 and say
 * transparent background, but the size is not right for the selection". Against the running app (H3_URL). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.554.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.runAI, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#e03020"; g.fillRect(350, 250, 100, 100); window.imageEditorInstance.load(c.toDataURL("image/png"), "f554"); setTimeout(ok, 700); }));
    await p.waitForFunction(() => { const E = window.imageEditorInstance.E; return E.S.engines && (E.S.engines.edit || []).length; }, null, { timeout: 20000 });
    const ids = await ev(() => { const e = window.imageEditorInstance.E.S.engines; const k = (e.inpaint || []).find((x) => /^Krea 2 Turbo$/.test(x.name)), q = (e.edit || []).find((x) => /^Qwen Image Edit 2511/.test(x.name)); return { krea: k && k.id, qwen: q && q.id, latent: k && k.latent }; });
    check("the engines list says Krea 2 is a 'latent' fill (no inpaint training)", ids.krea && ids.latent === true && !!ids.qwen, ids);

    // a stub AI: records the crop's size and answers with a picture that is a red disc filling ITS whole frame
    const run = (fillEdit) => ev(async ({ fillEdit, ids }) => {
      const E = window.imageEditorInstance.E; window.__rq = null;
      E.api.aiedit = async (req) => { const im = await createImageBitmap(req.crop);
        window.__rq = { cw: im.width, ch: im.height, w: req.width, h: req.height, fill_edit: req.fill_edit || "" };
        const o = document.createElement("canvas"); o.width = im.width; o.height = im.height; const g = o.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, o.width, o.height);
        g.fillStyle = "#ff0000"; g.beginPath(); g.ellipse(o.width / 2, o.height / 2, o.width * 0.4, o.height * 0.4, 0, 0, 7); g.fill(); window.__ans = o.toDataURL("image/png");
        return { jobs: [{ id: "stub", seed: 1 }], soft: true }; };
      E.api.awaitResult = async () => window.__ans;
      document.getElementById("kxSee").checked = fillEdit; document.getElementById("kxSee").onchange();
      document.getElementById("ieEditStyle").value = ids.qwen;
      E.S.active = 0; E.renderLayersPanel(); E.setAiMode("generate");
      const m = new Uint8Array(E.S.w * E.S.h); for (let y = 200; y < 400; y++) for (let x = 300; x < 500; x++) m[y * E.S.w + x] = 255; E.setSel(m, true);
      const had = new Set(E.S.layers);
      await E.runAI({ prompt: "a red ball", style: ids.krea, into: false, whole: false, direct: true, label: "✨ generate" });
      const N = E.S.layers.find((x) => !had.has(x)), ng = N && N.canvas.getContext("2d"), px = (x, y) => Array.from(ng.getImageData(x, y, 1, 1).data);
      return { rq: window.__rq, mid: N && px(400, 300), corner: N && px(306, 206) };
    }, { fillEdit, ids });
    const a = await run(false);
    check("👁 off with Krea 2 (it cannot see around the selection): its picture is made at the SELECTION'S box (+ the soft edge's room), not a 3x bigger region - what it draws is the selection's size",
      a.rq && a.rq.fill_edit === "" && a.corner && a.corner[0] > 200 && a.corner[1] > 200 && a.corner[3] === 255, a);
    check("...rendered at the model's size (>= 0.75 MP) and scaled back; the drawn disc sits in the selection (red in the middle, white in its corner - the whole picture fits it)",
      a.rq && a.rq.w * a.rq.h >= 0.7 * 1048576 && a.mid && a.mid[0] > 200 && a.mid[1] < 60, a);
    const b2 = await run(true);
    check("👁 on: the edit model fills - it gets the wider region (about 512 px - it sees the picture round the green selection)", b2.rq && b2.rq.fill_edit === "1" && b2.rq.cw >= 500, b2.rq);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
