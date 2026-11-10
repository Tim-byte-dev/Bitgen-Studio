// bitGen Studio — routes/gpuSplit.js (2.745.0): Basic Settings ▸ GPU (lib/gpuSplit.js). Mounted from routes/index.js.
//   GET  /api/gpusplit                        {where, llm, vlm, image, video, remote, vllm, vllm_ready, routes}
//   POST /api/gpusplit   {where?, llm?, vlm?, image?, video?}   save + put ComfyUI's address where it belongs
//   POST /api/gpusplit/vllm  {endpoint?, model?, vlm_endpoint?, vlm_model?}   the RunPod vLLM endpoint(s) (Settings ▸ Remote generation)
//   POST /api/gpusplit/vllm/test  {kind: llm|vlm}   its health + the model it serves
"use strict";
const G = require("../lib/gpuSplit");

function mount(app) {
  try { G.defaultLocal(); } catch (e) { console.error("[gpu] " + ((e && e.message) || e)); }   // 2.747.0: once - Local by default
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  app.get("/api/gpusplit", wrap(() => G.view()));
  app.post("/api/gpusplit", wrap((req) => G.set(req.body || {})));
  app.post("/api/gpusplit/vllm", wrap((req) => G.saveVllm(req.body || {})));
  app.post("/api/gpusplit/vllm/test", wrap((req) => G.testVllm(String((req.body || {}).kind || "llm") === "vlm" ? "vlm" : "llm")));
}
module.exports = { mount };
