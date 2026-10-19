// bitGen Studio — 360° ENVIRONMENTS (2.142.0, Tim: "is it possible to insert
// 360 environment pics into this workflow? to maintain continuity?").
//
// Yes — because the chain's references are TAGGED and SCENE-RANGED
// (MiniMaxH3ScheduledPictureReference has `tag` + `scenes`), not character-
// specific. An environment rides the same chain as the cast. The pano itself
// is never fed to the model: an equirectangular image is a distorted unroll
// of a sphere, and what a camera in that environment SEES is a projected
// view. ffmpeg's v360 filter does exactly that (equirect -> flat with
// yaw/pitch/fov), and the yaw/pitch conventions here are the SAME ones the
// 360 viewer already pinned (static/vr360.js, VR360.math: yaw 0 / pitch 0 =
// the centre of the equirect frame, +yaw right, +pitch up) — one convention,
// two consumers, so what you frame in the viewer is what the render sees.
//
// Continuity comes from every scene in a location referencing a view of the
// SAME pano: same walls, same light, different camera angles if you want
// them. Storage is per project: projects/<p>/environments/<slug>/ holding
// env.json + the pano + the extracted view.png (cached; re-extracted when
// the pano or the camera changes).
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const core = require("./core");
const chars = require("./characters");

const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
// 2.213.0 (by instruction: "can we use exr 360degree files for location
// background"): HDR pano formats CONVERT ONCE AT UPLOAD into the stored
// 8-bit pano.png — the browser's 360 viewer cannot decode EXR, and the
// reference chain is 8-bit RGB anyway, so the float range must be
// tone-mapped exactly once (with a real operator) instead of clipped on
// every extract. Downstream — viewer, v360 extraction, the chain — never
// learns HDR existed.
const HDR_EXT = new Set([".exr", ".hdr"]);
// The chain, deliberately zscale/libplacebo-FREE so it runs on any ffmpeg
// build that decodes EXR (setparams/tonemap/lutrgb/format are core):
//   setparams tags the linear transfer EXR/HDR frames carry but do not
//   declare; hable compresses highlights instead of clipping (a probe with
//   linear 0.18 | 8.0 lands at 76 | 249 — mid-tone kept, hot side NOT a
//   flat 255); the gammaval lut applies the display gamma tonemap's linear
//   output still needs, on 16-bit so it does not posterize.
const HDR_TONEMAP = "setparams=color_trc=linear,tonemap=hable:desat=0,"
  + "format=rgb48le,lutrgb=r=gammaval(0.454545):g=gammaval(0.454545)"
  + ":b=gammaval(0.454545),format=rgb24";

/**
 * Tone-map an .exr/.hdr file into an 8-bit PNG. Returns {ok} or {error} —
 * never throws; the route speaks the reason. Exported so the unit test pins
 * the exact chain against real ffmpeg runs with handcrafted HDR files.
 */
function convertHdrPano(srcPath, destPath) {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", srcPath,
                                 "-vf", HDR_TONEMAP,
                                 "-frames:v", "1", destPath]);
  if (r.status !== 0 || !fs.existsSync(destPath)) {
    try { fs.rmSync(destPath, { force: true }); } catch { /* partials die */ }
    return { error: "ffmpeg could not tone-map the HDR pano: "
                  + String(r.stderr || "unknown").slice(0, 200) };
  }
  return { ok: true };
}

function envRoot(project) {
  return path.join(core.projDir(project || core.getProject()), "environments");
}
function envDir(name, project) {
  return path.join(envRoot(project), chars.slug(name).replace(/\s+/g, "_"));
}

function readOne(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, "env.json"), "utf8"));
    if (!j || !j.name) return null;
    j.pano = fs.readdirSync(dir).find((f) => IMG_EXT.has(path.extname(f).toLowerCase())
                                              && f !== "view.png"
                                              && f !== ".pano-convert.png") || "";
    j.view = fs.existsSync(path.join(dir, "view.png")) ? "view.png" : "";
    return j;
  } catch { return null; }
}

/** Every environment in the project, in name order. Never throws. */
function list(project) {
  try {
    return fs.readdirSync(envRoot(project)).sort()
      .map((d) => readOne(path.join(envRoot(project), d)))
      .filter(Boolean);
  } catch { return []; }
}

function get(name, project) { return readOne(envDir(name, project)); }

const num = (v, d) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d);

/**
 * Create or update an environment. The camera (yaw/pitch/fov, degrees, the
 * viewer's conventions) and the scene range (`scenes`, same syntax the
 * chain's scheduled references take, default "all") live in env.json; the
 * tag defaults from the name and is what prompts reference (@tag).
 */
function save(env, project) {
  const name = chars.slug((env || {}).name || "");
  if (!name) return { error: "an environment needs a name" };
  const dir = envDir(name, project);
  fs.mkdirSync(dir, { recursive: true });
  const prev = readOne(dir) || {};
  const j = {
    name,
    // tagOf, not slug: the Scheduled*Reference pack validates its tag widget
    // ("stable tag such as 'hero_face'") — no spaces, no punctuation (2.145.0)
    tag: chars.tagOf(env.tag || prev.tag || name),
    scenes: String(env.scenes !== undefined ? env.scenes : (prev.scenes || "all")) || "all",
    yaw: num(env.yaw !== undefined ? env.yaw : prev.yaw, 0),
    pitch: num(env.pitch !== undefined ? env.pitch : prev.pitch, 0),
    fov: Math.min(140, Math.max(30, num(env.fov !== undefined ? env.fov : prev.fov, 90))),
    stamp: prev.stamp || "",
  };
  fs.writeFileSync(path.join(dir, "env.json"), JSON.stringify(j, null, 2));
  return { ok: true, env: readOne(dir) };
}

/** Attach (replace) the 360 pano; any previous pano is removed. */
function setPano(name, srcPath, origName, project) {
  const dir = envDir(name, project);
  if (!fs.existsSync(path.join(dir, "env.json"))) return { error: "no such environment" };
  const ext = path.extname(origName || srcPath).toLowerCase();
  if (!IMG_EXT.has(ext) && !HDR_EXT.has(ext))
    return { error: `not an image: ${origName}` };
  // 2.213.0: HDR sources CONVERT FIRST into a temp beside the target, and
  // the old pano is only removed once the conversion succeeded — a corrupt
  // .exr must not cost the location its working pano.
  let staged = null, panoName = "pano" + ext;
  if (HDR_EXT.has(ext)) {
    staged = path.join(dir, ".pano-convert.png");
    const c = convertHdrPano(srcPath, staged);
    if (c.error) return c;
    panoName = "pano.png";
  }
  for (const f of fs.readdirSync(dir))
    if (IMG_EXT.has(path.extname(f).toLowerCase()) && f !== "view.png"
        && f !== ".pano-convert.png")
      fs.unlinkSync(path.join(dir, f));
  if (staged) fs.renameSync(staged, path.join(dir, panoName));
  else fs.copyFileSync(srcPath, path.join(dir, panoName));
  return { ok: true, env: readOne(dir), converted: !!staged };
}

function remove(name, project) {
  const dir = envDir(name, project);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

/** The ffmpeg v360 filter for a camera — one place, so the extraction and
 *  its tests agree on the exact projection the render will reference. */
function viewFilter(env, width, height) {
  const vfov = Math.min(140, Math.max(10, env.fov * (height / Math.max(1, width))));
  return `v360=e:flat:yaw=${env.yaw}:pitch=${env.pitch}`
       + `:h_fov=${env.fov}:v_fov=${vfov.toFixed(2)},scale=${width}:${height}`;
}

/**
 * Project the pano into view.png through the environment's camera. Cached:
 * re-runs only when the pano or the camera changed since the last extract
 * (the stamp in env.json). Returns {ok, view} or {error} — never throws; an
 * environment with no pano is reported, not exploded on.
 */
function extractView(name, project, size) {
  const dir = envDir(name, project);
  const env = readOne(dir);
  if (!env) return { error: "no such environment" };
  if (!env.pano) return { error: `${env.name}: no 360 pano uploaded` };
  const width = (size || {}).width || 832, height = (size || {}).height || 480;
  const panoAbs = path.join(dir, env.pano);
  const stamp = [env.pano, fs.statSync(panoAbs).mtimeMs,
                 env.yaw, env.pitch, env.fov, width, height].join("|");
  const viewAbs = path.join(dir, "view.png");
  if (env.stamp === stamp && fs.existsSync(viewAbs))
    return { ok: true, view: viewAbs, cached: true };
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", panoAbs,
                                 "-vf", viewFilter(env, width, height),
                                 "-frames:v", "1", viewAbs]);
  if (r.status !== 0 || !fs.existsSync(viewAbs))
    return { error: `${env.name}: ffmpeg v360 failed: `
                  + String(r.stderr || "").slice(0, 200) };
  const j = JSON.parse(fs.readFileSync(path.join(dir, "env.json"), "utf8"));
  j.stamp = stamp;
  fs.writeFileSync(path.join(dir, "env.json"), JSON.stringify(j, null, 2));
  return { ok: true, view: viewAbs };
}

module.exports = { list, get, save, setPano, remove, extractView, viewFilter,
                   envDir, envRoot, convertHdrPano, HDR_EXT, HDR_TONEMAP };
