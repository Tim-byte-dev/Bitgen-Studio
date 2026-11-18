/* bitGen web skill: 🖼 galleries - .bg-gallery > a[href] opens in the viewer: ← → keys, swipe, Esc; a[data-type="video"] plays.
   A gallery can also fill itself: <div class="bg-gallery" data-bg-json="data/gallery.json"> ([{src, thumb?, caption?, type?}]). */
(function () {
  var lb, items = [], at = 0;
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h) e.innerHTML = h; return e; }
  function build() {
    lb = el("div", "bg-lb"); lb.setAttribute("role", "dialog");
    lb.innerHTML = '<div class="bg-lb-body"></div><button class="bg-lb-x" aria-label="Close">✕</button><button class="bg-lb-prev" aria-label="Previous">‹</button><button class="bg-lb-next" aria-label="Next">›</button>';
    document.body.appendChild(lb);
    lb.querySelector(".bg-lb-x").onclick = close; lb.querySelector(".bg-lb-prev").onclick = function () { go(-1); }; lb.querySelector(".bg-lb-next").onclick = function () { go(1); };
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    var x0 = null; lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }); lb.addEventListener("touchend", function (e) { if (x0 == null) return; var d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); x0 = null; });
    document.addEventListener("keydown", function (e) { if (!lb.classList.contains("on")) return; if (e.key === "Escape") close(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); });
  }
  function show() {
    var it = items[at], b = lb.querySelector(".bg-lb-body"); b.innerHTML = "";
    var m = it.type === "video" ? el("video") : el("img"); m.src = it.src; if (it.type === "video") { m.controls = true; m.autoplay = true; } else m.alt = it.caption || "";
    b.appendChild(m); if (it.caption) { var c = el("div", "bg-lb-cap"); c.textContent = it.caption; b.appendChild(c); }
    lb.querySelector(".bg-lb-prev").style.display = lb.querySelector(".bg-lb-next").style.display = items.length > 1 ? "" : "none";
  }
  function go(d) { at = (at + d + items.length) % items.length; show(); }
  function close() { lb.classList.remove("on"); lb.querySelector(".bg-lb-body").innerHTML = ""; }
  function open(g, a) {
    if (!lb) build();
    items = Array.prototype.map.call(g.querySelectorAll(":scope > a[href]"), function (x) { return { src: x.getAttribute("href"), type: x.getAttribute("data-type") || (/\.(mp4|webm|mov)$/i.test(x.getAttribute("href")) ? "video" : "image"), caption: x.getAttribute("title") || (x.querySelector("img") || {}).alt || "" }; });
    at = Array.prototype.indexOf.call(g.querySelectorAll(":scope > a[href]"), a); show(); lb.classList.add("on");
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".bg-gallery > a[href]"); if (!a || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); open(a.parentNode, a);
  });
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  document.querySelectorAll(".bg-gallery[data-bg-json]").forEach(function (g) {
    fetch(g.getAttribute("data-bg-json")).then(function (r) { return r.json(); }).then(function (list) {
      g.innerHTML = (list || []).map(function (it) { var v = it.type === "video" || /\.(mp4|webm|mov)$/i.test(it.src); return '<a href="' + esc(it.src) + '"' + (v ? ' data-type="video"' : "") + ' title="' + esc(it.caption) + '"><img loading="lazy" src="' + esc(it.thumb || (v ? "" : it.src)) + '" alt="' + esc(it.caption) + '"></a>'; }).join("");
    }).catch(function () {});
  });
})();
