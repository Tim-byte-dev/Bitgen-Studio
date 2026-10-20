#!/usr/bin/env node
/* bitGen Studio — 2.551.0 in a REAL browser: Free Transform's MIDDLE handles skew (the skew cursor; Shift = stretch), and a
 * selection filled the Krita-AI way - more context, the selection pre-filled with the colours around it, a soft grown mask,
 * a start just below full noise (ext/imageeditdock/imageedit.js, pctools.js, lib/inpaintLatent.js, lib/aiEdit.js).
 * Tim: "when user hovers over middle handle in image-editor, change tranform icon to skew then skew like photoshop instead
 * of rotate. can you check to see how https://github.com/Acly/krita-ai-diffusion does the fill ... kritas works well but
 * ours just generates random images".
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.551.0 browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.startTransform, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#e03020"; g.fillRect(350, 250, 100, 100); window.imageEditorInstance.load(c.toDataURL("image/png"), "f551"); setTimeout(ok, 700); }));
    const TT = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods) => { const [a, c] = await TT(x0, y0), [d, e] = await TT(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(150); };

    /* 1 the middle handles skew */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); const g = E.layer().canvas.getContext("2d"); g.fillStyle = "#0f0"; g.fillRect(100, 100, 200, 100); E.refresh(); });
    await p.locator("#ieStage").focus(); await p.keyboard.press("Control+t"); await p.waitForTimeout(200);
    const [hx, hy] = await TT(200, 200);
    await p.mouse.move(hx, hy); await p.waitForTimeout(150);
    const cur = await ev(() => document.getElementById("ieStage").style.cursor);
    check("hovering the bottom MIDDLE handle shows the skew cursor (a slanted arrow), not rotate", /data:image\/svg\+xml/.test(cur) && /ew-resize/.test(cur), cur.slice(0, 60));
    await drag(200, 200, 240, 200);
    const k1 = await ev(() => ({ kx: +document.getElementById("ptXkx").value, w: +document.getElementById("ptXw").value }));
    check("dragging it (no key) SKEWS sideways like Photoshop - the width stays 100 %", k1.kx > 15 && k1.w === 100, k1);
    await drag(300, 150, 340, 150, ["Shift"]);
    const k2 = await ev(() => ({ kx: +document.getElementById("ptXkx").value, ky: +document.getElementById("ptXky").value, w: +document.getElementById("ptXw").value }));
    check("Shift + the right middle handle stretches that side (the width grows, no vertical skew)", k2.w > 110 && k2.ky === 0, k2);
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);

    /* 2 a selection filled the Krita-AI way */
    const got = await ev(async () => {
      const E = window.imageEditorInstance.E; window.__rq = [];
      E.api.aiedit = async (req) => { const im = await createImageBitmap(req.crop); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const mid = Array.from(g.getImageData(Math.round(im.width / 2), Math.round(im.height / 2), 1, 1).data); window.__rq.push({ mode: req.mode, w: req.width, h: req.height, cw: im.width, ch: im.height, mid }); return { jobs: [] }; };
      E.S.active = 0; E.renderLayersPanel(); E.setAiMode("generate");
      const m = new Uint8Array(E.S.w * E.S.h); for (let y = 260; y < 340; y++) for (let x = 360; x < 440; x++) m[y * E.S.w + x] = 255; E.setSel(m, true);
      await E.runAI({ prompt: "a yellow flower", into: false, whole: false, direct: true, label: "✨ generate" });
      return window.__rq[0];
    });
    check("Generate in an 80 px selection sends a region about 512 px across (it was the selection + 64 px)", got && got.cw >= 400 && got.ch >= 400, got);
    check("...the selection PRE-FILLED with the colours around it (the red square under it is gone - blue-ish), not the old pixels", got && got.mid[2] > got.mid[0], got && got.mid);
    // the server: a style that was not trained to inpaint = its own graph, a soft mask, started at 0.9
    const srv = await ev(async () => {
      const j = await (await fetch("/api/styles?kind=image")).json(); const st = (j.styles || []).find((s) => /^Krea 2 Turbo$/.test(s.name)); if (!st) return null;
      const c = document.createElement("canvas"); c.width = 64; c.height = 64; const bl = await new Promise((r) => c.toBlob(r, "image/png"));
      const fd = new FormData(); fd.append("crop", bl, "c.png"); fd.append("mask", bl, "m.png"); fd.append("rgba", bl, "r.png"); fd.append("mode", "generate"); fd.append("prompt", "a yellow flower"); fd.append("style_id", st.id); fd.append("width", "64"); fd.append("height", "64"); fd.append("count", "1"); fd.append("strength", "100");
      const r = await fetch("/api/aiedit", { method: "POST", body: fd }); const o = await r.json();
      let g = null; try { g = o.workflow ? await (await fetch("/api/jobs/" + o.jobs[0].id)).json() : null; } catch (e) { g = null; }
      return { status: r.status, workflow: o.workflow, denoise: o.denoise, input: o.input, note: o.note };
    });
    if (srv) check("/api/aiedit with Krea 2 Turbo (not an inpaint model): its own graph made a fill graph, crop + mask, denoise 0.9", srv.status === 200 && /-fill\.json$/.test(srv.workflow || "") && srv.denoise === 0.9 && srv.input === "crop+mask" && /seamless fill/.test(srv.note || ""), srv);
    else console.log("SKIP: no Krea 2 Turbo style here");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
