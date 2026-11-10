#!/usr/bin/env node
/* bitGen Studio — 2.753.1 units: THE NEW LOGO ON WINDOWS' SHORTCUTS (lib/iconRefresh.js).
 * Tim (verbatim): "replace all the logos with the orange border with the new logo" + "the old orange border logo is also in
 * the video". Windows keeps a shortcut's picture in its icon cache, so the desktop / Start menu shortcut showed the old
 * orange-bordered logo after the update: ie4uinit.exe -show (Windows' own) refreshes it - once per logo, at start, on
 * Windows only; electron/main.js calls it before the splash, and it never stops the start. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 400))); } };
const I = require("../lib/iconRefresh");
check("shouldRun: Windows and not done for this logo yet; never elsewhere", I.shouldRun("win32", "") && I.shouldRun("win32", "2.0.0") && !I.shouldRun("win32", I.LOGO + "\n") && !I.shouldRun("linux", "") && !I.shouldRun("darwin", ""));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "icon7531-")), runs = [];
const spawn = (exe, args, o) => { runs.push({ exe, args, o }); return { on() {}, unref() {} }; };
const first = I.refresh(tmp, { platform: "win32", spawn }), again = I.refresh(tmp, { platform: "win32", spawn });
const marker = fs.readFileSync(path.join(tmp, "settings", "icon-cache.txt"), "utf8").trim();
check("on Windows: ie4uinit.exe -show once (System32, hidden, not waited for), the settings folder remembers the logo; the next start does nothing",
  first === true && again === false && runs.length === 1 && /System32[\\/]ie4uinit\.exe$/.test(runs[0].exe) && runs[0].args.join() === "-show" && runs[0].o.windowsHide && runs[0].o.detached && marker === I.LOGO, { runs, marker });
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "icon7531b-")), r2 = [];
check("elsewhere (Linux / macOS): nothing run, nothing written", I.refresh(tmp2, { platform: "linux", spawn: () => { r2.push(1); } }) === false && r2.length === 0 && !fs.existsSync(path.join(tmp2, "settings")));
check("…a spawn that throws does not stop the start (false, no marker)", I.refresh(fs.mkdtempSync(path.join(os.tmpdir(), "icon7531c-")), { platform: "win32", spawn: () => { throw new Error("no"); } }) === false);
const M = fs.readFileSync(path.join(ROOT, "electron", "main.js"), "utf8");
check("electron/main.js runs it at start, before the splash, inside a try", /try \{ require\(path\.join\(ROOT, "lib", "iconRefresh"\)\)\.refresh\(ROOT\); \} catch \(e\) \{[^}]*\}\s+createSplash\(\);/.test(M));
check("the logo it names is the one installer/bitgen.ico has had since (docs/BRAND.md - the official logo, 2.750.0 / 2.751.0)", I.LOGO === "2.750.0" && /Since 2\.751\.0, this is \*\*the official bitGen logo\*\*/.test(fs.readFileSync(path.join(ROOT, "docs", "BRAND.md"), "utf8")));
for (const d of [tmp, tmp2]) fs.rmSync(d, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
