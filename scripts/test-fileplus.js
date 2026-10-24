/* bitGen Studio — 2.485.0: MORE FILE TYPES, FILE INFO, PRINT, CONTACT SHEET, CROP AND STRAIGHTEN PHOTOS
 * (ext/imageeditdock/pcfileplus.js, lib/imgConvert.js, routes/imgconvert.js). The image editor's gap, round F (part 1).
 * Pure checks; the encoders' files are read back with Python's Pillow when it is there. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), X = path.join(ROOT, "ext", "imageeditdock");
const F = require(path.join(X, "pcfileplus.js"));
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); if (got !== undefined) console.log("      got " + JSON.stringify(got).slice(0, 300)); } }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// a 7 x 5 test picture: a gradient, one clear pixel, one half-clear
function pic(w, h, clear) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; d[i] = x * 30; d[i + 1] = y * 50; d[i + 2] = 255 - x * 20; d[i + 3] = 255; }
  if (clear) { d[3] = 0; d[(w + 1) * 4 + 3] = 128; }
  return { width: w, height: h, data: d };
}
const P = pic(7, 5, true);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-fp-"));
const py = spawnSync("python3", ["-c", "import PIL"], { encoding: "utf8" });
const HAVE_PIL = py.status === 0;
function viaPil(bytes, ext) {
  const f = path.join(tmp, "t." + ext); fs.writeFileSync(f, Buffer.from(bytes));
  const r = spawnSync("python3", ["-I", "-c", "import sys,json;from PIL import Image;im=Image.open(sys.argv[1]);f=im.format;im=im.convert('RGBA');print(json.dumps({'f':f,'w':im.width,'h':im.height,'px':[list(im.getpixel((x,y))) for y in range(im.height) for x in range(im.width)]}))", f], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) return { err: r.stderr };
  return JSON.parse(r.stdout);
}
const px = (id, x, y) => Array.from(id.data.slice((y * id.width + x) * 4, (y * id.width + x) * 4 + 4));
const same = (a, b, tol) => a.every((v, k) => Math.abs(v - b[k]) <= (tol || 0));

// --- BMP / TIFF / TGA: lossless, with transparency
for (const [name, enc, ext, fmt] of [["BMP", F.encodeBMP, "bmp", "BMP"], ["TIFF", F.encodeTIFF, "tif", "TIFF"], ["TGA", F.encodeTGA, "tga", "TGA"]]) {
  const b = enc(P);
  const head = name === "BMP" ? b[0] === 0x42 && b[1] === 0x4d : name === "TIFF" ? b[0] === 0x49 && b[2] === 42 : b[2] === 2 && b[16] === 32;
  check(`${name}: the header, the size (${b.length} bytes)`, head && b.length > 7 * 5 * 4, b.slice(0, 18));
  if (HAVE_PIL) {
    const r = viaPil(b, ext);
    const ok = r.f === fmt && r.w === 7 && r.h === 5 && r.px.every((p, i) => same(p, px(P, i % 7, Math.floor(i / 7))));
    check(`${name}: read back by another program - every pixel and its transparency kept`, ok, r.err || [r.f, r.w, r.h, r.px && r.px.slice(0, 3)]);
  }
}
// --- GIF
{
  const G = pic(40, 30, false);
  const b = F.encodeGIF(G, { dither: false });
  check("GIF: GIF89a, the size, the trailer", String.fromCharCode(...b.slice(0, 6)) === "GIF89a" && (b[6] | (b[7] << 8)) === 40 && b[b.length - 1] === 0x3b);
  if (HAVE_PIL) {
    const r = viaPil(b, "gif"); let worst = 0;
    if (r.px) r.px.forEach((p, i) => { const q = px(G, i % 40, Math.floor(i / 40)); worst = Math.max(worst, ...[0, 1, 2].map((c) => Math.abs(p[c] - q[c]))); });
    check("GIF: read back - 40 x 30, the colours within the palette's reach (a 256-colour quantize)", r.f === "GIF" && r.w === 40 && r.h === 30 && worst <= 40, r.err || worst);
    const few = F.encodeGIF({ width: 3, height: 2, data: Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255]) }, {});
    const r2 = viaPil(few, "gif");
    check("GIF: few colours come out exact; a clear pixel stays clear", r2.px && same(r2.px[0], [255, 0, 0, 255]) && same(r2.px[2], [0, 0, 255, 255]) && r2.px[4][3] === 0 && same(r2.px[5], [255, 255, 255, 255]), r2.err || r2.px);
    const big = pic(300, 200, false); for (let i = 0; i < big.data.length; i += 4) big.data[i + 1] = (i * 7919) & 255;   // many colours: the LZW table fills and resets
    const r3 = viaPil(F.encodeGIF(big, { dither: true }), "gif");
    check("GIF: a busy 300 x 200 picture (the code table fills up and starts again; dithered) reads back", r3.w === 300 && r3.h === 200, r3.err);
  }
  check("quantize: at most the asked number of colours; few colours kept as they are", F.quantize(pic(40, 30).data, 16).length <= 16 && F.quantize(Uint8ClampedArray.from([1, 2, 3, 255, 1, 2, 3, 255, 9, 9, 9, 255]), 256).length === 2);
}
// --- file info
{
  check("crc32: the standard check value", F.crc32(Buffer.from("123456789")) === 0xcbf43926);
  const r = spawnSync("python3", ["-I", "-c", "from PIL import Image;import io,sys;b=io.BytesIO();Image.new('RGB',(4,3),(9,8,7)).save(b,'PNG');sys.stdout.buffer.write(b.getvalue())"]);
  if (HAVE_PIL && r.status === 0) {
    const info = { title: "Harbour at dawn", author: "Tim", keywords: "sea, boats", copyright: "© 2026 Tim", description: "Ünïcode ok" };
    const out = F.pngWithText(r.stdout, info), f = path.join(tmp, "i.png"); fs.writeFileSync(f, Buffer.from(out));
    const q = spawnSync("python3", ["-I", "-c", "import sys,json;from PIL import Image;im=Image.open(sys.argv[1]);im.load();print(json.dumps(im.text))", f], { encoding: "utf8" });
    const t = q.status === 0 ? JSON.parse(q.stdout) : {};
    check("PNG: the file info as text chunks other programs read (Title, Author, Keywords, Copyright, UTF-8 Description)", t.Title === info.title && t.Author === "Tim" && t.Keywords === "sea, boats" && t.Copyright === info.copyright && t.Description === info.description, t);
    check("PNG: no file info - the file is left alone", F.pngWithText(r.stdout, {}).length === r.stdout.length);
  }
  const jr = spawnSync("python3", ["-I", "-c", "from PIL import Image;import io,sys;b=io.BytesIO();Image.new('RGB',(8,8),(9,8,7)).save(b,'JPEG');sys.stdout.buffer.write(b.getvalue())"]);
  if (HAVE_PIL && jr.status === 0) {
    const out = F.jpegWithXmp(jr.stdout, { title: "A & B", author: "Tim", keywords: "one; two" }), s = Buffer.from(out).toString("latin1");
    const f = path.join(tmp, "i.jpg"); fs.writeFileSync(f, Buffer.from(out));
    const q = spawnSync("python3", ["-I", "-c", "import sys;from PIL import Image;im=Image.open(sys.argv[1]);im.load();print(im.size, 'xmp' in im.info)", f], { encoding: "utf8" });
    check("JPEG: the file info as XMP right after the start (escaped; keywords as a list) - still opens", out[0] === 0xff && out[1] === 0xd8 && out[2] === 0xff && out[3] === 0xe1 && /A &amp; B/.test(s) && /<rdf:li>one<\/rdf:li><rdf:li>two<\/rdf:li>/.test(s) && /\(8, 8\) True/.test(q.stdout), q.stdout + q.stderr);
  }
}
// --- contact sheet
{
  const L = F.sheetLayout(11, { cols: 3, rows: 2, W: 1000, H: 800, margin: 50, gap: 20, caption: true, fontSize: 20 });
  const c0 = L.pages[0][0], c4 = L.pages[0][4];
  check("contact sheet: 11 pictures at 3 x 2 → 2 pages (6 + 5)", L.pages.length === 2 && L.pages[0].length === 6 && L.pages[1].length === 5);
  check("contact sheet: the cells fill the page inside the margins, the gaps between them; room kept for the caption", Math.abs(L.cellW - 860 / 3) < 1e-9 && Math.abs(L.cellH - 340) < 1e-9 && c0.x === 50 && c0.y === 50 && Math.abs(c4.x - (50 + 860 / 3 + 20)) < 1e-9 && Math.abs(c4.y - 410) < 1e-9 && Math.abs(c0.h - 308) < 1e-9, [L.cellW, L.cellH, c4]);
}
// --- crop and straighten
{
  const W = 400, H = 300, d = new Uint8ClampedArray(W * H * 4).fill(255);
  // photo 1: a straight 120 x 80 rectangle; photo 2: a 100 x 60 rectangle turned by 12°
  const put = (cx, cy, w, h, a, col) => { const c = Math.cos(a), s = Math.sin(a); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x + 0.5 - cx) * c + (y + 0.5 - cy) * s, v = -(x + 0.5 - cx) * s + (y + 0.5 - cy) * c; if (Math.abs(u) <= w / 2 && Math.abs(v) <= h / 2) { const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; } } };
  put(90, 70, 120, 80, 0, [40, 90, 160]); put(270, 200, 100, 60, 12 * Math.PI / 180, [150, 60, 30]);
  const f = F.findPhotos(d, W, H, {});
  const a = f[0], b = f[1];
  check("crop and straighten: two photos found on a white page, top one first", f.length === 2 && a.cy < b.cy, f.map((r) => [r.cx, r.cy]));
  check("crop and straighten: the straight one - its size and place, no turn", a && Math.abs(a.w - 120) < 2 && Math.abs(a.h - 80) < 2 && Math.abs(a.cx - 90) < 1 && Math.abs(a.cy - 70) < 1 && Math.abs(a.angle) < 0.01, a);
  check("crop and straighten: the turned one - 100 x 60 and its 12° turn found", b && Math.abs(b.w - 100) < 3 && Math.abs(b.h - 60) < 3 && Math.abs(b.angle * 180 / Math.PI - 12) < 1.5, b && [b.w, b.h, b.angle * 180 / Math.PI]);
  const dust = new Uint8ClampedArray(W * H * 4).fill(255); dust.fill(0, 4000, 4040);
  check("crop and straighten: specks of dust are not photos", F.findPhotos(dust, W, H, {}).length === 0);
  const R = F.minRect(F.hull([[0, 0], [10, 0], [10, 5], [0, 5], [5, 2]]));
  check("hull + minRect: a plain rectangle", Math.abs(R.w - 10) < 1e-9 && Math.abs(R.h - 5) < 1e-9 && Math.abs(R.cx - 5) < 1e-9 && Math.abs(R.angle) < 1e-9, R);
}
// --- the server's AVIF
{
  const C = require(path.join(ROOT, "lib", "imgConvert.js"));
  check("AVIF: quality 100 → the best (0), 1 → the worst (63), 80 → 13", C.crfOf(100) === 0 && C.crfOf(1) === 63 && C.crfOf(80) === 13);
  let threw = null; try { C.toAvif(Buffer.from("not a png"), 80); } catch (e) { threw = e; }
  check("AVIF: anything but a PNG is refused (400)", threw && threw.status === 400);
  const caps = C.caps();
  if (caps.avif && HAVE_PIL) {
    const r = spawnSync("python3", ["-I", "-c", "from PIL import Image;import io,sys;b=io.BytesIO();Image.new('RGB',(64,48),(200,40,90)).save(b,'PNG');sys.stdout.buffer.write(b.getvalue())"]);
    const out = C.toAvif(r.stdout, 80);
    check(`AVIF: made by ffmpeg (${caps.encoder}) - an 'ftypavif' file`, out.slice(4, 12).toString() === "ftypavif", out.slice(0, 16));
  } else console.log("SKIP: AVIF encoding (ffmpeg without an AV1 encoder, or no Pillow)");
}
// --- the wiring
{
  const ext = JSON.parse(read("ext/imageeditdock/ext.json")).scripts, idx = read("routes/index.js"), ie = read("ext/imageeditdock/imageedit.js"), ui = read("ext/imageeditdock/pcui.js"), pd = read("ext/imageeditdock/pcdocs.js"), bgi = read("ext/imageeditdock/pcbgi.js");
  check("the wiring: pcfileplus.js before imageedit.js and installed; routes/imgconvert.js mounted from routes/index.js (not server.js)", ext.indexOf("pcfileplus.js") > 0 && ext.indexOf("pcfileplus.js") < ext.indexOf("imageedit.js") && /win\.PCFilePlus\.install\(E\)/.test(ie) && /require\("\.\/imgconvert"\)\.mount\(app\)/.test(idx) && !/imgconvert/.test(read("misc/server.js")));
  check("the wiring: Export As builds its formats from one list others add to; the file info goes into the exported file; kept per document and in .bgi", /E\.exportFormats = \[/.test(ui) && /E\.fileInfoBlob/.test(ui) && /"fileInfo"/.test(pd) && /fileInfo: clone\(S\.fileInfo/.test(bgi) && /S\.fileInfo = m\.fileInfo/.test(bgi));
  const files = read("ext/imageeditdock/pcfileplus.js") + read("lib/imgConvert.js") + read("routes/imgconvert.js");
  check("no product names in what users read", !/Photoshop|Adobe|Corel|Illustrator|Lightroom|Acrobat/.test(files.replace(/ns\.adobe\.com|adobe:ns:meta/g, "")));
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
