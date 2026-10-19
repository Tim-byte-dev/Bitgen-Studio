/* bitGen Studio — docker_status.json (2.381.0, by instruction).
 *
 * Tim (verbatim): "create a file for docker status - docker_status.json / keep docker open, closed, hidden, height,
 * width,max-height,max-width, maximized values in this file / when a docker is open resize other open dockers to
 * their max height, add a pin button to the left of each docker. if pin is toggled, max-height is set at the current
 * height of the docker, if toggled again max-height = 0 so user can select any height they want for the docker until
 * the height is pinned. / the height and the width of the dockers will be the current height, this will be loaded
 * first. if maximized the docker will expand to maximum height unless other dockers are open. if other dockers are
 * open they will expand to their height or max-height(the lesser value). All dockers will be able to be resized if
 * they are open even if they are maximized"
 *
 * ONE file at the install root (global, the same layout in every project), and THE authority for the dock layout:
 *
 *   { "version": 1, "docks": {
 *       "timelinedock": { "state": "open", "hidden": false, "height": 150, "width": 980,
 *                         "max_height": 0, "max_width": 0, "maximized": false },
 *       "ldock":        { "state": "open", "hidden": false, "height": 1040, "width": 300,
 *                         "max_height": 0, "max_width": 0, "maximized": false }, ... } }
 *
 *   state       "open" | "closed"  - a bottom dock's header-click collapse (side docks are always "open")
 *   hidden      the status-bar toggle: the whole dock, header included, is gone
 *   height      the dock's current height (px) - for a side dock, what it measured
 *   width       the dock's current width (px)  - for a bottom dock, what it measured
 *   max_height  📌 pinned: the most the dock may be (0 = unpinned, any height)
 *   max_width   📌 pinned on a side dock: the most it may be (0 = unpinned)
 *   maximized   one bottom dock at a time; it takes the room the other OPEN docks leave
 *
 * The page gets the record IN ITS HEAD (inject(): window.H3_DOCK_STATUS) so the layout is applied before anything
 * else paints; GET / POST /api/docker-status (routes/dockerStatus.js) read and merge it.
 *
 * First run: there is no file yet, so the older two records are folded in once (ui.docks in the settings file,
 * 2.103.0, then dockers.json, 2.159.0, which won over it) and the file is written. After that only this file is read.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const BOTTOM = ["previewdock", "timelinedock", "videodock", "imageeditdock", "comfydock", "musicdock", "stemsdock",
                "sfxdock", "chatdock", "promptdock", "consoledock"];
const SIDE = ["ldock", "refs", "assets", "qdock", "rdock"];
const DOCKS = BOTTOM.concat(SIDE);
const HEIGHT = { previewdock: 300, timelinedock: 150, videodock: 280, imageeditdock: 320, comfydock: 420, musicdock: 170,
                 stemsdock: 240, sfxdock: 220, chatdock: 200, promptdock: 120, consoledock: 190 };
const WIDTH = { ldock: 300, refs: 260, assets: 260, qdock: 200, rdock: 300 };
const CLOSED = ["chatdock", "consoledock", "imageeditdock", "comfydock"];   // shipped closed (closed until asked for)
const H = { min: 30, max: 4000 };
const W = { min: 140, max: 640 };                                           // a side dock's drag range

/* 2.389.0 (Tim: "make our prompt docker floating but allow user to snap to another docker - a drag and drop snap"):
   the prompt docker FLOATS (ext/promptdock/pfloat.js) - floating (default true), where (x, y; -1 = not yet placed),
   its floating size (float_w, float_h), or the docker it was dropped on (dock_to + dock_side: top | bottom | left |
   right) and its width beside it (dock_w) */
const FLOATING = ["promptdock"];
const DOCK_SIDES = ["top", "bottom", "left", "right"];
function floatFields(d, s) {
  d.floating = typeof s.floating === "boolean" ? s.floating : true;
  d.x = int(s.x, -4000, 20000, -1); d.y = int(s.y, -1, 20000, -1);
  d.float_w = int(s.float_w, 0, 8000, 0); d.float_h = int(s.float_h, 0, 8000, 0);
  d.dock_to = typeof s.dock_to === "string" && /^[a-z]{2,20}$/.test(s.dock_to) && s.dock_to !== "promptdock" ? s.dock_to : "";
  d.dock_side = DOCK_SIDES.includes(s.dock_side) ? s.dock_side : "";
  d.dock_w = int(s.dock_w, 0, 4000, 0);
  if (d.floating) d.maximized = false;                  // a floating window is never the column's maximized dock
}
/* 2.393.0 (Tim: "put basic settings dropdown in a floating docker - press s when not typing ... put llm dropdown in a
   floating docker - press l"): the left docker's Basic Settings and LLM tokens sections float in windows of their own
   (static/secfloat.js). floats.<id> = {shown, x, y, w, h} (x / y -1 = not yet placed, w / h 0 = its own size). */
const FLOATS = ["basic", "llmtok", "camera", "negprompt"];   // 2.399.0: + the timeline's 🎥 Camera panel; 2.419.0: + the ⊖ negative prompt
/* 2.398.0 (Tim: "make the basic settings and llm dialogs into dockers with the ability to dock next to another docker
   or within another docker" - static/dockfloat.js): + mode (float | dock | tab), to (the docker's id), side (top /
   bottom / left / right / inside), dw / dh (its docked width / height, 0 = its own), active (the shown tab) */
const FSIDES = ["top", "bottom", "left", "right", "inside", "inline"];   // 2.401.4: inline = in a side docker's own list
const AT_RX = /^[A-Za-z][\w-]{0,40}$/;                                  //   at = the section it sits above ("" = the end)
function floatRec(s) {
  const o = s && typeof s === "object" ? s : {};
  const to = typeof o.to === "string" && /^[A-Za-z][\w-]{0,40}$/.test(o.to) ? o.to : "";
  let mode = ["float", "dock", "tab"].includes(o.mode) ? o.mode : "float";
  if (!to) mode = "float";
  return { shown: o.shown === true, x: int(o.x, -4000, 20000, -1), y: int(o.y, -1, 20000, -1), w: int(o.w, 0, 4000, 0), h: int(o.h, 0, 4000, 0),
           mode, to: mode === "float" ? "" : to, side: mode === "float" ? "" : (FSIDES.includes(o.side) ? o.side : (mode === "tab" ? "inside" : "bottom")),
           dw: int(o.dw, 0, 2000, 0), dh: int(o.dh, 0, 2000, 0), active: o.active === true,
           at: mode !== "float" && o.side === "inline" && typeof o.at === "string" && AT_RX.test(o.at) ? o.at : "" };
}
function floatsOf(src) {
  const f = src && typeof src === "object" ? src : {};
  const out = {};
  for (const id of FLOATS) out[id] = floatRec(f[id]);
  return out;
}
function fileOf(base) { return path.join(base, "docker_status.json"); }
function isSide(id) { return SIDE.includes(id); }
function int(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}
/* a max is 0 (unpinned) or a real size */
function maxOf(v, lo, hi) { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.max(lo, Math.min(hi, n)) : 0; }

function defaultEntry(id) {
  const side = isSide(id);
  return { state: !side && CLOSED.includes(id) ? "closed" : "open", hidden: false,
           height: side ? 0 : HEIGHT[id], width: side ? WIDTH[id] : 0,
           max_height: 0, max_width: 0, maximized: false };
}
function defaults() {
  const docks = {};
  for (const id of DOCKS) { docks[id] = defaultEntry(id); if (FLOATING.includes(id)) floatFields(docks[id], {}); }
  return { version: 1, docks, floats: floatsOf({}) };
}

/** Junk in, a complete valid record out (unknown docks dropped, one maximized dock - the LAST in dock order). */
function normalize(raw) {
  const src = raw && typeof raw === "object" && raw.docks && typeof raw.docks === "object" ? raw.docks : {};
  const out = defaults();
  let maxed = null;
  for (const id of DOCKS) {
    const s = src[id] && typeof src[id] === "object" ? src[id] : {};
    const d = out.docks[id], side = isSide(id);
    if (s.state === "open" || s.state === "closed") d.state = side ? "open" : s.state;
    if (typeof s.hidden === "boolean") d.hidden = s.hidden;
    d.height = int(s.height, side ? 0 : H.min, H.max, d.height);
    d.width = side ? int(s.width, W.min, W.max, d.width) : int(s.width, 0, H.max, d.width);
    d.max_height = side ? 0 : maxOf(s.max_height, H.min, H.max);
    d.max_width = side ? maxOf(s.max_width, W.min, W.max) : 0;
    d.maximized = !side && s.maximized === true;
    if (d.maximized) { if (maxed) out.docks[maxed].maximized = false; maxed = id; }
    if (FLOATING.includes(id)) floatFields(d, s);
  }
  out.floats = floatsOf(raw && raw.floats);
  return out;
}

/** Merge a partial ({docks: {<id>: {...}}}) over a record. The dock the user just maximized wins. */
function merge(current, patch) {
  const cur = normalize(current);
  const p = patch && typeof patch === "object" && patch.docks && typeof patch.docks === "object" ? patch.docks : {};
  const newMax = Object.keys(p).find((id) => BOTTOM.includes(id) && p[id] && p[id].maximized === true);
  if (newMax) for (const id of BOTTOM) if (id !== newMax) cur.docks[id].maximized = false;
  for (const id of Object.keys(p)) {
    if (!cur.docks[id] || !p[id] || typeof p[id] !== "object") continue;
    cur.docks[id] = { ...cur.docks[id], ...p[id] };
  }
  const pf = patch && typeof patch === "object" && patch.floats && typeof patch.floats === "object" ? patch.floats : {};
  for (const id of FLOATS) if (pf[id] && typeof pf[id] === "object") cur.floats[id] = { ...cur.floats[id], ...pf[id] };
  return normalize(cur);
}

/** The first run: the older records folded into the new shape (ui.docks, then dockers.json over it). */
function migrate(base, uiDocks) {
  const rec = defaults();
  const ui = uiDocks && typeof uiDocks === "object" ? uiDocks : {};
  for (const id of DOCKS) {
    const s = ui[id]; if (!s || typeof s !== "object") continue;
    const d = rec.docks[id];
    if (isSide(id)) { if (s.width) d.width = s.width; d.hidden = s.state === "closed"; continue; }
    if (s.height) d.height = s.height;
    if (s.state === "closed") d.state = "closed";
    else if (s.state === "open" || s.state === "max") d.state = "open";
    d.maximized = s.state === "max";
  }
  let old = {};
  try { old = (JSON.parse(fs.readFileSync(path.join(base, "dockers.json"), "utf8")) || {}).docks || {}; } catch { old = {}; }
  for (const id of BOTTOM) {
    const s = old[id]; if (!s || typeof s !== "object") continue;
    const d = rec.docks[id];
    if (Number.isFinite(+s.height) && s.height !== null) d.height = +s.height;
    if (s.state === "min") { d.state = "closed"; d.maximized = false; }
    else if (s.state === "normal") { d.state = "open"; d.maximized = false; }
    else if (s.state === "max") { d.state = "open"; for (const k of BOTTOM) rec.docks[k].maximized = false; d.maximized = true; }
  }
  return normalize(rec);
}

function write(base, rec) {
  const f = fileOf(base), tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 2), "utf8");
  fs.renameSync(tmp, f);
}

/** The record. No file yet -> migrated from the older records and written (opts.uiDocks = the settings' ui.docks). */
function load(base, opts) {
  try { return normalize(JSON.parse(fs.readFileSync(fileOf(base), "utf8"))); }
  catch (e) {
    const rec = migrate(base, opts && opts.uiDocks);
    if (e && e.code === "ENOENT") { try { write(base, rec); } catch { /* read-only install: still answer */ } }
    return rec;
  }
}

/** Merge a partial update and write atomically; returns the whole record. */
function save(base, patch, opts) {
  const rec = merge(load(base, opts), patch);
  write(base, rec);
  return rec;
}

/** The page with the record in its head - read before any other script runs ("this will be loaded first"). */
function inject(html, rec) {
  const tag = "<script>window.H3_DOCK_STATUS = " + JSON.stringify(rec).replace(/</g, "\\u003c") + ";</script>";
  const s = String(html || "");
  const i = s.indexOf("<head>");
  return i >= 0 ? s.slice(0, i + 6) + "\n" + tag + s.slice(i + 6) : tag + s;
}

module.exports = { BOTTOM, SIDE, DOCKS, FLOATS, HEIGHT, WIDTH, H, W, fileOf, defaults, normalize, merge, migrate, load, save, inject };
