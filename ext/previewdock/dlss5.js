/* ext/previewdock/dlss5.js — ⚡ DLSS 5 FOR THE PREVIEWED VIDEO (2.504.0; the panel is static/dlss5panel.js).
 *
 * Tim linked https://github.com/RH-RunningHub/ComfyUI-RH-DLSS5 with his "secret sauce" H3 workflow (which ends in
 * DLSS 5 at 4K). The preview bar's ⚡ DLSS 5 opens the DLSS 5 panel for the video in the player - the same "which
 * video" rule as ⏫ SeedVR2 (ext/previewdock/seedvr2.js): a live preview of a running job is not a file.
 */
(function () {
  "use strict";
  const el = (id) => document.getElementById(id);
  if (!el("pvDlss5")) return;
  const current = () => (window.PvSeedVR2 && PvSeedVR2.current ? PvSeedVR2.current() : "");
  el("pvDlss5").addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (!window.Dlss5Panel) return;
    if (Dlss5Panel.shown()) { Dlss5Panel.close(); return; }
    if (window.SeedVR2Panel && SeedVR2Panel.shown()) SeedVR2Panel.close();
    Dlss5Panel.open({ name: current(), from: "preview", anchor: el("pvDlss5") });
  });
  const p = el("player");
  if (p) p.addEventListener("loadedmetadata", () => {
    if (window.Dlss5Panel && Dlss5Panel.shown() && Dlss5Panel.state().from === "preview") Dlss5Panel.retarget(current(), "preview");
  });
  window.PvDlss5 = { current, open: () => el("pvDlss5").click(), close: () => window.Dlss5Panel && Dlss5Panel.close() };
})();
