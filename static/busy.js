/* bitGen Studio — static/busy.js (2.596.0): A BUTTON SHOWS WHAT IT IS DOING while it does it (window.H3Busy).
 *
 * Tim (verbatim): "when updating, loading saving, onlclick show the action is being done".
 *   run(btn, opts, fn)   the click's work: the button turns into "⏳ <doing>…" (spinning, disabled, aria-busy - a second
 *                        click does nothing), the status line (opts.status) says it with the seconds counting; fn(say)
 *                        may call say("loading Qwen3.8 27B") to change the words. Done = "✓ <done>" for a moment, then the
 *                        button comes back; an error = "✗ <message>" on the status line. -> fn's result (or throws)
 *   wrap(btn, opts)      the button's own onclick (set by index.html) run through run() - opts as above
 *   isBusy(btn)
 * opts = {doing: "Saving", done: "Saved", status: element | id, hold: ms (1400)}. Pure (Node): label(doing, s). */
(function (root) {
  "use strict";
  function label(doing, s) { return String(doing || "Working") + "…" + (s >= 2 ? " " + s + " s" : ""); }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { label: label }; return; }

  function css() {
    if (document.getElementById("h3busyCss")) return;
    var st = document.createElement("style"); st.id = "h3busyCss";
    st.textContent = ".h3busy{opacity:.85;cursor:progress!important}.h3spin{display:inline-block;width:.8em;height:.8em;border:2px solid currentColor;border-right-color:transparent;"
      + "border-radius:50%;vertical-align:-1px;margin-right:5px;animation:h3spin .8s linear infinite}@keyframes h3spin{to{transform:rotate(360deg)}}"
      + ".h3ok{color:var(--ok,#4c4)!important}.h3bad{color:var(--bad,#e55)!important}";
    document.head.appendChild(st);
  }
  var el = function (x) { return typeof x === "string" ? document.getElementById(x) : x || null; };
  function isBusy(btn) { return !!(btn && btn.dataset.h3busy === "1"); }
  function run(btn, opts, fn) {
    var o = opts || {};
    if (!btn || isBusy(btn)) return Promise.resolve(null);
    css();
    var keep = btn.innerHTML, words = o.doing || "Working", t0 = Date.now(), st = el(o.status), stKeep = st ? st.textContent : "";
    btn.dataset.h3busy = "1"; btn.disabled = true; btn.classList.add("h3busy"); btn.setAttribute("aria-busy", "true");
    var paint = function () {
      var s = Math.floor((Date.now() - t0) / 1000);
      btn.innerHTML = '<span class="h3spin"></span>' + label(words, s).replace(/[<&]/g, "");
      if (st) { st.classList.remove("h3ok", "h3bad"); st.textContent = "⏳ " + label(words, s); }
    };
    paint();
    var tick = setInterval(paint, 1000);
    var say = function (w) { if (w) { words = String(w); paint(); } };
    var back = function (cls, txt, ms) {
      clearInterval(tick);
      btn.innerHTML = txt; btn.classList.remove("h3busy"); btn.classList.add(cls);
      setTimeout(function () { btn.innerHTML = keep; btn.classList.remove(cls); btn.disabled = false; btn.removeAttribute("aria-busy"); delete btn.dataset.h3busy; }, ms);
    };
    return Promise.resolve().then(function () { return fn(say); }).then(function (r) {
      var s = Math.round((Date.now() - t0) / 1000);
      back("h3ok", "✓ " + (o.done || "Done"), o.hold || 1400);
      if (st && st.textContent.indexOf("⏳") === 0) { st.classList.add("h3ok"); st.textContent = "✓ " + (o.done || "Done") + (s >= 2 ? " (" + s + " s)" : ""); setTimeout(function () { st.classList.remove("h3ok"); if (o.restoreStatus) st.textContent = stKeep; }, 2500); }
      return r;
    }, function (e) {
      back("h3bad", "✗ " + (o.failed || "Failed"), 1800);
      if (st) { st.classList.add("h3bad"); st.textContent = "✗ " + ((e && e.message) || e); }
      throw e;
    });
  }
  function wrap(btn, opts) {
    var b = el(btn);
    if (!b || b.dataset.h3wrap) return false;
    var orig = b.onclick;
    if (typeof orig !== "function") return false;
    b.dataset.h3wrap = "1";
    b.onclick = function (ev) { var self = this; return run(b, opts, function () { return orig.call(self, ev); }).catch(function () { /* shown */ }); };
    return true;
  }
  root.H3Busy = { run: run, wrap: wrap, isBusy: isBusy, label: label };
})(typeof window !== "undefined" ? window : globalThis);
