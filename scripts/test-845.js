#!/usr/bin/env node
/* bitGen Studio — 2.845.0 units: ⟷ Page Width in the image editor's zoom settings - imageedit.js widthView (the page's width
 * fills the view, the line at the view's top kept), the command / buttons / shortcut wiring.
 * Tim: "in zoom settings, add zoom to page width". */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const IE = require(path.join(ROOT, "ext/imageeditdock/imageedit.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const W = IE.widthView;
const a = W(1032, 500, 700, { zoom: 1, panY: 16 }, { left: 16, right: 16, top: 16 });
check("widthView: the page's width fills the room between the pads (1000 px for a 500 px page = 200 %), its top at the top pad", a.zoom === 2 && a.panX === 16 && a.panY === 16, a);
const b = W(1032, 500, 700, { zoom: 0.5, panY: 16 - 100 * 0.5 }, { left: 16, right: 16, top: 16 });
check("widthView: the page line at the view's top stays there (line 100 -> still at the top after zooming)", b.zoom === 2 && b.panY === 16 - 200, b);
const c = W(1032, 500, 700, { zoom: 1, panY: 300 }, { left: 16, right: 16, top: 16 });
check("widthView: when the view showed above the page, the page's top goes to the top", c.panY === 16, c);
const d = W(40, 500, 700, null, null);
check("widthView: a tiny view still gives a sane zoom (50 px room at least), defaults for no current view / pads", d.zoom > 0 && Number.isFinite(d.panX) && d.panY === 16, d);
check("widthView: the zoom kept between 2 % and 3200 %", W(1032, 1, 1).zoom === 32 && W(100, 1e6, 1e6).zoom === 0.02);
const IS = read("ext/imageeditdock/imageedit.js"), UI = read("ext/imageeditdock/pcui.js"), TL = read("ext/imageeditdock/pctools.js"), VW = read("ext/imageeditdock/pcviews.js");
check("wiring: E.fitWidth; the ⟷ button beside ⤢ on the top strip; View ▸ Page Width (Shift+Ctrl+0) after Fit on Screen; ⟷ Page Width in the Zoom tool's settings; the WP View's Layout ribbon",
  /applyView, fitView, fitWidth, zoomAt/.test(IS) && /id="kxFit"[^\n]*\n\s*<button class="ghost" id="kxPageW"/.test(IS) && /\$\("kxPageW"\)\.onclick = \(\) => fitWidth\(\)/.test(IS)
  && /cmd\("view\.pagewidth", "Page Width", "Shift\+Ctrl\+0"/.test(UI) && /"view\.fit", "view\.pagewidth"/.test(UI)
  && /id="ptZPW"[^`]*⟷ Page Width/.test(TL) && /#ptZPW"\)\.onclick = \(\) => E\.fitWidth\(\)/.test(TL) && /\["cmd", "view\.pagewidth", "Page Width", "⟷"\]/.test(VW));
const SC = JSON.parse(read("docs/shortcuts.json")), keys = SC.groups.flatMap((g) => g.rows.map((r) => r[0]));
check("shortcuts.json: Shift+Ctrl+0 = Page Width, used once (Alt+Ctrl+W stays Close All)", SC.groups.some((g) => g.rows.some((r) => r[0] === "Shift+Ctrl+0" && r[1] === "Page Width")) && keys.filter((k) => k === "Shift+Ctrl+0").length === 1);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
