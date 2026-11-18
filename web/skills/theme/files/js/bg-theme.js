/* bitGen web skill: 🎨 theme - [data-bg-theme-toggle] switches light / dark, remembered in this browser */
(function () {
  var KEY = "bg-theme", root = document.documentElement;
  try { var t = localStorage.getItem(KEY); if (t) root.setAttribute("data-bg-theme", t); } catch (e) {}
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-bg-theme-toggle]"); if (!b) return;
    var dark = root.getAttribute("data-bg-theme") === "dark" || (!root.getAttribute("data-bg-theme") && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark"; root.setAttribute("data-bg-theme", next);
    try { localStorage.setItem(KEY, next); } catch (e2) {}
  });
})();
