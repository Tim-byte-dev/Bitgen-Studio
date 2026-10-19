#!/usr/bin/env node
// lib/uiLayout.js — dock size + state in the settings file (2.103.0).
// node scripts/test-uilayout.js
const path = require("path");
const U = require(path.join(__dirname, "..", "lib", "uiLayout"));
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

const d = U.defaults();
// 2.299.1: + stemsdock (it had no stored height or state)
check("defaults cover the nine bottom docks (stems + sfx included) and five side docks", Object.keys(d).length === 14 && d.stemsdock && d.stemsdock.height === 240 && d.sfxdock && d.sfxdock.height === 220 && d.imageeditdock.state === "closed" && d.comfydock.state === "closed", Object.keys(d));
check("...chat and console ship closed, everything else open",
  d.chatdock.state === "closed" && d.consoledock.state === "closed" && d.timelinedock.state === "open" && d.ldock.state === "open", d);
check("...bottom docks carry a height, side docks a width",
  typeof d.promptdock.height === "number" && typeof d.rdock.width === "number" && !("width" in d.promptdock), d);

const n = U.normalize({ timelinedock: { height: "500", state: "max" }, chatdock: { height: 5, state: "max" },
                        ldock: { width: 9999, state: "max" }, bogus: { height: 1 }, promptdock: { state: "weird" } });
check("normalize clamps heights (min 60) and widths (max 640) and coerces strings",
  n.timelinedock.height === 500 && n.chatdock.height === 60 && n.ldock.width === 640, n);
check("...at most ONE dock is max — the second is demoted to open", n.timelinedock.state === "max" && n.chatdock.state === "open", n);
check("...a side dock cannot be max", n.ldock.state === "open", n.ldock);
check("...an unknown dock is dropped, a bad state falls back to the default", !("bogus" in n) && n.promptdock.state === "open", n);
check("normalize(undefined) is the defaults", JSON.stringify(U.normalize(undefined)) === JSON.stringify(U.defaults()), null);

const m = U.merge({ timelinedock: { height: 300, state: "open" } }, { timelinedock: { state: "closed" }, junk: { a: 1 }, rdock: { width: 200 } });
check("merge keeps untouched fields of a dock (height stays 300, state becomes closed)", m.timelinedock.height === 300 && m.timelinedock.state === "closed", m.timelinedock);
check("...applies the other dock and ignores junk", m.rdock.width === 200 && !("junk" in m), m);
const m2 = U.merge({ timelinedock: { height: 300, state: "max" } }, { chatdock: { state: "max" } });
check("merge: maximizing a second dock demotes the first — the NEWEST max wins", m2.chatdock.state === "max" && m2.timelinedock.state === "open", m2);

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
