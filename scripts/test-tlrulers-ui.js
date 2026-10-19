#!/usr/bin/env node
/* bitGen Studio — 2.446.0 in a REAL browser: RULERS, GUIDELINES AND SNAPPING on the timeline's preview canvas
 * (tlgrid.js). Tim: "add rulers, guidelines and grid to the preview canvas in video docker too(like how coreldraw
 * impliments them)". Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the timeline rulers browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + ".png") }); };
  let before = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlGrid && window.TlCanvas && document.getElementById("tlRulerBtn"), null, { timeout: 60000 });
    await p.waitForFunction(() => typeof cfg === "object" && cfg && cfg.ui, null, { timeout: 20000 }).catch(() => null);
    before = await ev(() => ({ r: !!(cfg.ui || {}).tl_rulers, g: (cfg.ui || {}).tl_grid || null }));
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      ["imageeditdock", "promptdock"].forEach((id) => { const x = document.getElementById(id); if (x && /pf-float/.test(x.className)) x.style.visibility = "hidden"; });
      setVar("th", 900);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      if (window.TlFloat) TlFloat.show(false);
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tl.guides = []; tlSave(); renderTimeline();
      TlGrid.save({ tl_rulers: false, tl_grid: H3Grid.clean({ on: false, snap: 8 }) });
    });
    await p.waitForTimeout(800);
    const pos = (x, y) => ev(([x, y]) => { const S = TlCanvas.state, r = document.getElementById("tlCanvas").getBoundingClientRect(); return [r.left + S.view.ox + x * S.view.z, r.top + S.view.oy + y * S.view.z]; }, [x, y]);

    /* 1 📏 */
    const b1 = await ev(() => { const x = document.getElementById("tlRulerBtn"); return { after: x.previousElementSibling && x.previousElementSibling.id }; });
    await p.click("#tlRulerBtn"); await p.waitForTimeout(400);
    const r1 = await ev(() => { const t = document.getElementById("tlRulerTop"), l = document.getElementById("tlRulerLeft"), c = t.querySelector("canvas"), g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) ink++;
      return { shown: getComputedStyle(t).display !== "none" && getComputedStyle(l).display !== "none", ink, on: TlGrid.rulersOn(), btn: document.getElementById("tlRulerBtn").classList.contains("on") }; });
    check("📏 in the timeline's menu bar (after ⊞) shows rulers along the top and the left of the preview canvas (ticks + numbers drawn), kept on", b1.after === "tlGridBtn" && r1.shown && r1.ink > 50 && r1.on && r1.btn, { b1, r1 });

    /* 2 guidelines dragged out of the rulers */
    const top = await ev(() => { const r = document.getElementById("tlRulerTop").getBoundingClientRect(); return [r.left + r.width / 2, r.top + 9]; });
    const [gx, gy] = await pos(200, 100);
    await p.mouse.move(top[0], top[1]); await p.mouse.down(); await p.mouse.move(gx, gy, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    const left = await ev(() => { const r = document.getElementById("tlRulerLeft").getBoundingClientRect(); return [r.left + 9, r.top + r.height / 2]; });
    await p.mouse.move(left[0], left[1]); await p.mouse.down(); await p.mouse.move(gx, gy, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    const g2 = await ev(() => tl.guides.map((q) => [q.o, q.p]));
    await shot("2-guides");
    check("dragged from the top ruler: a horizontal guideline (y 100), from the left ruler: a vertical one (x 200) - in picture pixels", g2.length === 2 && g2[0][0] === "h" && Math.abs(g2[0][1] - 100) <= 1 && g2[1][0] === "v" && Math.abs(g2[1][1] - 200) <= 1, g2);
    const saved = await ev(() => { try { return JSON.parse(store.get("tl", "{}")).guides.length; } catch (e) { return -1; } });
    check("...saved with the timeline", saved === 2, saved);

    /* 3 a layer moved near them snaps */
    await ev(() => { TlCanvas.addText({ x: 420, y: 300 }); document.activeElement && document.activeElement.blur && document.activeElement.blur(); TlCanvas.setTool("move"); });
    await p.waitForTimeout(900);
    const b3 = await ev(() => { const s = TlCanvas.state, sel = tl.images[tl.images.length - 1].clips[0], bb = TlCanvas.box(sel, "i"); return { cx: bb.cx, cy: bb.cy, w: bb.w, h: bb.h }; });
    // drag so its left edge comes within ~4 px of the vertical guideline (200) and its top within ~3 of the horizontal (100) - away from the picture's centre lines
    const want = { dx: 200 - (b3.cx - b3.w / 2) + 4, dy: 100 - (b3.cy - b3.h / 2) - 3 };
    const [sx0, sy0] = await pos(b3.cx, b3.cy), [sx1, sy1] = await pos(b3.cx + want.dx, b3.cy + want.dy);
    await p.mouse.move(sx0, sy0); await p.mouse.down(); await p.mouse.move(sx1, sy1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
    const a3 = await ev(() => { const sel = tl.images[tl.images.length - 1].clips[0], bb = TlCanvas.box(sel, "i"); return { left: bb.cx - bb.w / 2, top: bb.cy - bb.h / 2, z: TlCanvas.state.view.z }; });
    check("moving a layer (Move tool) near the guidelines SNAPS it: its left edge onto x 200, its top onto y 100", Math.abs(a3.left - 200) <= 1 && Math.abs(a3.top - 100) <= 1, { a3, b3, want });
    // Alt = no snapping
    const [ax0, ay0] = await pos(a3.left + b3.w / 2, a3.top + b3.h / 2), [ax1, ay1] = await pos(a3.left + b3.w / 2 + 5, a3.top + b3.h / 2 + 4);
    await p.keyboard.down("Alt"); await p.mouse.move(ax0, ay0); await p.mouse.down(); await p.mouse.move(ax1, ay1, { steps: 6 }); await p.mouse.up(); await p.keyboard.up("Alt"); await p.waitForTimeout(300);
    const a4 = await ev(() => { const sel = tl.images[tl.images.length - 1].clips[0], bb = TlCanvas.box(sel, "i"); return { left: bb.cx - bb.w / 2, top: bb.cy - bb.h / 2 }; });
    check("...Alt held: it moves freely (not back onto the guidelines)", Math.abs(a4.left - 200) > 2 && Math.abs(a4.top - 100) > 2, a4);

    /* 4 a guideline moved, then dragged back onto its ruler (removed) */
    await ev(() => TlCanvas.select(null, null));
    const [hx, hy] = await pos(60, 100), [hx2, hy2] = await pos(60, 160);
    await p.mouse.move(hx, hy); await p.mouse.down(); await p.mouse.move(hx2, hy2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    const g4 = await ev(() => tl.guides.filter((q) => q.o === "h").map((q) => q.p));
    const [vx, vy] = await pos(200, 40), lr = await ev(() => { const r = document.getElementById("tlRulerLeft").getBoundingClientRect(); return [r.left + 8, r.top + r.height / 2]; });
    await p.mouse.move(vx, vy); await p.mouse.down(); await p.mouse.move(lr[0], lr[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
    const g5 = await ev(() => tl.guides.map((q) => [q.o, q.p]));
    check("the Move tool drags a guideline (y 100 -> 160); dropped back onto its ruler it is removed", g4.length === 1 && Math.abs(g4[0] - 160) <= 1 && g5.length === 1 && g5[0][0] === "h", { g4, g5 });

    /* 5 with the grid on, a layer snaps to the grid */
    await ev(() => { TlGrid.save({ tl_grid: H3Grid.clean({ on: true, spacing: 100, snap: 8 }) }); tl.guides = []; tlSave(); TlGrid.redraw(); });
    const b5 = await ev(() => { const sel = tl.images[tl.images.length - 1].clips[0], bb = TlCanvas.box(sel, "i"); return { cx: bb.cx, cy: bb.cy, w: bb.w, h: bb.h }; });
    const tx = 400 - (b5.cx - b5.w / 2) + 3, ty = 500 - (b5.cy - b5.h / 2) - 2;
    const [cx0, cy0] = await pos(b5.cx, b5.cy), [cx1, cy1] = await pos(b5.cx + tx, b5.cy + ty);
    await p.mouse.move(cx0, cy0); await p.mouse.down(); await p.mouse.move(cx1, cy1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
    const a5 = await ev(() => { const sel = tl.images[tl.images.length - 1].clips[0], bb = TlCanvas.box(sel, "i"); return { left: bb.cx - bb.w / 2, top: bb.cy - bb.h / 2 }; });
    await shot("5-grid");
    check("the grid on (⊞): a moved layer snaps to the grid's lines too (left 400, top 500)", Math.abs(a5.left - 400) <= 1 && Math.abs(a5.top - 500) <= 1, a5);
    await p.click("#tlRulerBtn"); await p.waitForTimeout(200);
    check("📏 again: the rulers hidden", await ev(() => getComputedStyle(document.getElementById("tlRulerTop")).display === "none" && !TlGrid.rulersOn()));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    try { await ev((bf) => { TlGrid.save({ tl_rulers: bf ? bf.r : false, tl_grid: bf && bf.g ? bf.g : { on: false } }); tl.images = []; tl.guides = []; tlSave(); }, before); } catch { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
