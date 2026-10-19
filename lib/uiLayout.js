"use strict";
/**
 * uiLayout.js — DOCK SIZE + STATE IN THE SETTINGS FILE (2.103.0, by instruction).
 *
 * Tim: "write docker size and position into the settings file. For each
 * docker record the last size, position and status (open/close/max), and when
 * bitGen Studio opens it reverts to those sizes."
 *
 * Lives under `ui.docks` in the settings layers (default.settings holds the
 * shipped layout, custom.settings the diff), so it travels with the install
 * instead of hiding in the browser's localStorage — and so a fresh session
 * on another machine, or after an Electron cache wipe, opens the same way.
 *
 *   "ui": { "docks": {
 *     "timelinedock": { "height": 150, "state": "open" },      // bottom docks
 *     "imageeditdock":{ "height": 320, "state": "closed" },    // 2.108.0
 *     "musicdock":    { "height": 170, "state": "closed" },
 *     "chatdock":     { "height": 200, "state": "closed" },
 *     "promptdock":   { "height": 120, "state": "open" },
 *     "consoledock":  { "height": 190, "state": "closed" },    // "max" = maximized
 *     "ldock":  { "width": 300, "state": "open" },              // side docks
 *     "refs":   { "width": 260, "state": "open" },
 *     "assets": { "width": 260, "state": "open" },
 *     "qdock":  { "width": 200, "state": "open" },
 *     "rdock":  { "width": 300, "state": "open" }
 *   } }
 *
 * "Position" for a dock is the splitter position that sets its size — the
 * docks themselves sit in fixed slots. At most ONE bottom dock is "max"; a
 * second one is demoted to "open" on read, because two maximized docks is
 * a layout that cannot be drawn.
 *
 * Nothing here touches the DOM: the client reads the record with
 * GET /api/ui/layout and writes it with POST after every drag / collapse /
 * maximize (debounced), and applies it at boot in applyLayout().
 */
const BOTTOM = { timelinedock: 150, imageeditdock: 320, comfydock: 420, musicdock: 170, stemsdock: 240, sfxdock: 220, chatdock: 200, promptdock: 120, consoledock: 190 };   // 2.299.1: + stemsdock; 2.360.0: + sfxdock
const SIDE = { ldock: 300, refs: 260, assets: 260, qdock: 200, rdock: 300 };
const STATES = ["open", "closed", "max"];
const H = { min: 60, max: 2000 };
const W = { min: 140, max: 640 };

function clampInt(v, lo, hi, dflt) {
  const n = parseInt(v, 10);
  if (!isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

/** The shipped layout (what a first run opens with). */
function defaults() {
  const d = {};
  for (const [k, h] of Object.entries(BOTTOM)) d[k] = { height: h, state: ["chatdock", "consoledock", "imageeditdock", "comfydock"].includes(k) ? "closed" : "open" };
  for (const [k, w] of Object.entries(SIDE)) d[k] = { width: w, state: "open" };
  return d;
}

/** Junk in, a complete valid record out. Unknown docks are dropped. */
function normalize(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = defaults();
  let maxed = null;
  for (const k of Object.keys(BOTTOM)) {
    const s = src[k] || {};
    const state = STATES.includes(s.state) ? s.state : out[k].state;
    out[k] = { height: clampInt(s.height, H.min, H.max, out[k].height), state };
    if (state === "max") { if (maxed) out[k].state = "open"; else maxed = k; }
  }
  for (const k of Object.keys(SIDE)) {
    const s = src[k] || {};
    out[k] = { width: clampInt(s.width, W.min, W.max, out[k].width),
               state: s.state === "closed" ? "closed" : "open" };   // side docks cannot maximize
  }
  return out;
}

/** Merge a partial update (one dock, or a few) over the current record. */
function merge(current, patch) {
  const cur = normalize(current);
  const p = patch && typeof patch === "object" ? patch : {};
  // the dock the user just maximized wins: every other max is demoted first
  const newMax = Object.keys(p).find((k) => k in BOTTOM && p[k] && p[k].state === "max");
  if (newMax) for (const k of Object.keys(BOTTOM)) if (k !== newMax && cur[k].state === "max") cur[k].state = "open";
  for (const k of Object.keys(p)) {
    if (!(k in cur) || !p[k] || typeof p[k] !== "object") continue;
    cur[k] = { ...cur[k], ...p[k] };
  }
  return normalize(cur);
}

module.exports = { BOTTOM, SIDE, STATES, defaults, normalize, merge };
