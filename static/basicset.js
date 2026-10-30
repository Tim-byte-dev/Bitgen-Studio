/* bitGen Studio — static/basicset.js (2.409.0): Basic Settings' OVERRIDE STYLE as one thing every video render sends.
 *
 * Tim: "if overide is checked in basic settings docker then all models including ltx2.3 and 2.5 use basic settings
 * including, cfg, steps, seed, model and loras, use prompt from prompt docker or prompt chat when video button is
 * pressed".
 *
 *   H3Basic.collect()  -> {override, steps, cfg, seed, model, loras} from Basic Settings (the video set)
 *   H3Basic.json()     -> the same as the `basic` form field (/api/generate, /api/ltx, the board's ▶)
 * The Model (override) box lists ComfyUI's models (GET /api/comfymodels - diffusion models, checkpoints, GGUF unets);
 * blank = the style's own. A line under the switch says what Override style is deciding right now.
 * The server side is lib/basicOverride.js (+ scripts/basic_apply.py for LTX's sigma schedule / guiders).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  var listed = false;

  function on() { var el = $("ovrStyle"); return el ? el.checked : true; }
  function loras() {
    try { return typeof tempLoras === "function" ? tempLoras("video") : []; } catch (e) { return []; }
  }
  function collect() {
    var st = $("steps"), cf = $("cfg"), sd = $("seed"), md = $("vidModel");
    return {
      override: on(),
      steps: st ? parseInt(st.value, 10) || 0 : 0,
      cfg: cf && cf.value !== "" ? parseFloat(cf.value) : null,
      seed: sd && sd.value !== "" ? parseInt(sd.value, 10) : -1,
      model: md ? md.value.trim() : "",
      loras: on() ? loras() : [],
    };
  }
  function json() { return JSON.stringify(collect()); }

  function summary() {
    var el = $("ovrSummary"); if (!el) return;
    if (!on()) { el.textContent = "Off: each style's own settings."; return; }
    var b = collect();
    el.textContent = "Every video model (MiniMax H3, Wan, LTX 2.3 / 2.5): "
      + (b.steps ? b.steps + " steps" : "its own steps") + " · cfg " + (b.cfg != null ? b.cfg : "its own")
      + " · " + (b.seed >= 0 ? "seed " + b.seed : "random seed") + " · " + (b.model ? b.model.split("/").pop() : "the style's model")
      + (b.loras.length ? " · +" + b.loras.length + " LoRA(s)" : "");
  }

  function fill() {
    if (listed) return;
    listed = true;
    fetch("/api/comfymodels").then(function (r) { return r.json(); }).then(function (j) {
      var cats = j.categories || {}, names = [];
      (j.model_categories || ["checkpoints", "diffusers", "diffusion_models"]).concat(["unet", "unet_gguf"]).forEach(function (k) {
        // 2.622.0: a category is {files: [{name}]} (lib/comfyModels.js) - read as a plain list it threw, and the list stayed EMPTY
        var c = cats[k], L = Array.isArray(c) ? c : ((c && c.files) || []).map(function (f) { return f && f.name; });
        L.forEach(function (n) { if (n && names.indexOf(n) < 0) names.push(n); });
      });
      var dl = $("vidModelList"); if (!dl) return;
      dl.innerHTML = names.map(function (n) { return '<option value="' + String(n).replace(/"/g, "&quot;") + '"></option>'; }).join("");
      listed = names.length > 0;                  // nothing yet (ComfyUI not found) - the next focus asks again
    }).catch(function () { listed = false; });
  }

  function boot() {
    var md = $("vidModel");
    if (!md || !$("ovrStyle")) { setTimeout(boot, 200); return; }
    var s = store();
    try { if (s && s.getItem("vidModel")) md.value = s.getItem("vidModel"); } catch (e) { /* fine */ }
    md.addEventListener("focus", fill);
    md.addEventListener("change", function () { try { if (s) s.setItem("vidModel", md.value.trim()); } catch (e) { /* fine */ } summary(); });
    md.addEventListener("keydown", function (e) { e.stopPropagation(); });
    ["ovrStyle", "steps", "cfg", "seed"].forEach(function (id) {
      var el = $(id); if (el) { el.addEventListener("input", summary); el.addEventListener("change", summary); }
    });
    var rows = $("tlvRows"); if (rows) rows.addEventListener("change", summary);
    setInterval(summary, 1500);              // the seed's 🎲 / ♻ and the LoRA rows change it from elsewhere
    summary();
  }
  window.H3Basic = { collect: collect, json: json, summary: summary, on: on };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
