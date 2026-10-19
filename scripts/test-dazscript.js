#!/usr/bin/env node
/* bitGen Studio — 2.405.0: the Daz Studio bridge script (daz/bitgen_bridge/bitGen Bridge.dsa) run in a MOCK Daz Studio
 * (the DAZ Script objects it uses, recorded) whose curl is the REAL curl talking to the REAL app (H3_URL), which uses a
 * REAL Blender / ffmpeg - Daz itself cannot run here.
 * Tim (verbatim): "can we have a daz3d to bitgen bridge?" + "can we add option to merge daz3d scene with blender scene -
 * create a dialog for list of objects, lights, cameras to merge. dialogs must have a titlebar".
 *   1. the dialog: a window titled "bitGen Bridge 1.0.0", the five sends, the address remembered; Test connection pings
 *   2. Render the animation: Daz's render options set to an image series of the play range and PUT BACK after; the
 *      frames -> bitGen -> daz_<scene>.mp4 in Video assets (frames = the range), the LTX 2.3 3DREAL job queued
 *   3. Render this frame: a still -> the Gallery + Images assets
 *   4. The scene as 3D: Daz's FBX exporter run silently with the bridge's options (lights / cameras / animation, embedded
 *      textures) -> bitGen's Blender -> blender/daz/<scene>.blend open in the preview
 *   5. ... merge: held for bitGen's Merge dialog (its objects / lights / cameras listed)
 *   6. The selected figure: FBX of the selection -> models3d/<figure>.glb
 *   7. nothing to send / bitGen not answering -> Daz's warning box in words
 * Needs the running app (H3_URL, default :8311); the 3D parts SKIP without Blender. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync, execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/+$/, "");
const SRC = fs.readFileSync(path.join(ROOT, "daz", "bitgen_bridge", "bitGen Bridge.dsa"), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
let blender = "";
try { blender = execSync("command -v blender", { encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { blender = ""; }
const P = "zz_dazs_" + process.pid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "dazs_"));
const api = (u, body) => JSON.parse(execFileSync("curl", ["-s", "-X", body ? "POST" : "GET", "-H", "Content-Type: application/json",
  ...(body ? ["--data-binary", JSON.stringify(body)] : []), URL_ + u], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }) || "{}");

// a "Daz" scene as FBX (made by Blender): a rigged, animated figure, a prop, a spot light, a camera
let FBX = "";
if (blender) {
  fs.writeFileSync(path.join(TMP, "mk.py"), `
import bpy, sys
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc = bpy.context.scene; sc.render.fps = 30
bpy.ops.object.armature_add(location=(0, 0, 0)); arm = bpy.context.active_object; arm.name = "Genesis 9"
bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=1.7, location=(0, 0, 0.85)); body = bpy.context.active_object; body.name = "Genesis 9 Mesh"
body.parent = arm; m = body.modifiers.new("Armature", "ARMATURE"); m.object = arm
vg = body.vertex_groups.new(name="Bone"); vg.add([v.index for v in body.data.vertices], 1.0, "REPLACE")
arm.keyframe_insert("location", frame=0); arm.location = (2, 0, 0); arm.keyframe_insert("location", frame=30)
bpy.ops.mesh.primitive_cube_add(size=1, location=(3, 3, 0.5)); bpy.context.active_object.name = "Crate"
bpy.ops.object.light_add(type="SPOT", location=(4, -4, 5)); bpy.context.active_object.name = "Spotlight 1"
bpy.ops.object.camera_add(location=(0, -8, 1.6), rotation=(1.5, 0, 0)); bpy.context.active_object.name = "Camera 1"
bpy.ops.export_scene.fbx(filepath=sys.argv[-1], bake_anim=True, add_leaf_bones=False)
`);
  execFileSync(blender, ["-b", "--factory-startup", "-P", path.join(TMP, "mk.py"), "--", path.join(TMP, "daz.fbx")], { stdio: "ignore", timeout: 300000 });
  FBX = path.join(TMP, "daz.fbx");
}

/* ---------- a mock Daz Studio */
function daz(opts) {
  const o = opts || {};
  const rec = { widgets: [], connects: [], renders: [], exports: [], procs: [], boxes: [], settings: o.settings || {}, optsLog: [] };
  const T = path.join(TMP, "daztemp_" + Math.random().toString(16).slice(2, 8));
  fs.mkdirSync(T, { recursive: true });
  class W { constructor(parent) { this.parent = parent; this.text = ""; this.checked = false; this.title = ""; rec.widgets.push(this); } }
  class DzComboBox extends W { constructor(p) { super(p); this.items = []; this.currentItem = 0; } addItem(t) { this.items.push(t); } }
  const store = rec.settings;
  class DzAppSettings {
    constructor(k) { this.k = k; rec.settingsKey = k; }
    getStringValue(n, d) { return n in store ? String(store[n]) : d; } setStringValue(n, v) { store[n] = String(v); }
    getIntValue(n, d) { return n in store ? +store[n] : d; } setIntValue(n, v) { store[n] = +v; }
    getBoolValue(n, d) { return n in store ? !!store[n] : d; } setBoolValue(n, v) { store[n] = !!v; }
  }
  class DzBasicDialog { constructor() { rec.dialog = this; this.added = []; }
    setAcceptButtonText(t) { this.accept = t; } addWidget(w) { this.added.push(w); }
    exec() { if (o.onDialog) o.onDialog(rec); return o.cancel ? false : true; } }
  class DzFile {
    constructor(p) { this.p = p; } exists() { return fs.existsSync(this.p); }
    open(m) { this.m = m; if (m === 1 && !fs.existsSync(this.p)) return false; if (m === 2) this.buf = ""; return true; }
    write(t) { this.buf += t; } read() { return fs.readFileSync(this.p, "utf8"); }
    close() { if (this.m === 2) fs.writeFileSync(this.p, this.buf); }
  }
  DzFile.ReadOnly = 1; DzFile.WriteOnly = 2;
  class DzDir { constructor(p) { this.p = p; }
    mkpath(p) { fs.mkdirSync(p, { recursive: true }); return true; }
    entryList(filters) { const rx = filters.map((f) => new RegExp("^" + f.replace(".", "\\.").replace("*", ".*") + "$", "i"));
      return fs.existsSync(this.p) ? fs.readdirSync(this.p).filter((n) => rx.some((r) => r.test(n))).sort() : []; } }
  DzDir.Files = 2; DzDir.Name = 0;
  class DzProcess {
    constructor(args) { this.args = args; this.running = false; this.out = ""; rec.procs.push(args); }
    start() {
      // the REAL curl (without the Windows path the script looks for first)
      const a = this.args.slice(1);
      try { this.out = execFileSync(o.curl || "curl", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 600000 }); }
      catch (e) { this.out = String(e.stdout || ""); }
      return true;
    }
    readStdout() { const s = this.out; this.out = ""; return s; }
  }
  const STEP = 160;                                                 // 30 fps (4800 ticks a second)
  const ropts = { renderImgToId: 0, renderImgFilename: "C:/keep/me.png", renderMovToId: 0, renderSerFilename: "C:/keep/series.png",
    startTime: 0, endTime: 4800, isCurrentFrameRender: true, applyChanges() { rec.optsLog.push(Object.assign({}, this)); } };
  const App = {
    versionString: "4.24.0.3", getTempPath: () => T,
    getRenderMgr: () => ({
      getRenderOptions: () => ropts,
      doRender: (op) => {
        rec.renders.push(Object.assign({}, op));
        if (o.renderFails) return false;
        const dir = path.dirname(op.renderImgFilename);
        if (!op.isCurrentFrameRender) {                             // Daz writes the series as <name>_000.png ...
          const n = Math.round((op.endTime - op.startTime) / STEP) + 1;
          execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `testsrc2=size=1920x1080:rate=30`, "-frames:v", String(n),
            path.join(dir, "frame_%03d.png")]);
        } else execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1000x1000", "-frames:v", "1", op.renderImgFilename]);
        return true;
      } }),
    getExportMgr: () => ({ findExporterByClassName: (n) => (n !== "DzFbxExporter" ? null : {
      getOptions: (st, show, s) => { rec.getOptions = [show, s]; return true; },
      writeFile: (file, st) => { rec.exports.push({ file, set: Object.assign({}, st.v) }); if (FBX) fs.copyFileSync(FBX, file); return 0; },
      deleteLater: () => { rec.exporterDeleted = true; } }) }),
  };
  class DzFileIOSettings { constructor() { this.v = {}; } setBoolValue(k, v) { this.v[k] = v; } setStringValue(k, v) { this.v[k] = v; } setIntValue(k, v) { this.v[k] = v; } }
  const Scene = { getTimeStep: () => STEP, getPlayRange: () => ({ start: 0, end: (o.frames == null ? 30 : o.frames) * STEP }), getTime: () => 12 * STEP,
    getFilename: () => "/Users/tim/Daz/My Shot.duf",
    getPrimarySelection: () => (o.noSelection ? null : { name: "Genesis9", getLabel: () => "Genesis 9", getSkeleton: () => null }) };
  const MessageBox = { information: (t, title) => { rec.boxes.push({ kind: "info", t, title }); }, warning: (t, title) => { rec.boxes.push({ kind: "warn", t, title }); } };
  const ctx = { App, Scene, MessageBox, DzAppSettings, DzBasicDialog, DzFile, DzDir, DzProcess, DzFileIOSettings,
    DzRenderOptions: { DirectToFile: 2, ImageSeries: 1, ActiveView: 0, NewWindow: 1, MovieFile: 0 },
    DzVGroupBox: W, DzLineEdit: W, DzLabel: W, DzPushButton: W, DzCheckBox: W, DzComboBox,
    connect: (s, sig, fn) => rec.connects.push({ s, sig, fn }), processEvents: () => {}, JSON, Date, Math, parseInt, parseFloat, isFinite, String, Array };
  vm.runInNewContext(SRC, ctx, { filename: "bitGen Bridge.dsa" });
  rec.ropts = ropts; rec.T = T;
  return rec;
}
const W = (rec, cls, re) => rec.widgets.find((w) => (!cls || w.constructor.name === cls) && re.test(String(w.text || w.title || "")));

try {
  api("/api/projects/load", { name: P });
  const pd = path.join(ROOT, "projects", P);
  // 1
  const r0 = daz({ settings: { url: URL_ }, cancel: true, onDialog: (rec) => { const t = rec.connects.find((c) => c.sig === "clicked()"); if (t) t.fn(); } });
  const combo = r0.widgets.find((w) => w.constructor.name === "DzComboBox");
  const conn = r0.widgets.find((w) => /^Connected:|^No answer/.test(String(w.text || "")));
  check("the dialog: a window titled 'bitGen Bridge 1.0.0' (Daz's own title bar), the five sends, 'Send to bitGen'",
    r0.dialog.caption === "bitGen Bridge 1.0.0" && combo && combo.items.length === 5 && r0.dialog.accept === "Send to bitGen"
    && /Render the animation -> real/.test(combo.items[0]) && /merge into the scene open in bitGen/.test(combo.items[3]), { caption: r0.dialog.caption, items: combo && combo.items });
  check("Test connection asks bitGen (curl GET /api/daz/ping) and says it is connected", conn && /^Connected: bitGen Studio /.test(conn.text)
    && r0.procs.some((a) => a[a.length - 1] === URL_ + "/api/daz/ping"), conn && conn.text);
  check("cancelled: nothing rendered / exported / sent", !r0.renders.length && !r0.exports.length && r0.procs.length === 1);
  check("the play range told: frames 0 - 30 at 30 fps (1.0 s)", !!W(r0, "", /frames 0 - 30 at 30 fps \(1\.0 s\)/));

  // 2
  const r1 = daz({ settings: { mode: 0, url: URL_, look: "a rainy street", now: false } });
  const ro = r1.renders[0] || {};
  check("Render the animation: Daz's options = an image series of the play range (0..30 frames) to its temp folder",
    ro.renderMovToId === 1 && ro.isCurrentFrameRender === false && ro.startTime === 0 && ro.endTime === 30 * 160 && /bitgen_bridge/.test(ro.renderSerFilename), ro);
  check("... and Daz's own render options are put back after", r1.ropts.renderSerFilename === "C:/keep/series.png" && r1.ropts.renderImgFilename === "C:/keep/me.png"
    && r1.ropts.isCurrentFrameRender === true && r1.ropts.endTime === 4800, r1.ropts);
  const sent = r1.procs.find((a) => a[a.length - 1] === URL_ + "/api/daz/send") || [];
  const bodyF = (sent.find((x) => String(x).startsWith("@")) || "").slice(1);
  const body = bodyF && fs.existsSync(bodyF) ? JSON.parse(fs.readFileSync(bodyF, "utf8")) : {};
  check("ONE JSON POST with curl (Content-Type json, --data-binary @file): kind render, 31 frame paths, fps 30, the look",
    sent.includes("-X") && sent.includes("Content-Type: application/json") && body.kind === "render" && body.frames && body.frames.length === 31
    && body.fps === 30 && body.prompt === "a rainy street" && body.name === "My_Shot", { sent, body: { ...body, frames: (body.frames || []).length } });
  const vids = fs.existsSync(path.join(pd, "video")) ? fs.readdirSync(path.join(pd, "video")).filter((f) => /^daz_My_Shot/.test(f)) : [];
  let nf = 0;
  try { nf = +execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames,width,height", "-of", "csv=p=0",
    path.join(pd, "video", vids[0])], { encoding: "utf8" }).trim().split(",")[2]; } catch { nf = 0; }
  const wh = vids[0] ? execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path.join(pd, "video", vids[0])], { encoding: "utf8" }).trim() : "";
  check("bitGen: daz_My_Shot.mp4 in Video assets, 31 frames, 1920x1080 -> 1280x704 (long side 1280, multiples of 32); Daz's box says so",
    vids.length === 1 && nf === 31 && wh === "1280,704" && r1.boxes.some((b) => b.kind === "info" && /31 frames -> Video assets daz_My_Shot/.test(b.t)), { vids, nf, wh, boxes: r1.boxes });
  const r1b = daz({ settings: { mode: 0, url: URL_, look: "x", now: true } });
  const ib = api("/api/daz/inbox?since=0").items.filter((i) => i.kind === "render");
  const jb = ib.length ? ib[ib.length - 1].job : null;
  const job = jb ? api("/api/jobs/" + jb) : {};
  check("'Render in bitGen right away': the LTX 2.3 3DREAL job queued on that video", jb && (job.params || {}).ltx_mode === "3dreal"
    && r1b.boxes.some((b) => /LTX 2\.3 3DREAL job/.test(b.t)), { ib: ib.slice(-1), mode: (job.params || {}).ltx_mode, boxes: r1b.boxes });
  if (jb) api("/api/jobs/" + jb + "/cancel", {});

  // 3
  const r2 = daz({ settings: { mode: 1, url: URL_ } });
  const pics = fs.existsSync(path.join(pd, "output")) ? fs.readdirSync(path.join(pd, "output")).filter((f) => /^daz_My_Shot_f12/.test(f)) : [];
  const imgs = fs.existsSync(path.join(pd, "images")) ? fs.readdirSync(path.join(pd, "images")).filter((f) => /^daz_My_Shot_f12/.test(f)) : [];
  check("Render this frame: one still (current frame 12) -> the Gallery + Images assets as daz_My_Shot_f12.png",
    (r2.renders[0] || {}).isCurrentFrameRender === true && pics.length === 1 && imgs.length === 1 && r2.boxes.some((b) => /Gallery/.test(b.t)), { pics, imgs, boxes: r2.boxes });

  if (!blender) console.log("SKIP: Blender is not installed here - the 3D sends did not run");
  else {
    // 4
    api("/api/blendview/close", {});
    const r3 = daz({ settings: { mode: 2, url: URL_, lights: true, cameras: false, anim: true } });
    const ex = (r3.exports[0] || {}).set || {};
    check("The scene as 3D: Daz's FBX exporter silently (RunSilent 1, no options dialog) - figures, props, lights, NOT cameras (unticked), animation, embedded textures, FBX 2012 binary",
      r3.getOptions && r3.getOptions[0] === false && ex.RunSilent === 1 && ex.doSelected === false && ex.doFigures && ex.doProps && ex.doLights === true
      && ex.doCameras === false && ex.doAnims === true && ex.doEmbed === true && ex.format === "FBX 2012 -- Binary" && r3.exporterDeleted, ex);
    const cur = api("/api/blendview/current");
    check("bitGen: Blender made blender/daz/My_Shot.blend and it is OPEN in the preview (the figure, the prop, the camera)",
      cur.stem === "My_Shot" && fs.existsSync(path.join(pd, "blender", "daz", "My_Shot.blend"))
      && ["Genesis 9", "Crate", "Camera 1"].every((n) => (cur.meta.objects || []).some((x) => x.id === n)) && r3.boxes.some((b) => /open in the 🟧 preview/.test(b.t)),
      { stem: cur.stem, ids: (cur.meta.objects || []).map((x) => x.id), boxes: r3.boxes });
    // 5
    const r4 = daz({ settings: { mode: 3, url: URL_ } });
    const items = api("/api/daz/inbox?since=0").items;
    const mi = items.filter((i) => i.state === "merge").pop() || {};
    check("... merge (a scene open in bitGen): held for bitGen's Merge dialog with the Daz roots typed (figure / mesh / light / camera), Daz's box says to switch",
      mi.kind === "scene" && mi.into === "My_Shot" && JSON.stringify((mi.objects || []).map((o) => [o.name, o.type])) === JSON.stringify([["Genesis 9", "figure"], ["Crate", "mesh"], ["Spotlight 1", "light"], ["Camera 1", "camera"]])
      && r4.boxes.some((b) => /Merge dialog lists the objects, lights and cameras/.test(b.t)), { mi, boxes: r4.boxes });
    api("/api/daz/dismiss", { id: mi.id });
    // 6
    const r5 = daz({ settings: { mode: 4, url: URL_, layer: true } });
    const fx = (r5.exports[0] || {}).set || {};
    const glb = path.join(pd, "models3d", "Genesis_9.glb");
    check("The selected figure: FBX of the SELECTION only (no lights / cameras) -> models3d/Genesis_9.glb (a glTF), added as a layer",
      fx.doSelected === true && fx.doLights === false && fx.doCameras === false && fs.existsSync(glb) && fs.readFileSync(glb).slice(0, 4).toString() === "glTF"
      && r5.boxes.some((b) => /models3d\/Genesis_9\.glb - added as a 3D layer/.test(b.t)), { fx, boxes: r5.boxes });
    const bi = api("/api/blender/inbox?since=0").items.filter((i) => i.name === "Genesis_9.glb");
    check("... through the Blender bridge's inbox (the timeline adds it as a 3D layer)", bi.length === 1 && bi[0].layer === true, bi);
  }

  // 7
  const r6 = daz({ settings: { mode: 4, url: URL_ }, noSelection: true });
  check("nothing selected for 'figure' -> Daz's warning, nothing sent", r6.boxes.some((b) => b.kind === "warn" && /Select a figure or a prop first/.test(b.t))
    && !r6.procs.some((a) => /\/api\/daz\/send$/.test(a[a.length - 1])), r6.boxes);
  const r7 = daz({ settings: { mode: 0, url: URL_ }, frames: 0 });
  check("a one-frame play range -> 'Set the timeline's play range first'", r7.boxes.some((b) => /play range first/.test(b.t)) && !r7.renders.length, r7.boxes);
  const r8 = daz({ settings: { mode: 1, url: "http://127.0.0.1:9" } });
  check("bitGen not answering -> 'bitGen did not take it' with the address", r8.boxes.some((b) => b.kind === "warn" && /bitGen did not take it/.test(b.t)), r8.boxes);
  const e1 = api("/api/daz/send", { kind: "nope" });
  const e2 = api("/api/daz/send", { kind: "picture", file: "/no/such/still.png" });
  const e3 = api("/api/daz/send", { kind: "scene", file: path.join(ROOT, "package.json") });
  const e4 = api("/api/daz/send", { kind: "render", frames: ["/a.png"] });
  check("bitGen refuses in words: an unknown kind, a file not on this computer, a scene that is not .fbx, one frame",
    /kind: render \| picture \| scene \| figure/.test(e1.error || "") && /reads the files where Daz wrote them/.test(e2.error || "")
    && /must be \.fbx/.test(e3.error || "") && /at least two frames/.test(e4.error || ""), [e1.error, e2.error, e3.error, e4.error]);
  check("the address and the choices are remembered (Daz's app settings bitGen/Bridge)", r1.settingsKey === "bitGen/Bridge" && r1.settings.url === URL_ && r1.settings.mode === 0);
} catch (e) {
  fail++; console.log("FAIL: the run stopped: " + (e && e.stack || e));
} finally {
  try { api("/api/blendview/close", {}); api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
  try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\nRESULT: ${fail} failed (${pass} passed)`);
  process.exit(fail ? 1 : 0);
}
