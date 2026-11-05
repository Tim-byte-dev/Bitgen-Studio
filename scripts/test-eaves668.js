#!/usr/bin/env node
/* bitGen Studio — 2.668.0: THE SKETCHER'S EAVES, FASCIAS, GUTTERS (ext/pushpulldock/pparch.js eaveParts + the Roof panel in
 * pparchtools.js). The panel in a real browser: scripts/test-ui668-ui.js.
 * Tim (verbatim): "please add eaves and eave styles to sketcher like open eaves, boxed eaves,closed eaves, and facias and
 * gutters" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));

const make = (o) => { let A = P.empty(); const R = P.addRoom(A, P.rectPts([0, 0], [8, 5]), {}); P.addRoof(A, [R.id], Object.assign({ type: "gable", pitch: 30, over: 0.45 }, o)); A = P.clean(A); return A; };
const parts = (A) => { const c = {}; P.build(A).polys.forEach((p) => { if (p.tag && p.tag.ak === "roof") { const k = p.tag.part || "roof"; c[k] = (c[k] || 0) + 1; } }); return c; };
const polysOf = (A, part) => P.build(A).polys.filter((p) => p.tag && p.tag.ak === "roof" && p.tag.part === part);

check("the styles: plain, open, boxed, closed; gutters none, quad, half", JSON.stringify(P.EAVES) === '["plain","open","boxed","closed"]' && JSON.stringify(P.GUTTERS.slice(0, 3)) === '["none","quad","half"]');
const old = make({});
check("an old roof (no eave settings): plain, no fascia, no gutter - exactly as before (no extra parts)", old.roofs[0].eave === "plain" && !old.roofs[0].fascia && old.roofs[0].gutter === "none" && Object.keys(parts(old)).join() === "roof", parts(old));
const cl = P.clean({ rooms: [{ id: 1, pts: [[0, 0], [4, 0], [4, 3], [0, 3]], closed: true }], roofs: [{ id: 2, rooms: [1], eave: "weird", gutter: "x", fasciaH: 9, fascia: 1 }] }).roofs[0];
check("clean: an unknown eave / gutter = plain / none, the fascia height held to 0.05 - 0.6 m, downpipes on unless off", cl.eave === "plain" && cl.gutter === "none" && cl.fasciaH === 0.6 && cl.fascia === true && cl.downpipes === true, cl);

// fascia: along both eaves of a gable + barge boards up the 4 verges, at the roof's edge
const g = make({ fascia: true });
check("fascia on a gable: boards along its 2 eaves + 4 barge boards up the verges (6 boards x 6 faces)", polysOf(g, "fascia").length === 36, parts(g));
const zs = polysOf(g, "fascia").flatMap((p) => p.rings[0].map((q) => q[2])), ys = polysOf(g, "fascia").flatMap((p) => p.rings[0].map((q) => q[1]));
check("…the eave boards hang 200 mm below the roof's top edge, out past the overhang (y below -0.45 - wall half thickness)", Math.min(...ys) < -0.5 && Math.max(...zs) > 2.7, { ymin: Math.min(...ys), zmax: Math.max(...zs) });

// boxed: a flat soffit at the fascia's bottom, from the fascia back to the wall
const bx = make({ eave: "boxed", fascia: true });
const sof = polysOf(bx, "soffit"), top = sof.filter((p) => p.n[2] > 0.99);
check("boxed: a flat soffit along each eave (its top face level)", sof.length === 12 && top.length === 2 && top.every((p) => { const z = p.rings[0].map((q) => q[2]); return Math.max(...z) - Math.min(...z) < 1e-9; }), parts(bx));
// closed: on the slope
const cd = make({ eave: "closed", fascia: true });
const ctop = polysOf(cd, "soffit").filter((p) => p.n[2] > 0.5);
check("closed: the lining follows the roof's slope (its top face not level - rises toward the wall)", ctop.length === 2 && ctop.every((p) => { const z = p.rings[0].map((q) => q[2]); return Math.max(...z) - Math.min(...z) > 0.2; }), ctop.map((p) => p.rings[0].map((q) => +q[2].toFixed(3))));
// open: rafter tails 600 mm apart
const op = make({ eave: "open" });
const raf = polysOf(op, "rafter").length / 6;
check("open: rafter tails along both eaves, 600 mm apart (9.05 m with the overhangs - 14 each)", raf === 28, raf);
// hip: soffits mitred at the corners, rafters kept off the corners
const hp = make({ type: "hip", eave: "boxed", fascia: true });
check("hip: a soffit along all four eaves (mitred - 4 boards)", polysOf(hp, "soffit").filter((p) => p.n[2] > 0.99).length === 4);
// gutters + downpipes
const gq = make({ fascia: true, gutter: "quad" }), gh = make({ fascia: true, gutter: "half", downpipes: false });
check("quad gutters: along both eaves (a U section, open on top), a downpipe for each", polysOf(gq, "gutter").length === 20 && polysOf(gq, "downpipe").length === 24, parts(gq));
check("half-round gutters, downpipes off", polysOf(gh, "gutter").length > 20 && polysOf(gh, "downpipe").length === 0, parts(gh));
const dp = polysOf(gq, "downpipe").flatMap((p) => p.rings[0].map((q) => q[2]));
check("…a downpipe reaches the floor (z 0)", Math.min(...dp) === 0, Math.min(...dp));
check("every part's points are numbers (all twelve roof types x three eave styles)", P.ROOFS.every((t) => ["open", "boxed", "closed"].every((e) => P.build(make({ type: t, eave: e, fascia: true, gutter: "quad" })).polys.every((p) => p.rings.every((r) => r.every((q) => q.every(Number.isFinite)))))));
check("a shed (skillion): the eave on its low side only (one gutter run)", polysOf(make({ type: "shed", gutter: "quad", fascia: true }), "gutter").length === 10);

const T = read("ext/pushpulldock/pparchtools.js");
check("the Roof panel: the eaves as pictures ([data-eave]), Fascia + barge boards, Fascia height, Gutters, Downpipes; colours for the picked roof", /dataset\.eave/.test(T) && /"Fascia \+ barge boards"/.test(T) && /"Fascia height"/.test(T) && /"Gutters"/.test(T) && /"Downpipes"/.test(T) && /"Gutter colour"/.test(T) && /"Fascia \/ soffit colour"/.test(T));
check("a new roof from the Roof tool: boxed eaves, a fascia, quad gutters, downpipes", /eave: "boxed", fascia: true, gutter: "quad", downpipes: true/.test(T) && /eave: r\.eave \|\| "boxed"/.test(T));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
