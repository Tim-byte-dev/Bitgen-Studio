/* bitGen Studio — static/modelswap.js (2.680.0): THE PROMPT DOCKER'S ⇄ - beside the image style and the video style dropdowns:
 * swap between the CURRENT settings of that model type and the PREVIOUS ones (window.H3ModelSwap).
 * Tim (verbatim): "add a toggle button next to each model type dropdown in prompt docker so user can toggle between current
 * settings for the model type and previous settings - if the settings have overide checked use overide settings including
 * any temporary loras, save the settings in a file model_settings.tmp ."
 *   a setting   the style picked + (when Basic Settings ▸ Override style is on) every Basic Settings value of that kind
 *               (#iset image / #vset video) and its temporary LoRAs
 *   previous    changing the dropdown makes what was set before it the PREVIOUS setting
 *   ⇄           puts the previous one back (style, Override style, the values, the temporary LoRAs) - the one it replaces
 *               becomes the previous; press again to go back
 *   kept        GET / POST /api/model-settings -> <app>/model_settings.tmp (lib/modelSettings.js) - across restarts
 * index.html: tempLoras(kind), paintTempLoras(all), saveTempLoras(kind), #ovrStyle. Pure (Node: test-modelswap680.js):
 * fieldsOf(controls), label(setting). */
(function (root) {
  "use strict";
  const KINDS = { image: { sel: "styleSel", set: "iset", loras: "tliRows" }, video: { sel: "videoStyleSel", set: "vset", loras: "tlvRows" } };
  /** the values of a settings box's own controls (pure: [{id, type, value, checked}] -> {id: value}) - never the LoRA rows */
  function fieldsOf(list) {
    const out = {};
    (list || []).forEach((c) => { if (!c || !c.id || c.type === "file" || c.type === "button" || c.lora) return; out[c.id] = c.type === "checkbox" || c.type === "radio" ? !!c.checked : String(c.value == null ? "" : c.value); });
    return out;
  }
  /** a setting in a few words, for the button's tooltip (pure) */
  function label(s) {
    if (!s) return "no previous setting yet - change the style and the one before it comes here";
    return (s.name || s.style) + (s.ovr ? " + Basic Settings (Override style)" + (s.loras && s.loras.length ? ", " + s.loras.length + " temporary LoRA" + (s.loras.length > 1 ? "s" : "") : "") : "");
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { KINDS, fieldsOf, label }; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const S = { data: { image: { cur: null, prev: null }, video: { cur: null, prev: null } }, busy: false, loaded: false, saveT: null };
  const ovrOn = () => !!($("ovrStyle") && $("ovrStyle").checked);
  function controls(kind) {
    const box = $(KINDS[kind].set); if (!box) return [];
    return [...box.querySelectorAll("input[id], select[id], textarea[id]")].map((c) => ({ id: c.id, type: (c.type || c.tagName).toLowerCase(), value: c.value, checked: c.checked, lora: !!c.closest(".lorarow") }));
  }
  function snap(kind) {
    const sel = $(KINDS[kind].sel); if (!sel || !sel.value) return null;
    const o = sel.selectedOptions && sel.selectedOptions[0], on = ovrOn();
    const tl = typeof tempLoras === "function" ? tempLoras(kind) : [];   // eslint-disable-line no-undef
    return { style: sel.value, name: o ? o.textContent.trim() : sel.value, ovr: on, fields: on ? fieldsOf(controls(kind)) : {}, loras: on ? tl : [], at: Date.now() };
  }
  function save() { clearTimeout(S.saveT); S.saveT = setTimeout(() => { fetch("/api/model-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: S.data }) }).catch(() => {}); }, 400); }
  function paint() {
    Object.keys(KINDS).forEach((kind) => { const b = $("swap_" + kind); if (!b) return; const p = S.data[kind].prev; b.disabled = !p; b.title = "⇄ " + (p ? "Back to " : "") + label(p) + (p ? " (now: " + label(S.data[kind].cur || snap(kind)) + ")" : ""); });
  }
  const fire = (el, t) => el.dispatchEvent(new Event(t, { bubbles: true }));
  /** put a setting back: the style, Override style, the values (only when it was saved with Override on), the LoRAs */
  function apply(kind, s) {
    const K = KINDS[kind], sel = $(K.sel); if (!sel || !s) return false;
    if (![...sel.options].some((o) => o.value === s.style)) { const n = $("swap_msg_" + kind); if (n) n.textContent = (s.name || s.style) + " is not in the list any more"; return false; }
    S.busy = true;
    try {
      const ov = $("ovrStyle"); if (ov && ov.checked !== !!s.ovr) { ov.checked = !!s.ovr; fire(ov, "change"); }
      if (sel.value !== s.style) { sel.value = s.style; fire(sel, "change"); }
      if (s.ovr) {
        const box = $(K.set);
        Object.keys(s.fields || {}).forEach((id) => {
          const c = box && box.querySelector("#" + CSS.escape(id)); if (!c || c.closest(".lorarow")) return;
          const v = s.fields[id];
          if (c.type === "checkbox" || c.type === "radio") { if (c.checked !== !!v) { c.checked = !!v; fire(c, "change"); } }
          else if (String(c.value) !== String(v)) { c.value = v; fire(c, "input"); fire(c, "change"); }
        });
        if (typeof paintTempLoras === "function") {   // eslint-disable-line no-undef
          const all = { image: tempLoras("image"), video: tempLoras("video"), cnet: tempLoras("cnet") }; all[kind] = s.loras || [];   // eslint-disable-line no-undef
          paintTempLoras(all); if (typeof saveTempLoras === "function") saveTempLoras(kind);   // eslint-disable-line no-undef
        }
      }
    } finally { S.busy = false; }
    return true;
  }
  function swap(kind) {
    const d = S.data[kind], target = d.prev; if (!target) return false;
    const now = snap(kind);
    if (!apply(kind, target)) return false;
    d.prev = now; d.cur = snap(kind) || target;
    save(); paint();
    const n = $("swap_msg_" + kind); if (n) n.textContent = "";
    return true;
  }
  /** the dropdown changed by the user: what was set before is the previous */
  function changed(kind) {
    if (S.busy || !S.loaded) return;
    const d = S.data[kind], before = d.cur, now = snap(kind);
    if (!now) return;
    if (before && before.style !== now.style) d.prev = before;
    d.cur = now; save(); paint();
  }
  /** the values / Override / LoRAs changed: the current setting follows (not a new "previous") */
  function touched(kind) { if (S.busy || !S.loaded) return; const now = snap(kind); if (now) { S.data[kind].cur = now; save(); paint(); } }
  async function boot() {
    if (!$("styleSel")) { setTimeout(boot, 500); return; }
    if (!$("swap_image")) Object.keys(KINDS).forEach((kind) => {
      const sel = $(KINDS[kind].sel); if (!sel) return;
      const b = doc.createElement("button"); b.type = "button"; b.className = "ghost h3swap"; b.id = "swap_" + kind; b.textContent = "⇄"; b.disabled = true;
      b.style.cssText = "padding:2px 7px;margin-left:4px;flex:none";
      b.onclick = (e) => { e.preventDefault(); swap(kind); };
      sel.insertAdjacentElement("afterend", b);
      sel.addEventListener("change", () => changed(kind));
      const box = $(KINDS[kind].set); if (box) { const t = () => touched(kind); box.addEventListener("change", t); box.addEventListener("input", t); }
    });
    const ov = $("ovrStyle"); if (ov) ov.addEventListener("change", () => { touched("image"); touched("video"); });
    try { const j = await (await fetch("/api/model-settings")).json(); if (j && j.image) S.data = j; } catch (e) { /* a fresh start */ }
    // the dropdowns fill from async fetches - the current setting is taken once they hold a style
    const settle = (n) => { const ok = Object.keys(KINDS).every((k) => { const s = $(KINDS[k].sel); return !s || s.value; }); if (!ok && n < 40) { setTimeout(() => settle(n + 1), 250); return; }
      S.loaded = true; Object.keys(KINDS).forEach((k) => { const now = snap(k); if (now && (!S.data[k].cur || S.data[k].cur.style !== now.style)) { if (S.data[k].cur && S.data[k].cur.style !== now.style) S.data[k].prev = S.data[k].cur; S.data[k].cur = now; } else if (now) S.data[k].cur = now; }); paint(); };
    setTimeout(() => settle(0), 3000);   // after uiModelRestore puts the saved styles back (2.5 s)
  }
  root.H3ModelSwap = { swap, apply, snap, state: () => S, KINDS, fieldsOf, label, ready: () => S.loaded };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
