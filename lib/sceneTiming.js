// bitGen Studio — ONE CONTIGUOUS TIMELINE OF SCENES (2.297.0).
//
// Tim (verbatim): "adjust the timing for all the scenes if the start time
// or duration changes for any scene".
//
// Every scene's window (start + duration into the board song) is made
// explicit, then the board is kept CONTIGUOUS around the scene that
// changed:
//   - a new START for scene n: the scene before it ends where n now starts
//     (its duration follows; a start earlier than the previous scene's own
//     start is clamped to it + 0.1 s), and
//   - a new DURATION (or start) for scene n: every later scene starts where
//     the one before it ends, keeping its own duration.
// A scene with no window of its own takes its .seg slot (sceneTimeline.
// windowFor), else its length at 24 fps - so a board staged from a song and
// a hand-built board both ripple. Inserting a scene is a duration change of
// the new scene (it pushes the rest along).
const scenes = require("./scenes");
const sceneTimeline = require("./sceneTimeline");

const FPS = 24;
const r3 = (x) => Math.round(x * 1000) / 1000;

function ordered(st) {
  return (st.list || []).slice().sort((a, b) => a.n - b.n);
}

/** Write an explicit window on every row (start, dur), end-to-end where
 *  nothing says otherwise. */
function materialize(st) {
  let t = 0;
  for (const r of ordered(st)) {
    const w = sceneTimeline.windowFor(st, r.n);
    const dur = Number.isFinite(w.dur) && w.dur > 0 ? w.dur
      : (Number.isFinite(r.length) ? r.length / FPS : 5);
    const start = Number.isFinite(w.start) ? w.start : t;
    r.audio_start = r3(Math.max(0, start));
    r.audio_dur = r3(Math.max(0.1, dur));
    t = r.audio_start + r.audio_dur;
  }
  return st;
}

/** Scene n's window changed (its row already holds the new values): make
 *  the board contiguous around it. Returns {state, changed: [n...]} - the
 *  OTHER scenes whose window moved. */
function ripple(st, n, what) {
  const rows = ordered(st);
  const i = rows.findIndex((r) => r.n === parseInt(n, 10));
  if (i < 0) return { state: st, changed: [] };
  // the changed row's own values are the truth; the others materialize
  const keep = { start: rows[i].audio_start, dur: rows[i].audio_dur };
  materialize(st);
  if (Number.isFinite(keep.start)) rows[i].audio_start = r3(Math.max(0, keep.start));
  if (Number.isFinite(keep.dur) && keep.dur > 0) rows[i].audio_dur = r3(keep.dur);
  const before = rows.map((r) => [r.audio_start, r.audio_dur]);
  if (what && what.start && i > 0) {
    const p = rows[i - 1];
    if (rows[i].audio_start <= p.audio_start) rows[i].audio_start = r3(p.audio_start + 0.1);
    p.audio_dur = r3(rows[i].audio_start - p.audio_start);
  }
  for (let k = i + 1; k < rows.length; k++)
    rows[k].audio_start = r3(rows[k - 1].audio_start + rows[k - 1].audio_dur);
  const changed = rows.filter((r, k) => k !== i
    && (before[k][0] !== r.audio_start || before[k][1] !== r.audio_dur)).map((r) => r.n);
  return { state: st, changed };
}

/** A song scene's clip length follows its duration: frames at 24 fps,
 *  snapped to the H3 grid, capped at the single-run ceiling. */
function framesFor(dur, ceiling) {
  const snap = require("./screenplay").snapLength;
  const f = snap(Math.round(Math.max(0.1, dur) * FPS));
  return Math.min(ceiling || 362, f);
}

module.exports = { materialize, ripple, framesFor, FPS };
