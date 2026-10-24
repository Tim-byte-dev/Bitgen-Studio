#!/usr/bin/env node
/* bitGen Studio — scripts/test-teamext589.js (2.589.0): THE TEAM RENDER FARM LEAVES THE CORE - an optional extension.
 * Tim: "i suspect the malwarebytes detection is due to the team renderhub ext. i think we remove this from bitgen and
 * give it as an additional addon with notes saying this may trigger virus checkers". The core has no team / farm code
 * (only lib/extHooks' empty "farm" slot); an extension may bring a server part (ext.json "server"); the extension zip
 * installs from Settings ▸ Add-ons (📦 / a zip found in the app folder or Downloads) and is removed there; the install
 * zips leave it out (make_zips: ext.json "optional": true). No server. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const X = require("../lib/extensions");
const H = require("../lib/extHooks");
const TA = require("../lib/teamAddon");
const zipW = require("../lib/zipWrite");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-teamext589-"));

(async () => {
  try {
    // ---- the core has no team code
    const gone = ["lib/team.js", "lib/farm.js", "lib/farmNode.js", "routes/team.js", "static/team.js"].filter((f) => fs.existsSync(path.join(ROOT, f)));
    const IDX = rd("routes", "index.js"), CORE = rd("lib", "core.js"), PAGE = rd("static", "index.html");
    check("the core carries no Team / farm code: lib/team.js, lib/farm.js, lib/farmNode.js, routes/team.js, static/team.js are gone; nothing requires them",
      gone.length === 0 && !/require\("\.\/team"\)|require\("\.\.\/lib\/farm"\)|require\("\.\/farm"\)/.test(IDX + CORE) && !/static\/team\.js/.test(PAGE), gone);
    check("core asks lib/extHooks for a farm (none = every job renders here); the cancel too; extension servers mounted from routes/index.js (not server.js)",
      /require\("\.\/extHooks"\)\.get\("farm"\)/.test(CORE) && /if \(farm && !o\.local && !o\.farm\)/.test(CORE) && /require\("\.\.\/lib\/extHooks"\)\.get\("farm"\)/.test(IDX) && /extensions\.mountServers\(app\)/.test(IDX) && !/mountServers|teamdock/.test(rd("misc/server.js")));
    H.clear();
    check("extHooks: empty by default; set / get / clear", H.get("farm") === null && H.set("farm", { route: () => null }) && typeof H.get("farm").route === "function" && (H.clear("farm"), H.get("farm") === null));

    // ---- an extension with a server part (a fake one in a temp install)
    const B = path.join(tmp, "app"); fs.mkdirSync(path.join(B, "ext", "demo", "server"), { recursive: true });
    fs.writeFileSync(path.join(B, "ext", "demo", "ext.json"), JSON.stringify({ id: "demo", name: "Demo", scripts: [], server: "server/index.js", optional: true, note: "x" }));
    fs.writeFileSync(path.join(B, "ext", "demo", "server", "index.js"), "module.exports = { mount(app) { app.get('/api/demo', () => {}); } };");
    fs.mkdirSync(path.join(B, "ext", "bad"), { recursive: true });
    fs.writeFileSync(path.join(B, "ext", "bad", "ext.json"), JSON.stringify({ id: "bad", server: "../../evil.js" }));
    fs.mkdirSync(path.join(B, "ext", "boom", "s"), { recursive: true });
    fs.writeFileSync(path.join(B, "ext", "boom", "ext.json"), JSON.stringify({ id: "boom", server: "s/x.js" }));
    fs.writeFileSync(path.join(B, "ext", "boom", "s", "x.js"), "throw new Error('broken')");
    const L = X.list(B);
    check("ext.json server: a .js inside the extension (a path that climbs out is ignored); optional + note read",
      L.find((e) => e.id === "demo").server === "server/index.js" && L.find((e) => e.id === "bad").server === null && L.find((e) => e.id === "demo").optional === true);
    const routes = [];
    const app = { get: (p) => routes.push("GET " + p), post: (p) => routes.push("POST " + p), use: () => {} };
    const ms = (() => { const e0 = console.error; console.error = () => {}; try { return X.mountServers(app, B); } finally { console.error = e0; } })();
    check("mountServers: each server part mounted once at start; one that throws is reported and skipped - the app still starts",
      routes.join() === "GET /api/demo" && ms.find((m) => m.id === "demo").ok && ms.find((m) => m.id === "boom").ok === false && /broken/.test(ms.find((m) => m.id === "boom").error) && X.mountedServers().length === 2);

    // ---- the real Team extension (in the dev tree)
    const TD = path.join(ROOT, "ext", "teamdock");
    if (fs.existsSync(path.join(TD, "ext.json"))) {
      const man = JSON.parse(fs.readFileSync(path.join(TD, "ext.json"), "utf8"));
      check("ext/teamdock: optional, its server part + its page script, a note about virus checkers", man.optional === true && man.server === "server/index.js" && man.scripts.join() === "team.js" && /antivirus|Malwarebytes/.test(man.note)
        && ["server/team.js", "server/farm.js", "server/farmNode.js", "server/routes.js", "server/index.js", "team.js"].every((f) => fs.existsSync(path.join(TD, f))));
      const r2 = [];
      const app2 = { get: (p) => r2.push(p), post: (p) => r2.push(p), use: () => {} };
      // mount the real one without its timers / port: the team module's start() is a no-op without a team folder
      H.clear();
      require(path.join(TD, "server", "index.js")).mount(app2);
      const fm = H.get("farm");
      check("its server part: the /api/team routes + the core's farm hook (route / dispatch / cancel)", r2.some((p) => /^\/api\/team/.test(p)) && fm && typeof fm.route === "function" && typeof fm.dispatch === "function" && typeof fm.cancel === "function", r2.slice(0, 6));
      check("with no team joined the hook keeps every job here (route -> null)", fm.route({ mode: "image" }) == null);
      H.clear();
    } else console.log("SKIP: ext/teamdock is not here (an install without the optional extension)");

    // ---- install / remove from a zip
    const zipOf = (files) => zipW.zip(files.map(([name, data]) => ({ name, data: Buffer.from(data) })));
    const Z = zipOf([["ext/teamdock/ext.json", JSON.stringify({ id: "teamdock", scripts: ["team.js"], server: "server/index.js", optional: true })], ["ext/teamdock/team.js", "//"], ["ext/teamdock/server/index.js", "module.exports={mount(){}}"], ["ext/other/ext.json", "{}"], ["lib/core.js", "evil"]]);
    const B2 = path.join(tmp, "app2"); fs.mkdirSync(path.join(B2, "lib"), { recursive: true }); fs.writeFileSync(path.join(B2, "lib", "core.js"), "real");
    const ins = X.installZipBuffer(Z, "teamdock", B2);
    check("installZipBuffer: only ext/teamdock/ out of the zip (another extension and a core file in it are left alone)",
      ins.installed.join() === "teamdock" && fs.existsSync(path.join(B2, "ext", "teamdock", "server", "index.js")) && !fs.existsSync(path.join(B2, "ext", "other")) && fs.readFileSync(path.join(B2, "lib", "core.js"), "utf8") === "real" && X.installed("teamdock", B2));
    check("installZipBuffer: a zip without ext/teamdock is refused", (() => { try { X.installZipBuffer(zipOf([["ext/other/ext.json", "{}"]]), "teamdock", B2); return false; } catch (e) { return e.status === 400 && /bitgen-ext-teamdock/.test(e.message); } })());
    check("removeExt: the folder goes; an unknown one = 404", X.removeExt("teamdock", B2).removed === "teamdock" && !X.installed("teamdock", B2) && (() => { try { X.removeExt("teamdock", B2); return false; } catch (e) { return e.status === 404; } })());
    // the add-on finds the newest zip
    const dl = path.join(tmp, "Downloads"); fs.mkdirSync(dl);
    for (const v of ["2.589.0", "2.590.1", "2.59.9", "2.590.0"]) fs.writeFileSync(path.join(dl, `bitgen-ext-teamdock-v${v}.zip`), "z");
    fs.writeFileSync(path.join(dl, "bitgen-ext-videodock-v9.9.9.zip"), "z");
    check("Add-ons ▸ Install finds the newest bitgen-ext-teamdock-v*.zip (app folder / Downloads)", path.basename(TA.findZip([path.join(tmp, "nope"), dl])) === "bitgen-ext-teamdock-v2.590.1.zip" && TA.findZip([path.join(tmp, "nope")]) === "");
    const A = require("../lib/addons").LIST.find((a) => a.id === "teamdock");
    check("Settings ▸ Add-ons ▸ Team render farm: says it may trigger virus checkers (and why), 📦 Install from a zip…, remove",
      /virus checkers/.test(A.label) && /may trigger virus checkers/.test(A.needs) && /network port/.test(A.needs) && /Malwarebytes/.test(A.needs) && A.zip.url === "/api/addons/teamdock/install-zip" && typeof A.installZip === "function" && typeof A.remove === "function"
      && /install-zip/.test(rd("routes", "addons.js")));
    // the zips
    const MZ = rd("scripts", "make_zips.sh");
    check("make_zips: an optional extension is in no install zip (full / repo / flat) - only its own ext zip; .gitignore keeps it out of the repo",
      /OPTIONAL_EXTS=\$\(for d in ext\/\*\/; do .*"optional": \*true/.test(MZ) && /FILES=\$\(echo "\$FILES" \| grep -v "\^ext\/\$\{o\}\/"/.test(MZ) && /echo "\$ALLFILES" \| grep "\^ext\/\$\{id\}\/"/.test(MZ) && /^ext\/teamdock\/$/m.test(rd(".gitignore")));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
