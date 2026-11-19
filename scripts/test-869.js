#!/usr/bin/env node
/* bitGen Studio — 2.869.0 units: 🕺 RGB MoCap for the timeline (lib/rgbMocap.js): Windows only (said), install = git clone + its
 * install.cmd (a stand-in runner), a clip's used part cut by ffmpeg into projects/<p>/mocap/<clip>/ with the "export here" note, the
 * results (.fbx / .bvh) listed newest first, ⤓ an .fbx copied into models3d, a .bvh through Blender (a stand-in) or refused without it,
 * paths that climb out refused; the add-on card, the routes (not server.js), the timeline panel. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const core = require(path.join(ROOT, "lib/core.js")), R = require(path.join(ROOT, "lib/rgbMocap.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t869-")), proj = path.join(tmp, "proj");
  const keep = { projDir: core.projDir, getProject: core.getProject, pDir: core.pDir };
  core.projDir = () => proj; core.getProject = () => "Shoot"; core.pDir = (k) => { const d = path.join(proj, k); fs.mkdirSync(d, { recursive: true }); return d; };
  R.setBase(tmp);
  try {
    R.setWin(false);
    let e = ""; try { await R.install(() => {}); } catch (x) { e = x.message + x.status; }
    check("not Windows: said (409), nothing cloned", /Windows only/.test(e) && /409/.test(e) && !R.status().cloned && R.status().windows === false, e);
    R.setWin(true); const calls = [];
    R.setRun(async (cmd, args, o) => { calls.push([cmd, args, o && o.cwd]); if (cmd === "git") { fs.mkdirSync(path.join(args[4], "runtime"), { recursive: true }); fs.writeFileSync(path.join(args[4], "RGBMoCap.cmd"), "@echo off"); } if (args[1] === "install.cmd") fs.writeFileSync(path.join(R.status().dir, "runtime", "python.exe"), ""); return 0; });
    const lines = []; const st = await R.install((l) => lines.push(l));
    check("install on Windows: git clone of toyxyz_RGBMocap into <app>/rgbmocap, then its install.cmd in that folder; installed", calls[0][0] === "git" && calls[0][1].includes("https://github.com/toyxyz/toyxyz_RGBMocap.git") && calls[1][0] === "cmd" && calls[1][1].join(" ") === "/c install.cmd" && calls[1][2] === st.dir && st.installed && /rgbmocap[\\/]toyxyz_RGBMocap$/.test(st.dir), calls);
    await R.install(() => {}, { update: true });
    check("...again with update: update.cmd (no second clone)", calls[2][1].join(" ") === "/c update.cmd" && calls.filter((c) => c[0] === "git").length === 1);
    // prepare with the real ffmpeg
    R.setRun(null);
    fs.mkdirSync(path.join(proj, "video"), { recursive: true });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30:duration=4", "-pix_fmt", "yuv420p", path.join(proj, "video", "dance take 1.mp4")]);
    const p = await R.prepare({ name: "dance take 1.mp4", src: "video", in: 1, out: 2.5 });
    const dur = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p.video]).toString();
    check("✂ prepare: the clip's used part (1 s -> 2.5 s) cut to projects/<p>/mocap/<clip>_10-25/<clip>_10-25.mp4 + 'EXPORT HERE.txt'", /mocap[\\/]dance_take_1_10-25[\\/]dance_take_1_10-25\.mp4$/.test(p.video) && Math.abs(dur - 1.5) < 0.1 && fs.existsSync(path.join(p.folder, "EXPORT HERE.txt")) && p.rel === "mocap/dance_take_1_10-25/dance_take_1_10-25.mp4", { p, dur });
    e = ""; try { await R.prepare({ name: "nope.mp4" }); } catch (x) { e = x.message; } check("...a clip whose video is gone: said", /not found/.test(e));
    // results + bring
    fs.writeFileSync(path.join(p.folder, "take.fbx"), "FBX"); await new Promise((r) => setTimeout(r, 15)); fs.writeFileSync(path.join(p.folder, "take.bvh"), "HIERARCHY");
    let r = R.results();
    check("the results: .fbx + .bvh in the mocap folder, newest first, not yet on the timeline", r.results.length === 2 && r.results[0].name === "take.bvh" && r.results[1].kind === "fbx" && !r.results[1].inTimeline && r.status.installed, r.results);
    const b1 = await R.bring({ rel: "dance_take_1_10-25/take.fbx" });
    check("⤓ an .fbx: copied into models3d as mocap_<folder>_<name>.fbx (a 3D layer plays it); listed as on the timeline", b1.model === "mocap_dance_take_1_10-25_take.fbx" && fs.readFileSync(path.join(proj, "models3d", b1.model), "utf8") === "FBX" && R.results().results.find((x) => x.kind === "fbx").inTimeline, b1);
    const B = require(path.join(ROOT, "lib/blender.js")), keepFind = B.find;
    B.find = () => null; e = ""; try { await R.bring({ rel: "dance_take_1_10-25/take.bvh" }); } catch (x) { e = x.message; }
    check("⤓ a .bvh without Blender: said (Blender's path, or export FBX)", /Blender/.test(e) && /export FBX/.test(e), e);
    const seen = []; B.find = () => "/fake/blender";
    R.setRun(async (cmd, args) => { seen.push([cmd, args]); fs.writeFileSync(args[args.length - 1], "FBX from BVH"); return 0; });
    const b2 = await R.bring({ rel: "dance_take_1_10-25/take.bvh" });
    check("⤓ a .bvh: Blender (-b) runs scripts/bvh_to_fbx.py -- in.bvh out.fbx, the .fbx in models3d", b2.via === "blender" && seen[0][0] === "/fake/blender" && seen[0][1].includes("-b") && /scripts[\\/]bvh_to_fbx\.py$/.test(seen[0][1][3]) && /take\.bvh$/.test(seen[0][1][5]) && fs.existsSync(path.join(proj, "models3d", b2.model)), seen);
    B.find = keepFind;
    e = ""; try { await R.bring({ rel: "../../etc/passwd" }); } catch (x) { e = x.message; } let e2 = ""; try { await R.bring({ rel: "a/notes.txt" }); } catch (x) { e2 = x.message; }
    check("paths that climb out, or that are not .fbx / .bvh: refused", /no such result/.test(e) && /no such result/.test(e2));
    R.setWin(false); e = ""; try { R.open(); } catch (x) { e = x.message; } check("open on another system: said", /Windows only/.test(e));
  } finally { Object.assign(core, keep); fs.rmSync(tmp, { recursive: true, force: true }); }
  const BV = src("scripts/bvh_to_fbx.py"), A = require(path.join(ROOT, "lib/addons.js")), card = (await A.list()).find((x) => x.id === "rgbmocap");
  check("bvh_to_fbx.py: import_anim.bvh -> export_scene.fbx with the animation baked", /import_anim\.bvh\(/.test(BV) && /export_scene\.fbx\(/.test(BV) && /bake_anim=True/.test(BV));
  check("Settings ▸ Add-ons ▸ RGB MoCap: Windows + NVIDIA, the sizes (~32 GB + ~70 GB of models), MIT with each model's own licence, its links", card && /Windows/.test(card.needs) && /70 GB/.test(card.size) && /MIT/.test(card.for) && /own licence/.test(card.for));
  const RI = src("routes/index.js"), T = src("ext/timelinedock/tlmocap.js"), E = JSON.parse(src("ext/timelinedock/ext.json"));
  check("wiring: routes/rgbMocap.js mounted from routes/index.js (not server.js); the timeline's 🕺 Mocap (tlmocap.js) - prepare, open, the list, ⤓ = TlM3D.add model", /require\("\.\/rgbMocap"\)\.mount\(app\)/.test(RI) && !/rgbMocap/.test(src("misc/server.js")) && E.scripts.includes("tlmocap.js") && /\/api\/mocap\/rgb\/prepare/.test(T) && /\/api\/mocap\/rgb\/open/.test(T) && /TlM3D\.add\("model", r\.model/.test(T));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
