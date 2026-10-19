/* ext/previewdock/seedvr2.js — ⏫ SEEDVR2 FOR THE PREVIEWED VIDEO (2.400.0; 2.401.0: the panel is static/seedvr2panel.js,
 * shared with the prompt docker's ⏫ Enhance).
 *
 * Tim (verbatim): "add seedvr2 for upscaling videos - seedvr2_7b_sharp_fp16.safetensors - ...
 * utility_seedvr2_3b_int8_upscale_video.json"
 *
 * The preview bar's ⏫ SeedVR2 opens the shared SeedVR2 panel for the video in the player (a gallery video, a Video
 * asset, an export) - a live preview of a running job is not a file and is refused in words.
 */
(function () {
  "use strict";
  const el = (id) => document.getElementById(id);
  if (!el("pvSeedvr2")) return;

  /** The video in the player, by name, or "" for a live preview / a picture. */
  function current() {
    let v = null;
    try { v = typeof curVideo !== "undefined" ? curVideo : null; } catch { v = null; }   // index.html's let
    const p = el("player");
    if (!v || /^__preview__/.test(String(v)) || !p || p.classList.contains("hidden")) return "";
    return String(v);
  }
  el("pvSeedvr2").addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (!window.SeedVR2Panel) return;
    if (SeedVR2Panel.shown()) { SeedVR2Panel.close(); return; }
    SeedVR2Panel.open({ name: current(), from: "preview", anchor: el("pvSeedvr2") });
  });
  // a new video in the player while the panel is open from here -> its own numbers
  const p = el("player");
  if (p) p.addEventListener("loadedmetadata", () => {
    if (window.SeedVR2Panel && SeedVR2Panel.shown() && SeedVR2Panel.state().from === "preview") SeedVR2Panel.retarget(current(), "preview");
  });
  window.PvSeedVR2 = { current, open: () => el("pvSeedvr2").click(), close: () => window.SeedVR2Panel && SeedVR2Panel.close() };
})();
