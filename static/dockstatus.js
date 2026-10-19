/* bitGen Studio — the dock layout's rules (2.381.0), shared by the page (window.H3DockStatus) and the tests (require).
 *
 * Tim (verbatim): "add a pin button to the left of each docker. if pin is toggled, max-height is set at the current
 * height of the docker, if toggled again max-height = 0 so user can select any height they want for the docker until
 * the height is pinned ... when a docker is open resize other open dockers to their max height ... if other dockers
 * are open they will expand to their height or max-height (the lesser value)".
 *
 * The record itself is docker_status.json (lib/dockerStatus.js); the page's dock code (static/index.html: layoutState,
 * applyLayout, toggleCollapse, toggleMax, the splitters, reflowDocks) asks these few questions of it:
 *   shown(h, max)               what a dock shows: its height, or its 📌 max-height when that is less
 *   togglePin(entry, cur, side) 📌: unpinned -> max = the current size; pinned -> 0 (any size again). The new max back.
 *   clampDrag(v, lo, hi, max)   a splitter drag: the usual floor / ceiling, and never past a pinned max
 *   reflowOrder(ids, docks, keep)  who gives / takes the room when the column is re-fitted: the UNPINNED docks other
 *                               than the one just opened; failing that every unpinned one; failing that all of them
 *   pinTitle(entry, side)       the 📌 tooltip
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.H3DockStatus = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  function num(v) { var n = Math.round(Number(v)); return isFinite(n) ? n : 0; }
  function maxKey(side) { return side ? "max_width" : "max_height"; }
  function pinned(e, side) { return !!e && num(e[maxKey(side)]) > 0; }
  function shown(h, max) { h = num(h); max = num(max); return max > 0 ? Math.min(h, max) : h; }
  function togglePin(e, cur, side) {
    var k = maxKey(side);
    e[k] = num(e[k]) > 0 ? 0 : Math.max(1, num(cur));
    return e[k];
  }
  function clampDrag(v, lo, hi, max) {
    max = num(max);
    var top = max > 0 ? Math.min(hi, max) : hi;
    return Math.max(Math.min(lo, top), Math.min(top, num(v)));
  }
  function reflowOrder(ids, docks, keep) {
    docks = docks || {};
    var free = ids.filter(function (id) { return id !== keep && !pinned(docks[id]); });
    if (free.length) return free;
    free = ids.filter(function (id) { return !pinned(docks[id]); });
    return free.length ? free : ids.slice();
  }
  function pinTitle(e, side) {
    var m = num(e && e[maxKey(side)]);
    var what = side ? "width" : "height";
    return m > 0 ? "📌 Pinned: this dock's " + what + " goes no further than " + m + "px - click to unpin (any " + what + ")"
                 : "📌 Pin: the " + what + " it is now becomes its max-" + what;
  }
  return { pinned: pinned, shown: shown, togglePin: togglePin, clampDrag: clampDrag, reflowOrder: reflowOrder, pinTitle: pinTitle };
});
