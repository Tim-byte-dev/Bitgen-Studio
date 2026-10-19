"use strict";
/**
 * bitGen Studio — THE camera preset vocabulary (2.88.0).
 *
 * Turns a handful of picked ids into the clause that gets appended to a prompt.
 * The words themselves live in lib/cameraPresets.json so they can be edited
 * without touching code; this file decides what a valid selection is and how
 * the chosen phrases are ordered and joined.
 *
 * WHY ORDER IS FIXED AND NOT THE ORDER YOU CLICKED. A caption reads
 * "medium close-up, low angle, shot on an 85mm lens, slow dolly push in" —
 * framing, then viewpoint, then glass, then motion. That is the order shot
 * lists are written in and therefore the order these models saw during
 * training, and prompt order measurably matters to all of them. Clicking
 * "85mm" before "close-up" must not produce a different picture from clicking
 * them the other way round; the picker is a set, not a sentence.
 *
 * ONE PICK PER GROUP. Two shot sizes at once is not a richer instruction, it is
 * a contradiction, and a diffusion model handed both will average them into
 * something you did not ask for. The UI enforces it by making a group's tiles
 * behave like radio buttons; phrase() enforces it again here, because a saved
 * style or a hand-edited request should not be able to smuggle one through.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "cameraPresets.json");
/** Fixed output order — see the note above. Not the click order, deliberately. */
const GROUPS = ["shot", "angle", "lens", "move"];

let cache = null;

/** Every group, as stored. Read once and kept; the file does not change while
 *  the app runs, and the picker asks for this on every open. */
function all() {
  if (cache) return cache;
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { raw = {}; }                       // a broken file must not stop a render
  const out = {};
  for (const g of GROUPS) {
    out[g] = (Array.isArray(raw[g]) ? raw[g] : []).filter(
      (e) => e && typeof e.id === "string" && typeof e.text === "string");
  }
  cache = out;
  return out;
}

/**
 * The presets offered for one mode.
 *
 * A STILL HAS NO CAMERA MOVE. Offering "slow dolly push in" for an image is an
 * instruction a text-to-image model can only read as motion blur, so the whole
 * group is withheld rather than shown and ignored — a control that does nothing
 * teaches people the picker is decorative.
 */
function list(mode = "video") {
  const a = all();
  const out = {};
  for (const g of GROUPS) {
    out[g] = a[g].filter((e) => !(e.video && mode !== "video"));
  }
  return out;
}

/** One entry by id, from any group, or null. */
function find(id) {
  const a = all();
  for (const g of GROUPS) {
    const hit = a[g].find((e) => e.id === id);
    if (hit) return { ...hit, group: g };
  }
  return null;
}

/**
 * The clause for a selection.
 * @param {string[]|object} sel  ids, or {shot,angle,lens,move}
 * @param {string} mode          "video" keeps movements, anything else drops them
 * @returns {string} e.g. "medium close-up, low angle, shot on an 85mm lens"
 */
function phrase(sel, mode = "video") {
  const ids = Array.isArray(sel)
    ? sel
    : GROUPS.map((g) => (sel && sel[g]) || "").filter(Boolean);
  const picked = {};
  for (const id of ids) {
    const e = find(id);
    if (!e) continue;                                  // unknown id: ignored
    if (e.video && mode !== "video") continue;         // no movement on a still
    if (!picked[e.group]) picked[e.group] = e;         // first wins, one per group
  }
  return GROUPS.map((g) => picked[g] && picked[g].text).filter(Boolean).join(", ");
}

module.exports = { GROUPS, all, list, find, phrase, FILE };
