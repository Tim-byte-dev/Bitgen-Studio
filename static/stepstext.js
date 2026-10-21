/* bitGen Studio — static/stepstext.js (2.574.0): "STEP N OF TOTAL" EVERYWHERE A GENERATION SAYS IT IS RUNNING
 * (window.H3Steps).
 * Tim: "show step number of steps for all generations(image,music,video) in all places that show it".
 * A running job carries progress = {step, total, pct, elapsed, chunk} (lib/jobMeta.progress, from the worker's
 * "[comfy] step v/m" / tqdm / sd-cli bar lines). One wording for every docker, dialog and card:
 *   text(pr)                 "step 3 of 8" (a chunked render: "chunk 2/3 · step 3 of 8"); "loading the models" while
 *                            the sampler has not counted yet; "" without a progress
 *   tag(pr)                  " · step 3 of 8" (or "") - to put after a docker's own words
 *   watch(el, id, opts)      follows job `id` (GET /api/jobs/:id every 1.5 s) and writes el's words as
 *                            base + tag(progress) while it runs (base = opts.base, else el's words now; opts.attr =
 *                            "title" writes the tooltip instead); stops by itself when the job ends or el leaves
 *                            the page; -> stop()
 * Pure parts (text, tag) are require()-able for the unit test. */
(function (root) {
  "use strict";
  function text(pr) {
    if (!pr || typeof pr !== "object") return "";
    var ch = pr.chunk && pr.chunk.n > 1 ? "chunk " + pr.chunk.i + "/" + pr.chunk.n + " · " : "";
    if (pr.total > 0) return ch + "step " + Math.max(0, Math.min(+pr.step || 0, +pr.total)) + " of " + pr.total;
    return ch + "loading the models";
  }
  function tag(pr) { var t = text(pr); return t ? " · " + t : ""; }
  var WATCH = typeof WeakMap === "function" ? new WeakMap() : null;
  function watch(el, id, opts) {
    var o = opts || {}, attr = o.attr || "", stopped = false, timer = null;
    if (!el || !id || typeof fetch !== "function") return function () {};
    var prev = WATCH && WATCH.get(el); if (prev) prev();
    var base = o.base != null ? String(o.base) : String(attr ? (el.getAttribute(attr) || "") : (el.textContent || "")).replace(/ · (chunk \d+\/\d+ · )?(step \d+ of \d+|loading the models)$/, "");
    function put(s) { if (attr) el.setAttribute(attr, s); else if (el.textContent !== s) el.textContent = s; }
    function stop() { stopped = true; if (timer) clearTimeout(timer); if (WATCH && WATCH.get(el) === stop) WATCH.delete(el); }
    function tick() {
      if (stopped) return;
      if (!el.isConnected) { stop(); return; }
      fetch("/api/jobs/" + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (j) {
        if (stopped) return;
        if (j && j.status === "running") { put(base + tag(j.progress)); if (o.onTick) o.onTick(j); }
        if (j && j.status && j.status !== "running" && j.status !== "queued") { stop(); return; }
        timer = setTimeout(tick, o.every || 1500);
      }).catch(function () { if (!stopped) timer = setTimeout(tick, 3000); });
    }
    if (WATCH) WATCH.set(el, stop);
    timer = setTimeout(tick, o.first != null ? o.first : 600);
    return stop;
  }
  var API = { text: text, tag: tag, watch: watch };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (root) root.H3Steps = API;
})(typeof window !== "undefined" ? window : null);
