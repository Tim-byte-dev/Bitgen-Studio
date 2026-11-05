#!/usr/bin/env node
/* bitGen Studio — 2.640.0: THE SKETCHER'S PROFILES + PER-PART PROPERTIES, the pure part (ext/pushpulldock/ppprofile.js,
 * pparch.js's swept skirting / cornice, door / window frames, sills, one wall's length / height / colour) + the wiring
 * (the dialog / dropdown file, the panels, the route mounted from routes/index.js - never server.js, lib/ppProfiles.js). */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
globalThis.polygonClipping = require(path.join(ROOT, "static/vendor/polygon-clipping.umd.min.js"));
const PF = require(path.join(ROOT, "ext/pushpulldock/ppprofile.js"));
const P = require(path.join(ROOT, "ext/pushpulldock/pparch.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

// ---- the built-in profiles
const kinds = Object.keys(PF.KINDS);
check("the kinds: skirting, cornice, door frame, window frame, window sill (+ gutter, 2.671.0)", kinds.join() === "skirt,cornice,doorframe,windowframe,sill,gutter", kinds);
check("built-in: 7 skirting, 6 cornice, 6 door frames, 6 window frames, 5 sills", [7, 6, 6, 6, 5].every((n, i) => PF.presets(kinds[i]).length === n), kinds.map((k) => PF.presets(k).length));
const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const selfX = PF.PRESETS.filter((p) => { const s = p.pts, n = s.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(s[i], s[(i + 1) % n], s[j], s[(j + 1) % n])) return true; } return false; }).map((p) => p.id);
check("every built-in is a simple polygon, counter-clockwise, against its wall (x 0) and its floor / ceiling / edge (y 0)", !selfX.length && PF.PRESETS.every((p) => PF.area2(p.pts) > 0 && Math.min(...p.pts.map((q) => q[0])) === 0 && Math.min(...p.pts.map((q) => q[1])) <= 0), selfX);
check("each kind's default is a built-in of that kind", kinds.every((k) => { const d = PF.byId(PF.KINDS[k].def); return d && d.kind === k; }));
const sq = PF.byId("preset:skirt-square");
check("the default skirting = the 2.639.0 box (15 mm deep, 100 mm high)", near(PF.size(sq).w, 0.015) && near(PF.size(sq).h, 0.1));

// ---- clean
check("clean: a clockwise one turned round, repeats dropped, numbers kept to 1 m", (() => { const c = PF.clean({ name: "x", kind: "skirt", pts: [[0, 0], [0, 0.1], [0, 0.1], [0.02, 0.1], [0.02, 0], [0, 0]] }); return c && c.pts.length === 4 && PF.area2(c.pts) > 0 && /^p/.test(c.id); })());
check("clean: refuses a wrong kind, under 3 points, no area", [{ kind: "door", pts: [[0, 0], [1, 0], [0, 1]] }, { kind: "skirt", pts: [[0, 0], [1, 0]] }, { kind: "skirt", pts: [[0, 0], [0.5, 0], [1, 0]] }].every((x) => PF.clean(x) === null));
check("cleanList: built-in ids and repeats left out (they are not the user's)", PF.cleanList([{ id: "preset:skirt-square", kind: "skirt", pts: sq.pts }, { id: "a1", kind: "sill", pts: sq.pts }, { id: "a1", kind: "sill", pts: sq.pts }]).map((p) => p.id).join() === "a1");
check("resolve: the model's own > built-in > the kind's default (a wrong kind / a missing one)", PF.resolve({ profiles: [{ id: "m1", kind: "skirt", pts: sq.pts, name: "M" }] }, "m1", "skirt").id === "m1" && PF.resolve(null, "preset:skirt-ogee", "skirt").id === "preset:skirt-ogee" && PF.resolve(null, "preset:cornice-cove", "skirt").id === "preset:skirt-square" && PF.resolve(null, "nope", "sill").id === "preset:sill-square");
check("fit: skirting to its height (depth kept), a cornice to its size (both ways), frames as drawn", (() => { const a = PF.fit(sq, "skirt", 0.2), c = PF.fit(PF.byId("preset:cornice-square"), "cornice", 0.16), f = PF.fit(PF.byId("preset:doorframe-flat"), "doorframe", 9); return near(Math.max(...a.map((q) => q[1])), 0.2) && near(Math.max(...a.map((q) => q[0])), 0.015) && near(Math.max(...c.map((q) => q[1])), 0.16) && near(Math.max(...c.map((q) => q[0])), 0.12) && near(Math.max(...f.map((q) => q[1])), 0.07); })());

// ---- thumbnails
const sv = PF.svg(PF.byId("preset:cornice-cove"), 40, 40);
check("svg: a 40 × 40 picture - the profile filled, the wall / ceiling line, no NaN", /^<svg[^>]+width="40"/.test(sv) && /<polygon points="/.test(sv) && /<path d="M/.test(sv) && !/NaN/.test(sv), sv.slice(0, 200));
check("svg of every built-in has no NaN and stays in its box", PF.PRESETS.every((p) => { const s = PF.svg(p, 48, 48), pts = /points="([^"]+)"/.exec(s)[1].split(" ").map((x) => x.split(",").map(Number)); return !/NaN/.test(s) && pts.every((q) => q[0] >= -0.01 && q[0] <= 48.01 && q[1] >= -0.01 && q[1] <= 48.01); }));

// ---- the sweep
const map = (q, b) => [q[0], q[1], b];
const loop = [[0, 0], [4, 0], [4, 3], [0, 3]];
const cl = PF.sweep(loop, true, sq.pts, map, "#fff", { t: 1 });
check("a closed sweep: 4 sides × 4 section edges = 16 faces, no caps", cl.polys.length === 16, cl.polys.length);
const mitre = cl.polys.flatMap((p) => p.rings[0]).filter((q) => near(q[2], 0.1) && near(q[0], 0.015, 1e-9) && near(q[1], 0.015, 1e-9));
check("…mitred: the front face meets at (0.015, 0.015) in the corner", mitre.length >= 2, mitre.length);
const outward = cl.polys.every((p) => { const c = p.rings[0].reduce((s, q) => [s[0] + q[0] / 4, s[1] + q[1] / 4, s[2] + q[2] / 4], [0, 0, 0]); const n = p.n; return Math.abs(n[2]) > 0.9 ? (n[2] > 0 ? near(c[2], 0.1) : near(c[2], 0)) : true; });
check("…its top faces up, its bottom down", outward);
const front = cl.polys.filter((p) => Math.abs(p.n[2]) < 0.1 && p.rings[0].every((q) => near(q[1], 0.015) || near(q[0], 0.015) || near(q[1], 2.985) || near(q[0], 3.985)));
check("…its front faces point into the room (away from the wall)", front.length === 4 && front.every((p) => { const c = p.rings[0].reduce((s, q) => [s[0] + q[0] / 4, s[1] + q[1] / 4], [0, 0]); return (c[0] - 2) * p.n[0] + (c[1] - 1.5) * p.n[1] < 0; }), front.map((p) => p.n));
const op = PF.sweep([[0, 0], [4, 0], [4, 3]], false, sq.pts, map, "#fff", {});
check("an open sweep: 2 sides × 4 + 2 end caps = 10 faces; the caps face out along the chain", op.polys.length === 10 && near(op.polys[8].n[0], -1) && near(op.polys[9].n[1], 1), op.polys.slice(8).map((p) => p.n));
check("a degenerate chain / section draws nothing (no throw)", PF.sweep([[0, 0]], false, sq.pts, map).polys.length === 0 && PF.sweep(loop, true, [[0, 0], [1, 1]], map).polys.length === 0);
check("chainsBetween: a gap [1, 2] on a 14 m loop -> one open piece from 2 round to 1", (() => { const c = P.chainsBetween(loop, [0, 4, 7, 11], 14, [[1, 2]]); return c.length === 1 && !c[0].closed && JSON.stringify(c[0].pts) === "[[2,0],[4,0],[4,3],[0,3],[0,0],[1,0]]"; })());
check("…no gap: the whole loop closed; two gaps: two pieces", P.chainsBetween(loop, [0, 4, 7, 11], 14, [])[0].closed && P.chainsBetween(loop, [0, 4, 7, 11], 14, [[1, 2], [8, 9]]).length === 2);

// ---- the building with profiles
const A = P.empty(), R = P.addRoom(A, [[0, 0], [5, 0], [5, 4], [0, 4]]);
const d = P.addOp(A, "door", { room: R.id, edge: 0, at: 2 }), w = P.addOp(A, "window", { room: R.id, edge: 0, at: 4 });
check("a new room / door / window: default profiles (\"\"), no frame, no sill, their own colours", R.skirtP === "" && R.cornP === "" && R.skirtCol && R.cornCol && d.frameP === "" && w.sillP === "" && d.trimCol);
const B0 = P.build(A), cnt = (B, f) => B.polys.filter(f).length;
check("the default skirting / cornice are swept boxes; no frames", cnt(B0, (p) => p.tag.part === "skirt") > 0 && cnt(B0, (p) => p.tag.part === "cornice") === 16 && cnt(B0, (p) => p.tag.part === "frame") === 0);
d.frameP = "preset:doorframe-flat"; w.frameP = "preset:windowframe-flat"; w.sillP = "preset:sill-square"; R.skirtP = "preset:skirt-ogee"; R.cornP = "preset:cornice-cove";
const B = P.build(A), bb = (f) => { const q = B.polys.filter(f).flatMap((p) => p.rings[0]); return [0, 1, 2].map((k) => [Math.min(...q.map((p) => p[k])), Math.max(...q.map((p) => p[k]))]); };
check("nothing in the building is not a number", B.polys.every((p) => p.rings.every((r) => r.every((q) => q.every(Number.isFinite)))));
const df = bb((p) => p.tag.ak === "op" && p.tag.id === d.id && p.tag.part === "frame");
check("the door's frame: 70 mm round the opening (1.55-2.45), on BOTH faces of the wall, up to 2.17 m", near(df[0][0], 1.48) && near(df[0][1], 2.52) && near(df[1][0], -0.093) && near(df[1][1], 0.093) && near(df[2][0], 0) && near(df[2][1], 2.17), df);
const wf = bb((p) => p.tag.id === w.id && p.tag.part === "frame"), ws = bb((p) => p.tag.id === w.id && p.tag.part === "sill");
check("the window's frame: on the room's side only, standing on the sill (from 0.9 m)", near(wf[1][0], 0.075) && near(wf[1][1], 0.093) && near(wf[2][0], 0.9) && near(wf[0][0], 3.33), wf);
check("the window's sill: under it (0.87-0.9 m), past the frame each side, reaching back to the window's frame", near(ws[2][0], 0.87) && near(ws[2][1], 0.9) && near(ws[0][0], 3.3) && near(ws[0][1], 4.7) && near(ws[1][0], 0.045) && near(ws[1][1], 0.135), ws);
const sk = new Set(B.polys.filter((p) => p.tag.part === "skirt").flatMap((p) => p.rings[0]).filter((q) => near(q[1], 0.075, 0.03) && q[0] > 1.3 && q[0] < 2.7).map((q) => q[0].toFixed(3)));
check("the skirting stops at the door's FRAME (1.48 / 2.52), not at the opening", [...sk].sort().join() === "1.480,2.520", [...sk]);
check("Ogee skirting / Cove cornice: more faces than the boxes", cnt(B, (p) => p.tag.part === "skirt") > cnt(B0, (p) => p.tag.part === "skirt") && cnt(B, (p) => p.tag.part === "cornice") > 16);
check("frameWidth: 0.07 for the flat frame, 0 without one / an opening", near(P.frameWidth(A, d), 0.07) && P.frameWidth(A, { kind: "opening", frameP: "preset:doorframe-flat" }) === 0);
// a profile of the model's own
A.profiles = [{ id: "mine1", name: "Mine", kind: "skirt", pts: [[0, 0], [0.03, 0], [0, 0.2]] }]; R.skirtP = "mine1"; R.skirtH = 0.1;
const Bm = P.build(A), mz = Math.max(...Bm.polys.filter((p) => p.tag.part === "skirt").flatMap((p) => p.rings[0].map((q) => q[2])));
check("the model's own profile: swept, scaled to the skirting's height", near(mz, 0.1) && cnt(Bm, (p) => p.tag.part === "skirt") > 0, mz);
const C = P.clean(JSON.parse(JSON.stringify(A)));
check("clean keeps profile ids, colours, the model's profiles; refuses a bad id", C.rooms[0].skirtP === "mine1" && C.ops[0].frameP === "preset:doorframe-flat" && C.ops[1].sillP === "preset:sill-square" && C.profiles.length === 1 && P.clean({ rooms: [{ pts: [[0, 0], [1, 0], [1, 1]], skirtP: "../x" }] }).rooms[0].skirtP === "");
check("a door keeps no sill (only windows)", P.clean({ rooms: [{ id: 1, pts: [[0, 0], [3, 0], [3, 3]] }], ops: [{ kind: "door", room: 1, edge: 0, at: 1, sillP: "preset:sill-square" }] }).ops[0].sillP === "");
check("an old (2.639) model: no profile fields - defaults, it still builds", (() => { const o = P.clean({ rooms: [{ id: 1, pts: [[0, 0], [3, 0], [3, 3], [0, 3]], skirtOn: true, corniceOn: true, trim: "#123456" }] }); return o.rooms[0].skirtP === "" && o.rooms[0].skirtCol === "#123456" && P.build(o).polys.some((p) => p.tag.part === "skirt"); })());

// ---- one wall's length / height / colour
const A2 = P.empty(), R2 = P.addRoom(A2, [[0, 0], [4, 0], [4, 3], [0, 3]]);
check("a wall's length in a rectangle room: the room keeps its shape (wall 1 -> width, wall 2 -> depth)", P.setWallLength(A2, R2.id, 0, 5) && near(R2.pts[1][0], 5) && near(R2.pts[2][0], 5) && P.setWallLength(A2, R2.id, 1, 3.5) && near(R2.pts[2][1], 3.5) && near(R2.pts[3][1], 3.5), R2.pts);
const R3 = P.addRoom(A2, [[10, 0], [14, 0], [13, 3], [10, 3]]);
check("…another shape: the wall's end corner moves along it; a length under 5 cm refused", P.setWallLength(A2, R3.id, 0, 5) && near(R3.pts[1][0], 15) && near(R3.pts[1][1], 0) && !P.setWallLength(A2, R3.id, 2, 0.01) && near(R3.pts[3][0], 10), R3.pts);
check("a wall's own height: only its top (the walls beside it keep theirs)", P.setWallHeight(A2, R2.id, 1, 3.2) && near(P.profile(R2, 1)[0][1], 3.2) && near(P.profile(R2, 0)[1][1], 2.7) && near(P.profile(R2, 2)[0][1], 2.7));
R2.wcol = { 1: "#336699" };
const Bw = P.build(A2), blue = Bw.polys.filter((p) => p.tag.ak === "wall" && p.col === "#336699");
check("a wall's own inside colour: only its inside faces (x = 5 - half a wall)", blue.length >= 1 && blue.every((p) => p.rings[0].every((q) => near(q[0], 4.925))), blue.map((p) => p.rings[0][0]));
check("wallCol: its own else the room's", P.wallCol(R2, 1) === "#336699" && P.wallCol(R2, 0) === R2.wall);

// ---- the server side
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pp640-"));
const pp = require(path.join(ROOT, "lib/pushPull.js")); pp.setDir(tmp);
const L = require(path.join(ROOT, "lib/ppProfiles.js"));
const s1 = L.save({ name: "Mine", kind: "cornice", pts: [[0, 0], [0.1, 0], [0, 0.1]] });
check("lib/ppProfiles: save gives an id, kept in profiles.json beside the models", /^p/.test(s1.profile.id) && fs.existsSync(path.join(tmp, "profiles.json")) && L.list().length === 1);
const s2 = L.save(Object.assign({}, s1.profile, { name: "Mine 2" }));
check("…save again by id replaces it", L.list().length === 1 && L.list()[0].name === "Mine 2" && s2.profile.id === s1.profile.id);
const bad = (f) => { try { f(); return false; } catch (e) { return e.status === 400; } };
check("…refuses a built-in id, a wrong kind, too few points, numbers over 1 m", bad(() => L.save({ id: "preset:skirt-square", kind: "skirt", pts: sq.pts })) && bad(() => L.save({ kind: "x", pts: sq.pts })) && bad(() => L.save({ kind: "sill", pts: [[0, 0], [1, 1]] })) && bad(() => L.save({ kind: "sill", pts: [[0, 0], [5, 0], [0, 1]] })));
check("…remove", L.remove(s1.profile.id).ok && L.list().length === 0);
check("…pushPull.list() still lists only models (profiles.json is not one)", pp.list().length === 0);
fs.rmSync(tmp, { recursive: true, force: true });

// ---- wiring
const EJ = JSON.parse(read("ext/pushpulldock/ext.json")), IDX = read("routes/index.js"), SRV = read("misc/server.js"), AT = read("ext/pushpulldock/pparchtools.js"), DL = read("ext/pushpulldock/ppprofiledlg.js"), AV = read("ext/pushpulldock/pparchview.js");
check("ext.json: ppprofile.js + ppprofiledlg.js load before pparch.js", EJ.scripts.indexOf("ppprofile.js") >= 0 && EJ.scripts.indexOf("ppprofile.js") < EJ.scripts.indexOf("ppprofiledlg.js") && EJ.scripts.indexOf("ppprofiledlg.js") < EJ.scripts.indexOf("pparch.js"));
check("the route is mounted from routes/index.js - server.js untouched", /require\("\.\/ppProfiles"\)\.mount\(app\)/.test(IDX) && !/ppProfiles|pushpull-profiles/.test(SRV));
check("the panels: a part's own (partPanel), profile dropdowns for skirting / cornice / door frame / window frame / sill", /function partPanel\(R, t\)/.test(AT) && ["\"skirt\", R.skirtP", "\"cornice\", R.cornP", "\"doorframe\" : \"windowframe\"", "\"sill\", op.sillP"].every((s) => AT.includes(s)));
check("Delete on a part turns it off / hides the wall (the room stays)", /t\.ak === "room" && t\.part\) \{/.test(AT) && /floor: "floorOn", ceil: "ceilOn", skirt: "skirtOn", cornice: "corniceOn", slab: "slab"/.test(AT));
check("the dropdown is pictures (no <select>), the dialog a <dialog> (the Sketcher's keys stay out)", /PF\(\)\.svg\(p, 40, 40\)/.test(DL) && /el\("dialog"\)/.test(DL) && /showModal\(\)/.test(DL) && !/createElement\("select"\)|el\("select"/.test(DL.slice(DL.indexOf("function dropdown"), DL.indexOf("/* ---------------- the dialog"))));
check("the view outlines just the picked part (a wall's box / a part's faces); a frame click = its door", /t\.part === "wall" && t\.edge != null\) \{/.test(AV) && /tg\.part === t\.part/.test(AV) && /a door's frame = the door/.test(AV));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
