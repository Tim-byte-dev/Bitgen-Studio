/* bitGen Studio — static/cardoffload.js (2.794.0): Settings ▸ General ☐ "Offload to CPU / RAM when a model does not fit"
 * (#s_offload, GET / POST /api/carduse - lib/cardUse.js). On (the default): a model bigger than its card's free memory keeps
 * the rest in RAM - llama.cpp puts the layers that fit on the card, ComfyUI moves models to RAM as it needs. Off: everything on
 * the card (ComfyUI --gpu-only), and an LLM / vision LLM that does not fit is refused with what it needs.
 * Pure (Node: scripts/test-carduse794.js): message(on)
 * API: H3CardOffload {load, set(on)} */
(function (root) {
  "use strict";
  function message(on) {
    return on ? "On - a model too big for its card keeps the rest in RAM (slower, never refused)"
      : "Off - everything on the card; a model that does not fit is refused with what it needs";
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { message }; return; }
  const $ = (id) => document.getElementById(id);
  async function load() {
    try { const j = await (await fetch("/api/carduse")).json(); const cb = $("s_offload"); if (cb) cb.checked = j.offload !== false; paint(j.offload !== false); } catch (e) { /* the server is older */ }
  }
  function paint(on, note) { const m = $("s_offload_msg"); if (m) m.textContent = note || message(on); }
  async function set(on) {
    const r = await fetch("/api/carduse/offload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: !!on }) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    paint(j.offload, j.note);
    return j;
  }
  function wire() {
    const cb = $("s_offload");
    if (!cb || cb.dataset.wired) return;
    cb.dataset.wired = "1";
    cb.addEventListener("change", () => set(cb.checked).catch((e) => paint(cb.checked, e.message)));
    load();
  }
  root.H3CardOffload = { load, set, message };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
  // Settings may be built again - wire the box when it opens
  document.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest("#openSettings")) setTimeout(() => { wire(); load(); }, 50); }, true);
})(typeof window !== "undefined" ? window : globalThis);
