#!/usr/bin/env node
/* bitGen Studio — 2.802.0 units: print-ready PDF (ext/imageeditdock/pcdtpout.js) - bleed, printer's marks, page boxes, CMYK
 * colours and pictures. Pure (pdf-lib in Node) + source pins. */
"use strict";
const path = require("path"), fs = require("fs"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const X = require("../ext/imageeditdock/pcdtpout.js");
const PL = require("../static/vendor/pdf-lib.min.js");
const r2 = (a) => a.map((v) => Math.round(v * 100) / 100);

(async () => {
  check("cmykSimple: greys = black ink only; pure colours as expected", r2(X.cmykSimple(0, 0, 0)).join() === "0,0,0,1" && r2(X.cmykSimple(128, 128, 128)).join() === "0,0,0,0.5" && r2(X.cmykSimple(255, 0, 0)).join() === "0,1,1,0" && r2(X.cmykSimple(0, 0, 255)).join() === "1,1,0,0");
  const segs = [["M", 0, 0], ["L", 100, 0], ["L", 100, 50], ["C", 0.2, 10, 50, 49.8, 50, 25], ["Z"]];
  check("bleedSegs: points on the page edge go out by the bleed, the others stay", JSON.stringify(X.bleedSegs(segs, 100, 50, 6)) === JSON.stringify([["M", -6, -6], ["L", 106, -6], ["L", 106, 56], ["C", -5.8, 10, 50, 55.8, 50, 25], ["Z"]]) && X.bleedSegs(segs, 100, 50, 0) === segs);
  const bx = X.printBoxes(420, 595, 8.5, true);
  check("printBoxes: media = trim + 2 × (bleed + 24 pt for the marks); trim at (M, M); bleed around it", bx.M === 32.5 && bx.W === 485 && bx.H === 660 && bx.trim.join() === "32.5,32.5,420,595" && bx.bleed.join() === "24,24,437,612" && X.printBoxes(420, 595, 0, false).M === 0);
  const mk = X.marksOps(420, 595, 8.5, { crop: true, reg: true });
  const lines = mk.filter((m) => m[0] === "line"), circ = mk.filter((m) => m[0] === "circle");
  check("marksOps: 8 crop-mark lines (outside the bleed, level with the trim) + 4 registration targets (a circle and a cross)", lines.length === 8 + 8 && circ.length === 4 && lines.slice(0, 8).every((l) => (l[2] === l[4] && (l[3] <= bx.M - 8.5 - 3 || l[3] >= bx.M + 420 + 8.5 + 3)) || (l[1] === l[3] && (l[4] <= bx.M - 8.5 - 3 || l[4] >= bx.M + 595 + 8.5 + 3))), mk.slice(0, 4));
  check("marksOps: the bottom-left crop marks start 3 pt outside the bleed", JSON.stringify(mk[0]) === JSON.stringify(["line", 32.5 - 11.5, 32.5, 32.5 - 23.5, 32.5]) && JSON.stringify(mk[1]) === JSON.stringify(["line", 32.5, 21, 32.5, 9]), mk.slice(0, 2));

  // a page: a red box touching the left edge, a half-transparent picture, black text
  const R = X.recorder(200, 100), g = R.ctx; g.beginPath(); g.rect(0, 10, 50, 30); g.fillStyle = "#ff0000"; g.fill();
  const rgba = new Uint8ClampedArray([0, 0, 255, 255, 255, 255, 255, 128, 10, 20, 30, 0, 0, 0, 0, 255]);
  const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64"));
  const pages = [{ w: 200, h: 100, k: 1, name: "Cover", layers: [{ name: "Box", items: [{ t: "vec", items: R.items }] }, { name: "Pic", items: [{ t: "img", png, rgba, iw: 2, ih: 2, x: 100, y: 50, w: 20, h: 20 }] }, { name: "T", items: [{ t: "text", lines: [{ s: "Hello", x: 10, y: 80 }], size: 12, color: "#000000" }] }] }];
  const r = await X.buildPdf(PL, pages, { title: "P", print: { bleed: 9, crop: true, reg: true, slug: true, cmyk: X.cmykSimple, doc: "Brochure", date: "2026-11-16" } });
  const d = await PL.PDFDocument.load(r.bytes), pg = d.getPage(0);
  const box = (b) => [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 100) / 100).join();
  check("print: MediaBox = trim + bleed + marks room, TrimBox = the page, BleedBox = 9 pt round it", box(pg.getMediaBox()) === "0,0,266,166" && box(pg.getTrimBox()) === "33,33,200,100" && box(pg.getBleedBox()) === "24,24,218,118", [box(pg.getMediaBox()), box(pg.getTrimBox()), box(pg.getBleedBox())]);
  const raw = Buffer.from(r.bytes).toString("latin1");
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((m) => { const b = Buffer.from(m[1], "latin1"); try { return zlib.inflateSync(b).toString("latin1"); } catch { return m[1]; } }).join("\n");
  check("print: the content moved to the trim's corner (1 0 0 1 33 33 cm); the box in CMYK (0 1 1 0 k) and carried 9 pt past the left edge (x -9)", /1 0 0 1 33 33 cm/.test(streams) && /0 1 1 0 k/.test(streams) && /\n-9 \d+(\.\d+)? m\n/.test(streams), streams.slice(0, 300));
  check("print: the text in CMYK black (0 0 0 1 k), the marks in registration colour (1 1 1 1 K) on a Printer's marks layer, with a slug", /0 0 0 1 k/.test(streams) && /1 1 1 1 K/.test(streams) && /0\.25 w/.test(streams) && /Printer's marks/.test(d.catalog.lookup(PL.PDFName.of("OCProperties")).lookup(PL.PDFName.of("OCGs")).asArray().map((x) => d.context.lookup(x).lookup(PL.PDFName.of("Name")).decodeText()).join("|")), streams.slice(-500));
  const imgs = [...raw.matchAll(/\/ColorSpace \/(DeviceCMYK|DeviceGray|DeviceRGB)/g)].map((m) => m[1]);
  check("print: the picture as a CMYK image with its transparency as a grey soft mask (no RGB picture)", imgs.includes("DeviceCMYK") && imgs.includes("DeviceGray") && !imgs.includes("DeviceRGB") && /\/SMask \d+ 0 R/.test(raw) && r.notes.cmykPictures === 1, imgs);
  const cmykStream = [...raw.matchAll(/\/ColorSpace \/DeviceCMYK[\s\S]*?stream\r?\n([\s\S]*?)endstream/g)].map((m) => zlib.inflateSync(Buffer.from(m[1], "latin1")))[0];
  check("print: the picture's pixels converted (blue = 255 255 0 0; white = 0 0 0 0; black = 0 0 0 255)", cmykStream && Array.from(cmykStream.slice(0, 8)).join() === "255,255,0,0,0,0,0,0" && Array.from(cmykStream.slice(12, 16)).join() === "0,0,0,255", cmykStream && Array.from(cmykStream));
  check("print: the notes say print-ready, CMYK, the bleed, the standard-font text (not embedded)", r.notes.print && r.notes.cmyk && r.notes.bleed === 9 && r.notes.standard === 1, r.notes);
  const plain = await X.buildPdf(PL, pages, {});
  const p0 = (await PL.PDFDocument.load(plain.bytes)).getPage(0);
  check("without print: the page = the trim, RGB, no marks", box(p0.getMediaBox()) === "0,0,200,100" && !/Printer's marks/.test(Buffer.from(plain.bytes).toString("latin1")) && !plain.notes.print);

  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8"), DT = src("ext/imageeditdock/pcdtpout.js");
  check("the Export dialog: Print-ready (bleed mm, crop / registration marks, page information, RGB / CMYK + press); fonts embedded when print-ready", /id="dtpPrint"/.test(DT) && /id="dtpBleed"/.test(DT) && /id="dtpCrop"/.test(DT) && /id="dtpReg"/.test(DT) && /id="dtpSlug"/.test(DT) && /id="dtpColour"/.test(DT) && /id="dtpPress"/.test(DT) && /const embed = !!op2\.embed \|\| !!pr;/.test(DT));
  check("pictures touching the edge get their edge pixels stretched into the bleed; CMYK from pcmode.js's press model", /if \(ex\.l\) cg\.drawImage\(pic, b\.x, b\.y, 1, b\.h, 0, ex\.t, ex\.l, b\.h\);/.test(DT) && /MO\.buildLut\(\{ press: pr\.press \|\| "coated", gcr: "medium" \}, 17\)/.test(DT));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); process.exit(1); });
