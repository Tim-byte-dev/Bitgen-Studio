/* bitGen Studio — lib/workspaces.js (2.526.0): workspaces.json - the WORKSPACE dropdown's memory (static/workspaces.js).
 * Tim (verbatim): "lets add a workspace dropdown to the main menubar - image editing, video editing, music video,basic,
 * expert. to make it easier to navigate the app"
 *
 * ONE JSON file at the install root (beside docker_status.json and docker.cfg - the same in every project):
 *   { "version": 1, "current": "expert", "saved": { "<workspace>": <a ⊞ Docker layout snapshot: window, col, docks, vis,
 *     floats, prompt - cleaned by lib/dockerCfg.cleanVariant> } }
 *   current   the workspace the app is in (Expert until one is picked - nothing changes for anyone who never picks one)
 *   saved     each workspace as it was LEFT; none = its default (static/workspaces.js DEFS)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const WS = require("../static/workspaces.js");
const DC = require("./dockerCfg");

const FILE = "workspaces.json";
const fileOf = (base) => path.join(base, FILE);
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function empty() { return { version: 1, current: "expert", saved: {} }; }
function cleanSnap(s) {
  if (!s || typeof s !== "object") return null;
  const v = DC.cleanVariant(Object.assign({}, s, { saved: new Date().toISOString() }));
  return v.window.w && v.window.h && v.vis ? v : null;          // a snapshot without what was on screen is no use
}
function normalize(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const out = empty();
  if (WS.valid(r.current)) out.current = r.current;
  const sv = r.saved && typeof r.saved === "object" ? r.saved : {};
  for (const id of WS.IDS) { const c = cleanSnap(sv[id]); if (c) out.saved[id] = c; }
  return out;
}
function load(base) { try { return normalize(JSON.parse(fs.readFileSync(fileOf(base), "utf8"))); } catch { return empty(); } }
function write(base, rec) {
  const f = fileOf(base), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 1), "utf8");
  fs.renameSync(tmp, f);
  return rec;
}
function need(id) { if (!WS.valid(id)) throw bad("workspace: " + WS.IDS.join(" | ")); return id; }
/** keep `from` as it is now (snap), go to `to` -> the record */
function switchTo(base, b) {
  const x = b && typeof b === "object" ? b : {};
  need(x.to);
  const rec = load(base);
  if (WS.valid(x.from)) { const c = cleanSnap(x.snap); if (c) rec.saved[x.from] = c; }
  rec.current = x.to;
  try { require("./testPlan").event("workspace_used", { cat: x.to, what: x.to }); } catch { /* the 🧪 checklist */ }
  return write(base, rec);
}
/** keep a workspace as it is now (leaving the app - sendBeacon) */
function snapshot(base, id, snap) {
  need(id);
  const c = cleanSnap(snap);
  if (!c) throw bad("the snapshot is missing what is on screen");
  const rec = load(base); rec.saved[id] = c;
  return write(base, rec);
}
/** ↺ forget a workspace's own layout (its default comes back); "all" forgets every one */
function reset(base, id) {
  const rec = load(base);
  if (id === "all") rec.saved = {}; else delete rec.saved[need(id)];
  try { require("./testPlan").event("workspace_reset", { what: id }); } catch { /* the 🧪 checklist */ }
  return write(base, rec);
}

/** the page with the record in its head (window.H3_WORKSPACES - routes/dockerStatus.js page) */
function inject(html, rec) {
  const tag = "<script>window.H3_WORKSPACES = " + JSON.stringify(rec).replace(/</g, "\\u003c") + ";</script>";
  const s = String(html || ""), i = s.indexOf("<head>");
  return i >= 0 ? s.slice(0, i + 6) + "\n" + tag + s.slice(i + 6) : tag + s;
}

module.exports = { FILE, fileOf, empty, normalize, load, switchTo, snapshot, reset, inject };
