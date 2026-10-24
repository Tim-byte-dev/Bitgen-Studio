#!/usr/bin/env node
/* bitGen Studio — scripts/test-uelive590.js (2.590.0): 📺 THE UNREAL VIEW (static/uelive.js, lib/ueLive.js, routes/unreal.js,
 * ext/imageeditdock/pcuelive.js, ext/timelinedock/tluelive.js, the bitGen Bridge 1.5.0 "frame" / "keep_fast") and the
 * image editor's DOCKER TABS (ext/imageeditdock/pctabdock.js) + 🎨 ARTIST MODE. Tim: "do i have to keep the unreal window
 * open? show the unreal window in timeline and image-editor when selected. make all the tabs in image-editor into
 * floating dockers ... when a docker is dropped on another docker make it a tabbed docker - i can't find the full screen
 * canvas button (lets call the full screen canvas button artist mode)". Against scripts/ue-stub.js (a stand-in for the
 * editor: 1.5.0, and as a 1.4.0 one). No studio. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const UL = require("../static/uelive.js");
const PL = require("../ext/imageeditdock/pcuelive.js");
const TD = require("../ext/imageeditdock/pctabdock.js");
const TU = require("../ext/timelinedock/tlunreal.js");
const PU = require("../ext/imageeditdock/pcunreal.js");

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-uelive590-"));
  try {
    // ---- the page's pure parts
    const s1 = UL.frameSize(1920, 1080, 640), s2 = UL.frameSize(1080, 1920, 960), s3 = UL.frameSize(4000, 1000, 960);
    check("frameSize: the layer's aspect at the picked width, even numbers, at most 1280 x 720", s1.w === 640 && s1.h === 360 && s2.h <= 720 && s2.w % 2 === 0 && Math.abs(s2.w / s2.h - 1080 / 1920) < 0.02 && s3.w === 960 && s3.h === 240, [s1, s2, s3]);
    check("nextDelay: a breath after a frame, backing off after errors (to 5 s)", UL.nextDelay(true, 0) === 60 && UL.nextDelay(false, 1) === 800 && UL.nextDelay(false, 2) === 1600 && UL.nextDelay(false, 9) === 5000);
    const framing = (p, turn) => ({ camera: { loc: [100, 0, 160], rot: [0, 0, 180 + turn], fov: 30 }, figure: { loc: [0, 0, 0], rot: [0, 0, turn] } });
    const keys = [{ t: 0, loc: [0, 0, 100], rot: [0, 0, 0], fov: 50 }, { t: 4, loc: [400, 0, 100], rot: [0, 0, 90], fov: 30 }];
    const cam = UL.clipRequest({ start: 10, in: 0, ue: { kind: "camera", keys, dur: 4, level: "/Game/Maps/Studio", lens: { focal: 35 } } }, 12, framing, TU.keyAt);
    check("clipRequest - an Unreal camera clip: the camera between its keys at the playhead (clip time = playhead - start + in), its level + lens",
      cam.camera.loc[0] === 200 && Math.abs(cam.camera.rot[2] - 45) < 1e-6 && cam.camera.fov === 40 && cam.level === "/Game/Maps/Studio" && cam.lens.focal === 35, cam);
    const sq = UL.clipRequest({ start: 2, in: 1, ue: { kind: "sequence", sequence: "/Game/Cine/Seq_Intro", dur: 8 } }, 5, framing, TU.keyAt);
    const mh = UL.clipRequest({ start: 0, ue: { kind: "metahuman", metahuman: { bp: "/Game/MetaHumans/Ada/BP_Ada", anim: "/Game/A/Walk" }, preset: "bust", turn: 20, dur: 5 } }, 2.5, framing, TU.keyAt);
    const sc = UL.clipRequest({ start: 0, ue: { kind: "scene", camera: { loc: [1, 2, 3], rot: [0, 0, 9], fov: 70 } } }, 1, framing, TU.keyAt);
    check("clipRequest - a sequence clip: the sequence at its own time (4 s); a MetaHuman clip: the figure posed at the playhead, only the figure; a held scene: its camera; no Unreal = null",
      sq.sequence === "/Game/Cine/Seq_Intro" && sq.time === 4 && mh.metahuman.time === 2.5 && mh.metahuman.anim === "/Game/A/Walk" && mh.onlyMetahuman && mh.alpha && mh.camera.rot[2] === 200
      && sc.camera.fov === 70 && UL.clipRequest({ ue: null }, 0) === null && UL.clipRequest(null, 0) === null, { sq, mh, sc });
    const L = { smart: { ue: { kind: "scene", camera: { name: "CineCam_Wide", yaw: 10 }, w: 1920, h: 1080, level: "/Game/Maps/Studio", lens: { fstop: 2.8 } } } };
    const r = PL.requestOf(L, PU.stillRequest, framing);
    check("image editor: the active Unreal layer -> its still's request (the camera with the tool's nudges, lens, size); another layer = null",
      r.camera.name === "CineCam_Wide" && r.camera.yaw === 10 && r.lens.fstop === 2.8 && r.w === 1920 && PL.requestOf({ smart: null }, PU.stillRequest, framing) === null && PL.requestOf(null) === null, r);

    // ---- the server against the stand-in editor
    const stub = require("./ue-stub");
    const S = await stub.start(39000 + Math.floor(Math.random() * 900));
    const core = require("../lib/core");
    const cfg = core.getConfig(); const keepU = cfg.unreal; cfg.unreal = { port: S.port };
    const ueLive = require("../lib/ueLive");
    const dir = path.join(tmp, "live");
    fs.mkdirSync(dir);
    const f1 = await ueLive.frame({ camera: { name: "CineCam_Close" }, w: 640, h: 360, client: "tab/1" }, { dir });
    const sent = S.calls.filter((c) => c.cmd === "frame").pop();
    check("frame (bridge 1.5.0): one 'frame' call, the size kept, the client's own file (overwritten each time), a PNG",
      f1.file === path.join(dir, "live_tab1.png") && !f1.legacy && sent && sent.args.w === 640 && sent.args.h === 360 && fs.readFileSync(f1.file).slice(1, 4).toString() === "PNG" && S.state.frames === 1, { f1, sent });
    const big = ueLive.cleanFrame({ camera: { viewport: true }, w: 4000, h: 3000 });
    check("cleanFrame: a live frame is at most 1280 x 720; a sequence must be an asset path", big.w === 1280 && big.h === 720 && (() => { try { ueLive.cleanFrame({ sequence: "../x" }); return false; } catch (e) { return e.status === 400; } })());
    await ueLive.frame({ sequence: "/Game/Cine/Seq_Intro", time: 3.5, w: 480, h: 270 }, { dir });
    check("a sequence clip: the bridge gets the sequence + its time", S.state.seqAt && S.state.seqAt.sequence === "/Game/Cine/Seq_Intro" && S.state.seqAt.time === 3.5);
    const kf = await ueLive.keepFast(true);
    check("keep_fast: the editor keeps full speed behind bitGen", kf.throttled === false && S.state.throttled === false);
    await S.close();
    const S2 = await stub.start(39900 + Math.floor(Math.random() * 90), { legacy: true });
    cfg.unreal = { port: S2.port };
    const f2 = await ueLive.frame({ camera: { viewport: true }, w: 640, h: 360 }, { dir });
    check("an older bridge (1.4.0, no 'frame'): its still is used instead (legacy said)", f2.legacy && S2.calls.some((c) => c.cmd === "still") && fs.existsSync(f2.file));
    const seqOld = await ueLive.frame({ sequence: "/Game/Cine/Seq_Intro", time: 1 }, { dir }).then(() => null, (e) => e);
    const kfOld = await ueLive.keepFast(true).then(() => null, (e) => e);
    check("an older bridge: a sequence clip / ⚡ keep fast say to update the plugin", seqOld && /1\.5\.0/.test(seqOld.message) && kfOld && /older than 1\.5\.0/.test(kfOld.message) && /Use Less CPU when in Background/.test(kfOld.message));
    await S2.close();
    cfg.unreal = keepU;

    // ---- the bridge plugin 1.5.0
    const BP = rd("ue", "bitGenBridge", "Content", "Python", "bitgen_bridge.py"), UP = JSON.parse(rd("ue", "bitGenBridge", "bitGenBridge.uplugin")), RM = rd("ue", "README.txt");
    check("bridge 1.5.0: frame (a still that settles one frame; a sequence opened at the time, the viewport locked to its camera cut), keep_fast (throttle_cpu_when_not_foreground)",
      /VERSION = "1\.5\.0"/.test(BP) && UP.VersionName === "1.5.0" && /def cmd_frame\(a\):/.test(BP) && /b\["settle"\] = 1/.test(BP) && /range\(max\(1, int\(a\.get\("settle"\) or 3\)\)\)/.test(BP)
      && /set_lock_camera_cut_to_viewport\(True\)/.test(BP) && /les\.set_current_time\(frame\)/.test(BP) && /return \(yield from cmd_still\(b\)\)/.test(BP)
      && /throttle_cpu_when_not_foreground/.test(BP) && /"frame": cmd_frame, "keep_fast": cmd_keep_fast/.test(BP) && /does not have to be in\s+front or on screen/.test(RM));
    const RU = rd("routes", "unreal.js");
    check("routes: POST /api/unreal/frame (the PNG + X-UE-Ms / X-UE-Legacy), POST /api/unreal/keepfast", /app\.post\("\/api\/unreal\/frame"/.test(RU) && /"X-UE-Legacy"/.test(RU) && /app\.post\("\/api\/unreal\/keepfast"/.test(RU));

    // ---- the docker tabs (pure)
    const col = { left: 1000, right: 1300, top: 100, bottom: 900 };
    const parts = [{ g: "color", rect: { left: 1000, right: 1300, top: 100, bottom: 300 }, col: true }, { g: "layers", rect: { left: 1000, right: 1300, top: 310, bottom: 700 }, col: true }];
    const fl = { g: "td1", rect: { left: 300, right: 600, top: 200, bottom: 500 }, col: false };
    const kx = { left: 0, right: 1300, top: 0, bottom: 900 };
    const T = (x, y, src, whole) => TD.dropTarget(x, y, parts.concat([fl]), col, kx, src, whole);
    check("dropTarget: the middle of a docker = a tab of it; its top / bottom edge = a docker of its own above / below; below the last = the end; a floating docker = into it",
      T(1150, 200, "x").kind === "into" && T(1150, 200, "x").g === "color" && T(1150, 110, "x").kind === "col" && T(1150, 110, "x").index === 0 && T(1150, 295, "x").index === 1
      && T(1150, 800, "x").kind === "col" && T(1150, 800, "x").index === 2 && T(400, 300, "color").g === "td1");
    check("dropTarget: elsewhere in the editor = it floats; outside the editor = nothing; its own docker = nothing changes (a whole docker onto itself = null)",
      T(100, 100, "color").kind === "float" && T(2000, 100, "color") === null && T(1150, 500, "layers").kind === "same" && T(1150, 500, "layers", true) === null);
    const kept = TD.layoutOf([{ g: "td3", where: "float", tabs: ["kuelive", "gone"], active: "kuelive", rect: { x: 1, y: 2, w: 300, h: 200 } }, { g: "layers", where: "col", tabs: ["pcLayers", "pcColor"] }], ["layers", "td3"]);
    const plan = TD.restorePlan(kept, { kuelive: "props", pcLayers: "layers", pcColor: "color" }, ["color", "props", "layers", "dock"]);
    check("restorePlan: the dockers to make again, each tab moved where it was kept (a tab that is not there any more left out), the column order",
      plan.make.join() === "td3" && JSON.stringify(plan.moves) === '[["kuelive","td3"],["pcColor","layers"]]' && plan.col.join() === "layers,td3" && TD.restorePlan(null, {}, []).moves.length === 0, plan);
    check("clampRect: a floating docker stays inside the editor", JSON.stringify(TD.clampRect({ x: -50, y: 900, w: 9000, h: 50 }, 1000, 700)) === '{"x":0,"y":580,"w":1000,"h":120}' && TD.clampRect({ x: 900, y: 10, w: 300, h: 300 }, 1000, 700).x === 700);

    // ---- the wiring
    const EXT = JSON.parse(rd("ext", "imageeditdock", "ext.json")).scripts, IE = rd("ext", "imageeditdock", "imageedit.js"), TEXT = JSON.parse(rd("ext", "timelinedock", "ext.json")).scripts, PF = rd("ext", "imageeditdock", "pcfocus.js"), H = rd("static", "index.html");
    check("wiring: pcuelive.js + pctabdock.js load before the editor; the Unreal View installs before the tab docker, the tab docker LAST (every tab exists), the 📺 tab floated once; tluelive.js after tlunreal.js; uelive.js after unreal.js",
      EXT.indexOf("pcuelive.js") < EXT.indexOf("pctabdock.js") && EXT.indexOf("pctabdock.js") < EXT.indexOf("imageedit.js") && IE.indexOf("PCUELive.install(E)") < IE.indexOf("PCTabDock.install(E)") && IE.indexOf("PCSubject.install(E)") < IE.indexOf("PCTabDock.install(E)")
      && IE.indexOf("PCTabDock.install(E)") < IE.indexOf("PCUELive.placeFirst(E)") && TEXT.indexOf("tluelive.js") === TEXT.indexOf("tlunreal.js") + 1 && H.indexOf('src="/static/uelive.js"') > H.indexOf('src="/static/unreal.js"') && /id: "u_live", label: "📺 Unreal View"/.test(rd("ext", "timelinedock", "tlunreal.js")));
    check("🎨 Artist mode: a labelled button right after the menus (File … Help) + View ▸ Artist Mode, Ctrl+Shift+F", /b\.innerHTML = "🎨 <span>Artist mode<\/span>"/.test(PF) && /menus\.after\(b\)/.test(PF) && /"view\.focus", "🎨 Artist Mode \(canvas only\)", "Shift\+Ctrl\+F"/.test(PF));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
