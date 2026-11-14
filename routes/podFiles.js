/* bitGen Studio — routes/podFiles.js (2.781.2): A POD'S MODEL FILES (lib/podFiles.js) + HOW ITS COMFYUI USES THE CARD
 * (lib/podVram.js).
 *   GET  /api/pods/:id/files[?port=]        -> {pod_id, comfy_dir, files: [{path, folder, name, size, link, partial}], total, disk}
 *   POST /api/pods/:id/files/delete         {paths: ["loras/x.safetensors", …]} -> {deleted, failed, disk}
 *   GET  /api/pod-vram                      -> {mode, modes}
 *   POST /api/pod-vram                      {mode: "gpu" | "dynamic"} -> {mode}
 *   POST /api/pods/:id/vram/apply[?port=]   -> the restart's state; GET /api/pods/:id/vram -> {state}
 */
"use strict";
function mount(app) {
  const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: String((e && e.message) || e) }); } };
  const F = () => require("../lib/podFiles"), V = () => require("../lib/podVram");
  app.get("/api/pods/:id/files", wrap((req) => F().list(req.params.id, { port: +req.query.port || 0 })));
  app.post("/api/pods/:id/files/delete", wrap((req) => F().remove(req.params.id, { paths: (req.body || {}).paths, port: +(req.body || {}).port || +req.query.port || 0 })));
  app.get("/api/pod-vram", wrap(() => ({ mode: V().mode(), modes: V().MODES })));
  app.post("/api/pod-vram", wrap((req) => ({ mode: V().setMode(String((req.body || {}).mode || "")) })));
  app.post("/api/pods/:id/vram/apply", wrap((req) => V().apply(req.params.id, +req.query.port || +(req.body || {}).port || 0)));
  app.get("/api/pods/:id/vram", wrap((req) => ({ state: V().state(req.params.id) })));
}
module.exports = { mount };
