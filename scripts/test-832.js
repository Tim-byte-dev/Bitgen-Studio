#!/usr/bin/env node
/* bitGen Studio — 2.832.0 units: 🎞 SLIDES part 2. Tim: "yes please go ahead wth part 2".
 *   lib/slidePptxIn.js: a PowerPoint file written the way PowerPoint writes it (placeholders with no place of their own - the
 *   layout's / master's; theme colours with lumMod; a group; a table left out; notes; a hidden slide; a transition; a picture)
 *   opened as a deck; our own .pptx back in (positions, sizes, turn, colours, bullets); lib/slidePptx.js writes transitions;
 *   ext/slidesdock/slidedraw.js wrap(); the wiring (routes, the audience window, Electron, the buttons). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const K = require(path.join(ROOT, "ext/slidesdock/slidecore.js")), IN = require(path.join(ROOT, "lib/slidePptxIn.js")), OUT = require(path.join(ROOT, "lib/slidePptx.js"));
const JSZip = require(path.join(ROOT, "node_modules/jszip"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const PNG = fs.readFileSync(path.join(ROOT, "static/favicon.png"));
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = (rs) => `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rs.map(([id, t, tg]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${t}" Target="${tg}"/>`).join("")}</Relationships>`;
const xf = (x, y, w, h, rot) => `<a:xfrm${rot ? ` rot="${rot}"` : ""}><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`;
const ph = (type, idx) => `<p:nvSpPr><p:cNvPr id="2" name="x"/><p:cNvSpPr/><p:nvPr><p:ph${type ? ` type="${type}"` : ""}${idx ? ` idx="${idx}"` : ""}/></p:nvPr></p:nvSpPr>`;
const para = (t, rpr, ppr) => `<a:p>${ppr || ""}<a:r><a:rPr lang="en-US"${rpr || ""}/><a:t>${t}</a:t></a:r></a:p>`;
async function handmade() {
  const z = new JSZip(), E = 914400;
  z.file("ppt/presentation.xml", `<p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
  z.file("ppt/_rels/presentation.xml.rels", REL([["rId1", "theme", "theme/theme1.xml"], ["rId2", "slide", "slides/slide1.xml"], ["rId3", "slide", "slides/slide2.xml"]]));
  z.file("ppt/theme/theme1.xml", `<a:theme ${NS}><a:themeElements><a:clrScheme name="t"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F3864"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2></a:clrScheme></a:themeElements></a:theme>`);
  z.file("ppt/slideMasters/slideMaster1.xml", `<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg2"/></a:solidFill></p:bgPr></p:bg><p:spTree><p:sp>${ph("title")}<p:spPr>${xf(838200, 365125, 10515600, 1325563)}</p:spPr></p:sp><p:sp>${ph("body", "1")}<p:spPr>${xf(838200, 1825625, 10515600, 4351338)}</p:spPr></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1"/><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle></p:txStyles></p:sldMaster>`);
  z.file("ppt/slideLayouts/slideLayout1.xml", `<p:sldLayout ${NS}><p:cSld name="Title and Content"><p:spTree><p:sp>${ph("title")}<p:spPr/></p:sp><p:sp>${ph(null, "1")}<p:spPr/></p:sp></p:spTree></p:cSld></p:sldLayout>`);
  z.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", REL([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]));
  // slide 1: placeholders with no xfrm (the master's places), bullets (a body placeholder), a theme colour darker (lumMod), a
  // group of a rectangle, a table (left out), a fade, notes, a picture
  z.file("ppt/slides/slide1.xml", `<p:sld ${NS}><p:cSld><p:spTree>`
    + `<p:sp>${ph("title")}<p:spPr/><p:txBody><a:bodyPr/>${para("Quarterly plan", ' b="1"')}</p:txBody></p:sp>`
    + `<p:sp>${ph(null, "1")}<p:spPr/><p:txBody><a:bodyPr/>${para("Grow sales")}${para("Hire two people")}</p:txBody></p:sp>`
    + `<p:sp><p:nvSpPr><p:cNvPr id="5" name="Note"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xf(E, 6 * E, 4 * E, E / 2)}<a:prstGeom prst="rect"/><a:noFill/></p:spPr><p:txBody><a:bodyPr anchor="ctr"/>${para("Draft", ' sz="1800" i="1"><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill></a:rPr><a:rPr', '<a:pPr algn="r"/>')}</p:txBody></p:sp>`
    + `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="6" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${6 * E}" y="${5 * E}"/><a:ext cx="${2 * E}" cy="${E}"/><a:chOff x="0" y="0"/><a:chExt cx="${4 * E}" cy="${2 * E}"/></a:xfrm></p:grpSpPr>`
    + `<p:sp><p:nvSpPr><p:cNvPr id="7" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xf(0, 0, 4 * E, 2 * E, 1800000)}<a:prstGeom prst="ellipse"/><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:ln w="25400"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:ln></p:spPr></p:sp></p:grpSp>`
    + `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="8" name="t"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"/></a:graphic></p:graphicFrame>`
    + `<p:pic><p:nvPicPr><p:cNvPr id="9" name="p"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId3"/></p:blipFill><p:spPr>${xf(9 * E, E, 2 * E, 2 * E)}</p:spPr></p:pic>`
    + `</p:spTree></p:cSld><p:transition spd="med"><p:fade/></p:transition></p:sld>`);
  z.file("ppt/slides/_rels/slide1.xml.rels", REL([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "notesSlide", "../notesSlides/notesSlide1.xml"], ["rId3", "image", "../media/image1.png"]]));
  z.file("ppt/notesSlides/notesSlide1.xml", `<p:notes ${NS}><p:cSld><p:spTree><p:sp>${ph("sldImg")}<p:spPr/></p:sp><p:sp>${ph("body", "1")}<p:spPr/><p:txBody>${para("Mention the budget")}${para("Then questions")}</p:txBody></p:sp></p:spTree></p:cSld></p:notes>`);
  z.file("ppt/media/image1.png", PNG);
  // slide 2: hidden, its own background
  z.file("ppt/slides/slide2.xml", `<p:sld ${NS} show="0"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="102030"/></a:solidFill></p:bgPr></p:bg><p:spTree><p:sp>${ph("title")}<p:spPr/><p:txBody><a:bodyPr/>${para("Hidden one")}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  z.file("ppt/slides/_rels/slide2.xml.rels", REL([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]]));
  return z.generateAsync({ type: "nodebuffer" });
}

(async () => {
  const r = await IN.fromPptx(await handmade()), d = r.deck, s1 = d.slides[0], s2 = d.slides[1];
  const t = s1.items.find((i) => i.role === "title"), b = s1.items.find((i) => i.role === "body");
  check("a PowerPoint file: 2 slides, 16:9 = 1280 x 720", d.w === 1280 && d.h === 720 && d.slides.length === 2, [d.w, d.h, d.slides.length]);
  check("…placeholders with no place of their own get the master's place (title 88,38 1104x139) and its text size (44 pt = 59 px)", t && t.text === "Quarterly plan" && Math.abs(t.x - 88) <= 1 && Math.abs(t.y - 38) <= 1 && Math.abs(t.w - 1104) <= 1 && t.st.size === 59 && t.st.b === true, t);
  check("…the body placeholder: its lines, bullets, 28 pt = 37 px; the slide = Title and content", b && b.text === "Grow sales\nHire two people" && b.st.bullets && b.st.size === 37 && s1.layout === "content", [b, s1.layout]);
  const note = s1.items.find((i) => i.text === "Draft");
  check("…a text box: right-aligned, middle, italic, 18 pt = 24 px, the theme's accent 1 at 50 % brightness (#203864)", note && note.type === "text" && note.st.align === "right" && note.st.valign === "middle" && note.st.i && note.st.size === 24 && note.st.color === "#203864", note);
  const ell = s1.items.find((i) => i.type === "shape");
  check("…a group's ellipse: placed by the group (scaled 1/2), turned 30°, red, its outline the theme's text colour", ell && ell.shape === "ellipse" && Math.abs(ell.x - 6 * 96) <= 1 && Math.abs(ell.y - 5 * 96) <= 1 && Math.abs(ell.w - 192) <= 1 && Math.abs(ell.h - 96) <= 1 && ell.rot === 30 && ell.fill === "#ff0000" && ell.line === "#000000" && ell.lw >= 2, ell);
  const pic = s1.items.find((i) => i.type === "image");
  check("…the picture kept in the deck's media; the table left out and said", pic && /^media:/.test(pic.src) && d.media[pic.src.slice(6)].startsWith("data:image/png;base64,") && r.notes.some((n) => /1 × tables left out/.test(n)), [pic, r.notes]);
  check("…the speaker notes (two lines), the fade, the master's background (bg2 = #e7e6e6)", s1.notes === "Mention the budget\nThen questions" && s1.transition === "fade" && s1.bg === "#e7e6e6", [s1.notes, s1.transition, s1.bg]);
  check("…the second slide: hidden, its own background, its title from the master's place", s2.hidden === true && s2.bg === "#102030" && s2.items[0].text === "Hidden one" && Math.abs(s2.items[0].y - 38) <= 1);
  let err = null; try { await IN.fromPptx(await new JSZip().file("x", "y").generateAsync({ type: "nodebuffer" })); } catch (e) { err = e; }
  check("…a file with no slides is refused", err && /no slides/.test(err.message));

  // our own .pptx, out and back in
  const deck = K.newDeck("night"); deck.slides[0].items[0].text = "Hello"; deck.slides[0].items[1].text = "Sub";
  const s = K.newSlide("content", deck); s.items[0].text = "Points"; s.items[1].text = "one\ntwo"; s.notes = "say it"; s.transition = "push"; deck.slides.push(s);
  deck.media.p1 = "data:image/png;base64," + PNG.toString("base64");
  s.items.push({ id: "x", type: "image", x: 900, y: 300, w: 200, h: 120, src: "media:p1", fit: "contain" }, { id: "y", type: "shape", shape: "star", x: 100, y: 500, w: 100, h: 100, text: "Hi", fill: "#ff0000", rot: 30 });
  const buf = await OUT.toPptx(deck), back = (await IN.fromPptx(buf)).deck;
  const z = await JSZip.loadAsync(buf), x2 = await z.file("ppt/slides/slide2.xml").async("string");
  check("⤓ PowerPoint writes each slide's transition (<p:push>)", /<p:transition spd="med"><p:push dir="l"\/><\/p:transition>/.test(x2));
  const bs = back.slides[1], bt = bs.items.find((i) => i.text === "Points"), bb = bs.items.find((i) => i.text === "one\ntwo"), bst = bs.items.find((i) => i.type === "shape");
  check("our .pptx back in: the same places and sizes, text sizes, colours, bullets, the turned star, the picture, notes, transition, background",
    back.slides.length === 2 && bt && bt.x === s.items[0].x && bt.y === s.items[0].y && bt.st.size === 44 && bt.st.color === "#f2f6ff" && bb.st.bullets && bb.st.size === 28 && bst.shape === "star" && bst.rot === 30 && bst.fill === "#ff0000" && bst.text === "Hi" && bs.items.some((i) => i.type === "image" && i.x === 900 && i.w === 200) && bs.notes === "say it" && bs.transition === "push" && bs.bg === "#0f1b2d", bs.items);

  // the canvas drawing's wrap
  const W = require(path.join(ROOT, "ext/slidesdock/slidedraw.js")), ctx = { measureText: (t) => ({ width: t.length * 10 }) };
  check("SlideDraw.wrap: words to lines that fit (10 px a letter, 60 px), a too-long word cut", JSON.stringify(W.wrap(ctx, "one two three four", 60)) === '["one","two","three","four"]' && JSON.stringify(W.wrap(ctx, "ab cd ef", 60)) === '["ab cd","ef"]' && JSON.stringify(W.wrap(ctx, "abcdefghij", 60)) === '["abcdef","ghij"]', [W.wrap(ctx, "one two three four", 60), W.wrap(ctx, "ab cd ef", 60), W.wrap(ctx, "abcdefghij", 60)]);

  // the wiring
  const rs = read("routes/slides.js"), em = read("electron/main.js"), ej = JSON.parse(read("ext/slidesdock/ext.json")), html = read("ext/slidesdock/dock.html"), au = read("static/slideaudience.html");
  check("routes: POST /api/slides/import (.pptx) and /api/slides/export/pdf (kept in the slides folder)", /\/api\/slides\/import/.test(rs) && /slidePptxIn"\)\.fromPptx/.test(rs) && /\/api\/slides\/export\/pdf/.test(rs) && /%PDF-/.test(rs));
  check("the audience window: static/slideaudience.html (driven by the presenter), let open as an app window by electron/main.js", /H3AudReady = true/.test(au) && /opener\.H3SlideShow/.test(au) && /static\/slideaudience\.html`\) return \{ action: "allow"/.test(em));
  check("the extension's scripts (slidedraw + slideio) and buttons: 🎤 Presenter view, ⤒ Open PowerPoint, ⤓ PDF ▾, 🖼 Picture ▾", ej.scripts.join() === "slidecore.js,slidedraw.js,slidesdock.js,slideio.js,slideshow.js" && /id="slPresent2"/.test(html) && /id="slImport"/.test(html) && /id="slPdf"/.test(html) && /🖼 Picture ▾/.test(html) && /id="slPptxFile"/.test(html));
  check("the turn handle + turned resizing (slidesdock.js), Alt+F5, the presenter's keys kept from the app's own (secfloat / pfloat)", /kind: "rot"/.test(read("ext/slidesdock/slidesdock.js")) && /k === "F5" && e\.altKey/.test(read("ext/slidesdock/slidesdock.js")) && /#slPresenter/.test(read("static/secfloat.js")) && /#slPresenter/.test(read("ext/promptdock/pfloat.js")));
  check("@xmldom/xmldom is a dependency (MIT) and credited", /"@xmldom\/xmldom"/.test(read("package.json")) && /xmldom/i.test(read("lib/credits.json")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e.stack || e)); console.log(`\nRESULT: ${pass} passed, ${fail + 1} failed`); process.exit(1); });
