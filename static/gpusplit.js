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
 *   lists, the Remote generation tab) and is listened to (the tab's Use it changes this).
 *   2.764.1 (Tim: "if local is selected in basic settings, hide all the remote gpu details and options. the remote gpu radio
 *   group ☁ Remote generation docker 🖥 PODS 💲 RunPod pods: ..."): Local = only the three choices and one line - the
 *   Remote servers / RunPod groups, the Both boxes, ☁ Remote generation docker, 🖥 PODS, 💲 RunPod and ⚙ Settings ▸ Remote
 *   generation are hidden (#sec-gpu.gpuLocal), and those dockers close when you pick Local. Remote / Both can always be
 *   picked: with nothing set up yet, the choice waits (S.pick) and the remote options show so you can pick RunPod ▸ Pods (or
 *   set one up) - then it is saved. Pure (Node: scripts/test-gpulocal7641.js): isReady, localView. */
(function (root) {
  "use strict";
  /* ---- pure (2.764.1) */
  /** can `where` be saved now? Remote needs a remote GPU or RunPod ▸ Pods; Both also takes a remote LLM (v = /api/gpusplit) */
  function isReady(where, v) {
    var o = v || {}, pods = !!(o.engine && o.engine.pods);
    return where === "remote" ? !!(o.remote || pods) : where === "both" ? !!(o.remote || o.vllm_ready || pods) : true;
  }
  /** Local on screen = the remote details hidden (a Remote / Both still waiting for its set-up shows them) */
  function localView(v, pick) { return !pick && !!v && v.where === "local"; }
  /** what Local hides: the Remote servers / RunPod groups, the Both boxes, ☁ Remote generation docker, 🖥 PODS, 💲 RunPod, the
   *  old 💲 line, ⚙ Settings ▸ Remote generation */
  var LOCAL_HIDE = ["gpuEngine", "gpuBoxes", "gpuDock", "gpuPods", "gpuRpDock", "gpuPodCost", "gpuSetup"];
  var pure = { isReady: isReady, localView: localView, LOCAL_HIDE: LOCAL_HIDE };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = pure; return; }
  var doc = root.document, S = { v: null, pick: null };
  function $(id) { return doc.getElementById(id); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  function el(tag, attrs, text) { var e = doc.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  function build() {
    var box = $("sec-gpu"); if (!box || $("gpuWhere")) return !!box;
    if (!$("gpuLocalCss")) { var st = el("style", { id: "gpuLocalCss" });   // 2.764.1: Local = the remote details hidden (other scripts set their own display)
      st.textContent = LOCAL_HIDE.map(function (id) { return "#sec-gpu.gpuLocal #" + id; }).join(",") + "{display:none!important}";
      doc.head.appendChild(st); }
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
    // 2.756.0 (Tim: "if user ... remote selected in basic settings show the remote servers, runpod and openrouter, if user
    // selects runpod show serverless or pods radio group"): the generation engine, under Remote (and Both)
    var eng = el("div", { id: "gpuEngine", style: "margin-top:6px;display:none" });
    [["gpuProv", "Remote servers", [["runpod", "RunPod", "Render on a RunPod GPU - Serverless or a pod (the LLM on RunPod's vLLM when set up)"], ["openrouter", "OpenRouter", "The LLM on OpenRouter - pictures, videos and songs render on this computer"]]],
     ["gpuRunpod", "RunPod", [["serverless", "Serverless", "A RunPod Serverless endpoint - paid only while a job runs"], ["pods", "Pods", "A RunPod pod - your own GPU machine, paid by the hour while it runs (the PODS docker)"]]]].forEach(function (grp) {
      var row = el("div", { id: grp[0], role: "radiogroup", "aria-label": grp[1], style: "display:flex;gap:4px 12px;flex-wrap:wrap;align-items:center;margin-top:3px" });
      row.appendChild(el("span", { class: "hint", style: "font-size:.7rem;min-width:92px" }, grp[1]));
      grp[2].forEach(function (o) { var l = el("label", { class: "chk", title: o[2], style: "margin:0" }), i = el("input", { type: "radio", name: grp[0], value: o[0] }); l.appendChild(i); l.appendChild(doc.createTextNode(" " + o[1])); row.appendChild(l); });
      eng.appendChild(row);
    });
    var line = el("div", { id: "gpuLine", class: "hint", "aria-live": "polite", style: "margin-top:6px;font-size:.7rem" });
    var msg = el("div", { id: "gpuMsg", class: "hint", "aria-live": "polite", style: "font-size:.7rem" });
    var open = el("button", { type: "button", class: "ghost", id: "gpuSetup", style: "margin-top:4px;font-size:.72rem" }, "⚙ Settings ▸ Remote generation");
    box.appendChild(g); box.appendChild(eng); box.appendChild(b); box.appendChild(line);
    eng.querySelectorAll('input[name="gpuProv"]').forEach(function (i) { i.onchange = function () { save({ engine: { provider: i.value } }).then(waiting); }; });
    eng.querySelectorAll('input[name="gpuRunpod"]').forEach(function (i) { i.onchange = function () { save({ engine: { runpod: i.value } }).then(waiting); }; }); box.appendChild(msg); box.appendChild(open);
    g.querySelectorAll("input").forEach(function (i) { i.onchange = function () { choose(i.value); }; });
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
    // 2.764.1: Remote / Both can always be picked - not set up yet = it waits (S.pick) with the remote options shown
    doc.querySelectorAll('input[name="gpuWhere"]').forEach(function (i) { i.checked = i.value === (S.pick || v.where); i.disabled = false; });
    var loc = localView(v, S.pick); $("sec-gpu").classList.toggle("gpuLocal", loc);
    $("gpuBoxes").style.display = (S.pick || v.where) === "both" ? "flex" : "none";
    var e = v.engine || { provider: "runpod", runpod: "serverless" };
    $("gpuEngine").style.display = loc ? "none" : "";
    doc.querySelectorAll('input[name="gpuProv"]').forEach(function (i) { i.checked = i.value === e.provider; });
    doc.querySelectorAll('input[name="gpuRunpod"]').forEach(function (i) { i.checked = i.value === e.runpod; });
    $("gpuRunpod").style.display = e.provider === "runpod" ? "flex" : "none";
    // a box that cannot apply is not shown ticked (LLM / Vision LLM with no vLLM endpoint run here, whatever was saved)
    ["llm", "vlm", "image", "video"].forEach(function (k) { $("gpu_" + k).checked = !!v[k] && (k === "image" || k === "video" || !!v.vllm_ready); });
    ["llm", "vlm"].forEach(function (k) { var i = $("gpu_" + k); i.disabled = !v.vllm_ready; i.parentNode.title = i.parentNode.title.replace(/ - set up .*$/, "") + (v.vllm_ready ? "" : " - set up Settings ▸ Remote generation ▸ 🧠 LLM first"); });
    ["image", "video"].forEach(function (k) { var i = $("gpu_" + k); i.disabled = !v.remote; if (!v.remote) i.checked = false; });
    var R = v.routes || {};
    // 2.746.0: in Both a style decides - R_ styles on the remote GPU, the others here; the boxes are for jobs with no style
    var L = function (r) { return r === "remote" ? llmName() : "this computer"; };
    $("gpuLine").textContent = loc ? "Every job runs on this computer."
      : S.pick ? (S.pick === "remote" ? "Remote" : "Both") + " needs somewhere to render first: pick RunPod ▸ Pods (your own pod - the PODS docker) or set one up in Settings ▸ Remote generation."
      : !v.remote && v.where === "both" ? "No remote GPU - pictures, videos and songs render on this computer · LLM: " + L(R.llm) + " · Vision LLM: " + L(R.vlm)
      : !v.remote ? "No remote GPU set up - everything runs on this computer. Set one up in Settings ▸ Remote generation."
      : v.where === "both" ? "R_ styles: " + where("remote") + " · other styles: this computer · no style - Image: " + where(R.image) + " · Video + songs: " + where(R.video)
        + " · LLM: " + L(R.llm) + " · Vision LLM: " + L(R.vlm)
      : (v.where === "remote" ? "Remote styles (R_) only · " : "Styles for this computer only · ") + "Image: " + where(R.image) + " · Video + songs: " + where(R.video) + " · LLM: " + L(R.llm)
        + " · Vision LLM: " + L(R.vlm);
    $("gpuSetup").style.display = v.remote || loc ? "none" : "";
    // 2.747.0: the section is closed by default - its header says the choice
    if ($("gpuNow")) $("gpuNow").textContent = "· " + (v.where === "remote" ? "Remote" : v.where === "both" ? "Both" : "Local");
  }
  /** 2.764.1: a choice of Local / Remote / Both - one not set up yet waits for its set-up (the remote options show) */
  function choose(w) {
    var v = S.v || {};
    if (w !== "local" && !isReady(w, v)) { S.pick = w; $("gpuMsg").textContent = ""; paint(); return Promise.resolve(null); }
    S.pick = null;
    return save({ where: w }).then(function (r) { if (w === "local" && r && !r.error) closeRemote(); return r; });
  }
  /** the engine picked while Remote / Both waits: saved as soon as it can be */
  function waiting(v) { if (S.pick && v && !v.error && isReady(S.pick, v)) { var w = S.pick; S.pick = null; return save({ where: w }); } return v; }
  /** Local picked: the remote dockers close (their buttons are hidden now) */
  function closeRemote() {
    if (!(root.SecFloat && SecFloat.windows)) return;
    ["rgen", "pods", "runpod"].forEach(function (id) { if (SecFloat.windows[id] && (SecFloat.state(id) || {}).shown) SecFloat.show(id, false); });
  }
  function load() {
    return root.fetch("/api/gpusplit").then(function (r) { return r.json(); }).then(function (v) { if (v && v.where) { S.v = v; paint(); } return v; }).catch(function () { /* offline */ });
  }
  function save(b) {
    $("gpuMsg").textContent = "";
    return post("/api/gpusplit", b).then(function (v) {
      if (v.error) { $("gpuMsg").textContent = "✗ " + v.error; paint(); return v; }
      S.v = v; paint();
      // 2.766.2 (Tim: "when local is selected in basic settings go to local mode ... in remote mode stop comfyi"): what the
      // switch did (ComfyUI here started / stopped - lib/modeSwitch.js), and the page's model lists read again at once
      if (v.mode_switch && v.mode_switch.changed) {
        if (v.mode_switch.note) $("gpuMsg").textContent = v.mode_switch.note;
        if (root.H3RemoteModels && root.H3RemoteModels.recheck) root.H3RemoteModels.recheck(true);
      }
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
  root.H3GpuSplit = Object.assign({ load: load, save: save, choose: choose, state: function () { return S; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
