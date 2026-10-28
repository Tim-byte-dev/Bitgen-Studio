#!/usr/bin/env node
/* bitGen Studio — 2.389.0: THE PHOTOSHOP-STYLE IMAGE EDITOR + THE FLOATING PROMPT DOCKER, the pure parts.
 * Run: node scripts/test-pceditor.js
 * Tim: "can we build our image editor to have the same functionality and look as https://github.com/storytold/photocraft
 * and make our prompt docker floating but allow user to snap to another docker - a drag and drop snap "P" will toggle
 * the prompt unless typing in an input" (asked: "Rebuild ours, in phases", snap "Both", "P = prompt everywhere").
 *   1. pcdoc: the layer tree (groups contiguous under their group, move / group / ungroup / insert / remove), snapshots
 *   2. filters: the new adjustments + filters (curves LUT, defaults copied, each one runs, what they do)
 *   3. pctools: crop box + ratio, the free-transform matrix and its handles, tone weights, gradient stops
 *   4. pcui: tool groups + keys + icons, accelerators
 *   5. pfloat: magnetic snap, drop zones, on screen, when P toggles; docker_status.json's prompt fields
 *   6. the wiring (ext.json order, index.html, the timeline's Shift+P path tool, server.js untouched) */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : " :: " + JSON.stringify(got).slice(0, 600))); } };
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const D = require(path.join(ROOT, "ext", "imageeditdock", "pcdoc.js"));
const FX = require(path.join(ROOT, "ext", "imageeditdock", "filters.js"));
const T = require(path.join(ROOT, "ext", "imageeditdock", "pctools.js"));
const U = require(path.join(ROOT, "ext", "imageeditdock", "pcui.js"));
const PF = require(path.join(ROOT, "ext", "promptdock", "pfloat.js"));
const DS = require(path.join(ROOT, "lib", "dockerStatus.js"));

/* 1 */
const mk = (id, type, parent) => ({ id, name: "L" + id, type: type || "pixel", parent: parent == null ? null : parent, visible: true });
const A = () => [mk(1), mk(2, null, 10), mk(3, null, 10), mk(10, "group"), mk(4)];
const ids = (x) => x.map((l) => l.id + (l.parent ? "<" + l.parent : "")).join(" ");
check("tree: a group's layers sit right below it; normalize keeps it", ids(D.normalize(A())) === "1 2<10 3<10 10 4");
check("move up inside a group, and out of it past its top", ids(D.move(A(), 2, 1)) === "1 3<10 2<10 10 4" && ids(D.move(A(), 3, 1)) === "1 2<10 10 3 4");
check("move down past a group jumps over it (with its contents); a bottom child leaves below", ids(D.move(A(), 4, -1)) === "1 4 2<10 3<10 10" && ids(D.move(A(), 2, -1)) === "1 2 3<10 10 4");
check("group / ungroup / remove (with everything in it) / insert into a group", ids(D.group(A(), [1], mk(20, "group"))) === "1<20 20 2<10 3<10 10 4"
  && ids(D.ungroup(A(), 10)) === "1 2 3 4" && ids(D.remove(A(), 10)) === "1 4" && ids(D.insert(A(), mk(30), 10, true)) === "1 2<10 3<10 30<10 10 4"
  && ids(D.insert(A(), mk(31), 2, false)) === "1 2<10 31<10 3<10 10 4");
const a5 = A();
check("depth / descendants / shown (a hidden group hides its layers)", D.depth(a5, a5[1]) === 1 && D.descendants(a5, 10).map((l) => l.id).join() === "2,3"
  && D.shown(a5, a5[1]) && (a5[3].visible = false, !D.shown(a5, a5[1])));
const L = { id: 7, name: "x", visible: true, opacity: 0.5, fillOpacity: 1, blend: "multiply", type: "adjust", parent: null, clip: true, label: "red", open: true,
  adj: { kind: "levels", params: { gamma: 1.5 } }, styles: { shadow: { on: true } }, locks: { alpha: true }, mask: { canvas: {}, on: true, density: 0.7, feather: 3 } };
const sn = D.snapLayer(L);
L.adj.params.gamma = 3; L.opacity = 1; L.mask.density = 0.1; L.clip = false;
D.putLayer(sn);
check("snapshots: deep copies of settings, the mask object kept with its density / feather (undo of a struct change)",
  L.adj.params.gamma === 1.5 && L.opacity === 0.5 && L.mask.density === 0.7 && L.clip === true && sn.adj !== L.adj);
check("14 adjustment layers, 10 layer styles (2.397.0: + Bevel & Emboss, Satin, Pattern Overlay), every adjustment kind is a filters.js adjustment", D.ADJ_KINDS.length === 14 && D.STYLE_KINDS.length === 10
  && D.ADJ_KINDS.every(([id]) => FX.byId(id) && FX.byId(id).group === "Adjustments"), D.ADJ_KINDS.filter(([id]) => !FX.byId(id)));
const tb = D.textBox({ str: "ab\ncdef", size: 10, leading: 1.5, align: "center", x: 100, y: 5 });
check("textBox without a canvas: lines x leading, centred on x", tb.h === 30 && Math.abs(tb.w - 22) < 1e-9 && tb.x === 89, tb);
check("fontCss", D.fontCss({ size: 20, weight: 700, italic: true, font: "Georgia" }) === "italic 700 20px Georgia, serif");

/* 2 */
check("45 adjustments + filters (18 + 27 - 2.397.0: Lens Flare, Swirl, Drop Shadow, 3D Extrude), unique ids", FX.FILTERS.length === 45 && new Set(FX.FILTERS.map((f) => f.id)).size === 45
  && FX.FILTERS.filter((f) => f.group === "Adjustments").length === 18);
const lut = FX.curveLut([[0, 0], [128, 200], [255, 255]]);
let mono = true; for (let i = 1; i < 256; i++) if (lut[i] < lut[i - 1]) mono = false;
check("curves: the LUT goes through the points, monotone, identity for [[0,0],[255,255]]", lut[0] === 0 && lut[128] === 200 && lut[255] === 255 && mono
  && Array.from(FX.curveLut()).every((v, i) => v === i));
const d1 = FX.defaults(FX.byId("curves")); d1.curve.rgb.push([9, 9]);
check("defaults are copies (an adjustment layer never shares its curve with the next)", FX.defaults(FX.byId("curves")).curve.rgb.length === 2);
const W = 24, H = 16, img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = (i * 37) % 256; img[i * 4 + 1] = (i * 11) % 256; img[i * 4 + 2] = (i * 5) % 256; img[i * 4 + 3] = 255; }
let allRun = true;
for (const f of FX.FILTERS) { const o = FX.run(f.id, img, W, H, {}); if (o.length !== img.length || o.some((v) => Number.isNaN(v))) allRun = false; }
check("every adjustment / filter runs on a picture at its defaults", allRun);
const ds = FX.run("desaturate", img, W, H, {});
check("Desaturate: grey", ds[0] === ds[1] && ds[1] === ds[2]);
const gm = FX.run("gradientmap", Uint8ClampedArray.from([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1, { c1: "#ff0000", c2: "#0000ff" });
check("Gradient Map: black -> the first colour, white -> the second", gm[0] === 255 && gm[2] === 0 && gm[4] === 0 && gm[6] === 255, Array.from(gm));
const flat = new Uint8ClampedArray(W * H * 4).fill(200);
check("Twirl 0° / Wave 0 px leave the picture alone", FX.run("twirl", img, W, H, { angle: 0 }).every((v, i) => Math.abs(v - img[i]) <= 1)
  && FX.run("ripple", flat, W, H, { amount: 3 }).every((v) => v === 200));
const bx = FX.run("box", img, W, H, { radius: 3 });
const varOf = (a) => { let m = 0; for (let i = 0; i < a.length; i += 4) m += a[i]; m /= a.length / 4; let v = 0; for (let i = 0; i < a.length; i += 4) v += (a[i] - m) ** 2; return v; };
check("Box Blur smooths (less variance)", varOf(bx) < varOf(img) / 2);
const cl = FX.run("clouds", img, W, H, { c1: "#000000", c2: "#ffffff", seed: 3 });
check("Clouds: opaque, between the two colours, seeded (the same twice)", cl.every((v, i) => i % 4 !== 3 || v === 255) && FX.run("clouds", img, W, H, { c1: "#000000", c2: "#ffffff", seed: 3 }).every((v, i) => v === cl[i]));
check("Filter submenus: the new filters carry one", FX.FILTERS.filter((f) => f.group === "Filters" && !f.sub).every((f) => U.SUB[f.id]), FX.FILTERS.filter((f) => f.group === "Filters" && !f.sub && !U.SUB[f.id]).map((f) => f.id));

/* 3 */
check("crop box: from any corner, kept to the ratio and inside the picture", JSON.stringify(T.cropBox(110, 30, 10, 10, 1, 200, 200)) === JSON.stringify({ x: 90, y: 10, w: 20, h: 20 })
  && JSON.stringify(T.cropBox(-20, -20, 300, 50, 0, 200, 100)) === JSON.stringify({ x: 0, y: 0, w: 200, h: 50 }));
const X = { box: { x: 0, y: 0, w: 100, h: 50 }, tx: 10, ty: 0, sx: 2, sy: 1, rot: 0 }, m = T.xform(X);
check("free transform: about the box centre, then moved; invert undoes it", m.join() === [2, 0, -0, 1, -40, 0].join() && T.apply(T.invert(m), ...T.apply(m, 30, 20)).every((v, i) => Math.abs(v - [30, 20][i]) < 1e-9), m);
check("...its handles: corner / edge / inside = move / outside = rotate", T.hitTransform(X, -40, 0, 5).kind === "corner" && T.hitTransform(X, 60, 0, 5).kind === "edge"
  && T.hitTransform(X, 60, 25, 5).kind === "move" && T.hitTransform(X, 400, 300, 5).kind === "rotate");
const R = Object.assign({}, X, { rot: Math.PI / 2, tx: 0, sx: 1 }), mr = T.xform(R), p0 = T.apply(mr, 100, 25);
check("...a 90° turn turns the box's right edge to the bottom", Math.abs(p0[0] - 50) < 1e-9 && Math.abs(p0[1] - 75) < 1e-9, p0);
const px = [100, 100, 100, 255];
T.toneDab(px, 0, "dodge", 0.5, "midtones");
const pb = [100, 100, 100, 255]; T.toneDab(pb, 0, "burn", 0.5, "midtones");
const ps = [200, 100, 50, 255]; T.toneDab(ps, 0, "desaturate", 1);
check("dodge lightens, burn darkens, the sponge desaturates", px[0] > 100 && pb[0] < 100 && Math.abs(ps[0] - ps[2]) < 1, [px[0], pb[0], ps]);
check("tone ranges: shadows weigh the darks, highlights the lights", T.toneWeight("shadows", 0.1) > T.toneWeight("shadows", 0.9) && T.toneWeight("highlights", 0.9) > T.toneWeight("highlights", 0.1)
  && T.toneWeight("midtones", 0.5) === 1);
const gs = T.gradStops("fgtrans", "#ff0000", "#000", false), gr = T.gradStops("fgbg", "#ff0000", "#0000ff", true);
check("gradient stops: fg -> transparent, reverse swaps, 5 kinds", gs[1][1] === "rgba(255,0,0,0)" && gr[0][1] === "rgba(0,0,255,1)" && T.GRAD_KINDS.length === 5);

/* 4 */
const tools = U.GROUPS.filter(Boolean).flatMap((g) => g.tools.map(([id]) => id)), keys = U.GROUPS.filter(Boolean).map((g) => g.k);
check("the tool column: Photoshop's groups and keys, unique, an icon for every tool - 2.421.0: P = the Pen group (over the image editor; the prompt docker's elsewhere), A = path selection, U + Custom Shape; 2.425.0: + Curvature Pen (P), CorelDRAW's F5 curve tools + F10 Shape tool; 2.423.0: + Magnetic Lasso, Quick Selection, Patch, Content-Aware Move, Red Eye, Mixer Brush, Background / Magic Eraser",
  keys.join("") === "vmlwcijbsyeggroptauf5f10f6f8nhz" && new Set(tools).size === tools.length && tools.every((t) => U.ICON[t]) && tools.length === 92, keys.join(""));   // 2.464.0: + the Measure tool (N)   // 2.463.0: + 9 sketch tools   // 2.462.0: + the 8 sketch tools (N)   // 2.458.0: + the Chain Dimension tool (F8)   // 2.447.0: + the Artboard tool (V)   // 2.397.0: + Vertical Type, Type on a Path (T)   // 2.390.0: + the Object Selection tool (W); 2.396.0: G twice (Gradient, Paint Bucket)
check("...the six Krita-era selection tools are still there (rect, ellipse, lasso, poly, wand, brush)", ["rect", "ellipse", "lasso", "poly", "wand", "brush"].every((t) => tools.includes(t)));
check("accelerators: an event -> \"Alt+Shift+Ctrl+L\"; normAccel orders any spelling the same",
  U.accelOf({ code: "KeyL", key: "L", altKey: true, shiftKey: true, ctrlKey: true }) === "Alt+Shift+Ctrl+L" && U.normAccel("Ctrl+Alt+Shift+l") === "Alt+Shift+Ctrl+L"
  && U.accelOf({ code: "BracketRight", key: "}", shiftKey: true, metaKey: true }) === "Shift+Ctrl+]" && U.accelOf({ code: "Digit0", key: "0", ctrlKey: true }) === "Ctrl+0"
  && U.accelOf({ key: "F5", shiftKey: true }) === "Shift+F5");

/* 5 */
const r1 = PF.snap({ x: 205, y: 300, w: 100, h: 50 }, [{ l: 0, t: 0, r: 200, b: 1000 }], 10);
check("magnetic snap: the left edge sticks to a dock's right edge within 10 px; further away it does not", r1.x === 200 && r1.snappedX && !r1.snappedY
  && PF.snap({ x: 230, y: 300, w: 100, h: 50 }, [{ l: 0, t: 0, r: 200, b: 1000 }], 10).x === 230);
const r2 = PF.snap({ x: 500, y: 692, w: 100, h: 100 }, [{ l: 0, t: 0, r: 1920, b: 800 }], 10);
check("...the bottom edge sticks to the window's bottom", r2.y === 700 && r2.snappedY);
const box = { l: 100, t: 100, r: 500, b: 300 };
check("drop zones: near an edge = that side, the middle = none, outside = none, a side docker takes top / bottom only",
  PF.zoneAt(120, 200, box) === "left" && PF.zoneAt(480, 200, box) === "right" && PF.zoneAt(300, 110, box) === "top" && PF.zoneAt(300, 290, box) === "bottom"
  && PF.zoneAt(300, 200, box) === null && PF.zoneAt(50, 200, box) === null && PF.zoneAt(120, 200, box, ["top", "bottom"]) === null);
check("...the lit half", JSON.stringify(PF.zoneRect(box, "left")) === JSON.stringify({ l: 100, t: 100, r: 300, b: 300 }));
check("on screen: the titlebar stays reachable", JSON.stringify(PF.onScreen(5000, -50, 400, 1920, 1080)) === JSON.stringify({ x: 1840, y: 0 }));
const inp = { tagName: "INPUT", type: "text" }, ta = { tagName: "TEXTAREA" }, rng = { tagName: "INPUT", type: "range" }, div = { tagName: "DIV" };
check("P toggles the prompt docker: not while typing (a text box / textarea / contenteditable), not with a modifier or a dialog open; a slider / checkbox in focus is not typing",
  PF.wantsToggle({ key: "p" }, div, false) && PF.wantsToggle({ key: "P" }, rng, false) && !PF.wantsToggle({ key: "p" }, inp, false) && !PF.wantsToggle({ key: "p" }, ta, false)
  && !PF.wantsToggle({ key: "p" }, { tagName: "DIV", isContentEditable: true }, false) && !PF.wantsToggle({ key: "p", ctrlKey: true }, div, false)
  && !PF.wantsToggle({ key: "P", shiftKey: true }, div, false) && !PF.wantsToggle({ key: "p" }, div, true) && !PF.wantsToggle({ key: "o" }, div, false)
  && !PF.wantsToggle({ key: "p" }, div, false, true));   // 2.421.0: over the image editor P is its Pen
const n0 = DS.defaults().docks.promptdock, n1 = DS.normalize({ docks: { promptdock: { floating: false, dock_to: "timelinedock", dock_side: "left", dock_w: 500, x: 12, maximized: true } } }).docks.promptdock;
const n2 = DS.normalize({ docks: { promptdock: { dock_to: "../evil", dock_side: "diagonal", floating: "yes" } } }).docks.promptdock;
check("docker_status.json: the prompt floats by default; floating / where / docked-to are kept and checked; a floating prompt is never maximized",
  n0.floating === true && n0.x === -1 && n1.floating === false && n1.dock_to === "timelinedock" && n1.dock_side === "left" && n1.dock_w === 500 && n1.x === 12
  && n2.dock_to === "" && n2.dock_side === "" && n2.floating === true && DS.normalize({ docks: { promptdock: { maximized: true } } }).docks.promptdock.maximized === false
  && DS.defaults().docks.timelinedock.floating === undefined, [n0, n1, n2]);

/* 6 */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")), PEXT = JSON.parse(read("ext", "promptdock", "ext.json"));
check("ext.json: brushes, filters, pcdoc, pctools, pcui (+ 2.390.0 pcsam, pcpsd; 2.396.0 pcfill; 2.397.0 pcstyles, pctext; 2.421.0 pcpath, pcpen; 2.422.0 pcmesh, pcsmart, pcwarp; 2.423.0 pcselect, pcretouch, pcrefine, pcheal; 2.424.0 pcpdf; 2.425.0 pcbezier, pcvline; 2.426.0 pctype; 2.427.0 pcactions; 2.428.0 pcdraw; 2.429.0 pcdockers; 2.430.0 pcdocs, pcpalette; 2.434.0 pcgrad, pccomps; 2.436.0 pcbgi; 2.437.0 pcgenfill, pcpattern; 2.438.0 pcpanels; 2.439.0 pcpropbar; 2.440.0 pcguides; 2.441.0 pcdims; 2.442.0 pcframes; 2.444.0 pcprefs, pcpromptlink; 2.447.0 pcartboards; 2.541.0 pcimgop, 2.542.0 pcblendlayer last) BEFORE imageedit.js, then mount.js; the prompt docker loads pfloat.js",
  EXT.scripts.join() === "brushes.js,filters.js,pcdoc.js,pcpath.js,pcbezier.js,pcmesh.js,pcselect.js,pcretouch.js,pccaret.js,pctools.js,pcui.js,pcdocs.js,pcsam.js,pcpsd.js,pcfill.js,pcstyles.js,pctext.js,pctype.js,pcotype.js,pcruns.js,pcfxshape.js,pctextfill.js,pclivewarp.js,pcpen.js,pcvline.js,pcdraw.js,pcdockers.js,pcpalette.js,pcgrad.js,pcsmart.js,pcwarp.js,pclinked.js,pcchannels.js,pcrefine.js,pcheal.js,pcpdf.js,pcatn.js,pcactions.js,pccomps.js,pcactionsx.js,pcbgi.js,pcgenfill.js,pcpattern.js,pcpanels.js,pcpropbar.js,pcguides.js,pcdims.js,pcframes.js,pcprefs.js,pcpromptlink.js,pcartboards.js,pccafill.js,pcdimgroup.js,pcdimauto.js,pc3d.js,pcsketch.js,pcsketchtools.js,pcsketchcad.js,pcsketchcadui.js,pchandles.js,pcselhl.js,pcmultisel.js,pccadbar.js,pcbody.js,pcunreal.js,pcuecam.js,pcuelights.js,filters2.js,filters3.js,filters4.js,filters5.js,pcmeasure.js,brushdyn.js,pcfileplus.js,pcmerge.js,pcmode.js,pcsubject.js,pcimgop.js,pcblendlayer.js,pctablet.js,pclive.js,pcfocus.js,pcuelive.js,pctabdock.js,pccoldock.js,pczones.js,pcpending.js,imageedit.js,mount.js,ieeditonly.js" && /^promptdock\.js,quickprompts\.js,pfloat\.js(,|$)/.test(PEXT.scripts.join()));   // 2.584.0: + llmarena.js
const I = read("static", "index.html"), C = read("ext", "timelinedock", "canvas.js"), PJ = read("ext", "timelinedock", "paths.js"), IE = read("ext", "imageeditdock", "imageedit.js");
check("index.html: a floating / side-docked prompt is not a column dock (fixedVar); a row counts as its dock for the splitters",
  /if \(el\.classList\.contains\("pf-free"\)\) return null;/.test(I) && /n\.classList\.contains\("pf-row"\)\) \{ const t = n\.querySelector/.test(I) && /n0\.classList\.contains\("pf-row"\)/.test(I));
check("the timeline's Path tool is Shift+P (canvas.js matches shift+ keys)", /key: "shift\+p"/.test(PJ) && /tk === "shift\+" \+ k\.toLowerCase\(\)/.test(C));
check("the editor: the Photoshop layout's parts (menu bar, options bar, tool column, the three panel groups, the themes) and the editor's older ids kept",
  ["pcMenus", "kxBar", "kxTools", "pcColor", "pcSwatches", "pcProps", "pcAdjs", "kxAi", "kxCtl", "pcLayers", "pcHistory", "kxUndo", "kxFull", "ieStage", "kxLAdd", "kxLMerge", "kxRun"]
    .every((id) => IE.includes(`id="${id}"`)) && /data-theme=studio/.test(IE) && /data-theme=classic/.test(IE) && /<select id="ieStyle"/.test(IE));
check("server.js untouched", !/pcdoc|pctools|pcui|pfloat/.test(read("misc/server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
