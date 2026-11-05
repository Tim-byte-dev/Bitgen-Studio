// bitGen Studio — routes/mossGuard.js (2.668.0): a MOSS-Image picture is refused BEFORE it is queued when the running ComfyUI
// cannot render it. Mounted from routes/index.js right before POST /api/genimage (never server.js).
//
// Tim: "moss image is not working". MOSS-Image came in ComfyUI 0.42.0; 0.41.x builds that already list the moss_image text
// encoder and 0.42.1 render PURE NOISE (Comfy-Org/MOSS-Image discussion #5) - no error to catch afterwards, so the version is
// checked first (lib/mossAddon.js comfySupport / tooOldMessage: /system_stats + CLIPLoader's types, cached 60 s). ComfyUI not
// answering = let the job go (it starts ComfyUI / reports its own error).
"use strict";

let cache = { at: 0, url: "", cs: null };

async function check(url) {
  const now = Date.now();
  if (cache.cs && cache.url === url && now - cache.at < 60000) return cache.cs;
  const cs = await require("../lib/mossAddon").comfySupport({ url });
  if (cs.online) cache = { at: now, url, cs };
  return cs;
}

function mount(app) {
  app.post("/api/genimage", (req, res, next) => {
    let style = null;
    try { const core = require("../lib/core"), styles = require("../lib/styles"); style = styles.byId(core.STYLES_DIR, String((req.body || {}).style_id || "")); } catch (e) { style = null; }
    if (!style || style.arch !== "moss") return next();
    let url = ""; try { url = require("../lib/comfy").comfyCfg().url; } catch (e) { url = ""; }
    if (!url) return next();
    check(url).then((cs) => {
      const msg = require("../lib/mossAddon").tooOldMessage(cs);
      if (msg) return res.status(409).json({ error: msg, comfy_version: cs.version || null, needs: require("../lib/mossAddon").MIN_VERSION });
      next();
    }).catch(() => next());
  });
}

/** for the tests: forget the cached answer */
function reset() { cache = { at: 0, url: "", cs: null }; }

module.exports = { mount, reset };
