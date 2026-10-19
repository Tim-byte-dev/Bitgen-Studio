#!/usr/bin/env node
/* bitGen Studio — 2.514.0 unit tests: DOCKERS (static/sidecollapse.js, ext/imageeditdock/pcpanels.js fold / close / View ▸
 * Dockers, static/floatpanels.js onClose) and EDIT THEME MODE (static/themeedit.js hide / text / size / move / resizeBy /
 * the session, lib/themeStore.js + routes/themes.js the themes/<name>.tmp working copy). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const TE = require(path.join(ROOT, "static", "themeedit.js"));
const TS = require(path.join(ROOT, "lib", "themeStore.js"));

const r = TE.cleanRule({ hide: true, text: "Go\nnow", w: 99999, h: "", dx: 12.6, dy: 0, junk: 1 });
check("cleanRule: hide, its text (no line breaks, 200 at most), width clamped to 4000, an empty height / a zero move dropped", r.hide === true && r.text === "Go now" && r.w === 4000 && !("h" in r) && r.dx === 13 && !("dy" in r) && !("junk" in r), r);
check("cleanRule: hide must be true, an empty / blank text is no text", !("hide" in TE.cleanRule({ hide: "yes" })) && !("text" in TE.cleanRule({ text: "   " })));
const css = TE.compile({ "#b": { w: 120, h: 30, dx: 5, dy: -4, hide: true } });
check("compile: width / height pinned (min / max, no flex growth), moved by translate (the layout around it stays), hidden in live mode only - faint and dashed in edit mode",
  /width:120px !important;min-width:120px !important;max-width:120px !important;flex-grow:0 !important/.test(css) && /height:30px !important/.test(css) && /translate:5px -4px !important/.test(css)
  && /body:not\(\.h3-thedit\) #b:not\(#thEditPanel \*\)\{display:none !important\}/.test(css) && /body\.h3-thedit #b:not\(#thEditPanel \*\)\{opacity:\.35 !important/.test(css), css);
check("resizeBy: right / bottom handles grow the size; left / top keep the opposite edge (the move follows); never under 4 px",
  JSON.stringify(TE.resizeBy("se", { w: 100, h: 40, dx: 0, dy: 0 }, 20, 10)) === '{"w":120,"h":50,"dx":0,"dy":0}' && JSON.stringify(TE.resizeBy("nw", { w: 100, h: 40, dx: 3, dy: 0 }, 10, 5)) === '{"w":90,"h":35,"dx":13,"dy":5}'
  && TE.resizeBy("w", { w: 10, h: 10, dx: 0, dy: 0 }, 50, 0).w === 4 && TE.resizeBy("n", { w: 10, h: 10 }, 0, 0).h === 10);
/* the working copy */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "th514-")); TS.setBase(tmp);
const w = TS.saveTmp("My Look", { base: "dark", vars: {}, styles: { "#x": { hide: true } } });
const rd = TS.readTmp("My Look");
check("themes/<name>.tmp: written (even without colours yet), read back cleaned, never listed as a theme, removed", w.file === "My Look.tmp" && fs.existsSync(path.join(tmp, "themes", "My Look.tmp")) && rd.styles["#x"].hide === true
  && TS.list().length === 0 && TS.removeTmp("My Look").removed && !fs.existsSync(path.join(tmp, "themes", "My Look.tmp")) && (() => { try { TS.readTmp("My Look"); return false; } catch (e) { return e.status === 404; } })());
fs.rmSync(tmp, { recursive: true, force: true });
const RT = read("routes", "themes.js"), TJ = read("static", "themeedit.js");
check("routes: GET /api/themes/tmp/:name before GET /api/themes/:name; POST /api/themes/tmp and /tmp/delete", RT.indexOf('app.get("/api/themes/tmp/:name"') >= 0 && RT.indexOf('app.get("/api/themes/tmp/:name"') < RT.indexOf('app.get("/api/themes/:name"') && /app\.post\("\/api\/themes\/tmp"/.test(RT) && /app\.post\("\/api\/themes\/tmp\/delete"/.test(RT));
check("the page: Layout (teHide, teText, teW, teH, teDx, teDy), 8 handles, drag to move, the leaving box (Save theme / Save theme as… / Reset theme / Cancel), a .tmp offered back",
  /id="teHide"/.test(TJ) && /id="teText"/.test(TJ) && /n\("teW"/.test(TJ) && /n\("teDx"/.test(TJ) && /\["nw", "n", "ne", "e", "se", "s", "sw", "w"\]/.test(TJ) && /function startMove\(e\)/.test(TJ)
  && /id="thxSave"/.test(TJ) && /id="thxAs"/.test(TJ) && /id="thxReset"/.test(TJ) && /id="thxLater"/.test(TJ) && /id="thxCancel"/.test(TJ) && /Unsaved theme changes/.test(TJ) && /if \(!next && !\(opts && opts\.force\) && changedSince\(\)\) \{ exitBox\(\); return on; \}/.test(TJ));
/* dockers */
const SC = require ? read("static", "sidecollapse.js") : "", PP = read("ext", "imageeditdock", "pcpanels.js"), FP = read("static", "floatpanels.js"), DF = read("static", "dockfloat.js"), IX = read("static", "index.html");
check("side dockers: ▾ folds Settings / References / Assets / Queue / Gallery to a 30 px title strip (the column's own variable), loaded by index.html",
  /ldock: \["c1", "s1"\], refsdock: \["c2", "s2"\], assetsdock: \["c3", "s3"\], qdock: \["c4", "s5"\], rdock: \["c5", "s4"\]/.test(SC) && /const STRIP = 30;/.test(SC) && /writing-mode:vertical-rl/.test(SC) && /static\/sidecollapse\.js/.test(IX));
check("the image editor's dockers: ▾ folds a docked group to its tabs (pc.col), ✕ closes it (pc.closed) - its floating window's ✕ too (onClose); View ▸ Dockers: All Dockers + each one ✓",
  /ca\.className = "pccaret"/.test(PP) && /cx\.className = "pcx"/.test(PP) && /onClose: \(\) => close\(g\)/.test(PP) && /r\.onClose \? r\.onClose\(\) : home\(r\.id\)/.test(FP)
  && /C\("view\.dock\.all", "All Dockers"/.test(PP) && /\{ label: "Dockers", get items\(\)/.test(PP) && /checked: \(\) => visible\(g\)/.test(PP));
check("a docker's ✕ / title buttons sit above its resize grips (the corner grip used to cover ✕)", /\.h3fp-t button,\.tsd>\.tsd-title button[^}]*\{position:relative;z-index:7\}/.test(DF));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
