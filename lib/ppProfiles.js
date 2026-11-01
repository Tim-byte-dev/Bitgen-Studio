// bitGen Studio — lib/ppProfiles.js (2.640.0): the Sketcher's OWN PROFILES (skirting, cornice, door / window frames, sills),
// kept per project in projects/<project>/pushpull/profiles.json ({profiles: [...], saved}). Used by routes/ppProfiles.js.
// The built-in ones live in the page (ext/pushpulldock/ppprofile.js) - this file only keeps the user's.
//   list()        [{id, name, kind, pts}]
//   save(p)       add or replace (by id; a new one gets an id) -> {profile, profiles}
//   remove(id)    -> {ok, profiles}
//   check(p)      the shape checked (400 when it is not a profile)
"use strict";
const fs = require("fs");
const path = require("path");
const pp = require("./pushPull");

const KINDS = ["skirt", "cornice", "doorframe", "windowframe", "sill"];
const MAX = 500;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const fileOf = () => path.join(pp.dir(), "profiles.json");
function list() {
  const f = fileOf();
  if (!fs.existsSync(f)) return [];
  try { const o = JSON.parse(fs.readFileSync(f, "utf8")); return Array.isArray(o.profiles) ? o.profiles.map(soft).filter(Boolean) : []; } catch { return []; }
}
function soft(p) { try { return check(p); } catch { return null; } }
function check(p) {
  if (!p || typeof p !== "object") throw bad("a profile is {name, kind, pts}");
  if (!KINDS.includes(p.kind)) throw bad("a profile's kind is one of " + KINDS.join(", "));
  if (!Array.isArray(p.pts) || p.pts.length < 3 || p.pts.length > 400) throw bad("a profile needs 3 to 400 points");
  const pts = p.pts.map((q) => (Array.isArray(q) ? [+q[0], +q[1]] : [NaN, NaN]));
  if (!pts.every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]) && Math.abs(q[0]) <= 1 && Math.abs(q[1]) <= 1)) throw bad("a profile's points are metres, within 1 m");
  const id = typeof p.id === "string" ? p.id : "";
  if (id && !/^[a-z0-9_-]{1,40}$/.test(id)) throw bad("that id is not one of yours (built-in profiles cannot be changed - save a copy)");
  return { id: id || "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: String(p.name || "Profile").slice(0, 60), kind: p.kind, pts };
}
function write(profiles) {
  const f = fileOf();
  fs.writeFileSync(f + ".part", JSON.stringify({ profiles, saved: Date.now() }, null, 1)); fs.renameSync(f + ".part", f);
}
function save(p) {
  const q = check(p), L = list(), i = L.findIndex((x) => x.id === q.id);
  if (i >= 0) L[i] = q; else { if (L.length >= MAX) throw bad("the project has " + MAX + " profiles - delete some first", 413); L.push(q); }
  write(L);
  return { profile: q, profiles: L };
}
function remove(id) {
  const L = list(), M = L.filter((x) => x.id !== String(id || ""));
  if (M.length === L.length) throw bad("no profile " + id, 404);
  write(M);
  return { ok: true, profiles: M };
}
module.exports = { list, save, remove, check, KINDS };
