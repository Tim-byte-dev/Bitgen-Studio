// bitGen Studio — lib/remote.js: pairing, sealed cookies, ONE active device.
// Pure functions, no browser and no server. Run: node scripts/test-remote.js
const path = require("path");
const core = require(path.join(__dirname, "..", "lib", "core"));
const R = require(path.join(__dirname, "..", "lib", "remote"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

// --- the port stays shut until the user opens it --------------------------
R.setEnabled(false);
check("remote is OFF by default: the server stays on loopback",
      R.bindHost() === "127.0.0.1" && R.enabled() === false, R.bindHost());
check("a pairing code cannot be redeemed while remote is off",
      !!R.redeem(R.mintPairing().code, "phone").error);
R.setEnabled(true);
check("turning it on is what opens the LAN bind, nothing else",
      R.bindHost() === "0.0.0.0");

// --- the sealed cookie ----------------------------------------------------
const sealed = R.seal({ sid: "abc", exp: 99 });
check("seal/open round-trips", (R.open(sealed) || {}).sid === "abc");
check("a tampered cookie fails the GCM tag instead of being trusted",
      R.open(sealed.slice(0, -2) + (sealed.slice(-1) === "A" ? "BB" : "AA")) === null);
check("junk opens as null, it never throws", R.open("not-a-cookie") === null && R.open("") === null);
check("the sealed value leaks nothing in the clear",
      !sealed.includes("abc") && !sealed.includes("sid"));

// --- pairing is one-shot and short-lived ----------------------------------
R._reset();
const p1 = R.mintPairing();
const r1 = R.redeem(p1.code, "Pixel 8", "192.168.1.50");
check("a fresh code pairs the phone and returns a cookie", !!r1.cookie && !r1.error, r1.error);
check("the SAME code cannot be used twice (one-shot)",
      !!R.redeem(p1.code, "attacker").error);
R._reset();
const p2 = R.mintPairing();
R.mintPairing();                       // minting again must kill the old QR
check("minting a new code invalidates the one still on screen",
      !!R.redeem(p2.code, "stale QR").error);
R._reset();
const p3 = R.mintPairing(1000);
check("an expired code is refused",
      !!R.redeem(p3.code, "late", "", 1000 + R.PAIR_TTL_MS + 1).error);

// --- exactly one active connection ---------------------------------------
R._reset();
const a = R.redeem(R.mintPairing().code, "phone A");
const cookieA = `bg_remote=${encodeURIComponent(a.cookie)}`;
check("the paired phone is recognised on its next request",
      (R.sessionOf(cookieA) || {}).device === "phone A");
const b = R.redeem(R.mintPairing().code, "phone B");
const cookieB = `bg_remote=${encodeURIComponent(b.cookie)}`;
check("pairing a second phone takes over: B is live",
      (R.sessionOf(cookieB) || {}).device === "phone B");
check("...and A is evicted the moment B pairs (ONE active connection)",
      R.sessionOf(cookieA) === null);
check("a cookie for a session that has been revoked stops working",
      (R.revoke(), R.sessionOf(cookieB)) === null);
R._reset();
const c = R.redeem(R.mintPairing().code, "phone C");
check("an expired session cookie is refused",
      R.sessionOf(`bg_remote=${encodeURIComponent(c.cookie)}`,
                  Date.now() + R.SESSION_TTL_MS + 1000) === null);
check("no cookie at all is simply not a session",
      R.sessionOf("") === null && R.sessionOf("other=1") === null);
R.setEnabled(false);
check("switching remote off drops the live session immediately",
      R.sessionOf(`bg_remote=${encodeURIComponent(c.cookie)}`) === null);
R.setEnabled(true);

// --- the failure Tim hit: a link pointing at a closed port -----------------
// The listening socket is made once, at startup. Ticking the box later changes
// the setting but cannot open the port, and a QR for an address nothing is
// bound to fails on the phone with no clue as to why.
R.setEnabled(false);
R._setBound("");
R.bindHost();                              // as server.js does, once, at listen
check("a process that started with remote OFF knows it is loopback-only",
      R.boundHost() === "127.0.0.1");
R.setEnabled(true);
check("...and turning the setting on mid-run reports that a restart is needed",
      R.restartNeeded() === true);
R._setBound("");
R.bindHost();                              // a restart, with the setting on
check("after a restart the port is really open and no warning is raised",
      R.boundHost() === "0.0.0.0" && R.restartNeeded() === false);
check("restartNeeded is never true while remote access is off",
      (R.setEnabled(false), R.restartNeeded()) === false);
R.setEnabled(true); R._setBound("0.0.0.0");

// --- which of several addresses -------------------------------------------
const MANY = {
  "vEthernet (WSL)": [{ address: "172.28.16.1", family: "IPv4", internal: false }],
  "VirtualBox Host-Only": [{ address: "192.168.56.1", family: "IPv4", internal: false }],
  "Wi-Fi": [{ address: "192.168.1.50", family: "IPv4", internal: false }],
};
const cands = R.lanCandidates(MANY);
check("a virtual adapter never outranks the real Wi-Fi, even on a 192.168 address",
      cands[0].ip === "192.168.1.50", cands.map((c) => c.ip));
check("the virtual ones are still offered, and flagged as virtual",
      cands.length === 3 && cands.filter((c) => c.virtual).length === 2, cands);
check("each candidate names its adapter, so the user can tell which is which",
      cands.every((c) => !!c.adapter));

// --- the address the QR points at ----------------------------------------
const IF = {
  lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
  eth0: [{ address: "172.20.0.9", family: "IPv4", internal: false }],
  wlan0: [{ address: "192.168.1.50", family: "IPv4", internal: false },
          { address: "fe80::1", family: "IPv6", internal: false }],
};
check("the LAN address prefers the home-network 192.168.x the phone is on",
      R.lanAddress(IF) === "192.168.1.50", R.lanAddress(IF));
check("loopback and IPv6 are never offered to the phone",
      R.lanAddress({ lo: IF.lo }) === "" && R.lanAddress({}) === "");
check("the link carries the code and the port",
      R.linkFor("CODE1", 8311, "192.168.1.50")
      === "http://192.168.1.50:8311/remote?t=CODE1");
check("no LAN address means no link, rather than a QR pointing nowhere",
      R.linkFor("CODE1", 8311, "") === "");

// --- status ---------------------------------------------------------------
R._reset();
R.redeem(R.mintPairing().code, "phone D");
const st = R.status();
check("status reports the connected device without leaking the session id",
      st.connected === true && st.device === "phone D"
      && !JSON.stringify(st).includes("sid"), st);

R.setEnabled(false);
console.log("==============================");
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
