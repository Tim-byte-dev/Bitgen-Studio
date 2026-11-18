#!/usr/bin/env node
/* bitGen Studio — 2.839.0 in a REAL browser: a document's figure dragged with the Move tool moves its place in the text,
 * and laid out beside the text (◧ / ◨, bigger / smaller, ▭ full width). Tim: "Drag a figure's layer to move its place in the
 * text. Let text wrap beside a figure instead of each one taking the full width."
 *   Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docFig, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1600px;height:900px;z-index:9999"; });
    await p.waitForTimeout(400);
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 1200; c.height = 1400; const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 1200, 1400); window.imageEditorInstance.load(c.toDataURL("image/png"), "f839"); setTimeout(() => { window.imageEditorInstance.E.fitView(); ok(); }, 800); }));
    const order = (html) => [...html.matchAll(/<p([^>]*)>(?:<i>)?([^<]*)/g)].map((m) => (/data-fig/.test(m[1]) ? "FIG" : m[2].slice(0, 8)));
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S;
      const A = E.docText.addFrame(50, 40, 1100, 1300, {}, false); E.docText.end();
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#e02020"/></svg>';
      const N = E.makeLayer("📊 test chart"); N.anchor = { flow: A.doc.flow.id, fig: "t1", box: null, src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), drawn: false };
      S.layers.push(N); S.active = S.layers.indexOf(N); E.renderLayersPanel();
      A.doc.html = E.docText.sanitize("<p>Intro one.</p><p>Intro two.</p>" + '<p data-fig="t1" style="padding-top:150px"><i>Figure 1: red</i></p>' + [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<p>Later ${n} - a line of words that runs on long enough to wrap beside a figure that sits on one side of the column.</p>`).join(""));
      E.docText.reflow(A.doc.flow.id); window.__t = { A, N }; });
    await p.waitForTimeout(600);
    const st = () => ev(() => { const { A, N } = window.__t, b = N.anchor.box, P = (x, y) => Array.from(N.canvas.getContext("2d").getImageData(x, y, 1, 1).data); return { html: A.doc.html, box: b, mid: b && P(b.x + (b.w >> 1), b.y + (b.h >> 1)) }; });
    const s0 = await st();
    check("a figure at its place (after the two intro lines), drawn there", s0.box && s0.mid[0] > 200 && s0.mid[3] === 255 && order(s0.html)[2] === "FIG", { box: s0.box, order: order(s0.html) });
    // drag it with the Move tool, down ~ 5 paragraphs
    await ev(() => { const E = window.imageEditorInstance.E, { N } = window.__t; E.setActive(E.S.layers.indexOf(N)); E.setTool("move"); });
    const sp = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + x * E.S.zoom, r.top + E.S.panY + y * E.S.zoom]; }, [x, y]);
    const a = await sp(s0.box.x + s0.box.w / 2, s0.box.y + s0.box.h / 2), z = await ev(() => window.imageEditorInstance.E.S.zoom);
    await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(a[0] + 3, a[1] + 40 * z, { steps: 3 }); await p.mouse.move(a[0] + 5, a[1] + 420 * z, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(900);
    const s1 = await st();
    const o1 = order(s1.html), fi = o1.indexOf("FIG");
    check("dragged down with the Move tool: its place moves further down the text (after later paragraphs), the figure drawn exactly at the new place, sharp",
      fi > 4 && s1.box.y > s0.box.y + 150 && s1.mid[0] > 200 && s1.mid[3] === 255 && s1.box.x === s0.box.x, { o1, box: s1.box, mid: s1.mid });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(600);
    const s2 = await st();
    check("…Ctrl+Z puts its place back", order(s2.html).indexOf("FIG") === 2 && Math.abs(s2.box.y - s0.box.y) < 3, { o: order(s2.html), box: s2.box });
    // beside the text
    const menu = await ev(() => { const E = window.imageEditorInstance.E, { A, N } = window.__t, c = E.ui.CMD.get("figure.left"); E.setActive(E.S.layers.indexOf(A)); const offFig = c.hidden; E.setActive(E.S.layers.indexOf(N)); return { offFig, onFig: c.hidden, inCtx: (E.ui.stageCtxItems || []).includes("figure.left") }; });
    check("◧ / ◨ / ▭ / ＋ / － are on the right-click and the Layer menu only while a figure is picked", menu.offFig === true && menu.onFig === false && menu.inCtx, menu);
    await ev(() => window.imageEditorInstance.E.ui.run("figure.left")); await p.waitForTimeout(600);
    const s3 = await st();
    const beside = await ev(() => { const { A } = window.__t, m = PCDocText.measure(document, A.doc.html, A.doc.w / A.doc.k), f = m.figs[0], i = m.blocks.findIndex((x) => x.fig); return { fig: f, next: m.blocks[i + 1] }; });
    check("◧ Left - Text Beside: half the column on the left, the text after it flows beside it (its first line next to the picture)",
      /float: ?left/.test(s3.html) && s3.box.x === s0.box.x && s3.box.w < s0.box.w * 0.55 && s3.mid[0] > 200 && beside.next.top < beside.fig.bottom - 10, { box: s3.box, beside });
    await ev(() => window.imageEditorInstance.E.ui.run("figure.bigger")); await p.waitForTimeout(500);
    const s4 = await st();
    check("＋ Bigger: wider beside the text (a twelfth of the column more)", /width: ?58\.3%/.test(s4.html) && s4.box.w > s3.box.w, { box: s4.box });
    // a figure beside the text dragged to the right half -> the right side
    const c = await sp(s4.box.x + s4.box.w / 2, s4.box.y + s4.box.h / 2), fr = await ev(() => { const { A } = window.__t; return { x: A.doc.x, w: A.doc.w }; });
    await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] + 40 * z, c[1], { steps: 3 }); await p.mouse.move(c[0] + (fr.x + fr.w * 0.8 - (s4.box.x + s4.box.w / 2)) * z, c[1] + 5, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(900);
    const s5 = await st();
    check("…dragged onto the frame's right half: it goes to the right side, the text beside it on the left", /float: ?right/.test(s5.html) && s5.box.x + s5.box.w > fr.x + fr.w - 3 && s5.mid[0] > 200, { box: s5.box });
    await ev(() => window.imageEditorInstance.E.ui.run("figure.full")); await p.waitForTimeout(500);
    const s6 = await st();
    check("▭ Full Width: the whole column again", !/float/.test(s6.html) && s6.box.w > s0.box.w - 4, { box: s6.box });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
