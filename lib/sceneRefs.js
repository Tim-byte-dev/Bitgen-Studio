// bitGen Studio — REFERENCE PICTURES ON ONE SCENE (2.295.0).
//
// Tim (verbatim): "allow user to add reference images to each scene
// individually".
//
// Chapter references (lib/chapterRefs) ride every scene of a chapter; these
// ride ONE scene. They live with the scene's stable id (never its number,
// which shifts when a scene is added or deleted):
//   projects/<p>/scene_refs/<scene id>/<file>
// and the scene row lists them as refs: [{file, label}] (scenes.safe keeps
// the list, fromPlan carries it with the id). On a native-audio board they
// join the render's picture references right after the cast sheets, so the
// reference map names them (<Picture n> is scene reference picture (...)),
// and a Transition scene travels to the first of them.
const fs = require("fs");
const path = require("path");
const core = require("./core");
const rawMaster = require("./rawMaster");   // 2.301.0: frames from the lossless master

const MAX_PER_SCENE = 9;               // MiniMaxH3ReferenceToVideo's picture limit
const IMG_RE = /\.(png|jpe?g|webp|bmp|gif)$/i;

function safeId(id) { return String(id || "").replace(/[^\w-]/g, "_").slice(0, 64) || "scene"; }
function safeName(name) {
  const base = path.basename(String(name || "picture.png"));
  const ext = (path.extname(base) || ".png").toLowerCase();
  const stem = path.basename(base, path.extname(base)).replace(/[^\w-]+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 48) || "picture";
  return stem + ext;
}

function dir(project, id) {
  return path.join(core.projDir(project || core.getProject()), "scene_refs", safeId(id));
}

/** Absolute path of one scene picture, or null when the name escapes the
 *  scene's folder or the file is gone. */
function filePath(project, id, file) {
  const d = dir(project, id);
  const p = path.join(d, path.basename(String(file || "")));
  if (path.dirname(p) !== d || !fs.existsSync(p)) return null;
  return p;
}

/** Add uploaded pictures [{path, originalname}] to row n. Returns
 *  {added: [file], skipped: [{name, why}]}; the row's refs list grows. */
function add(project, row, uploads) {
  const added = [], skipped = [];
  if (!row) return { added, skipped: [{ name: "", why: "no such scene" }] };
  const refs = Array.isArray(row.refs) ? row.refs : [];
  const d = dir(project, row.id);
  fs.mkdirSync(d, { recursive: true });
  for (const u of uploads || []) {
    const orig = String((u && u.originalname) || "");
    if (!IMG_RE.test(orig)) { skipped.push({ name: orig, why: "not a picture" }); continue; }
    if (refs.length >= MAX_PER_SCENE) {
      skipped.push({ name: orig, why: `a scene holds at most ${MAX_PER_SCENE} pictures` }); continue;
    }
    let name = safeName(orig), k = 2;
    while (fs.existsSync(path.join(d, name)) || refs.some((x) => x.file === name)) {
      const ext = path.extname(name);
      name = safeName(orig).replace(new RegExp(ext.replace(".", "\\.") + "$"), "") + "_" + (k++) + ext;
    }
    fs.copyFileSync(u.path, path.join(d, name));
    refs.push({ file: name, label: path.basename(orig, path.extname(orig)).slice(0, 60) });
    added.push(name);
  }
  row.refs = refs;
  return { added, skipped };
}

/** Remove one picture from row n (the file goes too). */
function remove(project, row, file) {
  if (!row) return { removed: false, error: "no such scene" };
  const refs = Array.isArray(row.refs) ? row.refs : [];
  const name = path.basename(String(file || ""));
  const i = refs.findIndex((x) => x.file === name);
  if (i < 0) return { removed: false, error: `scene ${row.n} has no picture ${name}` };
  refs.splice(i, 1);
  row.refs = refs;
  const p = filePath(project, row.id, name);
  if (p) try { fs.unlinkSync(p); } catch { /* the list is the truth */ }
  return { removed: true };
}

/** The scene's pictures for a render: [{file (abs), name, label}] plus the
 *  ones that went missing from disk, in words. */
function forRender(project, row) {
  const out = [], missing = [];
  for (const x of (row && Array.isArray(row.refs) ? row.refs : [])) {
    const p = filePath(project, row.id, x.file);
    if (p) out.push({ file: p, name: x.file, label: x.label || x.file });
    else missing.push(`scene ${row.n}: its picture ${x.file} is missing from scene_refs`);
  }
  return { refs: out, missing };
}

// ---- 2.297.0: the FIRST / LAST frame slots of one scene ---------------------
// Tim (verbatim): "if transition scene is selected allow the user to select
// first and/or last frame from previous clips or gallery or assets, show the
// reference or f/l images as thumbnails below the scene, allow user to
// remove these images". A slot holds ONE picture (fl_first / fl_last on the
// row, the file in the scene's scene_refs folder as fl_<slot>.<ext>); a set
// First slot outranks the continuation frame, a set Last slot outranks the
// location still (lib/nativeAudio.plan).
const SLOTS = ["first", "last"];

/** One frame of a video as a temp PNG (null when ffmpeg could not). */
function extractFrame(takePath, time) {
  if (!takePath || !fs.existsSync(takePath)) return null;
  // 2.301.0: the frame comes from the take's LOSSLESS master when it has one
  takePath = rawMaster.sourceFor(takePath);
  const t = Number.isFinite(time) && time >= 0 ? time : null;
  const tmp = path.join(core.tempDir(), `frame_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);
  try {
    require("child_process").execFileSync("ffmpeg",
      ["-y", ...(t === null ? ["-sseof", "-0.2"] : ["-ss", String(t)]), "-i", takePath,
       "-frames:v", "1", "-update", "1", tmp], { stdio: "ignore", timeout: 30000 });
  } catch { /* a tail seek can miss on a very short clip */ }
  return fs.existsSync(tmp) ? tmp : null;
}

/** A picture from the GALLERY (the project's output folders) or the image
 *  ASSETS, by name - an absolute path, or null. */
function resolveImage(project, kind, name) {
  const base = path.basename(String(name || ""));
  if (!base || !IMG_RE.test(base)) return null;
  const proj = core.projDir(project || core.getProject());
  const dirs = kind === "asset"
    ? [path.join(proj, "images")]
    : [proj, path.join(proj, "output"), path.join(proj, "final")];
  for (const d of dirs) {
    const p = path.join(d, base);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Put `srcPath` in slot "first"/"last" of row (replacing what was there). */
function setSlot(project, row, slot, srcPath, label) {
  if (!row) return { ok: false, error: "no such scene" };
  if (!SLOTS.includes(slot)) return { ok: false, error: "slot must be first or last" };
  if (!srcPath || !fs.existsSync(srcPath)) return { ok: false, error: "the picture is not on disk" };
  const d = dir(project, row.id);
  fs.mkdirSync(d, { recursive: true });
  clearSlot(project, row, slot);
  const ext = (path.extname(srcPath) || ".png").toLowerCase();
  const file = `fl_${slot}${IMG_RE.test("x" + ext) ? ext : ".png"}`;
  fs.copyFileSync(srcPath, path.join(d, file));
  row["fl_" + slot] = { file, label: String(label || "").slice(0, 80) };
  return { ok: true, file };
}

function clearSlot(project, row, slot) {
  if (!row || !SLOTS.includes(slot)) return false;
  const cur = row["fl_" + slot];
  if (cur && cur.file) {
    const p = filePath(project, row.id, cur.file);
    if (p) try { fs.unlinkSync(p); } catch {}
  }
  const had = !!cur;
  row["fl_" + slot] = undefined;
  return had;
}

/** {file (abs), name, label} of a filled slot, or null. */
function slotFor(project, row, slot) {
  const cur = row && row["fl_" + slot];
  if (!cur || !cur.file) return null;
  const p = filePath(project, row.id, cur.file);
  return p ? { file: p, name: cur.file, label: cur.label || cur.file } : null;
}

/** 2.296.0 (Tim: "is it possible for me to add the last frame of the scene
 *  before as a reference image to the current scene?"): one frame of a
 *  rendered take becomes a picture on `row` - `time` in seconds, or null
 *  for the take's last frame. Returns add()'s answer plus the file name. */
function addFrame(project, row, takePath, time, srcN) {
  if (!row) return { added: [], skipped: [{ name: "", why: "no such scene" }] };
  if (!takePath || !fs.existsSync(takePath))
    return { added: [], skipped: [{ name: "", why: `scene ${srcN}'s take is not on disk` }] };
  takePath = rawMaster.sourceFor(takePath);          // 2.301.0: the lossless master
  const t = Number.isFinite(time) && time >= 0 ? time : null;
  const stamp = t === null ? "last" : String(Math.round(t * 10) / 10).replace(".", "_") + "s";
  const tmp = path.join(core.tempDir(), `frameref_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);
  try {
    require("child_process").execFileSync("ffmpeg",
      ["-y", ...(t === null ? ["-sseof", "-0.2"] : ["-ss", String(t)]), "-i", takePath,
       "-frames:v", "1", "-update", "1", tmp], { stdio: "ignore", timeout: 30000 });
  } catch { /* a tail seek can miss on a very short clip */ }
  if (!fs.existsSync(tmp))
    return { added: [], skipped: [{ name: "", why: "the frame could not be extracted" }] };
  const label = t === null ? `last frame of scene ${srcN}` : `scene ${srcN} at ${Math.round(t * 10) / 10}s`;
  const out = add(project, row, [{ path: tmp, originalname: `scene${srcN}_frame_${stamp}.png` }]);
  // the label says what the picture IS (add() derives it from the file name)
  if (out.added.length) {
    const r0 = row.refs.find((x) => x.file === out.added[0]);
    if (r0) r0.label = label;
  }
  try { fs.unlinkSync(tmp); } catch {}
  return { ...out, label };
}

module.exports = { SLOTS, extractFrame, resolveImage, setSlot, clearSlot, slotFor,
                   addFrame, MAX_PER_SCENE, dir, filePath, add, remove, forRender, safeName };
