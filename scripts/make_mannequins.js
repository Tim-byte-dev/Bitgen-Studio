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
  // 2.928.0: the glossy display mannequins (static/mannequinGloss.js + the bodies in static/mannequins/mesh - made by
  // scripts/make_mannequin_mesh.py from MakeHuman's CC0 base mesh) - on black, like Tim's pictures
  await p.addScriptTag({ path: path.join(ROOT, "static", "mannequinGloss.js") });
  const save = (name, url) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(",")[1], "base64")); console.log("wrote", name); };
  const M = require(path.join(ROOT, "static", "mannequin3d.js"));
  for (const sex of ["male", "female"]) {
    const mesh = JSON.parse(fs.readFileSync(path.join(ROOT, "static", "mannequins", "mesh", sex + ".json"), "utf8"));
    for (const view of ["front", "side", "back"]) {
      save(`${sex}_${view}.png`, await p.evaluate(([m, v]) => window.H3MannequinGloss.render(window.H3THREE, m, { view: v, w: 832, h: 1216 }), [mesh, view]));
    }
    const title = (sex === "male" ? "Male" : "Female") + " display mannequin · " + Math.round(mesh.height_m * 100) + " cm";
    save(`${sex}_sheet.png`, await p.evaluate(([m, t]) => window.H3MannequinGloss.sheet(window.H3THREE, m, { w: 2600, h: 2400, title: t }), [mesh, title]));
    void M;
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
