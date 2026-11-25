/* bitGen Studio — ext/lifedock/lifeserver.js (2.944.0): 🎓 LIFE CHOICES's HIGH SCORES, kept on this PC.
 * The extension's own server part (ext.json "server" - lib/extensions.js mounts it; server.js is never touched).
 * <install>/life_choices.json = {scores: [{name, score, worth, retire, bots, date}]} - the best ten, highest first (this
 * machine's state: .gitignore + scripts/make_zips.sh leave it out).
 *   GET  /api/life-choices/scores                                  -> {scores}
 *   POST /api/life-choices/scores {name, score, worth, retire, bots} -> {scores, rank (1-10 | 0 = not in the ten)}
 *   clean(entry) / add(list, entry) -> {scores, rank}   (pure - scripts/test-944.js)
 * 2.964.0: the 🧠 LLM player's choices -
 *   POST /api/life-choices/llm {name, brief, kind, title, text, options [{id, label}]} -> {id, why} | {error} (502: no LLM answer)
 *   lifellm.js builds the messages and reads the reply; the LLM is bitGen's own (lib/llmChat.js complete - whichever the app
 *   uses: llama-server here, an external endpoint, a pod, OpenRouter). setComplete(fn) for the tests.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const KEEP = 10, MAX = 1e12;
let FILE = null;
const file = () => FILE || path.join(require("../../lib/core").BASE, "life_choices.json");
function setFile(f) { FILE = f || null; }                     // tests

function clean(e) {
  const o = e || {};
  const name = String(o.name == null ? "" : o.name).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 18) || "Player";
  const score = Math.round(Number(o.score)), worth = Math.round(Number(o.worth));
  if (!Number.isFinite(score) || Math.abs(score) > MAX) throw Object.assign(new Error("that is not a score"), { status: 400 });
  const retire = [30, 45, 65].includes(Number(o.retire)) ? Number(o.retire) : 65;
  const bots = Math.max(0, Math.min(5, Math.floor(Number(o.bots)) || 0));
  return { name, score, worth: Number.isFinite(worth) && Math.abs(worth) <= MAX ? worth : score, retire, bots, date: o.date ? String(o.date).slice(0, 30) : new Date().toISOString() };
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
let completeFn = null;
function setComplete(fn) { completeFn = fn || null; }          // tests
/** one 🧠 decision: {id, why} - or throws {status, message} */
async function decide(body) {
  const L = require("./lifellm.js");
  const o = L.clean(body);
  const call = completeFn || ((q) => require("../../lib/llmChat").complete(require("../../lib/core"), q));
  const r = await call({ messages: L.messages(o), temperature: 0.4, max_tokens: 300 });
  if (!r || !r.ok) throw Object.assign(new Error((r && r.error) || "the LLM did not answer"), { status: 502 });
  const pick = L.parse(r.text, o.options);
  if (!pick) throw Object.assign(new Error("the LLM's answer named none of the options: " + String(r.text || "").slice(0, 120)), { status: 502 });
  return pick;
}
function mount(app) {
  const express = require("express");
  app.post("/api/life-choices/llm", express.json({ limit: "32kb" }), async (req, res) => {
    try { res.json(await decide(req.body || {})); }
    catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }
  });
  app.get("/api/life-choices/scores", (req, res) => res.json({ scores: read() }));
  app.post("/api/life-choices/scores", express.json({ limit: "4kb" }), (req, res) => {
    try {
      const r = add(read(), req.body || {});
      if (r.rank) write(r.scores);
      res.json(r);
    } catch (e) { res.status(e.status || 500).json({ error: e.message || String(e) }); }
  });
}
module.exports = { mount, clean, add, read, setFile, KEEP, decide, setComplete };
