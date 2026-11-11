/* bitGen Studio — static/runson.js (2.746.0): A STYLE'S "RUNS ON" - this computer or the remote GPU (window.H3RunsOn).
 * Tim (verbatim): "when radio is selected for local show local styles, remote show remote styles (create remote styles),
 * both , show all styles" + "A Runs on setting per style ... add text input in styles for endpoints if remote style is
 * selected, prefix remote style names with R_ add this on save if it is not there"
 *   Under the name of each style editor - Settings ▸ Image (s_st), Settings ▸ Audio ▸ Music styles (s_mu), Settings ▸
 *   Video (s_vs): Runs on ◉ This computer ◉ Remote GPU, and for a remote style its RunPod endpoint ID (blank = the one in
 *   Settings ▸ Remote generation). The server keeps them (lib/styles.js gpuFields) and starts a remote style's name with "R_".
 *   paint(prefix, style)   read(prefix) -> {runs_on, endpoint}   (called from each form's paint / read)
 *   Basic Settings ▸ GPU then lists them (static/rpstyles.js) and routes them (lib/gpuSplit.js forJob).
 * 2.757.0 (Tim: Settings ▸ API, "if api is checked add it to styles with prefix API_"): a third choice, API - an online
 *   service from Settings ▸ API renders the style (misc/api_worker.py): which API, its Model (a RunningHub workflow ID) and
 *   Extra settings (a JSON object the request gets - a model's own options). The name starts with API_. */
(function (root) {
  "use strict";
  var doc = root.document;
  var NAME = { st: "s_stname", mu: "s_muname", vs: "s_vsname" };
  function $(id) { return doc.getElementById(id); }
  function build(p) {
    if ($("s_" + p + "runson")) return $("s_" + p + "runson");
    var name = $(NAME[p]); if (!name) return null;
    var host = name.closest(".grid3, .grid2") || name.closest("div") || name.parentNode;   // after the name's row, not inside its grid
    var box = doc.createElement("div"); box.id = "s_" + p + "runson"; box.className = "runson";
    box.style.cssText = "margin-top:6px";
    var lab = doc.createElement("label"); lab.className = "f"; lab.textContent = "Runs on"; box.appendChild(lab);
    var row = doc.createElement("div"); row.setAttribute("role", "radiogroup"); row.setAttribute("aria-label", "Runs on");
    row.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;align-items:center";
    [["local", "This computer", "Renders with the models on this computer"], ["remote", "Remote GPU", "Renders on the remote GPU (Basic Settings ▸ GPU) - its models must be there; the name starts with R_"],
     ["api", "API", "Renders on an online service from Settings ▸ API - no graphics card needed here; the name starts with API_"]].forEach(function (o) {
      var l = doc.createElement("label"); l.className = "chk"; l.style.margin = "0"; l.title = o[2];
      var i = doc.createElement("input"); i.type = "radio"; i.name = "s_" + p + "runson"; i.value = o[0];
      l.appendChild(i); l.appendChild(doc.createTextNode(" " + o[1])); row.appendChild(l);
      i.addEventListener("change", function () { show(p); poke(p); });
    });
    box.appendChild(row);
    var ep = doc.createElement("input"); ep.type = "text"; ep.id = "s_" + p + "ep"; ep.spellcheck = false;
    ep.placeholder = "RunPod endpoint ID (blank = the one in Settings ▸ Remote generation)";
    ep.title = "The RunPod Serverless endpoint this style renders on - its models and node packs must be there";
    ep.style.cssText = "margin-top:4px;width:100%";
    ep.addEventListener("input", function () { poke(p); });
    box.appendChild(ep);
    // 2.757.0: API - which one, its model, extra settings
    var ap = doc.createElement("div"); ap.id = "s_" + p + "api"; ap.style.cssText = "margin-top:4px;display:none;gap:6px;flex-direction:column";
    ap.innerHTML = `<select id="s_${p}apiid" title="Which API from Settings ▸ API renders this style"></select>`
      + `<input type="text" id="s_${p}apimodel" spellcheck="false" placeholder="Model (the service's model name - for RunningHub the workflow ID)" title="The service's model - leave as it is to use the one Settings ▸ API made it with">`
      + `<textarea id="s_${p}apiextra" rows="2" spellcheck="false" placeholder='Extra settings, JSON (optional) - e.g. {"num_inference_steps": 4}' title="A JSON object added to what is sent - a model's own options. For RunningHub a list of {nodeId, fieldName, fieldValue}"></textarea>`
      + `<span class="hint" id="s_${p}apinote"></span>`;
    ["apiid", "apimodel", "apiextra"].forEach(function (k) { ap.querySelector("#s_" + p + k).addEventListener(k === "apiid" ? "change" : "input", function () { poke(p); }); });
    box.appendChild(ap);
    host.parentNode.insertBefore(box, host.nextSibling);
    return box;
  }
  /** the form's own "changed" bookkeeping hears it (its listeners watch input events) */
  function poke(p) { var n = $(NAME[p]); if (n) n.dispatchEvent(new Event("input", { bubbles: true })); }
  function val(p) { var r = doc.querySelector('input[name="s_' + p + 'runson"]:checked'); return r ? r.value : "local"; }
  function show(p) {
    var e = $("s_" + p + "ep"); if (e) e.style.display = val(p) === "remote" ? "" : "none";
    var a = $("s_" + p + "api"); if (a) a.style.display = val(p) === "api" ? "flex" : "none";
    if (val(p) === "api") fill(p, null);
  }
  /* 2.757.0: the APIs from Settings ▸ API (asked once a minute at most) */
  var apis = null, apisAt = 0;
  var KIND = { st: "image", mu: "music", vs: "video" };
  function load(force) {
    if (apis && !force && Date.now() - apisAt < 60000) return Promise.resolve(apis);
    return fetch("/api/apis").then(function (r) { return r.json(); }).then(function (j) { apis = (j && j.apis) || []; apisAt = Date.now(); return apis; }).catch(function () { return apis || []; });
  }
  /** the API list for this kind of style; want = the id to select */
  function fill(p, want) {
    var sel = $("s_" + p + "apiid"); if (!sel) return Promise.resolve();
    var keep = want != null ? want : sel.value || sel.getAttribute("data-want") || "";
    return load(false).then(function (list) {
      var kind = KIND[p], ok = list.filter(function (a) { return (a.kinds || []).indexOf(kind) >= 0; });
      sel.innerHTML = "";
      var none = doc.createElement("option"); none.value = ""; none.textContent = ok.length ? `— pick an API —` : `— none: add one in Settings ▸ API —`; sel.appendChild(none);
      ok.forEach(function (a) { var o = doc.createElement("option"); o.value = a.id; o.textContent = a.name + " (" + a.service_name + ")" + (a.use ? "" : " - Use is off"); sel.appendChild(o); });
      if (keep && !ok.some(function (a) { return a.id === keep; })) { var g = doc.createElement("option"); g.value = keep; g.textContent = `(an API that is not in Settings ▸ API any more)`; sel.appendChild(g); }
      sel.value = keep;
      var n = $("s_" + p + "apinote"), cur = ok.filter(function (a) { return a.id === keep; })[0];
      if (n) n.textContent = cur ? (cur.note || "") : "";
    });
  }
  function paint(p, s) {
    if (!build(p)) return;
    var st = s || {}, v = st.runs_on === "remote" || st.runs_on === "api" ? st.runs_on : "local";
    doc.querySelectorAll('input[name="s_' + p + 'runson"]').forEach(function (i) { i.checked = i.value === v; });
    $("s_" + p + "ep").value = st.endpoint || "";
    var sel = $("s_" + p + "apiid"); sel.setAttribute("data-want", st.api_id || "");
    $("s_" + p + "apimodel").value = st.api_model || "";
    $("s_" + p + "apiextra").value = st.api_extra ? JSON.stringify(st.api_extra) : "";
    show(p);
    if (v === "api") fill(p, st.api_id || "");
  }
  function read(p) {
    if (!build(p)) return {};
    var v = val(p);
    if (v === "api") {
      var sel = $("s_" + p + "apiid");
      return { runs_on: "api", endpoint: "", api_id: sel.value || sel.getAttribute("data-want") || "", api_model: $("s_" + p + "apimodel").value.trim(), api_extra: $("s_" + p + "apiextra").value.trim() };
    }
    return { runs_on: v, endpoint: v === "remote" ? $("s_" + p + "ep").value.trim() : "" };
  }
  root.H3RunsOn = { paint: paint, read: read, build: build, reload: function () { apis = null; } };
})(typeof window !== "undefined" ? window : globalThis);
