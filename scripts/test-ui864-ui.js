#!/usr/bin/env node
/* bitGen Studio — 2.864.0 in a REAL browser: the Web editor's </> Code tab - line numbers, coloured tags lined up with the text,
 * a tag not closed marked + listed (a click goes to it), ¶ wraps the selection, ⌗ / Ctrl+/ comment lines, the numbers scroll with the
 * text, a picture hides the editor. Against the running app (H3_URL). */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  try {
    await fetch(new URL("/api/web/create", URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const long = "<!DOCTYPE html>\n<html>\n<body>\n<div class=\"box\">\n<section>\n" + Array.from({ length: 80 }, (_, i) => "<p>line " + i + "</p>").join("\n") + "\n</div>\n</body>\n</html>\n";
    await fetch(new URL("/api/web/file", URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: "test864.html", text: long }) });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web && window.WbCode, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForSelector('#wbTree .it[data-p="test864.html"]', { timeout: 15000 });
    await p.click('#wbTree .it[data-p="test864.html"]'); await p.waitForTimeout(300);
    await p.click('#webdock .wbtab[data-tab="code"]'); await p.waitForTimeout(400);
    const a = await ev(() => { const hl = document.getElementById("wbCodeHl"), no = document.getElementById("wbCodeNo"), c = document.getElementById("wbCode"), r1 = c.getBoundingClientRect(), r2 = hl.getBoundingClientRect();
      return { lines: no.textContent.trim().split("\n").length, tags: hl.querySelectorAll(".ht").length, bad: [...hl.querySelectorAll(".hbad")].map((x) => x.textContent), issues: document.getElementById("wbCodeIssues").textContent, same: Math.abs(r1.left - r2.left) < 1 && Math.abs(r1.top - r2.top) < 1, txt: getComputedStyle(c).color, tools: document.querySelectorAll("#wbCodeTools button").length }; });
    check("line numbers (one per line), the tags coloured, the see-through text lined up over them, the ◧ quick-tag toolbar", a.lines === 89 && a.tags > 150 && a.same && a.txt === "rgba(0, 0, 0, 0)" && a.tools >= 20, a);
    check("<section> left open: marked red in the code and listed under it with its line", a.bad.includes("<section>") && /<section> line 5/.test(a.issues), a);
    await ev(() => { const c = document.getElementById("wbCode"); c.scrollTop = 600; c.dispatchEvent(new Event("scroll")); });
    const sc = await ev(() => ({ hl: document.getElementById("wbCodeHl").scrollTop, no: document.getElementById("wbCodeNo").scrollTop, c: document.getElementById("wbCode").scrollTop }));
    check("...scrolled: the colours and the numbers move with the text", sc.c > 300 && sc.hl === sc.c && sc.no === sc.c, sc);
    await p.click('#wbCodeIssues a[data-at]');
    const at = await ev(() => { const c = document.getElementById("wbCode"); return { s: c.selectionStart, line: c.value.slice(0, c.selectionStart).split("\n").length, top: c.scrollTop }; });
    check("...a click on it puts the cursor at that tag", at.line === 5 && at.top < 300, at);
    // quick tag + comment
    await ev(() => { const c = document.getElementById("wbCode"), i = c.value.indexOf("line 3"); c.focus(); c.setSelectionRange(i, i + 6); });
    await p.click('#wbCodeTools [data-qt="strong"]');
    let v = await ev(() => document.getElementById("wbCode").value);
    check("B wraps the selection in <strong> (the page marked changed ●)", v.includes("<p><strong>line 3</strong></p>") && await ev(() => document.getElementById("wbFileName").classList.contains("dirty")));
    await ev(() => { const c = document.getElementById("wbCode"), i = c.value.indexOf("<p>line 10"); c.focus(); c.setSelectionRange(i, i + 3); });
    await p.keyboard.press("Control+/");
    v = await ev(() => document.getElementById("wbCode").value);
    check("Ctrl+/ comments the line (<!-- -->), again uncomments it", v.includes("<!-- <p>line 10</p> -->"), v.slice(v.indexOf("line 9"), v.indexOf("line 9") + 60));
    await p.keyboard.press("Control+/");
    v = await ev(() => document.getElementById("wbCode").value);
    check("...", v.includes("\n<p>line 10</p>\n") && !v.includes("<!-- <p>line 10"));
    await p.keyboard.press("Control+z");
    check("Ctrl+Z undoes the editor's changes", await ev(() => document.getElementById("wbCode").value.includes("<!-- <p>line 10</p> -->")));
    await p.click('#wbCodeTools [data-qc="block"]');
    const hcom = await ev(() => document.querySelectorAll("#wbCodeHl .hc").length);
    check("<!-- adds a comment - shown green", hcom >= 1, hcom);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
