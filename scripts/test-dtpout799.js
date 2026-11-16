#!/usr/bin/env node
/* bitGen Studio — 2.799.0 units: the desktop-publishing export (ext/imageeditdock/pcdtpout.js) - the path recorder, the layer
 * plan, the PDF (pdf-lib, every page, each layer a PDF layer) and the SVG pages; the dtp store (lib/dtpStore.js). */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const X = require("../ext/imageeditdock/pcdtpout.js");
const PL = require("../static/vendor/pdf-lib.min.js");

(async () => {
  check("parseColor: hex / short hex / rgba / names; a gradient = null", JSON.stringify(X.parseColor("#ff8000")) === '{"r":255,"g":128,"b":0,"a":1}' && X.parseColor("#0f0").g === 255 && X.parseColor("rgba(10, 20, 30, 0.5)").a === 0.5 && X.parseColor("white").r === 255 && X.parseColor({}) === null);
  const e = X.ellipseCurves(50, 50, 40, 20, 0, 0, Math.PI * 2, false);
  check("ellipseCurves: a full ellipse = 4 Bézier quarters, ending where it began", e.curves.length === 4 && Math.abs(e.start[0] - 90) < 1e-9 && Math.abs(e.curves[3][4] - 90) < 1e-6 && Math.abs(e.curves[0][5] - 70) < 1e-6, e);
  // the recorder: a rounded, outlined, turned rectangle
  const R = X.recorder(200, 100), g = R.ctx;
  g.save(); g.translate(10, 0); g.beginPath(); g.roundRect(0, 0, 100, 50, 8); g.fillStyle = "#3366cc"; g.fill(); g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineJoin = "round"; g.setLineDash([12, 8]); g.stroke(); g.restore();
  check("recorder: fill + stroke kept as paths (moved by the transform), colour, alpha, width, join, dash", R.items.length === 2 && R.items[0].t === "fill" && R.items[0].color === "#3366cc" && R.items[0].segs[0][1] === 18
    && R.items[1].alpha === 0.5 && R.items[1].width === 4 && R.items[1].join === "round" && R.items[1].dash.join() === "12,8" && !R.bad, R.items.map((x) => [x.t, x.segs.length, x.color]));
  const R2 = X.recorder(10, 10); R2.ctx.fillStyle = R2.ctx.createLinearGradient(0, 0, 1, 1); R2.ctx.rect(0, 0, 5, 5); R2.ctx.fill();
  const R3 = X.recorder(10, 10); R3.ctx.drawImage({}, 0, 0);
  check("recorder: a gradient / a picture = not keepable (the layer goes as a picture)", !!R2.bad && R3.bad === "drawImage");
  const R4 = X.recorder(10, 10); R4.ctx.scale(2, 2); R4.ctx.beginPath(); R4.ctx.moveTo(1, 1); R4.ctx.lineTo(4, 4); R4.ctx.lineWidth = 3; R4.ctx.stroke();
  check("recorder: a scaled stroke is scaled", R4.items[0].width === 6 && R4.items[0].segs[1][1] === 8);
  // the plan
  const pl = X.plan([{ id: 1, name: "Background", kind: "raster" }, { id: 2, name: "Box", kind: "vector" }, { id: 3, name: "Curves", kind: "raster", needsBelow: true }, { id: 4, name: "Title", kind: "text" }, { id: 5, name: "Logo", kind: "vector" }]);
  check("plan: everything up to the last adjustment / blend / clip = one Flattened picture, then each layer its own", pl.length === 3 && pl[0].ids.join() === "1,2,3" && /^Flattened \(3 layers\)$/.test(pl[0].name) && pl[1].kind === "text" && pl[2].name === "Logo", pl);
  check("plan: nothing that needs what is under it = every layer its own", X.plan([{ id: 1, name: "a", kind: "raster" }, { id: 2, name: "b", kind: "text" }]).length === 2);
  const px = new Uint8ClampedArray(4 * 5 * 4); px[(2 * 5 + 1) * 4 + 3] = 255; px[(3 * 5 + 3) * 4 + 3] = 9;
  check("alphaBox: the box the picture covers; empty = null", JSON.stringify(X.alphaBox(px, 5, 4)) === '{"x":1,"y":2,"w":3,"h":2}' && X.alphaBox(new Uint8ClampedArray(16), 2, 2) === null);
  const ops = X.toPdfOps(R.items[0], 0.5, 100);
  check("toPdfOps: px -> pt, y flipped (a PDF's y goes up), the fill colour, f", ops[0][0] === "rg" && ops[0][1] === 0.2 && ops[1][0] === "m" && ops[1][1] === 9 && ops[1][2] === 50 && ops[ops.length - 1][0] === "f", ops.slice(0, 3));
  const so = X.toPdfOps(R.items[1], 1, 100);
  check("toPdfOps: a stroke = RG, w, J, j, d … S", so[0][0] === "RG" && so[1][0] === "w" && so[3][1] === 1 && so[4][0] === "d" && so[so.length - 1][0] === "S");
  // a two-page document
  const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64"));
  const pages = [
    { w: 1240, h: 1754, k: 72 / 150, name: "Page 1", layers: [
      { name: "Background", items: [{ t: "img", png, x: 0, y: 0, w: 1240, h: 1754 }] },
      { name: "Box", items: [{ t: "vec", items: R.items }] },
      { name: "Title", items: [{ t: "text", lines: [{ s: "Hello bitGen", x: 100, y: 200 }, { s: "Line two", x: 100, y: 260 }], size: 48, color: "#112233", family: "Arial", weight: 700, italic: false, tracking: 50, align: "left" }] }] },
    { w: 1754, h: 1240, k: 72 / 150, name: "Page 2", layers: [{ name: "Note", items: [{ t: "text", lines: [{ s: "Centred", x: 877, y: 600 }], size: 40, color: "#000000", family: "Times New Roman", align: "center" }] }] },
  ];
  const r = await X.buildPdf(PL, pages, { title: "Brochure", stdOf: (it) => (/times/i.test(it.family) ? "TimesRoman" : it.weight >= 600 ? "HelveticaBold" : "Helvetica") });
  const back = await PL.PDFDocument.load(r.bytes);
  const sz = back.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]);
  check("buildPdf: every page at its own size (A4 portrait, then landscape, in pt)", back.getPageCount() === 2 && sz[0].join() === "595,842" && sz[1].join() === "842,595", sz);
  const ocp = back.catalog.lookup(PL.PDFName.of("OCProperties"));
  const ocgs = ocp && ocp.lookup(PL.PDFName.of("OCGs"));
  const names = ocgs ? ocgs.asArray().map((ref) => back.context.lookup(ref).lookup(PL.PDFName.of("Name")).decodeText()) : [];
  check("buildPdf: each layer a PDF layer, named page / layer, listed per page", names.join("|") === "Page 1 / Background|Page 1 / Box|Page 1 / Title|Page 2 / Note" && ocp.lookup(PL.PDFName.of("D")).lookup(PL.PDFName.of("Order")).size() === 2, names);
  const raw = Buffer.from(r.bytes).toString("latin1");
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((m) => { const b = Buffer.from(m[1], "latin1"); try { return zlib.inflateSync(b).toString("latin1"); } catch { return m[1]; } }).join("\n");
  check("buildPdf: the layers' content is marked (BDC /OC … EMC); the box is a real path (re/c … f, S with a dash); the text is real text (Tj) with tracking (Tc)", /\/OC \/OC1 BDC/.test(streams) && /EMC/.test(streams) && / c\n/.test(streams) && /\nf\n/.test(streams) && /\[5\.76 3\.84\] 0 d/.test(streams) && /Tj/.test(streams) && /Tc/.test(streams), streams.slice(0, 400));
  check("buildPdf: the notes count pages, layers, paths, text, pictures", r.notes.pages === 2 && r.notes.layers === 4 && r.notes.vector === 1 && r.notes.text === 2 && r.notes.pictures === 1, r.notes);
  check("buildPdf: title + creator", back.getTitle() === "Brochure" && back.getCreator() === "bitGen Studio");
  const odd = await X.buildPdf(PL, [{ w: 100, h: 100, k: 1, name: "P", layers: [{ name: "T", items: [{ t: "text", lines: [{ s: "日本 ok", x: 1, y: 20 }], size: 12, color: "#000000", family: "x" }] }] }], {});
  check("buildPdf: letters the standard font cannot write become ? (counted), not a failure", odd.notes.lost === 2, odd.notes);
  // SVG
  const svg = X.buildSvg(pages[0]);
  check("buildSvg: the page size in mm, a viewBox in px, each layer an Inkscape layer group", /width="209\.973mm" height="297\.011mm"|width="209\.97\d*mm"/.test(svg) && /viewBox="0 0 1240 1754"/.test(svg) && (svg.match(/inkscape:groupmode="layer"/g) || []).length === 3 && /inkscape:label="Title"/.test(svg), svg.slice(0, 400));
  check("buildSvg: paths (fill + dashed outline), the picture inline, real text with weight / spacing", /<path d="M18 0L/.test(svg) && /stroke-dasharray="12 8"/.test(svg) && /stroke-opacity="0.5"/.test(svg) && /xlink:href="data:image\/png;base64,iVBORw0KGgo/.test(svg) && /<text x="100" y="200" font-family="Arial" font-size="48" font-weight="700"[^>]*letter-spacing="2.4"[^>]*>Hello bitGen<\/text>/.test(svg));
  check("buildSvg: text escaped; centred text anchored middle", /text-anchor="middle"/.test(X.buildSvg(pages[1])) && /&lt;b&gt;/.test(X.buildSvg({ w: 10, h: 10, k: 1, layers: [{ name: "a", items: [{ t: "text", lines: [{ s: "<b>", x: 0, y: 5 }], size: 5 }] }] })));
  check("b64 = Buffer's base64", X.b64(new Uint8Array([1, 2, 3, 4, 5])) === Buffer.from([1, 2, 3, 4, 5]).toString("base64") && X.b64(new Uint8Array([255, 254])) === "//4=");
  check("extOf / FORMATS: pdf, ai (PDF-compatible), svg + cdr = zip", X.extOf("pdf") === ".pdf" && X.extOf("ai") === ".ai" && X.extOf("svg") === ".zip" && X.extOf("cdr") === ".zip" && X.FORMATS.map((f) => f[0]).join() === "pdf,ai,svg,cdr");
  check("safeStem: no path, no extension", X.safeStem("../a/b:c.pdf") === ".._a_b_c" || X.safeStem("../a/b:c.pdf") === "_a_b_c", X.safeStem("../a/b:c.pdf"));

  // the dtp store
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dtp799-"));
  const core = require("../lib/core");
  const was = core.pDir; core.pDir = (sub) => path.join(tmp, sub);
  try {
    const DS = require("../lib/dtpStore");
    const a = DS.save("Brochure.pdf", Buffer.from(r.bytes)), b = DS.save("Brochure.ai", Buffer.from(r.bytes)), z = DS.save("Brochure (SVG).zip", Buffer.from("PK\x03\x04rest"));
    check("dtpStore: .pdf / .ai (a PDF inside) / .zip saved in the project's dtp folder", a.name === "Brochure.pdf" && b.name === "Brochure.ai" && z.name === "Brochure (SVG).zip" && fs.existsSync(path.join(tmp, "dtp", "Brochure.ai")));
    let refused = 0; for (const [n, buf] of [["x.ai", Buffer.from("not a pdf")], ["x.zip", Buffer.from("nope")], ["x.exe", Buffer.from(r.bytes)]]) { try { DS.save(n, buf); } catch (er) { refused++; } }
    check("dtpStore: an .ai / .pdf that is not a PDF, a .zip that is not a zip, another type = refused", refused === 3);
    check("dtpStore: no way out of the folder; list newest first", DS.safeName("../../etc/passwd.ai") === "passwd.ai" && DS.list().length === 3);
  } finally { core.pDir = was; fs.rmSync(tmp, { recursive: true, force: true }); }

  // source pins
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const EXT = JSON.parse(src("ext/imageeditdock/ext.json")), files = EXT.files || EXT.scripts || EXT.js || [];
  const list = Array.isArray(files) ? files : Object.values(EXT).find(Array.isArray);
  check("ext.json loads pcpages.js + pcdtpout.js (before imageedit.js)", list.indexOf("pcpages.js") >= 0 && list.indexOf("pcdtpout.js") >= 0 && list.indexOf("pcdtpout.js") < list.indexOf("imageedit.js"), list.slice(-12));
  check("routes/dtp.js mounted from routes/index.js (not server.js)", /require\("\.\/dtp"\)\.mount\(app\)/.test(src("routes/index.js")) && !/dtpStore|\/api\/dtp/.test(src("misc/server.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); process.exit(1); });
