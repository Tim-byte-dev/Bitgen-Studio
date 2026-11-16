#!/usr/bin/env node
/* bitGen Studio — 2.799.0 units: pages (ext/imageeditdock/pcpages.js) - sizes, orientation, dpi, the page read back from a
 * picture, moving pages, what a page keeps; + source pins (pcdocs keeps a document's pages, pcbgi saves / opens them). */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const P = require("../ext/imageeditdock/pcpages.js");
const DOCS = require("../ext/imageeditdock/pcdocs.js");

check("page sizes: A3 - A6, Letter, Legal, Tabloid, Business card, DL, Square (mm)", P.PAGE_SIZES.map((x) => x[0]).join() === "A3,A4,A5,A6,Letter,Legal,Tabloid,Business card,DL,Square" && P.PAGE_SIZES[1][1] === 210 && P.PAGE_SIZES[1][2] === 297);
check("pagePx: A4 portrait at 150 dpi = 1240 x 1754; landscape = turned; 300 dpi = 2480 x 3508", JSON.stringify(P.pagePx({ preset: "A4", orient: "portrait", dpi: 150 })) === '{"w":1240,"h":1754}'
  && JSON.stringify(P.pagePx({ preset: "A4", orient: "landscape", dpi: 150 })) === '{"w":1754,"h":1240}' && JSON.stringify(P.pagePx({ preset: "A4", dpi: 300 })) === '{"w":2480,"h":3508}');
check("pagePx: a business card (wider than tall) portrait = tall; Letter at 72 dpi = 612 x 792", JSON.stringify(P.pagePx({ preset: "Business card", orient: "portrait", dpi: 300 })) === '{"w":650,"h":1063}' && JSON.stringify(P.pagePx({ preset: "Letter", dpi: 72 })) === '{"w":612,"h":792}');
check("pagePx: Custom mm, orientation swaps the sides", JSON.stringify(P.pagePx({ preset: "Custom", wmm: 100, hmm: 50, orient: "landscape", dpi: 254 })) === '{"w":1000,"h":500}' && JSON.stringify(P.pagePx({ preset: "Custom", wmm: 100, hmm: 50, orient: "portrait", dpi: 254 })) === '{"w":500,"h":1000}');
const c = P.cleanPage({ preset: "nope", wmm: -5, hmm: "x", orient: "sideways", dpi: 9999, name: 5 });
check("cleanPage: unknown preset = Custom, sizes / dpi kept in range", c.preset === "Custom" && c.wmm === 10 && c.hmm === 297 && c.dpi === 600 && c.orient === "portrait" && c.name === "5", c);
check("guess: 1240 x 1754 at 150 dpi = A4 portrait; 1754 x 1240 = A4 landscape; 1000 x 700 = Custom mm", P.guess(1240, 1754, 150).preset === "A4" && P.guess(1754, 1240, 150).orient === "landscape" && P.guess(1000, 700, 150).preset === "Custom" && P.guess(1000, 700, 150).wmm === 169.3, P.guess(1000, 700, 150));
check("moveIdx: the page in front follows a move", P.moveIdx(2, 2, 0) === 0 && P.moveIdx(2, 0, 3) === 1 && P.moveIdx(1, 3, 0) === 2 && P.moveIdx(0, 2, 3) === 0);
const K = P.pageKeys(DOCS.DOC_KEYS);
check("pageKeys: a page keeps its own layers, undo, selection, paths, channels, comps, guides - not the document's name / view / pages", ["layers", "undo", "redo", "sel", "paths", "channels", "comps", "guides", "w", "h", "savedTop"].every((k) => K.includes(k))
  && !["name", "zoom", "panX", "pages", "bgiName", "fileInfo"].some((k) => K.includes(k)), K);
check("sizeLabel: A4 ▯ 150 dpi; Custom in mm", P.sizeLabel({ preset: "A4", dpi: 150 }) === "A4 ▯ 150 dpi" && P.sizeLabel({ preset: "Custom", wmm: 100, hmm: 50, dpi: 300 }) === "100 × 50 mm ▭ 300 dpi");
check("pcdocs: a document carries its pages (DOC_KEYS + blank pages null)", DOCS.DOC_KEYS.includes("pages") && DOCS.blank().pages === null);

const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BG = src("ext/imageeditdock/pcbgi.js"), IE = src("ext/imageeditdock/imageedit.js"), PG = src("ext/imageeditdock/pcpages.js");
check("pcbgi: a document of pages saves every other page inside (pages/<id>.bgi) and opens them again in place", /if \(!\(opts && opts\.nested\) && E\.pages && \(E\.pages\.needsBgi \? E\.pages\.needsBgi\(\) : E\.pages\.count\(\) > 1\)\) m\.pages = await E\.pages\.toBgi\(/.test(BG) && /await E\.pages\.fromBgi\(m\.pages, files, \(bytes\) => openBytes\(bytes, fileName, \{ inPlace: true, nested: true, docName: keep \}\)\)/.test(BG) && /if \(o\.nested\) return/.test(BG) && /`pages\/\$\{pg\.id\}\.bgi`/.test(PG));
check("imageedit.js installs PCPages + PCDtpOut after the artboards", IE.indexOf("win.PCPages.install(E)") > IE.indexOf("win.PCArtboards.install(E)") && IE.indexOf("win.PCDtpOut.install(E)") > IE.indexOf("win.PCPages.install(E)"));
check("menus: File ▸ New Document with Pages…, Window ▸ Pages, File ▸ Export ▸ Document (PDF / AI / SVG)…", /C\("file\.newpages", "New Document with Pages…"/.test(PG) && /C\("win\.pages", "Pages"/.test(PG) && /C\("file\.exportdtp", "Document \(PDF \/ AI \/ SVG\)…"/.test(src("ext/imageeditdock/pcdtpout.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
