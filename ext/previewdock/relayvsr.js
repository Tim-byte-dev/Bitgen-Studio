/* ext/previewdock/relayvsr.js — 🔁 RelayVSR FOR THE PREVIEWED VIDEO (2.728.0; the panel is static/relayvsrpanel.js).
 *
 * Tim (verbatim): "yes please add a 1920x1080 automatic preset and add https://github.com/kopperx/RelayVSR". The preview
 * bar's 🔁 RelayVSR opens the RelayVSR panel for the video in the player - the same "which video" rule as ⏫ SeedVR2
 * (ext/previewdock/seedvr2.js): a live preview of a running job is not a file. One upscale panel open at a time.
 */
(function () {
  "use strict";
  const el = (id) => document.getElementById(id);
  if (!el("pvRelayvsr")) return;
  const current = () => (window.PvSeedVR2 && PvSeedVR2.current ? PvSeedVR2.current() : "");
  el("pvRelayvsr").addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (!window.RelayVsrPanel) return;
    if (RelayVsrPanel.shown()) { RelayVsrPanel.close(); return; }
    for (const P of [window.SeedVR2Panel, window.Dlss5Panel, window.RtxVfxPanel, window.FlowHmrPanel]) if (P && P.shown()) P.close();
    RelayVsrPanel.open({ name: current(), from: "preview", anchor: el("pvRelayvsr") });
  });
  const p = el("player");
  if (p) p.addEventListener("loadedmetadata", () => {
    if (window.RelayVsrPanel && RelayVsrPanel.shown() && RelayVsrPanel.state().from === "preview") RelayVsrPanel.retarget(current(), "preview");
  });
  window.PvRelayVsr = { current, open: () => el("pvRelayvsr").click(), close: () => window.RelayVsrPanel && RelayVsrPanel.close() };
})();
