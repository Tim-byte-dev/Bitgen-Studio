/* bitGen Studio — static/remoteaccessui.js (2.914.0): SETTINGS ▸ GENERAL ▸ REMOTE ACCESS IS A DROPDOWN (H3RemoteAccessUi).
 *
 * Tim (verbatim): "can you make remote access a dropdown in settings-general, add an input for url to relay.php and a
 * cloudflare option. if checked can bitgen set up the cloudflare or does the user need to input something?" - bitGen sets
 * Cloudflare up itself (a quick tunnel: ⬇ cloudflared once, a Download / Cancel box first; nothing to type, no account).
 *   Remote access ▾  Off - this computer only | On this Wi-Fi | Wi-Fi + away: a relay (relay.php) | Wi-Fi + away: Cloudflare
 *   The old checkbox (#s_remote_on, static/remoteui.js) stays underneath, hidden: the dropdown ticks it and it does what it
 *   did (Remote access on / off, the restart note). The relay: its address (empty = bitGen's own on tigerart.com.au - only
 *   that server's Community admins) + an optional relay key (your own relay.php). Server: lib/remoteAway.js, lib/cfTunnel.js.
 * Pure (Node): modeOf(enabled, away), awayLine(view). */
(function (root) {
  "use strict";
  function modeOf(enabled, away) { return !enabled ? "off" : away === "relay" ? "relay" : away === "cloudflare" ? "cloudflare" : "wifi"; }
  function awayLine(v) {
    var x = v || {}, cf = x.cloudflare || {}, r = x.relay || {};
    if (x.mode === "cloudflare") {
      if (cf.job && cf.job.state === "running") return "⬇ Downloading cloudflared… " + (cf.job.total ? Math.round(cf.job.got / cf.job.total * 100) + "%" : Math.round(cf.job.got / 1048576) + " MB");
      if (!cf.installed) return "☁ Cloudflare needs its tunnel program (cloudflared, about 40 MB) - press Download.";
      if (cf.url) return "☁ Away from the Wi-Fi the app reaches this PC at " + cf.url + " (a new address each time bitGen starts - the app learns it on the Wi-Fi).";
      return cf.running ? "☁ Starting the Cloudflare tunnel…" : "☁ The Cloudflare tunnel is not running" + (cf.error ? ": " + cf.error : " - tick Remote access on.");
    }
    if (x.mode === "relay") {
      if (r.last_error) return "☁ The relay: " + r.last_error;
      return r.registered ? "☁ This PC is registered with the relay." : "☁ This PC registers with the relay when the app connects.";
    }
    return "";
  }
  var API = { modeOf: modeOf, awayLine: awayLine };
  if (typeof module !== "undefined" && module.exports && typeof document === "undefined") { module.exports = API; return; }

  var doc = root.document, timer = null, last = null;
  function $(id) { return doc.getElementById(id); }
  function ev(n, v) { try { if (root.H3TestEvent) root.H3TestEvent(n, v); } catch (e) { /* 🧪 */ } }
  function getJ(u) { return fetch(u).then(function (r) { return r.json(); }); }
  function post(u, b) {
    return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }
  function paint(st, away) {
    last = away || last || {};
    var sel = $("s_remote_mode"); if (!sel) return;
    if (doc.activeElement !== sel) sel.value = modeOf(st && st.enabled, last.mode);
    var m = sel.value;
    $("s_remote_relaybox").hidden = m !== "relay";
    $("s_remote_cfbox").hidden = m !== "cloudflare";
    var r = $("s_remote_relayurl"); if (r && doc.activeElement !== r) r.value = (last.relay && last.relay.url_set) || "";
    var k = $("s_remote_relaykey"); if (k && doc.activeElement !== k) k.value = last.relay && last.relay.key_set ? "••••" : "";
    $("s_remote_awayline").textContent = awayLine(last);
    var cf = last.cloudflare || {};
    $("s_remote_cfget").hidden = !!cf.installed || (cf.job && cf.job.state === "running");
    clearTimeout(timer);
    if (m === "cloudflare" && (!cf.url || (cf.job && cf.job.state === "running"))) timer = setTimeout(refresh, 1500);
    else if (m === "relay" || m === "cloudflare") timer = setTimeout(refresh, 8000);
  }
  function refresh() {
    return Promise.all([getJ("/api/remote/status"), getJ("/api/remote/away")]).then(function (a) { paint(a[0], a[1]); }).catch(function () { /* later */ });
  }
  function choose(m) {
    var on = m !== "off", box = $("s_remote_on");
    if (box && box.checked !== on) { box.checked = on; box.dispatchEvent(new Event("change")); }   // remoteui.js: on / off + the restart note
    var away = m === "relay" ? "relay" : m === "cloudflare" ? "cloudflare" : "none";
    post("/api/remote/away", { mode: away }).then(function (v) {
      ev("remote_mode", m);
      if (m === "cloudflare" && !(v.cloudflare || {}).installed && root.confirm("⬇ Download cloudflared - Cloudflare's tunnel program (about 40 MB, Apache-2.0) - into bitGen's tools folder?\n\nNothing to sign up for: bitGen runs a quick tunnel and Cloudflare gives it a random https address. Only the paired bitGen app can use it (its key), for 6 hours after it was last on your Wi-Fi.")) {
        return post("/api/remote/cloudflare/install");
      }
      return v;
    }).then(refresh, function (e) { $("s_remote_awayline").textContent = "✗ " + e.message; });
  }
  function saveRelay() {
    post("/api/remote/away", { relay_url: $("s_remote_relayurl").value, relay_key: $("s_remote_relaykey").value })
      .then(function () { ev("remote_relay_saved", "1"); refresh(); }, function (e) { $("s_remote_awayline").textContent = "✗ " + e.message; });
  }
  function boot() {
    if (!$("s_remote_mode")) { setTimeout(boot, 800); return; }
    $("s_remote_mode").onchange = function () { choose($("s_remote_mode").value); };
    $("s_remote_relaysave").onclick = saveRelay;
    $("s_remote_cfget").onclick = function () { post("/api/remote/cloudflare/install").then(refresh); };
    refresh();
    var tab = $("stab-general");
    if (tab && root.MutationObserver) new root.MutationObserver(function () { if (tab.classList.contains("active")) refresh(); }).observe(tab, { attributes: true, attributeFilter: ["class"] });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3RemoteAccessUi = Object.assign(API, { refresh: refresh });
})(typeof window !== "undefined" ? window : globalThis);
