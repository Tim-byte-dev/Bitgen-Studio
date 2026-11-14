/* bitGen Studio — lib/samplers.js (2.781.0): BASIC SETTINGS ▸ SAMPLER / SCHEDULER FOR ANY STYLE.
 * Tim (verbatim): "want to stry different models - choose a style and use the basic settings docker to quickly change your
 * model, add loras or change the sampler settings ... that reminds me, please add a list of samplers to the basic settings
 * docker above the checkpoint dropdowns."
 *   The lists are ComfyUI's own (its KSampler's sampler_name / scheduler choices, asked of the ComfyUI renders go to - the pod
 *   in use in remote mode, else this computer's), else ComfyUI's standard names (BUILTIN). "Style's own" = nothing changes.
 *   The page (static/samplerset.js) sends the pick with a render in the X-Bitgen-Sampler header ({sampler, scheduler}) while
 *   Override style is on. middleware(): that header -> a request context (AsyncLocalStorage; the request's own stream
 *   listeners bound to it, so a multipart upload keeps it too) -> lib/core.js makeJob keeps it as job.params.comfy_sampler and
 *   starts the worker with BITGEN_SAMPLER / BITGEN_SCHEDULER -> scripts/comfy_client.py queue() writes them into every sampler
 *   node of the graph it sends (KSampler, KSamplerAdvanced, KSamplerSelect, BasicScheduler …), each name checked against that
 *   ComfyUI's own list first (one it does not have is left as the workflow had it, and said in the log).
 *   GET /api/samplers  -> {samplers, schedulers, from: "comfyui" | "builtin", url?}
 * Pure (scripts/test-samplers781.js): clean, comboOf, BUILTIN.
 */
"use strict";
const { AsyncLocalStorage, AsyncResource } = require("async_hooks");

// ComfyUI's standard names (comfy/samplers.py KSampler.SAMPLERS / SCHEDULER_NAMES) - shown until a ComfyUI answers
const BUILTIN = {
  samplers: ["euler", "euler_cfg_pp", "euler_ancestral", "euler_ancestral_cfg_pp", "heun", "heunpp2", "dpm_2", "dpm_2_ancestral", "lms",
    "dpm_fast", "dpm_adaptive", "dpmpp_2s_ancestral", "dpmpp_2s_ancestral_cfg_pp", "dpmpp_sde", "dpmpp_sde_gpu", "dpmpp_2m", "dpmpp_2m_cfg_pp",
    "dpmpp_2m_sde", "dpmpp_2m_sde_gpu", "dpmpp_3m_sde", "dpmpp_3m_sde_gpu", "ddpm", "lcm", "ipndm", "ipndm_v", "deis", "res_multistep",
    "res_multistep_cfg_pp", "res_multistep_ancestral", "res_multistep_ancestral_cfg_pp", "gradient_estimation", "er_sde", "seeds_2", "seeds_3",
    "sa_solver", "sa_solver_pece", "ddim", "uni_pc", "uni_pc_bh2"],
  schedulers: ["simple", "sgm_uniform", "karras", "exponential", "ddim_uniform", "beta", "normal", "linear_quadratic", "kl_optimal"],
};
const NAME = /^[A-Za-z0-9_.+-]{1,60}$/;
/** {sampler, scheduler} from the page -> only names that look like ComfyUI's ("" = the style's own); null = nothing to do (pure) */
function clean(o) {
  let b = o;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== "object") return null;
  const s = NAME.test(String(b.sampler || "")) ? String(b.sampler) : "", c = NAME.test(String(b.scheduler || "")) ? String(b.scheduler) : "";
  return s || c ? { sampler: s, scheduler: c } : null;
}
/** a combo's choices from an /object_info input spec (pure): [[...], {...}] or ["COMBO", {options: [...]}] */
function comboOf(spec) {
  if (!Array.isArray(spec)) return [];
  if (Array.isArray(spec[0])) return spec[0].map(String);
  return (((spec[1] || {}).options) || []).map(String);
}

/* ---------------- the lists */
let CACHE = null;
function urls() {
  const out = [];
  try {   // remote mode: the pod in use first
    const c = require("./core").getConfig() || {}, rg = c.rgpu || {}, rp = rg.runpod || {};
    if (rp.pod_id && rg.enabled !== false && ((rg.split || {}).where || "local") !== "local") out.push(require("./runpodApi").proxyUrl(rp.pod_id, +rp.port || 8188));
  } catch { /* local only */ }
  try { out.push(require("./comfy").comfyCfg().url); } catch { out.push("http://127.0.0.1:8188"); }
  return out.filter(Boolean);
}
async function list(o) {
  const opt = o || {};
  if (CACHE && Date.now() - CACHE.at < 120000 && !opt.refresh) return CACHE.v;
  const f = opt.fetch || fetch;
  for (const u of (opt.urls || urls())) {
    try {
      const r = await f(String(u).replace(/\/$/, "") + "/object_info/KSampler", { signal: AbortSignal.timeout(opt.timeout || 4000), headers: { "User-Agent": "bitGen-Studio" } });
      if (!r.ok) continue;
      const j = await r.json(), req = ((((j || {}).KSampler || {}).input || {}).required) || {};
      const s = comboOf(req.sampler_name), c = comboOf(req.scheduler);
      if (s.length) { const v = { samplers: s, schedulers: c.length ? c : BUILTIN.schedulers, from: "comfyui", url: u }; CACHE = { at: Date.now(), v }; return v; }
    } catch { /* the next one */ }
  }
  const v = { samplers: BUILTIN.samplers, schedulers: BUILTIN.schedulers, from: "builtin" };
  CACHE = { at: Date.now(), v };
  return v;
}

/* ---------------- the render's pick, from the page's header to the job */
const ALS = new AsyncLocalStorage();
function middleware(req, res, next) {
  const h = req.method === "POST" ? req.get("x-bitgen-sampler") : "";
  const pick = h ? clean(h) : null;
  if (!pick) return next();
  ALS.run(pick, () => {
    // a multipart upload (multer / busboy) reads the request in its own stream events - bind them to this request's pick
    for (const m of ["on", "once", "addListener", "prependListener"]) {
      const o = req[m]; if (typeof o !== "function") continue;
      req[m] = function (ev, fn) { return o.call(this, ev, typeof fn === "function" ? AsyncResource.bind(fn) : fn); };
    }
    next();
  });
}
/** the pick of the request being answered (lib/core.js makeJob) - null outside one */
function current() { return ALS.getStore() || null; }
/** the worker's environment for a job (lib/core.js spawn) */
function envOf(params) {
  const p = clean(params && params.comfy_sampler);
  return p ? { BITGEN_SAMPLER: p.sampler, BITGEN_SCHEDULER: p.scheduler } : {};
}
function mount(app) {
  app.get("/api/samplers", async (req, res) => { try { res.json(await list({ refresh: req.query.refresh === "1" })); } catch (e) { res.json(Object.assign({ error: String(e.message || e) }, BUILTIN, { from: "builtin" })); } });
}
module.exports = { BUILTIN, clean, comboOf, list, middleware, current, envOf, mount, ALS };
