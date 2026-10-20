#!/usr/bin/env node
/* bitGen Studio — 2.555.0 in a REAL browser: the Krita AI plugin's fill per family - Krita's context bounds, its fill modes
 * (Add content = grey, Fill = blur; with the edit model "Add the object to the scene." keeps the pixels, Fill paints them
 * green), a style with Krita's helper (Pony + Fooocus) fills itself and never goes through 👁, the engines list says what
 * is missing (ext/imageeditdock/imageedit.js, lib/kritaInpaint.js, routes/aiedit.js).
 * Tim: "is it possible to use the full krita ai technique ... pony, sdxl, illustrious, klein and flux" - "the add content
 * type works the best". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.555.0 browser test did not run"); process.exit(0); }
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
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#e03020"; g.fillRect(350, 250, 100, 100); window.imageEditorInstance.load(c.toDataURL("image/png"), "f555"); setTimeout(ok, 700); }));
    await p.waitForFunction(() => { const E = window.imageEditorInstance.E; return E.S.engines && (E.S.engines.edit || []).length; }, null, { timeout: 20000 });
    const ids = await ev(() => { const e = window.imageEditorInstance.E.S.engines; const k = (e.inpaint || []).find((x) => /^Krea 2 Turbo$/.test(x.name)), q = (e.edit || []).find((x) => /^Qwen Image Edit 2511/.test(x.name)); return { krea: k && k.id, qwen: q && q.id, latent: k && k.latent }; });
    check("the engines list says Krea 2 is a 'latent' fill (no inpaint training)", ids.krea && ids.latent === true && !!ids.qwen, ids);

    const run = (o) => ev(async (o) => {
      const E = window.imageEditorInstance.E; window.__rq = null;
      E.api.aiedit = async (req) => { const im = await createImageBitmap(req.crop); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        window.__rq = { fill_edit: req.fill_edit || "", fill_kind: req.fill_kind || "", style_id: req.style_id, w: im.width, h: im.height, mid: Array.from(g.getImageData(im.width >> 1, im.height >> 1, 1, 1).data) }; return { jobs: [] }; };
      document.getElementById("kxSee").checked = o.see; document.getElementById("kxSee").onchange();
      document.getElementById("kxFillMode").value = o.fill; document.getElementById("kxFillMode").onchange();
      document.getElementById("ieEditStyle").value = o.qwen;
      if (o.helper) { const it = (E.S.engines.inpaint || []).find((x) => x.id === o.style); if (it) { it.helper = "fooocus"; it.latent = false; } }
      E.S.active = 0; E.renderLayersPanel(); E.setAiMode("generate");
      const m = new Uint8Array(E.S.w * E.S.h); for (let y = 260; y < 340; y++) for (let x = 360; x < 440; x++) m[y * E.S.w + x] = 255; E.setSel(m, true);
      await E.runAI({ prompt: "a yellow flower", style: o.style, into: false, whole: false, direct: true, label: "✨ generate" });
      return Object.assign({ row: getComputedStyle(document.getElementById("kxRowFill")).display, def: document.getElementById("kxFillMode").options[0].value }, window.__rq);
    }, o);
    const ids2 = await ev(() => { const e = window.imageEditorInstance.E.S.engines; const p = (e.inpaint || []).find((x) => /^Pony$/.test(x.name)); return { pony: p && p.id }; });
    const a = await run({ see: true, fill: "add", style: ids2.pony, helper: true, qwen: ids.qwen });
    check("the fill row shows for Generate, Add content first; a style with Krita's helper (Pony + Fooocus) fills ITSELF even with 👁 on (no edit model)",
      a.row !== "none" && a.def === "add" && a.fill_edit === "" && a.style_id === ids2.pony, a);
    check("...Add content: Krita's context (a ~512 square round an 80 px selection, rendered >= 0.75 MP) and the selection pre-filled neutral GREY",
      a.w === a.h && a.w >= 800 && Math.abs(a.mid[0] - 127) <= 6 && Math.abs(a.mid[1] - 127) <= 6 && Math.abs(a.mid[2] - 127) <= 6, a);
    const b2 = await run({ see: true, fill: "fill", style: ids2.pony, helper: true, qwen: ids.qwen });
    check("...Fill: the selection pre-filled with a blur of what is there (inside the red square it stays red - not the grey of Add content)",
      b2.fill_edit === "" && !(Math.abs(b2.mid[0] - 127) <= 6 && Math.abs(b2.mid[1] - 127) <= 6) && b2.mid[0] > 150, b2);
    const c = await run({ see: true, fill: "add", style: ids.krea, qwen: ids.qwen });
    check("Krea 2 (no helper) + 👁 + Add content: through the edit model with kind add - the pixels kept (no green; the instruction says to add)", c.fill_edit === "1" && c.fill_kind === "add" && c.mid[0] > 180 && c.mid[1] < 90, c);
    const d = await run({ see: true, fill: "fill", style: ids.krea, qwen: ids.qwen });
    check("...Fill: kind generate, the selection painted green", d.fill_edit === "1" && d.fill_kind === "generate" && d.mid[0] === 0 && d.mid[1] === 255, d);
    const eng = await ev(async () => (await (await fetch("/api/aiedit/engines")).json()));
    check("/api/aiedit/engines says per style its helper and what ComfyUI is missing for the Krita way", eng.krita && Array.isArray(eng.krita.missing) && eng.krita.missing.length >= 1 && (eng.inpaint || []).every((x) => "helper" in x), eng.krita);
    await ev(() => { document.getElementById("kxFillMode").value = "add"; document.getElementById("kxFillMode").onchange(); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
