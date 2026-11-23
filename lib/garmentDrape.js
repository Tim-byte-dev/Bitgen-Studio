// bitGen Studio — lib/garmentDrape.js (2.933.0): 👗 🧍 a garment sewn and draped on the display mannequin by Blender's cloth.
// The plan agreed at 2.929.0 ("drape on static/mannequins/mesh/<sex>.obj, OBJ -> Blender layer, front/side/back renders as
// references"). Blender's own cloth simulation does it (scripts/garment_drape.py) - NOT GarmentCode's simulator (non-commercial).
//
//   start(slug, {fabric, color, frames, render}, deps) -> {id}  a job in the background (one drape at a time)
//   get(id)        -> {id, slug, state queued|sewing|rendering|done|error, pct, note, result?, error?}
//   quality(r)     -> {ok, words}  (pure) - "seams closed", "slid down N cm", "N % inside the body"
// The drape goes in projects/<p>/garments/<slug>/drape/ (garment.obj + .mtl, dressed.glb, front / side / back.png,
// drape.json); dressed.glb is also models3d/garment-<slug>.glb (the image editor's 🧊 3D layer opens it) and the renders are
// Images garment-<slug>-<view>.png (References, Edit). meta.json gets {drape: {...}}.
// The body: static/mannequins/mesh/<sex>_drape.obj (the A-pose mannequin GarmentCode's sleeves are placed for).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("./core");

const FABRICS = ["cotton", "jersey", "silk", "denim"];
const JOBS = new Map();
let running = null, seq = 0;
const bad = (m, status) => Object.assign(new Error(m), { status: status || 400 });

function quality(r) {
  const q = r || {}, words = [];
  let ok = true;
  if ((q.seam_gap_max_cm || 0) > 3) { ok = false; words.push(`a seam is still ${Math.round(q.seam_gap_max_cm)} cm open`); }
  else words.push("seams closed");
  if ((q.drop_cm || 0) > 15) { ok = false; words.push(`it slid down ${Math.round(q.drop_cm)} cm (off the shoulders / hips)`); }
  if ((q.inside_pct || 0) > 3) { ok = false; words.push(`${q.inside_pct} % of it is inside the body`); }
  return { ok, words: words.join(", ") };
}
function cleanColor(c) {
  if (typeof c === "string" && /^#?[0-9a-f]{6}$/i.test(c)) { const h = c.replace("#", ""); return [0, 2, 4].map((i) => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)); }
  if (Array.isArray(c) && c.length === 3 && c.every((x) => isFinite(x))) return c.map((x) => Math.max(0, Math.min(1, +x)));
  return [0.55, 0.12, 0.16];
}

function start(slug, o, deps) {
  const d = deps || {}, opt = o || {};
  const G = require("./garment");
  const meta = G.get(slug);                         // 404 when there is no such garment
  const exe = d.blender !== undefined ? d.blender : require("./blender").find();
  if (!exe) throw bad("Blender is not installed (or not found - Settings ▸ Blender) - the drape is Blender's cloth simulation", 409);
  if (running) throw bad("a drape is running - wait for it", 409);
  const sex = (meta.body || {}).sex === "male" ? "male" : "female";
  const bodyObj = path.join(core.BASE, "static", "mannequins", "mesh", `${sex}_drape.obj`);
  if (!fs.existsSync(bodyObj)) throw bad(`the ${sex} drape mannequin is missing (static/mannequins/mesh/${sex}_drape.obj)`, 500);
  const dir = G.dirOf(slug), out = path.join(dir, "drape");
  const id = "dr" + Date.now().toString(36) + (++seq);
  const job = { id, slug, state: "queued", pct: 0, note: "starting Blender", started: Date.now() };
  JOBS.set(id, job);
  running = id;
  const req = { outline: path.join(dir, "outline.json"), body: bodyObj, out, name: slug,
    fabric: FABRICS.includes(opt.fabric) ? opt.fabric : "cotton", color: cleanColor(opt.color),
    frames: Math.max(20, Math.min(200, +opt.frames || 80)), render: opt.render !== false,
    size: Array.isArray(opt.size) ? opt.size.map((x) => Math.max(64, Math.min(2048, +x || 0))) : [640, 960],
    samples: Math.max(1, Math.min(256, +opt.samples || 24)) };
  (async () => {
    const run = d.run || require("./setupExec").run;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgdrape-"));
    const f = path.join(tmp, "req.json");
    let res = null; const tail = [];
    try {
      try { fs.rmSync(out, { recursive: true, force: true }); } catch { /* none */ }
      fs.writeFileSync(f, JSON.stringify(req));
      job.state = "sewing"; job.note = "sewing the seams";
      const script = path.join(core.BASE, "scripts", "garment_drape.py");
      const code = await run(exe, ["-b", "--factory-startup", "--python", script, "--", f], { timeout: 30 * 60000,
        env: Object.assign({}, process.env, { PYTHONUTF8: "1" }),
        log: (l) => {
          const s = String(l);
          let m = /DRAPE_STEP (\d+)\/(\d+)/.exec(s);
          if (m) { job.pct = Math.round(80 * (+m[1]) / (+m[2])); job.note = +m[1] < req.frames * 0.45 ? "sewing the seams" : "letting it settle"; return; }
          m = /DRAPE_RENDER (\w+)/.exec(s);
          if (m) { job.state = "rendering"; job.pct = Math.min(99, job.pct + 6); job.note = "rendered the " + m[1]; return; }
          m = /DRAPE (\{.*\})\s*$/.exec(s);
          if (m) { try { res = JSON.parse(m[1]); } catch { /* not it */ } return; }
          tail.push(s); if (tail.length > 12) tail.shift();
        } });
      if (!res || !res.ok) throw new Error((res && res.error) || ("Blender stopped" + (code === -2 ? " (over 30 minutes)" : "") + (tail.length ? ": " + tail.slice(-3).join(" | ").slice(0, 400) : "")));
      // the 3D model for the image editor, the renders for References / Edit
      const files = res.files || {};
      const model = `garment-${slug}.glb`;
      if (files.glb) { fs.mkdirSync(core.pDir("models3d"), { recursive: true }); fs.copyFileSync(path.join(out, files.glb), path.join(core.pDir("models3d"), model)); }
      const images = {};
      for (const v of ["front", "side", "back"]) {
        if (!files[v]) continue;
        const nm = `garment-${slug}-${v}.png`;
        fs.mkdirSync(core.pDir("images"), { recursive: true });
        fs.copyFileSync(path.join(out, files[v]), path.join(core.pDir("images"), nm));
        images[v] = nm;
      }
      const q = quality(res);
      const drape = { at: new Date().toISOString(), sex, fabric: req.fabric, color: req.color, frames: req.frames,
        files, model: files.glb ? model : null, images, seam_gap_cm: res.seam_gap_cm, seam_gap_max_cm: res.seam_gap_max_cm,
        inside_pct: res.inside_pct, drop_cm: res.drop_cm, lift_cm: res.lift_cm, seconds: res.seconds, good: q.ok, quality: q.words };
      const mf = path.join(G.dirOf(slug), "meta.json");
      const m0 = JSON.parse(fs.readFileSync(mf, "utf8"));
      m0.drape = drape;
      fs.writeFileSync(mf, JSON.stringify(m0, null, 1));
      job.result = G.get(slug).drape; job.state = "done"; job.pct = 100;
      job.note = (q.ok ? "✓ draped - " : "⚠ draped roughly - ") + q.words + ` (${res.seconds} s)`;
    } catch (e) {
      job.state = "error"; job.error = String(e.message || e); job.note = "✗ " + job.error;
    } finally {
      running = null;
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp */ }
      setTimeout(() => JOBS.delete(id), 60 * 60000).unref();
    }
  })();
  return { id };
}
function get(id) {
  const j = JOBS.get(String(id || ""));
  if (!j) throw bad("no such drape", 404);
  return Object.assign({}, j);
}
const DRAPE_FILES = ["garment.obj", "garment.mtl", "dressed.glb", "front.png", "side.png", "back.png", "drape.json"];

module.exports = { start, get, quality, cleanColor, FABRICS, DRAPE_FILES };
