// bitGen Studio — dockers.json (lib/dockers.js): the GLOBAL dock layout.
// Heights and min/max/normal states must round-trip, merge per dock, clamp
// junk, drop unknown ids, and live at the install root — one file for every
// project. Run from repo root: node scripts/test-dockers.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const D = require(path.join(__dirname, "..", "lib", "dockers"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}
const base = fs.mkdtempSync(path.join(os.tmpdir(), "dockers-"));

check("an install with no file answers an empty layout, never a crash",
      JSON.stringify(D.load(base)) === '{"docks":{}}');
let r = D.save(base, { docks: { timelinedock: { height: 320, state: "normal" },
                                musicdock: { state: "min" } } });
check("save writes dockers.json at the INSTALL root and answers the whole layout",
      fs.existsSync(D.fileOf(base))
      && r.docks.timelinedock.height === 320 && r.docks.musicdock.state === "min", r);
check("load reads back exactly what was saved",
      JSON.stringify(D.load(base)) === JSON.stringify(r));
r = D.save(base, { docks: { timelinedock: { state: "min" } } });
check("a partial update MERGES per dock — the height survives a state change",
      r.docks.timelinedock.height === 320 && r.docks.timelinedock.state === "min", r.docks.timelinedock);
r = D.save(base, { docks: { timelinedock: { height: 5, state: "normal" },
                            chatdock: { height: 99999 } } });
check("junk heights clamp to 60..2000 — a bad value must not wedge a dock off screen",
      r.docks.timelinedock.height === 60 && r.docks.chatdock.height === 2000, r.docks);
r = D.save(base, { docks: { nosuchdock: { height: 300 }, consoledock: { state: "sideways" } } });
check("unknown docks and unknown states are dropped, not stored",
      !r.docks.nosuchdock && !r.docks.consoledock, r.docks);
r = D.save(base, { docks: { comfydock: { state: "max" }, promptdock: { state: "max" } } });
check("one maximized dock at a time — the file obeys the UI's law",
      [r.docks.comfydock, r.docks.promptdock].filter((d) => d && d.state === "max").length === 1,
      r.docks);
r = D.save(base, { docks: { timelinedock: { height: null } } });
check("height: null explicitly clears a stored height (the dock goes elastic)",
      r.docks.timelinedock && r.docks.timelinedock.height === undefined
      && r.docks.timelinedock.state === "normal", r.docks.timelinedock);
fs.writeFileSync(D.fileOf(base), "{ this is not json", "utf8");
check("a corrupted file reads as empty — the layout degrades, never crashes",
      JSON.stringify(D.load(base)) === '{"docks":{}}');
check("previewdock is a KNOWN dock (state-only — it is the elastic one)",
      D.DOCKS.includes("previewdock"));

fs.rmSync(base, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
