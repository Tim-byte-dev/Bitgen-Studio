#!/usr/bin/env node
/* bitGen Studio — 2.876.0 units: the business card's size - pccreate.js CARD_SIZES (cardboard / paper by country + PVC CR80 /
 * CR79 / CR90 / CR100), cardSpec (the page at 300 dpi, a PVC card's round corners), cardLayout following them, the dialog's
 * Card size ▾ (pcbizinfo.js sizeOptions / fromForm) and the size kept with the details (lib/businessProfiles.js card_size).
 * Tim (verbatim): "in the business card dialog add dropdown for size, cardboard or pvc those are common sizes" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const C = require("../ext/imageeditdock/pccreate.js"), Z = require("../ext/imageeditdock/pcbizinfo.js"), B = require("../lib/businessProfiles");
const px = (mm) => Math.round((mm / 25.4) * 300);

/* ---- 1 the sizes */
const ids = C.CARD_SIZES.map((c) => c.id);
check("the sizes: cardboard / paper by country (Australia first = the default), then PVC CR80 / CR79 / CR90 / CR100",
  ids.join() === "au,us,eu,jp,cn,ee,square,mini,cr80,cr79,cr90,cr100" && C.CARD_SIZES.filter((c) => c.group === "pvc").length === 4
  && Object.keys(C.CARD_GROUPS).join() === "paper,pvc" && /Cardboard/.test(C.CARD_GROUPS.paper) && /PVC/.test(C.CARD_GROUPS.pvc), ids);
const mm = (id) => { const c = C.cardSize(id); return c.wmm + "x" + c.hmm; };
check("...the common trimmed sizes in mm: AU 90×55, US 88.9×50.8 (3.5×2 in), UK/EU 85×55, Japan 91×55, China 90×54, CR80 85.6×54, CR100 98.5×67",
  mm("au") === "90x55" && mm("us") === "88.9x50.8" && mm("eu") === "85x55" && mm("jp") === "91x55" && mm("cn") === "90x54" && mm("cr80") === "85.6x54" && mm("cr79") === "83.9x51" && mm("cr90") === "92x60" && mm("cr100") === "98.5x67");
check("...every size landscape or square, the PVC ones round-cornered (3.18 mm), the paper ones square-cornered",
  C.CARD_SIZES.every((c) => c.wmm >= c.hmm) && C.CARD_SIZES.every((c) => (c.group === "pvc") === (c.radius === 3.18)));
check("cardSize: an unknown / empty id = Australia 90 × 55", C.cardSize("zz").id === "au" && C.cardSize("").id === "au" && C.mmLabel(C.cardSize("us")) === "88.9 × 50.8 mm");

/* ---- 2 the page */
const s80 = C.cardSpec("cr80"), sau = C.cardSpec(""), ssq = C.cardSpec("square");
check("cardSpec: a Custom page at 300 dpi of that size, landscape; a PVC card's corners 38 px (3.18 mm), paper 0",
  s80.spec.preset === "Custom" && s80.spec.wmm === 85.6 && s80.spec.hmm === 54 && s80.spec.orient === "landscape" && s80.spec.dpi === 300 && s80.radius === px(3.18) && s80.radius === 38
  && sau.spec.wmm === 90 && sau.spec.hmm === 55 && sau.radius === 0 && ssq.spec.wmm === 63.5 && ssq.spec.hmm === 63.5, { s80, sau });
check("...in pixels: CR80 = 1011 × 638, Australia = 1063 × 650 (as before), US = 1050 × 600", px(85.6) === 1011 && px(54) === 638 && px(90) === 1063 && px(55) === 650 && px(88.9) === 1050 && px(50.8) === 600);
const pal = { bg: "#fff7ed", accent: "#b45309", ink: "#3b2f2f", accentInk: "#ffffff" };
const plan = { name: "Rosie Smith", role: "Owner", company: "Rosie's Bakery", phone: "0412 345 678", palette: pal, back: { heading: "What we bake" }, services: ["Bread"] };
const rnd = C.cardLayout(Object.assign({}, plan, { radius: 38 }), 1011, 638), sq = C.cardLayout(Object.assign({}, plan), 1063, 650);
const rects = (els) => els.filter((e) => e && e.t === "rect");
check("cardLayout: a PVC card's background (front + back) and its foot band follow the round corners, the band's top stays square",
  rects(rnd[0])[0].radius === 38 && rects(rnd[0])[0].w === 1011 && rects(rnd[0])[0].h === 638 && rects(rnd[1])[0].radius === 38
  && rects(rnd[0])[1].radius === 38 && rects(rnd[0])[2].radius === 0 && rects(rnd[0])[2].y === rects(rnd[0])[1].y, rects(rnd[0]));
check("...a paper card: square corners, no extra band (as 2.875.0)", rects(sq[0]).every((r) => r.radius === 0) && rects(sq[0]).length === 2 && rects(sq[1])[0].radius === 0, rects(sq[0]));
const P = src("ext/imageeditdock/pccreate.js");
check("make(): a card is made at the size given (cardSize) or kept with the details (card_size), its corners laid; the line says the size",
  /cardSpec\(a\.cardSize \|\| \(biz && biz\.card_size\) \|\| ""\)/.test(P) && /spec = cs\.spec; plan\.radius = cs\.radius/.test(P) && /mmLabel\(cs\.size\)/.test(P) && /" PVC "/.test(P));
check("the Create box's card line: front + back at 300 dpi, the size picked in the next box (no fixed 90 × 55 promised)",
  /Front \+ back at 300 dpi - pick the size \(cardboard or PVC\) in the next box\./.test(P) && !/90 × 55 mm at 300 dpi, front \+ back\./.test(P));

/* ---- 3 the dialog */
const html = Z.sizeOptions(C.CARD_SIZES, C.CARD_GROUPS, "cr80");
const groups = [...html.matchAll(/<optgroup label="([^"]+)">/g)].map((m) => m[1]), opts = [...html.matchAll(/<option value="([^"]+)"( selected)?>([^<]+)</g)];
check("sizeOptions: two groups (Cardboard / paper, PVC (plastic)), every size with its mm, the asked one chosen",
  groups.join("|") === "Cardboard / paper|PVC (plastic)" && opts.length === 12 && opts.filter((m) => m[2]).map((m) => m[1]).join() === "cr80"
  && opts.some((m) => m[3] === "CR80 - credit card size - 85.6 × 54 mm") && opts.some((m) => m[3] === "Australia / NZ - 90 × 55 mm"), { groups, n: opts.length });
const ht = Z.sizeOptions(C.CARD_SIZES, C.CARD_GROUPS, "au", null, (w) => ({ "Cardboard / paper": "厚紙 / 紙", "PVC (plastic)": "PVC（プラスチック）" })[w] || w);
check("...the two group names in the UI language (the page translator does not turn an <optgroup label>)", /<optgroup label="厚紙 \/ 紙">/.test(ht) && /<optgroup label="PVC（プラスチック）">/.test(ht)
  && /uiWord = \(s\) => \{ try \{ const L = win\.H3UiLang/.test(src("ext/imageeditdock/pcbizinfo.js")));
const h0 = Z.sizeOptions(C.CARD_SIZES, C.CARD_GROUPS, "nope");
check("...none kept / an unknown one: Australia chosen", /<option value="au" selected>/.test(h0) && (h0.match(/ selected/g) || []).length === 1);
check("fromForm: the size kept (an id), anything else dropped", Z.fromForm({ company: "X", card_size: "cr80" }).card_size === "cr80" && Z.fromForm({ company: "X", card_size: "<b>" }).card_size === "" && Z.fromForm({ company: "X" }).card_size === "");
const D = src("ext/imageeditdock/pcbizinfo.js");
check("the dialog: Card size ▾ only for a card, the last one picked remembered, the saved details' own size chosen, sent to make()",
  /k === "card" && PC\.CARD_SIZES \? `<div class="kxrow pcbz-size"><span>Card size<\/span><select id="pcbzSize"/.test(D) && /store\.set\("create\.cardSize"/.test(D)
  && /P\.card_size && \[\.\.\.v\("pcbzSize"\)\.options\]/.test(D) && /cardSize: v\("pcbzSize"\) \? v\("pcbzSize"\)\.value : undefined/.test(D));

/* ---- 4 kept with the details */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "biz876-")); B.setRoot(tmp);
const k1 = B.save({ company: "Rosie's Bakery", card_size: "CR80" });
const k2 = B.save({ id: k1.id, company: "Rosie's Bakery", card_size: "../x" });
check("businessProfiles: card_size kept in profiles.json (lower case), anything that is not an id dropped",
  k1.card_size === "cr80" && JSON.parse(fs.readFileSync(path.join(tmp, "profiles.json"), "utf8")).profiles[0].card_size === "" && k2.card_size === "" && B.clean({}).card_size === "", { k1, k2 });

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
