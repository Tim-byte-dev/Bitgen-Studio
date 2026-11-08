/* ext/previewdock/rtxvfx.js — ✨ RTX VFX FOR THE PREVIEWED VIDEO (2.708.0; the panel is static/rtxvfxpanel.js).
 *
 * Tim: "Add the RTX upscale" - the DENO pack's NVIDIA RTX video finisher. The preview bar's ✨ RTX VFX opens the panel for
 * the video in the player - the same "which video" rule as ⏫ SeedVR2 / ⚡ DLSS 5 (a live preview of a running job is not
 * a file). One floating panel at a time: it closes the other two.
 */
(function () {
  "use strict";
  const el = (id) => document.getElementById(id);
  if (!el("pvRtxvfx")) return;
  const current = () => (window.PvSeedVR2 && PvSeedVR2.current ? PvSeedVR2.current() : "");
  el("pvRtxvfx").addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (!window.RtxVfxPanel) return;
    if (RtxVfxPanel.shown()) { RtxVfxPanel.close(); return; }
    if (window.SeedVR2Panel && SeedVR2Panel.shown()) SeedVR2Panel.close();
    if (window.Dlss5Panel && Dlss5Panel.shown()) Dlss5Panel.close();
    if (window.RelayVsrPanel && RelayVsrPanel.shown()) RelayVsrPanel.close();   // 2.728.0
    RtxVfxPanel.open({ name: current(), from: "preview", anchor: el("pvRtxvfx") });
  });
  const p = el("player");
  if (p) p.addEventListener("loadedmetadata", () => {
    if (window.RtxVfxPanel && RtxVfxPanel.shown() && RtxVfxPanel.state().from === "preview") RtxVfxPanel.retarget(current(), "preview");
  });
  window.PvRtxVfx = { current, open: () => el("pvRtxvfx").click(), close: () => window.RtxVfxPanel && RtxVfxPanel.close() };
})();
