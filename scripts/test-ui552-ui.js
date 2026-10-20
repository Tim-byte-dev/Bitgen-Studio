#!/usr/bin/env node
/* bitGen Studio — 2.552.0 in a REAL browser: a selection filled / edited the way the Krita AI plugin's own code does it
 * (ext/imageeditdock/imageedit.js, lib/inpaintLatent.js, lib/aiEdit.js, routes/aiedit.js):
 *   - a small selection's region rendered bigger, Krita's mask sizes sent with it
 *   - a "soft" answer (the graph kept what is around) blended out past the selection's edge, colour-matched to the picture
 *   - an Edit in a selection runs the edit graph with the picture as its starting latent under the mask
 * Tim: "this is krita's ai code i downloaded". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.552.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.runAI, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#e03020"; g.fillRect(350, 250, 100, 100); window.imageEditorInstance.load(c.toDataURL("image/png"), "f552"); setTimeout(ok, 700); }));

    // a stub AI: the answer = the region sent, 40 brighter everywhere (as a model that drifted), soft as asked
    const run = (soft) => ev(async (soft) => {
      const E = window.imageEditorInstance.E; window.__rq = null;
      E.api.aiedit = async (req) => {
        const im = await createImageBitmap(req.crop); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { d.data[i] += 40; d.data[i + 1] += 40; d.data[i + 2] += 40; } g.putImageData(d, 0, 0);
        window.__ans = c.toDataURL("image/png");
        window.__rq = { mode: req.mode, w: req.width, h: req.height, grow: req.mask_grow, feather: req.mask_feather, whole: req.whole || "" };
        return { jobs: [{ id: "stub", seed: 1 }], soft };
      };
      E.api.awaitResult = async () => window.__ans;
      E.S.active = 0; E.renderLayersPanel(); E.setAiMode("generate");
      const m = new Uint8Array(E.S.w * E.S.h); for (let y = 260; y < 340; y++) for (let x = 360; x < 440; x++) m[y * E.S.w + x] = 255; E.setSel(m, true);
      const before = E.S.layers.length, had = new Set(E.S.layers);
      await E.runAI({ prompt: "a yellow flower", into: false, whole: false, direct: true, label: "✨ generate" });
      const L = E.S.layers.find((x) => !had.has(x)), g = L.canvas.getContext("2d");
      const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
      return { rq: window.__rq, added: E.S.layers.length - before, inside: px(400, 300), edge5: px(355, 300), out20: px(340, 300), out120: px(240, 300) };
    }, soft);

    const a = await run(true);
    check("an 80 px selection: its ~512 px region is RENDERED bigger (>= 0.75 MP, as Krita renders at the model's size)", a.rq && a.rq.w >= 800 && a.rq.h >= 800, a.rq);
    check("...Krita's mask sizes go along in the render's pixels (feather 32 px, grow 20 px in the picture -> about 1.7x)", a.rq && a.rq.feather >= 48 && a.rq.feather <= 64 && a.rq.grow >= 30 && a.rq.grow <= 40 && a.rq.whole === "", a.rq);
    check("a soft answer (the graph kept what is around): fully in inside the selection, blended out PAST its edge (5 px and 20 px outside), nothing far away",
      a.added === 1 && a.inside[3] === 255 && a.edge5[3] > 0 && a.out20[3] > 0 && a.out120[3] === 0, a);
    check("...colour-matched: around the selection the answer is the picture's blue again (the model's +40 drift taken out)",
      Math.abs(a.out20[0] - 0x30) <= 6 && Math.abs(a.out20[1] - 0x60) <= 6 && Math.abs(a.out20[2] - 0xc0) <= 6, a.out20);
    const b2 = await run(false);
    check("a whole-crop answer (not soft): kept inside the selection as before - nothing past its edge", b2.added === 1 && b2.inside[3] === 255 && b2.edge5[3] === 0 && b2.out20[3] === 0, b2);

    // the server: an Edit inside a selection = the edit graph with the picture as the starting latent + the mask
    const srv = await ev(async () => {
      const j = await (await fetch("/api/styles?kind=image")).json(); const st = (j.styles || []).find((s) => /^Qwen Image Edit 2511/i.test(s.name)) || (j.styles || []).find((s) => /qwen.*edit/i.test(s.name));
      if (!st) return null;
      const c = document.createElement("canvas"); c.width = 64; c.height = 64; const bl = await new Promise((r) => c.toBlob(r, "image/png"));
      const go = async (whole) => {
        const fd = new FormData(); fd.append("crop", bl, "c.png"); fd.append("mask", bl, "m.png"); fd.append("rgba", bl, "r.png"); fd.append("mode", "edit"); fd.append("prompt", "make it red"); fd.append("style_id", st.id);
        fd.append("width", "64"); fd.append("height", "64"); fd.append("count", "1"); fd.append("mask_grow", "12"); fd.append("mask_feather", "20"); if (whole) fd.append("whole", "1");
        const r = await fetch("/api/aiedit", { method: "POST", body: fd }); const o = await r.json();
        return { status: r.status, workflow: o.workflow, input: o.input, soft: o.soft, note: o.note, err: o.error };
      };
      return { name: st.name, sel: await go(false), whole: await go(true) };
    });
    if (srv) {
      check(`/api/aiedit Edit (${srv.name}) in a selection: its graph with the picture as the starting latent + the mask (-edit.json, crop + mask, soft)`,
        srv.sel.status === 200 && /-edit\.json$/.test(srv.sel.workflow || "") && srv.sel.input === "crop+mask" && srv.sel.soft === true && /only the selection changes/.test(srv.sel.note || ""), srv.sel);
      check("...with nothing selected (whole) the edit runs as before", srv.whole.status === 200 && !/-edit\.json$/.test(srv.whole.workflow || "") && srv.whole.soft === false, srv.whole);
    } else console.log("SKIP: no Qwen Image Edit style here");
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
