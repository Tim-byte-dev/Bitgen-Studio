/* bitGen Studio — static/gpusplit.js (2.745.0): BASIC SETTINGS ▸ GPU - which work runs on the remote GPU, which here
 * (window.H3GpuSplit; lib/gpuSplit.js, routes/gpuSplit.js).
 * Tim (verbatim): "add a accordian menu item to basic settings - GPU - add checkboxes remote,local, both - if both, add
 * checkboxes - llm,vllm,image,video" -> vllm = the vision LLM; ticked = runs on the remote GPU; the LLMs' remote = a
 * RunPod vLLM endpoint.
 *   Remote · Local · Both   one choice (radio buttons - only one can be on). Remote and Both need a remote GPU set up in
 *                           Settings ▸ Remote generation (a button opens it).
 *   Both ▸ LLM · Vision LLM · Image · Video + songs   ticked = on the remote GPU; LLM / Vision LLM need the RunPod vLLM
 *                           endpoint (Settings ▸ Remote generation ▸ LLM on RunPod) - said beside them when it is missing.
 *   2.747.0: Local first and the default; the section sits first in Basic Settings, closed, its choice beside "GPU".
 *   a line under it says where each kind runs now. 2.746.0: a STYLE says where it runs (static/runson.js) - Local lists
 *   only this computer's styles, Remote only the remote (R_) ones, Both every style and the style decides; the boxes then
 *   decide only for jobs with no style. A change saves at once; document "h3:rgpu" follows (the style
 *   lists, the Remote generation tab) and is listened to (the tab's Use it changes this). */
(function (root) {
  "use strict";
  var doc = root.document, S = { v: null };
  function $(id) { return doc.getElementById(id); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  function el(tag, attrs, text) { var e = doc.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  function build() {
    var box = $("sec-gpu"); if (!box || $("gpuWhere")) return !!box;
    var g = el("div", { id: "gpuWhere", role: "radiogroup", "aria-label": "Where the work runs", style: "display:flex;gap:12px;flex-wrap:wrap" });
    [["local", "Local", "Every job on this computer (the default)"], ["remote", "Remote", "Every job on the remote GPU set up in Settings ▸ Remote generation"], ["both", "Both", "Pick what runs on the remote GPU - the rest runs on this computer"]].forEach(function (o) {
      var l = el("label", { class: "chk", title: o[2], style: "margin:0" }), i = el("input", { type: "radio", name: "gpuWhere", value: o[0] });
      l.appendChild(i); l.appendChild(doc.createTextNode(" " + o[1])); g.appendChild(l);
    });
    var b = el("div", { id: "gpuBoxes", style: "display:flex;gap:4px 12px;flex-wrap:wrap;margin-top:6px" });
    [["llm", "LLM", "The chat / prompt model on the remote LLM (RunPod vLLM or OpenRouter)"], ["vlm", "Vision LLM", "The model that describes pictures, on the remote LLM (RunPod vLLM or OpenRouter)"],
     ["image", "Image", "Picture jobs with no style (upscaling, graphs, 3D) on the remote GPU - a style says where it runs itself"], ["video", "Video + songs", "Video jobs and songs with no style (the template) on the remote GPU - a style says where it runs itself"]].forEach(function (o) {
      var l = el("label", { class: "chk", title: o[2], style: "margin:0" }), i = el("input", { type: "checkbox", id: "gpu_" + o[0] });
      l.appendChild(i); l.appendChild(doc.createTextNode(" " + o[1])); b.appendChild(l);
    });
    var line = el("div", { id: "gpuLine", class: "hint", "aria-live": "polite", style: "margin-top:6px;font-size:.7rem" });
    var msg = el("div", { id: "gpuMsg", class: "hint", "aria-live": "polite", style: "font-size:.7rem" });
    var open = el("button", { type: "button", class: "ghost", id: "gpuSetup", style: "margin-top:4px;font-size:.72rem" }, "⚙ Settings ▸ Remote generation");
    box.appendChild(g); box.appendChild(b); box.appendChild(line); box.appendChild(msg); box.appendChild(open);
    g.querySelectorAll("input").forEach(function (i) { i.onchange = function () { save({ where: i.value }); }; });
    b.querySelectorAll("input").forEach(function (i) { i.onchange = function () { var o = {}; o[i.id.slice(4)] = i.checked; save(o); }; });
    open.onclick = function () {
      var o = $("openSettings"); if (o && o.onclick) o.onclick();
      setTimeout(function () { var t = doc.querySelector('#settings .stabs [data-stab="rgpu"]'); if (t) t.click(); }, 60);
    };
    return true;
  }
  // 2.753.0: the remote LLM is RunPod vLLM or OpenRouter (lib/openRouter.js)
  function llmName() { return S.v && S.v.llm_provider === "openrouter" ? "OpenRouter" : "RunPod vLLM"; }
  function where(r) { return r === "remote" ? (S.v.remote ? S.v.remote.label : "the remote GPU") : "this computer"; }
  function paint() {
    var v = S.v; if (!v || !$("gpuWhere")) return;
    // 2.753.0: Both needs a remote GPU OR a remote LLM (OpenRouter alone: the LLMs there, every render here); Remote a GPU
    doc.querySelectorAll('input[name="gpuWhere"]').forEach(function (i) { i.checked = i.value === v.where; i.disabled = i.value === "remote" ? !v.remote : i.value === "both" ? !(v.remote || v.vllm_ready) : false; });
    $("gpuBoxes").style.display = v.where === "both" ? "flex" : "none";
    // a box that cannot apply is not shown ticked (LLM / Vision LLM with no vLLM endpoint run here, whatever was saved)
    ["llm", "vlm", "image", "video"].forEach(function (k) { $("gpu_" + k).checked = !!v[k] && (k === "image" || k === "video" || !!v.vllm_ready); });
    ["llm", "vlm"].forEach(function (k) { var i = $("gpu_" + k); i.disabled = !v.vllm_ready; i.parentNode.title = i.parentNode.title.replace(/ - set up .*$/, "") + (v.vllm_ready ? "" : " - set up Settings ▸ Remote generation ▸ 🧠 LLM first"); });
    ["image", "video"].forEach(function (k) { var i = $("gpu_" + k); i.disabled = !v.remote; if (!v.remote) i.checked = false; });
    var R = v.routes || {};
    // 2.746.0: in Both a style decides - R_ styles on the remote GPU, the others here; the boxes are for jobs with no style
    var L = function (r) { return r === "remote" ? llmName() : "this computer"; };
    $("gpuLine").textContent = !v.remote && v.where === "both" ? "No remote GPU - pictures, videos and songs render on this computer · LLM: " + L(R.llm) + " · Vision LLM: " + L(R.vlm)
      : !v.remote ? "No remote GPU set up - everything runs on this computer. Set one up in Settings ▸ Remote generation."
      : v.where === "both" ? "R_ styles: " + where("remote") + " · other styles: this computer · no style - Image: " + where(R.image) + " · Video + songs: " + where(R.video)
        + " · LLM: " + L(R.llm) + " · Vision LLM: " + L(R.vlm)
      : (v.where === "remote" ? "Remote styles (R_) only · " : "Styles for this computer only · ") + "Image: " + where(R.image) + " · Video + songs: " + where(R.video) + " · LLM: " + L(R.llm)
        + " · Vision LLM: " + L(R.vlm);
    $("gpuSetup").style.display = v.remote ? "none" : "";
    // 2.747.0: the section is closed by default - its header says the choice
    if ($("gpuNow")) $("gpuNow").textContent = "· " + (v.where === "remote" ? "Remote" : v.where === "both" ? "Both" : "Local");
  }
  function load() {
    return root.fetch("/api/gpusplit").then(function (r) { return r.json(); }).then(function (v) { if (v && v.where) { S.v = v; paint(); } return v; }).catch(function () { /* offline */ });
  }
  function save(b) {
    $("gpuMsg").textContent = "";
    return post("/api/gpusplit", b).then(function (v) {
      if (v.error) { $("gpuMsg").textContent = "✗ " + v.error; paint(); return v; }
      S.v = v; paint();
      // the page's own copy of ComfyUI's address follows (Settings ▸ Save sends it back - lib/remoteGpu.js guardComfy)
      root.fetch("/api/config").then(function (r) { return r.json(); }).then(function (c) {
        try { if (typeof cfg !== "undefined" && cfg && cfg.engine && c.engine) { cfg.engine.comfy = Object.assign({}, cfg.engine.comfy, { url: c.engine.comfy.url, autostart: c.engine.comfy.autostart }); } } catch (e) { /* fine */ }   // eslint-disable-line no-undef
        try { if ($("s_curl")) $("s_curl").value = c.engine.comfy.url; } catch (e) { /* fine */ }
      }).catch(function () { /* fine */ });
      S.mine = true;
      try { doc.dispatchEvent(new Event("h3:rgpu")); } catch (e) { /* fine */ }
      S.mine = false;
      test("gpusplit", v.where);
      return v;
    });
  }
  function boot() {
    if (!build()) { setTimeout(boot, 300); return; }
    load();
    doc.addEventListener("h3:rgpu", function () { if (!S.mine) load(); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3GpuSplit = { load: load, save: save, state: function () { return S; } };
})(typeof window !== "undefined" ? window : globalThis);
