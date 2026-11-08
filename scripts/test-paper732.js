#!/usr/bin/env node
/* bitGen Studio — 2.732.0 units: the sheet music's PAPER (ext/musicdock/scorepaper.js + static/abcscore.js's look).
 * Tim (verbatim): "allow user to choose background color/material tiling for the sheet music"
 *   - the settings kept sane (colour, material, tile size 40-600 pt, texture 0-100 %, ink, in the PDF), a picture only from
 *     the project or a data URL; the ink: auto = dark on light paper, light on dark, or the one picked;
 *   - SVG: the paper colour, the material as a pattern of its tile, every note / line / word in the ink, grey words
 *     between the ink and the paper;
 *   - PDF: a coloured page = one filled rectangle; a material = ONE JPEG (DCTDecode, never decoded) in a tiling pattern
 *     the size of a repeat, grey JPEGs too; the ink set once; qpdf / pdftoppm read it and the paper is the colour asked for.
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const A = require("../static/abcscore.js");
const P = require("../ext/musicdock/scorepaper.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const RGB_JPEG = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD1T/kSf+xb/wDTb/8Ac/8A6K/65/6ooor81jFSV2fZH//Z", "base64"), GREY_JPEG = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAEAAQBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/ACv/2Q==", "base64");

// ── the settings ──
const d = P.normalize({});
check("defaults: white, plain, 180 pt repeats, 60 % texture, auto ink, in the PDF", d.color === "#ffffff" && d.material === "plain" && d.size === 180 && d.strength === 60 && d.ink === "auto" && d.pdf === true && d.picture === null, d);
const n = P.normalize({ color: "#ABCDEF", material: "linen", size: 9999, strength: -4, ink: "rainbow", pdf: false });
check("normalize: the colour lower-cased, the size held to 600, the texture to 0, an unknown ink = auto, the PDF untick kept",
  n.color === "#abcdef" && n.material === "linen" && n.size === 600 && n.strength === 0 && n.ink === "auto" && n.pdf === false, n);
check("normalize: a bad colour / material = the default", P.normalize({ color: "red", material: "lava" }).color === "#ffffff" && P.normalize({ material: "lava" }).material === "plain");
check("normalize: a picture is only from the project (/passets/images/) or a data URL; 'picture' with none = plain",
  P.normalize({ material: "picture", picture: { src: "/passets/images/wood.png", name: "wood.png" } }).picture.src === "/passets/images/wood.png"
  && P.normalize({ material: "picture", picture: { src: "https://evil.example/x.png" } }).material === "plain"
  && P.normalize({ material: "picture", picture: { src: "data:image/jpeg;base64,AAAA" } }).material === "picture");
check("eight materials, plain first; seven paper colours with Night among them",
  P.MATERIALS.length === 8 && P.MATERIALS[0].id === "plain" && P.MATERIALS.map((m) => m.id).join() === "plain,parchment,linen,laid,recycled,watercolour,canvas,kraft" && P.PRESETS.length === 7 && P.PRESETS.some((p) => p.label === "Night"));
check("luminance: white 1, black 0, mid grey ~0.2", P.luminance("#ffffff") > 0.99 && P.luminance("#000000") < 0.01 && Math.abs(P.luminance("#7f7f7f") - 0.21) < 0.02);
check("ink auto: near-black on white / cream / kraft, warm white on Night; a picked ink is kept",
  P.inkFor({ color: "#ffffff" }) === P.INKS.black && P.inkFor({ color: "#cdb084" }) === P.INKS.black && P.inkFor({ color: "#22262f" }) === P.INKS.white
  && P.inkFor({ color: "#ffffff", ink: "navy" }) === P.INKS.navy && P.inkFor({ color: "#ffffff" }, "#101010") === P.INKS.white);

// ── SVG ──
const R = A.render("X:1\nT:Paper\nM:4/4\nL:1/4\nK:C\nC D E F|G A B c|]\n");
const pg = R.pages[0];
const plain = A.toSVG(pg);
check("SVG without a look: white paper, black ink (as 2.731.0)", plain.includes('<rect width="595.28" height="841.89" fill="#ffffff"/>') && plain.includes('fill="#000000"') && !plain.includes("<pattern"));
const svg = A.toSVG(pg, { id: "t1", look: { paper: { color: "#f3e6c8", avg: "#e0d0b0", tile: { href: "data:image/jpeg;base64,AAAA", w: 200, h: 150 } }, ink: "#3b2817" } });
check("SVG with a material: the colour, a 200 x 150 pt pattern of the tile over the page, its own id",
  svg.includes('fill="#f3e6c8"') && /<pattern id="abcpt1" patternUnits="userSpaceOnUse" width="200" height="150"><image href="data:image\/jpeg;base64,AAAA" width="200" height="150"/.test(svg) && svg.includes('fill="url(#abcpt1)"'));
const paths = (svg.match(/<path [^>]*>/g) || []);
check("SVG: every path in the ink (no black left)", paths.length > 20 && paths.every((p) => !/#000000/.test(p) && (/fill="#3b2817"|fill="none"/.test(p))) && paths.some((p) => /stroke="#3b2817"/.test(p)));
const title = /<text[^>]*fill="([^"]+)"[^>]*>Paper<\/text>/.exec(svg);
check("SVG: the words in the ink", title && title[1] === "#3b2817", title && title[1]);
const R2 = A.render("X:1\nM:4/4\nL:1/8\nK:C\n" + "CDEF GABc|".repeat(200) + "]\n");
const pnum = A.toSVG(R2.pages[0], { look: { paper: { color: "#ffffff", avg: "#ffffff" }, ink: "#000000" } });
const grey = /<text[^>]*fill="([^"]+)"[^>]*>1 \/ \d+<\/text>/.exec(pnum);
check("SVG: a grey word (the page number) sits between the ink and the paper", grey && grey[1] !== "#000000" && grey[1] !== "#ffffff" && /^#([0-9a-f]{2})\1\1$/.test(grey[1]), grey && grey[1]);

// ── PDF ──
const s = (b) => Buffer.from(b).toString("latin1");
const pc = s(A.toPDF(R.pages, { title: "Paper" }, { paper: { color: "#22262f" }, ink: "#f5f0e4" }));
check("PDF on a coloured paper: one filled rectangle in that colour under the page, the ink set (fill + stroke), no pattern",
  /q 0\.133 0\.149 0\.184 rg 0 0 595\.28 841\.89 re f Q/.test(pc) && /0\.961 0\.941 0\.894 rg 0\.961 0\.941 0\.894 RG 1 j/.test(pc) && !/\/Pattern/.test(pc));
check("PDF without a look: no paper rectangle, black ink (white paper as before)", /\n0 0 0 rg 0 0 0 RG 1 j/.test(s(A.toPDF(R.pages))) && !/re f Q/.test(s(A.toPDF(R.pages))));
check("jpegInfo: the RGB fixture 8 x 8 x 3, the grey one 4 x 4 x 1, a PNG = null",
  JSON.stringify(A.jpegInfo(new Uint8Array(RGB_JPEG))) === '{"w":8,"h":8,"n":3}' && A.jpegInfo(new Uint8Array(GREY_JPEG)).n === 1 && A.jpegInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])) === null);
const lookT = { paper: { color: "#c8aa78", avg: "#c8aa78", tile: { jpeg: new Uint8Array(RGB_JPEG), w: 120, h: 90 } }, ink: "#141414" };
const pt = A.toPDF(R2.pages, { title: "Tiled" }, lookT), ts = s(pt);
check("PDF with a material: ONE image (8 x 8, DeviceRGB, DCTDecode, its exact bytes) in ONE tiling pattern 120 x 90 pt",
  (ts.match(/\/Subtype \/Image/g) || []).length === 1 && /\/Width 8 \/Height 8 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode \/Length 0*\d+/.test(ts)
  && ts.includes(RGB_JPEG.toString("latin1")) && (ts.match(/\/PatternType 1/g) || []).length === 1 && /\/BBox \[0 0 120 90\] \/XStep 120 \/YStep 90/.test(ts), ts.slice(0, 200));
check("PDF: every page paints the pattern over the whole page", R2.pages.length > 1 && (ts.match(/\/Pattern cs \/P1 scn 0 0 595\.28 841\.89 re f Q/g) || []).length === R2.pages.length
  && (ts.match(/\/Pattern << \/P1 \d+ 0 R >>/g) || []).length === R2.pages.length);
const xm = /startxref\n(\d+)\n%%EOF/.exec(ts), xref = +xm[1];
const offs = ts.slice(xref).split("\n").slice(2).filter((l) => / 00000 n $/.test(l)).map((l) => +l.slice(0, 10));
check("PDF: with the binary image inside, every xref offset still lands on its object", offs.length > 6 && offs.every((o, k) => ts.slice(o).startsWith((k + 1) + " 0 obj")));
const gs = s(A.toPDF(R.pages, {}, { paper: { color: "#ffffff", tile: { jpeg: new Uint8Array(GREY_JPEG), w: 50, h: 50 } }, ink: "#000000" }));
check("PDF: a grey JPEG goes in as DeviceGray", /\/Width 4 \/Height 4 \/ColorSpace \/DeviceGray/.test(gs));
check("PDF: a tile that is not a JPEG is left out (the colour alone)", !/\/Pattern/.test(s(A.toPDF(R.pages, {}, { paper: { color: "#eeeeee", tile: { jpeg: new Uint8Array([1, 2, 3]), w: 50, h: 50 } } }))));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "paper732-"));
const has = (b) => { try { execFileSync("which", [b], { stdio: "ignore" }); return true; } catch { return false; } };
const f = path.join(tmp, "t.pdf"); fs.writeFileSync(f, Buffer.from(pt));
if (has("qpdf")) { let ok = true, out = ""; try { out = execFileSync("qpdf", ["--check", f], { encoding: "utf8" }); } catch (e) { ok = false; out = String(e.stdout || e.message); } check("qpdf --check: the tiled PDF has no errors", ok && /No syntax or stream encoding errors/.test(out), out.slice(0, 300)); }
if (has("pdftoppm")) {
  const px = (file, at) => {
    execFileSync("pdftoppm", ["-r", "20", "-f", "1", "-l", "1", file, path.join(tmp, "r")]);
    const ppm = fs.readdirSync(tmp).filter((x) => x.startsWith("r") && x.endsWith(".ppm")).map((x) => path.join(tmp, x))[0];
    const b = fs.readFileSync(ppm); fs.unlinkSync(ppm);
    const hdr = b.toString("latin1", 0, 30).split(/\s+/); const W = +hdr[1], H = +hdr[2];
    let o = 0, nl = 0; while (nl < 4) { if (b[o] === 10 || b[o] === 32) nl++; o++; }      // P6 W H 255 + one whitespace
    const at2 = (x, y) => { const i = o + 3 * (y * W + x); return [b[i], b[i + 1], b[i + 2]]; };
    return at(at2, W, H);
  };
  const near = (c, t, d2) => c.every((v, k) => Math.abs(v - t[k]) <= d2);
  const corner = px(f, (at, W, H) => at(W - 3, H - 3));
  check("pdftoppm: the tiled page's corner is the tile's colour (not white)", near(corner, [200, 170, 120], 45), corner);
  const fc = path.join(tmp, "c.pdf"); fs.writeFileSync(fc, Buffer.from(A.toPDF(R.pages, {}, { paper: { color: "#22262f" }, ink: "#f5f0e4" })));
  const cc = px(fc, (at, W, H) => at(W - 3, H - 3));
  check("pdftoppm: the Night page is #22262f", near(cc, [0x22, 0x26, 0x2f], 6), cc);
} else console.log("SKIP: pdftoppm is not installed");
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
