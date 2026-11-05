// bitGen Studio — routes/ph3Guard.js (2.678.0): a P-H3 Image picture is refused BEFORE it is queued when the running ComfyUI
// has no P-H3 nodes (PH3ImageConditioning - ComfyUI's master branch / the nightly until 0.44), with the words to update it,
// instead of ComfyUI's "node not found". Mounted from routes/index.js right before POST /api/genimage (never server.js).
// Tim (verbatim): "please add this image edit model, https://huggingface.co/PrunaAI/P-H3-Image-Comfy"
// ComfyUI not answering = let the job go (it starts ComfyUI / reports its own error). Cached 60 s.
"use strict";

let cache = { at: 0, url: "", cs: null };

async function check(url) {
  const now = Date.now();
  if (cache.cs && cache.url === url && now - cache.at < 60000) return cache.cs;
  const cs = await require("../lib/ph3Addon").comfySupport({ url });
  if (cs.online) cache = { at: now, url, cs };
  return cs;
}

function mount(app) {
  app.post("/api/genimage", (req, res, next) => {
    let style = null;
    try { const core = require("../lib/core"), styles = require("../lib/styles"); style = styles.byId(core.STYLES_DIR, String((req.body || {}).style_id || "")); } catch (e) { style = null; }
    if (!style || style.arch !== "ph3") return next();
    let url = ""; try { url = require("../lib/comfy").comfyCfg().url; } catch (e) { url = ""; }
    if (!url) return next();
    check(url).then((cs) => {
      const msg = require("../lib/ph3Addon").missingMessage(cs);
      if (msg) return res.status(409).json({ error: msg, needs: "ComfyUI with " + require("../lib/ph3Addon").NODE });
      next();
    }).catch(() => next());
  });
}

/** for the tests: forget the cached answer */
function reset() { cache = { at: 0, url: "", cs: null }; }

module.exports = { mount, reset };
