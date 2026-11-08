/* ext/previewdock/flowhmr.js — 🕺 MOTION FOR THE PREVIEWED VIDEO (2.730.0; the panel is static/flowhmrpanel.js).
 *
 * Tim (verbatim): "https://flowhmr.github.io/ . we can add a reference video for motion?" + "add it to addons with a
 * disclaimer that it is for non commercial use only". The preview bar's 🕺 Motion opens the FlowHMR panel for the video in
 * the player - the same "which video" rule as ⏫ SeedVR2 (ext/previewdock/seedvr2.js). One panel of the bar at a time.
 */
(function () {
  "use strict";
  const el = (id) => document.getElementById(id);
  if (!el("pvFlowhmr")) return;
  const current = () => (window.PvSeedVR2 && PvSeedVR2.current ? PvSeedVR2.current() : "");
  el("pvFlowhmr").addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (!window.FlowHmrPanel) return;
    if (FlowHmrPanel.shown()) { FlowHmrPanel.close(); return; }
    for (const P of [window.SeedVR2Panel, window.Dlss5Panel, window.RtxVfxPanel, window.RelayVsrPanel]) if (P && P.shown()) P.close();
    FlowHmrPanel.open({ name: current(), from: "preview", anchor: el("pvFlowhmr") });
  });
  const p = el("player");
  if (p) p.addEventListener("loadedmetadata", () => {
    if (window.FlowHmrPanel && FlowHmrPanel.shown() && FlowHmrPanel.state().from === "preview") FlowHmrPanel.retarget(current(), "preview");
  });
  window.PvFlowHmr = { current, open: () => el("pvFlowhmr").click(), close: () => window.FlowHmrPanel && FlowHmrPanel.close() };
})();
