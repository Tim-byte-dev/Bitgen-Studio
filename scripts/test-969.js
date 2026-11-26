#!/usr/bin/env node
// bitGen Studio 2.969.0 - the Timeline docker's 🎛 DECK (Tim: "can you add knobs and sliders and slide wheels like and jog
// wheels? for a cool aesthetic?"): ext/timelinedock/tldeck.js + tldeck.css + the markup in dock.html. File checks - the browser
// leg (every control driven with the mouse) is scripts/test-ui969-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const D = src("ext/timelinedock/dock.html"), JS = src("ext/timelinedock/tldeck.js"), CSS = src("ext/timelinedock/tldeck.css"), EXT = JSON.parse(src("ext/timelinedock/ext.json"));

const ids = ["tlDeckTog", "tlDeck", "tlDeckLcd", "tlDeckTc", "tlDeckState", "tlDeckZoomV", "tlDeckStart", "tlDeckRew", "tlDeckStop", "tlDeckPlay", "tlDeckFwd", "tlDeckEnd", "tlDeckJog", "tlDeckZoom", "tlDeckSpeed", "tlDeckSpeedV", "tlDeckLayer", "tlDeckSpace"];
check("dock.html: the deck beside the layers - its tab, LCD, six transport keys, the jog, two slide wheels, three knobs, a fader, the spacer, then #tlscroll",
  ids.every((id) => D.includes('id="' + id + '"')) && /<div id="tlDeckRow">\s*<button type="button" id="tlDeckTog"[\s\S]*<div id="tlDeck"[\s\S]*<div id="tlDeckSpace" aria-hidden="true"><\/div>\s*<div id="tlscroll"><div id="tlinner"><\/div><\/div>\s*<\/div>/.test(D)
  && (D.match(/class="tdk-knob" data-k="(opacity|fin|fout)"/g) || []).length === 3 && /class="tdk-fader" data-k="volume"/.test(D), ids.filter((id) => !D.includes('id="' + id + '"')));
check("every control can be reached and read: role=slider + aria-label on the jog, the wheels, the knobs and the fader", (D.match(/role="slider"/g) || []).length === 7 && /id="tlDeckJog"[^>]*tabindex="0"/.test(D));
check("dock.html links tldeck.css; ext.json loads tldeck.js after tltech.js, at the end", /<link rel="stylesheet" href="\/ext\/timelinedock\/tldeck\.css">/.test(D) && EXT.scripts.indexOf("tldeck.js") > EXT.scripts.indexOf("tltech.js") && EXT.scripts.indexOf("tldeck.js") >= EXT.scripts.length - 2);
check("no menu-bar button (one more there can wrap #tlbar onto another row and push the layers down): the DECK tab at the layers' edge",
  !/getElementById\("tlbar"\)|\$\("tlbar"\)|insertBefore\(b, after/.test(JS) && /\$\("tlDeckTog"\)\.addEventListener\("click", function \(\) \{ show\(\); \}\)/.test(JS));
check("the deck adds no height: absolutely placed in a basis-0 row, #tlDeckSpace keeps its width (a content-sized docker would grow)",
  /#tlDeckRow \{ position: relative; display: flex; flex: 1 1 0%; min-height: 0;/.test(CSS) && /#tlDeck \{\s*position: absolute; left: 24px; top: 0; bottom: 0;/.test(CSS) && /sp\.style\.width = w \+ "px"/.test(JS));
check("the layers come first: more columns only within 40% of the row; under 520 px left (or a row under 120 px) the deck steps aside",
  /var COLW = 242, ROOM = 520, MINH = 120;/.test(JS) && /squeezed = w - COLW - 6 < ROOM \|\| h < MINH/.test(JS) && /cols = Math\.max\(1, Math\.min\(cols, Math\.floor\(w \* 0\.4 \/ COLW\)\)\)/.test(JS) && /#tlDeck\[data-squeezed="1"\] \{ display: none; \}/.test(CSS));
check("a short docker: 2 or 3 columns (grid areas a b / c b, or a b c) instead of a scroll", /#tlDeck\[data-cols="2"\] \{ grid-template-columns: 236px 236px; grid-template-areas: "a b" "c b"; \}/.test(CSS) && /#tlDeck\[data-cols="3"\] \{ grid-template-columns: 236px 236px 236px; grid-template-areas: "a b c"; \}/.test(CSS));
// the controls write what the layer header's own controls write
check("knobs / fader write the layer like its header does: L.opacity (+ the track's opacity), L.volume + L.muted, transitions through trNorm (a fade when it had none, all the way down = a cut)",
  /L\.opacity = Math\.round\(v \* 100\) \/ 100; var el = document\.querySelector\('#tlinner \.tltrack\[data-lk="' \+ lk\(\) \+ '"\]'\); if \(el\) el\.style\.opacity = Math\.max\(0\.25, L\.opacity\)/.test(JS)
  && /L\.volume = Math\.round\(v \* 100\) \/ 100; L\.muted = L\.volume === 0;/.test(JS) && /dur < trMin\(\) \? \{ type: "none", dur: o\.t\.dur \} : \{ type: o\.on \? o\.t\.type : "fade", dur: dur \}/.test(JS) && /L\[key\] = typeof trNorm === "function" \? trNorm\(raw\) : raw;/.test(JS));
check("which layers have what: opacity on video / image layers, volume on video / audio, the fades on every layer",
  /opacity: \{ col: "#38e1ff", has: function \(k\) \{ return kind\(k\) === "video" \|\| kind\(k\) === "image"; \}/.test(JS) && /volume: \{ col: "#38e1ff", has: function \(k\) \{ return kind\(k\) === "video" \|\| kind\(k\) === "audio"; \}/.test(JS));
check("saved once it settles (tlSave + renderTimeline after a drag ends, 400 ms after a wheel / key) - never a redraw mid-drag", /if \(settle\) done\(\); else G\.saveT = setTimeout\(done, 400\);/.test(JS) && /var up = function \(\) \{ if \(y0 == null\) return; y0 = null; G\.dragging = false; set\(k, cur\(\), true\); \};/.test(JS));
check("the transport and the wheels drive what is there: TlCanvas step / play / pause / shuttle / stop / go, #tlZoom's input, #tlCSpeed's change",
  /c\.step\(n\)/.test(JS) && /c\.play\(rate\); G\.shutting = true;/.test(JS) && /z\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/.test(JS) && /s\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/.test(JS) && /var RATES = \[0\.125, 0\.25, 0\.5, 1, 2, 4, 8\], SHUT = \[1, 2, 4, 8\];/.test(JS));
// the shuttle ring's angle -> a rate, and the timecode (pure bits run here)
const shutSrc = JS.match(/var shutFrom = function \(a\) \{[\s\S]*?\n    \};/);
const shutFrom = shutSrc && new Function("SHUT", "Math", shutSrc[0].replace("var shutFrom = ", "return ").replace(/;\s*$/, ""))([1, 2, 4, 8], Math);
const deg = (d) => d * Math.PI / 180;
check("SHUTTLE: a dead zone of ±15° at the top = stop; then 30° steps: 1x, 2x, 4x, 8x each way (8x from 105° on)",
  shutFrom && shutFrom(0) === 0 && shutFrom(deg(14)) === 0 && shutFrom(deg(-14)) === 0 && shutFrom(deg(20)) === 1 && shutFrom(deg(50)) === 2 && shutFrom(deg(80)) === 4 && shutFrom(deg(110)) === 8 && shutFrom(deg(170)) === 8 && shutFrom(deg(-20)) === -1 && shutFrom(deg(-110)) === -8);
const tcSrc = JS.match(/function tc\(t\) \{[^\n]*\}/), padSrc = JS.match(/var pad = function \(n\) \{[^\n]*\};/);
const tc = new Function("FPS", padSrc[0] + "\n" + tcSrc[0] + "\nreturn tc;")(24);
check("the LCD's timecode: H:MM:SS:FF at 24 fps", tc(0) === "0:00:00:00" && tc(1.5) === "0:00:01:12" && tc(3661 + 23 / 24) === "1:01:01:23" && tc(-1) === "0:00:00:00");
check("JOG: a frame per 15° notch; the mouse wheel / ← → a frame (Shift 10); the jog's keys stay out of the timeline's ← / → nudge",
  /var notch = Math\.PI \/ 12;/.test(JS) && /\(e\.shiftKey \? 10 : 1\)/.test(JS) && /deck\.addEventListener\("keydown", function \(e\) \{ if \(\/\^\(Arrow\|Home\|End\)\/\.test\(e\.key\) && e\.target !== deck\) e\.stopPropagation\(\); \}\)/.test(JS));
check("the LCD repaints ~15 times a second and only while it can be seen", /if \(n - G\.last < 66\) return;/.test(JS) && /if \(deck\.hidden \|\| !deck\.offsetParent\) return;/.test(JS));
check("shown / hidden is remembered (h3.tl.deck; shown at first)", /var LSK = "h3\.tl\.deck";/.test(JS) && /var keep = "1"; try \{ keep = localStorage\.getItem\(LSK\) \|\| "1"; \}/.test(JS) && /show\(keep !== "0"\);/.test(JS));
check("nothing added to misc/server.js; the version is 2.969.0", !/tldeck|TlDeck/.test(src("misc/server.js")) && require("../package.json").version >= "2.969.0");
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
