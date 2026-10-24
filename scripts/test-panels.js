#!/usr/bin/env node
/* bitGen Studio — 2.438.0 units: FLOATING / NAMED DOCKERS (static/floatpanels.js, ext/imageeditdock/pcpanels.js),
 * DIALOGS IN THE MIDDLE / WHERE THEY WERE LEFT (static/dlglayout.js), the layout files (lib/layoutCfg.js,
 * routes/layout.js), 🧰 confined to the timeline docker (stagedock.js / tlfloat.js), Shift+Del. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const FP = require(path.join(ROOT, "static", "floatpanels.js"));
const DL = require(path.join(ROOT, "static", "dlglayout.js"));
const LC = require(path.join(ROOT, "lib", "layoutCfg.js"));

/* ---- floatpanels: pure */
check("fit: a window moved inside its docker (and made smaller only when it must)", JSON.stringify(FP.fit({ x: -50, y: 10, w: 500, h: 300 }, { left: 0, top: 0, right: 400, bottom: 200 })) === '{"x":0,"y":0,"w":400,"h":200}'
  && JSON.stringify(FP.fit({ x: 350, y: 150, w: 100, h: 120 }, { left: 0, top: 0, right: 400, bottom: 200 })) === '{"x":240,"y":80,"w":160,"h":120}');
const ds = [{ id: "a", rect: { left: 0, top: 0, right: 100, bottom: 100 }, z: 1 }, { id: "b", rect: { left: 50, top: 50, right: 150, bottom: 150 }, z: 2 }];
check("hitDocker: the named docker under the pointer - the one on top where two overlap, none outside", FP.hitDocker(10, 10, ds) === "a" && FP.hitDocker(60, 60, ds) === "b" && FP.hitDocker(500, 5, ds) === null);
const par = { b: "a", c: "b" };
check("canDock: never in itself or in a docker that is inside it", !FP.canDock("a", "a", (k) => par[k]) && !FP.canDock("a", "c", (k) => par[k]) && FP.canDock("c", "a", (k) => par[k]) && FP.canDock("x", "a", (k) => par[k]));
check("slug", FP.slug("My  Tools!") === "my-tools" && FP.slug("") === "docker");

/* ---- dlglayout: pure */
const el = (o) => ({ id: o.id || "", getAttribute: (k) => (k === "aria-label" ? o.label || null : null), querySelector: () => (o.h ? { textContent: o.h } : null) });
check("keyOf: a dialog is kept by its id, else its aria-label, else its title; none = not kept", DL.keyOf(el({ id: "notedlg" })) === "#notedlg" && DL.keyOf(el({ label: "Exchange" })) === "@Exchange" && DL.keyOf(el({ h: "  Fill \n" })) === "@Fill" && DL.keyOf(el({})) === null);
check("center: the middle of the window", JSON.stringify(DL.center(200, 100, 1000, 800)) === '{"x":400,"y":350}' && JSON.stringify(DL.center(2000, 100, 1000, 800)) === '{"x":0,"y":350}');
check("clamp: a kept place pulled back on screen when the window is smaller (its title row reachable)", JSON.stringify(DL.clamp({ x: 1500, y: 900 }, 300, 200, 1000, 700)) === '{"x":920,"y":664}' && JSON.stringify(DL.clamp({ x: -500, y: -40 }, 300, 200, 1000, 700)) === '{"x":0,"y":0}');

/* ---- the files */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lay_"));
LC.setBase(tmp);
check("read: nothing yet = {}", JSON.stringify(LC.read("dialog")) === "{}");
LC.merge("dialog", { "#a": { x: 1, y: 2 } }); LC.merge("dialog", { "@b": { x: 3, y: 4 } }); LC.merge("dialog", { "#a": null });
check("merge: dialog_layout.cfg in the install folder, keys added / removed (null)", JSON.stringify(LC.read("dialog")) === '{"@b":{"x":3,"y":4}}' && fs.existsSync(path.join(tmp, "dialog_layout.cfg")));
LC.write("panel", { panels: { p: { state: "float" } }, dockers: {} });
check("write: panel_layout.cfg replaced whole", LC.read("panel").panels.p.state === "float" && fs.existsSync(path.join(tmp, "panel_layout.cfg")));
let threw = ""; try { LC.read("../etc"); } catch (e) { threw += e.status; } try { LC.write("panel", [1]); } catch (e) { threw += "," + e.status; }
fs.writeFileSync(path.join(tmp, "panel_layout.cfg"), "{broken");
check("...another name = 404, not an object = 400, a broken file reads as {}", threw === "404,400" && JSON.stringify(LC.read("panel")) === "{}", threw);
fs.rmSync(tmp, { recursive: true, force: true });

/* ---- the wiring */
const IX = read("static", "index.html"), IDX = read("routes", "index.js"), UI = read("ext", "imageeditdock", "pcui.js"), IE = read("ext", "imageeditdock", "imageedit.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts;
check("routes/layout.js mounted from routes/index.js (server.js untouched); the page loads dlglayout.js + floatpanels.js", /require\("\.\/layout"\)\.mount\(app\)/.test(IDX) && !/layoutCfg|floatpanels/.test(read("misc/server.js"))
  && IX.includes('<script src="/static/dlglayout.js"></script>') && IX.includes('<script src="/static/floatpanels.js"></script>'));
check("the editor: pcpanels after pcpattern, installed; its dialogs fixed in the middle of the screen (dragged in screen coordinates)", EXT.indexOf("pcpanels.js") === EXT.indexOf("pcpattern.js") + 1 && /PCPanels\.install\(E\)/.test(IE)
  && /\.kxdlg\{position:fixed;z-index:10060;left:50%;top:50%;transform:translate\(-50%,-50%\)/.test(IE) && /const fixed = win\.getComputedStyle\(d\)\.position === "fixed"/.test(UI));
check("Shift+Del = Delete Layer (the key map lets Shift+Delete through)", /cmd\("layer\.del", "Delete Layer", "Shift\+Delete"/.test(UI) && /a === "Shift\+Delete"\)\) return run/.test(UI));
check("🧰 Tools & Properties confined to the timeline docker (TlStageDock's confine: over the preview row, else under the menu bar; hidden while the docker is collapsed, never for want of room - it shrinks to fit, never leaves the docker)", /confineEl: function \(\) \{ return \$\("timelinedock"\); \}/.test(read("ext", "timelinedock", "tlfloat.js")) && /over its preview canvas row/.test(read("ext", "timelinedock", "tlfloat.js")) && /return \{ hide: true \}/.test(read("ext", "timelinedock", "tlfloat.js")) && /function bounds\(\)/.test(read("ext", "timelinedock", "stagedock.js")) && /F\.style\.visibility = !side && B === "hide" \? "hidden" : ""/.test(read("ext", "timelinedock", "stagedock.js")) && /never hidden just for want of room/.test(read("ext", "timelinedock", "stagedock.js")) && /It never leaves the timeline docker/.test(read("ext", "timelinedock", "tlfloat.js")));
check("⊞ Docker layout: ▣ New docker… + the named dockers to show", /id="dockCfgNew"/.test(read("static", "dockcfg.js")) && /data-fpshow/.test(read("static", "dockcfg.js")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
