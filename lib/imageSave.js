/* bitGen Studio — lib/imageSave.js (2.604.0): THE IMAGE EDITOR'S 💾 SAVE TO IMAGES - a temp copy first, then the
 * flattened picture in the format picked, into the project's Images (Assets) AND the Gallery.
 *
 * Tim (verbatim): "when user clicks save to images in image-editor, save all the visible the file as a tmp file then
 * flatten the file and save as the image format selected, load it in gallery and assets".
 *   tmp(buf, stem)        the editor's visible layers, lossless PNG -> projects/<p>/temp/edit_<stem>_<time>.png (the
 *                         temp folder: never indexed by the gallery, never a job's output) - kept until the save is done
 *   finish(buf, o)        o = {name, ext, tmp}: the flattened picture (the editor encoded it in the format picked)
 *                         -> images/<name> (Assets) + output/<name> (Gallery); a format the Gallery does not list
 *                         (WebP, JPEG XL, TIFF, GIF, TGA, AVIF) also gets a PNG twin there (the temp copy) so it shows;
 *                         the temp copy is removed. -> {ok, name, asset, gallery}
 * Names are cleaned (no folders, no odd characters) and never overwrite: name.png, name-2.png, ...
 * Pure: cleanName(name, ext), uniqueIn(dir, name, exists), galleryShows(ext).
 */
"use strict";
const fs = require("fs");
const path = require("path");

const EXTS = ["png", "jpg", "jpeg", "webp", "jxl", "bmp", "tif", "tiff", "gif", "tga", "avif"];
const GALLERY = /\.(png|jpe?g|bmp)$/i;                       // routes/index.js OUT_RX.images
function galleryShows(ext) { return GALLERY.test("x." + String(ext || "").toLowerCase()); }
function cleanName(name, ext) {
  const e = EXTS.includes(String(ext || "").toLowerCase()) ? String(ext).toLowerCase() : "png";
  let stem = path.basename(String(name || "edited")).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_").replace(/^[._]+/, "").slice(0, 80);
  if (!stem) stem = "edited";
  return stem + "." + e;
}
function uniqueIn(dir, name, exists) {
  const has = exists || ((p) => fs.existsSync(p));
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  let n = name, i = 2;
  while (has(path.join(dir, n))) n = `${stem}-${i++}${ext}`;
  return n;
}
let coreOverride = null;                                   // the tests hand a stand-in (temp folders)
const core = () => coreOverride || require("./core");
function setCore(c) { coreOverride = c || null; }
function isPng(buf) { return Buffer.isBuffer(buf) && buf.length > 8 && buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a"; }

function tmp(buf, stem) {
  if (!isPng(buf)) throw Object.assign(new Error("the temp copy must be a PNG"), { status: 400 });
  const C = core(); C.ensureProject(C.getProject());
  const dir = C.tempDir();
  const t = new Date(), ts = [t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds()].map((v) => String(v).padStart(2, "0")).join("");
  const name = uniqueIn(dir, "edit_" + cleanName(stem, "png").replace(/\.png$/, "") + "_" + ts + ".png");
  fs.writeFileSync(path.join(dir, name), buf);
  return { ok: true, tmp: name, bytes: buf.length };
}
function finish(buf, o) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw Object.assign(new Error("send the picture"), { status: 400 });
  const C = core(); C.ensureProject(C.getProject());
  const ext = String((o && o.ext) || "png").toLowerCase().replace(/^jpeg$/, "jpg");
  const want = cleanName((o && o.name) || "edited", ext);
  const imgDir = C.pDir("images"), galDir = C.pDir("output");
  fs.mkdirSync(imgDir, { recursive: true }); fs.mkdirSync(galDir, { recursive: true });
  // one name free in BOTH folders, so the asset and its gallery copy are the same name
  const free = (p) => fs.existsSync(path.join(imgDir, path.basename(p))) || fs.existsSync(path.join(galDir, path.basename(p)));
  const name = uniqueIn(imgDir, want, free);
  fs.writeFileSync(path.join(imgDir, name), buf);
  let gallery = null;
  const tmpPath = o && o.tmp ? path.join(C.tempDir(), path.basename(String(o.tmp))) : null;
  if (galleryShows(ext)) { fs.writeFileSync(path.join(galDir, name), buf); gallery = name; }
  else if (tmpPath && fs.existsSync(tmpPath)) {                // the Gallery lists PNG / JPEG / BMP: a PNG twin of the same picture
    const twin = uniqueIn(galDir, name.replace(/\.[a-z0-9]+$/i, ".png"), free);
    fs.copyFileSync(tmpPath, path.join(galDir, twin)); gallery = twin;
  }
  if (tmpPath) { try { fs.rmSync(tmpPath, { force: true }); } catch { /* the temp folder is cleared anyway */ } }
  return { ok: true, name, asset: name, gallery, bytes: buf.length };
}
module.exports = { tmp, finish, cleanName, uniqueIn, galleryShows, EXTS, setCore };
