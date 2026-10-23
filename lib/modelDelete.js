// bitGen Studio — lib/modelDelete.js (2.579.0): 🗑 DELETE A MODEL in the 🧩 Model manager - from the disk.
//
// Tim: "allow user to delete models in model manager" + "when user deletes model in model manager, delete it from the
// disk too". A card is a file the ComfyUI scan found (lib/modelCards.js find(key) - never a path from the request); its
// delete removes, for good (models are gigabytes - a recycle bin copy would double them on another drive):
//   the model file                         <comfy models>/<cat>/<name>
//   the files beside it with its stem      .preview.png / .png / .jpg / .webp …, .civitai.info, .bitgen.json, .json,
//                                          .yaml (a config), .sha256, .txt, .html - never another model file
//   its page in the model_info library     <app>/model_info/<models|loras>/<stem>/ (Civitai details, examples, your
//                                          pictures / videos / sounds of it)
//   check(key)    {key, name, abs, size, sidecars: [names], info: bool, styles: [names that use it]} - what a delete
//                 removes, for the confirmation
//   remove(key)   -> {ok, removed: [names], freed: bytes} | {error}
"use strict";
const fs = require("fs");
const path = require("path");

const SIDECAR = [".preview.png", ".preview.jpg", ".preview.jpeg", ".preview.webp", ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".civitai.info", ".info", ".bitgen.json", ".metadata.json", ".json", ".yaml", ".yml", ".sha256", ".txt", ".html", ".md"];
const MODEL_EXT = /\.(safetensors|ckpt|pt|pth|bin|gguf|sft|onnx)$/i;

let CARDS = null;                                         // tests: a stand-in for lib/modelCards
function setCards(c) { CARDS = c; }
const cards = () => CARDS || require("./modelCards");
let INFO = null;                                          // tests: where the model_info page is
function infoDir(card) { try { return INFO ? INFO(card) : require("./modelInfo").dirFor(card); } catch { return ""; } }
function setInfoDir(f) { INFO = f; }

/** the files beside a model that belong to it (pure on a directory listing): names in `names` that are
 *  <stem><a sidecar ending>, never another model file */
function sidecarsOf(fileName, names) {
  const stem = String(fileName).replace(/\.[^.]+$/, "");
  return (names || []).filter((n) => n !== fileName && !MODEL_EXT.test(n)
    && SIDECAR.some((e) => n.toLowerCase() === (stem + e).toLowerCase()));
}
function styleNames(fileName) {
  const base = path.basename(String(fileName)).toLowerCase();
  let all = [];
  try { const S = require("./styles"); all = S.read ? S.read() : []; } catch { all = []; }
  if (!Array.isArray(all)) all = Object.values(all || {});
  return all.filter((s) => s && JSON.stringify(s).toLowerCase().indexOf(base) >= 0).map((s) => String(s.name || s.id || "?")).slice(0, 50);
}

function check(key) {
  const h = cards().find(String(key || ""));
  if (!h) return { error: "no such model (scan again: ↻)" };
  const dir = path.dirname(h.abs), file = path.basename(h.abs);
  let names = []; try { names = fs.readdirSync(dir); } catch { names = []; }
  let size = 0; try { size = fs.statSync(h.abs).size; } catch { size = h.card.size || 0; }
  const idir = infoDir(h.card);
  return { key: h.card.key, name: h.card.name, abs: h.abs, size, sidecars: sidecarsOf(file, names), info: !!(idir && fs.existsSync(idir)), styles: styleNames(h.card.name) };
}

function remove(key) {
  const c = check(key);
  if (c.error) return c;
  const h = cards().find(String(key));
  const dir = path.dirname(c.abs), removed = [];
  let freed = 0;
  try { fs.rmSync(c.abs); freed += c.size; removed.push(c.name); }
  catch (e) { return { error: `could not delete ${c.name}: ${e.code === "EBUSY" || e.code === "EPERM" ? "it is in use - close ComfyUI (or what uses it) and try again" : e.message}` }; }
  for (const n of c.sidecars) {
    const p = path.join(dir, n);
    try { const s = fs.statSync(p).size; fs.rmSync(p); freed += s; removed.push(n); } catch { /* gone already */ }
  }
  const idir = infoDir(h.card);
  if (idir && fs.existsSync(idir)) { try { fs.rmSync(idir, { recursive: true, force: true }); removed.push("model_info/" + path.basename(path.dirname(idir)) + "/" + path.basename(idir)); } catch { /* fine */ } }
  try { cards().invalidate(); } catch { /* fine */ }
  return { ok: true, key: c.key, removed, freed };
}

module.exports = { SIDECAR, sidecarsOf, check, remove, setCards, setInfoDir };
