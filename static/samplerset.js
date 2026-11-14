/* bitGen Studio — static/samplerset.js (2.781.0): BASIC SETTINGS ▸ SAMPLER / SCHEDULER, ABOVE THE CHECKPOINT AND THE VIDEO MODEL
 * (window.H3Samplers; lib/samplers.js, GET /api/samplers).
 * Tim (verbatim): "want to stry different models - choose a style and use the basic settings docker to quickly change your model,
 * add loras or change the sampler settings ... that reminds me, please add a list of samplers to the basic settings docker above
 * the checkpoint dropdowns."
 *   Pictures (#imgSampler / #imgScheduler) and video (#vidSampler / #vidScheduler), each "Style's own" first, then ComfyUI's
 *   own names (the ComfyUI renders go to; ComfyUI's standard names until it answers). With Override style on, a render of that
 *   kind carries the pick in the X-Bitgen-Sampler header (this file wraps fetch: /api/genimage, /api/aiedit… = pictures;
 *   /api/generate, /api/ltx = video); the server writes it into the workflow's sampler nodes (scripts/comfy_client.py). Kept
 *   here (localStorage h3.samplers) and by Basic Settings' own memory (basic.cfg, per style, per tab).
 * Pure (Node: scripts/test-samplers781.js): kindOfUrl, headerOf, merge.
 */
(function (root) {
  "use strict";
  var WORDS = { sampler: { label: "Sampler" }, scheduler: { label: "Scheduler" }, own: { label: "Style's own" } };   // (label: - the UI translations read it)
  var BUILTIN = { samplers: ["euler", "euler_cfg_pp", "euler_ancestral", "euler_ancestral_cfg_pp", "heun", "heunpp2", "dpm_2", "dpm_2_ancestral", "lms",
    "dpm_fast", "dpm_adaptive", "dpmpp_2s_ancestral", "dpmpp_2s_ancestral_cfg_pp", "dpmpp_sde", "dpmpp_sde_gpu", "dpmpp_2m", "dpmpp_2m_cfg_pp",
    "dpmpp_2m_sde", "dpmpp_2m_sde_gpu", "dpmpp_3m_sde", "dpmpp_3m_sde_gpu", "ddpm", "lcm", "ipndm", "ipndm_v", "deis", "res_multistep",
    "res_multistep_cfg_pp", "res_multistep_ancestral", "res_multistep_ancestral_cfg_pp", "gradient_estimation", "er_sde", "seeds_2", "seeds_3",
    "sa_solver", "sa_solver_pece", "ddim", "uni_pc", "uni_pc_bh2"],
    schedulers: ["simple", "sgm_uniform", "karras", "exponential", "ddim_uniform", "beta", "normal", "linear_quadratic", "kl_optimal"] };
  /** which Basic Settings a render's address belongs to (pure): image | video | "" */
  function kindOfUrl(u) {
    var p = String(u || "").replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (/^\/api\/(genimage|aiedit)(\/|$)/.test(p)) return "image";
    if (/^\/api\/(generate|ltx)(\/|$)/.test(p)) return "video";
    return "";
  }
  /** the header's value for a pick (pure) - "" when both are the style's own */
  function headerOf(p) { var s = String((p && p.sampler) || ""), c = String((p && p.scheduler) || ""); return s || c ? JSON.stringify({ sampler: s, scheduler: c }) : ""; }
  /** ComfyUI's list with a kept pick that is not in it (still shown, so it is not lost) (pure) */
  function merge(list, keep) { var L = (list || []).slice(); if (keep && L.indexOf(keep) < 0) L.unshift(keep); return L; }
  var pure = { kindOfUrl: kindOfUrl, headerOf: headerOf, merge: merge, BUILTIN: BUILTIN };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, LISTS = { samplers: BUILTIN.samplers, schedulers: BUILTIN.schedulers, from: "builtin" };
  var SPOTS = [["image", "imgSampler", "imgScheduler", "useImgModel", "imgCkptCombo"], ["video", "vidSampler", "vidScheduler", "useVidModel", "vidModel"]];
  function $(id) { return doc.getElementById(id); }
  function kept() { try { return JSON.parse(root.localStorage.getItem("h3.samplers") || "{}") || {}; } catch (e) { return {}; } }
  function keep() { var o = {}; SPOTS.forEach(function (s) { [s[1], s[2]].forEach(function (id) { var e = $(id); if (e) o[id] = e.value; }); }); try { root.localStorage.setItem("h3.samplers", JSON.stringify(o)); } catch (e) { /* fine */ } }
  function fill(sel, list, val) {
    sel.innerHTML = "";
    var o0 = doc.createElement("option"); o0.value = ""; o0.textContent = "— " + WORDS.own.label + " —"; sel.appendChild(o0);
    merge(list, val).forEach(function (n) { var o = doc.createElement("option"); o.value = n; o.textContent = n; sel.appendChild(o); });
    sel.value = val || "";
  }
  /** where the row goes: above the Use model tick (static/ovruse.js) over the checkpoint / video model, else above that field's label */
  function anchorOf(s) {
    var u = $(s[3]); if (u && u.closest("label")) return u.closest("label");
    var f = $(s[4]); if (!f) return null;
    var l = doc.querySelector('label[for="' + s[4] + '"]'); if (l) return l;
    var p = f.previousElementSibling; while (p && p.tagName !== "LABEL") p = p.previousElementSibling;
    return p || f;
  }
  function build() {
    var n = 0, K = kept();
    SPOTS.forEach(function (s) {
      if ($(s[1])) { n++; return; }
      var a = anchorOf(s); if (!a || !a.parentNode) return;
      var row = doc.createElement("div"); row.className = "samplerRow"; row.dataset.kind = s[0];
      row.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 0";
      row.innerHTML = '<label class="f" style="margin:0;display:flex;flex-direction:column;gap:2px">' + WORDS.sampler.label + ' <select id="' + s[1] + '"></select></label>'
        + '<label class="f" style="margin:0;display:flex;flex-direction:column;gap:2px">' + WORDS.scheduler.label + ' <select id="' + s[2] + '"></select></label>';
      a.parentNode.insertBefore(row, a);
      fill($(s[1]), LISTS.samplers, K[s[1]] || ""); fill($(s[2]), LISTS.schedulers, K[s[2]] || "");
      [s[1], s[2]].forEach(function (id) { $(id).title = "With Override style on, a " + (s[0] === "image" ? "picture" : "video") + " render uses it in every sampler node of the style's workflow that takes it (Style's own = as the workflow has it). A distilled model's fixed steps stay."; $(id).addEventListener("change", keep); });
      n++;
    });
    return n === SPOTS.length;
  }
  function relist() {
    root.fetch("/api/samplers").then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !Array.isArray(j.samplers) || !j.samplers.length) return;
      LISTS = j;
      SPOTS.forEach(function (s) { var a = $(s[1]), b = $(s[2]); if (a) fill(a, j.samplers, a.value); if (b) fill(b, j.schedulers || BUILTIN.schedulers, b.value); });
    }).catch(function () { /* the standard names stay */ });
  }
  function pickOf(kind) {
    var s = SPOTS.filter(function (x) { return x[0] === kind; })[0]; if (!s) return null;
    return { sampler: ($(s[1]) || {}).value || "", scheduler: ($(s[2]) || {}).value || "" };
  }
  /** a render of pictures / video goes with the pick while Override style is on */
  var f0 = root.fetch;
  root.fetch = function (u, init) {
    try {
      var m = String((init && init.method) || "GET").toUpperCase(), k = m === "POST" ? kindOfUrl(typeof u === "string" ? u : (u && u.url) || "") : "";
      var on = k && typeof root.ovrStyleOn === "function" ? root.ovrStyleOn() : false, h = on ? headerOf(pickOf(k)) : "";
      if (h) { var H = new root.Headers((init && init.headers) || {}); H.set("X-Bitgen-Sampler", h); init = Object.assign({}, init || {}, { headers: H }); }
    } catch (e) { /* the request goes as it was */ }
    return f0.apply(this, [u, init]);
  };
  function boot(tries) {
    if (!build() && (tries || 0) < 60) { setTimeout(function () { boot((tries || 0) + 1); }, 500); return; }
    relist();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { boot(0); }); else boot(0);
  root.H3Samplers = Object.assign({ pick: pickOf, lists: function () { return LISTS; }, relist: relist }, pure);
})(typeof window !== "undefined" ? window : globalThis);
