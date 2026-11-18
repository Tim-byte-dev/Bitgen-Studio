/* bitGen web skill: ⚡ AJAX - BG.json(url) / BG.post(url, data); forms with data-bg-ajax are sent without leaving the page
   (the answer shown in [data-bg-result]); [data-bg-list="data/content.json#posts"] fills its <template> once per item ({{name}}). */
(function () {
  var cache = {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function json(url, fresh) { if (!fresh && cache[url]) return cache[url]; return (cache[url] = fetch(url, { headers: { Accept: "application/json" } }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })); }
  function post(url, data) {
    var body = data instanceof FormData ? data : JSON.stringify(data || {});
    return fetch(url, { method: "POST", body: body, headers: data instanceof FormData ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" } })
      .then(function (r) { return r.text().then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { j = { ok: r.ok, message: t.slice(0, 300) }; } if (!r.ok && j.ok === undefined) j.ok = false; return j; }); });
  }
  function fill(tpl, it) { return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (_, k) { var v = k.split(".").reduce(function (o, p) { return o == null ? o : o[p]; }, it); return esc(v); }); }
  function lists(root) {
    (root || document).querySelectorAll("[data-bg-list]").forEach(function (box) {
      var spec = box.getAttribute("data-bg-list").split("#"), t = box.querySelector("template"); if (!t) return;
      var limit = +box.getAttribute("data-bg-limit") || 0, tpl = t.innerHTML;
      json(spec[0]).then(function (d) {
        var list = spec[1] ? d[spec[1]] : d; list = (list || []).filter(function (x) { return x.published !== false; }); if (limit) list = list.slice(0, limit);
        Array.prototype.slice.call(box.children).forEach(function (c) { if (c !== t) c.remove(); });
        box.insertAdjacentHTML("beforeend", list.map(function (it) { return fill(tpl, it); }).join("") || '<p class="bg-dim">' + esc(box.getAttribute("data-bg-empty") || "Nothing here yet.") + "</p>");
      }).catch(function (e) { box.insertAdjacentHTML("beforeend", '<p class="bg-note err">' + esc(e.message) + "</p>"); });
    });
  }
  document.addEventListener("submit", function (e) {
    var f = e.target; if (!f.matches || !f.matches("form[data-bg-ajax]")) return;
    e.preventDefault();
    var out = f.querySelector("[data-bg-result]") || f.appendChild(Object.assign(document.createElement("div"), { className: "bg-note" })), btn = f.querySelector("[type=submit]");
    if (btn) btn.disabled = true; out.className = "bg-note"; out.textContent = "Sending…";
    post(f.getAttribute("action") || location.href, new FormData(f)).then(function (j) {
      out.className = "bg-note" + (j.ok === false ? " err" : ""); out.textContent = j.message || (j.ok === false ? "That did not work." : "Thank you!"); if (j.ok !== false) f.reset();
    }).catch(function (er) { out.className = "bg-note err"; out.textContent = er.message; }).then(function () { if (btn) btn.disabled = false; });
  });
  window.BG = Object.assign(window.BG || {}, { json: json, post: post, esc: esc, fill: fill, lists: lists });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { lists(); }); else lists();
})();
