#!/usr/bin/env node
/* bitGen Studio — 2.694.0: THE SKETCHER'S ROOF FRAMING - ext/pushpulldock/ppstruct.js cleanRoofFr / roofFrames (rafters, ridge,
 * hips / valleys, breaks, ceiling joists, underpurlins + struts; trusses laid out) / drawBeam / the schedule rows / build; pparch
 * roof.fr + the see-through roof; the roof panel's 🪵 Roof framing. The browser: scripts/test-ui694-ui.js.
 * Tim (verbatim): "go ahead" (roof framing, after 2.693.0's wall framing) */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
globalThis.polygonClipping = require(path.join(ROOT, "static", "vendor", "polygon-clipping.umd.min.js"));
const S = require(path.join(ROOT, "ext", "pushpulldock", "ppstruct.js"));
const P = require(path.join(ROOT, "ext", "pushpulldock", "pparch.js"));
const H = P.structH;
const make = (type, fr, w) => { const A = P.empty(), R = P.addRoom(A, P.rectPts([0, 0], [w || 8, 5]), true), rf = P.addRoof(A, [R.id], { type, pitch: 25 }); if (fr) rf.fr = S.cleanRoofFr(fr); return { A, R, rf, F: S.roofFrames(A, rf, H) }; };
const c = S.cleanRoofFr({ kind: "x", rafter: { D: 5 }, trussAt: 9, cj: { span: 99 } });
check("cleanRoofFr: rafters by default (140 × 45 @ 600), ceiling joists 120 × 35 @ 600 held up every 2.4 m, underpurlin past 2.4 m, trusses @ 600 - held to sense",
  c.kind === "rafters" && c.rafter.D === 35 && c.trussAt === 1.2 && c.cj.span === 8 && S.cleanRoofFr({}).rafter.D === 140 && S.cleanRoofFr({}).cj.at === 0.6 && S.cleanRoofFr({}).purlin === 2.4);
const g = make("gable"), parts = (F, k) => F.beams.filter((b) => b.part === k);
check("a gable: rafters down both faces at the spacing, one ridge along the top, no hips, ceiling joists on the plates",
  g.F.n.rafters >= 2 * Math.ceil(8.2 / 0.6) && parts(g.F, "ridge").length === 1 && !g.F.n.hips && g.F.n.cj >= Math.ceil(8 / 0.6), g.F.n);
const top = g.R.z + g.R.h;
check("ceiling joists sit on the top plates (their underside at the walls' top), rafters above them up to the ridge", parts(g.F, "ceiling joist").every((b) => Math.abs(b.a[2] - (top + 0.06)) < 1e-6) && parts(g.F, "rafter").every((b) => Math.max(b.a[2], b.b[2]) > top));
check("a 5 m wide gable's slopes run 2.5 m+: an underpurlin half way up each, struts down to the ceiling joists", parts(g.F, "underpurlin").length === 2 && g.F.n.struts >= 4 && parts(g.F, "strut").every((b) => Math.abs(b.a[2] - (top + 0.12)) < 1e-6 && b.b[2] > b.a[2]));
check("…the rafters' checked span is to the underpurlin (half the slope), along the slope", Math.abs(g.F.rSpan - g.F.run / 2 / Math.cos(25 * Math.PI / 180)) < 1e-9 && g.F.checks.rafter.ok && g.F.checks.cj.ok);
const np = make("gable", { purlin: 0 });
check("no underpurlin (0 = never): the rafters span the whole slope, harder to pass", !parts(np.F, "underpurlin").length && np.F.checks.rafter.util > g.F.checks.rafter.util);
const hp = make("hip");
check("a hip: 4 hip rafters on the sloped edges, a short ridge, jack rafters on the hip ends", hp.F.n.hips === 4 && parts(hp.F, "ridge").length === 1 && hp.F.n.ridge < 8 && hp.F.n.rafters > g.F.n.rafters);
const gm = make("gambrel");
check("a gambrel: one ridge, the two level breaks between the steep and shallow slopes are break purlins (not ridges)", parts(gm.F, "ridge").length === 1 && parts(gm.F, "break purlin").length === 2);
check("a pyramid: 4 hips, no ridge; a shed (skillion): one slope, no ridge", make("pyramid").F.n.hips === 4 && !make("pyramid").F.n.ridge && !make("shed").F.n.ridge && make("shed").F.n.rafters > 0);
check("flat / follow-the-walls roofs and a roof set to None are not framed", make("flat").F === null && make("gable", { kind: "none" }).F === null);
const tr = make("gable", { kind: "trusses", trussAt: 0.6 });
check("trusses: one at each spacing (top chords on the underside, a bottom chord on the plates, webs) - no rafter checks (the truss maker designs them)",
  tr.F.n.trusses === Math.floor((8 - 0.1) / 0.6) + 1 && parts(tr.F, "truss bottom chord").length === tr.F.n.trusses && parts(tr.F, "truss web").length >= 3 * tr.F.n.trusses && tr.F.checks === null, tr.F.n);
const small = make("gable", { rafter: { D: 70, B: 35 }, purlin: 0 });
check("a 70 × 35 rafter over the whole slope: ✗, the smallest that passes suggested", !small.F.checks.rafter.ok && small.F.checks.rafter.best && small.F.checks.rafter.best.D > 70);
const out = { polys: [] }; S.drawBeam({ a: [0, 0, 0], b: [3, 0, 1], w: 0.045, d: 0.14 }, "#fff", {}, out);
check("drawBeam: a sloped member as 6 faces", out.polys.length === 6 && out.polys.every((p) => p.rings[0].length === 4));
const C = P.clean(JSON.parse(JSON.stringify(g.A)));
const off = P.build(C).polys.filter((p) => p.tag && p.tag.ak === "roof" && p.tag.part === "frame").length; C.struct.show = true; const B2 = P.build(C);
check("drawn only with 🪵 Show framing (tag roof part frame) - and the roof itself see-through then", off === 0 && B2.polys.filter((p) => p.tag && p.tag.ak === "roof" && p.tag.part === "frame").length > 300 && B2.polys.some((p) => p.layer === "roof" && p.alpha === 0.25));
check("clean keeps a roof's frame; the schedule lists rafters, ceiling joists, ridge, hips, underpurlins (or the trusses)",
  P.clean(JSON.parse(JSON.stringify(tr.A))).roofs[0].fr.kind === "trusses" && S.schedule(g.A, H).filter((r) => /^Roof/.test(r.room)).length === 5 && S.schedule(tr.A, H).some((r) => /Trusses/.test(r.kind)));
const T = fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "pparchtools.js"), "utf8");
check("wired: the roof panel's 🪵 Roof framing (frame, rafters, spacing, underpurlin, ceiling joists, their support, ✔ Size them, totals)", /function structRoof\(rf\)/.test(T) && /structRoof\(rf\);/.test(T) && /Underpurlin when a slope runs past/.test(T) && /the truss maker designs them/.test(T));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
