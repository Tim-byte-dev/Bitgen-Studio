/* bitGen app — www/lib/net.js (2.913.0): FINDING THE PC ON THE WI-FI + THE SEALED RELAY FOR 6 HOURS AWAY (window.BGNet).
 *
 * Tim: "if my phone is on the same wifi connection as the desktop ... connect automaticlly when i start the app. this link
 * will auto connect when on wifi and stay connected for 6 hours if wifi connection is lost but phone has internet
 * connection elsewhere" -> the relay: "Relay via tigerart.com.au".
 *   hostsOf(ip, prefix)        the addresses to look at on the phone's Wi-Fi (its /24; a wider network: the /24 around it)
 *   scan(hosts, port, probe)   look at many at once -> the first bitGen Studio that answers its hello
 *   pack / unpack / seal / open    the sealed box - the SAME format as bitGen Studio's lib/relayBox.js:
 *       box = iv (12) | ciphertext + tag (16), AES-256-GCM, AAD "bgr1-req" / "bgr1-res"
 *       text = len (4, big-endian) | JSON head | body bytes
 *   relaySend(relay, req)      one request through the relay (relay = {url, id, key}) -> {status, headers, body}
 * The relay (community/relay.php on tigerart.com.au) only moves the boxes - it cannot read a request, the app's key or a
 * picture. Works in the app's WebView (http://localhost is a secure context, so crypto.subtle is there) and in Node
 * (scripts/test-913.js opens a box sealed by lib/relayBox.js and the other way). */
(function (root) {
  "use strict";
  var subtle = function () { return (root.crypto || globalThis.crypto).subtle; };
  var te = new TextEncoder(), td = new TextDecoder();

  function hostsOf(ip, prefix) {
    var m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(String(ip || ""));
    if (!m) return [];
    var p = Math.max(24, Math.min(30, parseInt(prefix, 10) || 24));
    var own = +m[4], size = Math.pow(2, 32 - p), first = own - (own % size), out = [];
    for (var i = first + 1; i < first + size - 1; i++) if (i !== own && i > 0 && i < 255) out.push(m[1] + "." + m[2] + "." + m[3] + "." + i);
    return out;
  }
  /** probe(host) -> Promise<hello | null>; resolves with the first {host, hello} (null when none), `width` at a time */
  function scan(hosts, probe, width) {
    var list = (hosts || []).slice(), w = width || 32, found = null, busy = 0;
    return new Promise(function (resolve) {
      if (!list.length) { resolve(null); return; }
      function next() {
        if (found) return;
        if (!list.length) { if (!busy) resolve(null); return; }
        var h = list.shift(); busy++;
        Promise.resolve().then(function () { return probe(h); }).catch(function () { return null; }).then(function (hello) {
          busy--;
          if (found) return;
          if (hello) { found = { host: h, hello: hello }; resolve(found); return; }
          next();
        });
      }
      for (var i = 0; i < w; i++) next();
    });
  }

  function u8(x) { return x instanceof Uint8Array ? x : x ? new Uint8Array(x) : new Uint8Array(0); }
  function pack(head, body) {
    var h = te.encode(JSON.stringify(head || {})), b = u8(body), out = new Uint8Array(4 + h.length + b.length);
    new DataView(out.buffer).setUint32(0, h.length, false);
    out.set(h, 4); out.set(b, 4 + h.length);
    return out;
  }
  function unpack(buf) {
    var b = u8(buf);
    if (b.length < 4) return null;
    var n = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(0, false);
    if (n > b.length - 4 || n > 65536) return null;
    var head; try { head = JSON.parse(td.decode(b.subarray(4, 4 + n))); } catch (e) { return null; }
    return head && typeof head === "object" ? { head: head, body: b.subarray(4 + n) } : null;
  }
  function b64d(s) { var bin = atob(String(s || "")), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  var keys = {};
  function keyOf(k64) {
    if (!keys[k64]) keys[k64] = subtle().importKey("raw", b64d(k64), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    return keys[k64];
  }
  function seal(k64, aad, data) {
    var iv = (root.crypto || globalThis.crypto).getRandomValues(new Uint8Array(12));
    return keyOf(k64).then(function (k) { return subtle().encrypt({ name: "AES-GCM", iv: iv, additionalData: te.encode(aad) }, k, u8(data)); })
      .then(function (ct) { var c = new Uint8Array(ct), out = new Uint8Array(12 + c.length); out.set(iv, 0); out.set(c, 12); return out; });
  }
  function open(k64, aad, box) {
    var b = u8(box);
    if (b.length < 28) return Promise.resolve(null);
    return keyOf(k64).then(function (k) { return subtle().decrypt({ name: "AES-GCM", iv: b.subarray(0, 12), additionalData: te.encode(aad) }, k, b.subarray(12)); })
      .then(function (p) { return new Uint8Array(p); }, function () { return null; });
  }
  function nonce() {
    var r = (root.crypto || globalThis.crypto).getRandomValues(new Uint8Array(12)), s = "";
    for (var i = 0; i < r.length; i++) s += String.fromCharCode(r[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  /** req = {method, path, headers: {lower-case: value}, body: Uint8Array} -> {status, headers, body: Uint8Array} */
  function relaySend(relay, req, timeoutMs) {
    var r = relay || {}, q = req || {}, n = nonce();
    var head = { v: 1, n: n, t: Date.now(), m: q.method || "GET", p: q.path || "/", h: q.headers || {} };
    return seal(r.key, "bgr1-req", pack(head, q.body)).then(function (box) {
      var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      if (ctl) setTimeout(function () { ctl.abort(); }, timeoutMs || 40000);
      return fetch(String(r.url) + "?a=send&pc=" + encodeURIComponent(r.id), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: box, signal: ctl ? ctl.signal : undefined });
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) { var e = new Error(j.error || ("the relay answered " + res.status)); e.status = res.status; e.relay = true; throw e; });
      return res.arrayBuffer();
    }).then(function (ab) { return open(r.key, "bgr1-res", new Uint8Array(ab)); }).then(function (plain) {
      var u = plain && unpack(plain);
      if (!u || u.head.n !== n) { var e = new Error("the answer through the relay could not be opened (an old key? connect on the Wi-Fi once)"); e.relay = true; throw e; }
      return { status: +u.head.s || 0, headers: u.head.h || {}, body: u.body };
    });
  }
  var API = { hostsOf: hostsOf, scan: scan, pack: pack, unpack: unpack, seal: seal, open: open, nonce: nonce, relaySend: relaySend, AWAY_MS: 6 * 3600 * 1000 };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.BGNet = API;
})(typeof window !== "undefined" ? window : globalThis);
