#!/usr/bin/env node
/* bitGen Studio — 2.559.0 units: folder filters remember their folder (static/folderfilter.js, folder_filters.cfg) and
 * Basic Settings are kept in basic.cfg (static/basiccfg.js, lib/layoutCfg.js, GET / POST /api/layout/<name>).
 * Tim: "when user selects a folder to filter remember the folder selection until changed for all folder select dropdowns.
 * keep basic settings in a file basic.cfg and edit and save when basic settings are changed". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const FM = require(path.join(ROOT, "static", "folderfilter.js"));
const BC = require(path.join(ROOT, "static", "basiccfg.js"));
const LC = require(path.join(ROOT, "lib", "layoutCfg.js"));

/* 1 folder memory */
check("pick: the kept folder when the list still has it; gone / never kept -> the fallback (All)",
  FM.pick("loras/sdxl", ["__all", "loras/sdxl", "loras/flux"], "__all") === "loras/sdxl" && FM.pick("loras/old", ["__all", "loras/sdxl"], "__all") === "__all" && FM.pick(null, ["a"], "__all") === "__all");

/* 2 which Basic Settings fields */
const el = (tag, o) => Object.assign({ tagName: tag, id: "x", type: "", closest: () => null }, o || {});
check("keepable: inputs / selects / textareas with an id; not buttons / files, not without an id, not inside the style card (its model dropdowns save into the style)",
  BC.keepable(el("INPUT", { type: "range", id: "steps" })) && BC.keepable(el("SELECT", { id: "resSel" })) && BC.keepable(el("TEXTAREA", { id: "t" }))
  && !BC.keepable(el("INPUT", { type: "button" })) && !BC.keepable(el("INPUT", { type: "file" })) && !BC.keepable(el("INPUT", { id: "" })) && !BC.keepable(el("DIV"))
  && !BC.keepable(el("SELECT", { id: "bsCkpt", closest: (s) => (/#bsStyleCard/.test(s) ? {} : null) })) && /#bsStyleCard/.test(BC.SKIP));
check("valueOf: a checkbox / radio -> true / false, anything else -> its text; same compares the whole set",
  BC.valueOf({ type: "checkbox", checked: 1 }) === true && BC.valueOf({ type: "radio", checked: 0 }) === false && BC.valueOf({ type: "number", value: 7 }) === "7"
  && BC.same({ a: "1" }, { a: "1" }) && !BC.same({ a: "1" }, { a: "2" }) && BC.same(null, {}));

/* 3 the files */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "h3bc559-"));
LC.setBase(tmp);
LC.write("basic", { steps: "20", ovrStyle: true });
LC.merge("basic", { steps: "31" });
LC.merge("folders", { "cm:imgLora:loras": "loras/sdxl", "mm:checkpoints": "pony" });
LC.merge("folders", { "mm:checkpoints": null });
check("layoutCfg: basic -> basic.cfg, folders -> folder_filters.cfg in the install folder; {set} merges (null = forget), {all} replaces",
  LC.FILES.basic === "basic.cfg" && LC.FILES.folders === "folder_filters.cfg"
  && JSON.parse(fs.readFileSync(path.join(tmp, "basic.cfg"), "utf8")).steps === "31" && LC.read("basic").ovrStyle === true
  && JSON.stringify(LC.read("folders")) === JSON.stringify({ "cm:imgLora:loras": "loras/sdxl" }));
LC.setBase(null); fs.rmSync(tmp, { recursive: true, force: true });

/* 4 the wiring */
const IX = rd("static", "index.html"), CH = rd("ext", "videodock", "characters.js"), MM = rd("static", "modelmgr.js"), FF = rd("static", "folderfilter.js"), BS = rd("static", "basiccfg.js");
check("index.html loads folderfilter.js and basiccfg.js",
  /<script src="\/static\/folderfilter\.js[^"]*"><\/script>/.test(IX) && /<script src="\/static\/basiccfg\.js[^"]*"><\/script>/.test(IX));
check("every ComfyUI model combo keeps its own folder (its field + categories), picked by hand -> kept, repainted once the file is read",
  /fkey = "cm:" \+ \(inp\.id \|\| host\.id \|\| ""\) \+ ":" \+ cats\.join\(","\)/.test(IX) && /H3FolderMem\.set\(fkey,/.test(IX) && /H3FolderMem\.onReady\(/.test(IX));
check("the 📁 model browser, the character dialogs' LoRA folders and the Model manager's folder tabs keep theirs too",
  /H3FolderMem\.get\("cmbrowse:" \+ cats\.join\(","\)\)/.test(IX) && /H3FolderMem\.set\("cmbrowse:"/.test(IX) && /fkey = "lora:" \+ folderSel/.test(CH)
  && /H3FolderMem\.set\("mm:" \+ S\.tab, S\.folder \|\| null\)/.test(MM) && /H3FolderMem\.get\("mm:" \+ S\.tab\)/.test(MM));
check("the file wins over the browser's copy (the copy only paints first); a pick made before the file arrives is kept",
  /mem = Object\.assign\(\{\}, o\);/.test(FF) && /for \(const k of Object\.keys\(pend\)\)/.test(FF));
check("basic.cfg: saved a moment after a change (by hand, or by the app - a 3 s look), on leaving; read back after the project's own state (H3_PROJECT_READY)",
  /h\.addEventListener\("change", soon, true\)/.test(BS) && /setInterval\(\(\) => \{ if \(started && !same\(collect\(\), saved\)\) soon\(\); \}, 3000\)/.test(BS)
  && /sendBeacon\("\/api\/layout\/basic"/.test(BS) && /ready && root\.H3_PROJECT_READY/.test(BS) && /JSON\.stringify\(\{ all: o \}\)/.test(BS));
check("basic.cfg and folder_filters.cfg are this machine's - kept out of the zips and git",
  /! -name "basic\.cfg"/.test(rd("scripts", "make_zips.sh")) && /! -name "folder_filters\.cfg"/.test(rd("scripts", "make_zips.sh"))
  && /^basic\.cfg$/m.test(rd(".gitignore")) && /^folder_filters\.cfg$/m.test(rd(".gitignore"))
  // 2.565.1: _gitignore (its copy for the zip - a dot file can be lost on the way) is only in the install zip, not in
  // the GitHub repository: compared where it exists (CI failed on every push since 2.559.0 reading it)
  && (!fs.existsSync(path.join(ROOT, "_gitignore")) || rd(".gitignore") === rd("_gitignore")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
