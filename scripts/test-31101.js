#!/usr/bin/env node
/* bitGen Studio — 3.11.1: the Sketcher's DAZ library looks through EVERY top folder of a library (lib/dazLib.js topsOf / scan) -
 * Animals, Vehicles, Architecture, Poses ... - not only People, Props and Environments; an animal's own load file
 * (Animals/<product>/<name>.duf) is a figure even when its file does not say so. Our own made-up DOLL (test-981) - no Daz content.
 * Tim: "in sketcher daz doesn't find other libraries. i have daz horse 3 in D:\daz3d\Content\Animals and it is not showing up" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  const D = require(path.join(ROOT, "lib/dazLib.js")), core = require(path.join(ROOT, "lib/core.js"));
  const t981 = fs.readFileSync(path.join(__dirname, "test-981.js"), "utf8");
  const { makeDoll } = new Function("require", "path", "fs", t981.slice(t981.indexOf("const pt = "), t981.indexOf("(async () => {")) + "; return { makeDoll };")(require, path, fs);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "daz31101_")), lib = path.join(tmp, "Content"); makeDoll(lib);
  const wr = (rel, obj) => { const f = path.join(lib, ...rel.split("/")); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj)); };
  // a "horse": the doll's own figure, loaded from Animals/ by a .duf that does NOT say it is a figure (no asset_info type)
  const duf = JSON.parse(fs.readFileSync(path.join(lib, "People/Doll/Doll.duf"), "utf8")); delete duf.asset_info;
  wr("Animals/Doll Horse/Doll Horse.duf", duf);
  wr("Animals/Doll Horse/Poses/Trot.duf", { asset_info: { type: "preset_pose" }, scene: { animations: [{ url: "name://@selection/lShldr:?rotation/z/value", keys: [[0, 15]] }] } });
  wr("Vehicles/Cart/Cart.duf", { asset_info: { type: "figure" }, scene: { nodes: [] } });
  wr("Light Presets/Sun.duf", { asset_info: { type: "preset_light" }, scene: {} });
  wr("Render Presets/Fast.duf", { asset_info: { type: "preset_render_settings" }, scene: {} });
  const realCfg = core.getConfig; core.getConfig = () => ({ daz_library: { roots: [lib] } });
  try {
    check("topsOf: every top folder that can hold a character's things, People / Props / Environments / Animals first, then by name; data, Runtime and the light / render presets left out",
      JSON.stringify(D.topsOf(lib)) === JSON.stringify(["People", "Animals", "Vehicles"]), D.topsOf(lib));
    const sc = D.scan({ root: lib }), by = Object.fromEntries(sc.items.map((x) => [x.rel, x.kind]));
    check("the library now has the Animals folder's figure (its file does not say \"figure\" - its place does)", by["Animals/Doll Horse/Doll Horse.duf"] === "figure", by);
    check("…and its poses (Animals/<product>/Poses)", by["Animals/Doll Horse/Poses/Trot.duf"] === "pose", by);
    check("…and other top folders (Vehicles)", by["Vehicles/Cart/Cart.duf"] === "figure");
    check("…the People folder as before; no light / render presets listed", by["People/Doll/Doll.duf"] === "figure" && !Object.keys(by).some((k) => /Light Presets|Render Presets/.test(k)), Object.keys(by));
    const figs = D.scan({ root: lib, kind: "figure" }).items.map((x) => x.name);
    check("🧍 Figures (the library's tab) lists the doll and the horse", figs.includes("Doll") && figs.includes("Doll Horse"), figs);
    const out = await D.build({ root: lib, rel: "Animals/Doll Horse/Doll Horse.duf" });
    check("the horse builds into a rigged model from the Animals folder (its bones, its figure piece)", out && out.info && out.info.pieces && out.info.pieces[0].kind === "figure" && out.info.bones > 3, out && out.info && { pieces: out.info.pieces, bones: out.info.bones });
    if (out && out.file) try { fs.unlinkSync(out.file); } catch (e) { /* fine */ }
    // Daz Studio's own content folders (its Content Directory Manager - the Windows registry)
    const other = path.join(tmp, "Other Lib"); fs.mkdirSync(path.join(other, "Animals"), { recursive: true });
    const reg = "\r\nHKEY_CURRENT_USER\\Software\\DAZ\\Studio4\r\n    ContentDir0    REG_SZ    " + lib + "\r\n    ContentDir1    REG_SZ    " + other + "\\\r\n"
      + "    PoserDir0    REG_SZ    " + path.join(tmp, "poser") + "\r\n    ContentDir2    REG_SZ    " + path.join(tmp, "gone") + "\r\n    Version    REG_DWORD    0x4\r\n"
      + "\r\nHKEY_CURRENT_USER\\Software\\DAZ\\Studio4 Public Build\r\n    ContentDir0    REG_SZ    " + lib + "\r\n";
    check("parseRegQuery: the folders in `reg query`'s string values (numbers and other types left out)", JSON.stringify(D.parseRegQuery(reg).map((v) => v.name)) === JSON.stringify(["ContentDir0", "ContentDir1", "PoserDir0", "ContentDir2", "ContentDir0"]), D.parseRegQuery(reg));
    check("registryRoots: Daz Studio's content folders that exist and look like a library - once each, Poser folders and gone ones left out, a trailing \\ dropped",
      JSON.stringify(D.registryRoots({ regText: reg })) === JSON.stringify([lib, other]), D.registryRoots({ regText: reg }));
    check("detectRoots: they join the usual places (D:\\daz3d\\Content would be found)", (() => { const d = D.detectRoots({ regText: reg }); return d.includes(lib) && d.includes(other); })());
    check("not Windows and no registry text: no registry folders (nothing run)", process.platform === "win32" || D.registryRoots().length === 0);
    const tools = fs.readFileSync(path.join(ROOT, "ext/pushpulldock/ppdaztools.js"), "utf8");
    check("📁 Folders ▸ 🔍 Find ADDS the folders found to yours (it replaced them before)", /have\.concat\(add\)\.join\("\\n"\)/.test(tools));
  } catch (e) { check("crashed: " + (e && e.stack || e), false); }
  finally { core.getConfig = realCfg; fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
