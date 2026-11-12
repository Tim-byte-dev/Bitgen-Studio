#!/usr/bin/env node
/* bitGen Studio — 2.764.5 browser test: DROP A DOCKER ABOVE / BELOW ANOTHER ONE INSIDE A DOCKER, and FLOATING DOCKERS OVER
 * DOCKED ONES (static/floatpanels.js slotOf / edgeIn / stackWith, static/dgdock.js, static/dockgroup.js, static/floatz.js)
 * on a running studio (H3_URL, default :8311).
 * Tim (verbatim): "move floating dockers to the front of all docked dockers. add vertical drop zones to all dockers as well so
 * floating dockers can dock below or above another docker that is docked inside a docked docker if that makes sense"
 * The layout is put back afterwards. No server / no Playwright = SKIP. */
"use strict";
const fs = require("fs"), path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.764.5 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const LAYF = path.join(__dirname, "..", "panel_layout.cfg");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.764.5 browser test did not run"); process.exit(0); }
  let lay0 = null; try { lay0 = fs.readFileSync(LAYF); } catch { lay0 = null; }
  fs.rmSync(LAYF, { force: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL0, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Panels && window.H3DockGroup && window.H3DGDock && window.SecFloat && SecFloat.started && H3Panels.get("bd.musicdock"), null, { timeout: 60000 });
    await p.waitForTimeout(2500);
    await ev(() => { for (const k of Object.keys(SecFloat.windows)) SecFloat.show(k, false); });   // no floating dialog over the dockers
    const st = (id) => ev((i) => { const r = H3Panels.get(i); return r ? { state: r.state, docker: r.docker || null } : null; }, id);
    const tabsOf = (id) => ev((i) => (H3Panels.get(i) || {}).tabs || [], id);
    // a docker of yours, side by side, with two dockers in it
    await ev(() => {
      H3Panels.newDocker({ id: "t7645-row", name: "Mine", layout: "row" }); H3Panels.float("t7645-row", { x: 380, y: 120, w: 1000, h: 760 });
      H3Panels.float("bd.musicdock", { x: 60, y: 60, w: 400, h: 300 }); H3Panels.dockInto("bd.musicdock", "t7645-row");
      H3Panels.float("bd.sfxdock", { x: 60, y: 60, w: 400, h: 300 }); H3Panels.dockInto("bd.sfxdock", "t7645-row");
    });
    await p.waitForTimeout(600);
    check("set up: a side-by-side docker holding Music and SFX", JSON.stringify(await tabsOf("t7645-row")) === '["bd.musicdock","bd.sfxdock"]', await tabsOf("t7645-row"));
    const rectOf = (sel) => ev((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
    const drag = async (fromSel, to) => {
      const f = await rectOf(fromSel);
      await p.mouse.move(f.l + 30, f.t + Math.min(12, f.h / 2)); await p.mouse.down();
      await p.mouse.move(f.l + 50, f.t + 20, { steps: 3 }); await p.mouse.move(to.x, to.y, { steps: 18 });
      const mk = await ev(() => { const m = document.getElementById("h3fpZone") || document.getElementById("dgZone") || document.getElementById("dgDropLine"); if (!m || m.style.display === "none") return null; const r = m.getBoundingClientRect(); return { w: r.width, h: r.height, t: r.top, l: r.left }; });
      await p.mouse.up(); await p.waitForTimeout(900); return mk;
    };
    const winSel = (id) => '.h3fp[data-fp="' + id + '"]';
    // 1) a floating docker dropped on the TOP band of Music (inside the docker) = stacked above it
    await ev(() => H3Panels.float("bd.stemsdock", { x: 40, y: 200, w: 300, h: 260 })); await p.waitForTimeout(300);
    const mu = await rectOf(winSel("bd.musicdock"));
    const mk1 = await drag(winSel("bd.stemsdock") + " > .h3fp-t", { x: mu.l + mu.w / 2, y: mu.t + 14 });
    const tabs1 = await tabsOf("t7645-row"), stack = tabs1[0], inStack = await tabsOf(stack);
    check("the line: a horizontal bar across the top of Music while over its top band", mk1 && mk1.h <= 6 && mk1.w > mu.w * 0.8 && Math.abs(mk1.t - mu.t) < 8, { mk1, mu });
    check("dropped there: Music's place is a stacked docker holding Stems ABOVE Music; SFX still beside it", tabs1.length === 2 && tabs1[1] === "bd.sfxdock" && /^fd-/.test(stack) && JSON.stringify(inStack) === '["bd.stemsdock","bd.musicdock"]' && (await ev((i) => H3Panels.get(i).layout, stack)) === "col", { tabs1, inStack });
    // 2) another one on the BOTTOM band of SFX = stacked below it
    await ev(() => H3Panels.float("bd.chatdock", { x: 40, y: 200, w: 300, h: 260 })); await p.waitForTimeout(300);
    const sx = await rectOf(winSel("bd.sfxdock"));
    await drag(winSel("bd.chatdock") + " > .h3fp-t", { x: sx.l + sx.w / 2, y: sx.b - 12 });
    const tabs2 = await tabsOf("t7645-row"), st2 = tabs2[1];
    check("on SFX's bottom band: SFX + Chat stacked (Chat BELOW)", tabs2.length === 2 && JSON.stringify(await tabsOf(st2)) === '["bd.sfxdock","bd.chatdock"]', { tabs2, inner: await tabsOf(st2) });
    // 3) into a stack made earlier, between the two in it (its own slots)
    await ev(() => H3Panels.float("bd.consoledock", { x: 40, y: 200, w: 300, h: 260 })); await p.waitForTimeout(300);
    const s1 = await rectOf(winSel("bd.stemsdock")), m1 = await rectOf(winSel("bd.musicdock"));
    await drag(winSel("bd.consoledock") + " > .h3fp-t", { x: m1.l + m1.w / 2, y: (s1.b + m1.t) / 2 + 2 });
    check("over the gap inside a stack: it goes between them (Stems, Console, Music)", JSON.stringify(await tabsOf(stack)) === '["bd.stemsdock","bd.consoledock","bd.musicdock"]', await tabsOf(stack));
    // 4) a SecFloat docker window (PODS) dragged to the top band of SFX (static/dgdock.js)
    await ev(() => { SecFloat.show("pods", true); SecFloat.windows.pods.panel.float(60, 80, 420, 340); SecFloat.show("pods", true); }); await p.waitForTimeout(400);
    const sx2 = await rectOf(winSel("bd.sfxdock"));
    await drag("#sf-pods > .sfhead .sft", { x: sx2.l + sx2.w / 2, y: sx2.t + 12 });
    check("PODS (a docker window) on SFX's top band: into that stack above SFX", JSON.stringify(await tabsOf(st2)) === '["sf.pods","bd.sfxdock","bd.chatdock"]', await tabsOf(st2));
    // 5) the middle of a docker = beside it, as before (no stack)
    await ev(() => H3Panels.float("bd.refsdock", { x: 40, y: 200, w: 300, h: 260 })); await p.waitForTimeout(300);
    const tr = await rectOf(winSel("t7645-row") + " .h3fd-pane");
    await drag(winSel("bd.refsdock") + " > .h3fp-t", { x: tr.r - 6, y: tr.t + tr.h / 2 });
    check("the right edge, middle height: beside them, at the end (no stack)", JSON.stringify(await tabsOf("t7645-row")) === JSON.stringify([stack, st2, "bd.refsdock"]), await tabsOf("t7645-row"));
    // 6) a ▣ docker DOCKED in the main column (📌 Make permanent) with a docker in it: drop on that docker's bottom band
    await ev(() => { H3DockGroup.toggle(true); });
    await p.waitForFunction(() => H3DockGroup.shown(), null, { timeout: 8000 });
    await ev(() => { H3Panels.float("bd.qdock", { x: 40, y: 200, w: 300, h: 260 }); H3Panels.dockInto("bd.qdock", "fd-dockers"); H3DockGroup.makePerm("fd-dockers"); });
    await p.waitForTimeout(1200);
    await ev(() => H3Panels.float("bd.refsdock", { x: 900, y: 120, w: 300, h: 220 })); await p.waitForTimeout(300);
    const perm = await ev(() => { const r = H3Panels.get("fd-dockers"); return { state: r.state, perm: !!r.perm }; });
    const q = await rectOf(winSel("bd.qdock"));
    await drag(winSel("bd.refsdock") + " > .h3fp-t", { x: q.l + q.w / 2, y: q.b - 10 });
    const gt = await tabsOf("fd-dockers"), gs = gt[0];
    check("a ▣ docker docked in the main column: a floating docker on the bottom band of the docker inside it = stacked below it", perm.perm && gt.length === 1 && JSON.stringify(await tabsOf(gs)) === '["bd.qdock","bd.refsdock"]', { perm, gt, inner: await tabsOf(gs) });
    await ev(() => { try { H3DockGroup.unPerm("fd-dockers"); } catch (e) { /* fine */ } for (const i of ["bd.qdock", "bd.refsdock"]) H3Panels.float(i, { x: 40, y: 200, w: 300, h: 260 }); H3DockGroup.toggle(false); });
    await p.waitForTimeout(500);
    // floating dockers over docked ones: a docker confined to a docker, pressed, stays under a floating docker
    const host = await ev(() => { for (const i of ["ldock", "previewdock", "rdock", "qdock"]) { const e = document.getElementById(i); if (e && e.getBoundingClientRect().width > 200 && e.getBoundingClientRect().height > 300) return i; } return null; });
    await ev((h) => { const r = document.getElementById(h).getBoundingClientRect(); H3Panels.newDocker({ id: "t7645-conf", name: "Inside" }); H3Panels.confineTo("t7645-conf", h); H3Panels.float("t7645-conf", { x: r.left + 4, y: r.top + 30, w: r.width - 8, h: r.height - 60 }); }, host);
    await p.waitForTimeout(400);
    const hr = await rectOf("#" + host);
    await ev((r) => { H3Panels.float("t7645-row", { x: Math.round(r.l + 20), y: Math.round(r.t + 40), w: 700, h: 500 }); }, hr);
    await p.waitForTimeout(300);
    const ct = await ev(() => { const r = H3Panels.get("t7645-conf").win.querySelector(".h3fp-t").getBoundingClientRect(); return { x: r.right - 50, y: r.top + r.height / 2 }; });
    await ev((c) => { const t = document.elementFromPoint(c.x, c.y); t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: c.x, clientY: c.y })); }, ct);
    await p.waitForTimeout(200);
    const zz = await ev(() => ({ conf: +getComputedStyle(H3Panels.get("t7645-conf").win).zIndex, row: +getComputedStyle(H3Panels.get("t7645-row").win).zIndex }));
    check("a docker docked inside a docker (confined), even when pressed, stays UNDER the floating docker", zz.conf < zz.row && zz.conf >= 60, zz);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { for (const i of ["bd.musicdock", "bd.sfxdock", "bd.stemsdock", "bd.chatdock", "bd.consoledock", "bd.refsdock", "bd.qdock"]) { const r = H3Panels.get(i); if (r && r.home) H3Panels.home ? H3Panels.home(i) : 0; } for (const r of H3Panels.list()) if (/^fd-|^t7645/.test(r.id) && r.id !== "fd-dockers" && !/^fd-dockers/.test(r.id)) try { H3Panels.remove(r.id); } catch (e) { /* gone */ } SecFloat.show("pods", false); }); await p.waitForTimeout(600); } catch { /* fine */ }
    await b.close();
    if (lay0) fs.writeFileSync(LAYF, lay0); else fs.rmSync(LAYF, { force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
