// bitGen Studio — lib/garmentAddon.js (2.932.0): Settings ▸ Add-ons ▸ Garment designer (GarmentCode sewing patterns).
//
// Tim (2.928.0 - 2.931.0): display mannequins "ad our garment design" -> the agreed plan: GarmentCode (MIT) for the patterns,
// garment types + sliders, the LLM from words, a to-scale pattern PDF; then the drape on the mannequins (2.933.0).
//
// GarmentCode (github.com/maria-korosteleva/GarmentCode, MIT, (c) Maria Korosteleva / ETH Zurich) = pygarment + its garment
// programs (assets/garment_programs: shirts, collars, sleeves, skirts, pants, waistbands). bitGen uses ONLY the pattern side.
// NOT used: GarmentCode's drape simulator (NvidiaWarp-GarmentCode, NVIDIA Source Code License - non-commercial), its SMPL
// bodies, ChatGarment. Nothing of GarmentCode is shipped in bitGen - the install fetches it, like the other add-ons.
//
// <app>/garmentcode/
//   GarmentCode/       the repository (git clone, else GitHub's zip)
//   .venv/             its own Python 3.10 - 3.12 (pygarment needs numpy < 2 - no 3.13 wheels; with the app's 3.13 the
//                      runtime's uv makes a 3.12 one): numpy<2 scipy svgwrite svgpathtools pyyaml psutil matplotlib
//                      (CairoSVG is left out - it needs the cairo library on Windows; scripts/garment_pattern.py stands in)
//   schema.json        the repository's own design tree (assets/design_params/default.yaml), written at the install
//   installed.json     {at, test: {panels}} - a T-shirt made on the mannequin during the install proved it works
//   paths(base) / status(base) / install(ctx) / remove() / LINKS / PKGS
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");
const S = () => require("./speechAddons");

const REPO = "https://github.com/maria-korosteleva/GarmentCode";
const PKGS = ["numpy<2", "scipy", "svgwrite", "svgpathtools", "pyyaml", "psutil", "matplotlib"];
const LINKS = [
  { label: "GarmentCode (GitHub, MIT) - the sewing-pattern programs", url: REPO, kind: "pack", dest: "garmentcode/GarmentCode" },
];

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;
  const dir = path.join(b, "garmentcode"), venv = path.join(dir, ".venv");
  return { dir, src: path.join(dir, "GarmentCode"), venv, python: S().venvPy(venv), schema: path.join(dir, "schema.json"),
    marker: path.join(dir, "installed.json"), script: path.join(core.BASE, "scripts", "garment_pattern.py") };
}
const has = (p) => { try { return fs.statSync(p).size > 0; } catch { return false; } };

/** the Python + repository to run with - GARMENT_PY / GARMENT_SRC (tests, a hand-made setup) win */
function runtime(base) {
  const p = paths(base);
  return { python: process.env.GARMENT_PY || p.python, src: process.env.GARMENT_SRC || p.src, script: p.script };
}
function status(base) {
  const p = paths(base), r = runtime(base);
  let mark = null;
  try { mark = JSON.parse(fs.readFileSync(p.marker, "utf8")); } catch { mark = null; }
  const ready = has(r.python) && has(path.join(r.src, "assets", "garment_programs", "meta_garment.py"));
  if (ready && (mark || process.env.GARMENT_PY)) return { installed: true, note: "ready - 👗 Garment designer makes sewing patterns (GarmentCode, MIT)" };
  return { installed: false, note: fs.existsSync(p.dir) ? "partly there - Install again" : "not installed" };
}

/** a 3.10 - 3.12 venv when the app's Python is 3.13 (numpy < 2 has no 3.13 wheels): another Python on this computer, or uv
 *  (found or installed) fetches 3.12 - 2.997.0 lib/pyVersion.js */
function venv312(ctx, venv) {
  return require("./pyVersion").venvFor(Object.assign({}, ctx, { python: ctx.python }), { venv, want: "3.12", range: "3.10 - 3.12", fits: (m) => m >= 10 && m <= 12, label: "the Garment designer", why: "pygarment needs numpy < 2, which has no 3.13 wheels" });
}

/** ctx = {log, run, python, env, base, git, fetchRepo, uv} -> {ok, error} */
async function install(ctx) {
  const c = ctx || {};
  const log = c.log || (() => {}), run = c.run || X.run, p = paths(c.base);
  const A = S();
  const pv = await A.pythonOk(c, "Garment designer"); if (pv.error) return { ok: false, error: pv.error };
  log(`[ok] Python ${pv.ver} (${c.python}) - GarmentCode's sewing-pattern programs (MIT)`, false);
  fs.mkdirSync(p.dir, { recursive: true });
  try { fs.unlinkSync(p.marker); } catch { /* not there */ }
  // 1 the code
  if (!has(path.join(p.src, "assets", "garment_programs", "meta_garment.py"))) {
    const git = c.git === undefined ? X.which("git", require("./setupRun").runtimeDirs()) : c.git;
    const fetchRepo = c.fetchRepo || require("./setupPacks").fetchRepo;
    log(`[..] GarmentCode (${REPO})`, false);
    try { fs.rmSync(p.src, { recursive: true, force: true }); } catch { /* not there */ }
    const fr = await fetchRepo(REPO + ".git", p.src, { log, git, env: A.envOf(c) });
    if (!fr.ok || !has(path.join(p.src, "assets", "garment_programs", "meta_garment.py")))
      return { ok: false, error: "could not fetch GarmentCode: " + (fr.error || "its garment programs are not in it") };
  } else log(`[ok] GarmentCode is there: ${p.src}`, false);
  // 2 its Python (numpy < 2 -> 3.10 - 3.12)
  let v;
  if (+String(pv.ver).split(".")[1] > 12 && !has(p.python)) v = await venv312(c, p.venv);
  else v = await A.makeVenv(c, p.venv);
  if (v.error) return { ok: false, error: v.error };
  log(`[..] its Python packages: ${PKGS.join(" ")}`, false);
  if (await run(v.python, ["-m", "pip", "install", ...PKGS, "--progress-bar", "off"], { log, env: A.envOf(c), timeout: 30 * 60000 }) !== 0)
    return { ok: false, error: "pip could not install the Garment designer's packages - see the log above" };
  // 3 its own design tree + a T-shirt on the mannequin = it works
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bggarment-"));
  try {
    const say = async (req) => {
      const f = path.join(tmp, "req.json");
      fs.writeFileSync(f, JSON.stringify(req));
      let res = null;
      const code = await run(v.python, [p.script, f], { log: (l) => { const m = /GARMENT (\{.*\})\s*$/.exec(String(l)); if (m) { try { res = JSON.parse(m[1]); } catch { /* not it */ } } }, env: A.envOf(c), timeout: 5 * 60000 });
      return code === 0 && res ? res : (res || { ok: false, error: "the pattern script did not answer" });
    };
    const sc = await say({ op: "schema", src: p.src });
    if (!sc.ok) return { ok: false, error: "GarmentCode's design settings could not be read: " + sc.error };
    fs.writeFileSync(p.schema, JSON.stringify({ design: sc.schema }, null, 1));
    const G = require("./garment");
    const design = G.designFor(G.presetValues("tshirt"), sc.schema);
    const t = await say({ op: "make", src: p.src, name: "test", out: path.join(tmp, "test"), body: G.mannequinBody("female"), design });
    if (!t.ok) return { ok: false, error: "the test T-shirt could not be made: " + t.error };
    log(`[ok] a test T-shirt on the female mannequin: ${t.panels} pieces, ${t.stitches} seams`, false);
    fs.writeFileSync(p.marker, JSON.stringify({ at: new Date().toISOString(), test: { panels: t.panels }, python: v.python }, null, 2));
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp */ } }
  log("[ok] ready - 👗 Garment designer (the Character creator's sheet tab, or the image editor's 👗) makes sewing patterns to scale", false);
  return { ok: true };
}

function remove() {
  return async (log) => {
    const d = paths().dir;
    log(`[..] removing ${d}`, false);
    const ok = require("./setupPacks").safeRm(d, log);
    return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` };
  };
}

module.exports = { REPO, PKGS, LINKS, paths, runtime, status, install, remove, venv312 };
