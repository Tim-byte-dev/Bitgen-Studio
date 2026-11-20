/* bitGen Studio — static/safelayout.js (2.891.0): THE DOCKERS RESET, SAFELY - window.H3SafeLayout. First script in the head.
 *
 * Tim (verbatim): "bitgen crashed again until i reset the dockers and cache".
 *   ?safe-layout=1   (the desktop app opens it after two starts that did not come up, after Reset in its crash box, or from
 *                    Settings ▸ Dockers ▸ 🧯 Reset; in a browser it can be typed) - BEFORE anything reads it, this page's
 *                    whole browser storage is sent to the server (POST /api/layout/rescue - backups\layout-auto-<time>\
 *                    local-storage.json, the layout files moved there too), then cleared (the language kept), and the page
 *                    reloads clean; the reloaded page says where the backup is.
 *   booted           once the dockers are restored (dsReady) and the page has stood for a few seconds, the desktop app is told
 *                    (h3shell.booted) - a start that never gets here counts as one that did not come up (electron/recover.js)
 * Pure: keepKeys(storage) -> the keys kept through a reset (the language). */
(function (root) {
  "use strict";
  function keepKeys(st) { var o = {}; Object.keys(st || {}).forEach(function (k) { if (/lang/i.test(k)) o[k] = st[k]; }); return o; }
  if (typeof module !== "undefined" && module.exports) { module.exports = { keepKeys: keepKeys }; return; }
  var loc = root.location;
  if (/[?&]safe-layout=1(&|$)/.test(loc.search || "")) {
    var st = {};
    try { for (var i = 0; i < root.localStorage.length; i++) { var k = root.localStorage.key(i); st[k] = root.localStorage.getItem(k); } } catch (e) { /* none */ }
    var dir = "";
    try {
      var x = new XMLHttpRequest();
      x.open("POST", "/api/layout/rescue", false);           // before the page goes on: it must not read the old layout
      x.setRequestHeader("Content-Type", "application/json");
      x.send(JSON.stringify({ storage: st, files: true, why: "the dockers and the cache were reset (?safe-layout=1)" }));
      try { dir = JSON.parse(x.responseText || "{}").dir || ""; } catch (e) { dir = ""; }
    } catch (e) { /* the server will be asked again by hand */ }
    try {
      var keep = keepKeys(st);
      root.localStorage.clear();
      Object.keys(keep).forEach(function (k) { root.localStorage.setItem(k, keep[k]); });
      root.sessionStorage.clear();
      root.sessionStorage.setItem("h3.layoutReset", dir || "backups");
    } catch (e) { /* private mode */ }
    try { loc.replace(loc.pathname + "?layout-reset=" + Date.now()); } catch (e) { /* stay */ }   // (no window.stop() - it cancels this very navigation)
    root.H3SafeLayout = { keepKeys: keepKeys, resetting: true };
    return;
  }
  // the reloaded page: say where the old layout went
  var was = null; try { was = root.sessionStorage.getItem("h3.layoutReset"); root.sessionStorage.removeItem("h3.layoutReset"); } catch (e) { was = null; }
  if (/[?&]layout-reset=/.test(loc.search || "")) try { root.history.replaceState(null, "", loc.pathname); } catch (e) { /* fine */ }
  function after(fn, ms) { setTimeout(fn, ms); }
  if (was) {
    var tell = function (n) {
      if (typeof root.appNote === "function") root.appNote("The dockers and the cache were reset to the default. What was there is kept in " + was + " - copy the files back (with bitGen Studio closed) to undo.", "Dockers reset");
      else if (n < 30) after(function () { tell(n + 1); }, 1000);
    };
    after(function () { tell(0); }, 2500);
  }
  // booted: the dockers restored and the page standing
  var tries = 0;
  (function poll() {
    tries++;
    var ok = false; try { ok = typeof dsReady !== "undefined" && !!dsReady; } catch (e) { ok = false; }   // eslint-disable-line no-undef
    if (ok) { after(function () { try { if (root.h3shell && root.h3shell.booted) root.h3shell.booted(); } catch (e) { /* browser */ } }, 4000); return; }
    if (tries < 180) after(poll, 1000);
  })();
  root.H3SafeLayout = { keepKeys: keepKeys, resetting: false, reset: function () {
    if (root.h3shell && root.h3shell.resetLayout) return root.h3shell.resetLayout();
    loc.href = loc.pathname + "?safe-layout=1";
    return null;
  } };
})(typeof window !== "undefined" ? window : globalThis);
