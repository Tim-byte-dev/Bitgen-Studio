#!/usr/bin/env node
/* bitGen Studio — 2.435.0 units: SAVED THEMES (lib/themeStore.js, routes/themes.js, static/themes.js) and the PDF
 * save's EMBED FONTS (lib/fontFiles.js, routes/fonts.js, static/vendor/fontkit, ext/imageeditdock/pcpdf.js).
 * Tim: "allow user to save/load themes (save themes to themes\theme name.json) . Give user option to embed fonts into
 * pdf in the save dialog". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const TS = require(path.join(ROOT, "lib", "themeStore.js"));
const FF = require(path.join(ROOT, "lib", "fontFiles.js"));
const T = require(path.join(ROOT, "static", "themes.js"));

/* ---- the theme files */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "themes_"));
TS.setBase(tmp);
check("safeName: a file name that stays in themes/ (no path, no odd characters, no .json twice)", TS.safeName("../../etc/x") === "etc_x" && TS.safeName("My Dark.json") === "My Dark" && TS.safeName("  a   b ") === "a b" && TS.safeName("") === "");
const cl = TS.clean({ base: "nope", vars: { panel: "#ABCDEF", ink: "red", evil: "#000000" }, accent: "#12", scale: 400 }, "x");
check("clean: known colours only (lower-case hex), a known base (else dark), the accent only when a colour, the UI size 60 - 175",
  JSON.stringify(cl.vars) === '{"panel":"#abcdef"}' && cl.base === "dark" && cl.accent === "" && cl.scale === 175);
const sv = TS.save("My Dark", { base: "slate", vars: { panel: "#112233", ink: "#000000" }, accent: "#FF0000", scale: 120 });
const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, "themes", "My Dark.json"), "utf8"));
check("save -> themes/<name>.json (pretty JSON), the record back", sv.file === "My Dark.json" && onDisk.base === "slate" && onDisk.vars.panel === "#112233" && onDisk.accent === "#ff0000" && onDisk.scale === 120);
TS.save("A light one", { base: "light", vars: { panel: "#ffffff" } });
fs.writeFileSync(path.join(tmp, "themes", "broken.json"), "{nope");
check("list: by name, the broken file skipped", TS.list().map((t) => t.name).join() === "A light one,My Dark");
check("read / the same name replaces / remove", TS.read("My Dark").vars.ink === "#000000" && TS.save("My Dark", { vars: { ink: "#111111" } }).vars.ink === "#111111" && TS.list().length === 2
  && TS.remove("My Dark").removed === true && TS.remove("My Dark").removed === false && TS.list().length === 1);
let threw = ""; try { TS.save("", { vars: { ink: "#000000" } }); } catch (e) { threw += e.status; } try { TS.save("x", { vars: {} }); } catch (e) { threw += "," + e.status; } try { TS.read("none"); } catch (e) { threw += "," + e.status; }
check("...no name / no colours = 400, a missing one = 404", threw === "400,400,404", threw);
fs.rmSync(tmp, { recursive: true, force: true });

/* ---- the page's theme maths */
check("effective: the theme's colours, the user's changes, the accent", T.effective("dark", "#00ff00", { panel: "#010203" }).panel === "#010203" && T.effective("dark", "#00ff00", {}).tiger === "#00ff00" && T.effective("light", "", null).panel === "#ffffff");
check("varsFor: + the user's changes (on --x and --th-x)", T.varsFor("dark", "", { ink: "#000001" })["--ink"] === "#000001" && T.varsFor("dark", "", { ink: "#000001" })["--th-ink"] === "#000001");
check("fromSaved: a saved record -> the base, only the colours that differ, the accent, the size, the name",
  JSON.stringify(T.fromSaved({ name: "N", base: "light", vars: { panel: "#ffffff", ink: "#000000" }, accent: "#AA0000", scale: 50 })) === '{"theme":"light","accent":"#aa0000","vars":{"ink":"#000000"},"scale":60,"name":"N"}');

/* ---- the font files */
const list = [{ file: "a.ttf", family: "Foo Sans", tfamily: "", bold: false, italic: false, weight: 400 }, { file: "b.ttf", family: "Foo Sans", tfamily: "", bold: true, italic: false, weight: 700 },
  { file: "c.ttf", family: "Foo Sans", tfamily: "", bold: true, italic: true, weight: 700 }, { file: "d.ttf", family: "Foo Sans Light", tfamily: "Foo Sans", bold: false, italic: false, weight: 300 }];
check("pick: the family (any case / spacing, a PDF's ABCDEF+ prefix dropped), then the closest style; another family = none",
  FF.pick(list, "foosans", true, false).file === "b.ttf" && FF.pick(list, "ABCDEF+Foo Sans", true, true).file === "c.ttf" && FF.pick(list, "Foo Sans", false, false).file === "a.ttf" && FF.pick(list, "Bar", false, false) === null);
check("dirs: Windows (WINDIR\\Fonts + the user's), macOS, Linux font folders + the install's fonts folder", (() => { const d = FF.dirs().join("|"); return /Library\/Fonts/.test(d) && /share\/fonts/.test(d) && d.includes(path.join(ROOT, "fonts")); })());
const ix = FF.index();
if (ix.length) {
  const one = ix[0], nm = FF.readNames(fs.readFileSync(one.file));
  check("readNames on a real font file of this computer: its family, its style bits (" + path.basename(one.file) + ")", !!nm && nm.family === one.family && typeof nm.bold === "boolean");
} else check("readNames: no font files on this computer - skipped", true);
check("readNames: not a font = null", FF.readNames(Buffer.from("hello world, not a font file")) === null);

/* ---- the wiring */
const IDX = read("routes", "index.js"), PDF = read("ext", "imageeditdock", "pcpdf.js"), IX = read("static", "index.html");
check("routes/themes.js + routes/fonts.js mounted from routes/index.js (server.js untouched)", /require\("\.\/themes"\)\.mount\(app\)/.test(IDX) && /require\("\.\/fonts"\)\.mount\(app\)/.test(IDX) && !/themeStore|fontFiles/.test(read("misc/server.js")));
check("fontkit vendored (MIT) - no internet", fs.existsSync(path.join(ROOT, "static", "vendor", "fontkit.umd.min.js")) && /MIT License/.test(read("static", "vendor", "LICENSE-fontkit.txt")) && /loadScript\("\/static\/vendor\/fontkit\.umd\.min\.js"/.test(PDF));
check("pcpdf: the Save dialog (Save PDF… / Save as New PDF…) with Embed fonts (kept: pdf.embed); toBytes(opts.embed) embeds the font (subset) when it has every letter, else the standard font / the picture",
  /function saveDialog\(asNew\)/.test(PDF) && /id="pfEmb"/.test(PDF) && /store\.set\("pdf\.embed", e\)/.test(PDF) && /(out|target)\.registerFontkit\(fk\)/.test(PDF) && /(out|target)\.embedFont\(new Uint8Array\(await r\.arrayBuffer\(\)\), \{ subset: true \}\)/.test(PDF) && /if \(cf && covers\(cf, L\.text\.str\)\)/.test(PDF));
check("Settings ▸ Themes: Customize (#s_thcustom), the name + 💾 Save theme / ⤓ Export / ⤒ Import, the saved cards (#s_thsaved)", ["s_thcustom", "s_threset", "s_thname", "s_thsave", "s_thexport", "s_thimport", "s_thfile", "s_thsaved", "s_thmsg"].every((id) => IX.includes(`id="${id}"`)));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
