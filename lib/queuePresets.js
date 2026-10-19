// bitGen Studio — lib/queuePresets.js (2.518.0): QUEUE PRESETS - how the job queue runs (the menu bar's ⏱ dropdown).
// Tim (verbatim): "add a dropdown on the main menubar for queue presets"
//
//   A preset is   power_pct  the GPUs' power limit as a % of each card's default limit (null = leave it alone)
//                 cooldown_s seconds the queue waits after a job before it starts the next
//                 pause_c    a GPU at this temperature (°C) or hotter holds the next job ...
//                 resume_c   ... until every GPU is back down to this
//   Normal / Quiet (overnight) / Eco / Cool-down / Max performance + Custom (its own four numbers)
//   config.queue = {preset, custom: {power_pct, cooldown_s, pause_c, resume_c}} (custom.settings)
//
//   gate()        core.pump asks before it starts a job: {wait: ms, why} = not yet (a cool-down, a hot GPU), null = go.
//                 A hold for heat gives up after 20 min (a stuck sensor must never stop the queue for good) and says so.
//   finished()    core.js tells it a job ended (the cool-down starts then)
//   applyPower()  nvidia-smi -i <n> -pl <W> on every NVIDIA card - it needs the app run as administrator (Windows) /
//                 root (Linux); without that it says so and the rest of the preset still works. A limit lasts until
//                 the computer restarts (or Normal puts the card's default back).
//   warnings()    "GPU 0 is 86 °C", "GPU 0 is probably throttling" (hot, busy and its clock well under its top clock)
// Pure (scripts/test-queue518.js): PRESETS, resolve, gate, wattsFor, warningsFor, parseLimits.
"use strict";
const { spawn } = require("child_process");

const PRESETS = [
  { id: "normal", label: "Normal", power_pct: null, cooldown_s: 0, pause_c: 0, resume_c: 0,
    hint: "Jobs run back to back at the cards' own power limit" },
  { id: "quiet", label: "Quiet (overnight)", power_pct: 70, cooldown_s: 20, pause_c: 80, resume_c: 70,
    hint: "70 % power limit, 20 s rest between jobs, waits while a GPU is 80 °C or hotter (until 70 °C) - cooler, quieter, a little slower" },
  { id: "eco", label: "Eco", power_pct: 60, cooldown_s: 10, pause_c: 78, resume_c: 68,
    hint: "60 % power limit - the least energy per job, about 15-25 % slower" },
  { id: "cool", label: "Cool-down between jobs", power_pct: null, cooldown_s: 60, pause_c: 75, resume_c: 65,
    hint: "Full power, a minute's rest after every job and waits while a GPU is 75 °C or hotter" },
  { id: "max", label: "Max performance", power_pct: 100, cooldown_s: 0, pause_c: 90, resume_c: 80,
    hint: "The cards' default limit put back, no rest; only waits if a GPU reaches 90 °C" },
  { id: "custom", label: "Custom", power_pct: null, cooldown_s: 0, pause_c: 0, resume_c: 0,
    hint: "Your own power limit, rest and temperatures" },
];
const MAX_HOLD_MS = 20 * 60 * 1000;
const clampN = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };

/** config.queue -> the preset in force {id, label, power_pct, cooldown_s, pause_c, resume_c} */
function resolve(q) {
  const c = q || {};
  const base = PRESETS.find((p) => p.id === c.preset) || PRESETS[0];
  const out = Object.assign({}, base);
  if (base.id === "custom") {
    const u = c.custom || {};
    const pct = u.power_pct == null || u.power_pct === "" ? null : clampN(u.power_pct, 30, 110, null);
    out.power_pct = pct;
    out.cooldown_s = clampN(u.cooldown_s, 0, 3600, 0);
    out.pause_c = clampN(u.pause_c, 0, 100, 0);
    out.resume_c = clampN(u.resume_c, 0, 100, 0);
  }
  if (out.pause_c > 0 && !(out.resume_c > 0 && out.resume_c < out.pause_c)) out.resume_c = Math.max(30, out.pause_c - 10);
  return out;
}

/** may the queue start its next job? st {lastDone, hotSince, hot} (kept between calls), gpus [{index, temp_c}]
 *  -> {wait, why, hot} or null (go). Pure: `now` is passed in. */
function gate(preset, st, gpus, now) {
  const p = preset || PRESETS[0], s = st || {};
  if (p.cooldown_s > 0 && s.lastDone) {
    const left = s.lastDone + p.cooldown_s * 1000 - now;
    if (left > 0) return { wait: Math.min(left, 5000), left_s: Math.ceil(left / 1000), why: `rest between jobs (${p.label}): ${Math.ceil(left / 1000)} s left` };
  }
  if (p.pause_c > 0) {
    const known = (gpus || []).filter((g) => g && g.temp_c != null);
    const hottest = known.reduce((m, g) => (m && m.temp_c >= g.temp_c ? m : g), null);
    if (hottest) {
      const limit = p.resume_c;                                // it waits until the card is back down to this
      const tooHot = s.hot ? hottest.temp_c > p.resume_c : hottest.temp_c >= p.pause_c;
      if (tooHot) {
        const since = s.hotSince || now;
        if (now - since >= MAX_HOLD_MS) return null;           // gave up waiting - core logs it (gaveUp)
        return { wait: 5000, hot: true, since, why: `GPU ${hottest.index} is ${Math.round(hottest.temp_c)} °C - waiting until it is ${limit} °C (${p.label})` };
      }
    }
  }
  return null;
}

/** watts for pct % of a card's default limit, inside its min / max -> integer W | null */
function wattsFor(pct, lim) {
  if (pct == null || !lim || !(lim.default_w > 0)) return null;
  let w = Math.round(lim.default_w * pct / 100);
  if (lim.min_w > 0) w = Math.max(Math.ceil(lim.min_w), w);
  if (lim.max_w > 0) w = Math.min(Math.floor(lim.max_w), w);
  return w;
}
/** nvidia-smi --query-gpu=index,power.default_limit,power.min_limit,power.max_limit csv -> [{index, default_w, min_w, max_w}] */
function parseLimits(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const p = line.split(",").map((x) => x.trim());
    if (p.length < 4 || !/^\d+$/.test(p[0])) continue;
    const n = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
    out.push({ index: +p[0], default_w: n(p[1]), min_w: n(p[2]), max_w: n(p[3]) });
  }
  return out;
}
/** words about the GPUs now: hot / probably throttling (pure) */
function warningsFor(preset, gpus) {
  const w = [], hotAt = preset && preset.pause_c > 0 ? preset.pause_c : 85;
  for (const g of gpus || []) {
    if (!g || g.temp_c == null) continue;
    if (g.temp_c >= hotAt) w.push(`GPU ${g.index} is ${Math.round(g.temp_c)} °C`);
    const busy = g.power_w != null && g.power_limit_w > 0 && g.power_w >= g.power_limit_w * 0.5;
    if (g.temp_c >= 83 && busy && g.clock_mhz > 0 && g.max_clock_mhz > 0 && g.clock_mhz < g.max_clock_mhz * 0.7)
      w.push(`GPU ${g.index} is probably throttling (${Math.round(g.clock_mhz)} of ${Math.round(g.max_clock_mhz)} MHz at ${Math.round(g.temp_c)} °C)`);
  }
  return w;
}

/* ---------------- live */
const S = { lastDone: 0, hot: false, hotSince: 0, holding: null, gaveUp: false, power: null, appliedFor: null, lastHold: null };
function cfgQueue() { try { return (require("./core").getConfig() || {}).queue || {}; } catch { return {}; } }
function current() { return resolve(cfgQueue()); }
function gpusNow() { try { return require("./power").stats().gpus || []; } catch { return []; } }

/** core.pump: null = start the job; {wait, why} = ask again in `wait` ms */
function check(now) {
  const t = now || Date.now(), p = current();
  const g = gate(p, S, gpusNow(), t);
  if (g && g.hot) { if (!S.hot) { S.hot = true; S.hotSince = t; } }
  else if (S.hot) {
    if (S.hotSince && t - S.hotSince >= MAX_HOLD_MS) S.gaveUp = true;
    S.hot = false; S.hotSince = 0;
  }
  if (!g && S.holding) S.lastHold = { secs: Math.round((t - S.holding.since) / 1000), why: S.holding.why0 || S.holding.why };
  S.holding = g ? { why: g.why, why0: S.holding ? S.holding.why0 : g.why.replace(/: \d+ s left$/, ""), since: S.holding ? S.holding.since : t } : null;
  if (!S.appliedFor && p.power_pct != null) { S.appliedFor = p.id; applyPower(p).catch(() => {}); }   // once a run: the limit after a restart
  return g;
}
/** what core logs on the job that finally starts after a hold */
function takeNote() {
  const n = S.gaveUp ? "[queue] waited 20 min for the GPU to cool down - started anyway (check the fans / the sensor)"
    : S.lastHold && S.lastHold.secs > 0 ? `[queue] waited ${S.lastHold.secs} s - ${S.lastHold.why}` : "";
  S.gaveUp = false; S.lastHold = null;
  return n;
}
function finished(now) { S.lastDone = now || Date.now(); }

function run(args, ms) {
  return new Promise((resolve) => {
    let out = "", err = "";
    let p;
    try { p = spawn("nvidia-smi", args, { windowsHide: true }); } catch (e) { resolve({ code: -1, out, err: String(e.message || e) }); return; }
    const t = setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, ms || 8000);
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => { clearTimeout(t); resolve({ code: -1, out, err: String(e.message || e) }); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code, out, err }); });
  });
}
/** set the cards' power limit for preset p (power_pct null = leave them) -> {ok, gpus:[{index, watts, ok, error}], note} */
async function applyPower(p) {
  const pre = p || current();
  if (pre.power_pct == null) { S.power = { ok: true, note: "power limit left as it is", gpus: [] }; return S.power; }
  const q = await run(["--query-gpu=index,power.default_limit,power.min_limit,power.max_limit", "--format=csv,noheader,nounits"]);
  if (q.code !== 0) { S.power = { ok: false, note: "no NVIDIA card / nvidia-smi here - the power limit was not set (the rest of the preset still works)", gpus: [] }; return S.power; }
  const lims = parseLimits(q.out), gpus = [];
  for (const l of lims) {
    const w = wattsFor(pre.power_pct, l);
    if (w == null) { gpus.push({ index: l.index, ok: false, error: "the card does not report its power limits" }); continue; }
    const r = await run(["-i", String(l.index), "-pl", String(w)]);
    const txt = (r.out + " " + r.err).trim();
    const perm = /permission|administrator|root|not supported/i.test(txt);
    gpus.push({ index: l.index, watts: w, ok: r.code === 0, error: r.code === 0 ? "" : perm
      ? "needs the app run as administrator (Windows) / with sudo (Linux) - or the card does not allow it" : txt.slice(0, 200) });
  }
  const ok = gpus.length > 0 && gpus.every((g) => g.ok);
  S.power = { ok, gpus, note: ok ? `power limit set: ${gpus.map((g) => `GPU ${g.index} ${g.watts} W`).join(", ")} (until the computer restarts)`
    : gpus.length ? gpus.filter((g) => !g.ok).map((g) => `GPU ${g.index}: ${g.error}`).join("; ") : "no NVIDIA card found" };
  return S.power;
}
/** pick a preset (Settings saved in custom.settings): a preset that leaves the limit alone puts the default back
 *  when an earlier one had set a limit (config.queue.limited) -> {status, power} */
async function select(id, custom) {
  const core = require("./core"), cfg = core.getConfig();
  const prev = resolve(cfg.queue || {});
  const q = Object.assign({}, cfg.queue || {});
  if (PRESETS.some((p) => p.id === id)) q.preset = id;
  if (custom && typeof custom === "object") {
    const c = {};
    for (const k of ["power_pct", "cooldown_s", "pause_c", "resume_c"]) if (k in custom) c[k] = custom[k] === "" || custom[k] == null ? null : Number(custom[k]);
    q.custom = Object.assign({}, q.custom || {}, c);
  }
  const next = resolve(q);
  let power = null;
  if (next.power_pct != null) power = await applyPower(next);
  else if (q.limited || prev.power_pct != null) power = await applyPower(Object.assign({}, next, { power_pct: 100 }));
  if (power) q.limited = next.power_pct != null && next.power_pct !== 100 && !!power.ok;
  S.appliedFor = next.id;
  cfg.queue = q; core.setConfig(cfg);
  return { status: status(), power };
}
/** the menu bar's dropdown */
function status() {
  const p = current();
  return { preset: p, presets: PRESETS.map((x) => ({ id: x.id, label: x.label, hint: x.hint })), custom: (cfgQueue().custom || {}),
    holding: S.holding, power: S.power, warnings: warningsFor(p, gpusNow()) };
}

module.exports = { PRESETS, MAX_HOLD_MS, resolve, gate, wattsFor, parseLimits, warningsFor, check, takeNote, finished, applyPower, select, status, current, _S: S };
