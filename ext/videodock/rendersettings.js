/* bitGen Studio — the video docker's ⚙ RENDER SETTINGS dropdown (2.312.0).
 *
 * Tim (verbatim): "add a settings button to the right of the video docker
 * menu bar. in the video docker . on click show a dropdown, with
 * resolution, steps, cfg, lora adder, sage attention checkbox, spectrum
 * checkbox, comfy kitchen checkbox, upscaler dropdown, upscale resolution.
 * Add a workflow for comfyui upscaler,
 * https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale".
 *
 * GET/POST /api/scenes/render-settings (lib/renderSettings) - every field
 * saves the moment it changes and every board render reads it. The LoRA
 * rows are the core temp-LoRA rows (mountTempLoras / addTempLoraTo) on the
 * SAME list as Basic Settings' video LoRAs. The upscaler list is ComfyUI's
 * models/latent_upscale_models (/api/comfymodels); the pack's install state
 * rides the settings answer (upscale_pack) and ⬇ clones it (/api/comfy/vaccel/install). */
(function () {
  "use strict";
  function el(id) { return document.getElementById(id); }
  if (!el("vdSetBtn")) return;
  var loaded = false, saving = null, lastSeed = null;

  function msg(t) { if (el("vdSetMsg")) el("vdSetMsg").textContent = t || ""; }

  function open(on) {
    var p = el("vdSetPanel");
    p.style.display = on ? "flex" : "none";
    el("vdSetBtn").setAttribute("aria-expanded", on ? "true" : "false");
    if (on) load();
  }
  el("vdSetBtn").addEventListener("click", function (ev) {
    ev.stopPropagation();
    open(el("vdSetPanel").style.display === "none");
  });
  document.addEventListener("click", function (ev) {
    var w = el("vdSetWrap");
    if (el("vdSetPanel").style.display !== "none" && w && !w.contains(ev.target)
        && !(ev.target.closest && ev.target.closest("dialog"))) open(false);
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && el("vdSetPanel").style.display !== "none") {
      open(false); el("vdSetBtn").focus();
    }
  });

  function paint(s) {
    el("vdSetRes").value = s.res || "";
    el("vdSetAspect").value = s.aspect || "16:9";
    el("vdSetSteps").value = s.steps == null ? "" : s.steps;
    el("vdSetCfg").value = s.cfg == null ? "" : s.cfg;
    el("vdSetSage").checked = !!s.sage;
    el("vdSetSpectrum").checked = !!s.spectrum;
    el("vdSetKitchen").checked = !!s.kitchen;
    if (el("vdSetLong")) el("vdSetLong").checked = !!s.long_run;              // 2.503.0
    var up = el("vdSetUpscaler");
    if (s.upscaler && ![].some.call(up.options, function (o) { return o.value === s.upscaler; })) {
      var o = document.createElement("option");
      o.value = s.upscaler; o.textContent = s.upscaler + " (not found)";
      up.appendChild(o);
    }
    up.value = s.upscaler || "";
    el("vdSetUpRes").value = s.upscale_res || "1080";
    el("vdSetUpAuto").checked = !!s.upscale_auto;          // 2.315.0
    if (el("vdSetH3Fit")) el("vdSetH3Fit").value = s.h3_fit === "up" ? "up" : "down";   // 2.380.0
    if (el("vdSetSeedMode")) {                                                              // 2.384.0
      el("vdSetSeedMode").value = s.seed_mode === "same" ? "same" : "random";
      if (document.activeElement !== el("vdSetSeed")) el("vdSetSeed").value = s.seed >= 0 ? s.seed : "";
      el("vdSetSeed").disabled = s.seed_mode !== "same";
      lastSeed = s.last_seed != null ? s.last_seed : null;
      el("vdSetSeedLast").textContent = lastSeed != null ? "last seed used: " + lastSeed : "no seed used yet";
      el("vdSetSeedUse").disabled = lastSeed == null;
    }
    // 2.313.0: the tail PNGs
    el("vdSetPngSize").value = s.png_size || "1080";
    var pu = el("vdSetPngUp");
    if (s.png_upscaler && ![].some.call(pu.options, function (o) { return o.value === s.png_upscaler; })) {
      var o2 = document.createElement("option");
      o2.value = s.png_upscaler; o2.textContent = s.png_upscaler + " (not found)";
      pu.appendChild(o2);
    }
    pu.value = s.png_upscaler || "";
    pu.disabled = (s.png_size || "1080") === "off";
    el("vdSetAspect").disabled = !s.res;
    el("vdSetUpRes").disabled = !s.upscaler;
    el("vdSetUpAuto").disabled = !s.upscaler;
  }
  function read() {
    return {
      res: el("vdSetRes").value, aspect: el("vdSetAspect").value,
      steps: el("vdSetSteps").value === "" ? null : parseInt(el("vdSetSteps").value, 10),
      cfg: el("vdSetCfg").value === "" ? null : parseFloat(el("vdSetCfg").value),
      sage: el("vdSetSage").checked, spectrum: el("vdSetSpectrum").checked,
      kitchen: el("vdSetKitchen").checked,
      long_run: el("vdSetLong") ? el("vdSetLong").checked : false,            // 2.503.0: Long video
      upscaler: el("vdSetUpscaler").value, upscale_res: el("vdSetUpRes").value,
      upscale_auto: el("vdSetUpAuto").checked,
      png_size: el("vdSetPngSize").value, png_upscaler: el("vdSetPngUp").value,
      h3_fit: el("vdSetH3Fit") ? el("vdSetH3Fit").value : "down",           // 2.380.0
      // 2.384.0: the seed rule for the board's scenes (lib/sceneSeed)
      seed_mode: el("vdSetSeedMode") ? el("vdSetSeedMode").value : "random",
      seed: el("vdSetSeed") && el("vdSetSeed").value !== "" ? parseInt(el("vdSetSeed").value, 10) : -1
    };
  }
  function sizeLine(p) {
    if (!el("vdSetSize")) return;
    el("vdSetSize").textContent = p ? ("renders at " + p.width + "x" + p.height
      + (p.upscale ? (el("vdSetUpAuto").checked ? " -> upscaled to " : " · ⏫ upscales a take to ")
        + p.upscale.width + "x" + p.upscale.height : "")) : "";
  }
  function save() {
    clearTimeout(saving);
    saving = setTimeout(function () {
      fetch("/api/scenes/render-settings", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: read() }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || j.error) { msg((j && j.error) || "not saved"); return; }
          paint(j.settings); sizeLine(j.preview);
          msg("saved - the next scene render uses it");
        }).catch(function (e) { msg("not saved: " + e.message); });
    }, 250);
  }
  ["vdSetRes", "vdSetAspect", "vdSetSage", "vdSetSpectrum", "vdSetKitchen", "vdSetLong",
   "vdSetUpscaler", "vdSetUpRes", "vdSetUpAuto", "vdSetPngSize", "vdSetPngUp", "vdSetH3Fit"].forEach(function (id) {
    if (el(id)) el(id).addEventListener("change", save);
  });
  ["vdSetSeedMode", "vdSetSeed"].forEach(function (id) {   // 2.384.0
    if (el(id)) el(id).addEventListener("change", save);
  });
  // 2.384.0: ♻ the last seed used becomes the seed (and 'Same seed for every scene' goes on)
  if (el("vdSetSeedUse")) el("vdSetSeedUse").addEventListener("click", function () {
    if (lastSeed == null) return;
    el("vdSetSeedMode").value = "same"; el("vdSetSeed").disabled = false; el("vdSetSeed").value = lastSeed;
    save();
  });
  ["vdSetSteps", "vdSetCfg"].forEach(function (id) {
    el(id).addEventListener("change", save);
  });
  // 2.380.0: the karaoke overlay's look (static/karaokestyle.js - the same dialog as the timeline's ⚙)
  if (el("vdSetKaraoke")) el("vdSetKaraoke").addEventListener("click", function () {
    if (window.KaraokeStyle) window.KaraokeStyle.open(); else msg("reload the app to load the karaoke style dialog");
  });
  // the panel's own clicks never reach the document closer
  el("vdSetPanel").addEventListener("click", function (ev) { ev.stopPropagation(); });

  el("vdSetLoraAdd").addEventListener("click", function () {
    if (typeof window.addTempLoraTo === "function") window.addTempLoraTo("video", "vdSetLoras");
    else msg("the LoRA rows need the page's core (reload the app)");
  });

  function upscalers() {
    return fetch("/api/comfymodels").then(function (r) { return r.json(); })
      .then(function (d) {
        var opt = function (n) {
          return '<option value="' + n.replace(/"/g, "&quot;") + '">' + n.replace(/</g, "&lt;") + "</option>";
        };
        var cats = (d || {}).categories || {};
        var files = ((cats.latent_upscale_models || {}).files || []).map(function (f) { return f.name; });
        var up = el("vdSetUpscaler"), keep = up.value;
        // 2.400.0: SeedVR2 (video) - ⏫ sends the take through ComfyUI's core SeedVR2 nodes as its own job
        up.innerHTML = '<option value="">Off</option>'
          + '<option value="seedvr2">SeedVR2 (video) - the take as its own job</option>'
          + '<option value="dlss5">DLSS 5 (NVIDIA RTX) - the take as its own job</option>' + files.map(opt).join("");   // 2.504.0
        up.value = keep;
        // 2.313.0: the image upscale models (ESRGAN & co) for the tail PNGs
        var imgs = ((cats.upscale_models || {}).files || []).map(function (f) { return f.name; });
        var pu = el("vdSetPngUp"), keep2 = pu.value;
        pu.innerHTML = '<option value="">Lanczos (no model)</option>'
          + '<option value="seedvr2">SeedVR2 7B (ComfyUI workflow)</option>' + imgs.map(opt).join("");
        pu.value = keep2;
        return files;
      }).catch(function () { return []; });
  }
  function pack(u) {
    return Promise.resolve(u).then(function (u) {
        var ok = !!(u && u.installed);
        el("vdSetPack").textContent = ok ? "MMH3 Ultimate Upscale pack installed"
          : "the MMH3 Ultimate Upscale pack is not in ComfyUI's custom_nodes";
        el("vdSetPackInstall").style.display = ok ? "none" : "";
      }).catch(function () { el("vdSetPack").textContent = ""; });
  }
  el("vdSetPackInstall").addEventListener("click", function () {
    msg("installing the upscaler pack - the app console shows git's output");
    fetch("/api/comfy/vaccel/install", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ what: "upscale" }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        msg(j && j.started ? "cloning into " + (j.target || "custom_nodes")
          + " - restart ComfyUI when it finishes, then put a 3D upscaler model in models/latent_upscale_models"
          : "not started: " + ((j && (j.reason || j.error)) || "unknown"));
      }).catch(function (e) { msg("not started: " + e.message); });
  });

  function load() {
    return Promise.all([
      fetch("/api/scenes/render-settings").then(function (r) { return r.json(); }),
      upscalers()
    ]).then(function (res) {
      var d = res[0] || {};
      paint(d.settings || {});
      if (typeof window.mountTempLoras === "function")
        window.mountTempLoras("video", "vdSetLoras", d.loras || []);
      loaded = true;
      pack(d.upscale_pack);
    }).catch(function (e) { msg("could not read the settings: " + e.message); });
  }
  window.vdRenderSettings = { open: open, load: load, read: read };
})();
