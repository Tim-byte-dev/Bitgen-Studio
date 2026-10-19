// bitGen Studio — training DATASETS (2.265.0, Tim verbatim: "add a tab to
// character sheet creator - Dataset ... create folder datasets\dataset name").
//
// A dataset is a folder of images with a sidecar caption per image — the
// kohya/LoRA convention: picture.png + picture.txt. It lives at the APP
// ROOT (datasets/<name>), not inside a project, so one dataset can feed
// training runs regardless of which project is open. Captions are written
// by hand in the grid or by the vision model (Auto Caption).
const fs = require("fs");
const path = require("path");
const core = require("./core");

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;

function safeName(name) {
  const n = String(name || "").trim();
  if (!NAME_RE.test(n)) {
    throw new Error("dataset name must be 1-64 chars: letters/numbers, spaces, . _ -"
      + " (and start with a letter or number)");
  }
  return n;
}

function root() { return core.resolvePath("datasets"); }

/** The dataset's folder — created on first touch ("create folder
 *  datasets\dataset name"). */
function dir(name, make) {
  const d = path.join(root(), safeName(name));
  if (make) fs.mkdirSync(d, { recursive: true });
  return d;
}

const IMG_RE = /\.(png|jpe?g|webp|bmp|gif)$/i;

function captionPath(name, file) {
  const stem = file.replace(/\.[^.]+$/, "");
  return path.join(dir(name), stem + ".txt");
}

/** Every image with its caption ("" when the sidecar does not exist). */
function list(name) {
  let files = [];
  try { files = fs.readdirSync(dir(name)); } catch { return []; }
  return files.filter((f) => IMG_RE.test(f)).sort().map((f) => {
    let caption = "";
    try { caption = fs.readFileSync(captionPath(name, f), "utf8"); } catch {}
    return { file: f, caption };
  });
}

/** Store one image; a name collision gets a numeric suffix, never an
 *  overwrite. Returns the stored file name. */
function addImage(name, filename, buf) {
  if (!buf || !buf.length) throw new Error("empty image");
  const d = dir(name, true);
  let base = String(filename || "image.png").replace(/[^A-Za-z0-9._ -]+/g, "_");
  if (!IMG_RE.test(base)) base += ".png";
  let out = base, i = 1;
  const stem = base.replace(/\.[^.]+$/, ""), ext = base.slice(stem.length);
  while (fs.existsSync(path.join(d, out))) out = `${stem}_${i++}${ext}`;
  fs.writeFileSync(path.join(d, out), buf);
  return out;
}

function setCaption(name, file, caption) {
  if (!fs.existsSync(path.join(dir(name), file))) throw new Error(`no such image: ${file}`);
  fs.writeFileSync(captionPath(name, file), String(caption || ""));
  return { file, caption: String(caption || "") };
}

/** Remove one image and its caption sidecar. */
function remove(name, file) {
  const p = path.join(dir(name), file);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  try { fs.unlinkSync(captionPath(name, file)); } catch {}
  return true;
}

/** Delete ALL images (+ sidecars) — the folder itself stays. */
function removeAll(name) {
  let n = 0;
  for (const it of list(name)) { if (remove(name, it.file)) n++; }
  return n;
}

function filePath(name, file) {
  const p = path.join(dir(name), path.basename(file));
  return fs.existsSync(p) ? p : null;
}

module.exports = { safeName, root, dir, list, addImage, setCaption, remove,
                   removeAll, filePath, IMG_RE };
