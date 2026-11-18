#!/usr/bin/env node
/* bitGen Studio — 2.843.0 in a REAL browser: 🌐 a website from the image editor's pages - a 2-page document (a title text layer
 * + a picture layer on a plain page, a WP layer on the second) -> File ▸ 🌐 Build Website… -> the pages' elements to the
 * server, a stand-in LLM writes each page -> the static preview + PHP + MySQL build + .zip.
 * Tim: "now everything is is place for an ai website builder, we can build the website in image editor and make it in the
 * language the user needs like php/mysql". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (method, u, body) => { const r = await fetch(new URL(u, URL_), { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
const asked = [];
function llmServer() {     // writes each page from the elements it is given (every word, every picture)
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const all = (j.messages || []).map((m) => m.content).join("\n"); asked.push(all);
      let text = "an ordinary chat answer";
      const m = /px wide, background [^:]*:\n(\[[\s\S]*\])\n\nThe JSON:/.exec(all);
      if (/responsive HTML and CSS/.test(all) && m) {
        const els = JSON.parse(m[1]);
        const html = '<section class="grid">' + els.map((e) => e.kind === "text" ? `<h1 class="t">${e.text}</h1>` : e.kind === "image" ? `<img src="assets/${e.src}" alt="${e.alt}">` : e.html).join("") + "</section>";
        text = JSON.stringify({ html, css: ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}" });
      }
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
  }).listen(0, "127.0.0.1");
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const llm = llmServer(); await new Promise((r) => llm.on("listening", r));
  const cfg0 = await api("GET", "api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  await api("POST", "api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stand-in" } });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.site && window.imageEditorInstance.E.pages, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    // a 2-page document: page 1 a title + a red picture on cream; page 2 a WP layer
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S;
      E.pages.newDocument({ preset: "A4", wmm: 210, hmm: 297, orient: "landscape", dpi: 72 }, 2, "Bakery site");
      const g0 = S.layers[0].canvas.getContext("2d"); g0.fillStyle = "#fdf6e3"; g0.fillRect(0, 0, S.w, S.h); S.layers[0].ver = (S.layers[0].ver || 0) + 1;
      const T = E.makeLayer("Title", S.w, S.h, "text"); T.text = { str: "Tiger Bakery", x: 40, y: 30, size: 48, color: "#8a3b12", font: "Arial", weight: 700, align: "left" }; E.D.rasterize(T); S.layers.push(T);
      const P = E.makeLayer("Bread photo"); const g = P.canvas.getContext("2d"); g.fillStyle = "#c03020"; g.fillRect(40, 120, 300, 200); S.layers.push(P);
      E.pages.list()[0].name = "Home"; E.pages.list()[1].name = "About us";
      E.pages.go(1); const W = E.docText.addFrame(40, 40, S.w - 80, S.h - 80, {}, false); E.docText.end(); W.doc.html = E.docText.sanitize("<h2>Our story</h2><p>Baking since 1990.</p>"); E.docText.reflow(W.doc.flow.id); E.pages.go(0); E.refresh(); });
    await p.waitForTimeout(500);
    const menu = await ev(() => !!window.imageEditorInstance.E.ui.CMD.get("file.website"));
    const spec = await ev(async () => { const c = await window.imageEditorInstance.E.site.collect(); return { pages: c.pages.map((p) => ({ title: p.title, bg: p.bg, kinds: p.els.map((e) => e.kind), first: p.els[0] })), assets: c.assets.map((a) => a.name) }; });
    check("File ▸ 🌐 Build Website…; collected: a web page per editor page (their names), the plain background = the page colour, the text layer as text (its size / colour scaled to 1200 px), the picture layer as a picture, the WP layer as rich text",
      menu && spec.pages.length === 2 && spec.pages[0].title === "Home" && spec.pages[0].bg === "#fdf6e3" && spec.pages[0].kinds.join() === "text,image" && spec.pages[0].first.text === "Tiger Bakery" && spec.pages[0].first.color === "#8a3b12" && spec.pages[0].first.bold
      && spec.pages[1].title === "About us" && spec.pages[1].kinds.join() === "rich" && spec.assets.length === 1, spec);
    const r = await ev(() => window.imageEditorInstance.E.site.build({ name: "T843 Bakery", title: "Tiger Bakery", stack: "static", lang: "en", ai: true, open: false }));
    const html = await (await fetch(new URL(r.preview, URL_))).text(), about = await (await fetch(new URL("/sites-preview/T843%20Bakery/about-us.html", URL_))).text(), css = await (await fetch(new URL("/sites-preview/T843%20Bakery/css/site.css", URL_))).text();
    const img = /src="(assets\/[^"]+)"/.exec(html), imgOk = img ? (await fetch(new URL("/sites-preview/T843%20Bakery/" + img[1], URL_))).status : 0;
    check("🌐 Build (static): each page written by the AI (the stand-in) with every word and picture; the preview serves it - the nav, the colour, the picture, the AI's responsive CSS",
      r.pages.every((x) => x.by === "ai") && /<h1 class="t">Tiger Bakery<\/h1>/.test(html) && /href="about-us\.html"/.test(html) && /--page-bg:#fdf6e3/.test(html) && imgOk === 200 && /Our story/.test(about) && /auto-fit/.test(css) && asked.filter((a) => /responsive HTML and CSS/.test(a)).length === 2, { r, imgOk });
    const r2 = await ev(() => window.imageEditorInstance.E.site.build({ name: "T843 Bakery", title: "Tiger Bakery", stack: "php", lang: "en", ai: false, open: false }));
    const z = await fetch(new URL("/api/sites/zip?name=T843%20Bakery", URL_)), zb = Buffer.from(await z.arrayBuffer());
    const JSZip = require(path.join(__dirname, "..", "node_modules", "jszip")), zz = await JSZip.loadAsync(zb);
    check("PHP + MySQL (bitGen's own layout): the .zip holds index.php / about-us.php, the header / footer, contact.php + schema.sql",
      r2.stack === "php" && r2.pages.every((x) => x.by === "bitgen") && z.status === 200 && ["index.php", "about-us.php", "inc/header.php", "contact.php", "schema.sql"].every((n) => zz.file(n)) && /Tiger Bakery/.test(await zz.file("index.php").async("string")), r2);
    await ev(() => window.imageEditorInstance.E.ui.run("file.website")); await p.waitForTimeout(300);
    const dl = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); const r = { title: d && d.querySelector("h4").textContent, stack: d && d.querySelector("#siteStack").value, name: d && d.querySelector("#siteName").value }; if (d) d.querySelector(".cn").click(); return r; });
    check("the 🌐 Build Website box remembers the last site (name, PHP + MySQL)", dl.title === "🌐 Build Website" && dl.stack === "php" && dl.name === "T843 Bakery", dl);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { try { await api("POST", "api/config", { llm: llm0 }); } catch (e) { /* fine */ } await b.close(); llm.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
