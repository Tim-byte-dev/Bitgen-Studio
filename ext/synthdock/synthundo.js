/* bitGen Studio — ext/synthdock/synthundo.js (2.957.0): 🎹 UNDO / REDO for the whole Synth tab (window.H3SynthUndo).
 * Tim: "go with your suggestion" (undo / redo across the Synth tab).
 * The tab's state (the timeline, the loop, the knobs, the pads) as snapshots: every change is committed once things go quiet
 * (`quietMs`), so a knob dragged or a clip moved is ONE step; ↶ puts the one before back, ↷ goes forward again; a new change
 * after an undo drops the steps ahead. 200 steps kept.
 *   create({get() -> state, set(state), quietMs, max, changed(canUndo, canRedo)}) -> {touch(), commit(), undo(), redo(),
 *   canUndo(), canRedo(), reset(), size()} - pure (no DOM; Node: scripts/test-957.js)
 */
(function (root) {
  "use strict";
  function create(o) {
    var max = o.max || 200, quiet = o.quietMs == null ? 400 : o.quietMs, past = [], future = [], cur = JSON.stringify(o.get()), timer = 0, busy = false;
    var tell = function () { if (o.changed) o.changed(past.length > 0, future.length > 0); };
    /** the state as it is now becomes a step (when it differs from the last) */
    function commit() {
      if (timer) { clearTimeout(timer); timer = 0; }
      if (busy) return false;
      var now = JSON.stringify(o.get());
      if (now === cur) return false;
      past.push(cur); if (past.length > max) past.shift();
      future = []; cur = now; tell(); return true;
    }
    /** something changed - commit once it goes quiet */
    function touch() { if (busy) return; if (timer) clearTimeout(timer); timer = quiet ? setTimeout(commit, quiet) : 0; if (!quiet) commit(); }
    function go(from, to) {
      commit();
      if (!from.length) return false;
      to.push(cur); cur = from.pop();
      busy = true; try { o.set(JSON.parse(cur)); } finally { busy = false; }
      tell(); return true;
    }
    return {
      touch: touch, commit: commit,
      undo: function () { return go(past, future); }, redo: function () { return go(future, past); },
      canUndo: function () { return past.length > 0 || (!!timer); }, canRedo: function () { return future.length > 0; },
      reset: function () { past = []; future = []; cur = JSON.stringify(o.get()); tell(); },
      size: function () { return { past: past.length, future: future.length }; },
      busy: function () { return busy; },
    };
  }
  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3SynthUndo = api;
})(typeof window !== "undefined" ? window : globalThis);
