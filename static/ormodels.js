/* bitGen Studio — static/ormodels.js (2.786.0; 2.792.0 the dialog gone): ☁ REMOTE GENERATION ▸ OPENROUTER MODELS… (window.H3OrModels;
 * routes/orModels.js, lib/orModels.js).
 * 2.792.0 (Tim: "i think there is no need for the openrouter dialog anymore, model manager should be able to look after it"): the dialog
 * below is GONE - 🧩 Model manager ▸ ☁ OpenRouter (static/mmor.js) does it all; this file keeps the pure list helpers the tab uses
 * (filterList, sortList, typeLabel) and the button in ☁ Remote generation, which now opens that tab (open(type)).
 * (The 2.786.0 description that follows is history.)
 *
 * Tim (verbatim): "Add an openrouter button to remote generation docker to select models to use, show dialog with free and paid
 * models and tabs for each type and inside each type have tabs for each family + 1 tab for all - but show price for paid
 * service. use 2 frames in the dialog 1 tab to show available models and 1 to show added models, when user double clicks model
 * then add the model to users models with a delete button at the end of each model name. when user closes the dialog update all
 * the dropdowns with the new lists"
 *   Type tabs      Image · Video · LLM · Vision LLM (how many of yours each)
 *   Family tabs    All + each maker (Google, OpenAI, ByteDance Seed …) with how many models
 *   Search, ☑ Free ☑ Paid, sort (name / cheapest / newest), ⟳ asks OpenRouter again
 *   Available      OpenRouter's models of that type + family: name, price (free in green, paid with its price), ✓ = yours.
 *                  Double-click (or Enter) adds it to yours; a click shows its details below
 *   My models      yours of that type, each with 🗑 at the end
 *   Closing (✕, Esc, outside) sends "h3:ormodels" - static/ormine.js puts the lists into the dropdowns as "openrouter/<id>".
 *   A model OpenRouter no longer lists is taken off yours when the dialog asks (the line under the frames says which).
 * Pure (Node: scripts/test-ormodels786.js): filterList, sortList, typeLabel.
 */
(function (root) {
  "use strict";
  var TYPES = [["image", "Image"], ["video", "Video"], ["llm", "LLM"], ["vlm", "Vision LLM"]];
  function hay(m) { return [m.id, m.name, m.maker, m.price, m.free ? "free" : "paid", m.desc].join(" ").toLowerCase(); }
  /** the Available frame's models (pure): o = {fam, q, free, paid} */
  function filterList(models, o) {
    var x = o || {}, words = String(x.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (models || []).filter(function (m) {
      if (x.fam && x.fam !== "all" && (m.maker || String(m.id).split("/")[0]) !== x.fam) return false;
      if (m.free ? x.free === false : x.paid === false) return false;
      var h = hay(m); return words.every(function (w) { return h.indexOf(w) >= 0; });
    });
  }
  function costOf(m) { return m.free ? 0 : m.usd != null ? +m.usd : m.in != null || m.out != null ? (+m.in || 0) + (+m.out || 0) : Infinity; }
  /** sorted (pure): name | price (cheapest first, unknown last) | newest */
  function sortList(list, by) {
    var cmp = by === "price" ? function (a, b) { return costOf(a) - costOf(b) || String(a.name).localeCompare(String(b.name)); }
      : by === "newest" ? function (a, b) { return (+b.created || 0) - (+a.created || 0) || String(a.name).localeCompare(String(b.name)); }
      : function (a, b) { return (b.free - a.free) || String(a.name).localeCompare(String(b.name)); };
    return (list || []).slice().sort(cmp);
  }
  /** a type tab's words (pure) */
  function typeLabel(t, n) { var l = (TYPES.filter(function (x) { return x[0] === t; })[0] || [t, t])[1]; return l + (n ? " (" + n + ")" : ""); }
  var pure = { TYPES: TYPES, filterList: filterList, sortList: sortList, typeLabel: typeLabel };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = pure; return; }
  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  /** 2.792.0: 🧩 Model manager on its ☁ OpenRouter tab (the type picked) */
  function open(type) {
    var MM = root.H3ModelMgr, OR = root.H3MmOr;
    if (!MM) return;
    if (OR && type && /^(image|video|llm|vlm)$/.test(type)) { var st = OR.state(); if (st.type !== type) { st.type = type; st.v = null; } }
    try { MM.show(true); } catch (e) { /* fine */ }
    if (MM.openTab) MM.openTab("openrouter");
  }
  function close() { /* nothing to close - the Model manager is a docker */ }
  /* the button in ☁ Remote generation (under Runs on) */
  function ensureBtn() {
    var box = $("rgdWhere"); if (!box || $("rhOrBtn")) return;
    var b = doc.createElement("button"); b.type = "button"; b.id = "rhOrBtn"; b.className = "ghost"; b.style.cssText = "margin-top:8px;font-size:.78rem";
    b.textContent = "☁ OpenRouter models…"; b.title = "🧩 Model manager ▸ ☁ OpenRouter - the OpenRouter models you use (pictures, video, LLM, vision LLM; free and paid): ＋ adds one";
    b.onclick = function () { open(); };
    box.appendChild(b);
  }
  function boot() { ensureBtn(); setInterval(ensureBtn, 1500); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3OrModels = Object.assign({ open: open, close: close }, pure);
})(typeof window !== "undefined" ? window : globalThis);
