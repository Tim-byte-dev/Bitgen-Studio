#!/usr/bin/env node
/* bitGen Studio — 2.437.0 in a REAL browser: ✨ GENERATE FILL IN A SHAPE / IN A MASK (pcgenfill.js) and the PATTERN
 * LIBRARY (pcpattern.js). The AI is stubbed in the page (a solid magenta result), so this needs no models.
 * Tim: "continue with the photoshop gap closure, allow user to generate fill inside a selected shape or mask".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the generate fill / pattern library browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const pat = "zzpat" + process.pid;
  let proj = "default";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.genFill && window.imageEditorInstance.E.patterns, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    proj = (await (await fetch(URL_ + "api/projects")).json()).current;
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);
    // the AI stubbed: one magenta result of the size asked for
    await ev(() => {
      const E = window.imageEditorInstance.E;
      window.__gf = [];
      E.api.aiedit = async (req) => { window.__gf.push({ prompt: req.prompt, mode: req.mode, w: req.width, h: req.height }); return { jobs: [{ id: "gf" + window.__gf.length, seed: 7 }] }; };
      E.api.awaitResult = async () => { const r = window.__gf[window.__gf.length - 1], c = document.createElement("canvas"); c.width = r.w; c.height = r.h; const g = c.getContext("2d"); g.fillStyle = "#ff00ff"; g.fillRect(0, 0, r.w, r.h); return c.toDataURL("image/png"); };
      const D = window.PCDoc;
      E.docs.setTabs(true);
      E.openDoc(200, 150, "gf.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 200, 150); });
      const H = E.makeLayer("Shape", 200, 150, "shape"); H.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "ellipse", x: 20, y: 20, w: 80, h: 60, fill: "#00aa00" }); D.rasterize(H);
      const M = E.makeLayer("Masked", 200, 150); const gm = M.canvas.getContext("2d"); gm.fillStyle = "#0000ff"; gm.fillRect(110, 20, 80, 110);
      M.mask = E.newMask("#000000", 200, 150); const mg = M.mask.canvas.getContext("2d"); mg.fillStyle = "#ffffff"; mg.fillRect(110, 20, 40, 110);
      E.S.layers.push(H, M); E.S.active = 1; E.refresh(); E.renderLayersPanel();
    });
    const flatPx = (x, y) => ev(([x, y]) => Array.from(window.imageEditorInstance.E.flatten().getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);

    /* 1 ✨ Generate Fill in Shape */
    await ev(() => window.imageEditorInstance.E.ui.run("layer.genshape")); await p.waitForTimeout(250);
    const dlg = await ev(() => ({ title: (document.querySelector(".kxdlg.pcd h4") || {}).textContent, ta: !!document.getElementById("gfP"), n: !!document.getElementById("gfN") }));
    check("Layer ▸ ✨ Generate Fill in Shape…: a dialog - the prompt, how many results", /Generate Fill in Shape/.test(dlg.title) && dlg.ta && dlg.n, dlg);
    await p.fill("#gfP", "red bricks"); await ev(() => document.querySelector(".kxdlg.pcd .ok").click());
    await p.waitForFunction(() => { const S = window.imageEditorInstance.E.S; return S.results.length && S.results[0].layer; }, null, { timeout: 15000 });
    const r1 = await ev(() => { const E = window.imageEditorInstance.E, S = E.S, H = S.layers[1]; const a = H.canvas.getContext("2d").getImageData(0, 0, 200, 150).data; let inShape = 0, sel = 0, both = 0; for (let i = 0; i < 30000; i++) { const s = S.sel[i] > 127, h = a[i * 4 + 3] > 127; if (s) sel++; if (h) inShape++; if (s && h) both++; }
      return { req: window.__gf[0], sel, inShape, both, tab: document.getElementById("kxAi").classList.contains("on"), into: S.results[0].info.into, feather: S.results[0].info.feather }; });
    check("...it generates (✨ AI panel) with the prompt inside the shape: the shape's outline is the selection, the target kept, no feather", r1.req.prompt === "red bricks" && r1.req.mode === "generate" && Math.abs(r1.sel - r1.inShape) < 30 && r1.both > 3000 && r1.tab && r1.into && r1.into.how === "shape" && r1.feather === 0, r1);
    await ev(() => document.getElementById("kxApply").click()); await p.waitForTimeout(250);
    const a1 = await ev(() => { const S = window.imageEditorInstance.E.S; return { names: S.layers.map((L) => L.name), clip: S.layers[2].clip, active: S.active, shapeType: S.layers[1].type }; });
    const inP = await flatPx(60, 50), outP = await flatPx(22, 22);
    check("✔ Apply: a new layer right above the shape, CLIPPED to it; the shape stays a live shape", a1.names[2] === "✨ fill in Shape: red bricks" && a1.clip === true && a1.active === 2 && a1.shapeType === "shape", a1);
    check("...the picture: magenta inside the ellipse, not outside it (the clip)", inP[0] > 240 && inP[1] < 15 && inP[2] > 240 && !(outP[0] > 240 && outP[2] > 240 && outP[1] < 15), { inP, outP });
    // a second fill in the same shape goes above the first (the chain stays whole)
    await ev(() => window.imageEditorInstance.E.genFill.run(window.imageEditorInstance.E.S.layers[1], "shape", "moss", 1));
    await p.waitForFunction(() => { const S = window.imageEditorInstance.E.S; return S.results.length && S.results[0].layer; }, null, { timeout: 15000 });
    await ev(() => document.getElementById("kxApply").click()); await p.waitForTimeout(200);
    const a2 = await ev(() => window.imageEditorInstance.E.S.layers.map((L) => [L.name.slice(0, 20), !!L.clip]));
    check("...a second fill in the same shape: above the first, clipped too", a2[3][0].startsWith("✨ fill in Shape: mo") && a2[3][1] && a2[2][1] && a2[4][0] === "Masked", a2);

    /* 2 ✨ Generate Fill in Mask */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.name === "Masked")); });
    // the right-click menu has both
    const ctxm = await ev(() => { const rows = [...document.querySelectorAll(".kxlayer")]; const row = rows.find((r) => /Masked/.test(r.textContent)) || rows[0]; row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 300, clientY: 300 })); return [...document.querySelectorAll(".kxmenu [data-cmd]")].map((x) => x.dataset.cmd).filter((t) => /^layer\.gen/.test(t)); });
    await p.keyboard.press("Escape"); await p.mouse.click(5, 5);
    check("the layer's right-click menu: ✨ Generate Fill in Shape… / in Mask…", ctxm.includes("layer.genshape") && ctxm.includes("layer.genmask"), ctxm);
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcProps")); await p.waitForTimeout(150);
    const pp = await ev(() => ({ s: !!document.getElementById("ppGenShape"), m: !!document.getElementById("ppGenMask") }));
    check("Properties: ✨ fill in shape / ✨ fill in mask for a masked layer", pp.s && pp.m, pp);
    await ev(() => document.getElementById("ppGenMask").click()); await p.waitForTimeout(200);
    await p.fill("#gfP", "water"); await ev(() => document.querySelector(".kxdlg.pcd .ok").click());
    await p.waitForFunction(() => { const S = window.imageEditorInstance.E.S; return S.results.length && S.results[0].layer; }, null, { timeout: 15000 });
    await ev(() => document.getElementById("kxApply").click()); await p.waitForTimeout(250);
    const m1 = await ev(() => { const S = window.imageEditorInstance.E.S, i = S.layers.findIndex((L) => L.name === "Masked"), R = S.layers[i + 1]; return { name: R && R.name, clip: R && R.clip, mask: !!(R && R.mask), above: i + 1 === S.active }; });
    const inM = await flatPx(130, 60), outM = await flatPx(170, 60);
    check("in Mask: a new layer above it with a copy of its mask (not clipped); magenta where the mask is white, not where it is black", m1.name === "✨ fill in Masked: water" && !m1.clip && m1.mask && m1.above
      && inM[0] > 240 && inM[1] < 15 && inM[2] > 240 && !(outM[0] > 240 && outM[1] < 15), { m1, inM, outM });
    const undo = await ev(() => { const E = window.imageEditorInstance.E, n = E.S.layers.length; E.undo(); return [n, E.S.layers.length]; });
    check("...one undo step takes it away", undo[1] === undo[0] - 1, undo);
    const none = await ev(() => { const E = window.imageEditorInstance.E, G = E.makeLayer("Group", 200, 150, "group"); return window.PCGenFill.canShape(G) === false && E.ui.CMD.get("layer.genmask").enabled() === true; });
    check("a group / an adjustment layer can not be filled in its shape; Fill in Mask needs a mask", none);

    /* 3 the pattern library */
    const def = await ev(async (n) => { const E = window.imageEditorInstance.E, c = document.createElement("canvas"); c.width = 8; c.height = 8; const g = c.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(0, 0, 4, 8); g.fillStyle = "#0000ff"; g.fillRect(4, 0, 4, 8);
      const j = await E.patterns.define(n, c); return { j, names: E.patterns.names(), opt: window.PCStyles.FIELDS.patternOverlay[0][3].includes("user:" + n) }; }, pat);
    const onDisk = fs.existsSync(path.join(ROOT, "patterns", pat + ".png"));
    check("Define Pattern: patterns/<name>.png in the install folder; the library lists it; Pattern Overlay offers user:<name>", def.j.name === pat && def.j.w === 8 && def.names.includes(pat) && def.opt && onDisk, def);
    await ev((n) => { const E = window.imageEditorInstance.E; E.setActive(0); E.patterns.newPatternFill(n); }, pat);
    await p.waitForTimeout(250);
    const pf = await ev(() => { const S = window.imageEditorInstance.E.S, L = S.layers[S.active], d = L.canvas.getContext("2d"); return { type: L.type, fill: L.fill, a: Array.from(d.getImageData(1, 1, 1, 1).data), b: Array.from(d.getImageData(5, 1, 1, 1).data), c: Array.from(d.getImageData(9, 1, 1, 1).data) }; });
    check("Layer ▸ New Fill Layer ▸ Pattern…: a live Pattern fill layer, tiled (red | blue every 8 px)", pf.type === "fill" && pf.fill.kind === "pattern" && pf.fill.pattern === pat && pf.a[0] > 240 && pf.b[2] > 240 && pf.c[0] > 240, pf);
    await ev(() => window.imageEditorInstance.E.ui.showTab("pcProps")); await p.waitForTimeout(150);
    const props = await ev(() => ({ kind: (document.getElementById("ppFKind") || {}).value, pat: (document.getElementById("ppFPat") || {}).value, sc: !!document.getElementById("ppFPS") }));
    await p.fill("#ppFPS", "200"); await p.dispatchEvent("#ppFPS", "change"); await p.waitForTimeout(200);
    const pf2 = await ev(() => { const S = window.imageEditorInstance.E.S, d = S.layers[S.active].canvas.getContext("2d"); return { s: S.layers[S.active].fill.scale, b: Array.from(d.getImageData(5, 1, 1, 1).data), c: Array.from(d.getImageData(9, 1, 1, 1).data) }; });
    check("Properties: Pattern, the pattern, Scale % - 200 % = red | blue every 16 px", props.kind === "pattern" && props.pat.length > 0 && props.sc && pf2.s === 200 && pf2.b[0] > 240 && pf2.c[2] > 240, { props, pf2 });
    const fw = await ev((n) => { const E = window.imageEditorInstance.E; const L = E.makeLayer("P", 200, 150); E.addLayer(L, "t", false); E.changeSel((() => { const s = new Uint8Array(200 * 150); for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) s[y * 200 + x] = 255; return s; })(), "sel");
      E.patterns.fillWith(n, 1, "normal"); const d = L.canvas.getContext("2d"); return { in1: Array.from(d.getImageData(1, 1, 1, 1).data), in2: Array.from(d.getImageData(5, 1, 1, 1).data), out: Array.from(d.getImageData(30, 30, 1, 1).data) }; }, pat);
    check("Edit ▸ Fill ▸ Pattern: the selection filled with it, nothing outside", fw.in1[0] > 240 && fw.in2[2] > 240 && fw.out[3] === 0, fw);
    const fillOpt = await ev(() => { window.imageEditorInstance.E.ui.run("edit.fill"); const o = [...document.querySelectorAll("#pdC option")].map((x) => x.value); const pr = document.getElementById("pdPat"); const r = { o, pr: pr ? [...pr.options].map((x) => x.value) : [] }; const c = [...document.querySelectorAll(".kxdlg.pcd button")].find((x) => /Cancel/.test(x.textContent)); if (c) c.click(); return r; });
    check("...the Fill dialog's Contents has Pattern, the library's patterns to pick", fillOpt.o.includes("pat") && fillOpt.pr.includes(pat), fillOpt);

    /* 4 a .bgi keeps the pattern; opened where the library lacks it, it is added back */
    await ev((n) => window.imageEditorInstance.E.bgi.save(n, false), pat);
    const zipNames = await ev(async (n) => { const r = await fetch("/api/bgfile/bgi/file/" + encodeURIComponent(n + ".bgi")); const m = await window.BgZip.unzipAsync(new Uint8Array(await r.arrayBuffer())); return [...m.keys()]; }, pat);
    check(".bgi: the pattern it uses inside (patterns/<name>.png)", zipNames.includes("patterns/" + pat + ".png"), zipNames.filter((x) => /pattern/.test(x)));
    await ev((n) => window.imageEditorInstance.E.patterns.remove(n), pat); await p.waitForTimeout(200);
    const gone = !fs.existsSync(path.join(ROOT, "patterns", pat + ".png"));
    await ev((n) => window.imageEditorInstance.E.bgi.openFromProject(n + ".bgi"), pat); await p.waitForTimeout(600);
    const back = await ev((n) => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.fill && x.fill.kind === "pattern"); const d = L.canvas.getContext("2d"); return { names: E.patterns.names().includes(n), px: Array.from(d.getImageData(1, 1, 1, 1).data) }; }, pat);
    check("...deleted from the library, then the .bgi opened: the pattern is back in the library and the fill layer drawn with it", gone && back.names && fs.existsSync(path.join(ROOT, "patterns", pat + ".png")) && back.px[0] > 240, { gone, back });

    /* 5 the Pattern Library dialog */
    await ev(() => window.imageEditorInstance.E.ui.run("edit.patterns")); await p.waitForTimeout(500);
    const lib = await ev((n) => ({ tile: !!document.querySelector(`.pltile[data-n="${n}"]`), btns: ["plDefine", "plImport"].every((id) => !!document.getElementById(id)) }), pat);
    check("Edit ▸ Pattern Library…: the patterns as tiles (▦ fill layer, ✕ delete), ＋ Define Pattern…, ⤒ Import PNG…", lib.tile && lib.btns, lib);
    await ev((n) => document.querySelector(`.pltile[data-n="${n}"] .pldel`).click(), pat); await p.waitForTimeout(400);
    check("...✕ deletes it from the library (the file too)", !fs.existsSync(path.join(ROOT, "patterns", pat + ".png")) && !(await ev((n) => !!document.querySelector(`.pltile[data-n="${n}"]`), pat)));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    fs.rmSync(path.join(ROOT, "patterns", pat + ".png"), { force: true });
    fs.rmSync(path.join(ROOT, "projects", proj, "bgi", pat + ".bgi"), { force: true });
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
