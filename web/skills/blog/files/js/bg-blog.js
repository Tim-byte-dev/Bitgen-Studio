/* bitGen web skill: 📰 blog and news - data/content.json's posts. [data-bg-blog data-per] = the list / one post (?p=<slug>, ?page=n);
 * [data-bg-blog-latest data-n data-href] = the latest few. Everything is put in with textContent / DOM nodes (no HTML from the data). */
(function () {
  "use strict";
  var el = function (tag, attrs, text) { var e = document.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  var slugOf = function (p) { return String(p.slug || p.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || String(p.id || ""); };
  var base = function () { var s = document.querySelector('script[src*="bg-blog.js"]'); return s ? s.getAttribute("src").replace(/js\/bg-blog\.js.*$/, "") : ""; };
  var safeUrl = function (u) { u = String(u || ""); return /^(https?:\/\/|\/|[\w.-]+\/)/i.test(u) && !/^\s*javascript:/i.test(u) ? u : ""; };
  var dateText = function (d) { var t = new Date(String(d || "") + "T12:00:00"); return isNaN(t) ? "" : t.toLocaleDateString(document.documentElement.lang || undefined, { year: "numeric", month: "long", day: "numeric" }); };
  var plain = function (s) { return String(s || "").replace(/\s+/g, " ").trim(); };
  var cut = function (s, n) { s = plain(s); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s; };
  function posts() {
    return fetch(base() + "data/content.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      return (j.posts || []).filter(function (p) { return p.published !== false && p.title; }).sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
    }).catch(function () { return []; });
  }
  function textInto(box, body) {   // a blank line = a new paragraph, a line break kept, web addresses as links
    String(body || "").split(/\n\s*\n/).forEach(function (para) {
      var p = el("p"); para.split("\n").forEach(function (line, i) {
        if (i) p.appendChild(el("br"));
        line.split(/(https?:\/\/[^\s<>"']+)/).forEach(function (part, k) { if (k % 2) { var a = el("a", { href: part, rel: "noopener", target: "_blank" }, part); p.appendChild(a); } else if (part) p.appendChild(document.createTextNode(part)); });
      });
      if (p.textContent.trim()) box.appendChild(p);
    });
  }
  function card(p, href) {
    var a = el("a", { "class": "bg-blog-card", href: href });
    var img = safeUrl(p.image); if (img) a.appendChild(el("img", { src: img, alt: "", loading: "lazy" }));
    var inn = el("div", { "class": "bg-blog-in" }); inn.appendChild(el("span", { "class": "bg-blog-date" }, dateText(p.date))); inn.appendChild(el("h3", null, p.title)); inn.appendChild(el("p", null, cut(p.body, 160)));
    a.appendChild(inn); return a;
  }
  function list(box, all) {
    var qs = new URLSearchParams(location.search), one = qs.get("p");
    box.textContent = "";
    if (one) {
      var p = all.filter(function (x) { return slugOf(x) === one; })[0];
      var art = el("article", { "class": "bg-blog-post" }); box.appendChild(art);
      art.appendChild(el("a", { "class": "bg-blog-back", href: location.pathname }, "← All news"));
      if (!p) { art.appendChild(el("p", null, "That post is not here any more.")); return; }
      document.title = p.title + " - " + document.title.replace(/^.* - /, "");
      art.appendChild(el("h2", null, p.title)); art.appendChild(el("div", { "class": "bg-blog-date" }, dateText(p.date)));
      var img = safeUrl(p.image); if (img) art.appendChild(el("img", { "class": "bg-blog-hero", src: img, alt: "" }));
      textInto(art, p.body); return;
    }
    if (!all.length) { box.appendChild(el("p", null, "No news yet.")); return; }
    var per = Math.max(1, parseInt(box.getAttribute("data-per"), 10) || 6), pages = Math.ceil(all.length / per), page = Math.min(pages, Math.max(1, parseInt(qs.get("page"), 10) || 1));
    var grid = el("div", { "class": "bg-blog-list" }); box.appendChild(grid);
    all.slice((page - 1) * per, page * per).forEach(function (p) { grid.appendChild(card(p, "?p=" + encodeURIComponent(slugOf(p)))); });
    if (pages > 1) { var nav = el("nav", { "class": "bg-blog-pages", "aria-label": "Pages" }); for (var i = 1; i <= pages; i++) nav.appendChild(i === page ? el("span", { "aria-current": "page" }, String(i)) : el("a", { href: "?page=" + i }, String(i))); box.appendChild(nav); }
  }
  function latest(box, all) {
    var n = Math.max(1, parseInt(box.getAttribute("data-n"), 10) || 3), href = box.getAttribute("data-href") || "blog.html";
    box.textContent = ""; var grid = el("div", { "class": "bg-blog-list" }); box.appendChild(grid);
    all.slice(0, n).forEach(function (p) { grid.appendChild(card(p, href + "?p=" + encodeURIComponent(slugOf(p)))); });
  }
  function start() {
    var L = document.querySelectorAll("[data-bg-blog]"), T = document.querySelectorAll("[data-bg-blog-latest]"); if (!L.length && !T.length) return;
    posts().then(function (all) { [].forEach.call(L, function (b) { list(b, all); }); [].forEach.call(T, function (b) { latest(b, all); }); });
  }
  window.BGBlog = { slugOf: slugOf, cut: cut };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
