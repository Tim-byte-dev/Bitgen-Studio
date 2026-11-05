#!/usr/bin/env node
/* bitGen Studio — 2.679.0: THE RESTYLE'S BEFORE / AFTER (static/lbrestyle.js pairsAdd; the result shown). The clicks:
 * scripts/test-ui679-ui.js.
 * Tim (verbatim): "after the style change render is complete in image preview, show the finished image in preview, add a
 * sbs button so user can see before and after style change" */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } };
const R = require(path.join(__dirname, "..", "static", "lbrestyle.js")), SRC = fs.readFileSync(path.join(__dirname, "..", "static", "lbrestyle.js"), "utf8");
const m = R.pairsAdd({}, "out.png", { url: "/outputs/src.png", name: "src.png" }, "🌸 Anime");
check("a result remembers its original (url, name, the look)", m["out.png"].src === "/outputs/src.png" && m["out.png"].name === "src.png" && m["out.png"].look === "🌸 Anime");
let big = {}; for (let i = 0; i < 230; i++) big = R.pairsAdd(big, "r" + i, { url: "/s" + i, name: "s" + i }, "x");
check("…the newest 200 kept; nothing remembered without both pictures", Object.keys(big).length === 200 && big.r229 && !big.r0 && Object.keys(R.pairsAdd({}, "", { url: "/x" })).length === 0);
check("done: shown in the open preview after its original, or the preview opened again on it (the original first)", /lb\.items\.splice\(k \+ 1, 0, item\); lb\.i = k \+ 1/.test(SRC) && /lbOpen\(\[\{ url: it\.url, kind: "image", name: it\.name \}, item\], 1\)/.test(SRC));
check("⇆ Before / after (#lb_sbs): the two side by side (#lb_sbsview, Before / After captions), hidden for a picture with no original", /id = "lb_sbs"/.test(SRC) && /"Before" \+/.test(SRC) && /"After" \+/.test(SRC) && /b\.style\.display = pairOf\(cur\(\)\) \? "" : "none"/.test(SRC));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
