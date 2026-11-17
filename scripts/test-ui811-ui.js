#!/usr/bin/env node
/* bitGen Studio — 2.811.0 against the RUNNING app (+ a real browser): word-processor text in the image editor - File ▸ New
 * Text Document…, typing in a document frame, the formatting bar, the frame drawn on the layer, pages added as the text
 * grows, Esc = one undo step, the Move tool's double-click.
 * Tim (verbatim): "is there a way to add word editing to image editor? like ms word and export as docx? with all the
 * alignment, text editing/formatting / table options?" No Playwright = SKIP. */
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
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docText, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await p.waitForTimeout(600);
    // File ▸ New Text Document…
    await ev(() => window.imageEditorInstance.E.ui.run("file.newtextdoc")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdnDpi").value = "96"; d.querySelector("#pdnMargin").value = "20"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(800);
    let st = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return { pages: E.pages.count(), type: L && L.type, doc: L && L.doc && { x: L.doc.x, w: L.doc.w, auto: L.doc.auto, k: L.doc.k }, editing: !!E.docText.editing(), tool: E.S.tool, w: E.S.w, h: E.S.h }; });
    check("File ▸ New Text Document…: an A4 page (96 dpi), one document frame inside the 20 mm margins, typing in it at once", st.pages === 1 && st.type === "doc" && st.doc.x === 76 && st.doc.w === st.w - 152 && st.doc.auto && st.editing && st.tool === "doctext", st);
    await p.keyboard.type("Hello world. ");
    await p.keyboard.press("Control+b"); await p.keyboard.type("Bold words"); await p.keyboard.press("Control+b");
    await p.keyboard.press("Enter"); await p.keyboard.type("Second paragraph");
    let html = await ev(() => document.querySelector(".pcdocedit .pcdoc").innerHTML);
    check("typing in the frame: the words, Ctrl+B bold, Enter = a new paragraph", /Hello world\./.test(html) && /(font-weight:\s*bold|<b>)[^]*Bold words/.test(html) && (html.match(/<p/g) || []).length >= 2, html);
    // the bar: style, align centre, bullets
    await p.selectOption("#kxOpts #pdqStyle", "h1"); await p.waitForTimeout(150);
    html = await ev(() => document.querySelector(".pcdocedit .pcdoc").innerHTML);
    check("the paragraph style: Heading 1 on the paragraph with the caret", /<h1[^>]*>Second paragraph/.test(html), html);
    await p.click('#kxOpts [data-dq="justifyCenter"]'); await p.waitForTimeout(150);
    html = await ev(() => document.querySelector(".pcdocedit .pcdoc").innerHTML);
    check("Centre: text-align center on it", /<h1[^>]*text-align:\s*center[^>]*>Second paragraph/.test(html), html);
    await p.keyboard.press("Enter"); await p.selectOption("#kxOpts #pdqStyle", "normal"); await p.keyboard.type("One");
    await p.click('#kxOpts [data-dq="insertUnorderedList"]'); await p.keyboard.press("Enter"); await p.keyboard.type("Two");
    html = await ev(() => document.querySelector(".pcdocedit .pcdoc").innerHTML);
    check("Bullets: a list of two items", /<ul[^>]*><li[^>]*>One<\/li><li[^>]*>Two<\/li><\/ul>/.test(html.replace(/<br>/g, "")), html);
    await p.keyboard.press("Shift+Home"); await p.selectOption("#kxOpts #pdqSize", "24"); await p.waitForTimeout(150);
    html = await ev(() => document.querySelector(".pcdocedit .pcdoc").innerHTML);
    check("Size 24 pt on the selected words", /font-size:\s*24pt[^>]*>Two/.test(html), html);
    const u0 = await ev(() => window.imageEditorInstance.E.S.undo.length);
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    await p.waitForFunction(() => window.imageEditorInstance.E.docText.ready(), null, { timeout: 10000 });
    st = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"), d = L.canvas.getContext("2d").getImageData(L.doc.x, L.doc.y, 300, 60).data; let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) ink++; return { editing: !!E.docText.editing(), undo: E.S.undo.length, label: (E.S.undo[E.S.undo.length - 1] || {}).label, ink, html: L.doc.html }; });
    check("Esc ends the typing: one undo step \"document text\"", !st.editing && st.undo === u0 + 1 && st.label === "document text", st);
    check("the frame is drawn on its layer (the words in pixels)", st.ink > 150, st.ink);
    check("the stored text is cleaned HTML (no div, no script; the styles kept)", !/<div|<script/.test(st.html) && /<h1/.test(st.html) && /<ul/.test(st.html), st.html);
    // a long story: pages added by themselves
    await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"); E.docText.begin(L); const ed = document.querySelector(".pcdocedit .pcdoc"); let h = ""; for (let i = 1; i <= 90; i++) h += `<p>Paragraph ${i}: the quick brown fox jumps over the lazy dog, again and again, to fill the page with words.</p>`; ed.innerHTML = h; ed.dispatchEvent(new Event("input")); });
    await p.waitForTimeout(500); await p.keyboard.press("Escape"); await p.waitForTimeout(1500);
    st = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"); const frames = E.docText.storyOf(L); return { pages: E.pages.count(), frames: frames.map((f) => ({ idx: f.doc.flow.idx, top: Math.round(f.doc.top), lines: f.doc.lines, auto: f.doc.auto })) }; });
    check("a story longer than the page: pages added by themselves, a frame on each, the windows going down the story", st.pages >= 2 && st.frames.length === st.pages && st.frames[1].top > 0 && st.frames.every((f, i) => !i || f.top > st.frames[i - 1].top), st);
    check("…whole lines in each frame (each frame shows some lines)", st.frames.every((f) => f.lines > 0), st);
    // shrink: the added pages go again
    await ev(() => { const E = window.imageEditorInstance.E; E.pages.go(0); });
    await p.waitForTimeout(300);
    await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"); E.docText.begin(L); const ed = document.querySelector(".pcdocedit .pcdoc"); ed.innerHTML = "<p>Short again.</p>"; ed.dispatchEvent(new Event("input")); });
    await p.waitForTimeout(500); await p.keyboard.press("Escape"); await p.waitForTimeout(1500);
    st = await ev(() => window.imageEditorInstance.E.pages.count());
    check("the text made short again: the pages it added are gone", st === 1, st);
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(800);
    st = await ev(() => { const L = window.imageEditorInstance.E.S.layers.find((x) => x.type === "doc"); return /Paragraph 90/.test(L.doc.html); });
    check("Ctrl+Z brings the long text back", st);
    // the Move tool: a double-click types in the frame
    await ev(() => { const E = window.imageEditorInstance.E; E.docText.end(); E.setTool("move"); });
    const at = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.type === "doc"), r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + (L.doc.x + 30) * E.S.zoom, r.top + E.S.panY + (L.doc.y + 10) * E.S.zoom]; });
    await p.mouse.dblclick(at[0], at[1]); await p.waitForTimeout(300);
    check("the Move tool: a double-click on a document frame types in it", await ev(() => !!window.imageEditorInstance.E.docText.editing()));
    await p.keyboard.press("Escape");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { await b.close(); }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
