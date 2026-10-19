#!/usr/bin/env node
/* bitGen Studio — 2.461.0: the EXPERIMENTAL Daz live link. lib/dazLive.js (pure + its queue) and the Daz script
 * daz/bitgen_bridge/bitGen Live Link.dsa run in a MOCK Daz Studio against the running app (H3_URL, default the e2e
 * server on :8311): the page queues a view + a pose, the script polls, places the "bitGen Camera" (Daz cm, Y up), looks
 * through it, turns the same-named bones on top of where they were, takes them back on "reset", reports the figure.
 * A real Daz Studio could not be used here - this checks the script's logic and its talk with bitGen. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const L = require("../lib/dazLive.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

/* ---- 1 the pure part + the queue */
check("toDaz: Blender (m, Z up) -> Daz (cm, Y up) = (100x, 100z, -100y)", JSON.stringify(L.toDaz([1, 2, 3])) === "[100,300,-200]");
check("cleanCmd: a view / a pose / reset made safe; anything else = null", JSON.stringify(L.cleanCmd({ type: "view", cam: { pos: [1, "2"], target: [0, 0, 0], fov: 900 } })) === '{"type":"view","cam":{"pos":[1,2,0],"target":[0,0,0],"fov":170}}'
  && JSON.stringify(L.cleanCmd({ type: "pose", figure: "G9", bones: { lShldrBend: [0, 0, 999], x: 5 } })) === '{"type":"pose","figure":"G9","bones":{"lShldrBend":[0,0,360]}}' && L.cleanCmd({ type: "nope" }) === null);
L._reset();
L.push({ type: "view", cam: { pos: [1, 1, 1], target: [0, 0, 0], fov: 40 } }); L.push({ type: "pose", figure: "G9", bones: { a: [1, 0, 0] } }); const last = L.push({ type: "view", cam: { pos: [2, 2, 2], target: [0, 0, 0], fov: 40 } });
let p = L.poll({ since: 0, info: { figure: "Genesis 9", bones: ["hip", "lShldrBend"] } });
check("the queue: a newer view replaces one Daz has not taken; Daz gets the pose + the latest view in order", p.cmds.length === 2 && p.cmds[0].type === "pose" && p.cmds[1].type === "view" && p.cmds[1].cam.pos[0] === 2 && last.seq === 3, p);
const p2 = L.poll({ since: p.seq });
check("...what Daz took is gone; status: linked, its figure + bones", p2.cmds.length === 0 && L.status().connected && L.status().info.figure === "Genesis 9" && L.status().queued === 0, L.status());
check("...bitGen restarted (Daz's last seq is ahead): it starts from the beginning", (L._reset(), L.push({ type: "reset" }), L.poll({ since: 50 }).cmds.length === 1));
L._reset();

/* ---- 2 the script in a mock Daz Studio, against the app */
const SRC = fs.readFileSync(path.join(ROOT, "daz", "bitgen_bridge", "bitGen Live Link.dsa"), "utf8");
const api = (u, body) => JSON.parse(execFileSync("curl", ["-s", "--noproxy", "*", "-X", body ? "POST" : "GET", "-H", "Content-Type: application/json", ...(body ? ["--data-binary", JSON.stringify(body)] : []), URL_ + u], { encoding: "utf8" }) || "{}");
let up = true;
try { api("api/daz/live"); } catch (e) { up = false; }
if (!up) { console.log("SKIP: the app is not running at " + URL_ + " - the live link script part did not run"); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
try { api("api/daz/live/poll", { since: 1e9 }); } catch (e) { /* drain */ }
const drained = api("api/daz/live/poll", { since: 0 }); api("api/daz/live/poll", { since: drained.seq });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "dazlive_"));
const rec = { cams: [], viewport: null, logs: [], polls: 0 };
class W { constructor() { this.text = ""; this.title = ""; } }
class Ctl { constructor(v) { this.v = v; } getValue() { return this.v; } setValue(v) { this.v = v; } }
class Bone { constructor(name) { this.name = name; this.c = [new Ctl(10), new Ctl(-5), new Ctl(0)]; } getXRotControl() { return this.c[0]; } getYRotControl() { return this.c[1]; } getZRotControl() { return this.c[2]; } inherits(t) { return t === "DzBone"; } getSkeleton() { return skel; } }
const bones = ["hip", "lShldrBend", "rShldrBend", "head"].map((n) => new Bone(n));
const skel = { inherits: (t) => t === "DzSkeleton", getLabel: () => "Genesis 9", getAllBones: () => bones, findBone: (n) => bones.find((b) => b.name === n) || null, findBoneByLabel: () => null };
class DzVec3 { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } }
const nodes = [];
class DzBasicCamera { constructor() { this.label = ""; rec.cams.push(this); } setLabel(l) { this.label = l; } getLabel() { return this.label; } setWSPos(v) { this.pos = [v.x, v.y, v.z]; } aimAt(v) { this.aim = [v.x, v.y, v.z]; } getFocalLengthControl() { return (this.fl = this.fl || new Ctl(65)); } }
const store = { url: URL_.replace(/\/+$/, "") };          // the address the bridge asked once
class DzAppSettings { getStringValue(n, d) { return n in store ? store[n] : d; } setStringValue(n, v) { store[n] = v; } }
let dlg = null;
class DzBasicDialog { constructor() { dlg = this; this.visible = false; } addWidget() {} setAcceptButtonText() {} setRejectButtonText() {} show() { this.visible = true; } close() { this.visible = false; } }
class DzFile { constructor(p) { this.p = p; } exists() { return fs.existsSync(this.p); } open(m) { this.m = m; if (m === 1 && !fs.existsSync(this.p)) return false; this.buf = ""; return true; } write(t) { this.buf += t; } read() { return fs.readFileSync(this.p, "utf8"); } close() { if (this.m & 2) fs.writeFileSync(this.p, this.buf); } }
DzFile.ReadOnly = 1; DzFile.WriteOnly = 2; DzFile.Truncate = 8;
class DzDir { constructor(p) { this.p = p; } exists() { return fs.existsSync(this.p); } mkpath(p) { fs.mkdirSync(p, { recursive: true }); return true; } }
class DzProcess { constructor(a) { this.a = a; this.running = false; this.out = ""; }
  start() { const a = this.a.slice(1); a.splice(0, 0, "--noproxy", "*"); try { this.out = execFileSync("curl", a, { encoding: "utf8" }); } catch (e) { this.out = String(e.stdout || ""); } if (/live\/poll/.test(a[a.length - 1])) rec.polls++; return true; }
  readStdout() { const s = this.out; this.out = ""; return s; } }
const viewport = { setCamera(c) { rec.viewport = c; }, getCamera() { return rec.viewport || { getLabel: () => "Perspective View" }; } };
const Scene = { findNodeByLabel: (l) => nodes.find((n) => n.getLabel && n.getLabel() === l) || (l === "Genesis 9" ? skel : null), findNode: () => null, addNode: (n) => nodes.push(n),
  getPrimarySelection: () => bones[1], getNumSkeletons: () => 1, getSkeleton: () => skel };
// the "user" while the script runs: after the 1st poll queue a reset, after the 3rd close the window
let step = 0, afterPose = null;
const processEvents = () => {
  if (rec.polls >= 1 && step === 0) { step = 1; afterPose = bones.map((b) => b.c.map((c) => c.v)); api("api/daz/live/cmd", { type: "reset" }); }
  if (rec.polls >= 3 && step === 1) { step = 2; dlg.visible = false; }
};
// the page queued (before Daz polls): a view at Blender (0, -6, 1.2) looking at (0, 0, 1.2), 45°, and a pose
const cam = { pos: L.toDaz([0, -6, 1.2]), target: L.toDaz([0, 0, 1.2]), fov: 45 };
api("api/daz/live/cmd", { type: "view", cam });
api("api/daz/live/cmd", { type: "pose", figure: "Genesis 9", bones: { lShldrBend: [0, 0, 60], head: [15, 0, 0], nope: [1, 1, 1] } });
const t0 = Date.now();
try {
  vm.runInNewContext(SRC, { App: { getTempPath: () => TMP }, Scene, MainWindow: { getViewportMgr: () => ({ getActiveViewport: () => ({ get3DViewport: () => viewport }) }) },
    DzAppSettings, DzBasicDialog, DzVGroupBox: W, DzLineEdit: class extends W { constructor() { super(); } }, DzLabel: W, DzFile, DzDir, DzProcess, DzBasicCamera, DzVec3,
    connect: () => {}, processEvents, JSON, Date, Math, parseInt, String, Array, isFinite }, { filename: "bitGen Live Link.dsa", timeout: 60000 });
} catch (e) { check("the script ran", false, e.stack); }
const c0 = rec.cams[0];
check("the script linked through the bridge's remembered address (it polled " + rec.polls + " times in " + Math.round((Date.now() - t0) / 1000) + " s)", rec.polls >= 3 && store.url === URL_.replace(/\/+$/, ""), { polls: rec.polls, store });
check("view: a 'bitGen Camera' added at Daz (0, 120, 600) cm aimed at (0, 120, 0), focal length from 45° (36 mm frame), the viewport looks through it",
  c0 && c0.label === "bitGen Camera" && JSON.stringify(c0.pos) === "[0,120,600]" && JSON.stringify(c0.aim) === "[0,120,0]" && Math.abs(c0.fl.v - 18 / Math.tan(22.5 * Math.PI / 180)) < 1e-9 && rec.viewport === c0 && nodes.includes(c0), c0 && { pos: c0.pos, aim: c0.aim, fl: c0.fl && c0.fl.v });
check("pose: the same-named bones turned ON TOP of where they were (lShldrBend Z 0 -> 60, head X 10 -> 25); the others untouched", afterPose && JSON.stringify(afterPose[1]) === "[10,-5,60]" && JSON.stringify(afterPose[3]) === "[25,-5,0]" && JSON.stringify(afterPose[0]) === "[10,-5,0]", afterPose);
check("reset: every bone the link turned back where it was", bones.every((b) => JSON.stringify(b.c.map((c) => c.v)) === "[10,-5,0]"), bones.map((b) => b.c.map((c) => c.v)));
const st = api("api/daz/live");
check("bitGen's status: linked, the figure Genesis 9 with its 4 bones, nothing waiting", st.connected && st.info && st.info.figure === "Genesis 9" && st.info.bones.length === 4 && st.queued === 0, st);
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
