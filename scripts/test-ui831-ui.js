#!/usr/bin/env node
/* bitGen Studio — 2.831.0 against the RUNNING app (+ a real browser): 🎞 SLIDES. Tim: "can you add the slides now please".
 *   The 🎞 button on the top bar's app strip opens the docker; a new deck (title slide, its placeholders' hints); typing in the
 *   title (double-click, Esc) + undo; Ctrl+M a new slide (Title and content) with bullets; 🅃 Text; a ☆ shape dragged + sized;
 *   🖼 a picture into the picture layout's box; 🎨 a theme; the layout changed (words kept); notes; a slide dragged in the
 *   list; 💾 Save + 📂 Open; ▶ Present (→, the counter, a transition, Esc); ⤓ PowerPoint (a real .pptx with the slides, the
 *   picture and the notes). H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Slides && window.SlideCore && window.H3SlideShow && document.getElementById("tX_slidesdock"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    check("the 🎞 Slides button is on the top bar's app strip (after ▦ Spreadsheet)", await ev(() => { const b = document.getElementById("tX_slidesdock"), g = document.getElementById("appGrp1"); return !!b && !!g && g.contains(b) && b.previousElementSibling && b.previousElementSibling.id === "tX_sheetdock"; }));
    await ev(() => { const d = document.getElementById("slidesdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_slidesdock").click(); if (d.classList.contains("collapsed")) toggleCollapse("slidesdock"); });
    await p.waitForTimeout(400);
    // the docker big on the screen (as ⛶ would make it), the floating dockers out of the way
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("slidesdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1380px;height:820px;z-index:9999"; });
    await p.waitForTimeout(800);
    check("…it opens the Slides docker", await ev(() => !document.getElementById("slidesdock").classList.contains("dockgone") && document.getElementById("slStage").offsetWidth > 100));
    await ev(() => { window.H3Slides.load(window.SlideCore.newDeck("plain"), "Test831"); });
    await p.waitForTimeout(400);
    const hint = await ev(() => document.querySelector("#slStage .it.ph .hint") && document.querySelector("#slStage .it.ph .hint").textContent);
    check("a new deck: a title slide, its empty boxes show a hint while editing, one slide in the list", hint === "Click to add a title" && (await ev(() => document.querySelectorAll("#slList .th").length)) === 1, hint);
    // type the title
    const t0 = await ev(() => { const it = window.H3Slides.slide().items.find((i) => i.role === "title"); return [it.x + it.w / 2, it.y + it.h / 2]; });
    const a = await sp(t0[0], t0[1]); await p.mouse.dblclick(a[0], a[1]); await p.waitForTimeout(200);
    await p.keyboard.type("Hello bitGen"); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    const d1 = await deck();
    check("double-click the title + type + Esc: the words are the slide's title", d1.slides[0].items.find((i) => i.role === "title").text === "Hello bitGen", d1.slides[0].items);
    await ev(() => document.getElementById("slUndo").click()); await p.waitForTimeout(150);
    check("…↶ takes the typing back, ↷ again", (await deck()).slides[0].items.find((i) => i.role === "title").text === "" && (await ev(() => { document.getElementById("slRedo").click(); return window.H3Slides.slide().items.find((i) => i.role === "title").text; })) === "Hello bitGen");
    // a new slide with bullets
    await ev(() => document.getElementById("slStageWrap").focus());
    await p.keyboard.press("Control+m"); await p.waitForTimeout(250);
    const d2 = await deck();
    check("Ctrl+M: a new slide after it - Title and content (a bulleted text box)", d2.slides.length === 2 && d2.slides[1].layout === "content" && d2.slides[1].items.some((i) => i.role === "body" && i.st && i.st.bullets), d2.slides[1]);
    await ev(() => { const H = window.H3Slides, s = H.slide(); H.startEdit(s.items.find((i) => i.role === "title").id); });
    await p.keyboard.type("Plan"); await p.keyboard.press("Escape");
    await ev(() => { const H = window.H3Slides; H.startEdit(H.slide().items.find((i) => i.role === "body").id); });
    await p.keyboard.type("First point"); await p.keyboard.press("Enter"); await p.keyboard.type("Second point"); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("…typed: two bullet points, drawn with bullets", (await deck()).slides[1].items.find((i) => i.role === "body").text === "First point\nSecond point" && (await ev(() => document.querySelectorAll("#slStage .tx.bul .p").length)) === 2);
    // a text box + a shape, moved and sized
    await ev(() => document.getElementById("slAddShape").click()); await ev(() => document.querySelector('.slmenu [data-s="star"]').click()); await p.waitForTimeout(200);
    const s0 = await ev(() => { const it = window.H3Slides.slide().items.find((i) => i.type === "shape"); return { x: it.x, y: it.y, w: it.w, h: it.h }; });
    const c0 = await sp(s0.x + s0.w / 2, s0.y + s0.h / 2), c1 = await sp(s0.x + s0.w / 2 + 137, s0.y + s0.h / 2 + 83);
    await p.mouse.move(c0[0], c0[1]); await p.mouse.down(); await p.mouse.move(c1[0], c1[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
    const s1 = await ev(() => { const it = window.H3Slides.slide().items.find((i) => i.type === "shape"); return { x: it.x, y: it.y, w: it.w, h: it.h }; });
    check("⬚ Shape ▾ ☆: a star in the middle; dragged, it moves (snapping to lines within 6 px)", Math.abs(s1.x - s0.x - 137) <= 8 && Math.abs(s1.y - s0.y - 83) <= 8, { s0, s1 });
    const hd = await ev(() => { const h = document.querySelector('#slStage .hd[data-h="se"]').getBoundingClientRect(); return [h.left + h.width / 2, h.top + h.height / 2]; });
    await p.mouse.move(hd[0], hd[1]); await p.mouse.down(); await p.mouse.move(hd[0] + 60, hd[1] + 30, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
    const s2 = await ev(() => { const it = window.H3Slides.slide().items.find((i) => i.type === "shape"); return { w: it.w, h: it.h }; });
    check("…its corner handle sizes it", s2.w > s1.w + 30 && s2.h > s1.h + 10, { s1, s2 });
    await ev(() => document.getElementById("slAddText").click()); await p.waitForTimeout(150); await p.keyboard.type("A note"); await p.keyboard.press("Escape");
    check("🅃 Text: a text box, typed in at once", (await deck()).slides[1].items.some((i) => i.type === "text" && !i.role && i.text === "A note"));
    // a picture into the picture layout
    await ev(() => { const H = window.H3Slides; H.addSlide("picture"); });
    await p.setInputFiles("#slPicFile", path.join(__dirname, "..", "static", "favicon.png")); await p.waitForTimeout(800);
    const d3 = await deck(), pic = d3.slides[2].items.find((i) => i.role === "pic");
    check("🖼 Picture on a Picture with caption slide: the picture goes into its picture box, kept once in the deck", pic && /^media:/.test(pic.src) && Object.keys(d3.media).length === 1 && (await ev(() => !!document.querySelector("#slStage .it.image img"))), pic);
    // theme, layout, notes
    await ev(() => document.getElementById("slTheme").click()); await ev(() => document.querySelector('.slmenu [data-t="night"]').click()); await p.waitForTimeout(200);
    check("🎨 Theme ▾ Night: every slide's background and colours change", (await deck()).theme === "night" && (await ev(() => getComputedStyle(document.querySelector("#slStage .slslide")).backgroundColor)) === "rgb(15, 27, 45)");
    await ev(() => window.H3Slides.go(1)); await ev(() => document.getElementById("slLayout").click()); await ev(() => document.querySelector('.slmenu [data-l="two"]').click()); await p.waitForTimeout(150);
    const d4 = await deck();
    check("▤ Layout ▾ Two contents: the title and the points keep their words, the star and the text box stay", d4.slides[1].layout === "two" && d4.slides[1].items.find((i) => i.role === "title").text === "Plan" && d4.slides[1].items.find((i) => i.role === "body").text === "First point\nSecond point" && d4.slides[1].items.some((i) => i.type === "shape"), d4.slides[1].items.map((i) => i.role || i.type));
    await ev(() => { const n = document.getElementById("slNotes"); n.focus(); });
    await p.keyboard.type("Say hello first");
    check("speaker notes are kept with the slide", (await deck()).slides[1].notes === "Say hello first");
    // reorder in the list
    const th = await ev(() => [...document.querySelectorAll("#slList .th")].map((t) => { const r = t.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.top]; }));
    await p.mouse.move(th[2][0], th[2][1]); await p.mouse.down(); await p.mouse.move(th[0][0], th[0][2] + 3, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
    const d5 = await deck();
    check("a slide dragged in the list goes to its new place (the picture slide first)", d5.slides[0].layout === "picture" && d5.slides[1].layout === "title", d5.slides.map((s) => s.layout));
    await ev(() => window.H3Slides.undo()); await p.waitForTimeout(100);
    // save + open
    const sv = await ev(() => window.H3Slides.save());
    const files = await ev(async () => (await (await fetch("/api/slides")).json()).files.map((f) => f.name));
    check("💾 Save: Test831.bgk in the project's slides folder", sv && sv.name === "Test831.bgk" && files.includes("Test831.bgk"), { sv, files });
    await ev(() => window.H3Slides.load(window.SlideCore.newDeck("plain"), "Other"));
    await ev(() => document.getElementById("slOpen").click()); await p.waitForTimeout(400);
    await ev(() => document.querySelector('.slmenu [data-f="Test831.bgk"]').click()); await p.waitForTimeout(500);
    const d6 = await deck();
    check("📂 Open ▾: it comes back - 3 slides, the theme, the words, the picture, the notes", d6.slides.length === 3 && d6.theme === "night" && d6.slides[1].notes === "Say hello first" && Object.keys(d6.media).length === 1 && (await ev(() => document.getElementById("slFile").value)) === "Test831", d6.slides.map((s) => s.layout));
    await shot("1-editor");
    // present
    await ev(() => { const H = window.H3Slides; H.deck().slides[1].transition = "fade"; H.go(0); });
    await ev(() => document.getElementById("slPlay").click()); await p.waitForTimeout(500);
    check("▶ Present: the slides over the whole window, 1 / 3", await ev(() => !!document.getElementById("slShow") && document.querySelector("#slShow .cnt").textContent === "1 / 3"));
    await p.keyboard.press("ArrowRight"); await p.waitForTimeout(200);
    check("…→ the next slide (with its fade), 2 / 3", await ev(() => document.querySelector("#slShow .cnt").textContent === "2 / 3" && /slFadeIn/.test(document.querySelector("#slShow .host").lastElementChild.style.animation) && /Hello bitGen/.test(document.querySelector("#slShow .host").textContent)));
    await shot("2-present");
    await p.keyboard.press(" "); await p.waitForTimeout(150);
    const c3 = await ev(() => document.querySelector("#slShow .cnt").textContent);
    await p.keyboard.press("1"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
    const cOne = await ev(() => document.querySelector("#slShow .cnt").textContent);
    await p.keyboard.press("b"); await p.waitForTimeout(100);
    const blk = await ev(() => document.querySelector("#slShow .host").style.visibility === "hidden" && !document.querySelector(".h3fp:not([style*='display: none']) .sfwin, #s_basic.show"));
    await p.keyboard.press("b");
    check("…Space = next (3 / 3), 1 + Enter = slide 1, B = a black screen (the app's single-letter keys left alone)", c3 === "3 / 3" && cOne === "1 / 3" && blk, { c3, cOne, blk });
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    check("…Esc ends it", await ev(() => !document.getElementById("slShow")));
    // PowerPoint
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), ev(() => document.getElementById("slExport").click())]);
    const fp = await dl.path(), buf = fs.readFileSync(fp);
    const JSZip = require(path.join(__dirname, "..", "node_modules", "jszip")), z = await JSZip.loadAsync(buf);
    const names = Object.keys(z.files), s1x = await z.file("ppt/slides/slide1.xml").async("string"), s2x = await z.file("ppt/slides/slide2.xml").async("string"), n2x = await z.file("ppt/notesSlides/notesSlide2.xml").async("string");
    check("⤓ PowerPoint: a .pptx download with 3 slides, the picture and the notes", dl.suggestedFilename() === "Test831.pptx" && names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length === 3 && names.some((n) => /^ppt\/media\//.test(n)) && /Say hello first/.test(n2x) && /Hello bitGen/.test(s1x) && /First point/.test(s2x), { name: dl.suggestedFilename(), names: names.filter((n) => /slide|media/.test(n)) });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
