#!/usr/bin/env node
/* bitGen Studio — 2.479.0: JPEG XL (.jxl) PICTURES (static/jxl.js, lib/jxl.js, routes/jxl.js, scripts/jxl-cli.js,
 * scripts/jxl_png.py, the vendored codecs in static/vendor/jxl/).
 * Tim (verbatim): "add jxl file support".
 * The codecs in Node: the signature, lossless exact both ways, lossy smaller, a damaged file refused; the cache; which
 * requests get a PNG (an <img>) and which the .jxl itself (fetch, downloads); the sendFile shim on a fake response;
 * the command line + the Python helper (ComfyUI uploads, the compile, thumbnails); the extension lists; the wiring. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
(async () => {
  const J = require(path.join(ROOT, "static", "jxl.js"));
  const L = require(path.join(ROOT, "lib", "jxl.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jxltest-"));
  L.setCacheDir(path.join(tmp, "cache"));
  // a picture with every kind of pixel: a ramp, see-through, edges
  const w = 97, h = 61, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; d[i] = x * 255 / (w - 1); d[i + 1] = y * 4; d[i + 2] = (x * y) % 256; d[i + 3] = x < 10 ? 0 : x < 20 ? 128 : 255; }
  check("isJxl: the bare codestream and the container; not a PNG; isJxlName", J.isJxl(new Uint8Array([0xff, 0x0a, 1])) && J.isJxl(new Uint8Array([0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a, 0])) && !J.isJxl(new Uint8Array([0x89, 0x50, 0x4e, 0x47])) && J.isJxlName("a/B.JXL?x=1") && !J.isJxlName("a.png"));
  const o = J.encOptions({ quality: 100 }), o2 = J.encOptions({ quality: 150, effort: 20 }), o3 = J.encOptions({});
  check("encOptions: quality 100 = lossless; ranges kept (effort 1-9); the defaults (90, effort 7)", o.lossless && o.quality === 100 && o2.lossless && o2.effort === 9 && !o3.lossless && o3.quality === 90 && o3.effort === 7);
  const ll = await L.encode({ data: d, width: w, height: h }, { lossless: true });
  check("encode lossless: a JPEG XL file", J.isJxl(ll) && ll.length > 50, ll.length);
  const back = await L.toPng(ll);
  // read the PNG back with ffmpeg (or the browser test does it) - here: decode the PNG with a tiny inflater
  const zlib = require("zlib");
  function pngRGBA(buf) {
    let p = 8, W = 0, H = 0, ct = 0, bd = 0; const idat = [];
    while (p < buf.length) { const len = buf.readUInt32BE(p), t = buf.toString("ascii", p + 4, p + 8), c = buf.slice(p + 8, p + 8 + len); if (t === "IHDR") { W = c.readUInt32BE(0); H = c.readUInt32BE(4); bd = c[8]; ct = c[9]; } if (t === "IDAT") idat.push(c); p += 12 + len; }
    const raw = zlib.inflateSync(Buffer.concat(idat)), ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1, bpp = ch * bd / 8, stride = W * bpp, out = Buffer.alloc(W * H * 4), prev = Buffer.alloc(stride);
    let o = 0;
    for (let y = 0; y < H; y++) {
      const f = raw[o++], line = Buffer.from(raw.slice(o, o + stride)); o += stride;
      for (let i = 0; i < stride; i++) { const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        line[i] = (line[i] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? ((pa, pb, pc) => (pa <= pb && pa <= pc ? a : pb <= pc ? b : c))(Math.abs(b - c), Math.abs(a - c), Math.abs(a + b - 2 * c)) : 0)) & 255; }
      line.copy(prev);
      for (let x = 0; x < W; x++) { const s = x * bpp, k = (y * W + x) * 4; const g = (j) => (bd === 16 ? line[s + j * 2] : line[s + j]);
        if (ch >= 3) { out[k] = g(0); out[k + 1] = g(1); out[k + 2] = g(2); out[k + 3] = ch === 4 ? g(3) : 255; } else { out[k] = out[k + 1] = out[k + 2] = g(0); out[k + 3] = ch === 2 ? g(1) : 255; } }
    }
    return { W, H, data: out };
  }
  const px = pngRGBA(back.png);
  let maxd = 0; for (let i = 0; i < d.length; i++) if (d[i + 3 - (i % 4)] > 0) maxd = Math.max(maxd, Math.abs(d[i] - px.data[i]));
  check("lossless round trip: the size, and every pixel exactly (see-through ones too)", back.width === w && back.height === h && px.W === w && maxd === 0, { maxd, w: back.width });
  const lossy = await L.encode({ data: d, width: w, height: h }, { quality: 70 });
  const lp = pngRGBA((await L.toPng(lossy)).png);
  let md2 = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) md2 = Math.max(md2, Math.abs(d[i] - lp.data[i]));
  check("lossy (quality 70): a smaller file, the picture close", lossy.length < ll.length && md2 < 60, { lossy: lossy.length, ll: ll.length, md2 });
  let threw = null; try { await L.toPng(Buffer.concat([ll.slice(0, 12)])); } catch (e) { threw = e.message; }
  let threw2 = null; try { await L.toPng(Buffer.from("not a picture")); } catch (e) { threw2 = e.message; }
  check("a cut-short file and a non-JPEG-XL file are refused with a reason", !!threw && /not a JPEG XL/.test(threw2 || ""), [threw, threw2]);
  // the cache
  const f = path.join(tmp, "pic.jxl"); fs.writeFileSync(f, ll);
  const p1 = await L.pngFile(f), p2 = await L.pngFile(f);
  check("pngFile: a PNG in the cache, the same one the second time", p1 === p2 && fs.existsSync(p1) && p1.startsWith(path.join(tmp, "cache")) && fs.readFileSync(p1).slice(1, 4).toString() === "PNG");
  fs.writeFileSync(f, lossy); const t = new Date(Date.now() + 5000); fs.utimesSync(f, t, t);
  const p3 = await L.pngFile(f);
  check("pngFile: a changed file gets a new PNG", p3 !== p1 && fs.existsSync(p3));
  // who gets a PNG
  const R = (headers, query) => ({ headers: headers || {}, query: query || {} });
  check("wantsPng: an <img> (Sec-Fetch-Dest: image) yes; fetch() / a download no; ?as=png yes; ?jxl=raw no; a browser that reads JPEG XL no; no Sec-Fetch headers = by Accept",
    L.wantsPng(R({ "sec-fetch-dest": "image", accept: "image/avif,image/webp,*/*" })) && !L.wantsPng(R({ "sec-fetch-dest": "empty", accept: "*/*" })) && !L.wantsPng(R({ "sec-fetch-dest": "document" }))
    && L.wantsPng(R({}, { as: "png" })) && !L.wantsPng(R({ "sec-fetch-dest": "image" }, { jxl: "raw" })) && !L.wantsPng(R({ "sec-fetch-dest": "image", accept: "image/jxl,image/*" }))
    && L.wantsPng(R({ accept: "image/png,image/*" })) && !L.wantsPng(R({ accept: "*/*" })));
  // the shim on a fake response
  const fakeRes = () => { const r = { sent: null, typ: null, headers: {}, sendFile(p, o, cb) { r.sent = p; if (typeof o === "function") o(); else if (cb) cb(); }, type(t) { r.typ = t; return r; }, set(k, v) { r.headers[k] = v; return r; }, status() { return r; }, json(j) { r.json = j; } }; return r; };
  const r1 = fakeRes(); L.sendFileShim(R({ "sec-fetch-dest": "image" }), r1, () => {});
  await new Promise((ok) => r1.sendFile(f, ok));
  const r2 = fakeRes(); L.sendFileShim(R({ "sec-fetch-dest": "empty" }), r2, () => {}); r2.sendFile(f);
  const r3 = fakeRes(); L.sendFileShim(R({ "sec-fetch-dest": "image" }), r3, () => {}); r3.sendFile(path.join(tmp, "x.png"));
  check("sendFileShim: an <img> asking for a .jxl gets its PNG (image/png); fetch() gets the .jxl; other files untouched", /\.png$/.test(r1.sent) && r1.typ === "image/png" && r2.sent === f && /x\.png$/.test(r3.sent), [r1.sent, r1.typ, r2.sent]);
  // the command line + Python
  const cli = path.join(ROOT, "scripts", "jxl-cli.js");
  const info = JSON.parse(execFileSync(process.execPath, [cli, "info", f], { encoding: "utf8" }).trim());
  const outp = path.join(tmp, "o.png"); execFileSync(process.execPath, [cli, "topng", f, outp]);
  const bad = spawnSync(process.execPath, [cli, "topng", path.join(tmp, "nope.jxl")], { encoding: "utf8" });
  check("jxl-cli: info (width, height), topng writes a PNG, a missing file exits 1 with a reason", info.width === w && info.height === h && fs.readFileSync(outp).slice(1, 4).toString() === "PNG" && bad.status === 1 && /ENOENT|no such/i.test(bad.stderr), [info, bad.status, bad.stderr]);
  const py = spawnSync("python3", ["-c", `import sys; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))}); import jxl_png; print(jxl_png.png_for(${JSON.stringify(f)})); print(jxl_png.png_for("a.png"))`], { encoding: "utf8", env: Object.assign({}, process.env, { BITGEN_NODE: process.execPath }) });
  if (py.error) console.log("SKIP: python3 is not here - scripts/jxl_png.py not run");
  else { const lines = py.stdout.trim().split("\n"); check("jxl_png.png_for (Python): a .jxl -> its PNG path; anything else as it was", lines.length === 2 && /\.png$/.test(lines[0]) && fs.existsSync(lines[0]) && lines[1] === "a.png", [py.stdout, py.stderr]); }
  // the wiring
  const core = read("lib/core.js"), idx = read("routes/index.js"), html = read("static/index.html"), w0 = read("worker.py"), cc = read("scripts/comfy_client.py"), fd = read("scripts/fdlg_helper.py"), ui = read("ext/imageeditdock/pcui.js");
  check("the project's pictures take .jxl; workers get BITGEN_NODE; routes/jxl.js mounted first after json; index.html loads static/jxl.js before the other scripts",
    /images: \[[^\]]*"\.jxl"/.test(core) && /BITGEN_NODE: process\.execPath/.test(core) && /express\.json\(\)\);\n\s*require\("\.\/jxl"\)\.mount\(app\)/.test(idx)
    && html.indexOf('/static/jxl.js"') > 0 && html.indexOf('/static/jxl.js"') < html.indexOf('/static/selsearch.js"'));
  check("ComfyUI uploads (worker.py + comfy_client.py), the compile's stills and the file dialog's thumbnails go through jxl_png",
    /def _comfy_upload_image[\s\S]{0,300}jxl_png\.png_for/.test(w0) && /pic = jxl_png\.png_for\(pic\)/.test(w0) && /def upload_image[\s\S]{0,300}jxl_png\.png_for/.test(cc) && /if ext == "\.jxl":[\s\S]{0,300}png_for/.test(fd) && /"\.jxl"\}/.test(fd));
  check("the file dialog, Add, the timeline's files and the editor's pickers know .jxl; Export As offers JPEG XL + Lossless",
    /"\.svg", "\.jxl"\]/.test(read("lib/fileDialog.js")) && /"image\/jxl": \[".jxl"\]/.test(read("static/filedialog.js")) && /"\.bmp", "\.jxl"\]/.test(read("static/addtile.js")) && /tiff\?\|jxl/.test(read("lib/bgVideo.js"))
    && /accept="image\/\*,\.jxl"/.test(read("ext/imageeditdock/imageedit.js")) && /\["jxl", "JPEG XL", "image\/jxl", "jxl", true\]/.test(ui) && /id="pdL"/.test(ui));
  const vd = path.join(ROOT, "static", "vendor", "jxl"), notice = read("NOTICE.md");
  check("the codecs + their licence files are shipped and named in NOTICE.md", ["jxl_oxide_wasm.js", "jxl_oxide_wasm_bg.wasm", "jxl_enc.js", "jxl_enc.wasm", "LICENSE-jxl-oxide.txt", "LICENSE-jsquash-jxl.txt", "LICENSE-libjxl.txt", "package.json"].every((x) => fs.existsSync(path.join(vd, x)))
    && /jxl\/LICENSE-jxl-oxide\.txt/.test(notice) && /jxl\/LICENSE-libjxl\.txt/.test(notice));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + e.stack); console.log(`\nRESULT: ${pass} passed, ${fail + 1} failed`); process.exit(1); });
