/* bitGen Studio — static/locklayer.js (2.599.0): THE LOCK SCREEN - a full-window cover that says what the app is doing
 * and animates until it is done; nothing behind it can be clicked or typed into (window.H3Lock).
 *
 * Tim (verbatim): "when resetting a project put a lock screen at the front and say "Resetting Project..." but animate it
 * until the project resets".
 *   show(title, sub)     the cover: a spinning ring, the title with its dots running, the line under it (what is
 *                        happening now), the seconds; Tab / keys / clicks stop at it (role alertdialog, aria-busy)
 *   step(sub)            the line under the title
 *   hide(doneText)       "✓ <doneText>" for a moment, then it fades out
 *   carry(title, data)   a reload is coming: the next page shows the SAME cover at once (sessionStorage h3.lock) and
 *   resume()             takes it down only when the project is back - window.H3_PROJECT_READY and the first lists in
 *                        (at least 600 ms, at most 90 s - then it says so and lets go)
 * Loaded at the TOP of <body>, so a reload under way is covered before anything else paints.
 * Pure (Node): dots(n), secs(ms). */
(function (root) {
  "use strict";
  function dots(n) { return ".".repeat((Math.max(0, n | 0) % 3) + 1); }
  function secs(ms) { var s = Math.floor(Math.max(0, ms) / 1000); return s < 2 ? "" : s < 60 ? s + " s" : Math.floor(s / 60) + " min " + (s % 60) + " s"; }
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = { dots: dots, secs: secs }; return; }

  var KEY = "h3.lock", el = null, tick = null, t0 = 0, title = "", n = 0, keyBlock = null;
  var CSS = "#h3lock{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;"
    + "background:rgba(12,11,10,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:progress;opacity:1;transition:opacity .35s}"
    + "#h3lock.out{opacity:0}"
    + "#h3lock .box{display:flex;flex-direction:column;align-items:center;gap:14px;padding:30px 44px;border-radius:14px;"
    + "background:rgba(28,26,23,.92);border:1px solid rgba(245,158,44,.35);box-shadow:0 10px 50px rgba(0,0,0,.6);min-width:300px;color:#eee;font-family:inherit}"
    + "#h3lock .ring{width:64px;height:64px;border-radius:50%;border:5px solid rgba(245,158,44,.18);border-top-color:#f59e2c;border-right-color:#f59e2c;"
    + "animation:h3lockspin 1s linear infinite}"
    + "#h3lock.done .ring{animation:none;border-color:#4c4;display:flex;align-items:center;justify-content:center}"
    + "#h3lock .t{font-size:1.3rem;font-weight:600;letter-spacing:.02em;min-width:15ch;text-align:center;animation:h3lockpulse 1.6s ease-in-out infinite}"
    + "#h3lock .s{font-size:.82rem;opacity:.75;min-height:1.1em;text-align:center;max-width:46ch}"
    + "#h3lock .bar{width:240px;height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;position:relative}"
    + "#h3lock .bar i{position:absolute;top:0;bottom:0;width:40%;border-radius:2px;background:linear-gradient(90deg,transparent,#f59e2c,transparent);animation:h3lockbar 1.4s ease-in-out infinite}"
    + "#h3lock .c{font-size:.7rem;opacity:.5;font-family:var(--mono,monospace);min-height:1em}"
    + "@keyframes h3lockspin{to{transform:rotate(360deg)}}@keyframes h3lockpulse{50%{opacity:.6}}@keyframes h3lockbar{from{left:-40%}to{left:100%}}"
    + "@media (prefers-reduced-motion:reduce){#h3lock .ring{animation-duration:3s}#h3lock .t,#h3lock .bar i{animation:none}#h3lock .bar i{left:30%}}";

  function css() {
    if (document.getElementById("h3lockCss")) return;
    var s = document.createElement("style"); s.id = "h3lockCss"; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function paint() {
    if (!el) return;
    n++;
    var t = el.querySelector(".t"), c = el.querySelector(".c");
    if (t && !el.classList.contains("done")) t.textContent = title.replace(/\.*$/, "") + dots(n);
    if (c) c.textContent = secs(Date.now() - t0);
  }
  function show(ttl, sub) {
    css();
    title = String(ttl || "Working…");
    if (!el) {
      el = document.createElement("div"); el.id = "h3lock";
      el.setAttribute("role", "alertdialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-busy", "true"); el.setAttribute("aria-live", "polite");
      el.tabIndex = -1;
      el.innerHTML = '<div class="box"><div class="ring" aria-hidden="true"></div><div class="t"></div><div class="s"></div><div class="bar" aria-hidden="true"><i></i></div><div class="c"></div></div>';
      ["pointerdown", "mousedown", "click", "dblclick", "contextmenu", "wheel", "dragstart", "drop"].forEach(function (k) { el.addEventListener(k, function (e) { e.preventDefault(); e.stopPropagation(); }, true); });
      (document.body || document.documentElement).appendChild(el);
      keyBlock = function (e) { if (el) { e.preventDefault(); e.stopPropagation(); } };
      root.addEventListener("keydown", keyBlock, true);
      t0 = Date.now(); n = 0;
      tick = setInterval(paint, 450);
    }
    el.classList.remove("done", "out");
    el.setAttribute("aria-label", title);
    step(sub || "");
    paint();
    try { el.focus({ preventScroll: true }); } catch (e) { /* fine */ }
    return el;
  }
  function step(sub) { if (el) { var s = el.querySelector(".s"); if (s) s.textContent = String(sub || ""); } }
  function hide(doneText, ms) {
    try { sessionStorage.removeItem(KEY); } catch (e) { /* fine */ }
    if (!el) return Promise.resolve();
    var me = el;
    clearInterval(tick); tick = null;
    if (doneText) {
      me.classList.add("done");
      me.querySelector(".ring").textContent = "✓";
      me.querySelector(".t").textContent = doneText;
      me.setAttribute("aria-busy", "false");
    }
    return new Promise(function (res) {
      setTimeout(function () {
        me.classList.add("out");
        setTimeout(function () { if (me.parentNode) me.parentNode.removeChild(me); if (el === me) { el = null; if (keyBlock) root.removeEventListener("keydown", keyBlock, true); keyBlock = null; } res(); }, 380);
      }, doneText ? (ms || 900) : 0);
    });
  }
  function carry(ttl, data) { try { sessionStorage.setItem(KEY, JSON.stringify(Object.assign({ title: ttl, at: Date.now() }, data || {}))); } catch (e) { /* the cover only */ } }
  /** the page after a reload: the cover again at once, down when the project is back */
  function resume() {
    var c = null;
    try { c = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { c = null; }
    if (!c || !c.title || Date.now() - (c.at || 0) > 5 * 60000) { try { sessionStorage.removeItem(KEY); } catch (e) { /* fine */ } return false; }
    var go = function () {
      show(c.title, c.sub2 || "Opening the empty project");
      if (c.at) t0 = c.at;
      var start = Date.now();
      (function wait() {
        var ready = root.H3_PROJECT_READY === true && document.readyState === "complete";
        if (ready && Date.now() - start > 600) {
          step("Every docker is empty");
          hide(c.done || "Done");
          return;
        }
        if (Date.now() - start > 90000) { step("This is taking long - the app is yours again; see the console"); hide(); return; }
        setTimeout(wait, 150);
      })();
    };
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
    return true;
  }
  root.H3Lock = { show: show, step: step, hide: hide, carry: carry, resume: resume, isOn: function () { return !!el; }, dots: dots, secs: secs };
  resume();
})(typeof window !== "undefined" ? window : globalThis);
