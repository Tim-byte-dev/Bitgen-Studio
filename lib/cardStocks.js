// lib/cardStocks.js — 2.896.0: 📇 the label / perforated card stocks the user types for the image editor's Business Card Sheet
// (ext/imageeditdock/pccardsheet.js). bitGen copies no maker's templates: the user measures their sheet (or reads it off the
// packet) - the paper, how many across and down, the card's size, the top and left margins and the pitch (from one card's
// edge to the next card's same edge) - and keeps it under a name for next time. One JSON file in the install folder:
//   <install>/business/card_stocks.json  {version: 1, stocks: [{id, name, paper: {w, h}, cols, rows, cw, ch, top, left,
//                                          hpitch, vpitch, created, updated}]}
//   clean(s) -> a checked stock (throws a 400 with the reason) / list() / save(s) (same name = replaced) / remove(id)
"use strict";
const fs = require("fs");
const path = require("path");

let ROOT = "";
const dir = () => ROOT || path.join(require("./core").BASE, "business");
const file = () => path.join(dir(), "card_stocks.json");
const MAX = 200;
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const num = (v, lo, hi, what) => {
  const n = Math.round(+v * 100) / 100;
  if (!Number.isFinite(n) || n < lo || n > hi) throw bad(`${what} must be ${lo} - ${hi}`);
  return n;
};
/** a stock checked: every size in mm, the grid inside the paper, no cards on top of each other */
function clean(s0) {
  const s = s0 || {}, name = String(s.name || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60);
  if (!name) throw bad("give the stock a name");
  const pw = num(s.paper && s.paper.w, 50, 1300, "the paper's width (mm)"), ph = num(s.paper && s.paper.h, 50, 1300, "the paper's height (mm)");
  const cols = Math.round(num(s.cols, 1, 50, "across")), rows = Math.round(num(s.rows, 1, 50, "down"));
  const cw = num(s.cw, 5, 1000, "the card's width (mm)"), ch = num(s.ch, 5, 1000, "the card's height (mm)");
  const top = num(s.top, 0, 500, "the top margin (mm)"), left = num(s.left, 0, 500, "the left margin (mm)");
  const hpitch = cols > 1 ? num(s.hpitch, 5, 1000, "the across pitch (mm)") : cw, vpitch = rows > 1 ? num(s.vpitch, 5, 1000, "the down pitch (mm)") : ch;
  if (hpitch < cw - 0.01) throw bad(`the across pitch (${hpitch} mm) is less than the card's width (${cw} mm) - the cards would overlap`);
  if (vpitch < ch - 0.01) throw bad(`the down pitch (${vpitch} mm) is less than the card's height (${ch} mm) - the cards would overlap`);
  const right = left + (cols - 1) * hpitch + cw, bottom = top + (rows - 1) * vpitch + ch;
  if (right > pw + 0.5) throw bad(`the cards reach ${Math.round(right * 10) / 10} mm across - past the ${pw} mm paper`);
  if (bottom > ph + 0.5) throw bad(`the cards reach ${Math.round(bottom * 10) / 10} mm down - past the ${ph} mm paper`);
  return { name, paper: { w: pw, h: ph }, cols, rows, cw, ch, top, left, hpitch, vpitch };
}
function read() {
  try { const j = JSON.parse(fs.readFileSync(file(), "utf8")); return { version: 1, stocks: Array.isArray(j.stocks) ? j.stocks : [] }; } catch (e) { return { version: 1, stocks: [] }; }
}
function write(j) {
  fs.mkdirSync(dir(), { recursive: true });
  const tmp = file() + ".part"; fs.writeFileSync(tmp, JSON.stringify(j, null, 2)); fs.renameSync(tmp, file());
}
function list() { return { stocks: read().stocks.slice().sort((a, b) => a.name.localeCompare(b.name)) }; }
function save(s0) {
  const s = clean(s0), j = read(), now = new Date().toISOString();
  const old = j.stocks.find((x) => (s0 && s0.id && x.id === s0.id) || x.name.toLowerCase() === s.name.toLowerCase());
  if (old) { Object.assign(old, s, { updated: now }); write(j); return old; }
  if (j.stocks.length >= MAX) throw bad(`at most ${MAX} stocks - delete one first`);
  const id = "st" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const rec = Object.assign({ id }, s, { created: now, updated: now });
  j.stocks.push(rec); write(j); return rec;
}
function remove(id) {
  const j = read(), n = j.stocks.length; j.stocks = j.stocks.filter((x) => x.id !== String(id));
  if (j.stocks.length === n) throw Object.assign(new Error("no such stock"), { status: 404 });
  write(j); return true;
}
/* 2.898.0 - lib/businessDb.js keeps the stocks in the same database as the business details: this file is then this computer's copy */
function raw() { return read().stocks.map((x) => Object.assign({}, x, { paper: Object.assign({}, x.paper) })); }
/** the database's stocks become this computer's list (a row that no longer checks out is left out) */
function adopt(list) {
  const out = [];
  for (const x of list || []) { try { out.push(Object.assign({ id: String(x.id) }, clean(x), { created: x.created || "", updated: x.updated || "" })); } catch (e) { /* a bad row */ } }
  write({ version: 1, stocks: out }); return out.length;
}
module.exports = { clean, list, save, remove, raw, adopt, file, dir, _setRoot: (r) => { ROOT = r; } };
