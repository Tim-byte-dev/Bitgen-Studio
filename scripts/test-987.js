#!/usr/bin/env node
/* bitGen Studio — 2.987.0: ✨ Photo from the Sketcher with the prompt docker's references / prompt (the four cases), and the
 * image preview's 🌐 Panorama 3D (static/lbpano.js pure parts). Tim: "when rendering from sketcher use the reference images and
 * prompt in prompt docker if there are any ... in image preview dialog add a button to view panorama 3d and controls to move
 * around the panorama. and allow user to watch vr sbs or top bottom." */
"use strict";
const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const RL = require(path.join(ROOT, "ext/pushpulldock/ppreal.js"));
const tiles = RL.refTiles([{ url: "blob:a", file: { type: "image/png" }, role: "location" }, { url: "blob:b", desc: "old brick wall" }, { url: "blob:v", file: { type: "video/mp4" } }, { file: {} }, null]);
check("refTiles: the prompt docker's pictures (not videos, not empty), \"Reference n (its words / role)\"", tiles.length === 2 && tiles[0].cap === "Reference 1 (location)" && tiles[1].cap === "Reference 2 (old brick wall)" && tiles[0].src === "blob:a", tiles);
check("refTiles: 6 at most", RL.refTiles(Array.from({ length: 9 }, (_, i) => ({ url: "blob:" + i }))).length === 6);
const used = (refs, tiles2) => ({ tiles: tiles2 || [], bg: null, refs: refs || [] });
const A = RL.promptFor("a cottage at dusk", used(tiles), null), B = RL.promptFor("", used(tiles), null), C = RL.promptFor("a cottage at dusk", null, null), D = RL.promptFor("", null, null);
check("prompt + references: the lead, the depth line, the references line, the words", /depth map/.test(A) && /references? for the model itself/.test(A) && /a cottage at dusk$/.test(A) && !/material board/.test(A), A);
check("references, no prompt: the references line, no words", /references? for the model itself/.test(B) && !/cottage/.test(B));   // 2.996.0: the model's own references (SUBJ1 / SUBJS)
check("a prompt, no references: the words, no references line", !/for the model itself\)? *:|references? for the model/.test(C) && /cottage/.test(C));
check("neither: the scene only (the lead + the depth line)", D === RL.LEAD + " " + RL.DEPTH + " " + RL.KEEP_GREY, D);   // 2.996.0: + the grey kept (the place is step 2)
const M = RL.promptFor("", used(tiles, [{ src: "x", where: ["walls"] }]), null);
check("materials + references on one board: both lines", /material board/.test(M) && /references? for the model itself/.test(M));
check("boardCaptions: + the references", RL.boardCaptions(used(tiles)).join("|") === "Reference 1 (location)|Reference 2 (old brick wall)");
const pr = rd("ext/pushpulldock/ppreal.js");
check("run(): the page's `refs` read into the board; a board for references alone; the message says what went", /const all = refTiles\(/.test(pr) && /used\.refs = p\.subject;/.test(pr) && /\(used\.tiles\.length \|\| used\.bg \|\| used\.refs\.length\) \? await boardPic\(used\)/.test(pr) && /refUse\(p, R\.refs\)/.test(pr));   // 2.996.0: the board = the model's own references; the message says what each went to
check("boardPic: blob: references drawn, a 3 × 3 board at most", /\/\^blob:\|\^data:\//.test(pr) && /\.slice\(0, 9\)\)\.slice\(0, 9\)/.test(pr));

const P = require(path.join(ROOT, "static/lbpano.js"));
check("detect: 2:1 mono, 1:1 stereo top / bottom, 4:1 stereo side by side", P.detect(4096, 2048) === "mono" && P.detect(4096, 4096) === "tb" && P.detect(8192, 2048) === "sbs" && P.detect(0, 0) === "mono");
check("eyeUV: mono whole; side by side left | right halves; top / bottom left eye = the top half", JSON.stringify(P.eyeUV("mono", "left")) === '{"repeat":[1,1],"offset":[0,0]}' && P.eyeUV("sbs", "right").offset[0] === 0.5 && P.eyeUV("sbs", "left").repeat[0] === 0.5 && P.eyeUV("tb", "left").offset[1] === 0.5 && P.eyeUV("tb", "right").offset[1] === 0);
const vs = P.viewports("sbs", 1001, 500), vt = P.viewports("tb", 800, 601), vn = P.viewports("normal", 800, 600);
check("viewports: side by side = two halves (left eye left), top / bottom = left eye on top (gl y from the bottom), normal = one", vs.length === 2 && vs[0].eye === "left" && vs[0].x === 0 && vs[0].w + vs[1].w === 1001 && vt[0].eye === "left" && vt[0].y > 0 && vt[0].h + vt[1].h === 601 && vn.length === 1 && vn[0].w === 800);
check("clampLook: yaw wrapped, pitch ±89, fov 30 - 110", JSON.stringify(P.clampLook({ yaw: 190, pitch: 120, fov: 10 })) === '{"yaw":-170,"pitch":89,"fov":30}' && P.clampLook({ fov: 500 }).fov === 110);
const lp = rd("static/lbpano.js"), ix = rd("static/index.html");
check("index.html loads lbpano.js after lbrestyle.js", ix.indexOf('src="/static/lbpano.js"') > ix.indexOf('src="/static/lbrestyle.js"'));
check("the preview: 🌐 button after Save, the view over the picture, Esc closes the panorama first, arrows / WASD turn (not paging)", /id = "lb_pano"/.test(lp) && /insertBefore\(b, save\.nextSibling\)/.test(lp) && /addEventListener\("cancel"/.test(lp) && /stopImmediatePropagation/.test(lp) && /ArrowLeft: "left", a: "left"/.test(lp));
check("three.js from this computer (H3M3D.load), nothing from the internet", /root\.H3M3D && await root\.H3M3D\.load\(\)/.test(lp) && !/https?:\/\//.test(lp.replace(/^\s*\*.*$/gm, "")));
check("the drag redraws (the call not lost in a comment)", /S\.look = clampLook\(S\.look\); draw\(\);   \/\/ the picture is grabbed/.test(lp));
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
