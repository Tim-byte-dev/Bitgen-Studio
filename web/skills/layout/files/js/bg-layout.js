/* bitGen web skill: 📐 layout - ☰ opens / closes the menu on phones; the link of this page is marked .on */
(function () {
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".bg-menu-btn"); if (!b) return;
    var n = document.querySelector(b.getAttribute("data-target") || ".bg-nav"); if (n) { n.classList.toggle("open"); b.setAttribute("aria-expanded", n.classList.contains("open")); }
  });
  var here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".bg-nav a[href]").forEach(function (a) { if (a.getAttribute("href").split("?")[0] === here) a.classList.add("on"); });
})();
