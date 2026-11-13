/* bitGen Studio — static/podaudio.js (2.775.0): AUDIO ON A POD, inside its 🖥 PODS ▸ My pods item (window.H3PodAudio;
 * lib/podAudio.js, GET / POST /api/pods/:id/audio).
 * Tim (verbatim): "when we create the pod can we have a button for tts, stt and demacus(sheet music) and allow bitgen to clone
 * voices and store the voice locally until user selects that voice"
 *   🔊 Audio  ☐ Text to speech  ☐ Speech to text  ☐ Song separation - under the pod's "what it is for" ticks. A change is
 *             saved at once; a newly ticked engine is installed on the pod now when it runs (a stopped pod: when it next
 *             runs - it is never started for this). In remote mode those jobs then run on the pod; a line says how far
 *             the install is. Your cloned voices stay in this computer's voice store - a clip goes to the pod only when
 *             its voice is used (and only once).
 * Pure (Node: scripts/test-podaudio775.js): line.
 */
(function (root) {
  "use strict";
  /** the line under the ticks (pure): st = {kinds, install} */
  function line(st) {
    var s = st || {}, i = s.install, k = s.kinds || [];
    if (i && i.running) return "⏳ " + (i.state || "installing on the pod…");
    var bad = i ? Object.keys(i.failed || {}) : [];
    if (bad.length) return "✗ " + bad.map(function (x) { return x + ": " + i.failed[x]; }).join("; ");
    if (i && (i.done || []).length) return "✓ on the pod: " + i.done.join(", ");
    return k.length ? "installed on the pod when it next runs (or before its first job)" : "none - these run on this computer";
  }
  var pure = { line: line };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, ST = {};
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function kinds() { return (root.H3Pods && H3Pods.AUDIO) || [["tts", "Text to speech", ""], ["stt", "Speech to text", ""], ["stems", "Song separation", ""]]; }
  function paint(row, id) {
    var box = row.querySelector(".paRow");
    if (!box) {
      var after = row.querySelector(".psKinds"); if (!after) return;
      box = doc.createElement("div"); box.className = "paRow"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Audio on this pod");
      box.style.cssText = "display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;margin:4px 0";
      after.parentNode.insertBefore(box, after.nextSibling);
    }
    var st = ST[id] || { kinds: [] }, h = '<span class="hint" title="Installed on the pod - in remote mode these jobs run there instead of on this computer">🔊 Audio</span>'
      + kinds().map(function (k) { return '<label class="chk" style="margin:0" title="' + esc(k[2]) + '"><input type="checkbox" data-paaud="' + k[0] + '"' + ((st.kinds || []).indexOf(k[0]) >= 0 ? " checked" : "") + "> " + esc(k[1]) + "</label>"; }).join("")
      + '<span class="hint paLine" style="flex-basis:100%;font-size:.7rem" aria-live="polite">' + esc(line(st)) + "</span>";
    if (box.dataset.sig === h) return;   // (the browser rewrites innerHTML - the source is compared, or the observer loops)
    box.dataset.sig = h; box.innerHTML = h;
    box.querySelectorAll("[data-paaud]").forEach(function (c) { c.onchange = function () {
      var ks = []; box.querySelectorAll("[data-paaud]").forEach(function (x) { if (x.checked) ks.push(x.dataset.paaud); });
      root.fetch("/api/pods/" + encodeURIComponent(id) + "/audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kinds: ks }) })
        .then(function (r) { return r.json(); }).then(function (j) { if (j && !j.error) { ST[id] = j; paint(row, id); } });
    }; });
  }
  function load(id) { return root.fetch("/api/pods/" + encodeURIComponent(id) + "/audio").then(function (r) { return r.json(); }).then(function (j) { if (j && !j.error) ST[id] = j; }).catch(function () { /* next time */ }); }
  function sweep() {
    doc.querySelectorAll("#pdPods .pdRow[data-pod]").forEach(function (row) { var id = row.dataset.pod; if (row.querySelector(".psKinds")) paint(row, id); });
  }
  function poll() {
    var vis = doc.getElementById("pdPods") && doc.getElementById("pdPods").offsetParent !== null;
    var ids = vis ? Array.prototype.map.call(doc.querySelectorAll("#pdPods .pdRow[data-pod]"), function (r) { return r.dataset.pod; }) : [];
    Promise.all(ids.map(load)).then(sweep).then(function () { setTimeout(poll, +(root.H3_POD_AUDIO_POLL || 4000)); });
  }
  function boot() {
    var host = doc.getElementById("pdPods");
    if (!host) { setTimeout(boot, 500); return; }
    new MutationObserver(function () { sweep(); }).observe(host, { childList: true, subtree: true });
    poll();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3PodAudio = Object.assign({ state: function () { return ST; }, sweep: sweep }, pure);
})(typeof window !== "undefined" ? window : globalThis);
