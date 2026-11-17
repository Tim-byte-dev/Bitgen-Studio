#!/usr/bin/env node
/* bitGen Studio — 2.815.0 against the RUNNING app (+ a real browser): comments and footnotes in document text - 💬 New
 * Comment on selected words, the comments list (resolve, delete), ¹ footnotes numbered and drawn at the foot of the frame
 * that shows their mark (also on page 2), both in the .docx and back.
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1900, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* fine */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docNotes, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await p.waitForTimeout(600);
    await ev(() => window.imageEditorInstance.E.ui.run("file.newtextdoc")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdnDpi").value = "96"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(800);
    const bar = await ev(() => ["pdnCmt", "pdnCmtList", "pdnFn"].map((id) => !!document.querySelector("#kxOpts #" + id)));
    check("the Document Text bar: 💬, 💬☰ and ¹ Note beside ▦ Table", bar.every(Boolean), bar);
    // the story: a first paragraph, then enough to run onto page 2
    await ev(() => { const e = document.querySelector(".pcdocedit .pcdoc"); const filler = Array.from({ length: 70 }, (_, i) => `<p>Line ${i + 1} of the long part of the story.</p>`).join("");
      e.innerHTML = "<p>The first claim needs a source here and the comment goes on these words.</p>" + filler + "<p>The last claim.</p>";
      e.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.waitForTimeout(400);
    // 💬 comment on "these words"
    await ev(() => { const e = document.querySelector(".pcdocedit .pcdoc"), t = e.querySelector("p").firstChild, i = t.nodeValue.indexOf("these words"), r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 11); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.focus(); window.imageEditorInstance.E.docText.keepSel(); });
    await p.keyboard.press("Control+Alt+m"); await p.waitForTimeout(300);
    const cdlg = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return d ? d.textContent : ""; });
    check("Ctrl+Alt+M opens New Comment quoting the words", /New Comment/.test(cdlg) && /these words/.test(cdlg), cdlg);
    await p.fill(".kxdlg.pcd #pdcA", "Tim Paul"); await p.fill(".kxdlg.pcd #pdcT", "Is this the right figure?"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    let h = await ev(() => document.querySelector(".pcdocedit .pcdoc").innerHTML);
    check("the words are marked (span data-cid)", /<span data-cid="c[\w]+">these words<\/span>/.test(h), h.slice(0, 300));
    const pn = await ev(() => { const P = document.querySelector(".pdcPanel"); return P ? P.textContent : ""; });
    check("the comments list opens: author, the words, the comment", /Comments \(1\)/.test(pn) && /Tim Paul/.test(pn) && /these words/.test(pn) && /right figure/.test(pn), pn);
    // ¹ two footnotes: after "source", and after "The last claim"
    const put = (needle) => ev((nd) => { const e = document.querySelector(".pcdocedit .pcdoc"), w = document.createTreeWalker(e, 4); let n; while ((n = w.nextNode())) { const i = n.nodeValue.indexOf(nd); if (i >= 0) { const r = document.createRange(); r.setStart(n, i + nd.length); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.focus(); window.imageEditorInstance.E.docText.keepSel(); return true; } } return false; }, needle);
    await put("a source"); await p.click("#kxOpts #pdnFn"); await p.waitForTimeout(300);
    await p.fill(".kxdlg.pcd #pdfT", "The 2025 survey, page 4."); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    await put("The last claim"); await p.keyboard.press("Control+Alt+f"); await p.waitForTimeout(300);
    await p.fill(".kxdlg.pcd #pdfT", "Our own count."); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(300);
    h = await ev(() => document.querySelector(".pcdocedit .pcdoc").innerHTML);
    check("two footnote marks, numbered 1 and 2 in story order", /a source<sup data-fn="f\w+">1<\/sup>/.test(h) && /The last claim<sup data-fn="f\w+">2<\/sup>/.test(h), h.match(/<sup[^>]*>\d<\/sup>/g));
    await p.keyboard.press("Escape"); await p.waitForTimeout(1500);
    const fr = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"); return E.docText.storyOf(L).map((x) => ({ fn: x.doc.fn || "", fnH: x.doc.fnH || 0, lines: x.doc.lines })); });
    check("the story ran onto a second page", fr.length >= 2, fr);
    check("note 1 at the foot of page 1's frame, note 2 at the foot of the frame that shows its mark", fr.length >= 2 && /<sup>1<\/sup> The 2025 survey, page 4\./.test(fr[0].fn) && !/Our own count/.test(fr[0].fn) && /<sup>2<\/sup> Our own count\./.test(fr[fr.length - 1].fn) && fr[0].fnH > 10, fr);
    await p.waitForFunction(() => window.imageEditorInstance.E.docText.ready(), null, { timeout: 15000 }).catch(() => null);
    const ink = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"), c = L.canvas, g = c.getContext("2d"), y0 = Math.round(L.doc.y + L.doc.h - L.doc.fnH * L.doc.k), d = g.getImageData(Math.round(L.doc.x), y0, Math.round(L.doc.w), Math.round(L.doc.fnH * L.doc.k)).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
    check("the note is drawn in the frame's foot (ink there)", ink > 80, ink);
    // resolve + the model + .docx
    const cid = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"); return (L.doc.comments || [])[0] && L.doc.comments[0].id; });
    const m = await ev(() => window.imageEditorInstance.E.docx.model());
    check("the .docx model takes the comment + both footnotes", m.comments.length === 1 && m.comments[0].author === "Tim Paul" && Object.values(m.footnotes).sort().join("|") === "Our own count.|The 2025 survey, page 4.", { c: m.comments, f: m.footnotes });
    const res = await ev(async (model) => { const r = await fetch("/api/docx/export?name=notes815", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model }) }); return r.json(); }, m);
    const bytes = Buffer.from(await (await fetch(URL_ + "api/docx/file/notes815.docx")).arrayBuffer());
    check(".docx saved with comments.xml + footnotes.xml", res.name === "notes815.docx" && bytes.includes(Buffer.from("word/comments.xml")) && bytes.includes(Buffer.from("word/footnotes.xml")), res);
    const L2 = await ev(async (b64) => { const E = window.imageEditorInstance.E, bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const o = await E.docx.openBytes(u.buffer, "notes815.docx"); const L = E.docx.place(o, { size: "A4", margin: 25, dpi: 96 }); return { notes: L.doc.notes, comments: L.doc.comments, html: L.doc.html.slice(0, 400) }; }, bytes.toString("base64"));
    check("opened again: both notes and the comment come back", L2.notes && Object.values(L2.notes).includes("Our own count.") && L2.comments && L2.comments[0].text === "Is this the right figure?" && /data-cid=/.test(L2.html), L2);
    void cid;
    // the list: resolve + delete (on the opened document, while editing it)
    await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"); E.docText.begin(L); });
    await p.waitForTimeout(300);
    await ev(() => window.imageEditorInstance.E.docNotes.openPanel(true)); await p.waitForTimeout(200);
    await p.click(".pdcPanel [data-act=done]"); await p.waitForTimeout(300);
    const rv = await ev(() => ({ html: document.querySelector(".pcdocedit .pcdoc").innerHTML, panel: document.querySelector(".pdcPanel").textContent }));
    check("✓ Resolve: the mark goes pale (data-done), the list says resolved", /data-done="1"/.test(rv.html) && /resolved/.test(rv.panel), rv.panel);
    await p.click(".pdcPanel [data-act=del]"); await p.waitForTimeout(300);
    const dv = await ev(() => ({ html: document.querySelector(".pcdocedit .pcdoc").innerHTML, panel: document.querySelector(".pdcPanel").textContent }));
    check("🗑 Delete: the mark goes, the words stay; the list is empty", !/data-cid/.test(dv.html) && /Comments \(0\)/.test(dv.panel), dv.panel);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing: " + e.message, false); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
