// bitGen Studio — lib/localGuard.js (2.926.0): WHO COUNTS AS "THIS COMPUTER", AND WHAT A PAIRED PHONE MAY NOT CHANGE.
//
// Tim: "are any of these skills worthwhile https://github.com/openai/skills" -> "go with your suggestions": the
// security-threat-model method run on bitGen Studio (docs/bitgen-studio-threat-model.md) found that a request from this PC
// was trusted with no look at WHERE in the browser it came from. A web page open in any browser could reach the studio:
//   TM-001  DNS rebinding (attacker.tld made to point at 127.0.0.1 - the browser then sends Host: attacker.tld) or a plain
//           cross-site POST / link -> POST /api/config {python: "<a program>"} -> the next render runs it.
//   TM-002  a website being edited ran its scripts AS the studio (the 👁 Preview frame) - now an opaque origin, which
//           sends Origin: null, refused here for anything but reading.
//   TM-003  a paired phone (lost or stolen) could change the settings that RUN programs.
// So, for a request on this computer's loopback (lib/remoteGuard.js isLoopback):
//   - Host must be 127.0.0.1 / localhost / [::1] / this PC's own name (any port) - or absent (a script, curl);
//   - an Origin, when sent, must be one of those too ("null" only for GET / HEAD);
//   - /api/* refused when the browser says the request is cross-site (Sec-Fetch-Site) and no good Origin came with it.
// And for a paired device (req.remote): pcOnly(method, path) - the program paths, the LLM's folder + command approvals,
// skills, extensions, setup, updates stay on the PC. (The app never calls these; the 📱 build has its own guard.)
//   hostOk(host)  originOk(origin, method)  localWhy(req) -> "" | why  pcOnly(method, path)     pure (scripts/test-926.js)
"use strict";
const os = require("os");

let NAMES = null;
function names() {
  if (NAMES) return NAMES;
  const n = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  try { const h = String(os.hostname() || "").toLowerCase(); if (h) { n.add(h); n.add(h + ".local"); } } catch { /* no name */ }
  return (NAMES = n);
}
/** "127.0.0.1:8311" / "[::1]:8311" / "localhost" -> its name, lower case */
function nameOf(host) {
  const h = String(host || "").trim().toLowerCase();
  if (!h) return "";
  if (h[0] === "[") { const e = h.indexOf("]"); return e > 0 ? h.slice(0, e + 1) : h; }
  const c = h.lastIndexOf(":");
  return c > 0 && h.indexOf(":") === c ? h.slice(0, c) : h;     // one colon = a port; more = a bare IPv6
}
function hostOk(host) {
  if (host == null || host === "") return true;                  // no Host: not a browser
  return names().has(nameOf(host));
}
function originOk(origin, method) {
  if (origin == null || origin === "") return true;
  const o = String(origin);
  if (o === "null") return /^(GET|HEAD)$/i.test(String(method || "GET"));   // sandboxed frames, file:// - reading only
  let u; try { u = new URL(o); } catch { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  return names().has(u.hostname.toLowerCase()) || names().has("[" + u.hostname.toLowerCase() + "]");
}
/** why a loopback request is refused, or "" (pure apart from os.hostname) */
function localWhy(req) {
  const h = (req && req.headers) || {}, m = String((req && req.method) || "GET").toUpperCase();
  const p = String((req && (req.path || req.url)) || "");
  if (!hostOk(h.host)) return "this address (" + String(h.host).slice(0, 80) + ") is not this computer's - open bitGen Studio at http://127.0.0.1:" + (process.env.H3_PORT || 8311);
  const o = h.origin;
  if (!originOk(o, m)) return "a request from another web page (" + String(o).slice(0, 80) + ") - only bitGen Studio's own page may do this";
  if (/^\/api\//.test(p) && String(h["sec-fetch-site"] || "") === "cross-site" && !(o && o !== "null")) return "a request from another web site - only bitGen Studio's own page may do this";
  return "";
}
/* the settings and actions that run programs on the PC - never from a paired phone */
const PC_ONLY = [
  /^\/api\/config$/,                                   // python, sd_cli, extra_args, engine.comfy (launch line, folder)
  /^\/api\/agent\/(settings|answer|restore)$/,         // the LLM's folder, approving its commands / file changes
  /^\/api\/skills(\/.*)?$/,
  /^\/api\/extensions(\/.*)?$/,                        // installing code
  /^\/api\/setup(\/.*)?$/,
  /^\/api\/update(\/.*)?$/,                            // updates from GitHub, the auto-update switches
  /^\/api\/apk(\/.*)?$/,                               // building / installing the app (routes/apkBuild.js says so too)
];
function pcOnly(method, p) {
  const m = String(method || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;
  return PC_ONLY.some((re) => re.test(String(p || "")));
}
module.exports = { hostOk, originOk, localWhy, pcOnly, nameOf, PC_ONLY, _names: names };
