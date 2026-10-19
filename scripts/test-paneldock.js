#!/usr/bin/env node
/* bitGen Studio — 2.454.0 units: the image editor's PANEL COLUMN AS A DOCKER (static/floatpanels.js drop zones,
 * ext/imageeditdock/pcpanels.js): the zones of a column, a kept order, every group floating, the wiring. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const H = require(path.join(ROOT, "static", "floatpanels.js")), PP = require(path.join(ROOT, "ext", "imageeditdock", "pcpanels.js"));
const col = { left: 0, right: 300, top: 0, bottom: 600 };
const z = H.columnZones([{ key: "color", rect: { left: 0, right: 300, top: 0, bottom: 200 } }, { key: "layers", rect: { left: 0, right: 300, top: 204, bottom: 404 } }, { key: "gone", rect: { left: 0, right: 0, top: 0, bottom: 0 } }], col);
check("columnZones: the top half of each group = before it, the bottom half = after it, the space below = the end; a hidden group none; each zone's line across the column",
  JSON.stringify(z.map((q) => q.key)) === '["before:color","after:color","before:layers","after:layers","end"]' && z[0].rect.bottom === 100 && z[1].line.y === 198 && z[4].rect.top === 404 && z[4].line.w === 300, z.map((q) => [q.key, q.rect, q.line]));
check("columnZones: an empty column = one zone, the end", JSON.stringify(H.columnZones([], col).map((q) => q.key)) === '["end"]');
check("orderOf: the kept order first (groups not there any more left out), new groups after", JSON.stringify(PP.orderOf(["color", "dock", "props", "layers"], ["layers", "gone", "color"])) === '["layers","color","dock","props"]' && JSON.stringify(PP.orderOf(["a", "b"], null)) === '["a","b"]');
check("every tab group floats: Layers, Colour, Properties, the Corel dockers", JSON.stringify(PP.GROUPS.map((g) => g[0])) === '["layers","color","props","dock"]');
const FP = read("static", "floatpanels.js"), PN = read("ext", "imageeditdock", "pcpanels.js");
check("wiring: a floating docker's title drag looks for a drop zone when no named docker is under it (the orange marker), drops through host.drop; placeAt = a panel's new home; the column registers its zones, keeps its order (pc.order) and width (pc.sideW, the left-edge grip #pcSideGrip 200 - 640 px)",
  /zone = over \? null : zoneAt\(r, m\.clientX, m\.clientY\)/.test(FP) && /zone\.host\.drop\(r\.id, zone\.zone\.key\)/.test(FP) && /function placeAt\(id, parent, before\)/.test(FP) && /columnZones, zoneHost, zoneAt, placeAt/.test(FP)
  && /P\.zoneHost\(\{ id: "ie\.column"/.test(PN) && /E\.store\.set\("pc\.order"/.test(PN) && /E\.store\.set\("pc\.sideW"/.test(PN) && /grip\.id = "pcSideGrip"/.test(PN) && /Math\.max\(200, Math\.min\(640/.test(PN));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
