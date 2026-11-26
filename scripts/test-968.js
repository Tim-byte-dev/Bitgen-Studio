#!/usr/bin/env node
// bitGen Studio 2.968.0 - the Timeline docker's TECHNICAL look (Tim: "is it possible to make the timeline docker look technical
// like you did with the synth tab?"): ext/timelinedock/tltech.css (scoped to #timelinedock.tl-tech) + tltech.js (the class,
// the time grid, ⚙ Timeline settings ▸ Look). File checks only - the browser leg is scripts/test-ui968-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const CSS = src("ext/timelinedock/tltech.css"), JS = src("ext/timelinedock/tltech.js"), D = src("ext/timelinedock/dock.html");
const EXT = JSON.parse(src("ext/timelinedock/ext.json")), H = src("static/index.html");
const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, "").split("}").map((r) => r.trim()).filter((r) => r.includes("{")).map((r) => ({ sel: r.slice(0, r.indexOf("{")).trim(), body: r.slice(r.indexOf("{") + 1) }));
const sels = rules.flatMap((r) => r.sel.split(",").map((s) => s.trim()));
check("tltech.css: every rule is scoped - #timelinedock.tl-tech, or the timeline's own panels while the docker has the look",
  sels.length > 60 && sels.every((s) => s.startsWith("#timelinedock.tl-tech") || s.startsWith("body:has(#timelinedock.tl-tech) .tsd") || s.startsWith("body:has(#timelinedock.tl-tech) #tlFloat")), sels.filter((s) => !/^(#timelinedock\.tl-tech|body:has\(#timelinedock\.tl-tech\) (\.tsd|#tlFloat))/.test(s)));
const layoutish = rules.filter((r) => /\.(tltrack|clip|tlruler)\b|#tlscroll|#tlinner/.test(r.sel) && !/::before|::-webkit-scrollbar/.test(r.sel) && /(^|;)\s*(height|width|top|left|position|display|margin|flex)\s*:/.test(r.body));
check("nothing in the layers moves: no height / width / position / margin / display on the tracks, clips, ruler or the scroll box", layoutish.length === 0, layoutish.map((r) => r.sel));
check("the Synth's palette: #07090c / #0b0d11 / #11141a, the cyan #38e1ff, the amber #ffa63d, panels #1b1f27 -> #121419, h4-style labels (700 10px, .18em, glow)",
  /--tt-bg0: #07090c/.test(CSS) && /--tt-cyan: #38e1ff/.test(CSS) && /--tt-amber: #ffa63d/.test(CSS) && /linear-gradient\(180deg, #1b1f27 0%, #121419 100%\)/.test(CSS) && /font: 700 10px\/1 system-ui, sans-serif; letter-spacing: \.18em/.test(CSS));
check("each layer keeps its own colour (--lc): clips in it with a name bar, a glow, the waveform; audio / image fall back to cyan / green",
  /--cc: var\(--lc, var\(--tt-amber\)\)/.test(CSS) && /\.clip\.audio \{ --cc: var\(--lc, var\(--tt-cyan\)\)/.test(CSS) && /\.clip\.img \{ --cc: var\(--lc, #5dff8a\)/.test(CSS) && /\.clip \.wave polygon \{ fill: var\(--cc\)/.test(CSS) && /color-mix\(in srgb, var\(--cc\)/.test(CSS));
check("LCD readouts (#tlPh, #tlTc, #tlCTime, the selection), a LAYERS label over the headers, EDIT on the menu bar, ⚙ Compile the amber key",
  /#timelinedock\.tl-tech #tlPh,\s*#timelinedock\.tl-tech #tlTc,\s*#timelinedock\.tl-tech #tlCTime/.test(CSS) && /content: "LAYERS"; position: sticky; left: 0/.test(CSS) && /#tlbar::before \{\s*content: "EDIT"/.test(CSS) && /#tlExport \{\s*border-color: var\(--tt-amber\) !important/.test(CSS));
check("the grid: --tgrid / --tgrid2 lines from the headers' edge (background-position var(--labw)), the layer tint kept on top",
  /repeating-linear-gradient\(90deg, #ffffff0d 0 1px, transparent 1px var\(--tgrid, 70px\)\)/.test(CSS) && /background-image: linear-gradient\(var\(--ltint\), var\(--ltint\)\),/.test(CSS) && /background-position: 0 0, var\(--labw\) 0, var\(--labw\) 0/.test(CSS));
check("dock.html links tltech.css (version-stamped by the page like every /ext/ file)", /<link rel="stylesheet" href="\/ext\/timelinedock\/tltech\.css">\s*(<link rel="stylesheet" href="\/ext\/timelinedock\/[a-z]+\.css">\s*)*<div class="bdock" id="timelinedock">/.test(D));
check("ext.json: tltech.js loads after tlsettings.js (its Look tab)", EXT.scripts.includes("tltech.js") && EXT.scripts.indexOf("tltech.js") > EXT.scripts.indexOf("tlsettings.js") && EXT.scripts.indexOf("tltech.js") >= EXT.scripts.length - 3);
// the grid's steps are the ruler's own
const rulerStep = (H.match(/const major = PXS >= (\d+) \? 1 : PXS >= (\d+) \? 5 : 15;/) || []).slice(1).join();
check("tltech.js: the grid steps are the ruler's (1 s from 96 px/s, 5 s from 24, else 15 s), never under 12 px; a fifth for the faint lines",
  rulerStep === "96,24" && /var step = pxs >= 96 \? 1 : pxs >= 24 \? 5 : 15;/.test(JS) && /Math\.max\(12, pxs \* step\)/.test(JS) && /minor = px \/ 5 >= 10 \? px \/ 5 : px/.test(JS), rulerStep);
// run grid() against a stand-in page
const props = {}, inner = { style: { setProperty: (k, v) => { props[k] = v; } } };
const dock = { classList: { _on: new Set(), toggle(c, on) { if (on) this._on.add(c); else this._on.delete(c); }, contains(c) { return this._on.has(c); } } };
const tabs = [];
const sandbox = { document: { getElementById: (id) => (id === "timelinedock" ? dock : id === "tlinner" ? inner : id === "tlsLookTech" || id === "tlsLookClassic" ? sandbox._radios[id] : null) },
  window: { TimelineSettings: { addTab: (t) => tabs.push(t) }, addEventListener() {} }, setInterval: () => 1, clearInterval() {}, cfg: null, PXS: 14, _radios: { tlsLookTech: { checked: false }, tlsLookClassic: { checked: false } } };
sandbox.window.MutationObserver = null;
new Function("window", "document", "setInterval", "clearInterval", "cfg", "PXS", JS)(sandbox.window, sandbox.document, sandbox.setInterval, sandbox.clearInterval, null, 14);
const L = sandbox.window.TlLook;
check("at start: the technical look is on (the default), the grid set for 14 px/s (15 s = 210 px, faint every 42 px)", dock.classList.contains("tl-tech") && props["--tgrid"] === "210px" && props["--tgrid2"] === "42px" && L.look() === "tech", { on: dock.classList.contains("tl-tech"), props });
check("Look ▸ Classic takes the class off; Technical puts it back; a bad value = technical", L.set("classic") === false && !dock.classList.contains("tl-tech") && L.set("tech") === true && dock.classList.contains("tl-tech") && L.set("pink") === true && L.look() === "tech");
const tab = tabs[0] || {};
sandbox._radios.tlsLookClassic.checked = true; sandbox._radios.tlsLookTech.checked = false;
const rd = tab.read && tab.read();
check("⚙ Timeline settings ▸ Look: Technical / Classic radios; saved as ui.tl_look; saving applies it at once",
  tab.id === "look" && tab.label === "Look" && /id="tlsLookTech" value="tech"/.test(tab.html()) && /id="tlsLookClassic" value="classic"/.test(tab.html()) && rd && rd.ui.tl_look === "classic" && (tab.saved(rd.ui), !dock.classList.contains("tl-tech")), { id: tab.id, rd });
L.set("tech");
check("the saved choice is put back once the settings arrive (cfg.ui.tl_look), checked every 250 ms for 30 s", /saved\(\) !== null \|\| \+\+tries > 120/.test(JS) && /u\.tl_look/.test(JS));
check("the core page's renderTimeline is not touched: a MutationObserver on #tlinner keeps the grid in step", /new MutationObserver\(function \(\) \{ if \(dock\.classList\.contains\("tl-tech"\)\) grid\(\); \}\)\.observe\(inner, \{ childList: true \}\)/.test(JS) && !/tltech|TlLook|tl-tech/.test(H));
check("nothing added to misc/server.js", !/tltech|tl_look/.test(src("misc/server.js")));
check("the version is 2.968.0 or later", require("../package.json").version >= "2.968.0");
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
