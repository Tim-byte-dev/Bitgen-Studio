/* bitGen Studio — ext/chasedock/chaseserver.js (2.935.0): POLICE CHASE's HIGH SCORES, kept on this PC.
 * The extension's own server part (ext.json "server" - lib/extensions.js mountServers mounts it; server.js is never touched).
 * <install>/police_chase.json = {scores: [{name, score, level, date}]} - the best ten, highest first (this machine's state:
 * .gitignore + scripts/make_zips.sh leave it out).
 *   GET  /api/police-chase/scores                      -> {scores}
 *   POST /api/police-chase/scores {name, score, level}  -> {scores, rank (1-10 | 0 = not in the ten)}
 *   clean(entry) / add(list, entry) -> {scores, rank}   (pure - scripts/test-935.js)
 */
"use strict";
const fs = require("fs");
const path = require("path");

const KEEP = 10, MAX_SCORE = 99999999;
let FILE = null;
const file = () => FILE || path.join(require("../../lib/core").BASE, "police_chase.json");
function setFile(f) { FILE = f || null; }                     // tests

function clean(e) {
  const o = e || {};
  const name = String(o.name == null ? "" : o.name).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || "Driver";
  const score = Math.floor(Number(o.score));
  const level = Math.floor(Number(o.level));
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) throw Object.assign(new Error("that is not a score"), { status: 400 });
  return { name, score, level: Number.isFinite(level) && level > 0 && level < 1000 ? level : 1, date: o.date ? String(o.date).slice(0, 30) : new Date().toISOString() };
}
function add(list, e) {
  const it = clean(e);
  const all = (Array.isArray(list) ? list : []).slice();
  all.push(it);
  all.sort((a, b) => b.score - a.score || String(a.date).localeCompare(String(b.date)));
  const scores = all.slice(0, KEEP);
  return { scores, rank: scores.indexOf(it) + 1 };
}
function read() {
  try {
    const j = JSON.parse(fs.readFileSync(file(), "utf8"));
    return (Array.isArray(j && j.scores) ? j.scores : []).map((x) => { try { return clean(x); } catch { return null; } }).filter(Boolean)
      .sort((a, b) => b.score - a.score).slice(0, KEEP);
  } catch { return []; }
}
function write(scores) {
  const f = file(), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ scores }, null, 1));
  fs.renameSync(tmp, f);
}

function mount(app) {
  const express = require("express");
  app.get("/api/police-chase/scores", (req, res) => res.json({ scores: read() }));
  app.post("/api/police-chase/scores", express.json({ limit: "4kb" }), (req, res) => {
    try {
      const r = add(read(), req.body || {});
      if (r.rank) write(r.scores);
      res.json(r);
    } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }
  });
}
module.exports = { mount, clean, add, read, setFile, KEEP };
