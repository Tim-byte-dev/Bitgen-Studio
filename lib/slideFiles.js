// bitGen Studio — lib/slideFiles.js (2.831.0): 🎞 SLIDES - the decks, kept in the project.
//
// Tim: "can you add the slides now please". A deck is a .bgk JSON file in projects/<project>/slides/ - the shape is
// ext/slidesdock/slidecore.js's (clean() keeps only that: slides, items, notes, transitions, the pictures in media).
//   dir()  list()  read(name)  write(name, deck)  remove(name)  - names are cleaned to <name>.bgk inside that folder
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const SC = require("../ext/slidesdock/slidecore.js");

const MAX = 80 * 1024 * 1024;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function dir() { const d = core.pDir("slides"); fs.mkdirSync(d, { recursive: true }); return d; }
/** a name that stays in the folder and ends in .bgk */
function safeName(n) {
  let b = path.basename(String(n || "")).replace(/\.(bgk|pptx)$/i, "").replace(/[^A-Za-z0-9 ._()&-]+/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 100);
  if (!b) b = "Presentation";
  return b + ".bgk";
}
function list() {
  let names = []; try { names = fs.readdirSync(dir()).filter((f) => /\.bgk$/i.test(f)); } catch (e) { return []; }
  return names.map((f) => { const st = fs.statSync(path.join(dir(), f)); return { name: f, size: st.size, mtime: st.mtimeMs }; }).sort((a, b) => b.mtime - a.mtime);
}
function file(name) { const f = path.join(dir(), safeName(name)); if (path.dirname(f) !== dir()) throw bad("bad name"); return f; }
function read(name) {
  const f = file(name); if (!fs.existsSync(f)) throw bad("no deck called " + safeName(name), 404);
  return Object.assign({ name: path.basename(f) }, SC.clean(JSON.parse(fs.readFileSync(f, "utf8"))));
}
function write(name, deck) {
  const d = SC.clean(deck), s = JSON.stringify(Object.assign({ app: "bitGen Studio" }, d));
  if (s.length > MAX) throw bad("the deck is too big to keep (" + Math.round(s.length / 1048576) + " MB - smaller pictures?)", 413);
  const f = file(name); fs.writeFileSync(f + ".part", s); fs.renameSync(f + ".part", f);
  return { name: path.basename(f), size: s.length };
}
function remove(name) { fs.rmSync(file(name), { force: true }); return { ok: true }; }
module.exports = { dir, safeName, list, read, write, remove, MAX };
