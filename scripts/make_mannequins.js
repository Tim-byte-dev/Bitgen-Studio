#!/usr/bin/env node
/* bitGen Studio — scripts/make_mannequins.js (2.873.0): renders the character sheet's 3D mannequins into
 * static/mannequins/ - <sex>_front.png (the start picture, 832 x 1216), <sex>_side.png, <sex>_back.png and
 * <sex>_sheet.png (every view + the head + the head marks). The figure is static/mannequin3d.js (bitGen Studio's own,
 * drawn with the three.js the app ships); run this again after changing it:  node scripts/make_mannequins.js
 * Needs Playwright's Chromium (WebGL in software is enough). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const OUT = process.argv[2] || path.join(ROOT, "static", "mannequins");
(async () => {
  if (!chromium) { console.error("playwright is not installed"); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const p = await b.newPage();
  await p.setContent("<!DOCTYPE html><html><body style='margin:0;background:#ececec'></body></html>");
  await p.addScriptTag({ path: path.join(ROOT, "static", "vendor", "three-m3d.min.js") });
  await p.addScriptTag({ path: path.join(ROOT, "static", "mannequin3d.js") });
  const save = (name, url) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(",")[1], "base64")); console.log("wrote", name); };
  for (const sex of ["male", "female"]) {
    for (const view of ["front", "side", "back"]) {
      save(`${sex}_${view}.png`, await p.evaluate((o) => window.H3Mannequin.render(window.H3THREE, o), { sex, view, w: 832, h: 1216 }));
    }
    save(`${sex}_sheet.png`, await p.evaluate((o) => window.H3Mannequin.sheet(window.H3THREE, o), { sex, w: 2400, h: 1350 }));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
