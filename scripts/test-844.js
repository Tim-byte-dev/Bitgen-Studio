#!/usr/bin/env node
/* bitGen Studio — 2.844.0 units: the image editor's four views on its top strip (📝 WP View, ✒ Vector View, 🖼 Image View,
 * 🌐 Web View) - pcviews.js's plans, the tool each starts with, the preview's device scale, the web page size, the ribbons
 * (every command they use exists), View ▸ Pages: One Below Another, the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const V = require(path.join(ROOT, "ext/imageeditdock/pcviews.js")), PV = require(path.join(ROOT, "ext/imageeditdock/pcpageview.js"));
const PG = require(path.join(ROOT, "ext/imageeditdock/pcpages.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

check("four views, named as Tim asked (WP View, Vector View, Image View, Web View) - no other program's name in them",
  V.VIEWS.map((v) => v.label).join() === "WP View,Vector View,Image View,Web View" && !V.VIEWS.some((v) => /\bWord\b|Corel|Photoshop|Illustrator|Microsoft/.test(v.label + v.title)), V.VIEWS.map((v) => v.label));
const wp = V.planOf("wp"), vec = V.planOf("vector"), img = V.planOf("image"), web = V.planOf("web");
check("WP View: pages one below another, the writing ribbon, no tool column, Paragraph to the front, the WP tool",
  wp.pageMode === "column" && wp.ribbon === "wp" && wp.tools === false && wp.tabs.includes("pcPara") && wp.tool === "doctext" && wp.groups.dock === false);
check("Vector View: the colour palette, the dockers (Transform first), the tools, rulers, the Move (pick) tool, no ribbon",
  vec.palette === true && vec.groups.dock === true && vec.tabs[0] === "dkXf" && vec.tools && vec.rulers && vec.tool === "move" && vec.ribbon === null);
check("Image View: the tools, Color + Properties + Layers, no palette, no dockers, one page, the tool kept",
  img.tools && !img.palette && img.groups.color && img.groups.props && img.groups.layers && !img.groups.dock && img.pageMode === "one" && img.tool === null);
check("Web View: the Pages panel, the web ribbon, Align to the front", web.pages === true && web.ribbon === "web" && web.tabs[0] === "dkAlign");
check("planOf: an unknown view = null", V.planOf("nope") === null && V.planOf() === null);
check("toolFor: a view's own tool; Image View keeps the tool in use, but not the WP tool",
  V.toolFor(wp, "brush") === "doctext" && V.toolFor(img, "brush") === "brush" && V.toolFor(img, "doctext") === "move" && V.toolFor(null, "lasso") === "lasso");
check("fitScale: a phone fits as it is, a desktop is scaled into a small room, never above 1, bad sizes = 1",
  V.fitScale(390, 844, 1200, 900) === 1 && Math.abs(V.fitScale(1280, 800, 640, 800) - 0.5) < 1e-9 && V.fitScale(0, 800, 640, 800) === 1, [V.fitScale(1280, 800, 640, 800)]);
check("DEVICES: desktop, tablet, phone - widths 1280 / 768 / 390", V.DEVICES.map((d) => d[0] + d[3]).join() === "desktop1280,tablet768,phone390");
check("WEB_PAGE: a 1440 x 900 px page (pcpages' own sizing)", JSON.stringify(PG.pagePx ? PG.pagePx(V.WEB_PAGE) : null) === JSON.stringify({ w: 1440, h: 900 }), PG.pagePx && PG.pagePx(V.WEB_PAGE));
check("narrow: icons only under 1250 px", V.narrow(900) && !V.narrow(1400) && !V.narrow(0));
// the ribbons
const SRC = fs.readdirSync(path.join(ROOT, "ext/imageeditdock")).filter((f) => f.endsWith(".js")).map((f) => read("ext/imageeditdock", f)).join("\n");
const missing = [...V.cmdIds(V.RIBBONS.wp), ...V.cmdIds(V.RIBBONS.web)].filter((id) => {
  if (/^view\.pages\./.test(id)) return !PV.MODES.some(([m]) => "view.pages." + m === id);
  return !new RegExp(`["']${id.replace(/\./g, "\\.")}["']`).test(SRC.replace(/RIBBONS = \{[\s\S]*?\n {2}\};/, ""));
});
check("every menu command the ribbons use is registered by a module", missing.length === 0, missing);
check("the WP ribbon: Home, Insert, Layout, Mailings, Review, Export; the web ribbon: Web",
  V.RIBBONS.wp.map((t) => t.id).join() === "home,insert,layout,mailings,review,export" && V.RIBBONS.web.map((t) => t.id).join() === "web");
const made = [];
const sp = V.specOf(V.RIBBONS.web, (k, id, label, icon) => { made.push(k + ":" + id); return k === "act" && id === "db" ? null : { id: k + id, label, icon, run() {} }; });
check("specOf: CadBar's spec - tabs, groups, items made by make(); one make() returning null is left out",
  sp.tabs.length === 1 && sp.tabs[0].groups.find((g) => g.label === "Data").items.length === 0 && made.includes("act:dev:phone") && made.includes("cmd:file.website"));
const DTX = read("ext/imageeditdock/pcdoctext.js"), STY = DTX.match(/const STYLES = \[[\s\S]*?\]\];/)[0];
check("the WP ribbon's actions are the doctext tool's own (bold … justify, the styles)",
  V.RIBBONS.wp[0].groups.flatMap((g) => g.items).filter((i) => i[0] === "fx").map((i) => i[1]).every((a) => (a.startsWith("style:") ? STY.includes(`["${a.slice(6)}"`) : DTX.includes(`BTN("${a}"`))));
// View ▸ Pages: One Below Another
const L = PV.layout([{ w: 100, h: 140 }, { w: 100, h: 140 }, { w: 100, h: 140 }], "column", 10);
check("pageview: One Below Another - every page in one column", PV.MODES.some(([m]) => m === "column") && PV.COLS.column === 1 && L.every((p) => p.x === 0) && L[1].y === 150 && L[2].y === 300, L);
const PVS = read("ext/imageeditdock/pcpageview.js"), DT = read("ext/imageeditdock/pcdoctext.js");
check("pageview: setMode(m, quiet) (a view switching says nothing about one page); the column fitted to the width; the View menu lists every mode",
  /function setMode\(m, quiet\)/.test(PVS) && /mode === "column" \? Math\.min\(1, aw \/ W\)/.test(PVS) && /\.\.\.MODES\.map/.test(PVS));
check("doctext: setStyle and indent handed out (the ribbon's Styles / indents)", /E\.docText = \{[^}]*setStyle, indent/.test(DT));
// the wiring
const EX = JSON.parse(read("ext/imageeditdock/ext.json")), IE = read("ext/imageeditdock/imageedit.js"), VS = read("ext/imageeditdock/pcviews.js");
check("the wiring: pcviews.js after pcsite.js + pccalendar.js, installed after the panel column docker (every panel / tab exists); its strip at the start of the top strip's right part; Window ▸ Workspace",
  EX.scripts.indexOf("pcviews.js") === EX.scripts.indexOf("pccalendar.js") + 1 && EX.scripts.indexOf("pccalendar.js") === EX.scripts.indexOf("pcsite.js") + 2 && IE.indexOf("PCViews.install(E)") > IE.indexOf("PCColDock.install(E)")
  && /mr\.insertBefore\(strip, mr\.firstChild\)/.test(VS) && /label: "Workspace"/.test(VS) && /ws\.view/.test(VS));
check("the preview iframe runs no scripts (sandbox without allow-scripts)", /sandbox="allow-same-origin"/.test(VS) && !/allow-scripts/.test(VS));
check("nothing added to misc/server.js", !/pcviews|ws\.view/.test(read("misc/server.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
