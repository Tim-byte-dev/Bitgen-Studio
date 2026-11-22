#!/usr/bin/env node
/* bitGen Studio — 2.917.0 in a REAL browser: the prompt docker's ▾ Edit / Compose with the image editor CLOSED uses the
 * References docker's pictures.
 * Tim: "for the desktop app, when the image-editor is closed and prompt docker is in edit mode, use the reference images as
 * the images to edit/compose"
 *   1. ✕ closed (dockgone), never shown this session: ▾ Edit + 1 reference = the edit model on it (the chip "🖼 1 reference");
 *      2 references = Compose with both; ▾ Compose + 1 = compose;
 *   2. not drawn some other way (a layout's 👁 off without ✕, hidden by what it sits in, a workspace hiding it) = closed too;
 *   3. on screen with NO picture open + references = the references (was: "open a picture to edit first");
 *   4. on screen with a picture open = the editor's layer, not the references (as before).
 * The edit model is a stand-in (E.api). Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.917.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.setDefaultTimeout(30000);
  const ev = (f, a) => p.evaluate(f, a);
  try {
    // the editor ✕ closed BEFORE the page loads (Tim's case: it was never on screen)
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: true, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.H3ImgOp && window.ieOnScreen, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(async () => {
      const d = document.getElementById("imageeditdock");
      if (!d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE");
      const E = window.imageEditorInstance.E;
      window.__rq = [];
      const look = async (blob) => { const bm = await createImageBitmap(blob); const c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d"); g.drawImage(bm, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data; let r = 0, bl = 0, n = 0; for (let i = 0; i < px.length; i += 16) { n++; if (px[i] > 200 && px[i + 2] < 60) r++; if (px[i + 2] > 200 && px[i] < 60) bl++; } return { red: r / n, blue: bl / n }; };
      E.api.aiedit = async (req) => { window.__rq.push({ api: "aiedit", mode: req.mode, prompt: req.prompt, crop: await look(req.crop) }); return { jobs: [{ id: "q" + window.__rq.length, seed: 1 }] }; };
      E.api.compose = async (req) => { const pics = []; for (const x of req.pics) pics.push(await look(x)); window.__rq.push({ api: "compose", prompt: req.prompt, pics }); return { jobs: [{ id: "q" + window.__rq.length, seed: 1 }] }; };
      window.__pic = (col) => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 320; c.height = 200; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, 320, 200); c.toBlob(ok, "image/png"); });
      window.__refsTo = async (cols) => { while (refs.length) refs.pop(); const list = []; for (const c of cols) list.push({ blob: await window.__pic(c), name: c.slice(1) + ".png" }); E.api.toRefs(list); await new Promise((r) => setTimeout(r, 300)); };
      window.__go = async (op, text) => { H3ImgOp.set(op); document.getElementById("prompt").value = text; const n = window.__rq.length; runGenerate(); for (let i = 0; i < 40 && window.__rq.length === n; i++) await new Promise((r) => setTimeout(r, 100)); return window.__rq.slice(n); };
      const s = document.getElementById("genModeSel"); s.value = "image"; s.onchange();
    });

    // 1. ✕ closed
    await ev(() => window.__refsTo(["#ff0000"]));
    await ev(() => H3ImgOp.set("edit")); await p.waitForTimeout(700);
    const s1 = await ev(() => ({ on: ieOnScreen(), chip: document.getElementById("pmSrcChip").textContent }));
    check("✕ closed: off screen, the chip says it uses the 1 reference", s1.on === false && /1 reference\b/.test(s1.chip), s1);
    let r = await ev(() => window.__go("edit", "make it blue"));
    check("✏ Edit + 1 reference = the edit model on the red reference", r.length === 1 && r[0].api === "aiedit" && r[0].mode === "edit" && r[0].prompt === "make it blue" && r[0].crop.red > 0.9, r);
    await ev(() => window.__refsTo(["#ff0000", "#0000ff"]));
    r = await ev(() => window.__go("edit", "put the blue on the red"));
    check("✏ Edit + 2 references = Compose with both (red, blue)", r.length === 1 && r[0].api === "compose" && r[0].pics.length === 2 && r[0].pics[0].red > 0.9 && r[0].pics[1].blue > 0.9, r);
    await ev(() => window.__refsTo(["#0000ff"]));
    r = await ev(() => window.__go("compose", "a poster of it"));
    check("🧩 Compose + 1 reference = compose with it", r.length === 1 && r[0].api === "compose" && r[0].pics.length === 1 && r[0].pics[0].blue > 0.9, r);

    // 2. not drawn some other way
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(500);
    const ways = await ev(() => {
      const d = document.getElementById("imageeditdock"), out = { shown: ieOnScreen() };
      d.classList.add("dockoff"); out.dockoff = ieOnScreen(); d.classList.remove("dockoff");
      d.style.display = "none"; out.hidden = ieOnScreen(); d.style.display = "";
      const w = document.createElement("div"); w.className = "ws-hide"; d.parentNode.insertBefore(w, d); w.appendChild(d); out.wsHide = ieOnScreen();
      w.parentNode.insertBefore(d, w); w.remove(); out.back = ieOnScreen();
      return out;
    });
    check("on screen = on; 👁 off / display:none / inside a hidden workspace part = closed", ways.shown === true && ways.dockoff === false && ways.hidden === false && ways.wsHide === false && ways.back === true, ways);
    await ev(() => { document.getElementById("imageeditdock").style.display = "none"; });
    r = await ev(() => window.__go("edit", "make it red"));
    check("not drawn (hidden) + ✏ Edit = the reference, not the editor", r.length === 1 && r[0].api === "aiedit" && r[0].crop.blue > 0.9, r);
    await ev(() => { document.getElementById("imageeditdock").style.display = ""; });
    await p.waitForTimeout(400);

    // 3. on screen, no picture open
    const open0 = await ev(() => ({ on: ieOnScreen(), open: !!window.imageEditorInstance.E.S.w }));
    if (open0.open) await ev(() => { const E = window.imageEditorInstance.E; if (E.closeDoc) E.closeDoc(); });
    const s3 = await ev(() => ({ on: ieOnScreen(), open: !!window.imageEditorInstance.E.S.w }));
    r = await ev(() => window.__go("edit", "make it green"));
    check("on screen with no picture open + ✏ Edit = the reference (was \"open a picture first\")", s3.on && !s3.open && r.length === 1 && r[0].api === "aiedit" && r[0].crop.blue > 0.9, { s3, r });

    // 4. a picture open = the editor's layer, not the references
    await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(240, 160, "red.png", (g) => { g.fillStyle = "#ff0000"; g.fillRect(0, 0, 240, 160); }); });
    await p.waitForTimeout(400);
    const act = await ev(() => { H3ImgOp.set("edit"); const E = window.imageEditorInstance.E; return PCPromptLink.actionFor(Object.assign(E.promptLink.state(), { genMode: "image" })); });
    check("a picture open = the editor's layer (not the references)", act && act.kind === "layer", act);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the run - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { while (refs.length) refs.pop(); if (typeof renderTray === "function") renderTray(); H3ImgOp.set("generate"); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
