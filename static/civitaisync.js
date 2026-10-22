/* bitGen Studio — static/civitaisync.js (2.575.0): THE CIVITAI SYNC IN THE STATUS BAR (window.H3CivitaiSync).
 * Tim: "let me know in the status bar that civitai is still syncing and when it is finished".
 * The model manager's ⤓ Civitai info / 🔄 Sync run as a queue on the server (lib/modelInfo: GET /api/modelmgr/fetch ->
 * {running, done, total, found, nomatch, failed, current}). A chip after the ComfyUI one says so whatever is open:
 *   running    "🔄 Civitai 12/80" (the model it is on in the tooltip) - every 2 s
 *   finished   "✓ Civitai synced: 64 found · 14 no match · 2 failed" for 30 s (a click hides it), then gone
 *   idle       nothing (a look every 15 s, so a sync started elsewhere shows up)
 * A click while it runs opens the model manager. watch() - the model manager calls it when it starts one.
 * Pure: text(st) (scripts/test-modelmedia575.js). */
(function (root) {
  "use strict";
  /** the chip's words for a status (pure): {txt, tip, state: running | done | ""} */
  function text(st, was) {
    var s = st || {};
    // 2.576.0: a model not found by its name is read for its SHA-256 (exact) - "reading 45%"
    var hp = s.hashing && s.hashing.total > 0 ? Math.min(99, Math.floor(s.hashing.got / s.hashing.total * 100)) : null;
    if (s.running) return { state: "running", txt: "🔄 Civitai " + (s.done || 0) + "/" + (s.total || 0) + (hp != null ? " · reading " + hp + "%" : ""),
      tip: "Civitai sync is running - " + (s.done || 0) + " of " + (s.total || 0) + " models" + (s.current ? "\nnow: " + s.current : "")
        + (s.hashing ? "\nreading its SHA-256 to find it on Civitai by its content (" + hp + "%)" : "") + "\nclick: the model manager" };
    if (was && (s.total || 0) > 0) {
      var parts = [(s.found || 0) + " found", (s.nomatch || 0) + " no match"]; if (s.failed) parts.push(s.failed + " failed");
      return { state: "done", txt: "✓ Civitai synced: " + parts.join(" · "), tip: "The Civitai sync finished - " + (s.done || 0) + " of " + (s.total || 0) + " models\nclick: hide this" };
    }
    return { state: "", txt: "", tip: "" };
  }
  var S = { was: false, timer: null, hideT: null, last: null };
  function $(id) { return root.document.getElementById(id); }
  function chip() {
    var c = $("sbCivitai"); if (c) return c;
    var host = $("sbcomfy"); if (!host || !host.parentNode) return null;
    c = root.document.createElement("span"); c.id = "sbCivitai"; c.setAttribute("role", "status");
    c.style.cssText = "margin-left:10px;white-space:nowrap;cursor:pointer;display:none";
    host.parentNode.insertBefore(c, $("sbUpd") ? $("sbUpd").nextSibling : host.nextSibling);
    c.onclick = function () {
      if (c.dataset.state === "running") { var b = $("mmBtn"); if (b) b.click(); }
      else { c.style.display = "none"; clearTimeout(S.hideT); }
    };
    return c;
  }
  function paint(st) {
    var t = text(st, S.was), c = chip(); if (!c) return t;
    c.dataset.state = t.state;
    if (!t.state) { if (c.dataset.keep !== "1") c.style.display = "none"; return t; }
    c.textContent = t.txt; c.title = t.tip; c.style.display = "";
    c.style.color = t.state === "running" ? "var(--tiger,#f59e2c)" : "#7fd17f";
    if (t.state === "done") {
      c.dataset.keep = "1"; clearTimeout(S.hideT);
      S.hideT = setTimeout(function () { c.dataset.keep = ""; c.style.display = "none"; }, 30000);
      if (root.H3TestEvent) try { root.H3TestEvent("civitai_sync", "done"); } catch (e) { /* fine */ }
    } else c.dataset.keep = "";
    return t;
  }
  function poll() {
    clearTimeout(S.timer);
    return fetch("/api/modelmgr/fetch").then(function (r) { return r.json(); }).then(function (st) {
      S.last = st;
      if (st && st.running) { S.was = true; paint(st); S.timer = setTimeout(poll, 2000); return st; }
      if (S.was) { paint(st); S.was = false; }
      S.timer = setTimeout(poll, 15000);
      return st;
    }).catch(function () { S.timer = setTimeout(poll, 15000); return null; });
  }
  /** a sync just started (the model manager) - look now */
  function watch() { S.was = true; return poll(); }
  root.H3CivitaiSync = { text: text, poll: poll, watch: watch, state: S };
  if (typeof module !== "undefined" && module.exports) module.exports = { text: text };
  else if (root.document) { if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", function () { setTimeout(poll, 3000); }); else setTimeout(poll, 3000); }
})(typeof window !== "undefined" ? window : globalThis);
