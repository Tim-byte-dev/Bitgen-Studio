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
// 2.787.0 (Tim: "in basic settings add a checkbox under use model, "remote", so if user clicks a local model with this setting
// enabled bitgen will look for the model on civitai/hf and upload to a selected pod (pod dropdown will be next remote checkbox,
// same with the loras"): <key>_pod = the pod that box sends to ("" = Remote off) - lib/podPick.js reads it
const POD_KEYS = KEYS.map((k) => k + "_pod");
function core() { return require("./core"); }
/** the flags (pure on a config): every key true unless set false; the *_pod keys a pod id, left out when Remote is off */
function of(cfg) {
  const u = (cfg && cfg.basic_use) || {}; const o = {};
  for (const k of KEYS) o[k] = u[k] !== false;
  for (const k of POD_KEYS) { const v = String(u[k] || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40); if (v) o[k] = v; }   // only when set
  return o;
}
function get() { return of(core().getConfig()); }
function set(b) {
  const C = core(), c = C.getConfig(), u = Object.assign({}, of(c));
  for (const k of KEYS) if (b && k in b) u[k] = !!b[k];
  for (const k of POD_KEYS) if (b && k in b) { const v = String(b[k] || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40); if (v) u[k] = v; else delete u[k]; }
  c.basic_use = u; C.setConfig(c);
  return u;
}
/** 2.787.0: the pods Remote sends a kind's model / LoRAs to -> {model, loras} ("" = this computer) */
function remote(kind) { const g = get(), k = kind === "image" ? "image" : "video"; return { model: g[k + "_model_pod"] || "", loras: g[k + "_loras_pod"] || "" }; }
const loras = (kind) => get()[(kind === "image" ? "image" : "video") + "_loras"];
const model = (kind) => get()[(kind === "image" ? "image" : "video") + "_model"];
function mount(app) {
  app.get("/api/basic-use", (req, res) => res.json(get()));
  app.post("/api/basic-use", (req, res) => { try { res.json(set(req.body || {})); } catch (e) { res.status(500).json({ error: String(e.message || e) }); } });
}
module.exports = { KEYS, POD_KEYS, of, get, set, loras, model, remote, mount };
