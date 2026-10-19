#!/usr/bin/env node
/* bitGen Studio — 2.430.0 units: the image editor's DOCUMENTS (pcdocs.js), CorelDRAW's COLOUR PALETTE / ⊠ transparent /
 * AUTO-FILL (pcpalette.js) + the wiring
 *   1. a document's keys, blank / take / give (by reference), dirty, cascade / tile, next, the tab strip's drop zone
 *   2. the palette's chips, autoFillOf (the colour picked last -> fill), isVector, the Document palette
 *   3. the wiring: ext.json, the installs, openDoc's hooks (docBefore / docAfter, inPlace), pcpdf's session per
 *      document, the batch closing its documents, ⊠ in the brush / bucket / Fill, the curve tools' auto-fill
 * Tim: "in image editor open/create new file in a modular docker, when docked show open documents as tabs. add a
 * transparent color to the color pallet. when a shape is drawn autofill it when it is closed" + "create a pallet docker
 * like coreldraw on the right side of the image-edit docker the autofill color will be the last color selected". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const K = require(path.join(ROOT, "ext", "imageeditdock", "pcdocs.js"));
const PL = require(path.join(ROOT, "ext", "imageeditdock", "pcpalette.js"));

/* ---- 1 */
check("DOC_KEYS: the picture, its layers, undo / redo, selection, paths, channels, the view - not the tools or colours",
  ["w", "h", "name", "layers", "active", "undo", "redo", "sel", "paths", "work", "channels", "zoom", "panX", "panY", "histSrc", "savedTop"].every((k) => K.DOC_KEYS.includes(k)) && !["tool", "fg", "bg", "size", "preset"].some((k) => K.DOC_KEYS.includes(k)));
const S = { tool: "paint", fg: "#123456" }; K.give(S, K.blank());
check("blank + give: an empty document, the editor's own state untouched", S.w === 0 && Array.isArray(S.layers) && S.layers.length === 0 && S.undo.length === 0 && S.tool === "paint" && S.fg === "#123456" && S.histSrc instanceof Map);
const layers = [{ id: 1 }], undo = [{ t: "struct" }];
Object.assign(S, { w: 10, h: 5, name: "x.png", layers, undo, zoom: 2 });
const st = K.take(S);
K.give(S, K.blank());
check("take keeps the document by reference (nothing copied); give(blank) leaves S empty for the next one", st.layers === layers && st.undo === undo && st.zoom === 2 && S.layers !== layers && S.w === 0);
K.give(S, st);
check("give puts it back exactly", S.layers === layers && S.undo === undo && S.w === 10 && S.name === "x.png" && S.tool === "paint");
check("dirty: a fresh one is clean; a change = dirty; saved at that step = clean; undone past the save = dirty",
  K.dirty({ undo: [], savedTop: undefined }) === false && K.dirty({ undo: [undo[0]], savedTop: undefined }) === true && K.dirty({ undo: [undo[0]], savedTop: undo[0] }) === false && K.dirty({ undo: [], savedTop: undo[0] }) === true);
const c0 = K.cascade(0, { w: 1000, h: 700 }), c1 = K.cascade(1, { w: 1000, h: 700 });
check("cascade: 72 % of the room, each next one 28 px further", c0.w === 720 && c0.h === 504 && c0.x === 12 && c1.x === 40 && c1.y === 40, [c0, c1]);
const t3 = K.tile(3, { w: 900, h: 600 }), t4 = K.tile(4, { w: 900, h: 600 });
check("tile: 3 = 2 columns x 2 rows (the room shared), 4 = 2 x 2", t3.length === 3 && t3[0].w === 450 && t3[2].y === 300 && t4[3].x === 450 && t4[3].y === 300 && K.tile(0, { w: 1, h: 1 }).length === 0, [t3, t4]);
check("nextId goes round both ways", K.nextId(["a", "b", "c"], "c", 1) === "a" && K.nextId(["a", "b", "c"], "a", -1) === "c" && K.nextId([], "a", 1) === null && K.nextId(["a"], "zz", 1) === "a");
check("overStrip: over the tab strip (a little below it counts)", K.overStrip(50, 20, { left: 0, right: 100, top: 10, bottom: 30 }) && K.overStrip(50, 40, { left: 0, right: 100, top: 10, bottom: 30 }) && !K.overStrip(50, 60, { left: 0, right: 100, top: 10, bottom: 30 }) && !K.overStrip(50, 20, null));

/* ---- 2 */
check("the palette: black ... white, 12 hues x 4 tones, browns; the Greys palette black -> white", PL.DEFAULT[0] === "#000000" && PL.DEFAULT[5] === "#ffffff" && PL.DEFAULT.length === 6 + 48 + 4 && PL.DEFAULT.every((c) => /^#[0-9a-f]{6}$/.test(c)) && PL.GREYS[0] === "#000000" && PL.GREYS[PL.GREYS.length - 1] === "#ffffff");
check("hsl: pure red / green / blue", PL.hsl(0, 100, 50) === "#ff0000" && PL.hsl(120, 100, 50) === "#00ff00" && PL.hsl(240, 100, 50) === "#0000ff");
check("autoFillOf: the colour picked last fills; ⊠ = not filled; the ▨ toggle off = not filled; nothing picked = the background colour",
  JSON.stringify(PL.autoFillOf("#FF0000", true, "#fff")) === '{"fill":"#ff0000","fillOn":true}' && PL.autoFillOf("none", true, "#ffffff").fillOn === false && PL.autoFillOf("#00ff00", false, "#fff").fillOn === false && PL.autoFillOf(undefined, true, "#abcdef").fill === "#abcdef");
check("isVector: shapes / curves and type are coloured CorelDRAW's way; pixels are not", PL.isVector({ type: "shape", shape: {} }) && PL.isVector({ type: "text", text: {} }) && !PL.isVector({ type: "pixel" }) && !PL.isVector(null));
check("docColours: fills (not when off), outlines (when on), gradients, type - each once",
  PL.docColours([{ type: "shape", shape: { fill: "#FF0000", fillOn: true, stroke: "#000000", strokeOn: true } }, { type: "shape", shape: { fill: "#00ff00", fillOn: false, stroke: "#111111", strokeOn: false, fillGrad: { c1: "#ff0000", c2: "#0000ff" } } }, { type: "text", text: { color: "#000000" } }]).join() === "#ff0000,#000000,#0000ff");

/* ---- 3 */
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js"), PDF = read("ext", "imageeditdock", "pcpdf.js"),
  ACT = read("ext", "imageeditdock", "pcactions.js"), VL = read("ext", "imageeditdock", "pcvline.js"), FILL = read("ext", "imageeditdock", "pcfill.js"), PEN = read("ext", "imageeditdock", "pcpen.js"), TOOLS = read("ext", "imageeditdock", "pctools.js");
check("ext.json: pcdocs right after pcui, pcpalette right after pcdockers; installed in that order", EXT.indexOf("pcdocs.js") === EXT.indexOf("pcui.js") + 1 && EXT.indexOf("pcpalette.js") === EXT.indexOf("pcdockers.js") + 1
  && IE.indexOf("PCUI.install(E)") < IE.indexOf("PCDocs.install(E)") && IE.indexOf("PCPalette.install(E)") < IE.indexOf("PCDockers.install(E)"));
check("openDoc(w, h, name, paint, opts): docBefore (the one in front parked) / docAfter (a record), opts.inPlace = the same document",
  /function openDoc\(w, h, name, paint, opts\) \{\s*const inPlace = !!\(opts && opts\.inPlace\);\s*if \(E\.docBefore\) E\.docBefore\(inPlace, name\);/.test(IE) && /if \(E\.docAfter\) E\.docAfter\(inPlace, name\);/.test(IE) && /function blankDoc\(\)/.test(IE));
check("pcpdf: the session goes with its document (E.pdfSession get / set / drop), a page opens in place, a new PDF parks the one in front",
  /E\.pdfSession = \{/.test(PDF) && (PDF.match(/\{ inPlace: P\.cur >= 0 \}/g) || []).length === 2 && /if \(E\.docs\) E\.docs\.park\(\);/.test(PDF));
check("the batch closes each picture's document when it is done (never one that was open before)", /const shut = \(\) => \{ if \(opened && E\.docs && E\.docs\.live\(\) === opened\) E\.docs\.closeNow\(opened\); \};/.test(ACT));
check("⊠ transparent: the brush erases (effectivePreset), the bucket and Edit ▸ Fill clear, setFgNone", /S\.fgNone && S\.tool === "paint"/.test(IE) && /if \(S\.fgNone\) return clearSelectionArea\(\);/.test(IE) && /S\.fgNone && plan\.source !== "gradient"/.test(FILL) && /function setFgNone\(\)/.test(IE));
check("auto-fill: new curves / F6 shapes (newLine), the Pen's and the Shape tool's shapes take the colour picked last; ▨ on by default",
  /const af = auto\(\);/.test(VL) && /S\.vlFillOn = !!store\.get\("vl\.autofill", true\);/.test(VL) && /E\.autoFill\(true\)/.test(PEN) && /E\.autoFill\(true\)/.test(TOOLS));
check("server.js untouched", !/pcdocs|pcpalette/.test(read("server.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
