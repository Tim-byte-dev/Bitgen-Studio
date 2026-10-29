#!/usr/bin/env node
/* bitGen Studio — 2.615.0 (pure + wiring): BASIC SETTINGS FOLLOW THE STYLE - misc/basic_settings.tmp.
 * Tim: "when user changes a style anywhere in bitgen, save the all basic settings+style name in basic settings docker to
 * misc\basic_settings.tmp. if the file does not exist , create it . this operation must be done before changing the
 * style. load the basic settings on start with the last style used before previous session closed and when style changes".
 *   lib/basicTmp.js (key, read, save, setLast, cleanBasic) + routes/basicTmp.js; static/stylebasic.js (pickFor, split; the
 *   onchange wrap: keep -> the style's own handler -> restore) */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
const T = require(path.join(R, "lib", "basicTmp.js"));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb615_")), f = path.join(dir, "misc", "basic_settings.tmp");
T.setFile(f);
check("the file is misc/basic_settings.tmp in the install folder; none yet = an empty one (no error)",
  /misc[\\/]basic_settings\.tmp$/.test((T.setFile(null), T.file())) && (T.setFile(f), !fs.existsSync(f)) && JSON.stringify(T.read().styles) === "{}");
const o1 = T.save({ kind: "video", id: "st_a", name: "MiniMax H3 SS", basic: { steps: "17", cfg: "3.5", ovrStyle: true, junk: { x: 1 }, "bad key!": "x" } });
check("save: made when missing; the style's NAME + its plain field values (an object or an odd key dropped); the kind's last style",
  fs.existsSync(f) && o1.styles["video:st_a"].style === "MiniMax H3 SS" && JSON.stringify(o1.styles["video:st_a"].basic) === JSON.stringify({ steps: "17", cfg: "3.5", ovrStyle: true }) && o1.last.video === "st_a" && o1.lastKind === "video");
T.save({ kind: "video", id: "st_b", name: "LTX 2.3", basic: { steps: "33" }, last: false });
T.save({ kind: "image", id: "", name: "— template —", basic: { imgSteps: "12" } });
const o2 = T.read();
check("…another style (last: false keeps the last one), an image style, the empty style (\"— template —\") - all side by side",
  o2.last.video === "st_a" && o2.last.image === "" && o2.styles["video:st_b"].basic.steps === "33" && o2.styles["image:"].style === "— template —" && Object.keys(o2.styles).length === 3);
check("setLast: only the last style; a kind other than video / image refused",
  T.setLast("video", "st_b").last.video === "st_b" && T.read().styles["video:st_a"].basic.steps === "17" && (() => { try { T.save({ kind: "audio", id: "x", basic: {} }); return false; } catch (e) { return e.status === 400; } })());
fs.writeFileSync(f, "{broken");
check("a broken file reads as empty and the next save writes a good one", JSON.stringify(T.read().styles) === "{}" && T.save({ kind: "video", id: "c", basic: { steps: "5" } }).styles["video:c"].basic.steps === "5");

const SB = require(path.join(R, "static", "stylebasic.js"));
const isImg = (k) => /^img/.test(k);
check("pickFor / split: a video style takes every field but the image set's, an image style the image set's",
  JSON.stringify(SB.pickFor("video", { steps: 1, imgSteps: 2, cfg: 3 }, isImg)) === JSON.stringify({ steps: 1, cfg: 3 }) && JSON.stringify(SB.split({ steps: 1, imgSteps: 2 }, isImg)) === JSON.stringify({ video: { steps: 1 }, image: { imgSteps: 2 } }));
const S = read("static/stylebasic.js"), RT = read("routes/basicTmp.js"), RI = read("routes/index.js"), IX = read("static/index.html");
check("the page: each style list's onchange wrapped - the settings KEPT for the style being left BEFORE its handler runs, the new style's put back after; the start picks the last styles; kept fresh every 5 s + when closing",
  /if \(moving\) keep\(s\.kind, p\.id, p\.name, false\);\s+\/\/ BEFORE the style changes\s+var r = orig\.apply\(this, arguments\);/.test(S) && /var n = restore\(s\.kind, nid\);/.test(S)
  && /\{ kind: "video", id: "videoStyleSel" \}, \{ kind: "image", id: "styleSel" \}/.test(S) && /sendBeacon/.test(S) && /var want = file\.last \? file\.last\[s\.kind\]/.test(S) && /H3BasicCfg/.test(S));
check("the server: GET / POST /api/basic-settings/styles (routes/basicTmp.js, mounted in routes/index.js - sendBeacon's text body read too)",
  /app\.get\("\/api\/basic-settings\/styles"/.test(RT) && /app\.post\("\/api\/basic-settings\/styles", express\.text/.test(RT) && /require\("\.\/basicTmp"\)\.mount\(app\)/.test(RI));
check("index.html loads stylebasic.js right after basiccfg.js", IX.indexOf("/static/stylebasic.js") > IX.indexOf("/static/basiccfg.js") && IX.indexOf("/static/stylebasic.js") - IX.indexOf("/static/basiccfg.js") < 200);
check("this machine's file: git + the zips leave it out", /^basic_settings\.tmp$/m.test(read(".gitignore")) && /! -name "basic_settings\.tmp"/.test(read("scripts/make_zips.sh")));
check("server.js untouched by this release", !/basicTmp|basic_settings/.test(read("misc/server.js")));
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
