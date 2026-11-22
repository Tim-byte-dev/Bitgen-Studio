// bitGen Studio — lib/relayBox.js (2.913.0): THE SEALED ENVELOPE BETWEEN THE 📱 APP AND THIS PC THROUGH THE RELAY.
//
// Tim: "this link will auto connect when on wifi and stay connected for 6 hours if wifi connection is lost but phone has
// internet connection elsewhere" -> "Relay via tigerart.com.au". Away from the Wi-Fi the app cannot see 192.168.x.x, so its
// requests go to the relay (community/relay.php on tigerart.com.au), this PC fetches them from there and answers there.
// The relay only ever holds SEALED boxes: AES-256-GCM with a key made for the paired app (remote.active.rk) and handed to
// it over the Wi-Fi when it paired - the relay cannot read or change a request, its key, a picture or a reply.
//
//   box  = iv (12) | ciphertext | tag (16)            the same bytes WebCrypto's AES-GCM gives (ct || tag)
//   AAD  = "bgr1-req" / "bgr1-res"                    a reply can never be passed off as a request, or the other way
//   text = len (4 bytes, big-endian) | JSON head | body bytes
//   request head  {v: 1, n: nonce (16 b64url), t: ms, m: method, p: path, h: {header: value}}
//   reply head    {v: 1, n: the request's nonce, s: status, h: {content-type, content-range, ...}}
// mobile/www/lib/net.js is the app's side of the same format (scripts/test-913.js opens one side's box with the other).
//   pack(head, body) / unpack(buf)  seal(key, aad, buf) / open(key, aad, box)  fresh(head, now, seen)
"use strict";
const crypto = require("crypto");

const AWAY_MS = 6 * 3600 * 1000;      // Tim: "stay connected for 6 hours if wifi connection is lost"
const SKEW_MS = 2 * 60 * 1000;        // a request older (or newer) than this is refused - a replayed box is no use
const MAX_BODY = 5 * 1024 * 1024;     // what one box may carry (the relay's PHP takes about 8 MB; pictures / videos go in Range parts)
const AAD_REQ = Buffer.from("bgr1-req"), AAD_RES = Buffer.from("bgr1-res");

function pack(head, body) {
  const h = Buffer.from(JSON.stringify(head || {}), "utf8");
  const b = body ? Buffer.from(body) : Buffer.alloc(0);
  const len = Buffer.alloc(4); len.writeUInt32BE(h.length, 0);
  return Buffer.concat([len, h, b]);
}
function unpack(buf) {
  const b = Buffer.from(buf || []);
  if (b.length < 4) return null;
  const n = b.readUInt32BE(0);
  if (n > b.length - 4 || n > 65536) return null;
  let head; try { head = JSON.parse(b.subarray(4, 4 + n).toString("utf8")); } catch { return null; }
  if (!head || typeof head !== "object") return null;
  return { head, body: b.subarray(4 + n) };
}
function keyOf(k) { const b = Buffer.isBuffer(k) ? k : Buffer.from(String(k || ""), "base64"); return b.length === 32 ? b : null; }
function seal(key, aad, buf) {
  const k = keyOf(key); if (!k) throw new Error("no relay key");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv); c.setAAD(aad);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]);
}
function open(key, aad, box) {
  try {
    const k = keyOf(key), b = Buffer.from(box || []);
    if (!k || b.length < 28) return null;
    const d = crypto.createDecipheriv("aes-256-gcm", k, b.subarray(0, 12)); d.setAAD(aad);
    d.setAuthTag(b.subarray(b.length - 16));
    return Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]);
  } catch { return null; }
}
/** a request head that may be answered: right shape, recent, its nonce not seen before (seen = a Map nonce -> time) */
function fresh(head, now, seen) {
  const h = head || {}, t = +h.t || 0, n = String(h.n || "");
  if (h.v !== 1 || !/^[A-Za-z0-9_-]{12,40}$/.test(n) || typeof h.p !== "string" || !h.p.startsWith("/")) return "not a bitGen request";
  if (Math.abs(now - t) > SKEW_MS) return "too old (or the phone's clock is wrong by more than 2 minutes)";
  if (seen) {
    if (seen.has(n)) return "already answered";
    seen.set(n, now);
    if (seen.size > 2000) for (const [k, v] of seen) if (now - v > SKEW_MS * 2) seen.delete(k);
  }
  return "";
}
const newKey = () => crypto.randomBytes(32).toString("base64");
module.exports = { AWAY_MS, SKEW_MS, MAX_BODY, AAD_REQ, AAD_RES, pack, unpack, seal, open, fresh, newKey };
