/* bitGen Studio — static/remotellm.js (2.768.0): IN REMOTE MODE THE PROMPT DOCKER'S LLM AND VISION LISTS ARE THE REMOTE HOST'S
 * MODELS (window.H3RemoteLlm; lib/remoteLlm.js, routes/remoteLlm.js).
 * Tim (verbatim): "when in remote mode clear the llm and vllm dropdown lists in prompt docker add the list of free llm and vl
 * models from openrouter(default) or the selected host in our prompt llm and vllm dropdowns."
 *   #llmSel / #visionSel (ext/promptdock)  remote (GET /api/remotellm says a host): this computer's GGUFs are cleared and the
 *              host's models listed under "☁ OpenRouter - free models" / "☁ RunPod pod" / "☁ RunPod vLLM"; picking one saves it
 *              (POST /api/remotellm/pick) - nothing is started here. Back to Local: the computer's lists come back.
 *   The page's own fillers are kept out while remote: refreshLlms (static/index.html) asks owns("llm"); the vision list's
 *   loader (ext/promptdock) is stopped at its focus and undone if it fills the list anyway (a MutationObserver); a change
 *   is caught before the page's own handler (it would load the model here).
 *   Reloaded on "h3:rgpu" (Basic Settings ▸ GPU, the ☁ Remote generation docker, OpenRouter's picker).
 * Pure (Node: scripts/test-remotellm768.js): optionsOf, shortName.
 */
(function (root) {
  "use strict";
  var IDS = { llm: "llmSel", vlm: "visionSel" };
  /** the options for a host's list (pure) -> {label, items: [{value, text, selected}], empty} */
  function optionsOf(L) {
    var x = L || {}, ms = x.models || [];
    var label = x.host === "openrouter" ? "☁ OpenRouter - free models" : "☁ " + (x.label || x.host || "remote");
    var items = ms.map(function (m) { return { value: m.id, text: (m.name || m.id) + (m.note ? " · " + m.note : ""), selected: m.id === x.current }; });
    var empty = x.error ? "(" + x.label + " did not list its models - " + x.error + ")" : !ms.length ? "(no models " + (x.label || "") + " lists)" : "";
    return { label: label, items: items, empty: empty };
  }
  /** "google/gemma-4-31b-it:free" -> "gemma-4-31b-it:free" (pure, the status bar) */
  function shortName(id) { return String(id || "").split("/").pop().replace(/\.gguf$/i, "").slice(0, 22); }
  var api = { optionsOf: optionsOf, shortName: shortName, IDS: IDS };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = api; return; }

  var doc = root.document, S = { v: null, own: { llm: false, vlm: false }, painting: false, obs: {} };
  function $(id) { return doc.getElementById(id); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function owns(k) { return !!S.own[k]; }
  function paint(k) {
    var sel = $(IDS[k]), L = S.v && S.v[k]; if (!sel || !L || !L.host) return;
    var o = optionsOf(L);
    S.painting = true;
    sel.innerHTML = "";
    var g = doc.createElement("optgroup"); g.label = o.label; g.dataset.rl = "1";
    if (o.empty) { var e = doc.createElement("option"); e.value = ""; e.textContent = o.empty; g.appendChild(e); }
    o.items.forEach(function (it) { var op = doc.createElement("option"); op.value = it.value; op.textContent = it.text; op.dataset.rl = "1"; if (it.selected) op.selected = true; g.appendChild(op); });
    sel.appendChild(g);
    sel.disabled = !!L.fixed && o.items.length < 2;
    sel.title = (k === "vlm" ? "Vision LLM" : "LLM") + " on " + (L.label || L.host) + (L.note ? " - " + L.note : "");
    sel.dataset.rlHost = L.host;
    S.painting = false;
    // nothing picked yet: the first one (saved, so a prompt works at once)
    if (!L.current && o.items.length && !L.fixed) { sel.selectedIndex = o.empty ? 1 : 0; pick(k, sel.value); }
    if (k === "llm" && $("sbllm")) { $("sbllm").textContent = "LLM: ☁ " + shortName(sel.value || L.current) + " (" + (L.label || L.host) + ")"; $("sbllm").style.color = "var(--dim)"; }
  }
  function watch(k) {
    var sel = $(IDS[k]); if (!sel || S.obs[k] || !root.MutationObserver) return;
    // the page's own loader fills the list again (the vision list on load / focus): the host's list goes back
    S.obs[k] = new MutationObserver(function () { if (owns(k) && !S.painting && !sel.querySelector("[data-rl]")) paint(k); });
    S.obs[k].observe(sel, { childList: true });
  }
  function pick(k, id) {
    if (!id) return Promise.resolve(null);
    return post("/api/remotellm/pick", { kind: k, id: id }).then(function (r) {
      if (r && !r.error && S.v && S.v[k]) S.v[k].current = r.current;
      if (k === "llm" && $("sbllm") && r && !r.error) $("sbllm").textContent = "LLM: ☁ " + shortName(id) + " (" + ((S.v && S.v.llm && S.v.llm.label) || "") + ")";
      try { doc.dispatchEvent(new CustomEvent("h3:remotellm", { detail: { kind: k, id: id } })); } catch (e) { /* fine */ }
      return r;
    }).catch(function () { return null; });
  }
  function load() {
    return root.fetch("/api/remotellm").then(function (r) { return r.json(); }).then(function (v) {
      if (!v || v.error) return v;
      S.v = v;
      ["llm", "vlm"].forEach(function (k) {
        var was = owns(k), now = !!(v[k] && v[k].host);
        S.own[k] = now;
        if (now) { watch(k); paint(k); return; }
        if (was) {   // back to this computer: its own list
          var sel = $(IDS[k]); if (sel) { sel.disabled = false; delete sel.dataset.rlHost; sel.innerHTML = ""; }
          if (k === "llm" && typeof root.refreshLlms === "function") root.refreshLlms();
          if (k === "vlm" && sel) sel.dispatchEvent(new Event("focus"));
        }
      });
      return v;
    }).catch(function () { /* offline */ });
  }
  // a pick in a remote list is saved - the page's own handler (it would load the model on this computer) never sees it
  doc.addEventListener("change", function (e) {
    var t = e.target, k = t && t.id === IDS.llm ? "llm" : t && t.id === IDS.vlm ? "vlm" : "";
    if (!k || !owns(k)) return;
    e.stopPropagation();
    if (k === "llm") { try { if (root.store && root.store.set) root.store.set("llm", t.value); } catch (x) { /* fine */ } }
    pick(k, t.value);
  }, true);
  // the vision list's own loader runs on focus - not while it lists the host's models
  doc.addEventListener("focus", function (e) { var t = e.target; if (t && t.id === IDS.vlm && owns("vlm")) e.stopPropagation(); }, true);
  doc.addEventListener("h3:rgpu", function () { setTimeout(load, 50); });
  function boot() { if (!$(IDS.llm)) { setTimeout(boot, 800); return; } load(); setTimeout(load, 3000); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RemoteLlm = Object.assign({ load: load, owns: owns, paint: paint, pick: pick, state: function () { return S; } }, api);
})(typeof window !== "undefined" ? window : globalThis);
