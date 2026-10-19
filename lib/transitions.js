// bitGen Studio — transition catalogue (Node side).
//
// Reads lib/transitions.json, which scripts/transitions.py reads too. One file,
// two consumers: a transition can never appear in the dropdown without the
// renderer knowing how to draw it, and vice versa.
//
// A transition belongs to a LAYER, not to a clip: it is applied wherever that
// layer's clips meet (V1, which is sequential) or where they begin and end
// (overlay, image and audio layers, which are free-placed). That keeps one
// control meaningful on every kind of track.
const fs = require("fs");
const path = require("path");

const CATALOGUE = path.join(__dirname, "transitions.json");
let cache = null;

function catalogue() {
  if (!cache) cache = JSON.parse(fs.readFileSync(CATALOGUE, "utf8"));
  return cache;
}

const list = () => catalogue().transitions;
const byId = (id) => list().find((t) => t.id === id) || null;

/** A layer's transition, coerced to something the worker can always act on.
 *  Unknown ids fall back to a cut rather than throwing: a timeline saved by a
 *  newer build must still open, just without the transition it did not keep. */
function normalize(t) {
  const c = catalogue();
  const raw = t && typeof t === "object" ? t : {};
  const hit = byId(String(raw.type || "none"));
  const d = Number(raw.dur);
  return {
    type: hit ? hit.id : "none",
    dur: Math.min(c.max_duration,
                  Math.max(c.min_duration,
                           isFinite(d) && d > 0 ? d : c.default_duration)),
  };
}

/** True when this transition would actually change the picture — the worker
 *  uses it to keep the cheap straight-concat path for cuts. */
const isActive = (t) => {
  const n = normalize(t);
  const hit = byId(n.type);
  return !!(hit && hit.xfade);
};

module.exports = {
  catalogue, list, byId, normalize, isActive,
  defaults: () => ({
    default_duration: catalogue().default_duration,
    min_duration: catalogue().min_duration,
    max_duration: catalogue().max_duration,
  }),
};
