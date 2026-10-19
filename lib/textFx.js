// bitGen Studio — lib/textFx.js (2.411.0): the TEXT EFFECT PRESETS on disk. The built-in ones (made from PSD text effects -
// scripts/textfx_build.js) are textfx/*.json beside the app; the ones you import (＋ Import a PSD text effect… in the
// timeline's / the image editor's text presets) are textfx/user/<id>.json. The shape and its cleaning are static/textfx.js's
// (one normalize for the page and here). Tim: "from these text effects, is it possible to create a tool for bitgen to add
// the text effects to presets?"
"use strict";
const fs = require("fs");
const path = require("path");
const TFX = require("../static/textfx.js");

const ROOT = path.join(__dirname, "..");
const BUILTIN = path.join(ROOT, "textfx");
let USER = path.join(BUILTIN, "user");
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const jsonIn = (dir) => { try { return fs.readdirSync(dir).filter((n) => /\.json$/i.test(n)).sort(); } catch { return []; } };
const fileOf = (id) => path.join(USER, String(id).replace(/^user:/, "").replace(/[^a-z0-9-]/gi, "") + ".json");

/** every preset: the built-in ones first, then yours (newest last) */
function list() {
  const out = [];
  for (const n of jsonIn(BUILTIN)) { const p = TFX.normalize(readJson(path.join(BUILTIN, n))); if (p) out.push(Object.assign(p, { builtin: true })); }
  const mine = jsonIn(USER).map((n) => { const f = path.join(USER, n); const p = TFX.normalize(readJson(f)); return p ? Object.assign(p, { builtin: false, _m: fs.statSync(f).mtimeMs }) : null; })
    .filter(Boolean).sort((a, b) => a._m - b._m).map(({ _m, ...p }) => p);
  return out.concat(mine);
}
/** an imported preset -> saved as yours (a fresh id when the name is taken) -> the preset */
function save(raw) {
  const p = TFX.normalize(raw);
  if (!p) throw bad("that is not a text effect preset (no text layers, or no size)");
  const s = JSON.stringify(p);
  if (s.length > 4 * 1024 * 1024) throw bad("that preset is too big", 413);
  fs.mkdirSync(USER, { recursive: true });
  const base = TFX.slug(p.name);
  let id = "user:" + base, n = 1;
  const taken = new Set(list().map((x) => x.id));
  while (taken.has(id)) id = "user:" + base + "-" + (++n);
  p.id = id;
  fs.writeFileSync(fileOf(id), JSON.stringify(p, null, 1));
  return p;
}
function remove(id) {
  if (!/^user:/.test(String(id))) throw bad("a built-in preset cannot be deleted");
  const f = fileOf(id);
  if (!fs.existsSync(f)) throw bad("no preset " + id, 404);
  fs.unlinkSync(f);
  return true;
}
function rename(id, name) {
  if (!/^user:/.test(String(id))) throw bad("a built-in preset cannot be renamed");
  const f = fileOf(id), p = TFX.normalize(readJson(f));
  if (!p) throw bad("no preset " + id, 404);
  p.name = String(name || "").replace(/[\r\n]+/g, " ").trim().slice(0, 60) || p.name;
  fs.writeFileSync(f, JSON.stringify(p, null, 1));
  return p;
}
/** the tests point it at a scratch folder */
function _dirs(user) { if (user) USER = user; return { BUILTIN, USER }; }

module.exports = { list, save, remove, rename, _dirs };
