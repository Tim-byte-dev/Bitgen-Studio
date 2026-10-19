// bitGen Studio — lib/quickPrompts.js (2.451.0): the prompt docker's QUICK PROMPTS - saved prompts kept in
// <install>/quick_prompts.json (shared by every project). Tim: "add save button in prompt docker - save the prompt as
// the first line - add it to a dropdown for quick prompts" - asked: the name is the prompt's first line, the whole
// prompt is kept.
//   nameOf(text)     the first non-empty line, tidied (up to 80 characters)
//   list()           [{name, text, at}] newest first
//   save(text)       -> {name, saved: true, replaced} (the same name = replaced, moved to the top; 300 kept)
//   remove(name)     -> {removed}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const MAX = 300, MAX_TEXT = 20000;
let BASE_DIR = null;                                     // tests point it elsewhere
function setBase(d) { BASE_DIR = d; }
function file() { return path.join(BASE_DIR || core.BASE, "quick_prompts.json"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function nameOf(text) {
  const line = String(text == null ? "" : text).split(/\r?\n/).map((s) => s.trim()).find((s) => s.length) || "";
  return line.replace(/\s+/g, " ").slice(0, 80);
}
function read() {
  try { const j = JSON.parse(fs.readFileSync(file(), "utf8")); return Array.isArray(j.prompts) ? j.prompts.filter((p) => p && p.name && typeof p.text === "string") : []; }
  catch { return []; }
}
function write(list) {
  const f = file(), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, prompts: list.slice(0, MAX) }, null, 1));
  fs.renameSync(tmp, f);
}
function list() { return read(); }
function save(text) {
  const t = String(text == null ? "" : text).replace(/\r\n/g, "\n").trim();
  if (!t) throw bad("the prompt is empty - nothing to save");
  if (t.length > MAX_TEXT) throw bad("the prompt is too long to keep (20 000 characters)");
  const name = nameOf(t), all = read(), had = all.some((p) => p.name === name);
  write([{ name, text: t, at: Date.now() }].concat(all.filter((p) => p.name !== name)));
  return { name, saved: true, replaced: had };
}
function remove(name) {
  const all = read(), left = all.filter((p) => p.name !== String(name || ""));
  if (left.length !== all.length) write(left);
  return { removed: left.length !== all.length };
}
module.exports = { MAX, setBase, file, nameOf, list, save, remove };
