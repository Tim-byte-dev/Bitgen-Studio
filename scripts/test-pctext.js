#!/usr/bin/env node
/* bitGen Studio — 2.397.0 unit tests: the image editor's text along a path / warp / vertical / 3D (pctext.js), the new
 * layer styles (pcstyles.js: Bevel & Emboss, Satin, Pattern Overlay, the overlays' blend modes, the presets) and the
 * new filters (filters.js: Lens Flare, Swirl, Drop Shadow, 3D Extrude), and their wiring.
 * Tim (verbatim): "yes please add the text tool improvements, like text along a path , add the filters like lense
 * flare, swirl,drop shadow, 3d text and the overlay styles" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const X = (f) => require(path.join(ROOT, "ext", "imageeditdock", f));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-6 : t);

const T = X("pctext.js"), P = X("pcstyles.js"), F = X("filters.js"), D = X("pcdoc.js");

/* ---------------- 1. text: warp ---------------- */
check("warp: 16 styles + None (Photoshop's list + 2.608.0's Shell Lower / Upper, Fisheye, Twist, Wedge)", T.WARPS.length === 17 && T.WARPS.map(([k]) => k).join() === "none,arc,arcLower,arcUpper,arch,bulge,shellLower,shellUpper,flag,wave,fish,rise,fisheye,inflate,squeeze,twist,wedge");
check("warpColumn: Arc lifts the middle half a height at bend 100, the ends stay; bend 0 / None = no move; bend clamps",
  T.warpColumn("arc", 100, 0).every((v) => near(v, -0.5)) && T.warpColumn("arc", 100, 1).every((v) => near(v, 0)) && T.warpColumn("arc", 0, 0).every((v) => near(v, 0))
  && T.warpColumn("none", 100, 0).every((v) => near(v, 0)) && near(T.warpColumn("arc", 500, 0)[0], -0.5));
check("...Bulge opens top and bottom, Squeeze pinches, Arc Lower moves only the bottom, Rise tilts (left down, right up)",
  T.warpColumn("bulge", 100, 0)[0] < 0 && T.warpColumn("bulge", 100, 0)[1] > 0 && T.warpColumn("squeeze", 100, 0)[0] > 0 && T.warpColumn("squeeze", 100, 0)[1] < 0
  && T.warpColumn("arcLower", 100, 0)[0] === 0 && T.warpColumn("arcLower", 100, 0)[1] > 0 && T.warpColumn("rise", 100, -1)[0] > 0 && T.warpColumn("rise", 100, 1)[0] < 0);
const ex = T.warpExtent("bulge", 50);
check("warpExtent: how far above / below the block a warp reaches", near(ex.up, 0.2) && near(ex.down, 0.2) && T.warpExtent("none", 80).up === 0, ex);

/* ---------------- 2. text: paths ---------------- */
const circ = T.circlePoly(0, 0, 100, 0, "top", 8);
check("circlePoly top: starts at the top, goes clockwise (to the right), closes", near(circ[0][0], 0, 1e-9) && near(circ[0][1], -100) && circ[1][0] > 0 && circ.length === 25 && near(circ[24][0], 0, 1e-9) && near(circ[24][1], -100));   // at least 24 steps
const cb = T.circlePoly(0, 0, 100, 0, "bottom", 8);
check("circlePoly bottom: starts at the bottom, goes anticlockwise (also to the right) - the letters read left to right", near(cb[0][1], 100) && cb[1][0] > 0 && cb[1][1] < 100);
const tab = T.arcTable([[0, 0], [100, 0], [100, 100]]);
check("arcTable / pointAt: lengths add up, a point and its direction, clamped open, wrapped closed",
  tab.total === 200 && T.pointAt(tab, 50).x === 50 && near(T.pointAt(tab, 150).a, Math.PI / 2) && T.pointAt(tab, 999).y === 100 && near(T.pointAt(tab, 250, true).x, 50));
const lp = T.layoutPath([10, 10, 10], tab, { offset: 0, align: "left" });
const lc = T.layoutPath([10, 10, 10], tab, { offset: 50, align: "center" });
check("layoutPath: each letter at its middle along the path; centred on the offset; off the end = on:false",
  lp.map((q) => q.x).join() === "5,15,25" && lp.every((q) => q.on) && near(lc[1].x, 100) && T.layoutPath([150, 150], tab, { offset: 0 })[1].on === false, { lp, lc });
const cm = T.catmull([[0, 0], [50, 50], [100, 0]], 8);
check("catmull: a smooth line THROUGH the points (first, middle, last)", cm[0][0] === 0 && cm[cm.length - 1][0] === 100 && cm.some((q) => near(q[0], 50) && near(q[1], 50)) && cm.length === 17);
const sim = T.simplify(Array.from({ length: 50 }, (v, i) => [i, i < 25 ? 0 : i - 25]), 0.5, 40);
check("simplify: a hand-drawn L down to its 3 corners", sim.length === 3 && sim[1][0] === 25 && sim[1][1] === 0, sim);
const tc = { str: "Hello", size: 40, x: 100, y: 100, path: { kind: "circle", r: 120, start: 0, side: "top" } };
const tu = { str: "Hi", size: 40, x: 10, y: 10, path: { kind: "curve", pts: [[0, 0], [200, 0]], offset: 0 } };
check("polyOf: a circle round (x, y); a drawn path RELATIVE to (x, y) - moving the text moves the path",
  T.polyOf(tc).length === 241 && near(T.polyOf(tc)[0][1], -20) && T.polyOf(tu)[0][0] === 10 && T.polyOf(Object.assign({}, tu, { x: 60 }))[0][0] === 60 && T.polyOf({ str: "x" }) === null);
const bc = T.box(tc);
check("box (circle text, top): centred over the circle's top", Math.abs(bc.x + bc.w / 2 - 100) < 3 && bc.y < -20 && bc.y + bc.h < 10, bc);
check("hit: path text is hit on its letters, not anywhere in its box", T.hit(tu, 20, -4) === true && T.hit(tu, 180, -4) === false, [T.hit(tu, 20, -4), T.hit(tu, 180, -4)]);
const sp = { str: "Hi", size: 10, x: 5, y: 5, path: { kind: "curve", pts: [[0, 0], [100, 50]] } };
T.scalePath(sp, 2, 3);
check("scalePath (Image Size): a drawn path's points scale with the picture; a circle's radius by the smaller side",
  sp.path.pts[1][0] === 200 && sp.path.pts[1][1] === 150 && (() => { const c = { path: { kind: "circle", r: 100 } }; T.scalePath(c, 2, 0.5); return c.path.r === 50; })());

/* ---------------- 3. text: 3D, the rest ---------------- */
const st = T.extrudeSteps(4, 135, 0.8);
check("extrudeSteps: back to front, down-right at 135°, darkest at the back", st.length === 4 && st[0].k === 4 && near(st[0].dx, 4 * Math.SQRT1_2, 1e-9) && near(st[0].dy, 4 * Math.SQRT1_2, 1e-9)
  && near(st[0].dark, 0.8) && near(st[3].dark, 0.2) && T.extrudeSteps(0).length === 0);
const b0 = T.straightBox({ str: "ab", size: 10, x: 0, y: 0 }), b3 = T.box({ str: "ab", size: 10, x: 0, y: 0, extrude: { on: true, depth: 10, angle: 135 } });
check("box grows by the 3D depth; warp by its reach; vertical = a column per line", b3.w >= b0.w + 7 && b3.h >= b0.h + 7
  && T.box({ str: "ab", size: 10, x: 0, y: 0, warp: { style: "bulge", bend: 100 } }).h > b0.h * 1.6 && T.box({ str: "ab\ncd", size: 10, x: 0, y: 0, vertical: true }).w >= 24, { b0, b3 });
check("wants: only text that needs pctext (path / warp / vertical / 3D / caps / underline / strike); a plain text stays pcdoc's",
  !T.wants({ str: "x" }) && !T.wants({ str: "x", warp: { style: "arc", bend: 0 } }) && !T.wants({ str: "x", extrude: { on: false, depth: 9 } })
  && T.wants({ str: "x", caps: true }) && T.wants({ str: "x", vertical: true }) && T.wants(tc) && T.wants({ str: "x", warp: { style: "wave", bend: 20 } }) && T.wants({ str: "x", extrude: { on: true, depth: 3 } }));
check("pcdoc.textBox hands a shaped text to pctext's box (when it is loaded)", (() => { global.PCText = T; const r = D.textBox(tc); delete global.PCText; return r.y < -20; })() || /root\.PCText\.wants\(t\)\) return root\.PCText\.box\(t, g\)/.test(read("ext", "imageeditdock", "pcdoc.js")));
check("darker: the 3D sides' automatic colour", T.darker("#ff8040", 0.5) === "#804020");

/* ---------------- 4. layer styles ---------------- */
check("pcdoc: 10 styles in Photoshop's order (Bevel & Emboss first, Drop Shadow last), every one with defaults",
  D.STYLE_KINDS.map(([k]) => k).join() === "bevel,stroke,innerShadow,innerGlow,satin,colorOverlay,gradientOverlay,patternOverlay,outerGlow,shadow" && D.STYLE_KINDS.every(([k]) => D.STYLE_DEFAULTS[k] && D.STYLE_DEFAULTS[k].on === false));
check("the overlays have blend modes (16) and the gradient overlay styles (linear, radial, angle, reflected, diamond)",
  P.BLENDS.length === 16 && P.compOf("normal") === "source-over" && P.compOf("multiply") === "multiply" && P.compOf("bogus") === "source-over" && P.GRAD_STYLES.length === 5
  && D.STYLE_DEFAULTS.gradientOverlay.style === "linear" && D.STYLE_DEFAULTS.colorOverlay.blend === "normal");
const w = 40, h = 40, A = new Float32Array(w * h);
for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) A[y * w + x] = 1;
const bv = P.bevelShade(A, w, h, { size: 4, angle: 120, altitude: 30 });
check("bevelShade (inner bevel, light from the upper left): the top and left edges lit, bottom and right in shadow, nothing outside",
  bv[12 * w + 20] > 0.2 && bv[20 * w + 12] > 0.1 && bv[27 * w + 20] < -0.2 && bv[20 * w + 27] < -0.2 && bv[5 * w + 5] === 0 && bv[20 * w + 5] === 0, [bv[12 * w + 20], bv[20 * w + 12], bv[27 * w + 20], bv[20 * w + 27]]);
const dn = P.bevelShade(A, w, h, { size: 4, direction: "down" }), ob = P.bevelShade(A, w, h, { size: 4, style: "outer bevel" });
check("...direction Down flips it; Outer Bevel lights OUTSIDE the shape (nothing inside)", dn[12 * w + 20] < 0 && ob[20 * w + 20] === 0 && Math.abs(ob[8 * w + 20]) > 0.01);
const tile = P.patternTile("checker", 8, "#000000", "#ffffff");
check("patternTile: 11 patterns (2.411.0: + glitter); a checker in the two colours", P.PATTERNS.length === 11 && tile[0] === 255 && tile[(0 * 8 + 4) * 4] === 0 && tile[(4 * 8 + 4) * 4] === 255 && P.patternTile("noise", 8, "#000", "#fff").length === 256);
check("gradT: linear 0..1 across, radial from the centre, reflected mirrors, diamond, angle round",
  near(P.gradT("linear", 0, 50, 50, 50, 0, 50), 0) && near(P.gradT("linear", 100, 50, 50, 50, 0, 50), 1) && near(P.gradT("radial", 50, 50, 50, 50, 0, 50), 0)
  && near(P.gradT("reflected", 0, 50, 50, 50, 0, 50), 1) && near(P.gradT("diamond", 75, 75, 50, 50, 0, 50), 1) && P.gradT("angle", 50, 0, 50, 50, 0, 50) > 0);
const pre = P.presetStyles("Gold", D.STYLE_DEFAULTS);
check("presets: 10 looks (Gold, Chrome, Neon ...); a preset turns ITS styles on over the defaults, the rest off",
  P.PRESETS.length === 10 && pre.gradientOverlay.on && pre.bevel.on && pre.shadow.on && !pre.stroke.on && !pre.satin.on && pre.bevel.altitude === 30 && pre.gradientOverlay.c2 === "#ffe39a"
  && Object.keys(pre).length === D.STYLE_KINDS.length && P.presetStyles("nope", D.STYLE_DEFAULTS) === null);
check("the dialog's fields for the new styles (bevel 11, satin, pattern overlay) and the overlays' blend mode", P.FIELDS.bevel.length === 11 && P.FIELDS.satin.length === 7
  && P.FIELDS.patternOverlay[0][0] === "pattern" && P.FIELDS.colorOverlay[0][0] === "blend" && P.FIELDS.gradientOverlay.some(([k]) => k === "style"));
check("fingerprint: the same alpha = the same key, a change = another", P.fingerprint(new Uint8ClampedArray(64)) === P.fingerprint(new Uint8ClampedArray(64))
  && P.fingerprint(new Uint8ClampedArray(64)) !== P.fingerprint(Uint8ClampedArray.from({ length: 64 }, (v, i) => (i === 3 ? 9 : 0))));

/* ---------------- 5. the filters ---------------- */
const fw = 60, fh = 40, img = new Uint8ClampedArray(fw * fh * 4), op = new Uint8ClampedArray(fw * fh * 4).fill(120);
for (let y = 10; y < 20; y++) for (let x = 10; x < 30; x++) { const i = (y * fw + x) * 4; img[i] = 200; img[i + 3] = 255; }
for (let i = 3; i < op.length; i += 4) op[i] = 255;
const ids = ["lensflare", "swirl", "dropshadow", "extrude3d"];
check("the four new filters: Render ▸ Lens Flare, Distort ▸ Swirl, Stylize ▸ Drop Shadow / 3D Extrude", ids.every((id) => F.byId(id) && F.byId(id).group === "Filters")
  && F.byId("lensflare").sub === "Render" && F.byId("swirl").sub === "Distort" && F.byId("dropshadow").sub === "Stylize" && F.byId("extrude3d").sub === "Stylize");
const lf = F.run("lensflare", op, fw, fh, { cx: 25, cy: 25 }), at = (a, x, y) => Array.from(a.slice((y * fw + x) * 4, (y * fw + x) * 4 + 4));
check("Lens Flare: brightest at its centre, the picture still opaque, darker far away", at(lf, 15, 10)[0] > 240 && at(lf, 59, 39)[0] < at(lf, 15, 10)[0] && lf[3] === 255 && lf[lf.length - 1] === 255, [at(lf, 15, 10), at(lf, 59, 39)]);
const lft = F.run("lensflare", new Uint8ClampedArray(fw * fh * 4), fw, fh, {});
check("...on a transparent layer the light makes its own pixels (alpha from the light)", lft[(10 * fw + 18) * 4 + 3] > 200 && lft[(39 * fw + 59) * 4 + 3] < 120);
const ds = F.run("dropshadow", img, fw, fh, { angle: 120, distance: 6, size: 0, opacity: 100, color: "#000000" });
check("Drop Shadow: the pixels kept, a black copy down-right (120°), nothing up-left", at(ds, 15, 15)[0] === 200 && at(ds, 32, 22)[3] === 255 && at(ds, 32, 22)[0] === 0 && at(ds, 8, 8)[3] === 0, [at(ds, 32, 22), at(ds, 8, 8)]);
check("...pad = distance + size x 2 (the filter sees around a selection)", F.pad(F.byId("dropshadow"), { distance: 10, size: 5 }) === 22);
const ex3 = F.run("extrude3d", img, fw, fh, { depth: 6, angle: 135, side: "solid colour", color: "#00ff00", shade: 0 });
check("3D Extrude: the face on top, green sides behind it down-right, nothing up-left", at(ex3, 15, 15)[0] === 200 && at(ex3, 33, 23)[1] === 255 && at(ex3, 33, 23)[3] === 255 && at(ex3, 8, 8)[3] === 0, [at(ex3, 33, 23)]);
check("Swirl: the centre turns, outside the radius nothing moves; the falloff", near(F.swirlFall(0, "smooth"), 1) && F.swirlFall(1, "linear") === 0 && near(F.swirlFall(0.5, "linear"), 0.5)
  && (() => { const sw = F.run("swirl", img, fw, fh, { radius: 20, angle: 300 }); return at(sw, 0, 0).join() === at(img, 0, 0).join() && sw.some((v, i) => v !== img[i]); })());
check("offsetOf: Photoshop's light angle (120° lights from the upper left - the shadow goes down right)", F.offsetOf(120, 10)[0] > 0 && F.offsetOf(120, 10)[1] > 0 && near(F.offsetOf(180, 10)[0], 10));

/* ---------------- 6. the wiring ---------------- */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")), UI = read("ext", "imageeditdock", "pcui.js"), IE = read("ext", "imageeditdock", "imageedit.js"),
  PT = read("ext", "imageeditdock", "pctools.js"), PD = read("ext", "imageeditdock", "pcdoc.js"), PS = read("ext", "imageeditdock", "pcpsd.js");
check("ext.json: pcstyles.js + pctext.js after pcfill.js, before imageedit.js; imageedit installs PCText", EXT.scripts.indexOf("pcstyles.js") === EXT.scripts.indexOf("pcfill.js") + 1
  && EXT.scripts.indexOf("pctext.js") === EXT.scripts.indexOf("pcstyles.js") + 1 && EXT.scripts.indexOf("pctext.js") < EXT.scripts.indexOf("imageedit.js") && /win\.PCText\.install\(E\)/.test(IE));
check("pcui: the T group = Horizontal Type, Vertical Type, Type on a Path (icons); the Layer Style dialog's fields, checkboxes and Styles list; text Properties ⌒ Shape / fx",
  /\{ k: "t", tools: \[\["type", "Horizontal Type Tool"\], \["vtype", "Vertical Type Tool"\], \["typepath", "Type on a Path Tool"\]\] \}/.test(UI) && /vtype: '<path/.test(UI) && /typepath: '<path/.test(UI)
  && /Object\.assign\(fields, root\.PCStyles\.FIELDS\)/.test(UI) && /ty === "chk"/.test(UI) && /id="psPreset"/.test(UI) && /presetStyles\(pre\.value, D\.STYLE_DEFAULTS\)/.test(UI) && /id="ppTShape"/.test(UI));
check("pcdoc: a shaped text is drawn / boxed by pctext; styled() draws the overlays (pcstyles), satin, bevel - Photoshop's order (overlays, satin, inner glow, inner shadow, bevel, stroke)",
  /root\.PCText\.wants\(L\.text\)\) root\.PCText\.draw\(g, L\.text\)/.test(PD) && /if \(PS\) body = PS\.overlays\(env, st, content, W, H\);/.test(PD)
  && PD.indexOf("PS.satinCanvas") < PD.indexOf('[["innerGlow", false], ["innerShadow", true]]') && PD.indexOf('[["innerGlow", false], ["innerShadow", true]]') < PD.indexOf("PS.drawBevel") && PD.indexOf("PS.drawBevel") < PD.indexOf("const sk = st.stroke;"));
check("pctools: the Type tool's textAt hits a path text on its letters; Image Size scales a path; E.editText / E.typeSettings for pctext; the typing box floats above shaped text",
  /root\.PCText\.hit\(L\.text, x, y, ctx\(L\.canvas\)\)/.test(PT) && /root\.PCText\.scalePath\(L\.text, kx, ky\)/.test(PT) && /E\.editText = \(L\) => editText\(L\)/.test(PT) && /ta\.classList\.add\("pcshaped"\)/.test(PT));
check("pcpsd: Bevel & Emboss and Satin go to / come from a PSD now (only a pattern overlay is left out)", /fx\.bevel = \{ enabled: true/.test(PS) && /fx\.satin = \{ enabled: true/.test(PS) && /\["patternOverlay"\]\.filter/.test(PS));
check("docs/shortcuts.json: T cycles the three type tools", /"T  \(Shift\+T cycles\)",\s*"Horizontal Type · Vertical Type · Type on a Path"/.test(read("docs", "shortcuts.json")));
check("a filter with a centre (Lens Flare, Swirl, Radial Blur): a click on the picture places it - before the tools see the click, removed on OK / Cancel",
  /f\.params\.some\(\(q\) => q\.id === "cx"\) && f\.params\.some\(\(q\) => q\.id === "cy"\)/.test(IE) && /win\.addEventListener\("pointerdown", pick, true\)/.test(IE)
  && /const cancel = \(\) => \{ unpick\(\);/.test(IE) && /\.onclick = \(\) => \{\n\s+unpick\(\);/.test(IE) && F.byId("radial").params.some((q) => q.id === "cx"));
check("nothing added to server.js", !/pctext|pcstyles|lensflare/.test(read("misc/server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
