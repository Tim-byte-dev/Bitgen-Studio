// bitGen Studio — THE H3_Viggle STYLE'S ROUTES (2.352.0). Mounted by
// routes/index.js (never server.js); what a job carries is lib/h3Viggle.js.
//
// Tim: "can we incorporate viggle into these worklows but make it a new
// viggle workflow?" - each board scene gets a 🎬 Motion video, the clip whose
// movement the character performs:
//   GET    /api/h3viggle/status               the style + its two workflows present?
//   POST   /api/scenes/:n/motion              JSON {project, kind: "asset" | "project" | "take",
//                                             name (a Video asset) | rel (a project file) | scene (a take)}
//   POST   /api/scenes/:n/motion/upload       multipart "video" (+ project)
//   DELETE /api/scenes/:n/motion              {project}
//   GET    /api/scenes/:n/motion              the file itself (?project=)
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const HV = require("../lib/h3Viggle");
const scenes = require("../lib/scenes");
const trap = require("../lib/trap");

function status() {
  const styles = require("../lib/styles");
  const st = styles.read(core.STYLES_DIR, "video").filter(HV.isViggleStyle);
  const wf = {};
  for (const [m, rel] of Object.entries(HV.WORKFLOWS)) wf[m] = fs.existsSync(path.join(core.BASE, rel));
  return { flow: HV.FLOW, styles: st.map((s) => ({ id: s.id, name: s.name })), workflows: wf, steps: HV.STEPS };
}

function sourceOf(b) {
  const kind = String(b.kind || "");
  if (kind === "asset") {
    const p = path.join(core.pDir("video"), path.basename(String(b.name || "")));
    return fs.existsSync(p) ? { src: p, label: "video asset: " + path.basename(p) } : { error: `${b.name} is not in the Video assets` };
  }
  if (kind === "project") {
    const pm = require("../lib/projectMedia");
    const p = pm.resolve(b.project, b.rel);
    if (!p || !HV.VIDEO_RE.test(p)) return { error: `${b.rel} is not a video in this project` };
    return { src: p, label: `${pm.groupFor(b.project, b.rel)}: ${path.basename(String(b.rel))}` };
  }
  if (kind === "take") {
    const st = scenes.load(b.project);
    const from = scenes.at(st, b.scene);
    if (!from || !from.output) return { error: `scene ${b.scene} has no rendered take` };
    const p = path.isAbsolute(from.output) ? from.output : path.join(core.pDir("video"), path.basename(from.output));
    return fs.existsSync(p) ? { src: p, label: `scene ${from.n}'s take` } : { error: `scene ${from.n}'s take is not on disk` };
  }
  return { error: "kind must be asset, project or take" };
}

function mount(app) {
  const upload = require("../lib/tempUpload").tempUpload({ fileSize: 2 * 1024 * 1024 * 1024 });   // 2.378.0: the current project's temp/
  app.get("/api/h3viggle/status", (_req, res) => res.json(status()));
  app.post("/api/scenes/:n/motion", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const s = sourceOf(b);
    if (s.error) return res.status(400).json({ error: s.error });
    const out = HV.setMotion(b.project, r, s.src, s.label);
    if (!out.ok) return res.status(400).json({ error: out.error });
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, motion: r.motion, note: `scene ${r.n}'s motion video: ${s.label}` });
  }));
  app.post("/api/scenes/:n/motion/upload", upload.single("video"), trap.guard((req, res) => {
    const b = req.body || {};
    const f = req.file;
    const clean = () => { if (f) fs.unlink(f.path, () => {}); };
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) { clean(); return res.status(404).json({ error: `no scene ${req.params.n}` }); }
    if (!f || !HV.VIDEO_RE.test(f.originalname || "")) { clean(); return res.status(400).json({ error: "upload one video" }); }
    let out;
    try { out = HV.setMotion(b.project, r, f.path, "upload: " + path.basename(f.originalname)); } finally { clean(); }
    if (!out.ok) return res.status(400).json({ error: out.error });
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, motion: r.motion, note: `scene ${r.n}'s motion video: ${path.basename(f.originalname)}` });
  }));
  app.delete("/api/scenes/:n/motion", trap.guard((req, res) => {
    const b = Object.keys(req.body || {}).length ? req.body : req.query;
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const had = HV.clearMotion(b.project, r);
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, removed: had });
  }));
  app.get("/api/scenes/:n/motion", (req, res) => {
    const st = scenes.load(req.query.project);
    const r = scenes.at(st, req.params.n);
    const m = r && HV.motionFor(req.query.project, r);
    if (!m) return res.status(404).json({ error: "no motion video" });
    res.sendFile(m.file);
  });
}

module.exports = { mount, status, sourceOf };
