#!/usr/bin/env node
/* bitGen Studio — 2.434.0 units: the GRADIENT EDITOR (pcgrad.js), LAYER COMPS (pccomps.js), SMART FILTER BLEND MODES
 * (pcsmart.js) + the wiring. Tim: "add anything else in our gap list that will fit this turn" (the 2.430.0 message). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const G = require(path.join(ROOT, "ext", "imageeditdock", "pcgrad.js"));
const LC = require(path.join(ROOT, "ext", "imageeditdock", "pccomps.js"));
const SM = require(path.join(ROOT, "ext", "imageeditdock", "pcsmart.js"));
const B = require(path.join(ROOT, "ext", "imageeditdock", "pcbezier.js"));

/* ---- the gradient */
check("12 presets, each a clean gradient (Foreground to Background uses fg / bg)", G.PRESETS.length === 12 && G.PRESETS.every((p) => G.norm(p).stops.length >= 2) && G.PRESETS[0].stops.map((s) => s.c).join() === "fg,bg");
const n = G.norm({ name: "", stops: [{ t: 1.5, c: "#FF0000" }, { t: -1, c: "nope", a: 3 }] });
check("norm: sorted, clamped 0..1, colours lower-case hex (junk = black), opacity 0..1, a name", n.name === "Custom" && n.stops[0].t === 0 && n.stops[0].c === "#000000" && n.stops[0].a === 1 && n.stops[1].t === 1 && n.stops[1].c === "#ff0000");
check("...one stop = two (the same colour at the other end); none = black -> white", G.norm({ stops: [{ t: 0.3, c: "#123456" }] }).stops.length === 2 && G.norm({}).stops.map((s) => s.c).join() === "#000000,#ffffff");
check("resolve: fg / bg -> the colours", G.resolve(G.PRESETS[0], "#ff0000", "#0000ff").stops.map((s) => s.c).join() === "#ff0000,#0000ff" && G.resolve(G.PRESETS[1], "#00ff00").stops[1].a === 0);
const g3 = { stops: [{ t: 0, c: "#000000", a: 1 }, { t: 1, c: "#ffffff", a: 0 }] };
check("colorAt: linear between the stops (colour and opacity)", JSON.stringify(G.colorAt(g3, 0.5)) === '{"c":"#808080","a":0.5}' && G.colorAt(g3, -1).c === "#000000" && G.colorAt(g3, 2).a === 0);
const ad = G.addStop(g3, 0.25);
check("addStop: at t with the colour there (sorted, its index)", ad.g.stops.length === 3 && ad.i === 1 && ad.g.stops[1].c === "#404040" && ad.g.stops[1].a === 0.75);
const mv = G.moveStop(ad.g, 1, 0.9);
check("moveStop keeps them sorted (the stop's new index)", mv.i === 1 && mv.g.stops[1].t === 0.9 && G.moveStop(ad.g, 0, 0.95).i === 1);
check("removeStop: never fewer than 2", G.removeStop(ad.g, 1).stops.length === 2 && G.removeStop(g3, 0).stops.length === 2);
check("reverse / distribute", G.reverse(ad.g).stops[0].c === "#ffffff" && G.reverse(ad.g).stops[1].t === 0.75 && G.distribute({ stops: [{ t: 0, c: "#000000" }, { t: 0.1, c: "#ff0000" }, { t: 0.2, c: "#00ff00" }, { t: 1, c: "#ffffff" }] }).stops.map((s) => s.t).join() === "0,0.3333,0.6667,1");
check("toCanvas: rgba stops; toCss: a CSS gradient over a checkerboard; svgStops: <stop>s with stop-opacity < 1",
  JSON.stringify(G.toCanvas(g3)) === '[[0,"rgba(0,0,0,1)"],[1,"rgba(255,255,255,0)"]]' && /^linear-gradient\(90deg,rgba\(0,0,0,1\) 0%,rgba\(255,255,255,0\) 100%\),repeating-conic-gradient/.test(G.toCss(g3))
  && G.svgStops(g3) === '<stop offset="0" stop-color="#000000"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>');
check("fromTwo: the older c1 / c2", G.fromTwo("#112233", "#445566").stops.map((s) => s.c).join() === "#112233,#445566");
const shp = { kind: "path", path: { subs: [{ closed: true, op: "add", pts: [{ x: 0, y: 0, ix: 0, iy: 0, ox: 0, oy: 0 }, { x: 10, y: 0, ix: 10, iy: 0, ox: 10, oy: 0 }, { x: 10, y: 10, ix: 10, iy: 10, ox: 10, oy: 10 }] }] }, fill: "#ff0000", fillOn: true, strokeW: 0, strokeOn: false, line: {},
  fillGrad: { type: "linear", c1: "#ff0000", c2: "#0000ff", angle: 0, stops: [{ t: 0, c: "#ff0000", a: 1 }, { t: 0.5, c: "#00ff00", a: 0.5 }, { t: 1, c: "#0000ff", a: 1 }] } };
check("pcbezier: a shape's gradient with stops -> its SVG (each stop, the opacity), kept in the data", /<stop offset="0.5" stop-color="#00ff00" stop-opacity="0.5"\/>/.test(B.svgLine(shp)) && B.fromSvg("<svg>" + B.svgLine(shp) + "</svg>")[0].fillGrad.stops.length === 3);

/* ---- layer comps */
const Ls = [{ id: 1, visible: true, opacity: 1, blend: "normal" }, { id: 2, visible: false, opacity: 0.5, blend: "multiply", styles: { drop: { on: true } } }];
const boxes = { 1: { x: 10, y: 20 }, 2: { x: 0, y: 0 } };
const cap = LC.capture(Ls, (L) => boxes[L.id]);
check("capture: each layer - shown, where its content starts, opacity, blend, styles", JSON.stringify(cap[1]) === '{"v":true,"x":10,"y":20,"op":1,"blend":"normal","styles":null,"fill":null}' && cap[2].v === false && cap[2].styles.drop.on === true);
const comp = { vis: true, pos: true, look: true, layers: cap };
const now = [{ id: 1, visible: false, opacity: 1, blend: "normal" }, { id: 2, visible: false, opacity: 1, blend: "normal" }, { id: 3, visible: true }];
const plan = LC.planOf(comp, now, (L) => ({ 1: { x: 40, y: 20 }, 2: { x: 0, y: 0 }, 3: { x: 0, y: 0 } })[L.id]);
check("planOf: what changes - shown again + moved back (-30, 0) for 1; the look for 2; a layer the comp does not know left alone",
  JSON.stringify(plan) === '[{"id":1,"v":true,"dx":-30,"dy":0},{"id":2,"look":{"op":0.5,"blend":"multiply","styles":{"drop":{"on":true}},"fill":null}}]', plan);
check("...a comp of visibility only touches visibility", JSON.stringify(LC.planOf({ vis: true, pos: false, look: false, layers: cap }, now, () => ({ x: 99, y: 99 }))) === '[{"id":1,"v":true}]');

/* ---- smart filter blend modes */
check("24 blend modes (Photoshop's list)", SM.BLEND_MODES.length === 24 && SM.BLEND_MODES[0] === "normal" && SM.BLEND_MODES.includes("vivid-light") && SM.BLEND_MODES.includes("luminosity"));
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
check("blendPx: multiply / screen / difference / overlay / luminosity", near(SM.blendPx("multiply", [0.5, 0.5, 0.5], [0.5, 1, 0]), [0.25, 0.5, 0]) && near(SM.blendPx("screen", [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [0.75, 0.75, 0.75])
  && near(SM.blendPx("difference", [1, 0.2, 0], [0.5, 0.5, 0.5]), [0.5, 0.3, 0.5]) && near(SM.blendPx("overlay", [0.25, 0.75, 0.5], [0.5, 0.5, 1]), [0.25, 0.75, 1]));
const inp = new Uint8ClampedArray([128, 128, 128, 255]), out = new Uint8ClampedArray([127, 127, 127, 255]);
check("blendInto: a mode, then the opacity (multiply 128 x 127 = 64; at 50 % halfway); normal at 100 % = the filter's own",
  SM.blendInto(inp, out, "multiply", 1)[0] === 64 && SM.blendInto(inp, out, "multiply", 0.5)[0] === 96 && SM.blendInto(inp, out, "normal", 1) === out && SM.blendInto(inp, out, "bogus", 1) === out);
const SMS = read("ext", "imageeditdock", "pcsmart.js");
check("runFilter uses the filter's blend; the right-click dialog is Blending Options (Mode + Opacity), normal = no blend kept", /return blendInto\(rgba, out, f\.blend \|\| "normal", a\);/.test(SMS) && /Blending Options \(/.test(SMS) && /if \(m === "normal"\) delete Ly\.smart\.filters\[k\]\.blend;/.test(SMS));

/* ---- wiring */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js"), T = read("ext", "imageeditdock", "pctools.js"), UI = read("ext", "imageeditdock", "pcui.js"), DK = read("ext", "imageeditdock", "pcdockers.js"), DOC = read("ext", "imageeditdock", "pcdoc.js"), DOCS = read("ext", "imageeditdock", "pcdocs.js");
check("ext.json: pcgrad after pcpalette, pccomps after pcactions; installed", EXT.indexOf("pcgrad.js") === EXT.indexOf("pcpalette.js") + 1 && EXT.indexOf("pccomps.js") === EXT.indexOf("pcactions.js") + 1 && /PCGrad\.install\(E\)/.test(IE) && /PCComps\.install\(E\)/.test(IE));
check("the Gradient tool: Colours ▸ Custom + the gradient button (the editor); gradStops reads the custom one; the bucket too", /\["custom", "Custom \(Gradient Editor\)"\]/.test(T) && /id="ptGEdit"/.test(T) && /if \(kind === "custom" && custom && root\.PCGrad\) st = root\.PCGrad\.toCanvas\(custom, fg, bg\);/.test(T) && /S\.gradCustom\)/.test(read("ext", "imageeditdock", "pcfill.js")));
check("a Gradient fill layer: Properties ▸ #ppFEdit; pcdoc draws its stops; Object Properties ▸ #dkFE", /id="ppFEdit"/.test(UI) && /gradStopsInto\(grd, f\.stops\)/.test(DOC) && /id="dkFE"/.test(DK));
check("the Comps tab (Window ▸ Layer Comps); a document's comps are its own (DOC_KEYS)", /\$\{tab\("layers", "pcComps", "Comps"\)\}/.test(IE) && /\["pcComps", "Layer Comps"\]/.test(UI) && /"comps", "compOn", "compSel", "compLast"[\],]/.test(DOCS));
check("server.js untouched", !/pcgrad|pccomps|blendInto/.test(read("misc/server.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
