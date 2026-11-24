#!/usr/bin/env node
// bitGen Studio 2.951.0 - 🎓 Life Choices: the puzzle in a dialog, a 🧮 calculator in it, the dice in the centre circle (Tim: "for
// life choices, use a dialog to show questions, add a calculator to the dialog, show the dice roll in the center circle").
// The browser test is scripts/test-ui951-ui.js. Run: node scripts/test-951.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const K = require("../ext/lifedock/lifecalc.js");
const ev = (t) => { try { return K.show(K.evaluate(t)); } catch (e) { return "ERR " + e.message; } };
check("sums: the order of operations, brackets, × ÷ −, decimals, unary minus, 2(3+4), %", ev("2+3×4") === "14" && ev("(2+3)*4") === "20" && ev("48 ÷ 6 + 3") === "11"
  && ev("10 − 4 − 3") === "3" && ev("1.5*4") === "6" && ev("-3*-2") === "6" && ev("2(3+4)") === "14" && ev("50%*80") === "40" && ev("1,000/8") === "125", [ev("2+3×4"), ev("10 − 4 − 3"), ev("50%*80")]);
check("no float dust: 0.1 + 0.2 = 0.3, 1/3 to 10 digits, big numbers short", ev("0.1+0.2") === "0.3" && ev("1/3") === "0.3333333333" && ev("10/4") === "2.5" && /e\+/.test(ev("99999999999*99999999999")));
check("errors in words: ÷ 0, an open bracket, a stray ), letters, nothing, too long", /÷ 0 has no answer/.test(ev("5/0")) && /bracket is open/.test(ev("(2+3")) && /a \) with no \(/.test(ev("2+3)"))
  && /not a number/.test(ev("2+x")) && /type a sum/.test(ev("")) && /too long/.test(ev("1+".repeat(120) + "1")), [ev("5/0"), ev("(2+3"), ev("2+3)"), ev("2+x")]);
check("never eval / Function (its own parser)", !/\beval\s*\(|new Function|Function\(/.test(src("ext/lifedock/lifecalc.js")));
const H = src("ext/lifedock/dock.html"), J = src("ext/lifedock/lifedock.js"), E = JSON.parse(src("ext/lifedock/ext.json"));
check("the dialog: role=dialog over the board (low, no dimming, the squares still hoverable), the question box + the calculator's 20 keys + ➜ Use",
  /id="lcPz" role="dialog" aria-modal="true" aria-labelledby="lcPzHead"/.test(H) && /<div id="lcPzQ"/.test(H) && (H.match(/data-k="/g) || []).length === 20 && /id="lcCalcUse"/.test(H)
  && /#lcPz \{ background: none; pointer-events: none; align-items: flex-end;/.test(H) && /#lcSetup, #lcHelp, #lcScores \{ z-index: 4; \}/.test(H));
check("lifecalc.js loads before lifedock.js", E.scripts.indexOf("lifecalc.js") >= 0 && E.scripts.indexOf("lifecalc.js") < E.scripts.indexOf("lifedock.js"));
check("the puzzle renders into the dialog (pzShow), the side panel only points at it; the calculator resets for each new puzzle; Enter in it never rolls",
  /box = \$\("lcPzQ"\)/.test(J) && /pzShow\(true\)/.test(J) && /if \(!pdz\) pzShow\(false\)/.test(J) && /if \(G\.calcKey !== key\) \{ G\.calcKey = key; calcSet\(""\); \}/.test(J)
  && /\$\("lcCalcIn"\)\.addEventListener\("keydown", function \(e\) \{ if \(e\.key === "Enter" \|\| e\.key === "="\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); calcEquals\(\); \} \}\)/.test(J));
check("the dice in the centre circle: drawn with pips in the roller's colour, the total + luck under them, tumbling while you roll",
  /function centreDice\(x, g, dice, L, s\)/.test(J) && /if \(spin \|\| L\) centreDice\(/.test(J) && /G\.spin = \[face\(\), face\(\)\]; diceView\(true\); drawSpin\(\);/.test(J) && /var PIPS = \{ 1: \[\[0, 0\]\]/.test(J));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
