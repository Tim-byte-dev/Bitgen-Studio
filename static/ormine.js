/* bitGen Studio — static/ormine.js (2.786.0): YOUR OPENROUTER MODELS IN THE DROPDOWNS as "openrouter/<id>" (window.H3OrMine;
 * lib/orModels.js, GET /api/ormodels/mine; the list is made in 🖥 GPU ▸ OpenRouter models… - static/ormodels.js).
 *
 * Tim (verbatim): "when user closes the dialog update all the dropdowns with the new lists add models to the appropriate dropdown
 * in llm/vllm and the override model dropdown (not the video/image styles) as openrouter/model name but don't remove the other
 * models, if use model is selected and an openrouter model is selected use openrouter"
 *   Basic Settings ▸ image Model (the checkpoint combo #imgCkptCombo)   a "☁ OpenRouter (paid)" group of your picture models -
 *                 static/index.html cmCombo asks comboExtra(); picked + Use model + Override style = made on OpenRouter
 *   Basic Settings ▸ video Model (#vidModel's list #vidModelList)      your video models
 *   the prompt docker's LLM / Vision lists (#llmSel / #visionSel)        a "☁ OpenRouter · your models" group; picking one =
 *                 that model on OpenRouter and the LLM / Vision LLM runs there (POST /api/ormodels/use - ☁ Runs on follows).
 *                 While a list already shows OpenRouter's models (static/remotellm.js - yours first, ★) nothing is added.
 *   The other entries are never removed. Reloaded on "h3:ormodels" (the dialog closed) and "h3:rgpu".
 *   Once a session the list is checked against OpenRouter's (GET /api/ormodels/mine?check=1): a model it no longer lists is
 *   taken off, and the console + a note say which.
 * Pure (Node: scripts/test-ormodels786.js): PREFIX, isOr, optionText, groupHtml.
 */
(function (root) {
  "use strict";
  var PREFIX = "openrouter/";
  function isOr(v) { return String(v || "").toLowerCase().indexOf(PREFIX) === 0 && String(v).length > PREFIX.length; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /** an entry's words in a list (pure): "openrouter/<id> · <price>" */
  function optionText(m) { return PREFIX + m.id + (m.price ? " · " + m.price : m.free ? " · free" : ""); }
  /** the "☁ OpenRouter" group for the checkpoint combo (pure) -> {html, has: the current value is one of them} */
  function groupHtml(list, cur, label) {
    var L = list || [];
    if (!L.length) return { html: "", has: false };
    var has = false;
    var opts = L.map(function (m) { var v = PREFIX + m.id; if (v === cur) has = true; return '<option value="' + esc(v) + '" data-or="1">' + esc(optionText(m)) + "</option>"; }).join("");
    return { html: '<optgroup label="' + esc(label || "☁ OpenRouter (paid)") + '" data-or="1">' + opts + "</optgroup>", has: has };
  }
  var pure = { PREFIX: PREFIX, isOr: isOr, optionText: optionText, groupHtml: groupHtml };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = pure; return; }

  var doc = root.document, S = { mine: { image: [], video: [], llm: [], vlm: [] }, runs: {}, key: false, painting: false, obs: {}, checked: false, prev: {} };
  var SEL = { llm: "llmSel", vlm: "visionSel" };
  function $(id) { return doc.getElementById(id); }
  function log(t) { try { if (typeof root.logLine === "function") root.logLine("[openrouter] " + t); } catch (e) { /* no console */ } }
  function note(t) { try { if (typeof root.appNote === "function") root.appNote(t); else log(t); } catch (e) { log(t); } }
  function comboExtra(inpId, cur) { return inpId === "imgCkpt" ? groupHtml(S.mine.image, cur) : null; }
  function paintCombo() { var w = doc.querySelector("#imgCkptCombo .cmcombo"); if (w && w._repaint) w._repaint(); }
  function paintVideo() {
    var dl = $("vidModelList"); if (!dl) return;
    Array.prototype.slice.call(dl.querySelectorAll("option[data-or]")).forEach(function (o) { o.remove(); });
    var pl = root.H3BasicPlace ? root.H3BasicPlace.get("video-model") : "all"; if (pl !== "all" && pl !== "openrouter") return;   // 2.797.0: the place picked
    S.mine.video.forEach(function (m) { var o = doc.createElement("option"); o.value = PREFIX + m.id; o.label = (m.name || m.id) + (m.price ? " · " + m.price : ""); o.dataset.or = "1"; dl.appendChild(o); });
  }
  function paintSel(k) {
    var sel = $(SEL[k]); if (!sel) return;
    S.painting = true;
    try {
      var old = sel.querySelector("optgroup[data-or]"); if (old) old.remove();
      if (sel.dataset.rlHost === "openrouter" || !S.mine[k].length) return;   // remotellm lists OpenRouter's (yours first) - or none to add
      var g = doc.createElement("optgroup"); g.label = "☁ OpenRouter · your models"; g.dataset.or = "1";
      S.mine[k].forEach(function (m) { var o = doc.createElement("option"); o.value = PREFIX + m.id; o.textContent = optionText(m); o.dataset.or = "1"; g.appendChild(o); });
      sel.appendChild(g);
    } finally { S.painting = false; }
    watch(k);
  }
  function watch(k) {
    var sel = $(SEL[k]); if (!sel || S.obs[k] || !root.MutationObserver) return;
    // the page's own fillers (refreshLlms, the vision list's loader, remotellm) rebuild the list - our group goes back in
    S.obs[k] = new MutationObserver(function () {
      if (S.painting || !S.mine[k].length || sel.dataset.rlHost === "openrouter" || sel.querySelector("optgroup[data-or]")) return;
      setTimeout(function () { paintSel(k); }, 0);
    });
    S.obs[k].observe(sel, { childList: true });
  }
  function paintAll() { paintCombo(); paintVideo(); paintSel("llm"); paintSel("vlm"); }
  function load() {
    var check = !S.checked; S.checked = true;
    return root.fetch("/api/ormodels/mine" + (check ? "?check=1" : "")).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.error || !j.mine) return;
      // 2.792.0: a dead model (OpenRouter no longer lists it - red in 🧩 Model manager) is left out of the dropdowns
      var live = {}; Object.keys(j.mine).forEach(function (k) { live[k] = (j.mine[k] || []).filter(function (m) { return !m.dead; }); });
      S.mine = live; S.runs = j.runs || {}; S.key = !!j.key;
      if (j.removed && j.removed.length) {
        var names = j.removed.map(function (m) { return m.name || m.id; }).join(", ");
        note("OpenRouter no longer lists " + names + " - red in 🧩 Model manager ▸ ☁ OpenRouter (🗑 takes it off); left out of the dropdowns");
      }
      paintAll();
      try { doc.dispatchEvent(new CustomEvent("h3:ormine", { detail: S })); } catch (e) { /* fine */ }
    }).catch(function () { S.checked = !check && S.checked; });
  }
  // a pick of one of yours in the LLM / Vision list = that model on OpenRouter (the page's own handler - it would load a GGUF
  // here - and static/remotellm.js's never see it; this file loads before remotellm.js, so its capture listener runs first)
  doc.addEventListener("focus", function (e) { var t = e.target; if (t && (t.id === SEL.llm || t.id === SEL.vlm)) S.prev[t.id] = t.value; }, true);
  doc.addEventListener("change", function (e) {
    var t = e.target, k = t && t.id === SEL.llm ? "llm" : t && t.id === SEL.vlm ? "vlm" : "";
    if (!k || !isOr(t.value)) return;
    e.stopImmediatePropagation(); e.stopPropagation();
    var id = t.value.slice(PREFIX.length);
    root.fetch("/api/ormodels/use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: k, id: id }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || j.error) { note("✗ " + ((j && j.error) || "could not use " + id)); if (S.prev[t.id] != null) t.value = S.prev[t.id]; return; }
        log((k === "vlm" ? "Vision LLM" : "LLM") + " = " + id + " on OpenRouter (☁ Runs on ▸ " + (k === "vlm" ? "Vision LLM" : "LLM") + " = OpenRouter)");
        try { doc.dispatchEvent(new Event("h3:rgpu")); } catch (x) { /* the lists reload */ }
      }).catch(function () { note("✗ could not reach the studio"); });
  }, true);
  doc.addEventListener("h3:ormodels", function () { load(); });
  doc.addEventListener("h3:rgpu", function () { setTimeout(load, 600); });   // Runs on / the LLM's host changed - the lists again
  function boot() { if (!$(SEL.llm) && !$("imgCkptCombo")) { setTimeout(boot, 800); return; } load(); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3OrMine = Object.assign({ load: load, comboExtra: comboExtra, paintAll: paintAll, state: function () { return S; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
