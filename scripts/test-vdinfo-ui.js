#!/usr/bin/env node
/* bitGen Studio — 2.391.0 in a REAL browser.
 * Tim (verbatim): "remove Start clip 1 Range 1:2 Redo scene — ⇥ Timeline 🎬 Produce from videodocker / make the video
 * docker info window the height of the statusbar / in image editor, show the mask as the user is drawing so the user
 * can see the mask being drawn".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP.
 *   1. the video docker: the five controls and the emptied Scenes section are gone; the info line is the status bar's
 *      height, sits at the docker's bottom while it scrolls, shows its whole text on hover; Build still builds (clip 1,
 *      scenes 1:2) and says so there;
 *   2. the image editor: a brush on a layer MASK tints what the mask hides red WHILE the stroke is drawn; the tint goes
 *      with the stroke's end; "\" keeps it on while the mask is the target (and off again). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.391.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const near = (a, b, t) => !!a && b.every((v, i) => Math.abs(a[i] - v) <= (t == null ? 14 : t));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1100 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  let buildBody = null;
  try {
    await p.route("**/api/characters/build", (r) => { buildBody = r.request().postData() || ""; r.fulfill({ json: { file: "MM3_Characters_tmp.json", cast: 0, notes: ["scenes 1:2 from clip 1"] } }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.imageEditorInstance && window.imageEditorInstance.E, null, { timeout: 60000 });
    await p.waitForTimeout(800);

    // 1
    await p.evaluate(() => { const d = document.getElementById("videodock"); if (d.classList.contains("dockgone")) toggleDockGone("videodock", "tV"); if (d.classList.contains("collapsed")) toggleCollapse("videodock"); });
    await p.waitForTimeout(300);
    const gone = await p.evaluate(() => ({ ids: ["chStart", "chRange", "chRedo", "scToTl", "scProduce", "chNotes"].filter((id) => document.getElementById(id)),
      text: /Start clip|Redo scene|⇥ Timeline|🎬 Produce/.test(document.getElementById("videodock").textContent) }));
    check("the video docker: Start clip, Range, Redo scene, ⇥ Timeline and 🎬 Produce are gone", gone.ids.length === 0 && !gone.text, gone);
    // 2.391.1 (Tim: "put the scenes in a dropdown"): the scene board is the Scenes dropdown
    const dd = await p.evaluate(() => {
      const h = document.querySelector('#videodock h2.sec.drop[data-sec="vdscenes"]'), b = document.getElementById("sec-vdscenes");
      const r = { head: h && h.textContent.trim(), list: !!(b && b.contains(document.getElementById("scList"))), prefix: !!(b && b.contains(document.getElementById("scPrefix"))),
                  takes: !!(b && b.contains(document.getElementById("scPrevBtns"))), info: !!(b && b.contains(document.getElementById("scNotes"))) };
      h.click(); r.closed = b.classList.contains("closed") && b.offsetHeight === 0; h.click(); r.open = !b.classList.contains("closed") && b.offsetHeight > 0;
      return r;
    });
    check("the scenes are in a Scenes dropdown (the shared prompt, the cards, the take bar - not the info line) that closes and opens from its title",
      /^▾Scenes/.test(dd.head || "") && dd.list && dd.prefix && dd.takes && !dd.info && dd.closed && dd.open, dd);
    const geo = await p.evaluate(() => {
      const i = document.getElementById("scNotes"), sb = document.getElementById("statusbar"), body = document.querySelector("#videodock .bbody");
      body.scrollTop = 0;
      const a = i.getBoundingClientRect(), bb = document.getElementById("videodock").getBoundingClientRect();
      return { h: Math.round(a.height), sb: Math.round(sb.getBoundingClientRect().height), bottom: Math.round(a.bottom), bodyBottom: Math.round(bb.bottom), cls: i.className,
               under: Math.round(a.top) >= Math.round(body.getBoundingClientRect().bottom) - 1 };
    });
    check("the info line is the status bar's height (" + geo.sb + " px) and sits on the docker's bottom edge", geo.cls === "vdinfo" && Math.abs(geo.h - geo.sb) <= 1 && Math.abs(geo.bottom - geo.bodyBottom) <= 2 && geo.under, geo);
    const geo2 = await p.evaluate(() => { const body = document.querySelector("#videodock .bbody"); body.scrollTop = body.scrollHeight; const a = document.getElementById("scNotes").getBoundingClientRect(), bb = document.getElementById("videodock").getBoundingClientRect(); return { bottom: Math.round(a.bottom), bodyBottom: Math.round(bb.bottom) }; });
    check("...and stays there when the docker scrolls", Math.abs(geo2.bottom - geo2.bodyBottom) <= 2, geo2);
    await p.evaluate(() => { document.querySelector("#videodock .bbody").scrollTop = 0; document.getElementById("chBuild").click(); });
    await p.waitForTimeout(500);
    const info = await p.evaluate(() => ({ t: document.getElementById("scNotes").textContent, title: document.getElementById("scNotes").title }));
    let bb = null; try { bb = JSON.parse(buildBody || "null"); } catch { bb = null; }
    check("Build still builds - clip 1, scenes 1:2 (what the fields started at) - and says so in the info line, the whole text on hover",
      bb && bb.start_clip === "1" && bb.scene_range === "1:2" && bb.redo_scene === "" && /MM3_Characters_tmp\.json: 0 character\(s\)/.test(info.t) && info.title === info.t, { bb, info });

    // 2
    await p.evaluate(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await p.evaluate(() => {
      const I = window.imageEditorInstance, E = I.E, S = E.S;
      E.openDoc(200, 150, "mask.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 200, 150); });
      const L = E.makeLayer("Blue", S.w, S.h); const g = L.canvas.getContext("2d"); g.fillStyle = "#0000ff"; g.fillRect(0, 0, 200, 150);
      E.addLayer(L, "blue", false); E.addMask("reveal");
      E.setTool("paint"); E.setFg("#000000"); S.opacity = 1; S.flow = 1; E.setSize(30);
      if (S.maskOverlay) E.ui.run("view.maskov");
    });
    await p.waitForTimeout(200);
    const px = (x, y) => p.evaluate(([x, y]) => Array.from(document.getElementById("ieCanvas").getContext("2d").getImageData(x, y, 1, 1).data), [x, y]);
    const T = async (x, y) => { const v = await p.evaluate(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    check("before: the blue layer shows (a white mask), no tint", near(await px(100, 50), [0, 0, 255, 255]) && await p.evaluate(() => window.imageEditorInstance.E.maskOverlayOn() === false));
    const [a1, a2] = await T(40, 50), [c1, c2] = await T(160, 50);
    await p.mouse.move(a1, a2); await p.mouse.down(); await p.mouse.move(c1, c2, { steps: 14 }); await p.waitForTimeout(120);
    const during = { hidden: await px(100, 50), shown: await px(100, 120), on: await p.evaluate(() => window.imageEditorInstance.E.maskOverlayOn()) };
    check("WHILE the brush paints black on the mask: where it has painted is tinted red (the white under it, half red) and the rest is untouched",
      during.on && near(during.hidden, [255, 128, 128, 255], 30) && near(during.shown, [0, 0, 255, 255]), during);
    await p.mouse.up(); await p.waitForTimeout(200);
    const after = { hidden: await px(100, 50), shown: await px(100, 120), on: await p.evaluate(() => window.imageEditorInstance.E.maskOverlayOn()) };
    check("...the stroke ends: the tint goes, the mask hides the blue there (the white below shows)", !after.on && near(after.hidden, [255, 255, 255, 255]) && near(after.shown, [0, 0, 255, 255]), after);
    await p.locator("#ieStage").focus(); await p.keyboard.press("Backslash"); await p.waitForTimeout(150);
    const k1 = { px: await px(100, 50), on: await p.evaluate(() => window.imageEditorInstance.E.maskOverlayOn()), chk: await p.evaluate(() => window.imageEditorInstance.state.maskOverlay) };
    await p.keyboard.press("Backslash"); await p.waitForTimeout(150);
    const k2 = { px: await px(100, 50), on: await p.evaluate(() => window.imageEditorInstance.E.maskOverlayOn()) };
    check("\\ keeps the red overlay on while the mask is the target (View ▸ Mask Overlay), \\ again turns it off", k1.on && k1.chk === true && near(k1.px, [255, 128, 128, 255], 30) && !k2.on && near(k2.px, [255, 255, 255, 255]), { k1, k2 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await p.evaluate(() => { const S = window.imageEditorInstance.state; if (S.maskOverlay) window.imageEditorInstance.E.ui.run("view.maskov"); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
