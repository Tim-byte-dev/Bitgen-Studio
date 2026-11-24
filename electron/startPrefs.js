// bitGen Studio — electron/startPrefs.js (2.940.0): what the shell needs to know before the server is up.
// Tim (verbatim): "in the general tab add a checkbox to hide splash screen" - Settings ▸ General ▸ "Hide the splash screen"
// saves ui.no_splash (POST /api/config); the shell reads it here from custom.settings (over misc/default.settings).
"use strict";
const fs = require("fs");
const path = require("path");
function read(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")) || {}; } catch (e) { return {}; } }
/** true when Settings ▸ General says no splash */
function noSplash(root) {
  const c = read(path.join(root, "custom.settings")), d = read(path.join(root, "misc", "default.settings"));
  const ui = Object.assign({}, d.ui || {}, c.ui || {});
  return ui.no_splash === true;
}
module.exports = { noSplash };
