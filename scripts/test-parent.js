/* bitGen Studio — 2.490.0: PARENTING + NULL OBJECTS (ext/timelinedock/tlparent.js, canvas.js, lib/layerBake.js,
 * routes/layerBake.js, lib/tlKeys.js, worker.py) - After Effects gap item 2. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), P = require(path.join(ROOT, "ext", "timelinedock", "tlparent.js"));
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); if (got !== undefined) console.log("      got " + JSON.stringify(got).slice(0, 400)); } }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-9);

{
  const pw = { x: 100, y: 50, scale: 2, rot: 90, ax: 0, ay: 0 }, w = P.compose(pw, { x: 10, y: 0, scale: 1, rot: 0 });
  check("compose: a child 10 px right of a parent turned 90° and scaled x2 sits 20 px below it, turned and scaled with it", near(w.x, 100, 1e-9) && near(w.y, 70, 1e-9) && w.scale === 2 && w.rot === 90);
  const pa = { x: -30, y: 12, scale: 0.7, rot: -33, ax: 15, ay: -8 }, child = { x: 44, y: -21, scale: 1.3, rot: 12, ax: 4, ay: 5 }, back = P.localOf(pa, P.compose(pa, child));
  check("localOf undoes compose (with the parent's anchor) - choosing a parent keeps the layer where it is", ["x", "y", "scale", "rot", "ax", "ay"].every((k) => near(back[k], child[k], 1e-9)), back);
  const d = P.deltaIn({ x: 0, y: 0, scale: 2, rot: 90 }, 10, 0);
  check("a drag on screen becomes a move in the parent's space (turned back, unscaled)", near(d[0], 0, 1e-9) && near(d[1], -5, 1e-9), d);
  const a = { id: "a" }, b = { id: "b", p: a }, c = { id: "c", p: b }, gp = (x) => x.p || null;
  check("no loops: a layer cannot follow its own child or grandchild; following an unrelated layer is fine", P.wouldLoop(gp, a, c) && P.wouldLoop(gp, a, b) && !P.wouldLoop(gp, c, { id: "d" }) && P.wouldLoop(gp, a, a));
}
// --- the bake on the server
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-tlb-"));
  const out = execFileSync(process.execPath, ["-e", `
    const core = require(${JSON.stringify(path.join(ROOT, "lib", "core.js"))});
    const TMP = ${JSON.stringify(tmp)};                                      // a throw-away project folder (never the real ones)
    core.getProject = () => "zz_tlbtest"; core.projDir = () => TMP; core.pDir = (k) => require("path").join(TMP, k); core.ensureProject = () => {};
    const B = require(${JSON.stringify(path.join(ROOT, "lib", "layerBake.js"))}), K = require(${JSON.stringify(path.join(ROOT, "lib", "tlKeys.js"))});
    const { execFileSync } = require("child_process");
    const png = execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=red@0.5:s=64x36,format=rgba", "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "-"]);
    (async () => {
      const r = {};
      try { B.saveFrame("x1", 0, Buffer.from("no")); } catch (e) { r.notPng = e.status; }
      try { B.saveFrame("", 0, png); } catch (e) { r.noId = e.status; }
      for (let i = 0; i < 6; i++) B.saveFrame("x1", i, png);
      const j = await B.encode("x1", { fps: 24, frames: 6 });
      r.j = j; r.file = !!B.fileOf(j.name); r.bad = B.fileOf("../etc/passwd"); r.other = B.fileOf("m3d_x.webm");
      r.keys = K.imageKeys({ name: "a.png", bake: j.name }, core.pDir("images")); r.nokeys = K.imageKeys({ name: "a.png", bake: "tlb_none.webm" }, core.pDir("images"));
      r.probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height:stream_tags=alpha_mode", "-of", "json", B.fileOf(j.name)], { encoding: "utf8" });
      console.log(JSON.stringify(r));
    })().catch((e) => console.log(JSON.stringify({ err: e.message })));`], { encoding: "utf8", cwd: ROOT }).trim().split("\n").pop();
  const r = JSON.parse(out), pr = r.probe ? JSON.parse(r.probe).streams[0] : {};
  check("layerBake: refuses a non-PNG frame and a missing id (400)", r.notPng === 400 && r.noId === 400, r);
  check("layerBake: 6 frames → video/tlb_x1.webm, VP9 with its transparency, the frames' size", r.j && r.j.name === "tlb_x1.webm" && r.j.frames === 6 && r.file && pr.codec_name === "vp9" && pr.width === 64 && (pr.tags || {}).alpha_mode === "1", [r.j, pr]);
  check("fileOf: only our own tlb_*.webm files that exist", r.bad === null && r.other === null);
  check("tlKeys: a baked clip carries its file to the compile; a missing bake carries nothing", r.keys.baked && /tlb_x1\.webm$/.test(r.keys.baked) && !r.nokeys.baked, r.keys);
  fs.rmSync(tmp, { recursive: true, force: true });
}
// --- the wiring
{
  const cv = read("ext/timelinedock/canvas.js"), tlx = read("ext/timelinedock/timelinedock.js"), w = read("worker.py"), idx = read("routes/index.js"), ext = JSON.parse(read("ext/timelinedock/ext.json")).scripts, src = read("ext/timelinedock/tlparent.js");
  check("canvas.js: box() uses the world transform for a parented clip; nulls never drawn; a move drag is turned into the parent's space; drawClip for the bake; bakes before export", /TlParent\.world\(c, t\)/.test(cv) && /if \(c\.nul\) return;/.test(cv) && /TlParent\.localDelta/.test(cv) && /function drawClip\(g, c, Ly, t\)/.test(cv) && /TlParent\.bakeAll\(\)/.test(cv));
  check("the export: nulls left out, a parented clip goes as its bake; routes/layerBake.js mounted from routes/index.js (not server.js)", /filter\(c => !c\.nul/.test(tlx) && /bake: \(?c\.parent/.test(tlx) && /&& c\.bake \? c\.bake : undefined/.test(tlx) && /require\("\.\/layerBake"\)\.mount\(app\)/.test(idx) && !/layerBake/.test(read("server.js")));
  check("worker.py: a baked clip read with its transparency (libvpx-vp9) and overlaid as it is", /if c\.get\("baked"\) and Path\(c\["baked"\]\)\.exists\(\):/.test(w) && /args \+= \["-c:v", "libvpx-vp9", "-i", c\["baked"\]\]/.test(w) && /a baked layer \(it follows its parent\)/.test(w));
  check("tlparent.js loads after tlgraph.js; no product names", ext.indexOf("tlparent.js") > ext.indexOf("tlgraph.js") && !/After Effects|Adobe/.test(src.replace(/^\s*\*.*$/gm, "")));
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
