/* bitGen Studio — static/basicplace.js (2.797.0): BASIC SETTINGS' MODEL + LORA LISTS BY PLACE (window.H3BasicPlace).
 * Tim (verbatim): "in basic settings remove the remote checkboxes, show local/openrouter/runpod/all in the dropdowns then filter the
 * model lists by the type, do the same for loras, if in image mode show all models in the styles model family in checkpoint list and
 * lora list, if in video mode do the same but for videos"
 *   The ☐ Remote + pod rows under Use model / Use temporary LoRAs (static/remoteuse.js, 2.787.0) are gone; a pod left picked there
 *   is cleared once (POST /api/basic-use *_pod = "") so nothing goes to a pod unseen. A pod's file is picked as <pod>/<file> instead.
 *   Each list gets a place dropdown in front of it - the folder dropdown's place in the combo (index.html cmCombo, for #imgCkptCombo /
 *   #tliRows / #tlvRows), a select before the video Model (#vidModelPlace):
 *     All places (n) · This computer (n) · RunPod (n) · OpenRouter (n)   (OpenRouter only on the model lists - it has no LoRAs)
 *   The counts and the list are AFTER the style-family filter (static/famfilter.js: the prompt docker's image style for the picture
 *   checkpoint + LoRAs, its video style for the video Model + LoRAs). Kept per list in localStorage h3.bsplace.<list>.
 * Pure (Node: scripts/test-basicplace797.js): placeOf, counts, optionsHtml, keep, LISTS.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) { root.H3BasicPlace = api; api.boot(root); }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  /** the lists: [id, has OpenRouter] */
  var LISTS = { "image-model": true, "image-loras": false, "video-model": true, "video-loras": false };
  var OR = "openrouter/";
  /** where a list entry is: an OpenRouter model, a pod's file (<pod>/<file> or a remote-mode model), else this computer */
  function placeOf(f) {
    var n = typeof f === "string" ? f : String((f && (f.name || f.value)) || "");
    if (n.indexOf(OR) === 0) return "openrouter";
    if (f && typeof f === "object" && (f.pod || f.remote || f.nopod)) return "runpod";
    return "local";
  }
  function counts(files) { var n = { all: 0, local: 0, runpod: 0, openrouter: 0 }; (files || []).forEach(function (f) { n[placeOf(f)]++; n.all++; }); return n; }
  function keep(list, cur) { return /^(all|local|runpod|openrouter)$/.test(cur || "") && (cur !== "openrouter" || LISTS[list]) ? cur : "all"; }
  /** the dropdown's options (pure) - the words written out so the translator sees them */
  function optionsHtml(list, cur, n) {
    var c = n || {}, p = keep(list, cur), sel = function (v) { return p === v ? " selected" : ""; };
    return '<option value="all"' + sel("all") + ">All places (" + (c.all || 0) + ")</option>"
      + '<option value="local"' + sel("local") + ">This computer (" + (c.local || 0) + ")</option>"
      + '<option value="runpod"' + sel("runpod") + ">RunPod (" + (c.runpod || 0) + ")</option>"
      + (LISTS[list] ? '<option value="openrouter"' + sel("openrouter") + ">OpenRouter (" + (c.openrouter || 0) + ")</option>" : "");
  }
  /** which list a combo / field is (null = not one of Basic Settings' lists) */
  function listOf(el) {
    if (!el || !el.closest) return null;
    if (el.closest("#imgCkptCombo")) return "image-model";
    if (el.closest("#tliRows")) return "image-loras";
    if (el.closest("#tlvRows")) return "video-loras";
    if (el.id === "vidModel" || el.id === "vidModelPlace") return "video-model";
    return null;
  }
  var win = null;
  function get(list) { try { return keep(list, win.localStorage.getItem("h3.bsplace." + list)); } catch (e) { return "all"; } }
  function set(list, v) { try { win.localStorage.setItem("h3.bsplace." + list, keep(list, v)); } catch (e) { /* private window */ } }
  /** a pod left picked under the old ☐ Remote is cleared once (nothing goes to a pod unseen) */
  function clearOldPods() {
    return win.fetch("/api/basic-use").then(function (r) { return r.json(); }).then(function (u) {
      var keys = ["image_model_pod", "image_loras_pod", "video_model_pod", "video_loras_pod"], b = {}, any = false;
      keys.forEach(function (k) { if (u && u[k]) { b[k] = ""; any = true; } });
      if (any) return win.fetch("/api/basic-use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    }).catch(function () { /* an older server */ });
  }
  /** the video Model's place dropdown: refill the list when it changes */
  function wireVideo() {
    var s = win.document.getElementById("vidModelPlace"); if (!s || s.dataset.wired) return;
    s.dataset.wired = "1";
    s.addEventListener("change", function () { set("video-model", s.value); if (win.H3Basic && win.H3Basic.refill) win.H3Basic.refill(); });
  }
  function boot(w) {
    win = w;
    var go = function () {
      wireVideo(); clearOldPods();
      // a temporary LoRA row is built before it is put in its list - repaint it there, so it gets the place dropdown
      ["tliRows", "tlvRows"].forEach(function (id) {
        var box = w.document.getElementById(id); if (!box || !w.MutationObserver) return;
        new w.MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes || [], function (n) { var c = n.querySelector && n.querySelector(".cmcombo"); if (c && c._repaint && !c.querySelector(".cmplace")) c._repaint(); }); }); }).observe(box, { childList: true });
      });
    };
    if (w.document.readyState === "loading") w.document.addEventListener("DOMContentLoaded", go); else go();
  }
  return { LISTS: LISTS, placeOf: placeOf, counts: counts, keep: keep, optionsHtml: optionsHtml, listOf: listOf, get: get, set: set, boot: boot };
});
