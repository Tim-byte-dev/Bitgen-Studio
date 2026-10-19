#!/usr/bin/env node
/* bitGen Studio — 2.513.0 unit tests: 🎮 LOAD UE PROJECT (lib/ueProject.js, routes/ueProject.js, static/ueproject.js),
 * THE TIMELINE'S FRAME SIZE BAR (static/framesize.js, ext/timelinedock/tlsizebar.js, worker.py _fit_frame) and the
 * hidden CAD buttons.
 * Tim: "add a load ue project button in the main menubar, open a dialog to select the ue project folder then when user
 * clicks select automatically add the plugin if not already there and restart unreal. hide the cad tool button ... add
 * a menubar to the top of the timeline docker - width x height input and a size preset dropdown and an aspect ratio
 * dropdown". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const U = require(path.join(ROOT, "lib", "ueProject.js"));
const F = require(path.join(ROOT, "static", "framesize.js"));
const BUNDLED = JSON.parse(read("ue", "bitGenBridge", "bitGenBridge.uplugin")).VersionName;   // the plugin version this app carries (1.3.0 since 2.540.0)

(async () => {
  /* ---- pure */
  const w = U.withPlugins({ Plugins: [{ Name: "PythonScriptPlugin", Enabled: false }, { Name: "Other", Enabled: true }] }, U.NEEDED.concat([U.PLUGIN]));
  check("withPlugins: a switched-off one switched on, the missing ones added, others left alone", w.changed.length === 5 && w.json.Plugins.length === 6 && w.json.Plugins.every((p) => p.Enabled) && w.json.Plugins[1].Name === "Other", w);
  check("withPlugins: nothing to do = nothing changed", U.withPlugins(w.json, U.NEEDED).changed.length === 0);
  check("newer: version numbers compared as numbers", U.newer("1.10.0", "1.9.2") && !U.newer("1.2.0", "1.2.0") && U.newer("1.2.1", "1.2") && !U.newer("1.1.9", "1.2.0"));
  const dat = JSON.stringify({ InstallationList: [{ InstallLocation: "C:\\Epic\\UE_5.7", AppName: "UE_5.7" }, { InstallLocation: "D:\\Epic Games\\UE_5.8", AppName: "UE_5.8" }, { InstallLocation: "x", AppName: "Fortnite" }] });
  check("pickInstall: the Epic launcher's list -> the engine's install folder", U.pickInstall(dat, "5.8") === "D:\\Epic Games\\UE_5.8" && U.pickInstall(dat, "5.6") === null && U.pickInstall("not json", "5.8") === null);
  check("matchProject: an editor's command line with that .uproject (slashes / case ignored)", U.matchProject('"C:\\UE\\UnrealEditor.exe" "C:\\Games\\My Game\\MyGame.uproject"', "c:/games/my game/MyGame.uproject") && !U.matchProject("UnrealEditor.exe Other.uproject", "C:/x/MyGame.uproject"));

  /* ---- a real project folder */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ue513-")), proj = path.join(tmp, "MyGame"), up = path.join(proj, "MyGame.uproject");
  fs.mkdirSync(proj);
  const orig = '{\n\t"FileVersion": 3,\n\t"EngineAssociation": "5.8",\n\t"Category": "",\n\t"Plugins": [\n\t\t{\n\t\t\t"Name": "PythonScriptPlugin",\n\t\t\t"Enabled": false\n\t\t}\n\t]\n}\n';
  fs.writeFileSync(up, orig);
  check("resolve: the folder -> its .uproject; the file itself; no .uproject = a clear error", U.resolve(proj) === up && U.resolve(up) === up && (() => { try { U.resolve(tmp); return false; } catch (e) { return /no \.uproject/.test(e.message); } })());
  const i0 = await U.inspect(proj);
  check("inspect: name, engine, the plugin not there yet (the app's own version to put in), the needed plugins off", i0.name === "MyGame" && i0.engine === "5.8" && !i0.plugin.installed && i0.plugin.bundled === BUNDLED && i0.plugins.every((p) => !p.enabled) && Array.isArray(i0.running), i0);
  const r1 = await U.load(proj, { restart: false });
  const uj = JSON.parse(fs.readFileSync(up, "utf8"));
  check("load: the plugin copied into Plugins/bitGenBridge, the plugins switched on in the .uproject (tabs kept), the old file kept as .bitgen-bak",
    fs.existsSync(path.join(proj, "Plugins", "bitGenBridge", "bitGenBridge.uplugin")) && fs.existsSync(path.join(proj, "Plugins", "bitGenBridge", "Content")) && r1.plugin.installed && r1.plugins.every((p) => p.enabled)
    && /\n\t"Plugins"/.test(fs.readFileSync(up, "utf8")) && fs.readFileSync(up + ".bitgen-bak", "utf8") === orig && uj.Plugins.length === 5 && /added/.test(r1.steps[1]), r1.steps);
  const r2 = await U.load(proj, { restart: false });
  check("load again: nothing copied, nothing switched (already there)", /already there/.test(r2.steps[1]) && /already on/.test(r2.steps[2]), r2.steps);
  const upl = path.join(proj, "Plugins", "bitGenBridge", "bitGenBridge.uplugin"); fs.writeFileSync(upl, fs.readFileSync(upl, "utf8").replace('"VersionName": "' + BUNDLED + '"', '"VersionName": "1.0.0"'));
  const r3 = await U.load(proj, { restart: false });
  check("an older plugin in the project is updated", /updated \(was 1\.0\.0\)/.test(r3.steps[1]) && U.versionOf(fs.readFileSync(upl, "utf8")) === BUNDLED, r3.steps);
  check("the project is remembered (current + recent)", U.cfg().current === up && U.cfg().recent[0] === up);
  fs.rmSync(tmp, { recursive: true, force: true });

  /* ---- the frame size */
  check("framesize: normalize = even, 64 .. 8192; nothing / junk = Auto (null)", JSON.stringify(F.normalize({ w: 1921, h: 1079 })) === '{"w":1922,"h":1080}' && F.normalize({ w: 99999, h: 10 }) === null && F.normalize({ w: 99999, h: 100 }).w === 8192 && F.normalize(null) === null);
  check("framesize: the aspect keeps the other side (16:9 at 1280 = 720, 9:16 at 1920 high = 1080 wide); the aspect / preset of a size",
    F.heightFor(1280, 16 / 9) === 720 && F.widthFor(1920, 9 / 16) === 1080 && F.aspectOf(1080, 1350) === "4:5" && F.aspectOf(1000, 333) === "free" && F.presetOf(1080, 1920) === "vfhd" && F.presetOf(1000, 1000) === "");
  const CV = read("ext", "timelinedock", "canvas.js"), TD = read("ext", "timelinedock", "timelinedock.js"), RI = read("routes", "index.js"), W = read("worker.py"), SB = read("ext", "timelinedock", "tlsizebar.js");
  check("the frame size reaches everything: the canvas (tl.frame over V1's size), ⚙ Compile's body, the route (normalized), the worker (V1 fitted in, centred on black)",
    /var fr = window\.H3FrameSize && tl\.frame \? H3FrameSize\.normalize\(tl\.frame\) : null;/.test(CV) && /frame: X\.frame && X\.frame\.w && X\.frame\.h \? \{ w: X\.frame\.w, h: X\.frame\.h \} : undefined/.test(TD)
    && /frame: frameSize\.normalize\(t\.frame\) \|\| undefined/.test(RI) && /allv = _fit_frame\(allv, tl\.get\("frame"\), run, say\)/.test(W) && /force_original_aspect_ratio=decrease/.test(W) && /pad=\{w\}:\{h\}:\(ow-iw\)\/2:\(oh-ih\)\/2:color=black/.test(W));
  check("the timeline's menu bar: width × height, Preset (Auto + the presets), Aspect, ☐ CAD toolbar; the ⌬ CAD buttons hidden (timeline + image editor)",
    /id="tlFrW"/.test(SB) && /id="tlFrH"/.test(SB) && /id="tlFrPreset"/.test(SB) && /id="tlFrAspect"/.test(SB) && /id="tlFrCad"/.test(SB)
    && /btn\.style\.display = "none";/.test(read("ext", "timelinedock", "tlcadbar.js")) && /btn\.style\.display = "none"; \}/.test(read("ext", "imageeditdock", "pccadbar.js")));
  /* ---- wiring */
  const RU = read("routes", "ueProject.js"), SU = read("static", "ueproject.js"), IX = read("static", "index.html");
  check("🎮 in the menu bar -> the folder dialog (Select) -> /api/ue/project/load at once; routes mounted from routes/index.js, not server.js",
    /b\.id = "projUe"/.test(SU) && /mode: "dir", title: "Select your Unreal project's folder", okLabel: "Select"/.test(SU) && /return go\(\{\}\);/.test(SU) && /\/api\/ue\/project\/load/.test(SU)
    && /app\.post\("\/api\/ue\/project\/load"/.test(RU) && /require\("\.\/ueProject"\)\.mount\(app\);/.test(RI) && !/ueProject/.test(read("server.js")) && /static\/ueproject\.js/.test(IX) && /static\/framesize\.js/.test(IX));
  const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
  check("wiring: tlsizebar.js in the timeline extension", EXT.includes("tlsizebar.js"));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
