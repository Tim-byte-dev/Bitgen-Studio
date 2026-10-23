/* bitGen Studio — static/lorasel.js (2.581.0): THE SELECTED LoRAs (window.H3LoraSel) - what ✨ Enhance and the prompt chat
 * send so the LLM writes their keywords into the prompt (lib/loraWords.js). Tim: "make the llm add the selected loras
 * keywords to the prompt".
 *   ctx(mode?)    2.585.0 - what the LLM gets: {lora_override, loras} - Override style on = Basic Settings' temporary
 *                 LoRAs only; off = the selected style's LoRAs (the server reads them). paths() is no longer sent.
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
  /** 2.585.0: the Generate mode's kind (image / video - Chat counts as video) */
  function kindOf(mode) { return (mode || ((document.getElementById("genModeSel") || {}).value)) === "image" ? "image" : "video"; }
  /** 2.585.0 (Tim: "don't use keywords from all the loras when creating a prompt, only use the keywords from the loras
   *  selected in temporary loras when overide is selected in basic settings or the selected styles loras"): what rides
   *  with ✨ Enhance and the prompt chat - {lora_override, loras}: Override style ON = Basic Settings' temporary LoRAs of
   *  the Generate mode; OFF = none sent, the server takes the selected style's own LoRAs (lib/loraWords.pathsFor) */
  function ctx(mode) {
    var k = kindOf(mode);
    var ovr = false;
    try { ovr = root.H3Basic && typeof root.H3Basic.on === "function" ? !!root.H3Basic.on() : !!((document.getElementById("ovrStyle") || {}).checked); } catch (e) { ovr = false; }
    var rows = [];
    if (ovr) { try { if (typeof root.tempLoras === "function") rows = root.tempLoras(k).map(function (l) { return l.path; }); } catch (e) { rows = []; } }
    return { lora_override: ovr, loras: merge(rows) };
  }
  function paths(mode) {
    var m = mode || ((document.getElementById("genModeSel") || {}).value === "image" ? "image" : "video");
    var rows = [];
    try { if (typeof root.tempLoras === "function") rows = root.tempLoras(m === "image" ? "image" : "video").map(function (l) { return l.path; }); } catch (e) { rows = []; }
    var mm = [];
    try { var s = root.H3ModelMgr && root.H3ModelMgr.state && root.H3ModelMgr.state(); mm = s && s.sel && s.sel.loras ? s.sel.loras.map(function (l) { return l.path; }) : []; } catch (e) { mm = []; }
    return merge(rows, mm);
  }
  root.H3LoraSel = { paths: paths, merge: merge, ctx: ctx };
})(typeof window !== "undefined" ? window : this);
