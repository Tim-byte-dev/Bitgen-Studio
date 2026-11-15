/* bitGen Studio — static/remoteuse.js (2.787.0): BASIC SETTINGS ▸ USE MODEL / USE TEMPORARY LORAS ▸ ☐ REMOTE + A POD
 * (window.H3RemoteUse; lib/basicUse.js *_pod, GET / POST /api/basic-use; the pods from GET /api/podinv).
 *
 * Tim (verbatim): "in basic settings add a checkbox under use model, "remote", so if user clicks a local model with this setting
 * enabled bitgen will look for the model on civitai/hf and upload to a selected pod (pod dropdown will be next remote checkbox,
 * same with the loras"
 *   Under each of the four Use … boxes (static/ovruse.js): ☐ Remote + the pod list. Ticked = a model / LoRAs picked from this
 *   computer render on that pod - before the render bitGen looks for them online (Civitai, Hugging Face) and the pod downloads
 *   them, else they are sent from this computer (lib/podPick.js -> lib/podRevive.js modelGate; the Queue says which). A
 *   "<pod>/<file>" pick goes to its own pod either way. The row shows only while bitGen knows a pod.
 * Pure (Node: scripts/test-podinv787.js): ROWS, rowHtml.
 */
(function (root) {
  "use strict";
  /** [the Use … box it goes under, the basic_use key, words] */
  var ROWS = [["useImgModel", "image_model_pod", "the picture model"], ["useImgLoras", "image_loras_pod", "the picture LoRAs"],
    ["useVidModel", "video_model_pod", "the video model"], ["useVidLoras", "video_loras_pod", "the video LoRAs"]];
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /** one row's inner HTML (pure): pods = [{id, label}], cur = the pod id or "" */
  function rowHtml(row, pods, cur) {
    var on = !!cur;
    return '<label class="chk" title="Ticked: ' + esc(row[2]) + ' picked from this computer render on the pod - found online (Civitai / Hugging Face) and downloaded by the pod, else sent from this computer">'
      + '<input type="checkbox" data-rukey="' + esc(row[1]) + '"' + (on ? " checked" : "") + "> Remote</label>"
      + '<select data-rupod="' + esc(row[1]) + '" aria-label="The pod for ' + esc(row[2]) + '"' + (on ? "" : " disabled") + ">"
      + (pods || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === cur ? " selected" : "") + ">" + esc(p.label) + "</option>"; }).join("") + "</select>";
  }
  var pure = { ROWS: ROWS, rowHtml: rowHtml };
  if (typeof module === "object" && module.exports && !root.document) { module.exports = pure; return; }

  var doc = root.document, S = { pods: [], use: {} };
  function $(id) { return doc.getElementById(id); }
  function save(key, val) {
    var b = {}; b[key] = val;
    return root.fetch("/api/basic-use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
      .then(function (r) { return r.json(); }).then(function (j) { if (j && !j.error) S.use = j; paint(); }).catch(function () { /* kept */ });
  }
  function paint() {
    ROWS.forEach(function (row) {
      var box = $(row[0]); if (!box) return;
      var lab = box.closest("label"); if (!lab || !lab.parentNode) return;
      var host = $("ru_" + row[1]);
      if (!host) { host = doc.createElement("div"); host.id = "ru_" + row[1]; host.className = "ruRow"; host.style.cssText = "display:flex;gap:6px;align-items:center;margin:2px 0 0 18px;font-size:.72rem"; lab.parentNode.insertBefore(host, lab.nextSibling); }
      host.hidden = !S.pods.length;
      var cur = S.use[row[1]] || "";
      var html = rowHtml(row, S.pods, cur);
      if (host.dataset.html === html) return;
      host.dataset.html = html; host.innerHTML = html;
      var ck = host.querySelector("[data-rukey]"), sel = host.querySelector("[data-rupod]");
      ck.onchange = function () { save(row[1], ck.checked ? (sel.value || (S.pods[0] && S.pods[0].id) || "") : ""); };
      sel.onchange = function () { if (ck.checked) save(row[1], sel.value); };
      sel.addEventListener("keydown", function (e) { e.stopPropagation(); });
    });
  }
  function load() {
    return Promise.all([root.fetch("/api/podinv").then(function (r) { return r.json(); }).catch(function () { return {}; }),
      root.fetch("/api/basic-use").then(function (r) { return r.json(); }).catch(function () { return {}; })]).then(function (a) {
      S.pods = ((a[0] && a[0].pods) || []).filter(function (p) { return !p.gone; });
      S.use = a[1] || {};
      paint();
    });
  }
  function boot(n) { if (!$("useImgModel") && (n || 0) < 60) { setTimeout(function () { boot((n || 0) + 1); }, 500); return; } load(); }
  doc.addEventListener("h3:podinv", function () { load(); });
  doc.addEventListener("h3:rgpu", function () { setTimeout(load, 500); });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { boot(0); }); else boot(0);
  root.H3RemoteUse = Object.assign({ load: load, state: function () { return S; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
