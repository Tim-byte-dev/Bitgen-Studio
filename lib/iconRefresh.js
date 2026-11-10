// bitGen Studio — lib/iconRefresh.js (2.753.1): THE NEW LOGO ON WINDOWS' SHORTCUTS.
// Tim (verbatim): "replace all the logos with the orange border with the new logo" / "the old orange border logo is also in
// the video". The logo files were replaced in 2.750.0 (installer/bitgen.ico, static/icon.png - docs/BRAND.md), but Windows
// keeps a shortcut's picture in its icon cache: the desktop / Start menu "bitGen Studio" shortcut (installer/bootstrap.ps1
// points it at installer\bitgen.ico) went on showing the old orange-bordered logo after an update. Windows' own
// ie4uinit.exe -show refreshes that cache (Windows 10 / 11; nothing to install). Run ONCE per logo (LOGO), at start, on
// Windows only, by electron/main.js - a marker file in the settings folder remembers it.
// Pure (scripts/test-logo7531.js): LOGO, shouldRun.
"use strict";
const fs = require("fs");
const path = require("path");

const LOGO = "2.750.0";                       // the logo the shortcuts should show (bump when installer/bitgen.ico changes)

/** run now? (pure): Windows, and the marker does not name this logo yet */
function shouldRun(platform, marker) { return platform === "win32" && String(marker || "").trim() !== LOGO; }

/** at start (electron/main.js): refresh Windows' icon cache once for this logo; never throws */
function refresh(root, o) {
  const opt = o || {};
  const platform = opt.platform || process.platform;
  const file = path.join(root, "settings", "icon-cache.txt");
  let marker = "";
  try { marker = fs.readFileSync(file, "utf8"); } catch { marker = ""; }
  if (!shouldRun(platform, marker)) return false;
  try {
    const exe = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "ie4uinit.exe");
    const run = opt.spawn || require("child_process").spawn;
    const p = run(exe, ["-show"], { detached: true, stdio: "ignore", windowsHide: true });
    if (p && p.on) p.on("error", () => { /* not there - an older Windows */ });
    if (p && p.unref) p.unref();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, LOGO + "\n");
    return true;
  } catch { return false; }
}

module.exports = { LOGO, shouldRun, refresh };
