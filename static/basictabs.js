/* bitGen Studio — static/basictabs.js (2.742.0): EVERY BASIC SETTINGS TAB KEEPS ITS OWN SETTINGS (window.H3BasicTabs).
 *
 * Tim (verbatim): "when the tab is changed save the settings of the tab before it is changed and revert when tab is
 * changed back" - "i mean the basic settings docker".
 *
 *   THE MODE TABS (Ref / F/L / Text / Swap - .modes button[data-mode])  before a tab is left, its settings are saved
 *          (FIELDS below, in the order they are put back); when a tab is opened that was saved before, its own settings
 *          come back - with the same events a hand edit fires, so the labels, the plan line, Format's aspect and the
 *          remembered values all follow. A tab never opened before keeps what is showing (and is saved when it is left).
 *          Kept in this browser (localStorage h3.basicTabs) so they last across restarts.
 *          ONLY A CLICK BY THE USER switches them: a project being opened or a mode picked by the app (pictures added,
 *          a screenplay) leaves the settings showing as they are - a project's own settings are never overwritten -
 *          and those settings still belong to the tab the user last opened (saved under it, not under the app's pick).
 *   STANDARD / CHARACTER CHAIN (#bsTabStd / #bsTabChain)  opening Character chain used to fill its boxes from the saved
 *          chain settings again, throwing away what was typed and not yet saved; now what was typed comes back (until
 *          💾 Save chain settings saves it - then the saved ones are what shows).
 *   modes() -> {mode: {field: value}}   snapshot() -> the mode tab's settings now   forget() -> clear them all */
(function (root) {
  "use strict";
  var doc = root.document;
  var KEY = "h3.basicTabs";
  // the order they are put back in: Format first (a social Format sets the aspect), then the size, the rest after
  var FIELDS = ["format", "resSel", "arSel", "width", "height", "seconds", "segSec", "steps", "cfg", "seed", "vidModel", "swapStart", "swapDur"];
  var CHAIN = ["ch_steps", "ch_length", "ch_mode", "ch_ctx", "ch_actx", "ch_blend", "ch_srcref", "ch_gencont"];
  function $(id) { return doc.getElementById(id); }
  function load() { try { var j = JSON.parse(root.localStorage.getItem(KEY) || "{}"); return j && typeof j === "object" && j.modes ? j : { modes: {} }; } catch (e) { return { modes: {} }; } }
  function save(j) { try { root.localStorage.setItem(KEY, JSON.stringify(j)); } catch (e) { /* private window - kept for this visit only */ } }
  var state = load();
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }
  function activeMode() { var b = doc.querySelector(".modes button.active"); return b ? b.dataset.mode : ""; }
  // whose settings are showing: the tab the user last opened (a mode the APP picks shows the same settings, so they
  // still belong to that tab - saved under it when the user next changes tab, never under the app's pick)
  var owner = "", prevActive = "";   // owner "" until the first click by hand: at load the settings showing are the project's
  function snapshot() {
    var o = {};
    FIELDS.forEach(function (id) { var el = $(id); if (el) o[id] = el.value; });
    return o;
  }
  function fire(el, kind) { el.dispatchEvent(new Event(kind, { bubbles: true })); }
  function put(o) {
    var custom = o.resSel === "custom";
    FIELDS.forEach(function (id) {
      var el = $(id);
      if (!el || !(id in o) || o[id] == null) return;
      if ((id === "width" || id === "height") && !custom) return;      // a preset size works them out itself
      if (el.tagName === "SELECT" && !Array.prototype.some.call(el.options, function (x) { return x.value === o[id]; })) return;
      if (el.value === o[id] && id !== "resSel") return;
      el.value = o[id];
      if (el.tagName === "SELECT") fire(el, "change");
      else { fire(el, "input"); fire(el, "change"); }
    });
  }
  // capture: runs BEFORE the tab's own click - the tab being left is still the active one
  function leaving(e) {
    var b = e.target && e.target.closest ? e.target.closest(".modes button[data-mode]") : null;
    if (!b || !e.isTrusted) return;
    prevActive = activeMode();
    var from = owner || prevActive;
    if (!from || (from === b.dataset.mode && from === activeMode())) return;
    state.modes[from] = snapshot(); save(state);
    test("basictab_saved", from);
  }
  // bubble: runs AFTER it - the tab now open gets its own settings back
  function opened(e) {
    var b = e.target && e.target.closest ? e.target.closest(".modes button[data-mode]") : null;
    if (!b || !e.isTrusted) return;
    var to = b.dataset.mode, o = state.modes[to];
    owner = to;
    if (!o || prevActive === to) return;                 // the tab already open, clicked again: nothing changes
    put(o);
    test("basictab_restored", to);
  }
  // Standard / Character chain: what was typed and not saved
  var chainTyped = null;
  function chainShowing() { var c = $("chset"); return !!c && !c.classList.contains("hidden"); }
  function boot() {
    var strip = doc.querySelector(".modes");
    if (strip && !strip.dataset.h3bt) {
      strip.dataset.h3bt = "1";
      strip.addEventListener("click", leaving, true);
      strip.addEventListener("click", opened, false);
    }
    var std = $("bsTabStd"), ch = $("bsTabChain"), sv = $("chCfgSave");
    if (std && !std.dataset.h3bt) {
      std.dataset.h3bt = "1";
      std.addEventListener("click", function () {
        if (!chainShowing()) return;
        chainTyped = {}; CHAIN.forEach(function (id) { var el = $(id); if (el) chainTyped[id] = el.value; });
      }, true);
    }
    if (ch && !ch.dataset.h3bt) {
      ch.dataset.h3bt = "1";
      ch.addEventListener("click", function () {     // after its own click painted the saved ones
        if (!chainTyped) return;
        CHAIN.forEach(function (id) { var el = $(id); if (el && id in chainTyped) el.value = chainTyped[id]; });
        test("basictab_chain_restored", 1);
      });
    }
    if (sv && !sv.dataset.h3bt) { sv.dataset.h3bt = "1"; sv.addEventListener("click", function () { chainTyped = null; }); }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3BasicTabs = {
    modes: function () { return JSON.parse(JSON.stringify(state.modes)); },
    snapshot: snapshot,
    forget: function () { state = { modes: {} }; save(state); chainTyped = null; },
    owner: function () { return owner; },
    FIELDS: FIELDS,
  };
})(typeof window !== "undefined" ? window : globalThis);
