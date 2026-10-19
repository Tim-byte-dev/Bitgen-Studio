/* bitGen Studio — 2.493.0: TEXT ANIMATORS (ext/timelinedock/tltextanim.js) - After Effects gap item 5. The selection maths
 * (letters / words / lines, the range shapes, several animators on one letter) and the presets are pure. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, ".."), T = require(path.join(ROOT, "ext", "timelinedock", "tltextanim.js"));
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); if (got !== undefined) console.log("      got " + JSON.stringify(got).slice(0, 400)); } }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-9);
const A = (o) => Object.assign({}, T.DEFAULTS, o);

{
  const c = T.units("ab c\nde", "chars"), w = T.units("ab c\nde", "words"), l = T.units("ab c\nde", "lines");
  check("units: letters (a space is a letter, a line break is not), words (spaces belong to none), lines", c.idx.join() === "0,1,2,3,-1,4,5" && c.n === 6 && w.idx.join() === "0,0,-1,1,-1,2,2" && w.n === 3 && l.idx.join() === "0,0,0,0,-1,1,1" && l.n === 2);
  const sq = [0, 1, 2, 3].map((k) => T.weight(k, 4, A({ start: 0, end: 50 }))), part = T.weight(1, 4, A({ start: 0, end: 37.5 }));
  check("square: the letters inside the range fully, the edge letter partly (a smooth typewriter)", sq.join() === "1,1,0,0" && near(part, 0.5), [sq, part]);
  const up = [0, 1, 2, 3].map((k) => T.weight(k, 4, A({ shape: "rampup" }))), down = [0, 1, 2, 3].map((k) => T.weight(k, 4, A({ shape: "rampdown" }))), tri = [0, 1, 2, 3, 4].map((k) => T.weight(k, 5, A({ shape: "triangle" })));
  check("ramp up / ramp down / triangle", up[0] < up[1] && up[2] < up[3] && down[0] > down[3] && near(tri[2], 1) && near(tri[0], tri[4]) && tri[1] > tri[0], { up, down, tri });
  const off = [0, 1, 2, 3].map((k) => T.weight(k, 4, A({ start: 0, end: 25, offset: 50 })));
  check("offset moves the range along (0-25 % shifted by 50 % = the third letter)", off.join() === "0,0,1,0", off);
  check("amount scales the selection (50 % = half), nothing when start = end", near(T.weight(0, 4, A({ amount: 50 })), 0.5) && T.weight(0, 4, A({ start: 30, end: 30 })) === 0);
  const cmb = T.combine([[A({ op: 0, y: 40 }), 0.5], [A({ scale: 50, x: 10 }), 1], [A({ colorOn: true, color: "#00ff00" }), 0.25]]);
  check("combine: offsets add, scale and opacity multiply, the colour with its weight", near(cmb.y, 20) && near(cmb.x, 10) && near(cmb.scale, 0.5) && near(cmb.op, 0.5) && cmb.color === "#00ff00" && near(cmb.cw, 0.25), cmb);
  const P = T.PRESETS(4);
  check("presets: typewriter (opacity 0, the start keyed 0 -> 100 % over 2 s), fade up, pop in, slide in (words), wave, blur in", P.typewriter.a.op === 0 && P.typewriter.keys[0][0] === "start" && P.typewriter.keys[0][1][1][0] === 2 && P.typewriter.keys[0][1][1][1] === 100 && P.slidein.a.based === "words" && Object.keys(P).length === 6);
}
{
  const cv = read("ext/timelinedock/canvas.js"), tp = read("ext/timelinedock/tlparent.js"), tlx = read("ext/timelinedock/timelinedock.js"), g = read("ext/timelinedock/tlgraph.js"), ext = JSON.parse(read("ext/timelinedock/ext.json")).scripts, src = read("ext/timelinedock/tltextanim.js");
  check("the wiring: the canvas draws an animated text letter by letter; it is baked for the compile; the Graph Editor knows its keys", /TlTextAnim\.live\(c\)/.test(cv) && /x\.c\.shape \|\| anim\(x\.c\)/.test(tp) && /c\.text && \(?\(?c\.text\.anim && c\.text\.anim\.length/.test(tlx) && /\^ta\(\\d\+\)_/.test(g) && ext.indexOf("tltextanim.js") > ext.indexOf("tlshape.js"));
  check("no product names", !/After Effects|Adobe/.test(src.replace(/^\s*\*.*$/gm, "")));
}
{
  // every timeline script parses (a broken line stops the whole file - 2.493.0's compile button once lost its handler)
  const vm = require("vm"), dir = path.join(ROOT, "ext", "timelinedock"), bad = [];
  fs.readdirSync(dir).filter((f) => f.endsWith(".js")).forEach((f) => { try { new vm.Script(fs.readFileSync(path.join(dir, f), "utf8"), { filename: f }); } catch (e) { bad.push(f + ": " + e.message); } });
  check("every timeline script parses", bad.length === 0, bad);
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
