// bitGen Studio — lib/remoteGuard.js (2.909.0): NOTHING FROM THE NETWORK WITHOUT THE PAIRED DEVICE'S KEY.
//
// Tim: "lets do my pc first" (the 📱 bitGen app driving this computer's studio). Turning Remote access on makes the server
// listen on the network (lib/remote.js bindHost) - before 2.909.0 only /api/remote/* checked the paired phone, so ANY
// device on the Wi-Fi could reach every other endpoint (start renders, read projects, change settings). Now every request
// that does not come from this computer itself needs the ONE paired device's sealed key (lib/remote.js sessionOfReq: the
// X-Bitgen-Key header, the browser page's cookie, or ?bgk= on a GET of a picture / video). Open without a key: the
// pairing itself (GET /remote?t=..., POST /api/remote/pair) and GET /api/remote/hello (says "this is bitGen Studio").
// The app's own origins (Capacitor's http(s)://localhost, capacitor://localhost) get CORS answers - a web page anywhere
// else gets none, so it cannot use a key it does not have anyway.
//   isLoopback(req)   this computer (127.0.0.1 / ::1 / ::ffff:127.0.0.1, no X-Forwarded-For)
//   OPEN(method, path) the pairing paths
//   middleware(req, res, next)  mounted FIRST in routes/index.js
// Pure (scripts/test-909.js): isLoopback, isOpen, corsOrigin.
"use strict";

const LOOP = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const APP_ORIGINS = new Set(["http://localhost", "https://localhost", "capacitor://localhost"]);

/** 2.914.0: the way a request came from outside: "relay" (lib/relayLink.js answers it), "tunnel" (Cloudflare - lib/cfTunnel.js's
 *  forwarder, or anything carrying Cloudflare's own headers) or "" (the Wi-Fi / this computer) */
function viaOf(req) {
  const h = (req && req.headers) || {}, v = String(h["x-bitgen-via"] || "");
  if (v === "relay" || v === "tunnel") return v;
  return h["cf-ray"] || h["cf-connecting-ip"] ? "tunnel" : "";
}
function isLoopback(req) {
  const a = String((req && req.socket && req.socket.remoteAddress) || (req && req.connection && req.connection.remoteAddress) || "");
  return LOOP.has(a) && !(req.headers && req.headers["x-forwarded-for"]) && !viaOf(req);   // 2.914.0: a tunnel lands on 127.0.0.1 - never "this computer"
}
function isOpen(method, p) {
  const m = String(method || "GET").toUpperCase(), u = String(p || "");
  return (m === "GET" && (u === "/remote" || u === "/api/remote/hello")) || (m === "POST" && u === "/api/remote/pair")
    || (m === "GET" && /^\/static\/(remote\.html|remoteui\.js|icon\.png|favicon\.ico)$/.test(u))
    || (m === "GET" && /^\/apk\/[A-Za-z0-9_-]{16,64}\/bitGen\.apk$/.test(u))    // 2.912.0: 📲 the QR download - its token is checked by the route
    || (m === "POST" && u === "/api/remote/lanpair") || (m === "GET" && /^\/api\/remote\/lanpair\/[A-Za-z0-9_-]{12,40}$/.test(u));   // 2.913.0: 📶 asking to connect over the Wi-Fi (this PC says yes)
}
/** the Origin to echo back for CORS, or "" (pure) */
function corsOrigin(origin) { return APP_ORIGINS.has(String(origin || "")) ? String(origin) : ""; }

function middleware(req, res, next) {
  if (isLoopback(req)) {
    // 2.926.0 (docs/bitgen-studio-threat-model.md TM-001/002): this computer - but only bitGen Studio's own page, never
    // another web page in a browser here (DNS rebinding, cross-site posts, a previewed website's scripts)
    const why = require("./localGuard").localWhy(req);
    if (why) { console.warn("[guard] refused " + req.method + " " + String(req.path || "").slice(0, 80) + " - " + why); return res.status(403).json({ error: why, guard: "local" }); }
    return next();
  }
  const o = corsOrigin(req.headers.origin);
  if (o) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Bitgen-Key, X-Bitgen-Sampler");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
    if (req.method === "OPTIONS") return res.status(204).end();
  }
  const remote = require("./remote");
  if (!remote.enabled()) return res.status(403).json({ error: "remote access is off on this computer (bitGen Studio ▸ Settings ▸ General)" });
  const via = viaOf(req);
  if (isOpen(req.method, req.path)) {
    // 2.914.0: through a tunnel only "is this bitGen Studio?" - connecting / pairing / the QR download are for the Wi-Fi
    if (via && !(req.method === "GET" && req.path === "/api/remote/hello")) return res.status(403).json({ error: "connecting is done on the Wi-Fi (or with the QR) - not from outside" });
    return next();
  }
  const s = remote.sessionOfReq(req);
  if (!s) return res.status(401).json({ error: "this device is not paired with bitGen Studio - scan a new pairing code (Settings ▸ General ▸ Remote access)", unpaired: true });
  req.remote = s;
  // 2.926.0 (TM-003): what runs programs on the PC is changed on the PC - not from a phone that may be lost
  if (require("./localGuard").pcOnly(req.method, req.path)) return res.status(403).json({ error: "this is changed on the PC itself (it runs programs there) - not from a paired phone", guard: "pc-only" });
  if (via === "tunnel") {                                 // 2.914.0: away through Cloudflare - 6 hours after the Wi-Fi, as the relay
    const rs = remote.relaySession(), AWAY = require("./relayBox").AWAY_MS;
    if (!rs || !rs.lanSeen || Date.now() - rs.lanSeen > AWAY) return res.status(403).json({ error: "the app has not been on this PC's Wi-Fi for 6 hours - connect at home once", away: true });
  }
  if (!via) remote.markLan();                             // 2.913.0: on the Wi-Fi - the 6 hours away start again
  return next();
}
module.exports = { viaOf, isLoopback, isOpen, corsOrigin, middleware, APP_ORIGINS };
