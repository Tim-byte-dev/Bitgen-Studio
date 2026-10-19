/* bitGen Studio — lib/body3d.js (2.471.0): PARAMETRIC 3D BODIES on the server - the engine setting + the Blender engine.
 *
 * Tim (verbatim): "can we add fusion 360 style extrude, revolve, fillet, split to create new bodies 3d layers and make it
 * parametric like fusion 360?" - the engine: "in settings give user option for 1 and 3, use the option the user selects
 * but add both 1 and 3" (1 = OpenCascade in the page, static/body3docc.js; 3 = Blender, here).
 *
 *   settings() / saveSettings(o)   {engine: "occ" | "blender"} in the settings (config.body3d) - Settings ▸ 3D
 *   cleanJob(job)                  the job checked (ops of the known kinds, every number finite, at most 200 ops /
 *                                  20 000 segments) -> a clean copy, or throws {status 400}
 *   build(job)                     -> Promise {mesh: {vertices, triangles}, volume, warnings} - Blender headless runs
 *                                  scripts/blend_body3d.py (one at a time; 3 minutes at most)
 * Routes: routes/body3d.js. The same job goes to either engine (static/body3d.js plan()).
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const core = require("./core");
const blender = require("./blender");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "blend_body3d.py");
const ENGINES = ["occ", "blender"];
const OPS = ["extrude", "revolve", "fillet", "chamfer", "split", "shell"];
const bad = (m, status) => { const e = new Error(m); e.status = status || 400; return e; };

function settings() {
  const c = (core.getConfig() || {}).body3d || {};
  return { engine: ENGINES.includes(c.engine) ? c.engine : "occ" };
}
function saveSettings(o) {
  const cfg = core.getConfig() || {}, next = Object.assign({}, settings());
  if (o && ENGINES.includes(o.engine)) next.engine = o.engine;
  cfg.body3d = next; core.setConfig(cfg);
  return next;
}

const num = (v, what) => { const n = Number(v); if (!Number.isFinite(n)) throw bad(`${what} is not a number`); return n; };
const pt2 = (p, what) => { if (!Array.isArray(p) || p.length < 2) throw bad(`${what} is not a point`); return [num(p[0], what), num(p[1], what)]; };
function cleanSeg(g) {
  if (!g || typeof g !== "object") throw bad("a bad segment");
  if (g.k === "L") return { k: "L", a: pt2(g.a, "a line's start"), b: pt2(g.b, "a line's end") };
  if (g.k === "A") return { k: "A", a: pt2(g.a, "an arc's start"), m: pt2(g.m, "an arc's middle"), b: pt2(g.b, "an arc's end") };
  if (g.k === "C") { const r = num(g.r, "a circle's radius"); if (r <= 0) throw bad("a circle's radius must be more than 0"); return { k: "C", c: pt2(g.c, "a circle's centre"), r }; }
  if (g.k === "B") return { k: "B", a: pt2(g.a, "a curve's start"), c1: pt2(g.c1, "a curve's handle"), c2: pt2(g.c2, "a curve's handle"), b: pt2(g.b, "a curve's end") };
  throw bad("an unknown segment kind");
}
function cleanJob(job) {
  if (!job || !Array.isArray(job.ops)) throw bad("no ops");
  if (job.ops.length > 200) throw bad("too many features (200 at most)");
  let segs = 0;
  const loop = (l) => { if (!Array.isArray(l) || !l.length) throw bad("an empty loop"); segs += l.length; if (segs > 20000) throw bad("the profiles are too big"); return l.map(cleanSeg); };
  const ops = job.ops.map((o) => {
    if (!o || !OPS.includes(o.op)) throw bad("an unknown feature");
    const c = { op: o.op, id: String(o.id || "").slice(0, 40) };
    if (o.op === "extrude" || o.op === "revolve") {
      if (!Array.isArray(o.profiles) || !o.profiles.length) throw bad("no profile");
      c.profiles = o.profiles.map((p) => ({ outer: loop(p && p.outer), holes: (p && Array.isArray(p.holes) ? p.holes : []).map(loop) }));
      c.z = num(o.z || 0, "the plane offset"); c.mode = ["new", "join", "cut", "intersect"].includes(o.mode) ? o.mode : "join";
      if (o.op === "extrude") { c.dist = num(o.dist, "the distance"); c.dist2 = num(o.dist2 || 0, "the second distance"); c.dir = ["one", "sym", "two"].includes(o.dir) ? o.dir : "one"; }
      else { c.angle = Math.max(-360, Math.min(360, num(o.angle, "the angle"))); c.axis = { o: pt2(o.axis && o.axis.o, "the axis"), d: pt2(o.axis && o.axis.d, "the axis") }; if (!Math.hypot(c.axis.d[0], c.axis.d[1])) throw bad("the axis has no direction"); }
    }
    if (o.op === "fillet") c.radius = num(o.radius, "the radius");
    if (o.op === "chamfer") c.dist = num(o.dist, "the distance");
    if (o.op === "fillet" || o.op === "chamfer") c.edges = ["all", "top", "bottom", "vertical", "horizontal"].includes(o.edges) ? o.edges : "all";
    if (o.op === "split") { c.plane = ["XY", "XZ", "YZ"].includes(o.plane) ? o.plane : "XY"; c.offset = num(o.offset || 0, "the offset"); c.keep = o.keep === "neg" ? "neg" : "pos"; }
    if (o.op === "shell") { c.thick = num(o.thick, "the thickness"); c.face = o.face === "bottom" ? "bottom" : "top"; }
    return c;
  });
  return { v: 1, ops };
}

let queue = Promise.resolve();
function build(job0) {
  const job = cleanJob(job0);
  const exe = blender.find();
  if (!exe) return Promise.reject(bad("Blender was not found - set its path in the timeline's 🟧 Blender settings, or pick \"In the browser (OpenCascade)\" in Settings ▸ 3D", 409));
  const run = () => new Promise((ok, no) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bgbody-")), inF = path.join(dir, "job.json"), outF = path.join(dir, "out.json");
    fs.writeFileSync(inF, JSON.stringify(job));
    execFile(exe, ["-b", "--factory-startup", "-P", SCRIPT, "--", inF, outF], { cwd: ROOT, windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 3 * 60 * 1000 }, (err, stdout, stderr) => {
      let out = null;
      try { out = JSON.parse(fs.readFileSync(outF, "utf8")); } catch (e) { out = null; }
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp */ }
      if (!out) return no(bad("Blender did not finish the body" + (err ? ": " + String(err.message || err).split("\n")[0] : "") + (stderr ? " - " + String(stderr).trim().split("\n").slice(-1)[0] : ""), 500));
      if (out.error) { const e = bad(out.error, 422); e.warnings = out.warnings; return no(e); }
      ok(out);
    });
  });
  const p = queue.then(run, run); queue = p.catch(() => {});
  return p;
}

module.exports = { ENGINES, OPS, settings, saveSettings, cleanJob, build, SCRIPT };
