#!/usr/bin/env node
/* bitGen Studio — 2.561.0 units: a ▣ docker dropped between two columns becomes a column of its own (static/dgdock.js
 * template / seamsOf / seamAt / placeCol / leaveCol, static/dockgroup.js).
 * Tim: "new docker docks, but allow it to also dock between vertical dockers so it becomes a new vertical docker". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const D = require(path.join(ROOT, "static", "dgdock.js"));
const IX = rd("static", "index.html");

// the stylesheet's own template, rebuilt from the children = the same string
const own = IX.match(/grid-template-columns: (var\(--c1\)[^;]+);/)[1];
const base = [{ kind: "col", id: "ldock" }, { kind: "split", key: "ldock" }, { kind: "other", hidden: true }, { kind: "col", id: "refsdock" }, { kind: "split", key: "refs" },
  { kind: "col", id: "assetsdock" }, { kind: "split", key: "assets" }, { kind: "col", id: "maincol" }, { kind: "split", key: "qdock" }, { kind: "col", id: "qdock" }, { kind: "split", key: "rdock" }, { kind: "col", id: "rdock" }];
check("template: #app's children in order -> the stylesheet's own grid (its vars - no-left / no-refs … still work); a hidden child takes no track", D.template(base) === own, { mine: D.template(base), own });
const withCol = base.slice(0, 5).concat([{ kind: "dgcol", w: 420 }, { kind: "dgsplit" }], base.slice(5));
check("...a ▣ column between References and Assets: its width + a 5 px splitter at that place", D.template(withCol) === own.replace("var(--s2) var(--c3)", "var(--s2) 420px 5px var(--c3)"), D.template(withCol));
check("...folded (34 px at least), hidden (none), a stand-in for a side docker out (dgph_) = that docker's var",
  D.template([{ kind: "dgcol", w: 10 }, { kind: "dgcol", w: 300, hidden: true }, { kind: "dgsplit", hidden: true }, { kind: "col", id: "refsdock" }]) === "34px var(--c2)");
const cols = [{ id: "ldock", l: 0, r: 300, name: "Settings" }, { id: "refsdock", l: 305, r: 565, name: "References" }, { id: "assetsdock", l: 570, r: 830, name: "Assets" }, { id: "maincol", l: 835, r: 1400, name: "the main column" }, { id: "dgph_qdock", l: 1400, r: 1400, name: "" }];
const S = D.seamsOf(cols);
check("seamsOf: the window's left edge, between each two columns (the middle of the gap), the right edge; a 0-wide stand-in is no column",
  S.length === 5 && S[0].x === 0 && S[0].before === "ldock" && S[1].x === 303 && S[1].before === "refsdock" && S[2].before === "assetsdock" && S[2].a === "References" && S[2].b === "Assets" && S[3].before === "maincol" && S[4].before === "" && S[4].x === 1400, S);
check("seamAt: the nearest seam within 14 px, else none (a docker's own edge zone stays beside-it)",
  D.seamAt(560, S, 14).before === "assetsdock" && D.seamAt(580, S, 14).before === "assetsdock" && D.seamAt(590, S, 14) === null && D.seamAt(1395, S).before === "");
check("seamLabel: between two / at the left / at the right",
  D.seamLabel("Docker", S[2]) === "New column: Docker between References and Assets" && /at the left, before Settings/.test(D.seamLabel("Docker", S[0])) && /at the right, after the main column/.test(D.seamLabel("Docker", S[4])));
check("wants: a column place {mode col, before <id> | \"\"} too; a bad id no",
  D.wants({ mode: "col", before: "assetsdock" }) && D.wants({ mode: "col", before: "" }) && D.wants({ mode: "col" }) && !D.wants({ mode: "col", before: "9x" }) && D.wants({ mode: "dock", to: "previewdock", side: "top" }));

const DD = rd("static", "dgdock.js"), DG = rd("static", "dockgroup.js");
check("placeCol: left of the main column = the column then its splitter, right of it = the splitter first (before Queue's own splitter); kept {mode col, before, dw}",
  /if \(right\) \{ let ref = B; if \(B && B\.previousElementSibling && B\.previousElementSibling\.matches\("\.vsplit, \.dgc-split"\)\) ref = B\.previousElementSibling;/.test(DD)
  && /else \{ app\.insertBefore\(d, B\); app\.insertBefore\(sp, B\); \}/.test(DD) && /dock: s\.mode === "col" \? \{ mode: "col", before: s\.before \|\| "", dw: Math\.round\(s\.dw \|\| 340\) \}/.test(DD));
check("the drag: a seam (8 px - the splitter itself) before a docker's edge zone; its splitter sizes it 160 - 900 px; #app's grid rebuilt (and given back when no ▣ column is left)",
  DD.indexOf("seamAt(m.clientX, seamsNow(r.win), 8)") > 0 && DD.indexOf("seamAt(m.clientX, seamsNow(r.win), 14)") < DD.indexOf("if (!into && !z) z = pickZone(") && /Math\.max\(160, Math\.min\(900,/.test(DD)
  && /app\.style\.gridTemplateColumns = "";/.test(DD) && /G\(\)\.makePerm\(id, false, \{ mode: "col", before: z\.before \}\)/.test(DD));
check("dockgroup: unPerm / remove take the column's splitter away (gone); a column made a main-column docker again leaves the grid first",
  (DG.match(/if \(root\.H3DGDock && root\.H3DGDock\.gone\) root\.H3DGDock\.gone\(id\);/g) || []).length === 2 && /d\.classList\.contains\("dg-col"\)\) \{/.test(DG) && /if \(DD && DD\.leaveCol\) DD\.leaveCol\(id, d\);/.test(DG));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
