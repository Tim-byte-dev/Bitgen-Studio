// bitGen Studio — remote phone access: pairing, sealed cookies, ONE device.
//
// WHY THIS FILE EXISTS. Turning the studio on for the phone means opening a
// port on the LAN, and everything behind that port can write files, spend GPU
// time and read the user's projects. So the rules are deliberately strict and
// they all live here rather than being sprinkled through the routes:
//
//   * The server binds to 127.0.0.1 unless remote is explicitly enabled. See
//     bindHost(): server.js asks this module rather than hard-coding a host.
//   * A pairing code is ONE-SHOT and short-lived. Minting a new one invalidates
//     the previous one, so a QR left on screen an hour ago is not a way in.
//   * Redeeming a code issues a sealed cookie (AES-256-GCM) and makes that
//     device THE device. Any older session dies at that moment - "only 1 active
//     connection" is enforced by comparing the session id inside the cookie
//     against the single active id, not by counting sockets.
//   * The cookie is sealed with a key that never leaves the machine, so a
//     stolen cookie from a different install is unopenable, and a tampered one
//     fails the GCM tag rather than being trusted.
//
// The key is stored in the settings store like any other setting; there is no
// secret material in the repo and nothing to check in.
const crypto = require("crypto");
const os = require("os");
const core = require("./core");

// Adapters a phone is almost never on: WSL, Hyper-V, VirtualBox, VMware, VPNs.
const VIRTUAL_RE = /(vEthernet|WSL|Hyper-V|VirtualBox|VMware|Loopback|Tailscale|ZeroTier|utun|Docker|br-|veth)/i;

const COOKIE = "bg_remote";
const PAIR_TTL_MS = 10 * 60 * 1000;          // a QR on screen is good for 10 min
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // a paired phone stays paired a month

// pending pairing code and the live session. The code stays in memory (a restart cancels a QR on screen).
// 2.909.0 (the 📱 bitGen app - Tim: "lets do my pc first"): the paired DEVICE is kept in the settings
// (remote.active {sid, device, since}) so restarting the computer does not unpair the phone app - its token is
// still sealed with this machine's key and still has to match that one sid; ⛔ Disconnect (revoke) clears it.
let pending = null;      // { code, exp }
let active = null;       // { sid, device, ip, since, lastSeen }
let loaded = false;
function loadActive() {
  if (loaded) return;
  loaded = true;
  try {
    const a = (cfg().remote || {}).active;
    if (!active && a && a.sid) active = { sid: String(a.sid), device: String(a.device || ""), ip: "", since: +a.since || 0, lastSeen: +a.since || 0, app: !!a.app };
  } catch { /* no settings yet */ }
}
function saveActive() {
  try {
    const c = cfg(); c.remote = c.remote || {};
    if (active) c.remote.active = { sid: active.sid, device: active.device, since: active.since, app: !!active.app };
    else delete c.remote.active;
    core.setConfig(c);
  } catch { /* the session still works until a restart */ }
}

function cfg() { return core.getConfig() || {}; }

function masterKey() {
  const c = cfg();
  c.remote = c.remote || {};
  if (!c.remote.key || String(c.remote.key).length < 64) {
    c.remote.key = crypto.randomBytes(32).toString("hex");
    core.setConfig(c);                       // persisted; generated once, never shipped
  }
  return Buffer.from(c.remote.key, "hex");
}

function enabled() { return !!(cfg().remote || {}).enabled; }

function setEnabled(on) {
  const c = cfg();
  c.remote = c.remote || {};
  c.remote.enabled = !!on;
  core.setConfig(c);
  if (!on) { pending = null; active = null; saveActive(); }
  return !!on;
}

// What the process is ACTUALLY listening on. bindHost() is called once, by
// server.js at listen time, so the first answer is the truth for this run; the
// setting can be changed later but the socket cannot. Remembering it is what
// lets /api/remote/link say "restart first" instead of handing out a link that
// points at an address nothing is bound to - the failure Tim hit.
let bound = "";

/** The host server.js listens on. Loopback unless the user opted in. */
function bindHost() {
  const h = enabled() ? "0.0.0.0" : "127.0.0.1";
  if (!bound) bound = h;
  return h;
}

/** "0.0.0.0" once the process is reachable from the network, else loopback. */
function boundHost() { return bound || "127.0.0.1"; }

/** True when the setting says yes but this process never bound to the network. */
function restartNeeded() { return enabled() && boundHost() === "127.0.0.1"; }

function b64u(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s) {
  return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** AES-256-GCM: iv | tag | ciphertext, base64url. Tamper -> open() returns null. */
function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return b64u(Buffer.concat([iv, c.getAuthTag(), ct]));
}

function open(token) {
  try {
    const raw = unb64u(token);
    if (raw.length < 29) return null;
    const d = crypto.createDecipheriv("aes-256-gcm", masterKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const out = Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
    const o = JSON.parse(out);
    return (o && typeof o === "object") ? o : null;
  } catch { return null; }            // wrong key, tampered tag, or not ours
}

/** Mint a one-shot pairing code, invalidating any previous one. */
function mintPairing(now = Date.now()) {
  pending = { code: b64u(crypto.randomBytes(18)), exp: now + PAIR_TTL_MS };
  return { code: pending.code, expires_at: pending.exp };
}

/**
 * Redeem a pairing code. Returns the sealed cookie value, and makes this device
 * THE device - whatever was connected before is evicted here, by design.
 */
function redeem(code, device = "", ip = "", now = Date.now(), app = false) {
  loadActive();
  if (!enabled()) return { error: "remote access is off" };
  if (!pending || !code || code !== pending.code) return { error: "invalid pairing code" };
  if (now > pending.exp) { pending = null; return { error: "pairing code expired" }; }
  pending = null;                                   // ONE-SHOT: never reusable
  const sid = b64u(crypto.randomBytes(16));
  active = { sid, device: String(device).slice(0, 120), ip: String(ip).slice(0, 60),
             since: now, lastSeen: now, app: !!app };
  saveActive();
  return { cookie: seal({ sid, exp: now + SESSION_TTL_MS }), sid, expires_at: now + SESSION_TTL_MS };
}

/** Read a request's cookie header and say whether it is THE live session. */
function sessionOf(cookieHeader, now = Date.now()) {
  const m = /(?:^|;\s*)bg_remote=([^;]+)/.exec(String(cookieHeader || ""));
  if (!m) return null;
  return sessionOfToken(decodeURIComponent(m[1]), now);
}
/** 2.909.0: the 📱 app's key - the same sealed token as the cookie, sent as the X-Bitgen-Key header (or ?bgk= on a GET of
 *  a picture / video, which an <img> / <video> cannot put a header on) */
function tokenOf(req) {
  const h = (req && req.headers) || {};
  const k = h["x-bitgen-key"];
  if (k) return String(k);
  const q = (req && req.query && req.query.bgk) || "";
  if (q && String((req && req.method) || "GET").toUpperCase() === "GET") return String(q);
  const m = /(?:^|;\s*)bg_remote=([^;]+)/.exec(String(h.cookie || ""));
  return m ? decodeURIComponent(m[1]) : "";
}
function sessionOfReq(req, now = Date.now()) { const t = tokenOf(req); return t ? sessionOfToken(t, now) : null; }
function sessionOfToken(token, now = Date.now()) {
  loadActive();
  if (!enabled() || !active || !token) return null;
  const s = open(token);
  if (!s || !s.sid || !s.exp) return null;
  if (now > s.exp) return null;
  if (s.sid !== active.sid) return null;            // superseded by a newer phone
  active.lastSeen = now;
  return { sid: s.sid, device: active.device, since: active.since };
}

function revoke() { loadActive(); active = null; pending = null; saveActive(); return true; }

function status(now = Date.now()) {
  loadActive();
  return {
    enabled: enabled(),
    bind: bindHost(),
    bound: boundHost(),
    restart_required: restartNeeded(),
    connected: !!active,
    device: active ? active.device : "",
    app: !!(active && active.app),                    // 2.909.0: the 📱 bitGen app (not the browser page)
    since: active ? active.since : 0,
    idle_seconds: active ? Math.round((now - active.lastSeen) / 1000) : 0,
    pairing_open: !!(pending && now <= pending.exp),
  };
}

/**
 * The LAN address a phone can actually reach, preferring a private IPv4.
 * Returns "" when the machine has no LAN address, so the UI can say so instead
 * of printing a QR that points at nothing.
 */
function lanAddresses(ifaces = os.networkInterfaces()) {
  const cands = [];
  for (const list of Object.values(ifaces || {})) {
    for (const a of (list || [])) {
      if (!a || a.internal) continue;
      const fam = a.family === 4 || a.family === "IPv4";
      if (!fam || !a.address) continue;
      const ip = a.address;
      const rank = /^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1
                 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
      cands.push({ ip, rank });
    }
  }
  cands.sort((a, b) => a.rank - b.rank);
  return cands;
}

/**
 * EVERY candidate, best first, with the adapter it belongs to. A Windows box
 * with WSL, Hyper-V, VirtualBox or a VPN has several private addresses and only
 * one of them is the network the phone is on - guessing silently is how a QR
 * ends up pointing at a virtual switch. The UI offers the list.
 */
function lanCandidates(ifaces = os.networkInterfaces()) {
  const out = [];
  for (const [name, list] of Object.entries(ifaces || {})) {
    for (const a of (list || [])) {
      if (!a || a.internal) continue;
      if (!(a.family === 4 || a.family === "IPv4") || !a.address) continue;
      out.push({ ip: a.address, adapter: name, virtual: VIRTUAL_RE.test(name) });
    }
  }
  const rank = (o) => (o.virtual ? 10 : 0)
    + (/^192\.168\./.test(o.ip) ? 0 : /^10\./.test(o.ip) ? 1
       : /^172\.(1[6-9]|2\d|3[01])\./.test(o.ip) ? 2 : 3);
  return out.sort((a, b) => rank(a) - rank(b));
}

/** The single best guess, or "" when the machine has no LAN address at all. */
function lanAddress(ifaces = os.networkInterfaces()) {
  const c = lanCandidates(ifaces);
  return c.length ? c[0].ip : "";
}

function linkFor(code, port, host) {
  // host === undefined means "discover it"; host === "" means "there isn't one"
  // and must NOT silently fall back to discovery, or a caller that already
  // found no address would print a link pointing at this machine's loopback.
  const ip = host === undefined ? lanAddress() : host;
  return ip ? `http://${ip}:${port}/remote?t=${encodeURIComponent(code)}` : "";
}

module.exports = {
  COOKIE, PAIR_TTL_MS, SESSION_TTL_MS,
  enabled, setEnabled, bindHost, boundHost, restartNeeded, seal, open,
  lanCandidates, VIRTUAL_RE,
  mintPairing, redeem, sessionOf, sessionOfReq, sessionOfToken, tokenOf, revoke, status, lanAddress, linkFor,
  _reset: () => { pending = null; active = null; loaded = true; },
  _setBound: (h) => { bound = h; },     // tests only

};
