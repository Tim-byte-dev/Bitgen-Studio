/* bitGen Studio — lib/synthFiles.js (2.956.0): 🎹 THE SYNTH TAB's FILES (.sfx) in the project (routes/synth.js).
 * Tim: "when record button is pressed in keyboard or looper , save the file on stop. allow the synth or keyboard to load any of the
 * saved files. save the timeline file as filename.sfx, looper files _loop_ random name.sfx and keyboard as _key_random name.sfx.
 * add a save button to timeline, if save does not have a filename ask for filename(dialog) , if it does have a filename overwrite
 * the file loaded. add a save as button."
 * A .sfx file is JSON {format: "bitgen-synth", v: 1, kind: "tl" | "loop" | "key", ...the parts} - small (the sound of a take is
 * a WAV in 📂 My samples, named the same, that the file points at). projects/<p>/synth/<name>.sfx.
 *   setDir(d) (tests), dir(), safe(name) -> "<name>.sfx" | "", list() -> [{name, kind, size, mtime}], read(name) -> object,
 *   write(name, data, overwrite) -> {name} | {status: 409 (there already), 400}, remove(name)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 8 * 1024 * 1024, KINDS = ["tl", "loop", "key"];
let DIR = null;
function setDir(d) { DIR = d || null; }
function dir() { const d = DIR || core.pDir("synth"); fs.mkdirSync(d, { recursive: true }); return d; }
/** a file name: letters, digits, space - _ . ( ), no folder, ".sfx" on the end (added when missing) */
function safe(name) {
  let n = path.basename(String(name || "").replace(/\\/g, "/")).trim().replace(/\.sfx$/i, "");
  n = n.replace(/[^\w\- .()]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!n || /^\.+$/.test(n) || n.startsWith(".")) return "";
  return n + ".sfx";
}
function kindOf(j) { return j && j.format === "bitgen-synth" && KINDS.includes(j.kind) ? j.kind : null; }
function list() {
  let names = [];
  try { names = fs.readdirSync(dir()).filter((n) => /\.sfx$/i.test(n) && !n.startsWith(".")); } catch { names = []; }
  return names.map((n) => {
    const p = path.join(dir(), n), st = fs.statSync(p);
    let kind = n.startsWith("_loop_") ? "loop" : n.startsWith("_key_") ? "key" : "tl";
    try { kind = kindOf(JSON.parse(fs.readFileSync(p, "utf8"))) || kind; } catch { /* a damaged file: by its name */ }
    return { name: n, kind, size: st.size, mtime: st.mtimeMs / 1000 };
  }).sort((a, b) => b.mtime - a.mtime);
}
function read(name) {
  const n = safe(name), p = n && path.join(dir(), n);
  if (!n || !fs.existsSync(p)) throw Object.assign(new Error(`no synth file called ${name}`), { status: 404 });
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!kindOf(j)) throw Object.assign(new Error(`${n} is not a bitGen synth file`), { status: 400 });
  return j;
}
function write(name, data, overwrite) {
  const n = safe(name);
  if (!n) return { status: 400, error: "give the file a name (letters, numbers, spaces, - _ . ( ))" };
  if (!kindOf(data)) return { status: 400, error: "not a bitGen synth file (format / kind)" };
  const text = JSON.stringify(Object.assign({}, data, { name: n, saved: new Date().toISOString() }));
  if (text.length > MAX) return { status: 400, error: "that is too big for a synth file" };
  const p = path.join(dir(), n);
  if (fs.existsSync(p) && !overwrite) return { status: 409, error: `${n} is already there`, name: n };
  const tmp = p + ".tmp"; fs.writeFileSync(tmp, text); fs.renameSync(tmp, p);
  return { name: n, kind: data.kind, overwrote: !!overwrite };
}
function remove(name) {
  const n = safe(name), p = n && path.join(dir(), n);
  if (!n || !fs.existsSync(p)) return { status: 404, error: `no synth file called ${name}` };
  fs.unlinkSync(p); return { name: n };
}
module.exports = { KINDS, MAX, setDir, dir, safe, kindOf, list, read, write, remove };
