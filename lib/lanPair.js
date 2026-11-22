// bitGen Studio — lib/lanPair.js (2.913.0): 📶 THE APP FINDS THIS PC ON THE WI-FI AND CONNECTS - NO QR, NO LINK.
//
// Tim: "if my phone is on the same wifi connection as the desktop, add a button to connect from bitgen studio in app. i am
// having trouble scanning the qr code and copying the link ... send the link to the phone and connect automaticlly when i
// start the app". The app looks for bitGen Studio on its Wi-Fi (GET /api/remote/hello on each address of its network) and
// asks to connect: POST /api/remote/lanpair {device} (open - lib/remoteGuard.js). Anyone on the Wi-Fi could ask, so this PC
// decides:
//   * 📱 Let the app connect (Settings ▸ General ▸ Remote, 5 minutes): the next app that asks is let in at once;
//   * otherwise a bar in the studio says "📱 <phone> (192.168.1.23) wants to connect" - ✔ Allow / ✕ Deny.
// The app waits (GET /api/remote/lanpair/<rid>) and gets its key the moment it is allowed - the same session as a scanned
// code (lib/remote.js startSession: THE device, its relay key for when it is away from the Wi-Fi).
//   ask(device, ip, now) / poll(rid, now) / answer(rid, allow, now) / openWindow(now) / pendingList(now) / status(now)
// Pure enough for scripts/test-913.js (startSession injected through setStart).
"use strict";

const WINDOW_MS = 5 * 60 * 1000;      // 📱 Let the app connect
const ASK_MS = 2 * 60 * 1000;         // an unanswered request is dropped after this
const DONE_MS = 60 * 1000;            // the app has this long to collect its key
const MAX_PENDING = 3;

let windowUntil = 0;
const reqs = new Map();               // rid -> {rid, device, ip, at, state: "pending"|"allowed"|"denied", grant}
let start = (device, ip, now) => require("./remote").startSession(device, ip, now, true);
function setStart(fn) { start = fn; }

const rid = () => require("crypto").randomBytes(12).toString("base64url");
function tidy(now) {
  for (const [k, r] of reqs) if ((r.state === "pending" && now - r.at > ASK_MS) || (r.state !== "pending" && now - (r.doneAt || r.at) > DONE_MS)) reqs.delete(k);
}
function grant(r, now) {
  const s = start(r.device, r.ip, now);
  if (!s || s.error) { r.state = "denied"; r.why = (s && s.error) || "could not connect"; }
  else { r.state = "allowed"; r.grant = { token: s.cookie, expires_at: s.expires_at }; }
  r.doneAt = now;
  return r;
}
/** an app asks -> {rid, state} (allowed at once while the 📱 window is open) */
function ask(device, ip, now = Date.now()) {
  tidy(now);
  const dev = String(device || "a phone").replace(/[\u0000-\u001f<>]/g, "").slice(0, 80) || "a phone";
  const addr = String(ip || "").replace(/^::ffff:/, "").slice(0, 60);
  for (const [k, r] of reqs) if (r.state === "pending" && r.ip === addr) reqs.delete(k);   // the same phone asking again
  if ([...reqs.values()].filter((r) => r.state === "pending").length >= MAX_PENDING) return { error: "too many phones are asking - answer them in bitGen Studio first", status: 429 };
  const r = { rid: rid(), device: dev, ip: addr, at: now, state: "pending" };
  reqs.set(r.rid, r);
  if (now <= windowUntil) { windowUntil = 0; grant(r, now); }   // the window lets ONE app in
  return view(r);
}
function view(r) {
  const o = { rid: r.rid, state: r.state };
  if (r.state === "allowed") Object.assign(o, r.grant);
  if (r.state === "denied") o.error = r.why || "bitGen Studio said no";
  return o;
}
/** the app waiting -> its state (the key once allowed, given out ONCE) */
function poll(id, now = Date.now()) {
  tidy(now);
  const r = reqs.get(String(id || ""));
  if (!r) return { state: "gone", error: "that request is no longer waiting - ask again" };
  const o = view(r);
  if (r.state !== "pending") reqs.delete(r.rid);
  return o;
}
/** ✔ Allow / ✕ Deny in the studio */
function answer(id, allow, now = Date.now()) {
  tidy(now);
  const r = reqs.get(String(id || ""));
  if (!r || r.state !== "pending") return { error: "that request is no longer waiting", status: 404 };
  if (allow) grant(r, now); else { r.state = "denied"; r.why = "bitGen Studio said no"; r.doneAt = now; }
  return { ok: true, state: r.state, device: r.device, ip: r.ip };
}
function openWindow(now = Date.now()) { windowUntil = now + WINDOW_MS; return status(now); }
function closeWindow() { windowUntil = 0; }
function pendingList(now = Date.now()) {
  tidy(now);
  return [...reqs.values()].filter((r) => r.state === "pending").map((r) => ({ rid: r.rid, device: r.device, ip: r.ip, at: r.at }));
}
function status(now = Date.now()) {
  return { window_open: now <= windowUntil, window_left: Math.max(0, Math.round((windowUntil - now) / 1000)), pending: pendingList(now) };
}
module.exports = { WINDOW_MS, ASK_MS, ask, poll, answer, openWindow, closeWindow, pendingList, status, setStart,
  _reset: () => { reqs.clear(); windowUntil = 0; } };
