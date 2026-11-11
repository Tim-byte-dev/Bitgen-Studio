#!/usr/bin/env node
/* bitGen Studio — 2.724.0: ONE ORDER FOR EVERY FLOATING DIALOG, THE ONE USED LAST ON TOP (static/floatz.js) - pure + wiring.
 * Tim (verbatim): "the community dialog is going behind the custom dialog, give floating dialogs the highest z-index's"
 *   the band (60, above the docked app / status bar / the image editor's full screen / voice chat's old 50; below the
 *   corner player 200, the menu bar 300, menus and message boxes), zFor (capped), order (moved to the top, the rest kept,
 *   no longer floating dropped), the selectors, and the wiring: loaded before the docker scripts, SecFloat's windows
 *   (💬 Community, Basic Settings, LLM tokens) and the ▣ / floated main dockers all go through H3FloatZ.raise, their CSS
 *   in the band. The real browser: scripts/test-ui724-ui.js. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const Z = require(path.join(ROOT, "static", "floatz.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

check("BAND: 60 up to 199", Z.BAND.base === 60 && Z.BAND.cap === 199, Z.BAND);
check("zFor: the lowest raised one 61, then one more each, never past 199 (junk = the lowest)", Z.zFor(0) === 61 && Z.zFor(3) === 64 && Z.zFor(1000) === 199 && Z.zFor(-4) === 61 && Z.zFor("x") === 61);
check("order: the pressed one moves to the top, the rest keep their order", JSON.stringify(Z.order(["a", "b", "c"], "a")) === JSON.stringify(["b", "c", "a"]) && JSON.stringify(Z.order(["a", "b"], "c")) === JSON.stringify(["a", "b", "c"]));
check("…ones no longer floating (keep() false) drop out; an empty / missing order starts one", JSON.stringify(Z.order(["a", "b", "c"], "c", (x) => x !== "a")) === JSON.stringify(["b", "c"]) && JSON.stringify(Z.order(null, "z")) === JSON.stringify(["z"]));
check("SEL: ▣ / floated main dockers, the ⊞ named dockers floating over the app (body > .h3fp), SecFloat's windows (Community, Basic Settings, LLM tokens) floating, 2.763.5: a confined named docker (.h3fp-dk), the stage docker not docked, voice chat - not the prompt docker",
  JSON.stringify(Z.SEL) === JSON.stringify([".h3fp.dg-app", "body > .h3fp", ".h3fp.h3fp-dk", ".secfloat.df-float", ".tsd:not(.docked)", "#vcPanel"]) && !Z.SEL.some((s) => /promptdock/.test(s)));

const H = rd("static/index.html");
const zOf = (re) => { const m = H.match(re); return m ? +m[1] : null; };
const mb = zOf(/#dockCfgPanel \{[^}]*?z-index: ?(\d+)/), sb = zOf(/#statusbar \{[^}]*?z-index: ?(\d+)/);
check("the band sits above the status bar and below the menu bar's ⊞ Docker configs panel (300, index.html)", sb !== null && mb !== null && sb < Z.BAND.base && Z.BAND.cap < mb, { sb, mb });
check("…and above the image editor's full screen (46), below the corner video player (200) and the prompt's lift (9500)",
  /z-index:46;/.test(rd("ext/imageeditdock/imageedit.js")) && /position:fixed;right:16px;bottom:16px;width:320px;z-index:200;/.test(H) && /const FRONT_Z = 9500;/.test(rd("static/promptfront.js")) && Z.BAND.cap < 200);
const iz = H.indexOf('<script src="/static/floatz.js"></script>'), idf = H.indexOf('<script src="/static/dockfloat.js"></script>'), isf = H.indexOf('<script src="/static/secfloat.js"></script>'), idg = H.indexOf('<script src="/static/dockgroup.js"></script>');
check("index.html loads floatz.js before dockfloat / secfloat / dockgroup", iz > 0 && iz < idf && iz < isf && iz < idg, { iz, idf, isf, idg });
const SF = rd("static/secfloat.js");
check("SecFloat: a floating window starts in the band (60); front() = H3FloatZ.raise (shown, pressed, floated)",
  /\.secfloat\.df-float\{position:fixed;z-index:60;/.test(SF) && /if \(window\.H3FloatZ\) \{ window\.H3FloatZ\.raise\(W\[id\]\.el\); return; \}/.test(SF) && !/\? 49 : 47/.test(SF));
const DG = rd("static/dockgroup.js"), G = require(path.join(ROOT, "static", "dockgroup.js"));
check("▣ dockers + floated main dockers: CSS in the band (Z 60 / 61), a press raises it in H3FloatZ, shown (Ctrl+Alt+D, its button) = on top",
  G.Z.base === 60 && G.Z.front === 61 && /w\.classList\.add\("dg-front"\); if \(root\.H3FloatZ\) root\.H3FloatZ\.raise\(w\);/.test(DG) && /if \(want && root\.H3FloatZ\) \{ const g = p\.get\(id\); if \(g && g\.win\) root\.H3FloatZ\.raise\(g\.win\); \}/.test(DG));
check("the stage docker and the voice chat start in the band too (60)", /\.tsd\{position:fixed;z-index:60;/.test(rd("ext/timelinedock/stagedock.js")) && /max-height:80vh;z-index:60;/.test(rd("static/voicechat.js")));
const FP = rd("static/floatpanels.js");
check("the ⊞ named dockers (static/floatpanels.js): one floating over the app starts in the band (body>.h3fp 60 - was 9300, THE BUG), 2.763.5: a confined one in the band too (.h3fp.h3fp-dk 60); floated / shown = raised (not while the layout is put back); zoned = dropped",
  /const CSS = "body>\.h3fp\{z-index:60\}\.h3fp\{position:fixed;z-index:9300;/.test(FP) && /\+ "\.h3fp\.h3fp-dk\{z-index:60\}"/.test(FP) && /w\.className = "h3fp off" \+ \(r\.kind === "docker" \? " h3fp-dk" : ""\)/.test(FP) && /if \(!restoring && root\.H3FloatZ\) root\.H3FloatZ\.raise\(r\.win\);/.test(FP)
  && /keepRect\(r\); if \(root\.H3FloatZ\) root\.H3FloatZ\.raise\(r\.win\); \}/.test(FP) && /classList\.add\("h3fp-zoned"\); body\.appendChild\(r\.win\); if \(root\.H3FloatZ\) root\.H3FloatZ\.drop\(r\.win\);/.test(FP));
const FZ = rd("static/floatz.js");
check("the page part: any press or focus inside a floating dialog raises it (capture); it and the dialogs it floats in; docked ones (not position fixed) left alone",
  /addEventListener\("pointerdown", \(e\) => \{ raise\(e\.target\); \}, true\)/.test(FZ) && /addEventListener\("focusin", \(e\) => \{ raise\(e\.target\); \}, true\)/.test(FZ)
  && /getComputedStyle\(w\)\.position === "fixed"/.test(FZ) && /out\.unshift\(w\)/.test(FZ));
check("docking clears a float's z (static/dockfloat.js) - it leaves the order", /el\.style\.zIndex = "";/.test(rd("static/dockfloat.js")));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
