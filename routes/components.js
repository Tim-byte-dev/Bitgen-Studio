// bitGen Studio — COMPONENTS ON START (2.353.0). Mounted by routes/index.js (never server.js); the file
// and the decision are lib/components.js, the install is routes/native.js.
//
// Tim: "check to see if viggle native is installed on start, add a file components.txt ... if start finds
// viggle=0 then install viggle, check if comfy workflow for the component exists, if it exists use the
// models in the workflow so user doesn't have to dl new ones".
//
//   on start (a few seconds after the routes mount):
//     1. with the venv there, the ComfyUI files the workflows name are checked (header only) - so an
//        install that already uses them counts as installed;
//     2. components.txt gets viggle native=1 / 0 (skip is kept);
//     3. 0 -> the native install job: the venv + ONLY what the workflows' files do not cover; those files
//        are checked when the venv is built and only one the engine cannot read is downloaded.
//   GET  /api/components         the file's values + what is installed now
//   POST /api/components/check   the start check again (body {install: false} = only look + write)
const core = require("../lib/core");
const C = require("../lib/components");

function native() { return require("./native"); }

/** What is installed now: {"viggle native": {installed, note, busy}}. */
function state() {
  const s = native().statusView();
  const j = s.job;
  return { "viggle native": { installed: !!s.viggle.ready, note: s.viggle.note || "", missing: s.viggle.labels || [],
                              busy: !!(j && (j.status === "queued" || j.status === "running")),
                              workflow: s.components.filter((c) => c.workflow).map((c) => ({ id: c.id, name: c.workflow.name, from: c.workflow.from })) } };
}

/** Write components.txt from the disk (skip kept). -> {key: value} */
function sync() {
  const cur = C.read(core.BASE);
  const st = state();
  const vals = {};
  // 2.355.0: installed -> 1 (even over a 2: the user installed it himself); otherwise 1 / 2 are kept, 0 stays 0
  for (const k of C.KNOWN) {
    if (st[k.key].installed) vals[k.key] = "1";
    else if (!C.isSkip(cur[k.key]) && String(cur[k.key]) !== "1") vals[k.key] = "0";
  }
  C.write(core.BASE, vals);
  return C.read(core.BASE);
}

/** Install on start is allowed unless this is the test server (H3_E2E) - BITGEN_COMPONENTS_INSTALL=1 forces it. */
function allowed() {
  if (process.env.BITGEN_COMPONENTS_INSTALL === "1") return true;
  return !process.env.H3_E2E;
}

/** The start check. o = {install (default true)}. -> {values, decisions, job?} */
async function check(o) {
  const opt = o || {};
  const say = opt.say || ((m) => console.log(m));
  const s0 = native().statusView();
  // 1. the venv can read the ComfyUI files now: check them first (a machine that already uses them is installed)
  if (s0.venv_ready && s0.components.some((c) => c.candidates && c.candidates.some((x) => x.ok === null))) {
    try { const r = await native().runCheck(); if (r && r.checked) say(`[components] checked ${r.checked} ComfyUI file(s) for Viggle (native)`); }
    catch (e) { say("[components] the ComfyUI file check failed: " + e.message); }
  }
  const cur = C.read(core.BASE);
  const st = state();
  const decisions = {};
  let job = null;
  for (const k of C.KNOWN) {
    const d = C.decide({ key: k.key, installed: st[k.key].installed, current: cur[k.key], busy: st[k.key].busy,
                         allowed: opt.install !== false && allowed() });
    decisions[k.key] = d;
    if (!C.isSkip(cur[k.key])) C.write(core.BASE, { [k.key]: d.value });
    say(`[components] ${d.why}` + (d.action === "install" && st[k.key].workflow.length
      ? ` - with your ComfyUI files (${st[k.key].workflow.map((w) => w.name).join(", ")}) instead of downloading them` : ""));
    if (d.action === "install" && k.key === "viggle native") {
      const r = native().install({ use: "viggle", auto: true });
      if (r.status === 200) job = { id: r.body.id, components: r.body.components, comfy_files: r.body.comfy_files };
      else say("[components] the install did not start: " + (r.body.error || r.status));
    }
  }
  return { file: C.file(core.BASE), values: C.read(core.BASE), decisions, job, state: st };
}

function mount(app) {
  app.get("/api/components", (_req, res) => res.json({ file: C.file(core.BASE), values: C.read(core.BASE), state: state() }));
  app.post("/api/components/check", async (req, res) => {
    try { res.json(await check({ install: (req.body || {}).install !== false })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  // on start: after the other routes are up (the native routes, the config)
  const t = setTimeout(() => { check().catch((e) => console.log("[components] the start check failed: " + e.message)); }, 3000);
  if (t.unref) t.unref();
}

module.exports = { mount, state, sync, check, allowed };
