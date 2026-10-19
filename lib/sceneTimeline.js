// bitGen Studio — RENDERED SCENES ONTO THE TIMELINE DOCK (2.291.0).
//
// Tim (verbatim): "remove the ovpm timeline, we will use our timeline
// docker, after each scene is generated add it to a new video layer in
// our timeline docker at the start position set in the video docker
// scene".
//
// The timeline is CLIENT state (the page's `tl`, saved per browser and
// per named timeline), so the server never writes it behind the page's
// back - a page-held timeline would overwrite that on its next save. The
// server's part is the TRUTH about what just rendered and WHERE it goes:
//   markRendered  - a take that has just landed is flagged tl_pending with
//                   its tl_start (seconds on the timeline) and tl_dur
//                   (the take's probed length);
//   placed        - the page acknowledges it put the take on a new layer,
//                   so a reload or a second window never places it twice.
// Only takes rendered from 2.291.0 on carry the flag - opening an older
// project never floods the timeline with its old takes.
//
// WHERE (2.309.0, Tim: "when adding the scene to the timeline, add it from
// the end of the previous scene so the video can continue, take duration
// of each scene into consideration remembering that the duration for each
// scene could be different"): END TO END. Scene n starts where the scene
// before it ENDS - each earlier scene counted at its REAL take's length
// (probed from the file; a trimmed first frame or a longer take is exactly
// what the timeline gets), else its audio window's length, else its frame
// count at 24 fps. Only the FIRST scene keeps a typed start input (else 0).
// The page goes one better when it can: the previous scene's clip as it
// sits on the timeline NOW (moved or trimmed by hand) - see tlPlaceScene.
// The render queue's song window (windowFor) is unchanged.
const fs = require("fs");
const path = require("path");
const core = require("./core");
const scenes = require("./scenes");

const FPS = 24;
const r3 = (x) => Math.round(x * 1000) / 1000;

/** The scene's audio window {start, dur, from} - "scene" (its own inputs),
 *  "seg" (the board song's .seg slot) or null (no window). */
function windowFor(st, n) {
  const r = scenes.at(st, n);
  if (!r) return { start: null, dur: null, from: null };
  let a0 = Number.isFinite(r.audio_start) ? r.audio_start : null;
  let d0 = Number.isFinite(r.audio_dur) ? r.audio_dur : null;
  let from = a0 !== null ? "scene" : null;
  if ((a0 === null || d0 === null) && st.audio) {
    try {
      const sm = require("./stems").segments(path.basename(st.audio));
      if (sm && sm.durations && sm.durations[r.n - 1] > 0) {
        let acc = 0;
        for (let q = 0; q < r.n - 1; q++) acc += sm.durations[q];
        if (a0 === null) { a0 = acc; from = "seg"; }
        if (d0 === null) d0 = sm.durations[r.n - 1];
      }
    } catch { /* no map - no window */ }
  }
  return { start: a0, dur: d0, from };
}

/** A scene's length on the timeline, in seconds: its take's REAL length
 *  (probed), else its audio window's, else frames / 24. */
const _probed = new Map();       // path -> {mtime, dur}: a board poll never re-probes
function takeDur(st, r, project) {
  if (r.output) {
    try {
      const p = path.join(core.projDir(project || core.getProject()), "video", path.basename(r.output));
      const mt = fs.statSync(p).mtimeMs;
      const c = _probed.get(p);
      if (c && c.mtime === mt) return c.dur;
      const d = core.probeDuration ? core.probeDuration(p) : null;
      if (Number.isFinite(d) && d > 0) { _probed.set(p, { mtime: mt, dur: d }); return d; }
    } catch { /* the take is gone - fall through */ }
  }
  const w = windowFor(st, r.n);
  if (Number.isFinite(w.dur) && w.dur > 0) return w.dur;
  return (Number.isFinite(r.length) ? r.length : 0) / FPS;
}

/** Where scene n starts on the timeline, in seconds (see the header): the
 *  end of the scene before it. */
/** 2.377.0 (Tim: "is the render starting at the same time marker as the song, ie if the scene starts at 15.5
 *  seconds, will it sync with the song at the same time"): the RENDER always takes the song from the scene's start
 *  (windowFor - 15.5 s in, for 15.5 s); the TIMELINE used to put each take where the take before it ENDS (2.309.0),
 *  and a take is snapped to the model's 17-frame grid, so it could sit a few frames off its song time - more with
 *  every scene, and a typed start (25 s) was ignored. With a board song a take now lands AT its song time (the
 *  song's window start), so the picture and the song on the timeline stay together. Settings ui.tl_scene_song_sync
 *  = false (Timeline settings) brings back the end-to-end rule. */
function songSync() {
  try { return ((core.getConfig() || {}).ui || {}).tl_scene_song_sync !== false; } catch { return true; }
}
function startFor(st, n, project) {
  const k = parseInt(n, 10);
  if (st && st.audio && songSync()) {
    const w = windowFor(st, k);
    if (Number.isFinite(w.start)) return { start: r3(Math.max(0, w.start)), from: "song" };
  }
  const list = (st.list || []).slice().sort((a, b) => a.n - b.n);
  const first = list[0];
  let acc = 0, from = "sequence";
  if (first) {
    const w0 = windowFor(st, first.n);
    if (w0.from === "scene" && w0.start !== null) acc = Math.max(0, w0.start);
    if (first.n === k) return { start: r3(acc), from: w0.from === "scene" ? "scene" : "sequence" };
  }
  for (const x of list) {
    if (x.n >= k) break;
    acc += takeDur(st, x, project);
  }
  return { start: r3(acc), from };
}

/** A take just landed for scene n: flag it for the timeline. */
function markRendered(st, n, project) {
  const r = scenes.at(st, n);
  if (!r || !r.output) return st;
  const s = startFor(st, n, project);
  r.tl_pending = true;
  r.tl_start = s.start;
  r.tl_from = s.from;
  let dur = null;
  try {
    const p = path.join(core.projDir(project || core.getProject()), "video",
                        path.basename(r.output));
    if (fs.existsSync(p) && core.probeDuration) dur = core.probeDuration(p);
  } catch { /* no probe - the page falls back to length/24 */ }
  r.tl_dur = Number.isFinite(dur) && dur > 0 ? r3(dur)
    : (Number.isFinite(r.length) ? r3(r.length / FPS) : undefined);
  return st;
}

/** The page put scene n's take on the timeline: clear the flag - but only
 *  for the take it names (a newer render in the meantime stays pending). */
function placed(st, n, output) {
  const r = scenes.at(st, n);
  if (!r) return { state: st, changed: false, error: "no such scene" };
  if (!r.tl_pending) return { state: st, changed: false };
  if (output && path.basename(String(output)) !== path.basename(String(r.output || "")))
    return { state: st, changed: false, error: "a newer take is pending for this scene" };
  r.tl_pending = undefined;
  return { state: st, changed: true };
}

module.exports = { windowFor, startFor, takeDur, markRendered, placed, songSync, FPS };
