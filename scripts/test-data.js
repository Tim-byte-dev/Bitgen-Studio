#!/usr/bin/env node
/* bitGen Studio — 2.511.0 unit tests: ✒ VARIABLE MASK FEATHER (tlmask.js), 📋 DATA-DRIVEN ANIMATION + TEMPLATE FIELDS
 * (tldata.js, static/mogrt.js, tlexpr.js data(), canvas.js {{set.column}}).
 * Tim: "lets do steps 1,2,3 , 4,5,6 and 7" (step 5: variable mask feather; step 6: data-driven animation from CSV /
 * JSON, plus exposed template fields). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const D = require(path.join(ROOT, "ext", "timelinedock", "tldata.js"));
const MK = require(path.join(ROOT, "ext", "timelinedock", "tlmask.js"));
const X = require(path.join(ROOT, "ext", "timelinedock", "tlexpr.js"));
const MG = require(path.join(ROOT, "static", "mogrt.js"));

/* ---- variable feather */
const P = [MK.pt(0.2, 0.2), MK.pt(0.8, 0.2), MK.pt(0.8, 0.8), MK.pt(0.2, 0.8)];
P[1].fe = 40;
const m = { feather: 4, pts: P };
check("fes / isVar: a point's own feather, else the mask's; variable once any point has one", JSON.stringify(MK.fes(m, P)) === "[4,40,4,4]" && MK.isVar(m, P) && !MK.isVar(m, P.map((q) => Object.assign({}, q, { fe: undefined }))), MK.fes(m, P));
const E = MK.edgeSamples(P, 100, 100, MK.fes(m, P), 10);
check("edgeSamples: along the edge, each piece's feather gliding between its two points'", E.length === 40 && E[0][2] === 4 && E[10][2] === 40 && Math.abs(E[5][2] - 22) < 1e-9 && Math.abs(E[5][0] - 50) < 1e-6 && Math.abs(E[5][1] - 20) < 1e-6, [E[0], E[5], E[10]]);
const G = MK.featherGrid(E, 100, 100, 5);
check("featherGrid: each place takes the feather of the nearest edge (top-right corner soft, bottom-left sharp)", G.f[Math.round(20 / 5) * G.gw + Math.round(80 / 5)] === 40 && G.f[Math.round(80 / 5) * G.gw + Math.round(20 / 5)] === 4, [G.gw, G.gh]);
const L = MK.levelsOf(4, 40, 4), b1 = MK.blendAt(16, L), b2 = MK.blendAt(1, L), b3 = MK.blendAt(99, L);
check("levels / blendAt: a feather between two blur levels = the share of each", L.length === 4 && L[3] === 40 && Math.abs(L[b1[0]] + (L[Math.min(3, b1[0] + 1)] - L[b1[0]]) * b1[1] - 16) < 1e-9 && b2[0] === 0 && b3[0] === 3 && MK.blendAt(22, L)[0] === 1 && Math.abs(MK.blendAt(22, L)[1] - 0.5) < 1e-9, [L, b1]);
const A = P.map((q) => Object.assign({}, q)), B = P.map((q) => Object.assign({}, q)); B[1].fe = 80; delete A[2].fe; B[2].fe = 20;
const mid = MK.lerpPts(A, B, 0.5);
check("animated mask keys: a point's feather glides between keys (one key without it takes the other's)", mid[1].fe === 60 && mid[2].fe === 20 && mid[0].fe === undefined, mid.map((q) => q.fe));

/* ---- data */
const csv = D.parseCSV('name,value,"note, with comma"\r\nNorth,12,"say ""hi"""\nSouth,7.5,\n\nEast,"1,200",x\n');
check("parseCSV: the first line = the columns; quotes, \"\" inside, commas in quotes, CRLF, blank lines skipped",
  csv.cols.join("|") === "name|value|note, with comma" && csv.rows.length === 3 && csv.rows[0][2] === 'say "hi"' && csv.rows[2][1] === "1,200", csv);
check("parseCSV: semicolons / tabs found by themselves", D.parseCSV("a;b\n1;2").cols.length === 2 && D.parseCSV("a\tb\n1\t2").rows[0][1] === "2");
const j1 = D.parseJSON('[{"city":"Perth","t":31},{"city":"Hobart","t":17,"rain":true}]'), j2 = D.parseJSON('{"rows":[{"a":1}]}'), j3 = D.parseJSON('{"x":[1,2,3],"y":[4,5,6]}');
check("parseJSON: a list of records (the columns gathered), {key: [records]}, {column: [values]}", j1.cols.join() === "city,t,rain" && j1.rows[1][2] === "true" && j1.rows[0][2] === "" && j2.rows[0][0] === "1" && j3.rows.length === 3 && j3.rows[2][1] === "6", [j1, j2, j3]);
const S = { sales: Object.assign(D.fromText("sales.csv", "region,amount\nNorth,10\nSouth,25\nWest,40"), {}) };
check("fromText: the set named from the file, row 1 current", S.sales.name === "sales" && S.sales.row === 1 && S.sales.rows.length === 3);
check("value: by column name or number, the current row or a given one (clamped)", D.value(S, "sales", "amount") === "10" && D.value(S, "sales", "2", 3) === "40" && D.value(S, "sales", "amount", 99) === "40" && D.value(S, "nope", "a") === null && D.value(S, "sales", "zz") === null);
S.sales.row = 2;
check("fill: {{set.column}} = the current row, {{set.column.3}} = row 3, unknown left as written", D.fill("{{sales.region}}: {{ sales.amount }} (then {{sales.amount.3}}) {{x.y}}", S) === "South: 25 (then 40) {{x.y}}");
const K = D.columnKeys(S.sales, "amount", { spr: 0.5, mul: 2, add: 1 });
check("columnKeys: one key a row every s per row, x factor + offset; non-numbers skipped; a range of rows", JSON.stringify(K) === "[[0,21],[0.5,51],[1,81]]" && D.columnKeys(S.sales, "amount", { from: 2, to: 3 }).length === 2 && D.columnKeys(S.sales, "region", {}).length === 0, K);
const ev = X.evaluate('data("sales", "amount", floor(t) + 1) * 2', { time: 1.5, start: 0, value: 0, data: (s, c, r) => D.numOf(D.value(S, s, c, r)) });
check("ƒx data(set, column, row): a number from the data (row 2 at 1.5 s here -> 25 x 2)", ev.ok && ev.v === 50, ev);
check("ƒx presets still all parse (+ a data one)", X.PRESETS.every((p) => X.compile(p[0]).ok) && X.PRESETS.some((p) => /data\(/.test(p[0])));

/* ---- template fields */
const layers = [{ name: "Title", text: true, clips: [{ start: 2, len: 3, text: { content: "Hello", color: "#ff0000", size: 60 }, tf: { x: 10, y: 20, scale: 1, rot: 0 }, expose: { color: "Title colour", y: "Height", bogus: "x" } }] },
                { name: "Logo", clips: [{ start: 2, len: 3, name: "logo.png", opacity: 0.8, tf: { x: -100, y: 0, scale: 0.5, rot: 0 }, kf: [{ at: 0, x: -100 }, { at: 1, x: 100 }], expose: { op: "Logo opacity", x: "Logo x", color: "no" } }] }];
const tpl = MG.capture(layers, { name: "T", w: 1920, h: 1080 }), F = MG.fields(tpl);
check("template capture: exposed properties kept (unknown ones / a picture's colour dropped); they become typed fields",
  JSON.stringify(tpl.layers[0].clips[0].expose) === '{"color":"Title colour","y":"Height"}' && JSON.stringify(tpl.layers[1].clips[0].expose) === '{"op":"Logo opacity","x":"Logo x"}'
  && F.length === 5 && F.some((f) => f.key === "L0C0:color" && f.type === "color" && f.value === "#ff0000") && F.some((f) => f.key === "L1C0:op" && f.type === "num" && f.value === 0.8), F);
const out = MG.instantiate(tpl, { at: 0, w: 1920, h: 1080, values: { "L0C0": "Hi", "L0C0:color": "#00ff00", "L0C0:y": 50, "L1C0:op": 0.3, "L1C0:x": 0 } });
check("instantiate: the values set the exposed properties - a colour, a position, an opacity; a KEYED x moves its keys by the change",
  out[0].clips[0].text.content === "Hi" && out[0].clips[0].text.color === "#00ff00" && out[0].clips[0].tf.y === 50 && out[1].clips[0].opacity === 0.3 && out[1].clips[0].tf.x === 0 && out[1].clips[0].kf[0].x === 0 && out[1].clips[0].kf[1].x === 200, out[1].clips[0]);

/* ---- wiring */
const CV = read("ext", "timelinedock", "canvas.js"), TD = read("ext", "timelinedock", "tldata.js"), TM = read("ext", "timelinedock", "tlmask.js"), TE = read("ext", "timelinedock", "tlexpr.js"), MJ = read("ext", "timelinedock", "mogrt.js");
check("canvas: {{set.column}} filled before a text is drawn (plain and preset) - the compile's text pictures carry it",
  /function filled\(t\)/.test(CV) && /function renderText\(t\) \{\n    t = filled\(t\);/.test(CV) && /function fxSpec\(t\) \{\n    t = filled\(t\);/.test(CV));
check("the page: 📋 Data & fields (import CSV / JSON, the row, 📋 Data → keys, 📋 Template fields + the timeline's exposed fields), ƒx data(), the 🧩 dialog's typed fields",
  /id="tlpDtFile"/.test(TD) && /data-dtrow=/.test(TD) && /id="tlpDtGo"/.test(TD) && /id="tlpTfAdd"/.test(TD) && /data-tfv=/.test(TD) && /data: dataVal/.test(TE) && /f\.type === "color" \? 'type="color"'/.test(MJ));
check("the Mask Pen: Shift+drag a point = its feather (a ring shows it); masks blur by each pixel's nearest feather", /ev\.shiftKey \? "fe"/.test(TM) && /function varFeather\(src, m, P, W, H, px\)/.test(TM) && /data-mkfe=/.test(TM));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tldata.js after tl3d.js", EXT.indexOf("tldata.js") > EXT.indexOf("tl3d.js") && EXT.indexOf("tl3d.js") > 0);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
