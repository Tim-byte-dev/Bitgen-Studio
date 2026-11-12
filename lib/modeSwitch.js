/* bitGen Studio — lib/modeSwitch.js (2.766.2): LOCAL <-> REMOTE in Basic Settings switches the whole app over.
 *
 * Tim (verbatim): "when local is selected in basic settings go to local mode . show all the local model folders in folder
 * filter, check if comfyui is running, start it if it is not running. and continue as normal local mode. in remote mode stop
 * comfyi if it is running, clear the folders in folder filer in basic settings and show the model families instead, list the
 * models in the remote models list, filter by family"
 *
 *   modeOf()        "remote" = remote generation on, RunPod pods, and Basic Settings ▸ GPU on Remote (or Both with images /
 *                   video remote) - the model lists are runpod/pods/remote_models.json (lib/remoteModels.js podsMode);
 *                   else "local"
 *   after(before)   called by the routes that change it (POST /api/gpusplit, POST /api/remotegen/enabled):
 *                     -> local:  ComfyUI on this computer is checked; not running = started (in the background)
 *                     -> remote: the ComfyUI bitGen started on this computer is stopped (a ComfyUI started some other way
 *                                is left - bitGen cannot close it; it says so)
 *                   -> {mode, changed, comfy: running | starting | stopped | left | "", note}
 *   The page then reads its model lists again (static/remotemodels.js recheck): local = this computer's folders in the folder
 *   filter; remote = the remote models, the folder filter = their model families.
 * Pure (scripts/test-modeswitch7662.js): remoteWhere, noteOf.
 */
"use strict";

/** does Basic Settings ▸ GPU send images / video away? (pure) - split = gpuSplit.split() */
function remoteWhere(split) { const s = split || {}; return s.where === "remote" || (s.where === "both" && (!!s.image || !!s.video)); }
/** the words for the page (pure) */
function noteOf(mode, comfy) {
  if (mode === "local") return comfy === "starting" ? "Local mode - starting ComfyUI on this computer" : comfy === "running" ? "Local mode - ComfyUI is running on this computer" : comfy === "failed" ? "Local mode - ComfyUI could not be started (Settings ▸ ComfyUI)" : "Local mode";
  return comfy === "stopped" ? "Remote mode - ComfyUI on this computer was stopped (the pods render)" : comfy === "left" ? "Remote mode - ComfyUI on this computer was not started by bitGen, so it is still open - close it if you do not need it" : "Remote mode";
}
function modeOf() { try { return require("./remoteModels").podsMode() ? "remote" : "local"; } catch { return "local"; } }
async function after(before) {
  const mode = modeOf(), changed = !!before && before !== mode;
  if (!changed || process.env.H3_NO_MODE_SWITCH === "1") return { mode, changed, comfy: "", note: changed ? noteOf(mode, "") : "" };
  const C = require("./comfy");
  let comfy = "";
  try {
    if (mode === "local") {
      const st = await C.status();
      if (st.reachable) comfy = "running";
      else if ((st.backend || "comfy") !== "comfy") comfy = "";
      else { comfy = "starting"; C.ensure({ force: true }).catch(() => null); }
    } else {
      const r = C.stop();
      if (r && r.stopped) comfy = "stopped";
      else { const st = await C.status(); comfy = st.reachable ? "left" : ""; }
    }
  } catch { comfy = mode === "local" ? "failed" : ""; }
  return { mode, changed, comfy, note: noteOf(mode, comfy) };
}
module.exports = { remoteWhere, noteOf, modeOf, after };
