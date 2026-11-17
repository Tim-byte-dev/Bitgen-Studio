#!/usr/bin/env node
/* bitGen Studio — 2.816.0 against the RUNNING app (+ a real browser): mail merge in document text - «» Merge ▾, the data
 * pasted, fields put in, Preview Results with ◀ / ▶, Finish & Merge (one .docx; a Word mail-merge pack).
 * Tim (verbatim): "lets go with next, we will do all the releases before i start testing". No Playwright = SKIP. */
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docMerge, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await p.waitForTimeout(600);
    await ev(() => window.imageEditorInstance.E.ui.run("file.newtextdoc")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdnDpi").value = "96"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(800);
    await p.keyboard.type("Dear ");
    await p.click("#kxOpts #pdmMenu"); await p.waitForTimeout(200);
    const items = await ev(() => [...[...document.querySelectorAll(".kxmenu")].pop().querySelectorAll("[data-cmd]")].map((d) => d.dataset.cmd));
    check("«» Merge ▾: Data Source…, Insert Merge Field…, Preview Results, ◀, ▶, Finish & Merge…", JSON.stringify(items) === JSON.stringify(["doc.merge.source", "doc.merge.field", "doc.merge.preview", "doc.merge.prev", "doc.merge.next", "doc.merge.finish"]), items);
    await ev(() => [...document.querySelectorAll(".kxmenu")].pop().querySelector('[data-cmd="doc.merge.source"]').click()); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdmText", "First Name,City\nAnna,Perth\nBo,Sydney\nCy,Hobart\n");
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const m0 = await ev(() => { const H = window.imageEditorInstance.E.docMerge.head(); return H && H.doc.merge; });
    check("the pasted data: 2 fields, 3 records", m0 && m0.fields.join() === "First Name,City" && m0.rows.length === 3, m0);
    await ev(() => window.imageEditorInstance.E.ui.run("doc.merge.field")); await p.waitForTimeout(200);
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    await p.keyboard.type(" from "); await ev(() => window.imageEditorInstance.E.docMerge.insertField("City")); await p.waitForTimeout(300); await p.keyboard.type(".");
    const h = await ev(() => document.querySelector(".pcdocedit .pcdoc").innerHTML.replace(/&nbsp;/g, " ").replace(/ contenteditable="false"/g, ""));
    check("Insert Merge Field puts «First Name» at the caret; «City» after it; typing goes on after them", /Dear <span data-field="First Name">«First Name»<\/span> from <span data-field="City">«City»<\/span>\./.test(h), h);
    await ev(() => window.imageEditorInstance.E.ui.run("doc.merge.preview")); await p.waitForTimeout(800);
    const v1 = await ev(() => { const H = window.imageEditorInstance.E.docMerge.head(); return { view: (H.doc.view || "").replace(/&nbsp;/g, " "), html: H.doc.html, editing: !!window.imageEditorInstance.E.docText.editing() }; });
    check("Preview Results: the frame shows record 1 (Anna from Perth); the story keeps its fields", /Dear Anna from Perth\./.test(v1.view) && /data-field="City"/.test(v1.html) && !v1.editing, v1);
    await ev(() => window.imageEditorInstance.E.ui.run("doc.merge.next")); await p.waitForTimeout(500);
    const v2 = await ev(() => (window.imageEditorInstance.E.docMerge.head().doc.view || "").replace(/&nbsp;/g, " "));
    check("▶ Next Record: Bo from Sydney", /Dear Bo from Sydney\./.test(v2), v2);
    await p.waitForFunction(() => window.imageEditorInstance.E.docText.ready(), null, { timeout: 15000 }).catch(() => null);
    await ev(() => window.imageEditorInstance.E.ui.run("doc.merge.preview")); await p.waitForTimeout(500);
    const v3 = await ev(() => { const d = window.imageEditorInstance.E.docMerge.head().doc; return d.view || ""; });
    check("Preview off: the fields shown again (no record view)", v3 === "", v3);
    // Finish & Merge: one document
    await ev(() => window.imageEditorInstance.E.ui.run("doc.merge.finish")); await p.waitForTimeout(300);
    await p.fill(".kxdlg.pcd #pdmName", "Letters816");
    const dl = p.waitForEvent("download", { timeout: 20000 }).catch(() => null);
    await p.click(".kxdlg.pcd .ok");
    const d1 = await dl;
    check("Finish & Merge ▸ one Word document: Letters816.docx downloaded", !!d1 && d1.suggestedFilename() === "Letters816.docx", d1 && d1.suggestedFilename());
    const JSZip = require("jszip");
    const z = await JSZip.loadAsync(Buffer.from(await (await fetch(URL_ + "api/docx/file/Letters816.docx")).arrayBuffer())), x = await z.file("word/document.xml").async("string");
    check("…with all three letters, each after the first on a new page", /Anna/.test(x) && /Sydney/.test(x) && /Hobart/.test(x) && (x.match(/<w:pageBreakBefore\/>/g) || []).length === 2);
    // the Word pack, records 2-3
    await ev(() => window.imageEditorInstance.E.ui.run("doc.merge.finish")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdmMode").value = "word"; d.querySelector("#pdmName").value = "Letters816"; });
    const dl2 = p.waitForEvent("download", { timeout: 20000 }).catch(() => null);
    await p.click(".kxdlg.pcd .ok");
    const d2 = await dl2;
    check("…▸ Word mail-merge document: Letters816 - mail merge.zip", !!d2 && d2.suggestedFilename() === "Letters816 - mail merge.zip", d2 && d2.suggestedFilename());
    await ev(() => window.imageEditorInstance.E.ui.run("doc.merge.finish")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdmMode").value = "each"; d.querySelector("#pdmAll").value = "range"; d.querySelector("#pdmFrom").value = "2"; d.querySelector("#pdmTo").value = "3"; d.querySelector("#pdmName").value = "Each816"; });
    const dl3 = p.waitForEvent("download", { timeout: 20000 }).catch(() => null);
    await p.click(".kxdlg.pcd .ok"); const d3 = await dl3;
    const z3 = d3 ? await JSZip.loadAsync(Buffer.from(await (await fetch(URL_ + "api/docx/file/Each816.zip")).arrayBuffer())) : null;
    check("…▸ one per record, records 2-3: two files named «#» - «First Name»", !!z3 && JSON.stringify(Object.keys(z3.files).sort()) === JSON.stringify(["2 - Bo.docx", "3 - Cy.docx"]), z3 && Object.keys(z3.files));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing: " + e.message, false); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
