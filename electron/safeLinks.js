// bitGen Studio — electron/safeLinks.js (2.926.0): WHAT THE DESKTOP WINDOW HANDS TO WINDOWS, AND WHERE IT MAY GO ITSELF.
// docs/bitgen-studio-threat-model.md TM-004 / TM-005: window.open used to pass ANY link to shell.openExternal - a link in
// an email or a web page with file:, search-ms:, ms-msdt: or a custom scheme makes Windows start that scheme's program.
// Only web and mail links go out now. And the app window itself stays on the studio: a link without target="_blank" used
// to load the other site INSIDE the app window, with the app's h3shell (screen capture, relaunch) given to it.
//   external(url)          true for http: / https: / mailto: links (what goes to the browser / mail program)
//   isApp(url, port)       true for the studio's own page (127.0.0.1 / localhost / [::1] on its port)        pure (scripts/test-926.js)
"use strict";
function parse(u) { try { return new URL(String(u || "")); } catch { return null; } }
function external(url) { const u = parse(url); return !!u && /^(https?|mailto):$/.test(u.protocol); }
function isApp(url, port) {
  const u = parse(url);
  if (!u || u.protocol !== "http:") return false;
  return /^(127\.0\.0\.1|localhost|\[::1\])$/i.test(u.hostname) && String(u.port || "80") === String(port);
}
module.exports = { external, isApp };
