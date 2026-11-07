/* bitGen Studio — static/vram16.js (2.708.0): Settings ▸ ComfyUI ▸ 16 GB MODE (window.H3Vram16).
 * Tim: "this workflow is meant to work with 16gb vram - minimax" - his pick: "16 GB mode for my H3 renders".
 * The switch (Auto / On / Off), the upscale of pass 2 and the 8-step pass 1 are saved with the rest of Settings
 * (engine.comfy.vram16 - fill / read, called by index.html's settings load / save); the status line lists the card,
 * the files and the node packs (GET /api/vram16, lib/vram16.js). ⤓ opens Settings ▸ Add-ons ▸ 16 GB mode.
 * The render side: scripts/h3_16gb.py through misc/worker.py. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DEF = { mode: "auto", scale: 1.5, turbo: true };
  function fill(v) {
    const c = Object.assign({}, DEF, v && typeof v === "object" ? v : {});
    if ($("s_c16mode")) $("s_c16mode").value = ["auto", "on", "off"].includes(c.mode) ? c.mode : "auto";
    if ($("s_c16scale")) $("s_c16scale").value = String(c.scale);
    if ($("s_c16turbo")) $("s_c16turbo").checked = c.turbo !== false;
    sync();
  }
  function read() {
    let sc = parseFloat(($("s_c16scale") || {}).value);
    sc = Number.isFinite(sc) ? Math.min(2, Math.max(1, Math.round(sc * 100) / 100)) : DEF.scale;
    return { mode: ($("s_c16mode") || {}).value || "auto", scale: sc, turbo: !!(($("s_c16turbo") || {}).checked) };
  }
  function sync() {
    const off = ($("s_c16mode") || {}).value === "off";
    ["s_c16scale", "s_c16turbo"].forEach((id) => { if ($(id)) $(id).disabled = off; });
  }
  async function refresh() {
    const el = $("s_c16status"); if (!el) return;
    try {
      const j = await (await fetch("/api/vram16")).json();
      if (j.error) throw new Error(j.error);
      const card = (j.card || []).map((d) => `${d.name} ${d.gb} GB`).join(", "), small = (j.card || []).some((d) => d.gb <= 16.5);
      const lines = [];          // one line each - the UI translation (static/uilang.js) takes them line by line
      if (card) lines.push(j.mode === "auto" ? (small ? "Card: " + card + " - Auto: on for this card" : "Card: " + card + " - Auto: off for this card (more than 16 GB)") : "Card: " + card);
      lines.push("Files: " + (j.items || []).map((i) => (i.present ? "✓ " : "✗ ") + i.label).join(" · "));
      lines.push("Node packs: " + (j.packs || []).map((p) => (p.installed ? "✓ " : "✗ ") + p.label + (p.need ? "" : " (optional)")).join(" · "));
      lines.push(j.comfy === false ? "ComfyUI not found - set its folder in Settings ▸ ComfyUI first"
        : j.ready ? "Ready - every part of 16 GB mode can run"
          : "A render leaves out what is missing (✗) and its log says what to install");
      el.textContent = lines.join("\n");
    } catch (e) { el.textContent = "16 GB mode: " + (e.message || e); }
  }
  function start() {
    if ($("s_c16mode")) $("s_c16mode").addEventListener("change", sync);
    if ($("s_c16files")) $("s_c16files").onclick = () => {
      const t = document.querySelector('[data-stab="addons"]'); if (t) t.click();
      setTimeout(() => { const row = document.querySelector('[data-addon="vram16"]'); if (row && row.scrollIntoView) row.scrollIntoView({ block: "center" }); }, 300);
    };
    const t = document.querySelector('[data-stab="comfy"]'); if (t) t.addEventListener("click", () => setTimeout(refresh, 50));
    const s = $("settings"); if (s) s.addEventListener("toggle", () => { if (s.open) refresh(); });
  }
  window.H3Vram16 = { fill: fill, read: read, refresh: refresh };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
