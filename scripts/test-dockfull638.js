#!/usr/bin/env node
/* bitGen Studio — 2.638.0 (pure + wiring): A DOCKER'S ⛶ = THE WHOLE WINDOW WITH THE OTHERS CLOSED, 🗗 = THE LAYOUT BEFORE
 * (static/dockfull.js, used by the 📐 SolidCraft docker).
 * Tim: "make the solidcraft docker full screen and close the other dockers on maximize, on restore go back to the layout it
 * was in before maximized" */
"use strict";
const fs = require("fs");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
const DF = require(path.join(R0, "static", "dockfull.js"));
const docks = [{ id: "promptdock", btn: "tP", shown: true, collapsed: false, style: "height: 300px" }, { id: "musicdock", btn: "tMu", shown: true, collapsed: true, style: null },
  { id: "consoledock", btn: "tC", shown: false, collapsed: false, style: null }, { id: "solidcraftdock", btn: "tX_solidcraftdock", shown: true, collapsed: false, style: "" }];
const ls = [["h3.g.promptdock", "0"], ["h3.c.musicdock", "1"], ["h3.d.promptdock", "300"], ["h3.g.solidcraftdock", "0"], ["h3.theme", "dark"], ["ag.scope", "x"]];
const snap = DF.snapshotOf(docks, ls, "solidcraftdock");
check("the snapshot: every other docker (shown, folded, its style), not the maximized one itself", snap.docks.length === 3 && !snap.docks.some((d) => d.id === "solidcraftdock") && snap.docks[0].style === "height: 300px" && snap.docks[1].collapsed === true);
check("…and this browser's docker memory (h3.g. / c. / d. …) - not its own keys, not other settings", snap.local["h3.g.promptdock"] === "0" && snap.local["h3.c.musicdock"] === "1" && snap.local["h3.d.promptdock"] === "300" && !("h3.g.solidcraftdock" in snap.local) && !("h3.theme" in snap.local) && !("ag.scope" in snap.local), snap.local);
// maximized: the others closed; the user opened the console meanwhile
const now = [{ id: "promptdock", shown: false, collapsed: false }, { id: "musicdock", shown: false, collapsed: true }, { id: "consoledock", shown: true, collapsed: false }];
const plan = DF.restorePlan(snap, now);
const P = (id) => plan.find((p) => p.id === id);
check("the restore: the closed ones open again (folded as they were, their size back); one opened since is closed again", P("promptdock").show && P("promptdock").foldTo === false && P("promptdock").style === "height: 300px" && P("musicdock").show && P("musicdock").foldTo === true && P("consoledock").hide && !P("consoledock").show, plan);
check("…a docker already as it was is left alone", DF.restorePlan(snap, [{ id: "promptdock", shown: true, collapsed: false }]).find((p) => p.id === "promptdock").show === false);
const JS = read("static/dockfull.js"), IX = read("static/index.html"), SC = read("ext/solidcraftdock/scdock.js");
check("maximized = fixed between the title bar and the status bar (both stay), over everything", /\.bdock\.dockfull\.maxed\{position:fixed!important;left:0!important;right:0!important;top:var\(--df-top,0px\)!important;bottom:var\(--df-bottom,0px\)!important/.test(JS) && /function top\(\)/.test(JS) && /function bottom\(\)/.test(JS));
check("it follows the app's ⛶ / 🗗 / Esc (the maxed class) - closes the others through toggleDockGone, keeps the layout in h3.dockfull.<id> until the restore (a reload while maximized too)", /attributeFilter: \["class"\]/.test(JS) && /root\.toggleDockGone\(d\.id, d\.btn\)/.test(JS) && /"h3\.dockfull\." \+ id/.test(JS) && /toggleCollapse\(p\.id\)/.test(JS));
check("loaded by index.html; the SolidCraft docker attaches it (waits for it)", /<script src="\/static\/dockfull\.js"><\/script>/.test(IX) && /H3DockFull\.attach\("solidcraftdock"/.test(SC));
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
