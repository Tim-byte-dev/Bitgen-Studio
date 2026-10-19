#!/usr/bin/env node
/* bitGen Studio — 2.494.0 units: THE CAD WORKINGS REFINED (pcsketch.js offset / chains / profile picking, pcsketchtools.js
 * the Offset tool + ＋ handles, static/cadbar.js hidden items, pccadbar.js / tlcadbar.js the ⌬ CAD buttons, pcbody.js the
 * view cube + Shift-middle orbit + picking the profile, pc3d.js Shift-middle orbit).
 * Tim (verbatim): "add orbit and pan viewport like fusion 360 does / select shape to extrude,revolve like fusion 360 does /
 * offset doesn't work. when user clicks create sketch hide the create sketch button, when user clicks finish sketch go to
 * solids / when user selects a line in sketch mode allow user to add lines. refine the cad workings / add a cad button in
 * the edit image toolbar and the video editor toolbox. only show cad tools when the cad button is selected or a sketch is
 * selected." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const K = require(path.join(ROOT, "ext", "imageeditdock", "pcsketch.js"));
const CB = require(path.join(ROOT, "static", "cadbar.js"));
const CAD = require(path.join(ROOT, "ext", "imageeditdock", "pccadbar.js"));
const PB = require(path.join(ROOT, "ext", "imageeditdock", "pcbody.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-3 : e);
const areas = (s) => K.profiles(s).map((p) => Math.round(p.area)).sort((x, y) => x - y);

/* ---- offset */
let s = K.create(0, 0), Q = K.rect2(s, [0, 0], [200, 100]), r = K.offset(s, Q.lines, 10);
check("Offset a rectangle +10 = OUT: a 220 x 120 ring round it, 4 joined lines", r.ok && r.ents.length === 4 && JSON.stringify(areas(s)) === "[20000,26400]", areas(s));
s = K.create(0, 0); Q = K.rect2(s, [0, 0], [200, 100]); r = K.offset(s, Q.lines, -10);
check("Offset -10 = IN: 180 x 80 inside", r.ok && JSON.stringify(areas(s)) === "[14400,20000]", areas(s));
s = K.create(0, 0);
{ const a = K.addPoint(s, 0, 0), b = K.addPoint(s, 200, 0), c = K.addPoint(s, 200, 100), d = K.addPoint(s, 0, 100);
  const L = [K.line(s, a, b), K.line(s, c, b), K.line(s, c, d), K.line(s, a, d)];
  const ch = K.chainsOf(s, L); r = K.offset(s, L, 10);
  check("THE BUG: lines drawn every which way (2 of 4 backwards) - one closed chain, and the offset goes OUT all round (before: some in, some out)", ch.length === 1 && ch[0].closed && ch[0].loop.length === 4 && r.ok && JSON.stringify(areas(s)) === "[20000,26400]", { ch: ch.map((c) => [c.closed, c.loop.length]), a: areas(s) }); }
s = K.create(0, 0); Q = K.rect2(s, [0, 0], [200, 100]); K.fillet(s, Q.lines[0], Q.lines[1], 20);
{ const ids = s.ents.filter((e) => !e.axis && (e.t === "line" || e.t === "arc")).map((e) => e.id); r = K.offset(s, ids, 10);
  const A = areas(s), arc = s.ents.filter((e) => e.t === "arc").map((e) => Math.round(Math.hypot(K.pt(s, e.p1).x - K.pt(s, e.c).x, K.pt(s, e.p1).y - K.pt(s, e.c).y))).sort();
  check("a rounded rectangle (a filleted corner): the chain stays CLOSED - the fillet r 20 becomes r 30 (out), the area 220 x 120 less the round corner", r.ok && A.length === 2 && near(A[1], 26400 - (900 - Math.PI * 900 / 4), 8) && arc.join() === "20,30", { A, arc }); }
s = K.create(0, 0); Q = K.rect2(s, [0, 0], [200, 100]);
check("offsetSide: a point inside the rectangle = the inner side, its distance to the nearest edge", (() => { const w = K.offsetSide(s, Q.lines, 100, 30); const w2 = K.offsetSide(s, Q.lines, 100, -30); return w && w2 && w.dist === 30 && w2.dist === 30 && w.side !== w2.side; })());
r = K.offset(s, Q.lines, 10, { toward: [100, 50] });
check("opts.toward (the Offset tool: the pointer's side) inside -> 10 in", r.ok && JSON.stringify(areas(s)) === "[14400,20000]", areas(s));
s = K.create(0, 0);
{ const p = [K.addPoint(s, 0, 0), K.addPoint(s, 100, 0), K.addPoint(s, 100, 100)], O = [K.line(s, p[0], p[1]), K.line(s, p[1], p[2])];
  r = K.offset(s, O, 10, { toward: [50, 50] });
  const got = r.ents.map((id) => K.ptsOf(K.ent(s, id)).map((q) => [Math.round(K.pt(s, q).x), Math.round(K.pt(s, q).y)]));
  check("an open L: both lines move to the pointer's side and meet at (90, 10) - one shared point", r.ok && JSON.stringify(got) === "[[[0,10],[90,10]],[[90,10],[90,100]]]" && K.ent(s, r.ents[0]).p2 === K.ent(s, r.ents[1]).p1, got); }
s = K.create(0, 0); const oc = K.circle(s, [500, 500], 40);
check("a circle: + = bigger (55), toward a point inside = smaller (25)", K.ent(s, K.offset(s, [oc], 15).ents[0]).r === 55 && K.ent(s, K.offset(s, [oc], 15, { toward: [500, 500] }).ents[0]).r === 25);
s = K.create(0, 0); Q = K.rect2(s, [0, 0], [200, 100]);
{ const n0 = s.ents.length, nc = s.cons.length; r = K.offset(K.clone(s), Q.lines, 10, { preview: true }); const t2 = K.clone(s), r2 = K.offset(t2, Q.lines, 10, { preview: true });
  check("opts.preview: the new entities without constraints / dimensions (the drawing while the pointer moves)", r2.ok && r2.ents.length === 4 && t2.cons.length === nc && t2.dims.length === 0 && s.ents.length === n0); }
s = K.create(0, 0); { const c = K.circle(s, [0, 0], 5); r = K.offset(s, [c], -10); check("too far in: nothing (a radius of 0 or less is not made)", r.ents.length === 0); }
s = K.create(0, 0); { const a = K.arc ? null : null; void a; Q = K.rect2(s, [0, 0], [60, 60]); K.fillet(s, Q.lines[0], Q.lines[1], 20); const ids = s.ents.filter((e) => !e.axis && (e.t === "line" || e.t === "arc")).map((e) => e.id); r = K.offset(s, ids, -25);
  check("an inward offset bigger than a fillet's radius: refused with the reason (the sketch not touched by the caller's undo)", !r.ok && /radius/.test(r.why), r.why); }
check("offset(…, 0): refused", !K.offset(K.create(0, 0), [], 0).ok);

/* ---- picking the profile */
s = K.create(0, 0); K.rect2(s, [0, 0], [200, 100]); K.rect2(s, [50, 25], [150, 75]); K.circle(s, [400, 50], 30);
{ const pr = K.profiles(s, { withPaths: false });
  check("profileAt: the plate round the hole (0), the hole (1), the circle (2), nothing (-1)", K.profileAt(s, 10, 10, pr) === 0 && K.profileAt(s, 100, 50, pr) === 1 && K.profileAt(s, 400, 50, pr) === 2 && K.profileAt(s, 300, 300, pr) === -1);
  const ids = s.ents.filter((e) => !e.axis).map((e) => e.id);
  check("profilesOfEnts: the outer rectangle's 4 lines picked = the plate only; all picked = all three", K.profilesOfEnts(s, ids.slice(0, 4), pr).join() === "0" && K.profilesOfEnts(s, ids, pr).length === 3); }

/* ---- the ribbon: hidden items */
const it = [{ sep: true }, { id: "a", run() {}, hidden: () => true }, { id: "b", run() {} }, { sep: true }, { sep: true }, { id: "c", run() {} }, { sep: true }];
check("CadBar.visible: hidden items dropped, no separator first / last / twice; isHidden; firstEnabled skips hidden ones", CB.visible(it).map((i) => i.id || "|").join("") === "b|c" && CB.isHidden(it[1]) && !CB.isHidden(it[2])
  && CB.firstEnabled([{ id: "x", run() {}, hidden: () => true }, { id: "y", run() {} }]).id === "y");
const CBS = read("static", "cadbar.js");
check("cadbar.js: refresh() draws the ribbon again when an item comes / goes; the ▾ menu leaves hidden ones out", /hs !== lastHidden/.test(CBS) && /isHidden\(i\) \? "" :/.test(CBS));

/* ---- the image editor's toolbar */
const PC = read("ext", "imageeditdock", "pccadbar.js");
check("pccadbar: SELECT (Sketch Select) leads the SKETCH tab; Create Sketch hidden while a sketch is edited; Offset = the Offset tool (O)", /label: "Select", show: 1, items: \[tool\("sk_select"/.test(PC) && /hidden: editing/.test(PC) && /sk\(\)\.offsetTool/.test(PC)
  && CAD.SPEC_IDS.tools.includes("sk_select") && CAD.SPEC_IDS.tools.includes("sk_offset") && /^<svg/.test(CAD.ICONS.select) && /^<svg/.test(CAD.ICONS.cad));
check("pccadbar: the ⌬ CAD button (#pcCadBtn) in the tool column pins it (cadbar.ie.on, off by default); otherwise shown only with a sketch / sketch tool / 3D body picked", /btn\.id = "pcCadBtn"/.test(PC) && /store\.get\("cadbar\.ie\.on", false\) === true/.test(PC)
  && /const shown = \(\) => pinned\(\) \|\| context\(\)/.test(PC) && /L\.type === "sketch"/.test(PC) && /isBodyL\(L\)/.test(PC) && /col\.insertBefore\(btn, sw \|\| null\)/.test(PC));
const TC = read("ext", "timelinedock", "tlcadbar.js");
check("tlcadbar: the ⌬ CAD button in the timeline's tool column (#tlCadBtn) shows / hides the toolbar (off by default)", /btn\.id = "tlCadBtn"/.test(TC) && /mem\.get\("tlcadbar\.on", false\) === true/.test(TC) && /tools\.insertBefore\(btn, seps\[0\] \|\| null\)/.test(TC));

/* ---- the sketch tools */
const ST = read("ext", "imageeditdock", "pcsketchtools.js"), ST_ = require(path.join(ROOT, "ext", "imageeditdock", "pcsketchtools.js"));
check("pcsketchtools: the Offset tool (sk_offset, O) - pick a chain (Shift = more), the pointer's side + distance, click / type + Enter, F = flip; drawn while it moves", ST_.TOOLS.some(([t]) => t === "sk_offset") && ST_.LETTERS.o === "sk_offset"
  && /E\.tools\.sk_offset = base\("sk_offset"/.test(ST) && /chainAt\(s, hit\.id\)/.test(ST) && /preview: true/.test(ST) && /st\.offFlip = !st\.offFlip/.test(ST) && /id="skOffT"/.test(ST));
check("pcsketchtools: the Offset dialog says Out / In (not 'left of the lines' direction'); with nothing picked it is the tool", /Out \(away from what a closed chain encloses/.test(ST) && !/left of the lines' direction/.test(ST) && /if \(!ids\.length\) return offsetTool\(\)/.test(ST));
check("pcsketchtools: an edit that is refused leaves the sketch as it was (Offset / Mirror / patterns that could not solve)", /if \(r === false\) \{ for \(const k of Object\.keys\(L\.sketch\)\) delete L\.sketch\[k\]; Object\.assign\(L\.sketch, keep\)/.test(ST));
check("pcsketchtools: ＋ handles at the ends of the one picked line / arc - a click there = the Line tool going on from that end", /function plusHandles\(s\)/.test(ST) && /E\.setTool\("sk_line"\); const P0 = K\(\)\.pt\(s, ph\.pt\); st\.lastSn = \{ x: P0\.x, y: P0\.y, pt: ph\.pt \}/.test(ST));
check("pcsketchtools: Finish Sketch moves the CAD toolbar on to SOLID", /function finish\(\) \{[\s\S]{0,400}ui\.setTab\("solid"\)/.test(ST));

/* ---- bodies: the view cube, orbit, picking */
const BY = read("ext", "imageeditdock", "pcbody.js");
const fr = PB.cubeFaces(PB.VIEWS.front, 96), hm = PB.cubeFaces(PB.VIEWS.home, 96);
check("cubeFaces: the front view = the FRONT face alone, square in the middle; home = top, right, front (front nearest, drawn last)", fr.length === 1 && fr[0].name === "front" && near(fr[0].pts[0][0], 48 - 96 * 0.27, 1e-6)
  && hm.map((f) => f.name).sort().join() === "front,right,top" && hm[hm.length - 1].name === "front");
check("cubeFaces: top / right / back / left / bottom views show that face", ["top", "right", "back", "left", "bottom"].every((v) => { const f = PB.cubeFaces(PB.VIEWS[v], 96); return f.length === 1 && f[0].name === v; }));
const cv = PB.cornerView(1, 1, 1), cv2 = PB.cornerView(-1, 1, 1);
check("cornerView: the right-top-front corner = turn -45, tilt 35 (the left one +45) - that corner faces the viewer", cv.yaw === -45 && cv.pitch === 35 && cv2.yaw === 45
  && (() => { const R = PB.rotM(cv), z = R[2][0] + R[2][1] + R[2][2]; return z > 1.7; })());
check("pcbody: Shift + middle-drag = orbit the picked body (any tool); the view cube (#bdCube: faces, corners, drag = orbit) + Home / Orbit / Pan / Fit", /const mid = e\.button === 1 && e\.shiftKey/.test(BY) && /cube\.id = "bdCube"/.test(BY)
  && /data-nav="home"/.test(BY) && /data-nav="fit"/.test(BY) && /E\.ui\.run\("view\.fit"\)/.test(BY) && /setView\(cornerView\(\.\.\.d\.at\.corner\)\)/.test(BY));
check("pcbody: Extrude / Revolve pick the profile first (the Pick Profiles tool) unless there is one region or the regions' lines are picked; the commands + the SOLID buttons use it",
  /E\.tools\.bd_profile = \{/.test(BY) && /if \(list\.length === 1\) return sketchDialog/.test(BY) && /profilesOfEnts\(skL\.sketch, picked, list\)/.test(BY)
  && /C\("solid\.extrude", "Extrude…", "", \(\) => pickProfiles\("extrude"\)/.test(BY) && /run: \(\) => pickProfiles\("revolve"\)/.test(BY) && /fill\("evenodd"\)/.test(BY));
const P3 = read("ext", "imageeditdock", "pc3d.js");
check("pc3d: a 3D view layer - Shift + middle-drag orbits, middle-drag pans (with 🖐 on)", /mid = e\.button === 1 && !!L && \(e\.shiftKey \|\| dragOn\)/.test(P3) && /how: mid \? \(e\.shiftKey \? "orbit" : "pan"\)/.test(P3));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
