#!/usr/bin/env node
/* bitGen Studio — 2.437.0 units: ✨ GENERATE FILL IN A SHAPE / IN A MASK (ext/imageeditdock/pcgenfill.js) and the
 * PATTERN LIBRARY (lib/patternStore.js, routes/patterns.js, ext/imageeditdock/pcpattern.js).
 * Tim: "continue with the photoshop gap closure, allow user to generate fill inside a selected shape or mask". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const G = require(path.join(ROOT, "ext", "imageeditdock", "pcgenfill.js"));
const PT = require(path.join(ROOT, "ext", "imageeditdock", "pcpattern.js"));
const PS = require(path.join(ROOT, "lib", "patternStore.js"));
const D = require(path.join(ROOT, "ext", "imageeditdock", "pcdoc.js"));

/* ---- generate fill: the pure part */
const rgba = new Uint8Array([10, 20, 30, 0, 1, 2, 3, 128, 9, 9, 9, 255]);
check("areaFromAlpha: where the layer has pixels (its alpha)", Array.from(G.areaFromAlpha(rgba)).join() === "0,128,255");
const mk = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 0, 128, 128, 128, 255]);
check("areaFromMask: white = where, black = not, a transparent part = not", Array.from(G.areaFromMask(mk)).join() === "255,0,0,128");
check("invert / count", Array.from(G.invert(new Uint8Array([0, 255, 100]))).join() === "255,0,155" && G.count(new Uint8Array([0, 128, 255, 127])) === 2);
const list = [{ L: { id: 1, clip: false } }, { L: { id: 2, clip: false } }, { L: { id: 3, clip: true } }, { L: { id: 4, clip: true } }, { L: { id: 5, clip: false } }];
check("chainEnd: the result goes above the layers already clipped to the base (the clipping chain stays whole)", G.chainEnd(list, 1) === 3 && G.chainEnd(list, 0) === 0 && G.chainEnd(list, 4) === 4);
check("canShape: pixel / shape / text / smart / fill, or any layer with a vector mask - not a group or an adjustment layer; canMask: a layer mask",
  G.canShape({ type: "shape" }) && G.canShape({ type: "text" }) && G.canShape({ type: "pixel" }) && !G.canShape({ type: "group" }) && !G.canShape({ type: "adjust" }) && G.canShape({ type: "group", vmask: { path: {} } })
  && G.canMask({ mask: { canvas: {} } }) && !G.canMask({ type: "pixel" }));
// placeOnto on a fake editor: the tree insert above the chain, clipped / masked, one undo step
const mkE = () => {
  const S = { layers: [{ id: 1, name: "BG", parent: null, clip: false }, { id: 2, name: "Shape", parent: null, clip: false, mask: { canvas: { width: 4, height: 4 }, density: 0.5, feather: 2 } }, { id: 3, name: "c", parent: null, clip: true }, { id: 4, name: "Top", parent: null, clip: false }], active: 0, maskEdit: true };
  const pushed = [];
  return { S, D, pushed, snapStruct: () => S.layers.map((x) => x.id).join(), push: (e) => pushed.push(e),
    newMask: (fill, w, h) => ({ canvas: { width: w, height: h, getContext: () => ({ clearRect() {}, drawImage() {} }) }, on: true, density: 1, feather: 0, linked: true, ver: 0 }) };
};
let E = mkE(); let R = { id: 9, name: "fill", parent: null, clip: false };
G.placeOnto(E, R, E.S.layers[1], "shape");
check("placeOnto (shape): a new layer CLIPPED, above the shape AND the layer already clipped to it, active, one undo step", E.S.layers.map((x) => x.id).join() === "1,2,3,9,4" && R.clip === true && E.S.active === 3 && E.pushed.length === 1 && E.pushed[0].label === "generate fill in shape" && E.S.maskEdit === false, E.S.layers.map((x) => x.id));
E = mkE(); R = { id: 9, name: "fill", parent: null, clip: false };
G.placeOnto(E, R, E.S.layers[1], "mask");
check("placeOnto (mask): a copy of the layer's mask (its density / feather), not clipped", R.mask && R.mask.density === 0.5 && R.mask.feather === 2 && R.mask.canvas.width === 4 && R.clip === false && E.pushed[0].label === "generate fill in mask");

/* ---- the pattern library (server) */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pat_"));
PS.setBase(tmp);
const png = (w, h) => {           // a real (tiny) PNG
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (~c) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};
check("pngSize: a PNG's size from its header; not a PNG = null", JSON.stringify(PS.pngSize(png(7, 3))) === '{"w":7,"h":3}' && PS.pngSize(Buffer.from("hello world, not a png....")) === null);
const s1 = PS.save("Wood grain", png(16, 8));
check("save -> patterns/<name>.png in the install folder, {name, w, h, size}", s1.name === "Wood grain" && s1.w === 16 && fs.existsSync(path.join(tmp, "patterns", "Wood grain.png")));
PS.save("../../evil", png(2, 2)); PS.save("A dots", png(4, 4));
check("list: by name, with sizes; a name stays inside the folder", JSON.stringify(PS.list().map((p) => [p.name, p.w, p.h])) === '[["A dots",4,4],["evil",2,2],["Wood grain",16,8]]' && !fs.existsSync(path.join(tmp, "evil.png")), PS.list());
let threw = "";
for (const [n, b] of [["", png(2, 2)], ["x", Buffer.from("not a png at all.........")], ["big", png(5000, 2)]]) { try { PS.save(n, b); } catch (e) { threw += e.status + ","; } }
try { PS.file("nope"); } catch (e) { threw += e.status; }
check("...no name / not a PNG / over 4096 px = 400, a missing one = 404", threw === "400,400,400,404", threw);
check("remove", PS.remove("evil").removed === true && PS.remove("evil").removed === false && PS.list().length === 2);
fs.rmSync(tmp, { recursive: true, force: true });

/* ---- the page side's pure part */
check("PCPattern.usesOf: a pattern fill layer's pattern, a Pattern Overlay's user:<name> (not the built-in ones)",
  JSON.stringify(PT.usesOf({ fill: { kind: "pattern", pattern: "Wood" }, styles: { patternOverlay: { on: true, pattern: "user:Dots" } } })) === '["Wood","Dots"]' && PT.usesOf({ styles: { patternOverlay: { pattern: "checker" } } }).length === 0 && PT.usesOf({ fill: { kind: "solid" } }).length === 0);
check("scaleOf: 1 - 1000 %, 100 by default", PT.scaleOf(0) === 100 && PT.scaleOf(5000) === 1000 && PT.scaleOf("50") === 50 && PT.scaleOf(undefined) === 100);

/* ---- the wiring */
const IE = read("ext", "imageeditdock", "imageedit.js"), UI = read("ext", "imageeditdock", "pcui.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IDX = read("routes", "index.js");
check("pcgenfill + pcpattern after pcbgi, before imageedit.js, installed", EXT.indexOf("pcgenfill.js") === EXT.indexOf("pcbgi.js") + 1 && EXT.indexOf("pcpattern.js") === EXT.indexOf("pcgenfill.js") + 1 && EXT.indexOf("pcpattern.js") < EXT.indexOf("imageedit.js") && /PCGenFill\.install\(E\)/.test(IE) && /PCPattern\.install\(E\)/.test(IE));
check("runAI keeps the target (S.genInto -> the result's info, no feather), ✔ Apply places it onto that layer (PCGenFill.placeOnto)", /into: S\.genInto \|\| null/.test(IE) && /feather: whole \|\| S\.genInto \|\| clip \? 0 : S\.feather/.test(IE) && /win\.PCGenFill\.placeOnto\(E, L, T, into\.how\)/.test(IE));
check("pcui: the layer right-click menu takes modules' items (E.ui.layerCtxItems), Properties their rows (E.ui.propsExtra); a fill layer's Pattern kind; Edit ▸ Fill ▸ Pattern",
  /E\.ui\.layerCtxItems/.test(UI) && /E\.ui\.propsExtra/.test(UI) && /<option value="pattern"/.test(UI) && /id="ppFPat"/.test(UI) && /<option value="pat">Pattern<\/option>/.test(UI) && /E\.patterns\.fillWith/.test(UI));
check("pcdoc drawFill draws kind pattern (PCPattern.scaled), pcstyles' Pattern Overlay a user:<name>", /f\.kind === "pattern"/.test(read("ext", "imageeditdock", "pcdoc.js")) && /\^user:/.test(read("ext", "imageeditdock", "pcstyles.js")));
check("routes/patterns.js mounted from routes/index.js (server.js untouched); .bgi carries the patterns it uses", /require\("\.\/patterns"\)\.mount\(app\)/.test(IDX) && !/patternStore|pcgenfill/.test(read("server.js")) && /m\.patterns = \[\]/.test(read("ext", "imageeditdock", "pcbgi.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
