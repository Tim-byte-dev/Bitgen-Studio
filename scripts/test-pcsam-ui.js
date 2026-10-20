#!/usr/bin/env node
/* bitGen Studio — 2.390.0 in a REAL browser: SEGMENT ANYTHING in the image editor, ✨ COMPOSE (the picked layers as
 * references), → REFERENCES, and PSD files (the real ag-psd, both ways).
 * Tim (verbatim): "yes, please do these steps and maybe add sam to segment the image on the layer and add an option to
 * put segments on different layers".
 * Against the running app (H3_URL, default the e2e server on :8311 - its segment server is the --fake stand-in: flat
 * colour regions instead of SAM's). The compose render is STUBBED (its request read, a result picture served).
 * No Playwright = SKIP.
 *   1. the Object Selection tool (W): a click selects the thing under it, Shift-click adds, Alt-click takes away, a drag
 *      selects the thing in the box; "Find" words -> a selection, ◐ Mask -> the layer's mask;
 *   2. Select ▸ Subject… -> each match on its own layer; Layer ▸ Segment Layer… -> every segment on its own layer in a
 *      group, cut out of the layer; undo puts it all back;
 *   3. Ctrl-click picks layers (numbered); ✨ Compose sends them in order with the prompt, the result lands as a layer;
 *   4. → References puts the picked layers in the reference dock;
 *   5. Save as PSD -> the project's psd folder; Open PSD from Project -> the same layers, groups, masks, opacity, blend,
 *      visibility, styles and pixels; 6. the settings dialog. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the Segment Anything / PSD browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const field = (body, k) => { const m = new RegExp(`name="${k}"\\r\\n\\r\\n([^\\r]*)`).exec(body || ""); return m ? m[1] : null; };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  let composeBody = null;
  try {
    // a result picture for the stubbed compose render: green
    await p.route("**/api/aiedit/compose", (r) => { composeBody = r.request().postDataBuffer().toString("latin1"); r.fulfill({ json: { jobs: [{ id: "cmp390", seed: 5 }], workflow: "img_qwen_edit_2511.json", note: "compose", prompt: "x", mode: "compose" } }); });
    await p.route(/\/api\/jobs\/cmp390(\?.*)?$/, (r) => r.fulfill({ json: { id: "cmp390", status: "done", outputs: ["cmp390.png"], output: "cmp390.png", progress: null, log: [] } }));
    await p.route(/\/outputs\/cmp390\.png/, async (r) => {
      const png = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 160; c.height = 100; const g = c.getContext("2d"); g.fillStyle = "#00c000"; g.fillRect(0, 0, 160, 100); return c.toDataURL("image/png").split(",")[1]; });
      r.fulfill({ body: Buffer.from(png, "base64"), contentType: "image/png" });
    });
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.H3_PROJECT_READY, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    const ev = (f, a) => p.evaluate(f, a);
    // the picture: light grey, a red box (20,30 60x90), a blue box (120,40 60x60)
    await ev(() => {
      const E = window.imageEditorInstance.E;
      E.openDoc(200, 150, "scene.png", (g) => { g.fillStyle = "#f0f0f0"; g.fillRect(0, 0, 200, 150); g.fillStyle = "#dc2828"; g.fillRect(20, 30, 60, 90); g.fillStyle = "#2846dc"; g.fillRect(120, 40, 60, 60); });
    });
    await p.waitForTimeout(300);
    const st = () => ev(() => { const s = window.imageEditorInstance.state, P = window.imageEditorInstance.P; return { n: s.layers.length, sel: s.selCount, box: s.selCount ? P.bbox(s.sel, s.w, s.h) : null, names: s.layers.map((l) => l.name), types: s.layers.map((l) => l.type).join(","), active: s.active, undo: s.undo.length, mask: !!(s.layers[s.active] || {}).mask }; });
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const waitIdle = () => p.waitForFunction(() => !window.imageEditorInstance.E.segBusy(), null, { timeout: 60000 });
    const clickAt = async (x, y, mods) => { const [cx, cy] = await T(x, y); if (mods) await p.keyboard.down(mods); await p.mouse.click(cx, cy); if (mods) await p.keyboard.up(mods); await p.waitForTimeout(150); await waitIdle(); await p.waitForTimeout(100); };

    // 1
    await p.locator("#ieStage").focus(); await p.keyboard.press("w"); await p.waitForTimeout(150);
    const tool = await ev(() => ({ t: window.imageEditorInstance.state.tool, opts: !!document.querySelector("#pcSegWords"), fly: document.querySelector('#kxTools .ietool[data-group="w"]').dataset.tools }));
    check("W = the Object Selection Tool (first in the W group with the Magic Wand, the selection brush and - 2.423.0 - the edge-aware Quick Selection); its options: Find, Sample All Layers",
      tool.t === "objsel" && tool.opts && tool.fly === "objsel,wand,brush,qsel", tool);
    await clickAt(50, 60);
    let s = await st();
    check("a click on the red box selects the red box (Segment Anything's outline)", s.box && s.box.x === 20 && s.box.y === 30 && s.box.w === 60 && s.box.h === 90 && s.sel === 5400, s);
    await clickAt(150, 70, "Shift");
    s = await st();
    check("Shift-click adds the blue box", s.sel === 5400 + 3600, s);
    await clickAt(50, 60, "Alt");
    s = await st();
    check("Alt-click takes the red one away", s.sel === 3600 && s.box.x === 120, s);
    const [a1, a2] = await T(15, 25), [c1, c2] = await T(90, 125);
    await p.mouse.move(a1, a2); await p.mouse.down(); await p.mouse.move(c1, c2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150); await waitIdle(); await p.waitForTimeout(100);
    s = await st();
    check("a drag = the thing inside the box (red)", s.sel === 5400 && s.box.x === 20, s);
    await p.fill("#pcSegWords", "blue"); await p.click("#pcSegFind"); await waitIdle(); await p.waitForTimeout(150);
    s = await st();
    check("Find \"blue\" -> the blue box selected", s.sel === 3600 && s.box.x === 120, s);
    const und = s.undo;
    await p.fill("#pcSegWords", "red"); await p.click("#pcSegMask"); await waitIdle(); await p.waitForTimeout(150);
    s = await st();
    const mk = await ev(() => { const L = window.imageEditorInstance.state.layers[window.imageEditorInstance.state.active]; const g = L.mask.canvas.getContext("2d"); return [g.getImageData(50, 60, 1, 1).data[0], g.getImageData(150, 70, 1, 1).data[0]]; });
    check("◐ Mask \"red\" -> the layer's mask shows the red box only (white there, black elsewhere); the selection is left as it was",
      s.mask && mk[0] === 255 && mk[1] === 0 && s.sel === 3600 && s.undo === und + 1, { s, mk });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(100);
    check("...one undo takes the mask away", !(await st()).mask);

    // 2
    await ev(() => window.imageEditorInstance.E.ui.run("sel.subject")); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #sdW", "red, blue"); await p.selectOption(".kxdlg.pcd #sdOut", "layers"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(200); await waitIdle(); await p.waitForTimeout(200);
    s = await st();
    const grp = await ev(() => { const S = window.imageEditorInstance.state; const G = S.layers.find((l) => l.type === "group"); return G ? { name: G.name, kids: S.layers.filter((l) => l.parent === G.id).map((l) => l.name).sort() } : null; });
    check("Select ▸ Subject… \"red, blue\" into each match on its own layer -> a group \"Segments of Background (red, blue)\" with layers Red and Blue",
      grp && /^Segments of Background/.test(grp.name) && grp.kids.join() === "Blue,Red" && s.n === 4, { grp, s });
    const redPx = await ev(() => { const S = window.imageEditorInstance.state; const L = S.layers.find((l) => l.name === "Red"); const g = L.canvas.getContext("2d"); return [Array.from(g.getImageData(50, 60, 1, 1).data), g.getImageData(150, 70, 1, 1).data[3], g.getImageData(5, 5, 1, 1).data[3]]; });
    check("...the Red layer holds the red pixels only (see-through elsewhere)", redPx[0][0] > 200 && redPx[0][3] === 255 && redPx[1] === 0 && redPx[2] === 0, redPx);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(150);
    check("...one undo removes them", (await st()).n === 1);
    await ev(() => window.imageEditorInstance.E.ui.run("layer.segment")); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #sgMin", "1"); await p.check(".kxdlg.pcd #sgCut"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(200); await waitIdle(); await p.waitForTimeout(250);
    s = await st();
    const bg = await ev(() => { const S = window.imageEditorInstance.state; const L = S.layers.find((l) => l.name === "Background"); const g = L.canvas.getContext("2d"); return [g.getImageData(50, 60, 1, 1).data[3], g.getImageData(150, 70, 1, 1).data[3], g.getImageData(5, 5, 1, 1).data[3]]; });
    check("Layer ▸ Segment Layer… (everything, cut out): 3 segments on their own layers in a group, the Background layer emptied where they were",
      s.n === 5 && s.types.split(",").filter((t) => t === "group").length === 1 && bg.every((a) => a === 0), { s, bg });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(150);
    const bg2 = await ev(() => { const S = window.imageEditorInstance.state; const g = S.layers[0].canvas.getContext("2d"); return g.getImageData(50, 60, 1, 1).data[3]; });
    check("...one undo: the segments gone, the Background whole again", (await st()).n === 1 && bg2 === 255, bg2);

    // 3: picks + compose
    await ev(() => {
      const E = window.imageEditorInstance.E, S = E.S;
      const mk = (name, col, x, y) => { const L = E.makeLayer(name, S.w, S.h); const g = L.canvas.getContext("2d"); g.fillStyle = col; g.fillRect(x, y, 30, 30); E.addLayer(L, "test layer", false); };
      mk("Dog", "#a05010", 10, 10); mk("Cat", "#606060", 150, 100);
    });
    await p.waitForTimeout(150);
    const rowOf = (name) => p.locator("#kxLayers .kxlayer", { has: p.locator(`.nm:text-is("${name}")`) }).first().locator(".nm");
    await rowOf("Background").click({ modifiers: ["Control"] }); await rowOf("Dog").click({ modifiers: ["Control"] }); await rowOf("Cat").click({ modifiers: ["Control"] });
    await p.waitForTimeout(150);
    const picks = await ev(() => ({ badges: [...document.querySelectorAll("#kxLayers .kxlayer.pick")].map((r) => r.querySelector(".nm").textContent + "=" + r.querySelector(".pkb").textContent).sort(),
      order: window.imageEditorInstance.E.picked().map((l) => l.name) }));
    check("Ctrl-click picks layers in order - numbered badges 1, 2, 3 in the Layers panel", picks.order.join() === "Background,Dog,Cat" && picks.badges.join() === "Background=1,Cat=3,Dog=2", picks);
    await ev(() => { const I = window.imageEditorInstance; I.setAiMode("compose"); I.E.ui.showTab("kxAi"); });
    await p.waitForTimeout(150);
    const ui = await ev(() => ({ run: document.getElementById("kxRun").textContent, picksRow: document.getElementById("kxRowPicks").style.display, txt: document.getElementById("kxPicksTxt").textContent, model: document.getElementById("kxRowEdit").style.display }));
    check("✨ AI ▸ Compose: the Edit model row, the picked layers listed, → References", ui.run === "✨ Compose" && ui.picksRow === "" && ui.model === "" && ui.txt === "1 Background · 2 Dog · 3 Cat", ui);
    await ev(() => { const s = document.getElementById("ieEditStyle"); if (!s.options.length || !s.value) { s.innerHTML = '<option value="qwen-test">Qwen Image Edit 2511</option>'; s.value = "qwen-test"; } });
    await p.evaluate((v) => { const e = document.getElementById("prompt"); e.value = v; e.dispatchEvent(new Event("input")); }, "put the dog from Dog next to the cat from Cat in Background");   // 2.419.0: the tool reads the prompt docker
    await ev(() => window.imageEditorInstance.runAI());
    await p.waitForFunction(() => window.imageEditorInstance.state.results.some((r) => r.layer), null, { timeout: 30000 }).catch(() => null);
    const cb = composeBody || "";
    check("Compose posts the three layers as pic0..pic2 (Picture 1 = the scene), their names, the prompt, the edit model",
      /name="pic0"; filename="pic0.png"/.test(cb) && /name="pic2"; filename="pic2.png"/.test(cb) && field(cb, "names") === '["Background","Dog","Cat"]'
      && field(cb, "prompt") === "put the dog from Dog next to the cat from Cat in Background" && !!field(cb, "style_id"), { names: field(cb, "names"), prompt: field(cb, "prompt") });
    const n0 = (await st()).n;
    await ev(() => window.imageEditorInstance.applyResult()); await p.waitForTimeout(150);
    const res = await ev(() => { const S = window.imageEditorInstance.state; const L = S.layers[S.active]; return { name: L.name, px: Array.from(L.canvas.getContext("2d").getImageData(100, 75, 1, 1).data) }; });
    check("...the result (the stub's green picture) lands as a new layer over the whole picture", (await st()).n === n0 + 1 && /compose/.test(res.name) && res.px[1] > 150 && res.px[3] === 255, res);

    // 4
    const r0 = await ev(() => refs.length);
    await p.click("#kxPicksRefs"); await p.waitForTimeout(300);
    const r1 = await ev(() => ({ n: refs.length, names: refs.slice(-3).map((r) => r.file.name), hidden: document.getElementById("app").classList.contains("no-refs") }));
    check("→ References puts the three picked layers in the reference dock (Image tab) for the prompt docker's Generate", r1.n === r0 + 3 && r1.names.join() === "Background.png,Dog.png,Cat.png" && !r1.hidden, r1);
    await ev((k) => { refs.splice(k); renderTray(); window.imageEditorInstance.E.clearPicks(); }, r0);

    // 5: PSD both ways
    await ev(() => {
      const E = window.imageEditorInstance.E, S = E.S, D = E.D;
      const dog = S.layers.find((l) => l.name === "Dog"), cat = S.layers.find((l) => l.name === "Cat");
      dog.opacity = 0.5; dog.blend = "multiply"; cat.visible = false;
      dog.styles = { shadow: Object.assign({}, D.STYLE_DEFAULTS.shadow, { on: true, distance: 6 }) };
      const m = E.newMask("#000000"); m.canvas.getContext("2d").fillStyle = "#ffffff"; m.canvas.getContext("2d").fillRect(10, 10, 15, 30); dog.mask = m;
      S.active = S.layers.indexOf(cat); E.groupActive();
      S.layers.find((l) => l.type === "group").name = "Animals";
      E.refresh(); E.renderLayersPanel();
    });
    const before = await ev(() => window.imageEditorInstance.state.layers.map((l) => `${l.type}:${l.name}:${l.visible}:${Math.round(l.opacity * 100)}:${l.blend}:${!!l.mask}:${l.parent != null}`));
    const saved = await ev(async () => window.imageEditorInstance.E.psdSaveAs("psdtest390", false));
    const listed = await (await fetch(URL_ + "api/psd/list")).json();
    check("Save as PSD: written by ag-psd, kept in the project's psd folder", saved && saved.name === "psdtest390.psd" && saved.size > 1000 && listed.files.some((f) => f.name === "psdtest390.psd"), { saved, listed });
    await ev(() => window.imageEditorInstance.E.openDoc(50, 50, "blank.png"));
    const op = await ev(async () => window.imageEditorInstance.E.psdOpenFromProject("psdtest390.psd"));
    const after = await ev(() => window.imageEditorInstance.state.layers.map((l) => `${l.type}:${l.name}:${l.visible}:${Math.round(l.opacity * 100)}:${l.blend}:${!!l.mask}:${l.parent != null}`));
    check("Open PSD from Project: the same layers back - types, names, visibility, opacity, blend, masks, the group", op && after.join("|") === before.join("|"), { before, after });
    const px2 = await ev(() => {
      const S = window.imageEditorInstance.state, g = (n) => S.layers.find((l) => l.name === n);
      const dog = g("Dog"), bgc = g("Background").canvas.getContext("2d");
      return { w: S.w, h: S.h, dog: Array.from(dog.canvas.getContext("2d").getImageData(12, 12, 1, 1).data), mask: [dog.mask.canvas.getContext("2d").getImageData(12, 12, 1, 1).data[0], dog.mask.canvas.getContext("2d").getImageData(35, 35, 1, 1).data[0]],
               bg: Array.from(bgc.getImageData(50, 60, 1, 1).data), shadow: dog.styles && dog.styles.shadow && dog.styles.shadow.on && dog.styles.shadow.distance };
    });
    check("...and the pixels: the picture's size, the Dog's colour, its mask (white inside, black outside), the red box, the drop shadow (6 px)",
      px2.w === 200 && px2.h === 150 && Math.abs(px2.dog[0] - 0xa0) < 3 && px2.mask[0] > 250 && px2.mask[1] < 5 && px2.bg[0] > 200 && px2.bg[2] < 60 && px2.shadow === 6, px2);
    await ev(() => window.imageEditorInstance.E.ui.run("file.openpsdproj")); await p.waitForTimeout(400);
    check("File ▸ Open PSD from Project… lists it", await ev(() => [...document.querySelectorAll(".kxdlg.pcd #pdList option")].some((o) => o.value === "psdtest390.psd")));
    await p.click(".kxdlg.pcd .cn");

    // 6
    await ev(() => window.imageEditorInstance.E.ui.run("sel.segset")); await p.waitForTimeout(500);
    const sd = await ev(() => ({ t: (document.querySelector(".kxdlg.pcd h4") || {}).textContent, st: (document.getElementById("ssState") || {}).textContent, models: [...document.querySelectorAll("#ssModel option")].map((o) => o.value).join() }));
    check("Select ▸ Segment Anything Settings…: the state, the three SAM models, ⬇ Install", sd.t === "Segment Anything" && /installed|running/.test(sd.st) && sd.models === "vit_b,vit_l,vit_h", sd);
    await p.click(".kxdlg.pcd .cn");
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
