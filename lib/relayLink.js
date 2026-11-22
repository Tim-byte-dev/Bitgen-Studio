// bitGen Studio — lib/relayLink.js (2.913.0): THIS PC ON THE RELAY, FOR THE 📱 APP AWAY FROM THE WI-FI (6 HOURS).
//
// Tim: "stay connected for 6 hours if wifi connection is lost but phone has internet connection elsewhere" -> "Relay via
// tigerart.com.au". The relay is community/relay.php on the Community server (https://tigerart.com.au/bitgen-community/
// relay.php - the same server as 💬 Community; another Community server = its own relay.php). This PC registers there once
// (remote.relay {id, secret} - the secret kept encrypted in settings/keys.json), then, while the paired app was on the
// Wi-Fi within the last 6 hours and is not on it now, asks the relay for the app's requests: a quick look every 10 s, and
// for 3 minutes after a request a long poll (the relay holds it 8 s), so an answer is quick once the app is talking.
// Each request is a sealed box (lib/relayBox.js, the app's relay key): opened here, checked (recent, not seen before, the
// app seen on the Wi-Fi within 6 hours), sent to this studio itself (127.0.0.1, with the app's key inside the box, marked
// X-Bitgen-Via: relay so lib/remoteGuard.js treats it as from the network - nothing local-only is reachable) and the reply
// sealed and left at the relay. A reply bigger than 5 MB is refused - the app asks for pictures / videos in Range parts.
//   relayUrl(communityUrl) / setOn(on) / status() / start() / stop() / handle(rid, box) - one loop, started by routes/lanPair.js
"use strict";
const http = require("http");
const core = require("./core");
const remote = require("./remote");
const box = require("./relayBox");

const IDLE_MS = 10 * 1000, HOME_MS = 20 * 1000, ACTIVE_FOR = 3 * 60 * 1000, BACKOFF_MS = 30 * 1000, HOME_SEEN = 45 * 1000;
const PASS_HEADERS = ["content-type", "range", "x-bitgen-key", "x-bitgen-sampler", "accept"];
const BACK_HEADERS = ["content-type", "content-range", "content-length", "accept-ranges", "content-disposition"];
let timer = null, running = false, lastTraffic = 0, lastRelayed = 0, st = { polling: false, last_ok: 0, last_error: "", answered: 0 };
const seen = new Map();
const port = () => parseInt(process.env.H3_PORT, 10) || 8311;

function cfg() { const c = core.getConfig() || {}; return (c.remote && c.remote.relay) || {}; }
function saveRelay(patch) { const c = core.getConfig() || {}; c.remote = c.remote || {}; c.remote.relay = Object.assign({}, c.remote.relay || {}, patch); core.setConfig(c); }
/** the relay next to a Community server's api.php (pure) */
function relayUrl(communityUrl) {
  const u = String(communityUrl || "https://tigerart.com.au/bitgen-community/api.php");
  return /\/api\.php(\?.*)?$/i.test(u) ? u.replace(/\/api\.php(\?.*)?$/i, "/relay.php") : u.replace(/\/?$/, "/relay.php");
}
function url() {
  const r = cfg();
  if (r.url) return String(r.url);
  let c = ""; try { c = require("./community").state().url; } catch { c = ""; }
  return relayUrl(c);
}
// 2.914.0: Settings ▸ General ▸ Remote access ▾ (lib/remoteAway.js) says whether the relay is the way in when away
function isOn() { return require("./remoteAway").mode() === "relay"; }
function setOn(on) { require("./remoteAway").set({ mode: on ? "relay" : "none" }); return status(); }

/** may the app use the relay now? -> "" or why not (pure: s = remote.relaySession(), now) */
function awayWhy(s, now) {
  if (!s) return "no paired bitGen app";
  if (!s.lanSeen || now - s.lanSeen > box.AWAY_MS) return "the app has not been on this PC's Wi-Fi for 6 hours - connect at home once";
  return "";
}
function forApp() {
  const r = cfg(), s = remote.relaySession();
  if (!isOn() || !r.id || !s) return null;
  return { url: url(), id: r.id, key: s.rk, away_hours: box.AWAY_MS / 3600000 };
}
function status(now = Date.now()) {
  const r = cfg(), s = remote.relaySession();
  return { on: isOn(), url: url(), registered: !!(r.id && r.secret), polling: st.polling, last_ok: st.last_ok, last_error: st.last_error,
    answered: st.answered, app: !!s, app_home: !!(s && now - s.lanSeen < HOME_SEEN && s.lanSeen > lastRelayed), lan_seen: s ? s.lanSeen : 0,
    away_left: s && s.lanSeen ? Math.max(0, box.AWAY_MS - (now - s.lanSeen)) : 0 };
}

async function call(a, opts) {
  const o = opts || {}, r = cfg();
  const h = Object.assign({}, o.headers || {});
  if (o.auth) { h["X-Relay-Id"] = r.id; h.Authorization = "Bearer " + r.secret; h["X-Relay-Secret"] = r.secret; }   // some hosts drop Authorization before PHP
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), o.timeout || 20000);
  try {
    const res = await fetch(url() + "?a=" + a + (o.q || ""), { method: "POST", headers: h, body: o.body, signal: ctl.signal });
    let j = {}; try { j = await res.json(); } catch { j = {}; }
    if (!res.ok) { const e = new Error(j.error || ("the relay answered " + res.status)); e.status = res.status; throw e; }
    return j;
  } finally { clearTimeout(t); }
}
let regFailed = 0;
async function ensureRegistered() {
  const r = cfg();
  if (r.id && r.secret) return;
  // 2.914.0 (Tim: "only tigerart admin will be able to use it this relay through tigerart"): the relay lets in only its own
  // Community admins (this PC's 💬 Community sign-in) or whoever has its relay key (your own hosting's relay.php)
  let token = ""; try { token = require("./community").token(); } catch { token = ""; }
  let j;
  try { j = await call("register", { body: JSON.stringify({ token, key: r.key || "" }), headers: { "Content-Type": "application/json" } }); }
  catch (e) { regFailed = Date.now(); e.register = true; throw e; }
  if (!j.id || !j.secret) throw new Error("the relay gave no id");
  saveRelay({ id: j.id, secret: j.secret, registered_at: Date.now() });
}

/** this studio itself, as the app over the network -> {status, headers, body} (the body capped at MAX_BODY) */
function self(head, body) {
  return new Promise((resolve) => {
    const h = { "x-forwarded-for": "relay", "x-bitgen-via": "relay" };
    for (const k of PASS_HEADERS) if (head.h && head.h[k] != null) h[k] = String(head.h[k]);
    if (body && body.length) h["content-length"] = String(body.length);
    const req = http.request({ host: "127.0.0.1", port: port(), method: String(head.m || "GET").toUpperCase(), path: head.p, headers: h, timeout: 60000 }, (res) => {
      const parts = []; let n = 0, big = false;
      res.on("data", (c) => { n += c.length; if (n > box.MAX_BODY) { big = true; res.destroy(); } else parts.push(c); });
      const done = () => {
        if (big) return resolve({ status: 413, headers: { "content-type": "application/json" }, body: Buffer.from(JSON.stringify({ error: "too big for one relay box - the app asks for it in parts", size: +res.headers["content-length"] || 0, too_big: true })) });
        const bh = {}; for (const k of BACK_HEADERS) if (res.headers[k] != null) bh[k] = String(res.headers[k]);
        resolve({ status: res.statusCode || 502, headers: bh, body: Buffer.concat(parts) });
      };
      res.on("end", done); res.on("close", () => { if (big) done(); });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => resolve({ status: 502, headers: { "content-type": "application/json" }, body: Buffer.from(JSON.stringify({ error: "bitGen Studio did not answer: " + e.message })) }));
    if (body && body.length) req.write(body);
    req.end();
  });
}
/** one sealed request -> the sealed answer (null = not ours / not answerable: nothing is sent back) */
async function handle(rid, b64, now = Date.now()) {
  const s = remote.relaySession();
  if (!s) return null;
  const plain = box.open(s.rk, box.AAD_REQ, Buffer.from(String(b64 || ""), "base64"));
  const u = plain && box.unpack(plain);
  if (!u) return null;
  const head = u.head, reply = (status, obj, h) => box.seal(s.rk, box.AAD_RES, box.pack({ v: 1, n: head.n, s: status, h: h || { "content-type": "application/json" } }, Buffer.from(JSON.stringify(obj))));
  const stale = box.fresh(head, now, seen);
  if (stale) return stale === "already answered" ? null : reply(400, { error: "the request was refused: " + stale });
  const why = awayWhy(s, now);
  if (why) return reply(403, { error: why, away: true });
  lastRelayed = now;                                                       // away: not "on this Wi-Fi now" any more
  const r = await self(head, u.body);
  return box.seal(s.rk, box.AAD_RES, box.pack({ v: 1, n: head.n, s: r.status, h: r.headers }, r.body));
}

async function once() {
  const now = Date.now(), s = remote.relaySession();
  if (!isOn() || !remote.enabled() || awayWhy(s, now)) { st.polling = false; return IDLE_MS; }
  await ensureRegistered();
  st.polling = true;
  const active = now - lastTraffic < ACTIVE_FOR;
  const j = await call("poll", { auth: true, q: "&wait=" + (active ? 8 : 0), body: "", timeout: 30000 });
  st.last_ok = Date.now(); st.last_error = "";
  const reqs = Array.isArray(j.reqs) ? j.reqs : [];
  if (reqs.length) lastTraffic = Date.now();
  await Promise.all(reqs.map(async (q) => {
    try {
      const ans = await handle(q.rid, q.box);
      if (ans) { await call("answer", { auth: true, q: "&rid=" + encodeURIComponent(q.rid), body: ans, headers: { "Content-Type": "application/octet-stream" }, timeout: 60000 }); st.answered++; }
    } catch (e) { st.last_error = String(e.message || e); }
  }));
  if (reqs.length || active) return 0;
  return now - s.lanSeen < HOME_SEEN && s.lanSeen > lastRelayed ? HOME_MS : IDLE_MS;
}
function schedule(ms) { if (timer) clearTimeout(timer); timer = setTimeout(loop, ms); if (timer.unref) timer.unref(); }
async function loop() {
  if (running) return;
  running = true;
  let next = IDLE_MS;
  try { next = await once(); }
  catch (e) {
    st.last_error = String(e.message || e); st.polling = false; next = BACKOFF_MS;
    if (e.register) next = 5 * 60 * 1000;                                     // refused (not this relay's admin): not every 30 s
    else if (e.status === 403) saveRelay({ id: "", secret: "" });             // the relay forgot this PC: register again
  }
  running = false;
  schedule(next);
}
/** register now (pairing) - the app gets the relay in its first answer */
async function prepare() { if (isOn() && remote.enabled()) { await ensureRegistered(); kick(); } }
function kick() {
  regFailed = 0; lastTraffic = Date.now(); schedule(50); }
function start() { if (!timer) schedule(3000); }
function stop() { if (timer) clearTimeout(timer); timer = null; }
module.exports = { relayUrl, awayWhy, forApp, status, setOn, start, stop, kick, prepare, handle, self, PASS_HEADERS,
  _setUrl: (u) => saveRelay({ url: u, id: "", secret: "" }),
  _once: once, _seen: seen };
