#!/usr/bin/env node
/* bitGen Studio — 2.867.0 units: 🎛 the element properties docker's helpers (ext/webdock/wbprops.js): colours both ways (hex, rgb(a),
 * see-through), the box shadow read from a computed value and written back, gradients (linear / radial, angle, two stops) both ways;
 * the pick mark never saved (webdock.js syncWys); the wiring. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const P = require(path.join(ROOT, "ext/webdock/wbprops.js")), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
check("colours: #abc, #rrggbbaa, rgb(), rgba(), transparent -> hex + see-through", JSON.stringify([P.color("#abc"), P.color("#11223380"), P.color("rgb(255, 0, 10)"), P.color("rgba(10, 20, 30, 0.5)"), P.color("transparent")]) === JSON.stringify([{ hex: "#aabbcc", a: 1 }, { hex: "#112233", a: 128 / 255 }, { hex: "#ff000a", a: 1 }, { hex: "#0a141e", a: 0.5 }, { hex: "#000000", a: 0 }]));
check("...back: solid = #hex, see-through = rgba()", P.rgba("#102030", 1) === "#102030" && P.rgba("#102030", 0.25) === "rgba(16, 32, 48, 0.25)");
const s = P.shadow("rgba(0, 0, 0, 0.25) 0px 6px 18px 2px, rgb(255, 0, 0) 1px 1px 0px 0px");
check("box shadow from the computed value (the first of several): across, down, blur, spread, colour, see-through; inset found; none = null", s.x === 0 && s.y === 6 && s.blur === 18 && s.spread === 2 && s.hex === "#000000" && s.a === 0.25 && !s.inset && P.shadow("inset 0px 2px 4px 0px rgb(0, 0, 0)").inset && P.shadow("none") === null, s);
check("...written back: inset 0px 6px 18px 2px rgba(…); text shadow has no spread", P.shadowCss(Object.assign({}, s, { inset: true })) === "inset 0px 6px 18px 2px rgba(0, 0, 0, 0.25)" && P.textShadowCss({ x: 1, y: 2, blur: 3, hex: "#fff", a: 1 }) === "1px 2px 3px #ffffff" && P.shadowCss(null) === "none");
const g = P.gradient("linear-gradient(135deg, rgb(79, 124, 255) 10%, rgb(168, 85, 247) 90%)"), r = P.gradient("radial-gradient(circle, rgb(255, 0, 0) 0%, rgba(0, 0, 255, 0.5) 100%)");
check("gradients read: linear (angle, two colours + where they stop), radial (see-through kept); 'to right' = 90°; not one = null", g.type === "linear" && g.angle === 135 && g.c1 === "#4f7cff" && g.s1 === 10 && g.c2 === "#a855f7" && g.s2 === 90 && r.type === "radial" && r.a2 === 0.5 && P.gradient("linear-gradient(to right, #000, #fff)").angle === 90 && P.gradient("url(x.png)") === null, { g, r });
check("...and written: linear-gradient(135deg, #4f7cff 10%, #a855f7 90%), radial-gradient(circle, …)", P.gradientCss(g) === "linear-gradient(135deg, #4f7cff 10%, #a855f7 90%)" && P.gradientCss(r) === "radial-gradient(circle, #ff0000 0%, rgba(0, 0, 255, 0.5) 100%)");
const J = src("ext/webdock/wbprops.js"), Wj = src("ext/webdock/webdock.js"), E = JSON.parse(src("ext/webdock/ext.json")), D = src("ext/webdock/dock.html");
check("every corner its own (border-top-left / top-right / bottom-right / bottom-left-radius) + 🔗 all four; opacity, background colour / picture / gradient, shadow, text", ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"].every((p) => J.includes(`"${p}"`)) && /wbP_rlink/.test(J) && /set\("opacity"/.test(J) && /set\("background-image", layers\.join/.test(J) && /set\("box-shadow"/.test(J) && /set\("text-shadow"/.test(J));
check("the pick mark (data-bg-picked) is taken off before the page is saved; H3Web.markWys", /querySelectorAll\("\[data-bg-picked\]"\)\.forEach\(\(x\) => x\.removeAttribute\("data-bg-picked"\)\)/.test(Wj) && /function markWys\(\)/.test(Wj));
check("wiring: wbprops.js loaded; the docker's styles (folds to a strip)", E.scripts.includes("wbprops.js") && /#wbProps\.shut/.test(D));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
