#!/usr/bin/env node
/* bitGen Studio — scripts/test-imagesave604.js (2.604.0): the image editor's 💾 SAVE TO IMAGES pipeline (lib/imageSave.js,
 * routes/imageSave.js) + the 2.604.0 pure parts: the skew handles (the opposite side stays), type that skews (pcdoc
 * textMat), the timeline's Rasterize Text (tlctx.rasterized). Tim: "when user clicks save to images in image-editor, save
 * all the visible the file as a tmp file then flatten the file and save as the image format selected, load it in
 * gallery and assets" + "fix the skew tool" + "add a rightclick context menu with rasterize text". A temp project. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bg-save604-"));
const ROOT = path.join(__dirname, "..");
try {
  const S = require("../lib/imageSave");
  check("cleanName: no folders, no odd characters, the extension asked for (jpeg -> as given, unknown -> png)", S.cleanName("../x/My pic?.png", "jpg") === "My_pic_.jpg" && S.cleanName("", "webp") === "edited.webp" && S.cleanName("a", "exe") === "a.png");
  check("uniqueIn: never overwrites (name, name-2, name-3)", S.uniqueIn("/d", "a.png", (p) => p === "/d/a.png" || p === "/d/a-2.png") === "a-3.png");
  check("galleryShows: PNG / JPEG / BMP (what the Gallery lists)", S.galleryShows("png") && S.galleryShows("jpg") && S.galleryShows("bmp") && !S.galleryShows("webp") && !S.galleryShows("jxl"));
  // a stand-in project in a temp folder (never the real projects)
  const pd = (k) => { const d = path.join(tmpRoot, k); fs.mkdirSync(d, { recursive: true }); return d; };
  const core = { ensureProject() {}, getProject: () => "t", pDir: pd, tempDir: () => pd("temp") };
  S.setCore(core);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  let threw = false; try { S.tmp(Buffer.from("nope"), "x"); } catch (e) { threw = e.status === 400; }
  check("tmp: only a PNG", threw);
  const t = S.tmp(png, "My picture");
  const tp = path.join(core.tempDir(), t.tmp);
  check("tmp: the visible layers' PNG in the project's temp folder (not the gallery's)", t.ok && fs.existsSync(tp) && /^edit_My_picture_\d{14}\.png$/.test(t.tmp), t);
  const r = S.finish(Buffer.from("JPEGDATA"), { name: "My picture-edit-1.jpg", ext: "jpg", tmp: t.tmp });
  check("finish (JPEG): into Images (Assets) AND the Gallery (output/), the temp copy removed",
    r.ok && fs.existsSync(path.join(core.pDir("images"), r.name)) && fs.existsSync(path.join(core.pDir("output"), r.name)) && r.gallery === r.name && !fs.existsSync(tp), r);
  const t2 = S.tmp(png, "w");
  const r2 = S.finish(Buffer.from("WEBPDATA"), { name: "w.webp", ext: "webp", tmp: t2.tmp });
  check("finish (WebP - the Gallery does not list it): the WebP in Images, a PNG twin of the same picture in the Gallery",
    r2.name === "w.webp" && r2.gallery === "w.png" && fs.readFileSync(path.join(core.pDir("output"), "w.png")).equals(png) && fs.existsSync(path.join(core.pDir("images"), "w.webp")), r2);
  const r3 = S.finish(Buffer.from("JPEGDATA2"), { name: "My picture-edit-1.jpg", ext: "jpg" });
  check("…a second save never overwrites the first (-2)", r3.name === "My_picture-edit-1-2.jpg", r3);

  // the skew handles: the opposite side stays put (Alt = round the centre)
  const H = require("../ext/imageeditdock/pchandles.js");
  const ap = (m, x, y) => [Math.round((m[0] * x + m[2] * y + m[4]) * 1e6) / 1e6, Math.round((m[1] * x + m[3] * y + m[5]) * 1e6) / 1e6];
  const b = { x: 100, y: 100, w: 100, h: 50 };
  const k1 = H.matrixFor("rotate", "n", b, [150, 100], [170, 100], {}), k2 = H.matrixFor("rotate", "e", b, [200, 125], [200, 145], {}), k3 = H.matrixFor("rotate", "n", b, [150, 100], [170, 100], { alt: true });
  check("skew: the top side slides 20 px, the BOTTOM stays put (it used to run the other way)", JSON.stringify(ap(k1, 150, 100)) === "[170,100]" && JSON.stringify(ap(k1, 150, 150)) === "[150,150]" && JSON.stringify(ap(k1, 100, 150)) === "[100,150]", [ap(k1, 150, 100), ap(k1, 150, 150)]);
  check("…the right side slides 20 px down, the LEFT stays; Alt = round the centre (the far side the other way)", JSON.stringify(ap(k2, 200, 125)) === "[200,145]" && JSON.stringify(ap(k2, 100, 125)) === "[100,125]" && JSON.stringify(ap(k3, 150, 150)) === "[130,150]");
  // type skews (pcdoc.textMat)
  const D = require("../ext/imageeditdock/pcdoc.js");
  const g = { font: "", save() {}, restore() {}, measureText: (s) => ({ width: s.length * 10 }) };
  const t0 = { str: "abcd", x: 0, y: 0, size: 20, leading: 1, align: "left" }, B0 = D.textBox(t0, g);
  const tk = Object.assign({}, t0, { xm: [1, 0, 0.5, 1] }), Bk = D.textBox(tk, g);
  check("type skews: textMat = rot then t.xm; the box grows by the slant (h x 0.5), centre kept", JSON.stringify(D.textMat(tk)) === "[1,0,0.5,1]" && D.textMat(t0) === null && Math.abs(Bk.w - (B0.w + B0.h * 0.5)) < 1e-6 && Math.abs((Bk.x + Bk.w / 2) - (B0.x + B0.w / 2)) < 1e-6, { B0, Bk });
  // the timeline's Rasterize Text
  const X = require("../ext/timelinedock/tlctx.js");
  const rc = X.rasterized({ name: "text_t1.png", start: 2, len: 5, tf: { x: 1 }, text: { str: "Hi" }, tid: "t1", kf: [{ at: 0, op: 1 }] });
  check("tlctx.rasterized: the clip as a picture - its PNG, timing, transform and keys kept; the text and its id gone", rc.name === "text_t1.png" && rc.start === 2 && rc.tf.x === 1 && rc.kf.length === 1 && !("text" in rc) && !("tid" in rc), rc);

  const IE = fs.readFileSync(path.join(ROOT, "ext", "imageeditdock", "imageedit.js"), "utf8"), PF = fs.readFileSync(path.join(ROOT, "ext", "imageeditdock", "pcframes.js"), "utf8"), PU = fs.readFileSync(path.join(ROOT, "ext", "imageeditdock", "pcui.js"), "utf8");
  const SL = fs.readFileSync(path.join(ROOT, "ext", "imageeditdock", "pcselhl.js"), "utf8"), CV = fs.readFileSync(path.join(ROOT, "ext", "timelinedock", "canvas.js"), "utf8"), EXT = JSON.parse(fs.readFileSync(path.join(ROOT, "ext", "timelinedock", "ext.json"), "utf8")).scripts;
  const W = {
    "💾: the temp copy, flattened (white under JPEG / BMP), the format beside it, Assets + Gallery": /api\.saveFlat\(tmpBlob, out, nm, F\[3\]\)/.test(IE) && /NO_ALPHA\.test\(F\[0\]\)/.test(IE) && /id="ieSaveFmt"/.test(IE) && /\/api\/imagesave\/tmp/.test(fs.readFileSync(path.join(ROOT, "ext", "imageeditdock", "mount.js"), "utf8")),
    "the image editor's right-click: Rasterize Text first on a text layer": /items\.push\("layer\.rasterizetext", sep\)/.test(PF) && /cmd\("layer\.rasterizetext", "Rasterize Text"/.test(PU),
    "no thick box: the picked object's orange outline gone with the Move tool (its handles' thin frame stays; 2.605.0: the same frame for hover)": /if \(sel && S\.tool !== "move"\) frame\(g, sel, px\)/.test(SL),
    "the timeline canvas: a thin dashed frame, small hollow handles; tlctx.js loaded after canvas.js": /ctx\.setLineDash\(\[4, 3\]\)/.test(CV) && /ctx\.fillRect\(p\.x - 3, p\.y - 3, 6, 6\)/.test(CV) && EXT.indexOf("tlctx.js") === EXT.indexOf("canvas.js") + 1,
  };
  const miss = Object.keys(W).filter((k) => !W[k]);
  check("wired: " + Object.keys(W).join(" · "), miss.length === 0, miss);
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
finally { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* fine */ } }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
