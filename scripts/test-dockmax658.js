#!/usr/bin/env node
/* bitGen Studio — 2.658.0: ⛶ MAXIMIZE THAT KNOWS WHERE THE DOCKER IS (static/dockmax.js) + the Sketcher's own height in the
 * column (--pph, its bottom handle) - pure parts + the wiring. The clicks: scripts/test-ui658-ui.js.
 * Tim (verbatim): "allow sketcher to be resized vertically when docked. when mamimize button is pressed in docked mode expand
 * to fill empty space dockers that are docked below will be pushed downwards. when maximazi is pressed when it is floating
 * then maximize normally and close other dockers. do the same for timeline and image editor" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 400))); } };
const M = require(path.join(ROOT, "static/dockmax.js"));
check("the three dockers: the Sketcher, the timeline, the image editor", M.IDS.join() === "pushpulldock,timelinedock,imageeditdock");
check("modeFor: in the main column = push (grow, the ones below pushed down), anywhere else = full (the whole window)", M.modeFor(true) === "push" && M.modeFor(false) === "full");
check("pushHeight: the column's height less its padding, 120 at least", M.pushHeight(900, 4, 10) === 886 && M.pushHeight(50, 0, 0) === 120);
const H = read("static/index.html"), J = read("static/dockmax.js"), F = read("static/dockfull.js"), D = read("ext/pushpulldock/dock.html"), PF = read("ext/pushpulldock/ppframe.js");
check("the Sketcher has a height of its own in the column (--pph, remembered) and its bottom handle", /pushpulldock: "pph"/.test(H) && /--pph: 460px/.test(H) && /#pushpulldock \{ height: var\(--pph\); \}/.test(H) && /"cfh", "pph"\]\) \{/.test(H) && /<div class="hsplit" data-hresize="pph"><\/div>/.test(D));
check("the column's reflow leaves a pushed column alone; dockmax.js loads after dockfull.js", /if \(col\.classList\.contains\("dm-push"\)\) return;/.test(H) && H.indexOf("/static/dockmax.js") > H.indexOf("/static/dockfull.js"));
check("dockmax wraps the page's toggleMax: the mode picked first (data-dm-mode), the column pushed (--dm-h, the StoryBoard's height kept), scrolled to the docker",
  /root\.toggleMax = wrapped/.test(J) && /el\.dataset\.dmMode = modeFor\(inColumn\(el\)\)/.test(J) && /col\.classList\.add\("dm-push"\)/.test(J) && /--dm-vh/.test(J) && /scrollIntoView\(\{ block: "start" \}\)/.test(J));
check("floating: the timeline / image editor through dockfull.js only when engaged (the others closed, back after)", /H3DockFull\.attach\(id, \{ engage: function \(d\) \{ return d\.dataset\.dmMode === "full"; \} \}\)/.test(J) && /engaged = !!o\.engage\(dock\)/.test(F) && /if \(!o\.engage\) dock\.classList\.add\("dockfull"\)/.test(F));
check("the Sketcher: fixed over the window only when not pushed; the others closed only for the whole-window maximize", /#pushpulldock\.maxed:not\(\[data-dm-mode=push\]\)/.test(D) && /const full = maxed\(\) && dock\.dataset\.dmMode !== "push";/.test(PF) && /if \(full\) closeOthers\(\)/.test(PF));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
