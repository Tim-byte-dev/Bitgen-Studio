#!/usr/bin/env node
// bitGen Studio 2.950.0 - 🚓 / 🎓 Esc and leaving full screen go back to the docker; 🚓 the roofs lit (Tim: "in police chase exit
// full screen or esc should go back to docker view, same with life choices" + "also light the roofs of the buildings, i can't tell
// where they are"). The browser test is scripts/test-ui950-ui.js. Run: node scripts/test-950.js
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const CH = src("ext/chasedock/chasedock.js"), LF = src("ext/lifedock/lifedock.js"), TH = src("ext/chasedock/chasetheme.js");
check("🚓 a plain Esc while full screen = exitFull (the ⚙ Sound box closes first), never 'pause and stay'",
  /if \(k === "Escape" && !ctl\) \{\s*if \(\$\("pcMixBox"\) && \$\("pcMixBox"\)\.classList\.contains\("on"\)\) return;\s*e\.preventDefault\(\); e\.stopImmediatePropagation\(\); exitFull\(\);/.test(CH)
  && !/pause\("paused"\); \}\s*\}, true\);/.test(CH));
check("🚓 the window leaving full screen by itself -> exitFull; exitFull pauses a running game and un-maximizes",
  /if \(!doc\.fullscreenElement && isFull\(\)\) exitFull\(\)/.test(CH) && /function exitFull\(\) \{\s*if \(G\.s && !G\.demo && !G\.paused && G\.s\.phase !== "over"\) pause\("back to the docker"\);/.test(CH));
check("🎓 Esc (capture, even in a box) and the window leaving full screen -> exitFull; back to the docker also leaves the window's full screen",
  /e\.key !== "Escape" \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey \|\| !doc\.body\.classList\.contains\("lc-full"\)\) return;\s*e\.preventDefault\(\); e\.stopImmediatePropagation\(\); exitFull\(\);\s*\}, true\);/.test(LF)
  && /!doc\.fullscreenElement && doc\.body\.classList\.contains\("lc-full"\)\) exitFull\(\)/.test(LF) && /if \(!on && doc\.fullscreenElement && doc\.exitFullscreen\)/.test(LF));
check("🚓 one shared lit roof (map + glowing rim emissive) on the painted city's tops, the edge walls and the art pack's tops; never disposed with a city",
  /function roofMaterial\(\)/.test(CH) && /emissiveMap: mk\(true\), emissiveIntensity: 0\.45/.test(CH) && /mats = \[side, side, roofMaterial\(\), under, side, side\]/.test(CH)
  && /mats = \[wall, wall, roofMaterial\(\), wall, wall, wall\]/.test(CH) && /mat\("nx"\), roofMaterial\(\),/.test(CH) && /mt\.userData && mt\.userData\.shared\) return;/.test(CH));
check("🚓 the settings' house and barn roofs catch light at night", /house_roof:[^\n]*emissive: 0x3a3440/.test(TH) && /barn_roof:[^\n]*emissive: 0x2e3038/.test(TH));
check("the buttons say Esc", /Back to the docker \(Esc, Ctrl\+Esc/.test(src("ext/chasedock/dock.html")) && /title="Back to the docker \(Esc\)"/.test(src("ext/lifedock/dock.html")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
