/* bitGen Studio — docker.cfg (2.392.0): the saved docker layouts, one per set of dockers open together.
 *
 * Tim (verbatim): "create a file, docker.cfg / this file will house docker sizes when open with other dockers. example
 * if music, prompt chat and prompt dockers are open, record the sizes of all the dockers when the button is pressed /
 * when only they are opened again together, load the default sizes from cfg file. if a new docker is opened, look to
 * see if their is a configuration for the 4 dockers together while they are open. / ... because people will likely use
 * different resolutions they should have the option to layout the dockers as they like but not have to do it each time."
 *
 * ONE JSON file at the install root (beside docker_status.json - the same layout in every project):
 *   { "version": 1, "auto": true,
 *     "configs": { "chatdock+musicdock+promptdock": { "variants": [
 *         { "window": {"w": 1920, "h": 1080}, "col": {"h": 940}, "saved": "<iso>",
 *           "docks": { "musicdock": {"state": "open", "height": 210, "width": 1100, "max_height": 0, "maximized": false},
 *                      ..., "ldock": {"width": 300, "max_width": 0}, ... },
 *           "prompt": {"floating": true, "x": 700, "y": 600, "float_w": 760, "float_h": 260, "dock_to": "", ...} } ] } } }
 *   key       the OPEN column dockers, sorted, joined by "+" (static/dockcfg.js keyOf)
 *   variants  one per window size (within 40 px = the same screen, replaced on save), at most 6 - the newest kept
 *   auto      load a set's layout by itself when that set is open (the panel's checkbox)
 * The page gets the file in its head (window.H3_DOCK_CFG, routes/dockerStatus.page) and POSTs to /api/docker-cfg/*.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const DS = require("./dockerStatus");
const DockCfg = require("../static/dockcfg.js");
const DF = require("../static/dockfloat.js");          // 2.432.0: a floating panel's state, cleaned the way docker_status.json's floats are

const FILE = "docker.cfg";
const MAX_VARIANTS = 6, MAX_SETS = 300, SAME = 40;
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const fileOf = (base) => path.join(base, FILE);
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
function empty() { return { version: 1, auto: true, configs: {} }; }

/** a variant, junk in -> clean out (the docks clamped like docker_status.json) */
function cleanVariant(v) {
  const x = v && typeof v === "object" ? v : {};
  const out = { window: { w: int((x.window || {}).w, 320, 16000, 0), h: int((x.window || {}).h, 240, 16000, 0) },
                col: { h: int((x.col || {}).h, 0, 16000, 0) }, saved: typeof x.saved === "string" ? x.saved.slice(0, 40) : new Date().toISOString(), docks: {} };
  const docks = x.docks && typeof x.docks === "object" ? x.docks : {};
  for (const id of DS.BOTTOM) {
    const d = docks[id]; if (!d || typeof d !== "object") continue;
    out.docks[id] = { state: d.state === "closed" ? "closed" : "open", height: int(d.height, DS.H.min, DS.H.max, 0), width: int(d.width, 0, DS.H.max, 0),
                      max_height: d.max_height > 0 ? int(d.max_height, DS.H.min, DS.H.max, 0) : 0, maximized: d.maximized === true };
  }
  for (const id of DS.SIDE) {
    const d = docks[id]; if (!d || typeof d !== "object") continue;
    out.docks[id] = { width: int(d.width, DS.W.min, DS.W.max, 0), max_width: d.max_width > 0 ? int(d.max_width, DS.W.min, DS.W.max, 0) : 0, hidden: d.hidden === true };
  }
  if (x.prompt && typeof x.prompt === "object") {
    const p = x.prompt;
    out.prompt = { floating: p.floating !== false, x: int(p.x, -4000, 20000, -1), y: int(p.y, -1, 20000, -1), float_w: int(p.float_w, 0, 8000, 0),
                   float_h: int(p.float_h, 0, 8000, 0), dock_to: typeof p.dock_to === "string" && /^[a-z]{2,20}$/.test(p.dock_to) ? p.dock_to : "",
                   dock_side: ["top", "bottom", "left", "right"].includes(p.dock_side) ? p.dock_side : "", dock_w: int(p.dock_w, 0, 4000, 0) };
  }
  // 2.432.0: what was on screen + the floating panels (Basic Settings ... - SecFloat) + the dockers beside the timeline
  // canvas (🎤 Karaoke, 🧰 Tools - TlStageDock) and their columns
  if (x.vis && typeof x.vis === "object") {
    const vb = x.vis.bottom && typeof x.vis.bottom === "object" ? x.vis.bottom : {}, vs = x.vis.side && typeof x.vis.side === "object" ? x.vis.side : {};
    out.vis = { bottom: {}, side: {} };
    for (const id of DS.BOTTOM) if (vb[id] && typeof vb[id] === "object") out.vis.bottom[id] = { gone: vb[id].gone === true, collapsed: vb[id].collapsed === true };
    for (const id of DS.SIDE) if (typeof vs[id] === "boolean") out.vis.side[id] = vs[id];
  }
  const ID = /^[A-Za-z][\w-]{0,40}$/;
  if (x.floats && typeof x.floats === "object") {
    out.floats = {};
    for (const k of Object.keys(x.floats).slice(0, 40)) if (ID.test(k) && x.floats[k] && typeof x.floats[k] === "object") out.floats[k] = DF.cleanState(x.floats[k]);
  }
  if (x.panels && typeof x.panels === "object") {
    out.panels = {};
    for (const k of Object.keys(x.panels).slice(0, 20)) {
      const q = x.panels[k]; if (!ID.test(k) || !q || typeof q !== "object") continue;
      out.panels[k] = { shown: q.shown === true, side: q.side === "L" || q.side === "R" ? q.side : "", x: int(q.x, -4000, 20000, 0), y: int(q.y, 0, 20000, 0), w: int(q.w, 0, 8000, 0), h: int(q.h, 0, 8000, 0) };
    }
  }
  if (x.cols && typeof x.cols === "object") out.cols = { L: int(x.cols.L, 0, 4000, 0), R: int(x.cols.R, 0, 4000, 0) };
  const all = cleanAll(x.all);
  if (all) out.all = all;
  return out;
}
/** 2.891.0 (Tim: "when saving a layout, save the size position and status(minimized, maximized and normal) of all
 *  dockers"): EVERY docker - the column's (extensions + ▣ dockers too) {status, h, w}, the floating windows {status, x, y,
 *  w, h}, the named dockers / panels (static/floatpanels.js snapshot) - junk in, clean out (pure) */
const STATUSES = ["normal", "minimized", "maximized", "hidden"];
function cleanAll(a) {
  if (!a || typeof a !== "object") return null;
  const ID = /^[A-Za-z][\w-]{0,40}$/, NID = /^[A-Za-z][\w.:-]{0,60}$/;
  const out = { docks: {}, floats: {} };
  for (const k of Object.keys(a.docks && typeof a.docks === "object" ? a.docks : {}).slice(0, 80)) {
    const d = a.docks[k]; if (!ID.test(k) || !d || typeof d !== "object" || !STATUSES.includes(d.status)) continue;
    out.docks[k] = { status: d.status, h: int(d.h, 0, 16000, 0), w: int(d.w, 0, 16000, 0) };
  }
  for (const k of Object.keys(a.floats && typeof a.floats === "object" ? a.floats : {}).slice(0, 60)) {
    const f = a.floats[k]; if (!ID.test(k) || !f || typeof f !== "object" || !STATUSES.includes(f.status)) continue;
    out.floats[k] = { status: f.status, x: int(f.x, -4000, 20000, 0), y: int(f.y, -4000, 20000, 0), w: int(f.w, 0, 16000, 0), h: int(f.h, 0, 16000, 0) };
  }
  const n = a.named && typeof a.named === "object" ? a.named : null;
  if (n) {
    const one = (q) => {
      if (!q || typeof q !== "object") return null;
      const o = { state: ["float", "in", "zone", "home"].includes(q.state) ? q.state : "home", docker: typeof q.docker === "string" && NID.test(q.docker) ? q.docker : null,
                  x: int(q.x, -4000, 20000, 0), y: int(q.y, -4000, 20000, 0), w: int(q.w, 0, 16000, 0), h: int(q.h, 0, 16000, 0) };
      if (q.zone && typeof q.zone === "object" && typeof q.zone.host === "string" && NID.test(q.zone.host)) o.zone = { host: q.zone.host, key: String(q.zone.key == null ? "end" : q.zone.key).slice(0, 60) };
      if (typeof q.shown === "boolean") o.shown = q.shown;
      return o;
    };
    out.named = { panels: {}, dockers: {} };
    for (const k of Object.keys(n.panels && typeof n.panels === "object" ? n.panels : {}).slice(0, 120)) { const o = NID.test(k) && one(n.panels[k]); if (o) out.named.panels[k] = o; }
    for (const k of Object.keys(n.dockers && typeof n.dockers === "object" ? n.dockers : {}).slice(0, 60)) { const o = NID.test(k) && one(n.dockers[k]); if (o) out.named.dockers[k] = o; }
  }
  return out;
}
function normalize(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const out = empty();
  out.auto = r.auto !== false;
  const src = r.configs && typeof r.configs === "object" ? r.configs : {};
  for (const k of Object.keys(src).slice(0, MAX_SETS)) {
    const key = DockCfg.keyOf(k.split("+"));
    if (!key || key !== k) continue;
    const vs = (Array.isArray((src[k] || {}).variants) ? src[k].variants : []).map(cleanVariant).filter((v) => v.window.w && v.window.h).slice(0, MAX_VARIANTS);
    if (vs.length) out.configs[key] = { variants: vs };
  }
  return out;
}
function load(base) {
  try { return normalize(JSON.parse(fs.readFileSync(fileOf(base), "utf8"))); } catch { return empty(); }
}
function write(base, cfg) {
  const f = fileOf(base), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), "utf8");
  fs.renameSync(tmp, f);
  return cfg;
}
/** the button: the open set's layout at this window size (the same screen's older one replaced) -> {key, cfg} */
function save(base, snap) {
  const s = snap && typeof snap === "object" ? snap : {};
  const key = DockCfg.keyOf(Array.isArray(s.open) ? s.open : []);
  if (!key) throw bad("no docker is open - open the dockers you work with together first");
  const v = cleanVariant(Object.assign({}, s, { saved: new Date().toISOString() }));
  if (!v.window.w || !v.window.h) throw bad("the window size is missing");
  const cfg = load(base);
  const old = (cfg.configs[key] || { variants: [] }).variants
    .filter((o) => Math.abs(o.window.w - v.window.w) > SAME || Math.abs(o.window.h - v.window.h) > SAME);
  cfg.configs[key] = { variants: [v].concat(old).slice(0, MAX_VARIANTS) };
  return { key, cfg: write(base, cfg) };
}
/** forget a set's layout at one window size (w, h) or all of them */
function remove(base, key, w, h) {
  const cfg = load(base);
  const k = DockCfg.keyOf(String(key || "").split("+"));
  if (!k || !cfg.configs[k]) throw bad("no layout saved for that set", 404);
  if (w && h) {
    const left = cfg.configs[k].variants.filter((o) => Math.abs(o.window.w - w) > SAME || Math.abs(o.window.h - h) > SAME);
    if (left.length) cfg.configs[k].variants = left; else delete cfg.configs[k];
  } else delete cfg.configs[k];
  return write(base, cfg);
}
function settings(base, patch) {
  const cfg = load(base);
  if (patch && typeof patch.auto === "boolean") cfg.auto = patch.auto;
  return write(base, cfg);
}
/** the page with docker.cfg in its head (beside docker_status.json's record) */
function inject(html, cfg) {
  const tag = "<script>window.H3_DOCK_CFG = " + JSON.stringify(cfg).replace(/</g, "\\u003c") + ";</script>";
  const s = String(html || ""), i = s.indexOf("<head>");
  return i >= 0 ? s.slice(0, i + 6) + "\n" + tag + s.slice(i + 6) : tag + s;
}

module.exports = { FILE, MAX_VARIANTS, SAME, fileOf, empty, normalize, cleanVariant, cleanAll, STATUSES, load, save, remove, settings, inject };
