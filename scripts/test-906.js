// bitGen Studio 2.906.0 - the aspect ratio with Override style (Tim: "h3 omni is still not changing aspect ratio"):
//   lib/renderSettings.js sizeFor - Override style ON = Basic Settings' size beats the StoryBoard's ⚙ Resolution (as its
//   steps / cfg already did), jobOverrides + routes/swap.js use it; misc/worker.py says the size asked, the size each
//   MiniMax H3 node was given and the take's own size. The Python half: scripts/test-906.py; the browser: test-ui906-ui.js.
// Run: node scripts/test-906.js
"use strict";
const fs = require("fs"), path = require("path");
let ok = 0, fail = 0;
const check = (n, c, x) => { if (c) { ok++; console.log("ok   ", n); } else { fail++; console.log("FAIL ", n, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const RS = require("../lib/renderSettings");

const s = (o) => Object.assign({ res: "720", aspect: "16:9", basic_width: 544, basic_height: 960 }, o);
check("sizeFor: Override ON + a Basic Settings size -> Basic Settings' (9:16), not the ⚙'s 720p 16:9", JSON.stringify(RS.sizeFor(s({ basic_override: true }))) === '{"source":"basic","width":544,"height":960}', RS.sizeFor(s({ basic_override: true })));
check("sizeFor: Override OFF -> the ⚙'s size", JSON.stringify(RS.sizeFor(s({ basic_override: false }))) === '{"source":"gear","width":1280,"height":720}', RS.sizeFor(s({})));
check("sizeFor: no ⚙ Resolution -> Basic Settings' (the last ▶), as 2.357.0", RS.sizeFor(s({ res: "" })).source === "basic");
check("sizeFor: Override ON but no Basic Settings size kept -> the ⚙'s", RS.sizeFor(s({ basic_override: true, basic_width: 0, basic_height: 0 })).source === "gear");
check("sizeFor: nothing -> the default", RS.sizeFor({}).source === "default");
let j = RS.jobOverrides(RS.normalize(s({ basic_override: true })), { width: 960, height: 544 });
check("jobOverrides: a board render with Override ON renders 544x960 and says the ⚙ was passed over", j.width === 544 && j.height === 960
  && /Basic Settings - Override style is on; the StoryBoard's ⚙ says 720p 16:9/.test(j.notes[0]), j.notes);
j = RS.jobOverrides(RS.normalize(s({ basic_override: false })), { width: 960, height: 544 });
check("jobOverrides: Override OFF keeps the ⚙'s 1280x720 (its words unchanged)", j.width === 1280 && j.height === 720 && /the StoryBoard's ⚙ - set its Resolution to default/.test(j.notes[0]), j.notes);
j = RS.jobOverrides(RS.normalize({ basic_width: 544, basic_height: 960 }), { width: 960, height: 544 });
check("jobOverrides: no ⚙ -> Basic Settings (the left dock)", j.width === 544 && /Basic Settings, the left dock/.test(j.notes[0]), j.notes);
const sw = R("routes/swap.js");
check("routes/swap.js: a scene's swap takes its size from sizeFor (no ⚙-only dims)", /require\("\.\.\/lib\/renderSettings"\)\.sizeFor\(rs\)/.test(sw) && !/dims\(rs\.res, rs\.aspect\) \|\|/.test(sw));
const w = R("misc/worker.py");
check("worker: the H3 path says the size asked and what each node got (after the refmods)", /g = _apply_refmods\(g, params\.get\("refmods"\)\)   # 2\.225\.0: cast identity mods\n\s+say\("\[comfy\] " \+ _size_words\(g, params\)\)/.test(w));
check("worker: the finished take's own size on the 'render complete' line, a name main() does not shadow (probe_wh is main's own)",
  /_wh = probe_take_wh\(final\)/.test(w) && (w.match(/def probe_take_wh/g) || []).length === 1 && /^def probe_take_wh\(p: Path\):/m.test(w));
console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
