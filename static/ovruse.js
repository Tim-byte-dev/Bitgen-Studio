/* bitGen Studio — static/ovruse.js (2.777.0): BASIC SETTINGS ▸ ☑ USE MODEL OVER THE CHECKPOINT / VIDEO MODEL AND ☑ USE TEMPORARY
 * LORAS OVER THE TEMPORARY LORAS - pictures and video each (window.H3OvrUse; lib/basicUse.js, GET / POST /api/basic-use).
 * Tim (verbatim): "add a checkbox over the checkpoint "Use Model", and another over loras "Use Temporary Lora's this will allow
 * the style to be more versatile, we can send overide settings without changing the base model or use loras if we want with
 * the styles model or the overide model"
 *   Use model off           the style's own model renders (Override's steps / CFG / size / seed still go) - the pick is kept
 *   Use temporary LoRAs off none of them are added - the list is kept; on = added to whichever model renders (the style's or
 *                           the override's)
 *   The field under an unticked box is dimmed. The request bodies ask model(kind) / loras(kind) (static/index.html useTL /
 *   useMD, static/basicset.js, ext/videodock/characters.js, static/lorasel.js); the server reads the same flags.
 * Pure (Node: scripts/test-ovruse777.js): SPOTS, fieldsOf.
 */
(function (root) {
  "use strict";
  /** where each box goes (pure): [flag key, box id, label, the element it goes above (its label's anchor), what it dims] */
  var WORDS = { model: { label: "Use model" }, loras: { label: "Use temporary LoRAs" } };   // (label: - the UI translations read it)
  var SPOTS = [
    ["image_model", "useImgModel", WORDS.model.label, "imgCkptCombo", ["imgCkptCombo"]],
    ["image_loras", "useImgLoras", WORDS.loras.label, "tliAdd", ["tliRows"]],
    ["video_model", "useVidModel", WORDS.model.label, "vidModel", ["vidModel"]],
    ["video_loras", "useVidLoras", WORDS.loras.label, "tlvAdd", ["tlvRows"]],
  ];
  /** the four flags from GET /api/basic-use (pure) - on unless false */
  function fieldsOf(j) { var o = {}; SPOTS.forEach(function (s) { o[s[0]] = !(j && j[s[0]] === false); }); return o; }
  var pure = { SPOTS: SPOTS, fieldsOf: fieldsOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, U = fieldsOf(null);
  function $(id) { return doc.getElementById(id); }
  /** the label row to put the box over: the field's own <label> (a label[for], or the label holding the ＋ button), else the label before it */
  function anchorOf(id) {
    var el = $(id); if (!el) return null;
    var lab = el.closest("label") || doc.querySelector('label[for="' + id + '"]');
    if (lab) return lab;
    var p = el.previousElementSibling; while (p && p.tagName !== "LABEL") p = p.previousElementSibling;
    return p || el;
  }
  function dim(s) { s[4].forEach(function (id) { var e = $(id); if (e) { e.style.opacity = U[s[0]] ? "" : ".45"; e.title = U[s[0]] ? (e.dataset.ouTitle || e.title) : "Not used - tick " + s[2] + " above"; } }); }
  function build() {
    var n = 0;
    SPOTS.forEach(function (s) {
      if ($(s[1])) { n++; return; }
      var a = anchorOf(s[3]); if (!a || !a.parentNode) return;
      var l = doc.createElement("label"); l.className = "chk ovrUse"; l.style.cssText = "display:flex;align-items:center;gap:6px;margin:8px 0 0;font-size:.74rem";
      l.title = s[0].indexOf("model") >= 0 ? "Ticked: this model replaces the style's while Override style is on. Unticked: the style's own model renders - the other Override settings still apply."
        : "Ticked: these LoRAs are added to whichever model renders (the style's or the override). Unticked: none are added - the list is kept.";
      l.innerHTML = '<input type="checkbox" id="' + s[1] + '"> ' + s[2];
      a.parentNode.insertBefore(l, a);
      $(s[1]).onchange = function () { U[s[0]] = $(s[1]).checked; dim(s); save(); };
      n++;
    });
    return n === SPOTS.length;
  }
  function paint() { SPOTS.forEach(function (s) { var c = $(s[1]); if (c) c.checked = U[s[0]]; dim(s); }); }
  function save() {
    root.fetch("/api/basic-use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(U) })
      .then(function (r) { return r.json(); }).then(function (j) { if (j && !j.error) { U = fieldsOf(j); paint(); } }).catch(function () { /* kept here */ });
  }
  function boot(tries) {
    if (!build() && (tries || 0) < 60) { setTimeout(function () { boot((tries || 0) + 1); }, 500); }
    root.fetch("/api/basic-use").then(function (r) { return r.json(); }).then(function (j) { U = fieldsOf(j); paint(); }).catch(function () { paint(); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { boot(0); }); else boot(0);
  root.H3OvrUse = Object.assign({ model: function (k) { return U[(k === "image" ? "image" : "video") + "_model"]; },
    loras: function (k) { return k === "cnet" ? true : U[(k === "image" ? "image" : "video") + "_loras"]; }, state: function () { return U; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
