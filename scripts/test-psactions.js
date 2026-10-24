#!/usr/bin/env node
/* bitGen Studio — 2.427.0 units: ACTIONS + BATCH
 *   1. pcactions.js pure: what is recorded, the free function keys, the Default Actions (real commands / filters),
 *      normalize (sets from storage / a file), step names and summaries, a dialog's values, batch file names
 *   2. lib/batchStore.js: safe names, PNG / JPEG only (by their bytes), save / runs / list / file
 *   3. the wiring: routes/batch.js mounted from routes/index.js (not server.js), pcui's run / dialog hooks, imageedit's
 *      filter hooks + the Actions tab + the install, ext.json, the commands
 * Tim: "continue with the photoshop gap closure" - the agreed order: 2.427.0 Actions + batch. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };
if (!process.env.H3_E2E) process.env.H3_E2E = "1";
const A = require(path.join(ROOT, "ext", "imageeditdock", "pcactions.js"));

/* ---- 1 */
check("isRecordable: commands that change the picture yes; views, windows, help, tools, undo, file open / save no",
  ["image.size", "layer.dup", "flt.gaussian", "sel.all", "edit.fill", "vl.curves", "type.para"].every(A.isRecordable) && !["view.zoomin", "win.pcLayers", "help.keys", "tool.pen", "edit.undo", "edit.redo", "file.open", "file.save", "theme.pro", "act.batch", ""].some(A.isRecordable));
check("freeKeys: F2… and Shift+F… not taken by the editor's own commands or another action", JSON.stringify(A.freeKeys(["F2", "Shift+F7"], ["F3"]).slice(0, 3)) === '["F4","F9","F11"]' && !A.KEYS.includes("F5") && !A.KEYS.includes("F12") && !A.KEYS.includes("Shift+F5"));
const UIJ = read("ext", "imageeditdock", "pcui.js"), FIL = require(path.join(ROOT, "ext", "imageeditdock", "filters.js"));
const filterIds = new Set((FIL.FILTERS || []).map((f) => f.id));
const def = A.DEFAULT_SETS[0];
check("the Default Actions: 5 actions whose steps are real commands / filters / settings",
  def.actions.length === 5 && def.actions.every((a) => a.steps.every((s) => (s.kind === "cmd" && new RegExp(`"${s.id.replace(".", "\\.")}"`).test(UIJ)) || (s.kind === "filter" && filterIds.has(s.id)) || (s.kind === "set" && ["opacity", "blend"].includes(s.what)))),
  def.actions.map((a) => a.steps.map((s) => s.id || s.what)));
const n = A.normalize([{ name: "S", actions: [{ name: "a", steps: [{ kind: "cmd", id: "x" }, { kind: "bogus" }, { kind: "set", what: "opacity", value: 3, on: false }, null], key: "F8" }, { nope: 1 }] }, { foo: 1 }, null]);
check("normalize: bad sets / actions / steps dropped, steps default on, keys kept", n.length === 1 && n[0].actions.length === 1 && n[0].actions[0].steps.length === 2 && n[0].actions[0].steps[0].on === true && n[0].actions[0].steps[1].on === false && n[0].actions[0].key === "F8", n);
check("stepLabel / summary: names from the command / filter, settings in a few words",
  A.stepLabel({ kind: "cmd", id: "image.size" }, () => "Image Size…") === "Image Size" && A.stepLabel({ kind: "set", what: "blend" }) === "Set Blend Mode" && A.stepLabel({ kind: "stop", msg: "hi" }) === "Stop: hi"
  && A.summary({ kind: "set", what: "opacity", value: 40 }) === "40 %" && A.summary({ kind: "cmd", dialog: { values: { pdW: "200", pdLock: true } } }) === "W: 200, Lock: on" && A.summary({ kind: "filter", params: { radius: 4 } }) === "radius: 4",
  A.summary({ kind: "cmd", dialog: { values: { pdW: "200", pdLock: true } } }));
check("captureFrom: inputs / selects by id (checkboxes true / false), buttons and nameless ones skipped",
  JSON.stringify(A.captureFrom([{ id: "a", type: "number", value: "5" }, { id: "b", type: "checkbox", checked: true }, { id: "", type: "text", value: "x" }, { id: "c", type: "button", value: "OK" }, { id: "d", tagName: "SELECT", value: "multiply" }])) === '{"a":"5","b":true,"d":"multiply"}');
check("fileName: the picture's name + the suffix + the format's extension, odd characters out", A.fileName("My Photo.JPG", "-v2", "png") === "My Photo-v2.png" && A.fileName("a/b?c.png", "", "jpg") === "a_b_c.jpg" && A.fileName("", "-x", "png") === "picture-x.png");

/* ---- 2 */
(async () => {
  const core = require(path.join(ROOT, "lib", "core")), st = require(path.join(ROOT, "lib", "batchStore"));
  const PN = "zz_psactions427_" + process.pid, orig = core.getProject();
  core.ensureProject(PN); core.setProject(PN);
  const pd = core.projDir(PN);
  try {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"), jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);
    check("kindOf: PNG / JPEG by their bytes, anything else null", st.kindOf(png) === "png" && st.kindOf(jpg) === "jpg" && st.kindOf(Buffer.from("GIF89a....")) === null && st.kindOf(Buffer.alloc(2)) === null);
    check("safeRun / safeName: stay in their folder; the extension from the bytes", st.safeRun("../../x y") === "x y" && st.safeRun("") === "batch" && st.safeName("../a/b.jpeg", "png") === "b.png" && st.safeName("c", "jpg") === "c.jpg");
    check("save refuses empty / not a picture", throws(() => st.save("r", "a.png", Buffer.alloc(0)), /empty/) && throws(() => st.save("r", "a.png", Buffer.from("hello world")), /not a PNG or JPEG/));
    const a = st.save("run 1", "one.png", png), b = st.save("run 1", "two.png", jpg);
    check("save -> projects/<p>/batch/<run>/<name> (a JPEG named .png becomes .jpg)", a.name === "one.png" && b.name === "two.jpg" && fs.existsSync(path.join(pd, "batch", "run 1", "one.png")) && fs.existsSync(path.join(pd, "batch", "run 1", "two.jpg")), [a, b]);
    check("runs / list / file", st.runs().some((r) => r.run === "run 1" && r.files === 2) && st.list("run 1").map((f) => f.name).join() === "one.png,two.jpg" && st.file("run 1", "one.png") === path.join(pd, "batch", "run 1", "one.png")
      && throws(() => st.file("run 1", "nope.png"), /not in that batch/) && throws(() => st.file("run 1", "x.txt"), /not a batch picture/));
  } finally { core.setProject(orig); fs.rmSync(pd, { recursive: true, force: true }); }

  /* ---- 3 */
  const idx = read("routes", "index.js"), rt = read("routes", "batch.js"), IE = read("ext", "imageeditdock", "imageedit.js"), EXT = JSON.parse(read("ext", "imageeditdock", "ext.json")).scripts, AJ = read("ext", "imageeditdock", "pcactions.js");
  check("routes/batch.js mounted from routes/index.js (server.js untouched): save (raw), runs, list, file", /require\("\.\/batch"\)\.mount\(app\)/.test(idx) && !/batch/.test(read("misc/server.js").match(/require\([^)]*\)/g).join())
    && /app\.post\("\/api\/batch\/save", express\.raw/.test(rt) && /app\.get\("\/api\/batch\/runs"/.test(rt) && /app\.get\("\/api\/batch\/list"/.test(rt) && /app\.get\("\/api\/batch\/file\/:run\/:name"/.test(rt));
  check("pcui: run() tells the recorder (onRun / onRunDone); dialogs tell it when they open, OK, Cancel; the Actions tab",
    /if \(E\.ui\.onRun\) \{ try \{ E\.ui\.onRun\(id\); \}/.test(UIJ) && /if \(E\.ui\.onDialog\) \{ try \{ E\.ui\.onDialog\(d, title\); \}/.test(UIJ) && /if \(E\.ui\.onDialogOk\) E\.ui\.onDialogOk\(d, title\);/.test(UIJ) && /if \(E\.ui\.onDialogCancel\) E\.ui\.onDialogCancel\(d, title\);/.test(UIJ)
    && /\["pcActions", "Actions"\]/.test(UIJ) && /if \(id === "pcActions" && E\.ui\.actions\) E\.ui\.actions\(\);/.test(UIJ));
  check("imageedit: a filter tells E.onFilterDone (OK and straight on) / onFilterCancel; the Actions tab body; installed; ext.json pcactions before imageedit.js",
    (IE.match(/if \(E\.onFilterDone\) E\.onFilterDone\(id, D\.clone\(params\)\);/g) || []).length === 2 && /if \(E\.onFilterCancel\) E\.onFilterCancel\(id\);/.test(IE) && /\$\{tab\("layers", "pcActions", "Actions"\)\}/.test(IE)
    && /data-body="pcActions" id="pcActions"/.test(IE) && /win\.PCActions\.install\(E\)/.test(IE) && EXT.indexOf("pcactions.js") > 0 && EXT.indexOf("pcactions.js") < EXT.indexOf("imageedit.js"));
  check("pcactions: Window ▸ Actions (Alt+F9), File ▸ Automate: Batch…, Insert Stop / Menu Item, Duplicate, Button Mode, Load / Save / Reset, Play, Record",
    ["win.pcActions\", \"Actions\", \"Alt+F9\"", "act.batch\", \"Automate: Batch…\"", "act.stop\", \"Actions: Insert Stop…\"", "act.item\", \"Actions: Insert Menu Item…\"", "act.dup\"", "act.buttons\"", "act.load\"", "act.save\"", "act.reset\"", "act.play\"", "act.record\""].every((k) => AJ.includes(k)));
  check("...played dialogs are filled and the fields the user changed are typed again in order (a following field works itself out)", /function fill\(d, values, changed\)/.test(AJ) && /const order = Array\.isArray\(changed\) \? changed : Object\.keys\(vals\);/.test(AJ));
  check("...the batch saves to /api/batch/save, the gallery or a download; its progress box is its own (not a pcui dialog a step would close)", /\/api\/batch\/save\?run=/.test(AJ) && /E\.saveToImages\(blob, out\)/.test(AJ) && /prog\.className = "kxdlg actprog"/.test(AJ));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
