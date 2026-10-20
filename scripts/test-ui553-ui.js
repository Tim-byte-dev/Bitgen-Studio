#!/usr/bin/env node
/* bitGen Studio — 2.553.0 in a REAL browser: Generate / Remove in a selection through the EDIT model (the selection painted
 * green, Krita's instruction, under the noise mask); 👁 off = the style itself; an Edit of a layer with transparent parts
 * changes only its pixels and keeps its outline (ext/imageeditdock/imageedit.js, pcpromptlink.js, routes/aiedit.js,
 * lib/aiEdit.js). Tim: "fill and generate don't work - they generate a full image in the selection, edit works but it
 * redraws the entire layer and fills in the edges to fill the canvas size". Against the running app (H3_URL). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.553.0 browser test did not run"); process.exit(0); }
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
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#e03020"; g.fillRect(350, 250, 100, 100); window.imageEditorInstance.load(c.toDataURL("image/png"), "f553"); setTimeout(ok, 700); }));
    await p.waitForFunction(() => { const E = window.imageEditorInstance.E; return E.S.engines && (E.S.engines.edit || []).length; }, null, { timeout: 20000 });
    const ids = await ev(() => { const e = window.imageEditorInstance.E.S.engines; const k = (e.inpaint || []).find((x) => /^Krea 2 Turbo$/.test(x.name)), q = (e.edit || []).find((x) => /^Qwen Image Edit 2511/.test(x.name)); return { krea: k && k.id, qwen: q && q.id, latent: k && k.latent }; });
    check("the engines list says Krea 2 is a 'latent' fill (no inpaint training)", ids.krea && ids.latent === true && !!ids.qwen, ids);

    // a stub AI that records what was sent (the crop's middle pixel and the request)
    const run = (mode, fillEdit) => ev(async ({ mode, fillEdit, ids }) => {
      const E = window.imageEditorInstance.E; window.__rq = null;
      E.api.aiedit = async (req) => { const im = await createImageBitmap(req.crop); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        window.__rq = { fill_edit: req.fill_edit || "", edit_style_id: req.edit_style_id || "", fill_kind: req.fill_kind || "", style_id: req.style_id, mid: Array.from(g.getImageData(im.width >> 1, im.height >> 1, 1, 1).data) }; return { jobs: [] }; };
      document.getElementById("kxSee").checked = fillEdit; document.getElementById("kxSee").onchange();
      if (document.getElementById("kxFillMode")) { document.getElementById("kxFillMode").value = "fill"; document.getElementById("kxFillMode").onchange(); }   // 2.555.0: Krita's Fill (green)
      document.getElementById("ieEditStyle").value = ids.qwen;
      E.S.active = 0; E.renderLayersPanel(); E.setAiMode(mode);
      const m = new Uint8Array(E.S.w * E.S.h); for (let y = 260; y < 340; y++) for (let x = 360; x < 440; x++) m[y * E.S.w + x] = 255; E.setSel(m, true);
      await E.runAI({ prompt: "a yellow flower", style: ids.krea, into: false, whole: false, direct: true, label: "✨ " + mode });
      return window.__rq;
    }, { mode, fillEdit, ids });
    const g1 = await run("generate", true);
    check("Generate in a selection with Krea 2 (👁 on): through the EDIT model (Qwen Image Edit 2511) - fill_edit, the kind; the selection painted GREEN in the crop (Krita)",
      g1 && g1.fill_edit === "1" && g1.edit_style_id === ids.qwen && g1.fill_kind === "generate" && g1.mid[0] === 0 && g1.mid[1] === 255 && g1.mid[2] === 0, g1);
    const r1 = await run("remove", true);
    check("Remove through the edit model keeps the pixels (the instruction says what to do) - no green, no pre-fill", r1 && r1.fill_edit === "1" && r1.fill_kind === "remove" && r1.mid[0] > 200 && r1.mid[1] < 80, r1);
    const g0 = await run("generate", false);
    check("👁 off: the style itself fills (no fill_edit, no green)", g0 && g0.fill_edit === "" && g0.style_id === ids.krea && !(g0.mid[1] === 255 && g0.mid[0] === 0), g0);
    await ev(() => { document.getElementById("kxSee").checked = true; document.getElementById("kxSee").onchange(); });

    // the server: fill_edit -> the edit graph under the mask, Krita's instruction
    const srv = await ev(async (ids) => {
      const c = document.createElement("canvas"); c.width = 64; c.height = 64; const bl = await new Promise((r) => c.toBlob(r, "image/png"));
      const fd = new FormData(); fd.append("crop", bl, "c.png"); fd.append("mask", bl, "m.png"); fd.append("rgba", bl, "r.png"); fd.append("mode", "generate"); fd.append("prompt", "a yellow flower");
      fd.append("style_id", ids.krea); fd.append("fill_edit", "1"); fd.append("edit_style_id", ids.qwen); fd.append("fill_kind", "generate");
      fd.append("width", "64"); fd.append("height", "64"); fd.append("count", "1");
      const r = await fetch("/api/aiedit", { method: "POST", body: fd }); const o = await r.json();
      return { status: r.status, workflow: o.workflow, edit_fill: o.edit_fill, style_name: o.style_name, soft: o.soft, input: o.input, note: o.note, err: o.error };
    }, ids);
    let gok = false, gInfo = null;
    try { const G = JSON.parse(fs.readFileSync(srv.workflow, "utf8")); gInfo = Object.values(G).map((n) => n.class_type); gok = G["2"] && G["2"].class_type === "LoadImage" && gInfo.includes("SetLatentNoiseMask") && gInfo.includes("TextEncodeQwenImageEditPlus"); } catch (e) { gInfo = String(e.message); }
    check("/api/aiedit fill_edit: Krea 2 asked, Qwen Image Edit 2511 fills - its edit graph under the noise mask (crop + mask, soft)",
      srv.status === 200 && srv.edit_fill === "generate" && /Qwen Image Edit 2511/.test(srv.style_name || "") && srv.soft === true && srv.input === "crop+mask" && /-edit\.json$/.test(srv.workflow || "") && gok, { srv, gInfo });

    // ▾ Edit of a layer with transparent parts: only its pixels, its outline kept
    const le = await ev(async () => {
      const E = window.imageEditorInstance.E; E.deselect && E.deselect();
      E.newLayer(); const L = E.layer(); const g = L.canvas.getContext("2d"); g.fillStyle = "#00c000"; g.fillRect(100, 100, 200, 100); E.refresh();
      window.__rq = null;
      E.api.aiedit = async (req) => { const im = await createImageBitmap(req.crop); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const cg = c.getContext("2d"); cg.drawImage(im, 0, 0);
        window.__rq = { whole: req.whole || "", w: im.width, h: im.height, corner: Array.from(cg.getImageData(1, 1, 1, 1).data), mode: req.mode };
        const o = document.createElement("canvas"); o.width = im.width; o.height = im.height; const og = o.getContext("2d"); og.fillStyle = "#ff00ff"; og.fillRect(0, 0, o.width, o.height); window.__ans = o.toDataURL("image/png");
        return { jobs: [{ id: "stub", seed: 1 }], soft: true }; };
      E.api.awaitResult = async () => window.__ans;
      E.setAiMode("edit");
      const had = new Set(E.S.layers);
      document.getElementById("prompt").value = "make it purple";
      const PLs = window.PCPromptLink, act = PLs.actionFor({ genMode: "image", onScreen: true, open: true, aiShown: true, mode: "edit", op: "edit", hasSel: false });
      // what ▾ Edit does for the selected layer (pcpromptlink takeOp - kind "layer")
      const c = E.layerPicture(L), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, am = new Uint8Array(c.width * c.height);
      for (let i = 0; i < am.length; i++) am[i] = d[i * 4 + 3];
      await E.runAI({ prompt: "make it purple", source: c, whole: false, sel: am, clip: true, into: false, direct: true, keep: L, label: "✏ layer edit" });
      const N = E.S.layers.find((x) => !had.has(x)), ng = N && N.canvas.getContext("2d"), px = (x, y) => Array.from(ng.getImageData(x, y, 1, 1).data);
      return { act: act.kind, rq: window.__rq, inside: N && px(200, 150), edge: N && px(305, 150), out: N && px(50, 50), out2: N && px(200, 230) };
    });
    check("▾ Edit of a layer with transparent parts: only its pixels go (not the whole canvas), its transparent surroundings filled with its own colours (no black edges for the model)",
      le.act === "layer" && le.rq && le.rq.whole === "" && le.rq.w < 800 && le.rq.corner[3] === 255 && le.rq.corner[1] > 150, le);
    check("...the result keeps the layer's outline: inside it the edit, outside it nothing (no new edges filling the canvas)",
      le.inside && le.inside[0] === 255 && le.inside[3] === 255 && le.edge[3] === 0 && le.out[3] === 0 && le.out2[3] === 0, le);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
