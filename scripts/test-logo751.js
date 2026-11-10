#!/usr/bin/env node
/* bitGen Studio — 2.751.0 units: THE OFFICIAL LOGO everywhere a logo is used (docs/BRAND.md, misc/brand/make_logo.py).
 * Tim (verbatim): "make the new logo the official bitgen logo, we use it for everything that uses a logo"
 *   the files: transparent PNGs at their sizes (master 512, README / website 256, app icon 512, favicon 64), the Windows
 *   .ico with 16 - 256, the banner 1920 x 1080; all made by misc/brand/make_logo.py from docs/images/logo-source.jpg
 *   (the PNGs are the master scaled - the same picture); the SVGs carry the tree; the intro film draws the ring;
 *   the films are the new renders; BRAND.md names every file; the website takes docs/images/logo.png */
"use strict";
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const R = (...p) => path.join(ROOT, ...p);
/** a PNG's width, height and colour type (6 = RGBA) from its header */
const png = (f) => { const b = fs.readFileSync(R(f)); return b.slice(1, 4).toString() === "PNG" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: b[25] } : null; };

const want = { "docs/images/logo-512.png": 512, "docs/images/logo.png": 256, "static/icon.png": 512, "static/favicon.png": 64 };
const got = Object.fromEntries(Object.keys(want).map((f) => [f, png(f)]));
check("the logo PNGs: transparent (RGBA) at their sizes - master 512, README / website 256, app icon 512, favicon 64",
  Object.entries(want).every(([f, n]) => got[f] && got[f].w === n && got[f].h === n && got[f].type === 6), got);
const ban = png("docs/images/bitgen-logo-1920x1080.png");
check("the banner (the link preview) 1920 x 1080", ban && ban.w === 1920 && ban.h === 1080, ban);
const ico = fs.readFileSync(R("installer", "bitgen.ico")), n = ico.readUInt16LE(4);
const sizes = Array.from({ length: n }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b);
check("the Windows .ico: 16, 32, 48, 64, 128, 256", ico.readUInt16LE(2) === 1 && JSON.stringify(sizes) === "[16,32,48,64,128,256]", sizes);
// the same picture: each PNG is the master scaled (Python + Pillow, when here)
let same = null;
try {
  same = execFileSync("python3", ["-I", "-c", `
from PIL import Image
import numpy as np
m = Image.open(${JSON.stringify(R("docs/images/logo-512.png"))}).convert("RGBA")
worst = 0
for f in ${JSON.stringify(Object.keys(want).map((f) => R(f)))}:
    a = np.asarray(Image.open(f).convert("RGBA")).astype(int)
    b = np.asarray(m.resize(a.shape[1::-1], Image.LANCZOS)).astype(int)
    worst = max(worst, int(np.abs(a[..., 3] - b[..., 3]).max()))
print(worst)`], { encoding: "utf8" }).trim();
} catch { same = null; }
if (same === null) console.log("(no Python + Pillow here - the same-picture check did not run)");
else check("…every PNG is the master logo scaled (the same picture everywhere)", +same <= 2, same);
const mk = fs.readFileSync(R("misc", "brand", "make_logo.py"), "utf8");
check("misc/brand/make_logo.py makes them all from docs/images/logo-source.jpg (Tim's picture, kept)", fs.existsSync(R("docs", "images", "logo-source.jpg"))
  && ["docs/images/logo-512.png", "docs/images/logo.png", "static/icon.png", "static/favicon.png", "docs/images/bitgen-logo-1920x1080.png"].every((f) => mk.includes(f)) && /"installer", "bitgen\.ico"/.test(mk));

const svg = fs.readFileSync(R("static", "logo.svg"), "utf8"), mark = fs.readFileSync(R("static", "logo-mark.svg"), "utf8");
check("the SVGs carry the tree (9 shapes: trunk, two roots, two branches = the antennae, two hooks, two twigs); the mark's view takes the antennae",
  (svg.match(/id="tree_\d+"/g) || []).length === 9 && (mark.match(/id="tree_\d+"/g) || []).length === 9 && /viewBox="7 200 1054 636"/.test(mark));
const intro = fs.readFileSync(R("misc", "intro", "intro.html"), "utf8");
check("the intro film draws the official ring (blue, round the butterfly) and the butterfly in the logo's white", /RING\.setAttribute\("r", "666"\)/.test(intro) && /RING\.setAttribute\("stroke", "#7fb3d8"\)/.test(intro) && /p\.setAttribute\("fill", "#eef3f7"\)/.test(intro));
check("the films exist (intro 10 s, splash mp4 + the app's webm)", ["docs/images/bitgen-studio-intro.mp4", "docs/images/bitgen-studio-splash.mp4", "static/splash.webm"].every((f) => fs.statSync(R(f)).size > 300000));
const brand = fs.readFileSync(R("docs", "BRAND.md"), "utf8");
check("docs/BRAND.md: the official logo, every file and the script", /the official bitGen logo/.test(brand) && ["docs/images/logo-512.png", "docs/images/logo.png", "static/icon.png", "static/favicon.png", "installer/bitgen.ico", "docs/images/bitgen-logo-1920x1080.png", "static/logo.svg", "static/logo-mark.svg", "misc/brand/make_logo.py"].every((f) => brand.includes(f)));
check("the README shows docs/images/logo.png; the app's window icon is static/icon.png", /<img src="docs\/images\/logo\.png"/.test(fs.readFileSync(R("README.md"), "utf8")) && /icon: path\.join\(ROOT, "static", "icon\.png"\)/.test(fs.readFileSync(R("electron", "main.js"), "utf8")));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
