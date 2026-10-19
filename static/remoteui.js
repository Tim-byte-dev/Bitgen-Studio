/* bitGen Studio — Settings -> General -> Remote (phone).
   The QR and the link come from the server (lib/qrcode has no browser half),
   so this file only wires four controls and keeps the state line honest. */
(function () {
  function el(id) { return document.getElementById(id); }
  function fmt(st) {
    if (!st.enabled) return "Off. The studio only listens on this computer.";
    if (st.restart_required) return "On — but RESTART bitGen Studio to actually open "
      + "the network port. Until then the phone cannot reach it.";
    if (!st.lan) return "On, but this machine has no LAN address — nothing to connect to.";
    if (st.connected) {
      var mins = st.since ? Math.round((Date.now() - st.since) / 60000) : 0;
      return "Connected: " + (st.device || "a phone").slice(0, 60)
           + (mins ? " (" + mins + " min)" : "") + ". Only one phone at a time.";
    }
    return "On at " + st.lan + ":" + (st.port || 8311)
         + (st.pairing_open ? " — a pairing link is open." : " — no phone connected.");
  }
  function paint(st) {
    var s = el("s_remote_state"); if (s) s.textContent = fmt(st || {});
    var c = el("s_remote_on"); if (c) c.checked = !!(st && st.enabled);
  }
  function refresh() {
    return fetch("/api/remote/status").then(function (r) { return r.json(); })
      .then(paint).catch(function () {});
  }
  function init() {
    if (!el("s_remote_link")) return;             // settings pane not on this page
    refresh();
    el("s_remote_on").addEventListener("change", function (e) {
      fetch("/api/remote/enable", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: e.target.checked }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          paint(d);
          if (d.note) el("s_remote_state").textContent = d.note;
          el("s_remote_qr").style.display = "none";
          el("s_remote_url").textContent = "";
        });
    });
    el("s_remote_link").addEventListener("click", function () { makeLink(); });
    function makeLink(ip) {
      fetch("/api/remote/link", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: ip || "" }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) {
            el("s_remote_state").textContent = d.error;
            el("s_remote_qr").style.display = "none";
            el("s_remote_url").textContent = "";
            return;
          }
          var q = el("s_remote_qr");
          q.innerHTML = d.qr || "";
          q.style.display = d.qr ? "block" : "none";
          el("s_remote_url").textContent = d.url
            + (d.adapter ? "   (" + d.adapter + ")" : "");
          el("s_remote_state").textContent = d.note || "";
          // Several addresses is the normal case on Windows (WSL, Hyper-V, a
          // VPN). Only one of them is the network the phone is on, so offer the
          // others rather than making the user guess which QR failed and why.
          var box = el("s_remote_alts");
          box.innerHTML = "";
          (d.candidates || []).forEach(function (c) {
            if (c.ip === d.lan) return;
            var b = document.createElement("button");
            b.type = "button"; b.className = "ghost";
            b.style.marginRight = "6px";
            b.textContent = "try " + c.ip + (c.virtual ? " (virtual)" : "");
            b.addEventListener("click", function () { makeLink(c.ip); });
            box.appendChild(b);
          });
        });
    }
    el("s_remote_off").addEventListener("click", function () {
      fetch("/api/remote/revoke", { method: "POST" })
        .then(function (r) { return r.json(); })
        .then(function (st) {
          paint(st);
          el("s_remote_qr").style.display = "none";
          el("s_remote_url").textContent = "";
        });
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
  window.bgRemoteUI = { fmt: fmt, refresh: refresh };
})();
