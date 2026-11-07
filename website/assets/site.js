/* tigerart.com.au — the bitGen Studio site: the small menu on phones, the intro film (played once, never for anyone
 * who asked for less motion), the features filter. */
(function () {
  "use strict";
  var btn = document.querySelector(".menu"), nav = document.getElementById("nav");
  if (btn && nav) btn.addEventListener("click", function () { var on = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", on ? "true" : "false"); });

  var v = document.querySelector(".hero video");
  if (v) {
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { v.removeAttribute("autoplay"); v.pause(); }
    else { var p = v.play(); if (p && p.catch) p.catch(function () { /* the poster stays */ }); }
    // the film fades to black after 9.3 s: stop on the finished drawing instead (a pause, never a seek - a seek needs
    // the server to answer byte ranges)
    v.addEventListener("timeupdate", function () { if (v.currentTime >= 8.7) v.pause(); });
  }

  var f = document.getElementById("featFilter");
  if (f) {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".feat")), count = document.getElementById("featCount"), none = document.getElementById("featNone");
    var total = rows.length;
    var run = function () {
      var q = f.value.trim().toLowerCase(), n = 0;
      rows.forEach(function (r) { var hit = !q || r.textContent.toLowerCase().indexOf(q) >= 0; r.hidden = !hit; if (hit) n++; });
      document.querySelectorAll(".grp").forEach(function (g) { g.hidden = !g.querySelector(".feat:not([hidden])"); });
      document.querySelectorAll(".sec").forEach(function (s) { s.hidden = !s.querySelector(".grp:not([hidden])"); });
      if (count) count.textContent = q ? n + " of " + total + " features" : total + " features";
      if (none) none.hidden = n > 0;
    };
    f.addEventListener("input", run);
    if (location.hash.indexOf("#q=") === 0) { f.value = decodeURIComponent(location.hash.slice(3)); run(); }
  }
})();
