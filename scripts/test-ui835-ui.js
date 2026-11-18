#!/usr/bin/env node
/* bitGen Studio — 2.835.0 against the RUNNING app (+ a real browser): 🎞 tables and charts on slides, a theme built from brand
 * colours. Tim: "add charts and tables on slides, or a theme built from brand colours".
 *   ▦ Table -> into the empty content box, its editor (cells typed, ＋ Row) -> ✔ Apply -> an HTML table with the header in the
 *   accent; 📊 Chart ▾ Pie -> the editor (numbers typed) -> the spreadsheet's chart engine draws it in the theme's colours;
 *   Ctrl+Z; double-click = the editor again; the PDF canvas draws both; 🎨 Theme ▾ ▸ Brand theme… -> 🖼 From a logo (its
 *   colours), 💾 Save brand (listed in Theme ▾), ✔ Use -> the table / chart take the brand's accent.
 *   H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/", SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + ".png") }); } };
  const deck = () => ev(() => JSON.parse(JSON.stringify(window.H3Slides.deck())));
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { slidesdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Slides && window.H3SlideData && window.H3SlideBrand && document.getElementById("slAddTable") && document.getElementById("tX_slidesdock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("slidesdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_slidesdock").click(); if (d.classList.contains("collapsed")) toggleCollapse("slidesdock"); });
    await p.waitForTimeout(400);
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("slidesdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1380px;height:820px;z-index:9999"; });
    await ev(() => { const K = window.SlideCore, d = K.newDeck("plain"); const s = K.newSlide("content", d); s.items[0].text = "Numbers"; d.slides.push(s); const s3 = K.newSlide("content", d); s3.items[0].text = "Chart"; d.slides.push(s3); window.H3Slides.load(d, "Test835"); window.H3Slides.go(1); });
    await p.waitForTimeout(300);

    // ▦ Table
    await p.click("#slAddTable"); await p.waitForSelector("#slDataBox");
    const d1 = await deck(), tb = d1.slides[1].items.find((i) => i.type === "table"), body0 = d1.slides[1].items.find((i) => i.role === "body");
    check("▦ Table: a 4 x 3 table in the empty content box (the placeholder gives it its place) and its editor opens", tb && tb.rows.length === 4 && tb.rows[0].length === 3 && !body0 && tb.y > 150, d1.slides[1].items.map((i) => i.type + ":" + (i.role || "")));
    await ev(() => { const set = (r, c, v) => { const i = document.querySelector(`#slDataBox input[data-r="${r}"][data-c="${c}"]`); i.value = v; }; set(0, 0, "Region"); set(0, 1, "Q1"); set(1, 0, "North"); set(1, 1, "120"); });
    await p.click('#slDataBox [data-g="r+"]');
    await ev(() => { document.querySelector('#slDataBox input[data-r="4"][data-c="0"]').value = "West"; });
    await shot("1-table-editor");
    await p.click("#sldOk");
    await p.waitForTimeout(250);
    const t2 = (await deck()).slides[1].items.find((i) => i.type === "table");
    const look = await ev(() => { const td = document.querySelector("#slStage .sltbl td"); const cs = getComputedStyle(td); return { bg: cs.backgroundColor, fw: cs.fontWeight, n: document.querySelectorAll("#slStage .sltbl tr").length }; });
    check("…✔ Apply: the cells typed, a row added (5 rows); on the slide an HTML table, its header in the theme's accent, bold", t2.rows.length === 5 && t2.rows[0][0] === "Region" && t2.rows[1].join() === "North,120," && t2.rows[4][0] === "West" && look.n === 5 && look.bg === "rgb(47, 111, 222)" && +look.fw >= 700, { t2, look });

    // 📊 Chart ▾ Pie
    await ev(() => window.H3Slides.go(2));
    await p.click("#slAddChart"); await p.waitForSelector(".slmenu [data-c]");
    await p.click('.slmenu [data-c="pie"]'); await p.waitForSelector("#slDataBox");
    await ev(() => { const set = (r, c, v) => { document.querySelector(`#slDataBox input[data-r="${r}"][data-c="${c}"]`).value = v; }; set(0, 1, "Share"); set(1, 0, "Apples"); set(1, 1, "50"); set(2, 0, "Pears"); set(2, 1, "30"); document.getElementById("sldTitle").value = "Fruit"; });
    await p.click("#sldOk"); await p.waitForTimeout(400);
    const c2 = (await deck()).slides[2].items.find((i) => i.type === "chart");
    const svg = await ev(() => { const s = document.querySelector("#slStage .it.chart svg"); return s ? { paths: s.querySelectorAll("path").length, fills: [...s.querySelectorAll("path")].map((x) => x.getAttribute("fill")).slice(0, 2), title: [...s.querySelectorAll("text")].some((t) => t.textContent === "Fruit") } : null; });
    check("📊 Chart ▾ Pie: the chart in the content box, the numbers and the title typed in its editor", c2 && c2.chart.type === "pie" && c2.chart.title === "Fruit" && c2.chart.cats[0] === "Apples" && c2.chart.series[0].name === "Share" && c2.chart.series[0].values[0] === 50, c2 && c2.chart);
    check("…drawn by the spreadsheet's chart engine as SVG in the theme's colours (accent 1, accent 2), with its title", svg && svg.paths >= 4 && svg.fills[0] === "#2f6fde" && svg.fills[1] === "#e8743b" && svg.title, svg);
    await shot("2-chart");
    await ev(() => window.H3Slides.undo());
    const c3 = (await deck()).slides[2].items.find((i) => i.type === "chart");
    check("Ctrl+Z (undo) takes the chart's new numbers back", c3 && c3.chart.cats[0] === "Q1", c3 && c3.chart.cats);
    // double-click = the editor
    const pos = await ev(() => { const r = document.querySelector("#slStage .it.chart").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.mouse.dblclick(pos[0], pos[1]); await p.waitForTimeout(200);
    check("double-click a chart = its data editor again", await ev(() => !!document.getElementById("slDataBox") && !!document.getElementById("sldType")));
    await ev(() => document.querySelector("#slDataBox [data-x]").click());

    // the PDF's canvas
    const px = await ev(async () => { const H = window.H3Slides, s = H.deck().slides[1], t = s.items.find((i) => i.type === "table"); const c = await window.SlideDraw.toCanvas(s, H.deck(), 1280); const g = c.getContext("2d");
      const s2 = H.deck().slides[2], ch = s2.items.find((i) => i.type === "chart"), c2 = await window.SlideDraw.toCanvas(s2, H.deck(), 1280), g2 = c2.getContext("2d");
      let colored = 0; const d = g2.getImageData(ch.x, ch.y, ch.w, ch.h).data; for (let i = 0; i < d.length; i += 40) if (d[i + 2] > 150 && d[i] < 120) colored++;
      return { head: Array.from(g.getImageData(t.x + 6, t.y + 4, 1, 1).data), colored }; });
    check("⤓ PDF's canvas (slidedraw): the table's header filled with the accent, the chart drawn in", px.head[0] === 47 && px.head[1] === 111 && px.head[2] === 222 && px.colored > 50, px);

    // 🎨 the brand theme
    await p.click("#slTheme"); await p.waitForSelector(".slmenu [data-bnew]");
    await p.click(".slmenu [data-bnew]"); await p.waitForSelector("#slBrandBox");
    const logo = await ev(() => { const c = document.createElement("canvas"); c.width = 60; c.height = 60; const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 60, 60); g.fillStyle = "#d62828"; g.fillRect(0, 20, 60, 25); g.fillStyle = "#1d358c"; g.fillRect(0, 45, 60, 15); return c.toDataURL("image/png").split(",")[1]; });
    await p.setInputFiles("#sbLogoFile", { name: "acme-logo.png", mimeType: "image/png", buffer: Buffer.from(logo, "base64") });
    await p.waitForFunction(() => !document.getElementById("sbLogoRow").hidden, null, { timeout: 5000 });
    const br = await ev(() => ({ name: document.getElementById("sbName").value, accent: document.getElementById("sb_accent").value, accent2: document.getElementById("sb_accent2").value, sws: document.querySelectorAll("#sbSws [data-sw]").length, prev: !!document.querySelector("#sbPrev .slslide .sltbl") && !!document.querySelector("#sbPrev .slslide svg") }));
    check("🎨 Brand theme… ▸ 🖼 From a logo: its colours (the red = accent 1, the blue = accent 2), its name from the file; a live preview with a table and a chart",
      br.name === "acme logo" && br.accent === "#d62828" && br.accent2 === "#1d358c" && br.sws >= 3 && br.prev, br);
    await shot("3-brand");
    await ev(() => { document.getElementById("sbName").value = "Acme835"; document.getElementById("sbFont").value = "Georgia"; });
    await p.click("#sbSave"); await p.waitForFunction(() => /saved/.test(document.getElementById("sbSay").textContent), null, { timeout: 5000 });
    const saved = await (await fetch(URL_ + "api/slides/brands")).json();
    check("💾 Save brand: kept for every project (GET /api/slides/brands lists it)", (saved.brands || []).some((x) => x.name === "Acme835" && x.accent === "#d62828" && x.font === "Georgia"), saved);
    await p.click("#sbUse"); await p.waitForTimeout(300);
    const d4 = await deck();
    const after = await ev(() => { window.H3Slides.go(1); return new Promise((r) => setTimeout(() => r(getComputedStyle(document.querySelector("#slStage .sltbl td")).backgroundColor), 200)); });
    check("✔ Use in this presentation: the deck on its brand (kept in it), the table's header now the brand's accent", d4.theme === "brand" && d4.brand.name === "Acme835" && after === "rgb(214, 40, 40)", { theme: d4.theme, brand: d4.brand, after });
    await p.click("#slTheme"); await p.waitForSelector(".slmenu [data-bnew]"); await p.waitForTimeout(400);
    const listed = await ev(() => [...document.querySelectorAll(".slmenu [data-b]")].map((x) => x.textContent));
    check("🎨 Theme ▾ lists the saved brand (ticked as in use)", listed.some((t) => /Acme835/.test(t)), listed);
    await ev(() => document.querySelectorAll(".slmenu").forEach((m) => m.remove()));
    await shot("4-branded");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { await fetch(URL_ + "api/slides/brands?name=Acme835", { method: "DELETE" }); } catch (e) { /* fine */ }
    try { await ev(() => localStorage.removeItem("h3.slides.draft")); } catch (e) { /* fine */ }
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
