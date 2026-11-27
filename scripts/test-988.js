#!/usr/bin/env node
/* bitGen Studio — 2.988.0: 🙂 the head for a DAZ character from a photo (lib/dazFace.js headWarp / headSize, the landmarks'
 * cheeks + top of the head) and the UI size zooming the WHOLE UI (static/uizoom.js). Tim: "for the daz character we create
 * from picture, can we add head , so the character looks like our character. across the ui when user changes ui size can you
 * change the entire ui sizes, buttons, text etc. i am looking at a projected screen 4m away, it is difficult for me to see." */
"use strict";
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FC = require(path.join(ROOT, "lib/dazFace.js"));

const L = FC.parseLandmarks('{"left_eye":[580,400],"right_eye":[420,400],"mouth":[500,560],"chin":[500,700],"left_cheek":[0.72,0.47],"right_cheek":[280,470],"top_of_head":[500,80]}');
check("parseLandmarks: + the cheeks and the top of the head (0..1 or 0..1000)", L.left_cheek.join() === "720,470" && L.right_cheek.join() === "280,470" && L.top_of_head.join() === "500,80", L);
const L2 = FC.parseLandmarks('{"left_eye":[580,400],"right_eye":[420,400],"chin":[500,700],"left_cheek":[700,470]}');
check("…one cheek alone is left out (both or none); the old four points still enough", L2 && !L2.left_cheek && L2.chin);
// a round "head": a ring of points round the eyes' middle at cheek height + a top
const eye = [0, 1.6, 0.1], ed = 0.06, pts = [];
for (let a = 0; a < 360; a += 15) { const r = 0.07; pts.push(Math.cos(a * Math.PI / 180) * r, 1.6 - 0.05, 0.1 - 0.03 + Math.sin(a * Math.PI / 180) * 0.02); }
pts.push(0, 1.72, 0.05, 0, 1.0, 0.1);                                     // the top of the head, a point far below (the body)
const P = Float64Array.from(pts), hs = FC.headSize(P, eye, ed);
check("headSize: the face's width at the cheekbones and the head's top", Math.abs(hs.width - 0.14) < 1e-9 && Math.abs(hs.top - 1.72) < 1e-9, hs);
const Q = Float64Array.from(pts); FC.headWarp(Q, eye, ed, 1.6 - 1.9 * ed, 1.15, 1.1);
const hs2 = FC.headSize(Q, eye, ed);
check("headWarp: wider (×1.15 near the middle, less further out) and taller above the eyes; the body below the chin untouched", hs2.width > hs.width * 1.05 && hs2.top > hs.top && Q[Q.length - 2] === 1.0, { hs, hs2 });
const Z = Float64Array.from(pts); FC.headWarp(Z, eye, ed, 1.6 - 1.9 * ed, 1, 1);
check("headWarp ×1 ×1 changes nothing", Z.every((v, i) => Math.abs(v - P[i]) < 1e-12));
const fc = rd("lib/dazFace.js"), dl = rd("lib/dazLib.js"), rt = rd("routes/dazLibrary.js");
check("apply(): the head shaped from the cheeks / top (clamped 0.85 - 1.2) and reported; the face painted ON TOP of a body already painted", /kw = Math\.max\(0\.85, Math\.min\(1\.2/.test(fc) && /head_width: \+kw\.toFixed\(3\)/.test(fc) && /ctx\.baseTextures && ctx\.baseTextures\[key\]/.test(fc));
check("build(): the face / head step runs after the body paint too (was skipped), the textures merged", /baseTextures: faceInfo \? faceInfo\.textures : null/.test(dl) && /Object\.assign\(\{\}, faceInfo\.textures, fi\.textures\)/.test(dl) && !/if \(!faceInfo && s\.face && s\.face\.photo\)/.test(dl));
check("the Vision model is asked for the cheeks and the top of the head too", /left_cheek/.test(rt) && /top_of_head/.test(rt));
const dt = rd("ext/pushpulldock/ppdaztools.js");
check("📷 Body from a photo: 🙂 Head (the photo's face / a close-up / leave it), kept; the try sends face {picture, where}; buildChar sends it", /id="dzHead"/.test(dt) && /value="close"/.test(dt) && /LS\.set\("head"/.test(dt) && /c\.face = head === "none" \? null/.test(dt) && /face: c\.face && c\.face\.picture \? \{ picture: c\.face\.picture, where: c\.face\.where \} : null/.test(dt));
const DT = require(path.join(ROOT, "ext/pushpulldock/ppdaztools.js"));
check("cleanScene keeps the head's photo", DT.cleanScene({ chars: [{ id: "a", fig: { rel: "x.duf" }, face: { picture: "me.png", where: "images" } }] }).chars[0].face.picture === "me.png" && DT.cleanScene({ chars: [{ id: "b", fig: { rel: "y.duf" }, face: { picture: 5 } }] }).chars[0].face === null);

// the UI size
const UZ = require(path.join(ROOT, "static/uizoom.js"));
check("factorOf: 60 - 250 % -> 0.6 - 2.5, junk = 1", UZ.factorOf(100) === 1 && UZ.factorOf(200) === 2 && UZ.factorOf(400) === 2.5 && UZ.factorOf(10) === 0.6 && UZ.factorOf("x") === 1 && UZ.MAX === 250);
const ix = rd("static/index.html"), pl = rd("electron/preload.js"), th = require(path.join(ROOT, "static/themes.js"));
check("applyUiScale zooms the whole UI through H3UiZoom (the old font-size only when it is missing); the sliders reach 250 %", /if \(window\.H3UiZoom\) H3UiZoom\.apply\(v\); else R\.fontSize/.test(ix) && /id="uiscale" min="60" max="250"/.test(ix) && /id="s_uiscale" min="60" max="250"/.test(ix) && (th.clampScale || (globalThis.H3Theme || {}).clampScale)(300) === 250);
check("index.html loads uizoom.js", /src="\/static\/uizoom\.js"/.test(ix));
check("the app (Electron): preload's h3shell.zoom = webFrame.setZoomFactor (0.5 - 3)", /webFrame\.setZoomFactor\(n\)/.test(pl) && /zoom: \(f\) =>/.test(pl) && /const \{ contextBridge, ipcRenderer, webFrame \} = require\("electron"\)/.test(pl));
const uz = rd("static/uizoom.js");
check("the app: the root font size stays 14 px (not scaled twice); a browser: the text sizes as before (no CSS zoom - vh dialogs)", /sh\.zoom\(f\); doc\.documentElement\.style\.fontSize = "14px"/.test(uz) && /fontSize = \(14 \* f\) \+ "px"/.test(uz) && !/style\.zoom =/.test(uz));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
