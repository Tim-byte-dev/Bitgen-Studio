// scripts/test-actionsx.js — 2.468.0: MORE ACTIONS (ext/imageeditdock/pcactionsx.js + pcactions.js): recorded brush
// strokes and hand-made selections, conditional steps, Image Processor, droplets - the pure part + the wiring.
// Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
"use strict";
const fs = require("fs"), path = require("path");
const X = require("../ext/imageeditdock/pcactionsx.js");
const A = require("../ext/imageeditdock/pcactions.js");
const ROOT = path.join(__dirname, "..");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra).slice(0, 500))); if (!ok) fail++; };

check("rel / abs: points as 0..1 of the picture and back", JSON.stringify(X.rel([[50, 25], [100, 50]], 200, 100)) === "[[0.25,0.25],[0.5,0.5]]" && JSON.stringify(X.abs([[0.25, 0.5]], 400, 200)) === "[[100,100]]");
const th = X.thin([[0, 0], [0.2, 0], [0.5, 0], [1.4, 0], [3, 0], [3.1, 0]], 1, 0);
check("thin: points closer than the step dropped, the first and last kept", JSON.stringify(th) === "[[0,0],[1.4,0],[3,0],[3.1,0]]", th);
check("thin: at most max points", X.thin(Array.from({ length: 1000 }, (_, i) => [i * 2, 0]), 1, 100).length === 100);
const f = { w: 800, h: 600, sel: false, type: "text", layers: 3 };
check("condOf: landscape / portrait / square / selection / layer kind / several layers", X.condOf("landscape", f) && !X.condOf("portrait", f) && !X.condOf("square", f) && X.condOf("nosel", f) && !X.condOf("sel", f) && X.condOf("text", f) && !X.condOf("pixel", f) && X.condOf("many", f) && X.condOf("square", { w: 5, h: 5 }) && X.CONDS.length === 10);
const p = { subs: [{ closed: true, op: "add", pts: [{ x: 100, y: 50, ix: 100, iy: 50, ox: 120, oy: 50 }] }] };
const n = X.normPath(p, 200, 100), b = X.scalePath(n, 400, 200);
check("normPath / scalePath: a selection's outline 0..1 and onto another picture size", n.subs[0].pts[0].x === 0.5 && n.subs[0].pts[0].ox === 0.6 && b.subs[0].pts[0].x === 200 && b.subs[0].pts[0].oy === 100);
check("fitSize: fitted inside W x H, never enlarged", JSON.stringify(X.fitSize(4000, 3000, 1920, 1080)) === "[1440,1080]" && JSON.stringify(X.fitSize(800, 600, 1920, 1080)) === "[800,600]" && JSON.stringify(X.fitSize(1000, 500, 0, 0)) === "[1000,500]");
const sets = A.normalize([{ name: "S", actions: [{ name: "a", steps: [{ kind: "stroke", tool: "paint", pts: [[0, 0], [1, 1]], size: 12, fg: "#ff0000" }, { kind: "sel", path: { subs: [] } }, { kind: "sel", path: p, how: "lasso" }, { kind: "cond", test: "landscape", then: ["S", "b"] }, { kind: "bogus" }] }] }]);
const st = sets[0].actions[0].steps;
check("pcactions keeps the new step kinds (and still drops unknown ones)", st.length === 4 && st.map((x) => x.kind).join() === "stroke,sel,sel,cond");
check("stepLabel / summary for them", A.stepLabel(st[0]) === "Brush Stroke" && A.stepLabel(st[1]) === "Deselect" && A.stepLabel(st[2]) === "Set Selection" && A.stepLabel(st[3]) === "Conditional" && /2 points, 12 px, #ff0000/.test(A.summary(st[0])) && /lasso/.test(A.summary(st[2])) && /if landscape: S ▸ b/.test(A.summary(st[3])));

const ext = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/imageeditdock/ext.json"), "utf8")).scripts;
const IE = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/imageedit.js"), "utf8"), AC = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcactions.js"), "utf8"), AX = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcactionsx.js"), "utf8");
check("wiring: pcactionsx.js after pccomps.js, installed after PCActions; imageedit's push tells E.onPush", ext.indexOf("pcactionsx.js") === ext.indexOf("pccomps.js") + 1 && IE.indexOf("PCActionsX.install(E)") > IE.indexOf("PCActions.install(E)") && /if \(E\.onPush\) \{ try \{ E\.onPush\(e\);/.test(IE));
check("wiring: pcactions' step kinds (KINDS), the panel hooks, record / inCmd / dialogsOpen / insert / find; the ☰ menu has Insert Conditional, Image Processor, Create Droplet", /if \(KINDS\[st\.kind\]\) \{ await KINDS\[st\.kind\]\(st\); return; \}/.test(AC) && /for \(const f of panelHooks\)/.test(AC) && /record: \(st\) =>/.test(AC) && /"act\.cond", "act\.load"/.test(AC) && /"act\.processor", "act\.droplet"\]/.test(AC));
check("wiring: strokes recorded from the stage's pointer events (capture), selections from E.onPush, the three kinds played, the commands", /stage\.addEventListener\("pointerdown", \(e\) => \{\s*if \(!A\.recording\(\)/.test(AX) && /E\.onPush = \(entry\) =>/.test(AX) && /A\.addKind\("stroke"/.test(AX) && /A\.addKind\("sel"/.test(AX) && /A\.addKind\("cond"/.test(AX) && /C\("act\.processor", "Scripts: Image Processor…"/.test(AX) && /C\("act\.droplet", "Automate: Create Droplet…"/.test(AX));
console.log(fail ? `\n${fail} FAILED` : "\nall actions extra checks passed");
process.exit(fail ? 1 : 0);
