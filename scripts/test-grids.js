#!/usr/bin/env node
/* bitGen Studio — 2.445.0 units: THE GRID BUTTONS + THE GRIDS & GUIDES SETTINGS TABS (static/gridspec.js H3Grid, the
 * image editor's pcguides / pcprefs / pcui, the timeline's tlgrid.js / tlsettings.js tabs). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const G = require(path.join(ROOT, "static", "gridspec.js"));

check("clean: every value checked (spacing 0 - 4096, major 0 - 50, lines | dots, #rrggbb colours, strength 5 - 100 %, snap 1 - 50 px)",
  JSON.stringify(G.clean({ on: 1, spacing: 9999, major: -3, style: "zigzag", color: "red", opacity: 7, guideColor: "#ABCDEF", snap: 0 })) === JSON.stringify({ on: true, spacing: 4096, major: 0, style: "lines", color: "#2680eb", opacity: 1, guideColor: "#abcdef", snap: 1 })
  && G.clean({ style: "dots" }).style === "dots" && G.clean(null).major === 5);
check("stepFor: a set spacing (doubled while under 4 screen px); 0 = the one that suits the zoom", G.stepFor({ spacing: 25 }, 1) === 25 && G.stepFor({ spacing: 2 }, 1) === 4 && G.stepFor({ spacing: 0 }, 1) === 32 && G.stepFor({ spacing: 0 }, 4) === 8);
const rec = () => { const c = { m: [], f: [], s: [] }; return { c, g: { save() {}, restore() {}, beginPath() {}, moveTo(x, y) { c.m.push([x, y]); }, lineTo() {}, stroke() { c.s.push(this.strokeStyle + "|" + this.lineWidth); }, fillRect(x, y, w) { c.f.push([x, y, w]); } } }; };
const a = rec(), ra = G.draw(a.g, { spacing: 10, major: 5, style: "lines" }, { x: 0, y: 0, w: 100, h: 50 }, 1, { lineWidth: 1 });
check("draw lines: a line every 10 px across a 100 x 50 picture (9 + 4), the major ones (every 5th) in a second, stronger pass", ra.cols === 9 && ra.rows === 4 && a.c.m.length === 13 && a.c.s.length === 2 && /\|1\.4$/.test(a.c.s[1]), { ra, s: a.c.s });
const b = rec(), rb = G.draw(b.g, { spacing: 10, major: 5, style: "dots" }, { x: 5, y: 5, w: 100, h: 50 }, 2, { lineWidth: 1, viewZoom: 2 });
check("draw dots: a dot at each crossing (in the context's units: 10 px x zoom 2 = 20), bigger on a major crossing", rb.cols === 4 && rb.rows === 2 && b.c.f.length === 8 && b.c.f[0][0] === 5 + 20 - 0.9, { rb, f: b.c.f.slice(0, 3) });
const html = G.tabHtml({ spacing: 16, major: 4, style: "dots" }, "zz");
const fake = { querySelector: (sel) => ({ "#zzSp": { value: "24" }, "#zzMj": { value: "3" }, "#zzSt": { value: "dots" }, "#zzGc": { value: "#112233" }, "#zzGo": { value: "60" }, "#zzGd": { value: "#445566" }, "#zzSn": { value: "12" } })[sel] };
check("tabHtml / readTab: the tab both dialogs use - grid spacing, major every, lines or dots, grid colour + strength, guideline colour, snap distance",
  ["zzSp", "zzMj", "zzSt", "zzGc", "zzGo", "zzGd", "zzSn"].every((id) => html.includes('id="' + id + '"')) && /<option value="dots" selected>/.test(html)
  && JSON.stringify(G.readTab(fake, "zz", { on: true })) === JSON.stringify({ on: true, spacing: 24, major: 3, style: "dots", color: "#112233", opacity: 0.6, guideColor: "#445566", snap: 12 }));
const IDX = read("static", "index.html"), GU = read("ext", "imageeditdock", "pcguides.js"), PU = read("ext", "imageeditdock", "pcui.js"), PR = read("ext", "imageeditdock", "pcprefs.js");
const TS = read("ext", "timelinedock", "tlsettings.js"), TG = read("ext", "timelinedock", "tlgrid.js"), TX = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("the page loads gridspec.js in <head>; the editor: ⚙'s Grids & Guides tab (E.prefTabs -> pcprefs), ⊞ #kxGridBtn on the top bar, the grid drawn by H3Grid from E.gridSpec, Grid and Snapping… opens the tab",
  IDX.indexOf('<script src="/static/gridspec.js">') > 0 && IDX.indexOf('<script src="/static/gridspec.js">') < IDX.indexOf("</head>") && /id: "grid", label: "Grids & Guides"/.test(GU) && /E\.prefTabs = \(E\.prefTabs \|\| \[\]\)\.concat/.test(GU)
  && /gbtn\.id = "kxGridBtn"/.test(GU) && /root\.H3Grid\.draw\(g, E\.gridSpec\(\)/.test(PU) && /\(E\.prefTabs \|\| \[\]\)\.forEach\(add\)/.test(PR) && /E\.prefs\.open\("grid"\)/.test(GU));
check("the timeline: ⚙ Timeline settings has tabs (addTab; General + what others add, their read() merged into the save), tlgrid.js adds Grids & Guides, ⊞ #tlGridBtn beside 🧰, the grid drawn on the preview (TlCanvas.onDraw), kept as ui.tl_grid; loaded after tlfloat.js",
  /function addTab\(t\)/.test(TS) && /data-tlstab="general"/.test(TS) && /Object\.assign\(ui, r\.ui \|\| \{\}\)/.test(TS) && /TimelineSettings\.addTab\(\{ id: "grid", label: "Grids & Guides"/.test(TG)
  && /btn\.id = "tlGridBtn"/.test(TG) && /TlCanvas\.onDraw\(function \(g, h\)/.test(TG) && /tl_grid/.test(TG) && TX.indexOf("tlgrid.js") === TX.indexOf("tlfloat.js") + 1);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
