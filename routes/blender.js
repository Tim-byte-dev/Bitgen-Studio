// bitGen Studio — routes/blender.js (2.385.0): the Blender bridge (lib/blender.js).
//
// Tim: "is it possible for us to create a blender to bitgen bridge?" -> "Add-on + Blender render bake".
//
//   GET  /api/blender/ping                 {app, version, project} - the add-on's "Test connection"
//   GET  /api/blender/status               {path, engine, samples, gpu, found, version} - is Blender here, which one
//   POST /api/blender/settings             {path, engine, samples, gpu} -> saved in the settings (config.blender)
//   POST /api/blender/push?name=&layer=1   raw model bytes (the add-on's glTF) -> models3d/ + the inbox
//   GET  /api/blender/inbox?since=N        {seq, items} what the add-on sent since N (the page adds / reloads layers)
//   POST /api/blender/render               {id, spec, w, h, fps, frames: [{t, rx, ry, rz, pz, sx, sy, sz}], parts}
//                                          -> renders the layer in Blender (headless) into video/m3d_<id>.webm
//   GET  /api/blender/render/:id           {state, done, of, error, result}
//   POST /api/blender/scene?name=&prompt=&render=1&seconds=&frames=&fps=&width=&height=&ic_lora=&ic_strength=&seed=
//                                          2.402.0: the add-on's "Render scene -> bitGen": raw .mp4 bytes (the scene
//                                          through its camera) -> the project's Video folder (lib/blenderScene.save);
//                                          render=1 also queues LTX 2.3 "3D render -> real" (fal's 3DREAL IC-LoRA)
//                                          -> {name, seconds, job: {id} | null, note}
//   POST /api/blender/send {model}        2.579.0: Blender opens (its window) with a model from the project's 3D models,
//                                          saved as projects/<p>/blender/solidcraft/<stem>.blend (lib/blenderSend.js)
const blender = require("../lib/blender");
const core = require("../lib/core");

function mount(app) {
  const express = require("express");
  const fail = (res, e) => res.status(e.status || 500).json({ error: String(e && e.message || e) });
  app.get("/api/blender/ping", (_req, res) => {
    let version = "";
    try { version = require("../package.json").version; } catch { version = ""; }
    res.json({ app: "bitGen Studio", version, project: core.getProject() });
  });
  app.get("/api/blender/status", async (_req, res) => { try { res.json(await blender.info()); } catch (e) { fail(res, e); } });
  app.post("/api/blender/settings", express.json(), async (req, res) => {
    try { blender.saveSettings(req.body || {}); res.json(await blender.info()); } catch (e) { fail(res, e); }
  });
  app.post("/api/blender/push", express.raw({ type: () => true, limit: 1024 * 1024 * 1024 }), (req, res) => {
    try { res.json({ ok: true, ...blender.push(req.query.name, req.body, req.query.layer === "1" || req.query.layer === "true") }); }
    catch (e) { fail(res, e); }
  });
  app.post("/api/blender/send", express.json(), (req, res) => {
    try { const r = require("../lib/blenderSend").send((req.body || {}).model); res.status(r.error ? 400 : 200).json(r); } catch (e) { fail(res, e); }
  });
  app.get("/api/blender/inbox", (req, res) => { try { res.json(blender.inbox(req.query.since)); } catch (e) { fail(res, e); } });
  app.post("/api/blender/render", express.json({ limit: "64mb" }), (req, res) => {
    const b = req.body || {};
    try { res.json({ ok: true, ...blender.render(b.id, b) }); } catch (e) { fail(res, e); }
  });
  app.get("/api/blender/render/:id", (req, res) => res.json(blender.status(req.params.id)));
  app.post("/api/blender/scene", express.raw({ type: () => true, limit: 2 * 1024 * 1024 * 1024 }), (req, res) => {
    const scene = require("../lib/blenderScene");
    try {
      const q = req.query || {};
      const saved = scene.save(req.body, q);
      if (!(q.render === "1" || q.render === "true")) return res.json({ ok: true, name: saved.name, seconds: saved.seconds, job: null,
        note: `the render ${saved.name} is in Video assets - put it in the reference dock with the LTX 2.3 style (mode 3D render -> real)` });
      const out = scene.queue(saved, q);
      if (out.error) return res.status(400).json({ error: out.error, name: saved.name });
      res.json({ ok: true, name: saved.name, seconds: saved.seconds, job: { id: out.job.id }, note: out.note });
    } catch (e) { fail(res, e); }
  });
}

module.exports = { mount };
