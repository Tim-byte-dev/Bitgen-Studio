// bitGen Studio — lib/security.js (2.940.0): 🔒 LOCAL SECURITY - the startup sign-in and the name the user goes by.
//
// Tim (verbatim): "add a security tab to settings. explain that it is local security,not saved online. add a checkbox to ask
// for username and password on startup. add inputs for username and password and preferred name. when user talks to llm ,
// llm will talk to them by their preferred name in a friendly manner."
//
//   settings/security.json  {v:1, ask, user, name, email, salt, hash} - on this PC only (settings/ is never in the repo or a zip);
//                           the password is never kept, only its scrypt hash with a random salt
//   pub()                   what the page may see: {ask, user, name, email, hasPassword} - never the hash or the salt
//   save(b)                 {ask, user, name, email, password} - a blank password keeps the one there; asking needs both
//   2.941.0 (Tim: "maybe add email (optional) to security and a join community button?"): the email is optional, kept here
//   only; the page copies it into 💬 Community's join form, and it goes online only if the user presses Join there.
//   login(user, password)   true when they match (the username ignores case)
//   displayName()           the preferred name, else the username, else ""
//   nameNote()              the line the chat LLM is given: call the user by that name, warmly
// Pure (Node: scripts/test-940.js, test-941.js): clean(), cleanEmail(), hashOf(), check(), note(name).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let DIR = null;                                   // the tests point it at a temp folder
function dir() { return DIR || path.join(require("./core").BASE, "settings"); }
function file() { return path.join(dir(), "security.json"); }
function useDir(d) { DIR = d || null; }

/** a name or username: letters, numbers, spaces, ' . - _ ; at most 40 */
function clean(s) { return String(s == null ? "" : s).replace(/[^\p{L}\p{N} '._-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40); }
/** an email address, or "" (optional - a wrong one is refused, not kept) */
function cleanEmail(s) {
  const e = String(s == null ? "" : s).trim().slice(0, 120);
  if (!e) return "";
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(e)) throw new Error("that email address doesn't look right");
  return e;
}
function hashOf(password, salt) { return crypto.scryptSync(String(password), Buffer.from(salt, "hex"), 32).toString("hex"); }
function check(password, salt, hash) {
  if (!salt || !hash) return false;
  const a = Buffer.from(hashOf(password, salt), "hex"), b = Buffer.from(String(hash), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function load() {
  try { const j = JSON.parse(fs.readFileSync(file(), "utf8")); return j && typeof j === "object" ? j : {}; } catch (e) { return {}; }
}
function write(j) {
  fs.mkdirSync(dir(), { recursive: true });
  const f = file(), tmp = f + ".part";
  fs.writeFileSync(tmp, JSON.stringify(Object.assign({ v: 1, note: "bitGen Studio's local sign-in - this PC only. Delete this file to remove the sign-in." }, j), null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, f);
}
function pub(j) {
  j = j || load();
  return { ask: !!(j.ask && j.user && j.hash), user: j.user || "", name: j.name || "", email: j.email || "", hasPassword: !!j.hash };
}
function save(b) {
  b = b || {};
  const j = load();
  if (b.name != null) j.name = clean(b.name);
  if (b.user != null) j.user = clean(b.user);
  if (b.email != null) j.email = cleanEmail(b.email);
  if (b.password != null && String(b.password) !== "") {
    if (String(b.password).length < 4) throw new Error("the password needs at least 4 characters");
    j.salt = crypto.randomBytes(16).toString("hex"); j.hash = hashOf(b.password, j.salt);
  }
  if (b.ask != null) j.ask = b.ask === true || b.ask === "1" || b.ask === "true";
  if (j.ask && !j.user) throw new Error("type a username first");
  if (j.ask && !j.hash) throw new Error("type a password first");
  delete j.v; delete j.note;
  write(j);
  return pub(j);
}
function login(user, password) {
  const j = load();
  if (!(j.ask && j.user && j.hash)) return true;                       // nothing to sign in to
  return clean(user).toLowerCase() === String(j.user).toLowerCase() && check(password || "", j.salt, j.hash);
}
function displayName() { const j = load(); return j.name || j.user || ""; }
/** the chat LLM's line: the user's name, used warmly - now and then, not in every sentence */
function note(name) {
  const n = clean(name);
  return n ? "\n\nThe user's name is " + n + ". Talk to them as " + n + " in a warm, friendly way - greet them by name and use it now and then, not in every sentence." : "";
}
function nameNote() { try { return note(displayName()); } catch (e) { return ""; } }

module.exports = { clean, cleanEmail, hashOf, check, load, pub, save, login, displayName, note, nameNote, useDir, file };
