/* bitGen Studio — static/features.js (2.593.0): FACE FIX and CONTROLNET are add-ons (window.H3Features).
 * Tim: "make facefix and controlnet into addons and put the links to dl in addons tab. only show if they are enabled
 * in the general tab. if they are enabled check for all the models and download them into the correct folder if they
 * do not exist". Settings ▸ General ▸ Add-ons in the studio: ☐ Face fix, ☐ ControlNet (GET / POST /api/features,
 * lib/featureAddons.js). OFF = Basic Settings' section (+ ControlNet's Settings tab) and the Add-ons card are hidden
 * and Generate Image never sends it. ON = shown; the server downloads what it is missing (the Add-ons tab shows it).
 * Pure (Node: scripts/test-features593.js): HIDE (what each switch hides), message(id, on, reply)
 * API: H3Features {load, on(id), set(id, on), apply()} */
(function (root) {
  "use strict";
  const HIDE = {
    facefix: ['h2.sec[data-sec="facefix"]', "#sec-facefix"],
    controlnet: ['h2.sec[data-sec="cnet"]', "#sec-cnet", '#settings .stabs [data-stab="cnet"]', "#stab-cnet"],
  };
  const NAMES = { facefix: "Face fix", controlnet: "ControlNet" };
  /** the line under the switches after a change */
  function message(id, on, r) {
    const n = NAMES[id] || id;
    if (!on) return `${n} is off - hidden, and renders do not use it`;
    const st = (r && r.status && r.status[id]) || {};
    if (r && r.queued && r.queued.includes(id) && (st.missing || []).length) return `${n} is on - downloading what is missing (${st.missing.join(", ")}); Settings ▸ Add-ons shows the progress`;
    if (st.note && /ComfyUI not found/.test(st.note)) return `${n} is on - ${st.note}`;
    return `${n} is on - everything it needs is there`;
  }
  const pure = { HIDE, NAMES, message };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  let F = { facefix: false, controlnet: false };
  const $ = (id) => document.getElementById(id);
  const css = document.createElement("style");
  css.textContent = ".feat-off{display:none !important}";
  document.head.appendChild(css);
  function apply() {
    for (const id of Object.keys(HIDE)) {
      for (const sel of HIDE[id]) document.querySelectorAll(sel).forEach((el) => el.classList.toggle("feat-off", !F[id]));
      const cb = $("s_feat_" + id); if (cb) cb.checked = !!F[id];
    }
    // the ControlNet Settings tab was open and is hidden now - back to General
    const tab = document.querySelector('#settings .stabs [data-stab="cnet"]');
    if (tab && !F.controlnet && tab.classList.contains("active")) { const g = document.querySelector('#settings .stabs [data-stab="general"]'); if (g) g.click(); }
  }
  async function load() {
    try { const r = await (await fetch("/api/features")).json(); F = Object.assign(F, r.features || {}); } catch (e) { /* off */ }
    apply();
    return F;
  }
  async function set(id, on) {
    const r = await (await fetch("/api/features", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, on: !!on }) })).json();
    if (r.error) throw new Error(r.error);
    F = Object.assign(F, r.features || {});
    apply();
    const m = $("s_feat_msg"); if (m) m.textContent = message(id, !!on, r);
    try { if (root.H3Addons) root.H3Addons.refresh(); } catch (e) { /* the tab is not built yet */ }
    return r;
  }
  function wire() {
    for (const id of Object.keys(HIDE)) {
      const cb = $("s_feat_" + id);
      if (cb && !cb.dataset.wired) { cb.dataset.wired = "1"; cb.addEventListener("change", () => { set(id, cb.checked).catch((e) => { const m = $("s_feat_msg"); if (m) m.textContent = e.message; }); }); }
    }
    load();
  }
  root.H3Features = Object.assign({ load, set, apply, on: (id) => !!F[id], state: () => Object.assign({}, F) }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})(typeof window !== "undefined" ? window : globalThis);
