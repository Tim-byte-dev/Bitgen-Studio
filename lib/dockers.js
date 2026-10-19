/* bitGen Studio — dockers.json (2.159.0, by instruction: "allow all
 * horizontal dockers height to be resizable, store the settings in a
 * dockers.json file ... these will be global settings across all projects
 * ... normal state will be the resized height").
 *
 * ONE file at the install root (beside default.settings — global, never
 * per-project): { "docks": { "<id>": { "height": px|null, "state":
 * "normal"|"min"|"max" } } }. Height null means "this dock is elastic"
 * (the preview dock takes whatever the fixed-height docks leave — giving
 * every dock a fixed height would leave the column with nothing to
 * stretch). "min" is the user's collapsed choice; "max" is the maximized
 * view; "normal" reopens AT THE STORED HEIGHT — resizing writes the
 * height, so normal is always the resized height by construction.
 */
"use strict";

const fs = require("fs");
const path = require("path");

/** Every dock the file may speak about — unknown ids are dropped on read
 *  (one spelling, no second vocabulary growing in a config file). */
const DOCKS = ["previewdock", "timelinedock", "videodock", "imageeditdock",
               "comfydock", "musicdock", "stemsdock", "sfxdock", "chatdock", "promptdock", "consoledock"];
// 2.360.0: + sfxdock
// 2.299.1: + stemsdock - its height and open/closed state are remembered too
const STATES = ["normal", "min", "max"];

function fileOf(base) { return path.join(base, "dockers.json"); }

function normalize(raw) {
  const out = { docks: {} };
  const src = (raw && typeof raw === "object" && raw.docks && typeof raw.docks === "object")
    ? raw.docks : {};
  for (const id of DOCKS) {
    const d = src[id];
    if (!d || typeof d !== "object") continue;
    const e = {};
    if (d.height !== undefined && d.height !== null) {
      const h = parseInt(d.height, 10);
      // 60px keeps a header and a sliver of body; 2000 is more monitor than
      // any dock deserves — a junk height must not wedge a dock off screen
      if (Number.isFinite(h)) e.height = Math.max(60, Math.min(2000, h));
    }
    if (STATES.includes(d.state)) e.state = d.state;
    if (Object.keys(e).length) out.docks[id] = e;
  }
  // one maximized dock at a time is the UI's law — the file obeys it too;
  // the LAST max in dock order wins, the rest fall back to normal
  const maxed = DOCKS.filter((id) => out.docks[id] && out.docks[id].state === "max");
  for (const id of maxed.slice(0, -1)) out.docks[id].state = "normal";
  return out;
}

function load(base) {
  try { return normalize(JSON.parse(fs.readFileSync(fileOf(base), "utf8"))); }
  catch { return { docks: {} }; }
}

/** Merge a partial update per dock and write atomically; returns the new
 *  whole. {height: null} explicitly clears a stored height. */
function save(base, partial) {
  const cur = load(base);
  const upd = normalize(partial);
  const clr = (partial && partial.docks) || {};
  for (const id of DOCKS) {
    if (upd.docks[id]) cur.docks[id] = { ...(cur.docks[id] || {}), ...upd.docks[id] };
    if (clr[id] && clr[id].height === null && cur.docks[id]) delete cur.docks[id].height;
    if (cur.docks[id] && !Object.keys(cur.docks[id]).length) delete cur.docks[id];
  }
  const fixed = normalize(cur);
  const tmp = fileOf(base) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(fixed, null, 2), "utf8");
  fs.renameSync(tmp, fileOf(base));
  return fixed;
}

module.exports = { DOCKS, STATES, fileOf, normalize, load, save };
