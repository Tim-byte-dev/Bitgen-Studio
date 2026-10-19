#!/usr/bin/env node
/* bitGen Studio — 2.497.0 units: EXPRESSIONS (ext/timelinedock/tlexpr.js - the language, the built-ins, the wiring into
 * canvas.js tfAt / opac, TlShape.at, TlTextAnim, the compile's sampled keys).
 * Tim (verbatim): "... and the rest of the After Effects gap list (expressions, Bézier masks, tracking and so on).." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, got) => { if (ok) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const X = require(path.join(ROOT, "ext", "timelinedock", "tlexpr.js"));
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-9 : e);
const ev = (src, o) => X.evaluate(src, Object.assign({ time: 1, value: 10, fps: 24, start: 0 }, o || {}));
const V = (src, o) => ev(src, o).v;

check("numbers, + - * / % **, precedence, brackets, unary minus", V("1 + 2 * 3") === 7 && V("(1 + 2) * 3") === 9 && V("2 ** 3 ** 2") === 512 && V("-2 ** 2") === -4 && V("7 % 4") === 3 && V("10 / 4") === 2.5 && V("1e2 + .5") === 100.5);
check("comparisons, && || !, a ? b : c", V("3 > 2 ? 1 : 0") === 1 && V("2 >= 3 || 4 == 4") === 1 && V("!(1 && 0)") === 1 && V("0 ? 5 : 1 ? 6 : 7") === 6);
check("value, time, t, frame, fps, inPoint, PI", V("value") === 10 && V("time") === 1 && V("t", { start: 0.25 }) === 0.75 && V("frame") === 24 && V("fps") === 24 && V("inPoint", { start: 2 }) === 2 && near(V("PI"), Math.PI));
check("several lines / ; with var - the last line is the answer; // comments", V("var a = 3\nlet b = a * 2 // six\na + b") === 9 && V("x = 4; x * x") === 16);
check("Math.sin and friends (Math. is allowed), degreesToRadians, round(v, places), clamp, posterize", near(V("Math.sin(PI / 2)"), 1) && near(V("cos(degreesToRadians(180))"), -1) && V("round(3.14159, 2)") === 3.14 && V("clamp(12, 0, 10)") === 10 && V("posterize(23, 10)") === 20);
check("linear / ease (5 and 3 arguments)", V("linear(1, 0, 2, 0, 100)") === 50 && V("linear(5, 0, 2, 0, 100)") === 100 && V("ease(0.5, 0, 1, 0, 100)") === 50 && V("linear(0.25, 0, 8)") === 2 && V("easeIn(0.5, 0, 1, 0, 1)") === 0.25);
const w1 = V("wiggle(2, 30)", { seed: "a:x" }), w2 = V("wiggle(2, 30)", { seed: "a:x" }), w3 = V("wiggle(2, 30)", { seed: "b:x" });
const ws = []; for (let k = 0; k < 200; k++) ws.push(V("wiggle(3, 30)", { time: k / 24, seed: "q" }) - 10);
check("wiggle(freq, amount): the same every time (seeded by the layer + property), another layer wiggles differently, stays within the amount, moves smoothly", w1 === w2 && w1 !== w3 && ws.every((d) => Math.abs(d) <= 30) && Math.max(...ws) > 10 && Math.min(...ws) < -10
  && ws.every((d, i) => !i || Math.abs(d - ws[i - 1]) < 12));
const r1 = V("random(0, 100)", { seed: "s" }), r2 = V("random(0, 100)", { seed: "s" }), r3 = V("random(0, 100)", { seed: "s", time: 1 + 1 / 24 });
check("random(min, max): the same for the same frame, new the next frame, in range", r1 === r2 && r1 !== r3 && r1 >= 0 && r1 < 100 && V("random()", { seed: "z" }) < 1);
// loops over keys at 0 s (0) and 1 s (100) - valueAt = a straight line between them
const keys = [[0, 0], [1, 100]], vAt = (tt) => Math.max(0, Math.min(1, tt)) * 100;
const L = (src, time) => V(src, { time, keys, valueAt: vAt, value: vAt(time) });
check("loopOut(): cycle (1.25 s = 25), pingpong (1.25 s = 75), offset (1.25 s = 125), continue (1.25 s = 125); inside the keys = value",
  near(L("loopOut()", 1.25), 25, 1e-6) && near(L("loopOut(\"pingpong\")", 1.25), 75, 1e-6) && near(L("loopOut(\"offset\")", 1.25), 125, 1e-6) && near(L("loopOut(\"continue\")", 1.25), 125, 1e-6) && L("loopOut()", 0.5) === 50
  && near(L("loopOut()", 3.5), 50, 1e-6) && near(L("loopOut(\"pingpong\")", 2.25), 25, 1e-6), [L("loopOut()", 1.25), L("loopOut(\"pingpong\")", 1.25), L("loopOut(\"offset\")", 1.25), L("loopOut(\"continue\")", 1.25)]);
const keys2 = [[1, 0], [2, 100]], vAt2 = (tt) => Math.max(0, Math.min(1, tt - 1)) * 100;
check("loopIn(): before the first key it cycles back (0.75 s = 75); offset = -25", near(V("loopIn()", { time: 0.75, keys: keys2, valueAt: vAt2, value: 0 }), 75, 1e-6) && near(V("loopIn(\"offset\")", { time: 0.75, keys: keys2, valueAt: vAt2, value: 0 }), -25, 1e-6));
check("valueAtTime(t) + a delay: another moment's value", V("valueAtTime(time - 0.5)", { keys, valueAt: vAt }) === 50);
check("layer(name, prop[, time]): another layer's value (a link)", V("layer(\"Null 1\", \"x\") * 2", { layer: (n, p, tt) => (n === "Null 1" && p === "x" ? 21 + tt : NaN) }) === 44);
check("arrays like AE's: [a, b] + [c, d] (the first is used)", V("[1, 2] + [10, 20]") === 11 && V("[5, 6][1]") === 6);
// safety
const bad = ["window", "constructor", "toString()", "valueOf()", "hasOwnProperty(\"x\")", "this.x", "eval(\"1\")", "Function(\"return 1\")()", "process.exit()", "require(\"fs\")", "__proto__", "alert(1)"];
check("NOT JavaScript: window, constructor, eval, Function, process, require, __proto__ … are unknown names (no answer)", bad.every((s) => !ev(s).ok), bad.map((s) => ev(s).err));
check("mistakes are said: a missing bracket, a stray character, an unknown function, a non-number", /expected/.test(ev("(1 + 2").err) && /read/.test(ev("1 # 2").err) && /function "nope"/.test(ev("nope(1)").err) && /not a number/.test(ev("\"abc\"").err) && /not a number/.test(ev("1 / 0").err));
check("compile caches; an empty expression is an error", X.compile("1+1") === X.compile("1+1") && !X.compile("").ok);
check("presets all parse; the properties offered", X.PRESETS.every((p) => X.compile(p[0]).ok) && X.PROPS.map((p) => p[0]).join() === "x,y,scale,rot,op,ax,ay");
// wiring
const CV = read("ext", "timelinedock", "canvas.js"), TP = read("ext", "timelinedock", "tlparent.js"), TD = read("ext", "timelinedock", "timelinedock.js"), TS = read("ext", "timelinedock", "tlshape.js"), TT = read("ext", "timelinedock", "tltextanim.js"), XE = read("ext", "timelinedock", "tlexpr.js");
check("canvas: tfAt and the drawn opacity go through TlExpr (the preview)", /return c\.expr && window\.TlExpr && TlExpr\.tf \? TlExpr\.tf\(c, tau, o\) : o;/.test(CV) && /if \(c\.expr && c\.expr\.op && window\.TlExpr && TlExpr\.num\) o = TlExpr\.num\(c, "op"/.test(CV));
check("the compile: a layer an expression moves sends sampled keys (tlTfKf for video AND picture / text layers; worldKeys samples opacity too); a bake signature includes the expressions",
  /function tlTfKf\(c, kind\) \{ return \(c\.parent \|\| \(window\.TlExpr && TlExpr\.moves && TlExpr\.moves\(c\)\)\)/.test(TD) && /\.\.\.tlTfKf\(c, "img"\), text:/.test(TD) && /var opx = !!\(c\.expr && c\.expr\.op/.test(TP) && /chain\.push\(\{ (?:[a-z0-9]+: p\.[a-z0-9]+ \|\| null, )*expr: p\.expr \|\| null/.test(TP));
check("shapes and text animators / text on a path apply expressions on their numbers (sh_ / ta<n>_ / tp_)", /c\.expr\["sh_" \+ k\]/.test(TS) && /var p = "ta" \+ n \+ "_" \+ k; if \(c\.expr\[p\]\)/.test(TT) && /c\.expr\["tp_" \+ k\]/.test(TT));
check("the ƒx Expressions section: the property list, presets, ＋ ƒx, a live check of each one, ✕", /id="tlpExAdd"/.test(XE) && /data-ex="/.test(XE) && /data-exx="/.test(XE) && /data-exe="/.test(XE));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tlexpr.js loads after tltextanim.js", EXT.indexOf("tlexpr.js") === EXT.indexOf("tltextanim.js") + 1);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
