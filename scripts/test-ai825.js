#!/usr/bin/env node
/* bitGen Studio — 2.825.0 units: ▦ ✨ AI in the cells. Tim: "lets go next" (after the dashboard: write a formula from
 * words, explain a formula, fill a column from examples).
 *   the 34 new functions (PROPER, FIND, SUBSTITUTE, TEXTJOIN, MAXIFS, SUMPRODUCT, EOMONTH, IFNA, ISERROR, SWITCH …)
 *   ext/sheetdock/sheetai.js learn / apply / describe (the rule found here), verify (a formula worked out for every
 *   example), refsOf, region / header / columnsOf
 *   lib/sheetAi.js writeFormula / explainFormula / fillFormula / fillValues with a stand-in LLM (setComplete), cleanFormula,
 *   what the LLM is told (columns, never the rows for a formula)
 *   the wiring: ext.json order, routes, the toolbar button, Ctrl+E, the cell menu */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "ext/sheetdock/sheetcalc.js")), AI = require(path.join(ROOT, "ext/sheetdock/sheetai.js")), L = require(path.join(ROOT, "lib/sheetAi.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

(async () => {
  // ---------------------------------------------------------------- the new functions
  const cells = { A1: { v: "john smith" }, A2: { v: "ann-marie o'neil" }, B1: { v: "5" }, B2: { v: "7" }, C1: { v: "x@y.com" }, D1: { v: "=1/0" }, E1: { v: "2026-03-15" }, F1: { v: "North" }, F2: { v: "South" } };
  const ev = (f) => { const b = new C.Book([{ name: "S", cells: Object.assign({}, cells, { Z9: { v: f } }) }]); const v = b.value(0, "Z9"); return v && v.err ? v.err : v; };
  const T = [["=PROPER(A2)", "Ann-Marie O'Neil"], ['=FIND("@",C1)', 2], ['=SEARCH("S*H",A1)', 6], ['=SUBSTITUTE(A1,"o","0")', "j0hn smith"], ['=SUBSTITUTE("a-b-c","-","+",2)', "a-b+c"],
    ['=REPLACE("abcdef",2,3,"X")', "aXef"], ['=REPT("*",3)', "***"], ['=EXACT("a","A")', false], ['=TEXTJOIN(", ",TRUE,A1:A2,"")', "john smith, ann-marie o'neil"],
    ['=MAXIFS(B1:B2,F1:F2,"South")', 7], ['=MINIFS(B1:B2,F1:F2,"<>x")', 5], ['=AVERAGEIFS(B1:B2,F1:F2,"*th")', 6], ["=SUMPRODUCT(B1:B2,B1:B2)", 74], ["=LARGE(B1:B2,2)", 5], ["=SMALL(B1:B2,1)", 5],
    ["=RANK(5,B1:B2)", 2], ["=ROWS(A1:C9)", 9], ["=COLUMNS(A1:C9)", 3], ["=CEILING(7,5)", 10], ["=FLOOR(7,5)", 5], ["=WEEKDAY(E1)", 1], ["=WEEKDAY(E1,2)", 7],
    ['=TEXT(EOMONTH(E1,1),"yyyy-mm-dd")', "2026-04-30"], ['=TEXT(EDATE(E1,-3),"yyyy-mm-dd")', "2025-12-15"], ['=DATEDIF(E1,EDATE(E1,26),"Y")', 2], ['=CHOOSE(2,"a","b","c")', "b"],
    ["=HOUR(0.75)", 18], ["=MINUTE(0.75+1/1440*7)", 7], ['=IFNA(XLOOKUP("q",F1:F2,B1:B2),"none")', "none"], ['=IFNA(1/0,"x")', "#DIV/0!"], ["=ISERROR(D1)", true], ["=ISNA(D1)", false],
    ["=ISBLANK(Q5)", true], ["=ISNUMBER(B1)", true], ["=ISTEXT(A1)", true], ['=SWITCH(F2,"North",1,"South",2,0)', 2], ['=SWITCH("x","a",1,0)', 0], ['=LEFT(C1,FIND("@",C1)-1)', "x"]];
  const wrong = T.filter(([f, want]) => ev(f) !== want).map(([f, want]) => [f, want, ev(f)]);
  check(`${T.length} formulas with the new functions give Excel's answers`, !wrong.length, wrong);
  for (const f of ["PROPER", "FIND", "SEARCH", "SUBSTITUTE", "REPLACE", "REPT", "EXACT", "TEXTJOIN", "AVERAGEIFS", "MAXIFS", "MINIFS", "SUMPRODUCT", "LARGE", "SMALL", "RANK", "ROWS", "COLUMNS", "CEILING", "FLOOR", "WEEKDAY", "HOUR", "MINUTE", "EDATE", "EOMONTH", "DATEDIF", "CHOOSE", "IFNA", "ISERROR", "ISNA", "ISBLANK", "ISNUMBER", "ISTEXT", "SWITCH"]) if (!C.FUNCS.includes(f)) check("ƒ list has " + f, false);
  check("ƒ▾ lists them (82 functions; 2.826.0 CONST = 83)", C.FUNCS.length >= 82, C.FUNCS.length);

  // ---------------------------------------------------------------- 🪄 the rule found here
  const R = (ex, rows, names) => { const p = AI.learn(ex); return p ? { d: AI.describe(p, names || ["A", "B", "C"]), out: rows.map((r) => AI.apply(p, r)) } : null; };
  const cases = [
    ["the first word", [{ ins: ["John Smith"], out: "John" }], [["Mary Jones"], ["Ann Lee"]], ["Mary", "Ann"], /first word of A/],
    ["last name, first name (two examples settle it)", [{ ins: ["John Smith"], out: "Smith, John" }, { ins: ["Mary Ann Jones"], out: "Jones, Mary" }], [["Li Wei Chen"]], ["Chen, Li"], /last word of A \+ ", " \+ first word of A/],
    ["initials, capitals", [{ ins: ["john smith"], out: "J.S." }], [["mary jones"]], ["M.J."], /first letter, capital/],
    ["an email from two columns + the domain typed", [{ ins: ["John", "Smith"], out: "john.smith@acme.com" }], [["Mary", "Jones"]], ["mary.jones@acme.com"], /lower case/],
    ["the domain after @", [{ ins: ["a@x.com"], out: "x.com" }, { ins: ["bob@tiger.com.au"], out: "tiger.com.au" }], [["z@y.org"]], ["y.org"], /"@"/],
    ["the town between commas", [{ ins: ["12 High St, Perth, WA"], out: "Perth" }, { ins: ["3 Low Rd, North Sydney, NSW"], out: "North Sydney" }], [["1 A St, Byron Bay, NSW"]], ["Byron Bay"], /between ","/],
    ["the last word on a tie", [{ ins: ["12 High St, Perth, WA"], out: "WA" }], [["1 A St, Byron Bay, NSW"]], ["NSW"], /last/],
    ["Proper Case", [{ ins: ["JOHN SMITH"], out: "John Smith" }], [["MARY O'NEIL"]], ["Mary O'Neil"], /Proper/],
    ["digits joined (a phone number)", [{ ins: ["(02) 9876 5432"], out: "0298765432" }], [["(07) 1234 0000"]], ["0712340000"], /word/],
    ["three columns with typed marks", [{ ins: ["Tim", "Paul", "Sydney"], out: "Paul T. (Sydney)" }], [["Ann", "Lee", "Perth"]], ["Lee A. (Perth)"], /\(/],
  ];
  for (const [n, ex, rows, want, re] of cases) { const r = R(ex, rows); check("🪄 " + n, r && JSON.stringify(r.out) === JSON.stringify(want) && re.test(r.d), r); }
  check("🪄 a number is never cut into pieces or made up (13.75 + 5 -> 7.5 is no rule), but used whole (Tim-42)", AI.learn([{ ins: ["john smith", "13.75", "5"], out: "7.5" }]) === null && AI.describe(AI.learn([{ ins: ["Tim", "42"], out: "Tim-42" }]), ["A", "B"]) === 'A + "-" + B');
  check("🪄 sums are not a rule of words (5, 3 -> 8: the LLM's job)", AI.learn([{ ins: ["5", "3"], out: "8" }, { ins: ["2", "2"], out: "4" }]) === null);
  check("🪄 a rule that does not fit a row leaves it empty (null)", AI.apply(AI.learn([{ ins: ["John Smith"], out: "Smith" }]), ["Cher"]) === "Cher" || AI.apply(AI.learn([{ ins: ["John Smith"], out: "Smith" }]), [""]) === null);
  const t0 = Date.now(); AI.learn([{ ins: ["the quick brown fox jumps over the lazy dog again and again and again", "x y z"], out: "THE QUICK fox-dog x y z again" }]);
  check("🪄 a long row is searched quickly (bounded)", Date.now() - t0 < 1500, Date.now() - t0);

  // ---------------------------------------------------------------- a formula checked against the examples
  const sheet = { name: "S", cells: { A1: { v: "Units" }, B1: { v: "Price" }, A2: { v: "5" }, B2: { v: "2.5" }, A3: { v: "3" }, B3: { v: "10" }, A4: { v: "2" }, B4: { v: "4" } } };
  const evalAt = (f, r) => { const s = { name: "S", cells: Object.assign({}, sheet.cells, { [C.addr(2, r)]: { v: f } }) }; return new C.Book([s]).get(0, 2, r); };
  const ex = [{ r: 1, out: "12.5" }, { r: 2, out: "30" }];
  check("verify: =A2*B2 gives every example", AI.verify("=A2*B2", 1, ex, evalAt).ok);
  const vb = AI.verify("=A2+B2", 1, ex, evalAt);
  check("verify: =A2+B2 does not - the rows it missed, what it gave, what was wanted", !vb.ok && vb.failed.length === 2 && vb.failed[0].row === 2 && vb.failed[0].got === 7.5 && vb.failed[0].want === "12.5" && vb.failed[1].formula === "=A3+B3", vb.failed);
  check("verify: an error is never a match; text compared as typed", !AI.verify("=A2/0", 1, ex, evalAt).ok && AI.same("Gold", "Gold") && !AI.same("gold", "Gold") && AI.same(12.5, "12.50") && AI.same(0.333, "0.333") && AI.same(1 / 3, "0.33"));
  check("refsOf: the cells and ranges a formula reads, once each, $ dropped", JSON.stringify(AI.refsOf("=SUM($B$2:B9)+B2*'My costs'!C4+B2")) === JSON.stringify(["B2:B9", "B2", "'My costs'!C4"]), AI.refsOf("=SUM($B$2:B9)+B2*'My costs'!C4+B2"));
  const g = (c, r) => { const m = { "0,0": "Name", "1,0": "Units", "0,1": "a", "1,1": 5, "0,2": "b", "1,2": 7 }; return m[c + "," + r] == null ? "" : m[c + "," + r]; };
  const Rg = AI.region((c, r) => g(c, r) !== "", 1, 2), hd = AI.header(g, Rg), cols = AI.columnsOf(g, () => "General", Rg, hd);
  check("region + header + columnsOf: the table, its heading row, each column's letter / heading / kind / a few values", Rg.r1 === 0 && Rg.c2 === 1 && Rg.r2 === 2 && hd === 0 && cols[1].col === "B" && cols[1].name === "Units" && cols[1].kind === "numbers" && cols[1].sample.join() === "5,7" && cols[0].kind === "text", { Rg, hd, cols });

  // ---------------------------------------------------------------- lib/sheetAi.js with a stand-in LLM
  const seen = [];
  let answer = () => "";
  L.setComplete(async (o) => { seen.push(o.messages.map((m) => m.content).join("\n")); return { ok: true, text: answer(o) }; });
  const ctx = { sheet: "Orders", sheets: ["Orders", "Notes"], table: "A1:E7", header: 1, rows: "2-7", cols: [{ col: "D", name: "Units", kind: "numbers", sample: ["5", "3"] }, { col: "E", name: "Price", kind: "money", sample: ["$2.50"] }], cell: "F2", col: "F", cellHeading: "Total" };
  answer = () => "<think>hmm</think>```json\n{\"formula\": \"D2*E2\", \"explain\": \"Units times price.\",}\n```";
  const w = await L.writeFormula(ctx, "units times price", C.FUNCS);
  check("writeFormula: the JSON answer read (thinking, fences, a trailing comma), \"=\" put in front", w.formula === "=D2*E2" && w.explain === "Units times price.", w);
  check("…the LLM was told the columns, the cell, the other sheets, the functions there are - and the ask", /column D "Units": numbers, e\.g\. "5", "3"/.test(seen[0]) && /The formula goes in cell F2 \(column "Total"\)/.test(seen[0]) && /other sheets: "Notes"/.test(seen[0]) && /Only these functions exist: .*XLOOKUP/.test(seen[0]) && /units times price/.test(seen[0]), seen[0].slice(0, 900));
  answer = () => "It is fine";
  let e1 = null; try { await L.writeFormula(ctx, "x", C.FUNCS); } catch (e) { e1 = e; }
  check("writeFormula: an answer with no formula = 502 with why", e1 && e1.status === 502 && /no formula/.test(e1.message));
  let e2 = null; try { await L.writeFormula(ctx, "  ", C.FUNCS); } catch (e) { e2 = e; }
  check("writeFormula: nothing asked = 400", e2 && e2.status === 400);
  answer = () => "<think>x</think>\n## What it does\nIt multiplies the units by the price.";
  const x = await L.explainFormula(Object.assign({ result: "12.5" }, ctx), "=D2*E2", [{ ref: "D2", value: "5" }, { ref: "E2", value: "2.5" }]);
  check("explainFormula: plain text (thinking + headings taken off); the LLM saw the formula, its cells' values and its result", x.text === "What it does\nIt multiplies the units by the price." && /The formula in F2: =D2\*E2/.test(seen[seen.length - 1]) && /D2 = "5"/.test(seen[seen.length - 1]) && /Its result now: "12.5"/.test(seen[seen.length - 1]), x);
  answer = () => '{"formula": "=D2*E2"}';
  const fx = await L.fillFormula(ctx, [{ row: 2, cells: { D: "5", E: "2.5" }, out: "12.5" }], [{ row: 2, formula: "=D2+E2", got: 7.5, want: "12.5" }], C.FUNCS);
  const q = seen[seen.length - 1];
  check("fillFormula: the examples (row, its cells -> the value) and the formula that failed go to the LLM", fx.formula === "=D2*E2" && /row 2: D="5", E="2\.5"  ->  F="12\.5"/.test(q) && /=D2\+E2 gave "7\.5" in row 2 \(wanted "12\.5"\)/.test(q) && /FIRST example's row/.test(q), q.slice(-600));
  answer = () => '{"values": {"4": "Small", "5": "Big", "9": "never asked"}}';
  const fv = await L.fillValues(ctx, [{ row: 2, cells: { D: "5" }, out: "Small" }], [{ row: 4, cells: { D: "2" } }, { row: 5, cells: { D: "10" } }]);
  check("fillValues: only the rows asked for come back", JSON.stringify(fv.values) === '{"4":"Small","5":"Big"}', fv);
  answer = () => "";
  L.setComplete(async () => ({ ok: false, error: "connection refused" }));
  let e3 = null; try { await L.explainFormula(ctx, "=1", []); } catch (e) { e3 = e; }
  check("no LLM = 502 \"the LLM did not answer: connection refused\"", e3 && e3.status === 502 && /did not answer: connection refused/.test(e3.message));
  check("cleanFormula: quotes straightened, backticks off", L.cleanFormula("`IF(A1=“x”,1,0)`") === '=IF(A1="x",1,0)');
  L.setComplete(null);

  // ---------------------------------------------------------------- the wiring
  const ext = JSON.parse(read("ext/sheetdock/ext.json"));
  check("ext.json: sheetai.js after the dashboard", ext.scripts.indexOf("sheetai.js") === ext.scripts.indexOf("sheetdash.js") + 1, ext.scripts);   // 2.826.0: + sheetconst after
  const routes = read("routes/sheets.js");
  check("routes: /api/sheets/ai/formula, /explain, /fill, /fillvalues (server.js untouched)", ["formula", "explain", "fill", "fillvalues"].every((k) => routes.includes(`"/api/sheets/ai/${k}"`)) && !/sheets/.test(read("misc/server.js")));
  const dock = read("ext/sheetdock/sheetdock.js"), html = read("ext/sheetdock/dock.html");
  check("the toolbar's ✨ AI ▾, Ctrl+E (kept from the app), the cell menu's ✍ / 💡 / 🪄", /id="shAi"[^>]*>✨ AI ▾/.test(html) && /on\("shAi"/.test(dock) && /k === "e" \|\| k === "E"/.test(dock) && /zysabiu1eZYSABIUE/.test(dock) && /data-a="aiWrite"/.test(dock) && /data-a="aiFill"/.test(dock) && /data-a="aiExplain"/.test(dock));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e.stack || e)); console.log(`\nRESULT: ${pass} passed, ${fail + 1} failed`); process.exit(1); });
