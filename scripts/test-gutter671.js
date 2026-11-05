#!/usr/bin/env node
/* bitGen Studio — 2.671.0: GUTTER PROFILES (ext/pushpulldock/ppprofile.js kind "gutter" + its built-in sections; pparch.js
 * gutterProfile - a roof's gutter swept with its profile; lib/ppProfiles.js takes the kind). The editor in a real browser:
 * scripts/test-ui671-ui.js.
 * Tim (verbatim): "create an editor for gutter profile in the same way," */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const PF = require(path.join(ROOT, "ext/pushpulldock/ppprofile.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

// the kind + its built-in sections
const G = PF.presets("gutter"), byKey = (k) => PF.byId("preset:gutter-" + k);
check("a new profile kind: Gutter (x out from the fascia, y up from its bottom), default Quad", PF.KINDS.gutter && PF.KINDS.gutter.label === "Gutter" && PF.KINDS.gutter.def === "preset:gutter-quad");
check("built in: Quad (box), Half round, OG (ogee front), Square line (deep)", G.map((p) => p.name).join("|") === "Quad (box)|Half round|OG (ogee front)|Square line (deep)", G.map((p) => p.name));
const half = byKey("half"), og = byKey("ogee"), quad = byKey("quad");
check("Half round: 4 nodes - each arc (outside, inside) ONE curve, its ends the only nodes on it", half.path.n.length === 4 && half.path.c.filter(Boolean).length === 2, half.path);
const ci = half.path.c.findIndex(Boolean), m = PF.bez(half.path.n[ci], half.path.c[ci][0], half.path.c[ci][1], half.path.n[(ci + 1) % 4], 0.5);
check("…its outside curve's middle is the bottom of the 125 mm circle", near(m[0], 0.0625, 1e-4) && near(m[1], 0, 1e-4), m);
check("OG: its front an ogee (two curves - outside and inside), Quad all straight lines", og.path.c.filter(Boolean).length === 2 && quad.path.c.every((c) => c === null));
check("every gutter counter-clockwise, sizes: Quad 125 × 110, Half round 125 × 62.5 mm", G.every((p) => PF.area2(p.pts) > 0) && near(PF.size(quad).w, 0.125) && near(PF.size(quad).h, 0.11) && near(PF.size(half).w, 0.125) && near(PF.size(half).h, 0.0625, 1e-6), [PF.size(quad), PF.size(half)]);
check("a thumbnail: the fascia as a line, the section filled", /<polygon/.test(PF.svg(og, 40, 40)) && /M[\d.]+ 0V40/.test(PF.svg(og, 40, 40)));

// a roof's gutter = its profile swept
const make = (o, extra) => { let A = P.empty(); const R = P.addRoom(A, P.rectPts([0, 0], [8, 5]), {}); P.addRoof(A, [R.id], Object.assign({ type: "gable", pitch: 30, over: 0.45, fascia: true }, o)); Object.assign(A, extra || {}); A = P.clean(A); return A; };
const gut = (A) => P.build(A).polys.filter((p) => p.tag && p.tag.ak === "roof" && p.tag.part === "gutter");
const key = (L) => L.map((p) => p.rings[0].map((q) => q.map((v) => v.toFixed(5)).join(",")).sort().join(";")).sort().join("|");
const zs = (L) => { const z = L.flatMap((p) => p.rings[0].map((q) => q[2])); return [Math.min(...z), Math.max(...z)]; };
const PPsave = globalThis.PPProfile;
globalThis.PPProfile = undefined;
const oldQ = gut(make({ gutter: "quad" })), oldH = gut(make({ gutter: "half" }));
globalThis.PPProfile = PF;
const newQ = gut(make({ gutter: "quad" })), newH = gut(make({ gutter: "half" }));
check("Quad from its profile = the 2.668.0 gutter exactly (every point)", oldQ.length === 20 && key(oldQ) === key(newQ), [oldQ.length, newQ.length]);
check("Half round from its profile: the same top and depth as before, smoother (its curve flattened)", near(zs(oldH)[0], zs(newH)[0], 1e-6) && near(zs(oldH)[1], zs(newH)[1], 1e-6) && newH.length > oldH.length, [zs(oldH), zs(newH), oldH.length, newH.length]);
const zq = zs(newQ), zo = zs(gut(make({ gutter: "ogee" }))), zsq = zs(gut(make({ gutter: "square" })));
check("OG and Square line: their own shapes (Square line 25 mm deeper than Quad, the backs' tops level)", gut(make({ gutter: "ogee" })).length > 20 && near(zsq[0], zq[0] - 0.025, 1e-6) && near(zo[0], zq[0], 1e-6), { zq, zo, zsq });
// your own: the model's copy (custom + gutterP)
const mine = PF.clean({ id: "pg1", kind: "gutter", name: "Wide box", path: { n: [[0, 0.15], [0, 0], [0.2, 0], [0.2, 0.15], [0.195, 0.15], [0.195, 0.005], [0.005, 0.005], [0.005, 0.15]], c: [null, [[0.05, -0.04], [0.15, -0.04]], null, null, null, null, null, null] } });
const Am = make({ gutter: "custom", gutterP: "pg1" }, { profiles: [mine] });
check("clean: the roof keeps its gutter profile's id (custom), the model its copy with its curve", Am.roofs[0].gutter === "custom" && Am.roofs[0].gutterP === "pg1" && Am.profiles[0].path && Am.profiles[0].path.c.filter(Boolean).length === 1, Am.roofs[0]);
const gm = gut(Am), zm = zs(gm);
check("your own gutter swept: 150 mm deep + its curved bottom (40 mm deeper at most), the back's top level with the others", gm.length > 20 && near(zm[1] - 0.0, zq[1], 0.02) && zm[0] < zq[0] - 0.04 && zm[0] > zq[0] - 0.12, { zm, zq });
const GPm = P.gutterProfile(Am, Am.roofs[0]);
check("gutterProfile: its width 200 mm (downpipes and the gutter's ends from it), its back's top at the roof's edge", near(GPm.w, 0.2) && near(GPm.depth, 0.15 + 0.03, 1e-3) && near(Math.max(...GPm.prof(0, 1).filter((q) => q[0] < 0.001).map((q) => q[1])), 1), GPm);
check("a missing profile (custom, its copy gone): the default Quad", key(gut(make({ gutter: "custom", gutterP: "nope" }))) === key(newQ));
check("clean: an unknown gutter = none; GUTTERS + ogee / square / custom", P.clean({ rooms: [{ id: 1, pts: [[0, 0], [4, 0], [4, 3], [0, 3]], closed: true }], roofs: [{ id: 2, rooms: [1], gutter: "x", gutterP: 5 }] }).roofs[0].gutter === "none" && P.clean({ rooms: [{ id: 1, pts: [[0, 0], [4, 0], [4, 3], [0, 3]], closed: true }], roofs: [{ id: 2, rooms: [1], gutterP: 5 }] }).roofs[0].gutterP === "" && JSON.stringify(P.GUTTERS) === '["none","quad","half","ogee","square","custom"]');
globalThis.PPProfile = PPsave;

// the server's library takes gutters
const LP = require(path.join(ROOT, "lib", "ppProfiles.js"));
const chk = LP.check({ kind: "gutter", name: "x", pts: mine.pts, path: mine.path });
check("lib/ppProfiles.js: a gutter profile saved (its curve kept)", LP.KINDS.includes("gutter") && chk.kind === "gutter" && chk.path.c.filter(Boolean).length === 1);

// the editor + the roof's panel
const DL = read("ext/pushpulldock/ppprofiledlg.js"), T = read("ext/pushpulldock/pparchtools.js");
check("the profile editor: a Gutter view (the fascia on its left, y up) - the same Bézier editing as the others", /gutter: \{ to: \(q\) => \[q\[0\], q\[1\]\], from: \(d\) => \[d\[0\], d\[1\]\], ref: "fascia" \}/.test(DL) && /V\.ref === "fascia"/.test(DL));
check("a profile kept in the model keeps its curves (2.670.0 left them out)", /p\.path \? \{ path: PF\(\)\.pathOf\(p\) \} : \{\}/.test(DL));
check("the roof's panel: Gutters (the built-in ones), Gutter profile (pictures, ✎), ✎ Gutter profiles…; a new roof takes the tool's profile",
  /"Gutter profile"/.test(T) && /PU\.dropdown\(\{ kind: "gutter"/.test(T) && /✎ Gutter profiles…/.test(T) && /PD\.open\(\{ kind: "gutter"/.test(T) && /gutterP: r\.gutterP \|\| ""/.test(T) && (T.match(/k === "gutterSet"/g) || []).length === 2);
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
