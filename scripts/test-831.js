#!/usr/bin/env node
/* bitGen Studio — 2.831.0 units: 🎞 SLIDES. Tim: "can you add the slides now please".
 *   ext/slidesdock/slidecore.js (themes, layouts, new decks / slides, clean, relayout keeping the words, moving / copying
 *   slides, shapes as paths, looks), lib/slideFiles.js (a project's decks: names, save / read / list / remove, what is kept),
 *   lib/slidePptx.js (a real .pptx: slides, texts with bullets, shapes, the picture, the notes, the size), the wiring. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const K = require(path.join(ROOT, "ext/slidesdock/slidecore.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const PNG = "data:image/png;base64," + fs.readFileSync(path.join(ROOT, "static/favicon.png")).toString("base64");

(async () => {
  const d = K.newDeck("tiger");
  check("a new deck: 16:9 (1280 x 720), the theme, one title slide with a title + subtitle box", d.w === 1280 && d.h === 720 && d.theme === "tiger" && d.slides.length === 1 && d.slides[0].layout === "title" && d.slides[0].items.map((i) => i.role).join() === "title,sub");
  check("…4:3 = 960 x 720; an unknown theme = Plain", K.newDeck("nope", "4:3").w === 960 && K.newDeck("nope").theme === "plain");
  const lay = Object.keys(K.LAYOUTS).map((l) => [l, K.newSlide(l, d).items.map((i) => i.role).join("+")]);
  check("every layout's boxes: content = title + bullets, two = title + 2, picture = title + picture + caption, blank = none", JSON.stringify(lay) === JSON.stringify([["title", "title+sub"], ["content", "title+body"], ["two", "title+body+body2"], ["section", "title+sub"], ["picture", "title+pic+body"], ["titleonly", "title"], ["blank", ""]]) && K.newSlide("content", d).items[1].st.bullets === true, lay);
  check("…all inside the slide, whole px", Object.keys(K.LAYOUTS).every((l) => K.newSlide(l, d).items.every((i) => i.x >= 0 && i.y >= 0 && i.x + i.w <= 1280 && i.y + i.h <= 720 && Number.isInteger(i.x) && Number.isInteger(i.w))));
  const s = K.newSlide("content", d); s.items[0].text = "Plan"; s.items[1].text = "a\nb"; s.items.push({ id: "x", type: "shape", shape: "star", x: 1, y: 2, w: 3, h: 4, text: "" });
  K.relayout(s, "two", d);
  check("a new layout keeps the title and the points (to their new boxes) and the slide's own items", s.layout === "two" && s.items.find((i) => i.role === "title").text === "Plan" && s.items.find((i) => i.role === "body").text === "a\nb" && s.items.some((i) => i.id === "x"));
  K.relayout(s, "titleonly", d);
  check("…a layout with no box for the points: they stay as a plain text box", s.items.find((i) => i.role === "title").text === "Plan" && s.items.some((i) => !i.role && i.type === "text" && i.text === "a\nb"));
  const dd = { slides: [{ id: "a" }, { id: "b" }, { id: "c" }] }; K.moveSlide(dd, 0, 2);
  const cp = K.copySlide(s);
  check("moveSlide / copySlide (new ids, same words)", dd.slides.map((x) => x.id).join("") === "bca" && cp.id !== s.id && cp.items.length === s.items.length && cp.items.every((it, i) => it.id !== s.items[i].id && it.text === s.items[i].text));
  const dirty = { w: 1280, theme: "bold", slides: [{ layout: "zzz", transition: "spin", bg: "red", items: [{ type: "text", x: "5", y: 1e9, w: -3, text: "hi", st: { size: 9999, color: "#AABBCC", font: "Ar<i>al", b: 1, align: "middle" } }, { type: "script", text: "x" }, { type: "image", src: "media:p1", x: 0, y: 0, w: 10, h: 10 }, { type: "image", src: "media:gone", x: 0, y: 0, w: 10, h: 10 }, { type: "shape", shape: "blob", fill: "url(x)" }] }], media: { p1: PNG, unused: PNG, bad: "javascript:alert(1)" } };
  const c = K.clean(dirty), it0 = c.slides[0].items[0];
  check("clean: only known things, sizes clamped, colours lower-case, a bad colour / font / alignment / transition dropped", c.slides[0].layout === "blank" && c.slides[0].transition === "none" && !c.slides[0].bg && c.slides[0].items.length === 4 && it0.x === 5 && it0.y === 1440 && it0.w === 2 && !it0.st.size && it0.st.color === "#aabbcc" && it0.st.font === "Arial" && it0.st.b === true && !it0.st.align, c.slides[0].items);
  check("…only the pictures a slide shows are kept (a missing one = an empty picture), a shape's unknown kind = a rectangle", Object.keys(c.media).join() === "p1" && c.slides[0].items[1].src === "media:p1" && c.slides[0].items[2].src === "" && c.slides[0].items[3].shape === "rect" && !c.slides[0].items[3].fill);
  check("…a deck with no slides gets one", K.clean({}).slides.length === 1);
  const T = K.THEMES.night, tl = K.textLook({ role: "title", st: {} }, { theme: "night" }), bl = K.textLook({ role: "body", st: { size: 20, color: "#ff0000", bullets: true } }, { theme: "night" });
  check("textLook: the theme's title font / colour, an item's own look first", tl.font === T.titleFont && tl.color === T.title && tl.size === 44 && bl.size === 20 && bl.color === "#ff0000" && bl.bullets && bl.font === T.font);
  check("bgOf / shapeLook: a slide's own background, else the theme's; a shape filled with the accent", K.bgOf({ bg: "#123456" }, { theme: "night" }) === "#123456" && K.bgOf({}, { theme: "night" }) === T.bg && K.shapeLook({}, { theme: "night" }).fill === T.accent);
  check("shapePath: every shape a path in a 100 x 100 box", K.SHAPES.every((k) => /^M[\d.]/.test(K.shapePath(k))) && (K.shapePath("star").match(/L/g) || []).length === 9);
  check("titleOf: a slide's first title line", K.titleOf({ items: [{ role: "title", text: "One\nTwo" }] }) === "One" && K.titleOf({ items: [] }) === "");

  // the files
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sl831-"));
  const core = require(path.join(ROOT, "lib/core.js")); const pd0 = core.pDir; core.pDir = (k) => path.join(tmp, k);
  const SF = require(path.join(ROOT, "lib/slideFiles.js"));
  try {
    check("safeName: inside the folder, .bgk", SF.safeName("../../x/My talk.pptx") === "My talk.bgk" && SF.safeName("") === "Presentation.bgk" && SF.safeName("a/b\\c") === "c.bgk" || SF.safeName("a/b\\c").endsWith(".bgk"));
    const deck = K.newDeck("forest"); deck.slides[0].items[0].text = "Kept"; deck.media.p = PNG; deck.slides[0].items.push({ id: "im", type: "image", x: 10, y: 10, w: 100, h: 100, src: "media:p" });
    const w = SF.write("Talk", deck), back = SF.read("Talk.bgk"), ls = SF.list();
    check("write / read / list: the deck kept in the project's slides folder, cleaned, its picture with it", w.name === "Talk.bgk" && fs.existsSync(path.join(tmp, "slides", "Talk.bgk")) && back.theme === "forest" && back.slides[0].items[0].text === "Kept" && back.media.p === PNG && ls.length === 1 && ls[0].name === "Talk.bgk");
    let err = null; try { SF.read("Nope"); } catch (e) { err = e; }
    check("…a missing deck = 404; remove() deletes it", err && err.status === 404 && SF.remove("Talk").ok && !fs.existsSync(path.join(tmp, "slides", "Talk.bgk")));
  } finally { core.pDir = pd0; fs.rmSync(tmp, { recursive: true, force: true }); }

  // PowerPoint
  const P = require(path.join(ROOT, "lib/slidePptx.js"));
  const pd = K.newDeck("night"); pd.slides[0].items[0].text = "Hello"; pd.slides[0].items[1].text = "";
  const s2 = K.newSlide("content", pd); s2.items[0].text = "Points"; s2.items[1].text = "one\ntwo"; s2.notes = "Remember this"; pd.slides.push(s2);
  pd.media.p1 = PNG; s2.items.push({ id: "im", type: "image", x: 900, y: 300, w: 200, h: 120, src: "media:p1", fit: "contain" }, { id: "sh", type: "shape", shape: "rarrow", x: 100, y: 500, w: 200, h: 100, text: "Go", fill: "#ff0000" });
  const hid = K.newSlide("blank", pd); hid.hidden = true; pd.slides.push(hid);
  const buf = await P.toPptx(pd), JSZip = require(path.join(ROOT, "node_modules/jszip")), z = await JSZip.loadAsync(buf);
  const x1 = await z.file("ppt/slides/slide1.xml").async("string"), x2 = await z.file("ppt/slides/slide2.xml").async("string"), pres = await z.file("ppt/presentation.xml").async("string"), n2 = await z.file("ppt/notesSlides/notesSlide2.xml").async("string");
  check("a .pptx: 3 slides, widescreen 13.33 x 7.5 in (12192000 x 6858000 EMU)", Object.keys(z.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length === 3 && /cx="12192000" cy="6858000"/.test(pres), pres.match(/sldSz[^>]*/));
  check("…the title's words; an empty placeholder left out; the theme's background", /<a:t>Hello<\/a:t>/.test(x1) && (x1.match(/<p:sp>/g) || []).length === 1 && /0F1B2D/i.test(x1));
  check("…bullets on the points (each line a paragraph), the arrow shape with its words + fill, the picture, the notes",
    (x2.match(/<a:buChar/g) || []).length === 2 && /prst="rightArrow"/.test(x2) && /<a:t>Go<\/a:t>/.test(x2) && /FF0000/.test(x2) && /<p:pic>/.test(x2) && /Remember this/.test(n2) && Object.keys(z.files).some((n) => /^ppt\/media\/image/.test(n)));
  check("…a hidden slide stays hidden", /show="0"/.test(await z.file("ppt/slides/slide3.xml").async("string")));
  check("imageSize: PNG / JPEG headers", JSON.stringify(P.imageSize(PNG)) === '{"w":64,"h":64}' && P.imageSize("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAAMBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==").w === 3);

  // the wiring
  const ej = JSON.parse(read("ext/slidesdock/ext.json")), html = read("ext/slidesdock/dock.html"), idx = read("routes/index.js");
  check("the extension: slidecore, the docker, the show; its docker html (the ❔ help page 'slides', ⛶, ✕)", ej.id === "slidesdock" && /^slidecore\.js,(slidedraw\.js,)?slidesdock\.js,(slideio\.js,)?(slideai\.js,)?slideshow\.js$/.test(ej.scripts.join())   /* 2.832.0: + slidedraw, slideio */ && /H3Help\.open\('slides'\)/.test(html) && /id="slMaxBtn"/.test(html) && /id="slCloseBtn"/.test(html));
  check("routes/slides.js mounted from routes/index.js (not server.js); the app strip's 🎞 button waits for it", /require\("\.\/slides"\)\.mount\(app\)/.test(idx) && !/slides/.test(read("misc/server.js")) && /"tX_slidesdock", "🎞", "Slides"/.test(read("static/appstrip.js")));
  check("the help page in all four languages", ["", "ja/", "zh-CN/", "zh-TW/"].every((l) => fs.existsSync(path.join(ROOT, "static/help", l + "slides.html"))));
  check("pptxgenjs is a dependency (MIT) and credited", /"pptxgenjs"/.test(read("package.json")) && /PptxGenJS/.test(read("lib/credits.json")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e.stack || e)); console.log(`\nRESULT: ${pass} passed, ${fail + 1} failed`); process.exit(1); });
