// bitGen Studio — lib/testPlan.js (2.518.0): THE 🧪 TESTING DOCKER's checklist + THE LOG YOU UPLOAD.
// Tim (verbatim): "Add a log that i can upload so i don't have to write down the tests - add a button general tab in
// settings to do testing. create a floating docker with tests requires and add a check mark to them as they are
// completed. then let me save the file and give it to you."
//
//   THE LIST      lib/testPlan.json - per release, newest first. `auto` items tick THEMSELVES when the app sees them
//                 work (a finished job of that style, a [power] line, a Civitai download into loras, nvidia-smi
//                 answering ...); `manual` items you tick ✓ pass / ✗ fail (+ a note) in the docker.
//   KEPT          config.testlog {marks: {id: {state, note, at}}, events: [...]} in custom.settings - it survives a
//                 restart; ↺ Clear starts again
//   EVENTS        what the app tells it as it happens (event(name, data)): style_from_model, card_edit, civitai_search,
//                 civitai_download {cat}, civitai_lookup, bugreport_saved, house_saved / house_shot / house_pano / house_obj (2.524) - the auto items that are not jobs
//                 2.532: workspace_used {cat: the workspace} / workspace_reset, style_doctor {cat: quick|real}, style_doctor_explain,
//                 house_roof / house_people / house_trace / house_furnish / house_glb (the server sees them) and the page's own
//                 (POST /api/testplan/event, only CLIENT_EVENTS): palette_run, palette_settings, help_open,
//                 docker_min, docker_max (2.630.0: the House builder's events went with it)
//   2.532.0       Tim: "when a task is completed successfully and we haven't checked it in the test list then check it
//                 automatically" - an auto pass is KEPT as a mark {state: pass, auto: true, how} the moment the docker (or
//                 the log) sees it, so it stays ✓ after a restart (a job's log is gone then) and many items that were
//                 tick-by-hand now tick themselves too (they keep their ✓ ✗ buttons - your mark always wins)
//   2.534.0       Tim: "create a checkbox in settings for test mode . when in test mode check if tests are successful,
//                 prompt the user to test features ... when out of test mode no tests are done" + "once the user does
//                 the test confirm with a dialog that the test was successful, have an input box for suggestions to
//                 change feature". config.testlog.on (Settings -> General -> 🧪 Test mode, or the docker's box):
//                 OFF = no event is kept, nothing is evaluated or kept, nothing is suggested (your own marks stay);
//                 ON  = as 2.532 + static/testcoach.js: a kept auto tick is "pending" until you confirm it (✓ / ✗ +
//                 what happened + a SUGGESTION for the feature); items carry `where` (imageedit, house, lora,
//                 timeline, settings, image, app) and the coach suggests the next one where you are. A mark has
//                 `suggest`; the log lists every suggestion first. Image editor items tick from ie_action {what:
//                 the undo step's name} (the coach hooks the editor's onPush). Events can match `what` (a regex).
//   THE LOG       report() = one text file: the app version, the computer (OS, CPU, RAM, GPUs, nvidia-smi, ComfyUI),
//                 every item ✓ / ✗ / · with how it was decided (the job id, the line it found, your note), the jobs
//                 that FAILED this session with the last lines of their logs, then the same as JSON for me to read.
//                 The docker's 💾 Save log downloads it (bitgen-test-log-<version>-<date>.txt) - give me that file.
// Pure (scripts/test-testplan518.js): flatten, evaluate, summarize, textReport.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

const PLAN = path.join(__dirname, "testPlan.json");
const MAX_EVENTS = 200;
function plan() { return JSON.parse(fs.readFileSync(PLAN, "utf8")); }
/** the groups -> one list [{...item, group, group_title}] */
function flatten(p) {
  const out = [];
  for (const g of (p && p.groups) || []) for (const it of g.items || []) out.push(Object.assign({}, it, { group: g.id, group_title: g.title }));
  return out;
}
const rx = (s) => { try { return new RegExp(s, "i"); } catch { return null; } };
function modeOk(want, mode) { if (!want) return true; const s = String(want); return s.startsWith("^") ? !!(rx(s) && rx(s).test(mode || "")) : s === mode; }

/** one auto item against what the app knows -> {state: "pass"|"", how} (pure)
 *  ctx = {jobs: [{id, status, mode, style, log: [...], energy, override}], stats, price, events, cards, civitai_ok, comfy} */
function evaluate(item, ctx) {
  const a = item.auto, c = ctx || {};
  if (!a) return { state: "", how: "" };
  const done = (c.jobs || []).filter((j) => j.status === "done");
  switch (a.kind) {
    case "job": {
      const st = a.style ? rx(a.style) : null;
      const im = a.image ? rx(a.image) : null;   // 2.532: one of the pictures it was given (a house shot, a character's picture)
      const j = done.find((x) => modeOk(a.mode, x.mode) && (!st || st.test(x.style || "")) && (!a.override || x.override) && (!im || (x.images || []).some((f) => im.test(f))));
      return j ? { state: "pass", how: `job ${j.id} (${j.mode}${j.style ? ", " + j.style : ""}) finished` } : { state: "", how: "" };
    }
    case "any": {                                // 2.532: the first of several ways it can be seen working
      for (const x of a.of || []) { const r = evaluate({ auto: x }, c); if (r.state) return r; }
      return { state: "", how: "" };
    }
    case "job_log": {
      const r = rx(a.re);
      for (const j of (c.jobs || [])) { const l = (j.log || []).find((x) => r && r.test(x)); if (l) return { state: "pass", how: `job ${j.id}: ${String(l).slice(0, 160)}` }; }
      return { state: "", how: "" };
    }
    case "job_energy": {
      const j = done.find((x) => x.energy && x.energy.wh != null);
      return j ? { state: "pass", how: `job ${j.id}: ${j.energy.wh} Wh` } : { state: "", how: "" };
    }
    case "gpu_power": { const g = ((c.stats || {}).gpus || []).find((x) => x.power_w != null); return g ? { state: "pass", how: `GPU ${g.index}: ${Math.round(g.power_w)} W, ${g.clock_mhz} MHz` } : { state: "", how: "" }; }
    case "gpu_temp": { const g = ((c.stats || {}).gpus || []).find((x) => x.temp_c != null); return g ? { state: "pass", how: `GPU ${g.index}: ${g.temp_c} °C` } : { state: "", how: "" }; }
    case "cpu_clock": return (c.stats || {}).cpu_mhz ? { state: "pass", how: `${c.stats.cpu_mhz} MHz` } : { state: "", how: "" };
    case "price": return c.price && c.price.price_kwh > 0 ? { state: "pass", how: `${c.price.price_kwh} ${c.price.currency}/kWh` } : { state: "", how: "" };
    case "cards": return (c.cards || 0) >= (a.min || 1) ? { state: "pass", how: `${c.cards} model cards` } : { state: "", how: "" };
    case "civitai_key": return c.civitai_ok ? { state: "pass", how: "the key works" + (c.civitai_user ? " (" + c.civitai_user + ")" : "") } : { state: "", how: "" };
    case "comfy": return c.comfy ? { state: "pass", how: "ComfyUI answered" } : { state: "", how: "" };
    case "event": {
      const cr = a.cat ? rx("^(" + a.cat + ")$") : null, wr = a.what ? rx(a.what) : null;
      const e = (c.events || []).slice().reverse().find((x) => x.event === a.event && (!cr || cr.test(String((x.data || {}).cat || ""))) && (!wr || wr.test(String((x.data || {}).what || ""))));
      return e ? { state: "pass", how: `${e.event}${e.data && e.data.what ? ": " + e.data.what : ""} (${new Date(e.at).toLocaleString()})` } : { state: "", how: "" };
    }
    default: return { state: "", how: "" };
  }
}
/** every item: auto result + your mark (yours wins: a ✗ on an auto item stays ✗) (pure) */
function summarize(items, ctx, marks, opts) {
  const m = marks || {}, useAuto = !(opts && opts.auto === false);      // 2.534: test mode off = nothing is evaluated
  const rows = items.map((it) => {
    const mk = m[it.id];
    const auto = useAuto ? evaluate(it, ctx) : { state: "", how: "" };
    const state = mk && mk.state ? mk.state : auto.state;
    const how = mk && mk.state ? (mk.auto ? "auto: " + (mk.how || "seen working") : "you: " + mk.state + (auto.state ? " (auto: " + auto.how + ")" : "")) : auto.how;
    return Object.assign({}, it, { state: state || "", how,
      note: (mk && mk.note) || "", suggest: (mk && mk.suggest) || "", at: (mk && mk.at) || null, auto_state: auto.state || (mk && mk.auto ? "pass" : ""), kept: !!(mk && mk.auto),
      pending: !!(mk && mk.auto && mk.state === "pass"), where: it.where || "" });   // 2.534: pending = seen working, not confirmed by you yet
  });
  const n = (s) => rows.filter((r) => r.state === s).length;
  return { rows, pass: n("pass"), fail: n("fail"), skip: n("skip"), todo: rows.filter((r) => !r.state).length, total: rows.length };
}
/** 2.532.0: the auto passes nobody has marked yet -> marks to keep {id: {state: "pass", auto: true, how, note, at}} (pure) */
function keepAuto(rows, marks, now) {
  const out = {}, m = marks || {};
  for (const r of rows || []) {
    const mk = m[r.id];
    if (mk && mk.state) continue;                        // yours (or already kept) wins
    if (r.state === "pass" && r.auto_state === "pass") out[r.id] = { state: "pass", auto: true, how: String(r.how || "").slice(0, 300), note: (mk && mk.note) || "", suggest: (mk && mk.suggest) || "", at: now || Date.now() };
  }
  return out;
}
const CLIENT_EVENTS = ["ie_action", "palette_run", "palette_settings", "help_open", "docker_min", "docker_max", "ie_ref", "ie_realrefs"];
const MARK = { pass: "✓ PASS", fail: "✗ FAIL", skip: "– SKIP", "": "· not done" };
/** the text file (pure): sum = summarize(), sys = {version, os, cpu, ram, gpus, comfy, smi}, failed = [{id, mode, style, log}] */
function textReport(sum, sys, failed, when) {
  const L = [];
  const s = sys || {};
  L.push("bitGen Studio — TEST LOG");
  L.push(`App ${s.version || "?"} · saved ${when || new Date().toISOString()}`);
  L.push(`Computer: ${s.os || "?"} · CPU ${s.cpu || "?"} · RAM ${s.ram || "?"}`);
  L.push(`GPUs: ${(s.gpus || []).length ? s.gpus.join("; ") : "none read (nvidia-smi " + (s.smi ? "answered" : "not found") + ")"}`);
  L.push(`ComfyUI: ${s.comfy ? "answering at " + s.comfy : "not answering"}${s.comfy_dir ? " · folder " + s.comfy_dir : ""}`);
  L.push(`Summary: ${sum.pass} passed, ${sum.fail} failed, ${sum.skip} skipped, ${sum.todo} not done (of ${sum.total})` + (sum.mode != null ? ` · test mode ${sum.mode ? "ON" : "OFF"}` : ""));
  L.push("");
  const sg = sum.rows.filter((r) => r.suggest);
  if (sg.length) {                                        // 2.534.0: what Tim wants changed, first
    L.push("== SUGGESTIONS (what to change)");
    for (const r of sg) L.push(`  • ${r.title}\n      -> ${r.suggest}`);
    L.push("");
  }
  let g = null;
  for (const r of sum.rows) {
    if (r.group !== g) { g = r.group; L.push("== " + r.group_title); }
    L.push(`  ${MARK[r.state] || MARK[""]}  ${r.title}`);
    if (r.how) L.push(`        how: ${r.how}`);
    if (r.note) L.push(`        note: ${r.note}`);
    if (r.suggest) L.push(`        suggestion: ${r.suggest}`);
    if (r.pending) L.push("        (seen working - not confirmed yet)");
  }
  if ((failed || []).length) {
    L.push(""); L.push("== Jobs that FAILED this session (the last lines of each log)");
    for (const f of failed) {
      L.push(`-- job ${f.id} · ${f.mode}${f.style ? " · " + f.style : ""}`);
      for (const l of (f.log || []).slice(-30)) L.push("   " + l);
    }
  }
  L.push(""); L.push("== JSON (for Claude)");
  L.push(JSON.stringify({ version: s.version, sys: s, summary: { pass: sum.pass, fail: sum.fail, skip: sum.skip, todo: sum.todo },
    items: sum.rows.map((r) => ({ id: r.id, state: r.state, how: r.how, note: r.note })), failed: (failed || []).map((f) => ({ id: f.id, mode: f.mode, style: f.style, log: (f.log || []).slice(-30) })) }));
  return L.join("\n") + "\n";
}

/* ---------------- live */
function cfg() { return require("./core").getConfig(); }
function rec() { const c = cfg(); c.testlog = c.testlog && typeof c.testlog === "object" ? c.testlog : {}; c.testlog.marks = c.testlog.marks || {}; c.testlog.events = c.testlog.events || []; return c.testlog; }
function saveCfg() { const core = require("./core"); core.setConfig(core.getConfig()); }
/** the app tells it something happened (never throws) */
function isOn() { try { return rec().on === true; } catch { return false; } }
/** 2.534.0: 🧪 Test mode on / off (Settings -> General) */
function setMode(on) { const t = rec(); t.on = !!on; saveCfg(); return { on: t.on }; }
function event(name, data) {
  try {
    const t = rec();
    if (t.on !== true) return;                            // 2.534: out of test mode nothing is kept
    t.events.push({ event: String(name).slice(0, 40), data: data || {}, at: Date.now() });
    if (t.events.length > MAX_EVENTS) t.events.splice(0, t.events.length - MAX_EVENTS);
    saveCfg();
  } catch { /* testing never breaks the app */ }
}
function mark(id, state, note, suggest) {
  const t = rec();
  if (!["pass", "fail", "skip", ""].includes(state)) return { error: "state is pass, fail, skip or empty" };
  const was = t.marks[id];
  const sg = suggest == null ? ((was && was.suggest) || "") : String(suggest).slice(0, 2000);   // 2.534: a suggestion for the feature
  if (!state && was && was.auto) { was.note = String(note || "").slice(0, 1000); was.suggest = sg; saveCfg(); return { ok: true }; }   // 2.532: a note on a kept auto tick keeps the tick
  if (!state && !note && !sg) delete t.marks[id];
  else t.marks[id] = { state, note: String(note || "").slice(0, 1000), suggest: sg, at: Date.now() };
  saveCfg();
  return { ok: true };
}
/** 2.532.0: keep what was seen working (status / report) - never throws */
function remember(sum) {
  try {
    const t = rec(), k = keepAuto(sum.rows, t.marks);
    if (!Object.keys(k).length) return 0;
    Object.assign(t.marks, k);
    for (const r of sum.rows) if (k[r.id]) { r.kept = true; r.pending = true; }
    saveCfg();
    return Object.keys(k).length;
  } catch { return 0; }
}
/** what the page itself saw (only CLIENT_EVENTS) */
function clientEvent(name, what) {
  const n = String(name || "");
  if (!CLIENT_EVENTS.includes(n)) return { error: "event: " + CLIENT_EVENTS.join(" | ") };
  if (!isOn()) return { ok: true, off: true };
  event(n, { what: String(what || "").slice(0, 160) });
  return { ok: true };
}
/** 2.534.0: ↺ test one again - its mark goes, and so do the events that ticked it (a job's own record stays) */
function retest(id) {
  const t = rec(), it = flatten(plan()).find((x) => x.id === id);
  if (!it) return { error: "no such test: " + id };
  delete t.marks[id];
  const a = it.auto, autos = a ? (a.kind === "any" ? a.of || [] : [a]) : [];
  let n = 0;
  for (const x of autos) {
    if (x.kind !== "event") continue;
    const before = t.events.length;
    t.events = t.events.filter((e) => evaluate({ auto: x }, { events: [e] }).state !== "pass");
    n += before - t.events.length;
  }
  saveCfg();
  return { ok: true, events: n };
}
function clear() { const c = cfg(); const on = !!(c.testlog && c.testlog.on === true); c.testlog = { on, marks: {}, events: [] }; saveCfg(); return { ok: true }; }   // (Test mode stays as it was)

let civ = { at: 0, ok: false, user: "" }, comfyOk = { at: 0, ok: false };
async function context() {
  const core = require("./core");
  const jobs = [];
  for (const id of core.order || []) {
    const j = core.jobs.get(id); if (!j) continue;
    const p = j.params || {};
    jobs.push({ id: j.id, status: j.status, mode: p.mode || "", style: p.style_name || p.video_style_name || "", log: j.log || [], energy: j.energy || null,
      override: !!(p.style && (p.style.model_override || p.style.mm_override)),
      images: [].concat(p.images || [], p.image ? [p.image] : []).filter((x) => typeof x === "string").map((x) => path.basename(x)) });
  }
  try {
    const info = require("./jobsInfo").read(core.projDir(core.getProject()));
    for (const e of info) if (!jobs.some((x) => x.id === e.id)) jobs.push({ id: e.id, status: e.status, mode: e.mode, style: (e.meta && e.meta.style) || "", log: [], energy: e.energy || null });
  } catch { /* no project */ }
  let stats = {};
  try { const pw = require("./power").stats(); stats = { gpus: pw.gpus, cpu_mhz: pw.cpu_mhz }; } catch { stats = {}; }
  const c = cfg();
  if (Date.now() - civ.at > 60000 && ((c.civitai || {}).token)) {
    civ.at = Date.now();
    try { const r = await require("./civitai").test(); civ.ok = !!r.ok; civ.user = r.user || ""; } catch { civ.ok = false; }
  }
  if (Date.now() - comfyOk.at > 15000) {
    comfyOk.at = Date.now();
    const url = (((c.engine || {}).comfy || {}).url || "http://127.0.0.1:8188").replace(/\/$/, "");
    try { const r = await fetch(url + "/system_stats", { signal: AbortSignal.timeout(1500) }); comfyOk.ok = r.ok; comfyOk.url = url; } catch { comfyOk.ok = false; comfyOk.url = url; }
  }
  let ncards = 0;
  try { const d = require("./modelCards").list(); ncards = d.models.length; } catch { ncards = 0; }
  return { jobs, stats, price: require("./power").priceOf(c), events: rec().events, cards: ncards, civitai_ok: civ.ok, civitai_user: civ.user, comfy: comfyOk.ok, comfy_url: comfyOk.url };
}
async function status() {
  const ctx = await context();
  const p = plan();
  const on = isOn();
  const sum = summarize(flatten(p), ctx, rec().marks, { auto: on });
  if (on) remember(sum);
  return Object.assign({ version: p.version, mode: on, now: Date.now(), groups: p.groups.map((g) => ({ id: g.id, title: g.title })) }, sum);
}
async function sys(ctx) {
  const core = require("./core");
  let ver = "?"; try { ver = require("../package.json").version; } catch { /* fine */ }
  let gpus = [];
  try { gpus = ((await core.readGpus()) || []).map((g) => [g.name, g.mem_total ? Math.round(g.mem_total / 1024) + " GB" : "", g.temp ? g.temp + " °C" : ""].filter(Boolean).join(" · ")); } catch { gpus = []; }
  const c = cfg();
  return { version: ver, os: `${os.type()} ${os.release()} (${process.platform} ${process.arch}) · node ${process.version}`,
    cpu: ((os.cpus() || [])[0] || {}).model + " x" + (os.cpus() || []).length, ram: Math.round(os.totalmem() / 1073741824) + " GB",
    gpus, smi: ((ctx.stats || {}).gpus || []).length > 0, comfy: ctx.comfy ? ctx.comfy_url : "", comfy_dir: (((c.engine || {}).comfy || {}).dir || "") };
}
async function report() {
  const ctx = await context();
  const p = plan();
  const on = isOn();
  const sum = summarize(flatten(p), ctx, rec().marks, { auto: on });
  if (on) remember(sum);
  sum.mode = on;
  const failed = ctx.jobs.filter((j) => j.status === "failed" && (j.log || []).length).slice(-12);
  const s = await sys(ctx);
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  return { name: `bitgen-test-log-${s.version}-${stamp}.txt`, text: textReport(sum, s, failed, new Date().toLocaleString()) };
}

module.exports = { plan, flatten, evaluate, summarize, keepAuto, CLIENT_EVENTS, textReport, event, clientEvent, remember, mark, clear, status, report, context, isOn, setMode, retest };
