#!/usr/bin/env node
// bitGen Studio 2.912.0 - 📱 the app onto the phone without debugging (Tim: "debugging is disabled - can we use windows phone
// link?" -> "ok, lets build all 3"): 📲 Install with a QR, ⬆ Update from inside the app, 📂 Show the APK (for Phone Link).
// Run: node scripts/test-912.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const S = require("../lib/apkShare");
const now = Date.UTC(2026, 10, 22, 10, 0, 0);
const t = S.mint(now);
check("mint: a random URL-safe token, 15 minutes", /^[A-Za-z0-9_-]{24}$/.test(t.t) && t.exp - now === 15 * 60 * 1000, t);
check("valid: the token for 15 minutes, not after, not another one", S.valid(t.t, now + 60000) && S.valid(t.t, now + 15 * 60 * 1000)
  && !S.valid(t.t, now + 15 * 60 * 1000 + 1) && !S.valid("x".repeat(24), now) && !S.valid("", now));
const t2 = S.mint(now);
check("a new QR cancels the old one", !S.valid(t.t, now) && S.valid(t2.t, now));
S.cancel();
check("cancel: nothing is valid", !S.valid(t2.t, now));
const w = S.revealCmd("win32", "C:\\bitGen\\mobile\\dist\\bitGen.apk");
check("revealCmd: Explorer with the APK selected / Finder / the folder on Linux", w[0] === "explorer.exe" && w[1][0] === "/select,C:\\bitGen\\mobile\\dist\\bitGen.apk"
  && S.revealCmd("darwin", "/a/b.apk")[1].join(" ") === "-R /a/b.apk" && S.revealCmd("linux", "/a/dist/b.apk")[1][0] === "/a/dist", w);
check("isNewer: a later stamp / an app built by hand (dev) is older / same or older = no / no PC build = no",
  S.isNewer("20261122101500", "20261122100000") && S.isNewer("20261122101500", "dev") && S.isNewer("20261122101500", "")
  && !S.isNewer("20261122101500", "20261122101500") && !S.isNewer("20261101000000", "20261122101500") && !S.isNewer("", "dev"));
check("the app's isNewer is the same rule", /function isNewer\(pc, mine\)|isNewer/.test(src("mobile/www/app.js")) && /\\d\{14\}/.test(src("mobile/www/app.js")));

const K = require("../lib/apkBuild");
const v1 = K.versionCode(Date.UTC(2026, 10, 22, 10, 0)), v2 = K.versionCode(Date.UTC(2026, 10, 22, 10, 1));
check("versionCode: minutes since 2026 - rises every build, an int Android takes for decades", v2 === v1 + 1 && v1 > 0 && K.versionCode(Date.UTC(2080, 0, 1)) < 2100000000, [v1, v2]);
const ab = src("lib/apkBuild.js");
check("the build passes -PbgVersionCode / -PbgVersionName and stamps BG_BUILD_ID into the app", /-PbgVersionCode=/.test(ab) && /-PbgVersionName=/.test(ab) && /BG_BUILD_ID/.test(ab) && /built_id/.test(ab));
const gr = src("mobile/android/app/build.gradle");
check("build.gradle takes them (a hand build stays 1 / 1.0)", /findProperty\("bgVersionCode"\) \?: "1"/.test(gr) && /findProperty\("bgVersionName"\) \?: "1\.0"/.test(gr));
check("the manifest may ask to install updates (REQUEST_INSTALL_PACKAGES)", /android\.permission\.REQUEST_INSTALL_PACKAGES/.test(src("mobile/android/app/src/main/AndroidManifest.xml")));
const vd = src("mobile/scripts/vendor.js");
check("vendor.js writes www/lib/build.js (window.BG_BUILD) - gitignored", /BG_BUILD/.test(vd) && /build\.js/.test(vd) && /www\/lib\/build\.js/.test(src("mobile/.gitignore")));
const mp = JSON.parse(src("mobile/package.json"));
check("the file opener plugin is in the app (Android's installer)", !!(mp.dependencies || {})["@capacitor-community/file-opener"]);

const G = require("../lib/remoteGuard");
check("guard: GET /apk/<token>/bitGen.apk is open (the token is the key), nothing else under /apk",
  G.isOpen("GET", "/apk/" + "a".repeat(24) + "/bitGen.apk") && !G.isOpen("POST", "/apk/" + "a".repeat(24) + "/bitGen.apk")
  && !G.isOpen("GET", "/apk/short/bitGen.apk") && !G.isOpen("GET", "/apk/" + "a".repeat(24) + "/other.apk") && !G.isOpen("GET", "/api/app/apk"));
const ra = src("routes/apkBuild.js");
check("routes: /api/apk/qr + /api/apk/reveal are for this PC only; /apk/:token checks the token", /\/api\/apk\/qr/.test(ra) && /\/api\/apk\/reveal/.test(ra) && /S\.valid\(/.test(ra)
  && /app\.post\("\/api\/apk\/qr", local/.test(ra) && /app\.post\("\/api\/apk\/reveal", local/.test(ra) && !/bitGen\.apk", local/.test(ra));
const rp = src("routes/appApi.js");
check("routes: /api/app/update + /api/app/apk (the paired app, its key)", /\/api\/app\/update/.test(rp) && /\/api\/app\/apk/.test(rp));
const ui = src("static/apkui.js");
check("Settings ▸ General ▸ Remote: 📲 Install with a QR + 📂 Show the APK + the Phone Link hint", /apk_qr/.test(ui) && /apk_reveal/.test(ui) && /Phone Link/.test(ui) && /Auto Blocker/.test(ui));
const app = src("mobile/www/app.js"), html = src("mobile/www/index.html");
check("the app: checkUpdate + doUpdate (download -> FileOpener with the APK type)", /function checkUpdate/.test(app) && /function doUpdate/.test(app) && /FileOpener/.test(app) && /vnd\.android\.package-archive/.test(app));
check("the app: the ⬆ bar, ⬆ Check for an update, This app: line; build.js before core.js", /id="upd"/.test(html) && /id="updCheck"/.test(html) && /id="aboutApp"/.test(html)
  && html.indexOf("lib/build.js") > 0 && html.indexOf("lib/build.js") < html.indexOf("lib/core.js"));
check("no // comment inside an expression in the new code", !/\(\s*\/\/|,\s*\/\/[^\n]*\n\s*\)/.test(src("lib/apkShare.js")));

console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
