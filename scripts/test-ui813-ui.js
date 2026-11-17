#!/usr/bin/env node
/* bitGen Studio — 2.813.0 against the RUNNING app (+ a real browser): page numbers on every page (the master), their format
 * (Page {page} of {pages}, position, font, size, colour, numbering), and View ▸ Pages: Two / Many - several pages in the
 * window, a click on another page brings it to the front where it is.
 * Tim (verbatim): "fix the pagination, page number shows on page 1, but not on page 2. Also add formatting for page numbers.
 * allow user to change "view" to show multiple pages on the same window". No Playwright = SKIP. */
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.pageView, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    await ev(() => { const f = document.getElementById("kxFull"); if (f) f.click(); const P = document.getElementById("promptdock"); if (P && !P.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await p.waitForTimeout(600);
    await ev(() => window.imageEditorInstance.E.pageView.setMode("one"));
    // a text document of 2 pages (the text runs over)
    await ev(() => window.imageEditorInstance.E.ui.run("file.newtextdoc")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pdnDpi").value = "96"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(800);
    // the old way first: a number put on page 1 alone (as 2.800.0 did)
    await ev(() => { const E = window.imageEditorInstance.E, T = E.makeLayer("Page number", E.S.w, E.S.h, "text"); T.text = Object.assign({}, window.PCDoc.TEXT_DEFAULT, { str: "{page}", size: 14, x: 400, y: 1080 }); window.PCDoc.rasterize(T); E.S.layers.push(T); });
    await ev(() => { const ed = document.querySelector(".pcdocedit .pcdoc"); let h = ""; for (let i = 1; i <= 80; i++) h += `<p>Paragraph ${i}: words to fill the pages of this document, line after line.</p>`; ed.innerHTML = h; ed.dispatchEvent(new Event("input")); });
    await p.waitForTimeout(400); await p.keyboard.press("Escape"); await p.waitForTimeout(1500);
    const n = await ev(() => window.imageEditorInstance.E.pages.count());
    check("the text runs over: 2+ pages", n >= 2, n);
    // # Page Numbers… : Page {page} of {pages}, top right, red
    await ev(() => window.imageEditorInstance.E.ui.run("page.number")); await p.waitForTimeout(250);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#pgnF").value = "Page {page} of {pages}"; d.querySelector("#pgnP").value = "tr"; d.querySelector("#pgnSize").value = "18"; d.querySelector("#pgnC").value = "#cc0000"; d.querySelector("#pgnS").value = "I"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(800);
    let st = await ev(() => { const E = window.imageEditorInstance.E; return { masters: E.pages.masters().map((m) => m.name), pageMasters: E.pages.list().map((x) => x.master), own: E.S.layers.filter((L) => L.name === "Page number").length, numbering: E.pages.numbering() }; });
    check("Page Numbers…: on a master (A-Master) given to every page; the old number on page 1 alone taken off", st.masters.length === 1 && st.pageMasters.every((m) => m != null && m === st.pageMasters[0]) && st.own === 0 && st.numbering.style === "I", st);
    const fieldsOn = async (i) => { await ev((i) => window.imageEditorInstance.E.pages.go(i), i); await p.waitForTimeout(500); return ev(() => { const E = window.imageEditorInstance.E, M = E.S.layers.find((L) => /A-Master/.test(L.name)); if (!M) return null; const c = M.canvas, g = c.getContext("2d"), d = g.getImageData(Math.round(c.width * 0.6), 0, Math.round(c.width * 0.4), 80).data; let red = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 100 && d[k] > 150 && d[k + 1] < 90) red++; return { red }; }); };
    const f2 = await fieldsOn(1), f1 = await fieldsOn(0);
    check("page 1 AND page 2 show the number (red, top right, from the master)", f1 && f2 && f1.red > 30 && f2.red > 30, { f1, f2 });
    const tokens = await ev(() => { const E = window.imageEditorInstance.E, pp = E.S.pages, m = pp.masters[0]; const L = (m.st ? m.st.layers : []).find((x) => x.name === "Page number"); return L ? { str: L.text.str, align: L.text.align, size: L.text.size, color: L.text.color } : null; });
    check("…the master's number layer: Page {page} of {pages}, right aligned, 18, #cc0000", tokens && tokens.str === "Page {page} of {pages}" && tokens.align === "right" && tokens.size === 18 && tokens.color === "#cc0000", tokens);
    // a page added later takes the master (and so the number)
    const add = await ev(() => { const E = window.imageEditorInstance.E; E.pages.add(); const m = E.pages.current().master; E.pages.go(0); return m; });
    check("a page added later has the master too", add != null, add);
    // View ▸ Pages: Two Pages
    await ev(() => window.imageEditorInstance.E.ui.run("view.pages.two")); await p.waitForTimeout(400);
    await p.waitForFunction(() => window.imageEditorInstance.E.pageView.ready(), null, { timeout: 15000 });
    await p.waitForTimeout(300);
    st = await ev(() => { const E = window.imageEditorInstance.E, b = document.querySelector(".pcpv"), els = [...b.querySelectorAll("[data-pv]")].map((e) => ({ i: +e.dataset.pv, l: parseFloat(e.style.left), t: parseFloat(e.style.top), w: parseFloat(e.style.width), h: parseFloat(e.style.height), pic: !!e.querySelector("canvas") })); return { els, panX: E.S.panX, panY: E.S.panY, zoom: E.S.zoom, w: E.S.w }; });
    const p2 = st.els.find((e) => e.i === 1);
    check("Two Pages: page 2 drawn beside page 1 (same top, to its right, the same scale), with its picture", p2 && Math.abs(p2.t - st.panY) < 2 && p2.l > st.panX + st.w * st.zoom && Math.abs(p2.w - st.w * st.zoom) < 2 && p2.pic && st.els.length === n, st);
    const z0 = st.zoom;
    const at = [p2.l + p2.w / 2, p2.t + p2.h * 0.6];   // the middle of it (a floating docker may sit over its top)
    await p.mouse.click(at[0], at[1]); await p.waitForTimeout(700);
    st = await ev(() => { const E = window.imageEditorInstance.E, e1 = document.querySelector('.pcpv [data-pv="0"]'); return { cur: E.pages.cur(), zoom: E.S.zoom, panX: E.S.panX, p1: e1 ? parseFloat(e1.style.left) : null }; });
    check("a click on page 2: it comes to the front where it is (the zoom kept, page 1 now drawn on its left)", st.cur === 1 && Math.abs(st.zoom - z0) < 1e-6 && Math.abs(st.panX - p2.l) < 2 && st.p1 != null && st.p1 < st.panX, st);
    await ev(() => window.imageEditorInstance.E.ui.run("view.pages.many")); await p.waitForTimeout(500);
    st = await ev(() => window.imageEditorInstance.E.pageView.layout().map((q) => [q.x, q.y]));
    check("Many Pages: a grid 4 across", st.length >= 3 && st[1][1] === 0 && st[2][1] === 0 && st[1][0] > 0, st);
    await ev(() => window.imageEditorInstance.E.ui.run("view.pages.one")); await p.waitForTimeout(300);
    st = await ev(() => document.querySelector(".pcpv").style.display);
    check("One Page: the other pages gone from the window", st === "none", st);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally { await b.close(); }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
