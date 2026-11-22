// bitGen Studio — lib/remoteAway.js (2.914.0): SETTINGS ▸ GENERAL ▸ REMOTE ACCESS - ONE DROPDOWN, AND HOW THE 📱 APP
// REACHES THIS PC AWAY FROM THE WI-FI.
//
// Tim: "can you make remote access a dropdown in settings-general, add an input for url to relay.php and a cloudflare option"
// (after: "only tigerart admin will be able to use it this relay through tigerart, other users can use cloudflare or their
// own hosts. i don't want to get a ddns").
//   Remote access ▾   Off (this computer only) | On this Wi-Fi | Wi-Fi + away: a relay | Wi-Fi + away: Cloudflare
//   remote.away = {mode: "none" | "relay" | "cloudflare"}; remote.relay = {url, key (encrypted), id, secret (encrypted)}
//   * relay: community/relay.php on a website - tigerart.com.au's lets in only its own Community admins (this PC signs in
//     with 💬 Community), anyone can put relay.php on their own hosting and give it a relay key (lib/relayLink.js)
//   * cloudflare: a quick tunnel bitGen sets up itself - no account, nothing to type (lib/cfTunnel.js)
//   Either way the app may use it for 6 hours after it was last on this PC's Wi-Fi (lib/relayBox.js AWAY_MS).
//   mode() / set(b) / view() / forApp() / apply()
"use strict";
const core = require("./core");

const MODES = ["none", "relay", "cloudflare"];
function cfg() { return core.getConfig() || {}; }
function mode() {
  const r = cfg().remote || {}, a = r.away || {};
  if (MODES.includes(a.mode)) return a.mode;
  return r.relay && r.relay.on === true ? "relay" : "none";       // 2.913.0's switch, if it was turned on
}
/** a relay.php address: https, or http to this computer (tests) - "" = bitGen's own on tigerart.com.au (pure) */
function cleanRelayUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  let x; try { x = new URL(s); } catch { throw Object.assign(new Error("not a web address: " + s), { status: 400 }); }
  const local = /^(127\.0\.0\.1|localhost|\[::1\])$/i.test(x.hostname);
  if (x.protocol !== "https:" && !(x.protocol === "http:" && local)) throw Object.assign(new Error("the relay must be an https:// address"), { status: 400 });
  if (!/\.php$/i.test(x.pathname)) x.pathname = x.pathname.replace(/\/?$/, "/relay.php");
  x.search = ""; x.hash = "";
  return x.toString();
}
function set(b) {
  const o = b || {}, c = cfg();
  c.remote = c.remote || {};
  if (o.mode !== undefined) {
    if (!MODES.includes(o.mode)) throw Object.assign(new Error("Remote access is none, relay or cloudflare"), { status: 400 });
    c.remote.away = Object.assign({}, c.remote.away || {}, { mode: o.mode });
  }
  if (o.relay_url !== undefined || o.relay_key !== undefined) {
    const r = Object.assign({}, c.remote.relay || {});
    if (o.relay_url !== undefined) { const u = cleanRelayUrl(o.relay_url); if (u !== (r.url || "")) { r.url = u; r.id = ""; r.secret = ""; } }
    if (o.relay_key !== undefined && o.relay_key !== "••••") { r.key = String(o.relay_key || "").slice(0, 200); r.id = ""; r.secret = ""; }
    c.remote.relay = r;
  }
  core.setConfig(c);
  apply();
  return view();
}
function view() {
  const R = require("./relayLink"), r = (cfg().remote || {}).relay || {};
  return { mode: mode(), relay: Object.assign(R.status(), { url_set: r.url || "", key_set: !!r.key }), cloudflare: require("./cfTunnel").status() };
}
/** what the app is told (pairing, /api/app/info): {mode: "relay", url, id, key} | {mode: "tunnel", url} | null */
function forApp() {
  const m = mode();
  if (m === "relay") { const r = require("./relayLink").forApp(); return r ? Object.assign({ mode: "relay" }, r) : null; }
  if (m === "cloudflare") { const s = require("./cfTunnel").status(); return s.url ? { mode: "tunnel", url: s.url, away_hours: 6 } : null; }
  return null;
}
/** start / stop what the dropdown says (Remote access on) */
function apply() {
  const on = require("./remote").enabled(), m = mode();
  try { require("./cfTunnel").ensure(on && m === "cloudflare"); } catch { /* not here */ }
  if (on && m === "relay") require("./relayLink").kick();
}
module.exports = { MODES, mode, set, view, forApp, apply, cleanRelayUrl };
