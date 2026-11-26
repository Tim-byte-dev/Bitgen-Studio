// bitGen Studio — routes/modelsFound.js (2.719.0): the found-models list and the check before a render (lib/modelsFound.js).
// Mounted from routes/index.js (never server.js).
// Tim (verbatim): "check if models are in a model path before render - create a list of found models so it can be a quick
// check save the list as /misc/models_found.json. if models are not found bring up a msgbox to download/cancel model names
// not found"
//
//   GET  /api/models/found[?refresh=1]   the list (misc/models_found.json); refresh = scan the model paths again (🧩 ⟳)
//   POST /api/models/check  {kind: image | music | video | aiedit, style_id / video_style_id, mode, model, basic, extra_loras,
//                            fill_edit, edit_style_id}
//        2.720.0: {job_id} = a failed job's files (the names ComfyUI refused + its style's) - checked again after ⬇ Download
//        -> {checked, why, needed, found, missing: [{name, cat, folder, from, source: {id, label, size} | null}], ...}
//        the same request the render will send (static/modelsfound.js reads it from the Generate path); the style's
//        overrides, Basic Settings' model / LoRAs and the workflow for the mode, as /api/genimage, /api/genmusic and
//        /api/generate would run them. The ⬇ Download is POST /api/setup/download (routes/setup.js) with source.id.
//        2.806.0: a render on a RunPod pod -> {place: "pod", pod_id, pod_name, missing [{..., here}]} (what the pod lacks);
//        here, a file not in the download list -> {online: {from, size, model}} when found online (lib/modelsWhere.js)
//        2.975.0: {files: [{name, cat}]} = just those files (a feature's own models: 🧱 Picture → 3D scene's sound models)
//   POST /api/models/pod-send {pod_id, items: [{name, cat}]} / GET ?pod_id=   ⬆ Send to <pod> and its progress
//   POST /api/models/fetch {items: [{name, cat}]} / GET                         ⬇ a file found online, into models/<folder> here
"use strict";
const fs = require("fs");
const path = require("path");
const trap = require("../lib/trap");
const MF = require("../lib/modelsFound");

const skip = (why) => ({ checked: false, why, needed: 0, found: 0, missing: [] });
function readGraph(rel) {
  const C = require("../lib/core");
  const r = String(rel || "").trim();
  if (!r) return null;
  const abs = path.isAbsolute(r) ? r : path.join(C.BASE, r);
  try { return JSON.parse(fs.readFileSync(abs, "utf8")); } catch { return null; }
}
const loraList = (v) => {
  let a = v;
  if (typeof a === "string") { try { a = JSON.parse(a || "[]"); } catch { a = []; } }
  return require("../lib/tempLoras").normalize(a);
};

/** what the render would load -> needs() rows (+ pod: the RunPod pod it renders on - 2.806.0), or {skip: why} */
function plan(b) {
  const ctx = {}, p = plan0(b, ctx);
  if (!p.skip && ctx.pod) p.pod = ctx.pod;
  return p;
}
function plan0(b, ctx) {
  const MW = require("../lib/modelsWhere");
  const C = require("../lib/core"), styles = require("../lib/styles");
  const kind = ["image", "music", "video", "aiedit"].includes(b.kind) ? b.kind : "image";
  // 2.786.0: a picture / video made on OpenRouter needs no files here (lib/orRender.js)
  if (kind === "image" || kind === "video") {
    const bm = kind === "image" ? String(b.model || "") : ((require("../lib/basicOverride").parse(b.basic) || {}).model || "");
    try { if (require("../lib/orRender").modelFor(kind, bm)) return { skip: "it renders on OpenRouter - no model files here" }; } catch { /* checked here */ }
    // 2.787.0: a "<pod>/<file>" pick or Basic Settings ▸ Remote - the files are on (or go to) the pod (lib/podPick.js)
    // 2.806.0: checked against THAT pod (lib/modelsWhere.js) - the box asks ⬆ Send to <pod>
    try { const w = require("../lib/podPick").wouldPod(kind, bm, loraList(b.extra_loras).map((l) => l.path || l.name || l.file)); if (w) ctx.pod = MW.podOf(kind, null, w); } catch { /* checked here */ }
  }
  { const sid = String(b.video_style_id || b.style_id || ""), st0 = sid ? styles.byId(C.STYLES_DIR, sid) : null;
    if (st0 && st0.runs_on === "api") return { skip: "an API_ style - the online service has its own models (Settings ▸ API)" };   // 2.757.0
    if (st0 && st0.runs_on === "pod") return { skip: "a P_ pod style - its models are on the pod" };   // 2.758.0
    // 2.763.2: a style that renders on a RunPod pod - its files are put on the pod (lib/podPrep.js), not looked for here
    // 2.806.0: checked against its pod; no pod yet = the "no pod" box asks first, its preparation puts the files on it
    try { if (!ctx.pod && st0 && require("../lib/stylePods").willUsePod(kind === "music" ? "music" : kind === "video" ? "t2va" : "image", st0).pod) { ctx.pod = MW.podOf(kind === "aiedit" ? "image" : kind, st0); if (!ctx.pod) return { skip: "it renders on a RunPod pod that is not made yet - its files are put on it when it is" }; } } catch { /* checked here */ } }
  // 2.719.1: the image editor's ✨ AI (/api/aiedit, /api/aiedit/compose - routes/aiedit.js): its Edit / Regenerate style; a
  // selection filled through the Edit model (fill_edit) = that edit style; Edit / Compose run the style's workflow, the
  // others its inpaint workflow (none = only the style's own names - lib/aiEdit.js picks the graph)
  if (kind === "aiedit") {
    let st = styles.byId(C.STYLES_DIR, String(b.style_id || ""));
    const es = b.fill_edit === "1" && b.mode !== "edit" && b.edit_style_id ? styles.byId(C.STYLES_DIR, String(b.edit_style_id)) : null;
    if (es) st = es;
    if (!st) return { skip: "no style picked" };
    if ((st.engine || "comfy") !== "comfy") return { skip: "an sd-cli style - its files are paths, not ComfyUI model names" };
    const wf = es || !b.mode || b.mode === "edit" ? st.workflow : (st.inpaint_workflow || "");
    // 2.806.0: Basic Settings' Override (the editor's ovr: a checkpoint that fits the style + the temporary LoRAs) - checked too
    let ov = {}; try { ov = typeof b.ovr === "string" ? JSON.parse(b.ovr || "{}") || {} : b.ovr || {}; } catch { ov = {}; }
    let om = typeof ov.model === "string" && ov.model.trim() && !ov.model.includes("..") ? ov.model.trim() : "";
    if (om) { try { if (!require("../lib/modelFit").fit(st, om).ok) om = ""; } catch { om = ""; } }
    return { kind, wf: wf || "", rows: MF.needs(readGraph(wf), st, "image", { model: om, extra_loras: loraList(ov.extra_loras) }) };
  }
  if (kind === "video") {
    const id = String(b.video_style_id || b.style_id || "");
    let vs = id ? styles.byId(C.STYLES_DIR, id) : null;
    if (id && (!vs || vs.kind !== "video")) return { skip: "that video style no longer exists" };
    if (vs && require("../lib/ltx").isLtxStyle(vs)) return { skip: "an LTX style - it picks its files itself" };
    const bo = require("../lib/basicOverride").parse(b.basic);
    const extra = loraList(b.extra_loras);                              // Basic Settings' LoRAs ride here (as /api/generate)
    if (vs || bo) vs = require("../lib/basicOverride").withStyle(vs, bo, { synth: { id: null, name: "(Basic Settings model)", kind: "video",
      engine: "comfy", arch: "minimax-h3", workflows: {}, phases: [{}], te: [""], vae: "", loras: [] } }) || vs;
    const st = vs || {};
    const auto = /^wan/i.test(String(st.arch || "")) || st.arch === "ltx-2.3";
    const mode = ["ref2va", "fl2va", "t2va"].includes(b.mode) ? b.mode : "ref2va";
    let graph = null, wf = "";
    if (!auto) {
      const w = require("../lib/styleModels").workflowFor(st, mode, C.BASE, C.getConfig());
      if (w) { wf = w.rel; graph = readGraph(w.abs); }
    }
    return { kind, wf, rows: MF.needs(graph, st, "video", { auto, model: bo && bo.model, extra_loras: extra }) };
  }
  const st = styles.byId(C.STYLES_DIR, String(b.style_id || ""));
  if (!st) return { skip: "no style picked" };
  if ((st.engine || "comfy") !== "comfy") return { skip: "an sd-cli style - its files are paths, not ComfyUI model names" };
  let model = "";
  if (kind === "image" && typeof b.model === "string" && b.model.trim() && !b.model.includes("..")) {
    try { if (require("../lib/modelFit").fit(st, b.model.trim()).ok) model = b.model.trim(); } catch { model = ""; }
  }
  return { kind, wf: st.workflow || "", rows: MF.needs(readGraph(st.workflow), st, kind === "music" ? "music" : "image", { model, extra_loras: loraList(b.extra_loras) }) };
}

function mount(app) {
  app.get("/api/models/found", trap.guard((req, res) => {
    const fresh = req.query.refresh === "1" || req.query.refresh === "true";
    const list = fresh ? MF.build() : MF.read();
    res.json({ file: "misc/models_found.json", made: list.made, comfy_dir: list.comfy_dir, yaml: list.yaml, count: list.count,
      roots: list.roots, warnings: list.warnings || [], models: req.query.names === "0" ? undefined : list.models });
  }));
  app.post("/api/models/check", trap.guard(async (req, res) => {
    const b = req.body || {};
    // 2.720.0: {job_id} = a failed job checked again (after ⬇ Download): the names ComfyUI refused + its style's files
    if (b.job_id) {
      const job = require("../lib/core").jobs.get(String(b.job_id));
      if (!job) return res.json(skip("that job is no longer in the queue"));
      return res.json(Object.assign({ kind: "job", job_id: job.id }, MF.check(MF.jobNeeds(job))));
    }
    // 2.975.0: {files: [{name, cat}]} = named model files (🧱 Picture → 3D scene's sound models) - the box checks them again
    if (Array.isArray(b.files)) {
      let rows = b.files.filter((x) => x && x.name && x.cat).slice(0, 40).map((x) => ({ name: path.basename(String(x.name)), cat: String(x.cat), from: String(b.from || "files") }));
      // 2.978.0: {kind, style_id, extra_loras, files} = a style's files AND these, in ONE box (🧱 Picture → 3D scene: the edit
      // style + the 360 LoRA + the 3D engine + the sound models - everything a run needs, downloaded before it starts)
      if (b.kind) { const p = plan(b); if (!p.skip && Array.isArray(p.rows)) rows = p.rows.concat(rows.filter((r) => !p.rows.some((q) => q.name === r.name))); }
      return res.json(Object.assign({ kind: "files" }, MF.check(rows)));
    }
    const p = plan(b);
    if (p.skip) return res.json(skip(p.skip));
    // 2.806.0: a render on a RunPod pod = what THAT pod lacks (⬆ Send to <pod>); here = also looked for online (⬇ Download)
    if (p.pod) return res.json(Object.assign({ kind: p.kind, workflow: p.wf }, await require("../lib/modelsWhere").checkPod(p.rows, p.pod)));
    const r = MF.check(p.rows);
    if (r.checked && (r.missing || []).some((m) => !m.source) && b.online !== false) { try { await require("../lib/modelsWhere").online(r.missing); } catch { /* the list's own sources */ } }
    res.json(Object.assign({ kind: p.kind, workflow: p.wf }, r));
  }));
  // 2.806.0: ⬆ Send to <pod> (lib/podSend.js queue) and ⬇ a file found online into this computer's ComfyUI models folders
  app.post("/api/models/pod-send", trap.guard((req, res) => { const b = req.body || {}; res.json(require("../lib/modelsWhere").sendPod(b.pod_id, b.items)); }));
  app.get("/api/models/pod-send", trap.guard((req, res) => res.json(require("../lib/modelsWhere").podSendState(req.query.pod_id))));
  app.post("/api/models/fetch", trap.guard((req, res) => res.json(require("../lib/modelsWhere").fetchLocal((req.body || {}).items))));
  app.get("/api/models/fetch", trap.guard((req, res) => res.json(require("../lib/modelsWhere").fetchState())));
}

module.exports = { mount, plan };
