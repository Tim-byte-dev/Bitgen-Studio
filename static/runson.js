/* bitGen Studio — static/runson.js (2.746.0): A STYLE'S "RUNS ON" - this computer or the remote GPU (window.H3RunsOn).
 * Tim (verbatim): "when radio is selected for local show local styles, remote show remote styles (create remote styles),
 * both , show all styles" + "A Runs on setting per style ... add text input in styles for endpoints if remote style is
 * selected, prefix remote style names with R_ add this on save if it is not there"
 *   Under the name of each style editor - Settings ▸ Image (s_st), Settings ▸ Audio ▸ Music styles (s_mu), Settings ▸
 *   Video (s_vs): Runs on ◉ This computer ◉ Remote GPU, and for a remote style its RunPod endpoint ID (blank = the one in
 *   Settings ▸ Remote generation). The server keeps them (lib/styles.js gpuFields) and starts a remote style's name with "R_".
 *   paint(prefix, style)   read(prefix) -> {runs_on, endpoint}   (called from each form's paint / read)
 *   Basic Settings ▸ GPU then lists them (static/rpstyles.js) and routes them (lib/gpuSplit.js forJob). */
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
    [["local", "This computer", "Renders with the models on this computer"], ["remote", "Remote GPU", "Renders on the remote GPU (Basic Settings ▸ GPU) - its models must be there; the name starts with R_"]].forEach(function (o) {
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
    host.parentNode.insertBefore(box, host.nextSibling);
    return box;
  }
  /** the form's own "changed" bookkeeping hears it (its listeners watch input events) */
  function poke(p) { var n = $(NAME[p]); if (n) n.dispatchEvent(new Event("input", { bubbles: true })); }
  function val(p) { var r = doc.querySelector('input[name="s_' + p + 'runson"]:checked'); return r ? r.value : "local"; }
  function show(p) { var e = $("s_" + p + "ep"); if (e) e.style.display = val(p) === "remote" ? "" : "none"; }
  function paint(p, s) {
    if (!build(p)) return;
    var st = s || {}, v = st.runs_on === "remote" ? "remote" : "local";
    doc.querySelectorAll('input[name="s_' + p + 'runson"]').forEach(function (i) { i.checked = i.value === v; });
    $("s_" + p + "ep").value = st.endpoint || "";
    show(p);
  }
  function read(p) {
    if (!build(p)) return {};
    var v = val(p);
    return { runs_on: v, endpoint: v === "remote" ? $("s_" + p + "ep").value.trim() : "" };
  }
  root.H3RunsOn = { paint: paint, read: read, build: build };
})(typeof window !== "undefined" ? window : globalThis);
