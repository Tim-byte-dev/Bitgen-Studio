/* bitGen Studio — lib/ueLive.js (2.590.0): THE 📺 UNREAL VIEW on the server - one live frame at a time.
 *
 * Tim (verbatim): "unreal connection works. do i have to keep the unreal window open? show the unreal window in timeline
 * and image-editor when selected" (picked: a live camera view). The page (static/uelive.js) asks for a frame, shows it,
 * asks for the next: what the selected layer's / clip's camera sees, as it is now in Unreal.
 *   frame(o)      o = a still's request (lib/unreal.cleanStill: camera, level, lens, rig, metahuman, w, h) + client +
 *                 sequence / time (a timeline clip of a Level Sequence: the frame under the playhead) -> {file, ms, legacy}
 *                 - bitGen Bridge 1.5.0's "frame" (one editor frame to settle); an older bridge = its "still" (slower; no
 *                 sequence clips). The picture is overwritten each time: projects/<p>/unreal/live/live_<client>.png
 *   keepFast(on)  -> {was_throttled, throttled} - the editor keeps full speed behind bitGen (1.5.0's "keep_fast")
 *   cleanFrame(o) the checks (pure but for lib/unreal's)
 * Routes: routes/unreal.js (POST /api/unreal/frame -> the PNG, POST /api/unreal/keepfast).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ue = require("./unreal");
const core = require("./core");

const MAX_W = 1280, MAX_H = 720;
const assetPath = (p) => (typeof p === "string" && /^\/[A-Za-z0-9_\-/. ]+$/.test(p) && !p.includes("..") ? p : null);
const clientOf = (v) => String(v || "page").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "page";
const unknown = (e, cmd) => /unknown command/.test(String((e && e.message) || "")) && new RegExp("\\b" + cmd + "\\b").test(e.message);

function cleanFrame(o) {
  const x = o || {};
  const c = ue.cleanStill(Object.assign({}, x, { w: Math.min(MAX_W, Math.max(16, +x.w || 640)), h: Math.min(MAX_H, Math.max(16, +x.h || 360)) }));
  if (x.sequence) {
    c.sequence = assetPath(x.sequence); if (!c.sequence) { const e = new Error("the sequence is not an asset path"); e.status = 400; throw e; }
    c.time = Math.max(0, Number(x.time) || 0);
  }
  return c;
}
function liveDir() { const d = path.join(core.projDir(core.getProject()), "unreal", "live"); fs.mkdirSync(d, { recursive: true }); return d; }

async function frame(o, deps) {
  const call = (deps && deps.call) || ue.call;
  const c = cleanFrame(o);
  c.out = path.join((deps && deps.dir) || liveDir(), "live_" + clientOf((o || {}).client) + ".png");
  const t0 = Date.now();
  let legacy = false;
  try { await call("frame", c, 60000); }
  catch (e) {
    if (!unknown(e, "frame")) throw e;
    legacy = true;                                          // a 1.4.0 bridge: its still (three frames to settle)
    if (c.sequence) { const er = new Error("a sequence clip's live view needs the bitGen Bridge plugin 1.5.0 - update it (🎮 Load UE project updates it)"); er.status = 422; throw er; }
    const b = Object.assign({}, c); delete b.time;
    await call("still", b, 60000);
  }
  if (!fs.existsSync(c.out)) { const e = new Error("Unreal did not write the frame"); e.status = 502; throw e; }
  return { file: c.out, ms: Date.now() - t0, legacy };
}
async function keepFast(on, deps) {
  const call = (deps && deps.call) || ue.call;
  try { return await call("keep_fast", { on: on !== false }, 15000); }
  catch (e) {
    if (unknown(e, "keep_fast")) { const er = new Error("the bitGen Bridge plugin in your Unreal project is older than 1.5.0 - update it (🎮 Load UE project updates it), or untick Editor Preferences ▸ General ▸ Performance ▸ Use Less CPU when in Background by hand"); er.status = 422; throw er; }
    throw e;
  }
}
module.exports = { MAX_W, MAX_H, cleanFrame, frame, keepFast, clientOf };
