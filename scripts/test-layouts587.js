#!/usr/bin/env node
/* bitGen Studio — scripts/test-layouts587.js (2.587.0): FULL DOCKER LAYOUTS (lib/layouts.js, routes/layouts.js) and the
 * 👁 docker off switch's pure parts (static/layouts.js). Tim: "in dockers add a visible icon next to the dockers name ...
 * if hidden hide the docker and the statusbar button for the docker - allow user to export/import theme and dockers
 * layout . themes will be saved in themes and full docker layouts folder which i can copy into the repo and make it the
 * default theme/layout". A layout = the install folder's five layout files + the page's docker memory + the theme;
 * save / list / read / import / apply (files written back, a missing one removed; the page's own layout saves held off
 * for a few seconds); a fresh install seeded from layouts/default.json; names made safe; the wiring. No server. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const L = require("../lib/layouts");
const P = require("../static/layouts.js");
const R = require("../routes/layouts.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-layouts587-"));
L.setBase(tmp);
const W = (f, o) => fs.writeFileSync(path.join(tmp, f), JSON.stringify(o));
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(tmp, f), "utf8")); } catch { return null; } };

try {
  check("safeName: a file name, never a path or a device", L.safeName("My Edit 1440p") === "My Edit 1440p" && L.safeName("../../x") === "x" && L.safeName("con") === "" && L.safeName("a/b\\c.json") === "a_b_c");
  const c = L.clean({ files: { "docker_status.json": { docks: { a: 1 } }, "evil.js": { x: 1 }, "docker.cfg": [1] }, local: { "h3.g.musicdock": "1", "h3.theme": "light", "nope": "x", "h3.v.th": 200 }, theme: { name: "T", vars: { ink: "#000" } } }, "../x");
  check("clean: only the five layout files (as objects), h3.* page memory without the theme keys, a theme with colours, a safe name",
    Object.keys(c.files).join() === "docker_status.json" && JSON.stringify(c.local) === '{"h3.g.musicdock":"1","h3.v.th":"200"}' && c.theme.name === "T" && c.name === "x");

  W("docker_status.json", { version: 1, docks: { timelinedock: { height: 150 }, musicdock: { hidden: true } } });
  W("docker.cfg", { version: 1, configs: {} });
  W("panel_layout.cfg", { layers: { x: 10 } });
  W("workspaces.json", { version: 1, current: "video", saved: {} });
  const s = L.save("Editing", { local: { "h3.g.musicdock": "1", "h3.dockoff": '["sfxdock"]' }, theme: { name: "Night", base: "dark", vars: { ink: "#000" } } });
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, "layouts", "Editing.json"), "utf8"));
  check("save: layouts/Editing.json - the four files there (dialog_layout.cfg absent), the page memory, the theme", s.file === "layouts/Editing.json" && s.docks === 2 && s.theme === "Night"
    && Object.keys(saved.files).sort().join() === "docker.cfg,docker_status.json,panel_layout.cfg,workspaces.json" && saved.local["h3.dockoff"] === '["sfxdock"]');
  check("save: a layout needs a name", (() => { try { L.save(" ", {}); return false; } catch (e) { return /name/.test(e.message); } })());
  // the layout changes, then Editing is applied
  W("docker_status.json", { version: 1, docks: { timelinedock: { height: 400 } } });
  W("dialog_layout.cfg", { x: 1 });
  fs.unlinkSync(path.join(tmp, "docker.cfg"));
  const a = L.apply("Editing");
  check("apply: the files back as saved; one the layout has not (dialog_layout.cfg) removed so the default is used; the page memory + theme returned",
    rd("docker_status.json").docks.timelinedock.height === 150 && rd("docker.cfg").version === 1 && rd("dialog_layout.cfg") === null && a.local["h3.g.musicdock"] === "1" && a.theme.name === "Night");
  check("apply: the page's own layout saves are held off for a few seconds (lock)", L.locked() && (L.unlock(), !L.locked()));
  check("apply: a layout that is not there = 404", (() => { try { L.apply("nope"); return false; } catch (e) { return e.status === 404; } })());
  const exp = L.read("Editing");
  fs.rmSync(path.join(tmp, "layouts"), { recursive: true });
  const im = L.importRec(exp, "From Tim");
  check("export (read) -> import: the same layout under a new name", im.file === "layouts/From Tim.json" && L.read("From Tim").files["docker_status.json"].docks.timelinedock.height === 150);
  check("import: not a layout = refused", (() => { try { L.importRec({ hello: 1 }); return false; } catch (e) { return /not a bitGen layout/.test(e.message); } })());
  L.save("default", { local: { "h3.c.chatdock": "1" } });
  const li = L.list();
  check("list: the default first (★), then by name", li[0].name === "default" && li[0].default && li.some((x) => x.name === "From Tim") && L.remove("From Tim").removed === "From Tim" && L.list().length === 1);

  // a fresh install with layouts/default.json
  fs.unlinkSync(path.join(tmp, "docker_status.json"));
  const sd = L.seed();
  check("seed: a fresh install (no docker_status.json) starts from layouts/default.json - its page memory offered once", sd && sd.name === "default" && rd("docker_status.json") && sd.local["h3.c.chatdock"] === "1" && L.seededInfo().token === sd.token);
  check("seed: not again once docker_status.json is there", L.seed() === null);

  check("routes: while locked, the page's layout saves are the guarded ones", ["/api/docker-status", "/api/docker-cfg/save", "/api/layout/panel", "/api/layout/dialog", "/api/workspaces/snapshot", "/api/workspaces/switch"].every((p) => R.GUARDED.test(p)) && !R.GUARDED.test("/api/layout/basic") && !R.GUARDED.test("/api/config"));
  check("page: pickLocal keeps the docker memory (h3.g. / v. / c. / d. / s. / dockoff), nothing else", JSON.stringify(P.pickLocal([["h3.g.musicdock", "1"], ["h3.v.th", "120"], ["h3.dockoff", "[]"], ["h3.llm", "x.gguf"], ["h3.theme", "light"], ["other", "1"]])) === '{"h3.g.musicdock":"1","h3.v.th":"120","h3.dockoff":"[]"}');
  check("page: offList reads the turned-off dockers, junk dropped", P.offList('["sfxdock","win:negprompt","../x",3]').join() === "sfxdock,win:negprompt" && P.offList("nope").length === 0);

  const IDX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8"), H = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8"), DR = fs.readFileSync(path.join(ROOT, "static", "dockreset.js"), "utf8"), TH = fs.readFileSync(path.join(ROOT, "static", "themes.js"), "utf8");
  check("wiring: the guard mounted before express.json (first), the routes mounted; layouts.js loaded; Settings ▸ Dockers draws 👁 / 🚫; themes.js exports use()",
    IDX.indexOf('require("./layouts").guard(app)') < IDX.indexOf("app.use(express.json())") && /require\("\.\/layouts"\)\.mount\(app\)/.test(IDX) && /src="\/static\/layouts\.js"/.test(H) && /data-drvis=/.test(DR) && /🚫/.test(DR) && /use: useRecord/.test(TH));
  check("layouts/ ships (not in .gitignore / make_zips' exclusions) - copy one in as default.json", !/^layouts\/?$/m.test(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8")) && !/layouts\/\*/.test(fs.readFileSync(path.join(ROOT, "scripts", "make_zips.sh"), "utf8")));
} catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
