#!/usr/bin/env node
/* bitGen Studio — 2.675.0: 📌 PINS KEPT THROUGH EVERY LAYOUT, RESET ONLY BY RIGHT-CLICK ▸ ↺ Reset pin (static/pinmenu.js items;
 * lib/layouts.js keepPins; index.html applyLayout / resetPin). The clicks: scripts/test-ui675-ui.js.
 * Tim (verbatim): "the red pins are resetting everytime i switch layout, they should only reset if i right click and click
 * reset in a context menu" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const PM = require(path.join(ROOT, "static", "pinmenu.js")), L = require(path.join(ROOT, "lib", "layouts.js"));
check("the menu, pinned: 📌 Pinned at 320 px high (a heading) + ↺ Reset pin", JSON.stringify(PM.items({ max_height: 320 }, false)) === JSON.stringify([["📌 Pinned at 320 px high", null], ["↺ Reset pin (any size again)", "reset"]]));
check("…unpinned: 📌 Pin at this size + ↺ Reset pin greyed; a side dock pins a width", PM.items({ max_height: 0 }, false)[0][1] === "pin" && PM.items({}, false)[1][1] === null && /wide/.test(PM.items({ max_width: 280 }, true)[0][0]));
const next = { docks: { videodock: { height: 300, max_height: 0 }, ldock: { width: 260, max_width: 0 }, musicdock: { height: 200, max_height: 150 } } };
L.keepPins(next, { docks: { videodock: { max_height: 420 }, ldock: { max_width: 300 }, musicdock: { max_height: 0 } } });
check("a 🗂 Layout applied keeps the pins in use (pinned stay pinned, unpinned stay unpinned), its sizes taken", next.docks.videodock.max_height === 420 && next.docks.ldock.max_width === 300 && next.docks.musicdock.max_height === 0 && next.docks.videodock.height === 300, next);
const H = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8");
check("index.html applyLayout keeps max_height / max_width (⊞ Docker configs, workspaces, ↺ Reset all go through it)", /: \{ \.\.\.was, \.\.\.dsShape\(id, e\), max_height: was\.max_height \|\| 0, max_width: was\.max_width \|\| 0 \}/.test(H) && /applyLayout\(rec\.docks, true\)/.test(H));   // the start-up restore takes the saved pins
check("resetPin(id) clears the pin (saved, reflowed); pinmenu.js loaded; the pin's tooltip says right-click", /function resetPin\(id\)/.test(H) && /<script src="\/static\/pinmenu\.js">/.test(H) && /right-click: ↺ Reset pin/.test(H));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
