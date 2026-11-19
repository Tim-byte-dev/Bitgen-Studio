#!/usr/bin/env node
/* bitGen Studio — 2.884.0 in a REAL browser: 📇 the business card sheet - a two-page 90 × 55 mm card (Front red, Back blue) in the
 * image editor, File ▸ 📇 Business Card Sheet…: the box (the card's size, 10 on A4 portrait, the preview with cut marks), 📇 Make the
 * PDF: two A4 pages saved in the project's pdf folder - read back with pdf.js: page 1 red cards, page 2 blue, the marks drawn.
 * Tim (verbatim): "will the business cards be printable" -> "yes, please add the next steps" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 }, acceptDownloads: true });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let saved = "";
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.cardSheet && window.imageEditorInstance.E.pages, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    // a two-page card: Front red, Back blue (each page's background filled)
    await ev(async () => {
      const E = window.imageEditorInstance.E;
      E.pages.newDocument({ preset: "Custom", wmm: 90, hmm: 55, orient: "landscape", dpi: 300 }, 2, "UI884 card");
      E.pages.rename(0, "Front"); E.pages.rename(1, "Back");
      for (const [i, col] of [[0, "#d02020"], [1, "#2040d0"]]) {
        E.pages.go(i); const L = E.S.layers[0], g = L.canvas.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, L.canvas.width, L.canvas.height); E.refresh();
      }
      E.pages.go(0);
    });
    await p.click('.pcmenu [data-menu="File"], .pcmenu .mi:has-text("File")').catch(() => {});
    await ev(() => window.imageEditorInstance.E.ui.run ? window.imageEditorInstance.E.ui.run("file.cardsheet") : window.imageEditorInstance.E.cardSheet.open());
    await p.waitForSelector("#pccsPaper", { timeout: 10000 });
    const box = await ev(() => ({ card: document.getElementById("pccsCard").textContent, info: document.getElementById("pccsInfo").textContent, rects: document.querySelectorAll("#pccsPrev rect").length, lines: document.querySelectorAll("#pccsPrev line").length, backs: !!document.getElementById("pccsBacks") && document.getElementById("pccsBacks").checked }));
    check("📇 the box: the card 90 × 55 mm, '10 cards (2 × 5) on A4 portrait', the preview with 10 cards + 18 cut marks, backs on page 2 ticked", box.card === "90 × 55 mm" && /^10 cards \(2 × 5\) on A4 portrait/.test(box.info) && box.rects === 10 && box.lines === 18 && box.backs, box);
    await p.selectOption("#pccsPaper", "letter");
    const let_ = await ev(() => document.getElementById("pccsInfo").textContent);
    await p.selectOption("#pccsPaper", "a4");
    check("...US Letter (279 mm tall) holds 8 of these (2 × 4) - the 10 mm margins the printer and the marks need", /^8 cards \(2 × 4\) on US Letter portrait/.test(let_), let_);
    const dl = p.waitForEvent("download", { timeout: 20000 });
    await p.click(".kxdlg.pcd .ok");
    const d = await dl;
    await p.waitForFunction(() => window.imageEditorInstance.E.cardSheet.last, null, { timeout: 20000 });
    const last = await ev(() => window.imageEditorInstance.E.cardSheet.last); saved = last.name;
    check("📇 Make the PDF: downloaded as '<card> - card sheet.pdf', saved in the project's pdf folder, both sides", /card sheet\.pdf$/.test(d.suggestedFilename()) && last.sides === 2 && last.layout.n === 10 && last.size > 3000, { name: d.suggestedFilename(), last });
    const pdf = await ev(async (name) => {
      const s = document.createElement("script"); s.src = "/static/vendor/pdf.min.js"; document.head.appendChild(s); await new Promise((ok) => { s.onload = ok; if (window.pdfjsLib) ok(); });
      const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = "/static/vendor/pdf.worker.min.js";
      const doc = await lib.getDocument("/api/pdf/file/" + encodeURIComponent(name)).promise, out = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1 }), c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        const g = c.getContext("2d"), at = (mmx, mmy) => [...g.getImageData(Math.round(mmx * 72 / 25.4), Math.round(mmy * 72 / 25.4), 1, 1).data].slice(0, 3);
        const txt = (await pg.getTextContent()).items.map((x) => x.str).join(" ");
        out.push({ w: Math.round(vp.width), h: Math.round(vp.height), card: at(60, 38), between: at(105, 3), gap: at(5, 150), mark: at(105, 7), txt });
      }
      return out;
    }, saved);
    check("read back: 2 A4 pages (595 × 842 pt); page 1 red cards, page 2 blue; white margins; a cut mark (a thin line) at the middle column's top", pdf.length === 2 && pdf[0].w === 595 && pdf[0].h === 842
      && pdf[0].card[0] > 180 && pdf[0].card[2] < 80 && pdf[1].card[2] > 180 && pdf[1].card[0] < 80 && pdf[0].gap.every((v) => v > 240) && pdf[0].mark.every((v) => v < 240) && /FRONTS/.test(pdf[0].txt) && /BACKS/.test(pdf[1].txt), pdf);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    /* the PDF stays in the test server's project (no delete route) */
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
