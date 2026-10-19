// bitGen Studio — frame-grid math (JS mirror of the planner in worker.py).
// Two grids: '4n1' (sd-cli engine, ceiling 361) and '17k5' (native ComfyUI
// MiniMaxH3 nodes: 5, 22, 39 ... 345, 362; ceiling 362 = 15.08s). 5 sits on
// both grids.
const FPS = 24;
const MAX_SINGLE_RUN = 361;
const MAX_SINGLE_RUN_COMFY = 362;    // 17*21+5

function snap4n1Up(n) {
  if (n < 1) n = 1;
  const r = (n - 1) % 4;
  return r === 0 ? n : n + (4 - r);
}
function snap4n1Down(n) {
  if (n < 1) return 1;
  return n - ((n - 1) % 4);
}
function snap17k5Up(n) {
  if (n <= 5) return 5;
  const r = n % 17;
  return r === 5 ? n : n + ((5 - r + 17) % 17);
}
function snap17k5Down(n) {
  if (n <= 5) return 5;
  const m = n - ((n % 17 - 5 + 17) % 17);
  return m >= 5 ? m : 5;
}

// max (2.503.0): the most a caller may ASK for - the H3 grid's long single run (lib/h3Long.LONG_CEILING, 17*42+5);
// `ceiling` stays the normal one every plan uses unless a ceiling is passed.
const GRIDS = {
  "4n1":  { up: snap4n1Up,  down: snap4n1Down,  ceiling: MAX_SINGLE_RUN, max: MAX_SINGLE_RUN },
  "17k5": { up: snap17k5Up, down: snap17k5Down, ceiling: MAX_SINGLE_RUN_COMFY, max: 719 },
};
const gridFor = (engineBackend) => (engineBackend === "comfy" ? "17k5" : "4n1");

// fl2va hand-off: chunks 2+ start from the previous chunk's last frame, so
// each later chunk contributes (frames - 1) unique frames; the seam duplicate
// is dropped at join time. Final chunk snapped UP (snapping down caused a
// wasteful extra chunk); overshoot (<=3 on 4n+1, <=16 on 17k+5) is absorbed
// by the end trim.
// force: split even when the target fits one run (low-VRAM escape hatch).
// ceiling (2.99.0): the single-run ceiling to plan against, when lower than
// the grid's own (the VRAM ceiling the worker learned). Mirrored in worker.py
// plan_chunks(..., ceiling=).
function planChunks(targetFrames, maxChunk, grid, force, ceiling) {
  const G = GRIDS[grid] || GRIDS["4n1"];
  const CEIL = ceiling > 0 ? Math.max(5, Math.min(G.down(ceiling), G.max || G.ceiling)) : G.ceiling;
  // Anything that fits ONE generation is never segmented, whatever the
  // segment length says — a 15 s clip is a single run both engines handle
  // well, and splitting it would only add seams and identity drift.
  if (!force && targetFrames <= CEIL) {
    const c = G.up(targetFrames);
    return { chunks: [c], unique: c, trim: c - targetFrames, maxChunk: CEIL,
             fitsSingle: true };
  }
  maxChunk = Math.max(5, Math.min(G.down(maxChunk || CEIL), CEIL));
  if (targetFrames <= maxChunk) {
    const c = G.up(targetFrames);
    return { chunks: [c], unique: c, trim: c - targetFrames, maxChunk };
  }
  const chunks = [maxChunk];
  let unique = maxChunk;
  const per = maxChunk - 1;
  const remaining = targetFrames - maxChunk;
  const nMore = Math.ceil(remaining / per);
  for (let i = 0; i < nMore - 1; i++) { chunks.push(maxChunk); unique += per; }
  let last = G.up(remaining - per * (nMore - 1) + 1);
  if (last > maxChunk) last = maxChunk;
  chunks.push(last);
  unique += last - 1;
  return { chunks, unique, trim: unique - targetFrames, maxChunk };
}

// Prefer ONE generation whenever the target fits the ceiling — a single run
// keeps character consistency; fl2va hand-off can drift identity per chunk.
function resolveAuto(requested, targetFrames, ceiling) {
  if (requested !== 'auto') return requested;
  return targetFrames <= (ceiling || MAX_SINGLE_RUN) ? 'single' : 'chunked';
}

const framesForSeconds = (sec) => Math.round(sec * FPS);

// ---- music video: split a song into shots that sit on the frame grid ----
// Each shot keeps exactly round(seconds*24) frames; shots after the first are
// generated one frame longer so the seam duplicate dropped at join time still
// leaves the shot its full length. Returns the per-shot keep/gen counts so the
// UI and the worker agree before anything renders.
const MUSIC_MAX_FRAMES = 300 * 24;          // 5 minutes

function planShots(shotSeconds, grid) {
  const G = GRIDS[grid] || GRIDS["4n1"];
  const maxShot = (G.ceiling - 1) / FPS;    // one frame reserved for the seam
  const shots = shotSeconds.map((sec, i) => {
    const keep = Math.max(1, Math.round(sec * FPS));
    const gen = G.up(keep + (i ? 1 : 0));
    return { index: i + 1, seconds: keep / FPS, keep, gen,
             overCeiling: gen > G.ceiling };
  });
  const frames = shots.reduce((a, s) => a + s.keep, 0);
  return { shots, frames, seconds: frames / FPS, grid,
           maxShotSeconds: maxShot,
           overCap: frames > MUSIC_MAX_FRAMES,
           maxFrames: MUSIC_MAX_FRAMES };
}

// evenly split a song into `len` shots of at most `per` seconds (default 15),
// with the remainder as a final shorter shot — the 0-15 / 15-30 / … pattern
function splitSong(songSeconds, per, grid) {
  per = Math.min(per || 15, ((GRIDS[grid] || GRIDS["4n1"]).ceiling - 1) / FPS);
  const total = Math.min(songSeconds, MUSIC_MAX_FRAMES / FPS);
  const out = [];
  for (let t = 0; t < total - 1e-6; t += per) out.push(Math.min(per, total - t));
  return out;
}

module.exports = { FPS, MAX_SINGLE_RUN, MAX_SINGLE_RUN_COMFY, GRIDS, gridFor,
                   snap4n1Up, snap4n1Down, snap17k5Up, snap17k5Down,
                   planChunks, framesForSeconds, resolveAuto,
                   planShots, splitSong, MUSIC_MAX_FRAMES };
