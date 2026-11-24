#!/usr/bin/env node
// bitGen Studio 2.952.0 - 🎓 the puzzle box drags; Enter rolls whenever it is your roll (Tim: "make the dialog draggable. when user
// presses enter while waiting for dice roll then roll the dice"). The browser test is scripts/test-ui952-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const J = src("ext/lifedock/lifedock.js"), H = src("ext/lifedock/dock.html");
check("drag: pointer events on the box (never from a button / input / select / textarea / link / label), kept inside the game, remembered (h3.life.pzpos), double-click resets",
  /function pzDrag\(\)/.test(J) && /e\.target\.closest\("button, input, select, textarea, a, label"\)\) return;/.test(J) && /function pzMove\(dx, dy\)/.test(J)
  && /Math\.max\(m\.left - bx, Math\.min\(m\.right - r\.width - bx, dx\)\)/.test(J) && /LS\.set\("pzpos", o\.x \+ "," \+ o\.y\)/.test(J) && /pzMove\(0, 0\); LS\.set\("pzpos", "0,0"\)/.test(J));
check("the box: a move cursor, no touch scrolling while dragging, its tip says how", /cursor: move; touch-action: none;/.test(H) && /title="Drag to move it \(double-click: back to its place\)"/.test(H));
check("Enter: one rule (enterKey) - not while typing / rolling / with a panel open; carry on, else roll when you can",
  /function enterKey\(t\)/.test(J) && /if \(doc\.querySelector\("#lcSetup\.on, #lcHelp\.on, #lcScores\.on"\)\) return false;/.test(J) && /if \(!s\.pending && C\.canRoll\(s\)\) \{ doRoll\(\); return true; \}/.test(J));
check("Enter on the page (or anywhere while the game fills the window, but not on another part's button) rolls; the docker's own keys use the same rule",
  /var loose = !t \|\| t === doc\.body \|\| t === doc\.documentElement;/.test(J) && /if \(!loose && !doc\.body\.classList\.contains\("lc-full"\)\) return;/.test(J) && /if \(!enterKey\(t\)\) return;/.test(J));
check("closing the box takes the focus out of it (Enter then rolls)", /if \(!on && d\.contains\(doc\.activeElement\)\) try \{ doc\.activeElement\.blur\(\); \}/.test(J));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
