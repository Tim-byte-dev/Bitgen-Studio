#!/usr/bin/env node
// bitGen Studio 2.931.0 - an on / off switch on each temporary LoRA (Basic Settings), kept without being rendered.
// Tim: "add a toggle switch to the added loras in basic settings so we can toggle loras on and off without removing them".
// Units: lib/tempLoras.js (on:false kept in the file, left out of normalize / read / merge - every render), the routes that
// show the list ask for {all}; the page's wiring. The browser run: test-ui931-ui.js. Run: node scripts/test-931.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 400)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require("../lib/tempLoras");
const L = [{ path: "loras\\a.safetensors", weight: 0.8 }, { path: "loras\\b.safetensors", weight: 0.5, on: false }, { path: "loras\\c.safetensors", weight: 1, on: true }];
check("normalize(): the switched-off LoRA left out (what a render gets); on:true not written", JSON.stringify(T.normalize(L)) === JSON.stringify([{ path: "loras\\a.safetensors", weight: 0.8 }, { path: "loras\\c.safetensors", weight: 1 }]));
check("normalize({all}): every one, on:false on the switched-off", JSON.stringify(T.normalize(L, { all: true }).map((l) => l.on === false)) === "[false,true,false]");
const D = fs.mkdtempSync(path.join(os.tmpdir(), "bg931-"));
const w = T.write(D, "image", L);
check("write(): the file keeps all three, on:false on b", w.length === 3 && JSON.parse(fs.readFileSync(T.file(D, "image"), "utf8"))[1].on === false);
check("read(): two (renders); read({all}): three (Basic Settings)", T.read(D, "image").length === 2 && T.read(D, "image", { all: true }).length === 3);
check("merge(): a switched-off LoRA never joins the style's (nor re-weights one of the same path)", JSON.stringify(T.merge([{ path: "loras\\b.safetensors", weight: 1 }], [{ path: "loras\\b.safetensors", weight: 0.2, on: false }])) === JSON.stringify([{ path: "loras\\b.safetensors", weight: 1 }]));
fs.rmSync(D, { recursive: true, force: true });
const R = src("routes/index.js"), IX = src("static/index.html");
check("GET /api/temploras + the ControlNet list + the video docker's ⚙ list show the switched-off ones ({all: true})", /tempLoras\.read\(pdir, "image", all\)/.test(R) && /tempLoras\.read\(pdir, "cnet", \{ all: true \}\)/.test(R) && /tempLoras\.read\(pdir, "video", \{ all: true \}\)/.test(src("routes/characters.js")));
check("renaming a model's file keeps the switched-off LoRAs (lib/noPod.js)", /TL\.read\(pdir, kind, \{ all: true \}\)/.test(src("lib/noPod.js")));
check("the page: tempLoras(kind) = the ones on (Generate), tempLoras(kind, host, true) saved; a switch on every row", /function tempLoras\(kind, hostId, all\)/.test(IX) && /const list = tempLoras\(kind, hostId, true\);/.test(IX) && /class="lon"/.test(IX) && /\.lswitch \.lon:checked \+ \.lknob/.test(IX));
check("⇄ the previous settings keep the switches (static/modelswap.js)", /tempLoras\(kind, undefined, true\)/.test(src("static/modelswap.js")));
console.log("\n" + P + " passed, " + F + " failed");
process.exit(F ? 1 : 0);
