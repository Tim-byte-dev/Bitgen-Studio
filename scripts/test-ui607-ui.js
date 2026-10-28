#!/usr/bin/env node
/* bitGen Studio — 2.607.0 in a REAL browser: TEXT PRESETS KEPT THROUGH SHAPES / 3D, PRESETS IN MORE TEXT TOOLS, EVERY
 * FONT ON THIS COMPUTER.
 * Tim: "is it possible to keep the text presets when operations when shape tools like 3d , warp etc are used. Use all the
 * fonts that are installed in the os. add text presets to timeline and other text tools as well"
 *   image editor   a Gold text keeps its gold through ⌒ Warp (arc), 3D (extrude - the sides behind it), round a circle,
 *                  vertical; with no preset the same shape is plain (control)
 *   fonts          the Type tool's font list has "This computer (N)" with the machine's fonts; H3Fonts.drawable
 *   timeline       New text ▸ Preset (nothing selected) - the T tool's new text starts with it; a preset text gets
 *                  ✨ Text Animators and keeps its preset in the animated picture; 3D text with a preset: the face
 *                  carries the preset's colours
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.607.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_ui607_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.PCFxShape && window.H3TextFx && H3TextFx.list().length >= 10 && window.H3Fonts, null, { timeout: 60000 });
    await p.waitForTimeout(800);

    /* ================= 1. the image editor: a Gold text through every shape ================= */
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(700);
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "700"); await p.fill(".kxdlg.pcd #pdH", "500"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    await ev(() => {
      const E = window.imageEditorInstance.E, S = window.imageEditorInstance.state, D = window.PCDoc;
      const L = E.makeLayer("Gold text", S.w, S.h, "text");
      L.text = Object.assign({}, D.TEXT_DEFAULT, { str: "GOLDEN", x: 80, y: 150, size: 96, weight: 700, font: "DejaVu Sans", color: "#3366ff", align: "left", fx: "style:gold" });
      D.rasterize(L); E.addLayer(L, "gold text", false); window.__L = L;
    });
    const look = () => ev(() => {
      const c = window.__L.canvas, d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, W = c.width;
      let gold = 0, blue = 0, any = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 120) continue; any++;
        const r = d[i], g = d[i + 1], bb = d[i + 2], k = i / 4, x = k % W, y = Math.floor(k / W);
        if (r > 150 && g > 100 && bb < 120 && r > bb + 70) gold++;
        if (bb > 180 && r < 120) blue++;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return { gold, blue, any, x0, x1, y0, y1, h: y1 - y0, w: x1 - x0 };
    });
    const setT = (fn) => ev((src) => { const E = window.imageEditorInstance.E; E.setLayer(window.__L, "test", new Function("x", src)); }, fn);
    const settle = async () => { await p.waitForTimeout(900); await ev(() => window.PCDoc.rasterize(window.__L)); await p.waitForTimeout(60); };
    await settle();
    const straight = await look();
    check("image editor: a straight text with the Gold preset is gold (not its own blue)", straight.gold > 1500 && straight.blue < 50, straight);

    await setT("x.text.warp = { style: 'arc', bend: 60 };"); await settle();
    const warped = await look();
    check("⌒ Warp (Arc 60 %): the preset is KEPT - gold, not the plain blue letters - and the text is bent (taller)", warped.gold > 1500 && warped.blue < 50 && warped.h > straight.h + 20, { straight, warped });

    await setT("x.text.extrude = { on: true, depth: 22, angle: 135, shade: 0.5, color: null };"); await settle();
    const d3 = await look();
    check("3D (extrude 22 px) on the warped text: still gold on the face, the sides reach out behind it (wider / taller by the depth)", d3.gold > 1500 && d3.blue < 50 && d3.x1 >= warped.x1 + 10 && d3.y1 >= warped.y1 + 10, { warped, d3 });

    await setT("x.text.warp = null; x.text.extrude = null; x.text.align = 'center'; x.text.x = 350; x.text.y = 330; x.text.path = { kind: 'circle', r: 150, start: 0, side: 'top' };"); await settle();
    const circ = await look();
    check("round a circle: gold letters along the circle (spread wide and tall)", circ.gold > 900 && circ.blue < 50 && circ.h > 140, circ);

    await setT("x.text.path = null; x.text.align = 'left'; x.text.x = 300; x.text.y = 20; x.text.size = 60; x.text.vertical = true;"); await settle();
    const vert = await look();
    check("vertical: gold, one letter under the next (taller than wide)", vert.gold > 600 && vert.blue < 50 && vert.h > vert.w * 2, vert);

    await setT("delete x.text.fx; x.text.vertical = false; x.text.warp = { style: 'arc', bend: 60 }; x.text.x = 80; x.text.y = 150; x.text.size = 96;"); await settle();
    const ctrl = await look();
    check("control - no preset, warped: the plain blue letters (no gold)", ctrl.gold < 30 && ctrl.blue > 1500, ctrl);

    /* ================= 2. fonts: everything on this computer ================= */
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("type"); E.renderOptions(); });
    await p.waitForTimeout(800);
    const fl = await ev(() => { const s = document.querySelector("#ptFont"); if (!s) return null; const g = s.querySelector("optgroup.h3f-more"); return { groups: [...s.querySelectorAll("optgroup")].map((x) => x.label), more: g ? [...g.querySelectorAll("option")].map((o) => o.value) : [], common: [...s.querySelectorAll("optgroup.h3f-common option")].map((o) => o.value), val: s.value }; });
    const srv = await (await fetch(URL_ + "api/fonts")).json();
    check("the Type tool's font list: Common (the usual ones) + This computer (N) - every family the computer has (here " + (srv.families || []).length + ")",
      fl && fl.common.includes("Arial") && /This computer \(\d+\)/.test(fl.groups.join("|")) && fl.more.some((f) => /DejaVu/.test(f)) && (srv.families || []).every((f) => fl.more.includes(f) || fl.common.some((c) => c.toLowerCase() === f.toLowerCase())), { fl: fl && { groups: fl.groups, more: fl.more.slice(0, 8), n: fl.more.length }, srv: (srv.families || []).length });
    await ev(() => { const s = document.querySelector("#ptFont"); s.value = [...s.querySelectorAll("optgroup.h3f-more option")].find((o) => /DejaVu Serif/.test(o.value)).value; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(300);
    const pick = await ev(() => ({ font: window.imageEditorInstance.state.typeFont, ok: H3Fonts.drawable("DejaVu Serif"), no: H3Fonts.drawable("No Such Font Zq") }));
    check("picking one of them: the Type tool uses it (and the browser can draw it - an unknown name cannot)", /DejaVu Serif/.test(pick.font) && pick.ok === true && pick.no === false, pick);
    const pp = await ev(async () => { const E = window.imageEditorInstance.E; E.setTool("move"); E.setActive(window.imageEditorInstance.state.layers.indexOf(window.__L)); E.renderOptions(); await new Promise((r) => setTimeout(r, 900)); const s = document.querySelector("#ppTFont"); return s ? !!s.querySelector("optgroup.h3f-more") : "none"; });
    check("Properties ▸ the text's font list has them too", pp === true, pp);
    await ev(() => { const k = document.getElementById("kxFull"); if (k) k.click(); });
    await p.waitForTimeout(400);

    /* ================= 3. the timeline ================= */
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline();
      if (window.TlFloat) { TlFloat.show(true); TlFloat.place(1300, 100); }
      TlCanvas.select(null); TlCanvas.paintProps();
    });
    await p.waitForTimeout(500);
    const none = await ev(() => ({ row: !!document.querySelector("#tlpNewFx .tfx-sel"), title: (document.querySelector("#tlpNewFx .tlp-t") || {}).textContent }));
    check("timeline, nothing selected: Properties ▸ New text (T tool) ▸ Preset", none.row && /New text/.test(none.title), none);
    await ev(() => { const s = document.querySelector("#tlpNewFx .tfx-sel"); s.value = "style:gold"; s.dispatchEvent(new Event("change")); });
    const nt = await ev(() => { TlCanvas.addText({ x: TlCanvas.state.W / 2, y: TlCanvas.state.H / 2 }); window.__c = tl.images[0].clips[0]; return { fx: __c.text.fx, saved: TlTextFx.newFx() }; });
    check("…the T tool's next new text starts with that preset", nt.fx === "style:gold" && nt.saved === "style:gold", nt);
    await ev(() => { Object.assign(__c.text, { content: "SHINE", font: "DejaVu Sans", color: "#3366ff", size: Math.round(TlCanvas.state.H * 0.16) }); TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.paintProps(); });
    await p.waitForTimeout(400);
    const ta = await ev(() => !!document.querySelector("#tlProps .tlp-tanim"));
    check("a text WITH a preset gets ✨ Text Animators (they were hidden for preset texts)", ta, ta);
    const tpic = await ev(async () => {
      __c.text.anim = [Object.assign({}, TlTextAnim.DEFAULTS, { rot: 18 })];
      let cv = null; for (let i = 0; i < 40; i++) { cv = TlTextAnim.picture(__c, 0.4); await new Promise((r) => setTimeout(r, 120)); }
      cv = TlTextAnim.picture(__c, 0.4);
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let gold = 0, blue = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 120) continue; if (d[i] > 150 && d[i + 1] > 100 && d[i + 2] < 120 && d[i] > d[i + 2] + 70) gold++; if (d[i + 2] > 180 && d[i] < 120) blue++; }
      return { gold, blue, w: cv.width, h: cv.height };
    });
    check("…an animated preset text (letters turned 18°): the picture keeps the Gold preset", tpic.gold > 800 && tpic.blue < 50, tpic);
    const tpath = await ev(async () => {
      __c.text.anim = []; __c.text.onpath = { on: true, path: "arc", r: 300, span: 120, off: 50 };
      let cv = null; for (let i = 0; i < 30; i++) { cv = TlTextAnim.picture(__c, 0.2); await new Promise((r) => setTimeout(r, 120)); }
      cv = TlTextAnim.picture(__c, 0.2);
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let gold = 0, blue = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 120) continue; if (d[i] > 150 && d[i + 1] > 100 && d[i + 2] < 120 && d[i] > d[i + 2] + 70) gold++; if (d[i + 2] > 180 && d[i] < 120) blue++; }
      return { gold, blue };
    });
    check("…〰 on a path (an arc): gold too", tpath.gold > 800 && tpath.blue < 50, tpath);

    /* 3D text with a preset */
    const m3 = await ev(async () => {
      await H3M3D.load();
      const mk = (fx) => ({ start: 0, dur: 5, m3d: Object.assign(H3M3D.defaults("text", 1000, 500), { text: "GOLD", font: "DejaVu Sans", color: "#3366ff", bevel: 0, depth: 0.15, w: 600, h: 300 }, fx ? { fx } : {}) });
      const count = async (c) => {
        let f = null; for (let i = 0; i < 200 && !(f = H3M3D.frame(c, 0)); i++) await new Promise((r) => setTimeout(r, 100));
        await new Promise((r) => setTimeout(r, 300)); f = H3M3D.frame(c, 0);
        if (!f) return null;
        const d = f.canvas.getContext("2d").getImageData(0, 0, f.w, f.h).data; let gold = 0, blue = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 120) continue; if (d[i] > 150 && d[i + 1] > 100 && d[i + 2] < 120 && d[i] > d[i + 2] + 70) gold++; if (d[i + 2] > 150 && d[i] < 110) blue++; }
        return { gold, blue, err: f.error || null };
      };
      return { plain: await count(mk(null)), gold: await count(mk("style:gold")) };
    });
    check("3D text with the Gold preset: the face is gold (plain 3D text in the same colour is blue)", m3.plain && m3.gold && m3.gold.gold > 1500 && m3.gold.gold > m3.plain.gold * 5 && m3.plain.blue > 1500 && m3.gold.blue < m3.plain.blue / 4, m3);
    await ev(() => { const c = { start: 0, dur: 5, m3d: Object.assign(H3M3D.defaults("text", 1000, 500), { text: "Z" }) }; tl.vlayers.push({ name: "3D", clips: [c] }); tlSave(); TlCanvas.select(c, TlCanvas.layerOf(c)); TlCanvas.paintProps(); });
    await p.waitForTimeout(500);
    const m3ui = await ev(() => ({ fx: !!document.querySelector("#tlp3FxRow .tfx-sel"), font: !!document.querySelector("#tlp3Font optgroup.h3f-more") }));
    check("3D text Properties: Preset ▾ and every font on this computer", m3ui.fx && m3ui.font, m3ui);

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + String(e.stack || e).split("\n").slice(0, 3).join(" ")); if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT }).catch(() => {}); }
  finally {
    try { await ev(() => { tl.images = []; tl.vlayers = []; tlSave(); try { TlTextFx.setNewFx(""); } catch (e) { /* fine */ } }); } catch { /* closed */ }
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
