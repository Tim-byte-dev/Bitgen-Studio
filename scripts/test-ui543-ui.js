#!/usr/bin/env node
/* bitGen Studio — 2.543.0 in a REAL browser: the prompt docker's ▾ by where the picture comes from.
 * Tim: "if the image editor docker is minimized or closed, use the reference images for the edit,replace background
 * functions, delete fill and remove from the prompt docker dropdown, if image editor docker is open use image editor layer
 * as reference image if user selects multiple layers use those layers as reference images for the operations add the fill
 * and remove functions back to the list. remove the tabs for generate,refine,edit,background and compose from image editor
 * docker. Add compose to the prompt docker dropdown"
 *   1. the editor open: Fill + Remove + Compose listed, the ✨ AI panel's mode tabs gone;
 *   2. the editor minimized: Fill / Remove gone (a Fill picked becomes Generate, and comes back when it opens), the chip
 *      says "🖼 N reference(s)"; Edit with 1 reference = the edit model on it, with 2 = Compose with both; Replace
 *      background = the background instruction; Refine = picture 1 at the slider's strength - nothing in the editor;
 *   3. the editor open: Edit works from the SELECTED LAYER (covered by another layer - still that layer's pixels), the
 *      result a new layer; 2 layers picked = Compose with them; Replace background without a selection = the instruction
 *      on the layer; Compose = the picked layers.
 * The edit model is a stand-in (E.api). Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.543.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  p.setDefaultTimeout(30000);
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.H3ImgOp && window.ieOnScreen, null, { timeout: 60000 });
    await p.waitForTimeout(1600);
    const dock = (open) => ev((o) => { const d = document.getElementById("imageeditdock"); if (o) { if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); } else if (!d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); }, open);
    await dock(true); await p.waitForTimeout(600);
    // the stand-in edit model + two reference pictures (red, blue) + a picture with two layers
    await ev(async () => {
      const E = window.imageEditorInstance.E;
      window.__rq = [];
      const look = async (blob) => { const bm = await createImageBitmap(blob); const c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d"); g.drawImage(bm, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data; let r = 0, bl = 0, n = 0; for (let i = 0; i < d.length; i += 16) { n++; if (d[i] > 200 && d[i + 2] < 60) r++; if (d[i + 2] > 200 && d[i] < 60) bl++; } return { w: c.width, h: c.height, red: r / n, blue: bl / n }; };
      E.api.aiedit = async (req) => { window.__rq.push({ api: "aiedit", mode: req.mode, prompt: req.prompt, strength: req.strength, w: req.width, h: req.height, crop: await look(req.crop), mask: !!req.mask }); return { jobs: [{ id: "q" + window.__rq.length, seed: 1 }] }; };
      E.api.compose = async (req) => { const pics = []; for (const x of req.pics) pics.push(await look(x)); window.__rq.push({ api: "compose", prompt: req.prompt, names: req.names, pics, w: req.width, h: req.height }); return { jobs: [{ id: "q" + window.__rq.length, seed: 1 }] }; };
      E.api.awaitResult = async () => { const r = window.__rq[window.__rq.length - 1], c = document.createElement("canvas"); c.width = r.w || 64; c.height = r.h || 64; const g = c.getContext("2d"); g.fillStyle = "#00ff00"; g.fillRect(0, 0, c.width, c.height); return c.toDataURL("image/png"); };
      const pic = (col) => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 320; c.height = 200; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, 320, 200); c.toBlob(ok, "image/png"); });
      while (refs.length) refs.pop();
      E.api.toRefs([{ blob: await pic("#ff0000"), name: "red.png" }]);
      E.docs.setTabs(true);
      E.openDoc(240, 160, "two.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 240, 160); });
      const A = E.makeLayer("Red layer", 240, 160); A.canvas.getContext("2d").fillStyle = "#ff0000"; A.canvas.getContext("2d").fillRect(0, 0, 240, 160); E.addLayer(A, "t", false);
      const B = E.makeLayer("Blue layer", 240, 160); B.canvas.getContext("2d").fillStyle = "#0000ff"; B.canvas.getContext("2d").fillRect(0, 0, 240, 160); E.addLayer(B, "t", false);
      const s = document.getElementById("genModeSel"); s.value = "image"; s.onchange();
    });
    await p.waitForTimeout(800);
    const st = () => ev(() => ({ opts: [...document.querySelectorAll("#pmOpSel option")].filter((o) => !o.hidden).map((o) => o.value), op: document.getElementById("pmOpSel").value, chip: document.getElementById("pmSrcChip").hidden ? "" : document.getElementById("pmSrcChip").textContent,
      go: document.getElementById("go").textContent, tabs: (() => { const k = document.getElementById("kxModes"); return k ? getComputedStyle(k).display : "none"; })() }));
    const press = async (op, text) => { await p.waitForFunction(() => !window.imageEditorInstance.E.S.busy, null, { timeout: 20000 }).catch(() => {});
      if (process.env.DBG) console.log("DBGP", op, JSON.stringify(await ev(() => { const b = document.getElementById("pmImgOp"), s = document.getElementById("pmOpSel"); return { hid: b.hidden, gm: document.getElementById("genModeSel").value, rects: s.getClientRects().length, dis: s.disabled, pd: document.getElementById("promptdock").className, r: JSON.stringify(s.getBoundingClientRect()) }; })));
      await ev(() => { const g = document.getElementById("genModeSel"); if (g.value !== "image") { g.value = "image"; g.onchange(); } });   // a fresh server's saved project settings land late (Video)
      await p.waitForFunction(() => !document.getElementById("pmImgOp").hidden, null, { timeout: 5000 }).catch(() => {});
      await p.selectOption("#pmOpSel", op); await p.waitForTimeout(250); const n = await ev(() => window.__rq.length); await ev((t) => { document.getElementById("prompt").value = t; }, text); await p.click("#go");
      await p.waitForFunction((k) => window.__rq.length > k, n, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(500); return ev(() => window.__rq[window.__rq.length - 1]); };

    /* 1 the editor open (a fresh server lays its dockers out a little after start - wait for the editor and Fill) */
    await dock(true);
    await p.waitForFunction(() => window.ieOnScreen() && !document.getElementById("pmImgOp").hidden && !document.querySelector('#pmOpSel option[value="fill"]').disabled, null, { timeout: 30000 })
      .catch(async () => console.log("      waiting for the editor:", JSON.stringify(await ev(() => ({ on: window.ieOnScreen(), cls: document.getElementById("imageeditdock").className, box: document.getElementById("pmImgOp").hidden, gm: document.getElementById("genModeSel").value, fill: document.querySelector('#pmOpSel option[value="fill"]').disabled, vis: document.getElementById("pmOpSel").getClientRects().length })))));
    await p.selectOption("#pmOpSel", "fill"); await p.waitForTimeout(300);
    const s1 = await st();
    check("the editor open: Generate, Edit, Refine, Fill, Replace background, Remove, Compose listed; the ✨ AI panel's mode tabs are gone", s1.opts.join() === "generate,edit,refine,fill,background,remove,compose" && s1.tabs === "none", s1);

    /* 2 the editor minimized: the references */
    await dock(false); await p.waitForTimeout(1300);
    const s2 = await st();
    check("the editor minimized: Fill and Remove leave the list (Fill picked -> Generate); the rest stay", s2.opts.join() === "generate,edit,refine,background,compose" && s2.op === "generate", s2);
    const ed1 = await press("edit", "make it a watercolor");
    const s2b = await st();
    check("✏ Edit with 1 reference picture: the edit model on it (the red picture, 320 x 200 fitted), nothing from the editor; the chip says \"🖼 1 reference\"",
      ed1 && ed1.api === "aiedit" && ed1.mode === "edit" && ed1.prompt === "make it a watercolor" && ed1.crop.red > 0.9 && Math.abs(ed1.w / ed1.h - 1.6) < 0.1 && s2b.chip === "🖼 1 reference", { ed1, s2b });
    await ev(async () => { const c = document.createElement("canvas"); c.width = 200; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#0000ff"; g.fillRect(0, 0, 200, 200); const bl = await new Promise((ok) => c.toBlob(ok, "image/png")); window.imageEditorInstance.E.api.toRefs([{ blob: bl, name: "blue.png" }]); });
    await p.waitForTimeout(900);
    const ed2 = await press("edit", "put the blue square on the red wall");
    check("...with 2 references: Compose with both (picture 1 red, picture 2 blue)", ed2.api === "compose" && ed2.pics.length === 2 && ed2.pics[0].red > 0.9 && ed2.pics[1].blue > 0.9 && /blue square/.test(ed2.prompt), ed2);
    const bg2 = await press("background", "a beach at sunset");
    check("🖼 Replace background with the references: the background instruction (\"Replace the background with a beach at sunset. Keep the main subject …\")", /^Replace the background with a beach at sunset\. Keep the main subject/.test(bg2.prompt), bg2);
    await ev(() => { const r = document.getElementById("pmRefine"); r.value = "40"; r.dispatchEvent(new Event("input")); });
    const rf = await press("refine", "sharper");
    check("🔁 Refine with the references: picture 1 redrawn at 40 % (a clear mask = all of it)", rf.api === "aiedit" && rf.mode === "refine" && rf.strength === 40 && rf.crop.red > 0.9 && rf.mask, rf);
    const cp = await press("compose", "the two together");
    check("🧩 Compose with the references: both pictures", cp.api === "compose" && cp.pics.length === 2, cp);
    await p.selectOption("#pmOpSel", "generate"); await p.waitForTimeout(200);
    await ev(() => window.imageEditorInstance.E.store.set("imgop.was", "fill"));

    /* 3 the editor open again: the layers */
    await dock(true); await p.waitForTimeout(1300);
    const s3 = await st();
    check("the editor open again: Fill and Remove back - the Fill picked before comes back", s3.opts.join() === "generate,edit,refine,fill,background,remove,compose" && s3.op === "fill", s3);
    await ev(() => { const E = window.imageEditorInstance.E; E.S.picks = []; E.S.active = E.S.layers.findIndex((L) => L.name === "Red layer"); E.renderLayersPanel(); });
    await p.waitForTimeout(700);
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    const e3 = await press("edit", "make it shiny");
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length > n, n0, { timeout: 15000 }).catch(() => {});
    const l3 = await ev(() => { const E = window.imageEditorInstance.E; return { n: E.S.layers.length, names: E.S.layers.map((L) => L.name), act: E.layer().name, chip: document.getElementById("pmSrcChip").textContent }; });
    check("✏ Edit in the editor works from the SELECTED layer (Red layer - covered by the blue one above, yet the picture sent is red), the chip says \"▦ Red layer\"",
      e3.api === "aiedit" && e3.mode === "edit" && e3.crop.red > 0.9 && e3.crop.blue < 0.05, { e3, l3 });
    check("...the result is a new layer (\"✏ Red layer edit: make it shiny\"), the Red layer stays picked", l3.n === n0 + 1 && l3.names.some((x) => /^✏ Red layer edit: make it shiny/.test(x)) && l3.act === "Red layer", l3);
    await ev(() => { const E = window.imageEditorInstance.E; E.S.picks = E.S.layers.filter((L) => /^(Red|Blue) layer$/.test(L.name)).map((L) => L.id); E.renderLayersPanel(); });
    await p.waitForTimeout(700);
    const chip2 = (await st()).chip;
    const e4 = await press("edit", "the red and the blue together");
    check("2 layers picked (Ctrl-click): Edit = Compose with those layers (red + blue, their names); the chip says \"▦ 2 layers\"",
      e4.api === "compose" && e4.pics.length === 2 && e4.names.join() === "Red layer,Blue layer" && chip2 === "▦ 2 layers", { e4, chip2 });
    const e5 = await press("background", "a forest");
    check("...Replace background with 2 layers picked: Compose with the background instruction", e5.api === "compose" && /^Replace the background with a forest\./.test(e5.prompt), e5);
    const e6 = await press("compose", "all of it");
    check("🧩 Compose: the picked layers", e6.api === "compose" && e6.pics.length === 2, e6);
    await ev(() => { const E = window.imageEditorInstance.E; E.S.picks = []; E.S.active = E.S.layers.findIndex((L) => L.name === "Blue layer"); E.renderLayersPanel(); });
    await p.waitForTimeout(600);
    const e7 = await press("background", "a desert");
    if (process.env.DBG) console.log("DBG0", JSON.stringify(await ev(() => { const E = window.imageEditorInstance.E, s = E.promptLink.state(); return { s, act: window.PCPromptLink.actionFor(Object.assign({}, s, { genMode: "image" })) }; })));
    if (process.env.DBG) console.log("DBG", JSON.stringify(await ev(() => ({ st: (document.getElementById("ieStatus") || {}).textContent, busy: window.imageEditorInstance.E.S.busy, act: window.imageEditorInstance.E.layer().name, picks: window.imageEditorInstance.E.S.picks, op: window.H3ImgOp.get(), n: window.__rq.length }))));
    check("Replace background without a selection in the editor: the instruction on the selected layer (blue)", e7.api === "aiedit" && e7.mode === "edit" && e7.crop.blue > 0.9 && /^Replace the background with a desert\./.test(e7.prompt), e7);
    const s8 = await st();
    check("...the ▾ stays on Replace background (the run's own mode does not move it)", s8.op === "background", s8);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally { try { await ev(() => { while (refs.length) refs.pop(); if (typeof renderTray === "function") renderTray(); }); } catch { /* fine */ } await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
