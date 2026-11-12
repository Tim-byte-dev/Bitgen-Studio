/* bitGen Studio — static/remoteprep.js (2.767.0): BASIC SETTINGS ▸ GPU - where the LLM / Vision LLM run in remote mode, and how
 * far bitGen is with getting them and the video style ready. window.H3RemotePrep (+ require() in Node for the pure part).
 *
 * Tim (verbatim): "when in remote mode, prepare the llm and video models for remote use" + "give user option to use openrouter
 * or runpod for llm/vllm or local"
 *
 *   LLM          ( ) Local  ( ) OpenRouter  ( ) RunPod      Local = llama-server on this computer; RunPod = your pod (Pods -
 *   Vision LLM   ( ) Local  ( ) OpenRouter  ( ) RunPod      bitGen sets up llama.cpp there with the same GGUF) or the vLLM
 *                                                           endpoint (Serverless)
 *   a line each: "on the pod: downloading x - 40%" / "ready on the pod" / why it could not; the video style's line too.
 *   start()      the page's picks (the Video style, the LLM) to POST /api/remoteprep/start - called when Remote is picked
 *                (static/remotemodels.js recheck), when the Video style / LLM changes in remote mode, and on load in remote mode
 * Pure (Node: scripts/test-podllm767.js): lineOf.
 */
(function (root) {
  "use strict";
  /** a status line (pure) - kind's label + its state */
  function lineOf(label, s) {
    if (!s) return "";
    var p = s.phase === "ready" ? "✓ " : s.phase === "failed" ? "✗ " : "⏳ ";
    return p + label + ": " + (s.note || s.phase || "");
  }
  var api = { lineOf: lineOf };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  var doc = root.document, S = { v: null, t: null };
  function $(id) { return doc.getElementById(id); }
  function getj(u) { return root.fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }); }
  function picks() { return { video_style_id: $("videoStyleSel") ? $("videoStyleSel").value : "", llm_file: $("llmSel") ? $("llmSel").value : "" }; }
  var CHOICES = [["local", "Local", "llama-server on this computer"], ["openrouter", "OpenRouter", "OpenRouter's model (Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter) - paid per token"],
    ["runpod", "RunPod", "Your pod: bitGen sets up llama.cpp there with the same GGUF as here (Pods) - or the RunPod vLLM endpoint (Serverless)"]];
  function build() {
    var box = $("sec-gpu"); if (!box || $("gpuLlmWhere") || !$("gpuEngine")) return !!$("gpuLlmWhere");
    if (!$("rpPrepCss")) { var st = doc.createElement("style"); st.id = "rpPrepCss"; st.textContent = "#sec-gpu.gpuLocal #gpuLlmWhere{display:none!important}#gpuLlmWhere .rpRow{display:flex;gap:4px 12px;flex-wrap:wrap;align-items:center;margin-top:3px}#gpuLlmWhere .rpRow > span:first-child{font-size:.7rem;min-width:92px}#gpuLlmWhere .rpSt{font-size:.68rem;margin-left:96px}"; doc.head.appendChild(st); }
    var w = doc.createElement("div"); w.id = "gpuLlmWhere"; w.style.marginTop = "6px";
    [["llm", "LLM"], ["vlm", "Vision LLM"]].forEach(function (k) {
      var row = doc.createElement("div"); row.className = "rpRow"; row.setAttribute("role", "radiogroup"); row.setAttribute("aria-label", k[1] + " runs on");
      var lab = doc.createElement("span"); lab.className = "hint"; lab.textContent = k[1]; row.appendChild(lab);
      CHOICES.forEach(function (c) {
        var l = doc.createElement("label"); l.className = "chk"; l.style.margin = "0"; l.title = c[2];
        var i = doc.createElement("input"); i.type = "radio"; i.name = "rp_" + k[0]; i.value = c[0];
        i.onchange = function () { var b = picks(); b[k[0]] = c[0]; post("/api/remoteprep/where", b).then(paint); };
        l.appendChild(i); l.appendChild(doc.createTextNode(" " + c[1])); row.appendChild(l);
      });
      w.appendChild(row);
      var op = doc.createElement("div"); op.id = "rpOr_" + k[0]; op.style.display = "none"; w.appendChild(op);   // OpenRouter's model (static/openrouter.js picker)
      var st2 = doc.createElement("div"); st2.className = "hint rpSt"; st2.id = "rpSt_" + k[0]; st2.setAttribute("aria-live", "polite"); w.appendChild(st2);
    });
    var vs = doc.createElement("div"); vs.className = "hint rpSt"; vs.id = "rpSt_video"; vs.style.marginLeft = "0"; vs.setAttribute("aria-live", "polite"); w.appendChild(vs);
    $("gpuEngine").parentNode.insertBefore(w, $("gpuEngine").nextSibling);
    if ($("videoStyleSel")) $("videoStyleSel").addEventListener("change", function () { if (S.v && S.v.pods_mode) start(); });
    return true;
  }
  function paint(v) {
    if (v && !v.error) S.v = v;
    v = S.v; if (!v || !build()) return;
    ["llm", "vlm"].forEach(function (k) {
      var w = (v.where || {})[k] || "";
      doc.querySelectorAll('input[name="rp_' + k + '"]').forEach(function (i) { i.checked = i.value === (w || "local"); });
      var s = v[k], why = w === "openrouter" && !v.openrouter_ready ? "✗ OpenRouter is not set up - Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter"
        : w === "runpod" && !v.engine_pods && !v.vllm_ready ? "✗ RunPod Serverless needs its vLLM endpoint (Settings ▸ Remote generation) - or pick RunPod ▸ Pods"
        : w === "runpod" && v.engine_pods ? (s ? lineOf("on the pod", s) : "set up on your pod when you send a prompt (the first time takes a few minutes)") : "";
      $("rpSt_" + k).textContent = why;
      // 2.767.0 (Tim: "the model should be able to be changed ... list/search open routers models and choose one"): OpenRouter's
      // model, searchable, right here
      var op = $("rpOr_" + k); op.style.display = w === "openrouter" ? "flex" : "none";
      if (w === "openrouter" && root.H3OpenRouter && root.H3OpenRouter.picker) root.H3OpenRouter.picker(op, k);
    });
    $("rpSt_video").textContent = v.video ? lineOf("Video style " + (v.video.style || ""), v.video) : "";
    clearTimeout(S.t);
    var busy = ["llm", "vlm", "video"].some(function (k) { return v[k] && v[k].phase === "preparing"; });
    S.t = setTimeout(refresh, busy ? 3000 : 20000);
  }
  function refresh() { return getj("/api/remoteprep").then(paint).catch(function () { clearTimeout(S.t); S.t = setTimeout(refresh, 20000); }); }
  /** the picks of this page to the server - it prepares what remote mode needs */
  function start() { return post("/api/remoteprep/start", picks()).then(paint).catch(function () { /* the server is restarting */ }); }
  function boot() { if (!build()) { setTimeout(boot, 1500); return; } refresh().then(function () { if (S.v && S.v.pods_mode) start(); }); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 800); }); else setTimeout(boot, 800);
  root.H3RemotePrep = Object.assign({ start: start, refresh: refresh }, api);
})(typeof window !== "undefined" ? window : globalThis);
