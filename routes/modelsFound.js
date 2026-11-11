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

/** what the render would load -> needs() rows, or {skip: why} */
function plan(b) {
  const C = require("../lib/core"), styles = require("../lib/styles");
  const kind = ["image", "music", "video", "aiedit"].includes(b.kind) ? b.kind : "image";
  { const sid = String(b.video_style_id || b.style_id || ""), st0 = sid ? styles.byId(C.STYLES_DIR, sid) : null;
    if (st0 && st0.runs_on === "api") return { skip: "an API_ style - the online service has its own models (Settings ▸ API)" };   // 2.757.0
    if (st0 && st0.runs_on === "pod") return { skip: "a P_ pod style - its models are on the pod" };   // 2.758.0
    // 2.763.2: a style that renders on a RunPod pod - its files are put on the pod (lib/podPrep.js), not looked for here
    try { if (st0 && require("../lib/stylePods").willUsePod(kind === "music" ? "music" : kind === "video" ? "t2va" : "image", st0).pod) return { skip: "it renders on a RunPod pod - its files are put on the pod" }; } catch { /* checked here */ } }
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
    return { kind, wf: wf || "", rows: MF.needs(readGraph(wf), st, "image", {}) };
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
  app.post("/api/models/check", trap.guard((req, res) => {
    const b = req.body || {};
    // 2.720.0: {job_id} = a failed job checked again (after ⬇ Download): the names ComfyUI refused + its style's files
    if (b.job_id) {
      const job = require("../lib/core").jobs.get(String(b.job_id));
      if (!job) return res.json(skip("that job is no longer in the queue"));
      return res.json(Object.assign({ kind: "job", job_id: job.id }, MF.check(MF.jobNeeds(job))));
    }
    const p = plan(b);
    if (p.skip) return res.json(skip(p.skip));
    const r = MF.check(p.rows);
    res.json(Object.assign({ kind: p.kind, workflow: p.wf }, r));
  }));
}

module.exports = { mount, plan };
