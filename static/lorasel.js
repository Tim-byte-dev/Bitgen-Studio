/* bitGen Studio — static/lorasel.js (2.581.0): THE SELECTED LoRAs (window.H3LoraSel) - what ✨ Enhance and the prompt chat
 * send so the LLM writes their keywords into the prompt (lib/loraWords.js). Tim: "make the llm add the selected loras
 * keywords to the prompt".
 *   paths(mode?)  the LoRA paths: Basic Settings' LoRA rows for the Generate mode (image / video - where the 🧩 Model
 *                 manager's ✓ picks land) + the Model manager's own picks; no duplicates (pure helper: merge) */
(function (root) {
  "use strict";
  /** lists of paths -> one list, first seen kept, either slash, any case (pure) */
  function merge() {
    var out = [], seen = {};
    for (var a = 0; a < arguments.length; a++) (arguments[a] || []).forEach(function (p) {
      var k = String(p || "").trim().replace(/\\/g, "/").toLowerCase(); if (!k || seen[k]) return; seen[k] = 1; out.push(String(p).trim());
    });
    return out;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { merge: merge }; return; }
  function paths(mode) {
    var m = mode || ((document.getElementById("genModeSel") || {}).value === "image" ? "image" : "video");
    var rows = [];
    try { if (typeof root.tempLoras === "function") rows = root.tempLoras(m === "image" ? "image" : "video").map(function (l) { return l.path; }); } catch (e) { rows = []; }
    var mm = [];
    try { var s = root.H3ModelMgr && root.H3ModelMgr.state && root.H3ModelMgr.state(); mm = s && s.sel && s.sel.loras ? s.sel.loras.map(function (l) { return l.path; }) : []; } catch (e) { mm = []; }
    return merge(rows, mm);
  }
  root.H3LoraSel = { paths: paths, merge: merge };
})(typeof window !== "undefined" ? window : this);
