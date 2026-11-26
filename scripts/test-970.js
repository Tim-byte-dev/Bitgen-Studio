#!/usr/bin/env node
// bitGen Studio 2.970.0 - the Timeline docker's extra SCREENS (Tim: "put the preview back please, but this time let user add
// additional screens so different layers can play at the same time ... keep a master preview for the final . each screen will
// have the ability to switch positions with the master screen (right click context menu)"). File checks - the browser leg
// (pixels on every screen, the swap, the menu) is scripts/test-ui970-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const D = src("ext/timelinedock/dock.html"), JS = src("ext/timelinedock/tlscreens.js"), CSS = src("ext/timelinedock/tlscreens.css"), CV = src("ext/timelinedock/canvas.js"), EXT = JSON.parse(src("ext/timelinedock/ext.json"));

check("the preview is back for good: #tlStage keeps at least 190 px (it had been squeezed to nothing in a short docker)", /#tlStage:not\(\.off\) \{ min-height: 190px; \}/.test(CSS));
check("dock.html: #tlScreens (grip, SCREENS + ＋, the list) between the master canvas column and the Layers panel; tlscreens.css linked",
  /<\/div>\s*<\/div>\s*<!-- 2\.970\.0[\s\S]*?<div id="tlScreens" aria-label="Screens" data-empty="1">[\s\S]*?id="tlScrGrip"[\s\S]*?id="tlScrAdd"[\s\S]*?id="tlScrList" role="list"><\/div>\s*<\/div>\s*<div id="tlLayersPanel"/.test(D) && /<link rel="stylesheet" href="\/ext\/timelinedock\/tlscreens\.css">/.test(D));
check("ext.json loads tlscreens.js last (after canvas.js and tldeck.js)", EXT.scripts[EXT.scripts.length - 1] === "tlscreens.js" && EXT.scripts.indexOf("canvas.js") < EXT.scripts.indexOf("tlscreens.js"));
// canvas.js: the master VIEW only
check("canvas.js: draw() sets ONLY from state.only around its own paintComp (reset in finally) - the compile / snapshots never see it",
  /ONLY = S\.only \|\| null;\s*try \{ paintComp\(ctx, t\); \} finally \{ ONLY = null; \}/.test(CV) && (CV.match(/ONLY = /g) || []).length === 3 && /var ONLY = null;/.test(CV));
check("...while ONLY: that one layer (even if hidden), no rendered-preview / GPU shortcut (they are the whole picture), no captions / overlays",
  /if \(ONLY && Ly\.lk !== ONLY\) return;/.test(CV) && /if \(!liveL\(Ly\.L\) && !ONLY\) return;/.test(CV) && /var rv = S\.playing && !ONLY && window\.TlRender/.test(CV)
  && /if \(S\.playing && !ONLY && !adjOn && !blendOn/.test(CV) && /if \(!ONLY\) compHooks\.forEach/.test(CV));
// tlscreens.js
check("screens draw from the master's own draw (TlCanvas.onDraw): the same moment, the same video elements - they play together",
  /c\.onDraw\(function \(\) \{ paint\(\); \}\)/.test(JS) && /var S = c\.state, t = S\.t \|\| 0/.test(JS));
check("a screen = one layer through TlCanvas.drawLayer; the screen holding the master = TlCanvas.paintComp (the final picture)", /if \(master\) c\.paintComp\(g, t\);/.test(JS) && /else if \(Ly\) c\.drawLayer\(g, Ly, t\);/.test(JS));
check("swap: the screen's layer onto the big preview (state.only), the master onto the screen; again = back; a badge on the big preview (click = back)",
  /G\.swap = i; c\.state\.only = Ly\.lk;/.test(JS) && /if \(G\.swap === i\) \{ unswap\(\);/.test(JS) && /b\.id = "tlScrBadge"/.test(JS) && /b\.addEventListener\("click", function \(\) \{ if \(G\.swap >= 0\) swap\(G\.swap\); \}\)/.test(JS));
check("right-click menu: ⇄ Swap with the master / Put the master back, ▣ another layer, ＋ Add, ✕ Remove; keyboard: the menu key or Shift+F10, ↑ ↓, Esc",
  /sw \? "⇄ Put the master back" : "⇄ Swap with the master"/.test(JS) && /"▣ Show another layer…"/.test(JS) && /"＋ Add a screen"/.test(JS) && /"✕ Remove screen "/.test(JS)
  && /e\.key === "ContextMenu" \|\| \(e\.shiftKey && e\.key === "F10"\)/.test(JS) && /role", "menu"/.test(JS));
check("a double-click on a screen swaps too; a screen's layer is found again by its colour after a reorder; removed swapped screen = master back",
  /addEventListener\("dblclick", function \(\) \{ swap\(i\); \}\)/.test(JS) && /if \(sc\.hue != null\) \{ var h = st\.filter\(function \(Ly\) \{ return Ly\.L && Ly\.L\.hue === sc\.hue; \}\);/.test(JS) && /if \(G\.swap === i\) unswap\(\); else if \(G\.swap > i\) G\.swap--;/.test(JS));
check("up to 8 screens; ＋ takes the picked layer, else one no screen shows yet; kept in this browser (h3.tl.screens, h3.tl.scrw)",
  /MAX = 8/.test(JS) && /var LSK = "h3\.tl\.screens", LSW = "h3\.tl\.scrw"/.test(JS));
check("the column: a slim tab with no screens, a grid when wide (minmax 200px), its left edge drags it (180 px .. 70% of the stage)",
  /#tlScreens\[data-empty="1"\] \{ width: 26px;/.test(CSS) && /grid-template-columns: repeat\(auto-fill, minmax\(200px, 1fr\)\)/.test(CSS) && /Math\.max\(180, Math\.min\(max, \+px \|\| 300\)\)/.test(JS) && /stage\.clientWidth \* 0\.7/.test(JS));
check("screens keep the picture's shape (--tsc-ar from the canvas's W / H); a screen's drawing never breaks the master (try / catch)",
  /aspect-ratio: var\(--tsc-ar, 16 \/ 9\)/.test(CSS) && /col\.style\.setProperty\("--tsc-ar", \(c\.state\.W \|\| 16\) \+ " \/ " \+ \(c\.state\.H \|\| 9\)\)/.test(JS) && /catch \(e\) \{ \/\* a screen never breaks the master \*\/ \}/.test(JS));
check("nothing added to misc/server.js; the version is 2.970.0", !/tlscreens|TlScreens/.test(src("misc/server.js")) && require("../package.json").version === "2.970.0");
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
