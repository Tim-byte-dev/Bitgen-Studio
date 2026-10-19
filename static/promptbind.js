/* bitGen Studio — static/promptbind.js (2.419.0): ONE PROMPT DOCKER FOR EVERY TOOL (window.H3PromptBind).
 *
 * Tim: "use the prompt docker for all prompts - it would be nice to have just the 1 docker instead of prompt inputs
 * everywhere".
 *
 * The tools' own prompt boxes - the image editor's ✨ AI (#iePrompt), the timeline's ✨ Fill (#tlfPrompt), a path
 * layer's subject (#ppPrompt), ✨ AI scene (#tlbAiPrompt), the 3DREAL look (#tlbLook), the character creator
 * (#ccPrompt), an environment (#ecPrompt), a VR world (textarea[data-k=prompt]) - are HIDDEN the moment they appear and
 * follow the prompt docker (#prompt): what is typed there is what the tool sends. In the box's place a one-line chip
 * shows the text the tool will use ("✎ from the prompt docker: …"); a click opens / focuses the prompt docker. With the
 * prompt docker empty a tool keeps its own default (the chip says so). The boxes keep their ids and values, so every
 * tool's code is unchanged. Per-scene prompts, the scene editor, swap texts, lyrics, speech and captions are the
 * scene's / song's own text - not prompts of a tool - and stay where they are.
 *
 *   pure: SELECTORS, effective(own, docker) -> {text, from: "docker" | "own" | "none"}
 */
(function (root) {
  "use strict";
  var SELECTORS = ["#iePrompt", "#tlfPrompt", "#ppPrompt", "#tlbAiPrompt", "#tlbLook", "#ccPrompt", "#ecPrompt", "textarea[data-k=prompt]"];
  function effective(own, docker) {
    var d = String(docker == null ? "" : docker).trim(), o = String(own == null ? "" : own).trim();
    if (d) return { text: d, from: "docker" };
    if (o) return { text: o, from: "own" };
    return { text: "", from: "none" };
  }
  var pure = { SELECTORS: SELECTORS, effective: effective };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var $ = function (id) { return document.getElementById(id); };
  var bound = [];                                  // [{el, chip, own}]
  var CSS = ".pbchip{display:flex;align-items:center;gap:6px;min-width:0;padding:4px 8px;border:1px dashed var(--line,#3a342a);border-radius:6px;"
    + "font-size:.72rem;color:var(--dim,#9a917f);cursor:pointer;background:var(--panel-2,#26221b)}"
    + ".pbchip:hover{border-color:var(--tiger,#f59e2c);color:var(--text,#e8e2d6)}"
    + ".pbchip .pbk{flex:none;color:var(--tiger,#f59e2c)}.pbchip .pbt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".pbchip.own .pbk{color:var(--dim,#9a917f)}.pbchip.none .pbt{font-style:italic}"
    + ".pb-hidden{display:none!important}";
  function docker() { var p = $("prompt"); return p ? p.value : ""; }
  function openDocker() {
    try {
      var d = $("promptdock");
      if (d && d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("promptdock", "tP");
      else if (d && d.classList.contains("collapsed") && typeof toggleCollapse === "function") toggleCollapse("promptdock");
    } catch (e) { /* fine */ }
    var p = $("prompt"); if (p) { p.focus(); try { p.setSelectionRange(p.value.length, p.value.length); } catch (e) { /* fine */ } }
  }
  function paintOne(b) {
    if (b.last != null && b.el.value !== b.last) b.own = b.el.value;      // the tool wrote its own box: its new default
    var e = effective(b.own, docker());
    var v = e.from === "docker" ? e.text : b.own;
    if (b.el.value !== v) {
      b.el.value = v;
      // the tool keeps its own state from its box's events (a path's subject, the scene AI's request): tell it -
      // input now, change once the typing pauses
      try { b.el.dispatchEvent(new Event("input", { bubbles: true })); } catch (er) { /* fine */ }
      clearTimeout(b.chT); b.chT = setTimeout(function () { try { b.el.dispatchEvent(new Event("change", { bubbles: true })); } catch (er) { /* fine */ } }, 400);
    }
    b.last = b.el.value;
    b.chip.className = "pbchip " + e.from;
    b.chip.querySelector(".pbk").textContent = e.from === "docker" ? "✎ prompt docker:" : e.from === "own" ? "✎ (prompt docker empty) its default:" : "✎ prompt docker:";
    b.chip.querySelector(".pbt").textContent = e.text || "empty - type the prompt in the prompt docker (P)";
    b.chip.title = "This tool uses the prompt docker's text - click to edit it there\n\n" + (e.text || "");
  }
  function paint() { bound = bound.filter(function (b) { return b.el.isConnected; }); bound.forEach(paintOne); }
  function bind(el) {
    if (!el || el._pb || el.id === "prompt") return null;
    el._pb = true;
    var own = el.value || "";
    var chip = document.createElement("div"); chip.className = "pbchip"; chip.setAttribute("role", "button"); chip.tabIndex = 0;
    chip.dataset.for = el.id || el.getAttribute("data-k") || "";
    chip.innerHTML = '<span class="pbk"></span><span class="pbt"></span>';
    chip.onclick = openDocker;
    chip.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDocker(); } };
    el.classList.add("pb-hidden");
    el.parentNode.insertBefore(chip, el.nextSibling);
    // a <label for=id> (or a wrapping label holding nothing else) goes too
    if (el.id) { var lb = document.querySelector('label[for="' + el.id + '"]'); if (lb) lb.classList.add("pb-hidden"); }
    var b = { el: el, chip: chip, own: own };
    bound.push(b);
    paintOne(b);
    return b;
  }
  function scan(rootEl) {
    var r = rootEl && rootEl.querySelectorAll ? rootEl : document;
    SELECTORS.forEach(function (s) { Array.prototype.forEach.call(r.querySelectorAll(s), bind); if (r.matches && r.matches(s)) bind(r); });
  }
  function start() {
    if (!$("prompt")) { setTimeout(start, 150); return; }
    if (!$("pbCss")) { var st = document.createElement("style"); st.id = "pbCss"; st.textContent = CSS; document.head.appendChild(st); }
    scan(document);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) { var n = ms[i].addedNodes[j]; if (n.nodeType === 1) scan(n); }
    }).observe(document.body, { childList: true, subtree: true });
    var p = $("prompt");
    p.addEventListener("input", paint);
    // a script that sets #prompt.value (the chat's ⬇ To prompt, a project load) fires no input event - look again
    setInterval(function () { var v = docker(); if (v !== start.last) { start.last = v; paint(); } }, 400);
  }
  root.H3PromptBind = { pure: pure, bind: bind, scan: scan, paint: paint, open: openDocker, bound: function () { return bound.slice(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
