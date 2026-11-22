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
console.log("vendored: www/vendor/jsQR.js");
