#!/usr/bin/env node
/* bitGen Studio — 2.488.0 in a REAL browser: PDF PAGES ADDED, TAKEN OUT AND MOVED (ext/imageeditdock/pcpdf.js) - the
 * image editor's gap, round H. Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the PDF pages browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const PL = require(path.join(ROOT, "static", "vendor", "pdf-lib.min.js"));
  const make = async (names) => { const d = await PL.PDFDocument.create(), f = await d.embedFont(PL.StandardFonts.Helvetica); for (const n of names) { const pg = d.addPage([300, 400]); pg.drawText(n, { x: 40, y: 300, size: 24, font: f }); } return Buffer.from(await d.save()); };
  const three = await make(["Page A", "Page B", "Page C"]), extra = await make(["Extra page"]);
  const b = await chromium.launch(); global.__b = b;
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.pdf && window.imageEditorInstance.E.pdf.addBlank, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await p.setInputFiles("#pcPdfFile", { name: "three.pdf", mimeType: "application/pdf", buffer: three });
    await p.waitForFunction(() => { const P = window.imageEditorInstance.E.pdf.state(); return P && P.cur === 0; }, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    const st = () => ev(() => { const E = window.imageEditorInstance.E, P = E.pdf.state(); return { n: P.n, cur: P.cur, order: P.order.map((e) => (e.f < 0 ? "blank" : e.f + ":" + e.p)), name: E.S.name, on: E.pdf.onPage(), strip: document.querySelectorAll("#pcPdfPanel [data-pg]").length }; });
    const ops = await ev(() => ["#pdfAdd", "#pdfIns", "#pdfUp", "#pdfDown", "#pdfDel"].map((s) => !!document.querySelector("#pcPdfPanel " + s)));
    check("the Pages strip: ＋ Page, ⤓ PDF…, ▲, ▼, 🗑", ops.every(Boolean), ops);
    // 1 a blank page after page 1
    await p.click("#pcPdfPanel #pdfAdd"); await p.waitForTimeout(400);
    const s1 = await st();
    check("＋ Page: a blank page after the open one (4 pages: A, blank, B, C); the strip shows 4", s1.n === 4 && s1.order.join() === "0:0,blank,0:1,0:2" && s1.strip === 4 && s1.cur === 0, s1);
    // 2 C to the front (as a drag in the strip does)
    await ev(() => window.imageEditorInstance.E.pdf.movePage(3, 0)); await p.waitForTimeout(300);
    const s2 = await st();
    check("moved: C first - the open page (A) is now page 2 and stays open", s2.order.join() === "0:2,0:0,blank,0:1" && s2.cur === 1 && s2.on && / page 2\.png$/.test(s2.name), s2);
    await p.click("#pcPdfPanel #pdfUp"); await p.waitForTimeout(300);
    const s2b = await st();
    check("▲: the open page one up", s2b.order.join() === "0:0,0:2,blank,0:1" && s2b.cur === 0 && s2b.on, s2b);
    await p.click("#pcPdfPanel #pdfDown"); await p.waitForTimeout(300);
    // 3 B taken out while open
    await ev(() => window.imageEditorInstance.E.pdf.openPage(3)); await p.waitForFunction(() => window.imageEditorInstance.E.pdf.state().cur === 3, null, { timeout: 20000 });
    await p.click("#pcPdfPanel #pdfDel"); await p.waitForTimeout(1200);
    const s3 = await st();
    check("🗑: the open page (B) taken out - the one before it opens (the blank page)", s3.n === 3 && s3.order.join() === "0:2,0:0,blank" && s3.cur === 2 && s3.on, s3);
    // 4 paint on the blank page
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; E.pxOp ? E.pxOp("paint", (c, g) => { g.fillStyle = "#ff0000"; g.fillRect(50, 50, 200, 200); }) : null; E.refresh(); });
    await p.waitForTimeout(300);
    // 5 another PDF's pages after it
    await ev((bytes) => window.imageEditorInstance.E.pdf.insertBuffer(new Uint8Array(bytes).buffer, "extra.pdf"), Array.from(extra));
    await p.waitForTimeout(800);
    const s5 = await st();
    check("⤓ PDF…: the other PDF's page added after the open one", s5.n === 4 && s5.order.join() === "0:2,0:0,blank,1:0" && s5.cur === 2, s5);
    // 6 the saved file
    const out = await ev(async () => {
      const E = window.imageEditorInstance.E, { bytes, notes } = await E.pdf.toBytes({}), L = window.pdfjsLib, pdf = await L.getDocument({ data: bytes.slice(0) }).promise, texts = [];
      for (let i = 1; i <= pdf.numPages; i++) { const pg = await pdf.getPage(i), tc = await pg.getTextContent(), ops = await pg.getOperatorList(); texts.push({ t: tc.items.map((x) => x.str).join(" ").trim(), img: ops.fnArray.includes(L.OPS.paintImageXObject) }); }
      return { n: pdf.numPages, texts, notes, edited: E.pdf.isEdited(2) };
    });
    check("saved: 4 pages in the new order - C and A still real text, the painted blank page a picture, the extra page's text", out.n === 4 && out.texts[0].t === "Page C" && out.texts[1].t === "Page A" && out.texts[2].img && out.texts[2].t === "" && out.texts[3].t === "Extra page" && !out.texts[0].img && out.edited, out);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
