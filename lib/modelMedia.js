// bitGen Studio — lib/modelMedia.js (2.575.0): YOUR PICTURES / VIDEOS / SOUNDS OF A MODEL, its thumbnail, its prompts.
//
// Tim: "in modelmanager docker, allow user to change the thumbnail and add images,sound or video of the model and
// example prompts or metadata from the image/video/music".
// Kept with the model's page in the shared library (lib/modelInfo: <app>/model_info/<models|loras>/<stem>/), in its own
// user/ folder - never beside the model file, and never touched by ⤓ Civitai info:
//   user/media.json   {v:1, items:[{id, file, kind: image|video|audio, name, added, meta:{prompt, negative, seed, cfg,
//                      steps, sampler, model, width, height, from}}], thumb: "thumb.<ext>" | ""}
//   user/<id>.<ext>   the files;  user/thumb.<ext>   your thumbnail (lib/modelCards.thumbFile reads it FIRST)
//   list(card)                    -> {items, thumb}
//   add(card, {buf|path, name, meta?, src?})  -> {ok, item} (meta: given, else read from the file - lib/mediaMeta)
//   update(card, id, {meta, name}) -> {ok, item};  remove(card, id) -> {ok};  filePath(card, id) -> abs | null
//   setThumb(card, {buf|path, name} | {item: id}) -> {ok, thumb};  clearThumb(card) -> {ok};  thumbPath(card) -> abs | null
// Pure: kindOf(name), MAX_ITEMS, MAX_BYTES.
"use strict";
const fs = require("fs");
const path = require("path");

const MAX_ITEMS = 64;
const MAX_BYTES = 512 * 1024 * 1024;
const EXT = { image: /\.(png|jpe?g|webp|gif|bmp)$/i, video: /\.(mp4|webm|mov|mkv|m4v)$/i, audio: /\.(wav|mp3|flac|ogg|opus|m4a|aac)$/i };
/** a file name -> image | video | audio | "" (pure) */
function kindOf(name) { const n = String(name || ""); for (const k of Object.keys(EXT)) if (EXT[k].test(n)) return k; return ""; }

const MI = () => require("./modelInfo");
function dir(card) { return path.join(MI().dirFor(card), "user"); }
function rec(card) {
  try { const j = JSON.parse(fs.readFileSync(path.join(dir(card), "media.json"), "utf8")); return { v: 1, items: Array.isArray(j.items) ? j.items : [], thumb: j.thumb || "", thumb_of: j.thumb_of || "" }; }
  catch { return { v: 1, items: [], thumb: "", thumb_of: "" }; }
}
function write(card, r) { fs.mkdirSync(dir(card), { recursive: true }); fs.writeFileSync(path.join(dir(card), "media.json"), JSON.stringify(r, null, 2)); }
function inDir(card, f) { const d = dir(card), p = path.join(d, path.basename(String(f || ""))); return f && p.startsWith(d) && fs.existsSync(p) ? p : null; }
function cleanMeta(m) {
  const o = require("./mediaMeta").clean(m || {});
  for (const k of ["seed", "cfg", "steps", "width", "height"]) if (k in o && !Number.isFinite(+o[k])) delete o[k]; else if (k in o) o[k] = +o[k];
  return o;
}

function list(card) {
  const r = rec(card);
  const has = r.thumb && inDir(card, r.thumb);
  return { items: r.items.filter((x) => inDir(card, x.file)), thumb: has ? r.thumb : "", thumb_of: has ? r.thumb_of || "" : "" };
}
function bytesOf(o) {
  if (o.buf) return Buffer.isBuffer(o.buf) ? o.buf : Buffer.from(o.buf);
  if (o.path && fs.existsSync(o.path)) { const st = fs.statSync(o.path); if (st.size > MAX_BYTES) throw Object.assign(new Error("that file is over 512 MB"), { status: 400 }); return fs.readFileSync(o.path); }
  throw Object.assign(new Error("no file"), { status: 400 });
}
function add(card, o) {
  const name = path.basename(String(o.name || (o.path ? path.basename(o.path) : "") || ""));
  const kind = kindOf(name);
  if (!kind) return { error: "a picture, a video or a sound file (png jpg webp gif · mp4 webm mov · wav mp3 flac ogg m4a)" };
  const r = rec(card);
  if (r.items.length >= MAX_ITEMS) return { error: `a model keeps ${MAX_ITEMS} files at most - delete one first` };
  const buf = bytesOf(o);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const file = id + path.extname(name).toLowerCase();
  fs.mkdirSync(dir(card), { recursive: true });
  fs.writeFileSync(path.join(dir(card), file), buf);
  let meta = o.meta && Object.keys(o.meta).length ? cleanMeta(o.meta) : null;
  if (!meta) { try { meta = require("./mediaMeta").read(path.join(dir(card), file)) || {}; } catch { meta = {}; } }
  const item = { id, file, kind, name: name.slice(0, 200), added: Date.now(), meta, src: o.src || "" };
  r.items.push(item); write(card, r);
  return { ok: true, item };
}
function update(card, id, o) {
  const r = rec(card), it = r.items.find((x) => x.id === id);
  if (!it) return { error: "no such file" };
  if (o && o.meta) it.meta = cleanMeta(o.meta);
  if (o && typeof o.name === "string" && o.name.trim()) it.name = o.name.trim().slice(0, 200);
  write(card, r);
  return { ok: true, item: it };
}
function remove(card, id) {
  const r = rec(card), i = r.items.findIndex((x) => x.id === id);
  if (i < 0) return { error: "no such file" };
  const p = inDir(card, r.items[i].file); if (p) try { fs.unlinkSync(p); } catch { /* gone */ }
  r.items.splice(i, 1); write(card, r);
  return { ok: true };
}
function filePath(card, id) { const it = rec(card).items.find((x) => x.id === id); return it ? inDir(card, it.file) : null; }

function setThumb(card, o) {
  const r = rec(card);
  let buf, ext;
  if (o && o.item) {
    const it = r.items.find((x) => x.id === o.item);
    if (!it || (it.kind !== "image" && it.kind !== "video")) return { error: "pick one of its pictures or videos" };   // 2.581.0: + a video
    buf = fs.readFileSync(inDir(card, it.file)); ext = path.extname(it.file).toLowerCase();
  } else {
    const name = String((o && (o.name || (o.path && path.basename(o.path)))) || "");
    if (kindOf(name) !== "image" && kindOf(name) !== "video") return { error: "the thumbnail is a picture or a video (png jpg webp gif mp4 webm)" };
    buf = bytesOf(o || {}); ext = path.extname(name).toLowerCase();
  }
  if (r.thumb) { const old = inDir(card, r.thumb); if (old) try { fs.unlinkSync(old); } catch { /* fine */ } }
  const file = "thumb-" + Date.now().toString(36) + ext;
  fs.mkdirSync(dir(card), { recursive: true });
  fs.writeFileSync(path.join(dir(card), file), buf);
  r.thumb = file; r.thumb_of = o && o.item ? String(o.item) : ""; write(card, r);
  return { ok: true, thumb: file };
}
function clearThumb(card) {
  const r = rec(card);
  if (r.thumb) { const old = inDir(card, r.thumb); if (old) try { fs.unlinkSync(old); } catch { /* fine */ } }
  r.thumb = ""; r.thumb_of = ""; write(card, r);
  return { ok: true };
}
function thumbPath(card) { const r = rec(card); return r.thumb ? inDir(card, r.thumb) : null; }

module.exports = { MAX_ITEMS, MAX_BYTES, kindOf, dir, list, add, update, remove, filePath, setThumb, clearThumb, thumbPath };
