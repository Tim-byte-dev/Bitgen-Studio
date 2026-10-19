/* bitGen Studio — static/refinfo.js (2.539.0): A DESCRIPTION FOR EVERY REFERENCE + THE HOUSE TYPES (window.RefInfo).
 *
 * Tim (verbatim): "can we use our reference docker images , like walls, furniture, lights etc in homebuilder and
 * image-editor?" + "add an input for all types of references so user can add a brief description of the references"
 * + "and add all 4 of the suggestions u gave".
 *
 *   A DESCRIPTION  every reference - a picture in the Image tab, a video, a sound - has a short box under it ("a green
 *                  velvet chesterfield", "her voice, calm"). It is kept with the project (the .prj manifest: images[].desc,
 *                  notes.videos / notes.audio) and with a saved group; it goes into the mapping lines ("<subject 2>
 *                  furniture is in <Picture 2> (a green velvet chesterfield)"), the prompt chat / ✨ Enhance (it
 *                  beats the captioner's guess), the house builder and the image editor.
 *   THE TYPES      wall · floor · furniture · light join the picture Type dropdown (the house builder lists those first)
 *   window.H3Refs  (static/index.html) the dock for the other dockers: images() [{i, name, url, role, desc, file}],
 *                  videos() / sounds() [{name, desc}]
 * Pure (Node: scripts/test-refinfo539.js): clean, mapLine, notesFor, notesIn, houseFirst, label.
 */
(function (root) {
  "use strict";
  var HOUSE = ["wall", "floor", "furniture", "light"];
  var MAX = 200;
  /** a description as kept: one line, no doubled spaces, at most 200 characters */
  function clean(t) { return String(t == null ? "" : t).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, MAX); }
  /** one mapping line: "<subject 1> face is in <Picture 2> (her face, freckles)" (role person / subject = no word) */
  function mapLine(subject, role, n, desc) {
    var r = String(role || "person"), what = r === "person" || r === "subject" ? "" : r + " ", d = clean(desc);
    return "<subject " + subject + "> " + what + "is in <Picture " + n + ">" + (d ? " (" + d + ")" : "");
  }
  /** the notes kept for the dock's videos + sounds: only names still in the lists, only non-empty */
  function notesFor(vids, auds, notes) {
    var n = notes || {}, out = { videos: {}, audio: {} };
    (vids || []).forEach(function (v) { var d = clean(((n.videos || {})[v])); if (d) out.videos[v] = d; });
    (auds || []).forEach(function (a) { var d = clean(((n.audio || n.audios || {})[a])); if (d) out.audio[a] = d; });
    return out;
  }
  /** a stored notes object -> {videos: {}, audio: {}} (tolerates missing parts / the group's "audios") */
  function notesIn(m) {
    var n = (m && m.notes) || {}, out = { videos: {}, audio: {} };
    Object.keys(n.videos || {}).forEach(function (k) { var d = clean(n.videos[k]); if (d) out.videos[k] = d; });
    var a = n.audio || n.audios || {};
    Object.keys(a).forEach(function (k) { var d = clean(a[k]); if (d) out.audio[k] = d; });
    return out;
  }
  /** the dock's pictures for the house builder: wall / floor / furniture / light (in that order) first, then the rest */
  function houseFirst(list, want) {
    var rank = function (r) { var i = HOUSE.indexOf(String((r && r.role) || "")); return i < 0 ? 9 : (want && r.role === want ? -1 : i); };
    return (list || []).map(function (r, i) { return [r, i]; }).sort(function (a, b) { return rank(a[0]) - rank(b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
  }
  /** what a reference is called in a list: its description, else its file name */
  function label(r) { return clean(r && r.desc) || String((r && r.name) || "reference"); }

  /* ---------------- the box under a reference */
  function descBox(value, onInput, placeholder) {
    var el = document.createElement("input");
    el.type = "text"; el.className = "refdesc"; el.maxLength = MAX; el.value = clean(value);
    el.placeholder = placeholder || "describe it (optional)";
    el.title = "A short description - it goes into the mapping lines, the prompt chat / ✨ Enhance, the house builder and the image editor (kept with the project)";
    el.setAttribute("aria-label", "Reference description");
    el.addEventListener("keydown", function (e) { e.stopPropagation(); });
    el.addEventListener("click", function (e) { e.stopPropagation(); });
    el.addEventListener("dragstart", function (e) { e.preventDefault(); e.stopPropagation(); });
    el.addEventListener("input", function () { if (onInput) onInput(clean(el.value)); });
    return el;
  }
  function css() {
    if (typeof document === "undefined" || document.getElementById("refinfoCss")) return;
    var s = document.createElement("style"); s.id = "refinfoCss";
    s.textContent = ".refdesc{width:100%;box-sizing:border-box;font-size:.66rem;padding:2px 4px;margin-top:2px;background:var(--panel-2,#26221b);color:var(--text,#e8e2d6);border:1px solid var(--line,#3a342a);border-radius:4px}"
      + ".aitem .refdesc{margin:2px 0 0}.refdesc::placeholder{color:var(--dim,#9a917f)}";
    (document.head || document.documentElement).appendChild(s);
  }
  var api = { HOUSE: HOUSE, MAX: MAX, clean: clean, mapLine: mapLine, notesFor: notesFor, notesIn: notesIn, houseFirst: houseFirst, label: label, descBox: descBox };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.RefInfo = api;
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", css); else css(); }
})(typeof window !== "undefined" ? window : globalThis);
