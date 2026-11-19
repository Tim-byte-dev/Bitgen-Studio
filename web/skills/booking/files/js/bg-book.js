/* bitGen web skill: 📅 booking widget - [data-bg-book data-calendar="<slug>"]. Talks to book.php (the CRM's booking calendar).
 * Everything the visitor sees is put in with textContent (no HTML from the server). */
(function () {
  "use strict";
  var el = function (tag, attrs, text) { var e = document.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  var ymd = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function api(q, body) {
    return fetch("book.php" + q, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().catch(function () { return { ok: false, message: "The booking service did not answer." }; }); });
  }
  function mount(box) {
    var cal = box.getAttribute("data-calendar") || "bookings", q = "?cal=" + encodeURIComponent(cal);
    box.classList.add("bg-book"); box.textContent = "";
    var svc = el("select", { "aria-label": "Service" }), day = el("input", { type: "date", "aria-label": "Day" }), times = el("div", { "class": "bg-book-times", role: "group", "aria-label": "Free times" });
    var form = el("form", { "class": "bg-book-form", hidden: "" }), msg = el("div", { "class": "bg-book-msg", role: "status" });
    var lab = function (t, c) { var l = el("label"); l.appendChild(el("span", null, t)); l.appendChild(c); return l; };
    var svcL = lab("Service", svc); box.appendChild(svcL); box.appendChild(lab("Day", day)); box.appendChild(times); box.appendChild(form); box.appendChild(msg);
    var name = el("input", { name: "name", required: "", maxlength: "120", autocomplete: "name" }), email = el("input", { name: "email", type: "email", required: "", maxlength: "200", autocomplete: "email" });
    var phone = el("input", { name: "phone", maxlength: "40", autocomplete: "tel" }), notes = el("textarea", { name: "notes", rows: "3", maxlength: "2000" }), hp = el("input", { name: "website", tabindex: "-1", autocomplete: "off" });
    var row = el("div", { "class": "bg-book-row" }); row.appendChild(lab("Your name", name)); row.appendChild(lab("Email", email)); form.appendChild(row);
    var pl = lab("Phone", phone), nl = lab("Anything we should know?", notes); form.appendChild(pl); form.appendChild(nl);
    var hpw = el("div", { "class": "bg-hp", "aria-hidden": "true" }); hpw.appendChild(hp); form.appendChild(hpw);
    var go = el("button", { type: "submit", "class": "bg-btn" }, "Book"); form.appendChild(go);
    var picked = null;
    var say = function (t, kind) { msg.textContent = t || ""; msg.className = "bg-book-msg" + (kind ? " " + kind : ""); };
    function load(keep) {
      picked = null; form.hidden = true; times.textContent = ""; if (!day.value) return;
      api(q + "&day=" + encodeURIComponent(day.value) + "&service=" + encodeURIComponent(svc.value || "0")).then(function (r) {
        times.textContent = "";
        if (!r.ok) { if (!keep) say(r.message || "No times for that day.", "bad"); return; }
        var free = (r.times || []).filter(function (t) { return t.free; });
        if (!free.length) { if (!keep) say(r.closed ? "We are closed that day." : "No free times that day - try another.", ""); return; }
        if (!keep) say("");
        (r.times || []).forEach(function (t) {
          var b = el("button", { type: "button", "aria-pressed": "false" }, t.time); if (!t.free) b.disabled = true;
          b.addEventListener("click", function () { [].forEach.call(times.children, function (x) { x.setAttribute("aria-pressed", "false"); }); b.setAttribute("aria-pressed", "true"); picked = t.time; form.hidden = false; name.focus(); });
          times.appendChild(b);
        });
      });
    }
    api(q + "&info=1").then(function (r) {
      if (!r.ok) { say(r.message || "Booking is not open yet.", "bad"); return; }
      (r.services && r.services.length ? r.services : [{ name: "Appointment", minutes: r.slot }]).forEach(function (s, i) {
        svc.appendChild(el("option", { value: String(i) }, s.name + " (" + s.minutes + " min" + (s.price ? ", " + s.price : "") + ")"));
      });
      if (!r.services || r.services.length < 2) svcL.hidden = true;
      if (!r.askPhone) pl.hidden = true; if (!r.askNotes) nl.hidden = true;
      var t = new Date(), last = new Date(); last.setDate(t.getDate() + (r.ahead || 60));
      day.min = ymd(t); day.max = ymd(last); day.value = ymd(t); load();
    });
    svc.addEventListener("change", function () { load(); }); day.addEventListener("change", function () { load(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); if (!picked) return;
      go.disabled = true; say("Booking…");
      api(q, { day: day.value, time: picked, service: +(svc.value || 0), name: name.value, email: email.value, phone: phone.value, notes: notes.value, website: hp.value }).then(function (r) {
        go.disabled = false;
        if (!r.ok) { say(r.message || "That could not be booked.", "bad"); load(true); return; }
        form.reset(); form.hidden = true; say(r.message, "ok"); load(true);
      });
    });
  }
  function start() { [].forEach.call(document.querySelectorAll("[data-bg-book]"), mount); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
