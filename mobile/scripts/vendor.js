// bitGen app - copies the one browser library the app uses (jsQR, Apache-2.0: reads the pairing QR from a photo) into
// www/vendor/, so the app has no bundler and nothing is fetched at run time.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const out = path.join(root, "www", "vendor");
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(root, "node_modules", "jsqr", "dist", "jsQR.js"), path.join(out, "jsQR.js"));
const lic = path.join(root, "node_modules", "jsqr", "LICENSE");
if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(out, "jsQR.LICENSE"));
// 2.912.0: www/lib/build.js - which build this is (bitGen's 🔨 Build writes its own id first: BG_BUILD_ID / BG_STUDIO_VERSION),
// for the app's ⬆ Update check against the APK on the PC
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const build = { id: process.env.BG_BUILD_ID || "dev", version: pkg.version, studio: process.env.BG_STUDIO_VERSION || "", at: Date.now() };
fs.writeFileSync(path.join(root, "www", "lib", "build.js"), "/* made by scripts/vendor.js - not in git */\nwindow.BG_BUILD = " + JSON.stringify(build) + ";\n");
// 2.924.0: www/lib/theme.js - bitGen's 🔨 Build writes the studio's theme there first (lib/apkTheme.js); a build without
// bitGen (Android Studio, npx cap sync) gets the app's own look
const theme = path.join(root, "www", "lib", "theme.js");
if (!fs.existsSync(theme)) fs.writeFileSync(theme, "/* bitGen app - the app's own look - made per build, not in git */\nwindow.BG_THEME = null;\n");
console.log("vendored: www/vendor/jsQR.js, www/lib/build.js (" + build.id + "), www/lib/theme.js");
