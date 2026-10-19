#!/usr/bin/env node
/* bitGen Studio — 2.470.0 units: THE CAD TOOLBAR (static/cadbar.js, ext/imageeditdock/pccadbar.js,
 * ext/timelinedock/tlcadbar.js) + PICKING LIKE A DRAWING / CAD PROGRAM (pcselhl.js, tlselhl.js) - pure parts + wiring.
 * Tim (verbatim): "on mouseover of a shape or object or smart object, highlight the border of the shape ... a different
 * highlight color when it is selected. automatically select the move tool once the shape is drawn (on mouseup) when i
 * click away from the shape deselect it ... make the sketch toolbar a top docker like fusion 360 in image editor and timeline" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const CB = require(path.join(ROOT, "static", "cadbar.js"));
const CAD = require(path.join(ROOT, "ext", "imageeditdock", "pccadbar.js"));
const SH = require(path.join(ROOT, "ext", "imageeditdock", "pcselhl.js"));

// normalize: bad tabs / groups / items dropped, labels upper-cased, defaults
const run = () => {};
const n = CB.normalize({ tabs: [{ id: "a", label: "Sketch", groups: [{ label: "Create", items: [{ id: "x", run }, { sep: true }, { id: "y" }, null, { id: "z", label: "Zed", icon: "Z", run }] },
  { label: "empty", items: [] }, { label: "only seps", items: [{ sep: true }] }] }, { label: "no id" }, null, { id: "b", groups: [] }] });
check("normalize: tabs without an id dropped, labels upper-case, items without run() dropped, empty groups dropped, default label / icon / show 3",
  n.tabs.length === 2 && n.tabs[0].label === "SKETCH" && n.tabs[1].label === "B" && n.tabs[0].groups.length === 1 && n.tabs[0].groups[0].label === "CREATE"
  && n.tabs[0].groups[0].items.length === 3 && n.tabs[0].groups[0].items[0].label === "x" && n.tabs[0].groups[0].items[0].icon === "•" && n.tabs[0].groups[0].items[1].sep
  && n.tabs[0].groups[0].show === 3 && n.tabs[0].groups[0].inline === false, n);
check("normalize: nothing / junk -> no tabs", CB.normalize(null).tabs.length === 0 && CB.normalize({ tabs: 3 }).tabs.length === 0);
check("firstEnabled: skips separators and disabled items", CB.firstEnabled([{ sep: true }, { id: "a", enabled: () => false }, { id: "b" }]).id === "b" && CB.firstEnabled([{ sep: true }]) === null);
check("the ribbon's CSS: tabs, big buttons, inline (2-row) buttons, the ▾ menus, folded", /\.cadbar \.cbtab\.on/.test(CB.CSS) && /\.cbin\{display:grid/.test(CB.CSS) && /\.cbmenu\{position:fixed/.test(CB.CSS) && /\.cadbar\.folded \.cbrib\{display:none\}/.test(CB.CSS));

// the image editor's toolbar
check("pccadbar: 12 constraints (the ones the sketch knows), SVG icons for the sketch tools", CAD.CONSTRAINTS.length === 12
  && CAD.CONSTRAINTS.every(([t]) => new RegExp('case "' + t + '"').test(read("ext", "imageeditdock", "pcsketchtools.js")))
  && ["line", "rect", "circle", "arc", "fillet", "trim", "offset", "mirror", "dim", "measure", "finish"].every((k) => /^<svg viewBox="0 0 24 24">/.test(CAD.ICONS[k])), CAD.CONSTRAINTS);
const ST = read("ext", "imageeditdock", "pcsketchtools.js"), SCU = read("ext", "imageeditdock", "pcsketchcadui.js");
check("pccadbar: every sketch tool it names exists (pcsketchtools TOOLS), every command it runs exists",
  CAD.SPEC_IDS.tools.filter((t) => /^sk_/.test(t)).every((t) => ST.includes('["' + t + '"')) && CAD.SPEC_IDS.commands.every((c) => ST.includes('"' + c + '"') || SCU.includes('"' + c + '"')), CAD.SPEC_IDS);
const PC = read("ext", "imageeditdock", "pccadbar.js");
check("pccadbar: SKETCH (Create / Modify / Constraints inline / Inspect / Insert / Finish Sketch) + SHAPES (Select / Draw / After Drawing); over #kxBar; follows a sketch tool; E.cadBar.addTab; Window ▸ CAD Toolbar (store cadbar.ie.on)",
  /label: "Create", show: 5/.test(PC) && /label: "Modify"/.test(PC) && /label: "Constraints", inline: true/.test(PC) && /label: "Inspect"/.test(PC) && /label: "Insert"/.test(PC) && /label: "Finish Sketch"/.test(PC)
  && /id: "shapes"/.test(PC) && /bar\.parentNode\.insertBefore\(ui\.el, bar\)/.test(PC) && /ui\.setTab\("sketch"\)/.test(PC) && /addTab: \(tab\)/.test(PC) && /"win\.cadbar", "CAD Toolbar"/.test(PC) && /cadbar\.ie\.on/.test(PC)
  && /s\.src = "\/static\/cadbar\.js"/.test(PC));

// picking
check("pcselhl: hover blue, picked orange; the shape tools that hand over to the Move tool", SH.COLORS.hover === "#3aa0ff" && SH.COLORS.selected === "#ff8a00"
  && ["shape", "customshape", "crect", "cellipse", "cpolygon", "cstar", "line2"].every((t) => SH.AUTO_MOVE.includes(t)) && !SH.AUTO_MOVE.includes("pen") && !SH.AUTO_MOVE.includes("bezier"));
const bgL = { type: "pixel" }, top = { type: "pixel" }, layers = [bgL, top];
check("isBackground: the bottom pixel layer filling the picture only", SH.isBackground(bgL, layers, { x: 0, y: 0, w: 600, h: 400 }, 600, 400) === true
  && SH.isBackground(top, layers, { x: 0, y: 0, w: 600, h: 400 }, 600, 400) === false && SH.isBackground(bgL, layers, { x: 50, y: 0, w: 300, h: 400 }, 600, 400) === false
  && SH.isBackground({ type: "shape" }, [{ type: "shape" }], { x: 0, y: 0, w: 600, h: 400 }, 600, 400) === false);
check("pickable: shapes / smart / text / pixel yes; groups, adjustment layers, fill layers without a mask, position-locked, control layers no",
  ["shape", "smart", "text", "pixel", "sketch", "layer3d"].every((t) => SH.pickable({ type: t })) && !SH.pickable({ type: "group" }) && !SH.pickable({ type: "adjust" })
  && !SH.pickable({ type: "fill" }) && SH.pickable({ type: "fill", mask: {} }) && !SH.pickable({ type: "shape", locks: { pos: true } }) && !SH.pickable({ type: "pixel", control: true }) && !SH.pickable(null));
const PS = read("ext", "imageeditdock", "pcselhl.js"), PH = read("ext", "imageeditdock", "pchandles.js");
check("pcselhl: a click on nothing = nothing picked (the press stops there), Esc, a Layers-panel click picks again, a selection / Auto-select left alone; pchandles hides its handles when nothing is picked; store draw.automove",
  /e\.stopImmediatePropagation\(\); e\.preventDefault\(\);/.test(PS) && /e\.key === "Escape"/.test(PS) && /closest\("\.kxlayer"\)/.test(PS) && /S\.autoSelect \|\| E\.hasSel\(\)/.test(PS) && /draw\.automove/.test(PS)
  && /const shown = \(\) => S\.tool === "move" && !S\.drag && S\.objSel !== false && !!target\(\);/.test(PH));

// wiring
const EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, IE = read("ext", "imageeditdock", "imageedit.js");
check("wiring: pcselhl.js + pccadbar.js right after pchandles.js; installed right after PCHandles", EXT.indexOf("pcselhl.js") === EXT.indexOf("pchandles.js") + 1 && EXT.indexOf("pccadbar.js") === EXT.indexOf("pchandles.js") + 3 && EXT.indexOf("pcmultisel.js") === EXT.indexOf("pchandles.js") + 2
  && IE.indexOf("PCSelHl.install(E)") > IE.indexOf("PCHandles.install(E)") && IE.indexOf("PCCadBar.install(E)") > IE.indexOf("PCSelHl.install(E)"));
const TX = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts, TC = read("ext", "timelinedock", "tlcadbar.js"), TS = read("ext", "timelinedock", "tlselhl.js"), IDX = read("static", "index.html");
check("wiring: the timeline's tlselhl.js + tlcadbar.js after tlgrid.js; static/cadbar.js loaded by the page", TX.indexOf("tlselhl.js") === TX.indexOf("tlgrid.js") + 1 && TX.indexOf("tlcadbar.js") === TX.indexOf("tlgrid.js") + 2
  && /<script src="\/static\/cadbar\.js"><\/script>/.test(IDX));
check("tlcadbar: CREATE (Text, 3D Text, 3D Model, Camera, Path, Move / Hand / Zoom / Fit / Select / Mask) · 3D (the 3D bar's widget + view buttons, Key, Bake) · SKETCH (on this frame / a blank picture -> the image editor + a sketch layer); over #tlStage; TlCadBar.addTab",
  /id: "create"/.test(TC) && /id: "3d"/.test(TC) && /id: "sketch"/.test(TC) && /data-t3mode=/.test(TC) && /data-t3view=/.test(TC) && /#t3Bake/.test(TC) && /E\.sketch\.newSketch\(\)/.test(TC)
  && /stage\.parentNode\.insertBefore\(ui\.el, stage\)/.test(TC) && /addTab: function \(tab\)/.test(TC) && /C\.snapshot\(\)/.test(TC));
check("tlselhl: the clip under the pointer (Move tool, not V1, not the picked one) outlined blue on the preview", /HOVER = "#3aa0ff"/.test(TS) && /h\.Ly\.kind !== "v1"/.test(TS) && /C\.onDraw\(function \(ctx\)/.test(TS));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
