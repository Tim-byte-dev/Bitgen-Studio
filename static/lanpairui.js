/* bitGen Studio — static/lanpairui.js (2.913.0): 📶 THE APP CONNECTS OVER THE WI-FI (no QR, no link) + ☁ 6 HOURS AWAY.
 * (H3LanPairUi; the server side is lib/lanPair.js, lib/relayLink.js, routes/lanPair.js.)
 *
 * Tim (verbatim): "if my phone is on the same wifi connection as the desktop, add a button to connect from bitgen studio in
 * app. i am having trouble scanning the qr code and copying the link ... send the link to the phone and connect
 * automaticlly when i start the app. this link will auto connect when on wifi and stay connected for 6 hours if wifi
 * connection is lost but phone has internet connection elsewhere" -> the relay: "Relay via tigerart.com.au".
 *   Settings ▸ General ▸ Remote: 2.914.1 the ONE button 📱 Connect the phone (5 minutes - the next app that asks is let in, + the QR),
 *   ✕ Disconnect the phone (a link), ☁ Away from the
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
  var HTML = '<p class="hint help" style="margin:2px 0 6px">📶 The bitGen app finds this PC on your Wi-Fi by itself: press Connect the phone and open the app - it connects with no QR and no link. When the app asks while nothing is waiting, a bar here says so - press Allow.</p>'
    + '<div id="lp_state" class="hint" style="margin:4px 0"></div>'
    + '<a href="#" id="lp_disc" class="hint" hidden title="Forget the paired phone here - it has to connect again">✕ Disconnect the phone</a>'
    + '<div id="lp_relayline" class="hint" style="margin:4px 0"></div>'
    + '<p class="hint help" style="margin:2px 0 6px">Away from home (Remote access ▾ with a relay or Cloudflare) the app reaches this PC for 6 hours after it was last on this Wi-Fi. Through a relay everything is sealed with a key only the app and this PC have - the relay cannot read it; pictures and videos come in parts, so they are slower than at home.</p>';
  var BAR = '<span id="lp_bartext"></span> <button class="ghost" id="lp_allow" type="button">✔ Allow</button> <button class="ghost" id="lp_deny" type="button">✕ Deny</button>';

  function paint(j) {
    last = j || {};
    var st = $("lp_state"), w = $("s_remote_connect");
    if (st) st.textContent = j.window_open ? "📱 Waiting for the app - open it on the phone (" + Math.ceil(j.window_left / 60) + " min left)." : "";
    if (w) { w.textContent = j.window_open ? "■ Stop waiting" : "📱 Connect the phone"; w.dataset.on = j.window_open ? "1" : ""; }
    var dl = $("lp_disc"); if (dl) dl.hidden = !(j.remote && j.remote.connected);
    if (j.remote && root.bgRemoteUI && $("s_remote_state") && !j.window_open) $("s_remote_state").textContent = root.bgRemoteUI.fmt(Object.assign({ lan: "1" }, j.remote));
    var rl = $("lp_relayline");
    if (rl) rl.textContent = relayLine(j.relay);
    bar((j.pending || [])[0] || null);
  }
  /** the "wants to connect" bar - 2.915.0 (Tim: "when the allow or deny button is pressed for remote connection hide the
   *  notification. show it over the dialog when connecting, i didn't know it was there because the dialog was still open"):
   *  a POPOVER (the browser's top layer - above an open Settings dialog), hidden at once on ✔ / ✕ */
  function hideBar() {
    var b = $("lp_bar"); if (!b) return;
    try { if (b.matches && b.matches(":popover-open")) b.hidePopover(); } catch (e) { /* no popover here */ }
    b.style.display = "none";
  }
  function bar(p) {
    var b = $("lp_bar");
    if (!p) { hideBar(); shown = ""; return; }
    if (!b) {
      b = doc.createElement("div"); b.id = "lp_bar"; b.innerHTML = BAR;
      b.style.cssText = "position:fixed;top:44px;left:50%;transform:translateX(-50%);margin:0;inset:auto;top:44px;left:50%;z-index:99999;background:var(--panel,#222);color:inherit;border:2px solid var(--accent,#f80);border-radius:10px;padding:10px 14px;box-shadow:0 6px 24px rgba(0,0,0,.6);gap:8px;align-items:center";
      if ("popover" in b) b.setAttribute("popover", "manual");
      doc.body.appendChild(b);
      $("lp_allow").onclick = function () { hideBar(); answer(b.dataset.rid, true); };
      $("lp_deny").onclick = function () { hideBar(); answer(b.dataset.rid, false); };
    }
    // an open modal dialog (Settings) makes the rest of the page inert - the bar goes INTO the topmost one so it can be pressed
    var dl = [].slice.call(doc.querySelectorAll("dialog[open]")).filter(function (d) { try { return d.matches(":modal"); } catch (e) { return false; } }).pop() || doc.body;
    if (b.parentNode !== dl) { try { if (b.matches(":popover-open")) b.hidePopover(); } catch (e) { /* none */ } dl.appendChild(b); shown = ""; }
    b.dataset.rid = p.rid;
    $("lp_bartext").textContent = "📱 " + p.device + " (" + p.ip + ") wants to connect to bitGen Studio";
    b.style.display = "flex";
    try { if (b.showPopover) { var open = b.matches(":popover-open"); if (open && shown !== p.rid) { b.hidePopover(); open = false; } if (!open) b.showPopover(); } } catch (e) { /* the fixed bar */ }   // a new ask: on top of whatever opened since
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
  /** 📱 Connect the phone - the one button: Remote access on (the first time), then 5 minutes in which the app on this Wi-Fi
   *  connects by itself, and the QR (the hidden Create remote link) for a phone without the app */
  function connect() {
    var b = $("s_remote_connect"), on = !b.dataset.on;
    if (!on) { post("/api/remote/lanpair/window", { on: false }).then(function () { var q = $("s_remote_qr"); if (q) q.style.display = "none"; if ($("s_remote_url")) $("s_remote_url").textContent = ""; ev("lanpair_window", "closed"); refresh(); }); return; }
    fetch("/api/remote/status").then(function (r) { return r.json(); }).then(function (st) {
      if (!st.enabled) {
        var sel = $("s_remote_mode");
        if (sel) { sel.value = "wifi"; sel.dispatchEvent(new Event("change")); }
        $("lp_state").textContent = "Remote access is on now - close bitGen Studio and start it again (once), then press Connect the phone.";
        return;
      }
      if (st.restart_required) { $("lp_state").textContent = "Remote access is on, but bitGen Studio still listens only on this computer - close it and start it again, then press Connect the phone."; return; }
      return post("/api/remote/lanpair/window", { on: true }).then(function () {
        ev("lanpair_window", "open");
        var l = $("s_remote_link"); if (l) l.click();                              // the QR, for a phone without the app
        refresh();
      });
    }).catch(function (e) { $("lp_state").textContent = "✗ " + e.message; });
  }
  function wire() {
    $("s_remote_connect").onclick = connect;
    $("lp_disc").onclick = function (e) { e.preventDefault(); if (root.confirm("Disconnect the phone? It has to connect again (on this Wi-Fi it does by itself when you press Connect the phone).")) post("/api/remote/revoke").then(refresh, refresh); };
  }
  function boot() {
    var after = $("s_remote_alts");
    if (!after || !doc.body || !$("s_remote_connect")) { setTimeout(boot, 800); return; }
    if ($("lp_box")) return;
    var box = doc.createElement("div"); box.id = "lp_box"; box.innerHTML = HTML;
    after.parentNode.insertBefore(box, after.nextSibling);
    wire(); refresh();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3LanPairUi = Object.assign(API, { refresh: refresh, paint: paint });
})(typeof window !== "undefined" ? window : globalThis);
