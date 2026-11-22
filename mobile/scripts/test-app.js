#!/usr/bin/env node
// bitGen app - the pure parts (www/lib/core.js). The studio's scripts/test-909.js and scripts/test-ui909-ui.js test the app
// against a real bitGen Studio. Run: node scripts/test-app.js
"use strict";
const BG = require("../www/lib/core.js");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, JSON.stringify(got)); } };
check("parseLink", JSON.stringify(BG.parseLink(" http://192.168.1.20:8311/remote?t=abcDEF123_- ")) === JSON.stringify({ base: "http://192.168.1.20:8311", code: "abcDEF123_-" }), BG.parseLink("http://192.168.1.20:8311/remote?t=abcDEF123_-"));
check("parseLink: rubbish", BG.parseLink("nope") === null && BG.parseLink("http://x/remote?t=ab") === null);
check("sizeFor 540p 9:16", JSON.stringify(BG.sizeFor("540", "9:16")) === '{"width":544,"height":960}', BG.sizeFor("540", "9:16"));
check("sizeFor 1080p 16:9 (the studio rounds 1080 to 1088, then 16:9 = 1936)", JSON.stringify(BG.sizeFor("1080", "16:9")) === '{"width":1936,"height":1088}', BG.sizeFor("1080", "16:9"));
check("statusWords", BG.statusWords({ status: "running", params: { video_style_name: "FastH3 Omni" }, progress: { pct: 40 } }).more === " 40%");
console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
