#!/usr/bin/env node
/* bitGen Studio — 2.849.0 units: the image editor's icon toolbar + 🔍 Print Preview (pcquickbar.js BUTTONS / paperOf /
 * printHtml) and ✨ Create With the AI (lib/createAi.js plan / clean / palette with a stand-in LLM; pccreate.js flyerLayout /
 * brochureLayout / cardLayout / webLayout / kindOf; the wiring - pcdoctpl aiMake, pcdocai picture, the route, ext.json). */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const Q = require(path.join(ROOT, "ext/imageeditdock/pcquickbar.js"));
  const ids = Q.BUTTONS.filter((b) => b !== "|").map((b) => b[0]);
  check("the toolbar: New, Open, Save, Save As, Print, Print Preview | Undo, Redo | Cut, Copy, Paste | ✨ Create - each a menu command", ids.join() === "file.new,file.open,file.savebgi,file.savebgias,file.print,file.printpreview,edit.undo,edit.redo,edit.cut,edit.copy,edit.paste,file.createai");
  check("paperOf: an A4 page (mm, portrait / landscape); a plain picture from its px at its dpi", JSON.stringify(Q.paperOf({ wmm: 210, hmm: 297, orient: "portrait" })) === '{"w":210,"h":297}' && JSON.stringify(Q.paperOf({ wmm: 210, hmm: 297, orient: "landscape" })) === '{"w":297,"h":210}' && JSON.stringify(Q.paperOf(null, 960, 480)) === '{"w":254,"h":127}');
  const ph = Q.printHtml(["data:a", "data:b"], { w: 210, h: 297 }, "My <doc>");
  check("printHtml: the page's size with no margins, every page on its own sheet, the title kept safe", /@page\{size:210mm 297mm;margin:0\}/.test(ph) && (ph.match(/class="pg"/g) || []).length === 2 && /page-break-after:always/.test(ph) && /<title>My doc<\/title>/.test(ph));
  const qb = src("ext/imageeditdock/pcquickbar.js");
  check("under the menu bar (afterend of .pcmenu); 🔍 Print Preview… in File after Print (Ctrl+F2); buttons greyed when their command can't run; the editor keeps its caret", /menu\.insertAdjacentElement\("afterend", bar\)/.test(qb) && /"file\.printpreview", "🔍 Print Preview…", "Ctrl\+F2"/.test(qb) && /b\.disabled = !on/.test(qb) && /e\.preventDefault\(\); \}\);   \/\/ the canvas/.test(qb));
  /* ---- the planner */
  const A = require(path.join(ROOT, "lib/createAi.js"));
  const pal = A.palette({ bg: "#111111", accent: "#ffdd00", ink: "#222222" });
  check("palette: readable - dark ink on a dark background becomes light; text on the accent picked to read", pal.ink === "#ffffff" && pal.accentInk === "#1f2933" && A.palette({}).bg === "#ffffff");
  let sent = null;
  A.setComplete(async (o) => { sent = o; return { ok: true, text: '```json\n{"headline":"Fresh Sourdough","subheadline":"Saturday market","body":"Baked at 4am.","bullets":["Sourdough $8","Croissants $4"],"cta":"Come early","contact":"0412 345 678","palette":{"bg":"#fffaf0","accent":"#b45309","ink":"#3b2f2f"},"picture":"a loaf of sourdough"}\n```' }; });
  const r = await A.plan({ kind: "flyer", ask: "A flyer for Rosie's Bakery: sourdough $8, croissants $4, 0412 345 678" });
  check("plan(flyer): the LLM told the JSON shape, never to invent contact details; its answer cleaned (headline, bullets, palette, picture idea)", /never invent phone numbers/.test(sent.messages[0].content) && /"cta"/.test(sent.messages[0].content) && r.plan.headline === "Fresh Sourdough" && r.plan.bullets.length === 2 && r.plan.palette.accent === "#b45309" && r.plan.picture === "a loaf of sourdough", r.plan);
  A.setComplete(async () => ({ ok: true, text: '{"title":"Smile Dental","pages":[{"title":"Home","heading":"Gentle dental care","intro":"…","sections":[{"heading":"Check-ups","text":"…"},{"heading":"Whitening","text":"…"}]},{"title":"Contact","heading":"Find us","sections":[]}],"contact":"02 9999 0000"}' }));
  const w = (await A.plan({ kind: "website", ask: "a dentist" })).plan;
  A.setComplete(async () => ({ ok: true, text: "sorry I can't" }));
  let e1 = ""; try { await A.plan({ kind: "card", ask: "x" }); } catch (e) { e1 = e.message; }
  let e2 = ""; try { await A.plan({ kind: "poster", ask: "x" }); } catch (e) { e2 = e.message; }
  check("plan(website): pages with menu names, headings, sections; a non-JSON answer said; an unknown kind refused", w.pages.length === 2 && w.pages[0].title === "Home" && w.pages[0].sections.length === 2 && /not the card/.test(e1) && /make what/.test(e2), { w, e1, e2 });
  const card = A.clean("card", { name: "Dr Jane Lee", role: "Dentist", company: "Smile Dental", phone: "02 9999 0000", email: "jane@smile.example", palette: { bg: "#ffffff", accent: "#0e7490" } });
  const bro = A.clean("brochure", { title: "Happy Paws", tagline: "Care for every pet", panels: [{ heading: "Check-ups", body: "…" }, { heading: "Vaccinations", body: "…" }], pictures: ["a vet with a dog", "a cat"] });
  check("clean: a brochure always has its 4 panels + the back; a card its contact lines", bro.panels.length === 4 && bro.back.heading === "Contact us" && card.email === "jane@smile.example" && card.palette.accent === "#0e7490");
  /* ---- the layouts */
  const C = require(path.join(ROOT, "ext/imageeditdock/pccreate.js"));
  const inBox = (els, W, H) => els.every((e) => e.x >= 0 && e.y >= 0 && e.x + e.w <= W + 1 && (e.t !== "text" || e.y + e.h <= H * 1.02));
  const fl = C.flyerLayout(r.plan, 1240, 1754)[0];
  check("flyerLayout (A4 at 150 dpi): background, accent band, headline biggest + boldest, the picture box with its idea, bullets, the call to action on an accent button, contact at the foot - all on the page, top to bottom",
    fl[0].t === "rect" && fl[0].h === 1754 && fl.some((e) => e.t === "picture" && e.prompt === "a loaf of sourdough") && fl.find((e) => e.t === "text").str === "Fresh Sourdough" && fl.find((e) => e.t === "text").weight === 800
    && fl.some((e) => e.t === "text" && /^•  Sourdough \$8\n•  Croissants \$4$/.test(e.str)) && fl.some((e) => e.t === "text" && e.str === "Come early" && e.align === "center") && fl.some((e) => e.t === "text" && e.str === "0412 345 678" && e.y > 1500) && inBox(fl, 1240, 1754), fl.map((e) => [e.t, e.y, e.h]));
  const br = C.brochureLayout(bro, 1754, 1240);
  check("brochureLayout (A4 landscape): two pages - outside (flap | back with the contact | the cover on the accent with the title) and inside (3 panels), fold lines at the thirds",
    br.length === 2 && br[0].some((e) => e.t === "text" && e.str === "Happy Paws" && e.x >= 1169) && br[0].some((e) => e.t === "text" && e.str === "Contact us" && e.x >= 584 && e.x < 1169) && br[1].filter((e) => e.t === "text" && e.weight === 800).length >= 2
    && br.every((pg) => pg.filter((e) => e.name === "fold").map((e) => e.x).join() === "584,1168") && inBox(br[0], 1754, 1240) && inBox(br[1], 1754, 1240));
  const cd = C.cardLayout(card, 1063, 650);
  check("cardLayout (90 × 55 mm at 300 dpi): front (name, role, phone / email) + back (the company on the accent)", cd.length === 2 && cd[0].some((e) => e.str === "Dr Jane Lee") && cd[0].some((e) => e.t === "text" && /jane@smile\.example/.test(e.str)) && cd[1][0].fill === "#0e7490" && cd[1].some((e) => e.str === "Smile Dental") && inBox(cd[0], 1063, 650));
  const wl = C.webLayout(w, w.pages[0], 0, 1440, 900), wc = C.webLayout(w, w.pages[1], 1, 1440, 900);
  check("webLayout (1440 × 900): the hero on the accent with the page's heading, sections side by side; the contact on the Contact page", wl.some((e) => e.str === "Gentle dental care") && wl.filter((e) => e.t === "text" && e.weight === 700).length === 2 && wl.filter((e) => e.weight === 700).map((e) => e.x)[1] > 700 && wc.some((e) => e.str === "02 9999 0000") && !wl.some((e) => e.str === "02 9999 0000"));
  check("textH grows with the words and shrinks with the width", C.textH("x".repeat(200), 20, 400) > C.textH("x".repeat(50), 20, 400) && C.textH("x".repeat(200), 20, 200) > C.textH("x".repeat(200), 20, 400));
  check("the prompt docker: \"make a flyer / brochure / business cards …\" -> Create (words without a verb, or other things, left alone)", C.kindOf("make a flyer for my bakery") === "flyer" && C.kindOf("create business cards for Jane") === "card" && C.kindOf("design a tri-fold brochure") === "brochure" && C.kindOf("a flyer") === null && C.kindOf("make an invoice") === null);
  /* ---- the wiring */
  const pc = src("ext/imageeditdock/pccreate.js");
  check("✨ Create: 7 kinds; documents / stories into a new A4 WP layer (pcdocai write), invoices via pcdoctpl aiMake, websites in Web View as web pages; File ▸ ✨ Create With the AI…",
    C.KINDS.map((k) => k[0]).join() === "document,story,flyer,brochure,card,website,invoice" && /E\.docAi\.write\(/.test(pc) && /E\.docTpl\.aiMake\(ask/.test(pc) && /E\.views\.apply\("web"\)/.test(pc) && /"file\.createai", "✨ Create With the AI…"/.test(pc)
    && /aiMake/.test(src("ext/imageeditdock/pcdoctpl.js")) && /picture, files:/.test(src("ext/imageeditdock/pcdocai.js")));
  const ej = src("ext/imageeditdock/ext.json"), ie = src("ext/imageeditdock/imageedit.js");
  check("wiring: pccreate + pcquickbar in ext.json right after pcviews and installed after PCViews (every menu + docker exists); POST /api/create/plan from routes/index.js (not server.js)",
    ej.indexOf("pcviews.js") < ej.indexOf("pccreate.js") && ej.indexOf("pccreate.js") < ej.indexOf("pcquickbar.js") && ie.indexOf("PCViews.install(E)") < ie.indexOf("PCCreate.install(E)") && ie.indexOf("PCCreate.install(E)") < ie.indexOf("PCQuickBar.install(E)") && /require\("\.\/createAi"\)\.mount\(app\)/.test(src("routes/index.js")) && !/createAi/.test(src("misc/server.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
