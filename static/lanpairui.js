/* bitGen Studio — static/lanpairui.js (2.913.0): 📶 THE APP CONNECTS OVER THE WI-FI (no QR, no link) + ☁ 6 HOURS AWAY.
 * (H3LanPairUi; the server side is lib/lanPair.js, lib/relayLink.js, routes/lanPair.js.)
 *
 * Tim (verbatim): "if my phone is on the same wifi connection as the desktop, add a button to connect from bitgen studio in
 * app. i am having trouble scanning the qr code and copying the link ... send the link to the phone and connect
 * automaticlly when i start the app. this link will auto connect when on wifi and stay connected for 6 hours if wifi
 * connection is lost but phone has internet connection elsewhere" -> the relay: "Relay via tigerart.com.au".
 *   Settings ▸ General ▸ Remote: 📱 Let the app connect (5 minutes - the next app that asks is let in), ☁ Away from the
 *   Wi-Fi (the relay, on by default) and how it is doing.
 *   Anywhere in the studio: a bar when a phone asks - "📱 <phone> (192.168.1.23) wants to connect" ✔ Allow / ✕ Deny.
 * Pure (Node): relayLine(status), leftWords(ms). */
(function (root) {
  "use strict";
  function leftWords(ms) {
    var m = Math.max(0, Math.round((+ms || 0) / 60000)), h = Math.floor(m / 60);
    return h ? h + " h " + (m % 60) + " min" : m + " min";
  }
  function relayLine(st) {
    var s = st || {};
    if (!s.on) return "";
    if (!s.app) return "☁ On - ready once the app has connected on this Wi-Fi.";
    if (s.app_home) return "☁ On - the app is on this Wi-Fi now.";
    if (s.away_left > 0) return "☁ The app can reach this PC through the relay for " + leftWords(s.away_left) + " more" + (s.last_error ? " - the relay: " + s.last_error : s.polling ? " (connected to the relay)" : "") + ".";
    return "☁ The app has been away from this Wi-Fi for more than 6 hours - it connects again at home.";
  }
  var API = { relayLine: relayLine, leftWords: leftWords };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = API; return; }

  var doc = root.document, timer = null, last = null, shown = "";
  function $(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ev(name, v) { try { if (root.H3TestEvent) root.H3TestEvent(name, v); } catch (e) { /* the 🧪 list */ } }
  var HTML = '<label class="f" style="margin-top:14px">📶 The bitGen app on this Wi-Fi</label>'
    + '<p class="hint help" style="margin:2px 0 6px">No QR and no link: the app finds this PC on your Wi-Fi by itself and asks to connect. Press Let the app connect, then open the app (or tap Find my PC on Wi-Fi in it) - or just open the app and press Allow on the bar that appears here.</p>'
    + '<div class="scale" style="gap:8px;flex-wrap:wrap">'
    + '<button class="ghost" id="lp_window" type="button" title="For 5 minutes the next bitGen app that asks on this Wi-Fi is let in without asking you">📱 Let the app connect</button>'
    + '</div>'
    + '<div id="lp_state" class="hint" style="margin:4px 0"></div>'
    + '<div id="lp_relayline" class="hint" style="margin:4px 0"></div>'
    + '<p class="hint help" style="margin:2px 0 6px">Away from home (Remote access ▾ with a relay or Cloudflare) the app reaches this PC for 6 hours after it was last on this Wi-Fi. Through a relay everything is sealed with a key only the app and this PC have - the relay cannot read it; pictures and videos come in parts, so they are slower than at home.</p>';
  var BAR = '<span id="lp_bartext"></span> <button class="ghost" id="lp_allow" type="button">✔ Allow</button> <button class="ghost" id="lp_deny" type="button">✕ Deny</button>';

  function paint(j) {
    last = j || {};
    var st = $("lp_state"), w = $("lp_window");
    if (st) st.textContent = j.window_open ? "📱 Waiting for the app - open it on the phone (" + Math.ceil(j.window_left / 60) + " min left)." : (j.remote && j.remote.connected && j.remote.app ? "📱 Connected: " + (j.remote.device || "the bitGen app") : "");
    if (w) { w.textContent = j.window_open ? "■ Stop waiting" : "📱 Let the app connect"; w.dataset.on = j.window_open ? "1" : ""; }
    var rl = $("lp_relayline");
    if (rl) rl.textContent = relayLine(j.relay);
    bar((j.pending || [])[0] || null);
  }
  function bar(p) {
    var b = $("lp_bar");
    if (!p) { if (b) b.hidden = true; shown = ""; return; }
    if (!b) {
      b = doc.createElement("div"); b.id = "lp_bar"; b.innerHTML = BAR;
      b.style.cssText = "position:fixed;top:44px;left:50%;transform:translateX(-50%);z-index:99999;background:var(--panel,#222);border:1px solid var(--accent,#f80);border-radius:10px;padding:8px 12px;box-shadow:0 6px 24px rgba(0,0,0,.45);display:flex;gap:8px;align-items:center";
      doc.body.appendChild(b);
      $("lp_allow").onclick = function () { answer(b.dataset.rid, true); };
      $("lp_deny").onclick = function () { answer(b.dataset.rid, false); };
    }
    b.hidden = false; b.dataset.rid = p.rid;
    $("lp_bartext").textContent = "📱 " + p.device + " (" + p.ip + ") wants to connect to bitGen Studio";
    if (shown !== p.rid) { shown = p.rid; ev("lanpair_ask", p.device); }
  }
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }
  function answer(rid, allow) {
    post("/api/remote/lanpair/answer", { rid: rid, allow: allow }).then(function (j) { ev("lanpair_answer", j.state); refresh(); }, function () { refresh(); });
  }
  function refresh() {
    clearTimeout(timer);
    return fetch("/api/remote/lanpair").then(function (r) { return r.json(); }).then(function (j) {
      paint(j);
      timer = setTimeout(refresh, j.remote && j.remote.enabled ? (j.window_open || (j.pending || []).length ? 1500 : 3000) : 15000);
    }).catch(function () { timer = setTimeout(refresh, 15000); });
  }
  function wire() {
    $("lp_window").onclick = function () {
      var on = !$("lp_window").dataset.on;
      post("/api/remote/lanpair/window", { on: on }).then(function () { ev("lanpair_window", on ? "open" : "closed"); refresh(); },
        function (e) { $("lp_state").textContent = "✗ " + e.message; });
    };
  }
  function boot() {
    var after = $("s_remote_alts");
    if (!after || !doc.body) { setTimeout(boot, 800); return; }
    if ($("lp_box")) return;
    var box = doc.createElement("div"); box.id = "lp_box"; box.innerHTML = HTML;
    after.parentNode.insertBefore(box, after.nextSibling);
    wire(); refresh();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3LanPairUi = Object.assign(API, { refresh: refresh, paint: paint });
})(typeof window !== "undefined" ? window : globalThis);
