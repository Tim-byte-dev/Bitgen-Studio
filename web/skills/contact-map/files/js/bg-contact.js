/* bitGen web skill: 📍 contact and map - [data-bg-map data-lat data-lon data-zoom data-label] = an OpenStreetMap map (no key; the
 * attribution shown), form[data-bg-contact] = sent to contact.php in the background (the CRM's ✉ Messages). */
(function () {
  "use strict";
  var el = function (tag, attrs, text) { var e = document.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  function bbox(lat, lon, z) { var dl = 360 / Math.pow(2, z) * 1.6, dt = dl * Math.max(0.2, Math.cos(lat * Math.PI / 180)) * 0.62; return [lon - dl, lat - dt, lon + dl, lat + dt].map(function (x) { return x.toFixed(6); }).join(","); }
  function map(box) {
    var lat = parseFloat(box.getAttribute("data-lat")), lon = parseFloat(box.getAttribute("data-lon")), z = Math.max(3, Math.min(19, parseInt(box.getAttribute("data-zoom"), 10) || 15));
    box.classList.add("bg-map"); box.textContent = "";
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { box.appendChild(el("p", { "class": "bg-map-foot" }, "Put the map's place in data-lat / data-lon.")); return; }
    var src = "https://www.openstreetmap.org/export/embed.html?bbox=" + bbox(lat, lon, z) + "&layer=mapnik&marker=" + lat.toFixed(6) + "," + lon.toFixed(6);
    box.appendChild(el("iframe", { src: src, title: box.getAttribute("data-label") || "Map", loading: "lazy", referrerpolicy: "no-referrer-when-downgrade" }));
    var foot = el("div", { "class": "bg-map-foot" });
    var credit = el("span"); credit.appendChild(document.createTextNode("© ")); credit.appendChild(el("a", { href: "https://www.openstreetmap.org/copyright", target: "_blank", rel: "noopener" }, "OpenStreetMap contributors")); foot.appendChild(credit);
    foot.appendChild(el("a", { href: "https://www.openstreetmap.org/?mlat=" + lat.toFixed(6) + "&mlon=" + lon.toFixed(6) + "#map=" + z + "/" + lat.toFixed(5) + "/" + lon.toFixed(5), target: "_blank", rel: "noopener" }, "Bigger map ↗"));
    box.appendChild(foot);
  }
  function form(f) {
    var msg = f.querySelector(".bg-contact-msg") || f.appendChild(el("div", { "class": "bg-contact-msg", role: "status" }));
    var url = f.getAttribute("action") || "contact.php";
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = f.querySelector('[type="submit"]'), data = {}; [].forEach.call(f.elements, function (x) { if (x.name) data[x.name] = x.value; });
      if (b) b.disabled = true; msg.className = "bg-contact-msg"; msg.textContent = "Sending…";
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return { ok: false, message: "The message could not be sent." }; }); })
        .then(function (r) { if (b) b.disabled = false; msg.className = "bg-contact-msg " + (r.ok ? "ok" : "bad"); msg.textContent = r.message || (r.ok ? "Thank you." : "The message could not be sent."); if (r.ok) f.reset(); });
    });
  }
  function start() { [].forEach.call(document.querySelectorAll("[data-bg-map]"), map); [].forEach.call(document.querySelectorAll("form[data-bg-contact]"), form); }
  window.BGContact = { bbox: bbox };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
