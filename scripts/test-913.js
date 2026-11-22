#!/usr/bin/env node
// bitGen Studio 2.913.0 - 📶 the app finds the PC on the Wi-Fi and connects with no QR (Tim: "i am having trouble scanning the
// qr code and copying the link ... connect automaticlly when i start the app") + ☁ the relay for 6 hours away from the Wi-Fi
// ("stay connected for 6 hours if wifi connection is lost" -> "Relay via tigerart.com.au"). Run: node scripts/test-913.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

(async () => {
  // the sealed box - the studio's side and the app's side are one format
  const B = require("../lib/relayBox");
  const N = require("../mobile/www/lib/net.js");
  const key = B.newKey();
  const packed = B.pack({ v: 1, n: "abcdefghijkl", p: "/x" }, Buffer.from("body!"));
  const u = B.unpack(packed);
  check("pack / unpack: head + body", u && u.head.p === "/x" && u.body.toString() === "body!", u);
  check("unpack refuses a short or a lying length", B.unpack(Buffer.from([0, 0])) === null && B.unpack(Buffer.from([0, 0, 1, 0, 1])) === null);
  const sealed = B.seal(key, B.AAD_REQ, packed);
  check("seal / open: the same bytes back", B.open(key, B.AAD_REQ, sealed).equals(packed));
  check("a request box does not open as a reply (AAD)", B.open(key, B.AAD_RES, sealed) === null);
  const bent = Buffer.from(sealed); bent[20] ^= 1;
  check("a changed box does not open (GCM tag)", B.open(key, B.AAD_REQ, bent) === null);
  check("another key does not open it", B.open(B.newKey(), B.AAD_REQ, sealed) === null);
  const appBox = await N.seal(key, "bgr1-req", N.pack({ v: 1, n: "nonce-from-app", t: 5, m: "GET", p: "/api/app/info", h: { "x-bitgen-key": "K" } }, new Uint8Array([1, 2, 3])));
  const fromApp = B.unpack(B.open(key, B.AAD_REQ, Buffer.from(appBox)));
  check("the app's box (WebCrypto) opens on the PC", fromApp && fromApp.head.p === "/api/app/info" && fromApp.head.h["x-bitgen-key"] === "K" && fromApp.body.length === 3, fromApp && fromApp.head);
  const pcBox = B.seal(key, B.AAD_RES, B.pack({ v: 1, n: "nonce-from-app", s: 206, h: { "content-range": "bytes 0-2/10" } }, Buffer.from("abc")));
  const toApp = N.unpack(await N.open(key, "bgr1-res", new Uint8Array(pcBox)));
  check("the PC's reply opens in the app", toApp && toApp.head.s === 206 && new TextDecoder().decode(toApp.body) === "abc", toApp && toApp.head);
  check("…and not with the wrong AAD", (await N.open(key, "bgr1-req", new Uint8Array(pcBox))) === null);
  const now = Date.now(), seen = new Map(), h = { v: 1, n: N.nonce(), t: now, m: "GET", p: "/api/jobs" };
  check("fresh: a new request yes, the same nonce again no (a replayed box)", B.fresh(h, now, seen) === "" && B.fresh(h, now, seen) === "already answered");
  check("fresh: older than 2 minutes / not a path / no nonce = refused", /too old/.test(B.fresh(Object.assign({}, h, { n: N.nonce(), t: now - 3 * 60000 }), now, seen))
    && B.fresh(Object.assign({}, h, { n: N.nonce(), p: "http://x" }), now, seen) !== "" && B.fresh(Object.assign({}, h, { n: "" }), now, seen) !== "");
  check("6 hours away", B.AWAY_MS === 6 * 3600 * 1000 && N.AWAY_MS === B.AWAY_MS);

  // 📶 the Wi-Fi
  const hs = N.hostsOf("192.168.1.23", 24);
  check("hostsOf: the /24 without the phone itself (253 addresses)", hs.length === 253 && !hs.includes("192.168.1.23") && hs[0] === "192.168.1.1" && hs[252] === "192.168.1.254", hs.length);
  check("hostsOf: a wider network = the /24 around the phone; a /25 = its half; nonsense = none",
    N.hostsOf("10.0.5.9", 16).length === 253 && N.hostsOf("10.0.5.200", 25).length === 125 && N.hostsOf("10.0.5.200", 25)[0] === "10.0.5.129" && N.hostsOf("nope", 24).length === 0);
  const asked = [];
  const found = await N.scan(hs, (x) => { asked.push(x); return new Promise((r) => setTimeout(() => r(x === "192.168.1.77" ? { app: "bitGen Studio" } : null), 2)); }, 16);
  check("scan: the one that answers, many at a time", found && found.host === "192.168.1.77" && asked.length < 253, [found, asked.length]);
  check("scan: nobody = null", (await N.scan(["a", "b"], () => null, 4)) === null);

  const L = require("../lib/lanPair");
  let started = 0;
  L.setStart((dev, ip) => { started++; return { cookie: "TOKEN-" + started, expires_at: 99 }; });
  L._reset();
  const t0 = 1000000;
  const a1 = L.ask("Galaxy Z Fold (bitGen app)", "::ffff:192.168.1.40", t0);
  check("ask: waits for the PC (pending), the phone listed with its address", a1.state === "pending" && !a1.token && L.pendingList(t0)[0].ip === "192.168.1.40", [a1, L.pendingList(t0)]);
  check("poll while waiting: pending, no key", L.poll(a1.rid, t0 + 1000).state === "pending" && !L.poll(a1.rid, t0 + 1000).token);
  check("✔ Allow -> the app gets its key ONCE", L.answer(a1.rid, true, t0 + 2000).state === "allowed" && L.poll(a1.rid, t0 + 2500).token === "TOKEN-1" && L.poll(a1.rid, t0 + 2600).state === "gone");
  const a2 = L.ask("Other phone", "192.168.1.41", t0);
  L.answer(a2.rid, false, t0 + 100);
  check("✕ Deny -> said, no key", L.poll(a2.rid, t0 + 200).state === "denied" && started === 1);
  L.openWindow(t0);
  const a3 = L.ask("Fold", "192.168.1.40", t0 + 1000), a4 = L.ask("Someone else", "192.168.1.66", t0 + 2000);
  check("📱 Let the app connect: the next app is let in at once - only ONE", a3.state === "allowed" && a3.token === "TOKEN-2" && a4.state === "pending" && !L.status(t0 + 2000).window_open, [a3, a4]);
  check("an unanswered ask is dropped after 2 minutes", L.poll(a4.rid, t0 + 2000 + 2 * 60000 + 1).state === "gone");
  L._reset();
  const s1 = L.ask("A", "1.1.1.1", t0); L.ask("A again", "1.1.1.1", t0 + 5);
  L.ask("B", "1.1.1.2", t0); L.ask("C", "1.1.1.3", t0);
  check("the same phone asking again replaces its ask; 3 waiting at most", L.poll(s1.rid, t0 + 10).state === "gone" && L.ask("D", "1.1.1.4", t0 + 20).status === 429);
  L._reset();
  check("the window lasts 5 minutes", L.openWindow(t0).window_left === 300 && !L.status(t0 + 300001).window_open);
  L._reset();

  // ☁ the relay
  const R = require("../lib/relayLink");
  check("relayUrl: beside the Community server's api.php", R.relayUrl("https://tigerart.com.au/bitgen-community/api.php") === "https://tigerart.com.au/bitgen-community/relay.php"
    && R.relayUrl("https://example.org/bgc/") === "https://example.org/bgc/relay.php" && R.relayUrl("") === "https://tigerart.com.au/bitgen-community/relay.php");
  check("awayWhy: no app / on the Wi-Fi 5 h ago = fine / 7 h ago = connect at home", /no paired/.test(R.awayWhy(null, now))
    && R.awayWhy({ lanSeen: now - 5 * 3600000 }, now) === "" && /6 hours/.test(R.awayWhy({ lanSeen: now - 7 * 3600000 }, now)));
  check("only the app's own headers go to the studio (no cookie, no forwarded address)", R.PASS_HEADERS.join() === "content-type,range,x-bitgen-key,x-bitgen-sampler,accept");
  const G = require("../lib/remoteGuard");
  check("guard: the Wi-Fi ask + its wait are open, the PC's own answers are not", G.isOpen("POST", "/api/remote/lanpair") && G.isOpen("GET", "/api/remote/lanpair/" + "a".repeat(16))
    && !G.isOpen("GET", "/api/remote/lanpair") && !G.isOpen("POST", "/api/remote/lanpair/answer") && !G.isOpen("POST", "/api/remote/lanpair/window") && !G.isOpen("POST", "/api/remote/relay"));
  const gs = src("lib/remoteGuard.js");
  check("guard: the app on the Wi-Fi restarts the 6 hours; a relayed / tunnelled request does not", /if \(!via\) remote\.markLan\(\)/.test(gs));
  const rm = require("../lib/remote");
  check("lib/remote: startSession (a code or 📶), markLan, relaySession", typeof rm.startSession === "function" && typeof rm.markLan === "function" && typeof rm.relaySession === "function");
  check("the relay key + this PC's relay secret are kept encrypted (settings/keys.json)", require("../lib/secrets").PATHS.includes("remote.active.rk") && require("../lib/secrets").PATHS.includes("remote.relay.secret"));
  const rl = src("routes/lanPair.js");
  check("routes: the window, Allow / Deny and the relay switch are this PC's only; asking is refused through the relay",
    /lanpair\/window", local/.test(rl) && /lanpair\/answer", local/.test(rl) && /\/api\/remote\/relay", local/.test(rl) && (rl.match(/viaRelay\(req\)\) return res\.status\(403\)/g) || []).length === 2);
  check("the pairing answers carry the relay (code, 📶, /api/app/info)", /relay\b/.test(src("routes/remote.js")) && /relay: await relayFor\(\)/.test(rl) && /relay \}\)/.test(src("routes/appApi.js")));
  check("routes/index.js mounts it (not server.js)", /require\("\.\/lanPair"\)\.mount\(app\)/.test(src("routes/index.js")) && !/lanPair/.test(src("misc/server.js")));

  // the relay server (community/)
  const php = src("community/lib/relay.php"), ep = src("community/relay.php");
  check("relay.php: info / register / poll / answer / send; sealed boxes only; no database", /a === 'register'/.test(ep) && /a === 'send'/.test(ep) && /'poll' \|\| \$a === 'answer'/.test(ep) && !/q\(|PDO/.test(php));
  check("relay.php: the PC's secret checked as a hash; waits capped (8 s poll, 25 s send); 2 minutes kept; limits", /hash_equals/.test(php) && /RELAY_POLL_WAIT = 8/.test(php) && /RELAY_SEND_WAIT = 25/.test(php) && /RELAY_KEEP = 120/.test(php) && /RELAY_SENDS = 400/.test(php));
  check("relay.php: HTTPS only, CORS for the app's own origin only", /only answers over HTTPS/.test(ep) && ep.includes("['http://" + "local" + "host', 'https://" + "local" + "host', 'capacitor://" + "local" + "host']"));

  // the studio's screen
  const UI = require("../static/lanpairui.js");
  check("relayLine: off (the dropdown says) / no app / at home / away with the time left / too long away", UI.relayLine({ on: false }) === "" && /ready once/.test(UI.relayLine({ on: true }))
    && /on this Wi-Fi now/.test(UI.relayLine({ on: true, app: true, app_home: true })) && /5 h 30 min more/.test(UI.relayLine({ on: true, app: true, away_left: 5.5 * 3600000 }))
    && /more than 6 hours/.test(UI.relayLine({ on: true, app: true, away_left: 0 })));
  check("Settings: 📱 Let the app connect; the Allow / Deny bar; loaded by index.html (2.914.0: the relay is picked in Remote access ▾)", /lp_window/.test(src("static/lanpairui.js")) && !/id="lp_relay"/.test(src("static/lanpairui.js"))
    && /✔ Allow/.test(src("static/lanpairui.js")) && /\/static\/lanpairui\.js/.test(src("static/index.html")));

  // the app
  const app = src("mobile/www/app.js"), html = src("mobile/www/index.html");
  check("the app: 📶 Find my PC on Wi-Fi, by itself when unpaired; lanpair + waiting for Allow", /id="findBtn"/.test(html) && /function findAndConnect/.test(app) && /\/api\/remote\/lanpair\/" \+ j\.rid/.test(app) && /if \(P\.LanInfo\) findAndConnect\(\)/.test(app));
  check("the app: reach() - the address, else the PC found again by its name, else ☁ the relay", /function reach\(\)/.test(app) && /findPc\(S\.pcName\)/.test(app) && /goRelay\(\)/.test(app));
  check("the app: pictures / videos through the relay in Range parts; api falls back to the relay on a network error", /Range: "bytes=" \+ from/.test(app) && /e\.net && canRelay\(\)/.test(app));
  check("the app loads lib/net.js; the phone's Wi-Fi address plugin is registered (MainActivity) + allowed (manifest)", /lib\/net\.js/.test(html)
    && /registerPlugin\(LanInfoPlugin\.class\)/.test(src("mobile/android/app/src/main/java/au/com/tigerart/bitgen/MainActivity.java"))
    && /@CapacitorPlugin\(name = "LanInfo"\)/.test(src("mobile/android/app/src/main/java/au/com/tigerart/bitgen/LanInfoPlugin.java"))
    && /ACCESS_NETWORK_STATE/.test(src("mobile/android/app/src/main/AndroidManifest.xml")));

  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
