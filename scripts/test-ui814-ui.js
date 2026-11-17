#!/usr/bin/env node
/* bitGen Studio — 2.814.0 against the RUNNING app (+ a real browser): document text saved as a Word file (.docx) and a
 * .docx opened as document text - File ▸ Export ▸ Word Document (.docx)…, File ▸ Open Word Document (.docx)….
 * Tim (verbatim): "lets do next" (the WORD PLAN's step 3: .docx out + in with margins, headers, footers). No Playwright = SKIP. */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1900, height: 1100 }, acceptDownloads: true });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* fine */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docx, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await p.waitForTimeout(600);
    const menu = await ev(() => { const F = window.imageEditorInstance.E.ui.MENUS.find(([x]) => x === "File"); return F[1].filter((x) => typeof x === "string"); });
    check("File menu: 📂 Open Word Document right after New Text Document; Word Document (.docx)… among the exports", menu.indexOf("file.opendocx") === menu.indexOf("file.newtextdoc") + 1 && menu.indexOf("file.exportdocx") > menu.indexOf("file.export"), menu);

    // a document with a style, formatting, a list, a table, then page numbers on the master
    await ev(() => window.imageEditorInstance.E.ui.run("file.newtextdoc")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdnDpi").value = "96"; d.querySelector("#pdnMargin").value = "20"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(800);
    await ev(() => { const e = document.querySelector(".pcdocedit .pcdoc");
      e.innerHTML = '<p data-style="title">Quarterly Notes</p><p style="text-align: justify">Some <b>bold</b> and <i>italic</i> words, <span style="color: rgb(200, 0, 0)">red</span>.</p><ul><li>first point</li><li>second point</li></ul>'
        + '<table style="table-layout: fixed"><colgroup><col style="width: 40%"><col style="width: 60%"></colgroup><thead><tr><th>Item</th><th>Cost</th></tr></thead><tbody><tr><td>Paper</td><td>12</td></tr></tbody></table><p><br></p>';
      e.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
    await ev(() => window.imageEditorInstance.E.ui.run("page.number")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); const f = d.querySelector("#pgnF"); f.value = "Page {page} of {pages}"; f.dispatchEvent(new Event("change")); d.querySelector(".ok").click(); });
    await p.waitForTimeout(800);
    const m = await ev(() => window.imageEditorInstance.E.docx.model());
    check("the model: title, justified paragraph with bold / italic / red, 2 bullets, a 40 / 60 table with a header row", m && m.blocks[0].style === "title" && m.blocks[1].align === "justify" && m.blocks[1].runs.some((r) => r.b) && m.blocks.filter((b) => b.list).length === 2 && (() => { const t = m.blocks.find((b) => b.t === "table"); return t && t.headerRows === 1 && t.widths[0] === 40; })(), m && m.blocks);
    check("the page: A4, margins 20 mm from the frame", m && Math.abs(m.page.wmm - 210) < 0.5 && Math.abs(m.page.hmm - 297) < 0.5 && Math.abs(m.page.margins.left - 20) < 0.5 && Math.abs(m.page.margins.top - 20) < 0.5, m && m.page);
    check("the footer: the master's page number as Word page fields (Page {page} of {pages})", m && m.footer.length === 1 && m.footer[0].runs.some((r) => r.field === "page") && m.footer[0].runs.some((r) => r.field === "pages"), m && m.footer);

    // save it through the dialog
    await ev(() => window.imageEditorInstance.E.ui.run("file.exportdocx")); await p.waitForTimeout(300);
    const dtext = await ev(() => document.querySelector(".kxdlg.pcd").textContent);
    check("the Save dialog says what goes in (paragraphs / tables, footer ✓) and that Word paginates itself", /Footer: ✓/.test(dtext) && /Word lays out pages itself/.test(dtext), dtext);
    await p.fill(".kxdlg.pcd #pdxName", "notes814");
    const dl = p.waitForEvent("download", { timeout: 15000 }).catch(() => null);
    await p.click(".kxdlg.pcd .ok");
    const d = await dl;
    check("💾 Save downloads notes814.docx", !!d && d.suggestedFilename() === "notes814.docx", d && d.suggestedFilename());
    const list = await (await fetch(URL_ + "api/docx/list")).json();
    check("…and keeps it in the project's docs folder", list.files.some((f) => f.name === "notes814.docx" && f.size > 4000), list);
    const bytes = Buffer.from(await (await fetch(URL_ + "api/docx/file/notes814.docx")).arrayBuffer());
    check("the file is a Word document (zip, word/document.xml)", bytes[0] === 0x50 && bytes.includes(Buffer.from("word/document.xml")), bytes.length);

    // open it again as a new text document
    const pagesBefore = await ev(() => window.imageEditorInstance.E.pages.count ? window.imageEditorInstance.E.pages.count() : 0);
    const L = await ev(async (b64) => {
      const E = window.imageEditorInstance.E, bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const o = await E.docx.openBytes(u.buffer, "notes814.docx"); const L = E.docx.place(o, { size: "A4", margin: 25, dpi: 96 });
      return { html: L.doc.html, type: L.type, name: E.S ? E.S.name : "", w: E.S ? E.S.w : 0 };
    }, bytes.toString("base64"));
    check("Open: a new document holding one document frame with the file's words", L.type === "doc" && /Quarterly Notes/.test(L.html) && /first point/.test(L.html), L);
    check("Open: title style, bold, list, table header kept", /data-style="title"/.test(L.html) && /<(strong|b)>bold<\/(strong|b)>/.test(L.html) && /<ul><li>/.test(L.html) && /<th>/.test(L.html), L.html.slice(0, 700));
    await p.waitForFunction(() => window.imageEditorInstance.E.docText.ready(), null, { timeout: 15000 }).catch(() => null);
    const drawn = await ev(() => { const E = window.imageEditorInstance.E, S = E.S || {}, Ld = (S.layers || []).find((x) => x.type === "doc"); if (!Ld || !Ld.canvas) return -1; const g = Ld.canvas.getContext("2d"), d = g.getImageData(0, 0, Ld.canvas.width, Ld.canvas.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
    check("the opened frame is drawn (ink on its layer)", drawn > 500, drawn);
    // the File ▸ Open dialog itself
    await ev(() => window.imageEditorInstance.E.ui.run("file.opendocx")); await p.waitForTimeout(300);
    const od = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return { file: !!d.querySelector('#pdxFile[type="file"][accept*=".docx"]'), size: d.querySelector("#pdxSize").value, margin: d.querySelector("#pdxMargin").value }; });
    check("File ▸ Open Word Document: a .docx picker, the page size (A4) and margins (25 mm)", od.file && od.size === "A4" && od.margin === "25", od);
    await p.setInputFiles(".kxdlg.pcd #pdxFile", { name: "again.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: bytes });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(1500);
    const again = await ev(() => { const S = window.imageEditorInstance.E.S || {}; const Ld = (S.layers || []).find((x) => x.type === "doc"); return Ld ? Ld.doc.html : ""; });
    check("…the dialog opens the picked file as document text", /Quarterly Notes/.test(again) && /<table/.test(again), again.slice(0, 300));
    void pagesBefore;
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing: " + e.message, false); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
