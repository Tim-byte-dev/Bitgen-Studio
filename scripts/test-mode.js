/* bitGen Studio — 2.487.0: IMAGE ▸ MODE, PROOF COLOURS, GAMUT WARNING, CMYK TIFF (ext/imageeditdock/pcmode.js) - the
 * image editor's gap, round G. Pure checks of the press model, palettes, dithers, duotone inks and the files. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), M = require(path.join(ROOT, "ext", "imageeditdock", "pcmode.js"));
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); if (got !== undefined) console.log("      got " + JSON.stringify(got).slice(0, 400)); } }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

check("sRGB ↔ linear round trip; grey uses the canvas filter's weights", [0, 0.02, 0.2, 0.5, 0.9, 1].every((v) => Math.abs(M.srgb(M.lin(v)) - v) < 1e-9) && M.grayOf(255, 0, 0) === 54 && M.grayOf(0, 255, 0) === 182 && M.grayOf(255, 255, 255) === 255);
// --- the press
const P = M.makePress({ press: "coated", gcr: "medium" });
{
  const w = M.solve(P, 1, 1, 1), k = M.solve(P, 0, 0, 0), g = M.solve(P, 0.5, 0.5, 0.5);
  check("press: white is no ink; black is the richest black the press allows (K 100 %, C M Y within total ink)", w.cmyk.every((v) => v < 1e-6) && Math.abs(k.cmyk[3] - 1) < 1e-6 && k.cmyk.slice(0, 3).reduce((a, b) => a + b) <= 2 + 1e-6 && k.dE < 0.5, [w.cmyk, k.cmyk]);
  check("press: a mid grey prints as grey - more cyan than magenta / yellow (grey balance), some black", g.dE < 0.5 && g.cmyk[0] > g.cmyk[1] && g.cmyk[3] > 0.2, g.cmyk);
  const inG = [[0.8, 0.3, 0.2], [0.2, 0.4, 0.6], [0.6, 0.55, 0.3], [0.9, 0.85, 0.8], [0.3, 0.2, 0.25]].map((c) => M.solve(P, ...c).dE);
  check("press: printable colours come back as they were (ΔE < 1)", inG.every((e) => e < 1), inG);
  const outG = [[0, 0, 1], [0, 1, 0], [0, 1, 1]].map((c) => M.solve(P, ...c).dE);
  check("press: screen blue, green and cyan cannot be printed (ΔE > 20)", outG.every((e) => e > 20), outG);
  const heavy = M.solve(M.makePress({ press: "coated", gcr: "heavy" }), 0.5, 0.5, 0.5), none = M.solve(M.makePress({ press: "coated", gcr: "none" }), 0.5, 0.5, 0.5);
  check("black generation: heavy puts more of a grey into black than none", heavy.cmyk[3] > none.cmyk[3] + 0.3 && heavy.dE < 0.5 && none.dE < 0.5, [heavy.cmyk, none.cmyk]);
}
{
  const L = M.buildLut({ press: "newsprint", gcr: "light" }, 9); let worst = 0;
  for (let i = 0; i < L.cmyk.length; i += 4) worst = Math.max(worst, L.cmyk[i] + L.cmyk[i + 1] + L.cmyk[i + 2] + L.cmyk[i + 3]);
  check("total ink: newsprint never above 240 % anywhere on the grid", worst <= 2.4 + 1e-6, worst);
  const paperW = L.abs.slice(L.abs.length - 3);
  check("simulate paper colour: white shows as newsprint's grey-yellow paper, not white", paperW[0] < 0.9 && paperW[2] < paperW[0], Array.from(paperW));
}
{
  const L = M.buildLut({ press: "coated", gcr: "medium" }, 17); let s = 1, mx = 0; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < 200; i++) { const c = [rnd(), rnd(), rnd()].map((v) => Math.round(v * 255)), d = M.solve(L.press, ...c.map((v) => v / 255)); if (d.dE > 4) continue; mx = Math.max(mx, M.dE(M.lutAt(L, L.rel, 3, ...c), d.out)); }
  check("the 17 x 17 x 17 table read in between agrees with solving the colour (ΔE < 2.5)", mx < 2.5, mx);
  const T = M.screenTable(L, "rel", 4), j = ((63 * 64) + 0) * 64 + 0, jr = ((0 * 64) + 0) * 64 + 63;
  check("screen table: pure blue flagged as out of gamut, white not", T.G[j] === 1 && T.G[64 * 64 * 64 - 1] === 0 && T.T[(64 * 64 * 64 - 1) * 3] === 255, [T.G[j], T.G[jr]]);
}
// --- indexed colour
{
  check("palettes: Web 216, Uniform 27 for 27, Grey 16 from black to white, ", M.webPalette().length === 216 && M.uniformPalette(27).length === 27 && M.grayPalette(16).length === 16 && M.grayPalette(16)[15][0] === 255);
  const W = 64, H = 32, d = new Uint8ClampedArray(W * H * 4);
  for (let p = 0; p < W * H; p++) { d[p * 4] = 128; d[p * 4 + 1] = 128; d[p * 4 + 2] = 128; d[p * 4 + 3] = p < 10 ? 0 : 255; }
  const bw = [[0, 0, 0], [255, 255, 255]];
  const none = M.indexImage(d, W, H, bw, { dither: "none" }), dif = M.indexImage(d, W, H, bw, { dither: "diffusion" }), pat = M.indexImage(d, W, H, bw, { dither: "pattern" });
  const whites = (r) => { let n = 0, t = 0; for (let p = 10; p < W * H; p++) { t++; if (r.data[p * 4] === 255) n++; } return n / t; };
  check("indexed: without dither a 50 % grey goes to one colour; diffusion and pattern dither keep about half white", (whites(none) === 1 || whites(none) === 0) && Math.abs(whites(dif) - 0.5) < 0.05 && Math.abs(whites(pat) - 0.5) < 0.05, [whites(none), whites(dif), whites(pat)]);
  check("indexed: clear pixels stay clear (index 255); without transparency they go on white", none.index[0] === 255 && none.data[3] === 0 && M.indexImage(d, W, H, bw, { transparency: false }).data[0] === 255);
}
// --- bitmap
{
  const W = 80, H = 80, grey = (v) => { const d = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } return d; };
  const white = (o) => { let n = 0; for (let i = 0; i < o.length; i += 4) if (o[i] === 255) n++; return n / (o.length / 4); };
  const only = (o) => { for (let i = 0; i < o.length; i += 4) if (o[i] !== 0 && o[i] !== 255) return false; return true; };
  const r = ["threshold", "pattern", "diffusion", "halftone"].map((m) => M.bitmapImage(grey(64), W, H, { method: m, cell: 8 }));
  check("bitmap: only black and white, whatever the method", r.every(only));
  check("bitmap: a 25 % grey - threshold all black; pattern, diffusion and halftone about a quarter white", white(r[0]) === 0 && [1, 2, 3].every((k) => Math.abs(white(r[k]) - 0.25) < 0.08), r.map(white));
}
// --- duotone
{
  const mono = M.duotoneLut([{ color: "#000000", curve: 0 }]);
  let worst = 0; for (let v = 0; v < 256; v++) worst = Math.max(worst, Math.abs(mono[v * 3] - v));
  check("duotone: one black ink at curve 0 is the grey itself", worst <= 1, worst);
  const sep = M.duotoneLut(M.DUO_PRESETS.sepia.inks);
  check("duotone: sepia - white stays white, black is (near) black, the midtones warm (red > blue)", sep[255 * 3] === 255 && sep[255 * 3 + 2] === 255 && sep[0] < 20 && sep[128 * 3] > sep[128 * 3 + 2] + 10, [sep[128 * 3], sep[128 * 3 + 1], sep[128 * 3 + 2]]);
  const more = M.duotoneLut([{ color: "#000000", curve: 40 }]);
  check("duotone: a curve to the right puts more ink in the midtones (darker)", more[128 * 3] < mono[128 * 3] - 20, [more[128 * 3], mono[128 * 3]]);
}
// --- files
{
  const L = M.buildLut({ press: "coated", gcr: "medium" }, 9), w = 6, h = 4, d = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) { const v = p < 12 ? 255 : 0; d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = v; d[p * 4 + 3] = 255; }
  const b = M.encodeTIFFcmyk({ width: w, height: h, data: d }, (r, g, bb) => M.lutAt(L, L.cmyk, 4, r, g, bb));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-cm-")), f = path.join(tmp, "c.tif"); fs.writeFileSync(f, Buffer.from(b));
  const r = spawnSync("python3", ["-I", "-c", "import sys,json;from PIL import Image;im=Image.open(sys.argv[1]);print(json.dumps([im.mode, im.size, im.getpixel((0,0)), im.getpixel((0,3))]))", f], { encoding: "utf8" });
  if (r.status === 0) { const [mode, size, wp, kp] = JSON.parse(r.stdout); check("CMYK TIFF: read by another program as CMYK - white is no ink, black is K 100 % (+ the rich-black C M Y)", mode === "CMYK" && size[0] === 6 && size[1] === 4 && wp.every((v) => v === 0) && kp[3] === 255 && kp[0] > 100, [mode, size, wp, kp]); }
  else console.log("SKIP: Pillow is not here - the CMYK TIFF was not read back");
  fs.rmSync(tmp, { recursive: true, force: true });
  const pal = [[1, 2, 3], [250, 128, 7], [0, 0, 0]], act = M.actBytes(pal), back = M.parseAct(act);
  check(".act colour tables: 772 bytes, read back with the count", act.length === 772 && back.length === 3 && back[1][1] === 128 && act[771] === 255);
}
// --- the wiring
{
  const ext = JSON.parse(read("ext/imageeditdock/ext.json")).scripts, ie = read("ext/imageeditdock/imageedit.js"), pd = read("ext/imageeditdock/pcdocs.js"), bgi = read("ext/imageeditdock/pcbgi.js"), ms = read("ext/imageeditdock/pcmeasure.js"), fp = read("ext/imageeditdock/pcfileplus.js"), src = read("ext/imageeditdock/pcmode.js");
  check("the wiring: pcmode.js after pcfileplus.js, before imageedit.js and installed; the mode applied on screen and in flatten()", ext.indexOf("pcmode.js") > ext.indexOf("pcfileplus.js") && ext.indexOf("pcmode.js") < ext.indexOf("imageedit.js") && /win\.PCMode\.install\(E\)/.test(ie) && /E\.viewFinish\(cv, true\)/.test(ie) && /E\.viewFinish\(out, false\)/.test(ie));
  check("the wiring: the mode kept per document and in .bgi; Info reads the press's CMYK; CMYK TIFF registered with Export As", /"imgMode", "imgModeOpt"\]/.test(pd) && /imgMode: S\.imgMode \|\| "rgb"/.test(bgi) && /S\.imgMode = /.test(bgi) && /E\.cmykOf \? E\.cmykOf/.test(ms) && /addType: \(t, fn\)/.test(fp) && /addType\("image\/x-tiff-cmyk"/.test(src));
  check("no product names in what users read", !/Photoshop|Adobe|Corel|Illustrator|Lightroom/.test(src));
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
