#!/usr/bin/env node
/* bitGen Studio — 2.891.0 units. Tim (verbatim): "pan 2 is meant to submit the prompt in json format, can we format the prompt
 * automatically, please fix the save docker layout button. when saving a layout, save the size position and status(minimized,
 * maximized and normal) of all dockers. bitgen crashed again until i reset the dockers and cache".
 *   ⊞ Save layout: a docker's / floating window's status (pure), the steps to reach a saved one, docker.cfg keeping EVERY docker
 *   (+ the named dockers) cleaned, the message painted after the panel (it was wiped), Load by hand applying it all;
 *   the crash recovery: electron/recover.js plan (a new version / a start that did not come up = caches; two in a row / Reset =
 *   + the dockers), the layout files moved with a backup (lib/layoutRescue.js), the page's storage saved + cleared
 *   (static/safelayout.js), the desktop app's wiring; PAN 2's JSON written into the prompt box. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---- ⊞ Save layout
const D = require("../static/dockcfg.js"), C = require("../lib/dockerCfg");
check("statusOf: hidden / maximized / minimized (collapsed or minned) / normal from a docker's classes",
  D.statusOf("bdock dockgone collapsed") === "hidden" && D.statusOf("bdock maxed") === "maximized" && D.statusOf("bdock collapsed") === "minimized"
  && D.statusOf("bdock minned") === "minimized" && D.statusOf("bdock") === "normal");
check("floatStatus: not shown = hidden, sf-max = maximized, sf-min = minimized, else normal",
  D.floatStatus(false, "sf-max") === "hidden" && D.floatStatus(true, "df-float sf-max") === "maximized" && D.floatStatus(true, "sf-min") === "minimized" && D.floatStatus(true, "df-float") === "normal");
check("stepsTo: the toggles that reach a saved status (show opens a collapsed docker first; unmax before collapse)",
  JSON.stringify(D.stepsTo("hidden", "minimized")) === '["show","collapse"]' && JSON.stringify(D.stepsTo("maximized", "minimized")) === '["unmax","collapse"]'
  && JSON.stringify(D.stepsTo("minimized", "normal")) === '["open"]' && JSON.stringify(D.stepsTo("normal", "hidden")) === '["hide"]'
  && JSON.stringify(D.stepsTo("hidden", "maximized")) === '["show","max"]' && D.stepsTo("normal", "normal").length === 0);
const all = { docks: { maildock: { status: "hidden", h: 0, w: 0 }, musicdock: { status: "minimized", h: 30, w: 900 }, sketcher: { status: "weird" }, "bad id!": { status: "normal" } },
  floats: { basic: { status: "maximized", x: 10, y: 40, w: 1200, h: 900 }, negprompt: { status: "minimized", x: 5, y: 5, w: 300, h: 40 } },
  named: { panels: { "ie.layers": { state: "float", x: 300, y: 120, w: 280, h: 400 } }, dockers: { "fd-1": { state: "float", shown: true, x: 50, y: 60, w: 500, h: 400, name: "Mine" } } } };
const ca = C.cleanAll(all);
check("docker.cfg keeps EVERY docker's status + size, the floating windows' status + place, the named dockers / panels; junk dropped",
  ca.docks.maildock.status === "hidden" && ca.docks.musicdock.h === 30 && !ca.docks.sketcher && !ca.docks["bad id!"]
  && ca.floats.basic.status === "maximized" && ca.floats.basic.w === 1200 && ca.floats.negprompt.status === "minimized"
  && ca.named.panels["ie.layers"].state === "float" && ca.named.dockers["fd-1"].shown === true, ca);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "d891-"));
const sv = C.save(tmp, { open: ["musicdock", "previewdock"], window: { w: 1920, h: 1080 }, col: { h: 900 }, docks: {}, all });
const back = C.load(tmp).configs[sv.key].variants[0];
check("save + load: the variant has `all` (it was cut by the cleaner before)", sv.key === "musicdock+previewdock" && back.all && back.all.floats.basic.status === "maximized" && back.all.docks.maildock.status === "hidden", back.all);
const DC = src("static/dockcfg.js");
check("Save layout: the panel is painted BEFORE the message (painting after wiped it - the save looked like nothing), ✓ Saved / ✕ Not saved on the button",
  /paint\(\);\s*\n\s*var a = s\.all/.test(DC) && /✓ Saved/.test(DC) && /✕ Not saved/.test(DC) && !/say\("saved: "[^\n]*\n\s*paint\(\); return j;/.test(DC));
check("the snapshot holds every .bdock, every floating window and the named dockers; Load by hand applies it (an automatic load only sizes)",
  /document\.querySelectorAll\("\.bdock\[id\]"\)/.test(DC) && /SF\.windows/.test(DC) && /H3Panels\.snapshot/.test(DC) && /by hand\/\.test\(String\(why/.test(DC)
  && /H3Panels\.applySnapshot/.test(DC) && /applySnapshot/.test(src("static/floatpanels.js")) && /H3Panels\.flush/.test(src("static/layouts.js")));

// ---- crash recovery
const RC = require("../electron/recover.js");
const p0 = RC.plan({}, "2.891.0"), p1 = RC.plan({ version: "2.890.0", pending: false }, "2.891.0"), p2 = RC.plan({ version: "2.891.0", pending: true, fails: 0 }, "2.891.0");
const p3 = RC.plan({ version: "2.891.0", pending: true, fails: 1 }, "2.891.0"), p4 = RC.plan({ version: "2.891.0", force: true }, "2.891.0"), p5 = RC.plan({ version: "2.891.0", gpu: true }, "2.891.0");
check("recover.plan: a first start = nothing; a new version = the caches; one start that did not come up = the caches; two in a row = + the dockers (count reset); Reset = both; a GPU crash = the caches",
  p0.acts.length === 0 && JSON.stringify(p1.acts) === '["caches"]' && JSON.stringify(p2.acts) === '["caches"]' && p2.fails === 1
  && p3.acts.includes("layout") && p3.fails === 0 && p4.acts.includes("layout") && p4.acts.includes("caches") && JSON.stringify(p5.acts) === '["caches"]'
  && p0.state.pending === false && p0.state.force === false, { p0, p1, p2, p3, p4, p5 });
const ud = fs.mkdtempSync(path.join(os.tmpdir(), "ud891-"));
for (const c of ["GPUCache", "Code Cache", "Cache", "Local Storage"]) fs.mkdirSync(path.join(ud, c), { recursive: true });
const gone = RC.clearCaches(ud);
check("clearCaches: the GPU / code / HTTP caches go, the browser storage stays", gone.includes("GPUCache") && gone.includes("Code Cache") && gone.includes("Cache")
  && !fs.existsSync(path.join(ud, "GPUCache")) && fs.existsSync(path.join(ud, "Local Storage")), gone);
const fakeApp = { getPath: () => ud };
const base = fs.mkdtempSync(path.join(os.tmpdir(), "base891-"));
fs.mkdirSync(path.join(base, "lib")); fs.copyFileSync(path.join(ROOT, "lib/layoutRescue.js"), path.join(base, "lib/layoutRescue.js"));
fs.writeFileSync(path.join(base, "docker_status.json"), "{}"); fs.writeFileSync(path.join(base, "panel_layout.cfg"), "{}");
RC.write(ud, { version: "2.891.0", pending: true, fails: 1 });
const st = RC.start(fakeApp, base, "2.891.0");
check("recover.start after two starts that did not come up: the layout files moved to backups/layout-auto-…, the page opens safe, the state cleared",
  st.safe && st.moved.join() === "docker_status.json,panel_layout.cfg" && fs.existsSync(path.join(st.dir, "why.txt")) && !fs.existsSync(path.join(base, "docker_status.json"))
  && RC.read(ud).pending === false && /layout/.test(fs.readFileSync(path.join(base, "logs", "electron-crash.log"), "utf8")), st);
RC.arm(fakeApp); const armed = RC.read(ud).pending; RC.booted(fakeApp);
check("arm (the main window opens) = pending until booted (the page came up)", armed === true && RC.read(ud).pending === false && RC.read(ud).fails === 0);
RC.requestReset(fakeApp); check("requestReset = the next start resets", RC.read(ud).force === true && RC.plan(RC.read(ud), "2.891.0").acts.includes("layout"));
const LR = require("../lib/layoutRescue");
fs.writeFileSync(path.join(base, "docker.cfg"), "{}");
const rr = LR.rescue(base, { files: true, storage: { "h3.g.timelinedock": "1", "bg.helpLang": "ja" }, why: "test" });
check("layoutRescue.rescue: the layout files moved + the page's storage written as local-storage.json in the same backup",
  rr.moved.join() === "docker.cfg" && /^backups[\\/]layout-auto-/.test(rr.dir) && JSON.parse(fs.readFileSync(path.join(base, rr.dir, "local-storage.json"), "utf8"))["h3.g.timelinedock"] === "1", rr);
check("safelayout.keepKeys: the language kept through a reset, the docker memory not", JSON.stringify(require("../static/safelayout.js").keepKeys({ "bg.helpLang": "ja", "h3.g.x": "1" })) === '{"bg.helpLang":"ja"}');
const MJ = src("electron/main.js"), PJ = src("electron/preload.js"), IX = src("static/index.html"), RI = src("routes/index.js");
check("wired: main.js runs recover.start before ready, watches the window (crash / freeze boxes), arms it, opens ?safe-layout=1 when reset; h3:booted / h3:resetLayout; preload exposes booted + resetLayout",
  /recover\.start\(app, ROOT/.test(MJ) && /recover\.watch\(/.test(MJ) && /recover\.arm\(app\)/.test(MJ) && /\?safe-layout=1/.test(MJ) && /h3:booted/.test(MJ) && /h3:resetLayout/.test(MJ)
  && /booted: \(\) => ipcRenderer\.invoke\("h3:booted"\)/.test(PJ) && /resetLayout: \(\) => ipcRenderer\.invoke\("h3:resetLayout"\)/.test(PJ));
check("wired: safelayout.js is the page's first script; /api/layout/rescue mounted before the 100 KB json parser; Settings ▸ Dockers has 🧯 Reset; nothing in misc/server.js",
  IX.indexOf('<script src="/static/safelayout.js">') > 0 && IX.indexOf('<script src="/static/safelayout.js">') < IX.indexOf('<script src="/static/themes.js">')
  && RI.indexOf('require("./layoutRescue").mount(app)') > 0 && RI.indexOf('require("./layoutRescue").mount(app)') < RI.indexOf("app.use(express.json());")
  && /lyReset/.test(src("static/layouts.js")) && !/layoutRescue|recover/.test(src("misc/server.js")));

// ---- PAN 2's JSON in the prompt box
const PG = src("static/pan2gen.js"), RP = src("routes/pan2.js");
check("PAN 2: { } JSON writes the caption into the prompt box (pretty), Generate formats plain words first and sends the JSON; the caption route takes a first picture + pretty",
  /id = "pan2Fmt"/.test(PG) && /if \(!isJson\(text\)\) \{ text = await format\(text\); if \(!text\) return null; \}/.test(PG) && /box\.value = out/.test(PG)
  && /fd\.append\("pretty", "1"\)/.test(PG) && /app\.post\("\/api\/pan2\/caption", upload\.fields/.test(RP) && /JSON\.stringify\(JSON\.parse\(r\.caption\), null, 2\)/.test(RP));
const P = require("../lib/pan2");
const pretty = JSON.stringify(P.wrap("a kite", 10), null, 2);
check("a pretty (indented) caption in the prompt box is taken as the caption as it is", !!P.parseCaption(pretty) && P.check(P.ordered(P.parseCaption(pretty)), 10).length === 0);

for (const d of [tmp, ud, base]) fs.rmSync(d, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
