// bitGen Studio — lib/community.js (2.710.0): THE bitGen COMMUNITY - the app's side.
//
// Tim: "i would like to make bitgen a community, can we add a little chat to bitgen like fb - if a user adds a user id
// to bitgen they join the community and can add other users as friends, first they ask, then if approved they become
// friends. this should enable people to get help" - his picks: the server on his Tiger Art hosting (PHP + MariaDB,
// community/ in the repo, community/API.md is the contract) and a public Help room as well as friends' chats.
//
// This Node server is the community server's ONLY client: the page asks routes/community.js, which calls the
// community API here, server-to-server - the user's token never reaches the browser and there is no CORS.
//   state()                       {url, handle, display, joined}   (community.json in the install folder: url, handle,
//                                 display, token - the token is never sent to the page)
//   setUrl(url)                   the community server's api.php address (https only, but http://127.0.0.1 / localhost)
//   join({handle, password, display, first_name, last_name, email, mode: "register" | "login"})   -> the token kept,
//                                 {user, profile}. 2.713.0: joining needs a first + last name and an email address; the
//                                 server emails a code, and until it is typed (verify_email) only the account actions work
//   signOut()                     the token dropped (and logged out on the server)
//   leave(password)               delete_account, then signed out
//   call(action, body)            any of ACTIONS for the signed-in user -> the server's reply ({ok, ...})
//   sendBug(body, {anon})         2.714.0: a 🐞 bug report (lib/bugReport.js payload) to the server's bug_report - as the
//                                 member when signed in with a confirmed email (and not anon), else ANONYMOUSLY (no
//                                 token: it waits for an admin) -> {ok, as: member|anonymous, handle, pending, topic_id, url}
//   whoSends()                    who a bug report would go as now: {as, handle, display, why}
//   packs(action, body)           2.716.0: language packs - pack_list / pack_get signed out too (a guest browses and installs;
//                                 the member's token when there is one: their own uploads, an admin's waiting ones),
//                                 pack_upload / pack_delete as the member -> the server's reply
//   fetchImpl / setBase           tests point them elsewhere
"use strict";
const fs = require("fs");
const path = require("path");

const DEFAULT_URL = "https://tigerart.com.au/bitgen-community/api.php";
// what the page may ask for (everything else - register, login, logout, delete_account - goes through join / signOut / leave)
const ACTIONS = ["info", "me", "search", "friend_request", "friend_respond", "friend_remove", "friends", "send", "poll",
  "history", "block", "unblock", "report", "admin_reports", "admin_delete", "admin_ban",
  "verify_email", "resend_code", "set_profile", "admin_user"];            // 2.713.0
const SITE = "https://tigerart.com.au";                                 // the discussions + account pages (2.713.0)
const TIMEOUT = 15000;
let BASE_DIR = null, fetchImpl = null;
const base = () => BASE_DIR || require("./core").BASE;
const file = () => path.join(base(), "community.json");
function setBase(d) { BASE_DIR = d; }
function setFetch(f) { fetchImpl = f; }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

// 2.748.0: the sign-in token lives in settings/keys.json, encrypted (lib/secrets.js) - community.json keeps the rest
const TOKEN = "community.token";
function keys() { return require("./secrets").store(base()); }
function readState() {
  let j = {};
  try { const x = JSON.parse(fs.readFileSync(file(), "utf8")); j = x && typeof x === "object" ? x : {}; } catch (e) { j = {}; }
  if (j.token) { keys().update([TOKEN], { [TOKEN]: String(j.token) }); delete j.token; writeFile(j); }   // from before: moved
  const t = keys().read()[TOKEN];
  if (t) j.token = t;
  return j;
}
function writeFile(s) {
  const p = file(), tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2)); fs.renameSync(tmp, p);
  try { fs.chmodSync(p, 0o600); } catch (e) { /* Windows */ }
}
function writeState(s) {
  const o = Object.assign({}, s), t = o.token; delete o.token;
  keys().update([TOKEN], { [TOKEN]: t ? String(t) : "" });
  writeFile(o);
}
/** an api.php address that is safe to send a password to: https, or plain http only to this computer */
function cleanUrl(u) {
  const s = String(u || "").trim();
  if (!s) return DEFAULT_URL;
  let x; try { x = new URL(s); } catch (e) { throw bad("not a web address: " + s); }
  const local = /^(127\.0\.0\.1|localhost|\[::1\])$/i.test(x.hostname);
  if (x.protocol !== "https:" && !(x.protocol === "http:" && local)) throw bad("the community server must be https:// (passwords go to it)");
  if (!/\.php$/i.test(x.pathname)) x.pathname = x.pathname.replace(/\/?$/, "/api.php");
  x.search = ""; x.hash = "";
  return x.toString();
}
function state() {
  const s = readState();
  return { url: s.url || DEFAULT_URL, handle: s.handle || "", display: s.display || "", joined: !!(s.token && s.handle) };
}
function setUrl(u) {
  const s = readState(), url = cleanUrl(u);
  if (s.url && s.url !== url && s.token) { delete s.token; }        // another server: signed out there
  s.url = url; writeState(s); return state();
}

/** one request to the community server -> its JSON reply (+ status); never throws for an HTTP error */
async function raw(url, action, body, token, timeout) {
  const f = fetchImpl || globalThis.fetch;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout || TIMEOUT);
  try {
    const b = Object.assign({}, body || {}); if (token) b.token = token;          // the body fallback (hosts that drop Authorization)
    const r = await f(url + "?a=" + encodeURIComponent(action), { method: "POST", signal: ctl.signal,
      headers: Object.assign({ "Content-Type": "application/json", Accept: "application/json", "User-Agent": "bitGen-Studio" }, token ? { Authorization: "Bearer " + token } : {}),
      body: JSON.stringify(b) });
    let j; try { j = await r.json(); } catch (e) { j = { ok: false, error: `the community server answered ${r.status} without JSON - is the address right?` }; }
    if (!j || typeof j !== "object") j = { ok: false, error: "an empty answer" };
    if (!r.ok && j.ok !== false) j.ok = false;
    j.status = r.status; return j;
  } catch (e) {
    return { ok: false, status: 0, error: e.name === "AbortError" ? "the community server did not answer in time" : `cannot reach the community server (${e.message})` };
  } finally { clearTimeout(t); }
}

async function join(o) {
  const a = o || {}, mode = a.mode === "login" ? "login" : "register";
  const handle = String(a.handle || "").trim().toLowerCase(), password = String(a.password || "");
  if (!/^[a-z0-9_.-]{3,24}$/.test(handle)) throw bad("a user ID is 3-24 letters, numbers, _ . -");
  if (password.length < 8) throw bad("the password needs 8 characters or more");
  const s = readState(); if (a.url) s.url = cleanUrl(a.url); if (!s.url) s.url = DEFAULT_URL;
  const body = { handle, password }; if (mode === "register" && a.display) body.display = String(a.display).trim().slice(0, 40);
  if (mode === "register") {
    const first = String(a.first_name || "").trim(), last = String(a.last_name || "").trim(), email = String(a.email || "").trim();
    if (!first || !last) throw bad("type your first and last name (only the admins see them)");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad("type your email address - a code goes to it");
    Object.assign(body, { first_name: first.slice(0, 40), last_name: last.slice(0, 40), email: email.slice(0, 190) });
  }
  const j = await raw(s.url, mode, body, null);
  if (!j.ok || !j.token) throw bad(j.error || "the community server said no", j.status || 502);
  s.handle = j.user && j.user.handle || handle; s.display = j.user && j.user.display || body.display || handle; s.token = j.token;
  writeState(s);
  return { user: j.user || { handle: s.handle, display: s.display }, profile: j.profile || null, mail_sent: !!j.mail_sent, state: state() };
}
async function signOut() {
  const s = readState();
  if (s.token) await raw(s.url || DEFAULT_URL, "logout", {}, s.token);
  delete s.token; writeState(s); return state();
}
async function leave(password) {
  const s = readState(); if (!s.token) throw bad("not signed in", 401);
  const j = await raw(s.url || DEFAULT_URL, "delete_account", { password: String(password || "") }, s.token);
  if (!j.ok) throw bad(j.error || "the community server said no", j.status || 502);
  delete s.token; delete s.handle; delete s.display; writeState(s); return state();
}
async function call(action, body) {
  if (!ACTIONS.includes(action)) throw bad("not a community action: " + action, 404);
  const s = readState();
  if (action !== "info" && !s.token) throw bad("join the community first (💬 ▸ Join)", 401);
  const j = await raw(s.url || DEFAULT_URL, action, body, action === "info" ? null : s.token);
  if (j.status === 401 && action !== "info") { delete s.token; writeState(s); j.signedOut = true; }      // the token is no good any more
  return j;
}

/** who a bug report would be sent as right now */
async function whoSends() {
  const s = readState();
  if (!s.token) return { as: "anonymous", why: "not signed in" };
  const me = await raw(s.url || DEFAULT_URL, "me", {}, s.token);
  if (me.status === 401) { delete s.token; writeState(s); return { as: "anonymous", why: "signed out" }; }
  if (!me.ok) return { as: "anonymous", why: me.error || "the community server did not answer" };
  if (me.profile && me.profile.verified === false) return { as: "anonymous", why: "email not confirmed", handle: me.user.handle };
  return { as: "member", handle: me.user.handle, display: me.user.display };
}
/** a bug report to the community server (90 s: it carries logs and a screenshot) */
async function sendBug(body, opts) {
  const s = readState(), url = s.url || DEFAULT_URL;
  const who = opts && opts.anon ? { as: "anonymous", why: "chosen" } : await whoSends();
  const j = await raw(url, "bug_report", body, who.as === "member" ? s.token : null, 90000);
  if (!j.ok) return { ok: false, status: j.status, error: j.error || "the community server said no", as: who.as };
  let site = SITE; try { site = new URL(url).origin; } catch { /* the default */ }
  return { ok: true, as: who.as, handle: who.as === "member" ? who.handle : null, pending: !!j.pending, topic_id: j.topic_id, bug_id: j.bug_id,
    url: site + "/discussions.php?t=" + j.topic_id };
}

// 2.716.0 (Tim: "if we could have a master pack so users can translate the strings and upload to tigerart for the community
// it would be ideal"): the community's language packs (community/lib/act_packs.php; lib/langPacks.js installs them)
const PACK_ACTIONS = ["pack_list", "pack_get", "pack_upload", "pack_delete"];
async function packs(action, body) {
  if (!PACK_ACTIONS.includes(action)) throw bad("not a language pack action: " + action, 404);
  const s = readState(), url = s.url || DEFAULT_URL, member = action === "pack_upload" || action === "pack_delete";
  if (member && !s.token) throw bad("sign in to 💬 Community first (💬 ▸ Join) - shared packs carry their translator's user ID", 401);
  const slow = action === "pack_upload" || action === "pack_get" ? 120000 : undefined;
  let j = await raw(url, action, body || {}, s.token || null, slow);
  if (j.status === 401 && s.token) {                                     // the token is no good any more
    delete s.token; writeState(s);
    if (!member) j = await raw(url, action, body || {}, null, slow);    // browsing still works signed out
    j.signedOut = true;
  }
  return j;
}
module.exports = { DEFAULT_URL, ACTIONS, PACK_ACTIONS, SITE, packs, sendBug, whoSends, cleanUrl, state, setUrl, join, signOut, leave, call, setBase, setFetch };
