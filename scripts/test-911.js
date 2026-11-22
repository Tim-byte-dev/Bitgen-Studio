#!/usr/bin/env node
// bitGen Studio 2.911.0 - ✨ the app's songwriter (Tim: "does the music prompt work the same as in bitgen? the llm writes
// it?") and 📱 building the app + installing it on the phone over Wi-Fi from Settings ▸ General ▸ Remote ("can we compile
// the apk in bitgen ... and install it to the phone automatically?"). Run: node scripts/test-911.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ✨ the songwriter
const A = require("../lib/appApi");
const m = A.songMessages("a song about neon rain", "Warm indie pop, female vocal");
check("songMessages: the chat's own songwriter shape (TITLE / STYLE / LYRICS) + the style's sound words + the idea",
  m.length === 2 && /THE USER IS ASKING FOR A SONG/.test(m[0].content) && /Warm indie pop/.test(m[0].content) && m[1].role === "user" && /neon rain/.test(m[1].content), m);
check("songMessages: no style = no style line", !/sung in/.test(A.songMessages("x", "")[0].content));
const sw = require("../lib/songwriter");
const song = sw.parse("**TITLE:** Lanterns\n**STYLE:** dreamy synth-pop\n**LYRICS:**\n[verse]\nLights on the water\n");
check("songwriter.parse reads what the stub (and chat models) answer", song && song.title === "Lanterns" && song.style === "dreamy synth-pop" && /^\[verse\]/.test(song.lyrics), song);

// 📱 the build + the phone
const K = require("../lib/apkBuild");
check("javaMajor: 21.0.5 / 17 / 1.8 -> 21 / 17 / 8", K.javaMajor('openjdk version "21.0.5" 2024-10-15') === 21 && K.javaMajor('openjdk version "17.0.2"') === 17 && K.javaMajor('java version "1.8.0_381"') === 8 && K.javaMajor("nope") === 0);
check("parsePair: success with its guid / the phone's refusal", K.parsePair("Successfully paired to 192.168.1.23:37123 [guid=adb-R5CT-AbC]").ok && K.parsePair("Successfully paired to 1.2.3.4:5 [guid=adb-X]").guid === "adb-X"
  && !K.parsePair("Failed: Wrong password or connection was dropped.").ok);
const devs = K.parseDevices("List of devices attached\n192.168.1.23:41234     device product:q6qxxx model:SM_F956B device:q6q transport_id:3\nR5CT30 unauthorized usb:1-1\n");
check("parseDevices: serial, state, model (SM F956B), Wi-Fi", devs.length === 2 && devs[0].model === "SM F956B" && devs[0].wifi && devs[1].state === "unauthorized", devs);
const md = K.parseMdns("List of discovered mdns services\nadb-R5CT-x\t_adb-tls-connect._tcp\t192.168.1.23:41234\nadb-R5CT-x\t_adb-tls-pairing._tcp\t192.168.1.23:37123\n");
check("parseMdns: the connect + pairing services with their address", md.length === 2 && md[0].type === "connect" && md[0].address === "192.168.1.23:41234", md);
check("pickDevice: the asked one / the remembered IP / the only one / none when unsure", K.pickDevice(devs, "192.168.1.23:41234", null) === devs[0]
  && K.pickDevice(devs, "", { ip: "192.168.1.23" }) === devs[0] && K.pickDevice([devs[0]], "", null) === devs[0]
  && K.pickDevice([devs[0], Object.assign({}, devs[0], { serial: "10.0.0.2:5555", model: "Other" })], "", null) === null && K.pickDevice([devs[1]], "", null) === null);
check("localProps: a Windows SDK path escaped for Java properties", K.localProps("C:\\Users\\Tim\\AppData\\Local\\Android\\Sdk") === "sdk.dir=C\\:\\\\Users\\\\Tim\\\\AppData\\\\Local\\\\Android\\\\Sdk\n", K.localProps("C:\\Users\\Tim\\AppData\\Local\\Android\\Sdk"));
check("adoptiumUrl: Temurin 21 for Windows x64 / a Mac on Apple silicon", K.adoptiumUrl("win32", "x64") === "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse"
  && /\/mac\/aarch64\//.test(K.adoptiumUrl("darwin", "arm64")));
check("latestCmdline: the newest build in Google's list, else the known one", /commandlinetools-win-14800000_latest\.zip$/.test(K.latestCmdline("commandlinetools-win-14742923_latest.zip commandlinetools-win-14800000_latest.zip commandlinetools-linux-99999999_latest.zip", "win32"))
  && /commandlinetools-linux-\d+_latest\.zip$/.test(K.latestCmdline("", "linux")));
const c = K.candidates({ JAVA_HOME: "J", ProgramFiles: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\Tim\\AppData\\Local", ANDROID_HOME: "S" }, "win32", "C:\\Users\\Tim", "C:\\bitGen");
check("candidates (Windows): JAVA_HOME, Android Studio's jbr, bitGen's; ANDROID_HOME, Android Studio's SDK, bitGen's",
  c.jdk[0].dir === "J" && c.jdk.some((x) => x.dir === "C:\\Program Files\\Android\\Android Studio\\jbr") && c.jdk[c.jdk.length - 1].source === "bitGen"
  && c.sdk[0].dir === "S" && c.sdk.some((x) => x.dir === "C:\\Users\\Tim\\AppData\\Local\\Android\\Sdk") && c.sdk[c.sdk.length - 1].source === "bitGen", c);
const cm = K.candidates({}, "darwin", "/Users/tim", "/bg");
check("candidates (Mac): Android Studio.app's jbr, ~/Library/Android/sdk", cm.jdk[0].dir === "/Applications/Android Studio.app/Contents/jbr/Contents/Home" && cm.sdk[0].dir === "/Users/tim/Library/Android/sdk");
check("the SDK packages: platform-tools, Android 36, build-tools 36", JSON.stringify(K.SDK_PKGS) === JSON.stringify(["platform-tools", "platforms;android-36", "build-tools;36.0.0"]));
const U = require("../static/apkui.js");
check("apkui toolsLine / phoneLine", /✓ Java 21 \(Android Studio\) · ✓ Android SDK \(Android Studio\)/.test(U.toolsLine({ jdk: { version: 21, source: "Android Studio" }, sdk: { source: "Android Studio", adb: true }, npm: true, mobile: true }))
  && /Java 17 is too old/.test(U.toolsLine({ jdk_old: { version: 17 }, npm: true })) && /SM F956B at 192\.168\.1\.23/.test(U.phoneLine({ phone: { ip: "192.168.1.23", model: "SM F956B" } })));

// wiring
const idx = src("routes/index.js");
check("routes/index.js mounts routes/apkBuild.js; server.js untouched", /require\("\.\/apkBuild"\)\.mount\(app\)/.test(idx) && !/apkBuild/.test(src("misc/server.js")));
check("/api/apk/* refuse a paired phone (req.remote) - the PC only", /req\.remote \? res\.status\(403\)/.test(src("routes/apkBuild.js")));
check("the Gradle stand-in only in the e2e gate (H3_E2E=1)", /process\.env\.H3_E2E === "1" \? \(\(cfg\(\)\.apk \|\| \{\}\)\.test_gradlew/.test(src("lib/apkBuild.js")) && /process\.env\.H3_E2E === "1" && typeof a\.test_gradlew/.test(src("lib/apkBuild.js")));
check("a .bat / .cmd runs through the shell with its path quoted", /const shell = !!opt\.shell \|\| \(IS_WIN && \/\\\.\(bat\|cmd\)\$\/i\.test\(cmd\)\)/.test(src("lib/apkBuild.js")));
check("index.html loads static/apkui.js; the app has ✨ Write the song", /<script src="\/static\/apkui\.js"><\/script>/.test(src("static/index.html")) && /id="writeSong"/.test(src("mobile/www/index.html")) && /api\("\/api\/app\/song"/.test(src("mobile/www/app.js")));
check("mobile/dist is not committed (the global dist/ ignore)", /^dist\/$/m.test(src(".gitignore")));
for (const f2 of ["lib/apkBuild.js", "routes/apkBuild.js", "static/apkui.js", "lib/appApi.js"]) {
  const bad = src(f2).split("\n").filter((l) => /[,(+]\s*\/\/ /.test(l) && !/^\s*\/\//.test(l) && !/eslint-disable/.test(l));
  check(`${f2}: no // comment mid-expression`, !bad.length, bad);
}
console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
