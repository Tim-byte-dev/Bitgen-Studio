// bitGen Studio — lib/timeEstimate.js (2.908.0): ⏱ HOW LONG A RENDER WILL TAKE, from this computer's own renders.
//
// Tim: "the time estimate will be good" (asked "how long does h3 long 40s take to render a 37 sec video at 540p?" - no
// render had been timed on real hardware, so the answer has to come from his own machine).
//   Every finished render is already in 📊 Statistics (lib/genStats.js: startup / generation / total). 2.908.0 adds what
//   the render WAS (features: style, size, frames, steps, cfg) to each line, and this file reads them back:
//     the same style's last renders (else the same kind - video / picture / song - marked "other styles")
//     each one's generation time scaled by the work asked: pixels x frames x steps x (CFG above 1 = two passes)
//     + its startup (the model already loaded = the quickest startup; a change of style = the usual one)
//   -> {ms, gen_ms, startup_ms, lo, hi, n, basis, warm}. No renders yet = null (the page says so).
//   An estimate, said as one: diffusion time is not exactly linear in frames, a pod / another graphics card differs.
// Pure (scripts/test-908.js): features, ratio, estimate, words, median.
"use strict";

const num = (v) => { const n = +v; return Number.isFinite(n) ? n : 0; };
/** a job's params (or the page's request) -> what the render was. p.est (a route's own hint) wins */
function features(p) {
  const x = p || {}, e = x.est || {};
  const st = x.video_style || (x.style && typeof x.style === "object" ? x.style : null) || {};
  const style = String(e.style || x.video_style_id || x.style_id || st.id || "");
  const w = num(e.w || x.width || x.w), h = num(e.h || x.height || x.h);
  const fps = num(x.fps) || 24;
  let frames = num(e.frames || x.frames || x.length);
  if (!frames && num(x.seconds)) frames = Math.round(num(x.seconds) * fps);
  // 2.910.0: a song's length is its max_duration (a song job carries no frames) - counted in the same 24-a-second units
  if (!frames && num(x.max_duration || (st && st.max_duration))) frames = Math.round(num(x.max_duration || st.max_duration) * 24);
  const mode = String(x.mode || e.mode || "");
  const kind = String(e.kind || (mode === "image" || /^img|image/.test(mode) ? "image" : /song|music|yue|ace/.test(mode) ? "music" : "video"));
  if (kind === "image") frames = 1;
  const steps = num(e.steps || x.steps || (x.basic && x.basic.steps));
  const cfgRaw = e.cfg != null ? e.cfg : x.cfg != null ? x.cfg : x.basic && x.basic.cfg != null ? x.basic.cfg : null;
  const out = { style, kind, mode, w: Math.round(w), h: Math.round(h), frames: Math.round(frames), steps: Math.round(steps) };
  if (cfgRaw != null && cfgRaw !== "" && Number.isFinite(+cfgRaw)) out.cfg = Math.round(+cfgRaw * 100) / 100;
  return out;
}
/** how much more work `a` is than `b` (pure): a part either side does not know counts as the same */
function ratio(a, b) {
  let r = 1;
  if (a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0) r *= (a.w * a.h) / (b.w * b.h);
  if (a.frames > 0 && b.frames > 0) r *= a.frames / b.frames;
  if (a.steps > 0 && b.steps > 0) r *= a.steps / b.steps;
  const pa = a.cfg != null && a.cfg > 1 ? 2 : 1, pb = b.cfg != null && b.cfg > 1 ? 2 : 1;
  if (a.cfg != null && b.cfg != null) r *= pa / pb;
  return r;
}
function median(a) {
  const s = (a || []).filter((v) => Number.isFinite(v)).slice().sort((x, y) => x - y);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
const WARM_MS = 20 * 60000;     // the same style rendered within 20 minutes = its model is likely still loaded
const TAKE = 8;                 // the most recent renders that count
/** gens (genStats lines, any order) + the request (features + {name, where}) -> the estimate or null (pure) */
function estimate(gens, req, now) {
  const q = req || {};
  const t = now || Date.now();
  const ok = (gens || []).filter((g) => g && g.k !== "prep" && g.status === "done" && g.gen_ms > 0 && !g.never_started
    && (!q.where || (g.where || "local") === q.where)).sort((a, b) => b.t - a.t);
  const sameStyle = (g) => (q.style && g.est && g.est.style === q.style) || (q.name && g.what && g.what === q.name);
  let pool = ok.filter(sameStyle), basis = "style";
  if (!pool.length) { pool = ok.filter((g) => g.est && (g.est.kind || "video") === (q.kind || "video")); basis = "kind"; }
  if (!pool.length) return null;
  pool = pool.slice(0, TAKE);
  const scaled = pool.map((g) => Math.round(g.gen_ms * (g.est ? ratio(q, g.est) : 1)));
  const sized = pool.filter((g) => g.est && g.est.w > 0).length;
  const last = ok[0];
  const warm = !!(last && sameStyle(last) && t - last.t < WARM_MS);
  const starts = pool.map((g) => g.startup_ms || 0);
  const startup = warm ? Math.min.apply(null, starts) : median(starts);
  const gen = median(scaled);
  return { ms: gen + startup, gen_ms: gen, startup_ms: startup, lo: Math.min.apply(null, scaled) + startup, hi: Math.max.apply(null, scaled) + startup,
           n: pool.length, sized, basis, warm, what: pool[0].what || "" };
}
/** a duration in words: about 40 s / about 6 min / about 1 h 20 min (pure) */
function dur(ms) {
  const s = Math.max(1, Math.round((+ms || 0) / 1000));
  if (s < 60) return `${Math.max(5, Math.round(s / 5) * 5)} s`;
  const m = s / 60;
  if (m < 10) return `${Math.round(m * 2) / 2} min`.replace(".5 min", "½ min");
  if (m < 60) return `${Math.round(m)} min`;
  const hh = Math.floor(m / 60), mm = Math.round(m - hh * 60);
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}
/** the page's line + its tooltip (pure) */
function words(e, name) {
  if (!e) return { text: "⏱ no time yet - the first render of this style here sets it", title: "Estimated from this computer's own renders (📊 Statistics) - none of this kind yet" };
  const range = e.n >= 3 && e.hi > e.lo * 1.25 ? ` (${dur(e.lo)} – ${dur(e.hi)})` : "";
  const from = e.basis === "style" ? `${e.n} render${e.n > 1 ? "s" : ""} of ${name || e.what || "this style"} here` : `${e.n} render${e.n > 1 ? "s" : ""} of other styles - none of this one yet`;
  return { text: `⏱ about ${dur(e.ms)}${range}`,
           title: `Estimated from ${from}, scaled to this size, length, steps and CFG. Generation about ${dur(e.gen_ms)}, `
             + (e.warm ? `startup about ${dur(e.startup_ms)} (the model is likely still loaded)` : `startup about ${dur(e.startup_ms)} (loading the model)`)
             + (e.sized < e.n ? `. ${e.n - e.sized} of them from before 2.908.0 (no size recorded - taken as they were)` : "") };
}

/* ---------------- live */
function forRequest(req) {
  const q = features(req || {});
  q.name = String((req && req.name) || "");
  q.where = String((req && req.where) || "");
  if (req && req.kind) q.kind = String(req.kind);
  let gens = [];
  try {
    const d = new Date(Date.now() - 92 * 86400000);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    gens = require("./genStats").query(from, "").gens;
  } catch { gens = []; }
  const e = estimate(gens, q, Date.now());
  return Object.assign({ estimate: e }, words(e, q.name));
}
module.exports = { features, ratio, median, estimate, dur, words, forRequest, WARM_MS, TAKE };
