#!/usr/bin/env node
/* bitGen Studio — 2.834.0 in a REAL browser: Generate / Edit in the image editor the Krita AI way. Tim: "when in image-edit
 * mode and a selection has been made and prompt docker is in generate mode then generate the image inside of the
 * selection, if no selection is made generate the image to the full canvas size, in edit mode use inpaint or out paint or
 * fill like krita ai does".
 *   The ✨ AI panel hidden, the prompt docker on ✨ Generate + a selection -> rendered into the selection (a crop round it,
 *   the selection the mask) with the prompt docker's style; no selection -> the prompt docker's own Generate at the
 *   canvas's shape (H3ImageSize) and the picture over the whole canvas as a new layer (H3OnGenerated); ✏ Edit: Auto in the
 *   middle = Inpaint (the edit model in the selection), Fill / Outpaint = painted green for the edit model, Auto with empty
 *   canvas round the picture and no selection = outpaints the empty part; Outpaint with no room = nothing sent.
 *   The AI is a stub that records what was sent. Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.834.0 browser test did not run"); console.log("\nRESULT: 0 passed, 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.runAI, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    const load = (framed) => ev((framed) => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d");
      if (framed) { g.fillStyle = "#3060c0"; g.fillRect(200, 150, 400, 300); } else { g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#e03020"; g.fillRect(350, 250, 100, 100); }
      window.imageEditorInstance.load(c.toDataURL("image/png"), framed ? "f834b" : "f834"); setTimeout(ok, 700); }), framed);
    await load(false);
    await p.waitForFunction(() => { const E = window.imageEditorInstance.E; return E.S.engines && (E.S.engines.edit || []).length && window.H3ImgOp && E.aiFill && document.getElementById("pmEdFill"); }, null, { timeout: 20000 });
    const ids = await ev(() => { const e = window.imageEditorInstance.E.S.engines; const k = (e.inpaint || []).find((x) => /^Krea 2 Turbo$/.test(x.name)) || (e.inpaint || [])[0], q = (e.edit || []).find((x) => /^Qwen Image Edit 2511/.test(x.name)) || (e.edit || [])[0]; return { krea: k && k.id, qwen: q && q.id }; });
    // the stub AI + the prompt docker in 🖼 Image, the ✨ AI panel hidden
    await ev(() => {
      const E = window.imageEditorInstance.E;
      E.api.aiedit = async (req) => { const im = await createImageBitmap(req.crop), mk = await createImageBitmap(req.mask), c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data); const mid = px(im.width >> 1, im.height >> 1), corner = px(2, 2);
        g.clearRect(0, 0, c.width, c.height); g.drawImage(mk, 0, 0); const mmid = g.getImageData(im.width >> 1, im.height >> 1, 1, 1).data[3], mcorner = g.getImageData(2, 2, 1, 1).data[3];
        window.__rqs.push({ mode: req.mode, fill_edit: req.fill_edit || "", fill_kind: req.fill_kind || "", style_id: req.style_id, edit_style_id: req.edit_style_id || "", w: im.width, h: im.height, whole: req.whole || "", mid, corner, mmid, mcorner, prompt: req.prompt });
        return { jobs: [] }; };
      window.__rqs = [];
      const g = document.getElementById("genModeSel"); if (g.value !== "image") { g.value = "image"; if (g.onchange) g.onchange(); else g.dispatchEvent(new Event("change")); }
      document.getElementById("kxAi").classList.remove("on");
    });
    const sel = (x0, y0, x1, y1) => ev(([x0, y0, x1, y1]) => { const E = window.imageEditorInstance.E; const m = new Uint8Array(E.S.w * E.S.h); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * E.S.w + x] = 255; E.setSel(m, true); }, [x0, y0, x1, y1]);
    const go = (op, style, text, edfill) => ev(async ([op, style, text, edfill]) => {
      const E = window.imageEditorInstance.E; window.__rqs = []; E.S.busy = false;
      window.H3ImgOp.set(op); if (edfill) E.aiFill.setMode(edfill);
      const s = document.getElementById("styleSel"); if (style && [...s.options].some((o) => o.value === style)) s.value = style;
      document.getElementById("kxAi").classList.remove("on");
      const took = window.H3TakeGenerate("image", text);
      await new Promise((r) => setTimeout(r, 900));
      return { took, rq: window.__rqs[0] || null, n: window.__rqs.length };
    }, [op, style, text, edfill || null]);

    // ✨ Generate + a selection
    await sel(360, 260, 440, 340);
    const g1 = await go("generate", ids.krea, "a yellow flower");
    check("✨ Generate with a selection and the ✨ AI panel hidden: the editor renders INTO the selection (not the prompt docker's own Generate)", g1.took === true && g1.rq && g1.rq.mode === "generate" && !g1.rq.whole, g1);
    check("…a crop round the selection with the selection as the hole (the mask's middle open, its corner kept) - the prompt docker's style asked", g1.rq && g1.rq.mmid === 0 && g1.rq.mcorner === 255 && g1.rq.style_id === ids.krea && !(g1.rq.w === 800 && g1.rq.h === 600), g1.rq);

    // ✨ Generate, no selection: the canvas's shape, the picture over the whole canvas
    await ev(() => window.imageEditorInstance.E.deselect());
    const g2 = await go("generate", ids.krea, "a castle");
    const wh = await ev(() => window.H3ImageSize ? window.H3ImageSize({}) : null);
    check("✨ Generate with no selection: the prompt docker's own Generate (nothing sent to the editor's AI), asked at the canvas's shape (800 x 600 -> 4:3, 16-px steps)",
      g2.took === false && g2.n === 0 && wh && wh.width % 16 === 0 && Math.abs(wh.width / wh.height - 4 / 3) < 0.03, { g2, wh });
    const png = await ev(([w, h]) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#20a040"; g.fillRect(0, 0, w, h); return c.toDataURL("image/png").split(",")[1]; }, [wh.width, wh.height]);
    await p.route("**/outputs/t834.png*", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(png, "base64") }));
    const before = await ev(() => window.imageEditorInstance.E.S.layers.length);
    const n = await ev(() => window.H3OnGenerated({ outputs: ["t834.png"], text: "a castle" }));
    const top = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(), g = L.canvas.getContext("2d"); return { n: E.S.layers.length, w: L.canvas.width, h: L.canvas.height, tl: Array.from(g.getImageData(1, 1, 1, 1).data), br: Array.from(g.getImageData(798, 598, 1, 1).data) }; });
    check("…the picture it makes comes in as a NEW layer covering the WHOLE canvas (corner to corner)", n === 1 && top.n === before + 1 && top.w === 800 && top.tl[1] > 120 && top.tl[3] === 255 && top.br[3] === 255, top);

    // ✏ Edit
    await ev(() => { const E = window.imageEditorInstance.E; E.deleteLayer && E.deleteLayer(); });
    await sel(360, 260, 440, 340);
    const e1 = await go("edit", ids.qwen, "make it green", "auto");
    check("✏ Edit Auto, a selection inside the picture = Inpaint: the edit model follows the instruction in the selection (what is there kept)", e1.took === true && e1.rq && e1.rq.mode === "edit" && e1.rq.mid[0] > 150, e1.rq);
    const e2 = await go("edit", ids.qwen, "a vase of tulips", "fill");
    check("✏ Edit Fill: the selection painted GREEN for the edit model (Krita's Fill), through the edit model", e2.rq && e2.rq.fill_edit === "1" && e2.rq.edit_style_id === ids.qwen && e2.rq.mid[1] === 255 && e2.rq.mid[0] === 0, e2.rq);
    await sel(0, 200, 800, 400);
    const e3 = await go("edit", ids.qwen, "", "auto");
    check("✏ Edit Auto, a selection across the whole width = Outpaint (Krita's Expand: green, the edit model fills it)", e3.rq && e3.rq.fill_edit === "1" && e3.rq.fill_kind === "generate" && e3.rq.mid[1] === 255 && e3.rq.mid[0] === 0, e3.rq);
    await ev(() => window.imageEditorInstance.E.deselect());
    const e4 = await go("edit", ids.qwen, "", "outpaint");
    check("✏ Edit Outpaint with no selection and no empty canvas: nothing sent (it says to make room first)", e4.took === true && e4.n === 0, e4);

    // a picture with empty canvas round it, no selection: Auto outpaints the empty part
    await load(true);
    await ev(() => window.imageEditorInstance.E.deselect());
    const e5 = await go("edit", ids.qwen, "", "auto");
    const selAfter = await ev(() => !!window.imageEditorInstance.E.hasSel());
    check("✏ Edit Auto, no selection, empty canvas round the picture = the empty part outpainted: the edit model, the empty canvas green and open in the mask, the picture kept",
      e5.rq && e5.rq.fill_edit === "1" && e5.rq.corner[1] === 255 && e5.rq.corner[0] === 0 && e5.rq.mcorner === 0 && e5.rq.mmid === 255 && e5.rq.mid[2] > 150 && !selAfter, e5.rq);
    check("the Edit fill-mode dropdown is beside the ▾ while ✏ Edit is picked, hidden on ✨ Generate", await ev(async () => { const s = document.getElementById("pmEdFill"); window.H3ImgOp.set("edit"); window.imageEditorInstance.E.aiFill.paint(); const a = !s.hidden; window.H3ImgOp.set("generate"); window.imageEditorInstance.E.aiFill.paint(); return a && s.hidden && s.options.length === 4; }));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { await ev(() => { window.H3ImgOp && window.H3ImgOp.set("generate"); localStorage.removeItem("h3.imgop.edfill"); }); } catch (e) { /* fine */ }
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
