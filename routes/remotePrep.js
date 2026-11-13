// bitGen Studio — routes/remotePrep.js (2.767.0): remote mode prepares the LLM / Vision LLM and the video style's models
// (lib/remotePrep.js, lib/podLlm.js). Mounted before routes/index.js's own LLM start.
//   GET  /api/remoteprep            lib/remotePrep.status()
//   POST /api/remoteprep/where      {llm?, vlm?: "local" | "openrouter" | "runpod" | ""} -> the status (RunPod + Pods = prepared now)
//   POST /api/remoteprep/start      {video_style_id, llm_file} -> the status
//   POST /api/pods/:id/comfy-update  {port?} -> PODS ▸ My pods ▸ ⬆ Update ComfyUI (lib/podComfyUpdate.js start) - GET = how far
//   POST /api/llm/start             in remote mode with the LLM on RunPod / OpenRouter: not started on this computer (the pod's
//                                   LLM is prepared with the file instead); otherwise routes/index.js as before
"use strict";
function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  const RP = () => require("../lib/remotePrep"), PL = () => require("../lib/podLlm");
  app.get("/api/remoteprep", wrap(() => RP().status()));
  app.post("/api/remoteprep/where", wrap((req) => { const b = req.body || {}; PL().setWhere(b); return RP().start({ video_style_id: b.video_style_id, image_style_id: b.image_style_id, gen_mode: b.gen_mode, llm_file: b.llm_file }); }));
  app.post("/api/remoteprep/start", wrap((req) => RP().start(req.body || {})));
  // 2.767.0 (Tim: "can we update to the latest version of comfyui on the pod?"): PODS ▸ My pods ▸ ⬆ Update ComfyUI
  app.post("/api/pods/:id/comfy-update", wrap((req) => require("../lib/podComfyUpdate").start(req.params.id, +((req.body || {}).port) || 0)));
  app.get("/api/pods/:id/comfy-update", wrap((req) => require("../lib/podComfyUpdate").state(req.params.id) || {}));
  app.post("/api/llm/start", (req, res, next) => {
    try {
      const RM = require("../lib/remoteModels"), r = ((require("../lib/core").getConfig() || {}).rgpu) || {};
      const w = require("../lib/remoteLlm").hostOf(r, "llm");   // 2.768.0: Remote mode with nothing picked = OpenRouter
      if (w !== "runpod" && w !== "openrouter") return next();
      // the pick is kept (config llm.last_file - the page saves it); the pod's LLM is set up with it when a prompt is first sent
      if (w === "runpod" && RM.podsMode()) { const s = PL().STATE.llm; if (s && s.phase === "ready" && s.file !== String((req.body || {}).file || "")) s.phase = "stale"; }
      return res.json({ ok: true, remote: w, note: w === "runpod" ? "the LLM runs on your pod (☁ Remote generation docker) - set up there when you send a prompt" : "the LLM runs on OpenRouter (☁ Remote generation docker)" });
    } catch { return next(); }
  });
}
module.exports = { mount };
