#!/usr/bin/env node
/* bitGen Studio — 2.689.0: THE SKETCHER'S CUPBOARDS & SHELVING - ext/pushpulldock/ppjoinery.js (the design, its runs / bays /
 * boxes / plan / front view), PPFurn's "joinery" items, lib/ppJoinery.js (your templates, every project). The browser:
 * scripts/test-ui689-ui.js.
 * Tim (verbatim): "add a shelf/cupboard dialog for builtin cupboards, walk-in robes etc. must be customizable and be able to save
 * as template" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const J = require(path.join(ROOT, "ext", "pushpulldock", "ppjoinery.js"));
const inside = (spec) => { const D = J.dims(spec), e = 1e-6; return J.boxes(spec).filter((b) => b.c[0] - b.s[0] / 2 < -D.w / 2 - e || b.c[0] + b.s[0] / 2 > D.w / 2 + e || b.c[1] - b.s[1] / 2 < -D.d / 2 - e || b.c[1] + b.s[1] / 2 > D.d / 2 + e || b.c[2] - b.s[2] / 2 < -e || b.c[2] + b.s[2] / 2 > D.h + e).length === 0; };
check("9 built-in templates: robes (sliding, hinged), walk-in robes (U, L), linen, pantry, broom, bookshelf, shelving", J.PRESETS.length === 9 && ["Walk-in robe · U", "Walk-in robe · L", "Linen cupboard", "Pantry", "Broom cupboard", "Bookshelf", "Shelving unit"].every((n) => J.PRESETS.some((p) => p.name === n)));
check("every template (doors shown and hidden) builds INSIDE its outline - handles and doors in its own depth", J.PRESETS.every((p) => inside(p.spec) && inside(Object.assign({}, p.spec, { showDoors: false }))));
const c = J.clean({ layout: "U", w: 99, d: 0.05, h: -3, side: 0.2, runs: [{ bays: [{ kind: "nope", shelves: 400 }] }], doors: "?", col: { body: "javascript:x", doors: "mat:oak" } });
check("clean(): numbers held (12 m, 15 cm, 30 cm high, the side past the depth), a U gets 3 runs, a bay's kind / counts checked, a bad colour = the default, a paint kept",
  c.w === 12 && c.d === 0.15 && c.h === 0.3 && c.side >= c.d + 0.3 && c.runs.length === 3 && c.runs[0].bays[0].kind === "shelves" && c.runs[0].bays[0].shelves === 20 && c.doors === "none" && c.col.body === J.COLS.body && c.col.doors === "mat:oak", c);
const U = J.clean(J.PRESETS[2].spec), R = J.runsOf(U);
check("a U: the back run along the whole width, the left / right runs from the back run's front face to the open end (no overlap)",
  R.length === 3 && R[0].L === U.w && Math.abs(R[1].L - (U.side - U.d)) < 1e-9 && R[1].f[0] === 1 && R[2].f[0] === -1);
const bb = J.bays({ L: 2.4 }, [{ w: 0 }, { w: 0.5 }, { w: 0 }], 0.018);
check("bays: a fixed one as given (500 mm inside), the others share what is left, boards between", Math.abs(bb[1].x1 - bb[1].x0 - 0.5) < 1e-9 && Math.abs((bb[0].x1 - bb[0].x0) - (bb[2].x1 - bb[2].x0)) < 1e-9 && Math.abs(bb[2].x1 + 0.018 - 2.4) < 1e-9);
const parts = (s) => { const o = {}; J.boxes(s).forEach((b) => { o[b.part] = (o[b.part] || 0) + 1; }); return o; };
const hinged = parts(J.PRESETS[1].spec), slide = parts(J.PRESETS[0].spec), book = parts(J.PRESETS[7].spec);
check("what is built: a hanging bay = a shelf + a rail, drawers, hinged doors per bay (a wide bay = 2), sliding = panels across, a bookshelf none",
  hinged.rail === 2 && hinged.drawer === 3 && hinged.door === 5 && slide.door === 2 && slide.rail === 3 && !book.door && book.shelf === 15, { hinged, slide, book });
const pl = J.plan(U);
check("the plan: each run's outline, the hanging rails dashed (a U robe: 4 of them = its hanging bays)", pl.filter((q) => q.dash).length === 4 && pl.filter((q) => !q.dash).length >= 12);
const sv = J.elevation(J.PRESETS[1].spec, 0), ps = J.planSvg(U);
check("the front view (SVG): boards, drawers, the doors dashed, its size; the plan view says where the wall is", /<svg/.test(sv) && /ppj-drawer/.test(sv) && /ppj-door/.test(sv) && /1800 × 2400 mm/.test(sv) && /the wall at the top/.test(ps));
const it = J.makeItem(U, [2, 1], 0, 450);
check("makeItem: a joinery item - its size the design's outside (U: width × robe depth), turned 0-359", it.type === "joinery" && it.w === U.w && it.d === U.side && it.rot === 90 && it.spec.layout === "U");
global.window = globalThis; require(path.join(ROOT, "static", "housegeo.js")); const F = require(path.join(ROOT, "ext", "pushpulldock", "ppfurn.js"));
const back = F.clean([Object.assign({}, it, { id: 3, w: 99 })]);
check("PPFurn: clean keeps a joinery item (its size from its design again), its label is its name", back.length === 1 && back[0].type === "joinery" && back[0].w === U.w && F.label(back[0]) === U.name);
J.apply(it, Object.assign({}, it.spec, { w: 3.1, layout: "run" }));
check("apply(): a changed design - the item's size follows (straight: the depth is the cupboard's)", it.w === 3.1 && it.d === it.spec.d && it.spec.runs.length === 1);
// your templates
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jn689-")); process.env.BITGEN_JOINERY_DIR = dir;
const L = require(path.join(ROOT, "lib", "ppJoinery.js"));
const a = L.save({ name: "Mine", spec: J.PRESETS[0].spec }), b2 = L.save({ name: "mine", spec: Object.assign({}, J.PRESETS[0].spec, { w: 1.5 }) });
check("lib: save -> an id, kept in <dir>/templates.json; the same name (any case) replaces it", a.template.id === b2.template.id && L.list().length === 1 && L.list()[0].spec.w === 1.5 && fs.existsSync(path.join(dir, "templates.json")));
let e1 = "", e2 = ""; try { L.save({ name: "", spec: {} }); } catch (e) { e1 = e.message; } try { L.save({ id: "preset:robe2", name: "x", spec: {} }); } catch (e) { e2 = e.message; }
check("lib: no name / a built-in id refused in words", /give the template a name/.test(e1) && /built-in template cannot be changed/.test(e2), [e1, e2]);
L.save({ name: "Two", spec: J.PRESETS[2].spec }); const rm = L.remove(a.template.id);
check("lib: remove -> the rest", rm.ok && rm.templates.length === 1 && rm.templates[0].name === "Two");
fs.rmSync(dir, { recursive: true, force: true });
const RI = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8"), EJ = JSON.parse(fs.readFileSync(path.join(ROOT, "ext", "pushpulldock", "ext.json"), "utf8")), GI = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
check("wired: /api/pushpull-joinery mounted from routes/index.js (not server.js), ppjoinery after ppfurn, the dialog after the profile dialog, /joinery/ ignored",
  /require\("\.\/ppJoinery"\)\.mount\(app\)/.test(RI) && EJ.scripts.indexOf("ppjoinery.js") === EJ.scripts.indexOf("ppfurn.js") + 1 && EJ.scripts.indexOf("ppjoinerydlg.js") > EJ.scripts.indexOf("ppprofiledlg.js") && /^\/joinery\/$/m.test(GI));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
