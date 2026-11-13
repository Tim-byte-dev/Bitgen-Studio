/* bitGen Studio — lib/basicUse.js (2.777.0): BASIC SETTINGS ▸ "USE MODEL" / "USE TEMPORARY LORAS" - whether Override style's
 * checkpoint / video model and the temporary LoRAs ride a render (config.basic_use). Default on (as before).
 * Tim (verbatim): "add a checkbox over the checkpoint "Use Model", and another over loras "Use Temporary Lora's this will allow
 * the style to be more versatile, we can send overide settings without changing the base model or use loras if we want with
 * the styles model or the overide model"
 *   off "Use model"            the style's own model renders - Override's steps / CFG / size / seed still apply
 *   off "Use temporary LoRAs"  no temporary LoRAs added (the list is kept for next time)
 *   The page sends neither when off (static/ovruse.js gates the request bodies); the server reads these flags where it
 *   reads the saved lists itself (routes/characters.js scene renders).
 */
"use strict";
const KEYS = ["image_model", "image_loras", "video_model", "video_loras"];
function core() { return require("./core"); }
/** the flags (pure on a config): every key true unless set false */
function of(cfg) { const u = (cfg && cfg.basic_use) || {}; const o = {}; for (const k of KEYS) o[k] = u[k] !== false; return o; }
function get() { return of(core().getConfig()); }
function set(b) {
  const C = core(), c = C.getConfig(), u = Object.assign({}, of(c));
  for (const k of KEYS) if (b && k in b) u[k] = !!b[k];
  c.basic_use = u; C.setConfig(c);
  return u;
}
const loras = (kind) => get()[(kind === "image" ? "image" : "video") + "_loras"];
const model = (kind) => get()[(kind === "image" ? "image" : "video") + "_model"];
function mount(app) {
  app.get("/api/basic-use", (req, res) => res.json(get()));
  app.post("/api/basic-use", (req, res) => { try { res.json(set(req.body || {})); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
}
module.exports = { KEYS, of, get, set, loras, model, mount };
