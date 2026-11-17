#!/usr/bin/env node
/* bitGen Studio — 2.832.0 against the RUNNING app (+ a real browser): 🎞 SLIDES part 2. Tim: "yes please go ahead wth part 2".
 *   The turn handle (a shape turned 90°, then sized along its own side); 🖼 Picture ▾ From Assets… (the project's picture
 *   onto the slide); ⤒ Open PowerPoint (a .pptx made by lib/slidePptx.js comes in: slides, words, notes); ⤓ PDF ▾ Slides +
 *   speaker notes (a PDF with a page a slide, downloaded and kept in the slides folder); 🎤 Presenter view (the slide, the next,
 *   the notes, the timer; the AUDIENCE window shows the slide; → moves both; B blanks the audience; Esc closes both).
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
  const _scr = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + x * E.S.zoom, r.top + E.S.panY + y * E.S.zoom]; }, [x, y]);
  const _drag = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), c = await scr(x1, y1); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, { steps: 3 }); await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(250); };
  const _px = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, c = E.flatten(); return Array.from(c.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
  const _sh = () => ev(() => { const L = window.imageEditorInstance.E.layer(); return L && L.styles && L.styles.shadow ? JSON.parse(JSON.stringify(L.styles.shadow)) : null; });
  const S = (f, x) => ev(f, x);
  const deck = () => ev(() => JSON.parse(JSON.stringify(window.H3Slides.deck())));
  const sp = (x, y) => ev(([x, y]) => { const st = document.getElementById("slStage").getBoundingClientRect(), k = window.H3Slides.St.scale; return [st.left + x * k, st.top + y * k]; }, [x, y]);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { slidesdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Slides && window.H3SlideIO && window.SlideDraw && window.H3SlideShow && window.H3SlideShow.presenter && document.getElementById("tX_slidesdock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("slidesdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_slidesdock").click(); if (d.classList.contains("collapsed")) toggleCollapse("slidesdock"); });
    await p.waitForTimeout(400);
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("slidesdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1380px;height:820px;z-index:9999"; });
    await ev(() => { const K = window.SlideCore, d = K.newDeck("tiger"); d.slides[0].items[0].text = "Welcome"; const s = K.newSlide("content", d); s.items[0].text = "Agenda"; s.items[1].text = "One\nTwo"; s.notes = "Say the agenda slowly"; d.slides.push(s); const s3 = K.newSlide("titleonly", d); s3.items[0].text = "Thanks"; d.slides.push(s3); window.H3Slides.load(d, "Test832"); });
    await p.waitForTimeout(500);
    const sp = (x, y) => ev(([x, y]) => { const st = document.getElementById("slStage").getBoundingClientRect(), k = window.H3Slides.St.scale; return [st.left + x * k, st.top + y * k]; }, [x, y]);
    const it = () => ev(() => { const H = window.H3Slides, i = H.slide().items.find((x) => x.type === "shape"); return i ? JSON.parse(JSON.stringify(i)) : null; });

    // the turn handle
    await ev(() => { const H = window.H3Slides; H.go(1); H.addShape("rect"); });
    await p.waitForTimeout(200);
    const r0 = await it(), knob = await ev(() => { const r = document.querySelector("#slStage .rot").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const right = await sp(r0.x + r0.w / 2 + 300, r0.y + r0.h / 2);
    await p.mouse.move(knob[0], knob[1]); await p.mouse.down(); await p.mouse.move(right[0], right[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
    const r1 = await it();
    check("the round handle over a picked shape turns it - dragged to its right side = 90° (one undo step)", r1.rot === 90 && r1.x === r0.x && r1.w === r0.w, r1);
    const eh = await ev(() => { const r = document.querySelector('#slStage .hd[data-h="e"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.mouse.move(eh[0], eh[1]); await p.mouse.down(); await p.mouse.move(eh[0], eh[1] + 60 * (await ev(() => window.H3Slides.St.scale)), { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
    const r2 = await it();
    check("…its side handle (now at the bottom) sizes it along its own width - the other side stays put", Math.abs(r2.w - r0.w - 60) <= 3 && r2.h === r0.h && Math.abs((r2.y + r2.h / 2) - (r0.y + r0.h / 2) - 30) <= 3, { r0, r2 });
    await shot("1-turned");

    // a picture from Assets
    await ev(() => document.getElementById("slAddPic").click()); await p.waitForTimeout(100);
    check("🖼 Picture ▾: From this computer / the Gallery / Assets", await ev(() => [...document.querySelectorAll(".slmenu [data-s]")].map((d) => d.dataset.s).join() === "pc,gallery,assets"));
    await ev(() => document.querySelector('.slmenu [data-s="assets"]').click());
    await p.waitForSelector("#slPick figure", { timeout: 15000 });
    const n0 = await ev(() => window.H3Slides.slide().items.filter((i) => i.type === "image").length);
    await ev(() => document.querySelector("#slPick figure").click()); await p.waitForTimeout(1200);
    check("…From Assets…: the project's pictures to pick from; a click puts it on the slide", (await ev(() => window.H3Slides.slide().items.filter((i) => i.type === "image" && /^media:/.test(i.src)).length)) === n0 + 1 && !(await ev(() => !!document.getElementById("slPick"))));

    // ⤒ a PowerPoint file
    const tmp = path.join(require("os").tmpdir(), "in832.pptx");
    { const K = require(path.join(__dirname, "..", "ext/slidesdock/slidecore.js")), O = require(path.join(__dirname, "..", "lib/slidePptx.js")); const d = K.newDeck("forest"); d.slides[0].items[0].text = "From PowerPoint"; const s = K.newSlide("content", d); s.items[0].text = "Imported"; s.items[1].text = "a\nb"; s.notes = "the notes came too"; d.slides.push(s); fs.writeFileSync(tmp, await O.toPptx(d)); }
    const sv = await ev(async () => { const r = await window.H3Slides.save(); return r && r.size; });
    check("💾 Save of a deck with a picture (over 100 KB) works", sv > 100000, sv);
    await p.setInputFiles("#slPptxFile", tmp); await p.waitForTimeout(1500);
    const d1 = await ev(() => JSON.parse(JSON.stringify(window.H3Slides.deck())));
    check("⤒ Open PowerPoint: the .pptx comes in - 2 slides, its words, bullets and notes; its name in the box", d1.slides.length === 2 && d1.slides[0].items.some((i) => i.text === "From PowerPoint") && d1.slides[1].items.some((i) => i.text === "a\nb" && i.st && i.st.bullets) && d1.slides[1].notes === "the notes came too" && (await ev(() => document.getElementById("slFile").value)) === "in832", d1.slides.map((s) => s.items.map((i) => i.text)));
    await ev(() => { const H = window.H3Slides; return H.load(H.deck(), "Test832"); });
    await ev(async () => { const r = await fetch("/api/slides/file?name=Test832.bgk"); window.H3Slides.load(await r.json(), "Test832"); });
    await p.waitForTimeout(300);

    // ⤓ PDF with notes
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), ev(() => { document.getElementById("slPdf").click(); document.querySelector('.slmenu [data-p="1"]').click(); })]);
    const pdf = fs.readFileSync(await dl.path()), PL = require(path.join(__dirname, "..", "static/vendor/pdf-lib.min.js")), pages = (await PL.PDFDocument.load(pdf)).getPageCount();
    await p.waitForTimeout(500);
    const kept = await ev(async () => { const r = await fetch("/api/slides/export/pdf?name=x", { method: "POST", body: "nope" }); return r.status; });
    check("⤓ PDF ▾ Slides + speaker notes: a PDF of 3 pages, downloaded (" + dl.suggestedFilename() + ")", pdf.slice(0, 5).toString() === "%PDF-" && pages === 3 && dl.suggestedFilename() === "Test832 - notes.pdf", { pages, name: dl.suggestedFilename() });
    check("…kept in the slides folder (and the server takes only a PDF)", kept === 400 && /kept in the slides folder/.test(await ev(() => document.getElementById("slMsg").textContent)));

    // 🎤 the presenter view + the audience window
    await ev(() => window.H3Slides.go(0));
    const [aud] = await Promise.all([p.context().waitForEvent("page", { timeout: 15000 }), ev(() => document.getElementById("slPresent2").click())]);
    await aud.waitForLoadState("domcontentloaded"); await p.waitForTimeout(1200);
    const pv = () => ev(() => { const b = document.getElementById("slPresenter"); return b ? { cnt: b.querySelector(".pvcnt").textContent, notes: b.querySelector(".pvnotes").textContent, cur: b.querySelector(".pvcur").textContent, next: b.querySelector(".pvnext").textContent, timer: b.querySelector(".pvtimer").textContent } : null; });
    const a0 = await aud.evaluate(() => document.getElementById("host").textContent), v0 = await pv();
    check("🎤 Presenter view: the slide + the next one + the timer here, the audience window shows the slide", v0 && v0.cnt === "Slide 1 of 3" && /Welcome/.test(v0.cur) && /Agenda/.test(v0.next) && /^0:00:0\d$/.test(v0.timer) && /Welcome/.test(a0) && aud.url().endsWith("/static/slideaudience.html"), { v0, a0 });
    await shot("2-presenter");
    await p.keyboard.press("ArrowRight"); await p.waitForTimeout(700);
    const v1 = await pv(), a1 = await aud.evaluate(() => document.getElementById("host").lastElementChild.textContent);
    check("…→ moves both: slide 2 with its speaker notes here, its words on the audience screen", v1.cnt === "Slide 2 of 3" && v1.notes === "Say the agenda slowly" && /Thanks/.test(v1.next) && /Agenda/.test(a1), { v1, a1 });
    await aud.keyboard.press("ArrowRight"); await p.waitForTimeout(600);
    check("…a key in the audience window moves it too (slide 3)", (await pv()).cnt === "Slide 3 of 3");
    await p.keyboard.press("b"); await p.waitForTimeout(200);
    check("…B: the audience sees a black screen", (await aud.evaluate(() => document.getElementById("host").style.visibility)) === "hidden");
    await p.keyboard.press("b"); await p.keyboard.press("Escape"); await p.waitForTimeout(500);
    check("…Esc ends it: the presenter view and the audience window close", !(await ev(() => !!document.getElementById("slPresenter"))) && aud.isClosed());
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
