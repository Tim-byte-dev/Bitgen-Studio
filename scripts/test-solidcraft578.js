#!/usr/bin/env node
/* bitGen Studio — 2.578.0 units: the 📐 SolidCraft docker - the add-on (lib/solidcraftAddon.js: a release's web zip
 * checked, unpacked, swapped in; GitHub's newest release; the download path with a fake downloader), the project's
 * solidcraft folder (lib/solidcraftFiles.js), the routes (routes/solidcraft.js, mounted from routes/index.js), the
 * bridge's pure parts (ext/solidcraftdock/scbridge.js: SolidCraft's camera convention, the fitted orthographic frame,
 * names, sizes) and the docker's wiring.
 * Tim: "yes, lets build a solidcraft bridge, but we will put it in it's own docker". Run: node scripts/test-solidcraft578.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);

(async () => {
  const SA = require(path.join(ROOT, "lib", "solidcraftAddon.js")), Z = require(path.join(ROOT, "lib", "zipWrite.js"));
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg578-"));
  try {
    SA.setBase(T);
    const web = (v, extra) => Z.zip([
      { name: `solidcraft-web-${v}/index.html`, data: Buffer.from("<canvas id=solidcraft_canvas></canvas>") },
      { name: `solidcraft-web-${v}/solidcraft-web-abc_bg.wasm`, data: Buffer.from([0, 97, 115, 109]) },
      { name: `solidcraft-web-${v}/build.json`, data: Buffer.from(JSON.stringify({ version: v + "-5a3b805e" })) },
      { name: `solidcraft-web-${v}/LICENSE-MIT`, data: Buffer.from("MIT") },
    ].concat(extra || []));
    check("checkZip: a release's web zip (one top folder, index.html + *_bg.wasm, the version from build.json)",
      JSON.stringify(SA.checkZip(web("0.17.0"))) === JSON.stringify({ ok: true, root: "solidcraft-web-0.17.0/", version: "0.17.0" }));
    const noWasm = Z.zip([{ name: "index.html", data: Buffer.from("x") }]);
    check("checkZip refuses: not a zip / no index.html / no WebAssembly - each says what to pick",
      !SA.checkZip(Buffer.from("nope")).ok && /no index\.html/.test(SA.checkZip(Z.zip([{ name: "a.txt", data: Buffer.from("x") }])).error) && /WebAssembly/.test(SA.checkZip(noWasm).error));
    check("not installed: status says so", SA.status().installed === false && SA.status().note === "not installed");
    const zp = path.join(T, "w.zip"); fs.writeFileSync(zp, web("0.17.0"));
    const lines = [];
    const r1 = await SA.install((l) => lines.push(l), { zip: zp });
    check("install from a zip: unpacked without its top folder into <install>/solidcraft/web, version.json written",
      r1.ok && r1.version === "0.17.0" && fs.existsSync(path.join(T, "solidcraft", "web", "index.html")) && fs.existsSync(path.join(T, "solidcraft", "web", "LICENSE-MIT"))
      && SA.status().installed && SA.status().version === "0.17.0" && lines.some((l) => /installed/.test(l)), { r1, st: SA.status() });
    // the download path: GitHub's newest release -> its web asset -> downloaded -> unpacked over the old build
    let asked = "", got = "";
    const deps = {
      getJson: async (u) => { asked = u; return { status: 200, json: { tag_name: "v0.18.0", assets: [{ name: "solidcraft-0.18.0-windows-x64.msi", browser_download_url: "x" }, { name: "solidcraft-web-0.18.0.zip", browser_download_url: "https://example.invalid/web18.zip", size: 1234 }] } }; },
      download: async (u, dest, o) => { got = u; fs.writeFileSync(dest, web("0.18.0")); if (o.onProgress) o.onProgress({ got: 10, total: 10 }); return { ok: true }; },
    };
    const L = await SA.latest(deps);
    check("latest(): GitHub's newest release and ITS web zip (not the installers)", /api\.github\.com\/repos\/tangency-labs\/solidcraft\/releases\/latest/.test(asked) && L.version === "0.18.0" && L.url === "https://example.invalid/web18.zip", L);
    const r2 = await SA.install(() => {}, {}, deps);
    check("install (the Add-ons job): the newest web zip downloaded and swapped in (the update path)", r2.ok && got === "https://example.invalid/web18.zip" && SA.status().version === "0.18.0" && !fs.existsSync(path.join(T, "solidcraft", "web.new")) && !fs.existsSync(path.join(T, "solidcraft", "web.old")), { r2, got });
    const r3 = await SA.install(() => {}, {}, { getJson: async () => ({ status: 0 }), download: async (u) => { got = u; return { ok: false, error: "offline" }; } });
    check("offline: falls back to the pinned release URL; a failed download says how to install from a zip - and the installed build stays",
      !r3.ok && got === SA.assetUrl(SA.PINNED) && /Install from a zip/.test(r3.error) && SA.status().version === "0.18.0", { r3, got });
    const evil = path.join(T, "evil.zip"); fs.writeFileSync(evil, web("0.19.0", [{ name: "solidcraft-web-0.19.0/../../x.txt", data: Buffer.from("x") }]));
    const r4 = SA.unpack(evil);
    check("a zip with a path that climbs out is refused", !r4.ok && /unsafe/.test(r4.error) && !fs.existsSync(path.join(T, "x.txt")), r4);
    check("remove(): the build gone", SA.remove(() => {}).ok && !SA.status().installed);
  } finally { SA.setBase(null); fs.rmSync(T, { recursive: true, force: true }); }

  /* the project's solidcraft folder */
  const SF = require(path.join(ROOT, "lib", "solidcraftFiles.js")), D = fs.mkdtempSync(path.join(os.tmpdir(), "bg578f-"));
  try {
    SF.setDir(D);
    check("safeName: designs, parts, pictures, drawings - no paths, no other kinds",
      SF.safeName("My Bracket.solidcraft") === "My Bracket.solidcraft" && SF.safeName("../../x.step") === "x.step" && SF.safeName("a.exe") === "" && SF.safeName("C:\\t\\b.STL") === "b.STL");
    const s = SF.save("bracket.solidcraft", Buffer.from("SC")); SF.save("bracket.step", Buffer.from("ISO-10303-21;"));
    const ls = SF.list();
    check("save / list: kind design / part, size", s.kind === "design" && ls.length === 2 && ls.find((f) => f.name === "bracket.step").kind === "part" && ls.every((f) => f.size > 0), ls);
    let e1 = null; try { SF.file("../bracket.step"); } catch (e) { e1 = e.status; }
    check("file(): only a name in the folder (no climbing) - 404 otherwise", SF.file("bracket.step") === path.join(D, "bracket.step") && e1 === 404);
    check("remove()", SF.remove("bracket.step").removed === "bracket.step" && SF.list().length === 1);
  } finally { SF.setDir(null); fs.rmSync(D, { recursive: true, force: true }); }

  /* the bridge's pure parts */
  const B = require(path.join(ROOT, "ext", "solidcraftdock", "scbridge.js"));
  const dir = (y, p) => B.camDir({ yaw: y, pitch: p });
  const eq = (a, b) => a.every((v, i) => near(v, b[i], 1e-9));
  check("camDir follows SolidCraft's view.apply answers: Front yaw 0 = from -Y, Right -90° = from +X, Left 90° = from -X, Back 180° = from +Y, Top pitch 90°",
    eq(dir(0, 0), [-0, -1, 0]) && eq(dir(-Math.PI / 2, 0), [1, -0, 0]) && eq(dir(Math.PI / 2, 0), [-1, -0, 0]) && eq(dir(Math.PI, 0), [-0, 1, 0]) && near(dir(0, Math.PI / 2)[2], 1));
  const iso = dir(-Math.PI / 4, Math.atan(1 / Math.SQRT2));
  check("Iso (yaw -45°, pitch 35.26°) looks from front-right-top (+X, -Y, +Z) equally", near(iso[0], -iso[1], 1e-9) && near(iso[0], iso[2], 1e-9) && iso[0] > 0);
  const bt = B.basis(dir(0, Math.PI / 2), 0);
  check("basis: Top keeps +Y up on the picture; Front keeps +Z up and +X to the right", eq(bt.up.map((v) => Math.round(v * 1e9) / 1e9), [0, 1, 0]) && near(B.basis(dir(0, 0), 0).up[2], 1) && near(B.basis(dir(0, 0), 0).right[0], 1), bt);
  const F = B.fitOrtho([0, 0, 0], [60, 40, 10], dir(0, 0), 2, 0);
  check("fitOrtho: a 60 x 40 x 10 box from the Front fills a 2:1 picture by its width (half 30), centred", near(F.halfW, 30, 1e-6) && near(F.halfH, 15, 1e-6) && F.center.join() === "30,20,5", F);
  const F2 = B.fitOrtho([0, 0, 0], [60, 40, 10], dir(0, 0), 8, 0.1);
  check("...a wider picture: the height decides (half 5 x 1.1) and the width follows the aspect", near(F2.halfH, 5.5, 1e-6) && near(F2.halfW, 44, 1e-6), F2);
  check("stemOf / parseSize / newer", B.stemOf("My Part.solidcraft") === "My Part" && B.stemOf("../x/a:b?.step") === "a_b_" && B.stemOf("") === "design"
    && JSON.stringify(B.parseSize("1920x1080")) === '{"w":1920,"h":1080}' && B.parseSize("doc") === null && B.newer("0.18.0", "0.17.9") && !B.newer("0.17.0", "0.17.0") && B.newer("1.0.0", "0.99.0"));
  const R = require(path.join(ROOT, "routes", "solidcraft.js"));
  check("routes newer() agrees", R.newer("0.17.1", "0.17.0") && !R.newer("0.16.9", "0.17.0"));

  /* the wiring */
  const RS = rd("routes", "solidcraft.js"), IX = rd("routes", "index.js"), AD = rd("lib", "addons.js");
  check("routes: /solidcraft-app (the build, same origin), status, latest, install, install-zip, files / file / save / delete - mounted from routes/index.js, not server.js",
    /app\.use\("\/solidcraft-app"/.test(RS) && ["/api/solidcraft/status", "/api/solidcraft/latest", "/api/solidcraft/install", "/api/solidcraft/install-zip", "/api/solidcraft/files", "/api/solidcraft/file/:name", "/api/solidcraft/save"].every((u) => RS.indexOf('"' + u + '"') >= 0)
    && /require\("\.\/solidcraft"\)\.mount\(app\)/.test(IX) && !/solidcraft/i.test(rd("server.js")));
  check("Settings ▸ Add-ons lists SolidCraft (install / reinstall / remove)", /id: "solidcraft", label: "SolidCraft \(parametric 3D CAD\)"/.test(AD) && /require\("\.\/solidcraftAddon"\)\.install\(log, opts \|\| \{\}\)/.test(AD));
  const EJ = JSON.parse(rd("ext", "solidcraftdock", "ext.json")), DH = rd("ext", "solidcraftdock", "dock.html"), DJ = rd("ext", "solidcraftdock", "scdock.js");
  check("its own docker: ext/solidcraftdock (dock.html, scbridge.js then scdock.js (+ 2.581.0 scgen.js)); the frame, the bar, the install panel",
    EJ.id === "solidcraftdock" && JSON.stringify(EJ.scripts.slice(0, 2)) === '["scbridge.js","scdock.js"]' && /id="scFrame"/.test(DH) && ["scDesigns", "scSave", "scToEditor", "scToTimeline", "scSketchIn", "scExport", "scView", "scSize", "scEdges", "scInstallBtn", "scInstallZip"].every((id) => DH.indexOf('id="' + id + '"') >= 0));
  check("the docker: loads SolidCraft only once it is on screen; image editor E.load / timeline TlM3D.add + TlBody.reload / sketch exportText dxf; SolidCraft's Save synced",
    /\/solidcraft-app\/index\.html/.test(DJ) && /IntersectionObserver/.test(DJ) && /E\.load\(url/.test(DJ) && /TlM3D\.add\("model"/.test(DJ) && /TlBody\.reload\(saved\)/.test(DJ) && /exportText\(L, "dxf"/.test(DJ) && /setInterval\(sync, 4000\)/.test(DJ));
  const GI = rd(".gitignore"), MZ = rd("scripts", "make_zips.sh");
  check("<install>/solidcraft (the downloaded build) is never committed or zipped", /^solidcraft\/$/m.test(GI) && /! -path "\.\/solidcraft\/\*"/.test(MZ) && (!fs.existsSync(path.join(ROOT, "_gitignore")) || rd("_gitignore") === GI));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
